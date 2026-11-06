import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { adminGuard, authGuard, proGuard } from './core/guards';
import { environment } from '../environments/environment';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', data: { title: 'Win smarter. Keep more.', description: 'Signals for every bet at your live table – side, amount and the moment to cash out. Baccarat, Craps, Roulette, Sic Bo. Free for 3 hours.' }, loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule) },
  { path: 'terms', data: { title: 'Terms of Use', description: 'TableWise terms of use, payments and responsible play.' }, loadChildren: () => import('./terms/terms.module').then((m) => m.TermsPageModule) },

  // Open to everyone – practice is the hook.
  { path: 'lobby', data: { title: 'Free practice tables', description: 'Play Roulette, Baccarat, Craps, Dragon Tiger and Sic Bo free with play money and see live signals.' }, loadComponent: () => import('./pages/lobby/lobby.page').then((m) => m.LobbyPage) },
  { path: 'table/:game', data: { title: 'Practice table', description: 'Free play-money casino table with live signals.' }, loadComponent: () => import('./pages/table/table.page').then((m) => m.TablePage) },
  { path: 'live/:game', data: { title: 'Live practice table', description: 'Practise live-dealer Baccarat, Roulette, Craps, Sic Bo and Dragon Tiger with play money: real round timing, dealer, signals and a training coach.' }, loadComponent: () => import('./pages/live/live.page').then((m) => m.LivePage) },
  { path: 'rules', data: { title: 'How TableWise works', description: 'How Neural Signals work: tap what came, bet what the signal shows, cash out on top.' }, loadComponent: () => import('./pages/rules/rules.page').then((m) => m.RulesPage) },

  // Accounts
  { path: 'login', data: { title: 'Log in', description: 'Log in to your TableWise account.', noindex: true }, loadComponent: () => import('./pages/auth/login.page').then((m) => m.LoginPage) },
  { path: 'signup', data: { title: 'Start free – 3 hours', description: 'Create your TableWise account and get 3 hours of full access free. No card needed.' }, loadComponent: () => import('./pages/auth/signup.page').then((m) => m.SignupPage) },
  { path: 'account', data: { title: 'Your account', description: '', noindex: true }, canActivate: [authGuard], loadComponent: () => import('./pages/account/account.page').then((m) => m.AccountPage) },
  { path: 'pro', data: { title: 'Passes and pricing', description: 'Day Pass $20, Monthly $140, Yearly $999. Pay by card or crypto and start instantly. Passes never auto-renew.' }, canActivate: [authGuard], loadComponent: () => import('./pages/pro/pro.page').then((m) => m.ProPage) },

  // Pro (trial or paid)
  { path: 'coach', data: { title: 'Signal Room', description: '', noindex: true }, canActivate: [proGuard], loadComponent: () => import('./pages/coach/coach.page').then((m) => m.CoachPage) },
  { path: 'goal', data: { title: 'My goal', description: '', noindex: true }, canActivate: [authGuard], loadComponent: () => import('./pages/goal/goal.page').then((m) => m.GoalPage) },
  { path: 'history', data: { title: 'Your history', description: '', noindex: true }, canActivate: [proGuard], loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage) },
  { path: 'lab', redirectTo: 'coach' },

  // Admin
  { path: 'admin', data: { title: 'Admin', description: '', noindex: true }, canActivate: [adminGuard], loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage) },

  // Old links from the previous version of the app.
  { path: 'customer-home', redirectTo: 'table/baccarat' },
  { path: 'customer-roulette', redirectTo: 'table/roulette' },
  { path: 'customer-dragon-tiger', redirectTo: 'table/dragon-tiger' },
  { path: 'customer-sicbo', redirectTo: 'table/sicbo' },
  { path: 'customer-lucky-seven', redirectTo: 'lobby' },
  { path: 'customer-profile', redirectTo: 'account' },
  { path: 'admin-home', redirectTo: 'admin' },
  { path: 'admin-profile', redirectTo: 'admin' },
  { path: 'customers-list', redirectTo: 'admin' },
  { path: 'contact-list', redirectTo: 'admin' },
  { path: '**', redirectTo: 'home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, useHash: environment.demoMode })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
