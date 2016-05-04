'use strict';

const request = require('request');
const Rx = require('rx-lite');

class Provider {
  constructor() {
    this._request = request.defaults({
      headers: { 'User-Agent': 'bmo-slackbot' },
      gzip: true
    });
    this.loadRetryDelay = 1000;
  }

  requestWithUrl(url) {
    const observable = Rx.Observable
      .fromNodeCallback(this._request)(url)
      .map(([response, body]) => {
        if (response.statusCode === 200) {
          return body;
        } else {
          throw new Error(`Status code ${response.statusCode}`);
        }
      })
      .catch(err => Rx.Observable
        .throw(new Error(`${url} can't be reached: ${err.message}`))
      );

    let errorCount = 0;

    return observable
      .catch(err => {
        errorCount++;

        return Rx.Observable
          .empty()
          .delay(Math.round(Math.pow(errorCount, 1.5)) * this.loadRetryDelay)
          .concat(Rx.Observable.throw(err));
      })
      .retry(3);
  }
}

module.exports = Provider;
