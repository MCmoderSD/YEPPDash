import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { Quote } from '../data/quote';

// Handles both `filename="x.xlsx"` and the RFC 5987 `filename*=UTF-8''x.xlsx` form, which is what
// ASP.NET sends as soon as the name is not plain ASCII.
function filenameOf(header: string | null): string | null {
  if (!header) return null;

  const encoded: RegExpMatchArray | null = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) return decodeURIComponent(encoded[1].trim());

  const plain: RegExpMatchArray | null = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

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

  // Kept as the raw response so the caller can take the filename the server picked out of the
  // Content-Disposition header instead of inventing its own.
  async exportQuotes(channelId: string): Promise<{ blob: Blob; filename: string }> {
    const response: HttpResponse<Blob> = await firstValueFrom(
      this.http.get(`${this.url(channelId)}/export`, {
        withCredentials: true,
        responseType: 'blob',
        observe: 'response',
      }),
    );

    return {
      blob: response.body ?? new Blob(),
      filename: filenameOf(response.headers.get('content-disposition')) ?? `quotes-${channelId}.xlsx`,
    };
  }

  importQuotes(channelId: string, file: File): Promise<Quote[]> {
    const body: FormData = new FormData();
    body.append('file', file, file.name);

    return firstValueFrom(
      this.http.post<Quote[]>(`${this.url(channelId)}/import`, body, { withCredentials: true }),
    );
  }

  private url(channelId: string): string {
    return `${environment.apiBaseUrl}/quotes/${encodeURIComponent(channelId)}`;
  }
}
