import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { SupportComponent } from './shared/support.component';
import { TabbarComponent } from './shared/tabbar.component';
import { environment } from '../environments/environment';
import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideFirestore, getFirestore, initializeFirestore } from '@angular/fire/firestore';

const FIREBASE = [
  provideFirebaseApp(() => initializeApp(environment.firebase)),
  // In emulator mode the dev server proxies the emulators on the app's own address
  // (proxy.emulators.json), so it also works from a phone or a remote preview.
  provideAuth(() => {
    const auth = getAuth();
    if (environment.useEmulators) connectAuthEmulator(auth, location.origin, { disableWarnings: true });
    return auth;
  }),
  provideFirestore(() =>
    environment.useEmulators
      ? initializeFirestore(getApp(), {
          host: location.host,
          ssl: location.protocol === 'https:',
          experimentalForceLongPolling: true,
        })
      : getFirestore()
  ),
];

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot({ mode: 'ios' }),
    AppRoutingModule,
    SupportComponent,
    TabbarComponent,
    // The browser-only demo build runs without Firebase.
    ...(environment.demoMode ? [] : FIREBASE),
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
