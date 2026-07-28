// Mirrors backend/YEPPDash.Api/Data/ChatColorResponse.cs, which relays Twitch's
// Get User Chat Color (https://dev.twitch.tv/docs/api/reference/#get-user-chat-color).
// color is null for users who never picked one — Twitch gives them a random colour per
// channel, which is not something the API can report.
export interface ChatColor {
  id: string;
  color: string | null;
}
