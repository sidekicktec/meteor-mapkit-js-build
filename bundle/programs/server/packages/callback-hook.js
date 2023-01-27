(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, callback, Hook;

var require = meteorInstall({"node_modules":{"meteor":{"callback-hook":{"hook.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                               //
// packages/callback-hook/hook.js                                                                //
//                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                 //
module.export({
  Hook: () => Hook
});
// XXX This pattern is under development. Do not add more callsites
// using this package for now. See:
// https://meteor.hackpad.com/Design-proposal-Hooks-YxvgEW06q6f
//
// Encapsulates the pattern of registering callbacks on a hook.
//
// The `each` method of the hook calls its iterator function argument
// with each registered callback.  This allows the hook to
// conditionally decide not to call the callback (if, for example, the
// observed object has been closed or terminated).
//
// By default, callbacks are bound with `Meteor.bindEnvironment`, so they will be
// called with the Meteor environment of the calling code that
// registered the callback. Override by passing { bindEnvironment: false }
// to the constructor.
//
// Registering a callback returns an object with a single `stop`
// method which unregisters the callback.
//
// The code is careful to allow a callback to be safely unregistered
// while the callbacks are being iterated over.
//
// If the hook is configured with the `exceptionHandler` option, the
// handler will be called if a called callback throws an exception.
// By default (if the exception handler doesn't itself throw an
// exception, or if the iterator function doesn't return a falsy value
// to terminate the calling of callbacks), the remaining callbacks
// will still be called.
//
// Alternatively, the `debugPrintExceptions` option can be specified
// as string describing the callback.  On an exception the string and
// the exception will be printed to the console log with
// `Meteor._debug`, and the exception otherwise ignored.
//
// If an exception handler isn't specified, exceptions thrown in the
// callback will propagate up to the iterator function, and will
// terminate calling the remaining callbacks if not caught.

const hasOwn = Object.prototype.hasOwnProperty;
class Hook {
  constructor(options) {
    options = options || {};
    this.nextCallbackId = 0;
    this.callbacks = Object.create(null);
    // Whether to wrap callbacks with Meteor.bindEnvironment
    this.bindEnvironment = true;
    if (options.bindEnvironment === false) {
      this.bindEnvironment = false;
    }
    if (options.exceptionHandler) {
      this.exceptionHandler = options.exceptionHandler;
    } else if (options.debugPrintExceptions) {
      if (typeof options.debugPrintExceptions !== "string") {
        throw new Error("Hook option debugPrintExceptions should be a string");
      }
      this.exceptionHandler = options.debugPrintExceptions;
    }
  }
  register(callback) {
    const exceptionHandler = this.exceptionHandler || function (exception) {
      // Note: this relies on the undocumented fact that if bindEnvironment's
      // onException throws, and you are invoking the callback either in the
      // browser or from within a Fiber in Node, the exception is propagated.
      throw exception;
    };
    if (this.bindEnvironment) {
      callback = Meteor.bindEnvironment(callback, exceptionHandler);
    } else {
      callback = dontBindEnvironment(callback, exceptionHandler);
    }
    const id = this.nextCallbackId++;
    this.callbacks[id] = callback;
    return {
      callback,
      stop: () => {
        delete this.callbacks[id];
      }
    };
  }
  clear() {
    this.nextCallbackId = 0;
    this.callbacks = [];
  }

  /**
   * For each registered callback, call the passed iterator function with the callback.
   *
   * The iterator function can choose whether or not to call the
   * callback.  (For example, it might not call the callback if the
   * observed object has been closed or terminated).
   * The iteration is stopped if the iterator function returns a falsy
   * value or throws an exception.
   *
   * @param iterator
   */
  forEach(iterator) {
    // Invoking bindEnvironment'd callbacks outside of a Fiber in Node doesn't
    // run them to completion (and exceptions thrown from onException are not
    // propagated), so we need to be in a Fiber.
    Meteor._nodeCodeMustBeInFiber();
    const ids = Object.keys(this.callbacks);
    for (let i = 0; i < ids.length; ++i) {
      const id = ids[i];
      // check to see if the callback was removed during iteration
      if (hasOwn.call(this.callbacks, id)) {
        const callback = this.callbacks[id];
        if (!iterator(callback)) {
          break;
        }
      }
    }
  }

  /**
   * For each registered callback, call the passed iterator function with the callback.
   *
   * it is a counterpart of forEach, but it is async and returns a promise
   * @param iterator
   * @return {Promise<void>}
   * @see forEach
   */
  forEachAsync(iterator) {
    return Promise.asyncApply(() => {
      const ids = Object.keys(this.callbacks);
      for (let i = 0; i < ids.length; ++i) {
        const id = ids[i];
        // check to see if the callback was removed during iteration
        if (hasOwn.call(this.callbacks, id)) {
          const callback = this.callbacks[id];
          if (!Promise.await(iterator(callback))) {
            break;
          }
        }
      }
    });
  }

  /**
   * @deprecated use forEach
   * @param iterator
   */
  each(iterator) {
    return this.forEach(iterator);
  }
}
// Copied from Meteor.bindEnvironment and removed all the env stuff.
function dontBindEnvironment(func, onException, _this) {
  if (!onException || typeof onException === 'string') {
    const description = onException || "callback of async function";
    onException = function (error) {
      Meteor._debug("Exception in " + description, error);
    };
  }
  return function () {
    let ret;
    try {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      ret = func.apply(_this, args);
    } catch (e) {
      onException(e);
    }
    return ret;
  };
}
///////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/callback-hook/hook.js");

/* Exports */
Package._define("callback-hook", exports, {
  Hook: Hook
});

})();

//# sourceURL=meteor://💻app/packages/callback-hook.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FsbGJhY2staG9vay9ob29rLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhvb2siLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsIm5leHRDYWxsYmFja0lkIiwiY2FsbGJhY2tzIiwiY3JlYXRlIiwiYmluZEVudmlyb25tZW50IiwiZXhjZXB0aW9uSGFuZGxlciIsImRlYnVnUHJpbnRFeGNlcHRpb25zIiwiRXJyb3IiLCJyZWdpc3RlciIsImNhbGxiYWNrIiwiZXhjZXB0aW9uIiwiTWV0ZW9yIiwiZG9udEJpbmRFbnZpcm9ubWVudCIsImlkIiwic3RvcCIsImNsZWFyIiwiZm9yRWFjaCIsIml0ZXJhdG9yIiwiX25vZGVDb2RlTXVzdEJlSW5GaWJlciIsImlkcyIsImtleXMiLCJpIiwibGVuZ3RoIiwiY2FsbCIsImZvckVhY2hBc3luYyIsImVhY2giLCJmdW5jIiwib25FeGNlcHRpb24iLCJfdGhpcyIsImRlc2NyaXB0aW9uIiwiZXJyb3IiLCJfZGVidWciLCJyZXQiLCJhcmdzIiwiYXBwbHkiLCJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0MsSUFBSSxFQUFDLE1BQUlBO0FBQUksQ0FBQyxDQUFDO0FBQTlCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLE1BQU1DLE1BQU0sR0FBR0MsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWM7QUFFdkMsTUFB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TUFDVlIsV0FBVyxDQUFDUSxDQUFDLENBQUM7SUFDaEI7SUFDQSxPQUFPSCxHQUFHO0VBQ1osQ0FBQztBQUNILEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NhbGxiYWNrLWhvb2suanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBYWFggVGhpcyBwYXR0ZXJuIGlzIHVuZGVyIGRldmVsb3BtZW50LiBEbyBub3QgYWRkIG1vcmUgY2FsbHNpdGVzXG4vLyB1c2luZyB0aGlzIHBhY2thZ2UgZm9yIG5vdy4gU2VlOlxuLy8gaHR0cHM6Ly9tZXRlb3IuaGFja3BhZC5jb20vRGVzaWduLXByb3Bvc2FsLUhvb2tzLVl4dmdFVzA2cTZmXG4vL1xuLy8gRW5jYXBzdWxhdGVzIHRoZSBwYXR0ZXJuIG9mIHJlZ2lzdGVyaW5nIGNhbGxiYWNrcyBvbiBhIGhvb2suXG4vL1xuLy8gVGhlIGBlYWNoYCBtZXRob2Qgb2YgdGhlIGhvb2sgY2FsbHMgaXRzIGl0ZXJhdG9yIGZ1bmN0aW9uIGFyZ3VtZW50XG4vLyB3aXRoIGVhY2ggcmVnaXN0ZXJlZCBjYWxsYmFjay4gIFRoaXMgYWxsb3dzIHRoZSBob29rIHRvXG4vLyBjb25kaXRpb25hbGx5IGRlY2lkZSBub3QgdG8gY2FsbCB0aGUgY2FsbGJhY2sgKGlmLCBmb3IgZXhhbXBsZSwgdGhlXG4vLyBvYnNlcnZlZCBvYmplY3QgaGFzIGJlZW4gY2xvc2VkIG9yIHRlcm1pbmF0ZWQpLlxuLy9cbi8vIEJ5IGRlZmF1bHQsIGNhbGxiYWNrcyBhcmUgYm91bmQgd2l0aCBgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudGAsIHNvIHRoZXkgd2lsbCBiZVxuLy8gY2FsbGVkIHdpdGggdGhlIE1ldGVvciBlbnZpcm9ubWVudCBvZiB0aGUgY2FsbGluZyBjb2RlIHRoYXRcbi8vIHJlZ2lzdGVyZWQgdGhlIGNhbGxiYWNrLiBPdmVycmlkZSBieSBwYXNzaW5nIHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9XG4vLyB0byB0aGUgY29uc3RydWN0b3IuXG4vL1xuLy8gUmVnaXN0ZXJpbmcgYSBjYWxsYmFjayByZXR1cm5zIGFuIG9iamVjdCB3aXRoIGEgc2luZ2xlIGBzdG9wYFxuLy8gbWV0aG9kIHdoaWNoIHVucmVnaXN0ZXJzIHRoZSBjYWxsYmFjay5cbi8vXG4vLyBUaGUgY29kZSBpcyBjYXJlZnVsIHRvIGFsbG93IGEgY2FsbGJhY2sgdG8gYmUgc2FmZWx5IHVucmVnaXN0ZXJlZFxuLy8gd2hpbGUgdGhlIGNhbGxiYWNrcyBhcmUgYmVpbmcgaXRlcmF0ZWQgb3Zlci5cbi8vXG4vLyBJZiB0aGUgaG9vayBpcyBjb25maWd1cmVkIHdpdGggdGhlIGBleGNlcHRpb25IYW5kbGVyYCBvcHRpb24sIHRoZVxuLy8gaGFuZGxlciB3aWxsIGJlIGNhbGxlZCBpZiBhIGNhbGxlZCBjYWxsYmFjayB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuLy8gQnkgZGVmYXVsdCAoaWYgdGhlIGV4Y2VwdGlvbiBoYW5kbGVyIGRvZXNuJ3QgaXRzZWxmIHRocm93IGFuXG4vLyBleGNlcHRpb24sIG9yIGlmIHRoZSBpdGVyYXRvciBmdW5jdGlvbiBkb2Vzbid0IHJldHVybiBhIGZhbHN5IHZhbHVlXG4vLyB0byB0ZXJtaW5hdGUgdGhlIGNhbGxpbmcgb2YgY2FsbGJhY2tzKSwgdGhlIHJlbWFpbmluZyBjYWxsYmFja3Ncbi8vIHdpbGwgc3RpbGwgYmUgY2FsbGVkLlxuLy9cbi8vIEFsdGVybmF0aXZlbHksIHRoZSBgZGVidWdQcmludEV4Y2VwdGlvbnNgIG9wdGlvbiBjYW4gYmUgc3BlY2lmaWVkXG4vLyBhcyBzdHJpbmcgZGVzY3JpYmluZyB0aGUgY2FsbGJhY2suICBPbiBhbiBleGNlcHRpb24gdGhlIHN0cmluZyBhbmRcbi8vIHRoZSBleGNlcHRpb24gd2lsbCBiZSBwcmludGVkIHRvIHRoZSBjb25zb2xlIGxvZyB3aXRoXG4vLyBgTWV0ZW9yLl9kZWJ1Z2AsIGFuZCB0aGUgZXhjZXB0aW9uIG90aGVyd2lzZSBpZ25vcmVkLlxuLy9cbi8vIElmIGFuIGV4Y2VwdGlvbiBoYW5kbGVyIGlzbid0IHNwZWNpZmllZCwgZXhjZXB0aW9ucyB0aHJvd24gaW4gdGhlXG4vLyBjYWxsYmFjayB3aWxsIHByb3BhZ2F0ZSB1cCB0byB0aGUgaXRlcmF0b3IgZnVuY3Rpb24sIGFuZCB3aWxsXG4vLyB0ZXJtaW5hdGUgY2FsbGluZyB0aGUgcmVtYWluaW5nIGNhbGxiYWNrcyBpZiBub3QgY2F1Z2h0LlxuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5leHBvcnQgY2xhc3MgSG9vayB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLm5leHRDYWxsYmFja0lkID0gMDtcbiAgICB0aGlzLmNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgLy8gV2hldGhlciB0byB3cmFwIGNhbGxiYWNrcyB3aXRoIE1ldGVvci5iaW5kRW52aXJvbm1lbnRcbiAgICB0aGlzLmJpbmRFbnZpcm9ubWVudCA9IHRydWU7XG4gICAgaWYgKG9wdGlvbnMuYmluZEVudmlyb25tZW50ID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5iaW5kRW52aXJvbm1lbnQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5leGNlcHRpb25IYW5kbGVyKSB7XG4gICAgICB0aGlzLmV4Y2VwdGlvbkhhbmRsZXIgPSBvcHRpb25zLmV4Y2VwdGlvbkhhbmRsZXI7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmRlYnVnUHJpbnRFeGNlcHRpb25zKSB7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMuZGVidWdQcmludEV4Y2VwdGlvbnMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSG9vayBvcHRpb24gZGVidWdQcmludEV4Y2VwdGlvbnMgc2hvdWxkIGJlIGEgc3RyaW5nXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5leGNlcHRpb25IYW5kbGVyID0gb3B0aW9ucy5kZWJ1Z1ByaW50RXhjZXB0aW9ucztcbiAgICB9XG4gIH1cblxuICByZWdpc3RlcihjYWxsYmFjaykge1xuICAgIGNvbnN0IGV4Y2VwdGlvbkhhbmRsZXIgPSB0aGlzLmV4Y2VwdGlvbkhhbmRsZXIgfHwgZnVuY3Rpb24gKGV4Y2VwdGlvbikge1xuICAgICAgLy8gTm90ZTogdGhpcyByZWxpZXMgb24gdGhlIHVuZG9jdW1lbnRlZCBmYWN0IHRoYXQgaWYgYmluZEVudmlyb25tZW50J3NcbiAgICAgIC8vIG9uRXhjZXB0aW9uIHRocm93cywgYW5kIHlvdSBhcmUgaW52b2tpbmcgdGhlIGNhbGxiYWNrIGVpdGhlciBpbiB0aGVcbiAgICAgIC8vIGJyb3dzZXIgb3IgZnJvbSB3aXRoaW4gYSBGaWJlciBpbiBOb2RlLCB0aGUgZXhjZXB0aW9uIGlzIHByb3BhZ2F0ZWQuXG4gICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgfTtcblxuICAgIGlmICh0aGlzLmJpbmRFbnZpcm9ubWVudCkge1xuICAgICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGNhbGxiYWNrLCBleGNlcHRpb25IYW5kbGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2sgPSBkb250QmluZEVudmlyb25tZW50KGNhbGxiYWNrLCBleGNlcHRpb25IYW5kbGVyKTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IHRoaXMubmV4dENhbGxiYWNrSWQrKztcbiAgICB0aGlzLmNhbGxiYWNrc1tpZF0gPSBjYWxsYmFjaztcblxuICAgIHJldHVybiB7XG4gICAgICBjYWxsYmFjayxcbiAgICAgIHN0b3A6ICgpID0+IHtcbiAgICAgICAgZGVsZXRlIHRoaXMuY2FsbGJhY2tzW2lkXTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgY2xlYXIoKSB7XG4gICAgdGhpcy5uZXh0Q2FsbGJhY2tJZCA9IDA7XG4gICAgdGhpcy5jYWxsYmFja3MgPSBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgZWFjaCByZWdpc3RlcmVkIGNhbGxiYWNrLCBjYWxsIHRoZSBwYXNzZWQgaXRlcmF0b3IgZnVuY3Rpb24gd2l0aCB0aGUgY2FsbGJhY2suXG4gICAqXG4gICAqIFRoZSBpdGVyYXRvciBmdW5jdGlvbiBjYW4gY2hvb3NlIHdoZXRoZXIgb3Igbm90IHRvIGNhbGwgdGhlXG4gICAqIGNhbGxiYWNrLiAgKEZvciBleGFtcGxlLCBpdCBtaWdodCBub3QgY2FsbCB0aGUgY2FsbGJhY2sgaWYgdGhlXG4gICAqIG9ic2VydmVkIG9iamVjdCBoYXMgYmVlbiBjbG9zZWQgb3IgdGVybWluYXRlZCkuXG4gICAqIFRoZSBpdGVyYXRpb24gaXMgc3RvcHBlZCBpZiB0aGUgaXRlcmF0b3IgZnVuY3Rpb24gcmV0dXJucyBhIGZhbHN5XG4gICAqIHZhbHVlIG9yIHRocm93cyBhbiBleGNlcHRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBpdGVyYXRvclxuICAgKi9cbiAgZm9yRWFjaChpdGVyYXRvcikge1xuICAgIC8vIEludm9raW5nIGJpbmRFbnZpcm9ubWVudCdkIGNhbGxiYWNrcyBvdXRzaWRlIG9mIGEgRmliZXIgaW4gTm9kZSBkb2Vzbid0XG4gICAgLy8gcnVuIHRoZW0gdG8gY29tcGxldGlvbiAoYW5kIGV4Y2VwdGlvbnMgdGhyb3duIGZyb20gb25FeGNlcHRpb24gYXJlIG5vdFxuICAgIC8vIHByb3BhZ2F0ZWQpLCBzbyB3ZSBuZWVkIHRvIGJlIGluIGEgRmliZXIuXG4gICAgTWV0ZW9yLl9ub2RlQ29kZU11c3RCZUluRmliZXIoKTtcblxuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuY2FsbGJhY2tzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgIGkgPCBpZHMubGVuZ3RoOyAgKytpKSB7XG4gICAgICBjb25zdCBpZCA9IGlkc1tpXTtcbiAgICAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGUgY2FsbGJhY2sgd2FzIHJlbW92ZWQgZHVyaW5nIGl0ZXJhdGlvblxuICAgICAgaWYgKGhhc093bi5jYWxsKHRoaXMuY2FsbGJhY2tzLCBpZCkpIHtcbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSB0aGlzLmNhbGxiYWNrc1tpZF07XG4gICAgICAgIGlmICghIGl0ZXJhdG9yKGNhbGxiYWNrKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZvciBlYWNoIHJlZ2lzdGVyZWQgY2FsbGJhY2ssIGNhbGwgdGhlIHBhc3NlZCBpdGVyYXRvciBmdW5jdGlvbiB3aXRoIHRoZSBjYWxsYmFjay5cbiAgICpcbiAgICogaXQgaXMgYSBjb3VudGVycGFydCBvZiBmb3JFYWNoLCBidXQgaXQgaXMgYXN5bmMgYW5kIHJldHVybnMgYSBwcm9taXNlXG4gICAqIEBwYXJhbSBpdGVyYXRvclxuICAgKiBAcmV0dXJuIHtQcm9taXNlPHZvaWQ+fVxuICAgKiBAc2VlIGZvckVhY2hcbiAgICovXG4gIGFzeW5jIGZvckVhY2hBc3luYyhpdGVyYXRvcikge1xuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5rZXlzKHRoaXMuY2FsbGJhY2tzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgIGkgPCBpZHMubGVuZ3RoOyAgKytpKSB7XG4gICAgICBjb25zdCBpZCA9IGlkc1tpXTtcbiAgICAgIC8vIGNoZWNrIHRvIHNlZSBpZiB0aGUgY2FsbGJhY2sgd2FzIHJlbW92ZWQgZHVyaW5nIGl0ZXJhdGlvblxuICAgICAgaWYgKGhhc093bi5jYWxsKHRoaXMuY2FsbGJhY2tzLCBpZCkpIHtcbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSB0aGlzLmNhbGxiYWNrc1tpZF07XG4gICAgICAgIGlmICghYXdhaXQgaXRlcmF0b3IoY2FsbGJhY2spKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIGZvckVhY2hcbiAgICogQHBhcmFtIGl0ZXJhdG9yXG4gICAqL1xuICBlYWNoKGl0ZXJhdG9yKSB7XG4gICAgcmV0dXJuIHRoaXMuZm9yRWFjaChpdGVyYXRvcik7XG4gIH1cbn1cblxuLy8gQ29waWVkIGZyb20gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCBhbmQgcmVtb3ZlZCBhbGwgdGhlIGVudiBzdHVmZi5cbmZ1bmN0aW9uIGRvbnRCaW5kRW52aXJvbm1lbnQoZnVuYywgb25FeGNlcHRpb24sIF90aGlzKSB7XG4gIGlmICghb25FeGNlcHRpb24gfHwgdHlwZW9mKG9uRXhjZXB0aW9uKSA9PT0gJ3N0cmluZycpIHtcbiAgICBjb25zdCBkZXNjcmlwdGlvbiA9IG9uRXhjZXB0aW9uIHx8IFwiY2FsbGJhY2sgb2YgYXN5bmMgZnVuY3Rpb25cIjtcbiAgICBvbkV4Y2VwdGlvbiA9IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICAgXCJFeGNlcHRpb24gaW4gXCIgKyBkZXNjcmlwdGlvbixcbiAgICAgICAgZXJyb3JcbiAgICAgICk7XG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIGxldCByZXQ7XG4gICAgdHJ5IHtcbiAgICAgIHJldCA9IGZ1bmMuYXBwbHkoX3RoaXMsIGFyZ3MpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG9uRXhjZXB0aW9uKGUpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9O1xufVxuIl19
