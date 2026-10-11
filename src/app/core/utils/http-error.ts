import { HttpErrorResponse } from '@angular/common/http';

/** Turns an API / network failure into a message that is safe to show to the user. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
    const message = (err.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}
