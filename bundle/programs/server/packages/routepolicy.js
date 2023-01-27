(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var RoutePolicy;

var require = meteorInstall({"node_modules":{"meteor":{"routepolicy":{"main.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/routepolicy/main.js                                                                         //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
module.export({
  RoutePolicy: () => RoutePolicy
});
let RoutePolicyConstructor;
module.link("./routepolicy", {
  default(v) {
    RoutePolicyConstructor = v;
  }
}, 0);
const RoutePolicy = new RoutePolicyConstructor();
//////////////////////////////////////////////////////////////////////////////////////////////////////////

},"routepolicy.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                      //
// packages/routepolicy/routepolicy.js                                                                  //
//                                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                        //
module.export({
  default: () => RoutePolicy
});
class RoutePolicy {
  constructor() {
    // maps prefix to a type
    this.urlPrefixTypes = {};
  }
  urlPrefixMatches(urlPrefix, url) {
    return url.startsWith(urlPrefix);
  }
  checkType(type) {
    if (!['network', 'static-online'].includes(type)) {
      return 'the route type must be "network" or "static-online"';
    }
    return null;
  }
  checkUrlPrefix(urlPrefix, type) {
    if (!urlPrefix.startsWith('/')) {
      return 'a route URL prefix must begin with a slash';
    }
    if (urlPrefix === '/') {
      return 'a route URL prefix cannot be /';
    }
    const existingType = this.urlPrefixTypes[urlPrefix];
    if (existingType && existingType !== type) {
      return "the route URL prefix ".concat(urlPrefix, " has already been declared ") + "to be of type ".concat(existingType);
    }
    return null;
  }
  checkForConflictWithStatic(urlPrefix, type, _testManifest) {
    if (type === 'static-online') {
      return null;
    }
    const policy = this;
    function check(manifest) {
      const conflict = manifest.find(resource => resource.type === 'static' && resource.where === 'client' && policy.urlPrefixMatches(urlPrefix, resource.url));
      if (conflict) {
        return "static resource ".concat(conflict.url, " conflicts with ").concat(type, " ") + "route ".concat(urlPrefix);
      }
      return null;
    }
    ;
    if (_testManifest) {
      return check(_testManifest);
    }
    const {
      WebApp
    } = require("meteor/webapp");
    let errorMessage = null;
    Object.keys(WebApp.clientPrograms).some(arch => {
      const {
        manifest
      } = WebApp.clientPrograms[arch];
      return errorMessage = check(manifest);
    });
    return errorMessage;
  }
  declare(urlPrefix, type) {
    const problem = this.checkType(type) || this.checkUrlPrefix(urlPrefix, type) || this.checkForConflictWithStatic(urlPrefix, type);
    if (problem) {
      throw new Error(problem);
    }
    // TODO overlapping prefixes, e.g. /foo/ and /foo/bar/
    this.urlPrefixTypes[urlPrefix] = type;
  }
  isValidUrl(url) {
    return url.startsWith('/');
  }
  classify(url) {
    if (!this.isValidUrl(url)) {
      throw new Error("url must be a relative URL: ".concat(url));
    }
    const prefix = Object.keys(this.urlPrefixTypes).find(prefix => this.urlPrefixMatches(prefix, url));
    return prefix ? this.urlPrefixTypes[prefix] : null;
  }
  urlPrefixesFor(type) {
    return Object.entries(this.urlPrefixTypes).filter(_ref => {
      let [_prefix, _type] = _ref;
      return _type === type;
    }).map(_ref2 => {
      let [_prefix] = _ref2;
      return _prefix;
    }).sort();
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/routepolicy/main.js");

/* Exports */
Package._define("routepolicy", exports, {
  RoutePolicy: RoutePolicy
});

})();

//# sourceURL=meteor://💻app/packages/routepolicy.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm91dGVwb2xpY3kvbWFpbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm91dGVwb2xpY3kvcm91dGVwb2xpY3kuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiUm91dGVQb2xpY3kiLCJSb3V0ZVBvbGljeUNvbnN0cnVjdG9yIiwibGluayIsImRlZmF1bHQiLCJ2IiwiY29uc3RydWN0b3IiLCJ1cmxQcmVmaXhUeXBlcyIsInVybFByZWZpeE1hdGNoZXMiLCJ1cmxQcmVmaXgiLCJ1cmwiLCJzdGFydHNXaXRoIiwiY2hlY2tUeXBlIiwidHlwZSIsImluY2x1ZGVzIiwiY2hlY2tVcmxQcmVmaXgiLCJleGlzdGluZ1R5cGUiLCJjaGVja0ZvckNvbmZsaWN0V2l0aFN0YXRpYyIsIl90ZXN0TWFuaWZlc3QiLCJwb2xpY3kiLCJjaGVjayIsIm1hbmlmZXN0IiwiY29uZmxpY3QiLCJmaW5kIiwicmVzb3VyY2UiLCJ3aGVyZSIsIldlYkFwcCIsInJlcXVpcmUiLCJlcnJvck1lc3NhZ2UiLCJPYmplY3QiLCJrZXlzIiwiY2xpZW50UHJvZ3JhbXMiLCJzb21lIiwiYXJjaCIsImRlY2xhcmUiLCJwcm9ibGVtIiwiRXJyb3IiLCJpc1ZhbGlkVXJsIiwiY2xhc3NpZnkiLCJwcmVmaXgiLCJ1cmxQcmVmaXhlc0ZvciIsImVudHJpZXMiLCJmaWx0ZXIiLCJfcHJlZml4IiwiX3R5cGUiLCJtYXAiLCJzb3J0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0MsV0FBVyxFQUFDLE1BQUlBO0FBQVcsQ0FBQyxDQUFDO0FBQUMsSUFBSUMsc0JBQXNCO0FBQUNILE1BQU0sQ0FBQ0ksSUFBSSxDQUFDLGVBQWUsRUFBQztFQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztJQUFDSCxzQkFBc0IsR0FBQ0csQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFD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IGRlZmF1bHQgYXMgUm91dGVQb2xpY3lDb25zdHJ1Y3RvciB9IGZyb20gJy4vcm91dGVwb2xpY3knO1xuZXhwb3J0IGNvbnN0IFJvdXRlUG9saWN5ID0gbmV3IFJvdXRlUG9saWN5Q29uc3RydWN0b3IoKTtcbiIsIi8vIEluIGFkZGl0aW9uIHRvIGxpc3Rpbmcgc3BlY2lmaWMgZmlsZXMgdG8gYmUgY2FjaGVkLCB0aGUgYnJvd3NlclxuLy8gYXBwbGljYXRpb24gY2FjaGUgbWFuaWZlc3QgYWxsb3dzIFVSTHMgdG8gYmUgZGVzaWduYXRlZCBhcyBORVRXT1JLXG4vLyAoYWx3YXlzIGZldGNoZWQgZnJvbSB0aGUgSW50ZXJuZXQpIGFuZCBGQUxMQkFDSyAod2hpY2ggd2UgdXNlIHRvXG4vLyBzZXJ2ZSBhcHAgSFRNTCBvbiBhcmJpdHJhcnkgVVJMcykuXG4vL1xuLy8gVGhlIGxpbWl0YXRpb24gb2YgdGhlIG1hbmlmZXN0IGZpbGUgZm9ybWF0IGlzIHRoYXQgdGhlIGRlc2lnbmF0aW9uc1xuLy8gYXJlIGJ5IHByZWZpeCBvbmx5OiBpZiBcIi9mb29cIiBpcyBkZWNsYXJlZCBORVRXT1JLIHRoZW4gXCIvZm9vYmFyXCJcbi8vIHdpbGwgYWxzbyBiZSB0cmVhdGVkIGFzIGEgbmV0d29yayByb3V0ZS5cbi8vXG4vLyBSb3V0ZVBvbGljeSBpcyBhIGxvdy1sZXZlbCBBUEkgZm9yIGRlY2xhcmluZyB0aGUgcm91dGUgdHlwZSBvZiBVUkwgcHJlZml4ZXM6XG4vL1xuLy8gXCJuZXR3b3JrXCI6IGZvciBuZXR3b3JrIHJvdXRlcyB0aGF0IHNob3VsZCBub3QgY29uZmxpY3Qgd2l0aCBzdGF0aWNcbi8vIHJlc291cmNlcy4gIChGb3IgZXhhbXBsZSwgaWYgXCIvc29ja2pzL1wiIGlzIGEgbmV0d29yayByb3V0ZSwgd2Vcbi8vIHNob3VsZG4ndCBoYXZlIFwiL3NvY2tqcy9yZWQtc29jay5qcGdcIiBhcyBhIHN0YXRpYyByZXNvdXJjZSkuXG4vL1xuLy8gXCJzdGF0aWMtb25saW5lXCI6IGZvciBzdGF0aWMgcmVzb3VyY2VzIHdoaWNoIHNob3VsZCBub3QgYmUgY2FjaGVkIGluXG4vLyB0aGUgYXBwIGNhY2hlLiAgVGhpcyBpcyBpbXBsZW1lbnRlZCBieSBhbHNvIGFkZGluZyB0aGVtIHRvIHRoZVxuLy8gTkVUV09SSyBzZWN0aW9uIChhcyBvdGhlcndpc2UgdGhlIGJyb3dzZXIgd291bGQgcmVjZWl2ZSBhcHAgSFRNTFxuLy8gZm9yIHRoZW0gYmVjYXVzZSBvZiB0aGUgRkFMTEJBQ0sgc2VjdGlvbiksIGJ1dCBzdGF0aWMtb25saW5lIHJvdXRlc1xuLy8gZG9uJ3QgbmVlZCB0byBiZSBjaGVja2VkIGZvciBjb25mbGljdCB3aXRoIHN0YXRpYyByZXNvdXJjZXMuXG5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUm91dGVQb2xpY3kge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBtYXBzIHByZWZpeCB0byBhIHR5cGVcbiAgICB0aGlzLnVybFByZWZpeFR5cGVzID0ge307XG4gIH1cblxuICB1cmxQcmVmaXhNYXRjaGVzKHVybFByZWZpeCwgdXJsKSB7XG4gICAgcmV0dXJuIHVybC5zdGFydHNXaXRoKHVybFByZWZpeCk7XG4gIH1cblxuICBjaGVja1R5cGUodHlwZSkge1xuICAgIGlmICghWyduZXR3b3JrJywgJ3N0YXRpYy1vbmxpbmUnXS5pbmNsdWRlcyh0eXBlKSkge1xuICAgICAgcmV0dXJuICd0aGUgcm91dGUgdHlwZSBtdXN0IGJlIFwibmV0d29ya1wiIG9yIFwic3RhdGljLW9ubGluZVwiJztcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjaGVja1VybFByZWZpeCh1cmxQcmVmaXgsIHR5cGUpIHtcbiAgICBpZiAoIXVybFByZWZpeC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIHJldHVybiAnYSByb3V0ZSBVUkwgcHJlZml4IG11c3QgYmVnaW4gd2l0aCBhIHNsYXNoJztcbiAgICB9XG5cbiAgICBpZiAodXJsUHJlZml4ID09PSAnLycpIHtcbiAgICAgIHJldHVybiAnYSByb3V0ZSBVUkwgcHJlZml4IGNhbm5vdCBiZSAvJztcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdGluZ1R5cGUgPSB0aGlzLnVybFByZWZpeFR5cGVzW3VybFByZWZpeF07XG4gICAgaWYgKGV4aXN0aW5nVHlwZSAmJiBleGlzdGluZ1R5cGUgIT09IHR5cGUpIHtcbiAgICAgIHJldHVybiBgdGhlIHJvdXRlIFVSTCBwcmVmaXggJHt1cmxQcmVmaXh9IGhhcyBhbHJlYWR5IGJlZW4gZGVjbGFyZWQgYCArXG4gICAgICAgIGB0byBiZSBvZiB0eXBlICR7ZXhpc3RpbmdUeXBlfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjaGVja0ZvckNvbmZsaWN0V2l0aFN0YXRpYyh1cmxQcmVmaXgsIHR5cGUsIF90ZXN0TWFuaWZlc3QpIHtcbiAgICBpZiAodHlwZSA9PT0gJ3N0YXRpYy1vbmxpbmUnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBwb2xpY3kgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gY2hlY2sobWFuaWZlc3QpIHtcbiAgICAgIGNvbnN0IGNvbmZsaWN0ID0gbWFuaWZlc3QuZmluZChyZXNvdXJjZSA9PiAoXG4gICAgICAgIHJlc291cmNlLnR5cGUgPT09ICdzdGF0aWMnICYmXG4gICAgICAgIHJlc291cmNlLndoZXJlID09PSAnY2xpZW50JyAmJlxuICAgICAgICBwb2xpY3kudXJsUHJlZml4TWF0Y2hlcyh1cmxQcmVmaXgsIHJlc291cmNlLnVybClcbiAgICAgICkpO1xuXG4gICAgICBpZiAoY29uZmxpY3QpIHtcbiAgICAgICAgcmV0dXJuIGBzdGF0aWMgcmVzb3VyY2UgJHtjb25mbGljdC51cmx9IGNvbmZsaWN0cyB3aXRoICR7dHlwZX0gYCArXG4gICAgICAgICAgYHJvdXRlICR7dXJsUHJlZml4fWA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG5cbiAgICBpZiAoX3Rlc3RNYW5pZmVzdCkge1xuICAgICAgcmV0dXJuIGNoZWNrKF90ZXN0TWFuaWZlc3QpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgV2ViQXBwIH0gPSByZXF1aXJlKFwibWV0ZW9yL3dlYmFwcFwiKTtcbiAgICBsZXQgZXJyb3JNZXNzYWdlID0gbnVsbDtcblxuICAgIE9iamVjdC5rZXlzKFdlYkFwcC5jbGllbnRQcm9ncmFtcykuc29tZShhcmNoID0+IHtcbiAgICAgIGNvbnN0IHsgbWFuaWZlc3QgfSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICAgIHJldHVybiBlcnJvck1lc3NhZ2UgPSBjaGVjayhtYW5pZmVzdCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZXJyb3JNZXNzYWdlO1xuICB9XG5cbiAgZGVjbGFyZSh1cmxQcmVmaXgsIHR5cGUpIHtcbiAgICBjb25zdCBwcm9ibGVtID1cbiAgICAgIHRoaXMuY2hlY2tUeXBlKHR5cGUpIHx8XG4gICAgICB0aGlzLmNoZWNrVXJsUHJlZml4KHVybFByZWZpeCwgdHlwZSkgfHxcbiAgICAgIHRoaXMuY2hlY2tGb3JDb25mbGljdFdpdGhTdGF0aWModXJsUHJlZml4LCB0eXBlKTtcbiAgICBpZiAocHJvYmxlbSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKHByb2JsZW0pO1xuICAgIH1cbiAgICAvLyBUT0RPIG92ZXJsYXBwaW5nIHByZWZpeGVzLCBlLmcuIC9mb28vIGFuZCAvZm9vL2Jhci9cbiAgICB0aGlzLnVybFByZWZpeFR5cGVzW3VybFByZWZpeF0gPSB0eXBlO1xuICB9XG5cbiAgaXNWYWxpZFVybCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnN0YXJ0c1dpdGgoJy8nKTtcbiAgfVxuXG4gIGNsYXNzaWZ5KHVybCkge1xuICAgIGlmICghdGhpcy5pc1ZhbGlkVXJsKHVybCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgdXJsIG11c3QgYmUgYSByZWxhdGl2ZSBVUkw6ICR7dXJsfWApO1xuICAgIH1cblxuICAgIGNvbnN0IHByZWZpeCA9IE9iamVjdC5rZXlzKHRoaXMudXJsUHJlZml4VHlwZXMpLmZpbmQocHJlZml4ID0+XG4gICAgICB0aGlzLnVybFByZWZpeE1hdGNoZXMocHJlZml4LCB1cmwpXG4gICAgKTtcblxuICAgIHJldHVybiBwcmVmaXggPyB0aGlzLnVybFByZWZpeFR5cGVzW3ByZWZpeF0gOiBudWxsO1xuICB9XG5cbiAgdXJsUHJlZml4ZXNGb3IodHlwZSkge1xuICAgIHJldHVybiBPYmplY3QuZW50cmllcyh0aGlzLnVybFByZWZpeFR5cGVzKVxuICAgICAgLmZpbHRlcigoW19wcmVmaXgsIF90eXBlXSkgPT4gX3R5cGUgPT09IHR5cGUpXG4gICAgICAubWFwKChbX3ByZWZpeF0pID0+IF9wcmVmaXgpXG4gICAgICAuc29ydCgpO1xuICB9XG59XG4iXX0=
