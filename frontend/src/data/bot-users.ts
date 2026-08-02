export const BOT_USER_IDS: readonly string[] = [
  "1138053773", // YEPPBotV2
  "644984959",  // ModersEsel
  "100135110",  // StreamElements
  "105166207",  // Streamlabs
  "19264788",   // Nightbot
  "52268235",   // WizeBot
  "689169246",  // hexe_bot
  "431026547",  // StreamStickers
  "216527497"   // SoundAlerts
];

export function isBotUser(userId: string): boolean {
  return BOT_USER_IDS.includes(userId);
}