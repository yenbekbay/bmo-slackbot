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
    this.log('error', message);
  }

  warn(message) {
    this.log('warn', message);
  }

  debug(message) {
    this.log('debug', message);
  }

  info(message) {
    this.log('info', message);
  }

  log() {
    const args = Array.prototype.slice.call(arguments);
    if (args.length === 0) {
      return;
    }
    const level = args[0];
    let message = args.slice(1).join(' ');

    if (!message) {
      return;
    }

    switch (level) {
      case 'error':
        if (LEVELS.ERROR < this.level) return;
        break;
      case 'warn':
        if (LEVELS.WARN < this.level) return;
        break;
      case 'debug':
        if (LEVELS.DEBUG < this.level) return;
        break;
      default:
        if (LEVELS.INFO < this.level) return;
        break;
    }

    if (this.tags.length > 0) {
      message = `[${this.tags.join(',')}] ${message}`;
    }
    message = `[${level}] ${message}`;

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
