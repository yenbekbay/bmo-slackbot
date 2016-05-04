'use strict';

const Rx = require('rx-lite');
const Wit = require('node-wit').Wit;

const Logger = require('./logger');

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const witToken = process.env.WIT_TOKEN;

class WitAi {
  constructor(bot) {
    this._sessions = {};
    this._bot = bot;
    this._logger = new Logger(logLevel, ['slack-api']);
    const actions = {
      say: (sessionId, context, message, cb) => {
        const session = this._sessions[sessionId] || {};
        this._bot.sayMessage(session.channel, message).finally(cb).subscribe();
      },
      merge: (sessionId, context, entities, message, cb) => {
        cb(context);
      },
      error: (sessionId, context, err) => {
        this._logger.error(err);

        const session = this._sessions[sessionId] || {};
        this._bot.sayError(session.channel, err).subscribe();
      }
    };
    this._wit = new Wit(witToken, actions, this._logger);
  }

  runActions({ text, channelId, userId }) {
    let sessionId = Object.keys(this._sessions).find(key =>
      this._sessions[key].channelId === channelId &&
      this._sessions[key].userId === userId
    );

    if (!sessionId) {
      sessionId = new Date().toISOString();
      this._sessions[sessionId] = {
        channelId,
        userId,
        context: {}
      };
    }

    const context = this._sessions[sessionId].context;

    return Rx.Observable
      .fromNodeCallback(this._wit.runActions)(sessionId, text, context)
      .finally(() => {
        delete this._sessions[sessionId];
      });
  }
}

module.exports = WitAi;
