import { environment } from '../environments/environment';

export function isDashHost(): boolean {
  return environment.production
    && typeof window !== 'undefined'
    && window.location.hostname === new URL(environment.frontendBaseUrl).hostname;
}

// Where the FAQ is from wherever this is running: on the dashboard host it belongs to the marketing
// site, a different origin the router cannot reach, and null everywhere else means it is a page of
// this app. Shared rather than restated per component so the navbar and the account menu cannot end
// up pointing at two different FAQs.
export function faqLink(): string | null {
  return isDashHost() ? `${environment.marketingBaseUrl}/faq` : null;
}