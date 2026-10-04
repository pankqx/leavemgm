import { Injectable, signal } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';
import { User } from '../models/leave.model';

/**
 * Mock auth service.
 * Backend contract this expects once wired up:
 *   POST /api/auth/login  { email, password } -> { user: User, token: string }
 * Swap the body of login() for an HttpClient.post call and keep the
 * same return shape — nothing else in the app needs to change.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly mockUsers: Record<string, User> = {
    'employee@leaflet.dev': {
      id: 'u-101',
      name: 'Asha Rao',
      email: 'employee@leaflet.dev',
      role: 'employee',
      leaveBalance: 12,
    },
    'manager@leaflet.dev': {
      id: 'u-201',
      name: 'Devika Menon',
      email: 'manager@leaflet.dev',
      role: 'manager',
      leaveBalance: 18,
    },
  };

  currentUser = signal<User | null>(this.restoreSession());

  login(email: string, _password: string): Observable<User> {
    const user = this.mockUsers[email.trim().toLowerCase()];
    if (!user) {
      throw new Error('No account found with that email. Try employee@leaflet.dev or manager@leaflet.dev.');
    }
    return of(user).pipe(
      delay(400),
      tap((u) => {
        this.currentUser.set(u);
        sessionStorage.setItem('leaflet_user', JSON.stringify(u));
      })
    );
  }

  logout(): void {
    this.currentUser.set(null);
    sessionStorage.removeItem('leaflet_user');
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  private restoreSession(): User | null {
    const raw = sessionStorage.getItem('leaflet_user');
    return raw ? (JSON.parse(raw) as User) : null;
  }
}
