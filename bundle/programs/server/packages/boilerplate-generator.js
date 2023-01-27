(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var _ = Package.underscore._;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Boilerplate;

var require = meteorInstall({"node_modules":{"meteor":{"boilerplate-generator":{"generator.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/boilerplate-generator/generator.js                                                                     //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
let _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }
}, 0);
module.export({
  Boilerplate: () => Boilerplate
});
let readFile;
module.link("fs", {
  readFile(v) {
    readFile = v;
  }
}, 0);
let createStream;
module.link("combined-stream2", {
  create(v) {
    createStream = v;
  }
}, 1);
let WebBrowserTemplate;
module.link("./template-web.browser", {
  default(v) {
    WebBrowserTemplate = v;
  }
}, 2);
let WebCordovaTemplate;
module.link("./template-web.cordova", {
  default(v) {
    WebCordovaTemplate = v;
  }
}, 3);
// Copied from webapp_server
const readUtf8FileSync = filename => Meteor.wrapAsync(readFile)(filename, 'utf8');
const identity = value => value;
function appendToStream(chunk, stream) {
  if (typeof chunk === "string") {
    stream.append(Buffer.from(chunk, "utf8"));
  } else if (Buffer.isBuffer(chunk) || typeof chunk.read === "function") {
    stream.append(chunk);
  }
}
let shouldWarnAboutToHTMLDeprecation = !Meteor.isProduction;
class Boilerplate {
  constructor(arch, manifest) {
    let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    const {
      headTemplate,
      closeTemplate
    } = getTemplate(arch);
    this.headTemplate = headTemplate;
    this.closeTemplate = closeTemplate;
    this.baseData = null;
    this._generateBoilerplateFromManifest(manifest, options);
  }
  toHTML(extraData) {
    if (shouldWarnAboutToHTMLDeprecation) {
      shouldWarnAboutToHTMLDeprecation = false;
      console.error("The Boilerplate#toHTML method has been deprecated. " + "Please use Boilerplate#toHTMLStream instead.");
      console.trace();
    }

    // Calling .await() requires a Fiber.
    return this.toHTMLAsync(extraData).await();
  }

  // Returns a Promise that resolves to a string of HTML.
  toHTMLAsync(extraData) {
    return new Promise((resolve, reject) => {
      const stream = this.toHTMLStream(extraData);
      const chunks = [];
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      stream.on("error", reject);
    });
  }

  // The 'extraData' argument can be used to extend 'self.baseData'. Its
  // purpose is to allow you to specify data that you might not know at
  // the time that you construct the Boilerplate object. (e.g. it is used
  // by 'webapp' to specify data that is only known at request-time).
  // this returns a stream
  toHTMLStream(extraData) {
    if (!this.baseData || !this.headTemplate || !this.closeTemplate) {
      throw new Error('Boilerplate did not instantiate correctly.');
    }
    const data = _objectSpread(_objectSpread({}, this.baseData), extraData);
    const start = "<!DOCTYPE html>\n" + this.headTemplate(data);
    const {
      body,
      dynamicBody
    } = data;
    const end = this.closeTemplate(data);
    const response = createStream();
    appendToStream(start, response);
    if (body) {
      appendToStream(body, response);
    }
    if (dynamicBody) {
      appendToStream(dynamicBody, response);
    }
    appendToStream(end, response);
    return response;
  }

  // XXX Exported to allow client-side only changes to rebuild the boilerplate
  // without requiring a full server restart.
  // Produces an HTML string with given manifest and boilerplateSource.
  // Optionally takes urlMapper in case urls from manifest need to be prefixed
  // or rewritten.
  // Optionally takes pathMapper for resolving relative file system paths.
  // Optionally allows to override fields of the data context.
  _generateBoilerplateFromManifest(manifest) {
    let {
      urlMapper = identity,
      pathMapper = identity,
      baseDataExtension,
      inline
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const boilerplateBaseData = _objectSpread({
      css: [],
      js: [],
      head: '',
      body: '',
      meteorManifest: JSON.stringify(manifest)
    }, baseDataExtension);
    manifest.forEach(item => {
      const urlPath = urlMapper(item.url);
      const itemObj = {
        url: urlPath
      };
      if (inline) {
        itemObj.scriptContent = readUtf8FileSync(pathMapper(item.path));
        itemObj.inline = true;
      } else if (item.sri) {
        itemObj.sri = item.sri;
      }
      if (item.type === 'css' && item.where === 'client') {
        boilerplateBaseData.css.push(itemObj);
      }
      if (item.type === 'js' && item.where === 'client' &&
      // Dynamic JS modules should not be loaded eagerly in the
      // initial HTML of the app.
      !item.path.startsWith('dynamic/')) {
        boilerplateBaseData.js.push(itemObj);
      }
      if (item.type === 'head') {
        boilerplateBaseData.head = readUtf8FileSync(pathMapper(item.path));
      }
      if (item.type === 'body') {
        boilerplateBaseData.body = readUtf8FileSync(pathMapper(item.path));
      }
    });
    this.baseData = boilerplateBaseData;
  }
}
;

// Returns a template function that, when called, produces the boilerplate
// html as a string.
function getTemplate(arch) {
  const prefix = arch.split(".", 2).join(".");
  if (prefix === "web.browser") {
    return WebBrowserTemplate;
  }
  if (prefix === "web.cordova") {
    return WebCordovaTemplate;
  }
  throw new Error("Unsupported arch: " + arch);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template-web.browser.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/boilerplate-generator/template-web.browser.js                                                          //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.export({
  headTemplate: () => headTemplate,
  closeTemplate: () => closeTemplate
});
let template;
module.link("./template", {
  default(v) {
    template = v;
  }
}, 0);
const sri = (sri, mode) => sri && mode ? " integrity=\"sha512-".concat(sri, "\" crossorigin=\"").concat(mode, "\"") : '';
const headTemplate = _ref => {
  let {
    css,
    htmlAttributes,
    bundledJsCssUrlRewriteHook,
    sriMode,
    head,
    dynamicHead
  } = _ref;
  var headSections = head.split(/<meteor-bundled-css[^<>]*>/, 2);
  var cssBundle = [...(css || []).map(file => template('  <link rel="stylesheet" type="text/css" class="__meteor-css__" href="<%- href %>"<%= sri %>>')({
    href: bundledJsCssUrlRewriteHook(file.url),
    sri: sri(file.sri, sriMode)
  }))].join('\n');
  return ['<html' + Object.keys(htmlAttributes || {}).map(key => template(' <%= attrName %>="<%- attrValue %>"')({
    attrName: key,
    attrValue: htmlAttributes[key]
  })).join('') + '>', '<head>', headSections.length === 1 ? [cssBundle, headSections[0]].join('\n') : [headSections[0], cssBundle, headSections[1]].join('\n'), dynamicHead, '</head>', '<body>'].join('\n');
};
const closeTemplate = _ref2 => {
  let {
    meteorRuntimeConfig,
    meteorRuntimeHash,
    rootUrlPathPrefix,
    inlineScriptsAllowed,
    js,
    additionalStaticJs,
    bundledJsCssUrlRewriteHook,
    sriMode
  } = _ref2;
  return ['', inlineScriptsAllowed ? template('  <script type="text/javascript">__meteor_runtime_config__ = JSON.parse(decodeURIComponent(<%= conf %>))</script>')({
    conf: meteorRuntimeConfig
  }) : template('  <script type="text/javascript" src="<%- src %>/meteor_runtime_config.js?hash=<%- hash %>"></script>')({
    src: rootUrlPathPrefix,
    hash: meteorRuntimeHash
  }), '', ...(js || []).map(file => template('  <script type="text/javascript" src="<%- src %>"<%= sri %>></script>')({
    src: bundledJsCssUrlRewriteHook(file.url),
    sri: sri(file.sri, sriMode)
  })), ...(additionalStaticJs || []).map(_ref3 => {
    let {
      contents,
      pathname
    } = _ref3;
    return inlineScriptsAllowed ? template('  <script><%= contents %></script>')({
      contents
    }) : template('  <script type="text/javascript" src="<%- src %>"></script>')({
      src: rootUrlPathPrefix + pathname
    });
  }), '', '', '</body>', '</html>'].join('\n');
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template-web.cordova.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/boilerplate-generator/template-web.cordova.js                                                          //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.export({
  headTemplate: () => headTemplate,
  closeTemplate: () => closeTemplate
});
let template;
module.link("./template", {
  default(v) {
    template = v;
  }
}, 0);
const headTemplate = _ref => {
  let {
    meteorRuntimeConfig,
    rootUrlPathPrefix,
    inlineScriptsAllowed,
    css,
    js,
    additionalStaticJs,
    htmlAttributes,
    bundledJsCssUrlRewriteHook,
    head,
    dynamicHead
  } = _ref;
  var headSections = head.split(/<meteor-bundled-css[^<>]*>/, 2);
  var cssBundle = [
  // We are explicitly not using bundledJsCssUrlRewriteHook: in cordova we serve assets up directly from disk, so rewriting the URL does not make sense
  ...(css || []).map(file => template('  <link rel="stylesheet" type="text/css" class="__meteor-css__" href="<%- href %>">')({
    href: file.url
  }))].join('\n');
  return ['<html>', '<head>', '  <meta charset="utf-8">', '  <meta name="format-detection" content="telephone=no">', '  <meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, viewport-fit=cover">', '  <meta name="msapplication-tap-highlight" content="no">', '  <meta http-equiv="Content-Security-Policy" content="default-src * android-webview-video-poster: gap: data: blob: \'unsafe-inline\' \'unsafe-eval\' ws: wss:;">', headSections.length === 1 ? [cssBundle, headSections[0]].join('\n') : [headSections[0], cssBundle, headSections[1]].join('\n'), '  <script type="text/javascript">', template('    __meteor_runtime_config__ = JSON.parse(decodeURIComponent(<%= conf %>));')({
    conf: meteorRuntimeConfig
  }), '    if (/Android/i.test(navigator.userAgent)) {',
  // When Android app is emulated, it cannot connect to localhost,
  // instead it should connect to 10.0.2.2
  // (unless we\'re using an http proxy; then it works!)
  '      if (!__meteor_runtime_config__.httpProxyPort) {', '        __meteor_runtime_config__.ROOT_URL = (__meteor_runtime_config__.ROOT_URL || \'\').replace(/localhost/i, \'10.0.2.2\');', '        __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = (__meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL || \'\').replace(/localhost/i, \'10.0.2.2\');', '      }', '    }', '  </script>', '', '  <script type="text/javascript" src="/cordova.js"></script>', ...(js || []).map(file => template('  <script type="text/javascript" src="<%- src %>"></script>')({
    src: file.url
  })), ...(additionalStaticJs || []).map(_ref2 => {
    let {
      contents,
      pathname
    } = _ref2;
    return inlineScriptsAllowed ? template('  <script><%= contents %></script>')({
      contents
    }) : template('  <script type="text/javascript" src="<%- src %>"></script>')({
      src: rootUrlPathPrefix + pathname
    });
  }), '', '</head>', '', '<body>'].join('\n');
};
function closeTemplate() {
  return "</body>\n</html>";
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/boilerplate-generator/template.js                                                                      //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.export({
  default: () => template
});
let _;
module.link("meteor/underscore", {
  _(v) {
    _ = v;
  }
}, 0);
function template(text) {
  return _.template(text, null, {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  });
}
;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"combined-stream2":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/boilerplate-generator/node_modules/combined-stream2/package.json                            //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.exports = {
  "name": "combined-stream2",
  "version": "1.1.2",
  "main": "index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// node_modules/meteor/boilerplate-generator/node_modules/combined-stream2/index.js                                //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/boilerplate-generator/generator.js");

