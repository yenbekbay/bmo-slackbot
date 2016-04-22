'use strict';

const Botkit = require('botkit');
const Wit = require('node-wit').Wit;

const LibraryEngine = require('./library-engine');
const Logger = require('./logger').Logger;
const levels = require('./logger').logLevels;

const slackToken = process.env.SLACK_TOKEN;
const witToken = process.env.WIT_TOKEN;
const env = process.env.NODE_ENV;

const controller = Botkit.slackbot({ debug: false });
const logger = new Logger(env === 'production' ? levels.LOG : levels.DEBUG);
const libraryEngine = new LibraryEngine();

const bot = controller
  .spawn({ token: slackToken })
  .startRTM((err, bot, payload) => {
    if (err) {
      throw new Error('Error connecting to Slack: ' + err);
    }

    logger.log('Connected to Slack');
  });

// This will contain all user sessions
// Each session has an entry:
// sessionId -> {
//   channel: messageChannel,
//   user: messageUser,
//   context: sessionState
// }
let sessions = {};

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

function firstEntityValue(entities, entity) {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value;
  if (!val) {
    return null;
  }

  return typeof val === 'object' ? val.value : val;
}

function formattedPlatform(platform) {
  if (platform.toLowerCase() === 'ios') {
    return 'iOS';
  } else if (platform.toLowerCase() === 'android') {
    return 'Android';
  } else {
    return platform.replace(
      /\w\S*/g,
      str => str.charAt(0).toUpperCase() + str.substr(1).toLowerCase()
    );
  }
}

const greetings = [
  'Hey there!',
  'Greetings, human!',
  'Yo!',
  'Salem!',
  'Privet!'
];

const actions = {
  say(sessionId, context, message, cb) {
    const session = sessions[sessionId];
    if (session && session.channel) {
      const channel = session.channel;

      let messageObject = {};
      if (!message) {
        messageObject.text = 'Something went wrong. Please try again or ' +
          'contact @yenbekbay';
      } else if (typeof message === 'object') {
        messageObject = message;
      } else {
        messageObject.text = message;
      }
      messageObject.channel = channel;

      bot.say(messageObject, (err, response) => {
        if (err) {
          logger.error('Oops! An error occurred while forwarding the ' +
            'response to channel ' + channel + ':' + err);
        }

        cb();
      });
    } else {
      logger.error('Oops! Couldn\'t find session for id:', sessionId);
      cb();
    }
  },
  merge(sessionId, context, entities, message, cb) {
    const platform = firstEntityValue(entities, 'platform');
    if (platform) {
      context.platform = platform;
    }
    const query = firstEntityValue(entities, 'query');
    if (query) {
      context.query = query;
    }
    const flags = firstEntityValue(entities, 'flags');
    if (flags) {
      context.flags = flags;
    }

    cb(context);
  },
  error(sessionId, context, err) {
    logger.error(err);
    const channel = sessions[sessionId].channel;
    if (channel) {
      bot.say({
        text: 'Something went wrong. Please try again or contact @yenbekbay',
        channel: channel
      });
    }
  },
  ['select-greeting'](sessionId, context, cb) {
    context.greeting = greetings[Math.floor(Math.random() * greetings.length)];
    cb(context);
  },
  ['search-libraries'](sessionId, context, cb) {
    if (!context.platform || !context.query) {
      actions.error(sessionId, context);
      return cb(context);
    }

    if (context.query.toLowerCase() === 'list') {
      return libraryEngine.getCategories(context.platform)
        .subscribe(categoriesTree => {
          const pretext = 'Library categories for ' +
            formattedPlatform(context.platform) + ':';
          actions.say(sessionId, context, {
            text: pretext + '\n```\n' + categoriesTree + '\n```',
            mrkdwn: true
          }, cb);
        }, err => {
          actions.error(sessionId, context, err);
          cb(context);
        });
    }

    libraryEngine.getLibrariesForQuery(context.platform, context.query)
      .subscribe(libraries => {
        let message = {
          text: 'Unfortunately, no libraries were found for this category.'
        };
        if (libraries && libraries.length > 0) {
          if (context.flags) {
            const flags = context.flags
              .trim()
              .split(' ')
              .map(flag => flag.replace('--', '').trim());
            if (flags && flags.indexOf('swift') > -1) {
              libraries = libraries.filter(library => library.swift);
            }
          }
          message.text = 'Here\'s what I found:';
          message.attachments = libraries.map(library => {
            return {
              fallback: library.title,
              title: library.title,
              title_link: library.link,
              text: library.description
            };
          });
        }
        actions.say(sessionId, context, message, cb);
      }, err => {
        actions.error(sessionId, context, err);
        cb(context);
      });
  }
};

const wit = new Wit(witToken, actions, logger);

controller.hears('.*', 'direct_message,direct_mention', (bot, message) => {
  const sessionId = findOrCreateSession(message);

  wit.runActions(
    sessionId,
    message.match[0],
    sessions[sessionId].context,
    (err, context) => {
      if (err) {
        logger.error('Oops! Got an error from Wit:', err);
      } else {
        // Reset the session
        delete sessions[sessionId];
      }
    }
  );
});

controller.on('user_channel_join', (bot, message) => {
  bot.api.channels.info({ channel: message.channel }, (err, response) => {
    if (err) {
      return logger.error('Failed to get channel information:', err);
    }
    if (!response.channel || response.channel.name !== 'intro') {
      return;
    }

    bot.api.users.info({ user: message.user }, (err, response) => {
      if (err) {
        return logger.error('Failed to get user information:', err);
      }
      if (response.user && response.user.name) {
        const questions = [
          'Как тебя зовут?',
          'Чем ты занимаешься и/или на каких языках программирования ты ' +
            'пишешь?',
          'Ссылки на твой блог и/или профиль в Гитхабе'
        ].map(question => '- ' + question).join('\n');
        bot.reply(message, 'Добро пожаловать, @' + response.user.name + '! ' +
          'Не мог бы ты вкратце рассказать о себе?\n' + questions);
      }
    });
  });
});
