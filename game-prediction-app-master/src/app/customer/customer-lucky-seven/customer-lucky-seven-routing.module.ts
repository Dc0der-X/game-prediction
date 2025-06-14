import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomerLuckySevenPage } from './customer-lucky-seven.page';

const routes: Routes = [
  {
    path: '',
    component: CustomerLuckySevenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomerLuckySevenPageRoutingModule {}
