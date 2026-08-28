export interface ChannelInformation {
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  broadcasterLanguage: string;
  gameId: string;
  gameName: string;
  boxArtUrl: string;
  title: string;
  delay: number;
  tags: string[];
  contentClassificationLabels: string[];
  isBrandedContent: boolean;
}

export interface ContentClassificationLabel {
  id: string;
  isEnabled: boolean;
}

export interface ChannelCategory {
  id: string;
  name: string;
  boxArtUrl: string;
}

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

export const CONTENT_LABELS: readonly { id: string; label: string; hint: string }[] = [
  { id: 'DebatedSocialIssuesAndPolitics', label: 'Politics and sensitive social issues', hint: 'Debates on politics or sensitive social topics.' },
  { id: 'DrugsIntoxication', label: 'Drugs, intoxication or excessive tobacco use', hint: 'Being intoxicated, or using drugs or tobacco on stream.' },
  { id: 'SexualThemes', label: 'Sexual themes', hint: 'Sexual content, nudity or suggestive material.' },
  { id: 'ViolentGraphic', label: 'Violent and graphic depictions', hint: 'Graphic violence, gore or extreme injury.' },
  { id: 'Gambling', label: 'Gambling', hint: 'Wagering real money or anything that stands in for it.' },
  { id: 'ProfanityVulgarity', label: 'Significant profanity or vulgarity', hint: 'Frequent strong language.' },
];

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

export function sameLabels(one: readonly string[], other: readonly string[]): boolean {
  return sameTags(one, other);
}

export function settableLabels(labels: readonly string[]): string[] {
  return labels.filter((id: string): boolean => CONTENT_LABELS.some((label: typeof CONTENT_LABELS[number]): boolean => label.id === id));
}


export function delayText(seconds: number): string {
  if (seconds === 0) return 'No delay.';
  if (seconds < 60) return `${seconds} seconds.`;

  const minutes: number = Math.floor(seconds / 60);
  const rest: number = seconds % 60;

  return rest === 0 ? `${minutes} minutes.` : `${minutes} minutes ${rest} seconds.`;
}

const TAG_INVALID: RegExp = /[^\p{L}\p{N}]/gu;

export function cleanTag(tag: string): string {
  return tag.replace(TAG_INVALID, '');
}

export function isValidTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= TAG_MAX_LENGTH && cleanTag(tag) === tag;
}

export function sameTags(one: readonly string[], other: readonly string[]): boolean {
  if (one.length !== other.length) return false;

  const sort: (tags: readonly string[]) => string[] = (tags: readonly string[]): string[] => [...tags].map((tag: string): string => tag.toLowerCase()).sort();
  const [a, b] = [sort(one), sort(other)];

  return a.every((tag: string, index: number): boolean => tag === b[index]);
}

export const EMPTY_CHANNEL: ChannelInformation = {
  broadcasterId: '',
  broadcasterLogin: '',
  broadcasterName: '',
  broadcasterLanguage: '',
  gameId: '',
  gameName: '',
  boxArtUrl: '',
  title: '',
  delay: 0,
  tags: [],
  contentClassificationLabels: [],
  isBrandedContent: false,
};

export function boxArtUrl(template: string): string {
  return template.replace(/-?\{width}x\{height}/, '');
}