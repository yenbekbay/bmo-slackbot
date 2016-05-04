'use strict';

const leftpad = require('left-pad');
const Rx = require('rx-lite');
const jsonParse = require('safe-json-parse/callback');

const Provider = require('./provider');

const githubUrl = 'https://github.com';
const githubApiUrl = 'https://api.github.com';
const trendingUrl = 'http://app.gitlogs.com/trending';

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

class TrendingEngine {
  constructor({ logger }) {
    this._logger = logger;
    this._provider = new Provider();
  }

  getTrendingRepos(language, limit) {
    const today = new Date();
    const date = [
      today.getUTCFullYear(),
      leftpad(today.getUTCMonth() + 1, 2, 0),
      leftpad(today.getUTCDate() - 1, 2, 0)
    ];

    return this._provider
      .requestWithUrl(`${trendingUrl}?date=${date.join('-')}`)
      .flatMap(body => Rx.Observable.fromNodeCallback(jsonParse)(body))
      .map(results => results
        .slice(0, Math.min(limit || 20, results.length))
        .map(result => {
          let repo = { name: result.repo_name, trend: result.count };

          if (result.repo) {
            repo.description = result.repo.description;
            repo.language = result.repo.language;

            return Rx.Observable.return(repo);
          } else {
            const url = `${githubApiUrl}/repos/${repo.name}?` +
              `client_id=${githubClientId}&` +
              `client_secret=${githubClientSecret}`;

            return this._provider
              .requestWithUrl(url)
              .flatMap(body => Rx.Observable.fromNodeCallback(jsonParse)(body))
              .map(result => {
                repo.description = result.description;
                repo.language = result.language;

                return repo;
              });
          }
        })
      )
      .flatMap(Rx.Observable.merge)
      .toArray()
      .map(repos => {
        if (language) {
          repos = repos
            .filter(repo => (repo.language || '').toLowerCase() === language);
        }

        return repos
          .map(repo => {
            repo.link = `${githubUrl}/${repo.name}`;
            return repo;
          })
          .sort((a, b) => {
            if (a.trend < b.trend) {
              return 1;
            } else if (a.trend > b.trend) {
              return -1;
            } else {
              return 0;
            }
          });
      })
      .do(
        repos => {
          this._logger.info(`Got ${repos.length} trending repos for ` +
            `${language || 'all languages'}`);
        },
        err => {
          this._logger.error('Failed to get trending repos for ' +
            `${language || 'all languages'}: ${err.message}`);
        }
      );
  }
}

module.exports = TrendingEngine;
