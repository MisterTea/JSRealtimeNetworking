// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var Chance = require("chance");
var Class = require("class.js");
var Game = require("../../common/game.js");
var gameManager = require("../gamemanager.js");

var chance = new Chance();

exports.handle = function(req, res) {
  var playerId = req.query.playerid;
  var gameid = req.query.gameid;

  if (!gameid || !playerId) {
    // Present the user with the "missing info" page.
    res.render("nogameid");
    return;
  }

  console.log("PREVIOUS TOKEN: " + req.cookies['token']);
  var game = gameManager.getGameHandler(gameid);
  var newToken = chance.hash({
    length: 15
  });
  res.cookie('token', newToken, {
    signed: false
  });

  if (game) {
    console.log("Game already exists with id: " + gameid);
  } else {
    console.log("Creating game with id: " + gameid);
    // Make a new game with this id
    game = gameManager.createGameHandler(gameid);
  }

  // Add the player to this game.
  game.addPlayer(playerId, newToken);

  // Present the user with the playgame page.
  res.render('playgame', {
    playerId: playerId
  });
};
