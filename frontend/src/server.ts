import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment';
import { isOverlayUrl } from './data/overlay';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const dashHost = new URL(environment.frontendBaseUrl).hostname;
const isProd = process.env['NODE_ENV'] === 'production';

/**
 * Built from the environment rather than written out, so a local build names its own API and not
 * the live one.
 *
 * Both style-src and script-src have to allow inline, for different reasons.
 *
 * Styles: Angular and Material write component styles into <style> tags and set style attributes
 * directly.
 *
 * Scripts: Angular's event replay ships two inline ones - the dispatch contract and the call that
 * boots it - which is what remembers a click made before hydration finishes. A nonce cannot cover
 * them: the contract is placed into index.html at build time, and the pages carrying it are
 * prerendered, so there is no request to mint a nonce for. Hashes would fit today and rot quietly,
 * because the second script names the event types the templates happen to register. And Angular
 * offers withEventReplay to turn it on, with no counterpart to turn it off.
 *
 * What that costs is worth being clear about: this no longer stops an injected inline script. It
 * still refuses scripts from any other origin, which is how an injection usually reaches for a
 * payload. The app itself writes no HTML - no innerHTML, no bypassSecurityTrust, no eval - so
 * Angular escaping every interpolation is what actually guards this, and the header is the
 * second line rather than the first.
 */
const POLICY: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://static-cdn.jtvnw.net",
  `connect-src 'self' ${new URL(environment.apiBaseUrl).origin}`,
];

// Says which server software this is, to nobody who needs to know.
app.disable('x-powered-by');

/**
 * Set on everything, static files included, and ahead of every other handler so a route added
 * later cannot quietly opt out of them.
 *
 * Caddy and Cloudflare sit in front in production and may add their own; these are what the app
 * itself guarantees, and what holds if it is ever served without either.
 *
 * HSTS is production-only because it would otherwise pin a local machine to https for a year over
 * a self-signed certificate. It deliberately omits includeSubDomains and preload: both are hard to
 * take back, and one plain-http subdomain would disappear for everyone who had already visited.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000');

  /**
   * The dashboard has nothing to index: behind a login, and client-rendered, so a crawler reads
   * an empty shell of a page it can never see the inside of.
   *
   * Said in a header rather than in robots.txt, for two reasons. That file is shared by both
   * hosts, and its Disallow names /dash/ - the path the dashboard has on the marketing host, not
   * the root it actually sits at here. And a Disallow is the wrong instrument anyway: it stops the
   * fetch, so the crawler never reads the noindex it was supposed to obey.
   */
  if (isProd && (req.headers.host ?? '').split(':')[0] === dashHost) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  /**
   * Nothing here is meant to be embedded, so framing is refused - except on the overlays, which
   * are the one thing a streaming layout might legitimately put in an iframe. They carry no
   * session and no controls, so there is no click on them worth hijacking.
   */
  const embeddable: boolean = isOverlayUrl(req.url);

  if (!embeddable) res.setHeader('X-Frame-Options', 'DENY');

  /**
   * frame-ancestors is the modern half of the framing rule, and follows the same exception.
   *
   * Enforced. The whole app was walked through under this policy first, signed in and including
   * the exports: the Twitch CDN, the blob downloads and the live stream all passed, and the only
   * complaints were Angular's own inline scripts, which is why script-src allows them.
   */
  res.setHeader('Content-Security-Policy',
    [...POLICY, ...(embeddable ? [] : ["frame-ancestors 'none'"])].join('; '));

  next();
});

// Store it, but ask before using it - not, despite the name, a refusal to cache.
const REVALIDATE = 'no-cache';

