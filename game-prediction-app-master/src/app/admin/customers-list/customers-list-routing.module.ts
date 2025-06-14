import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomersListPage } from './customers-list.page';

const routes: Routes = [
  {
    path: '',
    component: CustomersListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomersListPageRoutingModule {}
