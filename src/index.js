'use strict';

const Botkit = require('botkit');
const Rx = require('rx-lite');
const yargsParser = require('yargs-parser');
require('dotenv').config();

const Brain = require('./brain');
const levels = require('./logger').logLevels;
const LibraryEngine = require('./library-engine');
const Logger = require('./logger').Logger;
const Redis = require('redis');
const ScoreKeeper = require('./score-keeper');
const Speaker = require('./speaker');
const TrendingEngine = require('./trending-engine');
const WitAi = require('./wit-ai');

const production = process.env.NODE_ENV === 'production';
const slackToken = process.env.SLACK_TOKEN;
const witToken = process.env.WIT_TOKEN;
const redisPort = production ? process.env.REDIS_PORT : 6379;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const logLevel = production ? levels.INFO : levels.DEBUG;

const controller = Botkit.slackbot({
  logger: new Logger(levels.INFO, ['botkit'])
});
const bot = controller
  .spawn({ token: slackToken })
  .startRTM((err, bot, payload) => {
    if (err) {
      throw new Error(`Error connecting to Slack: ${err}`);
    }

    globalLogger.info('Connected to Slack');
  });
const globalLogger = new Logger(logLevel);

const brain = new Brain(
  Redis.createClient({ port: redisPort }),
  new Logger(logLevel, ['redis'])
);
const libraryEngine = new LibraryEngine(new Logger(logLevel, ['libraries']));
const scoreKeeper = new ScoreKeeper(brain);
const trendingEngine = new TrendingEngine(
  githubClientId,
  githubClientSecret,
  new Logger(logLevel, ['trending'])
);
const speaker = new Speaker(bot, globalLogger);
const witAi = new WitAi(witToken, speaker, new Logger(logLevel, ['wit-ai']));

const getChannel = channel => Rx.Observable
  .fromNodeCallback(bot.api.channels.info)({ channel: channel })
  .map(response => ((response || {}).channel || {}).name)
  .doOnError(err => globalLogger.error(
    `Failed to get channel name for ${channel}: ${err}`
  ));
const getUsername = user => Rx.Observable
  .fromNodeCallback(bot.api.users.info)({ user: user })
  .map(response => ((response || {}).user || {}).name)
  .doOnError(err => globalLogger.error(
    `Failed to get username for ${user}: ${err}`
  ));
const processVote = (channel, currentUser, votedUser, operator) => {
  if (!currentUser || !votedUser) {
    return Rx.Observable.empty();
  }

  const vote = ScoreKeeper.parseVote(currentUser, votedUser, operator);
  return speaker
    .sayMessage(channel, vote.message)
    .flatMap(response => scoreKeeper.updateScore(
      channel,
      vote.user,
      vote.points
    ))
    .doOnNext(scores => {
      if (vote.points === 0) {
        return;
      }
      const direction = operator === '++' ? 'up' : 'down';
      globalLogger.info(
        `User ${currentUser} ${direction}voted user ${votedUser}`
      );
    })
    .catch(err => speaker.sayError(channel, err));
};

controller.hears(
  '^(ios|android)\\s+lib(?:rarie)?s\\s+list\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    const channel = message.channel;
    const platform = message.match[1].toLowerCase();

    getUsername(message.user)
      .doOnNext(username => globalLogger.info(
        `Getting list of library categories for user ${username}`
      ))
      .flatMap(username => libraryEngine.getCategories(platform))
      .flatMap(categoriesTree => {
        const formattedPlatform = LibraryEngine.formattedPlatform(platform);
        const pretext = `Library categories for ${formattedPlatform}:`;

        return speaker.sayMessage(channel, {
          text: `${pretext}\n\`\`\`\n${categoriesTree}\n\`\`\``,
          mrkdwn: true
        });
      })
      .catch(err => speaker.sayError(channel, err))
      .subscribe();
  });

