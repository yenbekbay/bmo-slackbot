'use strict';

const Lab = require('lab');
const expect = require('code').expect;
const Chance = require('chance');
const Rx = require('rx-lite');

const LibraryEngine = require('../src/library-engine');
const MockLogger = require('./utils').MockLogger;

const chance = new Chance();
const lab = exports.lab = Lab.script();

class MockAwesomeListScraper {
  constructor(platform, flags) {
    this.platform = platform;
    this.flags = flags || {};
  }

  getLibrariesForQuery() {
    return Rx.Observable.create(observer => {
      const number = chance.natural({ min: 2, max: 10 });
      const libraries = new Array(number).fill().map(() => {
        const title = chance.word({ syllables: 4 });
        const library = {
          platform: this.platform,
          link: `https://github.com/${chance.word()}/${title}`,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description: chance.sentence({
            words: chance.natural({ min: 6, max: 10 })
          })
        };
        if (this.platform === 'ios') {
          library.swift = chance.bool({ likelihood: 40 });
        }
        Object.keys(this.flags).forEach(flagKey => {
          library[flagKey] = this.flags[flagKey];
        });

        return library;
      });

      observer.onNext(libraries);
      observer.onCompleted();
    });
  }
}

let libraryEngine;

lab.before(done => {
  libraryEngine = new LibraryEngine(new MockLogger());
  libraryEngine.awesomeListScrapers = {
    ios: [
      new MockAwesomeListScraper('ios'),
      new MockAwesomeListScraper('ios', { swift: true })
    ],
    android: [
      new MockAwesomeListScraper('android')
    ]
  };

  done();
});

lab.describe('library engine', () => {
  lab.it('fetches libraries for ios', done => {
    libraryEngine
      .getLibrariesForQuery('ios')
      .subscribe(libraries => {
        expect(libraries.length).to.be.above(3);
        for (let library of libraries) {
          expect(library).to.include([
            'platform',
            'link',
            'title',
            'description'
          ]);
          expect(library.platform).to.equal('ios');
        }

        done();
      }, done);
  });

  lab.it('fetches libraries for android', done => {
    libraryEngine
      .getLibrariesForQuery('android')
      .subscribe(libraries => {
        expect(libraries.length).to.be.above(1);
        for (let library of libraries) {
          expect(library).to.include([
            'platform',
            'link',
            'title',
            'description'
          ]);
          expect(library.platform).to.equal('android');
        }

        done();
      }, done);
  });
});
