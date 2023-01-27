(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var check, Match;

var require = meteorInstall({"node_modules":{"meteor":{"check":{"match.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/check/match.js                                                                                       //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
module.export({
  check: () => check,
  Match: () => Match
});
let isPlainObject;
module.link("./isPlainObject", {
  isPlainObject(v) {
    isPlainObject = v;
  }
}, 0);
// Things we explicitly do NOT support:
//    - heterogenous arrays

const currentArgumentChecker = new Meteor.EnvironmentVariable();
const hasOwn = Object.prototype.hasOwnProperty;

/**
 * @summary Check that a value matches a [pattern](#matchpatterns).
 * If the value does not match the pattern, throw a `Match.Error`.
 *
 * Particularly useful to assert that arguments to a function have the right
 * types and structure.
 * @locus Anywhere
 * @param {Any} value The value to check
 * @param {MatchPattern} pattern The pattern to match `value` against
 */
function check(value, pattern) {
  // Record that check got called, if somebody cared.
  //
  // We use getOrNullIfOutsideFiber so that it's OK to call check()
  // from non-Fiber server contexts; the downside is that if you forget to
  // bindEnvironment on some random callback in your method/publisher,
  // it might not find the argumentChecker and you'll get an error about
  // not checking an argument that it looks like you're checking (instead
  // of just getting a "Node code must run in a Fiber" error).
  const argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
  if (argChecker) {
    argChecker.checking(value);
  }
  const result = testSubtree(value, pattern);
  if (result) {
    const err = new Match.Error(result.message);
    if (result.path) {
      err.message += " in field ".concat(result.path);
      err.path = result.path;
    }
    throw err;
  }
}
;

/**
 * @namespace Match
 * @summary The namespace for all Match types and methods.
 */
const Match = {
  Optional: function (pattern) {
    return new Optional(pattern);
  },
  Maybe: function (pattern) {
    return new Maybe(pattern);
  },
  OneOf: function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return new OneOf(args);
  },
  Any: ['__any__'],
  Where: function (condition) {
    return new Where(condition);
  },
  ObjectIncluding: function (pattern) {
    return new ObjectIncluding(pattern);
  },
  ObjectWithValues: function (pattern) {
    return new ObjectWithValues(pattern);
  },
  // Matches only signed 32-bit integers
  Integer: ['__integer__'],
  // XXX matchers should know how to describe themselves for errors
  Error: Meteor.makeErrorType('Match.Error', function (msg) {
    this.message = "Match error: ".concat(msg);

    // The path of the value that failed to match. Initially empty, this gets
    // populated by catching and rethrowing the exception as it goes back up the
    // stack.
    // E.g.: "vals[3].entity.created"
    this.path = '';

    // If this gets sent over DDP, don't give full internal details but at least
    // provide something better than 500 Internal server error.
    this.sanitizedError = new Meteor.Error(400, 'Match failed');
  }),
  // Tests to see if value matches pattern. Unlike check, it merely returns true
  // or false (unless an error other than Match.Error was thrown). It does not
  // interact with _failIfArgumentsAreNotAllChecked.
  // XXX maybe also implement a Match.match which returns more information about
  //     failures but without using exception handling or doing what check()
  //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion

  /**
   * @summary Returns true if the value matches the pattern.
   * @locus Anywhere
   * @param {Any} value The value to check
   * @param {MatchPattern} pattern The pattern to match `value` against
   */
  test(value, pattern) {
    return !testSubtree(value, pattern);
  },
  // Runs `f.apply(context, args)`. If check() is not called on every element of
  // `args` (either directly or in the first level of an array), throws an error
  // (using `description` in the message).
  _failIfArgumentsAreNotAllChecked(f, context, args, description) {
    const argChecker = new ArgumentChecker(args, description);
    const result = currentArgumentChecker.withValue(argChecker, () => f.apply(context, args));

    // If f didn't itself throw, make sure it checked all of its arguments.
    argChecker.throwUnlessAllArgumentsHaveBeenChecked();
    return result;
  }
};
class Optional {
  constructor(pattern) {
    this.pattern = pattern;
  }
}
class Maybe {
  constructor(pattern) {
    this.pattern = pattern;
  }
}
class OneOf {
  constructor(choices) {
    if (!choices || choices.length === 0) {
      throw new Error('Must provide at least one choice to Match.OneOf');
    }
    this.choices = choices;
  }
}
class Where {
  constructor(condition) {
    this.condition = condition;
  }
}
class ObjectIncluding {
  constructor(pattern) {
    this.pattern = pattern;
  }
}
class ObjectWithValues {
  constructor(pattern) {
    this.pattern = pattern;
  }
}
const stringForErrorMessage = function (value) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (value === null) {
    return 'null';
  }
  if (options.onlyShowType) {
    return typeof value;
  }

  // Your average non-object things.  Saves from doing the try/catch below for.
  if (typeof value !== 'object') {
    return EJSON.stringify(value);
  }
  try {
    // Find objects with circular references since EJSON doesn't support them yet (Issue #4778 + Unaccepted PR)
    // If the native stringify is going to choke, EJSON.stringify is going to choke too.
    JSON.stringify(value);
  } catch (stringifyError) {
    if (stringifyError.name === 'TypeError') {
      return typeof value;
    }
  }
  return EJSON.stringify(value);
};
const typeofChecks = [[String, 'string'], [Number, 'number'], [Boolean, 'boolean'],
// While we don't allow undefined/function in EJSON, this is good for optional
// arguments with OneOf.
[Function, 'function'], [undefined, 'undefined']];

// Return `false` if it matches. Otherwise, return an object with a `message` and a `path` field.
const testSubtree = (value, pattern) => {
  // Match anything!
  if (pattern === Match.Any) {
    return false;
  }

  // Basic atomic types.
  // Do not match boxed objects (e.g. String, Boolean)
  for (let i = 0; i < typeofChecks.length; ++i) {
    if (pattern === typeofChecks[i][0]) {
      if (typeof value === typeofChecks[i][1]) {
        return false;
      }
      return {
        message: "Expected ".concat(typeofChecks[i][1], ", got ").concat(stringForErrorMessage(value, {
          onlyShowType: true
        })),
        path: ''
      };
    }
  }
  if (pattern === null) {
    if (value === null) {
      return false;
    }
    return {
      message: "Expected null, got ".concat(stringForErrorMessage(value)),
      path: ''
    };
  }

  // Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
  if (typeof pattern === 'string' || typeof pattern === 'number' || typeof pattern === 'boolean') {
    if (value === pattern) {
      return false;
    }
    return {
      message: "Expected ".concat(pattern, ", got ").concat(stringForErrorMessage(value)),
      path: ''
    };
  }

  // Match.Integer is special type encoded with array
  if (pattern === Match.Integer) {
    // There is no consistent and reliable way to check if variable is a 64-bit
    // integer. One of the popular solutions is to get reminder of division by 1
    // but this method fails on really large floats with big precision.
    // E.g.: 1.348192308491824e+23 % 1 === 0 in V8
    // Bitwise operators work consistantly but always cast variable to 32-bit
    // signed integer according to JavaScript specs.
    if (typeof value === 'number' && (value | 0) === value) {
      return false;
    }
    return {
      message: "Expected Integer, got ".concat(stringForErrorMessage(value)),
      path: ''
    };
  }

  // 'Object' is shorthand for Match.ObjectIncluding({});
  if (pattern === Object) {
    pattern = Match.ObjectIncluding({});
  }

  // Array (checked AFTER Any, which is implemented as an Array).
  if (pattern instanceof Array) {
    if (pattern.length !== 1) {
      return {
        message: "Bad pattern: arrays must have one type element ".concat(stringForErrorMessage(pattern)),
        path: ''
      };
    }
    if (!Array.isArray(value) && !isArguments(value)) {
      return {
        message: "Expected array, got ".concat(stringForErrorMessage(value)),
        path: ''
      };
    }
    for (let i = 0, length = value.length; i < length; i++) {
      const result = testSubtree(value[i], pattern[0]);
      if (result) {
        result.path = _prependPath(i, result.path);
        return result;
      }
    }
    return false;
  }

  // Arbitrary validation checks. The condition can return false or throw a
  // Match.Error (ie, it can internally use check()) to fail.
  if (pattern instanceof Where) {
    let result;
    try {
      result = pattern.condition(value);
    } catch (err) {
      if (!(err instanceof Match.Error)) {
        throw err;
      }
      return {
        message: err.message,
        path: err.path
      };
    }
    if (result) {
      return false;
    }

    // XXX this error is terrible
    return {
      message: 'Failed Match.Where validation',
      path: ''
    };
  }
  if (pattern instanceof Maybe) {
    pattern = Match.OneOf(undefined, null, pattern.pattern);
  } else if (pattern instanceof Optional) {
    pattern = Match.OneOf(undefined, pattern.pattern);
  }
  if (pattern instanceof OneOf) {
    for (let i = 0; i < pattern.choices.length; ++i) {
      const result = testSubtree(value, pattern.choices[i]);
      if (!result) {
        // No error? Yay, return.
        return false;
      }

      // Match errors just mean try another choice.
    }

    // XXX this error is terrible
    return {
      message: 'Failed Match.OneOf, Match.Maybe or Match.Optional validation',
      path: ''
    };
  }

  // A function that isn't something we special-case is assumed to be a
  // constructor.
  if (pattern instanceof Function) {
    if (value instanceof pattern) {
      return false;
    }
    return {
      message: "Expected ".concat(pattern.name || 'particular constructor'),
      path: ''
    };
  }
  let unknownKeysAllowed = false;
  let unknownKeyPattern;
  if (pattern instanceof ObjectIncluding) {
    unknownKeysAllowed = true;
    pattern = pattern.pattern;
  }
  if (pattern instanceof ObjectWithValues) {
    unknownKeysAllowed = true;
    unknownKeyPattern = [pattern.pattern];
    pattern = {}; // no required keys
  }

  if (typeof pattern !== 'object') {
    return {
      message: 'Bad pattern: unknown pattern type',
      path: ''
    };
  }

  // An object, with required and optional keys. Note that this does NOT do
  // structural matches against objects of special types that happen to match
  // the pattern: this really needs to be a plain old {Object}!
  if (typeof value !== 'object') {
    return {
      message: "Expected object, got ".concat(typeof value),
      path: ''
    };
  }
  if (value === null) {
    return {
      message: "Expected object, got null",
      path: ''
    };
  }
  if (!isPlainObject(value)) {
    return {
      message: "Expected plain object",
      path: ''
    };
  }
  const requiredPatterns = Object.create(null);
  const optionalPatterns = Object.create(null);
  Object.keys(pattern).forEach(key => {
    const subPattern = pattern[key];
    if (subPattern instanceof Optional || subPattern instanceof Maybe) {
      optionalPatterns[key] = subPattern.pattern;
    } else {
      requiredPatterns[key] = subPattern;
    }
  });
  for (let key in Object(value)) {
    const subValue = value[key];
    if (hasOwn.call(requiredPatterns, key)) {
      const result = testSubtree(subValue, requiredPatterns[key]);
      if (result) {
        result.path = _prependPath(key, result.path);
        return result;
      }
      delete requiredPatterns[key];
    } else if (hasOwn.call(optionalPatterns, key)) {
      const result = testSubtree(subValue, optionalPatterns[key]);
      if (result) {
        result.path = _prependPath(key, result.path);
        return result;
      }
    } else {
      if (!unknownKeysAllowed) {
        return {
          message: 'Unknown key',
          path: key
        };
      }
      if (unknownKeyPattern) {
        const result = testSubtree(subValue, unknownKeyPattern[0]);
        if (result) {
          result.path = _prependPath(key, result.path);
          return result;
        }
      }
    }
  }
  const keys = Object.keys(requiredPatterns);
  if (keys.length) {
    return {
      message: "Missing key '".concat(keys[0], "'"),
      path: ''
    };
  }
};
class ArgumentChecker {
  constructor(args, description) {
    // Make a SHALLOW copy of the arguments. (We'll be doing identity checks
    // against its contents.)
    this.args = [...args];

    // Since the common case will be to check arguments in order, and we splice
    // out arguments when we check them, make it so we splice out from the end
    // rather than the beginning.
    this.args.reverse();
    this.description = description;
  }
  checking(value) {
    if (this._checkingOneValue(value)) {
      return;
    }

    // Allow check(arguments, [String]) or check(arguments.slice(1), [String])
    // or check([foo, bar], [String]) to count... but only if value wasn't
    // itself an argument.
    if (Array.isArray(value) || isArguments(value)) {
      Array.prototype.forEach.call(value, this._checkingOneValue.bind(this));
    }
  }
  _checkingOneValue(value) {
    for (let i = 0; i < this.args.length; ++i) {
      // Is this value one of the arguments? (This can have a false positive if
      // the argument is an interned primitive, but it's still a good enough
      // check.)
      // (NaN is not === to itself, so we have to check specially.)
      if (value === this.args[i] || Number.isNaN(value) && Number.isNaN(this.args[i])) {
        this.args.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  throwUnlessAllArgumentsHaveBeenChecked() {
    if (this.args.length > 0) throw new Error("Did not check() all arguments during ".concat(this.description));
  }
}
const _jsKeywords = ['do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'false', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const', 'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public', 'return', 'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package', 'private', 'continue', 'debugger', 'function', 'arguments', 'interface', 'protected', 'implements', 'instanceof'];

// Assumes the base of path is already escaped properly
// returns key + base
const _prependPath = (key, base) => {
  if (typeof key === 'number' || key.match(/^[0-9]+$/)) {
    key = "[".concat(key, "]");
  } else if (!key.match(/^[a-z_$][0-9a-z_$]*$/i) || _jsKeywords.indexOf(key) >= 0) {
    key = JSON.stringify([key]);
  }
  if (base && base[0] !== '[') {
    return "".concat(key, ".").concat(base);
  }
  return key + base;
};
const isObject = value => typeof value === 'object' && value !== null;
const baseIsArguments = item => isObject(item) && Object.prototype.toString.call(item) === '[object Arguments]';
const isArguments = baseIsArguments(function () {
  return arguments;
}()) ? baseIsArguments : value => isObject(value) && typeof value.callee === 'function';
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"isPlainObject.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/check/isPlainObject.js                                                                               //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
module.export({
  isPlainObject: () => isPlainObject
});
// Copy of jQuery.isPlainObject for the server side from jQuery v3.1.1.

const class2type = {};
const toString = class2type.toString;
const hasOwn = Object.prototype.hasOwnProperty;
const fnToString = hasOwn.toString;
const ObjectFunctionString = fnToString.call(Object);
const getProto = Object.getPrototypeOf;
const isPlainObject = obj => {
  let proto;
  let Ctor;

  // Detect obvious negatives
  // Use toString instead of jQuery.type to catch host objects
  if (!obj || toString.call(obj) !== '[object Object]') {
    return false;
  }
  proto = getProto(obj);

  // Objects with no prototype (e.g., `Object.create( null )`) are plain
  if (!proto) {
    return true;
  }

  // Objects with prototype are plain iff they were constructed by a global Object function
  Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && fnToString.call(Ctor) === ObjectFunctionString;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/check/match.js");

/* Exports */
Package._define("check", exports, {
  check: check,
  Match: Match
});

})();

//# sourceURL=meteor://💻app/packages/check.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2hlY2svbWF0Y2guanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2NoZWNrL2lzUGxhaW5PYmplY3QuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiY2hlY2siLCJNYXRjaCIsImlzUGxhaW5PYmplY3QiLCJsaW5rIiwidiIsImN1cnJlbnRBcmd1bWVudENoZWNrZXIiLCJNZXRlb3IiLCJFbnZpcm9ubWVudFZhcmlhYmxlIiwiaGFzT3duIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJ2YWx1ZSIsInBhdHRlcm4iLCJhcmdDaGVja2VyIiwiZ2V0T3JOdWxsSWZPdXRzaWRlRmliZXIiLCJjaGVja2luZyIsInJlc3VsdCIsInRlc3RTdWJ0cmVlIiwiZXJyIiwiRXJyb3IiLCJtZXNzYWdlIiwicGF0aCIsIk9wdGlvbmFsIiwiTWF5YmUiLCJPbmVPZiIsImFyZ3MiLCJBbnkiLCJXaGVyZSIsImNvbmRpdGlvbiIsIk9iamVjdEluY2x1ZGluZyIsIk9iamVjdFdpdGhWYWx1ZXMiLCJJbnRlZ2VyIiwibWFrZUVycm9yVHlwZSIsIm1zZyIsInNhbml0aXplZEVycm9yIiwidGVzdCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiZiIsImNvbnRleHQiLCJkZXNjcmlwdGlvbiIsIkFyZ3VtZW50Q2hlY2tlciIsIndpdGhWYWx1ZSIsImFwcGx5IiwidGhyb3dVbmxlc3NBbGxBcmd1bWVudHNIYXZlQmVlbkNoZWNrZWQiLCJjb25zdHJ1Y3RvciIsImNob2ljZXMiLCJsZW5ndGgiLCJzdHJpbmdGb3JFcnJvck1lc3NhZ2UiLCJvcHRpb25zIiwib25seVNob3dUeXBlIiwiRUpTT04iLCJzdHJpbmdpZnkiLCJKU09OIiwic3RyaW5naWZ5RXJyb3IiLCJuYW1lIiwidHlwZW9mQ2hlY2tzIiwiU3RyaW5nIiwiTnVtYmVyIiwiQm9vbGVhbiIsIkZ1bmN0aW9uIiwidW5kZWZpbmVkIiwiaSIsIkFycmF5IiwiaXNBcnJheSIsImlzQXJndW1lbnRzIiwiX3ByZXBlbmRQYXRoIiwidW5rbm93bktleXNBbGxvd2VkIiwidW5rbm93bktleVBhdHRlcm4iLCJyZXF1aXJlZFBhdHRlcm5zIiwiY3JlYXRlIiwib3B0aW9uYWxQYXR0ZXJucyIsImtleXMiLCJmb3JFYWNoIiwia2V5Iiwic3ViUGF0dGVybiIsInN1YlZhbHVlIiwiY2FsbCIsInJldmVyc2UiLCJfY2hlY2tpbmdPbmVWYWx1ZSIsImJpbmQiLCJpc05hTiIsInNwbGljZSIsIl9qc0tleXdvcmRzIiwiYmFzZSIsIm1hdGNoIiwiaW5kZXhPZiIsImlzT2JqZWN0IiwiYmFzZUlzQXJndW1lbnRzIiwiaXRlbSIsInRvU3RyaW5nIiwiYXJndW1lbnRzIiwiY2FsbGVlIiwiY2xhc3MydHlwZSIsImZuVG9TdHJpbmciLCJPYmplY3RGdW5jdGlvblN0cmluZyIsImdldFByb3RvIiwiZ2V0UHJvdG90eXBlT2YiLCJvYmoiLCJwcm90byIsIkN0b3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0MsS0FBSyxFQUFDLE1BQUlBLEtBQUs7RUFBQ0MsS0FBSyxFQUFDLE1BQUlBO0FBQUssQ0FBQyxDQUFDO0FBQUMsSUFBSUMsYUFBYTtBQUFDSixNQUFNLENBQUNLLElBQUksQ0FBQyxpQkFBaUIsRUFBQztFQUFDRCxhQUFhLENBQUNFLENBQUMsRUFBQztJQUFDRixhQUFhLEdBQUNFLENBQUM7RUFBQTtBQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7QUFHdkk7QUFDQTs7QUFFQSxNQUFNQyxzQkFBc0IsR0FBRyxJQUFJQyxNQUFNLENBQUNDLG1CQUFtQjtBQUM3RCxNQUFNQyxNQUFNLEdBQUdDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjOztBQUU5QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNYLEtBQUssQ0FB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SztFQUNULElBQUlDLElBQUk7O0VBRVI7RUFDQTtFQUNBLElBQUksQ0FBQ0YsR0FBRyxJQUFJUixRQUFRLENBQUNiLElBQUksQ0FBQ3FCLEdBQUcsQ0FBQyxLQUFLLGlCQUFpQixFQUFFO0lBQ3BELE9BQU8sS0FBSztFQUNkO0VBRUFDLEtBQUssR0FBR0gsUUFBUSxDQUFDRSxHQUFHLENBQUM7O0VBRXJCO0VBQ0EsSUFBSSxDQUFDQyxLQUFLLEVBQUU7SUFDVixPQUFPLElBQUk7RUFDYjs7RUFFQTtFQUNBQyxJQUFJLEdBQUc1RixNQUFNLENBQUNxRSxJQUFJLENBQUNzQixLQUFLLEVBQUUsYUFBYSxDQUFDLElBQUlBLEtBQUssQ0FBQ3RELFdBQVc7RUFDN0QsT0FBTyxPQUFPdUQsSUFBSSxLQUFLLFVBQVUsSUFDL0JOLFVBQVUsQ0FBQ2pCLElBQUksQ0FBQ3VCLElBQUksQ0FBQyxLQUFLTCxvQkFBb0I7QUFDbEQsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9jaGVjay5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIFhYWCBkb2NzXG5pbXBvcnQgeyBpc1BsYWluT2JqZWN0IH0gZnJvbSAnLi9pc1BsYWluT2JqZWN0JztcblxuLy8gVGhpbmdzIHdlIGV4cGxpY2l0bHkgZG8gTk9UIHN1cHBvcnQ6XG4vLyAgICAtIGhldGVyb2dlbm91cyBhcnJheXNcblxuY29uc3QgY3VycmVudEFyZ3VtZW50Q2hlY2tlciA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZTtcbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogQHN1bW1hcnkgQ2hlY2sgdGhhdCBhIHZhbHVlIG1hdGNoZXMgYSBbcGF0dGVybl0oI21hdGNocGF0dGVybnMpLlxuICogSWYgdGhlIHZhbHVlIGRvZXMgbm90IG1hdGNoIHRoZSBwYXR0ZXJuLCB0aHJvdyBhIGBNYXRjaC5FcnJvcmAuXG4gKlxuICogUGFydGljdWxhcmx5IHVzZWZ1bCB0byBhc3NlcnQgdGhhdCBhcmd1bWVudHMgdG8gYSBmdW5jdGlvbiBoYXZlIHRoZSByaWdodFxuICogdHlwZXMgYW5kIHN0cnVjdHVyZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtBbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVja1xuICogQHBhcmFtIHtNYXRjaFBhdHRlcm59IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gbWF0Y2ggYHZhbHVlYCBhZ2FpbnN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGVjayh2YWx1ZSwgcGF0dGVybikge1xuICAvLyBSZWNvcmQgdGhhdCBjaGVjayBnb3QgY2FsbGVkLCBpZiBzb21lYm9keSBjYXJlZC5cbiAgLy9cbiAgLy8gV2UgdXNlIGdldE9yTnVsbElmT3V0c2lkZUZpYmVyIHNvIHRoYXQgaXQncyBPSyB0byBjYWxsIGNoZWNrKClcbiAgLy8gZnJvbSBub24tRmliZXIgc2VydmVyIGNvbnRleHRzOyB0aGUgZG93bnNpZGUgaXMgdGhhdCBpZiB5b3UgZm9yZ2V0IHRvXG4gIC8vIGJpbmRFbnZpcm9ubWVudCBvbiBzb21lIHJhbmRvbSBjYWxsYmFjayBpbiB5b3VyIG1ldGhvZC9wdWJsaXNoZXIsXG4gIC8vIGl0IG1pZ2h0IG5vdCBmaW5kIHRoZSBhcmd1bWVudENoZWNrZXIgYW5kIHlvdSdsbCBnZXQgYW4gZXJyb3IgYWJvdXRcbiAgLy8gbm90IGNoZWNraW5nIGFuIGFyZ3VtZW50IHRoYXQgaXQgbG9va3MgbGlrZSB5b3UncmUgY2hlY2tpbmcgKGluc3RlYWRcbiAgLy8gb2YganVzdCBnZXR0aW5nIGEgXCJOb2RlIGNvZGUgbXVzdCBydW4gaW4gYSBGaWJlclwiIGVycm9yKS5cbiAgY29uc3QgYXJnQ2hlY2tlciA9IGN1cnJlbnRBcmd1bWVudENoZWNrZXIuZ2V0T3JOdWxsSWZPdXRzaWRlRmliZXIoKTtcbiAgaWYgKGFyZ0NoZWNrZXIpIHtcbiAgICBhcmdDaGVja2VyLmNoZWNraW5nKHZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlLCBwYXR0ZXJuKTtcbiAgaWYgKHJlc3VsdCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBNYXRjaC5FcnJvcihyZXN1bHQubWVzc2FnZSk7XG4gICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICBlcnIubWVzc2FnZSArPSBgIGluIGZpZWxkICR7cmVzdWx0LnBhdGh9YDtcbiAgICAgIGVyci5wYXRoID0gcmVzdWx0LnBhdGg7XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyO1xuICB9XG59O1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgTWF0Y2hcbiAqIEBzdW1tYXJ5IFRoZSBuYW1lc3BhY2UgZm9yIGFsbCBNYXRjaCB0eXBlcyBhbmQgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNvbnN0IE1hdGNoID0ge1xuICBPcHRpb25hbDogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT3B0aW9uYWwocGF0dGVybik7XG4gIH0sXG5cbiAgTWF5YmU6IGZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgICByZXR1cm4gbmV3IE1heWJlKHBhdHRlcm4pO1xuICB9LFxuXG4gIE9uZU9mOiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgcmV0dXJuIG5ldyBPbmVPZihhcmdzKTtcbiAgfSxcblxuICBBbnk6IFsnX19hbnlfXyddLFxuICBXaGVyZTogZnVuY3Rpb24oY29uZGl0aW9uKSB7XG4gICAgcmV0dXJuIG5ldyBXaGVyZShjb25kaXRpb24pO1xuICB9LFxuXG4gIE9iamVjdEluY2x1ZGluZzogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT2JqZWN0SW5jbHVkaW5nKHBhdHRlcm4pXG4gIH0sXG5cbiAgT2JqZWN0V2l0aFZhbHVlczogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT2JqZWN0V2l0aFZhbHVlcyhwYXR0ZXJuKTtcbiAgfSxcblxuICAvLyBNYXRjaGVzIG9ubHkgc2lnbmVkIDMyLWJpdCBpbnRlZ2Vyc1xuICBJbnRlZ2VyOiBbJ19faW50ZWdlcl9fJ10sXG5cbiAgLy8gWFhYIG1hdGNoZXJzIHNob3VsZCBrbm93IGhvdyB0byBkZXNjcmliZSB0aGVtc2VsdmVzIGZvciBlcnJvcnNcbiAgRXJyb3I6IE1ldGVvci5tYWtlRXJyb3JUeXBlKCdNYXRjaC5FcnJvcicsIGZ1bmN0aW9uIChtc2cpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBgTWF0Y2ggZXJyb3I6ICR7bXNnfWA7XG5cbiAgICAvLyBUaGUgcGF0aCBvZiB0aGUgdmFsdWUgdGhhdCBmYWlsZWQgdG8gbWF0Y2guIEluaXRpYWxseSBlbXB0eSwgdGhpcyBnZXRzXG4gICAgLy8gcG9wdWxhdGVkIGJ5IGNhdGNoaW5nIGFuZCByZXRocm93aW5nIHRoZSBleGNlcHRpb24gYXMgaXQgZ29lcyBiYWNrIHVwIHRoZVxuICAgIC8vIHN0YWNrLlxuICAgIC8vIEUuZy46IFwidmFsc1szXS5lbnRpdHkuY3JlYXRlZFwiXG4gICAgdGhpcy5wYXRoID0gJyc7XG5cbiAgICAvLyBJZiB0aGlzIGdldHMgc2VudCBvdmVyIEREUCwgZG9uJ3QgZ2l2ZSBmdWxsIGludGVybmFsIGRldGFpbHMgYnV0IGF0IGxlYXN0XG4gICAgLy8gcHJvdmlkZSBzb21ldGhpbmcgYmV0dGVyIHRoYW4gNTAwIEludGVybmFsIHNlcnZlciBlcnJvci5cbiAgICB0aGlzLnNhbml0aXplZEVycm9yID0gbmV3IE1ldGVvci5FcnJvcig0MDAsICdNYXRjaCBmYWlsZWQnKTtcbiAgfSksXG5cbiAgLy8gVGVzdHMgdG8gc2VlIGlmIHZhbHVlIG1hdGNoZXMgcGF0dGVybi4gVW5saWtlIGNoZWNrLCBpdCBtZXJlbHkgcmV0dXJucyB0cnVlXG4gIC8vIG9yIGZhbHNlICh1bmxlc3MgYW4gZXJyb3Igb3RoZXIgdGhhbiBNYXRjaC5FcnJvciB3YXMgdGhyb3duKS4gSXQgZG9lcyBub3RcbiAgLy8gaW50ZXJhY3Qgd2l0aCBfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZC5cbiAgLy8gWFhYIG1heWJlIGFsc28gaW1wbGVtZW50IGEgTWF0Y2gubWF0Y2ggd2hpY2ggcmV0dXJucyBtb3JlIGluZm9ybWF0aW9uIGFib3V0XG4gIC8vICAgICBmYWlsdXJlcyBidXQgd2l0aG91dCB1c2luZyBleGNlcHRpb24gaGFuZGxpbmcgb3IgZG9pbmcgd2hhdCBjaGVjaygpXG4gIC8vICAgICBkb2VzIHdpdGggX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQgYW5kIE1ldGVvci5FcnJvciBjb252ZXJzaW9uXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdHJ1ZSBpZiB0aGUgdmFsdWUgbWF0Y2hlcyB0aGUgcGF0dGVybi5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtNYXRjaFBhdHRlcm59IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gbWF0Y2ggYHZhbHVlYCBhZ2FpbnN0XG4gICAqL1xuICB0ZXN0KHZhbHVlLCBwYXR0ZXJuKSB7XG4gICAgcmV0dXJuICF0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybik7XG4gIH0sXG5cbiAgLy8gUnVucyBgZi5hcHBseShjb250ZXh0LCBhcmdzKWAuIElmIGNoZWNrKCkgaXMgbm90IGNhbGxlZCBvbiBldmVyeSBlbGVtZW50IG9mXG4gIC8vIGBhcmdzYCAoZWl0aGVyIGRpcmVjdGx5IG9yIGluIHRoZSBmaXJzdCBsZXZlbCBvZiBhbiBhcnJheSksIHRocm93cyBhbiBlcnJvclxuICAvLyAodXNpbmcgYGRlc2NyaXB0aW9uYCBpbiB0aGUgbWVzc2FnZSkuXG4gIF9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkKGYsIGNvbnRleHQsIGFyZ3MsIGRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgYXJnQ2hlY2tlciA9IG5ldyBBcmd1bWVudENoZWNrZXIoYXJncywgZGVzY3JpcHRpb24pO1xuICAgIGNvbnN0IHJlc3VsdCA9IGN1cnJlbnRBcmd1bWVudENoZWNrZXIud2l0aFZhbHVlKFxuICAgICAgYXJnQ2hlY2tlcixcbiAgICAgICgpID0+IGYuYXBwbHkoY29udGV4dCwgYXJncylcbiAgICApO1xuXG4gICAgLy8gSWYgZiBkaWRuJ3QgaXRzZWxmIHRocm93LCBtYWtlIHN1cmUgaXQgY2hlY2tlZCBhbGwgb2YgaXRzIGFyZ3VtZW50cy5cbiAgICBhcmdDaGVja2VyLnRocm93VW5sZXNzQWxsQXJndW1lbnRzSGF2ZUJlZW5DaGVja2VkKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufTtcblxuY2xhc3MgT3B0aW9uYWwge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBNYXliZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIE9uZU9mIHtcbiAgY29uc3RydWN0b3IoY2hvaWNlcykge1xuICAgIGlmICghY2hvaWNlcyB8fCBjaG9pY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHByb3ZpZGUgYXQgbGVhc3Qgb25lIGNob2ljZSB0byBNYXRjaC5PbmVPZicpO1xuICAgIH1cblxuICAgIHRoaXMuY2hvaWNlcyA9IGNob2ljZXM7XG4gIH1cbn1cblxuY2xhc3MgV2hlcmUge1xuICBjb25zdHJ1Y3Rvcihjb25kaXRpb24pIHtcbiAgICB0aGlzLmNvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgfVxufVxuXG5jbGFzcyBPYmplY3RJbmNsdWRpbmcge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBPYmplY3RXaXRoVmFsdWVzIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbn1cblxuY29uc3Qgc3RyaW5nRm9yRXJyb3JNZXNzYWdlID0gKHZhbHVlLCBvcHRpb25zID0ge30pID0+IHtcbiAgaWYgKCB2YWx1ZSA9PT0gbnVsbCApIHtcbiAgICByZXR1cm4gJ251bGwnO1xuICB9XG5cbiAgaWYgKCBvcHRpb25zLm9ubHlTaG93VHlwZSApIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlO1xuICB9XG5cbiAgLy8gWW91ciBhdmVyYWdlIG5vbi1vYmplY3QgdGhpbmdzLiAgU2F2ZXMgZnJvbSBkb2luZyB0aGUgdHJ5L2NhdGNoIGJlbG93IGZvci5cbiAgaWYgKCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnICkge1xuICAgIHJldHVybiBFSlNPTi5zdHJpbmdpZnkodmFsdWUpXG4gIH1cblxuICB0cnkge1xuXG4gICAgLy8gRmluZCBvYmplY3RzIHdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcyBzaW5jZSBFSlNPTiBkb2Vzbid0IHN1cHBvcnQgdGhlbSB5ZXQgKElzc3VlICM0Nzc4ICsgVW5hY2NlcHRlZCBQUilcbiAgICAvLyBJZiB0aGUgbmF0aXZlIHN0cmluZ2lmeSBpcyBnb2luZyB0byBjaG9rZSwgRUpTT04uc3RyaW5naWZ5IGlzIGdvaW5nIHRvIGNob2tlIHRvby5cbiAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gIH0gY2F0Y2ggKHN0cmluZ2lmeUVycm9yKSB7XG4gICAgaWYgKCBzdHJpbmdpZnlFcnJvci5uYW1lID09PSAnVHlwZUVycm9yJyApIHtcbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIEVKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG59O1xuXG5jb25zdCB0eXBlb2ZDaGVja3MgPSBbXG4gIFtTdHJpbmcsICdzdHJpbmcnXSxcbiAgW051bWJlciwgJ251bWJlciddLFxuICBbQm9vbGVhbiwgJ2Jvb2xlYW4nXSxcblxuICAvLyBXaGlsZSB3ZSBkb24ndCBhbGxvdyB1bmRlZmluZWQvZnVuY3Rpb24gaW4gRUpTT04sIHRoaXMgaXMgZ29vZCBmb3Igb3B0aW9uYWxcbiAgLy8gYXJndW1lbnRzIHdpdGggT25lT2YuXG4gIFtGdW5jdGlvbiwgJ2Z1bmN0aW9uJ10sXG4gIFt1bmRlZmluZWQsICd1bmRlZmluZWQnXSxcbl07XG5cbi8vIFJldHVybiBgZmFsc2VgIGlmIGl0IG1hdGNoZXMuIE90aGVyd2lzZSwgcmV0dXJuIGFuIG9iamVjdCB3aXRoIGEgYG1lc3NhZ2VgIGFuZCBhIGBwYXRoYCBmaWVsZC5cbmNvbnN0IHRlc3RTdWJ0cmVlID0gKHZhbHVlLCBwYXR0ZXJuKSA9PiB7XG5cbiAgLy8gTWF0Y2ggYW55dGhpbmchXG4gIGlmIChwYXR0ZXJuID09PSBNYXRjaC5BbnkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBCYXNpYyBhdG9taWMgdHlwZXMuXG4gIC8vIERvIG5vdCBtYXRjaCBib3hlZCBvYmplY3RzIChlLmcuIFN0cmluZywgQm9vbGVhbilcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0eXBlb2ZDaGVja3MubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAocGF0dGVybiA9PT0gdHlwZW9mQ2hlY2tzW2ldWzBdKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSB0eXBlb2ZDaGVja3NbaV1bMV0pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgJHt0eXBlb2ZDaGVja3NbaV1bMV19LCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUsIHsgb25seVNob3dUeXBlOiB0cnVlIH0pfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgbnVsbCwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN0cmluZ3MsIG51bWJlcnMsIGFuZCBib29sZWFucyBtYXRjaCBsaXRlcmFsbHkuIEdvZXMgd2VsbCB3aXRoIE1hdGNoLk9uZU9mLlxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBwYXR0ZXJuID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgcGF0dGVybiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgaWYgKHZhbHVlID09PSBwYXR0ZXJuKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCAke3BhdHRlcm59LCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTWF0Y2guSW50ZWdlciBpcyBzcGVjaWFsIHR5cGUgZW5jb2RlZCB3aXRoIGFycmF5XG4gIGlmIChwYXR0ZXJuID09PSBNYXRjaC5JbnRlZ2VyKSB7XG5cbiAgICAvLyBUaGVyZSBpcyBubyBjb25zaXN0ZW50IGFuZCByZWxpYWJsZSB3YXkgdG8gY2hlY2sgaWYgdmFyaWFibGUgaXMgYSA2NC1iaXRcbiAgICAvLyBpbnRlZ2VyLiBPbmUgb2YgdGhlIHBvcHVsYXIgc29sdXRpb25zIGlzIHRvIGdldCByZW1pbmRlciBvZiBkaXZpc2lvbiBieSAxXG4gICAgLy8gYnV0IHRoaXMgbWV0aG9kIGZhaWxzIG9uIHJlYWxseSBsYXJnZSBmbG9hdHMgd2l0aCBiaWcgcHJlY2lzaW9uLlxuICAgIC8vIEUuZy46IDEuMzQ4MTkyMzA4NDkxODI0ZSsyMyAlIDEgPT09IDAgaW4gVjhcbiAgICAvLyBCaXR3aXNlIG9wZXJhdG9ycyB3b3JrIGNvbnNpc3RhbnRseSBidXQgYWx3YXlzIGNhc3QgdmFyaWFibGUgdG8gMzItYml0XG4gICAgLy8gc2lnbmVkIGludGVnZXIgYWNjb3JkaW5nIHRvIEphdmFTY3JpcHQgc3BlY3MuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgKHZhbHVlIHwgMCkgPT09IHZhbHVlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBJbnRlZ2VyLCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gJ09iamVjdCcgaXMgc2hvcnRoYW5kIGZvciBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe30pO1xuICBpZiAocGF0dGVybiA9PT0gT2JqZWN0KSB7XG4gICAgcGF0dGVybiA9IE1hdGNoLk9iamVjdEluY2x1ZGluZyh7fSk7XG4gIH1cblxuICAvLyBBcnJheSAoY2hlY2tlZCBBRlRFUiBBbnksIHdoaWNoIGlzIGltcGxlbWVudGVkIGFzIGFuIEFycmF5KS5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIGlmIChwYXR0ZXJuLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZTogYEJhZCBwYXR0ZXJuOiBhcnJheXMgbXVzdCBoYXZlIG9uZSB0eXBlIGVsZW1lbnQgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UocGF0dGVybil9YCxcbiAgICAgICAgcGF0aDogJycsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgIWlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIGFycmF5LCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlW2ldLCBwYXR0ZXJuWzBdKTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoaSwgcmVzdWx0LnBhdGgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEFyYml0cmFyeSB2YWxpZGF0aW9uIGNoZWNrcy4gVGhlIGNvbmRpdGlvbiBjYW4gcmV0dXJuIGZhbHNlIG9yIHRocm93IGFcbiAgLy8gTWF0Y2guRXJyb3IgKGllLCBpdCBjYW4gaW50ZXJuYWxseSB1c2UgY2hlY2soKSkgdG8gZmFpbC5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBXaGVyZSkge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IHBhdHRlcm4uY29uZGl0aW9uKHZhbHVlKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIE1hdGNoLkVycm9yKSkge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlLFxuICAgICAgICBwYXRoOiBlcnIucGF0aFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gWFhYIHRoaXMgZXJyb3IgaXMgdGVycmlibGVcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogJ0ZhaWxlZCBNYXRjaC5XaGVyZSB2YWxpZGF0aW9uJyxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE1heWJlKSB7XG4gICAgcGF0dGVybiA9IE1hdGNoLk9uZU9mKHVuZGVmaW5lZCwgbnVsbCwgcGF0dGVybi5wYXR0ZXJuKTtcbiAgfSBlbHNlIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT3B0aW9uYWwpIHtcbiAgICBwYXR0ZXJuID0gTWF0Y2guT25lT2YodW5kZWZpbmVkLCBwYXR0ZXJuLnBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPbmVPZikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5jaG9pY2VzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybi5jaG9pY2VzW2ldKTtcbiAgICAgIGlmICghcmVzdWx0KSB7XG5cbiAgICAgICAgLy8gTm8gZXJyb3I/IFlheSwgcmV0dXJuLlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIE1hdGNoIGVycm9ycyBqdXN0IG1lYW4gdHJ5IGFub3RoZXIgY2hvaWNlLlxuICAgIH1cblxuICAgIC8vIFhYWCB0aGlzIGVycm9yIGlzIHRlcnJpYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6ICdGYWlsZWQgTWF0Y2guT25lT2YsIE1hdGNoLk1heWJlIG9yIE1hdGNoLk9wdGlvbmFsIHZhbGlkYXRpb24nLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIEEgZnVuY3Rpb24gdGhhdCBpc24ndCBzb21ldGhpbmcgd2Ugc3BlY2lhbC1jYXNlIGlzIGFzc3VtZWQgdG8gYmUgYVxuICAvLyBjb25zdHJ1Y3Rvci5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHBhdHRlcm4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7cGF0dGVybi5uYW1lIHx8ICdwYXJ0aWN1bGFyIGNvbnN0cnVjdG9yJ31gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGxldCB1bmtub3duS2V5c0FsbG93ZWQgPSBmYWxzZTtcbiAgbGV0IHVua25vd25LZXlQYXR0ZXJuO1xuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE9iamVjdEluY2x1ZGluZykge1xuICAgIHVua25vd25LZXlzQWxsb3dlZCA9IHRydWU7XG4gICAgcGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybjtcbiAgfVxuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT2JqZWN0V2l0aFZhbHVlcykge1xuICAgIHVua25vd25LZXlzQWxsb3dlZCA9IHRydWU7XG4gICAgdW5rbm93bktleVBhdHRlcm4gPSBbcGF0dGVybi5wYXR0ZXJuXTtcbiAgICBwYXR0ZXJuID0ge307ICAvLyBubyByZXF1aXJlZCBrZXlzXG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6ICdCYWQgcGF0dGVybjogdW5rbm93biBwYXR0ZXJuIHR5cGUnLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIEFuIG9iamVjdCwgd2l0aCByZXF1aXJlZCBhbmQgb3B0aW9uYWwga2V5cy4gTm90ZSB0aGF0IHRoaXMgZG9lcyBOT1QgZG9cbiAgLy8gc3RydWN0dXJhbCBtYXRjaGVzIGFnYWluc3Qgb2JqZWN0cyBvZiBzcGVjaWFsIHR5cGVzIHRoYXQgaGFwcGVuIHRvIG1hdGNoXG4gIC8vIHRoZSBwYXR0ZXJuOiB0aGlzIHJlYWxseSBuZWVkcyB0byBiZSBhIHBsYWluIG9sZCB7T2JqZWN0fSFcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIG9iamVjdCwgZ290ICR7dHlwZW9mIHZhbHVlfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBvYmplY3QsIGdvdCBudWxsYCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBpZiAoISBpc1BsYWluT2JqZWN0KHZhbHVlKSkge1xuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgcGxhaW4gb2JqZWN0YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBjb25zdCByZXF1aXJlZFBhdHRlcm5zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgY29uc3Qgb3B0aW9uYWxQYXR0ZXJucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgT2JqZWN0LmtleXMocGF0dGVybikuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHN1YlBhdHRlcm4gPSBwYXR0ZXJuW2tleV07XG4gICAgaWYgKHN1YlBhdHRlcm4gaW5zdGFuY2VvZiBPcHRpb25hbCB8fFxuICAgICAgICBzdWJQYXR0ZXJuIGluc3RhbmNlb2YgTWF5YmUpIHtcbiAgICAgIG9wdGlvbmFsUGF0dGVybnNba2V5XSA9IHN1YlBhdHRlcm4ucGF0dGVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVxdWlyZWRQYXR0ZXJuc1trZXldID0gc3ViUGF0dGVybjtcbiAgICB9XG4gIH0pO1xuXG4gIGZvciAobGV0IGtleSBpbiBPYmplY3QodmFsdWUpKSB7XG4gICAgY29uc3Qgc3ViVmFsdWUgPSB2YWx1ZVtrZXldO1xuICAgIGlmIChoYXNPd24uY2FsbChyZXF1aXJlZFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgcmVxdWlyZWRQYXR0ZXJuc1trZXldKTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoa2V5LCByZXN1bHQucGF0aCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIGRlbGV0ZSByZXF1aXJlZFBhdHRlcm5zW2tleV07XG4gICAgfSBlbHNlIGlmIChoYXNPd24uY2FsbChvcHRpb25hbFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgb3B0aW9uYWxQYXR0ZXJuc1trZXldKTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoa2V5LCByZXN1bHQucGF0aCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF1bmtub3duS2V5c0FsbG93ZWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiAnVW5rbm93biBrZXknLFxuICAgICAgICAgIHBhdGg6IGtleSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVua25vd25LZXlQYXR0ZXJuKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHN1YlZhbHVlLCB1bmtub3duS2V5UGF0dGVyblswXSk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChrZXksIHJlc3VsdC5wYXRoKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHJlcXVpcmVkUGF0dGVybnMpO1xuICBpZiAoa2V5cy5sZW5ndGgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYE1pc3Npbmcga2V5ICcke2tleXNbMF19J2AsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG59O1xuXG5jbGFzcyBBcmd1bWVudENoZWNrZXIge1xuICBjb25zdHJ1Y3RvciAoYXJncywgZGVzY3JpcHRpb24pIHtcblxuICAgIC8vIE1ha2UgYSBTSEFMTE9XIGNvcHkgb2YgdGhlIGFyZ3VtZW50cy4gKFdlJ2xsIGJlIGRvaW5nIGlkZW50aXR5IGNoZWNrc1xuICAgIC8vIGFnYWluc3QgaXRzIGNvbnRlbnRzLilcbiAgICB0aGlzLmFyZ3MgPSBbLi4uYXJnc107XG5cbiAgICAvLyBTaW5jZSB0aGUgY29tbW9uIGNhc2Ugd2lsbCBiZSB0byBjaGVjayBhcmd1bWVudHMgaW4gb3JkZXIsIGFuZCB3ZSBzcGxpY2VcbiAgICAvLyBvdXQgYXJndW1lbnRzIHdoZW4gd2UgY2hlY2sgdGhlbSwgbWFrZSBpdCBzbyB3ZSBzcGxpY2Ugb3V0IGZyb20gdGhlIGVuZFxuICAgIC8vIHJhdGhlciB0aGFuIHRoZSBiZWdpbm5pbmcuXG4gICAgdGhpcy5hcmdzLnJldmVyc2UoKTtcbiAgICB0aGlzLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gIH1cblxuICBjaGVja2luZyh2YWx1ZSkge1xuICAgIGlmICh0aGlzLl9jaGVja2luZ09uZVZhbHVlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEFsbG93IGNoZWNrKGFyZ3VtZW50cywgW1N0cmluZ10pIG9yIGNoZWNrKGFyZ3VtZW50cy5zbGljZSgxKSwgW1N0cmluZ10pXG4gICAgLy8gb3IgY2hlY2soW2ZvbywgYmFyXSwgW1N0cmluZ10pIHRvIGNvdW50Li4uIGJ1dCBvbmx5IGlmIHZhbHVlIHdhc24ndFxuICAgIC8vIGl0c2VsZiBhbiBhcmd1bWVudC5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgaXNBcmd1bWVudHModmFsdWUpKSB7XG4gICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHZhbHVlLCB0aGlzLl9jaGVja2luZ09uZVZhbHVlLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIF9jaGVja2luZ09uZVZhbHVlKHZhbHVlKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFyZ3MubGVuZ3RoOyArK2kpIHtcblxuICAgICAgLy8gSXMgdGhpcyB2YWx1ZSBvbmUgb2YgdGhlIGFyZ3VtZW50cz8gKFRoaXMgY2FuIGhhdmUgYSBmYWxzZSBwb3NpdGl2ZSBpZlxuICAgICAgLy8gdGhlIGFyZ3VtZW50IGlzIGFuIGludGVybmVkIHByaW1pdGl2ZSwgYnV0IGl0J3Mgc3RpbGwgYSBnb29kIGVub3VnaFxuICAgICAgLy8gY2hlY2suKVxuICAgICAgLy8gKE5hTiBpcyBub3QgPT09IHRvIGl0c2VsZiwgc28gd2UgaGF2ZSB0byBjaGVjayBzcGVjaWFsbHkuKVxuICAgICAgaWYgKHZhbHVlID09PSB0aGlzLmFyZ3NbaV0gfHxcbiAgICAgICAgICAoTnVtYmVyLmlzTmFOKHZhbHVlKSAmJiBOdW1iZXIuaXNOYU4odGhpcy5hcmdzW2ldKSkpIHtcbiAgICAgICAgdGhpcy5hcmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHRocm93VW5sZXNzQWxsQXJndW1lbnRzSGF2ZUJlZW5DaGVja2VkKCkge1xuICAgIGlmICh0aGlzLmFyZ3MubGVuZ3RoID4gMClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRGlkIG5vdCBjaGVjaygpIGFsbCBhcmd1bWVudHMgZHVyaW5nICR7dGhpcy5kZXNjcmlwdGlvbn1gKTtcbiAgfVxufVxuXG5jb25zdCBfanNLZXl3b3JkcyA9IFsnZG8nLCAnaWYnLCAnaW4nLCAnZm9yJywgJ2xldCcsICduZXcnLCAndHJ5JywgJ3ZhcicsICdjYXNlJyxcbiAgJ2Vsc2UnLCAnZW51bScsICdldmFsJywgJ2ZhbHNlJywgJ251bGwnLCAndGhpcycsICd0cnVlJywgJ3ZvaWQnLCAnd2l0aCcsXG4gICdicmVhaycsICdjYXRjaCcsICdjbGFzcycsICdjb25zdCcsICdzdXBlcicsICd0aHJvdycsICd3aGlsZScsICd5aWVsZCcsXG4gICdkZWxldGUnLCAnZXhwb3J0JywgJ2ltcG9ydCcsICdwdWJsaWMnLCAncmV0dXJuJywgJ3N0YXRpYycsICdzd2l0Y2gnLFxuICAndHlwZW9mJywgJ2RlZmF1bHQnLCAnZXh0ZW5kcycsICdmaW5hbGx5JywgJ3BhY2thZ2UnLCAncHJpdmF0ZScsICdjb250aW51ZScsXG4gICdkZWJ1Z2dlcicsICdmdW5jdGlvbicsICdhcmd1bWVudHMnLCAnaW50ZXJmYWNlJywgJ3Byb3RlY3RlZCcsICdpbXBsZW1lbnRzJyxcbiAgJ2luc3RhbmNlb2YnXTtcblxuLy8gQXNzdW1lcyB0aGUgYmFzZSBvZiBwYXRoIGlzIGFscmVhZHkgZXNjYXBlZCBwcm9wZXJseVxuLy8gcmV0dXJucyBrZXkgKyBiYXNlXG5jb25zdCBfcHJlcGVuZFBhdGggPSAoa2V5LCBiYXNlKSA9PiB7XG4gIGlmICgodHlwZW9mIGtleSkgPT09ICdudW1iZXInIHx8IGtleS5tYXRjaCgvXlswLTldKyQvKSkge1xuICAgIGtleSA9IGBbJHtrZXl9XWA7XG4gIH0gZWxzZSBpZiAoIWtleS5tYXRjaCgvXlthLXpfJF1bMC05YS16XyRdKiQvaSkgfHxcbiAgICAgICAgICAgICBfanNLZXl3b3Jkcy5pbmRleE9mKGtleSkgPj0gMCkge1xuICAgIGtleSA9IEpTT04uc3RyaW5naWZ5KFtrZXldKTtcbiAgfVxuXG4gIGlmIChiYXNlICYmIGJhc2VbMF0gIT09ICdbJykge1xuICAgIHJldHVybiBgJHtrZXl9LiR7YmFzZX1gO1xuICB9XG5cbiAgcmV0dXJuIGtleSArIGJhc2U7XG59XG5cbmNvbnN0IGlzT2JqZWN0ID0gdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbDtcblxuY29uc3QgYmFzZUlzQXJndW1lbnRzID0gaXRlbSA9PlxuICBpc09iamVjdChpdGVtKSAmJlxuICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlbSkgPT09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5jb25zdCBpc0FyZ3VtZW50cyA9IGJhc2VJc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKSA/XG4gIGJhc2VJc0FyZ3VtZW50cyA6XG4gIHZhbHVlID0+IGlzT2JqZWN0KHZhbHVlKSAmJiB0eXBlb2YgdmFsdWUuY2FsbGVlID09PSAnZnVuY3Rpb24nO1xuIiwiLy8gQ29weSBvZiBqUXVlcnkuaXNQbGFpbk9iamVjdCBmb3IgdGhlIHNlcnZlciBzaWRlIGZyb20galF1ZXJ5IHYzLjEuMS5cblxuY29uc3QgY2xhc3MydHlwZSA9IHt9O1xuXG5jb25zdCB0b1N0cmluZyA9IGNsYXNzMnR5cGUudG9TdHJpbmc7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmNvbnN0IGZuVG9TdHJpbmcgPSBoYXNPd24udG9TdHJpbmc7XG5cbmNvbnN0IE9iamVjdEZ1bmN0aW9uU3RyaW5nID0gZm5Ub1N0cmluZy5jYWxsKE9iamVjdCk7XG5cbmNvbnN0IGdldFByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mO1xuXG5leHBvcnQgY29uc3QgaXNQbGFpbk9iamVjdCA9IG9iaiA9PiB7XG4gIGxldCBwcm90bztcbiAgbGV0IEN0b3I7XG5cbiAgLy8gRGV0ZWN0IG9idmlvdXMgbmVnYXRpdmVzXG4gIC8vIFVzZSB0b1N0cmluZyBpbnN0ZWFkIG9mIGpRdWVyeS50eXBlIHRvIGNhdGNoIGhvc3Qgb2JqZWN0c1xuICBpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJvdG8gPSBnZXRQcm90byhvYmopO1xuXG4gIC8vIE9iamVjdHMgd2l0aCBubyBwcm90b3R5cGUgKGUuZy4sIGBPYmplY3QuY3JlYXRlKCBudWxsIClgKSBhcmUgcGxhaW5cbiAgaWYgKCFwcm90bykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gT2JqZWN0cyB3aXRoIHByb3RvdHlwZSBhcmUgcGxhaW4gaWZmIHRoZXkgd2VyZSBjb25zdHJ1Y3RlZCBieSBhIGdsb2JhbCBPYmplY3QgZnVuY3Rpb25cbiAgQ3RvciA9IGhhc093bi5jYWxsKHByb3RvLCAnY29uc3RydWN0b3InKSAmJiBwcm90by5jb25zdHJ1Y3RvcjtcbiAgcmV0dXJuIHR5cGVvZiBDdG9yID09PSAnZnVuY3Rpb24nICYmIFxuICAgIGZuVG9TdHJpbmcuY2FsbChDdG9yKSA9PT0gT2JqZWN0RnVuY3Rpb25TdHJpbmc7XG59O1xuIl19
