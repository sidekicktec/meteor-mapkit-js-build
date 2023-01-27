(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Tracker, Deps, computation;

var require = meteorInstall({"node_modules":{"meteor":{"tracker":{"tracker.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/tracker/tracker.js                                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
/////////////////////////////////////////////////////
// Package docs at http://docs.meteor.com/#tracker //
/////////////////////////////////////////////////////

/**
 * @namespace Tracker
 * @summary The namespace for Tracker-related methods.
 */
Tracker = {};

/**
 * @namespace Deps
 * @deprecated
 */
Deps = Tracker;

// http://docs.meteor.com/#tracker_active

/**
 * @summary True if there is a current computation, meaning that dependencies on reactive data sources will be tracked and potentially cause the current computation to be rerun.
 * @locus Client
 * @type {Boolean}
 */
Tracker.active = false;

// http://docs.meteor.com/#tracker_currentcomputation

/**
 * @summary The current computation, or `null` if there isn't one.  The current computation is the [`Tracker.Computation`](#tracker_computation) object created by the innermost active call to `Tracker.autorun`, and it's the computation that gains dependencies when reactive data sources are accessed.
 * @locus Client
 * @type {Tracker.Computation}
 */
Tracker.currentComputation = null;
function _debugFunc() {
  // We want this code to work without Meteor, and also without
  // "console" (which is technically non-standard and may be missing
  // on some browser we come across, like it was on IE 7).
  //
  // Lazy evaluation because `Meteor` does not exist right away.(??)
  return typeof Meteor !== "undefined" ? Meteor._debug : typeof console !== "undefined" && console.error ? function () {
    console.error.apply(console, arguments);
  } : function () {};
}
function _maybeSuppressMoreLogs(messagesLength) {
  // Sometimes when running tests, we intentionally suppress logs on expected
  // printed errors. Since the current implementation of _throwOrLog can log
  // multiple separate log messages, suppress all of them if at least one suppress
  // is expected as we still want them to count as one.
  if (typeof Meteor !== "undefined") {
    if (Meteor._suppressed_log_expected()) {
      Meteor._suppress_log(messagesLength - 1);
    }
  }
}
function _throwOrLog(from, e) {
  if (throwFirstError) {
    throw e;
  } else {
    var printArgs = ["Exception from Tracker " + from + " function:"];
    if (e.stack && e.message && e.name) {
      var idx = e.stack.indexOf(e.message);
      if (idx < 0 || idx > e.name.length + 2) {
        // check for "Error: "
        // message is not part of the stack
        var message = e.name + ": " + e.message;
        printArgs.push(message);
      }
    }
    printArgs.push(e.stack);
    _maybeSuppressMoreLogs(printArgs.length);
    for (var i = 0; i < printArgs.length; i++) {
      _debugFunc()(printArgs[i]);
    }
  }
}

// Takes a function `f`, and wraps it in a `Meteor._noYieldsAllowed`
// block if we are running on the server. On the client, returns the
// original function (since `Meteor._noYieldsAllowed` is a
// no-op). This has the benefit of not adding an unnecessary stack
// frame on the client.
function withNoYieldsAllowed(f) {
  if (typeof Meteor === 'undefined' || Meteor.isClient) {
    return f;
  } else {
    return function () {
      var args = arguments;
      Meteor._noYieldsAllowed(function () {
        f.apply(null, args);
      });
    };
  }
}
var nextId = 1;
// computations whose callbacks we should call at flush time
var pendingComputations = [];
// `true` if a Tracker.flush is scheduled, or if we are in Tracker.flush now
var willFlush = false;
// `true` if we are in Tracker.flush now
var inFlush = false;
// `true` if we are computing a computation now, either first time
// or recompute.  This matches Tracker.active unless we are inside
// Tracker.nonreactive, which nullfies currentComputation even though
// an enclosing computation may still be running.
var inCompute = false;
// `true` if the `_throwFirstError` option was passed in to the call
// to Tracker.flush that we are in. When set, throw rather than log the
// first error encountered while flushing. Before throwing the error,
// finish flushing (from a finally block), logging any subsequent
// errors.
var throwFirstError = false;
var afterFlushCallbacks = [];
function requireFlush() {
  if (!willFlush) {
    // We want this code to work without Meteor, see debugFunc above
    if (typeof Meteor !== "undefined") Meteor._setImmediate(Tracker._runFlush);else setTimeout(Tracker._runFlush, 0);
    willFlush = true;
  }
}

// Tracker.Computation constructor is visible but private
// (throws an error if you try to call it)
var constructingComputation = false;

//
// http://docs.meteor.com/#tracker_computation

/**
 * @summary A Computation object represents code that is repeatedly rerun
 * in response to
 * reactive data changes. Computations don't have return values; they just
 * perform actions, such as rerendering a template on the screen. Computations
 * are created using Tracker.autorun. Use stop to prevent further rerunning of a
 * computation.
 * @instancename computation
 */
Tracker.Computation = class Computation {
  constructor(f, parent, onError) {
    if (!constructingComputation) throw new Error("Tracker.Computation constructor is private; use Tracker.autorun");
    constructingComputation = false;

    // http://docs.meteor.com/#computation_stopped

    /**
     * @summary True if this computation has been stopped.
     * @locus Client
     * @memberOf Tracker.Computation
     * @instance
     * @name  stopped
     */
    this.stopped = false;

    // http://docs.meteor.com/#computation_invalidated

    /**
     * @summary True if this computation has been invalidated (and not yet rerun), or if it has been stopped.
     * @locus Client
     * @memberOf Tracker.Computation
     * @instance
     * @name  invalidated
     * @type {Boolean}
     */
    this.invalidated = false;

    // http://docs.meteor.com/#computation_firstrun

    /**
     * @summary True during the initial run of the computation at the time `Tracker.autorun` is called, and false on subsequent reruns and at other times.
     * @locus Client
     * @memberOf Tracker.Computation
     * @instance
     * @name  firstRun
     * @type {Boolean}
     */
    this.firstRun = true;
    this._id = nextId++;
    this._onInvalidateCallbacks = [];
    this._onStopCallbacks = [];
    // the plan is at some point to use the parent relation
    // to constrain the order that computations are processed
    this._parent = parent;
    this._func = f;
    this._onError = onError;
    this._recomputing = false;
    var errored = true;
    try {
      this._compute();
      errored = false;
    } finally {
      this.firstRun = false;
      if (errored) this.stop();
    }
  }

  // http://docs.meteor.com/#computation_oninvalidate

  /**
   * @summary Registers `callback` to run when this computation is next invalidated, or runs it immediately if the computation is already invalidated.  The callback is run exactly once and not upon future invalidations unless `onInvalidate` is called again after the computation becomes valid again.
   * @locus Client
   * @param {Function} callback Function to be called on invalidation. Receives one argument, the computation that was invalidated.
   */
  onInvalidate(f) {
    if (typeof f !== 'function') throw new Error("onInvalidate requires a function");
    if (this.invalidated) {
      Tracker.nonreactive(() => {
        withNoYieldsAllowed(f)(this);
      });
    } else {
      this._onInvalidateCallbacks.push(f);
    }
  }

  /**
   * @summary Registers `callback` to run when this computation is stopped, or runs it immediately if the computation is already stopped.  The callback is run after any `onInvalidate` callbacks.
   * @locus Client
   * @param {Function} callback Function to be called on stop. Receives one argument, the computation that was stopped.
   */
  onStop(f) {
    if (typeof f !== 'function') throw new Error("onStop requires a function");
    if (this.stopped) {
      Tracker.nonreactive(() => {
        withNoYieldsAllowed(f)(this);
      });
    } else {
      this._onStopCallbacks.push(f);
    }
  }

  // http://docs.meteor.com/#computation_invalidate

  /**
   * @summary Invalidates this computation so that it will be rerun.
   * @locus Client
   */
  invalidate() {
    if (!this.invalidated) {
      // if we're currently in _recompute(), don't enqueue
      // ourselves, since we'll rerun immediately anyway.
      if (!this._recomputing && !this.stopped) {
        requireFlush();
        pendingComputations.push(this);
      }
      this.invalidated = true;

      // callbacks can't add callbacks, because
      // this.invalidated === true.
      for (var i = 0, f; f = this._onInvalidateCallbacks[i]; i++) {
        Tracker.nonreactive(() => {
          withNoYieldsAllowed(f)(this);
        });
      }
      this._onInvalidateCallbacks = [];
    }
  }

  // http://docs.meteor.com/#computation_stop

  /**
   * @summary Prevents this computation from rerunning.
   * @locus Client
   */
  stop() {
    if (!this.stopped) {
      this.stopped = true;
      this.invalidate();
      for (var i = 0, f; f = this._onStopCallbacks[i]; i++) {
        Tracker.nonreactive(() => {
          withNoYieldsAllowed(f)(this);
        });
      }
      this._onStopCallbacks = [];
    }
  }
  _compute() {
    this.invalidated = false;
    var previousInCompute = inCompute;
    inCompute = true;
    try {
      Tracker.withComputation(this, () => {
        withNoYieldsAllowed(this._func)(this);
      });
    } finally {
      inCompute = previousInCompute;
    }
  }
  _needsRecompute() {
    return this.invalidated && !this.stopped;
  }
  _recompute() {
    this._recomputing = true;
    try {
      if (this._needsRecompute()) {
        try {
          this._compute();
        } catch (e) {
          if (this._onError) {
            this._onError(e);
          } else {
            _throwOrLog("recompute", e);
          }
        }
      }
    } finally {
      this._recomputing = false;
    }
  }

  /**
   * @summary Process the reactive updates for this computation immediately
   * and ensure that the computation is rerun. The computation is rerun only
   * if it is invalidated.
   * @locus Client
   */
  flush() {
    if (this._recomputing) return;
    this._recompute();
  }

  /**
   * @summary Causes the function inside this computation to run and
   * synchronously process all reactive updtes.
   * @locus Client
   */
  run() {
    this.invalidate();
    this.flush();
  }
};

//
// http://docs.meteor.com/#tracker_dependency

/**
 * @summary A Dependency represents an atomic unit of reactive data that a
 * computation might depend on. Reactive data sources such as Session or
 * Minimongo internally create different Dependency objects for different
 * pieces of data, each of which may be depended on by multiple computations.
 * When the data changes, the computations are invalidated.
 * @class
 * @instanceName dependency
 */
Tracker.Dependency = class Dependency {
  constructor() {
    this._dependentsById = Object.create(null);
  }

  // http://docs.meteor.com/#dependency_depend
  //
  // Adds `computation` to this set if it is not already
  // present.  Returns true if `computation` is a new member of the set.
  // If no argument, defaults to currentComputation, or does nothing
  // if there is no currentComputation.

  /**
   * @summary Declares that the current computation (or `fromComputation` if given) depends on `dependency`.  The computation will be invalidated the next time `dependency` changes.
    If there is no current computation and `depend()` is called with no arguments, it does nothing and returns false.
    Returns true if the computation is a new dependent of `dependency` rather than an existing one.
   * @locus Client
   * @param {Tracker.Computation} [fromComputation] An optional computation declared to depend on `dependency` instead of the current computation.
   * @returns {Boolean}
   */
  depend(computation) {
    if (!computation) {
      if (!Tracker.active) return false;
      computation = Tracker.currentComputation;
    }
    var id = computation._id;
    if (!(id in this._dependentsById)) {
      this._dependentsById[id] = computation;
      computation.onInvalidate(() => {
        delete this._dependentsById[id];
      });
      return true;
    }
    return false;
  }

  // http://docs.meteor.com/#dependency_changed

  /**
   * @summary Invalidate all dependent computations immediately and remove them as dependents.
   * @locus Client
   */
  changed() {
    for (var id in this._dependentsById) this._dependentsById[id].invalidate();
  }

  // http://docs.meteor.com/#dependency_hasdependents

  /**
   * @summary True if this Dependency has one or more dependent Computations, which would be invalidated if this Dependency were to change.
   * @locus Client
   * @returns {Boolean}
   */
  hasDependents() {
    for (var id in this._dependentsById) return true;
    return false;
  }
};

// http://docs.meteor.com/#tracker_flush

/**
 * @summary Process all reactive updates immediately and ensure that all invalidated computations are rerun.
 * @locus Client
 */
Tracker.flush = function (options) {
  Tracker._runFlush({
    finishSynchronously: true,
    throwFirstError: options && options._throwFirstError
  });
};

/**
 * @summary True if we are computing a computation now, either first time or recompute.  This matches Tracker.active unless we are inside Tracker.nonreactive, which nullfies currentComputation even though an enclosing computation may still be running.
 * @locus Client
 * @returns {Boolean}
 */
Tracker.inFlush = function () {
  return inFlush;
};

// Run all pending computations and afterFlush callbacks.  If we were not called
// directly via Tracker.flush, this may return before they're all done to allow
// the event loop to run a little before continuing.
Tracker._runFlush = function (options) {
  // XXX What part of the comment below is still true? (We no longer
  // have Spark)
  //
  // Nested flush could plausibly happen if, say, a flush causes
  // DOM mutation, which causes a "blur" event, which runs an
  // app event handler that calls Tracker.flush.  At the moment
  // Spark blocks event handlers during DOM mutation anyway,
  // because the LiveRange tree isn't valid.  And we don't have
  // any useful notion of a nested flush.
  //
  // https://app.asana.com/0/159908330244/385138233856
  if (Tracker.inFlush()) throw new Error("Can't call Tracker.flush while flushing");
  if (inCompute) throw new Error("Can't flush inside Tracker.autorun");
  options = options || {};
  inFlush = true;
  willFlush = true;
  throwFirstError = !!options.throwFirstError;
  var recomputedCount = 0;
  var finishedTry = false;
  try {
    while (pendingComputations.length || afterFlushCallbacks.length) {
      // recompute all pending computations
      while (pendingComputations.length) {
        var comp = pendingComputations.shift();
        comp._recompute();
        if (comp._needsRecompute()) {
          pendingComputations.unshift(comp);
        }
        if (!options.finishSynchronously && ++recomputedCount > 1000) {
          finishedTry = true;
          return;
        }
      }
      if (afterFlushCallbacks.length) {
        // call one afterFlush callback, which may
        // invalidate more computations
        var func = afterFlushCallbacks.shift();
        try {
          func();
        } catch (e) {
          _throwOrLog("afterFlush", e);
        }
      }
    }
    finishedTry = true;
  } finally {
    if (!finishedTry) {
      // we're erroring due to throwFirstError being true.
      inFlush = false; // needed before calling `Tracker.flush()` again
      // finish flushing
      Tracker._runFlush({
        finishSynchronously: options.finishSynchronously,
        throwFirstError: false
      });
    }
    willFlush = false;
    inFlush = false;
    if (pendingComputations.length || afterFlushCallbacks.length) {
      // We're yielding because we ran a bunch of computations and we aren't
      // required to finish synchronously, so we'd like to give the event loop a
      // chance. We should flush again soon.
      if (options.finishSynchronously) {
        throw new Error("still have more to do?"); // shouldn't happen
      }

      setTimeout(requireFlush, 10);
    }
  }
};

// http://docs.meteor.com/#tracker_autorun
//
// Run f(). Record its dependencies. Rerun it whenever the
// dependencies change.
//
// Returns a new Computation, which is also passed to f.
//
// Links the computation to the current computation
// so that it is stopped if the current computation is invalidated.

/**
 * @callback Tracker.ComputationFunction
 * @param {Tracker.Computation}
 */
/**
 * @summary Run a function now and rerun it later whenever its dependencies
 * change. Returns a Computation object that can be used to stop or observe the
 * rerunning.
 * @locus Client
 * @param {Tracker.ComputationFunction} runFunc The function to run. It receives
 * one argument: the Computation object that will be returned.
 * @param {Object} [options]
 * @param {Function} options.onError Optional. The function to run when an error
 * happens in the Computation. The only argument it receives is the Error
 * thrown. Defaults to the error being logged to the console.
 * @returns {Tracker.Computation}
 */
Tracker.autorun = function (f, options) {
  if (typeof f !== 'function') throw new Error('Tracker.autorun requires a function argument');
  options = options || {};
  constructingComputation = true;
  var c = new Tracker.Computation(f, Tracker.currentComputation, options.onError);
  if (Tracker.active) Tracker.onInvalidate(function () {
    c.stop();
  });
  return c;
};

// http://docs.meteor.com/#tracker_nonreactive
//
// Run `f` with no current computation, returning the return value
// of `f`.  Used to turn off reactivity for the duration of `f`,
// so that reactive data sources accessed by `f` will not result in any
// computations being invalidated.

/**
 * @summary Run a function without tracking dependencies.
 * @locus Client
 * @param {Function} func A function to call immediately.
 */
Tracker.nonreactive = function (f) {
  return Tracker.withComputation(null, f);
};
Tracker.withComputation = function (computation, f) {
  var previousComputation = Tracker.currentComputation;
  Tracker.currentComputation = computation;
  Tracker.active = !!computation;
  try {
    return f();
  } finally {
    Tracker.currentComputation = previousComputation;
    Tracker.active = !!previousComputation;
  }
};

// http://docs.meteor.com/#tracker_oninvalidate

/**
 * @summary Registers a new [`onInvalidate`](#computation_oninvalidate) callback on the current computation (which must exist), to be called immediately when the current computation is invalidated or stopped.
 * @locus Client
 * @param {Function} callback A callback function that will be invoked as `func(c)`, where `c` is the computation on which the callback is registered.
 */
Tracker.onInvalidate = function (f) {
  if (!Tracker.active) throw new Error("Tracker.onInvalidate requires a currentComputation");
  Tracker.currentComputation.onInvalidate(f);
};

// http://docs.meteor.com/#tracker_afterflush

/**
 * @summary Schedules a function to be called during the next flush, or later in the current flush if one is in progress, after all invalidated computations have been rerun.  The function will be run once and not on subsequent flushes unless `afterFlush` is called again.
 * @locus Client
 * @param {Function} callback A function to call at flush time.
 */
Tracker.afterFlush = function (f) {
  afterFlushCallbacks.push(f);
  requireFlush();
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/tracker/tracker.js");

/* Exports */
Package._define("tracker", {
  Tracker: Tracker,
  Deps: Deps
});

})();

//# sourceURL=meteor://💻app/packages/tracker.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdHJhY2tlci90cmFja2VyLmpzIl0sIm5hbWVzIjpbIlRyYWNrZXIiLCJEZXBzIiwiYWN0aXZlIiwiY3VycmVudENvbXB1dGF0aW9uIiwiX2RlYnVnRnVuYyIsIk1ldGVvciIsIl9kZWJ1ZyIsImNvbnNvbGUiLCJlcnJvciIsImFwcGx5IiwiYXJndW1lbnRzIiwiX21heWJlU3VwcHJlc3NNb3JlTG9ncyIsIm1lc3NhZ2VzTGVuZ3RoIiwiX3N1cHByZXNzZWRfbG9nX2V4cGVjdGVkIiwiX3N1cHByZXNzX2xvZyIsIl90aHJvd09yTG9nIiwiZnJvbSIsImUiLCJ0aHJvd0ZpcnN0RXJyb3IiLCJwcmludEFyZ3MiLCJzdGFjayIsIm1lc3NhZ2UiLCJuYW1lIiwiaWR4IiwiaW5kZXhPZiIsImxlbmd0aCIsInB1c2giLCJpIiwid2l0aE5vWWllbGRzQWxsb3dlZCIsImYiLCJpc0NsaWVudCIsImFyZ3MiLCJfbm9ZaWVsZHNBbGxvd2VkIiwibmV4dElkIiwicGVuZGluZ0NvbXB1dGF0aW9ucyIsIndpbGxGbHVzaCIsImluRmx1c2giLCJpbkNvbXB1dGUiLCJhZnRlckZsdXNoQ2FsbGJhY2tzIiwicmVxdWlyZUZsdXNoIiwiX3NldEltbWVkaWF0ZSIsIl9ydW5GbHVzaCIsInNldFRpbWVvdXQiLCJjb25zdHJ1Y3RpbmdDb21wdXRhdGlvbiIsIkNvbXB1dGF0aW9uIiwiY29uc3RydWN0b3IiLCJwYXJlbnQiLCJvbkVycm9yIiwiRXJyb3IiLCJzdG9wcGVkIiwiaW52YWxpZGF0ZWQiLCJmaXJzdFJ1biIsIl9pZCIsIl9vbkludmFsaWRhdGVDYWxsYmFja3MiLCJfb25TdG9wQ2FsbGJhY2tzIiwiX3BhcmVudCIsIl9mdW5jIiwiX29uRXJyb3IiLCJfcmVjb21wdXRpbmciLCJlcnJvcmVkIiwiX2NvbXB1dGUiLCJzdG9wIiwib25JbnZhbGlkYXRlIiwibm9ucmVhY3RpdmUiLCJvblN0b3AiLCJpbnZhbGlkYXRlIiwicHJldmlvdXNJbkNvbXB1dGUiLCJ3aXRoQ29tcHV0YXRpb24iLCJfbmVlZHNSZWNvbXB1dGUiLCJfcmVjb21wdXRlIiwiZmx1c2giLCJydW4iLCJEZXBlbmRlbmN5IiwiX2RlcGVuZGVudHNCeUlkIiwiT2JqZWN0IiwiY3JlYXRlIiwiZGVwZW5kIiwiY29tcHV0YXRpb24iLCJpZCIsImNoYW5nZWQiLCJoYXNEZXBlbmRlbnRzIiwib3B0aW9ucyIsImZpbmlzaFN5bmNocm9ub3VzbHkiLCJfdGhyb3dGaXJzdEVycm9yIiwicmVjb21wdXRlZENvdW50IiwiZmluaXNoZWRUcnkiLCJjb21wIiwic2hpZnQiLCJ1bnNoaWZ0IiwiZnVuYyIsImF1dG9ydW4iLCJjIiwicHJldmlvdXNDb21wdXRhdGlvbiIsImFmdGVyRmx1c2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBQSxPQUFPLEdBQUcsQ0FBQyxDQUFDOztBQUVaO0FBQ0E7QUFDQTtBQUNBO0FBQ0FDLElBQUksR0FBR0QsT0FBTzs7QUFFZDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FBLE9BQU8sQ0FBQ0UsTUFBTSxHQUFHLEtBQUs7O0FBRXRCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQUYsT0FBTyxDQUFDRyxrQkFBa0IsR0FBRyxJQUFJO0FBRWpDLFNBQVNDLFVBQVUsR0FBRztFQUNwQjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsT0FBUSxPQUFPQyxNQUFNLEtBQUssV0FBVyxHQUFHQSxNQUFNLENBQUNDLE1BQU0sR0FDM0MsT0FBT0MsT0FBTyxLQUFLLFdBQVcsSUFBS0EsT0FBTyxDQUFDQyxLQUFLLEdBQ2pELFlBQVk7SUFBRUQsT0FBTyxDQUFDQyxLQUFLLENBQUNDLEtBQUssQ0FBQ0YsT0FBTyxFQUFFRyxTQUFTLENBQUM7RUFBRSxDQUFDLEdBQ3hELFlBQVksQ0FBQyxDQUFFO0FBQzFCO0FBRUEsU0FBU0Msc0JBQXNCLENBQUNDLGNBQWMs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Q0UsTUFBTSxHQUFHLENBQUMsQ0FBQzBGLG1CQUFtQjtFQUN4QztBQUNGLENBQUM7O0FBRUQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBNUYsT0FBTyxDQUFDOEQsWUFBWSxHQUFHLFVBQVVqQyxDQUFDLEVBQUU7RUFDbEMsSUFBSSxDQUFFN0IsT0FBTyxDQUFDRSxNQUFNLEVBQ2xCLE1BQU0sSUFBSThDLEtBQUssQ0FBQyxvREFBb0QsQ0FBQztFQUV2RWhELE9BQU8sQ0FBQ0csa0JBQWtCLENBQUMyRCxZQUFZLENBQUNqQyxDQUFDLENBQUM7QUFDNUMsQ0FBQzs7QUFFRDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E3QixPQUFPLENBQUM2RixVQUFVLEdBQUcsVUFBVWhFLENBQUMsRUFBRTtFQUNoQ1MsbUJBQW1CLENBQUNaLElBQUksQ0FBQ0csQ0FBQyxDQUFDO0VBQzNCVSxZQUFZLEVBQUU7QUFDaEIsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy90cmFja2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFBhY2thZ2UgZG9jcyBhdCBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyN0cmFja2VyIC8vXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgVHJhY2tlclxuICogQHN1bW1hcnkgVGhlIG5hbWVzcGFjZSBmb3IgVHJhY2tlci1yZWxhdGVkIG1ldGhvZHMuXG4gKi9cblRyYWNrZXIgPSB7fTtcblxuLyoqXG4gKiBAbmFtZXNwYWNlIERlcHNcbiAqIEBkZXByZWNhdGVkXG4gKi9cbkRlcHMgPSBUcmFja2VyO1xuXG4vLyBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyN0cmFja2VyX2FjdGl2ZVxuXG4vKipcbiAqIEBzdW1tYXJ5IFRydWUgaWYgdGhlcmUgaXMgYSBjdXJyZW50IGNvbXB1dGF0aW9uLCBtZWFuaW5nIHRoYXQgZGVwZW5kZW5jaWVzIG9uIHJlYWN0aXZlIGRhdGEgc291cmNlcyB3aWxsIGJlIHRyYWNrZWQgYW5kIHBvdGVudGlhbGx5IGNhdXNlIHRoZSBjdXJyZW50IGNvbXB1dGF0aW9uIHRvIGJlIHJlcnVuLlxuICogQGxvY3VzIENsaWVudFxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cblRyYWNrZXIuYWN0aXZlID0gZmFsc2U7XG5cbi8vIGh0dHA6Ly9kb2NzLm1ldGVvci5jb20vI3RyYWNrZXJfY3VycmVudGNvbXB1dGF0aW9uXG5cbi8qKlxuICogQHN1bW1hcnkgVGhlIGN1cnJlbnQgY29tcHV0YXRpb24sIG9yIGBudWxsYCBpZiB0aGVyZSBpc24ndCBvbmUuICBUaGUgY3VycmVudCBjb21wdXRhdGlvbiBpcyB0aGUgW2BUcmFja2VyLkNvbXB1dGF0aW9uYF0oI3RyYWNrZXJfY29tcHV0YXRpb24pIG9iamVjdCBjcmVhdGVkIGJ5IHRoZSBpbm5lcm1vc3QgYWN0aXZlIGNhbGwgdG8gYFRyYWNrZXIuYXV0b3J1bmAsIGFuZCBpdCdzIHRoZSBjb21wdXRhdGlvbiB0aGF0IGdhaW5zIGRlcGVuZGVuY2llcyB3aGVuIHJlYWN0aXZlIGRhdGEgc291cmNlcyBhcmUgYWNjZXNzZWQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAdHlwZSB7VHJhY2tlci5Db21wdXRhdGlvbn1cbiAqL1xuVHJhY2tlci5jdXJyZW50Q29tcHV0YXRpb24gPSBudWxsO1xuXG5mdW5jdGlvbiBfZGVidWdGdW5jKCkge1xuICAvLyBXZSB3YW50IHRoaXMgY29kZSB0byB3b3JrIHdpdGhvdXQgTWV0ZW9yLCBhbmQgYWxzbyB3aXRob3V0XG4gIC8vIFwiY29uc29sZVwiICh3aGljaCBpcyB0ZWNobmljYWxseSBub24tc3RhbmRhcmQgYW5kIG1heSBiZSBtaXNzaW5nXG4gIC8vIG9uIHNvbWUgYnJvd3NlciB3ZSBjb21lIGFjcm9zcywgbGlrZSBpdCB3YXMgb24gSUUgNykuXG4gIC8vXG4gIC8vIExhenkgZXZhbHVhdGlvbiBiZWNhdXNlIGBNZXRlb3JgIGRvZXMgbm90IGV4aXN0IHJpZ2h0IGF3YXkuKD8/KVxuICByZXR1cm4gKHR5cGVvZiBNZXRlb3IgIT09IFwidW5kZWZpbmVkXCIgPyBNZXRlb3IuX2RlYnVnIDpcbiAgICAgICAgICAoKHR5cGVvZiBjb25zb2xlICE9PSBcInVuZGVmaW5lZFwiKSAmJiBjb25zb2xlLmVycm9yID9cbiAgICAgICAgICAgZnVuY3Rpb24gKCkgeyBjb25zb2xlLmVycm9yLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7IH0gOlxuICAgICAgICAgICBmdW5jdGlvbiAoKSB7fSkpO1xufVxuXG5mdW5jdGlvbiBfbWF5YmVTdXBwcmVzc01vcmVMb2dzKG1lc3NhZ2VzTGVuZ3RoKSB7XG4gIC8vIFNvbWV0aW1lcyB3aGVuIHJ1bm5pbmcgdGVzdHMsIHdlIGludGVudGlvbmFsbHkgc3VwcHJlc3MgbG9ncyBvbiBleHBlY3RlZFxuICAvLyBwcmludGVkIGVycm9ycy4gU2luY2UgdGhlIGN1cnJlbnQgaW1wbGVtZW50YXRpb24gb2YgX3Rocm93T3JMb2cgY2FuIGxvZ1xuICAvLyBtdWx0aXBsZSBzZXBhcmF0ZSBsb2cgbWVzc2FnZXMsIHN1cHByZXNzIGFsbCBvZiB0aGVtIGlmIGF0IGxlYXN0IG9uZSBzdXBwcmVzc1xuICAvLyBpcyBleHBlY3RlZCBhcyB3ZSBzdGlsbCB3YW50IHRoZW0gdG8gY291bnQgYXMgb25lLlxuICBpZiAodHlwZW9mIE1ldGVvciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIGlmIChNZXRlb3IuX3N1cHByZXNzZWRfbG9nX2V4cGVjdGVkKCkpIHtcbiAgICAgIE1ldGVvci5fc3VwcHJlc3NfbG9nKG1lc3NhZ2VzTGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIF90aHJvd09yTG9nKGZyb20sIGUpIHtcbiAgaWYgKHRocm93Rmlyc3RFcnJvcikge1xuICAgIHRocm93IGU7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHByaW50QXJncyA9IFtcIkV4Y2VwdGlvbiBmcm9tIFRyYWNrZXIgXCIgKyBmcm9tICsgXCIgZnVuY3Rpb246XCJdO1xuICAgIGlmIChlLnN0YWNrICYmIGUubWVzc2FnZSAmJiBlLm5hbWUpIHtcbiAgICAgIHZhciBpZHggPSBlLnN0YWNrLmluZGV4T2YoZS5tZXNzYWdlKTtcbiAgICAgIGlmIChpZHggPCAwIHx8IGlkeCA+IGUubmFtZS5sZW5ndGggKyAyKSB7IC8vIGNoZWNrIGZvciBcIkVycm9yOiBcIlxuICAgICAgICAvLyBtZXNzYWdlIGlzIG5vdCBwYXJ0IG9mIHRoZSBzdGFja1xuICAgICAgICB2YXIgbWVzc2FnZSA9IGUubmFtZSArIFwiOiBcIiArIGUubWVzc2FnZTtcbiAgICAgICAgcHJpbnRBcmdzLnB1c2gobWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHByaW50QXJncy5wdXNoKGUuc3RhY2spO1xuICAgIF9tYXliZVN1cHByZXNzTW9yZUxvZ3MocHJpbnRBcmdzLmxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByaW50QXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgX2RlYnVnRnVuYygpKHByaW50QXJnc1tpXSk7XG4gICAgfVxuICB9XG59XG5cbi8vIFRha2VzIGEgZnVuY3Rpb24gYGZgLCBhbmQgd3JhcHMgaXQgaW4gYSBgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWRgXG4vLyBibG9jayBpZiB3ZSBhcmUgcnVubmluZyBvbiB0aGUgc2VydmVyLiBPbiB0aGUgY2xpZW50LCByZXR1cm5zIHRoZVxuLy8gb3JpZ2luYWwgZnVuY3Rpb24gKHNpbmNlIGBNZXRlb3IuX25vWWllbGRzQWxsb3dlZGAgaXMgYVxuLy8gbm8tb3ApLiBUaGlzIGhhcyB0aGUgYmVuZWZpdCBvZiBub3QgYWRkaW5nIGFuIHVubmVjZXNzYXJ5IHN0YWNrXG4vLyBmcmFtZSBvbiB0aGUgY2xpZW50LlxuZnVuY3Rpb24gd2l0aE5vWWllbGRzQWxsb3dlZChmKSB7XG4gIGlmICgodHlwZW9mIE1ldGVvciA9PT0gJ3VuZGVmaW5lZCcpIHx8IE1ldGVvci5pc0NsaWVudCkge1xuICAgIHJldHVybiBmO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cbn1cblxudmFyIG5leHRJZCA9IDE7XG4vLyBjb21wdXRhdGlvbnMgd2hvc2UgY2FsbGJhY2tzIHdlIHNob3VsZCBjYWxsIGF0IGZsdXNoIHRpbWVcbnZhciBwZW5kaW5nQ29tcHV0YXRpb25zID0gW107XG4vLyBgdHJ1ZWAgaWYgYSBUcmFja2VyLmZsdXNoIGlzIHNjaGVkdWxlZCwgb3IgaWYgd2UgYXJlIGluIFRyYWNrZXIuZmx1c2ggbm93XG52YXIgd2lsbEZsdXNoID0gZmFsc2U7XG4vLyBgdHJ1ZWAgaWYgd2UgYXJlIGluIFRyYWNrZXIuZmx1c2ggbm93XG52YXIgaW5GbHVzaCA9IGZhbHNlO1xuLy8gYHRydWVgIGlmIHdlIGFyZSBjb21wdXRpbmcgYSBjb21wdXRhdGlvbiBub3csIGVpdGhlciBmaXJzdCB0aW1lXG4vLyBvciByZWNvbXB1dGUuICBUaGlzIG1hdGNoZXMgVHJhY2tlci5hY3RpdmUgdW5sZXNzIHdlIGFyZSBpbnNpZGVcbi8vIFRyYWNrZXIubm9ucmVhY3RpdmUsIHdoaWNoIG51bGxmaWVzIGN1cnJlbnRDb21wdXRhdGlvbiBldmVuIHRob3VnaFxuLy8gYW4gZW5jbG9zaW5nIGNvbXB1dGF0aW9uIG1heSBzdGlsbCBiZSBydW5uaW5nLlxudmFyIGluQ29tcHV0ZSA9IGZhbHNlO1xuLy8gYHRydWVgIGlmIHRoZSBgX3Rocm93Rmlyc3RFcnJvcmAgb3B0aW9uIHdhcyBwYXNzZWQgaW4gdG8gdGhlIGNhbGxcbi8vIHRvIFRyYWNrZXIuZmx1c2ggdGhhdCB3ZSBhcmUgaW4uIFdoZW4gc2V0LCB0aHJvdyByYXRoZXIgdGhhbiBsb2cgdGhlXG4vLyBmaXJzdCBlcnJvciBlbmNvdW50ZXJlZCB3aGlsZSBmbHVzaGluZy4gQmVmb3JlIHRocm93aW5nIHRoZSBlcnJvcixcbi8vIGZpbmlzaCBmbHVzaGluZyAoZnJvbSBhIGZpbmFsbHkgYmxvY2spLCBsb2dnaW5nIGFueSBzdWJzZXF1ZW50XG4vLyBlcnJvcnMuXG52YXIgdGhyb3dGaXJzdEVycm9yID0gZmFsc2U7XG5cbnZhciBhZnRlckZsdXNoQ2FsbGJhY2tzID0gW107XG5cbmZ1bmN0aW9uIHJlcXVpcmVGbHVzaCgpIHtcbiAgaWYgKCEgd2lsbEZsdXNoKSB7XG4gICAgLy8gV2Ugd2FudCB0aGlzIGNvZGUgdG8gd29yayB3aXRob3V0IE1ldGVvciwgc2VlIGRlYnVnRnVuYyBhYm92ZVxuICAgIGlmICh0eXBlb2YgTWV0ZW9yICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgTWV0ZW9yLl9zZXRJbW1lZGlhdGUoVHJhY2tlci5fcnVuRmx1c2gpO1xuICAgIGVsc2VcbiAgICAgIHNldFRpbWVvdXQoVHJhY2tlci5fcnVuRmx1c2gsIDApO1xuICAgIHdpbGxGbHVzaCA9IHRydWU7XG4gIH1cbn1cblxuLy8gVHJhY2tlci5Db21wdXRhdGlvbiBjb25zdHJ1Y3RvciBpcyB2aXNpYmxlIGJ1dCBwcml2YXRlXG4vLyAodGhyb3dzIGFuIGVycm9yIGlmIHlvdSB0cnkgdG8gY2FsbCBpdClcbnZhciBjb25zdHJ1Y3RpbmdDb21wdXRhdGlvbiA9IGZhbHNlO1xuXG4vL1xuLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jdHJhY2tlcl9jb21wdXRhdGlvblxuXG4vKipcbiAqIEBzdW1tYXJ5IEEgQ29tcHV0YXRpb24gb2JqZWN0IHJlcHJlc2VudHMgY29kZSB0aGF0IGlzIHJlcGVhdGVkbHkgcmVydW5cbiAqIGluIHJlc3BvbnNlIHRvXG4gKiByZWFjdGl2ZSBkYXRhIGNoYW5nZXMuIENvbXB1dGF0aW9ucyBkb24ndCBoYXZlIHJldHVybiB2YWx1ZXM7IHRoZXkganVzdFxuICogcGVyZm9ybSBhY3Rpb25zLCBzdWNoIGFzIHJlcmVuZGVyaW5nIGEgdGVtcGxhdGUgb24gdGhlIHNjcmVlbi4gQ29tcHV0YXRpb25zXG4gKiBhcmUgY3JlYXRlZCB1c2luZyBUcmFja2VyLmF1dG9ydW4uIFVzZSBzdG9wIHRvIHByZXZlbnQgZnVydGhlciByZXJ1bm5pbmcgb2YgYVxuICogY29tcHV0YXRpb24uXG4gKiBAaW5zdGFuY2VuYW1lIGNvbXB1dGF0aW9uXG4gKi9cblRyYWNrZXIuQ29tcHV0YXRpb24gPSBjbGFzcyBDb21wdXRhdGlvbiB7XG4gIGNvbnN0cnVjdG9yKGYsIHBhcmVudCwgb25FcnJvcikge1xuICAgIGlmICghIGNvbnN0cnVjdGluZ0NvbXB1dGF0aW9uKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIlRyYWNrZXIuQ29tcHV0YXRpb24gY29uc3RydWN0b3IgaXMgcHJpdmF0ZTsgdXNlIFRyYWNrZXIuYXV0b3J1blwiKTtcbiAgICBjb25zdHJ1Y3RpbmdDb21wdXRhdGlvbiA9IGZhbHNlO1xuXG4gICAgLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jY29tcHV0YXRpb25fc3RvcHBlZFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgVHJ1ZSBpZiB0aGlzIGNvbXB1dGF0aW9uIGhhcyBiZWVuIHN0b3BwZWQuXG4gICAgICogQGxvY3VzIENsaWVudFxuICAgICAqIEBtZW1iZXJPZiBUcmFja2VyLkNvbXB1dGF0aW9uXG4gICAgICogQGluc3RhbmNlXG4gICAgICogQG5hbWUgIHN0b3BwZWRcbiAgICAgKi9cbiAgICB0aGlzLnN0b3BwZWQgPSBmYWxzZTtcblxuICAgIC8vIGh0dHA6Ly9kb2NzLm1ldGVvci5jb20vI2NvbXB1dGF0aW9uX2ludmFsaWRhdGVkXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBUcnVlIGlmIHRoaXMgY29tcHV0YXRpb24gaGFzIGJlZW4gaW52YWxpZGF0ZWQgKGFuZCBub3QgeWV0IHJlcnVuKSwgb3IgaWYgaXQgaGFzIGJlZW4gc3RvcHBlZC5cbiAgICAgKiBAbG9jdXMgQ2xpZW50XG4gICAgICogQG1lbWJlck9mIFRyYWNrZXIuQ29tcHV0YXRpb25cbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbmFtZSAgaW52YWxpZGF0ZWRcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLmludmFsaWRhdGVkID0gZmFsc2U7XG5cbiAgICAvLyBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyNjb21wdXRhdGlvbl9maXJzdHJ1blxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgVHJ1ZSBkdXJpbmcgdGhlIGluaXRpYWwgcnVuIG9mIHRoZSBjb21wdXRhdGlvbiBhdCB0aGUgdGltZSBgVHJhY2tlci5hdXRvcnVuYCBpcyBjYWxsZWQsIGFuZCBmYWxzZSBvbiBzdWJzZXF1ZW50IHJlcnVucyBhbmQgYXQgb3RoZXIgdGltZXMuXG4gICAgICogQGxvY3VzIENsaWVudFxuICAgICAqIEBtZW1iZXJPZiBUcmFja2VyLkNvbXB1dGF0aW9uXG4gICAgICogQGluc3RhbmNlXG4gICAgICogQG5hbWUgIGZpcnN0UnVuXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5maXJzdFJ1biA9IHRydWU7XG5cbiAgICB0aGlzLl9pZCA9IG5leHRJZCsrO1xuICAgIHRoaXMuX29uSW52YWxpZGF0ZUNhbGxiYWNrcyA9IFtdO1xuICAgIHRoaXMuX29uU3RvcENhbGxiYWNrcyA9IFtdO1xuICAgIC8vIHRoZSBwbGFuIGlzIGF0IHNvbWUgcG9pbnQgdG8gdXNlIHRoZSBwYXJlbnQgcmVsYXRpb25cbiAgICAvLyB0byBjb25zdHJhaW4gdGhlIG9yZGVyIHRoYXQgY29tcHV0YXRpb25zIGFyZSBwcm9jZXNzZWRcbiAgICB0aGlzLl9wYXJlbnQgPSBwYXJlbnQ7XG4gICAgdGhpcy5fZnVuYyA9IGY7XG4gICAgdGhpcy5fb25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5fcmVjb21wdXRpbmcgPSBmYWxzZTtcblxuICAgIHZhciBlcnJvcmVkID0gdHJ1ZTtcbiAgICB0cnkge1xuICAgICAgdGhpcy5fY29tcHV0ZSgpO1xuICAgICAgZXJyb3JlZCA9IGZhbHNlO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmZpcnN0UnVuID0gZmFsc2U7XG4gICAgICBpZiAoZXJyb3JlZClcbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jY29tcHV0YXRpb25fb25pbnZhbGlkYXRlXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlZ2lzdGVycyBgY2FsbGJhY2tgIHRvIHJ1biB3aGVuIHRoaXMgY29tcHV0YXRpb24gaXMgbmV4dCBpbnZhbGlkYXRlZCwgb3IgcnVucyBpdCBpbW1lZGlhdGVseSBpZiB0aGUgY29tcHV0YXRpb24gaXMgYWxyZWFkeSBpbnZhbGlkYXRlZC4gIFRoZSBjYWxsYmFjayBpcyBydW4gZXhhY3RseSBvbmNlIGFuZCBub3QgdXBvbiBmdXR1cmUgaW52YWxpZGF0aW9ucyB1bmxlc3MgYG9uSW52YWxpZGF0ZWAgaXMgY2FsbGVkIGFnYWluIGFmdGVyIHRoZSBjb21wdXRhdGlvbiBiZWNvbWVzIHZhbGlkIGFnYWluLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBpbnZhbGlkYXRpb24uIFJlY2VpdmVzIG9uZSBhcmd1bWVudCwgdGhlIGNvbXB1dGF0aW9uIHRoYXQgd2FzIGludmFsaWRhdGVkLlxuICAgKi9cbiAgb25JbnZhbGlkYXRlKGYpIHtcbiAgICBpZiAodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvbkludmFsaWRhdGUgcmVxdWlyZXMgYSBmdW5jdGlvblwiKTtcblxuICAgIGlmICh0aGlzLmludmFsaWRhdGVkKSB7XG4gICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKCgpID0+IHtcbiAgICAgICAgd2l0aE5vWWllbGRzQWxsb3dlZChmKSh0aGlzKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9vbkludmFsaWRhdGVDYWxsYmFja3MucHVzaChmKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXJzIGBjYWxsYmFja2AgdG8gcnVuIHdoZW4gdGhpcyBjb21wdXRhdGlvbiBpcyBzdG9wcGVkLCBvciBydW5zIGl0IGltbWVkaWF0ZWx5IGlmIHRoZSBjb21wdXRhdGlvbiBpcyBhbHJlYWR5IHN0b3BwZWQuICBUaGUgY2FsbGJhY2sgaXMgcnVuIGFmdGVyIGFueSBgb25JbnZhbGlkYXRlYCBjYWxsYmFja3MuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uIHN0b3AuIFJlY2VpdmVzIG9uZSBhcmd1bWVudCwgdGhlIGNvbXB1dGF0aW9uIHRoYXQgd2FzIHN0b3BwZWQuXG4gICAqL1xuICBvblN0b3AoZikge1xuICAgIGlmICh0eXBlb2YgZiAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIm9uU3RvcCByZXF1aXJlcyBhIGZ1bmN0aW9uXCIpO1xuXG4gICAgaWYgKHRoaXMuc3RvcHBlZCkge1xuICAgICAgVHJhY2tlci5ub25yZWFjdGl2ZSgoKSA9PiB7XG4gICAgICAgIHdpdGhOb1lpZWxkc0FsbG93ZWQoZikodGhpcyk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fb25TdG9wQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgfVxuICB9XG5cbiAgLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jY29tcHV0YXRpb25faW52YWxpZGF0ZVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBJbnZhbGlkYXRlcyB0aGlzIGNvbXB1dGF0aW9uIHNvIHRoYXQgaXQgd2lsbCBiZSByZXJ1bi5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgaW52YWxpZGF0ZSgpIHtcbiAgICBpZiAoISB0aGlzLmludmFsaWRhdGVkKSB7XG4gICAgICAvLyBpZiB3ZSdyZSBjdXJyZW50bHkgaW4gX3JlY29tcHV0ZSgpLCBkb24ndCBlbnF1ZXVlXG4gICAgICAvLyBvdXJzZWx2ZXMsIHNpbmNlIHdlJ2xsIHJlcnVuIGltbWVkaWF0ZWx5IGFueXdheS5cbiAgICAgIGlmICghIHRoaXMuX3JlY29tcHV0aW5nICYmICEgdGhpcy5zdG9wcGVkKSB7XG4gICAgICAgIHJlcXVpcmVGbHVzaCgpO1xuICAgICAgICBwZW5kaW5nQ29tcHV0YXRpb25zLnB1c2godGhpcyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW52YWxpZGF0ZWQgPSB0cnVlO1xuXG4gICAgICAvLyBjYWxsYmFja3MgY2FuJ3QgYWRkIGNhbGxiYWNrcywgYmVjYXVzZVxuICAgICAgLy8gdGhpcy5pbnZhbGlkYXRlZCA9PT0gdHJ1ZS5cbiAgICAgIGZvcih2YXIgaSA9IDAsIGY7IGYgPSB0aGlzLl9vbkludmFsaWRhdGVDYWxsYmFja3NbaV07IGkrKykge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKCgpID0+IHtcbiAgICAgICAgICB3aXRoTm9ZaWVsZHNBbGxvd2VkKGYpKHRoaXMpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX29uSW52YWxpZGF0ZUNhbGxiYWNrcyA9IFtdO1xuICAgIH1cbiAgfVxuXG4gIC8vIGh0dHA6Ly9kb2NzLm1ldGVvci5jb20vI2NvbXB1dGF0aW9uX3N0b3BcblxuICAvKipcbiAgICogQHN1bW1hcnkgUHJldmVudHMgdGhpcyBjb21wdXRhdGlvbiBmcm9tIHJlcnVubmluZy5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgc3RvcCgpIHtcbiAgICBpZiAoISB0aGlzLnN0b3BwZWQpIHtcbiAgICAgIHRoaXMuc3RvcHBlZCA9IHRydWU7XG4gICAgICB0aGlzLmludmFsaWRhdGUoKTtcbiAgICAgIGZvcih2YXIgaSA9IDAsIGY7IGYgPSB0aGlzLl9vblN0b3BDYWxsYmFja3NbaV07IGkrKykge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKCgpID0+IHtcbiAgICAgICAgICB3aXRoTm9ZaWVsZHNBbGxvd2VkKGYpKHRoaXMpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX29uU3RvcENhbGxiYWNrcyA9IFtdO1xuICAgIH1cbiAgfVxuXG4gIF9jb21wdXRlKCkge1xuICAgIHRoaXMuaW52YWxpZGF0ZWQgPSBmYWxzZTtcblxuICAgIHZhciBwcmV2aW91c0luQ29tcHV0ZSA9IGluQ29tcHV0ZTtcbiAgICBpbkNvbXB1dGUgPSB0cnVlO1xuICAgIHRyeSB7XG4gICAgICBUcmFja2VyLndpdGhDb21wdXRhdGlvbih0aGlzLCAoKSA9PiB7XG4gICAgICAgIHdpdGhOb1lpZWxkc0FsbG93ZWQodGhpcy5fZnVuYykodGhpcyk7XG4gICAgICB9KTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgaW5Db21wdXRlID0gcHJldmlvdXNJbkNvbXB1dGU7XG4gICAgfVxuICB9XG5cbiAgX25lZWRzUmVjb21wdXRlKCkge1xuICAgIHJldHVybiB0aGlzLmludmFsaWRhdGVkICYmICEgdGhpcy5zdG9wcGVkO1xuICB9XG5cbiAgX3JlY29tcHV0ZSgpIHtcbiAgICB0aGlzLl9yZWNvbXB1dGluZyA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLl9uZWVkc1JlY29tcHV0ZSgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5fY29tcHV0ZSgpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgaWYgKHRoaXMuX29uRXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMuX29uRXJyb3IoZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF90aHJvd09yTG9nKFwicmVjb21wdXRlXCIsIGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLl9yZWNvbXB1dGluZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQcm9jZXNzIHRoZSByZWFjdGl2ZSB1cGRhdGVzIGZvciB0aGlzIGNvbXB1dGF0aW9uIGltbWVkaWF0ZWx5XG4gICAqIGFuZCBlbnN1cmUgdGhhdCB0aGUgY29tcHV0YXRpb24gaXMgcmVydW4uIFRoZSBjb21wdXRhdGlvbiBpcyByZXJ1biBvbmx5XG4gICAqIGlmIGl0IGlzIGludmFsaWRhdGVkLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBmbHVzaCgpIHtcbiAgICBpZiAodGhpcy5fcmVjb21wdXRpbmcpXG4gICAgICByZXR1cm47XG5cbiAgICB0aGlzLl9yZWNvbXB1dGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYXVzZXMgdGhlIGZ1bmN0aW9uIGluc2lkZSB0aGlzIGNvbXB1dGF0aW9uIHRvIHJ1biBhbmRcbiAgICogc3luY2hyb25vdXNseSBwcm9jZXNzIGFsbCByZWFjdGl2ZSB1cGR0ZXMuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHJ1bigpIHtcbiAgICB0aGlzLmludmFsaWRhdGUoKTtcbiAgICB0aGlzLmZsdXNoKCk7XG4gIH1cbn07XG5cbi8vXG4vLyBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyN0cmFja2VyX2RlcGVuZGVuY3lcblxuLyoqXG4gKiBAc3VtbWFyeSBBIERlcGVuZGVuY3kgcmVwcmVzZW50cyBhbiBhdG9taWMgdW5pdCBvZiByZWFjdGl2ZSBkYXRhIHRoYXQgYVxuICogY29tcHV0YXRpb24gbWlnaHQgZGVwZW5kIG9uLiBSZWFjdGl2ZSBkYXRhIHNvdXJjZXMgc3VjaCBhcyBTZXNzaW9uIG9yXG4gKiBNaW5pbW9uZ28gaW50ZXJuYWxseSBjcmVhdGUgZGlmZmVyZW50IERlcGVuZGVuY3kgb2JqZWN0cyBmb3IgZGlmZmVyZW50XG4gKiBwaWVjZXMgb2YgZGF0YSwgZWFjaCBvZiB3aGljaCBtYXkgYmUgZGVwZW5kZWQgb24gYnkgbXVsdGlwbGUgY29tcHV0YXRpb25zLlxuICogV2hlbiB0aGUgZGF0YSBjaGFuZ2VzLCB0aGUgY29tcHV0YXRpb25zIGFyZSBpbnZhbGlkYXRlZC5cbiAqIEBjbGFzc1xuICogQGluc3RhbmNlTmFtZSBkZXBlbmRlbmN5XG4gKi9cblRyYWNrZXIuRGVwZW5kZW5jeSA9IGNsYXNzIERlcGVuZGVuY3kge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9kZXBlbmRlbnRzQnlJZCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIH1cblxuICAvLyBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyNkZXBlbmRlbmN5X2RlcGVuZFxuICAvL1xuICAvLyBBZGRzIGBjb21wdXRhdGlvbmAgdG8gdGhpcyBzZXQgaWYgaXQgaXMgbm90IGFscmVhZHlcbiAgLy8gcHJlc2VudC4gIFJldHVybnMgdHJ1ZSBpZiBgY29tcHV0YXRpb25gIGlzIGEgbmV3IG1lbWJlciBvZiB0aGUgc2V0LlxuICAvLyBJZiBubyBhcmd1bWVudCwgZGVmYXVsdHMgdG8gY3VycmVudENvbXB1dGF0aW9uLCBvciBkb2VzIG5vdGhpbmdcbiAgLy8gaWYgdGhlcmUgaXMgbm8gY3VycmVudENvbXB1dGF0aW9uLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBEZWNsYXJlcyB0aGF0IHRoZSBjdXJyZW50IGNvbXB1dGF0aW9uIChvciBgZnJvbUNvbXB1dGF0aW9uYCBpZiBnaXZlbikgZGVwZW5kcyBvbiBgZGVwZW5kZW5jeWAuICBUaGUgY29tcHV0YXRpb24gd2lsbCBiZSBpbnZhbGlkYXRlZCB0aGUgbmV4dCB0aW1lIGBkZXBlbmRlbmN5YCBjaGFuZ2VzLlxuXG4gICBJZiB0aGVyZSBpcyBubyBjdXJyZW50IGNvbXB1dGF0aW9uIGFuZCBgZGVwZW5kKClgIGlzIGNhbGxlZCB3aXRoIG5vIGFyZ3VtZW50cywgaXQgZG9lcyBub3RoaW5nIGFuZCByZXR1cm5zIGZhbHNlLlxuXG4gICBSZXR1cm5zIHRydWUgaWYgdGhlIGNvbXB1dGF0aW9uIGlzIGEgbmV3IGRlcGVuZGVudCBvZiBgZGVwZW5kZW5jeWAgcmF0aGVyIHRoYW4gYW4gZXhpc3Rpbmcgb25lLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBwYXJhbSB7VHJhY2tlci5Db21wdXRhdGlvbn0gW2Zyb21Db21wdXRhdGlvbl0gQW4gb3B0aW9uYWwgY29tcHV0YXRpb24gZGVjbGFyZWQgdG8gZGVwZW5kIG9uIGBkZXBlbmRlbmN5YCBpbnN0ZWFkIG9mIHRoZSBjdXJyZW50IGNvbXB1dGF0aW9uLlxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICovXG4gIGRlcGVuZChjb21wdXRhdGlvbikge1xuICAgIGlmICghIGNvbXB1dGF0aW9uKSB7XG4gICAgICBpZiAoISBUcmFja2VyLmFjdGl2ZSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBjb21wdXRhdGlvbiA9IFRyYWNrZXIuY3VycmVudENvbXB1dGF0aW9uO1xuICAgIH1cbiAgICB2YXIgaWQgPSBjb21wdXRhdGlvbi5faWQ7XG4gICAgaWYgKCEgKGlkIGluIHRoaXMuX2RlcGVuZGVudHNCeUlkKSkge1xuICAgICAgdGhpcy5fZGVwZW5kZW50c0J5SWRbaWRdID0gY29tcHV0YXRpb247XG4gICAgICBjb21wdXRhdGlvbi5vbkludmFsaWRhdGUoKCkgPT4ge1xuICAgICAgICBkZWxldGUgdGhpcy5fZGVwZW5kZW50c0J5SWRbaWRdO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jZGVwZW5kZW5jeV9jaGFuZ2VkXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEludmFsaWRhdGUgYWxsIGRlcGVuZGVudCBjb21wdXRhdGlvbnMgaW1tZWRpYXRlbHkgYW5kIHJlbW92ZSB0aGVtIGFzIGRlcGVuZGVudHMuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIGNoYW5nZWQoKSB7XG4gICAgZm9yICh2YXIgaWQgaW4gdGhpcy5fZGVwZW5kZW50c0J5SWQpXG4gICAgICB0aGlzLl9kZXBlbmRlbnRzQnlJZFtpZF0uaW52YWxpZGF0ZSgpO1xuICB9XG5cbiAgLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jZGVwZW5kZW5jeV9oYXNkZXBlbmRlbnRzXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFRydWUgaWYgdGhpcyBEZXBlbmRlbmN5IGhhcyBvbmUgb3IgbW9yZSBkZXBlbmRlbnQgQ29tcHV0YXRpb25zLCB3aGljaCB3b3VsZCBiZSBpbnZhbGlkYXRlZCBpZiB0aGlzIERlcGVuZGVuY3kgd2VyZSB0byBjaGFuZ2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAqL1xuICBoYXNEZXBlbmRlbnRzKCkge1xuICAgIGZvciAodmFyIGlkIGluIHRoaXMuX2RlcGVuZGVudHNCeUlkKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59O1xuXG4vLyBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyN0cmFja2VyX2ZsdXNoXG5cbi8qKlxuICogQHN1bW1hcnkgUHJvY2VzcyBhbGwgcmVhY3RpdmUgdXBkYXRlcyBpbW1lZGlhdGVseSBhbmQgZW5zdXJlIHRoYXQgYWxsIGludmFsaWRhdGVkIGNvbXB1dGF0aW9ucyBhcmUgcmVydW4uXG4gKiBAbG9jdXMgQ2xpZW50XG4gKi9cblRyYWNrZXIuZmx1c2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBUcmFja2VyLl9ydW5GbHVzaCh7IGZpbmlzaFN5bmNocm9ub3VzbHk6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgdGhyb3dGaXJzdEVycm9yOiBvcHRpb25zICYmIG9wdGlvbnMuX3Rocm93Rmlyc3RFcnJvciB9KTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgVHJ1ZSBpZiB3ZSBhcmUgY29tcHV0aW5nIGEgY29tcHV0YXRpb24gbm93LCBlaXRoZXIgZmlyc3QgdGltZSBvciByZWNvbXB1dGUuICBUaGlzIG1hdGNoZXMgVHJhY2tlci5hY3RpdmUgdW5sZXNzIHdlIGFyZSBpbnNpZGUgVHJhY2tlci5ub25yZWFjdGl2ZSwgd2hpY2ggbnVsbGZpZXMgY3VycmVudENvbXB1dGF0aW9uIGV2ZW4gdGhvdWdoIGFuIGVuY2xvc2luZyBjb21wdXRhdGlvbiBtYXkgc3RpbGwgYmUgcnVubmluZy5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICovXG5UcmFja2VyLmluRmx1c2ggPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBpbkZsdXNoO1xufVxuXG4vLyBSdW4gYWxsIHBlbmRpbmcgY29tcHV0YXRpb25zIGFuZCBhZnRlckZsdXNoIGNhbGxiYWNrcy4gIElmIHdlIHdlcmUgbm90IGNhbGxlZFxuLy8gZGlyZWN0bHkgdmlhIFRyYWNrZXIuZmx1c2gsIHRoaXMgbWF5IHJldHVybiBiZWZvcmUgdGhleSdyZSBhbGwgZG9uZSB0byBhbGxvd1xuLy8gdGhlIGV2ZW50IGxvb3AgdG8gcnVuIGEgbGl0dGxlIGJlZm9yZSBjb250aW51aW5nLlxuVHJhY2tlci5fcnVuRmx1c2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAvLyBYWFggV2hhdCBwYXJ0IG9mIHRoZSBjb21tZW50IGJlbG93IGlzIHN0aWxsIHRydWU/IChXZSBubyBsb25nZXJcbiAgLy8gaGF2ZSBTcGFyaylcbiAgLy9cbiAgLy8gTmVzdGVkIGZsdXNoIGNvdWxkIHBsYXVzaWJseSBoYXBwZW4gaWYsIHNheSwgYSBmbHVzaCBjYXVzZXNcbiAgLy8gRE9NIG11dGF0aW9uLCB3aGljaCBjYXVzZXMgYSBcImJsdXJcIiBldmVudCwgd2hpY2ggcnVucyBhblxuICAvLyBhcHAgZXZlbnQgaGFuZGxlciB0aGF0IGNhbGxzIFRyYWNrZXIuZmx1c2guICBBdCB0aGUgbW9tZW50XG4gIC8vIFNwYXJrIGJsb2NrcyBldmVudCBoYW5kbGVycyBkdXJpbmcgRE9NIG11dGF0aW9uIGFueXdheSxcbiAgLy8gYmVjYXVzZSB0aGUgTGl2ZVJhbmdlIHRyZWUgaXNuJ3QgdmFsaWQuICBBbmQgd2UgZG9uJ3QgaGF2ZVxuICAvLyBhbnkgdXNlZnVsIG5vdGlvbiBvZiBhIG5lc3RlZCBmbHVzaC5cbiAgLy9cbiAgLy8gaHR0cHM6Ly9hcHAuYXNhbmEuY29tLzAvMTU5OTA4MzMwMjQ0LzM4NTEzODIzMzg1NlxuICBpZiAoVHJhY2tlci5pbkZsdXNoKCkpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBUcmFja2VyLmZsdXNoIHdoaWxlIGZsdXNoaW5nXCIpO1xuXG4gIGlmIChpbkNvbXB1dGUpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgZmx1c2ggaW5zaWRlIFRyYWNrZXIuYXV0b3J1blwiKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBpbkZsdXNoID0gdHJ1ZTtcbiAgd2lsbEZsdXNoID0gdHJ1ZTtcbiAgdGhyb3dGaXJzdEVycm9yID0gISEgb3B0aW9ucy50aHJvd0ZpcnN0RXJyb3I7XG5cbiAgdmFyIHJlY29tcHV0ZWRDb3VudCA9IDA7XG4gIHZhciBmaW5pc2hlZFRyeSA9IGZhbHNlO1xuICB0cnkge1xuICAgIHdoaWxlIChwZW5kaW5nQ29tcHV0YXRpb25zLmxlbmd0aCB8fFxuICAgICAgICAgICBhZnRlckZsdXNoQ2FsbGJhY2tzLmxlbmd0aCkge1xuXG4gICAgICAvLyByZWNvbXB1dGUgYWxsIHBlbmRpbmcgY29tcHV0YXRpb25zXG4gICAgICB3aGlsZSAocGVuZGluZ0NvbXB1dGF0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGNvbXAgPSBwZW5kaW5nQ29tcHV0YXRpb25zLnNoaWZ0KCk7XG4gICAgICAgIGNvbXAuX3JlY29tcHV0ZSgpO1xuICAgICAgICBpZiAoY29tcC5fbmVlZHNSZWNvbXB1dGUoKSkge1xuICAgICAgICAgIHBlbmRpbmdDb21wdXRhdGlvbnMudW5zaGlmdChjb21wKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghIG9wdGlvbnMuZmluaXNoU3luY2hyb25vdXNseSAmJiArK3JlY29tcHV0ZWRDb3VudCA+IDEwMDApIHtcbiAgICAgICAgICBmaW5pc2hlZFRyeSA9IHRydWU7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhZnRlckZsdXNoQ2FsbGJhY2tzLmxlbmd0aCkge1xuICAgICAgICAvLyBjYWxsIG9uZSBhZnRlckZsdXNoIGNhbGxiYWNrLCB3aGljaCBtYXlcbiAgICAgICAgLy8gaW52YWxpZGF0ZSBtb3JlIGNvbXB1dGF0aW9uc1xuICAgICAgICB2YXIgZnVuYyA9IGFmdGVyRmx1c2hDYWxsYmFja3Muc2hpZnQoKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBmdW5jKCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBfdGhyb3dPckxvZyhcImFmdGVyRmx1c2hcIiwgZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZmluaXNoZWRUcnkgPSB0cnVlO1xuICB9IGZpbmFsbHkge1xuICAgIGlmICghIGZpbmlzaGVkVHJ5KSB7XG4gICAgICAvLyB3ZSdyZSBlcnJvcmluZyBkdWUgdG8gdGhyb3dGaXJzdEVycm9yIGJlaW5nIHRydWUuXG4gICAgICBpbkZsdXNoID0gZmFsc2U7IC8vIG5lZWRlZCBiZWZvcmUgY2FsbGluZyBgVHJhY2tlci5mbHVzaCgpYCBhZ2FpblxuICAgICAgLy8gZmluaXNoIGZsdXNoaW5nXG4gICAgICBUcmFja2VyLl9ydW5GbHVzaCh7XG4gICAgICAgIGZpbmlzaFN5bmNocm9ub3VzbHk6IG9wdGlvbnMuZmluaXNoU3luY2hyb25vdXNseSxcbiAgICAgICAgdGhyb3dGaXJzdEVycm9yOiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuICAgIHdpbGxGbHVzaCA9IGZhbHNlO1xuICAgIGluRmx1c2ggPSBmYWxzZTtcbiAgICBpZiAocGVuZGluZ0NvbXB1dGF0aW9ucy5sZW5ndGggfHwgYWZ0ZXJGbHVzaENhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgIC8vIFdlJ3JlIHlpZWxkaW5nIGJlY2F1c2Ugd2UgcmFuIGEgYnVuY2ggb2YgY29tcHV0YXRpb25zIGFuZCB3ZSBhcmVuJ3RcbiAgICAgIC8vIHJlcXVpcmVkIHRvIGZpbmlzaCBzeW5jaHJvbm91c2x5LCBzbyB3ZSdkIGxpa2UgdG8gZ2l2ZSB0aGUgZXZlbnQgbG9vcCBhXG4gICAgICAvLyBjaGFuY2UuIFdlIHNob3VsZCBmbHVzaCBhZ2FpbiBzb29uLlxuICAgICAgaWYgKG9wdGlvbnMuZmluaXNoU3luY2hyb25vdXNseSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzdGlsbCBoYXZlIG1vcmUgdG8gZG8/XCIpOyAgLy8gc2hvdWxkbid0IGhhcHBlblxuICAgICAgfVxuICAgICAgc2V0VGltZW91dChyZXF1aXJlRmx1c2gsIDEwKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIGh0dHA6Ly9kb2NzLm1ldGVvci5jb20vI3RyYWNrZXJfYXV0b3J1blxuLy9cbi8vIFJ1biBmKCkuIFJlY29yZCBpdHMgZGVwZW5kZW5jaWVzLiBSZXJ1biBpdCB3aGVuZXZlciB0aGVcbi8vIGRlcGVuZGVuY2llcyBjaGFuZ2UuXG4vL1xuLy8gUmV0dXJucyBhIG5ldyBDb21wdXRhdGlvbiwgd2hpY2ggaXMgYWxzbyBwYXNzZWQgdG8gZi5cbi8vXG4vLyBMaW5rcyB0aGUgY29tcHV0YXRpb24gdG8gdGhlIGN1cnJlbnQgY29tcHV0YXRpb25cbi8vIHNvIHRoYXQgaXQgaXMgc3RvcHBlZCBpZiB0aGUgY3VycmVudCBjb21wdXRhdGlvbiBpcyBpbnZhbGlkYXRlZC5cblxuLyoqXG4gKiBAY2FsbGJhY2sgVHJhY2tlci5Db21wdXRhdGlvbkZ1bmN0aW9uXG4gKiBAcGFyYW0ge1RyYWNrZXIuQ29tcHV0YXRpb259XG4gKi9cbi8qKlxuICogQHN1bW1hcnkgUnVuIGEgZnVuY3Rpb24gbm93IGFuZCByZXJ1biBpdCBsYXRlciB3aGVuZXZlciBpdHMgZGVwZW5kZW5jaWVzXG4gKiBjaGFuZ2UuIFJldHVybnMgYSBDb21wdXRhdGlvbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0byBzdG9wIG9yIG9ic2VydmUgdGhlXG4gKiByZXJ1bm5pbmcuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RyYWNrZXIuQ29tcHV0YXRpb25GdW5jdGlvbn0gcnVuRnVuYyBUaGUgZnVuY3Rpb24gdG8gcnVuLiBJdCByZWNlaXZlc1xuICogb25lIGFyZ3VtZW50OiB0aGUgQ29tcHV0YXRpb24gb2JqZWN0IHRoYXQgd2lsbCBiZSByZXR1cm5lZC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMub25FcnJvciBPcHRpb25hbC4gVGhlIGZ1bmN0aW9uIHRvIHJ1biB3aGVuIGFuIGVycm9yXG4gKiBoYXBwZW5zIGluIHRoZSBDb21wdXRhdGlvbi4gVGhlIG9ubHkgYXJndW1lbnQgaXQgcmVjZWl2ZXMgaXMgdGhlIEVycm9yXG4gKiB0aHJvd24uIERlZmF1bHRzIHRvIHRoZSBlcnJvciBiZWluZyBsb2dnZWQgdG8gdGhlIGNvbnNvbGUuXG4gKiBAcmV0dXJucyB7VHJhY2tlci5Db21wdXRhdGlvbn1cbiAqL1xuVHJhY2tlci5hdXRvcnVuID0gZnVuY3Rpb24gKGYsIG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBmICE9PSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBFcnJvcignVHJhY2tlci5hdXRvcnVuIHJlcXVpcmVzIGEgZnVuY3Rpb24gYXJndW1lbnQnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBjb25zdHJ1Y3RpbmdDb21wdXRhdGlvbiA9IHRydWU7XG4gIHZhciBjID0gbmV3IFRyYWNrZXIuQ29tcHV0YXRpb24oXG4gICAgZiwgVHJhY2tlci5jdXJyZW50Q29tcHV0YXRpb24sIG9wdGlvbnMub25FcnJvcik7XG5cbiAgaWYgKFRyYWNrZXIuYWN0aXZlKVxuICAgIFRyYWNrZXIub25JbnZhbGlkYXRlKGZ1bmN0aW9uICgpIHtcbiAgICAgIGMuc3RvcCgpO1xuICAgIH0pO1xuXG4gIHJldHVybiBjO1xufTtcblxuLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jdHJhY2tlcl9ub25yZWFjdGl2ZVxuLy9cbi8vIFJ1biBgZmAgd2l0aCBubyBjdXJyZW50IGNvbXB1dGF0aW9uLCByZXR1cm5pbmcgdGhlIHJldHVybiB2YWx1ZVxuLy8gb2YgYGZgLiAgVXNlZCB0byB0dXJuIG9mZiByZWFjdGl2aXR5IGZvciB0aGUgZHVyYXRpb24gb2YgYGZgLFxuLy8gc28gdGhhdCByZWFjdGl2ZSBkYXRhIHNvdXJjZXMgYWNjZXNzZWQgYnkgYGZgIHdpbGwgbm90IHJlc3VsdCBpbiBhbnlcbi8vIGNvbXB1dGF0aW9ucyBiZWluZyBpbnZhbGlkYXRlZC5cblxuLyoqXG4gKiBAc3VtbWFyeSBSdW4gYSBmdW5jdGlvbiB3aXRob3V0IHRyYWNraW5nIGRlcGVuZGVuY2llcy5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgQSBmdW5jdGlvbiB0byBjYWxsIGltbWVkaWF0ZWx5LlxuICovXG5UcmFja2VyLm5vbnJlYWN0aXZlID0gZnVuY3Rpb24gKGYpIHtcbiAgcmV0dXJuIFRyYWNrZXIud2l0aENvbXB1dGF0aW9uKG51bGwsIGYpO1xufTtcblxuVHJhY2tlci53aXRoQ29tcHV0YXRpb24gPSBmdW5jdGlvbiAoY29tcHV0YXRpb24sIGYpIHtcbiAgdmFyIHByZXZpb3VzQ29tcHV0YXRpb24gPSBUcmFja2VyLmN1cnJlbnRDb21wdXRhdGlvbjtcblxuICBUcmFja2VyLmN1cnJlbnRDb21wdXRhdGlvbiA9IGNvbXB1dGF0aW9uO1xuICBUcmFja2VyLmFjdGl2ZSA9ICEhY29tcHV0YXRpb247XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gZigpO1xuICB9IGZpbmFsbHkge1xuICAgIFRyYWNrZXIuY3VycmVudENvbXB1dGF0aW9uID0gcHJldmlvdXNDb21wdXRhdGlvbjtcbiAgICBUcmFja2VyLmFjdGl2ZSA9ICEhcHJldmlvdXNDb21wdXRhdGlvbjtcbiAgfVxufTtcblxuLy8gaHR0cDovL2RvY3MubWV0ZW9yLmNvbS8jdHJhY2tlcl9vbmludmFsaWRhdGVcblxuLyoqXG4gKiBAc3VtbWFyeSBSZWdpc3RlcnMgYSBuZXcgW2BvbkludmFsaWRhdGVgXSgjY29tcHV0YXRpb25fb25pbnZhbGlkYXRlKSBjYWxsYmFjayBvbiB0aGUgY3VycmVudCBjb21wdXRhdGlvbiAod2hpY2ggbXVzdCBleGlzdCksIHRvIGJlIGNhbGxlZCBpbW1lZGlhdGVseSB3aGVuIHRoZSBjdXJyZW50IGNvbXB1dGF0aW9uIGlzIGludmFsaWRhdGVkIG9yIHN0b3BwZWQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBpbnZva2VkIGFzIGBmdW5jKGMpYCwgd2hlcmUgYGNgIGlzIHRoZSBjb21wdXRhdGlvbiBvbiB3aGljaCB0aGUgY2FsbGJhY2sgaXMgcmVnaXN0ZXJlZC5cbiAqL1xuVHJhY2tlci5vbkludmFsaWRhdGUgPSBmdW5jdGlvbiAoZikge1xuICBpZiAoISBUcmFja2VyLmFjdGl2ZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUcmFja2VyLm9uSW52YWxpZGF0ZSByZXF1aXJlcyBhIGN1cnJlbnRDb21wdXRhdGlvblwiKTtcblxuICBUcmFja2VyLmN1cnJlbnRDb21wdXRhdGlvbi5vbkludmFsaWRhdGUoZik7XG59O1xuXG4vLyBodHRwOi8vZG9jcy5tZXRlb3IuY29tLyN0cmFja2VyX2FmdGVyZmx1c2hcblxuLyoqXG4gKiBAc3VtbWFyeSBTY2hlZHVsZXMgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgZHVyaW5nIHRoZSBuZXh0IGZsdXNoLCBvciBsYXRlciBpbiB0aGUgY3VycmVudCBmbHVzaCBpZiBvbmUgaXMgaW4gcHJvZ3Jlc3MsIGFmdGVyIGFsbCBpbnZhbGlkYXRlZCBjb21wdXRhdGlvbnMgaGF2ZSBiZWVuIHJlcnVuLiAgVGhlIGZ1bmN0aW9uIHdpbGwgYmUgcnVuIG9uY2UgYW5kIG5vdCBvbiBzdWJzZXF1ZW50IGZsdXNoZXMgdW5sZXNzIGBhZnRlckZsdXNoYCBpcyBjYWxsZWQgYWdhaW4uXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGZ1bmN0aW9uIHRvIGNhbGwgYXQgZmx1c2ggdGltZS5cbiAqL1xuVHJhY2tlci5hZnRlckZsdXNoID0gZnVuY3Rpb24gKGYpIHtcbiAgYWZ0ZXJGbHVzaENhbGxiYWNrcy5wdXNoKGYpO1xuICByZXF1aXJlRmx1c2goKTtcbn07XG4iXX0=
