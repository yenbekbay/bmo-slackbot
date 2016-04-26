'use strict';

const Botkit = require('botkit');
require('dotenv').config();

const Commander = require('./commander');
const levels = require('./logger').logLevels;
const Logger = require('./logger').Logger;
const SlackApi = require('./slack-api');
const WitAi = require('./wit-ai');

const slackToken = process.env.SLACK_TOKEN;
const witToken = process.env.WIT_TOKEN;
const logLevel = process.env.NODE_ENV === 'production'
  ? levels.INFO
  : levels.DEBUG;

const logger = new Logger(levels.INFO);

const controller = Botkit.slackbot({
  logger: new Logger(levels.INFO, ['botkit'])
});
const bot = controller
  .spawn({ token: slackToken })
  .startRTM((err, bot, payload) => {
    if (err) {
      throw new Error(`Error connecting to Slack: ${err}`);
    }

    logger.info('Connected to Slack');
  });
const slackApi = new SlackApi(bot, new Logger(logLevel, ['slack-api']));
const commander = new Commander(bot, slackApi, logger);
const witAi = new WitAi(witToken, slackApi, new Logger(logLevel, ['wit-ai']));

controller.hears(
  '^(?:hi|hello|whatsup|howdy|greetings|privet|salem)(?:\\s+.*)?$',
  ['direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('greet', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.hears(
  '^(ios|android)\\s+lib(?:rarie)?s\\s+list\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('getLibraryCategories', {
      channelId: message.channel,
      userId: message.user,
      platform: message.match[1].toLowerCase()
    })
  );

controller.hears(
  '^(ios|android)\\s+lib(?:rarie)?s(?:\\s+for\\s+|\\s+)(.+)\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('getLibraries', {
      channelId: message.channel,
      userId: message.user,
      platform: message.match[1].toLowerCase(),
      query: message.match[2]
    })
  );

controller.hears(
  '^\\s*trending(?:\\s+repos)?(?:$|(?:\\s+for)?\\s+(.+)\\s*$)',
  ['direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('getTrendingRepos', {
      channelId: message.channel,
      userId: message.user,
      language: message.match[1]
    })
  );

controller.hears(
  '^\\s*<@(U.+)>\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => commander
    .runCommand('vote', {
      channelId: message.channel,
      userId: message.user,
      votedUser: { id: message.match[1] },
      operator: message.match[2]
    })
  );

controller.hears(
  '^\\s*@?([\\w\\.\\-]*)\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => commander
    .runCommand('vote', {
      channelId: message.channel,
      userId: message.user,
      votedUser: { name: message.match[1] },
      operator: message.match[2]
    })
  );

controller.on('reaction_added', (bot, message) => commander
  .runCommand('vote', {
    channelId: message.item.channel,
    userId: message.user,
    votedUser: { id: message.item_user },
    operator: message.reaction
      .replace(/^\+1$/, '++')
      .replace(/^\-1$/, '--')
  })
);

controller.hears(
  '^\\s*score\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { id: message.user }
    })
  );

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?<@(U.+)>\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { id: message.match[1] }
    })
  );

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?@?(?!.*<)(.*)\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { name: message.match[1] }
    })
  );

controller.hears(
  '^\\s*leaderboard\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('leaderboard', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.hears(
  '^\\s*what\\s+time(\\s+is\\s+it)?\\s*\\??\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => commander
    .runCommand('adventureTime', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.on('user_channel_join', (bot, message) => commander
  .runCommand('welcome', {
    channelId: message.channel,
    userId: message.user
  })
);

controller.hears('.*', ['direct_message', 'direct_mention'], (bot, message) => {
  witAi
    .runActions(message)
    .catch(_ => slackApi.sayMessage({
      channel: message.channel,
      text: 'Я тебя не понимаю 😔'
    }))
    .subscribe();
});
