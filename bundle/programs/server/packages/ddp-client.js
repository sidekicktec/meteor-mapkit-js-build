(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, args, callback, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/server/server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.link("../common/namespace.js", {
  DDP: "DDP"
}, 0);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/MethodInvoker.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => MethodInvoker
});
class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || (() => {});
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

    // If we're re-sending it, it doesn't matter if data was written the first
    // time.
    this._dataVisible = false;
    this.sentMessage = true;

    // If this is a wait method, make all data messages be buffered until it is
    // done.
    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

    // Actually send the message.
    this._connection._send(this._message);
  }
  // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]);

      // Forget about this method.
      delete this._connection._methodInvokers[this.methodId];

      // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.
      this._connection._outstandingMethodFinished();
    }
  }
  // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];
    this._onResultReceived(err, result);
    this._maybeInvokeCallback();
  }
  // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  dataVisible() {
    this._dataVisible = true;
    this._maybeInvokeCallback();
  }
  // True if receiveResult has been called.
  gotResult() {
    return !!this._methodResult;
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/livedata_connection.js                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
const _excluded = ["stubInvocation", "invocation"],
  _excluded2 = ["stubInvocation", "invocation"];
let _objectWithoutProperties;
module.link("@babel/runtime/helpers/objectWithoutProperties", {
  default(v) {
    _objectWithoutProperties = v;
  }
}, 0);
let _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }
}, 1);
module.export({
  Connection: () => Connection
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }
}, 0);
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }
}, 1);
let Tracker;
module.link("meteor/tracker", {
  Tracker(v) {
    Tracker = v;
  }
}, 2);
let EJSON;
module.link("meteor/ejson", {
  EJSON(v) {
    EJSON = v;
  }
}, 3);
let Random;
module.link("meteor/random", {
  Random(v) {
    Random = v;
  }
}, 4);
let Hook;
module.link("meteor/callback-hook", {
  Hook(v) {
    Hook = v;
  }
}, 5);
let MongoID;
module.link("meteor/mongo-id", {
  MongoID(v) {
    MongoID = v;
  }
}, 6);
let DDP;
module.link("./namespace.js", {
  DDP(v) {
    DDP = v;
  }
}, 7);
let MethodInvoker;
module.link("./MethodInvoker.js", {
  default(v) {
    MethodInvoker = v;
  }
}, 8);
let hasOwn, slice, keys, isEmpty, last;
module.link("meteor/ddp-common/utils.js", {
  hasOwn(v) {
    hasOwn = v;
  },
  slice(v) {
    slice = v;
  },
  keys(v) {
    keys = v;
  },
  isEmpty(v) {
    isEmpty = v;
  },
  last(v) {
    last = v;
  }
}, 9);
let Fiber;
let Future;
if (Meteor.isServer) {
  Fiber = Npm.require('fibers');
  Future = Npm.require('fibers/future');
}
class MongoIDMap extends IdMap {
  constructor() {
    super(MongoID.idStringify, MongoID.idParse);
  }
}

// @param url {String|Object} URL to Meteor app,
//   or an object as a test hook (see code)
// Options:
//   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
//   headers: extra headers to send on the websockets connection, for
//     server-to-server DDP only
//   _sockjsOptions: Specifies options to pass through to the sockjs client
//   onDDPNegotiationVersionFailure: callback when version negotiation fails.
//
// XXX There should be a way to destroy a DDP connection, causing all
// outstanding method calls to fail.
//
// XXX Our current way of handling failure and reconnection is great
// for an app (where we want to tolerate being disconnected as an
// expect state, and keep trying forever to reconnect) but cumbersome
// for something like a command line tool that wants to make a
// connection, call a method, and print an error if connection
// fails. We should have better usability in the latter case (while
// still transparently reconnecting if it's just a transient failure
// or the server migrating us).
class Connection {
  constructor(url, options) {
    const self = this;
    this.options = options = _objectSpread({
      onConnected() {},
      onDDPVersionNegotiationFailure(description) {
        Meteor._debug(description);
      },
      heartbeatInterval: 17500,
      heartbeatTimeout: 15000,
      npmFayeOptions: Object.create(null),
      // These options are only for testing.
      reloadWithOutstanding: false,
      supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
      retry: true,
      respondToPings: true,
      // When updates are coming within this ms interval, batch them together.
      bufferedWritesInterval: 5,
      // Flush buffers immediately if writes are happening continuously for more than this many ms.
      bufferedWritesMaxAge: 500
    }, options);

    // If set, called when we reconnect, queuing method calls _before_ the
    // existing outstanding ones.
    // NOTE: This feature has been preserved for backwards compatibility. The
    // preferred method of setting a callback on reconnect is to use
    // DDP.onReconnect.
    self.onReconnect = null;

    // as a test hook, allow passing a stream instead of a url.
    if (typeof url === 'object') {
      self._stream = url;
    } else {
      const {
        ClientStream
      } = require("meteor/socket-stream-client");
      self._stream = new ClientStream(url, {
        retry: options.retry,
        ConnectionError: DDP.ConnectionError,
        headers: options.headers,
        _sockjsOptions: options._sockjsOptions,
        // Used to keep some tests quiet, or for other cases in which
        // the right thing to do with connection errors is to silently
        // fail (e.g. sending package usage stats). At some point we
        // should have a real API for handling client-stream-level
        // errors.
        _dontPrintErrors: options._dontPrintErrors,
        connectTimeoutMs: options.connectTimeoutMs,
        npmFayeOptions: options.npmFayeOptions
      });
    }
    self._lastSessionId = null;
    self._versionSuggestion = null; // The last proposed DDP version.
    self._version = null; // The DDP version agreed on by client and server.
    self._stores = Object.create(null); // name -> object with methods
    self._methodHandlers = Object.create(null); // name -> func
    self._nextMethodId = 1;
    self._supportedDDPVersions = options.supportedDDPVersions;
    self._heartbeatInterval = options.heartbeatInterval;
    self._heartbeatTimeout = options.heartbeatTimeout;

    // Tracks methods which the user has tried to call but which have not yet
    // called their user callback (ie, they are waiting on their result or for all
    // of their writes to be written to the local cache). Map from method ID to
    // MethodInvoker object.
    self._methodInvokers = Object.create(null);

    // Tracks methods which the user has called but whose result messages have not
    // arrived yet.
    //
    // _outstandingMethodBlocks is an array of blocks of methods. Each block
    // represents a set of methods that can run at the same time. The first block
    // represents the methods which are currently in flight; subsequent blocks
    // must wait for previous blocks to be fully finished before they can be sent
    // to the server.
    //
    // Each block is an object with the following fields:
    // - methods: a list of MethodInvoker objects
    // - wait: a boolean; if true, this block had a single method invoked with
    //         the "wait" option
    //
    // There will never be adjacent blocks with wait=false, because the only thing
    // that makes methods need to be serialized is a wait method.
    //
    // Methods are removed from the first block when their "result" is
    // received. The entire first block is only removed when all of the in-flight
    // methods have received their results (so the "methods" list is empty) *AND*
    // all of the data written by those methods are visible in the local cache. So
    // it is possible for the first block's methods list to be empty, if we are
    // still waiting for some objects to quiesce.
    //
    // Example:
    //  _outstandingMethodBlocks = [
    //    {wait: false, methods: []},
    //    {wait: true, methods: [<MethodInvoker for 'login'>]},
    //    {wait: false, methods: [<MethodInvoker for 'foo'>,
    //                            <MethodInvoker for 'bar'>]}]
    // This means that there were some methods which were sent to the server and
    // which have returned their results, but some of the data written by
    // the methods may not be visible in the local cache. Once all that data is
    // visible, we will send a 'login' method. Once the login method has returned
    // and all the data is visible (including re-running subs if userId changes),
    // we will send the 'foo' and 'bar' methods in parallel.
    self._outstandingMethodBlocks = [];

    // method ID -> array of objects with keys 'collection' and 'id', listing
    // documents written by a given method's stub. keys are associated with
    // methods whose stub wrote at least one document, and whose data-done message
    // has not yet been received.
    self._documentsWrittenByStub = {};
    // collection -> IdMap of "server document" object. A "server document" has:
    // - "document": the version of the document according the
    //   server (ie, the snapshot before a stub wrote it, amended by any changes
    //   received from the server)
    //   It is undefined if we think the document does not exist
    // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
    //   whose "data done" messages have not yet been processed
    self._serverDocuments = {};

    // Array of callbacks to be called after the next update of the local
    // cache. Used for:
    //  - Calling methodInvoker.dataVisible and sub ready callbacks after
    //    the relevant data is flushed.
    //  - Invoking the callbacks of "half-finished" methods after reconnect
    //    quiescence. Specifically, methods whose result was received over the old
    //    connection (so we don't re-send it) but whose data had not been made
    //    visible.
    self._afterUpdateCallbacks = [];

    // In two contexts, we buffer all incoming data messages and then process them
    // all at once in a single update:
    //   - During reconnect, we buffer all data messages until all subs that had
    //     been ready before reconnect are ready again, and all methods that are
    //     active have returned their "data done message"; then
    //   - During the execution of a "wait" method, we buffer all data messages
    //     until the wait method gets its "data done" message. (If the wait method
    //     occurs during reconnect, it doesn't get any special handling.)
    // all data messages are processed in one update.
    //
    // The following fields are used for this "quiescence" process.

    // This buffers the messages that aren't being processed yet.
    self._messagesBufferedUntilQuiescence = [];
    // Map from method ID -> true. Methods are removed from this when their
    // "data done" message is received, and we will not quiesce until it is
    // empty.
    self._methodsBlockingQuiescence = {};
    // map from sub ID -> true for subs that were ready (ie, called the sub
    // ready callback) before reconnect but haven't become ready again yet
    self._subsBeingRevived = {}; // map from sub._id -> true
    // if true, the next data update should reset all stores. (set during
    // reconnect.)
    self._resetStores = false;

    // name -> array of updates for (yet to be created) collections
    self._updatesForUnknownStores = {};
    // if we're blocking a migration, the retry func
    self._retryMigrate = null;
    self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self);
    // Collection name -> array of messages.
    self._bufferedWrites = {};
    // When current buffer of updates must be flushed at, in ms timestamp.
    self._bufferedWritesFlushAt = null;
    // Timeout handle for the next processing of all pending writes
    self._bufferedWritesFlushHandle = null;
    self._bufferedWritesInterval = options.bufferedWritesInterval;
    self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

    // metadata for subscriptions.  Map from sub ID to object with keys:
    //   - id
    //   - name
    //   - params
    //   - inactive (if true, will be cleaned up if not reused in re-run)
    //   - ready (has the 'ready' message been received?)
    //   - readyCallback (an optional callback to call when ready)
    //   - errorCallback (an optional callback to call if the sub terminates with
    //                    an error, XXX COMPAT WITH 1.0.3.1)
    //   - stopCallback (an optional callback to call when the sub terminates
    //     for any reason, with an error argument if an error triggered the stop)
    self._subscriptions = {};

    // Reactive userId.
    self._userId = null;
    self._userIdDeps = new Tracker.Dependency();

