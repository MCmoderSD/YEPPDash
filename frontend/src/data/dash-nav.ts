import { Params } from '@angular/router';
import { RoleManagementMode } from '../components/role-management-component/role-management.component';
import { isDashHost } from '../services/dash-host';

export interface NavItem {
  label: string;
  icon: string;
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
        description: 'Grant and revoke moderator status.',
        path: `${BASE}/role-management`,
        queryParams: { mode: RoleManagementMode.Moderator },
      },
      {
        label: 'VIPs',
        icon: 'star',
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
        label: 'Members',
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
        icon: 'casino',
        description: 'Spin for a winner, live on an OBS overlay.',
        path: `${BASE}/wheel`,
      },
      {
        label: 'BDSM Test',
        icon: 'psychology',
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