/* Exports */
Package._define("boilerplate-generator", exports, {
  Boilerplate: Boilerplate
});

})();

//# sourceURL=meteor://💻app/packages/boilerplate-generator.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yL2dlbmVyYXRvci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yL3RlbXBsYXRlLXdlYi5icm93c2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ib2lsZXJwbGF0ZS1nZW5lcmF0b3IvdGVtcGxhdGUtd2ViLmNvcmRvdmEuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JvaWxlcnBsYXRlLWdlbmVyYXRvci90ZW1wbGF0ZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwiZXhwb3J0IiwiQm9pbGVycGxhdGUiLCJyZWFkRmlsZSIsImNyZWF0ZVN0cmVhbSIsImNyZWF0ZSIsIldlYkJyb3dzZXJUZW1wbGF0ZSIsIldlYkNvcmRvdmFUZW1wbGF0ZSIsInJlYWRVdGY4RmlsZVN5bmMiLCJmaWxlbmFtZSIsIk1ldGVvciIsIndyYXBBc3luYyIsImlkZW50aXR5IiwidmFsdWUiLCJhcHBlbmRUb1N0cmVhbSIsImNodW5rIiwic3RyZWFtIiwiYXBwZW5kIiwiQnVmZmVyIiwiZnJvbSIsImlzQnVmZmVyIiwicmVhZCIsInNob3VsZFdhcm5BYm91dFRvSFRNTERlcHJlY2F0aW9uIiwiaXNQcm9kdWN0aW9uIiwiY29uc3RydWN0b3IiLCJhcmNoIiwibWFuaWZlc3QiLCJvcHRpb25zIiwiaGVhZFRlbXBsYXRlIiwiY2xvc2VUZW1wbGF0ZSIsImdldFRlbXBsYXRlIiwiYmFzZURhdGEiLCJfZ2VuZXJhdGVCb2lsZXJwbGF0ZUZyb21NYW5pZmVzdCIsInRvSFRNTCIsImV4dHJhRGF0YSIsImNvbnNvbGUiLCJlcnJvciIsInRyYWNlIiwidG9IVE1MQXN5bmMiLCJhd2FpdCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwidG9IVE1MU3RyZWFtIiwiY2h1bmtzIiwib24iLCJwdXNoIiwiY29uY2F0IiwidG9TdHJpbmciLCJFcnJvciIsImRhdGEiLCJzdGFydCIsImJvZHkiLCJkeW5hbWljQm9keSIsImVuZCIsInJlc3BvbnNlIiwidXJsTWFwcGVyIiwicGF0aE1hcHBlciIsImJhc2VEYXRhRXh0ZW5zaW9uIiwiaW5saW5lIiwiYm9pbGVycGxhdGVCYXNlRGF0YSIsImNzcyIsImpzIiwiaGVhZCIsIm1ldGVvck1hbmlmZXN0IiwiSlNPTiIsInN0cmluZ2lmeSIsImZvckVhY2giLCJpdGVtIiwidXJsUGF0aCIsInVybCIsIml0ZW1PYmoiLCJzY3JpcHRDb250ZW50IiwicGF0aCIsInNyaSIsInR5cGUiLCJ3aGVyZSIsInN0YXJ0c1dpdGgiLCJwcmVmaXgiLCJzcGxpdCIsImpvaW4iLCJ0ZW1wbGF0ZSIsIm1vZGUiLCJodG1sQXR0cmlidXRlcyIsImJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rIiwic3JpTW9kZSIsImR5bmFtaWNIZWFkIiwiaGVhZFNlY3Rpb25zIiwiY3NzQnVuZGxlIiwibWFwIiwiZmlsZSIsImhyZWYiLCJPYmplY3QiLCJrZXlzIiwia2V5IiwiYXR0ck5hbWUiLCJhdHRyVmFsdWUiLCJsZW5ndGgiLCJtZXRlb3JSdW50aW1lQ29uZmlnIiwibWV0ZW9yUnVudGltZUhhc2giLCJyb290VXJsUGF0aFByZWZpeCIsImlubGluZVNjcmlwdHNBbGxvd2VkIiwiYWRkaXRpb25hbFN0YXRpY0pzIiwiY29uZiIsInNyYyIsImhhc2giLCJjb250ZW50cyIsInBhdGhuYW1lIiwiXyIsInRleHQiLCJldmFsdWF0ZSIsImludGVycG9sYXRlIiwiZXNjYXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsSUFBSUEsYUFBYTtBQUFDQyxNQUFNLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztFQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztJQUFDSixhQUFhLEdBQUNJLENBQUM7RUFBQTtBQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7QUFBckdILE1BQU0sQ0FBQ0ksTUFBTSxDQUFDO0VBQUNDLFdBQVcsRUFBQyxNQUFJQTtBQUFXLENBQUMsQ0FBQztBQUFDLElBQUlDLFFBQVE7QUFBQ04sTUFBTSxDQUFDQyxJQUFJLENBQUMsSUFBSSxFQUFDO0VBQUNLLFFBQVEsQ0FBQ0gsQ0FBQyxFQUFDO0lBQUNHLFFBQVEsR0FBQ0gsQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQUFDLElBQUlJLFlBQVk7QUFBQ1AsTUFBTSxDQUFDQyxJQUFJLENBQUMsa0JBQWtCLEVBQUM7RUFBQ08sTUFBTSxDQUFDTCxDQUFDLEVBQUM7SUFBQ0ksWUFBWSxHQUFDSixDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQUMsSUFBSU0sa0JBQWtCO0FBQUNULE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHdCQUF3QixFQUFDO0VBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO0lBQUNNLGtCQUFrQixHQUFDTixDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQUMsSUFBSU8sa0JBQWtCO0FBQUNWLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHdCQUF3QixFQUFDO0VBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO0lBQUNPLGtCQUFrQixHQUFDUCxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBTTFYO0FBQ0EsTUFBTVEsZ0JBQWdCLEdBQUdDLFFBQVEsSUFBSUMsTUFBTSxDQUFDQyxTQUFTLENBQUNSLFFBQVEsQ0FBQyxDQUFDTSxRQUFRLEVBQUUsTUFBTSxDQUFDO0FBRWpGLE1BQU1HLFFBQVEsR0FBR0MsS0FBSyxJQUFJQSxLQUFLO0FBRS9CLFNBQVNDLGNBQWMsQ0FBQ0MsS0FBSyxFQUFFQyxNQUFNLEVBQUU7RUFDckMsSUFBSSxPQUFPRCxLQUFLLEtBQUssUUFBUSxFQUFFO0lBQzdCQyxNQUFNLENBQUNDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUNKLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztFQUMzQyxDQUFDLE1BQU0sSUFBSUcsTUFBTSxDQUFDRSxRQUFRLENBQUNMLEtBQUssQ0FBQyxJQUN0QixPQUFPQSxLQUFLLENBQUNNLElBQUksS0FBSyxVQUFVLEVBQUU7SUFDM0NMLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDRixLQUFLLENBQUM7RUFDdEI7QUFDRjtBQUVBLElBQUlPLGdDQUFnQyxHQUFHLENBQUVaLE1BQU0sQ0FBQ2EsWUFBWTtBQUVyRCxNQUFNckIsV0FBVyxDQUFDO0VBQ3ZCc0IsV0FBVyxDQUFDQyxJQUFJLEVBQUVDLFFBQVEsRUFBZ0I7SUFBQSxJQUFkQyxPQUFPLHVFQUFHLENBQUMsQ0FBQztJQUN0QyxNQUFNO01BQUVDLFlBQVk7TUFBRUM7SUFBYyxDQUFDLEdBQUdDLFdBQVcsQ0FBQ0wsSUFBSSxDQUFDO0lBQ3pELElBQUksQ0FBQ0csWUFBWSxHQUFHQSxZQUFZO0lBQ2hDLElBQUksQ0FBQ0MsYUFBYSxHQUFHQSxhQUFhO0lBQ2xDLElBQUksQ0FBQ0UsUUFBUSxHQUFHLElBQUk7SUFFcEIsSUFBSSxDQUFDQyxnQ0FBZ0MsQ0FDbkNOLFFBQVEsRUFDUkMsT0FBTyxDQUNSO0VBQ0g7RUFFQU0sTUFBTSxDQUFDQyxTQUFTLEVBQUU7SUFDaEIsSUFBSVosZ0NBQWdDLEVBQUU7TUFDcENBLGdDQUFnQyxHQUFHLEtBQUs7TUFDeENhLE9BQU8sQ0FBQ0MsS0FBSyxDQUNYLHFEQUFxRCxHQUNuRCw4Q0FBOEMsQ0FDakQ7TUFDREQsT0FBTyxDQUFDRSxLQUFLLEVBQUU7SUFDakI7O0lBRUE7SUFDQSxPQUFPLElBQUksQ0FBQ0MsV0FBVyxDQUFDSixTQUFTLENBQUMsQ0FBQ0ssS0FBSyxFQUFFO0VBQzVDOztFQUVBO0VBQ0FELFdBQVcsQ0FBQ0osU0FBUyxFQUFFO0lBQ3JCLE9BQU8sSUFBSU0sT0FBTyxDQUFDLENBQUNDLE9BQU8sRUFBRUMsTUFBTSxLQUFLO01BQ3RDLE1BQU0xQixNQUFNLEdBQUcsSUFBSSxDQUFDMkIsWUFBWSxDQUFDVCxTQUFTLENBQUM7TUFDM0MsTUFBTVUsTUFBTSxHQUFHLEVBQUU7TUFDakI1QixNQUFNLENBQUM2QixFQUFFLENBQUMsTUFBTSxFQUFFOUIsS0FBSyxJQUFJNkIsTUFBTSxDQUFDRSxJQUFJLENBQUMvQixLQUFLLENBQUMsQ0FBQztNQUM5Q0MsTUFBTSxDQUFDNkIsRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNO1FBQ3JCSixPQUFPLENBQUN2QixNQUFNLENBQUM2QixNQUFNLENBQUNILE1BQU0sQ0FBQyxDQUFDSSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7TUFDakQsQ0FBQyxDQUFDO01BQ0ZoQyxNQUFNLENBQUM2QixFQUFFLENBQUMsT0FBTyxFQUFFSCxNQUFNLENBQUM7SUFDNUIsQ0FBQyxDQUFDO0VBQ0o7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBQyxZQUFZLENBQUNULFNBQVMsRUFBRTtJQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDSCxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUNILFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQ0MsYUFBYSxFQUFFO01BQy9ELE1BQU0sSUFBSW9CLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQztJQUMvRDtJQUVBLE1BQU1DLElBQUksbUNBQU8sSUFBSSxDQUFDbkIsUUFBUSxHQUFLRyxTQUFTLENBQUM7SUFDN0MsTUFBTWlCLEtBQUssR0FBRyxtQkFBbUIsR0FBRyxJQUFJLENBQUN2QixZQUFZLENBQUNzQixJQUFJLENBQUM7SUFFM0QsTUFBTTtNQUFFRSxJQUFJO01BQUVDO0lBQVksQ0FBQyxHQUFHSCxJQUFJO0lBRWxDLE1BQU1JLEdBQUcsR0FBRyxJQUFJLENBQUN6QixhQUFhLENBQUNxQixJQUFJLENBQUM7SUFDcEMsTUFBTUssUUFBUSxHQUFHbkQsWUFBWSxFQUFFO0lBRS9CVSxjQUFjLENBQUNxQyxLQUFLLEVBQUVJLFFBQVEsQ0FBQztJQUUvQixJQUFJSCxJQUFJLEVBQUU7TUFDUnRDLGNBQWMsQ0FBQ3NDLElBQUksRUFBRUcsUUFBUSxDQUFDO0lBQ2hDO0lBRUEsSUFBSUYsV0FBVyxFQUFFO01BQ2Z2QyxjQUFjLENBQUN1QyxXQUFXLEVBQUVFLFFBQVEsQ0FBQztJQUN2QztJQUVBekMsY0FBYyxDQUFDd0MsR0FBRyxFQUFFQyxRQUFRLENBQUM7SUFFN0IsT0FBT0EsUUFBUTtFQUNqQjs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBdkIsZ0NBQWdDLENBQUNOLFFBQVEsRUFLakM7SUFBQSxJQUxtQztNQUN6QzhCLFNBQVMsR0FBRzVDLFFBQVE7TUFDcEI2QyxVQUFVLEdBQUc3QyxRQUFRO01BQ3JCOEMsaUJBQWlCO01BQ2pCQztJQUNGLENBQUMsdUVBQUcsQ0FBQyxDQUFDO0lBRUosTUFBTUMsbUJBQW1CO01BQ3ZCQyxHQUFHLEVBQUUsRUFBRTtNQUNQQyxFQUFFLEVBQUUsRUFBRTtNQUNOQyxJQUFJLEVBQUUsRUFBRTtNQUNSWCxJQUFJLEVBQUUsRUFBRTtNQUNSWSxjQUFjLEVBQUVDLElBQUksQ0FBQ0MsU0FBUyxDQUFDeEMsUUFBUTtJQUFDLEdBQ3JDZ0MsaUJBQWlCLENBQ3JCO0lBRURoQyxRQUFRLENBQUN5QyxPQUFPLENBQUNDLElBQUksSUFBSTtNQUN2QixNQUFNQyxPQUFPLEdBQUdiLFNBQVMsQ0FBQ1ksSUFBSSxDQUFDRSxHQUFHLENBQUM7TUFDbkMsTUFBTUMsT0FBTyxHQUFHO1FBQUVELEdBQUcsRUFBRUQ7TUFBUSxDQUFDO01BRWhDLElBQUlWLE1BQU0sRUFBRTtRQUNWWSxPQUFPLENBQUNDLGFBQWEsR0FBR2hFLGdCQUFnQixDQUN0Q2lELFVBQVUsQ0FBQ1csSUFBSSxDQUFDSyxJQUFJLENBQUMsQ0FBQztRQUN4QkYsT0FBTyxDQUFDWixNQUFNLEdBQUcsSUFBSTtNQUN2QixDQUFDLE1BQU0sSUFBSVMsSUFBSSxDQUFDTSxHQUFHLEVBQUU7UUFDbkJILE9BQU8sQ0FBQ0csR0FBRyxHQUFHTixJQUFJLENBQUNNLEdBQUc7TUFDeEI7TUFFQSxJQUFJTixJQUFJLENBQUNPLElBQUksS0FBSyxLQUFLLElBQUlQLElBQUksQ0FBQ1EsS0FBSyxLQUFLLFFBQVEsRUFBRTtRQUNsRGhCLG1CQUFtQixDQUFDQyxHQUFHLENBQUNmLElBQUksQ0FBQ3lCLE9BQU8sQ0FBQztNQUN2QztNQUVBLElBQUlILElBQUksQ0FBQ08sSUFBSSxLQUFLLElBQUksSUFBSVAsSUFBSSxDQUFDUSxLQUFLLEtBQUssUUFBUTtNQUMvQztNQUNBO01BQ0EsQ0FBQ1IsSUFBSSxDQUFDSyxJQUFJLENBQUNJLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUNuQ2pCLG1CQUFtQixDQUFDRSxFQUFFLENBQUNoQixJQUFJLENBQUN5QixPQUFPLENBQUM7TUFDdEM7TUFFQSxJQUFJSCxJQUFJLENBQUNPLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDeEJmLG1CQUFtQixDQUFDRyxJQUFJLEdBQ3RCdkQsZ0JBQWdCLENBQUNpRCxVQUFVLENBQUNXLElBQUksQ0FBQ0ssSUFBSSxDQUFDLENBQUM7TUFDM0M7TUFFQSxJQUFJTCxJQUFJLENBQUNPLElBQUksS0FBSyxNQUFNLEVBQUU7UUFDeEJmLG1CQUFtQixDQUFDUixJQUFJLEdBQ3RCNUMsZ0JBQWdCLENBQUNpRCxVQUFVLENBQUNXLElBQUksQ0FBQ0ssSUFBSSxDQUFDLENBQUM7TUFDM0M7SUFDRixDQUFDLENBQUM7SUFFRixJQUFJLENBQUMxQyxRQUFRLEdBQUc2QixtQkFBbUI7RUFDckM7QUFDRjtBQUFDOztBQUVEO0FBQ0E7QUFDQSxTQUFTOUIsV0FBVyxDQUFDTCxJQUFJLEVBQUU7RUFDekIsTUFBTXFELE1BQU0sR0FBR3JELElBQUksQ0FBQ3NELEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUNDLElBQUksQ0FBQyxHQUFHLENBQUM7RUFFM0MsSUFBSUYsTUFBTSxLQUFLLGFBQWEsRUFBRTtJQUM1QixPQUFPeEUsa0JBQWtCO0VBQzNCO0VBRUEsSUFBSXdFLE1BQU0sS0FBSyxhQUFhLEVBQUU7SUFDNUIsT0FBT3ZFLGtCQUFrQjtFQUMzQjtFQUVBLE1BQU0sSUFBSTBDLEtBQUssQ0FBQyxvQkFBb0IsR0FBR3hCLElBQUksQ0FBQztBQUM5QyxDOzs7Ozs7Ozs7OztBQzFLQTVCLE1BQU0sQ0FBQ0ksTUFBTSxDQUFDO0VBQUMyQixZQUFZLEVBQUMsTUFBSUEsWUFBWTtFQUFDQyxhQUFhLEVBQUMsTUFBSUE7QUFBYSxDQUFDLENBQUM7QUFBQyxJQUFJb0QsUUFBUTtBQUFDcEYsTUFBTSxDQUFDQyxJQUFJLENBQUMsWUFBWSxFQUFDO0VBQUNDLE9BQU8sQ0FBQ0MsQ0FBQyxFQUFDO0lBQUNpRixRQUFRLEdBQUNqRixDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBRWhKLE1BQU0wRSxHQUFHLEdBQUcsQ0FBQ0EsR0FBRyxFQUFFUSxJQUFJLEtBQ25CUixHQUFHLElBQUlRLElBQUksaUNBQTBCUixHQUFHLDhCQUFrQlEsSUFBSSxVQUFNLEVBQUU7QUFFbEUsTUFBTXRELFlBQVksR0FBRyxRQU90QjtFQUFBLElBUHVCO0lBQzNCaUMsR0FBRztJQUNIc0IsY0FBYztJQUNkQywwQkFBMEI7SUFDMUJDLE9BQU87SUFDUHRCLElBQUk7SUFDSnVCO0VBQ0YsQ0FBQztFQUNDLElBQUlDLFlBQVksR0FBR3hCLElBQUksQ0FBQ2dCLEtBQUssQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLENBQUM7RUFDOUQsSUFBSVMsU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDM0IsR0FBRyxJQUFJLEVBQUUsRUFBRTRCLEdBQUcsQ0FBQ0MsSUFBSSxJQUN0Q1QsUUFBUSxDQUFDLCtGQUErRixDQUFDLENBQUM7SUFDeEdVLElBQUksRUFBRVAsMEJBQTBCLENBQUNNLElBQUksQ0FBQ3BCLEdBQUcsQ0FBQztJQUMxQ0ksR0FBRyxFQUFFQSxHQUFHLENBQUNnQixJQUFJLENBQUNoQixHQUFHLEVBQUVXLE9BQU87RUFDNUIsQ0FBQyxDQUFDLENBQ0gsQ0FBQyxDQUFDTCxJQUFJLENBQUMsSUFBSSxDQUFDO0VBRWIsT0FBTyxDQUNMLE9BQU8sR0FBR1ksTUFBTSxDQUFDQyxJQUFJLENBQUNWLGNBQWMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDTSxHQUFHLENBQzdDSyxHQUFHLElBQUliLFFBQVEsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQ3JEYyxRQUFRLEVBQUVELEdBQUc7SUFDYkUsU0FBUyxFQUFFYixjQUFjLENBQUNXLEdBQUc7RUFDL0IsQ0FBQyxDQUFDLENBQ0gsQ0FBQ2QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFFaEIsUUFBUSxFQUVQTyxZQUFZLENBQUNVLE1BQU0sS0FBSyxDQUFDLEdBQ3RCLENBQUNULFNBQVMsRUFBRUQsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsR0FDdkMsQ0FBQ08sWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFQyxTQUFTLEVBQUVELFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDUCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBRTVETSxXQUFXLEVBQ1gsU0FBUyxFQUNULFFBQVEsQ0FDVCxDQUFDTixJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUdNLE1BQU1uRCxhQUFhLEdBQUc7RUFBQSxJQUFDO0lBQzVCcUUsbUJBQW1CO0lBQ25CQyxpQkFBaUI7SUFDakJDLGlCQUFpQjtJQUNqQkMsb0JBQW9CO0lBQ3BCdkMsRUFBRTtJQUNGd0Msa0JBQWtCO0lBQ2xCbEIsMEJBQTBCO0lBQzFCQztFQUNGLENBQUM7RUFBQSxPQUFLLENBQ0osRUFBRSxFQUNGZ0Isb0JBQW9CLEdBQ2hCcEIsUUFBUSxDQUFDLG1IQUFtSCxDQUFDLENBQUM7SUFDOUhzQixJQUFJLEVBQUVMO0VBQ1IsQ0FBQyxDQUFDLEdBQ0FqQixRQUFRLENBQUMsdUdBQXVHLENBQUMsQ0FBQztJQUNsSHVCLEdBQUcsRUFBRUosaUJBQWlCO0lBQ3RCSyxJQUFJLEVBQUVOO0VBQ1IsQ0FBQyxDQUFDLEVBQ0osRUFBRSxFQUVGLEdBQUcsQ0FBQ3JDLEVBQUUsSUFBSSxFQUFFLEVBQUUyQixHQUFHLENBQUNDLElBQUksSUFDcEJULFFBQVEsQ0FBQyx1RUFBdUUsQ0FBQyxDQUFDO0lBQ2hGdUIsR0FBRyxFQUFFcEIsMEJBQTBCLENBQUNNLElBQUksQ0FBQ3BCLEdBQUcsQ0FBQztJQUN6Q0ksR0FBRyxFQUFFQSxHQUFHLENBQUNnQixJQUFJLENBQUNoQixHQUFHLEVBQUVXLE9BQU87RUFDNUIsQ0FBQyxDQUFDLENBQ0gsRUFFRCxHQUFHLENBQUNpQixrQkFBa0IsSUFBSSxFQUFFLEVBQUViLEdBQUcsQ0FBQztJQUFBLElBQUM7TUFBRWlCLFFBQVE7TUFBRUM7SUFBUyxDQUFDO0lBQUEsT0FDdkROLG9CQUFvQixHQUNoQnBCLFFBQVEsQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO01BQy9DeUI7SUFDRixDQUFDLENBQUMsR0FDQXpCLFFBQVEsQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO01BQ3hFdUIsR0FBRyxFQUFFSixpQkFBaUIsR0FBR087SUFDM0IsQ0FBQyxDQUFDO0VBQUEsQ0FDTCxDQUFDLEVBRUYsRUFBRSxFQUNGLEVBQUUsRUFDRixTQUFTLEVBQ1QsU0FBUyxDQUNWLENBQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDO0FBQUEsRTs7Ozs7Ozs7Ozs7QUNwRlpuRixNQUFNLENBQUNJLE1BQU0sQ0FBQztFQUFDMkIsWUFBWSxFQUFDLE1BQUlBLFlBQVk7RUFBQ0MsYUFBYSxFQUFDLE1BQUlBO0FBQWEsQ0FBQyxDQUFDO0FBQUMsSUFBSW9ELFFBQVE7QUFBQ3BGLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLFlBQVksRUFBQztFQUFDQyxPQUFPLENBQUNDLENBQUMsRUFBQztJQUFDaUYsUUFBUSxHQUFDakYsQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQUd6SSxNQUFNNEIsWUFBWSxHQUFHLFFBV3RCO0VBQUEsSUFYdUI7SUFDM0JzRSxtQkFBbUI7SUFDbkJFLGlCQUFpQjtJQUNqQkMsb0JBQW9CO0lBQ3BCeEMsR0FBRztJQUNIQyxFQUFFO0lBQ0Z3QyxrQkFBa0I7SUFDbEJuQixjQUFjO0lBQ2RDLDBCQUEwQjtJQUMxQnJCLElBQUk7SUFDSnVCO0VBQ0YsQ0FBQztFQUNDLElBQUlDLFlBQVksR0FBR3hCLElBQUksQ0FBQ2dCLEtBQUssQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLENBQUM7RUFDOUQsSUFBSVMsU0FBUyxHQUFHO0VBQ2Q7RUFDQSxHQUFHLENBQUMzQixHQUFHLElBQUksRUFBRSxFQUFFNEIsR0FBRyxDQUFDQyxJQUFJLElBQ3JCVCxRQUFRLENBQUMscUZBQXFGLENBQUMsQ0FBQztJQUM5RlUsSUFBSSxFQUFFRCxJQUFJLENBQUNwQjtFQUNiLENBQUMsQ0FBQyxDQUNMLENBQUMsQ0FBQ1UsSUFBSSxDQUFDLElBQUksQ0FBQztFQUViLE9BQU8sQ0FDTCxRQUFRLEVBQ1IsUUFBUSxFQUNSLDBCQUEwQixFQUMxQix5REFBeUQsRUFDekQsc0tBQXNLLEVBQ3RLLDBEQUEwRCxFQUMxRCxrS0FBa0ssRUFFbktPLFlBQVksQ0FBQ1UsTUFBTSxLQUFLLENBQUMsR0FDdEIsQ0FBQ1QsU0FBUyxFQUFFRCxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQ1AsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUN2QyxDQUFDTyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUVDLFNBQVMsRUFBRUQsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsRUFFMUQsbUNBQW1DLEVBQ25DQyxRQUFRLENBQUMsOEVBQThFLENBQUMsQ0FBQztJQUN2RnNCLElBQUksRUFBRUw7RUFDUixDQUFDLENBQUMsRUFDRixpREFBaUQ7RUFDakQ7RUFDQTtFQUNBO0VBQ0EsdURBQXVELEVBQ3ZELGdJQUFnSSxFQUNoSSxvS0FBb0ssRUFDcEssU0FBUyxFQUNULE9BQU8sRUFDUCxhQUFhLEVBQ2IsRUFBRSxFQUNGLDhEQUE4RCxFQUU5RCxHQUFHLENBQUNwQyxFQUFFLElBQUksRUFBRSxFQUFFMkIsR0FBRyxDQUFDQyxJQUFJLElBQ3BCVCxRQUFRLENBQUMsNkRBQTZELENBQUMsQ0FBQztJQUN0RXVCLEdBQUcsRUFBRWQsSUFBSSxDQUFDcEI7RUFDWixDQUFDLENBQUMsQ0FDSCxFQUVELEdBQUcsQ0FBQ2dDLGtCQUFrQixJQUFJLEVBQUUsRUFBRWIsR0FBRyxDQUFDO0lBQUEsSUFBQztNQUFFaUIsUUFBUTtNQUFFQztJQUFTLENBQUM7SUFBQSxPQUN2RE4sb0JBQW9CLEdBQ2hCcEIsUUFBUSxDQUFDLG9DQUFvQyxDQUFDLENBQUM7TUFDL0N5QjtJQUNGLENBQUMsQ0FBQyxHQUNBekIsUUFBUSxDQUFDLDZEQUE2RCxDQUFDLENBQUM7TUFDeEV1QixHQUFHLEVBQUVKLGlCQUFpQixHQUFHTztJQUMzQixDQUFDLENBQUM7RUFBQSxDQUNMLENBQUMsRUFDRixFQUFFLEVBQ0YsU0FBUyxFQUNULEVBQUUsRUFDRixRQUFRLENBQ1QsQ0FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRU0sU0FBU25ELGFBQWEsR0FBRztFQUM5QixPQUFPLGtCQUFrQjtBQUMzQixDOzs7Ozs7Ozs7OztBQzlFQWhDLE1BQU0sQ0FBQ0ksTUFBTSxDQUFDO0VBQUNGLE9BQU8sRUFBQyxNQUFJa0Y7QUFBUSxDQUFDLENBQUM7QUFBQyxJQUFJMkIsQ0FBQztBQUFDL0csTUFBTSxDQUFDQyxJQUFJLENBQUMsbUJBQW1CLEVBQUM7RUFBQzhHLENBQUMsQ0FBQzVHLENBQUMsRUFBQztJQUFDNEcsQ0FBQyxHQUFDNUcsQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQU8zRSxTQUFTaUYsUUFBUSxDQUFDNEIsSUFBSSxFQUFFO0VBQ3JDLE9BQU9ELENBQUMsQ0FBQzNCLFFBQVEsQ0FBQzRCLElBQUksRUFBRSxJQUFJLEVBQUU7SUFDNUJDLFFBQVEsRUFBTSxpQkFBaUI7SUFDL0JDLFdBQVcsRUFBRyxrQkFBa0I7SUFDaENDLE1BQU0sRUFBUTtFQUNoQixDQUFDLENBQUM7QUFDSjtBQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2JvaWxlcnBsYXRlLWdlbmVyYXRvci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgY3JlYXRlIGFzIGNyZWF0ZVN0cmVhbSB9IGZyb20gXCJjb21iaW5lZC1zdHJlYW0yXCI7XG5cbmltcG9ydCBXZWJCcm93c2VyVGVtcGxhdGUgZnJvbSAnLi90ZW1wbGF0ZS13ZWIuYnJvd3Nlcic7XG5pbXBvcnQgV2ViQ29yZG92YVRlbXBsYXRlIGZyb20gJy4vdGVtcGxhdGUtd2ViLmNvcmRvdmEnO1xuXG4vLyBDb3BpZWQgZnJvbSB3ZWJhcHBfc2VydmVyXG5jb25zdCByZWFkVXRmOEZpbGVTeW5jID0gZmlsZW5hbWUgPT4gTWV0ZW9yLndyYXBBc3luYyhyZWFkRmlsZSkoZmlsZW5hbWUsICd1dGY4Jyk7XG5cbmNvbnN0IGlkZW50aXR5ID0gdmFsdWUgPT4gdmFsdWU7XG5cbmZ1bmN0aW9uIGFwcGVuZFRvU3RyZWFtKGNodW5rLCBzdHJlYW0pIHtcbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gXCJzdHJpbmdcIikge1xuICAgIHN0cmVhbS5hcHBlbmQoQnVmZmVyLmZyb20oY2h1bmssIFwidXRmOFwiKSk7XG4gIH0gZWxzZSBpZiAoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSB8fFxuICAgICAgICAgICAgIHR5cGVvZiBjaHVuay5yZWFkID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBzdHJlYW0uYXBwZW5kKGNodW5rKTtcbiAgfVxufVxuXG5sZXQgc2hvdWxkV2FybkFib3V0VG9IVE1MRGVwcmVjYXRpb24gPSAhIE1ldGVvci5pc1Byb2R1Y3Rpb247XG5cbmV4cG9ydCBjbGFzcyBCb2lsZXJwbGF0ZSB7XG4gIGNvbnN0cnVjdG9yKGFyY2gsIG1hbmlmZXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IGhlYWRUZW1wbGF0ZSwgY2xvc2VUZW1wbGF0ZSB9ID0gZ2V0VGVtcGxhdGUoYXJjaCk7XG4gICAgdGhpcy5oZWFkVGVtcGxhdGUgPSBoZWFkVGVtcGxhdGU7XG4gICAgdGhpcy5jbG9zZVRlbXBsYXRlID0gY2xvc2VUZW1wbGF0ZTtcbiAgICB0aGlzLmJhc2VEYXRhID0gbnVsbDtcblxuICAgIHRoaXMuX2dlbmVyYXRlQm9pbGVycGxhdGVGcm9tTWFuaWZlc3QoXG4gICAgICBtYW5pZmVzdCxcbiAgICAgIG9wdGlvbnNcbiAgICApO1xuICB9XG5cbiAgdG9IVE1MKGV4dHJhRGF0YSkge1xuICAgIGlmIChzaG91bGRXYXJuQWJvdXRUb0hUTUxEZXByZWNhdGlvbikge1xuICAgICAgc2hvdWxkV2FybkFib3V0VG9IVE1MRGVwcmVjYXRpb24gPSBmYWxzZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgIFwiVGhlIEJvaWxlcnBsYXRlI3RvSFRNTCBtZXRob2QgaGFzIGJlZW4gZGVwcmVjYXRlZC4gXCIgK1xuICAgICAgICAgIFwiUGxlYXNlIHVzZSBCb2lsZXJwbGF0ZSN0b0hUTUxTdHJlYW0gaW5zdGVhZC5cIlxuICAgICAgKTtcbiAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsaW5nIC5hd2FpdCgpIHJlcXVpcmVzIGEgRmliZXIuXG4gICAgcmV0dXJuIHRoaXMudG9IVE1MQXN5bmMoZXh0cmFEYXRhKS5hd2FpdCgpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIHN0cmluZyBvZiBIVE1MLlxuICB0b0hUTUxBc3luYyhleHRyYURhdGEpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3Qgc3RyZWFtID0gdGhpcy50b0hUTUxTdHJlYW0oZXh0cmFEYXRhKTtcbiAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgc3RyZWFtLm9uKFwiZGF0YVwiLCBjaHVuayA9PiBjaHVua3MucHVzaChjaHVuaykpO1xuICAgICAgc3RyZWFtLm9uKFwiZW5kXCIsICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoXCJ1dGY4XCIpKTtcbiAgICAgIH0pO1xuICAgICAgc3RyZWFtLm9uKFwiZXJyb3JcIiwgcmVqZWN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFRoZSAnZXh0cmFEYXRhJyBhcmd1bWVudCBjYW4gYmUgdXNlZCB0byBleHRlbmQgJ3NlbGYuYmFzZURhdGEnLiBJdHNcbiAgLy8gcHVycG9zZSBpcyB0byBhbGxvdyB5b3UgdG8gc3BlY2lmeSBkYXRhIHRoYXQgeW91IG1pZ2h0IG5vdCBrbm93IGF0XG4gIC8vIHRoZSB0aW1lIHRoYXQgeW91IGNvbnN0cnVjdCB0aGUgQm9pbGVycGxhdGUgb2JqZWN0LiAoZS5nLiBpdCBpcyB1c2VkXG4gIC8vIGJ5ICd3ZWJhcHAnIHRvIHNwZWNpZnkgZGF0YSB0aGF0IGlzIG9ubHkga25vd24gYXQgcmVxdWVzdC10aW1lKS5cbiAgLy8gdGhpcyByZXR1cm5zIGEgc3RyZWFtXG4gIHRvSFRNTFN0cmVhbShleHRyYURhdGEpIHtcbiAgICBpZiAoIXRoaXMuYmFzZURhdGEgfHwgIXRoaXMuaGVhZFRlbXBsYXRlIHx8ICF0aGlzLmNsb3NlVGVtcGxhdGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQm9pbGVycGxhdGUgZGlkIG5vdCBpbnN0YW50aWF0ZSBjb3JyZWN0bHkuJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YSA9IHsuLi50aGlzLmJhc2VEYXRhLCAuLi5leHRyYURhdGF9O1xuICAgIGNvbnN0IHN0YXJ0ID0gXCI8IURPQ1RZUEUgaHRtbD5cXG5cIiArIHRoaXMuaGVhZFRlbXBsYXRlKGRhdGEpO1xuXG4gICAgY29uc3QgeyBib2R5LCBkeW5hbWljQm9keSB9ID0gZGF0YTtcblxuICAgIGNvbnN0IGVuZCA9IHRoaXMuY2xvc2VUZW1wbGF0ZShkYXRhKTtcbiAgICBjb25zdCByZXNwb25zZSA9IGNyZWF0ZVN0cmVhbSgpO1xuXG4gICAgYXBwZW5kVG9TdHJlYW0oc3RhcnQsIHJlc3BvbnNlKTtcblxuICAgIGlmIChib2R5KSB7XG4gICAgICBhcHBlbmRUb1N0cmVhbShib2R5LCByZXNwb25zZSk7XG4gICAgfVxuXG4gICAgaWYgKGR5bmFtaWNCb2R5KSB7XG4gICAgICBhcHBlbmRUb1N0cmVhbShkeW5hbWljQm9keSwgcmVzcG9uc2UpO1xuICAgIH1cblxuICAgIGFwcGVuZFRvU3RyZWFtKGVuZCwgcmVzcG9uc2UpO1xuXG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9XG5cbiAgLy8gWFhYIEV4cG9ydGVkIHRvIGFsbG93IGNsaWVudC1zaWRlIG9ubHkgY2hhbmdlcyB0byByZWJ1aWxkIHRoZSBib2lsZXJwbGF0ZVxuICAvLyB3aXRob3V0IHJlcXVpcmluZyBhIGZ1bGwgc2VydmVyIHJlc3RhcnQuXG4gIC8vIFByb2R1Y2VzIGFuIEhUTUwgc3RyaW5nIHdpdGggZ2l2ZW4gbWFuaWZlc3QgYW5kIGJvaWxlcnBsYXRlU291cmNlLlxuICAvLyBPcHRpb25hbGx5IHRha2VzIHVybE1hcHBlciBpbiBjYXNlIHVybHMgZnJvbSBtYW5pZmVzdCBuZWVkIHRvIGJlIHByZWZpeGVkXG4gIC8vIG9yIHJld3JpdHRlbi5cbiAgLy8gT3B0aW9uYWxseSB0YWtlcyBwYXRoTWFwcGVyIGZvciByZXNvbHZpbmcgcmVsYXRpdmUgZmlsZSBzeXN0ZW0gcGF0aHMuXG4gIC8vIE9wdGlvbmFsbHkgYWxsb3dzIHRvIG92ZXJyaWRlIGZpZWxkcyBvZiB0aGUgZGF0YSBjb250ZXh0LlxuICBfZ2VuZXJhdGVCb2lsZXJwbGF0ZUZyb21NYW5pZmVzdChtYW5pZmVzdCwge1xuICAgIHVybE1hcHBlciA9IGlkZW50aXR5LFxuICAgIHBhdGhNYXBwZXIgPSBpZGVudGl0eSxcbiAgICBiYXNlRGF0YUV4dGVuc2lvbixcbiAgICBpbmxpbmUsXG4gIH0gPSB7fSkge1xuXG4gICAgY29uc3QgYm9pbGVycGxhdGVCYXNlRGF0YSA9IHtcbiAgICAgIGNzczogW10sXG4gICAgICBqczogW10sXG4gICAgICBoZWFkOiAnJyxcbiAgICAgIGJvZHk6ICcnLFxuICAgICAgbWV0ZW9yTWFuaWZlc3Q6IEpTT04uc3RyaW5naWZ5KG1hbmlmZXN0KSxcbiAgICAgIC4uLmJhc2VEYXRhRXh0ZW5zaW9uLFxuICAgIH07XG5cbiAgICBtYW5pZmVzdC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgY29uc3QgdXJsUGF0aCA9IHVybE1hcHBlcihpdGVtLnVybCk7XG4gICAgICBjb25zdCBpdGVtT2JqID0geyB1cmw6IHVybFBhdGggfTtcblxuICAgICAgaWYgKGlubGluZSkge1xuICAgICAgICBpdGVtT2JqLnNjcmlwdENvbnRlbnQgPSByZWFkVXRmOEZpbGVTeW5jKFxuICAgICAgICAgIHBhdGhNYXBwZXIoaXRlbS5wYXRoKSk7XG4gICAgICAgIGl0ZW1PYmouaW5saW5lID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbS5zcmkpIHtcbiAgICAgICAgaXRlbU9iai5zcmkgPSBpdGVtLnNyaTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2NzcycgJiYgaXRlbS53aGVyZSA9PT0gJ2NsaWVudCcpIHtcbiAgICAgICAgYm9pbGVycGxhdGVCYXNlRGF0YS5jc3MucHVzaChpdGVtT2JqKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2pzJyAmJiBpdGVtLndoZXJlID09PSAnY2xpZW50JyAmJlxuICAgICAgICAvLyBEeW5hbWljIEpTIG1vZHVsZXMgc2hvdWxkIG5vdCBiZSBsb2FkZWQgZWFnZXJseSBpbiB0aGVcbiAgICAgICAgLy8gaW5pdGlhbCBIVE1MIG9mIHRoZSBhcHAuXG4gICAgICAgICFpdGVtLnBhdGguc3RhcnRzV2l0aCgnZHluYW1pYy8nKSkge1xuICAgICAgICBib2lsZXJwbGF0ZUJhc2VEYXRhLmpzLnB1c2goaXRlbU9iaik7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICdoZWFkJykge1xuICAgICAgICBib2lsZXJwbGF0ZUJhc2VEYXRhLmhlYWQgPVxuICAgICAgICAgIHJlYWRVdGY4RmlsZVN5bmMocGF0aE1hcHBlcihpdGVtLnBhdGgpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2JvZHknKSB7XG4gICAgICAgIGJvaWxlcnBsYXRlQmFzZURhdGEuYm9keSA9XG4gICAgICAgICAgcmVhZFV0ZjhGaWxlU3luYyhwYXRoTWFwcGVyKGl0ZW0ucGF0aCkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5iYXNlRGF0YSA9IGJvaWxlcnBsYXRlQmFzZURhdGE7XG4gIH1cbn07XG5cbi8vIFJldHVybnMgYSB0ZW1wbGF0ZSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgcHJvZHVjZXMgdGhlIGJvaWxlcnBsYXRlXG4vLyBodG1sIGFzIGEgc3RyaW5nLlxuZnVuY3Rpb24gZ2V0VGVtcGxhdGUoYXJjaCkge1xuICBjb25zdCBwcmVmaXggPSBhcmNoLnNwbGl0KFwiLlwiLCAyKS5qb2luKFwiLlwiKTtcblxuICBpZiAocHJlZml4ID09PSBcIndlYi5icm93c2VyXCIpIHtcbiAgICByZXR1cm4gV2ViQnJvd3NlclRlbXBsYXRlO1xuICB9XG5cbiAgaWYgKHByZWZpeCA9PT0gXCJ3ZWIuY29yZG92YVwiKSB7XG4gICAgcmV0dXJuIFdlYkNvcmRvdmFUZW1wbGF0ZTtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGFyY2g6IFwiICsgYXJjaCk7XG59XG4iLCJpbXBvcnQgdGVtcGxhdGUgZnJvbSAnLi90ZW1wbGF0ZSc7XG5cbmNvbnN0IHNyaSA9IChzcmksIG1vZGUpID0+XG4gIChzcmkgJiYgbW9kZSkgPyBgIGludGVncml0eT1cInNoYTUxMi0ke3NyaX1cIiBjcm9zc29yaWdpbj1cIiR7bW9kZX1cImAgOiAnJztcblxuZXhwb3J0IGNvbnN0IGhlYWRUZW1wbGF0ZSA9ICh7XG4gIGNzcyxcbiAgaHRtbEF0dHJpYnV0ZXMsXG4gIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rLFxuICBzcmlNb2RlLFxuICBoZWFkLFxuICBkeW5hbWljSGVhZCxcbn0pID0+IHtcbiAgdmFyIGhlYWRTZWN0aW9ucyA9IGhlYWQuc3BsaXQoLzxtZXRlb3ItYnVuZGxlZC1jc3NbXjw+XSo+LywgMik7XG4gIHZhciBjc3NCdW5kbGUgPSBbLi4uKGNzcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICB0ZW1wbGF0ZSgnICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgY2xhc3M9XCJfX21ldGVvci1jc3NfX1wiIGhyZWY9XCI8JS0gaHJlZiAlPlwiPCU9IHNyaSAlPj4nKSh7XG4gICAgICBocmVmOiBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmaWxlLnVybCksXG4gICAgICBzcmk6IHNyaShmaWxlLnNyaSwgc3JpTW9kZSksXG4gICAgfSlcbiAgKV0uam9pbignXFxuJyk7XG5cbiAgcmV0dXJuIFtcbiAgICAnPGh0bWwnICsgT2JqZWN0LmtleXMoaHRtbEF0dHJpYnV0ZXMgfHwge30pLm1hcChcbiAgICAgIGtleSA9PiB0ZW1wbGF0ZSgnIDwlPSBhdHRyTmFtZSAlPj1cIjwlLSBhdHRyVmFsdWUgJT5cIicpKHtcbiAgICAgICAgYXR0ck5hbWU6IGtleSxcbiAgICAgICAgYXR0clZhbHVlOiBodG1sQXR0cmlidXRlc1trZXldLFxuICAgICAgfSlcbiAgICApLmpvaW4oJycpICsgJz4nLFxuXG4gICAgJzxoZWFkPicsXG5cbiAgICAoaGVhZFNlY3Rpb25zLmxlbmd0aCA9PT0gMSlcbiAgICAgID8gW2Nzc0J1bmRsZSwgaGVhZFNlY3Rpb25zWzBdXS5qb2luKCdcXG4nKVxuICAgICAgOiBbaGVhZFNlY3Rpb25zWzBdLCBjc3NCdW5kbGUsIGhlYWRTZWN0aW9uc1sxXV0uam9pbignXFxuJyksXG5cbiAgICBkeW5hbWljSGVhZCxcbiAgICAnPC9oZWFkPicsXG4gICAgJzxib2R5PicsXG4gIF0uam9pbignXFxuJyk7XG59O1xuXG4vLyBUZW1wbGF0ZSBmdW5jdGlvbiBmb3IgcmVuZGVyaW5nIHRoZSBib2lsZXJwbGF0ZSBodG1sIGZvciBicm93c2Vyc1xuZXhwb3J0IGNvbnN0IGNsb3NlVGVtcGxhdGUgPSAoe1xuICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICBtZXRlb3JSdW50aW1lSGFzaCxcbiAgcm9vdFVybFBhdGhQcmVmaXgsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkLFxuICBqcyxcbiAgYWRkaXRpb25hbFN0YXRpY0pzLFxuICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayxcbiAgc3JpTW9kZSxcbn0pID0+IFtcbiAgJycsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkXG4gICAgPyB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj5fX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoPCU9IGNvbmYgJT4pKTwvc2NyaXB0PicpKHtcbiAgICAgIGNvbmY6IG1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgfSlcbiAgICA6IHRlbXBsYXRlKCcgIDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiIHNyYz1cIjwlLSBzcmMgJT4vbWV0ZW9yX3J1bnRpbWVfY29uZmlnLmpzP2hhc2g9PCUtIGhhc2ggJT5cIj48L3NjcmlwdD4nKSh7XG4gICAgICBzcmM6IHJvb3RVcmxQYXRoUHJlZml4LFxuICAgICAgaGFzaDogbWV0ZW9yUnVudGltZUhhc2gsXG4gICAgfSksXG4gICcnLFxuXG4gIC4uLihqcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCI8JS0gc3JjICU+XCI8JT0gc3JpICU+Pjwvc2NyaXB0PicpKHtcbiAgICAgIHNyYzogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2soZmlsZS51cmwpLFxuICAgICAgc3JpOiBzcmkoZmlsZS5zcmksIHNyaU1vZGUpLFxuICAgIH0pXG4gICksXG5cbiAgLi4uKGFkZGl0aW9uYWxTdGF0aWNKcyB8fCBbXSkubWFwKCh7IGNvbnRlbnRzLCBwYXRobmFtZSB9KSA9PiAoXG4gICAgaW5saW5lU2NyaXB0c0FsbG93ZWRcbiAgICAgID8gdGVtcGxhdGUoJyAgPHNjcmlwdD48JT0gY29udGVudHMgJT48L3NjcmlwdD4nKSh7XG4gICAgICAgIGNvbnRlbnRzLFxuICAgICAgfSlcbiAgICAgIDogdGVtcGxhdGUoJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiPCUtIHNyYyAlPlwiPjwvc2NyaXB0PicpKHtcbiAgICAgICAgc3JjOiByb290VXJsUGF0aFByZWZpeCArIHBhdGhuYW1lLFxuICAgICAgfSlcbiAgKSksXG5cbiAgJycsXG4gICcnLFxuICAnPC9ib2R5PicsXG4gICc8L2h0bWw+J1xuXS5qb2luKCdcXG4nKTtcbiIsImltcG9ydCB0ZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlJztcblxuLy8gVGVtcGxhdGUgZnVuY3Rpb24gZm9yIHJlbmRlcmluZyB0aGUgYm9pbGVycGxhdGUgaHRtbCBmb3IgY29yZG92YVxuZXhwb3J0IGNvbnN0IGhlYWRUZW1wbGF0ZSA9ICh7XG4gIG1ldGVvclJ1bnRpbWVDb25maWcsXG4gIHJvb3RVcmxQYXRoUHJlZml4LFxuICBpbmxpbmVTY3JpcHRzQWxsb3dlZCxcbiAgY3NzLFxuICBqcyxcbiAgYWRkaXRpb25hbFN0YXRpY0pzLFxuICBodG1sQXR0cmlidXRlcyxcbiAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2ssXG4gIGhlYWQsXG4gIGR5bmFtaWNIZWFkLFxufSkgPT4ge1xuICB2YXIgaGVhZFNlY3Rpb25zID0gaGVhZC5zcGxpdCgvPG1ldGVvci1idW5kbGVkLWNzc1tePD5dKj4vLCAyKTtcbiAgdmFyIGNzc0J1bmRsZSA9IFtcbiAgICAvLyBXZSBhcmUgZXhwbGljaXRseSBub3QgdXNpbmcgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2s6IGluIGNvcmRvdmEgd2Ugc2VydmUgYXNzZXRzIHVwIGRpcmVjdGx5IGZyb20gZGlzaywgc28gcmV3cml0aW5nIHRoZSBVUkwgZG9lcyBub3QgbWFrZSBzZW5zZVxuICAgIC4uLihjc3MgfHwgW10pLm1hcChmaWxlID0+XG4gICAgICB0ZW1wbGF0ZSgnICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgY2xhc3M9XCJfX21ldGVvci1jc3NfX1wiIGhyZWY9XCI8JS0gaHJlZiAlPlwiPicpKHtcbiAgICAgICAgaHJlZjogZmlsZS51cmwsXG4gICAgICB9KVxuICApXS5qb2luKCdcXG4nKTtcblxuICByZXR1cm4gW1xuICAgICc8aHRtbD4nLFxuICAgICc8aGVhZD4nLFxuICAgICcgIDxtZXRhIGNoYXJzZXQ9XCJ1dGYtOFwiPicsXG4gICAgJyAgPG1ldGEgbmFtZT1cImZvcm1hdC1kZXRlY3Rpb25cIiBjb250ZW50PVwidGVsZXBob25lPW5vXCI+JyxcbiAgICAnICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwidXNlci1zY2FsYWJsZT1ubywgaW5pdGlhbC1zY2FsZT0xLCBtYXhpbXVtLXNjYWxlPTEsIG1pbmltdW0tc2NhbGU9MSwgd2lkdGg9ZGV2aWNlLXdpZHRoLCBoZWlnaHQ9ZGV2aWNlLWhlaWdodCwgdmlld3BvcnQtZml0PWNvdmVyXCI+JyxcbiAgICAnICA8bWV0YSBuYW1lPVwibXNhcHBsaWNhdGlvbi10YXAtaGlnaGxpZ2h0XCIgY29udGVudD1cIm5vXCI+JyxcbiAgICAnICA8bWV0YSBodHRwLWVxdWl2PVwiQ29udGVudC1TZWN1cml0eS1Qb2xpY3lcIiBjb250ZW50PVwiZGVmYXVsdC1zcmMgKiBhbmRyb2lkLXdlYnZpZXctdmlkZW8tcG9zdGVyOiBnYXA6IGRhdGE6IGJsb2I6IFxcJ3Vuc2FmZS1pbmxpbmVcXCcgXFwndW5zYWZlLWV2YWxcXCcgd3M6IHdzczo7XCI+JyxcblxuICAoaGVhZFNlY3Rpb25zLmxlbmd0aCA9PT0gMSlcbiAgICA/IFtjc3NCdW5kbGUsIGhlYWRTZWN0aW9uc1swXV0uam9pbignXFxuJylcbiAgICA6IFtoZWFkU2VjdGlvbnNbMF0sIGNzc0J1bmRsZSwgaGVhZFNlY3Rpb25zWzFdXS5qb2luKCdcXG4nKSxcblxuICAgICcgIDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPicsXG4gICAgdGVtcGxhdGUoJyAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoPCU9IGNvbmYgJT4pKTsnKSh7XG4gICAgICBjb25mOiBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgIH0pLFxuICAgICcgICAgaWYgKC9BbmRyb2lkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSkgeycsXG4gICAgLy8gV2hlbiBBbmRyb2lkIGFwcCBpcyBlbXVsYXRlZCwgaXQgY2Fubm90IGNvbm5lY3QgdG8gbG9jYWxob3N0LFxuICAgIC8vIGluc3RlYWQgaXQgc2hvdWxkIGNvbm5lY3QgdG8gMTAuMC4yLjJcbiAgICAvLyAodW5sZXNzIHdlXFwncmUgdXNpbmcgYW4gaHR0cCBwcm94eTsgdGhlbiBpdCB3b3JrcyEpXG4gICAgJyAgICAgIGlmICghX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5odHRwUHJveHlQb3J0KSB7JyxcbiAgICAnICAgICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMID0gKF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkwgfHwgXFwnXFwnKS5yZXBsYWNlKC9sb2NhbGhvc3QvaSwgXFwnMTAuMC4yLjJcXCcpOycsXG4gICAgJyAgICAgICAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCA9IChfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIHx8IFxcJ1xcJykucmVwbGFjZSgvbG9jYWxob3N0L2ksIFxcJzEwLjAuMi4yXFwnKTsnLFxuICAgICcgICAgICB9JyxcbiAgICAnICAgIH0nLFxuICAgICcgIDwvc2NyaXB0PicsXG4gICAgJycsXG4gICAgJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiL2NvcmRvdmEuanNcIj48L3NjcmlwdD4nLFxuXG4gICAgLi4uKGpzIHx8IFtdKS5tYXAoZmlsZSA9PlxuICAgICAgdGVtcGxhdGUoJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiPCUtIHNyYyAlPlwiPjwvc2NyaXB0PicpKHtcbiAgICAgICAgc3JjOiBmaWxlLnVybCxcbiAgICAgIH0pXG4gICAgKSxcblxuICAgIC4uLihhZGRpdGlvbmFsU3RhdGljSnMgfHwgW10pLm1hcCgoeyBjb250ZW50cywgcGF0aG5hbWUgfSkgPT4gKFxuICAgICAgaW5saW5lU2NyaXB0c0FsbG93ZWRcbiAgICAgICAgPyB0ZW1wbGF0ZSgnICA8c2NyaXB0PjwlPSBjb250ZW50cyAlPjwvc2NyaXB0PicpKHtcbiAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgfSlcbiAgICAgICAgOiB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCI8JS0gc3JjICU+XCI+PC9zY3JpcHQ+Jykoe1xuICAgICAgICAgIHNyYzogcm9vdFVybFBhdGhQcmVmaXggKyBwYXRobmFtZVxuICAgICAgICB9KVxuICAgICkpLFxuICAgICcnLFxuICAgICc8L2hlYWQ+JyxcbiAgICAnJyxcbiAgICAnPGJvZHk+JyxcbiAgXS5qb2luKCdcXG4nKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZVRlbXBsYXRlKCkge1xuICByZXR1cm4gXCI8L2JvZHk+XFxuPC9odG1sPlwiO1xufVxuIiwiaW1wb3J0IHsgXyB9IGZyb20gJ21ldGVvci91bmRlcnNjb3JlJztcblxuLy8gQXMgaWRlbnRpZmllZCBpbiBpc3N1ZSAjOTE0OSwgd2hlbiBhbiBhcHBsaWNhdGlvbiBvdmVycmlkZXMgdGhlIGRlZmF1bHRcbi8vIF8udGVtcGxhdGUgc2V0dGluZ3MgdXNpbmcgXy50ZW1wbGF0ZVNldHRpbmdzLCB0aG9zZSBuZXcgc2V0dGluZ3MgYXJlXG4vLyB1c2VkIGFueXdoZXJlIF8udGVtcGxhdGUgaXMgdXNlZCwgaW5jbHVkaW5nIHdpdGhpbiB0aGVcbi8vIGJvaWxlcnBsYXRlLWdlbmVyYXRvci4gVG8gaGFuZGxlIHRoaXMsIF8udGVtcGxhdGUgc2V0dGluZ3MgdGhhdCBoYXZlXG4vLyBiZWVuIHZlcmlmaWVkIHRvIHdvcmsgYXJlIG92ZXJyaWRkZW4gaGVyZSBvbiBlYWNoIF8udGVtcGxhdGUgY2FsbC5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHRlbXBsYXRlKHRleHQpIHtcbiAgcmV0dXJuIF8udGVtcGxhdGUodGV4dCwgbnVsbCwge1xuICAgIGV2YWx1YXRlICAgIDogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZSA6IC88JT0oW1xcc1xcU10rPyklPi9nLFxuICAgIGVzY2FwZSAgICAgIDogLzwlLShbXFxzXFxTXSs/KSU+L2csXG4gIH0pO1xufTtcbiJdfQ==
