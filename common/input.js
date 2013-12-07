// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

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
      },
      false);

    window.addEventListener(
      'keyup',
      function(e) {
        // Delay releasing keys to allow the game a chance to read a
        // keydown/keyup event, even if the duration is short.
        that.keysToDelete.push(e.keyCode);
      },
      false);
  },

  /**
   * Get the commands based on the state of the keyboard
   * @method getCommands
   * @param {Game} game Pointer to a game object (not needed)
   * @return commands The list of commands firing.
   */
  getCommands: function(game) {
    var commands = [];
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

    return commands;
  }
};
