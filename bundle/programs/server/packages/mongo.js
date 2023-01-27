(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var NpmModuleMongodb = Package['npm-mongo'].NpmModuleMongodb;
var NpmModuleMongodbVersion = Package['npm-mongo'].NpmModuleMongodbVersion;
var AllowDeny = Package['allow-deny'].AllowDeny;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var Decimal = Package['mongo-decimal'].Decimal;
var _ = Package.underscore._;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinHeap = Package['binary-heap'].MinHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MongoInternals, MongoConnection, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, ObserveHandle, PollingObserveDriver, OplogObserveDriver, Mongo, _ref, field, value, selector, callback, options;

var require = meteorInstall({"node_modules":{"meteor":{"mongo":{"mongo_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_driver.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  let _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default(v) {
      _objectSpread = v;
    }
  }, 0);
  let normalizeProjection;
  module1.link("./mongo_utils", {
    normalizeProjection(v) {
      normalizeProjection = v;
    }
  }, 0);
  let DocFetcher;
  module1.link("./doc_fetcher.js", {
    DocFetcher(v) {
      DocFetcher = v;
    }
  }, 1);
  let ASYNC_CURSOR_METHODS, getAsyncMethodName;
  module1.link("meteor/minimongo/constants", {
    ASYNC_CURSOR_METHODS(v) {
      ASYNC_CURSOR_METHODS = v;
    },
    getAsyncMethodName(v) {
      getAsyncMethodName = v;
    }
  }, 2);
  /**
   * Provide a synchronous Collection API using fibers, backed by
   * MongoDB.  This is only for use on the server, and mostly identical
   * to the client API.
   *
   * NOTE: the public API methods must be run within a fiber. If you call
   * these outside of a fiber they will explode!
   */

  const path = require("path");
  const util = require("util");

  /** @type {import('mongodb')} */
  var MongoDB = NpmModuleMongodb;
  var Future = Npm.require('fibers/future');
  MongoInternals = {};
  MongoInternals.NpmModules = {
    mongodb: {
      version: NpmModuleMongodbVersion,
      module: MongoDB
    }
  };

  // Older version of what is now available via
  // MongoInternals.NpmModules.mongodb.module.  It was never documented, but
  // people do use it.
  // XXX COMPAT WITH 1.0.3.2
  MongoInternals.NpmModule = MongoDB;
  const FILE_ASSET_SUFFIX = 'Asset';
  const ASSETS_FOLDER = 'assets';
  const APP_FOLDER = 'app';

  // This is used to add or remove EJSON from the beginning of everything nested
  // inside an EJSON custom type. It should only be called on pure JSON!
  var replaceNames = function (filter, thing) {
    if (typeof thing === "object" && thing !== null) {
      if (_.isArray(thing)) {
        return _.map(thing, _.bind(replaceNames, null, filter));
      }
      var ret = {};
      _.each(thing, function (value, key) {
        ret[filter(key)] = replaceNames(filter, value);
      });
      return ret;
    }
    return thing;
  };

  // Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
  // doing a structural clone).
  // XXX how ok is this? what if there are multiple copies of MongoDB loaded?
  MongoDB.Timestamp.prototype.clone = function () {
    // Timestamps should be immutable.
    return this;
  };
  var makeMongoLegal = function (name) {
    return "EJSON" + name;
  };
  var unmakeMongoLegal = function (name) {
    return name.substr(5);
  };
  var replaceMongoAtomWithMeteor = function (document) {
    if (document instanceof MongoDB.Binary) {
      // for backwards compatibility
      if (document.sub_type !== 0) {
        return document;
      }
      var buffer = document.value(true);
      return new Uint8Array(buffer);
    }
    if (document instanceof MongoDB.ObjectID) {
      return new Mongo.ObjectID(document.toHexString());
    }
    if (document instanceof MongoDB.Decimal128) {
      return Decimal(document.toString());
    }
    if (document["EJSON$type"] && document["EJSON$value"] && _.size(document) === 2) {
      return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));
    }
    if (document instanceof MongoDB.Timestamp) {
      // For now, the Meteor representation of a Mongo timestamp type (not a date!
      // this is a weird internal thing used in the oplog!) is the same as the
      // Mongo representation. We need to do this explicitly or else we would do a
      // structural clone and lose the prototype.
      return document;
    }
    return undefined;
  };
  var replaceMeteorAtomWithMongo = function (document) {
    if (EJSON.isBinary(document)) {
      // This does more copies than we'd like, but is necessary because
      // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
      // serialize it correctly).
      return new MongoDB.Binary(Buffer.from(document));
    }
    if (document instanceof MongoDB.Binary) {
      return document;
    }
    if (document instanceof Mongo.ObjectID) {
      return new MongoDB.ObjectID(document.toHexString());
    }
    if (document instanceof MongoDB.Timestamp) {
      // For now, the Meteor representation of a Mongo timestamp type (not a date!
      // this is a weird internal thing used in the oplog!) is the same as the
      // Mongo representation. We need to do this explicitly or else we would do a
      // structural clone and lose the prototype.
      return document;
    }
    if (document instanceof Decimal) {
      return MongoDB.Decimal128.fromString(document.toString());
    }
    if (EJSON._isCustomType(document)) {
      return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));
    }
    // It is not ordinarily possible to stick dollar-sign keys into mongo
    // so we don't bother checking for things that need escaping at this time.
    return undefined;
  };
  var replaceTypes = function (document, atomTransformer) {
    if (typeof document !== 'object' || document === null) return document;
    var replacedTopLevelAtom = atomTransformer(document);
    if (replacedTopLevelAtom !== undefined) return replacedTopLevelAtom;
    var ret = document;
    _.each(document, function (val, key) {
      var valReplaced = replaceTypes(val, atomTransformer);
      if (val !== valReplaced) {
        // Lazy clone. Shallow copy.
        if (ret === document) ret = _.clone(document);
        ret[key] = valReplaced;
      }
    });
    return ret;
  };
  MongoConnection = function (url, options) {
    var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
    var self = this;
    options = options || {};
    self._observeMultiplexers = {};
    self._onFailoverHook = new Hook();
    const userOptions = _objectSpread(_objectSpread({}, Mongo._connectionOptions || {}), ((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.options) || {});
    var mongoOptions = Object.assign({
      ignoreUndefined: true
    }, userOptions);

    // Internally the oplog connections specify their own maxPoolSize
    // which we don't want to overwrite with any user defined value
    if (_.has(options, 'maxPoolSize')) {
      // If we just set this for "server", replSet will override it. If we just
      // set it for replSet, it will be ignored if we're not using a replSet.
      mongoOptions.maxPoolSize = options.maxPoolSize;
    }

    // Transform options like "tlsCAFileAsset": "filename.pem" into
    // "tlsCAFile": "/<fullpath>/filename.pem"
    Object.entries(mongoOptions || {}).filter(_ref => {
      let [key] = _ref;
      return key && key.endsWith(FILE_ASSET_SUFFIX);
    }).forEach(_ref2 => {
      let [key, value] = _ref2;
      const optionName = key.replace(FILE_ASSET_SUFFIX, '');
      mongoOptions[optionName] = path.join(Assets.getServerDir(), ASSETS_FOLDER, APP_FOLDER, value);
      delete mongoOptions[key];
    });
    self.db = null;
    self._oplogHandle = null;
    self._docFetcher = null;
    self.client = new MongoDB.MongoClient(url, mongoOptions);
    self.db = self.client.db();
    self.client.on('serverDescriptionChanged', Meteor.bindEnvironment(event => {
      // When the connection is no longer against the primary node, execute all
      // failover hooks. This is important for the driver as it has to re-pool the
      // query when it happens.
      if (event.previousDescription.type !== 'RSPrimary' && event.newDescription.type === 'RSPrimary') {
        self._onFailoverHook.each(callback => {
          callback();
          return true;
        });
      }
    }));
    if (options.oplogUrl && !Package['disable-oplog']) {
      self._oplogHandle = new OplogHandle(options.oplogUrl, self.db.databaseName);
      self._docFetcher = new DocFetcher(self);
    }
  };
  MongoConnection.prototype.close = function () {
    var self = this;
    if (!self.db) throw Error("close called before Connection created?");

    // XXX probably untested
    var oplogHandle = self._oplogHandle;
    self._oplogHandle = null;
    if (oplogHandle) oplogHandle.stop();

    // Use Future.wrap so that errors get thrown. This happens to
    // work even outside a fiber since the 'close' method is not
    // actually asynchronous.
    Future.wrap(_.bind(self.client.close, self.client))(true).wait();
  };

  // Returns the Mongo Collection object; may yield.
  MongoConnection.prototype.rawCollection = function (collectionName) {
    var self = this;
    if (!self.db) throw Error("rawCollection called before Connection created?");
    return self.db.collection(collectionName);
  };
  MongoConnection.prototype._createCappedCollection = function (collectionName, byteSize, maxDocuments) {
    var self = this;
    if (!self.db) throw Error("_createCappedCollection called before Connection created?");
    var future = new Future();
    self.db.createCollection(collectionName, {
      capped: true,
      size: byteSize,
      max: maxDocuments
    }, future.resolver());
    future.wait();
  };

  // This should be called synchronously with a write, to create a
  // transaction on the current write fence, if any. After we can read
  // the write, and after observers have been notified (or at least,
  // after the observer notifiers have added themselves to the write
  // fence), you should call 'committed()' on the object returned.
  MongoConnection.prototype._maybeBeginWrite = function () {
    var fence = DDPServer._CurrentWriteFence.get();
    if (fence) {
      return fence.beginWrite();
    } else {
      return {
        committed: function () {}
      };
    }
  };

  // Internal interface: adds a callback which is called when the Mongo primary
  // changes. Returns a stop handle.
  MongoConnection.prototype._onFailover = function (callback) {
    return this._onFailoverHook.register(callback);
  };

  //////////// Public API //////////

  // The write methods block until the database has confirmed the write (it may
  // not be replicated or stable on disk, but one server has confirmed it) if no
  // callback is provided. If a callback is provided, then they call the callback
  // when the write is confirmed. They return nothing on success, and raise an
  // exception on failure.
  //
  // After making a write (with insert, update, remove), observers are
  // notified asynchronously. If you want to receive a callback once all
  // of the observer notifications have landed for your write, do the
  // writes inside a write fence (set DDPServer._CurrentWriteFence to a new
  // _WriteFence, and then set a callback on the write fence.)
  //
  // Since our execution environment is single-threaded, this is
  // well-defined -- a write "has been made" if it's returned, and an
  // observer "has been notified" if its callback has returned.

  var writeCallback = function (write, refresh, callback) {
    return function (err, result) {
      if (!err) {
        // XXX We don't have to run this on error, right?
        try {
          refresh();
        } catch (refreshErr) {
          if (callback) {
            callback(refreshErr);
            return;
          } else {
            throw refreshErr;
          }
        }
      }
      write.committed();
      if (callback) {
        callback(err, result);
      } else if (err) {
        throw err;
      }
    };
  };
  var bindEnvironmentForWrite = function (callback) {
    return Meteor.bindEnvironment(callback, "Mongo write");
  };
  MongoConnection.prototype._insert = function (collection_name, document, callback) {
    var self = this;
    var sendError = function (e) {
      if (callback) return callback(e);
      throw e;
    };
    if (collection_name === "___meteor_failure_test_collection") {
      var e = new Error("Failure test");
      e._expectedByTest = true;
      sendError(e);
      return;
    }
    if (!(LocalCollection._isPlainObject(document) && !EJSON._isCustomType(document))) {
      sendError(new Error("Only plain objects may be inserted into MongoDB"));
      return;
    }
    var write = self._maybeBeginWrite();
    var refresh = function () {
      Meteor.refresh({
        collection: collection_name,
        id: document._id
      });
    };
    callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));
    try {
      var collection = self.rawCollection(collection_name);
      collection.insertOne(replaceTypes(document, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(_ref3 => {
        let {
          insertedId
        } = _ref3;
        callback(null, insertedId);
      }).catch(e => {
        callback(e, null);
      });
    } catch (err) {
      write.committed();
      throw err;
    }
  };

  // Cause queries that may be affected by the selector to poll in this write
  // fence.
  MongoConnection.prototype._refresh = function (collectionName, selector) {
    var refreshKey = {
      collection: collectionName
    };
    // If we know which documents we're removing, don't poll queries that are
    // specific to other documents. (Note that multiple notifications here should
    // not cause multiple polls, since all our listener is doing is enqueueing a
    // poll.)
    var specificIds = LocalCollection._idsMatchedBySelector(selector);
    if (specificIds) {
      _.each(specificIds, function (id) {
        Meteor.refresh(_.extend({
          id: id
        }, refreshKey));
      });
    } else {
      Meteor.refresh(refreshKey);
    }
  };
  MongoConnection.prototype._remove = function (collection_name, selector, callback) {
    var self = this;
    if (collection_name === "___meteor_failure_test_collection") {
      var e = new Error("Failure test");
      e._expectedByTest = true;
      if (callback) {
        return callback(e);
      } else {
        throw e;
      }
    }
    var write = self._maybeBeginWrite();
    var refresh = function () {
      self._refresh(collection_name, selector);
    };
    callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));
    try {
      var collection = self.rawCollection(collection_name);
      collection.deleteMany(replaceTypes(selector, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(_ref4 => {
        let {
          deletedCount
        } = _ref4;
        callback(null, transformResult({
          result: {
            modifiedCount: deletedCount
          }
        }).numberAffected);
      }).catch(err => {
        callback(err);
      });
    } catch (err) {
      write.committed();
      throw err;
    }
  };
  MongoConnection.prototype._dropCollection = function (collectionName, cb) {
    var self = this;
    var write = self._maybeBeginWrite();
    var refresh = function () {
      Meteor.refresh({
        collection: collectionName,
        id: null,
        dropCollection: true
      });
    };
    cb = bindEnvironmentForWrite(writeCallback(write, refresh, cb));
    try {
      var collection = self.rawCollection(collectionName);
      collection.drop(cb);
    } catch (e) {
      write.committed();
      throw e;
    }
  };

  // For testing only.  Slightly better than `c.rawDatabase().dropDatabase()`
  // because it lets the test's fence wait for it to be complete.
  MongoConnection.prototype._dropDatabase = function (cb) {
    var self = this;
    var write = self._maybeBeginWrite();
    var refresh = function () {
      Meteor.refresh({
        dropDatabase: true
      });
    };
    cb = bindEnvironmentForWrite(writeCallback(write, refresh, cb));
    try {
      self.db.dropDatabase(cb);
    } catch (e) {
      write.committed();
      throw e;
    }
  };
  MongoConnection.prototype._update = function (collection_name, selector, mod, options, callback) {
    var self = this;
    if (!callback && options instanceof Function) {
      callback = options;
      options = null;
    }
    if (collection_name === "___meteor_failure_test_collection") {
      var e = new Error("Failure test");
      e._expectedByTest = true;
      if (callback) {
        return callback(e);
      } else {
        throw e;
      }
    }

    // explicit safety check. null and undefined can crash the mongo
    // driver. Although the node driver and minimongo do 'support'
    // non-object modifier in that they don't crash, they are not
    // meaningful operations and do not do anything. Defensively throw an
    // error here.
    if (!mod || typeof mod !== 'object') throw new Error("Invalid modifier. Modifier must be an object.");
    if (!(LocalCollection._isPlainObject(mod) && !EJSON._isCustomType(mod))) {
      throw new Error("Only plain objects may be used as replacement" + " documents in MongoDB");
    }
    if (!options) options = {};
    var write = self._maybeBeginWrite();
    var refresh = function () {
      self._refresh(collection_name, selector);
    };
    callback = writeCallback(write, refresh, callback);
    try {
      var collection = self.rawCollection(collection_name);
      var mongoOpts = {
        safe: true
      };
      // Add support for filtered positional operator
      if (options.arrayFilters !== undefined) mongoOpts.arrayFilters = options.arrayFilters;
      // explictly enumerate options that minimongo supports
      if (options.upsert) mongoOpts.upsert = true;
      if (options.multi) mongoOpts.multi = true;
      // Lets you get a more more full result from MongoDB. Use with caution:
      // might not work with C.upsert (as opposed to C.update({upsert:true}) or
      // with simulated upsert.
      if (options.fullResult) mongoOpts.fullResult = true;
      var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);
      var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);
      var isModify = LocalCollection._isModificationMod(mongoMod);
      if (options._forbidReplace && !isModify) {
        var err = new Error("Invalid modifier. Replacements are forbidden.");
        if (callback) {
          return callback(err);
        } else {
          throw err;
        }
      }

      // We've already run replaceTypes/replaceMeteorAtomWithMongo on
      // selector and mod.  We assume it doesn't matter, as far as
      // the behavior of modifiers is concerned, whether `_modify`
      // is run on EJSON or on mongo-converted EJSON.

      // Run this code up front so that it fails fast if someone uses
      // a Mongo update operator we don't support.
      let knownId;
      if (options.upsert) {
        try {
          let newDoc = LocalCollection._createUpsertDocument(selector, mod);
          knownId = newDoc._id;
        } catch (err) {
          if (callback) {
            return callback(err);
          } else {
            throw err;
          }
        }
      }
      if (options.upsert && !isModify && !knownId && options.insertedId && !(options.insertedId instanceof Mongo.ObjectID && options.generatedId)) {
        // In case of an upsert with a replacement, where there is no _id defined
        // in either the query or the replacement doc, mongo will generate an id itself.
        // Therefore we need this special strategy if we want to control the id ourselves.

        // We don't need to do this when:
        // - This is not a replacement, so we can add an _id to $setOnInsert
        // - The id is defined by query or mod we can just add it to the replacement doc
        // - The user did not specify any id preference and the id is a Mongo ObjectId,
        //     then we can just let Mongo generate the id

        simulateUpsertWithInsertedId(collection, mongoSelector, mongoMod, options,
        // This callback does not need to be bindEnvironment'ed because
        // simulateUpsertWithInsertedId() wraps it and then passes it through
        // bindEnvironmentForWrite.
        function (error, result) {
          // If we got here via a upsert() call, then options._returnObject will
          // be set and we should return the whole object. Otherwise, we should
          // just return the number of affected docs to match the mongo API.
          if (result && !options._returnObject) {
            callback(error, result.numberAffected);
          } else {
            callback(error, result);
          }
        });
      } else {
        if (options.upsert && !knownId && options.insertedId && isModify) {
          if (!mongoMod.hasOwnProperty('$setOnInsert')) {
            mongoMod.$setOnInsert = {};
          }
          knownId = options.insertedId;
          Object.assign(mongoMod.$setOnInsert, replaceTypes({
            _id: options.insertedId
          }, replaceMeteorAtomWithMongo));
        }
        const strings = Object.keys(mongoMod).filter(key => !key.startsWith("$"));
        let updateMethod = strings.length > 0 ? 'replaceOne' : 'updateMany';
        updateMethod = updateMethod === 'updateMany' && !mongoOpts.multi ? 'updateOne' : updateMethod;
        collection[updateMethod].bind(collection)(mongoSelector, mongoMod, mongoOpts,
        // mongo driver now returns undefined for err in the callback
        bindEnvironmentForWrite(function () {
          let err = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
          let result = arguments.length > 1 ? arguments[1] : undefined;
          if (!err) {
            var meteorResult = transformResult({
              result
            });
            if (meteorResult && options._returnObject) {
              // If this was an upsert() call, and we ended up
              // inserting a new doc and we know its id, then
              // return that id as well.
              if (options.upsert && meteorResult.insertedId) {
                if (knownId) {
                  meteorResult.insertedId = knownId;
                } else if (meteorResult.insertedId instanceof MongoDB.ObjectID) {
                  meteorResult.insertedId = new Mongo.ObjectID(meteorResult.insertedId.toHexString());
                }
              }
              callback(err, meteorResult);
            } else {
              callback(err, meteorResult.numberAffected);
            }
          } else {
            callback(err);
          }
        }));
      }
    } catch (e) {
      write.committed();
      throw e;
    }
  };
  var transformResult = function (driverResult) {
    var meteorResult = {
      numberAffected: 0
    };
    if (driverResult) {
      var mongoResult = driverResult.result;
      // On updates with upsert:true, the inserted values come as a list of
      // upserted values -- even with options.multi, when the upsert does insert,
      // it only inserts one element.
      if (mongoResult.upsertedCount) {
        meteorResult.numberAffected = mongoResult.upsertedCount;
        if (mongoResult.upsertedId) {
          meteorResult.insertedId = mongoResult.upsertedId;
        }
      } else {
        // n was used before Mongo 5.0, in Mongo 5.0 we are not receiving this n
        // field and so we are using modifiedCount instead
        meteorResult.numberAffected = mongoResult.n || mongoResult.matchedCount || mongoResult.modifiedCount;
      }
    }
    return meteorResult;
  };
  var NUM_OPTIMISTIC_TRIES = 3;

  // exposed for testing
  MongoConnection._isCannotChangeIdError = function (err) {
    // Mongo 3.2.* returns error as next Object:
    // {name: String, code: Number, errmsg: String}
    // Older Mongo returns:
    // {name: String, code: Number, err: String}
    var error = err.errmsg || err.err;

    // We don't use the error code here
    // because the error code we observed it producing (16837) appears to be
    // a far more generic error code based on examining the source.
    if (error.indexOf('The _id field cannot be changed') === 0 || error.indexOf("the (immutable) field '_id' was found to have been altered to _id") !== -1) {
      return true;
    }
    return false;
  };
  var simulateUpsertWithInsertedId = function (collection, selector, mod, options, callback) {
    // STRATEGY: First try doing an upsert with a generated ID.
    // If this throws an error about changing the ID on an existing document
    // then without affecting the database, we know we should probably try
    // an update without the generated ID. If it affected 0 documents,
    // then without affecting the database, we the document that first
    // gave the error is probably removed and we need to try an insert again
    // We go back to step one and repeat.
    // Like all "optimistic write" schemes, we rely on the fact that it's
    // unlikely our writes will continue to be interfered with under normal
    // circumstances (though sufficiently heavy contention with writers
    // disagreeing on the existence of an object will cause writes to fail
    // in theory).

    var insertedId = options.insertedId; // must exist
    var mongoOptsForUpdate = {
      safe: true,
      multi: options.multi
    };
    var mongoOptsForInsert = {
      safe: true,
      upsert: true
    };
    var replacementWithId = Object.assign(replaceTypes({
      _id: insertedId
    }, replaceMeteorAtomWithMongo), mod);
    var tries = NUM_OPTIMISTIC_TRIES;
    var doUpdate = function () {
      tries--;
      if (!tries) {
        callback(new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries."));
      } else {
        let method = collection.updateMany;
        if (!Object.keys(mod).some(key => key.startsWith("$"))) {
          method = collection.replaceOne.bind(collection);
        }
        method(selector, mod, mongoOptsForUpdate, bindEnvironmentForWrite(function (err, result) {
          if (err) {
            callback(err);
          } else if (result && (result.modifiedCount || result.upsertedCount)) {
            callback(null, {
              numberAffected: result.modifiedCount || result.upsertedCount,
              insertedId: result.upsertedId || undefined
            });
          } else {
            doConditionalInsert();
          }
        }));
      }
    };
    var doConditionalInsert = function () {
      collection.replaceOne(selector, replacementWithId, mongoOptsForInsert, bindEnvironmentForWrite(function (err, result) {
        if (err) {
          // figure out if this is a
          // "cannot change _id of document" error, and
          // if so, try doUpdate() again, up to 3 times.
          if (MongoConnection._isCannotChangeIdError(err)) {
            doUpdate();
          } else {
            callback(err);
          }
        } else {
          callback(null, {
            numberAffected: result.upsertedCount,
            insertedId: result.upsertedId
          });
        }
      }));
    };
    doUpdate();
  };
  _.each(["insert", "update", "remove", "dropCollection", "dropDatabase"], function (method) {
    MongoConnection.prototype[method] = function /* arguments */
    () {
      var self = this;
      return Meteor.wrapAsync(self["_" + method]).apply(self, arguments);
    };
  });

  // XXX MongoConnection.upsert() does not return the id of the inserted document
  // unless you set it explicitly in the selector or modifier (as a replacement
  // doc).
  MongoConnection.prototype.upsert = function (collectionName, selector, mod, options, callback) {
    var self = this;
    if (typeof options === "function" && !callback) {
      callback = options;
      options = {};
    }
    return self.update(collectionName, selector, mod, _.extend({}, options, {
      upsert: true,
      _returnObject: true
    }), callback);
  };
  MongoConnection.prototype.find = function (collectionName, selector, options) {
    var self = this;
    if (arguments.length === 1) selector = {};
    return new Cursor(self, new CursorDescription(collectionName, selector, options));
  };
  MongoConnection.prototype.findOne = function (collection_name, selector, options) {
    var self = this;
    if (arguments.length === 1) selector = {};
    options = options || {};
    options.limit = 1;
    return self.find(collection_name, selector, options).fetch()[0];
  };

  // We'll actually design an index API later. For now, we just pass through to
  // Mongo's, but make it synchronous.
  MongoConnection.prototype.createIndex = function (collectionName, index, options) {
    var self = this;

    // We expect this function to be called at startup, not from within a method,
    // so we don't interact with the write fence.
    var collection = self.rawCollection(collectionName);
    var future = new Future();
    var indexName = collection.createIndex(index, options, future.resolver());
    future.wait();
  };
  MongoConnection.prototype.countDocuments = function (collectionName) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
    const collection = this.rawCollection(collectionName);
    return collection.countDocuments(...args);
  };
  MongoConnection.prototype.estimatedDocumentCount = function (collectionName) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
    const collection = this.rawCollection(collectionName);
    return collection.estimatedDocumentCount(...args);
  };
  MongoConnection.prototype._ensureIndex = MongoConnection.prototype.createIndex;
  MongoConnection.prototype._dropIndex = function (collectionName, index) {
    var self = this;

    // This function is only used by test code, not within a method, so we don't
    // interact with the write fence.
    var collection = self.rawCollection(collectionName);
    var future = new Future();
    var indexName = collection.dropIndex(index, future.resolver());
    future.wait();
  };

  // CURSORS

  // There are several classes which relate to cursors:
  //
  // CursorDescription represents the arguments used to construct a cursor:
  // collectionName, selector, and (find) options.  Because it is used as a key
  // for cursor de-dup, everything in it should either be JSON-stringifiable or
  // not affect observeChanges output (eg, options.transform functions are not
  // stringifiable but do not affect observeChanges).
  //
  // SynchronousCursor is a wrapper around a MongoDB cursor
  // which includes fully-synchronous versions of forEach, etc.
  //
  // Cursor is the cursor object returned from find(), which implements the
  // documented Mongo.Collection cursor API.  It wraps a CursorDescription and a
  // SynchronousCursor (lazily: it doesn't contact Mongo until you call a method
  // like fetch or forEach on it).
  //
  // ObserveHandle is the "observe handle" returned from observeChanges. It has a
  // reference to an ObserveMultiplexer.
  //
  // ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a
  // single observe driver.
  //
  // There are two "observe drivers" which drive ObserveMultiplexers:
  //   - PollingObserveDriver caches the results of a query and reruns it when
  //     necessary.
  //   - OplogObserveDriver follows the Mongo operation log to directly observe
  //     database changes.
  // Both implementations follow the same simple interface: when you create them,
  // they start sending observeChanges callbacks (and a ready() invocation) to
  // their ObserveMultiplexer, and you stop them by calling their stop() method.

  CursorDescription = function (collectionName, selector, options) {
    var self = this;
    self.collectionName = collectionName;
    self.selector = Mongo.Collection._rewriteSelector(selector);
    self.options = options || {};
  };
  Cursor = function (mongo, cursorDescription) {
    var self = this;
    self._mongo = mongo;
    self._cursorDescription = cursorDescription;
    self._synchronousCursor = null;
  };
  function setupSynchronousCursor(cursor, method) {
    // You can only observe a tailable cursor.
    if (cursor._cursorDescription.options.tailable) throw new Error('Cannot call ' + method + ' on a tailable cursor');
    if (!cursor._synchronousCursor) {
      cursor._synchronousCursor = cursor._mongo._createSynchronousCursor(cursor._cursorDescription, {
        // Make sure that the "cursor" argument to forEach/map callbacks is the
        // Cursor, not the SynchronousCursor.
        selfForIteration: cursor,
        useTransform: true
      });
    }
    return cursor._synchronousCursor;
  }
  Cursor.prototype.count = function () {
    const collection = this._mongo.rawCollection(this._cursorDescription.collectionName);
    return Promise.await(collection.countDocuments(replaceTypes(this._cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(this._cursorDescription.options, replaceMeteorAtomWithMongo)));
  };
  [...ASYNC_CURSOR_METHODS, Symbol.iterator, Symbol.asyncIterator].forEach(methodName => {
    // count is handled specially since we don't want to create a cursor.
    // it is still included in ASYNC_CURSOR_METHODS because we still want an async version of it to exist.
    if (methodName !== 'count') {
      Cursor.prototype[methodName] = function () {
        const cursor = setupSynchronousCursor(this, methodName);
        return cursor[methodName](...arguments);
      };
    }

    // These methods are handled separately.
    if (methodName === Symbol.iterator || methodName === Symbol.asyncIterator) {
      return;
    }
    const methodNameAsync = getAsyncMethodName(methodName);
    Cursor.prototype[methodNameAsync] = function () {
      return Promise.resolve(this[methodName](...arguments));
    };
  });
  Cursor.prototype.getTransform = function () {
    return this._cursorDescription.options.transform;
  };

  // When you call Meteor.publish() with a function that returns a Cursor, we need
  // to transmute it into the equivalent subscription.  This is the function that
  // does that.

  Cursor.prototype._publishCursor = function (sub) {
    var self = this;
    var collection = self._cursorDescription.collectionName;
    return Mongo.Collection._publishCursor(self, sub, collection);
  };

  // Used to guarantee that publish functions return at most one cursor per
  // collection. Private, because we might later have cursors that include
  // documents from multiple collections somehow.
  Cursor.prototype._getCollectionName = function () {
    var self = this;
    return self._cursorDescription.collectionName;
  };
  Cursor.prototype.observe = function (callbacks) {
    var self = this;
    return LocalCollection._observeFromObserveChanges(self, callbacks);
  };
  Cursor.prototype.observeChanges = function (callbacks) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var self = this;
    var methods = ['addedAt', 'added', 'changedAt', 'changed', 'removedAt', 'removed', 'movedTo'];
    var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);
    let exceptionName = callbacks._fromObserve ? 'observe' : 'observeChanges';
    exceptionName += ' callback';
    methods.forEach(function (method) {
      if (callbacks[method] && typeof callbacks[method] == "function") {
        callbacks[method] = Meteor.bindEnvironment(callbacks[method], method + exceptionName);
      }
    });
    return self._mongo._observeChanges(self._cursorDescription, ordered, callbacks, options.nonMutatingCallbacks);
  };
  MongoConnection.prototype._createSynchronousCursor = function (cursorDescription, options) {
    var self = this;
    options = _.pick(options || {}, 'selfForIteration', 'useTransform');
    var collection = self.rawCollection(cursorDescription.collectionName);
    var cursorOptions = cursorDescription.options;
    var mongoOptions = {
      sort: cursorOptions.sort,
      limit: cursorOptions.limit,
      skip: cursorOptions.skip,
      projection: cursorOptions.fields || cursorOptions.projection,
      readPreference: cursorOptions.readPreference
    };

    // Do we want a tailable cursor (which only works on capped collections)?
    if (cursorOptions.tailable) {
      mongoOptions.numberOfRetries = -1;
    }
    var dbCursor = collection.find(replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), mongoOptions);

    // Do we want a tailable cursor (which only works on capped collections)?
    if (cursorOptions.tailable) {
      // We want a tailable cursor...
      dbCursor.addCursorFlag("tailable", true);
      // ... and for the server to wait a bit if any getMore has no data (rather
      // than making us put the relevant sleeps in the client)...
      dbCursor.addCursorFlag("awaitData", true);

      // And if this is on the oplog collection and the cursor specifies a 'ts',
      // then set the undocumented oplog replay flag, which does a special scan to
      // find the first document (instead of creating an index on ts). This is a
      // very hard-coded Mongo flag which only works on the oplog collection and
      // only works with the ts field.
      if (cursorDescription.collectionName === OPLOG_COLLECTION && cursorDescription.selector.ts) {
        dbCursor.addCursorFlag("oplogReplay", true);
      }
    }
    if (typeof cursorOptions.maxTimeMs !== 'undefined') {
      dbCursor = dbCursor.maxTimeMS(cursorOptions.maxTimeMs);
    }
    if (typeof cursorOptions.hint !== 'undefined') {
      dbCursor = dbCursor.hint(cursorOptions.hint);
    }
    return new SynchronousCursor(dbCursor, cursorDescription, options, collection);
  };
  var SynchronousCursor = function (dbCursor, cursorDescription, options, collection) {
    var self = this;
    options = _.pick(options || {}, 'selfForIteration', 'useTransform');
    self._dbCursor = dbCursor;
    self._cursorDescription = cursorDescription;
    // The "self" argument passed to forEach/map callbacks. If we're wrapped
    // inside a user-visible Cursor, we want to provide the outer cursor!
    self._selfForIteration = options.selfForIteration || self;
    if (options.useTransform && cursorDescription.options.transform) {
      self._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
    } else {
      self._transform = null;
    }
    self._synchronousCount = Future.wrap(collection.countDocuments.bind(collection, replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(cursorDescription.options, replaceMeteorAtomWithMongo)));
    self._visitedIds = new LocalCollection._IdMap();
  };
  _.extend(SynchronousCursor.prototype, {
    // Returns a Promise for the next object from the underlying cursor (before
    // the Mongo->Meteor type replacement).
    _rawNextObjectPromise: function () {
      const self = this;
      return new Promise((resolve, reject) => {
        self._dbCursor.next((err, doc) => {
          if (err) {
            reject(err);
          } else {
            resolve(doc);
          }
        });
      });
    },
    // Returns a Promise for the next object from the cursor, skipping those whose
    // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
    _nextObjectPromise: function () {
      return Promise.asyncApply(() => {
        var self = this;
        while (true) {
          var doc = Promise.await(self._rawNextObjectPromise());
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!self._cursorDescription.options.tailable && _.has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (self._visitedIds.has(doc._id)) continue;
            self._visitedIds.set(doc._id, true);
          }
          if (self._transform) doc = self._transform(doc);
          return doc;
        }
      });
    },
    // Returns a promise which is resolved with the next object (like with
    // _nextObjectPromise) or rejected if the cursor doesn't return within
    // timeoutMS ms.
    _nextObjectPromiseWithTimeout: function (timeoutMS) {
      const self = this;
      if (!timeoutMS) {
        return self._nextObjectPromise();
      }
      const nextObjectPromise = self._nextObjectPromise();
      const timeoutErr = new Error('Client-side timeout waiting for next object');
      const timeoutPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(timeoutErr);
        }, timeoutMS);
      });
      return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
        if (err === timeoutErr) {
          self.close();
        }
        throw err;
      });
    },
    _nextObject: function () {
      var self = this;
      return self._nextObjectPromise().await();
    },
    forEach: function (callback, thisArg) {
      var self = this;

      // Get back to the beginning.
      self._rewind();

      // We implement the loop ourself instead of using self._dbCursor.each,
      // because "each" will call its callback outside of a fiber which makes it
      // much more complex to make this function synchronous.
      var index = 0;
      while (true) {
        var doc = self._nextObject();
        if (!doc) return;
        callback.call(thisArg, doc, index++, self._selfForIteration);
      }
    },
    // XXX Allow overlapping callback executions if callback yields.
    map: function (callback, thisArg) {
      var self = this;
      var res = [];
      self.forEach(function (doc, index) {
        res.push(callback.call(thisArg, doc, index, self._selfForIteration));
      });
      return res;
    },
    _rewind: function () {
      var self = this;

      // known to be synchronous
      self._dbCursor.rewind();
      self._visitedIds = new LocalCollection._IdMap();
    },
    // Mostly usable for tailable cursors.
    close: function () {
      var self = this;
      self._dbCursor.close();
    },
    fetch: function () {
      var self = this;
      return self.map(_.identity);
    },
    count: function () {
      var self = this;
      return self._synchronousCount().wait();
    },
    // This method is NOT wrapped in Cursor.
    getRawObjects: function (ordered) {
      var self = this;
      if (ordered) {
        return self.fetch();
      } else {
        var results = new LocalCollection._IdMap();
        self.forEach(function (doc) {
          results.set(doc._id, doc);
        });
        return results;
      }
    }
  });
  SynchronousCursor.prototype[Symbol.iterator] = function () {
    var self = this;

    // Get back to the beginning.
    self._rewind();
    return {
      next() {
        const doc = self._nextObject();
        return doc ? {
          value: doc
        } : {
          done: true
        };
      }
    };
  };
  SynchronousCursor.prototype[Symbol.asyncIterator] = function () {
    const syncResult = this[Symbol.iterator]();
    return {
      next() {
        return Promise.asyncApply(() => {
          return Promise.resolve(syncResult.next());
        });
      }
    };
  };

  // Tails the cursor described by cursorDescription, most likely on the
  // oplog. Calls docCallback with each document found. Ignores errors and just
  // restarts the tail on error.
  //
  // If timeoutMS is set, then if we don't get a new document every timeoutMS,
  // kill and restart the cursor. This is primarily a workaround for #8598.
  MongoConnection.prototype.tail = function (cursorDescription, docCallback, timeoutMS) {
    var self = this;
    if (!cursorDescription.options.tailable) throw new Error("Can only tail a tailable cursor");
    var cursor = self._createSynchronousCursor(cursorDescription);
    var stopped = false;
    var lastTS;
    var loop = function () {
      var doc = null;
      while (true) {
        if (stopped) return;
        try {
          doc = cursor._nextObjectPromiseWithTimeout(timeoutMS).await();
        } catch (err) {
          // There's no good way to figure out if this was actually an error from
          // Mongo, or just client-side (including our own timeout error). Ah
          // well. But either way, we need to retry the cursor (unless the failure
          // was because the observe got stopped).
          doc = null;
        }
        // Since we awaited a promise above, we need to check again to see if
        // we've been stopped before calling the callback.
        if (stopped) return;
        if (doc) {
          // If a tailable cursor contains a "ts" field, use it to recreate the
          // cursor on error. ("ts" is a standard that Mongo uses internally for
          // the oplog, and there's a special flag that lets you do binary search
          // on it instead of needing to use an index.)
          lastTS = doc.ts;
          docCallback(doc);
        } else {
          var newSelector = _.clone(cursorDescription.selector);
          if (lastTS) {
            newSelector.ts = {
              $gt: lastTS
            };
          }
          cursor = self._createSynchronousCursor(new CursorDescription(cursorDescription.collectionName, newSelector, cursorDescription.options));
          // Mongo failover takes many seconds.  Retry in a bit.  (Without this
          // setTimeout, we peg the CPU at 100% and never notice the actual
          // failover.
          Meteor.setTimeout(loop, 100);
          break;
        }
      }
    };
    Meteor.defer(loop);
    return {
      stop: function () {
        stopped = true;
        cursor.close();
      }
    };
  };
  MongoConnection.prototype._observeChanges = function (cursorDescription, ordered, callbacks, nonMutatingCallbacks) {
    var self = this;
    if (cursorDescription.options.tailable) {
      return self._observeChangesTailable(cursorDescription, ordered, callbacks);
    }

    // You may not filter out _id when observing changes, because the id is a core
    // part of the observeChanges API.
    const fieldsOptions = cursorDescription.options.projection || cursorDescription.options.fields;
    if (fieldsOptions && (fieldsOptions._id === 0 || fieldsOptions._id === false)) {
      throw Error("You may not observe a cursor with {fields: {_id: 0}}");
    }
    var observeKey = EJSON.stringify(_.extend({
      ordered: ordered
    }, cursorDescription));
    var multiplexer, observeDriver;
    var firstHandle = false;

    // Find a matching ObserveMultiplexer, or create a new one. This next block is
    // guaranteed to not yield (and it doesn't call anything that can observe a
    // new query), so no other calls to this function can interleave with it.
    Meteor._noYieldsAllowed(function () {
      if (_.has(self._observeMultiplexers, observeKey)) {
        multiplexer = self._observeMultiplexers[observeKey];
      } else {
        firstHandle = true;
        // Create a new ObserveMultiplexer.
        multiplexer = new ObserveMultiplexer({
          ordered: ordered,
          onStop: function () {
            delete self._observeMultiplexers[observeKey];
            observeDriver.stop();
          }
        });
        self._observeMultiplexers[observeKey] = multiplexer;
      }
    });
    var observeHandle = new ObserveHandle(multiplexer, callbacks, nonMutatingCallbacks);
    if (firstHandle) {
      var matcher, sorter;
      var canUseOplog = _.all([function () {
        // At a bare minimum, using the oplog requires us to have an oplog, to
        // want unordered callbacks, and to not want a callback on the polls
        // that won't happen.
        return self._oplogHandle && !ordered && !callbacks._testOnlyPollCallback;
      }, function () {
        // We need to be able to compile the selector. Fall back to polling for
        // some newfangled $selector that minimongo doesn't support yet.
        try {
          matcher = new Minimongo.Matcher(cursorDescription.selector);
          return true;
        } catch (e) {
          // XXX make all compilation errors MinimongoError or something
          //     so that this doesn't ignore unrelated exceptions
          return false;
        }
      }, function () {
        // ... and the selector itself needs to support oplog.
        return OplogObserveDriver.cursorSupported(cursorDescription, matcher);
      }, function () {
        // And we need to be able to compile the sort, if any.  eg, can't be
        // {$natural: 1}.
        if (!cursorDescription.options.sort) return true;
        try {
          sorter = new Minimongo.Sorter(cursorDescription.options.sort);
          return true;
        } catch (e) {
          // XXX make all compilation errors MinimongoError or something
          //     so that this doesn't ignore unrelated exceptions
          return false;
        }
      }], function (f) {
        return f();
      }); // invoke each function

      var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;
      observeDriver = new driverClass({
        cursorDescription: cursorDescription,
        mongoHandle: self,
        multiplexer: multiplexer,
        ordered: ordered,
        matcher: matcher,
        // ignored by polling
        sorter: sorter,
        // ignored by polling
        _testOnlyPollCallback: callbacks._testOnlyPollCallback
      });

      // This field is only set for use in tests.
      multiplexer._observeDriver = observeDriver;
    }

    // Blocks until the initial adds have been sent.
    multiplexer.addHandleAndSendInitialAdds(observeHandle);
    return observeHandle;
  };

  // Listen for the invalidation messages that will trigger us to poll the
  // database for changes. If this selector specifies specific IDs, specify them
  // here, so that updates to different specific IDs don't cause us to poll.
  // listenCallback is the same kind of (notification, complete) callback passed
  // to InvalidationCrossbar.listen.

  listenAll = function (cursorDescription, listenCallback) {
    var listeners = [];
    forEachTrigger(cursorDescription, function (trigger) {
      listeners.push(DDPServer._InvalidationCrossbar.listen(trigger, listenCallback));
    });
    return {
      stop: function () {
        _.each(listeners, function (listener) {
          listener.stop();
        });
      }
    };
  };
  forEachTrigger = function (cursorDescription, triggerCallback) {
    var key = {
      collection: cursorDescription.collectionName
    };
    var specificIds = LocalCollection._idsMatchedBySelector(cursorDescription.selector);
    if (specificIds) {
      _.each(specificIds, function (id) {
        triggerCallback(_.extend({
          id: id
        }, key));
      });
      triggerCallback(_.extend({
        dropCollection: true,
        id: null
      }, key));
    } else {
      triggerCallback(key);
    }
    // Everyone cares about the database being dropped.
    triggerCallback({
      dropDatabase: true
    });
  };

  // observeChanges for tailable cursors on capped collections.
  //
  // Some differences from normal cursors:
  //   - Will never produce anything other than 'added' or 'addedBefore'. If you
  //     do update a document that has already been produced, this will not notice
  //     it.
  //   - If you disconnect and reconnect from Mongo, it will essentially restart
  //     the query, which will lead to duplicate results. This is pretty bad,
  //     but if you include a field called 'ts' which is inserted as
  //     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the
  //     current Mongo-style timestamp), we'll be able to find the place to
  //     restart properly. (This field is specifically understood by Mongo with an
  //     optimization which allows it to find the right place to start without
  //     an index on ts. It's how the oplog works.)
  //   - No callbacks are triggered synchronously with the call (there's no
  //     differentiation between "initial data" and "later changes"; everything
  //     that matches the query gets sent asynchronously).
  //   - De-duplication is not implemented.
  //   - Does not yet interact with the write fence. Probably, this should work by
  //     ignoring removes (which don't work on capped collections) and updates
  //     (which don't affect tailable cursors), and just keeping track of the ID
  //     of the inserted object, and closing the write fence once you get to that
  //     ID (or timestamp?).  This doesn't work well if the document doesn't match
  //     the query, though.  On the other hand, the write fence can close
  //     immediately if it does not match the query. So if we trust minimongo
  //     enough to accurately evaluate the query against the write fence, we
  //     should be able to do this...  Of course, minimongo doesn't even support
  //     Mongo Timestamps yet.
  MongoConnection.prototype._observeChangesTailable = function (cursorDescription, ordered, callbacks) {
    var self = this;

    // Tailable cursors only ever call added/addedBefore callbacks, so it's an
    // error if you didn't provide them.
    if (ordered && !callbacks.addedBefore || !ordered && !callbacks.added) {
      throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered") + " tailable cursor without a " + (ordered ? "addedBefore" : "added") + " callback");
    }
    return self.tail(cursorDescription, function (doc) {
      var id = doc._id;
      delete doc._id;
      // The ts is an implementation detail. Hide it.
      delete doc.ts;
      if (ordered) {
        callbacks.addedBefore(id, doc, null);
      } else {
        callbacks.added(id, doc);
      }
    });
  };

  // XXX We probably need to find a better way to expose this. Right now
  // it's only used by tests, but in fact you need it in normal
  // operation to interact with capped collections.
  MongoInternals.MongoTimestamp = MongoDB.Timestamp;
  MongoInternals.Connection = MongoConnection;
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_tailing.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_tailing.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let NpmModuleMongodb;
module.link("meteor/npm-mongo", {
  NpmModuleMongodb(v) {
    NpmModuleMongodb = v;
  }
}, 0);
var Future = Npm.require('fibers/future');
const {
  Long
} = NpmModuleMongodb;
OPLOG_COLLECTION = 'oplog.rs';
var TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
var TAIL_TIMEOUT = +process.env.METEOR_OPLOG_TAIL_TIMEOUT || 30000;
var showTS = function (ts) {
  return "Timestamp(" + ts.getHighBits() + ", " + ts.getLowBits() + ")";
};
idForOp = function (op) {
  if (op.op === 'd') return op.o._id;else if (op.op === 'i') return op.o._id;else if (op.op === 'u') return op.o2._id;else if (op.op === 'c') throw Error("Operator 'c' doesn't supply an object with id: " + EJSON.stringify(op));else throw Error("Unknown op: " + EJSON.stringify(op));
};
OplogHandle = function (oplogUrl, dbName) {
  var self = this;
  self._oplogUrl = oplogUrl;
  self._dbName = dbName;
  self._oplogLastEntryConnection = null;
  self._oplogTailConnection = null;
  self._stopped = false;
  self._tailHandle = null;
  self._readyFuture = new Future();
  self._crossbar = new DDPServer._Crossbar({
    factPackage: "mongo-livedata",
    factName: "oplog-watchers"
  });
  self._baseOplogSelector = {
    ns: new RegExp("^(?:" + [Meteor._escapeRegExp(self._dbName + "."), Meteor._escapeRegExp("admin.$cmd")].join("|") + ")"),
    $or: [{
      op: {
        $in: ['i', 'u', 'd']
      }
    },
    // drop collection
    {
      op: 'c',
      'o.drop': {
        $exists: true
      }
    }, {
      op: 'c',
      'o.dropDatabase': 1
    }, {
      op: 'c',
      'o.applyOps': {
        $exists: true
      }
    }]
  };

  // Data structures to support waitUntilCaughtUp(). Each oplog entry has a
  // MongoTimestamp object on it (which is not the same as a Date --- it's a
  // combination of time and an incrementing counter; see
  // http://docs.mongodb.org/manual/reference/bson-types/#timestamps).
  //
  // _catchingUpFutures is an array of {ts: MongoTimestamp, future: Future}
  // objects, sorted by ascending timestamp. _lastProcessedTS is the
  // MongoTimestamp of the last oplog entry we've processed.
  //
  // Each time we call waitUntilCaughtUp, we take a peek at the final oplog
  // entry in the db.  If we've already processed it (ie, it is not greater than
  // _lastProcessedTS), waitUntilCaughtUp immediately returns. Otherwise,
  // waitUntilCaughtUp makes a new Future and inserts it along with the final
  // timestamp entry that it read, into _catchingUpFutures. waitUntilCaughtUp
  // then waits on that future, which is resolved once _lastProcessedTS is
  // incremented to be past its timestamp by the worker fiber.
  //
  // XXX use a priority queue or something else that's faster than an array
  self._catchingUpFutures = [];
  self._lastProcessedTS = null;
  self._onSkippedEntriesHook = new Hook({
    debugPrintExceptions: "onSkippedEntries callback"
  });
  self._entryQueue = new Meteor._DoubleEndedQueue();
  self._workerActive = false;
  self._startTailing();
};
Object.assign(OplogHandle.prototype, {
  stop: function () {
    var self = this;
    if (self._stopped) return;
    self._stopped = true;
    if (self._tailHandle) self._tailHandle.stop();
    // XXX should close connections too
  },

  onOplogEntry: function (trigger, callback) {
    var self = this;
    if (self._stopped) throw new Error("Called onOplogEntry on stopped handle!");

    // Calling onOplogEntry requires us to wait for the tailing to be ready.
    self._readyFuture.wait();
    var originalCallback = callback;
    callback = Meteor.bindEnvironment(function (notification) {
      originalCallback(notification);
    }, function (err) {
      Meteor._debug("Error in oplog callback", err);
    });
    var listenHandle = self._crossbar.listen(trigger, callback);
    return {
      stop: function () {
        listenHandle.stop();
      }
    };
  },
  // Register a callback to be invoked any time we skip oplog entries (eg,
  // because we are too far behind).
  onSkippedEntries: function (callback) {
    var self = this;
    if (self._stopped) throw new Error("Called onSkippedEntries on stopped handle!");
    return self._onSkippedEntriesHook.register(callback);
  },
  // Calls `callback` once the oplog has been processed up to a point that is
  // roughly "now": specifically, once we've processed all ops that are
  // currently visible.
  // XXX become convinced that this is actually safe even if oplogConnection
  // is some kind of pool
  waitUntilCaughtUp: function () {
    var self = this;
    if (self._stopped) throw new Error("Called waitUntilCaughtUp on stopped handle!");

    // Calling waitUntilCaughtUp requries us to wait for the oplog connection to
    // be ready.
    self._readyFuture.wait();
    var lastEntry;
    while (!self._stopped) {
      // We need to make the selector at least as restrictive as the actual
      // tailing selector (ie, we need to specify the DB name) or else we might
      // find a TS that won't show up in the actual tail stream.
      try {
        lastEntry = self._oplogLastEntryConnection.findOne(OPLOG_COLLECTION, self._baseOplogSelector, {
          fields: {
            ts: 1
          },
          sort: {
            $natural: -1
          }
        });
        break;
      } catch (e) {
        // During failover (eg) if we get an exception we should log and retry
        // instead of crashing.
        Meteor._debug("Got exception while reading last entry", e);
        Meteor._sleepForMs(100);
      }
    }
    if (self._stopped) return;
    if (!lastEntry) {
      // Really, nothing in the oplog? Well, we've processed everything.
      return;
    }
    var ts = lastEntry.ts;
    if (!ts) throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));
    if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {
      // We've already caught up to here.
      return;
    }

    // Insert the future into our list. Almost always, this will be at the end,
    // but it's conceivable that if we fail over from one primary to another,
    // the oplog entries we see will go backwards.
    var insertAfter = self._catchingUpFutures.length;
    while (insertAfter - 1 > 0 && self._catchingUpFutures[insertAfter - 1].ts.greaterThan(ts)) {
      insertAfter--;
    }
    var f = new Future();
    self._catchingUpFutures.splice(insertAfter, 0, {
      ts: ts,
      future: f
    });
    f.wait();
  },
  _startTailing: function () {
    var self = this;
    // First, make sure that we're talking to the local database.
    var mongodbUri = Npm.require('mongodb-uri');
    if (mongodbUri.parse(self._oplogUrl).database !== 'local') {
      throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
    }

    // We make two separate connections to Mongo. The Node Mongo driver
    // implements a naive round-robin connection pool: each "connection" is a
    // pool of several (5 by default) TCP connections, and each request is
    // rotated through the pools. Tailable cursor queries block on the server
    // until there is some data to return (or until a few seconds have
    // passed). So if the connection pool used for tailing cursors is the same
    // pool used for other queries, the other queries will be delayed by seconds
    // 1/5 of the time.
    //
    // The tail connection will only ever be running a single tail command, so
    // it only needs to make one underlying TCP connection.
    self._oplogTailConnection = new MongoConnection(self._oplogUrl, {
      maxPoolSize: 1
    });
    // XXX better docs, but: it's to get monotonic results
    // XXX is it safe to say "if there's an in flight query, just use its
    //     results"? I don't think so but should consider that
    self._oplogLastEntryConnection = new MongoConnection(self._oplogUrl, {
      maxPoolSize: 1
    });

    // Now, make sure that there actually is a repl set here. If not, oplog
    // tailing won't ever find anything!
    // More on the isMasterDoc
    // https://docs.mongodb.com/manual/reference/command/isMaster/
    var f = new Future();
    self._oplogLastEntryConnection.db.admin().command({
      ismaster: 1
    }, f.resolver());
    var isMasterDoc = f.wait();
    if (!(isMasterDoc && isMasterDoc.setName)) {
      throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
    }

    // Find the last oplog entry.
    var lastOplogEntry = self._oplogLastEntryConnection.findOne(OPLOG_COLLECTION, {}, {
      sort: {
        $natural: -1
      },
      fields: {
        ts: 1
      }
    });
    var oplogSelector = _.clone(self._baseOplogSelector);
    if (lastOplogEntry) {
      // Start after the last entry that currently exists.
      oplogSelector.ts = {
        $gt: lastOplogEntry.ts
      };
      // If there are any calls to callWhenProcessedLatest before any other
      // oplog entries show up, allow callWhenProcessedLatest to call its
      // callback immediately.
      self._lastProcessedTS = lastOplogEntry.ts;
    }
    var cursorDescription = new CursorDescription(OPLOG_COLLECTION, oplogSelector, {
      tailable: true
    });

    // Start tailing the oplog.
    //
    // We restart the low-level oplog query every 30 seconds if we didn't get a
    // doc. This is a workaround for #8598: the Node Mongo driver has at least
    // one bug that can lead to query callbacks never getting called (even with
    // an error) when leadership failover occur.
    self._tailHandle = self._oplogTailConnection.tail(cursorDescription, function (doc) {
      self._entryQueue.push(doc);
      self._maybeStartWorker();
    }, TAIL_TIMEOUT);
    self._readyFuture.return();
  },
  _maybeStartWorker: function () {
    var self = this;
    if (self._workerActive) return;
    self._workerActive = true;
    Meteor.defer(function () {
      // May be called recursively in case of transactions.
      function handleDoc(doc) {
        if (doc.ns === "admin.$cmd") {
          if (doc.o.applyOps) {
            // This was a successful transaction, so we need to apply the
            // operations that were involved.
            let nextTimestamp = doc.ts;
            doc.o.applyOps.forEach(op => {
              // See https://github.com/meteor/meteor/issues/10420.
              if (!op.ts) {
                op.ts = nextTimestamp;
                nextTimestamp = nextTimestamp.add(Long.ONE);
              }
              handleDoc(op);
            });
            return;
          }
          throw new Error("Unknown command " + EJSON.stringify(doc));
        }
        const trigger = {
          dropCollection: false,
          dropDatabase: false,
          op: doc
        };
        if (typeof doc.ns === "string" && doc.ns.startsWith(self._dbName + ".")) {
          trigger.collection = doc.ns.slice(self._dbName.length + 1);
        }

        // Is it a special command and the collection name is hidden
        // somewhere in operator?
        if (trigger.collection === "$cmd") {
          if (doc.o.dropDatabase) {
            delete trigger.collection;
            trigger.dropDatabase = true;
          } else if (_.has(doc.o, "drop")) {
            trigger.collection = doc.o.drop;
            trigger.dropCollection = true;
            trigger.id = null;
          } else {
            throw Error("Unknown command " + EJSON.stringify(doc));
          }
        } else {
          // All other ops have an id.
          trigger.id = idForOp(doc);
        }
        self._crossbar.fire(trigger);
      }
      try {
        while (!self._stopped && !self._entryQueue.isEmpty()) {
          // Are we too far behind? Just tell our observers that they need to
          // repoll, and drop our queue.
          if (self._entryQueue.length > TOO_FAR_BEHIND) {
            var lastEntry = self._entryQueue.pop();
            self._entryQueue.clear();
            self._onSkippedEntriesHook.each(function (callback) {
              callback();
              return true;
            });

            // Free any waitUntilCaughtUp() calls that were waiting for us to
            // pass something that we just skipped.
            self._setLastProcessedTS(lastEntry.ts);
            continue;
          }
          const doc = self._entryQueue.shift();

          // Fire trigger(s) for this doc.
          handleDoc(doc);

          // Now that we've processed this operation, process pending
          // sequencers.
          if (doc.ts) {
            self._setLastProcessedTS(doc.ts);
          } else {
            throw Error("oplog entry without ts: " + EJSON.stringify(doc));
          }
        }
      } finally {
        self._workerActive = false;
      }
    });
  },
  _setLastProcessedTS: function (ts) {
    var self = this;
    self._lastProcessedTS = ts;
    while (!_.isEmpty(self._catchingUpFutures) && self._catchingUpFutures[0].ts.lessThanOrEqual(self._lastProcessedTS)) {
      var sequencer = self._catchingUpFutures.shift();
      sequencer.future.return();
    }
  },
  //Methods used on tests to dinamically change TOO_FAR_BEHIND
  _defineTooFarBehind: function (value) {
    TOO_FAR_BEHIND = value;
  },
  _resetTooFarBehind: function () {
    TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_multiplex.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/observe_multiplex.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
const _excluded = ["_id"];
let _objectWithoutProperties;
module.link("@babel/runtime/helpers/objectWithoutProperties", {
  default(v) {
    _objectWithoutProperties = v;
  }
}, 0);
var Future = Npm.require('fibers/future');
ObserveMultiplexer = function (options) {
  var self = this;
  if (!options || !_.has(options, 'ordered')) throw Error("must specified ordered");
  Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", 1);
  self._ordered = options.ordered;
  self._onStop = options.onStop || function () {};
  self._queue = new Meteor._SynchronousQueue();
  self._handles = {};
  self._readyFuture = new Future();
  self._cache = new LocalCollection._CachingChangeObserver({
    ordered: options.ordered
  });
  // Number of addHandleAndSendInitialAdds tasks scheduled but not yet
  // running. removeHandle uses this to know if it's time to call the onStop
  // callback.
  self._addHandleTasksScheduledButNotPerformed = 0;
  _.each(self.callbackNames(), function (callbackName) {
    self[callbackName] = function /* ... */
    () {
      self._applyCallback(callbackName, _.toArray(arguments));
    };
  });
};
_.extend(ObserveMultiplexer.prototype, {
  addHandleAndSendInitialAdds: function (handle) {
    var self = this;

    // Check this before calling runTask (even though runTask does the same
    // check) so that we don't leak an ObserveMultiplexer on error by
    // incrementing _addHandleTasksScheduledButNotPerformed and never
    // decrementing it.
    if (!self._queue.safeToRunTask()) throw new Error("Can't call observeChanges from an observe callback on the same query");
    ++self._addHandleTasksScheduledButNotPerformed;
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", 1);
    self._queue.runTask(function () {
      self._handles[handle._id] = handle;
      // Send out whatever adds we have so far (whether or not we the
      // multiplexer is ready).
      self._sendAdds(handle);
      --self._addHandleTasksScheduledButNotPerformed;
    });
    // *outside* the task, since otherwise we'd deadlock
    self._readyFuture.wait();
  },
  // Remove an observe handle. If it was the last observe handle, call the
  // onStop callback; you cannot add any more observe handles after this.
  //
  // This is not synchronized with polls and handle additions: this means that
  // you can safely call it from within an observe callback, but it also means
  // that we have to be careful when we iterate over _handles.
  removeHandle: function (id) {
    var self = this;

    // This should not be possible: you can only call removeHandle by having
    // access to the ObserveHandle, which isn't returned to user code until the
    // multiplex is ready.
    if (!self._ready()) throw new Error("Can't remove handles until the multiplex is ready");
    delete self._handles[id];
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", -1);
    if (_.isEmpty(self._handles) && self._addHandleTasksScheduledButNotPerformed === 0) {
      self._stop();
    }
  },
  _stop: function (options) {
    var self = this;
    options = options || {};

    // It shouldn't be possible for us to stop when all our handles still
    // haven't been returned from observeChanges!
    if (!self._ready() && !options.fromQueryError) throw Error("surprising _stop: not ready");

    // Call stop callback (which kills the underlying process which sends us
    // callbacks and removes us from the connection's dictionary).
    self._onStop();
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", -1);

    // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop
    // callback should make our connection forget about us).
    self._handles = null;
  },
  // Allows all addHandleAndSendInitialAdds calls to return, once all preceding
  // adds have been processed. Does not block.
  ready: function () {
    var self = this;
    self._queue.queueTask(function () {
      if (self._ready()) throw Error("can't make ObserveMultiplex ready twice!");
      self._readyFuture.return();
    });
  },
  // If trying to execute the query results in an error, call this. This is
  // intended for permanent errors, not transient network errors that could be
  // fixed. It should only be called before ready(), because if you called ready
  // that meant that you managed to run the query once. It will stop this
  // ObserveMultiplex and cause addHandleAndSendInitialAdds calls (and thus
  // observeChanges calls) to throw the error.
  queryError: function (err) {
    var self = this;
    self._queue.runTask(function () {
      if (self._ready()) throw Error("can't claim query has an error after it worked!");
      self._stop({
        fromQueryError: true
      });
      self._readyFuture.throw(err);
    });
  },
  // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"
  // and observe callbacks which came before this call have been propagated to
  // all handles. "ready" must have already been called on this multiplexer.
  onFlush: function (cb) {
    var self = this;
    self._queue.queueTask(function () {
      if (!self._ready()) throw Error("only call onFlush on a multiplexer that will be ready");
      cb();
    });
  },
  callbackNames: function () {
    var self = this;
    if (self._ordered) return ["addedBefore", "changed", "movedBefore", "removed"];else return ["added", "changed", "removed"];
  },
  _ready: function () {
    return this._readyFuture.isResolved();
  },
  _applyCallback: function (callbackName, args) {
    var self = this;
    self._queue.queueTask(function () {
      // If we stopped in the meantime, do nothing.
      if (!self._handles) return;

      // First, apply the change to the cache.
      self._cache.applyChange[callbackName].apply(null, args);

      // If we haven't finished the initial adds, then we should only be getting
      // adds.
      if (!self._ready() && callbackName !== 'added' && callbackName !== 'addedBefore') {
        throw new Error("Got " + callbackName + " during initial adds");
      }

      // Now multiplex the callbacks out to all observe handles. It's OK if
      // these calls yield; since we're inside a task, no other use of our queue
      // can continue until these are done. (But we do have to be careful to not
      // use a handle that got removed, because removeHandle does not use the
      // queue; thus, we iterate over an array of keys that we control.)
      _.each(_.keys(self._handles), function (handleId) {
        var handle = self._handles && self._handles[handleId];
        if (!handle) return;
        var callback = handle['_' + callbackName];
        // clone arguments so that callbacks can mutate their arguments
        callback && callback.apply(null, handle.nonMutatingCallbacks ? args : EJSON.clone(args));
      });
    });
  },
  // Sends initial adds to a handle. It should only be called from within a task
  // (the task that is processing the addHandleAndSendInitialAdds call). It
  // synchronously invokes the handle's added or addedBefore; there's no need to
  // flush the queue afterwards to ensure that the callbacks get out.
  _sendAdds: function (handle) {
    var self = this;
    if (self._queue.safeToRunTask()) throw Error("_sendAdds may only be called from within a task!");
    var add = self._ordered ? handle._addedBefore : handle._added;
    if (!add) return;
    // note: docs may be an _IdMap or an OrderedDict
    self._cache.docs.forEach(function (doc, id) {
      if (!_.has(self._handles, handle._id)) throw Error("handle got removed before sending initial adds!");
      const _ref = handle.nonMutatingCallbacks ? doc : EJSON.clone(doc),
        {
          _id
        } = _ref,
        fields = _objectWithoutProperties(_ref, _excluded);
      if (self._ordered) add(id, fields, null); // we're going in order, so add at end
      else add(id, fields);
    });
  }
});
var nextObserveHandleId = 1;

// When the callbacks do not mutate the arguments, we can skip a lot of data clones
ObserveHandle = function (multiplexer, callbacks) {
  let nonMutatingCallbacks = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var self = this;
  // The end user is only supposed to call stop().  The other fields are
  // accessible to the multiplexer, though.
  self._multiplexer = multiplexer;
  _.each(multiplexer.callbackNames(), function (name) {
    if (callbacks[name]) {
      self['_' + name] = callbacks[name];
    } else if (name === "addedBefore" && callbacks.added) {
      // Special case: if you specify "added" and "movedBefore", you get an
      // ordered observe where for some reason you don't get ordering data on
      // the adds.  I dunno, we wrote tests for it, there must have been a
      // reason.
      self._addedBefore = function (id, fields, before) {
        callbacks.added(id, fields);
      };
    }
  });
  self._stopped = false;
  self._id = nextObserveHandleId++;
  self.nonMutatingCallbacks = nonMutatingCallbacks;
};
ObserveHandle.prototype.stop = function () {
  var self = this;
  if (self._stopped) return;
  self._stopped = true;
  self._multiplexer.removeHandle(self._id);
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"doc_fetcher.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/doc_fetcher.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DocFetcher: () => DocFetcher
});
var Fiber = Npm.require('fibers');
class DocFetcher {
  constructor(mongoConnection) {
    this._mongoConnection = mongoConnection;
    // Map from op -> [callback]
    this._callbacksForOp = new Map();
  }

  // Fetches document "id" from collectionName, returning it or null if not
  // found.
  //
  // If you make multiple calls to fetch() with the same op reference,
  // DocFetcher may assume that they all return the same document. (It does
  // not check to see if collectionName/id match.)
  //
  // You may assume that callback is never called synchronously (and in fact
  // OplogObserveDriver does so).
  fetch(collectionName, id, op, callback) {
    const self = this;
    check(collectionName, String);
    check(op, Object);

    // If there's already an in-progress fetch for this cache key, yield until
    // it's done and return whatever it returns.
    if (self._callbacksForOp.has(op)) {
      self._callbacksForOp.get(op).push(callback);
      return;
    }
    const callbacks = [callback];
    self._callbacksForOp.set(op, callbacks);
    Fiber(function () {
      try {
        var doc = self._mongoConnection.findOne(collectionName, {
          _id: id
        }) || null;
        // Return doc to all relevant callbacks. Note that this array can
        // continue to grow during callback excecution.
        while (callbacks.length > 0) {
          // Clone the document so that the various calls to fetch don't return
          // objects that are intertwingled with each other. Clone before
          // popping the future, so that if clone throws, the error gets passed
          // to the next callback.
          callbacks.pop()(null, EJSON.clone(doc));
        }
      } catch (e) {
        while (callbacks.length > 0) {
          callbacks.pop()(e);
        }
      } finally {
        // XXX consider keeping the doc around for a period of time before
        // removing from the cache
        self._callbacksForOp.delete(op);
      }
    }).run();
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"polling_observe_driver.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/polling_observe_driver.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var POLLING_THROTTLE_MS = +process.env.METEOR_POLLING_THROTTLE_MS || 50;
var POLLING_INTERVAL_MS = +process.env.METEOR_POLLING_INTERVAL_MS || 10 * 1000;
PollingObserveDriver = function (options) {
  var self = this;
  self._cursorDescription = options.cursorDescription;
  self._mongoHandle = options.mongoHandle;
  self._ordered = options.ordered;
  self._multiplexer = options.multiplexer;
  self._stopCallbacks = [];
  self._stopped = false;
  self._synchronousCursor = self._mongoHandle._createSynchronousCursor(self._cursorDescription);

  // previous results snapshot.  on each poll cycle, diffs against
  // results drives the callbacks.
  self._results = null;

  // The number of _pollMongo calls that have been added to self._taskQueue but
  // have not started running. Used to make sure we never schedule more than one
  // _pollMongo (other than possibly the one that is currently running). It's
  // also used by _suspendPolling to pretend there's a poll scheduled. Usually,
  // it's either 0 (for "no polls scheduled other than maybe one currently
  // running") or 1 (for "a poll scheduled that isn't running yet"), but it can
  // also be 2 if incremented by _suspendPolling.
  self._pollsScheduledButNotStarted = 0;
  self._pendingWrites = []; // people to notify when polling completes

  // Make sure to create a separately throttled function for each
  // PollingObserveDriver object.
  self._ensurePollIsScheduled = _.throttle(self._unthrottledEnsurePollIsScheduled, self._cursorDescription.options.pollingThrottleMs || POLLING_THROTTLE_MS /* ms */);

  // XXX figure out if we still need a queue
  self._taskQueue = new Meteor._SynchronousQueue();
  var listenersHandle = listenAll(self._cursorDescription, function (notification) {
    // When someone does a transaction that might affect us, schedule a poll
    // of the database. If that transaction happens inside of a write fence,
    // block the fence until we've polled and notified observers.
    var fence = DDPServer._CurrentWriteFence.get();
    if (fence) self._pendingWrites.push(fence.beginWrite());
    // Ensure a poll is scheduled... but if we already know that one is,
    // don't hit the throttled _ensurePollIsScheduled function (which might
    // lead to us calling it unnecessarily in <pollingThrottleMs> ms).
    if (self._pollsScheduledButNotStarted === 0) self._ensurePollIsScheduled();
  });
  self._stopCallbacks.push(function () {
    listenersHandle.stop();
  });

  // every once and a while, poll even if we don't think we're dirty, for
  // eventual consistency with database writes from outside the Meteor
  // universe.
  //
  // For testing, there's an undocumented callback argument to observeChanges
  // which disables time-based polling and gets called at the beginning of each
  // poll.
  if (options._testOnlyPollCallback) {
    self._testOnlyPollCallback = options._testOnlyPollCallback;
  } else {
    var pollingInterval = self._cursorDescription.options.pollingIntervalMs || self._cursorDescription.options._pollingInterval ||
    // COMPAT with 1.2
    POLLING_INTERVAL_MS;
    var intervalHandle = Meteor.setInterval(_.bind(self._ensurePollIsScheduled, self), pollingInterval);
    self._stopCallbacks.push(function () {
      Meteor.clearInterval(intervalHandle);
    });
  }

  // Make sure we actually poll soon!
  self._unthrottledEnsurePollIsScheduled();
  Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", 1);
};
_.extend(PollingObserveDriver.prototype, {
  // This is always called through _.throttle (except once at startup).
  _unthrottledEnsurePollIsScheduled: function () {
    var self = this;
    if (self._pollsScheduledButNotStarted > 0) return;
    ++self._pollsScheduledButNotStarted;
    self._taskQueue.queueTask(function () {
      self._pollMongo();
    });
  },
  // test-only interface for controlling polling.
  //
  // _suspendPolling blocks until any currently running and scheduled polls are
  // done, and prevents any further polls from being scheduled. (new
  // ObserveHandles can be added and receive their initial added callbacks,
  // though.)
  //
  // _resumePolling immediately polls, and allows further polls to occur.
  _suspendPolling: function () {
    var self = this;
    // Pretend that there's another poll scheduled (which will prevent
    // _ensurePollIsScheduled from queueing any more polls).
    ++self._pollsScheduledButNotStarted;
    // Now block until all currently running or scheduled polls are done.
    self._taskQueue.runTask(function () {});

    // Confirm that there is only one "poll" (the fake one we're pretending to
    // have) scheduled.
    if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
  },
  _resumePolling: function () {
    var self = this;
    // We should be in the same state as in the end of _suspendPolling.
    if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
    // Run a poll synchronously (which will counteract the
    // ++_pollsScheduledButNotStarted from _suspendPolling).
    self._taskQueue.runTask(function () {
      self._pollMongo();
    });
  },
  _pollMongo: function () {
    var self = this;
    --self._pollsScheduledButNotStarted;
    if (self._stopped) return;
    var first = false;
    var newResults;
    var oldResults = self._results;
    if (!oldResults) {
      first = true;
      // XXX maybe use OrderedDict instead?
      oldResults = self._ordered ? [] : new LocalCollection._IdMap();
    }
    self._testOnlyPollCallback && self._testOnlyPollCallback();

    // Save the list of pending writes which this round will commit.
    var writesForCycle = self._pendingWrites;
    self._pendingWrites = [];

    // Get the new query results. (This yields.)
    try {
      newResults = self._synchronousCursor.getRawObjects(self._ordered);
    } catch (e) {
      if (first && typeof e.code === 'number') {
        // This is an error document sent to us by mongod, not a connection
        // error generated by the client. And we've never seen this query work
        // successfully. Probably it's a bad selector or something, so we should
        // NOT retry. Instead, we should halt the observe (which ends up calling
        // `stop` on us).
        self._multiplexer.queryError(new Error("Exception while polling query " + JSON.stringify(self._cursorDescription) + ": " + e.message));
        return;
      }

      // getRawObjects can throw if we're having trouble talking to the
      // database.  That's fine --- we will repoll later anyway. But we should
      // make sure not to lose track of this cycle's writes.
      // (It also can throw if there's just something invalid about this query;
      // unfortunately the ObserveDriver API doesn't provide a good way to
      // "cancel" the observe from the inside in this case.
      Array.prototype.push.apply(self._pendingWrites, writesForCycle);
      Meteor._debug("Exception while polling query " + JSON.stringify(self._cursorDescription), e);
      return;
    }

    // Run diffs.
    if (!self._stopped) {
      LocalCollection._diffQueryChanges(self._ordered, oldResults, newResults, self._multiplexer);
    }

    // Signals the multiplexer to allow all observeChanges calls that share this
    // multiplexer to return. (This happens asynchronously, via the
    // multiplexer's queue.)
    if (first) self._multiplexer.ready();

    // Replace self._results atomically.  (This assignment is what makes `first`
    // stay through on the next cycle, so we've waited until after we've
    // committed to ready-ing the multiplexer.)
    self._results = newResults;

    // Once the ObserveMultiplexer has processed everything we've done in this
    // round, mark all the writes which existed before this call as
    // commmitted. (If new writes have shown up in the meantime, there'll
    // already be another _pollMongo task scheduled.)
    self._multiplexer.onFlush(function () {
      _.each(writesForCycle, function (w) {
        w.committed();
      });
    });
  },
  stop: function () {
    var self = this;
    self._stopped = true;
    _.each(self._stopCallbacks, function (c) {
      c();
    });
    // Release any write fences that are waiting on us.
    _.each(self._pendingWrites, function (w) {
      w.committed();
    });
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", -1);
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_observe_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_observe_driver.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let oplogV2V1Converter;
module.link("./oplog_v2_converter", {
  oplogV2V1Converter(v) {
    oplogV2V1Converter = v;
  }
}, 0);
var Future = Npm.require('fibers/future');
var PHASE = {
  QUERYING: "QUERYING",
  FETCHING: "FETCHING",
  STEADY: "STEADY"
};

// Exception thrown by _needToPollQuery which unrolls the stack up to the
// enclosing call to finishIfNeedToPollQuery.
var SwitchedToQuery = function () {};
var finishIfNeedToPollQuery = function (f) {
  return function () {
    try {
      f.apply(this, arguments);
    } catch (e) {
      if (!(e instanceof SwitchedToQuery)) throw e;
    }
  };
};
var currentId = 0;

// OplogObserveDriver is an alternative to PollingObserveDriver which follows
// the Mongo operation log instead of just re-polling the query. It obeys the
// same simple interface: constructing it starts sending observeChanges
// callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop
// it by calling the stop() method.
OplogObserveDriver = function (options) {
  var self = this;
  self._usesOplog = true; // tests look at this

  self._id = currentId;
  currentId++;
  self._cursorDescription = options.cursorDescription;
  self._mongoHandle = options.mongoHandle;
  self._multiplexer = options.multiplexer;
  if (options.ordered) {
    throw Error("OplogObserveDriver only supports unordered observeChanges");
  }
  var sorter = options.sorter;
  // We don't support $near and other geo-queries so it's OK to initialize the
  // comparator only once in the constructor.
  var comparator = sorter && sorter.getComparator();
  if (options.cursorDescription.options.limit) {
    // There are several properties ordered driver implements:
    // - _limit is a positive number
    // - _comparator is a function-comparator by which the query is ordered
    // - _unpublishedBuffer is non-null Min/Max Heap,
    //                      the empty buffer in STEADY phase implies that the
    //                      everything that matches the queries selector fits
    //                      into published set.
    // - _published - Max Heap (also implements IdMap methods)

    var heapOptions = {
      IdMap: LocalCollection._IdMap
    };
    self._limit = self._cursorDescription.options.limit;
    self._comparator = comparator;
    self._sorter = sorter;
    self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);
    // We need something that can find Max value in addition to IdMap interface
    self._published = new MaxHeap(comparator, heapOptions);
  } else {
    self._limit = 0;
    self._comparator = null;
    self._sorter = null;
    self._unpublishedBuffer = null;
    self._published = new LocalCollection._IdMap();
  }

  // Indicates if it is safe to insert a new document at the end of the buffer
  // for this query. i.e. it is known that there are no documents matching the
  // selector those are not in published or buffer.
  self._safeAppendToBuffer = false;
  self._stopped = false;
  self._stopHandles = [];
  Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", 1);
  self._registerPhaseChange(PHASE.QUERYING);
  self._matcher = options.matcher;
  // we are now using projection, not fields in the cursor description even if you pass {fields}
  // in the cursor construction
  var projection = self._cursorDescription.options.fields || self._cursorDescription.options.projection || {};
  self._projectionFn = LocalCollection._compileProjection(projection);
  // Projection function, result of combining important fields for selector and
  // existing fields projection
  self._sharedProjection = self._matcher.combineIntoProjection(projection);
  if (sorter) self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);
  self._sharedProjectionFn = LocalCollection._compileProjection(self._sharedProjection);
  self._needToFetch = new LocalCollection._IdMap();
  self._currentlyFetching = null;
  self._fetchGeneration = 0;
  self._requeryWhenDoneThisQuery = false;
  self._writesToCommitWhenWeReachSteady = [];

  // If the oplog handle tells us that it skipped some entries (because it got
  // behind, say), re-poll.
  self._stopHandles.push(self._mongoHandle._oplogHandle.onSkippedEntries(finishIfNeedToPollQuery(function () {
    self._needToPollQuery();
  })));
  forEachTrigger(self._cursorDescription, function (trigger) {
    self._stopHandles.push(self._mongoHandle._oplogHandle.onOplogEntry(trigger, function (notification) {
      Meteor._noYieldsAllowed(finishIfNeedToPollQuery(function () {
        var op = notification.op;
        if (notification.dropCollection || notification.dropDatabase) {
          // Note: this call is not allowed to block on anything (especially
          // on waiting for oplog entries to catch up) because that will block
          // onOplogEntry!
          self._needToPollQuery();
        } else {
          // All other operators should be handled depending on phase
          if (self._phase === PHASE.QUERYING) {
            self._handleOplogEntryQuerying(op);
          } else {
            self._handleOplogEntrySteadyOrFetching(op);
          }
        }
      }));
    }));
  });

  // XXX ordering w.r.t. everything else?
  self._stopHandles.push(listenAll(self._cursorDescription, function (notification) {
    // If we're not in a pre-fire write fence, we don't have to do anything.
    var fence = DDPServer._CurrentWriteFence.get();
    if (!fence || fence.fired) return;
    if (fence._oplogObserveDrivers) {
      fence._oplogObserveDrivers[self._id] = self;
      return;
    }
    fence._oplogObserveDrivers = {};
    fence._oplogObserveDrivers[self._id] = self;
    fence.onBeforeFire(function () {
      var drivers = fence._oplogObserveDrivers;
      delete fence._oplogObserveDrivers;

      // This fence cannot fire until we've caught up to "this point" in the
      // oplog, and all observers made it back to the steady state.
      self._mongoHandle._oplogHandle.waitUntilCaughtUp();
      _.each(drivers, function (driver) {
        if (driver._stopped) return;
        var write = fence.beginWrite();
        if (driver._phase === PHASE.STEADY) {
          // Make sure that all of the callbacks have made it through the
          // multiplexer and been delivered to ObserveHandles before committing
          // writes.
          driver._multiplexer.onFlush(function () {
            write.committed();
          });
        } else {
          driver._writesToCommitWhenWeReachSteady.push(write);
        }
      });
    });
  }));

  // When Mongo fails over, we need to repoll the query, in case we processed an
  // oplog entry that got rolled back.
  self._stopHandles.push(self._mongoHandle._onFailover(finishIfNeedToPollQuery(function () {
    self._needToPollQuery();
  })));

  // Give _observeChanges a chance to add the new ObserveHandle to our
  // multiplexer, so that the added calls get streamed.
  Meteor.defer(finishIfNeedToPollQuery(function () {
    self._runInitialQuery();
  }));
};
_.extend(OplogObserveDriver.prototype, {
  _addPublished: function (id, doc) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      var fields = _.clone(doc);
      delete fields._id;
      self._published.set(id, self._sharedProjectionFn(doc));
      self._multiplexer.added(id, self._projectionFn(fields));

      // After adding this document, the published set might be overflowed
      // (exceeding capacity specified by limit). If so, push the maximum
      // element to the buffer, we might want to save it in memory to reduce the
      // amount of Mongo lookups in the future.
      if (self._limit && self._published.size() > self._limit) {
        // XXX in theory the size of published is no more than limit+1
        if (self._published.size() !== self._limit + 1) {
          throw new Error("After adding to published, " + (self._published.size() - self._limit) + " documents are overflowing the set");
        }
        var overflowingDocId = self._published.maxElementId();
        var overflowingDoc = self._published.get(overflowingDocId);
        if (EJSON.equals(overflowingDocId, id)) {
          throw new Error("The document just added is overflowing the published set");
        }
        self._published.remove(overflowingDocId);
        self._multiplexer.removed(overflowingDocId);
        self._addBuffered(overflowingDocId, overflowingDoc);
      }
    });
  },
  _removePublished: function (id) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._published.remove(id);
      self._multiplexer.removed(id);
      if (!self._limit || self._published.size() === self._limit) return;
      if (self._published.size() > self._limit) throw Error("self._published got too big");

      // OK, we are publishing less than the limit. Maybe we should look in the
      // buffer to find the next element past what we were publishing before.

      if (!self._unpublishedBuffer.empty()) {
        // There's something in the buffer; move the first thing in it to
        // _published.
        var newDocId = self._unpublishedBuffer.minElementId();
        var newDoc = self._unpublishedBuffer.get(newDocId);
        self._removeBuffered(newDocId);
        self._addPublished(newDocId, newDoc);
        return;
      }

      // There's nothing in the buffer.  This could mean one of a few things.

      // (a) We could be in the middle of re-running the query (specifically, we
      // could be in _publishNewResults). In that case, _unpublishedBuffer is
      // empty because we clear it at the beginning of _publishNewResults. In
      // this case, our caller already knows the entire answer to the query and
      // we don't need to do anything fancy here.  Just return.
      if (self._phase === PHASE.QUERYING) return;

      // (b) We're pretty confident that the union of _published and
      // _unpublishedBuffer contain all documents that match selector. Because
      // _unpublishedBuffer is empty, that means we're confident that _published
      // contains all documents that match selector. So we have nothing to do.
      if (self._safeAppendToBuffer) return;

      // (c) Maybe there are other documents out there that should be in our
      // buffer. But in that case, when we emptied _unpublishedBuffer in
      // _removeBuffered, we should have called _needToPollQuery, which will
      // either put something in _unpublishedBuffer or set _safeAppendToBuffer
      // (or both), and it will put us in QUERYING for that whole time. So in
      // fact, we shouldn't be able to get here.

      throw new Error("Buffer inexplicably empty");
    });
  },
  _changePublished: function (id, oldDoc, newDoc) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._published.set(id, self._sharedProjectionFn(newDoc));
      var projectedNew = self._projectionFn(newDoc);
      var projectedOld = self._projectionFn(oldDoc);
      var changed = DiffSequence.makeChangedFields(projectedNew, projectedOld);
      if (!_.isEmpty(changed)) self._multiplexer.changed(id, changed);
    });
  },
  _addBuffered: function (id, doc) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));

      // If something is overflowing the buffer, we just remove it from cache
      if (self._unpublishedBuffer.size() > self._limit) {
        var maxBufferedId = self._unpublishedBuffer.maxElementId();
        self._unpublishedBuffer.remove(maxBufferedId);

        // Since something matching is removed from cache (both published set and
        // buffer), set flag to false
        self._safeAppendToBuffer = false;
      }
    });
  },
  // Is called either to remove the doc completely from matching set or to move
  // it to the published set later.
  _removeBuffered: function (id) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._unpublishedBuffer.remove(id);
      // To keep the contract "buffer is never empty in STEADY phase unless the
      // everything matching fits into published" true, we poll everything as
      // soon as we see the buffer becoming empty.
      if (!self._unpublishedBuffer.size() && !self._safeAppendToBuffer) self._needToPollQuery();
    });
  },
  // Called when a document has joined the "Matching" results set.
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published
  // and the effect of limit enforced.
  _addMatching: function (doc) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      var id = doc._id;
      if (self._published.has(id)) throw Error("tried to add something already published " + id);
      if (self._limit && self._unpublishedBuffer.has(id)) throw Error("tried to add something already existed in buffer " + id);
      var limit = self._limit;
      var comparator = self._comparator;
      var maxPublished = limit && self._published.size() > 0 ? self._published.get(self._published.maxElementId()) : null;
      var maxBuffered = limit && self._unpublishedBuffer.size() > 0 ? self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;
      // The query is unlimited or didn't publish enough documents yet or the
      // new document would fit into published set pushing the maximum element
      // out, then we need to publish the doc.
      var toPublish = !limit || self._published.size() < limit || comparator(doc, maxPublished) < 0;

      // Otherwise we might need to buffer it (only in case of limited query).
      // Buffering is allowed if the buffer is not filled up yet and all
      // matching docs are either in the published set or in the buffer.
      var canAppendToBuffer = !toPublish && self._safeAppendToBuffer && self._unpublishedBuffer.size() < limit;

      // Or if it is small enough to be safely inserted to the middle or the
      // beginning of the buffer.
      var canInsertIntoBuffer = !toPublish && maxBuffered && comparator(doc, maxBuffered) <= 0;
      var toBuffer = canAppendToBuffer || canInsertIntoBuffer;
      if (toPublish) {
        self._addPublished(id, doc);
      } else if (toBuffer) {
        self._addBuffered(id, doc);
      } else {
        // dropping it and not saving to the cache
        self._safeAppendToBuffer = false;
      }
    });
  },
  // Called when a document leaves the "Matching" results set.
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published
  // and the effect of limit enforced.
  _removeMatching: function (id) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      if (!self._published.has(id) && !self._limit) throw Error("tried to remove something matching but not cached " + id);
      if (self._published.has(id)) {
        self._removePublished(id);
      } else if (self._unpublishedBuffer.has(id)) {
        self._removeBuffered(id);
      }
    });
  },
  _handleDoc: function (id, newDoc) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;
      var publishedBefore = self._published.has(id);
      var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
      var cachedBefore = publishedBefore || bufferedBefore;
      if (matchesNow && !cachedBefore) {
        self._addMatching(newDoc);
      } else if (cachedBefore && !matchesNow) {
        self._removeMatching(id);
      } else if (cachedBefore && matchesNow) {
        var oldDoc = self._published.get(id);
        var comparator = self._comparator;
        var minBuffered = self._limit && self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());
        var maxBuffered;
        if (publishedBefore) {
          // Unlimited case where the document stays in published once it
          // matches or the case when we don't have enough matching docs to
          // publish or the changed but matching doc will stay in published
          // anyways.
          //
          // XXX: We rely on the emptiness of buffer. Be sure to maintain the
          // fact that buffer can't be empty if there are matching documents not
          // published. Notably, we don't want to schedule repoll and continue
          // relying on this property.
          var staysInPublished = !self._limit || self._unpublishedBuffer.size() === 0 || comparator(newDoc, minBuffered) <= 0;
          if (staysInPublished) {
            self._changePublished(id, oldDoc, newDoc);
          } else {
            // after the change doc doesn't stay in the published, remove it
            self._removePublished(id);
            // but it can move into buffered now, check it
            maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
            var toBuffer = self._safeAppendToBuffer || maxBuffered && comparator(newDoc, maxBuffered) <= 0;
            if (toBuffer) {
              self._addBuffered(id, newDoc);
            } else {
              // Throw away from both published set and buffer
              self._safeAppendToBuffer = false;
            }
          }
        } else if (bufferedBefore) {
          oldDoc = self._unpublishedBuffer.get(id);
          // remove the old version manually instead of using _removeBuffered so
          // we don't trigger the querying immediately.  if we end this block
          // with the buffer empty, we will need to trigger the query poll
          // manually too.
          self._unpublishedBuffer.remove(id);
          var maxPublished = self._published.get(self._published.maxElementId());
          maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());

          // the buffered doc was updated, it could move to published
          var toPublish = comparator(newDoc, maxPublished) < 0;

          // or stays in buffer even after the change
          var staysInBuffer = !toPublish && self._safeAppendToBuffer || !toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0;
          if (toPublish) {
            self._addPublished(id, newDoc);
          } else if (staysInBuffer) {
            // stays in buffer but changes
            self._unpublishedBuffer.set(id, newDoc);
          } else {
            // Throw away from both published set and buffer
            self._safeAppendToBuffer = false;
            // Normally this check would have been done in _removeBuffered but
            // we didn't use it, so we need to do it ourself now.
            if (!self._unpublishedBuffer.size()) {
              self._needToPollQuery();
            }
          }
        } else {
          throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");
        }
      }
    });
  },
  _fetchModifiedDocuments: function () {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._registerPhaseChange(PHASE.FETCHING);
      // Defer, because nothing called from the oplog entry handler may yield,
      // but fetch() yields.
      Meteor.defer(finishIfNeedToPollQuery(function () {
        while (!self._stopped && !self._needToFetch.empty()) {
          if (self._phase === PHASE.QUERYING) {
            // While fetching, we decided to go into QUERYING mode, and then we
            // saw another oplog entry, so _needToFetch is not empty. But we
            // shouldn't fetch these documents until AFTER the query is done.
            break;
          }

          // Being in steady phase here would be surprising.
          if (self._phase !== PHASE.FETCHING) throw new Error("phase in fetchModifiedDocuments: " + self._phase);
          self._currentlyFetching = self._needToFetch;
          var thisGeneration = ++self._fetchGeneration;
          self._needToFetch = new LocalCollection._IdMap();
          var waiting = 0;
          var fut = new Future();
          // This loop is safe, because _currentlyFetching will not be updated
          // during this loop (in fact, it is never mutated).
          self._currentlyFetching.forEach(function (op, id) {
            waiting++;
            self._mongoHandle._docFetcher.fetch(self._cursorDescription.collectionName, id, op, finishIfNeedToPollQuery(function (err, doc) {
              try {
                if (err) {
                  Meteor._debug("Got exception while fetching documents", err);
                  // If we get an error from the fetcher (eg, trouble
                  // connecting to Mongo), let's just abandon the fetch phase
                  // altogether and fall back to polling. It's not like we're
                  // getting live updates anyway.
                  if (self._phase !== PHASE.QUERYING) {
                    self._needToPollQuery();
                  }
                } else if (!self._stopped && self._phase === PHASE.FETCHING && self._fetchGeneration === thisGeneration) {
                  // We re-check the generation in case we've had an explicit
                  // _pollQuery call (eg, in another fiber) which should
                  // effectively cancel this round of fetches.  (_pollQuery
                  // increments the generation.)
                  self._handleDoc(id, doc);
                }
              } finally {
                waiting--;
                // Because fetch() never calls its callback synchronously,
                // this is safe (ie, we won't call fut.return() before the
                // forEach is done).
                if (waiting === 0) fut.return();
              }
            }));
          });
          fut.wait();
          // Exit now if we've had a _pollQuery call (here or in another fiber).
          if (self._phase === PHASE.QUERYING) return;
          self._currentlyFetching = null;
        }
        // We're done fetching, so we can be steady, unless we've had a
        // _pollQuery call (here or in another fiber).
        if (self._phase !== PHASE.QUERYING) self._beSteady();
      }));
    });
  },
  _beSteady: function () {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._registerPhaseChange(PHASE.STEADY);
      var writes = self._writesToCommitWhenWeReachSteady;
      self._writesToCommitWhenWeReachSteady = [];
      self._multiplexer.onFlush(function () {
        _.each(writes, function (w) {
          w.committed();
        });
      });
    });
  },
  _handleOplogEntryQuerying: function (op) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      self._needToFetch.set(idForOp(op), op);
    });
  },
  _handleOplogEntrySteadyOrFetching: function (op) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      var id = idForOp(op);
      // If we're already fetching this one, or about to, we can't optimize;
      // make sure that we fetch it again if necessary.
      if (self._phase === PHASE.FETCHING && (self._currentlyFetching && self._currentlyFetching.has(id) || self._needToFetch.has(id))) {
        self._needToFetch.set(id, op);
        return;
      }
      if (op.op === 'd') {
        if (self._published.has(id) || self._limit && self._unpublishedBuffer.has(id)) self._removeMatching(id);
      } else if (op.op === 'i') {
        if (self._published.has(id)) throw new Error("insert found for already-existing ID in published");
        if (self._unpublishedBuffer && self._unpublishedBuffer.has(id)) throw new Error("insert found for already-existing ID in buffer");

        // XXX what if selector yields?  for now it can't but later it could
        // have $where
        if (self._matcher.documentMatches(op.o).result) self._addMatching(op.o);
      } else if (op.op === 'u') {
        // we are mapping the new oplog format on mongo 5
        // to what we know better, $set
        op.o = oplogV2V1Converter(op.o);
        // Is this a modifier ($set/$unset, which may require us to poll the
        // database to figure out if the whole document matches the selector) or
        // a replacement (in which case we can just directly re-evaluate the
        // selector)?
        // oplog format has changed on mongodb 5, we have to support both now
        // diff is the format in Mongo 5+ (oplog v2)
        var isReplace = !_.has(op.o, '$set') && !_.has(op.o, 'diff') && !_.has(op.o, '$unset');
        // If this modifier modifies something inside an EJSON custom type (ie,
        // anything with EJSON$), then we can't try to use
        // LocalCollection._modify, since that just mutates the EJSON encoding,
        // not the actual object.
        var canDirectlyModifyDoc = !isReplace && modifierCanBeDirectlyApplied(op.o);
        var publishedBefore = self._published.has(id);
        var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
        if (isReplace) {
          self._handleDoc(id, _.extend({
            _id: id
          }, op.o));
        } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {
          // Oh great, we actually know what the document is, so we can apply
          // this directly.
          var newDoc = self._published.has(id) ? self._published.get(id) : self._unpublishedBuffer.get(id);
          newDoc = EJSON.clone(newDoc);
          newDoc._id = id;
          try {
            LocalCollection._modify(newDoc, op.o);
          } catch (e) {
            if (e.name !== "MinimongoError") throw e;
            // We didn't understand the modifier.  Re-fetch.
            self._needToFetch.set(id, op);
            if (self._phase === PHASE.STEADY) {
              self._fetchModifiedDocuments();
            }
            return;
          }
          self._handleDoc(id, self._sharedProjectionFn(newDoc));
        } else if (!canDirectlyModifyDoc || self._matcher.canBecomeTrueByModifier(op.o) || self._sorter && self._sorter.affectedByModifier(op.o)) {
          self._needToFetch.set(id, op);
          if (self._phase === PHASE.STEADY) self._fetchModifiedDocuments();
        }
      } else {
        throw Error("XXX SURPRISING OPERATION: " + op);
      }
    });
  },
  // Yields!
  _runInitialQuery: function () {
    var self = this;
    if (self._stopped) throw new Error("oplog stopped surprisingly early");
    self._runQuery({
      initial: true
    }); // yields

    if (self._stopped) return; // can happen on queryError

    // Allow observeChanges calls to return. (After this, it's possible for
    // stop() to be called.)
    self._multiplexer.ready();
    self._doneQuerying(); // yields
  },

  // In various circumstances, we may just want to stop processing the oplog and
  // re-run the initial query, just as if we were a PollingObserveDriver.
  //
  // This function may not block, because it is called from an oplog entry
  // handler.
  //
  // XXX We should call this when we detect that we've been in FETCHING for "too
  // long".
  //
  // XXX We should call this when we detect Mongo failover (since that might
  // mean that some of the oplog entries we have processed have been rolled
  // back). The Node Mongo driver is in the middle of a bunch of huge
  // refactorings, including the way that it notifies you when primary
  // changes. Will put off implementing this until driver 1.4 is out.
  _pollQuery: function () {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      if (self._stopped) return;

      // Yay, we get to forget about all the things we thought we had to fetch.
      self._needToFetch = new LocalCollection._IdMap();
      self._currentlyFetching = null;
      ++self._fetchGeneration; // ignore any in-flight fetches
      self._registerPhaseChange(PHASE.QUERYING);

      // Defer so that we don't yield.  We don't need finishIfNeedToPollQuery
      // here because SwitchedToQuery is not thrown in QUERYING mode.
      Meteor.defer(function () {
        self._runQuery();
        self._doneQuerying();
      });
    });
  },
  // Yields!
  _runQuery: function (options) {
    var self = this;
    options = options || {};
    var newResults, newBuffer;

    // This while loop is just to retry failures.
    while (true) {
      // If we've been stopped, we don't have to run anything any more.
      if (self._stopped) return;
      newResults = new LocalCollection._IdMap();
      newBuffer = new LocalCollection._IdMap();

      // Query 2x documents as the half excluded from the original query will go
      // into unpublished buffer to reduce additional Mongo lookups in cases
      // when documents are removed from the published set and need a
      // replacement.
      // XXX needs more thought on non-zero skip
      // XXX 2 is a "magic number" meaning there is an extra chunk of docs for
      // buffer if such is needed.
      var cursor = self._cursorForQuery({
        limit: self._limit * 2
      });
      try {
        cursor.forEach(function (doc, i) {
          // yields
          if (!self._limit || i < self._limit) {
            newResults.set(doc._id, doc);
          } else {
            newBuffer.set(doc._id, doc);
          }
        });
        break;
      } catch (e) {
        if (options.initial && typeof e.code === 'number') {
          // This is an error document sent to us by mongod, not a connection
          // error generated by the client. And we've never seen this query work
          // successfully. Probably it's a bad selector or something, so we
          // should NOT retry. Instead, we should halt the observe (which ends
          // up calling `stop` on us).
          self._multiplexer.queryError(e);
          return;
        }

        // During failover (eg) if we get an exception we should log and retry
        // instead of crashing.
        Meteor._debug("Got exception while polling query", e);
        Meteor._sleepForMs(100);
      }
    }
    if (self._stopped) return;
    self._publishNewResults(newResults, newBuffer);
  },
  // Transitions to QUERYING and runs another query, or (if already in QUERYING)
  // ensures that we will query again later.
  //
  // This function may not block, because it is called from an oplog entry
  // handler. However, if we were not already in the QUERYING phase, it throws
  // an exception that is caught by the closest surrounding
  // finishIfNeedToPollQuery call; this ensures that we don't continue running
  // close that was designed for another phase inside PHASE.QUERYING.
  //
  // (It's also necessary whenever logic in this file yields to check that other
  // phases haven't put us into QUERYING mode, though; eg,
  // _fetchModifiedDocuments does this.)
  _needToPollQuery: function () {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      if (self._stopped) return;

      // If we're not already in the middle of a query, we can query now
      // (possibly pausing FETCHING).
      if (self._phase !== PHASE.QUERYING) {
        self._pollQuery();
        throw new SwitchedToQuery();
      }

      // We're currently in QUERYING. Set a flag to ensure that we run another
      // query when we're done.
      self._requeryWhenDoneThisQuery = true;
    });
  },
  // Yields!
  _doneQuerying: function () {
    var self = this;
    if (self._stopped) return;
    self._mongoHandle._oplogHandle.waitUntilCaughtUp(); // yields
    if (self._stopped) return;
    if (self._phase !== PHASE.QUERYING) throw Error("Phase unexpectedly " + self._phase);
    Meteor._noYieldsAllowed(function () {
      if (self._requeryWhenDoneThisQuery) {
        self._requeryWhenDoneThisQuery = false;
        self._pollQuery();
      } else if (self._needToFetch.empty()) {
        self._beSteady();
      } else {
        self._fetchModifiedDocuments();
      }
    });
  },
  _cursorForQuery: function (optionsOverwrite) {
    var self = this;
    return Meteor._noYieldsAllowed(function () {
      // The query we run is almost the same as the cursor we are observing,
      // with a few changes. We need to read all the fields that are relevant to
      // the selector, not just the fields we are going to publish (that's the
      // "shared" projection). And we don't want to apply any transform in the
      // cursor, because observeChanges shouldn't use the transform.
      var options = _.clone(self._cursorDescription.options);

      // Allow the caller to modify the options. Useful to specify different
      // skip and limit values.
      _.extend(options, optionsOverwrite);
      options.fields = self._sharedProjection;
      delete options.transform;
      // We are NOT deep cloning fields or selector here, which should be OK.
      var description = new CursorDescription(self._cursorDescription.collectionName, self._cursorDescription.selector, options);
      return new Cursor(self._mongoHandle, description);
    });
  },
  // Replace self._published with newResults (both are IdMaps), invoking observe
  // callbacks on the multiplexer.
  // Replace self._unpublishedBuffer with newBuffer.
  //
  // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We
  // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict
  // (b) Rewrite diff.js to use these classes instead of arrays and objects.
  _publishNewResults: function (newResults, newBuffer) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      // If the query is limited and there is a buffer, shut down so it doesn't
      // stay in a way.
      if (self._limit) {
        self._unpublishedBuffer.clear();
      }

      // First remove anything that's gone. Be careful not to modify
      // self._published while iterating over it.
      var idsToRemove = [];
      self._published.forEach(function (doc, id) {
        if (!newResults.has(id)) idsToRemove.push(id);
      });
      _.each(idsToRemove, function (id) {
        self._removePublished(id);
      });

      // Now do adds and changes.
      // If self has a buffer and limit, the new fetched result will be
      // limited correctly as the query has sort specifier.
      newResults.forEach(function (doc, id) {
        self._handleDoc(id, doc);
      });

      // Sanity-check that everything we tried to put into _published ended up
      // there.
      // XXX if this is slow, remove it later
      if (self._published.size() !== newResults.size()) {
        console.error('The Mongo server and the Meteor query disagree on how ' + 'many documents match your query. Cursor description: ', self._cursorDescription);
        throw Error("The Mongo server and the Meteor query disagree on how " + "many documents match your query. Maybe it is hitting a Mongo " + "edge case? The query is: " + EJSON.stringify(self._cursorDescription.selector));
      }
      self._published.forEach(function (doc, id) {
        if (!newResults.has(id)) throw Error("_published has a doc that newResults doesn't; " + id);
      });

      // Finally, replace the buffer
      newBuffer.forEach(function (doc, id) {
        self._addBuffered(id, doc);
      });
      self._safeAppendToBuffer = newBuffer.size() < self._limit;
    });
  },
  // This stop function is invoked from the onStop of the ObserveMultiplexer, so
  // it shouldn't actually be possible to call it until the multiplexer is
  // ready.
  //
  // It's important to check self._stopped after every call in this file that
  // can yield!
  stop: function () {
    var self = this;
    if (self._stopped) return;
    self._stopped = true;
    _.each(self._stopHandles, function (handle) {
      handle.stop();
    });

    // Note: we *don't* use multiplexer.onFlush here because this stop
    // callback is actually invoked by the multiplexer itself when it has
    // determined that there are no handles left. So nothing is actually going
    // to get flushed (and it's probably not valid to call methods on the
    // dying multiplexer).
    _.each(self._writesToCommitWhenWeReachSteady, function (w) {
      w.committed(); // maybe yields?
    });

    self._writesToCommitWhenWeReachSteady = null;

    // Proactively drop references to potentially big things.
    self._published = null;
    self._unpublishedBuffer = null;
    self._needToFetch = null;
    self._currentlyFetching = null;
    self._oplogEntryHandle = null;
    self._listenersHandle = null;
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", -1);
  },
  _registerPhaseChange: function (phase) {
    var self = this;
    Meteor._noYieldsAllowed(function () {
      var now = new Date();
      if (self._phase) {
        var timeDiff = now - self._phaseStartTime;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);
      }
      self._phase = phase;
      self._phaseStartTime = now;
    });
  }
});

// Does our oplog tailing code support this cursor? For now, we are being very
// conservative and allowing only simple queries with simple options.
// (This is a "static method".)
OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {
  // First, check the options.
  var options = cursorDescription.options;

  // Did the user say no explicitly?
  // underscored version of the option is COMPAT with 1.2
  if (options.disableOplog || options._disableOplog) return false;

  // skip is not supported: to support it we would need to keep track of all
  // "skipped" documents or at least their ids.
  // limit w/o a sort specifier is not supported: current implementation needs a
  // deterministic way to order documents.
  if (options.skip || options.limit && !options.sort) return false;

  // If a fields projection option is given check if it is supported by
  // minimongo (some operators are not supported).
  const fields = options.fields || options.projection;
  if (fields) {
    try {
      LocalCollection._checkSupportedProjection(fields);
    } catch (e) {
      if (e.name === "MinimongoError") {
        return false;
      } else {
        throw e;
      }
    }
  }

  // We don't allow the following selectors:
  //   - $where (not confident that we provide the same JS environment
  //             as Mongo, and can yield!)
  //   - $near (has "interesting" properties in MongoDB, like the possibility
  //            of returning an ID multiple times, though even polling maybe
  //            have a bug there)
  //           XXX: once we support it, we would need to think more on how we
  //           initialize the comparators when we create the driver.
  return !matcher.hasWhere() && !matcher.hasGeoQuery();
};
var modifierCanBeDirectlyApplied = function (modifier) {
  return _.all(modifier, function (fields, operation) {
    return _.all(fields, function (value, field) {
      return !/EJSON\$/.test(field);
    });
  });
};
MongoInternals.OplogObserveDriver = OplogObserveDriver;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_v2_converter.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_v2_converter.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  oplogV2V1Converter: () => oplogV2V1Converter
});
// Converter of the new MongoDB Oplog format (>=5.0) to the one that Meteor
// handles well, i.e., `$set` and `$unset`. The new format is completely new,
// and looks as follows:
//
//   { $v: 2, diff: Diff }
//
// where `Diff` is a recursive structure:
//
//   {
//     // Nested updates (sometimes also represented with an s-field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     i: { <key>: <value>, ... },
//
//     // Top-level updates.
//     // Example: `{ $set: { foo: { bar: 1 } } }`.
//     u: { <key>: <value>, ... },
//
//     // Unsets.
//     // Example: `{ $unset: { foo: '' } }`.
//     d: { <key>: false, ... },
//
//     // Array operations.
//     // Example: `{ $push: { foo: 'bar' } }`.
//     s<key>: { a: true, u<index>: <value>, ... },
//     ...
//
//     // Nested operations (sometimes also represented in the `i` field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     s<key>: Diff,
//     ...
//   }
//
// (all fields are optional).

function join(prefix, key) {
  return prefix ? "".concat(prefix, ".").concat(key) : key;
}
const arrayOperatorKeyRegex = /^(a|[su]\d+)$/;
function isArrayOperatorKey(field) {
  return arrayOperatorKeyRegex.test(field);
}
function isArrayOperator(operator) {
  return operator.a === true && Object.keys(operator).every(isArrayOperatorKey);
}
function flattenObjectInto(target, source, prefix) {
  if (Array.isArray(source) || typeof source !== 'object' || source === null) {
    target[prefix] = source;
  } else {
    const entries = Object.entries(source);
    if (entries.length) {
      entries.forEach(_ref => {
        let [key, value] = _ref;
        flattenObjectInto(target, value, join(prefix, key));
      });
    } else {
      target[prefix] = source;
    }
  }
}
const logDebugMessages = !!process.env.OPLOG_CONVERTER_DEBUG;
function convertOplogDiff(oplogEntry, diff, prefix) {
  if (logDebugMessages) {
    console.log("convertOplogDiff(".concat(JSON.stringify(oplogEntry), ", ").concat(JSON.stringify(diff), ", ").concat(JSON.stringify(prefix), ")"));
  }
  Object.entries(diff).forEach(_ref2 => {
    let [diffKey, value] = _ref2;
    if (diffKey === 'd') {
      var _oplogEntry$$unset;
      // Handle `$unset`s.
      (_oplogEntry$$unset = oplogEntry.$unset) !== null && _oplogEntry$$unset !== void 0 ? _oplogEntry$$unset : oplogEntry.$unset = {};
      Object.keys(value).forEach(key => {
        oplogEntry.$unset[join(prefix, key)] = true;
      });
    } else if (diffKey === 'i') {
      var _oplogEntry$$set;
      // Handle (potentially) nested `$set`s.
      (_oplogEntry$$set = oplogEntry.$set) !== null && _oplogEntry$$set !== void 0 ? _oplogEntry$$set : oplogEntry.$set = {};
      flattenObjectInto(oplogEntry.$set, value, prefix);
    } else if (diffKey === 'u') {
      var _oplogEntry$$set2;
      // Handle flat `$set`s.
      (_oplogEntry$$set2 = oplogEntry.$set) !== null && _oplogEntry$$set2 !== void 0 ? _oplogEntry$$set2 : oplogEntry.$set = {};
      Object.entries(value).forEach(_ref3 => {
        let [key, value] = _ref3;
        oplogEntry.$set[join(prefix, key)] = value;
      });
    } else {
      // Handle s-fields.
      const key = diffKey.slice(1);
      if (isArrayOperator(value)) {
        // Array operator.
        Object.entries(value).forEach(_ref4 => {
          let [position, value] = _ref4;
          if (position === 'a') {
            return;
          }
          const positionKey = join(join(prefix, key), position.slice(1));
          if (position[0] === 's') {
            convertOplogDiff(oplogEntry, value, positionKey);
          } else if (value === null) {
            var _oplogEntry$$unset2;
            (_oplogEntry$$unset2 = oplogEntry.$unset) !== null && _oplogEntry$$unset2 !== void 0 ? _oplogEntry$$unset2 : oplogEntry.$unset = {};
            oplogEntry.$unset[positionKey] = true;
          } else {
            var _oplogEntry$$set3;
            (_oplogEntry$$set3 = oplogEntry.$set) !== null && _oplogEntry$$set3 !== void 0 ? _oplogEntry$$set3 : oplogEntry.$set = {};
            oplogEntry.$set[positionKey] = value;
          }
        });
      } else if (key) {
        // Nested object.
        convertOplogDiff(oplogEntry, value, join(prefix, key));
      }
    }
  });
}
function oplogV2V1Converter(oplogEntry) {
  // Pass-through v1 and (probably) invalid entries.
  if (oplogEntry.$v !== 2 || !oplogEntry.diff) {
    return oplogEntry;
  }
  const convertedOplogEntry = {
    $v: 2
  };
  convertOplogDiff(convertedOplogEntry, oplogEntry.diff, '');
  return convertedOplogEntry;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/local_collection_driver.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  LocalCollectionDriver: () => LocalCollectionDriver
});
const LocalCollectionDriver = new class LocalCollectionDriver {
  constructor() {
    this.noConnCollections = Object.create(null);
  }
  open(name, conn) {
    if (!name) {
      return new LocalCollection();
    }
    if (!conn) {
      return ensureCollection(name, this.noConnCollections);
    }
    if (!conn._mongo_livedata_collections) {
      conn._mongo_livedata_collections = Object.create(null);
    }

    // XXX is there a way to keep track of a connection's collections without
    // dangling it off the connection object?
    return ensureCollection(name, conn._mongo_livedata_collections);
  }
}();
function ensureCollection(name, collections) {
  return name in collections ? collections[name] : collections[name] = new LocalCollection(name);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"remote_collection_driver.js":function module(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/remote_collection_driver.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
MongoInternals.RemoteCollectionDriver = function (mongo_url, options) {
  var self = this;
  self.mongo = new MongoConnection(mongo_url, options);
};
const REMOTE_COLLECTION_METHODS = ['_createCappedCollection', '_dropIndex', '_ensureIndex', 'createIndex', 'countDocuments', 'dropCollection', 'estimatedDocumentCount', 'find', 'findOne', 'insert', 'rawCollection', 'remove', 'update', 'upsert'];
Object.assign(MongoInternals.RemoteCollectionDriver.prototype, {
  open: function (name) {
    var self = this;
    var ret = {};
    REMOTE_COLLECTION_METHODS.forEach(function (m) {
      ret[m] = _.bind(self.mongo[m], self.mongo, name);
    });
    return ret;
  }
});

// Create the singleton RemoteCollectionDriver only on demand, so we
// only require Mongo configuration if it's actually used (eg, not if
// you're only trying to receive data from a remote DDP server.)
MongoInternals.defaultRemoteCollectionDriver = _.once(function () {
  var connectionOptions = {};
  var mongoUrl = process.env.MONGO_URL;
  if (process.env.MONGO_OPLOG_URL) {
    connectionOptions.oplogUrl = process.env.MONGO_OPLOG_URL;
  }
  if (!mongoUrl) throw new Error("MONGO_URL must be set in environment");
  const driver = new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);

  // As many deployment tools, including Meteor Up, send requests to the app in
  // order to confirm that the deployment finished successfully, it's required
  // to know about a database connection problem before the app starts. Doing so
  // in a `Meteor.startup` is fine, as the `WebApp` handles requests only after
  // all are finished.
  Meteor.startup(() => {
    Promise.await(driver.mongo.client.connect());
  });
  return driver;
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"collection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!function (module1) {
  let _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default(v) {
      _objectSpread = v;
    }
  }, 0);
  let ASYNC_COLLECTION_METHODS, getAsyncMethodName;
  module1.link("meteor/minimongo/constants", {
    ASYNC_COLLECTION_METHODS(v) {
      ASYNC_COLLECTION_METHODS = v;
    },
    getAsyncMethodName(v) {
      getAsyncMethodName = v;
    }
  }, 0);
  let normalizeProjection;
  module1.link("./mongo_utils", {
    normalizeProjection(v) {
      normalizeProjection = v;
    }
  }, 1);
  /**
   * @summary Namespace for MongoDB-related items
   * @namespace
   */
  Mongo = {};

  /**
   * @summary Constructor for a Collection
   * @locus Anywhere
   * @instancename collection
   * @class
   * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
   * @param {Object} [options]
   * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#ddp_connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
   * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
  
   - **`'STRING'`**: random strings
   - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values
  
  The default id generation technique is `'STRING'`.
   * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOne`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
   * @param {Boolean} options.defineMutationMethods Set to `false` to skip setting up the mutation methods that enable insert/update/remove from client code. Default `true`.
   */
  Mongo.Collection = function Collection(name, options) {
    if (!name && name !== null) {
      Meteor._debug('Warning: creating anonymous collection. It will not be ' + 'saved or synchronized over the network. (Pass null for ' + 'the collection name to turn off this warning.)');
      name = null;
    }
    if (name !== null && typeof name !== 'string') {
      throw new Error('First argument to new Mongo.Collection must be a string or null');
    }
    if (options && options.methods) {
      // Backwards compatibility hack with original signature (which passed
      // "connection" directly instead of in options. (Connections must have a "methods"
      // method.)
      // XXX remove before 1.0
      options = {
        connection: options
      };
    }
    // Backwards compatibility: "connection" used to be called "manager".
    if (options && options.manager && !options.connection) {
      options.connection = options.manager;
    }
    options = _objectSpread({
      connection: undefined,
      idGeneration: 'STRING',
      transform: null,
      _driver: undefined,
      _preventAutopublish: false
    }, options);
    switch (options.idGeneration) {
      case 'MONGO':
        this._makeNewID = function () {
          var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
          return new Mongo.ObjectID(src.hexString(24));
        };
        break;
      case 'STRING':
      default:
        this._makeNewID = function () {
          var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
          return src.id();
        };
        break;
    }
    this._transform = LocalCollection.wrapTransform(options.transform);
    if (!name || options.connection === null)
      // note: nameless collections never have a connection
      this._connection = null;else if (options.connection) this._connection = options.connection;else if (Meteor.isClient) this._connection = Meteor.connection;else this._connection = Meteor.server;
    if (!options._driver) {
      // XXX This check assumes that webapp is loaded so that Meteor.server !==
      // null. We should fully support the case of "want to use a Mongo-backed
      // collection from Node code without webapp", but we don't yet.
      // #MeteorServerNull
      if (name && this._connection === Meteor.server && typeof MongoInternals !== 'undefined' && MongoInternals.defaultRemoteCollectionDriver) {
        options._driver = MongoInternals.defaultRemoteCollectionDriver();
      } else {
        const {
          LocalCollectionDriver
        } = require('./local_collection_driver.js');
        options._driver = LocalCollectionDriver;
      }
    }
    this._collection = options._driver.open(name, this._connection);
    this._name = name;
    this._driver = options._driver;
    this._maybeSetUpReplication(name, options);

    // XXX don't define these until allow or deny is actually used for this
    // collection. Could be hard if the security rules are only defined on the
    // server.
    if (options.defineMutationMethods !== false) {
      try {
        this._defineMutationMethods({
          useExisting: options._suppressSameNameError === true
        });
      } catch (error) {
        // Throw a more understandable error on the server for same collection name
        if (error.message === "A method named '/".concat(name, "/insert' is already defined")) throw new Error("There is already a collection named \"".concat(name, "\""));
        throw error;
      }
    }

    // autopublish
    if (Package.autopublish && !options._preventAutopublish && this._connection && this._connection.publish) {
      this._connection.publish(null, () => this.find(), {
        is_auto: true
      });
    }
  };
  Object.assign(Mongo.Collection.prototype, {
    _maybeSetUpReplication(name, _ref2) {
      let {
        _suppressSameNameError = false
      } = _ref2;
      const self = this;
      if (!(self._connection && self._connection.registerStore)) {
        return;
      }

      // OK, we're going to be a slave, replicating some remote
      // database, except possibly with some temporary divergence while
      // we have unacknowledged RPC's.
      const ok = self._connection.registerStore(name, {
        // Called at the beginning of a batch of updates. batchSize is the number
        // of update calls to expect.
        //
        // XXX This interface is pretty janky. reset probably ought to go back to
        // being its own function, and callers shouldn't have to calculate
        // batchSize. The optimization of not calling pause/remove should be
        // delayed until later: the first call to update() should buffer its
        // message, and then we can either directly apply it at endUpdate time if
        // it was the only update, or do pauseObservers/apply/apply at the next
        // update() if there's another one.
        beginUpdate(batchSize, reset) {
          // pause observers so users don't see flicker when updating several
          // objects at once (including the post-reconnect reset-and-reapply
          // stage), and so that a re-sorting of a query can take advantage of the
          // full _diffQuery moved calculation instead of applying change one at a
          // time.
          if (batchSize > 1 || reset) self._collection.pauseObservers();
          if (reset) self._collection.remove({});
        },
        // Apply an update.
        // XXX better specify this interface (not in terms of a wire message)?
        update(msg) {
          var mongoId = MongoID.idParse(msg.id);
          var doc = self._collection._docs.get(mongoId);

          //When the server's mergebox is disabled for a collection, the client must gracefully handle it when:
          // *We receive an added message for a document that is already there. Instead, it will be changed
          // *We reeive a change message for a document that is not there. Instead, it will be added
          // *We receive a removed messsage for a document that is not there. Instead, noting wil happen.

          //Code is derived from client-side code originally in peerlibrary:control-mergebox
          //https://github.com/peerlibrary/meteor-control-mergebox/blob/master/client.coffee

          //For more information, refer to discussion "Initial support for publication strategies in livedata server":
          //https://github.com/meteor/meteor/pull/11151
          if (Meteor.isClient) {
            if (msg.msg === 'added' && doc) {
              msg.msg = 'changed';
            } else if (msg.msg === 'removed' && !doc) {
              return;
            } else if (msg.msg === 'changed' && !doc) {
              msg.msg = 'added';
              _ref = msg.fields;
              for (field in _ref) {
                value = _ref[field];
                if (value === void 0) {
                  delete msg.fields[field];
                }
              }
            }
          }

          // Is this a "replace the whole doc" message coming from the quiescence
          // of method writes to an object? (Note that 'undefined' is a valid
          // value meaning "remove it".)
          if (msg.msg === 'replace') {
            var replace = msg.replace;
            if (!replace) {
              if (doc) self._collection.remove(mongoId);
            } else if (!doc) {
              self._collection.insert(replace);
            } else {
              // XXX check that replace has no $ ops
              self._collection.update(mongoId, replace);
            }
            return;
          } else if (msg.msg === 'added') {
            if (doc) {
              throw new Error('Expected not to find a document already present for an add');
            }
            self._collection.insert(_objectSpread({
              _id: mongoId
            }, msg.fields));
          } else if (msg.msg === 'removed') {
            if (!doc) throw new Error('Expected to find a document already present for removed');
            self._collection.remove(mongoId);
          } else if (msg.msg === 'changed') {
            if (!doc) throw new Error('Expected to find a document to change');
            const keys = Object.keys(msg.fields);
            if (keys.length > 0) {
              var modifier = {};
              keys.forEach(key => {
                const value = msg.fields[key];
                if (EJSON.equals(doc[key], value)) {
                  return;
                }
                if (typeof value === 'undefined') {
                  if (!modifier.$unset) {
                    modifier.$unset = {};
                  }
                  modifier.$unset[key] = 1;
                } else {
                  if (!modifier.$set) {
                    modifier.$set = {};
                  }
                  modifier.$set[key] = value;
                }
              });
              if (Object.keys(modifier).length > 0) {
                self._collection.update(mongoId, modifier);
              }
            }
          } else {
            throw new Error("I don't know how to deal with this message");
          }
        },
        // Called at the end of a batch of updates.
        endUpdate() {
          self._collection.resumeObservers();
        },
        // Called around method stub invocations to capture the original versions
        // of modified documents.
        saveOriginals() {
          self._collection.saveOriginals();
        },
        retrieveOriginals() {
          return self._collection.retrieveOriginals();
        },
        // Used to preserve current versions of documents across a store reset.
        getDoc(id) {
          return self.findOne(id);
        },
        // To be able to get back to the collection from the store.
        _getCollection() {
          return self;
        }
      });
      if (!ok) {
        const message = "There is already a collection named \"".concat(name, "\"");
        if (_suppressSameNameError === true) {
          // XXX In theory we do not have to throw when `ok` is falsy. The
          // store is already defined for this collection name, but this
          // will simply be another reference to it and everything should
          // work. However, we have historically thrown an error here, so
          // for now we will skip the error only when _suppressSameNameError
          // is `true`, allowing people to opt in and give this some real
          // world testing.
          console.warn ? console.warn(message) : console.log(message);
        } else {
          throw new Error(message);
        }
      }
    },
    ///
    /// Main collection API
    ///
    /**
     * @summary Gets the number of documents matching the filter. For a fast count of the total documents in a collection see `estimatedDocumentCount`.
     * @locus Anywhere
     * @method countDocuments
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} [selector] A query describing the documents to count
     * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/CountDocumentsOptions.html). Please note that not all of them are available on the client.
     * @returns {Promise<number>}
     */
    countDocuments() {
      return this._collection.countDocuments(...arguments);
    },
    /**
     * @summary Gets an estimate of the count of documents in a collection using collection metadata. For an exact count of the documents in a collection see `countDocuments`.
     * @locus Anywhere
     * @method estimatedDocumentCount
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} [selector] A query describing the documents to count
     * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/EstimatedDocumentCountOptions.html). Please note that not all of them are available on the client.
     * @returns {Promise<number>}
     */
    estimatedDocumentCount() {
      return this._collection.estimatedDocumentCount(...arguments);
    },
    _getFindSelector(args) {
      if (args.length == 0) return {};else return args[0];
    },
    _getFindOptions(args) {
      const [, options] = args || [];
      const newOptions = normalizeProjection(options);
      var self = this;
      if (args.length < 2) {
        return {
          transform: self._transform
        };
      } else {
        check(newOptions, Match.Optional(Match.ObjectIncluding({
          projection: Match.Optional(Match.OneOf(Object, undefined)),
          sort: Match.Optional(Match.OneOf(Object, Array, Function, undefined)),
          limit: Match.Optional(Match.OneOf(Number, undefined)),
          skip: Match.Optional(Match.OneOf(Number, undefined))
        })));
        return _objectSpread({
          transform: self._transform
        }, newOptions);
      }
    },
    /**
     * @summary Find the documents in a collection that match the selector.
     * @locus Anywhere
     * @method find
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} [selector] A query describing the documents to find
     * @param {Object} [options]
     * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
     * @param {Number} options.skip Number of results to skip at the beginning
     * @param {Number} options.limit Maximum number of results to return
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity
     * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
     * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
     * @param {Number} options.pollingIntervalMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds).
     * @param {Number} options.pollingThrottleMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms.
     * @param {Number} options.maxTimeMs (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error.
     * @param {String|Object} options.hint (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify `{ $natural : 1 }` to force a forwards collection scan, or `{ $natural : -1 }` for a reverse collection scan. Setting this is only recommended for advanced users.
     * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for this particular cursor. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
     * @returns {Mongo.Cursor}
     */
    find() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      // Collection.find() (return all docs) behaves differently
      // from Collection.find(undefined) (return 0 docs).  so be
      // careful about the length of arguments.
      return this._collection.find(this._getFindSelector(args), this._getFindOptions(args));
    },
    /**
     * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
     * @locus Anywhere
     * @method findOne
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} [selector] A query describing the documents to find
     * @param {Object} [options]
     * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
     * @param {Number} options.skip Number of results to skip at the beginning
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
     * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
     * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
     * @returns {Object}
     */
    findOne() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      return this._collection.findOne(this._getFindSelector(args), this._getFindOptions(args));
    }
  });
  Object.assign(Mongo.Collection, {
    _publishCursor(cursor, sub, collection) {
      var observeHandle = cursor.observeChanges({
        added: function (id, fields) {
          sub.added(collection, id, fields);
        },
        changed: function (id, fields) {
          sub.changed(collection, id, fields);
        },
        removed: function (id) {
          sub.removed(collection, id);
        }
      },
      // Publications don't mutate the documents
      // This is tested by the `livedata - publish callbacks clone` test
      {
        nonMutatingCallbacks: true
      });

      // We don't call sub.ready() here: it gets called in livedata_server, after
      // possibly calling _publishCursor on multiple returned cursors.

      // register stop callback (expects lambda w/ no args).
      sub.onStop(function () {
        observeHandle.stop();
      });

      // return the observeHandle in case it needs to be stopped early
      return observeHandle;
    },
    // protect against dangerous selectors.  falsey and {_id: falsey} are both
    // likely programmer error, and not what you want, particularly for destructive
    // operations. If a falsey _id is sent in, a new string _id will be
    // generated and returned; if a fallbackId is provided, it will be returned
    // instead.
    _rewriteSelector(selector) {
      let {
        fallbackId
      } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      // shorthand -- scalars match _id
      if (LocalCollection._selectorIsId(selector)) selector = {
        _id: selector
      };
      if (Array.isArray(selector)) {
        // This is consistent with the Mongo console itself; if we don't do this
        // check passing an empty array ends up selecting all items
        throw new Error("Mongo selector can't be an array.");
      }
      if (!selector || '_id' in selector && !selector._id) {
        // can't match anything
        return {
          _id: fallbackId || Random.id()
        };
      }
      return selector;
    }
  });
  Object.assign(Mongo.Collection.prototype, {
    // 'insert' immediately returns the inserted document's new _id.
    // The others return values immediately if you are in a stub, an in-memory
    // unmanaged collection, or a mongo-backed collection and you don't pass a
    // callback. 'update' and 'remove' return the number of affected
    // documents. 'upsert' returns an object with keys 'numberAffected' and, if an
    // insert happened, 'insertedId'.
    //
    // Otherwise, the semantics are exactly like other methods: they take
    // a callback as an optional last argument; if no callback is
    // provided, they block until the operation is complete, and throw an
    // exception if it fails; if a callback is provided, then they don't
    // necessarily block, and they call the callback when they finish with error and
    // result arguments.  (The insert method provides the document ID as its result;
    // update and remove provide the number of affected docs as the result; upsert
    // provides an object with numberAffected and maybe insertedId.)
    //
    // On the client, blocking is impossible, so if a callback
    // isn't provided, they just return immediately and any error
    // information is lost.
    //
    // There's one more tweak. On the client, if you don't provide a
    // callback, then if there is an error, a message will be logged with
    // Meteor._debug.
    //
    // The intent (though this is actually determined by the underlying
    // drivers) is that the operations should be done synchronously, not
    // generating their result until the database has acknowledged
    // them. In the future maybe we should provide a flag to turn this
    // off.

    /**
     * @summary Insert a document in the collection.  Returns its unique _id.
     * @locus Anywhere
     * @method  insert
     * @memberof Mongo.Collection
     * @instance
     * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
     * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
     */
    insert(doc, callback) {
      // Make sure we were passed a document to insert
      if (!doc) {
        throw new Error('insert requires an argument');
      }

      // Make a shallow clone of the document, preserving its prototype.
      doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
      if ('_id' in doc) {
        if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
          throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
        }
      } else {
        let generateId = true;

        // Don't generate the id if we're the client and the 'outermost' call
        // This optimization saves us passing both the randomSeed and the id
        // Passing both is redundant.
        if (this._isRemoteCollection()) {
          const enclosing = DDP._CurrentMethodInvocation.get();
          if (!enclosing) {
            generateId = false;
          }
        }
        if (generateId) {
          doc._id = this._makeNewID();
        }
      }

      // On inserts, always return the id that we generated; on all other
      // operations, just return the result from the collection.
      var chooseReturnValueFromCollectionResult = function (result) {
        if (doc._id) {
          return doc._id;
        }

        // XXX what is this for??
        // It's some iteraction between the callback to _callMutatorMethod and
        // the return value conversion
        doc._id = result;
        return result;
      };
      const wrappedCallback = wrapCallback(callback, chooseReturnValueFromCollectionResult);
      if (this._isRemoteCollection()) {
        const result = this._callMutatorMethod('insert', [doc], wrappedCallback);
        return chooseReturnValueFromCollectionResult(result);
      }

      // it's my collection.  descend into the collection object
      // and propagate any exception.
      try {
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        const result = this._collection.insert(doc, wrappedCallback);
        return chooseReturnValueFromCollectionResult(result);
      } catch (e) {
        if (callback) {
          callback(e);
          return null;
        }
        throw e;
      }
    },
    /**
     * @summary Modify one or more documents in the collection. Returns the number of matched documents.
     * @locus Anywhere
     * @method update
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} selector Specifies which documents to modify
     * @param {MongoModifier} modifier Specifies how to modify the documents
     * @param {Object} [options]
     * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
     * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
     * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
     * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
     */
    update(selector, modifier) {
      for (var _len3 = arguments.length, optionsAndCallback = new Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
        optionsAndCallback[_key3 - 2] = arguments[_key3];
      }
      const callback = popCallbackFromArgs(optionsAndCallback);

      // We've already popped off the callback, so we are left with an array
      // of one or zero items
      const options = _objectSpread({}, optionsAndCallback[0] || null);
      let insertedId;
      if (options && options.upsert) {
        // set `insertedId` if absent.  `insertedId` is a Meteor extension.
        if (options.insertedId) {
          if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
          insertedId = options.insertedId;
        } else if (!selector || !selector._id) {
          insertedId = this._makeNewID();
          options.generatedId = true;
          options.insertedId = insertedId;
        }
      }
      selector = Mongo.Collection._rewriteSelector(selector, {
        fallbackId: insertedId
      });
      const wrappedCallback = wrapCallback(callback);
      if (this._isRemoteCollection()) {
        const args = [selector, modifier, options];
        return this._callMutatorMethod('update', args, wrappedCallback);
      }

      // it's my collection.  descend into the collection object
      // and propagate any exception.
      try {
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        return this._collection.update(selector, modifier, options, wrappedCallback);
      } catch (e) {
        if (callback) {
          callback(e);
          return null;
        }
        throw e;
      }
    },
    /**
     * @summary Remove documents from the collection
     * @locus Anywhere
     * @method remove
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} selector Specifies which documents to remove
     * @param {Function} [callback] Optional.  If present, called with an error object as its argument.
     */
    remove(selector, callback) {
      selector = Mongo.Collection._rewriteSelector(selector);
      const wrappedCallback = wrapCallback(callback);
      if (this._isRemoteCollection()) {
        return this._callMutatorMethod('remove', [selector], wrappedCallback);
      }

      // it's my collection.  descend into the collection object
      // and propagate any exception.
      try {
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        return this._collection.remove(selector, wrappedCallback);
      } catch (e) {
        if (callback) {
          callback(e);
          return null;
        }
        throw e;
      }
    },
    // Determine if this collection is simply a minimongo representation of a real
    // database on another server
    _isRemoteCollection() {
      // XXX see #MeteorServerNull
      return this._connection && this._connection !== Meteor.server;
    },
    /**
     * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
     * @locus Anywhere
     * @method upsert
     * @memberof Mongo.Collection
     * @instance
     * @param {MongoSelector} selector Specifies which documents to modify
     * @param {MongoModifier} modifier Specifies how to modify the documents
     * @param {Object} [options]
     * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
     * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
     */
    upsert(selector, modifier, options, callback) {
      if (!callback && typeof options === 'function') {
        callback = options;
        options = {};
      }
      return this.update(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
        _returnObject: true,
        upsert: true
      }), callback);
    },
    // We'll actually design an index API later. For now, we just pass through to
    // Mongo's, but make it synchronous.
    _ensureIndex(index, options) {
      var self = this;
      if (!self._collection._ensureIndex || !self._collection.createIndex) throw new Error('Can only call createIndex on server collections');
      if (self._collection.createIndex) {
        self._collection.createIndex(index, options);
      } else {
        let Log;
        module1.link("meteor/logging", {
          Log(v) {
            Log = v;
          }
        }, 2);
        Log.debug("_ensureIndex has been deprecated, please use the new 'createIndex' instead".concat(options !== null && options !== void 0 && options.name ? ", index name: ".concat(options.name) : ", index: ".concat(JSON.stringify(index))));
        self._collection._ensureIndex(index, options);
      }
    },
    /**
     * @summary Creates the specified index on the collection.
     * @locus server
     * @method createIndex
     * @memberof Mongo.Collection
     * @instance
     * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
     * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
     * @param {String} options.name Name of the index
     * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
     * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
     */
    createIndex(index, options) {
      var self = this;
      if (!self._collection.createIndex) throw new Error('Can only call createIndex on server collections');
      try {
        self._collection.createIndex(index, options);
      } catch (e) {
        var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
        if (e.message.includes('An equivalent index already exists with the same name but different options.') && (_Meteor$settings = Meteor.settings) !== null && _Meteor$settings !== void 0 && (_Meteor$settings$pack = _Meteor$settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.reCreateIndexOnOptionMismatch) {
          let Log;
          module1.link("meteor/logging", {
            Log(v) {
              Log = v;
            }
          }, 3);
          Log.info("Re-creating index ".concat(index, " for ").concat(self._name, " due to options mismatch."));
          self._collection._dropIndex(index);
          self._collection.createIndex(index, options);
        } else {
          throw new Meteor.Error("An error occurred when creating an index for collection \"".concat(self._name, ": ").concat(e.message));
        }
      }
    },
    _dropIndex(index) {
      var self = this;
      if (!self._collection._dropIndex) throw new Error('Can only call _dropIndex on server collections');
      self._collection._dropIndex(index);
    },
    _dropCollection() {
      var self = this;
      if (!self._collection.dropCollection) throw new Error('Can only call _dropCollection on server collections');
      self._collection.dropCollection();
    },
    _createCappedCollection(byteSize, maxDocuments) {
      var self = this;
      if (!self._collection._createCappedCollection) throw new Error('Can only call _createCappedCollection on server collections');
      self._collection._createCappedCollection(byteSize, maxDocuments);
    },
    /**
     * @summary Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
     * @locus Server
     * @memberof Mongo.Collection
     * @instance
     */
    rawCollection() {
      var self = this;
      if (!self._collection.rawCollection) {
        throw new Error('Can only call rawCollection on server collections');
      }
      return self._collection.rawCollection();
    },
    /**
     * @summary Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
     * @locus Server
     * @memberof Mongo.Collection
     * @instance
     */
    rawDatabase() {
      var self = this;
      if (!(self._driver.mongo && self._driver.mongo.db)) {
        throw new Error('Can only call rawDatabase on server collections');
      }
      return self._driver.mongo.db;
    }
  });

  // Convert the callback to not return a result if there is an error
  function wrapCallback(callback, convertResult) {
    return callback && function (error, result) {
      if (error) {
        callback(error);
      } else if (typeof convertResult === 'function') {
        callback(error, convertResult(result));
      } else {
        callback(error, result);
      }
    };
  }

  /**
   * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will generated randomly (not using MongoDB's ID construction rules).
   * @locus Anywhere
   * @class
   * @param {String} [hexString] Optional.  The 24-character hexadecimal contents of the ObjectID to create
   */
  Mongo.ObjectID = MongoID.ObjectID;

  /**
   * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.
   * @class
   * @instanceName cursor
   */
  Mongo.Cursor = LocalCollection.Cursor;

  /**
   * @deprecated in 0.9.1
   */
  Mongo.Collection.Cursor = Mongo.Cursor;

  /**
   * @deprecated in 0.9.1
   */
  Mongo.Collection.ObjectID = Mongo.ObjectID;

  /**
   * @deprecated in 0.9.1
   */
  Meteor.Collection = Mongo.Collection;

  // Allow deny stuff is now in the allow-deny package
  Object.assign(Meteor.Collection.prototype, AllowDeny.CollectionPrototype);
  function popCallbackFromArgs(args) {
    // Pull off any callback (or perhaps a 'callback' variable that was passed
    // in undefined, like how 'upsert' does it).
    if (args.length && (args[args.length - 1] === undefined || args[args.length - 1] instanceof Function)) {
      return args.pop();
    }
  }
  ASYNC_COLLECTION_METHODS.forEach(methodName => {
    const methodNameAsync = getAsyncMethodName(methodName);
    Mongo.Collection.prototype[methodNameAsync] = function () {
      return Promise.resolve(this[methodName](...arguments));
    };
  });
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"connection_options.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/connection_options.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @summary Allows for user specified connection options
 * @example http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/
 * @locus Server
 * @param {Object} options User specified Mongo connection options
 */
Mongo.setConnectionOptions = function setConnectionOptions(options) {
  check(options, Object);
  Mongo._connectionOptions = options;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_utils.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
const _excluded = ["fields", "projection"];
let _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }
}, 0);
let _objectWithoutProperties;
module.link("@babel/runtime/helpers/objectWithoutProperties", {
  default(v) {
    _objectWithoutProperties = v;
  }
}, 1);
module.export({
  normalizeProjection: () => normalizeProjection
});
const normalizeProjection = options => {
  // transform fields key in projection
  const _ref = options || {},
    {
      fields,
      projection
    } = _ref,
    otherOptions = _objectWithoutProperties(_ref, _excluded);
  // TODO: enable this comment when deprecating the fields option
  // Log.debug(`fields option has been deprecated, please use the new 'projection' instead`)

  return _objectSpread(_objectSpread({}, otherOptions), projection || fields ? {
    projection: fields || projection
  } : {});
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/mongo/mongo_driver.js");
require("/node_modules/meteor/mongo/oplog_tailing.js");
require("/node_modules/meteor/mongo/observe_multiplex.js");
require("/node_modules/meteor/mongo/doc_fetcher.js");
require("/node_modules/meteor/mongo/polling_observe_driver.js");
require("/node_modules/meteor/mongo/oplog_observe_driver.js");
require("/node_modules/meteor/mongo/oplog_v2_converter.js");
require("/node_modules/meteor/mongo/local_collection_driver.js");
require("/node_modules/meteor/mongo/remote_collection_driver.js");
require("/node_modules/meteor/mongo/collection.js");
require("/node_modules/meteor/mongo/connection_options.js");

/* Exports */
Package._define("mongo", {
  MongoInternals: MongoInternals,
  Mongo: Mongo,
  ObserveMultiplexer: ObserveMultiplexer
});

})();

//# sourceURL=meteor://💻app/packages/mongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ190YWlsaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vYnNlcnZlX211bHRpcGxleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vZG9jX2ZldGNoZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL3BvbGxpbmdfb2JzZXJ2ZV9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL29wbG9nX29ic2VydmVfZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ192Ml9jb252ZXJ0ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2xvY2FsX2NvbGxlY3Rpb25fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9yZW1vdGVfY29sbGVjdGlvbl9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2Nvbm5lY3Rpb25fb3B0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fdXRpbHMuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJub3JtYWxpemVQcm9qZWN0aW9uIiwiRG9jRmV0Y2hlciIsIkFTWU5DX0NVUlNPUl9NRVRIT0RTIiwiZ2V0QXN5bmNNZXRob2ROYW1lIiwicGF0aCIsInJlcXVpcmUiLCJ1dGlsIiwiTW9uZ29EQiIsIk5wbU1vZHVsZU1vbmdvZGIiLCJGdXR1cmUiLCJOcG0iLCJNb25nb0ludGVybmFscyIsIk5wbU1vZHVsZXMiLCJtb25nb2RiIiwidmVyc2lvbiIsIk5wbU1vZHVsZU1vbmdvZGJWZXJzaW9uIiwibW9kdWxlIiwiTnBtTW9kdWxlIiwiRklMRV9BU1NFVF9TVUZGSVgiLCJBU1NFVFNfRk9MREVSIiwiQVBQX0ZPTERFUiIsInJlcGxhY2VOYW1lcyIsImZpbHRlciIsInRoaW5nIiwiXyIsImlzQXJyYXkiLCJtYXAiLCJiaW5kIiwicmV0IiwiZWFjaCIsInZhbHVlIiwia2V5IiwiVGltZXN0YW1wIiwicHJvdG90eXBlIiwiY2xvbmUiLCJtYWtlTW9uZ29MZWdhbCIsIm5hbWUiLCJ1bm1ha2VNb25nb0xlZ2FsIiwic3Vic3RyIiwicmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IiLCJkb2N1bWVudCIsIkJpbmFyeSIsInN1Yl90eXBlIiwiYnVmZmVyIiwiVWludDhBcnJheSIsIk9iamVjdElEIiwiTW9uZ28iLCJ0b0hleFN0cmluZyIsIkRlY2ltYWwxMjgiLCJEZWNpbWFsIiwidG9TdHJpbmciLCJzaXplIiwiRUpTT04iLCJmcm9tSlNPTlZhbHVlIiwidW5kZWZpbmVkIiwicmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28iLCJpc0JpbmFyeSIsIkJ1ZmZlciIsImZyb20iLCJmcm9tU3RyaW5nIiwiX2lzQ3VzdG9tVHlwZSIsInRvSlNPTlZhbHVlIiwicmVwbGFjZVR5cGVzIiwiYXRvbVRyYW5zZm9ybWVyIiwicmVwbGFjZWRUb3BMZXZlbEF0b20iLCJ2YWwiLCJ2YWxSZXBsYWNlZCIsIk1vbmdvQ29ubmVjdGlvbiIsInVybCIsIm9wdGlvbnMiLCJzZWxmIiwiX29ic2VydmVNdWx0aXBsZXhlcnMiLCJfb25GYWlsb3Zlckhvb2siLCJIb29rIiwidXNlck9wdGlvbnMiLCJfY29ubmVjdGlvbk9wdGlvbnMiLCJNZXRlb3IiLCJzZXR0aW5ncyIsInBhY2thZ2VzIiwibW9uZ28iLCJtb25nb09wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJpZ25vcmVVbmRlZmluZWQiLCJoYXMiLCJtYXhQb29sU2l6ZSIsImVudHJpZXMiLCJlbmRzV2l0aCIsImZvckVhY2giLCJvcHRpb25OYW1lIiwicmVwbGFjZSIsImpvaW4iLCJBc3NldHMiLCJnZXRTZXJ2ZXJEaXIiLCJkYiIsIl9vcGxvZ0hhbmRsZSIsIl9kb2NGZXRjaGVyIiwiY2xpZW50IiwiTW9uZ29DbGllbnQiLCJvbiIsImJpbmRFbnZpcm9ubWVudCIsImV2ZW50IiwicHJldmlvdXNEZXNjcmlwdGlvbiIsInR5cGUiLCJuZXdEZXNjcmlwdGlvbiIsImNhbGxiYWNrIiwib3Bsb2dVcmwiLCJQYWNrYWdlIiwiT3Bsb2dIYW5kbGUiLCJkYXRhYmFzZU5hbWUiLCJjbG9zZSIsIkVycm9yIiwib3Bsb2dIYW5kbGUiLCJzdG9wIiwid3JhcCIsIndhaXQiLCJyYXdDb2xsZWN0aW9uIiwiY29sbGVjdGlvbk5hbWUiLCJjb2xsZWN0aW9uIiwiX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24iLCJieXRlU2l6ZSIsIm1heERvY3VtZW50cyIsImZ1dHVyZSIsImNyZWF0ZUNvbGxlY3Rpb24iLCJjYXBwZWQiLCJtYXgiLCJyZXNvbHZlciIsIl9tYXliZUJlZ2luV3JpdGUiLCJmZW5jZSIsIkREUFNlcnZlciIsIl9DdXJyZW50V3JpdGVGZW5jZSIsImdldCIsImJlZ2luV3JpdGUiLCJjb21taXR0ZWQiLCJfb25GYWlsb3ZlciIsInJlZ2lzdGVyIiwid3JpdGVDYWxsYmFjayIsIndyaXRlIiwicmVmcmVzaCIsImVyciIsInJlc3VsdCIsInJlZnJlc2hFcnIiLCJiaW5kRW52aXJvbm1lbnRGb3JXcml0ZSIsIl9pbnNlcnQiLCJjb2xsZWN0aW9uX25hbWUiLCJzZW5kRXJyb3IiLCJlIiwiX2V4cGVjdGVkQnlUZXN0IiwiTG9jYWxDb2xsZWN0aW9uIiwiX2lzUGxhaW5PYmplY3QiLCJpZCIsIl9pZCIsImluc2VydE9uZSIsInNhZmUiLCJ0aGVuIiwiaW5zZXJ0ZWRJZCIsImNhdGNoIiwiX3JlZnJlc2giLCJzZWxlY3RvciIsInJlZnJlc2hLZXkiLCJzcGVjaWZpY0lkcyIsIl9pZHNNYXRjaGVkQnlTZWxlY3RvciIsImV4dGVuZCIsIl9yZW1vdmUiLCJkZWxldGVNYW55IiwiZGVsZXRlZENvdW50IiwidHJhbnNmb3JtUmVzdWx0IiwibW9kaWZpZWRDb3VudCIsIm51bWJlckFmZmVjdGVkIiwiX2Ryb3BDb2xsZWN0aW9uIiwiY2IiLCJkcm9wQ29sbGVjdGlvbiIsImRyb3AiLCJfZHJvcERhdGFiYXNlIiwiZHJvcERhdGFiYXNlIiwiX3VwZGF0ZSIsIm1vZCIsIkZ1bmN0aW9uIiwibW9uZ29PcHRzIiwiYXJyYXlGaWx0ZXJzIiwidXBzZXJ0IiwibXVsdGkiLCJmdWxsUmVzdWx0IiwibW9uZ29TZWxlY3RvciIsIm1vbmdvTW9kIiwiaXNNb2RpZnkiLCJfaXNNb2RpZmljYXRpb25Nb2QiLCJfZm9yYmlkUmVwbGFjZSIsImtub3duSWQiLCJuZXdEb2MiLCJfY3JlYXRlVXBzZXJ0RG9jdW1lbnQiLCJnZW5lcmF0ZWRJZCIsInNpbXVsYXRlVXBzZXJ0V2l0aEluc2VydGVkSWQiLCJlcnJvciIsIl9yZXR1cm5PYmplY3QiLCJoYXNPd25Qcm9wZXJ0eSIsIiRzZXRPbkluc2VydCIsInN0cmluZ3MiLCJrZXlzIiwic3RhcnRzV2l0aCIsInVwZGF0ZU1ldGhvZCIsImxlbmd0aCIsIm1ldGVvclJlc3VsdCIsImRyaXZlclJlc3VsdCIsIm1vbmdvUmVzdWx0IiwidXBzZXJ0ZWRDb3VudCIsInVwc2VydGVkSWQiLCJuIiwibWF0Y2hlZENvdW50IiwiTlVNX09QVElNSVNUSUNfVFJJRVMiLCJfaXNDYW5ub3RDaGFuZ2VJZEVycm9yIiwiZXJybXNnIiwiaW5kZXhPZiIsIm1vbmdvT3B0c0ZvclVwZGF0ZSIsIm1vbmdvT3B0c0Zvckluc2VydCIsInJlcGxhY2VtZW50V2l0aElkIiwidHJpZXMiLCJkb1VwZGF0ZSIsIm1ldGhvZCIsInVwZGF0ZU1hbnkiLCJzb21lIiwicmVwbGFjZU9uZSIsImRvQ29uZGl0aW9uYWxJbnNlcnQiLCJ3cmFwQXN5bmMiLCJhcHBseSIsImFyZ3VtZW50cyIsInVwZGF0ZSIsImZpbmQiLCJDdXJzb3IiLCJDdXJzb3JEZXNjcmlwdGlvbiIsImZpbmRPbmUiLCJsaW1pdCIsImZldGNoIiwiY3JlYXRlSW5kZXgiLCJpbmRleCIsImluZGV4TmFtZSIsImNvdW50RG9jdW1lbnRzIiwiYXJncyIsImFyZyIsImVzdGltYXRlZERvY3VtZW50Q291bnQiLCJfZW5zdXJlSW5kZXgiLCJfZHJvcEluZGV4IiwiZHJvcEluZGV4IiwiQ29sbGVjdGlvbiIsIl9yZXdyaXRlU2VsZWN0b3IiLCJjdXJzb3JEZXNjcmlwdGlvbiIsIl9tb25nbyIsIl9jdXJzb3JEZXNjcmlwdGlvbiIsIl9zeW5jaHJvbm91c0N1cnNvciIsInNldHVwU3luY2hyb25vdXNDdXJzb3IiLCJjdXJzb3IiLCJ0YWlsYWJsZSIsIl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvciIsInNlbGZGb3JJdGVyYXRpb24iLCJ1c2VUcmFuc2Zvcm0iLCJjb3VudCIsIlByb21pc2UiLCJhd2FpdCIsIlN5bWJvbCIsIml0ZXJhdG9yIiwiYXN5bmNJdGVyYXRvciIsIm1ldGhvZE5hbWUiLCJtZXRob2ROYW1lQXN5bmMiLCJyZXNvbHZlIiwiZ2V0VHJhbnNmb3JtIiwidHJhbnNmb3JtIiwiX3B1Ymxpc2hDdXJzb3IiLCJzdWIiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJvYnNlcnZlIiwiY2FsbGJhY2tzIiwiX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMiLCJvYnNlcnZlQ2hhbmdlcyIsIm1ldGhvZHMiLCJvcmRlcmVkIiwiX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZCIsImV4Y2VwdGlvbk5hbWUiLCJfZnJvbU9ic2VydmUiLCJfb2JzZXJ2ZUNoYW5nZXMiLCJub25NdXRhdGluZ0NhbGxiYWNrcyIsInBpY2siLCJjdXJzb3JPcHRpb25zIiwic29ydCIsInNraXAiLCJwcm9qZWN0aW9uIiwiZmllbGRzIiwicmVhZFByZWZlcmVuY2UiLCJudW1iZXJPZlJldHJpZXMiLCJkYkN1cnNvciIsImFkZEN1cnNvckZsYWciLCJPUExPR19DT0xMRUNUSU9OIiwidHMiLCJtYXhUaW1lTXMiLCJtYXhUaW1lTVMiLCJoaW50IiwiU3luY2hyb25vdXNDdXJzb3IiLCJfZGJDdXJzb3IiLCJfc2VsZkZvckl0ZXJhdGlvbiIsIl90cmFuc2Zvcm0iLCJ3cmFwVHJhbnNmb3JtIiwiX3N5bmNocm9ub3VzQ291bnQiLCJfdmlzaXRlZElkcyIsIl9JZE1hcCIsIl9yYXdOZXh0T2JqZWN0UHJvbWlzZSIsInJlamVjdCIsIm5leHQiLCJkb2MiLCJfbmV4dE9iamVjdFByb21pc2UiLCJzZXQiLCJfbmV4dE9iamVjdFByb21pc2VXaXRoVGltZW91dCIsInRpbWVvdXRNUyIsIm5leHRPYmplY3RQcm9taXNlIiwidGltZW91dEVyciIsInRpbWVvdXRQcm9taXNlIiwidGltZXIiLCJzZXRUaW1lb3V0IiwicmFjZSIsIl9uZXh0T2JqZWN0IiwidGhpc0FyZyIsIl9yZXdpbmQiLCJjYWxsIiwicmVzIiwicHVzaCIsInJld2luZCIsImlkZW50aXR5IiwiZ2V0UmF3T2JqZWN0cyIsInJlc3VsdHMiLCJkb25lIiwic3luY1Jlc3VsdCIsInRhaWwiLCJkb2NDYWxsYmFjayIsInN0b3BwZWQiLCJsYXN0VFMiLCJsb29wIiwibmV3U2VsZWN0b3IiLCIkZ3QiLCJkZWZlciIsIl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlIiwiZmllbGRzT3B0aW9ucyIsIm9ic2VydmVLZXkiLCJzdHJpbmdpZnkiLCJtdWx0aXBsZXhlciIsIm9ic2VydmVEcml2ZXIiLCJmaXJzdEhhbmRsZSIsIl9ub1lpZWxkc0FsbG93ZWQiLCJPYnNlcnZlTXVsdGlwbGV4ZXIiLCJvblN0b3AiLCJvYnNlcnZlSGFuZGxlIiwiT2JzZXJ2ZUhhbmRsZSIsIm1hdGNoZXIiLCJzb3J0ZXIiLCJjYW5Vc2VPcGxvZyIsImFsbCIsIl90ZXN0T25seVBvbGxDYWxsYmFjayIsIk1pbmltb25nbyIsIk1hdGNoZXIiLCJPcGxvZ09ic2VydmVEcml2ZXIiLCJjdXJzb3JTdXBwb3J0ZWQiLCJTb3J0ZXIiLCJmIiwiZHJpdmVyQ2xhc3MiLCJQb2xsaW5nT2JzZXJ2ZURyaXZlciIsIm1vbmdvSGFuZGxlIiwiX29ic2VydmVEcml2ZXIiLCJhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMiLCJsaXN0ZW5BbGwiLCJsaXN0ZW5DYWxsYmFjayIsImxpc3RlbmVycyIsImZvckVhY2hUcmlnZ2VyIiwidHJpZ2dlciIsIl9JbnZhbGlkYXRpb25Dcm9zc2JhciIsImxpc3RlbiIsImxpc3RlbmVyIiwidHJpZ2dlckNhbGxiYWNrIiwiYWRkZWRCZWZvcmUiLCJhZGRlZCIsIk1vbmdvVGltZXN0YW1wIiwiQ29ubmVjdGlvbiIsIkxvbmciLCJUT09fRkFSX0JFSElORCIsInByb2Nlc3MiLCJlbnYiLCJNRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQiLCJUQUlMX1RJTUVPVVQiLCJNRVRFT1JfT1BMT0dfVEFJTF9USU1FT1VUIiwic2hvd1RTIiwiZ2V0SGlnaEJpdHMiLCJnZXRMb3dCaXRzIiwiaWRGb3JPcCIsIm9wIiwibyIsIm8yIiwiZGJOYW1lIiwiX29wbG9nVXJsIiwiX2RiTmFtZSIsIl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24iLCJfb3Bsb2dUYWlsQ29ubmVjdGlvbiIsIl9zdG9wcGVkIiwiX3RhaWxIYW5kbGUiLCJfcmVhZHlGdXR1cmUiLCJfY3Jvc3NiYXIiLCJfQ3Jvc3NiYXIiLCJmYWN0UGFja2FnZSIsImZhY3ROYW1lIiwiX2Jhc2VPcGxvZ1NlbGVjdG9yIiwibnMiLCJSZWdFeHAiLCJfZXNjYXBlUmVnRXhwIiwiJG9yIiwiJGluIiwiJGV4aXN0cyIsIl9jYXRjaGluZ1VwRnV0dXJlcyIsIl9sYXN0UHJvY2Vzc2VkVFMiLCJfb25Ta2lwcGVkRW50cmllc0hvb2siLCJkZWJ1Z1ByaW50RXhjZXB0aW9ucyIsIl9lbnRyeVF1ZXVlIiwiX0RvdWJsZUVuZGVkUXVldWUiLCJfd29ya2VyQWN0aXZlIiwiX3N0YXJ0VGFpbGluZyIsIm9uT3Bsb2dFbnRyeSIsIm9yaWdpbmFsQ2FsbGJhY2siLCJub3RpZmljYXRpb24iLCJfZGVidWciLCJsaXN0ZW5IYW5kbGUiLCJvblNraXBwZWRFbnRyaWVzIiwid2FpdFVudGlsQ2F1Z2h0VXAiLCJsYXN0RW50cnkiLCIkbmF0dXJhbCIsIl9zbGVlcEZvck1zIiwibGVzc1RoYW5PckVxdWFsIiwiaW5zZXJ0QWZ0ZXIiLCJncmVhdGVyVGhhbiIsInNwbGljZSIsIm1vbmdvZGJVcmkiLCJwYXJzZSIsImRhdGFiYXNlIiwiYWRtaW4iLCJjb21tYW5kIiwiaXNtYXN0ZXIiLCJpc01hc3RlckRvYyIsInNldE5hbWUiLCJsYXN0T3Bsb2dFbnRyeSIsIm9wbG9nU2VsZWN0b3IiLCJfbWF5YmVTdGFydFdvcmtlciIsInJldHVybiIsImhhbmRsZURvYyIsImFwcGx5T3BzIiwibmV4dFRpbWVzdGFtcCIsImFkZCIsIk9ORSIsInNsaWNlIiwiZmlyZSIsImlzRW1wdHkiLCJwb3AiLCJjbGVhciIsIl9zZXRMYXN0UHJvY2Vzc2VkVFMiLCJzaGlmdCIsInNlcXVlbmNlciIsIl9kZWZpbmVUb29GYXJCZWhpbmQiLCJfcmVzZXRUb29GYXJCZWhpbmQiLCJfb2JqZWN0V2l0aG91dFByb3BlcnRpZXMiLCJGYWN0cyIsImluY3JlbWVudFNlcnZlckZhY3QiLCJfb3JkZXJlZCIsIl9vblN0b3AiLCJfcXVldWUiLCJfU3luY2hyb25vdXNRdWV1ZSIsIl9oYW5kbGVzIiwiX2NhY2hlIiwiX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciIsIl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZCIsImNhbGxiYWNrTmFtZXMiLCJjYWxsYmFja05hbWUiLCJfYXBwbHlDYWxsYmFjayIsInRvQXJyYXkiLCJoYW5kbGUiLCJzYWZlVG9SdW5UYXNrIiwicnVuVGFzayIsIl9zZW5kQWRkcyIsInJlbW92ZUhhbmRsZSIsIl9yZWFkeSIsIl9zdG9wIiwiZnJvbVF1ZXJ5RXJyb3IiLCJyZWFkeSIsInF1ZXVlVGFzayIsInF1ZXJ5RXJyb3IiLCJ0aHJvdyIsIm9uRmx1c2giLCJpc1Jlc29sdmVkIiwiYXBwbHlDaGFuZ2UiLCJoYW5kbGVJZCIsIl9hZGRlZEJlZm9yZSIsIl9hZGRlZCIsImRvY3MiLCJuZXh0T2JzZXJ2ZUhhbmRsZUlkIiwiX211bHRpcGxleGVyIiwiYmVmb3JlIiwiZXhwb3J0IiwiRmliZXIiLCJjb25zdHJ1Y3RvciIsIm1vbmdvQ29ubmVjdGlvbiIsIl9tb25nb0Nvbm5lY3Rpb24iLCJfY2FsbGJhY2tzRm9yT3AiLCJNYXAiLCJjaGVjayIsIlN0cmluZyIsImRlbGV0ZSIsInJ1biIsIlBPTExJTkdfVEhST1RUTEVfTVMiLCJNRVRFT1JfUE9MTElOR19USFJPVFRMRV9NUyIsIlBPTExJTkdfSU5URVJWQUxfTVMiLCJNRVRFT1JfUE9MTElOR19JTlRFUlZBTF9NUyIsIl9tb25nb0hhbmRsZSIsIl9zdG9wQ2FsbGJhY2tzIiwiX3Jlc3VsdHMiLCJfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIiwiX3BlbmRpbmdXcml0ZXMiLCJfZW5zdXJlUG9sbElzU2NoZWR1bGVkIiwidGhyb3R0bGUiLCJfdW50aHJvdHRsZWRFbnN1cmVQb2xsSXNTY2hlZHVsZWQiLCJwb2xsaW5nVGhyb3R0bGVNcyIsIl90YXNrUXVldWUiLCJsaXN0ZW5lcnNIYW5kbGUiLCJwb2xsaW5nSW50ZXJ2YWwiLCJwb2xsaW5nSW50ZXJ2YWxNcyIsIl9wb2xsaW5nSW50ZXJ2YWwiLCJpbnRlcnZhbEhhbmRsZSIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsIl9wb2xsTW9uZ28iLCJfc3VzcGVuZFBvbGxpbmciLCJfcmVzdW1lUG9sbGluZyIsImZpcnN0IiwibmV3UmVzdWx0cyIsIm9sZFJlc3VsdHMiLCJ3cml0ZXNGb3JDeWNsZSIsImNvZGUiLCJKU09OIiwibWVzc2FnZSIsIkFycmF5IiwiX2RpZmZRdWVyeUNoYW5nZXMiLCJ3IiwiYyIsIm9wbG9nVjJWMUNvbnZlcnRlciIsIlBIQVNFIiwiUVVFUllJTkciLCJGRVRDSElORyIsIlNURUFEWSIsIlN3aXRjaGVkVG9RdWVyeSIsImZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5IiwiY3VycmVudElkIiwiX3VzZXNPcGxvZyIsImNvbXBhcmF0b3IiLCJnZXRDb21wYXJhdG9yIiwiaGVhcE9wdGlvbnMiLCJJZE1hcCIsIl9saW1pdCIsIl9jb21wYXJhdG9yIiwiX3NvcnRlciIsIl91bnB1Ymxpc2hlZEJ1ZmZlciIsIk1pbk1heEhlYXAiLCJfcHVibGlzaGVkIiwiTWF4SGVhcCIsIl9zYWZlQXBwZW5kVG9CdWZmZXIiLCJfc3RvcEhhbmRsZXMiLCJfcmVnaXN0ZXJQaGFzZUNoYW5nZSIsIl9tYXRjaGVyIiwiX3Byb2plY3Rpb25GbiIsIl9jb21waWxlUHJvamVjdGlvbiIsIl9zaGFyZWRQcm9qZWN0aW9uIiwiY29tYmluZUludG9Qcm9qZWN0aW9uIiwiX3NoYXJlZFByb2plY3Rpb25GbiIsIl9uZWVkVG9GZXRjaCIsIl9jdXJyZW50bHlGZXRjaGluZyIsIl9mZXRjaEdlbmVyYXRpb24iLCJfcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5IiwiX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkiLCJfbmVlZFRvUG9sbFF1ZXJ5IiwiX3BoYXNlIiwiX2hhbmRsZU9wbG9nRW50cnlRdWVyeWluZyIsIl9oYW5kbGVPcGxvZ0VudHJ5U3RlYWR5T3JGZXRjaGluZyIsImZpcmVkIiwiX29wbG9nT2JzZXJ2ZURyaXZlcnMiLCJvbkJlZm9yZUZpcmUiLCJkcml2ZXJzIiwiZHJpdmVyIiwiX3J1bkluaXRpYWxRdWVyeSIsIl9hZGRQdWJsaXNoZWQiLCJvdmVyZmxvd2luZ0RvY0lkIiwibWF4RWxlbWVudElkIiwib3ZlcmZsb3dpbmdEb2MiLCJlcXVhbHMiLCJyZW1vdmUiLCJyZW1vdmVkIiwiX2FkZEJ1ZmZlcmVkIiwiX3JlbW92ZVB1Ymxpc2hlZCIsImVtcHR5IiwibmV3RG9jSWQiLCJtaW5FbGVtZW50SWQiLCJfcmVtb3ZlQnVmZmVyZWQiLCJfY2hhbmdlUHVibGlzaGVkIiwib2xkRG9jIiwicHJvamVjdGVkTmV3IiwicHJvamVjdGVkT2xkIiwiY2hhbmdlZCIsIkRpZmZTZXF1ZW5jZSIsIm1ha2VDaGFuZ2VkRmllbGRzIiwibWF4QnVmZmVyZWRJZCIsIl9hZGRNYXRjaGluZyIsIm1heFB1Ymxpc2hlZCIsIm1heEJ1ZmZlcmVkIiwidG9QdWJsaXNoIiwiY2FuQXBwZW5kVG9CdWZmZXIiLCJjYW5JbnNlcnRJbnRvQnVmZmVyIiwidG9CdWZmZXIiLCJfcmVtb3ZlTWF0Y2hpbmciLCJfaGFuZGxlRG9jIiwibWF0Y2hlc05vdyIsImRvY3VtZW50TWF0Y2hlcyIsInB1Ymxpc2hlZEJlZm9yZSIsImJ1ZmZlcmVkQmVmb3JlIiwiY2FjaGVkQmVmb3JlIiwibWluQnVmZmVyZWQiLCJzdGF5c0luUHVibGlzaGVkIiwic3RheXNJbkJ1ZmZlciIsIl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzIiwidGhpc0dlbmVyYXRpb24iLCJ3YWl0aW5nIiwiZnV0IiwiX2JlU3RlYWR5Iiwid3JpdGVzIiwiaXNSZXBsYWNlIiwiY2FuRGlyZWN0bHlNb2RpZnlEb2MiLCJtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkIiwiX21vZGlmeSIsImNhbkJlY29tZVRydWVCeU1vZGlmaWVyIiwiYWZmZWN0ZWRCeU1vZGlmaWVyIiwiX3J1blF1ZXJ5IiwiaW5pdGlhbCIsIl9kb25lUXVlcnlpbmciLCJfcG9sbFF1ZXJ5IiwibmV3QnVmZmVyIiwiX2N1cnNvckZvclF1ZXJ5IiwiaSIsIl9wdWJsaXNoTmV3UmVzdWx0cyIsIm9wdGlvbnNPdmVyd3JpdGUiLCJkZXNjcmlwdGlvbiIsImlkc1RvUmVtb3ZlIiwiY29uc29sZSIsIl9vcGxvZ0VudHJ5SGFuZGxlIiwiX2xpc3RlbmVyc0hhbmRsZSIsInBoYXNlIiwibm93IiwiRGF0ZSIsInRpbWVEaWZmIiwiX3BoYXNlU3RhcnRUaW1lIiwiZGlzYWJsZU9wbG9nIiwiX2Rpc2FibGVPcGxvZyIsIl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24iLCJoYXNXaGVyZSIsImhhc0dlb1F1ZXJ5IiwibW9kaWZpZXIiLCJvcGVyYXRpb24iLCJmaWVsZCIsInRlc3QiLCJwcmVmaXgiLCJhcnJheU9wZXJhdG9yS2V5UmVnZXgiLCJpc0FycmF5T3BlcmF0b3JLZXkiLCJpc0FycmF5T3BlcmF0b3IiLCJvcGVyYXRvciIsImEiLCJldmVyeSIsImZsYXR0ZW5PYmplY3RJbnRvIiwidGFyZ2V0Iiwic291cmNlIiwibG9nRGVidWdNZXNzYWdlcyIsIk9QTE9HX0NPTlZFUlRFUl9ERUJVRyIsImNvbnZlcnRPcGxvZ0RpZmYiLCJvcGxvZ0VudHJ5IiwiZGlmZiIsImxvZyIsImRpZmZLZXkiLCIkdW5zZXQiLCIkc2V0IiwicG9zaXRpb24iLCJwb3NpdGlvbktleSIsIiR2IiwiY29udmVydGVkT3Bsb2dFbnRyeSIsIkxvY2FsQ29sbGVjdGlvbkRyaXZlciIsIm5vQ29ubkNvbGxlY3Rpb25zIiwiY3JlYXRlIiwib3BlbiIsImNvbm4iLCJlbnN1cmVDb2xsZWN0aW9uIiwiX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zIiwiY29sbGVjdGlvbnMiLCJSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIiwibW9uZ29fdXJsIiwiUkVNT1RFX0NPTExFQ1RJT05fTUVUSE9EUyIsIm0iLCJkZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlciIsIm9uY2UiLCJjb25uZWN0aW9uT3B0aW9ucyIsIm1vbmdvVXJsIiwiTU9OR09fVVJMIiwiTU9OR09fT1BMT0dfVVJMIiwic3RhcnR1cCIsImNvbm5lY3QiLCJBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMiLCJjb25uZWN0aW9uIiwibWFuYWdlciIsImlkR2VuZXJhdGlvbiIsIl9kcml2ZXIiLCJfcHJldmVudEF1dG9wdWJsaXNoIiwiX21ha2VOZXdJRCIsInNyYyIsIkREUCIsInJhbmRvbVN0cmVhbSIsIlJhbmRvbSIsImluc2VjdXJlIiwiaGV4U3RyaW5nIiwiX2Nvbm5lY3Rpb24iLCJpc0NsaWVudCIsInNlcnZlciIsIl9jb2xsZWN0aW9uIiwiX25hbWUiLCJfbWF5YmVTZXRVcFJlcGxpY2F0aW9uIiwiZGVmaW5lTXV0YXRpb25NZXRob2RzIiwiX2RlZmluZU11dGF0aW9uTWV0aG9kcyIsInVzZUV4aXN0aW5nIiwiX3N1cHByZXNzU2FtZU5hbWVFcnJvciIsImF1dG9wdWJsaXNoIiwicHVibGlzaCIsImlzX2F1dG8iLCJyZWdpc3RlclN0b3JlIiwib2siLCJiZWdpblVwZGF0ZSIsImJhdGNoU2l6ZSIsInJlc2V0IiwicGF1c2VPYnNlcnZlcnMiLCJtc2ciLCJtb25nb0lkIiwiTW9uZ29JRCIsImlkUGFyc2UiLCJfZG9jcyIsIl9yZWYiLCJpbnNlcnQiLCJlbmRVcGRhdGUiLCJyZXN1bWVPYnNlcnZlcnMiLCJzYXZlT3JpZ2luYWxzIiwicmV0cmlldmVPcmlnaW5hbHMiLCJnZXREb2MiLCJfZ2V0Q29sbGVjdGlvbiIsIndhcm4iLCJfZ2V0RmluZFNlbGVjdG9yIiwiX2dldEZpbmRPcHRpb25zIiwibmV3T3B0aW9ucyIsIk1hdGNoIiwiT3B0aW9uYWwiLCJPYmplY3RJbmNsdWRpbmciLCJPbmVPZiIsIk51bWJlciIsImZhbGxiYWNrSWQiLCJfc2VsZWN0b3JJc0lkIiwiZ2V0UHJvdG90eXBlT2YiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZ2VuZXJhdGVJZCIsIl9pc1JlbW90ZUNvbGxlY3Rpb24iLCJlbmNsb3NpbmciLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0Iiwid3JhcHBlZENhbGxiYWNrIiwid3JhcENhbGxiYWNrIiwiX2NhbGxNdXRhdG9yTWV0aG9kIiwib3B0aW9uc0FuZENhbGxiYWNrIiwicG9wQ2FsbGJhY2tGcm9tQXJncyIsIkxvZyIsImRlYnVnIiwiaW5jbHVkZXMiLCJyZUNyZWF0ZUluZGV4T25PcHRpb25NaXNtYXRjaCIsImluZm8iLCJyYXdEYXRhYmFzZSIsImNvbnZlcnRSZXN1bHQiLCJBbGxvd0RlbnkiLCJDb2xsZWN0aW9uUHJvdG90eXBlIiwic2V0Q29ubmVjdGlvbk9wdGlvbnMiLCJvdGhlck9wdGlvbnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBQUEs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QUNqZixtQkFBbUIsRUFBQyxNQUFJQTtBQUFtQixDQUFDLENBQUM7QUFBckQsTUFBTUEsbUJBQW1CLEdBQUdxRSxPQUFPLElBQUk7RUFDNUM7RUFDQSxhQUFnREEsT0FBTyxJQUFJLENBQUMsQ0FBQztJQUF2RDtNQUFFd04sTUFBTTtNQUFFRDtJQUE0QixDQUFDO0lBQWRzZixZQUFZO0VBQzNDO0VBQ0E7O0VBRUEsdUNBQ0tBLFlBQVksR0FDWHRmLFVBQVUsSUFBSUMsTUFBTSxHQUFHO0lBQUVELFVBQVUsRUFBRUMsTUFBTSxJQUFJRDtFQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7QUFFeEUsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9tb25nby5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG5vcm1hbGl6ZVByb2plY3Rpb24gfSBmcm9tIFwiLi9tb25nb191dGlsc1wiO1xuXG4vKipcbiAqIFByb3ZpZGUgYSBzeW5jaHJvbm91cyBDb2xsZWN0aW9uIEFQSSB1c2luZyBmaWJlcnMsIGJhY2tlZCBieVxuICogTW9uZ29EQi4gIFRoaXMgaXMgb25seSBmb3IgdXNlIG9uIHRoZSBzZXJ2ZXIsIGFuZCBtb3N0bHkgaWRlbnRpY2FsXG4gKiB0byB0aGUgY2xpZW50IEFQSS5cbiAqXG4gKiBOT1RFOiB0aGUgcHVibGljIEFQSSBtZXRob2RzIG11c3QgYmUgcnVuIHdpdGhpbiBhIGZpYmVyLiBJZiB5b3UgY2FsbFxuICogdGhlc2Ugb3V0c2lkZSBvZiBhIGZpYmVyIHRoZXkgd2lsbCBleHBsb2RlIVxuICovXG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKFwicGF0aFwiKTtcbmNvbnN0IHV0aWwgPSByZXF1aXJlKFwidXRpbFwiKTtcblxuLyoqIEB0eXBlIHtpbXBvcnQoJ21vbmdvZGInKX0gKi9cbnZhciBNb25nb0RCID0gTnBtTW9kdWxlTW9uZ29kYjtcbnZhciBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xuaW1wb3J0IHsgRG9jRmV0Y2hlciB9IGZyb20gXCIuL2RvY19mZXRjaGVyLmpzXCI7XG5pbXBvcnQge1xuICBBU1lOQ19DVVJTT1JfTUVUSE9EUyxcbiAgZ2V0QXN5bmNNZXRob2ROYW1lXG59IGZyb20gXCJtZXRlb3IvbWluaW1vbmdvL2NvbnN0YW50c1wiO1xuXG5Nb25nb0ludGVybmFscyA9IHt9O1xuXG5Nb25nb0ludGVybmFscy5OcG1Nb2R1bGVzID0ge1xuICBtb25nb2RiOiB7XG4gICAgdmVyc2lvbjogTnBtTW9kdWxlTW9uZ29kYlZlcnNpb24sXG4gICAgbW9kdWxlOiBNb25nb0RCXG4gIH1cbn07XG5cbi8vIE9sZGVyIHZlcnNpb24gb2Ygd2hhdCBpcyBub3cgYXZhaWxhYmxlIHZpYVxuLy8gTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlcy5tb25nb2RiLm1vZHVsZS4gIEl0IHdhcyBuZXZlciBkb2N1bWVudGVkLCBidXRcbi8vIHBlb3BsZSBkbyB1c2UgaXQuXG4vLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMlxuTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlID0gTW9uZ29EQjtcblxuY29uc3QgRklMRV9BU1NFVF9TVUZGSVggPSAnQXNzZXQnO1xuY29uc3QgQVNTRVRTX0ZPTERFUiA9ICdhc3NldHMnO1xuY29uc3QgQVBQX0ZPTERFUiA9ICdhcHAnO1xuXG4vLyBUaGlzIGlzIHVzZWQgdG8gYWRkIG9yIHJlbW92ZSBFSlNPTiBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgZXZlcnl0aGluZyBuZXN0ZWRcbi8vIGluc2lkZSBhbiBFSlNPTiBjdXN0b20gdHlwZS4gSXQgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIG9uIHB1cmUgSlNPTiFcbnZhciByZXBsYWNlTmFtZXMgPSBmdW5jdGlvbiAoZmlsdGVyLCB0aGluZykge1xuICBpZiAodHlwZW9mIHRoaW5nID09PSBcIm9iamVjdFwiICYmIHRoaW5nICE9PSBudWxsKSB7XG4gICAgaWYgKF8uaXNBcnJheSh0aGluZykpIHtcbiAgICAgIHJldHVybiBfLm1hcCh0aGluZywgXy5iaW5kKHJlcGxhY2VOYW1lcywgbnVsbCwgZmlsdGVyKSk7XG4gICAgfVxuICAgIHZhciByZXQgPSB7fTtcbiAgICBfLmVhY2godGhpbmcsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICByZXRbZmlsdGVyKGtleSldID0gcmVwbGFjZU5hbWVzKGZpbHRlciwgdmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXQ7XG4gIH1cbiAgcmV0dXJuIHRoaW5nO1xufTtcblxuLy8gRW5zdXJlIHRoYXQgRUpTT04uY2xvbmUga2VlcHMgYSBUaW1lc3RhbXAgYXMgYSBUaW1lc3RhbXAgKGluc3RlYWQgb2YganVzdFxuLy8gZG9pbmcgYSBzdHJ1Y3R1cmFsIGNsb25lKS5cbi8vIFhYWCBob3cgb2sgaXMgdGhpcz8gd2hhdCBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgY29waWVzIG9mIE1vbmdvREIgbG9hZGVkP1xuTW9uZ29EQi5UaW1lc3RhbXAucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAvLyBUaW1lc3RhbXBzIHNob3VsZCBiZSBpbW11dGFibGUuXG4gIHJldHVybiB0aGlzO1xufTtcblxudmFyIG1ha2VNb25nb0xlZ2FsID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFwiRUpTT05cIiArIG5hbWU7IH07XG52YXIgdW5tYWtlTW9uZ29MZWdhbCA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBuYW1lLnN1YnN0cig1KTsgfTtcblxudmFyIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yID0gZnVuY3Rpb24gKGRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuQmluYXJ5KSB7XG4gICAgLy8gZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgaWYgKGRvY3VtZW50LnN1Yl90eXBlICE9PSAwKSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQ7XG4gICAgfVxuICAgIHZhciBidWZmZXIgPSBkb2N1bWVudC52YWx1ZSh0cnVlKTtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLk9iamVjdElEKSB7XG4gICAgcmV0dXJuIG5ldyBNb25nby5PYmplY3RJRChkb2N1bWVudC50b0hleFN0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLkRlY2ltYWwxMjgpIHtcbiAgICByZXR1cm4gRGVjaW1hbChkb2N1bWVudC50b1N0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnRbXCJFSlNPTiR0eXBlXCJdICYmIGRvY3VtZW50W1wiRUpTT04kdmFsdWVcIl0gJiYgXy5zaXplKGRvY3VtZW50KSA9PT0gMikge1xuICAgIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKHJlcGxhY2VOYW1lcyh1bm1ha2VNb25nb0xlZ2FsLCBkb2N1bWVudCkpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuVGltZXN0YW1wKSB7XG4gICAgLy8gRm9yIG5vdywgdGhlIE1ldGVvciByZXByZXNlbnRhdGlvbiBvZiBhIE1vbmdvIHRpbWVzdGFtcCB0eXBlIChub3QgYSBkYXRlIVxuICAgIC8vIHRoaXMgaXMgYSB3ZWlyZCBpbnRlcm5hbCB0aGluZyB1c2VkIGluIHRoZSBvcGxvZyEpIGlzIHRoZSBzYW1lIGFzIHRoZVxuICAgIC8vIE1vbmdvIHJlcHJlc2VudGF0aW9uLiBXZSBuZWVkIHRvIGRvIHRoaXMgZXhwbGljaXRseSBvciBlbHNlIHdlIHdvdWxkIGRvIGFcbiAgICAvLyBzdHJ1Y3R1cmFsIGNsb25lIGFuZCBsb3NlIHRoZSBwcm90b3R5cGUuXG4gICAgcmV0dXJuIGRvY3VtZW50O1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG52YXIgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28gPSBmdW5jdGlvbiAoZG9jdW1lbnQpIHtcbiAgaWYgKEVKU09OLmlzQmluYXJ5KGRvY3VtZW50KSkge1xuICAgIC8vIFRoaXMgZG9lcyBtb3JlIGNvcGllcyB0aGFuIHdlJ2QgbGlrZSwgYnV0IGlzIG5lY2Vzc2FyeSBiZWNhdXNlXG4gICAgLy8gTW9uZ29EQi5CU09OIG9ubHkgbG9va3MgbGlrZSBpdCB0YWtlcyBhIFVpbnQ4QXJyYXkgKGFuZCBkb2Vzbid0IGFjdHVhbGx5XG4gICAgLy8gc2VyaWFsaXplIGl0IGNvcnJlY3RseSkuXG4gICAgcmV0dXJuIG5ldyBNb25nb0RCLkJpbmFyeShCdWZmZXIuZnJvbShkb2N1bWVudCkpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuQmluYXJ5KSB7XG4gICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRCkge1xuICAgIHJldHVybiBuZXcgTW9uZ29EQi5PYmplY3RJRChkb2N1bWVudC50b0hleFN0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLlRpbWVzdGFtcCkge1xuICAgIC8vIEZvciBub3csIHRoZSBNZXRlb3IgcmVwcmVzZW50YXRpb24gb2YgYSBNb25nbyB0aW1lc3RhbXAgdHlwZSAobm90IGEgZGF0ZSFcbiAgICAvLyB0aGlzIGlzIGEgd2VpcmQgaW50ZXJuYWwgdGhpbmcgdXNlZCBpbiB0aGUgb3Bsb2chKSBpcyB0aGUgc2FtZSBhcyB0aGVcbiAgICAvLyBNb25nbyByZXByZXNlbnRhdGlvbi4gV2UgbmVlZCB0byBkbyB0aGlzIGV4cGxpY2l0bHkgb3IgZWxzZSB3ZSB3b3VsZCBkbyBhXG4gICAgLy8gc3RydWN0dXJhbCBjbG9uZSBhbmQgbG9zZSB0aGUgcHJvdG90eXBlLlxuICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBEZWNpbWFsKSB7XG4gICAgcmV0dXJuIE1vbmdvREIuRGVjaW1hbDEyOC5mcm9tU3RyaW5nKGRvY3VtZW50LnRvU3RyaW5nKCkpO1xuICB9XG4gIGlmIChFSlNPTi5faXNDdXN0b21UeXBlKGRvY3VtZW50KSkge1xuICAgIHJldHVybiByZXBsYWNlTmFtZXMobWFrZU1vbmdvTGVnYWwsIEVKU09OLnRvSlNPTlZhbHVlKGRvY3VtZW50KSk7XG4gIH1cbiAgLy8gSXQgaXMgbm90IG9yZGluYXJpbHkgcG9zc2libGUgdG8gc3RpY2sgZG9sbGFyLXNpZ24ga2V5cyBpbnRvIG1vbmdvXG4gIC8vIHNvIHdlIGRvbid0IGJvdGhlciBjaGVja2luZyBmb3IgdGhpbmdzIHRoYXQgbmVlZCBlc2NhcGluZyBhdCB0aGlzIHRpbWUuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG52YXIgcmVwbGFjZVR5cGVzID0gZnVuY3Rpb24gKGRvY3VtZW50LCBhdG9tVHJhbnNmb3JtZXIpIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ29iamVjdCcgfHwgZG9jdW1lbnQgPT09IG51bGwpXG4gICAgcmV0dXJuIGRvY3VtZW50O1xuXG4gIHZhciByZXBsYWNlZFRvcExldmVsQXRvbSA9IGF0b21UcmFuc2Zvcm1lcihkb2N1bWVudCk7XG4gIGlmIChyZXBsYWNlZFRvcExldmVsQXRvbSAhPT0gdW5kZWZpbmVkKVxuICAgIHJldHVybiByZXBsYWNlZFRvcExldmVsQXRvbTtcblxuICB2YXIgcmV0ID0gZG9jdW1lbnQ7XG4gIF8uZWFjaChkb2N1bWVudCwgZnVuY3Rpb24gKHZhbCwga2V5KSB7XG4gICAgdmFyIHZhbFJlcGxhY2VkID0gcmVwbGFjZVR5cGVzKHZhbCwgYXRvbVRyYW5zZm9ybWVyKTtcbiAgICBpZiAodmFsICE9PSB2YWxSZXBsYWNlZCkge1xuICAgICAgLy8gTGF6eSBjbG9uZS4gU2hhbGxvdyBjb3B5LlxuICAgICAgaWYgKHJldCA9PT0gZG9jdW1lbnQpXG4gICAgICAgIHJldCA9IF8uY2xvbmUoZG9jdW1lbnQpO1xuICAgICAgcmV0W2tleV0gPSB2YWxSZXBsYWNlZDtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmV0O1xufTtcblxuXG5Nb25nb0Nvbm5lY3Rpb24gPSBmdW5jdGlvbiAodXJsLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnMgPSB7fTtcbiAgc2VsZi5fb25GYWlsb3Zlckhvb2sgPSBuZXcgSG9vaztcblxuICBjb25zdCB1c2VyT3B0aW9ucyA9IHtcbiAgICAuLi4oTW9uZ28uX2Nvbm5lY3Rpb25PcHRpb25zIHx8IHt9KSxcbiAgICAuLi4oTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/Lm9wdGlvbnMgfHwge30pXG4gIH07XG5cbiAgdmFyIG1vbmdvT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGlnbm9yZVVuZGVmaW5lZDogdHJ1ZSxcbiAgfSwgdXNlck9wdGlvbnMpO1xuXG5cblxuICAvLyBJbnRlcm5hbGx5IHRoZSBvcGxvZyBjb25uZWN0aW9ucyBzcGVjaWZ5IHRoZWlyIG93biBtYXhQb29sU2l6ZVxuICAvLyB3aGljaCB3ZSBkb24ndCB3YW50IHRvIG92ZXJ3cml0ZSB3aXRoIGFueSB1c2VyIGRlZmluZWQgdmFsdWVcbiAgaWYgKF8uaGFzKG9wdGlvbnMsICdtYXhQb29sU2l6ZScpKSB7XG4gICAgLy8gSWYgd2UganVzdCBzZXQgdGhpcyBmb3IgXCJzZXJ2ZXJcIiwgcmVwbFNldCB3aWxsIG92ZXJyaWRlIGl0LiBJZiB3ZSBqdXN0XG4gICAgLy8gc2V0IGl0IGZvciByZXBsU2V0LCBpdCB3aWxsIGJlIGlnbm9yZWQgaWYgd2UncmUgbm90IHVzaW5nIGEgcmVwbFNldC5cbiAgICBtb25nb09wdGlvbnMubWF4UG9vbFNpemUgPSBvcHRpb25zLm1heFBvb2xTaXplO1xuICB9XG5cbiAgLy8gVHJhbnNmb3JtIG9wdGlvbnMgbGlrZSBcInRsc0NBRmlsZUFzc2V0XCI6IFwiZmlsZW5hbWUucGVtXCIgaW50b1xuICAvLyBcInRsc0NBRmlsZVwiOiBcIi88ZnVsbHBhdGg+L2ZpbGVuYW1lLnBlbVwiXG4gIE9iamVjdC5lbnRyaWVzKG1vbmdvT3B0aW9ucyB8fCB7fSlcbiAgICAuZmlsdGVyKChba2V5XSkgPT4ga2V5ICYmIGtleS5lbmRzV2l0aChGSUxFX0FTU0VUX1NVRkZJWCkpXG4gICAgLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9uTmFtZSA9IGtleS5yZXBsYWNlKEZJTEVfQVNTRVRfU1VGRklYLCAnJyk7XG4gICAgICBtb25nb09wdGlvbnNbb3B0aW9uTmFtZV0gPSBwYXRoLmpvaW4oQXNzZXRzLmdldFNlcnZlckRpcigpLFxuICAgICAgICBBU1NFVFNfRk9MREVSLCBBUFBfRk9MREVSLCB2YWx1ZSk7XG4gICAgICBkZWxldGUgbW9uZ29PcHRpb25zW2tleV07XG4gICAgfSk7XG5cbiAgc2VsZi5kYiA9IG51bGw7XG4gIHNlbGYuX29wbG9nSGFuZGxlID0gbnVsbDtcbiAgc2VsZi5fZG9jRmV0Y2hlciA9IG51bGw7XG5cbiAgc2VsZi5jbGllbnQgPSBuZXcgTW9uZ29EQi5Nb25nb0NsaWVudCh1cmwsIG1vbmdvT3B0aW9ucyk7XG4gIHNlbGYuZGIgPSBzZWxmLmNsaWVudC5kYigpO1xuXG4gIHNlbGYuY2xpZW50Lm9uKCdzZXJ2ZXJEZXNjcmlwdGlvbkNoYW5nZWQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGV2ZW50ID0+IHtcbiAgICAvLyBXaGVuIHRoZSBjb25uZWN0aW9uIGlzIG5vIGxvbmdlciBhZ2FpbnN0IHRoZSBwcmltYXJ5IG5vZGUsIGV4ZWN1dGUgYWxsXG4gICAgLy8gZmFpbG92ZXIgaG9va3MuIFRoaXMgaXMgaW1wb3J0YW50IGZvciB0aGUgZHJpdmVyIGFzIGl0IGhhcyB0byByZS1wb29sIHRoZVxuICAgIC8vIHF1ZXJ5IHdoZW4gaXQgaGFwcGVucy5cbiAgICBpZiAoXG4gICAgICBldmVudC5wcmV2aW91c0Rlc2NyaXB0aW9uLnR5cGUgIT09ICdSU1ByaW1hcnknICYmXG4gICAgICBldmVudC5uZXdEZXNjcmlwdGlvbi50eXBlID09PSAnUlNQcmltYXJ5J1xuICAgICkge1xuICAgICAgc2VsZi5fb25GYWlsb3Zlckhvb2suZWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICB9KSk7XG5cbiAgaWYgKG9wdGlvbnMub3Bsb2dVcmwgJiYgISBQYWNrYWdlWydkaXNhYmxlLW9wbG9nJ10pIHtcbiAgICBzZWxmLl9vcGxvZ0hhbmRsZSA9IG5ldyBPcGxvZ0hhbmRsZShvcHRpb25zLm9wbG9nVXJsLCBzZWxmLmRiLmRhdGFiYXNlTmFtZSk7XG4gICAgc2VsZi5fZG9jRmV0Y2hlciA9IG5ldyBEb2NGZXRjaGVyKHNlbGYpO1xuICB9XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoISBzZWxmLmRiKVxuICAgIHRocm93IEVycm9yKFwiY2xvc2UgY2FsbGVkIGJlZm9yZSBDb25uZWN0aW9uIGNyZWF0ZWQ/XCIpO1xuXG4gIC8vIFhYWCBwcm9iYWJseSB1bnRlc3RlZFxuICB2YXIgb3Bsb2dIYW5kbGUgPSBzZWxmLl9vcGxvZ0hhbmRsZTtcbiAgc2VsZi5fb3Bsb2dIYW5kbGUgPSBudWxsO1xuICBpZiAob3Bsb2dIYW5kbGUpXG4gICAgb3Bsb2dIYW5kbGUuc3RvcCgpO1xuXG4gIC8vIFVzZSBGdXR1cmUud3JhcCBzbyB0aGF0IGVycm9ycyBnZXQgdGhyb3duLiBUaGlzIGhhcHBlbnMgdG9cbiAgLy8gd29yayBldmVuIG91dHNpZGUgYSBmaWJlciBzaW5jZSB0aGUgJ2Nsb3NlJyBtZXRob2QgaXMgbm90XG4gIC8vIGFjdHVhbGx5IGFzeW5jaHJvbm91cy5cbiAgRnV0dXJlLndyYXAoXy5iaW5kKHNlbGYuY2xpZW50LmNsb3NlLCBzZWxmLmNsaWVudCkpKHRydWUpLndhaXQoKTtcbn07XG5cbi8vIFJldHVybnMgdGhlIE1vbmdvIENvbGxlY3Rpb24gb2JqZWN0OyBtYXkgeWllbGQuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnJhd0NvbGxlY3Rpb24gPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuZGIpXG4gICAgdGhyb3cgRXJyb3IoXCJyYXdDb2xsZWN0aW9uIGNhbGxlZCBiZWZvcmUgQ29ubmVjdGlvbiBjcmVhdGVkP1wiKTtcblxuICByZXR1cm4gc2VsZi5kYi5jb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24gPSBmdW5jdGlvbiAoXG4gICAgY29sbGVjdGlvbk5hbWUsIGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuZGIpXG4gICAgdGhyb3cgRXJyb3IoXCJfY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbiBjYWxsZWQgYmVmb3JlIENvbm5lY3Rpb24gY3JlYXRlZD9cIik7XG5cbiAgdmFyIGZ1dHVyZSA9IG5ldyBGdXR1cmUoKTtcbiAgc2VsZi5kYi5jcmVhdGVDb2xsZWN0aW9uKFxuICAgIGNvbGxlY3Rpb25OYW1lLFxuICAgIHsgY2FwcGVkOiB0cnVlLCBzaXplOiBieXRlU2l6ZSwgbWF4OiBtYXhEb2N1bWVudHMgfSxcbiAgICBmdXR1cmUucmVzb2x2ZXIoKSk7XG4gIGZ1dHVyZS53YWl0KCk7XG59O1xuXG4vLyBUaGlzIHNob3VsZCBiZSBjYWxsZWQgc3luY2hyb25vdXNseSB3aXRoIGEgd3JpdGUsIHRvIGNyZWF0ZSBhXG4vLyB0cmFuc2FjdGlvbiBvbiB0aGUgY3VycmVudCB3cml0ZSBmZW5jZSwgaWYgYW55LiBBZnRlciB3ZSBjYW4gcmVhZFxuLy8gdGhlIHdyaXRlLCBhbmQgYWZ0ZXIgb2JzZXJ2ZXJzIGhhdmUgYmVlbiBub3RpZmllZCAob3IgYXQgbGVhc3QsXG4vLyBhZnRlciB0aGUgb2JzZXJ2ZXIgbm90aWZpZXJzIGhhdmUgYWRkZWQgdGhlbXNlbHZlcyB0byB0aGUgd3JpdGVcbi8vIGZlbmNlKSwgeW91IHNob3VsZCBjYWxsICdjb21taXR0ZWQoKScgb24gdGhlIG9iamVjdCByZXR1cm5lZC5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX21heWJlQmVnaW5Xcml0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGZlbmNlID0gRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZS5nZXQoKTtcbiAgaWYgKGZlbmNlKSB7XG4gICAgcmV0dXJuIGZlbmNlLmJlZ2luV3JpdGUoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4ge2NvbW1pdHRlZDogZnVuY3Rpb24gKCkge319O1xuICB9XG59O1xuXG4vLyBJbnRlcm5hbCBpbnRlcmZhY2U6IGFkZHMgYSBjYWxsYmFjayB3aGljaCBpcyBjYWxsZWQgd2hlbiB0aGUgTW9uZ28gcHJpbWFyeVxuLy8gY2hhbmdlcy4gUmV0dXJucyBhIHN0b3AgaGFuZGxlLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fb25GYWlsb3ZlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5fb25GYWlsb3Zlckhvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xufTtcblxuXG4vLy8vLy8vLy8vLy8gUHVibGljIEFQSSAvLy8vLy8vLy8vXG5cbi8vIFRoZSB3cml0ZSBtZXRob2RzIGJsb2NrIHVudGlsIHRoZSBkYXRhYmFzZSBoYXMgY29uZmlybWVkIHRoZSB3cml0ZSAoaXQgbWF5XG4vLyBub3QgYmUgcmVwbGljYXRlZCBvciBzdGFibGUgb24gZGlzaywgYnV0IG9uZSBzZXJ2ZXIgaGFzIGNvbmZpcm1lZCBpdCkgaWYgbm9cbi8vIGNhbGxiYWNrIGlzIHByb3ZpZGVkLiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkLCB0aGVuIHRoZXkgY2FsbCB0aGUgY2FsbGJhY2tcbi8vIHdoZW4gdGhlIHdyaXRlIGlzIGNvbmZpcm1lZC4gVGhleSByZXR1cm4gbm90aGluZyBvbiBzdWNjZXNzLCBhbmQgcmFpc2UgYW5cbi8vIGV4Y2VwdGlvbiBvbiBmYWlsdXJlLlxuLy9cbi8vIEFmdGVyIG1ha2luZyBhIHdyaXRlICh3aXRoIGluc2VydCwgdXBkYXRlLCByZW1vdmUpLCBvYnNlcnZlcnMgYXJlXG4vLyBub3RpZmllZCBhc3luY2hyb25vdXNseS4gSWYgeW91IHdhbnQgdG8gcmVjZWl2ZSBhIGNhbGxiYWNrIG9uY2UgYWxsXG4vLyBvZiB0aGUgb2JzZXJ2ZXIgbm90aWZpY2F0aW9ucyBoYXZlIGxhbmRlZCBmb3IgeW91ciB3cml0ZSwgZG8gdGhlXG4vLyB3cml0ZXMgaW5zaWRlIGEgd3JpdGUgZmVuY2UgKHNldCBERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlIHRvIGEgbmV3XG4vLyBfV3JpdGVGZW5jZSwgYW5kIHRoZW4gc2V0IGEgY2FsbGJhY2sgb24gdGhlIHdyaXRlIGZlbmNlLilcbi8vXG4vLyBTaW5jZSBvdXIgZXhlY3V0aW9uIGVudmlyb25tZW50IGlzIHNpbmdsZS10aHJlYWRlZCwgdGhpcyBpc1xuLy8gd2VsbC1kZWZpbmVkIC0tIGEgd3JpdGUgXCJoYXMgYmVlbiBtYWRlXCIgaWYgaXQncyByZXR1cm5lZCwgYW5kIGFuXG4vLyBvYnNlcnZlciBcImhhcyBiZWVuIG5vdGlmaWVkXCIgaWYgaXRzIGNhbGxiYWNrIGhhcyByZXR1cm5lZC5cblxudmFyIHdyaXRlQ2FsbGJhY2sgPSBmdW5jdGlvbiAod3JpdGUsIHJlZnJlc2gsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHtcbiAgICBpZiAoISBlcnIpIHtcbiAgICAgIC8vIFhYWCBXZSBkb24ndCBoYXZlIHRvIHJ1biB0aGlzIG9uIGVycm9yLCByaWdodD9cbiAgICAgIHRyeSB7XG4gICAgICAgIHJlZnJlc2goKTtcbiAgICAgIH0gY2F0Y2ggKHJlZnJlc2hFcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2socmVmcmVzaEVycik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IHJlZnJlc2hFcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdCk7XG4gICAgfSBlbHNlIGlmIChlcnIpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgYmluZEVudmlyb25tZW50Rm9yV3JpdGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgcmV0dXJuIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2ssIFwiTW9uZ28gd3JpdGVcIik7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9pbnNlcnQgPSBmdW5jdGlvbiAoY29sbGVjdGlvbl9uYW1lLCBkb2N1bWVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHNlbmRFcnJvciA9IGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKGNhbGxiYWNrKVxuICAgICAgcmV0dXJuIGNhbGxiYWNrKGUpO1xuICAgIHRocm93IGU7XG4gIH07XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICBzZW5kRXJyb3IoZSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCEoTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KGRvY3VtZW50KSAmJlxuICAgICAgICAhRUpTT04uX2lzQ3VzdG9tVHlwZShkb2N1bWVudCkpKSB7XG4gICAgc2VuZEVycm9yKG5ldyBFcnJvcihcbiAgICAgIFwiT25seSBwbGFpbiBvYmplY3RzIG1heSBiZSBpbnNlcnRlZCBpbnRvIE1vbmdvREJcIikpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICBNZXRlb3IucmVmcmVzaCh7Y29sbGVjdGlvbjogY29sbGVjdGlvbl9uYW1lLCBpZDogZG9jdW1lbnQuX2lkIH0pO1xuICB9O1xuICBjYWxsYmFjayA9IGJpbmRFbnZpcm9ubWVudEZvcldyaXRlKHdyaXRlQ2FsbGJhY2sod3JpdGUsIHJlZnJlc2gsIGNhbGxiYWNrKSk7XG4gIHRyeSB7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbl9uYW1lKTtcbiAgICBjb2xsZWN0aW9uLmluc2VydE9uZShcbiAgICAgIHJlcGxhY2VUeXBlcyhkb2N1bWVudCwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgICAge1xuICAgICAgICBzYWZlOiB0cnVlLFxuICAgICAgfVxuICAgICkudGhlbigoe2luc2VydGVkSWR9KSA9PiB7XG4gICAgICBjYWxsYmFjayhudWxsLCBpbnNlcnRlZElkKTtcbiAgICB9KS5jYXRjaCgoZSkgPT4ge1xuICAgICAgY2FsbGJhY2soZSwgbnVsbClcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59O1xuXG4vLyBDYXVzZSBxdWVyaWVzIHRoYXQgbWF5IGJlIGFmZmVjdGVkIGJ5IHRoZSBzZWxlY3RvciB0byBwb2xsIGluIHRoaXMgd3JpdGVcbi8vIGZlbmNlLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVmcmVzaCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IpIHtcbiAgdmFyIHJlZnJlc2hLZXkgPSB7Y29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWV9O1xuICAvLyBJZiB3ZSBrbm93IHdoaWNoIGRvY3VtZW50cyB3ZSdyZSByZW1vdmluZywgZG9uJ3QgcG9sbCBxdWVyaWVzIHRoYXQgYXJlXG4gIC8vIHNwZWNpZmljIHRvIG90aGVyIGRvY3VtZW50cy4gKE5vdGUgdGhhdCBtdWx0aXBsZSBub3RpZmljYXRpb25zIGhlcmUgc2hvdWxkXG4gIC8vIG5vdCBjYXVzZSBtdWx0aXBsZSBwb2xscywgc2luY2UgYWxsIG91ciBsaXN0ZW5lciBpcyBkb2luZyBpcyBlbnF1ZXVlaW5nIGFcbiAgLy8gcG9sbC4pXG4gIHZhciBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBfLmVhY2goc3BlY2lmaWNJZHMsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgTWV0ZW9yLnJlZnJlc2goXy5leHRlbmQoe2lkOiBpZH0sIHJlZnJlc2hLZXkpKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBNZXRlb3IucmVmcmVzaChyZWZyZXNoS2V5KTtcbiAgfVxufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVtb3ZlID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2spIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChjb2xsZWN0aW9uX25hbWUgPT09IFwiX19fbWV0ZW9yX2ZhaWx1cmVfdGVzdF9jb2xsZWN0aW9uXCIpIHtcbiAgICB2YXIgZSA9IG5ldyBFcnJvcihcIkZhaWx1cmUgdGVzdFwiKTtcbiAgICBlLl9leHBlY3RlZEJ5VGVzdCA9IHRydWU7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICByZXR1cm4gY2FsbGJhY2soZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gZnVuY3Rpb24gKCkge1xuICAgIHNlbGYuX3JlZnJlc2goY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvcik7XG4gIH07XG4gIGNhbGxiYWNrID0gYmluZEVudmlyb25tZW50Rm9yV3JpdGUod3JpdGVDYWxsYmFjayh3cml0ZSwgcmVmcmVzaCwgY2FsbGJhY2spKTtcblxuICB0cnkge1xuICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25fbmFtZSk7XG4gICAgY29sbGVjdGlvblxuICAgICAgLmRlbGV0ZU1hbnkocmVwbGFjZVR5cGVzKHNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksIHtcbiAgICAgICAgc2FmZTogdHJ1ZSxcbiAgICAgIH0pXG4gICAgICAudGhlbigoeyBkZWxldGVkQ291bnQgfSkgPT4ge1xuICAgICAgICBjYWxsYmFjayhudWxsLCB0cmFuc2Zvcm1SZXN1bHQoeyByZXN1bHQgOiB7bW9kaWZpZWRDb3VudCA6IGRlbGV0ZWRDb3VudH0gfSkubnVtYmVyQWZmZWN0ZWQpO1xuICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9kcm9wQ29sbGVjdGlvbiA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgY2IpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICBNZXRlb3IucmVmcmVzaCh7Y29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsIGlkOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBkcm9wQ29sbGVjdGlvbjogdHJ1ZX0pO1xuICB9O1xuICBjYiA9IGJpbmRFbnZpcm9ubWVudEZvcldyaXRlKHdyaXRlQ2FsbGJhY2sod3JpdGUsIHJlZnJlc2gsIGNiKSk7XG5cbiAgdHJ5IHtcbiAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gICAgY29sbGVjdGlvbi5kcm9wKGNiKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgIHRocm93IGU7XG4gIH1cbn07XG5cbi8vIEZvciB0ZXN0aW5nIG9ubHkuICBTbGlnaHRseSBiZXR0ZXIgdGhhbiBgYy5yYXdEYXRhYmFzZSgpLmRyb3BEYXRhYmFzZSgpYFxuLy8gYmVjYXVzZSBpdCBsZXRzIHRoZSB0ZXN0J3MgZmVuY2Ugd2FpdCBmb3IgaXQgdG8gYmUgY29tcGxldGUuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9kcm9wRGF0YWJhc2UgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICBNZXRlb3IucmVmcmVzaCh7IGRyb3BEYXRhYmFzZTogdHJ1ZSB9KTtcbiAgfTtcbiAgY2IgPSBiaW5kRW52aXJvbm1lbnRGb3JXcml0ZSh3cml0ZUNhbGxiYWNrKHdyaXRlLCByZWZyZXNoLCBjYikpO1xuXG4gIHRyeSB7XG4gICAgc2VsZi5kYi5kcm9wRGF0YWJhc2UoY2IpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgdGhyb3cgZTtcbiAgfVxufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fdXBkYXRlID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG1vZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLCBjYWxsYmFjaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgY2FsbGJhY2sgJiYgb3B0aW9ucyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICB9XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICAvLyBleHBsaWNpdCBzYWZldHkgY2hlY2suIG51bGwgYW5kIHVuZGVmaW5lZCBjYW4gY3Jhc2ggdGhlIG1vbmdvXG4gIC8vIGRyaXZlci4gQWx0aG91Z2ggdGhlIG5vZGUgZHJpdmVyIGFuZCBtaW5pbW9uZ28gZG8gJ3N1cHBvcnQnXG4gIC8vIG5vbi1vYmplY3QgbW9kaWZpZXIgaW4gdGhhdCB0aGV5IGRvbid0IGNyYXNoLCB0aGV5IGFyZSBub3RcbiAgLy8gbWVhbmluZ2Z1bCBvcGVyYXRpb25zIGFuZCBkbyBub3QgZG8gYW55dGhpbmcuIERlZmVuc2l2ZWx5IHRocm93IGFuXG4gIC8vIGVycm9yIGhlcmUuXG4gIGlmICghbW9kIHx8IHR5cGVvZiBtb2QgIT09ICdvYmplY3QnKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgbW9kaWZpZXIuIE1vZGlmaWVyIG11c3QgYmUgYW4gb2JqZWN0LlwiKTtcblxuICBpZiAoIShMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QobW9kKSAmJlxuICAgICAgICAhRUpTT04uX2lzQ3VzdG9tVHlwZShtb2QpKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiT25seSBwbGFpbiBvYmplY3RzIG1heSBiZSB1c2VkIGFzIHJlcGxhY2VtZW50XCIgK1xuICAgICAgICBcIiBkb2N1bWVudHMgaW4gTW9uZ29EQlwiKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9yZWZyZXNoKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IpO1xuICB9O1xuICBjYWxsYmFjayA9IHdyaXRlQ2FsbGJhY2sod3JpdGUsIHJlZnJlc2gsIGNhbGxiYWNrKTtcbiAgdHJ5IHtcbiAgICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uX25hbWUpO1xuICAgIHZhciBtb25nb09wdHMgPSB7c2FmZTogdHJ1ZX07XG4gICAgLy8gQWRkIHN1cHBvcnQgZm9yIGZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JcbiAgICBpZiAob3B0aW9ucy5hcnJheUZpbHRlcnMgIT09IHVuZGVmaW5lZCkgbW9uZ29PcHRzLmFycmF5RmlsdGVycyA9IG9wdGlvbnMuYXJyYXlGaWx0ZXJzO1xuICAgIC8vIGV4cGxpY3RseSBlbnVtZXJhdGUgb3B0aW9ucyB0aGF0IG1pbmltb25nbyBzdXBwb3J0c1xuICAgIGlmIChvcHRpb25zLnVwc2VydCkgbW9uZ29PcHRzLnVwc2VydCA9IHRydWU7XG4gICAgaWYgKG9wdGlvbnMubXVsdGkpIG1vbmdvT3B0cy5tdWx0aSA9IHRydWU7XG4gICAgLy8gTGV0cyB5b3UgZ2V0IGEgbW9yZSBtb3JlIGZ1bGwgcmVzdWx0IGZyb20gTW9uZ29EQi4gVXNlIHdpdGggY2F1dGlvbjpcbiAgICAvLyBtaWdodCBub3Qgd29yayB3aXRoIEMudXBzZXJ0IChhcyBvcHBvc2VkIHRvIEMudXBkYXRlKHt1cHNlcnQ6dHJ1ZX0pIG9yXG4gICAgLy8gd2l0aCBzaW11bGF0ZWQgdXBzZXJ0LlxuICAgIGlmIChvcHRpb25zLmZ1bGxSZXN1bHQpIG1vbmdvT3B0cy5mdWxsUmVzdWx0ID0gdHJ1ZTtcblxuICAgIHZhciBtb25nb1NlbGVjdG9yID0gcmVwbGFjZVR5cGVzKHNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyk7XG4gICAgdmFyIG1vbmdvTW9kID0gcmVwbGFjZVR5cGVzKG1vZCwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pO1xuXG4gICAgdmFyIGlzTW9kaWZ5ID0gTG9jYWxDb2xsZWN0aW9uLl9pc01vZGlmaWNhdGlvbk1vZChtb25nb01vZCk7XG5cbiAgICBpZiAob3B0aW9ucy5fZm9yYmlkUmVwbGFjZSAmJiAhaXNNb2RpZnkpIHtcbiAgICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoXCJJbnZhbGlkIG1vZGlmaWVyLiBSZXBsYWNlbWVudHMgYXJlIGZvcmJpZGRlbi5cIik7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2UndmUgYWxyZWFkeSBydW4gcmVwbGFjZVR5cGVzL3JlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvIG9uXG4gICAgLy8gc2VsZWN0b3IgYW5kIG1vZC4gIFdlIGFzc3VtZSBpdCBkb2Vzbid0IG1hdHRlciwgYXMgZmFyIGFzXG4gICAgLy8gdGhlIGJlaGF2aW9yIG9mIG1vZGlmaWVycyBpcyBjb25jZXJuZWQsIHdoZXRoZXIgYF9tb2RpZnlgXG4gICAgLy8gaXMgcnVuIG9uIEVKU09OIG9yIG9uIG1vbmdvLWNvbnZlcnRlZCBFSlNPTi5cblxuICAgIC8vIFJ1biB0aGlzIGNvZGUgdXAgZnJvbnQgc28gdGhhdCBpdCBmYWlscyBmYXN0IGlmIHNvbWVvbmUgdXNlc1xuICAgIC8vIGEgTW9uZ28gdXBkYXRlIG9wZXJhdG9yIHdlIGRvbid0IHN1cHBvcnQuXG4gICAgbGV0IGtub3duSWQ7XG4gICAgaWYgKG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICB0cnkge1xuICAgICAgICBsZXQgbmV3RG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgICAga25vd25JZCA9IG5ld0RvYy5faWQ7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmXG4gICAgICAgICEgaXNNb2RpZnkgJiZcbiAgICAgICAgISBrbm93bklkICYmXG4gICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCAmJlxuICAgICAgICAhIChvcHRpb25zLmluc2VydGVkSWQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRCAmJlxuICAgICAgICAgICBvcHRpb25zLmdlbmVyYXRlZElkKSkge1xuICAgICAgLy8gSW4gY2FzZSBvZiBhbiB1cHNlcnQgd2l0aCBhIHJlcGxhY2VtZW50LCB3aGVyZSB0aGVyZSBpcyBubyBfaWQgZGVmaW5lZFxuICAgICAgLy8gaW4gZWl0aGVyIHRoZSBxdWVyeSBvciB0aGUgcmVwbGFjZW1lbnQgZG9jLCBtb25nbyB3aWxsIGdlbmVyYXRlIGFuIGlkIGl0c2VsZi5cbiAgICAgIC8vIFRoZXJlZm9yZSB3ZSBuZWVkIHRoaXMgc3BlY2lhbCBzdHJhdGVneSBpZiB3ZSB3YW50IHRvIGNvbnRyb2wgdGhlIGlkIG91cnNlbHZlcy5cblxuICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBkbyB0aGlzIHdoZW46XG4gICAgICAvLyAtIFRoaXMgaXMgbm90IGEgcmVwbGFjZW1lbnQsIHNvIHdlIGNhbiBhZGQgYW4gX2lkIHRvICRzZXRPbkluc2VydFxuICAgICAgLy8gLSBUaGUgaWQgaXMgZGVmaW5lZCBieSBxdWVyeSBvciBtb2Qgd2UgY2FuIGp1c3QgYWRkIGl0IHRvIHRoZSByZXBsYWNlbWVudCBkb2NcbiAgICAgIC8vIC0gVGhlIHVzZXIgZGlkIG5vdCBzcGVjaWZ5IGFueSBpZCBwcmVmZXJlbmNlIGFuZCB0aGUgaWQgaXMgYSBNb25nbyBPYmplY3RJZCxcbiAgICAgIC8vICAgICB0aGVuIHdlIGNhbiBqdXN0IGxldCBNb25nbyBnZW5lcmF0ZSB0aGUgaWRcblxuICAgICAgc2ltdWxhdGVVcHNlcnRXaXRoSW5zZXJ0ZWRJZChcbiAgICAgICAgY29sbGVjdGlvbiwgbW9uZ29TZWxlY3RvciwgbW9uZ29Nb2QsIG9wdGlvbnMsXG4gICAgICAgIC8vIFRoaXMgY2FsbGJhY2sgZG9lcyBub3QgbmVlZCB0byBiZSBiaW5kRW52aXJvbm1lbnQnZWQgYmVjYXVzZVxuICAgICAgICAvLyBzaW11bGF0ZVVwc2VydFdpdGhJbnNlcnRlZElkKCkgd3JhcHMgaXQgYW5kIHRoZW4gcGFzc2VzIGl0IHRocm91Z2hcbiAgICAgICAgLy8gYmluZEVudmlyb25tZW50Rm9yV3JpdGUuXG4gICAgICAgIGZ1bmN0aW9uIChlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgLy8gSWYgd2UgZ290IGhlcmUgdmlhIGEgdXBzZXJ0KCkgY2FsbCwgdGhlbiBvcHRpb25zLl9yZXR1cm5PYmplY3Qgd2lsbFxuICAgICAgICAgIC8vIGJlIHNldCBhbmQgd2Ugc2hvdWxkIHJldHVybiB0aGUgd2hvbGUgb2JqZWN0LiBPdGhlcndpc2UsIHdlIHNob3VsZFxuICAgICAgICAgIC8vIGp1c3QgcmV0dXJuIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgZG9jcyB0byBtYXRjaCB0aGUgbW9uZ28gQVBJLlxuICAgICAgICAgIGlmIChyZXN1bHQgJiYgISBvcHRpb25zLl9yZXR1cm5PYmplY3QpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycm9yLCByZXN1bHQubnVtYmVyQWZmZWN0ZWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnJvciwgcmVzdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcblxuICAgICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmICFrbm93bklkICYmIG9wdGlvbnMuaW5zZXJ0ZWRJZCAmJiBpc01vZGlmeSkge1xuICAgICAgICBpZiAoIW1vbmdvTW9kLmhhc093blByb3BlcnR5KCckc2V0T25JbnNlcnQnKSkge1xuICAgICAgICAgIG1vbmdvTW9kLiRzZXRPbkluc2VydCA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGtub3duSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7XG4gICAgICAgIE9iamVjdC5hc3NpZ24obW9uZ29Nb2QuJHNldE9uSW5zZXJ0LCByZXBsYWNlVHlwZXMoe19pZDogb3B0aW9ucy5pbnNlcnRlZElkfSwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RyaW5ncyA9IE9iamVjdC5rZXlzKG1vbmdvTW9kKS5maWx0ZXIoKGtleSkgPT4gIWtleS5zdGFydHNXaXRoKFwiJFwiKSk7XG4gICAgICBsZXQgdXBkYXRlTWV0aG9kID0gc3RyaW5ncy5sZW5ndGggPiAwID8gJ3JlcGxhY2VPbmUnIDogJ3VwZGF0ZU1hbnknO1xuICAgICAgdXBkYXRlTWV0aG9kID1cbiAgICAgICAgdXBkYXRlTWV0aG9kID09PSAndXBkYXRlTWFueScgJiYgIW1vbmdvT3B0cy5tdWx0aVxuICAgICAgICAgID8gJ3VwZGF0ZU9uZSdcbiAgICAgICAgICA6IHVwZGF0ZU1ldGhvZDtcbiAgICAgIGNvbGxlY3Rpb25bdXBkYXRlTWV0aG9kXS5iaW5kKGNvbGxlY3Rpb24pKFxuICAgICAgICBtb25nb1NlbGVjdG9yLCBtb25nb01vZCwgbW9uZ29PcHRzLFxuICAgICAgICAgIC8vIG1vbmdvIGRyaXZlciBub3cgcmV0dXJucyB1bmRlZmluZWQgZm9yIGVyciBpbiB0aGUgY2FsbGJhY2tcbiAgICAgICAgICBiaW5kRW52aXJvbm1lbnRGb3JXcml0ZShmdW5jdGlvbiAoZXJyID0gbnVsbCwgcmVzdWx0KSB7XG4gICAgICAgICAgaWYgKCEgZXJyKSB7XG4gICAgICAgICAgICB2YXIgbWV0ZW9yUmVzdWx0ID0gdHJhbnNmb3JtUmVzdWx0KHtyZXN1bHR9KTtcbiAgICAgICAgICAgIGlmIChtZXRlb3JSZXN1bHQgJiYgb3B0aW9ucy5fcmV0dXJuT2JqZWN0KSB7XG4gICAgICAgICAgICAgIC8vIElmIHRoaXMgd2FzIGFuIHVwc2VydCgpIGNhbGwsIGFuZCB3ZSBlbmRlZCB1cFxuICAgICAgICAgICAgICAvLyBpbnNlcnRpbmcgYSBuZXcgZG9jIGFuZCB3ZSBrbm93IGl0cyBpZCwgdGhlblxuICAgICAgICAgICAgICAvLyByZXR1cm4gdGhhdCBpZCBhcyB3ZWxsLlxuICAgICAgICAgICAgICBpZiAob3B0aW9ucy51cHNlcnQgJiYgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoa25vd25JZCkge1xuICAgICAgICAgICAgICAgICAgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgPSBrbm93bklkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgaW5zdGFuY2VvZiBNb25nb0RCLk9iamVjdElEKSB7XG4gICAgICAgICAgICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IG5ldyBNb25nby5PYmplY3RJRChtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZC50b0hleFN0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG1ldGVvclJlc3VsdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIG1ldGVvclJlc3VsdC5udW1iZXJBZmZlY3RlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgdGhyb3cgZTtcbiAgfVxufTtcblxudmFyIHRyYW5zZm9ybVJlc3VsdCA9IGZ1bmN0aW9uIChkcml2ZXJSZXN1bHQpIHtcbiAgdmFyIG1ldGVvclJlc3VsdCA9IHsgbnVtYmVyQWZmZWN0ZWQ6IDAgfTtcbiAgaWYgKGRyaXZlclJlc3VsdCkge1xuICAgIHZhciBtb25nb1Jlc3VsdCA9IGRyaXZlclJlc3VsdC5yZXN1bHQ7XG4gICAgLy8gT24gdXBkYXRlcyB3aXRoIHVwc2VydDp0cnVlLCB0aGUgaW5zZXJ0ZWQgdmFsdWVzIGNvbWUgYXMgYSBsaXN0IG9mXG4gICAgLy8gdXBzZXJ0ZWQgdmFsdWVzIC0tIGV2ZW4gd2l0aCBvcHRpb25zLm11bHRpLCB3aGVuIHRoZSB1cHNlcnQgZG9lcyBpbnNlcnQsXG4gICAgLy8gaXQgb25seSBpbnNlcnRzIG9uZSBlbGVtZW50LlxuICAgIGlmIChtb25nb1Jlc3VsdC51cHNlcnRlZENvdW50KSB7XG4gICAgICBtZXRlb3JSZXN1bHQubnVtYmVyQWZmZWN0ZWQgPSBtb25nb1Jlc3VsdC51cHNlcnRlZENvdW50O1xuXG4gICAgICBpZiAobW9uZ29SZXN1bHQudXBzZXJ0ZWRJZCkge1xuICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IG1vbmdvUmVzdWx0LnVwc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG4gd2FzIHVzZWQgYmVmb3JlIE1vbmdvIDUuMCwgaW4gTW9uZ28gNS4wIHdlIGFyZSBub3QgcmVjZWl2aW5nIHRoaXMgblxuICAgICAgLy8gZmllbGQgYW5kIHNvIHdlIGFyZSB1c2luZyBtb2RpZmllZENvdW50IGluc3RlYWRcbiAgICAgIG1ldGVvclJlc3VsdC5udW1iZXJBZmZlY3RlZCA9IG1vbmdvUmVzdWx0Lm4gfHwgbW9uZ29SZXN1bHQubWF0Y2hlZENvdW50IHx8IG1vbmdvUmVzdWx0Lm1vZGlmaWVkQ291bnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1ldGVvclJlc3VsdDtcbn07XG5cblxudmFyIE5VTV9PUFRJTUlTVElDX1RSSUVTID0gMztcblxuLy8gZXhwb3NlZCBmb3IgdGVzdGluZ1xuTW9uZ29Db25uZWN0aW9uLl9pc0Nhbm5vdENoYW5nZUlkRXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG5cbiAgLy8gTW9uZ28gMy4yLiogcmV0dXJucyBlcnJvciBhcyBuZXh0IE9iamVjdDpcbiAgLy8ge25hbWU6IFN0cmluZywgY29kZTogTnVtYmVyLCBlcnJtc2c6IFN0cmluZ31cbiAgLy8gT2xkZXIgTW9uZ28gcmV0dXJuczpcbiAgLy8ge25hbWU6IFN0cmluZywgY29kZTogTnVtYmVyLCBlcnI6IFN0cmluZ31cbiAgdmFyIGVycm9yID0gZXJyLmVycm1zZyB8fCBlcnIuZXJyO1xuXG4gIC8vIFdlIGRvbid0IHVzZSB0aGUgZXJyb3IgY29kZSBoZXJlXG4gIC8vIGJlY2F1c2UgdGhlIGVycm9yIGNvZGUgd2Ugb2JzZXJ2ZWQgaXQgcHJvZHVjaW5nICgxNjgzNykgYXBwZWFycyB0byBiZVxuICAvLyBhIGZhciBtb3JlIGdlbmVyaWMgZXJyb3IgY29kZSBiYXNlZCBvbiBleGFtaW5pbmcgdGhlIHNvdXJjZS5cbiAgaWYgKGVycm9yLmluZGV4T2YoJ1RoZSBfaWQgZmllbGQgY2Fubm90IGJlIGNoYW5nZWQnKSA9PT0gMFxuICAgIHx8IGVycm9yLmluZGV4T2YoXCJ0aGUgKGltbXV0YWJsZSkgZmllbGQgJ19pZCcgd2FzIGZvdW5kIHRvIGhhdmUgYmVlbiBhbHRlcmVkIHRvIF9pZFwiKSAhPT0gLTEpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBzaW11bGF0ZVVwc2VydFdpdGhJbnNlcnRlZElkID0gZnVuY3Rpb24gKGNvbGxlY3Rpb24sIHNlbGVjdG9yLCBtb2QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLCBjYWxsYmFjaykge1xuICAvLyBTVFJBVEVHWTogRmlyc3QgdHJ5IGRvaW5nIGFuIHVwc2VydCB3aXRoIGEgZ2VuZXJhdGVkIElELlxuICAvLyBJZiB0aGlzIHRocm93cyBhbiBlcnJvciBhYm91dCBjaGFuZ2luZyB0aGUgSUQgb24gYW4gZXhpc3RpbmcgZG9jdW1lbnRcbiAgLy8gdGhlbiB3aXRob3V0IGFmZmVjdGluZyB0aGUgZGF0YWJhc2UsIHdlIGtub3cgd2Ugc2hvdWxkIHByb2JhYmx5IHRyeVxuICAvLyBhbiB1cGRhdGUgd2l0aG91dCB0aGUgZ2VuZXJhdGVkIElELiBJZiBpdCBhZmZlY3RlZCAwIGRvY3VtZW50cyxcbiAgLy8gdGhlbiB3aXRob3V0IGFmZmVjdGluZyB0aGUgZGF0YWJhc2UsIHdlIHRoZSBkb2N1bWVudCB0aGF0IGZpcnN0XG4gIC8vIGdhdmUgdGhlIGVycm9yIGlzIHByb2JhYmx5IHJlbW92ZWQgYW5kIHdlIG5lZWQgdG8gdHJ5IGFuIGluc2VydCBhZ2FpblxuICAvLyBXZSBnbyBiYWNrIHRvIHN0ZXAgb25lIGFuZCByZXBlYXQuXG4gIC8vIExpa2UgYWxsIFwib3B0aW1pc3RpYyB3cml0ZVwiIHNjaGVtZXMsIHdlIHJlbHkgb24gdGhlIGZhY3QgdGhhdCBpdCdzXG4gIC8vIHVubGlrZWx5IG91ciB3cml0ZXMgd2lsbCBjb250aW51ZSB0byBiZSBpbnRlcmZlcmVkIHdpdGggdW5kZXIgbm9ybWFsXG4gIC8vIGNpcmN1bXN0YW5jZXMgKHRob3VnaCBzdWZmaWNpZW50bHkgaGVhdnkgY29udGVudGlvbiB3aXRoIHdyaXRlcnNcbiAgLy8gZGlzYWdyZWVpbmcgb24gdGhlIGV4aXN0ZW5jZSBvZiBhbiBvYmplY3Qgd2lsbCBjYXVzZSB3cml0ZXMgdG8gZmFpbFxuICAvLyBpbiB0aGVvcnkpLlxuXG4gIHZhciBpbnNlcnRlZElkID0gb3B0aW9ucy5pbnNlcnRlZElkOyAvLyBtdXN0IGV4aXN0XG4gIHZhciBtb25nb09wdHNGb3JVcGRhdGUgPSB7XG4gICAgc2FmZTogdHJ1ZSxcbiAgICBtdWx0aTogb3B0aW9ucy5tdWx0aVxuICB9O1xuICB2YXIgbW9uZ29PcHRzRm9ySW5zZXJ0ID0ge1xuICAgIHNhZmU6IHRydWUsXG4gICAgdXBzZXJ0OiB0cnVlXG4gIH07XG5cbiAgdmFyIHJlcGxhY2VtZW50V2l0aElkID0gT2JqZWN0LmFzc2lnbihcbiAgICByZXBsYWNlVHlwZXMoe19pZDogaW5zZXJ0ZWRJZH0sIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICBtb2QpO1xuXG4gIHZhciB0cmllcyA9IE5VTV9PUFRJTUlTVElDX1RSSUVTO1xuXG4gIHZhciBkb1VwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0cmllcy0tO1xuICAgIGlmICghIHRyaWVzKSB7XG4gICAgICBjYWxsYmFjayhuZXcgRXJyb3IoXCJVcHNlcnQgZmFpbGVkIGFmdGVyIFwiICsgTlVNX09QVElNSVNUSUNfVFJJRVMgKyBcIiB0cmllcy5cIikpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgbWV0aG9kID0gY29sbGVjdGlvbi51cGRhdGVNYW55O1xuICAgICAgaWYoIU9iamVjdC5rZXlzKG1vZCkuc29tZShrZXkgPT4ga2V5LnN0YXJ0c1dpdGgoXCIkXCIpKSl7XG4gICAgICAgIG1ldGhvZCA9IGNvbGxlY3Rpb24ucmVwbGFjZU9uZS5iaW5kKGNvbGxlY3Rpb24pO1xuICAgICAgfVxuICAgICAgbWV0aG9kKFxuICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgbW9kLFxuICAgICAgICBtb25nb09wdHNGb3JVcGRhdGUsXG4gICAgICAgIGJpbmRFbnZpcm9ubWVudEZvcldyaXRlKGZ1bmN0aW9uKGVyciwgcmVzdWx0KSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCAmJiAocmVzdWx0Lm1vZGlmaWVkQ291bnQgfHwgcmVzdWx0LnVwc2VydGVkQ291bnQpKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgICAgICAgIG51bWJlckFmZmVjdGVkOiByZXN1bHQubW9kaWZpZWRDb3VudCB8fCByZXN1bHQudXBzZXJ0ZWRDb3VudCxcbiAgICAgICAgICAgICAgaW5zZXJ0ZWRJZDogcmVzdWx0LnVwc2VydGVkSWQgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvQ29uZGl0aW9uYWxJbnNlcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cbiAgfTtcblxuICB2YXIgZG9Db25kaXRpb25hbEluc2VydCA9IGZ1bmN0aW9uKCkge1xuICAgIGNvbGxlY3Rpb24ucmVwbGFjZU9uZShcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgcmVwbGFjZW1lbnRXaXRoSWQsXG4gICAgICBtb25nb09wdHNGb3JJbnNlcnQsXG4gICAgICBiaW5kRW52aXJvbm1lbnRGb3JXcml0ZShmdW5jdGlvbihlcnIsIHJlc3VsdCkge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgLy8gZmlndXJlIG91dCBpZiB0aGlzIGlzIGFcbiAgICAgICAgICAvLyBcImNhbm5vdCBjaGFuZ2UgX2lkIG9mIGRvY3VtZW50XCIgZXJyb3IsIGFuZFxuICAgICAgICAgIC8vIGlmIHNvLCB0cnkgZG9VcGRhdGUoKSBhZ2FpbiwgdXAgdG8gMyB0aW1lcy5cbiAgICAgICAgICBpZiAoTW9uZ29Db25uZWN0aW9uLl9pc0Nhbm5vdENoYW5nZUlkRXJyb3IoZXJyKSkge1xuICAgICAgICAgICAgZG9VcGRhdGUoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwge1xuICAgICAgICAgICAgbnVtYmVyQWZmZWN0ZWQ6IHJlc3VsdC51cHNlcnRlZENvdW50LFxuICAgICAgICAgICAgaW5zZXJ0ZWRJZDogcmVzdWx0LnVwc2VydGVkSWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgfTtcblxuICBkb1VwZGF0ZSgpO1xufTtcblxuXy5lYWNoKFtcImluc2VydFwiLCBcInVwZGF0ZVwiLCBcInJlbW92ZVwiLCBcImRyb3BDb2xsZWN0aW9uXCIsIFwiZHJvcERhdGFiYXNlXCJdLCBmdW5jdGlvbiAobWV0aG9kKSB7XG4gIE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uICgvKiBhcmd1bWVudHMgKi8pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIE1ldGVvci53cmFwQXN5bmMoc2VsZltcIl9cIiArIG1ldGhvZF0pLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gIH07XG59KTtcblxuLy8gWFhYIE1vbmdvQ29ubmVjdGlvbi51cHNlcnQoKSBkb2VzIG5vdCByZXR1cm4gdGhlIGlkIG9mIHRoZSBpbnNlcnRlZCBkb2N1bWVudFxuLy8gdW5sZXNzIHlvdSBzZXQgaXQgZXhwbGljaXRseSBpbiB0aGUgc2VsZWN0b3Igb3IgbW9kaWZpZXIgKGFzIGEgcmVwbGFjZW1lbnRcbi8vIGRvYykuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnVwc2VydCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG1vZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcImZ1bmN0aW9uXCIgJiYgISBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICBvcHRpb25zID0ge307XG4gIH1cblxuICByZXR1cm4gc2VsZi51cGRhdGUoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBtb2QsXG4gICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICB1cHNlcnQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgIF9yZXR1cm5PYmplY3Q6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgIH0pLCBjYWxsYmFjayk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSlcbiAgICBzZWxlY3RvciA9IHt9O1xuXG4gIHJldHVybiBuZXcgQ3Vyc29yKFxuICAgIHNlbGYsIG5ldyBDdXJzb3JEZXNjcmlwdGlvbihjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZmluZE9uZSA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSlcbiAgICBzZWxlY3RvciA9IHt9O1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBvcHRpb25zLmxpbWl0ID0gMTtcbiAgcmV0dXJuIHNlbGYuZmluZChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yLCBvcHRpb25zKS5mZXRjaCgpWzBdO1xufTtcblxuLy8gV2UnbGwgYWN0dWFsbHkgZGVzaWduIGFuIGluZGV4IEFQSSBsYXRlci4gRm9yIG5vdywgd2UganVzdCBwYXNzIHRocm91Z2ggdG9cbi8vIE1vbmdvJ3MsIGJ1dCBtYWtlIGl0IHN5bmNocm9ub3VzLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgaW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBXZSBleHBlY3QgdGhpcyBmdW5jdGlvbiB0byBiZSBjYWxsZWQgYXQgc3RhcnR1cCwgbm90IGZyb20gd2l0aGluIGEgbWV0aG9kLFxuICAvLyBzbyB3ZSBkb24ndCBpbnRlcmFjdCB3aXRoIHRoZSB3cml0ZSBmZW5jZS5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICB2YXIgZnV0dXJlID0gbmV3IEZ1dHVyZTtcbiAgdmFyIGluZGV4TmFtZSA9IGNvbGxlY3Rpb24uY3JlYXRlSW5kZXgoaW5kZXgsIG9wdGlvbnMsIGZ1dHVyZS5yZXNvbHZlcigpKTtcbiAgZnV0dXJlLndhaXQoKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY291bnREb2N1bWVudHMgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIC4uLmFyZ3MpIHtcbiAgYXJncyA9IGFyZ3MubWFwKGFyZyA9PiByZXBsYWNlVHlwZXMoYXJnLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICBjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgcmV0dXJuIGNvbGxlY3Rpb24uY291bnREb2N1bWVudHMoLi4uYXJncyk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmVzdGltYXRlZERvY3VtZW50Q291bnQgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIC4uLmFyZ3MpIHtcbiAgYXJncyA9IGFyZ3MubWFwKGFyZyA9PiByZXBsYWNlVHlwZXMoYXJnLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICBjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgcmV0dXJuIGNvbGxlY3Rpb24uZXN0aW1hdGVkRG9jdW1lbnRDb3VudCguLi5hcmdzKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Vuc3VyZUluZGV4ID0gTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleDtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fZHJvcEluZGV4ID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBpbmRleCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgYnkgdGVzdCBjb2RlLCBub3Qgd2l0aGluIGEgbWV0aG9kLCBzbyB3ZSBkb24ndFxuICAvLyBpbnRlcmFjdCB3aXRoIHRoZSB3cml0ZSBmZW5jZS5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICB2YXIgZnV0dXJlID0gbmV3IEZ1dHVyZTtcbiAgdmFyIGluZGV4TmFtZSA9IGNvbGxlY3Rpb24uZHJvcEluZGV4KGluZGV4LCBmdXR1cmUucmVzb2x2ZXIoKSk7XG4gIGZ1dHVyZS53YWl0KCk7XG59O1xuXG4vLyBDVVJTT1JTXG5cbi8vIFRoZXJlIGFyZSBzZXZlcmFsIGNsYXNzZXMgd2hpY2ggcmVsYXRlIHRvIGN1cnNvcnM6XG4vL1xuLy8gQ3Vyc29yRGVzY3JpcHRpb24gcmVwcmVzZW50cyB0aGUgYXJndW1lbnRzIHVzZWQgdG8gY29uc3RydWN0IGEgY3Vyc29yOlxuLy8gY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBhbmQgKGZpbmQpIG9wdGlvbnMuICBCZWNhdXNlIGl0IGlzIHVzZWQgYXMgYSBrZXlcbi8vIGZvciBjdXJzb3IgZGUtZHVwLCBldmVyeXRoaW5nIGluIGl0IHNob3VsZCBlaXRoZXIgYmUgSlNPTi1zdHJpbmdpZmlhYmxlIG9yXG4vLyBub3QgYWZmZWN0IG9ic2VydmVDaGFuZ2VzIG91dHB1dCAoZWcsIG9wdGlvbnMudHJhbnNmb3JtIGZ1bmN0aW9ucyBhcmUgbm90XG4vLyBzdHJpbmdpZmlhYmxlIGJ1dCBkbyBub3QgYWZmZWN0IG9ic2VydmVDaGFuZ2VzKS5cbi8vXG4vLyBTeW5jaHJvbm91c0N1cnNvciBpcyBhIHdyYXBwZXIgYXJvdW5kIGEgTW9uZ29EQiBjdXJzb3Jcbi8vIHdoaWNoIGluY2x1ZGVzIGZ1bGx5LXN5bmNocm9ub3VzIHZlcnNpb25zIG9mIGZvckVhY2gsIGV0Yy5cbi8vXG4vLyBDdXJzb3IgaXMgdGhlIGN1cnNvciBvYmplY3QgcmV0dXJuZWQgZnJvbSBmaW5kKCksIHdoaWNoIGltcGxlbWVudHMgdGhlXG4vLyBkb2N1bWVudGVkIE1vbmdvLkNvbGxlY3Rpb24gY3Vyc29yIEFQSS4gIEl0IHdyYXBzIGEgQ3Vyc29yRGVzY3JpcHRpb24gYW5kIGFcbi8vIFN5bmNocm9ub3VzQ3Vyc29yIChsYXppbHk6IGl0IGRvZXNuJ3QgY29udGFjdCBNb25nbyB1bnRpbCB5b3UgY2FsbCBhIG1ldGhvZFxuLy8gbGlrZSBmZXRjaCBvciBmb3JFYWNoIG9uIGl0KS5cbi8vXG4vLyBPYnNlcnZlSGFuZGxlIGlzIHRoZSBcIm9ic2VydmUgaGFuZGxlXCIgcmV0dXJuZWQgZnJvbSBvYnNlcnZlQ2hhbmdlcy4gSXQgaGFzIGFcbi8vIHJlZmVyZW5jZSB0byBhbiBPYnNlcnZlTXVsdGlwbGV4ZXIuXG4vL1xuLy8gT2JzZXJ2ZU11bHRpcGxleGVyIGFsbG93cyBtdWx0aXBsZSBpZGVudGljYWwgT2JzZXJ2ZUhhbmRsZXMgdG8gYmUgZHJpdmVuIGJ5IGFcbi8vIHNpbmdsZSBvYnNlcnZlIGRyaXZlci5cbi8vXG4vLyBUaGVyZSBhcmUgdHdvIFwib2JzZXJ2ZSBkcml2ZXJzXCIgd2hpY2ggZHJpdmUgT2JzZXJ2ZU11bHRpcGxleGVyczpcbi8vICAgLSBQb2xsaW5nT2JzZXJ2ZURyaXZlciBjYWNoZXMgdGhlIHJlc3VsdHMgb2YgYSBxdWVyeSBhbmQgcmVydW5zIGl0IHdoZW5cbi8vICAgICBuZWNlc3NhcnkuXG4vLyAgIC0gT3Bsb2dPYnNlcnZlRHJpdmVyIGZvbGxvd3MgdGhlIE1vbmdvIG9wZXJhdGlvbiBsb2cgdG8gZGlyZWN0bHkgb2JzZXJ2ZVxuLy8gICAgIGRhdGFiYXNlIGNoYW5nZXMuXG4vLyBCb3RoIGltcGxlbWVudGF0aW9ucyBmb2xsb3cgdGhlIHNhbWUgc2ltcGxlIGludGVyZmFjZTogd2hlbiB5b3UgY3JlYXRlIHRoZW0sXG4vLyB0aGV5IHN0YXJ0IHNlbmRpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIChhbmQgYSByZWFkeSgpIGludm9jYXRpb24pIHRvXG4vLyB0aGVpciBPYnNlcnZlTXVsdGlwbGV4ZXIsIGFuZCB5b3Ugc3RvcCB0aGVtIGJ5IGNhbGxpbmcgdGhlaXIgc3RvcCgpIG1ldGhvZC5cblxuQ3Vyc29yRGVzY3JpcHRpb24gPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5jb2xsZWN0aW9uTmFtZSA9IGNvbGxlY3Rpb25OYW1lO1xuICBzZWxmLnNlbGVjdG9yID0gTW9uZ28uQ29sbGVjdGlvbi5fcmV3cml0ZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgc2VsZi5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbn07XG5cbkN1cnNvciA9IGZ1bmN0aW9uIChtb25nbywgY3Vyc29yRGVzY3JpcHRpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHNlbGYuX21vbmdvID0gbW9uZ287XG4gIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uID0gY3Vyc29yRGVzY3JpcHRpb247XG4gIHNlbGYuX3N5bmNocm9ub3VzQ3Vyc29yID0gbnVsbDtcbn07XG5cbmZ1bmN0aW9uIHNldHVwU3luY2hyb25vdXNDdXJzb3IoY3Vyc29yLCBtZXRob2QpIHtcbiAgLy8gWW91IGNhbiBvbmx5IG9ic2VydmUgYSB0YWlsYWJsZSBjdXJzb3IuXG4gIGlmIChjdXJzb3IuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2FsbCAnICsgbWV0aG9kICsgJyBvbiBhIHRhaWxhYmxlIGN1cnNvcicpO1xuXG4gIGlmICghY3Vyc29yLl9zeW5jaHJvbm91c0N1cnNvcikge1xuICAgIGN1cnNvci5fc3luY2hyb25vdXNDdXJzb3IgPSBjdXJzb3IuX21vbmdvLl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvcihcbiAgICAgIGN1cnNvci5fY3Vyc29yRGVzY3JpcHRpb24sXG4gICAgICB7XG4gICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBcImN1cnNvclwiIGFyZ3VtZW50IHRvIGZvckVhY2gvbWFwIGNhbGxiYWNrcyBpcyB0aGVcbiAgICAgICAgLy8gQ3Vyc29yLCBub3QgdGhlIFN5bmNocm9ub3VzQ3Vyc29yLlxuICAgICAgICBzZWxmRm9ySXRlcmF0aW9uOiBjdXJzb3IsXG4gICAgICAgIHVzZVRyYW5zZm9ybTogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGN1cnNvci5fc3luY2hyb25vdXNDdXJzb3I7XG59XG5cblxuQ3Vyc29yLnByb3RvdHlwZS5jb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX21vbmdvLnJhd0NvbGxlY3Rpb24odGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUpO1xuICByZXR1cm4gUHJvbWlzZS5hd2FpdChjb2xsZWN0aW9uLmNvdW50RG9jdW1lbnRzKFxuICAgIHJlcGxhY2VUeXBlcyh0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgIHJlcGxhY2VUeXBlcyh0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICkpO1xufTtcblxuWy4uLkFTWU5DX0NVUlNPUl9NRVRIT0RTLCBTeW1ib2wuaXRlcmF0b3IsIFN5bWJvbC5hc3luY0l0ZXJhdG9yXS5mb3JFYWNoKG1ldGhvZE5hbWUgPT4ge1xuICAvLyBjb3VudCBpcyBoYW5kbGVkIHNwZWNpYWxseSBzaW5jZSB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIGN1cnNvci5cbiAgLy8gaXQgaXMgc3RpbGwgaW5jbHVkZWQgaW4gQVNZTkNfQ1VSU09SX01FVEhPRFMgYmVjYXVzZSB3ZSBzdGlsbCB3YW50IGFuIGFzeW5jIHZlcnNpb24gb2YgaXQgdG8gZXhpc3QuXG4gIGlmIChtZXRob2ROYW1lICE9PSAnY291bnQnKSB7XG4gICAgQ3Vyc29yLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICBjb25zdCBjdXJzb3IgPSBzZXR1cFN5bmNocm9ub3VzQ3Vyc29yKHRoaXMsIG1ldGhvZE5hbWUpO1xuICAgICAgcmV0dXJuIGN1cnNvclttZXRob2ROYW1lXSguLi5hcmdzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gVGhlc2UgbWV0aG9kcyBhcmUgaGFuZGxlZCBzZXBhcmF0ZWx5LlxuICBpZiAobWV0aG9kTmFtZSA9PT0gU3ltYm9sLml0ZXJhdG9yIHx8IG1ldGhvZE5hbWUgPT09IFN5bWJvbC5hc3luY0l0ZXJhdG9yKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbWV0aG9kTmFtZUFzeW5jID0gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZE5hbWUpO1xuICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVBc3luY10gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpc1ttZXRob2ROYW1lXSguLi5hcmdzKSk7XG4gIH07XG59KTtcblxuQ3Vyc29yLnByb3RvdHlwZS5nZXRUcmFuc2Zvcm0gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybTtcbn07XG5cbi8vIFdoZW4geW91IGNhbGwgTWV0ZW9yLnB1Ymxpc2goKSB3aXRoIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgQ3Vyc29yLCB3ZSBuZWVkXG4vLyB0byB0cmFuc211dGUgaXQgaW50byB0aGUgZXF1aXZhbGVudCBzdWJzY3JpcHRpb24uICBUaGlzIGlzIHRoZSBmdW5jdGlvbiB0aGF0XG4vLyBkb2VzIHRoYXQuXG5cbkN1cnNvci5wcm90b3R5cGUuX3B1Ymxpc2hDdXJzb3IgPSBmdW5jdGlvbiAoc3ViKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcbiAgcmV0dXJuIE1vbmdvLkNvbGxlY3Rpb24uX3B1Ymxpc2hDdXJzb3Ioc2VsZiwgc3ViLCBjb2xsZWN0aW9uKTtcbn07XG5cbi8vIFVzZWQgdG8gZ3VhcmFudGVlIHRoYXQgcHVibGlzaCBmdW5jdGlvbnMgcmV0dXJuIGF0IG1vc3Qgb25lIGN1cnNvciBwZXJcbi8vIGNvbGxlY3Rpb24uIFByaXZhdGUsIGJlY2F1c2Ugd2UgbWlnaHQgbGF0ZXIgaGF2ZSBjdXJzb3JzIHRoYXQgaW5jbHVkZVxuLy8gZG9jdW1lbnRzIGZyb20gbXVsdGlwbGUgY29sbGVjdGlvbnMgc29tZWhvdy5cbkN1cnNvci5wcm90b3R5cGUuX2dldENvbGxlY3Rpb25OYW1lID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcbn07XG5cbkN1cnNvci5wcm90b3R5cGUub2JzZXJ2ZSA9IGZ1bmN0aW9uIChjYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzKHNlbGYsIGNhbGxiYWNrcyk7XG59O1xuXG5DdXJzb3IucHJvdG90eXBlLm9ic2VydmVDaGFuZ2VzID0gZnVuY3Rpb24gKGNhbGxiYWNrcywgb3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIG1ldGhvZHMgPSBbXG4gICAgJ2FkZGVkQXQnLFxuICAgICdhZGRlZCcsXG4gICAgJ2NoYW5nZWRBdCcsXG4gICAgJ2NoYW5nZWQnLFxuICAgICdyZW1vdmVkQXQnLFxuICAgICdyZW1vdmVkJyxcbiAgICAnbW92ZWRUbydcbiAgXTtcbiAgdmFyIG9yZGVyZWQgPSBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZChjYWxsYmFja3MpO1xuXG4gIGxldCBleGNlcHRpb25OYW1lID0gY2FsbGJhY2tzLl9mcm9tT2JzZXJ2ZSA/ICdvYnNlcnZlJyA6ICdvYnNlcnZlQ2hhbmdlcyc7XG4gIGV4Y2VwdGlvbk5hbWUgKz0gJyBjYWxsYmFjayc7XG4gIG1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgaWYgKGNhbGxiYWNrc1ttZXRob2RdICYmIHR5cGVvZiBjYWxsYmFja3NbbWV0aG9kXSA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNhbGxiYWNrc1ttZXRob2RdID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFja3NbbWV0aG9kXSwgbWV0aG9kICsgZXhjZXB0aW9uTmFtZSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gc2VsZi5fbW9uZ28uX29ic2VydmVDaGFuZ2VzKFxuICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkLCBjYWxsYmFja3MsIG9wdGlvbnMubm9uTXV0YXRpbmdDYWxsYmFja3MpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IgPSBmdW5jdGlvbihcbiAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBfLnBpY2sob3B0aW9ucyB8fCB7fSwgJ3NlbGZGb3JJdGVyYXRpb24nLCAndXNlVHJhbnNmb3JtJyk7XG5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUpO1xuICB2YXIgY3Vyc29yT3B0aW9ucyA9IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnM7XG4gIHZhciBtb25nb09wdGlvbnMgPSB7XG4gICAgc29ydDogY3Vyc29yT3B0aW9ucy5zb3J0LFxuICAgIGxpbWl0OiBjdXJzb3JPcHRpb25zLmxpbWl0LFxuICAgIHNraXA6IGN1cnNvck9wdGlvbnMuc2tpcCxcbiAgICBwcm9qZWN0aW9uOiBjdXJzb3JPcHRpb25zLmZpZWxkcyB8fCBjdXJzb3JPcHRpb25zLnByb2plY3Rpb24sXG4gICAgcmVhZFByZWZlcmVuY2U6IGN1cnNvck9wdGlvbnMucmVhZFByZWZlcmVuY2UsXG4gIH07XG5cbiAgLy8gRG8gd2Ugd2FudCBhIHRhaWxhYmxlIGN1cnNvciAod2hpY2ggb25seSB3b3JrcyBvbiBjYXBwZWQgY29sbGVjdGlvbnMpP1xuICBpZiAoY3Vyc29yT3B0aW9ucy50YWlsYWJsZSkge1xuICAgIG1vbmdvT3B0aW9ucy5udW1iZXJPZlJldHJpZXMgPSAtMTtcbiAgfVxuXG4gIHZhciBkYkN1cnNvciA9IGNvbGxlY3Rpb24uZmluZChcbiAgICByZXBsYWNlVHlwZXMoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICBtb25nb09wdGlvbnMpO1xuXG4gIC8vIERvIHdlIHdhbnQgYSB0YWlsYWJsZSBjdXJzb3IgKHdoaWNoIG9ubHkgd29ya3Mgb24gY2FwcGVkIGNvbGxlY3Rpb25zKT9cbiAgaWYgKGN1cnNvck9wdGlvbnMudGFpbGFibGUpIHtcbiAgICAvLyBXZSB3YW50IGEgdGFpbGFibGUgY3Vyc29yLi4uXG4gICAgZGJDdXJzb3IuYWRkQ3Vyc29yRmxhZyhcInRhaWxhYmxlXCIsIHRydWUpXG4gICAgLy8gLi4uIGFuZCBmb3IgdGhlIHNlcnZlciB0byB3YWl0IGEgYml0IGlmIGFueSBnZXRNb3JlIGhhcyBubyBkYXRhIChyYXRoZXJcbiAgICAvLyB0aGFuIG1ha2luZyB1cyBwdXQgdGhlIHJlbGV2YW50IHNsZWVwcyBpbiB0aGUgY2xpZW50KS4uLlxuICAgIGRiQ3Vyc29yLmFkZEN1cnNvckZsYWcoXCJhd2FpdERhdGFcIiwgdHJ1ZSlcblxuICAgIC8vIEFuZCBpZiB0aGlzIGlzIG9uIHRoZSBvcGxvZyBjb2xsZWN0aW9uIGFuZCB0aGUgY3Vyc29yIHNwZWNpZmllcyBhICd0cycsXG4gICAgLy8gdGhlbiBzZXQgdGhlIHVuZG9jdW1lbnRlZCBvcGxvZyByZXBsYXkgZmxhZywgd2hpY2ggZG9lcyBhIHNwZWNpYWwgc2NhbiB0b1xuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGRvY3VtZW50IChpbnN0ZWFkIG9mIGNyZWF0aW5nIGFuIGluZGV4IG9uIHRzKS4gVGhpcyBpcyBhXG4gICAgLy8gdmVyeSBoYXJkLWNvZGVkIE1vbmdvIGZsYWcgd2hpY2ggb25seSB3b3JrcyBvbiB0aGUgb3Bsb2cgY29sbGVjdGlvbiBhbmRcbiAgICAvLyBvbmx5IHdvcmtzIHdpdGggdGhlIHRzIGZpZWxkLlxuICAgIGlmIChjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSA9PT0gT1BMT0dfQ09MTEVDVElPTiAmJlxuICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3Rvci50cykge1xuICAgICAgZGJDdXJzb3IuYWRkQ3Vyc29yRmxhZyhcIm9wbG9nUmVwbGF5XCIsIHRydWUpXG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVvZiBjdXJzb3JPcHRpb25zLm1heFRpbWVNcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBkYkN1cnNvciA9IGRiQ3Vyc29yLm1heFRpbWVNUyhjdXJzb3JPcHRpb25zLm1heFRpbWVNcyk7XG4gIH1cbiAgaWYgKHR5cGVvZiBjdXJzb3JPcHRpb25zLmhpbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgZGJDdXJzb3IgPSBkYkN1cnNvci5oaW50KGN1cnNvck9wdGlvbnMuaGludCk7XG4gIH1cblxuICByZXR1cm4gbmV3IFN5bmNocm9ub3VzQ3Vyc29yKGRiQ3Vyc29yLCBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucywgY29sbGVjdGlvbik7XG59O1xuXG52YXIgU3luY2hyb25vdXNDdXJzb3IgPSBmdW5jdGlvbiAoZGJDdXJzb3IsIGN1cnNvckRlc2NyaXB0aW9uLCBvcHRpb25zLCBjb2xsZWN0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IF8ucGljayhvcHRpb25zIHx8IHt9LCAnc2VsZkZvckl0ZXJhdGlvbicsICd1c2VUcmFuc2Zvcm0nKTtcblxuICBzZWxmLl9kYkN1cnNvciA9IGRiQ3Vyc29yO1xuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuICAvLyBUaGUgXCJzZWxmXCIgYXJndW1lbnQgcGFzc2VkIHRvIGZvckVhY2gvbWFwIGNhbGxiYWNrcy4gSWYgd2UncmUgd3JhcHBlZFxuICAvLyBpbnNpZGUgYSB1c2VyLXZpc2libGUgQ3Vyc29yLCB3ZSB3YW50IHRvIHByb3ZpZGUgdGhlIG91dGVyIGN1cnNvciFcbiAgc2VsZi5fc2VsZkZvckl0ZXJhdGlvbiA9IG9wdGlvbnMuc2VsZkZvckl0ZXJhdGlvbiB8fCBzZWxmO1xuICBpZiAob3B0aW9ucy51c2VUcmFuc2Zvcm0gJiYgY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50cmFuc2Zvcm0pIHtcbiAgICBzZWxmLl90cmFuc2Zvcm0gPSBMb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybShcbiAgICAgIGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtKTtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl90cmFuc2Zvcm0gPSBudWxsO1xuICB9XG5cbiAgc2VsZi5fc3luY2hyb25vdXNDb3VudCA9IEZ1dHVyZS53cmFwKFxuICAgIGNvbGxlY3Rpb24uY291bnREb2N1bWVudHMuYmluZChcbiAgICAgIGNvbGxlY3Rpb24sXG4gICAgICByZXBsYWNlVHlwZXMoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICAgIHJlcGxhY2VUeXBlcyhjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAgKVxuICApO1xuICBzZWxmLl92aXNpdGVkSWRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG59O1xuXG5fLmV4dGVuZChTeW5jaHJvbm91c0N1cnNvci5wcm90b3R5cGUsIHtcbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSB1bmRlcmx5aW5nIGN1cnNvciAoYmVmb3JlXG4gIC8vIHRoZSBNb25nby0+TWV0ZW9yIHR5cGUgcmVwbGFjZW1lbnQpLlxuICBfcmF3TmV4dE9iamVjdFByb21pc2U6IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgc2VsZi5fZGJDdXJzb3IubmV4dCgoZXJyLCBkb2MpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSBjdXJzb3IsIHNraXBwaW5nIHRob3NlIHdob3NlXG4gIC8vIElEcyB3ZSd2ZSBhbHJlYWR5IHNlZW4gYW5kIHJlcGxhY2luZyBNb25nbyBhdG9tcyB3aXRoIE1ldGVvciBhdG9tcy5cbiAgX25leHRPYmplY3RQcm9taXNlOiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIHZhciBkb2MgPSBhd2FpdCBzZWxmLl9yYXdOZXh0T2JqZWN0UHJvbWlzZSgpO1xuXG4gICAgICBpZiAoIWRvYykgcmV0dXJuIG51bGw7XG4gICAgICBkb2MgPSByZXBsYWNlVHlwZXMoZG9jLCByZXBsYWNlTW9uZ29BdG9tV2l0aE1ldGVvcik7XG5cbiAgICAgIGlmICghc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50YWlsYWJsZSAmJiBfLmhhcyhkb2MsICdfaWQnKSkge1xuICAgICAgICAvLyBEaWQgTW9uZ28gZ2l2ZSB1cyBkdXBsaWNhdGUgZG9jdW1lbnRzIGluIHRoZSBzYW1lIGN1cnNvcj8gSWYgc28sXG4gICAgICAgIC8vIGlnbm9yZSB0aGlzIG9uZS4gKERvIHRoaXMgYmVmb3JlIHRoZSB0cmFuc2Zvcm0sIHNpbmNlIHRyYW5zZm9ybSBtaWdodFxuICAgICAgICAvLyByZXR1cm4gc29tZSB1bnJlbGF0ZWQgdmFsdWUuKSBXZSBkb24ndCBkbyB0aGlzIGZvciB0YWlsYWJsZSBjdXJzb3JzLFxuICAgICAgICAvLyBiZWNhdXNlIHdlIHdhbnQgdG8gbWFpbnRhaW4gTygxKSBtZW1vcnkgdXNhZ2UuIEFuZCBpZiB0aGVyZSBpc24ndCBfaWRcbiAgICAgICAgLy8gZm9yIHNvbWUgcmVhc29uIChtYXliZSBpdCdzIHRoZSBvcGxvZyksIHRoZW4gd2UgZG9uJ3QgZG8gdGhpcyBlaXRoZXIuXG4gICAgICAgIC8vIChCZSBjYXJlZnVsIHRvIGRvIHRoaXMgZm9yIGZhbHNleSBidXQgZXhpc3RpbmcgX2lkLCB0aG91Z2guKVxuICAgICAgICBpZiAoc2VsZi5fdmlzaXRlZElkcy5oYXMoZG9jLl9pZCkpIGNvbnRpbnVlO1xuICAgICAgICBzZWxmLl92aXNpdGVkSWRzLnNldChkb2MuX2lkLCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX3RyYW5zZm9ybSlcbiAgICAgICAgZG9jID0gc2VsZi5fdHJhbnNmb3JtKGRvYyk7XG5cbiAgICAgIHJldHVybiBkb2M7XG4gICAgfVxuICB9LFxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdpdGggdGhlIG5leHQgb2JqZWN0IChsaWtlIHdpdGhcbiAgLy8gX25leHRPYmplY3RQcm9taXNlKSBvciByZWplY3RlZCBpZiB0aGUgY3Vyc29yIGRvZXNuJ3QgcmV0dXJuIHdpdGhpblxuICAvLyB0aW1lb3V0TVMgbXMuXG4gIF9uZXh0T2JqZWN0UHJvbWlzZVdpdGhUaW1lb3V0OiBmdW5jdGlvbiAodGltZW91dE1TKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCF0aW1lb3V0TVMpIHtcbiAgICAgIHJldHVybiBzZWxmLl9uZXh0T2JqZWN0UHJvbWlzZSgpO1xuICAgIH1cbiAgICBjb25zdCBuZXh0T2JqZWN0UHJvbWlzZSA9IHNlbGYuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgY29uc3QgdGltZW91dEVyciA9IG5ldyBFcnJvcignQ2xpZW50LXNpZGUgdGltZW91dCB3YWl0aW5nIGZvciBuZXh0IG9iamVjdCcpO1xuICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcmVqZWN0KHRpbWVvdXRFcnIpO1xuICAgICAgfSwgdGltZW91dE1TKTtcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtuZXh0T2JqZWN0UHJvbWlzZSwgdGltZW91dFByb21pc2VdKVxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgaWYgKGVyciA9PT0gdGltZW91dEVycikge1xuICAgICAgICAgIHNlbGYuY2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9KTtcbiAgfSxcblxuICBfbmV4dE9iamVjdDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5fbmV4dE9iamVjdFByb21pc2UoKS5hd2FpdCgpO1xuICB9LFxuXG4gIGZvckVhY2g6IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gICAgc2VsZi5fcmV3aW5kKCk7XG5cbiAgICAvLyBXZSBpbXBsZW1lbnQgdGhlIGxvb3Agb3Vyc2VsZiBpbnN0ZWFkIG9mIHVzaW5nIHNlbGYuX2RiQ3Vyc29yLmVhY2gsXG4gICAgLy8gYmVjYXVzZSBcImVhY2hcIiB3aWxsIGNhbGwgaXRzIGNhbGxiYWNrIG91dHNpZGUgb2YgYSBmaWJlciB3aGljaCBtYWtlcyBpdFxuICAgIC8vIG11Y2ggbW9yZSBjb21wbGV4IHRvIG1ha2UgdGhpcyBmdW5jdGlvbiBzeW5jaHJvbm91cy5cbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICB2YXIgZG9jID0gc2VsZi5fbmV4dE9iamVjdCgpO1xuICAgICAgaWYgKCFkb2MpIHJldHVybjtcbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgZG9jLCBpbmRleCsrLCBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gWFhYIEFsbG93IG92ZXJsYXBwaW5nIGNhbGxiYWNrIGV4ZWN1dGlvbnMgaWYgY2FsbGJhY2sgeWllbGRzLlxuICBtYXA6IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmVzID0gW107XG4gICAgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGluZGV4KSB7XG4gICAgICByZXMucHVzaChjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaW5kZXgsIHNlbGYuX3NlbGZGb3JJdGVyYXRpb24pKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzO1xuICB9LFxuXG4gIF9yZXdpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBrbm93biB0byBiZSBzeW5jaHJvbm91c1xuICAgIHNlbGYuX2RiQ3Vyc29yLnJld2luZCgpO1xuXG4gICAgc2VsZi5fdmlzaXRlZElkcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9LFxuXG4gIC8vIE1vc3RseSB1c2FibGUgZm9yIHRhaWxhYmxlIGN1cnNvcnMuXG4gIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5fZGJDdXJzb3IuY2xvc2UoKTtcbiAgfSxcblxuICBmZXRjaDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5tYXAoXy5pZGVudGl0eSk7XG4gIH0sXG5cbiAgY291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHNlbGYuX3N5bmNocm9ub3VzQ291bnQoKS53YWl0KCk7XG4gIH0sXG5cbiAgLy8gVGhpcyBtZXRob2QgaXMgTk9UIHdyYXBwZWQgaW4gQ3Vyc29yLlxuICBnZXRSYXdPYmplY3RzOiBmdW5jdGlvbiAob3JkZXJlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgcmV0dXJuIHNlbGYuZmV0Y2goKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHJlc3VsdHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHNlbGYuZm9yRWFjaChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbiAgfVxufSk7XG5cblN5bmNocm9ub3VzQ3Vyc29yLnByb3RvdHlwZVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gR2V0IGJhY2sgdG8gdGhlIGJlZ2lubmluZy5cbiAgc2VsZi5fcmV3aW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuZXh0KCkge1xuICAgICAgY29uc3QgZG9jID0gc2VsZi5fbmV4dE9iamVjdCgpO1xuICAgICAgcmV0dXJuIGRvYyA/IHtcbiAgICAgICAgdmFsdWU6IGRvY1xuICAgICAgfSA6IHtcbiAgICAgICAgZG9uZTogdHJ1ZVxuICAgICAgfTtcbiAgICB9XG4gIH07XG59O1xuXG5TeW5jaHJvbm91c0N1cnNvci5wcm90b3R5cGVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkge1xuICBjb25zdCBzeW5jUmVzdWx0ID0gdGhpc1tTeW1ib2wuaXRlcmF0b3JdKCk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgbmV4dCgpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc3luY1Jlc3VsdC5uZXh0KCkpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gVGFpbHMgdGhlIGN1cnNvciBkZXNjcmliZWQgYnkgY3Vyc29yRGVzY3JpcHRpb24sIG1vc3QgbGlrZWx5IG9uIHRoZVxuLy8gb3Bsb2cuIENhbGxzIGRvY0NhbGxiYWNrIHdpdGggZWFjaCBkb2N1bWVudCBmb3VuZC4gSWdub3JlcyBlcnJvcnMgYW5kIGp1c3Rcbi8vIHJlc3RhcnRzIHRoZSB0YWlsIG9uIGVycm9yLlxuLy9cbi8vIElmIHRpbWVvdXRNUyBpcyBzZXQsIHRoZW4gaWYgd2UgZG9uJ3QgZ2V0IGEgbmV3IGRvY3VtZW50IGV2ZXJ5IHRpbWVvdXRNUyxcbi8vIGtpbGwgYW5kIHJlc3RhcnQgdGhlIGN1cnNvci4gVGhpcyBpcyBwcmltYXJpbHkgYSB3b3JrYXJvdW5kIGZvciAjODU5OC5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUudGFpbCA9IGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgZG9jQ2FsbGJhY2ssIHRpbWVvdXRNUykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50YWlsYWJsZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSB0YWlsIGEgdGFpbGFibGUgY3Vyc29yXCIpO1xuXG4gIHZhciBjdXJzb3IgPSBzZWxmLl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvcihjdXJzb3JEZXNjcmlwdGlvbik7XG5cbiAgdmFyIHN0b3BwZWQgPSBmYWxzZTtcbiAgdmFyIGxhc3RUUztcbiAgdmFyIGxvb3AgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGRvYyA9IG51bGw7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChzdG9wcGVkKVxuICAgICAgICByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICBkb2MgPSBjdXJzb3IuX25leHRPYmplY3RQcm9taXNlV2l0aFRpbWVvdXQodGltZW91dE1TKS5hd2FpdCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFRoZXJlJ3Mgbm8gZ29vZCB3YXkgdG8gZmlndXJlIG91dCBpZiB0aGlzIHdhcyBhY3R1YWxseSBhbiBlcnJvciBmcm9tXG4gICAgICAgIC8vIE1vbmdvLCBvciBqdXN0IGNsaWVudC1zaWRlIChpbmNsdWRpbmcgb3VyIG93biB0aW1lb3V0IGVycm9yKS4gQWhcbiAgICAgICAgLy8gd2VsbC4gQnV0IGVpdGhlciB3YXksIHdlIG5lZWQgdG8gcmV0cnkgdGhlIGN1cnNvciAodW5sZXNzIHRoZSBmYWlsdXJlXG4gICAgICAgIC8vIHdhcyBiZWNhdXNlIHRoZSBvYnNlcnZlIGdvdCBzdG9wcGVkKS5cbiAgICAgICAgZG9jID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIFNpbmNlIHdlIGF3YWl0ZWQgYSBwcm9taXNlIGFib3ZlLCB3ZSBuZWVkIHRvIGNoZWNrIGFnYWluIHRvIHNlZSBpZlxuICAgICAgLy8gd2UndmUgYmVlbiBzdG9wcGVkIGJlZm9yZSBjYWxsaW5nIHRoZSBjYWxsYmFjay5cbiAgICAgIGlmIChzdG9wcGVkKVxuICAgICAgICByZXR1cm47XG4gICAgICBpZiAoZG9jKSB7XG4gICAgICAgIC8vIElmIGEgdGFpbGFibGUgY3Vyc29yIGNvbnRhaW5zIGEgXCJ0c1wiIGZpZWxkLCB1c2UgaXQgdG8gcmVjcmVhdGUgdGhlXG4gICAgICAgIC8vIGN1cnNvciBvbiBlcnJvci4gKFwidHNcIiBpcyBhIHN0YW5kYXJkIHRoYXQgTW9uZ28gdXNlcyBpbnRlcm5hbGx5IGZvclxuICAgICAgICAvLyB0aGUgb3Bsb2csIGFuZCB0aGVyZSdzIGEgc3BlY2lhbCBmbGFnIHRoYXQgbGV0cyB5b3UgZG8gYmluYXJ5IHNlYXJjaFxuICAgICAgICAvLyBvbiBpdCBpbnN0ZWFkIG9mIG5lZWRpbmcgdG8gdXNlIGFuIGluZGV4LilcbiAgICAgICAgbGFzdFRTID0gZG9jLnRzO1xuICAgICAgICBkb2NDYWxsYmFjayhkb2MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5ld1NlbGVjdG9yID0gXy5jbG9uZShjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3Rvcik7XG4gICAgICAgIGlmIChsYXN0VFMpIHtcbiAgICAgICAgICBuZXdTZWxlY3Rvci50cyA9IHskZ3Q6IGxhc3RUU307XG4gICAgICAgIH1cbiAgICAgICAgY3Vyc29yID0gc2VsZi5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IobmV3IEN1cnNvckRlc2NyaXB0aW9uKFxuICAgICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgIG5ld1NlbGVjdG9yLFxuICAgICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMpKTtcbiAgICAgICAgLy8gTW9uZ28gZmFpbG92ZXIgdGFrZXMgbWFueSBzZWNvbmRzLiAgUmV0cnkgaW4gYSBiaXQuICAoV2l0aG91dCB0aGlzXG4gICAgICAgIC8vIHNldFRpbWVvdXQsIHdlIHBlZyB0aGUgQ1BVIGF0IDEwMCUgYW5kIG5ldmVyIG5vdGljZSB0aGUgYWN0dWFsXG4gICAgICAgIC8vIGZhaWxvdmVyLlxuICAgICAgICBNZXRlb3Iuc2V0VGltZW91dChsb29wLCAxMDApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgTWV0ZW9yLmRlZmVyKGxvb3ApO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgc3RvcHBlZCA9IHRydWU7XG4gICAgICBjdXJzb3IuY2xvc2UoKTtcbiAgICB9XG4gIH07XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9vYnNlcnZlQ2hhbmdlcyA9IGZ1bmN0aW9uIChcbiAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUpIHtcbiAgICByZXR1cm4gc2VsZi5fb2JzZXJ2ZUNoYW5nZXNUYWlsYWJsZShjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzKTtcbiAgfVxuXG4gIC8vIFlvdSBtYXkgbm90IGZpbHRlciBvdXQgX2lkIHdoZW4gb2JzZXJ2aW5nIGNoYW5nZXMsIGJlY2F1c2UgdGhlIGlkIGlzIGEgY29yZVxuICAvLyBwYXJ0IG9mIHRoZSBvYnNlcnZlQ2hhbmdlcyBBUEkuXG4gIGNvbnN0IGZpZWxkc09wdGlvbnMgPSBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnByb2plY3Rpb24gfHwgY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5maWVsZHM7XG4gIGlmIChmaWVsZHNPcHRpb25zICYmXG4gICAgICAoZmllbGRzT3B0aW9ucy5faWQgPT09IDAgfHxcbiAgICAgICBmaWVsZHNPcHRpb25zLl9pZCA9PT0gZmFsc2UpKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJZb3UgbWF5IG5vdCBvYnNlcnZlIGEgY3Vyc29yIHdpdGgge2ZpZWxkczoge19pZDogMH19XCIpO1xuICB9XG5cbiAgdmFyIG9ic2VydmVLZXkgPSBFSlNPTi5zdHJpbmdpZnkoXG4gICAgXy5leHRlbmQoe29yZGVyZWQ6IG9yZGVyZWR9LCBjdXJzb3JEZXNjcmlwdGlvbikpO1xuXG4gIHZhciBtdWx0aXBsZXhlciwgb2JzZXJ2ZURyaXZlcjtcbiAgdmFyIGZpcnN0SGFuZGxlID0gZmFsc2U7XG5cbiAgLy8gRmluZCBhIG1hdGNoaW5nIE9ic2VydmVNdWx0aXBsZXhlciwgb3IgY3JlYXRlIGEgbmV3IG9uZS4gVGhpcyBuZXh0IGJsb2NrIGlzXG4gIC8vIGd1YXJhbnRlZWQgdG8gbm90IHlpZWxkIChhbmQgaXQgZG9lc24ndCBjYWxsIGFueXRoaW5nIHRoYXQgY2FuIG9ic2VydmUgYVxuICAvLyBuZXcgcXVlcnkpLCBzbyBubyBvdGhlciBjYWxscyB0byB0aGlzIGZ1bmN0aW9uIGNhbiBpbnRlcmxlYXZlIHdpdGggaXQuXG4gIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoXy5oYXMoc2VsZi5fb2JzZXJ2ZU11bHRpcGxleGVycywgb2JzZXJ2ZUtleSkpIHtcbiAgICAgIG11bHRpcGxleGVyID0gc2VsZi5fb2JzZXJ2ZU11bHRpcGxleGVyc1tvYnNlcnZlS2V5XTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmlyc3RIYW5kbGUgPSB0cnVlO1xuICAgICAgLy8gQ3JlYXRlIGEgbmV3IE9ic2VydmVNdWx0aXBsZXhlci5cbiAgICAgIG11bHRpcGxleGVyID0gbmV3IE9ic2VydmVNdWx0aXBsZXhlcih7XG4gICAgICAgIG9yZGVyZWQ6IG9yZGVyZWQsXG4gICAgICAgIG9uU3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzW29ic2VydmVLZXldO1xuICAgICAgICAgIG9ic2VydmVEcml2ZXIuc3RvcCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnNbb2JzZXJ2ZUtleV0gPSBtdWx0aXBsZXhlcjtcbiAgICB9XG4gIH0pO1xuXG4gIHZhciBvYnNlcnZlSGFuZGxlID0gbmV3IE9ic2VydmVIYW5kbGUobXVsdGlwbGV4ZXIsXG4gICAgY2FsbGJhY2tzLFxuICAgIG5vbk11dGF0aW5nQ2FsbGJhY2tzLFxuICApO1xuXG4gIGlmIChmaXJzdEhhbmRsZSkge1xuICAgIHZhciBtYXRjaGVyLCBzb3J0ZXI7XG4gICAgdmFyIGNhblVzZU9wbG9nID0gXy5hbGwoW1xuICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBBdCBhIGJhcmUgbWluaW11bSwgdXNpbmcgdGhlIG9wbG9nIHJlcXVpcmVzIHVzIHRvIGhhdmUgYW4gb3Bsb2csIHRvXG4gICAgICAgIC8vIHdhbnQgdW5vcmRlcmVkIGNhbGxiYWNrcywgYW5kIHRvIG5vdCB3YW50IGEgY2FsbGJhY2sgb24gdGhlIHBvbGxzXG4gICAgICAgIC8vIHRoYXQgd29uJ3QgaGFwcGVuLlxuICAgICAgICByZXR1cm4gc2VsZi5fb3Bsb2dIYW5kbGUgJiYgIW9yZGVyZWQgJiZcbiAgICAgICAgICAhY2FsbGJhY2tzLl90ZXN0T25seVBvbGxDYWxsYmFjaztcbiAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gV2UgbmVlZCB0byBiZSBhYmxlIHRvIGNvbXBpbGUgdGhlIHNlbGVjdG9yLiBGYWxsIGJhY2sgdG8gcG9sbGluZyBmb3JcbiAgICAgICAgLy8gc29tZSBuZXdmYW5nbGVkICRzZWxlY3RvciB0aGF0IG1pbmltb25nbyBkb2Vzbid0IHN1cHBvcnQgeWV0LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gWFhYIG1ha2UgYWxsIGNvbXBpbGF0aW9uIGVycm9ycyBNaW5pbW9uZ29FcnJvciBvciBzb21ldGhpbmdcbiAgICAgICAgICAvLyAgICAgc28gdGhhdCB0aGlzIGRvZXNuJ3QgaWdub3JlIHVucmVsYXRlZCBleGNlcHRpb25zXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIC4uLiBhbmQgdGhlIHNlbGVjdG9yIGl0c2VsZiBuZWVkcyB0byBzdXBwb3J0IG9wbG9nLlxuICAgICAgICByZXR1cm4gT3Bsb2dPYnNlcnZlRHJpdmVyLmN1cnNvclN1cHBvcnRlZChjdXJzb3JEZXNjcmlwdGlvbiwgbWF0Y2hlcik7XG4gICAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIEFuZCB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gY29tcGlsZSB0aGUgc29ydCwgaWYgYW55LiAgZWcsIGNhbid0IGJlXG4gICAgICAgIC8vIHskbmF0dXJhbDogMX0uXG4gICAgICAgIGlmICghY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5zb3J0KVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHNvcnRlciA9IG5ldyBNaW5pbW9uZ28uU29ydGVyKGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuc29ydCk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBYWFggbWFrZSBhbGwgY29tcGlsYXRpb24gZXJyb3JzIE1pbmltb25nb0Vycm9yIG9yIHNvbWV0aGluZ1xuICAgICAgICAgIC8vICAgICBzbyB0aGF0IHRoaXMgZG9lc24ndCBpZ25vcmUgdW5yZWxhdGVkIGV4Y2VwdGlvbnNcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1dLCBmdW5jdGlvbiAoZikgeyByZXR1cm4gZigpOyB9KTsgIC8vIGludm9rZSBlYWNoIGZ1bmN0aW9uXG5cbiAgICB2YXIgZHJpdmVyQ2xhc3MgPSBjYW5Vc2VPcGxvZyA/IE9wbG9nT2JzZXJ2ZURyaXZlciA6IFBvbGxpbmdPYnNlcnZlRHJpdmVyO1xuICAgIG9ic2VydmVEcml2ZXIgPSBuZXcgZHJpdmVyQ2xhc3Moe1xuICAgICAgY3Vyc29yRGVzY3JpcHRpb246IGN1cnNvckRlc2NyaXB0aW9uLFxuICAgICAgbW9uZ29IYW5kbGU6IHNlbGYsXG4gICAgICBtdWx0aXBsZXhlcjogbXVsdGlwbGV4ZXIsXG4gICAgICBvcmRlcmVkOiBvcmRlcmVkLFxuICAgICAgbWF0Y2hlcjogbWF0Y2hlciwgIC8vIGlnbm9yZWQgYnkgcG9sbGluZ1xuICAgICAgc29ydGVyOiBzb3J0ZXIsICAvLyBpZ25vcmVkIGJ5IHBvbGxpbmdcbiAgICAgIF90ZXN0T25seVBvbGxDYWxsYmFjazogY2FsbGJhY2tzLl90ZXN0T25seVBvbGxDYWxsYmFja1xuICAgIH0pO1xuXG4gICAgLy8gVGhpcyBmaWVsZCBpcyBvbmx5IHNldCBmb3IgdXNlIGluIHRlc3RzLlxuICAgIG11bHRpcGxleGVyLl9vYnNlcnZlRHJpdmVyID0gb2JzZXJ2ZURyaXZlcjtcbiAgfVxuXG4gIC8vIEJsb2NrcyB1bnRpbCB0aGUgaW5pdGlhbCBhZGRzIGhhdmUgYmVlbiBzZW50LlxuICBtdWx0aXBsZXhlci5hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMob2JzZXJ2ZUhhbmRsZSk7XG5cbiAgcmV0dXJuIG9ic2VydmVIYW5kbGU7XG59O1xuXG4vLyBMaXN0ZW4gZm9yIHRoZSBpbnZhbGlkYXRpb24gbWVzc2FnZXMgdGhhdCB3aWxsIHRyaWdnZXIgdXMgdG8gcG9sbCB0aGVcbi8vIGRhdGFiYXNlIGZvciBjaGFuZ2VzLiBJZiB0aGlzIHNlbGVjdG9yIHNwZWNpZmllcyBzcGVjaWZpYyBJRHMsIHNwZWNpZnkgdGhlbVxuLy8gaGVyZSwgc28gdGhhdCB1cGRhdGVzIHRvIGRpZmZlcmVudCBzcGVjaWZpYyBJRHMgZG9uJ3QgY2F1c2UgdXMgdG8gcG9sbC5cbi8vIGxpc3RlbkNhbGxiYWNrIGlzIHRoZSBzYW1lIGtpbmQgb2YgKG5vdGlmaWNhdGlvbiwgY29tcGxldGUpIGNhbGxiYWNrIHBhc3NlZFxuLy8gdG8gSW52YWxpZGF0aW9uQ3Jvc3NiYXIubGlzdGVuLlxuXG5saXN0ZW5BbGwgPSBmdW5jdGlvbiAoY3Vyc29yRGVzY3JpcHRpb24sIGxpc3RlbkNhbGxiYWNrKSB7XG4gIHZhciBsaXN0ZW5lcnMgPSBbXTtcbiAgZm9yRWFjaFRyaWdnZXIoY3Vyc29yRGVzY3JpcHRpb24sIGZ1bmN0aW9uICh0cmlnZ2VyKSB7XG4gICAgbGlzdGVuZXJzLnB1c2goRERQU2VydmVyLl9JbnZhbGlkYXRpb25Dcm9zc2Jhci5saXN0ZW4oXG4gICAgICB0cmlnZ2VyLCBsaXN0ZW5DYWxsYmFjaykpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgIF8uZWFjaChsaXN0ZW5lcnMsIGZ1bmN0aW9uIChsaXN0ZW5lcikge1xuICAgICAgICBsaXN0ZW5lci5zdG9wKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59O1xuXG5mb3JFYWNoVHJpZ2dlciA9IGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgdHJpZ2dlckNhbGxiYWNrKSB7XG4gIHZhciBrZXkgPSB7Y29sbGVjdGlvbjogY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWV9O1xuICB2YXIgc3BlY2lmaWNJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKFxuICAgIGN1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yKTtcbiAgaWYgKHNwZWNpZmljSWRzKSB7XG4gICAgXy5lYWNoKHNwZWNpZmljSWRzLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgIHRyaWdnZXJDYWxsYmFjayhfLmV4dGVuZCh7aWQ6IGlkfSwga2V5KSk7XG4gICAgfSk7XG4gICAgdHJpZ2dlckNhbGxiYWNrKF8uZXh0ZW5kKHtkcm9wQ29sbGVjdGlvbjogdHJ1ZSwgaWQ6IG51bGx9LCBrZXkpKTtcbiAgfSBlbHNlIHtcbiAgICB0cmlnZ2VyQ2FsbGJhY2soa2V5KTtcbiAgfVxuICAvLyBFdmVyeW9uZSBjYXJlcyBhYm91dCB0aGUgZGF0YWJhc2UgYmVpbmcgZHJvcHBlZC5cbiAgdHJpZ2dlckNhbGxiYWNrKHsgZHJvcERhdGFiYXNlOiB0cnVlIH0pO1xufTtcblxuLy8gb2JzZXJ2ZUNoYW5nZXMgZm9yIHRhaWxhYmxlIGN1cnNvcnMgb24gY2FwcGVkIGNvbGxlY3Rpb25zLlxuLy9cbi8vIFNvbWUgZGlmZmVyZW5jZXMgZnJvbSBub3JtYWwgY3Vyc29yczpcbi8vICAgLSBXaWxsIG5ldmVyIHByb2R1Y2UgYW55dGhpbmcgb3RoZXIgdGhhbiAnYWRkZWQnIG9yICdhZGRlZEJlZm9yZScuIElmIHlvdVxuLy8gICAgIGRvIHVwZGF0ZSBhIGRvY3VtZW50IHRoYXQgaGFzIGFscmVhZHkgYmVlbiBwcm9kdWNlZCwgdGhpcyB3aWxsIG5vdCBub3RpY2Vcbi8vICAgICBpdC5cbi8vICAgLSBJZiB5b3UgZGlzY29ubmVjdCBhbmQgcmVjb25uZWN0IGZyb20gTW9uZ28sIGl0IHdpbGwgZXNzZW50aWFsbHkgcmVzdGFydFxuLy8gICAgIHRoZSBxdWVyeSwgd2hpY2ggd2lsbCBsZWFkIHRvIGR1cGxpY2F0ZSByZXN1bHRzLiBUaGlzIGlzIHByZXR0eSBiYWQsXG4vLyAgICAgYnV0IGlmIHlvdSBpbmNsdWRlIGEgZmllbGQgY2FsbGVkICd0cycgd2hpY2ggaXMgaW5zZXJ0ZWQgYXNcbi8vICAgICBuZXcgTW9uZ29JbnRlcm5hbHMuTW9uZ29UaW1lc3RhbXAoMCwgMCkgKHdoaWNoIGlzIGluaXRpYWxpemVkIHRvIHRoZVxuLy8gICAgIGN1cnJlbnQgTW9uZ28tc3R5bGUgdGltZXN0YW1wKSwgd2UnbGwgYmUgYWJsZSB0byBmaW5kIHRoZSBwbGFjZSB0b1xuLy8gICAgIHJlc3RhcnQgcHJvcGVybHkuIChUaGlzIGZpZWxkIGlzIHNwZWNpZmljYWxseSB1bmRlcnN0b29kIGJ5IE1vbmdvIHdpdGggYW5cbi8vICAgICBvcHRpbWl6YXRpb24gd2hpY2ggYWxsb3dzIGl0IHRvIGZpbmQgdGhlIHJpZ2h0IHBsYWNlIHRvIHN0YXJ0IHdpdGhvdXRcbi8vICAgICBhbiBpbmRleCBvbiB0cy4gSXQncyBob3cgdGhlIG9wbG9nIHdvcmtzLilcbi8vICAgLSBObyBjYWxsYmFja3MgYXJlIHRyaWdnZXJlZCBzeW5jaHJvbm91c2x5IHdpdGggdGhlIGNhbGwgKHRoZXJlJ3Mgbm9cbi8vICAgICBkaWZmZXJlbnRpYXRpb24gYmV0d2VlbiBcImluaXRpYWwgZGF0YVwiIGFuZCBcImxhdGVyIGNoYW5nZXNcIjsgZXZlcnl0aGluZ1xuLy8gICAgIHRoYXQgbWF0Y2hlcyB0aGUgcXVlcnkgZ2V0cyBzZW50IGFzeW5jaHJvbm91c2x5KS5cbi8vICAgLSBEZS1kdXBsaWNhdGlvbiBpcyBub3QgaW1wbGVtZW50ZWQuXG4vLyAgIC0gRG9lcyBub3QgeWV0IGludGVyYWN0IHdpdGggdGhlIHdyaXRlIGZlbmNlLiBQcm9iYWJseSwgdGhpcyBzaG91bGQgd29yayBieVxuLy8gICAgIGlnbm9yaW5nIHJlbW92ZXMgKHdoaWNoIGRvbid0IHdvcmsgb24gY2FwcGVkIGNvbGxlY3Rpb25zKSBhbmQgdXBkYXRlc1xuLy8gICAgICh3aGljaCBkb24ndCBhZmZlY3QgdGFpbGFibGUgY3Vyc29ycyksIGFuZCBqdXN0IGtlZXBpbmcgdHJhY2sgb2YgdGhlIElEXG4vLyAgICAgb2YgdGhlIGluc2VydGVkIG9iamVjdCwgYW5kIGNsb3NpbmcgdGhlIHdyaXRlIGZlbmNlIG9uY2UgeW91IGdldCB0byB0aGF0XG4vLyAgICAgSUQgKG9yIHRpbWVzdGFtcD8pLiAgVGhpcyBkb2Vzbid0IHdvcmsgd2VsbCBpZiB0aGUgZG9jdW1lbnQgZG9lc24ndCBtYXRjaFxuLy8gICAgIHRoZSBxdWVyeSwgdGhvdWdoLiAgT24gdGhlIG90aGVyIGhhbmQsIHRoZSB3cml0ZSBmZW5jZSBjYW4gY2xvc2Vcbi8vICAgICBpbW1lZGlhdGVseSBpZiBpdCBkb2VzIG5vdCBtYXRjaCB0aGUgcXVlcnkuIFNvIGlmIHdlIHRydXN0IG1pbmltb25nb1xuLy8gICAgIGVub3VnaCB0byBhY2N1cmF0ZWx5IGV2YWx1YXRlIHRoZSBxdWVyeSBhZ2FpbnN0IHRoZSB3cml0ZSBmZW5jZSwgd2Vcbi8vICAgICBzaG91bGQgYmUgYWJsZSB0byBkbyB0aGlzLi4uICBPZiBjb3Vyc2UsIG1pbmltb25nbyBkb2Vzbid0IGV2ZW4gc3VwcG9ydFxuLy8gICAgIE1vbmdvIFRpbWVzdGFtcHMgeWV0LlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fb2JzZXJ2ZUNoYW5nZXNUYWlsYWJsZSA9IGZ1bmN0aW9uIChcbiAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUYWlsYWJsZSBjdXJzb3JzIG9ubHkgZXZlciBjYWxsIGFkZGVkL2FkZGVkQmVmb3JlIGNhbGxiYWNrcywgc28gaXQncyBhblxuICAvLyBlcnJvciBpZiB5b3UgZGlkbid0IHByb3ZpZGUgdGhlbS5cbiAgaWYgKChvcmRlcmVkICYmICFjYWxsYmFja3MuYWRkZWRCZWZvcmUpIHx8XG4gICAgICAoIW9yZGVyZWQgJiYgIWNhbGxiYWNrcy5hZGRlZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBvYnNlcnZlIGFuIFwiICsgKG9yZGVyZWQgPyBcIm9yZGVyZWRcIiA6IFwidW5vcmRlcmVkXCIpXG4gICAgICAgICAgICAgICAgICAgICsgXCIgdGFpbGFibGUgY3Vyc29yIHdpdGhvdXQgYSBcIlxuICAgICAgICAgICAgICAgICAgICArIChvcmRlcmVkID8gXCJhZGRlZEJlZm9yZVwiIDogXCJhZGRlZFwiKSArIFwiIGNhbGxiYWNrXCIpO1xuICB9XG5cbiAgcmV0dXJuIHNlbGYudGFpbChjdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKGRvYykge1xuICAgIHZhciBpZCA9IGRvYy5faWQ7XG4gICAgZGVsZXRlIGRvYy5faWQ7XG4gICAgLy8gVGhlIHRzIGlzIGFuIGltcGxlbWVudGF0aW9uIGRldGFpbC4gSGlkZSBpdC5cbiAgICBkZWxldGUgZG9jLnRzO1xuICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICBjYWxsYmFja3MuYWRkZWRCZWZvcmUoaWQsIGRvYywgbnVsbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrcy5hZGRlZChpZCwgZG9jKTtcbiAgICB9XG4gIH0pO1xufTtcblxuLy8gWFhYIFdlIHByb2JhYmx5IG5lZWQgdG8gZmluZCBhIGJldHRlciB3YXkgdG8gZXhwb3NlIHRoaXMuIFJpZ2h0IG5vd1xuLy8gaXQncyBvbmx5IHVzZWQgYnkgdGVzdHMsIGJ1dCBpbiBmYWN0IHlvdSBuZWVkIGl0IGluIG5vcm1hbFxuLy8gb3BlcmF0aW9uIHRvIGludGVyYWN0IHdpdGggY2FwcGVkIGNvbGxlY3Rpb25zLlxuTW9uZ29JbnRlcm5hbHMuTW9uZ29UaW1lc3RhbXAgPSBNb25nb0RCLlRpbWVzdGFtcDtcblxuTW9uZ29JbnRlcm5hbHMuQ29ubmVjdGlvbiA9IE1vbmdvQ29ubmVjdGlvbjtcbiIsInZhciBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xuXG5pbXBvcnQgeyBOcG1Nb2R1bGVNb25nb2RiIH0gZnJvbSBcIm1ldGVvci9ucG0tbW9uZ29cIjtcbmNvbnN0IHsgTG9uZyB9ID0gTnBtTW9kdWxlTW9uZ29kYjtcblxuT1BMT0dfQ09MTEVDVElPTiA9ICdvcGxvZy5ycyc7XG5cbnZhciBUT09fRkFSX0JFSElORCA9IHByb2Nlc3MuZW52Lk1FVEVPUl9PUExPR19UT09fRkFSX0JFSElORCB8fCAyMDAwO1xudmFyIFRBSUxfVElNRU9VVCA9ICtwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVEFJTF9USU1FT1VUIHx8IDMwMDAwO1xuXG52YXIgc2hvd1RTID0gZnVuY3Rpb24gKHRzKSB7XG4gIHJldHVybiBcIlRpbWVzdGFtcChcIiArIHRzLmdldEhpZ2hCaXRzKCkgKyBcIiwgXCIgKyB0cy5nZXRMb3dCaXRzKCkgKyBcIilcIjtcbn07XG5cbmlkRm9yT3AgPSBmdW5jdGlvbiAob3ApIHtcbiAgaWYgKG9wLm9wID09PSAnZCcpXG4gICAgcmV0dXJuIG9wLm8uX2lkO1xuICBlbHNlIGlmIChvcC5vcCA9PT0gJ2knKVxuICAgIHJldHVybiBvcC5vLl9pZDtcbiAgZWxzZSBpZiAob3Aub3AgPT09ICd1JylcbiAgICByZXR1cm4gb3AubzIuX2lkO1xuICBlbHNlIGlmIChvcC5vcCA9PT0gJ2MnKVxuICAgIHRocm93IEVycm9yKFwiT3BlcmF0b3IgJ2MnIGRvZXNuJ3Qgc3VwcGx5IGFuIG9iamVjdCB3aXRoIGlkOiBcIiArXG4gICAgICAgICAgICAgICAgRUpTT04uc3RyaW5naWZ5KG9wKSk7XG4gIGVsc2VcbiAgICB0aHJvdyBFcnJvcihcIlVua25vd24gb3A6IFwiICsgRUpTT04uc3RyaW5naWZ5KG9wKSk7XG59O1xuXG5PcGxvZ0hhbmRsZSA9IGZ1bmN0aW9uIChvcGxvZ1VybCwgZGJOYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fb3Bsb2dVcmwgPSBvcGxvZ1VybDtcbiAgc2VsZi5fZGJOYW1lID0gZGJOYW1lO1xuXG4gIHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiA9IG51bGw7XG4gIHNlbGYuX29wbG9nVGFpbENvbm5lY3Rpb24gPSBudWxsO1xuICBzZWxmLl9zdG9wcGVkID0gZmFsc2U7XG4gIHNlbGYuX3RhaWxIYW5kbGUgPSBudWxsO1xuICBzZWxmLl9yZWFkeUZ1dHVyZSA9IG5ldyBGdXR1cmUoKTtcbiAgc2VsZi5fY3Jvc3NiYXIgPSBuZXcgRERQU2VydmVyLl9Dcm9zc2Jhcih7XG4gICAgZmFjdFBhY2thZ2U6IFwibW9uZ28tbGl2ZWRhdGFcIiwgZmFjdE5hbWU6IFwib3Bsb2ctd2F0Y2hlcnNcIlxuICB9KTtcbiAgc2VsZi5fYmFzZU9wbG9nU2VsZWN0b3IgPSB7XG4gICAgbnM6IG5ldyBSZWdFeHAoXCJeKD86XCIgKyBbXG4gICAgICBNZXRlb3IuX2VzY2FwZVJlZ0V4cChzZWxmLl9kYk5hbWUgKyBcIi5cIiksXG4gICAgICBNZXRlb3IuX2VzY2FwZVJlZ0V4cChcImFkbWluLiRjbWRcIiksXG4gICAgXS5qb2luKFwifFwiKSArIFwiKVwiKSxcblxuICAgICRvcjogW1xuICAgICAgeyBvcDogeyAkaW46IFsnaScsICd1JywgJ2QnXSB9IH0sXG4gICAgICAvLyBkcm9wIGNvbGxlY3Rpb25cbiAgICAgIHsgb3A6ICdjJywgJ28uZHJvcCc6IHsgJGV4aXN0czogdHJ1ZSB9IH0sXG4gICAgICB7IG9wOiAnYycsICdvLmRyb3BEYXRhYmFzZSc6IDEgfSxcbiAgICAgIHsgb3A6ICdjJywgJ28uYXBwbHlPcHMnOiB7ICRleGlzdHM6IHRydWUgfSB9LFxuICAgIF1cbiAgfTtcblxuICAvLyBEYXRhIHN0cnVjdHVyZXMgdG8gc3VwcG9ydCB3YWl0VW50aWxDYXVnaHRVcCgpLiBFYWNoIG9wbG9nIGVudHJ5IGhhcyBhXG4gIC8vIE1vbmdvVGltZXN0YW1wIG9iamVjdCBvbiBpdCAod2hpY2ggaXMgbm90IHRoZSBzYW1lIGFzIGEgRGF0ZSAtLS0gaXQncyBhXG4gIC8vIGNvbWJpbmF0aW9uIG9mIHRpbWUgYW5kIGFuIGluY3JlbWVudGluZyBjb3VudGVyOyBzZWVcbiAgLy8gaHR0cDovL2RvY3MubW9uZ29kYi5vcmcvbWFudWFsL3JlZmVyZW5jZS9ic29uLXR5cGVzLyN0aW1lc3RhbXBzKS5cbiAgLy9cbiAgLy8gX2NhdGNoaW5nVXBGdXR1cmVzIGlzIGFuIGFycmF5IG9mIHt0czogTW9uZ29UaW1lc3RhbXAsIGZ1dHVyZTogRnV0dXJlfVxuICAvLyBvYmplY3RzLCBzb3J0ZWQgYnkgYXNjZW5kaW5nIHRpbWVzdGFtcC4gX2xhc3RQcm9jZXNzZWRUUyBpcyB0aGVcbiAgLy8gTW9uZ29UaW1lc3RhbXAgb2YgdGhlIGxhc3Qgb3Bsb2cgZW50cnkgd2UndmUgcHJvY2Vzc2VkLlxuICAvL1xuICAvLyBFYWNoIHRpbWUgd2UgY2FsbCB3YWl0VW50aWxDYXVnaHRVcCwgd2UgdGFrZSBhIHBlZWsgYXQgdGhlIGZpbmFsIG9wbG9nXG4gIC8vIGVudHJ5IGluIHRoZSBkYi4gIElmIHdlJ3ZlIGFscmVhZHkgcHJvY2Vzc2VkIGl0IChpZSwgaXQgaXMgbm90IGdyZWF0ZXIgdGhhblxuICAvLyBfbGFzdFByb2Nlc3NlZFRTKSwgd2FpdFVudGlsQ2F1Z2h0VXAgaW1tZWRpYXRlbHkgcmV0dXJucy4gT3RoZXJ3aXNlLFxuICAvLyB3YWl0VW50aWxDYXVnaHRVcCBtYWtlcyBhIG5ldyBGdXR1cmUgYW5kIGluc2VydHMgaXQgYWxvbmcgd2l0aCB0aGUgZmluYWxcbiAgLy8gdGltZXN0YW1wIGVudHJ5IHRoYXQgaXQgcmVhZCwgaW50byBfY2F0Y2hpbmdVcEZ1dHVyZXMuIHdhaXRVbnRpbENhdWdodFVwXG4gIC8vIHRoZW4gd2FpdHMgb24gdGhhdCBmdXR1cmUsIHdoaWNoIGlzIHJlc29sdmVkIG9uY2UgX2xhc3RQcm9jZXNzZWRUUyBpc1xuICAvLyBpbmNyZW1lbnRlZCB0byBiZSBwYXN0IGl0cyB0aW1lc3RhbXAgYnkgdGhlIHdvcmtlciBmaWJlci5cbiAgLy9cbiAgLy8gWFhYIHVzZSBhIHByaW9yaXR5IHF1ZXVlIG9yIHNvbWV0aGluZyBlbHNlIHRoYXQncyBmYXN0ZXIgdGhhbiBhbiBhcnJheVxuICBzZWxmLl9jYXRjaGluZ1VwRnV0dXJlcyA9IFtdO1xuICBzZWxmLl9sYXN0UHJvY2Vzc2VkVFMgPSBudWxsO1xuXG4gIHNlbGYuX29uU2tpcHBlZEVudHJpZXNIb29rID0gbmV3IEhvb2soe1xuICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiBcIm9uU2tpcHBlZEVudHJpZXMgY2FsbGJhY2tcIlxuICB9KTtcblxuICBzZWxmLl9lbnRyeVF1ZXVlID0gbmV3IE1ldGVvci5fRG91YmxlRW5kZWRRdWV1ZSgpO1xuICBzZWxmLl93b3JrZXJBY3RpdmUgPSBmYWxzZTtcblxuICBzZWxmLl9zdGFydFRhaWxpbmcoKTtcbn07XG5cbk9iamVjdC5hc3NpZ24oT3Bsb2dIYW5kbGUucHJvdG90eXBlLCB7XG4gIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG4gICAgaWYgKHNlbGYuX3RhaWxIYW5kbGUpXG4gICAgICBzZWxmLl90YWlsSGFuZGxlLnN0b3AoKTtcbiAgICAvLyBYWFggc2hvdWxkIGNsb3NlIGNvbm5lY3Rpb25zIHRvb1xuICB9LFxuICBvbk9wbG9nRW50cnk6IGZ1bmN0aW9uICh0cmlnZ2VyLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxlZCBvbk9wbG9nRW50cnkgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuXG4gICAgLy8gQ2FsbGluZyBvbk9wbG9nRW50cnkgcmVxdWlyZXMgdXMgdG8gd2FpdCBmb3IgdGhlIHRhaWxpbmcgdG8gYmUgcmVhZHkuXG4gICAgc2VsZi5fcmVhZHlGdXR1cmUud2FpdCgpO1xuXG4gICAgdmFyIG9yaWdpbmFsQ2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICBjYWxsYmFjayA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICAgICAgb3JpZ2luYWxDYWxsYmFjayhub3RpZmljYXRpb24pO1xuICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJFcnJvciBpbiBvcGxvZyBjYWxsYmFja1wiLCBlcnIpO1xuICAgIH0pO1xuICAgIHZhciBsaXN0ZW5IYW5kbGUgPSBzZWxmLl9jcm9zc2Jhci5saXN0ZW4odHJpZ2dlciwgY2FsbGJhY2spO1xuICAgIHJldHVybiB7XG4gICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxpc3RlbkhhbmRsZS5zdG9wKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfSxcbiAgLy8gUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBpbnZva2VkIGFueSB0aW1lIHdlIHNraXAgb3Bsb2cgZW50cmllcyAoZWcsXG4gIC8vIGJlY2F1c2Ugd2UgYXJlIHRvbyBmYXIgYmVoaW5kKS5cbiAgb25Ta2lwcGVkRW50cmllczogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIG9uU2tpcHBlZEVudHJpZXMgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuICAgIHJldHVybiBzZWxmLl9vblNraXBwZWRFbnRyaWVzSG9vay5yZWdpc3RlcihjYWxsYmFjayk7XG4gIH0sXG4gIC8vIENhbGxzIGBjYWxsYmFja2Agb25jZSB0aGUgb3Bsb2cgaGFzIGJlZW4gcHJvY2Vzc2VkIHVwIHRvIGEgcG9pbnQgdGhhdCBpc1xuICAvLyByb3VnaGx5IFwibm93XCI6IHNwZWNpZmljYWxseSwgb25jZSB3ZSd2ZSBwcm9jZXNzZWQgYWxsIG9wcyB0aGF0IGFyZVxuICAvLyBjdXJyZW50bHkgdmlzaWJsZS5cbiAgLy8gWFhYIGJlY29tZSBjb252aW5jZWQgdGhhdCB0aGlzIGlzIGFjdHVhbGx5IHNhZmUgZXZlbiBpZiBvcGxvZ0Nvbm5lY3Rpb25cbiAgLy8gaXMgc29tZSBraW5kIG9mIHBvb2xcbiAgd2FpdFVudGlsQ2F1Z2h0VXA6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgd2FpdFVudGlsQ2F1Z2h0VXAgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuXG4gICAgLy8gQ2FsbGluZyB3YWl0VW50aWxDYXVnaHRVcCByZXF1cmllcyB1cyB0byB3YWl0IGZvciB0aGUgb3Bsb2cgY29ubmVjdGlvbiB0b1xuICAgIC8vIGJlIHJlYWR5LlxuICAgIHNlbGYuX3JlYWR5RnV0dXJlLndhaXQoKTtcbiAgICB2YXIgbGFzdEVudHJ5O1xuXG4gICAgd2hpbGUgKCFzZWxmLl9zdG9wcGVkKSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIG1ha2UgdGhlIHNlbGVjdG9yIGF0IGxlYXN0IGFzIHJlc3RyaWN0aXZlIGFzIHRoZSBhY3R1YWxcbiAgICAgIC8vIHRhaWxpbmcgc2VsZWN0b3IgKGllLCB3ZSBuZWVkIHRvIHNwZWNpZnkgdGhlIERCIG5hbWUpIG9yIGVsc2Ugd2UgbWlnaHRcbiAgICAgIC8vIGZpbmQgYSBUUyB0aGF0IHdvbid0IHNob3cgdXAgaW4gdGhlIGFjdHVhbCB0YWlsIHN0cmVhbS5cbiAgICAgIHRyeSB7XG4gICAgICAgIGxhc3RFbnRyeSA9IHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbi5maW5kT25lKFxuICAgICAgICAgIE9QTE9HX0NPTExFQ1RJT04sIHNlbGYuX2Jhc2VPcGxvZ1NlbGVjdG9yLFxuICAgICAgICAgIHtmaWVsZHM6IHt0czogMX0sIHNvcnQ6IHskbmF0dXJhbDogLTF9fSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBEdXJpbmcgZmFpbG92ZXIgKGVnKSBpZiB3ZSBnZXQgYW4gZXhjZXB0aW9uIHdlIHNob3VsZCBsb2cgYW5kIHJldHJ5XG4gICAgICAgIC8vIGluc3RlYWQgb2YgY3Jhc2hpbmcuXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJHb3QgZXhjZXB0aW9uIHdoaWxlIHJlYWRpbmcgbGFzdCBlbnRyeVwiLCBlKTtcbiAgICAgICAgTWV0ZW9yLl9zbGVlcEZvck1zKDEwMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoIWxhc3RFbnRyeSkge1xuICAgICAgLy8gUmVhbGx5LCBub3RoaW5nIGluIHRoZSBvcGxvZz8gV2VsbCwgd2UndmUgcHJvY2Vzc2VkIGV2ZXJ5dGhpbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHRzID0gbGFzdEVudHJ5LnRzO1xuICAgIGlmICghdHMpXG4gICAgICB0aHJvdyBFcnJvcihcIm9wbG9nIGVudHJ5IHdpdGhvdXQgdHM6IFwiICsgRUpTT04uc3RyaW5naWZ5KGxhc3RFbnRyeSkpO1xuXG4gICAgaWYgKHNlbGYuX2xhc3RQcm9jZXNzZWRUUyAmJiB0cy5sZXNzVGhhbk9yRXF1YWwoc2VsZi5fbGFzdFByb2Nlc3NlZFRTKSkge1xuICAgICAgLy8gV2UndmUgYWxyZWFkeSBjYXVnaHQgdXAgdG8gaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cblxuICAgIC8vIEluc2VydCB0aGUgZnV0dXJlIGludG8gb3VyIGxpc3QuIEFsbW9zdCBhbHdheXMsIHRoaXMgd2lsbCBiZSBhdCB0aGUgZW5kLFxuICAgIC8vIGJ1dCBpdCdzIGNvbmNlaXZhYmxlIHRoYXQgaWYgd2UgZmFpbCBvdmVyIGZyb20gb25lIHByaW1hcnkgdG8gYW5vdGhlcixcbiAgICAvLyB0aGUgb3Bsb2cgZW50cmllcyB3ZSBzZWUgd2lsbCBnbyBiYWNrd2FyZHMuXG4gICAgdmFyIGluc2VydEFmdGVyID0gc2VsZi5fY2F0Y2hpbmdVcEZ1dHVyZXMubGVuZ3RoO1xuICAgIHdoaWxlIChpbnNlcnRBZnRlciAtIDEgPiAwICYmIHNlbGYuX2NhdGNoaW5nVXBGdXR1cmVzW2luc2VydEFmdGVyIC0gMV0udHMuZ3JlYXRlclRoYW4odHMpKSB7XG4gICAgICBpbnNlcnRBZnRlci0tO1xuICAgIH1cbiAgICB2YXIgZiA9IG5ldyBGdXR1cmU7XG4gICAgc2VsZi5fY2F0Y2hpbmdVcEZ1dHVyZXMuc3BsaWNlKGluc2VydEFmdGVyLCAwLCB7dHM6IHRzLCBmdXR1cmU6IGZ9KTtcbiAgICBmLndhaXQoKTtcbiAgfSxcbiAgX3N0YXJ0VGFpbGluZzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBGaXJzdCwgbWFrZSBzdXJlIHRoYXQgd2UncmUgdGFsa2luZyB0byB0aGUgbG9jYWwgZGF0YWJhc2UuXG4gICAgdmFyIG1vbmdvZGJVcmkgPSBOcG0ucmVxdWlyZSgnbW9uZ29kYi11cmknKTtcbiAgICBpZiAobW9uZ29kYlVyaS5wYXJzZShzZWxmLl9vcGxvZ1VybCkuZGF0YWJhc2UgIT09ICdsb2NhbCcpIHtcbiAgICAgIHRocm93IEVycm9yKFwiJE1PTkdPX09QTE9HX1VSTCBtdXN0IGJlIHNldCB0byB0aGUgJ2xvY2FsJyBkYXRhYmFzZSBvZiBcIiArXG4gICAgICAgICAgICAgICAgICBcImEgTW9uZ28gcmVwbGljYSBzZXRcIik7XG4gICAgfVxuXG4gICAgLy8gV2UgbWFrZSB0d28gc2VwYXJhdGUgY29ubmVjdGlvbnMgdG8gTW9uZ28uIFRoZSBOb2RlIE1vbmdvIGRyaXZlclxuICAgIC8vIGltcGxlbWVudHMgYSBuYWl2ZSByb3VuZC1yb2JpbiBjb25uZWN0aW9uIHBvb2w6IGVhY2ggXCJjb25uZWN0aW9uXCIgaXMgYVxuICAgIC8vIHBvb2wgb2Ygc2V2ZXJhbCAoNSBieSBkZWZhdWx0KSBUQ1AgY29ubmVjdGlvbnMsIGFuZCBlYWNoIHJlcXVlc3QgaXNcbiAgICAvLyByb3RhdGVkIHRocm91Z2ggdGhlIHBvb2xzLiBUYWlsYWJsZSBjdXJzb3IgcXVlcmllcyBibG9jayBvbiB0aGUgc2VydmVyXG4gICAgLy8gdW50aWwgdGhlcmUgaXMgc29tZSBkYXRhIHRvIHJldHVybiAob3IgdW50aWwgYSBmZXcgc2Vjb25kcyBoYXZlXG4gICAgLy8gcGFzc2VkKS4gU28gaWYgdGhlIGNvbm5lY3Rpb24gcG9vbCB1c2VkIGZvciB0YWlsaW5nIGN1cnNvcnMgaXMgdGhlIHNhbWVcbiAgICAvLyBwb29sIHVzZWQgZm9yIG90aGVyIHF1ZXJpZXMsIHRoZSBvdGhlciBxdWVyaWVzIHdpbGwgYmUgZGVsYXllZCBieSBzZWNvbmRzXG4gICAgLy8gMS81IG9mIHRoZSB0aW1lLlxuICAgIC8vXG4gICAgLy8gVGhlIHRhaWwgY29ubmVjdGlvbiB3aWxsIG9ubHkgZXZlciBiZSBydW5uaW5nIGEgc2luZ2xlIHRhaWwgY29tbWFuZCwgc29cbiAgICAvLyBpdCBvbmx5IG5lZWRzIHRvIG1ha2Ugb25lIHVuZGVybHlpbmcgVENQIGNvbm5lY3Rpb24uXG4gICAgc2VsZi5fb3Bsb2dUYWlsQ29ubmVjdGlvbiA9IG5ldyBNb25nb0Nvbm5lY3Rpb24oXG4gICAgICBzZWxmLl9vcGxvZ1VybCwge21heFBvb2xTaXplOiAxfSk7XG4gICAgLy8gWFhYIGJldHRlciBkb2NzLCBidXQ6IGl0J3MgdG8gZ2V0IG1vbm90b25pYyByZXN1bHRzXG4gICAgLy8gWFhYIGlzIGl0IHNhZmUgdG8gc2F5IFwiaWYgdGhlcmUncyBhbiBpbiBmbGlnaHQgcXVlcnksIGp1c3QgdXNlIGl0c1xuICAgIC8vICAgICByZXN1bHRzXCI/IEkgZG9uJ3QgdGhpbmsgc28gYnV0IHNob3VsZCBjb25zaWRlciB0aGF0XG4gICAgc2VsZi5fb3Bsb2dMYXN0RW50cnlDb25uZWN0aW9uID0gbmV3IE1vbmdvQ29ubmVjdGlvbihcbiAgICAgIHNlbGYuX29wbG9nVXJsLCB7bWF4UG9vbFNpemU6IDF9KTtcblxuICAgIC8vIE5vdywgbWFrZSBzdXJlIHRoYXQgdGhlcmUgYWN0dWFsbHkgaXMgYSByZXBsIHNldCBoZXJlLiBJZiBub3QsIG9wbG9nXG4gICAgLy8gdGFpbGluZyB3b24ndCBldmVyIGZpbmQgYW55dGhpbmchXG4gICAgLy8gTW9yZSBvbiB0aGUgaXNNYXN0ZXJEb2NcbiAgICAvLyBodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9jb21tYW5kL2lzTWFzdGVyL1xuICAgIHZhciBmID0gbmV3IEZ1dHVyZTtcbiAgICBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZGIuYWRtaW4oKS5jb21tYW5kKFxuICAgICAgeyBpc21hc3RlcjogMSB9LCBmLnJlc29sdmVyKCkpO1xuICAgIHZhciBpc01hc3RlckRvYyA9IGYud2FpdCgpO1xuXG4gICAgaWYgKCEoaXNNYXN0ZXJEb2MgJiYgaXNNYXN0ZXJEb2Muc2V0TmFtZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFwiJE1PTkdPX09QTE9HX1VSTCBtdXN0IGJlIHNldCB0byB0aGUgJ2xvY2FsJyBkYXRhYmFzZSBvZiBcIiArXG4gICAgICAgICAgICAgICAgICBcImEgTW9uZ28gcmVwbGljYSBzZXRcIik7XG4gICAgfVxuXG4gICAgLy8gRmluZCB0aGUgbGFzdCBvcGxvZyBlbnRyeS5cbiAgICB2YXIgbGFzdE9wbG9nRW50cnkgPSBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZmluZE9uZShcbiAgICAgIE9QTE9HX0NPTExFQ1RJT04sIHt9LCB7c29ydDogeyRuYXR1cmFsOiAtMX0sIGZpZWxkczoge3RzOiAxfX0pO1xuXG4gICAgdmFyIG9wbG9nU2VsZWN0b3IgPSBfLmNsb25lKHNlbGYuX2Jhc2VPcGxvZ1NlbGVjdG9yKTtcbiAgICBpZiAobGFzdE9wbG9nRW50cnkpIHtcbiAgICAgIC8vIFN0YXJ0IGFmdGVyIHRoZSBsYXN0IGVudHJ5IHRoYXQgY3VycmVudGx5IGV4aXN0cy5cbiAgICAgIG9wbG9nU2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0T3Bsb2dFbnRyeS50c307XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgYW55IGNhbGxzIHRvIGNhbGxXaGVuUHJvY2Vzc2VkTGF0ZXN0IGJlZm9yZSBhbnkgb3RoZXJcbiAgICAgIC8vIG9wbG9nIGVudHJpZXMgc2hvdyB1cCwgYWxsb3cgY2FsbFdoZW5Qcm9jZXNzZWRMYXRlc3QgdG8gY2FsbCBpdHNcbiAgICAgIC8vIGNhbGxiYWNrIGltbWVkaWF0ZWx5LlxuICAgICAgc2VsZi5fbGFzdFByb2Nlc3NlZFRTID0gbGFzdE9wbG9nRW50cnkudHM7XG4gICAgfVxuXG4gICAgdmFyIGN1cnNvckRlc2NyaXB0aW9uID0gbmV3IEN1cnNvckRlc2NyaXB0aW9uKFxuICAgICAgT1BMT0dfQ09MTEVDVElPTiwgb3Bsb2dTZWxlY3Rvciwge3RhaWxhYmxlOiB0cnVlfSk7XG5cbiAgICAvLyBTdGFydCB0YWlsaW5nIHRoZSBvcGxvZy5cbiAgICAvL1xuICAgIC8vIFdlIHJlc3RhcnQgdGhlIGxvdy1sZXZlbCBvcGxvZyBxdWVyeSBldmVyeSAzMCBzZWNvbmRzIGlmIHdlIGRpZG4ndCBnZXQgYVxuICAgIC8vIGRvYy4gVGhpcyBpcyBhIHdvcmthcm91bmQgZm9yICM4NTk4OiB0aGUgTm9kZSBNb25nbyBkcml2ZXIgaGFzIGF0IGxlYXN0XG4gICAgLy8gb25lIGJ1ZyB0aGF0IGNhbiBsZWFkIHRvIHF1ZXJ5IGNhbGxiYWNrcyBuZXZlciBnZXR0aW5nIGNhbGxlZCAoZXZlbiB3aXRoXG4gICAgLy8gYW4gZXJyb3IpIHdoZW4gbGVhZGVyc2hpcCBmYWlsb3ZlciBvY2N1ci5cbiAgICBzZWxmLl90YWlsSGFuZGxlID0gc2VsZi5fb3Bsb2dUYWlsQ29ubmVjdGlvbi50YWlsKFxuICAgICAgY3Vyc29yRGVzY3JpcHRpb24sXG4gICAgICBmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgIHNlbGYuX2VudHJ5UXVldWUucHVzaChkb2MpO1xuICAgICAgICBzZWxmLl9tYXliZVN0YXJ0V29ya2VyKCk7XG4gICAgICB9LFxuICAgICAgVEFJTF9USU1FT1VUXG4gICAgKTtcbiAgICBzZWxmLl9yZWFkeUZ1dHVyZS5yZXR1cm4oKTtcbiAgfSxcblxuICBfbWF5YmVTdGFydFdvcmtlcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fd29ya2VyQWN0aXZlKSByZXR1cm47XG4gICAgc2VsZi5fd29ya2VyQWN0aXZlID0gdHJ1ZTtcblxuICAgIE1ldGVvci5kZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBNYXkgYmUgY2FsbGVkIHJlY3Vyc2l2ZWx5IGluIGNhc2Ugb2YgdHJhbnNhY3Rpb25zLlxuICAgICAgZnVuY3Rpb24gaGFuZGxlRG9jKGRvYykge1xuICAgICAgICBpZiAoZG9jLm5zID09PSBcImFkbWluLiRjbWRcIikge1xuICAgICAgICAgIGlmIChkb2Muby5hcHBseU9wcykge1xuICAgICAgICAgICAgLy8gVGhpcyB3YXMgYSBzdWNjZXNzZnVsIHRyYW5zYWN0aW9uLCBzbyB3ZSBuZWVkIHRvIGFwcGx5IHRoZVxuICAgICAgICAgICAgLy8gb3BlcmF0aW9ucyB0aGF0IHdlcmUgaW52b2x2ZWQuXG4gICAgICAgICAgICBsZXQgbmV4dFRpbWVzdGFtcCA9IGRvYy50cztcbiAgICAgICAgICAgIGRvYy5vLmFwcGx5T3BzLmZvckVhY2gob3AgPT4ge1xuICAgICAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDIwLlxuICAgICAgICAgICAgICBpZiAoIW9wLnRzKSB7XG4gICAgICAgICAgICAgICAgb3AudHMgPSBuZXh0VGltZXN0YW1wO1xuICAgICAgICAgICAgICAgIG5leHRUaW1lc3RhbXAgPSBuZXh0VGltZXN0YW1wLmFkZChMb25nLk9ORSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaGFuZGxlRG9jKG9wKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGNvbW1hbmQgXCIgKyBFSlNPTi5zdHJpbmdpZnkoZG9jKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0cmlnZ2VyID0ge1xuICAgICAgICAgIGRyb3BDb2xsZWN0aW9uOiBmYWxzZSxcbiAgICAgICAgICBkcm9wRGF0YWJhc2U6IGZhbHNlLFxuICAgICAgICAgIG9wOiBkb2MsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2MubnMgPT09IFwic3RyaW5nXCIgJiZcbiAgICAgICAgICAgIGRvYy5ucy5zdGFydHNXaXRoKHNlbGYuX2RiTmFtZSArIFwiLlwiKSkge1xuICAgICAgICAgIHRyaWdnZXIuY29sbGVjdGlvbiA9IGRvYy5ucy5zbGljZShzZWxmLl9kYk5hbWUubGVuZ3RoICsgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJcyBpdCBhIHNwZWNpYWwgY29tbWFuZCBhbmQgdGhlIGNvbGxlY3Rpb24gbmFtZSBpcyBoaWRkZW5cbiAgICAgICAgLy8gc29tZXdoZXJlIGluIG9wZXJhdG9yP1xuICAgICAgICBpZiAodHJpZ2dlci5jb2xsZWN0aW9uID09PSBcIiRjbWRcIikge1xuICAgICAgICAgIGlmIChkb2Muby5kcm9wRGF0YWJhc2UpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0cmlnZ2VyLmNvbGxlY3Rpb247XG4gICAgICAgICAgICB0cmlnZ2VyLmRyb3BEYXRhYmFzZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmIChfLmhhcyhkb2MubywgXCJkcm9wXCIpKSB7XG4gICAgICAgICAgICB0cmlnZ2VyLmNvbGxlY3Rpb24gPSBkb2Muby5kcm9wO1xuICAgICAgICAgICAgdHJpZ2dlci5kcm9wQ29sbGVjdGlvbiA9IHRydWU7XG4gICAgICAgICAgICB0cmlnZ2VyLmlkID0gbnVsbDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJVbmtub3duIGNvbW1hbmQgXCIgKyBFSlNPTi5zdHJpbmdpZnkoZG9jKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWxsIG90aGVyIG9wcyBoYXZlIGFuIGlkLlxuICAgICAgICAgIHRyaWdnZXIuaWQgPSBpZEZvck9wKGRvYyk7XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLl9jcm9zc2Jhci5maXJlKHRyaWdnZXIpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICB3aGlsZSAoISBzZWxmLl9zdG9wcGVkICYmXG4gICAgICAgICAgICAgICAhIHNlbGYuX2VudHJ5UXVldWUuaXNFbXB0eSgpKSB7XG4gICAgICAgICAgLy8gQXJlIHdlIHRvbyBmYXIgYmVoaW5kPyBKdXN0IHRlbGwgb3VyIG9ic2VydmVycyB0aGF0IHRoZXkgbmVlZCB0b1xuICAgICAgICAgIC8vIHJlcG9sbCwgYW5kIGRyb3Agb3VyIHF1ZXVlLlxuICAgICAgICAgIGlmIChzZWxmLl9lbnRyeVF1ZXVlLmxlbmd0aCA+IFRPT19GQVJfQkVISU5EKSB7XG4gICAgICAgICAgICB2YXIgbGFzdEVudHJ5ID0gc2VsZi5fZW50cnlRdWV1ZS5wb3AoKTtcbiAgICAgICAgICAgIHNlbGYuX2VudHJ5UXVldWUuY2xlYXIoKTtcblxuICAgICAgICAgICAgc2VsZi5fb25Ta2lwcGVkRW50cmllc0hvb2suZWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gRnJlZSBhbnkgd2FpdFVudGlsQ2F1Z2h0VXAoKSBjYWxscyB0aGF0IHdlcmUgd2FpdGluZyBmb3IgdXMgdG9cbiAgICAgICAgICAgIC8vIHBhc3Mgc29tZXRoaW5nIHRoYXQgd2UganVzdCBza2lwcGVkLlxuICAgICAgICAgICAgc2VsZi5fc2V0TGFzdFByb2Nlc3NlZFRTKGxhc3RFbnRyeS50cyk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBkb2MgPSBzZWxmLl9lbnRyeVF1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgICAgICAvLyBGaXJlIHRyaWdnZXIocykgZm9yIHRoaXMgZG9jLlxuICAgICAgICAgIGhhbmRsZURvYyhkb2MpO1xuXG4gICAgICAgICAgLy8gTm93IHRoYXQgd2UndmUgcHJvY2Vzc2VkIHRoaXMgb3BlcmF0aW9uLCBwcm9jZXNzIHBlbmRpbmdcbiAgICAgICAgICAvLyBzZXF1ZW5jZXJzLlxuICAgICAgICAgIGlmIChkb2MudHMpIHtcbiAgICAgICAgICAgIHNlbGYuX3NldExhc3RQcm9jZXNzZWRUUyhkb2MudHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihcIm9wbG9nIGVudHJ5IHdpdGhvdXQgdHM6IFwiICsgRUpTT04uc3RyaW5naWZ5KGRvYykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2VsZi5fd29ya2VyQWN0aXZlID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgX3NldExhc3RQcm9jZXNzZWRUUzogZnVuY3Rpb24gKHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX2xhc3RQcm9jZXNzZWRUUyA9IHRzO1xuICAgIHdoaWxlICghXy5pc0VtcHR5KHNlbGYuX2NhdGNoaW5nVXBGdXR1cmVzKSAmJiBzZWxmLl9jYXRjaGluZ1VwRnV0dXJlc1swXS50cy5sZXNzVGhhbk9yRXF1YWwoc2VsZi5fbGFzdFByb2Nlc3NlZFRTKSkge1xuICAgICAgdmFyIHNlcXVlbmNlciA9IHNlbGYuX2NhdGNoaW5nVXBGdXR1cmVzLnNoaWZ0KCk7XG4gICAgICBzZXF1ZW5jZXIuZnV0dXJlLnJldHVybigpO1xuICAgIH1cbiAgfSxcblxuICAvL01ldGhvZHMgdXNlZCBvbiB0ZXN0cyB0byBkaW5hbWljYWxseSBjaGFuZ2UgVE9PX0ZBUl9CRUhJTkRcbiAgX2RlZmluZVRvb0ZhckJlaGluZDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICBUT09fRkFSX0JFSElORCA9IHZhbHVlO1xuICB9LFxuICBfcmVzZXRUb29GYXJCZWhpbmQ6IGZ1bmN0aW9uKCkge1xuICAgIFRPT19GQVJfQkVISU5EID0gcHJvY2Vzcy5lbnYuTUVURU9SX09QTE9HX1RPT19GQVJfQkVISU5EIHx8IDIwMDA7XG4gIH1cbn0pO1xuIiwidmFyIEZ1dHVyZSA9IE5wbS5yZXF1aXJlKCdmaWJlcnMvZnV0dXJlJyk7XG5cbk9ic2VydmVNdWx0aXBsZXhlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoIW9wdGlvbnMgfHwgIV8uaGFzKG9wdGlvbnMsICdvcmRlcmVkJykpXG4gICAgdGhyb3cgRXJyb3IoXCJtdXN0IHNwZWNpZmllZCBvcmRlcmVkXCIpO1xuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1tdWx0aXBsZXhlcnNcIiwgMSk7XG5cbiAgc2VsZi5fb3JkZXJlZCA9IG9wdGlvbnMub3JkZXJlZDtcbiAgc2VsZi5fb25TdG9wID0gb3B0aW9ucy5vblN0b3AgfHwgZnVuY3Rpb24gKCkge307XG4gIHNlbGYuX3F1ZXVlID0gbmV3IE1ldGVvci5fU3luY2hyb25vdXNRdWV1ZSgpO1xuICBzZWxmLl9oYW5kbGVzID0ge307XG4gIHNlbGYuX3JlYWR5RnV0dXJlID0gbmV3IEZ1dHVyZTtcbiAgc2VsZi5fY2FjaGUgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIoe1xuICAgIG9yZGVyZWQ6IG9wdGlvbnMub3JkZXJlZH0pO1xuICAvLyBOdW1iZXIgb2YgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIHRhc2tzIHNjaGVkdWxlZCBidXQgbm90IHlldFxuICAvLyBydW5uaW5nLiByZW1vdmVIYW5kbGUgdXNlcyB0aGlzIHRvIGtub3cgaWYgaXQncyB0aW1lIHRvIGNhbGwgdGhlIG9uU3RvcFxuICAvLyBjYWxsYmFjay5cbiAgc2VsZi5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQgPSAwO1xuXG4gIF8uZWFjaChzZWxmLmNhbGxiYWNrTmFtZXMoKSwgZnVuY3Rpb24gKGNhbGxiYWNrTmFtZSkge1xuICAgIHNlbGZbY2FsbGJhY2tOYW1lXSA9IGZ1bmN0aW9uICgvKiAuLi4gKi8pIHtcbiAgICAgIHNlbGYuX2FwcGx5Q2FsbGJhY2soY2FsbGJhY2tOYW1lLCBfLnRvQXJyYXkoYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfSk7XG59O1xuXG5fLmV4dGVuZChPYnNlcnZlTXVsdGlwbGV4ZXIucHJvdG90eXBlLCB7XG4gIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkczogZnVuY3Rpb24gKGhhbmRsZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIENoZWNrIHRoaXMgYmVmb3JlIGNhbGxpbmcgcnVuVGFzayAoZXZlbiB0aG91Z2ggcnVuVGFzayBkb2VzIHRoZSBzYW1lXG4gICAgLy8gY2hlY2spIHNvIHRoYXQgd2UgZG9uJ3QgbGVhayBhbiBPYnNlcnZlTXVsdGlwbGV4ZXIgb24gZXJyb3IgYnlcbiAgICAvLyBpbmNyZW1lbnRpbmcgX2FkZEhhbmRsZVRhc2tzU2NoZWR1bGVkQnV0Tm90UGVyZm9ybWVkIGFuZCBuZXZlclxuICAgIC8vIGRlY3JlbWVudGluZyBpdC5cbiAgICBpZiAoIXNlbGYuX3F1ZXVlLnNhZmVUb1J1blRhc2soKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNhbGwgb2JzZXJ2ZUNoYW5nZXMgZnJvbSBhbiBvYnNlcnZlIGNhbGxiYWNrIG9uIHRoZSBzYW1lIHF1ZXJ5XCIpO1xuICAgICsrc2VsZi5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQ7XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1oYW5kbGVzXCIsIDEpO1xuXG4gICAgc2VsZi5fcXVldWUucnVuVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9oYW5kbGVzW2hhbmRsZS5faWRdID0gaGFuZGxlO1xuICAgICAgLy8gU2VuZCBvdXQgd2hhdGV2ZXIgYWRkcyB3ZSBoYXZlIHNvIGZhciAod2hldGhlciBvciBub3Qgd2UgdGhlXG4gICAgICAvLyBtdWx0aXBsZXhlciBpcyByZWFkeSkuXG4gICAgICBzZWxmLl9zZW5kQWRkcyhoYW5kbGUpO1xuICAgICAgLS1zZWxmLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcbiAgICB9KTtcbiAgICAvLyAqb3V0c2lkZSogdGhlIHRhc2ssIHNpbmNlIG90aGVyd2lzZSB3ZSdkIGRlYWRsb2NrXG4gICAgc2VsZi5fcmVhZHlGdXR1cmUud2FpdCgpO1xuICB9LFxuXG4gIC8vIFJlbW92ZSBhbiBvYnNlcnZlIGhhbmRsZS4gSWYgaXQgd2FzIHRoZSBsYXN0IG9ic2VydmUgaGFuZGxlLCBjYWxsIHRoZVxuICAvLyBvblN0b3AgY2FsbGJhY2s7IHlvdSBjYW5ub3QgYWRkIGFueSBtb3JlIG9ic2VydmUgaGFuZGxlcyBhZnRlciB0aGlzLlxuICAvL1xuICAvLyBUaGlzIGlzIG5vdCBzeW5jaHJvbml6ZWQgd2l0aCBwb2xscyBhbmQgaGFuZGxlIGFkZGl0aW9uczogdGhpcyBtZWFucyB0aGF0XG4gIC8vIHlvdSBjYW4gc2FmZWx5IGNhbGwgaXQgZnJvbSB3aXRoaW4gYW4gb2JzZXJ2ZSBjYWxsYmFjaywgYnV0IGl0IGFsc28gbWVhbnNcbiAgLy8gdGhhdCB3ZSBoYXZlIHRvIGJlIGNhcmVmdWwgd2hlbiB3ZSBpdGVyYXRlIG92ZXIgX2hhbmRsZXMuXG4gIHJlbW92ZUhhbmRsZTogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gVGhpcyBzaG91bGQgbm90IGJlIHBvc3NpYmxlOiB5b3UgY2FuIG9ubHkgY2FsbCByZW1vdmVIYW5kbGUgYnkgaGF2aW5nXG4gICAgLy8gYWNjZXNzIHRvIHRoZSBPYnNlcnZlSGFuZGxlLCB3aGljaCBpc24ndCByZXR1cm5lZCB0byB1c2VyIGNvZGUgdW50aWwgdGhlXG4gICAgLy8gbXVsdGlwbGV4IGlzIHJlYWR5LlxuICAgIGlmICghc2VsZi5fcmVhZHkoKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHJlbW92ZSBoYW5kbGVzIHVudGlsIHRoZSBtdWx0aXBsZXggaXMgcmVhZHlcIik7XG5cbiAgICBkZWxldGUgc2VsZi5faGFuZGxlc1tpZF07XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1oYW5kbGVzXCIsIC0xKTtcblxuICAgIGlmIChfLmlzRW1wdHkoc2VsZi5faGFuZGxlcykgJiZcbiAgICAgICAgc2VsZi5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQgPT09IDApIHtcbiAgICAgIHNlbGYuX3N0b3AoKTtcbiAgICB9XG4gIH0sXG4gIF9zdG9wOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIC8vIEl0IHNob3VsZG4ndCBiZSBwb3NzaWJsZSBmb3IgdXMgdG8gc3RvcCB3aGVuIGFsbCBvdXIgaGFuZGxlcyBzdGlsbFxuICAgIC8vIGhhdmVuJ3QgYmVlbiByZXR1cm5lZCBmcm9tIG9ic2VydmVDaGFuZ2VzIVxuICAgIGlmICghIHNlbGYuX3JlYWR5KCkgJiYgISBvcHRpb25zLmZyb21RdWVyeUVycm9yKVxuICAgICAgdGhyb3cgRXJyb3IoXCJzdXJwcmlzaW5nIF9zdG9wOiBub3QgcmVhZHlcIik7XG5cbiAgICAvLyBDYWxsIHN0b3AgY2FsbGJhY2sgKHdoaWNoIGtpbGxzIHRoZSB1bmRlcmx5aW5nIHByb2Nlc3Mgd2hpY2ggc2VuZHMgdXNcbiAgICAvLyBjYWxsYmFja3MgYW5kIHJlbW92ZXMgdXMgZnJvbSB0aGUgY29ubmVjdGlvbidzIGRpY3Rpb25hcnkpLlxuICAgIHNlbGYuX29uU3RvcCgpO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLW11bHRpcGxleGVyc1wiLCAtMSk7XG5cbiAgICAvLyBDYXVzZSBmdXR1cmUgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGxzIHRvIHRocm93IChidXQgdGhlIG9uU3RvcFxuICAgIC8vIGNhbGxiYWNrIHNob3VsZCBtYWtlIG91ciBjb25uZWN0aW9uIGZvcmdldCBhYm91dCB1cykuXG4gICAgc2VsZi5faGFuZGxlcyA9IG51bGw7XG4gIH0sXG5cbiAgLy8gQWxsb3dzIGFsbCBhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMgY2FsbHMgdG8gcmV0dXJuLCBvbmNlIGFsbCBwcmVjZWRpbmdcbiAgLy8gYWRkcyBoYXZlIGJlZW4gcHJvY2Vzc2VkLiBEb2VzIG5vdCBibG9jay5cbiAgcmVhZHk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fcXVldWUucXVldWVUYXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9yZWFkeSgpKVxuICAgICAgICB0aHJvdyBFcnJvcihcImNhbid0IG1ha2UgT2JzZXJ2ZU11bHRpcGxleCByZWFkeSB0d2ljZSFcIik7XG4gICAgICBzZWxmLl9yZWFkeUZ1dHVyZS5yZXR1cm4oKTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBJZiB0cnlpbmcgdG8gZXhlY3V0ZSB0aGUgcXVlcnkgcmVzdWx0cyBpbiBhbiBlcnJvciwgY2FsbCB0aGlzLiBUaGlzIGlzXG4gIC8vIGludGVuZGVkIGZvciBwZXJtYW5lbnQgZXJyb3JzLCBub3QgdHJhbnNpZW50IG5ldHdvcmsgZXJyb3JzIHRoYXQgY291bGQgYmVcbiAgLy8gZml4ZWQuIEl0IHNob3VsZCBvbmx5IGJlIGNhbGxlZCBiZWZvcmUgcmVhZHkoKSwgYmVjYXVzZSBpZiB5b3UgY2FsbGVkIHJlYWR5XG4gIC8vIHRoYXQgbWVhbnQgdGhhdCB5b3UgbWFuYWdlZCB0byBydW4gdGhlIHF1ZXJ5IG9uY2UuIEl0IHdpbGwgc3RvcCB0aGlzXG4gIC8vIE9ic2VydmVNdWx0aXBsZXggYW5kIGNhdXNlIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyBjYWxscyAoYW5kIHRodXNcbiAgLy8gb2JzZXJ2ZUNoYW5nZXMgY2FsbHMpIHRvIHRocm93IHRoZSBlcnJvci5cbiAgcXVlcnlFcnJvcjogZnVuY3Rpb24gKGVycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9xdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9yZWFkeSgpKVxuICAgICAgICB0aHJvdyBFcnJvcihcImNhbid0IGNsYWltIHF1ZXJ5IGhhcyBhbiBlcnJvciBhZnRlciBpdCB3b3JrZWQhXCIpO1xuICAgICAgc2VsZi5fc3RvcCh7ZnJvbVF1ZXJ5RXJyb3I6IHRydWV9KTtcbiAgICAgIHNlbGYuX3JlYWR5RnV0dXJlLnRocm93KGVycik7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gQ2FsbHMgXCJjYlwiIG9uY2UgdGhlIGVmZmVjdHMgb2YgYWxsIFwicmVhZHlcIiwgXCJhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHNcIlxuICAvLyBhbmQgb2JzZXJ2ZSBjYWxsYmFja3Mgd2hpY2ggY2FtZSBiZWZvcmUgdGhpcyBjYWxsIGhhdmUgYmVlbiBwcm9wYWdhdGVkIHRvXG4gIC8vIGFsbCBoYW5kbGVzLiBcInJlYWR5XCIgbXVzdCBoYXZlIGFscmVhZHkgYmVlbiBjYWxsZWQgb24gdGhpcyBtdWx0aXBsZXhlci5cbiAgb25GbHVzaDogZnVuY3Rpb24gKGNiKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX3F1ZXVlLnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIXNlbGYuX3JlYWR5KCkpXG4gICAgICAgIHRocm93IEVycm9yKFwib25seSBjYWxsIG9uRmx1c2ggb24gYSBtdWx0aXBsZXhlciB0aGF0IHdpbGwgYmUgcmVhZHlcIik7XG4gICAgICBjYigpO1xuICAgIH0pO1xuICB9LFxuICBjYWxsYmFja05hbWVzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9vcmRlcmVkKVxuICAgICAgcmV0dXJuIFtcImFkZGVkQmVmb3JlXCIsIFwiY2hhbmdlZFwiLCBcIm1vdmVkQmVmb3JlXCIsIFwicmVtb3ZlZFwiXTtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gW1wiYWRkZWRcIiwgXCJjaGFuZ2VkXCIsIFwicmVtb3ZlZFwiXTtcbiAgfSxcbiAgX3JlYWR5OiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlYWR5RnV0dXJlLmlzUmVzb2x2ZWQoKTtcbiAgfSxcbiAgX2FwcGx5Q2FsbGJhY2s6IGZ1bmN0aW9uIChjYWxsYmFja05hbWUsIGFyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fcXVldWUucXVldWVUYXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIElmIHdlIHN0b3BwZWQgaW4gdGhlIG1lYW50aW1lLCBkbyBub3RoaW5nLlxuICAgICAgaWYgKCFzZWxmLl9oYW5kbGVzKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIEZpcnN0LCBhcHBseSB0aGUgY2hhbmdlIHRvIHRoZSBjYWNoZS5cbiAgICAgIHNlbGYuX2NhY2hlLmFwcGx5Q2hhbmdlW2NhbGxiYWNrTmFtZV0uYXBwbHkobnVsbCwgYXJncyk7XG5cbiAgICAgIC8vIElmIHdlIGhhdmVuJ3QgZmluaXNoZWQgdGhlIGluaXRpYWwgYWRkcywgdGhlbiB3ZSBzaG91bGQgb25seSBiZSBnZXR0aW5nXG4gICAgICAvLyBhZGRzLlxuICAgICAgaWYgKCFzZWxmLl9yZWFkeSgpICYmXG4gICAgICAgICAgKGNhbGxiYWNrTmFtZSAhPT0gJ2FkZGVkJyAmJiBjYWxsYmFja05hbWUgIT09ICdhZGRlZEJlZm9yZScpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkdvdCBcIiArIGNhbGxiYWNrTmFtZSArIFwiIGR1cmluZyBpbml0aWFsIGFkZHNcIik7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdyBtdWx0aXBsZXggdGhlIGNhbGxiYWNrcyBvdXQgdG8gYWxsIG9ic2VydmUgaGFuZGxlcy4gSXQncyBPSyBpZlxuICAgICAgLy8gdGhlc2UgY2FsbHMgeWllbGQ7IHNpbmNlIHdlJ3JlIGluc2lkZSBhIHRhc2ssIG5vIG90aGVyIHVzZSBvZiBvdXIgcXVldWVcbiAgICAgIC8vIGNhbiBjb250aW51ZSB1bnRpbCB0aGVzZSBhcmUgZG9uZS4gKEJ1dCB3ZSBkbyBoYXZlIHRvIGJlIGNhcmVmdWwgdG8gbm90XG4gICAgICAvLyB1c2UgYSBoYW5kbGUgdGhhdCBnb3QgcmVtb3ZlZCwgYmVjYXVzZSByZW1vdmVIYW5kbGUgZG9lcyBub3QgdXNlIHRoZVxuICAgICAgLy8gcXVldWU7IHRodXMsIHdlIGl0ZXJhdGUgb3ZlciBhbiBhcnJheSBvZiBrZXlzIHRoYXQgd2UgY29udHJvbC4pXG4gICAgICBfLmVhY2goXy5rZXlzKHNlbGYuX2hhbmRsZXMpLCBmdW5jdGlvbiAoaGFuZGxlSWQpIHtcbiAgICAgICAgdmFyIGhhbmRsZSA9IHNlbGYuX2hhbmRsZXMgJiYgc2VsZi5faGFuZGxlc1toYW5kbGVJZF07XG4gICAgICAgIGlmICghaGFuZGxlKVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gaGFuZGxlWydfJyArIGNhbGxiYWNrTmFtZV07XG4gICAgICAgIC8vIGNsb25lIGFyZ3VtZW50cyBzbyB0aGF0IGNhbGxiYWNrcyBjYW4gbXV0YXRlIHRoZWlyIGFyZ3VtZW50c1xuICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjay5hcHBseShudWxsLFxuICAgICAgICAgIGhhbmRsZS5ub25NdXRhdGluZ0NhbGxiYWNrcyA/IGFyZ3MgOiBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBTZW5kcyBpbml0aWFsIGFkZHMgdG8gYSBoYW5kbGUuIEl0IHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIHdpdGhpbiBhIHRhc2tcbiAgLy8gKHRoZSB0YXNrIHRoYXQgaXMgcHJvY2Vzc2luZyB0aGUgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGwpLiBJdFxuICAvLyBzeW5jaHJvbm91c2x5IGludm9rZXMgdGhlIGhhbmRsZSdzIGFkZGVkIG9yIGFkZGVkQmVmb3JlOyB0aGVyZSdzIG5vIG5lZWQgdG9cbiAgLy8gZmx1c2ggdGhlIHF1ZXVlIGFmdGVyd2FyZHMgdG8gZW5zdXJlIHRoYXQgdGhlIGNhbGxiYWNrcyBnZXQgb3V0LlxuICBfc2VuZEFkZHM6IGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3F1ZXVlLnNhZmVUb1J1blRhc2soKSlcbiAgICAgIHRocm93IEVycm9yKFwiX3NlbmRBZGRzIG1heSBvbmx5IGJlIGNhbGxlZCBmcm9tIHdpdGhpbiBhIHRhc2shXCIpO1xuICAgIHZhciBhZGQgPSBzZWxmLl9vcmRlcmVkID8gaGFuZGxlLl9hZGRlZEJlZm9yZSA6IGhhbmRsZS5fYWRkZWQ7XG4gICAgaWYgKCFhZGQpXG4gICAgICByZXR1cm47XG4gICAgLy8gbm90ZTogZG9jcyBtYXkgYmUgYW4gX0lkTWFwIG9yIGFuIE9yZGVyZWREaWN0XG4gICAgc2VsZi5fY2FjaGUuZG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICBpZiAoIV8uaGFzKHNlbGYuX2hhbmRsZXMsIGhhbmRsZS5faWQpKVxuICAgICAgICB0aHJvdyBFcnJvcihcImhhbmRsZSBnb3QgcmVtb3ZlZCBiZWZvcmUgc2VuZGluZyBpbml0aWFsIGFkZHMhXCIpO1xuICAgICAgY29uc3QgeyBfaWQsIC4uLmZpZWxkcyB9ID0gaGFuZGxlLm5vbk11dGF0aW5nQ2FsbGJhY2tzID8gZG9jXG4gICAgICAgIDogRUpTT04uY2xvbmUoZG9jKTtcbiAgICAgIGlmIChzZWxmLl9vcmRlcmVkKVxuICAgICAgICBhZGQoaWQsIGZpZWxkcywgbnVsbCk7IC8vIHdlJ3JlIGdvaW5nIGluIG9yZGVyLCBzbyBhZGQgYXQgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIGFkZChpZCwgZmllbGRzKTtcbiAgICB9KTtcbiAgfVxufSk7XG5cblxudmFyIG5leHRPYnNlcnZlSGFuZGxlSWQgPSAxO1xuXG4vLyBXaGVuIHRoZSBjYWxsYmFja3MgZG8gbm90IG11dGF0ZSB0aGUgYXJndW1lbnRzLCB3ZSBjYW4gc2tpcCBhIGxvdCBvZiBkYXRhIGNsb25lc1xuT2JzZXJ2ZUhhbmRsZSA9IGZ1bmN0aW9uIChtdWx0aXBsZXhlciwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcyA9IGZhbHNlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgLy8gVGhlIGVuZCB1c2VyIGlzIG9ubHkgc3VwcG9zZWQgdG8gY2FsbCBzdG9wKCkuICBUaGUgb3RoZXIgZmllbGRzIGFyZVxuICAvLyBhY2Nlc3NpYmxlIHRvIHRoZSBtdWx0aXBsZXhlciwgdGhvdWdoLlxuICBzZWxmLl9tdWx0aXBsZXhlciA9IG11bHRpcGxleGVyO1xuICBfLmVhY2gobXVsdGlwbGV4ZXIuY2FsbGJhY2tOYW1lcygpLCBmdW5jdGlvbiAobmFtZSkge1xuICAgIGlmIChjYWxsYmFja3NbbmFtZV0pIHtcbiAgICAgIHNlbGZbJ18nICsgbmFtZV0gPSBjYWxsYmFja3NbbmFtZV07XG4gICAgfSBlbHNlIGlmIChuYW1lID09PSBcImFkZGVkQmVmb3JlXCIgJiYgY2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAvLyBTcGVjaWFsIGNhc2U6IGlmIHlvdSBzcGVjaWZ5IFwiYWRkZWRcIiBhbmQgXCJtb3ZlZEJlZm9yZVwiLCB5b3UgZ2V0IGFuXG4gICAgICAvLyBvcmRlcmVkIG9ic2VydmUgd2hlcmUgZm9yIHNvbWUgcmVhc29uIHlvdSBkb24ndCBnZXQgb3JkZXJpbmcgZGF0YSBvblxuICAgICAgLy8gdGhlIGFkZHMuICBJIGR1bm5vLCB3ZSB3cm90ZSB0ZXN0cyBmb3IgaXQsIHRoZXJlIG11c3QgaGF2ZSBiZWVuIGFcbiAgICAgIC8vIHJlYXNvbi5cbiAgICAgIHNlbGYuX2FkZGVkQmVmb3JlID0gZnVuY3Rpb24gKGlkLCBmaWVsZHMsIGJlZm9yZSkge1xuICAgICAgICBjYWxsYmFja3MuYWRkZWQoaWQsIGZpZWxkcyk7XG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG4gIHNlbGYuX3N0b3BwZWQgPSBmYWxzZTtcbiAgc2VsZi5faWQgPSBuZXh0T2JzZXJ2ZUhhbmRsZUlkKys7XG4gIHNlbGYubm9uTXV0YXRpbmdDYWxsYmFja3MgPSBub25NdXRhdGluZ0NhbGxiYWNrcztcbn07XG5PYnNlcnZlSGFuZGxlLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgIHJldHVybjtcbiAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG4gIHNlbGYuX211bHRpcGxleGVyLnJlbW92ZUhhbmRsZShzZWxmLl9pZCk7XG59O1xuIiwidmFyIEZpYmVyID0gTnBtLnJlcXVpcmUoJ2ZpYmVycycpO1xuXG5leHBvcnQgY2xhc3MgRG9jRmV0Y2hlciB7XG4gIGNvbnN0cnVjdG9yKG1vbmdvQ29ubmVjdGlvbikge1xuICAgIHRoaXMuX21vbmdvQ29ubmVjdGlvbiA9IG1vbmdvQ29ubmVjdGlvbjtcbiAgICAvLyBNYXAgZnJvbSBvcCAtPiBbY2FsbGJhY2tdXG4gICAgdGhpcy5fY2FsbGJhY2tzRm9yT3AgPSBuZXcgTWFwO1xuICB9XG5cbiAgLy8gRmV0Y2hlcyBkb2N1bWVudCBcImlkXCIgZnJvbSBjb2xsZWN0aW9uTmFtZSwgcmV0dXJuaW5nIGl0IG9yIG51bGwgaWYgbm90XG4gIC8vIGZvdW5kLlxuICAvL1xuICAvLyBJZiB5b3UgbWFrZSBtdWx0aXBsZSBjYWxscyB0byBmZXRjaCgpIHdpdGggdGhlIHNhbWUgb3AgcmVmZXJlbmNlLFxuICAvLyBEb2NGZXRjaGVyIG1heSBhc3N1bWUgdGhhdCB0aGV5IGFsbCByZXR1cm4gdGhlIHNhbWUgZG9jdW1lbnQuIChJdCBkb2VzXG4gIC8vIG5vdCBjaGVjayB0byBzZWUgaWYgY29sbGVjdGlvbk5hbWUvaWQgbWF0Y2guKVxuICAvL1xuICAvLyBZb3UgbWF5IGFzc3VtZSB0aGF0IGNhbGxiYWNrIGlzIG5ldmVyIGNhbGxlZCBzeW5jaHJvbm91c2x5IChhbmQgaW4gZmFjdFxuICAvLyBPcGxvZ09ic2VydmVEcml2ZXIgZG9lcyBzbykuXG4gIGZldGNoKGNvbGxlY3Rpb25OYW1lLCBpZCwgb3AsIGNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjaGVjayhjb2xsZWN0aW9uTmFtZSwgU3RyaW5nKTtcbiAgICBjaGVjayhvcCwgT2JqZWN0KTtcblxuICAgIC8vIElmIHRoZXJlJ3MgYWxyZWFkeSBhbiBpbi1wcm9ncmVzcyBmZXRjaCBmb3IgdGhpcyBjYWNoZSBrZXksIHlpZWxkIHVudGlsXG4gICAgLy8gaXQncyBkb25lIGFuZCByZXR1cm4gd2hhdGV2ZXIgaXQgcmV0dXJucy5cbiAgICBpZiAoc2VsZi5fY2FsbGJhY2tzRm9yT3AuaGFzKG9wKSkge1xuICAgICAgc2VsZi5fY2FsbGJhY2tzRm9yT3AuZ2V0KG9wKS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjYWxsYmFja3MgPSBbY2FsbGJhY2tdO1xuICAgIHNlbGYuX2NhbGxiYWNrc0Zvck9wLnNldChvcCwgY2FsbGJhY2tzKTtcblxuICAgIEZpYmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBkb2MgPSBzZWxmLl9tb25nb0Nvbm5lY3Rpb24uZmluZE9uZShcbiAgICAgICAgICBjb2xsZWN0aW9uTmFtZSwge19pZDogaWR9KSB8fCBudWxsO1xuICAgICAgICAvLyBSZXR1cm4gZG9jIHRvIGFsbCByZWxldmFudCBjYWxsYmFja3MuIE5vdGUgdGhhdCB0aGlzIGFycmF5IGNhblxuICAgICAgICAvLyBjb250aW51ZSB0byBncm93IGR1cmluZyBjYWxsYmFjayBleGNlY3V0aW9uLlxuICAgICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAvLyBDbG9uZSB0aGUgZG9jdW1lbnQgc28gdGhhdCB0aGUgdmFyaW91cyBjYWxscyB0byBmZXRjaCBkb24ndCByZXR1cm5cbiAgICAgICAgICAvLyBvYmplY3RzIHRoYXQgYXJlIGludGVydHdpbmdsZWQgd2l0aCBlYWNoIG90aGVyLiBDbG9uZSBiZWZvcmVcbiAgICAgICAgICAvLyBwb3BwaW5nIHRoZSBmdXR1cmUsIHNvIHRoYXQgaWYgY2xvbmUgdGhyb3dzLCB0aGUgZXJyb3IgZ2V0cyBwYXNzZWRcbiAgICAgICAgICAvLyB0byB0aGUgbmV4dCBjYWxsYmFjay5cbiAgICAgICAgICBjYWxsYmFja3MucG9wKCkobnVsbCwgRUpTT04uY2xvbmUoZG9jKSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgd2hpbGUgKGNhbGxiYWNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2FsbGJhY2tzLnBvcCgpKGUpO1xuICAgICAgICB9XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICAvLyBYWFggY29uc2lkZXIga2VlcGluZyB0aGUgZG9jIGFyb3VuZCBmb3IgYSBwZXJpb2Qgb2YgdGltZSBiZWZvcmVcbiAgICAgICAgLy8gcmVtb3ZpbmcgZnJvbSB0aGUgY2FjaGVcbiAgICAgICAgc2VsZi5fY2FsbGJhY2tzRm9yT3AuZGVsZXRlKG9wKTtcbiAgICAgIH1cbiAgICB9KS5ydW4oKTtcbiAgfVxufVxuIiwidmFyIFBPTExJTkdfVEhST1RUTEVfTVMgPSArcHJvY2Vzcy5lbnYuTUVURU9SX1BPTExJTkdfVEhST1RUTEVfTVMgfHwgNTA7XG52YXIgUE9MTElOR19JTlRFUlZBTF9NUyA9ICtwcm9jZXNzLmVudi5NRVRFT1JfUE9MTElOR19JTlRFUlZBTF9NUyB8fCAxMCAqIDEwMDA7XG5cblBvbGxpbmdPYnNlcnZlRHJpdmVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uID0gb3B0aW9ucy5jdXJzb3JEZXNjcmlwdGlvbjtcbiAgc2VsZi5fbW9uZ29IYW5kbGUgPSBvcHRpb25zLm1vbmdvSGFuZGxlO1xuICBzZWxmLl9vcmRlcmVkID0gb3B0aW9ucy5vcmRlcmVkO1xuICBzZWxmLl9tdWx0aXBsZXhlciA9IG9wdGlvbnMubXVsdGlwbGV4ZXI7XG4gIHNlbGYuX3N0b3BDYWxsYmFja3MgPSBbXTtcbiAgc2VsZi5fc3RvcHBlZCA9IGZhbHNlO1xuXG4gIHNlbGYuX3N5bmNocm9ub3VzQ3Vyc29yID0gc2VsZi5fbW9uZ29IYW5kbGUuX2NyZWF0ZVN5bmNocm9ub3VzQ3Vyc29yKFxuICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKTtcblxuICAvLyBwcmV2aW91cyByZXN1bHRzIHNuYXBzaG90LiAgb24gZWFjaCBwb2xsIGN5Y2xlLCBkaWZmcyBhZ2FpbnN0XG4gIC8vIHJlc3VsdHMgZHJpdmVzIHRoZSBjYWxsYmFja3MuXG4gIHNlbGYuX3Jlc3VsdHMgPSBudWxsO1xuXG4gIC8vIFRoZSBudW1iZXIgb2YgX3BvbGxNb25nbyBjYWxscyB0aGF0IGhhdmUgYmVlbiBhZGRlZCB0byBzZWxmLl90YXNrUXVldWUgYnV0XG4gIC8vIGhhdmUgbm90IHN0YXJ0ZWQgcnVubmluZy4gVXNlZCB0byBtYWtlIHN1cmUgd2UgbmV2ZXIgc2NoZWR1bGUgbW9yZSB0aGFuIG9uZVxuICAvLyBfcG9sbE1vbmdvIChvdGhlciB0aGFuIHBvc3NpYmx5IHRoZSBvbmUgdGhhdCBpcyBjdXJyZW50bHkgcnVubmluZykuIEl0J3NcbiAgLy8gYWxzbyB1c2VkIGJ5IF9zdXNwZW5kUG9sbGluZyB0byBwcmV0ZW5kIHRoZXJlJ3MgYSBwb2xsIHNjaGVkdWxlZC4gVXN1YWxseSxcbiAgLy8gaXQncyBlaXRoZXIgMCAoZm9yIFwibm8gcG9sbHMgc2NoZWR1bGVkIG90aGVyIHRoYW4gbWF5YmUgb25lIGN1cnJlbnRseVxuICAvLyBydW5uaW5nXCIpIG9yIDEgKGZvciBcImEgcG9sbCBzY2hlZHVsZWQgdGhhdCBpc24ndCBydW5uaW5nIHlldFwiKSwgYnV0IGl0IGNhblxuICAvLyBhbHNvIGJlIDIgaWYgaW5jcmVtZW50ZWQgYnkgX3N1c3BlbmRQb2xsaW5nLlxuICBzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgPSAwO1xuICBzZWxmLl9wZW5kaW5nV3JpdGVzID0gW107IC8vIHBlb3BsZSB0byBub3RpZnkgd2hlbiBwb2xsaW5nIGNvbXBsZXRlc1xuXG4gIC8vIE1ha2Ugc3VyZSB0byBjcmVhdGUgYSBzZXBhcmF0ZWx5IHRocm90dGxlZCBmdW5jdGlvbiBmb3IgZWFjaFxuICAvLyBQb2xsaW5nT2JzZXJ2ZURyaXZlciBvYmplY3QuXG4gIHNlbGYuX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCA9IF8udGhyb3R0bGUoXG4gICAgc2VsZi5fdW50aHJvdHRsZWRFbnN1cmVQb2xsSXNTY2hlZHVsZWQsXG4gICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5wb2xsaW5nVGhyb3R0bGVNcyB8fCBQT0xMSU5HX1RIUk9UVExFX01TIC8qIG1zICovKTtcblxuICAvLyBYWFggZmlndXJlIG91dCBpZiB3ZSBzdGlsbCBuZWVkIGEgcXVldWVcbiAgc2VsZi5fdGFza1F1ZXVlID0gbmV3IE1ldGVvci5fU3luY2hyb25vdXNRdWV1ZSgpO1xuXG4gIHZhciBsaXN0ZW5lcnNIYW5kbGUgPSBsaXN0ZW5BbGwoXG4gICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24sIGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgICAgIC8vIFdoZW4gc29tZW9uZSBkb2VzIGEgdHJhbnNhY3Rpb24gdGhhdCBtaWdodCBhZmZlY3QgdXMsIHNjaGVkdWxlIGEgcG9sbFxuICAgICAgLy8gb2YgdGhlIGRhdGFiYXNlLiBJZiB0aGF0IHRyYW5zYWN0aW9uIGhhcHBlbnMgaW5zaWRlIG9mIGEgd3JpdGUgZmVuY2UsXG4gICAgICAvLyBibG9jayB0aGUgZmVuY2UgdW50aWwgd2UndmUgcG9sbGVkIGFuZCBub3RpZmllZCBvYnNlcnZlcnMuXG4gICAgICB2YXIgZmVuY2UgPSBERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlLmdldCgpO1xuICAgICAgaWYgKGZlbmNlKVxuICAgICAgICBzZWxmLl9wZW5kaW5nV3JpdGVzLnB1c2goZmVuY2UuYmVnaW5Xcml0ZSgpKTtcbiAgICAgIC8vIEVuc3VyZSBhIHBvbGwgaXMgc2NoZWR1bGVkLi4uIGJ1dCBpZiB3ZSBhbHJlYWR5IGtub3cgdGhhdCBvbmUgaXMsXG4gICAgICAvLyBkb24ndCBoaXQgdGhlIHRocm90dGxlZCBfZW5zdXJlUG9sbElzU2NoZWR1bGVkIGZ1bmN0aW9uICh3aGljaCBtaWdodFxuICAgICAgLy8gbGVhZCB0byB1cyBjYWxsaW5nIGl0IHVubmVjZXNzYXJpbHkgaW4gPHBvbGxpbmdUaHJvdHRsZU1zPiBtcykuXG4gICAgICBpZiAoc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID09PSAwKVxuICAgICAgICBzZWxmLl9lbnN1cmVQb2xsSXNTY2hlZHVsZWQoKTtcbiAgICB9XG4gICk7XG4gIHNlbGYuX3N0b3BDYWxsYmFja3MucHVzaChmdW5jdGlvbiAoKSB7IGxpc3RlbmVyc0hhbmRsZS5zdG9wKCk7IH0pO1xuXG4gIC8vIGV2ZXJ5IG9uY2UgYW5kIGEgd2hpbGUsIHBvbGwgZXZlbiBpZiB3ZSBkb24ndCB0aGluayB3ZSdyZSBkaXJ0eSwgZm9yXG4gIC8vIGV2ZW50dWFsIGNvbnNpc3RlbmN5IHdpdGggZGF0YWJhc2Ugd3JpdGVzIGZyb20gb3V0c2lkZSB0aGUgTWV0ZW9yXG4gIC8vIHVuaXZlcnNlLlxuICAvL1xuICAvLyBGb3IgdGVzdGluZywgdGhlcmUncyBhbiB1bmRvY3VtZW50ZWQgY2FsbGJhY2sgYXJndW1lbnQgdG8gb2JzZXJ2ZUNoYW5nZXNcbiAgLy8gd2hpY2ggZGlzYWJsZXMgdGltZS1iYXNlZCBwb2xsaW5nIGFuZCBnZXRzIGNhbGxlZCBhdCB0aGUgYmVnaW5uaW5nIG9mIGVhY2hcbiAgLy8gcG9sbC5cbiAgaWYgKG9wdGlvbnMuX3Rlc3RPbmx5UG9sbENhbGxiYWNrKSB7XG4gICAgc2VsZi5fdGVzdE9ubHlQb2xsQ2FsbGJhY2sgPSBvcHRpb25zLl90ZXN0T25seVBvbGxDYWxsYmFjaztcbiAgfSBlbHNlIHtcbiAgICB2YXIgcG9sbGluZ0ludGVydmFsID1cbiAgICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnBvbGxpbmdJbnRlcnZhbE1zIHx8XG4gICAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5fcG9sbGluZ0ludGVydmFsIHx8IC8vIENPTVBBVCB3aXRoIDEuMlxuICAgICAgICAgIFBPTExJTkdfSU5URVJWQUxfTVM7XG4gICAgdmFyIGludGVydmFsSGFuZGxlID0gTWV0ZW9yLnNldEludGVydmFsKFxuICAgICAgXy5iaW5kKHNlbGYuX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCwgc2VsZiksIHBvbGxpbmdJbnRlcnZhbCk7XG4gICAgc2VsZi5fc3RvcENhbGxiYWNrcy5wdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgIE1ldGVvci5jbGVhckludGVydmFsKGludGVydmFsSGFuZGxlKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSB3ZSBhY3R1YWxseSBwb2xsIHNvb24hXG4gIHNlbGYuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkKCk7XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAxKTtcbn07XG5cbl8uZXh0ZW5kKFBvbGxpbmdPYnNlcnZlRHJpdmVyLnByb3RvdHlwZSwge1xuICAvLyBUaGlzIGlzIGFsd2F5cyBjYWxsZWQgdGhyb3VnaCBfLnRocm90dGxlIChleGNlcHQgb25jZSBhdCBzdGFydHVwKS5cbiAgX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgPiAwKVxuICAgICAgcmV0dXJuO1xuICAgICsrc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuICAgIHNlbGYuX3Rhc2tRdWV1ZS5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fcG9sbE1vbmdvKCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gdGVzdC1vbmx5IGludGVyZmFjZSBmb3IgY29udHJvbGxpbmcgcG9sbGluZy5cbiAgLy9cbiAgLy8gX3N1c3BlbmRQb2xsaW5nIGJsb2NrcyB1bnRpbCBhbnkgY3VycmVudGx5IHJ1bm5pbmcgYW5kIHNjaGVkdWxlZCBwb2xscyBhcmVcbiAgLy8gZG9uZSwgYW5kIHByZXZlbnRzIGFueSBmdXJ0aGVyIHBvbGxzIGZyb20gYmVpbmcgc2NoZWR1bGVkLiAobmV3XG4gIC8vIE9ic2VydmVIYW5kbGVzIGNhbiBiZSBhZGRlZCBhbmQgcmVjZWl2ZSB0aGVpciBpbml0aWFsIGFkZGVkIGNhbGxiYWNrcyxcbiAgLy8gdGhvdWdoLilcbiAgLy9cbiAgLy8gX3Jlc3VtZVBvbGxpbmcgaW1tZWRpYXRlbHkgcG9sbHMsIGFuZCBhbGxvd3MgZnVydGhlciBwb2xscyB0byBvY2N1ci5cbiAgX3N1c3BlbmRQb2xsaW5nOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJldGVuZCB0aGF0IHRoZXJlJ3MgYW5vdGhlciBwb2xsIHNjaGVkdWxlZCAod2hpY2ggd2lsbCBwcmV2ZW50XG4gICAgLy8gX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCBmcm9tIHF1ZXVlaW5nIGFueSBtb3JlIHBvbGxzKS5cbiAgICArK3NlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcbiAgICAvLyBOb3cgYmxvY2sgdW50aWwgYWxsIGN1cnJlbnRseSBydW5uaW5nIG9yIHNjaGVkdWxlZCBwb2xscyBhcmUgZG9uZS5cbiAgICBzZWxmLl90YXNrUXVldWUucnVuVGFzayhmdW5jdGlvbigpIHt9KTtcblxuICAgIC8vIENvbmZpcm0gdGhhdCB0aGVyZSBpcyBvbmx5IG9uZSBcInBvbGxcIiAodGhlIGZha2Ugb25lIHdlJ3JlIHByZXRlbmRpbmcgdG9cbiAgICAvLyBoYXZlKSBzY2hlZHVsZWQuXG4gICAgaWYgKHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCAhPT0gMSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgaXMgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCk7XG4gIH0sXG4gIF9yZXN1bWVQb2xsaW5nOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gV2Ugc2hvdWxkIGJlIGluIHRoZSBzYW1lIHN0YXRlIGFzIGluIHRoZSBlbmQgb2YgX3N1c3BlbmRQb2xsaW5nLlxuICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIGlzIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQpO1xuICAgIC8vIFJ1biBhIHBvbGwgc3luY2hyb25vdXNseSAod2hpY2ggd2lsbCBjb3VudGVyYWN0IHRoZVxuICAgIC8vICsrX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCBmcm9tIF9zdXNwZW5kUG9sbGluZykuXG4gICAgc2VsZi5fdGFza1F1ZXVlLnJ1blRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fcG9sbE1vbmdvKCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgX3BvbGxNb25nbzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAtLXNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIGZpcnN0ID0gZmFsc2U7XG4gICAgdmFyIG5ld1Jlc3VsdHM7XG4gICAgdmFyIG9sZFJlc3VsdHMgPSBzZWxmLl9yZXN1bHRzO1xuICAgIGlmICghb2xkUmVzdWx0cykge1xuICAgICAgZmlyc3QgPSB0cnVlO1xuICAgICAgLy8gWFhYIG1heWJlIHVzZSBPcmRlcmVkRGljdCBpbnN0ZWFkP1xuICAgICAgb2xkUmVzdWx0cyA9IHNlbGYuX29yZGVyZWQgPyBbXSA6IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgIH1cblxuICAgIHNlbGYuX3Rlc3RPbmx5UG9sbENhbGxiYWNrICYmIHNlbGYuX3Rlc3RPbmx5UG9sbENhbGxiYWNrKCk7XG5cbiAgICAvLyBTYXZlIHRoZSBsaXN0IG9mIHBlbmRpbmcgd3JpdGVzIHdoaWNoIHRoaXMgcm91bmQgd2lsbCBjb21taXQuXG4gICAgdmFyIHdyaXRlc0ZvckN5Y2xlID0gc2VsZi5fcGVuZGluZ1dyaXRlcztcbiAgICBzZWxmLl9wZW5kaW5nV3JpdGVzID0gW107XG5cbiAgICAvLyBHZXQgdGhlIG5ldyBxdWVyeSByZXN1bHRzLiAoVGhpcyB5aWVsZHMuKVxuICAgIHRyeSB7XG4gICAgICBuZXdSZXN1bHRzID0gc2VsZi5fc3luY2hyb25vdXNDdXJzb3IuZ2V0UmF3T2JqZWN0cyhzZWxmLl9vcmRlcmVkKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZmlyc3QgJiYgdHlwZW9mKGUuY29kZSkgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYW4gZXJyb3IgZG9jdW1lbnQgc2VudCB0byB1cyBieSBtb25nb2QsIG5vdCBhIGNvbm5lY3Rpb25cbiAgICAgICAgLy8gZXJyb3IgZ2VuZXJhdGVkIGJ5IHRoZSBjbGllbnQuIEFuZCB3ZSd2ZSBuZXZlciBzZWVuIHRoaXMgcXVlcnkgd29ya1xuICAgICAgICAvLyBzdWNjZXNzZnVsbHkuIFByb2JhYmx5IGl0J3MgYSBiYWQgc2VsZWN0b3Igb3Igc29tZXRoaW5nLCBzbyB3ZSBzaG91bGRcbiAgICAgICAgLy8gTk9UIHJldHJ5LiBJbnN0ZWFkLCB3ZSBzaG91bGQgaGFsdCB0aGUgb2JzZXJ2ZSAod2hpY2ggZW5kcyB1cCBjYWxsaW5nXG4gICAgICAgIC8vIGBzdG9wYCBvbiB1cykuXG4gICAgICAgIHNlbGYuX211bHRpcGxleGVyLnF1ZXJ5RXJyb3IoXG4gICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgXCJFeGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeSBcIiArXG4gICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKSArIFwiOiBcIiArIGUubWVzc2FnZSkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIGdldFJhd09iamVjdHMgY2FuIHRocm93IGlmIHdlJ3JlIGhhdmluZyB0cm91YmxlIHRhbGtpbmcgdG8gdGhlXG4gICAgICAvLyBkYXRhYmFzZS4gIFRoYXQncyBmaW5lIC0tLSB3ZSB3aWxsIHJlcG9sbCBsYXRlciBhbnl3YXkuIEJ1dCB3ZSBzaG91bGRcbiAgICAgIC8vIG1ha2Ugc3VyZSBub3QgdG8gbG9zZSB0cmFjayBvZiB0aGlzIGN5Y2xlJ3Mgd3JpdGVzLlxuICAgICAgLy8gKEl0IGFsc28gY2FuIHRocm93IGlmIHRoZXJlJ3MganVzdCBzb21ldGhpbmcgaW52YWxpZCBhYm91dCB0aGlzIHF1ZXJ5O1xuICAgICAgLy8gdW5mb3J0dW5hdGVseSB0aGUgT2JzZXJ2ZURyaXZlciBBUEkgZG9lc24ndCBwcm92aWRlIGEgZ29vZCB3YXkgdG9cbiAgICAgIC8vIFwiY2FuY2VsXCIgdGhlIG9ic2VydmUgZnJvbSB0aGUgaW5zaWRlIGluIHRoaXMgY2FzZS5cbiAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHNlbGYuX3BlbmRpbmdXcml0ZXMsIHdyaXRlc0ZvckN5Y2xlKTtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJFeGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeSBcIiArXG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKSwgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUnVuIGRpZmZzLlxuICAgIGlmICghc2VsZi5fc3RvcHBlZCkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzKFxuICAgICAgICBzZWxmLl9vcmRlcmVkLCBvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBzZWxmLl9tdWx0aXBsZXhlcik7XG4gICAgfVxuXG4gICAgLy8gU2lnbmFscyB0aGUgbXVsdGlwbGV4ZXIgdG8gYWxsb3cgYWxsIG9ic2VydmVDaGFuZ2VzIGNhbGxzIHRoYXQgc2hhcmUgdGhpc1xuICAgIC8vIG11bHRpcGxleGVyIHRvIHJldHVybi4gKFRoaXMgaGFwcGVucyBhc3luY2hyb25vdXNseSwgdmlhIHRoZVxuICAgIC8vIG11bHRpcGxleGVyJ3MgcXVldWUuKVxuICAgIGlmIChmaXJzdClcbiAgICAgIHNlbGYuX211bHRpcGxleGVyLnJlYWR5KCk7XG5cbiAgICAvLyBSZXBsYWNlIHNlbGYuX3Jlc3VsdHMgYXRvbWljYWxseS4gIChUaGlzIGFzc2lnbm1lbnQgaXMgd2hhdCBtYWtlcyBgZmlyc3RgXG4gICAgLy8gc3RheSB0aHJvdWdoIG9uIHRoZSBuZXh0IGN5Y2xlLCBzbyB3ZSd2ZSB3YWl0ZWQgdW50aWwgYWZ0ZXIgd2UndmVcbiAgICAvLyBjb21taXR0ZWQgdG8gcmVhZHktaW5nIHRoZSBtdWx0aXBsZXhlci4pXG4gICAgc2VsZi5fcmVzdWx0cyA9IG5ld1Jlc3VsdHM7XG5cbiAgICAvLyBPbmNlIHRoZSBPYnNlcnZlTXVsdGlwbGV4ZXIgaGFzIHByb2Nlc3NlZCBldmVyeXRoaW5nIHdlJ3ZlIGRvbmUgaW4gdGhpc1xuICAgIC8vIHJvdW5kLCBtYXJrIGFsbCB0aGUgd3JpdGVzIHdoaWNoIGV4aXN0ZWQgYmVmb3JlIHRoaXMgY2FsbCBhc1xuICAgIC8vIGNvbW1taXR0ZWQuIChJZiBuZXcgd3JpdGVzIGhhdmUgc2hvd24gdXAgaW4gdGhlIG1lYW50aW1lLCB0aGVyZSdsbFxuICAgIC8vIGFscmVhZHkgYmUgYW5vdGhlciBfcG9sbE1vbmdvIHRhc2sgc2NoZWR1bGVkLilcbiAgICBzZWxmLl9tdWx0aXBsZXhlci5vbkZsdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgIF8uZWFjaCh3cml0ZXNGb3JDeWNsZSwgZnVuY3Rpb24gKHcpIHtcbiAgICAgICAgdy5jb21taXR0ZWQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG4gICAgXy5lYWNoKHNlbGYuX3N0b3BDYWxsYmFja3MsIGZ1bmN0aW9uIChjKSB7IGMoKTsgfSk7XG4gICAgLy8gUmVsZWFzZSBhbnkgd3JpdGUgZmVuY2VzIHRoYXQgYXJlIHdhaXRpbmcgb24gdXMuXG4gICAgXy5lYWNoKHNlbGYuX3BlbmRpbmdXcml0ZXMsIGZ1bmN0aW9uICh3KSB7XG4gICAgICB3LmNvbW1pdHRlZCgpO1xuICAgIH0pO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAtMSk7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IHsgb3Bsb2dWMlYxQ29udmVydGVyIH0gZnJvbSBcIi4vb3Bsb2dfdjJfY29udmVydGVyXCI7XG5cbnZhciBGdXR1cmUgPSBOcG0ucmVxdWlyZSgnZmliZXJzL2Z1dHVyZScpO1xuXG52YXIgUEhBU0UgPSB7XG4gIFFVRVJZSU5HOiBcIlFVRVJZSU5HXCIsXG4gIEZFVENISU5HOiBcIkZFVENISU5HXCIsXG4gIFNURUFEWTogXCJTVEVBRFlcIlxufTtcblxuLy8gRXhjZXB0aW9uIHRocm93biBieSBfbmVlZFRvUG9sbFF1ZXJ5IHdoaWNoIHVucm9sbHMgdGhlIHN0YWNrIHVwIHRvIHRoZVxuLy8gZW5jbG9zaW5nIGNhbGwgdG8gZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkuXG52YXIgU3dpdGNoZWRUb1F1ZXJ5ID0gZnVuY3Rpb24gKCkge307XG52YXIgZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkgPSBmdW5jdGlvbiAoZikge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICBmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIFN3aXRjaGVkVG9RdWVyeSkpXG4gICAgICAgIHRocm93IGU7XG4gICAgfVxuICB9O1xufTtcblxudmFyIGN1cnJlbnRJZCA9IDA7XG5cbi8vIE9wbG9nT2JzZXJ2ZURyaXZlciBpcyBhbiBhbHRlcm5hdGl2ZSB0byBQb2xsaW5nT2JzZXJ2ZURyaXZlciB3aGljaCBmb2xsb3dzXG4vLyB0aGUgTW9uZ28gb3BlcmF0aW9uIGxvZyBpbnN0ZWFkIG9mIGp1c3QgcmUtcG9sbGluZyB0aGUgcXVlcnkuIEl0IG9iZXlzIHRoZVxuLy8gc2FtZSBzaW1wbGUgaW50ZXJmYWNlOiBjb25zdHJ1Y3RpbmcgaXQgc3RhcnRzIHNlbmRpbmcgb2JzZXJ2ZUNoYW5nZXNcbi8vIGNhbGxiYWNrcyAoYW5kIGEgcmVhZHkoKSBpbnZvY2F0aW9uKSB0byB0aGUgT2JzZXJ2ZU11bHRpcGxleGVyLCBhbmQgeW91IHN0b3Bcbi8vIGl0IGJ5IGNhbGxpbmcgdGhlIHN0b3AoKSBtZXRob2QuXG5PcGxvZ09ic2VydmVEcml2ZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuX3VzZXNPcGxvZyA9IHRydWU7ICAvLyB0ZXN0cyBsb29rIGF0IHRoaXNcblxuICBzZWxmLl9pZCA9IGN1cnJlbnRJZDtcbiAgY3VycmVudElkKys7XG5cbiAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24gPSBvcHRpb25zLmN1cnNvckRlc2NyaXB0aW9uO1xuICBzZWxmLl9tb25nb0hhbmRsZSA9IG9wdGlvbnMubW9uZ29IYW5kbGU7XG4gIHNlbGYuX211bHRpcGxleGVyID0gb3B0aW9ucy5tdWx0aXBsZXhlcjtcblxuICBpZiAob3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJPcGxvZ09ic2VydmVEcml2ZXIgb25seSBzdXBwb3J0cyB1bm9yZGVyZWQgb2JzZXJ2ZUNoYW5nZXNcIik7XG4gIH1cblxuICB2YXIgc29ydGVyID0gb3B0aW9ucy5zb3J0ZXI7XG4gIC8vIFdlIGRvbid0IHN1cHBvcnQgJG5lYXIgYW5kIG90aGVyIGdlby1xdWVyaWVzIHNvIGl0J3MgT0sgdG8gaW5pdGlhbGl6ZSB0aGVcbiAgLy8gY29tcGFyYXRvciBvbmx5IG9uY2UgaW4gdGhlIGNvbnN0cnVjdG9yLlxuICB2YXIgY29tcGFyYXRvciA9IHNvcnRlciAmJiBzb3J0ZXIuZ2V0Q29tcGFyYXRvcigpO1xuXG4gIGlmIChvcHRpb25zLmN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMubGltaXQpIHtcbiAgICAvLyBUaGVyZSBhcmUgc2V2ZXJhbCBwcm9wZXJ0aWVzIG9yZGVyZWQgZHJpdmVyIGltcGxlbWVudHM6XG4gICAgLy8gLSBfbGltaXQgaXMgYSBwb3NpdGl2ZSBudW1iZXJcbiAgICAvLyAtIF9jb21wYXJhdG9yIGlzIGEgZnVuY3Rpb24tY29tcGFyYXRvciBieSB3aGljaCB0aGUgcXVlcnkgaXMgb3JkZXJlZFxuICAgIC8vIC0gX3VucHVibGlzaGVkQnVmZmVyIGlzIG5vbi1udWxsIE1pbi9NYXggSGVhcCxcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICB0aGUgZW1wdHkgYnVmZmVyIGluIFNURUFEWSBwaGFzZSBpbXBsaWVzIHRoYXQgdGhlXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgZXZlcnl0aGluZyB0aGF0IG1hdGNoZXMgdGhlIHF1ZXJpZXMgc2VsZWN0b3IgZml0c1xuICAgIC8vICAgICAgICAgICAgICAgICAgICAgIGludG8gcHVibGlzaGVkIHNldC5cbiAgICAvLyAtIF9wdWJsaXNoZWQgLSBNYXggSGVhcCAoYWxzbyBpbXBsZW1lbnRzIElkTWFwIG1ldGhvZHMpXG5cbiAgICB2YXIgaGVhcE9wdGlvbnMgPSB7IElkTWFwOiBMb2NhbENvbGxlY3Rpb24uX0lkTWFwIH07XG4gICAgc2VsZi5fbGltaXQgPSBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmxpbWl0O1xuICAgIHNlbGYuX2NvbXBhcmF0b3IgPSBjb21wYXJhdG9yO1xuICAgIHNlbGYuX3NvcnRlciA9IHNvcnRlcjtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG5ldyBNaW5NYXhIZWFwKGNvbXBhcmF0b3IsIGhlYXBPcHRpb25zKTtcbiAgICAvLyBXZSBuZWVkIHNvbWV0aGluZyB0aGF0IGNhbiBmaW5kIE1heCB2YWx1ZSBpbiBhZGRpdGlvbiB0byBJZE1hcCBpbnRlcmZhY2VcbiAgICBzZWxmLl9wdWJsaXNoZWQgPSBuZXcgTWF4SGVhcChjb21wYXJhdG9yLCBoZWFwT3B0aW9ucyk7XG4gIH0gZWxzZSB7XG4gICAgc2VsZi5fbGltaXQgPSAwO1xuICAgIHNlbGYuX2NvbXBhcmF0b3IgPSBudWxsO1xuICAgIHNlbGYuX3NvcnRlciA9IG51bGw7XG4gICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgPSBudWxsO1xuICAgIHNlbGYuX3B1Ymxpc2hlZCA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgLy8gSW5kaWNhdGVzIGlmIGl0IGlzIHNhZmUgdG8gaW5zZXJ0IGEgbmV3IGRvY3VtZW50IGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICAvLyBmb3IgdGhpcyBxdWVyeS4gaS5lLiBpdCBpcyBrbm93biB0aGF0IHRoZXJlIGFyZSBubyBkb2N1bWVudHMgbWF0Y2hpbmcgdGhlXG4gIC8vIHNlbGVjdG9yIHRob3NlIGFyZSBub3QgaW4gcHVibGlzaGVkIG9yIGJ1ZmZlci5cbiAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG5cbiAgc2VsZi5fc3RvcHBlZCA9IGZhbHNlO1xuICBzZWxmLl9zdG9wSGFuZGxlcyA9IFtdO1xuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1kcml2ZXJzLW9wbG9nXCIsIDEpO1xuXG4gIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuUVVFUllJTkcpO1xuXG4gIHNlbGYuX21hdGNoZXIgPSBvcHRpb25zLm1hdGNoZXI7XG4gIC8vIHdlIGFyZSBub3cgdXNpbmcgcHJvamVjdGlvbiwgbm90IGZpZWxkcyBpbiB0aGUgY3Vyc29yIGRlc2NyaXB0aW9uIGV2ZW4gaWYgeW91IHBhc3Mge2ZpZWxkc31cbiAgLy8gaW4gdGhlIGN1cnNvciBjb25zdHJ1Y3Rpb25cbiAgdmFyIHByb2plY3Rpb24gPSBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmZpZWxkcyB8fCBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnByb2plY3Rpb24gfHwge307XG4gIHNlbGYuX3Byb2plY3Rpb25GbiA9IExvY2FsQ29sbGVjdGlvbi5fY29tcGlsZVByb2plY3Rpb24ocHJvamVjdGlvbik7XG4gIC8vIFByb2plY3Rpb24gZnVuY3Rpb24sIHJlc3VsdCBvZiBjb21iaW5pbmcgaW1wb3J0YW50IGZpZWxkcyBmb3Igc2VsZWN0b3IgYW5kXG4gIC8vIGV4aXN0aW5nIGZpZWxkcyBwcm9qZWN0aW9uXG4gIHNlbGYuX3NoYXJlZFByb2plY3Rpb24gPSBzZWxmLl9tYXRjaGVyLmNvbWJpbmVJbnRvUHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgaWYgKHNvcnRlcilcbiAgICBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uID0gc29ydGVyLmNvbWJpbmVJbnRvUHJvamVjdGlvbihzZWxmLl9zaGFyZWRQcm9qZWN0aW9uKTtcbiAgc2VsZi5fc2hhcmVkUHJvamVjdGlvbkZuID0gTG9jYWxDb2xsZWN0aW9uLl9jb21waWxlUHJvamVjdGlvbihcbiAgICBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uKTtcblxuICBzZWxmLl9uZWVkVG9GZXRjaCA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IG51bGw7XG4gIHNlbGYuX2ZldGNoR2VuZXJhdGlvbiA9IDA7XG5cbiAgc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5ID0gZmFsc2U7XG4gIHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkgPSBbXTtcblxuICAvLyBJZiB0aGUgb3Bsb2cgaGFuZGxlIHRlbGxzIHVzIHRoYXQgaXQgc2tpcHBlZCBzb21lIGVudHJpZXMgKGJlY2F1c2UgaXQgZ290XG4gIC8vIGJlaGluZCwgc2F5KSwgcmUtcG9sbC5cbiAgc2VsZi5fc3RvcEhhbmRsZXMucHVzaChzZWxmLl9tb25nb0hhbmRsZS5fb3Bsb2dIYW5kbGUub25Ta2lwcGVkRW50cmllcyhcbiAgICBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICB9KVxuICApKTtcblxuICBmb3JFYWNoVHJpZ2dlcihzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKHRyaWdnZXIpIHtcbiAgICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vbk9wbG9nRW50cnkoXG4gICAgICB0cmlnZ2VyLCBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgb3AgPSBub3RpZmljYXRpb24ub3A7XG4gICAgICAgICAgaWYgKG5vdGlmaWNhdGlvbi5kcm9wQ29sbGVjdGlvbiB8fCBub3RpZmljYXRpb24uZHJvcERhdGFiYXNlKSB7XG4gICAgICAgICAgICAvLyBOb3RlOiB0aGlzIGNhbGwgaXMgbm90IGFsbG93ZWQgdG8gYmxvY2sgb24gYW55dGhpbmcgKGVzcGVjaWFsbHlcbiAgICAgICAgICAgIC8vIG9uIHdhaXRpbmcgZm9yIG9wbG9nIGVudHJpZXMgdG8gY2F0Y2ggdXApIGJlY2F1c2UgdGhhdCB3aWxsIGJsb2NrXG4gICAgICAgICAgICAvLyBvbk9wbG9nRW50cnkhXG4gICAgICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQWxsIG90aGVyIG9wZXJhdG9ycyBzaG91bGQgYmUgaGFuZGxlZCBkZXBlbmRpbmcgb24gcGhhc2VcbiAgICAgICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgICAgICAgc2VsZi5faGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nKG9wKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHNlbGYuX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nKG9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICApKTtcbiAgfSk7XG5cbiAgLy8gWFhYIG9yZGVyaW5nIHcuci50LiBldmVyeXRoaW5nIGVsc2U/XG4gIHNlbGYuX3N0b3BIYW5kbGVzLnB1c2gobGlzdGVuQWxsKFxuICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAvLyBJZiB3ZSdyZSBub3QgaW4gYSBwcmUtZmlyZSB3cml0ZSBmZW5jZSwgd2UgZG9uJ3QgaGF2ZSB0byBkbyBhbnl0aGluZy5cbiAgICAgIHZhciBmZW5jZSA9IEREUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2UuZ2V0KCk7XG4gICAgICBpZiAoIWZlbmNlIHx8IGZlbmNlLmZpcmVkKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycykge1xuICAgICAgICBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVyc1tzZWxmLl9pZF0gPSBzZWxmO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzID0ge307XG4gICAgICBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVyc1tzZWxmLl9pZF0gPSBzZWxmO1xuXG4gICAgICBmZW5jZS5vbkJlZm9yZUZpcmUoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZHJpdmVycyA9IGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzO1xuICAgICAgICBkZWxldGUgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnM7XG5cbiAgICAgICAgLy8gVGhpcyBmZW5jZSBjYW5ub3QgZmlyZSB1bnRpbCB3ZSd2ZSBjYXVnaHQgdXAgdG8gXCJ0aGlzIHBvaW50XCIgaW4gdGhlXG4gICAgICAgIC8vIG9wbG9nLCBhbmQgYWxsIG9ic2VydmVycyBtYWRlIGl0IGJhY2sgdG8gdGhlIHN0ZWFkeSBzdGF0ZS5cbiAgICAgICAgc2VsZi5fbW9uZ29IYW5kbGUuX29wbG9nSGFuZGxlLndhaXRVbnRpbENhdWdodFVwKCk7XG5cbiAgICAgICAgXy5lYWNoKGRyaXZlcnMsIGZ1bmN0aW9uIChkcml2ZXIpIHtcbiAgICAgICAgICBpZiAoZHJpdmVyLl9zdG9wcGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgdmFyIHdyaXRlID0gZmVuY2UuYmVnaW5Xcml0ZSgpO1xuICAgICAgICAgIGlmIChkcml2ZXIuX3BoYXNlID09PSBQSEFTRS5TVEVBRFkpIHtcbiAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGFsbCBvZiB0aGUgY2FsbGJhY2tzIGhhdmUgbWFkZSBpdCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAgLy8gbXVsdGlwbGV4ZXIgYW5kIGJlZW4gZGVsaXZlcmVkIHRvIE9ic2VydmVIYW5kbGVzIGJlZm9yZSBjb21taXR0aW5nXG4gICAgICAgICAgICAvLyB3cml0ZXMuXG4gICAgICAgICAgICBkcml2ZXIuX211bHRpcGxleGVyLm9uRmx1c2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkcml2ZXIuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkucHVzaCh3cml0ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgKSk7XG5cbiAgLy8gV2hlbiBNb25nbyBmYWlscyBvdmVyLCB3ZSBuZWVkIHRvIHJlcG9sbCB0aGUgcXVlcnksIGluIGNhc2Ugd2UgcHJvY2Vzc2VkIGFuXG4gIC8vIG9wbG9nIGVudHJ5IHRoYXQgZ290IHJvbGxlZCBiYWNrLlxuICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKHNlbGYuX21vbmdvSGFuZGxlLl9vbkZhaWxvdmVyKGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KFxuICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgIH0pKSk7XG5cbiAgLy8gR2l2ZSBfb2JzZXJ2ZUNoYW5nZXMgYSBjaGFuY2UgdG8gYWRkIHRoZSBuZXcgT2JzZXJ2ZUhhbmRsZSB0byBvdXJcbiAgLy8gbXVsdGlwbGV4ZXIsIHNvIHRoYXQgdGhlIGFkZGVkIGNhbGxzIGdldCBzdHJlYW1lZC5cbiAgTWV0ZW9yLmRlZmVyKGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9ydW5Jbml0aWFsUXVlcnkoKTtcbiAgfSkpO1xufTtcblxuXy5leHRlbmQoT3Bsb2dPYnNlcnZlRHJpdmVyLnByb3RvdHlwZSwge1xuICBfYWRkUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQsIGRvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgZmllbGRzID0gXy5jbG9uZShkb2MpO1xuICAgICAgZGVsZXRlIGZpZWxkcy5faWQ7XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuc2V0KGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4oZG9jKSk7XG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5hZGRlZChpZCwgc2VsZi5fcHJvamVjdGlvbkZuKGZpZWxkcykpO1xuXG4gICAgICAvLyBBZnRlciBhZGRpbmcgdGhpcyBkb2N1bWVudCwgdGhlIHB1Ymxpc2hlZCBzZXQgbWlnaHQgYmUgb3ZlcmZsb3dlZFxuICAgICAgLy8gKGV4Y2VlZGluZyBjYXBhY2l0eSBzcGVjaWZpZWQgYnkgbGltaXQpLiBJZiBzbywgcHVzaCB0aGUgbWF4aW11bVxuICAgICAgLy8gZWxlbWVudCB0byB0aGUgYnVmZmVyLCB3ZSBtaWdodCB3YW50IHRvIHNhdmUgaXQgaW4gbWVtb3J5IHRvIHJlZHVjZSB0aGVcbiAgICAgIC8vIGFtb3VudCBvZiBNb25nbyBsb29rdXBzIGluIHRoZSBmdXR1cmUuXG4gICAgICBpZiAoc2VsZi5fbGltaXQgJiYgc2VsZi5fcHVibGlzaGVkLnNpemUoKSA+IHNlbGYuX2xpbWl0KSB7XG4gICAgICAgIC8vIFhYWCBpbiB0aGVvcnkgdGhlIHNpemUgb2YgcHVibGlzaGVkIGlzIG5vIG1vcmUgdGhhbiBsaW1pdCsxXG4gICAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpICE9PSBzZWxmLl9saW1pdCArIDEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBZnRlciBhZGRpbmcgdG8gcHVibGlzaGVkLCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpIC0gc2VsZi5fbGltaXQpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgZG9jdW1lbnRzIGFyZSBvdmVyZmxvd2luZyB0aGUgc2V0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG92ZXJmbG93aW5nRG9jSWQgPSBzZWxmLl9wdWJsaXNoZWQubWF4RWxlbWVudElkKCk7XG4gICAgICAgIHZhciBvdmVyZmxvd2luZ0RvYyA9IHNlbGYuX3B1Ymxpc2hlZC5nZXQob3ZlcmZsb3dpbmdEb2NJZCk7XG5cbiAgICAgICAgaWYgKEVKU09OLmVxdWFscyhvdmVyZmxvd2luZ0RvY0lkLCBpZCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZG9jdW1lbnQganVzdCBhZGRlZCBpcyBvdmVyZmxvd2luZyB0aGUgcHVibGlzaGVkIHNldFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuX3B1Ymxpc2hlZC5yZW1vdmUob3ZlcmZsb3dpbmdEb2NJZCk7XG4gICAgICAgIHNlbGYuX211bHRpcGxleGVyLnJlbW92ZWQob3ZlcmZsb3dpbmdEb2NJZCk7XG4gICAgICAgIHNlbGYuX2FkZEJ1ZmZlcmVkKG92ZXJmbG93aW5nRG9jSWQsIG92ZXJmbG93aW5nRG9jKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX3JlbW92ZVB1Ymxpc2hlZDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5yZW1vdmUoaWQpO1xuICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVtb3ZlZChpZCk7XG4gICAgICBpZiAoISBzZWxmLl9saW1pdCB8fCBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID09PSBzZWxmLl9saW1pdClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLnNpemUoKSA+IHNlbGYuX2xpbWl0KVxuICAgICAgICB0aHJvdyBFcnJvcihcInNlbGYuX3B1Ymxpc2hlZCBnb3QgdG9vIGJpZ1wiKTtcblxuICAgICAgLy8gT0ssIHdlIGFyZSBwdWJsaXNoaW5nIGxlc3MgdGhhbiB0aGUgbGltaXQuIE1heWJlIHdlIHNob3VsZCBsb29rIGluIHRoZVxuICAgICAgLy8gYnVmZmVyIHRvIGZpbmQgdGhlIG5leHQgZWxlbWVudCBwYXN0IHdoYXQgd2Ugd2VyZSBwdWJsaXNoaW5nIGJlZm9yZS5cblxuICAgICAgaWYgKCFzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5lbXB0eSgpKSB7XG4gICAgICAgIC8vIFRoZXJlJ3Mgc29tZXRoaW5nIGluIHRoZSBidWZmZXI7IG1vdmUgdGhlIGZpcnN0IHRoaW5nIGluIGl0IHRvXG4gICAgICAgIC8vIF9wdWJsaXNoZWQuXG4gICAgICAgIHZhciBuZXdEb2NJZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1pbkVsZW1lbnRJZCgpO1xuICAgICAgICB2YXIgbmV3RG9jID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KG5ld0RvY0lkKTtcbiAgICAgICAgc2VsZi5fcmVtb3ZlQnVmZmVyZWQobmV3RG9jSWQpO1xuICAgICAgICBzZWxmLl9hZGRQdWJsaXNoZWQobmV3RG9jSWQsIG5ld0RvYyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlcmUncyBub3RoaW5nIGluIHRoZSBidWZmZXIuICBUaGlzIGNvdWxkIG1lYW4gb25lIG9mIGEgZmV3IHRoaW5ncy5cblxuICAgICAgLy8gKGEpIFdlIGNvdWxkIGJlIGluIHRoZSBtaWRkbGUgb2YgcmUtcnVubmluZyB0aGUgcXVlcnkgKHNwZWNpZmljYWxseSwgd2VcbiAgICAgIC8vIGNvdWxkIGJlIGluIF9wdWJsaXNoTmV3UmVzdWx0cykuIEluIHRoYXQgY2FzZSwgX3VucHVibGlzaGVkQnVmZmVyIGlzXG4gICAgICAvLyBlbXB0eSBiZWNhdXNlIHdlIGNsZWFyIGl0IGF0IHRoZSBiZWdpbm5pbmcgb2YgX3B1Ymxpc2hOZXdSZXN1bHRzLiBJblxuICAgICAgLy8gdGhpcyBjYXNlLCBvdXIgY2FsbGVyIGFscmVhZHkga25vd3MgdGhlIGVudGlyZSBhbnN3ZXIgdG8gdGhlIHF1ZXJ5IGFuZFxuICAgICAgLy8gd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZyBmYW5jeSBoZXJlLiAgSnVzdCByZXR1cm4uXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIChiKSBXZSdyZSBwcmV0dHkgY29uZmlkZW50IHRoYXQgdGhlIHVuaW9uIG9mIF9wdWJsaXNoZWQgYW5kXG4gICAgICAvLyBfdW5wdWJsaXNoZWRCdWZmZXIgY29udGFpbiBhbGwgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggc2VsZWN0b3IuIEJlY2F1c2VcbiAgICAgIC8vIF91bnB1Ymxpc2hlZEJ1ZmZlciBpcyBlbXB0eSwgdGhhdCBtZWFucyB3ZSdyZSBjb25maWRlbnQgdGhhdCBfcHVibGlzaGVkXG4gICAgICAvLyBjb250YWlucyBhbGwgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggc2VsZWN0b3IuIFNvIHdlIGhhdmUgbm90aGluZyB0byBkby5cbiAgICAgIGlmIChzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gKGMpIE1heWJlIHRoZXJlIGFyZSBvdGhlciBkb2N1bWVudHMgb3V0IHRoZXJlIHRoYXQgc2hvdWxkIGJlIGluIG91clxuICAgICAgLy8gYnVmZmVyLiBCdXQgaW4gdGhhdCBjYXNlLCB3aGVuIHdlIGVtcHRpZWQgX3VucHVibGlzaGVkQnVmZmVyIGluXG4gICAgICAvLyBfcmVtb3ZlQnVmZmVyZWQsIHdlIHNob3VsZCBoYXZlIGNhbGxlZCBfbmVlZFRvUG9sbFF1ZXJ5LCB3aGljaCB3aWxsXG4gICAgICAvLyBlaXRoZXIgcHV0IHNvbWV0aGluZyBpbiBfdW5wdWJsaXNoZWRCdWZmZXIgb3Igc2V0IF9zYWZlQXBwZW5kVG9CdWZmZXJcbiAgICAgIC8vIChvciBib3RoKSwgYW5kIGl0IHdpbGwgcHV0IHVzIGluIFFVRVJZSU5HIGZvciB0aGF0IHdob2xlIHRpbWUuIFNvIGluXG4gICAgICAvLyBmYWN0LCB3ZSBzaG91bGRuJ3QgYmUgYWJsZSB0byBnZXQgaGVyZS5cblxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQnVmZmVyIGluZXhwbGljYWJseSBlbXB0eVwiKTtcbiAgICB9KTtcbiAgfSxcbiAgX2NoYW5nZVB1Ymxpc2hlZDogZnVuY3Rpb24gKGlkLCBvbGREb2MsIG5ld0RvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuc2V0KGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4obmV3RG9jKSk7XG4gICAgICB2YXIgcHJvamVjdGVkTmV3ID0gc2VsZi5fcHJvamVjdGlvbkZuKG5ld0RvYyk7XG4gICAgICB2YXIgcHJvamVjdGVkT2xkID0gc2VsZi5fcHJvamVjdGlvbkZuKG9sZERvYyk7XG4gICAgICB2YXIgY2hhbmdlZCA9IERpZmZTZXF1ZW5jZS5tYWtlQ2hhbmdlZEZpZWxkcyhcbiAgICAgICAgcHJvamVjdGVkTmV3LCBwcm9qZWN0ZWRPbGQpO1xuICAgICAgaWYgKCFfLmlzRW1wdHkoY2hhbmdlZCkpXG4gICAgICAgIHNlbGYuX211bHRpcGxleGVyLmNoYW5nZWQoaWQsIGNoYW5nZWQpO1xuICAgIH0pO1xuICB9LFxuICBfYWRkQnVmZmVyZWQ6IGZ1bmN0aW9uIChpZCwgZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNldChpZCwgc2VsZi5fc2hhcmVkUHJvamVjdGlvbkZuKGRvYykpO1xuXG4gICAgICAvLyBJZiBzb21ldGhpbmcgaXMgb3ZlcmZsb3dpbmcgdGhlIGJ1ZmZlciwgd2UganVzdCByZW1vdmUgaXQgZnJvbSBjYWNoZVxuICAgICAgaWYgKHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSA+IHNlbGYuX2xpbWl0KSB7XG4gICAgICAgIHZhciBtYXhCdWZmZXJlZElkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCk7XG5cbiAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIucmVtb3ZlKG1heEJ1ZmZlcmVkSWQpO1xuXG4gICAgICAgIC8vIFNpbmNlIHNvbWV0aGluZyBtYXRjaGluZyBpcyByZW1vdmVkIGZyb20gY2FjaGUgKGJvdGggcHVibGlzaGVkIHNldCBhbmRcbiAgICAgICAgLy8gYnVmZmVyKSwgc2V0IGZsYWcgdG8gZmFsc2VcbiAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIC8vIElzIGNhbGxlZCBlaXRoZXIgdG8gcmVtb3ZlIHRoZSBkb2MgY29tcGxldGVseSBmcm9tIG1hdGNoaW5nIHNldCBvciB0byBtb3ZlXG4gIC8vIGl0IHRvIHRoZSBwdWJsaXNoZWQgc2V0IGxhdGVyLlxuICBfcmVtb3ZlQnVmZmVyZWQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5yZW1vdmUoaWQpO1xuICAgICAgLy8gVG8ga2VlcCB0aGUgY29udHJhY3QgXCJidWZmZXIgaXMgbmV2ZXIgZW1wdHkgaW4gU1RFQURZIHBoYXNlIHVubGVzcyB0aGVcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgbWF0Y2hpbmcgZml0cyBpbnRvIHB1Ymxpc2hlZFwiIHRydWUsIHdlIHBvbGwgZXZlcnl0aGluZyBhc1xuICAgICAgLy8gc29vbiBhcyB3ZSBzZWUgdGhlIGJ1ZmZlciBiZWNvbWluZyBlbXB0eS5cbiAgICAgIGlmICghIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSAmJiAhIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcilcbiAgICAgICAgc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgfSk7XG4gIH0sXG4gIC8vIENhbGxlZCB3aGVuIGEgZG9jdW1lbnQgaGFzIGpvaW5lZCB0aGUgXCJNYXRjaGluZ1wiIHJlc3VsdHMgc2V0LlxuICAvLyBUYWtlcyByZXNwb25zaWJpbGl0eSBvZiBrZWVwaW5nIF91bnB1Ymxpc2hlZEJ1ZmZlciBpbiBzeW5jIHdpdGggX3B1Ymxpc2hlZFxuICAvLyBhbmQgdGhlIGVmZmVjdCBvZiBsaW1pdCBlbmZvcmNlZC5cbiAgX2FkZE1hdGNoaW5nOiBmdW5jdGlvbiAoZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBpZCA9IGRvYy5faWQ7XG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkpXG4gICAgICAgIHRocm93IEVycm9yKFwidHJpZWQgdG8gYWRkIHNvbWV0aGluZyBhbHJlYWR5IHB1Ymxpc2hlZCBcIiArIGlkKTtcbiAgICAgIGlmIChzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKVxuICAgICAgICB0aHJvdyBFcnJvcihcInRyaWVkIHRvIGFkZCBzb21ldGhpbmcgYWxyZWFkeSBleGlzdGVkIGluIGJ1ZmZlciBcIiArIGlkKTtcblxuICAgICAgdmFyIGxpbWl0ID0gc2VsZi5fbGltaXQ7XG4gICAgICB2YXIgY29tcGFyYXRvciA9IHNlbGYuX2NvbXBhcmF0b3I7XG4gICAgICB2YXIgbWF4UHVibGlzaGVkID0gKGxpbWl0ICYmIHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPiAwKSA/XG4gICAgICAgIHNlbGYuX3B1Ymxpc2hlZC5nZXQoc2VsZi5fcHVibGlzaGVkLm1heEVsZW1lbnRJZCgpKSA6IG51bGw7XG4gICAgICB2YXIgbWF4QnVmZmVyZWQgPSAobGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpID4gMClcbiAgICAgICAgPyBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCkpXG4gICAgICAgIDogbnVsbDtcbiAgICAgIC8vIFRoZSBxdWVyeSBpcyB1bmxpbWl0ZWQgb3IgZGlkbid0IHB1Ymxpc2ggZW5vdWdoIGRvY3VtZW50cyB5ZXQgb3IgdGhlXG4gICAgICAvLyBuZXcgZG9jdW1lbnQgd291bGQgZml0IGludG8gcHVibGlzaGVkIHNldCBwdXNoaW5nIHRoZSBtYXhpbXVtIGVsZW1lbnRcbiAgICAgIC8vIG91dCwgdGhlbiB3ZSBuZWVkIHRvIHB1Ymxpc2ggdGhlIGRvYy5cbiAgICAgIHZhciB0b1B1Ymxpc2ggPSAhIGxpbWl0IHx8IHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPCBsaW1pdCB8fFxuICAgICAgICBjb21wYXJhdG9yKGRvYywgbWF4UHVibGlzaGVkKSA8IDA7XG5cbiAgICAgIC8vIE90aGVyd2lzZSB3ZSBtaWdodCBuZWVkIHRvIGJ1ZmZlciBpdCAob25seSBpbiBjYXNlIG9mIGxpbWl0ZWQgcXVlcnkpLlxuICAgICAgLy8gQnVmZmVyaW5nIGlzIGFsbG93ZWQgaWYgdGhlIGJ1ZmZlciBpcyBub3QgZmlsbGVkIHVwIHlldCBhbmQgYWxsXG4gICAgICAvLyBtYXRjaGluZyBkb2NzIGFyZSBlaXRoZXIgaW4gdGhlIHB1Ymxpc2hlZCBzZXQgb3IgaW4gdGhlIGJ1ZmZlci5cbiAgICAgIHZhciBjYW5BcHBlbmRUb0J1ZmZlciA9ICF0b1B1Ymxpc2ggJiYgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyICYmXG4gICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSA8IGxpbWl0O1xuXG4gICAgICAvLyBPciBpZiBpdCBpcyBzbWFsbCBlbm91Z2ggdG8gYmUgc2FmZWx5IGluc2VydGVkIHRvIHRoZSBtaWRkbGUgb3IgdGhlXG4gICAgICAvLyBiZWdpbm5pbmcgb2YgdGhlIGJ1ZmZlci5cbiAgICAgIHZhciBjYW5JbnNlcnRJbnRvQnVmZmVyID0gIXRvUHVibGlzaCAmJiBtYXhCdWZmZXJlZCAmJlxuICAgICAgICBjb21wYXJhdG9yKGRvYywgbWF4QnVmZmVyZWQpIDw9IDA7XG5cbiAgICAgIHZhciB0b0J1ZmZlciA9IGNhbkFwcGVuZFRvQnVmZmVyIHx8IGNhbkluc2VydEludG9CdWZmZXI7XG5cbiAgICAgIGlmICh0b1B1Ymxpc2gpIHtcbiAgICAgICAgc2VsZi5fYWRkUHVibGlzaGVkKGlkLCBkb2MpO1xuICAgICAgfSBlbHNlIGlmICh0b0J1ZmZlcikge1xuICAgICAgICBzZWxmLl9hZGRCdWZmZXJlZChpZCwgZG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGRyb3BwaW5nIGl0IGFuZCBub3Qgc2F2aW5nIHRvIHRoZSBjYWNoZVxuICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgLy8gQ2FsbGVkIHdoZW4gYSBkb2N1bWVudCBsZWF2ZXMgdGhlIFwiTWF0Y2hpbmdcIiByZXN1bHRzIHNldC5cbiAgLy8gVGFrZXMgcmVzcG9uc2liaWxpdHkgb2Yga2VlcGluZyBfdW5wdWJsaXNoZWRCdWZmZXIgaW4gc3luYyB3aXRoIF9wdWJsaXNoZWRcbiAgLy8gYW5kIHRoZSBlZmZlY3Qgb2YgbGltaXQgZW5mb3JjZWQuXG4gIF9yZW1vdmVNYXRjaGluZzogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghIHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpICYmICEgc2VsZi5fbGltaXQpXG4gICAgICAgIHRocm93IEVycm9yKFwidHJpZWQgdG8gcmVtb3ZlIHNvbWV0aGluZyBtYXRjaGluZyBidXQgbm90IGNhY2hlZCBcIiArIGlkKTtcblxuICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpKSB7XG4gICAgICAgIHNlbGYuX3JlbW92ZVB1Ymxpc2hlZChpZCk7XG4gICAgICB9IGVsc2UgaWYgKHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCkpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlQnVmZmVyZWQoaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfaGFuZGxlRG9jOiBmdW5jdGlvbiAoaWQsIG5ld0RvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbWF0Y2hlc05vdyA9IG5ld0RvYyAmJiBzZWxmLl9tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhuZXdEb2MpLnJlc3VsdDtcblxuICAgICAgdmFyIHB1Ymxpc2hlZEJlZm9yZSA9IHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpO1xuICAgICAgdmFyIGJ1ZmZlcmVkQmVmb3JlID0gc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKTtcbiAgICAgIHZhciBjYWNoZWRCZWZvcmUgPSBwdWJsaXNoZWRCZWZvcmUgfHwgYnVmZmVyZWRCZWZvcmU7XG5cbiAgICAgIGlmIChtYXRjaGVzTm93ICYmICFjYWNoZWRCZWZvcmUpIHtcbiAgICAgICAgc2VsZi5fYWRkTWF0Y2hpbmcobmV3RG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoY2FjaGVkQmVmb3JlICYmICFtYXRjaGVzTm93KSB7XG4gICAgICAgIHNlbGYuX3JlbW92ZU1hdGNoaW5nKGlkKTtcbiAgICAgIH0gZWxzZSBpZiAoY2FjaGVkQmVmb3JlICYmIG1hdGNoZXNOb3cpIHtcbiAgICAgICAgdmFyIG9sZERvYyA9IHNlbGYuX3B1Ymxpc2hlZC5nZXQoaWQpO1xuICAgICAgICB2YXIgY29tcGFyYXRvciA9IHNlbGYuX2NvbXBhcmF0b3I7XG4gICAgICAgIHZhciBtaW5CdWZmZXJlZCA9IHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSAmJlxuICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5taW5FbGVtZW50SWQoKSk7XG4gICAgICAgIHZhciBtYXhCdWZmZXJlZDtcblxuICAgICAgICBpZiAocHVibGlzaGVkQmVmb3JlKSB7XG4gICAgICAgICAgLy8gVW5saW1pdGVkIGNhc2Ugd2hlcmUgdGhlIGRvY3VtZW50IHN0YXlzIGluIHB1Ymxpc2hlZCBvbmNlIGl0XG4gICAgICAgICAgLy8gbWF0Y2hlcyBvciB0aGUgY2FzZSB3aGVuIHdlIGRvbid0IGhhdmUgZW5vdWdoIG1hdGNoaW5nIGRvY3MgdG9cbiAgICAgICAgICAvLyBwdWJsaXNoIG9yIHRoZSBjaGFuZ2VkIGJ1dCBtYXRjaGluZyBkb2Mgd2lsbCBzdGF5IGluIHB1Ymxpc2hlZFxuICAgICAgICAgIC8vIGFueXdheXMuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBYWFg6IFdlIHJlbHkgb24gdGhlIGVtcHRpbmVzcyBvZiBidWZmZXIuIEJlIHN1cmUgdG8gbWFpbnRhaW4gdGhlXG4gICAgICAgICAgLy8gZmFjdCB0aGF0IGJ1ZmZlciBjYW4ndCBiZSBlbXB0eSBpZiB0aGVyZSBhcmUgbWF0Y2hpbmcgZG9jdW1lbnRzIG5vdFxuICAgICAgICAgIC8vIHB1Ymxpc2hlZC4gTm90YWJseSwgd2UgZG9uJ3Qgd2FudCB0byBzY2hlZHVsZSByZXBvbGwgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgLy8gcmVseWluZyBvbiB0aGlzIHByb3BlcnR5LlxuICAgICAgICAgIHZhciBzdGF5c0luUHVibGlzaGVkID0gISBzZWxmLl9saW1pdCB8fFxuICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpID09PSAwIHx8XG4gICAgICAgICAgICBjb21wYXJhdG9yKG5ld0RvYywgbWluQnVmZmVyZWQpIDw9IDA7XG5cbiAgICAgICAgICBpZiAoc3RheXNJblB1Ymxpc2hlZCkge1xuICAgICAgICAgICAgc2VsZi5fY2hhbmdlUHVibGlzaGVkKGlkLCBvbGREb2MsIG5ld0RvYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFmdGVyIHRoZSBjaGFuZ2UgZG9jIGRvZXNuJ3Qgc3RheSBpbiB0aGUgcHVibGlzaGVkLCByZW1vdmUgaXRcbiAgICAgICAgICAgIHNlbGYuX3JlbW92ZVB1Ymxpc2hlZChpZCk7XG4gICAgICAgICAgICAvLyBidXQgaXQgY2FuIG1vdmUgaW50byBidWZmZXJlZCBub3csIGNoZWNrIGl0XG4gICAgICAgICAgICBtYXhCdWZmZXJlZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChcbiAgICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCkpO1xuXG4gICAgICAgICAgICB2YXIgdG9CdWZmZXIgPSBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgfHxcbiAgICAgICAgICAgICAgICAgIChtYXhCdWZmZXJlZCAmJiBjb21wYXJhdG9yKG5ld0RvYywgbWF4QnVmZmVyZWQpIDw9IDApO1xuXG4gICAgICAgICAgICBpZiAodG9CdWZmZXIpIHtcbiAgICAgICAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIG5ld0RvYyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBUaHJvdyBhd2F5IGZyb20gYm90aCBwdWJsaXNoZWQgc2V0IGFuZCBidWZmZXJcbiAgICAgICAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGJ1ZmZlcmVkQmVmb3JlKSB7XG4gICAgICAgICAgb2xkRG9jID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KGlkKTtcbiAgICAgICAgICAvLyByZW1vdmUgdGhlIG9sZCB2ZXJzaW9uIG1hbnVhbGx5IGluc3RlYWQgb2YgdXNpbmcgX3JlbW92ZUJ1ZmZlcmVkIHNvXG4gICAgICAgICAgLy8gd2UgZG9uJ3QgdHJpZ2dlciB0aGUgcXVlcnlpbmcgaW1tZWRpYXRlbHkuICBpZiB3ZSBlbmQgdGhpcyBibG9ja1xuICAgICAgICAgIC8vIHdpdGggdGhlIGJ1ZmZlciBlbXB0eSwgd2Ugd2lsbCBuZWVkIHRvIHRyaWdnZXIgdGhlIHF1ZXJ5IHBvbGxcbiAgICAgICAgICAvLyBtYW51YWxseSB0b28uXG4gICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIucmVtb3ZlKGlkKTtcblxuICAgICAgICAgIHZhciBtYXhQdWJsaXNoZWQgPSBzZWxmLl9wdWJsaXNoZWQuZ2V0KFxuICAgICAgICAgICAgc2VsZi5fcHVibGlzaGVkLm1heEVsZW1lbnRJZCgpKTtcbiAgICAgICAgICBtYXhCdWZmZXJlZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSAmJlxuICAgICAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChcbiAgICAgICAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1heEVsZW1lbnRJZCgpKTtcblxuICAgICAgICAgIC8vIHRoZSBidWZmZXJlZCBkb2Mgd2FzIHVwZGF0ZWQsIGl0IGNvdWxkIG1vdmUgdG8gcHVibGlzaGVkXG4gICAgICAgICAgdmFyIHRvUHVibGlzaCA9IGNvbXBhcmF0b3IobmV3RG9jLCBtYXhQdWJsaXNoZWQpIDwgMDtcblxuICAgICAgICAgIC8vIG9yIHN0YXlzIGluIGJ1ZmZlciBldmVuIGFmdGVyIHRoZSBjaGFuZ2VcbiAgICAgICAgICB2YXIgc3RheXNJbkJ1ZmZlciA9ICghIHRvUHVibGlzaCAmJiBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIpIHx8XG4gICAgICAgICAgICAgICAgKCF0b1B1Ymxpc2ggJiYgbWF4QnVmZmVyZWQgJiZcbiAgICAgICAgICAgICAgICAgY29tcGFyYXRvcihuZXdEb2MsIG1heEJ1ZmZlcmVkKSA8PSAwKTtcblxuICAgICAgICAgIGlmICh0b1B1Ymxpc2gpIHtcbiAgICAgICAgICAgIHNlbGYuX2FkZFB1Ymxpc2hlZChpZCwgbmV3RG9jKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0YXlzSW5CdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIHN0YXlzIGluIGJ1ZmZlciBidXQgY2hhbmdlc1xuICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2V0KGlkLCBuZXdEb2MpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaHJvdyBhd2F5IGZyb20gYm90aCBwdWJsaXNoZWQgc2V0IGFuZCBidWZmZXJcbiAgICAgICAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgLy8gTm9ybWFsbHkgdGhpcyBjaGVjayB3b3VsZCBoYXZlIGJlZW4gZG9uZSBpbiBfcmVtb3ZlQnVmZmVyZWQgYnV0XG4gICAgICAgICAgICAvLyB3ZSBkaWRuJ3QgdXNlIGl0LCBzbyB3ZSBuZWVkIHRvIGRvIGl0IG91cnNlbGYgbm93LlxuICAgICAgICAgICAgaWYgKCEgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpKSB7XG4gICAgICAgICAgICAgIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWNoZWRCZWZvcmUgaW1wbGllcyBlaXRoZXIgb2YgcHVibGlzaGVkQmVmb3JlIG9yIGJ1ZmZlcmVkQmVmb3JlIGlzIHRydWUuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuRkVUQ0hJTkcpO1xuICAgICAgLy8gRGVmZXIsIGJlY2F1c2Ugbm90aGluZyBjYWxsZWQgZnJvbSB0aGUgb3Bsb2cgZW50cnkgaGFuZGxlciBtYXkgeWllbGQsXG4gICAgICAvLyBidXQgZmV0Y2goKSB5aWVsZHMuXG4gICAgICBNZXRlb3IuZGVmZXIoZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoZnVuY3Rpb24gKCkge1xuICAgICAgICB3aGlsZSAoIXNlbGYuX3N0b3BwZWQgJiYgIXNlbGYuX25lZWRUb0ZldGNoLmVtcHR5KCkpIHtcbiAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgICAvLyBXaGlsZSBmZXRjaGluZywgd2UgZGVjaWRlZCB0byBnbyBpbnRvIFFVRVJZSU5HIG1vZGUsIGFuZCB0aGVuIHdlXG4gICAgICAgICAgICAvLyBzYXcgYW5vdGhlciBvcGxvZyBlbnRyeSwgc28gX25lZWRUb0ZldGNoIGlzIG5vdCBlbXB0eS4gQnV0IHdlXG4gICAgICAgICAgICAvLyBzaG91bGRuJ3QgZmV0Y2ggdGhlc2UgZG9jdW1lbnRzIHVudGlsIEFGVEVSIHRoZSBxdWVyeSBpcyBkb25lLlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQmVpbmcgaW4gc3RlYWR5IHBoYXNlIGhlcmUgd291bGQgYmUgc3VycHJpc2luZy5cbiAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLkZFVENISU5HKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicGhhc2UgaW4gZmV0Y2hNb2RpZmllZERvY3VtZW50czogXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICAgICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IHNlbGYuX25lZWRUb0ZldGNoO1xuICAgICAgICAgIHZhciB0aGlzR2VuZXJhdGlvbiA9ICsrc2VsZi5fZmV0Y2hHZW5lcmF0aW9uO1xuICAgICAgICAgIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICAgICAgdmFyIHdhaXRpbmcgPSAwO1xuICAgICAgICAgIHZhciBmdXQgPSBuZXcgRnV0dXJlO1xuICAgICAgICAgIC8vIFRoaXMgbG9vcCBpcyBzYWZlLCBiZWNhdXNlIF9jdXJyZW50bHlGZXRjaGluZyB3aWxsIG5vdCBiZSB1cGRhdGVkXG4gICAgICAgICAgLy8gZHVyaW5nIHRoaXMgbG9vcCAoaW4gZmFjdCwgaXQgaXMgbmV2ZXIgbXV0YXRlZCkuXG4gICAgICAgICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcuZm9yRWFjaChmdW5jdGlvbiAob3AsIGlkKSB7XG4gICAgICAgICAgICB3YWl0aW5nKys7XG4gICAgICAgICAgICBzZWxmLl9tb25nb0hhbmRsZS5fZG9jRmV0Y2hlci5mZXRjaChcbiAgICAgICAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUsIGlkLCBvcCxcbiAgICAgICAgICAgICAgZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoZnVuY3Rpb24gKGVyciwgZG9jKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkdvdCBleGNlcHRpb24gd2hpbGUgZmV0Y2hpbmcgZG9jdW1lbnRzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgd2UgZ2V0IGFuIGVycm9yIGZyb20gdGhlIGZldGNoZXIgKGVnLCB0cm91YmxlXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbm5lY3RpbmcgdG8gTW9uZ28pLCBsZXQncyBqdXN0IGFiYW5kb24gdGhlIGZldGNoIHBoYXNlXG4gICAgICAgICAgICAgICAgICAgIC8vIGFsdG9nZXRoZXIgYW5kIGZhbGwgYmFjayB0byBwb2xsaW5nLiBJdCdzIG5vdCBsaWtlIHdlJ3JlXG4gICAgICAgICAgICAgICAgICAgIC8vIGdldHRpbmcgbGl2ZSB1cGRhdGVzIGFueXdheS5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuX3BoYXNlICE9PSBQSEFTRS5RVUVSWUlORykge1xuICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFzZWxmLl9zdG9wcGVkICYmIHNlbGYuX3BoYXNlID09PSBQSEFTRS5GRVRDSElOR1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiBzZWxmLl9mZXRjaEdlbmVyYXRpb24gPT09IHRoaXNHZW5lcmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIHJlLWNoZWNrIHRoZSBnZW5lcmF0aW9uIGluIGNhc2Ugd2UndmUgaGFkIGFuIGV4cGxpY2l0XG4gICAgICAgICAgICAgICAgICAgIC8vIF9wb2xsUXVlcnkgY2FsbCAoZWcsIGluIGFub3RoZXIgZmliZXIpIHdoaWNoIHNob3VsZFxuICAgICAgICAgICAgICAgICAgICAvLyBlZmZlY3RpdmVseSBjYW5jZWwgdGhpcyByb3VuZCBvZiBmZXRjaGVzLiAgKF9wb2xsUXVlcnlcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50cyB0aGUgZ2VuZXJhdGlvbi4pXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgZG9jKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgICAgd2FpdGluZy0tO1xuICAgICAgICAgICAgICAgICAgLy8gQmVjYXVzZSBmZXRjaCgpIG5ldmVyIGNhbGxzIGl0cyBjYWxsYmFjayBzeW5jaHJvbm91c2x5LFxuICAgICAgICAgICAgICAgICAgLy8gdGhpcyBpcyBzYWZlIChpZSwgd2Ugd29uJ3QgY2FsbCBmdXQucmV0dXJuKCkgYmVmb3JlIHRoZVxuICAgICAgICAgICAgICAgICAgLy8gZm9yRWFjaCBpcyBkb25lKS5cbiAgICAgICAgICAgICAgICAgIGlmICh3YWl0aW5nID09PSAwKVxuICAgICAgICAgICAgICAgICAgICBmdXQucmV0dXJuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZnV0LndhaXQoKTtcbiAgICAgICAgICAvLyBFeGl0IG5vdyBpZiB3ZSd2ZSBoYWQgYSBfcG9sbFF1ZXJ5IGNhbGwgKGhlcmUgb3IgaW4gYW5vdGhlciBmaWJlcikuXG4gICAgICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5RVUVSWUlORylcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2UncmUgZG9uZSBmZXRjaGluZywgc28gd2UgY2FuIGJlIHN0ZWFkeSwgdW5sZXNzIHdlJ3ZlIGhhZCBhXG4gICAgICAgIC8vIF9wb2xsUXVlcnkgY2FsbCAoaGVyZSBvciBpbiBhbm90aGVyIGZpYmVyKS5cbiAgICAgICAgaWYgKHNlbGYuX3BoYXNlICE9PSBQSEFTRS5RVUVSWUlORylcbiAgICAgICAgICBzZWxmLl9iZVN0ZWFkeSgpO1xuICAgICAgfSkpO1xuICAgIH0pO1xuICB9LFxuICBfYmVTdGVhZHk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5TVEVBRFkpO1xuICAgICAgdmFyIHdyaXRlcyA9IHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHk7XG4gICAgICBzZWxmLl93cml0ZXNUb0NvbW1pdFdoZW5XZVJlYWNoU3RlYWR5ID0gW107XG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5vbkZsdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgXy5lYWNoKHdyaXRlcywgZnVuY3Rpb24gKHcpIHtcbiAgICAgICAgICB3LmNvbW1pdHRlZCgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuICBfaGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nOiBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkRm9yT3Aob3ApLCBvcCk7XG4gICAgfSk7XG4gIH0sXG4gIF9oYW5kbGVPcGxvZ0VudHJ5U3RlYWR5T3JGZXRjaGluZzogZnVuY3Rpb24gKG9wKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBpZCA9IGlkRm9yT3Aob3ApO1xuICAgICAgLy8gSWYgd2UncmUgYWxyZWFkeSBmZXRjaGluZyB0aGlzIG9uZSwgb3IgYWJvdXQgdG8sIHdlIGNhbid0IG9wdGltaXplO1xuICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgd2UgZmV0Y2ggaXQgYWdhaW4gaWYgbmVjZXNzYXJ5LlxuICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5GRVRDSElORyAmJlxuICAgICAgICAgICgoc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgJiYgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcuaGFzKGlkKSkgfHxcbiAgICAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guaGFzKGlkKSkpIHtcbiAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkLCBvcCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wLm9wID09PSAnZCcpIHtcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpIHx8XG4gICAgICAgICAgICAoc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSkpXG4gICAgICAgICAgc2VsZi5fcmVtb3ZlTWF0Y2hpbmcoaWQpO1xuICAgICAgfSBlbHNlIGlmIChvcC5vcCA9PT0gJ2knKSB7XG4gICAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnNlcnQgZm91bmQgZm9yIGFscmVhZHktZXhpc3RpbmcgSUQgaW4gcHVibGlzaGVkXCIpO1xuICAgICAgICBpZiAoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnNlcnQgZm91bmQgZm9yIGFscmVhZHktZXhpc3RpbmcgSUQgaW4gYnVmZmVyXCIpO1xuXG4gICAgICAgIC8vIFhYWCB3aGF0IGlmIHNlbGVjdG9yIHlpZWxkcz8gIGZvciBub3cgaXQgY2FuJ3QgYnV0IGxhdGVyIGl0IGNvdWxkXG4gICAgICAgIC8vIGhhdmUgJHdoZXJlXG4gICAgICAgIGlmIChzZWxmLl9tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhvcC5vKS5yZXN1bHQpXG4gICAgICAgICAgc2VsZi5fYWRkTWF0Y2hpbmcob3Aubyk7XG4gICAgICB9IGVsc2UgaWYgKG9wLm9wID09PSAndScpIHtcbiAgICAgICAgLy8gd2UgYXJlIG1hcHBpbmcgdGhlIG5ldyBvcGxvZyBmb3JtYXQgb24gbW9uZ28gNVxuICAgICAgICAvLyB0byB3aGF0IHdlIGtub3cgYmV0dGVyLCAkc2V0XG4gICAgICAgIG9wLm8gPSBvcGxvZ1YyVjFDb252ZXJ0ZXIob3AubylcbiAgICAgICAgLy8gSXMgdGhpcyBhIG1vZGlmaWVyICgkc2V0LyR1bnNldCwgd2hpY2ggbWF5IHJlcXVpcmUgdXMgdG8gcG9sbCB0aGVcbiAgICAgICAgLy8gZGF0YWJhc2UgdG8gZmlndXJlIG91dCBpZiB0aGUgd2hvbGUgZG9jdW1lbnQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IpIG9yXG4gICAgICAgIC8vIGEgcmVwbGFjZW1lbnQgKGluIHdoaWNoIGNhc2Ugd2UgY2FuIGp1c3QgZGlyZWN0bHkgcmUtZXZhbHVhdGUgdGhlXG4gICAgICAgIC8vIHNlbGVjdG9yKT9cbiAgICAgICAgLy8gb3Bsb2cgZm9ybWF0IGhhcyBjaGFuZ2VkIG9uIG1vbmdvZGIgNSwgd2UgaGF2ZSB0byBzdXBwb3J0IGJvdGggbm93XG4gICAgICAgIC8vIGRpZmYgaXMgdGhlIGZvcm1hdCBpbiBNb25nbyA1KyAob3Bsb2cgdjIpXG4gICAgICAgIHZhciBpc1JlcGxhY2UgPSAhXy5oYXMob3AubywgJyRzZXQnKSAmJiAhXy5oYXMob3AubywgJ2RpZmYnKSAmJiAhXy5oYXMob3AubywgJyR1bnNldCcpO1xuICAgICAgICAvLyBJZiB0aGlzIG1vZGlmaWVyIG1vZGlmaWVzIHNvbWV0aGluZyBpbnNpZGUgYW4gRUpTT04gY3VzdG9tIHR5cGUgKGllLFxuICAgICAgICAvLyBhbnl0aGluZyB3aXRoIEVKU09OJCksIHRoZW4gd2UgY2FuJ3QgdHJ5IHRvIHVzZVxuICAgICAgICAvLyBMb2NhbENvbGxlY3Rpb24uX21vZGlmeSwgc2luY2UgdGhhdCBqdXN0IG11dGF0ZXMgdGhlIEVKU09OIGVuY29kaW5nLFxuICAgICAgICAvLyBub3QgdGhlIGFjdHVhbCBvYmplY3QuXG4gICAgICAgIHZhciBjYW5EaXJlY3RseU1vZGlmeURvYyA9XG4gICAgICAgICAgIWlzUmVwbGFjZSAmJiBtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkKG9wLm8pO1xuXG4gICAgICAgIHZhciBwdWJsaXNoZWRCZWZvcmUgPSBzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKTtcbiAgICAgICAgdmFyIGJ1ZmZlcmVkQmVmb3JlID0gc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKTtcblxuICAgICAgICBpZiAoaXNSZXBsYWNlKSB7XG4gICAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBfLmV4dGVuZCh7X2lkOiBpZH0sIG9wLm8pKTtcbiAgICAgICAgfSBlbHNlIGlmICgocHVibGlzaGVkQmVmb3JlIHx8IGJ1ZmZlcmVkQmVmb3JlKSAmJlxuICAgICAgICAgICAgICAgICAgIGNhbkRpcmVjdGx5TW9kaWZ5RG9jKSB7XG4gICAgICAgICAgLy8gT2ggZ3JlYXQsIHdlIGFjdHVhbGx5IGtub3cgd2hhdCB0aGUgZG9jdW1lbnQgaXMsIHNvIHdlIGNhbiBhcHBseVxuICAgICAgICAgIC8vIHRoaXMgZGlyZWN0bHkuXG4gICAgICAgICAgdmFyIG5ld0RvYyA9IHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpXG4gICAgICAgICAgICA/IHNlbGYuX3B1Ymxpc2hlZC5nZXQoaWQpIDogc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KGlkKTtcbiAgICAgICAgICBuZXdEb2MgPSBFSlNPTi5jbG9uZShuZXdEb2MpO1xuXG4gICAgICAgICAgbmV3RG9jLl9pZCA9IGlkO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShuZXdEb2MsIG9wLm8pO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChlLm5hbWUgIT09IFwiTWluaW1vbmdvRXJyb3JcIilcbiAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIC8vIFdlIGRpZG4ndCB1bmRlcnN0YW5kIHRoZSBtb2RpZmllci4gIFJlLWZldGNoLlxuICAgICAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkLCBvcCk7XG4gICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSkge1xuICAgICAgICAgICAgICBzZWxmLl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgc2VsZi5fc2hhcmVkUHJvamVjdGlvbkZuKG5ld0RvYykpO1xuICAgICAgICB9IGVsc2UgaWYgKCFjYW5EaXJlY3RseU1vZGlmeURvYyB8fFxuICAgICAgICAgICAgICAgICAgIHNlbGYuX21hdGNoZXIuY2FuQmVjb21lVHJ1ZUJ5TW9kaWZpZXIob3AubykgfHxcbiAgICAgICAgICAgICAgICAgICAoc2VsZi5fc29ydGVyICYmIHNlbGYuX3NvcnRlci5hZmZlY3RlZEJ5TW9kaWZpZXIob3AubykpKSB7XG4gICAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkLCBvcCk7XG4gICAgICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5TVEVBRFkpXG4gICAgICAgICAgICBzZWxmLl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IEVycm9yKFwiWFhYIFNVUlBSSVNJTkcgT1BFUkFUSU9OOiBcIiArIG9wKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgLy8gWWllbGRzIVxuICBfcnVuSW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwib3Bsb2cgc3RvcHBlZCBzdXJwcmlzaW5nbHkgZWFybHlcIik7XG5cbiAgICBzZWxmLl9ydW5RdWVyeSh7aW5pdGlhbDogdHJ1ZX0pOyAgLy8geWllbGRzXG5cbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjsgIC8vIGNhbiBoYXBwZW4gb24gcXVlcnlFcnJvclxuXG4gICAgLy8gQWxsb3cgb2JzZXJ2ZUNoYW5nZXMgY2FsbHMgdG8gcmV0dXJuLiAoQWZ0ZXIgdGhpcywgaXQncyBwb3NzaWJsZSBmb3JcbiAgICAvLyBzdG9wKCkgdG8gYmUgY2FsbGVkLilcbiAgICBzZWxmLl9tdWx0aXBsZXhlci5yZWFkeSgpO1xuXG4gICAgc2VsZi5fZG9uZVF1ZXJ5aW5nKCk7ICAvLyB5aWVsZHNcbiAgfSxcblxuICAvLyBJbiB2YXJpb3VzIGNpcmN1bXN0YW5jZXMsIHdlIG1heSBqdXN0IHdhbnQgdG8gc3RvcCBwcm9jZXNzaW5nIHRoZSBvcGxvZyBhbmRcbiAgLy8gcmUtcnVuIHRoZSBpbml0aWFsIHF1ZXJ5LCBqdXN0IGFzIGlmIHdlIHdlcmUgYSBQb2xsaW5nT2JzZXJ2ZURyaXZlci5cbiAgLy9cbiAgLy8gVGhpcyBmdW5jdGlvbiBtYXkgbm90IGJsb2NrLCBiZWNhdXNlIGl0IGlzIGNhbGxlZCBmcm9tIGFuIG9wbG9nIGVudHJ5XG4gIC8vIGhhbmRsZXIuXG4gIC8vXG4gIC8vIFhYWCBXZSBzaG91bGQgY2FsbCB0aGlzIHdoZW4gd2UgZGV0ZWN0IHRoYXQgd2UndmUgYmVlbiBpbiBGRVRDSElORyBmb3IgXCJ0b29cbiAgLy8gbG9uZ1wiLlxuICAvL1xuICAvLyBYWFggV2Ugc2hvdWxkIGNhbGwgdGhpcyB3aGVuIHdlIGRldGVjdCBNb25nbyBmYWlsb3ZlciAoc2luY2UgdGhhdCBtaWdodFxuICAvLyBtZWFuIHRoYXQgc29tZSBvZiB0aGUgb3Bsb2cgZW50cmllcyB3ZSBoYXZlIHByb2Nlc3NlZCBoYXZlIGJlZW4gcm9sbGVkXG4gIC8vIGJhY2spLiBUaGUgTm9kZSBNb25nbyBkcml2ZXIgaXMgaW4gdGhlIG1pZGRsZSBvZiBhIGJ1bmNoIG9mIGh1Z2VcbiAgLy8gcmVmYWN0b3JpbmdzLCBpbmNsdWRpbmcgdGhlIHdheSB0aGF0IGl0IG5vdGlmaWVzIHlvdSB3aGVuIHByaW1hcnlcbiAgLy8gY2hhbmdlcy4gV2lsbCBwdXQgb2ZmIGltcGxlbWVudGluZyB0aGlzIHVudGlsIGRyaXZlciAxLjQgaXMgb3V0LlxuICBfcG9sbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIFlheSwgd2UgZ2V0IHRvIGZvcmdldCBhYm91dCBhbGwgdGhlIHRoaW5ncyB3ZSB0aG91Z2h0IHdlIGhhZCB0byBmZXRjaC5cbiAgICAgIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IG51bGw7XG4gICAgICArK3NlbGYuX2ZldGNoR2VuZXJhdGlvbjsgIC8vIGlnbm9yZSBhbnkgaW4tZmxpZ2h0IGZldGNoZXNcbiAgICAgIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuUVVFUllJTkcpO1xuXG4gICAgICAvLyBEZWZlciBzbyB0aGF0IHdlIGRvbid0IHlpZWxkLiAgV2UgZG9uJ3QgbmVlZCBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeVxuICAgICAgLy8gaGVyZSBiZWNhdXNlIFN3aXRjaGVkVG9RdWVyeSBpcyBub3QgdGhyb3duIGluIFFVRVJZSU5HIG1vZGUuXG4gICAgICBNZXRlb3IuZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLl9ydW5RdWVyeSgpO1xuICAgICAgICBzZWxmLl9kb25lUXVlcnlpbmcoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1blF1ZXJ5OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgbmV3UmVzdWx0cywgbmV3QnVmZmVyO1xuXG4gICAgLy8gVGhpcyB3aGlsZSBsb29wIGlzIGp1c3QgdG8gcmV0cnkgZmFpbHVyZXMuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIC8vIElmIHdlJ3ZlIGJlZW4gc3RvcHBlZCwgd2UgZG9uJ3QgaGF2ZSB0byBydW4gYW55dGhpbmcgYW55IG1vcmUuXG4gICAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBuZXdSZXN1bHRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICBuZXdCdWZmZXIgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcblxuICAgICAgLy8gUXVlcnkgMnggZG9jdW1lbnRzIGFzIHRoZSBoYWxmIGV4Y2x1ZGVkIGZyb20gdGhlIG9yaWdpbmFsIHF1ZXJ5IHdpbGwgZ29cbiAgICAgIC8vIGludG8gdW5wdWJsaXNoZWQgYnVmZmVyIHRvIHJlZHVjZSBhZGRpdGlvbmFsIE1vbmdvIGxvb2t1cHMgaW4gY2FzZXNcbiAgICAgIC8vIHdoZW4gZG9jdW1lbnRzIGFyZSByZW1vdmVkIGZyb20gdGhlIHB1Ymxpc2hlZCBzZXQgYW5kIG5lZWQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQuXG4gICAgICAvLyBYWFggbmVlZHMgbW9yZSB0aG91Z2h0IG9uIG5vbi16ZXJvIHNraXBcbiAgICAgIC8vIFhYWCAyIGlzIGEgXCJtYWdpYyBudW1iZXJcIiBtZWFuaW5nIHRoZXJlIGlzIGFuIGV4dHJhIGNodW5rIG9mIGRvY3MgZm9yXG4gICAgICAvLyBidWZmZXIgaWYgc3VjaCBpcyBuZWVkZWQuXG4gICAgICB2YXIgY3Vyc29yID0gc2VsZi5fY3Vyc29yRm9yUXVlcnkoeyBsaW1pdDogc2VsZi5fbGltaXQgKiAyIH0pO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY3Vyc29yLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaSkgeyAgLy8geWllbGRzXG4gICAgICAgICAgaWYgKCFzZWxmLl9saW1pdCB8fCBpIDwgc2VsZi5fbGltaXQpIHtcbiAgICAgICAgICAgIG5ld1Jlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld0J1ZmZlci5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5pdGlhbCAmJiB0eXBlb2YoZS5jb2RlKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAvLyBUaGlzIGlzIGFuIGVycm9yIGRvY3VtZW50IHNlbnQgdG8gdXMgYnkgbW9uZ29kLCBub3QgYSBjb25uZWN0aW9uXG4gICAgICAgICAgLy8gZXJyb3IgZ2VuZXJhdGVkIGJ5IHRoZSBjbGllbnQuIEFuZCB3ZSd2ZSBuZXZlciBzZWVuIHRoaXMgcXVlcnkgd29ya1xuICAgICAgICAgIC8vIHN1Y2Nlc3NmdWxseS4gUHJvYmFibHkgaXQncyBhIGJhZCBzZWxlY3RvciBvciBzb21ldGhpbmcsIHNvIHdlXG4gICAgICAgICAgLy8gc2hvdWxkIE5PVCByZXRyeS4gSW5zdGVhZCwgd2Ugc2hvdWxkIGhhbHQgdGhlIG9ic2VydmUgKHdoaWNoIGVuZHNcbiAgICAgICAgICAvLyB1cCBjYWxsaW5nIGBzdG9wYCBvbiB1cykuXG4gICAgICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucXVlcnlFcnJvcihlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEdXJpbmcgZmFpbG92ZXIgKGVnKSBpZiB3ZSBnZXQgYW4gZXhjZXB0aW9uIHdlIHNob3VsZCBsb2cgYW5kIHJldHJ5XG4gICAgICAgIC8vIGluc3RlYWQgb2YgY3Jhc2hpbmcuXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJHb3QgZXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnlcIiwgZSk7XG4gICAgICAgIE1ldGVvci5fc2xlZXBGb3JNcygxMDApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgc2VsZi5fcHVibGlzaE5ld1Jlc3VsdHMobmV3UmVzdWx0cywgbmV3QnVmZmVyKTtcbiAgfSxcblxuICAvLyBUcmFuc2l0aW9ucyB0byBRVUVSWUlORyBhbmQgcnVucyBhbm90aGVyIHF1ZXJ5LCBvciAoaWYgYWxyZWFkeSBpbiBRVUVSWUlORylcbiAgLy8gZW5zdXJlcyB0aGF0IHdlIHdpbGwgcXVlcnkgYWdhaW4gbGF0ZXIuXG4gIC8vXG4gIC8vIFRoaXMgZnVuY3Rpb24gbWF5IG5vdCBibG9jaywgYmVjYXVzZSBpdCBpcyBjYWxsZWQgZnJvbSBhbiBvcGxvZyBlbnRyeVxuICAvLyBoYW5kbGVyLiBIb3dldmVyLCBpZiB3ZSB3ZXJlIG5vdCBhbHJlYWR5IGluIHRoZSBRVUVSWUlORyBwaGFzZSwgaXQgdGhyb3dzXG4gIC8vIGFuIGV4Y2VwdGlvbiB0aGF0IGlzIGNhdWdodCBieSB0aGUgY2xvc2VzdCBzdXJyb3VuZGluZ1xuICAvLyBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSBjYWxsOyB0aGlzIGVuc3VyZXMgdGhhdCB3ZSBkb24ndCBjb250aW51ZSBydW5uaW5nXG4gIC8vIGNsb3NlIHRoYXQgd2FzIGRlc2lnbmVkIGZvciBhbm90aGVyIHBoYXNlIGluc2lkZSBQSEFTRS5RVUVSWUlORy5cbiAgLy9cbiAgLy8gKEl0J3MgYWxzbyBuZWNlc3Nhcnkgd2hlbmV2ZXIgbG9naWMgaW4gdGhpcyBmaWxlIHlpZWxkcyB0byBjaGVjayB0aGF0IG90aGVyXG4gIC8vIHBoYXNlcyBoYXZlbid0IHB1dCB1cyBpbnRvIFFVRVJZSU5HIG1vZGUsIHRob3VnaDsgZWcsXG4gIC8vIF9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzIGRvZXMgdGhpcy4pXG4gIF9uZWVkVG9Qb2xsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gSWYgd2UncmUgbm90IGFscmVhZHkgaW4gdGhlIG1pZGRsZSBvZiBhIHF1ZXJ5LCB3ZSBjYW4gcXVlcnkgbm93XG4gICAgICAvLyAocG9zc2libHkgcGF1c2luZyBGRVRDSElORykuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgIHNlbGYuX3BvbGxRdWVyeSgpO1xuICAgICAgICB0aHJvdyBuZXcgU3dpdGNoZWRUb1F1ZXJ5O1xuICAgICAgfVxuXG4gICAgICAvLyBXZSdyZSBjdXJyZW50bHkgaW4gUVVFUllJTkcuIFNldCBhIGZsYWcgdG8gZW5zdXJlIHRoYXQgd2UgcnVuIGFub3RoZXJcbiAgICAgIC8vIHF1ZXJ5IHdoZW4gd2UncmUgZG9uZS5cbiAgICAgIHNlbGYuX3JlcXVlcnlXaGVuRG9uZVRoaXNRdWVyeSA9IHRydWU7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gWWllbGRzIVxuICBfZG9uZVF1ZXJ5aW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fbW9uZ29IYW5kbGUuX29wbG9nSGFuZGxlLndhaXRVbnRpbENhdWdodFVwKCk7ICAvLyB5aWVsZHNcbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjtcbiAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgdGhyb3cgRXJyb3IoXCJQaGFzZSB1bmV4cGVjdGVkbHkgXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5KSB7XG4gICAgICAgIHNlbGYuX3JlcXVlcnlXaGVuRG9uZVRoaXNRdWVyeSA9IGZhbHNlO1xuICAgICAgICBzZWxmLl9wb2xsUXVlcnkoKTtcbiAgICAgIH0gZWxzZSBpZiAoc2VsZi5fbmVlZFRvRmV0Y2guZW1wdHkoKSkge1xuICAgICAgICBzZWxmLl9iZVN0ZWFkeSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5fZmV0Y2hNb2RpZmllZERvY3VtZW50cygpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIF9jdXJzb3JGb3JRdWVyeTogZnVuY3Rpb24gKG9wdGlvbnNPdmVyd3JpdGUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFRoZSBxdWVyeSB3ZSBydW4gaXMgYWxtb3N0IHRoZSBzYW1lIGFzIHRoZSBjdXJzb3Igd2UgYXJlIG9ic2VydmluZyxcbiAgICAgIC8vIHdpdGggYSBmZXcgY2hhbmdlcy4gV2UgbmVlZCB0byByZWFkIGFsbCB0aGUgZmllbGRzIHRoYXQgYXJlIHJlbGV2YW50IHRvXG4gICAgICAvLyB0aGUgc2VsZWN0b3IsIG5vdCBqdXN0IHRoZSBmaWVsZHMgd2UgYXJlIGdvaW5nIHRvIHB1Ymxpc2ggKHRoYXQncyB0aGVcbiAgICAgIC8vIFwic2hhcmVkXCIgcHJvamVjdGlvbikuIEFuZCB3ZSBkb24ndCB3YW50IHRvIGFwcGx5IGFueSB0cmFuc2Zvcm0gaW4gdGhlXG4gICAgICAvLyBjdXJzb3IsIGJlY2F1c2Ugb2JzZXJ2ZUNoYW5nZXMgc2hvdWxkbid0IHVzZSB0aGUgdHJhbnNmb3JtLlxuICAgICAgdmFyIG9wdGlvbnMgPSBfLmNsb25lKHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMpO1xuXG4gICAgICAvLyBBbGxvdyB0aGUgY2FsbGVyIHRvIG1vZGlmeSB0aGUgb3B0aW9ucy4gVXNlZnVsIHRvIHNwZWNpZnkgZGlmZmVyZW50XG4gICAgICAvLyBza2lwIGFuZCBsaW1pdCB2YWx1ZXMuXG4gICAgICBfLmV4dGVuZChvcHRpb25zLCBvcHRpb25zT3ZlcndyaXRlKTtcblxuICAgICAgb3B0aW9ucy5maWVsZHMgPSBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uO1xuICAgICAgZGVsZXRlIG9wdGlvbnMudHJhbnNmb3JtO1xuICAgICAgLy8gV2UgYXJlIE5PVCBkZWVwIGNsb25pbmcgZmllbGRzIG9yIHNlbGVjdG9yIGhlcmUsIHdoaWNoIHNob3VsZCBiZSBPSy5cbiAgICAgIHZhciBkZXNjcmlwdGlvbiA9IG5ldyBDdXJzb3JEZXNjcmlwdGlvbihcbiAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yLFxuICAgICAgICBvcHRpb25zKTtcbiAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHNlbGYuX21vbmdvSGFuZGxlLCBkZXNjcmlwdGlvbik7XG4gICAgfSk7XG4gIH0sXG5cblxuICAvLyBSZXBsYWNlIHNlbGYuX3B1Ymxpc2hlZCB3aXRoIG5ld1Jlc3VsdHMgKGJvdGggYXJlIElkTWFwcyksIGludm9raW5nIG9ic2VydmVcbiAgLy8gY2FsbGJhY2tzIG9uIHRoZSBtdWx0aXBsZXhlci5cbiAgLy8gUmVwbGFjZSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciB3aXRoIG5ld0J1ZmZlci5cbiAgLy9cbiAgLy8gWFhYIFRoaXMgaXMgdmVyeSBzaW1pbGFyIHRvIExvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5VW5vcmRlcmVkQ2hhbmdlcy4gV2VcbiAgLy8gc2hvdWxkIHJlYWxseTogKGEpIFVuaWZ5IElkTWFwIGFuZCBPcmRlcmVkRGljdCBpbnRvIFVub3JkZXJlZC9PcmRlcmVkRGljdFxuICAvLyAoYikgUmV3cml0ZSBkaWZmLmpzIHRvIHVzZSB0aGVzZSBjbGFzc2VzIGluc3RlYWQgb2YgYXJyYXlzIGFuZCBvYmplY3RzLlxuICBfcHVibGlzaE5ld1Jlc3VsdHM6IGZ1bmN0aW9uIChuZXdSZXN1bHRzLCBuZXdCdWZmZXIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuXG4gICAgICAvLyBJZiB0aGUgcXVlcnkgaXMgbGltaXRlZCBhbmQgdGhlcmUgaXMgYSBidWZmZXIsIHNodXQgZG93biBzbyBpdCBkb2Vzbid0XG4gICAgICAvLyBzdGF5IGluIGEgd2F5LlxuICAgICAgaWYgKHNlbGYuX2xpbWl0KSB7XG4gICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmNsZWFyKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEZpcnN0IHJlbW92ZSBhbnl0aGluZyB0aGF0J3MgZ29uZS4gQmUgY2FyZWZ1bCBub3QgdG8gbW9kaWZ5XG4gICAgICAvLyBzZWxmLl9wdWJsaXNoZWQgd2hpbGUgaXRlcmF0aW5nIG92ZXIgaXQuXG4gICAgICB2YXIgaWRzVG9SZW1vdmUgPSBbXTtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIGlmICghbmV3UmVzdWx0cy5oYXMoaWQpKVxuICAgICAgICAgIGlkc1RvUmVtb3ZlLnB1c2goaWQpO1xuICAgICAgfSk7XG4gICAgICBfLmVhY2goaWRzVG9SZW1vdmUsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICBzZWxmLl9yZW1vdmVQdWJsaXNoZWQoaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIE5vdyBkbyBhZGRzIGFuZCBjaGFuZ2VzLlxuICAgICAgLy8gSWYgc2VsZiBoYXMgYSBidWZmZXIgYW5kIGxpbWl0LCB0aGUgbmV3IGZldGNoZWQgcmVzdWx0IHdpbGwgYmVcbiAgICAgIC8vIGxpbWl0ZWQgY29ycmVjdGx5IGFzIHRoZSBxdWVyeSBoYXMgc29ydCBzcGVjaWZpZXIuXG4gICAgICBuZXdSZXN1bHRzLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBkb2MpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFNhbml0eS1jaGVjayB0aGF0IGV2ZXJ5dGhpbmcgd2UgdHJpZWQgdG8gcHV0IGludG8gX3B1Ymxpc2hlZCBlbmRlZCB1cFxuICAgICAgLy8gdGhlcmUuXG4gICAgICAvLyBYWFggaWYgdGhpcyBpcyBzbG93LCByZW1vdmUgaXQgbGF0ZXJcbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpICE9PSBuZXdSZXN1bHRzLnNpemUoKSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgTW9uZ28gc2VydmVyIGFuZCB0aGUgTWV0ZW9yIHF1ZXJ5IGRpc2FncmVlIG9uIGhvdyAnICtcbiAgICAgICAgICAnbWFueSBkb2N1bWVudHMgbWF0Y2ggeW91ciBxdWVyeS4gQ3Vyc29yIGRlc2NyaXB0aW9uOiAnLFxuICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKTtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgXCJUaGUgTW9uZ28gc2VydmVyIGFuZCB0aGUgTWV0ZW9yIHF1ZXJ5IGRpc2FncmVlIG9uIGhvdyBcIiArXG4gICAgICAgICAgICBcIm1hbnkgZG9jdW1lbnRzIG1hdGNoIHlvdXIgcXVlcnkuIE1heWJlIGl0IGlzIGhpdHRpbmcgYSBNb25nbyBcIiArXG4gICAgICAgICAgICBcImVkZ2UgY2FzZT8gVGhlIHF1ZXJ5IGlzOiBcIiArXG4gICAgICAgICAgICBFSlNPTi5zdHJpbmdpZnkoc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpKTtcbiAgICAgIH1cbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIGlmICghbmV3UmVzdWx0cy5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IEVycm9yKFwiX3B1Ymxpc2hlZCBoYXMgYSBkb2MgdGhhdCBuZXdSZXN1bHRzIGRvZXNuJ3Q7IFwiICsgaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmFsbHksIHJlcGxhY2UgdGhlIGJ1ZmZlclxuICAgICAgbmV3QnVmZmVyLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIGRvYyk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gbmV3QnVmZmVyLnNpemUoKSA8IHNlbGYuX2xpbWl0O1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFRoaXMgc3RvcCBmdW5jdGlvbiBpcyBpbnZva2VkIGZyb20gdGhlIG9uU3RvcCBvZiB0aGUgT2JzZXJ2ZU11bHRpcGxleGVyLCBzb1xuICAvLyBpdCBzaG91bGRuJ3QgYWN0dWFsbHkgYmUgcG9zc2libGUgdG8gY2FsbCBpdCB1bnRpbCB0aGUgbXVsdGlwbGV4ZXIgaXNcbiAgLy8gcmVhZHkuXG4gIC8vXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIGNoZWNrIHNlbGYuX3N0b3BwZWQgYWZ0ZXIgZXZlcnkgY2FsbCBpbiB0aGlzIGZpbGUgdGhhdFxuICAvLyBjYW4geWllbGQhXG4gIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG4gICAgXy5lYWNoKHNlbGYuX3N0b3BIYW5kbGVzLCBmdW5jdGlvbiAoaGFuZGxlKSB7XG4gICAgICBoYW5kbGUuc3RvcCgpO1xuICAgIH0pO1xuXG4gICAgLy8gTm90ZTogd2UgKmRvbid0KiB1c2UgbXVsdGlwbGV4ZXIub25GbHVzaCBoZXJlIGJlY2F1c2UgdGhpcyBzdG9wXG4gICAgLy8gY2FsbGJhY2sgaXMgYWN0dWFsbHkgaW52b2tlZCBieSB0aGUgbXVsdGlwbGV4ZXIgaXRzZWxmIHdoZW4gaXQgaGFzXG4gICAgLy8gZGV0ZXJtaW5lZCB0aGF0IHRoZXJlIGFyZSBubyBoYW5kbGVzIGxlZnQuIFNvIG5vdGhpbmcgaXMgYWN0dWFsbHkgZ29pbmdcbiAgICAvLyB0byBnZXQgZmx1c2hlZCAoYW5kIGl0J3MgcHJvYmFibHkgbm90IHZhbGlkIHRvIGNhbGwgbWV0aG9kcyBvbiB0aGVcbiAgICAvLyBkeWluZyBtdWx0aXBsZXhlcikuXG4gICAgXy5lYWNoKHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHksIGZ1bmN0aW9uICh3KSB7XG4gICAgICB3LmNvbW1pdHRlZCgpOyAgLy8gbWF5YmUgeWllbGRzP1xuICAgIH0pO1xuICAgIHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkgPSBudWxsO1xuXG4gICAgLy8gUHJvYWN0aXZlbHkgZHJvcCByZWZlcmVuY2VzIHRvIHBvdGVudGlhbGx5IGJpZyB0aGluZ3MuXG4gICAgc2VsZi5fcHVibGlzaGVkID0gbnVsbDtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG51bGw7XG4gICAgc2VsZi5fbmVlZFRvRmV0Y2ggPSBudWxsO1xuICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgICBzZWxmLl9vcGxvZ0VudHJ5SGFuZGxlID0gbnVsbDtcbiAgICBzZWxmLl9saXN0ZW5lcnNIYW5kbGUgPSBudWxsO1xuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtZHJpdmVycy1vcGxvZ1wiLCAtMSk7XG4gIH0sXG5cbiAgX3JlZ2lzdGVyUGhhc2VDaGFuZ2U6IGZ1bmN0aW9uIChwaGFzZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbm93ID0gbmV3IERhdGU7XG5cbiAgICAgIGlmIChzZWxmLl9waGFzZSkge1xuICAgICAgICB2YXIgdGltZURpZmYgPSBub3cgLSBzZWxmLl9waGFzZVN0YXJ0VGltZTtcbiAgICAgICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJ0aW1lLXNwZW50LWluLVwiICsgc2VsZi5fcGhhc2UgKyBcIi1waGFzZVwiLCB0aW1lRGlmZik7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3BoYXNlID0gcGhhc2U7XG4gICAgICBzZWxmLl9waGFzZVN0YXJ0VGltZSA9IG5vdztcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIERvZXMgb3VyIG9wbG9nIHRhaWxpbmcgY29kZSBzdXBwb3J0IHRoaXMgY3Vyc29yPyBGb3Igbm93LCB3ZSBhcmUgYmVpbmcgdmVyeVxuLy8gY29uc2VydmF0aXZlIGFuZCBhbGxvd2luZyBvbmx5IHNpbXBsZSBxdWVyaWVzIHdpdGggc2ltcGxlIG9wdGlvbnMuXG4vLyAoVGhpcyBpcyBhIFwic3RhdGljIG1ldGhvZFwiLilcbk9wbG9nT2JzZXJ2ZURyaXZlci5jdXJzb3JTdXBwb3J0ZWQgPSBmdW5jdGlvbiAoY3Vyc29yRGVzY3JpcHRpb24sIG1hdGNoZXIpIHtcbiAgLy8gRmlyc3QsIGNoZWNrIHRoZSBvcHRpb25zLlxuICB2YXIgb3B0aW9ucyA9IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnM7XG5cbiAgLy8gRGlkIHRoZSB1c2VyIHNheSBubyBleHBsaWNpdGx5P1xuICAvLyB1bmRlcnNjb3JlZCB2ZXJzaW9uIG9mIHRoZSBvcHRpb24gaXMgQ09NUEFUIHdpdGggMS4yXG4gIGlmIChvcHRpb25zLmRpc2FibGVPcGxvZyB8fCBvcHRpb25zLl9kaXNhYmxlT3Bsb2cpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIHNraXAgaXMgbm90IHN1cHBvcnRlZDogdG8gc3VwcG9ydCBpdCB3ZSB3b3VsZCBuZWVkIHRvIGtlZXAgdHJhY2sgb2YgYWxsXG4gIC8vIFwic2tpcHBlZFwiIGRvY3VtZW50cyBvciBhdCBsZWFzdCB0aGVpciBpZHMuXG4gIC8vIGxpbWl0IHcvbyBhIHNvcnQgc3BlY2lmaWVyIGlzIG5vdCBzdXBwb3J0ZWQ6IGN1cnJlbnQgaW1wbGVtZW50YXRpb24gbmVlZHMgYVxuICAvLyBkZXRlcm1pbmlzdGljIHdheSB0byBvcmRlciBkb2N1bWVudHMuXG4gIGlmIChvcHRpb25zLnNraXAgfHwgKG9wdGlvbnMubGltaXQgJiYgIW9wdGlvbnMuc29ydCkpIHJldHVybiBmYWxzZTtcblxuICAvLyBJZiBhIGZpZWxkcyBwcm9qZWN0aW9uIG9wdGlvbiBpcyBnaXZlbiBjaGVjayBpZiBpdCBpcyBzdXBwb3J0ZWQgYnlcbiAgLy8gbWluaW1vbmdvIChzb21lIG9wZXJhdG9ycyBhcmUgbm90IHN1cHBvcnRlZCkuXG4gIGNvbnN0IGZpZWxkcyA9IG9wdGlvbnMuZmllbGRzIHx8IG9wdGlvbnMucHJvamVjdGlvbjtcbiAgaWYgKGZpZWxkcykge1xuICAgIHRyeSB7XG4gICAgICBMb2NhbENvbGxlY3Rpb24uX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbihmaWVsZHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLm5hbWUgPT09IFwiTWluaW1vbmdvRXJyb3JcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFdlIGRvbid0IGFsbG93IHRoZSBmb2xsb3dpbmcgc2VsZWN0b3JzOlxuICAvLyAgIC0gJHdoZXJlIChub3QgY29uZmlkZW50IHRoYXQgd2UgcHJvdmlkZSB0aGUgc2FtZSBKUyBlbnZpcm9ubWVudFxuICAvLyAgICAgICAgICAgICBhcyBNb25nbywgYW5kIGNhbiB5aWVsZCEpXG4gIC8vICAgLSAkbmVhciAoaGFzIFwiaW50ZXJlc3RpbmdcIiBwcm9wZXJ0aWVzIGluIE1vbmdvREIsIGxpa2UgdGhlIHBvc3NpYmlsaXR5XG4gIC8vICAgICAgICAgICAgb2YgcmV0dXJuaW5nIGFuIElEIG11bHRpcGxlIHRpbWVzLCB0aG91Z2ggZXZlbiBwb2xsaW5nIG1heWJlXG4gIC8vICAgICAgICAgICAgaGF2ZSBhIGJ1ZyB0aGVyZSlcbiAgLy8gICAgICAgICAgIFhYWDogb25jZSB3ZSBzdXBwb3J0IGl0LCB3ZSB3b3VsZCBuZWVkIHRvIHRoaW5rIG1vcmUgb24gaG93IHdlXG4gIC8vICAgICAgICAgICBpbml0aWFsaXplIHRoZSBjb21wYXJhdG9ycyB3aGVuIHdlIGNyZWF0ZSB0aGUgZHJpdmVyLlxuICByZXR1cm4gIW1hdGNoZXIuaGFzV2hlcmUoKSAmJiAhbWF0Y2hlci5oYXNHZW9RdWVyeSgpO1xufTtcblxudmFyIG1vZGlmaWVyQ2FuQmVEaXJlY3RseUFwcGxpZWQgPSBmdW5jdGlvbiAobW9kaWZpZXIpIHtcbiAgcmV0dXJuIF8uYWxsKG1vZGlmaWVyLCBmdW5jdGlvbiAoZmllbGRzLCBvcGVyYXRpb24pIHtcbiAgICByZXR1cm4gXy5hbGwoZmllbGRzLCBmdW5jdGlvbiAodmFsdWUsIGZpZWxkKSB7XG4gICAgICByZXR1cm4gIS9FSlNPTlxcJC8udGVzdChmaWVsZCk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuTW9uZ29JbnRlcm5hbHMuT3Bsb2dPYnNlcnZlRHJpdmVyID0gT3Bsb2dPYnNlcnZlRHJpdmVyO1xuIiwiLy8gQ29udmVydGVyIG9mIHRoZSBuZXcgTW9uZ29EQiBPcGxvZyBmb3JtYXQgKD49NS4wKSB0byB0aGUgb25lIHRoYXQgTWV0ZW9yXG4vLyBoYW5kbGVzIHdlbGwsIGkuZS4sIGAkc2V0YCBhbmQgYCR1bnNldGAuIFRoZSBuZXcgZm9ybWF0IGlzIGNvbXBsZXRlbHkgbmV3LFxuLy8gYW5kIGxvb2tzIGFzIGZvbGxvd3M6XG4vL1xuLy8gICB7ICR2OiAyLCBkaWZmOiBEaWZmIH1cbi8vXG4vLyB3aGVyZSBgRGlmZmAgaXMgYSByZWN1cnNpdmUgc3RydWN0dXJlOlxuLy9cbi8vICAge1xuLy8gICAgIC8vIE5lc3RlZCB1cGRhdGVzIChzb21ldGltZXMgYWxzbyByZXByZXNlbnRlZCB3aXRoIGFuIHMtZmllbGQpLlxuLy8gICAgIC8vIEV4YW1wbGU6IGB7ICRzZXQ6IHsgJ2Zvby5iYXInOiAxIH0gfWAuXG4vLyAgICAgaTogeyA8a2V5PjogPHZhbHVlPiwgLi4uIH0sXG4vL1xuLy8gICAgIC8vIFRvcC1sZXZlbCB1cGRhdGVzLlxuLy8gICAgIC8vIEV4YW1wbGU6IGB7ICRzZXQ6IHsgZm9vOiB7IGJhcjogMSB9IH0gfWAuXG4vLyAgICAgdTogeyA8a2V5PjogPHZhbHVlPiwgLi4uIH0sXG4vL1xuLy8gICAgIC8vIFVuc2V0cy5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkdW5zZXQ6IHsgZm9vOiAnJyB9IH1gLlxuLy8gICAgIGQ6IHsgPGtleT46IGZhbHNlLCAuLi4gfSxcbi8vXG4vLyAgICAgLy8gQXJyYXkgb3BlcmF0aW9ucy5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkcHVzaDogeyBmb286ICdiYXInIH0gfWAuXG4vLyAgICAgczxrZXk+OiB7IGE6IHRydWUsIHU8aW5kZXg+OiA8dmFsdWU+LCAuLi4gfSxcbi8vICAgICAuLi5cbi8vXG4vLyAgICAgLy8gTmVzdGVkIG9wZXJhdGlvbnMgKHNvbWV0aW1lcyBhbHNvIHJlcHJlc2VudGVkIGluIHRoZSBgaWAgZmllbGQpLlxuLy8gICAgIC8vIEV4YW1wbGU6IGB7ICRzZXQ6IHsgJ2Zvby5iYXInOiAxIH0gfWAuXG4vLyAgICAgczxrZXk+OiBEaWZmLFxuLy8gICAgIC4uLlxuLy8gICB9XG4vL1xuLy8gKGFsbCBmaWVsZHMgYXJlIG9wdGlvbmFsKS5cblxuZnVuY3Rpb24gam9pbihwcmVmaXgsIGtleSkge1xuICByZXR1cm4gcHJlZml4ID8gYCR7cHJlZml4fS4ke2tleX1gIDoga2V5O1xufVxuXG5jb25zdCBhcnJheU9wZXJhdG9yS2V5UmVnZXggPSAvXihhfFtzdV1cXGQrKSQvO1xuXG5mdW5jdGlvbiBpc0FycmF5T3BlcmF0b3JLZXkoZmllbGQpIHtcbiAgcmV0dXJuIGFycmF5T3BlcmF0b3JLZXlSZWdleC50ZXN0KGZpZWxkKTtcbn1cblxuZnVuY3Rpb24gaXNBcnJheU9wZXJhdG9yKG9wZXJhdG9yKSB7XG4gIHJldHVybiBvcGVyYXRvci5hID09PSB0cnVlICYmIE9iamVjdC5rZXlzKG9wZXJhdG9yKS5ldmVyeShpc0FycmF5T3BlcmF0b3JLZXkpO1xufVxuXG5mdW5jdGlvbiBmbGF0dGVuT2JqZWN0SW50byh0YXJnZXQsIHNvdXJjZSwgcHJlZml4KSB7XG4gIGlmIChBcnJheS5pc0FycmF5KHNvdXJjZSkgfHwgdHlwZW9mIHNvdXJjZSAhPT0gJ29iamVjdCcgfHwgc291cmNlID09PSBudWxsKSB7XG4gICAgdGFyZ2V0W3ByZWZpeF0gPSBzb3VyY2U7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHNvdXJjZSk7XG4gICAgaWYgKGVudHJpZXMubGVuZ3RoKSB7XG4gICAgICBlbnRyaWVzLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICBmbGF0dGVuT2JqZWN0SW50byh0YXJnZXQsIHZhbHVlLCBqb2luKHByZWZpeCwga2V5KSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0W3ByZWZpeF0gPSBzb3VyY2U7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IGxvZ0RlYnVnTWVzc2FnZXMgPSAhIXByb2Nlc3MuZW52Lk9QTE9HX0NPTlZFUlRFUl9ERUJVRztcblxuZnVuY3Rpb24gY29udmVydE9wbG9nRGlmZihvcGxvZ0VudHJ5LCBkaWZmLCBwcmVmaXgpIHtcbiAgaWYgKGxvZ0RlYnVnTWVzc2FnZXMpIHtcbiAgICBjb25zb2xlLmxvZyhgY29udmVydE9wbG9nRGlmZigke0pTT04uc3RyaW5naWZ5KG9wbG9nRW50cnkpfSwgJHtKU09OLnN0cmluZ2lmeShkaWZmKX0sICR7SlNPTi5zdHJpbmdpZnkocHJlZml4KX0pYCk7XG4gIH1cblxuICBPYmplY3QuZW50cmllcyhkaWZmKS5mb3JFYWNoKChbZGlmZktleSwgdmFsdWVdKSA9PiB7XG4gICAgaWYgKGRpZmZLZXkgPT09ICdkJykge1xuICAgICAgLy8gSGFuZGxlIGAkdW5zZXRgcy5cbiAgICAgIG9wbG9nRW50cnkuJHVuc2V0ID8/PSB7fTtcbiAgICAgIE9iamVjdC5rZXlzKHZhbHVlKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIG9wbG9nRW50cnkuJHVuc2V0W2pvaW4ocHJlZml4LCBrZXkpXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGRpZmZLZXkgPT09ICdpJykge1xuICAgICAgLy8gSGFuZGxlIChwb3RlbnRpYWxseSkgbmVzdGVkIGAkc2V0YHMuXG4gICAgICBvcGxvZ0VudHJ5LiRzZXQgPz89IHt9O1xuICAgICAgZmxhdHRlbk9iamVjdEludG8ob3Bsb2dFbnRyeS4kc2V0LCB2YWx1ZSwgcHJlZml4KTtcbiAgICB9IGVsc2UgaWYgKGRpZmZLZXkgPT09ICd1Jykge1xuICAgICAgLy8gSGFuZGxlIGZsYXQgYCRzZXRgcy5cbiAgICAgIG9wbG9nRW50cnkuJHNldCA/Pz0ge307XG4gICAgICBPYmplY3QuZW50cmllcyh2YWx1ZSkuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIG9wbG9nRW50cnkuJHNldFtqb2luKHByZWZpeCwga2V5KV0gPSB2YWx1ZTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBIYW5kbGUgcy1maWVsZHMuXG4gICAgICBjb25zdCBrZXkgPSBkaWZmS2V5LnNsaWNlKDEpO1xuICAgICAgaWYgKGlzQXJyYXlPcGVyYXRvcih2YWx1ZSkpIHtcbiAgICAgICAgLy8gQXJyYXkgb3BlcmF0b3IuXG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHZhbHVlKS5mb3JFYWNoKChbcG9zaXRpb24sIHZhbHVlXSkgPT4ge1xuICAgICAgICAgIGlmIChwb3NpdGlvbiA9PT0gJ2EnKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcG9zaXRpb25LZXkgPSBqb2luKGpvaW4ocHJlZml4LCBrZXkpLCBwb3NpdGlvbi5zbGljZSgxKSk7XG4gICAgICAgICAgaWYgKHBvc2l0aW9uWzBdID09PSAncycpIHtcbiAgICAgICAgICAgIGNvbnZlcnRPcGxvZ0RpZmYob3Bsb2dFbnRyeSwgdmFsdWUsIHBvc2l0aW9uS2V5KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICBvcGxvZ0VudHJ5LiR1bnNldCA/Pz0ge307XG4gICAgICAgICAgICBvcGxvZ0VudHJ5LiR1bnNldFtwb3NpdGlvbktleV0gPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcGxvZ0VudHJ5LiRzZXQgPz89IHt9O1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kc2V0W3Bvc2l0aW9uS2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGtleSkge1xuICAgICAgICAvLyBOZXN0ZWQgb2JqZWN0LlxuICAgICAgICBjb252ZXJ0T3Bsb2dEaWZmKG9wbG9nRW50cnksIHZhbHVlLCBqb2luKHByZWZpeCwga2V5KSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9wbG9nVjJWMUNvbnZlcnRlcihvcGxvZ0VudHJ5KSB7XG4gIC8vIFBhc3MtdGhyb3VnaCB2MSBhbmQgKHByb2JhYmx5KSBpbnZhbGlkIGVudHJpZXMuXG4gIGlmIChvcGxvZ0VudHJ5LiR2ICE9PSAyIHx8ICFvcGxvZ0VudHJ5LmRpZmYpIHtcbiAgICByZXR1cm4gb3Bsb2dFbnRyeTtcbiAgfVxuXG4gIGNvbnN0IGNvbnZlcnRlZE9wbG9nRW50cnkgPSB7ICR2OiAyIH07XG4gIGNvbnZlcnRPcGxvZ0RpZmYoY29udmVydGVkT3Bsb2dFbnRyeSwgb3Bsb2dFbnRyeS5kaWZmLCAnJyk7XG4gIHJldHVybiBjb252ZXJ0ZWRPcGxvZ0VudHJ5O1xufVxuIiwiLy8gc2luZ2xldG9uXG5leHBvcnQgY29uc3QgTG9jYWxDb2xsZWN0aW9uRHJpdmVyID0gbmV3IChjbGFzcyBMb2NhbENvbGxlY3Rpb25Ecml2ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm5vQ29ubkNvbGxlY3Rpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfVxuXG4gIG9wZW4obmFtZSwgY29ubikge1xuICAgIGlmICghIG5hbWUpIHtcbiAgICAgIHJldHVybiBuZXcgTG9jYWxDb2xsZWN0aW9uO1xuICAgIH1cblxuICAgIGlmICghIGNvbm4pIHtcbiAgICAgIHJldHVybiBlbnN1cmVDb2xsZWN0aW9uKG5hbWUsIHRoaXMubm9Db25uQ29sbGVjdGlvbnMpO1xuICAgIH1cblxuICAgIGlmICghIGNvbm4uX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zKSB7XG4gICAgICBjb25uLl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgfVxuXG4gICAgLy8gWFhYIGlzIHRoZXJlIGEgd2F5IHRvIGtlZXAgdHJhY2sgb2YgYSBjb25uZWN0aW9uJ3MgY29sbGVjdGlvbnMgd2l0aG91dFxuICAgIC8vIGRhbmdsaW5nIGl0IG9mZiB0aGUgY29ubmVjdGlvbiBvYmplY3Q/XG4gICAgcmV0dXJuIGVuc3VyZUNvbGxlY3Rpb24obmFtZSwgY29ubi5fbW9uZ29fbGl2ZWRhdGFfY29sbGVjdGlvbnMpO1xuICB9XG59KTtcblxuZnVuY3Rpb24gZW5zdXJlQ29sbGVjdGlvbihuYW1lLCBjb2xsZWN0aW9ucykge1xuICByZXR1cm4gKG5hbWUgaW4gY29sbGVjdGlvbnMpXG4gICAgPyBjb2xsZWN0aW9uc1tuYW1lXVxuICAgIDogY29sbGVjdGlvbnNbbmFtZV0gPSBuZXcgTG9jYWxDb2xsZWN0aW9uKG5hbWUpO1xufVxuIiwiTW9uZ29JbnRlcm5hbHMuUmVtb3RlQ29sbGVjdGlvbkRyaXZlciA9IGZ1bmN0aW9uIChcbiAgbW9uZ29fdXJsLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5tb25nbyA9IG5ldyBNb25nb0Nvbm5lY3Rpb24obW9uZ29fdXJsLCBvcHRpb25zKTtcbn07XG5cbmNvbnN0IFJFTU9URV9DT0xMRUNUSU9OX01FVEhPRFMgPSBbXG4gICdfY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbicsXG4gICdfZHJvcEluZGV4JyxcbiAgJ19lbnN1cmVJbmRleCcsXG4gICdjcmVhdGVJbmRleCcsXG4gICdjb3VudERvY3VtZW50cycsXG4gICdkcm9wQ29sbGVjdGlvbicsXG4gICdlc3RpbWF0ZWREb2N1bWVudENvdW50JyxcbiAgJ2ZpbmQnLFxuICAnZmluZE9uZScsXG4gICdpbnNlcnQnLFxuICAncmF3Q29sbGVjdGlvbicsXG4gICdyZW1vdmUnLFxuICAndXBkYXRlJyxcbiAgJ3Vwc2VydCcsXG5dO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvSW50ZXJuYWxzLlJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIucHJvdG90eXBlLCB7XG4gIG9wZW46IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXQgPSB7fTtcbiAgICBSRU1PVEVfQ09MTEVDVElPTl9NRVRIT0RTLmZvckVhY2goXG4gICAgICBmdW5jdGlvbiAobSkge1xuICAgICAgICByZXRbbV0gPSBfLmJpbmQoc2VsZi5tb25nb1ttXSwgc2VsZi5tb25nbywgbmFtZSk7XG4gICAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG59KTtcblxuLy8gQ3JlYXRlIHRoZSBzaW5nbGV0b24gUmVtb3RlQ29sbGVjdGlvbkRyaXZlciBvbmx5IG9uIGRlbWFuZCwgc28gd2Vcbi8vIG9ubHkgcmVxdWlyZSBNb25nbyBjb25maWd1cmF0aW9uIGlmIGl0J3MgYWN0dWFsbHkgdXNlZCAoZWcsIG5vdCBpZlxuLy8geW91J3JlIG9ubHkgdHJ5aW5nIHRvIHJlY2VpdmUgZGF0YSBmcm9tIGEgcmVtb3RlIEREUCBzZXJ2ZXIuKVxuTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIgPSBfLm9uY2UoZnVuY3Rpb24gKCkge1xuICB2YXIgY29ubmVjdGlvbk9wdGlvbnMgPSB7fTtcblxuICB2YXIgbW9uZ29VcmwgPSBwcm9jZXNzLmVudi5NT05HT19VUkw7XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk1PTkdPX09QTE9HX1VSTCkge1xuICAgIGNvbm5lY3Rpb25PcHRpb25zLm9wbG9nVXJsID0gcHJvY2Vzcy5lbnYuTU9OR09fT1BMT0dfVVJMO1xuICB9XG5cbiAgaWYgKCEgbW9uZ29VcmwpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTU9OR09fVVJMIG11c3QgYmUgc2V0IGluIGVudmlyb25tZW50XCIpO1xuXG4gIGNvbnN0IGRyaXZlciA9IG5ldyBNb25nb0ludGVybmFscy5SZW1vdGVDb2xsZWN0aW9uRHJpdmVyKG1vbmdvVXJsLCBjb25uZWN0aW9uT3B0aW9ucyk7XG5cbiAgLy8gQXMgbWFueSBkZXBsb3ltZW50IHRvb2xzLCBpbmNsdWRpbmcgTWV0ZW9yIFVwLCBzZW5kIHJlcXVlc3RzIHRvIHRoZSBhcHAgaW5cbiAgLy8gb3JkZXIgdG8gY29uZmlybSB0aGF0IHRoZSBkZXBsb3ltZW50IGZpbmlzaGVkIHN1Y2Nlc3NmdWxseSwgaXQncyByZXF1aXJlZFxuICAvLyB0byBrbm93IGFib3V0IGEgZGF0YWJhc2UgY29ubmVjdGlvbiBwcm9ibGVtIGJlZm9yZSB0aGUgYXBwIHN0YXJ0cy4gRG9pbmcgc29cbiAgLy8gaW4gYSBgTWV0ZW9yLnN0YXJ0dXBgIGlzIGZpbmUsIGFzIHRoZSBgV2ViQXBwYCBoYW5kbGVzIHJlcXVlc3RzIG9ubHkgYWZ0ZXJcbiAgLy8gYWxsIGFyZSBmaW5pc2hlZC5cbiAgTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuICAgIFByb21pc2UuYXdhaXQoZHJpdmVyLm1vbmdvLmNsaWVudC5jb25uZWN0KCkpO1xuICB9KTtcblxuICByZXR1cm4gZHJpdmVyO1xufSk7XG4iLCIvLyBvcHRpb25zLmNvbm5lY3Rpb24sIGlmIGdpdmVuLCBpcyBhIExpdmVkYXRhQ2xpZW50IG9yIExpdmVkYXRhU2VydmVyXG4vLyBYWFggcHJlc2VudGx5IHRoZXJlIGlzIG5vIHdheSB0byBkZXN0cm95L2NsZWFuIHVwIGEgQ29sbGVjdGlvblxuaW1wb3J0IHtcbiAgQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTLFxuICBnZXRBc3luY01ldGhvZE5hbWVcbn0gZnJvbSBcIm1ldGVvci9taW5pbW9uZ28vY29uc3RhbnRzXCI7XG5cbmltcG9ydCB7IG5vcm1hbGl6ZVByb2plY3Rpb24gfSBmcm9tIFwiLi9tb25nb191dGlsc1wiO1xuXG4vKipcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgTW9uZ29EQi1yZWxhdGVkIGl0ZW1zXG4gKiBAbmFtZXNwYWNlXG4gKi9cbk1vbmdvID0ge307XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgQ29sbGVjdGlvblxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VuYW1lIGNvbGxlY3Rpb25cbiAqIEBjbGFzc1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24uICBJZiBudWxsLCBjcmVhdGVzIGFuIHVubWFuYWdlZCAodW5zeW5jaHJvbml6ZWQpIGxvY2FsIGNvbGxlY3Rpb24uXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5jb25uZWN0aW9uIFRoZSBzZXJ2ZXIgY29ubmVjdGlvbiB0aGF0IHdpbGwgbWFuYWdlIHRoaXMgY29sbGVjdGlvbi4gVXNlcyB0aGUgZGVmYXVsdCBjb25uZWN0aW9uIGlmIG5vdCBzcGVjaWZpZWQuICBQYXNzIHRoZSByZXR1cm4gdmFsdWUgb2YgY2FsbGluZyBbYEREUC5jb25uZWN0YF0oI2RkcF9jb25uZWN0KSB0byBzcGVjaWZ5IGEgZGlmZmVyZW50IHNlcnZlci4gUGFzcyBgbnVsbGAgdG8gc3BlY2lmeSBubyBjb25uZWN0aW9uLiBVbm1hbmFnZWQgKGBuYW1lYCBpcyBudWxsKSBjb2xsZWN0aW9ucyBjYW5ub3Qgc3BlY2lmeSBhIGNvbm5lY3Rpb24uXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5pZEdlbmVyYXRpb24gVGhlIG1ldGhvZCBvZiBnZW5lcmF0aW5nIHRoZSBgX2lkYCBmaWVsZHMgb2YgbmV3IGRvY3VtZW50cyBpbiB0aGlzIGNvbGxlY3Rpb24uICBQb3NzaWJsZSB2YWx1ZXM6XG5cbiAtICoqYCdTVFJJTkcnYCoqOiByYW5kb20gc3RyaW5nc1xuIC0gKipgJ01PTkdPJ2AqKjogIHJhbmRvbSBbYE1vbmdvLk9iamVjdElEYF0oI21vbmdvX29iamVjdF9pZCkgdmFsdWVzXG5cblRoZSBkZWZhdWx0IGlkIGdlbmVyYXRpb24gdGVjaG5pcXVlIGlzIGAnU1RSSU5HJ2AuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBBbiBvcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbi4gRG9jdW1lbnRzIHdpbGwgYmUgcGFzc2VkIHRocm91Z2ggdGhpcyBmdW5jdGlvbiBiZWZvcmUgYmVpbmcgcmV0dXJuZWQgZnJvbSBgZmV0Y2hgIG9yIGBmaW5kT25lYCwgYW5kIGJlZm9yZSBiZWluZyBwYXNzZWQgdG8gY2FsbGJhY2tzIG9mIGBvYnNlcnZlYCwgYG1hcGAsIGBmb3JFYWNoYCwgYGFsbG93YCwgYW5kIGBkZW55YC4gVHJhbnNmb3JtcyBhcmUgKm5vdCogYXBwbGllZCBmb3IgdGhlIGNhbGxiYWNrcyBvZiBgb2JzZXJ2ZUNoYW5nZXNgIG9yIHRvIGN1cnNvcnMgcmV0dXJuZWQgZnJvbSBwdWJsaXNoIGZ1bmN0aW9ucy5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5kZWZpbmVNdXRhdGlvbk1ldGhvZHMgU2V0IHRvIGBmYWxzZWAgdG8gc2tpcCBzZXR0aW5nIHVwIHRoZSBtdXRhdGlvbiBtZXRob2RzIHRoYXQgZW5hYmxlIGluc2VydC91cGRhdGUvcmVtb3ZlIGZyb20gY2xpZW50IGNvZGUuIERlZmF1bHQgYHRydWVgLlxuICovXG5Nb25nby5Db2xsZWN0aW9uID0gZnVuY3Rpb24gQ29sbGVjdGlvbihuYW1lLCBvcHRpb25zKSB7XG4gIGlmICghbmFtZSAmJiBuYW1lICE9PSBudWxsKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICdXYXJuaW5nOiBjcmVhdGluZyBhbm9ueW1vdXMgY29sbGVjdGlvbi4gSXQgd2lsbCBub3QgYmUgJyArXG4gICAgICAgICdzYXZlZCBvciBzeW5jaHJvbml6ZWQgb3ZlciB0aGUgbmV0d29yay4gKFBhc3MgbnVsbCBmb3IgJyArXG4gICAgICAgICd0aGUgY29sbGVjdGlvbiBuYW1lIHRvIHR1cm4gb2ZmIHRoaXMgd2FybmluZy4pJ1xuICAgICk7XG4gICAgbmFtZSA9IG51bGw7XG4gIH1cblxuICBpZiAobmFtZSAhPT0gbnVsbCAmJiB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnRmlyc3QgYXJndW1lbnQgdG8gbmV3IE1vbmdvLkNvbGxlY3Rpb24gbXVzdCBiZSBhIHN0cmluZyBvciBudWxsJ1xuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm1ldGhvZHMpIHtcbiAgICAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eSBoYWNrIHdpdGggb3JpZ2luYWwgc2lnbmF0dXJlICh3aGljaCBwYXNzZWRcbiAgICAvLyBcImNvbm5lY3Rpb25cIiBkaXJlY3RseSBpbnN0ZWFkIG9mIGluIG9wdGlvbnMuIChDb25uZWN0aW9ucyBtdXN0IGhhdmUgYSBcIm1ldGhvZHNcIlxuICAgIC8vIG1ldGhvZC4pXG4gICAgLy8gWFhYIHJlbW92ZSBiZWZvcmUgMS4wXG4gICAgb3B0aW9ucyA9IHsgY29ubmVjdGlvbjogb3B0aW9ucyB9O1xuICB9XG4gIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5OiBcImNvbm5lY3Rpb25cIiB1c2VkIHRvIGJlIGNhbGxlZCBcIm1hbmFnZXJcIi5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5tYW5hZ2VyICYmICFvcHRpb25zLmNvbm5lY3Rpb24pIHtcbiAgICBvcHRpb25zLmNvbm5lY3Rpb24gPSBvcHRpb25zLm1hbmFnZXI7XG4gIH1cblxuICBvcHRpb25zID0ge1xuICAgIGNvbm5lY3Rpb246IHVuZGVmaW5lZCxcbiAgICBpZEdlbmVyYXRpb246ICdTVFJJTkcnLFxuICAgIHRyYW5zZm9ybTogbnVsbCxcbiAgICBfZHJpdmVyOiB1bmRlZmluZWQsXG4gICAgX3ByZXZlbnRBdXRvcHVibGlzaDogZmFsc2UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcblxuICBzd2l0Y2ggKG9wdGlvbnMuaWRHZW5lcmF0aW9uKSB7XG4gICAgY2FzZSAnTU9OR08nOlxuICAgICAgdGhpcy5fbWFrZU5ld0lEID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzcmMgPSBuYW1lXG4gICAgICAgICAgPyBERFAucmFuZG9tU3RyZWFtKCcvY29sbGVjdGlvbi8nICsgbmFtZSlcbiAgICAgICAgICA6IFJhbmRvbS5pbnNlY3VyZTtcbiAgICAgICAgcmV0dXJuIG5ldyBNb25nby5PYmplY3RJRChzcmMuaGV4U3RyaW5nKDI0KSk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnU1RSSU5HJzpcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy5fbWFrZU5ld0lEID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzcmMgPSBuYW1lXG4gICAgICAgICAgPyBERFAucmFuZG9tU3RyZWFtKCcvY29sbGVjdGlvbi8nICsgbmFtZSlcbiAgICAgICAgICA6IFJhbmRvbS5pbnNlY3VyZTtcbiAgICAgICAgcmV0dXJuIHNyYy5pZCgpO1xuICAgICAgfTtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0ob3B0aW9ucy50cmFuc2Zvcm0pO1xuXG4gIGlmICghbmFtZSB8fCBvcHRpb25zLmNvbm5lY3Rpb24gPT09IG51bGwpXG4gICAgLy8gbm90ZTogbmFtZWxlc3MgY29sbGVjdGlvbnMgbmV2ZXIgaGF2ZSBhIGNvbm5lY3Rpb25cbiAgICB0aGlzLl9jb25uZWN0aW9uID0gbnVsbDtcbiAgZWxzZSBpZiAob3B0aW9ucy5jb25uZWN0aW9uKSB0aGlzLl9jb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICBlbHNlIGlmIChNZXRlb3IuaXNDbGllbnQpIHRoaXMuX2Nvbm5lY3Rpb24gPSBNZXRlb3IuY29ubmVjdGlvbjtcbiAgZWxzZSB0aGlzLl9jb25uZWN0aW9uID0gTWV0ZW9yLnNlcnZlcjtcblxuICBpZiAoIW9wdGlvbnMuX2RyaXZlcikge1xuICAgIC8vIFhYWCBUaGlzIGNoZWNrIGFzc3VtZXMgdGhhdCB3ZWJhcHAgaXMgbG9hZGVkIHNvIHRoYXQgTWV0ZW9yLnNlcnZlciAhPT1cbiAgICAvLyBudWxsLiBXZSBzaG91bGQgZnVsbHkgc3VwcG9ydCB0aGUgY2FzZSBvZiBcIndhbnQgdG8gdXNlIGEgTW9uZ28tYmFja2VkXG4gICAgLy8gY29sbGVjdGlvbiBmcm9tIE5vZGUgY29kZSB3aXRob3V0IHdlYmFwcFwiLCBidXQgd2UgZG9uJ3QgeWV0LlxuICAgIC8vICNNZXRlb3JTZXJ2ZXJOdWxsXG4gICAgaWYgKFxuICAgICAgbmFtZSAmJlxuICAgICAgdGhpcy5fY29ubmVjdGlvbiA9PT0gTWV0ZW9yLnNlcnZlciAmJlxuICAgICAgdHlwZW9mIE1vbmdvSW50ZXJuYWxzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXJcbiAgICApIHtcbiAgICAgIG9wdGlvbnMuX2RyaXZlciA9IE1vbmdvSW50ZXJuYWxzLmRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgTG9jYWxDb2xsZWN0aW9uRHJpdmVyIH0gPSByZXF1aXJlKCcuL2xvY2FsX2NvbGxlY3Rpb25fZHJpdmVyLmpzJyk7XG4gICAgICBvcHRpb25zLl9kcml2ZXIgPSBMb2NhbENvbGxlY3Rpb25Ecml2ZXI7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5fY29sbGVjdGlvbiA9IG9wdGlvbnMuX2RyaXZlci5vcGVuKG5hbWUsIHRoaXMuX2Nvbm5lY3Rpb24pO1xuICB0aGlzLl9uYW1lID0gbmFtZTtcbiAgdGhpcy5fZHJpdmVyID0gb3B0aW9ucy5fZHJpdmVyO1xuXG4gIHRoaXMuX21heWJlU2V0VXBSZXBsaWNhdGlvbihuYW1lLCBvcHRpb25zKTtcblxuICAvLyBYWFggZG9uJ3QgZGVmaW5lIHRoZXNlIHVudGlsIGFsbG93IG9yIGRlbnkgaXMgYWN0dWFsbHkgdXNlZCBmb3IgdGhpc1xuICAvLyBjb2xsZWN0aW9uLiBDb3VsZCBiZSBoYXJkIGlmIHRoZSBzZWN1cml0eSBydWxlcyBhcmUgb25seSBkZWZpbmVkIG9uIHRoZVxuICAvLyBzZXJ2ZXIuXG4gIGlmIChvcHRpb25zLmRlZmluZU11dGF0aW9uTWV0aG9kcyAhPT0gZmFsc2UpIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5fZGVmaW5lTXV0YXRpb25NZXRob2RzKHtcbiAgICAgICAgdXNlRXhpc3Rpbmc6IG9wdGlvbnMuX3N1cHByZXNzU2FtZU5hbWVFcnJvciA9PT0gdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBUaHJvdyBhIG1vcmUgdW5kZXJzdGFuZGFibGUgZXJyb3Igb24gdGhlIHNlcnZlciBmb3Igc2FtZSBjb2xsZWN0aW9uIG5hbWVcbiAgICAgIGlmIChcbiAgICAgICAgZXJyb3IubWVzc2FnZSA9PT0gYEEgbWV0aG9kIG5hbWVkICcvJHtuYW1lfS9pbnNlcnQnIGlzIGFscmVhZHkgZGVmaW5lZGBcbiAgICAgIClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGVyZSBpcyBhbHJlYWR5IGEgY29sbGVjdGlvbiBuYW1lZCBcIiR7bmFtZX1cImApO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLy8gYXV0b3B1Ymxpc2hcbiAgaWYgKFxuICAgIFBhY2thZ2UuYXV0b3B1Ymxpc2ggJiZcbiAgICAhb3B0aW9ucy5fcHJldmVudEF1dG9wdWJsaXNoICYmXG4gICAgdGhpcy5fY29ubmVjdGlvbiAmJlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24ucHVibGlzaFxuICApIHtcbiAgICB0aGlzLl9jb25uZWN0aW9uLnB1Ymxpc2gobnVsbCwgKCkgPT4gdGhpcy5maW5kKCksIHtcbiAgICAgIGlzX2F1dG86IHRydWUsXG4gICAgfSk7XG4gIH1cbn07XG5cbk9iamVjdC5hc3NpZ24oTW9uZ28uQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX21heWJlU2V0VXBSZXBsaWNhdGlvbihuYW1lLCB7IF9zdXBwcmVzc1NhbWVOYW1lRXJyb3IgPSBmYWxzZSB9KSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEoc2VsZi5fY29ubmVjdGlvbiAmJiBzZWxmLl9jb25uZWN0aW9uLnJlZ2lzdGVyU3RvcmUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gT0ssIHdlJ3JlIGdvaW5nIHRvIGJlIGEgc2xhdmUsIHJlcGxpY2F0aW5nIHNvbWUgcmVtb3RlXG4gICAgLy8gZGF0YWJhc2UsIGV4Y2VwdCBwb3NzaWJseSB3aXRoIHNvbWUgdGVtcG9yYXJ5IGRpdmVyZ2VuY2Ugd2hpbGVcbiAgICAvLyB3ZSBoYXZlIHVuYWNrbm93bGVkZ2VkIFJQQydzLlxuICAgIGNvbnN0IG9rID0gc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlKG5hbWUsIHtcbiAgICAgIC8vIENhbGxlZCBhdCB0aGUgYmVnaW5uaW5nIG9mIGEgYmF0Y2ggb2YgdXBkYXRlcy4gYmF0Y2hTaXplIGlzIHRoZSBudW1iZXJcbiAgICAgIC8vIG9mIHVwZGF0ZSBjYWxscyB0byBleHBlY3QuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIFRoaXMgaW50ZXJmYWNlIGlzIHByZXR0eSBqYW5reS4gcmVzZXQgcHJvYmFibHkgb3VnaHQgdG8gZ28gYmFjayB0b1xuICAgICAgLy8gYmVpbmcgaXRzIG93biBmdW5jdGlvbiwgYW5kIGNhbGxlcnMgc2hvdWxkbid0IGhhdmUgdG8gY2FsY3VsYXRlXG4gICAgICAvLyBiYXRjaFNpemUuIFRoZSBvcHRpbWl6YXRpb24gb2Ygbm90IGNhbGxpbmcgcGF1c2UvcmVtb3ZlIHNob3VsZCBiZVxuICAgICAgLy8gZGVsYXllZCB1bnRpbCBsYXRlcjogdGhlIGZpcnN0IGNhbGwgdG8gdXBkYXRlKCkgc2hvdWxkIGJ1ZmZlciBpdHNcbiAgICAgIC8vIG1lc3NhZ2UsIGFuZCB0aGVuIHdlIGNhbiBlaXRoZXIgZGlyZWN0bHkgYXBwbHkgaXQgYXQgZW5kVXBkYXRlIHRpbWUgaWZcbiAgICAgIC8vIGl0IHdhcyB0aGUgb25seSB1cGRhdGUsIG9yIGRvIHBhdXNlT2JzZXJ2ZXJzL2FwcGx5L2FwcGx5IGF0IHRoZSBuZXh0XG4gICAgICAvLyB1cGRhdGUoKSBpZiB0aGVyZSdzIGFub3RoZXIgb25lLlxuICAgICAgYmVnaW5VcGRhdGUoYmF0Y2hTaXplLCByZXNldCkge1xuICAgICAgICAvLyBwYXVzZSBvYnNlcnZlcnMgc28gdXNlcnMgZG9uJ3Qgc2VlIGZsaWNrZXIgd2hlbiB1cGRhdGluZyBzZXZlcmFsXG4gICAgICAgIC8vIG9iamVjdHMgYXQgb25jZSAoaW5jbHVkaW5nIHRoZSBwb3N0LXJlY29ubmVjdCByZXNldC1hbmQtcmVhcHBseVxuICAgICAgICAvLyBzdGFnZSksIGFuZCBzbyB0aGF0IGEgcmUtc29ydGluZyBvZiBhIHF1ZXJ5IGNhbiB0YWtlIGFkdmFudGFnZSBvZiB0aGVcbiAgICAgICAgLy8gZnVsbCBfZGlmZlF1ZXJ5IG1vdmVkIGNhbGN1bGF0aW9uIGluc3RlYWQgb2YgYXBwbHlpbmcgY2hhbmdlIG9uZSBhdCBhXG4gICAgICAgIC8vIHRpbWUuXG4gICAgICAgIGlmIChiYXRjaFNpemUgPiAxIHx8IHJlc2V0KSBzZWxmLl9jb2xsZWN0aW9uLnBhdXNlT2JzZXJ2ZXJzKCk7XG5cbiAgICAgICAgaWYgKHJlc2V0KSBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZSh7fSk7XG4gICAgICB9LFxuXG4gICAgICAvLyBBcHBseSBhbiB1cGRhdGUuXG4gICAgICAvLyBYWFggYmV0dGVyIHNwZWNpZnkgdGhpcyBpbnRlcmZhY2UgKG5vdCBpbiB0ZXJtcyBvZiBhIHdpcmUgbWVzc2FnZSk/XG4gICAgICB1cGRhdGUobXNnKSB7XG4gICAgICAgIHZhciBtb25nb0lkID0gTW9uZ29JRC5pZFBhcnNlKG1zZy5pZCk7XG4gICAgICAgIHZhciBkb2MgPSBzZWxmLl9jb2xsZWN0aW9uLl9kb2NzLmdldChtb25nb0lkKTtcblxuICAgICAgICAvL1doZW4gdGhlIHNlcnZlcidzIG1lcmdlYm94IGlzIGRpc2FibGVkIGZvciBhIGNvbGxlY3Rpb24sIHRoZSBjbGllbnQgbXVzdCBncmFjZWZ1bGx5IGhhbmRsZSBpdCB3aGVuOlxuICAgICAgICAvLyAqV2UgcmVjZWl2ZSBhbiBhZGRlZCBtZXNzYWdlIGZvciBhIGRvY3VtZW50IHRoYXQgaXMgYWxyZWFkeSB0aGVyZS4gSW5zdGVhZCwgaXQgd2lsbCBiZSBjaGFuZ2VkXG4gICAgICAgIC8vICpXZSByZWVpdmUgYSBjaGFuZ2UgbWVzc2FnZSBmb3IgYSBkb2N1bWVudCB0aGF0IGlzIG5vdCB0aGVyZS4gSW5zdGVhZCwgaXQgd2lsbCBiZSBhZGRlZFxuICAgICAgICAvLyAqV2UgcmVjZWl2ZSBhIHJlbW92ZWQgbWVzc3NhZ2UgZm9yIGEgZG9jdW1lbnQgdGhhdCBpcyBub3QgdGhlcmUuIEluc3RlYWQsIG5vdGluZyB3aWwgaGFwcGVuLlxuXG4gICAgICAgIC8vQ29kZSBpcyBkZXJpdmVkIGZyb20gY2xpZW50LXNpZGUgY29kZSBvcmlnaW5hbGx5IGluIHBlZXJsaWJyYXJ5OmNvbnRyb2wtbWVyZ2Vib3hcbiAgICAgICAgLy9odHRwczovL2dpdGh1Yi5jb20vcGVlcmxpYnJhcnkvbWV0ZW9yLWNvbnRyb2wtbWVyZ2Vib3gvYmxvYi9tYXN0ZXIvY2xpZW50LmNvZmZlZVxuXG4gICAgICAgIC8vRm9yIG1vcmUgaW5mb3JtYXRpb24sIHJlZmVyIHRvIGRpc2N1c3Npb24gXCJJbml0aWFsIHN1cHBvcnQgZm9yIHB1YmxpY2F0aW9uIHN0cmF0ZWdpZXMgaW4gbGl2ZWRhdGEgc2VydmVyXCI6XG4gICAgICAgIC8vaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvcHVsbC8xMTE1MVxuICAgICAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICAgICAgaWYgKG1zZy5tc2cgPT09ICdhZGRlZCcgJiYgZG9jKSB7XG4gICAgICAgICAgICBtc2cubXNnID0gJ2NoYW5nZWQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3JlbW92ZWQnICYmICFkb2MpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdjaGFuZ2VkJyAmJiAhZG9jKSB7XG4gICAgICAgICAgICBtc2cubXNnID0gJ2FkZGVkJztcbiAgICAgICAgICAgIF9yZWYgPSBtc2cuZmllbGRzO1xuICAgICAgICAgICAgZm9yIChmaWVsZCBpbiBfcmVmKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gX3JlZltmaWVsZF07XG4gICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIG1zZy5maWVsZHNbZmllbGRdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSXMgdGhpcyBhIFwicmVwbGFjZSB0aGUgd2hvbGUgZG9jXCIgbWVzc2FnZSBjb21pbmcgZnJvbSB0aGUgcXVpZXNjZW5jZVxuICAgICAgICAvLyBvZiBtZXRob2Qgd3JpdGVzIHRvIGFuIG9iamVjdD8gKE5vdGUgdGhhdCAndW5kZWZpbmVkJyBpcyBhIHZhbGlkXG4gICAgICAgIC8vIHZhbHVlIG1lYW5pbmcgXCJyZW1vdmUgaXRcIi4pXG4gICAgICAgIGlmIChtc2cubXNnID09PSAncmVwbGFjZScpIHtcbiAgICAgICAgICB2YXIgcmVwbGFjZSA9IG1zZy5yZXBsYWNlO1xuICAgICAgICAgIGlmICghcmVwbGFjZSkge1xuICAgICAgICAgICAgaWYgKGRvYykgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydChyZXBsYWNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gWFhYIGNoZWNrIHRoYXQgcmVwbGFjZSBoYXMgbm8gJCBvcHNcbiAgICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlKG1vbmdvSWQsIHJlcGxhY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2FkZGVkJykge1xuICAgICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIG5vdCB0byBmaW5kIGEgZG9jdW1lbnQgYWxyZWFkeSBwcmVzZW50IGZvciBhbiBhZGQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydCh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlKG1vbmdvSWQpO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdjaGFuZ2VkJykge1xuICAgICAgICAgIGlmICghZG9jKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCB0byBjaGFuZ2UnKTtcbiAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobXNnLmZpZWxkcyk7XG4gICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdmFyIG1vZGlmaWVyID0ge307XG4gICAgICAgICAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBtc2cuZmllbGRzW2tleV07XG4gICAgICAgICAgICAgIGlmIChFSlNPTi5lcXVhbHMoZG9jW2tleV0sIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHVuc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXQgPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuJHVuc2V0W2tleV0gPSAxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHNldCkge1xuICAgICAgICAgICAgICAgICAgbW9kaWZpZXIuJHNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMobW9kaWZpZXIpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgc2VsZi5fY29sbGVjdGlvbi51cGRhdGUobW9uZ29JZCwgbW9kaWZpZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJIGRvbid0IGtub3cgaG93IHRvIGRlYWwgd2l0aCB0aGlzIG1lc3NhZ2VcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8vIENhbGxlZCBhdCB0aGUgZW5kIG9mIGEgYmF0Y2ggb2YgdXBkYXRlcy5cbiAgICAgIGVuZFVwZGF0ZSgpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5yZXN1bWVPYnNlcnZlcnMoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIENhbGxlZCBhcm91bmQgbWV0aG9kIHN0dWIgaW52b2NhdGlvbnMgdG8gY2FwdHVyZSB0aGUgb3JpZ2luYWwgdmVyc2lvbnNcbiAgICAgIC8vIG9mIG1vZGlmaWVkIGRvY3VtZW50cy5cbiAgICAgIHNhdmVPcmlnaW5hbHMoKSB7XG4gICAgICAgIHNlbGYuX2NvbGxlY3Rpb24uc2F2ZU9yaWdpbmFscygpO1xuICAgICAgfSxcbiAgICAgIHJldHJpZXZlT3JpZ2luYWxzKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yZXRyaWV2ZU9yaWdpbmFscygpO1xuICAgICAgfSxcblxuICAgICAgLy8gVXNlZCB0byBwcmVzZXJ2ZSBjdXJyZW50IHZlcnNpb25zIG9mIGRvY3VtZW50cyBhY3Jvc3MgYSBzdG9yZSByZXNldC5cbiAgICAgIGdldERvYyhpZCkge1xuICAgICAgICByZXR1cm4gc2VsZi5maW5kT25lKGlkKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFRvIGJlIGFibGUgdG8gZ2V0IGJhY2sgdG8gdGhlIGNvbGxlY3Rpb24gZnJvbSB0aGUgc3RvcmUuXG4gICAgICBfZ2V0Q29sbGVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFvaykge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGBUaGVyZSBpcyBhbHJlYWR5IGEgY29sbGVjdGlvbiBuYW1lZCBcIiR7bmFtZX1cImA7XG4gICAgICBpZiAoX3N1cHByZXNzU2FtZU5hbWVFcnJvciA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBYWFggSW4gdGhlb3J5IHdlIGRvIG5vdCBoYXZlIHRvIHRocm93IHdoZW4gYG9rYCBpcyBmYWxzeS4gVGhlXG4gICAgICAgIC8vIHN0b3JlIGlzIGFscmVhZHkgZGVmaW5lZCBmb3IgdGhpcyBjb2xsZWN0aW9uIG5hbWUsIGJ1dCB0aGlzXG4gICAgICAgIC8vIHdpbGwgc2ltcGx5IGJlIGFub3RoZXIgcmVmZXJlbmNlIHRvIGl0IGFuZCBldmVyeXRoaW5nIHNob3VsZFxuICAgICAgICAvLyB3b3JrLiBIb3dldmVyLCB3ZSBoYXZlIGhpc3RvcmljYWxseSB0aHJvd24gYW4gZXJyb3IgaGVyZSwgc29cbiAgICAgICAgLy8gZm9yIG5vdyB3ZSB3aWxsIHNraXAgdGhlIGVycm9yIG9ubHkgd2hlbiBfc3VwcHJlc3NTYW1lTmFtZUVycm9yXG4gICAgICAgIC8vIGlzIGB0cnVlYCwgYWxsb3dpbmcgcGVvcGxlIHRvIG9wdCBpbiBhbmQgZ2l2ZSB0aGlzIHNvbWUgcmVhbFxuICAgICAgICAvLyB3b3JsZCB0ZXN0aW5nLlxuICAgICAgICBjb25zb2xlLndhcm4gPyBjb25zb2xlLndhcm4obWVzc2FnZSkgOiBjb25zb2xlLmxvZyhtZXNzYWdlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8vXG4gIC8vLyBNYWluIGNvbGxlY3Rpb24gQVBJXG4gIC8vL1xuICAvKipcbiAgICogQHN1bW1hcnkgR2V0cyB0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtYXRjaGluZyB0aGUgZmlsdGVyLiBGb3IgYSBmYXN0IGNvdW50IG9mIHRoZSB0b3RhbCBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHNlZSBgZXN0aW1hdGVkRG9jdW1lbnRDb3VudGAuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGNvdW50RG9jdW1lbnRzXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IFtzZWxlY3Rvcl0gQSBxdWVyeSBkZXNjcmliaW5nIHRoZSBkb2N1bWVudHMgdG8gY291bnRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS80LjExL2ludGVyZmFjZXMvQ291bnREb2N1bWVudHNPcHRpb25zLmh0bWwpLiBQbGVhc2Ugbm90ZSB0aGF0IG5vdCBhbGwgb2YgdGhlbSBhcmUgYXZhaWxhYmxlIG9uIHRoZSBjbGllbnQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59XG4gICAqL1xuICBjb3VudERvY3VtZW50cyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uY291bnREb2N1bWVudHMoLi4uYXJncyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgYW4gZXN0aW1hdGUgb2YgdGhlIGNvdW50IG9mIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gdXNpbmcgY29sbGVjdGlvbiBtZXRhZGF0YS4gRm9yIGFuIGV4YWN0IGNvdW50IG9mIHRoZSBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHNlZSBgY291bnREb2N1bWVudHNgLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBlc3RpbWF0ZWREb2N1bWVudENvdW50XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IFtzZWxlY3Rvcl0gQSBxdWVyeSBkZXNjcmliaW5nIHRoZSBkb2N1bWVudHMgdG8gY291bnRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS80LjExL2ludGVyZmFjZXMvRXN0aW1hdGVkRG9jdW1lbnRDb3VudE9wdGlvbnMuaHRtbCkuIFBsZWFzZSBub3RlIHRoYXQgbm90IGFsbCBvZiB0aGVtIGFyZSBhdmFpbGFibGUgb24gdGhlIGNsaWVudC5cbiAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICovXG4gIGVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncyk7XG4gIH0sXG5cbiAgX2dldEZpbmRTZWxlY3RvcihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09IDApIHJldHVybiB7fTtcbiAgICBlbHNlIHJldHVybiBhcmdzWzBdO1xuICB9LFxuXG4gIF9nZXRGaW5kT3B0aW9ucyhhcmdzKSB7XG4gICAgY29uc3QgWywgb3B0aW9uc10gPSBhcmdzIHx8IFtdO1xuICAgIGNvbnN0IG5ld09wdGlvbnMgPSBub3JtYWxpemVQcm9qZWN0aW9uKG9wdGlvbnMpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChhcmdzLmxlbmd0aCA8IDIpIHtcbiAgICAgIHJldHVybiB7IHRyYW5zZm9ybTogc2VsZi5fdHJhbnNmb3JtIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoZWNrKFxuICAgICAgICBuZXdPcHRpb25zLFxuICAgICAgICBNYXRjaC5PcHRpb25hbChcbiAgICAgICAgICBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuICAgICAgICAgICAgcHJvamVjdGlvbjogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoT2JqZWN0LCB1bmRlZmluZWQpKSxcbiAgICAgICAgICAgIHNvcnQ6IE1hdGNoLk9wdGlvbmFsKFxuICAgICAgICAgICAgICBNYXRjaC5PbmVPZihPYmplY3QsIEFycmF5LCBGdW5jdGlvbiwgdW5kZWZpbmVkKVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGxpbWl0OiBNYXRjaC5PcHRpb25hbChNYXRjaC5PbmVPZihOdW1iZXIsIHVuZGVmaW5lZCkpLFxuICAgICAgICAgICAgc2tpcDogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoTnVtYmVyLCB1bmRlZmluZWQpKSxcbiAgICAgICAgICB9KVxuICAgICAgICApXG4gICAgICApO1xuXG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRyYW5zZm9ybTogc2VsZi5fdHJhbnNmb3JtLFxuICAgICAgICAuLi5uZXdPcHRpb25zLFxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZpbmQgdGhlIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gdGhhdCBtYXRjaCB0aGUgc2VsZWN0b3IuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5saW1pdCBNYXhpbXVtIG51bWJlciBvZiByZXN1bHRzIHRvIHJldHVyblxuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IGB0cnVlYDsgcGFzcyBgZmFsc2VgIHRvIGRpc2FibGUgcmVhY3Rpdml0eVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlICBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5kaXNhYmxlT3Bsb2cgKFNlcnZlciBvbmx5KSBQYXNzIHRydWUgdG8gZGlzYWJsZSBvcGxvZy10YWlsaW5nIG9uIHRoaXMgcXVlcnkuIFRoaXMgYWZmZWN0cyB0aGUgd2F5IHNlcnZlciBwcm9jZXNzZXMgY2FsbHMgdG8gYG9ic2VydmVgIG9uIHRoaXMgcXVlcnkuIERpc2FibGluZyB0aGUgb3Bsb2cgY2FuIGJlIHVzZWZ1bCB3aGVuIHdvcmtpbmcgd2l0aCBkYXRhIHRoYXQgdXBkYXRlcyBpbiBsYXJnZSBiYXRjaGVzLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wb2xsaW5nSW50ZXJ2YWxNcyAoU2VydmVyIG9ubHkpIFdoZW4gb3Bsb2cgaXMgZGlzYWJsZWQgKHRocm91Z2ggdGhlIHVzZSBvZiBgZGlzYWJsZU9wbG9nYCBvciB3aGVuIG90aGVyd2lzZSBub3QgYXZhaWxhYmxlKSwgdGhlIGZyZXF1ZW5jeSAoaW4gbWlsbGlzZWNvbmRzKSBvZiBob3cgb2Z0ZW4gdG8gcG9sbCB0aGlzIHF1ZXJ5IHdoZW4gb2JzZXJ2aW5nIG9uIHRoZSBzZXJ2ZXIuIERlZmF1bHRzIHRvIDEwMDAwbXMgKDEwIHNlY29uZHMpLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wb2xsaW5nVGhyb3R0bGVNcyAoU2VydmVyIG9ubHkpIFdoZW4gb3Bsb2cgaXMgZGlzYWJsZWQgKHRocm91Z2ggdGhlIHVzZSBvZiBgZGlzYWJsZU9wbG9nYCBvciB3aGVuIG90aGVyd2lzZSBub3QgYXZhaWxhYmxlKSwgdGhlIG1pbmltdW0gdGltZSAoaW4gbWlsbGlzZWNvbmRzKSB0byBhbGxvdyBiZXR3ZWVuIHJlLXBvbGxpbmcgd2hlbiBvYnNlcnZpbmcgb24gdGhlIHNlcnZlci4gSW5jcmVhc2luZyB0aGlzIHdpbGwgc2F2ZSBDUFUgYW5kIG1vbmdvIGxvYWQgYXQgdGhlIGV4cGVuc2Ugb2Ygc2xvd2VyIHVwZGF0ZXMgdG8gdXNlcnMuIERlY3JlYXNpbmcgdGhpcyBpcyBub3QgcmVjb21tZW5kZWQuIERlZmF1bHRzIHRvIDUwbXMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLm1heFRpbWVNcyAoU2VydmVyIG9ubHkpIElmIHNldCwgaW5zdHJ1Y3RzIE1vbmdvREIgdG8gc2V0IGEgdGltZSBsaW1pdCBmb3IgdGhpcyBjdXJzb3IncyBvcGVyYXRpb25zLiBJZiB0aGUgb3BlcmF0aW9uIHJlYWNoZXMgdGhlIHNwZWNpZmllZCB0aW1lIGxpbWl0IChpbiBtaWxsaXNlY29uZHMpIHdpdGhvdXQgdGhlIGhhdmluZyBiZWVuIGNvbXBsZXRlZCwgYW4gZXhjZXB0aW9uIHdpbGwgYmUgdGhyb3duLiBVc2VmdWwgdG8gcHJldmVudCBhbiAoYWNjaWRlbnRhbCBvciBtYWxpY2lvdXMpIHVub3B0aW1pemVkIHF1ZXJ5IGZyb20gY2F1c2luZyBhIGZ1bGwgY29sbGVjdGlvbiBzY2FuIHRoYXQgd291bGQgZGlzcnVwdCBvdGhlciBkYXRhYmFzZSB1c2VycywgYXQgdGhlIGV4cGVuc2Ugb2YgbmVlZGluZyB0byBoYW5kbGUgdGhlIHJlc3VsdGluZyBlcnJvci5cbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBvcHRpb25zLmhpbnQgKFNlcnZlciBvbmx5KSBPdmVycmlkZXMgTW9uZ29EQidzIGRlZmF1bHQgaW5kZXggc2VsZWN0aW9uIGFuZCBxdWVyeSBvcHRpbWl6YXRpb24gcHJvY2Vzcy4gU3BlY2lmeSBhbiBpbmRleCB0byBmb3JjZSBpdHMgdXNlLCBlaXRoZXIgYnkgaXRzIG5hbWUgb3IgaW5kZXggc3BlY2lmaWNhdGlvbi4gWW91IGNhbiBhbHNvIHNwZWNpZnkgYHsgJG5hdHVyYWwgOiAxIH1gIHRvIGZvcmNlIGEgZm9yd2FyZHMgY29sbGVjdGlvbiBzY2FuLCBvciBgeyAkbmF0dXJhbCA6IC0xIH1gIGZvciBhIHJldmVyc2UgY29sbGVjdGlvbiBzY2FuLiBTZXR0aW5nIHRoaXMgaXMgb25seSByZWNvbW1lbmRlZCBmb3IgYWR2YW5jZWQgdXNlcnMuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciB0aGlzIHBhcnRpY3VsYXIgY3Vyc29yLiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge01vbmdvLkN1cnNvcn1cbiAgICovXG4gIGZpbmQoLi4uYXJncykge1xuICAgIC8vIENvbGxlY3Rpb24uZmluZCgpIChyZXR1cm4gYWxsIGRvY3MpIGJlaGF2ZXMgZGlmZmVyZW50bHlcbiAgICAvLyBmcm9tIENvbGxlY3Rpb24uZmluZCh1bmRlZmluZWQpIChyZXR1cm4gMCBkb2NzKS4gIHNvIGJlXG4gICAgLy8gY2FyZWZ1bCBhYm91dCB0aGUgbGVuZ3RoIG9mIGFyZ3VtZW50cy5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5maW5kKFxuICAgICAgdGhpcy5fZ2V0RmluZFNlbGVjdG9yKGFyZ3MpLFxuICAgICAgdGhpcy5fZ2V0RmluZE9wdGlvbnMoYXJncylcbiAgICApO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IHRydWU7IHBhc3MgZmFsc2UgdG8gZGlzYWJsZSByZWFjdGl2aXR5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKSBmb3IgdGhpcyBjdXJzb3IuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5yZWFkUHJlZmVyZW5jZSAoU2VydmVyIG9ubHkpIFNwZWNpZmllcyBhIGN1c3RvbSBNb25nb0RCIFtgcmVhZFByZWZlcmVuY2VgXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvcmVhZC1wcmVmZXJlbmNlKSBmb3IgZmV0Y2hpbmcgdGhlIGRvY3VtZW50LiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIGZpbmRPbmUoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmZpbmRPbmUoXG4gICAgICB0aGlzLl9nZXRGaW5kU2VsZWN0b3IoYXJncyksXG4gICAgICB0aGlzLl9nZXRGaW5kT3B0aW9ucyhhcmdzKVxuICAgICk7XG4gIH0sXG59KTtcblxuT2JqZWN0LmFzc2lnbihNb25nby5Db2xsZWN0aW9uLCB7XG4gIF9wdWJsaXNoQ3Vyc29yKGN1cnNvciwgc3ViLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIG9ic2VydmVIYW5kbGUgPSBjdXJzb3Iub2JzZXJ2ZUNoYW5nZXMoXG4gICAgICB7XG4gICAgICAgIGFkZGVkOiBmdW5jdGlvbihpZCwgZmllbGRzKSB7XG4gICAgICAgICAgc3ViLmFkZGVkKGNvbGxlY3Rpb24sIGlkLCBmaWVsZHMpO1xuICAgICAgICB9LFxuICAgICAgICBjaGFuZ2VkOiBmdW5jdGlvbihpZCwgZmllbGRzKSB7XG4gICAgICAgICAgc3ViLmNoYW5nZWQoY29sbGVjdGlvbiwgaWQsIGZpZWxkcyk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92ZWQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgc3ViLnJlbW92ZWQoY29sbGVjdGlvbiwgaWQpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC8vIFB1YmxpY2F0aW9ucyBkb24ndCBtdXRhdGUgdGhlIGRvY3VtZW50c1xuICAgICAgLy8gVGhpcyBpcyB0ZXN0ZWQgYnkgdGhlIGBsaXZlZGF0YSAtIHB1Ymxpc2ggY2FsbGJhY2tzIGNsb25lYCB0ZXN0XG4gICAgICB7IG5vbk11dGF0aW5nQ2FsbGJhY2tzOiB0cnVlIH1cbiAgICApO1xuXG4gICAgLy8gV2UgZG9uJ3QgY2FsbCBzdWIucmVhZHkoKSBoZXJlOiBpdCBnZXRzIGNhbGxlZCBpbiBsaXZlZGF0YV9zZXJ2ZXIsIGFmdGVyXG4gICAgLy8gcG9zc2libHkgY2FsbGluZyBfcHVibGlzaEN1cnNvciBvbiBtdWx0aXBsZSByZXR1cm5lZCBjdXJzb3JzLlxuXG4gICAgLy8gcmVnaXN0ZXIgc3RvcCBjYWxsYmFjayAoZXhwZWN0cyBsYW1iZGEgdy8gbm8gYXJncykuXG4gICAgc3ViLm9uU3RvcChmdW5jdGlvbigpIHtcbiAgICAgIG9ic2VydmVIYW5kbGUuc3RvcCgpO1xuICAgIH0pO1xuXG4gICAgLy8gcmV0dXJuIHRoZSBvYnNlcnZlSGFuZGxlIGluIGNhc2UgaXQgbmVlZHMgdG8gYmUgc3RvcHBlZCBlYXJseVxuICAgIHJldHVybiBvYnNlcnZlSGFuZGxlO1xuICB9LFxuXG4gIC8vIHByb3RlY3QgYWdhaW5zdCBkYW5nZXJvdXMgc2VsZWN0b3JzLiAgZmFsc2V5IGFuZCB7X2lkOiBmYWxzZXl9IGFyZSBib3RoXG4gIC8vIGxpa2VseSBwcm9ncmFtbWVyIGVycm9yLCBhbmQgbm90IHdoYXQgeW91IHdhbnQsIHBhcnRpY3VsYXJseSBmb3IgZGVzdHJ1Y3RpdmVcbiAgLy8gb3BlcmF0aW9ucy4gSWYgYSBmYWxzZXkgX2lkIGlzIHNlbnQgaW4sIGEgbmV3IHN0cmluZyBfaWQgd2lsbCBiZVxuICAvLyBnZW5lcmF0ZWQgYW5kIHJldHVybmVkOyBpZiBhIGZhbGxiYWNrSWQgaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmV0dXJuZWRcbiAgLy8gaW5zdGVhZC5cbiAgX3Jld3JpdGVTZWxlY3RvcihzZWxlY3RvciwgeyBmYWxsYmFja0lkIH0gPSB7fSkge1xuICAgIC8vIHNob3J0aGFuZCAtLSBzY2FsYXJzIG1hdGNoIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHNlbGVjdG9yID0geyBfaWQ6IHNlbGVjdG9yIH07XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShzZWxlY3RvcikpIHtcbiAgICAgIC8vIFRoaXMgaXMgY29uc2lzdGVudCB3aXRoIHRoZSBNb25nbyBjb25zb2xlIGl0c2VsZjsgaWYgd2UgZG9uJ3QgZG8gdGhpc1xuICAgICAgLy8gY2hlY2sgcGFzc2luZyBhbiBlbXB0eSBhcnJheSBlbmRzIHVwIHNlbGVjdGluZyBhbGwgaXRlbXNcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk1vbmdvIHNlbGVjdG9yIGNhbid0IGJlIGFuIGFycmF5LlwiKTtcbiAgICB9XG5cbiAgICBpZiAoIXNlbGVjdG9yIHx8ICgnX2lkJyBpbiBzZWxlY3RvciAmJiAhc2VsZWN0b3IuX2lkKSkge1xuICAgICAgLy8gY2FuJ3QgbWF0Y2ggYW55dGhpbmdcbiAgICAgIHJldHVybiB7IF9pZDogZmFsbGJhY2tJZCB8fCBSYW5kb20uaWQoKSB9O1xuICAgIH1cblxuICAgIHJldHVybiBzZWxlY3RvcjtcbiAgfSxcbn0pO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gIC8vICdpbnNlcnQnIGltbWVkaWF0ZWx5IHJldHVybnMgdGhlIGluc2VydGVkIGRvY3VtZW50J3MgbmV3IF9pZC5cbiAgLy8gVGhlIG90aGVycyByZXR1cm4gdmFsdWVzIGltbWVkaWF0ZWx5IGlmIHlvdSBhcmUgaW4gYSBzdHViLCBhbiBpbi1tZW1vcnlcbiAgLy8gdW5tYW5hZ2VkIGNvbGxlY3Rpb24sIG9yIGEgbW9uZ28tYmFja2VkIGNvbGxlY3Rpb24gYW5kIHlvdSBkb24ndCBwYXNzIGFcbiAgLy8gY2FsbGJhY2suICd1cGRhdGUnIGFuZCAncmVtb3ZlJyByZXR1cm4gdGhlIG51bWJlciBvZiBhZmZlY3RlZFxuICAvLyBkb2N1bWVudHMuICd1cHNlcnQnIHJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyAnbnVtYmVyQWZmZWN0ZWQnIGFuZCwgaWYgYW5cbiAgLy8gaW5zZXJ0IGhhcHBlbmVkLCAnaW5zZXJ0ZWRJZCcuXG4gIC8vXG4gIC8vIE90aGVyd2lzZSwgdGhlIHNlbWFudGljcyBhcmUgZXhhY3RseSBsaWtlIG90aGVyIG1ldGhvZHM6IHRoZXkgdGFrZVxuICAvLyBhIGNhbGxiYWNrIGFzIGFuIG9wdGlvbmFsIGxhc3QgYXJndW1lbnQ7IGlmIG5vIGNhbGxiYWNrIGlzXG4gIC8vIHByb3ZpZGVkLCB0aGV5IGJsb2NrIHVudGlsIHRoZSBvcGVyYXRpb24gaXMgY29tcGxldGUsIGFuZCB0aHJvdyBhblxuICAvLyBleGNlcHRpb24gaWYgaXQgZmFpbHM7IGlmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQsIHRoZW4gdGhleSBkb24ndFxuICAvLyBuZWNlc3NhcmlseSBibG9jaywgYW5kIHRoZXkgY2FsbCB0aGUgY2FsbGJhY2sgd2hlbiB0aGV5IGZpbmlzaCB3aXRoIGVycm9yIGFuZFxuICAvLyByZXN1bHQgYXJndW1lbnRzLiAgKFRoZSBpbnNlcnQgbWV0aG9kIHByb3ZpZGVzIHRoZSBkb2N1bWVudCBJRCBhcyBpdHMgcmVzdWx0O1xuICAvLyB1cGRhdGUgYW5kIHJlbW92ZSBwcm92aWRlIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgZG9jcyBhcyB0aGUgcmVzdWx0OyB1cHNlcnRcbiAgLy8gcHJvdmlkZXMgYW4gb2JqZWN0IHdpdGggbnVtYmVyQWZmZWN0ZWQgYW5kIG1heWJlIGluc2VydGVkSWQuKVxuICAvL1xuICAvLyBPbiB0aGUgY2xpZW50LCBibG9ja2luZyBpcyBpbXBvc3NpYmxlLCBzbyBpZiBhIGNhbGxiYWNrXG4gIC8vIGlzbid0IHByb3ZpZGVkLCB0aGV5IGp1c3QgcmV0dXJuIGltbWVkaWF0ZWx5IGFuZCBhbnkgZXJyb3JcbiAgLy8gaW5mb3JtYXRpb24gaXMgbG9zdC5cbiAgLy9cbiAgLy8gVGhlcmUncyBvbmUgbW9yZSB0d2Vhay4gT24gdGhlIGNsaWVudCwgaWYgeW91IGRvbid0IHByb3ZpZGUgYVxuICAvLyBjYWxsYmFjaywgdGhlbiBpZiB0aGVyZSBpcyBhbiBlcnJvciwgYSBtZXNzYWdlIHdpbGwgYmUgbG9nZ2VkIHdpdGhcbiAgLy8gTWV0ZW9yLl9kZWJ1Zy5cbiAgLy9cbiAgLy8gVGhlIGludGVudCAodGhvdWdoIHRoaXMgaXMgYWN0dWFsbHkgZGV0ZXJtaW5lZCBieSB0aGUgdW5kZXJseWluZ1xuICAvLyBkcml2ZXJzKSBpcyB0aGF0IHRoZSBvcGVyYXRpb25zIHNob3VsZCBiZSBkb25lIHN5bmNocm9ub3VzbHksIG5vdFxuICAvLyBnZW5lcmF0aW5nIHRoZWlyIHJlc3VsdCB1bnRpbCB0aGUgZGF0YWJhc2UgaGFzIGFja25vd2xlZGdlZFxuICAvLyB0aGVtLiBJbiB0aGUgZnV0dXJlIG1heWJlIHdlIHNob3VsZCBwcm92aWRlIGEgZmxhZyB0byB0dXJuIHRoaXNcbiAgLy8gb2ZmLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBJbnNlcnQgYSBkb2N1bWVudCBpbiB0aGUgY29sbGVjdGlvbi4gIFJldHVybnMgaXRzIHVuaXF1ZSBfaWQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBpbnNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkb2MgVGhlIGRvY3VtZW50IHRvIGluc2VydC4gTWF5IG5vdCB5ZXQgaGF2ZSBhbiBfaWQgYXR0cmlidXRlLCBpbiB3aGljaCBjYXNlIE1ldGVvciB3aWxsIGdlbmVyYXRlIG9uZSBmb3IgeW91LlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIE9wdGlvbmFsLiAgSWYgcHJlc2VudCwgY2FsbGVkIHdpdGggYW4gZXJyb3Igb2JqZWN0IGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQsIGlmIG5vIGVycm9yLCB0aGUgX2lkIGFzIHRoZSBzZWNvbmQuXG4gICAqL1xuICBpbnNlcnQoZG9jLCBjYWxsYmFjaykge1xuICAgIC8vIE1ha2Ugc3VyZSB3ZSB3ZXJlIHBhc3NlZCBhIGRvY3VtZW50IHRvIGluc2VydFxuICAgIGlmICghZG9jKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydCByZXF1aXJlcyBhbiBhcmd1bWVudCcpO1xuICAgIH1cblxuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNsb25lIG9mIHRoZSBkb2N1bWVudCwgcHJlc2VydmluZyBpdHMgcHJvdG90eXBlLlxuICAgIGRvYyA9IE9iamVjdC5jcmVhdGUoXG4gICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YoZG9jKSxcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKGRvYylcbiAgICApO1xuXG4gICAgaWYgKCdfaWQnIGluIGRvYykge1xuICAgICAgaWYgKFxuICAgICAgICAhZG9jLl9pZCB8fFxuICAgICAgICAhKHR5cGVvZiBkb2MuX2lkID09PSAnc3RyaW5nJyB8fCBkb2MuX2lkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdNZXRlb3IgcmVxdWlyZXMgZG9jdW1lbnQgX2lkIGZpZWxkcyB0byBiZSBub24tZW1wdHkgc3RyaW5ncyBvciBPYmplY3RJRHMnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBnZW5lcmF0ZUlkID0gdHJ1ZTtcblxuICAgICAgLy8gRG9uJ3QgZ2VuZXJhdGUgdGhlIGlkIGlmIHdlJ3JlIHRoZSBjbGllbnQgYW5kIHRoZSAnb3V0ZXJtb3N0JyBjYWxsXG4gICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBzYXZlcyB1cyBwYXNzaW5nIGJvdGggdGhlIHJhbmRvbVNlZWQgYW5kIHRoZSBpZFxuICAgICAgLy8gUGFzc2luZyBib3RoIGlzIHJlZHVuZGFudC5cbiAgICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgICBjb25zdCBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgICAgICBpZiAoIWVuY2xvc2luZykge1xuICAgICAgICAgIGdlbmVyYXRlSWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2VuZXJhdGVJZCkge1xuICAgICAgICBkb2MuX2lkID0gdGhpcy5fbWFrZU5ld0lEKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gT24gaW5zZXJ0cywgYWx3YXlzIHJldHVybiB0aGUgaWQgdGhhdCB3ZSBnZW5lcmF0ZWQ7IG9uIGFsbCBvdGhlclxuICAgIC8vIG9wZXJhdGlvbnMsIGp1c3QgcmV0dXJuIHRoZSByZXN1bHQgZnJvbSB0aGUgY29sbGVjdGlvbi5cbiAgICB2YXIgY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCA9IGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgaWYgKGRvYy5faWQpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5faWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCB3aGF0IGlzIHRoaXMgZm9yPz9cbiAgICAgIC8vIEl0J3Mgc29tZSBpdGVyYWN0aW9uIGJldHdlZW4gdGhlIGNhbGxiYWNrIHRvIF9jYWxsTXV0YXRvck1ldGhvZCBhbmRcbiAgICAgIC8vIHRoZSByZXR1cm4gdmFsdWUgY29udmVyc2lvblxuICAgICAgZG9jLl9pZCA9IHJlc3VsdDtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgY29uc3Qgd3JhcHBlZENhbGxiYWNrID0gd3JhcENhbGxiYWNrKFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0XG4gICAgKTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fY2FsbE11dGF0b3JNZXRob2QoJ2luc2VydCcsIFtkb2NdLCB3cmFwcGVkQ2FsbGJhY2spO1xuICAgICAgcmV0dXJuIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQocmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2NvbGxlY3Rpb24uaW5zZXJ0KGRvYywgd3JhcHBlZENhbGxiYWNrKTtcbiAgICAgIHJldHVybiBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KHJlc3VsdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBNb2RpZnkgb25lIG9yIG1vcmUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbWF0Y2hlZCBkb2N1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIG1vZGlmeVxuICAgKiBAcGFyYW0ge01vbmdvTW9kaWZpZXJ9IG1vZGlmaWVyIFNwZWNpZmllcyBob3cgdG8gbW9kaWZ5IHRoZSBkb2N1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubXVsdGkgVHJ1ZSB0byBtb2RpZnkgYWxsIG1hdGNoaW5nIGRvY3VtZW50czsgZmFsc2UgdG8gb25seSBtb2RpZnkgb25lIG9mIHRoZSBtYXRjaGluZyBkb2N1bWVudHMgKHRoZSBkZWZhdWx0KS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVwc2VydCBUcnVlIHRvIGluc2VydCBhIGRvY3VtZW50IGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50cyBhcmUgZm91bmQuXG4gICAqIEBwYXJhbSB7QXJyYXl9IG9wdGlvbnMuYXJyYXlGaWx0ZXJzIE9wdGlvbmFsLiBVc2VkIGluIGNvbWJpbmF0aW9uIHdpdGggTW9uZ29EQiBbZmlsdGVyZWQgcG9zaXRpb25hbCBvcGVyYXRvcl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2Uvb3BlcmF0b3IvdXBkYXRlL3Bvc2l0aW9uYWwtZmlsdGVyZWQvKSB0byBzcGVjaWZ5IHdoaWNoIGVsZW1lbnRzIHRvIG1vZGlmeSBpbiBhbiBhcnJheSBmaWVsZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIHVwZGF0ZShzZWxlY3RvciwgbW9kaWZpZXIsIC4uLm9wdGlvbnNBbmRDYWxsYmFjaykge1xuICAgIGNvbnN0IGNhbGxiYWNrID0gcG9wQ2FsbGJhY2tGcm9tQXJncyhvcHRpb25zQW5kQ2FsbGJhY2spO1xuXG4gICAgLy8gV2UndmUgYWxyZWFkeSBwb3BwZWQgb2ZmIHRoZSBjYWxsYmFjaywgc28gd2UgYXJlIGxlZnQgd2l0aCBhbiBhcnJheVxuICAgIC8vIG9mIG9uZSBvciB6ZXJvIGl0ZW1zXG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgLi4uKG9wdGlvbnNBbmRDYWxsYmFja1swXSB8fCBudWxsKSB9O1xuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICAvLyBzZXQgYGluc2VydGVkSWRgIGlmIGFic2VudC4gIGBpbnNlcnRlZElkYCBpcyBhIE1ldGVvciBleHRlbnNpb24uXG4gICAgICBpZiAob3B0aW9ucy5pbnNlcnRlZElkKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAhKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEXG4gICAgICAgICAgKVxuICAgICAgICApXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnRlZElkIG11c3QgYmUgc3RyaW5nIG9yIE9iamVjdElEJyk7XG4gICAgICAgIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7XG4gICAgICB9IGVsc2UgaWYgKCFzZWxlY3RvciB8fCAhc2VsZWN0b3IuX2lkKSB7XG4gICAgICAgIGluc2VydGVkSWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZWRJZCA9IHRydWU7XG4gICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9IGluc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHtcbiAgICAgIGZhbGxiYWNrSWQ6IGluc2VydGVkSWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCB3cmFwcGVkQ2FsbGJhY2sgPSB3cmFwQ2FsbGJhY2soY2FsbGJhY2spO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICBjb25zdCBhcmdzID0gW3NlbGVjdG9yLCBtb2RpZmllciwgb3B0aW9uc107XG5cbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZCgndXBkYXRlJywgYXJncywgd3JhcHBlZENhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnVwZGF0ZShcbiAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgIG1vZGlmaWVyLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB3cmFwcGVkQ2FsbGJhY2tcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZW1vdmUgZG9jdW1lbnRzIGZyb20gdGhlIGNvbGxlY3Rpb25cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgcmVtb3ZlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gT3B0aW9uYWwuICBJZiBwcmVzZW50LCBjYWxsZWQgd2l0aCBhbiBlcnJvciBvYmplY3QgYXMgaXRzIGFyZ3VtZW50LlxuICAgKi9cbiAgcmVtb3ZlKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgIHNlbGVjdG9yID0gTW9uZ28uQ29sbGVjdGlvbi5fcmV3cml0ZVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIGNvbnN0IHdyYXBwZWRDYWxsYmFjayA9IHdyYXBDYWxsYmFjayhjYWxsYmFjayk7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZCgncmVtb3ZlJywgW3NlbGVjdG9yXSwgd3JhcHBlZENhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnJlbW92ZShzZWxlY3Rvciwgd3JhcHBlZENhbGxiYWNrKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoaXMgY29sbGVjdGlvbiBpcyBzaW1wbHkgYSBtaW5pbW9uZ28gcmVwcmVzZW50YXRpb24gb2YgYSByZWFsXG4gIC8vIGRhdGFiYXNlIG9uIGFub3RoZXIgc2VydmVyXG4gIF9pc1JlbW90ZUNvbGxlY3Rpb24oKSB7XG4gICAgLy8gWFhYIHNlZSAjTWV0ZW9yU2VydmVyTnVsbFxuICAgIHJldHVybiB0aGlzLl9jb25uZWN0aW9uICYmIHRoaXMuX2Nvbm5lY3Rpb24gIT09IE1ldGVvci5zZXJ2ZXI7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIE9wdGlvbmFsLiAgSWYgcHJlc2VudCwgY2FsbGVkIHdpdGggYW4gZXJyb3Igb2JqZWN0IGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQsIGlmIG5vIGVycm9yLCB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3VtZW50cyBhcyB0aGUgc2Vjb25kLlxuICAgKi9cbiAgdXBzZXJ0KHNlbGVjdG9yLCBtb2RpZmllciwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2RpZmllcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgX3JldHVybk9iamVjdDogdHJ1ZSxcbiAgICAgICAgdXBzZXJ0OiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGNhbGxiYWNrXG4gICAgKTtcbiAgfSxcblxuICAvLyBXZSdsbCBhY3R1YWxseSBkZXNpZ24gYW4gaW5kZXggQVBJIGxhdGVyLiBGb3Igbm93LCB3ZSBqdXN0IHBhc3MgdGhyb3VnaCB0b1xuICAvLyBNb25nbydzLCBidXQgbWFrZSBpdCBzeW5jaHJvbm91cy5cbiAgX2Vuc3VyZUluZGV4KGluZGV4LCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5fZW5zdXJlSW5kZXggfHwgIXNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXgpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgY3JlYXRlSW5kZXggb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgaWYgKHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXgpIHtcbiAgICAgIHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXgoaW5kZXgsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbXBvcnQgeyBMb2cgfSBmcm9tICdtZXRlb3IvbG9nZ2luZyc7XG4gICAgICBMb2cuZGVidWcoYF9lbnN1cmVJbmRleCBoYXMgYmVlbiBkZXByZWNhdGVkLCBwbGVhc2UgdXNlIHRoZSBuZXcgJ2NyZWF0ZUluZGV4JyBpbnN0ZWFkJHtvcHRpb25zPy5uYW1lID8gYCwgaW5kZXggbmFtZTogJHtvcHRpb25zLm5hbWV9YCA6IGAsIGluZGV4OiAke0pTT04uc3RyaW5naWZ5KGluZGV4KX1gfWApXG4gICAgICBzZWxmLl9jb2xsZWN0aW9uLl9lbnN1cmVJbmRleChpbmRleCwgb3B0aW9ucyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDcmVhdGVzIHRoZSBzcGVjaWZpZWQgaW5kZXggb24gdGhlIGNvbGxlY3Rpb24uXG4gICAqIEBsb2N1cyBzZXJ2ZXJcbiAgICogQG1ldGhvZCBjcmVhdGVJbmRleFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGluZGV4IEEgZG9jdW1lbnQgdGhhdCBjb250YWlucyB0aGUgZmllbGQgYW5kIHZhbHVlIHBhaXJzIHdoZXJlIHRoZSBmaWVsZCBpcyB0aGUgaW5kZXgga2V5IGFuZCB0aGUgdmFsdWUgZGVzY3JpYmVzIHRoZSB0eXBlIG9mIGluZGV4IGZvciB0aGF0IGZpZWxkLiBGb3IgYW4gYXNjZW5kaW5nIGluZGV4IG9uIGEgZmllbGQsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgMWA7IGZvciBkZXNjZW5kaW5nIGluZGV4LCBzcGVjaWZ5IGEgdmFsdWUgb2YgYC0xYC4gVXNlIGB0ZXh0YCBmb3IgdGV4dCBpbmRleGVzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEFsbCBvcHRpb25zIGFyZSBsaXN0ZWQgaW4gW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2UvbWV0aG9kL2RiLmNvbGxlY3Rpb24uY3JlYXRlSW5kZXgvI29wdGlvbnMpXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLm5hbWUgTmFtZSBvZiB0aGUgaW5kZXhcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVuaXF1ZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggdmFsdWVzIG11c3QgYmUgdW5pcXVlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC11bmlxdWUvKVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMuc3BhcnNlIERlZmluZSB0aGF0IHRoZSBpbmRleCBpcyBzcGFyc2UsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXNwYXJzZS8pXG4gICAqL1xuICBjcmVhdGVJbmRleChpbmRleCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXgpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgY3JlYXRlSW5kZXggb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgdHJ5IHtcbiAgICAgIHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXgoaW5kZXgsIG9wdGlvbnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLm1lc3NhZ2UuaW5jbHVkZXMoJ0FuIGVxdWl2YWxlbnQgaW5kZXggYWxyZWFkeSBleGlzdHMgd2l0aCB0aGUgc2FtZSBuYW1lIGJ1dCBkaWZmZXJlbnQgb3B0aW9ucy4nKSAmJiBNZXRlb3Iuc2V0dGluZ3M/LnBhY2thZ2VzPy5tb25nbz8ucmVDcmVhdGVJbmRleE9uT3B0aW9uTWlzbWF0Y2gpIHtcbiAgICAgICAgaW1wb3J0IHsgTG9nIH0gZnJvbSAnbWV0ZW9yL2xvZ2dpbmcnO1xuXG4gICAgICAgIExvZy5pbmZvKGBSZS1jcmVhdGluZyBpbmRleCAke2luZGV4fSBmb3IgJHtzZWxmLl9uYW1lfSBkdWUgdG8gb3B0aW9ucyBtaXNtYXRjaC5gKTtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5fZHJvcEluZGV4KGluZGV4KTtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleChpbmRleCwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKGBBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGNyZWF0aW5nIGFuIGluZGV4IGZvciBjb2xsZWN0aW9uIFwiJHtzZWxmLl9uYW1lfTogJHtlLm1lc3NhZ2V9YCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIF9kcm9wSW5kZXgoaW5kZXgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLl9kcm9wSW5kZXgpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgX2Ryb3BJbmRleCBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICBzZWxmLl9jb2xsZWN0aW9uLl9kcm9wSW5kZXgoaW5kZXgpO1xuICB9LFxuXG4gIF9kcm9wQ29sbGVjdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLmRyb3BDb2xsZWN0aW9uKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBjYWxsIF9kcm9wQ29sbGVjdGlvbiBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICBzZWxmLl9jb2xsZWN0aW9uLmRyb3BDb2xsZWN0aW9uKCk7XG4gIH0sXG5cbiAgX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24oYnl0ZVNpemUsIG1heERvY3VtZW50cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24pXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdDYW4gb25seSBjYWxsIF9jcmVhdGVDYXBwZWRDb2xsZWN0aW9uIG9uIHNlcnZlciBjb2xsZWN0aW9ucydcbiAgICAgICk7XG4gICAgc2VsZi5fY29sbGVjdGlvbi5fY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbihieXRlU2l6ZSwgbWF4RG9jdW1lbnRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJucyB0aGUgW2BDb2xsZWN0aW9uYF0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL2FwaS9Db2xsZWN0aW9uLmh0bWwpIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoaXMgY29sbGVjdGlvbiBmcm9tIHRoZSBbbnBtIGBtb25nb2RiYCBkcml2ZXIgbW9kdWxlXShodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9tb25nb2RiKSB3aGljaCBpcyB3cmFwcGVkIGJ5IGBNb25nby5Db2xsZWN0aW9uYC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHJhd0NvbGxlY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5yYXdDb2xsZWN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgcmF3Q29sbGVjdGlvbiBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24ucmF3Q29sbGVjdGlvbigpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBbYERiYF0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL2FwaS9EYi5odG1sKSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGlzIGNvbGxlY3Rpb24ncyBkYXRhYmFzZSBjb25uZWN0aW9uIGZyb20gdGhlIFtucG0gYG1vbmdvZGJgIGRyaXZlciBtb2R1bGVdKGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL21vbmdvZGIpIHdoaWNoIGlzIHdyYXBwZWQgYnkgYE1vbmdvLkNvbGxlY3Rpb25gLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmF3RGF0YWJhc2UoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghKHNlbGYuX2RyaXZlci5tb25nbyAmJiBzZWxmLl9kcml2ZXIubW9uZ28uZGIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgcmF3RGF0YWJhc2Ugb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmLl9kcml2ZXIubW9uZ28uZGI7XG4gIH0sXG59KTtcblxuLy8gQ29udmVydCB0aGUgY2FsbGJhY2sgdG8gbm90IHJldHVybiBhIHJlc3VsdCBpZiB0aGVyZSBpcyBhbiBlcnJvclxuZnVuY3Rpb24gd3JhcENhbGxiYWNrKGNhbGxiYWNrLCBjb252ZXJ0UmVzdWx0KSB7XG4gIHJldHVybiAoXG4gICAgY2FsbGJhY2sgJiZcbiAgICBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udmVydFJlc3VsdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayhlcnJvciwgY29udmVydFJlc3VsdChyZXN1bHQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgKTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDcmVhdGUgYSBNb25nby1zdHlsZSBgT2JqZWN0SURgLiAgSWYgeW91IGRvbid0IHNwZWNpZnkgYSBgaGV4U3RyaW5nYCwgdGhlIGBPYmplY3RJRGAgd2lsbCBnZW5lcmF0ZWQgcmFuZG9tbHkgKG5vdCB1c2luZyBNb25nb0RCJ3MgSUQgY29uc3RydWN0aW9uIHJ1bGVzKS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGNsYXNzXG4gKiBAcGFyYW0ge1N0cmluZ30gW2hleFN0cmluZ10gT3B0aW9uYWwuICBUaGUgMjQtY2hhcmFjdGVyIGhleGFkZWNpbWFsIGNvbnRlbnRzIG9mIHRoZSBPYmplY3RJRCB0byBjcmVhdGVcbiAqL1xuTW9uZ28uT2JqZWN0SUQgPSBNb25nb0lELk9iamVjdElEO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRvIGNyZWF0ZSBhIGN1cnNvciwgdXNlIGZpbmQuIFRvIGFjY2VzcyB0aGUgZG9jdW1lbnRzIGluIGEgY3Vyc29yLCB1c2UgZm9yRWFjaCwgbWFwLCBvciBmZXRjaC5cbiAqIEBjbGFzc1xuICogQGluc3RhbmNlTmFtZSBjdXJzb3JcbiAqL1xuTW9uZ28uQ3Vyc29yID0gTG9jYWxDb2xsZWN0aW9uLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLkN1cnNvciA9IE1vbmdvLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLk9iamVjdElEID0gTW9uZ28uT2JqZWN0SUQ7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWQgaW4gMC45LjFcbiAqL1xuTWV0ZW9yLkNvbGxlY3Rpb24gPSBNb25nby5Db2xsZWN0aW9uO1xuXG4vLyBBbGxvdyBkZW55IHN0dWZmIGlzIG5vdyBpbiB0aGUgYWxsb3ctZGVueSBwYWNrYWdlXG5PYmplY3QuYXNzaWduKE1ldGVvci5Db2xsZWN0aW9uLnByb3RvdHlwZSwgQWxsb3dEZW55LkNvbGxlY3Rpb25Qcm90b3R5cGUpO1xuXG5mdW5jdGlvbiBwb3BDYWxsYmFja0Zyb21BcmdzKGFyZ3MpIHtcbiAgLy8gUHVsbCBvZmYgYW55IGNhbGxiYWNrIChvciBwZXJoYXBzIGEgJ2NhbGxiYWNrJyB2YXJpYWJsZSB0aGF0IHdhcyBwYXNzZWRcbiAgLy8gaW4gdW5kZWZpbmVkLCBsaWtlIGhvdyAndXBzZXJ0JyBkb2VzIGl0KS5cbiAgaWYgKFxuICAgIGFyZ3MubGVuZ3RoICYmXG4gICAgKGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBGdW5jdGlvbilcbiAgKSB7XG4gICAgcmV0dXJuIGFyZ3MucG9wKCk7XG4gIH1cbn1cblxuQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTLmZvckVhY2gobWV0aG9kTmFtZSA9PiB7XG4gIGNvbnN0IG1ldGhvZE5hbWVBc3luYyA9IGdldEFzeW5jTWV0aG9kTmFtZShtZXRob2ROYW1lKTtcbiAgTW9uZ28uQ29sbGVjdGlvbi5wcm90b3R5cGVbbWV0aG9kTmFtZUFzeW5jXSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXNbbWV0aG9kTmFtZV0oLi4uYXJncykpO1xuICB9O1xufSk7XG4iLCIvKipcbiAqIEBzdW1tYXJ5IEFsbG93cyBmb3IgdXNlciBzcGVjaWZpZWQgY29ubmVjdGlvbiBvcHRpb25zXG4gKiBAZXhhbXBsZSBodHRwOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS8zLjAvcmVmZXJlbmNlL2Nvbm5lY3RpbmcvY29ubmVjdGlvbi1zZXR0aW5ncy9cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFVzZXIgc3BlY2lmaWVkIE1vbmdvIGNvbm5lY3Rpb24gb3B0aW9uc1xuICovXG5Nb25nby5zZXRDb25uZWN0aW9uT3B0aW9ucyA9IGZ1bmN0aW9uIHNldENvbm5lY3Rpb25PcHRpb25zIChvcHRpb25zKSB7XG4gIGNoZWNrKG9wdGlvbnMsIE9iamVjdCk7XG4gIE1vbmdvLl9jb25uZWN0aW9uT3B0aW9ucyA9IG9wdGlvbnM7XG59OyIsImV4cG9ydCBjb25zdCBub3JtYWxpemVQcm9qZWN0aW9uID0gb3B0aW9ucyA9PiB7XG4gIC8vIHRyYW5zZm9ybSBmaWVsZHMga2V5IGluIHByb2plY3Rpb25cbiAgY29uc3QgeyBmaWVsZHMsIHByb2plY3Rpb24sIC4uLm90aGVyT3B0aW9ucyB9ID0gb3B0aW9ucyB8fCB7fTtcbiAgLy8gVE9ETzogZW5hYmxlIHRoaXMgY29tbWVudCB3aGVuIGRlcHJlY2F0aW5nIHRoZSBmaWVsZHMgb3B0aW9uXG4gIC8vIExvZy5kZWJ1ZyhgZmllbGRzIG9wdGlvbiBoYXMgYmVlbiBkZXByZWNhdGVkLCBwbGVhc2UgdXNlIHRoZSBuZXcgJ3Byb2plY3Rpb24nIGluc3RlYWRgKVxuXG4gIHJldHVybiB7XG4gICAgLi4ub3RoZXJPcHRpb25zLFxuICAgIC4uLihwcm9qZWN0aW9uIHx8IGZpZWxkcyA/IHsgcHJvamVjdGlvbjogZmllbGRzIHx8IHByb2plY3Rpb24gfSA6IHt9KSxcbiAgfTtcbn07XG4iXX0=
