import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static landing page — SEO/link-preview metadata for shares of dash.yeppbot.com/.dev,
  // zero runtime cost (PLAN.md#frontend-design-angular-22--material).
  { path: '', renderMode: RenderMode.Prerender },
  // Personalized and behind authGuard — cannot be prerendered, and SSR would need to forward
  // the session cookie server-side for no benefit here, so it renders client-side instead.
  { path: 'dash', renderMode: RenderMode.Client },
];
