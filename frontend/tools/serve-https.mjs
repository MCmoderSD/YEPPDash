/**
 * Serves the built SSR app over HTTPS on localhost, for benchmarking a real production bundle
 * before it is deployed.
 *
 * HTTPS is not a nicety here. The session cookie is Secure and SameSite=Lax, and under schemeful
 * same-site an http:// page and an https:// API count as different sites — the cookie would never
 * be sent, and the dashboard could not be signed into at all. Same reason the Angular dev server
 * already runs on TLS, and it reuses that same certificate.
 *
 * Build first, with the configuration that matches what you want to look at:
 *   ng build --configuration local   -> the dashboard, against the local backend
 *   ng build                         -> the public pages, against the deployed API
 */
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env['PORT'] ?? 4000);

// Both are read at module scope by the bundle below, so they have to be set before it is imported.
// NODE_ENV switches on the host rewrite that puts the dashboard at the root, which is what makes
// this behave like the dash subdomain rather than like the dev server.
process.env['NODE_ENV'] = 'production';
process.env['NG_ALLOWED_HOSTS'] ??= 'localhost';

const built = join(here, '..', 'dist', 'YEPPDash', 'server', 'server.mjs');

let reqHandler;
try {
  // Imported rather than run: server.mjs only starts listening when it is the entry point, so this
  // gets the Express app without its plain-HTTP listener.
  ({ reqHandler } = await import(pathToFileURL(built).href));
} catch (error) {
  console.error(`Could not load ${built}\nBuild it first: npm run build -- --configuration local\n`);
  throw error;
}

const server = createServer(
  {
    key: readFileSync(join(here, '..', '.certs', 'localhost.key')),
    cert: readFileSync(join(here, '..', '.certs', 'localhost.pem')),
  },
  reqHandler,
);

server.listen(port, () => console.log(`Serving the production bundle on https://localhost:${port}`));
