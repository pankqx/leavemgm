import { Routes } from '@angular/router';
import { authGuard, managerGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'apply',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/apply-leave/apply-leave.component').then((m) => m.ApplyLeaveComponent),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadComponent: () => import('./features/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'manager',
    canActivate: [authGuard, managerGuard],
    loadComponent: () =>
      import('./features/manager/manager-dashboard.component').then((m) => m.ManagerDashboardComponent),
  },
  { path: '**', redirectTo: 'login' },
];
