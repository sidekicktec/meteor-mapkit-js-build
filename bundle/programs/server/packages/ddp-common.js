(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var DDPCommon;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-common":{"namespace.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-common/namespace.js                                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
/**
 * @namespace DDPCommon
 * @summary Namespace for DDPCommon-related methods/classes. Shared between 
 * `ddp-client` and `ddp-server`, where the ddp-client is the implementation
 * of a ddp client for both client AND server; and the ddp server is the
 * implementation of the livedata server and stream server. Common 
 * functionality shared between both can be shared under this namespace
 */
DDPCommon = {};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"heartbeat.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-common/heartbeat.js                                                                                   //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// Heartbeat options:
//   heartbeatInterval: interval to send pings, in milliseconds.
//   heartbeatTimeout: timeout to close the connection if a reply isn't
//     received, in milliseconds.
//   sendPing: function to call to send a ping on the connection.
//   onTimeout: function to call to close the connection.

DDPCommon.Heartbeat = class Heartbeat {
  constructor(options) {
    this.heartbeatInterval = options.heartbeatInterval;
    this.heartbeatTimeout = options.heartbeatTimeout;
    this._sendPing = options.sendPing;
    this._onTimeout = options.onTimeout;
    this._seenPacket = false;
    this._heartbeatIntervalHandle = null;
    this._heartbeatTimeoutHandle = null;
  }
  stop() {
    this._clearHeartbeatIntervalTimer();
    this._clearHeartbeatTimeoutTimer();
  }
  start() {
    this.stop();
    this._startHeartbeatIntervalTimer();
  }
  _startHeartbeatIntervalTimer() {
    this._heartbeatIntervalHandle = Meteor.setInterval(() => this._heartbeatIntervalFired(), this.heartbeatInterval);
  }
  _startHeartbeatTimeoutTimer() {
    this._heartbeatTimeoutHandle = Meteor.setTimeout(() => this._heartbeatTimeoutFired(), this.heartbeatTimeout);
  }
  _clearHeartbeatIntervalTimer() {
    if (this._heartbeatIntervalHandle) {
      Meteor.clearInterval(this._heartbeatIntervalHandle);
      this._heartbeatIntervalHandle = null;
    }
  }
  _clearHeartbeatTimeoutTimer() {
    if (this._heartbeatTimeoutHandle) {
      Meteor.clearTimeout(this._heartbeatTimeoutHandle);
      this._heartbeatTimeoutHandle = null;
    }
  }

  // The heartbeat interval timer is fired when we should send a ping.
  _heartbeatIntervalFired() {
    // don't send ping if we've seen a packet since we last checked,
    // *or* if we have already sent a ping and are awaiting a timeout.
    // That shouldn't happen, but it's possible if
    // `this.heartbeatInterval` is smaller than
    // `this.heartbeatTimeout`.
    if (!this._seenPacket && !this._heartbeatTimeoutHandle) {
      this._sendPing();
      // Set up timeout, in case a pong doesn't arrive in time.
      this._startHeartbeatTimeoutTimer();
    }
    this._seenPacket = false;
  }

  // The heartbeat timeout timer is fired when we sent a ping, but we
  // timed out waiting for the pong.
  _heartbeatTimeoutFired() {
    this._heartbeatTimeoutHandle = null;
    this._onTimeout();
  }
  messageReceived() {
    // Tell periodic checkin that we have seen a packet, and thus it
    // does not need to send a ping this cycle.
    this._seenPacket = true;
    // If we were waiting for a pong, we got it.
    if (this._heartbeatTimeoutHandle) {
      this._clearHeartbeatTimeoutTimer();
    }
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-common/utils.js                                                                                       //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
"use strict";

module.export({
  hasOwn: () => hasOwn,
  slice: () => slice,
  keys: () => keys,
  isEmpty: () => isEmpty,
  last: () => last
});
const hasOwn = Object.prototype.hasOwnProperty;
const slice = Array.prototype.slice;
function keys(obj) {
  return Object.keys(Object(obj));
}
function isEmpty(obj) {
  if (obj == null) {
    return true;
  }
  if (Array.isArray(obj) || typeof obj === "string") {
    return obj.length === 0;
  }
  for (const key in obj) {
    if (hasOwn.call(obj, key)) {
      return false;
    }
  }
  return true;
}
function last(array, n, guard) {
  if (array == null) {
    return;
  }
  if (n == null || guard) {
    return array[array.length - 1];
  }
  return slice.call(array, Math.max(array.length - n, 0));
}
DDPCommon.SUPPORTED_DDP_VERSIONS = ['1', 'pre2', 'pre1'];
DDPCommon.parseDDP = function (stringMessage) {
  try {
    var msg = JSON.parse(stringMessage);
  } catch (e) {
    Meteor._debug("Discarding message with invalid JSON", stringMessage);
    return null;
  }
  // DDP messages must be objects.
  if (msg === null || typeof msg !== 'object') {
    Meteor._debug("Discarding non-object DDP message", stringMessage);
    return null;
  }

  // massage msg to get it into "abstract ddp" rather than "wire ddp" format.

  // switch between "cleared" rep of unsetting fields and "undefined"
  // rep of same
  if (hasOwn.call(msg, 'cleared')) {
    if (!hasOwn.call(msg, 'fields')) {
      msg.fields = {};
    }
    msg.cleared.forEach(clearKey => {
      msg.fields[clearKey] = undefined;
    });
    delete msg.cleared;
  }
  ['fields', 'params', 'result'].forEach(field => {
    if (hasOwn.call(msg, field)) {
      msg[field] = EJSON._adjustTypesFromJSONValue(msg[field]);
    }
  });
  return msg;
};
DDPCommon.stringifyDDP = function (msg) {
  const copy = EJSON.clone(msg);

  // swizzle 'changed' messages from 'fields undefined' rep to 'fields
  // and cleared' rep
  if (hasOwn.call(msg, 'fields')) {
    const cleared = [];
    Object.keys(msg.fields).forEach(key => {
      const value = msg.fields[key];
      if (typeof value === "undefined") {
        cleared.push(key);
        delete copy.fields[key];
      }
    });
    if (!isEmpty(cleared)) {
      copy.cleared = cleared;
    }
    if (isEmpty(copy.fields)) {
      delete copy.fields;
    }
  }

  // adjust types to basic
  ['fields', 'params', 'result'].forEach(field => {
    if (hasOwn.call(copy, field)) {
      copy[field] = EJSON._adjustTypesToJSONValue(copy[field]);
    }
  });
  if (msg.id && typeof msg.id !== 'string') {
    throw new Error("Message id is not a string");
  }
  return JSON.stringify(copy);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"method_invocation.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-common/method_invocation.js                                                                           //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// Instance name is this because it is usually referred to as this inside a
// method definition
/**
 * @summary The state for a single invocation of a method, referenced by this
 * inside a method definition.
 * @param {Object} options
 * @instanceName this
 * @showInstanceName true
 */
DDPCommon.MethodInvocation = class MethodInvocation {
  constructor(options) {
    // true if we're running not the actual method, but a stub (that is,
    // if we're on a client (which may be a browser, or in the future a
    // server connecting to another server) and presently running a
    // simulation of a server-side method for latency compensation
    // purposes). not currently true except in a client such as a browser,
    // since there's usually no point in running stubs unless you have a
    // zero-latency connection to the user.

    /**
     * @summary Access inside a method invocation.  Boolean value, true if this invocation is a stub.
     * @locus Anywhere
     * @name  isSimulation
     * @memberOf DDPCommon.MethodInvocation
     * @instance
     * @type {Boolean}
     */
    this.isSimulation = options.isSimulation;

    // call this function to allow other method invocations (from the
    // same client) to continue running without waiting for this one to
    // complete.
    this._unblock = options.unblock || function () {};
    this._calledUnblock = false;

    // current user id

    /**
     * @summary The id of the user that made this method call, or `null` if no user was logged in.
     * @locus Anywhere
     * @name  userId
     * @memberOf DDPCommon.MethodInvocation
     * @instance
     */
    this.userId = options.userId;

    // sets current user id in all appropriate server contexts and
    // reruns subscriptions
    this._setUserId = options.setUserId || function () {};

    // On the server, the connection this method call came in on.

    /**
     * @summary Access inside a method invocation. The [connection](#meteor_onconnection) that this method was received on. `null` if the method is not associated with a connection, eg. a server initiated method call. Calls to methods made from a server method which was in turn initiated from the client share the same `connection`.
     * @locus Server
     * @name  connection
     * @memberOf DDPCommon.MethodInvocation
     * @instance
     */
    this.connection = options.connection;

    // The seed for randomStream value generation
    this.randomSeed = options.randomSeed;

    // This is set by RandomStream.get; and holds the random stream state
    this.randomStream = null;
  }

  /**
   * @summary Call inside a method invocation.  Allow subsequent method from this client to begin running in a new fiber.
   * @locus Server
   * @memberOf DDPCommon.MethodInvocation
   * @instance
   */
  unblock() {
    this._calledUnblock = true;
    this._unblock();
  }

  /**
   * @summary Set the logged in user.
   * @locus Server
   * @memberOf DDPCommon.MethodInvocation
   * @instance
   * @param {String | null} userId The value that should be returned by `userId` on this connection.
   */
  setUserId(userId) {
    if (this._calledUnblock) {
      throw new Error("Can't call setUserId in a method after calling unblock");
    }
    this.userId = userId;
    this._setUserId(userId);
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"random_stream.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-common/random_stream.js                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
// RandomStream allows for generation of pseudo-random values, from a seed.
//
// We use this for consistent 'random' numbers across the client and server.
// We want to generate probably-unique IDs on the client, and we ideally want
// the server to generate the same IDs when it executes the method.
//
// For generated values to be the same, we must seed ourselves the same way,
// and we must keep track of the current state of our pseudo-random generators.
// We call this state the scope. By default, we use the current DDP method
// invocation as our scope.  DDP now allows the client to specify a randomSeed.
// If a randomSeed is provided it will be used to seed our random sequences.
// In this way, client and server method calls will generate the same values.
//
// We expose multiple named streams; each stream is independent
// and is seeded differently (but predictably from the name).
// By using multiple streams, we support reordering of requests,
// as long as they occur on different streams.
//
// @param options {Optional Object}
//   seed: Array or value - Seed value(s) for the generator.
//                          If an array, will be used as-is
//                          If a value, will be converted to a single-value array
//                          If omitted, a random array will be used as the seed.
DDPCommon.RandomStream = class RandomStream {
  constructor(options) {
    this.seed = [].concat(options.seed || randomToken());
    this.sequences = Object.create(null);
  }

  // Get a random sequence with the specified name, creating it if does not exist.
  // New sequences are seeded with the seed concatenated with the name.
  // By passing a seed into Random.create, we use the Alea generator.
  _sequence(name) {
    var self = this;
    var sequence = self.sequences[name] || null;
    if (sequence === null) {
      var sequenceSeed = self.seed.concat(name);
      for (var i = 0; i < sequenceSeed.length; i++) {
        if (typeof sequenceSeed[i] === "function") {
          sequenceSeed[i] = sequenceSeed[i]();
        }
      }
      self.sequences[name] = sequence = Random.createWithSeeds.apply(null, sequenceSeed);
    }
    return sequence;
  }
};

// Returns a random string of sufficient length for a random seed.
// This is a placeholder function; a similar function is planned
// for Random itself; when that is added we should remove this function,
// and call Random's randomToken instead.
function randomToken() {
  return Random.hexString(20);
}
;

// Returns the random stream with the specified name, in the specified
// scope. If a scope is passed, then we use that to seed a (not
// cryptographically secure) PRNG using the fast Alea algorithm.  If
// scope is null (or otherwise falsey) then we use a generated seed.
//
// However, scope will normally be the current DDP method invocation,
// so we'll use the stream with the specified name, and we should get
// consistent values on the client and server sides of a method call.
DDPCommon.RandomStream.get = function (scope, name) {
  if (!name) {
    name = "default";
  }
  if (!scope) {
    // There was no scope passed in; the sequence won't actually be
    // reproducible. but make it fast (and not cryptographically
    // secure) anyways, so that the behavior is similar to what you'd
    // get by passing in a scope.
    return Random.insecure;
  }
  var randomStream = scope.randomStream;
  if (!randomStream) {
    scope.randomStream = randomStream = new DDPCommon.RandomStream({
      seed: scope.randomSeed
    });
  }
  return randomStream._sequence(name);
};

// Creates a randomSeed for passing to a method call.
// Note that we take enclosing as an argument,
// though we expect it to be DDP._CurrentMethodInvocation.get()
// However, we often evaluate makeRpcSeed lazily, and thus the relevant
// invocation may not be the one currently in scope.
// If enclosing is null, we'll use Random and values won't be repeatable.
DDPCommon.makeRpcSeed = function (enclosing, methodName) {
  var stream = DDPCommon.RandomStream.get(enclosing, '/rpc/' + methodName);
  return stream.hexString(20);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/ddp-common/namespace.js");
require("/node_modules/meteor/ddp-common/heartbeat.js");
require("/node_modules/meteor/ddp-common/utils.js");
require("/node_modules/meteor/ddp-common/method_invocation.js");
require("/node_modules/meteor/ddp-common/random_stream.js");

/* Exports */
Package._define("ddp-common", {
  DDPCommon: DDPCommon
});

})();

//# sourceURL=meteor://💻app/packages/ddp-common.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNvbW1vbi9uYW1lc3BhY2UuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2RkcC1jb21tb24vaGVhcnRiZWF0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY29tbW9uL3V0aWxzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY29tbW9uL21ldGhvZF9pbnZvY2F0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY29tbW9uL3JhbmRvbV9zdHJlYW0uanMiXSwibmFtZXMiOlsiRERQQ29tbW9uIiwiSGVhcnRiZWF0IiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiaGVhcnRiZWF0SW50ZXJ2YWwiLCJoZWFydGJlYXRUaW1lb3V0IiwiX3NlbmRQaW5nIiwic2VuZFBpbmciLCJfb25UaW1lb3V0Iiwib25UaW1lb3V0IiwiX3NlZW5QYWNrZXQiLCJfaGVhcnRiZWF0SW50ZXJ2YWxIYW5kbGUiLCJfaGVhcnRiZWF0VGltZW91dEhhbmRsZSIsInN0b3AiLCJfY2xlYXJIZWFydGJlYXRJbnRlcnZhbFRpbWVyIiwiX2NsZWFySGVhcnRiZWF0VGltZW91dFRpbWVyIiwic3RhcnQiLCJfc3RhcnRIZWFydGJlYXRJbnRlcnZhbFRpbWVyIiwiTWV0ZW9yIiwic2V0SW50ZXJ2YWwiLCJfaGVhcnRiZWF0SW50ZXJ2YWxGaXJlZCIsIl9zdGFydEhlYXJ0YmVhdFRpbWVvdXRUaW1lciIsInNldFRpbWVvdXQiLCJfaGVhcnRiZWF0VGltZW91dEZpcmVkIiwiY2xlYXJJbnRlcnZhbCIsImNsZWFyVGltZW91dCIsIm1lc3NhZ2VSZWNlaXZlZCIsIm1vZHVsZSIsImV4cG9ydCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJBcnJheSIsIm9iaiIsImlzQXJyYXkiLCJsZW5ndGgiLCJrZXkiLCJjYWxsIiwiYXJyYXkiLCJuIiwiZ3VhcmQiLCJNYXRoIiwibWF4IiwiU1VQUE9SVEVEX0REUF9WRVJTSU9OUyIsInBhcnNlRERQIiwic3RyaW5nTWVzc2FnZSIsIm1zZyIsIkpTT04iLCJwYXJzZSIsImUiLCJfZGVidWciLCJmaWVsZHMiLCJjbGVhcmVkIiwiZm9yRWFjaCIsImNsZWFyS2V5IiwidW5kZWZpbmVkIiwiZmllbGQiLCJFSlNPTiIsIl9hZGp1c3RUeXBlc0Zyb21KU09OVmFsdWUiLCJzdHJpbmdpZnlERFAiLCJjb3B5IiwiY2xvbmUiLCJ2YWx1ZSIsInB1c2giLCJfYWRqdXN0VHlwZXNUb0pTT05WYWx1ZSIsImlkIiwiRXJyb3IiLCJzdHJpbmdpZnkiLCJNZXRob2RJbnZvY2F0aW9uIiwiaXNTaW11bGF0aW9uIiwiX3VuYmxvY2siLCJ1bmJsb2NrIiwiX2NhbGxlZFVuYmxvY2siLCJ1c2VySWQiLCJfc2V0VXNlcklkIiwic2V0VXNlcklkIiwiY29ubmVjdGlvbiIsInJhbmRvbVNlZWQiLCJyYW5kb21TdHJlYW0iLCJSYW5kb21TdHJlYW0iLCJzZWVkIiwiY29uY2F0IiwicmFuZG9tVG9rZW4iLCJzZXF1ZW5jZXMiLCJjcmVhdGUiLCJfc2VxdWVuY2UiLCJuYW1lIiwic2VsZiIsInNlcXVlbmNlIiwic2VxdWVuY2VTZWVkIiwiaSIsIlJhbmRvbSIsImNyZWF0ZVdpdGhTZWVkcyIsImFwcGx5IiwiaGV4U3RyaW5nIiwiZ2V0Iiwic2NvcGUiLCJpbnNlY3VyZSIsIm1ha2VScGNTZWVkIiwiZW5jbG9zaW5nIiwibWV0aG9kTmFtZSIsInN0cmVhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQUEsU0FBUyxHQUFHLENBQUMsQ0FBQyxDOzs7Ozs7Ozs7OztBQ1JkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQUEsU0FBUyxDQUFDQyxTQUFTLEdBQUcsTUFBTUEsU0FBUyxDQUFDO0VBQ3BDQyxXQUFXLENBQUNDLE9BQU8sRUFBRTtJQUNuQixJQUFJLENBQUNDLGlCQUFpQixHQUFHRCxPQUFPLENBQUNDLGlCQUFpQjtJQUNsRCxJQUFJLENBQUNDLGdCQUFnQixHQUFHRixPQUFPLENBQUNFLGdCQUFnQjtJQUNoRCxJQUFJLENBQUNDLFNBQVMsR0FBR0gsT0FBTyxDQUFDSSxRQUFRO0lBQ2pDLElBQUksQ0FBQ0MsVUFBVSxHQUFHTCxPQUFPLENBQUNNLFNBQVM7SUFDbkMsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSztJQUV4QixJQUFJLENBQUNDLHdCQUF3QixHQUFHLElBQUk7SUFDcEMsSUFBSSxDQUFDQyx1QkFBdUIsR0FBRyxJQUFJO0VBQ3JDO0VBRUFDLElBQUksR0FBRztJQUNMLElBQUksQ0FBQ0MsNEJBQTRCLEVBQUU7SUFDbkMsSUFBSSxDQUFDQywyQkFBMkIsRUFBRTtFQUNwQztFQUVBQyxLQUFLLEdBQUc7SUFDTixJQUFJLENBQUNILElBQUksRUFBRTtJQUNYLElBQUksQ0FBQ0ksNEJBQTRCLEVBQUU7RUFDckM7RUFFQUEsNEJBQTRCLEdBQUc7SUFDN0IsSUFBSSxDQUFDTix3QkFBd0IsR0FBR08sTUFBTSxDQUFDQyxXQUFXLENBQ2hELE1BQU0sSUFBSSxDQUFDQyx1QkFBdUIsRUFBRSxFQUNwQyxJQUFJLENBQUNoQixpQkFBaUIsQ0FDdkI7RUFDSDtFQUVBaUIsMkJBQTJCLEdBQUc7SUFDNUIsSUFBSSxDQUFDVCx1QkFBdUIsR0FBR00sTUFBTSxDQUFDSSxVQUFVLENBQzlDLE1BQU0sSUFBSSxDQUFDQyxzQkFBc0IsRUFBRSxFQUNuQyxJQUFJLENBQUNsQixnQkFBZ0IsQ0FDdEI7RUFDSDtFQUVBUyw0QkFBNEIsR0FBRztJQUM3QixJQUFJLElBQUksQ0FBQ0gsd0JBQXdCLEVBQUU7TUFDakNPLE1BQU0sQ0FBQ00sYUFBYSxDQUFDLElBQUksQ0FBQ2Isd0JBQXdCLENBQUM7TUFDbkQsSUFBSSxDQUFDQSx3QkFBd0IsR0FBRyxJQUFJO0lBQ3RDO0VBQ0Y7RUFFQUksMkJBQTJCLEdBQUc7SUFDNUIsSUFBSSxJQUFJLENBQUNILHVCQUF1QixFQUFFO01BQ2hDTSxNQUFNLENBQUNPLFlBQVksQ0FBQyxJQUFJLENBQUNiLHVCQUF1QixDQUFDO01BQ2pELElBQUksQ0FBQ0EsdUJBQXVCLEdBQUcsSUFBSTtJQUNyQztFQUNGOztFQUVBO0VBQ0FRLHVCQUF1QixHQUFHO0lBQ3hCO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLENBQUUsSUFBSSxDQUFDVixXQUFXLElBQUksQ0FBRSxJQUFJLENBQUNFLHVCQUF1QixFQUFFO01BQ3hELElBQUksQ0FBQ04sU0FBUyxFQUFFO01BQ2hCO01BQ0EsSUFBSSxDQUFDZSwyQkFBMkIsRUFBRTtJQUNwQztJQUNBLElBQUksQ0FBQ1gsV0FBVyxHQUFHLEtBQUs7RUFDMUI7O0VBRUE7RUFDQTtFQUNBYSxzQkFBc0IsR0FBRztJQUN2QixJQUFJLENBQUNYLHVCQUF1QixHQUFHLElBQUk7SUFDbkMsSUFBSSxDQUFDSixVQUFVLEVBQUU7RUFDbkI7RUFFQWtCLGVBQWUsR0FBRztJQUNoQjtJQUNBO0lBQ0EsSUFBSSxDQUFDaEIsV0FBVyxHQUFHLElBQUk7SUFDdkI7SUFDQSxJQUFJLElBQUksQ0FBQ0UsdUJBQXVCLEVBQUU7TUFDaEMsSUFBSSxDQUFDRywyQkFBMkIsRUFBRTtJQUNwQztFQUNGO0FBQ0YsQ0FBQyxDOzs7Ozs7Ozs7OztBQ3hGRCxZQUFZOztBQUFaWSxNQUFNLENBQUNDLE1BQU0sQ0FBQztFQUFDQyxNQUFNLEVBQUMsTUFBSUEsTUFBTTtFQUFDQyxLQUFLLEVBQUMsTUFBSUEsS0FBSztFQUFDQyxJQUFJLEVBQUMsTUFBSUEsSUFBSTtFQUFDQyxPQUFPLEVBQUMsTUFBSUEsT0FBTztFQUFDQyxJQUFJLEVBQUMsTUFBSUE7QUFBSSxDQUFDLENBQUM7QUFFM0YsTUFBTUosTUFBTSxHQUFHSyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYztBQUM5QyxNQUFNTixLQUFLLEdBQUdPLEtBQUssQ0FBQ0YsU0FBUyxDQUFDTCxLQUFLO0FBRW5DLFNBQVNDLElBQUksQ0FBQ08sR0FBRyxFQUFFO0VBQ3hCLE9BQU9KLE1BQU0sQ0FBQ0gsSUFBSSxDQUFDRyxNQUFNLENBQUNJLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDO0FBRU8sU0FBU04sT0FBTyxDQUFDTSxHQUFHLEVBQUU7RUFDM0IsSUFBSUEsR0FBRyxJQUFJLElBQUksRUFBRTtJQUNmLE9BQU8sSUFBSTtFQUNiO0VBRUEsSUFBSUQsS0FBSyxDQUFDRSxPQUFPLENBQUNELEdBQUcsQ0FBQyxJQUNsQixPQUFPQSxHQUFHLEtBQUssUUFBUSxFQUFFO0lBQzNCLE9BQU9BLEdBQUcsQ0FBQ0UsTUFBTSxLQUFLLENBQUM7RUFDekI7RUFFQSxLQUFLLE1BQU1DLEdBQUcsSUFBSUgsR0FBRyxFQUFFO0lBQ3JCLElBQUlULE1BQU0sQ0FBQ2EsSUFBSSxDQUFDSixHQUFHLEVBQUVHLEdBQUcsQ0FBQyxFQUFFO01BQ3pCLE9BQU8sS0FBSztJQUNkO0VBQ0Y7RUFFQSxPQUFPLElBQUk7QUFDYjtBQUVPLFNBQVNSLElBQUksQ0FBQ1UsS0FBSyxFQUFFQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtFQUNwQyxJQUFJRixLQUFLLElBQUksSUFBSSxFQUFFO0lBQ2pCO0VBQ0Y7RUFFQSxJQUFLQyxDQUFDLElBQUksSUFBSSxJQUFLQyxLQUFLLEVBQUU7SUFDeEIsT0FBT0YsS0FBSyxDQUFDQSxLQUFLLENBQUNILE1BQU0sR0FBRyxDQUFDLENBQUM7RUFDaEM7RUFFQSxPQUFPVixLQUFLLENBQUNZLElBQUksQ0FBQ0MsS0FBSyxFQUFFRyxJQUFJLENBQUNDLEdBQUcsQ0FBQ0osS0FBSyxDQUFDSCxNQUFNLEdBQUdJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN6RDtBQUVBNUMsU0FBUyxDQUFDZ0Qsc0JBQXNCLEdBQUcsQ0FBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBRTtBQUUxRGhELFNBQVMsQ0FBQ2lELFFBQVEsR0FBRyxVQUFVQyxhQUFhLEVBQUU7RUFDNUMsSUFBSTtJQUNGLElBQUlDLEdBQUcsR0FBR0MsSUFBSSxDQUFDQyxLQUFLLENBQUNILGFBQWEsQ0FBQztFQUNyQyxDQUFDLENBQUMsT0FBT0ksQ0FBQyxFQUFFO0lBQ1ZwQyxNQUFNLENBQUNxQyxNQUFNLENBQUMsc0NBQXNDLEVBQUVMLGFBQWEsQ0FBQztJQUNwRSxPQUFPLElBQUk7RUFDYjtFQUNBO0VBQ0EsSUFBSUMsR0FBRyxLQUFLLElBQUksSUFBSSxPQUFPQSxHQUFHLEtBQUssUUFBUSxFQUFFO0lBQzNDakMsTUFBTSxDQUFDcUMsTUFBTSxDQUFDLG1DQUFtQyxFQUFFTCxhQUFhLENBQUM7SUFDakUsT0FBTyxJQUFJO0VBQ2I7O0VBRUE7O0VBRUE7RUFDQTtFQUNBLElBQUlyQixNQUFNLENBQUNhLElBQUksQ0FBQ1MsR0FBRyxFQUFFLFNBQVMsQ0FBQyxFQUFFO0lBQy9CLElBQUksQ0FBRXRCLE1BQU0sQ0FBQ2EsSUFBSSxDQUFDUyxHQUFHLEVBQUUsUUFBUSxDQUFDLEVBQUU7TUFDaENBLEdBQUcsQ0FBQ0ssTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNqQjtJQUNBTCxHQUFHLENBQUNNLE9BQU8sQ0FBQ0MsT0FBTyxDQUFDQyxRQUFRLElBQUk7TUFDOUJSLEdBQUcsQ0FBQ0ssTUFBTSxDQUFDRyxRQUFRLENBQUMsR0FBR0MsU0FBUztJQUNsQyxDQUFDLENBQUM7SUFDRixPQUFPVCxHQUFHLENBQUNNLE9BQU87RUFDcEI7RUFFQSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUNDLE9BQU8sQ0FBQ0csS0FBSyxJQUFJO0lBQzlDLElBQUloQyxNQUFNLENBQUNhLElBQUksQ0FBQ1MsR0FBRyxFQUFFVSxLQUFLLENBQUMsRUFBRTtNQUMzQlYsR0FBRyxDQUFDVSxLQUFLLENBQUMsR0FBR0MsS0FBSyxDQUFDQyx5QkFBeUIsQ0FBQ1osR0FBRyxDQUFDVSxLQUFLLENBQUMsQ0FBQztJQUMxRDtFQUNGLENBQUMsQ0FBQztFQUVGLE9BQU9WLEdBQUc7QUFDWixDQUFDO0FBRURuRCxTQUFTLENBQUNnRSxZQUFZLEdBQUcsVUFBVWIsR0FBRyxFQUFFO0VBQ3RDLE1BQU1jLElBQUksR0FBR0gsS0FBSyxDQUFDSSxLQUFLLENBQUNmLEdBQUcsQ0FBQzs7RUFFN0I7RUFDQTtFQUNBLElBQUl0QixNQUFNLENBQUNhLElBQUksQ0FBQ1MsR0FBRyxFQUFFLFFBQVEsQ0FBQyxFQUFFO0lBQzlCLE1BQU1NLE9BQU8sR0FBRyxFQUFFO0lBRWxCdkIsTUFBTSxDQUFDSCxJQUFJLENBQUNvQixHQUFHLENBQUNLLE1BQU0sQ0FBQyxDQUFDRSxPQUFPLENBQUNqQixHQUFHLElBQUk7TUFDckMsTUFBTTBCLEtBQUssR0FBR2hCLEdBQUcsQ0FBQ0ssTUFBTSxDQUFDZixHQUFHLENBQUM7TUFFN0IsSUFBSSxPQUFPMEIsS0FBSyxLQUFLLFdBQVcsRUFBRTtRQUNoQ1YsT0FBTyxDQUFDVyxJQUFJLENBQUMzQixHQUFHLENBQUM7UUFDakIsT0FBT3dCLElBQUksQ0FBQ1QsTUFBTSxDQUFDZixHQUFHLENBQUM7TUFDekI7SUFDRixDQUFDLENBQUM7SUFFRixJQUFJLENBQUVULE9BQU8sQ0FBQ3lCLE9BQU8sQ0FBQyxFQUFFO01BQ3RCUSxJQUFJLENBQUNSLE9BQU8sR0FBR0EsT0FBTztJQUN4QjtJQUVBLElBQUl6QixPQUFPLENBQUNpQyxJQUFJLENBQUNULE1BQU0sQ0FBQyxFQUFFO01BQ3hCLE9BQU9TLElBQUksQ0FBQ1QsTUFBTTtJQUNwQjtFQUNGOztFQUVBO0VBQ0EsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDRSxPQUFPLENBQUNHLEtBQUssSUFBSTtJQUM5QyxJQUFJaEMsTUFBTSxDQUFDYSxJQUFJLENBQUN1QixJQUFJLEVBQUVKLEtBQUssQ0FBQyxFQUFFO01BQzVCSSxJQUFJLENBQUNKLEtBQUssQ0FBQyxHQUFHQyxLQUFLLENBQUNPLHVCQUF1QixDQUFDSixJQUFJLENBQUNKLEtBQUssQ0FBQyxDQUFDO0lBQzFEO0VBQ0YsQ0FBQyxDQUFDO0VBRUYsSUFBSVYsR0FBRyxDQUFDbUIsRUFBRSxJQUFJLE9BQU9uQixHQUFHLENBQUNtQixFQUFFLEtBQUssUUFBUSxFQUFFO0lBQ3hDLE1BQU0sSUFBSUMsS0FBSyxDQUFDLDRCQUE0QixDQUFDO0VBQy9DO0VBRUEsT0FBT25CLElBQUksQ0FBQ29CLFNBQVMsQ0FBQ1AsSUFBSSxDQUFDO0FBQzdCLENBQUMsQzs7Ozs7Ozs7Ozs7QUNwSEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FqRSxTQUFTLENBQUN5RSxnQkFBZ0IsR0FBRyxNQUFNQSxnQkFBZ0IsQ0FBQztFQUNsRHZFLFdBQVcsQ0FBQ0MsT0FBTyxFQUFFO0lBQ25CO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDSSxJQUFJLENBQUN1RSxZQUFZLEdBQUd2RSxPQUFPLENBQUN1RSxZQUFZOztJQUV4QztJQUNBO0lBQ0E7SUFDQSxJQUFJLENBQUNDLFFBQVEsR0FBR3hFLE9BQU8sQ0FBQ3lFLE9BQU8sSUFBSSxZQUFZLENBQUMsQ0FBQztJQUNqRCxJQUFJLENBQUNDLGNBQWMsR0FBRyxLQUFLOztJQUUzQjs7SUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNJLElBQUksQ0FBQ0MsTUFBTSxHQUFHM0UsT0FBTyxDQUFDMkUsTUFBTTs7SUFFNUI7SUFDQTtJQUNBLElBQUksQ0FBQ0MsVUFBVSxHQUFHNUUsT0FBTyxDQUFDNkUsU0FBUyxJQUFJLFlBQVksQ0FBQyxDQUFDOztJQUVyRDs7SUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNJLElBQUksQ0FBQ0MsVUFBVSxHQUFHOUUsT0FBTyxDQUFDOEUsVUFBVTs7SUFFcEM7SUFDQSxJQUFJLENBQUNDLFVBQVUsR0FBRy9FLE9BQU8sQ0FBQytFLFVBQVU7O0lBRXBDO0lBQ0EsSUFBSSxDQUFDQyxZQUFZLEdBQUcsSUFBSTtFQUMxQjs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRVAsT0FBTyxHQUFHO0lBQ1IsSUFBSSxDQUFDQyxjQUFjLEdBQUcsSUFBSTtJQUMxQixJQUFJLENBQUNGLFFBQVEsRUFBRTtFQUNqQjs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFSyxTQUFTLENBQUNGLE1BQU0sRUFBRTtJQUNoQixJQUFJLElBQUksQ0FBQ0QsY0FBYyxFQUFFO01BQ3ZCLE1BQU0sSUFBSU4sS0FBSyxDQUFDLHdEQUF3RCxDQUFDO0lBQzNFO0lBQ0EsSUFBSSxDQUFDTyxNQUFNLEdBQUdBLE1BQU07SUFDcEIsSUFBSSxDQUFDQyxVQUFVLENBQUNELE1BQU0sQ0FBQztFQUN6QjtBQUNGLENBQUMsQzs7Ozs7Ozs7Ozs7QUM3RkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOUUsU0FBUyxDQUFDb0YsWUFBWSxHQUFHLE1BQU1BLFlBQVksQ0FBQztFQUMxQ2xGLFdBQVcsQ0FBQ0MsT0FBTyxFQUFFO0lBQ25CLElBQUksQ0FBQ2tGLElBQUksR0FBRyxFQUFFLENBQUNDLE1BQU0sQ0FBQ25GLE9BQU8sQ0FBQ2tGLElBQUksSUFBSUUsV0FBVyxFQUFFLENBQUM7SUFDcEQsSUFBSSxDQUFDQyxTQUFTLEdBQUd0RCxNQUFNLENBQUN1RCxNQUFNLENBQUMsSUFBSSxDQUFDO0VBQ3RDOztFQUVBO0VBQ0E7RUFDQTtFQUNBQyxTQUFTLENBQUNDLElBQUksRUFBRTtJQUNkLElBQUlDLElBQUksR0FBRyxJQUFJO0lBRWYsSUFBSUMsUUFBUSxHQUFHRCxJQUFJLENBQUNKLFNBQVMsQ0FBQ0csSUFBSSxDQUFDLElBQUksSUFBSTtJQUMzQyxJQUFJRSxRQUFRLEtBQUssSUFBSSxFQUFFO01BQ3JCLElBQUlDLFlBQVksR0FBR0YsSUFBSSxDQUFDUCxJQUFJLENBQUNDLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDO01BQ3pDLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxZQUFZLENBQUN0RCxNQUFNLEVBQUV1RCxDQUFDLEVBQUUsRUFBRTtRQUM1QyxJQUFJLE9BQU9ELFlBQVksQ0FBQ0MsQ0FBQyxDQUFDLEtBQUssVUFBVSxFQUFFO1VBQ3pDRCxZQUFZLENBQUNDLENBQUMsQ0FBQyxHQUFHRCxZQUFZLENBQUNDLENBQUMsQ0FBQyxFQUFFO1FBQ3JDO01BQ0Y7TUFDQUgsSUFBSSxDQUFDSixTQUFTLENBQUNHLElBQUksQ0FBQyxHQUFHRSxRQUFRLEdBQUdHLE1BQU0sQ0FBQ0MsZUFBZSxDQUFDQyxLQUFLLENBQUMsSUFBSSxFQUFFSixZQUFZLENBQUM7SUFDcEY7SUFDQSxPQUFPRCxRQUFRO0VBQ2pCO0FBQ0YsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNOLFdBQVcsR0FBRztFQUNyQixPQUFPUyxNQUFNLENBQUNHLFNBQVMsQ0FBQyxFQUFFLENBQUM7QUFDN0I7QUFBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FuRyxTQUFTLENBQUNvRixZQUFZLENBQUNnQixHQUFHLEdBQUcsVUFBVUMsS0FBSyxFQUFFVixJQUFJLEVBQUU7RUFDbEQsSUFBSSxDQUFDQSxJQUFJLEVBQUU7SUFDVEEsSUFBSSxHQUFHLFNBQVM7RUFDbEI7RUFDQSxJQUFJLENBQUNVLEtBQUssRUFBRTtJQUNWO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsT0FBT0wsTUFBTSxDQUFDTSxRQUFRO0VBQ3hCO0VBQ0EsSUFBSW5CLFlBQVksR0FBR2tCLEtBQUssQ0FBQ2xCLFlBQVk7RUFDckMsSUFBSSxDQUFDQSxZQUFZLEVBQUU7SUFDakJrQixLQUFLLENBQUNsQixZQUFZLEdBQUdBLFlBQVksR0FBRyxJQUFJbkYsU0FBUyxDQUFDb0YsWUFBWSxDQUFDO01BQzdEQyxJQUFJLEVBQUVnQixLQUFLLENBQUNuQjtJQUNkLENBQUMsQ0FBQztFQUNKO0VBQ0EsT0FBT0MsWUFBWSxDQUFDTyxTQUFTLENBQUNDLElBQUksQ0FBQztBQUNyQyxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBM0YsU0FBUyxDQUFDdUcsV0FBVyxHQUFHLFVBQVVDLFNBQVMsRUFBRUMsVUFBVSxFQUFFO0VBQ3ZELElBQUlDLE1BQU0sR0FBRzFHLFNBQVMsQ0FBQ29GLFlBQVksQ0FBQ2dCLEdBQUcsQ0FBQ0ksU0FBUyxFQUFFLE9BQU8sR0FBR0MsVUFBVSxDQUFDO0VBQ3hFLE9BQU9DLE1BQU0sQ0FBQ1AsU0FBUyxDQUFDLEVBQUUsQ0FBQztBQUM3QixDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1jb21tb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBuYW1lc3BhY2UgRERQQ29tbW9uXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEREUENvbW1vbi1yZWxhdGVkIG1ldGhvZHMvY2xhc3Nlcy4gU2hhcmVkIGJldHdlZW4gXG4gKiBgZGRwLWNsaWVudGAgYW5kIGBkZHAtc2VydmVyYCwgd2hlcmUgdGhlIGRkcC1jbGllbnQgaXMgdGhlIGltcGxlbWVudGF0aW9uXG4gKiBvZiBhIGRkcCBjbGllbnQgZm9yIGJvdGggY2xpZW50IEFORCBzZXJ2ZXI7IGFuZCB0aGUgZGRwIHNlcnZlciBpcyB0aGVcbiAqIGltcGxlbWVudGF0aW9uIG9mIHRoZSBsaXZlZGF0YSBzZXJ2ZXIgYW5kIHN0cmVhbSBzZXJ2ZXIuIENvbW1vbiBcbiAqIGZ1bmN0aW9uYWxpdHkgc2hhcmVkIGJldHdlZW4gYm90aCBjYW4gYmUgc2hhcmVkIHVuZGVyIHRoaXMgbmFtZXNwYWNlXG4gKi9cbkREUENvbW1vbiA9IHt9O1xuIiwiLy8gSGVhcnRiZWF0IG9wdGlvbnM6XG4vLyAgIGhlYXJ0YmVhdEludGVydmFsOiBpbnRlcnZhbCB0byBzZW5kIHBpbmdzLCBpbiBtaWxsaXNlY29uZHMuXG4vLyAgIGhlYXJ0YmVhdFRpbWVvdXQ6IHRpbWVvdXQgdG8gY2xvc2UgdGhlIGNvbm5lY3Rpb24gaWYgYSByZXBseSBpc24ndFxuLy8gICAgIHJlY2VpdmVkLCBpbiBtaWxsaXNlY29uZHMuXG4vLyAgIHNlbmRQaW5nOiBmdW5jdGlvbiB0byBjYWxsIHRvIHNlbmQgYSBwaW5nIG9uIHRoZSBjb25uZWN0aW9uLlxuLy8gICBvblRpbWVvdXQ6IGZ1bmN0aW9uIHRvIGNhbGwgdG8gY2xvc2UgdGhlIGNvbm5lY3Rpb24uXG5cbkREUENvbW1vbi5IZWFydGJlYXQgPSBjbGFzcyBIZWFydGJlYXQge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWw7XG4gICAgdGhpcy5oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuICAgIHRoaXMuX3NlbmRQaW5nID0gb3B0aW9ucy5zZW5kUGluZztcbiAgICB0aGlzLl9vblRpbWVvdXQgPSBvcHRpb25zLm9uVGltZW91dDtcbiAgICB0aGlzLl9zZWVuUGFja2V0ID0gZmFsc2U7XG5cbiAgICB0aGlzLl9oZWFydGJlYXRJbnRlcnZhbEhhbmRsZSA9IG51bGw7XG4gICAgdGhpcy5faGVhcnRiZWF0VGltZW91dEhhbmRsZSA9IG51bGw7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuX2NsZWFySGVhcnRiZWF0SW50ZXJ2YWxUaW1lcigpO1xuICAgIHRoaXMuX2NsZWFySGVhcnRiZWF0VGltZW91dFRpbWVyKCk7XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLl9zdGFydEhlYXJ0YmVhdEludGVydmFsVGltZXIoKTtcbiAgfVxuXG4gIF9zdGFydEhlYXJ0YmVhdEludGVydmFsVGltZXIoKSB7XG4gICAgdGhpcy5faGVhcnRiZWF0SW50ZXJ2YWxIYW5kbGUgPSBNZXRlb3Iuc2V0SW50ZXJ2YWwoXG4gICAgICAoKSA9PiB0aGlzLl9oZWFydGJlYXRJbnRlcnZhbEZpcmVkKCksXG4gICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsXG4gICAgKTtcbiAgfVxuXG4gIF9zdGFydEhlYXJ0YmVhdFRpbWVvdXRUaW1lcigpIHtcbiAgICB0aGlzLl9oZWFydGJlYXRUaW1lb3V0SGFuZGxlID0gTWV0ZW9yLnNldFRpbWVvdXQoXG4gICAgICAoKSA9PiB0aGlzLl9oZWFydGJlYXRUaW1lb3V0RmlyZWQoKSxcbiAgICAgIHRoaXMuaGVhcnRiZWF0VGltZW91dFxuICAgICk7XG4gIH1cblxuICBfY2xlYXJIZWFydGJlYXRJbnRlcnZhbFRpbWVyKCkge1xuICAgIGlmICh0aGlzLl9oZWFydGJlYXRJbnRlcnZhbEhhbmRsZSkge1xuICAgICAgTWV0ZW9yLmNsZWFySW50ZXJ2YWwodGhpcy5faGVhcnRiZWF0SW50ZXJ2YWxIYW5kbGUpO1xuICAgICAgdGhpcy5faGVhcnRiZWF0SW50ZXJ2YWxIYW5kbGUgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9jbGVhckhlYXJ0YmVhdFRpbWVvdXRUaW1lcigpIHtcbiAgICBpZiAodGhpcy5faGVhcnRiZWF0VGltZW91dEhhbmRsZSkge1xuICAgICAgTWV0ZW9yLmNsZWFyVGltZW91dCh0aGlzLl9oZWFydGJlYXRUaW1lb3V0SGFuZGxlKTtcbiAgICAgIHRoaXMuX2hlYXJ0YmVhdFRpbWVvdXRIYW5kbGUgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBoZWFydGJlYXQgaW50ZXJ2YWwgdGltZXIgaXMgZmlyZWQgd2hlbiB3ZSBzaG91bGQgc2VuZCBhIHBpbmcuXG4gIF9oZWFydGJlYXRJbnRlcnZhbEZpcmVkKCkge1xuICAgIC8vIGRvbid0IHNlbmQgcGluZyBpZiB3ZSd2ZSBzZWVuIGEgcGFja2V0IHNpbmNlIHdlIGxhc3QgY2hlY2tlZCxcbiAgICAvLyAqb3IqIGlmIHdlIGhhdmUgYWxyZWFkeSBzZW50IGEgcGluZyBhbmQgYXJlIGF3YWl0aW5nIGEgdGltZW91dC5cbiAgICAvLyBUaGF0IHNob3VsZG4ndCBoYXBwZW4sIGJ1dCBpdCdzIHBvc3NpYmxlIGlmXG4gICAgLy8gYHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWxgIGlzIHNtYWxsZXIgdGhhblxuICAgIC8vIGB0aGlzLmhlYXJ0YmVhdFRpbWVvdXRgLlxuICAgIGlmICghIHRoaXMuX3NlZW5QYWNrZXQgJiYgISB0aGlzLl9oZWFydGJlYXRUaW1lb3V0SGFuZGxlKSB7XG4gICAgICB0aGlzLl9zZW5kUGluZygpO1xuICAgICAgLy8gU2V0IHVwIHRpbWVvdXQsIGluIGNhc2UgYSBwb25nIGRvZXNuJ3QgYXJyaXZlIGluIHRpbWUuXG4gICAgICB0aGlzLl9zdGFydEhlYXJ0YmVhdFRpbWVvdXRUaW1lcigpO1xuICAgIH1cbiAgICB0aGlzLl9zZWVuUGFja2V0ID0gZmFsc2U7XG4gIH1cblxuICAvLyBUaGUgaGVhcnRiZWF0IHRpbWVvdXQgdGltZXIgaXMgZmlyZWQgd2hlbiB3ZSBzZW50IGEgcGluZywgYnV0IHdlXG4gIC8vIHRpbWVkIG91dCB3YWl0aW5nIGZvciB0aGUgcG9uZy5cbiAgX2hlYXJ0YmVhdFRpbWVvdXRGaXJlZCgpIHtcbiAgICB0aGlzLl9oZWFydGJlYXRUaW1lb3V0SGFuZGxlID0gbnVsbDtcbiAgICB0aGlzLl9vblRpbWVvdXQoKTtcbiAgfVxuXG4gIG1lc3NhZ2VSZWNlaXZlZCgpIHtcbiAgICAvLyBUZWxsIHBlcmlvZGljIGNoZWNraW4gdGhhdCB3ZSBoYXZlIHNlZW4gYSBwYWNrZXQsIGFuZCB0aHVzIGl0XG4gICAgLy8gZG9lcyBub3QgbmVlZCB0byBzZW5kIGEgcGluZyB0aGlzIGN5Y2xlLlxuICAgIHRoaXMuX3NlZW5QYWNrZXQgPSB0cnVlO1xuICAgIC8vIElmIHdlIHdlcmUgd2FpdGluZyBmb3IgYSBwb25nLCB3ZSBnb3QgaXQuXG4gICAgaWYgKHRoaXMuX2hlYXJ0YmVhdFRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHRoaXMuX2NsZWFySGVhcnRiZWF0VGltZW91dFRpbWVyKCk7XG4gICAgfVxuICB9XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuZXhwb3J0IGNvbnN0IHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuXG5leHBvcnQgZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKE9iamVjdChvYmopKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRW1wdHkob2JqKSB7XG4gIGlmIChvYmogPT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSB8fFxuICAgICAgdHlwZW9mIG9iaiA9PT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiBvYmoubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgZm9yIChjb25zdCBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKGhhc093bi5jYWxsKG9iaiwga2V5KSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbGFzdChhcnJheSwgbiwgZ3VhcmQpIHtcbiAgaWYgKGFycmF5ID09IG51bGwpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoKG4gPT0gbnVsbCkgfHwgZ3VhcmQpIHtcbiAgICByZXR1cm4gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gIH1cblxuICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgTWF0aC5tYXgoYXJyYXkubGVuZ3RoIC0gbiwgMCkpO1xufVxuXG5ERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyA9IFsgJzEnLCAncHJlMicsICdwcmUxJyBdO1xuXG5ERFBDb21tb24ucGFyc2VERFAgPSBmdW5jdGlvbiAoc3RyaW5nTWVzc2FnZSkge1xuICB0cnkge1xuICAgIHZhciBtc2cgPSBKU09OLnBhcnNlKHN0cmluZ01lc3NhZ2UpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkRpc2NhcmRpbmcgbWVzc2FnZSB3aXRoIGludmFsaWQgSlNPTlwiLCBzdHJpbmdNZXNzYWdlKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICAvLyBERFAgbWVzc2FnZXMgbXVzdCBiZSBvYmplY3RzLlxuICBpZiAobXNnID09PSBudWxsIHx8IHR5cGVvZiBtc2cgIT09ICdvYmplY3QnKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkRpc2NhcmRpbmcgbm9uLW9iamVjdCBERFAgbWVzc2FnZVwiLCBzdHJpbmdNZXNzYWdlKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIG1hc3NhZ2UgbXNnIHRvIGdldCBpdCBpbnRvIFwiYWJzdHJhY3QgZGRwXCIgcmF0aGVyIHRoYW4gXCJ3aXJlIGRkcFwiIGZvcm1hdC5cblxuICAvLyBzd2l0Y2ggYmV0d2VlbiBcImNsZWFyZWRcIiByZXAgb2YgdW5zZXR0aW5nIGZpZWxkcyBhbmQgXCJ1bmRlZmluZWRcIlxuICAvLyByZXAgb2Ygc2FtZVxuICBpZiAoaGFzT3duLmNhbGwobXNnLCAnY2xlYXJlZCcpKSB7XG4gICAgaWYgKCEgaGFzT3duLmNhbGwobXNnLCAnZmllbGRzJykpIHtcbiAgICAgIG1zZy5maWVsZHMgPSB7fTtcbiAgICB9XG4gICAgbXNnLmNsZWFyZWQuZm9yRWFjaChjbGVhcktleSA9PiB7XG4gICAgICBtc2cuZmllbGRzW2NsZWFyS2V5XSA9IHVuZGVmaW5lZDtcbiAgICB9KTtcbiAgICBkZWxldGUgbXNnLmNsZWFyZWQ7XG4gIH1cblxuICBbJ2ZpZWxkcycsICdwYXJhbXMnLCAncmVzdWx0J10uZm9yRWFjaChmaWVsZCA9PiB7XG4gICAgaWYgKGhhc093bi5jYWxsKG1zZywgZmllbGQpKSB7XG4gICAgICBtc2dbZmllbGRdID0gRUpTT04uX2FkanVzdFR5cGVzRnJvbUpTT05WYWx1ZShtc2dbZmllbGRdKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBtc2c7XG59O1xuXG5ERFBDb21tb24uc3RyaW5naWZ5RERQID0gZnVuY3Rpb24gKG1zZykge1xuICBjb25zdCBjb3B5ID0gRUpTT04uY2xvbmUobXNnKTtcblxuICAvLyBzd2l6emxlICdjaGFuZ2VkJyBtZXNzYWdlcyBmcm9tICdmaWVsZHMgdW5kZWZpbmVkJyByZXAgdG8gJ2ZpZWxkc1xuICAvLyBhbmQgY2xlYXJlZCcgcmVwXG4gIGlmIChoYXNPd24uY2FsbChtc2csICdmaWVsZHMnKSkge1xuICAgIGNvbnN0IGNsZWFyZWQgPSBbXTtcblxuICAgIE9iamVjdC5rZXlzKG1zZy5maWVsZHMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gbXNnLmZpZWxkc1trZXldO1xuXG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGNsZWFyZWQucHVzaChrZXkpO1xuICAgICAgICBkZWxldGUgY29weS5maWVsZHNba2V5XTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghIGlzRW1wdHkoY2xlYXJlZCkpIHtcbiAgICAgIGNvcHkuY2xlYXJlZCA9IGNsZWFyZWQ7XG4gICAgfVxuXG4gICAgaWYgKGlzRW1wdHkoY29weS5maWVsZHMpKSB7XG4gICAgICBkZWxldGUgY29weS5maWVsZHM7XG4gICAgfVxuICB9XG5cbiAgLy8gYWRqdXN0IHR5cGVzIHRvIGJhc2ljXG4gIFsnZmllbGRzJywgJ3BhcmFtcycsICdyZXN1bHQnXS5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICBpZiAoaGFzT3duLmNhbGwoY29weSwgZmllbGQpKSB7XG4gICAgICBjb3B5W2ZpZWxkXSA9IEVKU09OLl9hZGp1c3RUeXBlc1RvSlNPTlZhbHVlKGNvcHlbZmllbGRdKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChtc2cuaWQgJiYgdHlwZW9mIG1zZy5pZCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXNzYWdlIGlkIGlzIG5vdCBhIHN0cmluZ1wiKTtcbiAgfVxuXG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShjb3B5KTtcbn07XG4iLCIvLyBJbnN0YW5jZSBuYW1lIGlzIHRoaXMgYmVjYXVzZSBpdCBpcyB1c3VhbGx5IHJlZmVycmVkIHRvIGFzIHRoaXMgaW5zaWRlIGFcbi8vIG1ldGhvZCBkZWZpbml0aW9uXG4vKipcbiAqIEBzdW1tYXJ5IFRoZSBzdGF0ZSBmb3IgYSBzaW5nbGUgaW52b2NhdGlvbiBvZiBhIG1ldGhvZCwgcmVmZXJlbmNlZCBieSB0aGlzXG4gKiBpbnNpZGUgYSBtZXRob2QgZGVmaW5pdGlvbi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAaW5zdGFuY2VOYW1lIHRoaXNcbiAqIEBzaG93SW5zdGFuY2VOYW1lIHRydWVcbiAqL1xuRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24gPSBjbGFzcyBNZXRob2RJbnZvY2F0aW9uIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIC8vIHRydWUgaWYgd2UncmUgcnVubmluZyBub3QgdGhlIGFjdHVhbCBtZXRob2QsIGJ1dCBhIHN0dWIgKHRoYXQgaXMsXG4gICAgLy8gaWYgd2UncmUgb24gYSBjbGllbnQgKHdoaWNoIG1heSBiZSBhIGJyb3dzZXIsIG9yIGluIHRoZSBmdXR1cmUgYVxuICAgIC8vIHNlcnZlciBjb25uZWN0aW5nIHRvIGFub3RoZXIgc2VydmVyKSBhbmQgcHJlc2VudGx5IHJ1bm5pbmcgYVxuICAgIC8vIHNpbXVsYXRpb24gb2YgYSBzZXJ2ZXItc2lkZSBtZXRob2QgZm9yIGxhdGVuY3kgY29tcGVuc2F0aW9uXG4gICAgLy8gcHVycG9zZXMpLiBub3QgY3VycmVudGx5IHRydWUgZXhjZXB0IGluIGEgY2xpZW50IHN1Y2ggYXMgYSBicm93c2VyLFxuICAgIC8vIHNpbmNlIHRoZXJlJ3MgdXN1YWxseSBubyBwb2ludCBpbiBydW5uaW5nIHN0dWJzIHVubGVzcyB5b3UgaGF2ZSBhXG4gICAgLy8gemVyby1sYXRlbmN5IGNvbm5lY3Rpb24gdG8gdGhlIHVzZXIuXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBBY2Nlc3MgaW5zaWRlIGEgbWV0aG9kIGludm9jYXRpb24uICBCb29sZWFuIHZhbHVlLCB0cnVlIGlmIHRoaXMgaW52b2NhdGlvbiBpcyBhIHN0dWIuXG4gICAgICogQGxvY3VzIEFueXdoZXJlXG4gICAgICogQG5hbWUgIGlzU2ltdWxhdGlvblxuICAgICAqIEBtZW1iZXJPZiBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvblxuICAgICAqIEBpbnN0YW5jZVxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuaXNTaW11bGF0aW9uID0gb3B0aW9ucy5pc1NpbXVsYXRpb247XG5cbiAgICAvLyBjYWxsIHRoaXMgZnVuY3Rpb24gdG8gYWxsb3cgb3RoZXIgbWV0aG9kIGludm9jYXRpb25zIChmcm9tIHRoZVxuICAgIC8vIHNhbWUgY2xpZW50KSB0byBjb250aW51ZSBydW5uaW5nIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhpcyBvbmUgdG9cbiAgICAvLyBjb21wbGV0ZS5cbiAgICB0aGlzLl91bmJsb2NrID0gb3B0aW9ucy51bmJsb2NrIHx8IGZ1bmN0aW9uICgpIHt9O1xuICAgIHRoaXMuX2NhbGxlZFVuYmxvY2sgPSBmYWxzZTtcblxuICAgIC8vIGN1cnJlbnQgdXNlciBpZFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgVGhlIGlkIG9mIHRoZSB1c2VyIHRoYXQgbWFkZSB0aGlzIG1ldGhvZCBjYWxsLCBvciBgbnVsbGAgaWYgbm8gdXNlciB3YXMgbG9nZ2VkIGluLlxuICAgICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgICAqIEBuYW1lICB1c2VySWRcbiAgICAgKiBAbWVtYmVyT2YgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb25cbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKi9cbiAgICB0aGlzLnVzZXJJZCA9IG9wdGlvbnMudXNlcklkO1xuXG4gICAgLy8gc2V0cyBjdXJyZW50IHVzZXIgaWQgaW4gYWxsIGFwcHJvcHJpYXRlIHNlcnZlciBjb250ZXh0cyBhbmRcbiAgICAvLyByZXJ1bnMgc3Vic2NyaXB0aW9uc1xuICAgIHRoaXMuX3NldFVzZXJJZCA9IG9wdGlvbnMuc2V0VXNlcklkIHx8IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgLy8gT24gdGhlIHNlcnZlciwgdGhlIGNvbm5lY3Rpb24gdGhpcyBtZXRob2QgY2FsbCBjYW1lIGluIG9uLlxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQWNjZXNzIGluc2lkZSBhIG1ldGhvZCBpbnZvY2F0aW9uLiBUaGUgW2Nvbm5lY3Rpb25dKCNtZXRlb3Jfb25jb25uZWN0aW9uKSB0aGF0IHRoaXMgbWV0aG9kIHdhcyByZWNlaXZlZCBvbi4gYG51bGxgIGlmIHRoZSBtZXRob2QgaXMgbm90IGFzc29jaWF0ZWQgd2l0aCBhIGNvbm5lY3Rpb24sIGVnLiBhIHNlcnZlciBpbml0aWF0ZWQgbWV0aG9kIGNhbGwuIENhbGxzIHRvIG1ldGhvZHMgbWFkZSBmcm9tIGEgc2VydmVyIG1ldGhvZCB3aGljaCB3YXMgaW4gdHVybiBpbml0aWF0ZWQgZnJvbSB0aGUgY2xpZW50IHNoYXJlIHRoZSBzYW1lIGBjb25uZWN0aW9uYC5cbiAgICAgKiBAbG9jdXMgU2VydmVyXG4gICAgICogQG5hbWUgIGNvbm5lY3Rpb25cbiAgICAgKiBAbWVtYmVyT2YgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb25cbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKi9cbiAgICB0aGlzLmNvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb247XG5cbiAgICAvLyBUaGUgc2VlZCBmb3IgcmFuZG9tU3RyZWFtIHZhbHVlIGdlbmVyYXRpb25cbiAgICB0aGlzLnJhbmRvbVNlZWQgPSBvcHRpb25zLnJhbmRvbVNlZWQ7XG5cbiAgICAvLyBUaGlzIGlzIHNldCBieSBSYW5kb21TdHJlYW0uZ2V0OyBhbmQgaG9sZHMgdGhlIHJhbmRvbSBzdHJlYW0gc3RhdGVcbiAgICB0aGlzLnJhbmRvbVN0cmVhbSA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgYSBtZXRob2QgaW52b2NhdGlvbi4gIEFsbG93IHN1YnNlcXVlbnQgbWV0aG9kIGZyb20gdGhpcyBjbGllbnQgdG8gYmVnaW4gcnVubmluZyBpbiBhIG5ldyBmaWJlci5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb25cbiAgICogQGluc3RhbmNlXG4gICAqL1xuICB1bmJsb2NrKCkge1xuICAgIHRoaXMuX2NhbGxlZFVuYmxvY2sgPSB0cnVlO1xuICAgIHRoaXMuX3VuYmxvY2soKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBTZXQgdGhlIGxvZ2dlZCBpbiB1c2VyLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmcgfCBudWxsfSB1c2VySWQgVGhlIHZhbHVlIHRoYXQgc2hvdWxkIGJlIHJldHVybmVkIGJ5IGB1c2VySWRgIG9uIHRoaXMgY29ubmVjdGlvbi5cbiAgICovXG4gIHNldFVzZXJJZCh1c2VySWQpIHtcbiAgICBpZiAodGhpcy5fY2FsbGVkVW5ibG9jaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBzZXRVc2VySWQgaW4gYSBtZXRob2QgYWZ0ZXIgY2FsbGluZyB1bmJsb2NrXCIpO1xuICAgIH1cbiAgICB0aGlzLnVzZXJJZCA9IHVzZXJJZDtcbiAgICB0aGlzLl9zZXRVc2VySWQodXNlcklkKTtcbiAgfVxufTtcbiIsIi8vIFJhbmRvbVN0cmVhbSBhbGxvd3MgZm9yIGdlbmVyYXRpb24gb2YgcHNldWRvLXJhbmRvbSB2YWx1ZXMsIGZyb20gYSBzZWVkLlxuLy9cbi8vIFdlIHVzZSB0aGlzIGZvciBjb25zaXN0ZW50ICdyYW5kb20nIG51bWJlcnMgYWNyb3NzIHRoZSBjbGllbnQgYW5kIHNlcnZlci5cbi8vIFdlIHdhbnQgdG8gZ2VuZXJhdGUgcHJvYmFibHktdW5pcXVlIElEcyBvbiB0aGUgY2xpZW50LCBhbmQgd2UgaWRlYWxseSB3YW50XG4vLyB0aGUgc2VydmVyIHRvIGdlbmVyYXRlIHRoZSBzYW1lIElEcyB3aGVuIGl0IGV4ZWN1dGVzIHRoZSBtZXRob2QuXG4vL1xuLy8gRm9yIGdlbmVyYXRlZCB2YWx1ZXMgdG8gYmUgdGhlIHNhbWUsIHdlIG11c3Qgc2VlZCBvdXJzZWx2ZXMgdGhlIHNhbWUgd2F5LFxuLy8gYW5kIHdlIG11c3Qga2VlcCB0cmFjayBvZiB0aGUgY3VycmVudCBzdGF0ZSBvZiBvdXIgcHNldWRvLXJhbmRvbSBnZW5lcmF0b3JzLlxuLy8gV2UgY2FsbCB0aGlzIHN0YXRlIHRoZSBzY29wZS4gQnkgZGVmYXVsdCwgd2UgdXNlIHRoZSBjdXJyZW50IEREUCBtZXRob2Rcbi8vIGludm9jYXRpb24gYXMgb3VyIHNjb3BlLiAgRERQIG5vdyBhbGxvd3MgdGhlIGNsaWVudCB0byBzcGVjaWZ5IGEgcmFuZG9tU2VlZC5cbi8vIElmIGEgcmFuZG9tU2VlZCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgdG8gc2VlZCBvdXIgcmFuZG9tIHNlcXVlbmNlcy5cbi8vIEluIHRoaXMgd2F5LCBjbGllbnQgYW5kIHNlcnZlciBtZXRob2QgY2FsbHMgd2lsbCBnZW5lcmF0ZSB0aGUgc2FtZSB2YWx1ZXMuXG4vL1xuLy8gV2UgZXhwb3NlIG11bHRpcGxlIG5hbWVkIHN0cmVhbXM7IGVhY2ggc3RyZWFtIGlzIGluZGVwZW5kZW50XG4vLyBhbmQgaXMgc2VlZGVkIGRpZmZlcmVudGx5IChidXQgcHJlZGljdGFibHkgZnJvbSB0aGUgbmFtZSkuXG4vLyBCeSB1c2luZyBtdWx0aXBsZSBzdHJlYW1zLCB3ZSBzdXBwb3J0IHJlb3JkZXJpbmcgb2YgcmVxdWVzdHMsXG4vLyBhcyBsb25nIGFzIHRoZXkgb2NjdXIgb24gZGlmZmVyZW50IHN0cmVhbXMuXG4vL1xuLy8gQHBhcmFtIG9wdGlvbnMge09wdGlvbmFsIE9iamVjdH1cbi8vICAgc2VlZDogQXJyYXkgb3IgdmFsdWUgLSBTZWVkIHZhbHVlKHMpIGZvciB0aGUgZ2VuZXJhdG9yLlxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgIElmIGFuIGFycmF5LCB3aWxsIGJlIHVzZWQgYXMtaXNcbi8vICAgICAgICAgICAgICAgICAgICAgICAgICBJZiBhIHZhbHVlLCB3aWxsIGJlIGNvbnZlcnRlZCB0byBhIHNpbmdsZS12YWx1ZSBhcnJheVxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgIElmIG9taXR0ZWQsIGEgcmFuZG9tIGFycmF5IHdpbGwgYmUgdXNlZCBhcyB0aGUgc2VlZC5cbkREUENvbW1vbi5SYW5kb21TdHJlYW0gPSBjbGFzcyBSYW5kb21TdHJlYW0ge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgdGhpcy5zZWVkID0gW10uY29uY2F0KG9wdGlvbnMuc2VlZCB8fCByYW5kb21Ub2tlbigpKTtcbiAgICB0aGlzLnNlcXVlbmNlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIH1cblxuICAvLyBHZXQgYSByYW5kb20gc2VxdWVuY2Ugd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUsIGNyZWF0aW5nIGl0IGlmIGRvZXMgbm90IGV4aXN0LlxuICAvLyBOZXcgc2VxdWVuY2VzIGFyZSBzZWVkZWQgd2l0aCB0aGUgc2VlZCBjb25jYXRlbmF0ZWQgd2l0aCB0aGUgbmFtZS5cbiAgLy8gQnkgcGFzc2luZyBhIHNlZWQgaW50byBSYW5kb20uY3JlYXRlLCB3ZSB1c2UgdGhlIEFsZWEgZ2VuZXJhdG9yLlxuICBfc2VxdWVuY2UobmFtZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBzZXF1ZW5jZSA9IHNlbGYuc2VxdWVuY2VzW25hbWVdIHx8IG51bGw7XG4gICAgaWYgKHNlcXVlbmNlID09PSBudWxsKSB7XG4gICAgICB2YXIgc2VxdWVuY2VTZWVkID0gc2VsZi5zZWVkLmNvbmNhdChuYW1lKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VxdWVuY2VTZWVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VxdWVuY2VTZWVkW2ldID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBzZXF1ZW5jZVNlZWRbaV0gPSBzZXF1ZW5jZVNlZWRbaV0oKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgc2VsZi5zZXF1ZW5jZXNbbmFtZV0gPSBzZXF1ZW5jZSA9IFJhbmRvbS5jcmVhdGVXaXRoU2VlZHMuYXBwbHkobnVsbCwgc2VxdWVuY2VTZWVkKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlcXVlbmNlO1xuICB9XG59O1xuXG4vLyBSZXR1cm5zIGEgcmFuZG9tIHN0cmluZyBvZiBzdWZmaWNpZW50IGxlbmd0aCBmb3IgYSByYW5kb20gc2VlZC5cbi8vIFRoaXMgaXMgYSBwbGFjZWhvbGRlciBmdW5jdGlvbjsgYSBzaW1pbGFyIGZ1bmN0aW9uIGlzIHBsYW5uZWRcbi8vIGZvciBSYW5kb20gaXRzZWxmOyB3aGVuIHRoYXQgaXMgYWRkZWQgd2Ugc2hvdWxkIHJlbW92ZSB0aGlzIGZ1bmN0aW9uLFxuLy8gYW5kIGNhbGwgUmFuZG9tJ3MgcmFuZG9tVG9rZW4gaW5zdGVhZC5cbmZ1bmN0aW9uIHJhbmRvbVRva2VuKCkge1xuICByZXR1cm4gUmFuZG9tLmhleFN0cmluZygyMCk7XG59O1xuXG4vLyBSZXR1cm5zIHRoZSByYW5kb20gc3RyZWFtIHdpdGggdGhlIHNwZWNpZmllZCBuYW1lLCBpbiB0aGUgc3BlY2lmaWVkXG4vLyBzY29wZS4gSWYgYSBzY29wZSBpcyBwYXNzZWQsIHRoZW4gd2UgdXNlIHRoYXQgdG8gc2VlZCBhIChub3Rcbi8vIGNyeXB0b2dyYXBoaWNhbGx5IHNlY3VyZSkgUFJORyB1c2luZyB0aGUgZmFzdCBBbGVhIGFsZ29yaXRobS4gIElmXG4vLyBzY29wZSBpcyBudWxsIChvciBvdGhlcndpc2UgZmFsc2V5KSB0aGVuIHdlIHVzZSBhIGdlbmVyYXRlZCBzZWVkLlxuLy9cbi8vIEhvd2V2ZXIsIHNjb3BlIHdpbGwgbm9ybWFsbHkgYmUgdGhlIGN1cnJlbnQgRERQIG1ldGhvZCBpbnZvY2F0aW9uLFxuLy8gc28gd2UnbGwgdXNlIHRoZSBzdHJlYW0gd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUsIGFuZCB3ZSBzaG91bGQgZ2V0XG4vLyBjb25zaXN0ZW50IHZhbHVlcyBvbiB0aGUgY2xpZW50IGFuZCBzZXJ2ZXIgc2lkZXMgb2YgYSBtZXRob2QgY2FsbC5cbkREUENvbW1vbi5SYW5kb21TdHJlYW0uZ2V0ID0gZnVuY3Rpb24gKHNjb3BlLCBuYW1lKSB7XG4gIGlmICghbmFtZSkge1xuICAgIG5hbWUgPSBcImRlZmF1bHRcIjtcbiAgfVxuICBpZiAoIXNjb3BlKSB7XG4gICAgLy8gVGhlcmUgd2FzIG5vIHNjb3BlIHBhc3NlZCBpbjsgdGhlIHNlcXVlbmNlIHdvbid0IGFjdHVhbGx5IGJlXG4gICAgLy8gcmVwcm9kdWNpYmxlLiBidXQgbWFrZSBpdCBmYXN0IChhbmQgbm90IGNyeXB0b2dyYXBoaWNhbGx5XG4gICAgLy8gc2VjdXJlKSBhbnl3YXlzLCBzbyB0aGF0IHRoZSBiZWhhdmlvciBpcyBzaW1pbGFyIHRvIHdoYXQgeW91J2RcbiAgICAvLyBnZXQgYnkgcGFzc2luZyBpbiBhIHNjb3BlLlxuICAgIHJldHVybiBSYW5kb20uaW5zZWN1cmU7XG4gIH1cbiAgdmFyIHJhbmRvbVN0cmVhbSA9IHNjb3BlLnJhbmRvbVN0cmVhbTtcbiAgaWYgKCFyYW5kb21TdHJlYW0pIHtcbiAgICBzY29wZS5yYW5kb21TdHJlYW0gPSByYW5kb21TdHJlYW0gPSBuZXcgRERQQ29tbW9uLlJhbmRvbVN0cmVhbSh7XG4gICAgICBzZWVkOiBzY29wZS5yYW5kb21TZWVkXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHJhbmRvbVN0cmVhbS5fc2VxdWVuY2UobmFtZSk7XG59O1xuXG4vLyBDcmVhdGVzIGEgcmFuZG9tU2VlZCBmb3IgcGFzc2luZyB0byBhIG1ldGhvZCBjYWxsLlxuLy8gTm90ZSB0aGF0IHdlIHRha2UgZW5jbG9zaW5nIGFzIGFuIGFyZ3VtZW50LFxuLy8gdGhvdWdoIHdlIGV4cGVjdCBpdCB0byBiZSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpXG4vLyBIb3dldmVyLCB3ZSBvZnRlbiBldmFsdWF0ZSBtYWtlUnBjU2VlZCBsYXppbHksIGFuZCB0aHVzIHRoZSByZWxldmFudFxuLy8gaW52b2NhdGlvbiBtYXkgbm90IGJlIHRoZSBvbmUgY3VycmVudGx5IGluIHNjb3BlLlxuLy8gSWYgZW5jbG9zaW5nIGlzIG51bGwsIHdlJ2xsIHVzZSBSYW5kb20gYW5kIHZhbHVlcyB3b24ndCBiZSByZXBlYXRhYmxlLlxuRERQQ29tbW9uLm1ha2VScGNTZWVkID0gZnVuY3Rpb24gKGVuY2xvc2luZywgbWV0aG9kTmFtZSkge1xuICB2YXIgc3RyZWFtID0gRERQQ29tbW9uLlJhbmRvbVN0cmVhbS5nZXQoZW5jbG9zaW5nLCAnL3JwYy8nICsgbWV0aG9kTmFtZSk7XG4gIHJldHVybiBzdHJlYW0uaGV4U3RyaW5nKDIwKTtcbn07XG4iXX0=
