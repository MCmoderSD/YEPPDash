// Numeric on purpose: it round-trips through a router query param (?mode=0 / ?mode=1) as a plain
// string, with no name to spell wrong on either side.
export enum RoleManagementMode {
  Moderator = 0,
  Vip = 1,
}
