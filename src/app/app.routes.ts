import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./links/links-page') },
  { path: '**', redirectTo: '' },
];
