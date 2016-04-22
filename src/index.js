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
const ScoreKeeper = require('./score-keeper');

const slackToken = process.env.SLACK_TOKEN;
const witToken = process.env.WIT_TOKEN;
const redisUrl = process.env.REDIS_URL;
const logLevel = process.env.NODE_ENV === 'production'
  ? levels.LOG
  : levels.DEBUG;

const brain = new Brain(redisUrl);
const controller = Botkit.slackbot({ debug: false });
const globalLogger = new Logger(logLevel);
const libraryEngine = new LibraryEngine();
const scoreKeeper = new ScoreKeeper(brain);

const bot = controller
  .spawn({ token: slackToken })
  .startRTM((err, bot, payload) => {
    if (err) {
      throw new Error(`Error connecting to Slack: ${err}`);
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
          `${LibraryEngine.formattedPlatform(platform)}:`;
        return speaker.sayMessage(channel, {
          text: `${pretext}\n\`\`\`\n${categoriesTree}\n\`\`\``,
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
            ` libraries I found for "${query}"` +
            `${queryArgs.swift ? ' (Swift only)' : ''}:`;
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
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

function getChannel(channel) {
  return Rx.Observable
    .fromNodeCallback(bot.api.channels.info)({ channel: channel })
    .map(response => response.channel
      ? response.channel.name
      : response.channel
    );
}

function getUsername(user) {
  return Rx.Observable
    .fromNodeCallback(bot.api.users.info)({ user: user })
    .map(response => response.user ? response.user.name : response.user);
}

controller.hears(
  '^\\s*<@(U.+)>\\s*:?\\s*([-+]{2})\\s*$',
  ['direct_message'], (bot, message) => {
    const user = message.match[1];
    const operator = message.match[2];

    Rx.Observable
      .zip(
        getUsername(message.user),
        getUsername(user),
        (currentUser, votedUser) => {
          return { currentUser: currentUser, votedUser: votedUser };
        }
      )
      .map(result => ScoreKeeper.parseVote(
        result.currentUser,
        result.votedUser,
        operator
      ))
      .flatMap(result => speaker
        .sayMessage(message.channel, result.message)
        .flatMap(response => scoreKeeper.updateScore(
          message.channel,
          result.user,
          result.points
        ))
      )
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s*@?([\\w\\.\\-]*)\\s*:?\\s*([-+]{2})\\s*$',
  ['direct_message'], (bot, message) => {
    const username = message.match[1];
    const operator = message.match[2];

    Rx.Observable
      .zip(
        getUsername(message.user),
        !username
          ? brain.getLastVotedUser(message.channel)
          : Rx.Observable.return(username),
        (currentUser, votedUser) => {
          return { currentUser: currentUser, votedUser: votedUser };
        }
      )
      .map(result => ScoreKeeper.parseVote(
        result.currentUser,
        result.votedUser,
        operator
      ))
      .flatMap(result => speaker
        .sayMessage(message.channel, result.message)
        .flatMap(response => scoreKeeper.updateScore(
          message.channel,
          result.user,
          result.points
        ))
      )
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.on('reaction_added', (bot, message) => {
  const currentUser = message.user;
  const votedUser = message.item_user;
  const reaction = message.reaction;

  Rx.Observable
    .zip(
      getUsername(currentUser),
      getUsername(votedUser),
      (currentUser, votedUser) => {
        return { currentUser: currentUser, votedUser: votedUser };
      }
    )
    .map(result => ScoreKeeper.parseVote(
      result.currentUser,
      result.votedUser,
      reaction
    ))
    .flatMap(result => speaker
      .sayMessage(message.item.channel, result.message)
      .flatMap(response => scoreKeeper.updateScore(
        message.channel,
        result.user,
        result.points
      ))
    )
    .catch(err => speaker.sayError(message.channel, err))
    .subscribe();
});

controller.hears(
  '^\\s?score\\s?$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    getUsername(message.user)
      .flatMap(username => brain.getUserScore(username)
        .flatMap(score => speaker.sayMessage(
          message.channel,
          `@${username}: your score is: ${score}`
        ))
      )
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s?leaderboard\\s?$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    scoreKeeper.getUserScores()
      .flatMap(scores => speaker.sayMessage(message.channel, scores))
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s?what\\stime(\\sis\\sit)?\\s?\\??\\s?$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    speaker.adventureTime(message.channel)
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s?score\\s(?:for\\s)?@?(.*)\\s?$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    const username = message.match[1];

    brain.getUserScore(username)
      .flatMap(score => speaker.sayMessage(
        message.channel,
        `@${username}'s score is: ${score}`
      ))
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.on('user_channel_join', (bot, message) => {
  Rx.Observable
    .zip(
      getChannel(message.channel),
      getUsername(message.user),
      (channel, user) => {
        return { channel: channel, user: user };
      }
    )
    .flatMap(result => {
      if (result.channel !== 'intro' || !result.user) {
        return Rx.Observable.empty();
      }

      const questions = [
        'Как тебя зовут?',
        'Чем ты занимаешься и/или на каких языках программирования ты пишешь?',
        'Ссылки на твой блог и/или профиль в Гитхабе'
      ].map(question => `- ${question}`).join('\n');
      return speaker.sayMessage(
        message.channel,
        `Добро пожаловать, @${result.user}! Не мог бы ты вкратце рассказать ` +
          `о себе?\n${questions}`
      );
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
