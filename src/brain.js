'use strict';

const Rx = require('rx-lite');
const stringify = require('json-stringify-safe');

class Brain {
  constructor(redisClient, logger) {
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
    return this
      ._runCommand('hget', 'last_voted_users', channelId)
      .flatMap(userId => userId
        ? this.getUser(userId)
        : Rx.Observable.return(null)
      )
      .doOnError(err => this._logger
        .error(`Failed to get last voted user for channel ${channelId}: ${err}`)
      )
      .doOnNext(userId => this._logger
        .debug(`Found last voted user for channel ${channelId}: ${userId}`)
      );
  }

  setLastVotedUser(channelId, userId) {
    return this
      ._runCommand('hset', 'last_voted_users', channelId, userId)
      .doOnError(err => this._logger
        .error(`Failed to set last voted user for channel ${channelId}: ${err}`)
      )
      .doOnNext(created => this._logger
        .debug(`Updated last voted user for channel ${channelId}: ${userId}`)
      );
  }

  getUserScore(userId) {
    return this
      ._runCommand('hget', 'user_scores', userId)
      .map(score => score || 0)
      .doOnError(err => this._logger
        .error(`Failed to get score for user ${userId}: ${err}`)
      )
      .doOnNext(score => this._logger
        .debug(`Found score for user ${userId}: ${score}`)
      );
  }

  getUserScores() {
    return this
      ._runCommand('hgetall', 'user_scores')
      .doOnError(err => this._logger
        .error(`Failed to get user scores: ${err}`)
      )
      .doOnNext(scores => this._logger
        .debug(scores
          ? `Found user scores: ${stringify(scores)}`
          : 'Found no user scores'
        )
      );
  }

  incrementUserScore(userId, points) {
    return this
      ._runCommand('hincrby', 'user_scores', userId, points)
      .doOnError(err => this._logger
        .error(`Failed to increment score for user ${userId}: ${err}`)
      )
      .doOnNext(score => this._logger
        .debug(`Incremented score for user ${userId} by ${points}: ${score}`)
      );
  }

  _getObjects(key) {
    return this
      ._runCommand('keys', `${key}_*`)
      .flatMap(keys => this._runBatch(keys.map(key => ['hgetall', key])))
      .doOnError(err => this._logger.error(`Failed to get ${key}s: ${err}`))
      .doOnNext(objects => this._logger
        .debug(`Found ${objects.length} ${key}s`)
      );
  }

  _saveObjects(key, objects) {
    return this
      ._runBatch(objects
        .map(object => ['hmset', `${key}_${object.id}`, object])
      )
      .doOnError(err => this._logger.error(`Failed to save ${key}s: ${err}`))
      .doOnNext(objects => this._logger
        .debug(`Saved ${objects.length} ${key}s`)
      );
  }

  _getObject(key, objectId) {
    return this
      ._runCommand('hgetall', `${key}_${objectId}`)
      .doOnError(err => this._logger
        .error(`Failed to get ${key} for id ${objectId}: ${err}`)
      )
      .doOnNext(object => this._logger
        .debug(object
          ? `Found ${key} for id ${objectId}: ${stringify(object)}`
          : `Found no ${key} for id ${objectId}`
        )
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
