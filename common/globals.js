// Published under the BSD License by Jason Gauci (jgmath2000@gmail.com)

module.exports = {
  /*** Utility Functions ***/
  intdiv: function(n, d) {
    return~~ (n / d);
  },

  /*** Parameters **/

  // If true, simulate 'lockstep' networking, where the server cannot
  // send the state of the game because it is too large (e.g. a
  // minecraft world).
  LOCKSTEP: true,

  // If true, allow the clients to move ahead of the server,
  // backtracking if they receive an event in the past.  Note that to
  // use this, one must either:
  //
  // (1) Keep snapshots of the world at every frame.  That's what this
  // simple game does, but it might not be practical for large game worlds.
  //
  // (2) Store the changes at every tick, and reverse those changes to move back in time.
  CLIENT_SIDE_PREDICTION: true,

  IS_NODEJS: typeof window === 'undefined',

  /*** Constants ***/

  // Player
  MAX_PLAYERS: 4,
  NO_PLAYER: -1,

  // Player input types

  // LOCAL is a special case, set when the game is not networked at
  // all.
  LOCAL: 0,

  // AI Means that the player is ai-controlled and inputs are
  // calculated on-the-fly.
  AI: 1,

  // REMOTE means that the player is a human player on a networked
  // game.  Note that remote does not imply that the player isn't on
  // the local machine.
  REMOTE: 2,

  // Directions.  Note that it is really important that adding 1 to
  // a direction results in a clockwise turn, and subtracting 1
  // results in a counter-clockwise turn.
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,

  // Global Turn Commands
  MOVE_UP: 0,
  MOVE_RIGHT: 1,
  MOVE_DOWN: 2,
  MOVE_LEFT: 3,

  // Heliocentric Turn Commands
  TURN_LEFT: 4,
  TURN_RIGHT: 5,

  // Meta-Commands
  PLAYER_LEAVE: 6,
  PLAYER_JOIN: 7,

  TICKS_PER_SECOND: 100,
  MS_PER_TICK: 10, // 1000 / TICKS_PER_SECOND

  // Expected Latency in ticks (TODO: Estimate this based on ping).
  // Note that this must be at least enough time to cover gaps in the
  // input.
  LATENCY_MS: 100,
  LATENCY: 10, // LATENCY_MS / MS_PER_TICK

  // Simulate additional latency for testing poor connections (in
  // milliseconds).
  SIMULATED_NETWORK_LATENCY: 400,

  FAIL_IF_MISSING_INPUT: false,

  MAX_TICK: 1000000000
};
