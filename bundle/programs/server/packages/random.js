(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var charsCount, Random;

var require = meteorInstall({"node_modules":{"meteor":{"random":{"main_server.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/random/main_server.js                                                                //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  Random: () => Random
});
let NodeRandomGenerator;
module.link("./NodeRandomGenerator", {
  default(v) {
    NodeRandomGenerator = v;
  }
}, 0);
let createRandom;
module.link("./createRandom", {
  default(v) {
    createRandom = v;
  }
}, 1);
const Random = createRandom(new NodeRandomGenerator());
///////////////////////////////////////////////////////////////////////////////////////////////////

},"AbstractRandomGenerator.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/random/AbstractRandomGenerator.js                                                    //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  default: () => RandomGenerator
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }
}, 0);
const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const BASE64_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789-_';

// `type` is one of `RandomGenerator.Type` as defined below.
//
// options:
// - seeds: (required, only for RandomGenerator.Type.ALEA) an array
//   whose items will be `toString`ed and used as the seed to the Alea
//   algorithm
class RandomGenerator {
  /**
   * @name Random.fraction
   * @summary Return a number between 0 and 1, like `Math.random`.
   * @locus Anywhere
   */
  fraction() {
    throw new Error("Unknown random generator type");
  }

  /**
   * @name Random.hexString
   * @summary Return a random string of `n` hexadecimal digits.
   * @locus Anywhere
   * @param {Number} n Length of the string
   */
  hexString(digits) {
    return this._randomString(digits, '0123456789abcdef');
  }
  _randomString(charsCount, alphabet) {
    let result = '';
    for (let i = 0; i < charsCount; i++) {
      result += this.choice(alphabet);
    }
    return result;
  }

  /**
   * @name Random.id
   * @summary Return a unique identifier, such as `"Jjwjg6gouWLXhMGKW"`, that is
   * likely to be unique in the whole world.
   * @locus Anywhere
   * @param {Number} [n] Optional length of the identifier in characters
   *   (defaults to 17)
   */
  id(charsCount) {
    // 17 characters is around 96 bits of entropy, which is the amount of
    // state in the Alea PRNG.
    if (charsCount === undefined) {
      charsCount = 17;
    }
    return this._randomString(charsCount, UNMISTAKABLE_CHARS);
  }

  /**
   * @name Random.secret
   * @summary Return a random string of printable characters with 6 bits of
   * entropy per character. Use `Random.secret` for security-critical secrets
   * that are intended for machine, rather than human, consumption.
   * @locus Anywhere
   * @param {Number} [n] Optional length of the secret string (defaults to 43
   *   characters, or 256 bits of entropy)
   */
  secret(charsCount) {
    // Default to 256 bits of entropy, or 43 characters at 6 bits per
    // character.
    if (charsCount === undefined) {
      charsCount = 43;
    }
    return this._randomString(charsCount, BASE64_CHARS);
  }

  /**
   * @name Random.choice
   * @summary Return a random element of the given array or string.
   * @locus Anywhere
   * @param {Array|String} arrayOrString Array or string to choose from
   */
  choice(arrayOrString) {
    const index = Math.floor(this.fraction() * arrayOrString.length);
    if (typeof arrayOrString === 'string') {
      return arrayOrString.substr(index, 1);
    }
    return arrayOrString[index];
  }
}
///////////////////////////////////////////////////////////////////////////////////////////////////

},"AleaRandomGenerator.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/random/AleaRandomGenerator.js                                                        //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  default: () => AleaRandomGenerator
});
let RandomGenerator;
module.link("./AbstractRandomGenerator", {
  default(v) {
    RandomGenerator = v;
  }
}, 0);
// Alea PRNG, which is not cryptographically strong
// see http://baagoe.org/en/wiki/Better_random_numbers_for_javascript
// for a full discussion and Alea implementation.
function Alea(seeds) {
  function Mash() {
    let n = 0xefc8249d;
    const mash = data => {
      data = data.toString();
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }

      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };

    mash.version = 'Mash 0.9';
    return mash;
  }
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let c = 1;
  if (seeds.length === 0) {
    seeds = [+new Date()];
  }
  let mash = Mash();
  s0 = mash(' ');
  s1 = mash(' ');
  s2 = mash(' ');
  for (let i = 0; i < seeds.length; i++) {
    s0 -= mash(seeds[i]);
    if (s0 < 0) {
      s0 += 1;
    }
    s1 -= mash(seeds[i]);
    if (s1 < 0) {
      s1 += 1;
    }
    s2 -= mash(seeds[i]);
    if (s2 < 0) {
      s2 += 1;
    }
  }
  mash = null;
  const random = () => {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
    s0 = s1;
    s1 = s2;
    return s2 = t - (c = t | 0);
  };
  random.uint32 = () => random() * 0x100000000; // 2^32
  random.fract53 = () => random() + (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53

  random.version = 'Alea 0.9';
  random.args = seeds;
  return random;
}

