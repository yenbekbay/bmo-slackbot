'use strict';

const clark = require('clark');
const Rx = require('rx-lite');
const stringify = require('json-stringify-safe');
const yargsParser = require('yargs-parser');

const Brain = require('./brain');
const LibraryEngine = require('./library-engine');
const levels = require('./logger').logLevels;
const Logger = require('./logger').Logger;
const Redis = require('redis');
const TrendingEngine = require('./trending-engine');

const production = process.env.NODE_ENV === 'production';
const redisPort = production ? process.env.REDIS_PORT : 6379;
const logLevel = production ? levels.INFO : levels.DEBUG;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const greetings = [
  'Hey there!',
  'Greetings, human!',
  'Yo!',
  'Salem!',
  'Privet!'
];
const adventureTimeGifs = [
  'http://i.giphy.com/10HegwKCnl0krS.gif',
  'http://i.giphy.com/CDMz3fckRXXDG.gif',
  'http://i.giphy.com/US2sbVPm6jBK0.gif',
  'http://i.giphy.com/ALCI3eTii7qOk.gif',
  'http://i.giphy.com/f31DK1KpGsyMU.gif',
  'http://i.giphy.com/fHiz7HAUlSaIg.gif'
];

class Commander {
  constructor(config) {
    this._bot = config.bot;
    this._logger = config.logger;
    this._brain = new Brain(
      Redis.createClient({ port: redisPort }),
      new Logger(logLevel, ['redis'])
    );
    this._libraryEngine = new LibraryEngine(
      new Logger(logLevel, ['libraries'])
    );
    this._trendingEngine = new TrendingEngine(
      githubClientId,
      githubClientSecret,
      new Logger(logLevel, ['trending'])
    );

    this._commands = {
      greet: {
        actions: options => {
          const greeting = `@${options.user.name}: ` +
            greetings[Math.floor(Math.random() * greetings.length)];

          return this._bot.sayMessage({
            channel: options.channel.id,
            text: greeting
          });
        },
        description: 'Greeting'
      },
      adventureTime: {
        actions: options => {
          const index = Math.floor(Math.random() * adventureTimeGifs.length);
          const gif = adventureTimeGifs[index];

          return this._bot.sayMessage({
            channel: options.channel.id,
            text: 'Adventure time!',
            attachments: [{
              fallback: 'Adventure time GIF',
              image_url: gif
            }]
          });
        },
        description: 'Sending an Adventure Time GIF'
      },
      welcomeUser: {
        validate: options => options.channel.name !== 'intro',
        actions: options => {
          const questions = [
            'Как тебя зовут?',
            'Чем ты занимаешься и/или на каких языках программирования ты ' +
              'пишешь?',
            'Ссылки на твой блог и/или профиль в Гитхабе'
          ].map(question => `- ${question}`).join('\n');

          return this._bot.sayMessage({
            channel: options.channel.id,
            text: `Добро пожаловать, @${options.user.name}! Не мог бы ты ` +
              `вкратце рассказать о себе?\n${questions}`
          });
        },
        description: 'Welcoming'
      },
      getLibraryCategories: {
        validate: options => !!options.platform,
        actions: options => this._libraryEngine
          .getCategories(options.platform)
          .flatMap(categoriesTree => {
            const formattedPlatform = LibraryEngine
              .formattedPlatform(options.platform);
            const pretext = `Library categories for ${formattedPlatform}:`;

            return this._bot.sayMessage({
              channel: options.channel.id,
              text: `${pretext}\n\`\`\`\n${categoriesTree}\n\`\`\``,
              mrkdwn: true
            });
          }),
        description: 'Getting list of library categories'
      },
      getLibraries: {
        validate: options => !!options.platform && !!options.query,
        actions: options => {
          const queryArgs = yargsParser(options.query);
          const queryText = queryArgs._.join(' ');

          return this._libraryEngine
            .getLibrariesForQuery(options.platform, queryText)
            .flatMap(libraries => {
              let message = {
                channel: options.channel.id,
                text: 'Unfortunately, no libraries were found for ' +
                  `"${queryText}"`
              };

              if (libraries && libraries.length > 0) {
                if (queryArgs.swift) {
                  libraries = libraries.filter(library => library.swift);
                }
                message.text = 'These are some ' +
                  LibraryEngine.formattedPlatform(options.platform) +
                  ` libraries I found for "${queryText}"` +
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

              return this._bot.sayMessage(message);
            });
        },
        description: 'Getting libraries'
      },
      getTrendingRepos: {
        actions: options => {
          if (options.language) {
            options.language = options.language.toLowerCase();
          }

          return this._trendingEngine
            .getTrendingRepos(options.language)
            .flatMap(repos => {
              let message = {
                channel: options.channel.id,
                text: 'I couldn\'t find any trending repos' +
                  (options.language ? ` for ${options.language}` : '')
              };

              if (repos && repos.length > 0) {
                message.text = 'Trending repos for ' +
                  `${options.language || 'all languages'}:`;
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

              return this._bot.sayMessage(message);
            });
        },
        description: 'Getting trending repos'
      },
      vote: {
        validate: options => !!options.votedUser &&
          ['++', '--'].indexOf(options.operator || '') > -1,
        actions: options => {
          let getVotedUser;
          if (options.votedUser.id) {
            getVotedUser = this._getUser(options.votedUser.id);
          } else if (options.votedUser.name) {
            getVotedUser = this._findUser(options.votedUser.name);
          } else {
            getVotedUser = this._brain.getLastVotedUser(options.channel.id);
          }

          return getVotedUser
            .flatMap(votedUser => {
              this._logger.info(votedUser);
              const vote = this.constructor._parseVote({
                votingUser: options.user,
                votedUser: votedUser,
                operator: options.operator
              });

              return this
                ._bot.sayMessage({
                  channel: options.channel.id,
                  text: vote.message
                })
                .flatMap(response => this._updateUserScore({
                  channel: options.channel.id,
                  userId: votedUser.id,
                  points: vote.points
                }))
                .doOnNext(scores => {
                  const direction = options.operator === '++' ? 'up' : 'down';
                  this._logger.info(`User ${options.user.name} ` +
                    `${direction}voted user ${votedUser.name}`);
                });
            });
        },
        description: 'Processing vote'
      },
      userScore: {
        validate: options => !!options.requestedUser &&
          (options.requestedUser.name || options.requestedUser.id),
        actions: options => {
          let getUser;
          if (options.requestedUser.id) {
            getUser = this._getUser(options.requestedUser.id);
          } else if (options.requestedUser.name) {
            getUser = this._findUser(options.requestedUser.name);
          }

          return getUser.flatMap(user => this._brain
            .getUserScore(user.id)
            .flatMap(score => this._bot.sayMessage({
              channel: options.channel.id,
              text: `@${user.name}: your score is: ${score}`
            }))
          );
        },
        description: 'Getting score'
      },
      leaderboard: {
        actions: options => this
          ._getUserScores()
          .flatMap(scores => this._bot.sayMessage({
            channel: options.channel.id,
            text: scores,
            mrkdwn: true
          })),
        description: 'Getting leaderboard'
      }
    };
  }

  runCommand(commandName, options) {
    if (!commandName || !options.channelId || !options.userId) {
      return;
    }

    const command = this._commands[commandName];

    Rx.Observable
      .zip(
        this._getUser(options.userId),
        this._getChannel(options.channelId),
        (user, channel) => {
          return { user: user, channel: channel };
        }
      )
      .flatMap(info => {
        if (!info.user || !info.channel) {
          return Rx.Observable.empty();
        }

        delete options.userId;
        delete options.channelId;

        options.user = info.user;
        options.channel = info.channel;

        return Rx.Observable.return(options);
      })
      .filter(options => {
        if (command.validate && !command.validate(options)) {
          return false;
        }

        return true;
      })
      .doOnNext(options => {
        let message = `${command.description} for user ${options.user.name} `;
        let channelName = options.channel.name;
        if (['direct message', 'private channel'].indexOf(channelName) > -1) {
          message += `in ${channelName}`;
        } else {
          message += `in channel ${channelName}`;
        }

        this._logger.info(message);
      })
      .flatMap(options => command.actions(options))
      .catch(err => {
        this._logger.error(`Failed to process command ${commandName}: ${err}`);
        return this._bot.sayError(options.channelId);
      })
      .subscribe();
  }

  _getUser(userId) {
    if (!userId) {
      return null;
    }

    return this._brain
      .getUser(userId)
      .flatMap(user => {
        if (user) {
          return Rx.Observable.return(user);
        }

        return this._updateUsers()
          .map(users => users.find(user => user.id === userId));
      });
  }

  _findUser(username) {
    if (!username) {
      return null;
    }

    return this._brain
      .getUsers()
      .map(users => users.find(user => user.name === username))
      .flatMap(user => {
        if (user) {
          return Rx.Observable.return(user);
        }

        this._updateUsers()
          .map(users => users.find(user => user.name === username));
      });
  }

  _updateUsers() {
    return this._bot
      .getUsers()
      .map(users => users.map(rawUser => {
        const user = {
          id: rawUser.id,
          name: rawUser.name,
          first_name: rawUser.profile.first_name,
          last_name: rawUser.profile.last_name,
          real_name: rawUser.profile.real_name,
          email: rawUser.profile.email,
          is_admin: rawUser.is_admin
        };

        Object.keys(user).forEach(key => {
          if (!user[key]) {
            delete user[key];
          }
        });

        return user;
      }))
      .flatMap(users => this._brain.saveUsers(users));
  }

  _getChannel(channelId) {
    if (!channelId) {
      return null;
    }

    if (channelId.charAt(0) === 'D') {
      return Rx.Observable.return({
        id: channelId,
        name: 'direct message'
      });
    } else if (channelId.charAt(0) === 'G') {
      return Rx.Observable.return({
        id: channelId,
        name: 'private channel'
      });
    }

    return this._brain
      .getChannel(channelId)
      .flatMap(channel => {
        if (channel) {
          return Rx.Observable.return(channel);
        }

        return this
          ._updateChannels()
          .map(channels => channels.find(channel => channel.id === channelId));
      });
  }

  _updateChannels() {
    return this._bot
      .getChannels()
      .map(channels => channels.map(channel => {
        return {
          id: channel.id,
          name: channel.name
        };
      }))
      .flatMap(channels => this._brain.saveChannels(channels));
  }

  _getUserScores() {
    return Rx.Observable
      .zip(
        this._brain.getUserScores(),
        this._brain.getUsers(),
        (scores, users) => {
          return { scores: scores, users: users };
        }
      )
      .map(results => Object.keys(results.scores || {})
        .map(userId => {
          const user = results.users.find(user => user.id === userId);
          const username = (user || {}).name;

          return {
            username: username ? `@${username}` : 'mystery',
            points: parseInt(results.scores[userId], 10)
          };
        })
        .filter(score => score.points > 0)
      )
      .map(scores => {
        if (!scores || scores.length === 0) {
          return 'No scores yet';
        }

        scores = scores.reduce((scores, score) => {
          if (scores[score.points]) {
            scores[score.points] = scores[score.points].concat(score.username);
          } else {
            scores[score.points] = [score.username];
          }

          return scores;
        }, {});

        let points = Object.keys(scores).sort().reverse();
        points = points.slice(0, Math.min(10, points.length));

        const table = points
          .map((points, i) => scores[points].map((username, j) => {
            const num = `${i + 1}.`;
            return `${j === 0 ? num : ' '.repeat(num.length)} ` +
              `${username}: ${points} point${points > 1 ? 's' : ''}` +
              (i === 0 ? ' 👑' : '');
          }))
          .reduce((a, b) => a.concat(b));

        return `${clark(points)}\n\`\`\`${table.join('\n')}\`\`\``;
      });
  }

  _updateUserScore(scoreInfo) {
    if (!scoreInfo.channel || !scoreInfo.userId) {
      throw new Error(`Invalid score information: ${stringify(scoreInfo)}`);
    }

    if (!scoreInfo.points) {
      return Rx.Observable.empty();
    }

    return this._brain
      .setLastVotedUser(scoreInfo.channel, scoreInfo.userId)
      .flatMap(lastVotedUser => this._brain
        .incrementUserScore(scoreInfo.userId, scoreInfo.points)
      );
  }

  static _parseVote(voteInfo) {
    if (!voteInfo.votingUser && !voteInfo.votedUser) {
      throw new Error(`Invalid vote information: ${stringify(voteInfo)}`);
    } else if (voteInfo.votingUser && !voteInfo.votedUser) {
      return {
        message: 'Please specify the username',
        points: 0
      };
    } else if (voteInfo.votingUser.id === voteInfo.votedUser.id) {
      return {
        message: `@${voteInfo.votingUser.name}: No cheating 😏`,
        points: 0
      };
    }

    switch (voteInfo.operator) {
      case '++':
        return {
          message: `Upvoted @${voteInfo.votedUser.name} 😃`,
          points: 1
        };
      case '--':
        return {
          message: `Downvoted @${voteInfo.votedUser.name} 😔`,
          points: -1
        };
    }
  }
}

module.exports = Commander;
