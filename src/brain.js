'use strict';

const Rx = require('rx-lite');

class Brain {
  constructor(redisClient, logger) {
    this.redisClient = redisClient;
  }

  getLastVotedUser(channel) {
    return this
      ._getHashValue('last_voted_users', channel)
      .doOnError(err => this.logger.error(
        `Failed to get last voted user for channel ${channel}: ${err}`
      ));
  }

  setLastVotedUser(channel, username) {
    return this
      ._setHashValue('last_voted_users', channel, username)
      .doOnError(err => this.logger.error(
        `Failed to set last voted user for channel ${channel}: ${err}`
      ));
  }

  getUserScore(username) {
    return this
      ._getHashValue('user_scores', username)
      .map(score => score || 0)
      .doOnError(err => this.logger.error(
        `Failed to get score for user ${username}: ${err}`
      ));
  }

  getUserScores() {
    return Rx.Observable
      .fromNodeCallback(
        this.redisClient.hgetall,
        this.redisClient
      )('user_scores')
      .doOnError(err => this.logger.error(
        `Failed to get user scores: ${err}`
      ));
  }

  incrementUserScore(username, points) {
    return Rx.Observable
      .fromNodeCallback(
        this.redisClient.hincrby,
        this.redisClient
      )('user_scores', username, points)
      .doOnError(err => this.logger.error(
        `Failed to increment score for user ${username}: ${err}`
      ));
  }

  _getHashValue(key, field) {
    return Rx.Observable.fromNodeCallback(
      this.redisClient.hget,
      this.redisClient
    )(key, field);
  }

  _setHashValue(key, field, value) {
    return Rx.Observable.fromNodeCallback(
      this.redisClient.hset,
      this.redisClient
    )(key, field, value);
  }
}

module.exports = Brain;
