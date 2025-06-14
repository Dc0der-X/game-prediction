import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomerSicboPage } from './customer-sicbo.page';

const routes: Routes = [
  {
    path: '',
    component: CustomerSicboPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomerSicboPageRoutingModule {}
