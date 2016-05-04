'use strict';

const Botkit = require('botkit');
require('dotenv').config();

const Dispatcher = require('./dispatcher');
const Logger = require('./logger');

const controller = Botkit.slackbot({ logger: new Logger('info', ['botkit']) });
const dispatcher = new Dispatcher(controller);

controller.hears(
  '^(?:hi|hello|whatsup|howdy|greetings|privet|salem)(?:\\s+.*)?$',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('greet', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.hears(
  '^(ios|android)\\s+lib(?:rarie)?s\\s+list\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('getLibraryCategories', {
      channelId: message.channel,
      userId: message.user,
      platform: message.match[1].toLowerCase()
    })
  );

controller.hears(
  '^(ios|android)\\s+lib(?:rarie)?s(?:\\s+for\\s+|\\s+)(.+)\\s*$',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('getLibraries', {
      channelId: message.channel,
      userId: message.user,
      platform: message.match[1].toLowerCase(),
      query: message.match[2]
    })
  );

controller.hears(
  '^\\s*trending(?:\\s+repos)?(?:$|(?:\\s+for)?\\s+(.+)\\s*$)',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('getTrendingRepos', {
      channelId: message.channel,
      userId: message.user,
      language: message.match[1]
    })
  );

controller.hears(
  '^\\s*<@(U.+)>\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => dispatcher
    .runCommand('vote', {
      channelId: message.channel,
      userId: message.user,
      votedUser: { id: message.match[1] },
      operator: message.match[2]
    })
  );

controller.hears(
  '^\\s*@?([\\w\\.\\-]*)\\s*:?\\s*([-+]{2})\\s*$',
  ['ambient'], (bot, message) => dispatcher
    .runCommand('vote', {
      channelId: message.channel,
      userId: message.user,
      votedUser: { name: message.match[1] },
      operator: message.match[2]
    })
  );

controller.on('reaction_added', (bot, message) => dispatcher
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
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { id: message.user }
    })
  );

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?<@(U.+)>\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { id: message.match[1] }
    })
  );

controller.hears(
  '^\\s*score\\s+(?:for\\s+)?@?(?!.*<)(.*)\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('userScore', {
      channelId: message.channel,
      userId: message.user,
      requestedUser: { name: message.match[1] }
    })
  );

controller.hears(
  '^\\s*leaderboard\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('leaderboard', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.hears(
  '^\\s*what\\s+time(\\s+is\\s+it)?\\s*\\??\\s*$',
  ['ambient', 'direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('adventureTime', {
      channelId: message.channel,
      userId: message.user
    })
  );

controller.on('user_channel_join', (bot, message) => dispatcher
  .runCommand('welcome', {
    channelId: message.channel,
    userId: message.user
  })
);

controller.hears(
  '.*',
  ['direct_message', 'direct_mention'], (bot, message) => dispatcher
    .runCommand('witAi', {
      channelId: message.channel,
      userId: message.user,
      text: message.match[0]
    })
);
