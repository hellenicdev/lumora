import * as Sentry from '@sentry/node';
import config from './config/index.js';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: config.nodeEnv,

    // Send structured logs to Sentry
    enableLogs: true,
    // Tracing — 10% of transactions by default, override via SENTRY_TRACES_SAMPLE_RATE
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  });
} else if (config.nodeEnv === 'production') {
  console.warn('[sentry] SENTRY_DSN is not set — error reporting is disabled');
}
