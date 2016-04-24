'use strict';

const Rx = require('rx-lite');

class Brain {
  constructor(redisClient, logger) {
    this.redisClient = redisClient;
  }

  getLastVotedUser(channel) {
    return this
      ._runCommand('hget', 'last_voted_users', channel)
      .doOnError(err => this.logger.error(
        `Failed to get last voted user for channel ${channel}: ${err}`
      ));
  }

  setLastVotedUser(channel, username) {
    return this
      ._runCommand('hset', 'last_voted_users', channel, username)
      .doOnError(err => this.logger.error(
        `Failed to set last voted user for channel ${channel}: ${err}`
      ));
  }

  getUserScore(username) {
    return this
      ._runCommand('hget', 'user_scores', username)
      .map(score => score || 0)
      .doOnError(err => this.logger.error(
        `Failed to get score for user ${username}: ${err}`
      ));
  }

  getUserScores() {
    return this
      ._runCommand('hgetall', 'user_scores')
      .doOnError(err => this.logger.error(
        `Failed to get user scores: ${err}`
      ));
  }

  incrementUserScore(username, points) {
    return this
      ._runCommand('hincrby', 'user_scores', username, points)
      .doOnError(err => this.logger.error(
        `Failed to increment score for user ${username}: ${err}`
      ));
  }

  _runCommand() {
    const args = Array.prototype.slice.call(arguments);
    return Rx.Observable.fromNodeCallback(
      this.redisClient[args[0]],
      this.redisClient
    )(...args.slice(1));
  }
}

module.exports = Brain;