    // Block auto-reload while we're waiting for method responses.
    if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
      Package.reload.Reload._onMigrate(retry => {
        if (!self._readyToMigrate()) {
          self._retryMigrate = retry;
          return [false];
        } else {
          return [true];
        }
      });
    }
    const onDisconnect = () => {
      if (self._heartbeat) {
        self._heartbeat.stop();
        self._heartbeat = null;
      }
    };
    if (Meteor.isServer) {
      self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));
      self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));
      self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
    } else {
      self._stream.on('message', this.onMessage.bind(this));
      self._stream.on('reset', this.onReset.bind(this));
      self._stream.on('disconnect', onDisconnect);
    }
  }

  // 'name' is the name of the data on the wire that should go in the
  // store. 'wrappedStore' should be an object with methods beginUpdate, update,
  // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
  registerStore(name, wrappedStore) {
    const self = this;
    if (name in self._stores) return false;

    // Wrap the input object in an object which makes any store method not
    // implemented by 'store' into a no-op.
    const store = Object.create(null);
    const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
    keysOfStore.forEach(method => {
      store[method] = function () {
        if (wrappedStore[method]) {
          return wrappedStore[method](...arguments);
        }
      };
    });
    self._stores[name] = store;
    const queued = self._updatesForUnknownStores[name];
    if (Array.isArray(queued)) {
      store.beginUpdate(queued.length, false);
      queued.forEach(msg => {
        store.update(msg);
      });
      store.endUpdate();
      delete self._updatesForUnknownStores[name];
    }
    return true;
  }

  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.subscribe
   * @summary Subscribe to a record set.  Returns a handle that provides
   * `stop()` and `ready()` methods.
   * @locus Client
   * @param {String} name Name of the subscription.  Matches the name of the
   * server's `publish()` call.
   * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
   * function on server.
   * @param {Function|Object} [callbacks] Optional. May include `onStop`
   * and `onReady` callbacks. If there is an error, it is passed as an
   * argument to `onStop`. If a function is passed instead of an object, it
   * is interpreted as an `onReady` callback.
   */
  subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
    const self = this;
    const params = slice.call(arguments, 1);
    let callbacks = Object.create(null);
    if (params.length) {
      const lastParam = params[params.length - 1];
      if (typeof lastParam === 'function') {
        callbacks.onReady = params.pop();
      } else if (lastParam && [lastParam.onReady,
      // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
      // onStop with an error callback instead.
      lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
        callbacks = params.pop();
      }
    }

    // Is there an existing sub with the same name and param, run in an
    // invalidated Computation? This will happen if we are rerunning an
    // existing computation.
    //
    // For example, consider a rerun of:
    //
    //     Tracker.autorun(function () {
    //       Meteor.subscribe("foo", Session.get("foo"));
    //       Meteor.subscribe("bar", Session.get("bar"));
    //     });
    //
    // If "foo" has changed but "bar" has not, we will match the "bar"
    // subcribe to an existing inactive subscription in order to not
    // unsub and resub the subscription unnecessarily.
    //
    // We only look for one such sub; if there are N apparently-identical subs
    // being invalidated, we will require N matching subscribe calls to keep
    // them all active.
    const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
    let id;
    if (existing) {
      id = existing.id;
      existing.inactive = false; // reactivate

      if (callbacks.onReady) {
        // If the sub is not already ready, replace any ready callback with the
        // one provided now. (It's not really clear what users would expect for
        // an onReady callback inside an autorun; the semantics we provide is
        // that at the time the sub first becomes ready, we call the last
        // onReady callback provided, if any.)
        // If the sub is already ready, run the ready callback right away.
        // It seems that users would expect an onReady callback inside an
        // autorun to trigger once the the sub first becomes ready and also
        // when re-subs happens.
        if (existing.ready) {
          callbacks.onReady();
        } else {
          existing.readyCallback = callbacks.onReady;
        }
      }

      // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
      // onStop with an optional error argument
      if (callbacks.onError) {
        // Replace existing callback if any, so that errors aren't
        // double-reported.
        existing.errorCallback = callbacks.onError;
      }
      if (callbacks.onStop) {
        existing.stopCallback = callbacks.onStop;
      }
    } else {
      // New sub! Generate an id, save it locally, and send message.
      id = Random.id();
      self._subscriptions[id] = {
        id: id,
        name: name,
        params: EJSON.clone(params),
        inactive: false,
        ready: false,
        readyDeps: new Tracker.Dependency(),
        readyCallback: callbacks.onReady,
        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        errorCallback: callbacks.onError,
        stopCallback: callbacks.onStop,
        connection: self,
        remove() {
          delete this.connection._subscriptions[this.id];
          this.ready && this.readyDeps.changed();
        },
        stop() {
          this.connection._send({
            msg: 'unsub',
            id: id
          });
          this.remove();
          if (callbacks.onStop) {
            callbacks.onStop();
          }
        }
      };
      self._send({
        msg: 'sub',
        id: id,
        name: name,
        params: params
      });
    }

    // return a handle to the application.
    const handle = {
      stop() {
        if (!hasOwn.call(self._subscriptions, id)) {
          return;
        }
        self._subscriptions[id].stop();
      },
      ready() {
        // return false if we've unsubscribed.
        if (!hasOwn.call(self._subscriptions, id)) {
          return false;
        }
        const record = self._subscriptions[id];
        record.readyDeps.depend();
        return record.ready;
      },
      subscriptionId: id
    };
    if (Tracker.active) {
      // We're in a reactive computation, so we'd like to unsubscribe when the
      // computation is invalidated... but not if the rerun just re-subscribes
      // to the same subscription!  When a rerun happens, we use onInvalidate
      // as a change to mark the subscription "inactive" so that it can
      // be reused from the rerun.  If it isn't reused, it's killed from
      // an afterFlush.
      Tracker.onInvalidate(c => {
        if (hasOwn.call(self._subscriptions, id)) {
          self._subscriptions[id].inactive = true;
        }
        Tracker.afterFlush(() => {
          if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
            handle.stop();
          }
        });
      });
    }
    return handle;
  }

  // options:
  // - onLateError {Function(error)} called if an error was received after the ready event.
  //     (errors received before ready cause an error to be thrown)
  _subscribeAndWait(name, args, options) {
    const self = this;
    const f = new Future();
    let ready = false;
    args = args || [];
    args.push({
      onReady() {
        ready = true;
        f['return']();
      },
      onError(e) {
        if (!ready) f['throw'](e);else options && options.onLateError && options.onLateError(e);
      }
    });
    const handle = self.subscribe.apply(self, [name].concat(args));
    f.wait();
    return handle;
  }
  methods(methods) {
    Object.entries(methods).forEach(_ref => {
      let [name, func] = _ref;
      if (typeof func !== 'function') {
        throw new Error("Method '" + name + "' must be a function");
      }
      if (this._methodHandlers[name]) {
        throw new Error("A method named '" + name + "' is already defined");
      }
      this._methodHandlers[name] = func;
    });
  }
  _getIsSimulation(_ref2) {
    let {
      isFromCallAsync,
      alreadyInSimulation
    } = _ref2;
    if (!isFromCallAsync) {
      return alreadyInSimulation;
    }
    return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
  }

  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.call
   * @summary Invokes a method with a sync stub, passing any number of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable} [arg1,arg2...] Optional method arguments
   * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
   */
  call(name /* .. [arguments] .. callback */) {
    // if it's a function, the last argument is the result callback,
    // not a parameter to the remote method.
    const args = slice.call(arguments, 1);
    let callback;
    if (args.length && typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }
    return this.apply(name, args, callback);
  }
  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.callAsync
   * @summary Invokes a method with an async stub, passing any number of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable} [arg1,arg2...] Optional method arguments
   * @returns {Promise}
   */
  callAsync(name /* .. [arguments] .. */) {
    return Promise.asyncApply(() => {
      const args = slice.call(arguments, 1);
      if (args.length && typeof args[args.length - 1] === 'function') {
        throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
      }
      /*
      * This is necessary because when you call a Promise.then, you're actually calling a bound function by Meteor.
      *
      * This is done by this code https://github.com/meteor/meteor/blob/17673c66878d3f7b1d564a4215eb0633fa679017/npm-packages/meteor-promise/promise_client.js#L1-L16. (All the logic below can be removed in the future, when we stop overwriting the
      * Promise.)
      *
      * When you call a ".then()", like "Meteor.callAsync().then()", the global context (inside currentValues)
      * will be from the call of Meteor.callAsync(), and not the context after the promise is done.
      *
      * This means that without this code if you call a stub inside the ".then()", this stub will act as a simulation
      * and won't reach the server.
      *
      * Inside the function _getIsSimulation(), if isFromCallAsync is false, we continue to consider just the
      * alreadyInSimulation, otherwise, isFromCallAsync is true, we also check the value of callAsyncMethodRunning (by
      * calling DDP._CurrentMethodInvocation._isCallAsyncMethodRunning()).
      *
      * With this, if a stub is running inside a ".then()", it'll know it's not a simulation, because callAsyncMethodRunning
      * will be false.
      *
      * DDP._CurrentMethodInvocation._set() is important because without it, if you have a code like:
      *
      * Meteor.callAsync("m1").then(() => {
      *   Meteor.callAsync("m2")
      * })
      *
      * The call the method m2 will act as a simulation and won't reach the server. That's why we reset the context here
      * before calling everything else.
      *
      * */
      DDP._CurrentMethodInvocation._set();
      DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);
      return new Promise((resolve, reject) => {
        this.applyAsync(name, args, {
          isFromCallAsync: true
        }, (err, result) => {
          DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false);
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    });
  }

  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.apply
   * @summary Invoke a method passing an array of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable[]} args Method arguments
   * @param {Object} [options]
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
   * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
   * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
   * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
   */
  apply(name, args, options, callback) {
    const _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
      {
        stubInvocation,
        invocation
      } = _this$_stubCall,
      stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
    if (stubOptions.hasStub) {
      if (!this._getIsSimulation({
        alreadyInSimulation: stubOptions.alreadyInSimulation,
        isFromCallAsync: stubOptions.isFromCallAsync
      })) {
        this._saveOriginals();
      }
      try {
        stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
      } catch (e) {
        stubOptions.exception = e;
      }
    }
    return this._apply(name, stubOptions, args, options, callback);
  }

  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.applyAsync
   * @summary Invoke a method passing an array of arguments.
   * @locus Anywhere
   * @param {String} name Name of method to invoke
   * @param {EJSONable[]} args Method arguments
   * @param {Object} [options]
   * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
   * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
   * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
   * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
   * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
   * @param {Function} [asyncCallback] Optional callback.
   */
  applyAsync(name, args, options, callback) {
    return Promise.asyncApply(() => {
      const _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options),
        {
          stubInvocation,
          invocation
        } = _this$_stubCall2,
        stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
      if (stubOptions.hasStub) {
        if (!this._getIsSimulation({
          alreadyInSimulation: stubOptions.alreadyInSimulation,
          isFromCallAsync: stubOptions.isFromCallAsync
        })) {
          this._saveOriginals();
        }
        try {
          /*
           * The code below follows the same logic as the function withValues().
           *
           * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
           * such as, the async/await.
           *
           * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
           */
          const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
          try {
            const resultOrThenable = stubInvocation();
            const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
            if (isThenable) {
              stubOptions.stubReturnValue = Promise.await(resultOrThenable);
            } else {
              stubOptions.stubReturnValue = resultOrThenable;
            }
          } finally {
            DDP._CurrentMethodInvocation._set(currentContext);
          }
        } catch (e) {
          stubOptions.exception = e;
        }
      }
      return this._apply(name, stubOptions, args, options, callback);
    });
  }
  _apply(name, stubCallValue, args, options, callback) {
    const self = this;

    // We were passed 3 arguments. They may be either (name, args, options)
    // or (name, args, callback)
    if (!callback && typeof options === 'function') {
      callback = options;
      options = Object.create(null);
    }
    options = options || Object.create(null);
    if (callback) {
      // XXX would it be better form to do the binding in stream.on,
      // or caller, instead of here?
      // XXX improve error message (and how we report it)
      callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
    }

    // Keep our args safe from mutation (eg if we don't send the message for a
    // while because of a wait method).
    args = EJSON.clone(args);
    const {
      hasStub,
      exception,
      stubReturnValue,
      alreadyInSimulation,
      randomSeed
    } = stubCallValue;

    // If we're in a simulation, stop and return the result we have,
    // rather than going on to do an RPC. If there was no stub,
    // we'll end up returning undefined.
    if (this._getIsSimulation({
      alreadyInSimulation,
      isFromCallAsync: stubCallValue.isFromCallAsync
    })) {
      if (callback) {
        callback(exception, stubReturnValue);
        return undefined;
      }
      if (exception) throw exception;
      return stubReturnValue;
    }

    // We only create the methodId here because we don't actually need one if
    // we're already in a simulation
    const methodId = '' + self._nextMethodId++;
    if (hasStub) {
      self._retrieveAndStoreOriginals(methodId);
    }

    // Generate the DDP message for the method call. Note that on the client,
    // it is important that the stub have finished before we send the RPC, so
    // that we know we have a complete list of which local documents the stub
    // wrote.
    const message = {
      msg: 'method',
      id: methodId,
      method: name,
      params: args
    };

    // If an exception occurred in a stub, and we're ignoring it
    // because we're doing an RPC and want to use what the server
    // returns instead, log it so the developer knows
    // (unless they explicitly ask to see the error).
    //
    // Tests can set the '_expectedByTest' flag on an exception so it won't
    // go to log.
    if (exception) {
      if (options.throwStubExceptions) {
        throw exception;
      } else if (!exception._expectedByTest) {
        Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
      }
    }

    // At this point we're definitely doing an RPC, and we're going to
    // return the value of the RPC to the caller.

    // If the caller didn't give a callback, decide what to do.
    let future;
    if (!callback) {
      if (Meteor.isClient) {
        // On the client, we don't have fibers, so we can't block. The
        // only thing we can do is to return undefined and discard the
        // result of the RPC. If an error occurred then print the error
        // to the console.
        callback = err => {
          err && Meteor._debug("Error invoking Method '" + name + "'", err);
        };
      } else {
        // On the server, make the function synchronous. Throw on
        // errors, return on success.
        future = new Future();
        callback = future.resolver();
      }
    }

    // Send the randomSeed only if we used it
    if (randomSeed.value !== null) {
      message.randomSeed = randomSeed.value;
    }
    const methodInvoker = new MethodInvoker({
      methodId,
      callback: callback,
      connection: self,
      onResultReceived: options.onResultReceived,
      wait: !!options.wait,
      message: message,
      noRetry: !!options.noRetry
    });
    if (options.wait) {
      // It's a wait method! Wait methods go in their own block.
      self._outstandingMethodBlocks.push({
        wait: true,
        methods: [methodInvoker]
      });
    } else {
      // Not a wait method. Start a new block if the previous block was a wait
      // block, and add it to the last block of methods.
      if (isEmpty(self._outstandingMethodBlocks) || last(self._outstandingMethodBlocks).wait) {
        self._outstandingMethodBlocks.push({
          wait: false,
          methods: []
        });
      }
      last(self._outstandingMethodBlocks).methods.push(methodInvoker);
    }

    // If we added it to the first block, send it out now.
    if (self._outstandingMethodBlocks.length === 1) methodInvoker.sendMessage();

    // If we're using the default callback on the server,
    // block waiting for the result.
    if (future) {
      return future.wait();
    }
    return options.returnStubValue ? stubReturnValue : undefined;
  }
  _stubCall(name, args, options) {
    // Run the stub, if we have one. The stub is supposed to make some
    // temporary writes to the database to give the user a smooth experience
    // until the actual result of executing the method comes back from the
    // server (whereupon the temporary writes to the database will be reversed
    // during the beginUpdate/endUpdate process.)
    //
    // Normally, we ignore the return value of the stub (even if it is an
    // exception), in favor of the real return value from the server. The
    // exception is if the *caller* is a stub. In that case, we're not going
    // to do a RPC, so we use the return value of the stub as our return
    // value.
    const self = this;
    const enclosing = DDP._CurrentMethodInvocation.get();
    const stub = self._methodHandlers[name];
    const alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
    const isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
    const randomSeed = {
      value: null
    };
    const defaultReturn = {
      alreadyInSimulation,
      randomSeed,
      isFromCallAsync
    };
    if (!stub) {
      return _objectSpread(_objectSpread({}, defaultReturn), {}, {
        hasStub: false
      });
    }

    // Lazily generate a randomSeed, only if it is requested by the stub.
    // The random streams only have utility if they're used on both the client
    // and the server; if the client doesn't generate any 'random' values
    // then we don't expect the server to generate any either.
    // Less commonly, the server may perform different actions from the client,
    // and may in fact generate values where the client did not, but we don't
    // have any client-side values to match, so even here we may as well just
    // use a random seed on the server.  In that case, we don't pass the
    // randomSeed to save bandwidth, and we don't even generate it to save a
    // bit of CPU and to avoid consuming entropy.

    const randomSeedGenerator = () => {
      if (randomSeed.value === null) {
        randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
      }
      return randomSeed.value;
    };
    const setUserId = userId => {
      self.setUserId(userId);
    };
    const invocation = new DDPCommon.MethodInvocation({
      isSimulation: true,
      userId: self.userId(),
      isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
      setUserId: setUserId,
      randomSeed() {
        return randomSeedGenerator();
      }
    });

    // Note that unlike in the corresponding server code, we never audit
    // that stubs check() their arguments.
    const stubInvocation = () => {
      if (Meteor.isServer) {
        // Because saveOriginals and retrieveOriginals aren't reentrant,
        // don't allow stubs to yield.
        return Meteor._noYieldsAllowed(() => {
          // re-clone, so that the stub can't affect our caller's values
          return stub.apply(invocation, EJSON.clone(args));
        });
      } else {
        return stub.apply(invocation, EJSON.clone(args));
      }
    };
    return _objectSpread(_objectSpread({}, defaultReturn), {}, {
      hasStub: true,
      stubInvocation,
      invocation
    });
  }

  // Before calling a method stub, prepare all stores to track changes and allow
  // _retrieveAndStoreOriginals to get the original versions of changed
  // documents.
  _saveOriginals() {
    if (!this._waitingForQuiescence()) {
      this._flushBufferedWrites();
    }
    Object.values(this._stores).forEach(store => {
      store.saveOriginals();
    });
  }

  // Retrieves the original versions of all documents modified by the stub for
  // method 'methodId' from all stores and saves them to _serverDocuments (keyed
  // by document) and _documentsWrittenByStub (keyed by method ID).
  _retrieveAndStoreOriginals(methodId) {
    const self = this;
    if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
    const docsWritten = [];
    Object.entries(self._stores).forEach(_ref3 => {
      let [collection, store] = _ref3;
      const originals = store.retrieveOriginals();
      // not all stores define retrieveOriginals
      if (!originals) return;
      originals.forEach((doc, id) => {
        docsWritten.push({
          collection,
          id
        });
        if (!hasOwn.call(self._serverDocuments, collection)) {
          self._serverDocuments[collection] = new MongoIDMap();
        }
        const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
        if (serverDoc.writtenByStubs) {
          // We're not the first stub to write this doc. Just add our method ID
          // to the record.
          serverDoc.writtenByStubs[methodId] = true;
        } else {
          // First stub! Save the original value and our method ID.
          serverDoc.document = doc;
          serverDoc.flushCallbacks = [];
          serverDoc.writtenByStubs = Object.create(null);
          serverDoc.writtenByStubs[methodId] = true;
        }
      });
    });
    if (!isEmpty(docsWritten)) {
      self._documentsWrittenByStub[methodId] = docsWritten;
    }
  }

  // This is very much a private function we use to make the tests
  // take up fewer server resources after they complete.
  _unsubscribeAll() {
    Object.values(this._subscriptions).forEach(sub => {
      // Avoid killing the autoupdate subscription so that developers
      // still get hot code pushes when writing tests.
      //
      // XXX it's a hack to encode knowledge about autoupdate here,
      // but it doesn't seem worth it yet to have a special API for
      // subscriptions to preserve after unit tests.
      if (sub.name !== 'meteor_autoupdate_clientVersions') {
        sub.stop();
      }
    });
  }

  // Sends the DDP stringification of the given message object
  _send(obj) {
    this._stream.send(DDPCommon.stringifyDDP(obj));
  }

  // We detected via DDP-level heartbeats that we've lost the
  // connection.  Unlike `disconnect` or `close`, a lost connection
  // will be automatically retried.
  _lostConnection(error) {
    this._stream._lostConnection(error);
  }

  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.status
   * @summary Get the current connection status. A reactive data source.
   * @locus Client
   */
  status() {
    return this._stream.status(...arguments);
  }

  /**
   * @summary Force an immediate reconnection attempt if the client is not connected to the server.
   This method does nothing if the client is already connected.
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.reconnect
   * @locus Client
   */
  reconnect() {
    return this._stream.reconnect(...arguments);
  }

  /**
   * @memberOf Meteor
   * @importFromPackage meteor
   * @alias Meteor.disconnect
   * @summary Disconnect the client from the server.
   * @locus Client
   */
  disconnect() {
    return this._stream.disconnect(...arguments);
  }
  close() {
    return this._stream.disconnect({
      _permanent: true
    });
  }

  ///
  /// Reactive user system
  ///
  userId() {
    if (this._userIdDeps) this._userIdDeps.depend();
    return this._userId;
  }
  setUserId(userId) {
    // Avoid invalidating dependents if setUserId is called with current value.
    if (this._userId === userId) return;
    this._userId = userId;
    if (this._userIdDeps) this._userIdDeps.changed();
  }

  // Returns true if we are in a state after reconnect of waiting for subs to be
  // revived or early methods to finish their data, or we are waiting for a
  // "wait" method to finish.
  _waitingForQuiescence() {
    return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
  }

  // Returns true if any method whose message has been sent to the server has
  // not yet invoked its user callback.
  _anyMethodsAreOutstanding() {
    const invokers = this._methodInvokers;
    return Object.values(invokers).some(invoker => !!invoker.sentMessage);
  }
  _livedata_connected(msg) {
    const self = this;
    if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
      self._heartbeat = new DDPCommon.Heartbeat({
        heartbeatInterval: self._heartbeatInterval,
        heartbeatTimeout: self._heartbeatTimeout,
        onTimeout() {
          self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
        },
        sendPing() {
          self._send({
            msg: 'ping'
          });
        }
      });
      self._heartbeat.start();
    }

    // If this is a reconnect, we'll have to reset all stores.
    if (self._lastSessionId) self._resetStores = true;
    let reconnectedToPreviousSession;
    if (typeof msg.session === 'string') {
      reconnectedToPreviousSession = self._lastSessionId === msg.session;
      self._lastSessionId = msg.session;
    }
    if (reconnectedToPreviousSession) {
      // Successful reconnection -- pick up where we left off.  Note that right
      // now, this never happens: the server never connects us to a previous
      // session, because DDP doesn't provide enough data for the server to know
      // what messages the client has processed. We need to improve DDP to make
      // this possible, at which point we'll probably need more code here.
      return;
    }

    // Server doesn't have our data any more. Re-sync a new session.

    // Forget about messages we were buffering for unknown collections. They'll
    // be resent if still relevant.
    self._updatesForUnknownStores = Object.create(null);
    if (self._resetStores) {
      // Forget about the effects of stubs. We'll be resetting all collections
      // anyway.
      self._documentsWrittenByStub = Object.create(null);
      self._serverDocuments = Object.create(null);
    }

    // Clear _afterUpdateCallbacks.
    self._afterUpdateCallbacks = [];

    // Mark all named subscriptions which are ready (ie, we already called the
    // ready callback) as needing to be revived.
    // XXX We should also block reconnect quiescence until unnamed subscriptions
    //     (eg, autopublish) are done re-publishing to avoid flicker!
    self._subsBeingRevived = Object.create(null);
    Object.entries(self._subscriptions).forEach(_ref4 => {
      let [id, sub] = _ref4;
      if (sub.ready) {
        self._subsBeingRevived[id] = true;
      }
    });

    // Arrange for "half-finished" methods to have their callbacks run, and
    // track methods that were sent on this connection so that we don't
    // quiesce until they are all done.
    //
    // Start by clearing _methodsBlockingQuiescence: methods sent before
    // reconnect don't matter, and any "wait" methods sent on the new connection
    // that we drop here will be restored by the loop below.
    self._methodsBlockingQuiescence = Object.create(null);
    if (self._resetStores) {
      const invokers = self._methodInvokers;
      keys(invokers).forEach(id => {
        const invoker = invokers[id];
        if (invoker.gotResult()) {
          // This method already got its result, but it didn't call its callback
          // because its data didn't become visible. We did not resend the
          // method RPC. We'll call its callback when we get a full quiesce,
          // since that's as close as we'll get to "data must be visible".
          self._afterUpdateCallbacks.push(function () {
            return invoker.dataVisible(...arguments);
          });
        } else if (invoker.sentMessage) {
          // This method has been sent on this connection (maybe as a resend
          // from the last connection, maybe from onReconnect, maybe just very
          // quickly before processing the connected message).
          //
          // We don't need to do anything special to ensure its callbacks get
          // called, but we'll count it as a method which is preventing
          // reconnect quiescence. (eg, it might be a login method that was run
          // from onReconnect, and we don't want to see flicker by seeing a
          // logged-out state.)
          self._methodsBlockingQuiescence[invoker.methodId] = true;
        }
      });
    }
    self._messagesBufferedUntilQuiescence = [];

    // If we're not waiting on any methods or subs, we can reset the stores and
    // call the callbacks immediately.
    if (!self._waitingForQuiescence()) {
      if (self._resetStores) {
        Object.values(self._stores).forEach(store => {
          store.beginUpdate(0, true);
          store.endUpdate();
        });
        self._resetStores = false;
      }
      self._runAfterUpdateCallbacks();
    }
  }
  _processOneDataMessage(msg, updates) {
    const messageType = msg.msg;

    // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']
    if (messageType === 'added') {
      this._process_added(msg, updates);
    } else if (messageType === 'changed') {
      this._process_changed(msg, updates);
    } else if (messageType === 'removed') {
      this._process_removed(msg, updates);
    } else if (messageType === 'ready') {
      this._process_ready(msg, updates);
    } else if (messageType === 'updated') {
      this._process_updated(msg, updates);
    } else if (messageType === 'nosub') {
      // ignore this
    } else {
      Meteor._debug('discarding unknown livedata data message type', msg);
    }
  }
  _livedata_data(msg) {
    const self = this;
    if (self._waitingForQuiescence()) {
      self._messagesBufferedUntilQuiescence.push(msg);
      if (msg.msg === 'nosub') {
        delete self._subsBeingRevived[msg.id];
      }
      if (msg.subs) {
        msg.subs.forEach(subId => {
          delete self._subsBeingRevived[subId];
        });
      }
      if (msg.methods) {
        msg.methods.forEach(methodId => {
          delete self._methodsBlockingQuiescence[methodId];
        });
      }
      if (self._waitingForQuiescence()) {
        return;
      }

      // No methods or subs are blocking quiescence!
      // We'll now process and all of our buffered messages, reset all stores,
      // and apply them all at once.

      const bufferedMessages = self._messagesBufferedUntilQuiescence;
      Object.values(bufferedMessages).forEach(bufferedMessage => {
        self._processOneDataMessage(bufferedMessage, self._bufferedWrites);
      });
      self._messagesBufferedUntilQuiescence = [];
    } else {
      self._processOneDataMessage(msg, self._bufferedWrites);
    }

    // Immediately flush writes when:
    //  1. Buffering is disabled. Or;
    //  2. any non-(added/changed/removed) message arrives.
    const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
    if (self._bufferedWritesInterval === 0 || !standardWrite) {
      self._flushBufferedWrites();
      return;
    }
    if (self._bufferedWritesFlushAt === null) {
      self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
    } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
      self._flushBufferedWrites();
      return;
    }
    if (self._bufferedWritesFlushHandle) {
      clearTimeout(self._bufferedWritesFlushHandle);
    }
    self._bufferedWritesFlushHandle = setTimeout(self.__flushBufferedWrites, self._bufferedWritesInterval);
  }
  _flushBufferedWrites() {
    const self = this;
    if (self._bufferedWritesFlushHandle) {
      clearTimeout(self._bufferedWritesFlushHandle);
      self._bufferedWritesFlushHandle = null;
    }
    self._bufferedWritesFlushAt = null;
    // We need to clear the buffer before passing it to
    //  performWrites. As there's no guarantee that it
    //  will exit cleanly.
    const writes = self._bufferedWrites;
    self._bufferedWrites = Object.create(null);
    self._performWrites(writes);
  }
  _performWrites(updates) {
    const self = this;
    if (self._resetStores || !isEmpty(updates)) {
      // Begin a transactional update of each store.

      Object.entries(self._stores).forEach(_ref5 => {
        let [storeName, store] = _ref5;
        store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
      });
      self._resetStores = false;
      Object.entries(updates).forEach(_ref6 => {
        let [storeName, updateMessages] = _ref6;
        const store = self._stores[storeName];
        if (store) {
          updateMessages.forEach(updateMessage => {
            store.update(updateMessage);
          });
        } else {
          // Nobody's listening for this data. Queue it up until
          // someone wants it.
          // XXX memory use will grow without bound if you forget to
          // create a collection or just don't care about it... going
          // to have to do something about that.
          const updates = self._updatesForUnknownStores;
          if (!hasOwn.call(updates, storeName)) {
            updates[storeName] = [];
          }
          updates[storeName].push(...updateMessages);
        }
      });

      // End update transaction.
      Object.values(self._stores).forEach(store => {
        store.endUpdate();
      });
    }
    self._runAfterUpdateCallbacks();
  }

  // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
  // relevant docs have been flushed, as well as dataVisible callbacks at
  // reconnect-quiescence time.
  _runAfterUpdateCallbacks() {
    const self = this;
    const callbacks = self._afterUpdateCallbacks;
    self._afterUpdateCallbacks = [];
    callbacks.forEach(c => {
      c();
    });
  }
  _pushUpdate(updates, collection, msg) {
    if (!hasOwn.call(updates, collection)) {
      updates[collection] = [];
    }
    updates[collection].push(msg);
  }
  _getServerDoc(collection, id) {
    const self = this;
    if (!hasOwn.call(self._serverDocuments, collection)) {
      return null;
    }
    const serverDocsForCollection = self._serverDocuments[collection];
    return serverDocsForCollection.get(id) || null;
  }
  _process_added(msg, updates) {
    const self = this;
    const id = MongoID.idParse(msg.id);
    const serverDoc = self._getServerDoc(msg.collection, id);
    if (serverDoc) {
      // Some outstanding stub wrote here.
      const isExisting = serverDoc.document !== undefined;
      serverDoc.document = msg.fields || Object.create(null);
      serverDoc.document._id = id;
      if (self._resetStores) {
        // During reconnect the server is sending adds for existing ids.
        // Always push an update so that document stays in the store after
        // reset. Use current version of the document for this update, so
        // that stub-written values are preserved.
        const currentDoc = self._stores[msg.collection].getDoc(msg.id);
        if (currentDoc !== undefined) msg.fields = currentDoc;
        self._pushUpdate(updates, msg.collection, msg);
      } else if (isExisting) {
        throw new Error('Server sent add for existing id: ' + msg.id);
      }
    } else {
      self._pushUpdate(updates, msg.collection, msg);
    }
  }
  _process_changed(msg, updates) {
    const self = this;
    const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
    if (serverDoc) {
      if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
      DiffSequence.applyChanges(serverDoc.document, msg.fields);
    } else {
      self._pushUpdate(updates, msg.collection, msg);
    }
  }
  _process_removed(msg, updates) {
    const self = this;
    const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
    if (serverDoc) {
      // Some outstanding stub wrote here.
      if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
      serverDoc.document = undefined;
    } else {
      self._pushUpdate(updates, msg.collection, {
        msg: 'removed',
        collection: msg.collection,
        id: msg.id
      });
    }
  }
  _process_updated(msg, updates) {
    const self = this;
    // Process "method done" messages.

    msg.methods.forEach(methodId => {
      const docs = self._documentsWrittenByStub[methodId] || {};
      Object.values(docs).forEach(written => {
        const serverDoc = self._getServerDoc(written.collection, written.id);
        if (!serverDoc) {
          throw new Error('Lost serverDoc for ' + JSON.stringify(written));
        }
        if (!serverDoc.writtenByStubs[methodId]) {
          throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
        }
        delete serverDoc.writtenByStubs[methodId];
        if (isEmpty(serverDoc.writtenByStubs)) {
          // All methods whose stubs wrote this method have completed! We can
          // now copy the saved document to the database (reverting the stub's
          // change if the server did not write to this object, or applying the
          // server's writes if it did).

          // This is a fake ddp 'replace' message.  It's just for talking
          // between livedata connections and minimongo.  (We have to stringify
          // the ID because it's supposed to look like a wire message.)
          self._pushUpdate(updates, written.collection, {
            msg: 'replace',
            id: MongoID.idStringify(written.id),
            replace: serverDoc.document
          });
          // Call all flush callbacks.

          serverDoc.flushCallbacks.forEach(c => {
            c();
          });

          // Delete this completed serverDocument. Don't bother to GC empty
          // IdMaps inside self._serverDocuments, since there probably aren't
          // many collections and they'll be written repeatedly.
          self._serverDocuments[written.collection].remove(written.id);
        }
      });
      delete self._documentsWrittenByStub[methodId];

      // We want to call the data-written callback, but we can't do so until all
      // currently buffered messages are flushed.
      const callbackInvoker = self._methodInvokers[methodId];
      if (!callbackInvoker) {
        throw new Error('No callback invoker for method ' + methodId);
      }
      self._runWhenAllServerDocsAreFlushed(function () {
        return callbackInvoker.dataVisible(...arguments);
      });
    });
  }
  _process_ready(msg, updates) {
    const self = this;
    // Process "sub ready" messages. "sub ready" messages don't take effect
    // until all current server documents have been flushed to the local
    // database. We can use a write fence to implement this.

    msg.subs.forEach(subId => {
      self._runWhenAllServerDocsAreFlushed(() => {
        const subRecord = self._subscriptions[subId];
        // Did we already unsubscribe?
        if (!subRecord) return;
        // Did we already receive a ready message? (Oops!)
        if (subRecord.ready) return;
        subRecord.ready = true;
        subRecord.readyCallback && subRecord.readyCallback();
        subRecord.readyDeps.changed();
      });
    });
  }

  // Ensures that "f" will be called after all documents currently in
  // _serverDocuments have been written to the local cache. f will not be called
  // if the connection is lost before then!
  _runWhenAllServerDocsAreFlushed(f) {
    const self = this;
    const runFAfterUpdates = () => {
      self._afterUpdateCallbacks.push(f);
    };
    let unflushedServerDocCount = 0;
    const onServerDocFlush = () => {
      --unflushedServerDocCount;
      if (unflushedServerDocCount === 0) {
        // This was the last doc to flush! Arrange to run f after the updates
        // have been applied.
        runFAfterUpdates();
      }
    };
    Object.values(self._serverDocuments).forEach(serverDocuments => {
      serverDocuments.forEach(serverDoc => {
        const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
          const invoker = self._methodInvokers[methodId];
          return invoker && invoker.sentMessage;
        });
        if (writtenByStubForAMethodWithSentMessage) {
          ++unflushedServerDocCount;
          serverDoc.flushCallbacks.push(onServerDocFlush);
        }
      });
    });
    if (unflushedServerDocCount === 0) {
      // There aren't any buffered docs --- we can call f as soon as the current
      // round of updates is applied!
      runFAfterUpdates();
    }
  }
  _livedata_nosub(msg) {
    const self = this;

    // First pass it through _livedata_data, which only uses it to help get
    // towards quiescence.
    self._livedata_data(msg);

    // Do the rest of our processing immediately, with no
    // buffering-until-quiescence.

    // we weren't subbed anyway, or we initiated the unsub.
    if (!hasOwn.call(self._subscriptions, msg.id)) {
      return;
    }

    // XXX COMPAT WITH 1.0.3.1 #errorCallback
    const errorCallback = self._subscriptions[msg.id].errorCallback;
    const stopCallback = self._subscriptions[msg.id].stopCallback;
    self._subscriptions[msg.id].remove();
    const meteorErrorFromMsg = msgArg => {
      return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
    };

    // XXX COMPAT WITH 1.0.3.1 #errorCallback
    if (errorCallback && msg.error) {
      errorCallback(meteorErrorFromMsg(msg));
    }
    if (stopCallback) {
      stopCallback(meteorErrorFromMsg(msg));
    }
  }
  _livedata_result(msg) {
    // id, result or error. error has error (code), reason, details

    const self = this;

    // Lets make sure there are no buffered writes before returning result.
    if (!isEmpty(self._bufferedWrites)) {
      self._flushBufferedWrites();
    }

    // find the outstanding request
    // should be O(1) in nearly all realistic use cases
    if (isEmpty(self._outstandingMethodBlocks)) {
      Meteor._debug('Received method result but no methods outstanding');
      return;
    }
    const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
    let i;
    const m = currentMethodBlock.find((method, idx) => {
      const found = method.methodId === msg.id;
      if (found) i = idx;
      return found;
    });
    if (!m) {
      Meteor._debug("Can't match method response to original method call", msg);
      return;
    }

    // Remove from current method block. This may leave the block empty, but we
    // don't move on to the next block until the callback has been delivered, in
    // _outstandingMethodFinished.
    currentMethodBlock.splice(i, 1);
    if (hasOwn.call(msg, 'error')) {
      m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
    } else {
      // msg.result may be undefined if the method didn't return a
      // value
      m.receiveResult(undefined, msg.result);
    }
  }

  // Called by MethodInvoker after a method's callback is invoked.  If this was
  // the last outstanding method in the current block, runs the next block. If
  // there are no more methods, consider accepting a hot code push.
  _outstandingMethodFinished() {
    const self = this;
    if (self._anyMethodsAreOutstanding()) return;

    // No methods are outstanding. This should mean that the first block of
    // methods is empty. (Or it might not exist, if this was a method that
    // half-finished before disconnect/reconnect.)
    if (!isEmpty(self._outstandingMethodBlocks)) {
      const firstBlock = self._outstandingMethodBlocks.shift();
      if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

      // Send the outstanding methods now in the first block.
      if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
    }

    // Maybe accept a hot code push.
    self._maybeMigrate();
  }

  // Sends messages for all the methods in the first block in
  // _outstandingMethodBlocks.
  _sendOutstandingMethods() {
    const self = this;
    if (isEmpty(self._outstandingMethodBlocks)) {
      return;
    }
    self._outstandingMethodBlocks[0].methods.forEach(m => {
      m.sendMessage();
    });
  }
  _livedata_error(msg) {
    Meteor._debug('Received error from server: ', msg.reason);
    if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
  }
  _callOnReconnectAndSendAppropriateOutstandingMethods() {
    const self = this;
    const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
    self._outstandingMethodBlocks = [];
    self.onReconnect && self.onReconnect();
    DDP._reconnectHook.each(callback => {
      callback(self);
      return true;
    });
    if (isEmpty(oldOutstandingMethodBlocks)) return;

    // We have at least one block worth of old outstanding methods to try
    // again. First: did onReconnect actually send anything? If not, we just
    // restore all outstanding methods and run the first block.
    if (isEmpty(self._outstandingMethodBlocks)) {
      self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
      self._sendOutstandingMethods();
      return;
    }

    // OK, there are blocks on both sides. Special case: merge the last block of
    // the reconnect methods with the first block of the original methods, if
    // neither of them are "wait" blocks.
    if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
      oldOutstandingMethodBlocks[0].methods.forEach(m => {
        last(self._outstandingMethodBlocks).methods.push(m);

        // If this "last block" is also the first block, send the message.
        if (self._outstandingMethodBlocks.length === 1) {
          m.sendMessage();
        }
      });
      oldOutstandingMethodBlocks.shift();
    }

    // Now add the rest of the original blocks on.
    self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
  }

  // We can accept a hot code push if there are no methods in flight.
  _readyToMigrate() {
    return isEmpty(this._methodInvokers);
  }

  // If we were blocking a migration, see if it's now possible to continue.
  // Call whenever the set of outstanding/blocked methods shrinks.
  _maybeMigrate() {
    const self = this;
    if (self._retryMigrate && self._readyToMigrate()) {
      self._retryMigrate();
      self._retryMigrate = null;
    }
  }
  onMessage(raw_msg) {
    let msg;
    try {
      msg = DDPCommon.parseDDP(raw_msg);
    } catch (e) {
      Meteor._debug('Exception while parsing DDP', e);
      return;
    }

    // Any message counts as receiving a pong, as it demonstrates that
    // the server is still alive.
    if (this._heartbeat) {
      this._heartbeat.messageReceived();
    }
    if (msg === null || !msg.msg) {
      if (!msg || !msg.testMessageOnConnect) {
        if (Object.keys(msg).length === 1 && msg.server_id) return;
        Meteor._debug('discarding invalid livedata message', msg);
      }
      return;
    }
    if (msg.msg === 'connected') {
      this._version = this._versionSuggestion;
      this._livedata_connected(msg);
      this.options.onConnected();
    } else if (msg.msg === 'failed') {
      if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
        this._versionSuggestion = msg.version;
        this._stream.reconnect({
          _force: true
        });
      } else {
        const description = 'DDP version negotiation failed; server requested version ' + msg.version;
        this._stream.disconnect({
          _permanent: true,
          _error: description
        });
        this.options.onDDPVersionNegotiationFailure(description);
      }
    } else if (msg.msg === 'ping' && this.options.respondToPings) {
      this._send({
        msg: 'pong',
        id: msg.id
      });
    } else if (msg.msg === 'pong') {
      // noop, as we assume everything's a pong
    } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
      this._livedata_data(msg);
    } else if (msg.msg === 'nosub') {
      this._livedata_nosub(msg);
    } else if (msg.msg === 'result') {
      this._livedata_result(msg);
    } else if (msg.msg === 'error') {
      this._livedata_error(msg);
    } else {
      Meteor._debug('discarding unknown livedata message type', msg);
    }
  }
  onReset() {
    // Send a connect message at the beginning of the stream.
    // NOTE: reset is called even on the first connection, so this is
    // the only place we send this message.
    const msg = {
      msg: 'connect'
    };
    if (this._lastSessionId) msg.session = this._lastSessionId;
    msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
    this._versionSuggestion = msg.version;
    msg.support = this._supportedDDPVersions;
    this._send(msg);

    // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
    // current block is pretty important to making sure that quiescence is properly calculated, as
    // well as possibly moving on to another useful block.

    // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
    // we are connecting for the first time.
    if (this._outstandingMethodBlocks.length > 0) {
      // If there is an outstanding method block, we only care about the first one as that is the
      // one that could have already sent messages with no response, that are not allowed to retry.
      const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
      this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
        // Methods with 'noRetry' option set are not allowed to re-send after
        // recovering dropped connection.
        if (methodInvoker.sentMessage && methodInvoker.noRetry) {
          // Make sure that the method is told that it failed.
          methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
        }

        // Only keep a method if it wasn't sent or it's allowed to retry.
        // This may leave the block empty, but we don't move on to the next
        // block until the callback has been delivered, in _outstandingMethodFinished.
        return !(methodInvoker.sentMessage && methodInvoker.noRetry);
      });
    }

    // Now, to minimize setup latency, go ahead and blast out all of
    // our pending methods ands subscriptions before we've even taken
    // the necessary RTT to know if we successfully reconnected. (1)
    // They're supposed to be idempotent, and where they are not,
    // they can block retry in apply; (2) even if we did reconnect,
    // we're not sure what messages might have gotten lost
    // (in either direction) since we were disconnected (TCP being
    // sloppy about that.)

    // If the current block of methods all got their results (but didn't all get
    // their data visible), discard the empty block now.
    if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
      this._outstandingMethodBlocks.shift();
    }

    // Mark all messages as unsent, they have not yet been sent on this
    // connection.
    keys(this._methodInvokers).forEach(id => {
      this._methodInvokers[id].sentMessage = false;
    });

    // If an `onReconnect` handler is set, call it first. Go through
    // some hoops to ensure that methods that are called from within
    // `onReconnect` get executed _before_ ones that were originally
    // outstanding (since `onReconnect` is used to re-establish auth
    // certificates)
    this._callOnReconnectAndSendAppropriateOutstandingMethods();

    // add new subscriptions at the end. this way they take effect after
    // the handlers and we don't see flicker.
    Object.entries(this._subscriptions).forEach(_ref7 => {
      let [id, sub] = _ref7;
      this._send({
        msg: 'sub',
        id: id,
        name: sub.name,
        params: sub.params
      });
    });
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-client/common/namespace.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DDP: () => DDP
});
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }
}, 0);
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }
}, 1);
let Connection;
module.link("./livedata_connection.js", {
  Connection(v) {
    Connection = v;
  }
}, 2);
// This array allows the `_allSubscriptionsReady` method below, which
// is used by the `spiderable` package, to keep track of whether all
// data is ready.
const allConnections = [];

/**
 * @namespace DDP
 * @summary Namespace for DDP-related methods/classes.
 */
const DDP = {};
// This is private but it's used in a few places. accounts-base uses
// it to get the current user. Meteor.setTimeout and friends clear
// it. We can probably find a better way to factor this.
DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

// XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
DDP._CurrentInvocation = DDP._CurrentMethodInvocation;

// This is passed into a weird `makeErrorType` function that expects its thing
// to be a constructor
function connectionErrorConstructor(message) {
  this.message = message;
}
DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {});

// Returns the named sequence of pseudo-random values.
// The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
// consistent values for method calls on the client and server.
DDP.randomStream = name => {
  const scope = DDP._CurrentMethodInvocation.get();
  return DDPCommon.RandomStream.get(scope, name);
};

// @param url {String} URL to Meteor app,
//     e.g.:
//     "subdomain.meteor.com",
//     "http://subdomain.meteor.com",
//     "/",
//     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

/**
 * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
 * @locus Anywhere
 * @param {String} url The URL of another Meteor application.
 * @param {Object} [options]
 * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
 * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
 * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
 * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
 */
DDP.connect = (url, options) => {
  const ret = new Connection(url, options);
  allConnections.push(ret); // hack. see below.
  return ret;
};
DDP._reconnectHook = new Hook({
  bindEnvironment: false
});

/**
 * @summary Register a function to call as the first step of
 * reconnecting. This function can call methods which will be executed before
 * any other outstanding methods. For example, this can be used to re-establish
 * the appropriate authentication context on the connection.
 * @locus Anywhere
 * @param {Function} callback The function to call. It will be called with a
 * single argument, the [connection object](#ddp_connect) that is reconnecting.
 */
DDP.onReconnect = callback => DDP._reconnectHook.register(callback);

// Hack for `spiderable` package: a way to see if the page is done
// loading all the data it needs.
//
DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/ddp-client/server/server.js");

