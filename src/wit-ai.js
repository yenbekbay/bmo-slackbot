'use strict';

const Rx = require('rx-lite');
const Wit = require('node-wit').Wit;

class WitAi {
  constructor(witToken, speaker, logger) {
    // This will contain all user sessions
    // Each session has an entry:
    // sessionId -> {
    //   channel: messageChannel,
    //   user: messageUser,
    //   context: sessionState
    // }
    this.sessions = {};

    this.logger = logger;
    const actions = {
      say(sessionId, context, message, cb) {
        const session = this.sessions[sessionId] || {};
        speaker.sayMessage(session.channel, message).finally(cb).subscribe();
      },
      merge(sessionId, context, entities, message, cb) {
        cb(context);
      },
      error(sessionId, context, err) {
        logger.error(err);

        const session = this.sessions[sessionId] || {};
        speaker.sayError(session.channel, err).subscribe();
      }
    };
    this.wit = new Wit(witToken, actions, logger);
  }

  runActions(message) {
    const sessionId = this._findOrCreateSession(message);
    const text = message.match[0];
    const context = this.sessions[sessionId].context;

    return Rx.Observable
      .fromNodeCallback(this.wit.runActions)(sessionId, text, context)
      .finally(() => {
        delete this.sessions[sessionId];
      })
      .doOnError(err => this.logger.error(`Failed to run wit actions: ${err}`));
  }

  _findOrCreateSession(message) {
    let sessionId;
    Object.keys(this.sessions).forEach(k => {
      if (
        this.sessions[k].channel === message.channel &&
        this.sessions[k].user === message.user
      ) {
        sessionId = k;
      }
    });
    if (!sessionId) {
      sessionId = new Date().toISOString();
      this.sessions[sessionId] = {
        channel: message.channel,
        user: message.user,
        context: {}
      };
    }

    return sessionId;
  }
}

module.exports = WitAi;
