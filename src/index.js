'use strict';

const Botkit = require('botkit');
const Rx = require('rx-lite');
const Wit = require('node-wit').Wit;
const yargsParser = require('yargs-parser');

const Brain = require('./brain');
const levels = require('./logger').logLevels;
const LibraryEngine = require('./library-engine');
const Logger = require('./logger').Logger;
const Speaker = require('./speaker');

const slackToken = process.env.SLACK_TOKEN;
const witToken = process.env.WIT_TOKEN;
const redisUrl = process.env.REDIS_URL;
const logLevel = process.env.NODE_ENV === 'production'
  ? levels.LOG
  : levels.DEBUG;

const brain = new Brain(redisUrl);
const controller = Botkit.slackbot({ debug: false });
const libraryEngine = new LibraryEngine();
const globalLogger = new Logger(logLevel);

const bot = controller
  .spawn({ token: slackToken })
  .startRTM((err, bot, payload) => {
    if (err) {
      throw new Error('Error connecting to Slack: ' + err);
    }

    globalLogger.log('Connected to Slack');
  });
const speaker = new Speaker(bot, globalLogger);

controller.hears(
  '^(ios|android)\\slib(?:rarie)?s\\slist$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    const channel = message.channel;
    const platform = message.match[1].toLowerCase();

    libraryEngine.getCategories(platform)
      .flatMap(categoriesTree => {
        const pretext = 'Library categories for ' +
          LibraryEngine.formattedPlatform(platform) + ':';
        return speaker.sayMessage(channel, {
          text: pretext + '\n```\n' + categoriesTree + '\n```',
          mrkdwn: true
        });
      })
      .catch(err => speaker.sayError(channel, err))
      .subscribe();
  });

controller.hears(
  '^(ios|android)\\slib(?:rarie)?s(?:\\sfor\\s|\\s)(.+)$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    const channel = message.channel;
    const platform = message.match[1].toLowerCase();
    const queryArgs = yargsParser(message.match[2]);
    const query = queryArgs._.join(' ');

    libraryEngine.getLibrariesForQuery(platform, query)
      .flatMap(libraries => {
        let message = {
          text: 'Unfortunately, no libraries were found for this category.'
        };
        if (libraries && libraries.length > 0) {
          if (queryArgs.swift) {
            libraries = libraries.filter(library => library.swift);
          }
          message.text = 'These are some ' +
            LibraryEngine.formattedPlatform(platform) +
            ' libraries I found for ' + query +
            (queryArgs.swift ? ' (Swift only)' : '') + ':';
          message.attachments = libraries.map(library => {
            return {
              fallback: library.title,
              title: library.title,
              title_link: library.link,
              text: library.description
            };
          });
        }

        return speaker.sayMessage(channel, message);
      })
      .catch(err => speaker.sayError(channel, err))
      .subscribe();
  });

controller.hears(
  '^(?:hi|hello|whatsup|howdy|greetings|privet|salem)(?:\\s.*)?$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    Rx.Observable
      .fromNodeCallback(bot.api.users.info)({ user: message.user })
      .flatMap(response => {
        if (!response.user || !response.user.name) {
          return Rx.Observable.empty();
        }

        return speaker.greet(response.user.name, message.channel);
      })
      .subscribeOnError(err => {
        globalLogger.error('Failed to greet a user:', err);
      });
  });

controller.on('user_channel_join', (bot, message) => {
  Rx.Observable
    .fromNodeCallback(bot.api.channels.info)({ channel: message.channel })
    .flatMap(response => {
      if (!response.channel || response.channel.name !== 'intro') {
        return Rx.Observable.empty();
      }

      return Rx.Observable
        .fromNodeCallback(bot.api.users.info)({ user: message.user })
        .flatMap(response => {
          if (!response.user || !response.user.name) {
            return Rx.Observable.empty();
          }

          const questions = [
            'Как тебя зовут?',
            'Чем ты занимаешься и/или на каких языках программирования ты ' +
              'пишешь?',
            'Ссылки на твой блог и/или профиль в Гитхабе'
          ].map(question => '- ' + question).join('\n');
          return speaker.sayMessage(
            message.channel,
            'Добро пожаловать, @' + response.user.name + '! ' +
              'Не мог бы ты вкратце рассказать о себе?\n' + questions
          );
        });
    })
    .subscribeOnError(err => {
      globalLogger.error('Failed to greet a newcomer:', err);
    });
});

function findOrCreateSession(message) {
  let sessionId;
  Object.keys(sessions).forEach(k => {
    if (
      sessions[k].channel === message.channel &&
      sessions[k].user === message.user
    ) {
      sessionId = k;
    }
  });
  if (!sessionId) {
    sessionId = new Date().toISOString();
    sessions[sessionId] = {
      channel: message.channel,
      user: message.user,
      context: {}
    };
  }

  return sessionId;
}

const witLogger = new Logger(logLevel, ['witai']);
const actions = {
  say(sessionId, context, message, cb) {
    const session = sessions[sessionId] || {};
    speaker.sayMessage(session.channel, message).finally(cb).subscribe();
  },
  merge(sessionId, context, entities, message, cb) {
    cb(context);
  },
  error(sessionId, context, err) {
    witLogger.error(err);

    const session = sessions[sessionId] || {};
    speaker.sayError(session.channel, err);
  }
};
const wit = new Wit(witToken, actions, witLogger);

// This will contain all user sessions
// Each session has an entry:
// sessionId -> {
//   channel: messageChannel,
//   user: messageUser,
//   context: sessionState
// }
let sessions = {};

controller.hears('.*', ['direct_message', 'direct_mention'], (bot, message) => {
  const sessionId = findOrCreateSession(message);
  const text = message.match[0];
  const context = sessions[sessionId].context;

  Rx.Observable
    .fromNodeCallback(wit.runActions)(sessionId, text, context)
    .finally(() => {
      delete sessions[sessionId];
    })
    .subscribeOnError(err => witLogger.error('Failed to run actions:', err));
});
