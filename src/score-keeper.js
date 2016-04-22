'use strict';

const clark = require('clark');

class ScoreKeeper {
  constructor(brain) {
    this.brain = brain;
  }

  updateScore(channel, username, points) {
    if (!username) {
      throw new Error('Invalid user');
    }
    if (channel) {
      return this.brain.setLastVotedUser(channel, username)
        .flatMap(lastVotedUser => {
          this.brain.incrementUserScore(username, points);
        });
    }

    return this.brain.incrementUserScore(username, points);
  }

  getUserScores() {
    return this.brain.getUserScores()
      .map(scores => Object.keys(scores)
        .map(username => {
          return {
            username: `@${username}`,
            score: parseInt(scores[username], 10)
          };
        })
        .filter(score => score.score > 0)
        .sort((a, b) => {
          if (a.score < b.score) {
            return 1;
          }
          if (a.score > b.score) {
            return -1;
          }
          return 0;
        })
      )
      .map(scores => {
        if (!scores || scores.length === 0) {
          return 'No scores yet';
        }
        scores = scores.slice(0, Math.min(10, scores.length));

        scores[0].username = `👑 ${scores[0].username}`;
        return `${clark(scores.map(score => score.score))}\n` +
          scores.map((score, idx) => {
            return `${idx + 1}. ${score.username}: ${score.score} ` +
              `point${score.score > 1 ? 's' : ''}`;
          }).join('\n');
      });
  }

  static parseVote(currentUser, votedUser, operator) {
    if (currentUser && !votedUser) {
      return {
        user: votedUser,
        message: 'Please specify the username',
        points: 0
      };
    } else if (!currentUser || !votedUser) {
      throw new Error('Invalid user');
    }

    if (currentUser === votedUser) {
      return {
        user: votedUser,
        message: `@${currentUser}: No cheating 😏`,
        points: 0
      };
    }

    if (operator === '+1') {
      operator = '++';
    } else if (operator === '-1') {
      operator = '--';
    }

    switch (operator) {
      case '++':
        return {
          user: votedUser,
          message: `Upvoted @${votedUser} 😃`,
          points: 1
        };
      case '--':
        return {
          user: votedUser,
          message: `Downvoted @${votedUser} 😔`,
          points: -1
        };
    }
  }
}

module.exports = ScoreKeeper;
