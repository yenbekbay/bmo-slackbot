'use strict';

const colors = require('colors');

const LEVELS = {
  DEBUG: 0,
  LOG: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(level, tags) {
    this.level = (level === undefined || level === null) ? LEVELS.LOG : level;
    this.tags = tags || [];
  }

  error(message) {
    if (LEVELS.ERROR >= this.level) {
      this._log(message, 'error');
    }
  }

  warn(message) {
    if (LEVELS.WARN >= this.level) {
      this._log(message, 'warn');
    }
  }

  debug(message) {
    if (LEVELS.DEBUG >= this.level) {
      this._log(message, 'debug');
    }
  }

  log(message) {
    if (LEVELS.LOG >= this.level) {
      this._log(message);
    }
  }

  _log(message, level) {
    if (!message) {
      return;
    }

    if (this.winston && this.tags.length > 0) {
      message = `[${this.tags.join(',')}] ${message}`;
    }

    switch (level) {
      case 'error':
        if (this.winston) {
          this.winston.error(message);
        } else {
          console.error(colors.red('[Error: %s]'), message);
        }
        break;
      case 'warn':
        if (this.winston) {
          this.winston.warn(message);
        } else {
          console.error(colors.yellow('[Warning: %s]'), message);
        }
        break;
      case 'debug':
        if (this.winston) {
          this.winston.debug(message);
        } else {
          console.log(colors.cyan('[Debug: %s]'), message);
        }
        break;
      default:
        if (this.winston) {
          this.winston.info(message);
        } else {
          console.log(message);
        }
        break;
    }
  }
}

module.exports = {
  Logger: Logger,
  logLevels: LEVELS
};
