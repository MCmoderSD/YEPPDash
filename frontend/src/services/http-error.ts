import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;

  const body: unknown = error.error;

  if (typeof body === 'string') return body.trim() || fallback;

  const message: unknown = (body as { message?: unknown } | null)?.message;

  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}