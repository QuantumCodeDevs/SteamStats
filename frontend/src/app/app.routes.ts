import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard',
    data: {
      description:
        'Look up a public Steam profile and see library stats, recently played games, and playtime.',
    },
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'library',
    title: 'Library',
    data: {
      description: 'Browse, filter, and sort a Steam library of owned games and playtime.',
    },
    loadComponent: () => import('./pages/library/library').then((m) => m.Library),
  },
  {
    path: 'random',
    title: 'Random Game',
    data: {
      description: 'Pick a random game from the active Steam library.',
    },
    loadComponent: () => import('./pages/random/random-game').then((m) => m.RandomGame),
  },
  {
    path: 'statistics',
    title: 'Statistics',
    data: {
      description: 'Playtime distribution and library statistics for the active Steam profile.',
    },
    loadComponent: () => import('./pages/statistics/statistics').then((m) => m.Statistics),
  },
  {
    path: 'settings',
    title: 'Settings',
    data: {
      description: 'Clear the active Steam profile session stored in this browser.',
    },
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'game-details/:id',
    title: 'Game details',
    data: {
      description: 'Store details, screenshots, and requirements for a Steam game.',
    },
    loadComponent: () => import('./pages/gamedetails/game-details').then((m) => m.GameDetails),
  },
  {
    path: 'privacy',
    title: 'Privacy Policy',
    data: {
      description:
        'How Steam Stats handles Steam identifiers, public profile data, logs, and browser storage, including children’s privacy and your rights.',
    },
    loadComponent: () => import('./pages/privacy/privacy').then((m) => m.Privacy),
  },
  {
    path: 'terms',
    title: 'Terms and Conditions',
    data: {
      description:
        'Terms for using Steam Stats, including age requirements, acceptable use, Steam API usage, and the open-source license.',
    },
    loadComponent: () => import('./pages/terms/terms').then((m) => m.Terms),
  },
  { path: '**', redirectTo: 'dashboard' },
];
