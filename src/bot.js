'use strict';

const { expect } = require('code');
const Rx = require('rx-lite');

const Logger = require('./logger');

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const slackToken = process.env.SLACK_TOKEN;

class Bot {
  constructor(controller) {
    this._logger = new Logger(logLevel, ['slack-api']);
    this._bot = controller
      .spawn({ token: slackToken })
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
      .do(
        users => {
          this._logger.debug(`Got ${(users || []).length} users on the team`);
        },
        err => {
          this._logger.error(`Failed to get users on the team: ${err}`);
        }
      );
  }

  getChannels() {
    return Rx.Observable
      .fromNodeCallback(this._bot.api.channels.list)({})
      .map(response => (response || {}).channels)
      .do(
        channels => {
          this._logger.debug(`Got ${(channels || []).length} channels on ' +
            'the team`);
        },
        err => {
          this._logger.error(`Failed to get channels on the team: ${err}`);
        }
      );
  }

  sayError(channel) {
    return this.sayMessage({
      channel,
      text: 'Something went wrong. Please try again or contact @yenbekbay'
    });
  }

  sayMessage(message) {
    expect(message).to.be.an.object().and.to.include(['text', 'channel']);

    return Rx.Observable
      .fromNodeCallback(this._bot.say)(message)
      .doOnError(err => this._logger
        .error(`Failed to send a message to channel ${message.channel}: ${err}`)
      );
  }
}

module.exports = Bot;
