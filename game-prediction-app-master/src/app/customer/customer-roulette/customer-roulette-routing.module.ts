import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CustomerRoulettePage } from './customer-roulette.page';

const routes: Routes = [
  {
    path: '',
    component: CustomerRoulettePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CustomerRoulettePageRoutingModule {}
