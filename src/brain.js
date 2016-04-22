'use strict';

const Redis = require('redis');
const Rx = require('rx-lite');

class Brain {
  constructor(redisUrl) {
    this.redisClient = Redis.createClient(redisUrl);
  }

  getHashValue(key, field) {
    return Rx.Observable.fromNodeCallback(
      this.redisClient.hget,
      this.redisClient
    )(key, field);
  }

  getLastVotedUser(channel) {
    return this.getHashValue('last_voted_users', channel);
  }

  setLastVotedUser(channel, username) {
    return Rx.Observable.fromNodeCallback(
      this.redisClient.hset,
      this.redisClient
    )('last_voted_users', channel, username);
  }

  getUserScore(username) {
    return this.getHashValue('user_scores', username).map(score => score || 0);
  }

  getUserScores() {
    return Rx.Observable.fromNodeCallback(
      this.redisClient.hgetall,
      this.redisClient
    )('user_scores');
  }

  incrementUserScore(username, points) {
    return Rx.Observable.fromNodeCallback(
      this.redisClient.hincrby,
      this.redisClient
    )('user_scores', username, points);
  }
}

module.exports = Brain;
