(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Boilerplate = Package['boilerplate-generator'].Boilerplate;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var WebApp, WebAppInternals, main;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/webapp/webapp_server.js                                                                       //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
!function (module1) {
  let _objectSpread;
  module1.link("@babel/runtime/helpers/objectSpread2", {
    default(v) {
      _objectSpread = v;
    }
  }, 0);
  module1.export({
    WebApp: () => WebApp,
    WebAppInternals: () => WebAppInternals
  });
  let assert;
  module1.link("assert", {
    default(v) {
      assert = v;
    }
  }, 0);
  let readFileSync, chmodSync, chownSync;
  module1.link("fs", {
    readFileSync(v) {
      readFileSync = v;
    },
    chmodSync(v) {
      chmodSync = v;
    },
    chownSync(v) {
      chownSync = v;
    }
  }, 1);
  let createServer;
  module1.link("http", {
    createServer(v) {
      createServer = v;
    }
  }, 2);
  let userInfo;
  module1.link("os", {
    userInfo(v) {
      userInfo = v;
    }
  }, 3);
  let pathJoin, pathDirname;
  module1.link("path", {
    join(v) {
      pathJoin = v;
    },
    dirname(v) {
      pathDirname = v;
    }
  }, 4);
  let parseUrl;
  module1.link("url", {
    parse(v) {
      parseUrl = v;
    }
  }, 5);
  let createHash;
  module1.link("crypto", {
    createHash(v) {
      createHash = v;
    }
  }, 6);
  let connect;
  module1.link("./connect.js", {
    connect(v) {
      connect = v;
    }
  }, 7);
  let compress;
  module1.link("compression", {
    default(v) {
      compress = v;
    }
  }, 8);
  let cookieParser;
  module1.link("cookie-parser", {
    default(v) {
      cookieParser = v;
    }
  }, 9);
  let qs;
  module1.link("qs", {
    default(v) {
      qs = v;
    }
  }, 10);
  let parseRequest;
  module1.link("parseurl", {
    default(v) {
      parseRequest = v;
    }
  }, 11);
  let basicAuth;
  module1.link("basic-auth-connect", {
    default(v) {
      basicAuth = v;
    }
  }, 12);
  let lookupUserAgent;
  module1.link("useragent", {
    lookup(v) {
      lookupUserAgent = v;
    }
  }, 13);
  let isModern;
  module1.link("meteor/modern-browsers", {
    isModern(v) {
      isModern = v;
    }
  }, 14);
  let send;
  module1.link("send", {
    default(v) {
      send = v;
    }
  }, 15);
  let removeExistingSocketFile, registerSocketFileCleanup;
  module1.link("./socket_file.js", {
    removeExistingSocketFile(v) {
      removeExistingSocketFile = v;
    },
    registerSocketFileCleanup(v) {
      registerSocketFileCleanup = v;
    }
  }, 16);
  let cluster;
  module1.link("cluster", {
    default(v) {
      cluster = v;
    }
  }, 17);
  let whomst;
  module1.link("@vlasky/whomst", {
    default(v) {
      whomst = v;
    }
  }, 18);
  let onMessage;
  module1.link("meteor/inter-process-messaging", {
    onMessage(v) {
      onMessage = v;
    }
  }, 19);
  var SHORT_SOCKET_TIMEOUT = 5 * 1000;
  var LONG_SOCKET_TIMEOUT = 120 * 1000;
  const WebApp = {};
  const WebAppInternals = {};
  const hasOwn = Object.prototype.hasOwnProperty;

  // backwards compat to 2.0 of connect
  connect.basicAuth = basicAuth;
  WebAppInternals.NpmModules = {
    connect: {
      version: Npm.require('connect/package.json').version,
      module: connect
    }
  };

  // Though we might prefer to use web.browser (modern) as the default
  // architecture, safety requires a more compatible defaultArch.
  WebApp.defaultArch = 'web.browser.legacy';

  // XXX maps archs to manifests
  WebApp.clientPrograms = {};

  // XXX maps archs to program path on filesystem
  var archPath = {};
  var bundledJsCssUrlRewriteHook = function (url) {
    var bundledPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';
    return bundledPrefix + url;
  };
  var sha1 = function (contents) {
    var hash = createHash('sha1');
    hash.update(contents);
    return hash.digest('hex');
  };
  function shouldCompress(req, res) {
    if (req.headers['x-no-compression']) {
      // don't compress responses with this request header
      return false;
    }

    // fallback to standard filter function
    return compress.filter(req, res);
  }

  // #BrowserIdentification
  //
  // We have multiple places that want to identify the browser: the
  // unsupported browser page, the appcache package, and, eventually
  // delivering browser polyfills only as needed.
  //
  // To avoid detecting the browser in multiple places ad-hoc, we create a
  // Meteor "browser" object. It uses but does not expose the npm
  // useragent module (we could choose a different mechanism to identify
  // the browser in the future if we wanted to).  The browser object
  // contains
  //
  // * `name`: the name of the browser in camel case
  // * `major`, `minor`, `patch`: integers describing the browser version
  //
  // Also here is an early version of a Meteor `request` object, intended
  // to be a high-level description of the request without exposing
  // details of connect's low-level `req`.  Currently it contains:
  //
  // * `browser`: browser identification object described above
  // * `url`: parsed url, including parsed query params
  //
  // As a temporary hack there is a `categorizeRequest` function on WebApp which
  // converts a connect `req` to a Meteor `request`. This can go away once smart
  // packages such as appcache are being passed a `request` object directly when
  // they serve content.
  //
  // This allows `request` to be used uniformly: it is passed to the html
  // attributes hook, and the appcache package can use it when deciding
  // whether to generate a 404 for the manifest.
  //
  // Real routing / server side rendering will probably refactor this
  // heavily.

  // e.g. "Mobile Safari" => "mobileSafari"
  var camelCase = function (name) {
    var parts = name.split(' ');
    parts[0] = parts[0].toLowerCase();
    for (var i = 1; i < parts.length; ++i) {
      parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);
    }
    return parts.join('');
  };
  var identifyBrowser = function (userAgentString) {
    var userAgent = lookupUserAgent(userAgentString);
    return {
      name: camelCase(userAgent.family),
      major: +userAgent.major,
      minor: +userAgent.minor,
      patch: +userAgent.patch
    };
  };

  // XXX Refactor as part of implementing real routing.
  WebAppInternals.identifyBrowser = identifyBrowser;
  WebApp.categorizeRequest = function (req) {
    if (req.browser && req.arch && typeof req.modern === 'boolean') {
      // Already categorized.
      return req;
    }
    const browser = identifyBrowser(req.headers['user-agent']);
    const modern = isModern(browser);
    const path = typeof req.pathname === 'string' ? req.pathname : parseRequest(req).pathname;
    const categorized = {
      browser,
      modern,
      path,
      arch: WebApp.defaultArch,
      url: parseUrl(req.url, true),
      dynamicHead: req.dynamicHead,
      dynamicBody: req.dynamicBody,
      headers: req.headers,
      cookies: req.cookies
    };
    const pathParts = path.split('/');
    const archKey = pathParts[1];
    if (archKey.startsWith('__')) {
      const archCleaned = 'web.' + archKey.slice(2);
      if (hasOwn.call(WebApp.clientPrograms, archCleaned)) {
        pathParts.splice(1, 1); // Remove the archKey part.
        return Object.assign(categorized, {
          arch: archCleaned,
          path: pathParts.join('/')
        });
      }
    }

    // TODO Perhaps one day we could infer Cordova clients here, so that we
    // wouldn't have to use prefixed "/__cordova/..." URLs.
    const preferredArchOrder = isModern(browser) ? ['web.browser', 'web.browser.legacy'] : ['web.browser.legacy', 'web.browser'];
    for (const arch of preferredArchOrder) {
      // If our preferred arch is not available, it's better to use another
      // client arch that is available than to guarantee the site won't work
      // by returning an unknown arch. For example, if web.browser.legacy is
      // excluded using the --exclude-archs command-line option, legacy
      // clients are better off receiving web.browser (which might actually
      // work) than receiving an HTTP 404 response. If none of the archs in
      // preferredArchOrder are defined, only then should we send a 404.
      if (hasOwn.call(WebApp.clientPrograms, arch)) {
        return Object.assign(categorized, {
          arch
        });
      }
    }
    return categorized;
  };

  // HTML attribute hooks: functions to be called to determine any attributes to
  // be added to the '<html>' tag. Each function is passed a 'request' object (see
  // #BrowserIdentification) and should return null or object.
  var htmlAttributeHooks = [];
  var getHtmlAttributes = function (request) {
    var combinedAttributes = {};
    _.each(htmlAttributeHooks || [], function (hook) {
      var attributes = hook(request);
      if (attributes === null) return;
      if (typeof attributes !== 'object') throw Error('HTML attribute hook must return null or object');
      _.extend(combinedAttributes, attributes);
    });
    return combinedAttributes;
  };
  WebApp.addHtmlAttributeHook = function (hook) {
    htmlAttributeHooks.push(hook);
  };

  // Serve app HTML for this URL?
  var appUrl = function (url) {
    if (url === '/favicon.ico' || url === '/robots.txt') return false;

    // NOTE: app.manifest is not a web standard like favicon.ico and
    // robots.txt. It is a file name we have chosen to use for HTML5
    // appcache URLs. It is included here to prevent using an appcache
    // then removing it from poisoning an app permanently. Eventually,
    // once we have server side routing, this won't be needed as
    // unknown URLs with return a 404 automatically.
    if (url === '/app.manifest') return false;

    // Avoid serving app HTML for declared routes such as /sockjs/.
    if (RoutePolicy.classify(url)) return false;

    // we currently return app HTML on all URLs by default
    return true;
  };

  // We need to calculate the client hash after all packages have loaded
  // to give them a chance to populate __meteor_runtime_config__.
  //
  // Calculating the hash during startup means that packages can only
  // populate __meteor_runtime_config__ during load, not during startup.
  //
  // Calculating instead it at the beginning of main after all startup
  // hooks had run would allow packages to also populate
  // __meteor_runtime_config__ during startup, but that's too late for
  // autoupdate because it needs to have the client hash at startup to
  // insert the auto update version itself into
  // __meteor_runtime_config__ to get it to the client.
  //
  // An alternative would be to give autoupdate a "post-start,
  // pre-listen" hook to allow it to insert the auto update version at
  // the right moment.

  Meteor.startup(function () {
    function getter(key) {
      return function (arch) {
        arch = arch || WebApp.defaultArch;
        const program = WebApp.clientPrograms[arch];
        const value = program && program[key];
        // If this is the first time we have calculated this hash,
        // program[key] will be a thunk (lazy function with no parameters)
        // that we should call to do the actual computation.
        return typeof value === 'function' ? program[key] = value() : value;
      };
    }
    WebApp.calculateClientHash = WebApp.clientHash = getter('version');
    WebApp.calculateClientHashRefreshable = getter('versionRefreshable');
    WebApp.calculateClientHashNonRefreshable = getter('versionNonRefreshable');
    WebApp.calculateClientHashReplaceable = getter('versionReplaceable');
    WebApp.getRefreshableAssets = getter('refreshableAssets');
  });

  // When we have a request pending, we want the socket timeout to be long, to
  // give ourselves a while to serve it, and to allow sockjs long polls to
  // complete.  On the other hand, we want to close idle sockets relatively
  // quickly, so that we can shut down relatively promptly but cleanly, without
  // cutting off anyone's response.
  WebApp._timeoutAdjustmentRequestCallback = function (req, res) {
    // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);
    req.setTimeout(LONG_SOCKET_TIMEOUT);
    // Insert our new finish listener to run BEFORE the existing one which removes
    // the response from the socket.
    var finishListeners = res.listeners('finish');
    // XXX Apparently in Node 0.12 this event was called 'prefinish'.
    // https://github.com/joyent/node/commit/7c9b6070
    // But it has switched back to 'finish' in Node v4:
    // https://github.com/nodejs/node/pull/1411
    res.removeAllListeners('finish');
    res.on('finish', function () {
      res.setTimeout(SHORT_SOCKET_TIMEOUT);
    });
    _.each(finishListeners, function (l) {
      res.on('finish', l);
    });
  };

  // Will be updated by main before we listen.
  // Map from client arch to boilerplate object.
  // Boilerplate object has:
  //   - func: XXX
  //   - baseData: XXX
  var boilerplateByArch = {};

  // Register a callback function that can selectively modify boilerplate
  // data given arguments (request, data, arch). The key should be a unique
  // identifier, to prevent accumulating duplicate callbacks from the same
  // call site over time. Callbacks will be called in the order they were
  // registered. A callback should return false if it did not make any
  // changes affecting the boilerplate. Passing null deletes the callback.
  // Any previous callback registered for this key will be returned.
  const boilerplateDataCallbacks = Object.create(null);
  WebAppInternals.registerBoilerplateDataCallback = function (key, callback) {
    const previousCallback = boilerplateDataCallbacks[key];
    if (typeof callback === 'function') {
      boilerplateDataCallbacks[key] = callback;
    } else {
      assert.strictEqual(callback, null);
      delete boilerplateDataCallbacks[key];
    }

    // Return the previous callback in case the new callback needs to call
    // it; for example, when the new callback is a wrapper for the old.
    return previousCallback || null;
  };

  // Given a request (as returned from `categorizeRequest`), return the
  // boilerplate HTML to serve for that request.
  //
  // If a previous connect middleware has rendered content for the head or body,
  // returns the boilerplate with that content patched in otherwise
  // memoizes on HTML attributes (used by, eg, appcache) and whether inline
  // scripts are currently allowed.
  // XXX so far this function is always called with arch === 'web.browser'
  function getBoilerplate(request, arch) {
    return getBoilerplateAsync(request, arch).await();
  }

  /**
   * @summary Takes a runtime configuration object and
   * returns an encoded runtime string.
   * @locus Server
   * @param {Object} rtimeConfig
   * @returns {String}
   */
  WebApp.encodeRuntimeConfig = function (rtimeConfig) {
    return JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
  };

  /**
   * @summary Takes an encoded runtime string and returns
   * a runtime configuration object.
   * @locus Server
   * @param {String} rtimeConfigString
   * @returns {Object}
   */
  WebApp.decodeRuntimeConfig = function (rtimeConfigStr) {
    return JSON.parse(decodeURIComponent(JSON.parse(rtimeConfigStr)));
  };
  const runtimeConfig = {
    // hooks will contain the callback functions
    // set by the caller to addRuntimeConfigHook
    hooks: new Hook(),
    // updateHooks will contain the callback functions
    // set by the caller to addUpdatedNotifyHook
    updateHooks: new Hook(),
    // isUpdatedByArch is an object containing fields for each arch
    // that this server supports.
    // - Each field will be true when the server updates the runtimeConfig for that arch.
    // - When the hook callback is called the update field in the callback object will be
    // set to isUpdatedByArch[arch].
    // = isUpdatedyByArch[arch] is reset to false after the callback.
    // This enables the caller to cache data efficiently so they do not need to
    // decode & update data on every callback when the runtimeConfig is not changing.
    isUpdatedByArch: {}
  };

  /**
   * @name addRuntimeConfigHookCallback(options)
   * @locus Server
   * @isprototype true
   * @summary Callback for `addRuntimeConfigHook`.
   *
   * If the handler returns a _falsy_ value the hook will not
   * modify the runtime configuration.
   *
   * If the handler returns a _String_ the hook will substitute
   * the string for the encoded configuration string.
   *
   * **Warning:** the hook does not check the return value at all it is
   * the responsibility of the caller to get the formatting correct using
   * the helper functions.
   *
   * `addRuntimeConfigHookCallback` takes only one `Object` argument
   * with the following fields:
   * @param {Object} options
   * @param {String} options.arch The architecture of the client
   * requesting a new runtime configuration. This can be one of
   * `web.browser`, `web.browser.legacy` or `web.cordova`.
   * @param {Object} options.request
   * A NodeJs [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
   * https://nodejs.org/api/http.html#http_class_http_incomingmessage
   * `Object` that can be used to get information about the incoming request.
   * @param {String} options.encodedCurrentConfig The current configuration object
   * encoded as a string for inclusion in the root html.
   * @param {Boolean} options.updated `true` if the config for this architecture
   * has been updated since last called, otherwise `false`. This flag can be used
   * to cache the decoding/encoding for each architecture.
   */

  /**
   * @summary Hook that calls back when the meteor runtime configuration,
   * `__meteor_runtime_config__` is being sent to any client.
   *
   * **returns**: <small>_Object_</small> `{ stop: function, callback: function }`
   * - `stop` <small>_Function_</small> Call `stop()` to stop getting callbacks.
   * - `callback` <small>_Function_</small> The passed in `callback`.
   * @locus Server
   * @param {addRuntimeConfigHookCallback} callback
   * See `addRuntimeConfigHookCallback` description.
   * @returns {Object} {{ stop: function, callback: function }}
   * Call the returned `stop()` to stop getting callbacks.
   * The passed in `callback` is returned also.
   */
  WebApp.addRuntimeConfigHook = function (callback) {
    return runtimeConfig.hooks.register(callback);
  };
  function getBoilerplateAsync(request, arch) {
    let boilerplate = boilerplateByArch[arch];
    runtimeConfig.hooks.forEach(hook => {
      const meteorRuntimeConfig = hook({
        arch,
        request,
        encodedCurrentConfig: boilerplate.baseData.meteorRuntimeConfig,
        updated: runtimeConfig.isUpdatedByArch[arch]
      });
      if (!meteorRuntimeConfig) return true;
      boilerplate.baseData = Object.assign({}, boilerplate.baseData, {
        meteorRuntimeConfig
      });
      return true;
    });
    runtimeConfig.isUpdatedByArch[arch] = false;
    const data = Object.assign({}, boilerplate.baseData, {
      htmlAttributes: getHtmlAttributes(request)
    }, _.pick(request, 'dynamicHead', 'dynamicBody'));
    let madeChanges = false;
    let promise = Promise.resolve();
    Object.keys(boilerplateDataCallbacks).forEach(key => {
      promise = promise.then(() => {
        const callback = boilerplateDataCallbacks[key];
        return callback(request, data, arch);
      }).then(result => {
        // Callbacks should return false if they did not make any changes.
        if (result !== false) {
          madeChanges = true;
        }
      });
    });
    return promise.then(() => ({
      stream: boilerplate.toHTMLStream(data),
      statusCode: data.statusCode,
      headers: data.headers
    }));
  }

  /**
   * @name addUpdatedNotifyHookCallback(options)
   * @summary callback handler for `addupdatedNotifyHook`
   * @isprototype true
   * @locus Server
   * @param {Object} options
   * @param {String} options.arch The architecture that is being updated.
   * This can be one of `web.browser`, `web.browser.legacy` or `web.cordova`.
   * @param {Object} options.manifest The new updated manifest object for
   * this `arch`.
   * @param {Object} options.runtimeConfig The new updated configuration
   * object for this `arch`.
   */

  /**
   * @summary Hook that runs when the meteor runtime configuration
   * is updated.  Typically the configuration only changes during development mode.
   * @locus Server
   * @param {addUpdatedNotifyHookCallback} handler
   * The `handler` is called on every change to an `arch` runtime configuration.
   * See `addUpdatedNotifyHookCallback`.
   * @returns {Object} {{ stop: function, callback: function }}
   */
  WebApp.addUpdatedNotifyHook = function (handler) {
    return runtimeConfig.updateHooks.register(handler);
  };
  WebAppInternals.generateBoilerplateInstance = function (arch, manifest, additionalOptions) {
    additionalOptions = additionalOptions || {};
    runtimeConfig.isUpdatedByArch[arch] = true;
    const rtimeConfig = _objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || {});
    runtimeConfig.updateHooks.forEach(cb => {
      cb({
        arch,
        manifest,
        runtimeConfig: rtimeConfig
      });
      return true;
    });
    const meteorRuntimeConfig = JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
    return new Boilerplate(arch, manifest, Object.assign({
      pathMapper(itemPath) {
        return pathJoin(archPath[arch], itemPath);
      },
      baseDataExtension: {
        additionalStaticJs: _.map(additionalStaticJs || [], function (contents, pathname) {
          return {
            pathname: pathname,
            contents: contents
          };
        }),
        // Convert to a JSON string, then get rid of most weird characters, then
        // wrap in double quotes. (The outermost JSON.stringify really ought to
        // just be "wrap in double quotes" but we use it to be safe.) This might
        // end up inside a <script> tag so we need to be careful to not include
        // "</script>", but normal {{spacebars}} escaping escapes too much! See
        // https://github.com/meteor/meteor/issues/3730
        meteorRuntimeConfig,
        meteorRuntimeHash: sha1(meteorRuntimeConfig),
        rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',
        bundledJsCssUrlRewriteHook: bundledJsCssUrlRewriteHook,
        sriMode: sriMode,
        inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),
        inline: additionalOptions.inline
      }
    }, additionalOptions));
  };

  // A mapping from url path to architecture (e.g. "web.browser") to static
  // file information with the following fields:
  // - type: the type of file to be served
  // - cacheable: optionally, whether the file should be cached or not
  // - sourceMapUrl: optionally, the url of the source map
  //
  // Info also contains one of the following:
  // - content: the stringified content that should be served at this path
  // - absolutePath: the absolute path on disk to the file

  // Serve static files from the manifest or added with
  // `addStaticJs`. Exported for tests.
  WebAppInternals.staticFilesMiddleware = function (staticFilesByArch, req, res, next) {
    return Promise.asyncApply(() => {
      var _Meteor$settings$pack3, _Meteor$settings$pack4;
      var pathname = parseRequest(req).pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch (e) {
        next();
        return;
      }
      var serveStaticJs = function (s) {
        var _Meteor$settings$pack, _Meteor$settings$pack2;
        if (req.method === 'GET' || req.method === 'HEAD' || (_Meteor$settings$pack = Meteor.settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.webapp) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.alwaysReturnContent) {
          res.writeHead(200, {
            'Content-type': 'application/javascript; charset=UTF-8',
            'Content-Length': Buffer.byteLength(s)
          });
          res.write(s);
          res.end();
        } else {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        }
      };
      if (_.has(additionalStaticJs, pathname) && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs(additionalStaticJs[pathname]);
        return;
      }
      const {
        arch,
        path
      } = WebApp.categorizeRequest(req);
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        // We could come here in case we run with some architectures excluded
        next();
        return;
      }

      // If pauseClient(arch) has been called, program.paused will be a
      // Promise that will be resolved when the program is unpaused.
      const program = WebApp.clientPrograms[arch];
      Promise.await(program.paused);
      if (path === '/meteor_runtime_config.js' && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs("__meteor_runtime_config__ = ".concat(program.meteorRuntimeConfig, ";"));
        return;
      }
      const info = getStaticFileInfo(staticFilesByArch, pathname, path, arch);
      if (!info) {
        next();
        return;
      }
      // "send" will handle HEAD & GET requests
      if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack3 = Meteor.settings.packages) !== null && _Meteor$settings$pack3 !== void 0 && (_Meteor$settings$pack4 = _Meteor$settings$pack3.webapp) !== null && _Meteor$settings$pack4 !== void 0 && _Meteor$settings$pack4.alwaysReturnContent)) {
        const status = req.method === 'OPTIONS' ? 200 : 405;
        res.writeHead(status, {
          Allow: 'OPTIONS, GET, HEAD',
          'Content-Length': '0'
        });
        res.end();
        return;
      }

      // We don't need to call pause because, unlike 'static', once we call into
      // 'send' and yield to the event loop, we never call another handler with
      // 'next'.

      // Cacheable files are files that should never change. Typically
      // named by their hash (eg meteor bundled js and css files).
      // We cache them ~forever (1yr).
      const maxAge = info.cacheable ? 1000 * 60 * 60 * 24 * 365 : 0;
      if (info.cacheable) {
        // Since we use req.headers["user-agent"] to determine whether the
        // client should receive modern or legacy resources, tell the client
        // to invalidate cached resources when/if its user agent string
        // changes in the future.
        res.setHeader('Vary', 'User-Agent');
      }

      // Set the X-SourceMap header, which current Chrome, FireFox, and Safari
      // understand.  (The SourceMap header is slightly more spec-correct but FF
      // doesn't understand it.)
      //
      // You may also need to enable source maps in Chrome: open dev tools, click
      // the gear in the bottom right corner, and select "enable source maps".
      if (info.sourceMapUrl) {
        res.setHeader('X-SourceMap', __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + info.sourceMapUrl);
      }
      if (info.type === 'js' || info.type === 'dynamic js') {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (info.type === 'css') {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      } else if (info.type === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      }
      if (info.hash) {
        res.setHeader('ETag', '"' + info.hash + '"');
      }
      if (info.content) {
        res.setHeader('Content-Length', Buffer.byteLength(info.content));
        res.write(info.content);
        res.end();
      } else {
        send(req, info.absolutePath, {
          maxage: maxAge,
          dotfiles: 'allow',
          // if we specified a dotfile in the manifest, serve it
          lastModified: false // don't set last-modified based on the file date
        }).on('error', function (err) {
          Log.error('Error serving static file ' + err);
          res.writeHead(500);
          res.end();
        }).on('directory', function () {
          Log.error('Unexpected directory ' + info.absolutePath);
          res.writeHead(500);
          res.end();
        }).pipe(res);
      }
    });
  };
  function getStaticFileInfo(staticFilesByArch, originalPath, path, arch) {
    if (!hasOwn.call(WebApp.clientPrograms, arch)) {
      return null;
    }

    // Get a list of all available static file architectures, with arch
    // first in the list if it exists.
    const staticArchList = Object.keys(staticFilesByArch);
    const archIndex = staticArchList.indexOf(arch);
    if (archIndex > 0) {
      staticArchList.unshift(staticArchList.splice(archIndex, 1)[0]);
    }
    let info = null;
    staticArchList.some(arch => {
      const staticFiles = staticFilesByArch[arch];
      function finalize(path) {
        info = staticFiles[path];
        // Sometimes we register a lazy function instead of actual data in
        // the staticFiles manifest.
        if (typeof info === 'function') {
          info = staticFiles[path] = info();
        }
        return info;
      }

      // If staticFiles contains originalPath with the arch inferred above,
      // use that information.
      if (hasOwn.call(staticFiles, originalPath)) {
        return finalize(originalPath);
      }

      // If categorizeRequest returned an alternate path, try that instead.
      if (path !== originalPath && hasOwn.call(staticFiles, path)) {
        return finalize(path);
      }
    });
    return info;
  }

  // Parse the passed in port value. Return the port as-is if it's a String
  // (e.g. a Windows Server style named pipe), otherwise return the port as an
  // integer.
  //
  // DEPRECATED: Direct use of this function is not recommended; it is no
  // longer used internally, and will be removed in a future release.
  WebAppInternals.parsePort = port => {
    let parsedPort = parseInt(port);
    if (Number.isNaN(parsedPort)) {
      parsedPort = port;
    }
    return parsedPort;
  };
  onMessage('webapp-pause-client', _ref => Promise.asyncApply(() => {
    let {
      arch
    } = _ref;
    WebAppInternals.pauseClient(arch);
  }));
  onMessage('webapp-reload-client', _ref2 => Promise.asyncApply(() => {
    let {
      arch
    } = _ref2;
    WebAppInternals.generateClientProgram(arch);
  }));
  function runWebAppServer() {
    var shuttingDown = false;
    var syncQueue = new Meteor._SynchronousQueue();
    var getItemPathname = function (itemUrl) {
      return decodeURIComponent(parseUrl(itemUrl).pathname);
    };
    WebAppInternals.reloadClientPrograms = function () {
      syncQueue.runTask(function () {
        const staticFilesByArch = Object.create(null);
        const {
          configJson
        } = __meteor_bootstrap__;
        const clientArchs = configJson.clientArchs || Object.keys(configJson.clientPaths);
        try {
          clientArchs.forEach(arch => {
            generateClientProgram(arch, staticFilesByArch);
          });
          WebAppInternals.staticFilesByArch = staticFilesByArch;
        } catch (e) {
          Log.error('Error reloading the client program: ' + e.stack);
          process.exit(1);
        }
      });
    };

    // Pause any incoming requests and make them wait for the program to be
    // unpaused the next time generateClientProgram(arch) is called.
    WebAppInternals.pauseClient = function (arch) {
      syncQueue.runTask(() => {
        const program = WebApp.clientPrograms[arch];
        const {
          unpause
        } = program;
        program.paused = new Promise(resolve => {
          if (typeof unpause === 'function') {
            // If there happens to be an existing program.unpause function,
            // compose it with the resolve function.
            program.unpause = function () {
              unpause();
              resolve();
            };
          } else {
            program.unpause = resolve;
          }
        });
      });
    };
    WebAppInternals.generateClientProgram = function (arch) {
      syncQueue.runTask(() => generateClientProgram(arch));
    };
    function generateClientProgram(arch) {
      let staticFilesByArch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : WebAppInternals.staticFilesByArch;
      const clientDir = pathJoin(pathDirname(__meteor_bootstrap__.serverDir), arch);

      // read the control for the client we'll be serving up
      const programJsonPath = pathJoin(clientDir, 'program.json');
      let programJson;
      try {
        programJson = JSON.parse(readFileSync(programJsonPath));
      } catch (e) {
        if (e.code === 'ENOENT') return;
        throw e;
      }
      if (programJson.format !== 'web-program-pre1') {
        throw new Error('Unsupported format for client assets: ' + JSON.stringify(programJson.format));
      }
      if (!programJsonPath || !clientDir || !programJson) {
        throw new Error('Client config file not parsed.');
      }
      archPath[arch] = clientDir;
      const staticFiles = staticFilesByArch[arch] = Object.create(null);
      const {
        manifest
      } = programJson;
      manifest.forEach(item => {
        if (item.url && item.where === 'client') {
          staticFiles[getItemPathname(item.url)] = {
            absolutePath: pathJoin(clientDir, item.path),
            cacheable: item.cacheable,
            hash: item.hash,
            // Link from source to its map
            sourceMapUrl: item.sourceMapUrl,
            type: item.type
          };
          if (item.sourceMap) {
            // Serve the source map too, under the specified URL. We assume
            // all source maps are cacheable.
            staticFiles[getItemPathname(item.sourceMapUrl)] = {
              absolutePath: pathJoin(clientDir, item.sourceMap),
              cacheable: true
            };
          }
        }
      });
      const {
        PUBLIC_SETTINGS
      } = __meteor_runtime_config__;
      const configOverrides = {
        PUBLIC_SETTINGS
      };
      const oldProgram = WebApp.clientPrograms[arch];
      const newProgram = WebApp.clientPrograms[arch] = {
        format: 'web-program-pre1',
        manifest: manifest,
        // Use arrow functions so that these versions can be lazily
        // calculated later, and so that they will not be included in the
        // staticFiles[manifestUrl].content string below.
        //
        // Note: these version calculations must be kept in agreement with
        // CordovaBuilder#appendVersion in tools/cordova/builder.js, or hot
        // code push will reload Cordova apps unnecessarily.
        version: () => WebAppHashing.calculateClientHash(manifest, null, configOverrides),
        versionRefreshable: () => WebAppHashing.calculateClientHash(manifest, type => type === 'css', configOverrides),
        versionNonRefreshable: () => WebAppHashing.calculateClientHash(manifest, (type, replaceable) => type !== 'css' && !replaceable, configOverrides),
        versionReplaceable: () => WebAppHashing.calculateClientHash(manifest, (_type, replaceable) => replaceable, configOverrides),
        cordovaCompatibilityVersions: programJson.cordovaCompatibilityVersions,
        PUBLIC_SETTINGS,
        hmrVersion: programJson.hmrVersion
      };

      // Expose program details as a string reachable via the following URL.
      const manifestUrlPrefix = '/__' + arch.replace(/^web\./, '');
      const manifestUrl = manifestUrlPrefix + getItemPathname('/manifest.json');
      staticFiles[manifestUrl] = () => {
        if (Package.autoupdate) {
          const {
            AUTOUPDATE_VERSION = Package.autoupdate.Autoupdate.autoupdateVersion
          } = process.env;
          if (AUTOUPDATE_VERSION) {
            newProgram.version = AUTOUPDATE_VERSION;
          }
        }
        if (typeof newProgram.version === 'function') {
          newProgram.version = newProgram.version();
        }
        return {
          content: JSON.stringify(newProgram),
          cacheable: false,
          hash: newProgram.version,
          type: 'json'
        };
      };
      generateBoilerplateForArch(arch);

      // If there are any requests waiting on oldProgram.paused, let them
      // continue now (using the new program).
      if (oldProgram && oldProgram.paused) {
        oldProgram.unpause();
      }
    }
    const defaultOptionsForArch = {
      'web.cordova': {
        runtimeConfigOverrides: {
          // XXX We use absoluteUrl() here so that we serve https://
          // URLs to cordova clients if force-ssl is in use. If we were
          // to use __meteor_runtime_config__.ROOT_URL instead of
          // absoluteUrl(), then Cordova clients would immediately get a
          // HCP setting their DDP_DEFAULT_CONNECTION_URL to
          // http://example.meteor.com. This breaks the app, because
          // force-ssl doesn't serve CORS headers on 302
          // redirects. (Plus it's undesirable to have clients
          // connecting to http://example.meteor.com when force-ssl is
          // in use.)
          DDP_DEFAULT_CONNECTION_URL: process.env.MOBILE_DDP_URL || Meteor.absoluteUrl(),
          ROOT_URL: process.env.MOBILE_ROOT_URL || Meteor.absoluteUrl()
        }
      },
      'web.browser': {
        runtimeConfigOverrides: {
          isModern: true
        }
      },
      'web.browser.legacy': {
        runtimeConfigOverrides: {
          isModern: false
        }
      }
    };
    WebAppInternals.generateBoilerplate = function () {
      // This boilerplate will be served to the mobile devices when used with
      // Meteor/Cordova for the Hot-Code Push and since the file will be served by
      // the device's server, it is important to set the DDP url to the actual
      // Meteor server accepting DDP connections and not the device's file server.
      syncQueue.runTask(function () {
        Object.keys(WebApp.clientPrograms).forEach(generateBoilerplateForArch);
      });
    };
    function generateBoilerplateForArch(arch) {
      const program = WebApp.clientPrograms[arch];
      const additionalOptions = defaultOptionsForArch[arch] || {};
      const {
        baseData
      } = boilerplateByArch[arch] = WebAppInternals.generateBoilerplateInstance(arch, program.manifest, additionalOptions);
      // We need the runtime config with overrides for meteor_runtime_config.js:
      program.meteorRuntimeConfig = JSON.stringify(_objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || null));
      program.refreshableAssets = baseData.css.map(file => ({
        url: bundledJsCssUrlRewriteHook(file.url)
      }));
    }
    WebAppInternals.reloadClientPrograms();

    // webserver
    var app = connect();

    // Packages and apps can add handlers that run before any other Meteor
    // handlers via WebApp.rawConnectHandlers.
    var rawConnectHandlers = connect();
    app.use(rawConnectHandlers);

    // Auto-compress any json, javascript, or text.
    app.use(compress({
      filter: shouldCompress
    }));

    // parse cookies into an object
    app.use(cookieParser());

    // We're not a proxy; reject (without crashing) attempts to treat us like
    // one. (See #1212.)
    app.use(function (req, res, next) {
      if (RoutePolicy.isValidUrl(req.url)) {
        next();
        return;
      }
      res.writeHead(400);
      res.write('Not a proxy');
      res.end();
    });

    // Parse the query string into res.query. Used by oauth_server, but it's
    // generally pretty handy..
    //
    // Do this before the next middleware destroys req.url if a path prefix
    // is set to close #10111.
    app.use(function (request, response, next) {
      request.query = qs.parse(parseUrl(request.url).query);
      next();
    });
    function getPathParts(path) {
      const parts = path.split('/');
      while (parts[0] === '') parts.shift();
      return parts;
    }
    function isPrefixOf(prefix, array) {
      return prefix.length <= array.length && prefix.every((part, i) => part === array[i]);
    }

    // Strip off the path prefix, if it exists.
    app.use(function (request, response, next) {
      const pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;
      const {
        pathname,
        search
      } = parseUrl(request.url);

      // check if the path in the url starts with the path prefix
      if (pathPrefix) {
        const prefixParts = getPathParts(pathPrefix);
        const pathParts = getPathParts(pathname);
        if (isPrefixOf(prefixParts, pathParts)) {
          request.url = '/' + pathParts.slice(prefixParts.length).join('/');
          if (search) {
            request.url += search;
          }
          return next();
        }
      }
      if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
        return next();
      }
      if (pathPrefix) {
        response.writeHead(404);
        response.write('Unknown path');
        response.end();
        return;
      }
      next();
    });

    // Serve static files from the manifest.
    // This is inspired by the 'static' middleware.
    app.use(function (req, res, next) {
      WebAppInternals.staticFilesMiddleware(WebAppInternals.staticFilesByArch, req, res, next);
    });

    // Core Meteor packages like dynamic-import can add handlers before
    // other handlers added by package and application code.
    app.use(WebAppInternals.meteorInternalHandlers = connect());

    /**
     * @name connectHandlersCallback(req, res, next)
     * @locus Server
     * @isprototype true
     * @summary callback handler for `WebApp.connectHandlers`
     * @param {Object} req
     * a Node.js
     * [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
     * object with some extra properties. This argument can be used
     *  to get information about the incoming request.
     * @param {Object} res
     * a Node.js
     * [ServerResponse](http://nodejs.org/api/http.html#http_class_http_serverresponse)
     * object. Use this to write data that should be sent in response to the
     * request, and call `res.end()` when you are done.
     * @param {Function} next
     * Calling this function will pass on the handling of
     * this request to the next relevant handler.
     *
     */

    /**
     * @method connectHandlers
     * @memberof WebApp
     * @locus Server
     * @summary Register a handler for all HTTP requests.
     * @param {String} [path]
     * This handler will only be called on paths that match
     * this string. The match has to border on a `/` or a `.`.
     *
     * For example, `/hello` will match `/hello/world` and
     * `/hello.world`, but not `/hello_world`.
     * @param {connectHandlersCallback} handler
     * A handler function that will be called on HTTP requests.
     * See `connectHandlersCallback`
     *
     */
    // Packages and apps can add handlers to this via WebApp.connectHandlers.
    // They are inserted before our default handler.
    var packageAndAppHandlers = connect();
    app.use(packageAndAppHandlers);
    var suppressConnectErrors = false;
    // connect knows it is an error handler because it has 4 arguments instead of
    // 3. go figure.  (It is not smart enough to find such a thing if it's hidden
    // inside packageAndAppHandlers.)
    app.use(function (err, req, res, next) {
      if (!err || !suppressConnectErrors || !req.headers['x-suppress-error']) {
        next(err);
        return;
      }
      res.writeHead(err.status, {
        'Content-Type': 'text/plain'
      });
      res.end('An error message');
    });
    app.use(function (req, res, next) {
      return Promise.asyncApply(() => {
        var _Meteor$settings$pack5, _Meteor$settings$pack6;
        if (!appUrl(req.url)) {
          return next();
        } else if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack5 = Meteor.settings.packages) !== null && _Meteor$settings$pack5 !== void 0 && (_Meteor$settings$pack6 = _Meteor$settings$pack5.webapp) !== null && _Meteor$settings$pack6 !== void 0 && _Meteor$settings$pack6.alwaysReturnContent)) {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        } else {
          var headers = {
            'Content-Type': 'text/html; charset=utf-8'
          };
          if (shuttingDown) {
            headers['Connection'] = 'Close';
          }
          var request = WebApp.categorizeRequest(req);
          if (request.url.query && request.url.query['meteor_css_resource']) {
            // In this case, we're requesting a CSS resource in the meteor-specific
            // way, but we don't have it.  Serve a static css file that indicates that
            // we didn't have it, so we can detect that and refresh.  Make sure
            // that any proxies or CDNs don't cache this error!  (Normally proxies
            // or CDNs are smart enough not to cache error pages, but in order to
            // make this hack work, we need to return the CSS file as a 200, which
            // would otherwise be cached.)
            headers['Content-Type'] = 'text/css; charset=utf-8';
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(200, headers);
            res.write('.meteor-css-not-found-error { width: 0px;}');
            res.end();
            return;
          }
          if (request.url.query && request.url.query['meteor_js_resource']) {
            // Similarly, we're requesting a JS resource that we don't have.
            // Serve an uncached 404. (We can't use the same hack we use for CSS,
            // because actually acting on that hack requires us to have the JS
            // already!)
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          if (request.url.query && request.url.query['meteor_dont_serve_index']) {
            // When downloading files during a Cordova hot code push, we need
            // to detect if a file is not available instead of inadvertently
            // downloading the default index page.
            // So similar to the situation above, we serve an uncached 404.
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          const {
            arch
          } = request;
          assert.strictEqual(typeof arch, 'string', {
            arch
          });
          if (!hasOwn.call(WebApp.clientPrograms, arch)) {
            // We could come here in case we run with some architectures excluded
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            if (Meteor.isDevelopment) {
              res.end("No client program found for the ".concat(arch, " architecture."));
            } else {
              // Safety net, but this branch should not be possible.
              res.end('404 Not Found');
            }
            return;
          }

          // If pauseClient(arch) has been called, program.paused will be a
          // Promise that will be resolved when the program is unpaused.
          Promise.await(WebApp.clientPrograms[arch].paused);
          return getBoilerplateAsync(request, arch).then(_ref3 => {
            let {
              stream,
              statusCode,
              headers: newHeaders
            } = _ref3;
            if (!statusCode) {
              statusCode = res.statusCode ? res.statusCode : 200;
            }
            if (newHeaders) {
              Object.assign(headers, newHeaders);
            }
            res.writeHead(statusCode, headers);
            stream.pipe(res, {
              // End the response when the stream ends.
              end: true
            });
          }).catch(error => {
            Log.error('Error running template: ' + error.stack);
            res.writeHead(500, headers);
            res.end();
          });
        }
      });
    });

    // Return 404 by default, if no other handlers serve this URL.
    app.use(function (req, res) {
      res.writeHead(404);
      res.end();
    });
    var httpServer = createServer(app);
    var onListeningCallbacks = [];

    // After 5 seconds w/o data on a socket, kill it.  On the other hand, if
    // there's an outstanding request, give it a higher timeout instead (to avoid
    // killing long-polling requests)
    httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);

    // Do this here, and then also in livedata/stream_server.js, because
    // stream_server.js kills all the current request handlers when installing its
    // own.
    httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);

    // If the client gave us a bad request, tell it instead of just closing the
    // socket. This lets load balancers in front of us differentiate between "a
    // server is randomly closing sockets for no reason" and "client sent a bad
    // request".
    //
    // This will only work on Node 6; Node 4 destroys the socket before calling
    // this event. See https://github.com/nodejs/node/pull/4557/ for details.
    httpServer.on('clientError', (err, socket) => {
      // Pre-Node-6, do nothing.
      if (socket.destroyed) {
        return;
      }
      if (err.message === 'Parse Error') {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      } else {
        // For other errors, use the default behavior as if we had no clientError
        // handler.
        socket.destroy(err);
      }
    });

    // start up app
    _.extend(WebApp, {
      connectHandlers: packageAndAppHandlers,
      rawConnectHandlers: rawConnectHandlers,
      httpServer: httpServer,
      connectApp: app,
      // For testing.
      suppressConnectErrors: function () {
        suppressConnectErrors = true;
      },
      onListening: function (f) {
        if (onListeningCallbacks) onListeningCallbacks.push(f);else f();
      },
      // This can be overridden by users who want to modify how listening works
      // (eg, to run a proxy like Apollo Engine Proxy in front of the server).
      startListening: function (httpServer, listenOptions, cb) {
        httpServer.listen(listenOptions, cb);
      }
    });

    // Let the rest of the packages (and Meteor.startup hooks) insert connect
    // middlewares and update __meteor_runtime_config__, then keep going to set up
    // actually serving HTML.
    exports.main = argv => {
      WebAppInternals.generateBoilerplate();
      const startHttpServer = listenOptions => {
        WebApp.startListening(httpServer, listenOptions, Meteor.bindEnvironment(() => {
          if (process.env.METEOR_PRINT_ON_LISTEN) {
            console.log('LISTENING');
          }
          const callbacks = onListeningCallbacks;
          onListeningCallbacks = null;
          callbacks.forEach(callback => {
            callback();
          });
        }, e => {
          console.error('Error listening:', e);
          console.error(e && e.stack);
        }));
      };
      let localPort = process.env.PORT || 0;
      let unixSocketPath = process.env.UNIX_SOCKET_PATH;
      if (unixSocketPath) {
        if (cluster.isWorker) {
          const workerName = cluster.worker.process.env.name || cluster.worker.id;
          unixSocketPath += '.' + workerName + '.sock';
        }
        // Start the HTTP server using a socket file.
        removeExistingSocketFile(unixSocketPath);
        startHttpServer({
          path: unixSocketPath
        });
        const unixSocketPermissions = (process.env.UNIX_SOCKET_PERMISSIONS || '').trim();
        if (unixSocketPermissions) {
          if (/^[0-7]{3}$/.test(unixSocketPermissions)) {
            chmodSync(unixSocketPath, parseInt(unixSocketPermissions, 8));
          } else {
            throw new Error('Invalid UNIX_SOCKET_PERMISSIONS specified');
          }
        }
        const unixSocketGroup = (process.env.UNIX_SOCKET_GROUP || '').trim();
        if (unixSocketGroup) {
          //whomst automatically handles both group names and numerical gids
          const unixSocketGroupInfo = whomst.sync.group(unixSocketGroup);
          if (unixSocketGroupInfo === null) {
            throw new Error('Invalid UNIX_SOCKET_GROUP name specified');
          }
          chownSync(unixSocketPath, userInfo().uid, unixSocketGroupInfo.gid);
        }
        registerSocketFileCleanup(unixSocketPath);
      } else {
        localPort = isNaN(Number(localPort)) ? localPort : Number(localPort);
        if (/\\\\?.+\\pipe\\?.+/.test(localPort)) {
          // Start the HTTP server using Windows Server style named pipe.
          startHttpServer({
            path: localPort
          });
        } else if (typeof localPort === 'number') {
          // Start the HTTP server using TCP.
          startHttpServer({
            port: localPort,
            host: process.env.BIND_IP || '0.0.0.0'
          });
        } else {
          throw new Error('Invalid PORT specified');
        }
      }
      return 'DAEMON';
    };
  }
  var inlineScriptsAllowed = true;
  WebAppInternals.inlineScriptsAllowed = function () {
    return inlineScriptsAllowed;
  };
  WebAppInternals.setInlineScriptsAllowed = function (value) {
    inlineScriptsAllowed = value;
    WebAppInternals.generateBoilerplate();
  };
  var sriMode;
  WebAppInternals.enableSubresourceIntegrity = function () {
    let use_credentials = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    sriMode = use_credentials ? 'use-credentials' : 'anonymous';
    WebAppInternals.generateBoilerplate();
  };
  WebAppInternals.setBundledJsCssUrlRewriteHook = function (hookFn) {
    bundledJsCssUrlRewriteHook = hookFn;
    WebAppInternals.generateBoilerplate();
  };
  WebAppInternals.setBundledJsCssPrefix = function (prefix) {
    var self = this;
    self.setBundledJsCssUrlRewriteHook(function (url) {
      return prefix + url;
    });
  };

  // Packages can call `WebAppInternals.addStaticJs` to specify static
  // JavaScript to be included in the app. This static JS will be inlined,
  // unless inline scripts have been disabled, in which case it will be
  // served under `/<sha1 of contents>`.
  var additionalStaticJs = {};
  WebAppInternals.addStaticJs = function (contents) {
    additionalStaticJs['/' + sha1(contents) + '.js'] = contents;
  };

  // Exported for tests
  WebAppInternals.getBoilerplate = getBoilerplate;
  WebAppInternals.additionalStaticJs = additionalStaticJs;

  // Start the server!
  runWebAppServer();
}.call(this, module);
////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"connect.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/webapp/connect.js                                                                             //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.export({
  connect: () => connect
});
let npmConnect;
module.link("connect", {
  default(v) {
    npmConnect = v;
  }
}, 0);
function connect() {
  for (var _len = arguments.length, connectArgs = new Array(_len), _key = 0; _key < _len; _key++) {
    connectArgs[_key] = arguments[_key];
  }
  const handlers = npmConnect.apply(this, connectArgs);
  const originalUse = handlers.use;

  // Wrap the handlers.use method so that any provided handler functions
  // always run in a Fiber.
  handlers.use = function use() {
    for (var _len2 = arguments.length, useArgs = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      useArgs[_key2] = arguments[_key2];
    }
    const {
      stack
    } = this;
    const originalLength = stack.length;
    const result = originalUse.apply(this, useArgs);

    // If we just added anything to the stack, wrap each new entry.handle
    // with a function that calls Promise.asyncApply to ensure the
    // original handler runs in a Fiber.
    for (let i = originalLength; i < stack.length; ++i) {
      const entry = stack[i];
      const originalHandle = entry.handle;
      if (originalHandle.length >= 4) {
        // If the original handle had four (or more) parameters, the
        // wrapper must also have four parameters, since connect uses
        // handle.length to determine whether to pass the error as the first
        // argument to the handle function.
        entry.handle = function handle(err, req, res, next) {
          return Promise.asyncApply(originalHandle, this, arguments);
        };
      } else {
        entry.handle = function handle(req, res, next) {
          return Promise.asyncApply(originalHandle, this, arguments);
        };
      }
    }
    return result;
  };
  return handlers;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"socket_file.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// packages/webapp/socket_file.js                                                                         //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.export({
  removeExistingSocketFile: () => removeExistingSocketFile,
  registerSocketFileCleanup: () => registerSocketFileCleanup
});
let statSync, unlinkSync, existsSync;
module.link("fs", {
  statSync(v) {
    statSync = v;
  },
  unlinkSync(v) {
    unlinkSync = v;
  },
  existsSync(v) {
    existsSync = v;
  }
}, 0);
const removeExistingSocketFile = socketPath => {
  try {
    if (statSync(socketPath).isSocket()) {
      // Since a new socket file will be created, remove the existing
      // file.
      unlinkSync(socketPath);
    } else {
      throw new Error("An existing file was found at \"".concat(socketPath, "\" and it is not ") + 'a socket file. Please confirm PORT is pointing to valid and ' + 'un-used socket file path.');
    }
  } catch (error) {
    // If there is no existing socket file to cleanup, great, we'll
    // continue normally. If the caught exception represents any other
    // issue, re-throw.
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};
const registerSocketFileCleanup = function (socketPath) {
  let eventEmitter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : process;
  ['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => {
    eventEmitter.on(signal, Meteor.bindEnvironment(() => {
      if (existsSync(socketPath)) {
        unlinkSync(socketPath);
      }
    }));
  });
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"connect":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/connect/package.json                                           //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "connect",
  "version": "3.7.0"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/connect/index.js                                               //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"compression":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/compression/package.json                                       //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "compression",
  "version": "1.7.4"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/compression/index.js                                           //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"cookie-parser":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/cookie-parser/package.json                                     //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "cookie-parser",
  "version": "1.4.5"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/cookie-parser/index.js                                         //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"qs":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/qs/package.json                                                //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "qs",
  "version": "6.10.1",
  "main": "lib/index.js"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/qs/lib/index.js                                                //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"parseurl":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/parseurl/package.json                                          //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "parseurl",
  "version": "1.3.3"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/parseurl/index.js                                              //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"basic-auth-connect":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/basic-auth-connect/package.json                                //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "basic-auth-connect",
  "version": "1.0.0"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/basic-auth-connect/index.js                                    //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"useragent":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/useragent/package.json                                         //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "useragent",
  "version": "2.3.0",
  "main": "./index.js"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/useragent/index.js                                             //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"send":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/send/package.json                                              //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "send",
  "version": "0.17.1"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/send/index.js                                                  //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"@vlasky":{"whomst":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/@vlasky/whomst/package.json                                    //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.exports = {
  "name": "@vlasky/whomst",
  "version": "0.1.7",
  "main": "index.js"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                        //
// node_modules/meteor/webapp/node_modules/@vlasky/whomst/index.js                                        //
//                                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                          //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/webapp/webapp_server.js");

/* Exports */
Package._define("webapp", exports, {
  WebApp: WebApp,
  WebAppInternals: WebAppInternals,
  main: main
});

})();

