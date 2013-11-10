// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var g = require("./globals.js");
var clone = require("clone");
var geom = require("./geometry.js");
var chance = require("chance");

module.exports = {
  rng: new chance.Chance(1),

  init: function(seed) {
    if (seed) {
      this.rng = new chance.Chance(seed);
    }
  },

  getCommands: function(game, player) {
    if (player.crashed) return [];

    this.currentGame = game;
    this.currentPlayer = player;

    var state = game.currentState();
    this.currentState = state;

    var rng = this.rng;

    var futurePoint = geom.translatePoint({
      x: player.x,
      y: player.y
    }, player.direction);
    if (this.isDangerous(futurePoint)) {
      // Try turning right
      futurePoint = geom.translatePoint({
        x: player.x,
        y: player.y
      }, (player.direction + 1) % 4);
      if (!this.isDangerous(futurePoint)) {
        return [g.TURN_RIGHT];
      } else {
        // Try turning left
        futurePoint = geom.translatePoint({
          x: player.x,
          y: player.y
        }, (player.direction + 3) % 4);
        if (!this.isDangerous(futurePoint)) {
          return [g.TURN_LEFT];
        } else {
          // You are probably dead soon :-(
          return [];
        }
      }
    }

    // 1 in 100 chance we turn
    if (rng.bool({
      likelihood: 1
    }) == true) {
      // 50% chance of turning either direction
      if (rng.bool() == true) {
        // Try turning right
        futurePoint = geom.translatePoint({
          x: player.x,
          y: player.y
        }, (player.direction + 1) % 4);
        if (!this.isDangerous(futurePoint)) {
          return [g.TURN_RIGHT];
        }
      } else {
        // Try turning left
        futurePoint = geom.translatePoint({
          x: player.x,
          y: player.y
        }, (player.direction + 3) % 4);
        if (!this.isDangerous(futurePoint)) {
          return [g.TURN_LEFT];
        }
      }
    }
    return [];
  },

  isDangerous: function(futurePoint) {
    if (!geom.pointInRect(futurePoint, this.currentGame.arenaRect)) {
      return true;
    }

    if (geom.playerTrailsIntersectWithFuturePoint(this.currentPlayer, this.currentState.players, futurePoint) != null) {
      return true;
    }

    // If another player is within 2, that should be avoided.
    for (var playerName in this.currentState.players) {
      if (this.currentPlayer.id === playerName) {
        continue;
      }
      if (this.currentState.players.hasOwnProperty(playerName)) {
        var otherPlayer = this.currentState.players[playerName];
        if (geom.manhatDistance(this.currentPlayer, otherPlayer) < 4) {
          return true;
        }
      }
    }
    return false;
  }
};
