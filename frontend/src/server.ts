import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const dashHost = new URL(environment.frontendBaseUrl).hostname;
const isProd = process.env['NODE_ENV'] === 'production';

/**
 * Has to stay ahead of the host rewrite below: bundles and assets live at real paths in the
 * browser folder and are requested that way from every host, so rewriting them to /dash/* would
 * turn every script tag into a 404 that falls through to the Angular handler and comes back as
 * HTML - which the browser refuses to execute, leaving the app dead on arrival.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Only in production do www/dash actually mean different domains: locally there is just one
 * hostname, so the dashboard keeps living under /dash and none of this applies.
 *
 * The Angular route table mounts the dashboard app at '/dash' (see app.routes.server.ts, which
 * ships it as a client-rendered shell). On the dash subdomain it needs to appear at the root
 * instead, so requests are rewritten to that internal path before Angular ever sees them - the
 * browser's own address bar is untouched, since that rewrite only affects the upstream request.
 */
app.use((req, res, next) => {
  if (!isProd) return next();

  const host = (req.headers.host ?? '').split(':')[0];
  const targetsDash = req.url === '/dash' || req.url.startsWith('/dash/') || req.url.startsWith('/dash?');

  if (host === dashHost) {
    if (!targetsDash) {
      const queryIndex = req.url.indexOf('?');
      const path = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex);
      const query = queryIndex === -1 ? '' : req.url.slice(queryIndex);
      const rewritten = `/dash${path === '/' ? '' : path}${query}`;

      // Angular's Node adapter builds the request URL from `originalUrl ?? url`, so rewriting
      // only `url` leaves it resolving the untouched path and serving the prerendered landing
      // page at the dashboard's root. Both have to move for the rewrite to be honoured.
      req.url = rewritten;
      req.originalUrl = rewritten;
    }
  } else if (targetsDash) {
    res.status(404).end();
    return;
  }

  next();
});

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);