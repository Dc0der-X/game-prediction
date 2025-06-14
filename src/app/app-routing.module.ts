import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'customer-home',
    loadChildren: () =>
      import('./customer/customer-home/customer-home.module').then(
        (m) => m.CustomerHomePageModule
      ),
  },
  {
    path: 'customer-profile',
    loadChildren: () =>
      import('./customer/customer-profile/customer-profile.module').then(
        (m) => m.CustomerProfilePageModule
      ),
  },
  {
    path: 'admin-profile',
    loadChildren: () =>
      import('./admin/admin-profile/admin-profile.module').then(
        (m) => m.AdminProfilePageModule
      ),
  },
  {
    path: 'admin-home',
    loadChildren: () =>
      import('./admin/admin-home/admin-home.module').then(
        (m) => m.AdminHomePageModule
      ),
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'customers-list',
    loadChildren: () =>
      import('./admin/customers-list/customers-list.module').then(
        (m) => m.CustomersListPageModule
      ),
  },
  {
    path: 'terms',
    loadChildren: () =>
      import('./terms/terms.module').then((m) => m.TermsPageModule),
  },
  {
    path: 'customer-roulette',
    loadChildren: () =>
      import('./customer/customer-roulette/customer-roulette.module').then(
        (m) => m.CustomerRoulettePageModule
      ),
  },
  {
    path: 'customer-dragon-tiger',
    loadChildren: () =>
      import(
        './customer/customer-dragon-tiger/customer-dragon-tiger.module'
      ).then((m) => m.CustomerDragonTigerPageModule),
  },
  {
    path: 'customer-sicbo',
    loadChildren: () =>
      import('./customer/customer-sicbo/customer-sicbo.module').then(
        (m) => m.CustomerSicboPageModule
      ),
  },
  {
    path: 'contact-list',
    loadChildren: () =>
      import('./admin/contact-list/contact-list.module').then(
        (m) => m.ContactListPageModule
      ),
  },
  {
    path: 'customer-lucky-seven',
    loadChildren: () => import('./customer/customer-lucky-seven/customer-lucky-seven.module').then( m => m.CustomerLuckySevenPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
