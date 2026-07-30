import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QuoteService } from './quote.service';
import { environment } from '../environments/environment';
import { Quote } from '../data/quote';

const API = environment.apiBaseUrl;
const CHANNEL = '644984959';

function quote(id: number): Quote {
  return { id, quote: `Quote ${id}`, timestamp: '2026-01-01T00:00:00Z' };
}

describe('QuoteService', () => {
  let service: QuoteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(QuoteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read the quotes of the given channel', async () => {
    const loading = service.getQuotes(CHANNEL);
    http.expectOne(`${API}/quotes/${CHANNEL}`).flush([quote(1), quote(2)]);

    expect(await loading).toHaveLength(2);
  });

  it('should post a new quote and return the one the server assigned', async () => {
    const adding = service.addQuote(CHANNEL, 'Hello');

    const request = http.expectOne(`${API}/quotes/${CHANNEL}`);
    expect([request.request.method, request.request.body]).toEqual(['POST', { quote: 'Hello' }]);
    request.flush(quote(3));

    expect((await adding).id).toBe(3);
  });

  it('should patch an existing quote by its id', async () => {
    const updating = service.updateQuote(CHANNEL, 2, 'Changed');

    const request = http.expectOne(`${API}/quotes/${CHANNEL}/2`);
    expect([request.request.method, request.request.body]).toEqual(['PATCH', { quote: 'Changed' }]);
    request.flush({ ...quote(2), quote: 'Changed' });

    expect((await updating).quote).toBe('Changed');
  });

  it('should delete a quote by its id', async () => {
    const deleting = service.deleteQuote(CHANNEL, 2);

    const request = http.expectOne(`${API}/quotes/${CHANNEL}/2`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(deleting).resolves.toBeUndefined();
  });

  // A move renumbers everything between the two positions, so the whole list comes back rather
  // than just the quote that was asked to move.
  it('should return the renumbered list after a move', async () => {
    const moving = service.moveQuote(CHANNEL, 3, 1);

    const request = http.expectOne(`${API}/quotes/${CHANNEL}/3/position`);
    expect([request.request.method, request.request.body]).toEqual(['PATCH', { position: 1 }]);
    request.flush([quote(1), quote(2), quote(3)]);

    expect(await moving).toHaveLength(3);
  });

  it('should take the export filename from the Content-Disposition header', async () => {
    const exporting = service.exportQuotes(CHANNEL);

    const request = http.expectOne(`${API}/quotes/${CHANNEL}/export`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x']), {
      headers: { 'content-disposition': 'attachment; filename=quotes-644984959-2026-07-29.xlsx' },
    });

    expect((await exporting).filename).toBe('quotes-644984959-2026-07-29.xlsx');
  });

  // ASP.NET switches to the RFC 5987 form as soon as the name is not plain ASCII.
  it('should decode an RFC 5987 export filename', async () => {
    const exporting = service.exportQuotes(CHANNEL);

    http.expectOne(`${API}/quotes/${CHANNEL}/export`).flush(new Blob(['x']), {
      headers: { 'content-disposition': "attachment; filename*=UTF-8''zitate%20%C3%A4%C3%B6%C3%BC.xlsx" },
    });

    expect((await exporting).filename).toBe('zitate äöü.xlsx');
  });

  it('should fall back to a name of its own when the header is missing', async () => {
    const exporting = service.exportQuotes(CHANNEL);
    http.expectOne(`${API}/quotes/${CHANNEL}/export`).flush(new Blob(['x']));

    expect((await exporting).filename).toBe(`quotes-${CHANNEL}.xlsx`);
  });

  it('should upload an import as multipart form data', async () => {
    const file = new File(['x'], 'quotes.xlsx');
    const importing = service.importQuotes(CHANNEL, file);

    const request = http.expectOne(`${API}/quotes/${CHANNEL}/import`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);

    // append() re-wraps the file, so the name is what identifies it rather than the reference.
    const sent = (request.request.body as FormData).get('file') as File;
    expect([sent.name, await sent.text()]).toEqual(['quotes.xlsx', 'x']);
    request.flush([quote(1)]);

    expect(await importing).toHaveLength(1);
  });

  // The id goes into the path, so a channel id that is not plain digits must not break out of it.
  it('should escape the channel id it is handed', async () => {
    const loading = service.getQuotes('a/b');
    http.expectOne(`${API}/quotes/a%2Fb`).flush([]);

    await loading;
  });
});
