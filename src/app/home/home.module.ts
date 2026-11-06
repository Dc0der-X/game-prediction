import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HomePage } from './home.page';
import { NeuralFieldComponent } from '../shared/neural-field.component';
import { GameCardComponent } from '../shared/game-card.component';

import { HomePageRoutingModule } from './home-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule,
    NeuralFieldComponent,
    GameCardComponent,
    HomePageRoutingModule,
  ],
  declarations: [HomePage],
})
export class HomePageModule {}