/**
 * How long a file may be used without asking, decided by two questions: can the content behind this
 * name still change, and what breaks if a client uses a stale copy anyway.
 *
 * - Hashed bundles answer no to the first - a deploy never rewrites one, it publishes new names -
 *   so they are cached for the longest span convention allows and, thanks to immutable, not even
 *   revalidated on an explicit reload.
 * - Documents keep their names and are the index into those hashed ones, which makes a stale copy a
 *   dead app rather than an old one: it goes on naming bundles the new build no longer publishes.
 *   A few kilobytes, so asking every time is cheaper than a deploy that half arrives.
 * - robots.txt, llms.txt, sitemap.xml and security.txt are instructions rather than content.
 *   Their whole point is to be changeable, and an hour is about the shortest notice a crawler
 *   will act on. Nobody reading them is a visitor, so this is the one bucket where a stale copy
 *   cannot reach one.
 * - Everything left is artwork: stable in name, replaceable in principle. It revalidates like the
 *   documents do, because a swapped image under an old name would otherwise show the old picture
 *   for as long as the lifetime says - and a 304 for an unchanged file costs a few hundred bytes,
 *   which this instance can afford far more easily than a wrong icon on screen.
 */
const LIFETIMES: readonly (readonly [RegExp, string])[] = [
  [/-[A-Za-z0-9_-]{8,}\.(?:js|css)$/, 'public, max-age=31536000, immutable'],
  [/\.html$/, REVALIDATE],
  [/(?:robots|llms|security)\.txt$|sitemap\.xml$/, 'public, max-age=3600'],
];

function lifetime(res: express.Response, path: string): void {
  const match = LIFETIMES.find(([name]) => name.test(path));

  res.setHeader('Cache-Control', match ? match[1] : REVALIDATE);
}

/**
 * Its own mount, because express.static refuses anything with a dot-prefixed segment and the
 * blanket way round that would serve every other dotfile the folder ever picks up. Rooted inside
 * .well-known, so nothing below it is dotted any more and the refusal never applies.
 */
app.use('/.well-known', express.static(join(browserDistFolder, '.well-known'), {
  index: false,
  redirect: false,
  setHeaders: lifetime,
}));

/**
 * Has to stay ahead of the host rewrite below: bundles and assets live at real paths in the
 * browser folder and are requested that way from every host, so rewriting them to /dash/* would
 * turn every script tag into a 404 that falls through to the Angular handler and comes back as
 * HTML - which the browser refuses to execute, leaving the app dead on arrival.
 */
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: lifetime,
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

  /**
   * The OBS overlays live at the top of the route table rather than inside the dashboard, because
   * a browser source carries no session and must not sit behind the auth guard. Rewriting one to
   * /dash/* would therefore aim it at a route that only exists in development, leaving the
   * wildcard to redirect it to '/' - which is where the guard then sends it on to the marketing
   * site, and OBS captures the login page instead of the overlay.
   *
   * Asked through isOverlayUrl rather than one overlay at a time, so an overlay added to the
   * route table cannot reach production still being rewritten into the dashboard.
   */
  if (isOverlayUrl(req.url)) return next();

  const host = (req.headers.host ?? '').split(':')[0];
  const targetsDash = req.url === '/dash' || req.url.startsWith('/dash/') || req.url.startsWith('/dash?');

  if (host === dashHost) {
    if (!targetsDash) {
      const queryIndex = req.url.indexOf('?');
      const path = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex);
      const query = queryIndex === -1 ? '' : req.url.slice(queryIndex);
      const rewritten = `/dash${path === '/' ? '' : path}${query}`;

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
  /**
   * Angular sends these documents without a word about caching, which leaves every client free to
   * invent its own answer - and the one embedded in OBS answers badly. An overlay therefore says
   * no-store in every dialect there is: the modern header, the HTTP/1.0 one the bundled Chromium is
   * old enough to still consult, and an expiry already in the past for whatever ignores both. It is
   * the one page on the site with no address bar and no working reload, so a copy that settles into
   * that cache stays there for the rest of the stream.
   *
   * Everything else revalidates instead of refusing storage outright: a conditional request is
   * cheap, and being a build behind matters far less on a page someone can simply reload.
   */
  if (isOverlayUrl(req.url)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    res.setHeader('Cache-Control', REVALIDATE);
  }

  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point or is run via PM2.
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