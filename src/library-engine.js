'use strict';

const Rx = require('rx-lite');
const asciiTree = require('ascii-tree');

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
      .toArray().map(libraries => libraries
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
        })
      );
  }

  getCategories(platform) {
    const self = this;
    const scrapers = this.awesomeListScrapers[platform];

    return Rx.Observable
      .merge(scrapers.map(scraper => scraper.getCategories()))
      .toArray().map(categories => categories
        .reduce((a, b) => a.concat(b))
        .reduce((categories, category) => {
          const slugs = categories.map(category => category.slug);
          return slugs.indexOf(category.slug) > -1
            ? categories
            : categories.concat(category);
        }, [])
        .sort((a, b) => {
          if (a.title > b.title) {
            return 1;
          }
          if (a.title < b.title) {
            return -1;
          }
          return 0;
        })
      )
      .map(categories => {
        const categoriesTree = self.constructor._categoriesTree(
          [{ title: 'Categories', depth: 1 }]
            .concat(categories.map(category => {
              category.depth = 2;
              return category;
            })
        )).map(category => '*'.repeat(category.depth) + category.title);

        return asciiTree.generate(categoriesTree.join('\r\n'));
      });
  }

  static formattedPlatform(platform) {
    if (platform.toLowerCase() === 'ios') {
      return 'iOS';
    } else if (platform.toLowerCase() === 'android') {
      return 'Android';
    } else {
      return platform.replace(
        /\w\S*/g,
        str => str.charAt(0).toUpperCase() + str.substr(1).toLowerCase()
      );
    }
  }

  static _categoriesTree(categories) {
    return categories
      .reduce((categories, category) => {
        if (category.subcategories) {
          return categories.concat(
            { title: category.title, depth: category.depth },
            this._categoriesTree(category.subcategories.map(subcategory => {
              subcategory.depth = category.depth + 1;
              return subcategory;
            }))
          );
        } else {
          return categories.concat({
            title: category.title,
            depth: category.depth
          });
        }
      }, []);
  }
}

module.exports = LibraryEngine;
