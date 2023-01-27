(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Autoupdate;

var require = meteorInstall({"node_modules":{"meteor":{"autoupdate":{"autoupdate_server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/autoupdate/autoupdate_server.js                                                                     //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
!function (module1) {
  let _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default(v) {
      _objectSpread = v;
    }
  }, 0);
  module1.export({
    Autoupdate: () => Autoupdate
  });
  let ClientVersions;
  module1.link("./client_versions.js", {
    ClientVersions(v) {
      ClientVersions = v;
    }
  }, 0);
  let onMessage;
  module1.link("meteor/inter-process-messaging", {
    onMessage(v) {
      onMessage = v;
    }
  }, 1);
  var Future = Npm.require("fibers/future");
  const Autoupdate = __meteor_runtime_config__.autoupdate = {
    // Map from client architectures (web.browser, web.browser.legacy,
    // web.cordova) to version fields { version, versionRefreshable,
    // versionNonRefreshable, refreshable } that will be stored in
    // ClientVersions documents (whose IDs are client architectures). This
    // data gets serialized into the boilerplate because it's stored in
    // __meteor_runtime_config__.autoupdate.versions.
    versions: {}
  };
  // Stores acceptable client versions.
  const clientVersions = new ClientVersions();

  // The client hash includes __meteor_runtime_config__, so wait until
  // all packages have loaded and have had a chance to populate the
  // runtime config before using the client hash as our default auto
  // update version id.

  // Note: Tests allow people to override Autoupdate.autoupdateVersion before
  // startup.
  Autoupdate.autoupdateVersion = null;
  Autoupdate.autoupdateVersionRefreshable = null;
  Autoupdate.autoupdateVersionCordova = null;
  Autoupdate.appId = __meteor_runtime_config__.appId = process.env.APP_ID;
  var syncQueue = new Meteor._SynchronousQueue();
  function updateVersions(shouldReloadClientProgram) {
    // Step 1: load the current client program on the server
    if (shouldReloadClientProgram) {
      WebAppInternals.reloadClientPrograms();
    }
    const {
      // If the AUTOUPDATE_VERSION environment variable is defined, it takes
      // precedence, but Autoupdate.autoupdateVersion is still supported as
      // a fallback. In most cases neither of these values will be defined.
      AUTOUPDATE_VERSION = Autoupdate.autoupdateVersion
    } = process.env;

    // Step 2: update __meteor_runtime_config__.autoupdate.versions.
    const clientArchs = Object.keys(WebApp.clientPrograms);
    clientArchs.forEach(arch => {
      Autoupdate.versions[arch] = {
        version: AUTOUPDATE_VERSION || WebApp.calculateClientHash(arch),
        versionRefreshable: AUTOUPDATE_VERSION || WebApp.calculateClientHashRefreshable(arch),
        versionNonRefreshable: AUTOUPDATE_VERSION || WebApp.calculateClientHashNonRefreshable(arch),
        versionReplaceable: AUTOUPDATE_VERSION || WebApp.calculateClientHashReplaceable(arch),
        versionHmr: WebApp.clientPrograms[arch].hmrVersion
      };
    });

    // Step 3: form the new client boilerplate which contains the updated
    // assets and __meteor_runtime_config__.
    if (shouldReloadClientProgram) {
      WebAppInternals.generateBoilerplate();
    }

    // Step 4: update the ClientVersions collection.
    // We use `onListening` here because we need to use
    // `WebApp.getRefreshableAssets`, which is only set after
    // `WebApp.generateBoilerplate` is called by `main` in webapp.
    WebApp.onListening(() => {
      clientArchs.forEach(arch => {
        const payload = _objectSpread(_objectSpread({}, Autoupdate.versions[arch]), {}, {
          assets: WebApp.getRefreshableAssets(arch)
        });
        clientVersions.set(arch, payload);
      });
    });
  }
  Meteor.publish("meteor_autoupdate_clientVersions", function (appId) {
    // `null` happens when a client doesn't have an appId and passes
    // `undefined` to `Meteor.subscribe`. `undefined` is translated to
    // `null` as JSON doesn't have `undefined.
    check(appId, Match.OneOf(String, undefined, null));

    // Don't notify clients using wrong appId such as mobile apps built with a
    // different server but pointing at the same local url
    if (Autoupdate.appId && appId && Autoupdate.appId !== appId) return [];
    const stop = clientVersions.watch((version, isNew) => {
      (isNew ? this.added : this.changed).call(this, "meteor_autoupdate_clientVersions", version._id, version);
    });
    this.onStop(() => stop());
    this.ready();
  }, {
    is_auto: true
  });
  Meteor.startup(function () {
    updateVersions(false);

    // Force any connected clients that are still looking for these older
    // document IDs to reload.
    ["version", "version-refreshable", "version-cordova"].forEach(_id => {
      clientVersions.set(_id, {
        version: "outdated"
      });
    });
  });
  var fut = new Future();

  // We only want 'refresh' to trigger 'updateVersions' AFTER onListen,
  // so we add a queued task that waits for onListen before 'refresh' can queue
  // tasks. Note that the `onListening` callbacks do not fire until after
  // Meteor.startup, so there is no concern that the 'updateVersions' calls from
  // 'refresh' will overlap with the `updateVersions` call from Meteor.startup.

  syncQueue.queueTask(function () {
    fut.wait();
  });
  WebApp.onListening(function () {
    fut.return();
  });
  function enqueueVersionsRefresh() {
    syncQueue.queueTask(function () {
      updateVersions(true);
    });
  }

  // Listen for messages pertaining to the client-refresh topic.

  onMessage("client-refresh", enqueueVersionsRefresh);

  // Another way to tell the process to refresh: send SIGHUP signal
  process.on('SIGHUP', Meteor.bindEnvironment(function () {
    enqueueVersionsRefresh();
  }, "handling SIGHUP signal for refresh"));
}.call(this, module);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"client_versions.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/autoupdate/client_versions.js                                                                       //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
let _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }
}, 0);
module.export({
  ClientVersions: () => ClientVersions
});
let Tracker;
module.link("meteor/tracker", {
  Tracker(v) {
    Tracker = v;
  }
}, 0);
class ClientVersions {
  constructor() {
    this._versions = new Map();
    this._watchCallbacks = new Set();
  }

  // Creates a Livedata store for use with `Meteor.connection.registerStore`.
  // After the store is registered, document updates reported by Livedata are
  // merged with the documents in this `ClientVersions` instance.
  createStore() {
    return {
      update: _ref => {
        let {
          id,
          msg,
          fields
        } = _ref;
        if (msg === "added" || msg === "changed") {
          this.set(id, fields);
        }
      }
    };
  }
  hasVersions() {
    return this._versions.size > 0;
  }
  get(id) {
    return this._versions.get(id);
  }

  // Adds or updates a version document and invokes registered callbacks for the
  // added/updated document. If a document with the given ID already exists, its
  // fields are merged with `fields`.
  set(id, fields) {
    let version = this._versions.get(id);
    let isNew = false;
    if (version) {
      Object.assign(version, fields);
    } else {
      version = _objectSpread({
        _id: id
      }, fields);
      isNew = true;
      this._versions.set(id, version);
    }
    this._watchCallbacks.forEach(_ref2 => {
      let {
        fn,
        filter
      } = _ref2;
      if (!filter || filter === version._id) {
        fn(version, isNew);
      }
    });
  }

  // Registers a callback that will be invoked when a version document is added
  // or changed. Calling the function returned by `watch` removes the callback.
  // If `skipInitial` is true, the callback isn't be invoked for existing
  // documents. If `filter` is set, the callback is only invoked for documents
  // with ID `filter`.
  watch(fn) {
    let {
      skipInitial,
      filter
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    if (!skipInitial) {
      const resolved = Promise.resolve();
      this._versions.forEach(version => {
        if (!filter || filter === version._id) {
          resolved.then(() => fn(version, true));
        }
      });
    }
    const callback = {
      fn,
      filter
    };
    this._watchCallbacks.add(callback);
    return () => this._watchCallbacks.delete(callback);
  }

  // A reactive data source for `Autoupdate.newClientAvailable`.
  newClientAvailable(id, fields, currentVersion) {
    function isNewVersion(version) {
      return version._id === id && fields.some(field => version[field] !== currentVersion[field]);
    }
    const dependency = new Tracker.Dependency();
    const version = this.get(id);
    dependency.depend();
    const stop = this.watch(version => {
      if (isNewVersion(version)) {
        dependency.changed();
        stop();
      }
    }, {
      skipInitial: true
    });
    return !!version && isNewVersion(version);
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/autoupdate/autoupdate_server.js");

/* Exports */
Package._define("autoupdate", exports, {
  Autoupdate: Autoupdate
});

})();

//# sourceURL=meteor://💻app/packages/autoupdate.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYXV0b3VwZGF0ZS9hdXRvdXBkYXRlX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYXV0b3VwZGF0ZS9jbGllbnRfdmVyc2lvbnMuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJBdXRvdXBkYXRlIiwiQ2xpZW50VmVyc2lvbnMiLCJvbk1lc3NhZ2UiLCJGdXR1cmUiLCJOcG0iLCJyZXF1aXJlIiwiX19tZXRlb3JfcnVudGltZV9jb25maWdfXyIsImF1dG91cGRhdGUiLCJ2ZXJzaW9ucyIsImNsaWVudFZlcnNpb25zIiwiYXV0b3VwZGF0ZVZlcnNpb24iLCJhdXRvdXBkYXRlVmVyc2lvblJlZnJlc2hhYmxlIiwiYXV0b3VwZGF0ZVZlcnNpb25Db3Jkb3ZhIiwiYXBwSWQiLCJwcm9jZXNzIiwiZW52IiwiQVBQX0lEIiwic3luY1F1ZXVlIiwiTWV0ZW9yIiwiX1N5bmNocm9ub3VzUXVldWUiLCJ1cGRhdGVWZXJzaW9ucyIsInNob3VsZFJlbG9hZENsaWVudFByb2dyYW0iLCJXZWJBcHBJbnRlcm5hbHMiLCJyZWxvYWRDbGllbnRQcm9ncmFtcyIsIkFVVE9VUERBVEVfVkVSU0lPTiIsImNsaWVudEFyY2hzIiwiT2JqZWN0Iiwia2V5cyIsIldlYkFwcCIsImNsaWVudFByb2dyYW1zIiwiZm9yRWFjaCIsImFyY2giLCJ2ZXJzaW9uIiwiY2FsY3VsYXRlQ2xpZW50SGFzaCIsInZlcnNpb25SZWZyZXNoYWJsZSIsImNhbGN1bGF0ZUNsaWVudEhhc2hSZWZyZXNoYWJsZSIsInZlcnNpb25Ob25SZWZyZXNoYWJsZSIsImNhbGN1bGF0ZUNsaWVudEhhc2hOb25SZWZyZXNoYWJsZSIsInZlcnNpb25SZXBsYWNlYWJsZSIsImNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZSIsInZlcnNpb25IbXIiLCJobXJWZXJzaW9uIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZSIsIm9uTGlzdGVuaW5nIiwicGF5bG9hZCIsImFzc2V0cyIsImdldFJlZnJlc2hhYmxlQXNzZXRzIiwic2V0IiwicHVibGlzaCIsImNoZWNrIiwiTWF0Y2giLCJPbmVPZiIsIlN0cmluZyIsInVuZGVmaW5lZCIsInN0b3AiLCJ3YXRjaCIsImlzTmV3IiwiYWRkZWQiLCJjaGFuZ2VkIiwiY2FsbCIsIl9pZCIsIm9uU3RvcCIsInJlYWR5IiwiaXNfYXV0byIsInN0YXJ0dXAiLCJmdXQiLCJxdWV1ZVRhc2siLCJ3YWl0IiwicmV0dXJuIiwiZW5xdWV1ZVZlcnNpb25zUmVmcmVzaCIsIm9uIiwiYmluZEVudmlyb25tZW50IiwibW9kdWxlIiwiVHJhY2tlciIsImNvbnN0cnVjdG9yIiwiX3ZlcnNpb25zIiwiTWFwIiwiX3dhdGNoQ2FsbGJhY2tzIiwiU2V0IiwiY3JlYXRlU3RvcmUiLCJ1cGRhdGUiLCJpZCIsIm1zZyIsImZpZWxkcyIsImhhc1ZlcnNpb25zIiwic2l6ZSIsImdldCIsImFzc2lnbiIsImZuIiwiZmlsdGVyIiwic2tpcEluaXRpYWwiLCJyZXNvbHZlZCIsIlByb21pc2UiLCJyZXNvbHZlIiwidGhlbiIsImNhbGxiYWNrIiwiYWRkIiwiZGVsZXRlIiwibmV3Q2xpZW50QXZhaWxhYmxlIiwiY3VycmVudFZlcnNpb24iLCJpc05ld1ZlcnNpb24iLCJzb21lIiwiZmllbGQiLCJkZXBlbmRlbmN5IiwiRGVwZW5kZW5jeSIsImRlcGVuZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7RUFBQSxJQUFJQSxhQUFhO0VBQUNDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLHNDQUFzQyxFQUFDO0lBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO01BQUNKLGFBQWEsR0FBQ0ksQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztFQUF0R0gsT0FBTyxDQUFDSSxNQUFNLENBQUM7SUFBQ0MsVUFBVSxFQUFDLE1BQUlBO0VBQVUsQ0FBQyxD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dEUsT0FBTyxDQUFDc0UsS0FBSyxDQUFDLEtBQUtILGNBQWMsQ0FBQ0csS0FBSyxDQUFDLENBQUM7SUFFcEU7SUFFQSxNQUFNQyxVQUFVLEdBQUcsSUFBSTlCLE9BQU8sQ0FBQytCLFVBQVUsRUFBRTtJQUMzQyxNQUFNeEUsT0FBTyxHQUFHLElBQUksQ0FBQ3NELEdBQUcsQ0FBQ0wsRUFBRSxDQUFDO0lBRTVCc0IsVUFBVSxDQUFDRSxNQUFNLEVBQUU7SUFFbkIsTUFBTW5ELElBQUksR0FBRyxJQUFJLENBQUNDLEtBQUssQ0FDcEJ2QixPQUFPLElBQUs7TUFDWCxJQUFJb0UsWUFBWSxDQUFDcEUsT0FBTyxDQUFDLEVBQUU7UUFDekJ1RSxVQUFVLENBQUM3QyxPQUFPLEVBQUU7UUFDcEJKLElBQUksRUFBRTtNQUNSO0lBQ0YsQ0FBQyxFQUNEO01BQUVvQyxXQUFXLEVBQUU7SUFBSyxDQUFDLENBQ3RCO0lBRUQsT0FBTyxDQUFDLENBQUUxRCxPQUFPLElBQUlvRSxZQUFZLENBQUNwRSxPQUFPLENBQUM7RUFDNUM7QUFDRixDIiwiZmlsZSI6Ii9wYWNrYWdlcy9hdXRvdXBkYXRlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gUHVibGlzaCB0aGUgY3VycmVudCBjbGllbnQgdmVyc2lvbnMgZm9yIGVhY2ggY2xpZW50IGFyY2hpdGVjdHVyZVxuLy8gKHdlYi5icm93c2VyLCB3ZWIuYnJvd3Nlci5sZWdhY3ksIHdlYi5jb3Jkb3ZhKS4gV2hlbiBhIGNsaWVudCBvYnNlcnZlc1xuLy8gYSBjaGFuZ2UgaW4gdGhlIHZlcnNpb25zIGFzc29jaWF0ZWQgd2l0aCBpdHMgY2xpZW50IGFyY2hpdGVjdHVyZSxcbi8vIGl0IHdpbGwgcmVmcmVzaCBpdHNlbGYsIGVpdGhlciBieSBzd2FwcGluZyBvdXQgQ1NTIGFzc2V0cyBvciBieVxuLy8gcmVsb2FkaW5nIHRoZSBwYWdlLiBDaGFuZ2VzIHRvIHRoZSByZXBsYWNlYWJsZSB2ZXJzaW9uIGFyZSBpZ25vcmVkXG4vLyBhbmQgaGFuZGxlZCBieSB0aGUgaG90LW1vZHVsZS1yZXBsYWNlbWVudCBwYWNrYWdlLlxuLy9cbi8vIFRoZXJlIGFyZSBmb3VyIHZlcnNpb25zIGZvciBhbnkgZ2l2ZW4gY2xpZW50IGFyY2hpdGVjdHVyZTogYHZlcnNpb25gLFxuLy8gYHZlcnNpb25SZWZyZXNoYWJsZWAsIGB2ZXJzaW9uTm9uUmVmcmVzaGFibGVgLCBhbmRcbi8vIGB2ZXJzaW9uUmVwbGFjZWFibGVgLiBUaGUgcmVmcmVzaGFibGUgdmVyc2lvbiBpcyBhIGhhc2ggb2YganVzdCB0aGVcbi8vIGNsaWVudCByZXNvdXJjZXMgdGhhdCBhcmUgcmVmcmVzaGFibGUsIHN1Y2ggYXMgQ1NTLiBUaGUgcmVwbGFjZWFibGVcbi8vIHZlcnNpb24gaXMgYSBoYXNoIG9mIGZpbGVzIHRoYXQgY2FuIGJlIHVwZGF0ZWQgd2l0aCBITVIuIFRoZVxuLy8gbm9uLXJlZnJlc2hhYmxlIHZlcnNpb24gaXMgYSBoYXNoIG9mIHRoZSByZXN0IG9mIHRoZSBjbGllbnQgYXNzZXRzLFxuLy8gZXhjbHVkaW5nIHRoZSByZWZyZXNoYWJsZSBvbmVzOiBIVE1MLCBKUyB0aGF0IGlzIG5vdCByZXBsYWNlYWJsZSwgYW5kXG4vLyBzdGF0aWMgZmlsZXMgaW4gdGhlIGBwdWJsaWNgIGRpcmVjdG9yeS4gVGhlIGB2ZXJzaW9uYCB2ZXJzaW9uIGlzIGFcbi8vIGNvbWJpbmVkIGhhc2ggb2YgZXZlcnl0aGluZy5cbi8vXG4vLyBJZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgYEFVVE9VUERBVEVfVkVSU0lPTmAgaXMgc2V0LCBpdCB3aWxsIGJlXG4vLyB1c2VkIGluIHBsYWNlIG9mIGFsbCBjbGllbnQgdmVyc2lvbnMuIFlvdSBjYW4gdXNlIHRoaXMgdmFyaWFibGUgdG9cbi8vIGNvbnRyb2wgd2hlbiB0aGUgY2xpZW50IHJlbG9hZHMuIEZvciBleGFtcGxlLCBpZiB5b3Ugd2FudCB0byBmb3JjZSBhXG4vLyByZWxvYWQgb25seSBhZnRlciBtYWpvciBjaGFuZ2VzLCB1c2UgYSBjdXN0b20gQVVUT1VQREFURV9WRVJTSU9OIGFuZFxuLy8gY2hhbmdlIGl0IG9ubHkgd2hlbiBzb21ldGhpbmcgd29ydGggcHVzaGluZyB0byBjbGllbnRzIGhhcHBlbnMuXG4vL1xuLy8gVGhlIHNlcnZlciBwdWJsaXNoZXMgYSBgbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnNgIGNvbGxlY3Rpb24uXG4vLyBUaGUgSUQgb2YgZWFjaCBkb2N1bWVudCBpcyB0aGUgY2xpZW50IGFyY2hpdGVjdHVyZSwgYW5kIHRoZSBmaWVsZHMgb2Zcbi8vIHRoZSBkb2N1bWVudCBhcmUgdGhlIHZlcnNpb25zIGRlc2NyaWJlZCBhYm92ZS5cblxuaW1wb3J0IHsgQ2xpZW50VmVyc2lvbnMgfSBmcm9tIFwiLi9jbGllbnRfdmVyc2lvbnMuanNcIjtcbnZhciBGdXR1cmUgPSBOcG0ucmVxdWlyZShcImZpYmVycy9mdXR1cmVcIik7XG5cbmV4cG9ydCBjb25zdCBBdXRvdXBkYXRlID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5hdXRvdXBkYXRlID0ge1xuICAvLyBNYXAgZnJvbSBjbGllbnQgYXJjaGl0ZWN0dXJlcyAod2ViLmJyb3dzZXIsIHdlYi5icm93c2VyLmxlZ2FjeSxcbiAgLy8gd2ViLmNvcmRvdmEpIHRvIHZlcnNpb24gZmllbGRzIHsgdmVyc2lvbiwgdmVyc2lvblJlZnJlc2hhYmxlLFxuICAvLyB2ZXJzaW9uTm9uUmVmcmVzaGFibGUsIHJlZnJlc2hhYmxlIH0gdGhhdCB3aWxsIGJlIHN0b3JlZCBpblxuICAvLyBDbGllbnRWZXJzaW9ucyBkb2N1bWVudHMgKHdob3NlIElEcyBhcmUgY2xpZW50IGFyY2hpdGVjdHVyZXMpLiBUaGlzXG4gIC8vIGRhdGEgZ2V0cyBzZXJpYWxpemVkIGludG8gdGhlIGJvaWxlcnBsYXRlIGJlY2F1c2UgaXQncyBzdG9yZWQgaW5cbiAgLy8gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5hdXRvdXBkYXRlLnZlcnNpb25zLlxuICB2ZXJzaW9uczoge31cbn07XG5cbi8vIFN0b3JlcyBhY2NlcHRhYmxlIGNsaWVudCB2ZXJzaW9ucy5cbmNvbnN0IGNsaWVudFZlcnNpb25zID0gbmV3IENsaWVudFZlcnNpb25zKCk7XG5cbi8vIFRoZSBjbGllbnQgaGFzaCBpbmNsdWRlcyBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLCBzbyB3YWl0IHVudGlsXG4vLyBhbGwgcGFja2FnZXMgaGF2ZSBsb2FkZWQgYW5kIGhhdmUgaGFkIGEgY2hhbmNlIHRvIHBvcHVsYXRlIHRoZVxuLy8gcnVudGltZSBjb25maWcgYmVmb3JlIHVzaW5nIHRoZSBjbGllbnQgaGFzaCBhcyBvdXIgZGVmYXVsdCBhdXRvXG4vLyB1cGRhdGUgdmVyc2lvbiBpZC5cblxuLy8gTm90ZTogVGVzdHMgYWxsb3cgcGVvcGxlIHRvIG92ZXJyaWRlIEF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb24gYmVmb3JlXG4vLyBzdGFydHVwLlxuQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvbiA9IG51bGw7XG5BdXRvdXBkYXRlLmF1dG91cGRhdGVWZXJzaW9uUmVmcmVzaGFibGUgPSBudWxsO1xuQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvbkNvcmRvdmEgPSBudWxsO1xuQXV0b3VwZGF0ZS5hcHBJZCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uYXBwSWQgPSBwcm9jZXNzLmVudi5BUFBfSUQ7XG5cbnZhciBzeW5jUXVldWUgPSBuZXcgTWV0ZW9yLl9TeW5jaHJvbm91c1F1ZXVlKCk7XG5cbmZ1bmN0aW9uIHVwZGF0ZVZlcnNpb25zKHNob3VsZFJlbG9hZENsaWVudFByb2dyYW0pIHtcbiAgLy8gU3RlcCAxOiBsb2FkIHRoZSBjdXJyZW50IGNsaWVudCBwcm9ncmFtIG9uIHRoZSBzZXJ2ZXJcbiAgaWYgKHNob3VsZFJlbG9hZENsaWVudFByb2dyYW0pIHtcbiAgICBXZWJBcHBJbnRlcm5hbHMucmVsb2FkQ2xpZW50UHJvZ3JhbXMoKTtcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICAvLyBJZiB0aGUgQVVUT1VQREFURV9WRVJTSU9OIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIGRlZmluZWQsIGl0IHRha2VzXG4gICAgLy8gcHJlY2VkZW5jZSwgYnV0IEF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb24gaXMgc3RpbGwgc3VwcG9ydGVkIGFzXG4gICAgLy8gYSBmYWxsYmFjay4gSW4gbW9zdCBjYXNlcyBuZWl0aGVyIG9mIHRoZXNlIHZhbHVlcyB3aWxsIGJlIGRlZmluZWQuXG4gICAgQVVUT1VQREFURV9WRVJTSU9OID0gQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvblxuICB9ID0gcHJvY2Vzcy5lbnY7XG5cbiAgLy8gU3RlcCAyOiB1cGRhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5hdXRvdXBkYXRlLnZlcnNpb25zLlxuICBjb25zdCBjbGllbnRBcmNocyA9IE9iamVjdC5rZXlzKFdlYkFwcC5jbGllbnRQcm9ncmFtcyk7XG4gIGNsaWVudEFyY2hzLmZvckVhY2goYXJjaCA9PiB7XG4gICAgQXV0b3VwZGF0ZS52ZXJzaW9uc1thcmNoXSA9IHtcbiAgICAgIHZlcnNpb246IEFVVE9VUERBVEVfVkVSU0lPTiB8fFxuICAgICAgICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaChhcmNoKSxcbiAgICAgIHZlcnNpb25SZWZyZXNoYWJsZTogQVVUT1VQREFURV9WRVJTSU9OIHx8XG4gICAgICAgIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUoYXJjaCksXG4gICAgICB2ZXJzaW9uTm9uUmVmcmVzaGFibGU6IEFVVE9VUERBVEVfVkVSU0lPTiB8fFxuICAgICAgICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlKGFyY2gpLFxuICAgICAgdmVyc2lvblJlcGxhY2VhYmxlOiBBVVRPVVBEQVRFX1ZFUlNJT04gfHxcbiAgICAgICAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZShhcmNoKSxcbiAgICAgIHZlcnNpb25IbXI6IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXS5obXJWZXJzaW9uXG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gU3RlcCAzOiBmb3JtIHRoZSBuZXcgY2xpZW50IGJvaWxlcnBsYXRlIHdoaWNoIGNvbnRhaW5zIHRoZSB1cGRhdGVkXG4gIC8vIGFzc2V0cyBhbmQgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5cbiAgaWYgKHNob3VsZFJlbG9hZENsaWVudFByb2dyYW0pIHtcbiAgICBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSgpO1xuICB9XG5cbiAgLy8gU3RlcCA0OiB1cGRhdGUgdGhlIENsaWVudFZlcnNpb25zIGNvbGxlY3Rpb24uXG4gIC8vIFdlIHVzZSBgb25MaXN0ZW5pbmdgIGhlcmUgYmVjYXVzZSB3ZSBuZWVkIHRvIHVzZVxuICAvLyBgV2ViQXBwLmdldFJlZnJlc2hhYmxlQXNzZXRzYCwgd2hpY2ggaXMgb25seSBzZXQgYWZ0ZXJcbiAgLy8gYFdlYkFwcC5nZW5lcmF0ZUJvaWxlcnBsYXRlYCBpcyBjYWxsZWQgYnkgYG1haW5gIGluIHdlYmFwcC5cbiAgV2ViQXBwLm9uTGlzdGVuaW5nKCgpID0+IHtcbiAgICBjbGllbnRBcmNocy5mb3JFYWNoKGFyY2ggPT4ge1xuICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgLi4uQXV0b3VwZGF0ZS52ZXJzaW9uc1thcmNoXSxcbiAgICAgICAgYXNzZXRzOiBXZWJBcHAuZ2V0UmVmcmVzaGFibGVBc3NldHMoYXJjaCksXG4gICAgICB9O1xuXG4gICAgICBjbGllbnRWZXJzaW9ucy5zZXQoYXJjaCwgcGF5bG9hZCk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5NZXRlb3IucHVibGlzaChcbiAgXCJtZXRlb3JfYXV0b3VwZGF0ZV9jbGllbnRWZXJzaW9uc1wiLFxuICBmdW5jdGlvbiAoYXBwSWQpIHtcbiAgICAvLyBgbnVsbGAgaGFwcGVucyB3aGVuIGEgY2xpZW50IGRvZXNuJ3QgaGF2ZSBhbiBhcHBJZCBhbmQgcGFzc2VzXG4gICAgLy8gYHVuZGVmaW5lZGAgdG8gYE1ldGVvci5zdWJzY3JpYmVgLiBgdW5kZWZpbmVkYCBpcyB0cmFuc2xhdGVkIHRvXG4gICAgLy8gYG51bGxgIGFzIEpTT04gZG9lc24ndCBoYXZlIGB1bmRlZmluZWQuXG4gICAgY2hlY2soYXBwSWQsIE1hdGNoLk9uZU9mKFN0cmluZywgdW5kZWZpbmVkLCBudWxsKSk7XG5cbiAgICAvLyBEb24ndCBub3RpZnkgY2xpZW50cyB1c2luZyB3cm9uZyBhcHBJZCBzdWNoIGFzIG1vYmlsZSBhcHBzIGJ1aWx0IHdpdGggYVxuICAgIC8vIGRpZmZlcmVudCBzZXJ2ZXIgYnV0IHBvaW50aW5nIGF0IHRoZSBzYW1lIGxvY2FsIHVybFxuICAgIGlmIChBdXRvdXBkYXRlLmFwcElkICYmIGFwcElkICYmIEF1dG91cGRhdGUuYXBwSWQgIT09IGFwcElkKVxuICAgICAgcmV0dXJuIFtdO1xuXG4gICAgY29uc3Qgc3RvcCA9IGNsaWVudFZlcnNpb25zLndhdGNoKCh2ZXJzaW9uLCBpc05ldykgPT4ge1xuICAgICAgKGlzTmV3ID8gdGhpcy5hZGRlZCA6IHRoaXMuY2hhbmdlZClcbiAgICAgICAgLmNhbGwodGhpcywgXCJtZXRlb3JfYXV0b3VwZGF0ZV9jbGllbnRWZXJzaW9uc1wiLCB2ZXJzaW9uLl9pZCwgdmVyc2lvbik7XG4gICAgfSk7XG5cbiAgICB0aGlzLm9uU3RvcCgoKSA9PiBzdG9wKCkpO1xuICAgIHRoaXMucmVhZHkoKTtcbiAgfSxcbiAge2lzX2F1dG86IHRydWV9XG4pO1xuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbiAoKSB7XG4gIHVwZGF0ZVZlcnNpb25zKGZhbHNlKTtcblxuICAvLyBGb3JjZSBhbnkgY29ubmVjdGVkIGNsaWVudHMgdGhhdCBhcmUgc3RpbGwgbG9va2luZyBmb3IgdGhlc2Ugb2xkZXJcbiAgLy8gZG9jdW1lbnQgSURzIHRvIHJlbG9hZC5cbiAgW1widmVyc2lvblwiLFxuICAgXCJ2ZXJzaW9uLXJlZnJlc2hhYmxlXCIsXG4gICBcInZlcnNpb24tY29yZG92YVwiLFxuICBdLmZvckVhY2goX2lkID0+IHtcbiAgICBjbGllbnRWZXJzaW9ucy5zZXQoX2lkLCB7XG4gICAgICB2ZXJzaW9uOiBcIm91dGRhdGVkXCJcbiAgICB9KTtcbiAgfSk7XG59KTtcblxudmFyIGZ1dCA9IG5ldyBGdXR1cmUoKTtcblxuLy8gV2Ugb25seSB3YW50ICdyZWZyZXNoJyB0byB0cmlnZ2VyICd1cGRhdGVWZXJzaW9ucycgQUZURVIgb25MaXN0ZW4sXG4vLyBzbyB3ZSBhZGQgYSBxdWV1ZWQgdGFzayB0aGF0IHdhaXRzIGZvciBvbkxpc3RlbiBiZWZvcmUgJ3JlZnJlc2gnIGNhbiBxdWV1ZVxuLy8gdGFza3MuIE5vdGUgdGhhdCB0aGUgYG9uTGlzdGVuaW5nYCBjYWxsYmFja3MgZG8gbm90IGZpcmUgdW50aWwgYWZ0ZXJcbi8vIE1ldGVvci5zdGFydHVwLCBzbyB0aGVyZSBpcyBubyBjb25jZXJuIHRoYXQgdGhlICd1cGRhdGVWZXJzaW9ucycgY2FsbHMgZnJvbVxuLy8gJ3JlZnJlc2gnIHdpbGwgb3ZlcmxhcCB3aXRoIHRoZSBgdXBkYXRlVmVyc2lvbnNgIGNhbGwgZnJvbSBNZXRlb3Iuc3RhcnR1cC5cblxuc3luY1F1ZXVlLnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gIGZ1dC53YWl0KCk7XG59KTtcblxuV2ViQXBwLm9uTGlzdGVuaW5nKGZ1bmN0aW9uICgpIHtcbiAgZnV0LnJldHVybigpO1xufSk7XG5cbmZ1bmN0aW9uIGVucXVldWVWZXJzaW9uc1JlZnJlc2goKSB7XG4gIHN5bmNRdWV1ZS5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgIHVwZGF0ZVZlcnNpb25zKHRydWUpO1xuICB9KTtcbn1cblxuLy8gTGlzdGVuIGZvciBtZXNzYWdlcyBwZXJ0YWluaW5nIHRvIHRoZSBjbGllbnQtcmVmcmVzaCB0b3BpYy5cbmltcG9ydCB7IG9uTWVzc2FnZSB9IGZyb20gXCJtZXRlb3IvaW50ZXItcHJvY2Vzcy1tZXNzYWdpbmdcIjtcbm9uTWVzc2FnZShcImNsaWVudC1yZWZyZXNoXCIsIGVucXVldWVWZXJzaW9uc1JlZnJlc2gpO1xuXG4vLyBBbm90aGVyIHdheSB0byB0ZWxsIHRoZSBwcm9jZXNzIHRvIHJlZnJlc2g6IHNlbmQgU0lHSFVQIHNpZ25hbFxucHJvY2Vzcy5vbignU0lHSFVQJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChmdW5jdGlvbiAoKSB7XG4gIGVucXVldWVWZXJzaW9uc1JlZnJlc2goKTtcbn0sIFwiaGFuZGxpbmcgU0lHSFVQIHNpZ25hbCBmb3IgcmVmcmVzaFwiKSk7XG4iLCJpbXBvcnQgeyBUcmFja2VyIH0gZnJvbSBcIm1ldGVvci90cmFja2VyXCI7XG5cbmV4cG9ydCBjbGFzcyBDbGllbnRWZXJzaW9ucyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuX3ZlcnNpb25zID0gbmV3IE1hcCgpO1xuICAgIHRoaXMuX3dhdGNoQ2FsbGJhY2tzID0gbmV3IFNldCgpO1xuICB9XG5cbiAgLy8gQ3JlYXRlcyBhIExpdmVkYXRhIHN0b3JlIGZvciB1c2Ugd2l0aCBgTWV0ZW9yLmNvbm5lY3Rpb24ucmVnaXN0ZXJTdG9yZWAuXG4gIC8vIEFmdGVyIHRoZSBzdG9yZSBpcyByZWdpc3RlcmVkLCBkb2N1bWVudCB1cGRhdGVzIHJlcG9ydGVkIGJ5IExpdmVkYXRhIGFyZVxuICAvLyBtZXJnZWQgd2l0aCB0aGUgZG9jdW1lbnRzIGluIHRoaXMgYENsaWVudFZlcnNpb25zYCBpbnN0YW5jZS5cbiAgY3JlYXRlU3RvcmUoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHVwZGF0ZTogKHsgaWQsIG1zZywgZmllbGRzIH0pID0+IHtcbiAgICAgICAgaWYgKG1zZyA9PT0gXCJhZGRlZFwiIHx8IG1zZyA9PT0gXCJjaGFuZ2VkXCIpIHtcbiAgICAgICAgICB0aGlzLnNldChpZCwgZmllbGRzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBoYXNWZXJzaW9ucygpIHtcbiAgICByZXR1cm4gdGhpcy5fdmVyc2lvbnMuc2l6ZSA+IDA7XG4gIH1cblxuICBnZXQoaWQpIHtcbiAgICByZXR1cm4gdGhpcy5fdmVyc2lvbnMuZ2V0KGlkKTtcbiAgfVxuXG4gIC8vIEFkZHMgb3IgdXBkYXRlcyBhIHZlcnNpb24gZG9jdW1lbnQgYW5kIGludm9rZXMgcmVnaXN0ZXJlZCBjYWxsYmFja3MgZm9yIHRoZVxuICAvLyBhZGRlZC91cGRhdGVkIGRvY3VtZW50LiBJZiBhIGRvY3VtZW50IHdpdGggdGhlIGdpdmVuIElEIGFscmVhZHkgZXhpc3RzLCBpdHNcbiAgLy8gZmllbGRzIGFyZSBtZXJnZWQgd2l0aCBgZmllbGRzYC5cbiAgc2V0KGlkLCBmaWVsZHMpIHtcbiAgICBsZXQgdmVyc2lvbiA9IHRoaXMuX3ZlcnNpb25zLmdldChpZCk7XG4gICAgbGV0IGlzTmV3ID0gZmFsc2U7XG5cbiAgICBpZiAodmVyc2lvbikge1xuICAgICAgT2JqZWN0LmFzc2lnbih2ZXJzaW9uLCBmaWVsZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2ZXJzaW9uID0ge1xuICAgICAgICBfaWQ6IGlkLFxuICAgICAgICAuLi5maWVsZHNcbiAgICAgIH07XG5cbiAgICAgIGlzTmV3ID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3ZlcnNpb25zLnNldChpZCwgdmVyc2lvbik7XG4gICAgfVxuXG4gICAgdGhpcy5fd2F0Y2hDYWxsYmFja3MuZm9yRWFjaCgoeyBmbiwgZmlsdGVyIH0pID0+IHtcbiAgICAgIGlmICghIGZpbHRlciB8fCBmaWx0ZXIgPT09IHZlcnNpb24uX2lkKSB7XG4gICAgICAgIGZuKHZlcnNpb24sIGlzTmV3KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVycyBhIGNhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIHdoZW4gYSB2ZXJzaW9uIGRvY3VtZW50IGlzIGFkZGVkXG4gIC8vIG9yIGNoYW5nZWQuIENhbGxpbmcgdGhlIGZ1bmN0aW9uIHJldHVybmVkIGJ5IGB3YXRjaGAgcmVtb3ZlcyB0aGUgY2FsbGJhY2suXG4gIC8vIElmIGBza2lwSW5pdGlhbGAgaXMgdHJ1ZSwgdGhlIGNhbGxiYWNrIGlzbid0IGJlIGludm9rZWQgZm9yIGV4aXN0aW5nXG4gIC8vIGRvY3VtZW50cy4gSWYgYGZpbHRlcmAgaXMgc2V0LCB0aGUgY2FsbGJhY2sgaXMgb25seSBpbnZva2VkIGZvciBkb2N1bWVudHNcbiAgLy8gd2l0aCBJRCBgZmlsdGVyYC5cbiAgd2F0Y2goZm4sIHsgc2tpcEluaXRpYWwsIGZpbHRlciB9ID0ge30pIHtcbiAgICBpZiAoISBza2lwSW5pdGlhbCkge1xuICAgICAgY29uc3QgcmVzb2x2ZWQgPSBQcm9taXNlLnJlc29sdmUoKTtcblxuICAgICAgdGhpcy5fdmVyc2lvbnMuZm9yRWFjaCgodmVyc2lvbikgPT4ge1xuICAgICAgICBpZiAoISBmaWx0ZXIgfHwgZmlsdGVyID09PSB2ZXJzaW9uLl9pZCkge1xuICAgICAgICAgIHJlc29sdmVkLnRoZW4oKCkgPT4gZm4odmVyc2lvbiwgdHJ1ZSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjYWxsYmFjayA9IHsgZm4sIGZpbHRlciB9O1xuICAgIHRoaXMuX3dhdGNoQ2FsbGJhY2tzLmFkZChjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gKCkgPT4gdGhpcy5fd2F0Y2hDYWxsYmFja3MuZGVsZXRlKGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8vIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UgZm9yIGBBdXRvdXBkYXRlLm5ld0NsaWVudEF2YWlsYWJsZWAuXG4gIG5ld0NsaWVudEF2YWlsYWJsZShpZCwgZmllbGRzLCBjdXJyZW50VmVyc2lvbikge1xuICAgIGZ1bmN0aW9uIGlzTmV3VmVyc2lvbih2ZXJzaW9uKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICB2ZXJzaW9uLl9pZCA9PT0gaWQgJiZcbiAgICAgICAgZmllbGRzLnNvbWUoKGZpZWxkKSA9PiB2ZXJzaW9uW2ZpZWxkXSAhPT0gY3VycmVudFZlcnNpb25bZmllbGRdKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBkZXBlbmRlbmN5ID0gbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLmdldChpZCk7XG5cbiAgICBkZXBlbmRlbmN5LmRlcGVuZCgpO1xuXG4gICAgY29uc3Qgc3RvcCA9IHRoaXMud2F0Y2goXG4gICAgICAodmVyc2lvbikgPT4ge1xuICAgICAgICBpZiAoaXNOZXdWZXJzaW9uKHZlcnNpb24pKSB7XG4gICAgICAgICAgZGVwZW5kZW5jeS5jaGFuZ2VkKCk7XG4gICAgICAgICAgc3RvcCgpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgeyBza2lwSW5pdGlhbDogdHJ1ZSB9XG4gICAgKTtcblxuICAgIHJldHVybiAhISB2ZXJzaW9uICYmIGlzTmV3VmVyc2lvbih2ZXJzaW9uKTtcbiAgfVxufVxuIl19
