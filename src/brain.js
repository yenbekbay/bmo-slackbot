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
}

module.exports = Brain;
