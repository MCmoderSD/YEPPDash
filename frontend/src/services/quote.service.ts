import { HttpResponse } from '@angular/common/http';
import { Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Quote } from '../data/quote';
import { ApiService } from './api.service';

function filenameOf(header: string | null): string | null {
  if (!header) return null;

  const encoded: RegExpMatchArray | null = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) return decodeURIComponent(encoded[1].trim());

  const plain: RegExpMatchArray | null = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

@Service()
export class QuoteService extends ApiService {

  constructor() {
    super('quotes');
  }

  getQuotes(channelId: string): Promise<Quote[]> {
    return this.get<Quote[]>(encodeURIComponent(channelId));
  }

  addQuote(channelId: string, quote: string): Promise<Quote> {
    return this.post<Quote>(encodeURIComponent(channelId), { quote });
  }

  updateQuote(channelId: string, id: number, quote: string): Promise<Quote> {
    return this.patch<Quote>(`${encodeURIComponent(channelId)}/${id}`, { quote });
  }

  async deleteQuote(channelId: string, id: number): Promise<void> {
    await this.delete(`${encodeURIComponent(channelId)}/${id}`);
  }

  moveQuote(channelId: string, id: number, position: number): Promise<Quote[]> {
    return this.patch<Quote[]>(`${encodeURIComponent(channelId)}/${id}/position`, { position });
  }

  async exportQuotes(channelId: string): Promise<{ blob: Blob; filename: string }> {
    const response: HttpResponse<Blob> = await firstValueFrom(
      this.http.get(this.url(`${encodeURIComponent(channelId)}/export`), {
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

    return this.post<Quote[]>(`${encodeURIComponent(channelId)}/import`, body);
  }
}