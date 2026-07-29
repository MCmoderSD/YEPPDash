import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { Quote } from '../data/quote';

@Service()
export class QuoteService {

  private readonly http: HttpClient = inject(HttpClient);

  // No signal backing this: quote ids shift whenever one is added, moved or deleted, so a
  // remembered list would go stale on every write. Callers reload and hold the result themselves.
  getQuotes(channelId: string): Promise<Quote[]> {
    return firstValueFrom(
      this.http.get<Quote[]>(this.url(channelId), { withCredentials: true }),
    );
  }

  addQuote(channelId: string, quote: string): Promise<Quote> {
    return firstValueFrom(
      this.http.post<Quote>(this.url(channelId), { quote }, { withCredentials: true }),
    );
  }

  updateQuote(channelId: string, id: number, quote: string): Promise<Quote> {
    return firstValueFrom(
      this.http.patch<Quote>(`${this.url(channelId)}/${id}`, { quote }, { withCredentials: true }),
    );
  }

  async deleteQuote(channelId: string, id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.url(channelId)}/${id}`, { withCredentials: true }),
    );
  }

  // Answers with the whole list: moving a quote renumbers every quote between the two positions,
  // so the caller cannot patch its copy from the response of a single entry.
  moveQuote(channelId: string, id: number, position: number): Promise<Quote[]> {
    return firstValueFrom(
      this.http.patch<Quote[]>(
        `${this.url(channelId)}/${id}/position`,
        { position },
        { withCredentials: true },
      ),
    );
  }

  private url(channelId: string): string {
    return `${environment.apiBaseUrl}/quotes/${encodeURIComponent(channelId)}`;
  }
}
