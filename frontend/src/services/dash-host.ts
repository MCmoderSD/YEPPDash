import { environment } from '../environments/environment';

export function isDashHost(): boolean {
  return environment.production
    && typeof window !== 'undefined'
    && window.location.hostname === new URL(environment.frontendBaseUrl).hostname;
}

export function dashboardLink(): string | null {
  return environment.production && !isDashHost() ? environment.frontendBaseUrl : null;
}

export function faqLink(query: Readonly<Record<string, string>> = {}): string | null {
  if (!isDashHost()) return null;

  const search = new URLSearchParams(query);
  const suffix: string = Object.keys(query).length > 0 ? `?${search}` : '';

  return `${environment.marketingBaseUrl}/faq${suffix}`;
}