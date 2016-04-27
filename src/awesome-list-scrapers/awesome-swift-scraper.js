'use strict';

const AwesomeListBaseScraper = require('./awesome-list-base-scraper');

class AwesomeSwiftScraper extends AwesomeListBaseScraper {
  constructor() {
    super();

    this.url = 'https://github.com/matteocrippa/awesome-swift';
    this._categoriesListSelector = 'li > a[href="#libs"]';
  }

  static _parseLibrary($, libraryNode) {
    const anchorNode = $(libraryNode).find('> a');
    const title = anchorNode.text();
    return {
      link: anchorNode.attr('href'),
      title: `${title} 🔶`,
      description: $(libraryNode).text().replace(`${title} - `, '').trim(),
      swift: true
    };
  }
}

module.exports = AwesomeSwiftScraper;