controller.hears(
  '^(ios|android)\\s+lib(?:rarie)?s(?:\\s+for\\s+|\\s+)(.+)\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    const channel = message.channel;
    const platform = message.match[1].toLowerCase();
    const queryArgs = yargsParser(message.match[2]);
    const query = queryArgs._.join(' ');

    getUsername(message.user)
      .doOnNext(username => globalLogger.info(
        `Getting libraries for user ${username}`
      ))
      .flatMap(username => libraryEngine.getLibrariesForQuery(platform, query))
      .flatMap(libraries => {
        let message = {
          text: 'Unfortunately, no libraries were found for this category'
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
  '^\\s*trending(?:\\s+repos)?(?:$|(?:\\s+for)?\\s+(.+)\\s*$)',
  ['direct_message', 'direct_mention'], (bot, message) => {
    const channel = message.channel;
    let language = message.match[1];
    if (language) {
      language = language.toLowerCase();
    }

    getUsername(message.user)
      .doOnNext(username => globalLogger.info(
        `Getting trending repos for user ${username}`
      ))
      .flatMap(username => trendingEngine.getTrendingRepos(language))
      .flatMap(repos => {
        let message = {
          text: 'I couldn\'t find any trending repos' +
            (language ? ` for ${language}` : '')
        };
        if (repos && repos.length > 0) {
          message.text = `Trending repos for ${language || 'all languages'}:`;
          message.attachments = repos.map(repo => {
            let attachment = {
              fallback: repo.name,
              title: repo.name,
              title_link: repo.link,
              text: repo.description,
              fields: []
            };
            if (repo.trend) {
              attachment.fields.push({
                title: 'Trend',
                value: `+${repo.trend}`,
                short: true
              });
            }
            if (repo.language) {
              attachment.fields.push({
                title: 'Language',
                value: repo.language,
                short: true
              });
            }

            return attachment;
          });
        }

        return speaker.sayMessage(channel, message);
      })
      .catch(err => speaker.sayError(channel, err))
      .subscribe();
  });

controller.hears(
  '^(?:hi|hello|whatsup|howdy|greetings|privet|salem)(?:\\s+.*)?$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    getUsername(message.user)
      .filter(username => !!username)
      .doOnNext(username => globalLogger.info(`Greeting user ${username}`))
      .flatMap(username => speaker.greet(message.channel, username))
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s*<@(U.+)>\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => {
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
      .flatMap(users => processVote(
        message.channel,
        users.currentUser,
        users.votedUser,
        operator
      ))
      .subscribe();
  });

controller.hears(
  '^\\s*@?([\\w\\.\\-]*)\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => {
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
      .flatMap(users => processVote(
        message.channel,
        users.currentUser,
        users.votedUser,
        operator
      ))
      .subscribe();
  });

controller.on('reaction_added', (bot, message) => {
  const currentUser = message.user;
  const votedUser = message.item_user;
  const reaction = message.reaction;

  if (['+1', '-1'].indexOf(reaction) === -1) {
    return;
  }

  Rx.Observable
    .zip(
      getUsername(currentUser),
      getUsername(votedUser),
      (currentUser, votedUser) => {
        return { currentUser: currentUser, votedUser: votedUser };
      }
    )
    .flatMap(users => processVote(
      message.channel,
      users.currentUser,
      users.votedUser,
      reaction
    ))
    .subscribe();
});

controller.hears(
  '^\\s*score\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => {
    getUsername(message.user)
      .doOnNext(username => globalLogger.info(
        `Getting score for user ${username}`
      ))
      .flatMap(username => brain
        .getUserScore(username)
        .flatMap(score => speaker.sayMessage(
          message.channel,
          `@${username}: your score is: ${score}`
        ))
      )
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?<@(U.+)>\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    const user = message.match[1];

    getUsername(user)
      .doOnNext(username => globalLogger.info(
        `Getting score for user ${username}`
      ))
      .flatMap(username => brain
        .getUserScore(username)
        .flatMap(score => speaker.sayMessage(
          message.channel,
          `@${username}'s score is: ${score}`
        ))
      )
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?@?(?!.*<)(.*)\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    const username = message.match[1];

    globalLogger.info(`Getting score for user ${username}`);
    brain
      .getUserScore(username)
      .flatMap(score => speaker.sayMessage(
        message.channel,
        `@${username}'s score is: ${score}`
      ))
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s*leaderboard\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    getUsername(message.user)
      .doOnNext(username => globalLogger.info(
        `Getting leaderboard for user ${username}`
      ))
      .flatMap(username => scoreKeeper.getUserScores())
      .flatMap(scores => speaker.sayMessage(message.channel, {
        text: scores,
        mrkdwn: true
      }))
      .catch(err => speaker.sayError(message.channel, err))
      .subscribe();
  });

controller.hears(
  '^\\s*what\\s+time(\\s+is\\s+it)?\\s*\\??\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => {
    getUsername(message.user)
      .doOnNext(username => globalLogger.info(
        `Sending an Adventure Time GIF to user ${username}`
      ))
      .flatMap(username => speaker.adventureTime(message.channel))
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
    .doOnNext(result => {
      if (result.user) {
        globalLogger.info(`Welcoming user ${result.user}`);
      }
    })
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
    .subscribe();
});

controller.hears('.*', ['direct_message', 'direct_mention'], (bot, message) => {
  witAi
    .runActions(message)
    .catch(_ => speaker.sayMessage(message.channel, 'Я тебя не понимаю 😔'))
    .subscribe();
});
