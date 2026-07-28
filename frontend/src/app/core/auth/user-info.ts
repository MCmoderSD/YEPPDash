// Mirrors backend/YEPPDash.Api/Contracts/UserInfo.cs (System.Text.Json serializes with its
// default camelCase naming policy).
export interface UserInfo {
  twitchId: string | null;
  login: string | null;
  email: string | null;
}
