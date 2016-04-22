'use strict';

const AwesomeListBaseScraper = require('./awesome-list-base-scraper');

class AwesomeIosScraper extends AwesomeListBaseScraper {
  constructor() {
    super();

    this._url = 'https://github.com/vsouza/awesome-ios';
    this._categoriesListSelector = 'li > a[href="#libraries-and-frameworks"]';
  }

  static _parseLibrary($, libraryNode) {
    const anchorNode = $(libraryNode).find('> a');
    const emojiNode = $(libraryNode).find('> img');
    const title = anchorNode.text();
    let swift = false;
    if (emojiNode.get().length > 0) {
      swift = emojiNode.attr('title') === ':large_orange_diamond:';
    }
    return {
      link: anchorNode.attr('href'),
      title: title + (swift ? ' 🔶' : ''),
      description: $(libraryNode).text().replace(`${title} - `, '').trim(),
      swift: swift
    };
  }
}

module.exports = AwesomeIosScraper;
