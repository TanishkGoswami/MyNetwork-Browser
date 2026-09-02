// Structured Logger
class Logger {
  constructor(namespace = 'App') {
    this.namespace = namespace;
  }

  info(message, ...args) {
    console.log(`%c[${this.namespace}]%c ${message}`, 'color: #1a73e8; font-weight: bold;', 'color: inherit;', ...args);
  }

  warn(message, ...args) {
    console.warn(`[${this.namespace}] ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`[${this.namespace}] ${message}`, ...args);
  }

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${this.namespace}] ${message}`, ...args);
    }
  }
}

function createLogger(namespace) {
  return new Logger(namespace);
}

module.exports = { Logger, createLogger };
