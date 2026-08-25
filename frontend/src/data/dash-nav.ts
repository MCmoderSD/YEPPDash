import { Params } from '@angular/router';
import { RoleManagementMode } from '../components/role-management-component/role-management.component';
import { isDashHost } from '../services/dash-host';

export interface NavItem {
  label: string;
  icon: string;
  outlined?: boolean;
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

const BASE: string = isDashHost() ? '' : '/dash';

export const OVERVIEW_PATH: string = BASE || '/';

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
      {
        label: 'Raids',
        icon: 'diversity_1',
        description: 'Who raided the channel, with how many, and when.',
        path: `${BASE}/raids`,
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
        mask: 'lucky-wheel.svg',
        description: 'Spin for a winner, live on an OBS overlay.',
        path: `${BASE}/wheel`,
      },
      {
        label: 'Subathon Timer',
        icon: 'timer',
        outlined: true,
        description: 'Count down live on an OBS overlay, driven from chat.',
        path: `${BASE}/timer`,
      },
      {
        label: 'Queue',
        icon: 'format_list_numbered',
        description: 'Who is lined up, in order, driven from chat.',
        path: `${BASE}/queue`,
      },
      {
        label: 'BDSM Test',
        icon: 'psychology',
        mask: 'BDSM-Test-128px.png',
        description: 'Results your chat has shared with the channel.',
        path: `${BASE}/bdsm`,
      },
    ],
  },
];

export function groupForUrl(groups: readonly NavGroup[], url: string): string | undefined {
  const path: string = url.split('?')[0];

  return groups.find((group: NavGroup): boolean =>
    group.items.some((item: NavItem): boolean => item.path === path),
  )?.id;
}