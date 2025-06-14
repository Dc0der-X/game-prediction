import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomerDragonTigerPage } from './customer-dragon-tiger.page';

const routes: Routes = [
  {
    path: '',
    component: CustomerDragonTigerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomerDragonTigerPageRoutingModule {}
