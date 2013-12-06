// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

var app = null;

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
  for (var i = 0; i < a.length; ++i) {
    var p = a[i].split('=');
    if (p.length != 2) continue;
    b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
  }
  return b;
})(window.location.search.substr(1).split('&'));

app.controller('WelcomeCtrl', function($cookies, $location) {
  var playerId = qs['playerid'];
  console.log(playerId);
  if (!playerId) {
    // This shouldn't happen
    return;
  }
  var gameId = qs['gameid'];

  var token = $cookies.token;

  network.init(gameId, playerId, token);
});


angular.element(document).ready(function() {
  //$html.addClass('ng-app');
  console.log("Bootstrapping");
  angular.bootstrap(document, ['playGameModule']);
  console.log("Bootstrapping");
});
