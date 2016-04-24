'use strict';

require('colors');

const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(level, tags) {
    this.level = (level === undefined || level === null) ? LEVELS.INFO : level;
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

  info(message) {
    if (LEVELS.INFO >= this.level) {
      this._log(message, 'info');
    }
  }

  _log(message, level) {
    if (!message) {
      return;
    }

    if (this.tags.length > 0) {
      message = `[${this.tags.join(',')}] ${message}`;
    }
    message = `${new Date().toISOString()} [${level}] ${message}`;

    switch (level) {
      case 'error':
        console.error(message.red);
        break;
      case 'warn':
        console.error(message.yellow);
        break;
      case 'debug':
        console.log(message.cyan);
        break;
      default:
        console.log(message);
        break;
    }
  }
}

module.exports = {
  Logger: Logger,
  logLevels: LEVELS
};
