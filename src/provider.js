'use strict';

const request = require('request');
const Rx = require('rx-lite');

class Provider {
  constructor() {
    this.request = request.defaults({
      headers: { 'User-Agent': 'bmo-slackbot' },
      gzip: true
    });
    this.loadRetryDelay = 1000;
  }

  requestWithUrl(url) {
    const self = this;

    const observable = Rx.Observable.fromNodeCallback(this.request)(url)
      .map(result => {
        const response = result[0];
        const body = result[1];

        if (response.statusCode === 200) {
          return body;
        } else {
          throw new Error('Status code ' + response.statusCode);
        }
      }).catch(err => {
        return Rx.Observable
          .throw(new Error(url + ' can\'t be reached: ' + err.message));
      });

    let errorCount = 0;
    return observable.catch(err => {
      errorCount++;

      const delay = Math.round(Math.pow(errorCount, 1.5)) *
        self.loadRetryDelay;

      return Rx.Observable.empty().delay(delay)
        .concat(Rx.Observable.throw(err));
    }).retry(3);
  }
}

module.exports = Provider;
