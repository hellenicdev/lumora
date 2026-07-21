const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function log(level, message, meta) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
