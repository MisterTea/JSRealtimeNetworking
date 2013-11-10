var g = require("./globals.js");
var clone = require("clone");
var geom = require("./geometry.js");
var chance = require("chance");

module.exports = {
  keys: {},
  keysToDelete: [],

  init: function() {
    if (typeof window === 'undefined') {
      // Only runs client-side
      return;
    }

    var that = this;
    window.addEventListener(
      "keydown",
      function(e) {
        that.keys[e.keyCode] = e.keyCode;
        //console.log("PRESSED " + e.keyCode);
      },
      false);

    window.addEventListener(
      'keyup',
      function(e) {
        // Delay releasing keys to allow the game a chance to read a
        // keydown/keyup event, even if the duration is short.
        that.keysToDelete.push(e.keyCode);
        //console.log("RELEASED " + e.keyCode);
      },
      false);
  },

  getCommands: function(game) {
    commands = [];
    if ('87' in this.keys) {
      commands.push(g.MOVE_UP);
    }
    if ('68' in this.keys) {
      commands.push(g.MOVE_RIGHT);
    }
    if ('65' in this.keys) {
      commands.push(g.MOVE_LEFT);
    }
    if ('83' in this.keys) {
      commands.push(g.MOVE_DOWN);
    }
    for (var i = 0; i < this.keysToDelete.length; i++) {
      delete this.keys[this.keysToDelete[i]];
    }
    this.keysToDelete.length = 0;

    if (commands.length > 0) {
      //console.log("GOT INPUT");
      //console.log(commands);
    }
    return commands;
  }
};
