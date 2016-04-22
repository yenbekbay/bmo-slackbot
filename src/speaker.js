'use strict';

const Rx = require('rx-lite');

const greetings = [
  'Hey there!',
  'Greetings, human!',
  'Yo!',
  'Salem!',
  'Privet!'
];

class Speaker {
  constructor(bot, logger) {
    this.bot = bot;
    this.logger = logger;
  }

  greet(username, channel) {
    const greeting = '@' + username + ': ' +
      greetings[Math.floor(Math.random() * greetings.length)];
    return this.sayMessage(channel, greeting);
  }

  sayError(channel, err) {
    return Rx.Observable
      .fromNodeCallback(this.bot.say)({
        text: 'Something went wrong. Please try again or contact @yenbekbay',
        channel: channel
      })
      .doOnError(err => this.logger.error(
        'Failed to forward the response to channel ' + channel + ':' + err)
      );
  }

  sayMessage(channel, message) {
    let messageObject = {};
    if (!message || !channel) {
      messageObject.text = 'Something went wrong. Please try again or ' +
        'contact @yenbekbay';
    } else if (typeof message === 'object') {
      messageObject = message;
    } else {
      messageObject.text = message;
    }
    messageObject.channel = channel;

    return Rx.Observable
      .fromNodeCallback(this.bot.say)(messageObject)
      .doOnError(err => this.logger.error(
        'Failed to forward the response to channel ' + channel + ':' + err)
      );
  }
}

module.exports = Speaker;
