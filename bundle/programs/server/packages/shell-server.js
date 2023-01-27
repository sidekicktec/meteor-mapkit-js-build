(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var socket;

var require = meteorInstall({"node_modules":{"meteor":{"shell-server":{"main.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// packages/shell-server/main.js                                                                   //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
module.link("./shell-server.js", {
  "*": "*"
}, 0);
let listen;
module.link("./shell-server.js", {
  listen(v) {
    listen = v;
  }
}, 1);
const shellDir = process.env.METEOR_SHELL_DIR;
if (shellDir) {
  listen(shellDir);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////

},"shell-server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                 //
// packages/shell-server/shell-server.js                                                           //
//                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                   //
!function (module1) {
  module1.export({
    listen: () => listen,
    disable: () => disable
  });
  let assert;
  module1.link("assert", {
    default(v) {
      assert = v;
    }
  }, 0);
  let pathJoin;
  module1.link("path", {
    join(v) {
      pathJoin = v;
    }
  }, 1);
  let PassThrough;
  module1.link("stream", {
    PassThrough(v) {
      PassThrough = v;
    }
  }, 2);
  let closeSync, openSync, readFileSync, unlink, writeFileSync, writeSync;
  module1.link("fs", {
    closeSync(v) {
      closeSync = v;
    },
    openSync(v) {
      openSync = v;
    },
    readFileSync(v) {
      readFileSync = v;
    },
    unlink(v) {
      unlink = v;
    },
    writeFileSync(v) {
      writeFileSync = v;
    },
    writeSync(v) {
      writeSync = v;
    }
  }, 3);
  let createServer;
  module1.link("net", {
    createServer(v) {
      createServer = v;
    }
  }, 4);
  let replStart;
  module1.link("repl", {
    start(v) {
      replStart = v;
    }
  }, 5);
  module1.link("meteor/inter-process-messaging");
  const INFO_FILE_MODE = parseInt("600", 8); // Only the owner can read or write.
  const EXITING_MESSAGE = "Shell exiting...";

  // Invoked by the server process to listen for incoming connections from
  // shell clients. Each connection gets its own REPL instance.
  function listen(shellDir) {
    function callback() {
      new Server(shellDir).listen();
    }

    // If the server is still in the very early stages of starting up,
    // Meteor.startup may not available yet.
    if (typeof Meteor === "object") {
      Meteor.startup(callback);
    } else if (typeof __meteor_bootstrap__ === "object") {
      const hooks = __meteor_bootstrap__.startupHooks;
      if (hooks) {
        hooks.push(callback);
      } else {
        // As a fallback, just call the callback asynchronously.
        setImmediate(callback);
      }
    }
  }
  function disable(shellDir) {
    try {
      // Replace info.json with a file that says the shell server is
      // disabled, so that any connected shell clients will fail to
      // reconnect after the server process closes their sockets.
      writeFileSync(getInfoFile(shellDir), JSON.stringify({
        status: "disabled",
        reason: "Shell server has shut down."
      }) + "\n", {
        mode: INFO_FILE_MODE
      });
    } catch (ignored) {}
  }
  // Shell commands need to be executed in a Fiber in case they call into
  // code that yields. Using a Promise is an even better idea, since it runs
  // its callbacks in Fibers drawn from a pool, so the Fibers are recycled.
  const evalCommandPromise = Promise.resolve();
  class Server {
    constructor(shellDir) {
      assert.ok(this instanceof Server);
      this.shellDir = shellDir;
      this.key = Math.random().toString(36).slice(2);
      this.server = createServer(socket => {
        this.onConnection(socket);
      }).on("error", err => {
        console.error(err.stack);
      });
    }
    listen() {
      const infoFile = getInfoFile(this.shellDir);
      unlink(infoFile, () => {
        this.server.listen(0, "127.0.0.1", () => {
          writeFileSync(infoFile, JSON.stringify({
            status: "enabled",
            port: this.server.address().port,
            key: this.key
          }) + "\n", {
            mode: INFO_FILE_MODE
          });
        });
      });
    }
    onConnection(socket) {
      // Make sure this function doesn't try to write anything to the socket
      // after it has been closed.
      socket.on("close", function () {
        socket = null;
      });

      // If communication is not established within 1000ms of the first
      // connection, forcibly close the socket.
      const timeout = setTimeout(function () {
        if (socket) {
          socket.removeAllListeners("data");
          socket.end(EXITING_MESSAGE + "\n");
        }
      }, 1000);

      // Let connecting clients configure certain REPL options by sending a
      // JSON object over the socket. For example, only the client knows
      // whether it's running a TTY or an Emacs subshell or some other kind of
      // terminal, so the client must decide the value of options.terminal.
      readJSONFromStream(socket, (error, options, replInputSocket) => {
        clearTimeout(timeout);
        if (error) {
          socket = null;
          console.error(error.stack);
          return;
        }
        if (options.key !== this.key) {
          if (socket) {
            socket.end(EXITING_MESSAGE + "\n");
          }
          return;
        }
        delete options.key;

        // Set the columns to what is being requested by the client.
        if (options.columns && socket) {
          socket.columns = options.columns;
        }
        delete options.columns;
        options = Object.assign(Object.create(null),
        // Defaults for configurable options.
        {
          prompt: "> ",
          terminal: true,
          useColors: true,
          ignoreUndefined: true
        },
        // Configurable options
        options,
        // Immutable options.
        {
          input: replInputSocket,
          useGlobal: false,
          output: socket
        });

        // The prompt during an evaluateAndExit must be blank to ensure
        // that the prompt doesn't inadvertently get parsed as part of
        // the JSON communication channel.
        if (options.evaluateAndExit) {
          options.prompt = "";
        }

        // Start the REPL.
        this.startREPL(options);
        if (options.evaluateAndExit) {
          this._wrappedDefaultEval.call(Object.create(null), options.evaluateAndExit.command, global, options.evaluateAndExit.filename || "<meteor shell>", function (error, result) {
            if (socket) {
              function sendResultToSocket(message) {
                // Sending back a JSON payload allows the client to
                // distinguish between errors and successful results.
                socket.end(JSON.stringify(message) + "\n");
              }
              if (error) {
                sendResultToSocket({
                  error: error.toString(),
                  code: 1
                });
              } else {
                sendResultToSocket({
                  result
                });
              }
            }
          });
          return;
        }
        delete options.evaluateAndExit;
        this.enableInteractiveMode(options);
      });
    }
    startREPL(options) {
      // Make sure this function doesn't try to write anything to the output
      // stream after it has been closed.
      options.output.on("close", function () {
        options.output = null;
      });
      const repl = this.repl = replStart(options);
      const {
        shellDir
      } = this;

      // This is technique of setting `repl.context` is similar to how the
      // `useGlobal` option would work during a normal `repl.start()` and
      // allows shell access (and tab completion!) to Meteor globals (i.e.
      // Underscore _, Meteor, etc.). By using this technique, which changes
      // the context after startup, we avoid stomping on the special `_`
      // variable (in `repl` this equals the value of the last command) from
      // being overridden in the client/server socket-handshaking.  Furthermore,
      // by setting `useGlobal` back to true, we allow the default eval function
      // to use the desired `runInThisContext` method (https://git.io/vbvAB).
      repl.context = global;
      repl.useGlobal = true;
      setRequireAndModule(repl.context);

      // In order to avoid duplicating code here, specifically the complexities
      // of catching so-called "Recoverable Errors" (https://git.io/vbvbl),
      // we will wrap the default eval, run it in a Fiber (via a Promise), and
      // give it the opportunity to decide if the user is mid-code-block.
      const defaultEval = repl.eval;
      function wrappedDefaultEval(code, context, file, callback) {
        if (Package.ecmascript) {
          try {
            code = Package.ecmascript.ECMAScript.compileForShell(code, {
              cacheDirectory: getCacheDirectory(shellDir)
            });
          } catch (err) {
            // Any Babel error here might be just fine since it's
            // possible the code was incomplete (multi-line code on the REPL).
            // The defaultEval below will use its own functionality to determine
            // if this error is "recoverable".
          }
        }
        evalCommandPromise.then(() => defaultEval(code, context, file, callback)).catch(callback);
      }

      // Have the REPL use the newly wrapped function instead and store the
      // _wrappedDefaultEval so that evalulateAndExit calls can use it directly.
      repl.eval = this._wrappedDefaultEval = wrappedDefaultEval;
    }
    enableInteractiveMode(options) {
      // History persists across shell sessions!
      this.initializeHistory();
      const repl = this.repl;

      // Implement an alternate means of fetching the return value,
      // via `__` (double underscore) as originally implemented in:
      // https://github.com/meteor/meteor/commit/2443d832265c7d1c
      Object.defineProperty(repl.context, "__", {
        get: () => repl.last,
        set: val => {
          repl.last = val;
        },
        // Allow this property to be (re)defined more than once (e.g. each
        // time the server restarts).
        configurable: true
      });

      // Some improvements to the existing help messages.
      function addHelp(cmd, helpText) {
        const info = repl.commands[cmd] || repl.commands["." + cmd];
        if (info) {
          info.help = helpText;
        }
      }
      addHelp("break", "Terminate current command input and display new prompt");
      addHelp("exit", "Disconnect from server and leave shell");
      addHelp("help", "Show this help information");

      // When the REPL exits, signal the attached client to exit by sending it
      // the special EXITING_MESSAGE.
      repl.on("exit", function () {
        if (options.output) {
          options.output.write(EXITING_MESSAGE + "\n");
          options.output.end();
        }
      });

      // When the server process exits, end the output stream but do not
      // signal the attached client to exit.
      process.on("exit", function () {
        if (options.output) {
          options.output.end();
        }
      });

      // This Meteor-specific shell command rebuilds the application as if a
      // change was made to server code.
      repl.defineCommand("reload", {
        help: "Restart the server and the shell",
        action: function () {
          if (process.sendMessage) {
            process.sendMessage("shell-server", {
              command: "reload"
            });
          } else {
            process.exit(0);
          }
        }
      });
    }

    // This function allows a persistent history of shell commands to be saved
    // to and loaded from .meteor/local/shell/history.
    initializeHistory() {
      const repl = this.repl;
      const historyFile = getHistoryFile(this.shellDir);
      let historyFd = openSync(historyFile, "a+");
      const historyLines = readFileSync(historyFile, "utf8").split("\n");
      const seenLines = Object.create(null);
      if (!repl.history) {
        repl.history = [];
        repl.historyIndex = -1;
      }
      while (repl.history && historyLines.length > 0) {
        const line = historyLines.pop();
        if (line && /\S/.test(line) && !seenLines[line]) {
          repl.history.push(line);
          seenLines[line] = true;
        }
      }
      repl.addListener("line", function (line) {
        if (historyFd >= 0 && /\S/.test(line)) {
          writeSync(historyFd, line + "\n");
        }
      });
      this.repl.on("exit", function () {
        closeSync(historyFd);
        historyFd = -1;
      });
    }
  }
  function readJSONFromStream(inputStream, callback) {
    const outputStream = new PassThrough();
    let dataSoFar = "";
    function onData(buffer) {
      const lines = buffer.toString("utf8").split("\n");
      while (lines.length > 0) {
        dataSoFar += lines.shift();
        let json;
        try {
          json = JSON.parse(dataSoFar);
        } catch (error) {
          if (error instanceof SyntaxError) {
            continue;
          }
          return finish(error);
        }
        if (lines.length > 0) {
          outputStream.write(lines.join("\n"));
        }
        inputStream.pipe(outputStream);
        return finish(null, json);
      }
    }
    function onClose() {
      finish(new Error("stream unexpectedly closed"));
    }
    let finished = false;
    function finish(error, json) {
      if (!finished) {
        finished = true;
        inputStream.removeListener("data", onData);
        inputStream.removeListener("error", finish);
        inputStream.removeListener("close", onClose);
        callback(error, json, outputStream);
      }
    }
    inputStream.on("data", onData);
    inputStream.on("error", finish);
    inputStream.on("close", onClose);
  }
  function getInfoFile(shellDir) {
    return pathJoin(shellDir, "info.json");
  }
  function getHistoryFile(shellDir) {
    return pathJoin(shellDir, "history");
  }
  function getCacheDirectory(shellDir) {
    return pathJoin(shellDir, "cache");
  }
  function setRequireAndModule(context) {
    if (Package.modules) {
      // Use the same `require` function and `module` object visible to the
      // application.
      const toBeInstalled = {};
      const shellModuleName = "meteor-shell-" + Math.random().toString(36).slice(2) + ".js";
      toBeInstalled[shellModuleName] = function (require, exports, module) {
        context.module = module;
        context.require = require;

        // Tab completion sometimes uses require.extensions, but only for
        // the keys.
        require.extensions = {
          ".js": true,
          ".json": true,
          ".node": true
        };
      };

      // This populates repl.context.{module,require} by evaluating the
      // module defined above.
      Package.modules.meteorInstall(toBeInstalled)("./" + shellModuleName);
    }
  }
}.call(this, module);
/////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/shell-server/main.js");

/* Exports */
Package._define("shell-server", exports);

})();

//# sourceURL=meteor://💻app/packages/shell-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc2hlbGwtc2VydmVyL21haW4uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3NoZWxsLXNlcnZlci9zaGVsbC1zZXJ2ZXIuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsImxpc3RlbiIsInYiLCJzaGVsbERpciIsInByb2Nlc3MiLCJlbnYiLCJNRVRFT1JfU0hFTExfRElSIiwibW9kdWxlMSIsImV4cG9ydCIsImRpc2FibGUiLCJhc3NlcnQiLCJkZWZhdWx0IiwicGF0aEpvaW4iLCJqb2luIiwiUGFzc1Rocm91Z2giLCJjbG9zZVN5bmMiLCJvcGVuU3luYyIsInJlYWRGaWxlU3luYyIsInVubGluayIsIndyaXRlRmlsZVN5bmMiLCJ3cml0ZVN5bmMiLCJjcmVhdGVTZXJ2ZXIiLCJyZXBsU3RhcnQiLCJzdGFydCIsIklORk9fRklMRV9NT0RFIiwicGFyc2VJbnQiLCJFWElUSU5HX01FU1NBR0UiLCJjYWxsYmFjayIsIlNlcnZlciIsIk1ldGVvciIsInN0YXJ0dXAiLCJfX21ldGVvcl9ib290c3RyYXBfXyIsImhvb2tzIiwic3RhcnR1cEhvb2tzIiwicHVzaCIsInNldEltbWVkaWF0ZSIsImdldEluZm9GaWxlIiwiSlNPTiIsInN0cmluZ2lmeSIsInN0YXR1cyIsInJlYXNvbiIsIm1vZGUiLCJpZ25vcmVkIiwiZXZhbENvbW1hbmRQcm9taXNlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJjb25zdHJ1Y3RvciIsIm9rIiwia2V5IiwiTWF0aCIsInJhbmRvbSIsInRvU3RyaW5nIiwic2xpY2UiLCJzZXJ2ZXIiLCJzb2NrZXQiLCJvbkNvbm5lY3Rpb24iLCJvbiIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsInN0YWNrIiwiaW5mb0ZpbGUiLCJwb3J0IiwiYWRkcmVzcyIsInRpbWVvdXQiLCJzZXRUaW1lb3V0IiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwiZW5kIiwicmVhZEpTT05Gcm9tU3RyZWFtIiwib3B0aW9ucyIsInJlcGxJbnB1dFNvY2tldCIsImNsZWFyVGltZW91dCIsImNvbHVtbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJjcmVhdGUiLCJwcm9tcHQiLCJ0ZXJtaW5hbCIsInVzZUNvbG9ycyIsImlnbm9yZVVuZGVmaW5lZCIsImlucHV0IiwidXNlR2xvYmFsIiwib3V0cHV0IiwiZXZhbHVhdGVBbmRFeGl0Iiwic3RhcnRSRVBMIiwiX3dyYXBwZWREZWZhdWx0RXZhbCIsImNhbGwiLCJjb21tYW5kIiwiZ2xvYmFsIiwiZmlsZW5hbWUiLCJyZXN1bHQiLCJzZW5kUmVzdWx0VG9Tb2NrZXQiLCJtZXNzYWdlIiwiY29kZSIsImVuYWJsZUludGVyYWN0aXZlTW9kZSIsInJlcGwiLCJjb250ZXh0Iiwic2V0UmVxdWlyZUFuZE1vZHVsZSIsImRlZmF1bHRFdmFsIiwiZXZhbCIsIndyYXBwZWREZWZhdWx0RXZhbCIsImZpbGUiLCJQYWNrYWdlIiwiZWNtYXNjcmlwdCIsIkVDTUFTY3JpcHQiLCJjb21waWxlRm9yU2hlbGwiLCJjYWNoZURpcmVjdG9yeSIsImdldENhY2hlRGlyZWN0b3J5IiwidGhlbiIsImNhdGNoIiwiaW5pdGlhbGl6ZUhpc3RvcnkiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsImxhc3QiLCJzZXQiLCJ2YWwiLCJjb25maWd1cmFibGUiLCJhZGRIZWxwIiwiY21kIiwiaGVscFRleHQiLCJpbmZvIiwiY29tbWFuZHMiLCJoZWxwIiwid3JpdGUiLCJkZWZpbmVDb21tYW5kIiwiYWN0aW9uIiwic2VuZE1lc3NhZ2UiLCJleGl0IiwiaGlzdG9yeUZpbGUiLCJnZXRIaXN0b3J5RmlsZSIsImhpc3RvcnlGZCIsImhpc3RvcnlMaW5lcyIsInNwbGl0Iiwic2VlbkxpbmVzIiwiaGlzdG9yeSIsImhpc3RvcnlJbmRleCIsImxlbmd0aCIsImxpbmUiLCJwb3AiLCJ0ZXN0IiwiYWRkTGlzdGVuZXIiLCJpbnB1dFN0cmVhbSIsIm91dHB1dFN0cmVhbSIsImRhdGFTb0ZhciIsIm9uRGF0YSIsImJ1ZmZlciIsImxpbmVzIiwic2hpZnQiLCJqc29uIiwicGFyc2UiLCJTeW50YXhFcnJvciIsImZpbmlzaCIsInBpcGUiLCJvbkNsb3NlIiwiRXJyb3IiLCJmaW5pc2hlZCIsInJlbW92ZUxpc3RlbmVyIiwibW9kdWxlcyIsInRvQmVJbnN0YWxsZWQiLCJzaGVsbE1vZHVsZU5hbWUiLCJyZXF1aXJlIiwiZXhwb3J0cyIsImV4dGVuc2lvbnMiLCJtZXRlb3JJbnN0YWxsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxJQUFJLENBQUMsbUJBQW1CLEVBQUM7RUFBQyxHQUFHLEVBQUM7QUFBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQUMsSUFBSUMsTUFBTTtBQUFDRixNQUFNLENBQUNDLElBQUksQ0FBQyxtQkFBbUIsRUFBQztFQUFDQyxNQUFNLENBQUNDLENBQUMsRUFBQztJQUFDRCxNQUFNLEdBQUNDLENBQUM7RUFBQTtBQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7QUFHaEgsTUFBTUMsUUFBUSxHQUFHQyxPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsZ0JBQWdCO0FBQzdDLElBQUlILFFBQVEsRUFBRTtFQUNaRixNQUFNLENBQUNFLFFBQVEsQ0FBQztBQUNsQixDOzs7Ozs7Ozs7Ozs7RUNOQUksT0FBTyxDQUFDQyxNQUFNLENBQUM7SUFBQ1AsTUFBTSxFQUFDLE1BQUlBLE1BQU07SUFBQ1EsT0FBTyxFQUFDLE1BQUlBO0VBQU8sQ0FBQyxDQUFDO0VBQUMsSUFBSUMsTUFBTTtFQUFDSCxPQUFPLENBQUNQLElBQUksQ0FBQyxRQUFRLEVBQUM7SUFBQ1csT0FBTyxDQUFDVCxDQUFDLEVBQUM7TUFBQ1EsTUFBTSxHQUFDUixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSVUsUUFBUTtFQUFDTCxPQUFPLENBQUNQLElBQUksQ0FBQyxNQUFNLEVBQUM7SUFBQ2EsSUFBSSxDQUFDWCxDQUFDLEVBQUM7TUFBQ1UsUUFBUSxHQUFDVixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSVksV0FBVztFQUFDUCxPQUFPLENBQUNQLElBQUksQ0FBQyxRQUFRLEVBQUM7SUFBQ2MsV0FBVyxDQUFDWixDQUFDLEVBQUM7TUFBQ1ksV0FBVyxHQUFDWixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUMsSUFBSWEsU0FBUyxFQUFDQyxRQUFRLEVBQUNDLFlBQVksRUFBQ0MsTUFBTSxFQUFDQyxhQUFhLEVBQUNDLFNBQVM7RUFBQ2IsT0FBTyxDQUFDUCxJQUFJLENBQUMsSUFBSSxFQUFDO0lBQUNlLFNBQVMsQ0FBQ2IsQ0FBQyxFQUFDO01BQUNhLFNBQVMsR0FBQ2IsQ0FBQztJQUFBLENBQUM7SUFBQ2MsUUFBUSxDQUFDZCxDQUFDLEVBQUM7TUFBQ2MsUUFBUSxHQUFDZCxDQUFDO0lBQUEsQ0FBQztJQUFDZSxZQUFZLENBQUNmLENBQUMsRUFBQztNQUFDZSxZQUFZLEdBQUNmLENBQUM7SUFBQSxDQUFDO0lBQUNnQixNQUFNLENBQUNoQixDQUFDLEVBQUM7TUFBQ2dCLE1BQU0sR0FBQ2hCLENBQUM7SUFBQSxDQUFDO0lBQUNpQixhQUFhLENBQUNqQixDQUFDLEVBQUM7TUFBQ2lCLGFBQWEsR0FBQ2pCLENBQUM7SUFBQSxDQUFDO0lBQUNrQixTQUFTLENBQUNsQixDQUFDLEVBQUM7TUFBQ2tCLFNBQVMsR0FBQ2xCLENBQUM7SUFBQTtFQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7RUFBQyxJQUFJbUIsWUFBWTtFQUFDZCxPQUFPLENBQUNQLElBQUksQ0FBQyxLQUFLLEVBQUM7SUFBQ3FCLFlBQVksQ0FBQ25CLENBQUMsRUFBQztNQUFDbUIsWUFBWSxHQUFDbkIsQ0FBQztJQUFBO0VBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztFQUFDLElBQUlvQixTQUFTO0VBQUNmLE9BQU8sQ0FBQ1AsSUFBSSxDQUFDLE1BQU0sRUFBQztJQUFDdUIsS0FBSyxDQUFDckIsQ0FBQyxFQUFDO01BQUNvQixTQUFTLEdBQUNwQixDQUFDO0lBQUE7RUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0VBQUNLLE9BQU8sQ0FBQ1AsSUFBSSxDQUFDLGdDQUFnQyxDQUFDO0VBaUJ0cUIsTUFBTXdCLGNBQWMsR0FBR0MsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQzNDLE1BQU1DLGVBQWUsR0FBRyxrQkFBa0I7O0VBRTFDO0VBQ0E7RUFDTyxTQUFTekIsTUFBTSxDQUFDRSxRQUFRLEVBQUU7SUFDL0IsU0FBU3dCLFFBQVEsR0FBRztNQUNsQixJQUFJQyxNQUFNLENBQUN6QixRQUFRLENBQUMsQ0FBQ0YsTUFBTSxFQUFFO0lBQy9COztJQUVBO0lBQ0E7SUFDQSxJQUFJLE9BQU80QixNQUFNLEtBQUssUUFBUSxFQUFFO01BQzlCQSxNQUFNLENBQUNDLE9BQU8sQ0FBQ0gsUUFBUSxDQUFDO0lBQzFCLENBQUMsTUFBTSxJQUFJLE9BQU9JLG9CQUFvQixLQUFLLFFBQVEsRUFBRTtNQUNuRCxNQUFNQyxLQUFLLEdBQUdELG9CQUFvQixDQUFDRSxZQUFZO01BQy9DLElBQUlELEtBQUssRUFBRTtRQUNUQSxLQUFLLENBQUNFLElBQUksQ0FBQ1AsUUFBUSxDQUFDO01BQ3RCLENBQUMsTUFBTTtRQUNMO1FBQ0FRLFlBQVksQ0FBQ1IsUUFBUSxDQUFDO01BQ3hCO0lBQ0Y7RUFDRjtFQUdPLFNBQVNsQixPQUFPLENBQUNOLFFBQVEsRUFBRTtJQUNoQyxJQUFJO01BQ0Y7TUFDQTtNQUNBO01BQ0FnQixhQUFhLENBQ1hpQixXQUFXLENBQUNqQyxRQUFRLENBQUMsRUFDckJrQyxJQUFJLENBQUNDLFNBQVMsQ0FBQztRQUNiQyxNQUFNLEVBQUUsVUFBVTtRQUNsQkMsTUFBTSxFQUFFO01BQ1YsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUNUO1FBQUVDLElBQUksRUFBRWpCO01BQWUsQ0FBQyxDQUN6QjtJQUNILENBQUMsQ0FBQyxPQUFPa0IsT0FBTyxFQUFFLENBQUM7RUFDckI7RUFFQTtFQUNBO0VBQ0E7RUFDQSxNQUFNQyxrQkFBa0IsR0FBR0MsT0FBTyxDQUFDQyxPQUFPLEVBQUU7RUFFNUMsTUFBTWpCLE1BQU0sQ0FBQztJQUNYa0IsV0FBVyxDQUFDM0MsUUFBUSxFQUFFO01BQ3BCTyxNQUFNLENBQUNxQyxFQUFFLENBQUMsSUFBSSxZQUFZbkIsTUFBTSxDQUFDO01BRWpDLElBQUksQ0FBQ3pCLFFBQVEsR0FBR0EsUUFBUTtNQUN4QixJQUFJLENBQUM2QyxHQUFHLEdBQUdDLElBQUksQ0FBQ0MsTUFBTSxFQUFFLENBQUNDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUMsQ0FBQztNQUU5QyxJQUFJLENBQUNDLE1BQU0sR0FDVGhDLFlBQVksQ0FBRWlDLE1BQU0sSUFBSztRQUN2QixJQUFJLENBQUNDLFlBQVksQ0FBQ0QsTUFBTSxDQUFDO01BQzNCLENBQUMsQ0FBQyxDQUNERSxFQUFFLENBQUMsT0FBTyxFQUFHQyxHQUFHLElBQUs7UUFDcEJDLE9BQU8sQ0FBQ0MsS0FBSyxDQUFDRixHQUFHLENBQUNHLEtBQUssQ0FBQztNQUMxQixDQUFDLENBQUM7SUFDTjtJQUVBM0QsTUFBTSxHQUFHO01BQ1AsTUFBTTRELFFBQVEsR0FBR3pCLFdBQVcsQ0FBQyxJQUFJLENBQUNqQyxRQUFRLENBQUM7TUFFM0NlLE1BQU0sQ0FBQzJDLFFBQVEsRUFBRSxNQUFNO1FBQ3JCLElBQUksQ0FBQ1IsTUFBTSxDQUFDcEQsTUFBTSxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsTUFBTTtVQUN2Q2tCLGFBQWEsQ0FBQzBDLFFBQVEsRUFBRXhCLElBQUksQ0FBQ0MsU0FBUyxDQUFDO1lBQ3JDQyxNQUFNLEVBQUUsU0FBUztZQUNqQnVCLElBQUksRUFBRSxJQUFJLENBQUNULE1BQU0sQ0FBQ1UsT0FBTyxFQUFFLENBQUNELElBQUk7WUFDaENkLEdBQUcsRUFBRSxJQUFJLENBQUNBO1VBQ1osQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFO1lBQ1RQLElBQUksRUFBRWpCO1VBQ1IsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO01BQ0osQ0FBQyxDQUFDO0lBQ0o7SUFFQStCLFlBQVksQ0FBQ0QsTUFBTSxFQUFFO01BQ25CO01BQ0E7TUFDQUEsTUFBTSxDQUFDRSxFQUFFLENBQUMsT0FBTyxFQUFFLFlBQVc7UUFDNUJGLE1BQU0sR0FBRyxJQUFJO01BQ2YsQ0FBQyxDQUFDOztNQUVGO01BQ0E7TUFDQSxNQUFNVSxPQUFPLEdBQUdDLFVBQVUsQ0FBQyxZQUFXO1FBQ3BDLElBQUlYLE1BQU0sRUFBRTtVQUNWQSxNQUFNLENBQUNZLGtCQUFrQixDQUFDLE1BQU0sQ0FBQztVQUNqQ1osTUFBTSxDQUFDYSxHQUFHLENBQUN6QyxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQ3BDO01BQ0YsQ0FBQyxFQUFFLElBQUksQ0FBQzs7TUFFUjtNQUNBO01BQ0E7TUFDQTtNQUNBMEMsa0JBQWtCLENBQUNkLE1BQU0sRUFBRSxDQUFDSyxLQUFLLEVBQUVVLE9BQU8sRUFBRUMsZUFBZSxLQUFLO1FBQzlEQyxZQUFZLENBQUNQLE9BQU8sQ0FBQztRQUVyQixJQUFJTCxLQUFLLEVBQUU7VUFDVEwsTUFBTSxHQUFHLElBQUk7VUFDYkksT0FBTyxDQUFDQyxLQUFLLENBQUNBLEtBQUssQ0FBQ0MsS0FBSyxDQUFDO1VBQzFCO1FBQ0Y7UUFFQSxJQUFJUyxPQUFPLENBQUNyQixHQUFHLEtBQUssSUFBSSxDQUFDQSxHQUFHLEVBQUU7VUFDNUIsSUFBSU0sTUFBTSxFQUFFO1lBQ1ZBLE1BQU0sQ0FBQ2EsR0FBRyxDQUFDekMsZUFBZSxHQUFHLElBQUksQ0FBQztVQUNwQztVQUNBO1FBQ0Y7UUFDQSxPQUFPMkMsT0FBTyxDQUFDckIsR0FBRzs7UUFFbEI7UUFDQSxJQUFJcUIsT0FBTyxDQUFDRyxPQUFPLElBQUlsQixNQUFNLEVBQUU7VUFDN0JBLE1BQU0sQ0FBQ2tCLE9BQU8sR0FBR0gsT0FBTyxDQUFDRyxPQUFPO1FBQ2xDO1FBQ0EsT0FBT0gsT0FBTyxDQUFDRyxPQUFPO1FBRXRCSCxPQUFPLEdBQUdJLE1BQU0sQ0FBQ0MsTUFBTSxDQUNyQkQsTUFBTSxDQUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRW5CO1FBQ0E7VUFDRUMsTUFBTSxFQUFFLElBQUk7VUFDWkMsUUFBUSxFQUFFLElBQUk7VUFDZEMsU0FBUyxFQUFFLElBQUk7VUFDZkMsZUFBZSxFQUFFO1FBQ25CLENBQUM7UUFFRDtRQUNBVixPQUFPO1FBRVA7UUFDQTtVQUNFVyxLQUFLLEVBQUVWLGVBQWU7VUFDdEJXLFNBQVMsRUFBRSxLQUFLO1VBQ2hCQyxNQUFNLEVBQUU1QjtRQUNWLENBQUMsQ0FDRjs7UUFFRDtRQUNBO1FBQ0E7UUFDQSxJQUFJZSxPQUFPLENBQUNjLGVBQWUsRUFBRTtVQUMzQmQsT0FBTyxDQUFDTyxNQUFNLEdBQUcsRUFBRTtRQUNyQjs7UUFFQTtRQUNBLElBQUksQ0FBQ1EsU0FBUyxDQUFDZixPQUFPLENBQUM7UUFFdkIsSUFBSUEsT0FBTyxDQUFDYyxlQUFlLEVBQUU7VUFDM0IsSUFBSSxDQUFDRSxtQkFBbUIsQ0FBQ0MsSUFBSSxDQUMzQmIsTUFBTSxDQUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQ25CTixPQUFPLENBQUNjLGVBQWUsQ0FBQ0ksT0FBTyxFQUMvQkMsTUFBTSxFQUNObkIsT0FBTyxDQUFDYyxlQUFlLENBQUNNLFFBQVEsSUFBSSxnQkFBZ0IsRUFDcEQsVUFBVTlCLEtBQUssRUFBRStCLE1BQU0sRUFBRTtZQUN2QixJQUFJcEMsTUFBTSxFQUFFO2NBQ1YsU0FBU3FDLGtCQUFrQixDQUFDQyxPQUFPLEVBQUU7Z0JBQ25DO2dCQUNBO2dCQUNBdEMsTUFBTSxDQUFDYSxHQUFHLENBQUM5QixJQUFJLENBQUNDLFNBQVMsQ0FBQ3NELE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQztjQUM1QztjQUVBLElBQUlqQyxLQUFLLEVBQUU7Z0JBQ1RnQyxrQkFBa0IsQ0FBQztrQkFDakJoQyxLQUFLLEVBQUVBLEtBQUssQ0FBQ1IsUUFBUSxFQUFFO2tCQUN2QjBDLElBQUksRUFBRTtnQkFDUixDQUFDLENBQUM7Y0FDSixDQUFDLE1BQU07Z0JBQ0xGLGtCQUFrQixDQUFDO2tCQUNqQkQ7Z0JBQ0YsQ0FBQyxDQUFDO2NBQ0o7WUFDRjtVQUNGLENBQUMsQ0FDRjtVQUNEO1FBQ0Y7UUFDQSxPQUFPckIsT0FBTyxDQUFDYyxlQUFlO1FBRTlCLElBQUksQ0FBQ1cscUJBQXFCLENBQUN6QixPQUFPLENBQUM7TUFDckMsQ0FBQyxDQUFDO0lBQ0o7SUFFQWUsU0FBUyxDQUFDZixPQUFPLEVBQUU7TUFDakI7TUFDQTtNQUNBQSxPQUFPLENBQUNhLE1BQU0sQ0FBQzFCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsWUFBVztRQUNwQ2EsT0FBTyxDQUFDYSxNQUFNLEdBQUcsSUFBSTtNQUN2QixDQUFDLENBQUM7TUFFRixNQUFNYSxJQUFJLEdBQUcsSUFBSSxDQUFDQSxJQUFJLEdBQUd6RSxTQUFTLENBQUMrQyxPQUFPLENBQUM7TUFDM0MsTUFBTTtRQUFFbEU7TUFBUyxDQUFDLEdBQUcsSUFBSTs7TUFFekI7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E0RixJQUFJLENBQUNDLE9BQU8sR0FBR1IsTUFBTTtNQUNyQk8sSUFBSSxDQUFDZCxTQUFTLEdBQUcsSUFBSTtNQUVyQmdCLG1CQUFtQixDQUFDRixJQUFJLENBQUNDLE9BQU8sQ0FBQzs7TUFFakM7TUFDQTtNQUNBO01BQ0E7TUFDQSxNQUFNRSxXQUFXLEdBQUdILElBQUksQ0FBQ0ksSUFBSTtNQUU3QixTQUFTQyxrQkFBa0IsQ0FBQ1AsSUFBSSxFQUFFRyxPQUFPLEVBQUVLLElBQUksRUFBRTFFLFFBQVEsRUFBRTtRQUN6RCxJQUFJMkUsT0FBTyxDQUFDQyxVQUFVLEVBQUU7VUFDdEIsSUFBSTtZQUNGVixJQUFJLEdBQUdTLE9BQU8sQ0FBQ0MsVUFBVSxDQUFDQyxVQUFVLENBQUNDLGVBQWUsQ0FBQ1osSUFBSSxFQUFFO2NBQ3pEYSxjQUFjLEVBQUVDLGlCQUFpQixDQUFDeEcsUUFBUTtZQUM1QyxDQUFDLENBQUM7VUFDSixDQUFDLENBQUMsT0FBT3NELEdBQUcsRUFBRTtZQUNaO1lBQ0E7WUFDQTtZQUNBO1VBQUE7UUFFSjtRQUVBZCxrQkFBa0IsQ0FDZmlFLElBQUksQ0FBQyxNQUFNVixXQUFXLENBQUNMLElBQUksRUFBRUcsT0FBTyxFQUFFSyxJQUFJLEVBQUUxRSxRQUFRLENBQUMsQ0FBQyxDQUN0RGtGLEtBQUssQ0FBQ2xGLFFBQVEsQ0FBQztNQUNwQjs7TUFFQTtNQUNBO01BQ0FvRSxJQUFJLENBQUNJLElBQUksR0FBRyxJQUFJLENBQUNkLG1CQUFtQixHQUFHZSxrQkFBa0I7SUFDM0Q7SUFFQU4scUJBQXFCLENBQUN6QixPQUFPLEVBQUU7TUFDN0I7TUFDQSxJQUFJLENBQUN5QyxpQkFBaUIsRUFBRTtNQUV4QixNQUFNZixJQUFJLEdBQUcsSUFBSSxDQUFDQSxJQUFJOztNQUV0QjtNQUNBO01BQ0E7TUFDQXRCLE1BQU0sQ0FBQ3NDLGNBQWMsQ0FBQ2hCLElBQUksQ0FBQ0MsT0FBTyxFQUFFLElBQUksRUFBRTtRQUN4Q2dCLEdBQUcsRUFBRSxNQUFNakIsSUFBSSxDQUFDa0IsSUFBSTtRQUNwQkMsR0FBRyxFQUFHQyxHQUFHLElBQUs7VUFDWnBCLElBQUksQ0FBQ2tCLElBQUksR0FBR0UsR0FBRztRQUNqQixDQUFDO1FBRUQ7UUFDQTtRQUNBQyxZQUFZLEVBQUU7TUFDaEIsQ0FBQyxDQUFDOztNQUVGO01BQ0EsU0FBU0MsT0FBTyxDQUFDQyxHQUFHLEVBQUVDLFFBQVEsRUFBRTtRQUM5QixNQUFNQyxJQUFJLEdBQUd6QixJQUFJLENBQUMwQixRQUFRLENBQUNILEdBQUcsQ0FBQyxJQUFJdkIsSUFBSSxDQUFDMEIsUUFBUSxDQUFDLEdBQUcsR0FBR0gsR0FBRyxDQUFDO1FBQzNELElBQUlFLElBQUksRUFBRTtVQUNSQSxJQUFJLENBQUNFLElBQUksR0FBR0gsUUFBUTtRQUN0QjtNQUNGO01BQ0FGLE9BQU8sQ0FBQyxPQUFPLEVBQUUsd0RBQXdELENBQUM7TUFDMUVBLE9BQU8sQ0FBQyxNQUFNLEVBQUUsd0NBQXdDLENBQUM7TUFDekRBLE9BQU8sQ0FBQyxNQUFNLEVBQUUsNEJBQTRCLENBQUM7O01BRTdDO01BQ0E7TUFDQXRCLElBQUksQ0FBQ3ZDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsWUFBVztRQUN6QixJQUFJYSxPQUFPLENBQUNhLE1BQU0sRUFBRTtVQUNsQmIsT0FBTyxDQUFDYSxNQUFNLENBQUN5QyxLQUFLLENBQUNqRyxlQUFlLEdBQUcsSUFBSSxDQUFDO1VBQzVDMkMsT0FBTyxDQUFDYSxNQUFNLENBQUNmLEdBQUcsRUFBRTtRQUN0QjtNQUNGLENBQUMsQ0FBQzs7TUFFRjtNQUNBO01BQ0EvRCxPQUFPLENBQUNvRCxFQUFFLENBQUMsTUFBTSxFQUFFLFlBQVc7UUFDNUIsSUFBSWEsT0FBTyxDQUFDYSxNQUFNLEVBQUU7VUFDbEJiLE9BQU8sQ0FBQ2EsTUFBTSxDQUFDZixHQUFHLEVBQUU7UUFDdEI7TUFDRixDQUFDLENBQUM7O01BRUY7TUFDQTtNQUNBNEIsSUFBSSxDQUFDNkIsYUFBYSxDQUFDLFFBQVEsRUFBRTtRQUMzQkYsSUFBSSxFQUFFLGtDQUFrQztRQUN4Q0csTUFBTSxFQUFFLFlBQVc7VUFDakIsSUFBSXpILE9BQU8sQ0FBQzBILFdBQVcsRUFBRTtZQUN2QjFILE9BQU8sQ0FBQzBILFdBQVcsQ0FBQyxjQUFjLEVBQUU7Y0FBRXZDLE9BQU8sRUFBRTtZQUFTLENBQUMsQ0FBQztVQUM1RCxDQUFDLE1BQU07WUFDTG5GLE9BQU8sQ0FBQzJILElBQUksQ0FBQyxDQUFDLENBQUM7VUFDakI7UUFDRjtNQUNGLENBQUMsQ0FBQztJQUNKOztJQUVBO0lBQ0E7SUFDQWpCLGlCQUFpQixHQUFHO01BQ2xCLE1BQU1mLElBQUksR0FBRyxJQUFJLENBQUNBLElBQUk7TUFDdEIsTUFBTWlDLFdBQVcsR0FBR0MsY0FBYyxDQUFDLElBQUksQ0FBQzlILFFBQVEsQ0FBQztNQUNqRCxJQUFJK0gsU0FBUyxHQUFHbEgsUUFBUSxDQUFDZ0gsV0FBVyxFQUFFLElBQUksQ0FBQztNQUMzQyxNQUFNRyxZQUFZLEdBQUdsSCxZQUFZLENBQUMrRyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUNJLEtBQUssQ0FBQyxJQUFJLENBQUM7TUFDbEUsTUFBTUMsU0FBUyxHQUFHNUQsTUFBTSxDQUFDRSxNQUFNLENBQUMsSUFBSSxDQUFDO01BRXJDLElBQUksQ0FBRW9CLElBQUksQ0FBQ3VDLE9BQU8sRUFBRTtRQUNsQnZDLElBQUksQ0FBQ3VDLE9BQU8sR0FBRyxFQUFFO1FBQ2pCdkMsSUFBSSxDQUFDd0MsWUFBWSxHQUFHLENBQUMsQ0FBQztNQUN4QjtNQUVBLE9BQU94QyxJQUFJLENBQUN1QyxPQUFPLElBQUlILFlBQVksQ0FBQ0ssTUFBTSxHQUFHLENBQUMsRUFBRTtRQUM5QyxNQUFNQyxJQUFJLEdBQUdOLFlBQVksQ0FBQ08sR0FBRyxFQUFFO1FBQy9CLElBQUlELElBQUksSUFBSSxJQUFJLENBQUNFLElBQUksQ0FBQ0YsSUFBSSxDQUFDLElBQUksQ0FBRUosU0FBUyxDQUFDSSxJQUFJLENBQUMsRUFBRTtVQUNoRDFDLElBQUksQ0FBQ3VDLE9BQU8sQ0FBQ3BHLElBQUksQ0FBQ3VHLElBQUksQ0FBQztVQUN2QkosU0FBUyxDQUFDSSxJQUFJLENBQUMsR0FBRyxJQUFJO1FBQ3hCO01BQ0Y7TUFFQTFDLElBQUksQ0FBQzZDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsVUFBU0gsSUFBSSxFQUFFO1FBQ3RDLElBQUlQLFNBQVMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDUyxJQUFJLENBQUNGLElBQUksQ0FBQyxFQUFFO1VBQ3JDckgsU0FBUyxDQUFDOEcsU0FBUyxFQUFFTyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ25DO01BQ0YsQ0FBQyxDQUFDO01BRUYsSUFBSSxDQUFDMUMsSUFBSSxDQUFDdkMsRUFBRSxDQUFDLE1BQU0sRUFBRSxZQUFXO1FBQzlCekMsU0FBUyxDQUFDbUgsU0FBUyxDQUFDO1FBQ3BCQSxTQUFTLEdBQUcsQ0FBQyxDQUFDO01BQ2hCLENBQUMsQ0FBQztJQUNKO0VBQ0Y7RUFFQSxTQUFTOUQsa0JBQWtCLENBQUN5RSxXQUFXLEVBQUVsSCxRQUFRLEVBQUU7SUFDakQsTUFBTW1ILFlBQVksR0FBRyxJQUFJaEksV0FBVyxFQUFFO0lBQ3RDLElBQUlpSSxTQUFTLEdBQUcsRUFBRTtJQUVsQixTQUFTQyxNQUFNLENBQUNDLE1BQU0sRUFBRTtNQUN0QixNQUFNQyxLQUFLLEdBQUdELE1BQU0sQ0FBQzlGLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQ2lGLEtBQUssQ0FBQyxJQUFJLENBQUM7TUFFakQsT0FBT2MsS0FBSyxDQUFDVixNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZCTyxTQUFTLElBQUlHLEtBQUssQ0FBQ0MsS0FBSyxFQUFFO1FBRTFCLElBQUlDLElBQUk7UUFDUixJQUFJO1VBQ0ZBLElBQUksR0FBRy9HLElBQUksQ0FBQ2dILEtBQUssQ0FBQ04sU0FBUyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxPQUFPcEYsS0FBSyxFQUFFO1VBQ2QsSUFBSUEsS0FBSyxZQUFZMkYsV0FBVyxFQUFFO1lBQ2hDO1VBQ0Y7VUFFQSxPQUFPQyxNQUFNLENBQUM1RixLQUFLLENBQUM7UUFDdEI7UUFFQSxJQUFJdUYsS0FBSyxDQUFDVixNQUFNLEdBQUcsQ0FBQyxFQUFFO1VBQ3BCTSxZQUFZLENBQUNuQixLQUFLLENBQUN1QixLQUFLLENBQUNySSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEM7UUFFQWdJLFdBQVcsQ0FBQ1csSUFBSSxDQUFDVixZQUFZLENBQUM7UUFFOUIsT0FBT1MsTUFBTSxDQUFDLElBQUksRUFBRUgsSUFBSSxDQUFDO01BQzNCO0lBQ0Y7SUFFQSxTQUFTSyxPQUFPLEdBQUc7TUFDakJGLE1BQU0sQ0FBQyxJQUFJRyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztJQUNqRDtJQUVBLElBQUlDLFFBQVEsR0FBRyxLQUFLO0lBQ3BCLFNBQVNKLE1BQU0sQ0FBQzVGLEtBQUssRUFBRXlGLElBQUksRUFBRTtNQUMzQixJQUFJLENBQUVPLFFBQVEsRUFBRTtRQUNkQSxRQUFRLEdBQUcsSUFBSTtRQUNmZCxXQUFXLENBQUNlLGNBQWMsQ0FBQyxNQUFNLEVBQUVaLE1BQU0sQ0FBQztRQUMxQ0gsV0FBVyxDQUFDZSxjQUFjLENBQUMsT0FBTyxFQUFFTCxNQUFNLENBQUM7UUFDM0NWLFdBQVcsQ0FBQ2UsY0FBYyxDQUFDLE9BQU8sRUFBRUgsT0FBTyxDQUFDO1FBQzVDOUgsUUFBUSxDQUFDZ0MsS0FBSyxFQUFFeUYsSUFBSSxFQUFFTixZQUFZLENBQUM7TUFDckM7SUFDRjtJQUVBRCxXQUFXLENBQUNyRixFQUFFLENBQUMsTUFBTSxFQUFFd0YsTUFBTSxDQUFDO0lBQzlCSCxXQUFXLENBQUNyRixFQUFFLENBQUMsT0FBTyxFQUFFK0YsTUFBTSxDQUFDO0lBQy9CVixXQUFXLENBQUNyRixFQUFFLENBQUMsT0FBTyxFQUFFaUcsT0FBTyxDQUFDO0VBQ2xDO0VBRUEsU0FBU3JILFdBQVcsQ0FBQ2pDLFFBQVEsRUFBRTtJQUM3QixPQUFPUyxRQUFRLENBQUNULFFBQVEsRUFBRSxXQUFXLENBQUM7RUFDeEM7RUFFQSxTQUFTOEgsY0FBYyxDQUFDOUgsUUFBUSxFQUFFO0lBQ2hDLE9BQU9TLFFBQVEsQ0FBQ1QsUUFBUSxFQUFFLFNBQVMsQ0FBQztFQUN0QztFQUVBLFNBQVN3RyxpQkFBaUIsQ0FBQ3hHLFFBQVEsRUFBRTtJQUNuQyxPQUFPUyxRQUFRLENBQUNULFFBQVEsRUFBRSxPQUFPLENBQUM7RUFDcEM7RUFFQSxTQUFTOEYsbUJBQW1CLENBQUNELE9BQU8sRUFBRTtJQUNwQyxJQUFJTSxPQUFPLENBQUN1RCxPQUFPLEVBQUU7TUFDbkI7TUFDQTtNQUNBLE1BQU1DLGFBQWEsR0FBRyxDQUFDLENBQUM7TUFDeEIsTUFBTUMsZUFBZSxHQUFHLGVBQWUsR0FDckM5RyxJQUFJLENBQUNDLE1BQU0sRUFBRSxDQUFDQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLO01BRTdDMEcsYUFBYSxDQUFDQyxlQUFlLENBQUMsR0FBRyxVQUFVQyxPQUFPLEVBQUVDLE9BQU8sRUFBRWxLLE1BQU0sRUFBRTtRQUNuRWlHLE9BQU8sQ0FBQ2pHLE1BQU0sR0FBR0EsTUFBTTtRQUN2QmlHLE9BQU8sQ0FBQ2dFLE9BQU8sR0FBR0EsT0FBTzs7UUFFekI7UUFDQTtRQUNBQSxPQUFPLENBQUNFLFVBQVUsR0FBRztVQUNuQixLQUFLLEVBQUUsSUFBSTtVQUNYLE9BQU8sRUFBRSxJQUFJO1VBQ2IsT0FBTyxFQUFFO1FBQ1gsQ0FBQztNQUNILENBQUM7O01BRUQ7TUFDQTtNQUNBNUQsT0FBTyxDQUFDdUQsT0FBTyxDQUFDTSxhQUFhLENBQUNMLGFBQWEsQ0FBQyxDQUFDLElBQUksR0FBR0MsZUFBZSxDQUFDO0lBQ3RFO0VBQ0Y7QUFBQyxxQiIsImZpbGUiOiIvcGFja2FnZXMvc2hlbGwtc2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0ICogZnJvbSBcIi4vc2hlbGwtc2VydmVyLmpzXCI7XG5pbXBvcnQgeyBsaXN0ZW4gfSBmcm9tIFwiLi9zaGVsbC1zZXJ2ZXIuanNcIjtcblxuY29uc3Qgc2hlbGxEaXIgPSBwcm9jZXNzLmVudi5NRVRFT1JfU0hFTExfRElSO1xuaWYgKHNoZWxsRGlyKSB7XG4gIGxpc3RlbihzaGVsbERpcik7XG59XG4iLCJpbXBvcnQgYXNzZXJ0IGZyb20gXCJhc3NlcnRcIjtcbmltcG9ydCB7IGpvaW4gYXMgcGF0aEpvaW4gfSBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgUGFzc1Rocm91Z2ggfSBmcm9tIFwic3RyZWFtXCI7XG5pbXBvcnQge1xuICBjbG9zZVN5bmMsXG4gIG9wZW5TeW5jLFxuICByZWFkRmlsZVN5bmMsXG4gIHVubGluayxcbiAgd3JpdGVGaWxlU3luYyxcbiAgd3JpdGVTeW5jLFxufSBmcm9tIFwiZnNcIjtcbmltcG9ydCB7IGNyZWF0ZVNlcnZlciB9IGZyb20gXCJuZXRcIjtcbmltcG9ydCB7IHN0YXJ0IGFzIHJlcGxTdGFydCB9IGZyb20gXCJyZXBsXCI7XG5cbi8vIEVuYWJsZSBwcm9jZXNzLnNlbmRNZXNzYWdlIGZvciBjb21tdW5pY2F0aW9uIHdpdGggYnVpbGQgcHJvY2Vzcy5cbmltcG9ydCBcIm1ldGVvci9pbnRlci1wcm9jZXNzLW1lc3NhZ2luZ1wiO1xuXG5jb25zdCBJTkZPX0ZJTEVfTU9ERSA9IHBhcnNlSW50KFwiNjAwXCIsIDgpOyAvLyBPbmx5IHRoZSBvd25lciBjYW4gcmVhZCBvciB3cml0ZS5cbmNvbnN0IEVYSVRJTkdfTUVTU0FHRSA9IFwiU2hlbGwgZXhpdGluZy4uLlwiO1xuXG4vLyBJbnZva2VkIGJ5IHRoZSBzZXJ2ZXIgcHJvY2VzcyB0byBsaXN0ZW4gZm9yIGluY29taW5nIGNvbm5lY3Rpb25zIGZyb21cbi8vIHNoZWxsIGNsaWVudHMuIEVhY2ggY29ubmVjdGlvbiBnZXRzIGl0cyBvd24gUkVQTCBpbnN0YW5jZS5cbmV4cG9ydCBmdW5jdGlvbiBsaXN0ZW4oc2hlbGxEaXIpIHtcbiAgZnVuY3Rpb24gY2FsbGJhY2soKSB7XG4gICAgbmV3IFNlcnZlcihzaGVsbERpcikubGlzdGVuKCk7XG4gIH1cblxuICAvLyBJZiB0aGUgc2VydmVyIGlzIHN0aWxsIGluIHRoZSB2ZXJ5IGVhcmx5IHN0YWdlcyBvZiBzdGFydGluZyB1cCxcbiAgLy8gTWV0ZW9yLnN0YXJ0dXAgbWF5IG5vdCBhdmFpbGFibGUgeWV0LlxuICBpZiAodHlwZW9mIE1ldGVvciA9PT0gXCJvYmplY3RcIikge1xuICAgIE1ldGVvci5zdGFydHVwKGNhbGxiYWNrKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgX19tZXRlb3JfYm9vdHN0cmFwX18gPT09IFwib2JqZWN0XCIpIHtcbiAgICBjb25zdCBob29rcyA9IF9fbWV0ZW9yX2Jvb3RzdHJhcF9fLnN0YXJ0dXBIb29rcztcbiAgICBpZiAoaG9va3MpIHtcbiAgICAgIGhvb2tzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBcyBhIGZhbGxiYWNrLCBqdXN0IGNhbGwgdGhlIGNhbGxiYWNrIGFzeW5jaHJvbm91c2x5LlxuICAgICAgc2V0SW1tZWRpYXRlKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gRGlzYWJsaW5nIHRoZSBzaGVsbCBjYXVzZXMgYWxsIGF0dGFjaGVkIGNsaWVudHMgdG8gZGlzY29ubmVjdCBhbmQgZXhpdC5cbmV4cG9ydCBmdW5jdGlvbiBkaXNhYmxlKHNoZWxsRGlyKSB7XG4gIHRyeSB7XG4gICAgLy8gUmVwbGFjZSBpbmZvLmpzb24gd2l0aCBhIGZpbGUgdGhhdCBzYXlzIHRoZSBzaGVsbCBzZXJ2ZXIgaXNcbiAgICAvLyBkaXNhYmxlZCwgc28gdGhhdCBhbnkgY29ubmVjdGVkIHNoZWxsIGNsaWVudHMgd2lsbCBmYWlsIHRvXG4gICAgLy8gcmVjb25uZWN0IGFmdGVyIHRoZSBzZXJ2ZXIgcHJvY2VzcyBjbG9zZXMgdGhlaXIgc29ja2V0cy5cbiAgICB3cml0ZUZpbGVTeW5jKFxuICAgICAgZ2V0SW5mb0ZpbGUoc2hlbGxEaXIpLFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdGF0dXM6IFwiZGlzYWJsZWRcIixcbiAgICAgICAgcmVhc29uOiBcIlNoZWxsIHNlcnZlciBoYXMgc2h1dCBkb3duLlwiXG4gICAgICB9KSArIFwiXFxuXCIsXG4gICAgICB7IG1vZGU6IElORk9fRklMRV9NT0RFIH1cbiAgICApO1xuICB9IGNhdGNoIChpZ25vcmVkKSB7fVxufVxuXG4vLyBTaGVsbCBjb21tYW5kcyBuZWVkIHRvIGJlIGV4ZWN1dGVkIGluIGEgRmliZXIgaW4gY2FzZSB0aGV5IGNhbGwgaW50b1xuLy8gY29kZSB0aGF0IHlpZWxkcy4gVXNpbmcgYSBQcm9taXNlIGlzIGFuIGV2ZW4gYmV0dGVyIGlkZWEsIHNpbmNlIGl0IHJ1bnNcbi8vIGl0cyBjYWxsYmFja3MgaW4gRmliZXJzIGRyYXduIGZyb20gYSBwb29sLCBzbyB0aGUgRmliZXJzIGFyZSByZWN5Y2xlZC5cbmNvbnN0IGV2YWxDb21tYW5kUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuXG5jbGFzcyBTZXJ2ZXIge1xuICBjb25zdHJ1Y3RvcihzaGVsbERpcikge1xuICAgIGFzc2VydC5vayh0aGlzIGluc3RhbmNlb2YgU2VydmVyKTtcblxuICAgIHRoaXMuc2hlbGxEaXIgPSBzaGVsbERpcjtcbiAgICB0aGlzLmtleSA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xuXG4gICAgdGhpcy5zZXJ2ZXIgPVxuICAgICAgY3JlYXRlU2VydmVyKChzb2NrZXQpID0+IHtcbiAgICAgICAgdGhpcy5vbkNvbm5lY3Rpb24oc29ja2V0KTtcbiAgICAgIH0pXG4gICAgICAub24oXCJlcnJvclwiLCAoZXJyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLnN0YWNrKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgbGlzdGVuKCkge1xuICAgIGNvbnN0IGluZm9GaWxlID0gZ2V0SW5mb0ZpbGUodGhpcy5zaGVsbERpcik7XG5cbiAgICB1bmxpbmsoaW5mb0ZpbGUsICgpID0+IHtcbiAgICAgIHRoaXMuc2VydmVyLmxpc3RlbigwLCBcIjEyNy4wLjAuMVwiLCAoKSA9PiB7XG4gICAgICAgIHdyaXRlRmlsZVN5bmMoaW5mb0ZpbGUsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzdGF0dXM6IFwiZW5hYmxlZFwiLFxuICAgICAgICAgIHBvcnQ6IHRoaXMuc2VydmVyLmFkZHJlc3MoKS5wb3J0LFxuICAgICAgICAgIGtleTogdGhpcy5rZXlcbiAgICAgICAgfSkgKyBcIlxcblwiLCB7XG4gICAgICAgICAgbW9kZTogSU5GT19GSUxFX01PREVcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIG9uQ29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICAvLyBNYWtlIHN1cmUgdGhpcyBmdW5jdGlvbiBkb2Vzbid0IHRyeSB0byB3cml0ZSBhbnl0aGluZyB0byB0aGUgc29ja2V0XG4gICAgLy8gYWZ0ZXIgaXQgaGFzIGJlZW4gY2xvc2VkLlxuICAgIHNvY2tldC5vbihcImNsb3NlXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgc29ja2V0ID0gbnVsbDtcbiAgICB9KTtcblxuICAgIC8vIElmIGNvbW11bmljYXRpb24gaXMgbm90IGVzdGFibGlzaGVkIHdpdGhpbiAxMDAwbXMgb2YgdGhlIGZpcnN0XG4gICAgLy8gY29ubmVjdGlvbiwgZm9yY2libHkgY2xvc2UgdGhlIHNvY2tldC5cbiAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIGlmIChzb2NrZXQpIHtcbiAgICAgICAgc29ja2V0LnJlbW92ZUFsbExpc3RlbmVycyhcImRhdGFcIik7XG4gICAgICAgIHNvY2tldC5lbmQoRVhJVElOR19NRVNTQUdFICsgXCJcXG5cIik7XG4gICAgICB9XG4gICAgfSwgMTAwMCk7XG5cbiAgICAvLyBMZXQgY29ubmVjdGluZyBjbGllbnRzIGNvbmZpZ3VyZSBjZXJ0YWluIFJFUEwgb3B0aW9ucyBieSBzZW5kaW5nIGFcbiAgICAvLyBKU09OIG9iamVjdCBvdmVyIHRoZSBzb2NrZXQuIEZvciBleGFtcGxlLCBvbmx5IHRoZSBjbGllbnQga25vd3NcbiAgICAvLyB3aGV0aGVyIGl0J3MgcnVubmluZyBhIFRUWSBvciBhbiBFbWFjcyBzdWJzaGVsbCBvciBzb21lIG90aGVyIGtpbmQgb2ZcbiAgICAvLyB0ZXJtaW5hbCwgc28gdGhlIGNsaWVudCBtdXN0IGRlY2lkZSB0aGUgdmFsdWUgb2Ygb3B0aW9ucy50ZXJtaW5hbC5cbiAgICByZWFkSlNPTkZyb21TdHJlYW0oc29ja2V0LCAoZXJyb3IsIG9wdGlvbnMsIHJlcGxJbnB1dFNvY2tldCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuXG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgc29ja2V0ID0gbnVsbDtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvci5zdGFjayk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMua2V5ICE9PSB0aGlzLmtleSkge1xuICAgICAgICBpZiAoc29ja2V0KSB7XG4gICAgICAgICAgc29ja2V0LmVuZChFWElUSU5HX01FU1NBR0UgKyBcIlxcblwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBkZWxldGUgb3B0aW9ucy5rZXk7XG5cbiAgICAgIC8vIFNldCB0aGUgY29sdW1ucyB0byB3aGF0IGlzIGJlaW5nIHJlcXVlc3RlZCBieSB0aGUgY2xpZW50LlxuICAgICAgaWYgKG9wdGlvbnMuY29sdW1ucyAmJiBzb2NrZXQpIHtcbiAgICAgICAgc29ja2V0LmNvbHVtbnMgPSBvcHRpb25zLmNvbHVtbnM7XG4gICAgICB9XG4gICAgICBkZWxldGUgb3B0aW9ucy5jb2x1bW5zO1xuXG4gICAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihcbiAgICAgICAgT2JqZWN0LmNyZWF0ZShudWxsKSxcblxuICAgICAgICAvLyBEZWZhdWx0cyBmb3IgY29uZmlndXJhYmxlIG9wdGlvbnMuXG4gICAgICAgIHtcbiAgICAgICAgICBwcm9tcHQ6IFwiPiBcIixcbiAgICAgICAgICB0ZXJtaW5hbDogdHJ1ZSxcbiAgICAgICAgICB1c2VDb2xvcnM6IHRydWUsXG4gICAgICAgICAgaWdub3JlVW5kZWZpbmVkOiB0cnVlLFxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIENvbmZpZ3VyYWJsZSBvcHRpb25zXG4gICAgICAgIG9wdGlvbnMsXG5cbiAgICAgICAgLy8gSW1tdXRhYmxlIG9wdGlvbnMuXG4gICAgICAgIHtcbiAgICAgICAgICBpbnB1dDogcmVwbElucHV0U29ja2V0LFxuICAgICAgICAgIHVzZUdsb2JhbDogZmFsc2UsXG4gICAgICAgICAgb3V0cHV0OiBzb2NrZXRcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgLy8gVGhlIHByb21wdCBkdXJpbmcgYW4gZXZhbHVhdGVBbmRFeGl0IG11c3QgYmUgYmxhbmsgdG8gZW5zdXJlXG4gICAgICAvLyB0aGF0IHRoZSBwcm9tcHQgZG9lc24ndCBpbmFkdmVydGVudGx5IGdldCBwYXJzZWQgYXMgcGFydCBvZlxuICAgICAgLy8gdGhlIEpTT04gY29tbXVuaWNhdGlvbiBjaGFubmVsLlxuICAgICAgaWYgKG9wdGlvbnMuZXZhbHVhdGVBbmRFeGl0KSB7XG4gICAgICAgIG9wdGlvbnMucHJvbXB0ID0gXCJcIjtcbiAgICAgIH1cblxuICAgICAgLy8gU3RhcnQgdGhlIFJFUEwuXG4gICAgICB0aGlzLnN0YXJ0UkVQTChvcHRpb25zKTtcblxuICAgICAgaWYgKG9wdGlvbnMuZXZhbHVhdGVBbmRFeGl0KSB7XG4gICAgICAgIHRoaXMuX3dyYXBwZWREZWZhdWx0RXZhbC5jYWxsKFxuICAgICAgICAgIE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAgICAgb3B0aW9ucy5ldmFsdWF0ZUFuZEV4aXQuY29tbWFuZCxcbiAgICAgICAgICBnbG9iYWwsXG4gICAgICAgICAgb3B0aW9ucy5ldmFsdWF0ZUFuZEV4aXQuZmlsZW5hbWUgfHwgXCI8bWV0ZW9yIHNoZWxsPlwiLFxuICAgICAgICAgIGZ1bmN0aW9uIChlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAoc29ja2V0KSB7XG4gICAgICAgICAgICAgIGZ1bmN0aW9uIHNlbmRSZXN1bHRUb1NvY2tldChtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgLy8gU2VuZGluZyBiYWNrIGEgSlNPTiBwYXlsb2FkIGFsbG93cyB0aGUgY2xpZW50IHRvXG4gICAgICAgICAgICAgICAgLy8gZGlzdGluZ3Vpc2ggYmV0d2VlbiBlcnJvcnMgYW5kIHN1Y2Nlc3NmdWwgcmVzdWx0cy5cbiAgICAgICAgICAgICAgICBzb2NrZXQuZW5kKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpICsgXCJcXG5cIik7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzdWx0VG9Tb2NrZXQoe1xuICAgICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICBjb2RlOiAxXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VuZFJlc3VsdFRvU29ja2V0KHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZGVsZXRlIG9wdGlvbnMuZXZhbHVhdGVBbmRFeGl0O1xuXG4gICAgICB0aGlzLmVuYWJsZUludGVyYWN0aXZlTW9kZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuXG4gIHN0YXJ0UkVQTChvcHRpb25zKSB7XG4gICAgLy8gTWFrZSBzdXJlIHRoaXMgZnVuY3Rpb24gZG9lc24ndCB0cnkgdG8gd3JpdGUgYW55dGhpbmcgdG8gdGhlIG91dHB1dFxuICAgIC8vIHN0cmVhbSBhZnRlciBpdCBoYXMgYmVlbiBjbG9zZWQuXG4gICAgb3B0aW9ucy5vdXRwdXQub24oXCJjbG9zZVwiLCBmdW5jdGlvbigpIHtcbiAgICAgIG9wdGlvbnMub3V0cHV0ID0gbnVsbDtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlcGwgPSB0aGlzLnJlcGwgPSByZXBsU3RhcnQob3B0aW9ucyk7XG4gICAgY29uc3QgeyBzaGVsbERpciB9ID0gdGhpcztcblxuICAgIC8vIFRoaXMgaXMgdGVjaG5pcXVlIG9mIHNldHRpbmcgYHJlcGwuY29udGV4dGAgaXMgc2ltaWxhciB0byBob3cgdGhlXG4gICAgLy8gYHVzZUdsb2JhbGAgb3B0aW9uIHdvdWxkIHdvcmsgZHVyaW5nIGEgbm9ybWFsIGByZXBsLnN0YXJ0KClgIGFuZFxuICAgIC8vIGFsbG93cyBzaGVsbCBhY2Nlc3MgKGFuZCB0YWIgY29tcGxldGlvbiEpIHRvIE1ldGVvciBnbG9iYWxzIChpLmUuXG4gICAgLy8gVW5kZXJzY29yZSBfLCBNZXRlb3IsIGV0Yy4pLiBCeSB1c2luZyB0aGlzIHRlY2huaXF1ZSwgd2hpY2ggY2hhbmdlc1xuICAgIC8vIHRoZSBjb250ZXh0IGFmdGVyIHN0YXJ0dXAsIHdlIGF2b2lkIHN0b21waW5nIG9uIHRoZSBzcGVjaWFsIGBfYFxuICAgIC8vIHZhcmlhYmxlIChpbiBgcmVwbGAgdGhpcyBlcXVhbHMgdGhlIHZhbHVlIG9mIHRoZSBsYXN0IGNvbW1hbmQpIGZyb21cbiAgICAvLyBiZWluZyBvdmVycmlkZGVuIGluIHRoZSBjbGllbnQvc2VydmVyIHNvY2tldC1oYW5kc2hha2luZy4gIEZ1cnRoZXJtb3JlLFxuICAgIC8vIGJ5IHNldHRpbmcgYHVzZUdsb2JhbGAgYmFjayB0byB0cnVlLCB3ZSBhbGxvdyB0aGUgZGVmYXVsdCBldmFsIGZ1bmN0aW9uXG4gICAgLy8gdG8gdXNlIHRoZSBkZXNpcmVkIGBydW5JblRoaXNDb250ZXh0YCBtZXRob2QgKGh0dHBzOi8vZ2l0LmlvL3ZidkFCKS5cbiAgICByZXBsLmNvbnRleHQgPSBnbG9iYWw7XG4gICAgcmVwbC51c2VHbG9iYWwgPSB0cnVlO1xuXG4gICAgc2V0UmVxdWlyZUFuZE1vZHVsZShyZXBsLmNvbnRleHQpO1xuXG4gICAgLy8gSW4gb3JkZXIgdG8gYXZvaWQgZHVwbGljYXRpbmcgY29kZSBoZXJlLCBzcGVjaWZpY2FsbHkgdGhlIGNvbXBsZXhpdGllc1xuICAgIC8vIG9mIGNhdGNoaW5nIHNvLWNhbGxlZCBcIlJlY292ZXJhYmxlIEVycm9yc1wiIChodHRwczovL2dpdC5pby92YnZibCksXG4gICAgLy8gd2Ugd2lsbCB3cmFwIHRoZSBkZWZhdWx0IGV2YWwsIHJ1biBpdCBpbiBhIEZpYmVyICh2aWEgYSBQcm9taXNlKSwgYW5kXG4gICAgLy8gZ2l2ZSBpdCB0aGUgb3Bwb3J0dW5pdHkgdG8gZGVjaWRlIGlmIHRoZSB1c2VyIGlzIG1pZC1jb2RlLWJsb2NrLlxuICAgIGNvbnN0IGRlZmF1bHRFdmFsID0gcmVwbC5ldmFsO1xuXG4gICAgZnVuY3Rpb24gd3JhcHBlZERlZmF1bHRFdmFsKGNvZGUsIGNvbnRleHQsIGZpbGUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAoUGFja2FnZS5lY21hc2NyaXB0KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29kZSA9IFBhY2thZ2UuZWNtYXNjcmlwdC5FQ01BU2NyaXB0LmNvbXBpbGVGb3JTaGVsbChjb2RlLCB7XG4gICAgICAgICAgICBjYWNoZURpcmVjdG9yeTogZ2V0Q2FjaGVEaXJlY3Rvcnkoc2hlbGxEaXIpXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIC8vIEFueSBCYWJlbCBlcnJvciBoZXJlIG1pZ2h0IGJlIGp1c3QgZmluZSBzaW5jZSBpdCdzXG4gICAgICAgICAgLy8gcG9zc2libGUgdGhlIGNvZGUgd2FzIGluY29tcGxldGUgKG11bHRpLWxpbmUgY29kZSBvbiB0aGUgUkVQTCkuXG4gICAgICAgICAgLy8gVGhlIGRlZmF1bHRFdmFsIGJlbG93IHdpbGwgdXNlIGl0cyBvd24gZnVuY3Rpb25hbGl0eSB0byBkZXRlcm1pbmVcbiAgICAgICAgICAvLyBpZiB0aGlzIGVycm9yIGlzIFwicmVjb3ZlcmFibGVcIi5cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBldmFsQ29tbWFuZFByb21pc2VcbiAgICAgICAgLnRoZW4oKCkgPT4gZGVmYXVsdEV2YWwoY29kZSwgY29udGV4dCwgZmlsZSwgY2FsbGJhY2spKVxuICAgICAgICAuY2F0Y2goY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8vIEhhdmUgdGhlIFJFUEwgdXNlIHRoZSBuZXdseSB3cmFwcGVkIGZ1bmN0aW9uIGluc3RlYWQgYW5kIHN0b3JlIHRoZVxuICAgIC8vIF93cmFwcGVkRGVmYXVsdEV2YWwgc28gdGhhdCBldmFsdWxhdGVBbmRFeGl0IGNhbGxzIGNhbiB1c2UgaXQgZGlyZWN0bHkuXG4gICAgcmVwbC5ldmFsID0gdGhpcy5fd3JhcHBlZERlZmF1bHRFdmFsID0gd3JhcHBlZERlZmF1bHRFdmFsO1xuICB9XG5cbiAgZW5hYmxlSW50ZXJhY3RpdmVNb2RlKG9wdGlvbnMpIHtcbiAgICAvLyBIaXN0b3J5IHBlcnNpc3RzIGFjcm9zcyBzaGVsbCBzZXNzaW9ucyFcbiAgICB0aGlzLmluaXRpYWxpemVIaXN0b3J5KCk7XG5cbiAgICBjb25zdCByZXBsID0gdGhpcy5yZXBsO1xuXG4gICAgLy8gSW1wbGVtZW50IGFuIGFsdGVybmF0ZSBtZWFucyBvZiBmZXRjaGluZyB0aGUgcmV0dXJuIHZhbHVlLFxuICAgIC8vIHZpYSBgX19gIChkb3VibGUgdW5kZXJzY29yZSkgYXMgb3JpZ2luYWxseSBpbXBsZW1lbnRlZCBpbjpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9jb21taXQvMjQ0M2Q4MzIyNjVjN2QxY1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZXBsLmNvbnRleHQsIFwiX19cIiwge1xuICAgICAgZ2V0OiAoKSA9PiByZXBsLmxhc3QsXG4gICAgICBzZXQ6ICh2YWwpID0+IHtcbiAgICAgICAgcmVwbC5sYXN0ID0gdmFsO1xuICAgICAgfSxcblxuICAgICAgLy8gQWxsb3cgdGhpcyBwcm9wZXJ0eSB0byBiZSAocmUpZGVmaW5lZCBtb3JlIHRoYW4gb25jZSAoZS5nLiBlYWNoXG4gICAgICAvLyB0aW1lIHRoZSBzZXJ2ZXIgcmVzdGFydHMpLlxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBTb21lIGltcHJvdmVtZW50cyB0byB0aGUgZXhpc3RpbmcgaGVscCBtZXNzYWdlcy5cbiAgICBmdW5jdGlvbiBhZGRIZWxwKGNtZCwgaGVscFRleHQpIHtcbiAgICAgIGNvbnN0IGluZm8gPSByZXBsLmNvbW1hbmRzW2NtZF0gfHwgcmVwbC5jb21tYW5kc1tcIi5cIiArIGNtZF07XG4gICAgICBpZiAoaW5mbykge1xuICAgICAgICBpbmZvLmhlbHAgPSBoZWxwVGV4dDtcbiAgICAgIH1cbiAgICB9XG4gICAgYWRkSGVscChcImJyZWFrXCIsIFwiVGVybWluYXRlIGN1cnJlbnQgY29tbWFuZCBpbnB1dCBhbmQgZGlzcGxheSBuZXcgcHJvbXB0XCIpO1xuICAgIGFkZEhlbHAoXCJleGl0XCIsIFwiRGlzY29ubmVjdCBmcm9tIHNlcnZlciBhbmQgbGVhdmUgc2hlbGxcIik7XG4gICAgYWRkSGVscChcImhlbHBcIiwgXCJTaG93IHRoaXMgaGVscCBpbmZvcm1hdGlvblwiKTtcblxuICAgIC8vIFdoZW4gdGhlIFJFUEwgZXhpdHMsIHNpZ25hbCB0aGUgYXR0YWNoZWQgY2xpZW50IHRvIGV4aXQgYnkgc2VuZGluZyBpdFxuICAgIC8vIHRoZSBzcGVjaWFsIEVYSVRJTkdfTUVTU0FHRS5cbiAgICByZXBsLm9uKFwiZXhpdFwiLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChvcHRpb25zLm91dHB1dCkge1xuICAgICAgICBvcHRpb25zLm91dHB1dC53cml0ZShFWElUSU5HX01FU1NBR0UgKyBcIlxcblwiKTtcbiAgICAgICAgb3B0aW9ucy5vdXRwdXQuZW5kKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBXaGVuIHRoZSBzZXJ2ZXIgcHJvY2VzcyBleGl0cywgZW5kIHRoZSBvdXRwdXQgc3RyZWFtIGJ1dCBkbyBub3RcbiAgICAvLyBzaWduYWwgdGhlIGF0dGFjaGVkIGNsaWVudCB0byBleGl0LlxuICAgIHByb2Nlc3Mub24oXCJleGl0XCIsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG9wdGlvbnMub3V0cHV0KSB7XG4gICAgICAgIG9wdGlvbnMub3V0cHV0LmVuZCgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVGhpcyBNZXRlb3Itc3BlY2lmaWMgc2hlbGwgY29tbWFuZCByZWJ1aWxkcyB0aGUgYXBwbGljYXRpb24gYXMgaWYgYVxuICAgIC8vIGNoYW5nZSB3YXMgbWFkZSB0byBzZXJ2ZXIgY29kZS5cbiAgICByZXBsLmRlZmluZUNvbW1hbmQoXCJyZWxvYWRcIiwge1xuICAgICAgaGVscDogXCJSZXN0YXJ0IHRoZSBzZXJ2ZXIgYW5kIHRoZSBzaGVsbFwiLFxuICAgICAgYWN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHByb2Nlc3Muc2VuZE1lc3NhZ2UpIHtcbiAgICAgICAgICBwcm9jZXNzLnNlbmRNZXNzYWdlKFwic2hlbGwtc2VydmVyXCIsIHsgY29tbWFuZDogXCJyZWxvYWRcIiB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIFRoaXMgZnVuY3Rpb24gYWxsb3dzIGEgcGVyc2lzdGVudCBoaXN0b3J5IG9mIHNoZWxsIGNvbW1hbmRzIHRvIGJlIHNhdmVkXG4gIC8vIHRvIGFuZCBsb2FkZWQgZnJvbSAubWV0ZW9yL2xvY2FsL3NoZWxsL2hpc3RvcnkuXG4gIGluaXRpYWxpemVIaXN0b3J5KCkge1xuICAgIGNvbnN0IHJlcGwgPSB0aGlzLnJlcGw7XG4gICAgY29uc3QgaGlzdG9yeUZpbGUgPSBnZXRIaXN0b3J5RmlsZSh0aGlzLnNoZWxsRGlyKTtcbiAgICBsZXQgaGlzdG9yeUZkID0gb3BlblN5bmMoaGlzdG9yeUZpbGUsIFwiYStcIik7XG4gICAgY29uc3QgaGlzdG9yeUxpbmVzID0gcmVhZEZpbGVTeW5jKGhpc3RvcnlGaWxlLCBcInV0ZjhcIikuc3BsaXQoXCJcXG5cIik7XG4gICAgY29uc3Qgc2VlbkxpbmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmICghIHJlcGwuaGlzdG9yeSkge1xuICAgICAgcmVwbC5oaXN0b3J5ID0gW107XG4gICAgICByZXBsLmhpc3RvcnlJbmRleCA9IC0xO1xuICAgIH1cblxuICAgIHdoaWxlIChyZXBsLmhpc3RvcnkgJiYgaGlzdG9yeUxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBoaXN0b3J5TGluZXMucG9wKCk7XG4gICAgICBpZiAobGluZSAmJiAvXFxTLy50ZXN0KGxpbmUpICYmICEgc2VlbkxpbmVzW2xpbmVdKSB7XG4gICAgICAgIHJlcGwuaGlzdG9yeS5wdXNoKGxpbmUpO1xuICAgICAgICBzZWVuTGluZXNbbGluZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlcGwuYWRkTGlzdGVuZXIoXCJsaW5lXCIsIGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIGlmIChoaXN0b3J5RmQgPj0gMCAmJiAvXFxTLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgIHdyaXRlU3luYyhoaXN0b3J5RmQsIGxpbmUgKyBcIlxcblwiKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucmVwbC5vbihcImV4aXRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICBjbG9zZVN5bmMoaGlzdG9yeUZkKTtcbiAgICAgIGhpc3RvcnlGZCA9IC0xO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWRKU09ORnJvbVN0cmVhbShpbnB1dFN0cmVhbSwgY2FsbGJhY2spIHtcbiAgY29uc3Qgb3V0cHV0U3RyZWFtID0gbmV3IFBhc3NUaHJvdWdoKCk7XG4gIGxldCBkYXRhU29GYXIgPSBcIlwiO1xuXG4gIGZ1bmN0aW9uIG9uRGF0YShidWZmZXIpIHtcbiAgICBjb25zdCBsaW5lcyA9IGJ1ZmZlci50b1N0cmluZyhcInV0ZjhcIikuc3BsaXQoXCJcXG5cIik7XG5cbiAgICB3aGlsZSAobGluZXMubGVuZ3RoID4gMCkge1xuICAgICAgZGF0YVNvRmFyICs9IGxpbmVzLnNoaWZ0KCk7XG5cbiAgICAgIGxldCBqc29uO1xuICAgICAgdHJ5IHtcbiAgICAgICAganNvbiA9IEpTT04ucGFyc2UoZGF0YVNvRmFyKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmluaXNoKGVycm9yKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgb3V0cHV0U3RyZWFtLndyaXRlKGxpbmVzLmpvaW4oXCJcXG5cIikpO1xuICAgICAgfVxuXG4gICAgICBpbnB1dFN0cmVhbS5waXBlKG91dHB1dFN0cmVhbSk7XG5cbiAgICAgIHJldHVybiBmaW5pc2gobnVsbCwganNvbik7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25DbG9zZSgpIHtcbiAgICBmaW5pc2gobmV3IEVycm9yKFwic3RyZWFtIHVuZXhwZWN0ZWRseSBjbG9zZWRcIikpO1xuICB9XG5cbiAgbGV0IGZpbmlzaGVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGZpbmlzaChlcnJvciwganNvbikge1xuICAgIGlmICghIGZpbmlzaGVkKSB7XG4gICAgICBmaW5pc2hlZCA9IHRydWU7XG4gICAgICBpbnB1dFN0cmVhbS5yZW1vdmVMaXN0ZW5lcihcImRhdGFcIiwgb25EYXRhKTtcbiAgICAgIGlucHV0U3RyZWFtLnJlbW92ZUxpc3RlbmVyKFwiZXJyb3JcIiwgZmluaXNoKTtcbiAgICAgIGlucHV0U3RyZWFtLnJlbW92ZUxpc3RlbmVyKFwiY2xvc2VcIiwgb25DbG9zZSk7XG4gICAgICBjYWxsYmFjayhlcnJvciwganNvbiwgb3V0cHV0U3RyZWFtKTtcbiAgICB9XG4gIH1cblxuICBpbnB1dFN0cmVhbS5vbihcImRhdGFcIiwgb25EYXRhKTtcbiAgaW5wdXRTdHJlYW0ub24oXCJlcnJvclwiLCBmaW5pc2gpO1xuICBpbnB1dFN0cmVhbS5vbihcImNsb3NlXCIsIG9uQ2xvc2UpO1xufVxuXG5mdW5jdGlvbiBnZXRJbmZvRmlsZShzaGVsbERpcikge1xuICByZXR1cm4gcGF0aEpvaW4oc2hlbGxEaXIsIFwiaW5mby5qc29uXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRIaXN0b3J5RmlsZShzaGVsbERpcikge1xuICByZXR1cm4gcGF0aEpvaW4oc2hlbGxEaXIsIFwiaGlzdG9yeVwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2FjaGVEaXJlY3Rvcnkoc2hlbGxEaXIpIHtcbiAgcmV0dXJuIHBhdGhKb2luKHNoZWxsRGlyLCBcImNhY2hlXCIpO1xufVxuXG5mdW5jdGlvbiBzZXRSZXF1aXJlQW5kTW9kdWxlKGNvbnRleHQpIHtcbiAgaWYgKFBhY2thZ2UubW9kdWxlcykge1xuICAgIC8vIFVzZSB0aGUgc2FtZSBgcmVxdWlyZWAgZnVuY3Rpb24gYW5kIGBtb2R1bGVgIG9iamVjdCB2aXNpYmxlIHRvIHRoZVxuICAgIC8vIGFwcGxpY2F0aW9uLlxuICAgIGNvbnN0IHRvQmVJbnN0YWxsZWQgPSB7fTtcbiAgICBjb25zdCBzaGVsbE1vZHVsZU5hbWUgPSBcIm1ldGVvci1zaGVsbC1cIiArXG4gICAgICBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKSArIFwiLmpzXCI7XG5cbiAgICB0b0JlSW5zdGFsbGVkW3NoZWxsTW9kdWxlTmFtZV0gPSBmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgICBjb250ZXh0Lm1vZHVsZSA9IG1vZHVsZTtcbiAgICAgIGNvbnRleHQucmVxdWlyZSA9IHJlcXVpcmU7XG5cbiAgICAgIC8vIFRhYiBjb21wbGV0aW9uIHNvbWV0aW1lcyB1c2VzIHJlcXVpcmUuZXh0ZW5zaW9ucywgYnV0IG9ubHkgZm9yXG4gICAgICAvLyB0aGUga2V5cy5cbiAgICAgIHJlcXVpcmUuZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCIuanNcIjogdHJ1ZSxcbiAgICAgICAgXCIuanNvblwiOiB0cnVlLFxuICAgICAgICBcIi5ub2RlXCI6IHRydWUsXG4gICAgICB9O1xuICAgIH07XG5cbiAgICAvLyBUaGlzIHBvcHVsYXRlcyByZXBsLmNvbnRleHQue21vZHVsZSxyZXF1aXJlfSBieSBldmFsdWF0aW5nIHRoZVxuICAgIC8vIG1vZHVsZSBkZWZpbmVkIGFib3ZlLlxuICAgIFBhY2thZ2UubW9kdWxlcy5tZXRlb3JJbnN0YWxsKHRvQmVJbnN0YWxsZWQpKFwiLi9cIiArIHNoZWxsTW9kdWxlTmFtZSk7XG4gIH1cbn1cbiJdfQ==
