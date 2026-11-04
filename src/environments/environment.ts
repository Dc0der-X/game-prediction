// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  /** Connect to local Firebase emulators (see README → Local development). */
  useEmulators: false,
  production: false,
  firebase: {
    projectId: 'prediction-ai-a4dfe',
    appId: '1:953556292443:web:e4be8076388a296b16807e',
    storageBucket: 'prediction-ai-a4dfe.appspot.com',
    apiKey: 'AIzaSyDCCsyXCDMnHp8qbMUkHoypffbudwG0SFI',
    authDomain: 'prediction-ai-a4dfe.firebaseapp.com',
    messagingSenderId: '953556292443',
    measurementId: 'G-83HW25W4QB',
  },
  /**
   * Public payment settings (safe to ship to the browser).
   * Secrets live only in Cloud Functions – see README "Payments".
   */
  payments: {
    /** PayPal REST app client id. Leave empty to hide the PayPal button. */
    paypalClientId: '',
    /** PayPal billing plan id (P-XXXX) for the monthly subscription. */
    paypalPlanId: '',
    /** Crypto checkout (NOWPayments) is handled by the payments worker; set false to hide it. */
    cryptoEnabled: true,
    /**
     * URL of the free Cloudflare Worker in /payments-worker that verifies payments,
     * e.g. 'https://tablewise-payments.<your-subdomain>.workers.dev'. Empty = checkout hidden.
     */
    apiUrl: '',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
