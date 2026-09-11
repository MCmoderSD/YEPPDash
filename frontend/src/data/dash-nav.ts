import { Params } from '@angular/router';
import { isDashHost } from '../services/dash-host';
import type { RoleManagementMode } from "../components/role-management-component/role-management.component";

export type NavItemId =
  | 'moderators'
  | 'vips'
  | 'timeouts'
  | 'quotes'
  | 'commands'
  | 'follower'
  | 'birthdays'
  | 'raids'
  | 'queue'
  | 'wheel'
  | 'timer'
  | 'bdsm'
  | 'timeout-reward'
  | 'giveaway';

export interface NavItem {
  id: NavItemId;
  label: string;
  icon: string;
  outlined?: boolean;
  mask?: string;
  description: string;
  path: string;
  queryParams?: Params;
  channelPoints?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const BASE: string = isDashHost() ? '' : '/dash';

export const OVERVIEW_PATH: string = BASE || '/';
export const COMMUNITY_PATH: string = `${BASE}/community`;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'management',
    label: 'Management',
    icon: 'tune',
    items: [
      {
        id: 'moderators',
        label: 'Moderators',
        icon: 'shield',
        mask: 'Moderator-Icon.png',
        description: 'Grant and revoke moderator status.',
        path: `${BASE}/role-management`,
        queryParams: { mode: 'moderator' satisfies `${RoleManagementMode}` },
      },
      {
        id: 'vips',
        label: 'VIPs',
        icon: 'star',
        mask: 'VIP-Icon.png',
        description: 'Hand out and take back VIP badges.',
        path: `${BASE}/role-management`,
        queryParams: { mode: 'vip' satisfies `${RoleManagementMode}` },
      },
      {
        id: 'timeouts',
        label: 'Timeouts & Bans',
        icon: 'gavel',
        description: 'Who is timed out or banned, and until when.',
        path: `${BASE}/timeouts`,
      },
      {
        id: 'quotes',
        label: 'Quotes',
        icon: 'format_quote',
        description: 'Everything your chat has saved for posterity.',
        path: `${BASE}/quotes`,
      },
      {
        id: 'commands',
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
        id: 'follower',
        label: 'Follower',
        icon: 'group',
        description: 'Who is around, and what roles they hold.',
        path: COMMUNITY_PATH,
      },
      {
        id: 'birthdays',
        label: 'Birthdays',
        icon: 'cake',
        description: 'Follower birthdays, so none goes unnoticed.',
        path: `${BASE}/birthdays`,
      },
      {
        id: 'raids',
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
        id: 'queue',
        label: 'Queue',
        icon: 'format_list_numbered',
        description: 'Who is lined up, in order, driven from chat.',
        path: `${BASE}/queue`,
      },
      {
        id: 'wheel',
        label: 'Lucky Wheel',
        icon: 'casino',
        mask: 'lucky-wheel.svg',
        description: 'Spin for a winner, live on an OBS overlay.',
        path: `${BASE}/wheel`,
      },
      {
        id: 'timer',
        label: 'Subathon Timer',
        icon: 'timer',
        outlined: true,
        description: 'Count down live on an OBS overlay, driven from chat.',
        path: `${BASE}/timer`,
      },
      {
        id: 'bdsm',
        label: 'BDSM Test',
        icon: 'psychology',
        mask: 'BDSM-Test-128px.png',
        description: 'Results your chat has shared with the channel.',
        path: `${BASE}/bdsm`,
      },
    ],
  },
  {
    id: 'rewards',
    label: 'Rewards',
    icon: 'redeem',
    items: [
      {
        id: 'timeout-reward',
        label: 'Timeout Reward',
        icon: 'gavel',
        description: 'Let channel points buy a timeout, on your terms.',
        path: `${BASE}/timeout-reward`,
        channelPoints: true,
      },
      {
        id: 'giveaway',
        label: 'Giveaways',
        icon: 'celebration',
        description: 'Channel point giveaways, drawn on a weighted wheel, live on stream.',
        path: `${BASE}/giveaway`,
        channelPoints: true,
      },
    ],
  },
];

export function navGroupsFor(channelPoints: boolean): readonly NavGroup[] {
  if (channelPoints) return NAV_GROUPS;

  return NAV_GROUPS
    .map((group: NavGroup): NavGroup => ({
      ...group,
      items: group.items.filter((item: NavItem): boolean => item.channelPoints !== true),
    }))
    .filter((group: NavGroup): boolean => group.items.length > 0);
}

export function groupForUrl(groups: readonly NavGroup[], url: string): string | undefined {
  const path: string = url.split('?')[0];

  return groups.find((group: NavGroup): boolean =>
    group.items.some((item: NavItem): boolean => item.path === path),
  )?.id;
}
export function itemForUrl(groups: readonly NavGroup[], url: string): NavItem | undefined {
  const [path, query] = url.split('?');

  const candidates: NavItem[] = groups
    .flatMap((group: NavGroup): NavItem[] => group.items)
    .filter((item: NavItem): boolean => item.path === path);

  if (candidates.length < 2) return candidates[0];

  const params = new URLSearchParams(query ?? '');

  return candidates.find((item: NavItem): boolean =>
    Object.entries(item.queryParams ?? {})
      .every(([key, value]: [string, unknown]): boolean => params.get(key) === String(value)),
  ) ?? candidates[0];
}