// options:
// - seeds: an array
//   whose items will be `toString`ed and used as the seed to the Alea
//   algorithm
class AleaRandomGenerator extends RandomGenerator {
  constructor() {
    let {
      seeds = []
    } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    super();
    if (!seeds) {
      throw new Error('No seeds were provided for Alea PRNG');
    }
    this.alea = Alea(seeds);
  }

  /**
   * @name Random.fraction
   * @summary Return a number between 0 and 1, like `Math.random`.
   * @locus Anywhere
   */
  fraction() {
    return this.alea();
  }
}
///////////////////////////////////////////////////////////////////////////////////////////////////

},"NodeRandomGenerator.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/random/NodeRandomGenerator.js                                                        //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  default: () => NodeRandomGenerator
});
let crypto;
module.link("crypto", {
  default(v) {
    crypto = v;
  }
}, 0);
let RandomGenerator;
module.link("./AbstractRandomGenerator", {
  default(v) {
    RandomGenerator = v;
  }
}, 1);
class NodeRandomGenerator extends RandomGenerator {
  /**
   * @name Random.fraction
   * @summary Return a number between 0 and 1, like `Math.random`.
   * @locus Anywhere
   */
  fraction() {
    const numerator = Number.parseInt(this.hexString(8), 16);
    return numerator * 2.3283064365386963e-10; // 2^-3;
  }

  /**
   * @name Random.hexString
   * @summary Return a random string of `n` hexadecimal digits.
   * @locus Anywhere
   * @param {Number} n Length of the string
   */
  hexString(digits) {
    const numBytes = Math.ceil(digits / 2);
    let bytes;
    // Try to get cryptographically strong randomness. Fall back to
    // non-cryptographically strong if not available.
    try {
      bytes = crypto.randomBytes(numBytes);
    } catch (e) {
      // XXX should re-throw any error except insufficient entropy
      bytes = crypto.pseudoRandomBytes(numBytes);
    }
    const result = bytes.toString('hex');
    // If the number of digits is odd, we'll have generated an extra 4 bits
    // of randomness, so we need to trim the last digit.
    return result.substring(0, digits);
  }
}
///////////////////////////////////////////////////////////////////////////////////////////////////

},"createAleaGenerator.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/random/createAleaGenerator.js                                                        //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  default: () => createAleaGenerator
});
let AleaRandomGenerator;
module.link("./AleaRandomGenerator", {
  default(v) {
    AleaRandomGenerator = v;
  }
}, 0);
// instantiate RNG.  Heuristically collect entropy from various sources when a
// cryptographic PRNG isn't available.

// client sources
const height = typeof window !== 'undefined' && window.innerHeight || typeof document !== 'undefined' && document.documentElement && document.documentElement.clientHeight || typeof document !== 'undefined' && document.body && document.body.clientHeight || 1;
const width = typeof window !== 'undefined' && window.innerWidth || typeof document !== 'undefined' && document.documentElement && document.documentElement.clientWidth || typeof document !== 'undefined' && document.body && document.body.clientWidth || 1;
const agent = typeof navigator !== 'undefined' && navigator.userAgent || '';
function createAleaGenerator() {
  return new AleaRandomGenerator({
    seeds: [new Date(), height, width, agent, Math.random()]
  });
}
///////////////////////////////////////////////////////////////////////////////////////////////////

},"createRandom.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/random/createRandom.js                                                               //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  default: () => createRandom
});
let AleaRandomGenerator;
module.link("./AleaRandomGenerator", {
  default(v) {
    AleaRandomGenerator = v;
  }
}, 0);
let createAleaGeneratorWithGeneratedSeed;
module.link("./createAleaGenerator", {
  default(v) {
    createAleaGeneratorWithGeneratedSeed = v;
  }
}, 1);
function createRandom(generator) {
  // Create a non-cryptographically secure PRNG with a given seed (using
  // the Alea algorithm)
  generator.createWithSeeds = function () {
    for (var _len = arguments.length, seeds = new Array(_len), _key = 0; _key < _len; _key++) {
      seeds[_key] = arguments[_key];
    }
    if (seeds.length === 0) {
      throw new Error('No seeds were provided');
    }
    return new AleaRandomGenerator({
      seeds
    });
  };

  // Used like `Random`, but much faster and not cryptographically
  // secure
  generator.insecure = createAleaGeneratorWithGeneratedSeed();
  return generator;
}
///////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/random/main_server.js");

