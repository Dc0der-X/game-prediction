import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomerHomePage } from './customer-home.page';

const routes: Routes = [
  {
    path: '',
    component: CustomerHomePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomerHomePageRoutingModule {}
