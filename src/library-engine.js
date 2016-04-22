'use strict';

const Rx = require('rx-lite');

const AwesomeIosScraper =
  require('./awesome-list-scrapers/awesome-ios-scraper');
const AwesomeSwiftScraper =
  require('./awesome-list-scrapers/awesome-swift-scraper');
const AwesomeAndroidScraper =
  require('./awesome-list-scrapers/awesome-android-scraper');

class LibraryEngine {
  constructor() {
    this.awesomeListScrapers = {
      ios: [
        new AwesomeIosScraper(),
        new AwesomeSwiftScraper()
      ],
      android: [
        new AwesomeAndroidScraper()
      ]
    };
  }

  getLibrariesForQuery(platform, query) {
    const scrapers = this.awesomeListScrapers[platform];

    return Rx.Observable
      .merge(scrapers.map(scraper => scraper.getLibrariesForQuery(query)))
      .toArray().map(libraries => {
        return libraries
          .reduce((a, b) => a.concat(b))
          .reduce((libraries, library) => {
            const links = libraries.map(library => library.link);
            return links.indexOf(library.link) > -1
              ? libraries
              : libraries.concat(library);
          }, [])
          .sort((a, b) => {
            if (a.title > b.title) {
              return 1;
            }
            if (a.title < b.title) {
              return -1;
            }
            return 0;
          });
      });
  }
}

module.exports = LibraryEngine;
