// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var Class = require("class.js");
var _ = require("underscore");
var Game = require("../common/game.js");
var g = require('../common/globals.js');

exports.io = null;

/**
 * Called after a tick is finished processing on the server.
 *
 * @method postTickCallback
 * @param {Game} game
 */
var postTickCallback = function(game) {
  if (!g.LOCKSTEP) {
    // Broadcast the game state to all clients.
    exports.io.sockets.in(game.id).emit('serverstate', {
      state: game.stateHistory[game.tick],
      tick: game.tick,
      commands: game.commandHistory[game.tick]
    });
  }

  // Push out future server commands.
  var handler = getGameHandler(game.id);
  exports.io.sockets.in(game.id).emit("servercommand", {
    tick: game.tick + g.LATENCY,
    commands: handler.serverCommand
  });

  // Push server commands locally.
  game.serverCommands[game.tick + g.LATENCY] = handler.serverCommand;

  // Clear the server command buffer for the next frame.
  handler.serverCommand = {};
};

var ServerGameHandler = Class({
  init: function(id) {
    this.id = id;
    this.tokenPlayerMap = {};
    var dummyNetwork = {
      getNetworkTime: function() {
        return Date.now();
      }
    };
    this.game = new Game(id, dummyNetwork, null, postTickCallback);
    this.playerServerData = {};
    this.serverCommand = {};
  },

  /**
   * Adds a player to the game.
   *
   * @method addPlayer
   * @param {string} playerId The player's ID
   * @param {string} newToken A browser session token bound to this
   * Player/Game instance.
   */
  addPlayer: function(playerId, newToken) {
    // Check if this is a reconnect and delete the old token mapping
    if (playerId in this.playerServerData) {
      delete this.tokenPlayerMap[this.playerServerData[playerId].token];
      delete this.playerServerData[playerId];
    }
    this.playerServerData[playerId] = {
      token: newToken,
      nextInputMs: null
    };
    this.tokenPlayerMap[newToken] = playerId;
  },

  /**
   * Adds new commands to the server command buffer.
   *
   * @method mergeServerCommand
   * @param {string} command
   */
  mergeServerCommand: function(command) {
    _.extend(this.serverCommand, command);
  }
});

var gameHandlers = {};

/**
 * Adds a new player to a game.
 * @method registerRemotePlayer
 * @param {string} gameid
 * @param {string} token
 * @param {int} firstCommandMs
 * @return
 */
exports.registerRemotePlayer = function(gameid, token, firstCommandMs) {
  console.log("Registering player with game id: " + gameid);
  var gameHandler = gameHandlers[gameid];
  if (gameHandler) {
    var playerId = gameHandler.tokenPlayerMap[token];
    gameHandler.playerServerData[playerId].nextInputMs =
      firstCommandMs;
    return playerId;
  } else {
    throw "OOPS";
  }
};

var getGameHandler =
      exports.getGameHandler = function(gameId) {
        var handler = gameHandlers[gameId];
        return handler;
      };

exports.createGameHandler = function(gameid) {
  gameHandlers[gameid] = new ServerGameHandler(gameid);
  return gameHandlers[gameid];
};
