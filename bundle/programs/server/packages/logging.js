(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EJSON = Package.ejson.EJSON;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Formatter, Log;

var require = meteorInstall({"node_modules":{"meteor":{"logging":{"logging.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/logging/logging.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let _objectSpread;
module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }
}, 0);
module.export({
  Log: () => Log
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }
}, 0);
const hasOwn = Object.prototype.hasOwnProperty;
function Log() {
  Log.info(...arguments);
}

/// FOR TESTING
let intercept = 0;
let interceptedLines = [];
let suppress = 0;

// Intercept the next 'count' calls to a Log function. The actual
// lines printed to the console can be cleared and read by calling
// Log._intercepted().
Log._intercept = count => {
  intercept += count;
};

// Suppress the next 'count' calls to a Log function. Use this to stop
// tests from spamming the console, especially with red errors that
// might look like a failing test.
Log._suppress = count => {
  suppress += count;
};

// Returns intercepted lines and resets the intercept counter.
Log._intercepted = () => {
  const lines = interceptedLines;
  interceptedLines = [];
  intercept = 0;
  return lines;
};

// Either 'json' or 'colored-text'.
//
// When this is set to 'json', print JSON documents that are parsed by another
// process ('satellite' or 'meteor run'). This other process should call
// 'Log.format' for nice output.
//
// When this is set to 'colored-text', call 'Log.format' before printing.
// This should be used for logging from within satellite, since there is no
// other process that will be reading its standard output.
Log.outputFormat = 'json';
const LEVEL_COLORS = {
  debug: 'green',
  // leave info as the default color
  warn: 'magenta',
  error: 'red'
};
const META_COLOR = 'blue';

// Default colors cause readability problems on Windows Powershell,
// switch to bright variants. While still capable of millions of
// operations per second, the benchmark showed a 25%+ increase in
// ops per second (on Node 8) by caching "process.platform".
const isWin32 = typeof process === 'object' && process.platform === 'win32';
const platformColor = color => {
  if (isWin32 && typeof color === 'string' && !color.endsWith('Bright')) {
    return "".concat(color, "Bright");
  }
  return color;
};

// XXX package
const RESTRICTED_KEYS = ['time', 'timeInexact', 'level', 'file', 'line', 'program', 'originApp', 'satellite', 'stderr'];
const FORMATTED_KEYS = [...RESTRICTED_KEYS, 'app', 'message'];
const logInBrowser = obj => {
  const str = Log.format(obj);

  // XXX Some levels should be probably be sent to the server
  const level = obj.level;
  if (typeof console !== 'undefined' && console[level]) {
    console[level](str);
  } else {
    // IE doesn't have console.log.apply, it's not a real Object.
    // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
    // http://patik.com/blog/complete-cross-browser-console-log/
    if (typeof console.log.apply === "function") {
      // Most browsers
      console.log.apply(console, [str]);
    } else if (typeof Function.prototype.bind === "function") {
      // IE9
      const log = Function.prototype.bind.call(console.log, console);
      log.apply(console, [str]);
    }
  }
};

// @returns {Object: { line: Number, file: String }}
Log._getCallerDetails = () => {
  const getStack = () => {
    // We do NOT use Error.prepareStackTrace here (a V8 extension that gets us a
    // pre-parsed stack) since it's impossible to compose it with the use of
    // Error.prepareStackTrace used on the server for source maps.
    const err = new Error();
    const stack = err.stack;
    return stack;
  };
  const stack = getStack();
  if (!stack) return {};

  // looking for the first line outside the logging package (or an
  // eval if we find that first)
  let line;
  const lines = stack.split('\n').slice(1);
  for (line of lines) {
    if (line.match(/^\s*(at eval \(eval)|(eval:)/)) {
      return {
        file: "eval"
      };
    }
    if (!line.match(/packages\/(?:local-test[:_])?logging(?:\/|\.js)/)) {
      break;
    }
  }
  const details = {};

  // The format for FF is 'functionName@filePath:lineNumber'
  // The format for V8 is 'functionName (packages/logging/logging.js:81)' or
  //                      'packages/logging/logging.js:81'
  const match = /(?:[@(]| at )([^(]+?):([0-9:]+)(?:\)|$)/.exec(line);
  if (!match) {
    return details;
  }

  // in case the matched block here is line:column
  details.line = match[2].split(':')[0];

  // Possible format: https://foo.bar.com/scripts/file.js?random=foobar
  // XXX: if you can write the following in better way, please do it
  // XXX: what about evals?
  details.file = match[1].split('/').slice(-1)[0].split('?')[0];
  return details;
};
['debug', 'info', 'warn', 'error'].forEach(level => {
  // @param arg {String|Object}
  Log[level] = arg => {
    if (suppress) {
      suppress--;
      return;
    }
    let intercepted = false;
    if (intercept) {
      intercept--;
      intercepted = true;
    }
    let obj = arg === Object(arg) && !(arg instanceof RegExp) && !(arg instanceof Date) ? arg : {
      message: new String(arg).toString()
    };
    RESTRICTED_KEYS.forEach(key => {
      if (obj[key]) {
        throw new Error("Can't set '".concat(key, "' in log message"));
      }
    });
    if (hasOwn.call(obj, 'message') && typeof obj.message !== 'string') {
      throw new Error("The 'message' field in log objects must be a string");
    }
    if (!obj.omitCallerDetails) {
      obj = _objectSpread(_objectSpread({}, Log._getCallerDetails()), obj);
    }
    obj.time = new Date();
    obj.level = level;

    // If we are in production don't write out debug logs.
    if (level === 'debug' && Meteor.isProduction) {
      return;
    }
    if (intercepted) {
      interceptedLines.push(EJSON.stringify(obj));
    } else if (Meteor.isServer) {
      if (Log.outputFormat === 'colored-text') {
        console.log(Log.format(obj, {
          color: true
        }));
      } else if (Log.outputFormat === 'json') {
        console.log(EJSON.stringify(obj));
      } else {
        throw new Error("Unknown logging output format: ".concat(Log.outputFormat));
      }
    } else {
      logInBrowser(obj);
    }
  };
});

// tries to parse line as EJSON. returns object if parse is successful, or null if not
Log.parse = line => {
  let obj = null;
  if (line && line.startsWith('{')) {
    // might be json generated from calling 'Log'
    try {
      obj = EJSON.parse(line);
    } catch (e) {}
  }

  // XXX should probably check fields other than 'time'
  if (obj && obj.time && obj.time instanceof Date) {
    return obj;
  } else {
    return null;
  }
};

// formats a log object into colored human and machine-readable text
Log.format = function (obj) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  obj = _objectSpread({}, obj); // don't mutate the argument
  let {
    time,
    timeInexact,
    level = 'info',
    file,
    line: lineNumber,
    app: appName = '',
    originApp,
    message = '',
    program = '',
    satellite = '',
    stderr = ''
  } = obj;
  if (!(time instanceof Date)) {
    throw new Error("'time' must be a Date object");
  }
  FORMATTED_KEYS.forEach(key => {
    delete obj[key];
  });
  if (Object.keys(obj).length > 0) {
    if (message) {
      message += ' ';
    }
    message += EJSON.stringify(obj);
  }
  const pad2 = n => n.toString().padStart(2, '0');
  const pad3 = n => n.toString().padStart(3, '0');
  const dateStamp = time.getFullYear().toString() + pad2(time.getMonth() + 1 /*0-based*/) + pad2(time.getDate());
  const timeStamp = pad2(time.getHours()) + ':' + pad2(time.getMinutes()) + ':' + pad2(time.getSeconds()) + '.' + pad3(time.getMilliseconds());

  // eg in San Francisco in June this will be '(-7)'
  const utcOffsetStr = "(".concat(-(new Date().getTimezoneOffset() / 60), ")");
  let appInfo = '';
  if (appName) {
    appInfo += appName;
  }
  if (originApp && originApp !== appName) {
    appInfo += " via ".concat(originApp);
  }
  if (appInfo) {
    appInfo = "[".concat(appInfo, "] ");
  }
  const sourceInfoParts = [];
  if (program) {
    sourceInfoParts.push(program);
  }
  if (file) {
    sourceInfoParts.push(file);
  }
  if (lineNumber) {
    sourceInfoParts.push(lineNumber);
  }
  let sourceInfo = !sourceInfoParts.length ? '' : "(".concat(sourceInfoParts.join(':'), ") ");
  if (satellite) sourceInfo += "[".concat(satellite, "]");
  const stderrIndicator = stderr ? '(STDERR) ' : '';
  const metaPrefix = [level.charAt(0).toUpperCase(), dateStamp, '-', timeStamp, utcOffsetStr, timeInexact ? '? ' : ' ', appInfo, sourceInfo, stderrIndicator].join('');
  return Formatter.prettify(metaPrefix, options.color && platformColor(options.metaColor || META_COLOR)) + Formatter.prettify(message, options.color && platformColor(LEVEL_COLORS[level]));
};

// Turn a line of text into a loggable object.
// @param line {String}
// @param override {Object}
Log.objFromText = (line, override) => {
  return _objectSpread({
    message: line,
    level: 'info',
    time: new Date(),
    timeInexact: true
  }, override);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"logging_server.js":function module(require){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/logging/logging_server.js                                                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
Formatter = {};
Formatter.prettify = function (line, color) {
  if (!color) return line;
  return require("chalk")[color](line);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"chalk":{"package.json":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// node_modules/meteor/logging/node_modules/chalk/package.json                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.exports = {
  "name": "chalk",
  "version": "4.1.1",
  "main": "source"
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"source":{"index.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// node_modules/meteor/logging/node_modules/chalk/source/index.js                                                 //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.useNode();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/logging/logging.js");
require("/node_modules/meteor/logging/logging_server.js");

/* Exports */
Package._define("logging", exports, {
  Log: Log
});

})();

//# sourceURL=meteor://💻app/packages/logging.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbG9nZ2luZy9sb2dnaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9sb2dnaW5nL2xvZ2dpbmdfc2VydmVyLmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJleHBvcnQiLCJMb2ciLCJNZXRlb3IiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImluZm8iLCJpbnRlcmNlcHQiLCJpbnRlcmNlcHRlZExpbmVzIiwic3VwcHJlc3MiLCJfaW50ZXJjZXB0IiwiY291bnQiLCJfc3VwcHJlc3MiLCJfaW50ZXJjZXB0ZWQiLCJsaW5lcyIsIm91dHB1dEZvcm1hdCIsIkxFVkVMX0NPTE9SUyIsImRlYnVnIiwid2FybiIsImVycm9yIiwiTUVUQV9DT0xPUiIsImlzV2luMzIiLCJwcm9jZXNzIiwicGxhdGZvcm0iLCJwbGF0Zm9ybUNvbG9yIiwiY29sb3IiLCJlbmRzV2l0aCIsIlJFU1RSSUNURURfS0VZUyIsIkZPUk1BVFRFRF9LRVlTIiwibG9nSW5Ccm93c2VyIiwib2JqIiwic3RyIiwiZm9ybWF0IiwibGV2ZWwiLCJjb25zb2xlIiwibG9nIiwiYXBwbHkiLCJGdW5jdGlvbiIsImJpbmQiLCJjYWxsIiwiX2dldENhbGxlckRldGFpbHMiLCJnZXRTdGFjayIsImVyciIsIkVycm9yIiwic3RhY2siLCJsaW5lIiwic3BsaXQiLCJzbGljZSIsIm1hdGNoIiwiZmlsZSIsImRldGFpbHMiLCJleGVjIiwiZm9yRWFjaCIsImFyZyIsImludGVyY2VwdGVkIiwiUmVnRXhwIiwiRGF0ZSIsIm1lc3NhZ2UiLCJTdHJpbmciLCJ0b1N0cmluZyIsImtleSIsIm9taXRDYWxsZXJEZXRhaWxzIiwidGltZSIsImlzUHJvZHVjdGlvbiIsInB1c2giLCJFSlNPTiIsInN0cmluZ2lmeSIsImlzU2VydmVyIiwicGFyc2UiLCJzdGFydHNXaXRoIiwiZSIsIm9wdGlvbnMiLCJ0aW1lSW5leGFjdCIsImxpbmVOdW1iZXIiLCJhcHAiLCJhcHBOYW1lIiwib3JpZ2luQXBwIiwicHJvZ3JhbSIsInNhdGVsbGl0ZSIsInN0ZGVyciIsImtleXMiLCJsZW5ndGgiLCJwYWQyIiwibiIsInBhZFN0YXJ0IiwicGFkMyIsImRhdGVTdGFtcCIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwidGltZVN0YW1wIiwiZ2V0SG91cnMiLCJnZXRNaW51dGVzIiwiZ2V0U2Vjb25kcyIsImdldE1pbGxpc2Vjb25kcyIsInV0Y09mZnNldFN0ciIsImdldFRpbWV6b25lT2Zmc2V0IiwiYXBwSW5mbyIsInNvdXJjZUluZm9QYXJ0cyIsInNvdXJjZUluZm8iLCJqb2luIiwic3RkZXJySW5kaWNhdG9yIiwibWV0YVByZWZpeCIsImNoYXJBdCIsInRvVXBwZXJDYXNlIiwiRm9ybWF0dGVyIiwicHJldHRpZnkiLCJtZXRhQ29sb3IiLCJvYmpGcm9tVGV4dCIsIm92ZXJyaWRlIiwicmVxdWlyZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLElBQUlBLGFBQWE7QUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7RUFBQ0MsT0FBTyxDQUFDQyxDQUFDLEVBQUM7SUFBQ0osYUFBYSxHQUFDSSxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQXJHSCxNQUFNLENBQUNJLE1BQU0sQ0FBQztFQUFDQyxHQUFHLEVBQUMsTUFBSUE7QUFBRyxDQUFDLENBQUM7QUFBQyxJQUFJQyxNQUFNO0FBQUNOLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsRUFBQztFQUFDSyxNQUFNLENBQUNILENBQUMsRUFBQztJQUFDRyxNQUFNLEdBQUNILENBQUM7RUFBQTtBQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7QUFFNUYsTUFBTUksTUFBTSxHQUFHQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYztBQUU5QyxTQUFT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S0FBSyxJQUFJRCxhQUFhLENBQUNSLFlBQVksQ0FBQ2lCLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQWpDLEdBQUcsQ0FBQzRHLFdBQVcsR0FBRyxDQUFDL0QsSUFBSSxFQUFFZ0UsUUFBUSxLQUFLO0VBQ3BDO0lBQ0VwRCxPQUFPLEVBQUVaLElBQUk7SUFDYlosS0FBSyxFQUFFLE1BQU07SUFDYjZCLElBQUksRUFBRSxJQUFJTixJQUFJLEVBQUU7SUFDaEJnQixXQUFXLEVBQUU7RUFBSSxHQUNkcUMsUUFBUTtBQUVmLENBQUMsQzs7Ozs7Ozs7Ozs7QUNyVURKLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDZEEsU0FBUyxDQUFDQyxRQUFRLEdBQUcsVUFBUzdELElBQUksRUFBRXBCLEtBQUssRUFBQztFQUN0QyxJQUFHLENBQUNBLEtBQUssRUFBRSxPQUFPb0IsSUFBSTtFQUN0QixPQUFPaUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDckYsS0FBSyxDQUFDLENBQUNvQixJQUFJLENBQUM7QUFDeEMsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9sb2dnaW5nLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIExvZyguLi5hcmdzKSB7XG4gIExvZy5pbmZvKC4uLmFyZ3MpO1xufVxuXG4vLy8gRk9SIFRFU1RJTkdcbmxldCBpbnRlcmNlcHQgPSAwO1xubGV0IGludGVyY2VwdGVkTGluZXMgPSBbXTtcbmxldCBzdXBwcmVzcyA9IDA7XG5cbi8vIEludGVyY2VwdCB0aGUgbmV4dCAnY291bnQnIGNhbGxzIHRvIGEgTG9nIGZ1bmN0aW9uLiBUaGUgYWN0dWFsXG4vLyBsaW5lcyBwcmludGVkIHRvIHRoZSBjb25zb2xlIGNhbiBiZSBjbGVhcmVkIGFuZCByZWFkIGJ5IGNhbGxpbmdcbi8vIExvZy5faW50ZXJjZXB0ZWQoKS5cbkxvZy5faW50ZXJjZXB0ID0gKGNvdW50KSA9PiB7XG4gIGludGVyY2VwdCArPSBjb3VudDtcbn07XG5cbi8vIFN1cHByZXNzIHRoZSBuZXh0ICdjb3VudCcgY2FsbHMgdG8gYSBMb2cgZnVuY3Rpb24uIFVzZSB0aGlzIHRvIHN0b3Bcbi8vIHRlc3RzIGZyb20gc3BhbW1pbmcgdGhlIGNvbnNvbGUsIGVzcGVjaWFsbHkgd2l0aCByZWQgZXJyb3JzIHRoYXRcbi8vIG1pZ2h0IGxvb2sgbGlrZSBhIGZhaWxpbmcgdGVzdC5cbkxvZy5fc3VwcHJlc3MgPSAoY291bnQpID0+IHtcbiAgc3VwcHJlc3MgKz0gY291bnQ7XG59O1xuXG4vLyBSZXR1cm5zIGludGVyY2VwdGVkIGxpbmVzIGFuZCByZXNldHMgdGhlIGludGVyY2VwdCBjb3VudGVyLlxuTG9nLl9pbnRlcmNlcHRlZCA9ICgpID0+IHtcbiAgY29uc3QgbGluZXMgPSBpbnRlcmNlcHRlZExpbmVzO1xuICBpbnRlcmNlcHRlZExpbmVzID0gW107XG4gIGludGVyY2VwdCA9IDA7XG4gIHJldHVybiBsaW5lcztcbn07XG5cbi8vIEVpdGhlciAnanNvbicgb3IgJ2NvbG9yZWQtdGV4dCcuXG4vL1xuLy8gV2hlbiB0aGlzIGlzIHNldCB0byAnanNvbicsIHByaW50IEpTT04gZG9jdW1lbnRzIHRoYXQgYXJlIHBhcnNlZCBieSBhbm90aGVyXG4vLyBwcm9jZXNzICgnc2F0ZWxsaXRlJyBvciAnbWV0ZW9yIHJ1bicpLiBUaGlzIG90aGVyIHByb2Nlc3Mgc2hvdWxkIGNhbGxcbi8vICdMb2cuZm9ybWF0JyBmb3IgbmljZSBvdXRwdXQuXG4vL1xuLy8gV2hlbiB0aGlzIGlzIHNldCB0byAnY29sb3JlZC10ZXh0JywgY2FsbCAnTG9nLmZvcm1hdCcgYmVmb3JlIHByaW50aW5nLlxuLy8gVGhpcyBzaG91bGQgYmUgdXNlZCBmb3IgbG9nZ2luZyBmcm9tIHdpdGhpbiBzYXRlbGxpdGUsIHNpbmNlIHRoZXJlIGlzIG5vXG4vLyBvdGhlciBwcm9jZXNzIHRoYXQgd2lsbCBiZSByZWFkaW5nIGl0cyBzdGFuZGFyZCBvdXRwdXQuXG5Mb2cub3V0cHV0Rm9ybWF0ID0gJ2pzb24nO1xuXG5jb25zdCBMRVZFTF9DT0xPUlMgPSB7XG4gIGRlYnVnOiAnZ3JlZW4nLFxuICAvLyBsZWF2ZSBpbmZvIGFzIHRoZSBkZWZhdWx0IGNvbG9yXG4gIHdhcm46ICdtYWdlbnRhJyxcbiAgZXJyb3I6ICdyZWQnXG59O1xuXG5jb25zdCBNRVRBX0NPTE9SID0gJ2JsdWUnO1xuXG4vLyBEZWZhdWx0IGNvbG9ycyBjYXVzZSByZWFkYWJpbGl0eSBwcm9ibGVtcyBvbiBXaW5kb3dzIFBvd2Vyc2hlbGwsXG4vLyBzd2l0Y2ggdG8gYnJpZ2h0IHZhcmlhbnRzLiBXaGlsZSBzdGlsbCBjYXBhYmxlIG9mIG1pbGxpb25zIG9mXG4vLyBvcGVyYXRpb25zIHBlciBzZWNvbmQsIHRoZSBiZW5jaG1hcmsgc2hvd2VkIGEgMjUlKyBpbmNyZWFzZSBpblxuLy8gb3BzIHBlciBzZWNvbmQgKG9uIE5vZGUgOCkgYnkgY2FjaGluZyBcInByb2Nlc3MucGxhdGZvcm1cIi5cbmNvbnN0IGlzV2luMzIgPSB0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJztcbmNvbnN0IHBsYXRmb3JtQ29sb3IgPSAoY29sb3IpID0+IHtcbiAgaWYgKGlzV2luMzIgJiYgdHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJyAmJiAhY29sb3IuZW5kc1dpdGgoJ0JyaWdodCcpKSB7XG4gICAgcmV0dXJuIGAke2NvbG9yfUJyaWdodGA7XG4gIH1cbiAgcmV0dXJuIGNvbG9yO1xufTtcblxuLy8gWFhYIHBhY2thZ2VcbmNvbnN0IFJFU1RSSUNURURfS0VZUyA9IFsndGltZScsICd0aW1lSW5leGFjdCcsICdsZXZlbCcsICdmaWxlJywgJ2xpbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3Byb2dyYW0nLCAnb3JpZ2luQXBwJywgJ3NhdGVsbGl0ZScsICdzdGRlcnInXTtcblxuY29uc3QgRk9STUFUVEVEX0tFWVMgPSBbLi4uUkVTVFJJQ1RFRF9LRVlTLCAnYXBwJywgJ21lc3NhZ2UnXTtcblxuY29uc3QgbG9nSW5Ccm93c2VyID0gb2JqID0+IHtcbiAgY29uc3Qgc3RyID0gTG9nLmZvcm1hdChvYmopO1xuXG4gIC8vIFhYWCBTb21lIGxldmVscyBzaG91bGQgYmUgcHJvYmFibHkgYmUgc2VudCB0byB0aGUgc2VydmVyXG4gIGNvbnN0IGxldmVsID0gb2JqLmxldmVsO1xuXG4gIGlmICgodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSAmJiBjb25zb2xlW2xldmVsXSkge1xuICAgIGNvbnNvbGVbbGV2ZWxdKHN0cik7XG4gIH0gZWxzZSB7XG4gICAgLy8gSUUgZG9lc24ndCBoYXZlIGNvbnNvbGUubG9nLmFwcGx5LCBpdCdzIG5vdCBhIHJlYWwgT2JqZWN0LlxuICAgIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTUzODk3Mi9jb25zb2xlLWxvZy1hcHBseS1ub3Qtd29ya2luZy1pbi1pZTlcbiAgICAvLyBodHRwOi8vcGF0aWsuY29tL2Jsb2cvY29tcGxldGUtY3Jvc3MtYnJvd3Nlci1jb25zb2xlLWxvZy9cbiAgICBpZiAodHlwZW9mIGNvbnNvbGUubG9nLmFwcGx5ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIC8vIE1vc3QgYnJvd3NlcnNcbiAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIFtzdHJdKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZW9mIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIC8vIElFOVxuICAgICAgY29uc3QgbG9nID0gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSk7XG4gICAgICBsb2cuYXBwbHkoY29uc29sZSwgW3N0cl0pO1xuICAgIH1cbiAgfVxufTtcblxuLy8gQHJldHVybnMge09iamVjdDogeyBsaW5lOiBOdW1iZXIsIGZpbGU6IFN0cmluZyB9fVxuTG9nLl9nZXRDYWxsZXJEZXRhaWxzID0gKCkgPT4ge1xuICBjb25zdCBnZXRTdGFjayA9ICgpID0+IHtcbiAgICAvLyBXZSBkbyBOT1QgdXNlIEVycm9yLnByZXBhcmVTdGFja1RyYWNlIGhlcmUgKGEgVjggZXh0ZW5zaW9uIHRoYXQgZ2V0cyB1cyBhXG4gICAgLy8gcHJlLXBhcnNlZCBzdGFjaykgc2luY2UgaXQncyBpbXBvc3NpYmxlIHRvIGNvbXBvc2UgaXQgd2l0aCB0aGUgdXNlIG9mXG4gICAgLy8gRXJyb3IucHJlcGFyZVN0YWNrVHJhY2UgdXNlZCBvbiB0aGUgc2VydmVyIGZvciBzb3VyY2UgbWFwcy5cbiAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3I7XG4gICAgY29uc3Qgc3RhY2sgPSBlcnIuc3RhY2s7XG4gICAgcmV0dXJuIHN0YWNrO1xuICB9O1xuXG4gIGNvbnN0IHN0YWNrID0gZ2V0U3RhY2soKTtcblxuICBpZiAoIXN0YWNrKSByZXR1cm4ge307XG5cbiAgLy8gbG9va2luZyBmb3IgdGhlIGZpcnN0IGxpbmUgb3V0c2lkZSB0aGUgbG9nZ2luZyBwYWNrYWdlIChvciBhblxuICAvLyBldmFsIGlmIHdlIGZpbmQgdGhhdCBmaXJzdClcbiAgbGV0IGxpbmU7XG4gIGNvbnN0IGxpbmVzID0gc3RhY2suc3BsaXQoJ1xcbicpLnNsaWNlKDEpO1xuICBmb3IgKGxpbmUgb2YgbGluZXMpIHtcbiAgICBpZiAobGluZS5tYXRjaCgvXlxccyooYXQgZXZhbCBcXChldmFsKXwoZXZhbDopLykpIHtcbiAgICAgIHJldHVybiB7ZmlsZTogXCJldmFsXCJ9O1xuICAgIH1cblxuICAgIGlmICghbGluZS5tYXRjaCgvcGFja2FnZXNcXC8oPzpsb2NhbC10ZXN0WzpfXSk/bG9nZ2luZyg/OlxcL3xcXC5qcykvKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZGV0YWlscyA9IHt9O1xuXG4gIC8vIFRoZSBmb3JtYXQgZm9yIEZGIGlzICdmdW5jdGlvbk5hbWVAZmlsZVBhdGg6bGluZU51bWJlcidcbiAgLy8gVGhlIGZvcm1hdCBmb3IgVjggaXMgJ2Z1bmN0aW9uTmFtZSAocGFja2FnZXMvbG9nZ2luZy9sb2dnaW5nLmpzOjgxKScgb3JcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgJ3BhY2thZ2VzL2xvZ2dpbmcvbG9nZ2luZy5qczo4MSdcbiAgY29uc3QgbWF0Y2ggPSAvKD86W0AoXXwgYXQgKShbXihdKz8pOihbMC05Ol0rKSg/OlxcKXwkKS8uZXhlYyhsaW5lKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG5cbiAgLy8gaW4gY2FzZSB0aGUgbWF0Y2hlZCBibG9jayBoZXJlIGlzIGxpbmU6Y29sdW1uXG4gIGRldGFpbHMubGluZSA9IG1hdGNoWzJdLnNwbGl0KCc6JylbMF07XG5cbiAgLy8gUG9zc2libGUgZm9ybWF0OiBodHRwczovL2Zvby5iYXIuY29tL3NjcmlwdHMvZmlsZS5qcz9yYW5kb209Zm9vYmFyXG4gIC8vIFhYWDogaWYgeW91IGNhbiB3cml0ZSB0aGUgZm9sbG93aW5nIGluIGJldHRlciB3YXksIHBsZWFzZSBkbyBpdFxuICAvLyBYWFg6IHdoYXQgYWJvdXQgZXZhbHM/XG4gIGRldGFpbHMuZmlsZSA9IG1hdGNoWzFdLnNwbGl0KCcvJykuc2xpY2UoLTEpWzBdLnNwbGl0KCc/JylbMF07XG5cbiAgcmV0dXJuIGRldGFpbHM7XG59O1xuXG5bJ2RlYnVnJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddLmZvckVhY2goKGxldmVsKSA9PiB7XG4gLy8gQHBhcmFtIGFyZyB7U3RyaW5nfE9iamVjdH1cbiBMb2dbbGV2ZWxdID0gKGFyZykgPT4ge1xuICBpZiAoc3VwcHJlc3MpIHtcbiAgICBzdXBwcmVzcy0tO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBpbnRlcmNlcHRlZCA9IGZhbHNlO1xuICBpZiAoaW50ZXJjZXB0KSB7XG4gICAgaW50ZXJjZXB0LS07XG4gICAgaW50ZXJjZXB0ZWQgPSB0cnVlO1xuICB9XG5cbiAgbGV0IG9iaiA9IChhcmcgPT09IE9iamVjdChhcmcpXG4gICAgJiYgIShhcmcgaW5zdGFuY2VvZiBSZWdFeHApXG4gICAgJiYgIShhcmcgaW5zdGFuY2VvZiBEYXRlKSlcbiAgICA/IGFyZ1xuICAgIDogeyBtZXNzYWdlOiBuZXcgU3RyaW5nKGFyZykudG9TdHJpbmcoKSB9O1xuXG4gIFJFU1RSSUNURURfS0VZUy5mb3JFYWNoKGtleSA9PiB7XG4gICAgaWYgKG9ialtrZXldKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IHNldCAnJHtrZXl9JyBpbiBsb2cgbWVzc2FnZWApO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKGhhc093bi5jYWxsKG9iaiwgJ21lc3NhZ2UnKSAmJiB0eXBlb2Ygb2JqLm1lc3NhZ2UgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlICdtZXNzYWdlJyBmaWVsZCBpbiBsb2cgb2JqZWN0cyBtdXN0IGJlIGEgc3RyaW5nXCIpO1xuICB9XG5cbiAgaWYgKCFvYmoub21pdENhbGxlckRldGFpbHMpIHtcbiAgICBvYmogPSB7IC4uLkxvZy5fZ2V0Q2FsbGVyRGV0YWlscygpLCAuLi5vYmogfTtcbiAgfVxuXG4gIG9iai50aW1lID0gbmV3IERhdGUoKTtcbiAgb2JqLmxldmVsID0gbGV2ZWw7XG5cbiAgLy8gSWYgd2UgYXJlIGluIHByb2R1Y3Rpb24gZG9uJ3Qgd3JpdGUgb3V0IGRlYnVnIGxvZ3MuXG4gIGlmIChsZXZlbCA9PT0gJ2RlYnVnJyAmJiBNZXRlb3IuaXNQcm9kdWN0aW9uKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGludGVyY2VwdGVkKSB7XG4gICAgaW50ZXJjZXB0ZWRMaW5lcy5wdXNoKEVKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfSBlbHNlIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICBpZiAoTG9nLm91dHB1dEZvcm1hdCA9PT0gJ2NvbG9yZWQtdGV4dCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKExvZy5mb3JtYXQob2JqLCB7Y29sb3I6IHRydWV9KSk7XG4gICAgfSBlbHNlIGlmIChMb2cub3V0cHV0Rm9ybWF0ID09PSAnanNvbicpIHtcbiAgICAgIGNvbnNvbGUubG9nKEVKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGxvZ2dpbmcgb3V0cHV0IGZvcm1hdDogJHtMb2cub3V0cHV0Rm9ybWF0fWApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsb2dJbkJyb3dzZXIob2JqKTtcbiAgfVxufTtcbn0pO1xuXG5cbi8vIHRyaWVzIHRvIHBhcnNlIGxpbmUgYXMgRUpTT04uIHJldHVybnMgb2JqZWN0IGlmIHBhcnNlIGlzIHN1Y2Nlc3NmdWwsIG9yIG51bGwgaWYgbm90XG5Mb2cucGFyc2UgPSAobGluZSkgPT4ge1xuICBsZXQgb2JqID0gbnVsbDtcbiAgaWYgKGxpbmUgJiYgbGluZS5zdGFydHNXaXRoKCd7JykpIHsgLy8gbWlnaHQgYmUganNvbiBnZW5lcmF0ZWQgZnJvbSBjYWxsaW5nICdMb2cnXG4gICAgdHJ5IHsgb2JqID0gRUpTT04ucGFyc2UobGluZSk7IH0gY2F0Y2ggKGUpIHt9XG4gIH1cblxuICAvLyBYWFggc2hvdWxkIHByb2JhYmx5IGNoZWNrIGZpZWxkcyBvdGhlciB0aGFuICd0aW1lJ1xuICBpZiAob2JqICYmIG9iai50aW1lICYmIChvYmoudGltZSBpbnN0YW5jZW9mIERhdGUpKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLy8gZm9ybWF0cyBhIGxvZyBvYmplY3QgaW50byBjb2xvcmVkIGh1bWFuIGFuZCBtYWNoaW5lLXJlYWRhYmxlIHRleHRcbkxvZy5mb3JtYXQgPSAob2JqLCBvcHRpb25zID0ge30pID0+IHtcbiAgb2JqID0geyAuLi5vYmogfTsgLy8gZG9uJ3QgbXV0YXRlIHRoZSBhcmd1bWVudFxuICBsZXQge1xuICAgIHRpbWUsXG4gICAgdGltZUluZXhhY3QsXG4gICAgbGV2ZWwgPSAnaW5mbycsXG4gICAgZmlsZSxcbiAgICBsaW5lOiBsaW5lTnVtYmVyLFxuICAgIGFwcDogYXBwTmFtZSA9ICcnLFxuICAgIG9yaWdpbkFwcCxcbiAgICBtZXNzYWdlID0gJycsXG4gICAgcHJvZ3JhbSA9ICcnLFxuICAgIHNhdGVsbGl0ZSA9ICcnLFxuICAgIHN0ZGVyciA9ICcnLFxuICB9ID0gb2JqO1xuXG4gIGlmICghKHRpbWUgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIid0aW1lJyBtdXN0IGJlIGEgRGF0ZSBvYmplY3RcIik7XG4gIH1cblxuICBGT1JNQVRURURfS0VZUy5mb3JFYWNoKChrZXkpID0+IHsgZGVsZXRlIG9ialtrZXldOyB9KTtcblxuICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPiAwKSB7XG4gICAgaWYgKG1lc3NhZ2UpIHtcbiAgICAgIG1lc3NhZ2UgKz0gJyAnO1xuICAgIH1cbiAgICBtZXNzYWdlICs9IEVKU09OLnN0cmluZ2lmeShvYmopO1xuICB9XG5cbiAgY29uc3QgcGFkMiA9IG4gPT4gbi50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IHBhZDMgPSBuID0+IG4udG9TdHJpbmcoKS5wYWRTdGFydCgzLCAnMCcpO1xuXG4gIGNvbnN0IGRhdGVTdGFtcCA9IHRpbWUuZ2V0RnVsbFllYXIoKS50b1N0cmluZygpICtcbiAgICBwYWQyKHRpbWUuZ2V0TW9udGgoKSArIDEgLyowLWJhc2VkKi8pICtcbiAgICBwYWQyKHRpbWUuZ2V0RGF0ZSgpKTtcbiAgY29uc3QgdGltZVN0YW1wID0gcGFkMih0aW1lLmdldEhvdXJzKCkpICtcbiAgICAgICAgJzonICtcbiAgICAgICAgcGFkMih0aW1lLmdldE1pbnV0ZXMoKSkgK1xuICAgICAgICAnOicgK1xuICAgICAgICBwYWQyKHRpbWUuZ2V0U2Vjb25kcygpKSArXG4gICAgICAgICcuJyArXG4gICAgICAgIHBhZDModGltZS5nZXRNaWxsaXNlY29uZHMoKSk7XG5cbiAgLy8gZWcgaW4gU2FuIEZyYW5jaXNjbyBpbiBKdW5lIHRoaXMgd2lsbCBiZSAnKC03KSdcbiAgY29uc3QgdXRjT2Zmc2V0U3RyID0gYCgkeygtKG5ldyBEYXRlKCkuZ2V0VGltZXpvbmVPZmZzZXQoKSAvIDYwKSl9KWA7XG5cbiAgbGV0IGFwcEluZm8gPSAnJztcbiAgaWYgKGFwcE5hbWUpIHtcbiAgICBhcHBJbmZvICs9IGFwcE5hbWU7XG4gIH1cbiAgaWYgKG9yaWdpbkFwcCAmJiBvcmlnaW5BcHAgIT09IGFwcE5hbWUpIHtcbiAgICBhcHBJbmZvICs9IGAgdmlhICR7b3JpZ2luQXBwfWA7XG4gIH1cbiAgaWYgKGFwcEluZm8pIHtcbiAgICBhcHBJbmZvID0gYFske2FwcEluZm99XSBgO1xuICB9XG5cbiAgY29uc3Qgc291cmNlSW5mb1BhcnRzID0gW107XG4gIGlmIChwcm9ncmFtKSB7XG4gICAgc291cmNlSW5mb1BhcnRzLnB1c2gocHJvZ3JhbSk7XG4gIH1cbiAgaWYgKGZpbGUpIHtcbiAgICBzb3VyY2VJbmZvUGFydHMucHVzaChmaWxlKTtcbiAgfVxuICBpZiAobGluZU51bWJlcikge1xuICAgIHNvdXJjZUluZm9QYXJ0cy5wdXNoKGxpbmVOdW1iZXIpO1xuICB9XG5cbiAgbGV0IHNvdXJjZUluZm8gPSAhc291cmNlSW5mb1BhcnRzLmxlbmd0aCA/XG4gICAgJycgOiBgKCR7c291cmNlSW5mb1BhcnRzLmpvaW4oJzonKX0pIGA7XG5cbiAgaWYgKHNhdGVsbGl0ZSlcbiAgICBzb3VyY2VJbmZvICs9IGBbJHtzYXRlbGxpdGV9XWA7XG5cbiAgY29uc3Qgc3RkZXJySW5kaWNhdG9yID0gc3RkZXJyID8gJyhTVERFUlIpICcgOiAnJztcblxuICBjb25zdCBtZXRhUHJlZml4ID0gW1xuICAgIGxldmVsLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpLFxuICAgIGRhdGVTdGFtcCxcbiAgICAnLScsXG4gICAgdGltZVN0YW1wLFxuICAgIHV0Y09mZnNldFN0cixcbiAgICB0aW1lSW5leGFjdCA/ICc/ICcgOiAnICcsXG4gICAgYXBwSW5mbyxcbiAgICBzb3VyY2VJbmZvLFxuICAgIHN0ZGVyckluZGljYXRvcl0uam9pbignJyk7XG5cblxuICByZXR1cm4gRm9ybWF0dGVyLnByZXR0aWZ5KG1ldGFQcmVmaXgsIG9wdGlvbnMuY29sb3IgJiYgcGxhdGZvcm1Db2xvcihvcHRpb25zLm1ldGFDb2xvciB8fCBNRVRBX0NPTE9SKSkgK1xuICAgICAgRm9ybWF0dGVyLnByZXR0aWZ5KG1lc3NhZ2UsIG9wdGlvbnMuY29sb3IgJiYgcGxhdGZvcm1Db2xvcihMRVZFTF9DT0xPUlNbbGV2ZWxdKSk7XG59O1xuXG4vLyBUdXJuIGEgbGluZSBvZiB0ZXh0IGludG8gYSBsb2dnYWJsZSBvYmplY3QuXG4vLyBAcGFyYW0gbGluZSB7U3RyaW5nfVxuLy8gQHBhcmFtIG92ZXJyaWRlIHtPYmplY3R9XG5Mb2cub2JqRnJvbVRleHQgPSAobGluZSwgb3ZlcnJpZGUpID0+IHtcbiAgcmV0dXJuIHtcbiAgICBtZXNzYWdlOiBsaW5lLFxuICAgIGxldmVsOiAnaW5mbycsXG4gICAgdGltZTogbmV3IERhdGUoKSxcbiAgICB0aW1lSW5leGFjdDogdHJ1ZSxcbiAgICAuLi5vdmVycmlkZVxuICB9O1xufTtcblxuZXhwb3J0IHsgTG9nIH07XG4iLCJGb3JtYXR0ZXIgPSB7fTtcbkZvcm1hdHRlci5wcmV0dGlmeSA9IGZ1bmN0aW9uKGxpbmUsIGNvbG9yKXtcbiAgICBpZighY29sb3IpIHJldHVybiBsaW5lO1xuICAgIHJldHVybiByZXF1aXJlKFwiY2hhbGtcIilbY29sb3JdKGxpbmUpO1xufVxuIl19
