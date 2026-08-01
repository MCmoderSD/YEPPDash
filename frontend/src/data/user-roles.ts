import { BadgePreset } from './badge';

export interface UserRoles {
  broadcaster: boolean;
  moderator: boolean;
  vip: boolean;
  editor: boolean;
  verified: boolean;
}

export interface RoleBadge {
  preset: BadgePreset | null;
  label: string | null;
}

export function roleBadges(roles: UserRoles): RoleBadge[] {
  const shown: RoleBadge[] = [];

  if (roles.broadcaster) shown.push({ preset: BadgePreset.Broadcaster, label: null });
  if (roles.moderator) shown.push({ preset: BadgePreset.Moderator, label: null });
  if (roles.editor) shown.push({ preset: null, label: 'Editor' });
  if (roles.vip) shown.push({ preset: BadgePreset.Vip, label: null });
  if (roles.verified) shown.push({ preset: BadgePreset.Verified, label: null });

  return shown;
}