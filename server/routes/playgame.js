var Chance = require("chance");
var Class = require("class.js");
var Game = require("../../common/game.js");
var network = require("../../common/network.js");
var gameManager = require("../gamemanager.js");

var chance = new Chance();

exports.handle = function(req, res){
	var playerId = req.query.playerid;
	var gameid = req.query.gameid;

	if (!gameid || !playerId) {
		res.render("nogameid");
		return;
	}

	console.log("PREVIOUS TOKEN: " + req.cookies['token']);
	var game = gameManager.getGameHandler(gameid);
	var newToken = chance.hash({length: 15});
	res.cookie('token', newToken, { signed: false });

	if (game) {
		console.log("Game already exists with id: " + gameid);
	} else {
		console.log("Creating game with id: " + gameid);
		// Make a new game with this id
		game = gameManager.createGameHandler(gameid);
	}

	game.addPlayer(playerId, newToken);

	res.render('playgame', { playerId:playerId });
};
