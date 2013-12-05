// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var Game = require("./game.js");
var deepEqual = require('deep-equal');
var g = require("./globals.js");

var io = null;
var ntp = null;
var fabric = null;

if (g.IS_NODEJS) {
  // We are running inside nodejs
} else {
  io = require("socket.io-client/dist/socket.io.js");
  ntp = require("ntpclient");
  fabric = require("fabric");
}

module.exports = {
  remoteCommands: {},
  playerId: null,
  game: null,
  init: function(gameId, playerId) {
    this.playerId = playerId;

    if (g.IS_NODEJS) {
      // Only runs client-side
      return;
    }

    var socket = io.connect('http://' + window.location.hostname + ':' + window.location.port);
    this.socket = socket;

    ntp.init(socket);

    var outerThis = this;
    console.log("SENDING TOKEN: " + token + " AND GAMEID " + gameId);
    socket.emit('clientinit', {
      gameid: gameId,
      tokenid: token
    });
    socket.on('serverinit', function(data) {
      console.log("GOT SERVER INIT");
      // create a wrapper around native canvas element (with id="c")
      var canvas = new fabric.StaticCanvas('c');
      outerThis.game = new Game(gameId, outerThis, canvas);
      outerThis.game.startTime = data.startTime;
      outerThis.game.stateHistory = data.stateHistory;
      outerThis.game.commandHistory = data.commandHistory;
      outerThis.game.tick = data.tick;
    });
    socket.on('serverstate', function(data) {
      outerThis.handleServerState(data);
    });
    socket.on('serverinput', function(inputCommandData) {
      outerThis.handleServerInput(inputCommandData);
    });
    socket.on('disconnect', function() {
      console.log("Server disconnected");
      outerThis.game.abort = true;
    });
    socket.on('servercommand', function(data) {
      outerThis.handleServerCommand(data);
    });
  },
  lastOffset: 0,
  handleServerState: function(data) {
    if (this.game == null) {
      // Wait until the game has been initialized.
      setTimeout(this.handleServerState, 1, data);
      return;
    }

    if (g.LOCKSTEP) {
      // In lockstep, do not accept states from the server, only
      // actions.
      return;
    }

    while (data.tick > this.game.tick) {
      g.FAIL_IF_MISSING_INPUT = true;
      // We got a server state in the future, advance until we get there.
      this.game.advanceState();
      g.FAIL_IF_MISSING_INPUT = false;
    }
    // We got a server state in the past, check if we need to backtrack
    if (!deepEqual(this.game.stateHistory[data.tick], data.state) || !deepEqual(this.game.commandHistory[data.tick], data.commands)) {
      // The server is not in sync with us, backtrack.
      this.game.stateHistory[data.tick] = data.state;
      this.game.commandHistory[data.tick] = data.commands;
      this.game.tick = data.tick;
    }
  },
  handleServerInput: function(inputCommandData) {
    // Wait until the game has been initialized.
    if (this.game == null) {
      setTimeout(this.handleServerInput, 1, inputCommandData);
      return;
    }

    var game = this.game;
    var oldCommands = game.getCommands(inputCommandData.ms)[inputCommandData.playerId];
    var newCommands = inputCommandData.commands;
    if (!deepEqual(oldCommands, newCommands)) {
      // The command has changed, we need to update.
      game.addCommand(inputCommandData.ms, inputCommandData.playerId, newCommands);
    }
  },
  handleServerCommand: function(data) {
    if (this.game == null) {
      setTimeout(this.handleServerCommand, 1, data);
      return;
    }

    this.game.serverCommands[data.tick] = data.commands;
    this.game.lastServerTick = Math.max(this.game.lastServerTick, data.tick);
  },
  getNetworkTime: function() {
    if (typeof window === 'undefined') {
      // The server's time is ground truth
      return Date.now();
    }

    if (ntp.offset() != this.lastOffset) {
      this.lastOffset = ntp.offset();
    }
    return Date.now() - ntp.offset();
  },
  lastProcessMs: -1,
  sendCommands: function(tick, commands) {
    if (typeof window === 'undefined') {
      // Only runs client-side
      return;
    }

    var processMs = (tick * g.MS_PER_TICK) + g.LATENCY_MS;

    if (this.lastProcessMs >= processMs) {
      // This command is scheduled to run before/during the previous
      // command. Move it just ahead of the previous command.

      // Note that, because of this, some commands may get dropped
      // because they are sandwiched between two other commands in
      // time.  As long as all clients drop the same commands, this
      // isn't a problem.
      processMs = this.lastProcessMs + 1;
    }
    this.lastProcessMs = processMs;


    this.socket.emit('clientinput', {
      ms: processMs,
      commands: commands
    });
  }
};
