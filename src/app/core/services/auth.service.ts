import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/leave.model';

interface AuthResponse {
  user: User;
  token: string;
}

const USER_KEY = 'leaflet_user';
const TOKEN_KEY = 'leaflet_token';

/**
 * Talks to the Node/Express API:
 *   POST /api/auth/login     { email, password }        -> { user, token }
 *   POST /api/auth/register  { name, email, password }  -> { user, token }
 *   GET  /api/auth/me                                   -> User (fresh leave balance)
 *
 * The session lives in sessionStorage, so it ends when the browser tab closes.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/auth`;

  readonly token = signal<string | null>(this.read(TOKEN_KEY));
  readonly currentUser = signal<User | null>(this.restoreUser());

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/login`, { email: email.trim(), password })
      .pipe(tap((res) => this.startSession(res)));
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/register`, { name: name.trim(), email: email.trim(), password })
      .pipe(tap((res) => this.startSession(res)));
  }

  /** Re-reads the signed-in user (e.g. so the leave balance is current after an approval). */
  refresh(): void {
    if (!this.token()) return;
    this.http.get<User>(`${this.base}/me`).subscribe({
      next: (user) => this.setUser(user),
      error: () => {
        /* a 401 is handled by the interceptor; anything else can wait for the next refresh */
      },
    });
  }

  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  isLoggedIn(): boolean {
    return this.token() !== null && this.currentUser() !== null;
  }

  private startSession(res: AuthResponse): void {
    this.token.set(res.token);
    this.setUser(res.user);
    this.write(TOKEN_KEY, res.token);
  }

  private setUser(user: User): void {
    this.currentUser.set(user);
    this.write(USER_KEY, JSON.stringify(user));
  }

  private restoreUser(): User | null {
    const raw = this.read(USER_KEY);
    if (!raw || !this.token()) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private read(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the session just won't survive a reload */
    }
  }
}
