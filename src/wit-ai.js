'use strict';

const Rx = require('rx-lite');
const Wit = require('node-wit').Wit;

class WitAi {
  constructor(config) {
    // This will contain all user sessions
    // Each session has an entry:
    // sessionId -> {
    //   channel: messageChannel,
    //   user: messageUser,
    //   context: sessionState
    // }
    this._sessions = {};
    this._bot = config.bot;
    this._logger = config.logger;
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
    this._wit = new Wit(config.witToken, actions, this._logger);
  }

  runActions(message) {
    const sessionId = this._findOrCreateSession(message);
    const text = message.match[0];
    const context = this._sessions[sessionId].context;

    return Rx.Observable
      .fromNodeCallback(this._wit.runActions)(sessionId, text, context)
      .finally(() => {
        delete this._sessions[sessionId];
      })
      .doOnError(err => this._logger
        .error(`Failed to run wit actions: ${err}`)
      );
  }

  _findOrCreateSession(message) {
    let sessionId;
    Object.keys(this._sessions).forEach(key => {
      if (
        this._sessions[key].channel === message.channel &&
        this._sessions[key].user === message.user
      ) {
        sessionId = key;
      }
    });
    if (!sessionId) {
      sessionId = new Date().toISOString();
      this._sessions[sessionId] = {
        channel: message.channel,
        user: message.user,
        context: {}
      };
    }

    return sessionId;
  }
}

module.exports = WitAi;
