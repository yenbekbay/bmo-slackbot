'use strict';

const Rx = require('rx-lite');

class Bot {
  constructor(config) {
    this._logger = config.logger;
    this._bot = config.controller
      .spawn({ token: config.slackToken })
      .startRTM((err, bot, payload) => {
        if (err) {
          throw new Error(`Error connecting to Slack: ${err}`);
        }

        this._logger.info('Connected to Slack');
      });
  }

  getUsers() {
    return Rx.Observable
      .fromNodeCallback(this._bot.api.users.list)({})
      .map(response => (response || {}).members)
      .doOnError(err => this._logger
        .error(`Failed to get users on the team: ${err}`)
      )
      .doOnNext(users => this._logger
        .debug(`Got ${(users || []).length} users on the team`)
      );
  }

  getChannels() {
    return Rx.Observable
      .fromNodeCallback(this._bot.api.channels.list)({})
      .map(response => (response || {}).channels)
      .doOnError(err => this._logger
        .error(`Failed to get channels on the team: ${err}`)
      )
      .doOnNext(channels => this._logger
        .debug(`Got ${(channels || []).length} channels on the team`)
      );
  }

  sayError(channel) {
    return this.sayMessage({
      channel,
      text: 'Something went wrong. Please try again or contact @yenbekbay'
    });
  }

  sayMessage(message) {
    if (!message || !message.text || !message.channel) {
      return Rx.Observable.empty();
    }

    return Rx.Observable
      .fromNodeCallback(this._bot.say)(message)
      .doOnError(err => this._logger
        .error(`Failed to send a message to channel ${message.channel}: ${err}`)
      );
  }
}

module.exports = Bot;
