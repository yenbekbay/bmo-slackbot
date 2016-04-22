'use strict';

const cheerio = require('cheerio');
const nn = require('nearest-neighbor');
const Rx = require('rx-lite');

const Provider = require('../provider');

class AwesomeListBaseScraper {
  constructor() {
    this.provider = new Provider();
  }

  getLibrariesForQuery(query) {
    const self = this;

    return this.provider
      .requestWithUrl(this._url)
      .flatMap(body => {
        const $ = cheerio.load(body);

        return self.constructor
          ._findCategory(query, self._parseCategories($))
          .map(category => !category ? [] : self._parseLibraries($, category));
      });
  }

  getCategories() {
    const self = this;

    return this.provider
      .requestWithUrl(this._url)
      .map(body => self._parseCategories(cheerio.load(body)));
  }

  _parseCategories($) {
    const categoriesListNode = $(this._categoriesListSelector).next('ul');
    return this.constructor._categoriesForList($, categoriesListNode);
  }

  _parseLibraries($, category) {
    const librariesListNode = $(`#user-content-${category.slug}`).parent()
      .nextAll('ul').first();
    return this.constructor._librariesForList($, librariesListNode);
  }

  static _categoriesForList($, listNode) {
    return listNode
      .children()
      .map((i, el) => {
        const anchorNode = $(el).find('> a');
        const category = {
          title: anchorNode.text(),
          slug: anchorNode.attr('href').replace('#', '')
        };
        const sublistNode = $(el).find('> ul');
        if (sublistNode.get().length > 0) {
          category.subcategories = this._categoriesForList($, sublistNode);
        }
        return category;
      })
      .get();
  }

  static _flattenCategories(categories) {
    return categories.reduce((categories, category) => {
      if (category.subcategories) {
        return categories.concat(
          { title: category.title, slug: category.slug },
          this._flattenCategories(category.subcategories)
        );
      } else {
        return categories.concat(category);
      }
    }, []);
  }

  static _findCategory(query, categories) {
    const items = this._flattenCategories(categories);
    const fields = [{ name: 'title', measure: nn.comparisonMethods.word }];

    return Rx.Observable
      .fromCallback(nn.findMostSimilar)({ title: query }, items, fields)
      .map(result => {
        const category = result[0];
        const probability = result[1];

        return probability > 0.75 ? category : null;
      });
  }

  static _librariesForList($, listNode) {
    return listNode
      .children()
      .map((i, el) => this._parseLibrary($, el))
      .get();
  }

  static _parseLibrary($, libraryNode) {
    const anchorNode = $(libraryNode).find('> a');
    const title = anchorNode.text();
    return {
      link: anchorNode.attr('href'),
      title: title,
      description: $(libraryNode).text().replace(`${title} - `, '').trim()
    };
  }
}

module.exports = AwesomeListBaseScraper;
