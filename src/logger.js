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
    switch (level) {
      case 'debug':
        this.level = LEVELS.DEBUG;
        break;
      case 'warn':
        this.level = LEVELS.WARN;
        break;
      case 'error':
        this.level = LEVELS.ERROR;
        break;
      default:
        this.level = LEVELS.INFO;
        break;
    }

    this.tags = tags || [];
  }

  error(...args) {
    this.log('error', ...args);
  }

  warn(...args) {
    this.log('warn', ...args);
  }

  debug(...args) {
    this.log('debug', ...args);
  }

  info(...args) {
    this.log('info', ...args);
  }

  log(level, ...args) {
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

    let tagComps = [];
    let messageComps = [];

    if (Array.isArray(args[0])) {
      [tagComps, ...messageComps] = args;
    } else {
      [...messageComps] = args;
    }

    const tags = this.tags.concat(tagComps);
    const message = `[${level}] ` +
      (tags.length ? `[${tags.join(', ')}] ` : '') +
      messageComps.join(' ').replace(/^\*\*\s+/, '');

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

module.exports = Logger;
