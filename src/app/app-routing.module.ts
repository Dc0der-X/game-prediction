import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { adminGuard, authGuard, proGuard } from './core/guards';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule) },
  { path: 'terms', loadChildren: () => import('./terms/terms.module').then((m) => m.TermsPageModule) },

  // Open to everyone – practice is the hook.
  { path: 'lobby', loadComponent: () => import('./pages/lobby/lobby.page').then((m) => m.LobbyPage) },
  { path: 'table/:game', loadComponent: () => import('./pages/table/table.page').then((m) => m.TablePage) },
  { path: 'rules', loadComponent: () => import('./pages/rules/rules.page').then((m) => m.RulesPage) },

  // Accounts
  { path: 'login', loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage) },
  { path: 'signup', loadComponent: () => import('./pages/auth/signup.page').then((m) => m.SignupPage) },
  { path: 'account', canActivate: [authGuard], loadComponent: () => import('./pages/account/account.page').then((m) => m.AccountPage) },
  { path: 'pro', canActivate: [authGuard], loadComponent: () => import('./pages/pro/pro.page').then((m) => m.ProPage) },

  // Pro (trial or paid)
  { path: 'coach', canActivate: [proGuard], loadComponent: () => import('./pages/coach/coach.page').then((m) => m.CoachPage) },
  { path: 'history', canActivate: [proGuard], loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage) },
  { path: 'lab', canActivate: [proGuard], loadComponent: () => import('./pages/lab/lab.page').then((m) => m.LabPage) },

  // Admin
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage) },

  // Old links from the previous version of the app.
  { path: 'customer-home', redirectTo: 'table/baccarat' },
  { path: 'customer-roulette', redirectTo: 'table/roulette' },
  { path: 'customer-dragon-tiger', redirectTo: 'table/dragon-tiger' },
  { path: 'customer-sicbo', redirectTo: 'table/sicbo' },
  { path: 'customer-lucky-seven', redirectTo: 'table/lucky7' },
  { path: 'customer-profile', redirectTo: 'account' },
  { path: 'admin-home', redirectTo: 'admin' },
  { path: 'admin-profile', redirectTo: 'admin' },
  { path: 'customers-list', redirectTo: 'admin' },
  { path: 'contact-list', redirectTo: 'admin' },
  { path: '**', redirectTo: 'home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
