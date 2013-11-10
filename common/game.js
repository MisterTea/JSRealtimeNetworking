var g = require("./globals.js");
var geom = require("./geometry.js");
var ai = require("./ai.js");
var input = require("./input.js");
var Renderer = require("./renderer.js");
var Class = require("class.js");
var clone = require("clone");

module.exports = Class({
	init: function(id, network, canvas, tickCallback) {
		this.arenaRect = {x:0,y:0,width:200,height:200};
		this.id = id;
		this.network = network;
		this.tickCallback = tickCallback;
		this.stateHistory = {};
		this.commandHistory = {};
		this.lastCommandMs = {};
		this.serverCommands = {};

		// We need a way for the server to tell clients that no new server
		// commands will be older than some time t.
		this.lastServerTick = 0;

		this.tick = 0;
		this.abort = false;

		ai.init();
		input.init();

		this.stateHistory[0] = {
			// Keep a copy of the tick in the state.  This is useful when
			// storing states (e.g. in a database) or passing states from
			// one machine to another.
			tick:0,

			// The time when the game logic should initialize and start
			// executing.
			gameStartTick:100,

			// Player-specific state information (position, direction,
			// etc.).
			players:{},

			connectedClients:{}
		};
		this.commandHistory[0] = {
		};

		console.log("Game is initialized");

		this.renderer = new Renderer(this, canvas);

		this.startTime = this.network.getNetworkTime();

		if (g.MS_PER_TICK==0) {
			console.log("Calling tick directly");
			this.update();
		} else {
			var _this = this;
			if (typeof window === 'undefined') {
				setTimeout(function() { _this.update(); }, 1000 / 60);
			} else {
				window.requestAnimationFrame(function() { _this.update(); });
			}
		}
	},

	currentState: function() {
		return this.stateHistory[this.tick];
	},

	update: function() {
		// Keep advancing the game state as long as we are behind
		// real-time.
		while(true) {
			if (g.MS_PER_TICK>0 && this.tick>0) {
				// clockTick contains the tick that should be processed
				// based on the current time.  In the case of a
				// fractional tick, the code rounds up.
				var clockTick = g.intdiv(this.network.getNetworkTime()-this.startTime,g.MS_PER_TICK);
				if (this.tick > clockTick) {
					// This means that the game time is ahead of real
					// time, don't process more frames.
					break;
				}
			}

			if (!g.CLIENT_SIDE_PREDICTION && this.tick>0) {
				// Do not advance state until we have everyone's input for the tick.
				var doBreak=false;
				if (this.lastServerTick < this.tick) {
					console.log("Waiting for server ACK");
					break;
				}
				for (var playerName in this.stateHistory[this.tick-1].connectedClients) {
					if (this.lastCommandMs[playerName] < this.tick * g.MS_PER_TICK) {
						// Check future ticks for commands.  If we have them,
						// then we can infer that the previous commands are
						// unchanged.  Otherwise, we need to wait.

						if (g.FAIL_IF_MISSING_INPUT) {
							throw "OOPS";
						}

						//console.log("Missing command from " + playerName + " on tick " + this.tick);
						doBreak=true;
					}
				}
				if (doBreak) {
					break;
				}
			}

			this.advanceState();
		}

		// Render based on the previous state (note that the current state
		// does not exist yet).
		if (!(this.tick-1 in this.stateHistory)) {
			console.log(this.stateHistory);
		}
		this.renderer.update(this.previousState());

		if (g.MS_PER_TICK>0 && !this.abort) {
			// If the game isn't over, it must mean that we are in async mode.
			var _this = this;
			if (typeof window === 'undefined') {
				setTimeout(function() { _this.update(); }, 1000 / 60);
			} else {
				window.requestAnimationFrame(function() { _this.update(); });
			}
		}
	},

	previousState: function() {
		if (this.tick<1) {
			throw "OOPS";
		}
		return this.stateHistory[this.tick-1];
	},

	advanceState: function() {
		if (!(this.tick in this.stateHistory)) {
			if (!((this.tick-1) in this.stateHistory)) {
				throw "OOPS";
			}
			// Prepare a new State
			this.stateHistory[this.tick] = clone(this.stateHistory[this.tick-1]);
			this.stateHistory[this.tick].tick = this.tick;
		}

		var state = this.currentState();
		if (state.tick==state.gameStartTick) {
			// Start a new game
			this.resetGame();
		}
		this.handleServerCommands();
		if (this.tickCallback) {
			this.tickCallback(this);
		}
		this.handleLocalCommands();
		this.sendRemoteCommands();
		if (state.tick>=state.gameStartTick) {
			this.processCommands();
			this.inGameTick();
		}

		this.tick++;
	},

	inGameTick: function() {
		// Create some local variables for convienience
		var state = this.currentState();
		var players = state.players;

		// Check for crashes
		for (var playerName in players) {
			var player = players[playerName];
			if (player.crashed) {
				continue;
			}

			var futurePoint = geom.translatePoint({x:player.x,y:player.y},player.direction);

			if (!geom.pointInRect(futurePoint,this.arenaRect)) {
				this.playerCrash(playerName, "Fell out of the arena.");
			}

			var attacker = geom.playerTrailsIntersect(player,state.players);
			if (attacker != null) {
				this.playerCrash(playerName, "Ran into trail of " + attacker);
			}
		}

		for (var playerName in players) {
			var player = players[playerName];
			if (player.crashed) {
				continue;
			}

			player.trails[player.trails.length-1].x = player.x;
			player.trails[player.trails.length-1].y = player.y;

			if (player.trails[player.trails.length-1].direction != player.direction) {
				// Start a new trail
				player.trails.push({x:player.x,y:player.y,direction:player.direction});
			}

			geom.translatePoint(player,player.direction);
		}
	},
	getCommands: function(ms) {
		//console.log("Getting commands at " + tick);
		if (!(ms in this.commandHistory)) {
			this.commandHistory[ms] = {};
		}
		return this.commandHistory[ms];
	},
	getMostRecentPastCommandList: function(ms, playerId) {
		var state = this.stateHistory[g.intdiv(ms,g.MS_PER_TICK)];
		if (state) {
			var player = state.players[playerId];
			if (player.input != g.REMOTE) {
				return this.getCommands(ms)[playerId];
			}
		}

		if (!(playerId in this.lastCommandMs)) {
			console.trace();
			throw "OOPS " + playerId;
		}

		//console.log("Getting commands on or before " + tick + " for player " + playerId);
		if (this.lastCommandMs < ms) {
			var commandList = this.commandHistory[this.lastCommandMs][playerId];
		} else {
			// We need to backtrack until we find a valid command
			while(true) {
				var commandPlayerMap = this.commandHistory[ms];
				if (commandPlayerMap) {
					var commandList = commandPlayerMap[playerId];
					if(commandList) {
						break;
					}
				}
				ms--;
				if (ms<0) {
					throw "OOPS";
				}
			}
		}
		if (!commandList) {
			throw "OOPS";
		}

		return commandList;
	},
	addCommand: function(ms, playerId, commandList) {
		this.getCommands(ms)[playerId] = commandList;
		if (this.lastCommandMs[playerId] >= ms) {
			throw "OOPS";
		}
		this.updateLastCommandMs(playerId, ms);
		var newTick = g.intdiv(ms, g.MS_PER_TICK);
		if (this.tick > newTick) {
			if (!g.CLIENT_SIDE_PREDICTION) {
				throw "OOPS";
			}
			// A change in the past has happend, we need to rewind.
			console.log("REWIND FROM " + this.tick + " TO " + newTick);
			this.tick = newTick;
		}
	},
	applyCommands: function() {
	},
	handleServerCommands: function() {
		// Create some local variables for convienience
		var state = this.currentState();

		var commands = this.serverCommands[this.tick];

		var players = state.players;

		// It's possible there are no commands on this tick because of
		// client-side prediction.
		if (commands) {
		} else {
			return;
		}

		for (var playerName in commands) {
			var player = players[playerName];
			var playerCommands = commands[playerName];

			// Process commands
			for (var i=0;i<playerCommands.length;i++) {
				var command = playerCommands[i];
				switch(command) {
				case g.PLAYER_LEAVE:
					if (player) {
						console.log("Player " + player.id + " has left");
						player.input = g.AI;
					}
					delete state.connectedClients[player.id];
					break;
				case g.PLAYER_JOIN:
					console.log("Player " + playerName + " has joined");
					if (playerName in state.players) {
						player.input = g.REMOTE;
					} else {
						this.addPlayer(playerName, g.REMOTE);
					}
					this.updateLastCommandMs(playerName, this.tick * g.MS_PER_TICK);
					state.connectedClients[playerName] = true;
					this.getCommands(this.tick * g.MS_PER_TICK)[playerName] = [];
					break;
				default:
					throw "OOPS " + command;
				}
			}
		}
	},
	updateLastCommandMs: function(playerName, ms) {
		if (!(playerName in this.lastCommandMs)) {
			this.lastCommandMs[playerName] = ms;
			return;
		}
		this.lastCommandMs[playerName] = Math.max(
			this.lastCommandMs[playerName],
			ms);
	},
	handleLocalCommands: function() {
		// Create some local variables for convienience
		var state = this.currentState();
		var commands = this.getCommands(this.tick * g.MS_PER_TICK);
		var players = state.players;

		for (var playerName in state.players) {
			var player = players[playerName];
			if (player.input == g.LOCAL) {
				// When playing a local game (no networking), the commands are fetched on-demand.
				commands[playerName] = input.getCommands(this);
			} else if(player.input == g.REMOTE) {
				// Do nothing if remote.
			} else if (player.input == g.AI) {
				// The ai is always recomputed every tick
				commands[playerName] = ai.getCommands(this, player);
			} else {
				throw "OOPS";
			}
		}
	},
	sendRemoteCommands: function() {
		this.network.sendCommands(this.tick, input.getCommands(this));
	},
	processCommands: function() {
		var state = this.currentState();
		var commands = this.getCommands(this.tick * g.MS_PER_TICK);
		var players = state.players;

		for (var playerName in state.players) {
			var player = players[playerName];
			var playerCommands = this.getMostRecentPastCommandList(this.tick * g.MS_PER_TICK, playerName);

			if (playerCommands) {
			} else {
				throw "OOPS";
			}

			// Process commands
			for (var i=0;i<playerCommands.length;i++) {
				var command = playerCommands[i];
				switch(command) {
				case g.TURN_LEFT:
					player.direction = (player.direction+3)%4;
					break;
				case g.TURN_RIGHT:
					player.direction = (player.direction+1)%4;
					break;
				case g.UP:
				case g.RIGHT:
				case g.DOWN:
				case g.LEFT:
					if ((command+2)%4 == player.direction) {
						// Command and player direction are opposite, ignore
					} else {
						player.direction = command;
					}
					break;
				case g.PLAYER_LEAVE:
					if (player) {
						console.log("Player " + player.id + " has left");
						player.input = g.AI;
					}
					break;
				case g.PLAYER_JOIN:
					console.log("Player " + playerName + " has joined");
					if (playerName in state.players) {
						player.input = g.REMOTE;
					} else {
						this.addPlayer(playerName, g.REMOTE);
					}
					break;
				default:
					throw "OOPS " + command;
				}
			}
		}
	},
	addPlayer: function(playerName, input) {
		console.log("Adding player: " + playerName);
		var state = this.currentState();
		var yShift = 20 + Object.keys(state.players).length*50;
		state.players[playerName] = {
			id:playerName,
			input:input,
			x:2,
			y:yShift,
			direction:g.RIGHT,
			crashed:false,
			trails:[{x:0,y:yShift,direction:g.RIGHT},
							{x:1,y:yShift,direction:g.RIGHT}]
		};
	},
	resetGame: function() {
		var state = this.currentState();
		previousPlayerIds = [];
		for (var playerId in state.connectedClients) {
			previousPlayerIds.push(playerId);
		}
		state.players = {};
		for (var i=0;i<previousPlayerIds.length;i++) {
			this.addPlayer(previousPlayerIds[i], g.REMOTE);
		}
		for (var j=previousPlayerIds.length;j<4;j++) {
			this.addPlayer("AI"+j, g.AI);
		}
	},
	playerCrash: function(playerName, reason) {
		var state = this.currentState();
		console.log("PLAYER: " + playerName + " CRASHED: " + reason);
		state.players[playerName].crashed = true;

		var count=0;
		for (var playerName in state.players) {
			if (state.players[playerName].crashed == false) {
				count++;
			}
		}
		if (count<2) {
			state.gameStartTick = state.tick+100;
		}
	}
});

