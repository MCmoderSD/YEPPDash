import { environment } from '../environments/environment';

export function isDashHost(): boolean {
  return environment.production
    && typeof window !== 'undefined'
    && window.location.hostname === new URL(environment.frontendBaseUrl).hostname;
}

export function faqLink(): string | null {
  return isDashHost() ? `${environment.marketingBaseUrl}/faq` : null;
}