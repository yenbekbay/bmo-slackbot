'use strict';

const AwesomeListBaseScraper = require('./awesome-list-base-scraper');

class AwesomeAndroidScraper extends AwesomeListBaseScraper {
  constructor() {
    super();

    this._url = 'https://github.com/JStumpp/awesome-android';
    this._categoriesListSelector = 'li > a[href="#libraries"]';
  }
}

module.exports = AwesomeAndroidScraper;
