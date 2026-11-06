export const environment = {
  /** Connect to local Firebase emulators (see README → Local development). */
  /** Browser-only demo: no Firebase, sample data in localStorage (npm run build:demo). */
  demoMode: false,
  useEmulators: false,
  production: true,
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
  /**
   * Chat support. Telegram username without @ (e.g. 'TableWiseHelpBot') and WhatsApp number in
   * international format, digits only (e.g. '15551234567'). Empty = that option shows as "not connected".
   */
  support: {
    telegram: '',
    whatsapp: '',
  },
  payments: {
    /** Card / crypto checkout (PayGate.to) is handled by the payments worker; set false to hide it. */
    cryptoEnabled: true,
    /**
     * URL of the free Cloudflare Worker in /payments-worker that verifies payments,
     * e.g. 'https://tablewise-payments.<your-subdomain>.workers.dev'. Empty = checkout hidden.
     */
    apiUrl: '',
  },
};
