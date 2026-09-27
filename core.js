/* Blame core: gridworld + three credit-assignment learners.
   Runs in the browser (window.BlameCore) and in Node (module.exports). No dependencies. */
(function (root) {
  'use strict';

  var CELL = { EMPTY: 0, WALL: 1, GOAL: 2, PIT: 3, COIN: 4 };
  var REWARD = [0, 0, 1, -1, 0.3];
  var MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
  var ALGOS = {
    mc: 'Monte Carlo',
    q: 'Q-learning',
    lambda: 'SARSA(λ)'
  };

  function rng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---------------- World ---------------- */
  function World(w, h) {
    this.w = w; this.h = h;
    this.cells = new Uint8Array(w * h);
    this.start = 0;
    this.slip = 0;
  }

  World.fromRows = function (rows) {
    var h = rows.length, w = rows[0].length, world = new World(w, h);
    var map = { '.': 0, '#': 1, 'G': 2, 'X': 3, 'c': 4, 'S': 0 };
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x];
        world.cells[y * w + x] = map[ch] || 0;
        if (ch === 'S') world.start = y * w + x;
      }
    }
    return world;
  };

  World.prototype.clone = function () {
    var c = new World(this.w, this.h);
    c.cells.set(this.cells);
    c.start = this.start; c.slip = this.slip;
    return c;
  };

  World.prototype.isTerminal = function (s) {
    var c = this.cells[s];
    return c === CELL.GOAL || c === CELL.PIT || c === CELL.COIN;
  };

  World.prototype.move = function (s, a) {
    var x = s % this.w, y = (s / this.w) | 0;
    var nx = x + MOVES[a][0], ny = y + MOVES[a][1];
    if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) return s;
    var n = ny * this.w + nx;
    return this.cells[n] === CELL.WALL ? s : n;
  };

  World.prototype.step = function (s, a, rand) {
    if (this.slip > 0 && rand() < this.slip) a = (rand() * 4) | 0;
    var s2 = this.move(s, a);
    return { s2: s2, r: REWARD[this.cells[s2]], done: this.isTerminal(s2) };
  };

  /* Optimal state values by value iteration; used as the "best possible" reference. */
  World.prototype.optimalValues = function (gamma) {
    var n = this.w * this.h, V = new Float64Array(n), slip = this.slip;
    for (var it = 0; it < 2000; it++) {
      var delta = 0;
      for (var s = 0; s < n; s++) {
        if (this.cells[s] === CELL.WALL || this.isTerminal(s)) continue;
        var best = -Infinity;
        for (var a = 0; a < 4; a++) {
          var q = 0;
          for (var b = 0; b < 4; b++) {
            var p = (a === b ? 1 - slip : 0) + slip / 4;
            if (p === 0) continue;
            var s2 = this.move(s, b);
            q += p * (REWARD[this.cells[s2]] + (this.isTerminal(s2) ? 0 : gamma * V[s2]));
          }
          if (q > best) best = q;
        }
        delta = Math.max(delta, Math.abs(best - V[s]));
        V[s] = best;
      }
      if (delta < 1e-9) break;
    }
    return V;
  };

  /* ---------------- Agent ---------------- */
  // params is read live on every step, so the UI can pass its own object and tweak it mid-run.
  function Agent(world, algo, params, seed) {
    var n = world.w * world.h;
    this.world = world; this.algo = algo; this.p = params;
    this.n = n;
    this.Q = new Float64Array(n * 4);
    if (params.optimism) this.Q.fill(params.optimism); // optimistic start drives exploration
    this.E = new Float64Array(n * 4);
    this.lastT = new Int32Array(n * 4);
    this.inAct = new Uint8Array(n * 4);
    this.act_ = [];
    this.rand = rng(seed);
    this.episode = 0;
    this.done = true;
  }

  Agent.prototype.greedy = function (s) {
    var Q = this.Q, b = s * 4, best = -Infinity, ties = 0, pick = 0;
    for (var a = 0; a < 4; a++) {
      var v = Q[b + a];
      if (v > best + 1e-12) { best = v; ties = 1; pick = a; }
      else if (Math.abs(v - best) <= 1e-12) { ties++; if (this.rand() * ties < 1) pick = a; }
    }
    return pick;
  };

  Agent.prototype.choose = function (s) {
    return this.rand() < this.p.epsilon ? (this.rand() * 4) | 0 : this.greedy(s);
  };

  Agent.prototype.maxQ = function (s) {
    var b = s * 4, Q = this.Q;
    return Math.max(Q[b], Q[b + 1], Q[b + 2], Q[b + 3]);
  };

  Agent.prototype.begin = function () {
    var s = this.world.start;
    this.s = s; this.t = 0; this.done = false;
    this.ret = 0; this.disc = 0; this.discount = 1;
    this.buf = [];
    this.credit = new Float64Array(this.n); // blame per cell, this episode
    this.timeCredit = [];                    // blame per time step, this episode
    this.path = [s];
    this.outcome = null;
    for (var i = 0; i < this.act_.length; i++) { this.E[this.act_[i]] = 0; this.inAct[this.act_[i]] = 0; }
    this.act_ = [];
    this.a = this.algo === 'lambda' ? this.choose(s) : -1;
  };

  Agent.prototype._give = function (idx, t, d) {
    var m = Math.abs(d);
    this.credit[(idx / 4) | 0] += m;
    this.timeCredit[t] += m;
  };

  Agent.prototype.step = function () {
    if (this.done) this.begin();
    var p = this.p, w = this.world, s = this.s, t = this.t;
    var a = this.algo === 'lambda' ? this.a : this.choose(s);
    var res = w.step(s, a, this.rand), s2 = res.s2, r = res.r, done = res.done;
    var idx = s * 4 + a, Q = this.Q, d;
    this.timeCredit.push(0);
    this.ret += r;
    this.disc += this.discount * r;
    this.discount *= p.gamma;

    if (this.algo === 'q') {
      d = p.alpha * (r + (done ? 0 : p.gamma * this.maxQ(s2)) - Q[idx]);
      Q[idx] += d;
      this._give(idx, t, d);
    } else if (this.algo === 'lambda') {
      var a2 = done ? 0 : this.choose(s2);
      var delta = r + (done ? 0 : p.gamma * Q[s2 * 4 + a2]) - Q[idx];
      // replacing traces: clear the other actions at s, set the taken one to 1
      for (var k = 0; k < 4; k++) this.E[s * 4 + k] = 0;
      this.E[idx] = 1; this.lastT[idx] = t;
      if (!this.inAct[idx]) { this.inAct[idx] = 1; this.act_.push(idx); }
      var decay = p.gamma * p.lambda, keep = [];
      for (var j = 0; j < this.act_.length; j++) {
        var i = this.act_[j], e = this.E[i];
        if (e >= 1e-3) {
          d = p.alpha * delta * e;
          Q[i] += d;
          this._give(i, this.lastT[i], d);
          this.E[i] = e * decay;
          keep.push(i);
        } else { this.E[i] = 0; this.inAct[i] = 0; }
      }
      this.act_ = keep;
      this.a = a2;
    } else { // mc: remember, update at the end
      this.buf.push(s, a, r);
    }

    this.t = t + 1;
    this.s = s2;
    this.path.push(s2);
    var end = done || this.t >= p.maxSteps;
    if (end) {
      if (this.algo === 'mc') this._mcUpdate();
      this.done = true;
      this.episode++;
      this.outcome = done ? w.cells[s2] : 'timeout';
    }
    return res;
  };

  Agent.prototype._mcUpdate = function () {
    var p = this.p, G = 0, b = this.buf, Q = this.Q;
    for (var t = b.length / 3 - 1; t >= 0; t--) {
      var s = b[t * 3], a = b[t * 3 + 1], r = b[t * 3 + 2], idx = s * 4 + a;
      G = r + p.gamma * G;
      var d = p.alpha * (G - Q[idx]);
      Q[idx] += d;
      this._give(idx, t, d);
    }
  };

  /* What the agent is currently "holding responsible", per cell, for the live trace overlay. */
  Agent.prototype.liveTrace = function () {
    var out = new Float64Array(this.n);
    if (this.done) return out;
    if (this.algo === 'lambda') {
      for (var j = 0; j < this.act_.length; j++) {
        var i = this.act_[j], c = (i / 4) | 0;
        if (this.E[i] > out[c]) out[c] = this.E[i];
      }
    } else if (this.algo === 'mc') {
      var b = this.buf, T = b.length / 3, g = 1;
      for (var t = T - 1; t >= 0; t--) { var s = b[t * 3]; if (g > out[s]) out[s] = g; g *= this.p.gamma; }
    } else if (this.path.length > 1) {
      out[this.path[this.path.length - 2]] = 1;
    }
    return out;
  };

  Agent.prototype.runEpisode = function () {
    this.begin();
    while (!this.done) this.step();
    return { steps: this.t, ret: this.ret, disc: this.disc, outcome: this.outcome };
  };

  /* ---------------- Maps ---------------- */
  var PRESETS = {
    corridor: {
      name: 'Long corridor',
      episodes: 120,
      rows: [
        '##############',
        '#S..........G#',
        '##############'
      ]
    },
    cliff: {
      name: 'Cliff edge',
      episodes: 250,
      rows: [
        '............',
        '............',
        '............',
        'SXXXXXXXXXXG'
      ]
    },
    decoy: {
      name: 'Coin or goal',
      episodes: 250,
      rows: [
        '.............',
        '.S.c.........',
        '.............',
        '.###########.',
        '.............',
        '............G'
      ]
    },
    maze: {
      name: 'Winding maze',
      episodes: 250,
      rows: [
        'S..#........',
        '.#.#.######.',
        '.#...#......',
        '.#####.####.',
        '......#...#.',
        '.####.#.#.#.',
        '....#...#.#.',
        '###.#####..G'
      ]
    }
  };

  var api = { CELL: CELL, REWARD: REWARD, ALGOS: ALGOS, World: World, Agent: Agent, PRESETS: PRESETS, rng: rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BlameCore = api;
})(typeof window !== 'undefined' ? window : this);
