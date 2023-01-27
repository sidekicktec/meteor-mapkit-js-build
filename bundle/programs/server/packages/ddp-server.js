(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, id, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function module(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/stream_server.js                                                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
// By default, we use the permessage-deflate extension with default
// configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid
// JSON. If it represents a falsey value, then we do not use permessage-deflate
// at all; otherwise, the JSON value is used as an argument to deflate's
// configure method; see
// https://github.com/faye/permessage-deflate-node/blob/master/README.md
//
// (We do this in an _.once instead of at startup, because we don't want to
// crash the tool during isopacket load if your JSON doesn't parse. This is only
// a problem because the tool has to load the DDP server code just in order to
// be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)
var websocketExtensions = _.once(function () {
  var extensions = [];
  var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
  if (websocketCompressionConfig) {
    extensions.push(Npm.require('permessage-deflate').configure(websocketCompressionConfig));
  }
  return extensions;
});
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";
StreamServer = function () {
  var self = this;
  self.registration_callbacks = [];
  self.open_sockets = [];

  // Because we are installing directly onto WebApp.httpServer instead of using
  // WebApp.app, we have to process the path prefix ourselves.
  self.prefix = pathPrefix + '/sockjs';
  RoutePolicy.declare(self.prefix + '/', 'network');

  // set up sockjs
  var sockjs = Npm.require('sockjs');
  var serverOptions = {
    prefix: self.prefix,
    log: function () {},
    // this is the default, but we code it explicitly because we depend
    // on it in stream_client:HEARTBEAT_TIMEOUT
    heartbeat_delay: 45000,
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU
    // bound for that much time, SockJS might not notice that the user has
    // reconnected because the timer (of disconnect_delay ms) can fire before
    // SockJS processes the new connection. Eventually we'll fix this by not
    // combining CPU-heavy processing with SockJS termination (eg a proxy which
    // converts to Unix sockets) but for now, raise the delay.
    disconnect_delay: 60 * 1000,
    // Set the USE_JSESSIONID environment variable to enable setting the
    // JSESSIONID cookie. This is useful for setting up proxies with
    // session affinity.
    jsessionid: !!process.env.USE_JSESSIONID
  };

  // If you know your server environment (eg, proxies) will prevent websockets
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,
  // browsers) will not waste time attempting to use them.
  // (Your server will still have a /websocket endpoint.)
  if (process.env.DISABLE_WEBSOCKETS) {
    serverOptions.websocket = false;
  } else {
    serverOptions.faye_server_options = {
      extensions: websocketExtensions()
    };
  }
  self.server = sockjs.createServer(serverOptions);

  // Install the sockjs handlers, but we want to keep around our own particular
  // request handler that adjusts idle timeouts while we have an outstanding
  // request.  This compensates for the fact that sockjs removes all listeners
  // for "request" to add its own.
  WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);
  self.server.installHandlers(WebApp.httpServer);
  WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);

  // Support the /websocket endpoint
  self._redirectWebsocketEndpoint();
  self.server.on('connection', function (socket) {
    // sockjs sometimes passes us null instead of a socket object
    // so we need to guard against that. see:
    // https://github.com/sockjs/sockjs-node/issues/121
    // https://github.com/meteor/meteor/issues/10468
    if (!socket) return;

    // We want to make sure that if a client connects to us and does the initial
    // Websocket handshake but never gets to the DDP handshake, that we
    // eventually kill the socket.  Once the DDP handshake happens, DDP
    // heartbeating will work. And before the Websocket handshake, the timeouts
    // we set at the server level in webapp_server.js will work. But
    // faye-websocket calls setTimeout(0) on any socket it takes over, so there
    // is an "in between" state where this doesn't happen.  We work around this
    // by explicitly setting the socket timeout to a relatively large time here,
    // and setting it back to zero when we set up the heartbeat in
    // livedata_server.js.
    socket.setWebsocketTimeout = function (timeout) {
      if ((socket.protocol === 'websocket' || socket.protocol === 'websocket-raw') && socket._session.recv) {
        socket._session.recv.connection.setTimeout(timeout);
      }
    };
    socket.setWebsocketTimeout(45 * 1000);
    socket.send = function (data) {
      socket.write(data);
    };
    socket.on('close', function () {
      self.open_sockets = _.without(self.open_sockets, socket);
    });
    self.open_sockets.push(socket);

    // only to send a message after connection on tests, useful for
    // socket-stream-client/server-tests.js
    if (process.env.TEST_METADATA && process.env.TEST_METADATA !== "{}") {
      socket.send(JSON.stringify({
        testMessageOnConnect: true
      }));
    }

    // call all our callbacks when we get a new socket. they will do the
    // work of setting up handlers and such for specific messages.
    _.each(self.registration_callbacks, function (callback) {
      callback(socket);
    });
  });
};
Object.assign(StreamServer.prototype, {
  // call my callback when a new socket connects.
  // also call it for all current connections.
  register: function (callback) {
    var self = this;
    self.registration_callbacks.push(callback);
    _.each(self.all_sockets(), function (socket) {
      callback(socket);
    });
  },
  // get a list of all sockets
  all_sockets: function () {
    var self = this;
    return _.values(self.open_sockets);
  },
  // Redirect /websocket to /sockjs/websocket in order to not expose
  // sockjs to clients that want to use raw websockets
  _redirectWebsocketEndpoint: function () {
    var self = this;
    // Unfortunately we can't use a connect middleware here since
    // sockjs installs itself prior to all existing listeners
    // (meaning prior to any connect middlewares) so we need to take
    // an approach similar to overshadowListeners in
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee
    ['request', 'upgrade'].forEach(event => {
      var httpServer = WebApp.httpServer;
      var oldHttpServerListeners = httpServer.listeners(event).slice(0);
      httpServer.removeAllListeners(event);

      // request and upgrade have different arguments passed but
      // we only care about the first one which is always request
      var newListener = function (request /*, moreArguments */) {
        // Store arguments for use within the closure below
        var args = arguments;

        // TODO replace with url package
        var url = Npm.require('url');

        // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while
        // preserving query string.
        var parsedUrl = url.parse(request.url);
        if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
          parsedUrl.pathname = self.prefix + '/websocket';
          request.url = url.format(parsedUrl);
        }
        _.each(oldHttpServerListeners, function (oldListener) {
          oldListener.apply(httpServer, args);
        });
      };
      httpServer.addListener(event, newListener);
    });
  }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_server.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/livedata_server.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
let _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }
}, 0);
DDPServer = {};
var Fiber = Npm.require('fibers');

// Publication strategies define how we handle data from published cursors at the collection level
// This allows someone to:
// - Choose a trade-off between client-server bandwidth and server memory usage
// - Implement special (non-mongo) collections like volatile message queues
const publicationStrategies = {
  // SERVER_MERGE is the default strategy.
  // When using this strategy, the server maintains a copy of all data a connection is subscribed to.
  // This allows us to only send deltas over multiple publications.
  SERVER_MERGE: {
    useCollectionView: true,
    doAccountingForCollection: true
  },
  // The NO_MERGE_NO_HISTORY strategy results in the server sending all publication data
  // directly to the client. It does not remember what it has previously sent
  // to it will not trigger removed messages when a subscription is stopped.
  // This should only be chosen for special use cases like send-and-forget queues.
  NO_MERGE_NO_HISTORY: {
    useCollectionView: false,
    doAccountingForCollection: false
  },
  // NO_MERGE is similar to NO_MERGE_NO_HISTORY but the server will remember the IDs it has
  // sent to the client so it can remove them when a subscription is stopped.
  // This strategy can be used when a collection is only used in a single publication.
  NO_MERGE: {
    useCollectionView: false,
    doAccountingForCollection: true
  }
};
DDPServer.publicationStrategies = publicationStrategies;

// This file contains classes:
// * Session - The server's connection to a single DDP client
// * Subscription - A single subscription for a single client
// * Server - An entire server that may talk to > 1 client. A DDP endpoint.
//
// Session and Subscription are file scope. For now, until we freeze
// the interface, Server is package scope (in the future it should be
// exported).

// Represents a single document in a SessionCollectionView
var SessionDocumentView = function () {
  var self = this;
  self.existsIn = new Set(); // set of subscriptionHandle
  self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
};

DDPServer._SessionDocumentView = SessionDocumentView;
_.extend(SessionDocumentView.prototype, {
  getFields: function () {
    var self = this;
    var ret = {};
    self.dataByKey.forEach(function (precedenceList, key) {
      ret[key] = precedenceList[0].value;
    });
    return ret;
  },
  clearField: function (subscriptionHandle, key, changeCollector) {
    var self = this;
    // Publish API ignores _id if present in fields
    if (key === "_id") return;
    var precedenceList = self.dataByKey.get(key);

    // It's okay to clear fields that didn't exist. No need to throw
    // an error.
    if (!precedenceList) return;
    var removedValue = undefined;
    for (var i = 0; i < precedenceList.length; i++) {
      var precedence = precedenceList[i];
      if (precedence.subscriptionHandle === subscriptionHandle) {
        // The view's value can only change if this subscription is the one that
        // used to have precedence.
        if (i === 0) removedValue = precedence.value;
        precedenceList.splice(i, 1);
        break;
      }
    }
    if (precedenceList.length === 0) {
      self.dataByKey.delete(key);
      changeCollector[key] = undefined;
    } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
      changeCollector[key] = precedenceList[0].value;
    }
  },
  changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
    var self = this;
    // Publish API ignores _id if present in fields
    if (key === "_id") return;

    // Don't share state with the data passed in by the user.
    value = EJSON.clone(value);
    if (!self.dataByKey.has(key)) {
      self.dataByKey.set(key, [{
        subscriptionHandle: subscriptionHandle,
        value: value
      }]);
      changeCollector[key] = value;
      return;
    }
    var precedenceList = self.dataByKey.get(key);
    var elt;
    if (!isAdd) {
      elt = precedenceList.find(function (precedence) {
        return precedence.subscriptionHandle === subscriptionHandle;
      });
    }
    if (elt) {
      if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
        // this subscription is changing the value of this field.
        changeCollector[key] = value;
      }
      elt.value = value;
    } else {
      // this subscription is newly caring about this field
      precedenceList.push({
        subscriptionHandle: subscriptionHandle,
        value: value
      });
    }
  }
});

/**
 * Represents a client's view of a single collection
 * @param {String} collectionName Name of the collection it represents
 * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed
 * @class SessionCollectionView
 */
var SessionCollectionView = function (collectionName, sessionCallbacks) {
  var self = this;
  self.collectionName = collectionName;
  self.documents = new Map();
  self.callbacks = sessionCallbacks;
};
DDPServer._SessionCollectionView = SessionCollectionView;
Object.assign(SessionCollectionView.prototype, {
  isEmpty: function () {
    var self = this;
    return self.documents.size === 0;
  },
  diff: function (previous) {
    var self = this;
    DiffSequence.diffMaps(previous.documents, self.documents, {
      both: _.bind(self.diffDocument, self),
      rightOnly: function (id, nowDV) {
        self.callbacks.added(self.collectionName, id, nowDV.getFields());
      },
      leftOnly: function (id, prevDV) {
        self.callbacks.removed(self.collectionName, id);
      }
    });
  },
  diffDocument: function (id, prevDV, nowDV) {
    var self = this;
    var fields = {};
    DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {
      both: function (key, prev, now) {
        if (!EJSON.equals(prev, now)) fields[key] = now;
      },
      rightOnly: function (key, now) {
        fields[key] = now;
      },
      leftOnly: function (key, prev) {
        fields[key] = undefined;
      }
    });
    self.callbacks.changed(self.collectionName, id, fields);
  },
  added: function (subscriptionHandle, id, fields) {
    var self = this;
    var docView = self.documents.get(id);
    var added = false;
    if (!docView) {
      added = true;
      docView = new SessionDocumentView();
      self.documents.set(id, docView);
    }
    docView.existsIn.add(subscriptionHandle);
    var changeCollector = {};
    _.each(fields, function (value, key) {
      docView.changeField(subscriptionHandle, key, value, changeCollector, true);
    });
    if (added) self.callbacks.added(self.collectionName, id, changeCollector);else self.callbacks.changed(self.collectionName, id, changeCollector);
  },
  changed: function (subscriptionHandle, id, changed) {
    var self = this;
    var changedResult = {};
    var docView = self.documents.get(id);
    if (!docView) throw new Error("Could not find element with id " + id + " to change");
    _.each(changed, function (value, key) {
      if (value === undefined) docView.clearField(subscriptionHandle, key, changedResult);else docView.changeField(subscriptionHandle, key, value, changedResult);
    });
    self.callbacks.changed(self.collectionName, id, changedResult);
  },
  removed: function (subscriptionHandle, id) {
    var self = this;
    var docView = self.documents.get(id);
    if (!docView) {
      var err = new Error("Removed nonexistent document " + id);
      throw err;
    }
    docView.existsIn.delete(subscriptionHandle);
    if (docView.existsIn.size === 0) {
      // it is gone from everyone
      self.callbacks.removed(self.collectionName, id);
      self.documents.delete(id);
    } else {
      var changed = {};
      // remove this subscription from every precedence list
      // and record the changes
      docView.dataByKey.forEach(function (precedenceList, key) {
        docView.clearField(subscriptionHandle, key, changed);
      });
      self.callbacks.changed(self.collectionName, id, changed);
    }
  }
});

/******************************************************************************/
/* Session                                                                    */
/******************************************************************************/

var Session = function (server, version, socket, options) {
  var self = this;
  self.id = Random.id();
  self.server = server;
  self.version = version;
  self.initialized = false;
  self.socket = socket;

  // Set to null when the session is destroyed. Multiple places below
  // use this to determine if the session is alive or not.
  self.inQueue = new Meteor._DoubleEndedQueue();
  self.blocked = false;
  self.workerRunning = false;
  self.cachedUnblock = null;

  // Sub objects for active subscriptions
  self._namedSubs = new Map();
  self._universalSubs = [];
  self.userId = null;
  self.collectionViews = new Map();

  // Set this to false to not send messages when collectionViews are
  // modified. This is done when rerunning subs in _setUserId and those messages
  // are calculated via a diff instead.
  self._isSending = true;

  // If this is true, don't start a newly-created universal publisher on this
  // session. The session will take care of starting it when appropriate.
  self._dontStartNewUniversalSubs = false;

  // When we are rerunning subscriptions, any ready messages
  // we want to buffer up for when we are done rerunning subscriptions
  self._pendingReady = [];

  // List of callbacks to call when this connection is closed.
  self._closeCallbacks = [];

  // XXX HACK: If a sockjs connection, save off the URL. This is
  // temporary and will go away in the near future.
  self._socketUrl = socket.url;

  // Allow tests to disable responding to pings.
  self._respondToPings = options.respondToPings;

  // This object is the public interface to the session. In the public
  // API, it is called the `connection` object.  Internally we call it
  // a `connectionHandle` to avoid ambiguity.
  self.connectionHandle = {
    id: self.id,
    close: function () {
      self.close();
    },
    onClose: function (fn) {
      var cb = Meteor.bindEnvironment(fn, "connection onClose callback");
      if (self.inQueue) {
        self._closeCallbacks.push(cb);
      } else {
        // if we're already closed, call the callback.
        Meteor.defer(cb);
      }
    },
    clientAddress: self._clientAddress(),
    httpHeaders: self.socket.headers
  };
  self.send({
    msg: 'connected',
    session: self.id
  });

  // On initial connect, spin up all the universal publishers.
  Fiber(function () {
    self.startUniversalSubs();
  }).run();
  if (version !== 'pre1' && options.heartbeatInterval !== 0) {
    // We no longer need the low level timeout because we have heartbeats.
    socket.setWebsocketTimeout(0);
    self.heartbeat = new DDPCommon.Heartbeat({
      heartbeatInterval: options.heartbeatInterval,
      heartbeatTimeout: options.heartbeatTimeout,
      onTimeout: function () {
        self.close();
      },
      sendPing: function () {
        self.send({
          msg: 'ping'
        });
      }
    });
    self.heartbeat.start();
  }
  Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", 1);
};
Object.assign(Session.prototype, {
  sendReady: function (subscriptionIds) {
    var self = this;
    if (self._isSending) self.send({
      msg: "ready",
      subs: subscriptionIds
    });else {
      _.each(subscriptionIds, function (subscriptionId) {
        self._pendingReady.push(subscriptionId);
      });
    }
  },
  _canSend(collectionName) {
    return this._isSending || !this.server.getPublicationStrategy(collectionName).useCollectionView;
  },
  sendAdded(collectionName, id, fields) {
    if (this._canSend(collectionName)) this.send({
      msg: "added",
      collection: collectionName,
      id,
      fields
    });
  },
  sendChanged(collectionName, id, fields) {
    if (_.isEmpty(fields)) return;
    if (this._canSend(collectionName)) {
      this.send({
        msg: "changed",
        collection: collectionName,
        id,
        fields
      });
    }
  },
  sendRemoved(collectionName, id) {
    if (this._canSend(collectionName)) this.send({
      msg: "removed",
      collection: collectionName,
      id
    });
  },
  getSendCallbacks: function () {
    var self = this;
    return {
      added: _.bind(self.sendAdded, self),
      changed: _.bind(self.sendChanged, self),
      removed: _.bind(self.sendRemoved, self)
    };
  },
  getCollectionView: function (collectionName) {
    var self = this;
    var ret = self.collectionViews.get(collectionName);
    if (!ret) {
      ret = new SessionCollectionView(collectionName, self.getSendCallbacks());
      self.collectionViews.set(collectionName, ret);
    }
    return ret;
  },
  added(subscriptionHandle, collectionName, id, fields) {
    if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
      const view = this.getCollectionView(collectionName);
      view.added(subscriptionHandle, id, fields);
    } else {
      this.sendAdded(collectionName, id, fields);
    }
  },
  removed(subscriptionHandle, collectionName, id) {
    if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
      const view = this.getCollectionView(collectionName);
      view.removed(subscriptionHandle, id);
      if (view.isEmpty()) {
        this.collectionViews.delete(collectionName);
      }
    } else {
      this.sendRemoved(collectionName, id);
    }
  },
  changed(subscriptionHandle, collectionName, id, fields) {
    if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
      const view = this.getCollectionView(collectionName);
      view.changed(subscriptionHandle, id, fields);
    } else {
      this.sendChanged(collectionName, id, fields);
    }
  },
  startUniversalSubs: function () {
    var self = this;
    // Make a shallow copy of the set of universal handlers and start them. If
    // additional universal publishers start while we're running them (due to
    // yielding), they will run separately as part of Server.publish.
    var handlers = _.clone(self.server.universal_publish_handlers);
    _.each(handlers, function (handler) {
      self._startSubscription(handler);
    });
  },
  // Destroy this session and unregister it at the server.
  close: function () {
    var self = this;

    // Destroy this session, even if it's not registered at the
    // server. Stop all processing and tear everything down. If a socket
    // was attached, close it.

    // Already destroyed.
    if (!self.inQueue) return;

    // Drop the merge box data immediately.
    self.inQueue = null;
    self.collectionViews = new Map();
    if (self.heartbeat) {
      self.heartbeat.stop();
      self.heartbeat = null;
    }
    if (self.socket) {
      self.socket.close();
      self.socket._meteorSession = null;
    }
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", -1);
    Meteor.defer(function () {
      // Stop callbacks can yield, so we defer this on close.
      // sub._isDeactivated() detects that we set inQueue to null and
      // treats it as semi-deactivated (it will ignore incoming callbacks, etc).
      self._deactivateAllSubscriptions();

      // Defer calling the close callbacks, so that the caller closing
      // the session isn't waiting for all the callbacks to complete.
      _.each(self._closeCallbacks, function (callback) {
        callback();
      });
    });

    // Unregister the session.
    self.server._removeSession(self);
  },
  // Send a message (doing nothing if no socket is connected right now).
  // It should be a JSON object (it will be stringified).
  send: function (msg) {
    var self = this;
    if (self.socket) {
      if (Meteor._printSentDDP) Meteor._debug("Sent DDP", DDPCommon.stringifyDDP(msg));
      self.socket.send(DDPCommon.stringifyDDP(msg));
    }
  },
  // Send a connection error.
  sendError: function (reason, offendingMessage) {
    var self = this;
    var msg = {
      msg: 'error',
      reason: reason
    };
    if (offendingMessage) msg.offendingMessage = offendingMessage;
    self.send(msg);
  },
  // Process 'msg' as an incoming message. As a guard against
  // race conditions during reconnection, ignore the message if
  // 'socket' is not the currently connected socket.
  //
  // We run the messages from the client one at a time, in the order
  // given by the client. The message handler is passed an idempotent
  // function 'unblock' which it may call to allow other messages to
  // begin running in parallel in another fiber (for example, a method
  // that wants to yield). Otherwise, it is automatically unblocked
  // when it returns.
  //
  // Actually, we don't have to 'totally order' the messages in this
  // way, but it's the easiest thing that's correct. (unsub needs to
  // be ordered against sub, methods need to be ordered against each
  // other).
  processMessage: function (msg_in) {
    var self = this;
    if (!self.inQueue)
      // we have been destroyed.
      return;

    // Respond to ping and pong messages immediately without queuing.
    // If the negotiated DDP version is "pre1" which didn't support
    // pings, preserve the "pre1" behavior of responding with a "bad
    // request" for the unknown messages.
    //
    // Fibers are needed because heartbeats use Meteor.setTimeout, which
    // needs a Fiber. We could actually use regular setTimeout and avoid
    // these new fibers, but it is easier to just make everything use
    // Meteor.setTimeout and not think too hard.
    //
    // Any message counts as receiving a pong, as it demonstrates that
    // the client is still alive.
    if (self.heartbeat) {
      Fiber(function () {
        self.heartbeat.messageReceived();
      }).run();
    }
    if (self.version !== 'pre1' && msg_in.msg === 'ping') {
      if (self._respondToPings) self.send({
        msg: "pong",
        id: msg_in.id
      });
      return;
    }
    if (self.version !== 'pre1' && msg_in.msg === 'pong') {
      // Since everything is a pong, there is nothing to do
      return;
    }
    self.inQueue.push(msg_in);
    if (self.workerRunning) return;
    self.workerRunning = true;
    var processNext = function () {
      var msg = self.inQueue && self.inQueue.shift();
      if (!msg) {
        self.workerRunning = false;
        return;
      }
      Fiber(function () {
        var blocked = true;
        var unblock = function () {
          if (!blocked) return; // idempotent
          blocked = false;
          processNext();
        };
        self.server.onMessageHook.each(function (callback) {
          callback(msg, self);
          return true;
        });
        if (_.has(self.protocol_handlers, msg.msg)) self.protocol_handlers[msg.msg].call(self, msg, unblock);else self.sendError('Bad request', msg);
        unblock(); // in case the handler didn't already do it
      }).run();
    };
    processNext();
  },
  protocol_handlers: {
    sub: function (msg, unblock) {
      var self = this;

      // cacheUnblock temporarly, so we can capture it later
      // we will use unblock in current eventLoop, so this is safe
      self.cachedUnblock = unblock;

      // reject malformed messages
      if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
        self.sendError("Malformed subscription", msg);
        return;
      }
      if (!self.server.publish_handlers[msg.name]) {
        self.send({
          msg: 'nosub',
          id: msg.id,
          error: new Meteor.Error(404, "Subscription '".concat(msg.name, "' not found"))
        });
        return;
      }
      if (self._namedSubs.has(msg.id))
        // subs are idempotent, or rather, they are ignored if a sub
        // with that id already exists. this is important during
        // reconnect.
        return;

      // XXX It'd be much better if we had generic hooks where any package can
      // hook into subscription handling, but in the mean while we special case
      // ddp-rate-limiter package. This is also done for weak requirements to
      // add the ddp-rate-limiter package in case we don't have Accounts. A
      // user trying to use the ddp-rate-limiter must explicitly require it.
      if (Package['ddp-rate-limiter']) {
        var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
        var rateLimiterInput = {
          userId: self.userId,
          clientAddress: self.connectionHandle.clientAddress,
          type: "subscription",
          name: msg.name,
          connectionId: self.id
        };
        DDPRateLimiter._increment(rateLimiterInput);
        var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
        if (!rateLimitResult.allowed) {
          self.send({
            msg: 'nosub',
            id: msg.id,
            error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), {
              timeToReset: rateLimitResult.timeToReset
            })
          });
          return;
        }
      }
      var handler = self.server.publish_handlers[msg.name];
      self._startSubscription(handler, msg.id, msg.params, msg.name);

      // cleaning cached unblock
      self.cachedUnblock = null;
    },
    unsub: function (msg) {
      var self = this;
      self._stopSubscription(msg.id);
    },
    method: function (msg, unblock) {
      var self = this;

      // Reject malformed messages.
      // For now, we silently ignore unknown attributes,
      // for forwards compatibility.
      if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
        self.sendError("Malformed method invocation", msg);
        return;
      }
      var randomSeed = msg.randomSeed || null;

      // Set up to mark the method as satisfied once all observers
      // (and subscriptions) have reacted to any writes that were
      // done.
      var fence = new DDPServer._WriteFence();
      fence.onAllCommitted(function () {
        // Retire the fence so that future writes are allowed.
        // This means that callbacks like timers are free to use
        // the fence, and if they fire before it's armed (for
        // example, because the method waits for them) their
        // writes will be included in the fence.
        fence.retire();
        self.send({
          msg: 'updated',
          methods: [msg.id]
        });
      });

      // Find the handler
      var handler = self.server.method_handlers[msg.method];
      if (!handler) {
        self.send({
          msg: 'result',
          id: msg.id,
          error: new Meteor.Error(404, "Method '".concat(msg.method, "' not found"))
        });
        fence.arm();
        return;
      }
      var setUserId = function (userId) {
        self._setUserId(userId);
      };
      var invocation = new DDPCommon.MethodInvocation({
        isSimulation: false,
        userId: self.userId,
        setUserId: setUserId,
        unblock: unblock,
        connection: self.connectionHandle,
        randomSeed: randomSeed
      });
      const promise = new Promise((resolve, reject) => {
        // XXX It'd be better if we could hook into method handlers better but
        // for now, we need to check if the ddp-rate-limiter exists since we
        // have a weak requirement for the ddp-rate-limiter package to be added
        // to our application.
        if (Package['ddp-rate-limiter']) {
          var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
          var rateLimiterInput = {
            userId: self.userId,
            clientAddress: self.connectionHandle.clientAddress,
            type: "method",
            name: msg.method,
            connectionId: self.id
          };
          DDPRateLimiter._increment(rateLimiterInput);
          var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
          if (!rateLimitResult.allowed) {
            reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), {
              timeToReset: rateLimitResult.timeToReset
            }));
            return;
          }
        }
        const getCurrentMethodInvocationResult = () => {
          const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
          try {
            let result;
            const resultOrThenable = maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'");
            const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
            if (isThenable) {
              result = Promise.await(resultOrThenable);
            } else {
              result = resultOrThenable;
            }
            return result;
          } finally {
            DDP._CurrentMethodInvocation._set(currentContext);
          }
        };
        resolve(DDPServer._CurrentWriteFence.withValue(fence, getCurrentMethodInvocationResult));
      });
      function finish() {
        fence.arm();
        unblock();
      }
      const payload = {
        msg: "result",
        id: msg.id
      };
      promise.then(result => {
        finish();
        if (result !== undefined) {
          payload.result = result;
        }
        self.send(payload);
      }, exception => {
        finish();
        payload.error = wrapInternalException(exception, "while invoking method '".concat(msg.method, "'"));
        self.send(payload);
      });
    }
  },
  _eachSub: function (f) {
    var self = this;
    self._namedSubs.forEach(f);
    self._universalSubs.forEach(f);
  },
  _diffCollectionViews: function (beforeCVs) {
    var self = this;
    DiffSequence.diffMaps(beforeCVs, self.collectionViews, {
      both: function (collectionName, leftValue, rightValue) {
        rightValue.diff(leftValue);
      },
      rightOnly: function (collectionName, rightValue) {
        rightValue.documents.forEach(function (docView, id) {
          self.sendAdded(collectionName, id, docView.getFields());
        });
      },
      leftOnly: function (collectionName, leftValue) {
        leftValue.documents.forEach(function (doc, id) {
          self.sendRemoved(collectionName, id);
        });
      }
    });
  },
  // Sets the current user id in all appropriate contexts and reruns
  // all subscriptions
  _setUserId: function (userId) {
    var self = this;
    if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + typeof userId);

    // Prevent newly-created universal subscriptions from being added to our
    // session. They will be found below when we call startUniversalSubs.
    //
    // (We don't have to worry about named subscriptions, because we only add
    // them when we process a 'sub' message. We are currently processing a
    // 'method' message, and the method did not unblock, because it is illegal
    // to call setUserId after unblock. Thus we cannot be concurrently adding a
    // new named subscription).
    self._dontStartNewUniversalSubs = true;

    // Prevent current subs from updating our collectionViews and call their
    // stop callbacks. This may yield.
    self._eachSub(function (sub) {
      sub._deactivate();
    });

    // All subs should now be deactivated. Stop sending messages to the client,
    // save the state of the published collections, reset to an empty view, and
    // update the userId.
    self._isSending = false;
    var beforeCVs = self.collectionViews;
    self.collectionViews = new Map();
    self.userId = userId;

    // _setUserId is normally called from a Meteor method with
    // DDP._CurrentMethodInvocation set. But DDP._CurrentMethodInvocation is not
    // expected to be set inside a publish function, so we temporary unset it.
    // Inside a publish function DDP._CurrentPublicationInvocation is set.
    DDP._CurrentMethodInvocation.withValue(undefined, function () {
      // Save the old named subs, and reset to having no subscriptions.
      var oldNamedSubs = self._namedSubs;
      self._namedSubs = new Map();
      self._universalSubs = [];
      oldNamedSubs.forEach(function (sub, subscriptionId) {
        var newSub = sub._recreate();
        self._namedSubs.set(subscriptionId, newSub);
        // nb: if the handler throws or calls this.error(), it will in fact
        // immediately send its 'nosub'. This is OK, though.
        newSub._runHandler();
      });

      // Allow newly-created universal subs to be started on our connection in
      // parallel with the ones we're spinning up here, and spin up universal
      // subs.
      self._dontStartNewUniversalSubs = false;
      self.startUniversalSubs();
    });

    // Start sending messages again, beginning with the diff from the previous
    // state of the world to the current state. No yields are allowed during
    // this diff, so that other changes cannot interleave.
    Meteor._noYieldsAllowed(function () {
      self._isSending = true;
      self._diffCollectionViews(beforeCVs);
      if (!_.isEmpty(self._pendingReady)) {
        self.sendReady(self._pendingReady);
        self._pendingReady = [];
      }
    });
  },
  _startSubscription: function (handler, subId, params, name) {
    var self = this;
    var sub = new Subscription(self, handler, subId, params, name);
    let unblockHander = self.cachedUnblock;
    // _startSubscription may call from a lot places
    // so cachedUnblock might be null in somecases
    // assign the cachedUnblock
    sub.unblock = unblockHander || (() => {});
    if (subId) self._namedSubs.set(subId, sub);else self._universalSubs.push(sub);
    sub._runHandler();
  },
  // Tear down specified subscription
  _stopSubscription: function (subId, error) {
    var self = this;
    var subName = null;
    if (subId) {
      var maybeSub = self._namedSubs.get(subId);
      if (maybeSub) {
        subName = maybeSub._name;
        maybeSub._removeAllDocuments();
        maybeSub._deactivate();
        self._namedSubs.delete(subId);
      }
    }
    var response = {
      msg: 'nosub',
      id: subId
    };
    if (error) {
      response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
    }
    self.send(response);
  },
  // Tear down all subscriptions. Note that this does NOT send removed or nosub
  // messages, since we assume the client is gone.
  _deactivateAllSubscriptions: function () {
    var self = this;
    self._namedSubs.forEach(function (sub, id) {
      sub._deactivate();
    });
    self._namedSubs = new Map();
    self._universalSubs.forEach(function (sub) {
      sub._deactivate();
    });
    self._universalSubs = [];
  },
  // Determine the remote client's IP address, based on the
  // HTTP_FORWARDED_COUNT environment variable representing how many
  // proxies the server is behind.
  _clientAddress: function () {
    var self = this;

    // For the reported client address for a connection to be correct,
    // the developer must set the HTTP_FORWARDED_COUNT environment
    // variable to an integer representing the number of hops they
    // expect in the `x-forwarded-for` header. E.g., set to "1" if the
    // server is behind one proxy.
    //
    // This could be computed once at startup instead of every time.
    var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;
    if (httpForwardedCount === 0) return self.socket.remoteAddress;
    var forwardedFor = self.socket.headers["x-forwarded-for"];
    if (!_.isString(forwardedFor)) return null;
    forwardedFor = forwardedFor.trim().split(/\s*,\s*/);

    // Typically the first value in the `x-forwarded-for` header is
    // the original IP address of the client connecting to the first
    // proxy.  However, the end user can easily spoof the header, in
    // which case the first value(s) will be the fake IP address from
    // the user pretending to be a proxy reporting the original IP
    // address value.  By counting HTTP_FORWARDED_COUNT back from the
    // end of the list, we ensure that we get the IP address being
    // reported by *our* first proxy.

    if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length) return null;
    return forwardedFor[forwardedFor.length - httpForwardedCount];
  }
});

/******************************************************************************/
/* Subscription                                                               */
/******************************************************************************/

// Ctor for a sub handle: the input to each publish function

// Instance name is this because it's usually referred to as this inside a
// publish
/**
 * @summary The server's side of a subscription
 * @class Subscription
 * @instanceName this
 * @showInstanceName true
 */
var Subscription = function (session, handler, subscriptionId, params, name) {
  var self = this;
  self._session = session; // type is Session

  /**
   * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
   * @locus Server
   * @name  connection
   * @memberOf Subscription
   * @instance
   */
  self.connection = session.connectionHandle; // public API object

  self._handler = handler;

  // My subscription ID (generated by client, undefined for universal subs).
  self._subscriptionId = subscriptionId;
  // Undefined for universal subs
  self._name = name;
  self._params = params || [];

  // Only named subscriptions have IDs, but we need some sort of string
  // internally to keep track of all subscriptions inside
  // SessionDocumentViews. We use this subscriptionHandle for that.
  if (self._subscriptionId) {
    self._subscriptionHandle = 'N' + self._subscriptionId;
  } else {
    self._subscriptionHandle = 'U' + Random.id();
  }

  // Has _deactivate been called?
  self._deactivated = false;

  // Stop callbacks to g/c this sub.  called w/ zero arguments.
  self._stopCallbacks = [];

  // The set of (collection, documentid) that this subscription has
  // an opinion about.
  self._documents = new Map();

  // Remember if we are ready.
  self._ready = false;

  // Part of the public API: the user of this sub.

  /**
   * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.
   * @locus Server
   * @memberOf Subscription
   * @name  userId
   * @instance
   */
  self.userId = session.userId;

  // For now, the id filter is going to default to
  // the to/from DDP methods on MongoID, to
  // specifically deal with mongo/minimongo ObjectIds.

  // Later, you will be able to make this be "raw"
  // if you want to publish a collection that you know
  // just has strings for keys and no funny business, to
  // a DDP consumer that isn't minimongo.

  self._idFilter = {
    idStringify: MongoID.idStringify,
    idParse: MongoID.idParse
  };
  Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", 1);
};
Object.assign(Subscription.prototype, {
  _runHandler: function () {
    // XXX should we unblock() here? Either before running the publish
    // function, or before running _publishCursor.
    //
    // Right now, each publish function blocks all future publishes and
    // methods waiting on data from Mongo (or whatever else the function
    // blocks on). This probably slows page load in common cases.

    if (!this.unblock) {
      this.unblock = () => {};
    }
    const self = this;
    let resultOrThenable = null;
    try {
      resultOrThenable = DDP._CurrentPublicationInvocation.withValue(self, () => maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),
      // It's OK that this would look weird for universal subscriptions,
      // because they have no arguments so there can never be an
      // audit-argument-checks failure.
      "publisher '" + self._name + "'"));
    } catch (e) {
      self.error(e);
      return;
    }

    // Did the handler call this.error or this.stop?
    if (self._isDeactivated()) return;

    // Both conventional and async publish handler functions are supported.
    // If an object is returned with a then() function, it is either a promise
    // or thenable and will be resolved asynchronously.
    const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
    if (isThenable) {
      Promise.resolve(resultOrThenable).then(function () {
        return self._publishHandlerResult.bind(self)(...arguments);
      }, e => self.error(e));
    } else {
      self._publishHandlerResult(resultOrThenable);
    }
  },
  _publishHandlerResult: function (res) {
    // SPECIAL CASE: Instead of writing their own callbacks that invoke
    // this.added/changed/ready/etc, the user can just return a collection
    // cursor or array of cursors from the publish function; we call their
    // _publishCursor method which starts observing the cursor and publishes the
    // results. Note that _publishCursor does NOT call ready().
    //
    // XXX This uses an undocumented interface which only the Mongo cursor
    // interface publishes. Should we make this interface public and encourage
    // users to implement it themselves? Arguably, it's unnecessary; users can
    // already write their own functions like
    //   var publishMyReactiveThingy = function (name, handler) {
    //     Meteor.publish(name, function () {
    //       var reactiveThingy = handler();
    //       reactiveThingy.publishMe();
    //     });
    //   };

    var self = this;
    var isCursor = function (c) {
      return c && c._publishCursor;
    };
    if (isCursor(res)) {
      try {
        res._publishCursor(self);
      } catch (e) {
        self.error(e);
        return;
      }
      // _publishCursor only returns after the initial added callbacks have run.
      // mark subscription as ready.
      self.ready();
    } else if (_.isArray(res)) {
      // Check all the elements are cursors
      if (!_.all(res, isCursor)) {
        self.error(new Error("Publish function returned an array of non-Cursors"));
        return;
      }
      // Find duplicate collection names
      // XXX we should support overlapping cursors, but that would require the
      // merge box to allow overlap within a subscription
      var collectionNames = {};
      for (var i = 0; i < res.length; ++i) {
        var collectionName = res[i]._getCollectionName();
        if (_.has(collectionNames, collectionName)) {
          self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));
          return;
        }
        collectionNames[collectionName] = true;
      }
      ;
      try {
        _.each(res, function (cur) {
          cur._publishCursor(self);
        });
      } catch (e) {
        self.error(e);
        return;
      }
      self.ready();
    } else if (res) {
      // Truthy values other than cursors or arrays are probably a
      // user mistake (possible returning a Mongo document via, say,
      // `coll.findOne()`).
      self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));
    }
  },
  // This calls all stop callbacks and prevents the handler from updating any
  // SessionCollectionViews further. It's used when the user unsubscribes or
  // disconnects, as well as during setUserId re-runs. It does *NOT* send
  // removed messages for the published objects; if that is necessary, call
  // _removeAllDocuments first.
  _deactivate: function () {
    var self = this;
    if (self._deactivated) return;
    self._deactivated = true;
    self._callStopCallbacks();
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", -1);
  },
  _callStopCallbacks: function () {
    var self = this;
    // Tell listeners, so they can clean up
    var callbacks = self._stopCallbacks;
    self._stopCallbacks = [];
    _.each(callbacks, function (callback) {
      callback();
    });
  },
  // Send remove messages for every document.
  _removeAllDocuments: function () {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._documents.forEach(function (collectionDocs, collectionName) {
        collectionDocs.forEach(function (strId) {
          self.removed(collectionName, self._idFilter.idParse(strId));
        });
      });
    });
  },
  // Returns a new Subscription for the same session with the same
  // initial creation parameters. This isn't a clone: it doesn't have
  // the same _documents cache, stopped state or callbacks; may have a
  // different _subscriptionHandle, and gets its userId from the
  // session, not from this object.
  _recreate: function () {
    var self = this;
    return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);
  },
  /**
   * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
   * @locus Server
   * @param {Error} error The error to pass to the client.
   * @instance
   * @memberOf Subscription
   */
  error: function (error) {
    var self = this;
    if (self._isDeactivated()) return;
    self._session._stopSubscription(self._subscriptionId, error);
  },
  // Note that while our DDP client will notice that you've called stop() on the
  // server (and clean up its _subscriptions table) we don't actually provide a
  // mechanism for an app to notice this (the subscribe onError callback only
  // triggers if there is an error).

  /**
   * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
   * @locus Server
   * @instance
   * @memberOf Subscription
   */
  stop: function () {
    var self = this;
    if (self._isDeactivated()) return;
    self._session._stopSubscription(self._subscriptionId);
  },
  /**
   * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
   * @locus Server
   * @memberOf Subscription
   * @instance
   * @param {Function} func The callback function
   */
  onStop: function (callback) {
    var self = this;
    callback = Meteor.bindEnvironment(callback, 'onStop callback', self);
    if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);
  },
  // This returns true if the sub has been deactivated, *OR* if the session was
  // destroyed but the deferred call to _deactivateAllSubscriptions hasn't
  // happened yet.
  _isDeactivated: function () {
    var self = this;
    return self._deactivated || self._session.inQueue === null;
  },
  /**
   * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
   * @locus Server
   * @memberOf Subscription
   * @instance
   * @param {String} collection The name of the collection that contains the new document.
   * @param {String} id The new document's ID.
   * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.
   */
  added(collectionName, id, fields) {
    if (this._isDeactivated()) return;
    id = this._idFilter.idStringify(id);
    if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
      let ids = this._documents.get(collectionName);
      if (ids == null) {
        ids = new Set();
        this._documents.set(collectionName, ids);
      }
      ids.add(id);
    }
    this._session.added(this._subscriptionHandle, collectionName, id, fields);
  },
  /**
   * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
   * @locus Server
   * @memberOf Subscription
   * @instance
   * @param {String} collection The name of the collection that contains the changed document.
   * @param {String} id The changed document's ID.
   * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
   */
  changed(collectionName, id, fields) {
    if (this._isDeactivated()) return;
    id = this._idFilter.idStringify(id);
    this._session.changed(this._subscriptionHandle, collectionName, id, fields);
  },
  /**
   * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
   * @locus Server
   * @memberOf Subscription
   * @instance
   * @param {String} collection The name of the collection that the document has been removed from.
   * @param {String} id The ID of the document that has been removed.
   */
  removed(collectionName, id) {
    if (this._isDeactivated()) return;
    id = this._idFilter.idStringify(id);
    if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
      // We don't bother to delete sets of things in a collection if the
      // collection is empty.  It could break _removeAllDocuments.
      this._documents.get(collectionName).delete(id);
    }
    this._session.removed(this._subscriptionHandle, collectionName, id);
  },
  /**
   * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
   * @locus Server
   * @memberOf Subscription
   * @instance
   */
  ready: function () {
    var self = this;
    if (self._isDeactivated()) return;
    if (!self._subscriptionId) return; // Unnecessary but ignored for universal sub
    if (!self._ready) {
      self._session.sendReady([self._subscriptionId]);
      self._ready = true;
    }
  }
});

/******************************************************************************/
/* Server                                                                     */
/******************************************************************************/

Server = function () {
  let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var self = this;

  // The default heartbeat interval is 30 seconds on the server and 35
  // seconds on the client.  Since the client doesn't need to send a
  // ping as long as it is receiving pings, this means that pings
  // normally go from the server to the client.
  //
  // Note: Troposphere depends on the ability to mutate
  // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
  self.options = _objectSpread({
    heartbeatInterval: 15000,
    heartbeatTimeout: 15000,
    // For testing, allow responding to pings to be disabled.
    respondToPings: true,
    defaultPublicationStrategy: publicationStrategies.SERVER_MERGE
  }, options);

  // Map of callbacks to call when a new connection comes in to the
  // server and completes DDP version negotiation. Use an object instead
  // of an array so we can safely remove one from the list while
  // iterating over it.
  self.onConnectionHook = new Hook({
    debugPrintExceptions: "onConnection callback"
  });

  // Map of callbacks to call when a new message comes in.
  self.onMessageHook = new Hook({
    debugPrintExceptions: "onMessage callback"
  });
  self.publish_handlers = {};
  self.universal_publish_handlers = [];
  self.method_handlers = {};
  self._publicationStrategies = {};
  self.sessions = new Map(); // map from id to session

  self.stream_server = new StreamServer();
  self.stream_server.register(function (socket) {
    // socket implements the SockJSConnection interface
    socket._meteorSession = null;
    var sendError = function (reason, offendingMessage) {
      var msg = {
        msg: 'error',
        reason: reason
      };
      if (offendingMessage) msg.offendingMessage = offendingMessage;
      socket.send(DDPCommon.stringifyDDP(msg));
    };
    socket.on('data', function (raw_msg) {
      if (Meteor._printReceivedDDP) {
        Meteor._debug("Received DDP", raw_msg);
      }
      try {
        try {
          var msg = DDPCommon.parseDDP(raw_msg);
        } catch (err) {
          sendError('Parse error');
          return;
        }
        if (msg === null || !msg.msg) {
          sendError('Bad request', msg);
          return;
        }
        if (msg.msg === 'connect') {
          if (socket._meteorSession) {
            sendError("Already connected", msg);
            return;
          }
          Fiber(function () {
            self._handleConnect(socket, msg);
          }).run();
          return;
        }
        if (!socket._meteorSession) {
          sendError('Must connect first', msg);
          return;
        }
        socket._meteorSession.processMessage(msg);
      } catch (e) {
        // XXX print stack nicely
        Meteor._debug("Internal exception while processing message", msg, e);
      }
    });
    socket.on('close', function () {
      if (socket._meteorSession) {
        Fiber(function () {
          socket._meteorSession.close();
        }).run();
      }
    });
  });
};
Object.assign(Server.prototype, {
  /**
   * @summary Register a callback to be called when a new DDP connection is made to the server.
   * @locus Server
   * @param {function} callback The function to call when a new DDP connection is established.
   * @memberOf Meteor
   * @importFromPackage meteor
   */
  onConnection: function (fn) {
    var self = this;
    return self.onConnectionHook.register(fn);
  },
  /**
   * @summary Set publication strategy for the given collection. Publications strategies are available from `DDPServer.publicationStrategies`. You call this method from `Meteor.server`, like `Meteor.server.setPublicationStrategy()`
   * @locus Server
   * @alias setPublicationStrategy
   * @param collectionName {String}
   * @param strategy {{useCollectionView: boolean, doAccountingForCollection: boolean}}
   * @memberOf Meteor.server
   * @importFromPackage meteor
   */
  setPublicationStrategy(collectionName, strategy) {
    if (!Object.values(publicationStrategies).includes(strategy)) {
      throw new Error("Invalid merge strategy: ".concat(strategy, " \n        for collection ").concat(collectionName));
    }
    this._publicationStrategies[collectionName] = strategy;
  },
  /**
   * @summary Gets the publication strategy for the requested collection. You call this method from `Meteor.server`, like `Meteor.server.getPublicationStrategy()`
   * @locus Server
   * @alias getPublicationStrategy
   * @param collectionName {String}
   * @memberOf Meteor.server
   * @importFromPackage meteor
   * @return {{useCollectionView: boolean, doAccountingForCollection: boolean}}
   */
  getPublicationStrategy(collectionName) {
    return this._publicationStrategies[collectionName] || this.options.defaultPublicationStrategy;
  },
  /**
   * @summary Register a callback to be called when a new DDP message is received.
   * @locus Server
   * @param {function} callback The function to call when a new DDP message is received.
   * @memberOf Meteor
   * @importFromPackage meteor
   */
  onMessage: function (fn) {
    var self = this;
    return self.onMessageHook.register(fn);
  },
  _handleConnect: function (socket, msg) {
    var self = this;

    // The connect message must specify a version and an array of supported
    // versions, and it must claim to support what it is proposing.
    if (!(typeof msg.version === 'string' && _.isArray(msg.support) && _.all(msg.support, _.isString) && _.contains(msg.support, msg.version))) {
      socket.send(DDPCommon.stringifyDDP({
        msg: 'failed',
        version: DDPCommon.SUPPORTED_DDP_VERSIONS[0]
      }));
      socket.close();
      return;
    }

    // In the future, handle session resumption: something like:
    //  socket._meteorSession = self.sessions[msg.session]
    var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);
    if (msg.version !== version) {
      // The best version to use (according to the client's stated preferences)
      // is not the one the client is trying to use. Inform them about the best
      // version to use.
      socket.send(DDPCommon.stringifyDDP({
        msg: 'failed',
        version: version
      }));
      socket.close();
      return;
    }

    // Yay, version matches! Create a new session.
    // Note: Troposphere depends on the ability to mutate
    // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
    socket._meteorSession = new Session(self, version, socket, self.options);
    self.sessions.set(socket._meteorSession.id, socket._meteorSession);
    self.onConnectionHook.each(function (callback) {
      if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);
      return true;
    });
  },
  /**
   * Register a publish handler function.
   *
   * @param name {String} identifier for query
   * @param handler {Function} publish handler
   * @param options {Object}
   *
   * Server will call handler function on each new subscription,
   * either when receiving DDP sub message for a named subscription, or on
   * DDP connect for a universal subscription.
   *
   * If name is null, this will be a subscription that is
   * automatically established and permanently on for all connected
   * client, instead of a subscription that can be turned on and off
   * with subscribe().
   *
   * options to contain:
   *  - (mostly internal) is_auto: true if generated automatically
   *    from an autopublish hook. this is for cosmetic purposes only
   *    (it lets us determine whether to print a warning suggesting
   *    that you turn off autopublish).
   */

  /**
   * @summary Publish a record set.
   * @memberOf Meteor
   * @importFromPackage meteor
   * @locus Server
   * @param {String|Object} name If String, name of the record set.  If Object, publications Dictionary of publish functions by name.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
   * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
   */
  publish: function (name, handler, options) {
    var self = this;
    if (!_.isObject(name)) {
      options = options || {};
      if (name && name in self.publish_handlers) {
        Meteor._debug("Ignoring duplicate publish named '" + name + "'");
        return;
      }
      if (Package.autopublish && !options.is_auto) {
        // They have autopublish on, yet they're trying to manually
        // pick stuff to publish. They probably should turn off
        // autopublish. (This check isn't perfect -- if you create a
        // publish before you turn on autopublish, it won't catch
        // it, but this will definitely handle the simple case where
        // you've added the autopublish package to your app, and are
        // calling publish from your app code).
        if (!self.warned_about_autopublish) {
          self.warned_about_autopublish = true;
          Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
        }
      }
      if (name) self.publish_handlers[name] = handler;else {
        self.universal_publish_handlers.push(handler);
        // Spin up the new publisher on any existing session too. Run each
        // session's subscription in a new Fiber, so that there's no change for
        // self.sessions to change while we're running this loop.
        self.sessions.forEach(function (session) {
          if (!session._dontStartNewUniversalSubs) {
            Fiber(function () {
              session._startSubscription(handler);
            }).run();
          }
        });
      }
    } else {
      _.each(name, function (value, key) {
        self.publish(key, value, {});
      });
    }
  },
  _removeSession: function (session) {
    var self = this;
    self.sessions.delete(session.id);
  },
  /**
   * @summary Defines functions that can be invoked over the network by clients.
   * @locus Anywhere
   * @param {Object} methods Dictionary whose keys are method names and values are functions.
   * @memberOf Meteor
   * @importFromPackage meteor
   */
  methods: function (methods) {
    var self = this;
    _.each(methods, function (func, name) {
      if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");
      if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");
      self.method_handlers[name] = func;
    });
  },
  call: function (name) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    if (args.length && typeof args[args.length - 1] === "function") {
      // If it's a function, the last argument is the result callback, not
      // a parameter to the remote method.
      var callback = args.pop();
    }
    return this.apply(name, args, callback);
  },
  // A version of the call method that always returns a Promise.
  callAsync: function (name) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    return this.applyAsync(name, args);
  },
  apply: function (name, args, options, callback) {
    // We were passed 3 arguments. They may be either (name, args, options)
    // or (name, args, callback)
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    } else {
      options = options || {};
    }
    const promise = this.applyAsync(name, args, options);

    // Return the result in whichever way the caller asked for it. Note that we
    // do NOT block on the write fence in an analogous way to how the client
    // blocks on the relevant data being visible, so you are NOT guaranteed that
    // cursor observe callbacks have fired when your callback is invoked. (We
    // can change this if there's a real use case).
    if (callback) {
      promise.then(result => callback(undefined, result), exception => callback(exception));
    } else {
      return promise.await();
    }
  },
  // @param options {Optional Object}
  applyAsync: function (name, args, options) {
    // Run the handler
    var handler = this.method_handlers[name];
    if (!handler) {
      return Promise.reject(new Meteor.Error(404, "Method '".concat(name, "' not found")));
    }

    // If this is a method call from within another method or publish function,
    // get the user state from the outer method or publish function, otherwise
    // don't allow setUserId to be called
    var userId = null;
    var setUserId = function () {
      throw new Error("Can't call setUserId on a server initiated method call");
    };
    var connection = null;
    var currentMethodInvocation = DDP._CurrentMethodInvocation.get();
    var currentPublicationInvocation = DDP._CurrentPublicationInvocation.get();
    var randomSeed = null;
    if (currentMethodInvocation) {
      userId = currentMethodInvocation.userId;
      setUserId = function (userId) {
        currentMethodInvocation.setUserId(userId);
      };
      connection = currentMethodInvocation.connection;
      randomSeed = DDPCommon.makeRpcSeed(currentMethodInvocation, name);
    } else if (currentPublicationInvocation) {
      userId = currentPublicationInvocation.userId;
      setUserId = function (userId) {
        currentPublicationInvocation._session._setUserId(userId);
      };
      connection = currentPublicationInvocation.connection;
    }
    var invocation = new DDPCommon.MethodInvocation({
      isSimulation: false,
      userId,
      setUserId,
      connection,
      randomSeed
    });
    return new Promise(resolve => resolve(DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'")))).then(EJSON.clone);
  },
  _urlForSession: function (sessionId) {
    var self = this;
    var session = self.sessions.get(sessionId);
    if (session) return session._socketUrl;else return null;
  }
});
var calculateVersion = function (clientSupportedVersions, serverSupportedVersions) {
  var correctVersion = _.find(clientSupportedVersions, function (version) {
    return _.contains(serverSupportedVersions, version);
  });
  if (!correctVersion) {
    correctVersion = serverSupportedVersions[0];
  }
  return correctVersion;
};
DDPServer._calculateVersion = calculateVersion;

// "blind" exceptions other than those that were deliberately thrown to signal
// errors to the client
var wrapInternalException = function (exception, context) {
  if (!exception) return exception;

  // To allow packages to throw errors intended for the client but not have to
  // depend on the Meteor.Error class, `isClientSafe` can be set to true on any
  // error before it is thrown.
  if (exception.isClientSafe) {
    if (!(exception instanceof Meteor.Error)) {
      const originalMessage = exception.message;
      exception = new Meteor.Error(exception.error, exception.reason, exception.details);
      exception.message = originalMessage;
    }
    return exception;
  }

  // Tests can set the '_expectedByTest' flag on an exception so it won't go to
  // the server log.
  if (!exception._expectedByTest) {
    Meteor._debug("Exception " + context, exception.stack);
    if (exception.sanitizedError) {
      Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError);
      Meteor._debug();
    }
  }

  // Did the error contain more details that could have been useful if caught in
  // server code (or if thrown from non-client-originated code), but also
  // provided a "sanitized" version with more context than 500 Internal server
  // error? Use that.
  if (exception.sanitizedError) {
    if (exception.sanitizedError.isClientSafe) return exception.sanitizedError;
    Meteor._debug("Exception " + context + " provides a sanitizedError that " + "does not have isClientSafe property set; ignoring");
  }
  return new Meteor.Error(500, "Internal server error");
};

// Audit argument checks, if the audit-argument-checks package exists (it is a
// weak dependency of this package).
var maybeAuditArgumentChecks = function (f, context, args, description) {
  args = args || [];
  if (Package['audit-argument-checks']) {
    return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);
  }
  return f.apply(context, args);
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"writefence.js":function module(require){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/writefence.js                                                                                 //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var Future = Npm.require('fibers/future');

// A write fence collects a group of writes, and provides a callback
// when all of the writes are fully committed and propagated (all
// observers have been notified of the write and acknowledged it.)
//
DDPServer._WriteFence = function () {
  var self = this;
  self.armed = false;
  self.fired = false;
  self.retired = false;
  self.outstanding_writes = 0;
  self.before_fire_callbacks = [];
  self.completion_callbacks = [];
};

// The current write fence. When there is a current write fence, code
// that writes to databases should register their writes with it using
// beginWrite().
//
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();
_.extend(DDPServer._WriteFence.prototype, {
  // Start tracking a write, and return an object to represent it. The
  // object has a single method, committed(). This method should be
  // called when the write is fully committed and propagated. You can
  // continue to add writes to the WriteFence up until it is triggered
  // (calls its callbacks because all writes have committed.)
  beginWrite: function () {
    var self = this;
    if (self.retired) return {
      committed: function () {}
    };
    if (self.fired) throw new Error("fence has already activated -- too late to add writes");
    self.outstanding_writes++;
    var committed = false;
    return {
      committed: function () {
        if (committed) throw new Error("committed called twice on the same write");
        committed = true;
        self.outstanding_writes--;
        self._maybeFire();
      }
    };
  },
  // Arm the fence. Once the fence is armed, and there are no more
  // uncommitted writes, it will activate.
  arm: function () {
    var self = this;
    if (self === DDPServer._CurrentWriteFence.get()) throw Error("Can't arm the current fence");
    self.armed = true;
    self._maybeFire();
  },
  // Register a function to be called once before firing the fence.
  // Callback function can add new writes to the fence, in which case
  // it won't fire until those writes are done as well.
  onBeforeFire: function (func) {
    var self = this;
    if (self.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    self.before_fire_callbacks.push(func);
  },
  // Register a function to be called when the fence fires.
  onAllCommitted: function (func) {
    var self = this;
    if (self.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    self.completion_callbacks.push(func);
  },
  // Convenience function. Arms the fence, then blocks until it fires.
  armAndWait: function () {
    var self = this;
    var future = new Future();
    self.onAllCommitted(function () {
      future['return']();
    });
    self.arm();
    future.wait();
  },
  _maybeFire: function () {
    var self = this;
    if (self.fired) throw new Error("write fence already activated?");
    if (self.armed && !self.outstanding_writes) {
      function invokeCallback(func) {
        try {
          func(self);
        } catch (err) {
          Meteor._debug("exception in write fence callback", err);
        }
      }
      self.outstanding_writes++;
      while (self.before_fire_callbacks.length > 0) {
        var callbacks = self.before_fire_callbacks;
        self.before_fire_callbacks = [];
        _.each(callbacks, invokeCallback);
      }
      self.outstanding_writes--;
      if (!self.outstanding_writes) {
        self.fired = true;
        var callbacks = self.completion_callbacks;
        self.completion_callbacks = [];
        _.each(callbacks, invokeCallback);
      }
    }
  },
  // Deactivate this fence so that adding more writes has no effect.
  // The fence must have already fired.
  retire: function () {
    var self = this;
    if (!self.fired) throw new Error("Can't retire a fence that hasn't fired.");
    self.retired = true;
  }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function module(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/crossbar.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
// A "crossbar" is a class that provides structured notification registration.
// See _match for the definition of how a notification matches a trigger.
// All notifications and triggers must have a string key named 'collection'.

DDPServer._Crossbar = function (options) {
  var self = this;
  options = options || {};
  self.nextId = 1;
  // map from collection name (string) -> listener id -> object. each object has
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no
  // collection".
  self.listenersByCollection = {};
  self.listenersByCollectionCount = {};
  self.factPackage = options.factPackage || "livedata";
  self.factName = options.factName || null;
};
_.extend(DDPServer._Crossbar.prototype, {
  // msg is a trigger or a notification
  _collectionForMessage: function (msg) {
    var self = this;
    if (!_.has(msg, 'collection')) {
      return '';
    } else if (typeof msg.collection === 'string') {
      if (msg.collection === '') throw Error("Message has empty collection!");
      return msg.collection;
    } else {
      throw Error("Message has non-string collection!");
    }
  },
  // Listen for notification that match 'trigger'. A notification
  // matches if it has the key-value pairs in trigger as a
  // subset. When a notification matches, call 'callback', passing
  // the actual notification.
  //
  // Returns a listen handle, which is an object with a method
  // stop(). Call stop() to stop listening.
  //
  // XXX It should be legal to call fire() from inside a listen()
  // callback?
  listen: function (trigger, callback) {
    var self = this;
    var id = self.nextId++;
    var collection = self._collectionForMessage(trigger);
    var record = {
      trigger: EJSON.clone(trigger),
      callback: callback
    };
    if (!_.has(self.listenersByCollection, collection)) {
      self.listenersByCollection[collection] = {};
      self.listenersByCollectionCount[collection] = 0;
    }
    self.listenersByCollection[collection][id] = record;
    self.listenersByCollectionCount[collection]++;
    if (self.factName && Package['facts-base']) {
      Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, 1);
    }
    return {
      stop: function () {
        if (self.factName && Package['facts-base']) {
          Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, -1);
        }
        delete self.listenersByCollection[collection][id];
        self.listenersByCollectionCount[collection]--;
        if (self.listenersByCollectionCount[collection] === 0) {
          delete self.listenersByCollection[collection];
          delete self.listenersByCollectionCount[collection];
        }
      }
    };
  },
  // Fire the provided 'notification' (an object whose attribute
  // values are all JSON-compatibile) -- inform all matching listeners
  // (registered with listen()).
  //
  // If fire() is called inside a write fence, then each of the
  // listener callbacks will be called inside the write fence as well.
  //
  // The listeners may be invoked in parallel, rather than serially.
  fire: function (notification) {
    var self = this;
    var collection = self._collectionForMessage(notification);
    if (!_.has(self.listenersByCollection, collection)) {
      return;
    }
    var listenersForCollection = self.listenersByCollection[collection];
    var callbackIds = [];
    _.each(listenersForCollection, function (l, id) {
      if (self._matches(notification, l.trigger)) {
        callbackIds.push(id);
      }
    });

    // Listener callbacks can yield, so we need to first find all the ones that
    // match in a single iteration over self.listenersByCollection (which can't
    // be mutated during this iteration), and then invoke the matching
    // callbacks, checking before each call to ensure they haven't stopped.
    // Note that we don't have to check that
    // self.listenersByCollection[collection] still === listenersForCollection,
    // because the only way that stops being true is if listenersForCollection
    // first gets reduced down to the empty object (and then never gets
    // increased again).
    _.each(callbackIds, function (id) {
      if (_.has(listenersForCollection, id)) {
        listenersForCollection[id].callback(notification);
      }
    });
  },
  // A notification matches a trigger if all keys that exist in both are equal.
  //
  // Examples:
  //  N:{collection: "C"} matches T:{collection: "C"}
  //    (a non-targeted write to a collection matches a
  //     non-targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}
  //    (a targeted write to a collection matches a non-targeted query)
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}
  //    (a non-targeted write to a collection matches a
  //     targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}
  //    (a targeted write to a collection matches a targeted query targeted
  //     at the same document)
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}
  //    (a targeted write to a collection does not match a targeted query
  //     targeted at a different document)
  _matches: function (notification, trigger) {
    // Most notifications that use the crossbar have a string `collection` and
    // maybe an `id` that is a string or ObjectID. We're already dividing up
    // triggers by collection, but let's fast-track "nope, different ID" (and
    // avoid the overly generic EJSON.equals). This makes a noticeable
    // performance difference; see https://github.com/meteor/meteor/pull/3697
    if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
      return false;
    }
    if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
      return false;
    }
    return _.all(trigger, function (triggerValue, key) {
      return !_.has(notification, key) || EJSON.equals(triggerValue, notification[key]);
    });
  }
});

// The "invalidation crossbar" is a specific instance used by the DDP server to
// implement write fence notifications. Listener callbacks on this crossbar
// should call beginWrite on the current write fence before they return, if they
// want to delay the write fence from firing (ie, the DDP method-data-updated
// message from being sent).
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({
  factName: "invalidation-crossbar-listeners"
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function module(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/ddp-server/server_convenience.js                                                                         //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;
}
Meteor.server = new Server();
Meteor.refresh = function (notification) {
  DDPServer._InvalidationCrossbar.fire(notification);
};

// Proxy the public methods of Meteor.server so they can
// be called directly on Meteor.
_.each(['publish', 'methods', 'call', 'callAsync', 'apply', 'applyAsync', 'onConnection', 'onMessage'], function (name) {
  Meteor[name] = _.bind(Meteor.server[name], Meteor.server);
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/ddp-server/stream_server.js");
require("/node_modules/meteor/ddp-server/livedata_server.js");
require("/node_modules/meteor/ddp-server/writefence.js");
require("/node_modules/meteor/ddp-server/crossbar.js");
require("/node_modules/meteor/ddp-server/server_convenience.js");

/* Exports */
Package._define("ddp-server", {
  DDPServer: DDPServer
});

})();

//# sourceURL=meteor://💻app/packages/ddp-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9zdHJlYW1fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2xpdmVkYXRhX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci93cml0ZWZlbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2Nyb3NzYmFyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3NlcnZlcl9jb252ZW5pZW5jZS5qcyJdLCJuYW1lcyI6WyJ3ZWJzb2NrZXRFeHRlbnNpb25zIiwiXyIsIm9uY2UiLCJleHRlbnNpb25zIiwid2Vic29ja2V0Q29tcHJlc3Npb25Db25maWciLCJwcm9jZXNzIiwiZW52IiwiU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiIsIkpTT04iLCJwYXJzZSIsInB1c2giLCJOcG0iLCJyZXF1aXJlIiwiY29uZmlndXJlIiwicGF0aFByZWZpeCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsIlN0cmVhbVNlcnZlciIsInNlbGYiLCJyZWdpc3RyYXRpb25fY2FsbGJhY2tzIiwib3Blbl9zb2NrZXRzIiwicHJlZml4IiwiUm91dGVQb2xpY3kiLCJkZWNsYXJlIiwic29ja2pzIiwic2VydmVyT3B0aW9ucyIsImxvZyIsImhlYXJ0YmVhdF9kZWxheSIsImRpc2Nvbm5lY3RfZGVsYXkiLCJqc2Vzc2lvbmlkIiwiVVNFX0pTRVNTSU9OSUQiLCJESVNBQkxFX1dFQlNPQ0tFVFMiLCJ3ZWJzb2NrZXQiLCJmYXllX3NlcnZlcl9vcHRpb25zIiwic2VydmVyIiwiY3JlYXRlU2VydmVyIiwiV2ViQXBwIiwiaHR0cFNlcnZlciIsInJlbW92ZUxpc3RlbmVyIiwiX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrIiwiaW5zdGFsbEhhbmRsZXJzIiwiYWRkTGlzdGVuZXIiLCJfcmVkaXJlY3RXZWJzb2NrZXRFbmRwb2ludCIsIm9uIiwic29ja2V0Iiwic2V0V2Vic29ja2V0VGltZW91dCIsInRpbWVvdXQiLCJwcm90b2NvbCIsIl9zZXNzaW9uIiwicmVjdiIsImNvbm5lY3Rpb24iLCJzZXRUaW1lb3V0Iiwic2VuZCIsImRhdGEiLCJ3cml0ZSIsIndpdGhvdXQiLCJURVNUX01FVEFEQVRBIiwic3RyaW5naWZ5IiwidGVzdE1lc3NhZ2VPbkNvbm5lY3QiLCJlYWNoIiwiY2FsbGJhY2siLCJPYmplY3QiLCJhc3NpZ24iLCJwcm90b3R5cGUiLCJyZWdpc3RlciIsImFsbF9zb2NrZXRzIiwidmFsdWVzIiwiZm9yRWFjaCIsImV2ZW50Iiwib2xkSHR0cFNlcnZlckxpc3RlbmVycyIsImxpc3RlbmVycyIsInNsaWNlIiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwibmV3TGlzdGVuZXIiLCJyZXF1ZXN0IiwiYXJncyIsImFyZ3VtZW50cyIsInVybCIsInBhcnNlZFVybCIsInBhdGhuYW1lIiwiZm9ybWF0Iiwib2xkTGlzdGVuZXIiLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJERFBTZXJ2ZXIiLCJGaWJlciIsInB1YmxpY2F0aW9uU3RyYXRlZ2llcyIsIlNFUlZFUl9NRVJHRSIsInVzZUNvbGxlY3Rpb25WaWV3IiwiZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbiIsIk5PX01FUkdFX05PX0hJU1RPUlkiLCJOT19NRVJHRSIsIlNlc3Npb25Eb2N1bWVudFZpZXciLCJleGlzdHNJbiIsIlNldCIsImRhdGFCeUtleSIsIk1hcCIsIl9TZXNzaW9uRG9jdW1lbnRWaWV3IiwiZXh0ZW5kIiwiZ2V0RmllbGRzIiwicmV0IiwicHJlY2VkZW5jZUxpc3QiLCJrZXkiLCJ2YWx1ZSIsImNsZWFyRmllbGQiLCJzdWJzY3JpcHRpb25IYW5kbGUiLCJjaGFuZ2VDb2xsZWN0b3IiLCJnZXQiLCJyZW1vdmVkVmFsdWUiLCJ1bmRlZmluZWQiLCJpIiwibGVuZ3RoIiwicHJlY2VkZW5jZSIsInNwbGljZSIsImRlbGV0ZSIsIkVKU09OIiwiZXF1YWxzIiwiY2hhbmdlRmllbGQiLCJpc0FkZCIsImNsb25lIiwiaGFzIiwic2V0IiwiZWx0IiwiZmluZCIsIlNlc3Npb25Db2xsZWN0aW9uVmlldyIsImNvbGxlY3Rpb25OYW1lIiwic2Vzc2lvbkNhbGxiYWNrcyIsImRvY3VtZW50cyIsImNhbGxiYWNrcyIsIl9TZXNzaW9uQ29sbGVjdGlvblZpZXciLCJpc0VtcHR5Iiwic2l6ZSIsImRpZmYiLCJwcmV2aW91cyIsIkRpZmZTZXF1ZW5jZSIsImRpZmZNYXBzIiwiYm90aCIsImJpbmQiLCJkaWZmRG9jdW1lbnQiLCJyaWdodE9ubHkiLCJpZCIsIm5vd0RWIiwiYWRkZWQiLCJsZWZ0T25seSIsInByZXZEViIsInJlbW92ZWQiLCJmaWVsZHMiLCJkaWZmT2JqZWN0cyIsInByZXYiLCJub3ciLCJjaGFuZ2VkIiwiZG9jVmlldyIsImFkZCIsImNoYW5nZWRSZXN1bHQiLCJFcnJvciIsImVyciIsIlNlc3Npb24iLCJ2ZXJzaW9uIiwib3B0aW9ucyIsIlJhbmRvbSIsImluaXRpYWxpemVkIiwiaW5RdWV1ZSIsIk1ldGVvciIsIl9Eb3VibGVFbmRlZFF1ZXVlIiwiYmxvY2tlZCIsIndvcmtlclJ1bm5pbmciLCJjYWNoZWRVbmJsb2NrIiwiX25hbWVkU3VicyIsIl91bml2ZXJzYWxTdWJzIiwidXNlcklkIiwiY29sbGVjdGlvblZpZXdzIiwiX2lzU2VuZGluZyIsIl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzIiwiX3BlbmRpbmdSZWFkeSIsIl9jbG9zZUNhbGxiYWNrcyIsIl9zb2NrZXRVcmwiLCJfcmVzcG9uZFRvUGluZ3MiLCJyZXNwb25kVG9QaW5ncyIsImNvbm5lY3Rpb25IYW5kbGUiLCJjbG9zZSIsIm9uQ2xvc2UiLCJmbiIsImNiIiwiYmluZEVudmlyb25tZW50IiwiZGVmZXIiLCJjbGllbnRBZGRyZXNzIiwiX2NsaWVudEFkZHJlc3MiLCJodHRwSGVhZGVycyIsImhlYWRlcnMiLCJtc2ciLCJzZXNzaW9uIiwic3RhcnRVbml2ZXJzYWxTdWJzIiwicnVuIiwiaGVhcnRiZWF0SW50ZXJ2YWwiLCJoZWFydGJlYXQiLCJERFBDb21tb24iLCJIZWFydGJlYXQiLCJoZWFydGJlYXRUaW1lb3V0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsIlBhY2thZ2UiLCJGYWN0cyIsImluY3JlbWVudFNlcnZlckZhY3QiLCJzZW5kUmVhZHkiLCJzdWJzY3JpcHRpb25JZHMiLCJzdWJzIiwic3Vic2NyaXB0aW9uSWQiLCJfY2FuU2VuZCIsImdldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJzZW5kQWRkZWQiLCJjb2xsZWN0aW9uIiwic2VuZENoYW5nZWQiLCJzZW5kUmVtb3ZlZCIsImdldFNlbmRDYWxsYmFja3MiLCJnZXRDb2xsZWN0aW9uVmlldyIsInZpZXciLCJoYW5kbGVycyIsInVuaXZlcnNhbF9wdWJsaXNoX2hhbmRsZXJzIiwiaGFuZGxlciIsIl9zdGFydFN1YnNjcmlwdGlvbiIsInN0b3AiLCJfbWV0ZW9yU2Vzc2lvbiIsIl9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9ucyIsIl9yZW1vdmVTZXNzaW9uIiwiX3ByaW50U2VudEREUCIsIl9kZWJ1ZyIsInN0cmluZ2lmeUREUCIsInNlbmRFcnJvciIsInJlYXNvbiIsIm9mZmVuZGluZ01lc3NhZ2UiLCJwcm9jZXNzTWVzc2FnZSIsIm1zZ19pbiIsIm1lc3NhZ2VSZWNlaXZlZCIsInByb2Nlc3NOZXh0Iiwic2hpZnQiLCJ1bmJsb2NrIiwib25NZXNzYWdlSG9vayIsInByb3RvY29sX2hhbmRsZXJzIiwiY2FsbCIsInN1YiIsIm5hbWUiLCJwYXJhbXMiLCJBcnJheSIsInB1Ymxpc2hfaGFuZGxlcnMiLCJlcnJvciIsIkREUFJhdGVMaW1pdGVyIiwicmF0ZUxpbWl0ZXJJbnB1dCIsInR5cGUiLCJjb25uZWN0aW9uSWQiLCJfaW5jcmVtZW50IiwicmF0ZUxpbWl0UmVzdWx0IiwiX2NoZWNrIiwiYWxsb3dlZCIsImdldEVycm9yTWVzc2FnZSIsInRpbWVUb1Jlc2V0IiwidW5zdWIiLCJfc3RvcFN1YnNjcmlwdGlvbiIsIm1ldGhvZCIsInJhbmRvbVNlZWQiLCJmZW5jZSIsIl9Xcml0ZUZlbmNlIiwib25BbGxDb21taXR0ZWQiLCJyZXRpcmUiLCJtZXRob2RzIiwibWV0aG9kX2hhbmRsZXJzIiwiYXJtIiwic2V0VXNlcklkIiwiX3NldFVzZXJJZCIsImludm9jYXRpb24iLCJNZXRob2RJbnZvY2F0aW9uIiwiaXNTaW11bGF0aW9uIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0Q3VycmVudE1ldGhvZEludm9jYXRpb25SZXN1bHQiLCJjdXJyZW50Q29udGV4dCIsIkREUCIsIl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsIl9zZXROZXdDb250ZXh0QW5kR2V0Q3VycmVudCIsInJlc3VsdCIsInJlc3VsdE9yVGhlbmFibGUiLCJtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MiLCJpc1RoZW5hYmxlIiwidGhlbiIsImF3YWl0IiwiX3NldCIsIl9DdXJyZW50V3JpdGVGZW5jZSIsIndpdGhWYWx1ZSIsImZpbmlzaCIsInBheWxvYWQiLCJleGNlcHRpb24iLCJ3cmFwSW50ZXJuYWxFeGNlcHRpb24iLCJfZWFjaFN1YiIsImYiLCJfZGlmZkNvbGxlY3Rpb25WaWV3cyIsImJlZm9yZUNWcyIsImxlZnRWYWx1ZSIsInJpZ2h0VmFsdWUiLCJkb2MiLCJfZGVhY3RpdmF0ZSIsIm9sZE5hbWVkU3VicyIsIm5ld1N1YiIsIl9yZWNyZWF0ZSIsIl9ydW5IYW5kbGVyIiwiX25vWWllbGRzQWxsb3dlZCIsInN1YklkIiwiU3Vic2NyaXB0aW9uIiwidW5ibG9ja0hhbmRlciIsInN1Yk5hbWUiLCJtYXliZVN1YiIsIl9uYW1lIiwiX3JlbW92ZUFsbERvY3VtZW50cyIsInJlc3BvbnNlIiwiaHR0cEZvcndhcmRlZENvdW50IiwicGFyc2VJbnQiLCJyZW1vdGVBZGRyZXNzIiwiZm9yd2FyZGVkRm9yIiwiaXNTdHJpbmciLCJ0cmltIiwic3BsaXQiLCJfaGFuZGxlciIsIl9zdWJzY3JpcHRpb25JZCIsIl9wYXJhbXMiLCJfc3Vic2NyaXB0aW9uSGFuZGxlIiwiX2RlYWN0aXZhdGVkIiwiX3N0b3BDYWxsYmFja3MiLCJfZG9jdW1lbnRzIiwiX3JlYWR5IiwiX2lkRmlsdGVyIiwiaWRTdHJpbmdpZnkiLCJNb25nb0lEIiwiaWRQYXJzZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiZSIsIl9pc0RlYWN0aXZhdGVkIiwiX3B1Ymxpc2hIYW5kbGVyUmVzdWx0IiwicmVzIiwiaXNDdXJzb3IiLCJjIiwiX3B1Ymxpc2hDdXJzb3IiLCJyZWFkeSIsImlzQXJyYXkiLCJhbGwiLCJjb2xsZWN0aW9uTmFtZXMiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJjdXIiLCJfY2FsbFN0b3BDYWxsYmFja3MiLCJjb2xsZWN0aW9uRG9jcyIsInN0cklkIiwib25TdG9wIiwiaWRzIiwiU2VydmVyIiwiZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJvbkNvbm5lY3Rpb25Ib29rIiwiSG9vayIsImRlYnVnUHJpbnRFeGNlcHRpb25zIiwiX3B1YmxpY2F0aW9uU3RyYXRlZ2llcyIsInNlc3Npb25zIiwic3RyZWFtX3NlcnZlciIsInJhd19tc2ciLCJfcHJpbnRSZWNlaXZlZEREUCIsInBhcnNlRERQIiwiX2hhbmRsZUNvbm5lY3QiLCJvbkNvbm5lY3Rpb24iLCJzZXRQdWJsaWNhdGlvblN0cmF0ZWd5Iiwic3RyYXRlZ3kiLCJpbmNsdWRlcyIsIm9uTWVzc2FnZSIsInN1cHBvcnQiLCJjb250YWlucyIsIlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMiLCJjYWxjdWxhdGVWZXJzaW9uIiwicHVibGlzaCIsImlzT2JqZWN0IiwiYXV0b3B1Ymxpc2giLCJpc19hdXRvIiwid2FybmVkX2Fib3V0X2F1dG9wdWJsaXNoIiwiZnVuYyIsInBvcCIsImNhbGxBc3luYyIsImFwcGx5QXN5bmMiLCJjdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsImN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24iLCJtYWtlUnBjU2VlZCIsIl91cmxGb3JTZXNzaW9uIiwic2Vzc2lvbklkIiwiY2xpZW50U3VwcG9ydGVkVmVyc2lvbnMiLCJzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucyIsImNvcnJlY3RWZXJzaW9uIiwiX2NhbGN1bGF0ZVZlcnNpb24iLCJjb250ZXh0IiwiaXNDbGllbnRTYWZlIiwib3JpZ2luYWxNZXNzYWdlIiwibWVzc2FnZSIsImRldGFpbHMiLCJfZXhwZWN0ZWRCeVRlc3QiLCJzdGFjayIsInNhbml0aXplZEVycm9yIiwiZGVzY3JpcHRpb24iLCJNYXRjaCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiRnV0dXJlIiwiYXJtZWQiLCJmaXJlZCIsInJldGlyZWQiLCJvdXRzdGFuZGluZ193cml0ZXMiLCJiZWZvcmVfZmlyZV9jYWxsYmFja3MiLCJjb21wbGV0aW9uX2NhbGxiYWNrcyIsIkVudmlyb25tZW50VmFyaWFibGUiLCJiZWdpbldyaXRlIiwiY29tbWl0dGVkIiwiX21heWJlRmlyZSIsIm9uQmVmb3JlRmlyZSIsImFybUFuZFdhaXQiLCJmdXR1cmUiLCJ3YWl0IiwiaW52b2tlQ2FsbGJhY2siLCJfQ3Jvc3NiYXIiLCJuZXh0SWQiLCJsaXN0ZW5lcnNCeUNvbGxlY3Rpb24iLCJsaXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudCIsImZhY3RQYWNrYWdlIiwiZmFjdE5hbWUiLCJfY29sbGVjdGlvbkZvck1lc3NhZ2UiLCJsaXN0ZW4iLCJ0cmlnZ2VyIiwicmVjb3JkIiwiZmlyZSIsIm5vdGlmaWNhdGlvbiIsImxpc3RlbmVyc0ZvckNvbGxlY3Rpb24iLCJjYWxsYmFja0lkcyIsImwiLCJfbWF0Y2hlcyIsIk9iamVjdElEIiwidHJpZ2dlclZhbHVlIiwiX0ludmFsaWRhdGlvbkNyb3NzYmFyIiwiRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwiLCJyZWZyZXNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSUEsbUJBQW1CLEdBQUdDLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLFlBQVk7RUFDM0MsSUFBSUMsVUFBVSxHQUFHLEVBQUU7RUFFbkIsSUFBSUMsMEJBQTBCLEdBQUdDLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyw0QkFBNEIsR0FDakVDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSixPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsNEJBQTRCLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDakUsSUFBSUgsMEJBQTBCLEVBQUU7SUFDOUJELFVBQVUsQ0FBQ08sSUFBSSxDQUFDQyxHQUFHLENBQUNDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDQyxTQUFTLENBQ3pEVCwwQkFBMEIsQ0FDM0IsQ0FBQztFQUNKO0VBRUEsT0FBT0QsVUFBVTtBQUNuQixDQUFDLENBQUM7QUFFRixJQUFJVyxVQUFVLEdBQUdDLHlCQUF5QixDQUFDQyxvQkFBb0IsSUFBSyxFQUFFO0FBRXRFQyxZQUFZLEdBQUcsWUFBWTtFQUN6QixJQUFJQyxJQUFJLEdBQUcsSUFBSTtFQUNmQSxJQUFJLENBQUNDLHNCQUFzQixHQUFHLEVBQUU7RUFDaENELElBQUksQ0FBQ0UsWUFBWSxHQUFHLEVBQUU7O0VBRXRCO0VBQ0E7RUFDQUYsSUFBSSxDQUFDRyxNQUFNLEdBQUdQLFVBQVUsR0FBRyxTQUFTO0VBQ3BDUSxXQUFXLENBQUNDLE9BQU8sQ0FBQ0wsSUFBSSxDQUFDRyxNQUFNLEdBQUcsR0FBRyxFQUFFLFNBQVMsQ0FBQzs7RUFFakQ7RUFDQSxJQUFJRyxNQUFNLEdBQUdiLEdBQUcsQ0FBQ0MsT0FBTyxDQUFDLFFBQVEsQ0FBQztFQUNsQyxJQUFJYSxhQUFhLEdBQUc7SUFDbEJKLE1BQU0sRUFBRUgsSUFBSSxDQUFDRyxNQUFNO0lBQ25CSyxHQUFHLEVBQUUsWUFBVyxDQUFDLENBQUM7SUFDbEI7SUFDQTtJQUNBQyxlQUFlLEVBQUUsS0FBSztJQUN0QjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQUMsZ0JBQWdCLEVBQUUsRUFBRSxHQUFHLElBQUk7SUFDM0I7SUFDQTtJQUNBO0lBQ0FDLFVBQVUsRUFBRSxDQUFDLENBQUN4QixPQUFPLENBQUNDLEdBQUcsQ0FBQ3dCO0VBQzVCLENBQUM7O0VBRUQ7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJekIsT0FBTyxDQUFDQyxHQUFHLENBQUN5QixrQkFBa0IsRUFBRTtJQUNsQ04sYUFBYSxDQUFDTyxTQUFTLEdBQUcsS0FBSztFQUNqQyxDQUFDLE1BQU07SUFDTFAsYUFBYSxDQUFDUSxtQkFBbUIsR0FBRztNQUNsQzlCLFVBQVUsRUFBRUgsbUJBQW1CO0lBQ2pDLENBQUM7RUFDSDtFQUVBa0IsSUFBSSxDQUFDZ0IsTUFBTSxHQUFHVixNQUFNLENBQUNXLFlBQVksQ0FBQ1YsYUFBYSxDQUFDOztFQUVoRDtFQUNBO0VBQ0E7RUFDQTtFQUNBVyxNQUFNLENBQUNDLFVBQVUsQ0FBQ0MsY0FBYyxDQUM5QixTQUFTLEVBQUVGLE1BQU0sQ0FBQ0csaUNBQWlDLENBQUM7RUFDdERyQixJQUFJLENBQUNnQixNQUFNLENBQUNNLGVBQWUsQ0FBQ0osTUFBTSxDQUFDQyxVQUFVLENBQUM7RUFDOUNELE1BQU0sQ0FBQ0MsVUFBVSxDQUFDSSxXQUFXLENBQzNCLFNBQVMsRUFBRUwsTUFBTSxDQUFDRyxpQ0FBaUMsQ0FBQzs7RUFFdEQ7RUFDQXJCLElBQUksQ0FBQ3dCLDBCQUEwQixFQUFFO0VBRWpDeEIsSUFBSSxDQUFDZ0IsTUFBTSxDQUFDUyxFQUFFLENBQUMsWUFBWSxFQUFFLFVBQVVDLE1BQU0sRUFBRTtJQUM3QztJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksQ0FBQ0EsTUFBTSxFQUFFOztJQUViO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0FBLE1BQU0sQ0FBQ0MsbUJBQW1CLEdBQUcsVUFBVUMsT0FBTyxFQUFFO01BQzlDLElBQUksQ0FBQ0YsTUFBTSxDQUFDRyxRQUFRLEtBQUssV0FBVyxJQUMvQkgsTUFBTSxDQUFDRyxRQUFRLEtBQUssZUFBZSxLQUNqQ0gsTUFBTSxDQUFDSSxRQUFRLENBQUNDLElBQUksRUFBRTtRQUMzQkwsTUFBTSxDQUFDSSxRQUFRLENBQUNDLElBQUksQ0FBQ0MsVUFBVSxDQUFDQyxVQUFVLENBQUNMLE9BQU8sQ0FBQztNQUNyRDtJQUNGLENBQUM7SUFDREYsTUFBTSxDQUFDQyxtQkFBbUIsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBRXJDRCxNQUFNLENBQUNRLElBQUksR0FBRyxVQUFVQyxJQUFJLEVBQUU7TUFDNUJULE1BQU0sQ0FBQ1UsS0FBSyxDQUFDRCxJQUFJLENBQUM7SUFDcEIsQ0FBQztJQUNEVCxNQUFNLENBQUNELEVBQUUsQ0FBQyxPQUFPLEVBQUUsWUFBWTtNQUM3QnpCLElBQUksQ0FBQ0UsWUFBWSxHQUFHbkIsQ0FBQyxDQUFDc0QsT0FBTyxDQUFDckMsSUFBSSxDQUFDRSxZQUFZLEVBQUV3QixNQUFNLENBQUM7SUFDMUQsQ0FBQyxDQUFDO0lBQ0YxQixJQUFJLENBQUNFLFlBQVksQ0FBQ1YsSUFBSSxDQUFDa0MsTUFBTSxDQUFDOztJQUU5QjtJQUNBO0lBQ0EsSUFBSXZDLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDa0QsYUFBYSxJQUFJbkQsT0FBTyxDQUFDQyxHQUFHLENBQUNrRCxhQUFhLEtBQUssSUFBSSxFQUFFO01BQ25FWixNQUFNLENBQUNRLElBQUksQ0FBQzVDLElBQUksQ0FBQ2lELFNBQVMsQ0FBQztRQUFFQyxvQkFBb0IsRUFBRTtNQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzdEOztJQUVBO0lBQ0E7SUFDQXpELENBQUMsQ0FBQzBELElBQUksQ0FBQ3pDLElBQUksQ0FBQ0Msc0JBQXNCLEVBQUUsVUFBVXlDLFFBQVEsRUFBRTtNQUN0REEsUUFBUSxDQUFDaEIsTUFBTSxDQUFDO0lBQ2xCLENBQUMsQ0FBQztFQUNKLENBQUMsQ0FBQztBQUVKLENBQUM7QUFFRGlCLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDN0MsWUFBWSxDQUFDOEMsU0FBUyxFQUFFO0VBQ3BDO0VBQ0E7RUFDQUMsUUFBUSxFQUFFLFVBQVVKLFFBQVEsRUFBRTtJQUM1QixJQUFJMUMsSUFBSSxHQUFHLElBQUk7SUFDZkEsSUFBSSxDQUFDQyxzQkFBc0IsQ0FBQ1QsSUFBSSxDQUFDa0QsUUFBUSxDQUFDO0lBQzFDM0QsQ0FBQyxDQUFDMEQsSUFBSSxDQUFDekMsSUFBSSxDQUFDK0MsV0FBVyxFQUFFLEVBQUUsVUFBVXJCLE1BQU0sRUFBRTtNQUMzQ2dCLFFBQVEsQ0FBQ2hCLE1BQU0sQ0FBQztJQUNsQixDQUFDLENBQUM7RUFDSixDQUFDO0VBRUQ7RUFDQXFCLFdBQVcsRUFBRSxZQUFZO0lBQ3ZCLElBQUkvQyxJQUFJLEdBQUcsSUFBSTtJQUNmLE9BQU9qQixDQUFDLENBQUNpRSxNQUFNLENBQUNoRCxJQUFJLENBQUNFLFlBQVksQ0FBQztFQUNwQyxDQUFDO0VBRUQ7RUFDQTtFQUNBc0IsMEJBQTBCLEVBQUUsWUFBVztJQUNyQyxJQUFJeEIsSUFBSSxHQUFHLElBQUk7SUFDZjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUNpRCxPQUFPLENBQUVDLEtBQUssSUFBSztNQUN4QyxJQUFJL0IsVUFBVSxHQUFHRCxNQUFNLENBQUNDLFVBQVU7TUFDbEMsSUFBSWdDLHNCQUFzQixHQUFHaEMsVUFBVSxDQUFDaUMsU0FBUyxDQUFDRixLQUFLLENBQUMsQ0FBQ0csS0FBSyxDQUFDLENBQUMsQ0FBQztNQUNqRWxDLFVBQVUsQ0FBQ21DLGtCQUFrQixDQUFDSixLQUFLLENBQUM7O01BRXBDO01BQ0E7TUFDQSxJQUFJSyxXQUFXLEdBQUcsVUFBU0MsT0FBTyxDQUFDLHNCQUFzQjtRQUN2RDtRQUNBLElBQUlDLElBQUksR0FBR0MsU0FBUzs7UUFFcEI7UUFDQSxJQUFJQyxHQUFHLEdBQUdsRSxHQUFHLENBQUNDLE9BQU8sQ0FBQyxLQUFLLENBQUM7O1FBRTVCO1FBQ0E7UUFDQSxJQUFJa0UsU0FBUyxHQUFHRCxHQUFHLENBQUNwRSxLQUFLLENBQUNpRSxPQUFPLENBQUNHLEdBQUcsQ0FBQztRQUN0QyxJQUFJQyxTQUFTLENBQUNDLFFBQVEsS0FBS2pFLFVBQVUsR0FBRyxZQUFZLElBQ2hEZ0UsU0FBUyxDQUFDQyxRQUFRLEtBQUtqRSxVQUFVLEdBQUcsYUFBYSxFQUFFO1VBQ3JEZ0UsU0FBUyxDQUFDQyxRQUFRLEdBQUc3RCxJQUFJLENBQUNHLE1BQU0sR0FBRyxZQUFZO1VBQy9DcUQsT0FBTyxDQUFDRyxHQUFHLEdBQUdBLEdBQUcsQ0FBQ0csTUFBTSxDQUFDRixTQUFTLENBQUM7UUFDckM7UUFDQTdFLENBQUMsQ0FBQzBELElBQUksQ0FBQ1Usc0JBQXNCLEVBQUUsVUFBU1ksV0FBVyxFQUFFO1VBQ25EQSxXQUFXLENBQUNDLEtBQUssQ0FBQzdDLFVBQVUsRUFBRXNDLElBQUksQ0FBQztRQUNyQyxDQUFDLENBQUM7TUFDSixDQUFDO01BQ0R0QyxVQUFVLENBQUNJLFdBQVcsQ0FBQzJCLEtBQUssRUFBRUssV0FBVyxDQUFDO0lBQzVDLENBQUMsQ0FBQztFQUNKO0FBQ0YsQ0FBQyxDQUFDLEM7Ozs7Ozs7Ozs7O0FDN0xGLElBQUlVLGFBQWE7QUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7RUFBQ0MsT0FBTyxDQUFDQyxDQUFDLEVBQUM7SUFBQ0osYUFBYSxHQUFDSSxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQXJHQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBRWQsSUFBSUMsS0FBSyxHQUFHOUUsR0FBRyxDQUFDQyxPQUFPLENBQUMsUUFBUSxDQUFDOztBQUVqQztBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU04RSxxQkFBcUIsR0FBRztFQUM1QjtFQUNBO0VBQ0E7RUFDQUMsWUFBWSxFQUFFO0lBQ1pDLGlCQUFpQixFQUFFLElBQUk7SUFDdkJDLHlCQUF5QixFQUFFO0VBQzdCLENBQUM7RUFDRDtFQUNBO0VBQ0E7RUFDQTtFQUNBQyxtQkFBbUIsRUFBRTtJQUNuQkYsaUJBQWlCLEVBQUUsS0FBSztJQUN4QkMseUJBQXlCLEVBQUU7RUFDN0IsQ0FBQztFQUNEO0VBQ0E7RUFDQTtFQUNBRSxRQUFRLEVBQUU7SUFDUkgsaUJBQWlCLEVBQUUsS0FBSztJQUN4QkMseUJBQXlCLEVBQUU7RUFDN0I7QUFDRixDQUFDO0FBRURMLFNBQVMsQ0FBQ0UscUJBQXFCLEdBQUdBLHFCQUFxQjs7QUFFdkQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLElBQUlNLG1CQUFtQixHQUFHLFlBQVk7RUFDcEMsSUFBSTlFLElBQUksR0FBRyxJQUFJO0VBQ2ZBLElBQUksQ0FBQytFLFFBQVEsR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0VBQzNCaEYsSUFBSSxDQUFDaUYsU0FBUyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFDOUIsQ0FBQzs7QUFFRFosU0FBUyxDQUFDYSxvQkFBb0IsR0FBR0wsbUJBQW1CO0FBR3BEL0YsQ0FBQyxDQUFDcUcsTUFBTSxDQUFDTixtQkFBbUIsQ0FBQ2pDLFNBQVMsRUFBRTtFQUV0Q3dDLFNBQVMsRUFBRSxZQUFZO0lBQ3JCLElBQUlyRixJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlzRixHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ1p0RixJQUFJLENBQUNpRixTQUFTLENBQUNoQyxPQUFPLENBQUMsVUFBVXNDLGNBQWMsRUFBRUMsR0FBRyxFQUFFO01BQ3BERixHQUFHLENBQUNFLEdBQUcsQ0FBQyxHQUFHRCxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUNFLEtBQUs7SUFDcEMsQ0FBQyxDQUFDO0lBQ0YsT0FBT0gsR0FBRztFQUNaLENBQUM7RUFFREksVUFBVSxFQUFFLFVBQVVDLGtCQUFrQixFQUFFSCxHQUFHLEVBQUVJLGVBQWUsRUFBRTtJQUM5RCxJQUFJNUYsSUFBSSxHQUFHLElBQUk7SUFDZjtJQUNBLElBQUl3RixHQUFHLEtBQUssS0FBSyxFQUNmO0lBQ0YsSUFBSUQsY0FBYyxHQUFHdkYsSUFBSSxDQUFDaUYsU0FBUyxDQUFDWSxHQUFHLENBQUNMLEdBQUcsQ0FBQzs7SUFFNUM7SUFDQTtJQUNBLElBQUksQ0FBQ0QsY0FBYyxFQUNqQjtJQUVGLElBQUlPLFlBQVksR0FBR0MsU0FBUztJQUM1QixLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1QsY0FBYyxDQUFDVSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO01BQzlDLElBQUlFLFVBQVUsR0FBR1gsY0FBYyxDQUFDUyxDQUFDLENBQUM7TUFDbEMsSUFBSUUsVUFBVSxDQUFDUCxrQkFBa0IsS0FBS0Esa0JBQWtCLEVBQUU7UUFDeEQ7UUFDQTtRQUNBLElBQUlLLENBQUMsS0FBSyxDQUFDLEVBQ1RGLFlBQVksR0FBR0ksVUFBVSxDQUFDVCxLQUFLO1FBQ2pDRixjQUFjLENBQUNZLE1BQU0sQ0FBQ0gsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMzQjtNQUNGO0lBQ0Y7SUFDQSxJQUFJVCxjQUFjLENBQUNVLE1BQU0sS0FBSyxDQUFDLEVBQUU7TUFDL0JqRyxJQUFJLENBQUNpRixTQUFTLENBQUNtQixNQUFNLENBQUNaLEdBQUcsQ0FBQztNQUMxQkksZUFBZSxDQUFDSixHQUFHLENBQUMsR0FBR08sU0FBUztJQUNsQyxDQUFDLE1BQU0sSUFBSUQsWUFBWSxLQUFLQyxTQUFTLElBQzFCLENBQUNNLEtBQUssQ0FBQ0MsTUFBTSxDQUFDUixZQUFZLEVBQUVQLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQ0UsS0FBSyxDQUFDLEVBQUU7TUFDL0RHLGVBQWUsQ0FBQ0osR0FBRyxDQUFDLEdBQUdELGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQ0UsS0FBSztJQUNoRDtFQUNGLENBQUM7RUFFRGMsV0FBVyxFQUFFLFVBQVVaLGtCQUFrQixFQUFFSCxHQUFHLEVBQUVDLEtBQUssRUFDOUJHLGVBQWUsRUFBRVksS0FBSyxFQUFFO0lBQzdDLElBQUl4RyxJQUFJLEdBQUcsSUFBSTtJQUNmO0lBQ0EsSUFBSXdGLEdBQUcsS0FBSyxLQUFLLEVBQ2Y7O0lBRUY7SUFDQUMsS0FBSyxHQUFHWSxLQUFLLENBQUNJLEtBQUssQ0FBQ2hCLEtBQUssQ0FBQztJQUUxQixJQUFJLENBQUN6RixJQUFJLENBQUNpRixTQUFTLENBQUN5QixHQUFHLENBQUNsQixHQUFHLENBQUMsRUFBRTtNQUM1QnhGLElBQUksQ0FBQ2lGLFNBQVMsQ0FBQzBCLEdBQUcsQ0FBQ25CLEdBQUcsRUFBRSxDQUFDO1FBQUNHLGtCQUFrQixFQUFFQSxrQkFBa0I7UUFDdENGLEtBQUssRUFBRUE7TUFBSyxDQUFDLENBQUMsQ0FBQztNQUN6Q0csZUFBZSxDQUFDSixHQUFHLENBQUMsR0FBR0MsS0FBSztNQUM1QjtJQUNGO0lBQ0EsSUFBSUYsY0FBYyxHQUFHdkYsSUFBSSxDQUFDaUYsU0FBUyxDQUFDWSxHQUFHLENBQUNMLEdBQUcsQ0FBQztJQUM1QyxJQUFJb0IsR0FBRztJQUNQLElBQUksQ0FBQ0osS0FBSyxFQUFFO01BQ1ZJLEdBQUcsR0FBR3JCLGNBQWMsQ0FBQ3NCLElBQUksQ0FBQyxVQUFVWCxVQUFVLEVBQUU7UUFDNUMsT0FBT0EsVUFBVSxDQUFDUCxrQkFBa0IsS0FBS0Esa0JBQWtCO01BQy9ELENBQUMsQ0FBQztJQUNKO0lBRUEsSUFBSWlCLEdBQUcsRUFBRTtNQUNQLElBQUlBLEdBQUcsS0FBS3JCLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDYyxLQUFLLENBQUNDLE1BQU0sQ0FBQ2IsS0FBSyxFQUFFbUIsR0FBRyxDQUFDbkIsS0FBSyxDQUFDLEVBQUU7UUFDaEU7UUFDQUcsZUFBZSxDQUFDSixHQUFHLENBQUMsR0FBR0MsS0FBSztNQUM5QjtNQUNBbUIsR0FBRyxDQUFDbkIsS0FBSyxHQUFHQSxLQUFLO0lBQ25CLENBQUMsTUFBTTtNQUNMO01BQ0FGLGNBQWMsQ0FBQy9GLElBQUksQ0FBQztRQUFDbUcsa0JBQWtCLEVBQUVBLGtCQUFrQjtRQUFFRixLQUFLLEVBQUVBO01BQUssQ0FBQyxDQUFDO0lBQzdFO0VBRUY7QUFDRixDQUFDLENBQUM7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSXFCLHFCQUFxQixHQUFHLFVBQVVDLGNBQWMsRUFBRUMsZ0JBQWdCLEVBQUU7RUFDdEUsSUFBSWhILElBQUksR0FBRyxJQUFJO0VBQ2ZBLElBQUksQ0FBQytHLGNBQWMsR0FBR0EsY0FBYztFQUNwQy9HLElBQUksQ0FBQ2lILFNBQVMsR0FBRyxJQUFJL0IsR0FBRyxFQUFFO0VBQzFCbEYsSUFBSSxDQUFDa0gsU0FBUyxHQUFHRixnQkFBZ0I7QUFDbkMsQ0FBQztBQUVEMUMsU0FBUyxDQUFDNkMsc0JBQXNCLEdBQUdMLHFCQUFxQjtBQUd4RG5FLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDa0UscUJBQXFCLENBQUNqRSxTQUFTLEVBQUU7RUFFN0N1RSxPQUFPLEVBQUUsWUFBWTtJQUNuQixJQUFJcEgsSUFBSSxHQUFHLElBQUk7SUFDZixPQUFPQSxJQUFJLENBQUNpSCxTQUFTLENBQUNJLElBQUksS0FBSyxDQUFDO0VBQ2xDLENBQUM7RUFFREMsSUFBSSxFQUFFLFVBQVVDLFFBQVEsRUFBRTtJQUN4QixJQUFJdkgsSUFBSSxHQUFHLElBQUk7SUFDZndILFlBQVksQ0FBQ0MsUUFBUSxDQUFDRixRQUFRLENBQUNOLFNBQVMsRUFBRWpILElBQUksQ0FBQ2lILFNBQVMsRUFBRTtNQUN4RFMsSUFBSSxFQUFFM0ksQ0FBQyxDQUFDNEksSUFBSSxDQUFDM0gsSUFBSSxDQUFDNEgsWUFBWSxFQUFFNUgsSUFBSSxDQUFDO01BRXJDNkgsU0FBUyxFQUFFLFVBQVVDLEVBQUUsRUFBRUMsS0FBSyxFQUFFO1FBQzlCL0gsSUFBSSxDQUFDa0gsU0FBUyxDQUFDYyxLQUFLLENBQUNoSSxJQUFJLENBQUMrRyxjQUFjLEVBQUVlLEVBQUUsRUFBRUMsS0FBSyxDQUFDMUMsU0FBUyxFQUFFLENBQUM7TUFDbEUsQ0FBQztNQUVENEMsUUFBUSxFQUFFLFVBQVVILEVBQUUsRUFBRUksTUFBTSxFQUFFO1FBQzlCbEksSUFBSSxDQUFDa0gsU0FBUyxDQUFDaUIsT0FBTyxDQUFDbkksSUFBSSxDQUFDK0csY0FBYyxFQUFFZSxFQUFFLENBQUM7TUFDakQ7SUFDRixDQUFDLENBQUM7RUFDSixDQUFDO0VBRURGLFlBQVksRUFBRSxVQUFVRSxFQUFFLEVBQUVJLE1BQU0sRUFBRUgsS0FBSyxFQUFFO0lBQ3pDLElBQUkvSCxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlvSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ2ZaLFlBQVksQ0FBQ2EsV0FBVyxDQUFDSCxNQUFNLENBQUM3QyxTQUFTLEVBQUUsRUFBRTBDLEtBQUssQ0FBQzFDLFNBQVMsRUFBRSxFQUFFO01BQzlEcUMsSUFBSSxFQUFFLFVBQVVsQyxHQUFHLEVBQUU4QyxJQUFJLEVBQUVDLEdBQUcsRUFBRTtRQUM5QixJQUFJLENBQUNsQyxLQUFLLENBQUNDLE1BQU0sQ0FBQ2dDLElBQUksRUFBRUMsR0FBRyxDQUFDLEVBQzFCSCxNQUFNLENBQUM1QyxHQUFHLENBQUMsR0FBRytDLEdBQUc7TUFDckIsQ0FBQztNQUNEVixTQUFTLEVBQUUsVUFBVXJDLEdBQUcsRUFBRStDLEdBQUcsRUFBRTtRQUM3QkgsTUFBTSxDQUFDNUMsR0FBRyxDQUFDLEdBQUcrQyxHQUFHO01BQ25CLENBQUM7TUFDRE4sUUFBUSxFQUFFLFVBQVN6QyxHQUFHLEVBQUU4QyxJQUFJLEVBQUU7UUFDNUJGLE1BQU0sQ0FBQzVDLEdBQUcsQ0FBQyxHQUFHTyxTQUFTO01BQ3pCO0lBQ0YsQ0FBQyxDQUFDO0lBQ0YvRixJQUFJLENBQUNrSCxTQUFTLENBQUNzQixPQUFPLENBQUN4SSxJQUFJLENBQUMrRyxjQUFjLEVBQUVlLEVBQUUsRUFBRU0sTUFBTSxDQUFDO0VBQ3pELENBQUM7RUFFREosS0FBSyxFQUFFLFVBQVVyQyxrQkFBa0IsRUFBRW1DLEVBQUUsRUFBRU0sTUFBTSxFQUFFO0lBQy9DLElBQUlwSSxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUl5SSxPQUFPLEdBQUd6SSxJQUFJLENBQUNpSCxTQUFTLENBQUNwQixHQUFHLENBQUNpQyxFQUFFLENBQUM7SUFDcEMsSUFBSUUsS0FBSyxHQUFHLEtBQUs7SUFDakIsSUFBSSxDQUFDUyxPQUFPLEVBQUU7TUFDWlQsS0FBSyxHQUFHLElBQUk7TUFDWlMsT0FBTyxHQUFHLElBQUkzRCxtQkFBbUIsRUFBRTtNQUNuQzlFLElBQUksQ0FBQ2lILFNBQVMsQ0FBQ04sR0FBRyxDQUFDbUIsRUFBRSxFQUFFVyxPQUFPLENBQUM7SUFDakM7SUFDQUEsT0FBTyxDQUFDMUQsUUFBUSxDQUFDMkQsR0FBRyxDQUFDL0Msa0JBQWtCLENBQUM7SUFDeEMsSUFBSUMsZUFBZSxHQUFHLENBQUMsQ0FBQztJQUN4QjdHLENBQUMsQ0FBQzBELElBQUksQ0FBQzJGLE1BQU0sRUFBRSxVQUFVM0MsS0FBSyxFQUFFRCxHQUFHLEVBQUU7TUFDbkNpRCxPQUFPLENBQUNsQyxXQUFXLENBQ2pCWixrQkFBa0IsRUFBRUgsR0FBRyxFQUFFQyxLQUFLLEVBQUVHLGVBQWUsRUFBRSxJQUFJLENBQUM7SUFDMUQsQ0FBQyxDQUFDO0lBQ0YsSUFBSW9DLEtBQUssRUFDUGhJLElBQUksQ0FBQ2tILFNBQVMsQ0FBQ2MsS0FBSyxDQUFDaEksSUFBSSxDQUFDK0csY0FBYyxFQUFFZSxFQUFFLEVBQUVsQyxlQUFlLENBQUMsQ0FBQyxLQUUvRDVGLElBQUksQ0FBQ2tILFNBQVMsQ0FBQ3NCLE9BQU8sQ0FBQ3hJLElBQUksQ0FBQytHLGNBQWMsRUFBRWUsRUFBRSxFQUFFbEMsZUFBZSxDQUFDO0VBQ3BFLENBQUM7RUFFRDRDLE9BQU8sRUFBRSxVQUFVN0Msa0JBQWtCLEVBQUVtQyxFQUFFLEVBQUVVLE9BQU8sRUFBRTtJQUNsRCxJQUFJeEksSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJMkksYUFBYSxHQUFHLENBQUMsQ0FBQztJQUN0QixJQUFJRixPQUFPLEdBQUd6SSxJQUFJLENBQUNpSCxTQUFTLENBQUNwQixHQUFHLENBQUNpQyxFQUFFLENBQUM7SUFDcEMsSUFBSSxDQUFDVyxPQUFPLEVBQ1YsTUFBTSxJQUFJRyxLQUFLLENBQUMsaUNBQWlDLEdBQUdkLEVBQUUsR0FBRyxZQUFZLENBQUM7SUFDeEUvSSxDQUFDLENBQUMwRCxJQUFJLENBQUMrRixPQUFPLEVBQUUsVUFBVS9DLEtBQUssRUFBRUQsR0FBRyxFQUFFO01BQ3BDLElBQUlDLEtBQUssS0FBS00sU0FBUyxFQUNyQjBDLE9BQU8sQ0FBQy9DLFVBQVUsQ0FBQ0Msa0JBQWtCLEVBQUVILEdBQUcsRUFBRW1ELGFBQWEsQ0FBQyxDQUFDLEtBRTNERixPQUFPLENBQUNsQyxXQUFXLENBQUNaLGtCQUFrQixFQUFFSCxHQUFHLEVBQUVDLEtBQUssRUFBRWtELGFBQWEsQ0FBQztJQUN0RSxDQUFDLENBQUM7SUFDRjNJLElBQUksQ0FBQ2tILFNBQVMsQ0FBQ3NCLE9BQU8sQ0FBQ3hJLElBQUksQ0FBQytHLGNBQWMsRUFBRWUsRUFBRSxFQUFFYSxhQUFhLENBQUM7RUFDaEUsQ0FBQztFQUVEUixPQUFPLEVBQUUsVUFBVXhDLGtCQUFrQixFQUFFbUMsRUFBRSxFQUFFO0lBQ3pDLElBQUk5SCxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUl5SSxPQUFPLEdBQUd6SSxJQUFJLENBQUNpSCxTQUFTLENBQUNwQixHQUFHLENBQUNpQyxFQUFFLENBQUM7SUFDcEMsSUFBSSxDQUFDVyxPQUFPLEVBQUU7TUFDWixJQUFJSSxHQUFHLEdBQUcsSUFBSUQsS0FBSyxDQUFDLCtCQUErQixHQUFHZCxFQUFFLENBQUM7TUFDekQsTUFBTWUsR0FBRztJQUNYO0lBQ0FKLE9BQU8sQ0FBQzFELFFBQVEsQ0FBQ3FCLE1BQU0sQ0FBQ1Qsa0JBQWtCLENBQUM7SUFDM0MsSUFBSThDLE9BQU8sQ0FBQzFELFFBQVEsQ0FBQ3NDLElBQUksS0FBSyxDQUFDLEVBQUU7TUFDL0I7TUFDQXJILElBQUksQ0FBQ2tILFNBQVMsQ0FBQ2lCLE9BQU8sQ0FBQ25JLElBQUksQ0FBQytHLGNBQWMsRUFBRWUsRUFBRSxDQUFDO01BQy9DOUgsSUFBSSxDQUFDaUgsU0FBUyxDQUFDYixNQUFNLENBQUMwQixFQUFFLENBQUM7SUFDM0IsQ0FBQyxNQUFNO01BQ0wsSUFBSVUsT0FBTyxHQUFHLENBQUMsQ0FBQztNQUNoQjtNQUNBO01BQ0FDLE9BQU8sQ0FBQ3hELFNBQVMsQ0FBQ2hDLE9BQU8sQ0FBQyxVQUFVc0MsY0FBYyxFQUFFQyxHQUFHLEVBQUU7UUFDdkRpRCxPQUFPLENBQUMvQyxVQUFVLENBQUNDLGtCQUFrQixFQUFFSCxHQUFHLEVBQUVnRCxPQUFPLENBQUM7TUFDdEQsQ0FBQyxDQUFDO01BRUZ4SSxJQUFJLENBQUNrSCxTQUFTLENBQUNzQixPQUFPLENBQUN4SSxJQUFJLENBQUMrRyxjQUFjLEVBQUVlLEVBQUUsRUFBRVUsT0FBTyxDQUFDO0lBQzFEO0VBQ0Y7QUFDRixDQUFDLENBQUM7O0FBRUY7QUFDQTtBQUNBOztBQUVBLElBQUlNLE9BQU8sR0FBRyxVQUFVOUgsTUFBTSxFQUFFK0gsT0FBTyxFQUFFckgsTUFBTSxFQUFFc0gsT0FBTyxFQUFFO0VBQ3hELElBQUloSixJQUFJLEdBQUcsSUFBSTtFQUNmQSxJQUFJLENBQUM4SCxFQUFFLEdBQUdtQixNQUFNLENBQUNuQixFQUFFLEVBQUU7RUFFckI5SCxJQUFJLENBQUNnQixNQUFNLEdBQUdBLE1BQU07RUFDcEJoQixJQUFJLENBQUMrSSxPQUFPLEdBQUdBLE9BQU87RUFFdEIvSSxJQUFJLENBQUNrSixXQUFXLEdBQUcsS0FBSztFQUN4QmxKLElBQUksQ0FBQzBCLE1BQU0sR0FBR0EsTUFBTTs7RUFFcEI7RUFDQTtFQUNBMUIsSUFBSSxDQUFDbUosT0FBTyxHQUFHLElBQUlDLE1BQU0sQ0FBQ0MsaUJBQWlCLEVBQUU7RUFFN0NySixJQUFJLENBQUNzSixPQUFPLEdBQUcsS0FBSztFQUNwQnRKLElBQUksQ0FBQ3VKLGFBQWEsR0FBRyxLQUFLO0VBRTFCdkosSUFBSSxDQUFDd0osYUFBYSxHQUFHLElBQUk7O0VBRXpCO0VBQ0F4SixJQUFJLENBQUN5SixVQUFVLEdBQUcsSUFBSXZFLEdBQUcsRUFBRTtFQUMzQmxGLElBQUksQ0FBQzBKLGNBQWMsR0FBRyxFQUFFO0VBRXhCMUosSUFBSSxDQUFDMkosTUFBTSxHQUFHLElBQUk7RUFFbEIzSixJQUFJLENBQUM0SixlQUFlLEdBQUcsSUFBSTFFLEdBQUcsRUFBRTs7RUFFaEM7RUFDQTtFQUNBO0VBQ0FsRixJQUFJLENBQUM2SixVQUFVLEdBQUcsSUFBSTs7RUFFdEI7RUFDQTtFQUNBN0osSUFBSSxDQUFDOEosMEJBQTBCLEdBQUcsS0FBSzs7RUFFdkM7RUFDQTtFQUNBOUosSUFBSSxDQUFDK0osYUFBYSxHQUFHLEVBQUU7O0VBRXZCO0VBQ0EvSixJQUFJLENBQUNnSyxlQUFlLEdBQUcsRUFBRTs7RUFHekI7RUFDQTtFQUNBaEssSUFBSSxDQUFDaUssVUFBVSxHQUFHdkksTUFBTSxDQUFDaUMsR0FBRzs7RUFFNUI7RUFDQTNELElBQUksQ0FBQ2tLLGVBQWUsR0FBR2xCLE9BQU8sQ0FBQ21CLGNBQWM7O0VBRTdDO0VBQ0E7RUFDQTtFQUNBbkssSUFBSSxDQUFDb0ssZ0JBQWdCLEdBQUc7SUFDdEJ0QyxFQUFFLEVBQUU5SCxJQUFJLENBQUM4SCxFQUFFO0lBQ1h1QyxLQUFLLEVBQUUsWUFBWTtNQUNqQnJLLElBQUksQ0FBQ3FLLEtBQUssRUFBRTtJQUNkLENBQUM7SUFDREMsT0FBTyxFQUFFLFVBQVVDLEVBQUUsRUFBRTtNQUNyQixJQUFJQyxFQUFFLEdBQUdwQixNQUFNLENBQUNxQixlQUFlLENBQUNGLEVBQUUsRUFBRSw2QkFBNkIsQ0FBQztNQUNsRSxJQUFJdkssSUFBSSxDQUFDbUosT0FBTyxFQUFFO1FBQ2hCbkosSUFBSSxDQUFDZ0ssZUFBZSxDQUFDeEssSUFBSSxDQUFDZ0wsRUFBRSxDQUFDO01BQy9CLENBQUMsTUFBTTtRQUNMO1FBQ0FwQixNQUFNLENBQUNzQixLQUFLLENBQUNGLEVBQUUsQ0FBQztNQUNsQjtJQUNGLENBQUM7SUFDREcsYUFBYSxFQUFFM0ssSUFBSSxDQUFDNEssY0FBYyxFQUFFO0lBQ3BDQyxXQUFXLEVBQUU3SyxJQUFJLENBQUMwQixNQUFNLENBQUNvSjtFQUMzQixDQUFDO0VBRUQ5SyxJQUFJLENBQUNrQyxJQUFJLENBQUM7SUFBRTZJLEdBQUcsRUFBRSxXQUFXO0lBQUVDLE9BQU8sRUFBRWhMLElBQUksQ0FBQzhIO0VBQUcsQ0FBQyxDQUFDOztFQUVqRDtFQUNBdkQsS0FBSyxDQUFDLFlBQVk7SUFDaEJ2RSxJQUFJLENBQUNpTCxrQkFBa0IsRUFBRTtFQUMzQixDQUFDLENBQUMsQ0FBQ0MsR0FBRyxFQUFFO0VBRVIsSUFBSW5DLE9BQU8sS0FBSyxNQUFNLElBQUlDLE9BQU8sQ0FBQ21DLGlCQUFpQixLQUFLLENBQUMsRUFBRTtJQUN6RDtJQUNBekosTUFBTSxDQUFDQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFFN0IzQixJQUFJLENBQUNvTCxTQUFTLEdBQUcsSUFBSUMsU0FBUyxDQUFDQyxTQUFTLENBQUM7TUFDdkNILGlCQUFpQixFQUFFbkMsT0FBTyxDQUFDbUMsaUJBQWlCO01BQzVDSSxnQkFBZ0IsRUFBRXZDLE9BQU8sQ0FBQ3VDLGdCQUFnQjtNQUMxQ0MsU0FBUyxFQUFFLFlBQVk7UUFDckJ4TCxJQUFJLENBQUNxSyxLQUFLLEVBQUU7TUFDZCxDQUFDO01BQ0RvQixRQUFRLEVBQUUsWUFBWTtRQUNwQnpMLElBQUksQ0FBQ2tDLElBQUksQ0FBQztVQUFDNkksR0FBRyxFQUFFO1FBQU0sQ0FBQyxDQUFDO01BQzFCO0lBQ0YsQ0FBQyxDQUFDO0lBQ0YvSyxJQUFJLENBQUNvTCxTQUFTLENBQUNNLEtBQUssRUFBRTtFQUN4QjtFQUVBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUlBLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQ0MsS0FBSyxDQUFDQyxtQkFBbUIsQ0FDdEUsVUFBVSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDOUIsQ0FBQztBQUVEbEosTUFBTSxDQUFDQyxNQUFNLENBQUNrRyxPQUFPLENBQUNqRyxTQUFTLEVBQUU7RUFFL0JpSixTQUFTLEVBQUUsVUFBVUMsZUFBZSxFQUFFO0lBQ3BDLElBQUkvTCxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlBLElBQUksQ0FBQzZKLFVBQVUsRUFDakI3SixJQUFJLENBQUNrQyxJQUFJLENBQUM7TUFBQzZJLEdBQUcsRUFBRSxPQUFPO01BQUVpQixJQUFJLEVBQUVEO0lBQWUsQ0FBQyxDQUFDLENBQUMsS0FDOUM7TUFDSGhOLENBQUMsQ0FBQzBELElBQUksQ0FBQ3NKLGVBQWUsRUFBRSxVQUFVRSxjQUFjLEVBQUU7UUFDaERqTSxJQUFJLENBQUMrSixhQUFhLENBQUN2SyxJQUFJLENBQUN5TSxjQUFjLENBQUM7TUFDekMsQ0FBQyxDQUFDO0lBQ0o7RUFDRixDQUFDO0VBRURDLFFBQVEsQ0FBQ25GLGNBQWMsRUFBRTtJQUN2QixPQUFPLElBQUksQ0FBQzhDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQzdJLE1BQU0sQ0FBQ21MLHNCQUFzQixDQUFDcEYsY0FBYyxDQUFDLENBQUNyQyxpQkFBaUI7RUFDakcsQ0FBQztFQUdEMEgsU0FBUyxDQUFDckYsY0FBYyxFQUFFZSxFQUFFLEVBQUVNLE1BQU0sRUFBRTtJQUNwQyxJQUFJLElBQUksQ0FBQzhELFFBQVEsQ0FBQ25GLGNBQWMsQ0FBQyxFQUMvQixJQUFJLENBQUM3RSxJQUFJLENBQUM7TUFBQzZJLEdBQUcsRUFBRSxPQUFPO01BQUVzQixVQUFVLEVBQUV0RixjQUFjO01BQUVlLEVBQUU7TUFBRU07SUFBTSxDQUFDLENBQUM7RUFDckUsQ0FBQztFQUVEa0UsV0FBVyxDQUFDdkYsY0FBYyxFQUFFZSxFQUFFLEVBQUVNLE1BQU0sRUFBRTtJQUN0QyxJQUFJckosQ0FBQyxDQUFDcUksT0FBTyxDQUFDZ0IsTUFBTSxDQUFDLEVBQ25CO0lBRUYsSUFBSSxJQUFJLENBQUM4RCxRQUFRLENBQUNuRixjQUFjLENBQUMsRUFBRTtNQUNqQyxJQUFJLENBQUM3RSxJQUFJLENBQUM7UUFDUjZJLEdBQUcsRUFBRSxTQUFTO1FBQ2RzQixVQUFVLEVBQUV0RixjQUFjO1FBQzFCZSxFQUFFO1FBQ0ZNO01BQ0YsQ0FBQyxDQUFDO0lBQ0o7RUFDRixDQUFDO0VBRURtRSxXQUFXLENBQUN4RixjQUFjLEVBQUVlLEVBQUUsRUFBRTtJQUM5QixJQUFJLElBQUksQ0FBQ29FLFFBQVEsQ0FBQ25GLGNBQWMsQ0FBQyxFQUMvQixJQUFJLENBQUM3RSxJQUFJLENBQUM7TUFBQzZJLEdBQUcsRUFBRSxTQUFTO01BQUVzQixVQUFVLEVBQUV0RixjQUFjO01BQUVlO0lBQUUsQ0FBQyxDQUFDO0VBQy9ELENBQUM7RUFFRDBFLGdCQUFnQixFQUFFLFlBQVk7SUFDNUIsSUFBSXhNLElBQUksR0FBRyxJQUFJO0lBQ2YsT0FBTztNQUNMZ0ksS0FBSyxFQUFFakosQ0FBQyxDQUFDNEksSUFBSSxDQUFDM0gsSUFBSSxDQUFDb00sU0FBUyxFQUFFcE0sSUFBSSxDQUFDO01BQ25Dd0ksT0FBTyxFQUFFekosQ0FBQyxDQUFDNEksSUFBSSxDQUFDM0gsSUFBSSxDQUFDc00sV0FBVyxFQUFFdE0sSUFBSSxDQUFDO01BQ3ZDbUksT0FBTyxFQUFFcEosQ0FBQyxDQUFDNEksSUFBSSxDQUFDM0gsSUFBSSxDQUFDdU0sV0FBVyxFQUFFdk0sSUFBSTtJQUN4QyxDQUFDO0VBQ0gsQ0FBQztFQUVEeU0saUJBQWlCLEVBQUUsVUFBVTFGLGNBQWMsRUFBRTtJQUMzQyxJQUFJL0csSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJc0YsR0FBRyxHQUFHdEYsSUFBSSxDQUFDNEosZUFBZSxDQUFDL0QsR0FBRyxDQUFDa0IsY0FBYyxDQUFDO0lBQ2xELElBQUksQ0FBQ3pCLEdBQUcsRUFBRTtNQUNSQSxHQUFHLEdBQUcsSUFBSXdCLHFCQUFxQixDQUFDQyxjQUFjLEVBQ1ovRyxJQUFJLENBQUN3TSxnQkFBZ0IsRUFBRSxDQUFDO01BQzFEeE0sSUFBSSxDQUFDNEosZUFBZSxDQUFDakQsR0FBRyxDQUFDSSxjQUFjLEVBQUV6QixHQUFHLENBQUM7SUFDL0M7SUFDQSxPQUFPQSxHQUFHO0VBQ1osQ0FBQztFQUVEMEMsS0FBSyxDQUFDckMsa0JBQWtCLEVBQUVvQixjQUFjLEVBQUVlLEVBQUUsRUFBRU0sTUFBTSxFQUFFO0lBQ3BELElBQUksSUFBSSxDQUFDcEgsTUFBTSxDQUFDbUwsc0JBQXNCLENBQUNwRixjQUFjLENBQUMsQ0FBQ3JDLGlCQUFpQixFQUFFO01BQ3hFLE1BQU1nSSxJQUFJLEdBQUcsSUFBSSxDQUFDRCxpQkFBaUIsQ0FBQzFGLGNBQWMsQ0FBQztNQUNuRDJGLElBQUksQ0FBQzFFLEtBQUssQ0FBQ3JDLGtCQUFrQixFQUFFbUMsRUFBRSxFQUFFTSxNQUFNLENBQUM7SUFDNUMsQ0FBQyxNQUFNO01BQ0wsSUFBSSxDQUFDZ0UsU0FBUyxDQUFDckYsY0FBYyxFQUFFZSxFQUFFLEVBQUVNLE1BQU0sQ0FBQztJQUM1QztFQUNGLENBQUM7RUFFREQsT0FBTyxDQUFDeEMsa0JBQWtCLEVBQUVvQixjQUFjLEVBQUVlLEVBQUUsRUFBRTtJQUM5QyxJQUFJLElBQUksQ0FBQzlHLE1BQU0sQ0FBQ21MLHNCQUFzQixDQUFDcEYsY0FBYyxDQUFDLENBQUNyQyxpQkFBaUIsRUFBRTtNQUN4RSxNQUFNZ0ksSUFBSSxHQUFHLElBQUksQ0FBQ0QsaUJBQWlCLENBQUMxRixjQUFjLENBQUM7TUFDbkQyRixJQUFJLENBQUN2RSxPQUFPLENBQUN4QyxrQkFBa0IsRUFBRW1DLEVBQUUsQ0FBQztNQUNwQyxJQUFJNEUsSUFBSSxDQUFDdEYsT0FBTyxFQUFFLEVBQUU7UUFDakIsSUFBSSxDQUFDd0MsZUFBZSxDQUFDeEQsTUFBTSxDQUFDVyxjQUFjLENBQUM7TUFDOUM7SUFDRixDQUFDLE1BQU07TUFDTCxJQUFJLENBQUN3RixXQUFXLENBQUN4RixjQUFjLEVBQUVlLEVBQUUsQ0FBQztJQUN0QztFQUNGLENBQUM7RUFFRFUsT0FBTyxDQUFDN0Msa0JBQWtCLEVBQUVvQixjQUFjLEVBQUVlLEVBQUUsRUFBRU0sTUFBTSxFQUFFO0lBQ3RELElBQUksSUFBSSxDQUFDcEgsTUFBTSxDQUFDbUwsc0JBQXNCLENBQUNwRixjQUFjLENBQUMsQ0FBQ3JDLGlCQUFpQixFQUFFO01BQ3hFLE1BQU1nSSxJQUFJLEdBQUcsSUFBSSxDQUFDRCxpQkFBaUIsQ0FBQzFGLGNBQWMsQ0FBQztNQUNuRDJGLElBQUksQ0FBQ2xFLE9BQU8sQ0FBQzdDLGtCQUFrQixFQUFFbUMsRUFBRSxFQUFFTSxNQUFNLENBQUM7SUFDOUMsQ0FBQyxNQUFNO01BQ0wsSUFBSSxDQUFDa0UsV0FBVyxDQUFDdkYsY0FBYyxFQUFFZSxFQUFFLEVBQUVNLE1BQU0sQ0FBQztJQUM5QztFQUNGLENBQUM7RUFFRDZDLGtCQUFrQixFQUFFLFlBQVk7SUFDOUIsSUFBSWpMLElBQUksR0FBRyxJQUFJO0lBQ2Y7SUFDQTtJQUNBO0lBQ0EsSUFBSTJNLFFBQVEsR0FBRzVOLENBQUMsQ0FBQzBILEtBQUssQ0FBQ3pHLElBQUksQ0FBQ2dCLE1BQU0sQ0FBQzRMLDBCQUEwQixDQUFDO0lBQzlEN04sQ0FBQyxDQUFDMEQsSUFBSSxDQUFDa0ssUUFBUSxFQUFFLFVBQVVFLE9BQU8sRUFBRTtNQUNsQzdNLElBQUksQ0FBQzhNLGtCQUFrQixDQUFDRCxPQUFPLENBQUM7SUFDbEMsQ0FBQyxDQUFDO0VBQ0osQ0FBQztFQUVEO0VBQ0F4QyxLQUFLLEVBQUUsWUFBWTtJQUNqQixJQUFJckssSUFBSSxHQUFHLElBQUk7O0lBRWY7SUFDQTtJQUNBOztJQUVBO0lBQ0EsSUFBSSxDQUFFQSxJQUFJLENBQUNtSixPQUFPLEVBQ2hCOztJQUVGO0lBQ0FuSixJQUFJLENBQUNtSixPQUFPLEdBQUcsSUFBSTtJQUNuQm5KLElBQUksQ0FBQzRKLGVBQWUsR0FBRyxJQUFJMUUsR0FBRyxFQUFFO0lBRWhDLElBQUlsRixJQUFJLENBQUNvTCxTQUFTLEVBQUU7TUFDbEJwTCxJQUFJLENBQUNvTCxTQUFTLENBQUMyQixJQUFJLEVBQUU7TUFDckIvTSxJQUFJLENBQUNvTCxTQUFTLEdBQUcsSUFBSTtJQUN2QjtJQUVBLElBQUlwTCxJQUFJLENBQUMwQixNQUFNLEVBQUU7TUFDZjFCLElBQUksQ0FBQzBCLE1BQU0sQ0FBQzJJLEtBQUssRUFBRTtNQUNuQnJLLElBQUksQ0FBQzBCLE1BQU0sQ0FBQ3NMLGNBQWMsR0FBRyxJQUFJO0lBQ25DO0lBRUFyQixPQUFPLENBQUMsWUFBWSxDQUFDLElBQUlBLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQ0MsS0FBSyxDQUFDQyxtQkFBbUIsQ0FDdEUsVUFBVSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUU3QnpDLE1BQU0sQ0FBQ3NCLEtBQUssQ0FBQyxZQUFZO01BQ3ZCO01BQ0E7TUFDQTtNQUNBMUssSUFBSSxDQUFDaU4sMkJBQTJCLEVBQUU7O01BRWxDO01BQ0E7TUFDQWxPLENBQUMsQ0FBQzBELElBQUksQ0FBQ3pDLElBQUksQ0FBQ2dLLGVBQWUsRUFBRSxVQUFVdEgsUUFBUSxFQUFFO1FBQy9DQSxRQUFRLEVBQUU7TUFDWixDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7O0lBRUY7SUFDQTFDLElBQUksQ0FBQ2dCLE1BQU0sQ0FBQ2tNLGNBQWMsQ0FBQ2xOLElBQUksQ0FBQztFQUNsQyxDQUFDO0VBRUQ7RUFDQTtFQUNBa0MsSUFBSSxFQUFFLFVBQVU2SSxHQUFHLEVBQUU7SUFDbkIsSUFBSS9LLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUEsSUFBSSxDQUFDMEIsTUFBTSxFQUFFO01BQ2YsSUFBSTBILE1BQU0sQ0FBQytELGFBQWEsRUFDdEIvRCxNQUFNLENBQUNnRSxNQUFNLENBQUMsVUFBVSxFQUFFL0IsU0FBUyxDQUFDZ0MsWUFBWSxDQUFDdEMsR0FBRyxDQUFDLENBQUM7TUFDeEQvSyxJQUFJLENBQUMwQixNQUFNLENBQUNRLElBQUksQ0FBQ21KLFNBQVMsQ0FBQ2dDLFlBQVksQ0FBQ3RDLEdBQUcsQ0FBQyxDQUFDO0lBQy9DO0VBQ0YsQ0FBQztFQUVEO0VBQ0F1QyxTQUFTLEVBQUUsVUFBVUMsTUFBTSxFQUFFQyxnQkFBZ0IsRUFBRTtJQUM3QyxJQUFJeE4sSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJK0ssR0FBRyxHQUFHO01BQUNBLEdBQUcsRUFBRSxPQUFPO01BQUV3QyxNQUFNLEVBQUVBO0lBQU0sQ0FBQztJQUN4QyxJQUFJQyxnQkFBZ0IsRUFDbEJ6QyxHQUFHLENBQUN5QyxnQkFBZ0IsR0FBR0EsZ0JBQWdCO0lBQ3pDeE4sSUFBSSxDQUFDa0MsSUFBSSxDQUFDNkksR0FBRyxDQUFDO0VBQ2hCLENBQUM7RUFFRDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTBDLGNBQWMsRUFBRSxVQUFVQyxNQUFNLEVBQUU7SUFDaEMsSUFBSTFOLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSSxDQUFDQSxJQUFJLENBQUNtSixPQUFPO01BQUU7TUFDakI7O0lBRUY7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSW5KLElBQUksQ0FBQ29MLFNBQVMsRUFBRTtNQUNsQjdHLEtBQUssQ0FBQyxZQUFZO1FBQ2hCdkUsSUFBSSxDQUFDb0wsU0FBUyxDQUFDdUMsZUFBZSxFQUFFO01BQ2xDLENBQUMsQ0FBQyxDQUFDekMsR0FBRyxFQUFFO0lBQ1Y7SUFFQSxJQUFJbEwsSUFBSSxDQUFDK0ksT0FBTyxLQUFLLE1BQU0sSUFBSTJFLE1BQU0sQ0FBQzNDLEdBQUcsS0FBSyxNQUFNLEVBQUU7TUFDcEQsSUFBSS9LLElBQUksQ0FBQ2tLLGVBQWUsRUFDdEJsSyxJQUFJLENBQUNrQyxJQUFJLENBQUM7UUFBQzZJLEdBQUcsRUFBRSxNQUFNO1FBQUVqRCxFQUFFLEVBQUU0RixNQUFNLENBQUM1RjtNQUFFLENBQUMsQ0FBQztNQUN6QztJQUNGO0lBQ0EsSUFBSTlILElBQUksQ0FBQytJLE9BQU8sS0FBSyxNQUFNLElBQUkyRSxNQUFNLENBQUMzQyxHQUFHLEtBQUssTUFBTSxFQUFFO01BQ3BEO01BQ0E7SUFDRjtJQUVBL0ssSUFBSSxDQUFDbUosT0FBTyxDQUFDM0osSUFBSSxDQUFDa08sTUFBTSxDQUFDO0lBQ3pCLElBQUkxTixJQUFJLENBQUN1SixhQUFhLEVBQ3BCO0lBQ0Z2SixJQUFJLENBQUN1SixhQUFhLEdBQUcsSUFBSTtJQUV6QixJQUFJcUUsV0FBVyxHQUFHLFlBQVk7TUFDNUIsSUFBSTdDLEdBQUcsR0FBRy9LLElBQUksQ0FBQ21KLE9BQU8sSUFBSW5KLElBQUksQ0FBQ21KLE9BQU8sQ0FBQzBFLEtBQUssRUFBRTtNQUM5QyxJQUFJLENBQUM5QyxHQUFHLEVBQUU7UUFDUi9LLElBQUksQ0FBQ3VKLGFBQWEsR0FBRyxLQUFLO1FBQzFCO01BQ0Y7TUFFQWhGLEtBQUssQ0FBQyxZQUFZO1FBQ2hCLElBQUkrRSxPQUFPLEdBQUcsSUFBSTtRQUVsQixJQUFJd0UsT0FBTyxHQUFHLFlBQVk7VUFDeEIsSUFBSSxDQUFDeEUsT0FBTyxFQUNWLE9BQU8sQ0FBQztVQUNWQSxPQUFPLEdBQUcsS0FBSztVQUNmc0UsV0FBVyxFQUFFO1FBQ2YsQ0FBQztRQUVENU4sSUFBSSxDQUFDZ0IsTUFBTSxDQUFDK00sYUFBYSxDQUFDdEwsSUFBSSxDQUFDLFVBQVVDLFFBQVEsRUFBRTtVQUNqREEsUUFBUSxDQUFDcUksR0FBRyxFQUFFL0ssSUFBSSxDQUFDO1VBQ25CLE9BQU8sSUFBSTtRQUNiLENBQUMsQ0FBQztRQUVGLElBQUlqQixDQUFDLENBQUMySCxHQUFHLENBQUMxRyxJQUFJLENBQUNnTyxpQkFBaUIsRUFBRWpELEdBQUcsQ0FBQ0EsR0FBRyxDQUFDLEVBQ3hDL0ssSUFBSSxDQUFDZ08saUJBQWlCLENBQUNqRCxHQUFHLENBQUNBLEdBQUcsQ0FBQyxDQUFDa0QsSUFBSSxDQUFDak8sSUFBSSxFQUFFK0ssR0FBRyxFQUFFK0MsT0FBTyxDQUFDLENBQUMsS0FFekQ5TixJQUFJLENBQUNzTixTQUFTLENBQUMsYUFBYSxFQUFFdkMsR0FBRyxDQUFDO1FBQ3BDK0MsT0FBTyxFQUFFLENBQUMsQ0FBQztNQUNiLENBQUMsQ0FBQyxDQUFDNUMsR0FBRyxFQUFFO0lBQ1YsQ0FBQztJQUVEMEMsV0FBVyxFQUFFO0VBQ2YsQ0FBQztFQUVESSxpQkFBaUIsRUFBRTtJQUNqQkUsR0FBRyxFQUFFLFVBQVVuRCxHQUFHLEVBQUUrQyxPQUFPLEVBQUU7TUFDM0IsSUFBSTlOLElBQUksR0FBRyxJQUFJOztNQUVmO01BQ0E7TUFDQUEsSUFBSSxDQUFDd0osYUFBYSxHQUFHc0UsT0FBTzs7TUFFNUI7TUFDQSxJQUFJLE9BQVEvQyxHQUFHLENBQUNqRCxFQUFHLEtBQUssUUFBUSxJQUM1QixPQUFRaUQsR0FBRyxDQUFDb0QsSUFBSyxLQUFLLFFBQVEsSUFDNUIsUUFBUSxJQUFJcEQsR0FBRyxJQUFLLEVBQUVBLEdBQUcsQ0FBQ3FELE1BQU0sWUFBWUMsS0FBSyxDQUFFLEVBQUU7UUFDekRyTyxJQUFJLENBQUNzTixTQUFTLENBQUMsd0JBQXdCLEVBQUV2QyxHQUFHLENBQUM7UUFDN0M7TUFDRjtNQUVBLElBQUksQ0FBQy9LLElBQUksQ0FBQ2dCLE1BQU0sQ0FBQ3NOLGdCQUFnQixDQUFDdkQsR0FBRyxDQUFDb0QsSUFBSSxDQUFDLEVBQUU7UUFDM0NuTyxJQUFJLENBQUNrQyxJQUFJLENBQUM7VUFDUjZJLEdBQUcsRUFBRSxPQUFPO1VBQUVqRCxFQUFFLEVBQUVpRCxHQUFHLENBQUNqRCxFQUFFO1VBQ3hCeUcsS0FBSyxFQUFFLElBQUluRixNQUFNLENBQUNSLEtBQUssQ0FBQyxHQUFHLDBCQUFtQm1DLEdBQUcsQ0FBQ29ELElBQUk7UUFBYyxDQUFDLENBQUM7UUFDeEU7TUFDRjtNQUVBLElBQUluTyxJQUFJLENBQUN5SixVQUFVLENBQUMvQyxHQUFHLENBQUNxRSxHQUFHLENBQUNqRCxFQUFFLENBQUM7UUFDN0I7UUFDQTtRQUNBO1FBQ0E7O01BRUY7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBLElBQUk2RCxPQUFPLENBQUMsa0JBQWtCLENBQUMsRUFBRTtRQUMvQixJQUFJNkMsY0FBYyxHQUFHN0MsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUM2QyxjQUFjO1FBQy9ELElBQUlDLGdCQUFnQixHQUFHO1VBQ3JCOUUsTUFBTSxFQUFFM0osSUFBSSxDQUFDMkosTUFBTTtVQUNuQmdCLGFBQWEsRUFBRTNLLElBQUksQ0FBQ29LLGdCQUFnQixDQUFDTyxhQUFhO1VBQ2xEK0QsSUFBSSxFQUFFLGNBQWM7VUFDcEJQLElBQUksRUFBRXBELEdBQUcsQ0FBQ29ELElBQUk7VUFDZFEsWUFBWSxFQUFFM08sSUFBSSxDQUFDOEg7UUFDckIsQ0FBQztRQUVEMEcsY0FBYyxDQUFDSSxVQUFVLENBQUNILGdCQUFnQixDQUFDO1FBQzNDLElBQUlJLGVBQWUsR0FBR0wsY0FBYyxDQUFDTSxNQUFNLENBQUNMLGdCQUFnQixDQUFDO1FBQzdELElBQUksQ0FBQ0ksZUFBZSxDQUFDRSxPQUFPLEVBQUU7VUFDNUIvTyxJQUFJLENBQUNrQyxJQUFJLENBQUM7WUFDUjZJLEdBQUcsRUFBRSxPQUFPO1lBQUVqRCxFQUFFLEVBQUVpRCxHQUFHLENBQUNqRCxFQUFFO1lBQ3hCeUcsS0FBSyxFQUFFLElBQUluRixNQUFNLENBQUNSLEtBQUssQ0FDckIsbUJBQW1CLEVBQ25CNEYsY0FBYyxDQUFDUSxlQUFlLENBQUNILGVBQWUsQ0FBQyxFQUMvQztjQUFDSSxXQUFXLEVBQUVKLGVBQWUsQ0FBQ0k7WUFBVyxDQUFDO1VBQzlDLENBQUMsQ0FBQztVQUNGO1FBQ0Y7TUFDRjtNQUVBLElBQUlwQyxPQUFPLEdBQUc3TSxJQUFJLENBQUNnQixNQUFNLENBQUNzTixnQkFBZ0IsQ0FBQ3ZELEdBQUcsQ0FBQ29ELElBQUksQ0FBQztNQUVwRG5PLElBQUksQ0FBQzhNLGtCQUFrQixDQUFDRCxPQUFPLEVBQUU5QixHQUFHLENBQUNqRCxFQUFFLEVBQUVpRCxHQUFHLENBQUNxRCxNQUFNLEVBQUVyRCxHQUFHLENBQUNvRCxJQUFJLENBQUM7O01BRTlEO01BQ0FuTyxJQUFJLENBQUN3SixhQUFhLEdBQUcsSUFBSTtJQUMzQixDQUFDO0lBRUQwRixLQUFLLEVBQUUsVUFBVW5FLEdBQUcsRUFBRTtNQUNwQixJQUFJL0ssSUFBSSxHQUFHLElBQUk7TUFFZkEsSUFBSSxDQUFDbVAsaUJBQWlCLENBQUNwRSxHQUFHLENBQUNqRCxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVEc0gsTUFBTSxFQUFFLFVBQVVyRSxHQUFHLEVBQUUrQyxPQUFPLEVBQUU7TUFDOUIsSUFBSTlOLElBQUksR0FBRyxJQUFJOztNQUVmO01BQ0E7TUFDQTtNQUNBLElBQUksT0FBUStLLEdBQUcsQ0FBQ2pELEVBQUcsS0FBSyxRQUFRLElBQzVCLE9BQVFpRCxHQUFHLENBQUNxRSxNQUFPLEtBQUssUUFBUSxJQUM5QixRQUFRLElBQUlyRSxHQUFHLElBQUssRUFBRUEsR0FBRyxDQUFDcUQsTUFBTSxZQUFZQyxLQUFLLENBQUUsSUFDbkQsWUFBWSxJQUFJdEQsR0FBRyxJQUFNLE9BQU9BLEdBQUcsQ0FBQ3NFLFVBQVUsS0FBSyxRQUFVLEVBQUU7UUFDbkVyUCxJQUFJLENBQUNzTixTQUFTLENBQUMsNkJBQTZCLEVBQUV2QyxHQUFHLENBQUM7UUFDbEQ7TUFDRjtNQUVBLElBQUlzRSxVQUFVLEdBQUd0RSxHQUFHLENBQUNzRSxVQUFVLElBQUksSUFBSTs7TUFFdkM7TUFDQTtNQUNBO01BQ0EsSUFBSUMsS0FBSyxHQUFHLElBQUloTCxTQUFTLENBQUNpTCxXQUFXO01BQ3JDRCxLQUFLLENBQUNFLGNBQWMsQ0FBQyxZQUFZO1FBQy9CO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQUYsS0FBSyxDQUFDRyxNQUFNLEVBQUU7UUFDZHpQLElBQUksQ0FBQ2tDLElBQUksQ0FBQztVQUNSNkksR0FBRyxFQUFFLFNBQVM7VUFBRTJFLE9BQU8sRUFBRSxDQUFDM0UsR0FBRyxDQUFDakQsRUFBRTtRQUFDLENBQUMsQ0FBQztNQUN2QyxDQUFDLENBQUM7O01BRUY7TUFDQSxJQUFJK0UsT0FBTyxHQUFHN00sSUFBSSxDQUFDZ0IsTUFBTSxDQUFDMk8sZUFBZSxDQUFDNUUsR0FBRyxDQUFDcUUsTUFBTSxDQUFDO01BQ3JELElBQUksQ0FBQ3ZDLE9BQU8sRUFBRTtRQUNaN00sSUFBSSxDQUFDa0MsSUFBSSxDQUFDO1VBQ1I2SSxHQUFHLEVBQUUsUUFBUTtVQUFFakQsRUFBRSxFQUFFaUQsR0FBRyxDQUFDakQsRUFBRTtVQUN6QnlHLEtBQUssRUFBRSxJQUFJbkYsTUFBTSxDQUFDUixLQUFLLENBQUMsR0FBRyxvQkFBYW1DLEdBQUcsQ0FBQ3FFLE1BQU07UUFBYyxDQUFDLENBQUM7UUFDcEVFLEtBQUssQ0FBQ00sR0FBRyxFQUFFO1FBQ1g7TUFDRjtNQUVBLElBQUlDLFNBQVMsR0FBRyxVQUFTbEcsTUFBTSxFQUFFO1FBQy9CM0osSUFBSSxDQUFDOFAsVUFBVSxDQUFDbkcsTUFBTSxDQUFDO01BQ3pCLENBQUM7TUFFRCxJQUFJb0csVUFBVSxHQUFHLElBQUkxRSxTQUFTLENBQUMyRSxnQkFBZ0IsQ0FBQztRQUM5Q0MsWUFBWSxFQUFFLEtBQUs7UUFDbkJ0RyxNQUFNLEVBQUUzSixJQUFJLENBQUMySixNQUFNO1FBQ25Ca0csU0FBUyxFQUFFQSxTQUFTO1FBQ3BCL0IsT0FBTyxFQUFFQSxPQUFPO1FBQ2hCOUwsVUFBVSxFQUFFaEMsSUFBSSxDQUFDb0ssZ0JBQWdCO1FBQ2pDaUYsVUFBVSxFQUFFQTtNQUNkLENBQUMsQ0FBQztNQUVGLE1BQU1hLE9BQU8sR0FBRyxJQUFJQyxPQUFPLENBQUMsQ0FBQ0MsT0FBTyxFQUFFQyxNQUFNLEtBQUs7UUFDL0M7UUFDQTtRQUNBO1FBQ0E7UUFDQSxJQUFJMUUsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7VUFDL0IsSUFBSTZDLGNBQWMsR0FBRzdDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDNkMsY0FBYztVQUMvRCxJQUFJQyxnQkFBZ0IsR0FBRztZQUNyQjlFLE1BQU0sRUFBRTNKLElBQUksQ0FBQzJKLE1BQU07WUFDbkJnQixhQUFhLEVBQUUzSyxJQUFJLENBQUNvSyxnQkFBZ0IsQ0FBQ08sYUFBYTtZQUNsRCtELElBQUksRUFBRSxRQUFRO1lBQ2RQLElBQUksRUFBRXBELEdBQUcsQ0FBQ3FFLE1BQU07WUFDaEJULFlBQVksRUFBRTNPLElBQUksQ0FBQzhIO1VBQ3JCLENBQUM7VUFDRDBHLGNBQWMsQ0FBQ0ksVUFBVSxDQUFDSCxnQkFBZ0IsQ0FBQztVQUMzQyxJQUFJSSxlQUFlLEdBQUdMLGNBQWMsQ0FBQ00sTUFBTSxDQUFDTCxnQkFBZ0IsQ0FBQztVQUM3RCxJQUFJLENBQUNJLGVBQWUsQ0FBQ0UsT0FBTyxFQUFFO1lBQzVCc0IsTUFBTSxDQUFDLElBQUlqSCxNQUFNLENBQUNSLEtBQUssQ0FDckIsbUJBQW1CLEVBQ25CNEYsY0FBYyxDQUFDUSxlQUFlLENBQUNILGVBQWUsQ0FBQyxFQUMvQztjQUFDSSxXQUFXLEVBQUVKLGVBQWUsQ0FBQ0k7WUFBVyxDQUFDLENBQzNDLENBQUM7WUFDRjtVQUNGO1FBQ0Y7UUFFQSxNQUFNcUIsZ0NBQWdDLEdBQUcsTUFBTTtVQUM3QyxNQUFNQyxjQUFjLEdBQUdDLEdBQUcsQ0FBQ0Msd0JBQXdCLENBQUNDLDJCQUEyQixDQUM3RVgsVUFBVSxDQUNYO1VBRUQsSUFBSTtZQUNGLElBQUlZLE1BQU07WUFDVixNQUFNQyxnQkFBZ0IsR0FBR0Msd0JBQXdCLENBQy9DaEUsT0FBTyxFQUNQa0QsVUFBVSxFQUNWaEYsR0FBRyxDQUFDcUQsTUFBTSxFQUNWLFdBQVcsR0FBR3JELEdBQUcsQ0FBQ3FFLE1BQU0sR0FBRyxHQUFHLENBQy9CO1lBQ0QsTUFBTTBCLFVBQVUsR0FDZEYsZ0JBQWdCLElBQUksT0FBT0EsZ0JBQWdCLENBQUNHLElBQUksS0FBSyxVQUFVO1lBQ2pFLElBQUlELFVBQVUsRUFBRTtjQUNkSCxNQUFNLEdBQUdSLE9BQU8sQ0FBQ2EsS0FBSyxDQUFDSixnQkFBZ0IsQ0FBQztZQUMxQyxDQUFDLE1BQU07Y0FDTEQsTUFBTSxHQUFHQyxnQkFBZ0I7WUFDM0I7WUFDQSxPQUFPRCxNQUFNO1VBQ2YsQ0FBQyxTQUFTO1lBQ1JILEdBQUcsQ0FBQ0Msd0JBQXdCLENBQUNRLElBQUksQ0FBQ1YsY0FBYyxDQUFDO1VBQ25EO1FBQ0YsQ0FBQztRQUVESCxPQUFPLENBQUM5TCxTQUFTLENBQUM0TSxrQkFBa0IsQ0FBQ0MsU0FBUyxDQUFDN0IsS0FBSyxFQUFFZ0IsZ0NBQWdDLENBQUMsQ0FBQztNQUMxRixDQUFDLENBQUM7TUFFRixTQUFTYyxNQUFNLEdBQUc7UUFDaEI5QixLQUFLLENBQUNNLEdBQUcsRUFBRTtRQUNYOUIsT0FBTyxFQUFFO01BQ1g7TUFFQSxNQUFNdUQsT0FBTyxHQUFHO1FBQ2R0RyxHQUFHLEVBQUUsUUFBUTtRQUNiakQsRUFBRSxFQUFFaUQsR0FBRyxDQUFDakQ7TUFDVixDQUFDO01BRURvSSxPQUFPLENBQUNhLElBQUksQ0FBQ0osTUFBTSxJQUFJO1FBQ3JCUyxNQUFNLEVBQUU7UUFDUixJQUFJVCxNQUFNLEtBQUs1SyxTQUFTLEVBQUU7VUFDeEJzTCxPQUFPLENBQUNWLE1BQU0sR0FBR0EsTUFBTTtRQUN6QjtRQUNBM1EsSUFBSSxDQUFDa0MsSUFBSSxDQUFDbVAsT0FBTyxDQUFDO01BQ3BCLENBQUMsRUFBR0MsU0FBUyxJQUFLO1FBQ2hCRixNQUFNLEVBQUU7UUFDUkMsT0FBTyxDQUFDOUMsS0FBSyxHQUFHZ0QscUJBQXFCLENBQ25DRCxTQUFTLG1DQUNpQnZHLEdBQUcsQ0FBQ3FFLE1BQU0sT0FDckM7UUFDRHBQLElBQUksQ0FBQ2tDLElBQUksQ0FBQ21QLE9BQU8sQ0FBQztNQUNwQixDQUFDLENBQUM7SUFDSjtFQUNGLENBQUM7RUFFREcsUUFBUSxFQUFFLFVBQVVDLENBQUMsRUFBRTtJQUNyQixJQUFJelIsSUFBSSxHQUFHLElBQUk7SUFDZkEsSUFBSSxDQUFDeUosVUFBVSxDQUFDeEcsT0FBTyxDQUFDd08sQ0FBQyxDQUFDO0lBQzFCelIsSUFBSSxDQUFDMEosY0FBYyxDQUFDekcsT0FBTyxDQUFDd08sQ0FBQyxDQUFDO0VBQ2hDLENBQUM7RUFFREMsb0JBQW9CLEVBQUUsVUFBVUMsU0FBUyxFQUFFO0lBQ3pDLElBQUkzUixJQUFJLEdBQUcsSUFBSTtJQUNmd0gsWUFBWSxDQUFDQyxRQUFRLENBQUNrSyxTQUFTLEVBQUUzUixJQUFJLENBQUM0SixlQUFlLEVBQUU7TUFDckRsQyxJQUFJLEVBQUUsVUFBVVgsY0FBYyxFQUFFNkssU0FBUyxFQUFFQyxVQUFVLEVBQUU7UUFDckRBLFVBQVUsQ0FBQ3ZLLElBQUksQ0FBQ3NLLFNBQVMsQ0FBQztNQUM1QixDQUFDO01BQ0QvSixTQUFTLEVBQUUsVUFBVWQsY0FBYyxFQUFFOEssVUFBVSxFQUFFO1FBQy9DQSxVQUFVLENBQUM1SyxTQUFTLENBQUNoRSxPQUFPLENBQUMsVUFBVXdGLE9BQU8sRUFBRVgsRUFBRSxFQUFFO1VBQ2xEOUgsSUFBSSxDQUFDb00sU0FBUyxDQUFDckYsY0FBYyxFQUFFZSxFQUFFLEVBQUVXLE9BQU8sQ0FBQ3BELFNBQVMsRUFBRSxDQUFDO1FBQ3pELENBQUMsQ0FBQztNQUNKLENBQUM7TUFDRDRDLFFBQVEsRUFBRSxVQUFVbEIsY0FBYyxFQUFFNkssU0FBUyxFQUFFO1FBQzdDQSxTQUFTLENBQUMzSyxTQUFTLENBQUNoRSxPQUFPLENBQUMsVUFBVTZPLEdBQUcsRUFBRWhLLEVBQUUsRUFBRTtVQUM3QzlILElBQUksQ0FBQ3VNLFdBQVcsQ0FBQ3hGLGNBQWMsRUFBRWUsRUFBRSxDQUFDO1FBQ3RDLENBQUMsQ0FBQztNQUNKO0lBQ0YsQ0FBQyxDQUFDO0VBQ0osQ0FBQztFQUVEO0VBQ0E7RUFDQWdJLFVBQVUsRUFBRSxVQUFTbkcsTUFBTSxFQUFFO0lBQzNCLElBQUkzSixJQUFJLEdBQUcsSUFBSTtJQUVmLElBQUkySixNQUFNLEtBQUssSUFBSSxJQUFJLE9BQU9BLE1BQU0sS0FBSyxRQUFRLEVBQy9DLE1BQU0sSUFBSWYsS0FBSyxDQUFDLGtEQUFrRCxHQUNsRCxPQUFPZSxNQUFNLENBQUM7O0lBRWhDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTNKLElBQUksQ0FBQzhKLDBCQUEwQixHQUFHLElBQUk7O0lBRXRDO0lBQ0E7SUFDQTlKLElBQUksQ0FBQ3dSLFFBQVEsQ0FBQyxVQUFVdEQsR0FBRyxFQUFFO01BQzNCQSxHQUFHLENBQUM2RCxXQUFXLEVBQUU7SUFDbkIsQ0FBQyxDQUFDOztJQUVGO0lBQ0E7SUFDQTtJQUNBL1IsSUFBSSxDQUFDNkosVUFBVSxHQUFHLEtBQUs7SUFDdkIsSUFBSThILFNBQVMsR0FBRzNSLElBQUksQ0FBQzRKLGVBQWU7SUFDcEM1SixJQUFJLENBQUM0SixlQUFlLEdBQUcsSUFBSTFFLEdBQUcsRUFBRTtJQUNoQ2xGLElBQUksQ0FBQzJKLE1BQU0sR0FBR0EsTUFBTTs7SUFFcEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTZHLEdBQUcsQ0FBQ0Msd0JBQXdCLENBQUNVLFNBQVMsQ0FBQ3BMLFNBQVMsRUFBRSxZQUFZO01BQzVEO01BQ0EsSUFBSWlNLFlBQVksR0FBR2hTLElBQUksQ0FBQ3lKLFVBQVU7TUFDbEN6SixJQUFJLENBQUN5SixVQUFVLEdBQUcsSUFBSXZFLEdBQUcsRUFBRTtNQUMzQmxGLElBQUksQ0FBQzBKLGNBQWMsR0FBRyxFQUFFO01BRXhCc0ksWUFBWSxDQUFDL08sT0FBTyxDQUFDLFVBQVVpTCxHQUFHLEVBQUVqQyxjQUFjLEVBQUU7UUFDbEQsSUFBSWdHLE1BQU0sR0FBRy9ELEdBQUcsQ0FBQ2dFLFNBQVMsRUFBRTtRQUM1QmxTLElBQUksQ0FBQ3lKLFVBQVUsQ0FBQzlDLEdBQUcsQ0FBQ3NGLGNBQWMsRUFBRWdHLE1BQU0sQ0FBQztRQUMzQztRQUNBO1FBQ0FBLE1BQU0sQ0FBQ0UsV0FBVyxFQUFFO01BQ3RCLENBQUMsQ0FBQzs7TUFFRjtNQUNBO01BQ0E7TUFDQW5TLElBQUksQ0FBQzhKLDBCQUEwQixHQUFHLEtBQUs7TUFDdkM5SixJQUFJLENBQUNpTCxrQkFBa0IsRUFBRTtJQUMzQixDQUFDLENBQUM7O0lBRUY7SUFDQTtJQUNBO0lBQ0E3QixNQUFNLENBQUNnSixnQkFBZ0IsQ0FBQyxZQUFZO01BQ2xDcFMsSUFBSSxDQUFDNkosVUFBVSxHQUFHLElBQUk7TUFDdEI3SixJQUFJLENBQUMwUixvQkFBb0IsQ0FBQ0MsU0FBUyxDQUFDO01BQ3BDLElBQUksQ0FBQzVTLENBQUMsQ0FBQ3FJLE9BQU8sQ0FBQ3BILElBQUksQ0FBQytKLGFBQWEsQ0FBQyxFQUFFO1FBQ2xDL0osSUFBSSxDQUFDOEwsU0FBUyxDQUFDOUwsSUFBSSxDQUFDK0osYUFBYSxDQUFDO1FBQ2xDL0osSUFBSSxDQUFDK0osYUFBYSxHQUFHLEVBQUU7TUFDekI7SUFDRixDQUFDLENBQUM7RUFDSixDQUFDO0VBRUQrQyxrQkFBa0IsRUFBRSxVQUFVRCxPQUFPLEVBQUV3RixLQUFLLEVBQUVqRSxNQUFNLEVBQUVELElBQUksRUFBRTtJQUMxRCxJQUFJbk8sSUFBSSxHQUFHLElBQUk7SUFFZixJQUFJa08sR0FBRyxHQUFHLElBQUlvRSxZQUFZLENBQ3hCdFMsSUFBSSxFQUFFNk0sT0FBTyxFQUFFd0YsS0FBSyxFQUFFakUsTUFBTSxFQUFFRCxJQUFJLENBQUM7SUFFckMsSUFBSW9FLGFBQWEsR0FBR3ZTLElBQUksQ0FBQ3dKLGFBQWE7SUFDdEM7SUFDQTtJQUNBO0lBQ0EwRSxHQUFHLENBQUNKLE9BQU8sR0FBR3lFLGFBQWEsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRXpDLElBQUlGLEtBQUssRUFDUHJTLElBQUksQ0FBQ3lKLFVBQVUsQ0FBQzlDLEdBQUcsQ0FBQzBMLEtBQUssRUFBRW5FLEdBQUcsQ0FBQyxDQUFDLEtBRWhDbE8sSUFBSSxDQUFDMEosY0FBYyxDQUFDbEssSUFBSSxDQUFDME8sR0FBRyxDQUFDO0lBRS9CQSxHQUFHLENBQUNpRSxXQUFXLEVBQUU7RUFDbkIsQ0FBQztFQUVEO0VBQ0FoRCxpQkFBaUIsRUFBRSxVQUFVa0QsS0FBSyxFQUFFOUQsS0FBSyxFQUFFO0lBQ3pDLElBQUl2TyxJQUFJLEdBQUcsSUFBSTtJQUVmLElBQUl3UyxPQUFPLEdBQUcsSUFBSTtJQUNsQixJQUFJSCxLQUFLLEVBQUU7TUFDVCxJQUFJSSxRQUFRLEdBQUd6UyxJQUFJLENBQUN5SixVQUFVLENBQUM1RCxHQUFHLENBQUN3TSxLQUFLLENBQUM7TUFDekMsSUFBSUksUUFBUSxFQUFFO1FBQ1pELE9BQU8sR0FBR0MsUUFBUSxDQUFDQyxLQUFLO1FBQ3hCRCxRQUFRLENBQUNFLG1CQUFtQixFQUFFO1FBQzlCRixRQUFRLENBQUNWLFdBQVcsRUFBRTtRQUN0Qi9SLElBQUksQ0FBQ3lKLFVBQVUsQ0FBQ3JELE1BQU0sQ0FBQ2lNLEtBQUssQ0FBQztNQUMvQjtJQUNGO0lBRUEsSUFBSU8sUUFBUSxHQUFHO01BQUM3SCxHQUFHLEVBQUUsT0FBTztNQUFFakQsRUFBRSxFQUFFdUs7SUFBSyxDQUFDO0lBRXhDLElBQUk5RCxLQUFLLEVBQUU7TUFDVHFFLFFBQVEsQ0FBQ3JFLEtBQUssR0FBR2dELHFCQUFxQixDQUNwQ2hELEtBQUssRUFDTGlFLE9BQU8sR0FBSSxXQUFXLEdBQUdBLE9BQU8sR0FBRyxNQUFNLEdBQUdILEtBQUssR0FDNUMsY0FBYyxHQUFHQSxLQUFNLENBQUM7SUFDakM7SUFFQXJTLElBQUksQ0FBQ2tDLElBQUksQ0FBQzBRLFFBQVEsQ0FBQztFQUNyQixDQUFDO0VBRUQ7RUFDQTtFQUNBM0YsMkJBQTJCLEVBQUUsWUFBWTtJQUN2QyxJQUFJak4sSUFBSSxHQUFHLElBQUk7SUFFZkEsSUFBSSxDQUFDeUosVUFBVSxDQUFDeEcsT0FBTyxDQUFDLFVBQVVpTCxHQUFHLEVBQUVwRyxFQUFFLEVBQUU7TUFDekNvRyxHQUFHLENBQUM2RCxXQUFXLEVBQUU7SUFDbkIsQ0FBQyxDQUFDO0lBQ0YvUixJQUFJLENBQUN5SixVQUFVLEdBQUcsSUFBSXZFLEdBQUcsRUFBRTtJQUUzQmxGLElBQUksQ0FBQzBKLGNBQWMsQ0FBQ3pHLE9BQU8sQ0FBQyxVQUFVaUwsR0FBRyxFQUFFO01BQ3pDQSxHQUFHLENBQUM2RCxXQUFXLEVBQUU7SUFDbkIsQ0FBQyxDQUFDO0lBQ0YvUixJQUFJLENBQUMwSixjQUFjLEdBQUcsRUFBRTtFQUMxQixDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0FrQixjQUFjLEVBQUUsWUFBWTtJQUMxQixJQUFJNUssSUFBSSxHQUFHLElBQUk7O0lBRWY7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJNlMsa0JBQWtCLEdBQUdDLFFBQVEsQ0FBQzNULE9BQU8sQ0FBQ0MsR0FBRyxDQUFDLHNCQUFzQixDQUFDLENBQUMsSUFBSSxDQUFDO0lBRTNFLElBQUl5VCxrQkFBa0IsS0FBSyxDQUFDLEVBQzFCLE9BQU83UyxJQUFJLENBQUMwQixNQUFNLENBQUNxUixhQUFhO0lBRWxDLElBQUlDLFlBQVksR0FBR2hULElBQUksQ0FBQzBCLE1BQU0sQ0FBQ29KLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztJQUN6RCxJQUFJLENBQUUvTCxDQUFDLENBQUNrVSxRQUFRLENBQUNELFlBQVksQ0FBQyxFQUM1QixPQUFPLElBQUk7SUFDYkEsWUFBWSxHQUFHQSxZQUFZLENBQUNFLElBQUksRUFBRSxDQUFDQyxLQUFLLENBQUMsU0FBUyxDQUFDOztJQUVuRDtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUlOLGtCQUFrQixHQUFHLENBQUMsSUFBSUEsa0JBQWtCLEdBQUdHLFlBQVksQ0FBQy9NLE1BQU0sRUFDcEUsT0FBTyxJQUFJO0lBRWIsT0FBTytNLFlBQVksQ0FBQ0EsWUFBWSxDQUFDL00sTUFBTSxHQUFHNE0sa0JBQWtCLENBQUM7RUFDL0Q7QUFDRixDQUFDLENBQUM7O0FBRUY7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJUCxZQUFZLEdBQUcsVUFDZnRILE9BQU8sRUFBRTZCLE9BQU8sRUFBRVosY0FBYyxFQUFFbUMsTUFBTSxFQUFFRCxJQUFJLEVBQUU7RUFDbEQsSUFBSW5PLElBQUksR0FBRyxJQUFJO0VBQ2ZBLElBQUksQ0FBQzhCLFFBQVEsR0FBR2tKLE9BQU8sQ0FBQyxDQUFDOztFQUV6QjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFaEwsSUFBSSxDQUFDZ0MsVUFBVSxHQUFHZ0osT0FBTyxDQUFDWixnQkFBZ0IsQ0FBQyxDQUFDOztFQUU1Q3BLLElBQUksQ0FBQ29ULFFBQVEsR0FBR3ZHLE9BQU87O0VBRXZCO0VBQ0E3TSxJQUFJLENBQUNxVCxlQUFlLEdBQUdwSCxjQUFjO0VBQ3JDO0VBQ0FqTSxJQUFJLENBQUMwUyxLQUFLLEdBQUd2RSxJQUFJO0VBRWpCbk8sSUFBSSxDQUFDc1QsT0FBTyxHQUFHbEYsTUFBTSxJQUFJLEVBQUU7O0VBRTNCO0VBQ0E7RUFDQTtFQUNBLElBQUlwTyxJQUFJLENBQUNxVCxlQUFlLEVBQUU7SUFDeEJyVCxJQUFJLENBQUN1VCxtQkFBbUIsR0FBRyxHQUFHLEdBQUd2VCxJQUFJLENBQUNxVCxlQUFlO0VBQ3ZELENBQUMsTUFBTTtJQUNMclQsSUFBSSxDQUFDdVQsbUJBQW1CLEdBQUcsR0FBRyxHQUFHdEssTUFBTSxDQUFDbkIsRUFBRSxFQUFFO0VBQzlDOztFQUVBO0VBQ0E5SCxJQUFJLENBQUN3VCxZQUFZLEdBQUcsS0FBSzs7RUFFekI7RUFDQXhULElBQUksQ0FBQ3lULGNBQWMsR0FBRyxFQUFFOztFQUV4QjtFQUNBO0VBQ0F6VCxJQUFJLENBQUMwVCxVQUFVLEdBQUcsSUFBSXhPLEdBQUcsRUFBRTs7RUFFM0I7RUFDQWxGLElBQUksQ0FBQzJULE1BQU0sR0FBRyxLQUFLOztFQUVuQjs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFM1QsSUFBSSxDQUFDMkosTUFBTSxHQUFHcUIsT0FBTyxDQUFDckIsTUFBTTs7RUFFNUI7RUFDQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBOztFQUVBM0osSUFBSSxDQUFDNFQsU0FBUyxHQUFHO0lBQ2ZDLFdBQVcsRUFBRUMsT0FBTyxDQUFDRCxXQUFXO0lBQ2hDRSxPQUFPLEVBQUVELE9BQU8sQ0FBQ0M7RUFDbkIsQ0FBQztFQUVEcEksT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJQSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUNDLEtBQUssQ0FBQ0MsbUJBQW1CLENBQ3RFLFVBQVUsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0FBQ25DLENBQUM7QUFFRGxKLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDMFAsWUFBWSxDQUFDelAsU0FBUyxFQUFFO0VBQ3BDc1AsV0FBVyxFQUFFLFlBQVc7SUFDdEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUksQ0FBQyxJQUFJLENBQUNyRSxPQUFPLEVBQUU7TUFDakIsSUFBSSxDQUFDQSxPQUFPLEdBQUcsTUFBTSxDQUFDLENBQUM7SUFDekI7SUFFQSxNQUFNOU4sSUFBSSxHQUFHLElBQUk7SUFDakIsSUFBSTRRLGdCQUFnQixHQUFHLElBQUk7SUFDM0IsSUFBSTtNQUNGQSxnQkFBZ0IsR0FBR0osR0FBRyxDQUFDd0QsNkJBQTZCLENBQUM3QyxTQUFTLENBQUNuUixJQUFJLEVBQUUsTUFDbkU2USx3QkFBd0IsQ0FDdEI3USxJQUFJLENBQUNvVCxRQUFRLEVBQ2JwVCxJQUFJLEVBQ0pxRyxLQUFLLENBQUNJLEtBQUssQ0FBQ3pHLElBQUksQ0FBQ3NULE9BQU8sQ0FBQztNQUN6QjtNQUNBO01BQ0E7TUFDQSxhQUFhLEdBQUd0VCxJQUFJLENBQUMwUyxLQUFLLEdBQUcsR0FBRyxDQUNqQyxDQUNGO0lBQ0gsQ0FBQyxDQUFDLE9BQU91QixDQUFDLEVBQUU7TUFDVmpVLElBQUksQ0FBQ3VPLEtBQUssQ0FBQzBGLENBQUMsQ0FBQztNQUNiO0lBQ0Y7O0lBRUE7SUFDQSxJQUFJalUsSUFBSSxDQUFDa1UsY0FBYyxFQUFFLEVBQUU7O0lBRTNCO0lBQ0E7SUFDQTtJQUNBLE1BQU1wRCxVQUFVLEdBQ2RGLGdCQUFnQixJQUFJLE9BQU9BLGdCQUFnQixDQUFDRyxJQUFJLEtBQUssVUFBVTtJQUNqRSxJQUFJRCxVQUFVLEVBQUU7TUFDZFgsT0FBTyxDQUFDQyxPQUFPLENBQUNRLGdCQUFnQixDQUFDLENBQUNHLElBQUksQ0FDcEM7UUFBQSxPQUFhL1EsSUFBSSxDQUFDbVUscUJBQXFCLENBQUN4TSxJQUFJLENBQUMzSCxJQUFJLENBQUMsQ0FBQyxZQUFPLENBQUM7TUFBQSxHQUMzRGlVLENBQUMsSUFBSWpVLElBQUksQ0FBQ3VPLEtBQUssQ0FBQzBGLENBQUMsQ0FBQyxDQUNuQjtJQUNILENBQUMsTUFBTTtNQUNMalUsSUFBSSxDQUFDbVUscUJBQXFCLENBQUN2RCxnQkFBZ0IsQ0FBQztJQUM5QztFQUNGLENBQUM7RUFFRHVELHFCQUFxQixFQUFFLFVBQVVDLEdBQUcsRUFBRTtJQUNwQztJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJcFUsSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJcVUsUUFBUSxHQUFHLFVBQVVDLENBQUMsRUFBRTtNQUMxQixPQUFPQSxDQUFDLElBQUlBLENBQUMsQ0FBQ0MsY0FBYztJQUM5QixDQUFDO0lBQ0QsSUFBSUYsUUFBUSxDQUFDRCxHQUFHLENBQUMsRUFBRTtNQUNqQixJQUFJO1FBQ0ZBLEdBQUcsQ0FBQ0csY0FBYyxDQUFDdlUsSUFBSSxDQUFDO01BQzFCLENBQUMsQ0FBQyxPQUFPaVUsQ0FBQyxFQUFFO1FBQ1ZqVSxJQUFJLENBQUN1TyxLQUFLLENBQUMwRixDQUFDLENBQUM7UUFDYjtNQUNGO01BQ0E7TUFDQTtNQUNBalUsSUFBSSxDQUFDd1UsS0FBSyxFQUFFO0lBQ2QsQ0FBQyxNQUFNLElBQUl6VixDQUFDLENBQUMwVixPQUFPLENBQUNMLEdBQUcsQ0FBQyxFQUFFO01BQ3pCO01BQ0EsSUFBSSxDQUFFclYsQ0FBQyxDQUFDMlYsR0FBRyxDQUFDTixHQUFHLEVBQUVDLFFBQVEsQ0FBQyxFQUFFO1FBQzFCclUsSUFBSSxDQUFDdU8sS0FBSyxDQUFDLElBQUkzRixLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztRQUMxRTtNQUNGO01BQ0E7TUFDQTtNQUNBO01BQ0EsSUFBSStMLGVBQWUsR0FBRyxDQUFDLENBQUM7TUFDeEIsS0FBSyxJQUFJM08sQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHb08sR0FBRyxDQUFDbk8sTUFBTSxFQUFFLEVBQUVELENBQUMsRUFBRTtRQUNuQyxJQUFJZSxjQUFjLEdBQUdxTixHQUFHLENBQUNwTyxDQUFDLENBQUMsQ0FBQzRPLGtCQUFrQixFQUFFO1FBQ2hELElBQUk3VixDQUFDLENBQUMySCxHQUFHLENBQUNpTyxlQUFlLEVBQUU1TixjQUFjLENBQUMsRUFBRTtVQUMxQy9HLElBQUksQ0FBQ3VPLEtBQUssQ0FBQyxJQUFJM0YsS0FBSyxDQUNsQiw0REFBNEQsR0FDMUQ3QixjQUFjLENBQUMsQ0FBQztVQUNwQjtRQUNGO1FBQ0E0TixlQUFlLENBQUM1TixjQUFjLENBQUMsR0FBRyxJQUFJO01BQ3hDO01BQUM7TUFFRCxJQUFJO1FBQ0ZoSSxDQUFDLENBQUMwRCxJQUFJLENBQUMyUixHQUFHLEVBQUUsVUFBVVMsR0FBRyxFQUFFO1VBQ3pCQSxHQUFHLENBQUNOLGNBQWMsQ0FBQ3ZVLElBQUksQ0FBQztRQUMxQixDQUFDLENBQUM7TUFDSixDQUFDLENBQUMsT0FBT2lVLENBQUMsRUFBRTtRQUNWalUsSUFBSSxDQUFDdU8sS0FBSyxDQUFDMEYsQ0FBQyxDQUFDO1FBQ2I7TUFDRjtNQUNBalUsSUFBSSxDQUFDd1UsS0FBSyxFQUFFO0lBQ2QsQ0FBQyxNQUFNLElBQUlKLEdBQUcsRUFBRTtNQUNkO01BQ0E7TUFDQTtNQUNBcFUsSUFBSSxDQUFDdU8sS0FBSyxDQUFDLElBQUkzRixLQUFLLENBQUMsK0NBQStDLEdBQzdDLHFCQUFxQixDQUFDLENBQUM7SUFDaEQ7RUFDRixDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBbUosV0FBVyxFQUFFLFlBQVc7SUFDdEIsSUFBSS9SLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUEsSUFBSSxDQUFDd1QsWUFBWSxFQUNuQjtJQUNGeFQsSUFBSSxDQUFDd1QsWUFBWSxHQUFHLElBQUk7SUFDeEJ4VCxJQUFJLENBQUM4VSxrQkFBa0IsRUFBRTtJQUN6Qm5KLE9BQU8sQ0FBQyxZQUFZLENBQUMsSUFBSUEsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDQyxLQUFLLENBQUNDLG1CQUFtQixDQUN0RSxVQUFVLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDO0VBQ3BDLENBQUM7RUFFRGlKLGtCQUFrQixFQUFFLFlBQVk7SUFDOUIsSUFBSTlVLElBQUksR0FBRyxJQUFJO0lBQ2Y7SUFDQSxJQUFJa0gsU0FBUyxHQUFHbEgsSUFBSSxDQUFDeVQsY0FBYztJQUNuQ3pULElBQUksQ0FBQ3lULGNBQWMsR0FBRyxFQUFFO0lBQ3hCMVUsQ0FBQyxDQUFDMEQsSUFBSSxDQUFDeUUsU0FBUyxFQUFFLFVBQVV4RSxRQUFRLEVBQUU7TUFDcENBLFFBQVEsRUFBRTtJQUNaLENBQUMsQ0FBQztFQUNKLENBQUM7RUFFRDtFQUNBaVEsbUJBQW1CLEVBQUUsWUFBWTtJQUMvQixJQUFJM1MsSUFBSSxHQUFHLElBQUk7SUFDZm9KLE1BQU0sQ0FBQ2dKLGdCQUFnQixDQUFDLFlBQVk7TUFDbENwUyxJQUFJLENBQUMwVCxVQUFVLENBQUN6USxPQUFPLENBQUMsVUFBVThSLGNBQWMsRUFBRWhPLGNBQWMsRUFBRTtRQUNoRWdPLGNBQWMsQ0FBQzlSLE9BQU8sQ0FBQyxVQUFVK1IsS0FBSyxFQUFFO1VBQ3RDaFYsSUFBSSxDQUFDbUksT0FBTyxDQUFDcEIsY0FBYyxFQUFFL0csSUFBSSxDQUFDNFQsU0FBUyxDQUFDRyxPQUFPLENBQUNpQixLQUFLLENBQUMsQ0FBQztRQUM3RCxDQUFDLENBQUM7TUFDSixDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7RUFDSixDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOUMsU0FBUyxFQUFFLFlBQVk7SUFDckIsSUFBSWxTLElBQUksR0FBRyxJQUFJO0lBQ2YsT0FBTyxJQUFJc1MsWUFBWSxDQUNyQnRTLElBQUksQ0FBQzhCLFFBQVEsRUFBRTlCLElBQUksQ0FBQ29ULFFBQVEsRUFBRXBULElBQUksQ0FBQ3FULGVBQWUsRUFBRXJULElBQUksQ0FBQ3NULE9BQU8sRUFDaEV0VCxJQUFJLENBQUMwUyxLQUFLLENBQUM7RUFDZixDQUFDO0VBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRW5FLEtBQUssRUFBRSxVQUFVQSxLQUFLLEVBQUU7SUFDdEIsSUFBSXZPLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUEsSUFBSSxDQUFDa1UsY0FBYyxFQUFFLEVBQ3ZCO0lBQ0ZsVSxJQUFJLENBQUM4QixRQUFRLENBQUNxTixpQkFBaUIsQ0FBQ25QLElBQUksQ0FBQ3FULGVBQWUsRUFBRTlFLEtBQUssQ0FBQztFQUM5RCxDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0V4QixJQUFJLEVBQUUsWUFBWTtJQUNoQixJQUFJL00sSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJQSxJQUFJLENBQUNrVSxjQUFjLEVBQUUsRUFDdkI7SUFDRmxVLElBQUksQ0FBQzhCLFFBQVEsQ0FBQ3FOLGlCQUFpQixDQUFDblAsSUFBSSxDQUFDcVQsZUFBZSxDQUFDO0VBQ3ZELENBQUM7RUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFNEIsTUFBTSxFQUFFLFVBQVV2UyxRQUFRLEVBQUU7SUFDMUIsSUFBSTFDLElBQUksR0FBRyxJQUFJO0lBQ2YwQyxRQUFRLEdBQUcwRyxNQUFNLENBQUNxQixlQUFlLENBQUMvSCxRQUFRLEVBQUUsaUJBQWlCLEVBQUUxQyxJQUFJLENBQUM7SUFDcEUsSUFBSUEsSUFBSSxDQUFDa1UsY0FBYyxFQUFFLEVBQ3ZCeFIsUUFBUSxFQUFFLENBQUMsS0FFWDFDLElBQUksQ0FBQ3lULGNBQWMsQ0FBQ2pVLElBQUksQ0FBQ2tELFFBQVEsQ0FBQztFQUN0QyxDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0F3UixjQUFjLEVBQUUsWUFBWTtJQUMxQixJQUFJbFUsSUFBSSxHQUFHLElBQUk7SUFDZixPQUFPQSxJQUFJLENBQUN3VCxZQUFZLElBQUl4VCxJQUFJLENBQUM4QixRQUFRLENBQUNxSCxPQUFPLEtBQUssSUFBSTtFQUM1RCxDQUFDO0VBRUQ7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0VuQixLQUFLLENBQUVqQixjQUFjLEVBQUVlLEVBQUUsRUFBRU0sTUFBTSxFQUFFO0lBQ2pDLElBQUksSUFBSSxDQUFDOEwsY0FBYyxFQUFFLEVBQ3ZCO0lBQ0ZwTSxFQUFFLEdBQUcsSUFBSSxDQUFDOEwsU0FBUyxDQUFDQyxXQUFXLENBQUMvTCxFQUFFLENBQUM7SUFFbkMsSUFBSSxJQUFJLENBQUNoRyxRQUFRLENBQUNkLE1BQU0sQ0FBQ21MLHNCQUFzQixDQUFDcEYsY0FBYyxDQUFDLENBQUNwQyx5QkFBeUIsRUFBRTtNQUN6RixJQUFJdVEsR0FBRyxHQUFHLElBQUksQ0FBQ3hCLFVBQVUsQ0FBQzdOLEdBQUcsQ0FBQ2tCLGNBQWMsQ0FBQztNQUM3QyxJQUFJbU8sR0FBRyxJQUFJLElBQUksRUFBRTtRQUNmQSxHQUFHLEdBQUcsSUFBSWxRLEdBQUcsRUFBRTtRQUNmLElBQUksQ0FBQzBPLFVBQVUsQ0FBQy9NLEdBQUcsQ0FBQ0ksY0FBYyxFQUFFbU8sR0FBRyxDQUFDO01BQzFDO01BQ0FBLEdBQUcsQ0FBQ3hNLEdBQUcsQ0FBQ1osRUFBRSxDQUFDO0lBQ2I7SUFFQSxJQUFJLENBQUNoRyxRQUFRLENBQUNrRyxLQUFLLENBQUMsSUFBSSxDQUFDdUwsbUJBQW1CLEVBQUV4TSxjQUFjLEVBQUVlLEVBQUUsRUFBRU0sTUFBTSxDQUFDO0VBQzNFLENBQUM7RUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRUksT0FBTyxDQUFFekIsY0FBYyxFQUFFZSxFQUFFLEVBQUVNLE1BQU0sRUFBRTtJQUNuQyxJQUFJLElBQUksQ0FBQzhMLGNBQWMsRUFBRSxFQUN2QjtJQUNGcE0sRUFBRSxHQUFHLElBQUksQ0FBQzhMLFNBQVMsQ0FBQ0MsV0FBVyxDQUFDL0wsRUFBRSxDQUFDO0lBQ25DLElBQUksQ0FBQ2hHLFFBQVEsQ0FBQzBHLE9BQU8sQ0FBQyxJQUFJLENBQUMrSyxtQkFBbUIsRUFBRXhNLGNBQWMsRUFBRWUsRUFBRSxFQUFFTSxNQUFNLENBQUM7RUFDN0UsQ0FBQztFQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRUQsT0FBTyxDQUFFcEIsY0FBYyxFQUFFZSxFQUFFLEVBQUU7SUFDM0IsSUFBSSxJQUFJLENBQUNvTSxjQUFjLEVBQUUsRUFDdkI7SUFDRnBNLEVBQUUsR0FBRyxJQUFJLENBQUM4TCxTQUFTLENBQUNDLFdBQVcsQ0FBQy9MLEVBQUUsQ0FBQztJQUVuQyxJQUFJLElBQUksQ0FBQ2hHLFFBQVEsQ0FBQ2QsTUFBTSxDQUFDbUwsc0JBQXNCLENBQUNwRixjQUFjLENBQUMsQ0FBQ3BDLHlCQUF5QixFQUFFO01BQ3pGO01BQ0E7TUFDQSxJQUFJLENBQUMrTyxVQUFVLENBQUM3TixHQUFHLENBQUNrQixjQUFjLENBQUMsQ0FBQ1gsTUFBTSxDQUFDMEIsRUFBRSxDQUFDO0lBQ2hEO0lBRUEsSUFBSSxDQUFDaEcsUUFBUSxDQUFDcUcsT0FBTyxDQUFDLElBQUksQ0FBQ29MLG1CQUFtQixFQUFFeE0sY0FBYyxFQUFFZSxFQUFFLENBQUM7RUFDckUsQ0FBQztFQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFME0sS0FBSyxFQUFFLFlBQVk7SUFDakIsSUFBSXhVLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUEsSUFBSSxDQUFDa1UsY0FBYyxFQUFFLEVBQ3ZCO0lBQ0YsSUFBSSxDQUFDbFUsSUFBSSxDQUFDcVQsZUFBZSxFQUN2QixPQUFPLENBQUU7SUFDWCxJQUFJLENBQUNyVCxJQUFJLENBQUMyVCxNQUFNLEVBQUU7TUFDaEIzVCxJQUFJLENBQUM4QixRQUFRLENBQUNnSyxTQUFTLENBQUMsQ0FBQzlMLElBQUksQ0FBQ3FULGVBQWUsQ0FBQyxDQUFDO01BQy9DclQsSUFBSSxDQUFDMlQsTUFBTSxHQUFHLElBQUk7SUFDcEI7RUFDRjtBQUNGLENBQUMsQ0FBQzs7QUFFRjtBQUNBO0FBQ0E7O0FBRUF3QixNQUFNLEdBQUcsWUFBd0I7RUFBQSxJQUFkbk0sT0FBTyx1RUFBRyxDQUFDLENBQUM7RUFDN0IsSUFBSWhKLElBQUksR0FBRyxJQUFJOztFQUVmO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0FBLElBQUksQ0FBQ2dKLE9BQU87SUFDVm1DLGlCQUFpQixFQUFFLEtBQUs7SUFDeEJJLGdCQUFnQixFQUFFLEtBQUs7SUFDdkI7SUFDQXBCLGNBQWMsRUFBRSxJQUFJO0lBQ3BCaUwsMEJBQTBCLEVBQUU1USxxQkFBcUIsQ0FBQ0M7RUFBWSxHQUMzRHVFLE9BQU8sQ0FDWDs7RUFFRDtFQUNBO0VBQ0E7RUFDQTtFQUNBaEosSUFBSSxDQUFDcVYsZ0JBQWdCLEdBQUcsSUFBSUMsSUFBSSxDQUFDO0lBQy9CQyxvQkFBb0IsRUFBRTtFQUN4QixDQUFDLENBQUM7O0VBRUY7RUFDQXZWLElBQUksQ0FBQytOLGFBQWEsR0FBRyxJQUFJdUgsSUFBSSxDQUFDO0lBQzVCQyxvQkFBb0IsRUFBRTtFQUN4QixDQUFDLENBQUM7RUFFRnZWLElBQUksQ0FBQ3NPLGdCQUFnQixHQUFHLENBQUMsQ0FBQztFQUMxQnRPLElBQUksQ0FBQzRNLDBCQUEwQixHQUFHLEVBQUU7RUFFcEM1TSxJQUFJLENBQUMyUCxlQUFlLEdBQUcsQ0FBQyxDQUFDO0VBRXpCM1AsSUFBSSxDQUFDd1Ysc0JBQXNCLEdBQUcsQ0FBQyxDQUFDO0VBRWhDeFYsSUFBSSxDQUFDeVYsUUFBUSxHQUFHLElBQUl2USxHQUFHLEVBQUUsQ0FBQyxDQUFDOztFQUUzQmxGLElBQUksQ0FBQzBWLGFBQWEsR0FBRyxJQUFJM1YsWUFBWTtFQUVyQ0MsSUFBSSxDQUFDMFYsYUFBYSxDQUFDNVMsUUFBUSxDQUFDLFVBQVVwQixNQUFNLEVBQUU7SUFDNUM7SUFDQUEsTUFBTSxDQUFDc0wsY0FBYyxHQUFHLElBQUk7SUFFNUIsSUFBSU0sU0FBUyxHQUFHLFVBQVVDLE1BQU0sRUFBRUMsZ0JBQWdCLEVBQUU7TUFDbEQsSUFBSXpDLEdBQUcsR0FBRztRQUFDQSxHQUFHLEVBQUUsT0FBTztRQUFFd0MsTUFBTSxFQUFFQTtNQUFNLENBQUM7TUFDeEMsSUFBSUMsZ0JBQWdCLEVBQ2xCekMsR0FBRyxDQUFDeUMsZ0JBQWdCLEdBQUdBLGdCQUFnQjtNQUN6QzlMLE1BQU0sQ0FBQ1EsSUFBSSxDQUFDbUosU0FBUyxDQUFDZ0MsWUFBWSxDQUFDdEMsR0FBRyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVEckosTUFBTSxDQUFDRCxFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVVrVSxPQUFPLEVBQUU7TUFDbkMsSUFBSXZNLE1BQU0sQ0FBQ3dNLGlCQUFpQixFQUFFO1FBQzVCeE0sTUFBTSxDQUFDZ0UsTUFBTSxDQUFDLGNBQWMsRUFBRXVJLE9BQU8sQ0FBQztNQUN4QztNQUNBLElBQUk7UUFDRixJQUFJO1VBQ0YsSUFBSTVLLEdBQUcsR0FBR00sU0FBUyxDQUFDd0ssUUFBUSxDQUFDRixPQUFPLENBQUM7UUFDdkMsQ0FBQyxDQUFDLE9BQU85TSxHQUFHLEVBQUU7VUFDWnlFLFNBQVMsQ0FBQyxhQUFhLENBQUM7VUFDeEI7UUFDRjtRQUNBLElBQUl2QyxHQUFHLEtBQUssSUFBSSxJQUFJLENBQUNBLEdBQUcsQ0FBQ0EsR0FBRyxFQUFFO1VBQzVCdUMsU0FBUyxDQUFDLGFBQWEsRUFBRXZDLEdBQUcsQ0FBQztVQUM3QjtRQUNGO1FBRUEsSUFBSUEsR0FBRyxDQUFDQSxHQUFHLEtBQUssU0FBUyxFQUFFO1VBQ3pCLElBQUlySixNQUFNLENBQUNzTCxjQUFjLEVBQUU7WUFDekJNLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRXZDLEdBQUcsQ0FBQztZQUNuQztVQUNGO1VBQ0F4RyxLQUFLLENBQUMsWUFBWTtZQUNoQnZFLElBQUksQ0FBQzhWLGNBQWMsQ0FBQ3BVLE1BQU0sRUFBRXFKLEdBQUcsQ0FBQztVQUNsQyxDQUFDLENBQUMsQ0FBQ0csR0FBRyxFQUFFO1VBQ1I7UUFDRjtRQUVBLElBQUksQ0FBQ3hKLE1BQU0sQ0FBQ3NMLGNBQWMsRUFBRTtVQUMxQk0sU0FBUyxDQUFDLG9CQUFvQixFQUFFdkMsR0FBRyxDQUFDO1VBQ3BDO1FBQ0Y7UUFDQXJKLE1BQU0sQ0FBQ3NMLGNBQWMsQ0FBQ1MsY0FBYyxDQUFDMUMsR0FBRyxDQUFDO01BQzNDLENBQUMsQ0FBQyxPQUFPa0osQ0FBQyxFQUFFO1FBQ1Y7UUFDQTdLLE1BQU0sQ0FBQ2dFLE1BQU0sQ0FBQyw2Q0FBNkMsRUFBRXJDLEdBQUcsRUFBRWtKLENBQUMsQ0FBQztNQUN0RTtJQUNGLENBQUMsQ0FBQztJQUVGdlMsTUFBTSxDQUFDRCxFQUFFLENBQUMsT0FBTyxFQUFFLFlBQVk7TUFDN0IsSUFBSUMsTUFBTSxDQUFDc0wsY0FBYyxFQUFFO1FBQ3pCekksS0FBSyxDQUFDLFlBQVk7VUFDaEI3QyxNQUFNLENBQUNzTCxjQUFjLENBQUMzQyxLQUFLLEVBQUU7UUFDL0IsQ0FBQyxDQUFDLENBQUNhLEdBQUcsRUFBRTtNQUNWO0lBQ0YsQ0FBQyxDQUFDO0VBQ0osQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVEdkksTUFBTSxDQUFDQyxNQUFNLENBQUN1UyxNQUFNLENBQUN0UyxTQUFTLEVBQUU7RUFFOUI7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRWtULFlBQVksRUFBRSxVQUFVeEwsRUFBRSxFQUFFO0lBQzFCLElBQUl2SyxJQUFJLEdBQUcsSUFBSTtJQUNmLE9BQU9BLElBQUksQ0FBQ3FWLGdCQUFnQixDQUFDdlMsUUFBUSxDQUFDeUgsRUFBRSxDQUFDO0VBQzNDLENBQUM7RUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRXlMLHNCQUFzQixDQUFDalAsY0FBYyxFQUFFa1AsUUFBUSxFQUFFO0lBQy9DLElBQUksQ0FBQ3RULE1BQU0sQ0FBQ0ssTUFBTSxDQUFDd0IscUJBQXFCLENBQUMsQ0FBQzBSLFFBQVEsQ0FBQ0QsUUFBUSxDQUFDLEVBQUU7TUFDNUQsTUFBTSxJQUFJck4sS0FBSyxtQ0FBNEJxTixRQUFRLHVDQUNoQ2xQLGNBQWMsRUFBRztJQUN0QztJQUNBLElBQUksQ0FBQ3lPLHNCQUFzQixDQUFDek8sY0FBYyxDQUFDLEdBQUdrUCxRQUFRO0VBQ3hELENBQUM7RUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRTlKLHNCQUFzQixDQUFDcEYsY0FBYyxFQUFFO0lBQ3JDLE9BQU8sSUFBSSxDQUFDeU8sc0JBQXNCLENBQUN6TyxjQUFjLENBQUMsSUFDN0MsSUFBSSxDQUFDaUMsT0FBTyxDQUFDb00sMEJBQTBCO0VBQzlDLENBQUM7RUFFRDtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFZSxTQUFTLEVBQUUsVUFBVTVMLEVBQUUsRUFBRTtJQUN2QixJQUFJdkssSUFBSSxHQUFHLElBQUk7SUFDZixPQUFPQSxJQUFJLENBQUMrTixhQUFhLENBQUNqTCxRQUFRLENBQUN5SCxFQUFFLENBQUM7RUFDeEMsQ0FBQztFQUVEdUwsY0FBYyxFQUFFLFVBQVVwVSxNQUFNLEVBQUVxSixHQUFHLEVBQUU7SUFDckMsSUFBSS9LLElBQUksR0FBRyxJQUFJOztJQUVmO0lBQ0E7SUFDQSxJQUFJLEVBQUUsT0FBUStLLEdBQUcsQ0FBQ2hDLE9BQVEsS0FBSyxRQUFRLElBQ2pDaEssQ0FBQyxDQUFDMFYsT0FBTyxDQUFDMUosR0FBRyxDQUFDcUwsT0FBTyxDQUFDLElBQ3RCclgsQ0FBQyxDQUFDMlYsR0FBRyxDQUFDM0osR0FBRyxDQUFDcUwsT0FBTyxFQUFFclgsQ0FBQyxDQUFDa1UsUUFBUSxDQUFDLElBQzlCbFUsQ0FBQyxDQUFDc1gsUUFBUSxDQUFDdEwsR0FBRyxDQUFDcUwsT0FBTyxFQUFFckwsR0FBRyxDQUFDaEMsT0FBTyxDQUFDLENBQUMsRUFBRTtNQUMzQ3JILE1BQU0sQ0FBQ1EsSUFBSSxDQUFDbUosU0FBUyxDQUFDZ0MsWUFBWSxDQUFDO1FBQUN0QyxHQUFHLEVBQUUsUUFBUTtRQUN2QmhDLE9BQU8sRUFBRXNDLFNBQVMsQ0FBQ2lMLHNCQUFzQixDQUFDLENBQUM7TUFBQyxDQUFDLENBQUMsQ0FBQztNQUN6RTVVLE1BQU0sQ0FBQzJJLEtBQUssRUFBRTtNQUNkO0lBQ0Y7O0lBRUE7SUFDQTtJQUNBLElBQUl0QixPQUFPLEdBQUd3TixnQkFBZ0IsQ0FBQ3hMLEdBQUcsQ0FBQ3FMLE9BQU8sRUFBRS9LLFNBQVMsQ0FBQ2lMLHNCQUFzQixDQUFDO0lBRTdFLElBQUl2TCxHQUFHLENBQUNoQyxPQUFPLEtBQUtBLE9BQU8sRUFBRTtNQUMzQjtNQUNBO01BQ0E7TUFDQXJILE1BQU0sQ0FBQ1EsSUFBSSxDQUFDbUosU0FBUyxDQUFDZ0MsWUFBWSxDQUFDO1FBQUN0QyxHQUFHLEVBQUUsUUFBUTtRQUFFaEMsT0FBTyxFQUFFQTtNQUFPLENBQUMsQ0FBQyxDQUFDO01BQ3RFckgsTUFBTSxDQUFDMkksS0FBSyxFQUFFO01BQ2Q7SUFDRjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTNJLE1BQU0sQ0FBQ3NMLGNBQWMsR0FBRyxJQUFJbEUsT0FBTyxDQUFDOUksSUFBSSxFQUFFK0ksT0FBTyxFQUFFckgsTUFBTSxFQUFFMUIsSUFBSSxDQUFDZ0osT0FBTyxDQUFDO0lBQ3hFaEosSUFBSSxDQUFDeVYsUUFBUSxDQUFDOU8sR0FBRyxDQUFDakYsTUFBTSxDQUFDc0wsY0FBYyxDQUFDbEYsRUFBRSxFQUFFcEcsTUFBTSxDQUFDc0wsY0FBYyxDQUFDO0lBQ2xFaE4sSUFBSSxDQUFDcVYsZ0JBQWdCLENBQUM1UyxJQUFJLENBQUMsVUFBVUMsUUFBUSxFQUFFO01BQzdDLElBQUloQixNQUFNLENBQUNzTCxjQUFjLEVBQ3ZCdEssUUFBUSxDQUFDaEIsTUFBTSxDQUFDc0wsY0FBYyxDQUFDNUMsZ0JBQWdCLENBQUM7TUFDbEQsT0FBTyxJQUFJO0lBQ2IsQ0FBQyxDQUFDO0VBQ0osQ0FBQztFQUNEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztFQUVFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRW9NLE9BQU8sRUFBRSxVQUFVckksSUFBSSxFQUFFdEIsT0FBTyxFQUFFN0QsT0FBTyxFQUFFO0lBQ3pDLElBQUloSixJQUFJLEdBQUcsSUFBSTtJQUVmLElBQUksQ0FBRWpCLENBQUMsQ0FBQzBYLFFBQVEsQ0FBQ3RJLElBQUksQ0FBQyxFQUFFO01BQ3RCbkYsT0FBTyxHQUFHQSxPQUFPLElBQUksQ0FBQyxDQUFDO01BRXZCLElBQUltRixJQUFJLElBQUlBLElBQUksSUFBSW5PLElBQUksQ0FBQ3NPLGdCQUFnQixFQUFFO1FBQ3pDbEYsTUFBTSxDQUFDZ0UsTUFBTSxDQUFDLG9DQUFvQyxHQUFHZSxJQUFJLEdBQUcsR0FBRyxDQUFDO1FBQ2hFO01BQ0Y7TUFFQSxJQUFJeEMsT0FBTyxDQUFDK0ssV0FBVyxJQUFJLENBQUMxTixPQUFPLENBQUMyTixPQUFPLEVBQUU7UUFDM0M7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQSxJQUFJLENBQUMzVyxJQUFJLENBQUM0Vyx3QkFBd0IsRUFBRTtVQUNsQzVXLElBQUksQ0FBQzRXLHdCQUF3QixHQUFHLElBQUk7VUFDcEN4TixNQUFNLENBQUNnRSxNQUFNLENBQ25CLHVFQUF1RSxHQUN2RSx5RUFBeUUsR0FDekUsdUVBQXVFLEdBQ3ZFLHlDQUF5QyxHQUN6QyxNQUFNLEdBQ04sZ0VBQWdFLEdBQ2hFLE1BQU0sR0FDTixvQ0FBb0MsR0FDcEMsTUFBTSxHQUNOLDhFQUE4RSxHQUM5RSx3REFBd0QsQ0FBQztRQUNyRDtNQUNGO01BRUEsSUFBSWUsSUFBSSxFQUNObk8sSUFBSSxDQUFDc08sZ0JBQWdCLENBQUNILElBQUksQ0FBQyxHQUFHdEIsT0FBTyxDQUFDLEtBQ25DO1FBQ0g3TSxJQUFJLENBQUM0TSwwQkFBMEIsQ0FBQ3BOLElBQUksQ0FBQ3FOLE9BQU8sQ0FBQztRQUM3QztRQUNBO1FBQ0E7UUFDQTdNLElBQUksQ0FBQ3lWLFFBQVEsQ0FBQ3hTLE9BQU8sQ0FBQyxVQUFVK0gsT0FBTyxFQUFFO1VBQ3ZDLElBQUksQ0FBQ0EsT0FBTyxDQUFDbEIsMEJBQTBCLEVBQUU7WUFDdkN2RixLQUFLLENBQUMsWUFBVztjQUNmeUcsT0FBTyxDQUFDOEIsa0JBQWtCLENBQUNELE9BQU8sQ0FBQztZQUNyQyxDQUFDLENBQUMsQ0FBQzNCLEdBQUcsRUFBRTtVQUNWO1FBQ0YsQ0FBQyxDQUFDO01BQ0o7SUFDRixDQUFDLE1BQ0c7TUFDRm5NLENBQUMsQ0FBQzBELElBQUksQ0FBQzBMLElBQUksRUFBRSxVQUFTMUksS0FBSyxFQUFFRCxHQUFHLEVBQUU7UUFDaEN4RixJQUFJLENBQUN3VyxPQUFPLENBQUNoUixHQUFHLEVBQUVDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztNQUM5QixDQUFDLENBQUM7SUFDSjtFQUNGLENBQUM7RUFFRHlILGNBQWMsRUFBRSxVQUFVbEMsT0FBTyxFQUFFO0lBQ2pDLElBQUloTCxJQUFJLEdBQUcsSUFBSTtJQUNmQSxJQUFJLENBQUN5VixRQUFRLENBQUNyUCxNQUFNLENBQUM0RSxPQUFPLENBQUNsRCxFQUFFLENBQUM7RUFDbEMsQ0FBQztFQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0U0SCxPQUFPLEVBQUUsVUFBVUEsT0FBTyxFQUFFO0lBQzFCLElBQUkxUCxJQUFJLEdBQUcsSUFBSTtJQUNmakIsQ0FBQyxDQUFDMEQsSUFBSSxDQUFDaU4sT0FBTyxFQUFFLFVBQVVtSCxJQUFJLEVBQUUxSSxJQUFJLEVBQUU7TUFDcEMsSUFBSSxPQUFPMEksSUFBSSxLQUFLLFVBQVUsRUFDNUIsTUFBTSxJQUFJak8sS0FBSyxDQUFDLFVBQVUsR0FBR3VGLElBQUksR0FBRyxzQkFBc0IsQ0FBQztNQUM3RCxJQUFJbk8sSUFBSSxDQUFDMlAsZUFBZSxDQUFDeEIsSUFBSSxDQUFDLEVBQzVCLE1BQU0sSUFBSXZGLEtBQUssQ0FBQyxrQkFBa0IsR0FBR3VGLElBQUksR0FBRyxzQkFBc0IsQ0FBQztNQUNyRW5PLElBQUksQ0FBQzJQLGVBQWUsQ0FBQ3hCLElBQUksQ0FBQyxHQUFHMEksSUFBSTtJQUNuQyxDQUFDLENBQUM7RUFDSixDQUFDO0VBRUQ1SSxJQUFJLEVBQUUsVUFBVUUsSUFBSSxFQUFXO0lBQUEsa0NBQU4xSyxJQUFJO01BQUpBLElBQUk7SUFBQTtJQUMzQixJQUFJQSxJQUFJLENBQUN3QyxNQUFNLElBQUksT0FBT3hDLElBQUksQ0FBQ0EsSUFBSSxDQUFDd0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLFVBQVUsRUFBRTtNQUM5RDtNQUNBO01BQ0EsSUFBSXZELFFBQVEsR0FBR2UsSUFBSSxDQUFDcVQsR0FBRyxFQUFFO0lBQzNCO0lBRUEsT0FBTyxJQUFJLENBQUM5UyxLQUFLLENBQUNtSyxJQUFJLEVBQUUxSyxJQUFJLEVBQUVmLFFBQVEsQ0FBQztFQUN6QyxDQUFDO0VBRUQ7RUFDQXFVLFNBQVMsRUFBRSxVQUFVNUksSUFBSSxFQUFXO0lBQUEsbUNBQU4xSyxJQUFJO01BQUpBLElBQUk7SUFBQTtJQUNoQyxPQUFPLElBQUksQ0FBQ3VULFVBQVUsQ0FBQzdJLElBQUksRUFBRTFLLElBQUksQ0FBQztFQUNwQyxDQUFDO0VBRURPLEtBQUssRUFBRSxVQUFVbUssSUFBSSxFQUFFMUssSUFBSSxFQUFFdUYsT0FBTyxFQUFFdEcsUUFBUSxFQUFFO0lBQzlDO0lBQ0E7SUFDQSxJQUFJLENBQUVBLFFBQVEsSUFBSSxPQUFPc0csT0FBTyxLQUFLLFVBQVUsRUFBRTtNQUMvQ3RHLFFBQVEsR0FBR3NHLE9BQU87TUFDbEJBLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDZCxDQUFDLE1BQU07TUFDTEEsT0FBTyxHQUFHQSxPQUFPLElBQUksQ0FBQyxDQUFDO0lBQ3pCO0lBRUEsTUFBTWtILE9BQU8sR0FBRyxJQUFJLENBQUM4RyxVQUFVLENBQUM3SSxJQUFJLEVBQUUxSyxJQUFJLEVBQUV1RixPQUFPLENBQUM7O0lBRXBEO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJdEcsUUFBUSxFQUFFO01BQ1p3TixPQUFPLENBQUNhLElBQUksQ0FDVkosTUFBTSxJQUFJak8sUUFBUSxDQUFDcUQsU0FBUyxFQUFFNEssTUFBTSxDQUFDLEVBQ3JDVyxTQUFTLElBQUk1TyxRQUFRLENBQUM0TyxTQUFTLENBQUMsQ0FDakM7SUFDSCxDQUFDLE1BQU07TUFDTCxPQUFPcEIsT0FBTyxDQUFDYyxLQUFLLEVBQUU7SUFDeEI7RUFDRixDQUFDO0VBRUQ7RUFDQWdHLFVBQVUsRUFBRSxVQUFVN0ksSUFBSSxFQUFFMUssSUFBSSxFQUFFdUYsT0FBTyxFQUFFO0lBQ3pDO0lBQ0EsSUFBSTZELE9BQU8sR0FBRyxJQUFJLENBQUM4QyxlQUFlLENBQUN4QixJQUFJLENBQUM7SUFDeEMsSUFBSSxDQUFFdEIsT0FBTyxFQUFFO01BQ2IsT0FBT3NELE9BQU8sQ0FBQ0UsTUFBTSxDQUNuQixJQUFJakgsTUFBTSxDQUFDUixLQUFLLENBQUMsR0FBRyxvQkFBYXVGLElBQUksaUJBQWMsQ0FDcEQ7SUFDSDs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJeEUsTUFBTSxHQUFHLElBQUk7SUFDakIsSUFBSWtHLFNBQVMsR0FBRyxZQUFXO01BQ3pCLE1BQU0sSUFBSWpILEtBQUssQ0FBQyx3REFBd0QsQ0FBQztJQUMzRSxDQUFDO0lBQ0QsSUFBSTVHLFVBQVUsR0FBRyxJQUFJO0lBQ3JCLElBQUlpVix1QkFBdUIsR0FBR3pHLEdBQUcsQ0FBQ0Msd0JBQXdCLENBQUM1SyxHQUFHLEVBQUU7SUFDaEUsSUFBSXFSLDRCQUE0QixHQUFHMUcsR0FBRyxDQUFDd0QsNkJBQTZCLENBQUNuTyxHQUFHLEVBQUU7SUFDMUUsSUFBSXdKLFVBQVUsR0FBRyxJQUFJO0lBQ3JCLElBQUk0SCx1QkFBdUIsRUFBRTtNQUMzQnROLE1BQU0sR0FBR3NOLHVCQUF1QixDQUFDdE4sTUFBTTtNQUN2Q2tHLFNBQVMsR0FBRyxVQUFTbEcsTUFBTSxFQUFFO1FBQzNCc04sdUJBQXVCLENBQUNwSCxTQUFTLENBQUNsRyxNQUFNLENBQUM7TUFDM0MsQ0FBQztNQUNEM0gsVUFBVSxHQUFHaVYsdUJBQXVCLENBQUNqVixVQUFVO01BQy9DcU4sVUFBVSxHQUFHaEUsU0FBUyxDQUFDOEwsV0FBVyxDQUFDRix1QkFBdUIsRUFBRTlJLElBQUksQ0FBQztJQUNuRSxDQUFDLE1BQU0sSUFBSStJLDRCQUE0QixFQUFFO01BQ3ZDdk4sTUFBTSxHQUFHdU4sNEJBQTRCLENBQUN2TixNQUFNO01BQzVDa0csU0FBUyxHQUFHLFVBQVNsRyxNQUFNLEVBQUU7UUFDM0J1Tiw0QkFBNEIsQ0FBQ3BWLFFBQVEsQ0FBQ2dPLFVBQVUsQ0FBQ25HLE1BQU0sQ0FBQztNQUMxRCxDQUFDO01BQ0QzSCxVQUFVLEdBQUdrViw0QkFBNEIsQ0FBQ2xWLFVBQVU7SUFDdEQ7SUFFQSxJQUFJK04sVUFBVSxHQUFHLElBQUkxRSxTQUFTLENBQUMyRSxnQkFBZ0IsQ0FBQztNQUM5Q0MsWUFBWSxFQUFFLEtBQUs7TUFDbkJ0RyxNQUFNO01BQ05rRyxTQUFTO01BQ1Q3TixVQUFVO01BQ1ZxTjtJQUNGLENBQUMsQ0FBQztJQUVGLE9BQU8sSUFBSWMsT0FBTyxDQUFDQyxPQUFPLElBQUlBLE9BQU8sQ0FDbkNJLEdBQUcsQ0FBQ0Msd0JBQXdCLENBQUNVLFNBQVMsQ0FDcENwQixVQUFVLEVBQ1YsTUFBTWMsd0JBQXdCLENBQzVCaEUsT0FBTyxFQUFFa0QsVUFBVSxFQUFFMUosS0FBSyxDQUFDSSxLQUFLLENBQUNoRCxJQUFJLENBQUMsRUFDdEMsb0JBQW9CLEdBQUcwSyxJQUFJLEdBQUcsR0FBRyxDQUNsQyxDQUNGLENBQ0YsQ0FBQyxDQUFDNEMsSUFBSSxDQUFDMUssS0FBSyxDQUFDSSxLQUFLLENBQUM7RUFDdEIsQ0FBQztFQUVEMlEsY0FBYyxFQUFFLFVBQVVDLFNBQVMsRUFBRTtJQUNuQyxJQUFJclgsSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJZ0wsT0FBTyxHQUFHaEwsSUFBSSxDQUFDeVYsUUFBUSxDQUFDNVAsR0FBRyxDQUFDd1IsU0FBUyxDQUFDO0lBQzFDLElBQUlyTSxPQUFPLEVBQ1QsT0FBT0EsT0FBTyxDQUFDZixVQUFVLENBQUMsS0FFMUIsT0FBTyxJQUFJO0VBQ2Y7QUFDRixDQUFDLENBQUM7QUFFRixJQUFJc00sZ0JBQWdCLEdBQUcsVUFBVWUsdUJBQXVCLEVBQ3ZCQyx1QkFBdUIsRUFBRTtFQUN4RCxJQUFJQyxjQUFjLEdBQUd6WSxDQUFDLENBQUM4SCxJQUFJLENBQUN5USx1QkFBdUIsRUFBRSxVQUFVdk8sT0FBTyxFQUFFO0lBQ3RFLE9BQU9oSyxDQUFDLENBQUNzWCxRQUFRLENBQUNrQix1QkFBdUIsRUFBRXhPLE9BQU8sQ0FBQztFQUNyRCxDQUFDLENBQUM7RUFDRixJQUFJLENBQUN5TyxjQUFjLEVBQUU7SUFDbkJBLGNBQWMsR0FBR0QsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO0VBQzdDO0VBQ0EsT0FBT0MsY0FBYztBQUN2QixDQUFDO0FBRURsVCxTQUFTLENBQUNtVCxpQkFBaUIsR0FBR2xCLGdCQUFnQjs7QUFHOUM7QUFDQTtBQUNBLElBQUloRixxQkFBcUIsR0FBRyxVQUFVRCxTQUFTLEVBQUVvRyxPQUFPLEVBQUU7RUFDeEQsSUFBSSxDQUFDcEcsU0FBUyxFQUFFLE9BQU9BLFNBQVM7O0VBRWhDO0VBQ0E7RUFDQTtFQUNBLElBQUlBLFNBQVMsQ0FBQ3FHLFlBQVksRUFBRTtJQUMxQixJQUFJLEVBQUVyRyxTQUFTLFlBQVlsSSxNQUFNLENBQUNSLEtBQUssQ0FBQyxFQUFFO01BQ3hDLE1BQU1nUCxlQUFlLEdBQUd0RyxTQUFTLENBQUN1RyxPQUFPO01BQ3pDdkcsU0FBUyxHQUFHLElBQUlsSSxNQUFNLENBQUNSLEtBQUssQ0FBQzBJLFNBQVMsQ0FBQy9DLEtBQUssRUFBRStDLFNBQVMsQ0FBQy9ELE1BQU0sRUFBRStELFNBQVMsQ0FBQ3dHLE9BQU8sQ0FBQztNQUNsRnhHLFNBQVMsQ0FBQ3VHLE9BQU8sR0FBR0QsZUFBZTtJQUNyQztJQUNBLE9BQU90RyxTQUFTO0VBQ2xCOztFQUVBO0VBQ0E7RUFDQSxJQUFJLENBQUNBLFNBQVMsQ0FBQ3lHLGVBQWUsRUFBRTtJQUM5QjNPLE1BQU0sQ0FBQ2dFLE1BQU0sQ0FBQyxZQUFZLEdBQUdzSyxPQUFPLEVBQUVwRyxTQUFTLENBQUMwRyxLQUFLLENBQUM7SUFDdEQsSUFBSTFHLFNBQVMsQ0FBQzJHLGNBQWMsRUFBRTtNQUM1QjdPLE1BQU0sQ0FBQ2dFLE1BQU0sQ0FBQywwQ0FBMEMsRUFBRWtFLFNBQVMsQ0FBQzJHLGNBQWMsQ0FBQztNQUNuRjdPLE1BQU0sQ0FBQ2dFLE1BQU0sRUFBRTtJQUNqQjtFQUNGOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSWtFLFNBQVMsQ0FBQzJHLGNBQWMsRUFBRTtJQUM1QixJQUFJM0csU0FBUyxDQUFDMkcsY0FBYyxDQUFDTixZQUFZLEVBQ3ZDLE9BQU9yRyxTQUFTLENBQUMyRyxjQUFjO0lBQ2pDN08sTUFBTSxDQUFDZ0UsTUFBTSxDQUFDLFlBQVksR0FBR3NLLE9BQU8sR0FBRyxrQ0FBa0MsR0FDM0QsbURBQW1ELENBQUM7RUFDcEU7RUFFQSxPQUFPLElBQUl0TyxNQUFNLENBQUNSLEtBQUssQ0FBQyxHQUFHLEVBQUUsdUJBQXVCLENBQUM7QUFDdkQsQ0FBQzs7QUFHRDtBQUNBO0FBQ0EsSUFBSWlJLHdCQUF3QixHQUFHLFVBQVVZLENBQUMsRUFBRWlHLE9BQU8sRUFBRWpVLElBQUksRUFBRXlVLFdBQVcsRUFBRTtFQUN0RXpVLElBQUksR0FBR0EsSUFBSSxJQUFJLEVBQUU7RUFDakIsSUFBSWtJLE9BQU8sQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFO0lBQ3BDLE9BQU93TSxLQUFLLENBQUNDLGdDQUFnQyxDQUMzQzNHLENBQUMsRUFBRWlHLE9BQU8sRUFBRWpVLElBQUksRUFBRXlVLFdBQVcsQ0FBQztFQUNsQztFQUNBLE9BQU96RyxDQUFDLENBQUN6TixLQUFLLENBQUMwVCxPQUFPLEVBQUVqVSxJQUFJLENBQUM7QUFDL0IsQ0FBQyxDOzs7Ozs7Ozs7OztBQzkyREQsSUFBSTRVLE1BQU0sR0FBRzVZLEdBQUcsQ0FBQ0MsT0FBTyxDQUFDLGVBQWUsQ0FBQzs7QUFFekM7QUFDQTtBQUNBO0FBQ0E7QUFDQTRFLFNBQVMsQ0FBQ2lMLFdBQVcsR0FBRyxZQUFZO0VBQ2xDLElBQUl2UCxJQUFJLEdBQUcsSUFBSTtFQUVmQSxJQUFJLENBQUNzWSxLQUFLLEdBQUcsS0FBSztFQUNsQnRZLElBQUksQ0FBQ3VZLEtBQUssR0FBRyxLQUFLO0VBQ2xCdlksSUFBSSxDQUFDd1ksT0FBTyxHQUFHLEtBQUs7RUFDcEJ4WSxJQUFJLENBQUN5WSxrQkFBa0IsR0FBRyxDQUFDO0VBQzNCelksSUFBSSxDQUFDMFkscUJBQXFCLEdBQUcsRUFBRTtFQUMvQjFZLElBQUksQ0FBQzJZLG9CQUFvQixHQUFHLEVBQUU7QUFDaEMsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBclUsU0FBUyxDQUFDNE0sa0JBQWtCLEdBQUcsSUFBSTlILE1BQU0sQ0FBQ3dQLG1CQUFtQjtBQUU3RDdaLENBQUMsQ0FBQ3FHLE1BQU0sQ0FBQ2QsU0FBUyxDQUFDaUwsV0FBVyxDQUFDMU0sU0FBUyxFQUFFO0VBQ3hDO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQWdXLFVBQVUsRUFBRSxZQUFZO0lBQ3RCLElBQUk3WSxJQUFJLEdBQUcsSUFBSTtJQUVmLElBQUlBLElBQUksQ0FBQ3dZLE9BQU8sRUFDZCxPQUFPO01BQUVNLFNBQVMsRUFBRSxZQUFZLENBQUM7SUFBRSxDQUFDO0lBRXRDLElBQUk5WSxJQUFJLENBQUN1WSxLQUFLLEVBQ1osTUFBTSxJQUFJM1AsS0FBSyxDQUFDLHVEQUF1RCxDQUFDO0lBRTFFNUksSUFBSSxDQUFDeVksa0JBQWtCLEVBQUU7SUFDekIsSUFBSUssU0FBUyxHQUFHLEtBQUs7SUFDckIsT0FBTztNQUNMQSxTQUFTLEVBQUUsWUFBWTtRQUNyQixJQUFJQSxTQUFTLEVBQ1gsTUFBTSxJQUFJbFEsS0FBSyxDQUFDLDBDQUEwQyxDQUFDO1FBQzdEa1EsU0FBUyxHQUFHLElBQUk7UUFDaEI5WSxJQUFJLENBQUN5WSxrQkFBa0IsRUFBRTtRQUN6QnpZLElBQUksQ0FBQytZLFVBQVUsRUFBRTtNQUNuQjtJQUNGLENBQUM7RUFDSCxDQUFDO0VBRUQ7RUFDQTtFQUNBbkosR0FBRyxFQUFFLFlBQVk7SUFDZixJQUFJNVAsSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJQSxJQUFJLEtBQUtzRSxTQUFTLENBQUM0TSxrQkFBa0IsQ0FBQ3JMLEdBQUcsRUFBRSxFQUM3QyxNQUFNK0MsS0FBSyxDQUFDLDZCQUE2QixDQUFDO0lBQzVDNUksSUFBSSxDQUFDc1ksS0FBSyxHQUFHLElBQUk7SUFDakJ0WSxJQUFJLENBQUMrWSxVQUFVLEVBQUU7RUFDbkIsQ0FBQztFQUVEO0VBQ0E7RUFDQTtFQUNBQyxZQUFZLEVBQUUsVUFBVW5DLElBQUksRUFBRTtJQUM1QixJQUFJN1csSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJQSxJQUFJLENBQUN1WSxLQUFLLEVBQ1osTUFBTSxJQUFJM1AsS0FBSyxDQUFDLDZDQUE2QyxHQUM3QyxnQkFBZ0IsQ0FBQztJQUNuQzVJLElBQUksQ0FBQzBZLHFCQUFxQixDQUFDbFosSUFBSSxDQUFDcVgsSUFBSSxDQUFDO0VBQ3ZDLENBQUM7RUFFRDtFQUNBckgsY0FBYyxFQUFFLFVBQVVxSCxJQUFJLEVBQUU7SUFDOUIsSUFBSTdXLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUEsSUFBSSxDQUFDdVksS0FBSyxFQUNaLE1BQU0sSUFBSTNQLEtBQUssQ0FBQyw2Q0FBNkMsR0FDN0MsZ0JBQWdCLENBQUM7SUFDbkM1SSxJQUFJLENBQUMyWSxvQkFBb0IsQ0FBQ25aLElBQUksQ0FBQ3FYLElBQUksQ0FBQztFQUN0QyxDQUFDO0VBRUQ7RUFDQW9DLFVBQVUsRUFBRSxZQUFZO0lBQ3RCLElBQUlqWixJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlrWixNQUFNLEdBQUcsSUFBSWIsTUFBTTtJQUN2QnJZLElBQUksQ0FBQ3dQLGNBQWMsQ0FBQyxZQUFZO01BQzlCMEosTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQ3BCLENBQUMsQ0FBQztJQUNGbFosSUFBSSxDQUFDNFAsR0FBRyxFQUFFO0lBQ1ZzSixNQUFNLENBQUNDLElBQUksRUFBRTtFQUNmLENBQUM7RUFFREosVUFBVSxFQUFFLFlBQVk7SUFDdEIsSUFBSS9ZLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUEsSUFBSSxDQUFDdVksS0FBSyxFQUNaLE1BQU0sSUFBSTNQLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQztJQUNuRCxJQUFJNUksSUFBSSxDQUFDc1ksS0FBSyxJQUFJLENBQUN0WSxJQUFJLENBQUN5WSxrQkFBa0IsRUFBRTtNQUMxQyxTQUFTVyxjQUFjLENBQUV2QyxJQUFJLEVBQUU7UUFDN0IsSUFBSTtVQUNGQSxJQUFJLENBQUM3VyxJQUFJLENBQUM7UUFDWixDQUFDLENBQUMsT0FBTzZJLEdBQUcsRUFBRTtVQUNaTyxNQUFNLENBQUNnRSxNQUFNLENBQUMsbUNBQW1DLEVBQUV2RSxHQUFHLENBQUM7UUFDekQ7TUFDRjtNQUVBN0ksSUFBSSxDQUFDeVksa0JBQWtCLEVBQUU7TUFDekIsT0FBT3pZLElBQUksQ0FBQzBZLHFCQUFxQixDQUFDelMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUM1QyxJQUFJaUIsU0FBUyxHQUFHbEgsSUFBSSxDQUFDMFkscUJBQXFCO1FBQzFDMVksSUFBSSxDQUFDMFkscUJBQXFCLEdBQUcsRUFBRTtRQUMvQjNaLENBQUMsQ0FBQzBELElBQUksQ0FBQ3lFLFNBQVMsRUFBRWtTLGNBQWMsQ0FBQztNQUNuQztNQUNBcFosSUFBSSxDQUFDeVksa0JBQWtCLEVBQUU7TUFFekIsSUFBSSxDQUFDelksSUFBSSxDQUFDeVksa0JBQWtCLEVBQUU7UUFDNUJ6WSxJQUFJLENBQUN1WSxLQUFLLEdBQUcsSUFBSTtRQUNqQixJQUFJclIsU0FBUyxHQUFHbEgsSUFBSSxDQUFDMlksb0JBQW9CO1FBQ3pDM1ksSUFBSSxDQUFDMlksb0JBQW9CLEdBQUcsRUFBRTtRQUM5QjVaLENBQUMsQ0FBQzBELElBQUksQ0FBQ3lFLFNBQVMsRUFBRWtTLGNBQWMsQ0FBQztNQUNuQztJQUNGO0VBQ0YsQ0FBQztFQUVEO0VBQ0E7RUFDQTNKLE1BQU0sRUFBRSxZQUFZO0lBQ2xCLElBQUl6UCxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUksQ0FBRUEsSUFBSSxDQUFDdVksS0FBSyxFQUNkLE1BQU0sSUFBSTNQLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQztJQUM1RDVJLElBQUksQ0FBQ3dZLE9BQU8sR0FBRyxJQUFJO0VBQ3JCO0FBQ0YsQ0FBQyxDQUFDLEM7Ozs7Ozs7Ozs7O0FDbElGO0FBQ0E7QUFDQTs7QUFFQWxVLFNBQVMsQ0FBQytVLFNBQVMsR0FBRyxVQUFVclEsT0FBTyxFQUFFO0VBQ3ZDLElBQUloSixJQUFJLEdBQUcsSUFBSTtFQUNmZ0osT0FBTyxHQUFHQSxPQUFPLElBQUksQ0FBQyxDQUFDO0VBRXZCaEosSUFBSSxDQUFDc1osTUFBTSxHQUFHLENBQUM7RUFDZjtFQUNBO0VBQ0E7RUFDQXRaLElBQUksQ0FBQ3VaLHFCQUFxQixHQUFHLENBQUMsQ0FBQztFQUMvQnZaLElBQUksQ0FBQ3daLDBCQUEwQixHQUFHLENBQUMsQ0FBQztFQUNwQ3haLElBQUksQ0FBQ3laLFdBQVcsR0FBR3pRLE9BQU8sQ0FBQ3lRLFdBQVcsSUFBSSxVQUFVO0VBQ3BEelosSUFBSSxDQUFDMFosUUFBUSxHQUFHMVEsT0FBTyxDQUFDMFEsUUFBUSxJQUFJLElBQUk7QUFDMUMsQ0FBQztBQUVEM2EsQ0FBQyxDQUFDcUcsTUFBTSxDQUFDZCxTQUFTLENBQUMrVSxTQUFTLENBQUN4VyxTQUFTLEVBQUU7RUFDdEM7RUFDQThXLHFCQUFxQixFQUFFLFVBQVU1TyxHQUFHLEVBQUU7SUFDcEMsSUFBSS9LLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSSxDQUFFakIsQ0FBQyxDQUFDMkgsR0FBRyxDQUFDcUUsR0FBRyxFQUFFLFlBQVksQ0FBQyxFQUFFO01BQzlCLE9BQU8sRUFBRTtJQUNYLENBQUMsTUFBTSxJQUFJLE9BQU9BLEdBQUcsQ0FBQ3NCLFVBQVcsS0FBSyxRQUFRLEVBQUU7TUFDOUMsSUFBSXRCLEdBQUcsQ0FBQ3NCLFVBQVUsS0FBSyxFQUFFLEVBQ3ZCLE1BQU16RCxLQUFLLENBQUMsK0JBQStCLENBQUM7TUFDOUMsT0FBT21DLEdBQUcsQ0FBQ3NCLFVBQVU7SUFDdkIsQ0FBQyxNQUFNO01BQ0wsTUFBTXpELEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQztJQUNuRDtFQUNGLENBQUM7RUFFRDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBZ1IsTUFBTSxFQUFFLFVBQVVDLE9BQU8sRUFBRW5YLFFBQVEsRUFBRTtJQUNuQyxJQUFJMUMsSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJOEgsRUFBRSxHQUFHOUgsSUFBSSxDQUFDc1osTUFBTSxFQUFFO0lBRXRCLElBQUlqTixVQUFVLEdBQUdyTSxJQUFJLENBQUMyWixxQkFBcUIsQ0FBQ0UsT0FBTyxDQUFDO0lBQ3BELElBQUlDLE1BQU0sR0FBRztNQUFDRCxPQUFPLEVBQUV4VCxLQUFLLENBQUNJLEtBQUssQ0FBQ29ULE9BQU8sQ0FBQztNQUFFblgsUUFBUSxFQUFFQTtJQUFRLENBQUM7SUFDaEUsSUFBSSxDQUFFM0QsQ0FBQyxDQUFDMkgsR0FBRyxDQUFDMUcsSUFBSSxDQUFDdVoscUJBQXFCLEVBQUVsTixVQUFVLENBQUMsRUFBRTtNQUNuRHJNLElBQUksQ0FBQ3VaLHFCQUFxQixDQUFDbE4sVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO01BQzNDck0sSUFBSSxDQUFDd1osMEJBQTBCLENBQUNuTixVQUFVLENBQUMsR0FBRyxDQUFDO0lBQ2pEO0lBQ0FyTSxJQUFJLENBQUN1WixxQkFBcUIsQ0FBQ2xOLFVBQVUsQ0FBQyxDQUFDdkUsRUFBRSxDQUFDLEdBQUdnUyxNQUFNO0lBQ25EOVosSUFBSSxDQUFDd1osMEJBQTBCLENBQUNuTixVQUFVLENBQUMsRUFBRTtJQUU3QyxJQUFJck0sSUFBSSxDQUFDMFosUUFBUSxJQUFJL04sT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFO01BQzFDQSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUNDLEtBQUssQ0FBQ0MsbUJBQW1CLENBQzdDN0wsSUFBSSxDQUFDeVosV0FBVyxFQUFFelosSUFBSSxDQUFDMFosUUFBUSxFQUFFLENBQUMsQ0FBQztJQUN2QztJQUVBLE9BQU87TUFDTDNNLElBQUksRUFBRSxZQUFZO1FBQ2hCLElBQUkvTSxJQUFJLENBQUMwWixRQUFRLElBQUkvTixPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUU7VUFDMUNBLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQ0MsS0FBSyxDQUFDQyxtQkFBbUIsQ0FDN0M3TCxJQUFJLENBQUN5WixXQUFXLEVBQUV6WixJQUFJLENBQUMwWixRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEM7UUFDQSxPQUFPMVosSUFBSSxDQUFDdVoscUJBQXFCLENBQUNsTixVQUFVLENBQUMsQ0FBQ3ZFLEVBQUUsQ0FBQztRQUNqRDlILElBQUksQ0FBQ3daLDBCQUEwQixDQUFDbk4sVUFBVSxDQUFDLEVBQUU7UUFDN0MsSUFBSXJNLElBQUksQ0FBQ3daLDBCQUEwQixDQUFDbk4sVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFO1VBQ3JELE9BQU9yTSxJQUFJLENBQUN1WixxQkFBcUIsQ0FBQ2xOLFVBQVUsQ0FBQztVQUM3QyxPQUFPck0sSUFBSSxDQUFDd1osMEJBQTBCLENBQUNuTixVQUFVLENBQUM7UUFDcEQ7TUFDRjtJQUNGLENBQUM7RUFDSCxDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBME4sSUFBSSxFQUFFLFVBQVVDLFlBQVksRUFBRTtJQUM1QixJQUFJaGEsSUFBSSxHQUFHLElBQUk7SUFFZixJQUFJcU0sVUFBVSxHQUFHck0sSUFBSSxDQUFDMloscUJBQXFCLENBQUNLLFlBQVksQ0FBQztJQUV6RCxJQUFJLENBQUVqYixDQUFDLENBQUMySCxHQUFHLENBQUMxRyxJQUFJLENBQUN1WixxQkFBcUIsRUFBRWxOLFVBQVUsQ0FBQyxFQUFFO01BQ25EO0lBQ0Y7SUFFQSxJQUFJNE4sc0JBQXNCLEdBQUdqYSxJQUFJLENBQUN1WixxQkFBcUIsQ0FBQ2xOLFVBQVUsQ0FBQztJQUNuRSxJQUFJNk4sV0FBVyxHQUFHLEVBQUU7SUFDcEJuYixDQUFDLENBQUMwRCxJQUFJLENBQUN3WCxzQkFBc0IsRUFBRSxVQUFVRSxDQUFDLEVBQUVyUyxFQUFFLEVBQUU7TUFDOUMsSUFBSTlILElBQUksQ0FBQ29hLFFBQVEsQ0FBQ0osWUFBWSxFQUFFRyxDQUFDLENBQUNOLE9BQU8sQ0FBQyxFQUFFO1FBQzFDSyxXQUFXLENBQUMxYSxJQUFJLENBQUNzSSxFQUFFLENBQUM7TUFDdEI7SUFDRixDQUFDLENBQUM7O0lBRUY7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EvSSxDQUFDLENBQUMwRCxJQUFJLENBQUN5WCxXQUFXLEVBQUUsVUFBVXBTLEVBQUUsRUFBRTtNQUNoQyxJQUFJL0ksQ0FBQyxDQUFDMkgsR0FBRyxDQUFDdVQsc0JBQXNCLEVBQUVuUyxFQUFFLENBQUMsRUFBRTtRQUNyQ21TLHNCQUFzQixDQUFDblMsRUFBRSxDQUFDLENBQUNwRixRQUFRLENBQUNzWCxZQUFZLENBQUM7TUFDbkQ7SUFDRixDQUFDLENBQUM7RUFDSixDQUFDO0VBRUQ7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBSSxRQUFRLEVBQUUsVUFBVUosWUFBWSxFQUFFSCxPQUFPLEVBQUU7SUFDekM7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksT0FBT0csWUFBWSxDQUFDbFMsRUFBRyxLQUFLLFFBQVEsSUFDcEMsT0FBTytSLE9BQU8sQ0FBQy9SLEVBQUcsS0FBSyxRQUFRLElBQy9Ca1MsWUFBWSxDQUFDbFMsRUFBRSxLQUFLK1IsT0FBTyxDQUFDL1IsRUFBRSxFQUFFO01BQ2xDLE9BQU8sS0FBSztJQUNkO0lBQ0EsSUFBSWtTLFlBQVksQ0FBQ2xTLEVBQUUsWUFBWWdNLE9BQU8sQ0FBQ3VHLFFBQVEsSUFDM0NSLE9BQU8sQ0FBQy9SLEVBQUUsWUFBWWdNLE9BQU8sQ0FBQ3VHLFFBQVEsSUFDdEMsQ0FBRUwsWUFBWSxDQUFDbFMsRUFBRSxDQUFDeEIsTUFBTSxDQUFDdVQsT0FBTyxDQUFDL1IsRUFBRSxDQUFDLEVBQUU7TUFDeEMsT0FBTyxLQUFLO0lBQ2Q7SUFFQSxPQUFPL0ksQ0FBQyxDQUFDMlYsR0FBRyxDQUFDbUYsT0FBTyxFQUFFLFVBQVVTLFlBQVksRUFBRTlVLEdBQUcsRUFBRTtNQUNqRCxPQUFPLENBQUN6RyxDQUFDLENBQUMySCxHQUFHLENBQUNzVCxZQUFZLEVBQUV4VSxHQUFHLENBQUMsSUFDOUJhLEtBQUssQ0FBQ0MsTUFBTSxDQUFDZ1UsWUFBWSxFQUFFTixZQUFZLENBQUN4VSxHQUFHLENBQUMsQ0FBQztJQUNqRCxDQUFDLENBQUM7RUFDSjtBQUNGLENBQUMsQ0FBQzs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FsQixTQUFTLENBQUNpVyxxQkFBcUIsR0FBRyxJQUFJalcsU0FBUyxDQUFDK1UsU0FBUyxDQUFDO0VBQ3hESyxRQUFRLEVBQUU7QUFDWixDQUFDLENBQUMsQzs7Ozs7Ozs7Ozs7QUN0S0YsSUFBSXZhLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDb2IsMEJBQTBCLEVBQUU7RUFDMUMzYSx5QkFBeUIsQ0FBQzJhLDBCQUEwQixHQUNsRHJiLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDb2IsMEJBQTBCO0FBQzFDO0FBRUFwUixNQUFNLENBQUNwSSxNQUFNLEdBQUcsSUFBSW1VLE1BQU07QUFFMUIvTCxNQUFNLENBQUNxUixPQUFPLEdBQUcsVUFBVVQsWUFBWSxFQUFFO0VBQ3ZDMVYsU0FBUyxDQUFDaVcscUJBQXFCLENBQUNSLElBQUksQ0FBQ0MsWUFBWSxDQUFDO0FBQ3BELENBQUM7O0FBRUQ7QUFDQTtBQUNBamIsQ0FBQyxDQUFDMEQsSUFBSSxDQUNKLENBQ0UsU0FBUyxFQUNULFNBQVMsRUFDVCxNQUFNLEVBQ04sV0FBVyxFQUNYLE9BQU8sRUFDUCxZQUFZLEVBQ1osY0FBYyxFQUNkLFdBQVcsQ0FDWixFQUNELFVBQVMwTCxJQUFJLEVBQUU7RUFDYi9FLE1BQU0sQ0FBQytFLElBQUksQ0FBQyxHQUFHcFAsQ0FBQyxDQUFDNEksSUFBSSxDQUFDeUIsTUFBTSxDQUFDcEksTUFBTSxDQUFDbU4sSUFBSSxDQUFDLEVBQUUvRSxNQUFNLENBQUNwSSxNQUFNLENBQUM7QUFDM0QsQ0FBQyxDQUNGLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1zZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBCeSBkZWZhdWx0LCB3ZSB1c2UgdGhlIHBlcm1lc3NhZ2UtZGVmbGF0ZSBleHRlbnNpb24gd2l0aCBkZWZhdWx0XG4vLyBjb25maWd1cmF0aW9uLiBJZiAkU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiBpcyBzZXQsIHRoZW4gaXQgbXVzdCBiZSB2YWxpZFxuLy8gSlNPTi4gSWYgaXQgcmVwcmVzZW50cyBhIGZhbHNleSB2YWx1ZSwgdGhlbiB3ZSBkbyBub3QgdXNlIHBlcm1lc3NhZ2UtZGVmbGF0ZVxuLy8gYXQgYWxsOyBvdGhlcndpc2UsIHRoZSBKU09OIHZhbHVlIGlzIHVzZWQgYXMgYW4gYXJndW1lbnQgdG8gZGVmbGF0ZSdzXG4vLyBjb25maWd1cmUgbWV0aG9kOyBzZWVcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mYXllL3Blcm1lc3NhZ2UtZGVmbGF0ZS1ub2RlL2Jsb2IvbWFzdGVyL1JFQURNRS5tZFxuLy9cbi8vIChXZSBkbyB0aGlzIGluIGFuIF8ub25jZSBpbnN0ZWFkIG9mIGF0IHN0YXJ0dXAsIGJlY2F1c2Ugd2UgZG9uJ3Qgd2FudCB0b1xuLy8gY3Jhc2ggdGhlIHRvb2wgZHVyaW5nIGlzb3BhY2tldCBsb2FkIGlmIHlvdXIgSlNPTiBkb2Vzbid0IHBhcnNlLiBUaGlzIGlzIG9ubHlcbi8vIGEgcHJvYmxlbSBiZWNhdXNlIHRoZSB0b29sIGhhcyB0byBsb2FkIHRoZSBERFAgc2VydmVyIGNvZGUganVzdCBpbiBvcmRlciB0b1xuLy8gYmUgYSBERFAgY2xpZW50OyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzM0NTIgLilcbnZhciB3ZWJzb2NrZXRFeHRlbnNpb25zID0gXy5vbmNlKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGV4dGVuc2lvbnMgPSBbXTtcblxuICB2YXIgd2Vic29ja2V0Q29tcHJlc3Npb25Db25maWcgPSBwcm9jZXNzLmVudi5TRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OXG4gICAgICAgID8gSlNPTi5wYXJzZShwcm9jZXNzLmVudi5TRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OKSA6IHt9O1xuICBpZiAod2Vic29ja2V0Q29tcHJlc3Npb25Db25maWcpIHtcbiAgICBleHRlbnNpb25zLnB1c2goTnBtLnJlcXVpcmUoJ3Blcm1lc3NhZ2UtZGVmbGF0ZScpLmNvbmZpZ3VyZShcbiAgICAgIHdlYnNvY2tldENvbXByZXNzaW9uQ29uZmlnXG4gICAgKSk7XG4gIH1cblxuICByZXR1cm4gZXh0ZW5zaW9ucztcbn0pO1xuXG52YXIgcGF0aFByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfHwgIFwiXCI7XG5cblN0cmVhbVNlcnZlciA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLnJlZ2lzdHJhdGlvbl9jYWxsYmFja3MgPSBbXTtcbiAgc2VsZi5vcGVuX3NvY2tldHMgPSBbXTtcblxuICAvLyBCZWNhdXNlIHdlIGFyZSBpbnN0YWxsaW5nIGRpcmVjdGx5IG9udG8gV2ViQXBwLmh0dHBTZXJ2ZXIgaW5zdGVhZCBvZiB1c2luZ1xuICAvLyBXZWJBcHAuYXBwLCB3ZSBoYXZlIHRvIHByb2Nlc3MgdGhlIHBhdGggcHJlZml4IG91cnNlbHZlcy5cbiAgc2VsZi5wcmVmaXggPSBwYXRoUHJlZml4ICsgJy9zb2NranMnO1xuICBSb3V0ZVBvbGljeS5kZWNsYXJlKHNlbGYucHJlZml4ICsgJy8nLCAnbmV0d29yaycpO1xuXG4gIC8vIHNldCB1cCBzb2NranNcbiAgdmFyIHNvY2tqcyA9IE5wbS5yZXF1aXJlKCdzb2NranMnKTtcbiAgdmFyIHNlcnZlck9wdGlvbnMgPSB7XG4gICAgcHJlZml4OiBzZWxmLnByZWZpeCxcbiAgICBsb2c6IGZ1bmN0aW9uKCkge30sXG4gICAgLy8gdGhpcyBpcyB0aGUgZGVmYXVsdCwgYnV0IHdlIGNvZGUgaXQgZXhwbGljaXRseSBiZWNhdXNlIHdlIGRlcGVuZFxuICAgIC8vIG9uIGl0IGluIHN0cmVhbV9jbGllbnQ6SEVBUlRCRUFUX1RJTUVPVVRcbiAgICBoZWFydGJlYXRfZGVsYXk6IDQ1MDAwLFxuICAgIC8vIFRoZSBkZWZhdWx0IGRpc2Nvbm5lY3RfZGVsYXkgaXMgNSBzZWNvbmRzLCBidXQgaWYgdGhlIHNlcnZlciBlbmRzIHVwIENQVVxuICAgIC8vIGJvdW5kIGZvciB0aGF0IG11Y2ggdGltZSwgU29ja0pTIG1pZ2h0IG5vdCBub3RpY2UgdGhhdCB0aGUgdXNlciBoYXNcbiAgICAvLyByZWNvbm5lY3RlZCBiZWNhdXNlIHRoZSB0aW1lciAob2YgZGlzY29ubmVjdF9kZWxheSBtcykgY2FuIGZpcmUgYmVmb3JlXG4gICAgLy8gU29ja0pTIHByb2Nlc3NlcyB0aGUgbmV3IGNvbm5lY3Rpb24uIEV2ZW50dWFsbHkgd2UnbGwgZml4IHRoaXMgYnkgbm90XG4gICAgLy8gY29tYmluaW5nIENQVS1oZWF2eSBwcm9jZXNzaW5nIHdpdGggU29ja0pTIHRlcm1pbmF0aW9uIChlZyBhIHByb3h5IHdoaWNoXG4gICAgLy8gY29udmVydHMgdG8gVW5peCBzb2NrZXRzKSBidXQgZm9yIG5vdywgcmFpc2UgdGhlIGRlbGF5LlxuICAgIGRpc2Nvbm5lY3RfZGVsYXk6IDYwICogMTAwMCxcbiAgICAvLyBTZXQgdGhlIFVTRV9KU0VTU0lPTklEIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGVuYWJsZSBzZXR0aW5nIHRoZVxuICAgIC8vIEpTRVNTSU9OSUQgY29va2llLiBUaGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB1cCBwcm94aWVzIHdpdGhcbiAgICAvLyBzZXNzaW9uIGFmZmluaXR5LlxuICAgIGpzZXNzaW9uaWQ6ICEhcHJvY2Vzcy5lbnYuVVNFX0pTRVNTSU9OSURcbiAgfTtcblxuICAvLyBJZiB5b3Uga25vdyB5b3VyIHNlcnZlciBlbnZpcm9ubWVudCAoZWcsIHByb3hpZXMpIHdpbGwgcHJldmVudCB3ZWJzb2NrZXRzXG4gIC8vIGZyb20gZXZlciB3b3JraW5nLCBzZXQgJERJU0FCTEVfV0VCU09DS0VUUyBhbmQgU29ja0pTIGNsaWVudHMgKGllLFxuICAvLyBicm93c2Vycykgd2lsbCBub3Qgd2FzdGUgdGltZSBhdHRlbXB0aW5nIHRvIHVzZSB0aGVtLlxuICAvLyAoWW91ciBzZXJ2ZXIgd2lsbCBzdGlsbCBoYXZlIGEgL3dlYnNvY2tldCBlbmRwb2ludC4pXG4gIGlmIChwcm9jZXNzLmVudi5ESVNBQkxFX1dFQlNPQ0tFVFMpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLndlYnNvY2tldCA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHNlcnZlck9wdGlvbnMuZmF5ZV9zZXJ2ZXJfb3B0aW9ucyA9IHtcbiAgICAgIGV4dGVuc2lvbnM6IHdlYnNvY2tldEV4dGVuc2lvbnMoKVxuICAgIH07XG4gIH1cblxuICBzZWxmLnNlcnZlciA9IHNvY2tqcy5jcmVhdGVTZXJ2ZXIoc2VydmVyT3B0aW9ucyk7XG5cbiAgLy8gSW5zdGFsbCB0aGUgc29ja2pzIGhhbmRsZXJzLCBidXQgd2Ugd2FudCB0byBrZWVwIGFyb3VuZCBvdXIgb3duIHBhcnRpY3VsYXJcbiAgLy8gcmVxdWVzdCBoYW5kbGVyIHRoYXQgYWRqdXN0cyBpZGxlIHRpbWVvdXRzIHdoaWxlIHdlIGhhdmUgYW4gb3V0c3RhbmRpbmdcbiAgLy8gcmVxdWVzdC4gIFRoaXMgY29tcGVuc2F0ZXMgZm9yIHRoZSBmYWN0IHRoYXQgc29ja2pzIHJlbW92ZXMgYWxsIGxpc3RlbmVyc1xuICAvLyBmb3IgXCJyZXF1ZXN0XCIgdG8gYWRkIGl0cyBvd24uXG4gIFdlYkFwcC5odHRwU2VydmVyLnJlbW92ZUxpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG4gIHNlbGYuc2VydmVyLmluc3RhbGxIYW5kbGVycyhXZWJBcHAuaHR0cFNlcnZlcik7XG4gIFdlYkFwcC5odHRwU2VydmVyLmFkZExpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gU3VwcG9ydCB0aGUgL3dlYnNvY2tldCBlbmRwb2ludFxuICBzZWxmLl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50KCk7XG5cbiAgc2VsZi5zZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCBmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2pzIHNvbWV0aW1lcyBwYXNzZXMgdXMgbnVsbCBpbnN0ZWFkIG9mIGEgc29ja2V0IG9iamVjdFxuICAgIC8vIHNvIHdlIG5lZWQgdG8gZ3VhcmQgYWdhaW5zdCB0aGF0LiBzZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3NvY2tqcy9zb2NranMtbm9kZS9pc3N1ZXMvMTIxXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDY4XG4gICAgaWYgKCFzb2NrZXQpIHJldHVybjtcblxuICAgIC8vIFdlIHdhbnQgdG8gbWFrZSBzdXJlIHRoYXQgaWYgYSBjbGllbnQgY29ubmVjdHMgdG8gdXMgYW5kIGRvZXMgdGhlIGluaXRpYWxcbiAgICAvLyBXZWJzb2NrZXQgaGFuZHNoYWtlIGJ1dCBuZXZlciBnZXRzIHRvIHRoZSBERFAgaGFuZHNoYWtlLCB0aGF0IHdlXG4gICAgLy8gZXZlbnR1YWxseSBraWxsIHRoZSBzb2NrZXQuICBPbmNlIHRoZSBERFAgaGFuZHNoYWtlIGhhcHBlbnMsIEREUFxuICAgIC8vIGhlYXJ0YmVhdGluZyB3aWxsIHdvcmsuIEFuZCBiZWZvcmUgdGhlIFdlYnNvY2tldCBoYW5kc2hha2UsIHRoZSB0aW1lb3V0c1xuICAgIC8vIHdlIHNldCBhdCB0aGUgc2VydmVyIGxldmVsIGluIHdlYmFwcF9zZXJ2ZXIuanMgd2lsbCB3b3JrLiBCdXRcbiAgICAvLyBmYXllLXdlYnNvY2tldCBjYWxscyBzZXRUaW1lb3V0KDApIG9uIGFueSBzb2NrZXQgaXQgdGFrZXMgb3Zlciwgc28gdGhlcmVcbiAgICAvLyBpcyBhbiBcImluIGJldHdlZW5cIiBzdGF0ZSB3aGVyZSB0aGlzIGRvZXNuJ3QgaGFwcGVuLiAgV2Ugd29yayBhcm91bmQgdGhpc1xuICAgIC8vIGJ5IGV4cGxpY2l0bHkgc2V0dGluZyB0aGUgc29ja2V0IHRpbWVvdXQgdG8gYSByZWxhdGl2ZWx5IGxhcmdlIHRpbWUgaGVyZSxcbiAgICAvLyBhbmQgc2V0dGluZyBpdCBiYWNrIHRvIHplcm8gd2hlbiB3ZSBzZXQgdXAgdGhlIGhlYXJ0YmVhdCBpblxuICAgIC8vIGxpdmVkYXRhX3NlcnZlci5qcy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG4gICAgICBpZiAoKHNvY2tldC5wcm90b2NvbCA9PT0gJ3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgc29ja2V0LnByb3RvY29sID09PSAnd2Vic29ja2V0LXJhdycpXG4gICAgICAgICAgJiYgc29ja2V0Ll9zZXNzaW9uLnJlY3YpIHtcbiAgICAgICAgc29ja2V0Ll9zZXNzaW9uLnJlY3YuY29ubmVjdGlvbi5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgfVxuICAgIH07XG4gICAgc29ja2V0LnNldFdlYnNvY2tldFRpbWVvdXQoNDUgKiAxMDAwKTtcblxuICAgIHNvY2tldC5zZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHNvY2tldC53cml0ZShkYXRhKTtcbiAgICB9O1xuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLm9wZW5fc29ja2V0cyA9IF8ud2l0aG91dChzZWxmLm9wZW5fc29ja2V0cywgc29ja2V0KTtcbiAgICB9KTtcbiAgICBzZWxmLm9wZW5fc29ja2V0cy5wdXNoKHNvY2tldCk7XG5cbiAgICAvLyBvbmx5IHRvIHNlbmQgYSBtZXNzYWdlIGFmdGVyIGNvbm5lY3Rpb24gb24gdGVzdHMsIHVzZWZ1bCBmb3JcbiAgICAvLyBzb2NrZXQtc3RyZWFtLWNsaWVudC9zZXJ2ZXItdGVzdHMuanNcbiAgICBpZiAocHJvY2Vzcy5lbnYuVEVTVF9NRVRBREFUQSAmJiBwcm9jZXNzLmVudi5URVNUX01FVEFEQVRBICE9PSBcInt9XCIpIHtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsgdGVzdE1lc3NhZ2VPbkNvbm5lY3Q6IHRydWUgfSkpO1xuICAgIH1cblxuICAgIC8vIGNhbGwgYWxsIG91ciBjYWxsYmFja3Mgd2hlbiB3ZSBnZXQgYSBuZXcgc29ja2V0LiB0aGV5IHdpbGwgZG8gdGhlXG4gICAgLy8gd29yayBvZiBzZXR0aW5nIHVwIGhhbmRsZXJzIGFuZCBzdWNoIGZvciBzcGVjaWZpYyBtZXNzYWdlcy5cbiAgICBfLmVhY2goc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfSk7XG4gIH0pO1xuXG59O1xuXG5PYmplY3QuYXNzaWduKFN0cmVhbVNlcnZlci5wcm90b3R5cGUsIHtcbiAgLy8gY2FsbCBteSBjYWxsYmFjayB3aGVuIGEgbmV3IHNvY2tldCBjb25uZWN0cy5cbiAgLy8gYWxzbyBjYWxsIGl0IGZvciBhbGwgY3VycmVudCBjb25uZWN0aW9ucy5cbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnJlZ2lzdHJhdGlvbl9jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgXy5lYWNoKHNlbGYuYWxsX3NvY2tldHMoKSwgZnVuY3Rpb24gKHNvY2tldCkge1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBnZXQgYSBsaXN0IG9mIGFsbCBzb2NrZXRzXG4gIGFsbF9zb2NrZXRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBfLnZhbHVlcyhzZWxmLm9wZW5fc29ja2V0cyk7XG4gIH0sXG5cbiAgLy8gUmVkaXJlY3QgL3dlYnNvY2tldCB0byAvc29ja2pzL3dlYnNvY2tldCBpbiBvcmRlciB0byBub3QgZXhwb3NlXG4gIC8vIHNvY2tqcyB0byBjbGllbnRzIHRoYXQgd2FudCB0byB1c2UgcmF3IHdlYnNvY2tldHNcbiAgX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHVzZSBhIGNvbm5lY3QgbWlkZGxld2FyZSBoZXJlIHNpbmNlXG4gICAgLy8gc29ja2pzIGluc3RhbGxzIGl0c2VsZiBwcmlvciB0byBhbGwgZXhpc3RpbmcgbGlzdGVuZXJzXG4gICAgLy8gKG1lYW5pbmcgcHJpb3IgdG8gYW55IGNvbm5lY3QgbWlkZGxld2FyZXMpIHNvIHdlIG5lZWQgdG8gdGFrZVxuICAgIC8vIGFuIGFwcHJvYWNoIHNpbWlsYXIgdG8gb3ZlcnNoYWRvd0xpc3RlbmVycyBpblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NranMvc29ja2pzLW5vZGUvYmxvYi9jZjgyMGM1NWFmNmE5OTUzZTE2NTU4NTU1YTMxZGVjZWE1NTRmNzBlL3NyYy91dGlscy5jb2ZmZWVcbiAgICBbJ3JlcXVlc3QnLCAndXBncmFkZSddLmZvckVhY2goKGV2ZW50KSA9PiB7XG4gICAgICB2YXIgaHR0cFNlcnZlciA9IFdlYkFwcC5odHRwU2VydmVyO1xuICAgICAgdmFyIG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMgPSBodHRwU2VydmVyLmxpc3RlbmVycyhldmVudCkuc2xpY2UoMCk7XG4gICAgICBodHRwU2VydmVyLnJlbW92ZUFsbExpc3RlbmVycyhldmVudCk7XG5cbiAgICAgIC8vIHJlcXVlc3QgYW5kIHVwZ3JhZGUgaGF2ZSBkaWZmZXJlbnQgYXJndW1lbnRzIHBhc3NlZCBidXRcbiAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIHdoaWNoIGlzIGFsd2F5cyByZXF1ZXN0XG4gICAgICB2YXIgbmV3TGlzdGVuZXIgPSBmdW5jdGlvbihyZXF1ZXN0IC8qLCBtb3JlQXJndW1lbnRzICovKSB7XG4gICAgICAgIC8vIFN0b3JlIGFyZ3VtZW50cyBmb3IgdXNlIHdpdGhpbiB0aGUgY2xvc3VyZSBiZWxvd1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICAvLyBUT0RPIHJlcGxhY2Ugd2l0aCB1cmwgcGFja2FnZVxuICAgICAgICB2YXIgdXJsID0gTnBtLnJlcXVpcmUoJ3VybCcpO1xuXG4gICAgICAgIC8vIFJld3JpdGUgL3dlYnNvY2tldCBhbmQgL3dlYnNvY2tldC8gdXJscyB0byAvc29ja2pzL3dlYnNvY2tldCB3aGlsZVxuICAgICAgICAvLyBwcmVzZXJ2aW5nIHF1ZXJ5IHN0cmluZy5cbiAgICAgICAgdmFyIHBhcnNlZFVybCA9IHVybC5wYXJzZShyZXF1ZXN0LnVybCk7XG4gICAgICAgIGlmIChwYXJzZWRVcmwucGF0aG5hbWUgPT09IHBhdGhQcmVmaXggKyAnL3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgIHBhcnNlZFVybC5wYXRobmFtZSA9PT0gcGF0aFByZWZpeCArICcvd2Vic29ja2V0LycpIHtcbiAgICAgICAgICBwYXJzZWRVcmwucGF0aG5hbWUgPSBzZWxmLnByZWZpeCArICcvd2Vic29ja2V0JztcbiAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybC5mb3JtYXQocGFyc2VkVXJsKTtcbiAgICAgICAgfVxuICAgICAgICBfLmVhY2gob2xkSHR0cFNlcnZlckxpc3RlbmVycywgZnVuY3Rpb24ob2xkTGlzdGVuZXIpIHtcbiAgICAgICAgICBvbGRMaXN0ZW5lci5hcHBseShodHRwU2VydmVyLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaHR0cFNlcnZlci5hZGRMaXN0ZW5lcihldmVudCwgbmV3TGlzdGVuZXIpO1xuICAgIH0pO1xuICB9XG59KTtcbiIsIkREUFNlcnZlciA9IHt9O1xuXG52YXIgRmliZXIgPSBOcG0ucmVxdWlyZSgnZmliZXJzJyk7XG5cbi8vIFB1YmxpY2F0aW9uIHN0cmF0ZWdpZXMgZGVmaW5lIGhvdyB3ZSBoYW5kbGUgZGF0YSBmcm9tIHB1Ymxpc2hlZCBjdXJzb3JzIGF0IHRoZSBjb2xsZWN0aW9uIGxldmVsXG4vLyBUaGlzIGFsbG93cyBzb21lb25lIHRvOlxuLy8gLSBDaG9vc2UgYSB0cmFkZS1vZmYgYmV0d2VlbiBjbGllbnQtc2VydmVyIGJhbmR3aWR0aCBhbmQgc2VydmVyIG1lbW9yeSB1c2FnZVxuLy8gLSBJbXBsZW1lbnQgc3BlY2lhbCAobm9uLW1vbmdvKSBjb2xsZWN0aW9ucyBsaWtlIHZvbGF0aWxlIG1lc3NhZ2UgcXVldWVzXG5jb25zdCBwdWJsaWNhdGlvblN0cmF0ZWdpZXMgPSB7XG4gIC8vIFNFUlZFUl9NRVJHRSBpcyB0aGUgZGVmYXVsdCBzdHJhdGVneS5cbiAgLy8gV2hlbiB1c2luZyB0aGlzIHN0cmF0ZWd5LCB0aGUgc2VydmVyIG1haW50YWlucyBhIGNvcHkgb2YgYWxsIGRhdGEgYSBjb25uZWN0aW9uIGlzIHN1YnNjcmliZWQgdG8uXG4gIC8vIFRoaXMgYWxsb3dzIHVzIHRvIG9ubHkgc2VuZCBkZWx0YXMgb3ZlciBtdWx0aXBsZSBwdWJsaWNhdGlvbnMuXG4gIFNFUlZFUl9NRVJHRToge1xuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiB0cnVlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IHRydWUsXG4gIH0sXG4gIC8vIFRoZSBOT19NRVJHRV9OT19ISVNUT1JZIHN0cmF0ZWd5IHJlc3VsdHMgaW4gdGhlIHNlcnZlciBzZW5kaW5nIGFsbCBwdWJsaWNhdGlvbiBkYXRhXG4gIC8vIGRpcmVjdGx5IHRvIHRoZSBjbGllbnQuIEl0IGRvZXMgbm90IHJlbWVtYmVyIHdoYXQgaXQgaGFzIHByZXZpb3VzbHkgc2VudFxuICAvLyB0byBpdCB3aWxsIG5vdCB0cmlnZ2VyIHJlbW92ZWQgbWVzc2FnZXMgd2hlbiBhIHN1YnNjcmlwdGlvbiBpcyBzdG9wcGVkLlxuICAvLyBUaGlzIHNob3VsZCBvbmx5IGJlIGNob3NlbiBmb3Igc3BlY2lhbCB1c2UgY2FzZXMgbGlrZSBzZW5kLWFuZC1mb3JnZXQgcXVldWVzLlxuICBOT19NRVJHRV9OT19ISVNUT1JZOiB7XG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IGZhbHNlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGZhbHNlLFxuICB9LFxuICAvLyBOT19NRVJHRSBpcyBzaW1pbGFyIHRvIE5PX01FUkdFX05PX0hJU1RPUlkgYnV0IHRoZSBzZXJ2ZXIgd2lsbCByZW1lbWJlciB0aGUgSURzIGl0IGhhc1xuICAvLyBzZW50IHRvIHRoZSBjbGllbnQgc28gaXQgY2FuIHJlbW92ZSB0aGVtIHdoZW4gYSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZC5cbiAgLy8gVGhpcyBzdHJhdGVneSBjYW4gYmUgdXNlZCB3aGVuIGEgY29sbGVjdGlvbiBpcyBvbmx5IHVzZWQgaW4gYSBzaW5nbGUgcHVibGljYXRpb24uXG4gIE5PX01FUkdFOiB7XG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IGZhbHNlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IHRydWUsXG4gIH1cbn07XG5cbkREUFNlcnZlci5wdWJsaWNhdGlvblN0cmF0ZWdpZXMgPSBwdWJsaWNhdGlvblN0cmF0ZWdpZXM7XG5cbi8vIFRoaXMgZmlsZSBjb250YWlucyBjbGFzc2VzOlxuLy8gKiBTZXNzaW9uIC0gVGhlIHNlcnZlcidzIGNvbm5lY3Rpb24gdG8gYSBzaW5nbGUgRERQIGNsaWVudFxuLy8gKiBTdWJzY3JpcHRpb24gLSBBIHNpbmdsZSBzdWJzY3JpcHRpb24gZm9yIGEgc2luZ2xlIGNsaWVudFxuLy8gKiBTZXJ2ZXIgLSBBbiBlbnRpcmUgc2VydmVyIHRoYXQgbWF5IHRhbGsgdG8gPiAxIGNsaWVudC4gQSBERFAgZW5kcG9pbnQuXG4vL1xuLy8gU2Vzc2lvbiBhbmQgU3Vic2NyaXB0aW9uIGFyZSBmaWxlIHNjb3BlLiBGb3Igbm93LCB1bnRpbCB3ZSBmcmVlemVcbi8vIHRoZSBpbnRlcmZhY2UsIFNlcnZlciBpcyBwYWNrYWdlIHNjb3BlIChpbiB0aGUgZnV0dXJlIGl0IHNob3VsZCBiZVxuLy8gZXhwb3J0ZWQpLlxuXG4vLyBSZXByZXNlbnRzIGEgc2luZ2xlIGRvY3VtZW50IGluIGEgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3XG52YXIgU2Vzc2lvbkRvY3VtZW50VmlldyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmV4aXN0c0luID0gbmV3IFNldCgpOyAvLyBzZXQgb2Ygc3Vic2NyaXB0aW9uSGFuZGxlXG4gIHNlbGYuZGF0YUJ5S2V5ID0gbmV3IE1hcCgpOyAvLyBrZXktPiBbIHtzdWJzY3JpcHRpb25IYW5kbGUsIHZhbHVlfSBieSBwcmVjZWRlbmNlXVxufTtcblxuRERQU2VydmVyLl9TZXNzaW9uRG9jdW1lbnRWaWV3ID0gU2Vzc2lvbkRvY3VtZW50VmlldztcblxuXG5fLmV4dGVuZChTZXNzaW9uRG9jdW1lbnRWaWV3LnByb3RvdHlwZSwge1xuXG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0ge307XG4gICAgc2VsZi5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgcmV0W2tleV0gPSBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFB1Ymxpc2ggQVBJIGlnbm9yZXMgX2lkIGlmIHByZXNlbnQgaW4gZmllbGRzXG4gICAgaWYgKGtleSA9PT0gXCJfaWRcIilcbiAgICAgIHJldHVybjtcbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcblxuICAgIC8vIEl0J3Mgb2theSB0byBjbGVhciBmaWVsZHMgdGhhdCBkaWRuJ3QgZXhpc3QuIE5vIG5lZWQgdG8gdGhyb3dcbiAgICAvLyBhbiBlcnJvci5cbiAgICBpZiAoIXByZWNlZGVuY2VMaXN0KVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJlbW92ZWRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWNlZGVuY2VMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcHJlY2VkZW5jZSA9IHByZWNlZGVuY2VMaXN0W2ldO1xuICAgICAgaWYgKHByZWNlZGVuY2Uuc3Vic2NyaXB0aW9uSGFuZGxlID09PSBzdWJzY3JpcHRpb25IYW5kbGUpIHtcbiAgICAgICAgLy8gVGhlIHZpZXcncyB2YWx1ZSBjYW4gb25seSBjaGFuZ2UgaWYgdGhpcyBzdWJzY3JpcHRpb24gaXMgdGhlIG9uZSB0aGF0XG4gICAgICAgIC8vIHVzZWQgdG8gaGF2ZSBwcmVjZWRlbmNlLlxuICAgICAgICBpZiAoaSA9PT0gMClcbiAgICAgICAgICByZW1vdmVkVmFsdWUgPSBwcmVjZWRlbmNlLnZhbHVlO1xuICAgICAgICBwcmVjZWRlbmNlTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlY2VkZW5jZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5kZWxldGUoa2V5KTtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAocmVtb3ZlZFZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICFFSlNPTi5lcXVhbHMocmVtb3ZlZFZhbHVlLCBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZSkpIHtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gcHJlY2VkZW5jZUxpc3RbMF0udmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIGNoYW5nZUZpZWxkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZUNvbGxlY3RvciwgaXNBZGQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHVibGlzaCBBUEkgaWdub3JlcyBfaWQgaWYgcHJlc2VudCBpbiBmaWVsZHNcbiAgICBpZiAoa2V5ID09PSBcIl9pZFwiKVxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gRG9uJ3Qgc2hhcmUgc3RhdGUgd2l0aCB0aGUgZGF0YSBwYXNzZWQgaW4gYnkgdGhlIHVzZXIuXG4gICAgdmFsdWUgPSBFSlNPTi5jbG9uZSh2YWx1ZSk7XG5cbiAgICBpZiAoIXNlbGYuZGF0YUJ5S2V5LmhhcyhrZXkpKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5zZXQoa2V5LCBbe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWV9XSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcbiAgICB2YXIgZWx0O1xuICAgIGlmICghaXNBZGQpIHtcbiAgICAgIGVsdCA9IHByZWNlZGVuY2VMaXN0LmZpbmQoZnVuY3Rpb24gKHByZWNlZGVuY2UpIHtcbiAgICAgICAgICByZXR1cm4gcHJlY2VkZW5jZS5zdWJzY3JpcHRpb25IYW5kbGUgPT09IHN1YnNjcmlwdGlvbkhhbmRsZTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChlbHQpIHtcbiAgICAgIGlmIChlbHQgPT09IHByZWNlZGVuY2VMaXN0WzBdICYmICFFSlNPTi5lcXVhbHModmFsdWUsIGVsdC52YWx1ZSkpIHtcbiAgICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgY2hhbmdpbmcgdGhlIHZhbHVlIG9mIHRoaXMgZmllbGQuXG4gICAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBlbHQudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgbmV3bHkgY2FyaW5nIGFib3V0IHRoaXMgZmllbGRcbiAgICAgIHByZWNlZGVuY2VMaXN0LnB1c2goe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZTogdmFsdWV9KTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNsaWVudCdzIHZpZXcgb2YgYSBzaW5nbGUgY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lIE5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gaXQgcmVwcmVzZW50c1xuICogQHBhcmFtIHtPYmplY3QuPFN0cmluZywgRnVuY3Rpb24+fSBzZXNzaW9uQ2FsbGJhY2tzIFRoZSBjYWxsYmFja3MgZm9yIGFkZGVkLCBjaGFuZ2VkLCByZW1vdmVkXG4gKiBAY2xhc3MgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3XG4gKi9cbnZhciBTZXNzaW9uQ29sbGVjdGlvblZpZXcgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlc3Npb25DYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gIHNlbGYuZG9jdW1lbnRzID0gbmV3IE1hcCgpO1xuICBzZWxmLmNhbGxiYWNrcyA9IHNlc3Npb25DYWxsYmFja3M7XG59O1xuXG5ERFBTZXJ2ZXIuX1Nlc3Npb25Db2xsZWN0aW9uVmlldyA9IFNlc3Npb25Db2xsZWN0aW9uVmlldztcblxuXG5PYmplY3QuYXNzaWduKFNlc3Npb25Db2xsZWN0aW9uVmlldy5wcm90b3R5cGUsIHtcblxuICBpc0VtcHR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLmRvY3VtZW50cy5zaXplID09PSAwO1xuICB9LFxuXG4gIGRpZmY6IGZ1bmN0aW9uIChwcmV2aW91cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMocHJldmlvdXMuZG9jdW1lbnRzLCBzZWxmLmRvY3VtZW50cywge1xuICAgICAgYm90aDogXy5iaW5kKHNlbGYuZGlmZkRvY3VtZW50LCBzZWxmKSxcblxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoaWQsIG5vd0RWKSB7XG4gICAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBub3dEVi5nZXRGaWVsZHMoKSk7XG4gICAgICB9LFxuXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGlkLCBwcmV2RFYpIHtcbiAgICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgZGlmZkRvY3VtZW50OiBmdW5jdGlvbiAoaWQsIHByZXZEViwgbm93RFYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGZpZWxkcyA9IHt9O1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmT2JqZWN0cyhwcmV2RFYuZ2V0RmllbGRzKCksIG5vd0RWLmdldEZpZWxkcygpLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoa2V5LCBwcmV2LCBub3cpIHtcbiAgICAgICAgaWYgKCFFSlNPTi5lcXVhbHMocHJldiwgbm93KSlcbiAgICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChrZXksIG5vdykge1xuICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24oa2V5LCBwcmV2KSB7XG4gICAgICAgIGZpZWxkc1trZXldID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgYWRkZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIHZhciBhZGRlZCA9IGZhbHNlO1xuICAgIGlmICghZG9jVmlldykge1xuICAgICAgYWRkZWQgPSB0cnVlO1xuICAgICAgZG9jVmlldyA9IG5ldyBTZXNzaW9uRG9jdW1lbnRWaWV3KCk7XG4gICAgICBzZWxmLmRvY3VtZW50cy5zZXQoaWQsIGRvY1ZpZXcpO1xuICAgIH1cbiAgICBkb2NWaWV3LmV4aXN0c0luLmFkZChzdWJzY3JpcHRpb25IYW5kbGUpO1xuICAgIHZhciBjaGFuZ2VDb2xsZWN0b3IgPSB7fTtcbiAgICBfLmVhY2goZmllbGRzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgZG9jVmlldy5jaGFuZ2VGaWVsZChcbiAgICAgICAgc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLCBjaGFuZ2VDb2xsZWN0b3IsIHRydWUpO1xuICAgIH0pO1xuICAgIGlmIChhZGRlZClcbiAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VDb2xsZWN0b3IpO1xuICAgIGVsc2VcbiAgICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZUNvbGxlY3Rvcik7XG4gIH0sXG5cbiAgY2hhbmdlZDogZnVuY3Rpb24gKHN1YnNjcmlwdGlvbkhhbmRsZSwgaWQsIGNoYW5nZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGNoYW5nZWRSZXN1bHQgPSB7fTtcbiAgICB2YXIgZG9jVmlldyA9IHNlbGYuZG9jdW1lbnRzLmdldChpZCk7XG4gICAgaWYgKCFkb2NWaWV3KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IGZpbmQgZWxlbWVudCB3aXRoIGlkIFwiICsgaWQgKyBcIiB0byBjaGFuZ2VcIik7XG4gICAgXy5lYWNoKGNoYW5nZWQsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZClcbiAgICAgICAgZG9jVmlldy5jbGVhckZpZWxkKHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCBjaGFuZ2VkUmVzdWx0KTtcbiAgICAgIGVsc2VcbiAgICAgICAgZG9jVmlldy5jaGFuZ2VGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgdmFsdWUsIGNoYW5nZWRSZXN1bHQpO1xuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZWRSZXN1bHQpO1xuICB9LFxuXG4gIHJlbW92ZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkb2NWaWV3ID0gc2VsZi5kb2N1bWVudHMuZ2V0KGlkKTtcbiAgICBpZiAoIWRvY1ZpZXcpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoXCJSZW1vdmVkIG5vbmV4aXN0ZW50IGRvY3VtZW50IFwiICsgaWQpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBkb2NWaWV3LmV4aXN0c0luLmRlbGV0ZShzdWJzY3JpcHRpb25IYW5kbGUpO1xuICAgIGlmIChkb2NWaWV3LmV4aXN0c0luLnNpemUgPT09IDApIHtcbiAgICAgIC8vIGl0IGlzIGdvbmUgZnJvbSBldmVyeW9uZVxuICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICBzZWxmLmRvY3VtZW50cy5kZWxldGUoaWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY2hhbmdlZCA9IHt9O1xuICAgICAgLy8gcmVtb3ZlIHRoaXMgc3Vic2NyaXB0aW9uIGZyb20gZXZlcnkgcHJlY2VkZW5jZSBsaXN0XG4gICAgICAvLyBhbmQgcmVjb3JkIHRoZSBjaGFuZ2VzXG4gICAgICBkb2NWaWV3LmRhdGFCeUtleS5mb3JFYWNoKGZ1bmN0aW9uIChwcmVjZWRlbmNlTGlzdCwga2V5KSB7XG4gICAgICAgIGRvY1ZpZXcuY2xlYXJGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlZCk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5jYWxsYmFja3MuY2hhbmdlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlZCk7XG4gICAgfVxuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFNlc3Npb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG52YXIgU2Vzc2lvbiA9IGZ1bmN0aW9uIChzZXJ2ZXIsIHZlcnNpb24sIHNvY2tldCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuaWQgPSBSYW5kb20uaWQoKTtcblxuICBzZWxmLnNlcnZlciA9IHNlcnZlcjtcbiAgc2VsZi52ZXJzaW9uID0gdmVyc2lvbjtcblxuICBzZWxmLmluaXRpYWxpemVkID0gZmFsc2U7XG4gIHNlbGYuc29ja2V0ID0gc29ja2V0O1xuXG4gIC8vIFNldCB0byBudWxsIHdoZW4gdGhlIHNlc3Npb24gaXMgZGVzdHJveWVkLiBNdWx0aXBsZSBwbGFjZXMgYmVsb3dcbiAgLy8gdXNlIHRoaXMgdG8gZGV0ZXJtaW5lIGlmIHRoZSBzZXNzaW9uIGlzIGFsaXZlIG9yIG5vdC5cbiAgc2VsZi5pblF1ZXVlID0gbmV3IE1ldGVvci5fRG91YmxlRW5kZWRRdWV1ZSgpO1xuXG4gIHNlbGYuYmxvY2tlZCA9IGZhbHNlO1xuICBzZWxmLndvcmtlclJ1bm5pbmcgPSBmYWxzZTtcblxuICBzZWxmLmNhY2hlZFVuYmxvY2sgPSBudWxsO1xuXG4gIC8vIFN1YiBvYmplY3RzIGZvciBhY3RpdmUgc3Vic2NyaXB0aW9uc1xuICBzZWxmLl9uYW1lZFN1YnMgPSBuZXcgTWFwKCk7XG4gIHNlbGYuX3VuaXZlcnNhbFN1YnMgPSBbXTtcblxuICBzZWxmLnVzZXJJZCA9IG51bGw7XG5cbiAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG5cbiAgLy8gU2V0IHRoaXMgdG8gZmFsc2UgdG8gbm90IHNlbmQgbWVzc2FnZXMgd2hlbiBjb2xsZWN0aW9uVmlld3MgYXJlXG4gIC8vIG1vZGlmaWVkLiBUaGlzIGlzIGRvbmUgd2hlbiByZXJ1bm5pbmcgc3VicyBpbiBfc2V0VXNlcklkIGFuZCB0aG9zZSBtZXNzYWdlc1xuICAvLyBhcmUgY2FsY3VsYXRlZCB2aWEgYSBkaWZmIGluc3RlYWQuXG4gIHNlbGYuX2lzU2VuZGluZyA9IHRydWU7XG5cbiAgLy8gSWYgdGhpcyBpcyB0cnVlLCBkb24ndCBzdGFydCBhIG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHB1Ymxpc2hlciBvbiB0aGlzXG4gIC8vIHNlc3Npb24uIFRoZSBzZXNzaW9uIHdpbGwgdGFrZSBjYXJlIG9mIHN0YXJ0aW5nIGl0IHdoZW4gYXBwcm9wcmlhdGUuXG4gIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSBmYWxzZTtcblxuICAvLyBXaGVuIHdlIGFyZSByZXJ1bm5pbmcgc3Vic2NyaXB0aW9ucywgYW55IHJlYWR5IG1lc3NhZ2VzXG4gIC8vIHdlIHdhbnQgdG8gYnVmZmVyIHVwIGZvciB3aGVuIHdlIGFyZSBkb25lIHJlcnVubmluZyBzdWJzY3JpcHRpb25zXG4gIHNlbGYuX3BlbmRpbmdSZWFkeSA9IFtdO1xuXG4gIC8vIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiB0aGlzIGNvbm5lY3Rpb24gaXMgY2xvc2VkLlxuICBzZWxmLl9jbG9zZUNhbGxiYWNrcyA9IFtdO1xuXG5cbiAgLy8gWFhYIEhBQ0s6IElmIGEgc29ja2pzIGNvbm5lY3Rpb24sIHNhdmUgb2ZmIHRoZSBVUkwuIFRoaXMgaXNcbiAgLy8gdGVtcG9yYXJ5IGFuZCB3aWxsIGdvIGF3YXkgaW4gdGhlIG5lYXIgZnV0dXJlLlxuICBzZWxmLl9zb2NrZXRVcmwgPSBzb2NrZXQudXJsO1xuXG4gIC8vIEFsbG93IHRlc3RzIHRvIGRpc2FibGUgcmVzcG9uZGluZyB0byBwaW5ncy5cbiAgc2VsZi5fcmVzcG9uZFRvUGluZ3MgPSBvcHRpb25zLnJlc3BvbmRUb1BpbmdzO1xuXG4gIC8vIFRoaXMgb2JqZWN0IGlzIHRoZSBwdWJsaWMgaW50ZXJmYWNlIHRvIHRoZSBzZXNzaW9uLiBJbiB0aGUgcHVibGljXG4gIC8vIEFQSSwgaXQgaXMgY2FsbGVkIHRoZSBgY29ubmVjdGlvbmAgb2JqZWN0LiAgSW50ZXJuYWxseSB3ZSBjYWxsIGl0XG4gIC8vIGEgYGNvbm5lY3Rpb25IYW5kbGVgIHRvIGF2b2lkIGFtYmlndWl0eS5cbiAgc2VsZi5jb25uZWN0aW9uSGFuZGxlID0ge1xuICAgIGlkOiBzZWxmLmlkLFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLmNsb3NlKCk7XG4gICAgfSxcbiAgICBvbkNsb3NlOiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHZhciBjYiA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZm4sIFwiY29ubmVjdGlvbiBvbkNsb3NlIGNhbGxiYWNrXCIpO1xuICAgICAgaWYgKHNlbGYuaW5RdWV1ZSkge1xuICAgICAgICBzZWxmLl9jbG9zZUNhbGxiYWNrcy5wdXNoKGNiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIHdlJ3JlIGFscmVhZHkgY2xvc2VkLCBjYWxsIHRoZSBjYWxsYmFjay5cbiAgICAgICAgTWV0ZW9yLmRlZmVyKGNiKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuX2NsaWVudEFkZHJlc3MoKSxcbiAgICBodHRwSGVhZGVyczogc2VsZi5zb2NrZXQuaGVhZGVyc1xuICB9O1xuXG4gIHNlbGYuc2VuZCh7IG1zZzogJ2Nvbm5lY3RlZCcsIHNlc3Npb246IHNlbGYuaWQgfSk7XG5cbiAgLy8gT24gaW5pdGlhbCBjb25uZWN0LCBzcGluIHVwIGFsbCB0aGUgdW5pdmVyc2FsIHB1Ymxpc2hlcnMuXG4gIEZpYmVyKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuICB9KS5ydW4oKTtcblxuICBpZiAodmVyc2lvbiAhPT0gJ3ByZTEnICYmIG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWwgIT09IDApIHtcbiAgICAvLyBXZSBubyBsb25nZXIgbmVlZCB0aGUgbG93IGxldmVsIHRpbWVvdXQgYmVjYXVzZSB3ZSBoYXZlIGhlYXJ0YmVhdHMuXG4gICAgc29ja2V0LnNldFdlYnNvY2tldFRpbWVvdXQoMCk7XG5cbiAgICBzZWxmLmhlYXJ0YmVhdCA9IG5ldyBERFBDb21tb24uSGVhcnRiZWF0KHtcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiBvcHRpb25zLmhlYXJ0YmVhdEludGVydmFsLFxuICAgICAgaGVhcnRiZWF0VGltZW91dDogb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0LFxuICAgICAgb25UaW1lb3V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuY2xvc2UoKTtcbiAgICAgIH0sXG4gICAgICBzZW5kUGluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnNlbmQoe21zZzogJ3BpbmcnfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2VsZi5oZWFydGJlYXQuc3RhcnQoKTtcbiAgfVxuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcImxpdmVkYXRhXCIsIFwic2Vzc2lvbnNcIiwgMSk7XG59O1xuXG5PYmplY3QuYXNzaWduKFNlc3Npb24ucHJvdG90eXBlLCB7XG5cbiAgc2VuZFJlYWR5OiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc1NlbmRpbmcpXG4gICAgICBzZWxmLnNlbmQoe21zZzogXCJyZWFkeVwiLCBzdWJzOiBzdWJzY3JpcHRpb25JZHN9KTtcbiAgICBlbHNlIHtcbiAgICAgIF8uZWFjaChzdWJzY3JpcHRpb25JZHMsIGZ1bmN0aW9uIChzdWJzY3JpcHRpb25JZCkge1xuICAgICAgICBzZWxmLl9wZW5kaW5nUmVhZHkucHVzaChzdWJzY3JpcHRpb25JZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5faXNTZW5kaW5nIHx8ICF0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldztcbiAgfSxcblxuXG4gIHNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSlcbiAgICAgIHRoaXMuc2VuZCh7bXNnOiBcImFkZGVkXCIsIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzfSk7XG4gIH0sXG5cbiAgc2VuZENoYW5nZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAoXy5pc0VtcHR5KGZpZWxkcykpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAodGhpcy5fY2FuU2VuZChjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgIHRoaXMuc2VuZCh7XG4gICAgICAgIG1zZzogXCJjaGFuZ2VkXCIsXG4gICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBpZCxcbiAgICAgICAgZmllbGRzXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgc2VuZFJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIGlkKSB7XG4gICAgaWYgKHRoaXMuX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpKVxuICAgICAgdGhpcy5zZW5kKHttc2c6IFwicmVtb3ZlZFwiLCBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSwgaWR9KTtcbiAgfSxcblxuICBnZXRTZW5kQ2FsbGJhY2tzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBhZGRlZDogXy5iaW5kKHNlbGYuc2VuZEFkZGVkLCBzZWxmKSxcbiAgICAgIGNoYW5nZWQ6IF8uYmluZChzZWxmLnNlbmRDaGFuZ2VkLCBzZWxmKSxcbiAgICAgIHJlbW92ZWQ6IF8uYmluZChzZWxmLnNlbmRSZW1vdmVkLCBzZWxmKVxuICAgIH07XG4gIH0sXG5cbiAgZ2V0Q29sbGVjdGlvblZpZXc6IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0gc2VsZi5jb2xsZWN0aW9uVmlld3MuZ2V0KGNvbGxlY3Rpb25OYW1lKTtcbiAgICBpZiAoIXJldCkge1xuICAgICAgcmV0ID0gbmV3IFNlc3Npb25Db2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmdldFNlbmRDYWxsYmFja3MoKSk7XG4gICAgICBzZWxmLmNvbGxlY3Rpb25WaWV3cy5zZXQoY29sbGVjdGlvbk5hbWUsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH0sXG5cbiAgYWRkZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldykge1xuICAgICAgY29uc3QgdmlldyA9IHRoaXMuZ2V0Q29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgdmlldy5hZGRlZChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gICAgfVxuICB9LFxuXG4gIHJlbW92ZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcucmVtb3ZlZChzdWJzY3JpcHRpb25IYW5kbGUsIGlkKTtcbiAgICAgIGlmICh2aWV3LmlzRW1wdHkoKSkge1xuICAgICAgICAgdGhpcy5jb2xsZWN0aW9uVmlld3MuZGVsZXRlKGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kUmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgIH1cbiAgfSxcblxuICBjaGFuZ2VkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcuY2hhbmdlZChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbmRDaGFuZ2VkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgICB9XG4gIH0sXG5cbiAgc3RhcnRVbml2ZXJzYWxTdWJzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNvcHkgb2YgdGhlIHNldCBvZiB1bml2ZXJzYWwgaGFuZGxlcnMgYW5kIHN0YXJ0IHRoZW0uIElmXG4gICAgLy8gYWRkaXRpb25hbCB1bml2ZXJzYWwgcHVibGlzaGVycyBzdGFydCB3aGlsZSB3ZSdyZSBydW5uaW5nIHRoZW0gKGR1ZSB0b1xuICAgIC8vIHlpZWxkaW5nKSwgdGhleSB3aWxsIHJ1biBzZXBhcmF0ZWx5IGFzIHBhcnQgb2YgU2VydmVyLnB1Ymxpc2guXG4gICAgdmFyIGhhbmRsZXJzID0gXy5jbG9uZShzZWxmLnNlcnZlci51bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVycyk7XG4gICAgXy5lYWNoKGhhbmRsZXJzLCBmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgc2VsZi5fc3RhcnRTdWJzY3JpcHRpb24oaGFuZGxlcik7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gRGVzdHJveSB0aGlzIHNlc3Npb24gYW5kIHVucmVnaXN0ZXIgaXQgYXQgdGhlIHNlcnZlci5cbiAgY2xvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBEZXN0cm95IHRoaXMgc2Vzc2lvbiwgZXZlbiBpZiBpdCdzIG5vdCByZWdpc3RlcmVkIGF0IHRoZVxuICAgIC8vIHNlcnZlci4gU3RvcCBhbGwgcHJvY2Vzc2luZyBhbmQgdGVhciBldmVyeXRoaW5nIGRvd24uIElmIGEgc29ja2V0XG4gICAgLy8gd2FzIGF0dGFjaGVkLCBjbG9zZSBpdC5cblxuICAgIC8vIEFscmVhZHkgZGVzdHJveWVkLlxuICAgIGlmICghIHNlbGYuaW5RdWV1ZSlcbiAgICAgIHJldHVybjtcblxuICAgIC8vIERyb3AgdGhlIG1lcmdlIGJveCBkYXRhIGltbWVkaWF0ZWx5LlxuICAgIHNlbGYuaW5RdWV1ZSA9IG51bGw7XG4gICAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG5cbiAgICBpZiAoc2VsZi5oZWFydGJlYXQpIHtcbiAgICAgIHNlbGYuaGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgIHNlbGYuaGVhcnRiZWF0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5zb2NrZXQpIHtcbiAgICAgIHNlbGYuc29ja2V0LmNsb3NlKCk7XG4gICAgICBzZWxmLnNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG51bGw7XG4gICAgfVxuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInNlc3Npb25zXCIsIC0xKTtcblxuICAgIE1ldGVvci5kZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBTdG9wIGNhbGxiYWNrcyBjYW4geWllbGQsIHNvIHdlIGRlZmVyIHRoaXMgb24gY2xvc2UuXG4gICAgICAvLyBzdWIuX2lzRGVhY3RpdmF0ZWQoKSBkZXRlY3RzIHRoYXQgd2Ugc2V0IGluUXVldWUgdG8gbnVsbCBhbmRcbiAgICAgIC8vIHRyZWF0cyBpdCBhcyBzZW1pLWRlYWN0aXZhdGVkIChpdCB3aWxsIGlnbm9yZSBpbmNvbWluZyBjYWxsYmFja3MsIGV0YykuXG4gICAgICBzZWxmLl9kZWFjdGl2YXRlQWxsU3Vic2NyaXB0aW9ucygpO1xuXG4gICAgICAvLyBEZWZlciBjYWxsaW5nIHRoZSBjbG9zZSBjYWxsYmFja3MsIHNvIHRoYXQgdGhlIGNhbGxlciBjbG9zaW5nXG4gICAgICAvLyB0aGUgc2Vzc2lvbiBpc24ndCB3YWl0aW5nIGZvciBhbGwgdGhlIGNhbGxiYWNrcyB0byBjb21wbGV0ZS5cbiAgICAgIF8uZWFjaChzZWxmLl9jbG9zZUNhbGxiYWNrcywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIC8vIFVucmVnaXN0ZXIgdGhlIHNlc3Npb24uXG4gICAgc2VsZi5zZXJ2ZXIuX3JlbW92ZVNlc3Npb24oc2VsZik7XG4gIH0sXG5cbiAgLy8gU2VuZCBhIG1lc3NhZ2UgKGRvaW5nIG5vdGhpbmcgaWYgbm8gc29ja2V0IGlzIGNvbm5lY3RlZCByaWdodCBub3cpLlxuICAvLyBJdCBzaG91bGQgYmUgYSBKU09OIG9iamVjdCAoaXQgd2lsbCBiZSBzdHJpbmdpZmllZCkuXG4gIHNlbmQ6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICBpZiAoTWV0ZW9yLl9wcmludFNlbnRERFApXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJTZW50IEREUFwiLCBERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgICAgc2VsZi5zb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgIH1cbiAgfSxcblxuICAvLyBTZW5kIGEgY29ubmVjdGlvbiBlcnJvci5cbiAgc2VuZEVycm9yOiBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICBtc2cub2ZmZW5kaW5nTWVzc2FnZSA9IG9mZmVuZGluZ01lc3NhZ2U7XG4gICAgc2VsZi5zZW5kKG1zZyk7XG4gIH0sXG5cbiAgLy8gUHJvY2VzcyAnbXNnJyBhcyBhbiBpbmNvbWluZyBtZXNzYWdlLiBBcyBhIGd1YXJkIGFnYWluc3RcbiAgLy8gcmFjZSBjb25kaXRpb25zIGR1cmluZyByZWNvbm5lY3Rpb24sIGlnbm9yZSB0aGUgbWVzc2FnZSBpZlxuICAvLyAnc29ja2V0JyBpcyBub3QgdGhlIGN1cnJlbnRseSBjb25uZWN0ZWQgc29ja2V0LlxuICAvL1xuICAvLyBXZSBydW4gdGhlIG1lc3NhZ2VzIGZyb20gdGhlIGNsaWVudCBvbmUgYXQgYSB0aW1lLCBpbiB0aGUgb3JkZXJcbiAgLy8gZ2l2ZW4gYnkgdGhlIGNsaWVudC4gVGhlIG1lc3NhZ2UgaGFuZGxlciBpcyBwYXNzZWQgYW4gaWRlbXBvdGVudFxuICAvLyBmdW5jdGlvbiAndW5ibG9jaycgd2hpY2ggaXQgbWF5IGNhbGwgdG8gYWxsb3cgb3RoZXIgbWVzc2FnZXMgdG9cbiAgLy8gYmVnaW4gcnVubmluZyBpbiBwYXJhbGxlbCBpbiBhbm90aGVyIGZpYmVyIChmb3IgZXhhbXBsZSwgYSBtZXRob2RcbiAgLy8gdGhhdCB3YW50cyB0byB5aWVsZCkuIE90aGVyd2lzZSwgaXQgaXMgYXV0b21hdGljYWxseSB1bmJsb2NrZWRcbiAgLy8gd2hlbiBpdCByZXR1cm5zLlxuICAvL1xuICAvLyBBY3R1YWxseSwgd2UgZG9uJ3QgaGF2ZSB0byAndG90YWxseSBvcmRlcicgdGhlIG1lc3NhZ2VzIGluIHRoaXNcbiAgLy8gd2F5LCBidXQgaXQncyB0aGUgZWFzaWVzdCB0aGluZyB0aGF0J3MgY29ycmVjdC4gKHVuc3ViIG5lZWRzIHRvXG4gIC8vIGJlIG9yZGVyZWQgYWdhaW5zdCBzdWIsIG1ldGhvZHMgbmVlZCB0byBiZSBvcmRlcmVkIGFnYWluc3QgZWFjaFxuICAvLyBvdGhlcikuXG4gIHByb2Nlc3NNZXNzYWdlOiBmdW5jdGlvbiAobXNnX2luKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5pblF1ZXVlKSAvLyB3ZSBoYXZlIGJlZW4gZGVzdHJveWVkLlxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gUmVzcG9uZCB0byBwaW5nIGFuZCBwb25nIG1lc3NhZ2VzIGltbWVkaWF0ZWx5IHdpdGhvdXQgcXVldWluZy5cbiAgICAvLyBJZiB0aGUgbmVnb3RpYXRlZCBERFAgdmVyc2lvbiBpcyBcInByZTFcIiB3aGljaCBkaWRuJ3Qgc3VwcG9ydFxuICAgIC8vIHBpbmdzLCBwcmVzZXJ2ZSB0aGUgXCJwcmUxXCIgYmVoYXZpb3Igb2YgcmVzcG9uZGluZyB3aXRoIGEgXCJiYWRcbiAgICAvLyByZXF1ZXN0XCIgZm9yIHRoZSB1bmtub3duIG1lc3NhZ2VzLlxuICAgIC8vXG4gICAgLy8gRmliZXJzIGFyZSBuZWVkZWQgYmVjYXVzZSBoZWFydGJlYXRzIHVzZSBNZXRlb3Iuc2V0VGltZW91dCwgd2hpY2hcbiAgICAvLyBuZWVkcyBhIEZpYmVyLiBXZSBjb3VsZCBhY3R1YWxseSB1c2UgcmVndWxhciBzZXRUaW1lb3V0IGFuZCBhdm9pZFxuICAgIC8vIHRoZXNlIG5ldyBmaWJlcnMsIGJ1dCBpdCBpcyBlYXNpZXIgdG8ganVzdCBtYWtlIGV2ZXJ5dGhpbmcgdXNlXG4gICAgLy8gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIG5vdCB0aGluayB0b28gaGFyZC5cbiAgICAvL1xuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBjbGllbnQgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBGaWJlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuaGVhcnRiZWF0Lm1lc3NhZ2VSZWNlaXZlZCgpO1xuICAgICAgfSkucnVuKCk7XG4gICAgfVxuXG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwaW5nJykge1xuICAgICAgaWYgKHNlbGYuX3Jlc3BvbmRUb1BpbmdzKVxuICAgICAgICBzZWxmLnNlbmQoe21zZzogXCJwb25nXCIsIGlkOiBtc2dfaW4uaWR9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gU2luY2UgZXZlcnl0aGluZyBpcyBhIHBvbmcsIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG9cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLmluUXVldWUucHVzaChtc2dfaW4pO1xuICAgIGlmIChzZWxmLndvcmtlclJ1bm5pbmcpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi53b3JrZXJSdW5uaW5nID0gdHJ1ZTtcblxuICAgIHZhciBwcm9jZXNzTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtc2cgPSBzZWxmLmluUXVldWUgJiYgc2VsZi5pblF1ZXVlLnNoaWZ0KCk7XG4gICAgICBpZiAoIW1zZykge1xuICAgICAgICBzZWxmLndvcmtlclJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBGaWJlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBibG9ja2VkID0gdHJ1ZTtcblxuICAgICAgICB2YXIgdW5ibG9jayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoIWJsb2NrZWQpXG4gICAgICAgICAgICByZXR1cm47IC8vIGlkZW1wb3RlbnRcbiAgICAgICAgICBibG9ja2VkID0gZmFsc2U7XG4gICAgICAgICAgcHJvY2Vzc05leHQoKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxmLnNlcnZlci5vbk1lc3NhZ2VIb29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2sobXNnLCBzZWxmKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKF8uaGFzKHNlbGYucHJvdG9jb2xfaGFuZGxlcnMsIG1zZy5tc2cpKVxuICAgICAgICAgIHNlbGYucHJvdG9jb2xfaGFuZGxlcnNbbXNnLm1zZ10uY2FsbChzZWxmLCBtc2csIHVuYmxvY2spO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VsZi5zZW5kRXJyb3IoJ0JhZCByZXF1ZXN0JywgbXNnKTtcbiAgICAgICAgdW5ibG9jaygpOyAvLyBpbiBjYXNlIHRoZSBoYW5kbGVyIGRpZG4ndCBhbHJlYWR5IGRvIGl0XG4gICAgICB9KS5ydW4oKTtcbiAgICB9O1xuXG4gICAgcHJvY2Vzc05leHQoKTtcbiAgfSxcblxuICBwcm90b2NvbF9oYW5kbGVyczoge1xuICAgIHN1YjogZnVuY3Rpb24gKG1zZywgdW5ibG9jaykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAvLyBjYWNoZVVuYmxvY2sgdGVtcG9yYXJseSwgc28gd2UgY2FuIGNhcHR1cmUgaXQgbGF0ZXJcbiAgICAgIC8vIHdlIHdpbGwgdXNlIHVuYmxvY2sgaW4gY3VycmVudCBldmVudExvb3AsIHNvIHRoaXMgaXMgc2FmZVxuICAgICAgc2VsZi5jYWNoZWRVbmJsb2NrID0gdW5ibG9jaztcblxuICAgICAgLy8gcmVqZWN0IG1hbGZvcm1lZCBtZXNzYWdlc1xuICAgICAgaWYgKHR5cGVvZiAobXNnLmlkKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgIHR5cGVvZiAobXNnLm5hbWUpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgKCgncGFyYW1zJyBpbiBtc2cpICYmICEobXNnLnBhcmFtcyBpbnN0YW5jZW9mIEFycmF5KSkpIHtcbiAgICAgICAgc2VsZi5zZW5kRXJyb3IoXCJNYWxmb3JtZWQgc3Vic2NyaXB0aW9uXCIsIG1zZyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzZWxmLnNlcnZlci5wdWJsaXNoX2hhbmRsZXJzW21zZy5uYW1lXSkge1xuICAgICAgICBzZWxmLnNlbmQoe1xuICAgICAgICAgIG1zZzogJ25vc3ViJywgaWQ6IG1zZy5pZCxcbiAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDQsIGBTdWJzY3JpcHRpb24gJyR7bXNnLm5hbWV9JyBub3QgZm91bmRgKX0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWxmLl9uYW1lZFN1YnMuaGFzKG1zZy5pZCkpXG4gICAgICAgIC8vIHN1YnMgYXJlIGlkZW1wb3RlbnQsIG9yIHJhdGhlciwgdGhleSBhcmUgaWdub3JlZCBpZiBhIHN1YlxuICAgICAgICAvLyB3aXRoIHRoYXQgaWQgYWxyZWFkeSBleGlzdHMuIHRoaXMgaXMgaW1wb3J0YW50IGR1cmluZ1xuICAgICAgICAvLyByZWNvbm5lY3QuXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gWFhYIEl0J2QgYmUgbXVjaCBiZXR0ZXIgaWYgd2UgaGFkIGdlbmVyaWMgaG9va3Mgd2hlcmUgYW55IHBhY2thZ2UgY2FuXG4gICAgICAvLyBob29rIGludG8gc3Vic2NyaXB0aW9uIGhhbmRsaW5nLCBidXQgaW4gdGhlIG1lYW4gd2hpbGUgd2Ugc3BlY2lhbCBjYXNlXG4gICAgICAvLyBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UuIFRoaXMgaXMgYWxzbyBkb25lIGZvciB3ZWFrIHJlcXVpcmVtZW50cyB0b1xuICAgICAgLy8gYWRkIHRoZSBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UgaW4gY2FzZSB3ZSBkb24ndCBoYXZlIEFjY291bnRzLiBBXG4gICAgICAvLyB1c2VyIHRyeWluZyB0byB1c2UgdGhlIGRkcC1yYXRlLWxpbWl0ZXIgbXVzdCBleHBsaWNpdGx5IHJlcXVpcmUgaXQuXG4gICAgICBpZiAoUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddKSB7XG4gICAgICAgIHZhciBERFBSYXRlTGltaXRlciA9IFBhY2thZ2VbJ2RkcC1yYXRlLWxpbWl0ZXInXS5ERFBSYXRlTGltaXRlcjtcbiAgICAgICAgdmFyIHJhdGVMaW1pdGVySW5wdXQgPSB7XG4gICAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgICBjbGllbnRBZGRyZXNzOiBzZWxmLmNvbm5lY3Rpb25IYW5kbGUuY2xpZW50QWRkcmVzcyxcbiAgICAgICAgICB0eXBlOiBcInN1YnNjcmlwdGlvblwiLFxuICAgICAgICAgIG5hbWU6IG1zZy5uYW1lLFxuICAgICAgICAgIGNvbm5lY3Rpb25JZDogc2VsZi5pZFxuICAgICAgICB9O1xuXG4gICAgICAgIEREUFJhdGVMaW1pdGVyLl9pbmNyZW1lbnQocmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgIHZhciByYXRlTGltaXRSZXN1bHQgPSBERFBSYXRlTGltaXRlci5fY2hlY2socmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgIGlmICghcmF0ZUxpbWl0UmVzdWx0LmFsbG93ZWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmQoe1xuICAgICAgICAgICAgbXNnOiAnbm9zdWInLCBpZDogbXNnLmlkLFxuICAgICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgICd0b28tbWFueS1yZXF1ZXN0cycsXG4gICAgICAgICAgICAgIEREUFJhdGVMaW1pdGVyLmdldEVycm9yTWVzc2FnZShyYXRlTGltaXRSZXN1bHQpLFxuICAgICAgICAgICAgICB7dGltZVRvUmVzZXQ6IHJhdGVMaW1pdFJlc3VsdC50aW1lVG9SZXNldH0pXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBoYW5kbGVyID0gc2VsZi5zZXJ2ZXIucHVibGlzaF9oYW5kbGVyc1ttc2cubmFtZV07XG5cbiAgICAgIHNlbGYuX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIsIG1zZy5pZCwgbXNnLnBhcmFtcywgbXNnLm5hbWUpO1xuXG4gICAgICAvLyBjbGVhbmluZyBjYWNoZWQgdW5ibG9ja1xuICAgICAgc2VsZi5jYWNoZWRVbmJsb2NrID0gbnVsbDtcbiAgICB9LFxuXG4gICAgdW5zdWI6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgc2VsZi5fc3RvcFN1YnNjcmlwdGlvbihtc2cuaWQpO1xuICAgIH0sXG5cbiAgICBtZXRob2Q6IGZ1bmN0aW9uIChtc2csIHVuYmxvY2spIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgLy8gUmVqZWN0IG1hbGZvcm1lZCBtZXNzYWdlcy5cbiAgICAgIC8vIEZvciBub3csIHdlIHNpbGVudGx5IGlnbm9yZSB1bmtub3duIGF0dHJpYnV0ZXMsXG4gICAgICAvLyBmb3IgZm9yd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgICAgIGlmICh0eXBlb2YgKG1zZy5pZCkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICB0eXBlb2YgKG1zZy5tZXRob2QpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgKCgncGFyYW1zJyBpbiBtc2cpICYmICEobXNnLnBhcmFtcyBpbnN0YW5jZW9mIEFycmF5KSkgfHxcbiAgICAgICAgICAoKCdyYW5kb21TZWVkJyBpbiBtc2cpICYmICh0eXBlb2YgbXNnLnJhbmRvbVNlZWQgIT09IFwic3RyaW5nXCIpKSkge1xuICAgICAgICBzZWxmLnNlbmRFcnJvcihcIk1hbGZvcm1lZCBtZXRob2QgaW52b2NhdGlvblwiLCBtc2cpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciByYW5kb21TZWVkID0gbXNnLnJhbmRvbVNlZWQgfHwgbnVsbDtcblxuICAgICAgLy8gU2V0IHVwIHRvIG1hcmsgdGhlIG1ldGhvZCBhcyBzYXRpc2ZpZWQgb25jZSBhbGwgb2JzZXJ2ZXJzXG4gICAgICAvLyAoYW5kIHN1YnNjcmlwdGlvbnMpIGhhdmUgcmVhY3RlZCB0byBhbnkgd3JpdGVzIHRoYXQgd2VyZVxuICAgICAgLy8gZG9uZS5cbiAgICAgIHZhciBmZW5jZSA9IG5ldyBERFBTZXJ2ZXIuX1dyaXRlRmVuY2U7XG4gICAgICBmZW5jZS5vbkFsbENvbW1pdHRlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFJldGlyZSB0aGUgZmVuY2Ugc28gdGhhdCBmdXR1cmUgd3JpdGVzIGFyZSBhbGxvd2VkLlxuICAgICAgICAvLyBUaGlzIG1lYW5zIHRoYXQgY2FsbGJhY2tzIGxpa2UgdGltZXJzIGFyZSBmcmVlIHRvIHVzZVxuICAgICAgICAvLyB0aGUgZmVuY2UsIGFuZCBpZiB0aGV5IGZpcmUgYmVmb3JlIGl0J3MgYXJtZWQgKGZvclxuICAgICAgICAvLyBleGFtcGxlLCBiZWNhdXNlIHRoZSBtZXRob2Qgd2FpdHMgZm9yIHRoZW0pIHRoZWlyXG4gICAgICAgIC8vIHdyaXRlcyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBmZW5jZS5cbiAgICAgICAgZmVuY2UucmV0aXJlKCk7XG4gICAgICAgIHNlbGYuc2VuZCh7XG4gICAgICAgICAgbXNnOiAndXBkYXRlZCcsIG1ldGhvZHM6IFttc2cuaWRdfSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gRmluZCB0aGUgaGFuZGxlclxuICAgICAgdmFyIGhhbmRsZXIgPSBzZWxmLnNlcnZlci5tZXRob2RfaGFuZGxlcnNbbXNnLm1ldGhvZF07XG4gICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICBtc2c6ICdyZXN1bHQnLCBpZDogbXNnLmlkLFxuICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHttc2cubWV0aG9kfScgbm90IGZvdW5kYCl9KTtcbiAgICAgICAgZmVuY2UuYXJtKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHNldFVzZXJJZCA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuICAgICAgICBzZWxmLl9zZXRVc2VySWQodXNlcklkKTtcbiAgICAgIH07XG5cbiAgICAgIHZhciBpbnZvY2F0aW9uID0gbmV3IEREUENvbW1vbi5NZXRob2RJbnZvY2F0aW9uKHtcbiAgICAgICAgaXNTaW11bGF0aW9uOiBmYWxzZSxcbiAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgc2V0VXNlcklkOiBzZXRVc2VySWQsXG4gICAgICAgIHVuYmxvY2s6IHVuYmxvY2ssXG4gICAgICAgIGNvbm5lY3Rpb246IHNlbGYuY29ubmVjdGlvbkhhbmRsZSxcbiAgICAgICAgcmFuZG9tU2VlZDogcmFuZG9tU2VlZFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFhYWCBJdCdkIGJlIGJldHRlciBpZiB3ZSBjb3VsZCBob29rIGludG8gbWV0aG9kIGhhbmRsZXJzIGJldHRlciBidXRcbiAgICAgICAgLy8gZm9yIG5vdywgd2UgbmVlZCB0byBjaGVjayBpZiB0aGUgZGRwLXJhdGUtbGltaXRlciBleGlzdHMgc2luY2Ugd2VcbiAgICAgICAgLy8gaGF2ZSBhIHdlYWsgcmVxdWlyZW1lbnQgZm9yIHRoZSBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UgdG8gYmUgYWRkZWRcbiAgICAgICAgLy8gdG8gb3VyIGFwcGxpY2F0aW9uLlxuICAgICAgICBpZiAoUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddKSB7XG4gICAgICAgICAgdmFyIEREUFJhdGVMaW1pdGVyID0gUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddLkREUFJhdGVMaW1pdGVyO1xuICAgICAgICAgIHZhciByYXRlTGltaXRlcklucHV0ID0ge1xuICAgICAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuY29ubmVjdGlvbkhhbmRsZS5jbGllbnRBZGRyZXNzLFxuICAgICAgICAgICAgdHlwZTogXCJtZXRob2RcIixcbiAgICAgICAgICAgIG5hbWU6IG1zZy5tZXRob2QsXG4gICAgICAgICAgICBjb25uZWN0aW9uSWQ6IHNlbGYuaWRcbiAgICAgICAgICB9O1xuICAgICAgICAgIEREUFJhdGVMaW1pdGVyLl9pbmNyZW1lbnQocmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgICAgdmFyIHJhdGVMaW1pdFJlc3VsdCA9IEREUFJhdGVMaW1pdGVyLl9jaGVjayhyYXRlTGltaXRlcklucHV0KVxuICAgICAgICAgIGlmICghcmF0ZUxpbWl0UmVzdWx0LmFsbG93ZWQpIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICBcInRvby1tYW55LXJlcXVlc3RzXCIsXG4gICAgICAgICAgICAgIEREUFJhdGVMaW1pdGVyLmdldEVycm9yTWVzc2FnZShyYXRlTGltaXRSZXN1bHQpLFxuICAgICAgICAgICAgICB7dGltZVRvUmVzZXQ6IHJhdGVMaW1pdFJlc3VsdC50aW1lVG9SZXNldH1cbiAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0ID0gKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGN1cnJlbnRDb250ZXh0ID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0TmV3Q29udGV4dEFuZEdldEN1cnJlbnQoXG4gICAgICAgICAgICBpbnZvY2F0aW9uXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0T3JUaGVuYWJsZSA9IG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyhcbiAgICAgICAgICAgICAgaGFuZGxlcixcbiAgICAgICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAgICAgbXNnLnBhcmFtcyxcbiAgICAgICAgICAgICAgXCJjYWxsIHRvICdcIiArIG1zZy5tZXRob2QgKyBcIidcIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGNvbnN0IGlzVGhlbmFibGUgPVxuICAgICAgICAgICAgICByZXN1bHRPclRoZW5hYmxlICYmIHR5cGVvZiByZXN1bHRPclRoZW5hYmxlLnRoZW4gPT09ICdmdW5jdGlvbic7XG4gICAgICAgICAgICBpZiAoaXNUaGVuYWJsZSkge1xuICAgICAgICAgICAgICByZXN1bHQgPSBQcm9taXNlLmF3YWl0KHJlc3VsdE9yVGhlbmFibGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0T3JUaGVuYWJsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldChjdXJyZW50Q29udGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJlc29sdmUoRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZS53aXRoVmFsdWUoZmVuY2UsIGdldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0KSk7XG4gICAgICB9KTtcblxuICAgICAgZnVuY3Rpb24gZmluaXNoKCkge1xuICAgICAgICBmZW5jZS5hcm0oKTtcbiAgICAgICAgdW5ibG9jaygpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICBtc2c6IFwicmVzdWx0XCIsXG4gICAgICAgIGlkOiBtc2cuaWRcbiAgICAgIH07XG5cbiAgICAgIHByb21pc2UudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICBmaW5pc2goKTtcbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGF5bG9hZC5yZXN1bHQgPSByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5zZW5kKHBheWxvYWQpO1xuICAgICAgfSwgKGV4Y2VwdGlvbikgPT4ge1xuICAgICAgICBmaW5pc2goKTtcbiAgICAgICAgcGF5bG9hZC5lcnJvciA9IHdyYXBJbnRlcm5hbEV4Y2VwdGlvbihcbiAgICAgICAgICBleGNlcHRpb24sXG4gICAgICAgICAgYHdoaWxlIGludm9raW5nIG1ldGhvZCAnJHttc2cubWV0aG9kfSdgXG4gICAgICAgICk7XG4gICAgICAgIHNlbGYuc2VuZChwYXlsb2FkKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcblxuICBfZWFjaFN1YjogZnVuY3Rpb24gKGYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fbmFtZWRTdWJzLmZvckVhY2goZik7XG4gICAgc2VsZi5fdW5pdmVyc2FsU3Vicy5mb3JFYWNoKGYpO1xuICB9LFxuXG4gIF9kaWZmQ29sbGVjdGlvblZpZXdzOiBmdW5jdGlvbiAoYmVmb3JlQ1ZzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmTWFwcyhiZWZvcmVDVnMsIHNlbGYuY29sbGVjdGlvblZpZXdzLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGxlZnRWYWx1ZSwgcmlnaHRWYWx1ZSkge1xuICAgICAgICByaWdodFZhbHVlLmRpZmYobGVmdFZhbHVlKTtcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgcmlnaHRWYWx1ZSkge1xuICAgICAgICByaWdodFZhbHVlLmRvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2NWaWV3LCBpZCkge1xuICAgICAgICAgIHNlbGYuc2VuZEFkZGVkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZG9jVmlldy5nZXRGaWVsZHMoKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGxlZnRPbmx5OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGxlZnRWYWx1ZSkge1xuICAgICAgICBsZWZ0VmFsdWUuZG9jdW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmRSZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNldHMgdGhlIGN1cnJlbnQgdXNlciBpZCBpbiBhbGwgYXBwcm9wcmlhdGUgY29udGV4dHMgYW5kIHJlcnVuc1xuICAvLyBhbGwgc3Vic2NyaXB0aW9uc1xuICBfc2V0VXNlcklkOiBmdW5jdGlvbih1c2VySWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodXNlcklkICE9PSBudWxsICYmIHR5cGVvZiB1c2VySWQgIT09IFwic3RyaW5nXCIpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzZXRVc2VySWQgbXVzdCBiZSBjYWxsZWQgb24gc3RyaW5nIG9yIG51bGwsIG5vdCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHVzZXJJZCk7XG5cbiAgICAvLyBQcmV2ZW50IG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbnMgZnJvbSBiZWluZyBhZGRlZCB0byBvdXJcbiAgICAvLyBzZXNzaW9uLiBUaGV5IHdpbGwgYmUgZm91bmQgYmVsb3cgd2hlbiB3ZSBjYWxsIHN0YXJ0VW5pdmVyc2FsU3Vicy5cbiAgICAvL1xuICAgIC8vIChXZSBkb24ndCBoYXZlIHRvIHdvcnJ5IGFib3V0IG5hbWVkIHN1YnNjcmlwdGlvbnMsIGJlY2F1c2Ugd2Ugb25seSBhZGRcbiAgICAvLyB0aGVtIHdoZW4gd2UgcHJvY2VzcyBhICdzdWInIG1lc3NhZ2UuIFdlIGFyZSBjdXJyZW50bHkgcHJvY2Vzc2luZyBhXG4gICAgLy8gJ21ldGhvZCcgbWVzc2FnZSwgYW5kIHRoZSBtZXRob2QgZGlkIG5vdCB1bmJsb2NrLCBiZWNhdXNlIGl0IGlzIGlsbGVnYWxcbiAgICAvLyB0byBjYWxsIHNldFVzZXJJZCBhZnRlciB1bmJsb2NrLiBUaHVzIHdlIGNhbm5vdCBiZSBjb25jdXJyZW50bHkgYWRkaW5nIGFcbiAgICAvLyBuZXcgbmFtZWQgc3Vic2NyaXB0aW9uKS5cbiAgICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gdHJ1ZTtcblxuICAgIC8vIFByZXZlbnQgY3VycmVudCBzdWJzIGZyb20gdXBkYXRpbmcgb3VyIGNvbGxlY3Rpb25WaWV3cyBhbmQgY2FsbCB0aGVpclxuICAgIC8vIHN0b3AgY2FsbGJhY2tzLiBUaGlzIG1heSB5aWVsZC5cbiAgICBzZWxmLl9lYWNoU3ViKGZ1bmN0aW9uIChzdWIpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuXG4gICAgLy8gQWxsIHN1YnMgc2hvdWxkIG5vdyBiZSBkZWFjdGl2YXRlZC4gU3RvcCBzZW5kaW5nIG1lc3NhZ2VzIHRvIHRoZSBjbGllbnQsXG4gICAgLy8gc2F2ZSB0aGUgc3RhdGUgb2YgdGhlIHB1Ymxpc2hlZCBjb2xsZWN0aW9ucywgcmVzZXQgdG8gYW4gZW1wdHkgdmlldywgYW5kXG4gICAgLy8gdXBkYXRlIHRoZSB1c2VySWQuXG4gICAgc2VsZi5faXNTZW5kaW5nID0gZmFsc2U7XG4gICAgdmFyIGJlZm9yZUNWcyA9IHNlbGYuY29sbGVjdGlvblZpZXdzO1xuICAgIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuICAgIHNlbGYudXNlcklkID0gdXNlcklkO1xuXG4gICAgLy8gX3NldFVzZXJJZCBpcyBub3JtYWxseSBjYWxsZWQgZnJvbSBhIE1ldGVvciBtZXRob2Qgd2l0aFxuICAgIC8vIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gc2V0LiBCdXQgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiBpcyBub3RcbiAgICAvLyBleHBlY3RlZCB0byBiZSBzZXQgaW5zaWRlIGEgcHVibGlzaCBmdW5jdGlvbiwgc28gd2UgdGVtcG9yYXJ5IHVuc2V0IGl0LlxuICAgIC8vIEluc2lkZSBhIHB1Ymxpc2ggZnVuY3Rpb24gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIGlzIHNldC5cbiAgICBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZSh1bmRlZmluZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFNhdmUgdGhlIG9sZCBuYW1lZCBzdWJzLCBhbmQgcmVzZXQgdG8gaGF2aW5nIG5vIHN1YnNjcmlwdGlvbnMuXG4gICAgICB2YXIgb2xkTmFtZWRTdWJzID0gc2VsZi5fbmFtZWRTdWJzO1xuICAgICAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuICAgICAgc2VsZi5fdW5pdmVyc2FsU3VicyA9IFtdO1xuXG4gICAgICBvbGROYW1lZFN1YnMuZm9yRWFjaChmdW5jdGlvbiAoc3ViLCBzdWJzY3JpcHRpb25JZCkge1xuICAgICAgICB2YXIgbmV3U3ViID0gc3ViLl9yZWNyZWF0ZSgpO1xuICAgICAgICBzZWxmLl9uYW1lZFN1YnMuc2V0KHN1YnNjcmlwdGlvbklkLCBuZXdTdWIpO1xuICAgICAgICAvLyBuYjogaWYgdGhlIGhhbmRsZXIgdGhyb3dzIG9yIGNhbGxzIHRoaXMuZXJyb3IoKSwgaXQgd2lsbCBpbiBmYWN0XG4gICAgICAgIC8vIGltbWVkaWF0ZWx5IHNlbmQgaXRzICdub3N1YicuIFRoaXMgaXMgT0ssIHRob3VnaC5cbiAgICAgICAgbmV3U3ViLl9ydW5IYW5kbGVyKCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gQWxsb3cgbmV3bHktY3JlYXRlZCB1bml2ZXJzYWwgc3VicyB0byBiZSBzdGFydGVkIG9uIG91ciBjb25uZWN0aW9uIGluXG4gICAgICAvLyBwYXJhbGxlbCB3aXRoIHRoZSBvbmVzIHdlJ3JlIHNwaW5uaW5nIHVwIGhlcmUsIGFuZCBzcGluIHVwIHVuaXZlcnNhbFxuICAgICAgLy8gc3Vicy5cbiAgICAgIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSBmYWxzZTtcbiAgICAgIHNlbGYuc3RhcnRVbml2ZXJzYWxTdWJzKCk7XG4gICAgfSk7XG5cbiAgICAvLyBTdGFydCBzZW5kaW5nIG1lc3NhZ2VzIGFnYWluLCBiZWdpbm5pbmcgd2l0aCB0aGUgZGlmZiBmcm9tIHRoZSBwcmV2aW91c1xuICAgIC8vIHN0YXRlIG9mIHRoZSB3b3JsZCB0byB0aGUgY3VycmVudCBzdGF0ZS4gTm8geWllbGRzIGFyZSBhbGxvd2VkIGR1cmluZ1xuICAgIC8vIHRoaXMgZGlmZiwgc28gdGhhdCBvdGhlciBjaGFuZ2VzIGNhbm5vdCBpbnRlcmxlYXZlLlxuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX2lzU2VuZGluZyA9IHRydWU7XG4gICAgICBzZWxmLl9kaWZmQ29sbGVjdGlvblZpZXdzKGJlZm9yZUNWcyk7XG4gICAgICBpZiAoIV8uaXNFbXB0eShzZWxmLl9wZW5kaW5nUmVhZHkpKSB7XG4gICAgICAgIHNlbGYuc2VuZFJlYWR5KHNlbGYuX3BlbmRpbmdSZWFkeSk7XG4gICAgICAgIHNlbGYuX3BlbmRpbmdSZWFkeSA9IFtdO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIF9zdGFydFN1YnNjcmlwdGlvbjogZnVuY3Rpb24gKGhhbmRsZXIsIHN1YklkLCBwYXJhbXMsIG5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgc3ViID0gbmV3IFN1YnNjcmlwdGlvbihcbiAgICAgIHNlbGYsIGhhbmRsZXIsIHN1YklkLCBwYXJhbXMsIG5hbWUpO1xuXG4gICAgbGV0IHVuYmxvY2tIYW5kZXIgPSBzZWxmLmNhY2hlZFVuYmxvY2s7XG4gICAgLy8gX3N0YXJ0U3Vic2NyaXB0aW9uIG1heSBjYWxsIGZyb20gYSBsb3QgcGxhY2VzXG4gICAgLy8gc28gY2FjaGVkVW5ibG9jayBtaWdodCBiZSBudWxsIGluIHNvbWVjYXNlc1xuICAgIC8vIGFzc2lnbiB0aGUgY2FjaGVkVW5ibG9ja1xuICAgIHN1Yi51bmJsb2NrID0gdW5ibG9ja0hhbmRlciB8fCAoKCkgPT4ge30pO1xuXG4gICAgaWYgKHN1YklkKVxuICAgICAgc2VsZi5fbmFtZWRTdWJzLnNldChzdWJJZCwgc3ViKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLl91bml2ZXJzYWxTdWJzLnB1c2goc3ViKTtcblxuICAgIHN1Yi5fcnVuSGFuZGxlcigpO1xuICB9LFxuXG4gIC8vIFRlYXIgZG93biBzcGVjaWZpZWQgc3Vic2NyaXB0aW9uXG4gIF9zdG9wU3Vic2NyaXB0aW9uOiBmdW5jdGlvbiAoc3ViSWQsIGVycm9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHN1Yk5hbWUgPSBudWxsO1xuICAgIGlmIChzdWJJZCkge1xuICAgICAgdmFyIG1heWJlU3ViID0gc2VsZi5fbmFtZWRTdWJzLmdldChzdWJJZCk7XG4gICAgICBpZiAobWF5YmVTdWIpIHtcbiAgICAgICAgc3ViTmFtZSA9IG1heWJlU3ViLl9uYW1lO1xuICAgICAgICBtYXliZVN1Yi5fcmVtb3ZlQWxsRG9jdW1lbnRzKCk7XG4gICAgICAgIG1heWJlU3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgICAgIHNlbGYuX25hbWVkU3Vicy5kZWxldGUoc3ViSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZXNwb25zZSA9IHttc2c6ICdub3N1YicsIGlkOiBzdWJJZH07XG5cbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHJlc3BvbnNlLmVycm9yID0gd3JhcEludGVybmFsRXhjZXB0aW9uKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgc3ViTmFtZSA/IChcImZyb20gc3ViIFwiICsgc3ViTmFtZSArIFwiIGlkIFwiICsgc3ViSWQpXG4gICAgICAgICAgOiAoXCJmcm9tIHN1YiBpZCBcIiArIHN1YklkKSk7XG4gICAgfVxuXG4gICAgc2VsZi5zZW5kKHJlc3BvbnNlKTtcbiAgfSxcblxuICAvLyBUZWFyIGRvd24gYWxsIHN1YnNjcmlwdGlvbnMuIE5vdGUgdGhhdCB0aGlzIGRvZXMgTk9UIHNlbmQgcmVtb3ZlZCBvciBub3N1YlxuICAvLyBtZXNzYWdlcywgc2luY2Ugd2UgYXNzdW1lIHRoZSBjbGllbnQgaXMgZ29uZS5cbiAgX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5fbmFtZWRTdWJzLmZvckVhY2goZnVuY3Rpb24gKHN1YiwgaWQpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuICAgIHNlbGYuX25hbWVkU3VicyA9IG5ldyBNYXAoKTtcblxuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMuZm9yRWFjaChmdW5jdGlvbiAoc3ViKSB7XG4gICAgICBzdWIuX2RlYWN0aXZhdGUoKTtcbiAgICB9KTtcbiAgICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG4gIH0sXG5cbiAgLy8gRGV0ZXJtaW5lIHRoZSByZW1vdGUgY2xpZW50J3MgSVAgYWRkcmVzcywgYmFzZWQgb24gdGhlXG4gIC8vIEhUVFBfRk9SV0FSREVEX0NPVU5UIGVudmlyb25tZW50IHZhcmlhYmxlIHJlcHJlc2VudGluZyBob3cgbWFueVxuICAvLyBwcm94aWVzIHRoZSBzZXJ2ZXIgaXMgYmVoaW5kLlxuICBfY2xpZW50QWRkcmVzczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIEZvciB0aGUgcmVwb3J0ZWQgY2xpZW50IGFkZHJlc3MgZm9yIGEgY29ubmVjdGlvbiB0byBiZSBjb3JyZWN0LFxuICAgIC8vIHRoZSBkZXZlbG9wZXIgbXVzdCBzZXQgdGhlIEhUVFBfRk9SV0FSREVEX0NPVU5UIGVudmlyb25tZW50XG4gICAgLy8gdmFyaWFibGUgdG8gYW4gaW50ZWdlciByZXByZXNlbnRpbmcgdGhlIG51bWJlciBvZiBob3BzIHRoZXlcbiAgICAvLyBleHBlY3QgaW4gdGhlIGB4LWZvcndhcmRlZC1mb3JgIGhlYWRlci4gRS5nLiwgc2V0IHRvIFwiMVwiIGlmIHRoZVxuICAgIC8vIHNlcnZlciBpcyBiZWhpbmQgb25lIHByb3h5LlxuICAgIC8vXG4gICAgLy8gVGhpcyBjb3VsZCBiZSBjb21wdXRlZCBvbmNlIGF0IHN0YXJ0dXAgaW5zdGVhZCBvZiBldmVyeSB0aW1lLlxuICAgIHZhciBodHRwRm9yd2FyZGVkQ291bnQgPSBwYXJzZUludChwcm9jZXNzLmVudlsnSFRUUF9GT1JXQVJERURfQ09VTlQnXSkgfHwgMDtcblxuICAgIGlmIChodHRwRm9yd2FyZGVkQ291bnQgPT09IDApXG4gICAgICByZXR1cm4gc2VsZi5zb2NrZXQucmVtb3RlQWRkcmVzcztcblxuICAgIHZhciBmb3J3YXJkZWRGb3IgPSBzZWxmLnNvY2tldC5oZWFkZXJzW1wieC1mb3J3YXJkZWQtZm9yXCJdO1xuICAgIGlmICghIF8uaXNTdHJpbmcoZm9yd2FyZGVkRm9yKSlcbiAgICAgIHJldHVybiBudWxsO1xuICAgIGZvcndhcmRlZEZvciA9IGZvcndhcmRlZEZvci50cmltKCkuc3BsaXQoL1xccyosXFxzKi8pO1xuXG4gICAgLy8gVHlwaWNhbGx5IHRoZSBmaXJzdCB2YWx1ZSBpbiB0aGUgYHgtZm9yd2FyZGVkLWZvcmAgaGVhZGVyIGlzXG4gICAgLy8gdGhlIG9yaWdpbmFsIElQIGFkZHJlc3Mgb2YgdGhlIGNsaWVudCBjb25uZWN0aW5nIHRvIHRoZSBmaXJzdFxuICAgIC8vIHByb3h5LiAgSG93ZXZlciwgdGhlIGVuZCB1c2VyIGNhbiBlYXNpbHkgc3Bvb2YgdGhlIGhlYWRlciwgaW5cbiAgICAvLyB3aGljaCBjYXNlIHRoZSBmaXJzdCB2YWx1ZShzKSB3aWxsIGJlIHRoZSBmYWtlIElQIGFkZHJlc3MgZnJvbVxuICAgIC8vIHRoZSB1c2VyIHByZXRlbmRpbmcgdG8gYmUgYSBwcm94eSByZXBvcnRpbmcgdGhlIG9yaWdpbmFsIElQXG4gICAgLy8gYWRkcmVzcyB2YWx1ZS4gIEJ5IGNvdW50aW5nIEhUVFBfRk9SV0FSREVEX0NPVU5UIGJhY2sgZnJvbSB0aGVcbiAgICAvLyBlbmQgb2YgdGhlIGxpc3QsIHdlIGVuc3VyZSB0aGF0IHdlIGdldCB0aGUgSVAgYWRkcmVzcyBiZWluZ1xuICAgIC8vIHJlcG9ydGVkIGJ5ICpvdXIqIGZpcnN0IHByb3h5LlxuXG4gICAgaWYgKGh0dHBGb3J3YXJkZWRDb3VudCA8IDAgfHwgaHR0cEZvcndhcmRlZENvdW50ID4gZm9yd2FyZGVkRm9yLmxlbmd0aClcbiAgICAgIHJldHVybiBudWxsO1xuXG4gICAgcmV0dXJuIGZvcndhcmRlZEZvcltmb3J3YXJkZWRGb3IubGVuZ3RoIC0gaHR0cEZvcndhcmRlZENvdW50XTtcbiAgfVxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKiBTdWJzY3JpcHRpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gQ3RvciBmb3IgYSBzdWIgaGFuZGxlOiB0aGUgaW5wdXQgdG8gZWFjaCBwdWJsaXNoIGZ1bmN0aW9uXG5cbi8vIEluc3RhbmNlIG5hbWUgaXMgdGhpcyBiZWNhdXNlIGl0J3MgdXN1YWxseSByZWZlcnJlZCB0byBhcyB0aGlzIGluc2lkZSBhXG4vLyBwdWJsaXNoXG4vKipcbiAqIEBzdW1tYXJ5IFRoZSBzZXJ2ZXIncyBzaWRlIG9mIGEgc3Vic2NyaXB0aW9uXG4gKiBAY2xhc3MgU3Vic2NyaXB0aW9uXG4gKiBAaW5zdGFuY2VOYW1lIHRoaXNcbiAqIEBzaG93SW5zdGFuY2VOYW1lIHRydWVcbiAqL1xudmFyIFN1YnNjcmlwdGlvbiA9IGZ1bmN0aW9uIChcbiAgICBzZXNzaW9uLCBoYW5kbGVyLCBzdWJzY3JpcHRpb25JZCwgcGFyYW1zLCBuYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fc2Vzc2lvbiA9IHNlc3Npb247IC8vIHR5cGUgaXMgU2Vzc2lvblxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBY2Nlc3MgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiBUaGUgaW5jb21pbmcgW2Nvbm5lY3Rpb25dKCNtZXRlb3Jfb25jb25uZWN0aW9uKSBmb3IgdGhpcyBzdWJzY3JpcHRpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG5hbWUgIGNvbm5lY3Rpb25cbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHNlbGYuY29ubmVjdGlvbiA9IHNlc3Npb24uY29ubmVjdGlvbkhhbmRsZTsgLy8gcHVibGljIEFQSSBvYmplY3RcblxuICBzZWxmLl9oYW5kbGVyID0gaGFuZGxlcjtcblxuICAvLyBNeSBzdWJzY3JpcHRpb24gSUQgKGdlbmVyYXRlZCBieSBjbGllbnQsIHVuZGVmaW5lZCBmb3IgdW5pdmVyc2FsIHN1YnMpLlxuICBzZWxmLl9zdWJzY3JpcHRpb25JZCA9IHN1YnNjcmlwdGlvbklkO1xuICAvLyBVbmRlZmluZWQgZm9yIHVuaXZlcnNhbCBzdWJzXG4gIHNlbGYuX25hbWUgPSBuYW1lO1xuXG4gIHNlbGYuX3BhcmFtcyA9IHBhcmFtcyB8fCBbXTtcblxuICAvLyBPbmx5IG5hbWVkIHN1YnNjcmlwdGlvbnMgaGF2ZSBJRHMsIGJ1dCB3ZSBuZWVkIHNvbWUgc29ydCBvZiBzdHJpbmdcbiAgLy8gaW50ZXJuYWxseSB0byBrZWVwIHRyYWNrIG9mIGFsbCBzdWJzY3JpcHRpb25zIGluc2lkZVxuICAvLyBTZXNzaW9uRG9jdW1lbnRWaWV3cy4gV2UgdXNlIHRoaXMgc3Vic2NyaXB0aW9uSGFuZGxlIGZvciB0aGF0LlxuICBpZiAoc2VsZi5fc3Vic2NyaXB0aW9uSWQpIHtcbiAgICBzZWxmLl9zdWJzY3JpcHRpb25IYW5kbGUgPSAnTicgKyBzZWxmLl9zdWJzY3JpcHRpb25JZDtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl9zdWJzY3JpcHRpb25IYW5kbGUgPSAnVScgKyBSYW5kb20uaWQoKTtcbiAgfVxuXG4gIC8vIEhhcyBfZGVhY3RpdmF0ZSBiZWVuIGNhbGxlZD9cbiAgc2VsZi5fZGVhY3RpdmF0ZWQgPSBmYWxzZTtcblxuICAvLyBTdG9wIGNhbGxiYWNrcyB0byBnL2MgdGhpcyBzdWIuICBjYWxsZWQgdy8gemVybyBhcmd1bWVudHMuXG4gIHNlbGYuX3N0b3BDYWxsYmFja3MgPSBbXTtcblxuICAvLyBUaGUgc2V0IG9mIChjb2xsZWN0aW9uLCBkb2N1bWVudGlkKSB0aGF0IHRoaXMgc3Vic2NyaXB0aW9uIGhhc1xuICAvLyBhbiBvcGluaW9uIGFib3V0LlxuICBzZWxmLl9kb2N1bWVudHMgPSBuZXcgTWFwKCk7XG5cbiAgLy8gUmVtZW1iZXIgaWYgd2UgYXJlIHJlYWR5LlxuICBzZWxmLl9yZWFkeSA9IGZhbHNlO1xuXG4gIC8vIFBhcnQgb2YgdGhlIHB1YmxpYyBBUEk6IHRoZSB1c2VyIG9mIHRoaXMgc3ViLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBY2Nlc3MgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiBUaGUgaWQgb2YgdGhlIGxvZ2dlZC1pbiB1c2VyLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAbmFtZSAgdXNlcklkXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgc2VsZi51c2VySWQgPSBzZXNzaW9uLnVzZXJJZDtcblxuICAvLyBGb3Igbm93LCB0aGUgaWQgZmlsdGVyIGlzIGdvaW5nIHRvIGRlZmF1bHQgdG9cbiAgLy8gdGhlIHRvL2Zyb20gRERQIG1ldGhvZHMgb24gTW9uZ29JRCwgdG9cbiAgLy8gc3BlY2lmaWNhbGx5IGRlYWwgd2l0aCBtb25nby9taW5pbW9uZ28gT2JqZWN0SWRzLlxuXG4gIC8vIExhdGVyLCB5b3Ugd2lsbCBiZSBhYmxlIHRvIG1ha2UgdGhpcyBiZSBcInJhd1wiXG4gIC8vIGlmIHlvdSB3YW50IHRvIHB1Ymxpc2ggYSBjb2xsZWN0aW9uIHRoYXQgeW91IGtub3dcbiAgLy8ganVzdCBoYXMgc3RyaW5ncyBmb3Iga2V5cyBhbmQgbm8gZnVubnkgYnVzaW5lc3MsIHRvXG4gIC8vIGEgRERQIGNvbnN1bWVyIHRoYXQgaXNuJ3QgbWluaW1vbmdvLlxuXG4gIHNlbGYuX2lkRmlsdGVyID0ge1xuICAgIGlkU3RyaW5naWZ5OiBNb25nb0lELmlkU3RyaW5naWZ5LFxuICAgIGlkUGFyc2U6IE1vbmdvSUQuaWRQYXJzZVxuICB9O1xuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcImxpdmVkYXRhXCIsIFwic3Vic2NyaXB0aW9uc1wiLCAxKTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU3Vic2NyaXB0aW9uLnByb3RvdHlwZSwge1xuICBfcnVuSGFuZGxlcjogZnVuY3Rpb24oKSB7XG4gICAgLy8gWFhYIHNob3VsZCB3ZSB1bmJsb2NrKCkgaGVyZT8gRWl0aGVyIGJlZm9yZSBydW5uaW5nIHRoZSBwdWJsaXNoXG4gICAgLy8gZnVuY3Rpb24sIG9yIGJlZm9yZSBydW5uaW5nIF9wdWJsaXNoQ3Vyc29yLlxuICAgIC8vXG4gICAgLy8gUmlnaHQgbm93LCBlYWNoIHB1Ymxpc2ggZnVuY3Rpb24gYmxvY2tzIGFsbCBmdXR1cmUgcHVibGlzaGVzIGFuZFxuICAgIC8vIG1ldGhvZHMgd2FpdGluZyBvbiBkYXRhIGZyb20gTW9uZ28gKG9yIHdoYXRldmVyIGVsc2UgdGhlIGZ1bmN0aW9uXG4gICAgLy8gYmxvY2tzIG9uKS4gVGhpcyBwcm9iYWJseSBzbG93cyBwYWdlIGxvYWQgaW4gY29tbW9uIGNhc2VzLlxuXG4gICAgaWYgKCF0aGlzLnVuYmxvY2spIHtcbiAgICAgIHRoaXMudW5ibG9jayA9ICgpID0+IHt9O1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGxldCByZXN1bHRPclRoZW5hYmxlID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgcmVzdWx0T3JUaGVuYWJsZSA9IEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi53aXRoVmFsdWUoc2VsZiwgKCkgPT5cbiAgICAgICAgbWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzKFxuICAgICAgICAgIHNlbGYuX2hhbmRsZXIsXG4gICAgICAgICAgc2VsZixcbiAgICAgICAgICBFSlNPTi5jbG9uZShzZWxmLl9wYXJhbXMpLFxuICAgICAgICAgIC8vIEl0J3MgT0sgdGhhdCB0aGlzIHdvdWxkIGxvb2sgd2VpcmQgZm9yIHVuaXZlcnNhbCBzdWJzY3JpcHRpb25zLFxuICAgICAgICAgIC8vIGJlY2F1c2UgdGhleSBoYXZlIG5vIGFyZ3VtZW50cyBzbyB0aGVyZSBjYW4gbmV2ZXIgYmUgYW5cbiAgICAgICAgICAvLyBhdWRpdC1hcmd1bWVudC1jaGVja3MgZmFpbHVyZS5cbiAgICAgICAgICBcInB1Ymxpc2hlciAnXCIgKyBzZWxmLl9uYW1lICsgXCInXCJcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzZWxmLmVycm9yKGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIERpZCB0aGUgaGFuZGxlciBjYWxsIHRoaXMuZXJyb3Igb3IgdGhpcy5zdG9wP1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpIHJldHVybjtcblxuICAgIC8vIEJvdGggY29udmVudGlvbmFsIGFuZCBhc3luYyBwdWJsaXNoIGhhbmRsZXIgZnVuY3Rpb25zIGFyZSBzdXBwb3J0ZWQuXG4gICAgLy8gSWYgYW4gb2JqZWN0IGlzIHJldHVybmVkIHdpdGggYSB0aGVuKCkgZnVuY3Rpb24sIGl0IGlzIGVpdGhlciBhIHByb21pc2VcbiAgICAvLyBvciB0aGVuYWJsZSBhbmQgd2lsbCBiZSByZXNvbHZlZCBhc3luY2hyb25vdXNseS5cbiAgICBjb25zdCBpc1RoZW5hYmxlID1cbiAgICAgIHJlc3VsdE9yVGhlbmFibGUgJiYgdHlwZW9mIHJlc3VsdE9yVGhlbmFibGUudGhlbiA9PT0gJ2Z1bmN0aW9uJztcbiAgICBpZiAoaXNUaGVuYWJsZSkge1xuICAgICAgUHJvbWlzZS5yZXNvbHZlKHJlc3VsdE9yVGhlbmFibGUpLnRoZW4oXG4gICAgICAgICguLi5hcmdzKSA9PiBzZWxmLl9wdWJsaXNoSGFuZGxlclJlc3VsdC5iaW5kKHNlbGYpKC4uLmFyZ3MpLFxuICAgICAgICBlID0+IHNlbGYuZXJyb3IoZSlcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hIYW5kbGVyUmVzdWx0KHJlc3VsdE9yVGhlbmFibGUpO1xuICAgIH1cbiAgfSxcblxuICBfcHVibGlzaEhhbmRsZXJSZXN1bHQ6IGZ1bmN0aW9uIChyZXMpIHtcbiAgICAvLyBTUEVDSUFMIENBU0U6IEluc3RlYWQgb2Ygd3JpdGluZyB0aGVpciBvd24gY2FsbGJhY2tzIHRoYXQgaW52b2tlXG4gICAgLy8gdGhpcy5hZGRlZC9jaGFuZ2VkL3JlYWR5L2V0YywgdGhlIHVzZXIgY2FuIGp1c3QgcmV0dXJuIGEgY29sbGVjdGlvblxuICAgIC8vIGN1cnNvciBvciBhcnJheSBvZiBjdXJzb3JzIGZyb20gdGhlIHB1Ymxpc2ggZnVuY3Rpb247IHdlIGNhbGwgdGhlaXJcbiAgICAvLyBfcHVibGlzaEN1cnNvciBtZXRob2Qgd2hpY2ggc3RhcnRzIG9ic2VydmluZyB0aGUgY3Vyc29yIGFuZCBwdWJsaXNoZXMgdGhlXG4gICAgLy8gcmVzdWx0cy4gTm90ZSB0aGF0IF9wdWJsaXNoQ3Vyc29yIGRvZXMgTk9UIGNhbGwgcmVhZHkoKS5cbiAgICAvL1xuICAgIC8vIFhYWCBUaGlzIHVzZXMgYW4gdW5kb2N1bWVudGVkIGludGVyZmFjZSB3aGljaCBvbmx5IHRoZSBNb25nbyBjdXJzb3JcbiAgICAvLyBpbnRlcmZhY2UgcHVibGlzaGVzLiBTaG91bGQgd2UgbWFrZSB0aGlzIGludGVyZmFjZSBwdWJsaWMgYW5kIGVuY291cmFnZVxuICAgIC8vIHVzZXJzIHRvIGltcGxlbWVudCBpdCB0aGVtc2VsdmVzPyBBcmd1YWJseSwgaXQncyB1bm5lY2Vzc2FyeTsgdXNlcnMgY2FuXG4gICAgLy8gYWxyZWFkeSB3cml0ZSB0aGVpciBvd24gZnVuY3Rpb25zIGxpa2VcbiAgICAvLyAgIHZhciBwdWJsaXNoTXlSZWFjdGl2ZVRoaW5neSA9IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyKSB7XG4gICAgLy8gICAgIE1ldGVvci5wdWJsaXNoKG5hbWUsIGZ1bmN0aW9uICgpIHtcbiAgICAvLyAgICAgICB2YXIgcmVhY3RpdmVUaGluZ3kgPSBoYW5kbGVyKCk7XG4gICAgLy8gICAgICAgcmVhY3RpdmVUaGluZ3kucHVibGlzaE1lKCk7XG4gICAgLy8gICAgIH0pO1xuICAgIC8vICAgfTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgaXNDdXJzb3IgPSBmdW5jdGlvbiAoYykge1xuICAgICAgcmV0dXJuIGMgJiYgYy5fcHVibGlzaEN1cnNvcjtcbiAgICB9O1xuICAgIGlmIChpc0N1cnNvcihyZXMpKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXMuX3B1Ymxpc2hDdXJzb3Ioc2VsZik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIF9wdWJsaXNoQ3Vyc29yIG9ubHkgcmV0dXJucyBhZnRlciB0aGUgaW5pdGlhbCBhZGRlZCBjYWxsYmFja3MgaGF2ZSBydW4uXG4gICAgICAvLyBtYXJrIHN1YnNjcmlwdGlvbiBhcyByZWFkeS5cbiAgICAgIHNlbGYucmVhZHkoKTtcbiAgICB9IGVsc2UgaWYgKF8uaXNBcnJheShyZXMpKSB7XG4gICAgICAvLyBDaGVjayBhbGwgdGhlIGVsZW1lbnRzIGFyZSBjdXJzb3JzXG4gICAgICBpZiAoISBfLmFsbChyZXMsIGlzQ3Vyc29yKSkge1xuICAgICAgICBzZWxmLmVycm9yKG5ldyBFcnJvcihcIlB1Ymxpc2ggZnVuY3Rpb24gcmV0dXJuZWQgYW4gYXJyYXkgb2Ygbm9uLUN1cnNvcnNcIikpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBGaW5kIGR1cGxpY2F0ZSBjb2xsZWN0aW9uIG5hbWVzXG4gICAgICAvLyBYWFggd2Ugc2hvdWxkIHN1cHBvcnQgb3ZlcmxhcHBpbmcgY3Vyc29ycywgYnV0IHRoYXQgd291bGQgcmVxdWlyZSB0aGVcbiAgICAgIC8vIG1lcmdlIGJveCB0byBhbGxvdyBvdmVybGFwIHdpdGhpbiBhIHN1YnNjcmlwdGlvblxuICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lcyA9IHt9O1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcmVzW2ldLl9nZXRDb2xsZWN0aW9uTmFtZSgpO1xuICAgICAgICBpZiAoXy5oYXMoY29sbGVjdGlvbk5hbWVzLCBjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICBzZWxmLmVycm9yKG5ldyBFcnJvcihcbiAgICAgICAgICAgIFwiUHVibGlzaCBmdW5jdGlvbiByZXR1cm5lZCBtdWx0aXBsZSBjdXJzb3JzIGZvciBjb2xsZWN0aW9uIFwiICtcbiAgICAgICAgICAgICAgY29sbGVjdGlvbk5hbWUpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29sbGVjdGlvbk5hbWVzW2NvbGxlY3Rpb25OYW1lXSA9IHRydWU7XG4gICAgICB9O1xuXG4gICAgICB0cnkge1xuICAgICAgICBfLmVhY2gocmVzLCBmdW5jdGlvbiAoY3VyKSB7XG4gICAgICAgICAgY3VyLl9wdWJsaXNoQ3Vyc29yKHNlbGYpO1xuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgc2VsZi5lcnJvcihlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgc2VsZi5yZWFkeSgpO1xuICAgIH0gZWxzZSBpZiAocmVzKSB7XG4gICAgICAvLyBUcnV0aHkgdmFsdWVzIG90aGVyIHRoYW4gY3Vyc29ycyBvciBhcnJheXMgYXJlIHByb2JhYmx5IGFcbiAgICAgIC8vIHVzZXIgbWlzdGFrZSAocG9zc2libGUgcmV0dXJuaW5nIGEgTW9uZ28gZG9jdW1lbnQgdmlhLCBzYXksXG4gICAgICAvLyBgY29sbC5maW5kT25lKClgKS5cbiAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFwiUHVibGlzaCBmdW5jdGlvbiBjYW4gb25seSByZXR1cm4gYSBDdXJzb3Igb3IgXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICsgXCJhbiBhcnJheSBvZiBDdXJzb3JzXCIpKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gVGhpcyBjYWxscyBhbGwgc3RvcCBjYWxsYmFja3MgYW5kIHByZXZlbnRzIHRoZSBoYW5kbGVyIGZyb20gdXBkYXRpbmcgYW55XG4gIC8vIFNlc3Npb25Db2xsZWN0aW9uVmlld3MgZnVydGhlci4gSXQncyB1c2VkIHdoZW4gdGhlIHVzZXIgdW5zdWJzY3JpYmVzIG9yXG4gIC8vIGRpc2Nvbm5lY3RzLCBhcyB3ZWxsIGFzIGR1cmluZyBzZXRVc2VySWQgcmUtcnVucy4gSXQgZG9lcyAqTk9UKiBzZW5kXG4gIC8vIHJlbW92ZWQgbWVzc2FnZXMgZm9yIHRoZSBwdWJsaXNoZWQgb2JqZWN0czsgaWYgdGhhdCBpcyBuZWNlc3NhcnksIGNhbGxcbiAgLy8gX3JlbW92ZUFsbERvY3VtZW50cyBmaXJzdC5cbiAgX2RlYWN0aXZhdGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fZGVhY3RpdmF0ZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fZGVhY3RpdmF0ZWQgPSB0cnVlO1xuICAgIHNlbGYuX2NhbGxTdG9wQ2FsbGJhY2tzKCk7XG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInN1YnNjcmlwdGlvbnNcIiwgLTEpO1xuICB9LFxuXG4gIF9jYWxsU3RvcENhbGxiYWNrczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBUZWxsIGxpc3RlbmVycywgc28gdGhleSBjYW4gY2xlYW4gdXBcbiAgICB2YXIgY2FsbGJhY2tzID0gc2VsZi5fc3RvcENhbGxiYWNrcztcbiAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzID0gW107XG4gICAgXy5lYWNoKGNhbGxiYWNrcywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNlbmQgcmVtb3ZlIG1lc3NhZ2VzIGZvciBldmVyeSBkb2N1bWVudC5cbiAgX3JlbW92ZUFsbERvY3VtZW50czogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoY29sbGVjdGlvbkRvY3MsIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGNvbGxlY3Rpb25Eb2NzLmZvckVhY2goZnVuY3Rpb24gKHN0cklkKSB7XG4gICAgICAgICAgc2VsZi5yZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBzZWxmLl9pZEZpbHRlci5pZFBhcnNlKHN0cklkKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gUmV0dXJucyBhIG5ldyBTdWJzY3JpcHRpb24gZm9yIHRoZSBzYW1lIHNlc3Npb24gd2l0aCB0aGUgc2FtZVxuICAvLyBpbml0aWFsIGNyZWF0aW9uIHBhcmFtZXRlcnMuIFRoaXMgaXNuJ3QgYSBjbG9uZTogaXQgZG9lc24ndCBoYXZlXG4gIC8vIHRoZSBzYW1lIF9kb2N1bWVudHMgY2FjaGUsIHN0b3BwZWQgc3RhdGUgb3IgY2FsbGJhY2tzOyBtYXkgaGF2ZSBhXG4gIC8vIGRpZmZlcmVudCBfc3Vic2NyaXB0aW9uSGFuZGxlLCBhbmQgZ2V0cyBpdHMgdXNlcklkIGZyb20gdGhlXG4gIC8vIHNlc3Npb24sIG5vdCBmcm9tIHRoaXMgb2JqZWN0LlxuICBfcmVjcmVhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBTdWJzY3JpcHRpb24oXG4gICAgICBzZWxmLl9zZXNzaW9uLCBzZWxmLl9oYW5kbGVyLCBzZWxmLl9zdWJzY3JpcHRpb25JZCwgc2VsZi5fcGFyYW1zLFxuICAgICAgc2VsZi5fbmFtZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgU3RvcHMgdGhpcyBjbGllbnQncyBzdWJzY3JpcHRpb24sIHRyaWdnZXJpbmcgYSBjYWxsIG9uIHRoZSBjbGllbnQgdG8gdGhlIGBvblN0b3BgIGNhbGxiYWNrIHBhc3NlZCB0byBbYE1ldGVvci5zdWJzY3JpYmVgXSgjbWV0ZW9yX3N1YnNjcmliZSksIGlmIGFueS4gSWYgYGVycm9yYCBpcyBub3QgYSBbYE1ldGVvci5FcnJvcmBdKCNtZXRlb3JfZXJyb3IpLCBpdCB3aWxsIGJlIFtzYW5pdGl6ZWRdKCNtZXRlb3JfZXJyb3IpLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIFRoZSBlcnJvciB0byBwYXNzIHRvIHRoZSBjbGllbnQuXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqL1xuICBlcnJvcjogZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc2Vzc2lvbi5fc3RvcFN1YnNjcmlwdGlvbihzZWxmLl9zdWJzY3JpcHRpb25JZCwgZXJyb3IpO1xuICB9LFxuXG4gIC8vIE5vdGUgdGhhdCB3aGlsZSBvdXIgRERQIGNsaWVudCB3aWxsIG5vdGljZSB0aGF0IHlvdSd2ZSBjYWxsZWQgc3RvcCgpIG9uIHRoZVxuICAvLyBzZXJ2ZXIgKGFuZCBjbGVhbiB1cCBpdHMgX3N1YnNjcmlwdGlvbnMgdGFibGUpIHdlIGRvbid0IGFjdHVhbGx5IHByb3ZpZGUgYVxuICAvLyBtZWNoYW5pc20gZm9yIGFuIGFwcCB0byBub3RpY2UgdGhpcyAodGhlIHN1YnNjcmliZSBvbkVycm9yIGNhbGxiYWNrIG9ubHlcbiAgLy8gdHJpZ2dlcnMgaWYgdGhlcmUgaXMgYW4gZXJyb3IpLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIFN0b3BzIHRoaXMgY2xpZW50J3Mgc3Vic2NyaXB0aW9uIGFuZCBpbnZva2VzIHRoZSBjbGllbnQncyBgb25TdG9wYCBjYWxsYmFjayB3aXRoIG5vIGVycm9yLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqL1xuICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc2Vzc2lvbi5fc3RvcFN1YnNjcmlwdGlvbihzZWxmLl9zdWJzY3JpcHRpb25JZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgUmVnaXN0ZXJzIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuIHdoZW4gdGhlIHN1YnNjcmlwdGlvbiBpcyBzdG9wcGVkLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAqL1xuICBvblN0b3A6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjYWxsYmFjayA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2ssICdvblN0b3AgY2FsbGJhY2snLCBzZWxmKTtcbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgY2FsbGJhY2soKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICB9LFxuXG4gIC8vIFRoaXMgcmV0dXJucyB0cnVlIGlmIHRoZSBzdWIgaGFzIGJlZW4gZGVhY3RpdmF0ZWQsICpPUiogaWYgdGhlIHNlc3Npb24gd2FzXG4gIC8vIGRlc3Ryb3llZCBidXQgdGhlIGRlZmVycmVkIGNhbGwgdG8gX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zIGhhc24ndFxuICAvLyBoYXBwZW5lZCB5ZXQuXG4gIF9pc0RlYWN0aXZhdGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9kZWFjdGl2YXRlZCB8fCBzZWxmLl9zZXNzaW9uLmluUXVldWUgPT09IG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGEgZG9jdW1lbnQgaGFzIGJlZW4gYWRkZWQgdG8gdGhlIHJlY29yZCBzZXQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCBjb250YWlucyB0aGUgbmV3IGRvY3VtZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIG5ldyBkb2N1bWVudCdzIElELlxuICAgKiBAcGFyYW0ge09iamVjdH0gZmllbGRzIFRoZSBmaWVsZHMgaW4gdGhlIG5ldyBkb2N1bWVudC4gIElmIGBfaWRgIGlzIHByZXNlbnQgaXQgaXMgaWdub3JlZC5cbiAgICovXG4gIGFkZGVkIChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG5cbiAgICBpZiAodGhpcy5fc2Vzc2lvbi5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkuZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbikge1xuICAgICAgbGV0IGlkcyA9IHRoaXMuX2RvY3VtZW50cy5nZXQoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgaWYgKGlkcyA9PSBudWxsKSB7XG4gICAgICAgIGlkcyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fZG9jdW1lbnRzLnNldChjb2xsZWN0aW9uTmFtZSwgaWRzKTtcbiAgICAgIH1cbiAgICAgIGlkcy5hZGQoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Nlc3Npb24uYWRkZWQodGhpcy5fc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGEgZG9jdW1lbnQgaW4gdGhlIHJlY29yZCBzZXQgaGFzIGJlZW4gbW9kaWZpZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCBjb250YWlucyB0aGUgY2hhbmdlZCBkb2N1bWVudC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IGlkIFRoZSBjaGFuZ2VkIGRvY3VtZW50J3MgSUQuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZHMgVGhlIGZpZWxkcyBpbiB0aGUgZG9jdW1lbnQgdGhhdCBoYXZlIGNoYW5nZWQsIHRvZ2V0aGVyIHdpdGggdGhlaXIgbmV3IHZhbHVlcy4gIElmIGEgZmllbGQgaXMgbm90IHByZXNlbnQgaW4gYGZpZWxkc2AgaXQgd2FzIGxlZnQgdW5jaGFuZ2VkOyBpZiBpdCBpcyBwcmVzZW50IGluIGBmaWVsZHNgIGFuZCBoYXMgYSB2YWx1ZSBvZiBgdW5kZWZpbmVkYCBpdCB3YXMgcmVtb3ZlZCBmcm9tIHRoZSBkb2N1bWVudC4gIElmIGBfaWRgIGlzIHByZXNlbnQgaXQgaXMgaWdub3JlZC5cbiAgICovXG4gIGNoYW5nZWQgKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKHRoaXMuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBpZCA9IHRoaXMuX2lkRmlsdGVyLmlkU3RyaW5naWZ5KGlkKTtcbiAgICB0aGlzLl9zZXNzaW9uLmNoYW5nZWQodGhpcy5fc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGEgZG9jdW1lbnQgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSByZWNvcmQgc2V0LlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBuYW1lIG9mIHRoZSBjb2xsZWN0aW9uIHRoYXQgdGhlIGRvY3VtZW50IGhhcyBiZWVuIHJlbW92ZWQgZnJvbS5cbiAgICogQHBhcmFtIHtTdHJpbmd9IGlkIFRoZSBJRCBvZiB0aGUgZG9jdW1lbnQgdGhhdCBoYXMgYmVlbiByZW1vdmVkLlxuICAgKi9cbiAgcmVtb3ZlZCAoY29sbGVjdGlvbk5hbWUsIGlkKSB7XG4gICAgaWYgKHRoaXMuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBpZCA9IHRoaXMuX2lkRmlsdGVyLmlkU3RyaW5naWZ5KGlkKTtcblxuICAgIGlmICh0aGlzLl9zZXNzaW9uLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS5kb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uKSB7XG4gICAgICAvLyBXZSBkb24ndCBib3RoZXIgdG8gZGVsZXRlIHNldHMgb2YgdGhpbmdzIGluIGEgY29sbGVjdGlvbiBpZiB0aGVcbiAgICAgIC8vIGNvbGxlY3Rpb24gaXMgZW1wdHkuICBJdCBjb3VsZCBicmVhayBfcmVtb3ZlQWxsRG9jdW1lbnRzLlxuICAgICAgdGhpcy5fZG9jdW1lbnRzLmdldChjb2xsZWN0aW9uTmFtZSkuZGVsZXRlKGlkKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXNzaW9uLnJlbW92ZWQodGhpcy5fc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhbiBpbml0aWFsLCBjb21wbGV0ZSBzbmFwc2hvdCBvZiB0aGUgcmVjb3JkIHNldCBoYXMgYmVlbiBzZW50LiAgVGhpcyB3aWxsIHRyaWdnZXIgYSBjYWxsIG9uIHRoZSBjbGllbnQgdG8gdGhlIGBvblJlYWR5YCBjYWxsYmFjayBwYXNzZWQgdG8gIFtgTWV0ZW9yLnN1YnNjcmliZWBdKCNtZXRlb3Jfc3Vic2NyaWJlKSwgaWYgYW55LlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqL1xuICByZWFkeTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlmICghc2VsZi5fc3Vic2NyaXB0aW9uSWQpXG4gICAgICByZXR1cm47ICAvLyBVbm5lY2Vzc2FyeSBidXQgaWdub3JlZCBmb3IgdW5pdmVyc2FsIHN1YlxuICAgIGlmICghc2VsZi5fcmVhZHkpIHtcbiAgICAgIHNlbGYuX3Nlc3Npb24uc2VuZFJlYWR5KFtzZWxmLl9zdWJzY3JpcHRpb25JZF0pO1xuICAgICAgc2VsZi5fcmVhZHkgPSB0cnVlO1xuICAgIH1cbiAgfVxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKiBTZXJ2ZXIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuU2VydmVyID0gZnVuY3Rpb24gKG9wdGlvbnMgPSB7fSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gVGhlIGRlZmF1bHQgaGVhcnRiZWF0IGludGVydmFsIGlzIDMwIHNlY29uZHMgb24gdGhlIHNlcnZlciBhbmQgMzVcbiAgLy8gc2Vjb25kcyBvbiB0aGUgY2xpZW50LiAgU2luY2UgdGhlIGNsaWVudCBkb2Vzbid0IG5lZWQgdG8gc2VuZCBhXG4gIC8vIHBpbmcgYXMgbG9uZyBhcyBpdCBpcyByZWNlaXZpbmcgcGluZ3MsIHRoaXMgbWVhbnMgdGhhdCBwaW5nc1xuICAvLyBub3JtYWxseSBnbyBmcm9tIHRoZSBzZXJ2ZXIgdG8gdGhlIGNsaWVudC5cbiAgLy9cbiAgLy8gTm90ZTogVHJvcG9zcGhlcmUgZGVwZW5kcyBvbiB0aGUgYWJpbGl0eSB0byBtdXRhdGVcbiAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICBzZWxmLm9wdGlvbnMgPSB7XG4gICAgaGVhcnRiZWF0SW50ZXJ2YWw6IDE1MDAwLFxuICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgIC8vIEZvciB0ZXN0aW5nLCBhbGxvdyByZXNwb25kaW5nIHRvIHBpbmdzIHRvIGJlIGRpc2FibGVkLlxuICAgIHJlc3BvbmRUb1BpbmdzOiB0cnVlLFxuICAgIGRlZmF1bHRQdWJsaWNhdGlvblN0cmF0ZWd5OiBwdWJsaWNhdGlvblN0cmF0ZWdpZXMuU0VSVkVSX01FUkdFLFxuICAgIC4uLm9wdGlvbnMsXG4gIH07XG5cbiAgLy8gTWFwIG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gYSBuZXcgY29ubmVjdGlvbiBjb21lcyBpbiB0byB0aGVcbiAgLy8gc2VydmVyIGFuZCBjb21wbGV0ZXMgRERQIHZlcnNpb24gbmVnb3RpYXRpb24uIFVzZSBhbiBvYmplY3QgaW5zdGVhZFxuICAvLyBvZiBhbiBhcnJheSBzbyB3ZSBjYW4gc2FmZWx5IHJlbW92ZSBvbmUgZnJvbSB0aGUgbGlzdCB3aGlsZVxuICAvLyBpdGVyYXRpbmcgb3ZlciBpdC5cbiAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rID0gbmV3IEhvb2soe1xuICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiBcIm9uQ29ubmVjdGlvbiBjYWxsYmFja1wiXG4gIH0pO1xuXG4gIC8vIE1hcCBvZiBjYWxsYmFja3MgdG8gY2FsbCB3aGVuIGEgbmV3IG1lc3NhZ2UgY29tZXMgaW4uXG4gIHNlbGYub25NZXNzYWdlSG9vayA9IG5ldyBIb29rKHtcbiAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogXCJvbk1lc3NhZ2UgY2FsbGJhY2tcIlxuICB9KTtcblxuICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnMgPSB7fTtcbiAgc2VsZi51bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVycyA9IFtdO1xuXG4gIHNlbGYubWV0aG9kX2hhbmRsZXJzID0ge307XG5cbiAgc2VsZi5fcHVibGljYXRpb25TdHJhdGVnaWVzID0ge307XG5cbiAgc2VsZi5zZXNzaW9ucyA9IG5ldyBNYXAoKTsgLy8gbWFwIGZyb20gaWQgdG8gc2Vzc2lvblxuXG4gIHNlbGYuc3RyZWFtX3NlcnZlciA9IG5ldyBTdHJlYW1TZXJ2ZXI7XG5cbiAgc2VsZi5zdHJlYW1fc2VydmVyLnJlZ2lzdGVyKGZ1bmN0aW9uIChzb2NrZXQpIHtcbiAgICAvLyBzb2NrZXQgaW1wbGVtZW50cyB0aGUgU29ja0pTQ29ubmVjdGlvbiBpbnRlcmZhY2VcbiAgICBzb2NrZXQuX21ldGVvclNlc3Npb24gPSBudWxsO1xuXG4gICAgdmFyIHNlbmRFcnJvciA9IGZ1bmN0aW9uIChyZWFzb24sIG9mZmVuZGluZ01lc3NhZ2UpIHtcbiAgICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgICBpZiAob2ZmZW5kaW5nTWVzc2FnZSlcbiAgICAgICAgbXNnLm9mZmVuZGluZ01lc3NhZ2UgPSBvZmZlbmRpbmdNZXNzYWdlO1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChtc2cpKTtcbiAgICB9O1xuXG4gICAgc29ja2V0Lm9uKCdkYXRhJywgZnVuY3Rpb24gKHJhd19tc2cpIHtcbiAgICAgIGlmIChNZXRlb3IuX3ByaW50UmVjZWl2ZWRERFApIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlJlY2VpdmVkIEREUFwiLCByYXdfbXNnKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIG1zZyA9IEREUENvbW1vbi5wYXJzZUREUChyYXdfbXNnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdQYXJzZSBlcnJvcicpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobXNnID09PSBudWxsIHx8ICFtc2cubXNnKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdCYWQgcmVxdWVzdCcsIG1zZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0Jykge1xuICAgICAgICAgIGlmIChzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgICAgIHNlbmRFcnJvcihcIkFscmVhZHkgY29ubmVjdGVkXCIsIG1zZyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIEZpYmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuX2hhbmRsZUNvbm5lY3Qoc29ja2V0LCBtc2cpO1xuICAgICAgICAgIH0pLnJ1bigpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc29ja2V0Ll9tZXRlb3JTZXNzaW9uKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdNdXN0IGNvbm5lY3QgZmlyc3QnLCBtc2cpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzb2NrZXQuX21ldGVvclNlc3Npb24ucHJvY2Vzc01lc3NhZ2UobXNnKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gWFhYIHByaW50IHN0YWNrIG5pY2VseVxuICAgICAgICBNZXRlb3IuX2RlYnVnKFwiSW50ZXJuYWwgZXhjZXB0aW9uIHdoaWxlIHByb2Nlc3NpbmcgbWVzc2FnZVwiLCBtc2csIGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgc29ja2V0Lm9uKCdjbG9zZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgRmliZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbi5jbG9zZSgpO1xuICAgICAgICB9KS5ydW4oKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59O1xuXG5PYmplY3QuYXNzaWduKFNlcnZlci5wcm90b3R5cGUsIHtcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBtYWRlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbkNvbm5lY3Rpb246IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbkNvbm5lY3Rpb25Ib29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgZ2l2ZW4gY29sbGVjdGlvbi4gUHVibGljYXRpb25zIHN0cmF0ZWdpZXMgYXJlIGF2YWlsYWJsZSBmcm9tIGBERFBTZXJ2ZXIucHVibGljYXRpb25TdHJhdGVnaWVzYC4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuc2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBzZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgKiBAcGFyYW0gc3RyYXRlZ3kge3t1c2VDb2xsZWN0aW9uVmlldzogYm9vbGVhbiwgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogYm9vbGVhbn19XG4gICAqIEBtZW1iZXJPZiBNZXRlb3Iuc2VydmVyXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIHNldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUsIHN0cmF0ZWd5KSB7XG4gICAgaWYgKCFPYmplY3QudmFsdWVzKHB1YmxpY2F0aW9uU3RyYXRlZ2llcykuaW5jbHVkZXMoc3RyYXRlZ3kpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWVyZ2Ugc3RyYXRlZ3k6ICR7c3RyYXRlZ3l9IFxuICAgICAgICBmb3IgY29sbGVjdGlvbiAke2NvbGxlY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdID0gc3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgdGhlIHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgcmVxdWVzdGVkIGNvbGxlY3Rpb24uIFlvdSBjYWxsIHRoaXMgbWV0aG9kIGZyb20gYE1ldGVvci5zZXJ2ZXJgLCBsaWtlIGBNZXRlb3Iuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koKWBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAYWxpYXMgZ2V0UHVibGljYXRpb25TdHJhdGVneVxuICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICogQG1lbWJlck9mIE1ldGVvci5zZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAcmV0dXJuIHt7dXNlQ29sbGVjdGlvblZpZXc6IGJvb2xlYW4sIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGJvb2xlYW59fVxuICAgKi9cbiAgZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkge1xuICAgIHJldHVybiB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdXG4gICAgICB8fCB0aGlzLm9wdGlvbnMuZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gYSBuZXcgRERQIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbk1lc3NhZ2U6IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbk1lc3NhZ2VIb29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICBfaGFuZGxlQ29ubmVjdDogZnVuY3Rpb24gKHNvY2tldCwgbXNnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gVGhlIGNvbm5lY3QgbWVzc2FnZSBtdXN0IHNwZWNpZnkgYSB2ZXJzaW9uIGFuZCBhbiBhcnJheSBvZiBzdXBwb3J0ZWRcbiAgICAvLyB2ZXJzaW9ucywgYW5kIGl0IG11c3QgY2xhaW0gdG8gc3VwcG9ydCB3aGF0IGl0IGlzIHByb3Bvc2luZy5cbiAgICBpZiAoISh0eXBlb2YgKG1zZy52ZXJzaW9uKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICBfLmlzQXJyYXkobXNnLnN1cHBvcnQpICYmXG4gICAgICAgICAgXy5hbGwobXNnLnN1cHBvcnQsIF8uaXNTdHJpbmcpICYmXG4gICAgICAgICAgXy5jb250YWlucyhtc2cuc3VwcG9ydCwgbXNnLnZlcnNpb24pKSkge1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7bXNnOiAnZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlNbMF19KSk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGUgZnV0dXJlLCBoYW5kbGUgc2Vzc2lvbiByZXN1bXB0aW9uOiBzb21ldGhpbmcgbGlrZTpcbiAgICAvLyAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gc2VsZi5zZXNzaW9uc1ttc2cuc2Vzc2lvbl1cbiAgICB2YXIgdmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb24obXNnLnN1cHBvcnQsIEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TKTtcblxuICAgIGlmIChtc2cudmVyc2lvbiAhPT0gdmVyc2lvbikge1xuICAgICAgLy8gVGhlIGJlc3QgdmVyc2lvbiB0byB1c2UgKGFjY29yZGluZyB0byB0aGUgY2xpZW50J3Mgc3RhdGVkIHByZWZlcmVuY2VzKVxuICAgICAgLy8gaXMgbm90IHRoZSBvbmUgdGhlIGNsaWVudCBpcyB0cnlpbmcgdG8gdXNlLiBJbmZvcm0gdGhlbSBhYm91dCB0aGUgYmVzdFxuICAgICAgLy8gdmVyc2lvbiB0byB1c2UuXG4gICAgICBzb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKHttc2c6ICdmYWlsZWQnLCB2ZXJzaW9uOiB2ZXJzaW9ufSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWWF5LCB2ZXJzaW9uIG1hdGNoZXMhIENyZWF0ZSBhIG5ldyBzZXNzaW9uLlxuICAgIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gICAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNlbGYsIHZlcnNpb24sIHNvY2tldCwgc2VsZi5vcHRpb25zKTtcbiAgICBzZWxmLnNlc3Npb25zLnNldChzb2NrZXQuX21ldGVvclNlc3Npb24uaWQsIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbik7XG4gICAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKVxuICAgICAgICBjYWxsYmFjayhzb2NrZXQuX21ldGVvclNlc3Npb24uY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfSBpZGVudGlmaWVyIGZvciBxdWVyeVxuICAgKiBAcGFyYW0gaGFuZGxlciB7RnVuY3Rpb259IHB1Ymxpc2ggaGFuZGxlclxuICAgKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxuICAgKlxuICAgKiBTZXJ2ZXIgd2lsbCBjYWxsIGhhbmRsZXIgZnVuY3Rpb24gb24gZWFjaCBuZXcgc3Vic2NyaXB0aW9uLFxuICAgKiBlaXRoZXIgd2hlbiByZWNlaXZpbmcgRERQIHN1YiBtZXNzYWdlIGZvciBhIG5hbWVkIHN1YnNjcmlwdGlvbiwgb3Igb25cbiAgICogRERQIGNvbm5lY3QgZm9yIGEgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbi5cbiAgICpcbiAgICogSWYgbmFtZSBpcyBudWxsLCB0aGlzIHdpbGwgYmUgYSBzdWJzY3JpcHRpb24gdGhhdCBpc1xuICAgKiBhdXRvbWF0aWNhbGx5IGVzdGFibGlzaGVkIGFuZCBwZXJtYW5lbnRseSBvbiBmb3IgYWxsIGNvbm5lY3RlZFxuICAgKiBjbGllbnQsIGluc3RlYWQgb2YgYSBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdHVybmVkIG9uIGFuZCBvZmZcbiAgICogd2l0aCBzdWJzY3JpYmUoKS5cbiAgICpcbiAgICogb3B0aW9ucyB0byBjb250YWluOlxuICAgKiAgLSAobW9zdGx5IGludGVybmFsKSBpc19hdXRvOiB0cnVlIGlmIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5XG4gICAqICAgIGZyb20gYW4gYXV0b3B1Ymxpc2ggaG9vay4gdGhpcyBpcyBmb3IgY29zbWV0aWMgcHVycG9zZXMgb25seVxuICAgKiAgICAoaXQgbGV0cyB1cyBkZXRlcm1pbmUgd2hldGhlciB0byBwcmludCBhIHdhcm5pbmcgc3VnZ2VzdGluZ1xuICAgKiAgICB0aGF0IHlvdSB0dXJuIG9mZiBhdXRvcHVibGlzaCkuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQdWJsaXNoIGEgcmVjb3JkIHNldC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBuYW1lIElmIFN0cmluZywgbmFtZSBvZiB0aGUgcmVjb3JkIHNldC4gIElmIE9iamVjdCwgcHVibGljYXRpb25zIERpY3Rpb25hcnkgb2YgcHVibGlzaCBmdW5jdGlvbnMgYnkgbmFtZS4gIElmIGBudWxsYCwgdGhlIHNldCBoYXMgbm8gbmFtZSwgYW5kIHRoZSByZWNvcmQgc2V0IGlzIGF1dG9tYXRpY2FsbHkgc2VudCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgRnVuY3Rpb24gY2FsbGVkIG9uIHRoZSBzZXJ2ZXIgZWFjaCB0aW1lIGEgY2xpZW50IHN1YnNjcmliZXMuICBJbnNpZGUgdGhlIGZ1bmN0aW9uLCBgdGhpc2AgaXMgdGhlIHB1Ymxpc2ggaGFuZGxlciBvYmplY3QsIGRlc2NyaWJlZCBiZWxvdy4gIElmIHRoZSBjbGllbnQgcGFzc2VkIGFyZ3VtZW50cyB0byBgc3Vic2NyaWJlYCwgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cy5cbiAgICovXG4gIHB1Ymxpc2g6IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCEgXy5pc09iamVjdChuYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgIGlmIChuYW1lICYmIG5hbWUgaW4gc2VsZi5wdWJsaXNoX2hhbmRsZXJzKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJZ25vcmluZyBkdXBsaWNhdGUgcHVibGlzaCBuYW1lZCAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlLmF1dG9wdWJsaXNoICYmICFvcHRpb25zLmlzX2F1dG8pIHtcbiAgICAgICAgLy8gVGhleSBoYXZlIGF1dG9wdWJsaXNoIG9uLCB5ZXQgdGhleSdyZSB0cnlpbmcgdG8gbWFudWFsbHlcbiAgICAgICAgLy8gcGljayBzdHVmZiB0byBwdWJsaXNoLiBUaGV5IHByb2JhYmx5IHNob3VsZCB0dXJuIG9mZlxuICAgICAgICAvLyBhdXRvcHVibGlzaC4gKFRoaXMgY2hlY2sgaXNuJ3QgcGVyZmVjdCAtLSBpZiB5b3UgY3JlYXRlIGFcbiAgICAgICAgLy8gcHVibGlzaCBiZWZvcmUgeW91IHR1cm4gb24gYXV0b3B1Ymxpc2gsIGl0IHdvbid0IGNhdGNoXG4gICAgICAgIC8vIGl0LCBidXQgdGhpcyB3aWxsIGRlZmluaXRlbHkgaGFuZGxlIHRoZSBzaW1wbGUgY2FzZSB3aGVyZVxuICAgICAgICAvLyB5b3UndmUgYWRkZWQgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2UgdG8geW91ciBhcHAsIGFuZCBhcmVcbiAgICAgICAgLy8gY2FsbGluZyBwdWJsaXNoIGZyb20geW91ciBhcHAgY29kZSkuXG4gICAgICAgIGlmICghc2VsZi53YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2gpIHtcbiAgICAgICAgICBzZWxmLndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCA9IHRydWU7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICBcIioqIFlvdSd2ZSBzZXQgdXAgc29tZSBkYXRhIHN1YnNjcmlwdGlvbnMgd2l0aCBNZXRlb3IucHVibGlzaCgpLCBidXRcXG5cIiArXG4gICAgXCIqKiB5b3Ugc3RpbGwgaGF2ZSBhdXRvcHVibGlzaCB0dXJuZWQgb24uIEJlY2F1c2UgYXV0b3B1Ymxpc2ggaXMgc3RpbGxcXG5cIiArXG4gICAgXCIqKiBvbiwgeW91ciBNZXRlb3IucHVibGlzaCgpIGNhbGxzIHdvbid0IGhhdmUgbXVjaCBlZmZlY3QuIEFsbCBkYXRhXFxuXCIgK1xuICAgIFwiKiogd2lsbCBzdGlsbCBiZSBzZW50IHRvIGFsbCBjbGllbnRzLlxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogVHVybiBvZmYgYXV0b3B1Ymxpc2ggYnkgcmVtb3ZpbmcgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2U6XFxuXCIgK1xuICAgIFwiKipcXG5cIiArXG4gICAgXCIqKiAgICQgbWV0ZW9yIHJlbW92ZSBhdXRvcHVibGlzaFxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogLi4gYW5kIG1ha2Ugc3VyZSB5b3UgaGF2ZSBNZXRlb3IucHVibGlzaCgpIGFuZCBNZXRlb3Iuc3Vic2NyaWJlKCkgY2FsbHNcXG5cIiArXG4gICAgXCIqKiBmb3IgZWFjaCBjb2xsZWN0aW9uIHRoYXQgeW91IHdhbnQgY2xpZW50cyB0byBzZWUuXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lKVxuICAgICAgICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgLy8gU3BpbiB1cCB0aGUgbmV3IHB1Ymxpc2hlciBvbiBhbnkgZXhpc3Rpbmcgc2Vzc2lvbiB0b28uIFJ1biBlYWNoXG4gICAgICAgIC8vIHNlc3Npb24ncyBzdWJzY3JpcHRpb24gaW4gYSBuZXcgRmliZXIsIHNvIHRoYXQgdGhlcmUncyBubyBjaGFuZ2UgZm9yXG4gICAgICAgIC8vIHNlbGYuc2Vzc2lvbnMgdG8gY2hhbmdlIHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhpcyBsb29wLlxuICAgICAgICBzZWxmLnNlc3Npb25zLmZvckVhY2goZnVuY3Rpb24gKHNlc3Npb24pIHtcbiAgICAgICAgICBpZiAoIXNlc3Npb24uX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMpIHtcbiAgICAgICAgICAgIEZpYmVyKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBzZXNzaW9uLl9zdGFydFN1YnNjcmlwdGlvbihoYW5kbGVyKTtcbiAgICAgICAgICAgIH0pLnJ1bigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICBfLmVhY2gobmFtZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICBzZWxmLnB1Ymxpc2goa2V5LCB2YWx1ZSwge30pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9yZW1vdmVTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgRGVmaW5lcyBmdW5jdGlvbnMgdGhhdCBjYW4gYmUgaW52b2tlZCBvdmVyIHRoZSBuZXR3b3JrIGJ5IGNsaWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge09iamVjdH0gbWV0aG9kcyBEaWN0aW9uYXJ5IHdob3NlIGtleXMgYXJlIG1ldGhvZCBuYW1lcyBhbmQgdmFsdWVzIGFyZSBmdW5jdGlvbnMuXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKi9cbiAgbWV0aG9kczogZnVuY3Rpb24gKG1ldGhvZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgXy5lYWNoKG1ldGhvZHMsIGZ1bmN0aW9uIChmdW5jLCBuYW1lKSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1ldGhvZCAnXCIgKyBuYW1lICsgXCInIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcbiAgICAgIGlmIChzZWxmLm1ldGhvZF9oYW5kbGVyc1tuYW1lXSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBtZXRob2QgbmFtZWQgJ1wiICsgbmFtZSArIFwiJyBpcyBhbHJlYWR5IGRlZmluZWRcIik7XG4gICAgICBzZWxmLm1ldGhvZF9oYW5kbGVyc1tuYW1lXSA9IGZ1bmM7XG4gICAgfSk7XG4gIH0sXG5cbiAgY2FsbDogZnVuY3Rpb24gKG5hbWUsIC4uLmFyZ3MpIHtcbiAgICBpZiAoYXJncy5sZW5ndGggJiYgdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAvLyBJZiBpdCdzIGEgZnVuY3Rpb24sIHRoZSBsYXN0IGFyZ3VtZW50IGlzIHRoZSByZXN1bHQgY2FsbGJhY2ssIG5vdFxuICAgICAgLy8gYSBwYXJhbWV0ZXIgdG8gdGhlIHJlbW90ZSBtZXRob2QuXG4gICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzLnBvcCgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmFwcGx5KG5hbWUsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgfSxcblxuICAvLyBBIHZlcnNpb24gb2YgdGhlIGNhbGwgbWV0aG9kIHRoYXQgYWx3YXlzIHJldHVybnMgYSBQcm9taXNlLlxuICBjYWxsQXN5bmM6IGZ1bmN0aW9uIChuYW1lLCAuLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzKTtcbiAgfSxcblxuICBhcHBseTogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgfVxuXG4gICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCBvcHRpb25zKTtcblxuICAgIC8vIFJldHVybiB0aGUgcmVzdWx0IGluIHdoaWNoZXZlciB3YXkgdGhlIGNhbGxlciBhc2tlZCBmb3IgaXQuIE5vdGUgdGhhdCB3ZVxuICAgIC8vIGRvIE5PVCBibG9jayBvbiB0aGUgd3JpdGUgZmVuY2UgaW4gYW4gYW5hbG9nb3VzIHdheSB0byBob3cgdGhlIGNsaWVudFxuICAgIC8vIGJsb2NrcyBvbiB0aGUgcmVsZXZhbnQgZGF0YSBiZWluZyB2aXNpYmxlLCBzbyB5b3UgYXJlIE5PVCBndWFyYW50ZWVkIHRoYXRcbiAgICAvLyBjdXJzb3Igb2JzZXJ2ZSBjYWxsYmFja3MgaGF2ZSBmaXJlZCB3aGVuIHlvdXIgY2FsbGJhY2sgaXMgaW52b2tlZC4gKFdlXG4gICAgLy8gY2FuIGNoYW5nZSB0aGlzIGlmIHRoZXJlJ3MgYSByZWFsIHVzZSBjYXNlKS5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIHByb21pc2UudGhlbihcbiAgICAgICAgcmVzdWx0ID0+IGNhbGxiYWNrKHVuZGVmaW5lZCwgcmVzdWx0KSxcbiAgICAgICAgZXhjZXB0aW9uID0+IGNhbGxiYWNrKGV4Y2VwdGlvbilcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwcm9taXNlLmF3YWl0KCk7XG4gICAgfVxuICB9LFxuXG4gIC8vIEBwYXJhbSBvcHRpb25zIHtPcHRpb25hbCBPYmplY3R9XG4gIGFwcGx5QXN5bmM6IGZ1bmN0aW9uIChuYW1lLCBhcmdzLCBvcHRpb25zKSB7XG4gICAgLy8gUnVuIHRoZSBoYW5kbGVyXG4gICAgdmFyIGhhbmRsZXIgPSB0aGlzLm1ldGhvZF9oYW5kbGVyc1tuYW1lXTtcbiAgICBpZiAoISBoYW5kbGVyKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoNDA0LCBgTWV0aG9kICcke25hbWV9JyBub3QgZm91bmRgKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgbWV0aG9kIGNhbGwgZnJvbSB3aXRoaW4gYW5vdGhlciBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbixcbiAgICAvLyBnZXQgdGhlIHVzZXIgc3RhdGUgZnJvbSB0aGUgb3V0ZXIgbWV0aG9kIG9yIHB1Ymxpc2ggZnVuY3Rpb24sIG90aGVyd2lzZVxuICAgIC8vIGRvbid0IGFsbG93IHNldFVzZXJJZCB0byBiZSBjYWxsZWRcbiAgICB2YXIgdXNlcklkID0gbnVsbDtcbiAgICB2YXIgc2V0VXNlcklkID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIHNldFVzZXJJZCBvbiBhIHNlcnZlciBpbml0aWF0ZWQgbWV0aG9kIGNhbGxcIik7XG4gICAgfTtcbiAgICB2YXIgY29ubmVjdGlvbiA9IG51bGw7XG4gICAgdmFyIGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiA9IEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgcmFuZG9tU2VlZCA9IG51bGw7XG4gICAgaWYgKGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uKSB7XG4gICAgICB1c2VySWQgPSBjdXJyZW50TWV0aG9kSW52b2NhdGlvbi51c2VySWQ7XG4gICAgICBzZXRVc2VySWQgPSBmdW5jdGlvbih1c2VySWQpIHtcbiAgICAgICAgY3VycmVudE1ldGhvZEludm9jYXRpb24uc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICB9O1xuICAgICAgY29ubmVjdGlvbiA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb247XG4gICAgICByYW5kb21TZWVkID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24udXNlcklkO1xuICAgICAgc2V0VXNlcklkID0gZnVuY3Rpb24odXNlcklkKSB7XG4gICAgICAgIGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24uX3Nlc3Npb24uX3NldFVzZXJJZCh1c2VySWQpO1xuICAgICAgfTtcbiAgICAgIGNvbm5lY3Rpb24gPSBjdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLmNvbm5lY3Rpb247XG4gICAgfVxuXG4gICAgdmFyIGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgaXNTaW11bGF0aW9uOiBmYWxzZSxcbiAgICAgIHVzZXJJZCxcbiAgICAgIHNldFVzZXJJZCxcbiAgICAgIGNvbm5lY3Rpb24sXG4gICAgICByYW5kb21TZWVkXG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiByZXNvbHZlKFxuICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgIGludm9jYXRpb24sXG4gICAgICAgICgpID0+IG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyhcbiAgICAgICAgICBoYW5kbGVyLCBpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSxcbiAgICAgICAgICBcImludGVybmFsIGNhbGwgdG8gJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICAgIClcbiAgICAgIClcbiAgICApKS50aGVuKEVKU09OLmNsb25lKTtcbiAgfSxcblxuICBfdXJsRm9yU2Vzc2lvbjogZnVuY3Rpb24gKHNlc3Npb25JZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgc2Vzc2lvbiA9IHNlbGYuc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG4gICAgaWYgKHNlc3Npb24pXG4gICAgICByZXR1cm4gc2Vzc2lvbi5fc29ja2V0VXJsO1xuICAgIGVsc2VcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59KTtcblxudmFyIGNhbGN1bGF0ZVZlcnNpb24gPSBmdW5jdGlvbiAoY2xpZW50U3VwcG9ydGVkVmVyc2lvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucykge1xuICB2YXIgY29ycmVjdFZlcnNpb24gPSBfLmZpbmQoY2xpZW50U3VwcG9ydGVkVmVyc2lvbnMsIGZ1bmN0aW9uICh2ZXJzaW9uKSB7XG4gICAgcmV0dXJuIF8uY29udGFpbnMoc2VydmVyU3VwcG9ydGVkVmVyc2lvbnMsIHZlcnNpb24pO1xuICB9KTtcbiAgaWYgKCFjb3JyZWN0VmVyc2lvbikge1xuICAgIGNvcnJlY3RWZXJzaW9uID0gc2VydmVyU3VwcG9ydGVkVmVyc2lvbnNbMF07XG4gIH1cbiAgcmV0dXJuIGNvcnJlY3RWZXJzaW9uO1xufTtcblxuRERQU2VydmVyLl9jYWxjdWxhdGVWZXJzaW9uID0gY2FsY3VsYXRlVmVyc2lvbjtcblxuXG4vLyBcImJsaW5kXCIgZXhjZXB0aW9ucyBvdGhlciB0aGFuIHRob3NlIHRoYXQgd2VyZSBkZWxpYmVyYXRlbHkgdGhyb3duIHRvIHNpZ25hbFxuLy8gZXJyb3JzIHRvIHRoZSBjbGllbnRcbnZhciB3cmFwSW50ZXJuYWxFeGNlcHRpb24gPSBmdW5jdGlvbiAoZXhjZXB0aW9uLCBjb250ZXh0KSB7XG4gIGlmICghZXhjZXB0aW9uKSByZXR1cm4gZXhjZXB0aW9uO1xuXG4gIC8vIFRvIGFsbG93IHBhY2thZ2VzIHRvIHRocm93IGVycm9ycyBpbnRlbmRlZCBmb3IgdGhlIGNsaWVudCBidXQgbm90IGhhdmUgdG9cbiAgLy8gZGVwZW5kIG9uIHRoZSBNZXRlb3IuRXJyb3IgY2xhc3MsIGBpc0NsaWVudFNhZmVgIGNhbiBiZSBzZXQgdG8gdHJ1ZSBvbiBhbnlcbiAgLy8gZXJyb3IgYmVmb3JlIGl0IGlzIHRocm93bi5cbiAgaWYgKGV4Y2VwdGlvbi5pc0NsaWVudFNhZmUpIHtcbiAgICBpZiAoIShleGNlcHRpb24gaW5zdGFuY2VvZiBNZXRlb3IuRXJyb3IpKSB7XG4gICAgICBjb25zdCBvcmlnaW5hbE1lc3NhZ2UgPSBleGNlcHRpb24ubWVzc2FnZTtcbiAgICAgIGV4Y2VwdGlvbiA9IG5ldyBNZXRlb3IuRXJyb3IoZXhjZXB0aW9uLmVycm9yLCBleGNlcHRpb24ucmVhc29uLCBleGNlcHRpb24uZGV0YWlscyk7XG4gICAgICBleGNlcHRpb24ubWVzc2FnZSA9IG9yaWdpbmFsTWVzc2FnZTtcbiAgICB9XG4gICAgcmV0dXJuIGV4Y2VwdGlvbjtcbiAgfVxuXG4gIC8vIFRlc3RzIGNhbiBzZXQgdGhlICdfZXhwZWN0ZWRCeVRlc3QnIGZsYWcgb24gYW4gZXhjZXB0aW9uIHNvIGl0IHdvbid0IGdvIHRvXG4gIC8vIHRoZSBzZXJ2ZXIgbG9nLlxuICBpZiAoIWV4Y2VwdGlvbi5fZXhwZWN0ZWRCeVRlc3QpIHtcbiAgICBNZXRlb3IuX2RlYnVnKFwiRXhjZXB0aW9uIFwiICsgY29udGV4dCwgZXhjZXB0aW9uLnN0YWNrKTtcbiAgICBpZiAoZXhjZXB0aW9uLnNhbml0aXplZEVycm9yKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiU2FuaXRpemVkIGFuZCByZXBvcnRlZCB0byB0aGUgY2xpZW50IGFzOlwiLCBleGNlcHRpb24uc2FuaXRpemVkRXJyb3IpO1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygpO1xuICAgIH1cbiAgfVxuXG4gIC8vIERpZCB0aGUgZXJyb3IgY29udGFpbiBtb3JlIGRldGFpbHMgdGhhdCBjb3VsZCBoYXZlIGJlZW4gdXNlZnVsIGlmIGNhdWdodCBpblxuICAvLyBzZXJ2ZXIgY29kZSAob3IgaWYgdGhyb3duIGZyb20gbm9uLWNsaWVudC1vcmlnaW5hdGVkIGNvZGUpLCBidXQgYWxzb1xuICAvLyBwcm92aWRlZCBhIFwic2FuaXRpemVkXCIgdmVyc2lvbiB3aXRoIG1vcmUgY29udGV4dCB0aGFuIDUwMCBJbnRlcm5hbCBzZXJ2ZXJcbiAgLy8gZXJyb3I/IFVzZSB0aGF0LlxuICBpZiAoZXhjZXB0aW9uLnNhbml0aXplZEVycm9yKSB7XG4gICAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvci5pc0NsaWVudFNhZmUpXG4gICAgICByZXR1cm4gZXhjZXB0aW9uLnNhbml0aXplZEVycm9yO1xuICAgIE1ldGVvci5fZGVidWcoXCJFeGNlcHRpb24gXCIgKyBjb250ZXh0ICsgXCIgcHJvdmlkZXMgYSBzYW5pdGl6ZWRFcnJvciB0aGF0IFwiICtcbiAgICAgICAgICAgICAgICAgIFwiZG9lcyBub3QgaGF2ZSBpc0NsaWVudFNhZmUgcHJvcGVydHkgc2V0OyBpZ25vcmluZ1wiKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgTWV0ZW9yLkVycm9yKDUwMCwgXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIik7XG59O1xuXG5cbi8vIEF1ZGl0IGFyZ3VtZW50IGNoZWNrcywgaWYgdGhlIGF1ZGl0LWFyZ3VtZW50LWNoZWNrcyBwYWNrYWdlIGV4aXN0cyAoaXQgaXMgYVxuLy8gd2VhayBkZXBlbmRlbmN5IG9mIHRoaXMgcGFja2FnZSkuXG52YXIgbWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzID0gZnVuY3Rpb24gKGYsIGNvbnRleHQsIGFyZ3MsIGRlc2NyaXB0aW9uKSB7XG4gIGFyZ3MgPSBhcmdzIHx8IFtdO1xuICBpZiAoUGFja2FnZVsnYXVkaXQtYXJndW1lbnQtY2hlY2tzJ10pIHtcbiAgICByZXR1cm4gTWF0Y2guX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQoXG4gICAgICBmLCBjb250ZXh0LCBhcmdzLCBkZXNjcmlwdGlvbik7XG4gIH1cbiAgcmV0dXJuIGYuYXBwbHkoY29udGV4dCwgYXJncyk7XG59O1xuIiwidmFyIEZ1dHVyZSA9IE5wbS5yZXF1aXJlKCdmaWJlcnMvZnV0dXJlJyk7XG5cbi8vIEEgd3JpdGUgZmVuY2UgY29sbGVjdHMgYSBncm91cCBvZiB3cml0ZXMsIGFuZCBwcm92aWRlcyBhIGNhbGxiYWNrXG4vLyB3aGVuIGFsbCBvZiB0aGUgd3JpdGVzIGFyZSBmdWxseSBjb21taXR0ZWQgYW5kIHByb3BhZ2F0ZWQgKGFsbFxuLy8gb2JzZXJ2ZXJzIGhhdmUgYmVlbiBub3RpZmllZCBvZiB0aGUgd3JpdGUgYW5kIGFja25vd2xlZGdlZCBpdC4pXG4vL1xuRERQU2VydmVyLl9Xcml0ZUZlbmNlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgc2VsZi5hcm1lZCA9IGZhbHNlO1xuICBzZWxmLmZpcmVkID0gZmFsc2U7XG4gIHNlbGYucmV0aXJlZCA9IGZhbHNlO1xuICBzZWxmLm91dHN0YW5kaW5nX3dyaXRlcyA9IDA7XG4gIHNlbGYuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzID0gW107XG4gIHNlbGYuY29tcGxldGlvbl9jYWxsYmFja3MgPSBbXTtcbn07XG5cbi8vIFRoZSBjdXJyZW50IHdyaXRlIGZlbmNlLiBXaGVuIHRoZXJlIGlzIGEgY3VycmVudCB3cml0ZSBmZW5jZSwgY29kZVxuLy8gdGhhdCB3cml0ZXMgdG8gZGF0YWJhc2VzIHNob3VsZCByZWdpc3RlciB0aGVpciB3cml0ZXMgd2l0aCBpdCB1c2luZ1xuLy8gYmVnaW5Xcml0ZSgpLlxuLy9cbkREUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2UgPSBuZXcgTWV0ZW9yLkVudmlyb25tZW50VmFyaWFibGU7XG5cbl8uZXh0ZW5kKEREUFNlcnZlci5fV3JpdGVGZW5jZS5wcm90b3R5cGUsIHtcbiAgLy8gU3RhcnQgdHJhY2tpbmcgYSB3cml0ZSwgYW5kIHJldHVybiBhbiBvYmplY3QgdG8gcmVwcmVzZW50IGl0LiBUaGVcbiAgLy8gb2JqZWN0IGhhcyBhIHNpbmdsZSBtZXRob2QsIGNvbW1pdHRlZCgpLiBUaGlzIG1ldGhvZCBzaG91bGQgYmVcbiAgLy8gY2FsbGVkIHdoZW4gdGhlIHdyaXRlIGlzIGZ1bGx5IGNvbW1pdHRlZCBhbmQgcHJvcGFnYXRlZC4gWW91IGNhblxuICAvLyBjb250aW51ZSB0byBhZGQgd3JpdGVzIHRvIHRoZSBXcml0ZUZlbmNlIHVwIHVudGlsIGl0IGlzIHRyaWdnZXJlZFxuICAvLyAoY2FsbHMgaXRzIGNhbGxiYWNrcyBiZWNhdXNlIGFsbCB3cml0ZXMgaGF2ZSBjb21taXR0ZWQuKVxuICBiZWdpbldyaXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYucmV0aXJlZClcbiAgICAgIHJldHVybiB7IGNvbW1pdHRlZDogZnVuY3Rpb24gKCkge30gfTtcblxuICAgIGlmIChzZWxmLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmVuY2UgaGFzIGFscmVhZHkgYWN0aXZhdGVkIC0tIHRvbyBsYXRlIHRvIGFkZCB3cml0ZXNcIik7XG5cbiAgICBzZWxmLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgIHZhciBjb21taXR0ZWQgPSBmYWxzZTtcbiAgICByZXR1cm4ge1xuICAgICAgY29tbWl0dGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChjb21taXR0ZWQpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY29tbWl0dGVkIGNhbGxlZCB0d2ljZSBvbiB0aGUgc2FtZSB3cml0ZVwiKTtcbiAgICAgICAgY29tbWl0dGVkID0gdHJ1ZTtcbiAgICAgICAgc2VsZi5vdXRzdGFuZGluZ193cml0ZXMtLTtcbiAgICAgICAgc2VsZi5fbWF5YmVGaXJlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfSxcblxuICAvLyBBcm0gdGhlIGZlbmNlLiBPbmNlIHRoZSBmZW5jZSBpcyBhcm1lZCwgYW5kIHRoZXJlIGFyZSBubyBtb3JlXG4gIC8vIHVuY29tbWl0dGVkIHdyaXRlcywgaXQgd2lsbCBhY3RpdmF0ZS5cbiAgYXJtOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmID09PSBERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlLmdldCgpKVxuICAgICAgdGhyb3cgRXJyb3IoXCJDYW4ndCBhcm0gdGhlIGN1cnJlbnQgZmVuY2VcIik7XG4gICAgc2VsZi5hcm1lZCA9IHRydWU7XG4gICAgc2VsZi5fbWF5YmVGaXJlKCk7XG4gIH0sXG5cbiAgLy8gUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb25jZSBiZWZvcmUgZmlyaW5nIHRoZSBmZW5jZS5cbiAgLy8gQ2FsbGJhY2sgZnVuY3Rpb24gY2FuIGFkZCBuZXcgd3JpdGVzIHRvIHRoZSBmZW5jZSwgaW4gd2hpY2ggY2FzZVxuICAvLyBpdCB3b24ndCBmaXJlIHVudGlsIHRob3NlIHdyaXRlcyBhcmUgZG9uZSBhcyB3ZWxsLlxuICBvbkJlZm9yZUZpcmU6IGZ1bmN0aW9uIChmdW5jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmVuY2UgaGFzIGFscmVhZHkgYWN0aXZhdGVkIC0tIHRvbyBsYXRlIHRvIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBcImFkZCBhIGNhbGxiYWNrXCIpO1xuICAgIHNlbGYuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzLnB1c2goZnVuYyk7XG4gIH0sXG5cbiAgLy8gUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2hlbiB0aGUgZmVuY2UgZmlyZXMuXG4gIG9uQWxsQ29tbWl0dGVkOiBmdW5jdGlvbiAoZnVuYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImZlbmNlIGhhcyBhbHJlYWR5IGFjdGl2YXRlZCAtLSB0b28gbGF0ZSB0byBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgXCJhZGQgYSBjYWxsYmFja1wiKTtcbiAgICBzZWxmLmNvbXBsZXRpb25fY2FsbGJhY2tzLnB1c2goZnVuYyk7XG4gIH0sXG5cbiAgLy8gQ29udmVuaWVuY2UgZnVuY3Rpb24uIEFybXMgdGhlIGZlbmNlLCB0aGVuIGJsb2NrcyB1bnRpbCBpdCBmaXJlcy5cbiAgYXJtQW5kV2FpdDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZnV0dXJlID0gbmV3IEZ1dHVyZTtcbiAgICBzZWxmLm9uQWxsQ29tbWl0dGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGZ1dHVyZVsncmV0dXJuJ10oKTtcbiAgICB9KTtcbiAgICBzZWxmLmFybSgpO1xuICAgIGZ1dHVyZS53YWl0KCk7XG4gIH0sXG5cbiAgX21heWJlRmlyZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIndyaXRlIGZlbmNlIGFscmVhZHkgYWN0aXZhdGVkP1wiKTtcbiAgICBpZiAoc2VsZi5hcm1lZCAmJiAhc2VsZi5vdXRzdGFuZGluZ193cml0ZXMpIHtcbiAgICAgIGZ1bmN0aW9uIGludm9rZUNhbGxiYWNrIChmdW5jKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZnVuYyhzZWxmKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcImV4Y2VwdGlvbiBpbiB3cml0ZSBmZW5jZSBjYWxsYmFja1wiLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNlbGYub3V0c3RhbmRpbmdfd3JpdGVzKys7XG4gICAgICB3aGlsZSAoc2VsZi5iZWZvcmVfZmlyZV9jYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICB2YXIgY2FsbGJhY2tzID0gc2VsZi5iZWZvcmVfZmlyZV9jYWxsYmFja3M7XG4gICAgICAgIHNlbGYuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzID0gW107XG4gICAgICAgIF8uZWFjaChjYWxsYmFja3MsIGludm9rZUNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICAgIHNlbGYub3V0c3RhbmRpbmdfd3JpdGVzLS07XG5cbiAgICAgIGlmICghc2VsZi5vdXRzdGFuZGluZ193cml0ZXMpIHtcbiAgICAgICAgc2VsZi5maXJlZCA9IHRydWU7XG4gICAgICAgIHZhciBjYWxsYmFja3MgPSBzZWxmLmNvbXBsZXRpb25fY2FsbGJhY2tzO1xuICAgICAgICBzZWxmLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gICAgICAgIF8uZWFjaChjYWxsYmFja3MsIGludm9rZUNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gRGVhY3RpdmF0ZSB0aGlzIGZlbmNlIHNvIHRoYXQgYWRkaW5nIG1vcmUgd3JpdGVzIGhhcyBubyBlZmZlY3QuXG4gIC8vIFRoZSBmZW5jZSBtdXN0IGhhdmUgYWxyZWFkeSBmaXJlZC5cbiAgcmV0aXJlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghIHNlbGYuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZXRpcmUgYSBmZW5jZSB0aGF0IGhhc24ndCBmaXJlZC5cIik7XG4gICAgc2VsZi5yZXRpcmVkID0gdHJ1ZTtcbiAgfVxufSk7XG4iLCIvLyBBIFwiY3Jvc3NiYXJcIiBpcyBhIGNsYXNzIHRoYXQgcHJvdmlkZXMgc3RydWN0dXJlZCBub3RpZmljYXRpb24gcmVnaXN0cmF0aW9uLlxuLy8gU2VlIF9tYXRjaCBmb3IgdGhlIGRlZmluaXRpb24gb2YgaG93IGEgbm90aWZpY2F0aW9uIG1hdGNoZXMgYSB0cmlnZ2VyLlxuLy8gQWxsIG5vdGlmaWNhdGlvbnMgYW5kIHRyaWdnZXJzIG11c3QgaGF2ZSBhIHN0cmluZyBrZXkgbmFtZWQgJ2NvbGxlY3Rpb24nLlxuXG5ERFBTZXJ2ZXIuX0Nyb3NzYmFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBzZWxmLm5leHRJZCA9IDE7XG4gIC8vIG1hcCBmcm9tIGNvbGxlY3Rpb24gbmFtZSAoc3RyaW5nKSAtPiBsaXN0ZW5lciBpZCAtPiBvYmplY3QuIGVhY2ggb2JqZWN0IGhhc1xuICAvLyBrZXlzICd0cmlnZ2VyJywgJ2NhbGxiYWNrJy4gIEFzIGEgaGFjaywgdGhlIGVtcHR5IHN0cmluZyBtZWFucyBcIm5vXG4gIC8vIGNvbGxlY3Rpb25cIi5cbiAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudCA9IHt9O1xuICBzZWxmLmZhY3RQYWNrYWdlID0gb3B0aW9ucy5mYWN0UGFja2FnZSB8fCBcImxpdmVkYXRhXCI7XG4gIHNlbGYuZmFjdE5hbWUgPSBvcHRpb25zLmZhY3ROYW1lIHx8IG51bGw7XG59O1xuXG5fLmV4dGVuZChERFBTZXJ2ZXIuX0Nyb3NzYmFyLnByb3RvdHlwZSwge1xuICAvLyBtc2cgaXMgYSB0cmlnZ2VyIG9yIGEgbm90aWZpY2F0aW9uXG4gIF9jb2xsZWN0aW9uRm9yTWVzc2FnZTogZnVuY3Rpb24gKG1zZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoISBfLmhhcyhtc2csICdjb2xsZWN0aW9uJykpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZihtc2cuY29sbGVjdGlvbikgPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZiAobXNnLmNvbGxlY3Rpb24gPT09ICcnKVxuICAgICAgICB0aHJvdyBFcnJvcihcIk1lc3NhZ2UgaGFzIGVtcHR5IGNvbGxlY3Rpb24hXCIpO1xuICAgICAgcmV0dXJuIG1zZy5jb2xsZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihcIk1lc3NhZ2UgaGFzIG5vbi1zdHJpbmcgY29sbGVjdGlvbiFcIik7XG4gICAgfVxuICB9LFxuXG4gIC8vIExpc3RlbiBmb3Igbm90aWZpY2F0aW9uIHRoYXQgbWF0Y2ggJ3RyaWdnZXInLiBBIG5vdGlmaWNhdGlvblxuICAvLyBtYXRjaGVzIGlmIGl0IGhhcyB0aGUga2V5LXZhbHVlIHBhaXJzIGluIHRyaWdnZXIgYXMgYVxuICAvLyBzdWJzZXQuIFdoZW4gYSBub3RpZmljYXRpb24gbWF0Y2hlcywgY2FsbCAnY2FsbGJhY2snLCBwYXNzaW5nXG4gIC8vIHRoZSBhY3R1YWwgbm90aWZpY2F0aW9uLlxuICAvL1xuICAvLyBSZXR1cm5zIGEgbGlzdGVuIGhhbmRsZSwgd2hpY2ggaXMgYW4gb2JqZWN0IHdpdGggYSBtZXRob2RcbiAgLy8gc3RvcCgpLiBDYWxsIHN0b3AoKSB0byBzdG9wIGxpc3RlbmluZy5cbiAgLy9cbiAgLy8gWFhYIEl0IHNob3VsZCBiZSBsZWdhbCB0byBjYWxsIGZpcmUoKSBmcm9tIGluc2lkZSBhIGxpc3RlbigpXG4gIC8vIGNhbGxiYWNrP1xuICBsaXN0ZW46IGZ1bmN0aW9uICh0cmlnZ2VyLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgaWQgPSBzZWxmLm5leHRJZCsrO1xuXG4gICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jb2xsZWN0aW9uRm9yTWVzc2FnZSh0cmlnZ2VyKTtcbiAgICB2YXIgcmVjb3JkID0ge3RyaWdnZXI6IEVKU09OLmNsb25lKHRyaWdnZXIpLCBjYWxsYmFjazogY2FsbGJhY2t9O1xuICAgIGlmICghIF8uaGFzKHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uLCBjb2xsZWN0aW9uKSkge1xuICAgICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl0gPSB7fTtcbiAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0gPSAwO1xuICAgIH1cbiAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXVtpZF0gPSByZWNvcmQ7XG4gICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXSsrO1xuXG4gICAgaWYgKHNlbGYuZmFjdE5hbWUgJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddKSB7XG4gICAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgc2VsZi5mYWN0UGFja2FnZSwgc2VsZi5mYWN0TmFtZSwgMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNlbGYuZmFjdE5hbWUgJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddKSB7XG4gICAgICAgICAgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgICAgICBzZWxmLmZhY3RQYWNrYWdlLCBzZWxmLmZhY3ROYW1lLCAtMSk7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dW2lkXTtcbiAgICAgICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXS0tO1xuICAgICAgICBpZiAoc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXSA9PT0gMCkge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXTtcbiAgICAgICAgICBkZWxldGUgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudFtjb2xsZWN0aW9uXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH0sXG5cbiAgLy8gRmlyZSB0aGUgcHJvdmlkZWQgJ25vdGlmaWNhdGlvbicgKGFuIG9iamVjdCB3aG9zZSBhdHRyaWJ1dGVcbiAgLy8gdmFsdWVzIGFyZSBhbGwgSlNPTi1jb21wYXRpYmlsZSkgLS0gaW5mb3JtIGFsbCBtYXRjaGluZyBsaXN0ZW5lcnNcbiAgLy8gKHJlZ2lzdGVyZWQgd2l0aCBsaXN0ZW4oKSkuXG4gIC8vXG4gIC8vIElmIGZpcmUoKSBpcyBjYWxsZWQgaW5zaWRlIGEgd3JpdGUgZmVuY2UsIHRoZW4gZWFjaCBvZiB0aGVcbiAgLy8gbGlzdGVuZXIgY2FsbGJhY2tzIHdpbGwgYmUgY2FsbGVkIGluc2lkZSB0aGUgd3JpdGUgZmVuY2UgYXMgd2VsbC5cbiAgLy9cbiAgLy8gVGhlIGxpc3RlbmVycyBtYXkgYmUgaW52b2tlZCBpbiBwYXJhbGxlbCwgcmF0aGVyIHRoYW4gc2VyaWFsbHkuXG4gIGZpcmU6IGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYuX2NvbGxlY3Rpb25Gb3JNZXNzYWdlKG5vdGlmaWNhdGlvbik7XG5cbiAgICBpZiAoISBfLmhhcyhzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiwgY29sbGVjdGlvbikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbiA9IHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dO1xuICAgIHZhciBjYWxsYmFja0lkcyA9IFtdO1xuICAgIF8uZWFjaChsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLCBmdW5jdGlvbiAobCwgaWQpIHtcbiAgICAgIGlmIChzZWxmLl9tYXRjaGVzKG5vdGlmaWNhdGlvbiwgbC50cmlnZ2VyKSkge1xuICAgICAgICBjYWxsYmFja0lkcy5wdXNoKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExpc3RlbmVyIGNhbGxiYWNrcyBjYW4geWllbGQsIHNvIHdlIG5lZWQgdG8gZmlyc3QgZmluZCBhbGwgdGhlIG9uZXMgdGhhdFxuICAgIC8vIG1hdGNoIGluIGEgc2luZ2xlIGl0ZXJhdGlvbiBvdmVyIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uICh3aGljaCBjYW4ndFxuICAgIC8vIGJlIG11dGF0ZWQgZHVyaW5nIHRoaXMgaXRlcmF0aW9uKSwgYW5kIHRoZW4gaW52b2tlIHRoZSBtYXRjaGluZ1xuICAgIC8vIGNhbGxiYWNrcywgY2hlY2tpbmcgYmVmb3JlIGVhY2ggY2FsbCB0byBlbnN1cmUgdGhleSBoYXZlbid0IHN0b3BwZWQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IGhhdmUgdG8gY2hlY2sgdGhhdFxuICAgIC8vIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dIHN0aWxsID09PSBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLFxuICAgIC8vIGJlY2F1c2UgdGhlIG9ubHkgd2F5IHRoYXQgc3RvcHMgYmVpbmcgdHJ1ZSBpcyBpZiBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uXG4gICAgLy8gZmlyc3QgZ2V0cyByZWR1Y2VkIGRvd24gdG8gdGhlIGVtcHR5IG9iamVjdCAoYW5kIHRoZW4gbmV2ZXIgZ2V0c1xuICAgIC8vIGluY3JlYXNlZCBhZ2FpbikuXG4gICAgXy5lYWNoKGNhbGxiYWNrSWRzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgIGlmIChfLmhhcyhsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLCBpZCkpIHtcbiAgICAgICAgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbltpZF0uY2FsbGJhY2sobm90aWZpY2F0aW9uKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLyBBIG5vdGlmaWNhdGlvbiBtYXRjaGVzIGEgdHJpZ2dlciBpZiBhbGwga2V5cyB0aGF0IGV4aXN0IGluIGJvdGggYXJlIGVxdWFsLlxuICAvL1xuICAvLyBFeGFtcGxlczpcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wifSBtYXRjaGVzIFQ6e2NvbGxlY3Rpb246IFwiQ1wifVxuICAvLyAgICAoYSBub24tdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYVxuICAvLyAgICAgbm9uLXRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIn1cbiAgLy8gICAgKGEgdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYSBub24tdGFyZ2V0ZWQgcXVlcnkpXG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifVxuICAvLyAgICAoYSBub24tdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIG1hdGNoZXMgYVxuICAvLyAgICAgdGFyZ2V0ZWQgcXVlcnkpXG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifSBtYXRjaGVzIFQ6e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGEgdGFyZ2V0ZWQgcXVlcnkgdGFyZ2V0ZWRcbiAgLy8gICAgIGF0IHRoZSBzYW1lIGRvY3VtZW50KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gZG9lcyBub3QgbWF0Y2ggVDp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIllcIn1cbiAgLy8gICAgKGEgdGFyZ2V0ZWQgd3JpdGUgdG8gYSBjb2xsZWN0aW9uIGRvZXMgbm90IG1hdGNoIGEgdGFyZ2V0ZWQgcXVlcnlcbiAgLy8gICAgIHRhcmdldGVkIGF0IGEgZGlmZmVyZW50IGRvY3VtZW50KVxuICBfbWF0Y2hlczogZnVuY3Rpb24gKG5vdGlmaWNhdGlvbiwgdHJpZ2dlcikge1xuICAgIC8vIE1vc3Qgbm90aWZpY2F0aW9ucyB0aGF0IHVzZSB0aGUgY3Jvc3NiYXIgaGF2ZSBhIHN0cmluZyBgY29sbGVjdGlvbmAgYW5kXG4gICAgLy8gbWF5YmUgYW4gYGlkYCB0aGF0IGlzIGEgc3RyaW5nIG9yIE9iamVjdElELiBXZSdyZSBhbHJlYWR5IGRpdmlkaW5nIHVwXG4gICAgLy8gdHJpZ2dlcnMgYnkgY29sbGVjdGlvbiwgYnV0IGxldCdzIGZhc3QtdHJhY2sgXCJub3BlLCBkaWZmZXJlbnQgSURcIiAoYW5kXG4gICAgLy8gYXZvaWQgdGhlIG92ZXJseSBnZW5lcmljIEVKU09OLmVxdWFscykuIFRoaXMgbWFrZXMgYSBub3RpY2VhYmxlXG4gICAgLy8gcGVyZm9ybWFuY2UgZGlmZmVyZW5jZTsgc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMzY5N1xuICAgIGlmICh0eXBlb2Yobm90aWZpY2F0aW9uLmlkKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgdHlwZW9mKHRyaWdnZXIuaWQpID09PSAnc3RyaW5nJyAmJlxuICAgICAgICBub3RpZmljYXRpb24uaWQgIT09IHRyaWdnZXIuaWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKG5vdGlmaWNhdGlvbi5pZCBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQgJiZcbiAgICAgICAgdHJpZ2dlci5pZCBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQgJiZcbiAgICAgICAgISBub3RpZmljYXRpb24uaWQuZXF1YWxzKHRyaWdnZXIuaWQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIF8uYWxsKHRyaWdnZXIsIGZ1bmN0aW9uICh0cmlnZ2VyVmFsdWUsIGtleSkge1xuICAgICAgcmV0dXJuICFfLmhhcyhub3RpZmljYXRpb24sIGtleSkgfHxcbiAgICAgICAgRUpTT04uZXF1YWxzKHRyaWdnZXJWYWx1ZSwgbm90aWZpY2F0aW9uW2tleV0pO1xuICAgIH0pO1xuICB9XG59KTtcblxuLy8gVGhlIFwiaW52YWxpZGF0aW9uIGNyb3NzYmFyXCIgaXMgYSBzcGVjaWZpYyBpbnN0YW5jZSB1c2VkIGJ5IHRoZSBERFAgc2VydmVyIHRvXG4vLyBpbXBsZW1lbnQgd3JpdGUgZmVuY2Ugbm90aWZpY2F0aW9ucy4gTGlzdGVuZXIgY2FsbGJhY2tzIG9uIHRoaXMgY3Jvc3NiYXJcbi8vIHNob3VsZCBjYWxsIGJlZ2luV3JpdGUgb24gdGhlIGN1cnJlbnQgd3JpdGUgZmVuY2UgYmVmb3JlIHRoZXkgcmV0dXJuLCBpZiB0aGV5XG4vLyB3YW50IHRvIGRlbGF5IHRoZSB3cml0ZSBmZW5jZSBmcm9tIGZpcmluZyAoaWUsIHRoZSBERFAgbWV0aG9kLWRhdGEtdXBkYXRlZFxuLy8gbWVzc2FnZSBmcm9tIGJlaW5nIHNlbnQpLlxuRERQU2VydmVyLl9JbnZhbGlkYXRpb25Dcm9zc2JhciA9IG5ldyBERFBTZXJ2ZXIuX0Nyb3NzYmFyKHtcbiAgZmFjdE5hbWU6IFwiaW52YWxpZGF0aW9uLWNyb3NzYmFyLWxpc3RlbmVyc1wiXG59KTtcbiIsImlmIChwcm9jZXNzLmVudi5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCkge1xuICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMID1cbiAgICBwcm9jZXNzLmVudi5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTDtcbn1cblxuTWV0ZW9yLnNlcnZlciA9IG5ldyBTZXJ2ZXI7XG5cbk1ldGVvci5yZWZyZXNoID0gZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICBERFBTZXJ2ZXIuX0ludmFsaWRhdGlvbkNyb3NzYmFyLmZpcmUobm90aWZpY2F0aW9uKTtcbn07XG5cbi8vIFByb3h5IHRoZSBwdWJsaWMgbWV0aG9kcyBvZiBNZXRlb3Iuc2VydmVyIHNvIHRoZXkgY2FuXG4vLyBiZSBjYWxsZWQgZGlyZWN0bHkgb24gTWV0ZW9yLlxuXy5lYWNoKFxuICBbXG4gICAgJ3B1Ymxpc2gnLFxuICAgICdtZXRob2RzJyxcbiAgICAnY2FsbCcsXG4gICAgJ2NhbGxBc3luYycsXG4gICAgJ2FwcGx5JyxcbiAgICAnYXBwbHlBc3luYycsXG4gICAgJ29uQ29ubmVjdGlvbicsXG4gICAgJ29uTWVzc2FnZScsXG4gIF0sXG4gIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBNZXRlb3JbbmFtZV0gPSBfLmJpbmQoTWV0ZW9yLnNlcnZlcltuYW1lXSwgTWV0ZW9yLnNlcnZlcik7XG4gIH1cbik7XG4iXX0=