//# sourceURL=meteor://💻app/packages/webapp.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvd2ViYXBwL3dlYmFwcF9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3dlYmFwcC9jb25uZWN0LmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy93ZWJhcHAvc29ja2V0X2ZpbGUuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJXZWJBcHAiLCJXZWJBcHBJbnRlcm5hbHMiLCJhc3NlcnQiLCJyZWFkRmlsZVN5bmMiLCJjaG1vZFN5bmMiLCJjaG93blN5bmMiLCJjcmVhdGVTZXJ2ZXIiLCJ1c2VySW5mbyIsInBhdGhKb2luIiwicGF0aERpcm5hbWUiLCJqb2luIiwiZGlybmFtZSIsInBhcnNlVXJsIiwicGFyc2UiLCJjcmVhdGVIYXNoIiwiY29ubmVjdCIsImNvbXByZXNzIiwiY29va2llUGFyc2VyIiwicXMiLCJwYXJzZVJlcXVlc3QiLCJiYXNpY0F1dGgiLCJsb29rdXBVc2VyQWdlbnQiLCJsb29rdXAiLCJpc01vZGVybiIsInNlbmQiLCJyZW1vdmVFeGlzdGluZ1NvY2tldEZpbGUiLCJyZWdpc3RlclNvY2tldEZpbGVDbGVhbnVwIiwiY2x1c3RlciIsIndob21zdCIsIm9uTWVzc2FnZSIsIlNIT1JUX1NPQ0tFVF9USU1FT1VUIiwiTE9OR19TT0NLRVRfVElNRU9VVCIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiTnBtTW9kdWxlcyIsInZlcnNpb24iLCJOcG0iLCJyZXF1aXJlIiwibW9kdWxlIiwiZGVmYXVsdEFyY2giLCJjbGllbnRQcm9ncmFtcyIsImFyY2hQYXRoIiwiYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2siLCJ1cmwiLCJidW5kbGVkUHJlZml4IiwiX19tZXRlb3JfcnVudGltZV9jb25maWdfXyIsIlJPT1RfVVJMX1BBVEhfUFJFRklYIiwic2hhMSIsImNvbnRlbnRzIiwiaGFzaCIsInVwZGF0ZSIsImRpZ2VzdCIsInNob3VsZENvbXByZXNzIiwicmVxIiwicmVzIiwiaGVhZGVycyIsImZpbHRlciIsImNhbWVsQ2FzZSIsIm5hbWUiLCJwYXJ0cyIsInNwbGl0IiwidG9Mb3dlckNhc2UiLCJpIiwibGVuZ3RoIiwiY2hhckF0IiwidG9VcHBlckNhc2UiLCJzdWJzdHIiLCJpZGVudGlmeUJyb3dzZXIiLCJ1c2VyQWdlbnRTdHJpbmciLCJ1c2VyQWdlbnQiLCJmYW1pbHkiLCJtYWpvciIsIm1pbm9yIiwicGF0Y2giLCJjYXRlZ29yaXplUmVxdWVzdCIsImJyb3dzZXIiLCJhcmNoIiwibW9kZXJuIiwicGF0aCIsInBhdGhuYW1lIiwiY2F0ZWdvcml6ZWQiLCJkeW5hbWljSGVhZCIsImR5bmFtaWNCb2R5IiwiY29va2llcyIsInBhdGhQYXJ0cyIsImFyY2hLZXkiLCJzdGFydHNXaXRoIiwiYXJjaENsZWFuZWQiLCJzbGljZSIsImNhbGwiLCJzcGxpY2UiLCJhc3NpZ24iLCJwcmVmZXJyZWRBcmNoT3JkZXIiLCJodG1sQXR0cmlidXRlSG9va3MiLCJnZXRIdG1sQXR0cmlidXRlcyIsInJlcXVlc3QiLCJjb21iaW5lZEF0dHJpYnV0ZXMiLCJfIiwiZWFjaCIsImhvb2siLCJhdHRyaWJ1dGVzIiwiRXJyb3IiLCJleHRlbmQiLCJhZGRIdG1sQXR0cmlidXRlSG9vayIsInB1c2giLCJhcHBVcmwiLCJSb3V0ZVBvbGljeSIsImNsYXNzaWZ5IiwiTWV0ZW9yIiwic3RhcnR1cCIsImdldHRlciIsImtleSIsInByb2dyYW0iLCJ2YWx1ZSIsImNhbGN1bGF0ZUNsaWVudEhhc2giLCJjbGllbnRIYXNoIiwiY2FsY3VsYXRlQ2xpZW50SGFzaFJlZnJlc2hhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaFJlcGxhY2VhYmxlIiwiZ2V0UmVmcmVzaGFibGVBc3NldHMiLCJfdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiZmluaXNoTGlzdGVuZXJzIiwibGlzdGVuZXJzIiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwib24iLCJsIiwiYm9pbGVycGxhdGVCeUFyY2giLCJib2lsZXJwbGF0ZURhdGFDYWxsYmFja3MiLCJjcmVhdGUiLCJyZWdpc3RlckJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrIiwiY2FsbGJhY2siLCJwcmV2aW91c0NhbGxiYWNrIiwic3RyaWN0RXF1YWwiLCJnZXRCb2lsZXJwbGF0ZSIsImdldEJvaWxlcnBsYXRlQXN5bmMiLCJhd2FpdCIsImVuY29kZVJ1bnRpbWVDb25maWciLCJydGltZUNvbmZpZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJlbmNvZGVVUklDb21wb25lbnQiLCJkZWNvZGVSdW50aW1lQ29uZmlnIiwicnRpbWVDb25maWdTdHIiLCJkZWNvZGVVUklDb21wb25lbnQiLCJydW50aW1lQ29uZmlnIiwiaG9va3MiLCJIb29rIiwidXBkYXRlSG9va3MiLCJpc1VwZGF0ZWRCeUFyY2giLCJhZGRSdW50aW1lQ29uZmlnSG9vayIsInJlZ2lzdGVyIiwiYm9pbGVycGxhdGUiLCJmb3JFYWNoIiwibWV0ZW9yUnVudGltZUNvbmZpZyIsImVuY29kZWRDdXJyZW50Q29uZmlnIiwiYmFzZURhdGEiLCJ1cGRhdGVkIiwiZGF0YSIsImh0bWxBdHRyaWJ1dGVzIiwicGljayIsIm1hZGVDaGFuZ2VzIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwia2V5cyIsInRoZW4iLCJyZXN1bHQiLCJzdHJlYW0iLCJ0b0hUTUxTdHJlYW0iLCJzdGF0dXNDb2RlIiwiYWRkVXBkYXRlZE5vdGlmeUhvb2siLCJoYW5kbGVyIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZUluc3RhbmNlIiwibWFuaWZlc3QiLCJhZGRpdGlvbmFsT3B0aW9ucyIsInJ1bnRpbWVDb25maWdPdmVycmlkZXMiLCJjYiIsIkJvaWxlcnBsYXRlIiwicGF0aE1hcHBlciIsIml0ZW1QYXRoIiwiYmFzZURhdGFFeHRlbnNpb24iLCJhZGRpdGlvbmFsU3RhdGljSnMiLCJtYXAiLCJtZXRlb3JSdW50aW1lSGFzaCIsInJvb3RVcmxQYXRoUHJlZml4Iiwic3JpTW9kZSIsImlubGluZVNjcmlwdHNBbGxvd2VkIiwiaW5saW5lIiwic3RhdGljRmlsZXNNaWRkbGV3YXJlIiwic3RhdGljRmlsZXNCeUFyY2giLCJuZXh0IiwiZSIsInNlcnZlU3RhdGljSnMiLCJzIiwibWV0aG9kIiwic2V0dGluZ3MiLCJwYWNrYWdlcyIsIndlYmFwcCIsImFsd2F5c1JldHVybkNvbnRlbnQiLCJ3cml0ZUhlYWQiLCJCdWZmZXIiLCJieXRlTGVuZ3RoIiwid3JpdGUiLCJlbmQiLCJzdGF0dXMiLCJBbGxvdyIsImhhcyIsInBhdXNlZCIsImluZm8iLCJnZXRTdGF0aWNGaWxlSW5mbyIsIm1heEFnZSIsImNhY2hlYWJsZSIsInNldEhlYWRlciIsInNvdXJjZU1hcFVybCIsInR5cGUiLCJjb250ZW50IiwiYWJzb2x1dGVQYXRoIiwibWF4YWdlIiwiZG90ZmlsZXMiLCJsYXN0TW9kaWZpZWQiLCJlcnIiLCJMb2ciLCJlcnJvciIsInBpcGUiLCJvcmlnaW5hbFBhdGgiLCJzdGF0aWNBcmNoTGlzdCIsImFyY2hJbmRleCIsImluZGV4T2YiLCJ1bnNoaWZ0Iiwic29tZSIsInN0YXRpY0ZpbGVzIiwiZmluYWxpemUiLCJwYXJzZVBvcnQiLCJwb3J0IiwicGFyc2VkUG9ydCIsInBhcnNlSW50IiwiTnVtYmVyIiwiaXNOYU4iLCJwYXVzZUNsaWVudCIsImdlbmVyYXRlQ2xpZW50UHJvZ3JhbSIsInJ1bldlYkFwcFNlcnZlciIsInNodXR0aW5nRG93biIsInN5bmNRdWV1ZSIsIl9TeW5jaHJvbm91c1F1ZXVlIiwiZ2V0SXRlbVBhdGhuYW1lIiwiaXRlbVVybCIsInJlbG9hZENsaWVudFByb2dyYW1zIiwicnVuVGFzayIsImNvbmZpZ0pzb24iLCJfX21ldGVvcl9ib290c3RyYXBfXyIsImNsaWVudEFyY2hzIiwiY2xpZW50UGF0aHMiLCJzdGFjayIsInByb2Nlc3MiLCJleGl0IiwidW5wYXVzZSIsImNsaWVudERpciIsInNlcnZlckRpciIsInByb2dyYW1Kc29uUGF0aCIsInByb2dyYW1Kc29uIiwiY29kZSIsImZvcm1hdCIsIml0ZW0iLCJ3aGVyZSIsInNvdXJjZU1hcCIsIlBVQkxJQ19TRVRUSU5HUyIsImNvbmZpZ092ZXJyaWRlcyIsIm9sZFByb2dyYW0iLCJuZXdQcm9ncmFtIiwiV2ViQXBwSGFzaGluZyIsInZlcnNpb25SZWZyZXNoYWJsZSIsInZlcnNpb25Ob25SZWZyZXNoYWJsZSIsInJlcGxhY2VhYmxlIiwidmVyc2lvblJlcGxhY2VhYmxlIiwiX3R5cGUiLCJjb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zIiwiaG1yVmVyc2lvbiIsIm1hbmlmZXN0VXJsUHJlZml4IiwicmVwbGFjZSIsIm1hbmlmZXN0VXJsIiwiUGFja2FnZSIsImF1dG91cGRhdGUiLCJBVVRPVVBEQVRFX1ZFUlNJT04iLCJBdXRvdXBkYXRlIiwiYXV0b3VwZGF0ZVZlcnNpb24iLCJlbnYiLCJnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaCIsImRlZmF1bHRPcHRpb25zRm9yQXJjaCIsIkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIiwiTU9CSUxFX0REUF9VUkwiLCJhYnNvbHV0ZVVybCIsIlJPT1RfVVJMIiwiTU9CSUxFX1JPT1RfVVJMIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZSIsInJlZnJlc2hhYmxlQXNzZXRzIiwiY3NzIiwiZmlsZSIsImFwcCIsInJhd0Nvbm5lY3RIYW5kbGVycyIsInVzZSIsImlzVmFsaWRVcmwiLCJyZXNwb25zZSIsInF1ZXJ5IiwiZ2V0UGF0aFBhcnRzIiwic2hpZnQiLCJpc1ByZWZpeE9mIiwicHJlZml4IiwiYXJyYXkiLCJldmVyeSIsInBhcnQiLCJwYXRoUHJlZml4Iiwic2VhcmNoIiwicHJlZml4UGFydHMiLCJtZXRlb3JJbnRlcm5hbEhhbmRsZXJzIiwicGFja2FnZUFuZEFwcEhhbmRsZXJzIiwic3VwcHJlc3NDb25uZWN0RXJyb3JzIiwiaXNEZXZlbG9wbWVudCIsIm5ld0hlYWRlcnMiLCJjYXRjaCIsImh0dHBTZXJ2ZXIiLCJvbkxpc3RlbmluZ0NhbGxiYWNrcyIsInNvY2tldCIsImRlc3Ryb3llZCIsIm1lc3NhZ2UiLCJkZXN0cm95IiwiY29ubmVjdEhhbmRsZXJzIiwiY29ubmVjdEFwcCIsIm9uTGlzdGVuaW5nIiwiZiIsInN0YXJ0TGlzdGVuaW5nIiwibGlzdGVuT3B0aW9ucyIsImxpc3RlbiIsImV4cG9ydHMiLCJtYWluIiwiYXJndiIsInN0YXJ0SHR0cFNlcnZlciIsImJpbmRFbnZpcm9ubWVudCIsIk1FVEVPUl9QUklOVF9PTl9MSVNURU4iLCJjb25zb2xlIiwibG9nIiwiY2FsbGJhY2tzIiwibG9jYWxQb3J0IiwiUE9SVCIsInVuaXhTb2NrZXRQYXRoIiwiVU5JWF9TT0NLRVRfUEFUSCIsImlzV29ya2VyIiwid29ya2VyTmFtZSIsIndvcmtlciIsImlkIiwidW5peFNvY2tldFBlcm1pc3Npb25zIiwiVU5JWF9TT0NLRVRfUEVSTUlTU0lPTlMiLCJ0cmltIiwidGVzdCIsInVuaXhTb2NrZXRHcm91cCIsIlVOSVhfU09DS0VUX0dST1VQIiwidW5peFNvY2tldEdyb3VwSW5mbyIsInN5bmMiLCJncm91cCIsInVpZCIsImdpZCIsImhvc3QiLCJCSU5EX0lQIiwic2V0SW5saW5lU2NyaXB0c0FsbG93ZWQiLCJlbmFibGVTdWJyZXNvdXJjZUludGVncml0eSIsInVzZV9jcmVkZW50aWFscyIsInNldEJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rIiwiaG9va0ZuIiwic2V0QnVuZGxlZEpzQ3NzUHJlZml4Iiwic2VsZiIsImFkZFN0YXRpY0pzIiwibnBtQ29ubmVjdCIsImNvbm5lY3RBcmdzIiwiaGFuZGxlcnMiLCJhcHBseSIsIm9yaWdpbmFsVXNlIiwidXNlQXJncyIsIm9yaWdpbmFsTGVuZ3RoIiwiZW50cnkiLCJvcmlnaW5hbEhhbmRsZSIsImhhbmRsZSIsImFzeW5jQXBwbHkiLCJhcmd1bWVudHMiLCJzdGF0U3luYyIsInVubGlua1N5bmMiLCJleGlzdHNTeW5jIiwic29ja2V0UGF0aCIsImlzU29ja2V0IiwiZXZlbnRFbWl0dGVyIiwic2lnbmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBQUEsSUFBSUEsYUFBYTtFQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztJQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztNQUFDSixhQUFhLEdBQUNJLENBQUM7SUFBQTtFQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7RUFBdEdILE9BQU8sQ0FBQ0ksTUFBTSxDQUFDO0lBQUNDLE1BQU0sRUFBQyxNQUFJQSxNQUFNO0lBQUNDLGVBQWUsRUFBQyxNQUFJQTtFQUFlLENBQUMsQ0FBQztFQUFDLElBQUlDLE1BQU07RUFBQ1AsT0FBTyxDQUFDQyxJQUFJLENBQUMsUUFBUSxFQUFDO0lBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO01BQUNJLE1BQU0sR0FBQ0osQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztFQUFDLElBQUlLLFlBQVksRUFBQ0MsU0FBUyxFQUFDQyxTQUFTO0VBQUNWLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLElBQUksRUFBQztJQUFDTyxZQUFZLENBQUNMLENBQUMsRUFBQztNQUFDSyxZQUFZLEdBQUNMLENBQUM7SUFBQSxDQUFDO0lBQUNNLFNBQVMsQ0FBQ04sQ0FBQyxFQUFDO01BQUNNLFNBQVMsR0FBQ04sQ0FBQztJQUFBLENBQUM7SUFBQ08sU0FBUyxDQUFDUCxDQUFDLEVBQUM7TUFBQ08sU0FBUyxHQUFDUCxDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSVEsWUFBWTtFQUFDWCxPQUFPLENBQUNDLElBQUksQ0FBQyxNQUFNLEVBQUM7SUFBQ1UsWUFBWSxDQUFDUixDQUFDLEVBQUM7TUFBQ1EsWUFBWSxHQUFDUixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSVMsUUFBUTtFQUFDWixPQUFPLENBQUNDLElBQUksQ0FBQyxJQUFJLEVBQUM7SUFBQ1csUUFBUSxDQUFDVCxDQUFDLEVBQUM7TUFBQ1MsUUFBUSxHQUFDVCxDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSVUsUUFBUSxFQUFDQyxXQUFXO0VBQUNkLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLE1BQU0sRUFBQztJQUFDYyxJQUFJLENBQUNaLENBQUMsRUFBQztNQUFDVSxRQUFRLEdBQUNWLENBQUM7SUFBQSxDQUFDO0lBQUNhLE9BQU8sQ0FBQ2IsQ0FBQyxFQUFDO01BQUNXLFdBQVcsR0FBQ1gsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztFQUFDLElBQUljLFFBQVE7RUFBQ2pCLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLEtBQUssRUFBQztJQUFDaUIsS0FBSyxDQUFDZixDQUFDLEVBQUM7TUFBQ2MsUUFBUSxHQUFDZCxDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSWdCLFVBQVU7RUFBQ25CLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLFFBQVEsRUFBQztJQUFDa0IsVUFBVSxDQUFDaEIsQ0FBQyxFQUFDO01BQUNnQixVQUFVLEdBQUNoQixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSWlCLE9BQU87RUFBQ3BCLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLGNBQWMsRUFBQztJQUFDbUIsT0FBTyxDQUFDakIsQ0FBQyxFQUFDO01BQUNpQixPQUFPLEdBQUNqQixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSWtCLFFBQVE7RUFBQ3JCLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLGFBQWEsRUFBQztJQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztNQUFDa0IsUUFBUSxHQUFDbEIsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztFQUFDLElBQUltQixZQUFZO0VBQUN0QixPQUFPLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7SUFBQ0MsT0FBTyxDQUFDQyxDQUFDLEVBQUM7TUFBQ21CLFlBQVksR0FBQ25CLENBQUM7SUFBQTtFQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7RUFBQyxJQUFJb0IsRUFBRTtFQUFDdkIsT0FBTyxDQUFDQyxJQUFJLENBQUMsSUFBSSxFQUFDO0lBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO01BQUNvQixFQUFFLEdBQUNwQixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsRUFBRSxDQUFDO0VBQUMsSUFBSXFCLFlBQVk7RUFBQ3hCLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLFVBQVUsRUFBQztJQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztNQUFDcUIsWUFBWSxHQUFDckIsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQztFQUFDLElBQUlzQixTQUFTO0VBQUN6QixPQUFPLENBQUNDLElBQUksQ0FBQyxvQkFBb0IsRUFBQztJQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztNQUFDc0IsU0FBUyxHQUFDdEIsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQztFQUFDLElBQUl1QixlQUFlO0VBQUMxQixPQUFPLENBQUNDLElBQUksQ0FBQyxXQUFXLEVBQUM7SUFBQzBCLE1BQU0sQ0FBQ3hCLENBQUMsRUFBQztNQUFDdUIsZUFBZSxHQUFDdkIsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQztFQUFDLElBQUl5QixRQUFRO0VBQUM1QixPQUFPLENBQUNDLElBQUksQ0FBQyx3QkFBd0IsRUFBQztJQUFDMkIsUUFBUSxDQUFDekIsQ0FBQyxFQUFDO01BQUN5QixRQUFRLEdBQUN6QixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsRUFBRSxDQUFDO0VBQUMsSUFBSTBCLElBQUk7RUFBQzdCLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLE1BQU0sRUFBQztJQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztNQUFDMEIsSUFBSSxHQUFDMUIsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQztFQUFDLElBQUkyQix3QkFBd0IsRUFBQ0MseUJBQXlCO0VBQUMvQixPQUFPLENBQUNDLElBQUksQ0FBQyxrQkFBa0IsRUFBQztJQUFDNkIsd0JBQXdCLENBQUMzQixDQUFDLEVBQUM7TUFBQzJCLHdCQUF3QixHQUFDM0IsQ0FBQztJQUFBLENBQUM7SUFBQzRCLHlCQUF5QixDQUFDNUIsQ0FBQyxFQUFDO01BQUM0Qix5QkFBeUIsR0FBQzVCLENBQUM7SUFBQTtFQUFDLENBQUMsRUFBQyxFQUFFLENBQUM7RUFBQyxJQUFJNkIsT0FBTztFQUFDaEMsT0FBTyxDQUFDQyxJQUFJLENBQUMsU0FBUyxFQUFDO0lBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO01BQUM2QixPQUFPLEdBQUM3QixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsRUFBRSxDQUFDO0VBQUMsSUFBSThCLE1BQU07RUFBQ2pDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLGdCQUFnQixFQUFDO0lBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO01BQUM4QixNQUFNLEdBQUM5QixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsRUFBRSxDQUFDO0VBQUMsSUFBSStCLFNBQVM7RUFBQ2xDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLGdDQUFnQyxFQUFDO0lBQUNpQyxTQUFTLENBQUMvQixDQUFDLEVBQUM7TUFBQytCLFNBQVMsR0FBQy9CLENBQUM7SUFBQTtFQUFDLENBQUMsRUFBQyxFQUFFLENBQUM7RUF1QjFwRCxJQUFJZ0Msb0JBQW9CLEdBQUcsQ0FBQyxHQUFHLElBQUk7RUFDbkMsSUFBSUMsbUJBQW1CLEdBQUcsR0FBRyxHQUFHLElBQUk7RUFFN0IsTUFBTS9CLE1BQU0sR0FBRyxDQUFDLENBQUM7RUFDakIsTUFBTUMsZUFBZSxHQUFHLENBQUMsQ0FBQztFQUVqQyxNQUFNK0IsTUFBTSxHQUFHQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYzs7RUFFOUM7RUFDQXBCLE9BQU8sQ0FBQ0ssU0FBUyxHQUFHQSxTQUFTO0VBRTdCbkIsZUFBZSxDQUFDbUMsVUFBVSxHQUFHO0lBQzNCckIsT0FBTyxFQUFFO01BQ1BzQixPQUFPLEVBQUVDLEdBQUcsQ0FBQ0MsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUNGLE9BQU87TUFDcERHLE1BQU0sRUFBRXpCO0lBQ1Y7RUFDRixDQUFDOztFQUVEO0VBQ0E7RUFDQWYsTUFBTSxDQUFDeUMsV0FBVyxHQUFHLG9CQUFvQjs7RUFFekM7RUFDQXpDLE1BQU0sQ0FBQzBDLGNBQWMsR0FBRyxDQUFDLENBQUM7O0VBRTFCO0VBQ0EsSUFBSUMsUUFBUSxHQUFHLENBQUMsQ0FBQztFQUVqQixJQUFJQywwQkFBMEIsR0FBRyxVQUFTQyxHQUFHLEVBQUU7SUFDN0MsSUFBSUMsYUFBYSxHQUFHQyx5QkFBeUIsQ0FBQ0Msb0JBQW9CLElBQUksRUFBRTtJQUN4RSxPQUFPRixhQUFhLEdBQUdELEdBQUc7RUFDNUIsQ0FBQztFQUVELElBQUlJLElBQUksR0FBRyxVQUFTQyxRQUFRLEVBQUU7SUFDNUIsSUFBSUMsSUFBSSxHQUFHckMsVUFBVSxDQUFDLE1BQU0sQ0FBQztJQUM3QnFDLElBQUksQ0FBQ0MsTUFBTSxDQUFDRixRQUFRLENBQUM7SUFDckIsT0FBT0MsSUFBSSxDQUFDRSxNQUFNLENBQUMsS0FBSyxDQUFDO0VBQzNCLENBQUM7RUFFRCxTQUFTQyxjQUFjLENBQUNDLEdBQUcsRUFBRUMsR0FBRyxFQUFFO0lBQ2hDLElBQUlELEdBQUcsQ0FBQ0UsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7TUFDbkM7TUFDQSxPQUFPLEtBQUs7SUFDZDs7SUFFQTtJQUNBLE9BQU96QyxRQUFRLENBQUMwQyxNQUFNLENBQUNILEdBQUcsRUFBRUMsR0FBRyxDQUFDO0VBQ2xDOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBLElBQUlHLFNBQVMsR0FBRyxVQUFTQyxJQUFJLEVBQUU7SUFDN0IsSUFBSUMsS0FBSyxHQUFHRCxJQUFJLENBQUNFLEtBQUssQ0FBQyxHQUFHLENBQUM7SUFDM0JELEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBR0EsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDRSxXQUFXLEVBQUU7SUFDakMsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdILEtBQUssQ0FBQ0ksTUFBTSxFQUFFLEVBQUVELENBQUMsRUFBRTtNQUNyQ0gsS0FBSyxDQUFDRyxDQUFDLENBQUMsR0FBR0gsS0FBSyxDQUFDRyxDQUFDLENBQUMsQ0FBQ0UsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDQyxXQUFXLEVBQUUsR0FBR04sS0FBSyxDQUFDRyxDQUFDLENBQUMsQ0FBQ0ksTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNsRTtJQUNBLE9BQU9QLEtBQUssQ0FBQ25ELElBQUksQ0FBQyxFQUFFLENBQUM7RUFDdkIsQ0FBQztFQUVELElBQUkyRCxlQUFlLEdBQUcsVUFBU0MsZUFBZSxFQUFFO0lBQzlDLElBQUlDLFNBQVMsR0FBR2xELGVBQWUsQ0FBQ2lELGVBQWUsQ0FBQztJQUNoRCxPQUFPO01BQ0xWLElBQUksRUFBRUQsU0FBUyxDQUFDWSxTQUFTLENBQUNDLE1BQU0sQ0FBQztNQUNqQ0MsS0FBSyxFQUFFLENBQUNGLFNBQVMsQ0FBQ0UsS0FBSztNQUN2QkMsS0FBSyxFQUFFLENBQUNILFNBQVMsQ0FBQ0csS0FBSztNQUN2QkMsS0FBSyxFQUFFLENBQUNKLFNBQVMsQ0FBQ0k7SUFDcEIsQ0FBQztFQUNILENBQUM7O0VBRUQ7RUFDQTFFLGVBQWUsQ0FBQ29FLGVBQWUsR0FBR0EsZUFBZTtFQUVqRHJFLE1BQU0sQ0FBQzRFLGlCQUFpQixHQUFHLFVBQVNyQixHQUFHLEVBQUU7SUFDdkMsSUFBSUEsR0FBRyxDQUFDc0IsT0FBTyxJQUFJdEIsR0FBRyxDQUFDdUIsSUFBSSxJQUFJLE9BQU92QixHQUFHLENBQUN3QixNQUFNLEtBQUssU0FBUyxFQUFFO01BQzlEO01BQ0EsT0FBT3hCLEdBQUc7SUFDWjtJQUVBLE1BQU1zQixPQUFPLEdBQUdSLGVBQWUsQ0FBQ2QsR0FBRyxDQUFDRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDMUQsTUFBTXNCLE1BQU0sR0FBR3hELFFBQVEsQ0FBQ3NELE9BQU8sQ0FBQztJQUNoQyxNQUFNRyxJQUFJLEdBQ1IsT0FBT3pCLEdBQUcsQ0FBQzBCLFFBQVEsS0FBSyxRQUFRLEdBQzVCMUIsR0FBRyxDQUFDMEIsUUFBUSxHQUNaOUQsWUFBWSxDQUFDb0MsR0FBRyxDQUFDLENBQUMwQixRQUFRO0lBRWhDLE1BQU1DLFdBQVcsR0FBRztNQUNsQkwsT0FBTztNQUNQRSxNQUFNO01BQ05DLElBQUk7TUFDSkYsSUFBSSxFQUFFOUUsTUFBTSxDQUFDeUMsV0FBVztNQUN4QkksR0FBRyxFQUFFakMsUUFBUSxDQUFDMkMsR0FBRyxDQUFDVixHQUFHLEVBQUUsSUFBSSxDQUFDO01BQzVCc0MsV0FBVyxFQUFFNUIsR0FBRyxDQUFDNEIsV0FBVztNQUM1QkMsV0FBVyxFQUFFN0IsR0FBRyxDQUFDNkIsV0FBVztNQUM1QjNCLE9BQU8sRUFBRUYsR0FBRyxDQUFDRSxPQUFPO01BQ3BCNEIsT0FBTyxFQUFFOUIsR0FBRyxDQUFDOEI7SUFDZixDQUFDO0lBRUQsTUFBTUMsU0FBUyxHQUFHTixJQUFJLENBQUNsQixLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ2pDLE1BQU15QixPQUFPLEdBQUdELFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFFNUIsSUFBSUMsT0FBTyxDQUFDQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7TUFDNUIsTUFBTUMsV0FBVyxHQUFHLE1BQU0sR0FBR0YsT0FBTyxDQUFDRyxLQUFLLENBQUMsQ0FBQyxDQUFDO01BQzdDLElBQUkxRCxNQUFNLENBQUMyRCxJQUFJLENBQUMzRixNQUFNLENBQUMwQyxjQUFjLEVBQUUrQyxXQUFXLENBQUMsRUFBRTtRQUNuREgsU0FBUyxDQUFDTSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEIsT0FBTzNELE1BQU0sQ0FBQzRELE1BQU0sQ0FBQ1gsV0FBVyxFQUFFO1VBQ2hDSixJQUFJLEVBQUVXLFdBQVc7VUFDakJULElBQUksRUFBRU0sU0FBUyxDQUFDNUUsSUFBSSxDQUFDLEdBQUc7UUFDMUIsQ0FBQyxDQUFDO01BQ0o7SUFDRjs7SUFFQTtJQUNBO0lBQ0EsTUFBTW9GLGtCQUFrQixHQUFHdkUsUUFBUSxDQUFDc0QsT0FBTyxDQUFDLEdBQ3hDLENBQUMsYUFBYSxFQUFFLG9CQUFvQixDQUFDLEdBQ3JDLENBQUMsb0JBQW9CLEVBQUUsYUFBYSxDQUFDO0lBRXpDLEtBQUssTUFBTUMsSUFBSSxJQUFJZ0Isa0JBQWtCLEVBQUU7TUFDckM7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQSxJQUFJOUQsTUFBTSxDQUFDMkQsSUFBSSxDQUFDM0YsTUFBTSxDQUFDMEMsY0FBYyxFQUFFb0MsSUFBSSxDQUFDLEVBQUU7UUFDNUMsT0FBTzdDLE1BQU0sQ0FBQzRELE1BQU0sQ0FBQ1gsV0FBVyxFQUFFO1VBQUVKO1FBQUssQ0FBQyxDQUFDO01BQzdDO0lBQ0Y7SUFFQSxPQUFPSSxXQUFXO0VBQ3BCLENBQUM7O0VBRUQ7RUFDQTtFQUNBO0VBQ0EsSUFBSWEsa0JBQWtCLEdBQUcsRUFBRTtFQUMzQixJQUFJQyxpQkFBaUIsR0FBRyxVQUFTQyxPQUFPLEVBQUU7SUFDeEMsSUFBSUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0lBQzNCQyxDQUFDLENBQUNDLElBQUksQ0FBQ0wsa0JBQWtCLElBQUksRUFBRSxFQUFFLFVBQVNNLElBQUksRUFBRTtNQUM5QyxJQUFJQyxVQUFVLEdBQUdELElBQUksQ0FBQ0osT0FBTyxDQUFDO01BQzlCLElBQUlLLFVBQVUsS0FBSyxJQUFJLEVBQUU7TUFDekIsSUFBSSxPQUFPQSxVQUFVLEtBQUssUUFBUSxFQUNoQyxNQUFNQyxLQUFLLENBQUMsZ0RBQWdELENBQUM7TUFDL0RKLENBQUMsQ0FBQ0ssTUFBTSxDQUFDTixrQkFBa0IsRUFBRUksVUFBVSxDQUFDO0lBQzFDLENBQUMsQ0FBQztJQUNGLE9BQU9KLGtCQUFrQjtFQUMzQixDQUFDO0VBQ0RsRyxNQUFNLENBQUN5RyxvQkFBb0IsR0FBRyxVQUFTSixJQUFJLEVBQUU7SUFDM0NOLGtCQUFrQixDQUFDVyxJQUFJLENBQUNMLElBQUksQ0FBQztFQUMvQixDQUFDOztFQUVEO0VBQ0EsSUFBSU0sTUFBTSxHQUFHLFVBQVM5RCxHQUFHLEVBQUU7SUFDekIsSUFBSUEsR0FBRyxLQUFLLGNBQWMsSUFBSUEsR0FBRyxLQUFLLGFBQWEsRUFBRSxPQUFPLEtBQUs7O0lBRWpFO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUlBLEdBQUcsS0FBSyxlQUFlLEVBQUUsT0FBTyxLQUFLOztJQUV6QztJQUNBLElBQUkrRCxXQUFXLENBQUNDLFFBQVEsQ0FBQ2hFLEdBQUcsQ0FBQyxFQUFFLE9BQU8sS0FBSzs7SUFFM0M7SUFDQSxPQUFPLElBQUk7RUFDYixDQUFDOztFQUVEO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBaUUsTUFBTSxDQUFDQyxPQUFPLENBQUMsWUFBVztJQUN4QixTQUFTQyxNQUFNLENBQUNDLEdBQUcsRUFBRTtNQUNuQixPQUFPLFVBQVNuQyxJQUFJLEVBQUU7UUFDcEJBLElBQUksR0FBR0EsSUFBSSxJQUFJOUUsTUFBTSxDQUFDeUMsV0FBVztRQUNqQyxNQUFNeUUsT0FBTyxHQUFHbEgsTUFBTSxDQUFDMEMsY0FBYyxDQUFDb0MsSUFBSSxDQUFDO1FBQzNDLE1BQU1xQyxLQUFLLEdBQUdELE9BQU8sSUFBSUEsT0FBTyxDQUFDRCxHQUFHLENBQUM7UUFDckM7UUFDQTtRQUNBO1FBQ0EsT0FBTyxPQUFPRSxLQUFLLEtBQUssVUFBVSxHQUFJRCxPQUFPLENBQUNELEdBQUcsQ0FBQyxHQUFHRSxLQUFLLEVBQUUsR0FBSUEsS0FBSztNQUN2RSxDQUFDO0lBQ0g7SUFFQW5ILE1BQU0sQ0FBQ29ILG1CQUFtQixHQUFHcEgsTUFBTSxDQUFDcUgsVUFBVSxHQUFHTCxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ2xFaEgsTUFBTSxDQUFDc0gsOEJBQThCLEdBQUdOLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQztJQUNwRWhILE1BQU0sQ0FBQ3VILGlDQUFpQyxHQUFHUCxNQUFNLENBQUMsdUJBQXVCLENBQUM7SUFDMUVoSCxNQUFNLENBQUN3SCw4QkFBOEIsR0FBR1IsTUFBTSxDQUFDLG9CQUFvQixDQUFDO0lBQ3BFaEgsTUFBTSxDQUFDeUgsb0JBQW9CLEdBQUdULE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQztFQUMzRCxDQUFDLENBQUM7O0VBRUY7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBaEgsTUFBTSxDQUFDMEgsaUNBQWlDLEdBQUcsVUFBU25FLEdBQUcsRUFBRUMsR0FBRyxFQUFFO0lBQzVEO0lBQ0FELEdBQUcsQ0FBQ29FLFVBQVUsQ0FBQzVGLG1CQUFtQixDQUFDO0lBQ25DO0lBQ0E7SUFDQSxJQUFJNkYsZUFBZSxHQUFHcEUsR0FBRyxDQUFDcUUsU0FBUyxDQUFDLFFBQVEsQ0FBQztJQUM3QztJQUNBO0lBQ0E7SUFDQTtJQUNBckUsR0FBRyxDQUFDc0Usa0JBQWtCLENBQUMsUUFBUSxDQUFDO0lBQ2hDdEUsR0FBRyxDQUFDdUUsRUFBRSxDQUFDLFFBQVEsRUFBRSxZQUFXO01BQzFCdkUsR0FBRyxDQUFDbUUsVUFBVSxDQUFDN0Ysb0JBQW9CLENBQUM7SUFDdEMsQ0FBQyxDQUFDO0lBQ0ZxRSxDQUFDLENBQUNDLElBQUksQ0FBQ3dCLGVBQWUsRUFBRSxVQUFTSSxDQUFDLEVBQUU7TUFDbEN4RSxHQUFHLENBQUN1RSxFQUFFLENBQUMsUUFBUSxFQUFFQyxDQUFDLENBQUM7SUFDckIsQ0FBQyxDQUFDO0VBQ0osQ0FBQzs7RUFFRDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSUMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDOztFQUUxQjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLE1BQU1DLHdCQUF3QixHQUFHakcsTUFBTSxDQUFDa0csTUFBTSxDQUFDLElBQUksQ0FBQztFQUNwRGxJLGVBQWUsQ0FBQ21JLCtCQUErQixHQUFHLFVBQVNuQixHQUFHLEVBQUVvQixRQUFRLEVBQUU7SUFDeEUsTUFBTUMsZ0JBQWdCLEdBQUdKLHdCQUF3QixDQUFDakIsR0FBRyxDQUFDO0lBRXRELElBQUksT0FBT29CLFFBQVEsS0FBSyxVQUFVLEVBQUU7TUFDbENILHdCQUF3QixDQUFDakIsR0FBRyxDQUFDLEdBQUdvQixRQUFRO0lBQzFDLENBQUMsTUFBTTtNQUNMbkksTUFBTSxDQUFDcUksV0FBVyxDQUFDRixRQUFRLEVBQUUsSUFBSSxDQUFDO01BQ2xDLE9BQU9ILHdCQUF3QixDQUFDakIsR0FBRyxDQUFDO0lBQ3RDOztJQUVBO0lBQ0E7SUFDQSxPQUFPcUIsZ0JBQWdCLElBQUksSUFBSTtFQUNqQyxDQUFDOztFQUVEO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxTQUFTRSxjQUFjLENBQUN2QyxPQUFPLEVBQUVuQixJQUFJLEVBQUU7SUFDckMsT0FBTzJELG1CQUFtQixDQUFDeEMsT0FBTyxFQUFFbkIsSUFBSSxDQUFDLENBQUM0RCxLQUFLLEVBQUU7RUFDbkQ7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQTFJLE1BQU0sQ0FBQzJJLG1CQUFtQixHQUFHLFVBQVNDLFdBQVcsRUFBRTtJQUNqRCxPQUFPQyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0Msa0JBQWtCLENBQUNGLElBQUksQ0FBQ0MsU0FBUyxDQUFDRixXQUFXLENBQUMsQ0FBQyxDQUFDO0VBQ3hFLENBQUM7O0VBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQTVJLE1BQU0sQ0FBQ2dKLG1CQUFtQixHQUFHLFVBQVNDLGNBQWMsRUFBRTtJQUNwRCxPQUFPSixJQUFJLENBQUNoSSxLQUFLLENBQUNxSSxrQkFBa0IsQ0FBQ0wsSUFBSSxDQUFDaEksS0FBSyxDQUFDb0ksY0FBYyxDQUFDLENBQUMsQ0FBQztFQUNuRSxDQUFDO0VBRUQsTUFBTUUsYUFBYSxHQUFHO0lBQ3BCO0lBQ0E7SUFDQUMsS0FBSyxFQUFFLElBQUlDLElBQUksRUFBRTtJQUNqQjtJQUNBO0lBQ0FDLFdBQVcsRUFBRSxJQUFJRCxJQUFJLEVBQUU7SUFDdkI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBRSxlQUFlLEVBQUUsQ0FBQztFQUNwQixDQUFDOztFQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBdkosTUFBTSxDQUFDd0osb0JBQW9CLEdBQUcsVUFBU25CLFFBQVEsRUFBRTtJQUMvQyxPQUFPYyxhQUFhLENBQUNDLEtBQUssQ0FBQ0ssUUFBUSxDQUFDcEIsUUFBUSxDQUFDO0VBQy9DLENBQUM7RUFFRCxTQUFTSSxtQkFBbUIsQ0FBQ3hDLE9BQU8sRUFBRW5CLElBQUksRUFBRTtJQUMxQyxJQUFJNEUsV0FBVyxHQUFHekIsaUJBQWlCLENBQUNuRCxJQUFJLENBQUM7SUFDekNxRSxhQUFhLENBQUNDLEtBQUssQ0FBQ08sT0FBTyxDQUFDdEQsSUFBSSxJQUFJO01BQ2xDLE1BQU11RCxtQkFBbUIsR0FBR3ZELElBQUksQ0FBQztRQUMvQnZCLElBQUk7UUFDSm1CLE9BQU87UUFDUDRELG9CQUFvQixFQUFFSCxXQUFXLENBQUNJLFFBQVEsQ0FBQ0YsbUJBQW1CO1FBQzlERyxPQUFPLEVBQUVaLGFBQWEsQ0FBQ0ksZUFBZSxDQUFDekUsSUFBSTtNQUM3QyxDQUFDLENBQUM7TUFDRixJQUFJLENBQUM4RSxtQkFBbUIsRUFBRSxPQUFPLElBQUk7TUFDckNGLFdBQVcsQ0FBQ0ksUUFBUSxHQUFHN0gsTUFBTSxDQUFDNEQsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFNkQsV0FBVyxDQUFDSSxRQUFRLEVBQUU7UUFDN0RGO01BQ0YsQ0FBQyxDQUFDO01BQ0YsT0FBTyxJQUFJO0lBQ2IsQ0FBQyxDQUFDO0lBQ0ZULGFBQWEsQ0FBQ0ksZUFBZSxDQUFDekUsSUFBSSxDQUFDLEdBQUcsS0FBSztJQUMzQyxNQUFNa0YsSUFBSSxHQUFHL0gsTUFBTSxDQUFDNEQsTUFBTSxDQUN4QixDQUFDLENBQUMsRUFDRjZELFdBQVcsQ0FBQ0ksUUFBUSxFQUNwQjtNQUNFRyxjQUFjLEVBQUVqRSxpQkFBaUIsQ0FBQ0MsT0FBTztJQUMzQyxDQUFDLEVBQ0RFLENBQUMsQ0FBQytELElBQUksQ0FBQ2pFLE9BQU8sRUFBRSxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQzlDO0lBRUQsSUFBSWtFLFdBQVcsR0FBRyxLQUFLO0lBQ3ZCLElBQUlDLE9BQU8sR0FBR0MsT0FBTyxDQUFDQyxPQUFPLEVBQUU7SUFFL0JySSxNQUFNLENBQUNzSSxJQUFJLENBQUNyQyx3QkFBd0IsQ0FBQyxDQUFDeUIsT0FBTyxDQUFDMUMsR0FBRyxJQUFJO01BQ25EbUQsT0FBTyxHQUFHQSxPQUFPLENBQ2RJLElBQUksQ0FBQyxNQUFNO1FBQ1YsTUFBTW5DLFFBQVEsR0FBR0gsd0JBQXdCLENBQUNqQixHQUFHLENBQUM7UUFDOUMsT0FBT29CLFFBQVEsQ0FBQ3BDLE9BQU8sRUFBRStELElBQUksRUFBRWxGLElBQUksQ0FBQztNQUN0QyxDQUFDLENBQUMsQ0FDRDBGLElBQUksQ0FBQ0MsTUFBTSxJQUFJO1FBQ2Q7UUFDQSxJQUFJQSxNQUFNLEtBQUssS0FBSyxFQUFFO1VBQ3BCTixXQUFXLEdBQUcsSUFBSTtRQUNwQjtNQUNGLENBQUMsQ0FBQztJQUNOLENBQUMsQ0FBQztJQUVGLE9BQU9DLE9BQU8sQ0FBQ0ksSUFBSSxDQUFDLE9BQU87TUFDekJFLE1BQU0sRUFBRWhCLFdBQVcsQ0FBQ2lCLFlBQVksQ0FBQ1gsSUFBSSxDQUFDO01BQ3RDWSxVQUFVLEVBQUVaLElBQUksQ0FBQ1ksVUFBVTtNQUMzQm5ILE9BQU8sRUFBRXVHLElBQUksQ0FBQ3ZHO0lBQ2hCLENBQUMsQ0FBQyxDQUFDO0VBQ0w7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0F6RCxNQUFNLENBQUM2SyxvQkFBb0IsR0FBRyxVQUFTQyxPQUFPLEVBQUU7SUFDOUMsT0FBTzNCLGFBQWEsQ0FBQ0csV0FBVyxDQUFDRyxRQUFRLENBQUNxQixPQUFPLENBQUM7RUFDcEQsQ0FBQztFQUVEN0ssZUFBZSxDQUFDOEssMkJBQTJCLEdBQUcsVUFDNUNqRyxJQUFJLEVBQ0prRyxRQUFRLEVBQ1JDLGlCQUFpQixFQUNqQjtJQUNBQSxpQkFBaUIsR0FBR0EsaUJBQWlCLElBQUksQ0FBQyxDQUFDO0lBRTNDOUIsYUFBYSxDQUFDSSxlQUFlLENBQUN6RSxJQUFJLENBQUMsR0FBRyxJQUFJO0lBQzFDLE1BQU04RCxXQUFXLG1DQUNaN0YseUJBQXlCLEdBQ3hCa0ksaUJBQWlCLENBQUNDLHNCQUFzQixJQUFJLENBQUMsQ0FBQyxDQUNuRDtJQUNEL0IsYUFBYSxDQUFDRyxXQUFXLENBQUNLLE9BQU8sQ0FBQ3dCLEVBQUUsSUFBSTtNQUN0Q0EsRUFBRSxDQUFDO1FBQUVyRyxJQUFJO1FBQUVrRyxRQUFRO1FBQUU3QixhQUFhLEVBQUVQO01BQVksQ0FBQyxDQUFDO01BQ2xELE9BQU8sSUFBSTtJQUNiLENBQUMsQ0FBQztJQUVGLE1BQU1nQixtQkFBbUIsR0FBR2YsSUFBSSxDQUFDQyxTQUFTLENBQ3hDQyxrQkFBa0IsQ0FBQ0YsSUFBSSxDQUFDQyxTQUFTLENBQUNGLFdBQVcsQ0FBQyxDQUFDLENBQ2hEO0lBRUQsT0FBTyxJQUFJd0MsV0FBVyxDQUNwQnRHLElBQUksRUFDSmtHLFFBQVEsRUFDUi9JLE1BQU0sQ0FBQzRELE1BQU0sQ0FDWDtNQUNFd0YsVUFBVSxDQUFDQyxRQUFRLEVBQUU7UUFDbkIsT0FBTzlLLFFBQVEsQ0FBQ21DLFFBQVEsQ0FBQ21DLElBQUksQ0FBQyxFQUFFd0csUUFBUSxDQUFDO01BQzNDLENBQUM7TUFDREMsaUJBQWlCLEVBQUU7UUFDakJDLGtCQUFrQixFQUFFckYsQ0FBQyxDQUFDc0YsR0FBRyxDQUFDRCxrQkFBa0IsSUFBSSxFQUFFLEVBQUUsVUFDbER0SSxRQUFRLEVBQ1IrQixRQUFRLEVBQ1I7VUFDQSxPQUFPO1lBQ0xBLFFBQVEsRUFBRUEsUUFBUTtZQUNsQi9CLFFBQVEsRUFBRUE7VUFDWixDQUFDO1FBQ0gsQ0FBQyxDQUFDO1FBQ0Y7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0EwRyxtQkFBbUI7UUFDbkI4QixpQkFBaUIsRUFBRXpJLElBQUksQ0FBQzJHLG1CQUFtQixDQUFDO1FBQzVDK0IsaUJBQWlCLEVBQ2Y1SSx5QkFBeUIsQ0FBQ0Msb0JBQW9CLElBQUksRUFBRTtRQUN0REosMEJBQTBCLEVBQUVBLDBCQUEwQjtRQUN0RGdKLE9BQU8sRUFBRUEsT0FBTztRQUNoQkMsb0JBQW9CLEVBQUU1TCxlQUFlLENBQUM0TCxvQkFBb0IsRUFBRTtRQUM1REMsTUFBTSxFQUFFYixpQkFBaUIsQ0FBQ2E7TUFDNUI7SUFDRixDQUFDLEVBQ0RiLGlCQUFpQixDQUNsQixDQUNGO0VBQ0gsQ0FBQzs7RUFFRDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBaEwsZUFBZSxDQUFDOEwscUJBQXFCLEdBQUcsVUFDdENDLGlCQUFpQixFQUNqQnpJLEdBQUcsRUFDSEMsR0FBRyxFQUNIeUksSUFBSTtJQUFBLGdDQUNKO01BQUE7TUFDQSxJQUFJaEgsUUFBUSxHQUFHOUQsWUFBWSxDQUFDb0MsR0FBRyxDQUFDLENBQUMwQixRQUFRO01BQ3pDLElBQUk7UUFDRkEsUUFBUSxHQUFHaUUsa0JBQWtCLENBQUNqRSxRQUFRLENBQUM7TUFDekMsQ0FBQyxDQUFDLE9BQU9pSCxDQUFDLEVBQUU7UUFDVkQsSUFBSSxFQUFFO1FBQ047TUFDRjtNQUVBLElBQUlFLGFBQWEsR0FBRyxVQUFTQyxDQUFDLEVBQUU7UUFBQTtRQUM5QixJQUNFN0ksR0FBRyxDQUFDOEksTUFBTSxLQUFLLEtBQUssSUFDcEI5SSxHQUFHLENBQUM4SSxNQUFNLEtBQUssTUFBTSw2QkFDckJ2RixNQUFNLENBQUN3RixRQUFRLENBQUNDLFFBQVEsNEVBQXhCLHNCQUEwQkMsTUFBTSxtREFBaEMsdUJBQWtDQyxtQkFBbUIsRUFDckQ7VUFDQWpKLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQyxHQUFHLEVBQUU7WUFDakIsY0FBYyxFQUFFLHVDQUF1QztZQUN2RCxnQkFBZ0IsRUFBRUMsTUFBTSxDQUFDQyxVQUFVLENBQUNSLENBQUM7VUFDdkMsQ0FBQyxDQUFDO1VBQ0Y1SSxHQUFHLENBQUNxSixLQUFLLENBQUNULENBQUMsQ0FBQztVQUNaNUksR0FBRyxDQUFDc0osR0FBRyxFQUFFO1FBQ1gsQ0FBQyxNQUFNO1VBQ0wsTUFBTUMsTUFBTSxHQUFHeEosR0FBRyxDQUFDOEksTUFBTSxLQUFLLFNBQVMsR0FBRyxHQUFHLEdBQUcsR0FBRztVQUNuRDdJLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQ0ssTUFBTSxFQUFFO1lBQ3BCQyxLQUFLLEVBQUUsb0JBQW9CO1lBQzNCLGdCQUFnQixFQUFFO1VBQ3BCLENBQUMsQ0FBQztVQUNGeEosR0FBRyxDQUFDc0osR0FBRyxFQUFFO1FBQ1g7TUFDRixDQUFDO01BRUQsSUFDRTNHLENBQUMsQ0FBQzhHLEdBQUcsQ0FBQ3pCLGtCQUFrQixFQUFFdkcsUUFBUSxDQUFDLElBQ25DLENBQUNoRixlQUFlLENBQUM0TCxvQkFBb0IsRUFBRSxFQUN2QztRQUNBTSxhQUFhLENBQUNYLGtCQUFrQixDQUFDdkcsUUFBUSxDQUFDLENBQUM7UUFDM0M7TUFDRjtNQUVBLE1BQU07UUFBRUgsSUFBSTtRQUFFRTtNQUFLLENBQUMsR0FBR2hGLE1BQU0sQ0FBQzRFLGlCQUFpQixDQUFDckIsR0FBRyxDQUFDO01BRXBELElBQUksQ0FBQ3ZCLE1BQU0sQ0FBQzJELElBQUksQ0FBQzNGLE1BQU0sQ0FBQzBDLGNBQWMsRUFBRW9DLElBQUksQ0FBQyxFQUFFO1FBQzdDO1FBQ0FtSCxJQUFJLEVBQUU7UUFDTjtNQUNGOztNQUVBO01BQ0E7TUFDQSxNQUFNL0UsT0FBTyxHQUFHbEgsTUFBTSxDQUFDMEMsY0FBYyxDQUFDb0MsSUFBSSxDQUFDO01BQzNDLGNBQU1vQyxPQUFPLENBQUNnRyxNQUFNO01BRXBCLElBQ0VsSSxJQUFJLEtBQUssMkJBQTJCLElBQ3BDLENBQUMvRSxlQUFlLENBQUM0TCxvQkFBb0IsRUFBRSxFQUN2QztRQUNBTSxhQUFhLHVDQUNvQmpGLE9BQU8sQ0FBQzBDLG1CQUFtQixPQUMzRDtRQUNEO01BQ0Y7TUFFQSxNQUFNdUQsSUFBSSxHQUFHQyxpQkFBaUIsQ0FBQ3BCLGlCQUFpQixFQUFFL0csUUFBUSxFQUFFRCxJQUFJLEVBQUVGLElBQUksQ0FBQztNQUN2RSxJQUFJLENBQUNxSSxJQUFJLEVBQUU7UUFDVGxCLElBQUksRUFBRTtRQUNOO01BQ0Y7TUFDQTtNQUNBLElBQ0UxSSxHQUFHLENBQUM4SSxNQUFNLEtBQUssTUFBTSxJQUNyQjlJLEdBQUcsQ0FBQzhJLE1BQU0sS0FBSyxLQUFLLElBQ3BCLDRCQUFDdkYsTUFBTSxDQUFDd0YsUUFBUSxDQUFDQyxRQUFRLDZFQUF4Qix1QkFBMEJDLE1BQU0sbURBQWhDLHVCQUFrQ0MsbUJBQW1CLEdBQ3REO1FBQ0EsTUFBTU0sTUFBTSxHQUFHeEosR0FBRyxDQUFDOEksTUFBTSxLQUFLLFNBQVMsR0FBRyxHQUFHLEdBQUcsR0FBRztRQUNuRDdJLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQ0ssTUFBTSxFQUFFO1VBQ3BCQyxLQUFLLEVBQUUsb0JBQW9CO1VBQzNCLGdCQUFnQixFQUFFO1FBQ3BCLENBQUMsQ0FBQztRQUNGeEosR0FBRyxDQUFDc0osR0FBRyxFQUFFO1FBQ1Q7TUFDRjs7TUFFQTtNQUNBO01BQ0E7O01BRUE7TUFDQTtNQUNBO01BQ0EsTUFBTU8sTUFBTSxHQUFHRixJQUFJLENBQUNHLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRyxHQUFHLENBQUM7TUFFN0QsSUFBSUgsSUFBSSxDQUFDRyxTQUFTLEVBQUU7UUFDbEI7UUFDQTtRQUNBO1FBQ0E7UUFDQTlKLEdBQUcsQ0FBQytKLFNBQVMsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDO01BQ3JDOztNQUVBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBLElBQUlKLElBQUksQ0FBQ0ssWUFBWSxFQUFFO1FBQ3JCaEssR0FBRyxDQUFDK0osU0FBUyxDQUNYLGFBQWEsRUFDYnhLLHlCQUF5QixDQUFDQyxvQkFBb0IsR0FBR21LLElBQUksQ0FBQ0ssWUFBWSxDQUNuRTtNQUNIO01BRUEsSUFBSUwsSUFBSSxDQUFDTSxJQUFJLEtBQUssSUFBSSxJQUFJTixJQUFJLENBQUNNLElBQUksS0FBSyxZQUFZLEVBQUU7UUFDcERqSyxHQUFHLENBQUMrSixTQUFTLENBQUMsY0FBYyxFQUFFLHVDQUF1QyxDQUFDO01BQ3hFLENBQUMsTUFBTSxJQUFJSixJQUFJLENBQUNNLElBQUksS0FBSyxLQUFLLEVBQUU7UUFDOUJqSyxHQUFHLENBQUMrSixTQUFTLENBQUMsY0FBYyxFQUFFLHlCQUF5QixDQUFDO01BQzFELENBQUMsTUFBTSxJQUFJSixJQUFJLENBQUNNLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDL0JqSyxHQUFHLENBQUMrSixTQUFTLENBQUMsY0FBYyxFQUFFLGlDQUFpQyxDQUFDO01BQ2xFO01BRUEsSUFBSUosSUFBSSxDQUFDaEssSUFBSSxFQUFFO1FBQ2JLLEdBQUcsQ0FBQytKLFNBQVMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHSixJQUFJLENBQUNoSyxJQUFJLEdBQUcsR0FBRyxDQUFDO01BQzlDO01BRUEsSUFBSWdLLElBQUksQ0FBQ08sT0FBTyxFQUFFO1FBQ2hCbEssR0FBRyxDQUFDK0osU0FBUyxDQUFDLGdCQUFnQixFQUFFWixNQUFNLENBQUNDLFVBQVUsQ0FBQ08sSUFBSSxDQUFDTyxPQUFPLENBQUMsQ0FBQztRQUNoRWxLLEdBQUcsQ0FBQ3FKLEtBQUssQ0FBQ00sSUFBSSxDQUFDTyxPQUFPLENBQUM7UUFDdkJsSyxHQUFHLENBQUNzSixHQUFHLEVBQUU7TUFDWCxDQUFDLE1BQU07UUFDTHRMLElBQUksQ0FBQytCLEdBQUcsRUFBRTRKLElBQUksQ0FBQ1EsWUFBWSxFQUFFO1VBQzNCQyxNQUFNLEVBQUVQLE1BQU07VUFDZFEsUUFBUSxFQUFFLE9BQU87VUFBRTtVQUNuQkMsWUFBWSxFQUFFLEtBQUssQ0FBRTtRQUN2QixDQUFDLENBQUMsQ0FDQy9GLEVBQUUsQ0FBQyxPQUFPLEVBQUUsVUFBU2dHLEdBQUcsRUFBRTtVQUN6QkMsR0FBRyxDQUFDQyxLQUFLLENBQUMsNEJBQTRCLEdBQUdGLEdBQUcsQ0FBQztVQUM3Q3ZLLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQyxHQUFHLENBQUM7VUFDbEJsSixHQUFHLENBQUNzSixHQUFHLEVBQUU7UUFDWCxDQUFDLENBQUMsQ0FDRC9FLEVBQUUsQ0FBQyxXQUFXLEVBQUUsWUFBVztVQUMxQmlHLEdBQUcsQ0FBQ0MsS0FBSyxDQUFDLHVCQUF1QixHQUFHZCxJQUFJLENBQUNRLFlBQVksQ0FBQztVQUN0RG5LLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQyxHQUFHLENBQUM7VUFDbEJsSixHQUFHLENBQUNzSixHQUFHLEVBQUU7UUFDWCxDQUFDLENBQUMsQ0FDRG9CLElBQUksQ0FBQzFLLEdBQUcsQ0FBQztNQUNkO0lBQ0YsQ0FBQztFQUFBO0VBRUQsU0FBUzRKLGlCQUFpQixDQUFDcEIsaUJBQWlCLEVBQUVtQyxZQUFZLEVBQUVuSixJQUFJLEVBQUVGLElBQUksRUFBRTtJQUN0RSxJQUFJLENBQUM5QyxNQUFNLENBQUMyRCxJQUFJLENBQUMzRixNQUFNLENBQUMwQyxjQUFjLEVBQUVvQyxJQUFJLENBQUMsRUFBRTtNQUM3QyxPQUFPLElBQUk7SUFDYjs7SUFFQTtJQUNBO0lBQ0EsTUFBTXNKLGNBQWMsR0FBR25NLE1BQU0sQ0FBQ3NJLElBQUksQ0FBQ3lCLGlCQUFpQixDQUFDO0lBQ3JELE1BQU1xQyxTQUFTLEdBQUdELGNBQWMsQ0FBQ0UsT0FBTyxDQUFDeEosSUFBSSxDQUFDO0lBQzlDLElBQUl1SixTQUFTLEdBQUcsQ0FBQyxFQUFFO01BQ2pCRCxjQUFjLENBQUNHLE9BQU8sQ0FBQ0gsY0FBYyxDQUFDeEksTUFBTSxDQUFDeUksU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFO0lBRUEsSUFBSWxCLElBQUksR0FBRyxJQUFJO0lBRWZpQixjQUFjLENBQUNJLElBQUksQ0FBQzFKLElBQUksSUFBSTtNQUMxQixNQUFNMkosV0FBVyxHQUFHekMsaUJBQWlCLENBQUNsSCxJQUFJLENBQUM7TUFFM0MsU0FBUzRKLFFBQVEsQ0FBQzFKLElBQUksRUFBRTtRQUN0Qm1JLElBQUksR0FBR3NCLFdBQVcsQ0FBQ3pKLElBQUksQ0FBQztRQUN4QjtRQUNBO1FBQ0EsSUFBSSxPQUFPbUksSUFBSSxLQUFLLFVBQVUsRUFBRTtVQUM5QkEsSUFBSSxHQUFHc0IsV0FBVyxDQUFDekosSUFBSSxDQUFDLEdBQUdtSSxJQUFJLEVBQUU7UUFDbkM7UUFDQSxPQUFPQSxJQUFJO01BQ2I7O01BRUE7TUFDQTtNQUNBLElBQUluTCxNQUFNLENBQUMyRCxJQUFJLENBQUM4SSxXQUFXLEVBQUVOLFlBQVksQ0FBQyxFQUFFO1FBQzFDLE9BQU9PLFFBQVEsQ0FBQ1AsWUFBWSxDQUFDO01BQy9COztNQUVBO01BQ0EsSUFBSW5KLElBQUksS0FBS21KLFlBQVksSUFBSW5NLE1BQU0sQ0FBQzJELElBQUksQ0FBQzhJLFdBQVcsRUFBRXpKLElBQUksQ0FBQyxFQUFFO1FBQzNELE9BQU8wSixRQUFRLENBQUMxSixJQUFJLENBQUM7TUFDdkI7SUFDRixDQUFDLENBQUM7SUFFRixPQUFPbUksSUFBSTtFQUNiOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBbE4sZUFBZSxDQUFDME8sU0FBUyxHQUFHQyxJQUFJLElBQUk7SUFDbEMsSUFBSUMsVUFBVSxHQUFHQyxRQUFRLENBQUNGLElBQUksQ0FBQztJQUMvQixJQUFJRyxNQUFNLENBQUNDLEtBQUssQ0FBQ0gsVUFBVSxDQUFDLEVBQUU7TUFDNUJBLFVBQVUsR0FBR0QsSUFBSTtJQUNuQjtJQUNBLE9BQU9DLFVBQVU7RUFDbkIsQ0FBQztFQUlEaE4sU0FBUyxDQUFDLHFCQUFxQixFQUFFLGlDQUFvQjtJQUFBLElBQWI7TUFBRWlEO0lBQUssQ0FBQztJQUM5QzdFLGVBQWUsQ0FBQ2dQLFdBQVcsQ0FBQ25LLElBQUksQ0FBQztFQUNuQyxDQUFDLEVBQUM7RUFFRmpELFNBQVMsQ0FBQyxzQkFBc0IsRUFBRSxrQ0FBb0I7SUFBQSxJQUFiO01BQUVpRDtJQUFLLENBQUM7SUFDL0M3RSxlQUFlLENBQUNpUCxxQkFBcUIsQ0FBQ3BLLElBQUksQ0FBQztFQUM3QyxDQUFDLEVBQUM7RUFFRixTQUFTcUssZUFBZSxHQUFHO0lBQ3pCLElBQUlDLFlBQVksR0FBRyxLQUFLO0lBQ3hCLElBQUlDLFNBQVMsR0FBRyxJQUFJdkksTUFBTSxDQUFDd0ksaUJBQWlCLEVBQUU7SUFFOUMsSUFBSUMsZUFBZSxHQUFHLFVBQVNDLE9BQU8sRUFBRTtNQUN0QyxPQUFPdEcsa0JBQWtCLENBQUN0SSxRQUFRLENBQUM0TyxPQUFPLENBQUMsQ0FBQ3ZLLFFBQVEsQ0FBQztJQUN2RCxDQUFDO0lBRURoRixlQUFlLENBQUN3UCxvQkFBb0IsR0FBRyxZQUFXO01BQ2hESixTQUFTLENBQUNLLE9BQU8sQ0FBQyxZQUFXO1FBQzNCLE1BQU0xRCxpQkFBaUIsR0FBRy9KLE1BQU0sQ0FBQ2tHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFFN0MsTUFBTTtVQUFFd0g7UUFBVyxDQUFDLEdBQUdDLG9CQUFvQjtRQUMzQyxNQUFNQyxXQUFXLEdBQ2ZGLFVBQVUsQ0FBQ0UsV0FBVyxJQUFJNU4sTUFBTSxDQUFDc0ksSUFBSSxDQUFDb0YsVUFBVSxDQUFDRyxXQUFXLENBQUM7UUFFL0QsSUFBSTtVQUNGRCxXQUFXLENBQUNsRyxPQUFPLENBQUM3RSxJQUFJLElBQUk7WUFDMUJvSyxxQkFBcUIsQ0FBQ3BLLElBQUksRUFBRWtILGlCQUFpQixDQUFDO1VBQ2hELENBQUMsQ0FBQztVQUNGL0wsZUFBZSxDQUFDK0wsaUJBQWlCLEdBQUdBLGlCQUFpQjtRQUN2RCxDQUFDLENBQUMsT0FBT0UsQ0FBQyxFQUFFO1VBQ1Y4QixHQUFHLENBQUNDLEtBQUssQ0FBQyxzQ0FBc0MsR0FBRy9CLENBQUMsQ0FBQzZELEtBQUssQ0FBQztVQUMzREMsT0FBTyxDQUFDQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2pCO01BQ0YsQ0FBQyxDQUFDO0lBQ0osQ0FBQzs7SUFFRDtJQUNBO0lBQ0FoUSxlQUFlLENBQUNnUCxXQUFXLEdBQUcsVUFBU25LLElBQUksRUFBRTtNQUMzQ3VLLFNBQVMsQ0FBQ0ssT0FBTyxDQUFDLE1BQU07UUFDdEIsTUFBTXhJLE9BQU8sR0FBR2xILE1BQU0sQ0FBQzBDLGNBQWMsQ0FBQ29DLElBQUksQ0FBQztRQUMzQyxNQUFNO1VBQUVvTDtRQUFRLENBQUMsR0FBR2hKLE9BQU87UUFDM0JBLE9BQU8sQ0FBQ2dHLE1BQU0sR0FBRyxJQUFJN0MsT0FBTyxDQUFDQyxPQUFPLElBQUk7VUFDdEMsSUFBSSxPQUFPNEYsT0FBTyxLQUFLLFVBQVUsRUFBRTtZQUNqQztZQUNBO1lBQ0FoSixPQUFPLENBQUNnSixPQUFPLEdBQUcsWUFBVztjQUMzQkEsT0FBTyxFQUFFO2NBQ1Q1RixPQUFPLEVBQUU7WUFDWCxDQUFDO1VBQ0gsQ0FBQyxNQUFNO1lBQ0xwRCxPQUFPLENBQUNnSixPQUFPLEdBQUc1RixPQUFPO1VBQzNCO1FBQ0YsQ0FBQyxDQUFDO01BQ0osQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEckssZUFBZSxDQUFDaVAscUJBQXFCLEdBQUcsVUFBU3BLLElBQUksRUFBRTtNQUNyRHVLLFNBQVMsQ0FBQ0ssT0FBTyxDQUFDLE1BQU1SLHFCQUFxQixDQUFDcEssSUFBSSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVELFNBQVNvSyxxQkFBcUIsQ0FDNUJwSyxJQUFJLEVBRUo7TUFBQSxJQURBa0gsaUJBQWlCLHVFQUFHL0wsZUFBZSxDQUFDK0wsaUJBQWlCO01BRXJELE1BQU1tRSxTQUFTLEdBQUczUCxRQUFRLENBQ3hCQyxXQUFXLENBQUNtUCxvQkFBb0IsQ0FBQ1EsU0FBUyxDQUFDLEVBQzNDdEwsSUFBSSxDQUNMOztNQUVEO01BQ0EsTUFBTXVMLGVBQWUsR0FBRzdQLFFBQVEsQ0FBQzJQLFNBQVMsRUFBRSxjQUFjLENBQUM7TUFFM0QsSUFBSUcsV0FBVztNQUNmLElBQUk7UUFDRkEsV0FBVyxHQUFHekgsSUFBSSxDQUFDaEksS0FBSyxDQUFDVixZQUFZLENBQUNrUSxlQUFlLENBQUMsQ0FBQztNQUN6RCxDQUFDLENBQUMsT0FBT25FLENBQUMsRUFBRTtRQUNWLElBQUlBLENBQUMsQ0FBQ3FFLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDekIsTUFBTXJFLENBQUM7TUFDVDtNQUVBLElBQUlvRSxXQUFXLENBQUNFLE1BQU0sS0FBSyxrQkFBa0IsRUFBRTtRQUM3QyxNQUFNLElBQUlqSyxLQUFLLENBQ2Isd0NBQXdDLEdBQ3RDc0MsSUFBSSxDQUFDQyxTQUFTLENBQUN3SCxXQUFXLENBQUNFLE1BQU0sQ0FBQyxDQUNyQztNQUNIO01BRUEsSUFBSSxDQUFDSCxlQUFlLElBQUksQ0FBQ0YsU0FBUyxJQUFJLENBQUNHLFdBQVcsRUFBRTtRQUNsRCxNQUFNLElBQUkvSixLQUFLLENBQUMsZ0NBQWdDLENBQUM7TUFDbkQ7TUFFQTVELFFBQVEsQ0FBQ21DLElBQUksQ0FBQyxHQUFHcUwsU0FBUztNQUMxQixNQUFNMUIsV0FBVyxHQUFJekMsaUJBQWlCLENBQUNsSCxJQUFJLENBQUMsR0FBRzdDLE1BQU0sQ0FBQ2tHLE1BQU0sQ0FBQyxJQUFJLENBQUU7TUFFbkUsTUFBTTtRQUFFNkM7TUFBUyxDQUFDLEdBQUdzRixXQUFXO01BQ2hDdEYsUUFBUSxDQUFDckIsT0FBTyxDQUFDOEcsSUFBSSxJQUFJO1FBQ3ZCLElBQUlBLElBQUksQ0FBQzVOLEdBQUcsSUFBSTROLElBQUksQ0FBQ0MsS0FBSyxLQUFLLFFBQVEsRUFBRTtVQUN2Q2pDLFdBQVcsQ0FBQ2MsZUFBZSxDQUFDa0IsSUFBSSxDQUFDNU4sR0FBRyxDQUFDLENBQUMsR0FBRztZQUN2QzhLLFlBQVksRUFBRW5OLFFBQVEsQ0FBQzJQLFNBQVMsRUFBRU0sSUFBSSxDQUFDekwsSUFBSSxDQUFDO1lBQzVDc0ksU0FBUyxFQUFFbUQsSUFBSSxDQUFDbkQsU0FBUztZQUN6Qm5LLElBQUksRUFBRXNOLElBQUksQ0FBQ3ROLElBQUk7WUFDZjtZQUNBcUssWUFBWSxFQUFFaUQsSUFBSSxDQUFDakQsWUFBWTtZQUMvQkMsSUFBSSxFQUFFZ0QsSUFBSSxDQUFDaEQ7VUFDYixDQUFDO1VBRUQsSUFBSWdELElBQUksQ0FBQ0UsU0FBUyxFQUFFO1lBQ2xCO1lBQ0E7WUFDQWxDLFdBQVcsQ0FBQ2MsZUFBZSxDQUFDa0IsSUFBSSxDQUFDakQsWUFBWSxDQUFDLENBQUMsR0FBRztjQUNoREcsWUFBWSxFQUFFbk4sUUFBUSxDQUFDMlAsU0FBUyxFQUFFTSxJQUFJLENBQUNFLFNBQVMsQ0FBQztjQUNqRHJELFNBQVMsRUFBRTtZQUNiLENBQUM7VUFDSDtRQUNGO01BQ0YsQ0FBQyxDQUFDO01BRUYsTUFBTTtRQUFFc0Q7TUFBZ0IsQ0FBQyxHQUFHN04seUJBQXlCO01BQ3JELE1BQU04TixlQUFlLEdBQUc7UUFDdEJEO01BQ0YsQ0FBQztNQUVELE1BQU1FLFVBQVUsR0FBRzlRLE1BQU0sQ0FBQzBDLGNBQWMsQ0FBQ29DLElBQUksQ0FBQztNQUM5QyxNQUFNaU0sVUFBVSxHQUFJL1EsTUFBTSxDQUFDMEMsY0FBYyxDQUFDb0MsSUFBSSxDQUFDLEdBQUc7UUFDaEQwTCxNQUFNLEVBQUUsa0JBQWtCO1FBQzFCeEYsUUFBUSxFQUFFQSxRQUFRO1FBQ2xCO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0EzSSxPQUFPLEVBQUUsTUFDUDJPLGFBQWEsQ0FBQzVKLG1CQUFtQixDQUFDNEQsUUFBUSxFQUFFLElBQUksRUFBRTZGLGVBQWUsQ0FBQztRQUNwRUksa0JBQWtCLEVBQUUsTUFDbEJELGFBQWEsQ0FBQzVKLG1CQUFtQixDQUMvQjRELFFBQVEsRUFDUnlDLElBQUksSUFBSUEsSUFBSSxLQUFLLEtBQUssRUFDdEJvRCxlQUFlLENBQ2hCO1FBQ0hLLHFCQUFxQixFQUFFLE1BQ3JCRixhQUFhLENBQUM1SixtQkFBbUIsQ0FDL0I0RCxRQUFRLEVBQ1IsQ0FBQ3lDLElBQUksRUFBRTBELFdBQVcsS0FBSzFELElBQUksS0FBSyxLQUFLLElBQUksQ0FBQzBELFdBQVcsRUFDckROLGVBQWUsQ0FDaEI7UUFDSE8sa0JBQWtCLEVBQUUsTUFDbEJKLGFBQWEsQ0FBQzVKLG1CQUFtQixDQUMvQjRELFFBQVEsRUFDUixDQUFDcUcsS0FBSyxFQUFFRixXQUFXLEtBQUtBLFdBQVcsRUFDbkNOLGVBQWUsQ0FDaEI7UUFDSFMsNEJBQTRCLEVBQUVoQixXQUFXLENBQUNnQiw0QkFBNEI7UUFDdEVWLGVBQWU7UUFDZlcsVUFBVSxFQUFFakIsV0FBVyxDQUFDaUI7TUFDMUIsQ0FBRTs7TUFFRjtNQUNBLE1BQU1DLGlCQUFpQixHQUFHLEtBQUssR0FBRzFNLElBQUksQ0FBQzJNLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO01BQzVELE1BQU1DLFdBQVcsR0FBR0YsaUJBQWlCLEdBQUdqQyxlQUFlLENBQUMsZ0JBQWdCLENBQUM7TUFFekVkLFdBQVcsQ0FBQ2lELFdBQVcsQ0FBQyxHQUFHLE1BQU07UUFDL0IsSUFBSUMsT0FBTyxDQUFDQyxVQUFVLEVBQUU7VUFDdEIsTUFBTTtZQUNKQyxrQkFBa0IsR0FBR0YsT0FBTyxDQUFDQyxVQUFVLENBQUNFLFVBQVUsQ0FBQ0M7VUFDckQsQ0FBQyxHQUFHL0IsT0FBTyxDQUFDZ0MsR0FBRztVQUVmLElBQUlILGtCQUFrQixFQUFFO1lBQ3RCZCxVQUFVLENBQUMxTyxPQUFPLEdBQUd3UCxrQkFBa0I7VUFDekM7UUFDRjtRQUVBLElBQUksT0FBT2QsVUFBVSxDQUFDMU8sT0FBTyxLQUFLLFVBQVUsRUFBRTtVQUM1QzBPLFVBQVUsQ0FBQzFPLE9BQU8sR0FBRzBPLFVBQVUsQ0FBQzFPLE9BQU8sRUFBRTtRQUMzQztRQUVBLE9BQU87VUFDTHFMLE9BQU8sRUFBRTdFLElBQUksQ0FBQ0MsU0FBUyxDQUFDaUksVUFBVSxDQUFDO1VBQ25DekQsU0FBUyxFQUFFLEtBQUs7VUFDaEJuSyxJQUFJLEVBQUU0TixVQUFVLENBQUMxTyxPQUFPO1VBQ3hCb0wsSUFBSSxFQUFFO1FBQ1IsQ0FBQztNQUNILENBQUM7TUFFRHdFLDBCQUEwQixDQUFDbk4sSUFBSSxDQUFDOztNQUVoQztNQUNBO01BQ0EsSUFBSWdNLFVBQVUsSUFBSUEsVUFBVSxDQUFDNUQsTUFBTSxFQUFFO1FBQ25DNEQsVUFBVSxDQUFDWixPQUFPLEVBQUU7TUFDdEI7SUFDRjtJQUVBLE1BQU1nQyxxQkFBcUIsR0FBRztNQUM1QixhQUFhLEVBQUU7UUFDYmhILHNCQUFzQixFQUFFO1VBQ3RCO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0FpSCwwQkFBMEIsRUFDeEJuQyxPQUFPLENBQUNnQyxHQUFHLENBQUNJLGNBQWMsSUFBSXRMLE1BQU0sQ0FBQ3VMLFdBQVcsRUFBRTtVQUNwREMsUUFBUSxFQUFFdEMsT0FBTyxDQUFDZ0MsR0FBRyxDQUFDTyxlQUFlLElBQUl6TCxNQUFNLENBQUN1TCxXQUFXO1FBQzdEO01BQ0YsQ0FBQztNQUVELGFBQWEsRUFBRTtRQUNibkgsc0JBQXNCLEVBQUU7VUFDdEIzSixRQUFRLEVBQUU7UUFDWjtNQUNGLENBQUM7TUFFRCxvQkFBb0IsRUFBRTtRQUNwQjJKLHNCQUFzQixFQUFFO1VBQ3RCM0osUUFBUSxFQUFFO1FBQ1o7TUFDRjtJQUNGLENBQUM7SUFFRHRCLGVBQWUsQ0FBQ3VTLG1CQUFtQixHQUFHLFlBQVc7TUFDL0M7TUFDQTtNQUNBO01BQ0E7TUFDQW5ELFNBQVMsQ0FBQ0ssT0FBTyxDQUFDLFlBQVc7UUFDM0J6TixNQUFNLENBQUNzSSxJQUFJLENBQUN2SyxNQUFNLENBQUMwQyxjQUFjLENBQUMsQ0FBQ2lILE9BQU8sQ0FBQ3NJLDBCQUEwQixDQUFDO01BQ3hFLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxTQUFTQSwwQkFBMEIsQ0FBQ25OLElBQUksRUFBRTtNQUN4QyxNQUFNb0MsT0FBTyxHQUFHbEgsTUFBTSxDQUFDMEMsY0FBYyxDQUFDb0MsSUFBSSxDQUFDO01BQzNDLE1BQU1tRyxpQkFBaUIsR0FBR2lILHFCQUFxQixDQUFDcE4sSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO01BQzNELE1BQU07UUFBRWdGO01BQVMsQ0FBQyxHQUFJN0IsaUJBQWlCLENBQ3JDbkQsSUFBSSxDQUNMLEdBQUc3RSxlQUFlLENBQUM4SywyQkFBMkIsQ0FDN0NqRyxJQUFJLEVBQ0pvQyxPQUFPLENBQUM4RCxRQUFRLEVBQ2hCQyxpQkFBaUIsQ0FDakI7TUFDRjtNQUNBL0QsT0FBTyxDQUFDMEMsbUJBQW1CLEdBQUdmLElBQUksQ0FBQ0MsU0FBUyxpQ0FDdkMvRix5QkFBeUIsR0FDeEJrSSxpQkFBaUIsQ0FBQ0Msc0JBQXNCLElBQUksSUFBSSxFQUNwRDtNQUNGaEUsT0FBTyxDQUFDdUwsaUJBQWlCLEdBQUczSSxRQUFRLENBQUM0SSxHQUFHLENBQUNqSCxHQUFHLENBQUNrSCxJQUFJLEtBQUs7UUFDcEQ5UCxHQUFHLEVBQUVELDBCQUEwQixDQUFDK1AsSUFBSSxDQUFDOVAsR0FBRztNQUMxQyxDQUFDLENBQUMsQ0FBQztJQUNMO0lBRUE1QyxlQUFlLENBQUN3UCxvQkFBb0IsRUFBRTs7SUFFdEM7SUFDQSxJQUFJbUQsR0FBRyxHQUFHN1IsT0FBTyxFQUFFOztJQUVuQjtJQUNBO0lBQ0EsSUFBSThSLGtCQUFrQixHQUFHOVIsT0FBTyxFQUFFO0lBQ2xDNlIsR0FBRyxDQUFDRSxHQUFHLENBQUNELGtCQUFrQixDQUFDOztJQUUzQjtJQUNBRCxHQUFHLENBQUNFLEdBQUcsQ0FBQzlSLFFBQVEsQ0FBQztNQUFFMEMsTUFBTSxFQUFFSjtJQUFlLENBQUMsQ0FBQyxDQUFDOztJQUU3QztJQUNBc1AsR0FBRyxDQUFDRSxHQUFHLENBQUM3UixZQUFZLEVBQUUsQ0FBQzs7SUFFdkI7SUFDQTtJQUNBMlIsR0FBRyxDQUFDRSxHQUFHLENBQUMsVUFBU3ZQLEdBQUcsRUFBRUMsR0FBRyxFQUFFeUksSUFBSSxFQUFFO01BQy9CLElBQUlyRixXQUFXLENBQUNtTSxVQUFVLENBQUN4UCxHQUFHLENBQUNWLEdBQUcsQ0FBQyxFQUFFO1FBQ25Db0osSUFBSSxFQUFFO1FBQ047TUFDRjtNQUNBekksR0FBRyxDQUFDa0osU0FBUyxDQUFDLEdBQUcsQ0FBQztNQUNsQmxKLEdBQUcsQ0FBQ3FKLEtBQUssQ0FBQyxhQUFhLENBQUM7TUFDeEJySixHQUFHLENBQUNzSixHQUFHLEVBQUU7SUFDWCxDQUFDLENBQUM7O0lBRUY7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOEYsR0FBRyxDQUFDRSxHQUFHLENBQUMsVUFBUzdNLE9BQU8sRUFBRStNLFFBQVEsRUFBRS9HLElBQUksRUFBRTtNQUN4Q2hHLE9BQU8sQ0FBQ2dOLEtBQUssR0FBRy9SLEVBQUUsQ0FBQ0wsS0FBSyxDQUFDRCxRQUFRLENBQUNxRixPQUFPLENBQUNwRCxHQUFHLENBQUMsQ0FBQ29RLEtBQUssQ0FBQztNQUNyRGhILElBQUksRUFBRTtJQUNSLENBQUMsQ0FBQztJQUVGLFNBQVNpSCxZQUFZLENBQUNsTyxJQUFJLEVBQUU7TUFDMUIsTUFBTW5CLEtBQUssR0FBR21CLElBQUksQ0FBQ2xCLEtBQUssQ0FBQyxHQUFHLENBQUM7TUFDN0IsT0FBT0QsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRUEsS0FBSyxDQUFDc1AsS0FBSyxFQUFFO01BQ3JDLE9BQU90UCxLQUFLO0lBQ2Q7SUFFQSxTQUFTdVAsVUFBVSxDQUFDQyxNQUFNLEVBQUVDLEtBQUssRUFBRTtNQUNqQyxPQUNFRCxNQUFNLENBQUNwUCxNQUFNLElBQUlxUCxLQUFLLENBQUNyUCxNQUFNLElBQzdCb1AsTUFBTSxDQUFDRSxLQUFLLENBQUMsQ0FBQ0MsSUFBSSxFQUFFeFAsQ0FBQyxLQUFLd1AsSUFBSSxLQUFLRixLQUFLLENBQUN0UCxDQUFDLENBQUMsQ0FBQztJQUVoRDs7SUFFQTtJQUNBNE8sR0FBRyxDQUFDRSxHQUFHLENBQUMsVUFBUzdNLE9BQU8sRUFBRStNLFFBQVEsRUFBRS9HLElBQUksRUFBRTtNQUN4QyxNQUFNd0gsVUFBVSxHQUFHMVEseUJBQXlCLENBQUNDLG9CQUFvQjtNQUNqRSxNQUFNO1FBQUVpQyxRQUFRO1FBQUV5TztNQUFPLENBQUMsR0FBRzlTLFFBQVEsQ0FBQ3FGLE9BQU8sQ0FBQ3BELEdBQUcsQ0FBQzs7TUFFbEQ7TUFDQSxJQUFJNFEsVUFBVSxFQUFFO1FBQ2QsTUFBTUUsV0FBVyxHQUFHVCxZQUFZLENBQUNPLFVBQVUsQ0FBQztRQUM1QyxNQUFNbk8sU0FBUyxHQUFHNE4sWUFBWSxDQUFDak8sUUFBUSxDQUFDO1FBQ3hDLElBQUltTyxVQUFVLENBQUNPLFdBQVcsRUFBRXJPLFNBQVMsQ0FBQyxFQUFFO1VBQ3RDVyxPQUFPLENBQUNwRCxHQUFHLEdBQUcsR0FBRyxHQUFHeUMsU0FBUyxDQUFDSSxLQUFLLENBQUNpTyxXQUFXLENBQUMxUCxNQUFNLENBQUMsQ0FBQ3ZELElBQUksQ0FBQyxHQUFHLENBQUM7VUFDakUsSUFBSWdULE1BQU0sRUFBRTtZQUNWek4sT0FBTyxDQUFDcEQsR0FBRyxJQUFJNlEsTUFBTTtVQUN2QjtVQUNBLE9BQU96SCxJQUFJLEVBQUU7UUFDZjtNQUNGO01BRUEsSUFBSWhILFFBQVEsS0FBSyxjQUFjLElBQUlBLFFBQVEsS0FBSyxhQUFhLEVBQUU7UUFDN0QsT0FBT2dILElBQUksRUFBRTtNQUNmO01BRUEsSUFBSXdILFVBQVUsRUFBRTtRQUNkVCxRQUFRLENBQUN0RyxTQUFTLENBQUMsR0FBRyxDQUFDO1FBQ3ZCc0csUUFBUSxDQUFDbkcsS0FBSyxDQUFDLGNBQWMsQ0FBQztRQUM5Qm1HLFFBQVEsQ0FBQ2xHLEdBQUcsRUFBRTtRQUNkO01BQ0Y7TUFFQWIsSUFBSSxFQUFFO0lBQ1IsQ0FBQyxDQUFDOztJQUVGO0lBQ0E7SUFDQTJHLEdBQUcsQ0FBQ0UsR0FBRyxDQUFDLFVBQVN2UCxHQUFHLEVBQUVDLEdBQUcsRUFBRXlJLElBQUksRUFBRTtNQUMvQmhNLGVBQWUsQ0FBQzhMLHFCQUFxQixDQUNuQzlMLGVBQWUsQ0FBQytMLGlCQUFpQixFQUNqQ3pJLEdBQUcsRUFDSEMsR0FBRyxFQUNIeUksSUFBSSxDQUNMO0lBQ0gsQ0FBQyxDQUFDOztJQUVGO0lBQ0E7SUFDQTJHLEdBQUcsQ0FBQ0UsR0FBRyxDQUFFN1MsZUFBZSxDQUFDMlQsc0JBQXNCLEdBQUc3UyxPQUFPLEVBQUUsQ0FBRTs7SUFFN0Q7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7SUFFRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFO0lBQ0E7SUFDQSxJQUFJOFMscUJBQXFCLEdBQUc5UyxPQUFPLEVBQUU7SUFDckM2UixHQUFHLENBQUNFLEdBQUcsQ0FBQ2UscUJBQXFCLENBQUM7SUFFOUIsSUFBSUMscUJBQXFCLEdBQUcsS0FBSztJQUNqQztJQUNBO0lBQ0E7SUFDQWxCLEdBQUcsQ0FBQ0UsR0FBRyxDQUFDLFVBQVMvRSxHQUFHLEVBQUV4SyxHQUFHLEVBQUVDLEdBQUcsRUFBRXlJLElBQUksRUFBRTtNQUNwQyxJQUFJLENBQUM4QixHQUFHLElBQUksQ0FBQytGLHFCQUFxQixJQUFJLENBQUN2USxHQUFHLENBQUNFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO1FBQ3RFd0ksSUFBSSxDQUFDOEIsR0FBRyxDQUFDO1FBQ1Q7TUFDRjtNQUNBdkssR0FBRyxDQUFDa0osU0FBUyxDQUFDcUIsR0FBRyxDQUFDaEIsTUFBTSxFQUFFO1FBQUUsY0FBYyxFQUFFO01BQWEsQ0FBQyxDQUFDO01BQzNEdkosR0FBRyxDQUFDc0osR0FBRyxDQUFDLGtCQUFrQixDQUFDO0lBQzdCLENBQUMsQ0FBQztJQUVGOEYsR0FBRyxDQUFDRSxHQUFHLENBQUMsVUFBZXZQLEdBQUcsRUFBRUMsR0FBRyxFQUFFeUksSUFBSTtNQUFBLGdDQUFFO1FBQUE7UUFDckMsSUFBSSxDQUFDdEYsTUFBTSxDQUFDcEQsR0FBRyxDQUFDVixHQUFHLENBQUMsRUFBRTtVQUNwQixPQUFPb0osSUFBSSxFQUFFO1FBQ2YsQ0FBQyxNQUFNLElBQ0wxSSxHQUFHLENBQUM4SSxNQUFNLEtBQUssTUFBTSxJQUNyQjlJLEdBQUcsQ0FBQzhJLE1BQU0sS0FBSyxLQUFLLElBQ3BCLDRCQUFDdkYsTUFBTSxDQUFDd0YsUUFBUSxDQUFDQyxRQUFRLDZFQUF4Qix1QkFBMEJDLE1BQU0sbURBQWhDLHVCQUFrQ0MsbUJBQW1CLEdBQ3REO1VBQ0EsTUFBTU0sTUFBTSxHQUFHeEosR0FBRyxDQUFDOEksTUFBTSxLQUFLLFNBQVMsR0FBRyxHQUFHLEdBQUcsR0FBRztVQUNuRDdJLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQ0ssTUFBTSxFQUFFO1lBQ3BCQyxLQUFLLEVBQUUsb0JBQW9CO1lBQzNCLGdCQUFnQixFQUFFO1VBQ3BCLENBQUMsQ0FBQztVQUNGeEosR0FBRyxDQUFDc0osR0FBRyxFQUFFO1FBQ1gsQ0FBQyxNQUFNO1VBQ0wsSUFBSXJKLE9BQU8sR0FBRztZQUNaLGNBQWMsRUFBRTtVQUNsQixDQUFDO1VBRUQsSUFBSTJMLFlBQVksRUFBRTtZQUNoQjNMLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBRyxPQUFPO1VBQ2pDO1VBRUEsSUFBSXdDLE9BQU8sR0FBR2pHLE1BQU0sQ0FBQzRFLGlCQUFpQixDQUFDckIsR0FBRyxDQUFDO1VBRTNDLElBQUkwQyxPQUFPLENBQUNwRCxHQUFHLENBQUNvUSxLQUFLLElBQUloTixPQUFPLENBQUNwRCxHQUFHLENBQUNvUSxLQUFLLENBQUMscUJBQXFCLENBQUMsRUFBRTtZQUNqRTtZQUNBO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBeFAsT0FBTyxDQUFDLGNBQWMsQ0FBQyxHQUFHLHlCQUF5QjtZQUNuREEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLFVBQVU7WUFDckNELEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQyxHQUFHLEVBQUVqSixPQUFPLENBQUM7WUFDM0JELEdBQUcsQ0FBQ3FKLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQztZQUN2RHJKLEdBQUcsQ0FBQ3NKLEdBQUcsRUFBRTtZQUNUO1VBQ0Y7VUFFQSxJQUFJN0csT0FBTyxDQUFDcEQsR0FBRyxDQUFDb1EsS0FBSyxJQUFJaE4sT0FBTyxDQUFDcEQsR0FBRyxDQUFDb1EsS0FBSyxDQUFDLG9CQUFvQixDQUFDLEVBQUU7WUFDaEU7WUFDQTtZQUNBO1lBQ0E7WUFDQXhQLE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxVQUFVO1lBQ3JDRCxHQUFHLENBQUNrSixTQUFTLENBQUMsR0FBRyxFQUFFakosT0FBTyxDQUFDO1lBQzNCRCxHQUFHLENBQUNzSixHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3hCO1VBQ0Y7VUFFQSxJQUFJN0csT0FBTyxDQUFDcEQsR0FBRyxDQUFDb1EsS0FBSyxJQUFJaE4sT0FBTyxDQUFDcEQsR0FBRyxDQUFDb1EsS0FBSyxDQUFDLHlCQUF5QixDQUFDLEVBQUU7WUFDckU7WUFDQTtZQUNBO1lBQ0E7WUFDQXhQLE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxVQUFVO1lBQ3JDRCxHQUFHLENBQUNrSixTQUFTLENBQUMsR0FBRyxFQUFFakosT0FBTyxDQUFDO1lBQzNCRCxHQUFHLENBQUNzSixHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3hCO1VBQ0Y7VUFFQSxNQUFNO1lBQUVoSTtVQUFLLENBQUMsR0FBR21CLE9BQU87VUFDeEIvRixNQUFNLENBQUNxSSxXQUFXLENBQUMsT0FBT3pELElBQUksRUFBRSxRQUFRLEVBQUU7WUFBRUE7VUFBSyxDQUFDLENBQUM7VUFFbkQsSUFBSSxDQUFDOUMsTUFBTSxDQUFDMkQsSUFBSSxDQUFDM0YsTUFBTSxDQUFDMEMsY0FBYyxFQUFFb0MsSUFBSSxDQUFDLEVBQUU7WUFDN0M7WUFDQXJCLE9BQU8sQ0FBQyxlQUFlLENBQUMsR0FBRyxVQUFVO1lBQ3JDRCxHQUFHLENBQUNrSixTQUFTLENBQUMsR0FBRyxFQUFFakosT0FBTyxDQUFDO1lBQzNCLElBQUlxRCxNQUFNLENBQUNpTixhQUFhLEVBQUU7Y0FDeEJ2USxHQUFHLENBQUNzSixHQUFHLDJDQUFvQ2hJLElBQUksb0JBQWlCO1lBQ2xFLENBQUMsTUFBTTtjQUNMO2NBQ0F0QixHQUFHLENBQUNzSixHQUFHLENBQUMsZUFBZSxDQUFDO1lBQzFCO1lBQ0E7VUFDRjs7VUFFQTtVQUNBO1VBQ0EsY0FBTTlNLE1BQU0sQ0FBQzBDLGNBQWMsQ0FBQ29DLElBQUksQ0FBQyxDQUFDb0ksTUFBTTtVQUV4QyxPQUFPekUsbUJBQW1CLENBQUN4QyxPQUFPLEVBQUVuQixJQUFJLENBQUMsQ0FDdEMwRixJQUFJLENBQUMsU0FBaUQ7WUFBQSxJQUFoRDtjQUFFRSxNQUFNO2NBQUVFLFVBQVU7Y0FBRW5ILE9BQU8sRUFBRXVRO1lBQVcsQ0FBQztZQUNoRCxJQUFJLENBQUNwSixVQUFVLEVBQUU7Y0FDZkEsVUFBVSxHQUFHcEgsR0FBRyxDQUFDb0gsVUFBVSxHQUFHcEgsR0FBRyxDQUFDb0gsVUFBVSxHQUFHLEdBQUc7WUFDcEQ7WUFFQSxJQUFJb0osVUFBVSxFQUFFO2NBQ2QvUixNQUFNLENBQUM0RCxNQUFNLENBQUNwQyxPQUFPLEVBQUV1USxVQUFVLENBQUM7WUFDcEM7WUFFQXhRLEdBQUcsQ0FBQ2tKLFNBQVMsQ0FBQzlCLFVBQVUsRUFBRW5ILE9BQU8sQ0FBQztZQUVsQ2lILE1BQU0sQ0FBQ3dELElBQUksQ0FBQzFLLEdBQUcsRUFBRTtjQUNmO2NBQ0FzSixHQUFHLEVBQUU7WUFDUCxDQUFDLENBQUM7VUFDSixDQUFDLENBQUMsQ0FDRG1ILEtBQUssQ0FBQ2hHLEtBQUssSUFBSTtZQUNkRCxHQUFHLENBQUNDLEtBQUssQ0FBQywwQkFBMEIsR0FBR0EsS0FBSyxDQUFDOEIsS0FBSyxDQUFDO1lBQ25Edk0sR0FBRyxDQUFDa0osU0FBUyxDQUFDLEdBQUcsRUFBRWpKLE9BQU8sQ0FBQztZQUMzQkQsR0FBRyxDQUFDc0osR0FBRyxFQUFFO1VBQ1gsQ0FBQyxDQUFDO1FBQ047TUFDRixDQUFDO0lBQUEsRUFBQzs7SUFFRjtJQUNBOEYsR0FBRyxDQUFDRSxHQUFHLENBQUMsVUFBU3ZQLEdBQUcsRUFBRUMsR0FBRyxFQUFFO01BQ3pCQSxHQUFHLENBQUNrSixTQUFTLENBQUMsR0FBRyxDQUFDO01BQ2xCbEosR0FBRyxDQUFDc0osR0FBRyxFQUFFO0lBQ1gsQ0FBQyxDQUFDO0lBRUYsSUFBSW9ILFVBQVUsR0FBRzVULFlBQVksQ0FBQ3NTLEdBQUcsQ0FBQztJQUNsQyxJQUFJdUIsb0JBQW9CLEdBQUcsRUFBRTs7SUFFN0I7SUFDQTtJQUNBO0lBQ0FELFVBQVUsQ0FBQ3ZNLFVBQVUsQ0FBQzdGLG9CQUFvQixDQUFDOztJQUUzQztJQUNBO0lBQ0E7SUFDQW9TLFVBQVUsQ0FBQ25NLEVBQUUsQ0FBQyxTQUFTLEVBQUUvSCxNQUFNLENBQUMwSCxpQ0FBaUMsQ0FBQzs7SUFFbEU7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQXdNLFVBQVUsQ0FBQ25NLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQ2dHLEdBQUcsRUFBRXFHLE1BQU0sS0FBSztNQUM1QztNQUNBLElBQUlBLE1BQU0sQ0FBQ0MsU0FBUyxFQUFFO1FBQ3BCO01BQ0Y7TUFFQSxJQUFJdEcsR0FBRyxDQUFDdUcsT0FBTyxLQUFLLGFBQWEsRUFBRTtRQUNqQ0YsTUFBTSxDQUFDdEgsR0FBRyxDQUFDLGtDQUFrQyxDQUFDO01BQ2hELENBQUMsTUFBTTtRQUNMO1FBQ0E7UUFDQXNILE1BQU0sQ0FBQ0csT0FBTyxDQUFDeEcsR0FBRyxDQUFDO01BQ3JCO0lBQ0YsQ0FBQyxDQUFDOztJQUVGO0lBQ0E1SCxDQUFDLENBQUNLLE1BQU0sQ0FBQ3hHLE1BQU0sRUFBRTtNQUNmd1UsZUFBZSxFQUFFWCxxQkFBcUI7TUFDdENoQixrQkFBa0IsRUFBRUEsa0JBQWtCO01BQ3RDcUIsVUFBVSxFQUFFQSxVQUFVO01BQ3RCTyxVQUFVLEVBQUU3QixHQUFHO01BQ2Y7TUFDQWtCLHFCQUFxQixFQUFFLFlBQVc7UUFDaENBLHFCQUFxQixHQUFHLElBQUk7TUFDOUIsQ0FBQztNQUNEWSxXQUFXLEVBQUUsVUFBU0MsQ0FBQyxFQUFFO1FBQ3ZCLElBQUlSLG9CQUFvQixFQUFFQSxvQkFBb0IsQ0FBQ3pOLElBQUksQ0FBQ2lPLENBQUMsQ0FBQyxDQUFDLEtBQ2xEQSxDQUFDLEVBQUU7TUFDVixDQUFDO01BQ0Q7TUFDQTtNQUNBQyxjQUFjLEVBQUUsVUFBU1YsVUFBVSxFQUFFVyxhQUFhLEVBQUUxSixFQUFFLEVBQUU7UUFDdEQrSSxVQUFVLENBQUNZLE1BQU0sQ0FBQ0QsYUFBYSxFQUFFMUosRUFBRSxDQUFDO01BQ3RDO0lBQ0YsQ0FBQyxDQUFDOztJQUVGO0lBQ0E7SUFDQTtJQUNBNEosT0FBTyxDQUFDQyxJQUFJLEdBQUdDLElBQUksSUFBSTtNQUNyQmhWLGVBQWUsQ0FBQ3VTLG1CQUFtQixFQUFFO01BRXJDLE1BQU0wQyxlQUFlLEdBQUdMLGFBQWEsSUFBSTtRQUN2QzdVLE1BQU0sQ0FBQzRVLGNBQWMsQ0FDbkJWLFVBQVUsRUFDVlcsYUFBYSxFQUNiL04sTUFBTSxDQUFDcU8sZUFBZSxDQUNwQixNQUFNO1VBQ0osSUFBSW5GLE9BQU8sQ0FBQ2dDLEdBQUcsQ0FBQ29ELHNCQUFzQixFQUFFO1lBQ3RDQyxPQUFPLENBQUNDLEdBQUcsQ0FBQyxXQUFXLENBQUM7VUFDMUI7VUFDQSxNQUFNQyxTQUFTLEdBQUdwQixvQkFBb0I7VUFDdENBLG9CQUFvQixHQUFHLElBQUk7VUFDM0JvQixTQUFTLENBQUM1TCxPQUFPLENBQUN0QixRQUFRLElBQUk7WUFDNUJBLFFBQVEsRUFBRTtVQUNaLENBQUMsQ0FBQztRQUNKLENBQUMsRUFDRDZELENBQUMsSUFBSTtVQUNIbUosT0FBTyxDQUFDcEgsS0FBSyxDQUFDLGtCQUFrQixFQUFFL0IsQ0FBQyxDQUFDO1VBQ3BDbUosT0FBTyxDQUFDcEgsS0FBSyxDQUFDL0IsQ0FBQyxJQUFJQSxDQUFDLENBQUM2RCxLQUFLLENBQUM7UUFDN0IsQ0FBQyxDQUNGLENBQ0Y7TUFDSCxDQUFDO01BRUQsSUFBSXlGLFNBQVMsR0FBR3hGLE9BQU8sQ0FBQ2dDLEdBQUcsQ0FBQ3lELElBQUksSUFBSSxDQUFDO01BQ3JDLElBQUlDLGNBQWMsR0FBRzFGLE9BQU8sQ0FBQ2dDLEdBQUcsQ0FBQzJELGdCQUFnQjtNQUVqRCxJQUFJRCxjQUFjLEVBQUU7UUFDbEIsSUFBSS9ULE9BQU8sQ0FBQ2lVLFFBQVEsRUFBRTtVQUNwQixNQUFNQyxVQUFVLEdBQUdsVSxPQUFPLENBQUNtVSxNQUFNLENBQUM5RixPQUFPLENBQUNnQyxHQUFHLENBQUNwTyxJQUFJLElBQUlqQyxPQUFPLENBQUNtVSxNQUFNLENBQUNDLEVBQUU7VUFDdkVMLGNBQWMsSUFBSSxHQUFHLEdBQUdHLFVBQVUsR0FBRyxPQUFPO1FBQzlDO1FBQ0E7UUFDQXBVLHdCQUF3QixDQUFDaVUsY0FBYyxDQUFDO1FBQ3hDUixlQUFlLENBQUM7VUFBRWxRLElBQUksRUFBRTBRO1FBQWUsQ0FBQyxDQUFDO1FBRXpDLE1BQU1NLHFCQUFxQixHQUFHLENBQzVCaEcsT0FBTyxDQUFDZ0MsR0FBRyxDQUFDaUUsdUJBQXVCLElBQUksRUFBRSxFQUN6Q0MsSUFBSSxFQUFFO1FBQ1IsSUFBSUYscUJBQXFCLEVBQUU7VUFDekIsSUFBSSxZQUFZLENBQUNHLElBQUksQ0FBQ0gscUJBQXFCLENBQUMsRUFBRTtZQUM1QzVWLFNBQVMsQ0FBQ3NWLGNBQWMsRUFBRTVHLFFBQVEsQ0FBQ2tILHFCQUFxQixFQUFFLENBQUMsQ0FBQyxDQUFDO1VBQy9ELENBQUMsTUFBTTtZQUNMLE1BQU0sSUFBSXpQLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQztVQUM5RDtRQUNGO1FBRUEsTUFBTTZQLGVBQWUsR0FBRyxDQUFDcEcsT0FBTyxDQUFDZ0MsR0FBRyxDQUFDcUUsaUJBQWlCLElBQUksRUFBRSxFQUFFSCxJQUFJLEVBQUU7UUFDcEUsSUFBSUUsZUFBZSxFQUFFO1VBQ25CO1VBQ0EsTUFBTUUsbUJBQW1CLEdBQUcxVSxNQUFNLENBQUMyVSxJQUFJLENBQUNDLEtBQUssQ0FBQ0osZUFBZSxDQUFDO1VBQzlELElBQUlFLG1CQUFtQixLQUFLLElBQUksRUFBRTtZQUNoQyxNQUFNLElBQUkvUCxLQUFLLENBQUMsMENBQTBDLENBQUM7VUFDN0Q7VUFDQWxHLFNBQVMsQ0FBQ3FWLGNBQWMsRUFBRW5WLFFBQVEsRUFBRSxDQUFDa1csR0FBRyxFQUFFSCxtQkFBbUIsQ0FBQ0ksR0FBRyxDQUFDO1FBQ3BFO1FBRUFoVix5QkFBeUIsQ0FBQ2dVLGNBQWMsQ0FBQztNQUMzQyxDQUFDLE1BQU07UUFDTEYsU0FBUyxHQUFHeEcsS0FBSyxDQUFDRCxNQUFNLENBQUN5RyxTQUFTLENBQUMsQ0FBQyxHQUFHQSxTQUFTLEdBQUd6RyxNQUFNLENBQUN5RyxTQUFTLENBQUM7UUFDcEUsSUFBSSxvQkFBb0IsQ0FBQ1csSUFBSSxDQUFDWCxTQUFTLENBQUMsRUFBRTtVQUN4QztVQUNBTixlQUFlLENBQUM7WUFBRWxRLElBQUksRUFBRXdRO1VBQVUsQ0FBQyxDQUFDO1FBQ3RDLENBQUMsTUFBTSxJQUFJLE9BQU9BLFNBQVMsS0FBSyxRQUFRLEVBQUU7VUFDeEM7VUFDQU4sZUFBZSxDQUFDO1lBQ2R0RyxJQUFJLEVBQUU0RyxTQUFTO1lBQ2ZtQixJQUFJLEVBQUUzRyxPQUFPLENBQUNnQyxHQUFHLENBQUM0RSxPQUFPLElBQUk7VUFDL0IsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxNQUFNO1VBQ0wsTUFBTSxJQUFJclEsS0FBSyxDQUFDLHdCQUF3QixDQUFDO1FBQzNDO01BQ0Y7TUFFQSxPQUFPLFFBQVE7SUFDakIsQ0FBQztFQUNIO0VBRUEsSUFBSXNGLG9CQUFvQixHQUFHLElBQUk7RUFFL0I1TCxlQUFlLENBQUM0TCxvQkFBb0IsR0FBRyxZQUFXO0lBQ2hELE9BQU9BLG9CQUFvQjtFQUM3QixDQUFDO0VBRUQ1TCxlQUFlLENBQUM0Vyx1QkFBdUIsR0FBRyxVQUFTMVAsS0FBSyxFQUFFO0lBQ3hEMEUsb0JBQW9CLEdBQUcxRSxLQUFLO0lBQzVCbEgsZUFBZSxDQUFDdVMsbUJBQW1CLEVBQUU7RUFDdkMsQ0FBQztFQUVELElBQUk1RyxPQUFPO0VBRVgzTCxlQUFlLENBQUM2VywwQkFBMEIsR0FBRyxZQUFrQztJQUFBLElBQXpCQyxlQUFlLHVFQUFHLEtBQUs7SUFDM0VuTCxPQUFPLEdBQUdtTCxlQUFlLEdBQUcsaUJBQWlCLEdBQUcsV0FBVztJQUMzRDlXLGVBQWUsQ0FBQ3VTLG1CQUFtQixFQUFFO0VBQ3ZDLENBQUM7RUFFRHZTLGVBQWUsQ0FBQytXLDZCQUE2QixHQUFHLFVBQVNDLE1BQU0sRUFBRTtJQUMvRHJVLDBCQUEwQixHQUFHcVUsTUFBTTtJQUNuQ2hYLGVBQWUsQ0FBQ3VTLG1CQUFtQixFQUFFO0VBQ3ZDLENBQUM7RUFFRHZTLGVBQWUsQ0FBQ2lYLHFCQUFxQixHQUFHLFVBQVM3RCxNQUFNLEVBQUU7SUFDdkQsSUFBSThELElBQUksR0FBRyxJQUFJO0lBQ2ZBLElBQUksQ0FBQ0gsNkJBQTZCLENBQUMsVUFBU25VLEdBQUcsRUFBRTtNQUMvQyxPQUFPd1EsTUFBTSxHQUFHeFEsR0FBRztJQUNyQixDQUFDLENBQUM7RUFDSixDQUFDOztFQUVEO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSTJJLGtCQUFrQixHQUFHLENBQUMsQ0FBQztFQUMzQnZMLGVBQWUsQ0FBQ21YLFdBQVcsR0FBRyxVQUFTbFUsUUFBUSxFQUFFO0lBQy9Dc0ksa0JBQWtCLENBQUMsR0FBRyxHQUFHdkksSUFBSSxDQUFDQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBR0EsUUFBUTtFQUM3RCxDQUFDOztFQUVEO0VBQ0FqRCxlQUFlLENBQUN1SSxjQUFjLEdBQUdBLGNBQWM7RUFDL0N2SSxlQUFlLENBQUN1TCxrQkFBa0IsR0FBR0Esa0JBQWtCOztFQUV2RDtFQUNBMkQsZUFBZSxFQUFFO0FBQUMscUI7Ozs7Ozs7Ozs7O0FDajlDbEIzTSxNQUFNLENBQUN6QyxNQUFNLENBQUM7RUFBQ2dCLE9BQU8sRUFBQyxNQUFJQTtBQUFPLENBQUMsQ0FBQztBQUFDLElBQUlzVyxVQUFVO0FBQUM3VSxNQUFNLENBQUM1QyxJQUFJLENBQUMsU0FBUyxFQUFDO0VBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO0lBQUN1WCxVQUFVLEdBQUN2WCxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBRWhHLFNBQVNpQixPQUFPLEdBQWlCO0VBQUEsa0NBQWJ1VyxXQUFXO0lBQVhBLFdBQVc7RUFBQTtFQUNwQyxNQUFNQyxRQUFRLEdBQUdGLFVBQVUsQ0FBQ0csS0FBSyxDQUFDLElBQUksRUFBRUYsV0FBVyxDQUFDO0VBQ3BELE1BQU1HLFdBQVcsR0FBR0YsUUFBUSxDQUFDekUsR0FBRzs7RUFFaEM7RUFDQTtFQUNBeUUsUUFBUSxDQUFDekUsR0FBRyxHQUFHLFNBQVNBLEdBQUcsR0FBYTtJQUFBLG1DQUFUNEUsT0FBTztNQUFQQSxPQUFPO0lBQUE7SUFDcEMsTUFBTTtNQUFFM0g7SUFBTSxDQUFDLEdBQUcsSUFBSTtJQUN0QixNQUFNNEgsY0FBYyxHQUFHNUgsS0FBSyxDQUFDOUwsTUFBTTtJQUNuQyxNQUFNd0csTUFBTSxHQUFHZ04sV0FBVyxDQUFDRCxLQUFLLENBQUMsSUFBSSxFQUFFRSxPQUFPLENBQUM7O0lBRS9DO0lBQ0E7SUFDQTtJQUNBLEtBQUssSUFBSTFULENBQUMsR0FBRzJULGNBQWMsRUFBRTNULENBQUMsR0FBRytMLEtBQUssQ0FBQzlMLE1BQU0sRUFBRSxFQUFFRCxDQUFDLEVBQUU7TUFDbEQsTUFBTTRULEtBQUssR0FBRzdILEtBQUssQ0FBQy9MLENBQUMsQ0FBQztNQUN0QixNQUFNNlQsY0FBYyxHQUFHRCxLQUFLLENBQUNFLE1BQU07TUFFbkMsSUFBSUQsY0FBYyxDQUFDNVQsTUFBTSxJQUFJLENBQUMsRUFBRTtRQUM5QjtRQUNBO1FBQ0E7UUFDQTtRQUNBMlQsS0FBSyxDQUFDRSxNQUFNLEdBQUcsU0FBU0EsTUFBTSxDQUFDL0osR0FBRyxFQUFFeEssR0FBRyxFQUFFQyxHQUFHLEVBQUV5SSxJQUFJLEVBQUU7VUFDbEQsT0FBTzVCLE9BQU8sQ0FBQzBOLFVBQVUsQ0FBQ0YsY0FBYyxFQUFFLElBQUksRUFBRUcsU0FBUyxDQUFDO1FBQzVELENBQUM7TUFDSCxDQUFDLE1BQU07UUFDTEosS0FBSyxDQUFDRSxNQUFNLEdBQUcsU0FBU0EsTUFBTSxDQUFDdlUsR0FBRyxFQUFFQyxHQUFHLEVBQUV5SSxJQUFJLEVBQUU7VUFDN0MsT0FBTzVCLE9BQU8sQ0FBQzBOLFVBQVUsQ0FBQ0YsY0FBYyxFQUFFLElBQUksRUFBRUcsU0FBUyxDQUFDO1FBQzVELENBQUM7TUFDSDtJQUNGO0lBRUEsT0FBT3ZOLE1BQU07RUFDZixDQUFDO0VBRUQsT0FBTzhNLFFBQVE7QUFDakIsQzs7Ozs7Ozs7Ozs7QUN2Q0EvVSxNQUFNLENBQUN6QyxNQUFNLENBQUM7RUFBQzBCLHdCQUF3QixFQUFDLE1BQUlBLHdCQUF3QjtFQUFDQyx5QkFBeUIsRUFBQyxNQUFJQTtBQUF5QixDQUFDLENBQUM7QUFBQyxJQUFJdVcsUUFBUSxFQUFDQyxVQUFVLEVBQUNDLFVBQVU7QUFBQzNWLE1BQU0sQ0FBQzVDLElBQUksQ0FBQyxJQUFJLEVBQUM7RUFBQ3FZLFFBQVEsQ0FBQ25ZLENBQUMsRUFBQztJQUFDbVksUUFBUSxHQUFDblksQ0FBQztFQUFBLENBQUM7RUFBQ29ZLFVBQVUsQ0FBQ3BZLENBQUMsRUFBQztJQUFDb1ksVUFBVSxHQUFDcFksQ0FBQztFQUFBLENBQUM7RUFBQ3FZLFVBQVUsQ0FBQ3JZLENBQUMsRUFBQztJQUFDcVksVUFBVSxHQUFDclksQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQXlCaFEsTUFBTTJCLHdCQUF3QixHQUFJMlcsVUFBVSxJQUFLO0VBQ3RELElBQUk7SUFDRixJQUFJSCxRQUFRLENBQUNHLFVBQVUsQ0FBQyxDQUFDQyxRQUFRLEVBQUUsRUFBRTtNQUNuQztNQUNBO01BQ0FILFVBQVUsQ0FBQ0UsVUFBVSxDQUFDO0lBQ3hCLENBQUMsTUFBTTtNQUNMLE1BQU0sSUFBSTdSLEtBQUssQ0FDYiwwQ0FBa0M2UixVQUFVLHlCQUM1Qyw4REFBOEQsR0FDOUQsMkJBQTJCLENBQzVCO0lBQ0g7RUFDRixDQUFDLENBQUMsT0FBT25LLEtBQUssRUFBRTtJQUNkO0lBQ0E7SUFDQTtJQUNBLElBQUlBLEtBQUssQ0FBQ3NDLElBQUksS0FBSyxRQUFRLEVBQUU7TUFDM0IsTUFBTXRDLEtBQUs7SUFDYjtFQUNGO0FBQ0YsQ0FBQztBQUtNLE1BQU12TSx5QkFBeUIsR0FDcEMsVUFBQzBXLFVBQVUsRUFBNkI7RUFBQSxJQUEzQkUsWUFBWSx1RUFBR3RJLE9BQU87RUFDakMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQ3JHLE9BQU8sQ0FBQzRPLE1BQU0sSUFBSTtJQUN4REQsWUFBWSxDQUFDdlEsRUFBRSxDQUFDd1EsTUFBTSxFQUFFelIsTUFBTSxDQUFDcU8sZUFBZSxDQUFDLE1BQU07TUFDbkQsSUFBSWdELFVBQVUsQ0FBQ0MsVUFBVSxDQUFDLEVBQUU7UUFDMUJGLFVBQVUsQ0FBQ0UsVUFBVSxDQUFDO01BQ3hCO0lBQ0YsQ0FBQyxDQUFDLENBQUM7RUFDTCxDQUFDLENBQUM7QUFDSixDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL3dlYmFwcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgY2htb2RTeW5jLCBjaG93blN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBjcmVhdGVTZXJ2ZXIgfSBmcm9tICdodHRwJztcbmltcG9ydCB7IHVzZXJJbmZvIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgam9pbiBhcyBwYXRoSm9pbiwgZGlybmFtZSBhcyBwYXRoRGlybmFtZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VVcmwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBjb25uZWN0IH0gZnJvbSAnLi9jb25uZWN0LmpzJztcbmltcG9ydCBjb21wcmVzcyBmcm9tICdjb21wcmVzc2lvbic7XG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gJ2Nvb2tpZS1wYXJzZXInO1xuaW1wb3J0IHFzIGZyb20gJ3FzJztcbmltcG9ydCBwYXJzZVJlcXVlc3QgZnJvbSAncGFyc2V1cmwnO1xuaW1wb3J0IGJhc2ljQXV0aCBmcm9tICdiYXNpYy1hdXRoLWNvbm5lY3QnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cFVzZXJBZ2VudCB9IGZyb20gJ3VzZXJhZ2VudCc7XG5pbXBvcnQgeyBpc01vZGVybiB9IGZyb20gJ21ldGVvci9tb2Rlcm4tYnJvd3NlcnMnO1xuaW1wb3J0IHNlbmQgZnJvbSAnc2VuZCc7XG5pbXBvcnQge1xuICByZW1vdmVFeGlzdGluZ1NvY2tldEZpbGUsXG4gIHJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAsXG59IGZyb20gJy4vc29ja2V0X2ZpbGUuanMnO1xuaW1wb3J0IGNsdXN0ZXIgZnJvbSAnY2x1c3Rlcic7XG5pbXBvcnQgd2hvbXN0IGZyb20gJ0B2bGFza3kvd2hvbXN0JztcblxudmFyIFNIT1JUX1NPQ0tFVF9USU1FT1VUID0gNSAqIDEwMDA7XG52YXIgTE9OR19TT0NLRVRfVElNRU9VVCA9IDEyMCAqIDEwMDA7XG5cbmV4cG9ydCBjb25zdCBXZWJBcHAgPSB7fTtcbmV4cG9ydCBjb25zdCBXZWJBcHBJbnRlcm5hbHMgPSB7fTtcblxuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLy8gYmFja3dhcmRzIGNvbXBhdCB0byAyLjAgb2YgY29ubmVjdFxuY29ubmVjdC5iYXNpY0F1dGggPSBiYXNpY0F1dGg7XG5cbldlYkFwcEludGVybmFscy5OcG1Nb2R1bGVzID0ge1xuICBjb25uZWN0OiB7XG4gICAgdmVyc2lvbjogTnBtLnJlcXVpcmUoJ2Nvbm5lY3QvcGFja2FnZS5qc29uJykudmVyc2lvbixcbiAgICBtb2R1bGU6IGNvbm5lY3QsXG4gIH0sXG59O1xuXG4vLyBUaG91Z2ggd2UgbWlnaHQgcHJlZmVyIHRvIHVzZSB3ZWIuYnJvd3NlciAobW9kZXJuKSBhcyB0aGUgZGVmYXVsdFxuLy8gYXJjaGl0ZWN0dXJlLCBzYWZldHkgcmVxdWlyZXMgYSBtb3JlIGNvbXBhdGlibGUgZGVmYXVsdEFyY2guXG5XZWJBcHAuZGVmYXVsdEFyY2ggPSAnd2ViLmJyb3dzZXIubGVnYWN5JztcblxuLy8gWFhYIG1hcHMgYXJjaHMgdG8gbWFuaWZlc3RzXG5XZWJBcHAuY2xpZW50UHJvZ3JhbXMgPSB7fTtcblxuLy8gWFhYIG1hcHMgYXJjaHMgdG8gcHJvZ3JhbSBwYXRoIG9uIGZpbGVzeXN0ZW1cbnZhciBhcmNoUGF0aCA9IHt9O1xuXG52YXIgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBmdW5jdGlvbih1cmwpIHtcbiAgdmFyIGJ1bmRsZWRQcmVmaXggPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYIHx8ICcnO1xuICByZXR1cm4gYnVuZGxlZFByZWZpeCArIHVybDtcbn07XG5cbnZhciBzaGExID0gZnVuY3Rpb24oY29udGVudHMpIHtcbiAgdmFyIGhhc2ggPSBjcmVhdGVIYXNoKCdzaGExJyk7XG4gIGhhc2gudXBkYXRlKGNvbnRlbnRzKTtcbiAgcmV0dXJuIGhhc2guZGlnZXN0KCdoZXgnKTtcbn07XG5cbmZ1bmN0aW9uIHNob3VsZENvbXByZXNzKHJlcSwgcmVzKSB7XG4gIGlmIChyZXEuaGVhZGVyc1sneC1uby1jb21wcmVzc2lvbiddKSB7XG4gICAgLy8gZG9uJ3QgY29tcHJlc3MgcmVzcG9uc2VzIHdpdGggdGhpcyByZXF1ZXN0IGhlYWRlclxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIGZhbGxiYWNrIHRvIHN0YW5kYXJkIGZpbHRlciBmdW5jdGlvblxuICByZXR1cm4gY29tcHJlc3MuZmlsdGVyKHJlcSwgcmVzKTtcbn1cblxuLy8gI0Jyb3dzZXJJZGVudGlmaWNhdGlvblxuLy9cbi8vIFdlIGhhdmUgbXVsdGlwbGUgcGxhY2VzIHRoYXQgd2FudCB0byBpZGVudGlmeSB0aGUgYnJvd3NlcjogdGhlXG4vLyB1bnN1cHBvcnRlZCBicm93c2VyIHBhZ2UsIHRoZSBhcHBjYWNoZSBwYWNrYWdlLCBhbmQsIGV2ZW50dWFsbHlcbi8vIGRlbGl2ZXJpbmcgYnJvd3NlciBwb2x5ZmlsbHMgb25seSBhcyBuZWVkZWQuXG4vL1xuLy8gVG8gYXZvaWQgZGV0ZWN0aW5nIHRoZSBicm93c2VyIGluIG11bHRpcGxlIHBsYWNlcyBhZC1ob2MsIHdlIGNyZWF0ZSBhXG4vLyBNZXRlb3IgXCJicm93c2VyXCIgb2JqZWN0LiBJdCB1c2VzIGJ1dCBkb2VzIG5vdCBleHBvc2UgdGhlIG5wbVxuLy8gdXNlcmFnZW50IG1vZHVsZSAod2UgY291bGQgY2hvb3NlIGEgZGlmZmVyZW50IG1lY2hhbmlzbSB0byBpZGVudGlmeVxuLy8gdGhlIGJyb3dzZXIgaW4gdGhlIGZ1dHVyZSBpZiB3ZSB3YW50ZWQgdG8pLiAgVGhlIGJyb3dzZXIgb2JqZWN0XG4vLyBjb250YWluc1xuLy9cbi8vICogYG5hbWVgOiB0aGUgbmFtZSBvZiB0aGUgYnJvd3NlciBpbiBjYW1lbCBjYXNlXG4vLyAqIGBtYWpvcmAsIGBtaW5vcmAsIGBwYXRjaGA6IGludGVnZXJzIGRlc2NyaWJpbmcgdGhlIGJyb3dzZXIgdmVyc2lvblxuLy9cbi8vIEFsc28gaGVyZSBpcyBhbiBlYXJseSB2ZXJzaW9uIG9mIGEgTWV0ZW9yIGByZXF1ZXN0YCBvYmplY3QsIGludGVuZGVkXG4vLyB0byBiZSBhIGhpZ2gtbGV2ZWwgZGVzY3JpcHRpb24gb2YgdGhlIHJlcXVlc3Qgd2l0aG91dCBleHBvc2luZ1xuLy8gZGV0YWlscyBvZiBjb25uZWN0J3MgbG93LWxldmVsIGByZXFgLiAgQ3VycmVudGx5IGl0IGNvbnRhaW5zOlxuLy9cbi8vICogYGJyb3dzZXJgOiBicm93c2VyIGlkZW50aWZpY2F0aW9uIG9iamVjdCBkZXNjcmliZWQgYWJvdmVcbi8vICogYHVybGA6IHBhcnNlZCB1cmwsIGluY2x1ZGluZyBwYXJzZWQgcXVlcnkgcGFyYW1zXG4vL1xuLy8gQXMgYSB0ZW1wb3JhcnkgaGFjayB0aGVyZSBpcyBhIGBjYXRlZ29yaXplUmVxdWVzdGAgZnVuY3Rpb24gb24gV2ViQXBwIHdoaWNoXG4vLyBjb252ZXJ0cyBhIGNvbm5lY3QgYHJlcWAgdG8gYSBNZXRlb3IgYHJlcXVlc3RgLiBUaGlzIGNhbiBnbyBhd2F5IG9uY2Ugc21hcnRcbi8vIHBhY2thZ2VzIHN1Y2ggYXMgYXBwY2FjaGUgYXJlIGJlaW5nIHBhc3NlZCBhIGByZXF1ZXN0YCBvYmplY3QgZGlyZWN0bHkgd2hlblxuLy8gdGhleSBzZXJ2ZSBjb250ZW50LlxuLy9cbi8vIFRoaXMgYWxsb3dzIGByZXF1ZXN0YCB0byBiZSB1c2VkIHVuaWZvcm1seTogaXQgaXMgcGFzc2VkIHRvIHRoZSBodG1sXG4vLyBhdHRyaWJ1dGVzIGhvb2ssIGFuZCB0aGUgYXBwY2FjaGUgcGFja2FnZSBjYW4gdXNlIGl0IHdoZW4gZGVjaWRpbmdcbi8vIHdoZXRoZXIgdG8gZ2VuZXJhdGUgYSA0MDQgZm9yIHRoZSBtYW5pZmVzdC5cbi8vXG4vLyBSZWFsIHJvdXRpbmcgLyBzZXJ2ZXIgc2lkZSByZW5kZXJpbmcgd2lsbCBwcm9iYWJseSByZWZhY3RvciB0aGlzXG4vLyBoZWF2aWx5LlxuXG4vLyBlLmcuIFwiTW9iaWxlIFNhZmFyaVwiID0+IFwibW9iaWxlU2FmYXJpXCJcbnZhciBjYW1lbENhc2UgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJyAnKTtcbiAgcGFydHNbMF0gPSBwYXJ0c1swXS50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKHZhciBpID0gMTsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgcGFydHNbaV0gPSBwYXJ0c1tpXS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHBhcnRzW2ldLnN1YnN0cigxKTtcbiAgfVxuICByZXR1cm4gcGFydHMuam9pbignJyk7XG59O1xuXG52YXIgaWRlbnRpZnlCcm93c2VyID0gZnVuY3Rpb24odXNlckFnZW50U3RyaW5nKSB7XG4gIHZhciB1c2VyQWdlbnQgPSBsb29rdXBVc2VyQWdlbnQodXNlckFnZW50U3RyaW5nKTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBjYW1lbENhc2UodXNlckFnZW50LmZhbWlseSksXG4gICAgbWFqb3I6ICt1c2VyQWdlbnQubWFqb3IsXG4gICAgbWlub3I6ICt1c2VyQWdlbnQubWlub3IsXG4gICAgcGF0Y2g6ICt1c2VyQWdlbnQucGF0Y2gsXG4gIH07XG59O1xuXG4vLyBYWFggUmVmYWN0b3IgYXMgcGFydCBvZiBpbXBsZW1lbnRpbmcgcmVhbCByb3V0aW5nLlxuV2ViQXBwSW50ZXJuYWxzLmlkZW50aWZ5QnJvd3NlciA9IGlkZW50aWZ5QnJvd3NlcjtcblxuV2ViQXBwLmNhdGVnb3JpemVSZXF1ZXN0ID0gZnVuY3Rpb24ocmVxKSB7XG4gIGlmIChyZXEuYnJvd3NlciAmJiByZXEuYXJjaCAmJiB0eXBlb2YgcmVxLm1vZGVybiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgLy8gQWxyZWFkeSBjYXRlZ29yaXplZC5cbiAgICByZXR1cm4gcmVxO1xuICB9XG5cbiAgY29uc3QgYnJvd3NlciA9IGlkZW50aWZ5QnJvd3NlcihyZXEuaGVhZGVyc1sndXNlci1hZ2VudCddKTtcbiAgY29uc3QgbW9kZXJuID0gaXNNb2Rlcm4oYnJvd3Nlcik7XG4gIGNvbnN0IHBhdGggPVxuICAgIHR5cGVvZiByZXEucGF0aG5hbWUgPT09ICdzdHJpbmcnXG4gICAgICA/IHJlcS5wYXRobmFtZVxuICAgICAgOiBwYXJzZVJlcXVlc3QocmVxKS5wYXRobmFtZTtcblxuICBjb25zdCBjYXRlZ29yaXplZCA9IHtcbiAgICBicm93c2VyLFxuICAgIG1vZGVybixcbiAgICBwYXRoLFxuICAgIGFyY2g6IFdlYkFwcC5kZWZhdWx0QXJjaCxcbiAgICB1cmw6IHBhcnNlVXJsKHJlcS51cmwsIHRydWUpLFxuICAgIGR5bmFtaWNIZWFkOiByZXEuZHluYW1pY0hlYWQsXG4gICAgZHluYW1pY0JvZHk6IHJlcS5keW5hbWljQm9keSxcbiAgICBoZWFkZXJzOiByZXEuaGVhZGVycyxcbiAgICBjb29raWVzOiByZXEuY29va2llcyxcbiAgfTtcblxuICBjb25zdCBwYXRoUGFydHMgPSBwYXRoLnNwbGl0KCcvJyk7XG4gIGNvbnN0IGFyY2hLZXkgPSBwYXRoUGFydHNbMV07XG5cbiAgaWYgKGFyY2hLZXkuc3RhcnRzV2l0aCgnX18nKSkge1xuICAgIGNvbnN0IGFyY2hDbGVhbmVkID0gJ3dlYi4nICsgYXJjaEtleS5zbGljZSgyKTtcbiAgICBpZiAoaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoQ2xlYW5lZCkpIHtcbiAgICAgIHBhdGhQYXJ0cy5zcGxpY2UoMSwgMSk7IC8vIFJlbW92ZSB0aGUgYXJjaEtleSBwYXJ0LlxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oY2F0ZWdvcml6ZWQsIHtcbiAgICAgICAgYXJjaDogYXJjaENsZWFuZWQsXG4gICAgICAgIHBhdGg6IHBhdGhQYXJ0cy5qb2luKCcvJyksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPIFBlcmhhcHMgb25lIGRheSB3ZSBjb3VsZCBpbmZlciBDb3Jkb3ZhIGNsaWVudHMgaGVyZSwgc28gdGhhdCB3ZVxuICAvLyB3b3VsZG4ndCBoYXZlIHRvIHVzZSBwcmVmaXhlZCBcIi9fX2NvcmRvdmEvLi4uXCIgVVJMcy5cbiAgY29uc3QgcHJlZmVycmVkQXJjaE9yZGVyID0gaXNNb2Rlcm4oYnJvd3NlcilcbiAgICA/IFsnd2ViLmJyb3dzZXInLCAnd2ViLmJyb3dzZXIubGVnYWN5J11cbiAgICA6IFsnd2ViLmJyb3dzZXIubGVnYWN5JywgJ3dlYi5icm93c2VyJ107XG5cbiAgZm9yIChjb25zdCBhcmNoIG9mIHByZWZlcnJlZEFyY2hPcmRlcikge1xuICAgIC8vIElmIG91ciBwcmVmZXJyZWQgYXJjaCBpcyBub3QgYXZhaWxhYmxlLCBpdCdzIGJldHRlciB0byB1c2UgYW5vdGhlclxuICAgIC8vIGNsaWVudCBhcmNoIHRoYXQgaXMgYXZhaWxhYmxlIHRoYW4gdG8gZ3VhcmFudGVlIHRoZSBzaXRlIHdvbid0IHdvcmtcbiAgICAvLyBieSByZXR1cm5pbmcgYW4gdW5rbm93biBhcmNoLiBGb3IgZXhhbXBsZSwgaWYgd2ViLmJyb3dzZXIubGVnYWN5IGlzXG4gICAgLy8gZXhjbHVkZWQgdXNpbmcgdGhlIC0tZXhjbHVkZS1hcmNocyBjb21tYW5kLWxpbmUgb3B0aW9uLCBsZWdhY3lcbiAgICAvLyBjbGllbnRzIGFyZSBiZXR0ZXIgb2ZmIHJlY2VpdmluZyB3ZWIuYnJvd3NlciAod2hpY2ggbWlnaHQgYWN0dWFsbHlcbiAgICAvLyB3b3JrKSB0aGFuIHJlY2VpdmluZyBhbiBIVFRQIDQwNCByZXNwb25zZS4gSWYgbm9uZSBvZiB0aGUgYXJjaHMgaW5cbiAgICAvLyBwcmVmZXJyZWRBcmNoT3JkZXIgYXJlIGRlZmluZWQsIG9ubHkgdGhlbiBzaG91bGQgd2Ugc2VuZCBhIDQwNC5cbiAgICBpZiAoaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oY2F0ZWdvcml6ZWQsIHsgYXJjaCB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY2F0ZWdvcml6ZWQ7XG59O1xuXG4vLyBIVE1MIGF0dHJpYnV0ZSBob29rczogZnVuY3Rpb25zIHRvIGJlIGNhbGxlZCB0byBkZXRlcm1pbmUgYW55IGF0dHJpYnV0ZXMgdG9cbi8vIGJlIGFkZGVkIHRvIHRoZSAnPGh0bWw+JyB0YWcuIEVhY2ggZnVuY3Rpb24gaXMgcGFzc2VkIGEgJ3JlcXVlc3QnIG9iamVjdCAoc2VlXG4vLyAjQnJvd3NlcklkZW50aWZpY2F0aW9uKSBhbmQgc2hvdWxkIHJldHVybiBudWxsIG9yIG9iamVjdC5cbnZhciBodG1sQXR0cmlidXRlSG9va3MgPSBbXTtcbnZhciBnZXRIdG1sQXR0cmlidXRlcyA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIGNvbWJpbmVkQXR0cmlidXRlcyA9IHt9O1xuICBfLmVhY2goaHRtbEF0dHJpYnV0ZUhvb2tzIHx8IFtdLCBmdW5jdGlvbihob29rKSB7XG4gICAgdmFyIGF0dHJpYnV0ZXMgPSBob29rKHJlcXVlc3QpO1xuICAgIGlmIChhdHRyaWJ1dGVzID09PSBudWxsKSByZXR1cm47XG4gICAgaWYgKHR5cGVvZiBhdHRyaWJ1dGVzICE9PSAnb2JqZWN0JylcbiAgICAgIHRocm93IEVycm9yKCdIVE1MIGF0dHJpYnV0ZSBob29rIG11c3QgcmV0dXJuIG51bGwgb3Igb2JqZWN0Jyk7XG4gICAgXy5leHRlbmQoY29tYmluZWRBdHRyaWJ1dGVzLCBhdHRyaWJ1dGVzKTtcbiAgfSk7XG4gIHJldHVybiBjb21iaW5lZEF0dHJpYnV0ZXM7XG59O1xuV2ViQXBwLmFkZEh0bWxBdHRyaWJ1dGVIb29rID0gZnVuY3Rpb24oaG9vaykge1xuICBodG1sQXR0cmlidXRlSG9va3MucHVzaChob29rKTtcbn07XG5cbi8vIFNlcnZlIGFwcCBIVE1MIGZvciB0aGlzIFVSTD9cbnZhciBhcHBVcmwgPSBmdW5jdGlvbih1cmwpIHtcbiAgaWYgKHVybCA9PT0gJy9mYXZpY29uLmljbycgfHwgdXJsID09PSAnL3JvYm90cy50eHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTk9URTogYXBwLm1hbmlmZXN0IGlzIG5vdCBhIHdlYiBzdGFuZGFyZCBsaWtlIGZhdmljb24uaWNvIGFuZFxuICAvLyByb2JvdHMudHh0LiBJdCBpcyBhIGZpbGUgbmFtZSB3ZSBoYXZlIGNob3NlbiB0byB1c2UgZm9yIEhUTUw1XG4gIC8vIGFwcGNhY2hlIFVSTHMuIEl0IGlzIGluY2x1ZGVkIGhlcmUgdG8gcHJldmVudCB1c2luZyBhbiBhcHBjYWNoZVxuICAvLyB0aGVuIHJlbW92aW5nIGl0IGZyb20gcG9pc29uaW5nIGFuIGFwcCBwZXJtYW5lbnRseS4gRXZlbnR1YWxseSxcbiAgLy8gb25jZSB3ZSBoYXZlIHNlcnZlciBzaWRlIHJvdXRpbmcsIHRoaXMgd29uJ3QgYmUgbmVlZGVkIGFzXG4gIC8vIHVua25vd24gVVJMcyB3aXRoIHJldHVybiBhIDQwNCBhdXRvbWF0aWNhbGx5LlxuICBpZiAodXJsID09PSAnL2FwcC5tYW5pZmVzdCcpIHJldHVybiBmYWxzZTtcblxuICAvLyBBdm9pZCBzZXJ2aW5nIGFwcCBIVE1MIGZvciBkZWNsYXJlZCByb3V0ZXMgc3VjaCBhcyAvc29ja2pzLy5cbiAgaWYgKFJvdXRlUG9saWN5LmNsYXNzaWZ5KHVybCkpIHJldHVybiBmYWxzZTtcblxuICAvLyB3ZSBjdXJyZW50bHkgcmV0dXJuIGFwcCBIVE1MIG9uIGFsbCBVUkxzIGJ5IGRlZmF1bHRcbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyBXZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgY2xpZW50IGhhc2ggYWZ0ZXIgYWxsIHBhY2thZ2VzIGhhdmUgbG9hZGVkXG4vLyB0byBnaXZlIHRoZW0gYSBjaGFuY2UgdG8gcG9wdWxhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5cbi8vXG4vLyBDYWxjdWxhdGluZyB0aGUgaGFzaCBkdXJpbmcgc3RhcnR1cCBtZWFucyB0aGF0IHBhY2thZ2VzIGNhbiBvbmx5XG4vLyBwb3B1bGF0ZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIGR1cmluZyBsb2FkLCBub3QgZHVyaW5nIHN0YXJ0dXAuXG4vL1xuLy8gQ2FsY3VsYXRpbmcgaW5zdGVhZCBpdCBhdCB0aGUgYmVnaW5uaW5nIG9mIG1haW4gYWZ0ZXIgYWxsIHN0YXJ0dXBcbi8vIGhvb2tzIGhhZCBydW4gd291bGQgYWxsb3cgcGFja2FnZXMgdG8gYWxzbyBwb3B1bGF0ZVxuLy8gX19tZXRlb3JfcnVudGltZV9jb25maWdfXyBkdXJpbmcgc3RhcnR1cCwgYnV0IHRoYXQncyB0b28gbGF0ZSBmb3Jcbi8vIGF1dG91cGRhdGUgYmVjYXVzZSBpdCBuZWVkcyB0byBoYXZlIHRoZSBjbGllbnQgaGFzaCBhdCBzdGFydHVwIHRvXG4vLyBpbnNlcnQgdGhlIGF1dG8gdXBkYXRlIHZlcnNpb24gaXRzZWxmIGludG9cbi8vIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gdG8gZ2V0IGl0IHRvIHRoZSBjbGllbnQuXG4vL1xuLy8gQW4gYWx0ZXJuYXRpdmUgd291bGQgYmUgdG8gZ2l2ZSBhdXRvdXBkYXRlIGEgXCJwb3N0LXN0YXJ0LFxuLy8gcHJlLWxpc3RlblwiIGhvb2sgdG8gYWxsb3cgaXQgdG8gaW5zZXJ0IHRoZSBhdXRvIHVwZGF0ZSB2ZXJzaW9uIGF0XG4vLyB0aGUgcmlnaHQgbW9tZW50LlxuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gZ2V0dGVyKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihhcmNoKSB7XG4gICAgICBhcmNoID0gYXJjaCB8fCBXZWJBcHAuZGVmYXVsdEFyY2g7XG4gICAgICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgICAgY29uc3QgdmFsdWUgPSBwcm9ncmFtICYmIHByb2dyYW1ba2V5XTtcbiAgICAgIC8vIElmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgd2UgaGF2ZSBjYWxjdWxhdGVkIHRoaXMgaGFzaCxcbiAgICAgIC8vIHByb2dyYW1ba2V5XSB3aWxsIGJlIGEgdGh1bmsgKGxhenkgZnVuY3Rpb24gd2l0aCBubyBwYXJhbWV0ZXJzKVxuICAgICAgLy8gdGhhdCB3ZSBzaG91bGQgY2FsbCB0byBkbyB0aGUgYWN0dWFsIGNvbXB1dGF0aW9uLlxuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IChwcm9ncmFtW2tleV0gPSB2YWx1ZSgpKSA6IHZhbHVlO1xuICAgIH07XG4gIH1cblxuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaCA9IFdlYkFwcC5jbGllbnRIYXNoID0gZ2V0dGVyKCd2ZXJzaW9uJyk7XG4gIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUgPSBnZXR0ZXIoJ3ZlcnNpb25SZWZyZXNoYWJsZScpO1xuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlID0gZ2V0dGVyKCd2ZXJzaW9uTm9uUmVmcmVzaGFibGUnKTtcbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZSA9IGdldHRlcigndmVyc2lvblJlcGxhY2VhYmxlJyk7XG4gIFdlYkFwcC5nZXRSZWZyZXNoYWJsZUFzc2V0cyA9IGdldHRlcigncmVmcmVzaGFibGVBc3NldHMnKTtcbn0pO1xuXG4vLyBXaGVuIHdlIGhhdmUgYSByZXF1ZXN0IHBlbmRpbmcsIHdlIHdhbnQgdGhlIHNvY2tldCB0aW1lb3V0IHRvIGJlIGxvbmcsIHRvXG4vLyBnaXZlIG91cnNlbHZlcyBhIHdoaWxlIHRvIHNlcnZlIGl0LCBhbmQgdG8gYWxsb3cgc29ja2pzIGxvbmcgcG9sbHMgdG9cbi8vIGNvbXBsZXRlLiAgT24gdGhlIG90aGVyIGhhbmQsIHdlIHdhbnQgdG8gY2xvc2UgaWRsZSBzb2NrZXRzIHJlbGF0aXZlbHlcbi8vIHF1aWNrbHksIHNvIHRoYXQgd2UgY2FuIHNodXQgZG93biByZWxhdGl2ZWx5IHByb21wdGx5IGJ1dCBjbGVhbmx5LCB3aXRob3V0XG4vLyBjdXR0aW5nIG9mZiBhbnlvbmUncyByZXNwb25zZS5cbldlYkFwcC5fdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2sgPSBmdW5jdGlvbihyZXEsIHJlcykge1xuICAvLyB0aGlzIGlzIHJlYWxseSBqdXN0IHJlcS5zb2NrZXQuc2V0VGltZW91dChMT05HX1NPQ0tFVF9USU1FT1VUKTtcbiAgcmVxLnNldFRpbWVvdXQoTE9OR19TT0NLRVRfVElNRU9VVCk7XG4gIC8vIEluc2VydCBvdXIgbmV3IGZpbmlzaCBsaXN0ZW5lciB0byBydW4gQkVGT1JFIHRoZSBleGlzdGluZyBvbmUgd2hpY2ggcmVtb3Zlc1xuICAvLyB0aGUgcmVzcG9uc2UgZnJvbSB0aGUgc29ja2V0LlxuICB2YXIgZmluaXNoTGlzdGVuZXJzID0gcmVzLmxpc3RlbmVycygnZmluaXNoJyk7XG4gIC8vIFhYWCBBcHBhcmVudGx5IGluIE5vZGUgMC4xMiB0aGlzIGV2ZW50IHdhcyBjYWxsZWQgJ3ByZWZpbmlzaCcuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9jb21taXQvN2M5YjYwNzBcbiAgLy8gQnV0IGl0IGhhcyBzd2l0Y2hlZCBiYWNrIHRvICdmaW5pc2gnIGluIE5vZGUgdjQ6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzE0MTFcbiAgcmVzLnJlbW92ZUFsbExpc3RlbmVycygnZmluaXNoJyk7XG4gIHJlcy5vbignZmluaXNoJywgZnVuY3Rpb24oKSB7XG4gICAgcmVzLnNldFRpbWVvdXQoU0hPUlRfU09DS0VUX1RJTUVPVVQpO1xuICB9KTtcbiAgXy5lYWNoKGZpbmlzaExpc3RlbmVycywgZnVuY3Rpb24obCkge1xuICAgIHJlcy5vbignZmluaXNoJywgbCk7XG4gIH0pO1xufTtcblxuLy8gV2lsbCBiZSB1cGRhdGVkIGJ5IG1haW4gYmVmb3JlIHdlIGxpc3Rlbi5cbi8vIE1hcCBmcm9tIGNsaWVudCBhcmNoIHRvIGJvaWxlcnBsYXRlIG9iamVjdC5cbi8vIEJvaWxlcnBsYXRlIG9iamVjdCBoYXM6XG4vLyAgIC0gZnVuYzogWFhYXG4vLyAgIC0gYmFzZURhdGE6IFhYWFxudmFyIGJvaWxlcnBsYXRlQnlBcmNoID0ge307XG5cbi8vIFJlZ2lzdGVyIGEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBjYW4gc2VsZWN0aXZlbHkgbW9kaWZ5IGJvaWxlcnBsYXRlXG4vLyBkYXRhIGdpdmVuIGFyZ3VtZW50cyAocmVxdWVzdCwgZGF0YSwgYXJjaCkuIFRoZSBrZXkgc2hvdWxkIGJlIGEgdW5pcXVlXG4vLyBpZGVudGlmaWVyLCB0byBwcmV2ZW50IGFjY3VtdWxhdGluZyBkdXBsaWNhdGUgY2FsbGJhY2tzIGZyb20gdGhlIHNhbWVcbi8vIGNhbGwgc2l0ZSBvdmVyIHRpbWUuIENhbGxiYWNrcyB3aWxsIGJlIGNhbGxlZCBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlXG4vLyByZWdpc3RlcmVkLiBBIGNhbGxiYWNrIHNob3VsZCByZXR1cm4gZmFsc2UgaWYgaXQgZGlkIG5vdCBtYWtlIGFueVxuLy8gY2hhbmdlcyBhZmZlY3RpbmcgdGhlIGJvaWxlcnBsYXRlLiBQYXNzaW5nIG51bGwgZGVsZXRlcyB0aGUgY2FsbGJhY2suXG4vLyBBbnkgcHJldmlvdXMgY2FsbGJhY2sgcmVnaXN0ZXJlZCBmb3IgdGhpcyBrZXkgd2lsbCBiZSByZXR1cm5lZC5cbmNvbnN0IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5XZWJBcHBJbnRlcm5hbHMucmVnaXN0ZXJCb2lsZXJwbGF0ZURhdGFDYWxsYmFjayA9IGZ1bmN0aW9uKGtleSwgY2FsbGJhY2spIHtcbiAgY29uc3QgcHJldmlvdXNDYWxsYmFjayA9IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XSA9IGNhbGxiYWNrO1xuICB9IGVsc2Uge1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsYmFjaywgbnVsbCk7XG4gICAgZGVsZXRlIGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuICB9XG5cbiAgLy8gUmV0dXJuIHRoZSBwcmV2aW91cyBjYWxsYmFjayBpbiBjYXNlIHRoZSBuZXcgY2FsbGJhY2sgbmVlZHMgdG8gY2FsbFxuICAvLyBpdDsgZm9yIGV4YW1wbGUsIHdoZW4gdGhlIG5ldyBjYWxsYmFjayBpcyBhIHdyYXBwZXIgZm9yIHRoZSBvbGQuXG4gIHJldHVybiBwcmV2aW91c0NhbGxiYWNrIHx8IG51bGw7XG59O1xuXG4vLyBHaXZlbiBhIHJlcXVlc3QgKGFzIHJldHVybmVkIGZyb20gYGNhdGVnb3JpemVSZXF1ZXN0YCksIHJldHVybiB0aGVcbi8vIGJvaWxlcnBsYXRlIEhUTUwgdG8gc2VydmUgZm9yIHRoYXQgcmVxdWVzdC5cbi8vXG4vLyBJZiBhIHByZXZpb3VzIGNvbm5lY3QgbWlkZGxld2FyZSBoYXMgcmVuZGVyZWQgY29udGVudCBmb3IgdGhlIGhlYWQgb3IgYm9keSxcbi8vIHJldHVybnMgdGhlIGJvaWxlcnBsYXRlIHdpdGggdGhhdCBjb250ZW50IHBhdGNoZWQgaW4gb3RoZXJ3aXNlXG4vLyBtZW1vaXplcyBvbiBIVE1MIGF0dHJpYnV0ZXMgKHVzZWQgYnksIGVnLCBhcHBjYWNoZSkgYW5kIHdoZXRoZXIgaW5saW5lXG4vLyBzY3JpcHRzIGFyZSBjdXJyZW50bHkgYWxsb3dlZC5cbi8vIFhYWCBzbyBmYXIgdGhpcyBmdW5jdGlvbiBpcyBhbHdheXMgY2FsbGVkIHdpdGggYXJjaCA9PT0gJ3dlYi5icm93c2VyJ1xuZnVuY3Rpb24gZ2V0Qm9pbGVycGxhdGUocmVxdWVzdCwgYXJjaCkge1xuICByZXR1cm4gZ2V0Qm9pbGVycGxhdGVBc3luYyhyZXF1ZXN0LCBhcmNoKS5hd2FpdCgpO1xufVxuXG4vKipcbiAqIEBzdW1tYXJ5IFRha2VzIGEgcnVudGltZSBjb25maWd1cmF0aW9uIG9iamVjdCBhbmRcbiAqIHJldHVybnMgYW4gZW5jb2RlZCBydW50aW1lIHN0cmluZy5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBydGltZUNvbmZpZ1xuICogQHJldHVybnMge1N0cmluZ31cbiAqL1xuV2ViQXBwLmVuY29kZVJ1bnRpbWVDb25maWcgPSBmdW5jdGlvbihydGltZUNvbmZpZykge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KHJ0aW1lQ29uZmlnKSkpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBUYWtlcyBhbiBlbmNvZGVkIHJ1bnRpbWUgc3RyaW5nIGFuZCByZXR1cm5zXG4gKiBhIHJ1bnRpbWUgY29uZmlndXJhdGlvbiBvYmplY3QuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gcnRpbWVDb25maWdTdHJpbmdcbiAqIEByZXR1cm5zIHtPYmplY3R9XG4gKi9cbldlYkFwcC5kZWNvZGVSdW50aW1lQ29uZmlnID0gZnVuY3Rpb24ocnRpbWVDb25maWdTdHIpIHtcbiAgcmV0dXJuIEpTT04ucGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KEpTT04ucGFyc2UocnRpbWVDb25maWdTdHIpKSk7XG59O1xuXG5jb25zdCBydW50aW1lQ29uZmlnID0ge1xuICAvLyBob29rcyB3aWxsIGNvbnRhaW4gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uc1xuICAvLyBzZXQgYnkgdGhlIGNhbGxlciB0byBhZGRSdW50aW1lQ29uZmlnSG9va1xuICBob29rczogbmV3IEhvb2soKSxcbiAgLy8gdXBkYXRlSG9va3Mgd2lsbCBjb250YWluIHRoZSBjYWxsYmFjayBmdW5jdGlvbnNcbiAgLy8gc2V0IGJ5IHRoZSBjYWxsZXIgdG8gYWRkVXBkYXRlZE5vdGlmeUhvb2tcbiAgdXBkYXRlSG9va3M6IG5ldyBIb29rKCksXG4gIC8vIGlzVXBkYXRlZEJ5QXJjaCBpcyBhbiBvYmplY3QgY29udGFpbmluZyBmaWVsZHMgZm9yIGVhY2ggYXJjaFxuICAvLyB0aGF0IHRoaXMgc2VydmVyIHN1cHBvcnRzLlxuICAvLyAtIEVhY2ggZmllbGQgd2lsbCBiZSB0cnVlIHdoZW4gdGhlIHNlcnZlciB1cGRhdGVzIHRoZSBydW50aW1lQ29uZmlnIGZvciB0aGF0IGFyY2guXG4gIC8vIC0gV2hlbiB0aGUgaG9vayBjYWxsYmFjayBpcyBjYWxsZWQgdGhlIHVwZGF0ZSBmaWVsZCBpbiB0aGUgY2FsbGJhY2sgb2JqZWN0IHdpbGwgYmVcbiAgLy8gc2V0IHRvIGlzVXBkYXRlZEJ5QXJjaFthcmNoXS5cbiAgLy8gPSBpc1VwZGF0ZWR5QnlBcmNoW2FyY2hdIGlzIHJlc2V0IHRvIGZhbHNlIGFmdGVyIHRoZSBjYWxsYmFjay5cbiAgLy8gVGhpcyBlbmFibGVzIHRoZSBjYWxsZXIgdG8gY2FjaGUgZGF0YSBlZmZpY2llbnRseSBzbyB0aGV5IGRvIG5vdCBuZWVkIHRvXG4gIC8vIGRlY29kZSAmIHVwZGF0ZSBkYXRhIG9uIGV2ZXJ5IGNhbGxiYWNrIHdoZW4gdGhlIHJ1bnRpbWVDb25maWcgaXMgbm90IGNoYW5naW5nLlxuICBpc1VwZGF0ZWRCeUFyY2g6IHt9LFxufTtcblxuLyoqXG4gKiBAbmFtZSBhZGRSdW50aW1lQ29uZmlnSG9va0NhbGxiYWNrKG9wdGlvbnMpXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAaXNwcm90b3R5cGUgdHJ1ZVxuICogQHN1bW1hcnkgQ2FsbGJhY2sgZm9yIGBhZGRSdW50aW1lQ29uZmlnSG9va2AuXG4gKlxuICogSWYgdGhlIGhhbmRsZXIgcmV0dXJucyBhIF9mYWxzeV8gdmFsdWUgdGhlIGhvb2sgd2lsbCBub3RcbiAqIG1vZGlmeSB0aGUgcnVudGltZSBjb25maWd1cmF0aW9uLlxuICpcbiAqIElmIHRoZSBoYW5kbGVyIHJldHVybnMgYSBfU3RyaW5nXyB0aGUgaG9vayB3aWxsIHN1YnN0aXR1dGVcbiAqIHRoZSBzdHJpbmcgZm9yIHRoZSBlbmNvZGVkIGNvbmZpZ3VyYXRpb24gc3RyaW5nLlxuICpcbiAqICoqV2FybmluZzoqKiB0aGUgaG9vayBkb2VzIG5vdCBjaGVjayB0aGUgcmV0dXJuIHZhbHVlIGF0IGFsbCBpdCBpc1xuICogdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjYWxsZXIgdG8gZ2V0IHRoZSBmb3JtYXR0aW5nIGNvcnJlY3QgdXNpbmdcbiAqIHRoZSBoZWxwZXIgZnVuY3Rpb25zLlxuICpcbiAqIGBhZGRSdW50aW1lQ29uZmlnSG9va0NhbGxiYWNrYCB0YWtlcyBvbmx5IG9uZSBgT2JqZWN0YCBhcmd1bWVudFxuICogd2l0aCB0aGUgZm9sbG93aW5nIGZpZWxkczpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5hcmNoIFRoZSBhcmNoaXRlY3R1cmUgb2YgdGhlIGNsaWVudFxuICogcmVxdWVzdGluZyBhIG5ldyBydW50aW1lIGNvbmZpZ3VyYXRpb24uIFRoaXMgY2FuIGJlIG9uZSBvZlxuICogYHdlYi5icm93c2VyYCwgYHdlYi5icm93c2VyLmxlZ2FjeWAgb3IgYHdlYi5jb3Jkb3ZhYC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLnJlcXVlc3RcbiAqIEEgTm9kZUpzIFtJbmNvbWluZ01lc3NhZ2VdKGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2h0dHBfY2xhc3NfaHR0cF9pbmNvbWluZ21lc3NhZ2UpXG4gKiBodHRwczovL25vZGVqcy5vcmcvYXBpL2h0dHAuaHRtbCNodHRwX2NsYXNzX2h0dHBfaW5jb21pbmdtZXNzYWdlXG4gKiBgT2JqZWN0YCB0aGF0IGNhbiBiZSB1c2VkIHRvIGdldCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgaW5jb21pbmcgcmVxdWVzdC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLmVuY29kZWRDdXJyZW50Q29uZmlnIFRoZSBjdXJyZW50IGNvbmZpZ3VyYXRpb24gb2JqZWN0XG4gKiBlbmNvZGVkIGFzIGEgc3RyaW5nIGZvciBpbmNsdXNpb24gaW4gdGhlIHJvb3QgaHRtbC5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51cGRhdGVkIGB0cnVlYCBpZiB0aGUgY29uZmlnIGZvciB0aGlzIGFyY2hpdGVjdHVyZVxuICogaGFzIGJlZW4gdXBkYXRlZCBzaW5jZSBsYXN0IGNhbGxlZCwgb3RoZXJ3aXNlIGBmYWxzZWAuIFRoaXMgZmxhZyBjYW4gYmUgdXNlZFxuICogdG8gY2FjaGUgdGhlIGRlY29kaW5nL2VuY29kaW5nIGZvciBlYWNoIGFyY2hpdGVjdHVyZS5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IEhvb2sgdGhhdCBjYWxscyBiYWNrIHdoZW4gdGhlIG1ldGVvciBydW50aW1lIGNvbmZpZ3VyYXRpb24sXG4gKiBgX19tZXRlb3JfcnVudGltZV9jb25maWdfX2AgaXMgYmVpbmcgc2VudCB0byBhbnkgY2xpZW50LlxuICpcbiAqICoqcmV0dXJucyoqOiA8c21hbGw+X09iamVjdF88L3NtYWxsPiBgeyBzdG9wOiBmdW5jdGlvbiwgY2FsbGJhY2s6IGZ1bmN0aW9uIH1gXG4gKiAtIGBzdG9wYCA8c21hbGw+X0Z1bmN0aW9uXzwvc21hbGw+IENhbGwgYHN0b3AoKWAgdG8gc3RvcCBnZXR0aW5nIGNhbGxiYWNrcy5cbiAqIC0gYGNhbGxiYWNrYCA8c21hbGw+X0Z1bmN0aW9uXzwvc21hbGw+IFRoZSBwYXNzZWQgaW4gYGNhbGxiYWNrYC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7YWRkUnVudGltZUNvbmZpZ0hvb2tDYWxsYmFja30gY2FsbGJhY2tcbiAqIFNlZSBgYWRkUnVudGltZUNvbmZpZ0hvb2tDYWxsYmFja2AgZGVzY3JpcHRpb24uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSB7eyBzdG9wOiBmdW5jdGlvbiwgY2FsbGJhY2s6IGZ1bmN0aW9uIH19XG4gKiBDYWxsIHRoZSByZXR1cm5lZCBgc3RvcCgpYCB0byBzdG9wIGdldHRpbmcgY2FsbGJhY2tzLlxuICogVGhlIHBhc3NlZCBpbiBgY2FsbGJhY2tgIGlzIHJldHVybmVkIGFsc28uXG4gKi9cbldlYkFwcC5hZGRSdW50aW1lQ29uZmlnSG9vayA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gIHJldHVybiBydW50aW1lQ29uZmlnLmhvb2tzLnJlZ2lzdGVyKGNhbGxiYWNrKTtcbn07XG5cbmZ1bmN0aW9uIGdldEJvaWxlcnBsYXRlQXN5bmMocmVxdWVzdCwgYXJjaCkge1xuICBsZXQgYm9pbGVycGxhdGUgPSBib2lsZXJwbGF0ZUJ5QXJjaFthcmNoXTtcbiAgcnVudGltZUNvbmZpZy5ob29rcy5mb3JFYWNoKGhvb2sgPT4ge1xuICAgIGNvbnN0IG1ldGVvclJ1bnRpbWVDb25maWcgPSBob29rKHtcbiAgICAgIGFyY2gsXG4gICAgICByZXF1ZXN0LFxuICAgICAgZW5jb2RlZEN1cnJlbnRDb25maWc6IGJvaWxlcnBsYXRlLmJhc2VEYXRhLm1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgICB1cGRhdGVkOiBydW50aW1lQ29uZmlnLmlzVXBkYXRlZEJ5QXJjaFthcmNoXSxcbiAgICB9KTtcbiAgICBpZiAoIW1ldGVvclJ1bnRpbWVDb25maWcpIHJldHVybiB0cnVlO1xuICAgIGJvaWxlcnBsYXRlLmJhc2VEYXRhID0gT2JqZWN0LmFzc2lnbih7fSwgYm9pbGVycGxhdGUuYmFzZURhdGEsIHtcbiAgICAgIG1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0pO1xuICBydW50aW1lQ29uZmlnLmlzVXBkYXRlZEJ5QXJjaFthcmNoXSA9IGZhbHNlO1xuICBjb25zdCBkYXRhID0gT2JqZWN0LmFzc2lnbihcbiAgICB7fSxcbiAgICBib2lsZXJwbGF0ZS5iYXNlRGF0YSxcbiAgICB7XG4gICAgICBodG1sQXR0cmlidXRlczogZ2V0SHRtbEF0dHJpYnV0ZXMocmVxdWVzdCksXG4gICAgfSxcbiAgICBfLnBpY2socmVxdWVzdCwgJ2R5bmFtaWNIZWFkJywgJ2R5bmFtaWNCb2R5JylcbiAgKTtcblxuICBsZXQgbWFkZUNoYW5nZXMgPSBmYWxzZTtcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcblxuICBPYmplY3Qua2V5cyhib2lsZXJwbGF0ZURhdGFDYWxsYmFja3MpLmZvckVhY2goa2V5ID0+IHtcbiAgICBwcm9taXNlID0gcHJvbWlzZVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICBjb25zdCBjYWxsYmFjayA9IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuICAgICAgICByZXR1cm4gY2FsbGJhY2socmVxdWVzdCwgZGF0YSwgYXJjaCk7XG4gICAgICB9KVxuICAgICAgLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgLy8gQ2FsbGJhY2tzIHNob3VsZCByZXR1cm4gZmFsc2UgaWYgdGhleSBkaWQgbm90IG1ha2UgYW55IGNoYW5nZXMuXG4gICAgICAgIGlmIChyZXN1bHQgIT09IGZhbHNlKSB7XG4gICAgICAgICAgbWFkZUNoYW5nZXMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHByb21pc2UudGhlbigoKSA9PiAoe1xuICAgIHN0cmVhbTogYm9pbGVycGxhdGUudG9IVE1MU3RyZWFtKGRhdGEpLFxuICAgIHN0YXR1c0NvZGU6IGRhdGEuc3RhdHVzQ29kZSxcbiAgICBoZWFkZXJzOiBkYXRhLmhlYWRlcnMsXG4gIH0pKTtcbn1cblxuLyoqXG4gKiBAbmFtZSBhZGRVcGRhdGVkTm90aWZ5SG9va0NhbGxiYWNrKG9wdGlvbnMpXG4gKiBAc3VtbWFyeSBjYWxsYmFjayBoYW5kbGVyIGZvciBgYWRkdXBkYXRlZE5vdGlmeUhvb2tgXG4gKiBAaXNwcm90b3R5cGUgdHJ1ZVxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLmFyY2ggVGhlIGFyY2hpdGVjdHVyZSB0aGF0IGlzIGJlaW5nIHVwZGF0ZWQuXG4gKiBUaGlzIGNhbiBiZSBvbmUgb2YgYHdlYi5icm93c2VyYCwgYHdlYi5icm93c2VyLmxlZ2FjeWAgb3IgYHdlYi5jb3Jkb3ZhYC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLm1hbmlmZXN0IFRoZSBuZXcgdXBkYXRlZCBtYW5pZmVzdCBvYmplY3QgZm9yXG4gKiB0aGlzIGBhcmNoYC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLnJ1bnRpbWVDb25maWcgVGhlIG5ldyB1cGRhdGVkIGNvbmZpZ3VyYXRpb25cbiAqIG9iamVjdCBmb3IgdGhpcyBgYXJjaGAuXG4gKi9cblxuLyoqXG4gKiBAc3VtbWFyeSBIb29rIHRoYXQgcnVucyB3aGVuIHRoZSBtZXRlb3IgcnVudGltZSBjb25maWd1cmF0aW9uXG4gKiBpcyB1cGRhdGVkLiAgVHlwaWNhbGx5IHRoZSBjb25maWd1cmF0aW9uIG9ubHkgY2hhbmdlcyBkdXJpbmcgZGV2ZWxvcG1lbnQgbW9kZS5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7YWRkVXBkYXRlZE5vdGlmeUhvb2tDYWxsYmFja30gaGFuZGxlclxuICogVGhlIGBoYW5kbGVyYCBpcyBjYWxsZWQgb24gZXZlcnkgY2hhbmdlIHRvIGFuIGBhcmNoYCBydW50aW1lIGNvbmZpZ3VyYXRpb24uXG4gKiBTZWUgYGFkZFVwZGF0ZWROb3RpZnlIb29rQ2FsbGJhY2tgLlxuICogQHJldHVybnMge09iamVjdH0ge3sgc3RvcDogZnVuY3Rpb24sIGNhbGxiYWNrOiBmdW5jdGlvbiB9fVxuICovXG5XZWJBcHAuYWRkVXBkYXRlZE5vdGlmeUhvb2sgPSBmdW5jdGlvbihoYW5kbGVyKSB7XG4gIHJldHVybiBydW50aW1lQ29uZmlnLnVwZGF0ZUhvb2tzLnJlZ2lzdGVyKGhhbmRsZXIpO1xufTtcblxuV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGVJbnN0YW5jZSA9IGZ1bmN0aW9uKFxuICBhcmNoLFxuICBtYW5pZmVzdCxcbiAgYWRkaXRpb25hbE9wdGlvbnNcbikge1xuICBhZGRpdGlvbmFsT3B0aW9ucyA9IGFkZGl0aW9uYWxPcHRpb25zIHx8IHt9O1xuXG4gIHJ1bnRpbWVDb25maWcuaXNVcGRhdGVkQnlBcmNoW2FyY2hdID0gdHJ1ZTtcbiAgY29uc3QgcnRpbWVDb25maWcgPSB7XG4gICAgLi4uX19tZXRlb3JfcnVudGltZV9jb25maWdfXyxcbiAgICAuLi4oYWRkaXRpb25hbE9wdGlvbnMucnVudGltZUNvbmZpZ092ZXJyaWRlcyB8fCB7fSksXG4gIH07XG4gIHJ1bnRpbWVDb25maWcudXBkYXRlSG9va3MuZm9yRWFjaChjYiA9PiB7XG4gICAgY2IoeyBhcmNoLCBtYW5pZmVzdCwgcnVudGltZUNvbmZpZzogcnRpbWVDb25maWcgfSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0pO1xuXG4gIGNvbnN0IG1ldGVvclJ1bnRpbWVDb25maWcgPSBKU09OLnN0cmluZ2lmeShcbiAgICBlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkocnRpbWVDb25maWcpKVxuICApO1xuXG4gIHJldHVybiBuZXcgQm9pbGVycGxhdGUoXG4gICAgYXJjaCxcbiAgICBtYW5pZmVzdCxcbiAgICBPYmplY3QuYXNzaWduKFxuICAgICAge1xuICAgICAgICBwYXRoTWFwcGVyKGl0ZW1QYXRoKSB7XG4gICAgICAgICAgcmV0dXJuIHBhdGhKb2luKGFyY2hQYXRoW2FyY2hdLCBpdGVtUGF0aCk7XG4gICAgICAgIH0sXG4gICAgICAgIGJhc2VEYXRhRXh0ZW5zaW9uOiB7XG4gICAgICAgICAgYWRkaXRpb25hbFN0YXRpY0pzOiBfLm1hcChhZGRpdGlvbmFsU3RhdGljSnMgfHwgW10sIGZ1bmN0aW9uKFxuICAgICAgICAgICAgY29udGVudHMsXG4gICAgICAgICAgICBwYXRobmFtZVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgcGF0aG5hbWU6IHBhdGhuYW1lLFxuICAgICAgICAgICAgICBjb250ZW50czogY29udGVudHMsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pLFxuICAgICAgICAgIC8vIENvbnZlcnQgdG8gYSBKU09OIHN0cmluZywgdGhlbiBnZXQgcmlkIG9mIG1vc3Qgd2VpcmQgY2hhcmFjdGVycywgdGhlblxuICAgICAgICAgIC8vIHdyYXAgaW4gZG91YmxlIHF1b3Rlcy4gKFRoZSBvdXRlcm1vc3QgSlNPTi5zdHJpbmdpZnkgcmVhbGx5IG91Z2h0IHRvXG4gICAgICAgICAgLy8ganVzdCBiZSBcIndyYXAgaW4gZG91YmxlIHF1b3Rlc1wiIGJ1dCB3ZSB1c2UgaXQgdG8gYmUgc2FmZS4pIFRoaXMgbWlnaHRcbiAgICAgICAgICAvLyBlbmQgdXAgaW5zaWRlIGEgPHNjcmlwdD4gdGFnIHNvIHdlIG5lZWQgdG8gYmUgY2FyZWZ1bCB0byBub3QgaW5jbHVkZVxuICAgICAgICAgIC8vIFwiPC9zY3JpcHQ+XCIsIGJ1dCBub3JtYWwge3tzcGFjZWJhcnN9fSBlc2NhcGluZyBlc2NhcGVzIHRvbyBtdWNoISBTZWVcbiAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMzczMFxuICAgICAgICAgIG1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgICAgICAgbWV0ZW9yUnVudGltZUhhc2g6IHNoYTEobWV0ZW9yUnVudGltZUNvbmZpZyksXG4gICAgICAgICAgcm9vdFVybFBhdGhQcmVmaXg6XG4gICAgICAgICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYIHx8ICcnLFxuICAgICAgICAgIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rOiBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayxcbiAgICAgICAgICBzcmlNb2RlOiBzcmlNb2RlLFxuICAgICAgICAgIGlubGluZVNjcmlwdHNBbGxvd2VkOiBXZWJBcHBJbnRlcm5hbHMuaW5saW5lU2NyaXB0c0FsbG93ZWQoKSxcbiAgICAgICAgICBpbmxpbmU6IGFkZGl0aW9uYWxPcHRpb25zLmlubGluZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBhZGRpdGlvbmFsT3B0aW9uc1xuICAgIClcbiAgKTtcbn07XG5cbi8vIEEgbWFwcGluZyBmcm9tIHVybCBwYXRoIHRvIGFyY2hpdGVjdHVyZSAoZS5nLiBcIndlYi5icm93c2VyXCIpIHRvIHN0YXRpY1xuLy8gZmlsZSBpbmZvcm1hdGlvbiB3aXRoIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuLy8gLSB0eXBlOiB0aGUgdHlwZSBvZiBmaWxlIHRvIGJlIHNlcnZlZFxuLy8gLSBjYWNoZWFibGU6IG9wdGlvbmFsbHksIHdoZXRoZXIgdGhlIGZpbGUgc2hvdWxkIGJlIGNhY2hlZCBvciBub3Rcbi8vIC0gc291cmNlTWFwVXJsOiBvcHRpb25hbGx5LCB0aGUgdXJsIG9mIHRoZSBzb3VyY2UgbWFwXG4vL1xuLy8gSW5mbyBhbHNvIGNvbnRhaW5zIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuLy8gLSBjb250ZW50OiB0aGUgc3RyaW5naWZpZWQgY29udGVudCB0aGF0IHNob3VsZCBiZSBzZXJ2ZWQgYXQgdGhpcyBwYXRoXG4vLyAtIGFic29sdXRlUGF0aDogdGhlIGFic29sdXRlIHBhdGggb24gZGlzayB0byB0aGUgZmlsZVxuXG4vLyBTZXJ2ZSBzdGF0aWMgZmlsZXMgZnJvbSB0aGUgbWFuaWZlc3Qgb3IgYWRkZWQgd2l0aFxuLy8gYGFkZFN0YXRpY0pzYC4gRXhwb3J0ZWQgZm9yIHRlc3RzLlxuV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzTWlkZGxld2FyZSA9IGFzeW5jIGZ1bmN0aW9uKFxuICBzdGF0aWNGaWxlc0J5QXJjaCxcbiAgcmVxLFxuICByZXMsXG4gIG5leHRcbikge1xuICB2YXIgcGF0aG5hbWUgPSBwYXJzZVJlcXVlc3QocmVxKS5wYXRobmFtZTtcbiAgdHJ5IHtcbiAgICBwYXRobmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChwYXRobmFtZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBuZXh0KCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIHNlcnZlU3RhdGljSnMgPSBmdW5jdGlvbihzKSB7XG4gICAgaWYgKFxuICAgICAgcmVxLm1ldGhvZCA9PT0gJ0dFVCcgfHxcbiAgICAgIHJlcS5tZXRob2QgPT09ICdIRUFEJyB8fFxuICAgICAgTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy53ZWJhcHA/LmFsd2F5c1JldHVybkNvbnRlbnRcbiAgICApIHtcbiAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7XG4gICAgICAgICdDb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdDsgY2hhcnNldD1VVEYtOCcsXG4gICAgICAgICdDb250ZW50LUxlbmd0aCc6IEJ1ZmZlci5ieXRlTGVuZ3RoKHMpLFxuICAgICAgfSk7XG4gICAgICByZXMud3JpdGUocyk7XG4gICAgICByZXMuZW5kKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IHJlcS5tZXRob2QgPT09ICdPUFRJT05TJyA/IDIwMCA6IDQwNTtcbiAgICAgIHJlcy53cml0ZUhlYWQoc3RhdHVzLCB7XG4gICAgICAgIEFsbG93OiAnT1BUSU9OUywgR0VULCBIRUFEJyxcbiAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogJzAnLFxuICAgICAgfSk7XG4gICAgICByZXMuZW5kKCk7XG4gICAgfVxuICB9O1xuXG4gIGlmIChcbiAgICBfLmhhcyhhZGRpdGlvbmFsU3RhdGljSnMsIHBhdGhuYW1lKSAmJlxuICAgICFXZWJBcHBJbnRlcm5hbHMuaW5saW5lU2NyaXB0c0FsbG93ZWQoKVxuICApIHtcbiAgICBzZXJ2ZVN0YXRpY0pzKGFkZGl0aW9uYWxTdGF0aWNKc1twYXRobmFtZV0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHsgYXJjaCwgcGF0aCB9ID0gV2ViQXBwLmNhdGVnb3JpemVSZXF1ZXN0KHJlcSk7XG5cbiAgaWYgKCFoYXNPd24uY2FsbChXZWJBcHAuY2xpZW50UHJvZ3JhbXMsIGFyY2gpKSB7XG4gICAgLy8gV2UgY291bGQgY29tZSBoZXJlIGluIGNhc2Ugd2UgcnVuIHdpdGggc29tZSBhcmNoaXRlY3R1cmVzIGV4Y2x1ZGVkXG4gICAgbmV4dCgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIElmIHBhdXNlQ2xpZW50KGFyY2gpIGhhcyBiZWVuIGNhbGxlZCwgcHJvZ3JhbS5wYXVzZWQgd2lsbCBiZSBhXG4gIC8vIFByb21pc2UgdGhhdCB3aWxsIGJlIHJlc29sdmVkIHdoZW4gdGhlIHByb2dyYW0gaXMgdW5wYXVzZWQuXG4gIGNvbnN0IHByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gIGF3YWl0IHByb2dyYW0ucGF1c2VkO1xuXG4gIGlmIChcbiAgICBwYXRoID09PSAnL21ldGVvcl9ydW50aW1lX2NvbmZpZy5qcycgJiZcbiAgICAhV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkKClcbiAgKSB7XG4gICAgc2VydmVTdGF0aWNKcyhcbiAgICAgIGBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gJHtwcm9ncmFtLm1ldGVvclJ1bnRpbWVDb25maWd9O2BcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGluZm8gPSBnZXRTdGF0aWNGaWxlSW5mbyhzdGF0aWNGaWxlc0J5QXJjaCwgcGF0aG5hbWUsIHBhdGgsIGFyY2gpO1xuICBpZiAoIWluZm8pIHtcbiAgICBuZXh0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIFwic2VuZFwiIHdpbGwgaGFuZGxlIEhFQUQgJiBHRVQgcmVxdWVzdHNcbiAgaWYgKFxuICAgIHJlcS5tZXRob2QgIT09ICdIRUFEJyAmJlxuICAgIHJlcS5tZXRob2QgIT09ICdHRVQnICYmXG4gICAgIU1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8ud2ViYXBwPy5hbHdheXNSZXR1cm5Db250ZW50XG4gICkge1xuICAgIGNvbnN0IHN0YXR1cyA9IHJlcS5tZXRob2QgPT09ICdPUFRJT05TJyA/IDIwMCA6IDQwNTtcbiAgICByZXMud3JpdGVIZWFkKHN0YXR1cywge1xuICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogJzAnLFxuICAgIH0pO1xuICAgIHJlcy5lbmQoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBXZSBkb24ndCBuZWVkIHRvIGNhbGwgcGF1c2UgYmVjYXVzZSwgdW5saWtlICdzdGF0aWMnLCBvbmNlIHdlIGNhbGwgaW50b1xuICAvLyAnc2VuZCcgYW5kIHlpZWxkIHRvIHRoZSBldmVudCBsb29wLCB3ZSBuZXZlciBjYWxsIGFub3RoZXIgaGFuZGxlciB3aXRoXG4gIC8vICduZXh0Jy5cblxuICAvLyBDYWNoZWFibGUgZmlsZXMgYXJlIGZpbGVzIHRoYXQgc2hvdWxkIG5ldmVyIGNoYW5nZS4gVHlwaWNhbGx5XG4gIC8vIG5hbWVkIGJ5IHRoZWlyIGhhc2ggKGVnIG1ldGVvciBidW5kbGVkIGpzIGFuZCBjc3MgZmlsZXMpLlxuICAvLyBXZSBjYWNoZSB0aGVtIH5mb3JldmVyICgxeXIpLlxuICBjb25zdCBtYXhBZ2UgPSBpbmZvLmNhY2hlYWJsZSA/IDEwMDAgKiA2MCAqIDYwICogMjQgKiAzNjUgOiAwO1xuXG4gIGlmIChpbmZvLmNhY2hlYWJsZSkge1xuICAgIC8vIFNpbmNlIHdlIHVzZSByZXEuaGVhZGVyc1tcInVzZXItYWdlbnRcIl0gdG8gZGV0ZXJtaW5lIHdoZXRoZXIgdGhlXG4gICAgLy8gY2xpZW50IHNob3VsZCByZWNlaXZlIG1vZGVybiBvciBsZWdhY3kgcmVzb3VyY2VzLCB0ZWxsIHRoZSBjbGllbnRcbiAgICAvLyB0byBpbnZhbGlkYXRlIGNhY2hlZCByZXNvdXJjZXMgd2hlbi9pZiBpdHMgdXNlciBhZ2VudCBzdHJpbmdcbiAgICAvLyBjaGFuZ2VzIGluIHRoZSBmdXR1cmUuXG4gICAgcmVzLnNldEhlYWRlcignVmFyeScsICdVc2VyLUFnZW50Jyk7XG4gIH1cblxuICAvLyBTZXQgdGhlIFgtU291cmNlTWFwIGhlYWRlciwgd2hpY2ggY3VycmVudCBDaHJvbWUsIEZpcmVGb3gsIGFuZCBTYWZhcmlcbiAgLy8gdW5kZXJzdGFuZC4gIChUaGUgU291cmNlTWFwIGhlYWRlciBpcyBzbGlnaHRseSBtb3JlIHNwZWMtY29ycmVjdCBidXQgRkZcbiAgLy8gZG9lc24ndCB1bmRlcnN0YW5kIGl0LilcbiAgLy9cbiAgLy8gWW91IG1heSBhbHNvIG5lZWQgdG8gZW5hYmxlIHNvdXJjZSBtYXBzIGluIENocm9tZTogb3BlbiBkZXYgdG9vbHMsIGNsaWNrXG4gIC8vIHRoZSBnZWFyIGluIHRoZSBib3R0b20gcmlnaHQgY29ybmVyLCBhbmQgc2VsZWN0IFwiZW5hYmxlIHNvdXJjZSBtYXBzXCIuXG4gIGlmIChpbmZvLnNvdXJjZU1hcFVybCkge1xuICAgIHJlcy5zZXRIZWFkZXIoXG4gICAgICAnWC1Tb3VyY2VNYXAnLFxuICAgICAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCArIGluZm8uc291cmNlTWFwVXJsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChpbmZvLnR5cGUgPT09ICdqcycgfHwgaW5mby50eXBlID09PSAnZHluYW1pYyBqcycpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vamF2YXNjcmlwdDsgY2hhcnNldD1VVEYtOCcpO1xuICB9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2NzcycpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9jc3M7IGNoYXJzZXQ9VVRGLTgnKTtcbiAgfSBlbHNlIGlmIChpbmZvLnR5cGUgPT09ICdqc29uJykge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04Jyk7XG4gIH1cblxuICBpZiAoaW5mby5oYXNoKSB7XG4gICAgcmVzLnNldEhlYWRlcignRVRhZycsICdcIicgKyBpbmZvLmhhc2ggKyAnXCInKTtcbiAgfVxuXG4gIGlmIChpbmZvLmNvbnRlbnQpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LUxlbmd0aCcsIEJ1ZmZlci5ieXRlTGVuZ3RoKGluZm8uY29udGVudCkpO1xuICAgIHJlcy53cml0ZShpbmZvLmNvbnRlbnQpO1xuICAgIHJlcy5lbmQoKTtcbiAgfSBlbHNlIHtcbiAgICBzZW5kKHJlcSwgaW5mby5hYnNvbHV0ZVBhdGgsIHtcbiAgICAgIG1heGFnZTogbWF4QWdlLFxuICAgICAgZG90ZmlsZXM6ICdhbGxvdycsIC8vIGlmIHdlIHNwZWNpZmllZCBhIGRvdGZpbGUgaW4gdGhlIG1hbmlmZXN0LCBzZXJ2ZSBpdFxuICAgICAgbGFzdE1vZGlmaWVkOiBmYWxzZSwgLy8gZG9uJ3Qgc2V0IGxhc3QtbW9kaWZpZWQgYmFzZWQgb24gdGhlIGZpbGUgZGF0ZVxuICAgIH0pXG4gICAgICAub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIExvZy5lcnJvcignRXJyb3Igc2VydmluZyBzdGF0aWMgZmlsZSAnICsgZXJyKTtcbiAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xuICAgICAgICByZXMuZW5kKCk7XG4gICAgICB9KVxuICAgICAgLm9uKCdkaXJlY3RvcnknLCBmdW5jdGlvbigpIHtcbiAgICAgICAgTG9nLmVycm9yKCdVbmV4cGVjdGVkIGRpcmVjdG9yeSAnICsgaW5mby5hYnNvbHV0ZVBhdGgpO1xuICAgICAgICByZXMud3JpdGVIZWFkKDUwMCk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICAgIH0pXG4gICAgICAucGlwZShyZXMpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZXRTdGF0aWNGaWxlSW5mbyhzdGF0aWNGaWxlc0J5QXJjaCwgb3JpZ2luYWxQYXRoLCBwYXRoLCBhcmNoKSB7XG4gIGlmICghaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gR2V0IGEgbGlzdCBvZiBhbGwgYXZhaWxhYmxlIHN0YXRpYyBmaWxlIGFyY2hpdGVjdHVyZXMsIHdpdGggYXJjaFxuICAvLyBmaXJzdCBpbiB0aGUgbGlzdCBpZiBpdCBleGlzdHMuXG4gIGNvbnN0IHN0YXRpY0FyY2hMaXN0ID0gT2JqZWN0LmtleXMoc3RhdGljRmlsZXNCeUFyY2gpO1xuICBjb25zdCBhcmNoSW5kZXggPSBzdGF0aWNBcmNoTGlzdC5pbmRleE9mKGFyY2gpO1xuICBpZiAoYXJjaEluZGV4ID4gMCkge1xuICAgIHN0YXRpY0FyY2hMaXN0LnVuc2hpZnQoc3RhdGljQXJjaExpc3Quc3BsaWNlKGFyY2hJbmRleCwgMSlbMF0pO1xuICB9XG5cbiAgbGV0IGluZm8gPSBudWxsO1xuXG4gIHN0YXRpY0FyY2hMaXN0LnNvbWUoYXJjaCA9PiB7XG4gICAgY29uc3Qgc3RhdGljRmlsZXMgPSBzdGF0aWNGaWxlc0J5QXJjaFthcmNoXTtcblxuICAgIGZ1bmN0aW9uIGZpbmFsaXplKHBhdGgpIHtcbiAgICAgIGluZm8gPSBzdGF0aWNGaWxlc1twYXRoXTtcbiAgICAgIC8vIFNvbWV0aW1lcyB3ZSByZWdpc3RlciBhIGxhenkgZnVuY3Rpb24gaW5zdGVhZCBvZiBhY3R1YWwgZGF0YSBpblxuICAgICAgLy8gdGhlIHN0YXRpY0ZpbGVzIG1hbmlmZXN0LlxuICAgICAgaWYgKHR5cGVvZiBpbmZvID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGluZm8gPSBzdGF0aWNGaWxlc1twYXRoXSA9IGluZm8oKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmZvO1xuICAgIH1cblxuICAgIC8vIElmIHN0YXRpY0ZpbGVzIGNvbnRhaW5zIG9yaWdpbmFsUGF0aCB3aXRoIHRoZSBhcmNoIGluZmVycmVkIGFib3ZlLFxuICAgIC8vIHVzZSB0aGF0IGluZm9ybWF0aW9uLlxuICAgIGlmIChoYXNPd24uY2FsbChzdGF0aWNGaWxlcywgb3JpZ2luYWxQYXRoKSkge1xuICAgICAgcmV0dXJuIGZpbmFsaXplKG9yaWdpbmFsUGF0aCk7XG4gICAgfVxuXG4gICAgLy8gSWYgY2F0ZWdvcml6ZVJlcXVlc3QgcmV0dXJuZWQgYW4gYWx0ZXJuYXRlIHBhdGgsIHRyeSB0aGF0IGluc3RlYWQuXG4gICAgaWYgKHBhdGggIT09IG9yaWdpbmFsUGF0aCAmJiBoYXNPd24uY2FsbChzdGF0aWNGaWxlcywgcGF0aCkpIHtcbiAgICAgIHJldHVybiBmaW5hbGl6ZShwYXRoKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbmZvO1xufVxuXG4vLyBQYXJzZSB0aGUgcGFzc2VkIGluIHBvcnQgdmFsdWUuIFJldHVybiB0aGUgcG9ydCBhcy1pcyBpZiBpdCdzIGEgU3RyaW5nXG4vLyAoZS5nLiBhIFdpbmRvd3MgU2VydmVyIHN0eWxlIG5hbWVkIHBpcGUpLCBvdGhlcndpc2UgcmV0dXJuIHRoZSBwb3J0IGFzIGFuXG4vLyBpbnRlZ2VyLlxuLy9cbi8vIERFUFJFQ0FURUQ6IERpcmVjdCB1c2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBub3QgcmVjb21tZW5kZWQ7IGl0IGlzIG5vXG4vLyBsb25nZXIgdXNlZCBpbnRlcm5hbGx5LCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHJlbGVhc2UuXG5XZWJBcHBJbnRlcm5hbHMucGFyc2VQb3J0ID0gcG9ydCA9PiB7XG4gIGxldCBwYXJzZWRQb3J0ID0gcGFyc2VJbnQocG9ydCk7XG4gIGlmIChOdW1iZXIuaXNOYU4ocGFyc2VkUG9ydCkpIHtcbiAgICBwYXJzZWRQb3J0ID0gcG9ydDtcbiAgfVxuICByZXR1cm4gcGFyc2VkUG9ydDtcbn07XG5cbmltcG9ydCB7IG9uTWVzc2FnZSB9IGZyb20gJ21ldGVvci9pbnRlci1wcm9jZXNzLW1lc3NhZ2luZyc7XG5cbm9uTWVzc2FnZSgnd2ViYXBwLXBhdXNlLWNsaWVudCcsIGFzeW5jICh7IGFyY2ggfSkgPT4ge1xuICBXZWJBcHBJbnRlcm5hbHMucGF1c2VDbGllbnQoYXJjaCk7XG59KTtcblxub25NZXNzYWdlKCd3ZWJhcHAtcmVsb2FkLWNsaWVudCcsIGFzeW5jICh7IGFyY2ggfSkgPT4ge1xuICBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gpO1xufSk7XG5cbmZ1bmN0aW9uIHJ1bldlYkFwcFNlcnZlcigpIHtcbiAgdmFyIHNodXR0aW5nRG93biA9IGZhbHNlO1xuICB2YXIgc3luY1F1ZXVlID0gbmV3IE1ldGVvci5fU3luY2hyb25vdXNRdWV1ZSgpO1xuXG4gIHZhciBnZXRJdGVtUGF0aG5hbWUgPSBmdW5jdGlvbihpdGVtVXJsKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChwYXJzZVVybChpdGVtVXJsKS5wYXRobmFtZSk7XG4gIH07XG5cbiAgV2ViQXBwSW50ZXJuYWxzLnJlbG9hZENsaWVudFByb2dyYW1zID0gZnVuY3Rpb24oKSB7XG4gICAgc3luY1F1ZXVlLnJ1blRhc2soZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBzdGF0aWNGaWxlc0J5QXJjaCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAgIGNvbnN0IHsgY29uZmlnSnNvbiB9ID0gX19tZXRlb3JfYm9vdHN0cmFwX187XG4gICAgICBjb25zdCBjbGllbnRBcmNocyA9XG4gICAgICAgIGNvbmZpZ0pzb24uY2xpZW50QXJjaHMgfHwgT2JqZWN0LmtleXMoY29uZmlnSnNvbi5jbGllbnRQYXRocyk7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNsaWVudEFyY2hzLmZvckVhY2goYXJjaCA9PiB7XG4gICAgICAgICAgZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gsIHN0YXRpY0ZpbGVzQnlBcmNoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc0J5QXJjaCA9IHN0YXRpY0ZpbGVzQnlBcmNoO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBMb2cuZXJyb3IoJ0Vycm9yIHJlbG9hZGluZyB0aGUgY2xpZW50IHByb2dyYW06ICcgKyBlLnN0YWNrKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIC8vIFBhdXNlIGFueSBpbmNvbWluZyByZXF1ZXN0cyBhbmQgbWFrZSB0aGVtIHdhaXQgZm9yIHRoZSBwcm9ncmFtIHRvIGJlXG4gIC8vIHVucGF1c2VkIHRoZSBuZXh0IHRpbWUgZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gpIGlzIGNhbGxlZC5cbiAgV2ViQXBwSW50ZXJuYWxzLnBhdXNlQ2xpZW50ID0gZnVuY3Rpb24oYXJjaCkge1xuICAgIHN5bmNRdWV1ZS5ydW5UYXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gICAgICBjb25zdCB7IHVucGF1c2UgfSA9IHByb2dyYW07XG4gICAgICBwcm9ncmFtLnBhdXNlZCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHVucGF1c2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAvLyBJZiB0aGVyZSBoYXBwZW5zIHRvIGJlIGFuIGV4aXN0aW5nIHByb2dyYW0udW5wYXVzZSBmdW5jdGlvbixcbiAgICAgICAgICAvLyBjb21wb3NlIGl0IHdpdGggdGhlIHJlc29sdmUgZnVuY3Rpb24uXG4gICAgICAgICAgcHJvZ3JhbS51bnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB1bnBhdXNlKCk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9ncmFtLnVucGF1c2UgPSByZXNvbHZlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVDbGllbnRQcm9ncmFtID0gZnVuY3Rpb24oYXJjaCkge1xuICAgIHN5bmNRdWV1ZS5ydW5UYXNrKCgpID0+IGdlbmVyYXRlQ2xpZW50UHJvZ3JhbShhcmNoKSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVDbGllbnRQcm9ncmFtKFxuICAgIGFyY2gsXG4gICAgc3RhdGljRmlsZXNCeUFyY2ggPSBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNCeUFyY2hcbiAgKSB7XG4gICAgY29uc3QgY2xpZW50RGlyID0gcGF0aEpvaW4oXG4gICAgICBwYXRoRGlybmFtZShfX21ldGVvcl9ib290c3RyYXBfXy5zZXJ2ZXJEaXIpLFxuICAgICAgYXJjaFxuICAgICk7XG5cbiAgICAvLyByZWFkIHRoZSBjb250cm9sIGZvciB0aGUgY2xpZW50IHdlJ2xsIGJlIHNlcnZpbmcgdXBcbiAgICBjb25zdCBwcm9ncmFtSnNvblBhdGggPSBwYXRoSm9pbihjbGllbnREaXIsICdwcm9ncmFtLmpzb24nKTtcblxuICAgIGxldCBwcm9ncmFtSnNvbjtcbiAgICB0cnkge1xuICAgICAgcHJvZ3JhbUpzb24gPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhwcm9ncmFtSnNvblBhdGgpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5jb2RlID09PSAnRU5PRU5UJykgcmV0dXJuO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICBpZiAocHJvZ3JhbUpzb24uZm9ybWF0ICE9PSAnd2ViLXByb2dyYW0tcHJlMScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1Vuc3VwcG9ydGVkIGZvcm1hdCBmb3IgY2xpZW50IGFzc2V0czogJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkocHJvZ3JhbUpzb24uZm9ybWF0KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIXByb2dyYW1Kc29uUGF0aCB8fCAhY2xpZW50RGlyIHx8ICFwcm9ncmFtSnNvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDbGllbnQgY29uZmlnIGZpbGUgbm90IHBhcnNlZC4nKTtcbiAgICB9XG5cbiAgICBhcmNoUGF0aFthcmNoXSA9IGNsaWVudERpcjtcbiAgICBjb25zdCBzdGF0aWNGaWxlcyA9IChzdGF0aWNGaWxlc0J5QXJjaFthcmNoXSA9IE9iamVjdC5jcmVhdGUobnVsbCkpO1xuXG4gICAgY29uc3QgeyBtYW5pZmVzdCB9ID0gcHJvZ3JhbUpzb247XG4gICAgbWFuaWZlc3QuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGlmIChpdGVtLnVybCAmJiBpdGVtLndoZXJlID09PSAnY2xpZW50Jykge1xuICAgICAgICBzdGF0aWNGaWxlc1tnZXRJdGVtUGF0aG5hbWUoaXRlbS51cmwpXSA9IHtcbiAgICAgICAgICBhYnNvbHV0ZVBhdGg6IHBhdGhKb2luKGNsaWVudERpciwgaXRlbS5wYXRoKSxcbiAgICAgICAgICBjYWNoZWFibGU6IGl0ZW0uY2FjaGVhYmxlLFxuICAgICAgICAgIGhhc2g6IGl0ZW0uaGFzaCxcbiAgICAgICAgICAvLyBMaW5rIGZyb20gc291cmNlIHRvIGl0cyBtYXBcbiAgICAgICAgICBzb3VyY2VNYXBVcmw6IGl0ZW0uc291cmNlTWFwVXJsLFxuICAgICAgICAgIHR5cGU6IGl0ZW0udHlwZSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoaXRlbS5zb3VyY2VNYXApIHtcbiAgICAgICAgICAvLyBTZXJ2ZSB0aGUgc291cmNlIG1hcCB0b28sIHVuZGVyIHRoZSBzcGVjaWZpZWQgVVJMLiBXZSBhc3N1bWVcbiAgICAgICAgICAvLyBhbGwgc291cmNlIG1hcHMgYXJlIGNhY2hlYWJsZS5cbiAgICAgICAgICBzdGF0aWNGaWxlc1tnZXRJdGVtUGF0aG5hbWUoaXRlbS5zb3VyY2VNYXBVcmwpXSA9IHtcbiAgICAgICAgICAgIGFic29sdXRlUGF0aDogcGF0aEpvaW4oY2xpZW50RGlyLCBpdGVtLnNvdXJjZU1hcCksXG4gICAgICAgICAgICBjYWNoZWFibGU6IHRydWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgeyBQVUJMSUNfU0VUVElOR1MgfSA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX187XG4gICAgY29uc3QgY29uZmlnT3ZlcnJpZGVzID0ge1xuICAgICAgUFVCTElDX1NFVFRJTkdTLFxuICAgIH07XG5cbiAgICBjb25zdCBvbGRQcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgIGNvbnN0IG5ld1Byb2dyYW0gPSAoV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdID0ge1xuICAgICAgZm9ybWF0OiAnd2ViLXByb2dyYW0tcHJlMScsXG4gICAgICBtYW5pZmVzdDogbWFuaWZlc3QsXG4gICAgICAvLyBVc2UgYXJyb3cgZnVuY3Rpb25zIHNvIHRoYXQgdGhlc2UgdmVyc2lvbnMgY2FuIGJlIGxhemlseVxuICAgICAgLy8gY2FsY3VsYXRlZCBsYXRlciwgYW5kIHNvIHRoYXQgdGhleSB3aWxsIG5vdCBiZSBpbmNsdWRlZCBpbiB0aGVcbiAgICAgIC8vIHN0YXRpY0ZpbGVzW21hbmlmZXN0VXJsXS5jb250ZW50IHN0cmluZyBiZWxvdy5cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlOiB0aGVzZSB2ZXJzaW9uIGNhbGN1bGF0aW9ucyBtdXN0IGJlIGtlcHQgaW4gYWdyZWVtZW50IHdpdGhcbiAgICAgIC8vIENvcmRvdmFCdWlsZGVyI2FwcGVuZFZlcnNpb24gaW4gdG9vbHMvY29yZG92YS9idWlsZGVyLmpzLCBvciBob3RcbiAgICAgIC8vIGNvZGUgcHVzaCB3aWxsIHJlbG9hZCBDb3Jkb3ZhIGFwcHMgdW5uZWNlc3NhcmlseS5cbiAgICAgIHZlcnNpb246ICgpID0+XG4gICAgICAgIFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaChtYW5pZmVzdCwgbnVsbCwgY29uZmlnT3ZlcnJpZGVzKSxcbiAgICAgIHZlcnNpb25SZWZyZXNoYWJsZTogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKFxuICAgICAgICAgIG1hbmlmZXN0LFxuICAgICAgICAgIHR5cGUgPT4gdHlwZSA9PT0gJ2NzcycsXG4gICAgICAgICAgY29uZmlnT3ZlcnJpZGVzXG4gICAgICAgICksXG4gICAgICB2ZXJzaW9uTm9uUmVmcmVzaGFibGU6ICgpID0+XG4gICAgICAgIFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaChcbiAgICAgICAgICBtYW5pZmVzdCxcbiAgICAgICAgICAodHlwZSwgcmVwbGFjZWFibGUpID0+IHR5cGUgIT09ICdjc3MnICYmICFyZXBsYWNlYWJsZSxcbiAgICAgICAgICBjb25maWdPdmVycmlkZXNcbiAgICAgICAgKSxcbiAgICAgIHZlcnNpb25SZXBsYWNlYWJsZTogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKFxuICAgICAgICAgIG1hbmlmZXN0LFxuICAgICAgICAgIChfdHlwZSwgcmVwbGFjZWFibGUpID0+IHJlcGxhY2VhYmxlLFxuICAgICAgICAgIGNvbmZpZ092ZXJyaWRlc1xuICAgICAgICApLFxuICAgICAgY29yZG92YUNvbXBhdGliaWxpdHlWZXJzaW9uczogcHJvZ3JhbUpzb24uY29yZG92YUNvbXBhdGliaWxpdHlWZXJzaW9ucyxcbiAgICAgIFBVQkxJQ19TRVRUSU5HUyxcbiAgICAgIGhtclZlcnNpb246IHByb2dyYW1Kc29uLmhtclZlcnNpb24sXG4gICAgfSk7XG5cbiAgICAvLyBFeHBvc2UgcHJvZ3JhbSBkZXRhaWxzIGFzIGEgc3RyaW5nIHJlYWNoYWJsZSB2aWEgdGhlIGZvbGxvd2luZyBVUkwuXG4gICAgY29uc3QgbWFuaWZlc3RVcmxQcmVmaXggPSAnL19fJyArIGFyY2gucmVwbGFjZSgvXndlYlxcLi8sICcnKTtcbiAgICBjb25zdCBtYW5pZmVzdFVybCA9IG1hbmlmZXN0VXJsUHJlZml4ICsgZ2V0SXRlbVBhdGhuYW1lKCcvbWFuaWZlc3QuanNvbicpO1xuXG4gICAgc3RhdGljRmlsZXNbbWFuaWZlc3RVcmxdID0gKCkgPT4ge1xuICAgICAgaWYgKFBhY2thZ2UuYXV0b3VwZGF0ZSkge1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgQVVUT1VQREFURV9WRVJTSU9OID0gUGFja2FnZS5hdXRvdXBkYXRlLkF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb24sXG4gICAgICAgIH0gPSBwcm9jZXNzLmVudjtcblxuICAgICAgICBpZiAoQVVUT1VQREFURV9WRVJTSU9OKSB7XG4gICAgICAgICAgbmV3UHJvZ3JhbS52ZXJzaW9uID0gQVVUT1VQREFURV9WRVJTSU9OO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgbmV3UHJvZ3JhbS52ZXJzaW9uID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG5ld1Byb2dyYW0udmVyc2lvbiA9IG5ld1Byb2dyYW0udmVyc2lvbigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZW50OiBKU09OLnN0cmluZ2lmeShuZXdQcm9ncmFtKSxcbiAgICAgICAgY2FjaGVhYmxlOiBmYWxzZSxcbiAgICAgICAgaGFzaDogbmV3UHJvZ3JhbS52ZXJzaW9uLFxuICAgICAgICB0eXBlOiAnanNvbicsXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaChhcmNoKTtcblxuICAgIC8vIElmIHRoZXJlIGFyZSBhbnkgcmVxdWVzdHMgd2FpdGluZyBvbiBvbGRQcm9ncmFtLnBhdXNlZCwgbGV0IHRoZW1cbiAgICAvLyBjb250aW51ZSBub3cgKHVzaW5nIHRoZSBuZXcgcHJvZ3JhbSkuXG4gICAgaWYgKG9sZFByb2dyYW0gJiYgb2xkUHJvZ3JhbS5wYXVzZWQpIHtcbiAgICAgIG9sZFByb2dyYW0udW5wYXVzZSgpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGRlZmF1bHRPcHRpb25zRm9yQXJjaCA9IHtcbiAgICAnd2ViLmNvcmRvdmEnOiB7XG4gICAgICBydW50aW1lQ29uZmlnT3ZlcnJpZGVzOiB7XG4gICAgICAgIC8vIFhYWCBXZSB1c2UgYWJzb2x1dGVVcmwoKSBoZXJlIHNvIHRoYXQgd2Ugc2VydmUgaHR0cHM6Ly9cbiAgICAgICAgLy8gVVJMcyB0byBjb3Jkb3ZhIGNsaWVudHMgaWYgZm9yY2Utc3NsIGlzIGluIHVzZS4gSWYgd2Ugd2VyZVxuICAgICAgICAvLyB0byB1c2UgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTCBpbnN0ZWFkIG9mXG4gICAgICAgIC8vIGFic29sdXRlVXJsKCksIHRoZW4gQ29yZG92YSBjbGllbnRzIHdvdWxkIGltbWVkaWF0ZWx5IGdldCBhXG4gICAgICAgIC8vIEhDUCBzZXR0aW5nIHRoZWlyIEREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIHRvXG4gICAgICAgIC8vIGh0dHA6Ly9leGFtcGxlLm1ldGVvci5jb20uIFRoaXMgYnJlYWtzIHRoZSBhcHAsIGJlY2F1c2VcbiAgICAgICAgLy8gZm9yY2Utc3NsIGRvZXNuJ3Qgc2VydmUgQ09SUyBoZWFkZXJzIG9uIDMwMlxuICAgICAgICAvLyByZWRpcmVjdHMuIChQbHVzIGl0J3MgdW5kZXNpcmFibGUgdG8gaGF2ZSBjbGllbnRzXG4gICAgICAgIC8vIGNvbm5lY3RpbmcgdG8gaHR0cDovL2V4YW1wbGUubWV0ZW9yLmNvbSB3aGVuIGZvcmNlLXNzbCBpc1xuICAgICAgICAvLyBpbiB1c2UuKVxuICAgICAgICBERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTDpcbiAgICAgICAgICBwcm9jZXNzLmVudi5NT0JJTEVfRERQX1VSTCB8fCBNZXRlb3IuYWJzb2x1dGVVcmwoKSxcbiAgICAgICAgUk9PVF9VUkw6IHByb2Nlc3MuZW52Lk1PQklMRV9ST09UX1VSTCB8fCBNZXRlb3IuYWJzb2x1dGVVcmwoKSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgICd3ZWIuYnJvd3Nlcic6IHtcbiAgICAgIHJ1bnRpbWVDb25maWdPdmVycmlkZXM6IHtcbiAgICAgICAgaXNNb2Rlcm46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICAnd2ViLmJyb3dzZXIubGVnYWN5Jzoge1xuICAgICAgcnVudGltZUNvbmZpZ092ZXJyaWRlczoge1xuICAgICAgICBpc01vZGVybjogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBUaGlzIGJvaWxlcnBsYXRlIHdpbGwgYmUgc2VydmVkIHRvIHRoZSBtb2JpbGUgZGV2aWNlcyB3aGVuIHVzZWQgd2l0aFxuICAgIC8vIE1ldGVvci9Db3Jkb3ZhIGZvciB0aGUgSG90LUNvZGUgUHVzaCBhbmQgc2luY2UgdGhlIGZpbGUgd2lsbCBiZSBzZXJ2ZWQgYnlcbiAgICAvLyB0aGUgZGV2aWNlJ3Mgc2VydmVyLCBpdCBpcyBpbXBvcnRhbnQgdG8gc2V0IHRoZSBERFAgdXJsIHRvIHRoZSBhY3R1YWxcbiAgICAvLyBNZXRlb3Igc2VydmVyIGFjY2VwdGluZyBERFAgY29ubmVjdGlvbnMgYW5kIG5vdCB0aGUgZGV2aWNlJ3MgZmlsZSBzZXJ2ZXIuXG4gICAgc3luY1F1ZXVlLnJ1blRhc2soZnVuY3Rpb24oKSB7XG4gICAgICBPYmplY3Qua2V5cyhXZWJBcHAuY2xpZW50UHJvZ3JhbXMpLmZvckVhY2goZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2gpO1xuICAgIH0pO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdlbmVyYXRlQm9pbGVycGxhdGVGb3JBcmNoKGFyY2gpIHtcbiAgICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgIGNvbnN0IGFkZGl0aW9uYWxPcHRpb25zID0gZGVmYXVsdE9wdGlvbnNGb3JBcmNoW2FyY2hdIHx8IHt9O1xuICAgIGNvbnN0IHsgYmFzZURhdGEgfSA9IChib2lsZXJwbGF0ZUJ5QXJjaFtcbiAgICAgIGFyY2hcbiAgICBdID0gV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGVJbnN0YW5jZShcbiAgICAgIGFyY2gsXG4gICAgICBwcm9ncmFtLm1hbmlmZXN0LFxuICAgICAgYWRkaXRpb25hbE9wdGlvbnNcbiAgICApKTtcbiAgICAvLyBXZSBuZWVkIHRoZSBydW50aW1lIGNvbmZpZyB3aXRoIG92ZXJyaWRlcyBmb3IgbWV0ZW9yX3J1bnRpbWVfY29uZmlnLmpzOlxuICAgIHByb2dyYW0ubWV0ZW9yUnVudGltZUNvbmZpZyA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIC4uLl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18sXG4gICAgICAuLi4oYWRkaXRpb25hbE9wdGlvbnMucnVudGltZUNvbmZpZ092ZXJyaWRlcyB8fCBudWxsKSxcbiAgICB9KTtcbiAgICBwcm9ncmFtLnJlZnJlc2hhYmxlQXNzZXRzID0gYmFzZURhdGEuY3NzLm1hcChmaWxlID0+ICh7XG4gICAgICB1cmw6IGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rKGZpbGUudXJsKSxcbiAgICB9KSk7XG4gIH1cblxuICBXZWJBcHBJbnRlcm5hbHMucmVsb2FkQ2xpZW50UHJvZ3JhbXMoKTtcblxuICAvLyB3ZWJzZXJ2ZXJcbiAgdmFyIGFwcCA9IGNvbm5lY3QoKTtcblxuICAvLyBQYWNrYWdlcyBhbmQgYXBwcyBjYW4gYWRkIGhhbmRsZXJzIHRoYXQgcnVuIGJlZm9yZSBhbnkgb3RoZXIgTWV0ZW9yXG4gIC8vIGhhbmRsZXJzIHZpYSBXZWJBcHAucmF3Q29ubmVjdEhhbmRsZXJzLlxuICB2YXIgcmF3Q29ubmVjdEhhbmRsZXJzID0gY29ubmVjdCgpO1xuICBhcHAudXNlKHJhd0Nvbm5lY3RIYW5kbGVycyk7XG5cbiAgLy8gQXV0by1jb21wcmVzcyBhbnkganNvbiwgamF2YXNjcmlwdCwgb3IgdGV4dC5cbiAgYXBwLnVzZShjb21wcmVzcyh7IGZpbHRlcjogc2hvdWxkQ29tcHJlc3MgfSkpO1xuXG4gIC8vIHBhcnNlIGNvb2tpZXMgaW50byBhbiBvYmplY3RcbiAgYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XG5cbiAgLy8gV2UncmUgbm90IGEgcHJveHk7IHJlamVjdCAod2l0aG91dCBjcmFzaGluZykgYXR0ZW1wdHMgdG8gdHJlYXQgdXMgbGlrZVxuICAvLyBvbmUuIChTZWUgIzEyMTIuKVxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKFJvdXRlUG9saWN5LmlzVmFsaWRVcmwocmVxLnVybCkpIHtcbiAgICAgIG5leHQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZCg0MDApO1xuICAgIHJlcy53cml0ZSgnTm90IGEgcHJveHknKTtcbiAgICByZXMuZW5kKCk7XG4gIH0pO1xuXG4gIC8vIFBhcnNlIHRoZSBxdWVyeSBzdHJpbmcgaW50byByZXMucXVlcnkuIFVzZWQgYnkgb2F1dGhfc2VydmVyLCBidXQgaXQnc1xuICAvLyBnZW5lcmFsbHkgcHJldHR5IGhhbmR5Li5cbiAgLy9cbiAgLy8gRG8gdGhpcyBiZWZvcmUgdGhlIG5leHQgbWlkZGxld2FyZSBkZXN0cm95cyByZXEudXJsIGlmIGEgcGF0aCBwcmVmaXhcbiAgLy8gaXMgc2V0IHRvIGNsb3NlICMxMDExMS5cbiAgYXBwLnVzZShmdW5jdGlvbihyZXF1ZXN0LCByZXNwb25zZSwgbmV4dCkge1xuICAgIHJlcXVlc3QucXVlcnkgPSBxcy5wYXJzZShwYXJzZVVybChyZXF1ZXN0LnVybCkucXVlcnkpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aFBhcnRzKHBhdGgpIHtcbiAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcbiAgICB3aGlsZSAocGFydHNbMF0gPT09ICcnKSBwYXJ0cy5zaGlmdCgpO1xuICAgIHJldHVybiBwYXJ0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUHJlZml4T2YocHJlZml4LCBhcnJheSkge1xuICAgIHJldHVybiAoXG4gICAgICBwcmVmaXgubGVuZ3RoIDw9IGFycmF5Lmxlbmd0aCAmJlxuICAgICAgcHJlZml4LmV2ZXJ5KChwYXJ0LCBpKSA9PiBwYXJ0ID09PSBhcnJheVtpXSlcbiAgICApO1xuICB9XG5cbiAgLy8gU3RyaXAgb2ZmIHRoZSBwYXRoIHByZWZpeCwgaWYgaXQgZXhpc3RzLlxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcXVlc3QsIHJlc3BvbnNlLCBuZXh0KSB7XG4gICAgY29uc3QgcGF0aFByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVg7XG4gICAgY29uc3QgeyBwYXRobmFtZSwgc2VhcmNoIH0gPSBwYXJzZVVybChyZXF1ZXN0LnVybCk7XG5cbiAgICAvLyBjaGVjayBpZiB0aGUgcGF0aCBpbiB0aGUgdXJsIHN0YXJ0cyB3aXRoIHRoZSBwYXRoIHByZWZpeFxuICAgIGlmIChwYXRoUHJlZml4KSB7XG4gICAgICBjb25zdCBwcmVmaXhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRoUHJlZml4KTtcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRobmFtZSk7XG4gICAgICBpZiAoaXNQcmVmaXhPZihwcmVmaXhQYXJ0cywgcGF0aFBhcnRzKSkge1xuICAgICAgICByZXF1ZXN0LnVybCA9ICcvJyArIHBhdGhQYXJ0cy5zbGljZShwcmVmaXhQYXJ0cy5sZW5ndGgpLmpvaW4oJy8nKTtcbiAgICAgICAgaWYgKHNlYXJjaCkge1xuICAgICAgICAgIHJlcXVlc3QudXJsICs9IHNlYXJjaDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwYXRobmFtZSA9PT0gJy9mYXZpY29uLmljbycgfHwgcGF0aG5hbWUgPT09ICcvcm9ib3RzLnR4dCcpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhQcmVmaXgpIHtcbiAgICAgIHJlc3BvbnNlLndyaXRlSGVhZCg0MDQpO1xuICAgICAgcmVzcG9uc2Uud3JpdGUoJ1Vua25vd24gcGF0aCcpO1xuICAgICAgcmVzcG9uc2UuZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9KTtcblxuICAvLyBTZXJ2ZSBzdGF0aWMgZmlsZXMgZnJvbSB0aGUgbWFuaWZlc3QuXG4gIC8vIFRoaXMgaXMgaW5zcGlyZWQgYnkgdGhlICdzdGF0aWMnIG1pZGRsZXdhcmUuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNNaWRkbGV3YXJlKFxuICAgICAgV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzQnlBcmNoLFxuICAgICAgcmVxLFxuICAgICAgcmVzLFxuICAgICAgbmV4dFxuICAgICk7XG4gIH0pO1xuXG4gIC8vIENvcmUgTWV0ZW9yIHBhY2thZ2VzIGxpa2UgZHluYW1pYy1pbXBvcnQgY2FuIGFkZCBoYW5kbGVycyBiZWZvcmVcbiAgLy8gb3RoZXIgaGFuZGxlcnMgYWRkZWQgYnkgcGFja2FnZSBhbmQgYXBwbGljYXRpb24gY29kZS5cbiAgYXBwLnVzZSgoV2ViQXBwSW50ZXJuYWxzLm1ldGVvckludGVybmFsSGFuZGxlcnMgPSBjb25uZWN0KCkpKTtcblxuICAvKipcbiAgICogQG5hbWUgY29ubmVjdEhhbmRsZXJzQ2FsbGJhY2socmVxLCByZXMsIG5leHQpXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGlzcHJvdG90eXBlIHRydWVcbiAgICogQHN1bW1hcnkgY2FsbGJhY2sgaGFuZGxlciBmb3IgYFdlYkFwcC5jb25uZWN0SGFuZGxlcnNgXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXFcbiAgICogYSBOb2RlLmpzXG4gICAqIFtJbmNvbWluZ01lc3NhZ2VdKGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2h0dHBfY2xhc3NfaHR0cF9pbmNvbWluZ21lc3NhZ2UpXG4gICAqIG9iamVjdCB3aXRoIHNvbWUgZXh0cmEgcHJvcGVydGllcy4gVGhpcyBhcmd1bWVudCBjYW4gYmUgdXNlZFxuICAgKiAgdG8gZ2V0IGluZm9ybWF0aW9uIGFib3V0IHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzXG4gICAqIGEgTm9kZS5qc1xuICAgKiBbU2VydmVyUmVzcG9uc2VdKGh0dHA6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjaHR0cF9jbGFzc19odHRwX3NlcnZlcnJlc3BvbnNlKVxuICAgKiBvYmplY3QuIFVzZSB0aGlzIHRvIHdyaXRlIGRhdGEgdGhhdCBzaG91bGQgYmUgc2VudCBpbiByZXNwb25zZSB0byB0aGVcbiAgICogcmVxdWVzdCwgYW5kIGNhbGwgYHJlcy5lbmQoKWAgd2hlbiB5b3UgYXJlIGRvbmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG5leHRcbiAgICogQ2FsbGluZyB0aGlzIGZ1bmN0aW9uIHdpbGwgcGFzcyBvbiB0aGUgaGFuZGxpbmcgb2ZcbiAgICogdGhpcyByZXF1ZXN0IHRvIHRoZSBuZXh0IHJlbGV2YW50IGhhbmRsZXIuXG4gICAqXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbWV0aG9kIGNvbm5lY3RIYW5kbGVyc1xuICAgKiBAbWVtYmVyb2YgV2ViQXBwXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBoYW5kbGVyIGZvciBhbGwgSFRUUCByZXF1ZXN0cy5cbiAgICogQHBhcmFtIHtTdHJpbmd9IFtwYXRoXVxuICAgKiBUaGlzIGhhbmRsZXIgd2lsbCBvbmx5IGJlIGNhbGxlZCBvbiBwYXRocyB0aGF0IG1hdGNoXG4gICAqIHRoaXMgc3RyaW5nLiBUaGUgbWF0Y2ggaGFzIHRvIGJvcmRlciBvbiBhIGAvYCBvciBhIGAuYC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGAvaGVsbG9gIHdpbGwgbWF0Y2ggYC9oZWxsby93b3JsZGAgYW5kXG4gICAqIGAvaGVsbG8ud29ybGRgLCBidXQgbm90IGAvaGVsbG9fd29ybGRgLlxuICAgKiBAcGFyYW0ge2Nvbm5lY3RIYW5kbGVyc0NhbGxiYWNrfSBoYW5kbGVyXG4gICAqIEEgaGFuZGxlciBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIG9uIEhUVFAgcmVxdWVzdHMuXG4gICAqIFNlZSBgY29ubmVjdEhhbmRsZXJzQ2FsbGJhY2tgXG4gICAqXG4gICAqL1xuICAvLyBQYWNrYWdlcyBhbmQgYXBwcyBjYW4gYWRkIGhhbmRsZXJzIHRvIHRoaXMgdmlhIFdlYkFwcC5jb25uZWN0SGFuZGxlcnMuXG4gIC8vIFRoZXkgYXJlIGluc2VydGVkIGJlZm9yZSBvdXIgZGVmYXVsdCBoYW5kbGVyLlxuICB2YXIgcGFja2FnZUFuZEFwcEhhbmRsZXJzID0gY29ubmVjdCgpO1xuICBhcHAudXNlKHBhY2thZ2VBbmRBcHBIYW5kbGVycyk7XG5cbiAgdmFyIHN1cHByZXNzQ29ubmVjdEVycm9ycyA9IGZhbHNlO1xuICAvLyBjb25uZWN0IGtub3dzIGl0IGlzIGFuIGVycm9yIGhhbmRsZXIgYmVjYXVzZSBpdCBoYXMgNCBhcmd1bWVudHMgaW5zdGVhZCBvZlxuICAvLyAzLiBnbyBmaWd1cmUuICAoSXQgaXMgbm90IHNtYXJ0IGVub3VnaCB0byBmaW5kIHN1Y2ggYSB0aGluZyBpZiBpdCdzIGhpZGRlblxuICAvLyBpbnNpZGUgcGFja2FnZUFuZEFwcEhhbmRsZXJzLilcbiAgYXBwLnVzZShmdW5jdGlvbihlcnIsIHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKCFlcnIgfHwgIXN1cHByZXNzQ29ubmVjdEVycm9ycyB8fCAhcmVxLmhlYWRlcnNbJ3gtc3VwcHJlc3MtZXJyb3InXSkge1xuICAgICAgbmV4dChlcnIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXMud3JpdGVIZWFkKGVyci5zdGF0dXMsIHsgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJyB9KTtcbiAgICByZXMuZW5kKCdBbiBlcnJvciBtZXNzYWdlJyk7XG4gIH0pO1xuXG4gIGFwcC51c2UoYXN5bmMgZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICBpZiAoIWFwcFVybChyZXEudXJsKSkge1xuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgcmVxLm1ldGhvZCAhPT0gJ0hFQUQnICYmXG4gICAgICByZXEubWV0aG9kICE9PSAnR0VUJyAmJlxuICAgICAgIU1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8ud2ViYXBwPy5hbHdheXNSZXR1cm5Db250ZW50XG4gICAgKSB7XG4gICAgICBjb25zdCBzdGF0dXMgPSByZXEubWV0aG9kID09PSAnT1BUSU9OUycgPyAyMDAgOiA0MDU7XG4gICAgICByZXMud3JpdGVIZWFkKHN0YXR1cywge1xuICAgICAgICBBbGxvdzogJ09QVElPTlMsIEdFVCwgSEVBRCcsXG4gICAgICAgICdDb250ZW50LUxlbmd0aCc6ICcwJyxcbiAgICAgIH0pO1xuICAgICAgcmVzLmVuZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgaGVhZGVycyA9IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2h0bWw7IGNoYXJzZXQ9dXRmLTgnLFxuICAgICAgfTtcblxuICAgICAgaWYgKHNodXR0aW5nRG93bikge1xuICAgICAgICBoZWFkZXJzWydDb25uZWN0aW9uJ10gPSAnQ2xvc2UnO1xuICAgICAgfVxuXG4gICAgICB2YXIgcmVxdWVzdCA9IFdlYkFwcC5jYXRlZ29yaXplUmVxdWVzdChyZXEpO1xuXG4gICAgICBpZiAocmVxdWVzdC51cmwucXVlcnkgJiYgcmVxdWVzdC51cmwucXVlcnlbJ21ldGVvcl9jc3NfcmVzb3VyY2UnXSkge1xuICAgICAgICAvLyBJbiB0aGlzIGNhc2UsIHdlJ3JlIHJlcXVlc3RpbmcgYSBDU1MgcmVzb3VyY2UgaW4gdGhlIG1ldGVvci1zcGVjaWZpY1xuICAgICAgICAvLyB3YXksIGJ1dCB3ZSBkb24ndCBoYXZlIGl0LiAgU2VydmUgYSBzdGF0aWMgY3NzIGZpbGUgdGhhdCBpbmRpY2F0ZXMgdGhhdFxuICAgICAgICAvLyB3ZSBkaWRuJ3QgaGF2ZSBpdCwgc28gd2UgY2FuIGRldGVjdCB0aGF0IGFuZCByZWZyZXNoLiAgTWFrZSBzdXJlXG4gICAgICAgIC8vIHRoYXQgYW55IHByb3hpZXMgb3IgQ0ROcyBkb24ndCBjYWNoZSB0aGlzIGVycm9yISAgKE5vcm1hbGx5IHByb3hpZXNcbiAgICAgICAgLy8gb3IgQ0ROcyBhcmUgc21hcnQgZW5vdWdoIG5vdCB0byBjYWNoZSBlcnJvciBwYWdlcywgYnV0IGluIG9yZGVyIHRvXG4gICAgICAgIC8vIG1ha2UgdGhpcyBoYWNrIHdvcmssIHdlIG5lZWQgdG8gcmV0dXJuIHRoZSBDU1MgZmlsZSBhcyBhIDIwMCwgd2hpY2hcbiAgICAgICAgLy8gd291bGQgb3RoZXJ3aXNlIGJlIGNhY2hlZC4pXG4gICAgICAgIGhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gJ3RleHQvY3NzOyBjaGFyc2V0PXV0Zi04JztcbiAgICAgICAgaGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcbiAgICAgICAgcmVzLndyaXRlSGVhZCgyMDAsIGhlYWRlcnMpO1xuICAgICAgICByZXMud3JpdGUoJy5tZXRlb3ItY3NzLW5vdC1mb3VuZC1lcnJvciB7IHdpZHRoOiAwcHg7fScpO1xuICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlcXVlc3QudXJsLnF1ZXJ5ICYmIHJlcXVlc3QudXJsLnF1ZXJ5WydtZXRlb3JfanNfcmVzb3VyY2UnXSkge1xuICAgICAgICAvLyBTaW1pbGFybHksIHdlJ3JlIHJlcXVlc3RpbmcgYSBKUyByZXNvdXJjZSB0aGF0IHdlIGRvbid0IGhhdmUuXG4gICAgICAgIC8vIFNlcnZlIGFuIHVuY2FjaGVkIDQwNC4gKFdlIGNhbid0IHVzZSB0aGUgc2FtZSBoYWNrIHdlIHVzZSBmb3IgQ1NTLFxuICAgICAgICAvLyBiZWNhdXNlIGFjdHVhbGx5IGFjdGluZyBvbiB0aGF0IGhhY2sgcmVxdWlyZXMgdXMgdG8gaGF2ZSB0aGUgSlNcbiAgICAgICAgLy8gYWxyZWFkeSEpXG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCBoZWFkZXJzKTtcbiAgICAgICAgcmVzLmVuZCgnNDA0IE5vdCBGb3VuZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXF1ZXN0LnVybC5xdWVyeSAmJiByZXF1ZXN0LnVybC5xdWVyeVsnbWV0ZW9yX2RvbnRfc2VydmVfaW5kZXgnXSkge1xuICAgICAgICAvLyBXaGVuIGRvd25sb2FkaW5nIGZpbGVzIGR1cmluZyBhIENvcmRvdmEgaG90IGNvZGUgcHVzaCwgd2UgbmVlZFxuICAgICAgICAvLyB0byBkZXRlY3QgaWYgYSBmaWxlIGlzIG5vdCBhdmFpbGFibGUgaW5zdGVhZCBvZiBpbmFkdmVydGVudGx5XG4gICAgICAgIC8vIGRvd25sb2FkaW5nIHRoZSBkZWZhdWx0IGluZGV4IHBhZ2UuXG4gICAgICAgIC8vIFNvIHNpbWlsYXIgdG8gdGhlIHNpdHVhdGlvbiBhYm92ZSwgd2Ugc2VydmUgYW4gdW5jYWNoZWQgNDA0LlxuICAgICAgICBoZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAnbm8tY2FjaGUnO1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgaGVhZGVycyk7XG4gICAgICAgIHJlcy5lbmQoJzQwNCBOb3QgRm91bmQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGFyY2ggfSA9IHJlcXVlc3Q7XG4gICAgICBhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIGFyY2gsICdzdHJpbmcnLCB7IGFyY2ggfSk7XG5cbiAgICAgIGlmICghaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgICAgICAvLyBXZSBjb3VsZCBjb21lIGhlcmUgaW4gY2FzZSB3ZSBydW4gd2l0aCBzb21lIGFyY2hpdGVjdHVyZXMgZXhjbHVkZWRcbiAgICAgICAgaGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcbiAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIGhlYWRlcnMpO1xuICAgICAgICBpZiAoTWV0ZW9yLmlzRGV2ZWxvcG1lbnQpIHtcbiAgICAgICAgICByZXMuZW5kKGBObyBjbGllbnQgcHJvZ3JhbSBmb3VuZCBmb3IgdGhlICR7YXJjaH0gYXJjaGl0ZWN0dXJlLmApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFNhZmV0eSBuZXQsIGJ1dCB0aGlzIGJyYW5jaCBzaG91bGQgbm90IGJlIHBvc3NpYmxlLlxuICAgICAgICAgIHJlcy5lbmQoJzQwNCBOb3QgRm91bmQnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHBhdXNlQ2xpZW50KGFyY2gpIGhhcyBiZWVuIGNhbGxlZCwgcHJvZ3JhbS5wYXVzZWQgd2lsbCBiZSBhXG4gICAgICAvLyBQcm9taXNlIHRoYXQgd2lsbCBiZSByZXNvbHZlZCB3aGVuIHRoZSBwcm9ncmFtIGlzIHVucGF1c2VkLlxuICAgICAgYXdhaXQgV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdLnBhdXNlZDtcblxuICAgICAgcmV0dXJuIGdldEJvaWxlcnBsYXRlQXN5bmMocmVxdWVzdCwgYXJjaClcbiAgICAgICAgLnRoZW4oKHsgc3RyZWFtLCBzdGF0dXNDb2RlLCBoZWFkZXJzOiBuZXdIZWFkZXJzIH0pID0+IHtcbiAgICAgICAgICBpZiAoIXN0YXR1c0NvZGUpIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGUgPSByZXMuc3RhdHVzQ29kZSA/IHJlcy5zdGF0dXNDb2RlIDogMjAwO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChuZXdIZWFkZXJzKSB7XG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKGhlYWRlcnMsIG5ld0hlYWRlcnMpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJlcy53cml0ZUhlYWQoc3RhdHVzQ29kZSwgaGVhZGVycyk7XG5cbiAgICAgICAgICBzdHJlYW0ucGlwZShyZXMsIHtcbiAgICAgICAgICAgIC8vIEVuZCB0aGUgcmVzcG9uc2Ugd2hlbiB0aGUgc3RyZWFtIGVuZHMuXG4gICAgICAgICAgICBlbmQ6IHRydWUsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgTG9nLmVycm9yKCdFcnJvciBydW5uaW5nIHRlbXBsYXRlOiAnICsgZXJyb3Iuc3RhY2spO1xuICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCBoZWFkZXJzKTtcbiAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gUmV0dXJuIDQwNCBieSBkZWZhdWx0LCBpZiBubyBvdGhlciBoYW5kbGVycyBzZXJ2ZSB0aGlzIFVSTC5cbiAgYXBwLnVzZShmdW5jdGlvbihyZXEsIHJlcykge1xuICAgIHJlcy53cml0ZUhlYWQoNDA0KTtcbiAgICByZXMuZW5kKCk7XG4gIH0pO1xuXG4gIHZhciBodHRwU2VydmVyID0gY3JlYXRlU2VydmVyKGFwcCk7XG4gIHZhciBvbkxpc3RlbmluZ0NhbGxiYWNrcyA9IFtdO1xuXG4gIC8vIEFmdGVyIDUgc2Vjb25kcyB3L28gZGF0YSBvbiBhIHNvY2tldCwga2lsbCBpdC4gIE9uIHRoZSBvdGhlciBoYW5kLCBpZlxuICAvLyB0aGVyZSdzIGFuIG91dHN0YW5kaW5nIHJlcXVlc3QsIGdpdmUgaXQgYSBoaWdoZXIgdGltZW91dCBpbnN0ZWFkICh0byBhdm9pZFxuICAvLyBraWxsaW5nIGxvbmctcG9sbGluZyByZXF1ZXN0cylcbiAgaHR0cFNlcnZlci5zZXRUaW1lb3V0KFNIT1JUX1NPQ0tFVF9USU1FT1VUKTtcblxuICAvLyBEbyB0aGlzIGhlcmUsIGFuZCB0aGVuIGFsc28gaW4gbGl2ZWRhdGEvc3RyZWFtX3NlcnZlci5qcywgYmVjYXVzZVxuICAvLyBzdHJlYW1fc2VydmVyLmpzIGtpbGxzIGFsbCB0aGUgY3VycmVudCByZXF1ZXN0IGhhbmRsZXJzIHdoZW4gaW5zdGFsbGluZyBpdHNcbiAgLy8gb3duLlxuICBodHRwU2VydmVyLm9uKCdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gSWYgdGhlIGNsaWVudCBnYXZlIHVzIGEgYmFkIHJlcXVlc3QsIHRlbGwgaXQgaW5zdGVhZCBvZiBqdXN0IGNsb3NpbmcgdGhlXG4gIC8vIHNvY2tldC4gVGhpcyBsZXRzIGxvYWQgYmFsYW5jZXJzIGluIGZyb250IG9mIHVzIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBcImFcbiAgLy8gc2VydmVyIGlzIHJhbmRvbWx5IGNsb3Npbmcgc29ja2V0cyBmb3Igbm8gcmVhc29uXCIgYW5kIFwiY2xpZW50IHNlbnQgYSBiYWRcbiAgLy8gcmVxdWVzdFwiLlxuICAvL1xuICAvLyBUaGlzIHdpbGwgb25seSB3b3JrIG9uIE5vZGUgNjsgTm9kZSA0IGRlc3Ryb3lzIHRoZSBzb2NrZXQgYmVmb3JlIGNhbGxpbmdcbiAgLy8gdGhpcyBldmVudC4gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzQ1NTcvIGZvciBkZXRhaWxzLlxuICBodHRwU2VydmVyLm9uKCdjbGllbnRFcnJvcicsIChlcnIsIHNvY2tldCkgPT4ge1xuICAgIC8vIFByZS1Ob2RlLTYsIGRvIG5vdGhpbmcuXG4gICAgaWYgKHNvY2tldC5kZXN0cm95ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXJyLm1lc3NhZ2UgPT09ICdQYXJzZSBFcnJvcicpIHtcbiAgICAgIHNvY2tldC5lbmQoJ0hUVFAvMS4xIDQwMCBCYWQgUmVxdWVzdFxcclxcblxcclxcbicpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBGb3Igb3RoZXIgZXJyb3JzLCB1c2UgdGhlIGRlZmF1bHQgYmVoYXZpb3IgYXMgaWYgd2UgaGFkIG5vIGNsaWVudEVycm9yXG4gICAgICAvLyBoYW5kbGVyLlxuICAgICAgc29ja2V0LmRlc3Ryb3koZXJyKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHN0YXJ0IHVwIGFwcFxuICBfLmV4dGVuZChXZWJBcHAsIHtcbiAgICBjb25uZWN0SGFuZGxlcnM6IHBhY2thZ2VBbmRBcHBIYW5kbGVycyxcbiAgICByYXdDb25uZWN0SGFuZGxlcnM6IHJhd0Nvbm5lY3RIYW5kbGVycyxcbiAgICBodHRwU2VydmVyOiBodHRwU2VydmVyLFxuICAgIGNvbm5lY3RBcHA6IGFwcCxcbiAgICAvLyBGb3IgdGVzdGluZy5cbiAgICBzdXBwcmVzc0Nvbm5lY3RFcnJvcnM6IGZ1bmN0aW9uKCkge1xuICAgICAgc3VwcHJlc3NDb25uZWN0RXJyb3JzID0gdHJ1ZTtcbiAgICB9LFxuICAgIG9uTGlzdGVuaW5nOiBmdW5jdGlvbihmKSB7XG4gICAgICBpZiAob25MaXN0ZW5pbmdDYWxsYmFja3MpIG9uTGlzdGVuaW5nQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgICBlbHNlIGYoKTtcbiAgICB9LFxuICAgIC8vIFRoaXMgY2FuIGJlIG92ZXJyaWRkZW4gYnkgdXNlcnMgd2hvIHdhbnQgdG8gbW9kaWZ5IGhvdyBsaXN0ZW5pbmcgd29ya3NcbiAgICAvLyAoZWcsIHRvIHJ1biBhIHByb3h5IGxpa2UgQXBvbGxvIEVuZ2luZSBQcm94eSBpbiBmcm9udCBvZiB0aGUgc2VydmVyKS5cbiAgICBzdGFydExpc3RlbmluZzogZnVuY3Rpb24oaHR0cFNlcnZlciwgbGlzdGVuT3B0aW9ucywgY2IpIHtcbiAgICAgIGh0dHBTZXJ2ZXIubGlzdGVuKGxpc3Rlbk9wdGlvbnMsIGNiKTtcbiAgICB9LFxuICB9KTtcblxuICAvLyBMZXQgdGhlIHJlc3Qgb2YgdGhlIHBhY2thZ2VzIChhbmQgTWV0ZW9yLnN0YXJ0dXAgaG9va3MpIGluc2VydCBjb25uZWN0XG4gIC8vIG1pZGRsZXdhcmVzIGFuZCB1cGRhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXywgdGhlbiBrZWVwIGdvaW5nIHRvIHNldCB1cFxuICAvLyBhY3R1YWxseSBzZXJ2aW5nIEhUTUwuXG4gIGV4cG9ydHMubWFpbiA9IGFyZ3YgPT4ge1xuICAgIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG5cbiAgICBjb25zdCBzdGFydEh0dHBTZXJ2ZXIgPSBsaXN0ZW5PcHRpb25zID0+IHtcbiAgICAgIFdlYkFwcC5zdGFydExpc3RlbmluZyhcbiAgICAgICAgaHR0cFNlcnZlcixcbiAgICAgICAgbGlzdGVuT3B0aW9ucyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTUVURU9SX1BSSU5UX09OX0xJU1RFTikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnTElTVEVOSU5HJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFja3MgPSBvbkxpc3RlbmluZ0NhbGxiYWNrcztcbiAgICAgICAgICAgIG9uTGlzdGVuaW5nQ2FsbGJhY2tzID0gbnVsbDtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsaXN0ZW5pbmc6JywgZSk7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUgJiYgZS5zdGFjayk7XG4gICAgICAgICAgfVxuICAgICAgICApXG4gICAgICApO1xuICAgIH07XG5cbiAgICBsZXQgbG9jYWxQb3J0ID0gcHJvY2Vzcy5lbnYuUE9SVCB8fCAwO1xuICAgIGxldCB1bml4U29ja2V0UGF0aCA9IHByb2Nlc3MuZW52LlVOSVhfU09DS0VUX1BBVEg7XG5cbiAgICBpZiAodW5peFNvY2tldFBhdGgpIHtcbiAgICAgIGlmIChjbHVzdGVyLmlzV29ya2VyKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlck5hbWUgPSBjbHVzdGVyLndvcmtlci5wcm9jZXNzLmVudi5uYW1lIHx8IGNsdXN0ZXIud29ya2VyLmlkO1xuICAgICAgICB1bml4U29ja2V0UGF0aCArPSAnLicgKyB3b3JrZXJOYW1lICsgJy5zb2NrJztcbiAgICAgIH1cbiAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBhIHNvY2tldCBmaWxlLlxuICAgICAgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlKHVuaXhTb2NrZXRQYXRoKTtcbiAgICAgIHN0YXJ0SHR0cFNlcnZlcih7IHBhdGg6IHVuaXhTb2NrZXRQYXRoIH0pO1xuXG4gICAgICBjb25zdCB1bml4U29ja2V0UGVybWlzc2lvbnMgPSAoXG4gICAgICAgIHByb2Nlc3MuZW52LlVOSVhfU09DS0VUX1BFUk1JU1NJT05TIHx8ICcnXG4gICAgICApLnRyaW0oKTtcbiAgICAgIGlmICh1bml4U29ja2V0UGVybWlzc2lvbnMpIHtcbiAgICAgICAgaWYgKC9eWzAtN117M30kLy50ZXN0KHVuaXhTb2NrZXRQZXJtaXNzaW9ucykpIHtcbiAgICAgICAgICBjaG1vZFN5bmModW5peFNvY2tldFBhdGgsIHBhcnNlSW50KHVuaXhTb2NrZXRQZXJtaXNzaW9ucywgOCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVTklYX1NPQ0tFVF9QRVJNSVNTSU9OUyBzcGVjaWZpZWQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCB1bml4U29ja2V0R3JvdXAgPSAocHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfR1JPVVAgfHwgJycpLnRyaW0oKTtcbiAgICAgIGlmICh1bml4U29ja2V0R3JvdXApIHtcbiAgICAgICAgLy93aG9tc3QgYXV0b21hdGljYWxseSBoYW5kbGVzIGJvdGggZ3JvdXAgbmFtZXMgYW5kIG51bWVyaWNhbCBnaWRzXG4gICAgICAgIGNvbnN0IHVuaXhTb2NrZXRHcm91cEluZm8gPSB3aG9tc3Quc3luYy5ncm91cCh1bml4U29ja2V0R3JvdXApO1xuICAgICAgICBpZiAodW5peFNvY2tldEdyb3VwSW5mbyA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVTklYX1NPQ0tFVF9HUk9VUCBuYW1lIHNwZWNpZmllZCcpO1xuICAgICAgICB9XG4gICAgICAgIGNob3duU3luYyh1bml4U29ja2V0UGF0aCwgdXNlckluZm8oKS51aWQsIHVuaXhTb2NrZXRHcm91cEluZm8uZ2lkKTtcbiAgICAgIH1cblxuICAgICAgcmVnaXN0ZXJTb2NrZXRGaWxlQ2xlYW51cCh1bml4U29ja2V0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsUG9ydCA9IGlzTmFOKE51bWJlcihsb2NhbFBvcnQpKSA/IGxvY2FsUG9ydCA6IE51bWJlcihsb2NhbFBvcnQpO1xuICAgICAgaWYgKC9cXFxcXFxcXD8uK1xcXFxwaXBlXFxcXD8uKy8udGVzdChsb2NhbFBvcnQpKSB7XG4gICAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBXaW5kb3dzIFNlcnZlciBzdHlsZSBuYW1lZCBwaXBlLlxuICAgICAgICBzdGFydEh0dHBTZXJ2ZXIoeyBwYXRoOiBsb2NhbFBvcnQgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBsb2NhbFBvcnQgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBUQ1AuXG4gICAgICAgIHN0YXJ0SHR0cFNlcnZlcih7XG4gICAgICAgICAgcG9ydDogbG9jYWxQb3J0LFxuICAgICAgICAgIGhvc3Q6IHByb2Nlc3MuZW52LkJJTkRfSVAgfHwgJzAuMC4wLjAnLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBQT1JUIHNwZWNpZmllZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAnREFFTU9OJztcbiAgfTtcbn1cblxudmFyIGlubGluZVNjcmlwdHNBbGxvd2VkID0gdHJ1ZTtcblxuV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBpbmxpbmVTY3JpcHRzQWxsb3dlZDtcbn07XG5cbldlYkFwcEludGVybmFscy5zZXRJbmxpbmVTY3JpcHRzQWxsb3dlZCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlubGluZVNjcmlwdHNBbGxvd2VkID0gdmFsdWU7XG4gIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG52YXIgc3JpTW9kZTtcblxuV2ViQXBwSW50ZXJuYWxzLmVuYWJsZVN1YnJlc291cmNlSW50ZWdyaXR5ID0gZnVuY3Rpb24odXNlX2NyZWRlbnRpYWxzID0gZmFsc2UpIHtcbiAgc3JpTW9kZSA9IHVzZV9jcmVkZW50aWFscyA/ICd1c2UtY3JlZGVudGlhbHMnIDogJ2Fub255bW91cyc7XG4gIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0QnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBmdW5jdGlvbihob29rRm4pIHtcbiAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBob29rRm47XG4gIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0QnVuZGxlZEpzQ3NzUHJlZml4ID0gZnVuY3Rpb24ocHJlZml4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5zZXRCdW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gcHJlZml4ICsgdXJsO1xuICB9KTtcbn07XG5cbi8vIFBhY2thZ2VzIGNhbiBjYWxsIGBXZWJBcHBJbnRlcm5hbHMuYWRkU3RhdGljSnNgIHRvIHNwZWNpZnkgc3RhdGljXG4vLyBKYXZhU2NyaXB0IHRvIGJlIGluY2x1ZGVkIGluIHRoZSBhcHAuIFRoaXMgc3RhdGljIEpTIHdpbGwgYmUgaW5saW5lZCxcbi8vIHVubGVzcyBpbmxpbmUgc2NyaXB0cyBoYXZlIGJlZW4gZGlzYWJsZWQsIGluIHdoaWNoIGNhc2UgaXQgd2lsbCBiZVxuLy8gc2VydmVkIHVuZGVyIGAvPHNoYTEgb2YgY29udGVudHM+YC5cbnZhciBhZGRpdGlvbmFsU3RhdGljSnMgPSB7fTtcbldlYkFwcEludGVybmFscy5hZGRTdGF0aWNKcyA9IGZ1bmN0aW9uKGNvbnRlbnRzKSB7XG4gIGFkZGl0aW9uYWxTdGF0aWNKc1snLycgKyBzaGExKGNvbnRlbnRzKSArICcuanMnXSA9IGNvbnRlbnRzO1xufTtcblxuLy8gRXhwb3J0ZWQgZm9yIHRlc3RzXG5XZWJBcHBJbnRlcm5hbHMuZ2V0Qm9pbGVycGxhdGUgPSBnZXRCb2lsZXJwbGF0ZTtcbldlYkFwcEludGVybmFscy5hZGRpdGlvbmFsU3RhdGljSnMgPSBhZGRpdGlvbmFsU3RhdGljSnM7XG5cbi8vIFN0YXJ0IHRoZSBzZXJ2ZXIhXG5ydW5XZWJBcHBTZXJ2ZXIoKTtcbiIsImltcG9ydCBucG1Db25uZWN0IGZyb20gXCJjb25uZWN0XCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25uZWN0KC4uLmNvbm5lY3RBcmdzKSB7XG4gIGNvbnN0IGhhbmRsZXJzID0gbnBtQ29ubmVjdC5hcHBseSh0aGlzLCBjb25uZWN0QXJncyk7XG4gIGNvbnN0IG9yaWdpbmFsVXNlID0gaGFuZGxlcnMudXNlO1xuXG4gIC8vIFdyYXAgdGhlIGhhbmRsZXJzLnVzZSBtZXRob2Qgc28gdGhhdCBhbnkgcHJvdmlkZWQgaGFuZGxlciBmdW5jdGlvbnNcbiAgLy8gYWx3YXlzIHJ1biBpbiBhIEZpYmVyLlxuICBoYW5kbGVycy51c2UgPSBmdW5jdGlvbiB1c2UoLi4udXNlQXJncykge1xuICAgIGNvbnN0IHsgc3RhY2sgfSA9IHRoaXM7XG4gICAgY29uc3Qgb3JpZ2luYWxMZW5ndGggPSBzdGFjay5sZW5ndGg7XG4gICAgY29uc3QgcmVzdWx0ID0gb3JpZ2luYWxVc2UuYXBwbHkodGhpcywgdXNlQXJncyk7XG5cbiAgICAvLyBJZiB3ZSBqdXN0IGFkZGVkIGFueXRoaW5nIHRvIHRoZSBzdGFjaywgd3JhcCBlYWNoIG5ldyBlbnRyeS5oYW5kbGVcbiAgICAvLyB3aXRoIGEgZnVuY3Rpb24gdGhhdCBjYWxscyBQcm9taXNlLmFzeW5jQXBwbHkgdG8gZW5zdXJlIHRoZVxuICAgIC8vIG9yaWdpbmFsIGhhbmRsZXIgcnVucyBpbiBhIEZpYmVyLlxuICAgIGZvciAobGV0IGkgPSBvcmlnaW5hbExlbmd0aDsgaSA8IHN0YWNrLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHN0YWNrW2ldO1xuICAgICAgY29uc3Qgb3JpZ2luYWxIYW5kbGUgPSBlbnRyeS5oYW5kbGU7XG5cbiAgICAgIGlmIChvcmlnaW5hbEhhbmRsZS5sZW5ndGggPj0gNCkge1xuICAgICAgICAvLyBJZiB0aGUgb3JpZ2luYWwgaGFuZGxlIGhhZCBmb3VyIChvciBtb3JlKSBwYXJhbWV0ZXJzLCB0aGVcbiAgICAgICAgLy8gd3JhcHBlciBtdXN0IGFsc28gaGF2ZSBmb3VyIHBhcmFtZXRlcnMsIHNpbmNlIGNvbm5lY3QgdXNlc1xuICAgICAgICAvLyBoYW5kbGUubGVuZ3RoIHRvIGRldGVybWluZSB3aGV0aGVyIHRvIHBhc3MgdGhlIGVycm9yIGFzIHRoZSBmaXJzdFxuICAgICAgICAvLyBhcmd1bWVudCB0byB0aGUgaGFuZGxlIGZ1bmN0aW9uLlxuICAgICAgICBlbnRyeS5oYW5kbGUgPSBmdW5jdGlvbiBoYW5kbGUoZXJyLCByZXEsIHJlcywgbmV4dCkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLmFzeW5jQXBwbHkob3JpZ2luYWxIYW5kbGUsIHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbnRyeS5oYW5kbGUgPSBmdW5jdGlvbiBoYW5kbGUocmVxLCByZXMsIG5leHQpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hc3luY0FwcGx5KG9yaWdpbmFsSGFuZGxlLCB0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgcmV0dXJuIGhhbmRsZXJzO1xufVxuIiwiaW1wb3J0IHsgc3RhdFN5bmMsIHVubGlua1N5bmMsIGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5cbi8vIFNpbmNlIGEgbmV3IHNvY2tldCBmaWxlIHdpbGwgYmUgY3JlYXRlZCB3aGVuIHRoZSBIVFRQIHNlcnZlclxuLy8gc3RhcnRzIHVwLCBpZiBmb3VuZCByZW1vdmUgdGhlIGV4aXN0aW5nIGZpbGUuXG4vL1xuLy8gV0FSTklORzpcbi8vIFRoaXMgd2lsbCByZW1vdmUgdGhlIGNvbmZpZ3VyZWQgc29ja2V0IGZpbGUgd2l0aG91dCB3YXJuaW5nLiBJZlxuLy8gdGhlIGNvbmZpZ3VyZWQgc29ja2V0IGZpbGUgaXMgYWxyZWFkeSBpbiB1c2UgYnkgYW5vdGhlciBhcHBsaWNhdGlvbixcbi8vIGl0IHdpbGwgc3RpbGwgYmUgcmVtb3ZlZC4gTm9kZSBkb2VzIG5vdCBwcm92aWRlIGEgcmVsaWFibGUgd2F5IHRvXG4vLyBkaWZmZXJlbnRpYXRlIGJldHdlZW4gYSBzb2NrZXQgZmlsZSB0aGF0IGlzIGFscmVhZHkgaW4gdXNlIGJ5XG4vLyBhbm90aGVyIGFwcGxpY2F0aW9uIG9yIGEgc3RhbGUgc29ja2V0IGZpbGUgdGhhdCBoYXMgYmVlblxuLy8gbGVmdCBvdmVyIGFmdGVyIGEgU0lHS0lMTC4gU2luY2Ugd2UgaGF2ZSBubyByZWxpYWJsZSB3YXkgdG9cbi8vIGRpZmZlcmVudGlhdGUgYmV0d2VlbiB0aGVzZSB0d28gc2NlbmFyaW9zLCB0aGUgYmVzdCBjb3Vyc2Ugb2Zcbi8vIGFjdGlvbiBkdXJpbmcgc3RhcnR1cCBpcyB0byByZW1vdmUgYW55IGV4aXN0aW5nIHNvY2tldCBmaWxlLiBUaGlzXG4vLyBpcyBub3QgdGhlIHNhZmVzdCBjb3Vyc2Ugb2YgYWN0aW9uIGFzIHJlbW92aW5nIHRoZSBleGlzdGluZyBzb2NrZXRcbi8vIGZpbGUgY291bGQgaW1wYWN0IGFuIGFwcGxpY2F0aW9uIHVzaW5nIGl0LCBidXQgdGhpcyBhcHByb2FjaCBoZWxwc1xuLy8gZW5zdXJlIHRoZSBIVFRQIHNlcnZlciBjYW4gc3RhcnR1cCB3aXRob3V0IG1hbnVhbFxuLy8gaW50ZXJ2ZW50aW9uIChlLmcuIGFza2luZyBmb3IgdGhlIHZlcmlmaWNhdGlvbiBhbmQgY2xlYW51cCBvZiBzb2NrZXRcbi8vIGZpbGVzIGJlZm9yZSBhbGxvd2luZyB0aGUgSFRUUCBzZXJ2ZXIgdG8gYmUgc3RhcnRlZCkuXG4vL1xuLy8gVGhlIGFib3ZlIGJlaW5nIHNhaWQsIGFzIGxvbmcgYXMgdGhlIHNvY2tldCBmaWxlIHBhdGggaXNcbi8vIGNvbmZpZ3VyZWQgY2FyZWZ1bGx5IHdoZW4gdGhlIGFwcGxpY2F0aW9uIGlzIGRlcGxveWVkIChhbmQgZXh0cmFcbi8vIGNhcmUgaXMgdGFrZW4gdG8gbWFrZSBzdXJlIHRoZSBjb25maWd1cmVkIHBhdGggaXMgdW5pcXVlIGFuZCBkb2Vzbid0XG4vLyBjb25mbGljdCB3aXRoIGFub3RoZXIgc29ja2V0IGZpbGUgcGF0aCksIHRoZW4gdGhlcmUgc2hvdWxkIG5vdCBiZVxuLy8gYW55IGlzc3VlcyB3aXRoIHRoaXMgYXBwcm9hY2guXG5leHBvcnQgY29uc3QgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlID0gKHNvY2tldFBhdGgpID0+IHtcbiAgdHJ5IHtcbiAgICBpZiAoc3RhdFN5bmMoc29ja2V0UGF0aCkuaXNTb2NrZXQoKSkge1xuICAgICAgLy8gU2luY2UgYSBuZXcgc29ja2V0IGZpbGUgd2lsbCBiZSBjcmVhdGVkLCByZW1vdmUgdGhlIGV4aXN0aW5nXG4gICAgICAvLyBmaWxlLlxuICAgICAgdW5saW5rU3luYyhzb2NrZXRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQW4gZXhpc3RpbmcgZmlsZSB3YXMgZm91bmQgYXQgXCIke3NvY2tldFBhdGh9XCIgYW5kIGl0IGlzIG5vdCBgICtcbiAgICAgICAgJ2Egc29ja2V0IGZpbGUuIFBsZWFzZSBjb25maXJtIFBPUlQgaXMgcG9pbnRpbmcgdG8gdmFsaWQgYW5kICcgK1xuICAgICAgICAndW4tdXNlZCBzb2NrZXQgZmlsZSBwYXRoLidcbiAgICAgICk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIGV4aXN0aW5nIHNvY2tldCBmaWxlIHRvIGNsZWFudXAsIGdyZWF0LCB3ZSdsbFxuICAgIC8vIGNvbnRpbnVlIG5vcm1hbGx5LiBJZiB0aGUgY2F1Z2h0IGV4Y2VwdGlvbiByZXByZXNlbnRzIGFueSBvdGhlclxuICAgIC8vIGlzc3VlLCByZS10aHJvdy5cbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufTtcblxuLy8gUmVtb3ZlIHRoZSBzb2NrZXQgZmlsZSB3aGVuIGRvbmUgdG8gYXZvaWQgbGVhdmluZyBiZWhpbmQgYSBzdGFsZSBvbmUuXG4vLyBOb3RlIC0gYSBzdGFsZSBzb2NrZXQgZmlsZSBpcyBzdGlsbCBsZWZ0IGJlaGluZCBpZiB0aGUgcnVubmluZyBub2RlXG4vLyBwcm9jZXNzIGlzIGtpbGxlZCB2aWEgc2lnbmFsIDkgLSBTSUdLSUxMLlxuZXhwb3J0IGNvbnN0IHJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAgPVxuICAoc29ja2V0UGF0aCwgZXZlbnRFbWl0dGVyID0gcHJvY2VzcykgPT4ge1xuICAgIFsnZXhpdCcsICdTSUdJTlQnLCAnU0lHSFVQJywgJ1NJR1RFUk0nXS5mb3JFYWNoKHNpZ25hbCA9PiB7XG4gICAgICBldmVudEVtaXR0ZXIub24oc2lnbmFsLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcbiAgICAgICAgaWYgKGV4aXN0c1N5bmMoc29ja2V0UGF0aCkpIHtcbiAgICAgICAgICB1bmxpbmtTeW5jKHNvY2tldFBhdGgpO1xuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH07XG4iXX0=
