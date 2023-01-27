(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var check = Package.check.check;
var Match = Package.check.Match;
var EJSON = Package.ejson.EJSON;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var AllowDeny;

var require = meteorInstall({"node_modules":{"meteor":{"allow-deny":{"allow-deny.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/allow-deny/allow-deny.js                                                                              //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
///
/// Remote methods and access control.
///

const hasOwn = Object.prototype.hasOwnProperty;

// Restrict default mutators on collection. allow() and deny() take the
// same options:
//
// options.insert {Function(userId, doc)}
//   return true to allow/deny adding this document
//
// options.update {Function(userId, docs, fields, modifier)}
//   return true to allow/deny updating these documents.
//   `fields` is passed as an array of fields that are to be modified
//
// options.remove {Function(userId, docs)}
//   return true to allow/deny removing these documents
//
// options.fetch {Array}
//   Fields to fetch for these validators. If any call to allow or deny
//   does not have this option then all fields are loaded.
//
// allow and deny can be called multiple times. The validators are
// evaluated as follows:
// - If neither deny() nor allow() has been called on the collection,
//   then the request is allowed if and only if the "insecure" smart
//   package is in use.
// - Otherwise, if any deny() function returns true, the request is denied.
// - Otherwise, if any allow() function returns true, the request is allowed.
// - Otherwise, the request is denied.
//
// Meteor may call your deny() and allow() functions in any order, and may not
// call all of them if it is able to make a decision without calling them all
// (so don't include side effects).

AllowDeny = {
  CollectionPrototype: {}
};

// In the `mongo` package, we will extend Mongo.Collection.prototype with these
// methods
const CollectionPrototype = AllowDeny.CollectionPrototype;

/**
 * @summary Allow users to write directly to this collection from client code, subject to limitations you define.
 * @locus Server
 * @method allow
 * @memberOf Mongo.Collection
 * @instance
 * @param {Object} options
 * @param {Function} options.insert,update,remove Functions that look at a proposed modification to the database and return true if it should be allowed.
 * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
 * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
 */
CollectionPrototype.allow = function (options) {
  addValidator(this, 'allow', options);
};

/**
 * @summary Override `allow` rules.
 * @locus Server
 * @method deny
 * @memberOf Mongo.Collection
 * @instance
 * @param {Object} options
 * @param {Function} options.insert,update,remove Functions that look at a proposed modification to the database and return true if it should be denied, even if an [allow](#allow) rule says otherwise.
 * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
 * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
 */
CollectionPrototype.deny = function (options) {
  addValidator(this, 'deny', options);
};
CollectionPrototype._defineMutationMethods = function (options) {
  const self = this;
  options = options || {};

  // set to true once we call any allow or deny methods. If true, use
  // allow/deny semantics. If false, use insecure mode semantics.
  self._restricted = false;

  // Insecure mode (default to allowing writes). Defaults to 'undefined' which
  // means insecure iff the insecure package is loaded. This property can be
  // overriden by tests or packages wishing to change insecure mode behavior of
  // their collections.
  self._insecure = undefined;
  self._validators = {
    insert: {
      allow: [],
      deny: []
    },
    update: {
      allow: [],
      deny: []
    },
    remove: {
      allow: [],
      deny: []
    },
    upsert: {
      allow: [],
      deny: []
    },
    // dummy arrays; can't set these!
    fetch: [],
    fetchAllFields: false
  };
  if (!self._name) return; // anonymous collection

  // XXX Think about method namespacing. Maybe methods should be
  // "Meteor:Mongo:insert/NAME"?
  self._prefix = '/' + self._name + '/';

  // Mutation Methods
  // Minimongo on the server gets no stubs; instead, by default
  // it wait()s until its result is ready, yielding.
  // This matches the behavior of macromongo on the server better.
  // XXX see #MeteorServerNull
  if (self._connection && (self._connection === Meteor.server || Meteor.isClient)) {
    const m = {};
    ['insert', 'update', 'remove'].forEach(method => {
      const methodName = self._prefix + method;
      if (options.useExisting) {
        const handlerPropName = Meteor.isClient ? '_methodHandlers' : 'method_handlers';
        // Do not try to create additional methods if this has already been called.
        // (Otherwise the .methods() call below will throw an error.)
        if (self._connection[handlerPropName] && typeof self._connection[handlerPropName][methodName] === 'function') return;
      }
      m[methodName] = function /* ... */
      () {
        // All the methods do their own validation, instead of using check().
        check(arguments, [Match.Any]);
        const args = Array.from(arguments);
        try {
          // For an insert, if the client didn't specify an _id, generate one
          // now; because this uses DDP.randomStream, it will be consistent with
          // what the client generated. We generate it now rather than later so
          // that if (eg) an allow/deny rule does an insert to the same
          // collection (not that it really should), the generated _id will
          // still be the first use of the stream and will be consistent.
          //
          // However, we don't actually stick the _id onto the document yet,
          // because we want allow/deny rules to be able to differentiate
          // between arbitrary client-specified _id fields and merely
          // client-controlled-via-randomSeed fields.
          let generatedId = null;
          if (method === "insert" && !hasOwn.call(args[0], '_id')) {
            generatedId = self._makeNewID();
          }
          if (this.isSimulation) {
            // In a client simulation, you can do any mutation (even with a
            // complex selector).
            if (generatedId !== null) args[0]._id = generatedId;
            return self._collection[method].apply(self._collection, args);
          }

          // This is the server receiving a method call from the client.

          // We don't allow arbitrary selectors in mutations from the client: only
          // single-ID selectors.
          if (method !== 'insert') throwIfSelectorIsNotId(args[0], method);
          if (self._restricted) {
            // short circuit if there is no way it will pass.
            if (self._validators[method].allow.length === 0) {
              throw new Meteor.Error(403, "Access denied. No allow validators set on restricted " + "collection for method '" + method + "'.");
            }
            const validatedMethodName = '_validated' + method.charAt(0).toUpperCase() + method.slice(1);
            args.unshift(this.userId);
            method === 'insert' && args.push(generatedId);
            return self[validatedMethodName].apply(self, args);
          } else if (self._isInsecure()) {
            if (generatedId !== null) args[0]._id = generatedId;
            // In insecure mode, allow any mutation (with a simple selector).
            // XXX This is kind of bogus.  Instead of blindly passing whatever
            //     we get from the network to this function, we should actually
            //     know the correct arguments for the function and pass just
            //     them.  For example, if you have an extraneous extra null
            //     argument and this is Mongo on the server, the .wrapAsync'd
            //     functions like update will get confused and pass the
            //     "fut.resolver()" in the wrong slot, where _update will never
            //     invoke it. Bam, broken DDP connection.  Probably should just
            //     take this whole method and write it three times, invoking
            //     helpers for the common code.
            return self._collection[method].apply(self._collection, args);
          } else {
            // In secure mode, if we haven't called allow or deny, then nothing
            // is permitted.
            throw new Meteor.Error(403, "Access denied");
          }
        } catch (e) {
          if (e.name === 'MongoError' ||
          // for old versions of MongoDB (probably not necessary but it's here just in case)
          e.name === 'BulkWriteError' ||
          // for newer versions of MongoDB (https://docs.mongodb.com/drivers/node/current/whats-new/#bulkwriteerror---mongobulkwriteerror)
          e.name === 'MongoBulkWriteError' || e.name === 'MinimongoError') {
            throw new Meteor.Error(409, e.toString());
          } else {
            throw e;
          }
        }
      };
    });
    self._connection.methods(m);
  }
};
CollectionPrototype._updateFetch = function (fields) {
  const self = this;
  if (!self._validators.fetchAllFields) {
    if (fields) {
      const union = Object.create(null);
      const add = names => names && names.forEach(name => union[name] = 1);
      add(self._validators.fetch);
      add(fields);
      self._validators.fetch = Object.keys(union);
    } else {
      self._validators.fetchAllFields = true;
      // clear fetch just to make sure we don't accidentally read it
      self._validators.fetch = null;
    }
  }
};
CollectionPrototype._isInsecure = function () {
  const self = this;
  if (self._insecure === undefined) return !!Package.insecure;
  return self._insecure;
};
CollectionPrototype._validatedInsert = function (userId, doc, generatedId) {
  const self = this;

  // call user validators.
  // Any deny returns true means denied.
  if (self._validators.insert.deny.some(validator => {
    return validator(userId, docToValidate(validator, doc, generatedId));
  })) {
    throw new Meteor.Error(403, "Access denied");
  }
  // Any allow returns true means proceed. Throw error if they all fail.
  if (self._validators.insert.allow.every(validator => {
    return !validator(userId, docToValidate(validator, doc, generatedId));
  })) {
    throw new Meteor.Error(403, "Access denied");
  }

  // If we generated an ID above, insert it now: after the validation, but
  // before actually inserting.
  if (generatedId !== null) doc._id = generatedId;
  self._collection.insert.call(self._collection, doc);
};

// Simulate a mongo `update` operation while validating that the access
// control rules set by calls to `allow/deny` are satisfied. If all
// pass, rewrite the mongo operation to use $in to set the list of
// document ids to change ##ValidatedChange
CollectionPrototype._validatedUpdate = function (userId, selector, mutator, options) {
  const self = this;
  check(mutator, Object);
  options = Object.assign(Object.create(null), options);
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) throw new Error("validated update should be of a single ID");

  // We don't support upserts because they don't fit nicely into allow/deny
  // rules.
  if (options.upsert) throw new Meteor.Error(403, "Access denied. Upserts not " + "allowed in a restricted collection.");
  const noReplaceError = "Access denied. In a restricted collection you can only" + " update documents, not replace them. Use a Mongo update operator, such " + "as '$set'.";
  const mutatorKeys = Object.keys(mutator);

  // compute modified fields
  const modifiedFields = {};
  if (mutatorKeys.length === 0) {
    throw new Meteor.Error(403, noReplaceError);
  }
  mutatorKeys.forEach(op => {
    const params = mutator[op];
    if (op.charAt(0) !== '$') {
      throw new Meteor.Error(403, noReplaceError);
    } else if (!hasOwn.call(ALLOWED_UPDATE_OPERATIONS, op)) {
      throw new Meteor.Error(403, "Access denied. Operator " + op + " not allowed in a restricted collection.");
    } else {
      Object.keys(params).forEach(field => {
        // treat dotted fields as if they are replacing their
        // top-level part
        if (field.indexOf('.') !== -1) field = field.substring(0, field.indexOf('.'));

        // record the field we are trying to change
        modifiedFields[field] = true;
      });
    }
  });
  const fields = Object.keys(modifiedFields);
  const findOptions = {
    transform: null
  };
  if (!self._validators.fetchAllFields) {
    findOptions.fields = {};
    self._validators.fetch.forEach(fieldName => {
      findOptions.fields[fieldName] = 1;
    });
  }
  const doc = self._collection.findOne(selector, findOptions);
  if (!doc)
    // none satisfied!
    return 0;

  // call user validators.
  // Any deny returns true means denied.
  if (self._validators.update.deny.some(validator => {
    const factoriedDoc = transformDoc(validator, doc);
    return validator(userId, factoriedDoc, fields, mutator);
  })) {
    throw new Meteor.Error(403, "Access denied");
  }
  // Any allow returns true means proceed. Throw error if they all fail.
  if (self._validators.update.allow.every(validator => {
    const factoriedDoc = transformDoc(validator, doc);
    return !validator(userId, factoriedDoc, fields, mutator);
  })) {
    throw new Meteor.Error(403, "Access denied");
  }
  options._forbidReplace = true;

  // Back when we supported arbitrary client-provided selectors, we actually
  // rewrote the selector to include an _id clause before passing to Mongo to
  // avoid races, but since selector is guaranteed to already just be an ID, we
  // don't have to any more.

  return self._collection.update.call(self._collection, selector, mutator, options);
};

// Only allow these operations in validated updates. Specifically
// whitelist operations, rather than blacklist, so new complex
// operations that are added aren't automatically allowed. A complex
// operation is one that does more than just modify its target
// field. For now this contains all update operations except '$rename'.
// http://docs.mongodb.org/manual/reference/operators/#update
const ALLOWED_UPDATE_OPERATIONS = {
  $inc: 1,
  $set: 1,
  $unset: 1,
  $addToSet: 1,
  $pop: 1,
  $pullAll: 1,
  $pull: 1,
  $pushAll: 1,
  $push: 1,
  $bit: 1
};

// Simulate a mongo `remove` operation while validating access control
// rules. See #ValidatedChange
CollectionPrototype._validatedRemove = function (userId, selector) {
  const self = this;
  const findOptions = {
    transform: null
  };
  if (!self._validators.fetchAllFields) {
    findOptions.fields = {};
    self._validators.fetch.forEach(fieldName => {
      findOptions.fields[fieldName] = 1;
    });
  }
  const doc = self._collection.findOne(selector, findOptions);
  if (!doc) return 0;

  // call user validators.
  // Any deny returns true means denied.
  if (self._validators.remove.deny.some(validator => {
    return validator(userId, transformDoc(validator, doc));
  })) {
    throw new Meteor.Error(403, "Access denied");
  }
  // Any allow returns true means proceed. Throw error if they all fail.
  if (self._validators.remove.allow.every(validator => {
    return !validator(userId, transformDoc(validator, doc));
  })) {
    throw new Meteor.Error(403, "Access denied");
  }

  // Back when we supported arbitrary client-provided selectors, we actually
  // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to
  // Mongo to avoid races, but since selector is guaranteed to already just be
  // an ID, we don't have to any more.

  return self._collection.remove.call(self._collection, selector);
};
CollectionPrototype._callMutatorMethod = function _callMutatorMethod(name, args, callback) {
  if (Meteor.isClient && !callback && !alreadyInSimulation()) {
    // Client can't block, so it can't report errors by exception,
    // only by callback. If they forget the callback, give them a
    // default one that logs the error, so they aren't totally
    // baffled if their writes don't work because their database is
    // down.
    // Don't give a default callback in simulation, because inside stubs we
    // want to return the results from the local collection immediately and
    // not force a callback.
    callback = function (err) {
      if (err) Meteor._debug(name + " failed", err);
    };
  }

  // For two out of three mutator methods, the first argument is a selector
  const firstArgIsSelector = name === "update" || name === "remove";
  if (firstArgIsSelector && !alreadyInSimulation()) {
    // If we're about to actually send an RPC, we should throw an error if
    // this is a non-ID selector, because the mutation methods only allow
    // single-ID selectors. (If we don't throw here, we'll see flicker.)
    throwIfSelectorIsNotId(args[0], name);
  }
  const mutatorMethodName = this._prefix + name;
  return this._connection.apply(mutatorMethodName, args, {
    returnStubValue: true
  }, callback);
};
function transformDoc(validator, doc) {
  if (validator.transform) return validator.transform(doc);
  return doc;
}
function docToValidate(validator, doc, generatedId) {
  let ret = doc;
  if (validator.transform) {
    ret = EJSON.clone(doc);
    // If you set a server-side transform on your collection, then you don't get
    // to tell the difference between "client specified the ID" and "server
    // generated the ID", because transforms expect to get _id.  If you want to
    // do that check, you can do it with a specific
    // `C.allow({insert: f, transform: null})` validator.
    if (generatedId !== null) {
      ret._id = generatedId;
    }
    ret = validator.transform(ret);
  }
  return ret;
}
function addValidator(collection, allowOrDeny, options) {
  // validate keys
  const validKeysRegEx = /^(?:insert|update|remove|fetch|transform)$/;
  Object.keys(options).forEach(key => {
    if (!validKeysRegEx.test(key)) throw new Error(allowOrDeny + ": Invalid key: " + key);
  });
  collection._restricted = true;
  ['insert', 'update', 'remove'].forEach(name => {
    if (hasOwn.call(options, name)) {
      if (!(options[name] instanceof Function)) {
        throw new Error(allowOrDeny + ": Value for `" + name + "` must be a function");
      }

      // If the transform is specified at all (including as 'null') in this
      // call, then take that; otherwise, take the transform from the
      // collection.
      if (options.transform === undefined) {
        options[name].transform = collection._transform; // already wrapped
      } else {
        options[name].transform = LocalCollection.wrapTransform(options.transform);
      }
      collection._validators[name][allowOrDeny].push(options[name]);
    }
  });

  // Only update the fetch fields if we're passed things that affect
  // fetching. This way allow({}) and allow({insert: f}) don't result in
  // setting fetchAllFields
  if (options.update || options.remove || options.fetch) {
    if (options.fetch && !(options.fetch instanceof Array)) {
      throw new Error(allowOrDeny + ": Value for `fetch` must be an array");
    }
    collection._updateFetch(options.fetch);
  }
}
function throwIfSelectorIsNotId(selector, methodName) {
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
    throw new Meteor.Error(403, "Not permitted. Untrusted code may only " + methodName + " documents by ID.");
  }
}
;

// Determine if we are in a DDP method simulation
function alreadyInSimulation() {
  var CurrentInvocation = DDP._CurrentMethodInvocation ||
  // For backwards compatibility, as explained in this issue:
  // https://github.com/meteor/meteor/issues/8947
  DDP._CurrentInvocation;
  const enclosing = CurrentInvocation.get();
  return enclosing && enclosing.isSimulation;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/allow-deny/allow-deny.js");

/* Exports */
Package._define("allow-deny", {
  AllowDeny: AllowDeny
});

})();

//# sourceURL=meteor://💻app/packages/allow-deny.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWxsb3ctZGVueS9hbGxvdy1kZW55LmpzIl0sIm5hbWVzIjpbImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiQWxsb3dEZW55IiwiQ29sbGVjdGlvblByb3RvdHlwZSIsImFsbG93Iiwib3B0aW9ucyIsImFkZFZhbGlkYXRvciIsImRlbnkiLCJfZGVmaW5lTXV0YXRpb25NZXRob2RzIiwic2VsZiIsIl9yZXN0cmljdGVkIiwiX2luc2VjdXJlIiwidW5kZWZpbmVkIiwiX3ZhbGlkYXRvcnMiLCJpbnNlcnQiLCJ1cGRhdGUiLCJyZW1vdmUiLCJ1cHNlcnQiLCJmZXRjaCIsImZldGNoQWxsRmllbGRzIiwiX25hbWUiLCJfcHJlZml4IiwiX2Nvbm5lY3Rpb24iLCJNZXRlb3IiLCJzZXJ2ZXIiLCJpc0NsaWVudCIsIm0iLCJmb3JFYWNoIiwibWV0aG9kIiwibWV0aG9kTmFtZSIsInVzZUV4aXN0aW5nIiwiaGFuZGxlclByb3BOYW1lIiwiY2hlY2siLCJhcmd1bWVudHMiLCJNYXRjaCIsIkFueSIsImFyZ3MiLCJBcnJheSIsImZyb20iLCJnZW5lcmF0ZWRJZCIsImNhbGwiLCJfbWFrZU5ld0lEIiwiaXNTaW11bGF0aW9uIiwiX2lkIiwiX2NvbGxlY3Rpb24iLCJhcHBseSIsInRocm93SWZTZWxlY3RvcklzTm90SWQiLCJsZW5ndGgiLCJFcnJvciIsInZhbGlkYXRlZE1ldGhvZE5hbWUiLCJjaGFyQXQiLCJ0b1VwcGVyQ2FzZSIsInNsaWNlIiwidW5zaGlmdCIsInVzZXJJZCIsInB1c2giLCJfaXNJbnNlY3VyZSIsImUiLCJuYW1lIiwidG9TdHJpbmciLCJtZXRob2RzIiwiX3VwZGF0ZUZldGNoIiwiZmllbGRzIiwidW5pb24iLCJjcmVhdGUiLCJhZGQiLCJuYW1lcyIsImtleXMiLCJQYWNrYWdlIiwiaW5zZWN1cmUiLCJfdmFsaWRhdGVkSW5zZXJ0IiwiZG9jIiwic29tZSIsInZhbGlkYXRvciIsImRvY1RvVmFsaWRhdGUiLCJldmVyeSIsIl92YWxpZGF0ZWRVcGRhdGUiLCJzZWxlY3RvciIsIm11dGF0b3IiLCJhc3NpZ24iLCJMb2NhbENvbGxlY3Rpb24iLCJfc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0Iiwibm9SZXBsYWNlRXJyb3IiLCJtdXRhdG9yS2V5cyIsIm1vZGlmaWVkRmllbGRzIiwib3AiLCJwYXJhbXMiLCJBTExPV0VEX1VQREFURV9PUEVSQVRJT05TIiwiZmllbGQiLCJpbmRleE9mIiwic3Vic3RyaW5nIiwiZmluZE9wdGlvbnMiLCJ0cmFuc2Zvcm0iLCJmaWVsZE5hbWUiLCJmaW5kT25lIiwiZmFjdG9yaWVkRG9jIiwidHJhbnNmb3JtRG9jIiwiX2ZvcmJpZFJlcGxhY2UiLCIkaW5jIiwiJHNldCIsIiR1bnNldCIsIiRhZGRUb1NldCIsIiRwb3AiLCIkcHVsbEFsbCIsIiRwdWxsIiwiJHB1c2hBbGwiLCIkcHVzaCIsIiRiaXQiLCJfdmFsaWRhdGVkUmVtb3ZlIiwiX2NhbGxNdXRhdG9yTWV0aG9kIiwiY2FsbGJhY2siLCJhbHJlYWR5SW5TaW11bGF0aW9uIiwiZXJyIiwiX2RlYnVnIiwiZmlyc3RBcmdJc1NlbGVjdG9yIiwibXV0YXRvck1ldGhvZE5hbWUiLCJyZXR1cm5TdHViVmFsdWUiLCJyZXQiLCJFSlNPTiIsImNsb25lIiwiY29sbGVjdGlvbiIsImFsbG93T3JEZW55IiwidmFsaWRLZXlzUmVnRXgiLCJrZXkiLCJ0ZXN0IiwiRnVuY3Rpb24iLCJfdHJhbnNmb3JtIiwid3JhcFRyYW5zZm9ybSIsIkN1cnJlbnRJbnZvY2F0aW9uIiwiRERQIiwiX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiZW5jbG9zaW5nIiwiZ2V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBOztBQUVBLE1BQU1BLE1BQU0sR0FBR0MsTUFBTSxDQUFDQyxTQUFTLENBQUNDLGNBQWM7O0FB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O0lBQ3JELElBQUliLE9BQU8sQ0FBQ2EsS0FBSyxJQUFJLEVBQUViLE9BQU8sQ0FBQ2EsS0FBSyxZQUFZbUIsS0FBSyxDQUFDLEVBQUU7TUFDdEQsTUFBTSxJQUFJVyxLQUFLLENBQUN5RSxXQUFXLEdBQUcsc0NBQXNDLENBQUM7SUFDdkU7SUFDQUQsVUFBVSxDQUFDM0QsWUFBWSxDQUFDeEQsT0FBTyxDQUFDYSxLQUFLLENBQUM7RUFDeEM7QUFDRjtBQUVBLFNBQVM0QixzQkFBc0IsQ0FBQytCLFFBQVEsRUFBRWhELFVBQVUsRUFBRTtFQUNwRCxJQUFJLENBQUNtRCxlQUFlLENBQUNDLDRCQUE0QixDQUFDSixRQUFRLENBQUMsRUFBRTtJQUMzRCxNQUFNLElBQUl0RCxNQUFNLENBQUN5QixLQUFLLENBQ3BCLEdBQUcsRUFBRSx5Q0FBeUMsR0FBR25CLFVBQVUsR0FDekQsbUJBQW1CLENBQUM7RUFDMUI7QUFDRjtBQUFDOztBQUVEO0FBQ0EsU0FBU2tGLG1CQUFtQixHQUFHO0VBQzdCLElBQUlpQixpQkFBaUIsR0FDbkJDLEdBQUcsQ0FBQ0Msd0JBQXdCO0VBQzVCO0VBQ0E7RUFDQUQsR0FBRyxDQUFDRSxrQkFBa0I7RUFFeEIsTUFBTUMsU0FBUyxHQUFHSixpQkFBaUIsQ0FBQ0ssR0FBRyxFQUFFO0VBQ3pDLE9BQU9ELFNBQVMsSUFBSUEsU0FBUyxDQUFDMUYsWUFBWTtBQUM1QyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9hbGxvdy1kZW55LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vXG4vLy8gUmVtb3RlIG1ldGhvZHMgYW5kIGFjY2VzcyBjb250cm9sLlxuLy8vXG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIFJlc3RyaWN0IGRlZmF1bHQgbXV0YXRvcnMgb24gY29sbGVjdGlvbi4gYWxsb3coKSBhbmQgZGVueSgpIHRha2UgdGhlXG4vLyBzYW1lIG9wdGlvbnM6XG4vL1xuLy8gb3B0aW9ucy5pbnNlcnQge0Z1bmN0aW9uKHVzZXJJZCwgZG9jKX1cbi8vICAgcmV0dXJuIHRydWUgdG8gYWxsb3cvZGVueSBhZGRpbmcgdGhpcyBkb2N1bWVudFxuLy9cbi8vIG9wdGlvbnMudXBkYXRlIHtGdW5jdGlvbih1c2VySWQsIGRvY3MsIGZpZWxkcywgbW9kaWZpZXIpfVxuLy8gICByZXR1cm4gdHJ1ZSB0byBhbGxvdy9kZW55IHVwZGF0aW5nIHRoZXNlIGRvY3VtZW50cy5cbi8vICAgYGZpZWxkc2AgaXMgcGFzc2VkIGFzIGFuIGFycmF5IG9mIGZpZWxkcyB0aGF0IGFyZSB0byBiZSBtb2RpZmllZFxuLy9cbi8vIG9wdGlvbnMucmVtb3ZlIHtGdW5jdGlvbih1c2VySWQsIGRvY3MpfVxuLy8gICByZXR1cm4gdHJ1ZSB0byBhbGxvdy9kZW55IHJlbW92aW5nIHRoZXNlIGRvY3VtZW50c1xuLy9cbi8vIG9wdGlvbnMuZmV0Y2gge0FycmF5fVxuLy8gICBGaWVsZHMgdG8gZmV0Y2ggZm9yIHRoZXNlIHZhbGlkYXRvcnMuIElmIGFueSBjYWxsIHRvIGFsbG93IG9yIGRlbnlcbi8vICAgZG9lcyBub3QgaGF2ZSB0aGlzIG9wdGlvbiB0aGVuIGFsbCBmaWVsZHMgYXJlIGxvYWRlZC5cbi8vXG4vLyBhbGxvdyBhbmQgZGVueSBjYW4gYmUgY2FsbGVkIG11bHRpcGxlIHRpbWVzLiBUaGUgdmFsaWRhdG9ycyBhcmVcbi8vIGV2YWx1YXRlZCBhcyBmb2xsb3dzOlxuLy8gLSBJZiBuZWl0aGVyIGRlbnkoKSBub3IgYWxsb3coKSBoYXMgYmVlbiBjYWxsZWQgb24gdGhlIGNvbGxlY3Rpb24sXG4vLyAgIHRoZW4gdGhlIHJlcXVlc3QgaXMgYWxsb3dlZCBpZiBhbmQgb25seSBpZiB0aGUgXCJpbnNlY3VyZVwiIHNtYXJ0XG4vLyAgIHBhY2thZ2UgaXMgaW4gdXNlLlxuLy8gLSBPdGhlcndpc2UsIGlmIGFueSBkZW55KCkgZnVuY3Rpb24gcmV0dXJucyB0cnVlLCB0aGUgcmVxdWVzdCBpcyBkZW5pZWQuXG4vLyAtIE90aGVyd2lzZSwgaWYgYW55IGFsbG93KCkgZnVuY3Rpb24gcmV0dXJucyB0cnVlLCB0aGUgcmVxdWVzdCBpcyBhbGxvd2VkLlxuLy8gLSBPdGhlcndpc2UsIHRoZSByZXF1ZXN0IGlzIGRlbmllZC5cbi8vXG4vLyBNZXRlb3IgbWF5IGNhbGwgeW91ciBkZW55KCkgYW5kIGFsbG93KCkgZnVuY3Rpb25zIGluIGFueSBvcmRlciwgYW5kIG1heSBub3Rcbi8vIGNhbGwgYWxsIG9mIHRoZW0gaWYgaXQgaXMgYWJsZSB0byBtYWtlIGEgZGVjaXNpb24gd2l0aG91dCBjYWxsaW5nIHRoZW0gYWxsXG4vLyAoc28gZG9uJ3QgaW5jbHVkZSBzaWRlIGVmZmVjdHMpLlxuXG5BbGxvd0RlbnkgPSB7XG4gIENvbGxlY3Rpb25Qcm90b3R5cGU6IHt9XG59O1xuXG4vLyBJbiB0aGUgYG1vbmdvYCBwYWNrYWdlLCB3ZSB3aWxsIGV4dGVuZCBNb25nby5Db2xsZWN0aW9uLnByb3RvdHlwZSB3aXRoIHRoZXNlXG4vLyBtZXRob2RzXG5jb25zdCBDb2xsZWN0aW9uUHJvdG90eXBlID0gQWxsb3dEZW55LkNvbGxlY3Rpb25Qcm90b3R5cGU7XG5cbi8qKlxuICogQHN1bW1hcnkgQWxsb3cgdXNlcnMgdG8gd3JpdGUgZGlyZWN0bHkgdG8gdGhpcyBjb2xsZWN0aW9uIGZyb20gY2xpZW50IGNvZGUsIHN1YmplY3QgdG8gbGltaXRhdGlvbnMgeW91IGRlZmluZS5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBtZXRob2QgYWxsb3dcbiAqIEBtZW1iZXJPZiBNb25nby5Db2xsZWN0aW9uXG4gKiBAaW5zdGFuY2VcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLmluc2VydCx1cGRhdGUscmVtb3ZlIEZ1bmN0aW9ucyB0aGF0IGxvb2sgYXQgYSBwcm9wb3NlZCBtb2RpZmljYXRpb24gdG8gdGhlIGRhdGFiYXNlIGFuZCByZXR1cm4gdHJ1ZSBpZiBpdCBzaG91bGQgYmUgYWxsb3dlZC5cbiAqIEBwYXJhbSB7U3RyaW5nW119IG9wdGlvbnMuZmV0Y2ggT3B0aW9uYWwgcGVyZm9ybWFuY2UgZW5oYW5jZW1lbnQuIExpbWl0cyB0aGUgZmllbGRzIHRoYXQgd2lsbCBiZSBmZXRjaGVkIGZyb20gdGhlIGRhdGFiYXNlIGZvciBpbnNwZWN0aW9uIGJ5IHlvdXIgYHVwZGF0ZWAgYW5kIGByZW1vdmVgIGZ1bmN0aW9ucy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgIFtgQ29sbGVjdGlvbmBdKCNjb2xsZWN0aW9ucykuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICovXG5Db2xsZWN0aW9uUHJvdG90eXBlLmFsbG93ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBhZGRWYWxpZGF0b3IodGhpcywgJ2FsbG93Jywgb3B0aW9ucyk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IE92ZXJyaWRlIGBhbGxvd2AgcnVsZXMuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAbWV0aG9kIGRlbnlcbiAqIEBtZW1iZXJPZiBNb25nby5Db2xsZWN0aW9uXG4gKiBAaW5zdGFuY2VcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLmluc2VydCx1cGRhdGUscmVtb3ZlIEZ1bmN0aW9ucyB0aGF0IGxvb2sgYXQgYSBwcm9wb3NlZCBtb2RpZmljYXRpb24gdG8gdGhlIGRhdGFiYXNlIGFuZCByZXR1cm4gdHJ1ZSBpZiBpdCBzaG91bGQgYmUgZGVuaWVkLCBldmVuIGlmIGFuIFthbGxvd10oI2FsbG93KSBydWxlIHNheXMgb3RoZXJ3aXNlLlxuICogQHBhcmFtIHtTdHJpbmdbXX0gb3B0aW9ucy5mZXRjaCBPcHRpb25hbCBwZXJmb3JtYW5jZSBlbmhhbmNlbWVudC4gTGltaXRzIHRoZSBmaWVsZHMgdGhhdCB3aWxsIGJlIGZldGNoZWQgZnJvbSB0aGUgZGF0YWJhc2UgZm9yIGluc3BlY3Rpb24gYnkgeW91ciBgdXBkYXRlYCBhbmQgYHJlbW92ZWAgZnVuY3Rpb25zLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSAgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKS4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gKi9cbkNvbGxlY3Rpb25Qcm90b3R5cGUuZGVueSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgYWRkVmFsaWRhdG9yKHRoaXMsICdkZW55Jywgb3B0aW9ucyk7XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl9kZWZpbmVNdXRhdGlvbk1ldGhvZHMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBzZXQgdG8gdHJ1ZSBvbmNlIHdlIGNhbGwgYW55IGFsbG93IG9yIGRlbnkgbWV0aG9kcy4gSWYgdHJ1ZSwgdXNlXG4gIC8vIGFsbG93L2Rlbnkgc2VtYW50aWNzLiBJZiBmYWxzZSwgdXNlIGluc2VjdXJlIG1vZGUgc2VtYW50aWNzLlxuICBzZWxmLl9yZXN0cmljdGVkID0gZmFsc2U7XG5cbiAgLy8gSW5zZWN1cmUgbW9kZSAoZGVmYXVsdCB0byBhbGxvd2luZyB3cml0ZXMpLiBEZWZhdWx0cyB0byAndW5kZWZpbmVkJyB3aGljaFxuICAvLyBtZWFucyBpbnNlY3VyZSBpZmYgdGhlIGluc2VjdXJlIHBhY2thZ2UgaXMgbG9hZGVkLiBUaGlzIHByb3BlcnR5IGNhbiBiZVxuICAvLyBvdmVycmlkZW4gYnkgdGVzdHMgb3IgcGFja2FnZXMgd2lzaGluZyB0byBjaGFuZ2UgaW5zZWN1cmUgbW9kZSBiZWhhdmlvciBvZlxuICAvLyB0aGVpciBjb2xsZWN0aW9ucy5cbiAgc2VsZi5faW5zZWN1cmUgPSB1bmRlZmluZWQ7XG5cbiAgc2VsZi5fdmFsaWRhdG9ycyA9IHtcbiAgICBpbnNlcnQ6IHthbGxvdzogW10sIGRlbnk6IFtdfSxcbiAgICB1cGRhdGU6IHthbGxvdzogW10sIGRlbnk6IFtdfSxcbiAgICByZW1vdmU6IHthbGxvdzogW10sIGRlbnk6IFtdfSxcbiAgICB1cHNlcnQ6IHthbGxvdzogW10sIGRlbnk6IFtdfSwgLy8gZHVtbXkgYXJyYXlzOyBjYW4ndCBzZXQgdGhlc2UhXG4gICAgZmV0Y2g6IFtdLFxuICAgIGZldGNoQWxsRmllbGRzOiBmYWxzZVxuICB9O1xuXG4gIGlmICghc2VsZi5fbmFtZSlcbiAgICByZXR1cm47IC8vIGFub255bW91cyBjb2xsZWN0aW9uXG5cbiAgLy8gWFhYIFRoaW5rIGFib3V0IG1ldGhvZCBuYW1lc3BhY2luZy4gTWF5YmUgbWV0aG9kcyBzaG91bGQgYmVcbiAgLy8gXCJNZXRlb3I6TW9uZ286aW5zZXJ0L05BTUVcIj9cbiAgc2VsZi5fcHJlZml4ID0gJy8nICsgc2VsZi5fbmFtZSArICcvJztcblxuICAvLyBNdXRhdGlvbiBNZXRob2RzXG4gIC8vIE1pbmltb25nbyBvbiB0aGUgc2VydmVyIGdldHMgbm8gc3R1YnM7IGluc3RlYWQsIGJ5IGRlZmF1bHRcbiAgLy8gaXQgd2FpdCgpcyB1bnRpbCBpdHMgcmVzdWx0IGlzIHJlYWR5LCB5aWVsZGluZy5cbiAgLy8gVGhpcyBtYXRjaGVzIHRoZSBiZWhhdmlvciBvZiBtYWNyb21vbmdvIG9uIHRoZSBzZXJ2ZXIgYmV0dGVyLlxuICAvLyBYWFggc2VlICNNZXRlb3JTZXJ2ZXJOdWxsXG4gIGlmIChzZWxmLl9jb25uZWN0aW9uICYmIChzZWxmLl9jb25uZWN0aW9uID09PSBNZXRlb3Iuc2VydmVyIHx8IE1ldGVvci5pc0NsaWVudCkpIHtcbiAgICBjb25zdCBtID0ge307XG5cbiAgICBbJ2luc2VydCcsICd1cGRhdGUnLCAncmVtb3ZlJ10uZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICBjb25zdCBtZXRob2ROYW1lID0gc2VsZi5fcHJlZml4ICsgbWV0aG9kO1xuXG4gICAgICBpZiAob3B0aW9ucy51c2VFeGlzdGluZykge1xuICAgICAgICBjb25zdCBoYW5kbGVyUHJvcE5hbWUgPSBNZXRlb3IuaXNDbGllbnQgPyAnX21ldGhvZEhhbmRsZXJzJyA6ICdtZXRob2RfaGFuZGxlcnMnO1xuICAgICAgICAvLyBEbyBub3QgdHJ5IHRvIGNyZWF0ZSBhZGRpdGlvbmFsIG1ldGhvZHMgaWYgdGhpcyBoYXMgYWxyZWFkeSBiZWVuIGNhbGxlZC5cbiAgICAgICAgLy8gKE90aGVyd2lzZSB0aGUgLm1ldGhvZHMoKSBjYWxsIGJlbG93IHdpbGwgdGhyb3cgYW4gZXJyb3IuKVxuICAgICAgICBpZiAoc2VsZi5fY29ubmVjdGlvbltoYW5kbGVyUHJvcE5hbWVdICYmXG4gICAgICAgICAgdHlwZW9mIHNlbGYuX2Nvbm5lY3Rpb25baGFuZGxlclByb3BOYW1lXVttZXRob2ROYW1lXSA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBtW21ldGhvZE5hbWVdID0gZnVuY3Rpb24gKC8qIC4uLiAqLykge1xuICAgICAgICAvLyBBbGwgdGhlIG1ldGhvZHMgZG8gdGhlaXIgb3duIHZhbGlkYXRpb24sIGluc3RlYWQgb2YgdXNpbmcgY2hlY2soKS5cbiAgICAgICAgY2hlY2soYXJndW1lbnRzLCBbTWF0Y2guQW55XSk7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5mcm9tKGFyZ3VtZW50cyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gRm9yIGFuIGluc2VydCwgaWYgdGhlIGNsaWVudCBkaWRuJ3Qgc3BlY2lmeSBhbiBfaWQsIGdlbmVyYXRlIG9uZVxuICAgICAgICAgIC8vIG5vdzsgYmVjYXVzZSB0aGlzIHVzZXMgRERQLnJhbmRvbVN0cmVhbSwgaXQgd2lsbCBiZSBjb25zaXN0ZW50IHdpdGhcbiAgICAgICAgICAvLyB3aGF0IHRoZSBjbGllbnQgZ2VuZXJhdGVkLiBXZSBnZW5lcmF0ZSBpdCBub3cgcmF0aGVyIHRoYW4gbGF0ZXIgc29cbiAgICAgICAgICAvLyB0aGF0IGlmIChlZykgYW4gYWxsb3cvZGVueSBydWxlIGRvZXMgYW4gaW5zZXJ0IHRvIHRoZSBzYW1lXG4gICAgICAgICAgLy8gY29sbGVjdGlvbiAobm90IHRoYXQgaXQgcmVhbGx5IHNob3VsZCksIHRoZSBnZW5lcmF0ZWQgX2lkIHdpbGxcbiAgICAgICAgICAvLyBzdGlsbCBiZSB0aGUgZmlyc3QgdXNlIG9mIHRoZSBzdHJlYW0gYW5kIHdpbGwgYmUgY29uc2lzdGVudC5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIEhvd2V2ZXIsIHdlIGRvbid0IGFjdHVhbGx5IHN0aWNrIHRoZSBfaWQgb250byB0aGUgZG9jdW1lbnQgeWV0LFxuICAgICAgICAgIC8vIGJlY2F1c2Ugd2Ugd2FudCBhbGxvdy9kZW55IHJ1bGVzIHRvIGJlIGFibGUgdG8gZGlmZmVyZW50aWF0ZVxuICAgICAgICAgIC8vIGJldHdlZW4gYXJiaXRyYXJ5IGNsaWVudC1zcGVjaWZpZWQgX2lkIGZpZWxkcyBhbmQgbWVyZWx5XG4gICAgICAgICAgLy8gY2xpZW50LWNvbnRyb2xsZWQtdmlhLXJhbmRvbVNlZWQgZmllbGRzLlxuICAgICAgICAgIGxldCBnZW5lcmF0ZWRJZCA9IG51bGw7XG4gICAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJpbnNlcnRcIiAmJiAhaGFzT3duLmNhbGwoYXJnc1swXSwgJ19pZCcpKSB7XG4gICAgICAgICAgICBnZW5lcmF0ZWRJZCA9IHNlbGYuX21ha2VOZXdJRCgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLmlzU2ltdWxhdGlvbikge1xuICAgICAgICAgICAgLy8gSW4gYSBjbGllbnQgc2ltdWxhdGlvbiwgeW91IGNhbiBkbyBhbnkgbXV0YXRpb24gKGV2ZW4gd2l0aCBhXG4gICAgICAgICAgICAvLyBjb21wbGV4IHNlbGVjdG9yKS5cbiAgICAgICAgICAgIGlmIChnZW5lcmF0ZWRJZCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgYXJnc1swXS5faWQgPSBnZW5lcmF0ZWRJZDtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uW21ldGhvZF0uYXBwbHkoXG4gICAgICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24sIGFyZ3MpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRoaXMgaXMgdGhlIHNlcnZlciByZWNlaXZpbmcgYSBtZXRob2QgY2FsbCBmcm9tIHRoZSBjbGllbnQuXG5cbiAgICAgICAgICAvLyBXZSBkb24ndCBhbGxvdyBhcmJpdHJhcnkgc2VsZWN0b3JzIGluIG11dGF0aW9ucyBmcm9tIHRoZSBjbGllbnQ6IG9ubHlcbiAgICAgICAgICAvLyBzaW5nbGUtSUQgc2VsZWN0b3JzLlxuICAgICAgICAgIGlmIChtZXRob2QgIT09ICdpbnNlcnQnKVxuICAgICAgICAgICAgdGhyb3dJZlNlbGVjdG9ySXNOb3RJZChhcmdzWzBdLCBtZXRob2QpO1xuXG4gICAgICAgICAgaWYgKHNlbGYuX3Jlc3RyaWN0ZWQpIHtcbiAgICAgICAgICAgIC8vIHNob3J0IGNpcmN1aXQgaWYgdGhlcmUgaXMgbm8gd2F5IGl0IHdpbGwgcGFzcy5cbiAgICAgICAgICAgIGlmIChzZWxmLl92YWxpZGF0b3JzW21ldGhvZF0uYWxsb3cubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgICAgNDAzLCBcIkFjY2VzcyBkZW5pZWQuIE5vIGFsbG93IHZhbGlkYXRvcnMgc2V0IG9uIHJlc3RyaWN0ZWQgXCIgK1xuICAgICAgICAgICAgICAgICAgXCJjb2xsZWN0aW9uIGZvciBtZXRob2QgJ1wiICsgbWV0aG9kICsgXCInLlwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdmFsaWRhdGVkTWV0aG9kTmFtZSA9XG4gICAgICAgICAgICAgICAgICAnX3ZhbGlkYXRlZCcgKyBtZXRob2QuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBtZXRob2Quc2xpY2UoMSk7XG4gICAgICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy51c2VySWQpO1xuICAgICAgICAgICAgbWV0aG9kID09PSAnaW5zZXJ0JyAmJiBhcmdzLnB1c2goZ2VuZXJhdGVkSWQpO1xuICAgICAgICAgICAgcmV0dXJuIHNlbGZbdmFsaWRhdGVkTWV0aG9kTmFtZV0uYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChzZWxmLl9pc0luc2VjdXJlKCkpIHtcbiAgICAgICAgICAgIGlmIChnZW5lcmF0ZWRJZCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgYXJnc1swXS5faWQgPSBnZW5lcmF0ZWRJZDtcbiAgICAgICAgICAgIC8vIEluIGluc2VjdXJlIG1vZGUsIGFsbG93IGFueSBtdXRhdGlvbiAod2l0aCBhIHNpbXBsZSBzZWxlY3RvcikuXG4gICAgICAgICAgICAvLyBYWFggVGhpcyBpcyBraW5kIG9mIGJvZ3VzLiAgSW5zdGVhZCBvZiBibGluZGx5IHBhc3Npbmcgd2hhdGV2ZXJcbiAgICAgICAgICAgIC8vICAgICB3ZSBnZXQgZnJvbSB0aGUgbmV0d29yayB0byB0aGlzIGZ1bmN0aW9uLCB3ZSBzaG91bGQgYWN0dWFsbHlcbiAgICAgICAgICAgIC8vICAgICBrbm93IHRoZSBjb3JyZWN0IGFyZ3VtZW50cyBmb3IgdGhlIGZ1bmN0aW9uIGFuZCBwYXNzIGp1c3RcbiAgICAgICAgICAgIC8vICAgICB0aGVtLiAgRm9yIGV4YW1wbGUsIGlmIHlvdSBoYXZlIGFuIGV4dHJhbmVvdXMgZXh0cmEgbnVsbFxuICAgICAgICAgICAgLy8gICAgIGFyZ3VtZW50IGFuZCB0aGlzIGlzIE1vbmdvIG9uIHRoZSBzZXJ2ZXIsIHRoZSAud3JhcEFzeW5jJ2RcbiAgICAgICAgICAgIC8vICAgICBmdW5jdGlvbnMgbGlrZSB1cGRhdGUgd2lsbCBnZXQgY29uZnVzZWQgYW5kIHBhc3MgdGhlXG4gICAgICAgICAgICAvLyAgICAgXCJmdXQucmVzb2x2ZXIoKVwiIGluIHRoZSB3cm9uZyBzbG90LCB3aGVyZSBfdXBkYXRlIHdpbGwgbmV2ZXJcbiAgICAgICAgICAgIC8vICAgICBpbnZva2UgaXQuIEJhbSwgYnJva2VuIEREUCBjb25uZWN0aW9uLiAgUHJvYmFibHkgc2hvdWxkIGp1c3RcbiAgICAgICAgICAgIC8vICAgICB0YWtlIHRoaXMgd2hvbGUgbWV0aG9kIGFuZCB3cml0ZSBpdCB0aHJlZSB0aW1lcywgaW52b2tpbmdcbiAgICAgICAgICAgIC8vICAgICBoZWxwZXJzIGZvciB0aGUgY29tbW9uIGNvZGUuXG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fY29sbGVjdGlvblttZXRob2RdLmFwcGx5KHNlbGYuX2NvbGxlY3Rpb24sIGFyZ3MpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJbiBzZWN1cmUgbW9kZSwgaWYgd2UgaGF2ZW4ndCBjYWxsZWQgYWxsb3cgb3IgZGVueSwgdGhlbiBub3RoaW5nXG4gICAgICAgICAgICAvLyBpcyBwZXJtaXR0ZWQuXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGUubmFtZSA9PT0gJ01vbmdvRXJyb3InIHx8XG4gICAgICAgICAgICAvLyBmb3Igb2xkIHZlcnNpb25zIG9mIE1vbmdvREIgKHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYnV0IGl0J3MgaGVyZSBqdXN0IGluIGNhc2UpXG4gICAgICAgICAgICBlLm5hbWUgPT09ICdCdWxrV3JpdGVFcnJvcicgfHxcbiAgICAgICAgICAgIC8vIGZvciBuZXdlciB2ZXJzaW9ucyBvZiBNb25nb0RCIChodHRwczovL2RvY3MubW9uZ29kYi5jb20vZHJpdmVycy9ub2RlL2N1cnJlbnQvd2hhdHMtbmV3LyNidWxrd3JpdGVlcnJvci0tLW1vbmdvYnVsa3dyaXRlZXJyb3IpXG4gICAgICAgICAgICBlLm5hbWUgPT09ICdNb25nb0J1bGtXcml0ZUVycm9yJyB8fFxuICAgICAgICAgICAgZS5uYW1lID09PSAnTWluaW1vbmdvRXJyb3InXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwOSwgZS50b1N0cmluZygpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBzZWxmLl9jb25uZWN0aW9uLm1ldGhvZHMobSk7XG4gIH1cbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3VwZGF0ZUZldGNoID0gZnVuY3Rpb24gKGZpZWxkcykge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICBpZiAoIXNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2hBbGxGaWVsZHMpIHtcbiAgICBpZiAoZmllbGRzKSB7XG4gICAgICBjb25zdCB1bmlvbiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBjb25zdCBhZGQgPSBuYW1lcyA9PiBuYW1lcyAmJiBuYW1lcy5mb3JFYWNoKG5hbWUgPT4gdW5pb25bbmFtZV0gPSAxKTtcbiAgICAgIGFkZChzZWxmLl92YWxpZGF0b3JzLmZldGNoKTtcbiAgICAgIGFkZChmaWVsZHMpO1xuICAgICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaCA9IE9iamVjdC5rZXlzKHVuaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaEFsbEZpZWxkcyA9IHRydWU7XG4gICAgICAvLyBjbGVhciBmZXRjaCBqdXN0IHRvIG1ha2Ugc3VyZSB3ZSBkb24ndCBhY2NpZGVudGFsbHkgcmVhZCBpdFxuICAgICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaCA9IG51bGw7XG4gICAgfVxuICB9XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl9pc0luc2VjdXJlID0gZnVuY3Rpb24gKCkge1xuICBjb25zdCBzZWxmID0gdGhpcztcbiAgaWYgKHNlbGYuX2luc2VjdXJlID09PSB1bmRlZmluZWQpXG4gICAgcmV0dXJuICEhUGFja2FnZS5pbnNlY3VyZTtcbiAgcmV0dXJuIHNlbGYuX2luc2VjdXJlO1xufTtcblxuQ29sbGVjdGlvblByb3RvdHlwZS5fdmFsaWRhdGVkSW5zZXJ0ID0gZnVuY3Rpb24gKHVzZXJJZCwgZG9jLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVkSWQpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLmluc2VydC5kZW55LnNvbWUoKHZhbGlkYXRvcikgPT4ge1xuICAgIHJldHVybiB2YWxpZGF0b3IodXNlcklkLCBkb2NUb1ZhbGlkYXRlKHZhbGlkYXRvciwgZG9jLCBnZW5lcmF0ZWRJZCkpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cbiAgLy8gQW55IGFsbG93IHJldHVybnMgdHJ1ZSBtZWFucyBwcm9jZWVkLiBUaHJvdyBlcnJvciBpZiB0aGV5IGFsbCBmYWlsLlxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy5pbnNlcnQuYWxsb3cuZXZlcnkoKHZhbGlkYXRvcikgPT4ge1xuICAgIHJldHVybiAhdmFsaWRhdG9yKHVzZXJJZCwgZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG5cbiAgLy8gSWYgd2UgZ2VuZXJhdGVkIGFuIElEIGFib3ZlLCBpbnNlcnQgaXQgbm93OiBhZnRlciB0aGUgdmFsaWRhdGlvbiwgYnV0XG4gIC8vIGJlZm9yZSBhY3R1YWxseSBpbnNlcnRpbmcuXG4gIGlmIChnZW5lcmF0ZWRJZCAhPT0gbnVsbClcbiAgICBkb2MuX2lkID0gZ2VuZXJhdGVkSWQ7XG5cbiAgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnQuY2FsbChzZWxmLl9jb2xsZWN0aW9uLCBkb2MpO1xufTtcblxuLy8gU2ltdWxhdGUgYSBtb25nbyBgdXBkYXRlYCBvcGVyYXRpb24gd2hpbGUgdmFsaWRhdGluZyB0aGF0IHRoZSBhY2Nlc3Ncbi8vIGNvbnRyb2wgcnVsZXMgc2V0IGJ5IGNhbGxzIHRvIGBhbGxvdy9kZW55YCBhcmUgc2F0aXNmaWVkLiBJZiBhbGxcbi8vIHBhc3MsIHJld3JpdGUgdGhlIG1vbmdvIG9wZXJhdGlvbiB0byB1c2UgJGluIHRvIHNldCB0aGUgbGlzdCBvZlxuLy8gZG9jdW1lbnQgaWRzIHRvIGNoYW5nZSAjI1ZhbGlkYXRlZENoYW5nZVxuQ29sbGVjdGlvblByb3RvdHlwZS5fdmFsaWRhdGVkVXBkYXRlID0gZnVuY3Rpb24oXG4gICAgdXNlcklkLCBzZWxlY3RvciwgbXV0YXRvciwgb3B0aW9ucykge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICBjaGVjayhtdXRhdG9yLCBPYmplY3QpO1xuXG4gIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIG9wdGlvbnMpO1xuXG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3Qoc2VsZWN0b3IpKVxuICAgIHRocm93IG5ldyBFcnJvcihcInZhbGlkYXRlZCB1cGRhdGUgc2hvdWxkIGJlIG9mIGEgc2luZ2xlIElEXCIpO1xuXG4gIC8vIFdlIGRvbid0IHN1cHBvcnQgdXBzZXJ0cyBiZWNhdXNlIHRoZXkgZG9uJ3QgZml0IG5pY2VseSBpbnRvIGFsbG93L2RlbnlcbiAgLy8gcnVsZXMuXG4gIGlmIChvcHRpb25zLnVwc2VydClcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkLiBVcHNlcnRzIG5vdCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBcImFsbG93ZWQgaW4gYSByZXN0cmljdGVkIGNvbGxlY3Rpb24uXCIpO1xuXG4gIGNvbnN0IG5vUmVwbGFjZUVycm9yID0gXCJBY2Nlc3MgZGVuaWVkLiBJbiBhIHJlc3RyaWN0ZWQgY29sbGVjdGlvbiB5b3UgY2FuIG9ubHlcIiArXG4gICAgICAgIFwiIHVwZGF0ZSBkb2N1bWVudHMsIG5vdCByZXBsYWNlIHRoZW0uIFVzZSBhIE1vbmdvIHVwZGF0ZSBvcGVyYXRvciwgc3VjaCBcIiArXG4gICAgICAgIFwiYXMgJyRzZXQnLlwiO1xuXG4gIGNvbnN0IG11dGF0b3JLZXlzID0gT2JqZWN0LmtleXMobXV0YXRvcik7XG5cbiAgLy8gY29tcHV0ZSBtb2RpZmllZCBmaWVsZHNcbiAgY29uc3QgbW9kaWZpZWRGaWVsZHMgPSB7fTtcblxuICBpZiAobXV0YXRvcktleXMubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIG5vUmVwbGFjZUVycm9yKTtcbiAgfVxuICBtdXRhdG9yS2V5cy5mb3JFYWNoKChvcCkgPT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG11dGF0b3Jbb3BdO1xuICAgIGlmIChvcC5jaGFyQXQoMCkgIT09ICckJykge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIG5vUmVwbGFjZUVycm9yKTtcbiAgICB9IGVsc2UgaWYgKCFoYXNPd24uY2FsbChBTExPV0VEX1VQREFURV9PUEVSQVRJT05TLCBvcCkpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgIDQwMywgXCJBY2Nlc3MgZGVuaWVkLiBPcGVyYXRvciBcIiArIG9wICsgXCIgbm90IGFsbG93ZWQgaW4gYSByZXN0cmljdGVkIGNvbGxlY3Rpb24uXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBPYmplY3Qua2V5cyhwYXJhbXMpLmZvckVhY2goKGZpZWxkKSA9PiB7XG4gICAgICAgIC8vIHRyZWF0IGRvdHRlZCBmaWVsZHMgYXMgaWYgdGhleSBhcmUgcmVwbGFjaW5nIHRoZWlyXG4gICAgICAgIC8vIHRvcC1sZXZlbCBwYXJ0XG4gICAgICAgIGlmIChmaWVsZC5pbmRleE9mKCcuJykgIT09IC0xKVxuICAgICAgICAgIGZpZWxkID0gZmllbGQuc3Vic3RyaW5nKDAsIGZpZWxkLmluZGV4T2YoJy4nKSk7XG5cbiAgICAgICAgLy8gcmVjb3JkIHRoZSBmaWVsZCB3ZSBhcmUgdHJ5aW5nIHRvIGNoYW5nZVxuICAgICAgICBtb2RpZmllZEZpZWxkc1tmaWVsZF0gPSB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBmaWVsZHMgPSBPYmplY3Qua2V5cyhtb2RpZmllZEZpZWxkcyk7XG5cbiAgY29uc3QgZmluZE9wdGlvbnMgPSB7dHJhbnNmb3JtOiBudWxsfTtcbiAgaWYgKCFzZWxmLl92YWxpZGF0b3JzLmZldGNoQWxsRmllbGRzKSB7XG4gICAgZmluZE9wdGlvbnMuZmllbGRzID0ge307XG4gICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaC5mb3JFYWNoKChmaWVsZE5hbWUpID0+IHtcbiAgICAgIGZpbmRPcHRpb25zLmZpZWxkc1tmaWVsZE5hbWVdID0gMTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGRvYyA9IHNlbGYuX2NvbGxlY3Rpb24uZmluZE9uZShzZWxlY3RvciwgZmluZE9wdGlvbnMpO1xuICBpZiAoIWRvYykgIC8vIG5vbmUgc2F0aXNmaWVkIVxuICAgIHJldHVybiAwO1xuXG4gIC8vIGNhbGwgdXNlciB2YWxpZGF0b3JzLlxuICAvLyBBbnkgZGVueSByZXR1cm5zIHRydWUgbWVhbnMgZGVuaWVkLlxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy51cGRhdGUuZGVueS5zb21lKCh2YWxpZGF0b3IpID0+IHtcbiAgICBjb25zdCBmYWN0b3JpZWREb2MgPSB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpO1xuICAgIHJldHVybiB2YWxpZGF0b3IodXNlcklkLFxuICAgICAgICAgICAgICAgICAgICAgZmFjdG9yaWVkRG9jLFxuICAgICAgICAgICAgICAgICAgICAgZmllbGRzLFxuICAgICAgICAgICAgICAgICAgICAgbXV0YXRvcik7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuICAvLyBBbnkgYWxsb3cgcmV0dXJucyB0cnVlIG1lYW5zIHByb2NlZWQuIFRocm93IGVycm9yIGlmIHRoZXkgYWxsIGZhaWwuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLnVwZGF0ZS5hbGxvdy5ldmVyeSgodmFsaWRhdG9yKSA9PiB7XG4gICAgY29uc3QgZmFjdG9yaWVkRG9jID0gdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKTtcbiAgICByZXR1cm4gIXZhbGlkYXRvcih1c2VySWQsXG4gICAgICAgICAgICAgICAgICAgICAgZmFjdG9yaWVkRG9jLFxuICAgICAgICAgICAgICAgICAgICAgIGZpZWxkcyxcbiAgICAgICAgICAgICAgICAgICAgICBtdXRhdG9yKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG5cbiAgb3B0aW9ucy5fZm9yYmlkUmVwbGFjZSA9IHRydWU7XG5cbiAgLy8gQmFjayB3aGVuIHdlIHN1cHBvcnRlZCBhcmJpdHJhcnkgY2xpZW50LXByb3ZpZGVkIHNlbGVjdG9ycywgd2UgYWN0dWFsbHlcbiAgLy8gcmV3cm90ZSB0aGUgc2VsZWN0b3IgdG8gaW5jbHVkZSBhbiBfaWQgY2xhdXNlIGJlZm9yZSBwYXNzaW5nIHRvIE1vbmdvIHRvXG4gIC8vIGF2b2lkIHJhY2VzLCBidXQgc2luY2Ugc2VsZWN0b3IgaXMgZ3VhcmFudGVlZCB0byBhbHJlYWR5IGp1c3QgYmUgYW4gSUQsIHdlXG4gIC8vIGRvbid0IGhhdmUgdG8gYW55IG1vcmUuXG5cbiAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlLmNhbGwoXG4gICAgc2VsZi5fY29sbGVjdGlvbiwgc2VsZWN0b3IsIG11dGF0b3IsIG9wdGlvbnMpO1xufTtcblxuLy8gT25seSBhbGxvdyB0aGVzZSBvcGVyYXRpb25zIGluIHZhbGlkYXRlZCB1cGRhdGVzLiBTcGVjaWZpY2FsbHlcbi8vIHdoaXRlbGlzdCBvcGVyYXRpb25zLCByYXRoZXIgdGhhbiBibGFja2xpc3QsIHNvIG5ldyBjb21wbGV4XG4vLyBvcGVyYXRpb25zIHRoYXQgYXJlIGFkZGVkIGFyZW4ndCBhdXRvbWF0aWNhbGx5IGFsbG93ZWQuIEEgY29tcGxleFxuLy8gb3BlcmF0aW9uIGlzIG9uZSB0aGF0IGRvZXMgbW9yZSB0aGFuIGp1c3QgbW9kaWZ5IGl0cyB0YXJnZXRcbi8vIGZpZWxkLiBGb3Igbm93IHRoaXMgY29udGFpbnMgYWxsIHVwZGF0ZSBvcGVyYXRpb25zIGV4Y2VwdCAnJHJlbmFtZScuXG4vLyBodHRwOi8vZG9jcy5tb25nb2RiLm9yZy9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9ycy8jdXBkYXRlXG5jb25zdCBBTExPV0VEX1VQREFURV9PUEVSQVRJT05TID0ge1xuICAkaW5jOjEsICRzZXQ6MSwgJHVuc2V0OjEsICRhZGRUb1NldDoxLCAkcG9wOjEsICRwdWxsQWxsOjEsICRwdWxsOjEsXG4gICRwdXNoQWxsOjEsICRwdXNoOjEsICRiaXQ6MVxufTtcblxuLy8gU2ltdWxhdGUgYSBtb25nbyBgcmVtb3ZlYCBvcGVyYXRpb24gd2hpbGUgdmFsaWRhdGluZyBhY2Nlc3MgY29udHJvbFxuLy8gcnVsZXMuIFNlZSAjVmFsaWRhdGVkQ2hhbmdlXG5Db2xsZWN0aW9uUHJvdG90eXBlLl92YWxpZGF0ZWRSZW1vdmUgPSBmdW5jdGlvbih1c2VySWQsIHNlbGVjdG9yKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIGNvbnN0IGZpbmRPcHRpb25zID0ge3RyYW5zZm9ybTogbnVsbH07XG4gIGlmICghc2VsZi5fdmFsaWRhdG9ycy5mZXRjaEFsbEZpZWxkcykge1xuICAgIGZpbmRPcHRpb25zLmZpZWxkcyA9IHt9O1xuICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2guZm9yRWFjaCgoZmllbGROYW1lKSA9PiB7XG4gICAgICBmaW5kT3B0aW9ucy5maWVsZHNbZmllbGROYW1lXSA9IDE7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb2MgPSBzZWxmLl9jb2xsZWN0aW9uLmZpbmRPbmUoc2VsZWN0b3IsIGZpbmRPcHRpb25zKTtcbiAgaWYgKCFkb2MpXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gY2FsbCB1c2VyIHZhbGlkYXRvcnMuXG4gIC8vIEFueSBkZW55IHJldHVybnMgdHJ1ZSBtZWFucyBkZW5pZWQuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLnJlbW92ZS5kZW55LnNvbWUoKHZhbGlkYXRvcikgPT4ge1xuICAgIHJldHVybiB2YWxpZGF0b3IodXNlcklkLCB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG4gIC8vIEFueSBhbGxvdyByZXR1cm5zIHRydWUgbWVhbnMgcHJvY2VlZC4gVGhyb3cgZXJyb3IgaWYgdGhleSBhbGwgZmFpbC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMucmVtb3ZlLmFsbG93LmV2ZXJ5KCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gIXZhbGlkYXRvcih1c2VySWQsIHRyYW5zZm9ybURvYyh2YWxpZGF0b3IsIGRvYykpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cblxuICAvLyBCYWNrIHdoZW4gd2Ugc3VwcG9ydGVkIGFyYml0cmFyeSBjbGllbnQtcHJvdmlkZWQgc2VsZWN0b3JzLCB3ZSBhY3R1YWxseVxuICAvLyByZXdyb3RlIHRoZSBzZWxlY3RvciB0byB7X2lkOiB7JGluOiBbaWRzIHRoYXQgd2UgZm91bmRdfX0gYmVmb3JlIHBhc3NpbmcgdG9cbiAgLy8gTW9uZ28gdG8gYXZvaWQgcmFjZXMsIGJ1dCBzaW5jZSBzZWxlY3RvciBpcyBndWFyYW50ZWVkIHRvIGFscmVhZHkganVzdCBiZVxuICAvLyBhbiBJRCwgd2UgZG9uJ3QgaGF2ZSB0byBhbnkgbW9yZS5cblxuICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUuY2FsbChzZWxmLl9jb2xsZWN0aW9uLCBzZWxlY3Rvcik7XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl9jYWxsTXV0YXRvck1ldGhvZCA9IGZ1bmN0aW9uIF9jYWxsTXV0YXRvck1ldGhvZChuYW1lLCBhcmdzLCBjYWxsYmFjaykge1xuICBpZiAoTWV0ZW9yLmlzQ2xpZW50ICYmICFjYWxsYmFjayAmJiAhYWxyZWFkeUluU2ltdWxhdGlvbigpKSB7XG4gICAgLy8gQ2xpZW50IGNhbid0IGJsb2NrLCBzbyBpdCBjYW4ndCByZXBvcnQgZXJyb3JzIGJ5IGV4Y2VwdGlvbixcbiAgICAvLyBvbmx5IGJ5IGNhbGxiYWNrLiBJZiB0aGV5IGZvcmdldCB0aGUgY2FsbGJhY2ssIGdpdmUgdGhlbSBhXG4gICAgLy8gZGVmYXVsdCBvbmUgdGhhdCBsb2dzIHRoZSBlcnJvciwgc28gdGhleSBhcmVuJ3QgdG90YWxseVxuICAgIC8vIGJhZmZsZWQgaWYgdGhlaXIgd3JpdGVzIGRvbid0IHdvcmsgYmVjYXVzZSB0aGVpciBkYXRhYmFzZSBpc1xuICAgIC8vIGRvd24uXG4gICAgLy8gRG9uJ3QgZ2l2ZSBhIGRlZmF1bHQgY2FsbGJhY2sgaW4gc2ltdWxhdGlvbiwgYmVjYXVzZSBpbnNpZGUgc3R1YnMgd2VcbiAgICAvLyB3YW50IHRvIHJldHVybiB0aGUgcmVzdWx0cyBmcm9tIHRoZSBsb2NhbCBjb2xsZWN0aW9uIGltbWVkaWF0ZWx5IGFuZFxuICAgIC8vIG5vdCBmb3JjZSBhIGNhbGxiYWNrLlxuICAgIGNhbGxiYWNrID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgaWYgKGVycilcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhuYW1lICsgXCIgZmFpbGVkXCIsIGVycik7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEZvciB0d28gb3V0IG9mIHRocmVlIG11dGF0b3IgbWV0aG9kcywgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIGEgc2VsZWN0b3JcbiAgY29uc3QgZmlyc3RBcmdJc1NlbGVjdG9yID0gbmFtZSA9PT0gXCJ1cGRhdGVcIiB8fCBuYW1lID09PSBcInJlbW92ZVwiO1xuICBpZiAoZmlyc3RBcmdJc1NlbGVjdG9yICYmICFhbHJlYWR5SW5TaW11bGF0aW9uKCkpIHtcbiAgICAvLyBJZiB3ZSdyZSBhYm91dCB0byBhY3R1YWxseSBzZW5kIGFuIFJQQywgd2Ugc2hvdWxkIHRocm93IGFuIGVycm9yIGlmXG4gICAgLy8gdGhpcyBpcyBhIG5vbi1JRCBzZWxlY3RvciwgYmVjYXVzZSB0aGUgbXV0YXRpb24gbWV0aG9kcyBvbmx5IGFsbG93XG4gICAgLy8gc2luZ2xlLUlEIHNlbGVjdG9ycy4gKElmIHdlIGRvbid0IHRocm93IGhlcmUsIHdlJ2xsIHNlZSBmbGlja2VyLilcbiAgICB0aHJvd0lmU2VsZWN0b3JJc05vdElkKGFyZ3NbMF0sIG5hbWUpO1xuICB9XG5cbiAgY29uc3QgbXV0YXRvck1ldGhvZE5hbWUgPSB0aGlzLl9wcmVmaXggKyBuYW1lO1xuICByZXR1cm4gdGhpcy5fY29ubmVjdGlvbi5hcHBseShcbiAgICBtdXRhdG9yTWV0aG9kTmFtZSwgYXJncywgeyByZXR1cm5TdHViVmFsdWU6IHRydWUgfSwgY2FsbGJhY2spO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpIHtcbiAgaWYgKHZhbGlkYXRvci50cmFuc2Zvcm0pXG4gICAgcmV0dXJuIHZhbGlkYXRvci50cmFuc2Zvcm0oZG9jKTtcbiAgcmV0dXJuIGRvYztcbn1cblxuZnVuY3Rpb24gZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpIHtcbiAgbGV0IHJldCA9IGRvYztcbiAgaWYgKHZhbGlkYXRvci50cmFuc2Zvcm0pIHtcbiAgICByZXQgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIC8vIElmIHlvdSBzZXQgYSBzZXJ2ZXItc2lkZSB0cmFuc2Zvcm0gb24geW91ciBjb2xsZWN0aW9uLCB0aGVuIHlvdSBkb24ndCBnZXRcbiAgICAvLyB0byB0ZWxsIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gXCJjbGllbnQgc3BlY2lmaWVkIHRoZSBJRFwiIGFuZCBcInNlcnZlclxuICAgIC8vIGdlbmVyYXRlZCB0aGUgSURcIiwgYmVjYXVzZSB0cmFuc2Zvcm1zIGV4cGVjdCB0byBnZXQgX2lkLiAgSWYgeW91IHdhbnQgdG9cbiAgICAvLyBkbyB0aGF0IGNoZWNrLCB5b3UgY2FuIGRvIGl0IHdpdGggYSBzcGVjaWZpY1xuICAgIC8vIGBDLmFsbG93KHtpbnNlcnQ6IGYsIHRyYW5zZm9ybTogbnVsbH0pYCB2YWxpZGF0b3IuXG4gICAgaWYgKGdlbmVyYXRlZElkICE9PSBudWxsKSB7XG4gICAgICByZXQuX2lkID0gZ2VuZXJhdGVkSWQ7XG4gICAgfVxuICAgIHJldCA9IHZhbGlkYXRvci50cmFuc2Zvcm0ocmV0KTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBhZGRWYWxpZGF0b3IoY29sbGVjdGlvbiwgYWxsb3dPckRlbnksIG9wdGlvbnMpIHtcbiAgLy8gdmFsaWRhdGUga2V5c1xuICBjb25zdCB2YWxpZEtleXNSZWdFeCA9IC9eKD86aW5zZXJ0fHVwZGF0ZXxyZW1vdmV8ZmV0Y2h8dHJhbnNmb3JtKSQvO1xuICBPYmplY3Qua2V5cyhvcHRpb25zKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBpZiAoIXZhbGlkS2V5c1JlZ0V4LnRlc3Qoa2V5KSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihhbGxvd09yRGVueSArIFwiOiBJbnZhbGlkIGtleTogXCIgKyBrZXkpO1xuICB9KTtcblxuICBjb2xsZWN0aW9uLl9yZXN0cmljdGVkID0gdHJ1ZTtcblxuICBbJ2luc2VydCcsICd1cGRhdGUnLCAncmVtb3ZlJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGlmIChoYXNPd24uY2FsbChvcHRpb25zLCBuYW1lKSkge1xuICAgICAgaWYgKCEob3B0aW9uc1tuYW1lXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYWxsb3dPckRlbnkgKyBcIjogVmFsdWUgZm9yIGBcIiArIG5hbWUgKyBcImAgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGUgdHJhbnNmb3JtIGlzIHNwZWNpZmllZCBhdCBhbGwgKGluY2x1ZGluZyBhcyAnbnVsbCcpIGluIHRoaXNcbiAgICAgIC8vIGNhbGwsIHRoZW4gdGFrZSB0aGF0OyBvdGhlcndpc2UsIHRha2UgdGhlIHRyYW5zZm9ybSBmcm9tIHRoZVxuICAgICAgLy8gY29sbGVjdGlvbi5cbiAgICAgIGlmIChvcHRpb25zLnRyYW5zZm9ybSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0udHJhbnNmb3JtID0gY29sbGVjdGlvbi5fdHJhbnNmb3JtOyAgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zW25hbWVdLnRyYW5zZm9ybSA9IExvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtKFxuICAgICAgICAgIG9wdGlvbnMudHJhbnNmb3JtKTtcbiAgICAgIH1cblxuICAgICAgY29sbGVjdGlvbi5fdmFsaWRhdG9yc1tuYW1lXVthbGxvd09yRGVueV0ucHVzaChvcHRpb25zW25hbWVdKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIE9ubHkgdXBkYXRlIHRoZSBmZXRjaCBmaWVsZHMgaWYgd2UncmUgcGFzc2VkIHRoaW5ncyB0aGF0IGFmZmVjdFxuICAvLyBmZXRjaGluZy4gVGhpcyB3YXkgYWxsb3coe30pIGFuZCBhbGxvdyh7aW5zZXJ0OiBmfSkgZG9uJ3QgcmVzdWx0IGluXG4gIC8vIHNldHRpbmcgZmV0Y2hBbGxGaWVsZHNcbiAgaWYgKG9wdGlvbnMudXBkYXRlIHx8IG9wdGlvbnMucmVtb3ZlIHx8IG9wdGlvbnMuZmV0Y2gpIHtcbiAgICBpZiAob3B0aW9ucy5mZXRjaCAmJiAhKG9wdGlvbnMuZmV0Y2ggaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihhbGxvd09yRGVueSArIFwiOiBWYWx1ZSBmb3IgYGZldGNoYCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICBjb2xsZWN0aW9uLl91cGRhdGVGZXRjaChvcHRpb25zLmZldGNoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0aHJvd0lmU2VsZWN0b3JJc05vdElkKHNlbGVjdG9yLCBtZXRob2ROYW1lKSB7XG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3Qoc2VsZWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgIDQwMywgXCJOb3QgcGVybWl0dGVkLiBVbnRydXN0ZWQgY29kZSBtYXkgb25seSBcIiArIG1ldGhvZE5hbWUgK1xuICAgICAgICBcIiBkb2N1bWVudHMgYnkgSUQuXCIpO1xuICB9XG59O1xuXG4vLyBEZXRlcm1pbmUgaWYgd2UgYXJlIGluIGEgRERQIG1ldGhvZCBzaW11bGF0aW9uXG5mdW5jdGlvbiBhbHJlYWR5SW5TaW11bGF0aW9uKCkge1xuICB2YXIgQ3VycmVudEludm9jYXRpb24gPVxuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gfHxcbiAgICAvLyBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIGFzIGV4cGxhaW5lZCBpbiB0aGlzIGlzc3VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy84OTQ3XG4gICAgRERQLl9DdXJyZW50SW52b2NhdGlvbjtcblxuICBjb25zdCBlbmNsb3NpbmcgPSBDdXJyZW50SW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIGVuY2xvc2luZyAmJiBlbmNsb3NpbmcuaXNTaW11bGF0aW9uO1xufVxuIl19
