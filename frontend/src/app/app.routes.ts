import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'dash',
    loadComponent: () => import('./features/dash/dash').then((m) => m.Dash),
    canActivate: [authGuard],
  },
];
