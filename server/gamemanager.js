var Chance = require("chance");
var Class = require("class.js");
var _ = require("underscore");

var Game = require("../common/game.js");
var network = require("../common/network.js");
var g = require('../common/globals.js');

var chance = new Chance();

exports.io = null;

var preTickCallback = function(game) {
  if (!g.LOCKSTEP) {
    exports.io.sockets.emit('serverstate', {
      state: game.stateHistory[game.tick],
      tick: game.tick,
      commands: game.commandHistory[game.tick]
    });
  }

  // Push out server commands.
  var handler = getGameHandler(game.id);
  exports.io.sockets.emit("servercommand", {
    tick: game.tick + g.LATENCY,
    commands: handler.serverCommand
  });
  // Handle server commands locally.
  game.serverCommands[game.tick + g.LATENCY] = handler.serverCommand;
  handler.serverCommand = {};
};

var ServerGameHandler = Class({
  init: function(id) {
    this.id = id;
    this.tokenPlayerMap = {};
    this.game = new Game(id, network, null, preTickCallback);
    this.game.lastServerTick = g.MAX_TICK;
    this.playerServerData = {};
    this.serverCommand = {};
  },
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
  mergeServerCommand: function(command) {
    _.extend(this.serverCommand, command);
  }
});

console.log("Resetting game handlers");
var gameHandlers = {};

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

exports.getGameHandler = getGameHandler = function(gameId) {
  var handler = gameHandlers[gameId];
  return handler;
};

exports.createGameHandler = function(gameid) {
  gameHandlers[gameid] = new ServerGameHandler(gameid);
  return gameHandlers[gameid];
};
