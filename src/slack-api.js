'use strict';

const Rx = require('rx-lite');

class SlackApi {
  constructor(bot, logger) {
    this.bot = bot;
    this.logger = logger;
  }

  getUsers() {
    return Rx.Observable
      .fromNodeCallback(this.bot.api.users.list)({})
      .map(response => (response || {}).members)
      .doOnError(err => this.logger
        .error(`Failed to get users on the team: ${err}`)
      )
      .doOnNext(users => this.logger
        .debug(`Got ${(users || []).length} users on the team`)
      );
  }

  getChannels() {
    return Rx.Observable
      .fromNodeCallback(this.bot.api.channels.list)({})
      .map(response => (response || {}).channels)
      .doOnError(err => this.logger
        .error(`Failed to get channels on the team: ${err}`)
      )
      .doOnNext(channels => this.logger
        .debug(`Got ${(channels || []).length} channels on the team`)
      );
  }

  sayError(channel) {
    return this.sayMessage({
      channel: channel,
      text: 'Something went wrong. Please try again or contact @yenbekbay'
    });
  }

  sayMessage(message) {
    if (!message || !message.text || !message.channel) {
      return Rx.Observable.empty();
    }

    return Rx.Observable
      .fromNodeCallback(this.bot.say)(message)
      .doOnError(err => this.logger
        .error(`Failed to send a message to channel ${message.channel}: ${err}`)
      );
  }
}

module.exports = SlackApi;
