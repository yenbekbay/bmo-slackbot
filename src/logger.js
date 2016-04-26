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

  error() {
    const args = Array.prototype.slice.call(arguments);
    this.log('error', ...args);
  }

  warn() {
    const args = Array.prototype.slice.call(arguments);
    this.log('warn', ...args);
  }

  debug() {
    const args = Array.prototype.slice.call(arguments);
    this.log('debug', ...args);
  }

  info() {
    const args = Array.prototype.slice.call(arguments);
    this.log('info', ...args);
  }

  log() {
    let args = Array.prototype.slice.call(arguments);
    if (args.length === 0) {
      return;
    }

    const level = args[0];
    let tags = this.tags;
    args = args.slice(1);
    if (Array.isArray(args[0])) {
      tags = tags.concat(args[0]);
      args = args.slice(1);
    }

    let message = args.join(' ');
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

    message = message.replace(/^\*\*\s+/, '');
    if (tags.length > 0) {
      message = `[${tags.join(',')}] ${message}`;
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
