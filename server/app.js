// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var socketio = require("socket.io");
var Game = require('../common/game.js');
var g = require('../common/globals.js');
var clone = require("clone");
var express = require('express');
var routes = require('./routes');
var playgame = require('./routes/playgame');
var http = require('http');
var path = require('path');
var ntp = require('../public/js/lib/socket-ntp');
var GameManager = require('./gamemanager');

// Initialize the Express app
var app = express();

// Express setup
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, '../public')));

// Enable development mode by default to aid with debugging.
if (true || 'development' == app.get('env')) {
  app.use(express.errorHandler());
}

// URL Routing
app.get('/', routes.index);
app.get('/playgame', playgame.handle);

// Create the HTTP Server and start listening.
var server = http.createServer(app);
server.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

// Create a WebSocket Server and start listening.
var io = socketio.listen(server);
io.set('log level', 2);

// Pass the server reference to the GameManager module
GameManager.io = io;

// When a new connection is received.
io.sockets.on('connection', function(socket) {
  // Start the NTP Synchronization engine.
  ntp.sync(socket);

  // This is the first message from a new client.
  socket.on('clientinit', function(data) {
    // Join the game room
    socket.join(data.gameid);

    // Wait 3 seconds before accepting the client so the ntp
    // accuracy can improve.
    setTimeout(function() {

      // Store some state in the socket session.
      var handler = GameManager.getGameHandler(data.gameid);
      var playerId = handler.tokenPlayerMap[data.tokenid];
      socket.set('playerId', playerId, function() {
        socket.set('gameId', data.gameid, function() {

          var game = handler.game;
          var firstCommandMs = (game.tick * g.MS_PER_TICK) + g.LATENCY_MS;

          // Register the player with the game.
          GameManager.registerRemotePlayer(
            data.gameid,
            data.tokenid,
            firstCommandMs);

          console.log(
            "Sending join command with " +
              Object.keys(game.stateHistory).length +
              " states and " +
              Object.keys(game.commandHistory).length +
              " commands.");

          // Echo the init message back to the client with some game
          // details.
          socket.emit('serverinit', {
            startTime: game.startTime,
            tick: game.tick,
            stateHistory: game.stateHistory,
            commandHistory: game.commandHistory
          });

          console.log("Join command sent");

          // Tell everyone that this player has joined.  Until this
          // command is processed, the player is not part of the game.
          var command = {};
          command[playerId] = [g.PLAYER_JOIN];
          handler.mergeServerCommand(command);
        });
      });
    }, 3000);
  });

  // Fires when we received an input commandlist from a client.
  socket.on('clientinput', function(tickCommandPair) {
    socket.get('playerId', function(err, playerId) {
      socket.get('gameId', function(err, gameId) {
        applyCommand(gameId, playerId, tickCommandPair.ms, tickCommandPair.commands);
      });
    });
  });

  // Fires when a client disconnects.
  socket.on('disconnect', function() {
    socket.get('playerId', function(err, playerId) {
      socket.get('gameId', function(err, gameId) {
        if (gameId) {
          var handler = GameManager.getGameHandler(gameId);
          if (handler) {
            var game = handler.game;
            var command = {};
            command[playerId] = [g.PLAYER_LEAVE];
            handler.mergeServerCommand(command);
          }
        }
      });
    });
  });
});

/**
 * Receives a player's command and applies it to the server, then
 * broadcasts the command to all players.
 *
 * @method applyCommand
 * @param {string} gameId
 * @param {string} playerId
 * @param {int} ms
 * @param {list} commandlist
 */
var applyCommand = function(gameId, playerId, ms, commandlist) {
  var handler = GameManager.getGameHandler(gameId);
  var game = handler.game;
  var playerServerData = handler.playerServerData[playerId];

  if (game.tick * g.MS_PER_TICK >= ms) {
    // This command came in too late, we have to adjust the time
    // and apply the command later than expected.

    // Note that this makes life difficult.  Now the command
    // will execute at a different time than was expected by the
    // client when the client sent the command.
    ms = (game.tick * g.MS_PER_TICK) + 1 + g.intdiv(g.LATENCY_MS, 2);
  }
  if (playerServerData.nextInputMs == null) {
    throw "OOPS";
  }
  if (playerServerData.nextInputMs >= ms) {
    // Note that although we are trying to prevent this scenario
    // client-side, it can still happen because of the if
    // statement above, so we have to be prepared to deal with
    // it.  If this happens on the server side, move the command
    // up to accomodate.  Note that, as above, the ms of the
    // command has to be modified from the client's original
    // intent.
    ms = playerServerData.nextInputMs + 1;
  }
  playerServerData.nextInputMs = ms;

  // Apply the commandlist on the server
  game.addCommand(ms, playerId, commandlist);

  // Broadcast the commandlist to the other clients
  io.sockets.in(game.id).emit("serverinput", {
    ms: ms,
    commands: commandlist,
    playerId: playerId
  });
};

console.log("Main loop finished");
