var app = null;

token = null;
playerId = null;

var angular = require("angular");
var angularCookies = require("angularcookies");
var Game = require("../../common/game.js");
var network = require("../../common/network.js");

//var $html = angular.element(document.getElementsByTagName('html')[0]);
app = angular.module('playGameModule', ['ngCookies']);
app.config(function() {});

// Fetch items from the query string
var qs = (function(a) {
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; ++i)
    {
        var p=a[i].split('=');
        if (p.length != 2) continue;
        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
})(window.location.search.substr(1).split('&'));

app.controller('WelcomeCtrl', function($cookies, $location) {
	playerId = qs['playerid'];
	console.log(playerId);
	if (!playerId) {
		// This shouldn't happen
		return;
	}
	var gameId = qs['gameid'];

	console.log("EXECUTING WELCOME CONTROL");
	console.log($cookies);
	console.log($cookies.token);
	token = $cookies.token;

  // Retrieving a cookie
  var favoriteCookie = $cookies.myFavorite;
  // Setting a cookie
  $cookies.myFavorite = 'oatmeal';

	network.init(gameId, playerId);
});


angular.element(document).ready(function() {
	//$html.addClass('ng-app');
	console.log("Bootstrapping");
	angular.bootstrap(document, ['playGameModule']);
	console.log("Bootstrapping");
});

