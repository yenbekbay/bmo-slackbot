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
      return this.brain
        .setLastVotedUser(channel, username)
        .flatMap(lastVotedUser => {
          return this.brain.incrementUserScore(username, points);
        });
    }

    return this.brain.incrementUserScore(username, points);
  }

  getUserScores() {
    return this.brain
      .getUserScores()
      .map(scores => Object.keys(scores)
        .map(username => {
          return {
            username: `@${username}`,
            points: parseInt(scores[username], 10)
          };
        })
        .filter(score => score.points > 0)
      )
      .map(scores => {
        if (!scores || scores.length === 0) {
          return 'No scores yet';
        }

        scores = scores.reduce((scores, score) => {
          if (scores[score.points]) {
            scores[score.points] = scores[score.points].concat(score.username);
          } else {
            scores[score.points] = [score.username];
          }

          return scores;
        }, {});

        let points = Object.keys(scores).sort().reverse();
        points = points.slice(0, Math.min(10, points.length));

        const table = points
          .map((points, i) => scores[points].map((username, j) => {
            const num = `${i + 1}.`;
            return `${j === 0 ? num : ' '.repeat(num.length)} ` +
              `${username}: ${points} point${points > 1 ? 's' : ''}` +
              (i === 0 ? ' 👑' : '');
          }))
          .reduce((a, b) => a.concat(b));

        return `${clark(points)}\n\`\`\`${table.join('\n')}\`\`\``;
      });
  }

  static parseVote(currentUser, votedUser, operator) {
    if (currentUser && !votedUser) {
      return {
        user: votedUser,
        message: 'Please specify the username',
        points: 0
      };
    } else if (currentUser === votedUser) {
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
