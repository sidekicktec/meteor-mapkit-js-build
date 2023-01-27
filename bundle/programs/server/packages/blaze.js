(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var check = Package.check.check;
var Match = Package.check.Match;
var ObserveSequence = Package['observe-sequence'].ObserveSequence;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var ECMAScript = Package.ecmascript.ECMAScript;
var HTML = Package.htmljs.HTML;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Blaze, UI, Handlebars;

var require = meteorInstall({"node_modules":{"meteor":{"blaze":{"preamble.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/preamble.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @namespace Blaze
 * @summary The namespace for all Blaze-related methods and classes.
 */
Blaze = {};

// Utility to HTML-escape a string.  Included for legacy reasons.
// TODO: Should be replaced with _.escape once underscore is upgraded to a newer
//       version which escapes ` (backtick) as well. Underscore 1.5.2 does not.
Blaze._escape = function () {
  var escape_map = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    /* IE allows backtick-delimited attributes?? */
    "&": "&amp;"
  };
  var escape_one = function (c) {
    return escape_map[c];
  };
  return function (x) {
    return x.replace(/[&<>"'`]/g, escape_one);
  };
}();
Blaze._warn = function (msg) {
  msg = 'Warning: ' + msg;
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(msg);
  }
};
var nativeBind = Function.prototype.bind;

// An implementation of _.bind which allows better optimization.
// See: https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
if (nativeBind) {
  Blaze._bind = function (func, obj) {
    if (arguments.length === 2) {
      return nativeBind.call(func, obj);
    }

    // Copy the arguments so this function can be optimized.
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return nativeBind.apply(func, args.slice(1));
  };
} else {
  // A slower but backwards compatible version.
  Blaze._bind = function (objA, objB) {
    objA.bind(objB);
  };
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"exceptions.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/exceptions.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var debugFunc;

// We call into user code in many places, and it's nice to catch exceptions
// propagated from user code immediately so that the whole system doesn't just
// break.  Catching exceptions is easy; reporting them is hard.  This helper
// reports exceptions.
//
// Usage:
//
// ```
// try {
//   // ... someStuff ...
// } catch (e) {
//   reportUIException(e);
// }
// ```
//
// An optional second argument overrides the default message.

// Set this to `true` to cause `reportException` to throw
// the next exception rather than reporting it.  This is
// useful in unit tests that test error messages.
Blaze._throwNextException = false;
Blaze._reportException = function (e, msg) {
  if (Blaze._throwNextException) {
    Blaze._throwNextException = false;
    throw e;
  }
  if (!debugFunc)
    // adapted from Tracker
    debugFunc = function () {
      return typeof Meteor !== "undefined" ? Meteor._debug : typeof console !== "undefined" && console.log ? console.log : function () {};
    };

  // In Chrome, `e.stack` is a multiline string that starts with the message
  // and contains a stack trace.  Furthermore, `console.log` makes it clickable.
  // `console.log` supplies the space between the two arguments.
  debugFunc()(msg || 'Exception caught in template:', e.stack || e.message || e);
};
Blaze._wrapCatchingExceptions = function (f, where) {
  if (typeof f !== 'function') return f;
  return function () {
    try {
      return f.apply(this, arguments);
    } catch (e) {
      Blaze._reportException(e, 'Exception in ' + where + ':');
    }
  };
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"view.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/view.js                                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/// [new] Blaze.View([name], renderMethod)
///
/// Blaze.View is the building block of reactive DOM.  Views have
/// the following features:
///
/// * lifecycle callbacks - Views are created, rendered, and destroyed,
///   and callbacks can be registered to fire when these things happen.
///
/// * parent pointer - A View points to its parentView, which is the
///   View that caused it to be rendered.  These pointers form a
///   hierarchy or tree of Views.
///
/// * render() method - A View's render() method specifies the DOM
///   (or HTML) content of the View.  If the method establishes
///   reactive dependencies, it may be re-run.
///
/// * a DOMRange - If a View is rendered to DOM, its position and
///   extent in the DOM are tracked using a DOMRange object.
///
/// When a View is constructed by calling Blaze.View, the View is
/// not yet considered "created."  It doesn't have a parentView yet,
/// and no logic has been run to initialize the View.  All real
/// work is deferred until at least creation time, when the onViewCreated
/// callbacks are fired, which happens when the View is "used" in
/// some way that requires it to be rendered.
///
/// ...more lifecycle stuff
///
/// `name` is an optional string tag identifying the View.  The only
/// time it's used is when looking in the View tree for a View of a
/// particular name; for example, data contexts are stored on Views
/// of name "with".  Names are also useful when debugging, so in
/// general it's good for functions that create Views to set the name.
/// Views associated with templates have names of the form "Template.foo".

/**
 * @class
 * @summary Constructor for a View, which represents a reactive region of DOM.
 * @locus Client
 * @param {String} [name] Optional.  A name for this type of View.  See [`view.name`](#view_name).
 * @param {Function} renderFunction A function that returns [*renderable content*](#Renderable-Content).  In this function, `this` is bound to the View.
 */
Blaze.View = function (name, render) {
  if (!(this instanceof Blaze.View))
    // called without `new`
    return new Blaze.View(name, render);
  if (typeof name === 'function') {
    // omitted "name" argument
    render = name;
    name = '';
  }
  this.name = name;
  this._render = render;
  this._callbacks = {
    created: null,
    rendered: null,
    destroyed: null
  };

  // Setting all properties here is good for readability,
  // and also may help Chrome optimize the code by keeping
  // the View object from changing shape too much.
  this.isCreated = false;
  this._isCreatedForExpansion = false;
  this.isRendered = false;
  this._isAttached = false;
  this.isDestroyed = false;
  this._isInRender = false;
  this.parentView = null;
  this._domrange = null;
  // This flag is normally set to false except for the cases when view's parent
  // was generated as part of expanding some syntactic sugar expressions or
  // methods.
  // Ex.: Blaze.renderWithData is an equivalent to creating a view with regular
  // Blaze.render and wrapping it into {{#with data}}{{/with}} view. Since the
  // users don't know anything about these generated parent views, Blaze needs
  // this information to be available on views to make smarter decisions. For
  // example: removing the generated parent view with the view on Blaze.remove.
  this._hasGeneratedParent = false;
  // Bindings accessible to children views (via view.lookup('name')) within the
  // closest template view.
  this._scopeBindings = {};
  this.renderCount = 0;
};
Blaze.View.prototype._render = function () {
  return null;
};
Blaze.View.prototype.onViewCreated = function (cb) {
  this._callbacks.created = this._callbacks.created || [];
  this._callbacks.created.push(cb);
};
Blaze.View.prototype._onViewRendered = function (cb) {
  this._callbacks.rendered = this._callbacks.rendered || [];
  this._callbacks.rendered.push(cb);
};
Blaze.View.prototype.onViewReady = function (cb) {
  var self = this;
  var fire = function () {
    Tracker.afterFlush(function () {
      if (!self.isDestroyed) {
        Blaze._withCurrentView(self, function () {
          cb.call(self);
        });
      }
    });
  };
  self._onViewRendered(function onViewRendered() {
    if (self.isDestroyed) return;
    if (!self._domrange.attached) self._domrange.onAttached(fire);else fire();
  });
};
Blaze.View.prototype.onViewDestroyed = function (cb) {
  this._callbacks.destroyed = this._callbacks.destroyed || [];
  this._callbacks.destroyed.push(cb);
};
Blaze.View.prototype.removeViewDestroyedListener = function (cb) {
  var destroyed = this._callbacks.destroyed;
  if (!destroyed) return;
  var index = destroyed.lastIndexOf(cb);
  if (index !== -1) {
    // XXX You'd think the right thing to do would be splice, but _fireCallbacks
    // gets sad if you remove callbacks while iterating over the list.  Should
    // change this to use callback-hook or EventEmitter or something else that
    // properly supports removal.
    destroyed[index] = null;
  }
};

/// View#autorun(func)
///
/// Sets up a Tracker autorun that is "scoped" to this View in two
/// important ways: 1) Blaze.currentView is automatically set
/// on every re-run, and 2) the autorun is stopped when the
/// View is destroyed.  As with Tracker.autorun, the first run of
/// the function is immediate, and a Computation object that can
/// be used to stop the autorun is returned.
///
/// View#autorun is meant to be called from View callbacks like
/// onViewCreated, or from outside the rendering process.  It may not
/// be called before the onViewCreated callbacks are fired (too early),
/// or from a render() method (too confusing).
///
/// Typically, autoruns that update the state
/// of the View (as in Blaze.With) should be started from an onViewCreated
/// callback.  Autoruns that update the DOM should be started
/// from either onViewCreated (guarded against the absence of
/// view._domrange), or onViewReady.
Blaze.View.prototype.autorun = function (f, _inViewScope, displayName) {
  var self = this;

  // The restrictions on when View#autorun can be called are in order
  // to avoid bad patterns, like creating a Blaze.View and immediately
  // calling autorun on it.  A freshly created View is not ready to
  // have logic run on it; it doesn't have a parentView, for example.
  // It's when the View is materialized or expanded that the onViewCreated
  // handlers are fired and the View starts up.
  //
  // Letting the render() method call `this.autorun()` is problematic
  // because of re-render.  The best we can do is to stop the old
  // autorun and start a new one for each render, but that's a pattern
  // we try to avoid internally because it leads to helpers being
  // called extra times, in the case where the autorun causes the
  // view to re-render (and thus the autorun to be torn down and a
  // new one established).
  //
  // We could lift these restrictions in various ways.  One interesting
  // idea is to allow you to call `view.autorun` after instantiating
  // `view`, and automatically wrap it in `view.onViewCreated`, deferring
  // the autorun so that it starts at an appropriate time.  However,
  // then we can't return the Computation object to the caller, because
  // it doesn't exist yet.
  if (!self.isCreated) {
    throw new Error("View#autorun must be called from the created callback at the earliest");
  }
  if (this._isInRender) {
    throw new Error("Can't call View#autorun from inside render(); try calling it from the created or rendered callback");
  }
  var templateInstanceFunc = Blaze.Template._currentTemplateInstanceFunc;
  var func = function viewAutorun(c) {
    return Blaze._withCurrentView(_inViewScope || self, function () {
      return Blaze.Template._withTemplateInstanceFunc(templateInstanceFunc, function () {
        return f.call(self, c);
      });
    });
  };

  // Give the autorun function a better name for debugging and profiling.
  // The `displayName` property is not part of the spec but browsers like Chrome
  // and Firefox prefer it in debuggers over the name function was declared by.
  func.displayName = (self.name || 'anonymous') + ':' + (displayName || 'anonymous');
  var comp = Tracker.autorun(func);
  var stopComputation = function () {
    comp.stop();
  };
  self.onViewDestroyed(stopComputation);
  comp.onStop(function () {
    self.removeViewDestroyedListener(stopComputation);
  });
  return comp;
};
Blaze.View.prototype._errorIfShouldntCallSubscribe = function () {
  var self = this;
  if (!self.isCreated) {
    throw new Error("View#subscribe must be called from the created callback at the earliest");
  }
  if (self._isInRender) {
    throw new Error("Can't call View#subscribe from inside render(); try calling it from the created or rendered callback");
  }
  if (self.isDestroyed) {
    throw new Error("Can't call View#subscribe from inside the destroyed callback, try calling it inside created or rendered.");
  }
};

/**
 * Just like Blaze.View#autorun, but with Meteor.subscribe instead of
 * Tracker.autorun. Stop the subscription when the view is destroyed.
 * @return {SubscriptionHandle} A handle to the subscription so that you can
 * see if it is ready, or stop it manually
 */
Blaze.View.prototype.subscribe = function (args, options) {
  var self = this;
  options = options || {};
  self._errorIfShouldntCallSubscribe();
  var subHandle;
  if (options.connection) {
    subHandle = options.connection.subscribe.apply(options.connection, args);
  } else {
    subHandle = Meteor.subscribe.apply(Meteor, args);
  }
  self.onViewDestroyed(function () {
    subHandle.stop();
  });
  return subHandle;
};
Blaze.View.prototype.firstNode = function () {
  if (!this._isAttached) throw new Error("View must be attached before accessing its DOM");
  return this._domrange.firstNode();
};
Blaze.View.prototype.lastNode = function () {
  if (!this._isAttached) throw new Error("View must be attached before accessing its DOM");
  return this._domrange.lastNode();
};
Blaze._fireCallbacks = function (view, which) {
  Blaze._withCurrentView(view, function () {
    Tracker.nonreactive(function fireCallbacks() {
      var cbs = view._callbacks[which];
      for (var i = 0, N = cbs && cbs.length; i < N; i++) cbs[i] && cbs[i].call(view);
    });
  });
};
Blaze._createView = function (view, parentView, forExpansion) {
  if (view.isCreated) throw new Error("Can't render the same View twice");
  view.parentView = parentView || null;
  view.isCreated = true;
  if (forExpansion) view._isCreatedForExpansion = true;
  Blaze._fireCallbacks(view, 'created');
};
var doFirstRender = function (view, initialContent) {
  var domrange = new Blaze._DOMRange(initialContent);
  view._domrange = domrange;
  domrange.view = view;
  view.isRendered = true;
  Blaze._fireCallbacks(view, 'rendered');
  var teardownHook = null;
  domrange.onAttached(function attached(range, element) {
    view._isAttached = true;
    teardownHook = Blaze._DOMBackend.Teardown.onElementTeardown(element, function teardown() {
      Blaze._destroyView(view, true /* _skipNodes */);
    });
  });

  // tear down the teardown hook
  view.onViewDestroyed(function () {
    teardownHook && teardownHook.stop();
    teardownHook = null;
  });
  return domrange;
};

// Take an uncreated View `view` and create and render it to DOM,
// setting up the autorun that updates the View.  Returns a new
// DOMRange, which has been associated with the View.
//
// The private arguments `_workStack` and `_intoArray` are passed in
// by Blaze._materializeDOM and are only present for recursive calls
// (when there is some other _materializeView on the stack).  If
// provided, then we avoid the mutual recursion of calling back into
// Blaze._materializeDOM so that deep View hierarchies don't blow the
// stack.  Instead, we push tasks onto workStack for the initial
// rendering and subsequent setup of the View, and they are done after
// we return.  When there is a _workStack, we do not return the new
// DOMRange, but instead push it into _intoArray from a _workStack
// task.
Blaze._materializeView = function (view, parentView, _workStack, _intoArray) {
  Blaze._createView(view, parentView);
  var domrange;
  var lastHtmljs;
  // We don't expect to be called in a Computation, but just in case,
  // wrap in Tracker.nonreactive.
  Tracker.nonreactive(function () {
    view.autorun(function doRender(c) {
      // `view.autorun` sets the current view.
      view.renderCount++;
      view._isInRender = true;
      // Any dependencies that should invalidate this Computation come
      // from this line:
      var htmljs = view._render();
      view._isInRender = false;
      if (!c.firstRun && !Blaze._isContentEqual(lastHtmljs, htmljs)) {
        Tracker.nonreactive(function doMaterialize() {
          // re-render
          var rangesAndNodes = Blaze._materializeDOM(htmljs, [], view);
          domrange.setMembers(rangesAndNodes);
          Blaze._fireCallbacks(view, 'rendered');
        });
      }
      lastHtmljs = htmljs;

      // Causes any nested views to stop immediately, not when we call
      // `setMembers` the next time around the autorun.  Otherwise,
      // helpers in the DOM tree to be replaced might be scheduled
      // to re-run before we have a chance to stop them.
      Tracker.onInvalidate(function () {
        if (domrange) {
          domrange.destroyMembers();
        }
      });
    }, undefined, 'materialize');

    // first render.  lastHtmljs is the first htmljs.
    var initialContents;
    if (!_workStack) {
      initialContents = Blaze._materializeDOM(lastHtmljs, [], view);
      domrange = doFirstRender(view, initialContents);
      initialContents = null; // help GC because we close over this scope a lot
    } else {
      // We're being called from Blaze._materializeDOM, so to avoid
      // recursion and save stack space, provide a description of the
      // work to be done instead of doing it.  Tasks pushed onto
      // _workStack will be done in LIFO order after we return.
      // The work will still be done within a Tracker.nonreactive,
      // because it will be done by some call to Blaze._materializeDOM
      // (which is always called in a Tracker.nonreactive).
      initialContents = [];
      // push this function first so that it happens last
      _workStack.push(function () {
        domrange = doFirstRender(view, initialContents);
        initialContents = null; // help GC because of all the closures here
        _intoArray.push(domrange);
      });
      // now push the task that calculates initialContents
      _workStack.push(Blaze._bind(Blaze._materializeDOM, null, lastHtmljs, initialContents, view, _workStack));
    }
  });
  if (!_workStack) {
    return domrange;
  } else {
    return null;
  }
};

// Expands a View to HTMLjs, calling `render` recursively on all
// Views and evaluating any dynamic attributes.  Calls the `created`
// callback, but not the `materialized` or `rendered` callbacks.
// Destroys the view immediately, unless called in a Tracker Computation,
// in which case the view will be destroyed when the Computation is
// invalidated.  If called in a Tracker Computation, the result is a
// reactive string; that is, the Computation will be invalidated
// if any changes are made to the view or subviews that might affect
// the HTML.
Blaze._expandView = function (view, parentView) {
  Blaze._createView(view, parentView, true /*forExpansion*/);

  view._isInRender = true;
  var htmljs = Blaze._withCurrentView(view, function () {
    return view._render();
  });
  view._isInRender = false;
  var result = Blaze._expand(htmljs, view);
  if (Tracker.active) {
    Tracker.onInvalidate(function () {
      Blaze._destroyView(view);
    });
  } else {
    Blaze._destroyView(view);
  }
  return result;
};

// Options: `parentView`
Blaze._HTMLJSExpander = HTML.TransformingVisitor.extend();
Blaze._HTMLJSExpander.def({
  visitObject: function (x) {
    if (x instanceof Blaze.Template) x = x.constructView();
    if (x instanceof Blaze.View) return Blaze._expandView(x, this.parentView);

    // this will throw an error; other objects are not allowed!
    return HTML.TransformingVisitor.prototype.visitObject.call(this, x);
  },
  visitAttributes: function (attrs) {
    // expand dynamic attributes
    if (typeof attrs === 'function') attrs = Blaze._withCurrentView(this.parentView, attrs);

    // call super (e.g. for case where `attrs` is an array)
    return HTML.TransformingVisitor.prototype.visitAttributes.call(this, attrs);
  },
  visitAttribute: function (name, value, tag) {
    // expand attribute values that are functions.  Any attribute value
    // that contains Views must be wrapped in a function.
    if (typeof value === 'function') value = Blaze._withCurrentView(this.parentView, value);
    return HTML.TransformingVisitor.prototype.visitAttribute.call(this, name, value, tag);
  }
});

// Return Blaze.currentView, but only if it is being rendered
// (i.e. we are in its render() method).
var currentViewIfRendering = function () {
  var view = Blaze.currentView;
  return view && view._isInRender ? view : null;
};
Blaze._expand = function (htmljs, parentView) {
  parentView = parentView || currentViewIfRendering();
  return new Blaze._HTMLJSExpander({
    parentView: parentView
  }).visit(htmljs);
};
Blaze._expandAttributes = function (attrs, parentView) {
  parentView = parentView || currentViewIfRendering();
  return new Blaze._HTMLJSExpander({
    parentView: parentView
  }).visitAttributes(attrs);
};
Blaze._destroyView = function (view, _skipNodes) {
  if (view.isDestroyed) return;
  view.isDestroyed = true;

  // Destroy views and elements recursively.  If _skipNodes,
  // only recurse up to views, not elements, for the case where
  // the backend (jQuery) is recursing over the elements already.

  if (view._domrange) view._domrange.destroyMembers(_skipNodes);

  // XXX: fire callbacks after potential members are destroyed
  // otherwise it's tracker.flush will cause the above line will
  // not be called and their views won't be destroyed
  // Involved issues: DOMRange "Must be attached" error, mem leak

  Blaze._fireCallbacks(view, 'destroyed');
};
Blaze._destroyNode = function (node) {
  if (node.nodeType === 1) Blaze._DOMBackend.Teardown.tearDownElement(node);
};

// Are the HTMLjs entities `a` and `b` the same?  We could be
// more elaborate here but the point is to catch the most basic
// cases.
Blaze._isContentEqual = function (a, b) {
  if (a instanceof HTML.Raw) {
    return b instanceof HTML.Raw && a.value === b.value;
  } else if (a == null) {
    return b == null;
  } else {
    return a === b && (typeof a === 'number' || typeof a === 'boolean' || typeof a === 'string');
  }
};

/**
 * @summary The View corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.
 * @locus Client
 * @type {Blaze.View}
 */
Blaze.currentView = null;
Blaze._withCurrentView = function (view, func) {
  var oldView = Blaze.currentView;
  try {
    Blaze.currentView = view;
    return func();
  } finally {
    Blaze.currentView = oldView;
  }
};

// Blaze.render publicly takes a View or a Template.
// Privately, it takes any HTMLJS (extended with Views and Templates)
// except null or undefined, or a function that returns any extended
// HTMLJS.
var checkRenderContent = function (content) {
  if (content === null) throw new Error("Can't render null");
  if (typeof content === 'undefined') throw new Error("Can't render undefined");
  if (content instanceof Blaze.View || content instanceof Blaze.Template || typeof content === 'function') return;
  try {
    // Throw if content doesn't look like HTMLJS at the top level
    // (i.e. verify that this is an HTML.Tag, or an array,
    // or a primitive, etc.)
    new HTML.Visitor().visit(content);
  } catch (e) {
    // Make error message suitable for public API
    throw new Error("Expected Template or View");
  }
};

// For Blaze.render and Blaze.toHTML, take content and
// wrap it in a View, unless it's a single View or
// Template already.
var contentAsView = function (content) {
  checkRenderContent(content);
  if (content instanceof Blaze.Template) {
    return content.constructView();
  } else if (content instanceof Blaze.View) {
    return content;
  } else {
    var func = content;
    if (typeof func !== 'function') {
      func = function () {
        return content;
      };
    }
    return Blaze.View('render', func);
  }
};

// For Blaze.renderWithData and Blaze.toHTMLWithData, wrap content
// in a function, if necessary, so it can be a content arg to
// a Blaze.With.
var contentAsFunc = function (content) {
  checkRenderContent(content);
  if (typeof content !== 'function') {
    return function () {
      return content;
    };
  } else {
    return content;
  }
};
Blaze.__rootViews = [];

/**
 * @summary Renders a template or View to DOM nodes and inserts it into the DOM, returning a rendered [View](#Blaze-View) which can be passed to [`Blaze.remove`](#Blaze-remove).
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object to render.  If a template, a View object is [constructed](#template_constructview).  If a View, it must be an unrendered View, which becomes a rendered View and is returned.
 * @param {DOMNode} parentNode The node that will be the parent of the rendered template.  It must be an Element node.
 * @param {DOMNode} [nextNode] Optional. If provided, must be a child of <em>parentNode</em>; the template will be inserted before this node. If not provided, the template will be inserted as the last child of parentNode.
 * @param {Blaze.View} [parentView] Optional. If provided, it will be set as the rendered View's [`parentView`](#view_parentview).
 */
Blaze.render = function (content, parentElement, nextNode, parentView) {
  if (!parentElement) {
    Blaze._warn("Blaze.render without a parent element is deprecated. " + "You must specify where to insert the rendered content.");
  }
  if (nextNode instanceof Blaze.View) {
    // handle omitted nextNode
    parentView = nextNode;
    nextNode = null;
  }

  // parentElement must be a DOM node. in particular, can't be the
  // result of a call to `$`. Can't check if `parentElement instanceof
  // Node` since 'Node' is undefined in IE8.
  if (parentElement && typeof parentElement.nodeType !== 'number') throw new Error("'parentElement' must be a DOM node");
  if (nextNode && typeof nextNode.nodeType !== 'number')
    // 'nextNode' is optional
    throw new Error("'nextNode' must be a DOM node");
  parentView = parentView || currentViewIfRendering();
  var view = contentAsView(content);

  // TODO: this is only needed in development
  if (!parentView) {
    view.onViewCreated(function () {
      Blaze.__rootViews.push(view);
    });
    view.onViewDestroyed(function () {
      var index = Blaze.__rootViews.indexOf(view);
      if (index > -1) {
        Blaze.__rootViews.splice(index, 1);
      }
    });
  }
  Blaze._materializeView(view, parentView);
  if (parentElement) {
    view._domrange.attach(parentElement, nextNode);
  }
  return view;
};
Blaze.insert = function (view, parentElement, nextNode) {
  Blaze._warn("Blaze.insert has been deprecated.  Specify where to insert the " + "rendered content in the call to Blaze.render.");
  if (!(view && view._domrange instanceof Blaze._DOMRange)) throw new Error("Expected template rendered with Blaze.render");
  view._domrange.attach(parentElement, nextNode);
};

/**
 * @summary Renders a template or View to DOM nodes with a data context.  Otherwise identical to `Blaze.render`.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object to render.
 * @param {Object|Function} data The data context to use, or a function returning a data context.  If a function is provided, it will be reactively re-run.
 * @param {DOMNode} parentNode The node that will be the parent of the rendered template.  It must be an Element node.
 * @param {DOMNode} [nextNode] Optional. If provided, must be a child of <em>parentNode</em>; the template will be inserted before this node. If not provided, the template will be inserted as the last child of parentNode.
 * @param {Blaze.View} [parentView] Optional. If provided, it will be set as the rendered View's [`parentView`](#view_parentview).
 */
Blaze.renderWithData = function (content, data, parentElement, nextNode, parentView) {
  // We defer the handling of optional arguments to Blaze.render.  At this point,
  // `nextNode` may actually be `parentView`.
  return Blaze.render(Blaze._TemplateWith(data, contentAsFunc(content)), parentElement, nextNode, parentView);
};

/**
 * @summary Removes a rendered View from the DOM, stopping all reactive updates and event listeners on it. Also destroys the Blaze.Template instance associated with the view.
 * @locus Client
 * @param {Blaze.View} renderedView The return value from `Blaze.render` or `Blaze.renderWithData`, or the `view` property of a Blaze.Template instance. Calling `Blaze.remove(Template.instance().view)` from within a template event handler will destroy the view as well as that template and trigger the template's `onDestroyed` handlers.
 */
Blaze.remove = function (view) {
  if (!(view && view._domrange instanceof Blaze._DOMRange)) throw new Error("Expected template rendered with Blaze.render");
  while (view) {
    if (!view.isDestroyed) {
      var range = view._domrange;
      range.destroy();
      if (range.attached && !range.parentRange) {
        range.detach();
      }
    }
    view = view._hasGeneratedParent && view.parentView;
  }
};

/**
 * @summary Renders a template or View to a string of HTML.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object from which to generate HTML.
 */
Blaze.toHTML = function (content, parentView) {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(Blaze._expandView(contentAsView(content), parentView));
};

/**
 * @summary Renders a template or View to HTML with a data context.  Otherwise identical to `Blaze.toHTML`.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object from which to generate HTML.
 * @param {Object|Function} data The data context to use, or a function returning a data context.
 */
Blaze.toHTMLWithData = function (content, data, parentView) {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(Blaze._expandView(Blaze._TemplateWith(data, contentAsFunc(content)), parentView));
};
Blaze._toText = function (htmljs, parentView, textMode) {
  if (typeof htmljs === 'function') throw new Error("Blaze._toText doesn't take a function, just HTMLjs");
  if (parentView != null && !(parentView instanceof Blaze.View)) {
    // omitted parentView argument
    textMode = parentView;
    parentView = null;
  }
  parentView = parentView || currentViewIfRendering();
  if (!textMode) throw new Error("textMode required");
  if (!(textMode === HTML.TEXTMODE.STRING || textMode === HTML.TEXTMODE.RCDATA || textMode === HTML.TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
  return HTML.toText(Blaze._expand(htmljs, parentView), textMode);
};

/**
 * @summary Returns the current data context, or the data context that was used when rendering a particular DOM element or View from a Meteor template.
 * @locus Client
 * @param {DOMElement|Blaze.View} [elementOrView] Optional.  An element that was rendered by a Meteor, or a View.
 */
Blaze.getData = function (elementOrView) {
  var theWith;
  if (!elementOrView) {
    theWith = Blaze.getView('with');
  } else if (elementOrView instanceof Blaze.View) {
    var view = elementOrView;
    theWith = view.name === 'with' ? view : Blaze.getView(view, 'with');
  } else if (typeof elementOrView.nodeType === 'number') {
    if (elementOrView.nodeType !== 1) throw new Error("Expected DOM element");
    theWith = Blaze.getView(elementOrView, 'with');
  } else {
    throw new Error("Expected DOM element or View");
  }
  return theWith ? theWith.dataVar.get() : null;
};

// For back-compat
Blaze.getElementData = function (element) {
  Blaze._warn("Blaze.getElementData has been deprecated.  Use " + "Blaze.getData(element) instead.");
  if (element.nodeType !== 1) throw new Error("Expected DOM element");
  return Blaze.getData(element);
};

// Both arguments are optional.

/**
 * @summary Gets either the current View, or the View enclosing the given DOM element.
 * @locus Client
 * @param {DOMElement} [element] Optional.  If specified, the View enclosing `element` is returned.
 */
Blaze.getView = function (elementOrView, _viewName) {
  var viewName = _viewName;
  if (typeof elementOrView === 'string') {
    // omitted elementOrView; viewName present
    viewName = elementOrView;
    elementOrView = null;
  }

  // We could eventually shorten the code by folding the logic
  // from the other methods into this method.
  if (!elementOrView) {
    return Blaze._getCurrentView(viewName);
  } else if (elementOrView instanceof Blaze.View) {
    return Blaze._getParentView(elementOrView, viewName);
  } else if (typeof elementOrView.nodeType === 'number') {
    return Blaze._getElementView(elementOrView, viewName);
  } else {
    throw new Error("Expected DOM element or View");
  }
};

// Gets the current view or its nearest ancestor of name
// `name`.
Blaze._getCurrentView = function (name) {
  var view = Blaze.currentView;
  // Better to fail in cases where it doesn't make sense
  // to use Blaze._getCurrentView().  There will be a current
  // view anywhere it does.  You can check Blaze.currentView
  // if you want to know whether there is one or not.
  if (!view) throw new Error("There is no current view");
  if (name) {
    while (view && view.name !== name) view = view.parentView;
    return view || null;
  } else {
    // Blaze._getCurrentView() with no arguments just returns
    // Blaze.currentView.
    return view;
  }
};
Blaze._getParentView = function (view, name) {
  var v = view.parentView;
  if (name) {
    while (v && v.name !== name) v = v.parentView;
  }
  return v || null;
};
Blaze._getElementView = function (elem, name) {
  var range = Blaze._DOMRange.forElement(elem);
  var view = null;
  while (range && !view) {
    view = range.view || null;
    if (!view) {
      if (range.parentRange) range = range.parentRange;else range = Blaze._DOMRange.forElement(range.parentElement);
    }
  }
  if (name) {
    while (view && view.name !== name) view = view.parentView;
    return view || null;
  } else {
    return view;
  }
};
Blaze._addEventMap = function (view, eventMap, thisInHandler) {
  thisInHandler = thisInHandler || null;
  var handles = [];
  if (!view._domrange) throw new Error("View must have a DOMRange");
  view._domrange.onAttached(function attached_eventMaps(range, element) {
    Object.keys(eventMap).forEach(function (spec) {
      let handler = eventMap[spec];
      var clauses = spec.split(/,\s+/);
      // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']
      clauses.forEach(function (clause) {
        var parts = clause.split(/\s+/);
        if (parts.length === 0) return;
        var newEvents = parts.shift();
        var selector = parts.join(' ');
        handles.push(Blaze._EventSupport.listen(element, newEvents, selector, function (evt) {
          if (!range.containsElement(evt.currentTarget, selector, newEvents)) return null;
          var handlerThis = thisInHandler || this;
          var handlerArgs = arguments;
          return Blaze._withCurrentView(view, function () {
            return handler.apply(handlerThis, handlerArgs);
          });
        }, range, function (r) {
          return r.parentRange;
        }));
      });
    });
  });
  view.onViewDestroyed(function () {
    handles.forEach(function (h) {
      h.stop();
    });
    handles.length = 0;
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"builtins.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/builtins.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let has;
module.link("lodash.has", {
  default(v) {
    has = v;
  }
}, 0);
let isObject;
module.link("lodash.isobject", {
  default(v) {
    isObject = v;
  }
}, 1);
Blaze._calculateCondition = function (cond) {
  if (HTML.isArray(cond) && cond.length === 0) cond = false;
  return !!cond;
};

/**
 * @summary Constructs a View that renders content with a data context.
 * @locus Client
 * @param {Object|Function} data An object to use as the data context, or a function returning such an object.  If a function is provided, it will be reactively re-run.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 */
Blaze.With = function (data, contentFunc) {
  var view = Blaze.View('with', contentFunc);
  view.dataVar = new ReactiveVar();
  view.onViewCreated(function () {
    if (typeof data === 'function') {
      // `data` is a reactive function
      view.autorun(function () {
        view.dataVar.set(data());
      }, view.parentView, 'setData');
    } else {
      view.dataVar.set(data);
    }
  });
  return view;
};

/**
 * Attaches bindings to the instantiated view.
 * @param {Object} bindings A dictionary of bindings, each binding name
 * corresponds to a value or a function that will be reactively re-run.
 * @param {View} view The target.
 */
Blaze._attachBindingsToView = function (bindings, view) {
  view.onViewCreated(function () {
    Object.entries(bindings).forEach(function (_ref) {
      let [name, binding] = _ref;
      view._scopeBindings[name] = new ReactiveVar();
      if (typeof binding === 'function') {
        view.autorun(function () {
          view._scopeBindings[name].set(binding());
        }, view.parentView);
      } else {
        view._scopeBindings[name].set(binding);
      }
    });
  });
};

/**
 * @summary Constructs a View setting the local lexical scope in the block.
 * @param {Function} bindings Dictionary mapping names of bindings to
 * values or computations to reactively re-run.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 */
Blaze.Let = function (bindings, contentFunc) {
  var view = Blaze.View('let', contentFunc);
  Blaze._attachBindingsToView(bindings, view);
  return view;
};

/**
 * @summary Constructs a View that renders content conditionally.
 * @locus Client
 * @param {Function} conditionFunc A function to reactively re-run.  Whether the result is truthy or falsy determines whether `contentFunc` or `elseFunc` is shown.  An empty array is considered falsy.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 * @param {Function} [elseFunc] Optional.  A Function that returns [*renderable content*](#Renderable-Content).  If no `elseFunc` is supplied, no content is shown in the "else" case.
 */
Blaze.If = function (conditionFunc, contentFunc, elseFunc, _not) {
  var conditionVar = new ReactiveVar();
  var view = Blaze.View(_not ? 'unless' : 'if', function () {
    return conditionVar.get() ? contentFunc() : elseFunc ? elseFunc() : null;
  });
  view.__conditionVar = conditionVar;
  view.onViewCreated(function () {
    this.autorun(function () {
      var cond = Blaze._calculateCondition(conditionFunc());
      conditionVar.set(_not ? !cond : cond);
    }, this.parentView, 'condition');
  });
  return view;
};

/**
 * @summary An inverted [`Blaze.If`](#Blaze-If).
 * @locus Client
 * @param {Function} conditionFunc A function to reactively re-run.  If the result is falsy, `contentFunc` is shown, otherwise `elseFunc` is shown.  An empty array is considered falsy.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 * @param {Function} [elseFunc] Optional.  A Function that returns [*renderable content*](#Renderable-Content).  If no `elseFunc` is supplied, no content is shown in the "else" case.
 */
Blaze.Unless = function (conditionFunc, contentFunc, elseFunc) {
  return Blaze.If(conditionFunc, contentFunc, elseFunc, true /*_not*/);
};

/**
 * @summary Constructs a View that renders `contentFunc` for each item in a sequence.
 * @locus Client
 * @param {Function} argFunc A function to reactively re-run. The function can
 * return one of two options:
 *
 * 1. An object with two fields: '_variable' and '_sequence'. Each iterates over
 *   '_sequence', it may be a Cursor, an array, null, or undefined. Inside the
 *   Each body you will be able to get the current item from the sequence using
 *   the name specified in the '_variable' field.
 *
 * 2. Just a sequence (Cursor, array, null, or undefined) not wrapped into an
 *   object. Inside the Each body, the current item will be set as the data
 *   context.
 * @param {Function} contentFunc A Function that returns  [*renderable
 * content*](#Renderable-Content).
 * @param {Function} [elseFunc] A Function that returns [*renderable
 * content*](#Renderable-Content) to display in the case when there are no items
 * in the sequence.
 */
Blaze.Each = function (argFunc, contentFunc, elseFunc) {
  var eachView = Blaze.View('each', function () {
    var subviews = this.initialSubviews;
    this.initialSubviews = null;
    if (this._isCreatedForExpansion) {
      this.expandedValueDep = new Tracker.Dependency();
      this.expandedValueDep.depend();
    }
    return subviews;
  });
  eachView.initialSubviews = [];
  eachView.numItems = 0;
  eachView.inElseMode = false;
  eachView.stopHandle = null;
  eachView.contentFunc = contentFunc;
  eachView.elseFunc = elseFunc;
  eachView.argVar = new ReactiveVar();
  eachView.variableName = null;

  // update the @index value in the scope of all subviews in the range
  var updateIndices = function (from, to) {
    if (to === undefined) {
      to = eachView.numItems - 1;
    }
    for (var i = from; i <= to; i++) {
      var view = eachView._domrange.members[i].view;
      view._scopeBindings['@index'].set(i);
    }
  };
  eachView.onViewCreated(function () {
    // We evaluate argFunc in an autorun to make sure
    // Blaze.currentView is always set when it runs (rather than
    // passing argFunc straight to ObserveSequence).
    eachView.autorun(function () {
      // argFunc can return either a sequence as is or a wrapper object with a
      // _sequence and _variable fields set.
      var arg = argFunc();
      if (isObject(arg) && has(arg, '_sequence')) {
        eachView.variableName = arg._variable || null;
        arg = arg._sequence;
      }
      eachView.argVar.set(arg);
    }, eachView.parentView, 'collection');
    eachView.stopHandle = ObserveSequence.observe(function () {
      return eachView.argVar.get();
    }, {
      addedAt: function (id, item, index) {
        Tracker.nonreactive(function () {
          var newItemView;
          if (eachView.variableName) {
            // new-style #each (as in {{#each item in items}})
            // doesn't create a new data context
            newItemView = Blaze.View('item', eachView.contentFunc);
          } else {
            newItemView = Blaze.With(item, eachView.contentFunc);
          }
          eachView.numItems++;
          var bindings = {};
          bindings['@index'] = index;
          if (eachView.variableName) {
            bindings[eachView.variableName] = item;
          }
          Blaze._attachBindingsToView(bindings, newItemView);
          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else if (eachView._domrange) {
            if (eachView.inElseMode) {
              eachView._domrange.removeMember(0);
              eachView.inElseMode = false;
            }
            var range = Blaze._materializeView(newItemView, eachView);
            eachView._domrange.addMember(range, index);
            updateIndices(index);
          } else {
            eachView.initialSubviews.splice(index, 0, newItemView);
          }
        });
      },
      removedAt: function (id, item, index) {
        Tracker.nonreactive(function () {
          eachView.numItems--;
          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else if (eachView._domrange) {
            eachView._domrange.removeMember(index);
            updateIndices(index);
            if (eachView.elseFunc && eachView.numItems === 0) {
              eachView.inElseMode = true;
              eachView._domrange.addMember(Blaze._materializeView(Blaze.View('each_else', eachView.elseFunc), eachView), 0);
            }
          } else {
            eachView.initialSubviews.splice(index, 1);
          }
        });
      },
      changedAt: function (id, newItem, oldItem, index) {
        Tracker.nonreactive(function () {
          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else {
            var itemView;
            if (eachView._domrange) {
              itemView = eachView._domrange.getMember(index).view;
            } else {
              itemView = eachView.initialSubviews[index];
            }
            if (eachView.variableName) {
              itemView._scopeBindings[eachView.variableName].set(newItem);
            } else {
              itemView.dataVar.set(newItem);
            }
          }
        });
      },
      movedTo: function (id, item, fromIndex, toIndex) {
        Tracker.nonreactive(function () {
          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else if (eachView._domrange) {
            eachView._domrange.moveMember(fromIndex, toIndex);
            updateIndices(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex));
          } else {
            var subviews = eachView.initialSubviews;
            var itemView = subviews[fromIndex];
            subviews.splice(fromIndex, 1);
            subviews.splice(toIndex, 0, itemView);
          }
        });
      }
    });
    if (eachView.elseFunc && eachView.numItems === 0) {
      eachView.inElseMode = true;
      eachView.initialSubviews[0] = Blaze.View('each_else', eachView.elseFunc);
    }
  });
  eachView.onViewDestroyed(function () {
    if (eachView.stopHandle) eachView.stopHandle.stop();
  });
  return eachView;
};
Blaze._TemplateWith = function (arg, contentFunc) {
  var w;
  var argFunc = arg;
  if (typeof arg !== 'function') {
    argFunc = function () {
      return arg;
    };
  }

  // This is a little messy.  When we compile `{{> Template.contentBlock}}`, we
  // wrap it in Blaze._InOuterTemplateScope in order to skip the intermediate
  // parent Views in the current template.  However, when there's an argument
  // (`{{> Template.contentBlock arg}}`), the argument needs to be evaluated
  // in the original scope.  There's no good order to nest
  // Blaze._InOuterTemplateScope and Blaze._TemplateWith to achieve this,
  // so we wrap argFunc to run it in the "original parentView" of the
  // Blaze._InOuterTemplateScope.
  //
  // To make this better, reconsider _InOuterTemplateScope as a primitive.
  // Longer term, evaluate expressions in the proper lexical scope.
  var wrappedArgFunc = function () {
    var viewToEvaluateArg = null;
    if (w.parentView && w.parentView.name === 'InOuterTemplateScope') {
      viewToEvaluateArg = w.parentView.originalParentView;
    }
    if (viewToEvaluateArg) {
      return Blaze._withCurrentView(viewToEvaluateArg, argFunc);
    } else {
      return argFunc();
    }
  };
  var wrappedContentFunc = function () {
    var content = contentFunc.call(this);

    // Since we are generating the Blaze._TemplateWith view for the
    // user, set the flag on the child view.  If `content` is a template,
    // construct the View so that we can set the flag.
    if (content instanceof Blaze.Template) {
      content = content.constructView();
    }
    if (content instanceof Blaze.View) {
      content._hasGeneratedParent = true;
    }
    return content;
  };
  w = Blaze.With(wrappedArgFunc, wrappedContentFunc);
  w.__isTemplateWith = true;
  return w;
};
Blaze._InOuterTemplateScope = function (templateView, contentFunc) {
  var view = Blaze.View('InOuterTemplateScope', contentFunc);
  var parentView = templateView.parentView;

  // Hack so that if you call `{{> foo bar}}` and it expands into
  // `{{#with bar}}{{> foo}}{{/with}}`, and then `foo` is a template
  // that inserts `{{> Template.contentBlock}}`, the data context for
  // `Template.contentBlock` is not `bar` but the one enclosing that.
  if (parentView.__isTemplateWith) parentView = parentView.parentView;
  view.onViewCreated(function () {
    this.originalParentView = this.parentView;
    this.parentView = parentView;
    this.__childDoesntStartNewLexicalScope = true;
  });
  return view;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lookup.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/lookup.js                                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let has;
module.link("lodash.has", {
  default(v) {
    has = v;
  }
}, 0);
Blaze._globalHelpers = {};

// Documented as Template.registerHelper.
// This definition also provides back-compat for `UI.registerHelper`.
Blaze.registerHelper = function (name, func) {
  Blaze._globalHelpers[name] = func;
};

// Also documented as Template.deregisterHelper
Blaze.deregisterHelper = function (name) {
  delete Blaze._globalHelpers[name];
};
var bindIfIsFunction = function (x, target) {
  if (typeof x !== 'function') return x;
  return Blaze._bind(x, target);
};

// If `x` is a function, binds the value of `this` for that function
// to the current data context.
var bindDataContext = function (x) {
  if (typeof x === 'function') {
    return function () {
      var data = Blaze.getData();
      if (data == null) data = {};
      return x.apply(data, arguments);
    };
  }
  return x;
};
Blaze._OLDSTYLE_HELPER = {};
Blaze._getTemplateHelper = function (template, name, tmplInstanceFunc) {
  // XXX COMPAT WITH 0.9.3
  var isKnownOldStyleHelper = false;
  if (template.__helpers.has(name)) {
    var helper = template.__helpers.get(name);
    if (helper === Blaze._OLDSTYLE_HELPER) {
      isKnownOldStyleHelper = true;
    } else if (helper != null) {
      return wrapHelper(bindDataContext(helper), tmplInstanceFunc);
    } else {
      return null;
    }
  }

  // old-style helper
  if (name in template) {
    // Only warn once per helper
    if (!isKnownOldStyleHelper) {
      template.__helpers.set(name, Blaze._OLDSTYLE_HELPER);
      if (!template._NOWARN_OLDSTYLE_HELPERS) {
        Blaze._warn('Assigning helper with `' + template.viewName + '.' + name + ' = ...` is deprecated.  Use `' + template.viewName + '.helpers(...)` instead.');
      }
    }
    if (template[name] != null) {
      return wrapHelper(bindDataContext(template[name]), tmplInstanceFunc);
    }
  }
  return null;
};
var wrapHelper = function (f, templateFunc) {
  if (typeof f !== "function") {
    return f;
  }
  return function () {
    var self = this;
    var args = arguments;
    return Blaze.Template._withTemplateInstanceFunc(templateFunc, function () {
      return Blaze._wrapCatchingExceptions(f, 'template helper').apply(self, args);
    });
  };
};
function _lexicalKeepGoing(currentView) {
  if (!currentView.parentView) {
    return undefined;
  }
  if (!currentView.__startsNewLexicalScope) {
    return currentView.parentView;
  }
  if (currentView.parentView.__childDoesntStartNewLexicalScope) {
    return currentView.parentView;
  }

  // in the case of {{> Template.contentBlock data}} the contentBlock loses the lexical scope of it's parent, wheras {{> Template.contentBlock}} it does not
  // this is because a #with sits between the include InOuterTemplateScope
  if (currentView.parentView.name === "with" && currentView.parentView.parentView && currentView.parentView.parentView.__childDoesntStartNewLexicalScope) {
    return currentView.parentView;
  }
  return undefined;
}
Blaze._lexicalBindingLookup = function (view, name) {
  var currentView = view;
  var blockHelpersStack = [];

  // walk up the views stopping at a Spacebars.include or Template view that
  // doesn't have an InOuterTemplateScope view as a parent
  do {
    // skip block helpers views
    // if we found the binding on the scope, return it
    if (has(currentView._scopeBindings, name)) {
      var bindingReactiveVar = currentView._scopeBindings[name];
      return function () {
        return bindingReactiveVar.get();
      };
    }
  } while (currentView = _lexicalKeepGoing(currentView));
  return null;
};

// templateInstance argument is provided to be available for possible
// alternative implementations of this function by 3rd party packages.
Blaze._getTemplate = function (name, templateInstance) {
  if (name in Blaze.Template && Blaze.Template[name] instanceof Blaze.Template) {
    return Blaze.Template[name];
  }
  return null;
};
Blaze._getGlobalHelper = function (name, templateInstance) {
  if (Blaze._globalHelpers[name] != null) {
    return wrapHelper(bindDataContext(Blaze._globalHelpers[name]), templateInstance);
  }
  return null;
};

// Looks up a name, like "foo" or "..", as a helper of the
// current template; the name of a template; a global helper;
// or a property of the data context.  Called on the View of
// a template (i.e. a View with a `.template` property,
// where the helpers are).  Used for the first name in a
// "path" in a template tag, like "foo" in `{{foo.bar}}` or
// ".." in `{{frobulate ../blah}}`.
//
// Returns a function, a non-function value, or null.  If
// a function is found, it is bound appropriately.
//
// NOTE: This function must not establish any reactive
// dependencies itself.  If there is any reactivity in the
// value, lookup should return a function.
Blaze.View.prototype.lookup = function (name, _options) {
  var template = this.template;
  var lookupTemplate = _options && _options.template;
  var helper;
  var binding;
  var boundTmplInstance;
  var foundTemplate;
  if (this.templateInstance) {
    boundTmplInstance = Blaze._bind(this.templateInstance, this);
  }

  // 0. looking up the parent data context with the special "../" syntax
  if (/^\./.test(name)) {
    // starts with a dot. must be a series of dots which maps to an
    // ancestor of the appropriate height.
    if (!/^(\.)+$/.test(name)) throw new Error("id starting with dot must be a series of dots");
    return Blaze._parentData(name.length - 1, true /*_functionWrapped*/);
  }

  // 1. look up a helper on the current template
  if (template && (helper = Blaze._getTemplateHelper(template, name, boundTmplInstance)) != null) {
    return helper;
  }

  // 2. look up a binding by traversing the lexical view hierarchy inside the
  // current template
  if (template && (binding = Blaze._lexicalBindingLookup(Blaze.currentView, name)) != null) {
    return binding;
  }

  // 3. look up a template by name
  if (lookupTemplate && (foundTemplate = Blaze._getTemplate(name, boundTmplInstance)) != null) {
    return foundTemplate;
  }

  // 4. look up a global helper
  if ((helper = Blaze._getGlobalHelper(name, boundTmplInstance)) != null) {
    return helper;
  }

  // 5. look up in a data context
  return function () {
    var isCalledAsFunction = arguments.length > 0;
    var data = Blaze.getData();
    var x = data && data[name];
    if (!x) {
      if (lookupTemplate) {
        throw new Error("No such template: " + name);
      } else if (isCalledAsFunction) {
        throw new Error("No such function: " + name);
      } else if (name.charAt(0) === '@' && (x === null || x === undefined)) {
        // Throw an error if the user tries to use a `@directive`
        // that doesn't exist.  We don't implement all directives
        // from Handlebars, so there's a potential for confusion
        // if we fail silently.  On the other hand, we want to
        // throw late in case some app or package wants to provide
        // a missing directive.
        throw new Error("Unsupported directive: " + name);
      }
    }
    if (!data) {
      return null;
    }
    if (typeof x !== 'function') {
      if (isCalledAsFunction) {
        throw new Error("Can't call non-function: " + x);
      }
      return x;
    }
    return x.apply(data, arguments);
  };
};

// Implement Spacebars' {{../..}}.
// @param height {Number} The number of '..'s
Blaze._parentData = function (height, _functionWrapped) {
  // If height is null or undefined, we default to 1, the first parent.
  if (height == null) {
    height = 1;
  }
  var theWith = Blaze.getView('with');
  for (var i = 0; i < height && theWith; i++) {
    theWith = Blaze.getView(theWith, 'with');
  }
  if (!theWith) return null;
  if (_functionWrapped) return function () {
    return theWith.dataVar.get();
  };
  return theWith.dataVar.get();
};
Blaze.View.prototype.lookupTemplate = function (name) {
  return this.lookup(name, {
    template: true
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/template.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let isObject;
module.link("lodash.isobject", {
  default(v) {
    isObject = v;
  }
}, 0);
let isFunction;
module.link("lodash.isfunction", {
  default(v) {
    isFunction = v;
  }
}, 1);
let has;
module.link("lodash.has", {
  default(v) {
    has = v;
  }
}, 2);
let isEmpty;
module.link("lodash.isempty", {
  default(v) {
    isEmpty = v;
  }
}, 3);
// [new] Blaze.Template([viewName], renderFunction)
//
// `Blaze.Template` is the class of templates, like `Template.foo` in
// Meteor, which is `instanceof Template`.
//
// `viewKind` is a string that looks like "Template.foo" for templates
// defined by the compiler.

/**
 * @class
 * @summary Constructor for a Template, which is used to construct Views with particular name and content.
 * @locus Client
 * @param {String} [viewName] Optional.  A name for Views constructed by this Template.  See [`view.name`](#view_name).
 * @param {Function} renderFunction A function that returns [*renderable content*](#Renderable-Content).  This function is used as the `renderFunction` for Views constructed by this Template.
 */
Blaze.Template = function (viewName, renderFunction) {
  if (!(this instanceof Blaze.Template))
    // called without `new`
    return new Blaze.Template(viewName, renderFunction);
  if (typeof viewName === 'function') {
    // omitted "viewName" argument
    renderFunction = viewName;
    viewName = '';
  }
  if (typeof viewName !== 'string') throw new Error("viewName must be a String (or omitted)");
  if (typeof renderFunction !== 'function') throw new Error("renderFunction must be a function");
  this.viewName = viewName;
  this.renderFunction = renderFunction;
  this.__helpers = new HelperMap();
  this.__eventMaps = [];
  this._callbacks = {
    created: [],
    rendered: [],
    destroyed: []
  };
};
var Template = Blaze.Template;
var HelperMap = function () {};
HelperMap.prototype.get = function (name) {
  return this[' ' + name];
};
HelperMap.prototype.set = function (name, helper) {
  this[' ' + name] = helper;
};
HelperMap.prototype.has = function (name) {
  return typeof this[' ' + name] !== 'undefined';
};

/**
 * @summary Returns true if `value` is a template object like `Template.myTemplate`.
 * @locus Client
 * @param {Any} value The value to test.
 */
Blaze.isTemplate = function (t) {
  return t instanceof Blaze.Template;
};

/**
 * @name  onCreated
 * @instance
 * @memberOf Template
 * @summary Register a function to be called when an instance of this template is created.
 * @param {Function} callback A function to be added as a callback.
 * @locus Client
 * @importFromPackage templating
 */
Template.prototype.onCreated = function (cb) {
  this._callbacks.created.push(cb);
};

/**
 * @name  onRendered
 * @instance
 * @memberOf Template
 * @summary Register a function to be called when an instance of this template is inserted into the DOM.
 * @param {Function} callback A function to be added as a callback.
 * @locus Client
 * @importFromPackage templating
 */
Template.prototype.onRendered = function (cb) {
  this._callbacks.rendered.push(cb);
};

/**
 * @name  onDestroyed
 * @instance
 * @memberOf Template
 * @summary Register a function to be called when an instance of this template is removed from the DOM and destroyed.
 * @param {Function} callback A function to be added as a callback.
 * @locus Client
 * @importFromPackage templating
 */
Template.prototype.onDestroyed = function (cb) {
  this._callbacks.destroyed.push(cb);
};
Template.prototype._getCallbacks = function (which) {
  var self = this;
  var callbacks = self[which] ? [self[which]] : [];
  // Fire all callbacks added with the new API (Template.onRendered())
  // as well as the old-style callback (e.g. Template.rendered) for
  // backwards-compatibility.
  callbacks = callbacks.concat(self._callbacks[which]);
  return callbacks;
};
var fireCallbacks = function (callbacks, template) {
  Template._withTemplateInstanceFunc(function () {
    return template;
  }, function () {
    for (var i = 0, N = callbacks.length; i < N; i++) {
      callbacks[i].call(template);
    }
  });
};
Template.prototype.constructView = function (contentFunc, elseFunc) {
  var self = this;
  var view = Blaze.View(self.viewName, self.renderFunction);
  view.template = self;
  view.templateContentBlock = contentFunc ? new Template('(contentBlock)', contentFunc) : null;
  view.templateElseBlock = elseFunc ? new Template('(elseBlock)', elseFunc) : null;
  if (self.__eventMaps || typeof self.events === 'object') {
    view._onViewRendered(function () {
      if (view.renderCount !== 1) return;
      if (!self.__eventMaps.length && typeof self.events === "object") {
        // Provide limited back-compat support for `.events = {...}`
        // syntax.  Pass `template.events` to the original `.events(...)`
        // function.  This code must run only once per template, in
        // order to not bind the handlers more than once, which is
        // ensured by the fact that we only do this when `__eventMaps`
        // is falsy, and we cause it to be set now.
        Template.prototype.events.call(self, self.events);
      }
      self.__eventMaps.forEach(function (m) {
        Blaze._addEventMap(view, m, view);
      });
    });
  }
  view._templateInstance = new Blaze.TemplateInstance(view);
  view.templateInstance = function () {
    // Update data, firstNode, and lastNode, and return the TemplateInstance
    // object.
    var inst = view._templateInstance;

    /**
     * @instance
     * @memberOf Blaze.TemplateInstance
     * @name  data
     * @summary The data context of this instance's latest invocation.
     * @locus Client
     */
    inst.data = Blaze.getData(view);
    if (view._domrange && !view.isDestroyed) {
      inst.firstNode = view._domrange.firstNode();
      inst.lastNode = view._domrange.lastNode();
    } else {
      // on 'created' or 'destroyed' callbacks we don't have a DomRange
      inst.firstNode = null;
      inst.lastNode = null;
    }
    return inst;
  };

  /**
   * @name  created
   * @instance
   * @memberOf Template
   * @summary Provide a callback when an instance of a template is created.
   * @locus Client
   * @deprecated in 1.1
   */
  // To avoid situations when new callbacks are added in between view
  // instantiation and event being fired, decide on all callbacks to fire
  // immediately and then fire them on the event.
  var createdCallbacks = self._getCallbacks('created');
  view.onViewCreated(function () {
    fireCallbacks(createdCallbacks, view.templateInstance());
  });

  /**
   * @name  rendered
   * @instance
   * @memberOf Template
   * @summary Provide a callback when an instance of a template is rendered.
   * @locus Client
   * @deprecated in 1.1
   */
  var renderedCallbacks = self._getCallbacks('rendered');
  view.onViewReady(function () {
    fireCallbacks(renderedCallbacks, view.templateInstance());
  });

  /**
   * @name  destroyed
   * @instance
   * @memberOf Template
   * @summary Provide a callback when an instance of a template is destroyed.
   * @locus Client
   * @deprecated in 1.1
   */
  var destroyedCallbacks = self._getCallbacks('destroyed');
  view.onViewDestroyed(function () {
    fireCallbacks(destroyedCallbacks, view.templateInstance());
  });
  return view;
};

/**
 * @class
 * @summary The class for template instances
 * @param {Blaze.View} view
 * @instanceName template
 */
Blaze.TemplateInstance = function (view) {
  if (!(this instanceof Blaze.TemplateInstance))
    // called without `new`
    return new Blaze.TemplateInstance(view);
  if (!(view instanceof Blaze.View)) throw new Error("View required");
  view._templateInstance = this;

  /**
   * @name view
   * @memberOf Blaze.TemplateInstance
   * @instance
   * @summary The [View](../api/blaze.html#Blaze-View) object for this invocation of the template.
   * @locus Client
   * @type {Blaze.View}
   */
  this.view = view;
  this.data = null;

  /**
   * @name firstNode
   * @memberOf Blaze.TemplateInstance
   * @instance
   * @summary The first top-level DOM node in this template instance.
   * @locus Client
   * @type {DOMNode}
   */
  this.firstNode = null;

  /**
   * @name lastNode
   * @memberOf Blaze.TemplateInstance
   * @instance
   * @summary The last top-level DOM node in this template instance.
   * @locus Client
   * @type {DOMNode}
   */
  this.lastNode = null;

  // This dependency is used to identify state transitions in
  // _subscriptionHandles which could cause the result of
  // TemplateInstance#subscriptionsReady to change. Basically this is triggered
  // whenever a new subscription handle is added or when a subscription handle
  // is removed and they are not ready.
  this._allSubsReadyDep = new Tracker.Dependency();
  this._allSubsReady = false;
  this._subscriptionHandles = {};
};

/**
 * @summary Find all elements matching `selector` in this template instance, and return them as a JQuery object.
 * @locus Client
 * @param {String} selector The CSS selector to match, scoped to the template contents.
 * @returns {DOMNode[]}
 */
Blaze.TemplateInstance.prototype.$ = function (selector) {
  var view = this.view;
  if (!view._domrange) throw new Error("Can't use $ on template instance with no DOM");
  return view._domrange.$(selector);
};

/**
 * @summary Find all elements matching `selector` in this template instance.
 * @locus Client
 * @param {String} selector The CSS selector to match, scoped to the template contents.
 * @returns {DOMElement[]}
 */
Blaze.TemplateInstance.prototype.findAll = function (selector) {
  return Array.prototype.slice.call(this.$(selector));
};

/**
 * @summary Find one element matching `selector` in this template instance.
 * @locus Client
 * @param {String} selector The CSS selector to match, scoped to the template contents.
 * @returns {DOMElement}
 */
Blaze.TemplateInstance.prototype.find = function (selector) {
  var result = this.$(selector);
  return result[0] || null;
};

/**
 * @summary A version of [Tracker.autorun](https://docs.meteor.com/api/tracker.html#Tracker-autorun) that is stopped when the template is destroyed.
 * @locus Client
 * @param {Function} runFunc The function to run. It receives one argument: a Tracker.Computation object.
 */
Blaze.TemplateInstance.prototype.autorun = function (f) {
  return this.view.autorun(f);
};

/**
 * @summary A version of [Meteor.subscribe](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe) that is stopped
 * when the template is destroyed.
 * @return {SubscriptionHandle} The subscription handle to the newly made
 * subscription. Call `handle.stop()` to manually stop the subscription, or
 * `handle.ready()` to find out if this particular subscription has loaded all
 * of its inital data.
 * @locus Client
 * @param {String} name Name of the subscription.  Matches the name of the
 * server's `publish()` call.
 * @param {Any} [arg1,arg2...] Optional arguments passed to publisher function
 * on server.
 * @param {Function|Object} [options] If a function is passed instead of an
 * object, it is interpreted as an `onReady` callback.
 * @param {Function} [options.onReady] Passed to [`Meteor.subscribe`](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe).
 * @param {Function} [options.onStop] Passed to [`Meteor.subscribe`](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe).
 * @param {DDP.Connection} [options.connection] The connection on which to make the
 * subscription.
 */
Blaze.TemplateInstance.prototype.subscribe = function () {
  var self = this;
  var subHandles = self._subscriptionHandles;

  // Duplicate logic from Meteor.subscribe
  var options = {};
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }
  if (args.length) {
    var lastParam = args[args.length - 1];

    // Match pattern to check if the last arg is an options argument
    var lastParamOptionsPattern = {
      onReady: Match.Optional(Function),
      // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
      // onStop with an error callback instead.
      onError: Match.Optional(Function),
      onStop: Match.Optional(Function),
      connection: Match.Optional(Match.Any)
    };
    if (isFunction(lastParam)) {
      options.onReady = args.pop();
    } else if (lastParam && !isEmpty(lastParam) && Match.test(lastParam, lastParamOptionsPattern)) {
      options = args.pop();
    }
  }
  var subHandle;
  var oldStopped = options.onStop;
  options.onStop = function (error) {
    // When the subscription is stopped, remove it from the set of tracked
    // subscriptions to avoid this list growing without bound
    delete subHandles[subHandle.subscriptionId];

    // Removing a subscription can only change the result of subscriptionsReady
    // if we are not ready (that subscription could be the one blocking us being
    // ready).
    if (!self._allSubsReady) {
      self._allSubsReadyDep.changed();
    }
    if (oldStopped) {
      oldStopped(error);
    }
  };
  var connection = options.connection;
  const {
    onReady,
    onError,
    onStop
  } = options;
  var callbacks = {
    onReady,
    onError,
    onStop
  };

  // The callbacks are passed as the last item in the arguments array passed to
  // View#subscribe
  args.push(callbacks);

  // View#subscribe takes the connection as one of the options in the last
  // argument
  subHandle = self.view.subscribe.call(self.view, args, {
    connection: connection
  });
  if (!has(subHandles, subHandle.subscriptionId)) {
    subHandles[subHandle.subscriptionId] = subHandle;

    // Adding a new subscription will always cause us to transition from ready
    // to not ready, but if we are already not ready then this can't make us
    // ready.
    if (self._allSubsReady) {
      self._allSubsReadyDep.changed();
    }
  }
  return subHandle;
};

/**
 * @summary A reactive function that returns true when all of the subscriptions
 * called with [this.subscribe](#TemplateInstance-subscribe) are ready.
 * @return {Boolean} True if all subscriptions on this template instance are
 * ready.
 */
Blaze.TemplateInstance.prototype.subscriptionsReady = function () {
  this._allSubsReadyDep.depend();
  this._allSubsReady = Object.values(this._subscriptionHandles).every(handle => {
    return handle.ready();
  });
  return this._allSubsReady;
};

/**
 * @summary Specify template helpers available to this template.
 * @locus Client
 * @param {Object} helpers Dictionary of helper functions by name.
 * @importFromPackage templating
 */
Template.prototype.helpers = function (dict) {
  if (!isObject(dict)) {
    throw new Error("Helpers dictionary has to be an object");
  }
  for (var k in dict) this.__helpers.set(k, dict[k]);
};
var canUseGetters = function () {
  if (Object.defineProperty) {
    var obj = {};
    try {
      Object.defineProperty(obj, "self", {
        get: function () {
          return obj;
        }
      });
    } catch (e) {
      return false;
    }
    return obj.self === obj;
  }
  return false;
}();
if (canUseGetters) {
  // Like Blaze.currentView but for the template instance. A function
  // rather than a value so that not all helpers are implicitly dependent
  // on the current template instance's `data` property, which would make
  // them dependent on the data context of the template inclusion.
  var currentTemplateInstanceFunc = null;

  // If getters are supported, define this property with a getter function
  // to make it effectively read-only, and to work around this bizarre JSC
  // bug: https://github.com/meteor/meteor/issues/9926
  Object.defineProperty(Template, "_currentTemplateInstanceFunc", {
    get: function () {
      return currentTemplateInstanceFunc;
    }
  });
  Template._withTemplateInstanceFunc = function (templateInstanceFunc, func) {
    if (typeof func !== 'function') {
      throw new Error("Expected function, got: " + func);
    }
    var oldTmplInstanceFunc = currentTemplateInstanceFunc;
    try {
      currentTemplateInstanceFunc = templateInstanceFunc;
      return func();
    } finally {
      currentTemplateInstanceFunc = oldTmplInstanceFunc;
    }
  };
} else {
  // If getters are not supported, just use a normal property.
  Template._currentTemplateInstanceFunc = null;
  Template._withTemplateInstanceFunc = function (templateInstanceFunc, func) {
    if (typeof func !== 'function') {
      throw new Error("Expected function, got: " + func);
    }
    var oldTmplInstanceFunc = Template._currentTemplateInstanceFunc;
    try {
      Template._currentTemplateInstanceFunc = templateInstanceFunc;
      return func();
    } finally {
      Template._currentTemplateInstanceFunc = oldTmplInstanceFunc;
    }
  };
}

/**
 * @summary Specify event handlers for this template.
 * @locus Client
 * @param {EventMap} eventMap Event handlers to associate with this template.
 * @importFromPackage templating
 */
Template.prototype.events = function (eventMap) {
  if (!isObject(eventMap)) {
    throw new Error("Event map has to be an object");
  }
  var template = this;
  var eventMap2 = {};
  for (var k in eventMap) {
    eventMap2[k] = function (k, v) {
      return function (event /*, ...*/) {
        var view = this; // passed by EventAugmenter
        var data = Blaze.getData(event.currentTarget);
        if (data == null) data = {};
        var args = Array.prototype.slice.call(arguments);
        var tmplInstanceFunc = Blaze._bind(view.templateInstance, view);
        args.splice(1, 0, tmplInstanceFunc());
        return Template._withTemplateInstanceFunc(tmplInstanceFunc, function () {
          return v.apply(data, args);
        });
      };
    }(k, eventMap[k]);
  }
  template.__eventMaps.push(eventMap2);
};

/**
 * @function
 * @name instance
 * @memberOf Template
 * @summary The [template instance](#Template-instances) corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.
 * @locus Client
 * @returns {Blaze.TemplateInstance}
 * @importFromPackage templating
 */
Template.instance = function () {
  return Template._currentTemplateInstanceFunc && Template._currentTemplateInstanceFunc();
};

// Note: Template.currentData() is documented to take zero arguments,
// while Blaze.getData takes up to one.

/**
 * @summary
 *
 * - Inside an `onCreated`, `onRendered`, or `onDestroyed` callback, returns
 * the data context of the template.
 * - Inside an event handler, returns the data context of the template on which
 * this event handler was defined.
 * - Inside a helper, returns the data context of the DOM node where the helper
 * was used.
 *
 * Establishes a reactive dependency on the result.
 * @locus Client
 * @function
 * @importFromPackage templating
 */
Template.currentData = Blaze.getData;

/**
 * @summary Accesses other data contexts that enclose the current data context.
 * @locus Client
 * @function
 * @param {Integer} [numLevels] The number of levels beyond the current data context to look. Defaults to 1.
 * @importFromPackage templating
 */
Template.parentData = Blaze._parentData;

/**
 * @summary Defines a [helper function](#Template-helpers) which can be used from all templates.
 * @locus Client
 * @function
 * @param {String} name The name of the helper function you are defining.
 * @param {Function} function The helper function itself.
 * @importFromPackage templating
 */
Template.registerHelper = Blaze.registerHelper;

/**
 * @summary Removes a global [helper function](#Template-helpers).
 * @locus Client
 * @function
 * @param {String} name The name of the helper function you are defining.
 * @importFromPackage templating
 */
Template.deregisterHelper = Blaze.deregisterHelper;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"backcompat.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/backcompat.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
UI = Blaze;
Blaze.ReactiveVar = ReactiveVar;
UI._templateInstance = Blaze.Template.instance;
Handlebars = {};
Handlebars.registerHelper = Blaze.registerHelper;
Handlebars._escape = Blaze._escape;

// Return these from {{...}} helpers to achieve the same as returning
// strings from {{{...}}} helpers
Handlebars.SafeString = function (string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function () {
  return this.string.toString();
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.has":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.has/package.json                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.has",
  "version": "4.5.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.has/index.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isobject":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isobject/package.json                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isobject",
  "version": "3.0.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isobject/index.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isfunction":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isfunction/package.json                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isfunction",
  "version": "3.0.9"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isfunction/index.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isempty/package.json                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isempty/index.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/blaze/preamble.js");
require("/node_modules/meteor/blaze/exceptions.js");
require("/node_modules/meteor/blaze/view.js");
require("/node_modules/meteor/blaze/builtins.js");
require("/node_modules/meteor/blaze/lookup.js");
require("/node_modules/meteor/blaze/template.js");
require("/node_modules/meteor/blaze/backcompat.js");

/* Exports */
Package._define("blaze", {
  Blaze: Blaze,
  UI: UI,
  Handlebars: Handlebars
});

})();

//# sourceURL=meteor://💻app/packages/blaze.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYmxhemUvcHJlYW1ibGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2V4Y2VwdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3ZpZXcuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2J1aWx0aW5zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9sb29rdXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3RlbXBsYXRlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9iYWNrY29tcGF0LmpzIl0sIm5hbWVzIjpbIkJsYXplIiwiX2VzY2FwZSIsImVzY2FwZV9tYXAiLCJlc2NhcGVfb25lIiwiYyIsIngiLCJyZXBsYWNlIiwiX3dhcm4iLCJtc2ciLCJjb25zb2xlIiwid2FybiIsIm5hdGl2ZUJpbmQiLCJGdW5jdGlvbiIsInByb3RvdHlwZSIsImJpbmQiLCJfYmluZCIsImZ1bmMiLCJvYmoiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJjYWxsIiwiYXJncyIsIkFycmF5IiwiaSIsImFwcGx5Iiwic2xpY2UiLCJvYmpBIiwib2JqQiIsImRlYnVnRnVuYyIsIl90aHJvd05leHRFeGNlcHRpb24iLCJfcmVwb3J0RXhjZXB0aW9uIiwiZSIsIk1ldGVvciIsIl9kZWJ1ZyIsImxvZyIsInN0YWNrIiwibWVzc2FnZSIsIl93cmFwQ2F0Y2hpbmdFeGNlcHRpb25zIiwiZiIsIndoZXJlIiwiVmlldyIsIm5hbWUiLCJyZW5kZXIiLCJfcmVuZGVyIiwiX2NhbGxiYWNrcyIsImNyZWF0ZWQiLCJyZW5kZXJlZCIsImRlc3Ryb3llZCIsImlzQ3JlYXRlZCIsIl9pc0NyZWF0ZWRGb3JFeHBhbnNpb24iLCJpc1JlbmRlcmVkIiwiX2lzQXR0YWNoZWQiLCJpc0Rlc3Ryb3llZCIsIl9pc0luUmVuZGVyIiwicGFyZW50VmlldyIsIl9kb21yYW5nZSIsIl9oYXNHZW5lcmF0ZWRQYXJlbnQiLCJfc2NvcGVCaW5kaW5ncyIsInJlbmRlckNvdW50Iiwib25WaWV3Q3JlYXRlZCIsImNiIiwicHVzaCIsIl9vblZpZXdSZW5kZXJlZCIsIm9uVmlld1JlYWR5Iiwic2VsZiIsImZpcmUiLCJUcmFja2VyIiwiYWZ0ZXJGbHVzaCIsIl93aXRoQ3VycmVudFZpZXciLCJvblZpZXdSZW5kZXJlZCIsImF0dGFjaGVkIiwib25BdHRhY2hlZCIsIm9uVmlld0Rlc3Ryb3llZCIsInJlbW92ZVZpZXdEZXN0cm95ZWRMaXN0ZW5lciIsImluZGV4IiwibGFzdEluZGV4T2YiLCJhdXRvcnVuIiwiX2luVmlld1Njb3BlIiwiZGlzcGxheU5hbWUiLCJFcnJvciIsInRlbXBsYXRlSW5zdGFuY2VGdW5jIiwiVGVtcGxhdGUiLCJfY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwidmlld0F1dG9ydW4iLCJfd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwiY29tcCIsInN0b3BDb21wdXRhdGlvbiIsInN0b3AiLCJvblN0b3AiLCJfZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSIsInN1YnNjcmliZSIsIm9wdGlvbnMiLCJzdWJIYW5kbGUiLCJjb25uZWN0aW9uIiwiZmlyc3ROb2RlIiwibGFzdE5vZGUiLCJfZmlyZUNhbGxiYWNrcyIsInZpZXciLCJ3aGljaCIsIm5vbnJlYWN0aXZlIiwiZmlyZUNhbGxiYWNrcyIsImNicyIsIk4iLCJfY3JlYXRlVmlldyIsImZvckV4cGFuc2lvbiIsImRvRmlyc3RSZW5kZXIiLCJpbml0aWFsQ29udGVudCIsImRvbXJhbmdlIiwiX0RPTVJhbmdlIiwidGVhcmRvd25Ib29rIiwicmFuZ2UiLCJlbGVtZW50IiwiX0RPTUJhY2tlbmQiLCJUZWFyZG93biIsIm9uRWxlbWVudFRlYXJkb3duIiwidGVhcmRvd24iLCJfZGVzdHJveVZpZXciLCJfbWF0ZXJpYWxpemVWaWV3IiwiX3dvcmtTdGFjayIsIl9pbnRvQXJyYXkiLCJsYXN0SHRtbGpzIiwiZG9SZW5kZXIiLCJodG1sanMiLCJmaXJzdFJ1biIsIl9pc0NvbnRlbnRFcXVhbCIsImRvTWF0ZXJpYWxpemUiLCJyYW5nZXNBbmROb2RlcyIsIl9tYXRlcmlhbGl6ZURPTSIsInNldE1lbWJlcnMiLCJvbkludmFsaWRhdGUiLCJkZXN0cm95TWVtYmVycyIsInVuZGVmaW5lZCIsImluaXRpYWxDb250ZW50cyIsIl9leHBhbmRWaWV3IiwicmVzdWx0IiwiX2V4cGFuZCIsImFjdGl2ZSIsIl9IVE1MSlNFeHBhbmRlciIsIkhUTUwiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiZXh0ZW5kIiwiZGVmIiwidmlzaXRPYmplY3QiLCJjb25zdHJ1Y3RWaWV3IiwidmlzaXRBdHRyaWJ1dGVzIiwiYXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZSIsInZhbHVlIiwidGFnIiwiY3VycmVudFZpZXdJZlJlbmRlcmluZyIsImN1cnJlbnRWaWV3IiwidmlzaXQiLCJfZXhwYW5kQXR0cmlidXRlcyIsIl9za2lwTm9kZXMiLCJfZGVzdHJveU5vZGUiLCJub2RlIiwibm9kZVR5cGUiLCJ0ZWFyRG93bkVsZW1lbnQiLCJhIiwiYiIsIlJhdyIsIm9sZFZpZXciLCJjaGVja1JlbmRlckNvbnRlbnQiLCJjb250ZW50IiwiVmlzaXRvciIsImNvbnRlbnRBc1ZpZXciLCJjb250ZW50QXNGdW5jIiwiX19yb290Vmlld3MiLCJwYXJlbnRFbGVtZW50IiwibmV4dE5vZGUiLCJpbmRleE9mIiwic3BsaWNlIiwiYXR0YWNoIiwiaW5zZXJ0IiwicmVuZGVyV2l0aERhdGEiLCJkYXRhIiwiX1RlbXBsYXRlV2l0aCIsInJlbW92ZSIsImRlc3Ryb3kiLCJwYXJlbnRSYW5nZSIsImRldGFjaCIsInRvSFRNTCIsInRvSFRNTFdpdGhEYXRhIiwiX3RvVGV4dCIsInRleHRNb2RlIiwiVEVYVE1PREUiLCJTVFJJTkciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJ0b1RleHQiLCJnZXREYXRhIiwiZWxlbWVudE9yVmlldyIsInRoZVdpdGgiLCJnZXRWaWV3IiwiZGF0YVZhciIsImdldCIsImdldEVsZW1lbnREYXRhIiwiX3ZpZXdOYW1lIiwidmlld05hbWUiLCJfZ2V0Q3VycmVudFZpZXciLCJfZ2V0UGFyZW50VmlldyIsIl9nZXRFbGVtZW50VmlldyIsInYiLCJlbGVtIiwiZm9yRWxlbWVudCIsIl9hZGRFdmVudE1hcCIsImV2ZW50TWFwIiwidGhpc0luSGFuZGxlciIsImhhbmRsZXMiLCJhdHRhY2hlZF9ldmVudE1hcHMiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInNwZWMiLCJoYW5kbGVyIiwiY2xhdXNlcyIsInNwbGl0IiwiY2xhdXNlIiwicGFydHMiLCJuZXdFdmVudHMiLCJzaGlmdCIsInNlbGVjdG9yIiwiam9pbiIsIl9FdmVudFN1cHBvcnQiLCJsaXN0ZW4iLCJldnQiLCJjb250YWluc0VsZW1lbnQiLCJjdXJyZW50VGFyZ2V0IiwiaGFuZGxlclRoaXMiLCJoYW5kbGVyQXJncyIsInIiLCJoIiwiaGFzIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJpc09iamVjdCIsIl9jYWxjdWxhdGVDb25kaXRpb24iLCJjb25kIiwiaXNBcnJheSIsIldpdGgiLCJjb250ZW50RnVuYyIsIlJlYWN0aXZlVmFyIiwic2V0IiwiX2F0dGFjaEJpbmRpbmdzVG9WaWV3IiwiYmluZGluZ3MiLCJlbnRyaWVzIiwiYmluZGluZyIsIkxldCIsIklmIiwiY29uZGl0aW9uRnVuYyIsImVsc2VGdW5jIiwiX25vdCIsImNvbmRpdGlvblZhciIsIl9fY29uZGl0aW9uVmFyIiwiVW5sZXNzIiwiRWFjaCIsImFyZ0Z1bmMiLCJlYWNoVmlldyIsInN1YnZpZXdzIiwiaW5pdGlhbFN1YnZpZXdzIiwiZXhwYW5kZWRWYWx1ZURlcCIsIkRlcGVuZGVuY3kiLCJkZXBlbmQiLCJudW1JdGVtcyIsImluRWxzZU1vZGUiLCJzdG9wSGFuZGxlIiwiYXJnVmFyIiwidmFyaWFibGVOYW1lIiwidXBkYXRlSW5kaWNlcyIsImZyb20iLCJ0byIsIm1lbWJlcnMiLCJhcmciLCJfdmFyaWFibGUiLCJfc2VxdWVuY2UiLCJPYnNlcnZlU2VxdWVuY2UiLCJvYnNlcnZlIiwiYWRkZWRBdCIsImlkIiwiaXRlbSIsIm5ld0l0ZW1WaWV3IiwiY2hhbmdlZCIsInJlbW92ZU1lbWJlciIsImFkZE1lbWJlciIsInJlbW92ZWRBdCIsImNoYW5nZWRBdCIsIm5ld0l0ZW0iLCJvbGRJdGVtIiwiaXRlbVZpZXciLCJnZXRNZW1iZXIiLCJtb3ZlZFRvIiwiZnJvbUluZGV4IiwidG9JbmRleCIsIm1vdmVNZW1iZXIiLCJNYXRoIiwibWluIiwibWF4IiwidyIsIndyYXBwZWRBcmdGdW5jIiwidmlld1RvRXZhbHVhdGVBcmciLCJvcmlnaW5hbFBhcmVudFZpZXciLCJ3cmFwcGVkQ29udGVudEZ1bmMiLCJfX2lzVGVtcGxhdGVXaXRoIiwiX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIiwidGVtcGxhdGVWaWV3IiwiX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlIiwiX2dsb2JhbEhlbHBlcnMiLCJyZWdpc3RlckhlbHBlciIsImRlcmVnaXN0ZXJIZWxwZXIiLCJiaW5kSWZJc0Z1bmN0aW9uIiwidGFyZ2V0IiwiYmluZERhdGFDb250ZXh0IiwiX09MRFNUWUxFX0hFTFBFUiIsIl9nZXRUZW1wbGF0ZUhlbHBlciIsInRlbXBsYXRlIiwidG1wbEluc3RhbmNlRnVuYyIsImlzS25vd25PbGRTdHlsZUhlbHBlciIsIl9faGVscGVycyIsImhlbHBlciIsIndyYXBIZWxwZXIiLCJfTk9XQVJOX09MRFNUWUxFX0hFTFBFUlMiLCJ0ZW1wbGF0ZUZ1bmMiLCJfbGV4aWNhbEtlZXBHb2luZyIsIl9fc3RhcnRzTmV3TGV4aWNhbFNjb3BlIiwiX2xleGljYWxCaW5kaW5nTG9va3VwIiwiYmxvY2tIZWxwZXJzU3RhY2siLCJiaW5kaW5nUmVhY3RpdmVWYXIiLCJfZ2V0VGVtcGxhdGUiLCJ0ZW1wbGF0ZUluc3RhbmNlIiwiX2dldEdsb2JhbEhlbHBlciIsImxvb2t1cCIsIl9vcHRpb25zIiwibG9va3VwVGVtcGxhdGUiLCJib3VuZFRtcGxJbnN0YW5jZSIsImZvdW5kVGVtcGxhdGUiLCJ0ZXN0IiwiX3BhcmVudERhdGEiLCJpc0NhbGxlZEFzRnVuY3Rpb24iLCJjaGFyQXQiLCJoZWlnaHQiLCJfZnVuY3Rpb25XcmFwcGVkIiwiaXNGdW5jdGlvbiIsImlzRW1wdHkiLCJyZW5kZXJGdW5jdGlvbiIsIkhlbHBlck1hcCIsIl9fZXZlbnRNYXBzIiwiaXNUZW1wbGF0ZSIsInQiLCJvbkNyZWF0ZWQiLCJvblJlbmRlcmVkIiwib25EZXN0cm95ZWQiLCJfZ2V0Q2FsbGJhY2tzIiwiY2FsbGJhY2tzIiwiY29uY2F0IiwidGVtcGxhdGVDb250ZW50QmxvY2siLCJ0ZW1wbGF0ZUVsc2VCbG9jayIsImV2ZW50cyIsIm0iLCJfdGVtcGxhdGVJbnN0YW5jZSIsIlRlbXBsYXRlSW5zdGFuY2UiLCJpbnN0IiwiY3JlYXRlZENhbGxiYWNrcyIsInJlbmRlcmVkQ2FsbGJhY2tzIiwiZGVzdHJveWVkQ2FsbGJhY2tzIiwiX2FsbFN1YnNSZWFkeURlcCIsIl9hbGxTdWJzUmVhZHkiLCJfc3Vic2NyaXB0aW9uSGFuZGxlcyIsIiQiLCJmaW5kQWxsIiwiZmluZCIsInN1YkhhbmRsZXMiLCJsYXN0UGFyYW0iLCJsYXN0UGFyYW1PcHRpb25zUGF0dGVybiIsIm9uUmVhZHkiLCJNYXRjaCIsIk9wdGlvbmFsIiwib25FcnJvciIsIkFueSIsInBvcCIsIm9sZFN0b3BwZWQiLCJlcnJvciIsInN1YnNjcmlwdGlvbklkIiwic3Vic2NyaXB0aW9uc1JlYWR5IiwidmFsdWVzIiwiZXZlcnkiLCJoYW5kbGUiLCJyZWFkeSIsImhlbHBlcnMiLCJkaWN0IiwiayIsImNhblVzZUdldHRlcnMiLCJkZWZpbmVQcm9wZXJ0eSIsImN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyIsIm9sZFRtcGxJbnN0YW5jZUZ1bmMiLCJldmVudE1hcDIiLCJldmVudCIsImluc3RhbmNlIiwiY3VycmVudERhdGEiLCJwYXJlbnREYXRhIiwiVUkiLCJIYW5kbGViYXJzIiwi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bEM7QUFDQTtBQUNBZ1osVUFBVSxDQUFDQyxVQUFVLEdBQUcsVUFBU0MsTUFBTSxFQUFFO0VBQ3ZDLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNO0FBQ3RCLENBQUM7QUFDREYsVUFBVSxDQUFDQyxVQUFVLENBQUNyWSxTQUFTLENBQUN1WSxRQUFRLEdBQUcsWUFBVztFQUNwRCxPQUFPLElBQUksQ0FBQ0QsTUFBTSxDQUFDQyxRQUFRLEVBQUU7QUFDL0IsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9ibGF6ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG5hbWVzcGFjZSBCbGF6ZVxuICogQHN1bW1hcnkgVGhlIG5hbWVzcGFjZSBmb3IgYWxsIEJsYXplLXJlbGF0ZWQgbWV0aG9kcyBhbmQgY2xhc3Nlcy5cbiAqL1xuQmxhemUgPSB7fTtcblxuLy8gVXRpbGl0eSB0byBIVE1MLWVzY2FwZSBhIHN0cmluZy4gIEluY2x1ZGVkIGZvciBsZWdhY3kgcmVhc29ucy5cbi8vIFRPRE86IFNob3VsZCBiZSByZXBsYWNlZCB3aXRoIF8uZXNjYXBlIG9uY2UgdW5kZXJzY29yZSBpcyB1cGdyYWRlZCB0byBhIG5ld2VyXG4vLyAgICAgICB2ZXJzaW9uIHdoaWNoIGVzY2FwZXMgYCAoYmFja3RpY2spIGFzIHdlbGwuIFVuZGVyc2NvcmUgMS41LjIgZG9lcyBub3QuXG5CbGF6ZS5fZXNjYXBlID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZXNjYXBlX21hcCA9IHtcbiAgICBcIjxcIjogXCImbHQ7XCIsXG4gICAgXCI+XCI6IFwiJmd0O1wiLFxuICAgICdcIic6IFwiJnF1b3Q7XCIsXG4gICAgXCInXCI6IFwiJiN4Mjc7XCIsXG4gICAgXCIvXCI6IFwiJiN4MkY7XCIsXG4gICAgXCJgXCI6IFwiJiN4NjA7XCIsIC8qIElFIGFsbG93cyBiYWNrdGljay1kZWxpbWl0ZWQgYXR0cmlidXRlcz8/ICovXG4gICAgXCImXCI6IFwiJmFtcDtcIlxuICB9O1xuICB2YXIgZXNjYXBlX29uZSA9IGZ1bmN0aW9uKGMpIHtcbiAgICByZXR1cm4gZXNjYXBlX21hcFtjXTtcbiAgfTtcblxuICByZXR1cm4gZnVuY3Rpb24gKHgpIHtcbiAgICByZXR1cm4geC5yZXBsYWNlKC9bJjw+XCInYF0vZywgZXNjYXBlX29uZSk7XG4gIH07XG59KSgpO1xuXG5CbGF6ZS5fd2FybiA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgbXNnID0gJ1dhcm5pbmc6ICcgKyBtc2c7XG5cbiAgaWYgKCh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpICYmIGNvbnNvbGUud2Fybikge1xuICAgIGNvbnNvbGUud2Fybihtc2cpO1xuICB9XG59O1xuXG52YXIgbmF0aXZlQmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kO1xuXG4vLyBBbiBpbXBsZW1lbnRhdGlvbiBvZiBfLmJpbmQgd2hpY2ggYWxsb3dzIGJldHRlciBvcHRpbWl6YXRpb24uXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9wZXRrYWFudG9ub3YvYmx1ZWJpcmQvd2lraS9PcHRpbWl6YXRpb24ta2lsbGVycyMzLW1hbmFnaW5nLWFyZ3VtZW50c1xuaWYgKG5hdGl2ZUJpbmQpIHtcbiAgQmxhemUuX2JpbmQgPSBmdW5jdGlvbiAoZnVuYywgb2JqKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIHJldHVybiBuYXRpdmVCaW5kLmNhbGwoZnVuYywgb2JqKTtcbiAgICB9XG5cbiAgICAvLyBDb3B5IHRoZSBhcmd1bWVudHMgc28gdGhpcyBmdW5jdGlvbiBjYW4gYmUgb3B0aW1pemVkLlxuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBhcmdzLnNsaWNlKDEpKTtcbiAgfTtcbn1cbmVsc2Uge1xuICAvLyBBIHNsb3dlciBidXQgYmFja3dhcmRzIGNvbXBhdGlibGUgdmVyc2lvbi5cbiAgQmxhemUuX2JpbmQgPSBmdW5jdGlvbihvYmpBLCBvYmpCKSB7XG4gICAgb2JqQS5iaW5kKG9iakIpO1xuICB9O1xufVxuIiwidmFyIGRlYnVnRnVuYztcblxuLy8gV2UgY2FsbCBpbnRvIHVzZXIgY29kZSBpbiBtYW55IHBsYWNlcywgYW5kIGl0J3MgbmljZSB0byBjYXRjaCBleGNlcHRpb25zXG4vLyBwcm9wYWdhdGVkIGZyb20gdXNlciBjb2RlIGltbWVkaWF0ZWx5IHNvIHRoYXQgdGhlIHdob2xlIHN5c3RlbSBkb2Vzbid0IGp1c3Rcbi8vIGJyZWFrLiAgQ2F0Y2hpbmcgZXhjZXB0aW9ucyBpcyBlYXN5OyByZXBvcnRpbmcgdGhlbSBpcyBoYXJkLiAgVGhpcyBoZWxwZXJcbi8vIHJlcG9ydHMgZXhjZXB0aW9ucy5cbi8vXG4vLyBVc2FnZTpcbi8vXG4vLyBgYGBcbi8vIHRyeSB7XG4vLyAgIC8vIC4uLiBzb21lU3R1ZmYgLi4uXG4vLyB9IGNhdGNoIChlKSB7XG4vLyAgIHJlcG9ydFVJRXhjZXB0aW9uKGUpO1xuLy8gfVxuLy8gYGBgXG4vL1xuLy8gQW4gb3B0aW9uYWwgc2Vjb25kIGFyZ3VtZW50IG92ZXJyaWRlcyB0aGUgZGVmYXVsdCBtZXNzYWdlLlxuXG4vLyBTZXQgdGhpcyB0byBgdHJ1ZWAgdG8gY2F1c2UgYHJlcG9ydEV4Y2VwdGlvbmAgdG8gdGhyb3dcbi8vIHRoZSBuZXh0IGV4Y2VwdGlvbiByYXRoZXIgdGhhbiByZXBvcnRpbmcgaXQuICBUaGlzIGlzXG4vLyB1c2VmdWwgaW4gdW5pdCB0ZXN0cyB0aGF0IHRlc3QgZXJyb3IgbWVzc2FnZXMuXG5CbGF6ZS5fdGhyb3dOZXh0RXhjZXB0aW9uID0gZmFsc2U7XG5cbkJsYXplLl9yZXBvcnRFeGNlcHRpb24gPSBmdW5jdGlvbiAoZSwgbXNnKSB7XG4gIGlmIChCbGF6ZS5fdGhyb3dOZXh0RXhjZXB0aW9uKSB7XG4gICAgQmxhemUuX3Rocm93TmV4dEV4Y2VwdGlvbiA9IGZhbHNlO1xuICAgIHRocm93IGU7XG4gIH1cblxuICBpZiAoISBkZWJ1Z0Z1bmMpXG4gICAgLy8gYWRhcHRlZCBmcm9tIFRyYWNrZXJcbiAgICBkZWJ1Z0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gKHR5cGVvZiBNZXRlb3IgIT09IFwidW5kZWZpbmVkXCIgPyBNZXRlb3IuX2RlYnVnIDpcbiAgICAgICAgICAgICAgKCh0eXBlb2YgY29uc29sZSAhPT0gXCJ1bmRlZmluZWRcIikgJiYgY29uc29sZS5sb2cgPyBjb25zb2xlLmxvZyA6XG4gICAgICAgICAgICAgICBmdW5jdGlvbiAoKSB7fSkpO1xuICAgIH07XG5cbiAgLy8gSW4gQ2hyb21lLCBgZS5zdGFja2AgaXMgYSBtdWx0aWxpbmUgc3RyaW5nIHRoYXQgc3RhcnRzIHdpdGggdGhlIG1lc3NhZ2VcbiAgLy8gYW5kIGNvbnRhaW5zIGEgc3RhY2sgdHJhY2UuICBGdXJ0aGVybW9yZSwgYGNvbnNvbGUubG9nYCBtYWtlcyBpdCBjbGlja2FibGUuXG4gIC8vIGBjb25zb2xlLmxvZ2Agc3VwcGxpZXMgdGhlIHNwYWNlIGJldHdlZW4gdGhlIHR3byBhcmd1bWVudHMuXG4gIGRlYnVnRnVuYygpKG1zZyB8fCAnRXhjZXB0aW9uIGNhdWdodCBpbiB0ZW1wbGF0ZTonLCBlLnN0YWNrIHx8IGUubWVzc2FnZSB8fCBlKTtcbn07XG5cbkJsYXplLl93cmFwQ2F0Y2hpbmdFeGNlcHRpb25zID0gZnVuY3Rpb24gKGYsIHdoZXJlKSB7XG4gIGlmICh0eXBlb2YgZiAhPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gZjtcblxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIEJsYXplLl9yZXBvcnRFeGNlcHRpb24oZSwgJ0V4Y2VwdGlvbiBpbiAnICsgd2hlcmUgKyAnOicpO1xuICAgIH1cbiAgfTtcbn07XG4iLCIvLy8gW25ld10gQmxhemUuVmlldyhbbmFtZV0sIHJlbmRlck1ldGhvZClcbi8vL1xuLy8vIEJsYXplLlZpZXcgaXMgdGhlIGJ1aWxkaW5nIGJsb2NrIG9mIHJlYWN0aXZlIERPTS4gIFZpZXdzIGhhdmVcbi8vLyB0aGUgZm9sbG93aW5nIGZlYXR1cmVzOlxuLy8vXG4vLy8gKiBsaWZlY3ljbGUgY2FsbGJhY2tzIC0gVmlld3MgYXJlIGNyZWF0ZWQsIHJlbmRlcmVkLCBhbmQgZGVzdHJveWVkLFxuLy8vICAgYW5kIGNhbGxiYWNrcyBjYW4gYmUgcmVnaXN0ZXJlZCB0byBmaXJlIHdoZW4gdGhlc2UgdGhpbmdzIGhhcHBlbi5cbi8vL1xuLy8vICogcGFyZW50IHBvaW50ZXIgLSBBIFZpZXcgcG9pbnRzIHRvIGl0cyBwYXJlbnRWaWV3LCB3aGljaCBpcyB0aGVcbi8vLyAgIFZpZXcgdGhhdCBjYXVzZWQgaXQgdG8gYmUgcmVuZGVyZWQuICBUaGVzZSBwb2ludGVycyBmb3JtIGFcbi8vLyAgIGhpZXJhcmNoeSBvciB0cmVlIG9mIFZpZXdzLlxuLy8vXG4vLy8gKiByZW5kZXIoKSBtZXRob2QgLSBBIFZpZXcncyByZW5kZXIoKSBtZXRob2Qgc3BlY2lmaWVzIHRoZSBET01cbi8vLyAgIChvciBIVE1MKSBjb250ZW50IG9mIHRoZSBWaWV3LiAgSWYgdGhlIG1ldGhvZCBlc3RhYmxpc2hlc1xuLy8vICAgcmVhY3RpdmUgZGVwZW5kZW5jaWVzLCBpdCBtYXkgYmUgcmUtcnVuLlxuLy8vXG4vLy8gKiBhIERPTVJhbmdlIC0gSWYgYSBWaWV3IGlzIHJlbmRlcmVkIHRvIERPTSwgaXRzIHBvc2l0aW9uIGFuZFxuLy8vICAgZXh0ZW50IGluIHRoZSBET00gYXJlIHRyYWNrZWQgdXNpbmcgYSBET01SYW5nZSBvYmplY3QuXG4vLy9cbi8vLyBXaGVuIGEgVmlldyBpcyBjb25zdHJ1Y3RlZCBieSBjYWxsaW5nIEJsYXplLlZpZXcsIHRoZSBWaWV3IGlzXG4vLy8gbm90IHlldCBjb25zaWRlcmVkIFwiY3JlYXRlZC5cIiAgSXQgZG9lc24ndCBoYXZlIGEgcGFyZW50VmlldyB5ZXQsXG4vLy8gYW5kIG5vIGxvZ2ljIGhhcyBiZWVuIHJ1biB0byBpbml0aWFsaXplIHRoZSBWaWV3LiAgQWxsIHJlYWxcbi8vLyB3b3JrIGlzIGRlZmVycmVkIHVudGlsIGF0IGxlYXN0IGNyZWF0aW9uIHRpbWUsIHdoZW4gdGhlIG9uVmlld0NyZWF0ZWRcbi8vLyBjYWxsYmFja3MgYXJlIGZpcmVkLCB3aGljaCBoYXBwZW5zIHdoZW4gdGhlIFZpZXcgaXMgXCJ1c2VkXCIgaW5cbi8vLyBzb21lIHdheSB0aGF0IHJlcXVpcmVzIGl0IHRvIGJlIHJlbmRlcmVkLlxuLy8vXG4vLy8gLi4ubW9yZSBsaWZlY3ljbGUgc3R1ZmZcbi8vL1xuLy8vIGBuYW1lYCBpcyBhbiBvcHRpb25hbCBzdHJpbmcgdGFnIGlkZW50aWZ5aW5nIHRoZSBWaWV3LiAgVGhlIG9ubHlcbi8vLyB0aW1lIGl0J3MgdXNlZCBpcyB3aGVuIGxvb2tpbmcgaW4gdGhlIFZpZXcgdHJlZSBmb3IgYSBWaWV3IG9mIGFcbi8vLyBwYXJ0aWN1bGFyIG5hbWU7IGZvciBleGFtcGxlLCBkYXRhIGNvbnRleHRzIGFyZSBzdG9yZWQgb24gVmlld3Ncbi8vLyBvZiBuYW1lIFwid2l0aFwiLiAgTmFtZXMgYXJlIGFsc28gdXNlZnVsIHdoZW4gZGVidWdnaW5nLCBzbyBpblxuLy8vIGdlbmVyYWwgaXQncyBnb29kIGZvciBmdW5jdGlvbnMgdGhhdCBjcmVhdGUgVmlld3MgdG8gc2V0IHRoZSBuYW1lLlxuLy8vIFZpZXdzIGFzc29jaWF0ZWQgd2l0aCB0ZW1wbGF0ZXMgaGF2ZSBuYW1lcyBvZiB0aGUgZm9ybSBcIlRlbXBsYXRlLmZvb1wiLlxuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgVmlldywgd2hpY2ggcmVwcmVzZW50cyBhIHJlYWN0aXZlIHJlZ2lvbiBvZiBET00uXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gW25hbWVdIE9wdGlvbmFsLiAgQSBuYW1lIGZvciB0aGlzIHR5cGUgb2YgVmlldy4gIFNlZSBbYHZpZXcubmFtZWBdKCN2aWV3X25hbWUpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVuZGVyRnVuY3Rpb24gQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS4gIEluIHRoaXMgZnVuY3Rpb24sIGB0aGlzYCBpcyBib3VuZCB0byB0aGUgVmlldy5cbiAqL1xuQmxhemUuVmlldyA9IGZ1bmN0aW9uIChuYW1lLCByZW5kZXIpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVmlldyhuYW1lLCByZW5kZXIpO1xuXG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIC8vIG9taXR0ZWQgXCJuYW1lXCIgYXJndW1lbnRcbiAgICByZW5kZXIgPSBuYW1lO1xuICAgIG5hbWUgPSAnJztcbiAgfVxuICB0aGlzLm5hbWUgPSBuYW1lO1xuICB0aGlzLl9yZW5kZXIgPSByZW5kZXI7XG5cbiAgdGhpcy5fY2FsbGJhY2tzID0ge1xuICAgIGNyZWF0ZWQ6IG51bGwsXG4gICAgcmVuZGVyZWQ6IG51bGwsXG4gICAgZGVzdHJveWVkOiBudWxsXG4gIH07XG5cbiAgLy8gU2V0dGluZyBhbGwgcHJvcGVydGllcyBoZXJlIGlzIGdvb2QgZm9yIHJlYWRhYmlsaXR5LFxuICAvLyBhbmQgYWxzbyBtYXkgaGVscCBDaHJvbWUgb3B0aW1pemUgdGhlIGNvZGUgYnkga2VlcGluZ1xuICAvLyB0aGUgVmlldyBvYmplY3QgZnJvbSBjaGFuZ2luZyBzaGFwZSB0b28gbXVjaC5cbiAgdGhpcy5pc0NyZWF0ZWQgPSBmYWxzZTtcbiAgdGhpcy5faXNDcmVhdGVkRm9yRXhwYW5zaW9uID0gZmFsc2U7XG4gIHRoaXMuaXNSZW5kZXJlZCA9IGZhbHNlO1xuICB0aGlzLl9pc0F0dGFjaGVkID0gZmFsc2U7XG4gIHRoaXMuaXNEZXN0cm95ZWQgPSBmYWxzZTtcbiAgdGhpcy5faXNJblJlbmRlciA9IGZhbHNlO1xuICB0aGlzLnBhcmVudFZpZXcgPSBudWxsO1xuICB0aGlzLl9kb21yYW5nZSA9IG51bGw7XG4gIC8vIFRoaXMgZmxhZyBpcyBub3JtYWxseSBzZXQgdG8gZmFsc2UgZXhjZXB0IGZvciB0aGUgY2FzZXMgd2hlbiB2aWV3J3MgcGFyZW50XG4gIC8vIHdhcyBnZW5lcmF0ZWQgYXMgcGFydCBvZiBleHBhbmRpbmcgc29tZSBzeW50YWN0aWMgc3VnYXIgZXhwcmVzc2lvbnMgb3JcbiAgLy8gbWV0aG9kcy5cbiAgLy8gRXguOiBCbGF6ZS5yZW5kZXJXaXRoRGF0YSBpcyBhbiBlcXVpdmFsZW50IHRvIGNyZWF0aW5nIGEgdmlldyB3aXRoIHJlZ3VsYXJcbiAgLy8gQmxhemUucmVuZGVyIGFuZCB3cmFwcGluZyBpdCBpbnRvIHt7I3dpdGggZGF0YX19e3svd2l0aH19IHZpZXcuIFNpbmNlIHRoZVxuICAvLyB1c2VycyBkb24ndCBrbm93IGFueXRoaW5nIGFib3V0IHRoZXNlIGdlbmVyYXRlZCBwYXJlbnQgdmlld3MsIEJsYXplIG5lZWRzXG4gIC8vIHRoaXMgaW5mb3JtYXRpb24gdG8gYmUgYXZhaWxhYmxlIG9uIHZpZXdzIHRvIG1ha2Ugc21hcnRlciBkZWNpc2lvbnMuIEZvclxuICAvLyBleGFtcGxlOiByZW1vdmluZyB0aGUgZ2VuZXJhdGVkIHBhcmVudCB2aWV3IHdpdGggdGhlIHZpZXcgb24gQmxhemUucmVtb3ZlLlxuICB0aGlzLl9oYXNHZW5lcmF0ZWRQYXJlbnQgPSBmYWxzZTtcbiAgLy8gQmluZGluZ3MgYWNjZXNzaWJsZSB0byBjaGlsZHJlbiB2aWV3cyAodmlhIHZpZXcubG9va3VwKCduYW1lJykpIHdpdGhpbiB0aGVcbiAgLy8gY2xvc2VzdCB0ZW1wbGF0ZSB2aWV3LlxuICB0aGlzLl9zY29wZUJpbmRpbmdzID0ge307XG5cbiAgdGhpcy5yZW5kZXJDb3VudCA9IDA7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fcmVuZGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gbnVsbDsgfTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUub25WaWV3Q3JlYXRlZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZCA9IHRoaXMuX2NhbGxiYWNrcy5jcmVhdGVkIHx8IFtdO1xuICB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZC5wdXNoKGNiKTtcbn07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLl9vblZpZXdSZW5kZXJlZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MucmVuZGVyZWQgPSB0aGlzLl9jYWxsYmFja3MucmVuZGVyZWQgfHwgW107XG4gIHRoaXMuX2NhbGxiYWNrcy5yZW5kZXJlZC5wdXNoKGNiKTtcbn07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld1JlYWR5ID0gZnVuY3Rpb24gKGNiKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGZpcmUgPSBmdW5jdGlvbiAoKSB7XG4gICAgVHJhY2tlci5hZnRlckZsdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghIHNlbGYuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgQmxhemUuX3dpdGhDdXJyZW50VmlldyhzZWxmLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY2IuY2FsbChzZWxmKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG4gIHNlbGYuX29uVmlld1JlbmRlcmVkKGZ1bmN0aW9uIG9uVmlld1JlbmRlcmVkKCkge1xuICAgIGlmIChzZWxmLmlzRGVzdHJveWVkKVxuICAgICAgcmV0dXJuO1xuICAgIGlmICghIHNlbGYuX2RvbXJhbmdlLmF0dGFjaGVkKVxuICAgICAgc2VsZi5fZG9tcmFuZ2Uub25BdHRhY2hlZChmaXJlKTtcbiAgICBlbHNlXG4gICAgICBmaXJlKCk7XG4gIH0pO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUub25WaWV3RGVzdHJveWVkID0gZnVuY3Rpb24gKGNiKSB7XG4gIHRoaXMuX2NhbGxiYWNrcy5kZXN0cm95ZWQgPSB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkIHx8IFtdO1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkLnB1c2goY2IpO1xufTtcbkJsYXplLlZpZXcucHJvdG90eXBlLnJlbW92ZVZpZXdEZXN0cm95ZWRMaXN0ZW5lciA9IGZ1bmN0aW9uIChjYikge1xuICB2YXIgZGVzdHJveWVkID0gdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZDtcbiAgaWYgKCEgZGVzdHJveWVkKVxuICAgIHJldHVybjtcbiAgdmFyIGluZGV4ID0gZGVzdHJveWVkLmxhc3RJbmRleE9mKGNiKTtcbiAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgIC8vIFhYWCBZb3UnZCB0aGluayB0aGUgcmlnaHQgdGhpbmcgdG8gZG8gd291bGQgYmUgc3BsaWNlLCBidXQgX2ZpcmVDYWxsYmFja3NcbiAgICAvLyBnZXRzIHNhZCBpZiB5b3UgcmVtb3ZlIGNhbGxiYWNrcyB3aGlsZSBpdGVyYXRpbmcgb3ZlciB0aGUgbGlzdC4gIFNob3VsZFxuICAgIC8vIGNoYW5nZSB0aGlzIHRvIHVzZSBjYWxsYmFjay1ob29rIG9yIEV2ZW50RW1pdHRlciBvciBzb21ldGhpbmcgZWxzZSB0aGF0XG4gICAgLy8gcHJvcGVybHkgc3VwcG9ydHMgcmVtb3ZhbC5cbiAgICBkZXN0cm95ZWRbaW5kZXhdID0gbnVsbDtcbiAgfVxufTtcblxuLy8vIFZpZXcjYXV0b3J1bihmdW5jKVxuLy8vXG4vLy8gU2V0cyB1cCBhIFRyYWNrZXIgYXV0b3J1biB0aGF0IGlzIFwic2NvcGVkXCIgdG8gdGhpcyBWaWV3IGluIHR3b1xuLy8vIGltcG9ydGFudCB3YXlzOiAxKSBCbGF6ZS5jdXJyZW50VmlldyBpcyBhdXRvbWF0aWNhbGx5IHNldFxuLy8vIG9uIGV2ZXJ5IHJlLXJ1biwgYW5kIDIpIHRoZSBhdXRvcnVuIGlzIHN0b3BwZWQgd2hlbiB0aGVcbi8vLyBWaWV3IGlzIGRlc3Ryb3llZC4gIEFzIHdpdGggVHJhY2tlci5hdXRvcnVuLCB0aGUgZmlyc3QgcnVuIG9mXG4vLy8gdGhlIGZ1bmN0aW9uIGlzIGltbWVkaWF0ZSwgYW5kIGEgQ29tcHV0YXRpb24gb2JqZWN0IHRoYXQgY2FuXG4vLy8gYmUgdXNlZCB0byBzdG9wIHRoZSBhdXRvcnVuIGlzIHJldHVybmVkLlxuLy8vXG4vLy8gVmlldyNhdXRvcnVuIGlzIG1lYW50IHRvIGJlIGNhbGxlZCBmcm9tIFZpZXcgY2FsbGJhY2tzIGxpa2Vcbi8vLyBvblZpZXdDcmVhdGVkLCBvciBmcm9tIG91dHNpZGUgdGhlIHJlbmRlcmluZyBwcm9jZXNzLiAgSXQgbWF5IG5vdFxuLy8vIGJlIGNhbGxlZCBiZWZvcmUgdGhlIG9uVmlld0NyZWF0ZWQgY2FsbGJhY2tzIGFyZSBmaXJlZCAodG9vIGVhcmx5KSxcbi8vLyBvciBmcm9tIGEgcmVuZGVyKCkgbWV0aG9kICh0b28gY29uZnVzaW5nKS5cbi8vL1xuLy8vIFR5cGljYWxseSwgYXV0b3J1bnMgdGhhdCB1cGRhdGUgdGhlIHN0YXRlXG4vLy8gb2YgdGhlIFZpZXcgKGFzIGluIEJsYXplLldpdGgpIHNob3VsZCBiZSBzdGFydGVkIGZyb20gYW4gb25WaWV3Q3JlYXRlZFxuLy8vIGNhbGxiYWNrLiAgQXV0b3J1bnMgdGhhdCB1cGRhdGUgdGhlIERPTSBzaG91bGQgYmUgc3RhcnRlZFxuLy8vIGZyb20gZWl0aGVyIG9uVmlld0NyZWF0ZWQgKGd1YXJkZWQgYWdhaW5zdCB0aGUgYWJzZW5jZSBvZlxuLy8vIHZpZXcuX2RvbXJhbmdlKSwgb3Igb25WaWV3UmVhZHkuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5hdXRvcnVuID0gZnVuY3Rpb24gKGYsIF9pblZpZXdTY29wZSwgZGlzcGxheU5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFRoZSByZXN0cmljdGlvbnMgb24gd2hlbiBWaWV3I2F1dG9ydW4gY2FuIGJlIGNhbGxlZCBhcmUgaW4gb3JkZXJcbiAgLy8gdG8gYXZvaWQgYmFkIHBhdHRlcm5zLCBsaWtlIGNyZWF0aW5nIGEgQmxhemUuVmlldyBhbmQgaW1tZWRpYXRlbHlcbiAgLy8gY2FsbGluZyBhdXRvcnVuIG9uIGl0LiAgQSBmcmVzaGx5IGNyZWF0ZWQgVmlldyBpcyBub3QgcmVhZHkgdG9cbiAgLy8gaGF2ZSBsb2dpYyBydW4gb24gaXQ7IGl0IGRvZXNuJ3QgaGF2ZSBhIHBhcmVudFZpZXcsIGZvciBleGFtcGxlLlxuICAvLyBJdCdzIHdoZW4gdGhlIFZpZXcgaXMgbWF0ZXJpYWxpemVkIG9yIGV4cGFuZGVkIHRoYXQgdGhlIG9uVmlld0NyZWF0ZWRcbiAgLy8gaGFuZGxlcnMgYXJlIGZpcmVkIGFuZCB0aGUgVmlldyBzdGFydHMgdXAuXG4gIC8vXG4gIC8vIExldHRpbmcgdGhlIHJlbmRlcigpIG1ldGhvZCBjYWxsIGB0aGlzLmF1dG9ydW4oKWAgaXMgcHJvYmxlbWF0aWNcbiAgLy8gYmVjYXVzZSBvZiByZS1yZW5kZXIuICBUaGUgYmVzdCB3ZSBjYW4gZG8gaXMgdG8gc3RvcCB0aGUgb2xkXG4gIC8vIGF1dG9ydW4gYW5kIHN0YXJ0IGEgbmV3IG9uZSBmb3IgZWFjaCByZW5kZXIsIGJ1dCB0aGF0J3MgYSBwYXR0ZXJuXG4gIC8vIHdlIHRyeSB0byBhdm9pZCBpbnRlcm5hbGx5IGJlY2F1c2UgaXQgbGVhZHMgdG8gaGVscGVycyBiZWluZ1xuICAvLyBjYWxsZWQgZXh0cmEgdGltZXMsIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBhdXRvcnVuIGNhdXNlcyB0aGVcbiAgLy8gdmlldyB0byByZS1yZW5kZXIgKGFuZCB0aHVzIHRoZSBhdXRvcnVuIHRvIGJlIHRvcm4gZG93biBhbmQgYVxuICAvLyBuZXcgb25lIGVzdGFibGlzaGVkKS5cbiAgLy9cbiAgLy8gV2UgY291bGQgbGlmdCB0aGVzZSByZXN0cmljdGlvbnMgaW4gdmFyaW91cyB3YXlzLiAgT25lIGludGVyZXN0aW5nXG4gIC8vIGlkZWEgaXMgdG8gYWxsb3cgeW91IHRvIGNhbGwgYHZpZXcuYXV0b3J1bmAgYWZ0ZXIgaW5zdGFudGlhdGluZ1xuICAvLyBgdmlld2AsIGFuZCBhdXRvbWF0aWNhbGx5IHdyYXAgaXQgaW4gYHZpZXcub25WaWV3Q3JlYXRlZGAsIGRlZmVycmluZ1xuICAvLyB0aGUgYXV0b3J1biBzbyB0aGF0IGl0IHN0YXJ0cyBhdCBhbiBhcHByb3ByaWF0ZSB0aW1lLiAgSG93ZXZlcixcbiAgLy8gdGhlbiB3ZSBjYW4ndCByZXR1cm4gdGhlIENvbXB1dGF0aW9uIG9iamVjdCB0byB0aGUgY2FsbGVyLCBiZWNhdXNlXG4gIC8vIGl0IGRvZXNuJ3QgZXhpc3QgeWV0LlxuICBpZiAoISBzZWxmLmlzQ3JlYXRlZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcjYXV0b3J1biBtdXN0IGJlIGNhbGxlZCBmcm9tIHRoZSBjcmVhdGVkIGNhbGxiYWNrIGF0IHRoZSBlYXJsaWVzdFwiKTtcbiAgfVxuICBpZiAodGhpcy5faXNJblJlbmRlcikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNhbGwgVmlldyNhdXRvcnVuIGZyb20gaW5zaWRlIHJlbmRlcigpOyB0cnkgY2FsbGluZyBpdCBmcm9tIHRoZSBjcmVhdGVkIG9yIHJlbmRlcmVkIGNhbGxiYWNrXCIpO1xuICB9XG5cbiAgdmFyIHRlbXBsYXRlSW5zdGFuY2VGdW5jID0gQmxhemUuVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYztcblxuICB2YXIgZnVuYyA9IGZ1bmN0aW9uIHZpZXdBdXRvcnVuKGMpIHtcbiAgICByZXR1cm4gQmxhemUuX3dpdGhDdXJyZW50VmlldyhfaW5WaWV3U2NvcGUgfHwgc2VsZiwgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIEJsYXplLlRlbXBsYXRlLl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmMoXG4gICAgICAgIHRlbXBsYXRlSW5zdGFuY2VGdW5jLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIGYuY2FsbChzZWxmLCBjKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gR2l2ZSB0aGUgYXV0b3J1biBmdW5jdGlvbiBhIGJldHRlciBuYW1lIGZvciBkZWJ1Z2dpbmcgYW5kIHByb2ZpbGluZy5cbiAgLy8gVGhlIGBkaXNwbGF5TmFtZWAgcHJvcGVydHkgaXMgbm90IHBhcnQgb2YgdGhlIHNwZWMgYnV0IGJyb3dzZXJzIGxpa2UgQ2hyb21lXG4gIC8vIGFuZCBGaXJlZm94IHByZWZlciBpdCBpbiBkZWJ1Z2dlcnMgb3ZlciB0aGUgbmFtZSBmdW5jdGlvbiB3YXMgZGVjbGFyZWQgYnkuXG4gIGZ1bmMuZGlzcGxheU5hbWUgPVxuICAgIChzZWxmLm5hbWUgfHwgJ2Fub255bW91cycpICsgJzonICsgKGRpc3BsYXlOYW1lIHx8ICdhbm9ueW1vdXMnKTtcbiAgdmFyIGNvbXAgPSBUcmFja2VyLmF1dG9ydW4oZnVuYyk7XG5cbiAgdmFyIHN0b3BDb21wdXRhdGlvbiA9IGZ1bmN0aW9uICgpIHsgY29tcC5zdG9wKCk7IH07XG4gIHNlbGYub25WaWV3RGVzdHJveWVkKHN0b3BDb21wdXRhdGlvbik7XG4gIGNvbXAub25TdG9wKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLnJlbW92ZVZpZXdEZXN0cm95ZWRMaXN0ZW5lcihzdG9wQ29tcHV0YXRpb24pO1xuICB9KTtcblxuICByZXR1cm4gY29tcDtcbn07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLl9lcnJvcklmU2hvdWxkbnRDYWxsU3Vic2NyaWJlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgc2VsZi5pc0NyZWF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJWaWV3I3N1YnNjcmliZSBtdXN0IGJlIGNhbGxlZCBmcm9tIHRoZSBjcmVhdGVkIGNhbGxiYWNrIGF0IHRoZSBlYXJsaWVzdFwiKTtcbiAgfVxuICBpZiAoc2VsZi5faXNJblJlbmRlcikge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNhbGwgVmlldyNzdWJzY3JpYmUgZnJvbSBpbnNpZGUgcmVuZGVyKCk7IHRyeSBjYWxsaW5nIGl0IGZyb20gdGhlIGNyZWF0ZWQgb3IgcmVuZGVyZWQgY2FsbGJhY2tcIik7XG4gIH1cbiAgaWYgKHNlbGYuaXNEZXN0cm95ZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjc3Vic2NyaWJlIGZyb20gaW5zaWRlIHRoZSBkZXN0cm95ZWQgY2FsbGJhY2ssIHRyeSBjYWxsaW5nIGl0IGluc2lkZSBjcmVhdGVkIG9yIHJlbmRlcmVkLlwiKTtcbiAgfVxufTtcblxuLyoqXG4gKiBKdXN0IGxpa2UgQmxhemUuVmlldyNhdXRvcnVuLCBidXQgd2l0aCBNZXRlb3Iuc3Vic2NyaWJlIGluc3RlYWQgb2ZcbiAqIFRyYWNrZXIuYXV0b3J1bi4gU3RvcCB0aGUgc3Vic2NyaXB0aW9uIHdoZW4gdGhlIHZpZXcgaXMgZGVzdHJveWVkLlxuICogQHJldHVybiB7U3Vic2NyaXB0aW9uSGFuZGxlfSBBIGhhbmRsZSB0byB0aGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgeW91IGNhblxuICogc2VlIGlmIGl0IGlzIHJlYWR5LCBvciBzdG9wIGl0IG1hbnVhbGx5XG4gKi9cbkJsYXplLlZpZXcucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uIChhcmdzLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgc2VsZi5fZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSgpO1xuXG4gIHZhciBzdWJIYW5kbGU7XG4gIGlmIChvcHRpb25zLmNvbm5lY3Rpb24pIHtcbiAgICBzdWJIYW5kbGUgPSBvcHRpb25zLmNvbm5lY3Rpb24uc3Vic2NyaWJlLmFwcGx5KG9wdGlvbnMuY29ubmVjdGlvbiwgYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgc3ViSGFuZGxlID0gTWV0ZW9yLnN1YnNjcmliZS5hcHBseShNZXRlb3IsIGFyZ3MpO1xuICB9XG5cbiAgc2VsZi5vblZpZXdEZXN0cm95ZWQoZnVuY3Rpb24gKCkge1xuICAgIHN1YkhhbmRsZS5zdG9wKCk7XG4gIH0pO1xuXG4gIHJldHVybiBzdWJIYW5kbGU7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5maXJzdE5vZGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghIHRoaXMuX2lzQXR0YWNoZWQpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGJlIGF0dGFjaGVkIGJlZm9yZSBhY2Nlc3NpbmcgaXRzIERPTVwiKTtcblxuICByZXR1cm4gdGhpcy5fZG9tcmFuZ2UuZmlyc3ROb2RlKCk7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5sYXN0Tm9kZSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKCEgdGhpcy5faXNBdHRhY2hlZClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJWaWV3IG11c3QgYmUgYXR0YWNoZWQgYmVmb3JlIGFjY2Vzc2luZyBpdHMgRE9NXCIpO1xuXG4gIHJldHVybiB0aGlzLl9kb21yYW5nZS5sYXN0Tm9kZSgpO1xufTtcblxuQmxhemUuX2ZpcmVDYWxsYmFja3MgPSBmdW5jdGlvbiAodmlldywgd2hpY2gpIHtcbiAgQmxhemUuX3dpdGhDdXJyZW50Vmlldyh2aWV3LCBmdW5jdGlvbiAoKSB7XG4gICAgVHJhY2tlci5ub25yZWFjdGl2ZShmdW5jdGlvbiBmaXJlQ2FsbGJhY2tzKCkge1xuICAgICAgdmFyIGNicyA9IHZpZXcuX2NhbGxiYWNrc1t3aGljaF07XG4gICAgICBmb3IgKHZhciBpID0gMCwgTiA9IChjYnMgJiYgY2JzLmxlbmd0aCk7IGkgPCBOOyBpKyspXG4gICAgICAgIGNic1tpXSAmJiBjYnNbaV0uY2FsbCh2aWV3KTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG5CbGF6ZS5fY3JlYXRlVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3LCBmb3JFeHBhbnNpb24pIHtcbiAgaWYgKHZpZXcuaXNDcmVhdGVkKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHJlbmRlciB0aGUgc2FtZSBWaWV3IHR3aWNlXCIpO1xuXG4gIHZpZXcucGFyZW50VmlldyA9IChwYXJlbnRWaWV3IHx8IG51bGwpO1xuICB2aWV3LmlzQ3JlYXRlZCA9IHRydWU7XG4gIGlmIChmb3JFeHBhbnNpb24pXG4gICAgdmlldy5faXNDcmVhdGVkRm9yRXhwYW5zaW9uID0gdHJ1ZTtcblxuICBCbGF6ZS5fZmlyZUNhbGxiYWNrcyh2aWV3LCAnY3JlYXRlZCcpO1xufTtcblxudmFyIGRvRmlyc3RSZW5kZXIgPSBmdW5jdGlvbiAodmlldywgaW5pdGlhbENvbnRlbnQpIHtcbiAgdmFyIGRvbXJhbmdlID0gbmV3IEJsYXplLl9ET01SYW5nZShpbml0aWFsQ29udGVudCk7XG4gIHZpZXcuX2RvbXJhbmdlID0gZG9tcmFuZ2U7XG4gIGRvbXJhbmdlLnZpZXcgPSB2aWV3O1xuICB2aWV3LmlzUmVuZGVyZWQgPSB0cnVlO1xuICBCbGF6ZS5fZmlyZUNhbGxiYWNrcyh2aWV3LCAncmVuZGVyZWQnKTtcblxuICB2YXIgdGVhcmRvd25Ib29rID0gbnVsbDtcblxuICBkb21yYW5nZS5vbkF0dGFjaGVkKGZ1bmN0aW9uIGF0dGFjaGVkKHJhbmdlLCBlbGVtZW50KSB7XG4gICAgdmlldy5faXNBdHRhY2hlZCA9IHRydWU7XG5cbiAgICB0ZWFyZG93bkhvb2sgPSBCbGF6ZS5fRE9NQmFja2VuZC5UZWFyZG93bi5vbkVsZW1lbnRUZWFyZG93bihcbiAgICAgIGVsZW1lbnQsIGZ1bmN0aW9uIHRlYXJkb3duKCkge1xuICAgICAgICBCbGF6ZS5fZGVzdHJveVZpZXcodmlldywgdHJ1ZSAvKiBfc2tpcE5vZGVzICovKTtcbiAgICAgIH0pO1xuICB9KTtcblxuICAvLyB0ZWFyIGRvd24gdGhlIHRlYXJkb3duIGhvb2tcbiAgdmlldy5vblZpZXdEZXN0cm95ZWQoZnVuY3Rpb24gKCkge1xuICAgIHRlYXJkb3duSG9vayAmJiB0ZWFyZG93bkhvb2suc3RvcCgpO1xuICAgIHRlYXJkb3duSG9vayA9IG51bGw7XG4gIH0pO1xuXG4gIHJldHVybiBkb21yYW5nZTtcbn07XG5cbi8vIFRha2UgYW4gdW5jcmVhdGVkIFZpZXcgYHZpZXdgIGFuZCBjcmVhdGUgYW5kIHJlbmRlciBpdCB0byBET00sXG4vLyBzZXR0aW5nIHVwIHRoZSBhdXRvcnVuIHRoYXQgdXBkYXRlcyB0aGUgVmlldy4gIFJldHVybnMgYSBuZXdcbi8vIERPTVJhbmdlLCB3aGljaCBoYXMgYmVlbiBhc3NvY2lhdGVkIHdpdGggdGhlIFZpZXcuXG4vL1xuLy8gVGhlIHByaXZhdGUgYXJndW1lbnRzIGBfd29ya1N0YWNrYCBhbmQgYF9pbnRvQXJyYXlgIGFyZSBwYXNzZWQgaW5cbi8vIGJ5IEJsYXplLl9tYXRlcmlhbGl6ZURPTSBhbmQgYXJlIG9ubHkgcHJlc2VudCBmb3IgcmVjdXJzaXZlIGNhbGxzXG4vLyAod2hlbiB0aGVyZSBpcyBzb21lIG90aGVyIF9tYXRlcmlhbGl6ZVZpZXcgb24gdGhlIHN0YWNrKS4gIElmXG4vLyBwcm92aWRlZCwgdGhlbiB3ZSBhdm9pZCB0aGUgbXV0dWFsIHJlY3Vyc2lvbiBvZiBjYWxsaW5nIGJhY2sgaW50b1xuLy8gQmxhemUuX21hdGVyaWFsaXplRE9NIHNvIHRoYXQgZGVlcCBWaWV3IGhpZXJhcmNoaWVzIGRvbid0IGJsb3cgdGhlXG4vLyBzdGFjay4gIEluc3RlYWQsIHdlIHB1c2ggdGFza3Mgb250byB3b3JrU3RhY2sgZm9yIHRoZSBpbml0aWFsXG4vLyByZW5kZXJpbmcgYW5kIHN1YnNlcXVlbnQgc2V0dXAgb2YgdGhlIFZpZXcsIGFuZCB0aGV5IGFyZSBkb25lIGFmdGVyXG4vLyB3ZSByZXR1cm4uICBXaGVuIHRoZXJlIGlzIGEgX3dvcmtTdGFjaywgd2UgZG8gbm90IHJldHVybiB0aGUgbmV3XG4vLyBET01SYW5nZSwgYnV0IGluc3RlYWQgcHVzaCBpdCBpbnRvIF9pbnRvQXJyYXkgZnJvbSBhIF93b3JrU3RhY2tcbi8vIHRhc2suXG5CbGF6ZS5fbWF0ZXJpYWxpemVWaWV3ID0gZnVuY3Rpb24gKHZpZXcsIHBhcmVudFZpZXcsIF93b3JrU3RhY2ssIF9pbnRvQXJyYXkpIHtcbiAgQmxhemUuX2NyZWF0ZVZpZXcodmlldywgcGFyZW50Vmlldyk7XG5cbiAgdmFyIGRvbXJhbmdlO1xuICB2YXIgbGFzdEh0bWxqcztcbiAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGJlIGNhbGxlZCBpbiBhIENvbXB1dGF0aW9uLCBidXQganVzdCBpbiBjYXNlLFxuICAvLyB3cmFwIGluIFRyYWNrZXIubm9ucmVhY3RpdmUuXG4gIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgIHZpZXcuYXV0b3J1bihmdW5jdGlvbiBkb1JlbmRlcihjKSB7XG4gICAgICAvLyBgdmlldy5hdXRvcnVuYCBzZXRzIHRoZSBjdXJyZW50IHZpZXcuXG4gICAgICB2aWV3LnJlbmRlckNvdW50Kys7XG4gICAgICB2aWV3Ll9pc0luUmVuZGVyID0gdHJ1ZTtcbiAgICAgIC8vIEFueSBkZXBlbmRlbmNpZXMgdGhhdCBzaG91bGQgaW52YWxpZGF0ZSB0aGlzIENvbXB1dGF0aW9uIGNvbWVcbiAgICAgIC8vIGZyb20gdGhpcyBsaW5lOlxuICAgICAgdmFyIGh0bWxqcyA9IHZpZXcuX3JlbmRlcigpO1xuICAgICAgdmlldy5faXNJblJlbmRlciA9IGZhbHNlO1xuXG4gICAgICBpZiAoISBjLmZpcnN0UnVuICYmICEgQmxhemUuX2lzQ29udGVudEVxdWFsKGxhc3RIdG1sanMsIGh0bWxqcykpIHtcbiAgICAgICAgVHJhY2tlci5ub25yZWFjdGl2ZShmdW5jdGlvbiBkb01hdGVyaWFsaXplKCkge1xuICAgICAgICAgIC8vIHJlLXJlbmRlclxuICAgICAgICAgIHZhciByYW5nZXNBbmROb2RlcyA9IEJsYXplLl9tYXRlcmlhbGl6ZURPTShodG1sanMsIFtdLCB2aWV3KTtcbiAgICAgICAgICBkb21yYW5nZS5zZXRNZW1iZXJzKHJhbmdlc0FuZE5vZGVzKTtcbiAgICAgICAgICBCbGF6ZS5fZmlyZUNhbGxiYWNrcyh2aWV3LCAncmVuZGVyZWQnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBsYXN0SHRtbGpzID0gaHRtbGpzO1xuXG4gICAgICAvLyBDYXVzZXMgYW55IG5lc3RlZCB2aWV3cyB0byBzdG9wIGltbWVkaWF0ZWx5LCBub3Qgd2hlbiB3ZSBjYWxsXG4gICAgICAvLyBgc2V0TWVtYmVyc2AgdGhlIG5leHQgdGltZSBhcm91bmQgdGhlIGF1dG9ydW4uICBPdGhlcndpc2UsXG4gICAgICAvLyBoZWxwZXJzIGluIHRoZSBET00gdHJlZSB0byBiZSByZXBsYWNlZCBtaWdodCBiZSBzY2hlZHVsZWRcbiAgICAgIC8vIHRvIHJlLXJ1biBiZWZvcmUgd2UgaGF2ZSBhIGNoYW5jZSB0byBzdG9wIHRoZW0uXG4gICAgICBUcmFja2VyLm9uSW52YWxpZGF0ZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChkb21yYW5nZSkge1xuICAgICAgICAgIGRvbXJhbmdlLmRlc3Ryb3lNZW1iZXJzKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sIHVuZGVmaW5lZCwgJ21hdGVyaWFsaXplJyk7XG5cbiAgICAvLyBmaXJzdCByZW5kZXIuICBsYXN0SHRtbGpzIGlzIHRoZSBmaXJzdCBodG1sanMuXG4gICAgdmFyIGluaXRpYWxDb250ZW50cztcbiAgICBpZiAoISBfd29ya1N0YWNrKSB7XG4gICAgICBpbml0aWFsQ29udGVudHMgPSBCbGF6ZS5fbWF0ZXJpYWxpemVET00obGFzdEh0bWxqcywgW10sIHZpZXcpO1xuICAgICAgZG9tcmFuZ2UgPSBkb0ZpcnN0UmVuZGVyKHZpZXcsIGluaXRpYWxDb250ZW50cyk7XG4gICAgICBpbml0aWFsQ29udGVudHMgPSBudWxsOyAvLyBoZWxwIEdDIGJlY2F1c2Ugd2UgY2xvc2Ugb3ZlciB0aGlzIHNjb3BlIGEgbG90XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdlJ3JlIGJlaW5nIGNhbGxlZCBmcm9tIEJsYXplLl9tYXRlcmlhbGl6ZURPTSwgc28gdG8gYXZvaWRcbiAgICAgIC8vIHJlY3Vyc2lvbiBhbmQgc2F2ZSBzdGFjayBzcGFjZSwgcHJvdmlkZSBhIGRlc2NyaXB0aW9uIG9mIHRoZVxuICAgICAgLy8gd29yayB0byBiZSBkb25lIGluc3RlYWQgb2YgZG9pbmcgaXQuICBUYXNrcyBwdXNoZWQgb250b1xuICAgICAgLy8gX3dvcmtTdGFjayB3aWxsIGJlIGRvbmUgaW4gTElGTyBvcmRlciBhZnRlciB3ZSByZXR1cm4uXG4gICAgICAvLyBUaGUgd29yayB3aWxsIHN0aWxsIGJlIGRvbmUgd2l0aGluIGEgVHJhY2tlci5ub25yZWFjdGl2ZSxcbiAgICAgIC8vIGJlY2F1c2UgaXQgd2lsbCBiZSBkb25lIGJ5IHNvbWUgY2FsbCB0byBCbGF6ZS5fbWF0ZXJpYWxpemVET01cbiAgICAgIC8vICh3aGljaCBpcyBhbHdheXMgY2FsbGVkIGluIGEgVHJhY2tlci5ub25yZWFjdGl2ZSkuXG4gICAgICBpbml0aWFsQ29udGVudHMgPSBbXTtcbiAgICAgIC8vIHB1c2ggdGhpcyBmdW5jdGlvbiBmaXJzdCBzbyB0aGF0IGl0IGhhcHBlbnMgbGFzdFxuICAgICAgX3dvcmtTdGFjay5wdXNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9tcmFuZ2UgPSBkb0ZpcnN0UmVuZGVyKHZpZXcsIGluaXRpYWxDb250ZW50cyk7XG4gICAgICAgIGluaXRpYWxDb250ZW50cyA9IG51bGw7IC8vIGhlbHAgR0MgYmVjYXVzZSBvZiBhbGwgdGhlIGNsb3N1cmVzIGhlcmVcbiAgICAgICAgX2ludG9BcnJheS5wdXNoKGRvbXJhbmdlKTtcbiAgICAgIH0pO1xuICAgICAgLy8gbm93IHB1c2ggdGhlIHRhc2sgdGhhdCBjYWxjdWxhdGVzIGluaXRpYWxDb250ZW50c1xuICAgICAgX3dvcmtTdGFjay5wdXNoKEJsYXplLl9iaW5kKEJsYXplLl9tYXRlcmlhbGl6ZURPTSwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdEh0bWxqcywgaW5pdGlhbENvbnRlbnRzLCB2aWV3LCBfd29ya1N0YWNrKSk7XG4gICAgfVxuICB9KTtcblxuICBpZiAoISBfd29ya1N0YWNrKSB7XG4gICAgcmV0dXJuIGRvbXJhbmdlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG4vLyBFeHBhbmRzIGEgVmlldyB0byBIVE1ManMsIGNhbGxpbmcgYHJlbmRlcmAgcmVjdXJzaXZlbHkgb24gYWxsXG4vLyBWaWV3cyBhbmQgZXZhbHVhdGluZyBhbnkgZHluYW1pYyBhdHRyaWJ1dGVzLiAgQ2FsbHMgdGhlIGBjcmVhdGVkYFxuLy8gY2FsbGJhY2ssIGJ1dCBub3QgdGhlIGBtYXRlcmlhbGl6ZWRgIG9yIGByZW5kZXJlZGAgY2FsbGJhY2tzLlxuLy8gRGVzdHJveXMgdGhlIHZpZXcgaW1tZWRpYXRlbHksIHVubGVzcyBjYWxsZWQgaW4gYSBUcmFja2VyIENvbXB1dGF0aW9uLFxuLy8gaW4gd2hpY2ggY2FzZSB0aGUgdmlldyB3aWxsIGJlIGRlc3Ryb3llZCB3aGVuIHRoZSBDb21wdXRhdGlvbiBpc1xuLy8gaW52YWxpZGF0ZWQuICBJZiBjYWxsZWQgaW4gYSBUcmFja2VyIENvbXB1dGF0aW9uLCB0aGUgcmVzdWx0IGlzIGFcbi8vIHJlYWN0aXZlIHN0cmluZzsgdGhhdCBpcywgdGhlIENvbXB1dGF0aW9uIHdpbGwgYmUgaW52YWxpZGF0ZWRcbi8vIGlmIGFueSBjaGFuZ2VzIGFyZSBtYWRlIHRvIHRoZSB2aWV3IG9yIHN1YnZpZXdzIHRoYXQgbWlnaHQgYWZmZWN0XG4vLyB0aGUgSFRNTC5cbkJsYXplLl9leHBhbmRWaWV3ID0gZnVuY3Rpb24gKHZpZXcsIHBhcmVudFZpZXcpIHtcbiAgQmxhemUuX2NyZWF0ZVZpZXcodmlldywgcGFyZW50VmlldywgdHJ1ZSAvKmZvckV4cGFuc2lvbiovKTtcblxuICB2aWV3Ll9pc0luUmVuZGVyID0gdHJ1ZTtcbiAgdmFyIGh0bWxqcyA9IEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlldywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB2aWV3Ll9yZW5kZXIoKTtcbiAgfSk7XG4gIHZpZXcuX2lzSW5SZW5kZXIgPSBmYWxzZTtcblxuICB2YXIgcmVzdWx0ID0gQmxhemUuX2V4cGFuZChodG1sanMsIHZpZXcpO1xuXG4gIGlmIChUcmFja2VyLmFjdGl2ZSkge1xuICAgIFRyYWNrZXIub25JbnZhbGlkYXRlKGZ1bmN0aW9uICgpIHtcbiAgICAgIEJsYXplLl9kZXN0cm95Vmlldyh2aWV3KTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBCbGF6ZS5fZGVzdHJveVZpZXcodmlldyk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gT3B0aW9uczogYHBhcmVudFZpZXdgXG5CbGF6ZS5fSFRNTEpTRXhwYW5kZXIgPSBIVE1MLlRyYW5zZm9ybWluZ1Zpc2l0b3IuZXh0ZW5kKCk7XG5CbGF6ZS5fSFRNTEpTRXhwYW5kZXIuZGVmKHtcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uICh4KSB7XG4gICAgaWYgKHggaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZSlcbiAgICAgIHggPSB4LmNvbnN0cnVjdFZpZXcoKTtcbiAgICBpZiAoeCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpXG4gICAgICByZXR1cm4gQmxhemUuX2V4cGFuZFZpZXcoeCwgdGhpcy5wYXJlbnRWaWV3KTtcblxuICAgIC8vIHRoaXMgd2lsbCB0aHJvdyBhbiBlcnJvcjsgb3RoZXIgb2JqZWN0cyBhcmUgbm90IGFsbG93ZWQhXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRPYmplY3QuY2FsbCh0aGlzLCB4KTtcbiAgfSxcbiAgdmlzaXRBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cnMpIHtcbiAgICAvLyBleHBhbmQgZHluYW1pYyBhdHRyaWJ1dGVzXG4gICAgaWYgKHR5cGVvZiBhdHRycyA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIGF0dHJzID0gQmxhemUuX3dpdGhDdXJyZW50Vmlldyh0aGlzLnBhcmVudFZpZXcsIGF0dHJzKTtcblxuICAgIC8vIGNhbGwgc3VwZXIgKGUuZy4gZm9yIGNhc2Ugd2hlcmUgYGF0dHJzYCBpcyBhbiBhcnJheSlcbiAgICByZXR1cm4gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLnByb3RvdHlwZS52aXNpdEF0dHJpYnV0ZXMuY2FsbCh0aGlzLCBhdHRycyk7XG4gIH0sXG4gIHZpc2l0QXR0cmlidXRlOiBmdW5jdGlvbiAobmFtZSwgdmFsdWUsIHRhZykge1xuICAgIC8vIGV4cGFuZCBhdHRyaWJ1dGUgdmFsdWVzIHRoYXQgYXJlIGZ1bmN0aW9ucy4gIEFueSBhdHRyaWJ1dGUgdmFsdWVcbiAgICAvLyB0aGF0IGNvbnRhaW5zIFZpZXdzIG11c3QgYmUgd3JhcHBlZCBpbiBhIGZ1bmN0aW9uLlxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpXG4gICAgICB2YWx1ZSA9IEJsYXplLl93aXRoQ3VycmVudFZpZXcodGhpcy5wYXJlbnRWaWV3LCB2YWx1ZSk7XG5cbiAgICByZXR1cm4gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLnByb3RvdHlwZS52aXNpdEF0dHJpYnV0ZS5jYWxsKFxuICAgICAgdGhpcywgbmFtZSwgdmFsdWUsIHRhZyk7XG4gIH1cbn0pO1xuXG4vLyBSZXR1cm4gQmxhemUuY3VycmVudFZpZXcsIGJ1dCBvbmx5IGlmIGl0IGlzIGJlaW5nIHJlbmRlcmVkXG4vLyAoaS5lLiB3ZSBhcmUgaW4gaXRzIHJlbmRlcigpIG1ldGhvZCkuXG52YXIgY3VycmVudFZpZXdJZlJlbmRlcmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHZpZXcgPSBCbGF6ZS5jdXJyZW50VmlldztcbiAgcmV0dXJuICh2aWV3ICYmIHZpZXcuX2lzSW5SZW5kZXIpID8gdmlldyA6IG51bGw7XG59O1xuXG5CbGF6ZS5fZXhwYW5kID0gZnVuY3Rpb24gKGh0bWxqcywgcGFyZW50Vmlldykge1xuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG4gIHJldHVybiAobmV3IEJsYXplLl9IVE1MSlNFeHBhbmRlcihcbiAgICB7cGFyZW50VmlldzogcGFyZW50Vmlld30pKS52aXNpdChodG1sanMpO1xufTtcblxuQmxhemUuX2V4cGFuZEF0dHJpYnV0ZXMgPSBmdW5jdGlvbiAoYXR0cnMsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuICByZXR1cm4gKG5ldyBCbGF6ZS5fSFRNTEpTRXhwYW5kZXIoXG4gICAge3BhcmVudFZpZXc6IHBhcmVudFZpZXd9KSkudmlzaXRBdHRyaWJ1dGVzKGF0dHJzKTtcbn07XG5cbkJsYXplLl9kZXN0cm95VmlldyA9IGZ1bmN0aW9uICh2aWV3LCBfc2tpcE5vZGVzKSB7XG4gIGlmICh2aWV3LmlzRGVzdHJveWVkKVxuICAgIHJldHVybjtcbiAgdmlldy5pc0Rlc3Ryb3llZCA9IHRydWU7XG5cblxuICAvLyBEZXN0cm95IHZpZXdzIGFuZCBlbGVtZW50cyByZWN1cnNpdmVseS4gIElmIF9za2lwTm9kZXMsXG4gIC8vIG9ubHkgcmVjdXJzZSB1cCB0byB2aWV3cywgbm90IGVsZW1lbnRzLCBmb3IgdGhlIGNhc2Ugd2hlcmVcbiAgLy8gdGhlIGJhY2tlbmQgKGpRdWVyeSkgaXMgcmVjdXJzaW5nIG92ZXIgdGhlIGVsZW1lbnRzIGFscmVhZHkuXG5cbiAgaWYgKHZpZXcuX2RvbXJhbmdlKSB2aWV3Ll9kb21yYW5nZS5kZXN0cm95TWVtYmVycyhfc2tpcE5vZGVzKTtcblxuICAvLyBYWFg6IGZpcmUgY2FsbGJhY2tzIGFmdGVyIHBvdGVudGlhbCBtZW1iZXJzIGFyZSBkZXN0cm95ZWRcbiAgLy8gb3RoZXJ3aXNlIGl0J3MgdHJhY2tlci5mbHVzaCB3aWxsIGNhdXNlIHRoZSBhYm92ZSBsaW5lIHdpbGxcbiAgLy8gbm90IGJlIGNhbGxlZCBhbmQgdGhlaXIgdmlld3Mgd29uJ3QgYmUgZGVzdHJveWVkXG4gIC8vIEludm9sdmVkIGlzc3VlczogRE9NUmFuZ2UgXCJNdXN0IGJlIGF0dGFjaGVkXCIgZXJyb3IsIG1lbSBsZWFrXG4gIFxuICBCbGF6ZS5fZmlyZUNhbGxiYWNrcyh2aWV3LCAnZGVzdHJveWVkJyk7XG59O1xuXG5CbGF6ZS5fZGVzdHJveU5vZGUgPSBmdW5jdGlvbiAobm9kZSkge1xuICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gMSlcbiAgICBCbGF6ZS5fRE9NQmFja2VuZC5UZWFyZG93bi50ZWFyRG93bkVsZW1lbnQobm9kZSk7XG59O1xuXG4vLyBBcmUgdGhlIEhUTUxqcyBlbnRpdGllcyBgYWAgYW5kIGBiYCB0aGUgc2FtZT8gIFdlIGNvdWxkIGJlXG4vLyBtb3JlIGVsYWJvcmF0ZSBoZXJlIGJ1dCB0aGUgcG9pbnQgaXMgdG8gY2F0Y2ggdGhlIG1vc3QgYmFzaWNcbi8vIGNhc2VzLlxuQmxhemUuX2lzQ29udGVudEVxdWFsID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgaWYgKGEgaW5zdGFuY2VvZiBIVE1MLlJhdykge1xuICAgIHJldHVybiAoYiBpbnN0YW5jZW9mIEhUTUwuUmF3KSAmJiAoYS52YWx1ZSA9PT0gYi52YWx1ZSk7XG4gIH0gZWxzZSBpZiAoYSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIChiID09IG51bGwpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoYSA9PT0gYikgJiZcbiAgICAgICgodHlwZW9mIGEgPT09ICdudW1iZXInKSB8fCAodHlwZW9mIGEgPT09ICdib29sZWFuJykgfHxcbiAgICAgICAodHlwZW9mIGEgPT09ICdzdHJpbmcnKSk7XG4gIH1cbn07XG5cbi8qKlxuICogQHN1bW1hcnkgVGhlIFZpZXcgY29ycmVzcG9uZGluZyB0byB0aGUgY3VycmVudCB0ZW1wbGF0ZSBoZWxwZXIsIGV2ZW50IGhhbmRsZXIsIGNhbGxiYWNrLCBvciBhdXRvcnVuLiAgSWYgdGhlcmUgaXNuJ3Qgb25lLCBgbnVsbGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAdHlwZSB7QmxhemUuVmlld31cbiAqL1xuQmxhemUuY3VycmVudFZpZXcgPSBudWxsO1xuXG5CbGF6ZS5fd2l0aEN1cnJlbnRWaWV3ID0gZnVuY3Rpb24gKHZpZXcsIGZ1bmMpIHtcbiAgdmFyIG9sZFZpZXcgPSBCbGF6ZS5jdXJyZW50VmlldztcbiAgdHJ5IHtcbiAgICBCbGF6ZS5jdXJyZW50VmlldyA9IHZpZXc7XG4gICAgcmV0dXJuIGZ1bmMoKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBCbGF6ZS5jdXJyZW50VmlldyA9IG9sZFZpZXc7XG4gIH1cbn07XG5cbi8vIEJsYXplLnJlbmRlciBwdWJsaWNseSB0YWtlcyBhIFZpZXcgb3IgYSBUZW1wbGF0ZS5cbi8vIFByaXZhdGVseSwgaXQgdGFrZXMgYW55IEhUTUxKUyAoZXh0ZW5kZWQgd2l0aCBWaWV3cyBhbmQgVGVtcGxhdGVzKVxuLy8gZXhjZXB0IG51bGwgb3IgdW5kZWZpbmVkLCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbnkgZXh0ZW5kZWRcbi8vIEhUTUxKUy5cbnZhciBjaGVja1JlbmRlckNvbnRlbnQgPSBmdW5jdGlvbiAoY29udGVudCkge1xuICBpZiAoY29udGVudCA9PT0gbnVsbClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgbnVsbFwiKTtcbiAgaWYgKHR5cGVvZiBjb250ZW50ID09PSAndW5kZWZpbmVkJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgdW5kZWZpbmVkXCIpO1xuXG4gIGlmICgoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHx8XG4gICAgICAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSB8fFxuICAgICAgKHR5cGVvZiBjb250ZW50ID09PSAnZnVuY3Rpb24nKSlcbiAgICByZXR1cm47XG5cbiAgdHJ5IHtcbiAgICAvLyBUaHJvdyBpZiBjb250ZW50IGRvZXNuJ3QgbG9vayBsaWtlIEhUTUxKUyBhdCB0aGUgdG9wIGxldmVsXG4gICAgLy8gKGkuZS4gdmVyaWZ5IHRoYXQgdGhpcyBpcyBhbiBIVE1MLlRhZywgb3IgYW4gYXJyYXksXG4gICAgLy8gb3IgYSBwcmltaXRpdmUsIGV0Yy4pXG4gICAgKG5ldyBIVE1MLlZpc2l0b3IpLnZpc2l0KGNvbnRlbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gTWFrZSBlcnJvciBtZXNzYWdlIHN1aXRhYmxlIGZvciBwdWJsaWMgQVBJXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgVGVtcGxhdGUgb3IgVmlld1wiKTtcbiAgfVxufTtcblxuLy8gRm9yIEJsYXplLnJlbmRlciBhbmQgQmxhemUudG9IVE1MLCB0YWtlIGNvbnRlbnQgYW5kXG4vLyB3cmFwIGl0IGluIGEgVmlldywgdW5sZXNzIGl0J3MgYSBzaW5nbGUgVmlldyBvclxuLy8gVGVtcGxhdGUgYWxyZWFkeS5cbnZhciBjb250ZW50QXNWaWV3ID0gZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgY2hlY2tSZW5kZXJDb250ZW50KGNvbnRlbnQpO1xuXG4gIGlmIChjb250ZW50IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpIHtcbiAgICByZXR1cm4gY29udGVudC5jb25zdHJ1Y3RWaWV3KCk7XG4gIH0gZWxzZSBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHtcbiAgICByZXR1cm4gY29udGVudDtcbiAgfSBlbHNlIHtcbiAgICB2YXIgZnVuYyA9IGNvbnRlbnQ7XG4gICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBmdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBCbGF6ZS5WaWV3KCdyZW5kZXInLCBmdW5jKTtcbiAgfVxufTtcblxuLy8gRm9yIEJsYXplLnJlbmRlcldpdGhEYXRhIGFuZCBCbGF6ZS50b0hUTUxXaXRoRGF0YSwgd3JhcCBjb250ZW50XG4vLyBpbiBhIGZ1bmN0aW9uLCBpZiBuZWNlc3NhcnksIHNvIGl0IGNhbiBiZSBhIGNvbnRlbnQgYXJnIHRvXG4vLyBhIEJsYXplLldpdGguXG52YXIgY29udGVudEFzRnVuYyA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gIGNoZWNrUmVuZGVyQ29udGVudChjb250ZW50KTtcblxuICBpZiAodHlwZW9mIGNvbnRlbnQgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29udGVudDtcbiAgfVxufTtcblxuQmxhemUuX19yb290Vmlld3MgPSBbXTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW5kZXJzIGEgdGVtcGxhdGUgb3IgVmlldyB0byBET00gbm9kZXMgYW5kIGluc2VydHMgaXQgaW50byB0aGUgRE9NLCByZXR1cm5pbmcgYSByZW5kZXJlZCBbVmlld10oI0JsYXplLVZpZXcpIHdoaWNoIGNhbiBiZSBwYXNzZWQgdG8gW2BCbGF6ZS5yZW1vdmVgXSgjQmxhemUtcmVtb3ZlKS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7VGVtcGxhdGV8QmxhemUuVmlld30gdGVtcGxhdGVPclZpZXcgVGhlIHRlbXBsYXRlIChlLmcuIGBUZW1wbGF0ZS5teVRlbXBsYXRlYCkgb3IgVmlldyBvYmplY3QgdG8gcmVuZGVyLiAgSWYgYSB0ZW1wbGF0ZSwgYSBWaWV3IG9iamVjdCBpcyBbY29uc3RydWN0ZWRdKCN0ZW1wbGF0ZV9jb25zdHJ1Y3R2aWV3KS4gIElmIGEgVmlldywgaXQgbXVzdCBiZSBhbiB1bnJlbmRlcmVkIFZpZXcsIHdoaWNoIGJlY29tZXMgYSByZW5kZXJlZCBWaWV3IGFuZCBpcyByZXR1cm5lZC5cbiAqIEBwYXJhbSB7RE9NTm9kZX0gcGFyZW50Tm9kZSBUaGUgbm9kZSB0aGF0IHdpbGwgYmUgdGhlIHBhcmVudCBvZiB0aGUgcmVuZGVyZWQgdGVtcGxhdGUuICBJdCBtdXN0IGJlIGFuIEVsZW1lbnQgbm9kZS5cbiAqIEBwYXJhbSB7RE9NTm9kZX0gW25leHROb2RlXSBPcHRpb25hbC4gSWYgcHJvdmlkZWQsIG11c3QgYmUgYSBjaGlsZCBvZiA8ZW0+cGFyZW50Tm9kZTwvZW0+OyB0aGUgdGVtcGxhdGUgd2lsbCBiZSBpbnNlcnRlZCBiZWZvcmUgdGhpcyBub2RlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSB0ZW1wbGF0ZSB3aWxsIGJlIGluc2VydGVkIGFzIHRoZSBsYXN0IGNoaWxkIG9mIHBhcmVudE5vZGUuXG4gKiBAcGFyYW0ge0JsYXplLlZpZXd9IFtwYXJlbnRWaWV3XSBPcHRpb25hbC4gSWYgcHJvdmlkZWQsIGl0IHdpbGwgYmUgc2V0IGFzIHRoZSByZW5kZXJlZCBWaWV3J3MgW2BwYXJlbnRWaWV3YF0oI3ZpZXdfcGFyZW50dmlldykuXG4gKi9cbkJsYXplLnJlbmRlciA9IGZ1bmN0aW9uIChjb250ZW50LCBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSwgcGFyZW50Vmlldykge1xuICBpZiAoISBwYXJlbnRFbGVtZW50KSB7XG4gICAgQmxhemUuX3dhcm4oXCJCbGF6ZS5yZW5kZXIgd2l0aG91dCBhIHBhcmVudCBlbGVtZW50IGlzIGRlcHJlY2F0ZWQuIFwiICtcbiAgICAgICAgICAgICAgICBcIllvdSBtdXN0IHNwZWNpZnkgd2hlcmUgdG8gaW5zZXJ0IHRoZSByZW5kZXJlZCBjb250ZW50LlwiKTtcbiAgfVxuXG4gIGlmIChuZXh0Tm9kZSBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHtcbiAgICAvLyBoYW5kbGUgb21pdHRlZCBuZXh0Tm9kZVxuICAgIHBhcmVudFZpZXcgPSBuZXh0Tm9kZTtcbiAgICBuZXh0Tm9kZSA9IG51bGw7XG4gIH1cblxuICAvLyBwYXJlbnRFbGVtZW50IG11c3QgYmUgYSBET00gbm9kZS4gaW4gcGFydGljdWxhciwgY2FuJ3QgYmUgdGhlXG4gIC8vIHJlc3VsdCBvZiBhIGNhbGwgdG8gYCRgLiBDYW4ndCBjaGVjayBpZiBgcGFyZW50RWxlbWVudCBpbnN0YW5jZW9mXG4gIC8vIE5vZGVgIHNpbmNlICdOb2RlJyBpcyB1bmRlZmluZWQgaW4gSUU4LlxuICBpZiAocGFyZW50RWxlbWVudCAmJiB0eXBlb2YgcGFyZW50RWxlbWVudC5ub2RlVHlwZSAhPT0gJ251bWJlcicpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiJ3BhcmVudEVsZW1lbnQnIG11c3QgYmUgYSBET00gbm9kZVwiKTtcbiAgaWYgKG5leHROb2RlICYmIHR5cGVvZiBuZXh0Tm9kZS5ub2RlVHlwZSAhPT0gJ251bWJlcicpIC8vICduZXh0Tm9kZScgaXMgb3B0aW9uYWxcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCInbmV4dE5vZGUnIG11c3QgYmUgYSBET00gbm9kZVwiKTtcblxuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG5cbiAgdmFyIHZpZXcgPSBjb250ZW50QXNWaWV3KGNvbnRlbnQpO1xuXG4gIC8vIFRPRE86IHRoaXMgaXMgb25seSBuZWVkZWQgaW4gZGV2ZWxvcG1lbnRcbiAgaWYgKCFwYXJlbnRWaWV3KSB7XG4gICAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIEJsYXplLl9fcm9vdFZpZXdzLnB1c2godmlldyk7XG4gICAgfSk7XG5cbiAgICB2aWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgaW5kZXggPSBCbGF6ZS5fX3Jvb3RWaWV3cy5pbmRleE9mKHZpZXcpO1xuICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgQmxhemUuX19yb290Vmlld3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIEJsYXplLl9tYXRlcmlhbGl6ZVZpZXcodmlldywgcGFyZW50Vmlldyk7XG4gIGlmIChwYXJlbnRFbGVtZW50KSB7XG4gICAgdmlldy5fZG9tcmFuZ2UuYXR0YWNoKHBhcmVudEVsZW1lbnQsIG5leHROb2RlKTtcbiAgfVxuXG4gIHJldHVybiB2aWV3O1xufTtcblxuQmxhemUuaW5zZXJ0ID0gZnVuY3Rpb24gKHZpZXcsIHBhcmVudEVsZW1lbnQsIG5leHROb2RlKSB7XG4gIEJsYXplLl93YXJuKFwiQmxhemUuaW5zZXJ0IGhhcyBiZWVuIGRlcHJlY2F0ZWQuICBTcGVjaWZ5IHdoZXJlIHRvIGluc2VydCB0aGUgXCIgK1xuICAgICAgICAgICAgICBcInJlbmRlcmVkIGNvbnRlbnQgaW4gdGhlIGNhbGwgdG8gQmxhemUucmVuZGVyLlwiKTtcblxuICBpZiAoISAodmlldyAmJiAodmlldy5fZG9tcmFuZ2UgaW5zdGFuY2VvZiBCbGF6ZS5fRE9NUmFuZ2UpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCB0ZW1wbGF0ZSByZW5kZXJlZCB3aXRoIEJsYXplLnJlbmRlclwiKTtcblxuICB2aWV3Ll9kb21yYW5nZS5hdHRhY2gocGFyZW50RWxlbWVudCwgbmV4dE5vZGUpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW5kZXJzIGEgdGVtcGxhdGUgb3IgVmlldyB0byBET00gbm9kZXMgd2l0aCBhIGRhdGEgY29udGV4dC4gIE90aGVyd2lzZSBpZGVudGljYWwgdG8gYEJsYXplLnJlbmRlcmAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IHRvIHJlbmRlci5cbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkYXRhIFRoZSBkYXRhIGNvbnRleHQgdG8gdXNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIGRhdGEgY29udGV4dC4gIElmIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0RPTU5vZGV9IHBhcmVudE5vZGUgVGhlIG5vZGUgdGhhdCB3aWxsIGJlIHRoZSBwYXJlbnQgb2YgdGhlIHJlbmRlcmVkIHRlbXBsYXRlLiAgSXQgbXVzdCBiZSBhbiBFbGVtZW50IG5vZGUuXG4gKiBAcGFyYW0ge0RPTU5vZGV9IFtuZXh0Tm9kZV0gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBtdXN0IGJlIGEgY2hpbGQgb2YgPGVtPnBhcmVudE5vZGU8L2VtPjsgdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zZXJ0ZWQgYmVmb3JlIHRoaXMgbm9kZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgdGVtcGxhdGUgd2lsbCBiZSBpbnNlcnRlZCBhcyB0aGUgbGFzdCBjaGlsZCBvZiBwYXJlbnROb2RlLlxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSBbcGFyZW50Vmlld10gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHNldCBhcyB0aGUgcmVuZGVyZWQgVmlldydzIFtgcGFyZW50Vmlld2BdKCN2aWV3X3BhcmVudHZpZXcpLlxuICovXG5CbGF6ZS5yZW5kZXJXaXRoRGF0YSA9IGZ1bmN0aW9uIChjb250ZW50LCBkYXRhLCBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSwgcGFyZW50Vmlldykge1xuICAvLyBXZSBkZWZlciB0aGUgaGFuZGxpbmcgb2Ygb3B0aW9uYWwgYXJndW1lbnRzIHRvIEJsYXplLnJlbmRlci4gIEF0IHRoaXMgcG9pbnQsXG4gIC8vIGBuZXh0Tm9kZWAgbWF5IGFjdHVhbGx5IGJlIGBwYXJlbnRWaWV3YC5cbiAgcmV0dXJuIEJsYXplLnJlbmRlcihCbGF6ZS5fVGVtcGxhdGVXaXRoKGRhdGEsIGNvbnRlbnRBc0Z1bmMoY29udGVudCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSwgcGFyZW50Vmlldyk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbW92ZXMgYSByZW5kZXJlZCBWaWV3IGZyb20gdGhlIERPTSwgc3RvcHBpbmcgYWxsIHJlYWN0aXZlIHVwZGF0ZXMgYW5kIGV2ZW50IGxpc3RlbmVycyBvbiBpdC4gQWxzbyBkZXN0cm95cyB0aGUgQmxhemUuVGVtcGxhdGUgaW5zdGFuY2UgYXNzb2NpYXRlZCB3aXRoIHRoZSB2aWV3LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSByZW5kZXJlZFZpZXcgVGhlIHJldHVybiB2YWx1ZSBmcm9tIGBCbGF6ZS5yZW5kZXJgIG9yIGBCbGF6ZS5yZW5kZXJXaXRoRGF0YWAsIG9yIHRoZSBgdmlld2AgcHJvcGVydHkgb2YgYSBCbGF6ZS5UZW1wbGF0ZSBpbnN0YW5jZS4gQ2FsbGluZyBgQmxhemUucmVtb3ZlKFRlbXBsYXRlLmluc3RhbmNlKCkudmlldylgIGZyb20gd2l0aGluIGEgdGVtcGxhdGUgZXZlbnQgaGFuZGxlciB3aWxsIGRlc3Ryb3kgdGhlIHZpZXcgYXMgd2VsbCBhcyB0aGF0IHRlbXBsYXRlIGFuZCB0cmlnZ2VyIHRoZSB0ZW1wbGF0ZSdzIGBvbkRlc3Ryb3llZGAgaGFuZGxlcnMuXG4gKi9cbkJsYXplLnJlbW92ZSA9IGZ1bmN0aW9uICh2aWV3KSB7XG4gIGlmICghICh2aWV3ICYmICh2aWV3Ll9kb21yYW5nZSBpbnN0YW5jZW9mIEJsYXplLl9ET01SYW5nZSkpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIHRlbXBsYXRlIHJlbmRlcmVkIHdpdGggQmxhemUucmVuZGVyXCIpO1xuXG4gIHdoaWxlICh2aWV3KSB7XG4gICAgaWYgKCEgdmlldy5pc0Rlc3Ryb3llZCkge1xuICAgICAgdmFyIHJhbmdlID0gdmlldy5fZG9tcmFuZ2U7XG4gICAgICByYW5nZS5kZXN0cm95KCk7XG5cbiAgICAgIGlmIChyYW5nZS5hdHRhY2hlZCAmJiAhIHJhbmdlLnBhcmVudFJhbmdlKSB7XG4gICAgICAgIHJhbmdlLmRldGFjaCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZpZXcgPSB2aWV3Ll9oYXNHZW5lcmF0ZWRQYXJlbnQgJiYgdmlldy5wYXJlbnRWaWV3O1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIGEgc3RyaW5nIG9mIEhUTUwuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqL1xuQmxhemUudG9IVE1MID0gZnVuY3Rpb24gKGNvbnRlbnQsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuXG4gIHJldHVybiBIVE1MLnRvSFRNTChCbGF6ZS5fZXhwYW5kVmlldyhjb250ZW50QXNWaWV3KGNvbnRlbnQpLCBwYXJlbnRWaWV3KSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIEhUTUwgd2l0aCBhIGRhdGEgY29udGV4dC4gIE90aGVyd2lzZSBpZGVudGljYWwgdG8gYEJsYXplLnRvSFRNTGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkYXRhIFRoZSBkYXRhIGNvbnRleHQgdG8gdXNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIGRhdGEgY29udGV4dC5cbiAqL1xuQmxhemUudG9IVE1MV2l0aERhdGEgPSBmdW5jdGlvbiAoY29udGVudCwgZGF0YSwgcGFyZW50Vmlldykge1xuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG5cbiAgcmV0dXJuIEhUTUwudG9IVE1MKEJsYXplLl9leHBhbmRWaWV3KEJsYXplLl9UZW1wbGF0ZVdpdGgoXG4gICAgZGF0YSwgY29udGVudEFzRnVuYyhjb250ZW50KSksIHBhcmVudFZpZXcpKTtcbn07XG5cbkJsYXplLl90b1RleHQgPSBmdW5jdGlvbiAoaHRtbGpzLCBwYXJlbnRWaWV3LCB0ZXh0TW9kZSkge1xuICBpZiAodHlwZW9mIGh0bWxqcyA9PT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJCbGF6ZS5fdG9UZXh0IGRvZXNuJ3QgdGFrZSBhIGZ1bmN0aW9uLCBqdXN0IEhUTUxqc1wiKTtcblxuICBpZiAoKHBhcmVudFZpZXcgIT0gbnVsbCkgJiYgISAocGFyZW50VmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKSB7XG4gICAgLy8gb21pdHRlZCBwYXJlbnRWaWV3IGFyZ3VtZW50XG4gICAgdGV4dE1vZGUgPSBwYXJlbnRWaWV3O1xuICAgIHBhcmVudFZpZXcgPSBudWxsO1xuICB9XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcblxuICBpZiAoISB0ZXh0TW9kZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0ZXh0TW9kZSByZXF1aXJlZFwiKTtcbiAgaWYgKCEgKHRleHRNb2RlID09PSBIVE1MLlRFWFRNT0RFLlNUUklORyB8fFxuICAgICAgICAgdGV4dE1vZGUgPT09IEhUTUwuVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gSFRNTC5URVhUTU9ERS5BVFRSSUJVVEUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdGV4dE1vZGU6IFwiICsgdGV4dE1vZGUpO1xuXG4gIHJldHVybiBIVE1MLnRvVGV4dChCbGF6ZS5fZXhwYW5kKGh0bWxqcywgcGFyZW50VmlldyksIHRleHRNb2RlKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmV0dXJucyB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQsIG9yIHRoZSBkYXRhIGNvbnRleHQgdGhhdCB3YXMgdXNlZCB3aGVuIHJlbmRlcmluZyBhIHBhcnRpY3VsYXIgRE9NIGVsZW1lbnQgb3IgVmlldyBmcm9tIGEgTWV0ZW9yIHRlbXBsYXRlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtET01FbGVtZW50fEJsYXplLlZpZXd9IFtlbGVtZW50T3JWaWV3XSBPcHRpb25hbC4gIEFuIGVsZW1lbnQgdGhhdCB3YXMgcmVuZGVyZWQgYnkgYSBNZXRlb3IsIG9yIGEgVmlldy5cbiAqL1xuQmxhemUuZ2V0RGF0YSA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3KSB7XG4gIHZhciB0aGVXaXRoO1xuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0Vmlldygnd2l0aCcpO1xuICB9IGVsc2UgaWYgKGVsZW1lbnRPclZpZXcgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgdmFyIHZpZXcgPSBlbGVtZW50T3JWaWV3O1xuICAgIHRoZVdpdGggPSAodmlldy5uYW1lID09PSAnd2l0aCcgPyB2aWV3IDpcbiAgICAgICAgICAgICAgIEJsYXplLmdldFZpZXcodmlldywgJ3dpdGgnKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKGVsZW1lbnRPclZpZXcubm9kZVR5cGUgIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBET00gZWxlbWVudFwiKTtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0VmlldyhlbGVtZW50T3JWaWV3LCAnd2l0aCcpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50IG9yIFZpZXdcIik7XG4gIH1cblxuICByZXR1cm4gdGhlV2l0aCA/IHRoZVdpdGguZGF0YVZhci5nZXQoKSA6IG51bGw7XG59O1xuXG4vLyBGb3IgYmFjay1jb21wYXRcbkJsYXplLmdldEVsZW1lbnREYXRhID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgQmxhemUuX3dhcm4oXCJCbGF6ZS5nZXRFbGVtZW50RGF0YSBoYXMgYmVlbiBkZXByZWNhdGVkLiAgVXNlIFwiICtcbiAgICAgICAgICAgICAgXCJCbGF6ZS5nZXREYXRhKGVsZW1lbnQpIGluc3RlYWQuXCIpO1xuXG4gIGlmIChlbGVtZW50Lm5vZGVUeXBlICE9PSAxKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50XCIpO1xuXG4gIHJldHVybiBCbGF6ZS5nZXREYXRhKGVsZW1lbnQpO1xufTtcblxuLy8gQm90aCBhcmd1bWVudHMgYXJlIG9wdGlvbmFsLlxuXG4vKipcbiAqIEBzdW1tYXJ5IEdldHMgZWl0aGVyIHRoZSBjdXJyZW50IFZpZXcsIG9yIHRoZSBWaWV3IGVuY2xvc2luZyB0aGUgZ2l2ZW4gRE9NIGVsZW1lbnQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0RPTUVsZW1lbnR9IFtlbGVtZW50XSBPcHRpb25hbC4gIElmIHNwZWNpZmllZCwgdGhlIFZpZXcgZW5jbG9zaW5nIGBlbGVtZW50YCBpcyByZXR1cm5lZC5cbiAqL1xuQmxhemUuZ2V0VmlldyA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3LCBfdmlld05hbWUpIHtcbiAgdmFyIHZpZXdOYW1lID0gX3ZpZXdOYW1lO1xuXG4gIGlmICgodHlwZW9mIGVsZW1lbnRPclZpZXcpID09PSAnc3RyaW5nJykge1xuICAgIC8vIG9taXR0ZWQgZWxlbWVudE9yVmlldzsgdmlld05hbWUgcHJlc2VudFxuICAgIHZpZXdOYW1lID0gZWxlbWVudE9yVmlldztcbiAgICBlbGVtZW50T3JWaWV3ID0gbnVsbDtcbiAgfVxuXG4gIC8vIFdlIGNvdWxkIGV2ZW50dWFsbHkgc2hvcnRlbiB0aGUgY29kZSBieSBmb2xkaW5nIHRoZSBsb2dpY1xuICAvLyBmcm9tIHRoZSBvdGhlciBtZXRob2RzIGludG8gdGhpcyBtZXRob2QuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICByZXR1cm4gQmxhemUuX2dldEN1cnJlbnRWaWV3KHZpZXdOYW1lKTtcbiAgfSBlbHNlIGlmIChlbGVtZW50T3JWaWV3IGluc3RhbmNlb2YgQmxhemUuVmlldykge1xuICAgIHJldHVybiBCbGF6ZS5fZ2V0UGFyZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIEJsYXplLl9nZXRFbGVtZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgRE9NIGVsZW1lbnQgb3IgVmlld1wiKTtcbiAgfVxufTtcblxuLy8gR2V0cyB0aGUgY3VycmVudCB2aWV3IG9yIGl0cyBuZWFyZXN0IGFuY2VzdG9yIG9mIG5hbWVcbi8vIGBuYW1lYC5cbkJsYXplLl9nZXRDdXJyZW50VmlldyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIC8vIEJldHRlciB0byBmYWlsIGluIGNhc2VzIHdoZXJlIGl0IGRvZXNuJ3QgbWFrZSBzZW5zZVxuICAvLyB0byB1c2UgQmxhemUuX2dldEN1cnJlbnRWaWV3KCkuICBUaGVyZSB3aWxsIGJlIGEgY3VycmVudFxuICAvLyB2aWV3IGFueXdoZXJlIGl0IGRvZXMuICBZb3UgY2FuIGNoZWNrIEJsYXplLmN1cnJlbnRWaWV3XG4gIC8vIGlmIHlvdSB3YW50IHRvIGtub3cgd2hldGhlciB0aGVyZSBpcyBvbmUgb3Igbm90LlxuICBpZiAoISB2aWV3KVxuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZXJlIGlzIG5vIGN1cnJlbnQgdmlld1wiKTtcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2aWV3ICYmIHZpZXcubmFtZSAhPT0gbmFtZSlcbiAgICAgIHZpZXcgPSB2aWV3LnBhcmVudFZpZXc7XG4gICAgcmV0dXJuIHZpZXcgfHwgbnVsbDtcbiAgfSBlbHNlIHtcbiAgICAvLyBCbGF6ZS5fZ2V0Q3VycmVudFZpZXcoKSB3aXRoIG5vIGFyZ3VtZW50cyBqdXN0IHJldHVybnNcbiAgICAvLyBCbGF6ZS5jdXJyZW50Vmlldy5cbiAgICByZXR1cm4gdmlldztcbiAgfVxufTtcblxuQmxhemUuX2dldFBhcmVudFZpZXcgPSBmdW5jdGlvbiAodmlldywgbmFtZSkge1xuICB2YXIgdiA9IHZpZXcucGFyZW50VmlldztcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2ICYmIHYubmFtZSAhPT0gbmFtZSlcbiAgICAgIHYgPSB2LnBhcmVudFZpZXc7XG4gIH1cblxuICByZXR1cm4gdiB8fCBudWxsO1xufTtcblxuQmxhemUuX2dldEVsZW1lbnRWaWV3ID0gZnVuY3Rpb24gKGVsZW0sIG5hbWUpIHtcbiAgdmFyIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQoZWxlbSk7XG4gIHZhciB2aWV3ID0gbnVsbDtcbiAgd2hpbGUgKHJhbmdlICYmICEgdmlldykge1xuICAgIHZpZXcgPSAocmFuZ2UudmlldyB8fCBudWxsKTtcbiAgICBpZiAoISB2aWV3KSB7XG4gICAgICBpZiAocmFuZ2UucGFyZW50UmFuZ2UpXG4gICAgICAgIHJhbmdlID0gcmFuZ2UucGFyZW50UmFuZ2U7XG4gICAgICBlbHNlXG4gICAgICAgIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQocmFuZ2UucGFyZW50RWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5hbWUpIHtcbiAgICB3aGlsZSAodmlldyAmJiB2aWV3Lm5hbWUgIT09IG5hbWUpXG4gICAgICB2aWV3ID0gdmlldy5wYXJlbnRWaWV3O1xuICAgIHJldHVybiB2aWV3IHx8IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cbn07XG5cbkJsYXplLl9hZGRFdmVudE1hcCA9IGZ1bmN0aW9uICh2aWV3LCBldmVudE1hcCwgdGhpc0luSGFuZGxlcikge1xuICB0aGlzSW5IYW5kbGVyID0gKHRoaXNJbkhhbmRsZXIgfHwgbnVsbCk7XG4gIHZhciBoYW5kbGVzID0gW107XG5cbiAgaWYgKCEgdmlldy5fZG9tcmFuZ2UpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGhhdmUgYSBET01SYW5nZVwiKTtcblxuICB2aWV3Ll9kb21yYW5nZS5vbkF0dGFjaGVkKGZ1bmN0aW9uIGF0dGFjaGVkX2V2ZW50TWFwcyhyYW5nZSwgZWxlbWVudCkge1xuICAgIE9iamVjdC5rZXlzKGV2ZW50TWFwKS5mb3JFYWNoKGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICBsZXQgaGFuZGxlciA9IGV2ZW50TWFwW3NwZWNdO1xuICAgICAgdmFyIGNsYXVzZXMgPSBzcGVjLnNwbGl0KC8sXFxzKy8pO1xuICAgICAgLy8gaXRlcmF0ZSBvdmVyIGNsYXVzZXMgb2Ygc3BlYywgZS5nLiBbJ2NsaWNrIC5mb28nLCAnY2xpY2sgLmJhciddXG4gICAgICBjbGF1c2VzLmZvckVhY2goZnVuY3Rpb24gKGNsYXVzZSkge1xuICAgICAgICB2YXIgcGFydHMgPSBjbGF1c2Uuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMClcbiAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIG5ld0V2ZW50cyA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIHZhciBzZWxlY3RvciA9IHBhcnRzLmpvaW4oJyAnKTtcbiAgICAgICAgaGFuZGxlcy5wdXNoKEJsYXplLl9FdmVudFN1cHBvcnQubGlzdGVuKFxuICAgICAgICAgIGVsZW1lbnQsIG5ld0V2ZW50cywgc2VsZWN0b3IsXG4gICAgICAgICAgZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICAgICAgaWYgKCEgcmFuZ2UuY29udGFpbnNFbGVtZW50KGV2dC5jdXJyZW50VGFyZ2V0LCBzZWxlY3RvciwgbmV3RXZlbnRzKSlcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclRoaXMgPSB0aGlzSW5IYW5kbGVyIHx8IHRoaXM7XG4gICAgICAgICAgICB2YXIgaGFuZGxlckFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgICByZXR1cm4gQmxhemUuX3dpdGhDdXJyZW50Vmlldyh2aWV3LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLmFwcGx5KGhhbmRsZXJUaGlzLCBoYW5kbGVyQXJncyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJhbmdlLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgcmV0dXJuIHIucGFyZW50UmFuZ2U7XG4gICAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBoYW5kbGVzLmZvckVhY2goZnVuY3Rpb24gKGgpIHtcbiAgICAgIGguc3RvcCgpO1xuICAgIH0pO1xuICAgIGhhbmRsZXMubGVuZ3RoID0gMDtcbiAgfSk7XG59O1xuIiwiaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcbmltcG9ydCBpc09iamVjdCBmcm9tICdsb2Rhc2guaXNvYmplY3QnO1xuXG5CbGF6ZS5fY2FsY3VsYXRlQ29uZGl0aW9uID0gZnVuY3Rpb24gKGNvbmQpIHtcbiAgaWYgKEhUTUwuaXNBcnJheShjb25kKSAmJiBjb25kLmxlbmd0aCA9PT0gMClcbiAgICBjb25kID0gZmFsc2U7XG4gIHJldHVybiAhISBjb25kO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgY29udGVudCB3aXRoIGEgZGF0YSBjb250ZXh0LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IGRhdGEgQW4gb2JqZWN0IHRvIHVzZSBhcyB0aGUgZGF0YSBjb250ZXh0LCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBzdWNoIGFuIG9iamVjdC4gIElmIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICovXG5CbGF6ZS5XaXRoID0gZnVuY3Rpb24gKGRhdGEsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnd2l0aCcsIGNvbnRlbnRGdW5jKTtcblxuICB2aWV3LmRhdGFWYXIgPSBuZXcgUmVhY3RpdmVWYXI7XG5cbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIGBkYXRhYCBpcyBhIHJlYWN0aXZlIGZ1bmN0aW9uXG4gICAgICB2aWV3LmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgICAgICB2aWV3LmRhdGFWYXIuc2V0KGRhdGEoKSk7XG4gICAgICB9LCB2aWV3LnBhcmVudFZpZXcsICdzZXREYXRhJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZpZXcuZGF0YVZhci5zZXQoZGF0YSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQXR0YWNoZXMgYmluZGluZ3MgdG8gdGhlIGluc3RhbnRpYXRlZCB2aWV3LlxuICogQHBhcmFtIHtPYmplY3R9IGJpbmRpbmdzIEEgZGljdGlvbmFyeSBvZiBiaW5kaW5ncywgZWFjaCBiaW5kaW5nIG5hbWVcbiAqIGNvcnJlc3BvbmRzIHRvIGEgdmFsdWUgb3IgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge1ZpZXd9IHZpZXcgVGhlIHRhcmdldC5cbiAqL1xuQmxhemUuX2F0dGFjaEJpbmRpbmdzVG9WaWV3ID0gZnVuY3Rpb24gKGJpbmRpbmdzLCB2aWV3KSB7XG4gIHZpZXcub25WaWV3Q3JlYXRlZChmdW5jdGlvbiAoKSB7XG4gICAgT2JqZWN0LmVudHJpZXMoYmluZGluZ3MpLmZvckVhY2goZnVuY3Rpb24gKFtuYW1lLCBiaW5kaW5nXSkge1xuICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXSA9IG5ldyBSZWFjdGl2ZVZhcigpO1xuICAgICAgaWYgKHR5cGVvZiBiaW5kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXS5zZXQoYmluZGluZygpKTtcbiAgICAgICAgfSwgdmlldy5wYXJlbnRWaWV3KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZpZXcuX3Njb3BlQmluZGluZ3NbbmFtZV0uc2V0KGJpbmRpbmcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0cyBhIFZpZXcgc2V0dGluZyB0aGUgbG9jYWwgbGV4aWNhbCBzY29wZSBpbiB0aGUgYmxvY2suXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBiaW5kaW5ncyBEaWN0aW9uYXJ5IG1hcHBpbmcgbmFtZXMgb2YgYmluZGluZ3MgdG9cbiAqIHZhbHVlcyBvciBjb21wdXRhdGlvbnMgdG8gcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICovXG5CbGF6ZS5MZXQgPSBmdW5jdGlvbiAoYmluZGluZ3MsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnbGV0JywgY29udGVudEZ1bmMpO1xuICBCbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcoYmluZGluZ3MsIHZpZXcpO1xuXG4gIHJldHVybiB2aWV3O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgY29udGVudCBjb25kaXRpb25hbGx5LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY29uZGl0aW9uRnVuYyBBIGZ1bmN0aW9uIHRvIHJlYWN0aXZlbHkgcmUtcnVuLiAgV2hldGhlciB0aGUgcmVzdWx0IGlzIHRydXRoeSBvciBmYWxzeSBkZXRlcm1pbmVzIHdoZXRoZXIgYGNvbnRlbnRGdW5jYCBvciBgZWxzZUZ1bmNgIGlzIHNob3duLiAgQW4gZW1wdHkgYXJyYXkgaXMgY29uc2lkZXJlZCBmYWxzeS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZWxzZUZ1bmNdIE9wdGlvbmFsLiAgQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS4gIElmIG5vIGBlbHNlRnVuY2AgaXMgc3VwcGxpZWQsIG5vIGNvbnRlbnQgaXMgc2hvd24gaW4gdGhlIFwiZWxzZVwiIGNhc2UuXG4gKi9cbkJsYXplLklmID0gZnVuY3Rpb24gKGNvbmRpdGlvbkZ1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYywgX25vdCkge1xuICB2YXIgY29uZGl0aW9uVmFyID0gbmV3IFJlYWN0aXZlVmFyO1xuXG4gIHZhciB2aWV3ID0gQmxhemUuVmlldyhfbm90ID8gJ3VubGVzcycgOiAnaWYnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGNvbmRpdGlvblZhci5nZXQoKSA/IGNvbnRlbnRGdW5jKCkgOlxuICAgICAgKGVsc2VGdW5jID8gZWxzZUZ1bmMoKSA6IG51bGwpO1xuICB9KTtcbiAgdmlldy5fX2NvbmRpdGlvblZhciA9IGNvbmRpdGlvblZhcjtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbmQgPSBCbGF6ZS5fY2FsY3VsYXRlQ29uZGl0aW9uKGNvbmRpdGlvbkZ1bmMoKSk7XG4gICAgICBjb25kaXRpb25WYXIuc2V0KF9ub3QgPyAoISBjb25kKSA6IGNvbmQpO1xuICAgIH0sIHRoaXMucGFyZW50VmlldywgJ2NvbmRpdGlvbicpO1xuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQW4gaW52ZXJ0ZWQgW2BCbGF6ZS5JZmBdKCNCbGF6ZS1JZikuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb25kaXRpb25GdW5jIEEgZnVuY3Rpb24gdG8gcmVhY3RpdmVseSByZS1ydW4uICBJZiB0aGUgcmVzdWx0IGlzIGZhbHN5LCBgY29udGVudEZ1bmNgIGlzIHNob3duLCBvdGhlcndpc2UgYGVsc2VGdW5jYCBpcyBzaG93bi4gIEFuIGVtcHR5IGFycmF5IGlzIGNvbnNpZGVyZWQgZmFsc3kuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2Vsc2VGdW5jXSBPcHRpb25hbC4gIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBJZiBubyBgZWxzZUZ1bmNgIGlzIHN1cHBsaWVkLCBubyBjb250ZW50IGlzIHNob3duIGluIHRoZSBcImVsc2VcIiBjYXNlLlxuICovXG5CbGF6ZS5Vbmxlc3MgPSBmdW5jdGlvbiAoY29uZGl0aW9uRnVuYywgY29udGVudEZ1bmMsIGVsc2VGdW5jKSB7XG4gIHJldHVybiBCbGF6ZS5JZihjb25kaXRpb25GdW5jLCBjb250ZW50RnVuYywgZWxzZUZ1bmMsIHRydWUgLypfbm90Ki8pO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgYGNvbnRlbnRGdW5jYCBmb3IgZWFjaCBpdGVtIGluIGEgc2VxdWVuY2UuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhcmdGdW5jIEEgZnVuY3Rpb24gdG8gcmVhY3RpdmVseSByZS1ydW4uIFRoZSBmdW5jdGlvbiBjYW5cbiAqIHJldHVybiBvbmUgb2YgdHdvIG9wdGlvbnM6XG4gKlxuICogMS4gQW4gb2JqZWN0IHdpdGggdHdvIGZpZWxkczogJ192YXJpYWJsZScgYW5kICdfc2VxdWVuY2UnLiBFYWNoIGl0ZXJhdGVzIG92ZXJcbiAqICAgJ19zZXF1ZW5jZScsIGl0IG1heSBiZSBhIEN1cnNvciwgYW4gYXJyYXksIG51bGwsIG9yIHVuZGVmaW5lZC4gSW5zaWRlIHRoZVxuICogICBFYWNoIGJvZHkgeW91IHdpbGwgYmUgYWJsZSB0byBnZXQgdGhlIGN1cnJlbnQgaXRlbSBmcm9tIHRoZSBzZXF1ZW5jZSB1c2luZ1xuICogICB0aGUgbmFtZSBzcGVjaWZpZWQgaW4gdGhlICdfdmFyaWFibGUnIGZpZWxkLlxuICpcbiAqIDIuIEp1c3QgYSBzZXF1ZW5jZSAoQ3Vyc29yLCBhcnJheSwgbnVsbCwgb3IgdW5kZWZpbmVkKSBub3Qgd3JhcHBlZCBpbnRvIGFuXG4gKiAgIG9iamVjdC4gSW5zaWRlIHRoZSBFYWNoIGJvZHksIHRoZSBjdXJyZW50IGl0ZW0gd2lsbCBiZSBzZXQgYXMgdGhlIGRhdGFcbiAqICAgY29udGV4dC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zICBbKnJlbmRlcmFibGVcbiAqIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtlbHNlRnVuY10gQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlXG4gKiBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkgdG8gZGlzcGxheSBpbiB0aGUgY2FzZSB3aGVuIHRoZXJlIGFyZSBubyBpdGVtc1xuICogaW4gdGhlIHNlcXVlbmNlLlxuICovXG5CbGF6ZS5FYWNoID0gZnVuY3Rpb24gKGFyZ0Z1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYykge1xuICB2YXIgZWFjaFZpZXcgPSBCbGF6ZS5WaWV3KCdlYWNoJywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdWJ2aWV3cyA9IHRoaXMuaW5pdGlhbFN1YnZpZXdzO1xuICAgIHRoaXMuaW5pdGlhbFN1YnZpZXdzID0gbnVsbDtcbiAgICBpZiAodGhpcy5faXNDcmVhdGVkRm9yRXhwYW5zaW9uKSB7XG4gICAgICB0aGlzLmV4cGFuZGVkVmFsdWVEZXAgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5O1xuICAgICAgdGhpcy5leHBhbmRlZFZhbHVlRGVwLmRlcGVuZCgpO1xuICAgIH1cbiAgICByZXR1cm4gc3Vidmlld3M7XG4gIH0pO1xuICBlYWNoVmlldy5pbml0aWFsU3Vidmlld3MgPSBbXTtcbiAgZWFjaFZpZXcubnVtSXRlbXMgPSAwO1xuICBlYWNoVmlldy5pbkVsc2VNb2RlID0gZmFsc2U7XG4gIGVhY2hWaWV3LnN0b3BIYW5kbGUgPSBudWxsO1xuICBlYWNoVmlldy5jb250ZW50RnVuYyA9IGNvbnRlbnRGdW5jO1xuICBlYWNoVmlldy5lbHNlRnVuYyA9IGVsc2VGdW5jO1xuICBlYWNoVmlldy5hcmdWYXIgPSBuZXcgUmVhY3RpdmVWYXI7XG4gIGVhY2hWaWV3LnZhcmlhYmxlTmFtZSA9IG51bGw7XG5cbiAgLy8gdXBkYXRlIHRoZSBAaW5kZXggdmFsdWUgaW4gdGhlIHNjb3BlIG9mIGFsbCBzdWJ2aWV3cyBpbiB0aGUgcmFuZ2VcbiAgdmFyIHVwZGF0ZUluZGljZXMgPSBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcbiAgICBpZiAodG8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdG8gPSBlYWNoVmlldy5udW1JdGVtcyAtIDE7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IGZyb207IGkgPD0gdG87IGkrKykge1xuICAgICAgdmFyIHZpZXcgPSBlYWNoVmlldy5fZG9tcmFuZ2UubWVtYmVyc1tpXS52aWV3O1xuICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1snQGluZGV4J10uc2V0KGkpO1xuICAgIH1cbiAgfTtcblxuICBlYWNoVmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBXZSBldmFsdWF0ZSBhcmdGdW5jIGluIGFuIGF1dG9ydW4gdG8gbWFrZSBzdXJlXG4gICAgLy8gQmxhemUuY3VycmVudFZpZXcgaXMgYWx3YXlzIHNldCB3aGVuIGl0IHJ1bnMgKHJhdGhlciB0aGFuXG4gICAgLy8gcGFzc2luZyBhcmdGdW5jIHN0cmFpZ2h0IHRvIE9ic2VydmVTZXF1ZW5jZSkuXG4gICAgZWFjaFZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBhcmdGdW5jIGNhbiByZXR1cm4gZWl0aGVyIGEgc2VxdWVuY2UgYXMgaXMgb3IgYSB3cmFwcGVyIG9iamVjdCB3aXRoIGFcbiAgICAgIC8vIF9zZXF1ZW5jZSBhbmQgX3ZhcmlhYmxlIGZpZWxkcyBzZXQuXG4gICAgICB2YXIgYXJnID0gYXJnRnVuYygpO1xuICAgICAgaWYgKGlzT2JqZWN0KGFyZykgJiYgaGFzKGFyZywgJ19zZXF1ZW5jZScpKSB7XG4gICAgICAgIGVhY2hWaWV3LnZhcmlhYmxlTmFtZSA9IGFyZy5fdmFyaWFibGUgfHwgbnVsbDtcbiAgICAgICAgYXJnID0gYXJnLl9zZXF1ZW5jZTtcbiAgICAgIH1cblxuICAgICAgZWFjaFZpZXcuYXJnVmFyLnNldChhcmcpO1xuICAgIH0sIGVhY2hWaWV3LnBhcmVudFZpZXcsICdjb2xsZWN0aW9uJyk7XG5cbiAgICBlYWNoVmlldy5zdG9wSGFuZGxlID0gT2JzZXJ2ZVNlcXVlbmNlLm9ic2VydmUoZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGVhY2hWaWV3LmFyZ1Zhci5nZXQoKTtcbiAgICB9LCB7XG4gICAgICBhZGRlZEF0OiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBuZXdJdGVtVmlldztcbiAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICAvLyBuZXctc3R5bGUgI2VhY2ggKGFzIGluIHt7I2VhY2ggaXRlbSBpbiBpdGVtc319KVxuICAgICAgICAgICAgLy8gZG9lc24ndCBjcmVhdGUgYSBuZXcgZGF0YSBjb250ZXh0XG4gICAgICAgICAgICBuZXdJdGVtVmlldyA9IEJsYXplLlZpZXcoJ2l0ZW0nLCBlYWNoVmlldy5jb250ZW50RnVuYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld0l0ZW1WaWV3ID0gQmxhemUuV2l0aChpdGVtLCBlYWNoVmlldy5jb250ZW50RnVuYyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZWFjaFZpZXcubnVtSXRlbXMrKztcblxuICAgICAgICAgIHZhciBiaW5kaW5ncyA9IHt9O1xuICAgICAgICAgIGJpbmRpbmdzWydAaW5kZXgnXSA9IGluZGV4O1xuICAgICAgICAgIGlmIChlYWNoVmlldy52YXJpYWJsZU5hbWUpIHtcbiAgICAgICAgICAgIGJpbmRpbmdzW2VhY2hWaWV3LnZhcmlhYmxlTmFtZV0gPSBpdGVtO1xuICAgICAgICAgIH1cbiAgICAgICAgICBCbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcoYmluZGluZ3MsIG5ld0l0ZW1WaWV3KTtcblxuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LmluRWxzZU1vZGUpIHtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLnJlbW92ZU1lbWJlcigwKTtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuaW5FbHNlTW9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmFuZ2UgPSBCbGF6ZS5fbWF0ZXJpYWxpemVWaWV3KG5ld0l0ZW1WaWV3LCBlYWNoVmlldyk7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UuYWRkTWVtYmVyKHJhbmdlLCBpbmRleCk7XG4gICAgICAgICAgICB1cGRhdGVJbmRpY2VzKGluZGV4KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzLnNwbGljZShpbmRleCwgMCwgbmV3SXRlbVZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgcmVtb3ZlZEF0OiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGVhY2hWaWV3Lm51bUl0ZW1zLS07XG4gICAgICAgICAgaWYgKGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXApIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXAuY2hhbmdlZCgpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZWFjaFZpZXcuX2RvbXJhbmdlKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UucmVtb3ZlTWVtYmVyKGluZGV4KTtcbiAgICAgICAgICAgIHVwZGF0ZUluZGljZXMoaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LmVsc2VGdW5jICYmIGVhY2hWaWV3Lm51bUl0ZW1zID09PSAwKSB7XG4gICAgICAgICAgICAgIGVhY2hWaWV3LmluRWxzZU1vZGUgPSB0cnVlO1xuICAgICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UuYWRkTWVtYmVyKFxuICAgICAgICAgICAgICAgIEJsYXplLl9tYXRlcmlhbGl6ZVZpZXcoXG4gICAgICAgICAgICAgICAgICBCbGF6ZS5WaWV3KCdlYWNoX2Vsc2UnLGVhY2hWaWV3LmVsc2VGdW5jKSxcbiAgICAgICAgICAgICAgICAgIGVhY2hWaWV3KSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgY2hhbmdlZEF0OiBmdW5jdGlvbiAoaWQsIG5ld0l0ZW0sIG9sZEl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGl0ZW1WaWV3O1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgICBpdGVtVmlldyA9IGVhY2hWaWV3Ll9kb21yYW5nZS5nZXRNZW1iZXIoaW5kZXgpLnZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpdGVtVmlldyA9IGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3c1tpbmRleF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICAgIGl0ZW1WaWV3Ll9zY29wZUJpbmRpbmdzW2VhY2hWaWV3LnZhcmlhYmxlTmFtZV0uc2V0KG5ld0l0ZW0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXRlbVZpZXcuZGF0YVZhci5zZXQobmV3SXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBtb3ZlZFRvOiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGZyb21JbmRleCwgdG9JbmRleCkge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcCkge1xuICAgICAgICAgICAgZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcC5jaGFuZ2VkKCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChlYWNoVmlldy5fZG9tcmFuZ2UpIHtcbiAgICAgICAgICAgIGVhY2hWaWV3Ll9kb21yYW5nZS5tb3ZlTWVtYmVyKGZyb21JbmRleCwgdG9JbmRleCk7XG4gICAgICAgICAgICB1cGRhdGVJbmRpY2VzKFxuICAgICAgICAgICAgICBNYXRoLm1pbihmcm9tSW5kZXgsIHRvSW5kZXgpLCBNYXRoLm1heChmcm9tSW5kZXgsIHRvSW5kZXgpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHN1YnZpZXdzID0gZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzO1xuICAgICAgICAgICAgdmFyIGl0ZW1WaWV3ID0gc3Vidmlld3NbZnJvbUluZGV4XTtcbiAgICAgICAgICAgIHN1YnZpZXdzLnNwbGljZShmcm9tSW5kZXgsIDEpO1xuICAgICAgICAgICAgc3Vidmlld3Muc3BsaWNlKHRvSW5kZXgsIDAsIGl0ZW1WaWV3KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGVhY2hWaWV3LmVsc2VGdW5jICYmIGVhY2hWaWV3Lm51bUl0ZW1zID09PSAwKSB7XG4gICAgICBlYWNoVmlldy5pbkVsc2VNb2RlID0gdHJ1ZTtcbiAgICAgIGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3c1swXSA9XG4gICAgICAgIEJsYXplLlZpZXcoJ2VhY2hfZWxzZScsIGVhY2hWaWV3LmVsc2VGdW5jKTtcbiAgICB9XG4gIH0pO1xuXG4gIGVhY2hWaWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGVhY2hWaWV3LnN0b3BIYW5kbGUpXG4gICAgICBlYWNoVmlldy5zdG9wSGFuZGxlLnN0b3AoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGVhY2hWaWV3O1xufTtcblxuQmxhemUuX1RlbXBsYXRlV2l0aCA9IGZ1bmN0aW9uIChhcmcsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB3O1xuXG4gIHZhciBhcmdGdW5jID0gYXJnO1xuICBpZiAodHlwZW9mIGFyZyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIGFyZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYXJnO1xuICAgIH07XG4gIH1cblxuICAvLyBUaGlzIGlzIGEgbGl0dGxlIG1lc3N5LiAgV2hlbiB3ZSBjb21waWxlIGB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrfX1gLCB3ZVxuICAvLyB3cmFwIGl0IGluIEJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZSBpbiBvcmRlciB0byBza2lwIHRoZSBpbnRlcm1lZGlhdGVcbiAgLy8gcGFyZW50IFZpZXdzIGluIHRoZSBjdXJyZW50IHRlbXBsYXRlLiAgSG93ZXZlciwgd2hlbiB0aGVyZSdzIGFuIGFyZ3VtZW50XG4gIC8vIChge3s+IFRlbXBsYXRlLmNvbnRlbnRCbG9jayBhcmd9fWApLCB0aGUgYXJndW1lbnQgbmVlZHMgdG8gYmUgZXZhbHVhdGVkXG4gIC8vIGluIHRoZSBvcmlnaW5hbCBzY29wZS4gIFRoZXJlJ3Mgbm8gZ29vZCBvcmRlciB0byBuZXN0XG4gIC8vIEJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZSBhbmQgQmxhemUuX1RlbXBsYXRlV2l0aCB0byBhY2hpZXZlIHRoaXMsXG4gIC8vIHNvIHdlIHdyYXAgYXJnRnVuYyB0byBydW4gaXQgaW4gdGhlIFwib3JpZ2luYWwgcGFyZW50Vmlld1wiIG9mIHRoZVxuICAvLyBCbGF6ZS5fSW5PdXRlclRlbXBsYXRlU2NvcGUuXG4gIC8vXG4gIC8vIFRvIG1ha2UgdGhpcyBiZXR0ZXIsIHJlY29uc2lkZXIgX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIGFzIGEgcHJpbWl0aXZlLlxuICAvLyBMb25nZXIgdGVybSwgZXZhbHVhdGUgZXhwcmVzc2lvbnMgaW4gdGhlIHByb3BlciBsZXhpY2FsIHNjb3BlLlxuICB2YXIgd3JhcHBlZEFyZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHZpZXdUb0V2YWx1YXRlQXJnID0gbnVsbDtcbiAgICBpZiAody5wYXJlbnRWaWV3ICYmIHcucGFyZW50Vmlldy5uYW1lID09PSAnSW5PdXRlclRlbXBsYXRlU2NvcGUnKSB7XG4gICAgICB2aWV3VG9FdmFsdWF0ZUFyZyA9IHcucGFyZW50Vmlldy5vcmlnaW5hbFBhcmVudFZpZXc7XG4gICAgfVxuICAgIGlmICh2aWV3VG9FdmFsdWF0ZUFyZykge1xuICAgICAgcmV0dXJuIEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlld1RvRXZhbHVhdGVBcmcsIGFyZ0Z1bmMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYXJnRnVuYygpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgd3JhcHBlZENvbnRlbnRGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjb250ZW50ID0gY29udGVudEZ1bmMuY2FsbCh0aGlzKTtcblxuICAgIC8vIFNpbmNlIHdlIGFyZSBnZW5lcmF0aW5nIHRoZSBCbGF6ZS5fVGVtcGxhdGVXaXRoIHZpZXcgZm9yIHRoZVxuICAgIC8vIHVzZXIsIHNldCB0aGUgZmxhZyBvbiB0aGUgY2hpbGQgdmlldy4gIElmIGBjb250ZW50YCBpcyBhIHRlbXBsYXRlLFxuICAgIC8vIGNvbnN0cnVjdCB0aGUgVmlldyBzbyB0aGF0IHdlIGNhbiBzZXQgdGhlIGZsYWcuXG4gICAgaWYgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZSkge1xuICAgICAgY29udGVudCA9IGNvbnRlbnQuY29uc3RydWN0VmlldygpO1xuICAgIH1cbiAgICBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHtcbiAgICAgIGNvbnRlbnQuX2hhc0dlbmVyYXRlZFBhcmVudCA9IHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH07XG5cbiAgdyA9IEJsYXplLldpdGgod3JhcHBlZEFyZ0Z1bmMsIHdyYXBwZWRDb250ZW50RnVuYyk7XG4gIHcuX19pc1RlbXBsYXRlV2l0aCA9IHRydWU7XG4gIHJldHVybiB3O1xufTtcblxuQmxhemUuX0luT3V0ZXJUZW1wbGF0ZVNjb3BlID0gZnVuY3Rpb24gKHRlbXBsYXRlVmlldywgY29udGVudEZ1bmMpIHtcbiAgdmFyIHZpZXcgPSBCbGF6ZS5WaWV3KCdJbk91dGVyVGVtcGxhdGVTY29wZScsIGNvbnRlbnRGdW5jKTtcbiAgdmFyIHBhcmVudFZpZXcgPSB0ZW1wbGF0ZVZpZXcucGFyZW50VmlldztcblxuICAvLyBIYWNrIHNvIHRoYXQgaWYgeW91IGNhbGwgYHt7PiBmb28gYmFyfX1gIGFuZCBpdCBleHBhbmRzIGludG9cbiAgLy8gYHt7I3dpdGggYmFyfX17ez4gZm9vfX17ey93aXRofX1gLCBhbmQgdGhlbiBgZm9vYCBpcyBhIHRlbXBsYXRlXG4gIC8vIHRoYXQgaW5zZXJ0cyBge3s+IFRlbXBsYXRlLmNvbnRlbnRCbG9ja319YCwgdGhlIGRhdGEgY29udGV4dCBmb3JcbiAgLy8gYFRlbXBsYXRlLmNvbnRlbnRCbG9ja2AgaXMgbm90IGBiYXJgIGJ1dCB0aGUgb25lIGVuY2xvc2luZyB0aGF0LlxuICBpZiAocGFyZW50Vmlldy5fX2lzVGVtcGxhdGVXaXRoKVxuICAgIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3LnBhcmVudFZpZXc7XG5cbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm9yaWdpbmFsUGFyZW50VmlldyA9IHRoaXMucGFyZW50VmlldztcbiAgICB0aGlzLnBhcmVudFZpZXcgPSBwYXJlbnRWaWV3O1xuICAgIHRoaXMuX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlID0gdHJ1ZTtcbiAgfSk7XG4gIHJldHVybiB2aWV3O1xufTtcblxuIiwiaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcblxuQmxhemUuX2dsb2JhbEhlbHBlcnMgPSB7fTtcblxuLy8gRG9jdW1lbnRlZCBhcyBUZW1wbGF0ZS5yZWdpc3RlckhlbHBlci5cbi8vIFRoaXMgZGVmaW5pdGlvbiBhbHNvIHByb3ZpZGVzIGJhY2stY29tcGF0IGZvciBgVUkucmVnaXN0ZXJIZWxwZXJgLlxuQmxhemUucmVnaXN0ZXJIZWxwZXIgPSBmdW5jdGlvbiAobmFtZSwgZnVuYykge1xuICBCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXSA9IGZ1bmM7XG59O1xuXG4vLyBBbHNvIGRvY3VtZW50ZWQgYXMgVGVtcGxhdGUuZGVyZWdpc3RlckhlbHBlclxuQmxhemUuZGVyZWdpc3RlckhlbHBlciA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgZGVsZXRlIEJsYXplLl9nbG9iYWxIZWxwZXJzW25hbWVdO1xufTtcblxudmFyIGJpbmRJZklzRnVuY3Rpb24gPSBmdW5jdGlvbiAoeCwgdGFyZ2V0KSB7XG4gIGlmICh0eXBlb2YgeCAhPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4geDtcbiAgcmV0dXJuIEJsYXplLl9iaW5kKHgsIHRhcmdldCk7XG59O1xuXG4vLyBJZiBgeGAgaXMgYSBmdW5jdGlvbiwgYmluZHMgdGhlIHZhbHVlIG9mIGB0aGlzYCBmb3IgdGhhdCBmdW5jdGlvblxuLy8gdG8gdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0LlxudmFyIGJpbmREYXRhQ29udGV4dCA9IGZ1bmN0aW9uICh4KSB7XG4gIGlmICh0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgZGF0YSA9IEJsYXplLmdldERhdGEoKTtcbiAgICAgIGlmIChkYXRhID09IG51bGwpXG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIHJldHVybiB4LmFwcGx5KGRhdGEsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4geDtcbn07XG5cbkJsYXplLl9PTERTVFlMRV9IRUxQRVIgPSB7fTtcblxuQmxhemUuX2dldFRlbXBsYXRlSGVscGVyID0gZnVuY3Rpb24gKHRlbXBsYXRlLCBuYW1lLCB0bXBsSW5zdGFuY2VGdW5jKSB7XG4gIC8vIFhYWCBDT01QQVQgV0lUSCAwLjkuM1xuICB2YXIgaXNLbm93bk9sZFN0eWxlSGVscGVyID0gZmFsc2U7XG5cbiAgaWYgKHRlbXBsYXRlLl9faGVscGVycy5oYXMobmFtZSkpIHtcbiAgICB2YXIgaGVscGVyID0gdGVtcGxhdGUuX19oZWxwZXJzLmdldChuYW1lKTtcbiAgICBpZiAoaGVscGVyID09PSBCbGF6ZS5fT0xEU1RZTEVfSEVMUEVSKSB7XG4gICAgICBpc0tub3duT2xkU3R5bGVIZWxwZXIgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaGVscGVyICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB3cmFwSGVscGVyKGJpbmREYXRhQ29udGV4dChoZWxwZXIpLCB0bXBsSW5zdGFuY2VGdW5jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gb2xkLXN0eWxlIGhlbHBlclxuICBpZiAobmFtZSBpbiB0ZW1wbGF0ZSkge1xuICAgIC8vIE9ubHkgd2FybiBvbmNlIHBlciBoZWxwZXJcbiAgICBpZiAoISBpc0tub3duT2xkU3R5bGVIZWxwZXIpIHtcbiAgICAgIHRlbXBsYXRlLl9faGVscGVycy5zZXQobmFtZSwgQmxhemUuX09MRFNUWUxFX0hFTFBFUik7XG4gICAgICBpZiAoISB0ZW1wbGF0ZS5fTk9XQVJOX09MRFNUWUxFX0hFTFBFUlMpIHtcbiAgICAgICAgQmxhemUuX3dhcm4oJ0Fzc2lnbmluZyBoZWxwZXIgd2l0aCBgJyArIHRlbXBsYXRlLnZpZXdOYW1lICsgJy4nICtcbiAgICAgICAgICAgICAgICAgICAgbmFtZSArICcgPSAuLi5gIGlzIGRlcHJlY2F0ZWQuICBVc2UgYCcgKyB0ZW1wbGF0ZS52aWV3TmFtZSArXG4gICAgICAgICAgICAgICAgICAgICcuaGVscGVycyguLi4pYCBpbnN0ZWFkLicpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGVtcGxhdGVbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHdyYXBIZWxwZXIoYmluZERhdGFDb250ZXh0KHRlbXBsYXRlW25hbWVdKSwgdG1wbEluc3RhbmNlRnVuYyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG52YXIgd3JhcEhlbHBlciA9IGZ1bmN0aW9uIChmLCB0ZW1wbGF0ZUZ1bmMpIHtcbiAgaWYgKHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICByZXR1cm4gZjtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuXG4gICAgcmV0dXJuIEJsYXplLlRlbXBsYXRlLl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmModGVtcGxhdGVGdW5jLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gQmxhemUuX3dyYXBDYXRjaGluZ0V4Y2VwdGlvbnMoZiwgJ3RlbXBsYXRlIGhlbHBlcicpLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xufTtcblxuZnVuY3Rpb24gX2xleGljYWxLZWVwR29pbmcoY3VycmVudFZpZXcpIHtcbiAgaWYgKCFjdXJyZW50Vmlldy5wYXJlbnRWaWV3KSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICBpZiAoIWN1cnJlbnRWaWV3Ll9fc3RhcnRzTmV3TGV4aWNhbFNjb3BlKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWaWV3LnBhcmVudFZpZXc7XG4gIH1cbiAgaWYgKGN1cnJlbnRWaWV3LnBhcmVudFZpZXcuX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWaWV3LnBhcmVudFZpZXc7XG4gIH1cbiAgXG4gIC8vIGluIHRoZSBjYXNlIG9mIHt7PiBUZW1wbGF0ZS5jb250ZW50QmxvY2sgZGF0YX19IHRoZSBjb250ZW50QmxvY2sgbG9zZXMgdGhlIGxleGljYWwgc2NvcGUgb2YgaXQncyBwYXJlbnQsIHdoZXJhcyB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrfX0gaXQgZG9lcyBub3RcbiAgLy8gdGhpcyBpcyBiZWNhdXNlIGEgI3dpdGggc2l0cyBiZXR3ZWVuIHRoZSBpbmNsdWRlIEluT3V0ZXJUZW1wbGF0ZVNjb3BlXG4gIGlmIChjdXJyZW50Vmlldy5wYXJlbnRWaWV3Lm5hbWUgPT09IFwid2l0aFwiICYmIGN1cnJlbnRWaWV3LnBhcmVudFZpZXcucGFyZW50VmlldyAmJiBjdXJyZW50Vmlldy5wYXJlbnRWaWV3LnBhcmVudFZpZXcuX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWaWV3LnBhcmVudFZpZXc7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuQmxhemUuX2xleGljYWxCaW5kaW5nTG9va3VwID0gZnVuY3Rpb24gKHZpZXcsIG5hbWUpIHtcbiAgdmFyIGN1cnJlbnRWaWV3ID0gdmlldztcbiAgdmFyIGJsb2NrSGVscGVyc1N0YWNrID0gW107XG5cbiAgLy8gd2FsayB1cCB0aGUgdmlld3Mgc3RvcHBpbmcgYXQgYSBTcGFjZWJhcnMuaW5jbHVkZSBvciBUZW1wbGF0ZSB2aWV3IHRoYXRcbiAgLy8gZG9lc24ndCBoYXZlIGFuIEluT3V0ZXJUZW1wbGF0ZVNjb3BlIHZpZXcgYXMgYSBwYXJlbnRcbiAgZG8ge1xuICAgIC8vIHNraXAgYmxvY2sgaGVscGVycyB2aWV3c1xuICAgIC8vIGlmIHdlIGZvdW5kIHRoZSBiaW5kaW5nIG9uIHRoZSBzY29wZSwgcmV0dXJuIGl0XG4gICAgaWYgKGhhcyhjdXJyZW50Vmlldy5fc2NvcGVCaW5kaW5ncywgbmFtZSkpIHtcbiAgICAgIHZhciBiaW5kaW5nUmVhY3RpdmVWYXIgPSBjdXJyZW50Vmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXTtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBiaW5kaW5nUmVhY3RpdmVWYXIuZ2V0KCk7XG4gICAgICB9O1xuICAgIH1cbiAgfSB3aGlsZSAoY3VycmVudFZpZXcgPSBfbGV4aWNhbEtlZXBHb2luZyhjdXJyZW50VmlldykpO1xuXG4gIHJldHVybiBudWxsO1xufTtcblxuLy8gdGVtcGxhdGVJbnN0YW5jZSBhcmd1bWVudCBpcyBwcm92aWRlZCB0byBiZSBhdmFpbGFibGUgZm9yIHBvc3NpYmxlXG4vLyBhbHRlcm5hdGl2ZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhpcyBmdW5jdGlvbiBieSAzcmQgcGFydHkgcGFja2FnZXMuXG5CbGF6ZS5fZ2V0VGVtcGxhdGUgPSBmdW5jdGlvbiAobmFtZSwgdGVtcGxhdGVJbnN0YW5jZSkge1xuICBpZiAoKG5hbWUgaW4gQmxhemUuVGVtcGxhdGUpICYmIChCbGF6ZS5UZW1wbGF0ZVtuYW1lXSBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSkge1xuICAgIHJldHVybiBCbGF6ZS5UZW1wbGF0ZVtuYW1lXTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbkJsYXplLl9nZXRHbG9iYWxIZWxwZXIgPSBmdW5jdGlvbiAobmFtZSwgdGVtcGxhdGVJbnN0YW5jZSkge1xuICBpZiAoQmxhemUuX2dsb2JhbEhlbHBlcnNbbmFtZV0gIT0gbnVsbCkge1xuICAgIHJldHVybiB3cmFwSGVscGVyKGJpbmREYXRhQ29udGV4dChCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXSksIHRlbXBsYXRlSW5zdGFuY2UpO1xuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuLy8gTG9va3MgdXAgYSBuYW1lLCBsaWtlIFwiZm9vXCIgb3IgXCIuLlwiLCBhcyBhIGhlbHBlciBvZiB0aGVcbi8vIGN1cnJlbnQgdGVtcGxhdGU7IHRoZSBuYW1lIG9mIGEgdGVtcGxhdGU7IGEgZ2xvYmFsIGhlbHBlcjtcbi8vIG9yIGEgcHJvcGVydHkgb2YgdGhlIGRhdGEgY29udGV4dC4gIENhbGxlZCBvbiB0aGUgVmlldyBvZlxuLy8gYSB0ZW1wbGF0ZSAoaS5lLiBhIFZpZXcgd2l0aCBhIGAudGVtcGxhdGVgIHByb3BlcnR5LFxuLy8gd2hlcmUgdGhlIGhlbHBlcnMgYXJlKS4gIFVzZWQgZm9yIHRoZSBmaXJzdCBuYW1lIGluIGFcbi8vIFwicGF0aFwiIGluIGEgdGVtcGxhdGUgdGFnLCBsaWtlIFwiZm9vXCIgaW4gYHt7Zm9vLmJhcn19YCBvclxuLy8gXCIuLlwiIGluIGB7e2Zyb2J1bGF0ZSAuLi9ibGFofX1gLlxuLy9cbi8vIFJldHVybnMgYSBmdW5jdGlvbiwgYSBub24tZnVuY3Rpb24gdmFsdWUsIG9yIG51bGwuICBJZlxuLy8gYSBmdW5jdGlvbiBpcyBmb3VuZCwgaXQgaXMgYm91bmQgYXBwcm9wcmlhdGVseS5cbi8vXG4vLyBOT1RFOiBUaGlzIGZ1bmN0aW9uIG11c3Qgbm90IGVzdGFibGlzaCBhbnkgcmVhY3RpdmVcbi8vIGRlcGVuZGVuY2llcyBpdHNlbGYuICBJZiB0aGVyZSBpcyBhbnkgcmVhY3Rpdml0eSBpbiB0aGVcbi8vIHZhbHVlLCBsb29rdXAgc2hvdWxkIHJldHVybiBhIGZ1bmN0aW9uLlxuQmxhemUuVmlldy5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gKG5hbWUsIF9vcHRpb25zKSB7XG4gIHZhciB0ZW1wbGF0ZSA9IHRoaXMudGVtcGxhdGU7XG4gIHZhciBsb29rdXBUZW1wbGF0ZSA9IF9vcHRpb25zICYmIF9vcHRpb25zLnRlbXBsYXRlO1xuICB2YXIgaGVscGVyO1xuICB2YXIgYmluZGluZztcbiAgdmFyIGJvdW5kVG1wbEluc3RhbmNlO1xuICB2YXIgZm91bmRUZW1wbGF0ZTtcblxuICBpZiAodGhpcy50ZW1wbGF0ZUluc3RhbmNlKSB7XG4gICAgYm91bmRUbXBsSW5zdGFuY2UgPSBCbGF6ZS5fYmluZCh0aGlzLnRlbXBsYXRlSW5zdGFuY2UsIHRoaXMpO1xuICB9XG5cbiAgLy8gMC4gbG9va2luZyB1cCB0aGUgcGFyZW50IGRhdGEgY29udGV4dCB3aXRoIHRoZSBzcGVjaWFsIFwiLi4vXCIgc3ludGF4XG4gIGlmICgvXlxcLi8udGVzdChuYW1lKSkge1xuICAgIC8vIHN0YXJ0cyB3aXRoIGEgZG90LiBtdXN0IGJlIGEgc2VyaWVzIG9mIGRvdHMgd2hpY2ggbWFwcyB0byBhblxuICAgIC8vIGFuY2VzdG9yIG9mIHRoZSBhcHByb3ByaWF0ZSBoZWlnaHQuXG4gICAgaWYgKCEvXihcXC4pKyQvLnRlc3QobmFtZSkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpZCBzdGFydGluZyB3aXRoIGRvdCBtdXN0IGJlIGEgc2VyaWVzIG9mIGRvdHNcIik7XG5cbiAgICByZXR1cm4gQmxhemUuX3BhcmVudERhdGEobmFtZS5sZW5ndGggLSAxLCB0cnVlIC8qX2Z1bmN0aW9uV3JhcHBlZCovKTtcblxuICB9XG5cbiAgLy8gMS4gbG9vayB1cCBhIGhlbHBlciBvbiB0aGUgY3VycmVudCB0ZW1wbGF0ZVxuICBpZiAodGVtcGxhdGUgJiYgKChoZWxwZXIgPSBCbGF6ZS5fZ2V0VGVtcGxhdGVIZWxwZXIodGVtcGxhdGUsIG5hbWUsIGJvdW5kVG1wbEluc3RhbmNlKSkgIT0gbnVsbCkpIHtcbiAgICByZXR1cm4gaGVscGVyO1xuICB9XG5cbiAgLy8gMi4gbG9vayB1cCBhIGJpbmRpbmcgYnkgdHJhdmVyc2luZyB0aGUgbGV4aWNhbCB2aWV3IGhpZXJhcmNoeSBpbnNpZGUgdGhlXG4gIC8vIGN1cnJlbnQgdGVtcGxhdGVcbiAgaWYgKHRlbXBsYXRlICYmIChiaW5kaW5nID0gQmxhemUuX2xleGljYWxCaW5kaW5nTG9va3VwKEJsYXplLmN1cnJlbnRWaWV3LCBuYW1lKSkgIT0gbnVsbCkge1xuICAgIHJldHVybiBiaW5kaW5nO1xuICB9XG5cbiAgLy8gMy4gbG9vayB1cCBhIHRlbXBsYXRlIGJ5IG5hbWVcbiAgaWYgKGxvb2t1cFRlbXBsYXRlICYmICgoZm91bmRUZW1wbGF0ZSA9IEJsYXplLl9nZXRUZW1wbGF0ZShuYW1lLCBib3VuZFRtcGxJbnN0YW5jZSkpICE9IG51bGwpKSB7XG4gICAgcmV0dXJuIGZvdW5kVGVtcGxhdGU7XG4gIH1cblxuICAvLyA0LiBsb29rIHVwIGEgZ2xvYmFsIGhlbHBlclxuICBpZiAoKGhlbHBlciA9IEJsYXplLl9nZXRHbG9iYWxIZWxwZXIobmFtZSwgYm91bmRUbXBsSW5zdGFuY2UpKSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIGhlbHBlcjtcbiAgfVxuXG4gIC8vIDUuIGxvb2sgdXAgaW4gYSBkYXRhIGNvbnRleHRcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaXNDYWxsZWRBc0Z1bmN0aW9uID0gKGFyZ3VtZW50cy5sZW5ndGggPiAwKTtcbiAgICB2YXIgZGF0YSA9IEJsYXplLmdldERhdGEoKTtcbiAgICB2YXIgeCA9IGRhdGEgJiYgZGF0YVtuYW1lXTtcbiAgICBpZiAoISB4KSB7XG4gICAgICBpZiAobG9va3VwVGVtcGxhdGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gc3VjaCB0ZW1wbGF0ZTogXCIgKyBuYW1lKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNDYWxsZWRBc0Z1bmN0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHN1Y2ggZnVuY3Rpb246IFwiICsgbmFtZSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUuY2hhckF0KDApID09PSAnQCcgJiYgKCh4ID09PSBudWxsKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoeCA9PT0gdW5kZWZpbmVkKSkpIHtcbiAgICAgICAgLy8gVGhyb3cgYW4gZXJyb3IgaWYgdGhlIHVzZXIgdHJpZXMgdG8gdXNlIGEgYEBkaXJlY3RpdmVgXG4gICAgICAgIC8vIHRoYXQgZG9lc24ndCBleGlzdC4gIFdlIGRvbid0IGltcGxlbWVudCBhbGwgZGlyZWN0aXZlc1xuICAgICAgICAvLyBmcm9tIEhhbmRsZWJhcnMsIHNvIHRoZXJlJ3MgYSBwb3RlbnRpYWwgZm9yIGNvbmZ1c2lvblxuICAgICAgICAvLyBpZiB3ZSBmYWlsIHNpbGVudGx5LiAgT24gdGhlIG90aGVyIGhhbmQsIHdlIHdhbnQgdG9cbiAgICAgICAgLy8gdGhyb3cgbGF0ZSBpbiBjYXNlIHNvbWUgYXBwIG9yIHBhY2thZ2Ugd2FudHMgdG8gcHJvdmlkZVxuICAgICAgICAvLyBhIG1pc3NpbmcgZGlyZWN0aXZlLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBkaXJlY3RpdmU6IFwiICsgbmFtZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghIGRhdGEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHggIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChpc0NhbGxlZEFzRnVuY3Rpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBub24tZnVuY3Rpb246IFwiICsgeCk7XG4gICAgICB9XG4gICAgICByZXR1cm4geDtcbiAgICB9XG4gICAgcmV0dXJuIHguYXBwbHkoZGF0YSwgYXJndW1lbnRzKTtcbiAgfTtcbn07XG5cbi8vIEltcGxlbWVudCBTcGFjZWJhcnMnIHt7Li4vLi59fS5cbi8vIEBwYXJhbSBoZWlnaHQge051bWJlcn0gVGhlIG51bWJlciBvZiAnLi4nc1xuQmxhemUuX3BhcmVudERhdGEgPSBmdW5jdGlvbiAoaGVpZ2h0LCBfZnVuY3Rpb25XcmFwcGVkKSB7XG4gIC8vIElmIGhlaWdodCBpcyBudWxsIG9yIHVuZGVmaW5lZCwgd2UgZGVmYXVsdCB0byAxLCB0aGUgZmlyc3QgcGFyZW50LlxuICBpZiAoaGVpZ2h0ID09IG51bGwpIHtcbiAgICBoZWlnaHQgPSAxO1xuICB9XG4gIHZhciB0aGVXaXRoID0gQmxhemUuZ2V0Vmlldygnd2l0aCcpO1xuICBmb3IgKHZhciBpID0gMDsgKGkgPCBoZWlnaHQpICYmIHRoZVdpdGg7IGkrKykge1xuICAgIHRoZVdpdGggPSBCbGF6ZS5nZXRWaWV3KHRoZVdpdGgsICd3aXRoJyk7XG4gIH1cblxuICBpZiAoISB0aGVXaXRoKVxuICAgIHJldHVybiBudWxsO1xuICBpZiAoX2Z1bmN0aW9uV3JhcHBlZClcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhlV2l0aC5kYXRhVmFyLmdldCgpOyB9O1xuICByZXR1cm4gdGhlV2l0aC5kYXRhVmFyLmdldCgpO1xufTtcblxuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5sb29rdXBUZW1wbGF0ZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHJldHVybiB0aGlzLmxvb2t1cChuYW1lLCB7dGVtcGxhdGU6dHJ1ZX0pO1xufTtcbiIsImltcG9ydCBpc09iamVjdCBmcm9tICdsb2Rhc2guaXNvYmplY3QnO1xuaW1wb3J0IGlzRnVuY3Rpb24gZnJvbSAnbG9kYXNoLmlzZnVuY3Rpb24nO1xuaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcbmltcG9ydCBpc0VtcHR5IGZyb20gJ2xvZGFzaC5pc2VtcHR5JztcblxuLy8gW25ld10gQmxhemUuVGVtcGxhdGUoW3ZpZXdOYW1lXSwgcmVuZGVyRnVuY3Rpb24pXG4vL1xuLy8gYEJsYXplLlRlbXBsYXRlYCBpcyB0aGUgY2xhc3Mgb2YgdGVtcGxhdGVzLCBsaWtlIGBUZW1wbGF0ZS5mb29gIGluXG4vLyBNZXRlb3IsIHdoaWNoIGlzIGBpbnN0YW5jZW9mIFRlbXBsYXRlYC5cbi8vXG4vLyBgdmlld0tpbmRgIGlzIGEgc3RyaW5nIHRoYXQgbG9va3MgbGlrZSBcIlRlbXBsYXRlLmZvb1wiIGZvciB0ZW1wbGF0ZXNcbi8vIGRlZmluZWQgYnkgdGhlIGNvbXBpbGVyLlxuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgVGVtcGxhdGUsIHdoaWNoIGlzIHVzZWQgdG8gY29uc3RydWN0IFZpZXdzIHdpdGggcGFydGljdWxhciBuYW1lIGFuZCBjb250ZW50LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IFt2aWV3TmFtZV0gT3B0aW9uYWwuICBBIG5hbWUgZm9yIFZpZXdzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgVGVtcGxhdGUuICBTZWUgW2B2aWV3Lm5hbWVgXSgjdmlld19uYW1lKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlbmRlckZ1bmN0aW9uIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgYXMgdGhlIGByZW5kZXJGdW5jdGlvbmAgZm9yIFZpZXdzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgVGVtcGxhdGUuXG4gKi9cbkJsYXplLlRlbXBsYXRlID0gZnVuY3Rpb24gKHZpZXdOYW1lLCByZW5kZXJGdW5jdGlvbikge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVGVtcGxhdGUodmlld05hbWUsIHJlbmRlckZ1bmN0aW9uKTtcblxuICBpZiAodHlwZW9mIHZpZXdOYW1lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gb21pdHRlZCBcInZpZXdOYW1lXCIgYXJndW1lbnRcbiAgICByZW5kZXJGdW5jdGlvbiA9IHZpZXdOYW1lO1xuICAgIHZpZXdOYW1lID0gJyc7XG4gIH1cbiAgaWYgKHR5cGVvZiB2aWV3TmFtZSAhPT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwidmlld05hbWUgbXVzdCBiZSBhIFN0cmluZyAob3Igb21pdHRlZClcIik7XG4gIGlmICh0eXBlb2YgcmVuZGVyRnVuY3Rpb24gIT09ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwicmVuZGVyRnVuY3Rpb24gbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuXG4gIHRoaXMudmlld05hbWUgPSB2aWV3TmFtZTtcbiAgdGhpcy5yZW5kZXJGdW5jdGlvbiA9IHJlbmRlckZ1bmN0aW9uO1xuXG4gIHRoaXMuX19oZWxwZXJzID0gbmV3IEhlbHBlck1hcDtcbiAgdGhpcy5fX2V2ZW50TWFwcyA9IFtdO1xuXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHtcbiAgICBjcmVhdGVkOiBbXSxcbiAgICByZW5kZXJlZDogW10sXG4gICAgZGVzdHJveWVkOiBbXVxuICB9O1xufTtcbnZhciBUZW1wbGF0ZSA9IEJsYXplLlRlbXBsYXRlO1xuXG52YXIgSGVscGVyTWFwID0gZnVuY3Rpb24gKCkge307XG5IZWxwZXJNYXAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHJldHVybiB0aGlzWycgJytuYW1lXTtcbn07XG5IZWxwZXJNYXAucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBoZWxwZXIpIHtcbiAgdGhpc1snICcrbmFtZV0gPSBoZWxwZXI7XG59O1xuSGVscGVyTWFwLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbiAobmFtZSkge1xuICByZXR1cm4gKHR5cGVvZiB0aGlzWycgJytuYW1lXSAhPT0gJ3VuZGVmaW5lZCcpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgYHZhbHVlYCBpcyBhIHRlbXBsYXRlIG9iamVjdCBsaWtlIGBUZW1wbGF0ZS5teVRlbXBsYXRlYC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gdGVzdC5cbiAqL1xuQmxhemUuaXNUZW1wbGF0ZSA9IGZ1bmN0aW9uICh0KSB7XG4gIHJldHVybiAodCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKTtcbn07XG5cbi8qKlxuICogQG5hbWUgIG9uQ3JlYXRlZFxuICogQGluc3RhbmNlXG4gKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gYW4gaW5zdGFuY2Ugb2YgdGhpcyB0ZW1wbGF0ZSBpcyBjcmVhdGVkLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uQ3JlYXRlZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZC5wdXNoKGNiKTtcbn07XG5cbi8qKlxuICogQG5hbWUgIG9uUmVuZGVyZWRcbiAqIEBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIG9mIHRoaXMgdGVtcGxhdGUgaXMgaW5zZXJ0ZWQgaW50byB0aGUgRE9NLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uUmVuZGVyZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkLnB1c2goY2IpO1xufTtcblxuLyoqXG4gKiBAbmFtZSAgb25EZXN0cm95ZWRcbiAqIEBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIG9mIHRoaXMgdGVtcGxhdGUgaXMgcmVtb3ZlZCBmcm9tIHRoZSBET00gYW5kIGRlc3Ryb3llZC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEEgZnVuY3Rpb24gdG8gYmUgYWRkZWQgYXMgYSBjYWxsYmFjay5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnByb3RvdHlwZS5vbkRlc3Ryb3llZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkLnB1c2goY2IpO1xufTtcblxuVGVtcGxhdGUucHJvdG90eXBlLl9nZXRDYWxsYmFja3MgPSBmdW5jdGlvbiAod2hpY2gpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2FsbGJhY2tzID0gc2VsZlt3aGljaF0gPyBbc2VsZlt3aGljaF1dIDogW107XG4gIC8vIEZpcmUgYWxsIGNhbGxiYWNrcyBhZGRlZCB3aXRoIHRoZSBuZXcgQVBJIChUZW1wbGF0ZS5vblJlbmRlcmVkKCkpXG4gIC8vIGFzIHdlbGwgYXMgdGhlIG9sZC1zdHlsZSBjYWxsYmFjayAoZS5nLiBUZW1wbGF0ZS5yZW5kZXJlZCkgZm9yXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuICBjYWxsYmFja3MgPSBjYWxsYmFja3MuY29uY2F0KHNlbGYuX2NhbGxiYWNrc1t3aGljaF0pO1xuICByZXR1cm4gY2FsbGJhY2tzO1xufTtcblxudmFyIGZpcmVDYWxsYmFja3MgPSBmdW5jdGlvbiAoY2FsbGJhY2tzLCB0ZW1wbGF0ZSkge1xuICBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKFxuICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRlbXBsYXRlOyB9LFxuICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBOID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IE47IGkrKykge1xuICAgICAgICBjYWxsYmFja3NbaV0uY2FsbCh0ZW1wbGF0ZSk7XG4gICAgICB9XG4gICAgfSk7XG59O1xuXG5UZW1wbGF0ZS5wcm90b3R5cGUuY29uc3RydWN0VmlldyA9IGZ1bmN0aW9uIChjb250ZW50RnVuYywgZWxzZUZ1bmMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgdmlldyA9IEJsYXplLlZpZXcoc2VsZi52aWV3TmFtZSwgc2VsZi5yZW5kZXJGdW5jdGlvbik7XG4gIHZpZXcudGVtcGxhdGUgPSBzZWxmO1xuXG4gIHZpZXcudGVtcGxhdGVDb250ZW50QmxvY2sgPSAoXG4gICAgY29udGVudEZ1bmMgPyBuZXcgVGVtcGxhdGUoJyhjb250ZW50QmxvY2spJywgY29udGVudEZ1bmMpIDogbnVsbCk7XG4gIHZpZXcudGVtcGxhdGVFbHNlQmxvY2sgPSAoXG4gICAgZWxzZUZ1bmMgPyBuZXcgVGVtcGxhdGUoJyhlbHNlQmxvY2spJywgZWxzZUZ1bmMpIDogbnVsbCk7XG5cbiAgaWYgKHNlbGYuX19ldmVudE1hcHMgfHwgdHlwZW9mIHNlbGYuZXZlbnRzID09PSAnb2JqZWN0Jykge1xuICAgIHZpZXcuX29uVmlld1JlbmRlcmVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICh2aWV3LnJlbmRlckNvdW50ICE9PSAxKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmICghIHNlbGYuX19ldmVudE1hcHMubGVuZ3RoICYmIHR5cGVvZiBzZWxmLmV2ZW50cyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAvLyBQcm92aWRlIGxpbWl0ZWQgYmFjay1jb21wYXQgc3VwcG9ydCBmb3IgYC5ldmVudHMgPSB7Li4ufWBcbiAgICAgICAgLy8gc3ludGF4LiAgUGFzcyBgdGVtcGxhdGUuZXZlbnRzYCB0byB0aGUgb3JpZ2luYWwgYC5ldmVudHMoLi4uKWBcbiAgICAgICAgLy8gZnVuY3Rpb24uICBUaGlzIGNvZGUgbXVzdCBydW4gb25seSBvbmNlIHBlciB0ZW1wbGF0ZSwgaW5cbiAgICAgICAgLy8gb3JkZXIgdG8gbm90IGJpbmQgdGhlIGhhbmRsZXJzIG1vcmUgdGhhbiBvbmNlLCB3aGljaCBpc1xuICAgICAgICAvLyBlbnN1cmVkIGJ5IHRoZSBmYWN0IHRoYXQgd2Ugb25seSBkbyB0aGlzIHdoZW4gYF9fZXZlbnRNYXBzYFxuICAgICAgICAvLyBpcyBmYWxzeSwgYW5kIHdlIGNhdXNlIGl0IHRvIGJlIHNldCBub3cuXG4gICAgICAgIFRlbXBsYXRlLnByb3RvdHlwZS5ldmVudHMuY2FsbChzZWxmLCBzZWxmLmV2ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX19ldmVudE1hcHMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgICAgICBCbGF6ZS5fYWRkRXZlbnRNYXAodmlldywgbSwgdmlldyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpZXcuX3RlbXBsYXRlSW5zdGFuY2UgPSBuZXcgQmxhemUuVGVtcGxhdGVJbnN0YW5jZSh2aWV3KTtcbiAgdmlldy50ZW1wbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIFVwZGF0ZSBkYXRhLCBmaXJzdE5vZGUsIGFuZCBsYXN0Tm9kZSwgYW5kIHJldHVybiB0aGUgVGVtcGxhdGVJbnN0YW5jZVxuICAgIC8vIG9iamVjdC5cbiAgICB2YXIgaW5zdCA9IHZpZXcuX3RlbXBsYXRlSW5zdGFuY2U7XG5cbiAgICAvKipcbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbWVtYmVyT2YgQmxhemUuVGVtcGxhdGVJbnN0YW5jZVxuICAgICAqIEBuYW1lICBkYXRhXG4gICAgICogQHN1bW1hcnkgVGhlIGRhdGEgY29udGV4dCBvZiB0aGlzIGluc3RhbmNlJ3MgbGF0ZXN0IGludm9jYXRpb24uXG4gICAgICogQGxvY3VzIENsaWVudFxuICAgICAqL1xuICAgIGluc3QuZGF0YSA9IEJsYXplLmdldERhdGEodmlldyk7XG5cbiAgICBpZiAodmlldy5fZG9tcmFuZ2UgJiYgIXZpZXcuaXNEZXN0cm95ZWQpIHtcbiAgICAgIGluc3QuZmlyc3ROb2RlID0gdmlldy5fZG9tcmFuZ2UuZmlyc3ROb2RlKCk7XG4gICAgICBpbnN0Lmxhc3ROb2RlID0gdmlldy5fZG9tcmFuZ2UubGFzdE5vZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb24gJ2NyZWF0ZWQnIG9yICdkZXN0cm95ZWQnIGNhbGxiYWNrcyB3ZSBkb24ndCBoYXZlIGEgRG9tUmFuZ2VcbiAgICAgIGluc3QuZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgIGluc3QubGFzdE5vZGUgPSBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBpbnN0O1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmFtZSAgY3JlYXRlZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgY3JlYXRlZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIC8vIFRvIGF2b2lkIHNpdHVhdGlvbnMgd2hlbiBuZXcgY2FsbGJhY2tzIGFyZSBhZGRlZCBpbiBiZXR3ZWVuIHZpZXdcbiAgLy8gaW5zdGFudGlhdGlvbiBhbmQgZXZlbnQgYmVpbmcgZmlyZWQsIGRlY2lkZSBvbiBhbGwgY2FsbGJhY2tzIHRvIGZpcmVcbiAgLy8gaW1tZWRpYXRlbHkgYW5kIHRoZW4gZmlyZSB0aGVtIG9uIHRoZSBldmVudC5cbiAgdmFyIGNyZWF0ZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ2NyZWF0ZWQnKTtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBmaXJlQ2FsbGJhY2tzKGNyZWF0ZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEBuYW1lICByZW5kZXJlZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgcmVuZGVyZWQuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQGRlcHJlY2F0ZWQgaW4gMS4xXG4gICAqL1xuICB2YXIgcmVuZGVyZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ3JlbmRlcmVkJyk7XG4gIHZpZXcub25WaWV3UmVhZHkoZnVuY3Rpb24gKCkge1xuICAgIGZpcmVDYWxsYmFja3MocmVuZGVyZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEBuYW1lICBkZXN0cm95ZWRcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBUZW1wbGF0ZVxuICAgKiBAc3VtbWFyeSBQcm92aWRlIGEgY2FsbGJhY2sgd2hlbiBhbiBpbnN0YW5jZSBvZiBhIHRlbXBsYXRlIGlzIGRlc3Ryb3llZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIHZhciBkZXN0cm95ZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ2Rlc3Ryb3llZCcpO1xuICB2aWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgZmlyZUNhbGxiYWNrcyhkZXN0cm95ZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHZpZXc7XG59O1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgVGhlIGNsYXNzIGZvciB0ZW1wbGF0ZSBpbnN0YW5jZXNcbiAqIEBwYXJhbSB7QmxhemUuVmlld30gdmlld1xuICogQGluc3RhbmNlTmFtZSB0ZW1wbGF0ZVxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24gKHZpZXcpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVGVtcGxhdGVJbnN0YW5jZSh2aWV3KTtcblxuICBpZiAoISAodmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcgcmVxdWlyZWRcIik7XG5cbiAgdmlldy5fdGVtcGxhdGVJbnN0YW5jZSA9IHRoaXM7XG5cbiAgLyoqXG4gICAqIEBuYW1lIHZpZXdcbiAgICogQG1lbWJlck9mIEJsYXplLlRlbXBsYXRlSW5zdGFuY2VcbiAgICogQGluc3RhbmNlXG4gICAqIEBzdW1tYXJ5IFRoZSBbVmlld10oLi4vYXBpL2JsYXplLmh0bWwjQmxhemUtVmlldykgb2JqZWN0IGZvciB0aGlzIGludm9jYXRpb24gb2YgdGhlIHRlbXBsYXRlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEB0eXBlIHtCbGF6ZS5WaWV3fVxuICAgKi9cbiAgdGhpcy52aWV3ID0gdmlldztcbiAgdGhpcy5kYXRhID0gbnVsbDtcblxuICAvKipcbiAgICogQG5hbWUgZmlyc3ROb2RlXG4gICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAc3VtbWFyeSBUaGUgZmlyc3QgdG9wLWxldmVsIERPTSBub2RlIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHR5cGUge0RPTU5vZGV9XG4gICAqL1xuICB0aGlzLmZpcnN0Tm9kZSA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEBuYW1lIGxhc3ROb2RlXG4gICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAc3VtbWFyeSBUaGUgbGFzdCB0b3AtbGV2ZWwgRE9NIG5vZGUgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAdHlwZSB7RE9NTm9kZX1cbiAgICovXG4gIHRoaXMubGFzdE5vZGUgPSBudWxsO1xuXG4gIC8vIFRoaXMgZGVwZW5kZW5jeSBpcyB1c2VkIHRvIGlkZW50aWZ5IHN0YXRlIHRyYW5zaXRpb25zIGluXG4gIC8vIF9zdWJzY3JpcHRpb25IYW5kbGVzIHdoaWNoIGNvdWxkIGNhdXNlIHRoZSByZXN1bHQgb2ZcbiAgLy8gVGVtcGxhdGVJbnN0YW5jZSNzdWJzY3JpcHRpb25zUmVhZHkgdG8gY2hhbmdlLiBCYXNpY2FsbHkgdGhpcyBpcyB0cmlnZ2VyZWRcbiAgLy8gd2hlbmV2ZXIgYSBuZXcgc3Vic2NyaXB0aW9uIGhhbmRsZSBpcyBhZGRlZCBvciB3aGVuIGEgc3Vic2NyaXB0aW9uIGhhbmRsZVxuICAvLyBpcyByZW1vdmVkIGFuZCB0aGV5IGFyZSBub3QgcmVhZHkuXG4gIHRoaXMuX2FsbFN1YnNSZWFkeURlcCA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5ID0gZmFsc2U7XG5cbiAgdGhpcy5fc3Vic2NyaXB0aW9uSGFuZGxlcyA9IHt9O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBGaW5kIGFsbCBlbGVtZW50cyBtYXRjaGluZyBgc2VsZWN0b3JgIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UsIGFuZCByZXR1cm4gdGhlbSBhcyBhIEpRdWVyeSBvYmplY3QuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3IgVGhlIENTUyBzZWxlY3RvciB0byBtYXRjaCwgc2NvcGVkIHRvIHRoZSB0ZW1wbGF0ZSBjb250ZW50cy5cbiAqIEByZXR1cm5zIHtET01Ob2RlW119XG4gKi9cbkJsYXplLlRlbXBsYXRlSW5zdGFuY2UucHJvdG90eXBlLiQgPSBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgdmFyIHZpZXcgPSB0aGlzLnZpZXc7XG4gIGlmICghIHZpZXcuX2RvbXJhbmdlKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHVzZSAkIG9uIHRlbXBsYXRlIGluc3RhbmNlIHdpdGggbm8gRE9NXCIpO1xuICByZXR1cm4gdmlldy5fZG9tcmFuZ2UuJChzZWxlY3Rvcik7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgYWxsIGVsZW1lbnRzIG1hdGNoaW5nIGBzZWxlY3RvcmAgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvciBUaGUgQ1NTIHNlbGVjdG9yIHRvIG1hdGNoLCBzY29wZWQgdG8gdGhlIHRlbXBsYXRlIGNvbnRlbnRzLlxuICogQHJldHVybnMge0RPTUVsZW1lbnRbXX1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuZmluZEFsbCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy4kKHNlbGVjdG9yKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgb25lIGVsZW1lbnQgbWF0Y2hpbmcgYHNlbGVjdG9yYCBpbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yIFRoZSBDU1Mgc2VsZWN0b3IgdG8gbWF0Y2gsIHNjb3BlZCB0byB0aGUgdGVtcGxhdGUgY29udGVudHMuXG4gKiBAcmV0dXJucyB7RE9NRWxlbWVudH1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICB2YXIgcmVzdWx0ID0gdGhpcy4kKHNlbGVjdG9yKTtcbiAgcmV0dXJuIHJlc3VsdFswXSB8fCBudWxsO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBIHZlcnNpb24gb2YgW1RyYWNrZXIuYXV0b3J1bl0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3RyYWNrZXIuaHRtbCNUcmFja2VyLWF1dG9ydW4pIHRoYXQgaXMgc3RvcHBlZCB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBkZXN0cm95ZWQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBydW5GdW5jIFRoZSBmdW5jdGlvbiB0byBydW4uIEl0IHJlY2VpdmVzIG9uZSBhcmd1bWVudDogYSBUcmFja2VyLkNvbXB1dGF0aW9uIG9iamVjdC5cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuYXV0b3J1biA9IGZ1bmN0aW9uIChmKSB7XG4gIHJldHVybiB0aGlzLnZpZXcuYXV0b3J1bihmKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQSB2ZXJzaW9uIG9mIFtNZXRlb3Iuc3Vic2NyaWJlXShodHRwczovL2RvY3MubWV0ZW9yLmNvbS9hcGkvcHVic3ViLmh0bWwjTWV0ZW9yLXN1YnNjcmliZSkgdGhhdCBpcyBzdG9wcGVkXG4gKiB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBkZXN0cm95ZWQuXG4gKiBAcmV0dXJuIHtTdWJzY3JpcHRpb25IYW5kbGV9IFRoZSBzdWJzY3JpcHRpb24gaGFuZGxlIHRvIHRoZSBuZXdseSBtYWRlXG4gKiBzdWJzY3JpcHRpb24uIENhbGwgYGhhbmRsZS5zdG9wKClgIHRvIG1hbnVhbGx5IHN0b3AgdGhlIHN1YnNjcmlwdGlvbiwgb3JcbiAqIGBoYW5kbGUucmVhZHkoKWAgdG8gZmluZCBvdXQgaWYgdGhpcyBwYXJ0aWN1bGFyIHN1YnNjcmlwdGlvbiBoYXMgbG9hZGVkIGFsbFxuICogb2YgaXRzIGluaXRhbCBkYXRhLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3Vic2NyaXB0aW9uLiAgTWF0Y2hlcyB0aGUgbmFtZSBvZiB0aGVcbiAqIHNlcnZlcidzIGBwdWJsaXNoKClgIGNhbGwuXG4gKiBAcGFyYW0ge0FueX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXIgZnVuY3Rpb25cbiAqIG9uIHNlcnZlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fSBbb3B0aW9uc10gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgaW5zdGVhZCBvZiBhblxuICogb2JqZWN0LCBpdCBpcyBpbnRlcnByZXRlZCBhcyBhbiBgb25SZWFkeWAgY2FsbGJhY2suXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblJlYWR5XSBQYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3B1YnN1Yi5odG1sI01ldGVvci1zdWJzY3JpYmUpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25TdG9wXSBQYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3B1YnN1Yi5odG1sI01ldGVvci1zdWJzY3JpYmUpLlxuICogQHBhcmFtIHtERFAuQ29ubmVjdGlvbn0gW29wdGlvbnMuY29ubmVjdGlvbl0gVGhlIGNvbm5lY3Rpb24gb24gd2hpY2ggdG8gbWFrZSB0aGVcbiAqIHN1YnNjcmlwdGlvbi5cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBzdWJIYW5kbGVzID0gc2VsZi5fc3Vic2NyaXB0aW9uSGFuZGxlcztcblxuICAvLyBEdXBsaWNhdGUgbG9naWMgZnJvbSBNZXRlb3Iuc3Vic2NyaWJlXG4gIHZhciBvcHRpb25zID0ge307XG4gIGlmIChhcmdzLmxlbmd0aCkge1xuICAgIHZhciBsYXN0UGFyYW0gPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG5cbiAgICAvLyBNYXRjaCBwYXR0ZXJuIHRvIGNoZWNrIGlmIHRoZSBsYXN0IGFyZyBpcyBhbiBvcHRpb25zIGFyZ3VtZW50XG4gICAgdmFyIGxhc3RQYXJhbU9wdGlvbnNQYXR0ZXJuID0ge1xuICAgICAgb25SZWFkeTogTWF0Y2guT3B0aW9uYWwoRnVuY3Rpb24pLFxuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgb25FcnJvciB1c2VkIHRvIGV4aXN0LCBidXQgbm93IHdlIHVzZVxuICAgICAgLy8gb25TdG9wIHdpdGggYW4gZXJyb3IgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIG9uRXJyb3I6IE1hdGNoLk9wdGlvbmFsKEZ1bmN0aW9uKSxcbiAgICAgIG9uU3RvcDogTWF0Y2guT3B0aW9uYWwoRnVuY3Rpb24pLFxuICAgICAgY29ubmVjdGlvbjogTWF0Y2guT3B0aW9uYWwoTWF0Y2guQW55KVxuICAgIH07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihsYXN0UGFyYW0pKSB7XG4gICAgICBvcHRpb25zLm9uUmVhZHkgPSBhcmdzLnBvcCgpO1xuICAgIH0gZWxzZSBpZiAobGFzdFBhcmFtICYmICEgaXNFbXB0eShsYXN0UGFyYW0pICYmIE1hdGNoLnRlc3QobGFzdFBhcmFtLCBsYXN0UGFyYW1PcHRpb25zUGF0dGVybikpIHtcbiAgICAgIG9wdGlvbnMgPSBhcmdzLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdWJIYW5kbGU7XG4gIHZhciBvbGRTdG9wcGVkID0gb3B0aW9ucy5vblN0b3A7XG4gIG9wdGlvbnMub25TdG9wID0gZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgLy8gV2hlbiB0aGUgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQsIHJlbW92ZSBpdCBmcm9tIHRoZSBzZXQgb2YgdHJhY2tlZFxuICAgIC8vIHN1YnNjcmlwdGlvbnMgdG8gYXZvaWQgdGhpcyBsaXN0IGdyb3dpbmcgd2l0aG91dCBib3VuZFxuICAgIGRlbGV0ZSBzdWJIYW5kbGVzW3N1YkhhbmRsZS5zdWJzY3JpcHRpb25JZF07XG5cbiAgICAvLyBSZW1vdmluZyBhIHN1YnNjcmlwdGlvbiBjYW4gb25seSBjaGFuZ2UgdGhlIHJlc3VsdCBvZiBzdWJzY3JpcHRpb25zUmVhZHlcbiAgICAvLyBpZiB3ZSBhcmUgbm90IHJlYWR5ICh0aGF0IHN1YnNjcmlwdGlvbiBjb3VsZCBiZSB0aGUgb25lIGJsb2NraW5nIHVzIGJlaW5nXG4gICAgLy8gcmVhZHkpLlxuICAgIGlmICghIHNlbGYuX2FsbFN1YnNSZWFkeSkge1xuICAgICAgc2VsZi5fYWxsU3Vic1JlYWR5RGVwLmNoYW5nZWQoKTtcbiAgICB9XG5cbiAgICBpZiAob2xkU3RvcHBlZCkge1xuICAgICAgb2xkU3RvcHBlZChlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIHZhciBjb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICBjb25zdCB7IG9uUmVhZHksIG9uRXJyb3IsIG9uU3RvcCB9ID0gb3B0aW9ucztcbiAgdmFyIGNhbGxiYWNrcyA9IHsgb25SZWFkeSwgb25FcnJvciwgb25TdG9wIH07XG5cbiAgLy8gVGhlIGNhbGxiYWNrcyBhcmUgcGFzc2VkIGFzIHRoZSBsYXN0IGl0ZW0gaW4gdGhlIGFyZ3VtZW50cyBhcnJheSBwYXNzZWQgdG9cbiAgLy8gVmlldyNzdWJzY3JpYmVcbiAgYXJncy5wdXNoKGNhbGxiYWNrcyk7XG5cbiAgLy8gVmlldyNzdWJzY3JpYmUgdGFrZXMgdGhlIGNvbm5lY3Rpb24gYXMgb25lIG9mIHRoZSBvcHRpb25zIGluIHRoZSBsYXN0XG4gIC8vIGFyZ3VtZW50XG4gIHN1YkhhbmRsZSA9IHNlbGYudmlldy5zdWJzY3JpYmUuY2FsbChzZWxmLnZpZXcsIGFyZ3MsIHtcbiAgICBjb25uZWN0aW9uOiBjb25uZWN0aW9uXG4gIH0pO1xuXG4gIGlmICghaGFzKHN1YkhhbmRsZXMsIHN1YkhhbmRsZS5zdWJzY3JpcHRpb25JZCkpIHtcbiAgICBzdWJIYW5kbGVzW3N1YkhhbmRsZS5zdWJzY3JpcHRpb25JZF0gPSBzdWJIYW5kbGU7XG5cbiAgICAvLyBBZGRpbmcgYSBuZXcgc3Vic2NyaXB0aW9uIHdpbGwgYWx3YXlzIGNhdXNlIHVzIHRvIHRyYW5zaXRpb24gZnJvbSByZWFkeVxuICAgIC8vIHRvIG5vdCByZWFkeSwgYnV0IGlmIHdlIGFyZSBhbHJlYWR5IG5vdCByZWFkeSB0aGVuIHRoaXMgY2FuJ3QgbWFrZSB1c1xuICAgIC8vIHJlYWR5LlxuICAgIGlmIChzZWxmLl9hbGxTdWJzUmVhZHkpIHtcbiAgICAgIHNlbGYuX2FsbFN1YnNSZWFkeURlcC5jaGFuZ2VkKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN1YkhhbmRsZTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQSByZWFjdGl2ZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdHJ1ZSB3aGVuIGFsbCBvZiB0aGUgc3Vic2NyaXB0aW9uc1xuICogY2FsbGVkIHdpdGggW3RoaXMuc3Vic2NyaWJlXSgjVGVtcGxhdGVJbnN0YW5jZS1zdWJzY3JpYmUpIGFyZSByZWFkeS5cbiAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgYWxsIHN1YnNjcmlwdGlvbnMgb24gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZSBhcmVcbiAqIHJlYWR5LlxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlLnByb3RvdHlwZS5zdWJzY3JpcHRpb25zUmVhZHkgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX2FsbFN1YnNSZWFkeURlcC5kZXBlbmQoKTtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5ID0gT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGVzKS5ldmVyeSgoaGFuZGxlKSA9PiB7ICBcbiAgICByZXR1cm4gaGFuZGxlLnJlYWR5KCk7XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzLl9hbGxTdWJzUmVhZHk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNwZWNpZnkgdGVtcGxhdGUgaGVscGVycyBhdmFpbGFibGUgdG8gdGhpcyB0ZW1wbGF0ZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7T2JqZWN0fSBoZWxwZXJzIERpY3Rpb25hcnkgb2YgaGVscGVyIGZ1bmN0aW9ucyBieSBuYW1lLlxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLmhlbHBlcnMgPSBmdW5jdGlvbiAoZGljdCkge1xuICBpZiAoIWlzT2JqZWN0KGRpY3QpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSGVscGVycyBkaWN0aW9uYXJ5IGhhcyB0byBiZSBhbiBvYmplY3RcIik7XG4gIH1cblxuICBmb3IgKHZhciBrIGluIGRpY3QpIHRoaXMuX19oZWxwZXJzLnNldChrLCBkaWN0W2tdKTtcbn07XG5cbnZhciBjYW5Vc2VHZXR0ZXJzID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICB0cnkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgXCJzZWxmXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBvYmo7IH1cbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIG9iai5zZWxmID09PSBvYmo7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufSkoKTtcblxuaWYgKGNhblVzZUdldHRlcnMpIHtcbiAgLy8gTGlrZSBCbGF6ZS5jdXJyZW50VmlldyBidXQgZm9yIHRoZSB0ZW1wbGF0ZSBpbnN0YW5jZS4gQSBmdW5jdGlvblxuICAvLyByYXRoZXIgdGhhbiBhIHZhbHVlIHNvIHRoYXQgbm90IGFsbCBoZWxwZXJzIGFyZSBpbXBsaWNpdGx5IGRlcGVuZGVudFxuICAvLyBvbiB0aGUgY3VycmVudCB0ZW1wbGF0ZSBpbnN0YW5jZSdzIGBkYXRhYCBwcm9wZXJ0eSwgd2hpY2ggd291bGQgbWFrZVxuICAvLyB0aGVtIGRlcGVuZGVudCBvbiB0aGUgZGF0YSBjb250ZXh0IG9mIHRoZSB0ZW1wbGF0ZSBpbmNsdXNpb24uXG4gIHZhciBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBudWxsO1xuXG4gIC8vIElmIGdldHRlcnMgYXJlIHN1cHBvcnRlZCwgZGVmaW5lIHRoaXMgcHJvcGVydHkgd2l0aCBhIGdldHRlciBmdW5jdGlvblxuICAvLyB0byBtYWtlIGl0IGVmZmVjdGl2ZWx5IHJlYWQtb25seSwgYW5kIHRvIHdvcmsgYXJvdW5kIHRoaXMgYml6YXJyZSBKU0NcbiAgLy8gYnVnOiBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvOTkyNlxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoVGVtcGxhdGUsIFwiX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuY1wiLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgIH1cbiAgfSk7XG5cbiAgVGVtcGxhdGUuX3dpdGhUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IGZ1bmN0aW9uICh0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuYykge1xuICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgZnVuY3Rpb24sIGdvdDogXCIgKyBmdW5jKTtcbiAgICB9XG4gICAgdmFyIG9sZFRtcGxJbnN0YW5jZUZ1bmMgPSBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgdHJ5IHtcbiAgICAgIGN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IHRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgICAgcmV0dXJuIGZ1bmMoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gb2xkVG1wbEluc3RhbmNlRnVuYztcbiAgICB9XG4gIH07XG59IGVsc2Uge1xuICAvLyBJZiBnZXR0ZXJzIGFyZSBub3Qgc3VwcG9ydGVkLCBqdXN0IHVzZSBhIG5vcm1hbCBwcm9wZXJ0eS5cbiAgVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IG51bGw7XG5cbiAgVGVtcGxhdGUuX3dpdGhUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IGZ1bmN0aW9uICh0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuYykge1xuICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgZnVuY3Rpb24sIGdvdDogXCIgKyBmdW5jKTtcbiAgICB9XG4gICAgdmFyIG9sZFRtcGxJbnN0YW5jZUZ1bmMgPSBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgIHRyeSB7XG4gICAgICBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gdGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgICByZXR1cm4gZnVuYygpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gb2xkVG1wbEluc3RhbmNlRnVuYztcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQHN1bW1hcnkgU3BlY2lmeSBldmVudCBoYW5kbGVycyBmb3IgdGhpcyB0ZW1wbGF0ZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7RXZlbnRNYXB9IGV2ZW50TWFwIEV2ZW50IGhhbmRsZXJzIHRvIGFzc29jaWF0ZSB3aXRoIHRoaXMgdGVtcGxhdGUuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5wcm90b3R5cGUuZXZlbnRzID0gZnVuY3Rpb24gKGV2ZW50TWFwKSB7XG4gIGlmICghaXNPYmplY3QoZXZlbnRNYXApKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgbWFwIGhhcyB0byBiZSBhbiBvYmplY3RcIik7XG4gIH1cblxuICB2YXIgdGVtcGxhdGUgPSB0aGlzO1xuICB2YXIgZXZlbnRNYXAyID0ge307XG4gIGZvciAodmFyIGsgaW4gZXZlbnRNYXApIHtcbiAgICBldmVudE1hcDJba10gPSAoZnVuY3Rpb24gKGssIHYpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoZXZlbnQgLyosIC4uLiovKSB7XG4gICAgICAgIHZhciB2aWV3ID0gdGhpczsgLy8gcGFzc2VkIGJ5IEV2ZW50QXVnbWVudGVyXG4gICAgICAgIHZhciBkYXRhID0gQmxhemUuZ2V0RGF0YShldmVudC5jdXJyZW50VGFyZ2V0KTtcbiAgICAgICAgaWYgKGRhdGEgPT0gbnVsbCkgZGF0YSA9IHt9O1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIHZhciB0bXBsSW5zdGFuY2VGdW5jID0gQmxhemUuX2JpbmQodmlldy50ZW1wbGF0ZUluc3RhbmNlLCB2aWV3KTtcbiAgICAgICAgYXJncy5zcGxpY2UoMSwgMCwgdG1wbEluc3RhbmNlRnVuYygpKTtcblxuICAgICAgICByZXR1cm4gVGVtcGxhdGUuX3dpdGhUZW1wbGF0ZUluc3RhbmNlRnVuYyh0bXBsSW5zdGFuY2VGdW5jLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIHYuYXBwbHkoZGF0YSwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICB9KShrLCBldmVudE1hcFtrXSk7XG4gIH1cblxuICB0ZW1wbGF0ZS5fX2V2ZW50TWFwcy5wdXNoKGV2ZW50TWFwMik7XG59O1xuXG4vKipcbiAqIEBmdW5jdGlvblxuICogQG5hbWUgaW5zdGFuY2VcbiAqIEBtZW1iZXJPZiBUZW1wbGF0ZVxuICogQHN1bW1hcnkgVGhlIFt0ZW1wbGF0ZSBpbnN0YW5jZV0oI1RlbXBsYXRlLWluc3RhbmNlcykgY29ycmVzcG9uZGluZyB0byB0aGUgY3VycmVudCB0ZW1wbGF0ZSBoZWxwZXIsIGV2ZW50IGhhbmRsZXIsIGNhbGxiYWNrLCBvciBhdXRvcnVuLiAgSWYgdGhlcmUgaXNuJ3Qgb25lLCBgbnVsbGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcmV0dXJucyB7QmxhemUuVGVtcGxhdGVJbnN0YW5jZX1cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLmluc3RhbmNlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuY1xuICAgICYmIFRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMoKTtcbn07XG5cbi8vIE5vdGU6IFRlbXBsYXRlLmN1cnJlbnREYXRhKCkgaXMgZG9jdW1lbnRlZCB0byB0YWtlIHplcm8gYXJndW1lbnRzLFxuLy8gd2hpbGUgQmxhemUuZ2V0RGF0YSB0YWtlcyB1cCB0byBvbmUuXG5cbi8qKlxuICogQHN1bW1hcnlcbiAqXG4gKiAtIEluc2lkZSBhbiBgb25DcmVhdGVkYCwgYG9uUmVuZGVyZWRgLCBvciBgb25EZXN0cm95ZWRgIGNhbGxiYWNrLCByZXR1cm5zXG4gKiB0aGUgZGF0YSBjb250ZXh0IG9mIHRoZSB0ZW1wbGF0ZS5cbiAqIC0gSW5zaWRlIGFuIGV2ZW50IGhhbmRsZXIsIHJldHVybnMgdGhlIGRhdGEgY29udGV4dCBvZiB0aGUgdGVtcGxhdGUgb24gd2hpY2hcbiAqIHRoaXMgZXZlbnQgaGFuZGxlciB3YXMgZGVmaW5lZC5cbiAqIC0gSW5zaWRlIGEgaGVscGVyLCByZXR1cm5zIHRoZSBkYXRhIGNvbnRleHQgb2YgdGhlIERPTSBub2RlIHdoZXJlIHRoZSBoZWxwZXJcbiAqIHdhcyB1c2VkLlxuICpcbiAqIEVzdGFibGlzaGVzIGEgcmVhY3RpdmUgZGVwZW5kZW5jeSBvbiB0aGUgcmVzdWx0LlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5jdXJyZW50RGF0YSA9IEJsYXplLmdldERhdGE7XG5cbi8qKlxuICogQHN1bW1hcnkgQWNjZXNzZXMgb3RoZXIgZGF0YSBjb250ZXh0cyB0aGF0IGVuY2xvc2UgdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0LlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0ludGVnZXJ9IFtudW1MZXZlbHNdIFRoZSBudW1iZXIgb2YgbGV2ZWxzIGJleW9uZCB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQgdG8gbG9vay4gRGVmYXVsdHMgdG8gMS5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnBhcmVudERhdGEgPSBCbGF6ZS5fcGFyZW50RGF0YTtcblxuLyoqXG4gKiBAc3VtbWFyeSBEZWZpbmVzIGEgW2hlbHBlciBmdW5jdGlvbl0oI1RlbXBsYXRlLWhlbHBlcnMpIHdoaWNoIGNhbiBiZSB1c2VkIGZyb20gYWxsIHRlbXBsYXRlcy5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGhlbHBlciBmdW5jdGlvbiB5b3UgYXJlIGRlZmluaW5nLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb24gVGhlIGhlbHBlciBmdW5jdGlvbiBpdHNlbGYuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5yZWdpc3RlckhlbHBlciA9IEJsYXplLnJlZ2lzdGVySGVscGVyO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbW92ZXMgYSBnbG9iYWwgW2hlbHBlciBmdW5jdGlvbl0oI1RlbXBsYXRlLWhlbHBlcnMpLlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgaGVscGVyIGZ1bmN0aW9uIHlvdSBhcmUgZGVmaW5pbmcuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5kZXJlZ2lzdGVySGVscGVyID0gQmxhemUuZGVyZWdpc3RlckhlbHBlcjtcbiIsIlVJID0gQmxhemU7XG5cbkJsYXplLlJlYWN0aXZlVmFyID0gUmVhY3RpdmVWYXI7XG5VSS5fdGVtcGxhdGVJbnN0YW5jZSA9IEJsYXplLlRlbXBsYXRlLmluc3RhbmNlO1xuXG5IYW5kbGViYXJzID0ge307XG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyID0gQmxhemUucmVnaXN0ZXJIZWxwZXI7XG5cbkhhbmRsZWJhcnMuX2VzY2FwZSA9IEJsYXplLl9lc2NhcGU7XG5cbi8vIFJldHVybiB0aGVzZSBmcm9tIHt7Li4ufX0gaGVscGVycyB0byBhY2hpZXZlIHRoZSBzYW1lIGFzIHJldHVybmluZ1xuLy8gc3RyaW5ncyBmcm9tIHt7ey4uLn19fSBoZWxwZXJzXG5IYW5kbGViYXJzLlNhZmVTdHJpbmcgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG59O1xuSGFuZGxlYmFycy5TYWZlU3RyaW5nLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5zdHJpbmcudG9TdHJpbmcoKTtcbn07XG4iXX0=
