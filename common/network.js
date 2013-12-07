// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var Game = require("./game.js");
var deepEqual = require('deep-equal');
var g = require("./globals.js");
var io = require("socket.io-client/dist/socket.io.js");
var ntp = require("ntpclient");
var fabric = require("fabric");

module.exports = {
  remoteCommands: {},
  playerId: null,
  game: null,

  init: function(gameId, playerId, token) {
    this.playerId = playerId;

    if (g.IS_NODEJS) {
      throw "OOPS";
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

      // Override some of the client's game with server data.
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

  /**
   * Handle a packet containing a server state.
   * @method handleServerState
   * @param {JSON} data
   * @return
   */
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

      // Start on the tick after the server state (that tick is finished).
      this.game.tick = data.tick + 1;
    }
  },

  /**
   * Handle a packet containing server input.
   * @method handleServerInput
   * @param {JSON} inputCommandData
   * @return
   */
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

  /**
   * Handle a packet containing server-specific inputs.
   * @method handleServerCommand
   * @param {JSON} data
   * @return
   */
  handleServerCommand: function(data) {
    if (this.game == null) {
      setTimeout(this.handleServerCommand, 1, data);
      return;
    }

    this.game.serverCommands[data.tick] = data.commands;
    this.game.lastServerTick = Math.max(this.game.lastServerTick, data.tick);
  },

  /**
   * Get the server-offset time.
   * @method getNetworkTime
   * @return Time offset by NTP to server.
   */
  getNetworkTime: function() {
    if (g.IS_NODEJS) {
      // The server's time is ground truth
      return Date.now();
    }

    if (ntp.offset() != this.lastOffset) {
      this.lastOffset = ntp.offset();
    }
    return (Date.now() - ntp.offset());
  },
  lastProcessMs: -1,

  /**
   * Time-Shift commands and send them to the server.
   * @method sendCommands
   * @param {int} tick
   * @param {list} commands
   */
  sendCommands: function(tick, commands) {
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
