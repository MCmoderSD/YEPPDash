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
 * - robots.txt and llms.txt are instructions rather than content. Their whole point is to be
 *   changeable, and an hour is about the shortest notice a crawler will act on.
 * - Everything left is artwork: stable in name, replaceable in principle, harmless when a day out
 *   of date.
 */
const LIFETIMES: readonly (readonly [RegExp, string])[] = [
  [/-[A-Za-z0-9_-]{8,}\.(?:js|css)$/, 'public, max-age=31536000, immutable'],
  [/\.html$/, REVALIDATE],
  [/(?:robots|llms)\.txt$/, 'public, max-age=3600'],
];

const ARTWORK = 'public, max-age=86400';

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
    setHeaders: (res, path) => {
      const match = LIFETIMES.find(([name]) => name.test(path));

      res.setHeader('Cache-Control', match ? match[1] : ARTWORK);
    },
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