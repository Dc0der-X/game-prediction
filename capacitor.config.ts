import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'game-prediction-app',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