/* Exports */
Package._define("ddp-client", exports, {
  DDP: DDP
});

})();

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsImV4cG9ydCIsImRlZmF1bHQiLCJNZXRob2RJbnZva2VyIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwibWV0aG9kSWQiLCJzZW50TWVzc2FnZSIsIl9jYWxsYmFjayIsImNhbGxiYWNrIiwiX2Nvbm5lY3Rpb24iLCJjb25uZWN0aW9uIiwiX21lc3NhZ2UiLCJtZXNzYWdlIiwiX29uUmVzdWx0UmVjZWl2ZWQiLCJvblJlc3VsdFJlY2VpdmVkIiwiX3dhaXQiLCJ3YWl0Iiwibm9SZXRyeSIsIl9tZXRob2RSZXN1bHQiLCJfZGF0YVZpc2libGUiLCJfbWV0aG9kSW52b2tlcnMiLCJzZW5kTWVzc2FnZSIsImdvdFJlc3VsdCIsIkVycm9yIiwiX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UiLCJfc2VuZCIsIl9tYXliZUludm9rZUNhbGxiYWNrIiwiX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQiLCJyZWNlaXZlUmVzdWx0IiwiZXJyIiwicmVzdWx0IiwiZGF0YVZpc2libGUiLCJfb2JqZWN0V2l0aG91dFByb3BlcnRpZXMiLCJ2IiwiX29iamVjdFNwcmVhZCIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiRmliZXIiLCJGdXR1cmUiLCJpc1NlcnZlciIsIk5wbSIsInJlcXVpcmUiLCJNb25nb0lETWFwIiwiSWRNYXAiLCJpZFN0cmluZ2lmeSIsImlkUGFyc2UiLCJ1cmwiLCJzZWxmIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsIkNvbm5lY3Rpb25FcnJvciIsImhlYWRlcnMiLCJfc29ja2pzT3B0aW9ucyIsIl9kb250UHJpbnRFcnJvcnMiLCJjb25uZWN0VGltZW91dE1zIiwiX2xhc3RTZXNzaW9uSWQiLCJfdmVyc2lvblN1Z2dlc3Rpb24iLCJfdmVyc2lvbiIsIl9zdG9yZXMiLCJfbWV0aG9kSGFuZGxlcnMiLCJfbmV4dE1ldGhvZElkIiwiX3N1cHBvcnRlZEREUFZlcnNpb25zIiwiX2hlYXJ0YmVhdEludGVydmFsIiwiX2hlYXJ0YmVhdFRpbWVvdXQiLCJfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiIsIl9zZXJ2ZXJEb2N1bWVudHMiLCJfYWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSIsIl9zdWJzQmVpbmdSZXZpdmVkIiwiX3Jlc2V0U3RvcmVzIiwiX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzIiwiX3JldHJ5TWlncmF0ZSIsIl9fZmx1c2hCdWZmZXJlZFdyaXRlcyIsImJpbmRFbnZpcm9ubWVudCIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlIiwiX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJfYnVmZmVyZWRXcml0ZXNNYXhBZ2UiLCJfc3Vic2NyaXB0aW9ucyIsIl91c2VySWQiLCJfdXNlcklkRGVwcyIsIkRlcGVuZGVuY3kiLCJpc0NsaWVudCIsIlBhY2thZ2UiLCJyZWxvYWQiLCJSZWxvYWQiLCJfb25NaWdyYXRlIiwiX3JlYWR5VG9NaWdyYXRlIiwib25EaXNjb25uZWN0IiwiX2hlYXJ0YmVhdCIsInN0b3AiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwicmVnaXN0ZXJTdG9yZSIsIm5hbWUiLCJ3cmFwcGVkU3RvcmUiLCJzdG9yZSIsImtleXNPZlN0b3JlIiwiZm9yRWFjaCIsIm1ldGhvZCIsInF1ZXVlZCIsIkFycmF5IiwiaXNBcnJheSIsImJlZ2luVXBkYXRlIiwibGVuZ3RoIiwibXNnIiwidXBkYXRlIiwiZW5kVXBkYXRlIiwic3Vic2NyaWJlIiwicGFyYW1zIiwiY2FsbCIsImFyZ3VtZW50cyIsImNhbGxiYWNrcyIsImxhc3RQYXJhbSIsIm9uUmVhZHkiLCJwb3AiLCJvbkVycm9yIiwib25TdG9wIiwic29tZSIsImYiLCJleGlzdGluZyIsInZhbHVlcyIsImZpbmQiLCJzdWIiLCJpbmFjdGl2ZSIsImVxdWFscyIsImlkIiwicmVhZHkiLCJyZWFkeUNhbGxiYWNrIiwiZXJyb3JDYWxsYmFjayIsInN0b3BDYWxsYmFjayIsImNsb25lIiwicmVhZHlEZXBzIiwicmVtb3ZlIiwiY2hhbmdlZCIsImhhbmRsZSIsInJlY29yZCIsImRlcGVuZCIsInN1YnNjcmlwdGlvbklkIiwiYWN0aXZlIiwib25JbnZhbGlkYXRlIiwiYyIsImFmdGVyRmx1c2giLCJfc3Vic2NyaWJlQW5kV2FpdCIsImFyZ3MiLCJwdXNoIiwiZSIsIm9uTGF0ZUVycm9yIiwiYXBwbHkiLCJjb25jYXQiLCJtZXRob2RzIiwiZW50cmllcyIsImZ1bmMiLCJfZ2V0SXNTaW11bGF0aW9uIiwiaXNGcm9tQ2FsbEFzeW5jIiwiYWxyZWFkeUluU2ltdWxhdGlvbiIsIl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsIl9pc0NhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJjYWxsQXN5bmMiLCJfc2V0IiwiX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImFwcGx5QXN5bmMiLCJfc3R1YkNhbGwiLCJzdHViSW52b2NhdGlvbiIsImludm9jYXRpb24iLCJzdHViT3B0aW9ucyIsImhhc1N0dWIiLCJfc2F2ZU9yaWdpbmFscyIsInN0dWJSZXR1cm5WYWx1ZSIsIndpdGhWYWx1ZSIsImV4Y2VwdGlvbiIsIl9hcHBseSIsImN1cnJlbnRDb250ZXh0IiwiX3NldE5ld0NvbnRleHRBbmRHZXRDdXJyZW50IiwicmVzdWx0T3JUaGVuYWJsZSIsImlzVGhlbmFibGUiLCJ0aGVuIiwic3R1YkNhbGxWYWx1ZSIsInJhbmRvbVNlZWQiLCJ1bmRlZmluZWQiLCJfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyIsInRocm93U3R1YkV4Y2VwdGlvbnMiLCJfZXhwZWN0ZWRCeVRlc3QiLCJmdXR1cmUiLCJyZXNvbHZlciIsInZhbHVlIiwibWV0aG9kSW52b2tlciIsInJldHVyblN0dWJWYWx1ZSIsImVuY2xvc2luZyIsImdldCIsInN0dWIiLCJpc1NpbXVsYXRpb24iLCJfaXNGcm9tQ2FsbEFzeW5jIiwiZGVmYXVsdFJldHVybiIsInJhbmRvbVNlZWRHZW5lcmF0b3IiLCJtYWtlUnBjU2VlZCIsInNldFVzZXJJZCIsInVzZXJJZCIsIk1ldGhvZEludm9jYXRpb24iLCJfbm9ZaWVsZHNBbGxvd2VkIiwiX3dhaXRpbmdGb3JRdWllc2NlbmNlIiwic2F2ZU9yaWdpbmFscyIsImRvY3NXcml0dGVuIiwiY29sbGVjdGlvbiIsIm9yaWdpbmFscyIsInJldHJpZXZlT3JpZ2luYWxzIiwiZG9jIiwic2VydmVyRG9jIiwic2V0RGVmYXVsdCIsIndyaXR0ZW5CeVN0dWJzIiwiZG9jdW1lbnQiLCJmbHVzaENhbGxiYWNrcyIsIl91bnN1YnNjcmliZUFsbCIsIm9iaiIsInNlbmQiLCJzdHJpbmdpZnlERFAiLCJfbG9zdENvbm5lY3Rpb24iLCJlcnJvciIsInN0YXR1cyIsInJlY29ubmVjdCIsImRpc2Nvbm5lY3QiLCJjbG9zZSIsIl9wZXJtYW5lbnQiLCJfYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nIiwiaW52b2tlcnMiLCJpbnZva2VyIiwiX2xpdmVkYXRhX2Nvbm5lY3RlZCIsIkhlYXJ0YmVhdCIsIm9uVGltZW91dCIsInNlbmRQaW5nIiwic3RhcnQiLCJyZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uIiwic2Vzc2lvbiIsIl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcyIsIl9wcm9jZXNzT25lRGF0YU1lc3NhZ2UiLCJ1cGRhdGVzIiwibWVzc2FnZVR5cGUiLCJfcHJvY2Vzc19hZGRlZCIsIl9wcm9jZXNzX2NoYW5nZWQiLCJfcHJvY2Vzc19yZW1vdmVkIiwiX3Byb2Nlc3NfcmVhZHkiLCJfcHJvY2Vzc191cGRhdGVkIiwiX2xpdmVkYXRhX2RhdGEiLCJzdWJzIiwic3ViSWQiLCJidWZmZXJlZE1lc3NhZ2VzIiwiYnVmZmVyZWRNZXNzYWdlIiwic3RhbmRhcmRXcml0ZSIsIkRhdGUiLCJ2YWx1ZU9mIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsIndyaXRlcyIsIl9wZXJmb3JtV3JpdGVzIiwic3RvcmVOYW1lIiwidXBkYXRlTWVzc2FnZXMiLCJ1cGRhdGVNZXNzYWdlIiwiX3B1c2hVcGRhdGUiLCJfZ2V0U2VydmVyRG9jIiwic2VydmVyRG9jc0ZvckNvbGxlY3Rpb24iLCJpc0V4aXN0aW5nIiwiZmllbGRzIiwiX2lkIiwiY3VycmVudERvYyIsImdldERvYyIsIkRpZmZTZXF1ZW5jZSIsImFwcGx5Q2hhbmdlcyIsImRvY3MiLCJ3cml0dGVuIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlcGxhY2UiLCJjYWxsYmFja0ludm9rZXIiLCJfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIiwic3ViUmVjb3JkIiwicnVuRkFmdGVyVXBkYXRlcyIsInVuZmx1c2hlZFNlcnZlckRvY0NvdW50Iiwib25TZXJ2ZXJEb2NGbHVzaCIsInNlcnZlckRvY3VtZW50cyIsIndyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlIiwiX2xpdmVkYXRhX25vc3ViIiwibWV0ZW9yRXJyb3JGcm9tTXNnIiwibXNnQXJnIiwicmVhc29uIiwiZGV0YWlscyIsIl9saXZlZGF0YV9yZXN1bHQiLCJjdXJyZW50TWV0aG9kQmxvY2siLCJpIiwibSIsImlkeCIsImZvdW5kIiwic3BsaWNlIiwiZmlyc3RCbG9jayIsInNoaWZ0IiwiX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMiLCJfbWF5YmVNaWdyYXRlIiwiX2xpdmVkYXRhX2Vycm9yIiwib2ZmZW5kaW5nTWVzc2FnZSIsIl9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMiLCJvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcyIsIl9yZWNvbm5lY3RIb29rIiwiZWFjaCIsInJhd19tc2ciLCJwYXJzZUREUCIsIm1lc3NhZ2VSZWNlaXZlZCIsInRlc3RNZXNzYWdlT25Db25uZWN0Iiwic2VydmVyX2lkIiwiaW5kZXhPZiIsInZlcnNpb24iLCJfZm9yY2UiLCJfZXJyb3IiLCJpbmNsdWRlcyIsInN1cHBvcnQiLCJmaWx0ZXIiLCJhbGxDb25uZWN0aW9ucyIsIkVudmlyb25tZW50VmFyaWFibGUiLCJfQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsIl9DdXJyZW50SW52b2NhdGlvbiIsImNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yIiwibWFrZUVycm9yVHlwZSIsIkZvcmNlZFJlY29ubmVjdEVycm9yIiwicmFuZG9tU3RyZWFtIiwic2NvcGUiLCJSYW5kb21TdHJlYW0iLCJjb25uZWN0IiwicmV0IiwicmVnaXN0ZXIiLCJfYWxsU3Vic2NyaXB0aW9uc1JlYWR5IiwiZXZlcnkiLCJjb25uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxJQUFJLENBQUMsd0JBQXdCLEVBQUM7RUFBQ0MsR0FBRyxFQUFDO0FBQUssQ0FBQyxFQUFDLENBQUMsQ0FBQyxDOzs7Ozs7Ozs7OztBQ0FuREYsTUFBTSxDQUFDRyxNQUFNLENBQUM7RUFBQ0MsT0FBTyxFQUFDLE1BQUlDO0FBQWEsQ0FBQyxDQUFDO0FBSzNCLE1BQU1BLGFBQWEsQ0FBQztFQUNqQ0MsV0FBVyxDQUFDQyxPQUFPLEVBQUU7SUFDbkI7SUFDQSxJQUFJLENBQUNDLFFBQVEsR0FBR0QsT0FBTyxDQUFDQyxRQUFRO0lBQ2hDLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEtBQUs7SUFFeEIsSUFBSSxDQUFDQyxTQUFTLEdBQUdILE9BQU8sQ0FBQ0ksUUFBUTtJQUNqQyxJQUFJLENBQUNDLFdBQVcsR0FBR0wsT0FBTyxDQUFDTSxVQUFVO0lBQ3JDLElBQUksQ0FBQ0MsUUFBUSxHQUFHUCxPQUFPLENBQUNRLE9BQU87SUFDL0IsSUFBSSxDQUFDQyxpQkFBaUIsR0FBR1QsT0FBTyxDQUFDVSxnQkFBZ0IsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQy9ELElBQUksQ0FBQ0MsS0FBSyxHQUFHWCxPQUFPLENBQUNZLElBQUk7SUFDekIsSUFBSSxDQUFDQyxPQUFPLEdBQUdiLE9BQU8sQ0FBQ2EsT0FBTztJQUM5QixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJO0lBQ3pCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEtBQUs7O0lBRXpCO0lBQ0EsSUFBSSxDQUFDVixXQUFXLENBQUNXLGVBQWUsQ0FBQyxJQUFJLENBQUNmLFFBQVEsQ0FBQyxHQUFHLElBQUk7RUFDeEQ7RUFDQTtFQUNBO0VBQ0FnQixXQUFXLEdBQUc7SUFDWjtJQUNBO0lBQ0E7SUFDQSxJQUFJ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RyxFQUFFckQsT0FBTyxDQUFDO0VBQ3hDMFYsY0FBYyxDQUFDNUssSUFBSSxDQUFDdUwsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUMxQixPQUFPQSxHQUFHO0FBQ1osQ0FBQztBQUVEMVcsR0FBRyxDQUFDaVYsY0FBYyxHQUFHLElBQUl2UyxJQUFJLENBQUM7RUFBRTZELGVBQWUsRUFBRTtBQUFNLENBQUMsQ0FBQzs7QUFFekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0F2RyxHQUFHLENBQUM0RSxXQUFXLEdBQUduRSxRQUFRLElBQUlULEdBQUcsQ0FBQ2lWLGNBQWMsQ0FBQzBCLFFBQVEsQ0FBQ2xXLFFBQVEsQ0FBQzs7QUFFbkU7QUFDQTtBQUNBO0FBQ0FULEdBQUcsQ0FBQzRXLHNCQUFzQixHQUFHLE1BQU1iLGNBQWMsQ0FBQ2MsS0FBSyxDQUNyREMsSUFBSSxJQUFJM1MsTUFBTSxDQUFDd0YsTUFBTSxDQUFDbU4sSUFBSSxDQUFDaFEsY0FBYyxDQUFDLENBQUMrUCxLQUFLLENBQUNoTixHQUFHLElBQUlBLEdBQUcsQ0FBQ0ksS0FBSyxDQUFDLENBQ25FLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1jbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgeyBERFAgfSBmcm9tICcuLi9jb21tb24vbmFtZXNwYWNlLmpzJztcbiIsIi8vIEEgTWV0aG9kSW52b2tlciBtYW5hZ2VzIHNlbmRpbmcgYSBtZXRob2QgdG8gdGhlIHNlcnZlciBhbmQgY2FsbGluZyB0aGUgdXNlcidzXG4vLyBjYWxsYmFja3MuIE9uIGNvbnN0cnVjdGlvbiwgaXQgcmVnaXN0ZXJzIGl0c2VsZiBpbiB0aGUgY29ubmVjdGlvbidzXG4vLyBfbWV0aG9kSW52b2tlcnMgbWFwOyBpdCByZW1vdmVzIGl0c2VsZiBvbmNlIHRoZSBtZXRob2QgaXMgZnVsbHkgZmluaXNoZWQgYW5kXG4vLyB0aGUgY2FsbGJhY2sgaXMgaW52b2tlZC4gVGhpcyBvY2N1cnMgd2hlbiBpdCBoYXMgYm90aCByZWNlaXZlZCBhIHJlc3VsdCxcbi8vIGFuZCB0aGUgZGF0YSB3cml0dGVuIGJ5IGl0IGlzIGZ1bGx5IHZpc2libGUuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXRob2RJbnZva2VyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIC8vIFB1YmxpYyAod2l0aGluIHRoaXMgZmlsZSkgZmllbGRzLlxuICAgIHRoaXMubWV0aG9kSWQgPSBvcHRpb25zLm1ldGhvZElkO1xuICAgIHRoaXMuc2VudE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIHRoaXMuX2NhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcbiAgICB0aGlzLl9jb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICAgIHRoaXMuX21lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2U7XG4gICAgdGhpcy5fb25SZXN1bHRSZWNlaXZlZCA9IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCB8fCAoKCkgPT4ge30pO1xuICAgIHRoaXMuX3dhaXQgPSBvcHRpb25zLndhaXQ7XG4gICAgdGhpcy5ub1JldHJ5ID0gb3B0aW9ucy5ub1JldHJ5O1xuICAgIHRoaXMuX21ldGhvZFJlc3VsdCA9IG51bGw7XG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSBmYWxzZTtcblxuICAgIC8vIFJlZ2lzdGVyIHdpdGggdGhlIGNvbm5lY3Rpb24uXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kSW52b2tlcnNbdGhpcy5tZXRob2RJZF0gPSB0aGlzO1xuICB9XG4gIC8vIFNlbmRzIHRoZSBtZXRob2QgbWVzc2FnZSB0byB0aGUgc2VydmVyLiBNYXkgYmUgY2FsbGVkIGFkZGl0aW9uYWwgdGltZXMgaWZcbiAgLy8gd2UgbG9zZSB0aGUgY29ubmVjdGlvbiBhbmQgcmVjb25uZWN0IGJlZm9yZSByZWNlaXZpbmcgYSByZXN1bHQuXG4gIHNlbmRNZXNzYWdlKCkge1xuICAgIC8vIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGJlZm9yZSBzZW5kaW5nIGEgbWV0aG9kIChpbmNsdWRpbmcgcmVzZW5kaW5nIG9uXG4gICAgLy8gcmVjb25uZWN0KS4gV2Ugc2hvdWxkIG9ubHkgKHJlKXNlbmQgbWV0aG9kcyB3aGVyZSB3ZSBkb24ndCBhbHJlYWR5IGhhdmUgYVxuICAgIC8vIHJlc3VsdCFcbiAgICBpZiAodGhpcy5nb3RSZXN1bHQoKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignc2VuZGluZ01ldGhvZCBpcyBjYWxsZWQgb24gbWV0aG9kIHdpdGggcmVzdWx0Jyk7XG5cbiAgICAvLyBJZiB3ZSdyZSByZS1zZW5kaW5nIGl0LCBpdCBkb2Vzbid0IG1hdHRlciBpZiBkYXRhIHdhcyB3cml0dGVuIHRoZSBmaXJzdFxuICAgIC8vIHRpbWUuXG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSBmYWxzZTtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoaXMgaXMgYSB3YWl0IG1ldGhvZCwgbWFrZSBhbGwgZGF0YSBtZXNzYWdlcyBiZSBidWZmZXJlZCB1bnRpbCBpdCBpc1xuICAgIC8vIGRvbmUuXG4gICAgaWYgKHRoaXMuX3dhaXQpXG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW3RoaXMubWV0aG9kSWRdID0gdHJ1ZTtcblxuICAgIC8vIEFjdHVhbGx5IHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fc2VuZCh0aGlzLl9tZXNzYWdlKTtcbiAgfVxuICAvLyBJbnZva2UgdGhlIGNhbGxiYWNrLCBpZiB3ZSBoYXZlIGJvdGggYSByZXN1bHQgYW5kIGtub3cgdGhhdCBhbGwgZGF0YSBoYXNcbiAgLy8gYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS5cbiAgX21heWJlSW52b2tlQ2FsbGJhY2soKSB7XG4gICAgaWYgKHRoaXMuX21ldGhvZFJlc3VsdCAmJiB0aGlzLl9kYXRhVmlzaWJsZSkge1xuICAgICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2suIChUaGlzIHdvbid0IHRocm93OiB0aGUgY2FsbGJhY2sgd2FzIHdyYXBwZWQgd2l0aFxuICAgICAgLy8gYmluZEVudmlyb25tZW50LilcbiAgICAgIHRoaXMuX2NhbGxiYWNrKHRoaXMuX21ldGhvZFJlc3VsdFswXSwgdGhpcy5fbWV0aG9kUmVzdWx0WzFdKTtcblxuICAgICAgLy8gRm9yZ2V0IGFib3V0IHRoaXMgbWV0aG9kLlxuICAgICAgZGVsZXRlIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdO1xuXG4gICAgICAvLyBMZXQgdGhlIGNvbm5lY3Rpb24ga25vdyB0aGF0IHRoaXMgbWV0aG9kIGlzIGZpbmlzaGVkLCBzbyBpdCBjYW4gdHJ5IHRvXG4gICAgICAvLyBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkKCk7XG4gICAgfVxuICB9XG4gIC8vIENhbGwgd2l0aCB0aGUgcmVzdWx0IG9mIHRoZSBtZXRob2QgZnJvbSB0aGUgc2VydmVyLiBPbmx5IG1heSBiZSBjYWxsZWRcbiAgLy8gb25jZTsgb25jZSBpdCBpcyBjYWxsZWQsIHlvdSBzaG91bGQgbm90IGNhbGwgc2VuZE1lc3NhZ2UgYWdhaW4uXG4gIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGFuIG9uUmVzdWx0UmVjZWl2ZWQgY2FsbGJhY2ssIGNhbGwgaXQgaW1tZWRpYXRlbHkuXG4gIC8vIFRoZW4gaW52b2tlIHRoZSBtYWluIGNhbGxiYWNrIGlmIGRhdGEgaXMgYWxzbyB2aXNpYmxlLlxuICByZWNlaXZlUmVzdWx0KGVyciwgcmVzdWx0KSB7XG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZHMgc2hvdWxkIG9ubHkgcmVjZWl2ZSByZXN1bHRzIG9uY2UnKTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBbZXJyLCByZXN1bHRdO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQoZXJyLCByZXN1bHQpO1xuICAgIHRoaXMuX21heWJlSW52b2tlQ2FsbGJhY2soKTtcbiAgfVxuICAvLyBDYWxsIHRoaXMgd2hlbiBhbGwgZGF0YSB3cml0dGVuIGJ5IHRoZSBtZXRob2QgaXMgdmlzaWJsZS4gVGhpcyBtZWFucyB0aGF0XG4gIC8vIHRoZSBtZXRob2QgaGFzIHJldHVybnMgaXRzIFwiZGF0YSBpcyBkb25lXCIgbWVzc2FnZSAqQU5EKiBhbGwgc2VydmVyXG4gIC8vIGRvY3VtZW50cyB0aGF0IGFyZSBidWZmZXJlZCBhdCB0aGF0IHRpbWUgaGF2ZSBiZWVuIHdyaXR0ZW4gdG8gdGhlIGxvY2FsXG4gIC8vIGNhY2hlLiBJbnZva2VzIHRoZSBtYWluIGNhbGxiYWNrIGlmIHRoZSByZXN1bHQgaGFzIGJlZW4gcmVjZWl2ZWQuXG4gIGRhdGFWaXNpYmxlKCkge1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gdHJ1ZTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gVHJ1ZSBpZiByZWNlaXZlUmVzdWx0IGhhcyBiZWVuIGNhbGxlZC5cbiAgZ290UmVzdWx0KCkge1xuICAgIHJldHVybiAhIXRoaXMuX21ldGhvZFJlc3VsdDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBUcmFja2VyIH0gZnJvbSAnbWV0ZW9yL3RyYWNrZXInO1xuaW1wb3J0IHsgRUpTT04gfSBmcm9tICdtZXRlb3IvZWpzb24nO1xuaW1wb3J0IHsgUmFuZG9tIH0gZnJvbSAnbWV0ZW9yL3JhbmRvbSc7XG5pbXBvcnQgeyBIb29rIH0gZnJvbSAnbWV0ZW9yL2NhbGxiYWNrLWhvb2snO1xuaW1wb3J0IHsgTW9uZ29JRCB9IGZyb20gJ21ldGVvci9tb25nby1pZCc7XG5pbXBvcnQgeyBERFAgfSBmcm9tICcuL25hbWVzcGFjZS5qcyc7XG5pbXBvcnQgTWV0aG9kSW52b2tlciBmcm9tICcuL01ldGhvZEludm9rZXIuanMnO1xuaW1wb3J0IHtcbiAgaGFzT3duLFxuICBzbGljZSxcbiAga2V5cyxcbiAgaXNFbXB0eSxcbiAgbGFzdCxcbn0gZnJvbSBcIm1ldGVvci9kZHAtY29tbW9uL3V0aWxzLmpzXCI7XG5cbmxldCBGaWJlcjtcbmxldCBGdXR1cmU7XG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gIEZpYmVyID0gTnBtLnJlcXVpcmUoJ2ZpYmVycycpO1xuICBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xufVxuXG5jbGFzcyBNb25nb0lETWFwIGV4dGVuZHMgSWRNYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihNb25nb0lELmlkU3RyaW5naWZ5LCBNb25nb0lELmlkUGFyc2UpO1xuICB9XG59XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ3xPYmplY3R9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICBvciBhbiBvYmplY3QgYXMgYSB0ZXN0IGhvb2sgKHNlZSBjb2RlKVxuLy8gT3B0aW9uczpcbi8vICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4vLyAgIGhlYWRlcnM6IGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Jcbi8vICAgICBzZXJ2ZXItdG8tc2VydmVyIEREUCBvbmx5XG4vLyAgIF9zb2NranNPcHRpb25zOiBTcGVjaWZpZXMgb3B0aW9ucyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHNvY2tqcyBjbGllbnRcbi8vICAgb25ERFBOZWdvdGlhdGlvblZlcnNpb25GYWlsdXJlOiBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4vL1xuLy8gWFhYIFRoZXJlIHNob3VsZCBiZSBhIHdheSB0byBkZXN0cm95IGEgRERQIGNvbm5lY3Rpb24sIGNhdXNpbmcgYWxsXG4vLyBvdXRzdGFuZGluZyBtZXRob2QgY2FsbHMgdG8gZmFpbC5cbi8vXG4vLyBYWFggT3VyIGN1cnJlbnQgd2F5IG9mIGhhbmRsaW5nIGZhaWx1cmUgYW5kIHJlY29ubmVjdGlvbiBpcyBncmVhdFxuLy8gZm9yIGFuIGFwcCAod2hlcmUgd2Ugd2FudCB0byB0b2xlcmF0ZSBiZWluZyBkaXNjb25uZWN0ZWQgYXMgYW5cbi8vIGV4cGVjdCBzdGF0ZSwgYW5kIGtlZXAgdHJ5aW5nIGZvcmV2ZXIgdG8gcmVjb25uZWN0KSBidXQgY3VtYmVyc29tZVxuLy8gZm9yIHNvbWV0aGluZyBsaWtlIGEgY29tbWFuZCBsaW5lIHRvb2wgdGhhdCB3YW50cyB0byBtYWtlIGFcbi8vIGNvbm5lY3Rpb24sIGNhbGwgYSBtZXRob2QsIGFuZCBwcmludCBhbiBlcnJvciBpZiBjb25uZWN0aW9uXG4vLyBmYWlscy4gV2Ugc2hvdWxkIGhhdmUgYmV0dGVyIHVzYWJpbGl0eSBpbiB0aGUgbGF0dGVyIGNhc2UgKHdoaWxlXG4vLyBzdGlsbCB0cmFuc3BhcmVudGx5IHJlY29ubmVjdGluZyBpZiBpdCdzIGp1c3QgYSB0cmFuc2llbnQgZmFpbHVyZVxuLy8gb3IgdGhlIHNlcnZlciBtaWdyYXRpbmcgdXMpLlxuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSB7XG4gICAgICBvbkNvbm5lY3RlZCgpIHt9LFxuICAgICAgb25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoZGVzY3JpcHRpb24pO1xuICAgICAgfSxcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNzUwMCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgICAgbnBtRmF5ZU9wdGlvbnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAvLyBUaGVzZSBvcHRpb25zIGFyZSBvbmx5IGZvciB0ZXN0aW5nLlxuICAgICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBmYWxzZSxcbiAgICAgIHN1cHBvcnRlZEREUFZlcnNpb25zOiBERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyxcbiAgICAgIHJldHJ5OiB0cnVlLFxuICAgICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgICAvLyBXaGVuIHVwZGF0ZXMgYXJlIGNvbWluZyB3aXRoaW4gdGhpcyBtcyBpbnRlcnZhbCwgYmF0Y2ggdGhlbSB0b2dldGhlci5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw6IDUsXG4gICAgICAvLyBGbHVzaCBidWZmZXJzIGltbWVkaWF0ZWx5IGlmIHdyaXRlcyBhcmUgaGFwcGVuaW5nIGNvbnRpbnVvdXNseSBmb3IgbW9yZSB0aGFuIHRoaXMgbWFueSBtcy5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzTWF4QWdlOiA1MDAsXG5cbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9O1xuXG4gICAgLy8gSWYgc2V0LCBjYWxsZWQgd2hlbiB3ZSByZWNvbm5lY3QsIHF1ZXVpbmcgbWV0aG9kIGNhbGxzIF9iZWZvcmVfIHRoZVxuICAgIC8vIGV4aXN0aW5nIG91dHN0YW5kaW5nIG9uZXMuXG4gICAgLy8gTk9URTogVGhpcyBmZWF0dXJlIGhhcyBiZWVuIHByZXNlcnZlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuIFRoZVxuICAgIC8vIHByZWZlcnJlZCBtZXRob2Qgb2Ygc2V0dGluZyBhIGNhbGxiYWNrIG9uIHJlY29ubmVjdCBpcyB0byB1c2VcbiAgICAvLyBERFAub25SZWNvbm5lY3QuXG4gICAgc2VsZi5vblJlY29ubmVjdCA9IG51bGw7XG5cbiAgICAvLyBhcyBhIHRlc3QgaG9vaywgYWxsb3cgcGFzc2luZyBhIHN0cmVhbSBpbnN0ZWFkIG9mIGEgdXJsLlxuICAgIGlmICh0eXBlb2YgdXJsID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VsZi5fc3RyZWFtID0gdXJsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IENsaWVudFN0cmVhbSB9ID0gcmVxdWlyZShcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiKTtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IG5ldyBDbGllbnRTdHJlYW0odXJsLCB7XG4gICAgICAgIHJldHJ5OiBvcHRpb25zLnJldHJ5LFxuICAgICAgICBDb25uZWN0aW9uRXJyb3I6IEREUC5Db25uZWN0aW9uRXJyb3IsXG4gICAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgICAgX3NvY2tqc09wdGlvbnM6IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMsXG4gICAgICAgIC8vIFVzZWQgdG8ga2VlcCBzb21lIHRlc3RzIHF1aWV0LCBvciBmb3Igb3RoZXIgY2FzZXMgaW4gd2hpY2hcbiAgICAgICAgLy8gdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdpdGggY29ubmVjdGlvbiBlcnJvcnMgaXMgdG8gc2lsZW50bHlcbiAgICAgICAgLy8gZmFpbCAoZS5nLiBzZW5kaW5nIHBhY2thZ2UgdXNhZ2Ugc3RhdHMpLiBBdCBzb21lIHBvaW50IHdlXG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGEgcmVhbCBBUEkgZm9yIGhhbmRsaW5nIGNsaWVudC1zdHJlYW0tbGV2ZWxcbiAgICAgICAgLy8gZXJyb3JzLlxuICAgICAgICBfZG9udFByaW50RXJyb3JzOiBvcHRpb25zLl9kb250UHJpbnRFcnJvcnMsXG4gICAgICAgIGNvbm5lY3RUaW1lb3V0TXM6IG9wdGlvbnMuY29ubmVjdFRpbWVvdXRNcyxcbiAgICAgICAgbnBtRmF5ZU9wdGlvbnM6IG9wdGlvbnMubnBtRmF5ZU9wdGlvbnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBudWxsO1xuICAgIHNlbGYuX3ZlcnNpb25TdWdnZXN0aW9uID0gbnVsbDsgLy8gVGhlIGxhc3QgcHJvcG9zZWQgRERQIHZlcnNpb24uXG4gICAgc2VsZi5fdmVyc2lvbiA9IG51bGw7IC8vIFRoZSBERFAgdmVyc2lvbiBhZ3JlZWQgb24gYnkgY2xpZW50IGFuZCBzZXJ2ZXIuXG4gICAgc2VsZi5fc3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBvYmplY3Qgd2l0aCBtZXRob2RzXG4gICAgc2VsZi5fbWV0aG9kSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBuYW1lIC0+IGZ1bmNcbiAgICBzZWxmLl9uZXh0TWV0aG9kSWQgPSAxO1xuICAgIHNlbGYuX3N1cHBvcnRlZEREUFZlcnNpb25zID0gb3B0aW9ucy5zdXBwb3J0ZWRERFBWZXJzaW9ucztcblxuICAgIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsID0gb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbDtcbiAgICBzZWxmLl9oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuXG4gICAgLy8gVHJhY2tzIG1ldGhvZHMgd2hpY2ggdGhlIHVzZXIgaGFzIHRyaWVkIHRvIGNhbGwgYnV0IHdoaWNoIGhhdmUgbm90IHlldFxuICAgIC8vIGNhbGxlZCB0aGVpciB1c2VyIGNhbGxiYWNrIChpZSwgdGhleSBhcmUgd2FpdGluZyBvbiB0aGVpciByZXN1bHQgb3IgZm9yIGFsbFxuICAgIC8vIG9mIHRoZWlyIHdyaXRlcyB0byBiZSB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZSkuIE1hcCBmcm9tIG1ldGhvZCBJRCB0b1xuICAgIC8vIE1ldGhvZEludm9rZXIgb2JqZWN0LlxuICAgIHNlbGYuX21ldGhvZEludm9rZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyBjYWxsZWQgYnV0IHdob3NlIHJlc3VsdCBtZXNzYWdlcyBoYXZlIG5vdFxuICAgIC8vIGFycml2ZWQgeWV0LlxuICAgIC8vXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIGlzIGFuIGFycmF5IG9mIGJsb2NrcyBvZiBtZXRob2RzLiBFYWNoIGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyBhIHNldCBvZiBtZXRob2RzIHRoYXQgY2FuIHJ1biBhdCB0aGUgc2FtZSB0aW1lLiBUaGUgZmlyc3QgYmxvY2tcbiAgICAvLyByZXByZXNlbnRzIHRoZSBtZXRob2RzIHdoaWNoIGFyZSBjdXJyZW50bHkgaW4gZmxpZ2h0OyBzdWJzZXF1ZW50IGJsb2Nrc1xuICAgIC8vIG11c3Qgd2FpdCBmb3IgcHJldmlvdXMgYmxvY2tzIHRvIGJlIGZ1bGx5IGZpbmlzaGVkIGJlZm9yZSB0aGV5IGNhbiBiZSBzZW50XG4gICAgLy8gdG8gdGhlIHNlcnZlci5cbiAgICAvL1xuICAgIC8vIEVhY2ggYmxvY2sgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gICAgLy8gLSBtZXRob2RzOiBhIGxpc3Qgb2YgTWV0aG9kSW52b2tlciBvYmplY3RzXG4gICAgLy8gLSB3YWl0OiBhIGJvb2xlYW47IGlmIHRydWUsIHRoaXMgYmxvY2sgaGFkIGEgc2luZ2xlIG1ldGhvZCBpbnZva2VkIHdpdGhcbiAgICAvLyAgICAgICAgIHRoZSBcIndhaXRcIiBvcHRpb25cbiAgICAvL1xuICAgIC8vIFRoZXJlIHdpbGwgbmV2ZXIgYmUgYWRqYWNlbnQgYmxvY2tzIHdpdGggd2FpdD1mYWxzZSwgYmVjYXVzZSB0aGUgb25seSB0aGluZ1xuICAgIC8vIHRoYXQgbWFrZXMgbWV0aG9kcyBuZWVkIHRvIGJlIHNlcmlhbGl6ZWQgaXMgYSB3YWl0IG1ldGhvZC5cbiAgICAvL1xuICAgIC8vIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZmlyc3QgYmxvY2sgd2hlbiB0aGVpciBcInJlc3VsdFwiIGlzXG4gICAgLy8gcmVjZWl2ZWQuIFRoZSBlbnRpcmUgZmlyc3QgYmxvY2sgaXMgb25seSByZW1vdmVkIHdoZW4gYWxsIG9mIHRoZSBpbi1mbGlnaHRcbiAgICAvLyBtZXRob2RzIGhhdmUgcmVjZWl2ZWQgdGhlaXIgcmVzdWx0cyAoc28gdGhlIFwibWV0aG9kc1wiIGxpc3QgaXMgZW1wdHkpICpBTkQqXG4gICAgLy8gYWxsIG9mIHRoZSBkYXRhIHdyaXR0ZW4gYnkgdGhvc2UgbWV0aG9kcyBhcmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIFNvXG4gICAgLy8gaXQgaXMgcG9zc2libGUgZm9yIHRoZSBmaXJzdCBibG9jaydzIG1ldGhvZHMgbGlzdCB0byBiZSBlbXB0eSwgaWYgd2UgYXJlXG4gICAgLy8gc3RpbGwgd2FpdGluZyBmb3Igc29tZSBvYmplY3RzIHRvIHF1aWVzY2UuXG4gICAgLy9cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vICBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbXX0sXG4gICAgLy8gICAge3dhaXQ6IHRydWUsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2xvZ2luJz5dfSxcbiAgICAvLyAgICB7d2FpdDogZmFsc2UsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2Zvbyc+LFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxNZXRob2RJbnZva2VyIGZvciAnYmFyJz5dfV1cbiAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgd2VyZSBzb21lIG1ldGhvZHMgd2hpY2ggd2VyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgYW5kXG4gICAgLy8gd2hpY2ggaGF2ZSByZXR1cm5lZCB0aGVpciByZXN1bHRzLCBidXQgc29tZSBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5XG4gICAgLy8gdGhlIG1ldGhvZHMgbWF5IG5vdCBiZSB2aXNpYmxlIGluIHRoZSBsb2NhbCBjYWNoZS4gT25jZSBhbGwgdGhhdCBkYXRhIGlzXG4gICAgLy8gdmlzaWJsZSwgd2Ugd2lsbCBzZW5kIGEgJ2xvZ2luJyBtZXRob2QuIE9uY2UgdGhlIGxvZ2luIG1ldGhvZCBoYXMgcmV0dXJuZWRcbiAgICAvLyBhbmQgYWxsIHRoZSBkYXRhIGlzIHZpc2libGUgKGluY2x1ZGluZyByZS1ydW5uaW5nIHN1YnMgaWYgdXNlcklkIGNoYW5nZXMpLFxuICAgIC8vIHdlIHdpbGwgc2VuZCB0aGUgJ2ZvbycgYW5kICdiYXInIG1ldGhvZHMgaW4gcGFyYWxsZWwuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIC8vIG1ldGhvZCBJRCAtPiBhcnJheSBvZiBvYmplY3RzIHdpdGgga2V5cyAnY29sbGVjdGlvbicgYW5kICdpZCcsIGxpc3RpbmdcbiAgICAvLyBkb2N1bWVudHMgd3JpdHRlbiBieSBhIGdpdmVuIG1ldGhvZCdzIHN0dWIuIGtleXMgYXJlIGFzc29jaWF0ZWQgd2l0aFxuICAgIC8vIG1ldGhvZHMgd2hvc2Ugc3R1YiB3cm90ZSBhdCBsZWFzdCBvbmUgZG9jdW1lbnQsIGFuZCB3aG9zZSBkYXRhLWRvbmUgbWVzc2FnZVxuICAgIC8vIGhhcyBub3QgeWV0IGJlZW4gcmVjZWl2ZWQuXG4gICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IHt9O1xuICAgIC8vIGNvbGxlY3Rpb24gLT4gSWRNYXAgb2YgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBvYmplY3QuIEEgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBoYXM6XG4gICAgLy8gLSBcImRvY3VtZW50XCI6IHRoZSB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBhY2NvcmRpbmcgdGhlXG4gICAgLy8gICBzZXJ2ZXIgKGllLCB0aGUgc25hcHNob3QgYmVmb3JlIGEgc3R1YiB3cm90ZSBpdCwgYW1lbmRlZCBieSBhbnkgY2hhbmdlc1xuICAgIC8vICAgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyKVxuICAgIC8vICAgSXQgaXMgdW5kZWZpbmVkIGlmIHdlIHRoaW5rIHRoZSBkb2N1bWVudCBkb2VzIG5vdCBleGlzdFxuICAgIC8vIC0gXCJ3cml0dGVuQnlTdHVic1wiOiBhIHNldCBvZiBtZXRob2QgSURzIHdob3NlIHN0dWJzIHdyb3RlIHRvIHRoZSBkb2N1bWVudFxuICAgIC8vICAgd2hvc2UgXCJkYXRhIGRvbmVcIiBtZXNzYWdlcyBoYXZlIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWRcbiAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSB7fTtcblxuICAgIC8vIEFycmF5IG9mIGNhbGxiYWNrcyB0byBiZSBjYWxsZWQgYWZ0ZXIgdGhlIG5leHQgdXBkYXRlIG9mIHRoZSBsb2NhbFxuICAgIC8vIGNhY2hlLiBVc2VkIGZvcjpcbiAgICAvLyAgLSBDYWxsaW5nIG1ldGhvZEludm9rZXIuZGF0YVZpc2libGUgYW5kIHN1YiByZWFkeSBjYWxsYmFja3MgYWZ0ZXJcbiAgICAvLyAgICB0aGUgcmVsZXZhbnQgZGF0YSBpcyBmbHVzaGVkLlxuICAgIC8vICAtIEludm9raW5nIHRoZSBjYWxsYmFja3Mgb2YgXCJoYWxmLWZpbmlzaGVkXCIgbWV0aG9kcyBhZnRlciByZWNvbm5lY3RcbiAgICAvLyAgICBxdWllc2NlbmNlLiBTcGVjaWZpY2FsbHksIG1ldGhvZHMgd2hvc2UgcmVzdWx0IHdhcyByZWNlaXZlZCBvdmVyIHRoZSBvbGRcbiAgICAvLyAgICBjb25uZWN0aW9uIChzbyB3ZSBkb24ndCByZS1zZW5kIGl0KSBidXQgd2hvc2UgZGF0YSBoYWQgbm90IGJlZW4gbWFkZVxuICAgIC8vICAgIHZpc2libGUuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIEluIHR3byBjb250ZXh0cywgd2UgYnVmZmVyIGFsbCBpbmNvbWluZyBkYXRhIG1lc3NhZ2VzIGFuZCB0aGVuIHByb2Nlc3MgdGhlbVxuICAgIC8vIGFsbCBhdCBvbmNlIGluIGEgc2luZ2xlIHVwZGF0ZTpcbiAgICAvLyAgIC0gRHVyaW5nIHJlY29ubmVjdCwgd2UgYnVmZmVyIGFsbCBkYXRhIG1lc3NhZ2VzIHVudGlsIGFsbCBzdWJzIHRoYXQgaGFkXG4gICAgLy8gICAgIGJlZW4gcmVhZHkgYmVmb3JlIHJlY29ubmVjdCBhcmUgcmVhZHkgYWdhaW4sIGFuZCBhbGwgbWV0aG9kcyB0aGF0IGFyZVxuICAgIC8vICAgICBhY3RpdmUgaGF2ZSByZXR1cm5lZCB0aGVpciBcImRhdGEgZG9uZSBtZXNzYWdlXCI7IHRoZW5cbiAgICAvLyAgIC0gRHVyaW5nIHRoZSBleGVjdXRpb24gb2YgYSBcIndhaXRcIiBtZXRob2QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlc1xuICAgIC8vICAgICB1bnRpbCB0aGUgd2FpdCBtZXRob2QgZ2V0cyBpdHMgXCJkYXRhIGRvbmVcIiBtZXNzYWdlLiAoSWYgdGhlIHdhaXQgbWV0aG9kXG4gICAgLy8gICAgIG9jY3VycyBkdXJpbmcgcmVjb25uZWN0LCBpdCBkb2Vzbid0IGdldCBhbnkgc3BlY2lhbCBoYW5kbGluZy4pXG4gICAgLy8gYWxsIGRhdGEgbWVzc2FnZXMgYXJlIHByb2Nlc3NlZCBpbiBvbmUgdXBkYXRlLlxuICAgIC8vXG4gICAgLy8gVGhlIGZvbGxvd2luZyBmaWVsZHMgYXJlIHVzZWQgZm9yIHRoaXMgXCJxdWllc2NlbmNlXCIgcHJvY2Vzcy5cblxuICAgIC8vIFRoaXMgYnVmZmVycyB0aGUgbWVzc2FnZXMgdGhhdCBhcmVuJ3QgYmVpbmcgcHJvY2Vzc2VkIHlldC5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG4gICAgLy8gTWFwIGZyb20gbWV0aG9kIElEIC0+IHRydWUuIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGlzIHdoZW4gdGhlaXJcbiAgICAvLyBcImRhdGEgZG9uZVwiIG1lc3NhZ2UgaXMgcmVjZWl2ZWQsIGFuZCB3ZSB3aWxsIG5vdCBxdWllc2NlIHVudGlsIGl0IGlzXG4gICAgLy8gZW1wdHkuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IHt9O1xuICAgIC8vIG1hcCBmcm9tIHN1YiBJRCAtPiB0cnVlIGZvciBzdWJzIHRoYXQgd2VyZSByZWFkeSAoaWUsIGNhbGxlZCB0aGUgc3ViXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGJlZm9yZSByZWNvbm5lY3QgYnV0IGhhdmVuJ3QgYmVjb21lIHJlYWR5IGFnYWluIHlldFxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSB7fTsgLy8gbWFwIGZyb20gc3ViLl9pZCAtPiB0cnVlXG4gICAgLy8gaWYgdHJ1ZSwgdGhlIG5leHQgZGF0YSB1cGRhdGUgc2hvdWxkIHJlc2V0IGFsbCBzdG9yZXMuIChzZXQgZHVyaW5nXG4gICAgLy8gcmVjb25uZWN0LilcbiAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgLy8gbmFtZSAtPiBhcnJheSBvZiB1cGRhdGVzIGZvciAoeWV0IHRvIGJlIGNyZWF0ZWQpIGNvbGxlY3Rpb25zXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSB7fTtcbiAgICAvLyBpZiB3ZSdyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgdGhlIHJldHJ5IGZ1bmNcbiAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuXG4gICAgc2VsZi5fX2ZsdXNoQnVmZmVyZWRXcml0ZXMgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgICdmbHVzaGluZyBERFAgYnVmZmVyZWQgd3JpdGVzJyxcbiAgICAgIHNlbGZcbiAgICApO1xuICAgIC8vIENvbGxlY3Rpb24gbmFtZSAtPiBhcnJheSBvZiBtZXNzYWdlcy5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlcyA9IHt9O1xuICAgIC8vIFdoZW4gY3VycmVudCBidWZmZXIgb2YgdXBkYXRlcyBtdXN0IGJlIGZsdXNoZWQgYXQsIGluIG1zIHRpbWVzdGFtcC5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFRpbWVvdXQgaGFuZGxlIGZvciB0aGUgbmV4dCBwcm9jZXNzaW5nIG9mIGFsbCBwZW5kaW5nIHdyaXRlc1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDtcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZSA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG5cbiAgICAvLyBtZXRhZGF0YSBmb3Igc3Vic2NyaXB0aW9ucy4gIE1hcCBmcm9tIHN1YiBJRCB0byBvYmplY3Qgd2l0aCBrZXlzOlxuICAgIC8vICAgLSBpZFxuICAgIC8vICAgLSBuYW1lXG4gICAgLy8gICAtIHBhcmFtc1xuICAgIC8vICAgLSBpbmFjdGl2ZSAoaWYgdHJ1ZSwgd2lsbCBiZSBjbGVhbmVkIHVwIGlmIG5vdCByZXVzZWQgaW4gcmUtcnVuKVxuICAgIC8vICAgLSByZWFkeSAoaGFzIHRoZSAncmVhZHknIG1lc3NhZ2UgYmVlbiByZWNlaXZlZD8pXG4gICAgLy8gICAtIHJlYWR5Q2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiByZWFkeSlcbiAgICAvLyAgIC0gZXJyb3JDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCBpZiB0aGUgc3ViIHRlcm1pbmF0ZXMgd2l0aFxuICAgIC8vICAgICAgICAgICAgICAgICAgICBhbiBlcnJvciwgWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEpXG4gICAgLy8gICAtIHN0b3BDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCB3aGVuIHRoZSBzdWIgdGVybWluYXRlc1xuICAgIC8vICAgICBmb3IgYW55IHJlYXNvbiwgd2l0aCBhbiBlcnJvciBhcmd1bWVudCBpZiBhbiBlcnJvciB0cmlnZ2VyZWQgdGhlIHN0b3ApXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9ucyA9IHt9O1xuXG4gICAgLy8gUmVhY3RpdmUgdXNlcklkLlxuICAgIHNlbGYuX3VzZXJJZCA9IG51bGw7XG4gICAgc2VsZi5fdXNlcklkRGVwcyA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcblxuICAgIC8vIEJsb2NrIGF1dG8tcmVsb2FkIHdoaWxlIHdlJ3JlIHdhaXRpbmcgZm9yIG1ldGhvZCByZXNwb25zZXMuXG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCAmJlxuICAgICAgICBQYWNrYWdlLnJlbG9hZCAmJlxuICAgICAgICAhIG9wdGlvbnMucmVsb2FkV2l0aE91dHN0YW5kaW5nKSB7XG4gICAgICBQYWNrYWdlLnJlbG9hZC5SZWxvYWQuX29uTWlncmF0ZShyZXRyeSA9PiB7XG4gICAgICAgIGlmICghIHNlbGYuX3JlYWR5VG9NaWdyYXRlKCkpIHtcbiAgICAgICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSByZXRyeTtcbiAgICAgICAgICByZXR1cm4gW2ZhbHNlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gW3RydWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBvbkRpc2Nvbm5lY3QgPSAoKSA9PiB7XG4gICAgICBpZiAoc2VsZi5faGVhcnRiZWF0KSB7XG4gICAgICAgIHNlbGYuX2hlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ21lc3NhZ2UnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICAgIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcyksXG4gICAgICAgICAgJ2hhbmRsaW5nIEREUCBtZXNzYWdlJ1xuICAgICAgICApXG4gICAgICApO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAncmVzZXQnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KHRoaXMub25SZXNldC5iaW5kKHRoaXMpLCAnaGFuZGxpbmcgRERQIHJlc2V0JylcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdkaXNjb25uZWN0JyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChvbkRpc2Nvbm5lY3QsICdoYW5kbGluZyBERFAgZGlzY29ubmVjdCcpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ21lc3NhZ2UnLCB0aGlzLm9uTWVzc2FnZS5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbigncmVzZXQnLCB0aGlzLm9uUmVzZXQuYmluZCh0aGlzKSk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oJ2Rpc2Nvbm5lY3QnLCBvbkRpc2Nvbm5lY3QpO1xuICAgIH1cbiAgfVxuXG4gIC8vICduYW1lJyBpcyB0aGUgbmFtZSBvZiB0aGUgZGF0YSBvbiB0aGUgd2lyZSB0aGF0IHNob3VsZCBnbyBpbiB0aGVcbiAgLy8gc3RvcmUuICd3cmFwcGVkU3RvcmUnIHNob3VsZCBiZSBhbiBvYmplY3Qgd2l0aCBtZXRob2RzIGJlZ2luVXBkYXRlLCB1cGRhdGUsXG4gIC8vIGVuZFVwZGF0ZSwgc2F2ZU9yaWdpbmFscywgcmV0cmlldmVPcmlnaW5hbHMuIHNlZSBDb2xsZWN0aW9uIGZvciBhbiBleGFtcGxlLlxuICByZWdpc3RlclN0b3JlKG5hbWUsIHdyYXBwZWRTdG9yZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKG5hbWUgaW4gc2VsZi5fc3RvcmVzKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBXcmFwIHRoZSBpbnB1dCBvYmplY3QgaW4gYW4gb2JqZWN0IHdoaWNoIG1ha2VzIGFueSBzdG9yZSBtZXRob2Qgbm90XG4gICAgLy8gaW1wbGVtZW50ZWQgYnkgJ3N0b3JlJyBpbnRvIGEgbm8tb3AuXG4gICAgY29uc3Qgc3RvcmUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGNvbnN0IGtleXNPZlN0b3JlID0gW1xuICAgICAgJ3VwZGF0ZScsXG4gICAgICAnYmVnaW5VcGRhdGUnLFxuICAgICAgJ2VuZFVwZGF0ZScsXG4gICAgICAnc2F2ZU9yaWdpbmFscycsXG4gICAgICAncmV0cmlldmVPcmlnaW5hbHMnLFxuICAgICAgJ2dldERvYycsXG4gICAgICAnX2dldENvbGxlY3Rpb24nXG4gICAgXTtcbiAgICBrZXlzT2ZTdG9yZS5mb3JFYWNoKChtZXRob2QpID0+IHtcbiAgICAgIHN0b3JlW21ldGhvZF0gPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBpZiAod3JhcHBlZFN0b3JlW21ldGhvZF0pIHtcbiAgICAgICAgICByZXR1cm4gd3JhcHBlZFN0b3JlW21ldGhvZF0oLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gICAgc2VsZi5fc3RvcmVzW25hbWVdID0gc3RvcmU7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBxdWV1ZWQuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgICBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH0pO1xuICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICBkZWxldGUgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3Iuc3Vic2NyaWJlXG4gICAqIEBzdW1tYXJ5IFN1YnNjcmliZSB0byBhIHJlY29yZCBzZXQuICBSZXR1cm5zIGEgaGFuZGxlIHRoYXQgcHJvdmlkZXNcbiAgICogYHN0b3AoKWAgYW5kIGByZWFkeSgpYCBtZXRob2RzLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHN1YnNjcmlwdGlvbi4gIE1hdGNoZXMgdGhlIG5hbWUgb2YgdGhlXG4gICAqIHNlcnZlcidzIGBwdWJsaXNoKClgIGNhbGwuXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBhcmd1bWVudHMgcGFzc2VkIHRvIHB1Ymxpc2hlclxuICAgKiBmdW5jdGlvbiBvbiBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fSBbY2FsbGJhY2tzXSBPcHRpb25hbC4gTWF5IGluY2x1ZGUgYG9uU3RvcGBcbiAgICogYW5kIGBvblJlYWR5YCBjYWxsYmFja3MuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBpdCBpcyBwYXNzZWQgYXMgYW5cbiAgICogYXJndW1lbnQgdG8gYG9uU3RvcGAuIElmIGEgZnVuY3Rpb24gaXMgcGFzc2VkIGluc3RlYWQgb2YgYW4gb2JqZWN0LCBpdFxuICAgKiBpcyBpbnRlcnByZXRlZCBhcyBhbiBgb25SZWFkeWAgY2FsbGJhY2suXG4gICAqL1xuICBzdWJzY3JpYmUobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiAoY2FsbGJhY2t8Y2FsbGJhY2tzKSAqLykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgcGFyYW1zID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxldCBjYWxsYmFja3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIGlmIChwYXJhbXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBsYXN0UGFyYW0gPSBwYXJhbXNbcGFyYW1zLmxlbmd0aCAtIDFdO1xuICAgICAgaWYgKHR5cGVvZiBsYXN0UGFyYW0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2FsbGJhY2tzLm9uUmVhZHkgPSBwYXJhbXMucG9wKCk7XG4gICAgICB9IGVsc2UgaWYgKGxhc3RQYXJhbSAmJiBbXG4gICAgICAgIGxhc3RQYXJhbS5vblJlYWR5LFxuICAgICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSBvbkVycm9yIHVzZWQgdG8gZXhpc3QsIGJ1dCBub3cgd2UgdXNlXG4gICAgICAgIC8vIG9uU3RvcCB3aXRoIGFuIGVycm9yIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgICAgIGxhc3RQYXJhbS5vbkVycm9yLFxuICAgICAgICBsYXN0UGFyYW0ub25TdG9wXG4gICAgICBdLnNvbWUoZiA9PiB0eXBlb2YgZiA9PT0gXCJmdW5jdGlvblwiKSkge1xuICAgICAgICBjYWxsYmFja3MgPSBwYXJhbXMucG9wKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXMgdGhlcmUgYW4gZXhpc3Rpbmcgc3ViIHdpdGggdGhlIHNhbWUgbmFtZSBhbmQgcGFyYW0sIHJ1biBpbiBhblxuICAgIC8vIGludmFsaWRhdGVkIENvbXB1dGF0aW9uPyBUaGlzIHdpbGwgaGFwcGVuIGlmIHdlIGFyZSByZXJ1bm5pbmcgYW5cbiAgICAvLyBleGlzdGluZyBjb21wdXRhdGlvbi5cbiAgICAvL1xuICAgIC8vIEZvciBleGFtcGxlLCBjb25zaWRlciBhIHJlcnVuIG9mOlxuICAgIC8vXG4gICAgLy8gICAgIFRyYWNrZXIuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgLy8gICAgICAgTWV0ZW9yLnN1YnNjcmliZShcImZvb1wiLCBTZXNzaW9uLmdldChcImZvb1wiKSk7XG4gICAgLy8gICAgICAgTWV0ZW9yLnN1YnNjcmliZShcImJhclwiLCBTZXNzaW9uLmdldChcImJhclwiKSk7XG4gICAgLy8gICAgIH0pO1xuICAgIC8vXG4gICAgLy8gSWYgXCJmb29cIiBoYXMgY2hhbmdlZCBidXQgXCJiYXJcIiBoYXMgbm90LCB3ZSB3aWxsIG1hdGNoIHRoZSBcImJhclwiXG4gICAgLy8gc3ViY3JpYmUgdG8gYW4gZXhpc3RpbmcgaW5hY3RpdmUgc3Vic2NyaXB0aW9uIGluIG9yZGVyIHRvIG5vdFxuICAgIC8vIHVuc3ViIGFuZCByZXN1YiB0aGUgc3Vic2NyaXB0aW9uIHVubmVjZXNzYXJpbHkuXG4gICAgLy9cbiAgICAvLyBXZSBvbmx5IGxvb2sgZm9yIG9uZSBzdWNoIHN1YjsgaWYgdGhlcmUgYXJlIE4gYXBwYXJlbnRseS1pZGVudGljYWwgc3Vic1xuICAgIC8vIGJlaW5nIGludmFsaWRhdGVkLCB3ZSB3aWxsIHJlcXVpcmUgTiBtYXRjaGluZyBzdWJzY3JpYmUgY2FsbHMgdG8ga2VlcFxuICAgIC8vIHRoZW0gYWxsIGFjdGl2ZS5cbiAgICBjb25zdCBleGlzdGluZyA9IE9iamVjdC52YWx1ZXMoc2VsZi5fc3Vic2NyaXB0aW9ucykuZmluZChcbiAgICAgIHN1YiA9PiAoc3ViLmluYWN0aXZlICYmIHN1Yi5uYW1lID09PSBuYW1lICYmIEVKU09OLmVxdWFscyhzdWIucGFyYW1zLCBwYXJhbXMpKVxuICAgICk7XG5cbiAgICBsZXQgaWQ7XG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBpZCA9IGV4aXN0aW5nLmlkO1xuICAgICAgZXhpc3RpbmcuaW5hY3RpdmUgPSBmYWxzZTsgLy8gcmVhY3RpdmF0ZVxuXG4gICAgICBpZiAoY2FsbGJhY2tzLm9uUmVhZHkpIHtcbiAgICAgICAgLy8gSWYgdGhlIHN1YiBpcyBub3QgYWxyZWFkeSByZWFkeSwgcmVwbGFjZSBhbnkgcmVhZHkgY2FsbGJhY2sgd2l0aCB0aGVcbiAgICAgICAgLy8gb25lIHByb3ZpZGVkIG5vdy4gKEl0J3Mgbm90IHJlYWxseSBjbGVhciB3aGF0IHVzZXJzIHdvdWxkIGV4cGVjdCBmb3JcbiAgICAgICAgLy8gYW4gb25SZWFkeSBjYWxsYmFjayBpbnNpZGUgYW4gYXV0b3J1bjsgdGhlIHNlbWFudGljcyB3ZSBwcm92aWRlIGlzXG4gICAgICAgIC8vIHRoYXQgYXQgdGhlIHRpbWUgdGhlIHN1YiBmaXJzdCBiZWNvbWVzIHJlYWR5LCB3ZSBjYWxsIHRoZSBsYXN0XG4gICAgICAgIC8vIG9uUmVhZHkgY2FsbGJhY2sgcHJvdmlkZWQsIGlmIGFueS4pXG4gICAgICAgIC8vIElmIHRoZSBzdWIgaXMgYWxyZWFkeSByZWFkeSwgcnVuIHRoZSByZWFkeSBjYWxsYmFjayByaWdodCBhd2F5LlxuICAgICAgICAvLyBJdCBzZWVtcyB0aGF0IHVzZXJzIHdvdWxkIGV4cGVjdCBhbiBvblJlYWR5IGNhbGxiYWNrIGluc2lkZSBhblxuICAgICAgICAvLyBhdXRvcnVuIHRvIHRyaWdnZXIgb25jZSB0aGUgdGhlIHN1YiBmaXJzdCBiZWNvbWVzIHJlYWR5IGFuZCBhbHNvXG4gICAgICAgIC8vIHdoZW4gcmUtc3VicyBoYXBwZW5zLlxuICAgICAgICBpZiAoZXhpc3RpbmcucmVhZHkpIHtcbiAgICAgICAgICBjYWxsYmFja3Mub25SZWFkeSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4aXN0aW5nLnJlYWR5Q2FsbGJhY2sgPSBjYWxsYmFja3Mub25SZWFkeTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSB3ZSB1c2VkIHRvIGhhdmUgb25FcnJvciBidXQgbm93IHdlIGNhbGxcbiAgICAgIC8vIG9uU3RvcCB3aXRoIGFuIG9wdGlvbmFsIGVycm9yIGFyZ3VtZW50XG4gICAgICBpZiAoY2FsbGJhY2tzLm9uRXJyb3IpIHtcbiAgICAgICAgLy8gUmVwbGFjZSBleGlzdGluZyBjYWxsYmFjayBpZiBhbnksIHNvIHRoYXQgZXJyb3JzIGFyZW4ndFxuICAgICAgICAvLyBkb3VibGUtcmVwb3J0ZWQuXG4gICAgICAgIGV4aXN0aW5nLmVycm9yQ2FsbGJhY2sgPSBjYWxsYmFja3Mub25FcnJvcjtcbiAgICAgIH1cblxuICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgZXhpc3Rpbmcuc3RvcENhbGxiYWNrID0gY2FsbGJhY2tzLm9uU3RvcDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTmV3IHN1YiEgR2VuZXJhdGUgYW4gaWQsIHNhdmUgaXQgbG9jYWxseSwgYW5kIHNlbmQgbWVzc2FnZS5cbiAgICAgIGlkID0gUmFuZG9tLmlkKCk7XG4gICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXSA9IHtcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBwYXJhbXM6IEVKU09OLmNsb25lKHBhcmFtcyksXG4gICAgICAgIGluYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgcmVhZHk6IGZhbHNlLFxuICAgICAgICByZWFkeURlcHM6IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKSxcbiAgICAgICAgcmVhZHlDYWxsYmFjazogY2FsbGJhY2tzLm9uUmVhZHksXG4gICAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xICNlcnJvckNhbGxiYWNrXG4gICAgICAgIGVycm9yQ2FsbGJhY2s6IGNhbGxiYWNrcy5vbkVycm9yLFxuICAgICAgICBzdG9wQ2FsbGJhY2s6IGNhbGxiYWNrcy5vblN0b3AsXG4gICAgICAgIGNvbm5lY3Rpb246IHNlbGYsXG4gICAgICAgIHJlbW92ZSgpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uLl9zdWJzY3JpcHRpb25zW3RoaXMuaWRdO1xuICAgICAgICAgIHRoaXMucmVhZHkgJiYgdGhpcy5yZWFkeURlcHMuY2hhbmdlZCgpO1xuICAgICAgICB9LFxuICAgICAgICBzdG9wKCkge1xuICAgICAgICAgIHRoaXMuY29ubmVjdGlvbi5fc2VuZCh7IG1zZzogJ3Vuc3ViJywgaWQ6IGlkIH0pO1xuICAgICAgICAgIHRoaXMucmVtb3ZlKCk7XG5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLm9uU3RvcCkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLm9uU3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdzdWInLCBpZDogaWQsIG5hbWU6IG5hbWUsIHBhcmFtczogcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhIGhhbmRsZSB0byB0aGUgYXBwbGljYXRpb24uXG4gICAgY29uc3QgaGFuZGxlID0ge1xuICAgICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLnN0b3AoKTtcbiAgICAgIH0sXG4gICAgICByZWFkeSgpIHtcbiAgICAgICAgLy8gcmV0dXJuIGZhbHNlIGlmIHdlJ3ZlIHVuc3Vic2NyaWJlZC5cbiAgICAgICAgaWYgKCFoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBpZCkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVjb3JkID0gc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF07XG4gICAgICAgIHJlY29yZC5yZWFkeURlcHMuZGVwZW5kKCk7XG4gICAgICAgIHJldHVybiByZWNvcmQucmVhZHk7XG4gICAgICB9LFxuICAgICAgc3Vic2NyaXB0aW9uSWQ6IGlkXG4gICAgfTtcblxuICAgIGlmIChUcmFja2VyLmFjdGl2ZSkge1xuICAgICAgLy8gV2UncmUgaW4gYSByZWFjdGl2ZSBjb21wdXRhdGlvbiwgc28gd2UnZCBsaWtlIHRvIHVuc3Vic2NyaWJlIHdoZW4gdGhlXG4gICAgICAvLyBjb21wdXRhdGlvbiBpcyBpbnZhbGlkYXRlZC4uLiBidXQgbm90IGlmIHRoZSByZXJ1biBqdXN0IHJlLXN1YnNjcmliZXNcbiAgICAgIC8vIHRvIHRoZSBzYW1lIHN1YnNjcmlwdGlvbiEgIFdoZW4gYSByZXJ1biBoYXBwZW5zLCB3ZSB1c2Ugb25JbnZhbGlkYXRlXG4gICAgICAvLyBhcyBhIGNoYW5nZSB0byBtYXJrIHRoZSBzdWJzY3JpcHRpb24gXCJpbmFjdGl2ZVwiIHNvIHRoYXQgaXQgY2FuXG4gICAgICAvLyBiZSByZXVzZWQgZnJvbSB0aGUgcmVydW4uICBJZiBpdCBpc24ndCByZXVzZWQsIGl0J3Mga2lsbGVkIGZyb21cbiAgICAgIC8vIGFuIGFmdGVyRmx1c2guXG4gICAgICBUcmFja2VyLm9uSW52YWxpZGF0ZSgoYykgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0uaW5hY3RpdmUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgVHJhY2tlci5hZnRlckZsdXNoKCgpID0+IHtcbiAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpICYmXG4gICAgICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlKSB7XG4gICAgICAgICAgICBoYW5kbGUuc3RvcCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgLy8gb3B0aW9uczpcbiAgLy8gLSBvbkxhdGVFcnJvciB7RnVuY3Rpb24oZXJyb3IpfSBjYWxsZWQgaWYgYW4gZXJyb3Igd2FzIHJlY2VpdmVkIGFmdGVyIHRoZSByZWFkeSBldmVudC5cbiAgLy8gICAgIChlcnJvcnMgcmVjZWl2ZWQgYmVmb3JlIHJlYWR5IGNhdXNlIGFuIGVycm9yIHRvIGJlIHRocm93bilcbiAgX3N1YnNjcmliZUFuZFdhaXQobmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGYgPSBuZXcgRnV0dXJlKCk7XG4gICAgbGV0IHJlYWR5ID0gZmFsc2U7XG4gICAgYXJncyA9IGFyZ3MgfHwgW107XG4gICAgYXJncy5wdXNoKHtcbiAgICAgIG9uUmVhZHkoKSB7XG4gICAgICAgIHJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgZlsncmV0dXJuJ10oKTtcbiAgICAgIH0sXG4gICAgICBvbkVycm9yKGUpIHtcbiAgICAgICAgaWYgKCFyZWFkeSkgZlsndGhyb3cnXShlKTtcbiAgICAgICAgZWxzZSBvcHRpb25zICYmIG9wdGlvbnMub25MYXRlRXJyb3IgJiYgb3B0aW9ucy5vbkxhdGVFcnJvcihlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGhhbmRsZSA9IHNlbGYuc3Vic2NyaWJlLmFwcGx5KHNlbGYsIFtuYW1lXS5jb25jYXQoYXJncykpO1xuICAgIGYud2FpdCgpO1xuICAgIHJldHVybiBoYW5kbGU7XG4gIH1cblxuICBtZXRob2RzKG1ldGhvZHMpIHtcbiAgICBPYmplY3QuZW50cmllcyhtZXRob2RzKS5mb3JFYWNoKChbbmFtZSwgZnVuY10pID0+IHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBtZXRob2QgbmFtZWQgJ1wiICsgbmFtZSArIFwiJyBpcyBhbHJlYWR5IGRlZmluZWRcIik7XG4gICAgICB9XG4gICAgICB0aGlzLl9tZXRob2RIYW5kbGVyc1tuYW1lXSA9IGZ1bmM7XG4gICAgfSk7XG4gIH1cblxuICBfZ2V0SXNTaW11bGF0aW9uKHtpc0Zyb21DYWxsQXN5bmMsIGFscmVhZHlJblNpbXVsYXRpb259KSB7XG4gICAgaWYgKCFpc0Zyb21DYWxsQXN5bmMpIHtcbiAgICAgIHJldHVybiBhbHJlYWR5SW5TaW11bGF0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gYWxyZWFkeUluU2ltdWxhdGlvbiAmJiBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9pc0NhbGxBc3luY01ldGhvZFJ1bm5pbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5jYWxsXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2Qgd2l0aCBhIHN5bmMgc3R1YiwgcGFzc2luZyBhbnkgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgbWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2ssIHdoaWNoIGlzIGNhbGxlZCBhc3luY2hyb25vdXNseSB3aXRoIHRoZSBlcnJvciBvciByZXN1bHQgYWZ0ZXIgdGhlIG1ldGhvZCBpcyBjb21wbGV0ZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgbWV0aG9kIHJ1bnMgc3luY2hyb25vdXNseSBpZiBwb3NzaWJsZSAoc2VlIGJlbG93KS5cbiAgICovXG4gIGNhbGwobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiBjYWxsYmFjayAqLykge1xuICAgIC8vIGlmIGl0J3MgYSBmdW5jdGlvbiwgdGhlIGxhc3QgYXJndW1lbnQgaXMgdGhlIHJlc3VsdCBjYWxsYmFjayxcbiAgICAvLyBub3QgYSBwYXJhbWV0ZXIgdG8gdGhlIHJlbW90ZSBtZXRob2QuXG4gICAgY29uc3QgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsZXQgY2FsbGJhY2s7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYXBwbHkobmFtZSwgYXJncywgY2FsbGJhY2spO1xuICB9XG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5jYWxsQXN5bmNcbiAgICogQHN1bW1hcnkgSW52b2tlcyBhIG1ldGhvZCB3aXRoIGFuIGFzeW5jIHN0dWIsIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICBhc3luYyBjYWxsQXN5bmMobmFtZSAvKiAuLiBbYXJndW1lbnRzXSAuLiAqLykge1xuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJNZXRlb3IuY2FsbEFzeW5jKCkgZG9lcyBub3QgYWNjZXB0IGEgY2FsbGJhY2suIFlvdSBzaG91bGQgJ2F3YWl0JyB0aGUgcmVzdWx0LCBvciB1c2UgLnRoZW4oKS5cIlxuICAgICAgKTtcbiAgICB9XG4gICAgLypcbiAgICAqIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugd2hlbiB5b3UgY2FsbCBhIFByb21pc2UudGhlbiwgeW91J3JlIGFjdHVhbGx5IGNhbGxpbmcgYSBib3VuZCBmdW5jdGlvbiBieSBNZXRlb3IuXG4gICAgKlxuICAgICogVGhpcyBpcyBkb25lIGJ5IHRoaXMgY29kZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9ibG9iLzE3NjczYzY2ODc4ZDNmN2IxZDU2NGE0MjE1ZWIwNjMzZmE2NzkwMTcvbnBtLXBhY2thZ2VzL21ldGVvci1wcm9taXNlL3Byb21pc2VfY2xpZW50LmpzI0wxLUwxNi4gKEFsbCB0aGUgbG9naWMgYmVsb3cgY2FuIGJlIHJlbW92ZWQgaW4gdGhlIGZ1dHVyZSwgd2hlbiB3ZSBzdG9wIG92ZXJ3cml0aW5nIHRoZVxuICAgICogUHJvbWlzZS4pXG4gICAgKlxuICAgICogV2hlbiB5b3UgY2FsbCBhIFwiLnRoZW4oKVwiLCBsaWtlIFwiTWV0ZW9yLmNhbGxBc3luYygpLnRoZW4oKVwiLCB0aGUgZ2xvYmFsIGNvbnRleHQgKGluc2lkZSBjdXJyZW50VmFsdWVzKVxuICAgICogd2lsbCBiZSBmcm9tIHRoZSBjYWxsIG9mIE1ldGVvci5jYWxsQXN5bmMoKSwgYW5kIG5vdCB0aGUgY29udGV4dCBhZnRlciB0aGUgcHJvbWlzZSBpcyBkb25lLlxuICAgICpcbiAgICAqIFRoaXMgbWVhbnMgdGhhdCB3aXRob3V0IHRoaXMgY29kZSBpZiB5b3UgY2FsbCBhIHN0dWIgaW5zaWRlIHRoZSBcIi50aGVuKClcIiwgdGhpcyBzdHViIHdpbGwgYWN0IGFzIGEgc2ltdWxhdGlvblxuICAgICogYW5kIHdvbid0IHJlYWNoIHRoZSBzZXJ2ZXIuXG4gICAgKlxuICAgICogSW5zaWRlIHRoZSBmdW5jdGlvbiBfZ2V0SXNTaW11bGF0aW9uKCksIGlmIGlzRnJvbUNhbGxBc3luYyBpcyBmYWxzZSwgd2UgY29udGludWUgdG8gY29uc2lkZXIganVzdCB0aGVcbiAgICAqIGFscmVhZHlJblNpbXVsYXRpb24sIG90aGVyd2lzZSwgaXNGcm9tQ2FsbEFzeW5jIGlzIHRydWUsIHdlIGFsc28gY2hlY2sgdGhlIHZhbHVlIG9mIGNhbGxBc3luY01ldGhvZFJ1bm5pbmcgKGJ5XG4gICAgKiBjYWxsaW5nIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpKS5cbiAgICAqXG4gICAgKiBXaXRoIHRoaXMsIGlmIGEgc3R1YiBpcyBydW5uaW5nIGluc2lkZSBhIFwiLnRoZW4oKVwiLCBpdCdsbCBrbm93IGl0J3Mgbm90IGEgc2ltdWxhdGlvbiwgYmVjYXVzZSBjYWxsQXN5bmNNZXRob2RSdW5uaW5nXG4gICAgKiB3aWxsIGJlIGZhbHNlLlxuICAgICpcbiAgICAqIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpIGlzIGltcG9ydGFudCBiZWNhdXNlIHdpdGhvdXQgaXQsIGlmIHlvdSBoYXZlIGEgY29kZSBsaWtlOlxuICAgICpcbiAgICAqIE1ldGVvci5jYWxsQXN5bmMoXCJtMVwiKS50aGVuKCgpID0+IHtcbiAgICAqICAgTWV0ZW9yLmNhbGxBc3luYyhcIm0yXCIpXG4gICAgKiB9KVxuICAgICpcbiAgICAqIFRoZSBjYWxsIHRoZSBtZXRob2QgbTIgd2lsbCBhY3QgYXMgYSBzaW11bGF0aW9uIGFuZCB3b24ndCByZWFjaCB0aGUgc2VydmVyLiBUaGF0J3Mgd2h5IHdlIHJlc2V0IHRoZSBjb250ZXh0IGhlcmVcbiAgICAqIGJlZm9yZSBjYWxsaW5nIGV2ZXJ5dGhpbmcgZWxzZS5cbiAgICAqXG4gICAgKiAqL1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpO1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSB9LCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0Q2FsbEFzeW5jTWV0aG9kUnVubmluZyhmYWxzZSk7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuYXBwbHlcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2s7IHNhbWUgc2VtYW50aWNzIGFzIGluIFtgTWV0ZW9yLmNhbGxgXSgjbWV0ZW9yX2NhbGwpLlxuICAgKi9cbiAgYXBwbHkobmFtZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCB7IHN0dWJJbnZvY2F0aW9uLCBpbnZvY2F0aW9uLCAuLi5zdHViT3B0aW9ucyB9ID0gdGhpcy5fc3R1YkNhbGwobmFtZSwgRUpTT04uY2xvbmUoYXJncykpO1xuXG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uXG4gICAgICAgICAgLndpdGhWYWx1ZShpbnZvY2F0aW9uLCBzdHViSW52b2NhdGlvbik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcHBseShuYW1lLCBzdHViT3B0aW9ucywgYXJncywgb3B0aW9ucywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmFwcGx5QXN5bmNcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2suXG4gICAqL1xuICBhc3luYyBhcHBseUFzeW5jKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgeyBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiwgLi4uc3R1Yk9wdGlvbnMgfSA9IHRoaXMuX3N0dWJDYWxsKG5hbWUsIEVKU09OLmNsb25lKGFyZ3MpLCBvcHRpb25zKTtcbiAgICBpZiAoc3R1Yk9wdGlvbnMuaGFzU3R1Yikge1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5fZ2V0SXNTaW11bGF0aW9uKHtcbiAgICAgICAgICBhbHJlYWR5SW5TaW11bGF0aW9uOiBzdHViT3B0aW9ucy5hbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1Yk9wdGlvbnMuaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgICB9KVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbHMoKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIC8qXG4gICAgICAgICAqIFRoZSBjb2RlIGJlbG93IGZvbGxvd3MgdGhlIHNhbWUgbG9naWMgYXMgdGhlIGZ1bmN0aW9uIHdpdGhWYWx1ZXMoKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQnV0IGFzIHRoZSBNZXRlb3IgcGFja2FnZSBpcyBub3QgY29tcGlsZWQgYnkgZWNtYXNjcmlwdCwgaXQgaXMgdW5hYmxlIHRvIHVzZSBuZXdlciBzeW50YXggaW4gdGhlIGJyb3dzZXIsXG4gICAgICAgICAqIHN1Y2ggYXMsIHRoZSBhc3luYy9hd2FpdC5cbiAgICAgICAgICpcbiAgICAgICAgICogU28sIHRvIGtlZXAgc3VwcG9ydGluZyBvbGQgYnJvd3NlcnMsIGxpa2UgSUUgMTEsIHdlJ3JlIGNyZWF0aW5nIHRoZSBsb2dpYyBvbmUgbGV2ZWwgYWJvdmUuXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdCBjdXJyZW50Q29udGV4dCA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldE5ld0NvbnRleHRBbmRHZXRDdXJyZW50KFxuICAgICAgICAgIGludm9jYXRpb25cbiAgICAgICAgKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXN1bHRPclRoZW5hYmxlID0gc3R1Ykludm9jYXRpb24oKTtcbiAgICAgICAgICBjb25zdCBpc1RoZW5hYmxlID1cbiAgICAgICAgICAgIHJlc3VsdE9yVGhlbmFibGUgJiYgdHlwZW9mIHJlc3VsdE9yVGhlbmFibGUudGhlbiA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgICAgICBpZiAoaXNUaGVuYWJsZSkge1xuICAgICAgICAgICAgc3R1Yk9wdGlvbnMuc3R1YlJldHVyblZhbHVlID0gYXdhaXQgcmVzdWx0T3JUaGVuYWJsZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3R1Yk9wdGlvbnMuc3R1YlJldHVyblZhbHVlID0gcmVzdWx0T3JUaGVuYWJsZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0KGN1cnJlbnRDb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzdHViT3B0aW9ucy5leGNlcHRpb24gPSBlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fYXBwbHkobmFtZSwgc3R1Yk9wdGlvbnMsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIF9hcHBseShuYW1lLCBzdHViQ2FsbFZhbHVlLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIC8vIFhYWCB3b3VsZCBpdCBiZSBiZXR0ZXIgZm9ybSB0byBkbyB0aGUgYmluZGluZyBpbiBzdHJlYW0ub24sXG4gICAgICAvLyBvciBjYWxsZXIsIGluc3RlYWQgb2YgaGVyZT9cbiAgICAgIC8vIFhYWCBpbXByb3ZlIGVycm9yIG1lc3NhZ2UgKGFuZCBob3cgd2UgcmVwb3J0IGl0KVxuICAgICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgXCJkZWxpdmVyaW5nIHJlc3VsdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gS2VlcCBvdXIgYXJncyBzYWZlIGZyb20gbXV0YXRpb24gKGVnIGlmIHdlIGRvbid0IHNlbmQgdGhlIG1lc3NhZ2UgZm9yIGFcbiAgICAvLyB3aGlsZSBiZWNhdXNlIG9mIGEgd2FpdCBtZXRob2QpLlxuICAgIGFyZ3MgPSBFSlNPTi5jbG9uZShhcmdzKTtcblxuICAgIGNvbnN0IHsgaGFzU3R1YiwgZXhjZXB0aW9uLCBzdHViUmV0dXJuVmFsdWUsIGFscmVhZHlJblNpbXVsYXRpb24sIHJhbmRvbVNlZWQgfSA9IHN0dWJDYWxsVmFsdWU7XG5cbiAgICAvLyBJZiB3ZSdyZSBpbiBhIHNpbXVsYXRpb24sIHN0b3AgYW5kIHJldHVybiB0aGUgcmVzdWx0IHdlIGhhdmUsXG4gICAgLy8gcmF0aGVyIHRoYW4gZ29pbmcgb24gdG8gZG8gYW4gUlBDLiBJZiB0aGVyZSB3YXMgbm8gc3R1YixcbiAgICAvLyB3ZSdsbCBlbmQgdXAgcmV0dXJuaW5nIHVuZGVmaW5lZC5cbiAgICBpZiAoXG4gICAgICB0aGlzLl9nZXRJc1NpbXVsYXRpb24oe1xuICAgICAgICBhbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJDYWxsVmFsdWUuaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgfSlcbiAgICApIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhleGNlcHRpb24sIHN0dWJSZXR1cm5WYWx1ZSk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZXhjZXB0aW9uKSB0aHJvdyBleGNlcHRpb247XG4gICAgICByZXR1cm4gc3R1YlJldHVyblZhbHVlO1xuICAgIH1cblxuICAgIC8vIFdlIG9ubHkgY3JlYXRlIHRoZSBtZXRob2RJZCBoZXJlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgbmVlZCBvbmUgaWZcbiAgICAvLyB3ZSdyZSBhbHJlYWR5IGluIGEgc2ltdWxhdGlvblxuICAgIGNvbnN0IG1ldGhvZElkID0gJycgKyBzZWxmLl9uZXh0TWV0aG9kSWQrKztcbiAgICBpZiAoaGFzU3R1Yikge1xuICAgICAgc2VsZi5fcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyhtZXRob2RJZCk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgdGhlIEREUCBtZXNzYWdlIGZvciB0aGUgbWV0aG9kIGNhbGwuIE5vdGUgdGhhdCBvbiB0aGUgY2xpZW50LFxuICAgIC8vIGl0IGlzIGltcG9ydGFudCB0aGF0IHRoZSBzdHViIGhhdmUgZmluaXNoZWQgYmVmb3JlIHdlIHNlbmQgdGhlIFJQQywgc29cbiAgICAvLyB0aGF0IHdlIGtub3cgd2UgaGF2ZSBhIGNvbXBsZXRlIGxpc3Qgb2Ygd2hpY2ggbG9jYWwgZG9jdW1lbnRzIHRoZSBzdHViXG4gICAgLy8gd3JvdGUuXG4gICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgIG1zZzogJ21ldGhvZCcsXG4gICAgICBpZDogbWV0aG9kSWQsXG4gICAgICBtZXRob2Q6IG5hbWUsXG4gICAgICBwYXJhbXM6IGFyZ3NcbiAgICB9O1xuXG4gICAgLy8gSWYgYW4gZXhjZXB0aW9uIG9jY3VycmVkIGluIGEgc3R1YiwgYW5kIHdlJ3JlIGlnbm9yaW5nIGl0XG4gICAgLy8gYmVjYXVzZSB3ZSdyZSBkb2luZyBhbiBSUEMgYW5kIHdhbnQgdG8gdXNlIHdoYXQgdGhlIHNlcnZlclxuICAgIC8vIHJldHVybnMgaW5zdGVhZCwgbG9nIGl0IHNvIHRoZSBkZXZlbG9wZXIga25vd3NcbiAgICAvLyAodW5sZXNzIHRoZXkgZXhwbGljaXRseSBhc2sgdG8gc2VlIHRoZSBlcnJvcikuXG4gICAgLy9cbiAgICAvLyBUZXN0cyBjYW4gc2V0IHRoZSAnX2V4cGVjdGVkQnlUZXN0JyBmbGFnIG9uIGFuIGV4Y2VwdGlvbiBzbyBpdCB3b24ndFxuICAgIC8vIGdvIHRvIGxvZy5cbiAgICBpZiAoZXhjZXB0aW9uKSB7XG4gICAgICBpZiAob3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zKSB7XG4gICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIH0gZWxzZSBpZiAoIWV4Y2VwdGlvbi5fZXhwZWN0ZWRCeVRlc3QpIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICAgICBcIkV4Y2VwdGlvbiB3aGlsZSBzaW11bGF0aW5nIHRoZSBlZmZlY3Qgb2YgaW52b2tpbmcgJ1wiICsgbmFtZSArIFwiJ1wiLFxuICAgICAgICAgIGV4Y2VwdGlvblxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEF0IHRoaXMgcG9pbnQgd2UncmUgZGVmaW5pdGVseSBkb2luZyBhbiBSUEMsIGFuZCB3ZSdyZSBnb2luZyB0b1xuICAgIC8vIHJldHVybiB0aGUgdmFsdWUgb2YgdGhlIFJQQyB0byB0aGUgY2FsbGVyLlxuXG4gICAgLy8gSWYgdGhlIGNhbGxlciBkaWRuJ3QgZ2l2ZSBhIGNhbGxiYWNrLCBkZWNpZGUgd2hhdCB0byBkby5cbiAgICBsZXQgZnV0dXJlO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGlmIChNZXRlb3IuaXNDbGllbnQpIHtcbiAgICAgICAgLy8gT24gdGhlIGNsaWVudCwgd2UgZG9uJ3QgaGF2ZSBmaWJlcnMsIHNvIHdlIGNhbid0IGJsb2NrLiBUaGVcbiAgICAgICAgLy8gb25seSB0aGluZyB3ZSBjYW4gZG8gaXMgdG8gcmV0dXJuIHVuZGVmaW5lZCBhbmQgZGlzY2FyZCB0aGVcbiAgICAgICAgLy8gcmVzdWx0IG9mIHRoZSBSUEMuIElmIGFuIGVycm9yIG9jY3VycmVkIHRoZW4gcHJpbnQgdGhlIGVycm9yXG4gICAgICAgIC8vIHRvIHRoZSBjb25zb2xlLlxuICAgICAgICBjYWxsYmFjayA9IGVyciA9PiB7XG4gICAgICAgICAgZXJyICYmIE1ldGVvci5fZGVidWcoXCJFcnJvciBpbnZva2luZyBNZXRob2QgJ1wiICsgbmFtZSArIFwiJ1wiLCBlcnIpO1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gT24gdGhlIHNlcnZlciwgbWFrZSB0aGUgZnVuY3Rpb24gc3luY2hyb25vdXMuIFRocm93IG9uXG4gICAgICAgIC8vIGVycm9ycywgcmV0dXJuIG9uIHN1Y2Nlc3MuXG4gICAgICAgIGZ1dHVyZSA9IG5ldyBGdXR1cmUoKTtcbiAgICAgICAgY2FsbGJhY2sgPSBmdXR1cmUucmVzb2x2ZXIoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBTZW5kIHRoZSByYW5kb21TZWVkIG9ubHkgaWYgd2UgdXNlZCBpdFxuICAgIGlmIChyYW5kb21TZWVkLnZhbHVlICE9PSBudWxsKSB7XG4gICAgICBtZXNzYWdlLnJhbmRvbVNlZWQgPSByYW5kb21TZWVkLnZhbHVlO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZEludm9rZXIgPSBuZXcgTWV0aG9kSW52b2tlcih7XG4gICAgICBtZXRob2RJZCxcbiAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgIGNvbm5lY3Rpb246IHNlbGYsXG4gICAgICBvblJlc3VsdFJlY2VpdmVkOiBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQsXG4gICAgICB3YWl0OiAhIW9wdGlvbnMud2FpdCxcbiAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICBub1JldHJ5OiAhIW9wdGlvbnMubm9SZXRyeVxuICAgIH0pO1xuXG4gICAgaWYgKG9wdGlvbnMud2FpdCkge1xuICAgICAgLy8gSXQncyBhIHdhaXQgbWV0aG9kISBXYWl0IG1ldGhvZHMgZ28gaW4gdGhlaXIgb3duIGJsb2NrLlxuICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgIHdhaXQ6IHRydWUsXG4gICAgICAgIG1ldGhvZHM6IFttZXRob2RJbnZva2VyXVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBhIHdhaXQgbWV0aG9kLiBTdGFydCBhIG5ldyBibG9jayBpZiB0aGUgcHJldmlvdXMgYmxvY2sgd2FzIGEgd2FpdFxuICAgICAgLy8gYmxvY2ssIGFuZCBhZGQgaXQgdG8gdGhlIGxhc3QgYmxvY2sgb2YgbWV0aG9kcy5cbiAgICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSB8fFxuICAgICAgICAgIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQpIHtcbiAgICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgICAgd2FpdDogZmFsc2UsXG4gICAgICAgICAgbWV0aG9kczogW10sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobWV0aG9kSW52b2tlcik7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgYWRkZWQgaXQgdG8gdGhlIGZpcnN0IGJsb2NrLCBzZW5kIGl0IG91dCBub3cuXG4gICAgaWYgKHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkgbWV0aG9kSW52b2tlci5zZW5kTWVzc2FnZSgpO1xuXG4gICAgLy8gSWYgd2UncmUgdXNpbmcgdGhlIGRlZmF1bHQgY2FsbGJhY2sgb24gdGhlIHNlcnZlcixcbiAgICAvLyBibG9jayB3YWl0aW5nIGZvciB0aGUgcmVzdWx0LlxuICAgIGlmIChmdXR1cmUpIHtcbiAgICAgIHJldHVybiBmdXR1cmUud2FpdCgpO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgPyBzdHViUmV0dXJuVmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cblxuXG4gIF9zdHViQ2FsbChuYW1lLCBhcmdzLCBvcHRpb25zKSB7XG4gICAgLy8gUnVuIHRoZSBzdHViLCBpZiB3ZSBoYXZlIG9uZS4gVGhlIHN0dWIgaXMgc3VwcG9zZWQgdG8gbWFrZSBzb21lXG4gICAgLy8gdGVtcG9yYXJ5IHdyaXRlcyB0byB0aGUgZGF0YWJhc2UgdG8gZ2l2ZSB0aGUgdXNlciBhIHNtb290aCBleHBlcmllbmNlXG4gICAgLy8gdW50aWwgdGhlIGFjdHVhbCByZXN1bHQgb2YgZXhlY3V0aW5nIHRoZSBtZXRob2QgY29tZXMgYmFjayBmcm9tIHRoZVxuICAgIC8vIHNlcnZlciAod2hlcmV1cG9uIHRoZSB0ZW1wb3Jhcnkgd3JpdGVzIHRvIHRoZSBkYXRhYmFzZSB3aWxsIGJlIHJldmVyc2VkXG4gICAgLy8gZHVyaW5nIHRoZSBiZWdpblVwZGF0ZS9lbmRVcGRhdGUgcHJvY2Vzcy4pXG4gICAgLy9cbiAgICAvLyBOb3JtYWxseSwgd2UgaWdub3JlIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHN0dWIgKGV2ZW4gaWYgaXQgaXMgYW5cbiAgICAvLyBleGNlcHRpb24pLCBpbiBmYXZvciBvZiB0aGUgcmVhbCByZXR1cm4gdmFsdWUgZnJvbSB0aGUgc2VydmVyLiBUaGVcbiAgICAvLyBleGNlcHRpb24gaXMgaWYgdGhlICpjYWxsZXIqIGlzIGEgc3R1Yi4gSW4gdGhhdCBjYXNlLCB3ZSdyZSBub3QgZ29pbmdcbiAgICAvLyB0byBkbyBhIFJQQywgc28gd2UgdXNlIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHN0dWIgYXMgb3VyIHJldHVyblxuICAgIC8vIHZhbHVlLlxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGVuY2xvc2luZyA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gICAgY29uc3Qgc3R1YiA9IHNlbGYuX21ldGhvZEhhbmRsZXJzW25hbWVdO1xuICAgIGNvbnN0IGFscmVhZHlJblNpbXVsYXRpb24gPSBlbmNsb3Npbmc/LmlzU2ltdWxhdGlvbjtcbiAgICBjb25zdCBpc0Zyb21DYWxsQXN5bmMgPSBlbmNsb3Npbmc/Ll9pc0Zyb21DYWxsQXN5bmM7XG4gICAgY29uc3QgcmFuZG9tU2VlZCA9IHsgdmFsdWU6IG51bGx9O1xuXG4gICAgY29uc3QgZGVmYXVsdFJldHVybiA9IHtcbiAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sIHJhbmRvbVNlZWQsIGlzRnJvbUNhbGxBc3luY1xuICAgIH07XG4gICAgaWYgKCFzdHViKSB7XG4gICAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIC8vIExhemlseSBnZW5lcmF0ZSBhIHJhbmRvbVNlZWQsIG9ubHkgaWYgaXQgaXMgcmVxdWVzdGVkIGJ5IHRoZSBzdHViLlxuICAgIC8vIFRoZSByYW5kb20gc3RyZWFtcyBvbmx5IGhhdmUgdXRpbGl0eSBpZiB0aGV5J3JlIHVzZWQgb24gYm90aCB0aGUgY2xpZW50XG4gICAgLy8gYW5kIHRoZSBzZXJ2ZXI7IGlmIHRoZSBjbGllbnQgZG9lc24ndCBnZW5lcmF0ZSBhbnkgJ3JhbmRvbScgdmFsdWVzXG4gICAgLy8gdGhlbiB3ZSBkb24ndCBleHBlY3QgdGhlIHNlcnZlciB0byBnZW5lcmF0ZSBhbnkgZWl0aGVyLlxuICAgIC8vIExlc3MgY29tbW9ubHksIHRoZSBzZXJ2ZXIgbWF5IHBlcmZvcm0gZGlmZmVyZW50IGFjdGlvbnMgZnJvbSB0aGUgY2xpZW50LFxuICAgIC8vIGFuZCBtYXkgaW4gZmFjdCBnZW5lcmF0ZSB2YWx1ZXMgd2hlcmUgdGhlIGNsaWVudCBkaWQgbm90LCBidXQgd2UgZG9uJ3RcbiAgICAvLyBoYXZlIGFueSBjbGllbnQtc2lkZSB2YWx1ZXMgdG8gbWF0Y2gsIHNvIGV2ZW4gaGVyZSB3ZSBtYXkgYXMgd2VsbCBqdXN0XG4gICAgLy8gdXNlIGEgcmFuZG9tIHNlZWQgb24gdGhlIHNlcnZlci4gIEluIHRoYXQgY2FzZSwgd2UgZG9uJ3QgcGFzcyB0aGVcbiAgICAvLyByYW5kb21TZWVkIHRvIHNhdmUgYmFuZHdpZHRoLCBhbmQgd2UgZG9uJ3QgZXZlbiBnZW5lcmF0ZSBpdCB0byBzYXZlIGFcbiAgICAvLyBiaXQgb2YgQ1BVIGFuZCB0byBhdm9pZCBjb25zdW1pbmcgZW50cm9weS5cblxuICAgIGNvbnN0IHJhbmRvbVNlZWRHZW5lcmF0b3IgPSAoKSA9PiB7XG4gICAgICBpZiAocmFuZG9tU2VlZC52YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByYW5kb21TZWVkLnZhbHVlID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGVuY2xvc2luZywgbmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmFuZG9tU2VlZC52YWx1ZTtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2V0VXNlcklkID0gdXNlcklkID0+IHtcbiAgICAgIHNlbGYuc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgfTtcblxuICAgIGNvbnN0IGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgaXNTaW11bGF0aW9uOiB0cnVlLFxuICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCgpLFxuICAgICAgaXNGcm9tQ2FsbEFzeW5jOiBvcHRpb25zPy5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICBzZXRVc2VySWQ6IHNldFVzZXJJZCxcbiAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgIHJldHVybiByYW5kb21TZWVkR2VuZXJhdG9yKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgIC8vIHRoYXQgc3R1YnMgY2hlY2soKSB0aGVpciBhcmd1bWVudHMuXG4gICAgY29uc3Qgc3R1Ykludm9jYXRpb24gPSAoKSA9PiB7XG4gICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBCZWNhdXNlIHNhdmVPcmlnaW5hbHMgYW5kIHJldHJpZXZlT3JpZ2luYWxzIGFyZW4ndCByZWVudHJhbnQsXG4gICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlLWNsb25lLCBzbyB0aGF0IHRoZSBzdHViIGNhbid0IGFmZmVjdCBvdXIgY2FsbGVyJ3MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiB0cnVlLCBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiB9O1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICBPYmplY3QudmFsdWVzKHRoaXMuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgIHN0b3JlLnNhdmVPcmlnaW5hbHMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlcyB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgYWxsIGRvY3VtZW50cyBtb2RpZmllZCBieSB0aGUgc3R1YiBmb3JcbiAgLy8gbWV0aG9kICdtZXRob2RJZCcgZnJvbSBhbGwgc3RvcmVzIGFuZCBzYXZlcyB0aGVtIHRvIF9zZXJ2ZXJEb2N1bWVudHMgKGtleWVkXG4gIC8vIGJ5IGRvY3VtZW50KSBhbmQgX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgKGtleWVkIGJ5IG1ldGhvZCBJRCkuXG4gIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIGNvbnN0IGRvY3NXcml0dGVuID0gW107XG5cbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKFtjb2xsZWN0aW9uLCBzdG9yZV0pID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFscyA9IHN0b3JlLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uc2V0RGVmYXVsdChcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpIHtcbiAgICAgICAgICAvLyBXZSdyZSBub3QgdGhlIGZpcnN0IHN0dWIgdG8gd3JpdGUgdGhpcyBkb2MuIEp1c3QgYWRkIG91ciBtZXRob2QgSURcbiAgICAgICAgICAvLyB0byB0aGUgcmVjb3JkLlxuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpcnN0IHN0dWIhIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIGFuZCBvdXIgbWV0aG9kIElELlxuICAgICAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IGRvYztcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MgPSBbXTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoISBpc0VtcHR5KGRvY3NXcml0dGVuKSkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gPSBkb2NzV3JpdHRlbjtcbiAgICB9XG4gIH1cblxuICAvLyBUaGlzIGlzIHZlcnkgbXVjaCBhIHByaXZhdGUgZnVuY3Rpb24gd2UgdXNlIHRvIG1ha2UgdGhlIHRlc3RzXG4gIC8vIHRha2UgdXAgZmV3ZXIgc2VydmVyIHJlc291cmNlcyBhZnRlciB0aGV5IGNvbXBsZXRlLlxuICBfdW5zdWJzY3JpYmVBbGwoKSB7XG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChzdWIpID0+IHtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIFdlIGRldGVjdGVkIHZpYSBERFAtbGV2ZWwgaGVhcnRiZWF0cyB0aGF0IHdlJ3ZlIGxvc3QgdGhlXG4gIC8vIGNvbm5lY3Rpb24uICBVbmxpa2UgYGRpc2Nvbm5lY3RgIG9yIGBjbG9zZWAsIGEgbG9zdCBjb25uZWN0aW9uXG4gIC8vIHdpbGwgYmUgYXV0b21hdGljYWxseSByZXRyaWVkLlxuICBfbG9zdENvbm5lY3Rpb24oZXJyb3IpIHtcbiAgICB0aGlzLl9zdHJlYW0uX2xvc3RDb25uZWN0aW9uKGVycm9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdGF0dXNcbiAgICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IGNvbm5lY3Rpb24gc3RhdHVzLiBBIHJlYWN0aXZlIGRhdGEgc291cmNlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBzdGF0dXMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uc3RhdHVzKC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZvcmNlIGFuIGltbWVkaWF0ZSByZWNvbm5lY3Rpb24gYXR0ZW1wdCBpZiB0aGUgY2xpZW50IGlzIG5vdCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlci5cblxuICBUaGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcgaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IucmVjb25uZWN0XG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHJlY29ubmVjdCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuZGlzY29ubmVjdFxuICAgKiBAc3VtbWFyeSBEaXNjb25uZWN0IHRoZSBjbGllbnQgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBkaXNjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlIH0pO1xuICB9XG5cbiAgLy8vXG4gIC8vLyBSZWFjdGl2ZSB1c2VyIHN5c3RlbVxuICAvLy9cbiAgdXNlcklkKCkge1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmRlcGVuZCgpO1xuICAgIHJldHVybiB0aGlzLl91c2VySWQ7XG4gIH1cblxuICBzZXRVc2VySWQodXNlcklkKSB7XG4gICAgLy8gQXZvaWQgaW52YWxpZGF0aW5nIGRlcGVuZGVudHMgaWYgc2V0VXNlcklkIGlzIGNhbGxlZCB3aXRoIGN1cnJlbnQgdmFsdWUuXG4gICAgaWYgKHRoaXMuX3VzZXJJZCA9PT0gdXNlcklkKSByZXR1cm47XG4gICAgdGhpcy5fdXNlcklkID0gdXNlcklkO1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmNoYW5nZWQoKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgaW4gYSBzdGF0ZSBhZnRlciByZWNvbm5lY3Qgb2Ygd2FpdGluZyBmb3Igc3VicyB0byBiZVxuICAvLyByZXZpdmVkIG9yIGVhcmx5IG1ldGhvZHMgdG8gZmluaXNoIHRoZWlyIGRhdGEsIG9yIHdlIGFyZSB3YWl0aW5nIGZvciBhXG4gIC8vIFwid2FpdFwiIG1ldGhvZCB0byBmaW5pc2guXG4gIF93YWl0aW5nRm9yUXVpZXNjZW5jZSgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgISBpc0VtcHR5KHRoaXMuX3N1YnNCZWluZ1Jldml2ZWQpIHx8XG4gICAgICAhIGlzRW1wdHkodGhpcy5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSlcbiAgICApO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIGFueSBtZXRob2Qgd2hvc2UgbWVzc2FnZSBoYXMgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIgaGFzXG4gIC8vIG5vdCB5ZXQgaW52b2tlZCBpdHMgdXNlciBjYWxsYmFjay5cbiAgX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpIHtcbiAgICBjb25zdCBpbnZva2VycyA9IHRoaXMuX21ldGhvZEludm9rZXJzO1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKGludm9rZXJzKS5zb21lKChpbnZva2VyKSA9PiAhIWludm9rZXIuc2VudE1lc3NhZ2UpO1xuICB9XG5cbiAgX2xpdmVkYXRhX2Nvbm5lY3RlZChtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl92ZXJzaW9uICE9PSAncHJlMScgJiYgc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwgIT09IDApIHtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG5ldyBERFBDb21tb24uSGVhcnRiZWF0KHtcbiAgICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IHNlbGYuX2hlYXJ0YmVhdEludGVydmFsLFxuICAgICAgICBoZWFydGJlYXRUaW1lb3V0OiBzZWxmLl9oZWFydGJlYXRUaW1lb3V0LFxuICAgICAgICBvblRpbWVvdXQoKSB7XG4gICAgICAgICAgc2VsZi5fbG9zdENvbm5lY3Rpb24oXG4gICAgICAgICAgICBuZXcgRERQLkNvbm5lY3Rpb25FcnJvcignRERQIGhlYXJ0YmVhdCB0aW1lZCBvdXQnKVxuICAgICAgICAgICk7XG4gICAgICAgIH0sXG4gICAgICAgIHNlbmRQaW5nKCkge1xuICAgICAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdwaW5nJyB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzZWxmLl9oZWFydGJlYXQuc3RhcnQoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgcmVjb25uZWN0LCB3ZSdsbCBoYXZlIHRvIHJlc2V0IGFsbCBzdG9yZXMuXG4gICAgaWYgKHNlbGYuX2xhc3RTZXNzaW9uSWQpIHNlbGYuX3Jlc2V0U3RvcmVzID0gdHJ1ZTtcblxuICAgIGxldCByZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uO1xuICAgIGlmICh0eXBlb2YgbXNnLnNlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uID0gc2VsZi5fbGFzdFNlc3Npb25JZCA9PT0gbXNnLnNlc3Npb247XG4gICAgICBzZWxmLl9sYXN0U2Vzc2lvbklkID0gbXNnLnNlc3Npb247XG4gICAgfVxuXG4gICAgaWYgKHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24pIHtcbiAgICAgIC8vIFN1Y2Nlc3NmdWwgcmVjb25uZWN0aW9uIC0tIHBpY2sgdXAgd2hlcmUgd2UgbGVmdCBvZmYuICBOb3RlIHRoYXQgcmlnaHRcbiAgICAgIC8vIG5vdywgdGhpcyBuZXZlciBoYXBwZW5zOiB0aGUgc2VydmVyIG5ldmVyIGNvbm5lY3RzIHVzIHRvIGEgcHJldmlvdXNcbiAgICAgIC8vIHNlc3Npb24sIGJlY2F1c2UgRERQIGRvZXNuJ3QgcHJvdmlkZSBlbm91Z2ggZGF0YSBmb3IgdGhlIHNlcnZlciB0byBrbm93XG4gICAgICAvLyB3aGF0IG1lc3NhZ2VzIHRoZSBjbGllbnQgaGFzIHByb2Nlc3NlZC4gV2UgbmVlZCB0byBpbXByb3ZlIEREUCB0byBtYWtlXG4gICAgICAvLyB0aGlzIHBvc3NpYmxlLCBhdCB3aGljaCBwb2ludCB3ZSdsbCBwcm9iYWJseSBuZWVkIG1vcmUgY29kZSBoZXJlLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNlcnZlciBkb2Vzbid0IGhhdmUgb3VyIGRhdGEgYW55IG1vcmUuIFJlLXN5bmMgYSBuZXcgc2Vzc2lvbi5cblxuICAgIC8vIEZvcmdldCBhYm91dCBtZXNzYWdlcyB3ZSB3ZXJlIGJ1ZmZlcmluZyBmb3IgdW5rbm93biBjb2xsZWN0aW9ucy4gVGhleSdsbFxuICAgIC8vIGJlIHJlc2VudCBpZiBzdGlsbCByZWxldmFudC5cbiAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGUgZWZmZWN0cyBvZiBzdHVicy4gV2UnbGwgYmUgcmVzZXR0aW5nIGFsbCBjb2xsZWN0aW9uc1xuICAgICAgLy8gYW55d2F5LlxuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIENsZWFyIF9hZnRlclVwZGF0ZUNhbGxiYWNrcy5cbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuXG4gICAgLy8gTWFyayBhbGwgbmFtZWQgc3Vic2NyaXB0aW9ucyB3aGljaCBhcmUgcmVhZHkgKGllLCB3ZSBhbHJlYWR5IGNhbGxlZCB0aGVcbiAgICAvLyByZWFkeSBjYWxsYmFjaykgYXMgbmVlZGluZyB0byBiZSByZXZpdmVkLlxuICAgIC8vIFhYWCBXZSBzaG91bGQgYWxzbyBibG9jayByZWNvbm5lY3QgcXVpZXNjZW5jZSB1bnRpbCB1bm5hbWVkIHN1YnNjcmlwdGlvbnNcbiAgICAvLyAgICAgKGVnLCBhdXRvcHVibGlzaCkgYXJlIGRvbmUgcmUtcHVibGlzaGluZyB0byBhdm9pZCBmbGlja2VyIVxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgaWYgKHN1Yi5yZWFkeSkge1xuICAgICAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW2lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBcnJhbmdlIGZvciBcImhhbGYtZmluaXNoZWRcIiBtZXRob2RzIHRvIGhhdmUgdGhlaXIgY2FsbGJhY2tzIHJ1biwgYW5kXG4gICAgLy8gdHJhY2sgbWV0aG9kcyB0aGF0IHdlcmUgc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gc28gdGhhdCB3ZSBkb24ndFxuICAgIC8vIHF1aWVzY2UgdW50aWwgdGhleSBhcmUgYWxsIGRvbmUuXG4gICAgLy9cbiAgICAvLyBTdGFydCBieSBjbGVhcmluZyBfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZTogbWV0aG9kcyBzZW50IGJlZm9yZVxuICAgIC8vIHJlY29ubmVjdCBkb24ndCBtYXR0ZXIsIGFuZCBhbnkgXCJ3YWl0XCIgbWV0aG9kcyBzZW50IG9uIHRoZSBuZXcgY29ubmVjdGlvblxuICAgIC8vIHRoYXQgd2UgZHJvcCBoZXJlIHdpbGwgYmUgcmVzdG9yZWQgYnkgdGhlIGxvb3AgYmVsb3cuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICBjb25zdCBpbnZva2VycyA9IHNlbGYuX21ldGhvZEludm9rZXJzO1xuICAgICAga2V5cyhpbnZva2VycykuZm9yRWFjaChpZCA9PiB7XG4gICAgICAgIGNvbnN0IGludm9rZXIgPSBpbnZva2Vyc1tpZF07XG4gICAgICAgIGlmIChpbnZva2VyLmdvdFJlc3VsdCgpKSB7XG4gICAgICAgICAgLy8gVGhpcyBtZXRob2QgYWxyZWFkeSBnb3QgaXRzIHJlc3VsdCwgYnV0IGl0IGRpZG4ndCBjYWxsIGl0cyBjYWxsYmFja1xuICAgICAgICAgIC8vIGJlY2F1c2UgaXRzIGRhdGEgZGlkbid0IGJlY29tZSB2aXNpYmxlLiBXZSBkaWQgbm90IHJlc2VuZCB0aGVcbiAgICAgICAgICAvLyBtZXRob2QgUlBDLiBXZSdsbCBjYWxsIGl0cyBjYWxsYmFjayB3aGVuIHdlIGdldCBhIGZ1bGwgcXVpZXNjZSxcbiAgICAgICAgICAvLyBzaW5jZSB0aGF0J3MgYXMgY2xvc2UgYXMgd2UnbGwgZ2V0IHRvIFwiZGF0YSBtdXN0IGJlIHZpc2libGVcIi5cbiAgICAgICAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcy5wdXNoKFxuICAgICAgICAgICAgKC4uLmFyZ3MpID0+IGludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKGludm9rZXIuc2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICAvLyBUaGlzIG1ldGhvZCBoYXMgYmVlbiBzZW50IG9uIHRoaXMgY29ubmVjdGlvbiAobWF5YmUgYXMgYSByZXNlbmRcbiAgICAgICAgICAvLyBmcm9tIHRoZSBsYXN0IGNvbm5lY3Rpb24sIG1heWJlIGZyb20gb25SZWNvbm5lY3QsIG1heWJlIGp1c3QgdmVyeVxuICAgICAgICAgIC8vIHF1aWNrbHkgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIGNvbm5lY3RlZCBtZXNzYWdlKS5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZG8gYW55dGhpbmcgc3BlY2lhbCB0byBlbnN1cmUgaXRzIGNhbGxiYWNrcyBnZXRcbiAgICAgICAgICAvLyBjYWxsZWQsIGJ1dCB3ZSdsbCBjb3VudCBpdCBhcyBhIG1ldGhvZCB3aGljaCBpcyBwcmV2ZW50aW5nXG4gICAgICAgICAgLy8gcmVjb25uZWN0IHF1aWVzY2VuY2UuIChlZywgaXQgbWlnaHQgYmUgYSBsb2dpbiBtZXRob2QgdGhhdCB3YXMgcnVuXG4gICAgICAgICAgLy8gZnJvbSBvblJlY29ubmVjdCwgYW5kIHdlIGRvbid0IHdhbnQgdG8gc2VlIGZsaWNrZXIgYnkgc2VlaW5nIGFcbiAgICAgICAgICAvLyBsb2dnZWQtb3V0IHN0YXRlLilcbiAgICAgICAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW2ludm9rZXIubWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuXG4gICAgLy8gSWYgd2UncmUgbm90IHdhaXRpbmcgb24gYW55IG1ldGhvZHMgb3Igc3Vicywgd2UgY2FuIHJlc2V0IHRoZSBzdG9yZXMgYW5kXG4gICAgLy8gY2FsbCB0aGUgY2FsbGJhY2tzIGltbWVkaWF0ZWx5LlxuICAgIGlmICghIHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgICAgICBzdG9yZS5iZWdpblVwZGF0ZSgwLCB0cnVlKTtcbiAgICAgICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3QgbWVzc2FnZVR5cGUgPSBtc2cubXNnO1xuXG4gICAgLy8gbXNnIGlzIG9uZSBvZiBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ11cbiAgICBpZiAobWVzc2FnZVR5cGUgPT09ICdhZGRlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfYWRkZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAnY2hhbmdlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdyZW1vdmVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICd1cGRhdGVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc191cGRhdGVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ25vc3ViJykge1xuICAgICAgLy8gaWdub3JlIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIGRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfbGl2ZWRhdGFfZGF0YShtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlLnB1c2gobXNnKTtcblxuICAgICAgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgICAgZGVsZXRlIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbbXNnLmlkXTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1zZy5zdWJzKSB7XG4gICAgICAgIG1zZy5zdWJzLmZvckVhY2goc3ViSWQgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW3N1YklkXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cubWV0aG9kcykge1xuICAgICAgICBtc2cubWV0aG9kcy5mb3JFYWNoKG1ldGhvZElkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVttZXRob2RJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIE5vIG1ldGhvZHMgb3Igc3VicyBhcmUgYmxvY2tpbmcgcXVpZXNjZW5jZSFcbiAgICAgIC8vIFdlJ2xsIG5vdyBwcm9jZXNzIGFuZCBhbGwgb2Ygb3VyIGJ1ZmZlcmVkIG1lc3NhZ2VzLCByZXNldCBhbGwgc3RvcmVzLFxuICAgICAgLy8gYW5kIGFwcGx5IHRoZW0gYWxsIGF0IG9uY2UuXG5cbiAgICAgIGNvbnN0IGJ1ZmZlcmVkTWVzc2FnZXMgPSBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlO1xuICAgICAgT2JqZWN0LnZhbHVlcyhidWZmZXJlZE1lc3NhZ2VzKS5mb3JFYWNoKGJ1ZmZlcmVkTWVzc2FnZSA9PiB7XG4gICAgICAgIHNlbGYuX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShcbiAgICAgICAgICBidWZmZXJlZE1lc3NhZ2UsXG4gICAgICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHJvY2Vzc09uZURhdGFNZXNzYWdlKG1zZywgc2VsZi5fYnVmZmVyZWRXcml0ZXMpO1xuICAgIH1cblxuICAgIC8vIEltbWVkaWF0ZWx5IGZsdXNoIHdyaXRlcyB3aGVuOlxuICAgIC8vICAxLiBCdWZmZXJpbmcgaXMgZGlzYWJsZWQuIE9yO1xuICAgIC8vICAyLiBhbnkgbm9uLShhZGRlZC9jaGFuZ2VkL3JlbW92ZWQpIG1lc3NhZ2UgYXJyaXZlcy5cbiAgICBjb25zdCBzdGFuZGFyZFdyaXRlID1cbiAgICAgIG1zZy5tc2cgPT09IFwiYWRkZWRcIiB8fFxuICAgICAgbXNnLm1zZyA9PT0gXCJjaGFuZ2VkXCIgfHxcbiAgICAgIG1zZy5tc2cgPT09IFwicmVtb3ZlZFwiO1xuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPT09IDAgfHwgISBzdGFuZGFyZFdyaXRlKSB7XG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9PT0gbnVsbCkge1xuICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID1cbiAgICAgICAgbmV3IERhdGUoKS52YWx1ZU9mKCkgKyBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZTtcbiAgICB9IGVsc2UgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA8IG5ldyBEYXRlKCkudmFsdWVPZigpKSB7XG4gICAgICBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICB9XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSA9IHNldFRpbWVvdXQoXG4gICAgICBzZWxmLl9fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWxcbiAgICApO1xuICB9XG5cbiAgX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpIHtcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKTtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuICAgIH1cblxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9IG51bGw7XG4gICAgLy8gV2UgbmVlZCB0byBjbGVhciB0aGUgYnVmZmVyIGJlZm9yZSBwYXNzaW5nIGl0IHRvXG4gICAgLy8gIHBlcmZvcm1Xcml0ZXMuIEFzIHRoZXJlJ3Mgbm8gZ3VhcmFudGVlIHRoYXQgaXRcbiAgICAvLyAgd2lsbCBleGl0IGNsZWFubHkuXG4gICAgY29uc3Qgd3JpdGVzID0gc2VsZi5fYnVmZmVyZWRXcml0ZXM7XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHNlbGYuX3BlcmZvcm1Xcml0ZXMod3JpdGVzKTtcbiAgfVxuXG4gIF9wZXJmb3JtV3JpdGVzKHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3JlcyB8fCAhIGlzRW1wdHkodXBkYXRlcykpIHtcbiAgICAgIC8vIEJlZ2luIGEgdHJhbnNhY3Rpb25hbCB1cGRhdGUgb2YgZWFjaCBzdG9yZS5cblxuICAgICAgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKChbc3RvcmVOYW1lLCBzdG9yZV0pID0+IHtcbiAgICAgICAgc3RvcmUuYmVnaW5VcGRhdGUoXG4gICAgICAgICAgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKVxuICAgICAgICAgICAgPyB1cGRhdGVzW3N0b3JlTmFtZV0ubGVuZ3RoXG4gICAgICAgICAgICA6IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICBPYmplY3QuZW50cmllcyh1cGRhdGVzKS5mb3JFYWNoKChbc3RvcmVOYW1lLCB1cGRhdGVNZXNzYWdlc10pID0+IHtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSBzZWxmLl9zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgaWYgKHN0b3JlKSB7XG4gICAgICAgICAgdXBkYXRlTWVzc2FnZXMuZm9yRWFjaCh1cGRhdGVNZXNzYWdlID0+IHtcbiAgICAgICAgICAgIHN0b3JlLnVwZGF0ZSh1cGRhdGVNZXNzYWdlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBOb2JvZHkncyBsaXN0ZW5pbmcgZm9yIHRoaXMgZGF0YS4gUXVldWUgaXQgdXAgdW50aWxcbiAgICAgICAgICAvLyBzb21lb25lIHdhbnRzIGl0LlxuICAgICAgICAgIC8vIFhYWCBtZW1vcnkgdXNlIHdpbGwgZ3JvdyB3aXRob3V0IGJvdW5kIGlmIHlvdSBmb3JnZXQgdG9cbiAgICAgICAgICAvLyBjcmVhdGUgYSBjb2xsZWN0aW9uIG9yIGp1c3QgZG9uJ3QgY2FyZSBhYm91dCBpdC4uLiBnb2luZ1xuICAgICAgICAgIC8vIHRvIGhhdmUgdG8gZG8gc29tZXRoaW5nIGFib3V0IHRoYXQuXG4gICAgICAgICAgY29uc3QgdXBkYXRlcyA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzO1xuXG4gICAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdLnB1c2goLi4udXBkYXRlTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gRW5kIHVwZGF0ZSB0cmFuc2FjdGlvbi5cbiAgICAgIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKS5mb3JFYWNoKChzdG9yZSkgPT4ge1xuICAgICAgICBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gIH1cblxuICAvLyBDYWxsIGFueSBjYWxsYmFja3MgZGVmZXJyZWQgd2l0aCBfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIHdob3NlXG4gIC8vIHJlbGV2YW50IGRvY3MgaGF2ZSBiZWVuIGZsdXNoZWQsIGFzIHdlbGwgYXMgZGF0YVZpc2libGUgY2FsbGJhY2tzIGF0XG4gIC8vIHJlY29ubmVjdC1xdWllc2NlbmNlIHRpbWUuXG4gIF9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBjYWxsYmFja3MgPSBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcztcbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICBjKCk7XG4gICAgfSk7XG4gIH1cblxuICBfcHVzaFVwZGF0ZSh1cGRhdGVzLCBjb2xsZWN0aW9uLCBtc2cpIHtcbiAgICBpZiAoISBoYXNPd24uY2FsbCh1cGRhdGVzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgdXBkYXRlc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICB1cGRhdGVzW2NvbGxlY3Rpb25dLnB1c2gobXNnKTtcbiAgfVxuXG4gIF9nZXRTZXJ2ZXJEb2MoY29sbGVjdGlvbiwgaWQpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc2VydmVyRG9jc0ZvckNvbGxlY3Rpb24gPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl07XG4gICAgcmV0dXJuIHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uLmdldChpZCkgfHwgbnVsbDtcbiAgfVxuXG4gIF9wcm9jZXNzX2FkZGVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGlkID0gTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCk7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBpZCk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgLy8gU29tZSBvdXRzdGFuZGluZyBzdHViIHdyb3RlIGhlcmUuXG4gICAgICBjb25zdCBpc0V4aXN0aW5nID0gc2VydmVyRG9jLmRvY3VtZW50ICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IG1zZy5maWVsZHMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudC5faWQgPSBpZDtcblxuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIC8vIER1cmluZyByZWNvbm5lY3QgdGhlIHNlcnZlciBpcyBzZW5kaW5nIGFkZHMgZm9yIGV4aXN0aW5nIGlkcy5cbiAgICAgICAgLy8gQWx3YXlzIHB1c2ggYW4gdXBkYXRlIHNvIHRoYXQgZG9jdW1lbnQgc3RheXMgaW4gdGhlIHN0b3JlIGFmdGVyXG4gICAgICAgIC8vIHJlc2V0LiBVc2UgY3VycmVudCB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBmb3IgdGhpcyB1cGRhdGUsIHNvXG4gICAgICAgIC8vIHRoYXQgc3R1Yi13cml0dGVuIHZhbHVlcyBhcmUgcHJlc2VydmVkLlxuICAgICAgICBjb25zdCBjdXJyZW50RG9jID0gc2VsZi5fc3RvcmVzW21zZy5jb2xsZWN0aW9uXS5nZXREb2MobXNnLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnREb2MgIT09IHVuZGVmaW5lZCkgbXNnLmZpZWxkcyA9IGN1cnJlbnREb2M7XG5cbiAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFeGlzdGluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGFkZCBmb3IgZXhpc3RpbmcgaWQ6ICcgKyBtc2cuaWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX2NoYW5nZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBNb25nb0lELmlkUGFyc2UobXNnLmlkKSk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGNoYW5nZWQgZm9yIG5vbmV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoc2VydmVyRG9jLmRvY3VtZW50LCBtc2cuZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCkpO1xuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIC8vIFNvbWUgb3V0c3RhbmRpbmcgc3R1YiB3cm90ZSBoZXJlLlxuICAgICAgaWYgKHNlcnZlckRvYy5kb2N1bWVudCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IHJlbW92ZWQgZm9yIG5vbmV4aXN0aW5nIGlkOicgKyBtc2cuaWQpO1xuICAgICAgc2VydmVyRG9jLmRvY3VtZW50ID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCB7XG4gICAgICAgIG1zZzogJ3JlbW92ZWQnLFxuICAgICAgICBjb2xsZWN0aW9uOiBtc2cuY29sbGVjdGlvbixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfdXBkYXRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBQcm9jZXNzIFwibWV0aG9kIGRvbmVcIiBtZXNzYWdlcy5cblxuICAgIG1zZy5tZXRob2RzLmZvckVhY2goKG1ldGhvZElkKSA9PiB7XG4gICAgICBjb25zdCBkb2NzID0gc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gfHwge307XG4gICAgICBPYmplY3QudmFsdWVzKGRvY3MpLmZvckVhY2goKHdyaXR0ZW4pID0+IHtcbiAgICAgICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKHdyaXR0ZW4uY29sbGVjdGlvbiwgd3JpdHRlbi5pZCk7XG4gICAgICAgIGlmICghIHNlcnZlckRvYykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTG9zdCBzZXJ2ZXJEb2MgZm9yICcgKyBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdEb2MgJyArXG4gICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHdyaXR0ZW4pICtcbiAgICAgICAgICAgICAgJyBub3Qgd3JpdHRlbiBieSAgbWV0aG9kICcgK1xuICAgICAgICAgICAgICBtZXRob2RJZFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF07XG4gICAgICAgIGlmIChpc0VtcHR5KHNlcnZlckRvYy53cml0dGVuQnlTdHVicykpIHtcbiAgICAgICAgICAvLyBBbGwgbWV0aG9kcyB3aG9zZSBzdHVicyB3cm90ZSB0aGlzIG1ldGhvZCBoYXZlIGNvbXBsZXRlZCEgV2UgY2FuXG4gICAgICAgICAgLy8gbm93IGNvcHkgdGhlIHNhdmVkIGRvY3VtZW50IHRvIHRoZSBkYXRhYmFzZSAocmV2ZXJ0aW5nIHRoZSBzdHViJ3NcbiAgICAgICAgICAvLyBjaGFuZ2UgaWYgdGhlIHNlcnZlciBkaWQgbm90IHdyaXRlIHRvIHRoaXMgb2JqZWN0LCBvciBhcHBseWluZyB0aGVcbiAgICAgICAgICAvLyBzZXJ2ZXIncyB3cml0ZXMgaWYgaXQgZGlkKS5cblxuICAgICAgICAgIC8vIFRoaXMgaXMgYSBmYWtlIGRkcCAncmVwbGFjZScgbWVzc2FnZS4gIEl0J3MganVzdCBmb3IgdGFsa2luZ1xuICAgICAgICAgIC8vIGJldHdlZW4gbGl2ZWRhdGEgY29ubmVjdGlvbnMgYW5kIG1pbmltb25nby4gIChXZSBoYXZlIHRvIHN0cmluZ2lmeVxuICAgICAgICAgIC8vIHRoZSBJRCBiZWNhdXNlIGl0J3Mgc3VwcG9zZWQgdG8gbG9vayBsaWtlIGEgd2lyZSBtZXNzYWdlLilcbiAgICAgICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIHdyaXR0ZW4uY29sbGVjdGlvbiwge1xuICAgICAgICAgICAgbXNnOiAncmVwbGFjZScsXG4gICAgICAgICAgICBpZDogTW9uZ29JRC5pZFN0cmluZ2lmeSh3cml0dGVuLmlkKSxcbiAgICAgICAgICAgIHJlcGxhY2U6IHNlcnZlckRvYy5kb2N1bWVudFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIC8vIENhbGwgYWxsIGZsdXNoIGNhbGxiYWNrcy5cblxuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICAgICAgICBjKCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBEZWxldGUgdGhpcyBjb21wbGV0ZWQgc2VydmVyRG9jdW1lbnQuIERvbid0IGJvdGhlciB0byBHQyBlbXB0eVxuICAgICAgICAgIC8vIElkTWFwcyBpbnNpZGUgc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBzaW5jZSB0aGVyZSBwcm9iYWJseSBhcmVuJ3RcbiAgICAgICAgICAvLyBtYW55IGNvbGxlY3Rpb25zIGFuZCB0aGV5J2xsIGJlIHdyaXR0ZW4gcmVwZWF0ZWRseS5cbiAgICAgICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbd3JpdHRlbi5jb2xsZWN0aW9uXS5yZW1vdmUod3JpdHRlbi5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdO1xuXG4gICAgICAvLyBXZSB3YW50IHRvIGNhbGwgdGhlIGRhdGEtd3JpdHRlbiBjYWxsYmFjaywgYnV0IHdlIGNhbid0IGRvIHNvIHVudGlsIGFsbFxuICAgICAgLy8gY3VycmVudGx5IGJ1ZmZlcmVkIG1lc3NhZ2VzIGFyZSBmbHVzaGVkLlxuICAgICAgY29uc3QgY2FsbGJhY2tJbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgaWYgKCEgY2FsbGJhY2tJbnZva2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gY2FsbGJhY2sgaW52b2tlciBmb3IgbWV0aG9kICcgKyBtZXRob2RJZCk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChcbiAgICAgICAgKC4uLmFyZ3MpID0+IGNhbGxiYWNrSW52b2tlci5kYXRhVmlzaWJsZSguLi5hcmdzKVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIFByb2Nlc3MgXCJzdWIgcmVhZHlcIiBtZXNzYWdlcy4gXCJzdWIgcmVhZHlcIiBtZXNzYWdlcyBkb24ndCB0YWtlIGVmZmVjdFxuICAgIC8vIHVudGlsIGFsbCBjdXJyZW50IHNlcnZlciBkb2N1bWVudHMgaGF2ZSBiZWVuIGZsdXNoZWQgdG8gdGhlIGxvY2FsXG4gICAgLy8gZGF0YWJhc2UuIFdlIGNhbiB1c2UgYSB3cml0ZSBmZW5jZSB0byBpbXBsZW1lbnQgdGhpcy5cblxuICAgIG1zZy5zdWJzLmZvckVhY2goKHN1YklkKSA9PiB7XG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdWJSZWNvcmQgPSBzZWxmLl9zdWJzY3JpcHRpb25zW3N1YklkXTtcbiAgICAgICAgLy8gRGlkIHdlIGFscmVhZHkgdW5zdWJzY3JpYmU/XG4gICAgICAgIGlmICghc3ViUmVjb3JkKSByZXR1cm47XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHJlY2VpdmUgYSByZWFkeSBtZXNzYWdlPyAoT29wcyEpXG4gICAgICAgIGlmIChzdWJSZWNvcmQucmVhZHkpIHJldHVybjtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2sgJiYgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2soKTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5RGVwcy5jaGFuZ2VkKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEVuc3VyZXMgdGhhdCBcImZcIiB3aWxsIGJlIGNhbGxlZCBhZnRlciBhbGwgZG9jdW1lbnRzIGN1cnJlbnRseSBpblxuICAvLyBfc2VydmVyRG9jdW1lbnRzIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS4gZiB3aWxsIG5vdCBiZSBjYWxsZWRcbiAgLy8gaWYgdGhlIGNvbm5lY3Rpb24gaXMgbG9zdCBiZWZvcmUgdGhlbiFcbiAgX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChmKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgcnVuRkFmdGVyVXBkYXRlcyA9ICgpID0+IHtcbiAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgfTtcbiAgICBsZXQgdW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPSAwO1xuICAgIGNvbnN0IG9uU2VydmVyRG9jRmx1c2ggPSAoKSA9PiB7XG4gICAgICAtLXVuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAgIC8vIFRoaXMgd2FzIHRoZSBsYXN0IGRvYyB0byBmbHVzaCEgQXJyYW5nZSB0byBydW4gZiBhZnRlciB0aGUgdXBkYXRlc1xuICAgICAgICAvLyBoYXZlIGJlZW4gYXBwbGllZC5cbiAgICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBPYmplY3QudmFsdWVzKHNlbGYuX3NlcnZlckRvY3VtZW50cykuZm9yRWFjaCgoc2VydmVyRG9jdW1lbnRzKSA9PiB7XG4gICAgICBzZXJ2ZXJEb2N1bWVudHMuZm9yRWFjaCgoc2VydmVyRG9jKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlID1cbiAgICAgICAgICBrZXlzKHNlcnZlckRvYy53cml0dGVuQnlTdHVicykuc29tZShtZXRob2RJZCA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgICAgICAgcmV0dXJuIGludm9rZXIgJiYgaW52b2tlci5zZW50TWVzc2FnZTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICBpZiAod3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICArK3VuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5wdXNoKG9uU2VydmVyRG9jRmx1c2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAodW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPT09IDApIHtcbiAgICAgIC8vIFRoZXJlIGFyZW4ndCBhbnkgYnVmZmVyZWQgZG9jcyAtLS0gd2UgY2FuIGNhbGwgZiBhcyBzb29uIGFzIHRoZSBjdXJyZW50XG4gICAgICAvLyByb3VuZCBvZiB1cGRhdGVzIGlzIGFwcGxpZWQhXG4gICAgICBydW5GQWZ0ZXJVcGRhdGVzKCk7XG4gICAgfVxuICB9XG5cbiAgX2xpdmVkYXRhX25vc3ViKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRmlyc3QgcGFzcyBpdCB0aHJvdWdoIF9saXZlZGF0YV9kYXRhLCB3aGljaCBvbmx5IHVzZXMgaXQgdG8gaGVscCBnZXRcbiAgICAvLyB0b3dhcmRzIHF1aWVzY2VuY2UuXG4gICAgc2VsZi5fbGl2ZWRhdGFfZGF0YShtc2cpO1xuXG4gICAgLy8gRG8gdGhlIHJlc3Qgb2Ygb3VyIHByb2Nlc3NpbmcgaW1tZWRpYXRlbHksIHdpdGggbm9cbiAgICAvLyBidWZmZXJpbmctdW50aWwtcXVpZXNjZW5jZS5cblxuICAgIC8vIHdlIHdlcmVuJ3Qgc3ViYmVkIGFueXdheSwgb3Igd2UgaW5pdGlhdGVkIHRoZSB1bnN1Yi5cbiAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBtc2cuaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBjb25zdCBlcnJvckNhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLmVycm9yQ2FsbGJhY2s7XG4gICAgY29uc3Qgc3RvcENhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLnN0b3BDYWxsYmFjaztcblxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5yZW1vdmUoKTtcblxuICAgIGNvbnN0IG1ldGVvckVycm9yRnJvbU1zZyA9IG1zZ0FyZyA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBtc2dBcmcgJiZcbiAgICAgICAgbXNnQXJnLmVycm9yICYmXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmVycm9yLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5yZWFzb24sXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmRldGFpbHNcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBpZiAoZXJyb3JDYWxsYmFjayAmJiBtc2cuZXJyb3IpIHtcbiAgICAgIGVycm9yQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cblxuICAgIGlmIChzdG9wQ2FsbGJhY2spIHtcbiAgICAgIHN0b3BDYWxsYmFjayhtZXRlb3JFcnJvckZyb21Nc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgX2xpdmVkYXRhX3Jlc3VsdChtc2cpIHtcbiAgICAvLyBpZCwgcmVzdWx0IG9yIGVycm9yLiBlcnJvciBoYXMgZXJyb3IgKGNvZGUpLCByZWFzb24sIGRldGFpbHNcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gTGV0cyBtYWtlIHN1cmUgdGhlcmUgYXJlIG5vIGJ1ZmZlcmVkIHdyaXRlcyBiZWZvcmUgcmV0dXJuaW5nIHJlc3VsdC5cbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX2J1ZmZlcmVkV3JpdGVzKSkge1xuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgIH1cblxuICAgIC8vIGZpbmQgdGhlIG91dHN0YW5kaW5nIHJlcXVlc3RcbiAgICAvLyBzaG91bGQgYmUgTygxKSBpbiBuZWFybHkgYWxsIHJlYWxpc3RpYyB1c2UgY2FzZXNcbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ1JlY2VpdmVkIG1ldGhvZCByZXN1bHQgYnV0IG5vIG1ldGhvZHMgb3V0c3RhbmRpbmcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudE1ldGhvZEJsb2NrID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcztcbiAgICBsZXQgaTtcbiAgICBjb25zdCBtID0gY3VycmVudE1ldGhvZEJsb2NrLmZpbmQoKG1ldGhvZCwgaWR4KSA9PiB7XG4gICAgICBjb25zdCBmb3VuZCA9IG1ldGhvZC5tZXRob2RJZCA9PT0gbXNnLmlkO1xuICAgICAgaWYgKGZvdW5kKSBpID0gaWR4O1xuICAgICAgcmV0dXJuIGZvdW5kO1xuICAgIH0pO1xuICAgIGlmICghbSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkNhbid0IG1hdGNoIG1ldGhvZCByZXNwb25zZSB0byBvcmlnaW5hbCBtZXRob2QgY2FsbFwiLCBtc2cpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBmcm9tIGN1cnJlbnQgbWV0aG9kIGJsb2NrLiBUaGlzIG1heSBsZWF2ZSB0aGUgYmxvY2sgZW1wdHksIGJ1dCB3ZVxuICAgIC8vIGRvbid0IG1vdmUgb24gdG8gdGhlIG5leHQgYmxvY2sgdW50aWwgdGhlIGNhbGxiYWNrIGhhcyBiZWVuIGRlbGl2ZXJlZCwgaW5cbiAgICAvLyBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZC5cbiAgICBjdXJyZW50TWV0aG9kQmxvY2suc3BsaWNlKGksIDEpO1xuXG4gICAgaWYgKGhhc093bi5jYWxsKG1zZywgJ2Vycm9yJykpIHtcbiAgICAgIG0ucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgbmV3IE1ldGVvci5FcnJvcihtc2cuZXJyb3IuZXJyb3IsIG1zZy5lcnJvci5yZWFzb24sIG1zZy5lcnJvci5kZXRhaWxzKVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbXNnLnJlc3VsdCBtYXkgYmUgdW5kZWZpbmVkIGlmIHRoZSBtZXRob2QgZGlkbid0IHJldHVybiBhXG4gICAgICAvLyB2YWx1ZVxuICAgICAgbS5yZWNlaXZlUmVzdWx0KHVuZGVmaW5lZCwgbXNnLnJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gQ2FsbGVkIGJ5IE1ldGhvZEludm9rZXIgYWZ0ZXIgYSBtZXRob2QncyBjYWxsYmFjayBpcyBpbnZva2VkLiAgSWYgdGhpcyB3YXNcbiAgLy8gdGhlIGxhc3Qgb3V0c3RhbmRpbmcgbWV0aG9kIGluIHRoZSBjdXJyZW50IGJsb2NrLCBydW5zIHRoZSBuZXh0IGJsb2NrLiBJZlxuICAvLyB0aGVyZSBhcmUgbm8gbW9yZSBtZXRob2RzLCBjb25zaWRlciBhY2NlcHRpbmcgYSBob3QgY29kZSBwdXNoLlxuICBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkpIHJldHVybjtcblxuICAgIC8vIE5vIG1ldGhvZHMgYXJlIG91dHN0YW5kaW5nLiBUaGlzIHNob3VsZCBtZWFuIHRoYXQgdGhlIGZpcnN0IGJsb2NrIG9mXG4gICAgLy8gbWV0aG9kcyBpcyBlbXB0eS4gKE9yIGl0IG1pZ2h0IG5vdCBleGlzdCwgaWYgdGhpcyB3YXMgYSBtZXRob2QgdGhhdFxuICAgIC8vIGhhbGYtZmluaXNoZWQgYmVmb3JlIGRpc2Nvbm5lY3QvcmVjb25uZWN0LilcbiAgICBpZiAoISBpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgY29uc3QgZmlyc3RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgICBpZiAoISBpc0VtcHR5KGZpcnN0QmxvY2subWV0aG9kcykpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnTm8gbWV0aG9kcyBvdXRzdGFuZGluZyBidXQgbm9uZW1wdHkgYmxvY2s6ICcgK1xuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZmlyc3RCbG9jaylcbiAgICAgICAgKTtcblxuICAgICAgLy8gU2VuZCB0aGUgb3V0c3RhbmRpbmcgbWV0aG9kcyBub3cgaW4gdGhlIGZpcnN0IGJsb2NrLlxuICAgICAgaWYgKCEgaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpXG4gICAgICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKTtcbiAgICB9XG5cbiAgICAvLyBNYXliZSBhY2NlcHQgYSBob3QgY29kZSBwdXNoLlxuICAgIHNlbGYuX21heWJlTWlncmF0ZSgpO1xuICB9XG5cbiAgLy8gU2VuZHMgbWVzc2FnZXMgZm9yIGFsbCB0aGUgbWV0aG9kcyBpbiB0aGUgZmlyc3QgYmxvY2sgaW5cbiAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLlxuICBfc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHMuZm9yRWFjaChtID0+IHtcbiAgICAgIG0uc2VuZE1lc3NhZ2UoKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9saXZlZGF0YV9lcnJvcihtc2cpIHtcbiAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBlcnJvciBmcm9tIHNlcnZlcjogJywgbXNnLnJlYXNvbik7XG4gICAgaWYgKG1zZy5vZmZlbmRpbmdNZXNzYWdlKSBNZXRlb3IuX2RlYnVnKCdGb3I6ICcsIG1zZy5vZmZlbmRpbmdNZXNzYWdlKTtcbiAgfVxuXG4gIF9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcztcbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IFtdO1xuXG4gICAgc2VsZi5vblJlY29ubmVjdCAmJiBzZWxmLm9uUmVjb25uZWN0KCk7XG4gICAgRERQLl9yZWNvbm5lY3RIb29rLmVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgY2FsbGJhY2soc2VsZik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGlmIChpc0VtcHR5KG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkgcmV0dXJuO1xuXG4gICAgLy8gV2UgaGF2ZSBhdCBsZWFzdCBvbmUgYmxvY2sgd29ydGggb2Ygb2xkIG91dHN0YW5kaW5nIG1ldGhvZHMgdG8gdHJ5XG4gICAgLy8gYWdhaW4uIEZpcnN0OiBkaWQgb25SZWNvbm5lY3QgYWN0dWFsbHkgc2VuZCBhbnl0aGluZz8gSWYgbm90LCB3ZSBqdXN0XG4gICAgLy8gcmVzdG9yZSBhbGwgb3V0c3RhbmRpbmcgbWV0aG9kcyBhbmQgcnVuIHRoZSBmaXJzdCBibG9jay5cbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT0ssIHRoZXJlIGFyZSBibG9ja3Mgb24gYm90aCBzaWRlcy4gU3BlY2lhbCBjYXNlOiBtZXJnZSB0aGUgbGFzdCBibG9jayBvZlxuICAgIC8vIHRoZSByZWNvbm5lY3QgbWV0aG9kcyB3aXRoIHRoZSBmaXJzdCBibG9jayBvZiB0aGUgb3JpZ2luYWwgbWV0aG9kcywgaWZcbiAgICAvLyBuZWl0aGVyIG9mIHRoZW0gYXJlIFwid2FpdFwiIGJsb2Nrcy5cbiAgICBpZiAoISBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0ICYmXG4gICAgICAgICEgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ud2FpdCkge1xuICAgICAgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKG0gPT4ge1xuICAgICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobSk7XG5cbiAgICAgICAgLy8gSWYgdGhpcyBcImxhc3QgYmxvY2tcIiBpcyBhbHNvIHRoZSBmaXJzdCBibG9jaywgc2VuZCB0aGUgbWVzc2FnZS5cbiAgICAgICAgaWYgKHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIG0uc2VuZE1lc3NhZ2UoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgLy8gTm93IGFkZCB0aGUgcmVzdCBvZiB0aGUgb3JpZ2luYWwgYmxvY2tzIG9uLlxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goLi4ub2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpO1xuICB9XG5cbiAgLy8gV2UgY2FuIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2ggaWYgdGhlcmUgYXJlIG5vIG1ldGhvZHMgaW4gZmxpZ2h0LlxuICBfcmVhZHlUb01pZ3JhdGUoKSB7XG4gICAgcmV0dXJuIGlzRW1wdHkodGhpcy5fbWV0aG9kSW52b2tlcnMpO1xuICB9XG5cbiAgLy8gSWYgd2Ugd2VyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgc2VlIGlmIGl0J3Mgbm93IHBvc3NpYmxlIHRvIGNvbnRpbnVlLlxuICAvLyBDYWxsIHdoZW5ldmVyIHRoZSBzZXQgb2Ygb3V0c3RhbmRpbmcvYmxvY2tlZCBtZXRob2RzIHNocmlua3MuXG4gIF9tYXliZU1pZ3JhdGUoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3JldHJ5TWlncmF0ZSAmJiBzZWxmLl9yZWFkeVRvTWlncmF0ZSgpKSB7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUoKTtcbiAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgb25NZXNzYWdlKHJhd19tc2cpIHtcbiAgICBsZXQgbXNnO1xuICAgIHRyeSB7XG4gICAgICBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnRXhjZXB0aW9uIHdoaWxlIHBhcnNpbmcgRERQJywgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIHNlcnZlciBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAodGhpcy5faGVhcnRiZWF0KSB7XG4gICAgICB0aGlzLl9oZWFydGJlYXQubWVzc2FnZVJlY2VpdmVkKCk7XG4gICAgfVxuXG4gICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgaWYoIW1zZyB8fCAhbXNnLnRlc3RNZXNzYWdlT25Db25uZWN0KSB7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhtc2cpLmxlbmd0aCA9PT0gMSAmJiBtc2cuc2VydmVyX2lkKSByZXR1cm47XG4gICAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgaW52YWxpZCBsaXZlZGF0YSBtZXNzYWdlJywgbXNnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobXNnLm1zZyA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIHRoaXMuX3ZlcnNpb24gPSB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbjtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX2Nvbm5lY3RlZChtc2cpO1xuICAgICAgdGhpcy5vcHRpb25zLm9uQ29ubmVjdGVkKCk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnZmFpbGVkJykge1xuICAgICAgaWYgKHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zLmluZGV4T2YobXNnLnZlcnNpb24pID49IDApIHtcbiAgICAgICAgdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb24gPSBtc2cudmVyc2lvbjtcbiAgICAgICAgdGhpcy5fc3RyZWFtLnJlY29ubmVjdCh7IF9mb3JjZTogdHJ1ZSB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID1cbiAgICAgICAgICAnRERQIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbGVkOyBzZXJ2ZXIgcmVxdWVzdGVkIHZlcnNpb24gJyArXG4gICAgICAgICAgbXNnLnZlcnNpb247XG4gICAgICAgIHRoaXMuX3N0cmVhbS5kaXNjb25uZWN0KHsgX3Blcm1hbmVudDogdHJ1ZSwgX2Vycm9yOiBkZXNjcmlwdGlvbiB9KTtcbiAgICAgICAgdGhpcy5vcHRpb25zLm9uRERQVmVyc2lvbk5lZ290aWF0aW9uRmFpbHVyZShkZXNjcmlwdGlvbik7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncGluZycgJiYgdGhpcy5vcHRpb25zLnJlc3BvbmRUb1BpbmdzKSB7XG4gICAgICB0aGlzLl9zZW5kKHsgbXNnOiAncG9uZycsIGlkOiBtc2cuaWQgfSk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncG9uZycpIHtcbiAgICAgIC8vIG5vb3AsIGFzIHdlIGFzc3VtZSBldmVyeXRoaW5nJ3MgYSBwb25nXG4gICAgfSBlbHNlIGlmIChcbiAgICAgIFsnYWRkZWQnLCAnY2hhbmdlZCcsICdyZW1vdmVkJywgJ3JlYWR5JywgJ3VwZGF0ZWQnXS5pbmNsdWRlcyhtc2cubXNnKVxuICAgICkge1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfZGF0YShtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ25vc3ViJykge1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfbm9zdWIobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdyZXN1bHQnKSB7XG4gICAgICB0aGlzLl9saXZlZGF0YV9yZXN1bHQobXNnKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdlcnJvcicpIHtcbiAgICAgIHRoaXMuX2xpdmVkYXRhX2Vycm9yKG1zZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgdW5rbm93biBsaXZlZGF0YSBtZXNzYWdlIHR5cGUnLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIG9uUmVzZXQoKSB7XG4gICAgLy8gU2VuZCBhIGNvbm5lY3QgbWVzc2FnZSBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBzdHJlYW0uXG4gICAgLy8gTk9URTogcmVzZXQgaXMgY2FsbGVkIGV2ZW4gb24gdGhlIGZpcnN0IGNvbm5lY3Rpb24sIHNvIHRoaXMgaXNcbiAgICAvLyB0aGUgb25seSBwbGFjZSB3ZSBzZW5kIHRoaXMgbWVzc2FnZS5cbiAgICBjb25zdCBtc2cgPSB7IG1zZzogJ2Nvbm5lY3QnIH07XG4gICAgaWYgKHRoaXMuX2xhc3RTZXNzaW9uSWQpIG1zZy5zZXNzaW9uID0gdGhpcy5fbGFzdFNlc3Npb25JZDtcbiAgICBtc2cudmVyc2lvbiA9IHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uIHx8IHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zWzBdO1xuICAgIHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgbXNnLnN1cHBvcnQgPSB0aGlzLl9zdXBwb3J0ZWRERFBWZXJzaW9ucztcbiAgICB0aGlzLl9zZW5kKG1zZyk7XG5cbiAgICAvLyBNYXJrIG5vbi1yZXRyeSBjYWxscyBhcyBmYWlsZWQuIFRoaXMgaGFzIHRvIGJlIGRvbmUgZWFybHkgYXMgZ2V0dGluZyB0aGVzZSBtZXRob2RzIG91dCBvZiB0aGVcbiAgICAvLyBjdXJyZW50IGJsb2NrIGlzIHByZXR0eSBpbXBvcnRhbnQgdG8gbWFraW5nIHN1cmUgdGhhdCBxdWllc2NlbmNlIGlzIHByb3Blcmx5IGNhbGN1bGF0ZWQsIGFzXG4gICAgLy8gd2VsbCBhcyBwb3NzaWJseSBtb3Zpbmcgb24gdG8gYW5vdGhlciB1c2VmdWwgYmxvY2suXG5cbiAgICAvLyBPbmx5IGJvdGhlciB0ZXN0aW5nIGlmIHRoZXJlIGlzIGFuIG91dHN0YW5kaW5nTWV0aG9kQmxvY2sgKHRoZXJlIG1pZ2h0IG5vdCBiZSwgZXNwZWNpYWxseSBpZlxuICAgIC8vIHdlIGFyZSBjb25uZWN0aW5nIGZvciB0aGUgZmlyc3QgdGltZS5cbiAgICBpZiAodGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID4gMCkge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gb3V0c3RhbmRpbmcgbWV0aG9kIGJsb2NrLCB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhlIGZpcnN0IG9uZSBhcyB0aGF0IGlzIHRoZVxuICAgICAgLy8gb25lIHRoYXQgY291bGQgaGF2ZSBhbHJlYWR5IHNlbnQgbWVzc2FnZXMgd2l0aCBubyByZXNwb25zZSwgdGhhdCBhcmUgbm90IGFsbG93ZWQgdG8gcmV0cnkuXG4gICAgICBjb25zdCBjdXJyZW50TWV0aG9kQmxvY2sgPSB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzO1xuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcyA9IGN1cnJlbnRNZXRob2RCbG9jay5maWx0ZXIoXG4gICAgICAgIG1ldGhvZEludm9rZXIgPT4ge1xuICAgICAgICAgIC8vIE1ldGhvZHMgd2l0aCAnbm9SZXRyeScgb3B0aW9uIHNldCBhcmUgbm90IGFsbG93ZWQgdG8gcmUtc2VuZCBhZnRlclxuICAgICAgICAgIC8vIHJlY292ZXJpbmcgZHJvcHBlZCBjb25uZWN0aW9uLlxuICAgICAgICAgIGlmIChtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSkge1xuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIG1ldGhvZCBpcyB0b2xkIHRoYXQgaXQgZmFpbGVkLlxuICAgICAgICAgICAgbWV0aG9kSW52b2tlci5yZWNlaXZlUmVzdWx0KFxuICAgICAgICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICAgICdpbnZvY2F0aW9uLWZhaWxlZCcsXG4gICAgICAgICAgICAgICAgJ01ldGhvZCBpbnZvY2F0aW9uIG1pZ2h0IGhhdmUgZmFpbGVkIGR1ZSB0byBkcm9wcGVkIGNvbm5lY3Rpb24uICcgK1xuICAgICAgICAgICAgICAgICAgJ0ZhaWxpbmcgYmVjYXVzZSBgbm9SZXRyeWAgb3B0aW9uIHdhcyBwYXNzZWQgdG8gTWV0ZW9yLmFwcGx5LidcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPbmx5IGtlZXAgYSBtZXRob2QgaWYgaXQgd2Fzbid0IHNlbnQgb3IgaXQncyBhbGxvd2VkIHRvIHJldHJ5LlxuICAgICAgICAgIC8vIFRoaXMgbWF5IGxlYXZlIHRoZSBibG9jayBlbXB0eSwgYnV0IHdlIGRvbid0IG1vdmUgb24gdG8gdGhlIG5leHRcbiAgICAgICAgICAvLyBibG9jayB1bnRpbCB0aGUgY2FsbGJhY2sgaGFzIGJlZW4gZGVsaXZlcmVkLCBpbiBfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZC5cbiAgICAgICAgICByZXR1cm4gIShtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gTm93LCB0byBtaW5pbWl6ZSBzZXR1cCBsYXRlbmN5LCBnbyBhaGVhZCBhbmQgYmxhc3Qgb3V0IGFsbCBvZlxuICAgIC8vIG91ciBwZW5kaW5nIG1ldGhvZHMgYW5kcyBzdWJzY3JpcHRpb25zIGJlZm9yZSB3ZSd2ZSBldmVuIHRha2VuXG4gICAgLy8gdGhlIG5lY2Vzc2FyeSBSVFQgdG8ga25vdyBpZiB3ZSBzdWNjZXNzZnVsbHkgcmVjb25uZWN0ZWQuICgxKVxuICAgIC8vIFRoZXkncmUgc3VwcG9zZWQgdG8gYmUgaWRlbXBvdGVudCwgYW5kIHdoZXJlIHRoZXkgYXJlIG5vdCxcbiAgICAvLyB0aGV5IGNhbiBibG9jayByZXRyeSBpbiBhcHBseTsgKDIpIGV2ZW4gaWYgd2UgZGlkIHJlY29ubmVjdCxcbiAgICAvLyB3ZSdyZSBub3Qgc3VyZSB3aGF0IG1lc3NhZ2VzIG1pZ2h0IGhhdmUgZ290dGVuIGxvc3RcbiAgICAvLyAoaW4gZWl0aGVyIGRpcmVjdGlvbikgc2luY2Ugd2Ugd2VyZSBkaXNjb25uZWN0ZWQgKFRDUCBiZWluZ1xuICAgIC8vIHNsb3BweSBhYm91dCB0aGF0LilcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IGJsb2NrIG9mIG1ldGhvZHMgYWxsIGdvdCB0aGVpciByZXN1bHRzIChidXQgZGlkbid0IGFsbCBnZXRcbiAgICAvLyB0aGVpciBkYXRhIHZpc2libGUpLCBkaXNjYXJkIHRoZSBlbXB0eSBibG9jayBub3cuXG4gICAgaWYgKFxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID4gMCAmJlxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5sZW5ndGggPT09IDBcbiAgICApIHtcbiAgICAgIHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnNoaWZ0KCk7XG4gICAgfVxuXG4gICAgLy8gTWFyayBhbGwgbWVzc2FnZXMgYXMgdW5zZW50LCB0aGV5IGhhdmUgbm90IHlldCBiZWVuIHNlbnQgb24gdGhpc1xuICAgIC8vIGNvbm5lY3Rpb24uXG4gICAga2V5cyh0aGlzLl9tZXRob2RJbnZva2VycykuZm9yRWFjaChpZCA9PiB7XG4gICAgICB0aGlzLl9tZXRob2RJbnZva2Vyc1tpZF0uc2VudE1lc3NhZ2UgPSBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8vIElmIGFuIGBvblJlY29ubmVjdGAgaGFuZGxlciBpcyBzZXQsIGNhbGwgaXQgZmlyc3QuIEdvIHRocm91Z2hcbiAgICAvLyBzb21lIGhvb3BzIHRvIGVuc3VyZSB0aGF0IG1ldGhvZHMgdGhhdCBhcmUgY2FsbGVkIGZyb20gd2l0aGluXG4gICAgLy8gYG9uUmVjb25uZWN0YCBnZXQgZXhlY3V0ZWQgX2JlZm9yZV8gb25lcyB0aGF0IHdlcmUgb3JpZ2luYWxseVxuICAgIC8vIG91dHN0YW5kaW5nIChzaW5jZSBgb25SZWNvbm5lY3RgIGlzIHVzZWQgdG8gcmUtZXN0YWJsaXNoIGF1dGhcbiAgICAvLyBjZXJ0aWZpY2F0ZXMpXG4gICAgdGhpcy5fY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCk7XG5cbiAgICAvLyBhZGQgbmV3IHN1YnNjcmlwdGlvbnMgYXQgdGhlIGVuZC4gdGhpcyB3YXkgdGhleSB0YWtlIGVmZmVjdCBhZnRlclxuICAgIC8vIHRoZSBoYW5kbGVycyBhbmQgd2UgZG9uJ3Qgc2VlIGZsaWNrZXIuXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5fc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgoW2lkLCBzdWJdKSA9PiB7XG4gICAgICB0aGlzLl9zZW5kKHtcbiAgICAgICAgbXNnOiAnc3ViJyxcbiAgICAgICAgaWQ6IGlkLFxuICAgICAgICBuYW1lOiBzdWIubmFtZSxcbiAgICAgICAgcGFyYW1zOiBzdWIucGFyYW1zXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbmltcG9ydCB7IENvbm5lY3Rpb24gfSBmcm9tICcuL2xpdmVkYXRhX2Nvbm5lY3Rpb24uanMnO1xuXG4vLyBUaGlzIGFycmF5IGFsbG93cyB0aGUgYF9hbGxTdWJzY3JpcHRpb25zUmVhZHlgIG1ldGhvZCBiZWxvdywgd2hpY2hcbi8vIGlzIHVzZWQgYnkgdGhlIGBzcGlkZXJhYmxlYCBwYWNrYWdlLCB0byBrZWVwIHRyYWNrIG9mIHdoZXRoZXIgYWxsXG4vLyBkYXRhIGlzIHJlYWR5LlxuY29uc3QgYWxsQ29ubmVjdGlvbnMgPSBbXTtcblxuLyoqXG4gKiBAbmFtZXNwYWNlIEREUFxuICogQHN1bW1hcnkgTmFtZXNwYWNlIGZvciBERFAtcmVsYXRlZCBtZXRob2RzL2NsYXNzZXMuXG4gKi9cbmV4cG9ydCBjb25zdCBERFAgPSB7fTtcblxuLy8gVGhpcyBpcyBwcml2YXRlIGJ1dCBpdCdzIHVzZWQgaW4gYSBmZXcgcGxhY2VzLiBhY2NvdW50cy1iYXNlIHVzZXNcbi8vIGl0IHRvIGdldCB0aGUgY3VycmVudCB1c2VyLiBNZXRlb3Iuc2V0VGltZW91dCBhbmQgZnJpZW5kcyBjbGVhclxuLy8gaXQuIFdlIGNhbiBwcm9iYWJseSBmaW5kIGEgYmV0dGVyIHdheSB0byBmYWN0b3IgdGhpcy5cbkREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGUoKTtcbkREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZSgpO1xuXG4vLyBYWFg6IEtlZXAgRERQLl9DdXJyZW50SW52b2NhdGlvbiBmb3IgYmFja3dhcmRzLWNvbXBhdGliaWxpdHkuXG5ERFAuX0N1cnJlbnRJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbjtcblxuLy8gVGhpcyBpcyBwYXNzZWQgaW50byBhIHdlaXJkIGBtYWtlRXJyb3JUeXBlYCBmdW5jdGlvbiB0aGF0IGV4cGVjdHMgaXRzIHRoaW5nXG4vLyB0byBiZSBhIGNvbnN0cnVjdG9yXG5mdW5jdGlvbiBjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbkREUC5Db25uZWN0aW9uRXJyb3IgPSBNZXRlb3IubWFrZUVycm9yVHlwZShcbiAgJ0REUC5Db25uZWN0aW9uRXJyb3InLFxuICBjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvclxuKTtcblxuRERQLkZvcmNlZFJlY29ubmVjdEVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuRm9yY2VkUmVjb25uZWN0RXJyb3InLFxuICAoKSA9PiB7fVxuKTtcblxuLy8gUmV0dXJucyB0aGUgbmFtZWQgc2VxdWVuY2Ugb2YgcHNldWRvLXJhbmRvbSB2YWx1ZXMuXG4vLyBUaGUgc2NvcGUgd2lsbCBiZSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpLCBzbyB0aGUgc3RyZWFtIHdpbGwgcHJvZHVjZVxuLy8gY29uc2lzdGVudCB2YWx1ZXMgZm9yIG1ldGhvZCBjYWxscyBvbiB0aGUgY2xpZW50IGFuZCBzZXJ2ZXIuXG5ERFAucmFuZG9tU3RyZWFtID0gbmFtZSA9PiB7XG4gIGNvbnN0IHNjb3BlID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIEREUENvbW1vbi5SYW5kb21TdHJlYW0uZ2V0KHNjb3BlLCBuYW1lKTtcbn07XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ30gVVJMIHRvIE1ldGVvciBhcHAsXG4vLyAgICAgZS5nLjpcbi8vICAgICBcInN1YmRvbWFpbi5tZXRlb3IuY29tXCIsXG4vLyAgICAgXCJodHRwOi8vc3ViZG9tYWluLm1ldGVvci5jb21cIixcbi8vICAgICBcIi9cIixcbi8vICAgICBcImRkcCtzb2NranM6Ly9kZHAtLSoqKiotZm9vLm1ldGVvci5jb20vc29ja2pzXCJcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25uZWN0IHRvIHRoZSBzZXJ2ZXIgb2YgYSBkaWZmZXJlbnQgTWV0ZW9yIGFwcGxpY2F0aW9uIHRvIHN1YnNjcmliZSB0byBpdHMgZG9jdW1lbnQgc2V0cyBhbmQgaW52b2tlIGl0cyByZW1vdGUgbWV0aG9kcy5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtTdHJpbmd9IHVybCBUaGUgVVJMIG9mIGFub3RoZXIgTWV0ZW9yIGFwcGxpY2F0aW9uLlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJlbG9hZFdpdGhPdXRzdGFuZGluZyBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5oZWFkZXJzIGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Igc2VydmVyLXRvLXNlcnZlciBERFAgb25seVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMgU3BlY2lmaWVzIG9wdGlvbnMgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBzb2NranMgY2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uRERQTmVnb3RpYXRpb25WZXJzaW9uRmFpbHVyZSBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4gKi9cbkREUC5jb25uZWN0ID0gKHVybCwgb3B0aW9ucykgPT4ge1xuICBjb25zdCByZXQgPSBuZXcgQ29ubmVjdGlvbih1cmwsIG9wdGlvbnMpO1xuICBhbGxDb25uZWN0aW9ucy5wdXNoKHJldCk7IC8vIGhhY2suIHNlZSBiZWxvdy5cbiAgcmV0dXJuIHJldDtcbn07XG5cbkREUC5fcmVjb25uZWN0SG9vayA9IG5ldyBIb29rKHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGNhbGwgYXMgdGhlIGZpcnN0IHN0ZXAgb2ZcbiAqIHJlY29ubmVjdGluZy4gVGhpcyBmdW5jdGlvbiBjYW4gY2FsbCBtZXRob2RzIHdoaWNoIHdpbGwgYmUgZXhlY3V0ZWQgYmVmb3JlXG4gKiBhbnkgb3RoZXIgb3V0c3RhbmRpbmcgbWV0aG9kcy4gRm9yIGV4YW1wbGUsIHRoaXMgY2FuIGJlIHVzZWQgdG8gcmUtZXN0YWJsaXNoXG4gKiB0aGUgYXBwcm9wcmlhdGUgYXV0aGVudGljYXRpb24gY29udGV4dCBvbiB0aGUgY29ubmVjdGlvbi5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkIHdpdGggYVxuICogc2luZ2xlIGFyZ3VtZW50LCB0aGUgW2Nvbm5lY3Rpb24gb2JqZWN0XSgjZGRwX2Nvbm5lY3QpIHRoYXQgaXMgcmVjb25uZWN0aW5nLlxuICovXG5ERFAub25SZWNvbm5lY3QgPSBjYWxsYmFjayA9PiBERFAuX3JlY29ubmVjdEhvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuXG4vLyBIYWNrIGZvciBgc3BpZGVyYWJsZWAgcGFja2FnZTogYSB3YXkgdG8gc2VlIGlmIHRoZSBwYWdlIGlzIGRvbmVcbi8vIGxvYWRpbmcgYWxsIHRoZSBkYXRhIGl0IG5lZWRzLlxuLy9cbkREUC5fYWxsU3Vic2NyaXB0aW9uc1JlYWR5ID0gKCkgPT4gYWxsQ29ubmVjdGlvbnMuZXZlcnkoXG4gIGNvbm4gPT4gT2JqZWN0LnZhbHVlcyhjb25uLl9zdWJzY3JpcHRpb25zKS5ldmVyeShzdWIgPT4gc3ViLnJlYWR5KVxuKTtcbiJdfQ==
