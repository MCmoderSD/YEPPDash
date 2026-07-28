// Mirrors backend/YEPPDash.Api/Contracts/UserInfo.cs (System.Text.Json serializes with its
// default camelCase naming policy).
//
// Only twitchId is stable. Everything else is re-read from Twitch's /helix/users on every
// /api/auth/me call, so a renamed channel or a new avatar shows up on the next page load.
export interface UserInfo {
  twitchId: string;
  login: string;
  displayName: string;
  email: string | null;
  profileImageUrl: string | null;
}
