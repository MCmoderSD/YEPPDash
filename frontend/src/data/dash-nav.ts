import { Params } from '@angular/router';
import { RoleManagementMode } from '../components/role-management-component/role-management.component';
import { isDashHost } from '../services/dash-host';

export interface NavItem {
  label: string;
  // A Material Icons ligature, ignored when `mask` is set.
  icon: string;
  // An image drawn as a CSS mask rather than placed as one. The icon font's entries take their
  // colour from the row around them, and a plain <img> could not — it would sit at whatever colour
  // it was drawn in while its neighbours went from grey to the brand colour with the active state.
  // Masking paints the artwork in the row's own colour instead, so a custom icon behaves like the
  // rest. Only the artwork's alpha is used, which is what both of these files carry their shape in.
  mask?: string;
  description: string;
  path: string;
  queryParams?: Params;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

// On the dash subdomain the dashboard is the site root; everywhere else it is mounted under /dash.
// Resolved once here rather than branched at each entry.
const BASE: string = isDashHost() ? '' : '/dash';

export const OVERVIEW_PATH: string = BASE || '/';

// Grouped by what the user is trying to do rather than by which API backs it: everything that
// changes how the channel is run sits under Management, everything about the people in it under
// Community, and the toys that are neither under Entertainment.
//
// The single source for both the sidebar and the cards on the dashboard's landing page, so a
// section added to one cannot go missing from the other.
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'management',
    label: 'Management',
    icon: 'tune',
    items: [
      {
        label: 'Moderators',
        icon: 'shield',
        mask: 'Moderator-Icon.png',
        description: 'Grant and revoke moderator status.',
        path: `${BASE}/role-management`,
        queryParams: { mode: RoleManagementMode.Moderator },
      },
      {
        label: 'VIPs',
        icon: 'star',
        mask: 'VIP-Icon.png',
        description: 'Hand out and take back VIP badges.',
        path: `${BASE}/role-management`,
        queryParams: { mode: RoleManagementMode.Vip },
      },
      {
        label: 'Quotes',
        icon: 'format_quote',
        description: 'Everything your chat has saved for posterity.',
        path: `${BASE}/quotes`,
      },
      {
        label: 'Commands',
        icon: 'terminal',
        description: 'Custom commands and what they answer with.',
        path: `${BASE}/commands`,
      },
    ],
  },
  {
    id: 'community',
    label: 'Community',
    icon: 'diversity_3',
    items: [
      {
        label: 'Follower',
        icon: 'group',
        description: 'Who is around, and what roles they hold.',
        path: `${BASE}/community`,
      },
      {
        label: 'Birthdays',
        icon: 'cake',
        description: 'Follower birthdays, so none goes unnoticed.',
        path: `${BASE}/birthdays`,
      },
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    icon: 'sports_esports',
    items: [
      {
        label: 'Lucky Wheel',
        // The icon font is the classic Material Icons set, which has no prize wheel — `casino`
        // stood in with a pair of dice, which is a different game entirely.
        icon: 'casino',
        mask: 'lucky-wheel.svg',
        description: 'Spin for a winner, live on an OBS overlay.',
        path: `${BASE}/wheel`,
      },
      {
        label: 'BDSM Test',
        icon: 'psychology',
        // 128px rather than the smallest fitting size: the browser scales it down to the icon's
        // actual 20-24px either way, so the larger source only costs a few extra kilobytes and
        // buys back the sharpness a 64px source loses on a high-DPI display.
        mask: 'BDSM-Test-128px.png',
        description: 'Results your chat has shared with the channel.',
        path: `${BASE}/bdsm`,
      },
    ],
  },
];

// Which group a URL belongs to, used to reopen the right one when a route is entered from outside
// the sidebar — a redirect, a bookmark, the browser's back button.
export function groupForUrl(groups: readonly NavGroup[], url: string): string | undefined {
  // Query strings distinguish the two role-management entries from each other but never the group,
  // and comparing them would only make this miss on a stray parameter.
  const path: string = url.split('?')[0];

  return groups.find((group: NavGroup): boolean =>
    group.items.some((item: NavItem): boolean => item.path === path),
  )?.id;
}