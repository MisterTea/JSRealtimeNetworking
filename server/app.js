// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var socketio = require("socket.io");
var Game = require('../common/game.js');
var g = require('../common/globals.js');
var clone = require("clone");

/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var playgame = require('./routes/playgame');
var http = require('http');
var path = require('path');
var ntp = require('../public/js/lib/socket-ntp');

var gameManager = require('./gamemanager');

var app = express();

// all environments
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

// development only
if (true || 'development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/playgame', playgame.handle);

var server = http.createServer(app);

server.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
var io = socketio.listen(server);
io.set('log level', 2);

gameManager.io = io;

var applyServerCommand = function(gameId, command) {
  gameManager.getGameHandler(gameId).mergeServerCommand(command);
};

var applyCommand = function(gameId, playerId, ms, commandlist) {
  var handler = gameManager.getGameHandler(gameId);
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

io.sockets.on('connection', function(socket) {
  ntp.sync(socket);
  socket.on('clientinit', function(data) {
    // Join the game room
    socket.join(data.gameid);

    // Wait 3 seconds before accepting the client so the ntp
    // accuracy can improve.
    setTimeout(function() {
      var handler = gameManager.getGameHandler(data.gameid);
      var playerId = handler.tokenPlayerMap[data.tokenid];
      socket.set('playerId', playerId, function() {
        socket.set('gameId', data.gameid, function() {
          var game = handler.game;
          // TODO: Replace with real latency difference
          var firstCommandMs = (game.tick * g.MS_PER_TICK) + g.LATENCY_MS;
          gameManager.registerRemotePlayer(
            data.gameid,
            data.tokenid,
            firstCommandMs);
          console.log("Sending join command with " + Object.keys(game.stateHistory).length + " states and " + Object.keys(game.commandHistory).length + " commands.");
          socket.emit('serverinit', {
            startTime: game.startTime,
            tick: game.tick,
            stateHistory: game.stateHistory,
            commandHistory: game.commandHistory
          });
          console.log("Join command sent");

          var command = {};
          command[playerId] = [g.PLAYER_JOIN];
          applyServerCommand(data.gameid, command);
        });
      });
    }, 3000);
  });
  socket.on('clientinput', function(tickCommandPair) {
    socket.get('playerId', function(err, playerId) {
      socket.get('gameId', function(err, gameId) {
        applyCommand(gameId, playerId, tickCommandPair.ms, tickCommandPair.commands);
      });
    });
  });
  socket.on('disconnect', function() {
    socket.get('playerId', function(err, playerId) {
      socket.get('gameId', function(err, gameId) {
        var handler = gameManager.getGameHandler(gameId);
        if (handler) {
          var game = handler.game;
          var command = {};
          command[playerId] = [g.PLAYER_LEAVE];
          applyServerCommand(gameId, command);
        }
      });
    });
  });
});

console.log("Main loop finished");