/* Exports */
Package._define("random", exports, {
  Random: Random
});

})();

//# sourceURL=meteor://💻app/packages/random.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcmFuZG9tL21haW5fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yYW5kb20vQWJzdHJhY3RSYW5kb21HZW5lcmF0b3IuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JhbmRvbS9BbGVhUmFuZG9tR2VuZXJhdG9yLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9yYW5kb20vTm9kZVJhbmRvbUdlbmVyYXRvci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcmFuZG9tL2NyZWF0ZUFsZWFHZW5lcmF0b3IuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JhbmRvbS9jcmVhdGVSYW5kb20uanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiUmFuZG9tIiwiTm9kZVJhbmRvbUdlbmVyYXRvciIsImxpbmsiLCJkZWZhdWx0IiwidiIsImNyZWF0ZVJhbmRvbSIsIlJhbmRvbUdlbmVyYXRvciIsIk1ldGVvciIsIlVOTUlTVEFLQUJMRV9DSEFSUyIsIkJBU0U2NF9DSEFSUyIsImZyYWN0aW9uIiwiRXJyb3IiLCJoZXhTdHJpbmciLCJkaWdpdHMiLCJfcmFuZG9tU3RyaW5nIiwiY2hhcnNDb3VudCIsImFscGhhYmV0IiwicmVzdWx0IiwiaSIsImNob2ljZSIsImlkIiwidW5kZWZpbmVkIiwic2VjcmV0IiwiYXJyYXlPclN0cmluZyIsImluZGV4IiwiTWF0aCIsImZsb29yIiwibGVuZ3RoIiwic3Vic3RyIiwiQWxlYVJhbmRvbUdlbmVyYXRvciIsIkFsZWEiLCJzZWVkcyIsIk1hc2giLCJuIiwibWFzaCIsImRhdGEiLCJ0b1N0cmluZyIsImNoYXJDb2RlQXQiLCJoIiwidmVyc2lvbiIsInMwIiwiczEiLCJzMiIsImMiLCJEYXRlIiwicmFuZG9tIiwidCIsInVpbnQzMiIsImZyYWN0NTMiLCJhcmdzIiwiY29uc3RydWN0b3IiLCJhbGVhIiwiY3J5cHRvIiwibnVtZXJhdG9yIiwiTnVtYmVyIiwicGFyc2VJbnQiLCJudW1CeXRlcyIsImNlaWwiLCJieXRlcyIsInJhbmRvbUJ5dGVzIiwiZSIsInBzZXVkb1JhbmRvbUJ5dGVzIiwic3Vic3RyaW5nIiwiY3JlYXRlQWxlYUdlbmVyYXRvciIsImhlaWdodCIsIndpbmRvdyIsImlubmVySGVpZ2h0IiwiZG9jdW1lbnQiLCJkb2N1bWVudEVsZW1lbnQiLCJjbGllbnRIZWlnaHQiLCJib2R5Iiwid2lkdGgiLCJpbm5lcldpZHRoIiwiY2xpZW50V2lkdGgiLCJhZ2VudCIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImNyZWF0ZUFsZWFHZW5lcmF0b3JXaXRoR2VuZXJhdGVkU2VlZCIsImdlbmVyYXRvciIsImNyZWF0ZVdpdGhTZWVkcyIsImluc2VjdXJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0MsTUFBTSxFQUFDLE1BQUlBO0FBQU0sQ0FBQyxDQUFDO0FBQUMsSUFBSUMsbUJBQW1CO0FBQUNILE1BQU0sQ0FBQ0ksSUFBSSxDQUFDLHVCQUF1QixFQUFDO0VBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO0lBQUNILG1CQUFtQixHQUFDRyxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQUMsSUFBSUMsWUFBWTtBQUFDUCxNQUFNLENBQUNJLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztFQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztJQUFDQyxZQUFZLEdBQUNELENBQUM7RUFBQTtBQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7QUFPNU0sTUFBTUosTUFBTSxHQUFHSyxZQUFZLENBQUMsSUFBSUosbUJBQW1CLEVBQUUsQ0FBQyxDOzs7Ozs7Ozs7OztBQ1A3REgsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0ksT0FBTyxFQUFDLE1BQUlHO0FBQWUsQ0FBQyxDQUFDO0FBQUMsSUFBSUMsTUFBTTtBQUFDVCxNQUFNLENBQUNJLElBQUks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QUFFO01BQ3RCLE1BQU0sSUFBSWhCLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQztJQUMzQztJQUNBLE9BQU8sSUFBSWtCLG1CQUFtQixDQUFDO01BQUVFO0lBQU0sQ0FBQyxDQUFDO0VBQzNDLENBQUM7O0VBRUQ7RUFDQTtFQUNBK0MsU0FBUyxDQUFDRSxRQUFRLEdBQUdILG9DQUFvQyxFQUFFO0VBRTNELE9BQU9DLFNBQVM7QUFDbEIsQyIsImZpbGUiOiIvcGFja2FnZXMvcmFuZG9tLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gV2UgdXNlIGNyeXB0b2dyYXBoaWNhbGx5IHN0cm9uZyBQUk5HcyAoY3J5cHRvLmdldFJhbmRvbUJ5dGVzKCkpXG4vLyBXaGVuIHVzaW5nIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMoKSwgb3VyIHByaW1pdGl2ZSBpcyBoZXhTdHJpbmcoKSxcbi8vIGZyb20gd2hpY2ggd2UgY29uc3RydWN0IGZyYWN0aW9uKCkuXG5cbmltcG9ydCBOb2RlUmFuZG9tR2VuZXJhdG9yIGZyb20gJy4vTm9kZVJhbmRvbUdlbmVyYXRvcic7XG5pbXBvcnQgY3JlYXRlUmFuZG9tIGZyb20gJy4vY3JlYXRlUmFuZG9tJztcblxuZXhwb3J0IGNvbnN0IFJhbmRvbSA9IGNyZWF0ZVJhbmRvbShuZXcgTm9kZVJhbmRvbUdlbmVyYXRvcigpKTtcbiIsIi8vIFdlIHVzZSBjcnlwdG9ncmFwaGljYWxseSBzdHJvbmcgUFJOR3MgKGNyeXB0by5nZXRSYW5kb21CeXRlcygpIG9uIHRoZSBzZXJ2ZXIsXG4vLyB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcygpIGluIHRoZSBicm93c2VyKSB3aGVuIGF2YWlsYWJsZS4gSWYgdGhlc2Vcbi8vIFBSTkdzIGZhaWwsIHdlIGZhbGwgYmFjayB0byB0aGUgQWxlYSBQUk5HLCB3aGljaCBpcyBub3QgY3J5cHRvZ3JhcGhpY2FsbHlcbi8vIHN0cm9uZywgYW5kIHdlIHNlZWQgaXQgd2l0aCB2YXJpb3VzIHNvdXJjZXMgc3VjaCBhcyB0aGUgZGF0ZSwgTWF0aC5yYW5kb20sXG4vLyBhbmQgd2luZG93IHNpemUgb24gdGhlIGNsaWVudC4gIFdoZW4gdXNpbmcgY3J5cHRvLmdldFJhbmRvbVZhbHVlcygpLCBvdXJcbi8vIHByaW1pdGl2ZSBpcyBoZXhTdHJpbmcoKSwgZnJvbSB3aGljaCB3ZSBjb25zdHJ1Y3QgZnJhY3Rpb24oKS4gV2hlbiB1c2luZ1xuLy8gd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXMoKSBvciBhbGVhLCB0aGUgcHJpbWl0aXZlIGlzIGZyYWN0aW9uIGFuZCB3ZSB1c2Vcbi8vIHRoYXQgdG8gY29uc3RydWN0IGhleCBzdHJpbmcuXG5cbmltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuXG5jb25zdCBVTk1JU1RBS0FCTEVfQ0hBUlMgPSAnMjM0NTY3ODlBQkNERUZHSEpLTE1OUFFSU1RXWFlaYWJjZGVmZ2hpamttbm9wcXJzdHV2d3h5eic7XG5jb25zdCBCQVNFNjRfQ0hBUlMgPSAnYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWicgK1xuICAnMDEyMzQ1Njc4OS1fJztcblxuLy8gYHR5cGVgIGlzIG9uZSBvZiBgUmFuZG9tR2VuZXJhdG9yLlR5cGVgIGFzIGRlZmluZWQgYmVsb3cuXG4vL1xuLy8gb3B0aW9uczpcbi8vIC0gc2VlZHM6IChyZXF1aXJlZCwgb25seSBmb3IgUmFuZG9tR2VuZXJhdG9yLlR5cGUuQUxFQSkgYW4gYXJyYXlcbi8vICAgd2hvc2UgaXRlbXMgd2lsbCBiZSBgdG9TdHJpbmdgZWQgYW5kIHVzZWQgYXMgdGhlIHNlZWQgdG8gdGhlIEFsZWFcbi8vICAgYWxnb3JpdGhtXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSYW5kb21HZW5lcmF0b3Ige1xuXG4gIC8qKlxuICAgKiBAbmFtZSBSYW5kb20uZnJhY3Rpb25cbiAgICogQHN1bW1hcnkgUmV0dXJuIGEgbnVtYmVyIGJldHdlZW4gMCBhbmQgMSwgbGlrZSBgTWF0aC5yYW5kb21gLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICovXG4gIGZyYWN0aW9uICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcmFuZG9tIGdlbmVyYXRvciB0eXBlYCk7XG4gIH1cblxuICAvKipcbiAgICogQG5hbWUgUmFuZG9tLmhleFN0cmluZ1xuICAgKiBAc3VtbWFyeSBSZXR1cm4gYSByYW5kb20gc3RyaW5nIG9mIGBuYCBoZXhhZGVjaW1hbCBkaWdpdHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge051bWJlcn0gbiBMZW5ndGggb2YgdGhlIHN0cmluZ1xuICAgKi9cbiAgaGV4U3RyaW5nIChkaWdpdHMpIHtcbiAgICByZXR1cm4gdGhpcy5fcmFuZG9tU3RyaW5nKGRpZ2l0cywgJzAxMjM0NTY3ODlhYmNkZWYnKTtcbiAgfVxuXG4gIF9yYW5kb21TdHJpbmcgKGNoYXJzQ291bnQsIGFscGhhYmV0KSB7XG4gICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hhcnNDb3VudDsgaSsrKSB7XHRcbiAgICAgIHJlc3VsdCArPSB0aGlzLmNob2ljZShhbHBoYWJldCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQG5hbWUgUmFuZG9tLmlkXG4gICAqIEBzdW1tYXJ5IFJldHVybiBhIHVuaXF1ZSBpZGVudGlmaWVyLCBzdWNoIGFzIGBcIkpqd2pnNmdvdVdMWGhNR0tXXCJgLCB0aGF0IGlzXG4gICAqIGxpa2VseSB0byBiZSB1bmlxdWUgaW4gdGhlIHdob2xlIHdvcmxkLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtOdW1iZXJ9IFtuXSBPcHRpb25hbCBsZW5ndGggb2YgdGhlIGlkZW50aWZpZXIgaW4gY2hhcmFjdGVyc1xuICAgKiAgIChkZWZhdWx0cyB0byAxNylcbiAgICovXG4gIGlkIChjaGFyc0NvdW50KSB7XG4gICAgLy8gMTcgY2hhcmFjdGVycyBpcyBhcm91bmQgOTYgYml0cyBvZiBlbnRyb3B5LCB3aGljaCBpcyB0aGUgYW1vdW50IG9mXG4gICAgLy8gc3RhdGUgaW4gdGhlIEFsZWEgUFJORy5cbiAgICBpZiAoY2hhcnNDb3VudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjaGFyc0NvdW50ID0gMTc7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3JhbmRvbVN0cmluZyhjaGFyc0NvdW50LCBVTk1JU1RBS0FCTEVfQ0hBUlMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBuYW1lIFJhbmRvbS5zZWNyZXRcbiAgICogQHN1bW1hcnkgUmV0dXJuIGEgcmFuZG9tIHN0cmluZyBvZiBwcmludGFibGUgY2hhcmFjdGVycyB3aXRoIDYgYml0cyBvZlxuICAgKiBlbnRyb3B5IHBlciBjaGFyYWN0ZXIuIFVzZSBgUmFuZG9tLnNlY3JldGAgZm9yIHNlY3VyaXR5LWNyaXRpY2FsIHNlY3JldHNcbiAgICogdGhhdCBhcmUgaW50ZW5kZWQgZm9yIG1hY2hpbmUsIHJhdGhlciB0aGFuIGh1bWFuLCBjb25zdW1wdGlvbi5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBbbl0gT3B0aW9uYWwgbGVuZ3RoIG9mIHRoZSBzZWNyZXQgc3RyaW5nIChkZWZhdWx0cyB0byA0M1xuICAgKiAgIGNoYXJhY3RlcnMsIG9yIDI1NiBiaXRzIG9mIGVudHJvcHkpXG4gICAqL1xuICBzZWNyZXQgKGNoYXJzQ291bnQpIHtcbiAgICAvLyBEZWZhdWx0IHRvIDI1NiBiaXRzIG9mIGVudHJvcHksIG9yIDQzIGNoYXJhY3RlcnMgYXQgNiBiaXRzIHBlclxuICAgIC8vIGNoYXJhY3Rlci5cbiAgICBpZiAoY2hhcnNDb3VudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjaGFyc0NvdW50ID0gNDM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3JhbmRvbVN0cmluZyhjaGFyc0NvdW50LCBCQVNFNjRfQ0hBUlMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBuYW1lIFJhbmRvbS5jaG9pY2VcbiAgICogQHN1bW1hcnkgUmV0dXJuIGEgcmFuZG9tIGVsZW1lbnQgb2YgdGhlIGdpdmVuIGFycmF5IG9yIHN0cmluZy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7QXJyYXl8U3RyaW5nfSBhcnJheU9yU3RyaW5nIEFycmF5IG9yIHN0cmluZyB0byBjaG9vc2UgZnJvbVxuICAgKi9cbiAgY2hvaWNlIChhcnJheU9yU3RyaW5nKSB7XG4gICAgY29uc3QgaW5kZXggPSBNYXRoLmZsb29yKHRoaXMuZnJhY3Rpb24oKSAqIGFycmF5T3JTdHJpbmcubGVuZ3RoKTtcbiAgICBpZiAodHlwZW9mIGFycmF5T3JTdHJpbmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gYXJyYXlPclN0cmluZy5zdWJzdHIoaW5kZXgsIDEpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXlPclN0cmluZ1tpbmRleF07XG4gIH1cbn1cbiIsImltcG9ydCBSYW5kb21HZW5lcmF0b3IgZnJvbSAnLi9BYnN0cmFjdFJhbmRvbUdlbmVyYXRvcic7XG5cbi8vIEFsZWEgUFJORywgd2hpY2ggaXMgbm90IGNyeXB0b2dyYXBoaWNhbGx5IHN0cm9uZ1xuLy8gc2VlIGh0dHA6Ly9iYWFnb2Uub3JnL2VuL3dpa2kvQmV0dGVyX3JhbmRvbV9udW1iZXJzX2Zvcl9qYXZhc2NyaXB0XG4vLyBmb3IgYSBmdWxsIGRpc2N1c3Npb24gYW5kIEFsZWEgaW1wbGVtZW50YXRpb24uXG5mdW5jdGlvbiBBbGVhKHNlZWRzKSB7XG4gIGZ1bmN0aW9uIE1hc2goKSB7XG4gICAgbGV0IG4gPSAweGVmYzgyNDlkO1xuXG4gICAgY29uc3QgbWFzaCA9IChkYXRhKSA9PiB7XG4gICAgICBkYXRhID0gZGF0YS50b1N0cmluZygpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG4gKz0gZGF0YS5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBsZXQgaCA9IDAuMDI1MTk2MDMyODI0MTY5MzggKiBuO1xuICAgICAgICBuID0gaCA+Pj4gMDtcbiAgICAgICAgaCAtPSBuO1xuICAgICAgICBoICo9IG47XG4gICAgICAgIG4gPSBoID4+PiAwO1xuICAgICAgICBoIC09IG47XG4gICAgICAgIG4gKz0gaCAqIDB4MTAwMDAwMDAwOyAvLyAyXjMyXG4gICAgICB9XG4gICAgICByZXR1cm4gKG4gPj4+IDApICogMi4zMjgzMDY0MzY1Mzg2OTYzZS0xMDsgLy8gMl4tMzJcbiAgICB9O1xuXG4gICAgbWFzaC52ZXJzaW9uID0gJ01hc2ggMC45JztcbiAgICByZXR1cm4gbWFzaDtcbiAgfVxuXG4gIGxldCBzMCA9IDA7XG4gIGxldCBzMSA9IDA7XG4gIGxldCBzMiA9IDA7XG4gIGxldCBjID0gMTtcbiAgaWYgKHNlZWRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHNlZWRzID0gWytuZXcgRGF0ZV07XG4gIH1cbiAgbGV0IG1hc2ggPSBNYXNoKCk7XG4gIHMwID0gbWFzaCgnICcpO1xuICBzMSA9IG1hc2goJyAnKTtcbiAgczIgPSBtYXNoKCcgJyk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWVkcy5sZW5ndGg7IGkrKykge1xuICAgIHMwIC09IG1hc2goc2VlZHNbaV0pO1xuICAgIGlmIChzMCA8IDApIHtcbiAgICAgIHMwICs9IDE7XG4gICAgfVxuICAgIHMxIC09IG1hc2goc2VlZHNbaV0pO1xuICAgIGlmIChzMSA8IDApIHtcbiAgICAgIHMxICs9IDE7XG4gICAgfVxuICAgIHMyIC09IG1hc2goc2VlZHNbaV0pO1xuICAgIGlmIChzMiA8IDApIHtcbiAgICAgIHMyICs9IDE7XG4gICAgfVxuICB9XG4gIG1hc2ggPSBudWxsO1xuXG4gIGNvbnN0IHJhbmRvbSA9ICgpID0+IHtcbiAgICBjb25zdCB0ID0gKDIwOTE2MzkgKiBzMCkgKyAoYyAqIDIuMzI4MzA2NDM2NTM4Njk2M2UtMTApOyAvLyAyXi0zMlxuICAgIHMwID0gczE7XG4gICAgczEgPSBzMjtcbiAgICByZXR1cm4gczIgPSB0IC0gKGMgPSB0IHwgMCk7XG4gIH07XG5cbiAgcmFuZG9tLnVpbnQzMiA9ICgpID0+IHJhbmRvbSgpICogMHgxMDAwMDAwMDA7IC8vIDJeMzJcbiAgcmFuZG9tLmZyYWN0NTMgPSAoKSA9PiByYW5kb20oKSArXG4gICAgICAgICgocmFuZG9tKCkgKiAweDIwMDAwMCB8IDApICogMS4xMTAyMjMwMjQ2MjUxNTY1ZS0xNik7IC8vIDJeLTUzXG5cbiAgcmFuZG9tLnZlcnNpb24gPSAnQWxlYSAwLjknO1xuICByYW5kb20uYXJncyA9IHNlZWRzO1xuICByZXR1cm4gcmFuZG9tO1xufVxuXG4vLyBvcHRpb25zOlxuLy8gLSBzZWVkczogYW4gYXJyYXlcbi8vICAgd2hvc2UgaXRlbXMgd2lsbCBiZSBgdG9TdHJpbmdgZWQgYW5kIHVzZWQgYXMgdGhlIHNlZWQgdG8gdGhlIEFsZWFcbi8vICAgYWxnb3JpdGhtXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBbGVhUmFuZG9tR2VuZXJhdG9yIGV4dGVuZHMgUmFuZG9tR2VuZXJhdG9yIHtcbiAgY29uc3RydWN0b3IgKHsgc2VlZHMgPSBbXSB9ID0ge30pIHtcbiAgICBzdXBlcigpO1xuICAgIGlmICghc2VlZHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gc2VlZHMgd2VyZSBwcm92aWRlZCBmb3IgQWxlYSBQUk5HJyk7XG4gICAgfVxuICAgIHRoaXMuYWxlYSA9IEFsZWEoc2VlZHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBuYW1lIFJhbmRvbS5mcmFjdGlvblxuICAgKiBAc3VtbWFyeSBSZXR1cm4gYSBudW1iZXIgYmV0d2VlbiAwIGFuZCAxLCBsaWtlIGBNYXRoLnJhbmRvbWAuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKi9cbiAgZnJhY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmFsZWEoKTtcbiAgfVxufVxuIiwiaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IFJhbmRvbUdlbmVyYXRvciBmcm9tICcuL0Fic3RyYWN0UmFuZG9tR2VuZXJhdG9yJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTm9kZVJhbmRvbUdlbmVyYXRvciBleHRlbmRzIFJhbmRvbUdlbmVyYXRvciB7XG4gIC8qKlxuICAgKiBAbmFtZSBSYW5kb20uZnJhY3Rpb25cbiAgICogQHN1bW1hcnkgUmV0dXJuIGEgbnVtYmVyIGJldHdlZW4gMCBhbmQgMSwgbGlrZSBgTWF0aC5yYW5kb21gLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICovXG4gIGZyYWN0aW9uICgpIHtcbiAgICBjb25zdCBudW1lcmF0b3IgPSBOdW1iZXIucGFyc2VJbnQodGhpcy5oZXhTdHJpbmcoOCksIDE2KTtcbiAgICByZXR1cm4gbnVtZXJhdG9yICogMi4zMjgzMDY0MzY1Mzg2OTYzZS0xMDsgLy8gMl4tMztcbiAgfVxuXG4gIC8qKlxuICAgKiBAbmFtZSBSYW5kb20uaGV4U3RyaW5nXG4gICAqIEBzdW1tYXJ5IFJldHVybiBhIHJhbmRvbSBzdHJpbmcgb2YgYG5gIGhleGFkZWNpbWFsIGRpZ2l0cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBuIExlbmd0aCBvZiB0aGUgc3RyaW5nXG4gICAqL1xuICBoZXhTdHJpbmcgKGRpZ2l0cykge1xuICAgIGNvbnN0IG51bUJ5dGVzID0gTWF0aC5jZWlsKGRpZ2l0cyAvIDIpO1xuICAgIGxldCBieXRlcztcbiAgICAvLyBUcnkgdG8gZ2V0IGNyeXB0b2dyYXBoaWNhbGx5IHN0cm9uZyByYW5kb21uZXNzLiBGYWxsIGJhY2sgdG9cbiAgICAvLyBub24tY3J5cHRvZ3JhcGhpY2FsbHkgc3Ryb25nIGlmIG5vdCBhdmFpbGFibGUuXG4gICAgdHJ5IHtcbiAgICAgIGJ5dGVzID0gY3J5cHRvLnJhbmRvbUJ5dGVzKG51bUJ5dGVzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBYWFggc2hvdWxkIHJlLXRocm93IGFueSBlcnJvciBleGNlcHQgaW5zdWZmaWNpZW50IGVudHJvcHlcbiAgICAgIGJ5dGVzID0gY3J5cHRvLnBzZXVkb1JhbmRvbUJ5dGVzKG51bUJ5dGVzKTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gYnl0ZXMudG9TdHJpbmcoJ2hleCcpO1xuICAgIC8vIElmIHRoZSBudW1iZXIgb2YgZGlnaXRzIGlzIG9kZCwgd2UnbGwgaGF2ZSBnZW5lcmF0ZWQgYW4gZXh0cmEgNCBiaXRzXG4gICAgLy8gb2YgcmFuZG9tbmVzcywgc28gd2UgbmVlZCB0byB0cmltIHRoZSBsYXN0IGRpZ2l0LlxuICAgIHJldHVybiByZXN1bHQuc3Vic3RyaW5nKDAsIGRpZ2l0cyk7XG4gIH1cbn1cbiIsImltcG9ydCBBbGVhUmFuZG9tR2VuZXJhdG9yIGZyb20gJy4vQWxlYVJhbmRvbUdlbmVyYXRvcic7XG5cbi8vIGluc3RhbnRpYXRlIFJORy4gIEhldXJpc3RpY2FsbHkgY29sbGVjdCBlbnRyb3B5IGZyb20gdmFyaW91cyBzb3VyY2VzIHdoZW4gYVxuLy8gY3J5cHRvZ3JhcGhpYyBQUk5HIGlzbid0IGF2YWlsYWJsZS5cblxuLy8gY2xpZW50IHNvdXJjZXNcbmNvbnN0IGhlaWdodCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuaW5uZXJIZWlnaHQpIHx8XG4gICAgICAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICAgICAgICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpIHx8XG4gICAgICAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICYmIGRvY3VtZW50LmJvZHlcbiAgICAgICAmJiBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodCkgfHxcbiAgICAgIDE7XG5cbmNvbnN0IHdpZHRoID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5pbm5lcldpZHRoKSB8fFxuICAgICAgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcbiAgICAgICAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGgpIHx8XG4gICAgICAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICYmIGRvY3VtZW50LmJvZHlcbiAgICAgICAmJiBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoKSB8fFxuICAgICAgMTtcblxuY29uc3QgYWdlbnQgPSAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCkgfHwgJyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNyZWF0ZUFsZWFHZW5lcmF0b3IoKSB7XG4gIHJldHVybiBuZXcgQWxlYVJhbmRvbUdlbmVyYXRvcih7XG4gICAgc2VlZHM6IFtuZXcgRGF0ZSwgaGVpZ2h0LCB3aWR0aCwgYWdlbnQsIE1hdGgucmFuZG9tKCldLFxuICB9KTtcbn1cbiIsImltcG9ydCBBbGVhUmFuZG9tR2VuZXJhdG9yIGZyb20gJy4vQWxlYVJhbmRvbUdlbmVyYXRvcidcbmltcG9ydCBjcmVhdGVBbGVhR2VuZXJhdG9yV2l0aEdlbmVyYXRlZFNlZWQgZnJvbSAnLi9jcmVhdGVBbGVhR2VuZXJhdG9yJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY3JlYXRlUmFuZG9tKGdlbmVyYXRvcikge1xuICAvLyBDcmVhdGUgYSBub24tY3J5cHRvZ3JhcGhpY2FsbHkgc2VjdXJlIFBSTkcgd2l0aCBhIGdpdmVuIHNlZWQgKHVzaW5nXG4gIC8vIHRoZSBBbGVhIGFsZ29yaXRobSlcbiAgZ2VuZXJhdG9yLmNyZWF0ZVdpdGhTZWVkcyA9ICguLi5zZWVkcykgPT4ge1xuICAgIGlmIChzZWVkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gc2VlZHMgd2VyZSBwcm92aWRlZCcpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEFsZWFSYW5kb21HZW5lcmF0b3IoeyBzZWVkcyB9KTtcbiAgfTtcblxuICAvLyBVc2VkIGxpa2UgYFJhbmRvbWAsIGJ1dCBtdWNoIGZhc3RlciBhbmQgbm90IGNyeXB0b2dyYXBoaWNhbGx5XG4gIC8vIHNlY3VyZVxuICBnZW5lcmF0b3IuaW5zZWN1cmUgPSBjcmVhdGVBbGVhR2VuZXJhdG9yV2l0aEdlbmVyYXRlZFNlZWQoKTtcblxuICByZXR1cm4gZ2VuZXJhdG9yO1xufVxuIl19
