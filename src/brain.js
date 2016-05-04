'use strict';

const { expect } = require('code');
const Rx = require('rx-lite');
const stringify = require('json-stringify-safe');

class Brain {
  constructor({ redisClient, logger }) {
    this._redisClient = redisClient;
    this._logger = logger;
  }

  getUsers() {
    return this._getObjects('user');
  }

  saveUsers(users) {
    return this._saveObjects('user', users);
  }

  getUser(userId) {
    return this._getObject('user', userId);
  }

  getChannels() {
    return this._getObjects('channel');
  }

  saveChannels(channels) {
    return this._saveObjects('channel', channels);
  }

  getChannel(channelId) {
    return this._getObject('channel', channelId);
  }

  getLastVotedUser(channelId) {
    expect(channelId).to.be.a.string();

    return this
      ._runCommand('hget', 'last_voted_users', channelId)
      .flatMap(userId => userId
        ? this.getUser(userId)
        : Rx.Observable.return(null)
      )
      .do(
        userId => {
          this._logger.debug(`Found last voted user for channel ' +
            '${channelId}: ${userId}`);
        },
        err => {
          this._logger
            .error(`Failed to get last voted user for channel ${channelId}: ` +
              err.message);
        }
      );
  }

  setLastVotedUser(channelId, userId) {
    expect(channelId).to.be.a.string();
    expect(userId).to.be.a.string();

    return this
      ._runCommand('hset', 'last_voted_users', channelId, userId)
      .do(
        created => {
          this._logger.debug('Updated last voted user for channel ' +
            `${channelId}: ${userId}`);
        },
        err => {
          this._logger
            .error(`Failed to set last voted user for channel ${channelId}: ` +
              err.message);
        }
      );
  }

  getUserScore(userId) {
    expect(userId).to.be.a.string();

    return this
      ._runCommand('hget', 'user_scores', userId)
      .map(score => score || 0)
      .do(
        score => {
          this._logger.debug(`Found score for user ${userId}: ${score}`);
        },
        err => {
          this._logger.error(`Failed to get score for user ${userId}: ${err}`);
        }
      );
  }

  getUserScores() {
    return this
      ._runCommand('hgetall', 'user_scores')
      .do(
        scores => {
          this._logger.debug(scores
            ? `Found user scores: ${stringify(scores)}`
            : 'Found no user scores'
          );
        },
        err => {
          this._logger.error(`Failed to get user scores: ${err.message}`);
        }
      );
  }

  incrementUserScore(userId, points) {
    expect(userId).to.be.a.string();
    expect(points).to.be.a.number();

    return this
      ._runCommand('hincrby', 'user_scores', userId, points)
      .do(
        score => {
          this._logger.debug(`Incremented score for user ${userId} by ` +
            `${points}: ${score}`);
        },
        err => {
          this._logger.error(`Failed to increment score for user ${userId}: ` +
            err.message);
        }
      );
  }

  _getObjects(key) {
    expect(key).to.exist();

    return this
      ._runCommand('keys', `${key}_*`)
      .flatMap(keys => this._runBatch(keys.map(key => ['hgetall', key])))
      .do(
        objects => {
          this._logger.debug(`Found ${objects.length} ${key}s`);
        },
        err => {
          this._logger.error(`Failed to get ${key}s: ${err.message}`);
        }
      );
  }

  _saveObjects(key, objects) {
    expect(key).to.be.a.string();
    expect(objects).to.be.an.array();
    expect(objects.length).to.be.above(0);

    return this
      ._runBatch(objects
        .map(object => ['hmset', `${key}_${object.id}`, object])
      )
      .do(
        objects => {
          this._logger.debug(`Saved ${objects.length} ${key}s`);
        },
        err => {
          this._logger.error(`Failed to save ${key}s: ${err.message}`);
        }
      );
  }

  _getObject(key, objectId) {
    expect(key).to.be.a.string();
    expect(objectId).to.be.a.string();

    return this
      ._runCommand('hgetall', `${key}_${objectId}`)
      .do(
        object => {
          this._logger.debug(object
            ? `Found ${key} for id ${objectId}: ${stringify(object)}`
            : `Found no ${key} for id ${objectId}`
          );
        },
        err => {
          this._logger.error(`Failed to get ${key} for id ${objectId}: ${err}`);
        }
      );
  }

  _runCommand(command, ...options) {
    return Rx.Observable.fromNodeCallback(
      this._redisClient[command],
      this._redisClient
    )(...options);
  }

  _runBatch(commands) {
    const batch = this._redisClient.batch(commands);
    return Rx.Observable.fromNodeCallback(batch.exec, batch)();
  }
}

module.exports = Brain;
