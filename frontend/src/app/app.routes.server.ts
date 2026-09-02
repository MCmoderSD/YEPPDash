import { RenderMode, ServerRoute } from '@angular/ssr';
import { GIVEAWAY_OVERLAY_PATH, TIMER_OVERLAY_PATH, WHEEL_OVERLAY_PATH } from '../data/overlay';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'faq', renderMode: RenderMode.Prerender },
  { path: 'imprint', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },

  { path: WHEEL_OVERLAY_PATH, renderMode: RenderMode.Client },
  { path: TIMER_OVERLAY_PATH, renderMode: RenderMode.Client },
  { path: GIVEAWAY_OVERLAY_PATH, renderMode: RenderMode.Client },

  { path: 'dash', renderMode: RenderMode.Client },
  { path: 'dash/**', renderMode: RenderMode.Client },

  { path: '**', renderMode: RenderMode.Server, status: 404 },
];