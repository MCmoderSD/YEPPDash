export interface ChannelInformation {
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  broadcasterLanguage: string;
  gameId: string;
  gameName: string;
  title: string;
  delay: number;
  tags: string[];
  contentClassificationLabels: string[];
  isBrandedContent: boolean;
}

// Reading and writing labels are not the same shape: the channel answers with the ids that are on,
// while a change has to name each label and say whether it is on or off.
export interface ContentClassificationLabel {
  id: string;
  isEnabled: boolean;
}

export interface ChannelCategory {
  id: string;
  name: string;
  boxArtUrl: string;
}

// Null means "leave this alone" — the endpoint changes exactly the fields it is sent. Clearing the
// game is therefore an empty string, not null; there is no equivalent for the title, which Twitch
// refuses to store empty.
export interface ChannelUpdate {
  title?: string;
  gameId?: string;
  tags?: string[];
  isBrandedContent?: boolean;
  broadcasterLanguage?: string;
  delay?: number;
  contentClassificationLabels?: ContentClassificationLabel[];
}

export interface CategoryPage {
  items: ChannelCategory[];
  cursor: string | null;
}

export const TITLE_MAX_LENGTH: number = 140;

export const TAG_MAX_COUNT: number = 10;

export const TAG_MAX_LENGTH: number = 25;

export const DELAY_MAX_SECONDS: number = 900;

// The six Twitch documents, with the wording it shows viewers.
export const CONTENT_LABELS: readonly { id: string; label: string; hint: string }[] = [
  { id: 'DebatedSocialIssuesAndPolitics', label: 'Politics and sensitive social issues', hint: 'Debates on politics or sensitive social topics.' },
  { id: 'DrugsIntoxication', label: 'Drugs, intoxication or excessive tobacco use', hint: 'Being intoxicated, or using drugs or tobacco on stream.' },
  { id: 'SexualThemes', label: 'Sexual themes', hint: 'Sexual content, nudity or suggestive material.' },
  { id: 'ViolentGraphic', label: 'Violent and graphic depictions', hint: 'Graphic violence, gore or extreme injury.' },
  { id: 'Gambling', label: 'Gambling', hint: 'Wagering real money or anything that stands in for it.' },
  { id: 'ProfanityVulgarity', label: 'Significant profanity or vulgarity', hint: 'Frequent strong language.' },
];

// Exactly the list Twitch offers, in its order and with its own spelling of each name. Two of them
// are not two-letter codes — zh-hk and asl — which is why the backend checks the shape loosely
// rather than insisting on ISO 639-1.
export const BROADCAST_LANGUAGES: readonly { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ca', name: 'Català' },
  { code: 'da', name: 'Dansk' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'hu', name: 'Magyar' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'no', name: 'Norsk' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português' },
  { code: 'ro', name: 'Română' },
  { code: 'sk', name: 'Slovenčina' },
  { code: 'fi', name: 'Suomi' },
  { code: 'sv', name: 'Svenska' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'cs', name: 'Čeština' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'bg', name: 'Български' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'ar', name: 'العربية' },
  { code: 'ms', name: 'بهاس ملايو' },
  { code: 'hi', name: 'मानक हिन्दी' },
  { code: 'th', name: 'ภาษาไทย' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'zh-hk', name: '粵語' },
  { code: 'ko', name: '한국어' },
  { code: 'asl', name: 'American Sign Language' },
  { code: 'other', name: 'Other' },
];

// Same tags comparison, applied to label ids.
export function sameLabels(one: readonly string[], other: readonly string[]): boolean {
  return sameTags(one, other);
}

// Twitch reports labels it applies itself — MatureGame comes from the category's age rating — and
// those are not in the six that can be set. They have to be kept out of the editing state: a value
// the multi-select has no option for is dropped the moment somebody touches it, which would read as
// an unsaved change that nobody made, and would then be sent as a removal.
export function settableLabels(labels: readonly string[]): string[] {
  return labels.filter((id: string): boolean => CONTENT_LABELS.some((label): boolean => label.id === id));
}


export function delayText(seconds: number): string {
  if (seconds === 0) return 'No delay.';
  if (seconds < 60) return `${seconds} seconds.`;

  const minutes: number = Math.floor(seconds / 60);
  const rest: number = seconds % 60;

  return rest === 0 ? `${minutes} minutes.` : `${minutes} minutes ${rest} seconds.`;
}

// Everything Twitch calls a special character, which is everything that is not a letter or a digit.
// Unicode-aware on purpose: a tag may be written in any script, so "Deutsch" and "日本語" both
// survive while spaces and punctuation do not.
const TAG_INVALID: RegExp = /[^\p{L}\p{N}]/gu;

// Applied while typing rather than checked afterwards, so the rule is felt at the keystroke that
// breaks it instead of explained once the tag is finished.
export function cleanTag(tag: string): string {
  return tag.replace(TAG_INVALID, '');
}

// Twitch still runs tags through AutoMod after all this, so one that passes here can be turned away
// anyway — which is why the failure message names tags as a likely cause rather than pretending
// this is the whole rule.
export function isValidTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= TAG_MAX_LENGTH && cleanTag(tag) === tag;
}

// Order is Twitch's, not the user's, so two lists holding the same tags count as unchanged.
export function sameTags(one: readonly string[], other: readonly string[]): boolean {
  if (one.length !== other.length) return false;

  const sort = (tags: readonly string[]): string[] => [...tags].map((tag: string): string => tag.toLowerCase()).sort();
  const [a, b] = [sort(one), sort(other)];

  return a.every((tag: string, index: number): boolean => tag === b[index]);
}

// What the backend sends with a 403 when the signed-in token is older than a scope this app needs.
export interface ScopeRequired {
  reason: 'missing_scope';
  scope: string;
  message: string;
}

export const EMPTY_CHANNEL: ChannelInformation = {
  broadcasterId: '',
  broadcasterLogin: '',
  broadcasterName: '',
  broadcasterLanguage: '',
  gameId: '',
  gameName: '',
  title: '',
  delay: 0,
  tags: [],
  contentClassificationLabels: [],
  isBrandedContent: false,
};

// Twitch hands out box art as a template with {width} and {height} still in it. Asking for the size
// actually rendered keeps the request from being a full-size cover scaled down in the browser.
export function boxArtUrl(template: string, width: number, height: number): string {
  return template
    .replace('{width}', String(width))
    .replace('{height}', String(height));
}

export function isScopeRequired(error: unknown): error is { status: number; error: ScopeRequired } {
  const response = error as { status?: number; error?: { reason?: unknown } } | null;

  return response?.status === 403 && response.error?.reason === 'missing_scope';
}
