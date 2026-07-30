import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export abstract class ApiService {

  protected readonly http: HttpClient = inject(HttpClient);

  protected constructor(private readonly route: string) { }

  protected get<T>(path: string = '', params?: HttpParams): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.url(path), { params, withCredentials: true }));
  }

  protected post<T = void>(path: string, body: unknown = null): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body, { withCredentials: true }));
  }

  protected patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(this.url(path), body, { withCredentials: true }));
  }

  protected delete<T = void>(path: string = ''): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.url(path), { withCredentials: true }));
  }

  protected url(path: string = ''): string {
    return path
      ? `${environment.apiBaseUrl}/${this.route}/${path}`
      : `${environment.apiBaseUrl}/${this.route}`;
  }
}
