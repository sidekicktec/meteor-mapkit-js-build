(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var HTML;

var require = meteorInstall({"node_modules":{"meteor":{"htmljs":{"preamble.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/preamble.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  HTML: () => HTML
});
let HTMLTags, Tag, Attrs, getTag, ensureTag, isTagEnsured, getSymbolName, knownHTMLElementNames, knownSVGElementNames, knownElementNames, voidElementNames, isKnownElement, isKnownSVGElement, isVoidElement, CharRef, Comment, Raw, isArray, isConstructedObject, isNully, isValidAttributeName, flattenAttributes;
module.link("./html", {
  HTMLTags(v) {
    HTMLTags = v;
  },
  Tag(v) {
    Tag = v;
  },
  Attrs(v) {
    Attrs = v;
  },
  getTag(v) {
    getTag = v;
  },
  ensureTag(v) {
    ensureTag = v;
  },
  isTagEnsured(v) {
    isTagEnsured = v;
  },
  getSymbolName(v) {
    getSymbolName = v;
  },
  knownHTMLElementNames(v) {
    knownHTMLElementNames = v;
  },
  knownSVGElementNames(v) {
    knownSVGElementNames = v;
  },
  knownElementNames(v) {
    knownElementNames = v;
  },
  voidElementNames(v) {
    voidElementNames = v;
  },
  isKnownElement(v) {
    isKnownElement = v;
  },
  isKnownSVGElement(v) {
    isKnownSVGElement = v;
  },
  isVoidElement(v) {
    isVoidElement = v;
  },
  CharRef(v) {
    CharRef = v;
  },
  Comment(v) {
    Comment = v;
  },
  Raw(v) {
    Raw = v;
  },
  isArray(v) {
    isArray = v;
  },
  isConstructedObject(v) {
    isConstructedObject = v;
  },
  isNully(v) {
    isNully = v;
  },
  isValidAttributeName(v) {
    isValidAttributeName = v;
  },
  flattenAttributes(v) {
    flattenAttributes = v;
  }
}, 0);
let Visitor, TransformingVisitor, ToHTMLVisitor, ToTextVisitor, toHTML, TEXTMODE, toText;
module.link("./visitors", {
  Visitor(v) {
    Visitor = v;
  },
  TransformingVisitor(v) {
    TransformingVisitor = v;
  },
  ToHTMLVisitor(v) {
    ToHTMLVisitor = v;
  },
  ToTextVisitor(v) {
    ToTextVisitor = v;
  },
  toHTML(v) {
    toHTML = v;
  },
  TEXTMODE(v) {
    TEXTMODE = v;
  },
  toText(v) {
    toText = v;
  }
}, 1);
const HTML = Object.assign(HTMLTags, {
  Tag,
  Attrs,
  getTag,
  ensureTag,
  isTagEnsured,
  getSymbolName,
  knownHTMLElementNames,
  knownSVGElementNames,
  knownElementNames,
  voidElementNames,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
  CharRef,
  Comment,
  Raw,
  isArray,
  isConstructedObject,
  isNully,
  isValidAttributeName,
  flattenAttributes,
  toHTML,
  TEXTMODE,
  toText,
  Visitor,
  TransformingVisitor,
  ToHTMLVisitor,
  ToTextVisitor
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"html.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/html.js                                                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  Tag: () => Tag,
  Attrs: () => Attrs,
  HTMLTags: () => HTMLTags,
  getTag: () => getTag,
  ensureTag: () => ensureTag,
  isTagEnsured: () => isTagEnsured,
  getSymbolName: () => getSymbolName,
  knownHTMLElementNames: () => knownHTMLElementNames,
  knownSVGElementNames: () => knownSVGElementNames,
  knownElementNames: () => knownElementNames,
  voidElementNames: () => voidElementNames,
  isKnownElement: () => isKnownElement,
  isKnownSVGElement: () => isKnownSVGElement,
  isVoidElement: () => isVoidElement,
  CharRef: () => CharRef,
  Comment: () => Comment,
  Raw: () => Raw,
  isArray: () => isArray,
  isConstructedObject: () => isConstructedObject,
  isNully: () => isNully,
  isValidAttributeName: () => isValidAttributeName,
  flattenAttributes: () => flattenAttributes
});
const Tag = function () {};
Tag.prototype.tagName = ''; // this will be set per Tag subclass
Tag.prototype.attrs = null;
Tag.prototype.children = Object.freeze ? Object.freeze([]) : [];
Tag.prototype.htmljsType = Tag.htmljsType = ['Tag'];

// Given "p" create the function `HTML.P`.
var makeTagConstructor = function (tagName) {
  // Tag is the per-tagName constructor of a HTML.Tag subclass
  var HTMLTag = function () {
    // Work with or without `new`.  If not called with `new`,
    // perform instantiation by recursively calling this constructor.
    // We can't pass varargs, so pass no args.
    var instance = this instanceof Tag ? this : new HTMLTag();
    var i = 0;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var attrs = args.length && args[0];
    if (attrs && typeof attrs === 'object') {
      // Treat vanilla JS object as an attributes dictionary.
      if (!isConstructedObject(attrs)) {
        instance.attrs = attrs;
        i++;
      } else if (attrs instanceof Attrs) {
        var array = attrs.value;
        if (array.length === 1) {
          instance.attrs = array[0];
        } else if (array.length > 1) {
          instance.attrs = array;
        }
        i++;
      }
    }

    // If no children, don't create an array at all, use the prototype's
    // (frozen, empty) array.  This way we don't create an empty array
    // every time someone creates a tag without `new` and this constructor
    // calls itself with no arguments (above).
    if (i < args.length) instance.children = args.slice(i);
    return instance;
  };
  HTMLTag.prototype = new Tag();
  HTMLTag.prototype.constructor = HTMLTag;
  HTMLTag.prototype.tagName = tagName;
  return HTMLTag;
};

// Not an HTMLjs node, but a wrapper to pass multiple attrs dictionaries
// to a tag (for the purpose of implementing dynamic attributes).
function Attrs() {
  // Work with or without `new`.  If not called with `new`,
  // perform instantiation by recursively calling this constructor.
  // We can't pass varargs, so pass no args.
  var instance = this instanceof Attrs ? this : new Attrs();
  for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }
  instance.value = args;
  return instance;
}
const HTMLTags = {};
function getTag(tagName) {
  var symbolName = getSymbolName(tagName);
  if (symbolName === tagName)
    // all-caps tagName
    throw new Error("Use the lowercase or camelCase form of '" + tagName + "' here");
  if (!HTMLTags[symbolName]) HTMLTags[symbolName] = makeTagConstructor(tagName);
  return HTMLTags[symbolName];
}
function ensureTag(tagName) {
  getTag(tagName); // don't return it
}

function isTagEnsured(tagName) {
  return isKnownElement(tagName);
}
function getSymbolName(tagName) {
  // "foo-bar" -> "FOO_BAR"
  return tagName.toUpperCase().replace(/-/g, '_');
}
const knownHTMLElementNames = 'a abbr acronym address applet area article aside audio b base basefont bdi bdo big blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn dir div dl dt em embed eventsource fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins isindex kbd keygen label legend li link main map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr track tt u ul var video wbr'.split(' ');
const knownSVGElementNames = 'altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion animateTransform circle clipPath color-profile cursor defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph path pattern polygon polyline radialGradient rect set stop style svg switch symbol text textPath title tref tspan use view vkern'.split(' ');
const knownElementNames = knownHTMLElementNames.concat(knownSVGElementNames);
const voidElementNames = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
var voidElementSet = new Set(voidElementNames);
var knownElementSet = new Set(knownElementNames);
var knownSVGElementSet = new Set(knownSVGElementNames);
function isKnownElement(tagName) {
  return knownElementSet.has(tagName);
}
function isKnownSVGElement(tagName) {
  return knownSVGElementSet.has(tagName);
}
function isVoidElement(tagName) {
  return voidElementSet.has(tagName);
}
// Ensure tags for all known elements
knownElementNames.forEach(ensureTag);
function CharRef(attrs) {
  if (!(this instanceof CharRef))
    // called without `new`
    return new CharRef(attrs);
  if (!(attrs && attrs.html && attrs.str)) throw new Error("HTML.CharRef must be constructed with ({html:..., str:...})");
  this.html = attrs.html;
  this.str = attrs.str;
}
CharRef.prototype.htmljsType = CharRef.htmljsType = ['CharRef'];
function Comment(value) {
  if (!(this instanceof Comment))
    // called without `new`
    return new Comment(value);
  if (typeof value !== 'string') throw new Error('HTML.Comment must be constructed with a string');
  this.value = value;
  // Kill illegal hyphens in comment value (no way to escape them in HTML)
  this.sanitizedValue = value.replace(/^-|--+|-$/g, '');
}
Comment.prototype.htmljsType = Comment.htmljsType = ['Comment'];
function Raw(value) {
  if (!(this instanceof Raw))
    // called without `new`
    return new Raw(value);
  if (typeof value !== 'string') throw new Error('HTML.Raw must be constructed with a string');
  this.value = value;
}
Raw.prototype.htmljsType = Raw.htmljsType = ['Raw'];
function isArray(x) {
  return x instanceof Array || Array.isArray(x);
}
function isConstructedObject(x) {
  // Figure out if `x` is "an instance of some class" or just a plain
  // object literal.  It correctly treats an object literal like
  // `{ constructor: ... }` as an object literal.  It won't detect
  // instances of classes that lack a `constructor` property (e.g.
  // if you assign to a prototype when setting up the class as in:
  // `Foo = function () { ... }; Foo.prototype = { ... }`, then
  // `(new Foo).constructor` is `Object`, not `Foo`).
  if (!x || typeof x !== 'object') return false;
  // Is this a plain object?
  let plain = false;
  if (Object.getPrototypeOf(x) === null) {
    plain = true;
  } else {
    let proto = x;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    plain = Object.getPrototypeOf(x) === proto;
  }
  return !plain && typeof x.constructor === 'function' && x instanceof x.constructor;
}
function isNully(node) {
  if (node == null)
    // null or undefined
    return true;
  if (isArray(node)) {
    // is it an empty array or an array of all nully items?
    for (var i = 0; i < node.length; i++) if (!isNully(node[i])) return false;
    return true;
  }
  return false;
}
function isValidAttributeName(name) {
  return /^[:_A-Za-z][:_A-Za-z0-9.\-]*/.test(name);
}
function flattenAttributes(attrs) {
  if (!attrs) return attrs;
  var isList = isArray(attrs);
  if (isList && attrs.length === 0) return null;
  var result = {};
  for (var i = 0, N = isList ? attrs.length : 1; i < N; i++) {
    var oneAttrs = isList ? attrs[i] : attrs;
    if (typeof oneAttrs !== 'object' || isConstructedObject(oneAttrs)) throw new Error("Expected plain JS object as attrs, found: " + oneAttrs);
    for (var name in oneAttrs) {
      if (!isValidAttributeName(name)) throw new Error("Illegal HTML attribute name: " + name);
      var value = oneAttrs[name];
      if (!isNully(value)) result[name] = value;
    }
  }
  return result;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitors.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/visitors.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  Visitor: () => Visitor,
  TransformingVisitor: () => TransformingVisitor,
  ToTextVisitor: () => ToTextVisitor,
  ToHTMLVisitor: () => ToHTMLVisitor,
  toHTML: () => toHTML,
  TEXTMODE: () => TEXTMODE,
  toText: () => toText
});
let Tag, CharRef, Comment, Raw, isArray, getTag, isConstructedObject, flattenAttributes, isVoidElement;
module.link("./html", {
  Tag(v) {
    Tag = v;
  },
  CharRef(v) {
    CharRef = v;
  },
  Comment(v) {
    Comment = v;
  },
  Raw(v) {
    Raw = v;
  },
  isArray(v) {
    isArray = v;
  },
  getTag(v) {
    getTag = v;
  },
  isConstructedObject(v) {
    isConstructedObject = v;
  },
  flattenAttributes(v) {
    flattenAttributes = v;
  },
  isVoidElement(v) {
    isVoidElement = v;
  }
}, 0);
var IDENTITY = function (x) {
  return x;
};

// _assign is like _.extend or the upcoming Object.assign.
// Copy src's own, enumerable properties onto tgt and return
// tgt.
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var _assign = function (tgt, src) {
  for (var k in src) {
    if (_hasOwnProperty.call(src, k)) tgt[k] = src[k];
  }
  return tgt;
};
const Visitor = function (props) {
  _assign(this, props);
};
Visitor.def = function (options) {
  _assign(this.prototype, options);
};
Visitor.extend = function (options) {
  var curType = this;
  var subType = function HTMLVisitorSubtype( /*arguments*/
  ) {
    Visitor.apply(this, arguments);
  };
  subType.prototype = new curType();
  subType.extend = curType.extend;
  subType.def = curType.def;
  if (options) _assign(subType.prototype, options);
  return subType;
};
Visitor.def({
  visit: function (content /*, ...*/) {
    if (content == null)
      // null or undefined.
      return this.visitNull.apply(this, arguments);
    if (typeof content === 'object') {
      if (content.htmljsType) {
        switch (content.htmljsType) {
          case Tag.htmljsType:
            return this.visitTag.apply(this, arguments);
          case CharRef.htmljsType:
            return this.visitCharRef.apply(this, arguments);
          case Comment.htmljsType:
            return this.visitComment.apply(this, arguments);
          case Raw.htmljsType:
            return this.visitRaw.apply(this, arguments);
          default:
            throw new Error("Unknown htmljs type: " + content.htmljsType);
        }
      }
      if (isArray(content)) return this.visitArray.apply(this, arguments);
      return this.visitObject.apply(this, arguments);
    } else if (typeof content === 'string' || typeof content === 'boolean' || typeof content === 'number') {
      return this.visitPrimitive.apply(this, arguments);
    } else if (typeof content === 'function') {
      return this.visitFunction.apply(this, arguments);
    }
    throw new Error("Unexpected object in htmljs: " + content);
  },
  visitNull: function (nullOrUndefined /*, ...*/) {},
  visitPrimitive: function (stringBooleanOrNumber /*, ...*/) {},
  visitArray: function (array /*, ...*/) {},
  visitComment: function (comment /*, ...*/) {},
  visitCharRef: function (charRef /*, ...*/) {},
  visitRaw: function (raw /*, ...*/) {},
  visitTag: function (tag /*, ...*/) {},
  visitObject: function (obj /*, ...*/) {
    throw new Error("Unexpected object in htmljs: " + obj);
  },
  visitFunction: function (fn /*, ...*/) {
    throw new Error("Unexpected function in htmljs: " + fn);
  }
});
const TransformingVisitor = Visitor.extend();
TransformingVisitor.def({
  visitNull: IDENTITY,
  visitPrimitive: IDENTITY,
  visitArray: function (array) {
    var result = array;
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    for (var i = 0; i < array.length; i++) {
      var oldItem = array[i];
      var newItem = this.visit(oldItem, ...args);
      if (newItem !== oldItem) {
        // copy `array` on write
        if (result === array) result = array.slice();
        result[i] = newItem;
      }
    }
    return result;
  },
  visitComment: IDENTITY,
  visitCharRef: IDENTITY,
  visitRaw: IDENTITY,
  visitObject: function (obj) {
    // Don't parse Markdown & RCData as HTML
    if (obj.textMode != null) {
      return obj;
    }
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    if ('content' in obj) {
      obj.content = this.visit(obj.content, ...args);
    }
    if ('elseContent' in obj) {
      obj.elseContent = this.visit(obj.elseContent, ...args);
    }
    return obj;
  },
  visitFunction: IDENTITY,
  visitTag: function (tag) {
    var oldChildren = tag.children;
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    var newChildren = this.visitChildren(oldChildren, ...args);
    var oldAttrs = tag.attrs;
    var newAttrs = this.visitAttributes(oldAttrs, ...args);
    if (newAttrs === oldAttrs && newChildren === oldChildren) return tag;
    var newTag = getTag(tag.tagName).apply(null, newChildren);
    newTag.attrs = newAttrs;
    return newTag;
  },
  visitChildren: function (children) {
    for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      args[_key4 - 1] = arguments[_key4];
    }
    return this.visitArray(children, ...args);
  },
  // Transform the `.attrs` property of a tag, which may be a dictionary,
  // an array, or in some uses, a foreign object (such as
  // a template tag).
  visitAttributes: function (attrs) {
    for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
      args[_key5 - 1] = arguments[_key5];
    }
    if (isArray(attrs)) {
      var result = attrs;
      for (var i = 0; i < attrs.length; i++) {
        var oldItem = attrs[i];
        var newItem = this.visitAttributes(oldItem, ...args);
        if (newItem !== oldItem) {
          // copy on write
          if (result === attrs) result = attrs.slice();
          result[i] = newItem;
        }
      }
      return result;
    }
    if (attrs && isConstructedObject(attrs)) {
      throw new Error("The basic TransformingVisitor does not support " + "foreign objects in attributes.  Define a custom " + "visitAttributes for this case.");
    }
    var oldAttrs = attrs;
    var newAttrs = oldAttrs;
    if (oldAttrs) {
      var attrArgs = [null, null];
      attrArgs.push.apply(attrArgs, arguments);
      for (var k in oldAttrs) {
        var oldValue = oldAttrs[k];
        attrArgs[0] = k;
        attrArgs[1] = oldValue;
        var newValue = this.visitAttribute.apply(this, attrArgs);
        if (newValue !== oldValue) {
          // copy on write
          if (newAttrs === oldAttrs) newAttrs = _assign({}, oldAttrs);
          newAttrs[k] = newValue;
        }
      }
    }
    return newAttrs;
  },
  // Transform the value of one attribute name/value in an
  // attributes dictionary.
  visitAttribute: function (name, value, tag) {
    for (var _len6 = arguments.length, args = new Array(_len6 > 3 ? _len6 - 3 : 0), _key6 = 3; _key6 < _len6; _key6++) {
      args[_key6 - 3] = arguments[_key6];
    }
    return this.visit(value, ...args);
  }
});
const ToTextVisitor = Visitor.extend();
ToTextVisitor.def({
  visitNull: function (nullOrUndefined) {
    return '';
  },
  visitPrimitive: function (stringBooleanOrNumber) {
    var str = String(stringBooleanOrNumber);
    if (this.textMode === TEXTMODE.RCDATA) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    } else if (this.textMode === TEXTMODE.ATTRIBUTE) {
      // escape `&` and `"` this time, not `&` and `<`
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    } else {
      return str;
    }
  },
  visitArray: function (array) {
    var parts = [];
    for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));
    return parts.join('');
  },
  visitComment: function (comment) {
    throw new Error("Can't have a comment here");
  },
  visitCharRef: function (charRef) {
    if (this.textMode === TEXTMODE.RCDATA || this.textMode === TEXTMODE.ATTRIBUTE) {
      return charRef.html;
    } else {
      return charRef.str;
    }
  },
  visitRaw: function (raw) {
    return raw.value;
  },
  visitTag: function (tag) {
    // Really we should just disallow Tags here.  However, at the
    // moment it's useful to stringify any HTML we find.  In
    // particular, when you include a template within `{{#markdown}}`,
    // we render the template as text, and since there's currently
    // no way to make the template be *parsed* as text (e.g. `<template
    // type="text">`), we hackishly support HTML tags in markdown
    // in templates by parsing them and stringifying them.
    return this.visit(this.toHTML(tag));
  },
  visitObject: function (x) {
    throw new Error("Unexpected object in htmljs in toText: " + x);
  },
  toHTML: function (node) {
    return toHTML(node);
  }
});
const ToHTMLVisitor = Visitor.extend();
ToHTMLVisitor.def({
  visitNull: function (nullOrUndefined) {
    return '';
  },
  visitPrimitive: function (stringBooleanOrNumber) {
    var str = String(stringBooleanOrNumber);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  },
  visitArray: function (array) {
    var parts = [];
    for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));
    return parts.join('');
  },
  visitComment: function (comment) {
    return '<!--' + comment.sanitizedValue + '-->';
  },
  visitCharRef: function (charRef) {
    return charRef.html;
  },
  visitRaw: function (raw) {
    return raw.value;
  },
  visitTag: function (tag) {
    var attrStrs = [];
    var tagName = tag.tagName;
    var children = tag.children;
    var attrs = tag.attrs;
    if (attrs) {
      attrs = flattenAttributes(attrs);
      for (var k in attrs) {
        if (k === 'value' && tagName === 'textarea') {
          children = [attrs[k], children];
        } else {
          var v = this.toText(attrs[k], TEXTMODE.ATTRIBUTE);
          attrStrs.push(' ' + k + '="' + v + '"');
        }
      }
    }
    var startTag = '<' + tagName + attrStrs.join('') + '>';
    var childStrs = [];
    var content;
    if (tagName === 'textarea') {
      for (var i = 0; i < children.length; i++) childStrs.push(this.toText(children[i], TEXTMODE.RCDATA));
      content = childStrs.join('');
      if (content.slice(0, 1) === '\n')
        // TEXTAREA will absorb a newline, so if we see one, add
        // another one.
        content = '\n' + content;
    } else {
      for (var i = 0; i < children.length; i++) childStrs.push(this.visit(children[i]));
      content = childStrs.join('');
    }
    var result = startTag + content;
    if (children.length || !isVoidElement(tagName)) {
      // "Void" elements like BR are the only ones that don't get a close
      // tag in HTML5.  They shouldn't have contents, either, so we could
      // throw an error upon seeing contents here.
      result += '</' + tagName + '>';
    }
    return result;
  },
  visitObject: function (x) {
    throw new Error("Unexpected object in htmljs in toHTML: " + x);
  },
  toText: function (node, textMode) {
    return toText(node, textMode);
  }
});

////////////////////////////// TOHTML

function toHTML(content) {
  return new ToHTMLVisitor().visit(content);
}
const TEXTMODE = {
  STRING: 1,
  RCDATA: 2,
  ATTRIBUTE: 3
};
function toText(content, textMode) {
  if (!textMode) throw new Error("textMode required for HTML.toText");
  if (!(textMode === TEXTMODE.STRING || textMode === TEXTMODE.RCDATA || textMode === TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
  var visitor = new ToTextVisitor({
    textMode: textMode
  });
  return visitor.visit(content);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/htmljs/preamble.js");

/* Exports */
Package._define("htmljs", exports, {
  HTML: HTML
});

})();

//# sourceURL=meteor://💻app/packages/htmljs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3ByZWFtYmxlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9odG1sanMvaHRtbC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3Zpc2l0b3JzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhUTUwiLCJIVE1MVGFncyIsIlRhZyIsIkF0dHJzIiwiZ2V0VGFnIiwiZW5zdXJlVGFnIiwiaXNUYWdFbnN1cmVkIiwiZ2V0U3ltYm9sTmFtZSIsImtub3duSFRNTEVsZW1lbnROYW1lcyIsImtub3duU1ZHRWxlbWVudE5hbWVzIiwia25vd25FbGVtZW50TmFtZXMiLCJ2b2lkRWxlbWVudE5hbWVzIiwiaXNLbm93bkVsZW1lbnQiLCJpc0tub3duU1ZHRWxlbWVudCIsImlzVm9pZEVsZW1lbnQiLCJDaGFyUmVmIiwiQ29tbWVudCIsIlJhdyIsImlzQXJyYXkiLCJpc0NvbnN0cnVjdGVkT2JqZWN0IiwiaXNOdWxseSIsImlzVmFsaWRBdHRyaWJ1dGVOYW1lIiwiZmxhdHRlbkF0dHJpYnV0ZXMiLCJsaW5rIiwidiIsIlZpc2l0b3IiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiVG9IVE1MVmlzaXRvciIsIlRvVGV4dFZpc2l0b3IiLCJ0b0hUTUwiLCJURVhUTU9ERSIsInRvVGV4dCIsIk9iamVjdCIsImFzc2lnbiIsInByb3RvdHlwZSIsInRhZ05hbWUiLCJhdHRycyIsImNoaWxkcmVuIiwiZnJlZXplIiwiaHRtbGpzVHlwZSIsIm1ha2VUYWdDb25zdHJ1Y3RvciIsIkhUTUxUYWciLCJpbnN0YW5jZSIsImkiLCJhcmdzIiwibGVuZ3RoIiwiYXJyYXkiLCJ2YWx1ZSIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJzeW1ib2xOYW1lIiwiRXJyb3IiLCJ0b1VwcGVyQ2FzZSIsInJlcGxhY2UiLCJzcGxpdCIsImNvbmNhdCIsInZvaWRFbGVtZW50U2V0IiwiU2V0Iiwia25vd25FbGVtZW50U2V0Iiwia25vd25TVkdFbGVtZW50U2V0IiwiaGFzIiwiZm9yRWFjaCIsImh0bWwiLCJzdHIiLCJzYW5pdGl6ZWRWYWx1ZSIsIngiLCJBcnJheSIsInBsYWluIiwiZ2V0UHJvdG90eXBlT2YiLCJwcm90byIsIm5vZGUiLCJuYW1lIiwidGVzdCIsImlzTGlzdCIsInJlc3VsdCIsIk4iLCJvbmVBdHRycyIsIklERU5USVRZIiwiX2hhc093blByb3BlcnR5IiwiaGFzT3duUHJvcGVydHkiLCJfYXNzaWduIiwidGd0Iiwic3JjIiwiayIsImNhbGwiLCJwcm9wcyIsImRlZiIsIm9wdGlvbnMiLCJleHRlbmQiLCJjdXJUeXBlIiwic3ViVHlwZSIsIkhUTUxWaXNpdG9yU3VidHlwZSIsImFwcGx5IiwiYXJndW1lbnRzIiwidmlzaXQiLCJjb250ZW50IiwidmlzaXROdWxsIiwidmlzaXRUYWciLCJ2aXNpdENoYXJSZWYiLCJ2aXNpdENvbW1lbnQiLCJ2aXNpdFJhdyIsInZpc2l0QXJyYXkiLCJ2aXNpdE9iamVjdCIsInZpc2l0UHJpbWl0aXZlIiwidmlzaXRGdW5jdGlvbiIsIm51bGxPclVuZGVmaW5lZCIsInN0cmluZ0Jvb2xlYW5Pck51bWJlciIsImNvbW1lbnQiLCJjaGFyUmVmIiwicmF3IiwidGFnIiwib2JqIiwiZm4iLCJvbGRJdGVtIiwibmV3SXRlbSIsInRleHRNb2RlIiwiZWxzZUNvbnRlbnQiLCJvbGRDaGlsZHJlbiIsIm5ld0NoaWxkcmVuIiwidmlzaXRDaGlsZHJlbiIsIm9sZEF0dHJzIiwibmV3QXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZXMiLCJuZXdUYWciLCJhdHRyQXJncyIsInB1c2giLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwidmlzaXRBdHRyaWJ1dGUiLCJTdHJpbmciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJwYXJ0cyIsImpvaW4iLCJhdHRyU3RycyIsInN0YXJ0VGFnIiwiY2hpbGRTdHJzIiwiU1RSSU5HIiwidmlzaXRvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7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QUFNLElBQUloRSxLQUFLLENBQUMsbUNBQW1DLENBQUM7RUFDdEQsSUFBSSxFQUFHZ0UsUUFBUSxLQUFLckYsUUFBUSxDQUFDMkcsTUFBTSxJQUM1QnRCLFFBQVEsS0FBS3JGLFFBQVEsQ0FBQ29HLE1BQU0sSUFDNUJmLFFBQVEsS0FBS3JGLFFBQVEsQ0FBQ3FHLFNBQVMsQ0FBQyxFQUNyQyxNQUFNLElBQUloRixLQUFLLENBQUMsb0JBQW9CLEdBQUdnRSxRQUFRLENBQUM7RUFFbEQsSUFBSXVCLE9BQU8sR0FBRyxJQUFJOUcsYUFBYSxDQUFDO0lBQUN1RixRQUFRLEVBQUVBO0VBQVEsQ0FBQyxDQUFDO0VBQ3JELE9BQU91QixPQUFPLENBQUM1QyxLQUFLLENBQUNDLE9BQU8sQ0FBQztBQUMvQixDIiwiZmlsZSI6Ii9wYWNrYWdlcy9odG1sanMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBIVE1MVGFncyxcbiAgVGFnLFxuICBBdHRycyxcbiAgZ2V0VGFnLFxuICBlbnN1cmVUYWcsXG4gIGlzVGFnRW5zdXJlZCxcbiAgZ2V0U3ltYm9sTmFtZSxcbiAga25vd25IVE1MRWxlbWVudE5hbWVzLFxuICBrbm93blNWR0VsZW1lbnROYW1lcyxcbiAga25vd25FbGVtZW50TmFtZXMsXG4gIHZvaWRFbGVtZW50TmFtZXMsXG4gIGlzS25vd25FbGVtZW50LFxuICBpc0tub3duU1ZHRWxlbWVudCxcbiAgaXNWb2lkRWxlbWVudCxcbiAgQ2hhclJlZixcbiAgQ29tbWVudCxcbiAgUmF3LFxuICBpc0FycmF5LFxuICBpc0NvbnN0cnVjdGVkT2JqZWN0LFxuICBpc051bGx5LFxuICBpc1ZhbGlkQXR0cmlidXRlTmFtZSxcbiAgZmxhdHRlbkF0dHJpYnV0ZXMsXG59IGZyb20gJy4vaHRtbCc7XG5cbmltcG9ydCB7XG4gIFZpc2l0b3IsXG4gIFRyYW5zZm9ybWluZ1Zpc2l0b3IsXG4gIFRvSFRNTFZpc2l0b3IsXG4gIFRvVGV4dFZpc2l0b3IsXG4gIHRvSFRNTCxcbiAgVEVYVE1PREUsXG4gIHRvVGV4dFxufSBmcm9tICcuL3Zpc2l0b3JzJztcblxuXG4vLyB3ZSdyZSBhY3R1YWxseSBleHBvcnRpbmcgdGhlIEhUTUxUYWdzIG9iamVjdC5cbi8vICBiZWNhdXNlIGl0IGlzIGR5bmFtaWNhbGx5IGFsdGVyZWQgYnkgZ2V0VGFnL2Vuc3VyZVRhZ1xuZXhwb3J0IGNvbnN0IEhUTUwgPSBPYmplY3QuYXNzaWduKEhUTUxUYWdzLCB7XG4gIFRhZyxcbiAgQXR0cnMsXG4gIGdldFRhZyxcbiAgZW5zdXJlVGFnLFxuICBpc1RhZ0Vuc3VyZWQsXG4gIGdldFN5bWJvbE5hbWUsXG4gIGtub3duSFRNTEVsZW1lbnROYW1lcyxcbiAga25vd25TVkdFbGVtZW50TmFtZXMsXG4gIGtub3duRWxlbWVudE5hbWVzLFxuICB2b2lkRWxlbWVudE5hbWVzLFxuICBpc0tub3duRWxlbWVudCxcbiAgaXNLbm93blNWR0VsZW1lbnQsXG4gIGlzVm9pZEVsZW1lbnQsXG4gIENoYXJSZWYsXG4gIENvbW1lbnQsXG4gIFJhdyxcbiAgaXNBcnJheSxcbiAgaXNDb25zdHJ1Y3RlZE9iamVjdCxcbiAgaXNOdWxseSxcbiAgaXNWYWxpZEF0dHJpYnV0ZU5hbWUsXG4gIGZsYXR0ZW5BdHRyaWJ1dGVzLFxuICB0b0hUTUwsXG4gIFRFWFRNT0RFLFxuICB0b1RleHQsXG4gIFZpc2l0b3IsXG4gIFRyYW5zZm9ybWluZ1Zpc2l0b3IsXG4gIFRvSFRNTFZpc2l0b3IsXG4gIFRvVGV4dFZpc2l0b3IsXG59KTtcbiIsIlxuZXhwb3J0IGNvbnN0IFRhZyA9IGZ1bmN0aW9uICgpIHt9O1xuVGFnLnByb3RvdHlwZS50YWdOYW1lID0gJyc7IC8vIHRoaXMgd2lsbCBiZSBzZXQgcGVyIFRhZyBzdWJjbGFzc1xuVGFnLnByb3RvdHlwZS5hdHRycyA9IG51bGw7XG5UYWcucHJvdG90eXBlLmNoaWxkcmVuID0gT2JqZWN0LmZyZWV6ZSA/IE9iamVjdC5mcmVlemUoW10pIDogW107XG5UYWcucHJvdG90eXBlLmh0bWxqc1R5cGUgPSBUYWcuaHRtbGpzVHlwZSA9IFsnVGFnJ107XG5cbi8vIEdpdmVuIFwicFwiIGNyZWF0ZSB0aGUgZnVuY3Rpb24gYEhUTUwuUGAuXG52YXIgbWFrZVRhZ0NvbnN0cnVjdG9yID0gZnVuY3Rpb24gKHRhZ05hbWUpIHtcbiAgLy8gVGFnIGlzIHRoZSBwZXItdGFnTmFtZSBjb25zdHJ1Y3RvciBvZiBhIEhUTUwuVGFnIHN1YmNsYXNzXG4gIHZhciBIVE1MVGFnID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICAvLyBXb3JrIHdpdGggb3Igd2l0aG91dCBgbmV3YC4gIElmIG5vdCBjYWxsZWQgd2l0aCBgbmV3YCxcbiAgICAvLyBwZXJmb3JtIGluc3RhbnRpYXRpb24gYnkgcmVjdXJzaXZlbHkgY2FsbGluZyB0aGlzIGNvbnN0cnVjdG9yLlxuICAgIC8vIFdlIGNhbid0IHBhc3MgdmFyYXJncywgc28gcGFzcyBubyBhcmdzLlxuICAgIHZhciBpbnN0YW5jZSA9ICh0aGlzIGluc3RhbmNlb2YgVGFnKSA/IHRoaXMgOiBuZXcgSFRNTFRhZztcblxuICAgIHZhciBpID0gMDtcbiAgICB2YXIgYXR0cnMgPSBhcmdzLmxlbmd0aCAmJiBhcmdzWzBdO1xuICAgIGlmIChhdHRycyAmJiAodHlwZW9mIGF0dHJzID09PSAnb2JqZWN0JykpIHtcbiAgICAgIC8vIFRyZWF0IHZhbmlsbGEgSlMgb2JqZWN0IGFzIGFuIGF0dHJpYnV0ZXMgZGljdGlvbmFyeS5cbiAgICAgIGlmICghIGlzQ29uc3RydWN0ZWRPYmplY3QoYXR0cnMpKSB7XG4gICAgICAgIGluc3RhbmNlLmF0dHJzID0gYXR0cnM7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZiAoYXR0cnMgaW5zdGFuY2VvZiBBdHRycykge1xuICAgICAgICB2YXIgYXJyYXkgPSBhdHRycy52YWx1ZTtcbiAgICAgICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGluc3RhbmNlLmF0dHJzID0gYXJyYXlbMF07XG4gICAgICAgIH0gZWxzZSBpZiAoYXJyYXkubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGluc3RhbmNlLmF0dHJzID0gYXJyYXk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gSWYgbm8gY2hpbGRyZW4sIGRvbid0IGNyZWF0ZSBhbiBhcnJheSBhdCBhbGwsIHVzZSB0aGUgcHJvdG90eXBlJ3NcbiAgICAvLyAoZnJvemVuLCBlbXB0eSkgYXJyYXkuICBUaGlzIHdheSB3ZSBkb24ndCBjcmVhdGUgYW4gZW1wdHkgYXJyYXlcbiAgICAvLyBldmVyeSB0aW1lIHNvbWVvbmUgY3JlYXRlcyBhIHRhZyB3aXRob3V0IGBuZXdgIGFuZCB0aGlzIGNvbnN0cnVjdG9yXG4gICAgLy8gY2FsbHMgaXRzZWxmIHdpdGggbm8gYXJndW1lbnRzIChhYm92ZSkuXG4gICAgaWYgKGkgPCBhcmdzLmxlbmd0aClcbiAgICAgIGluc3RhbmNlLmNoaWxkcmVuID0gYXJncy5zbGljZShpKTtcblxuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfTtcbiAgSFRNTFRhZy5wcm90b3R5cGUgPSBuZXcgVGFnO1xuICBIVE1MVGFnLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEhUTUxUYWc7XG4gIEhUTUxUYWcucHJvdG90eXBlLnRhZ05hbWUgPSB0YWdOYW1lO1xuXG4gIHJldHVybiBIVE1MVGFnO1xufTtcblxuLy8gTm90IGFuIEhUTUxqcyBub2RlLCBidXQgYSB3cmFwcGVyIHRvIHBhc3MgbXVsdGlwbGUgYXR0cnMgZGljdGlvbmFyaWVzXG4vLyB0byBhIHRhZyAoZm9yIHRoZSBwdXJwb3NlIG9mIGltcGxlbWVudGluZyBkeW5hbWljIGF0dHJpYnV0ZXMpLlxuZXhwb3J0IGZ1bmN0aW9uIEF0dHJzKC4uLmFyZ3MpIHtcbiAgLy8gV29yayB3aXRoIG9yIHdpdGhvdXQgYG5ld2AuICBJZiBub3QgY2FsbGVkIHdpdGggYG5ld2AsXG4gIC8vIHBlcmZvcm0gaW5zdGFudGlhdGlvbiBieSByZWN1cnNpdmVseSBjYWxsaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gIC8vIFdlIGNhbid0IHBhc3MgdmFyYXJncywgc28gcGFzcyBubyBhcmdzLlxuICB2YXIgaW5zdGFuY2UgPSAodGhpcyBpbnN0YW5jZW9mIEF0dHJzKSA/IHRoaXMgOiBuZXcgQXR0cnM7XG5cbiAgaW5zdGFuY2UudmFsdWUgPSBhcmdzO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vIEtOT1dOIEVMRU1FTlRTXG5leHBvcnQgY29uc3QgSFRNTFRhZ3MgPSB7fTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRhZyAodGFnTmFtZSkge1xuICB2YXIgc3ltYm9sTmFtZSA9IGdldFN5bWJvbE5hbWUodGFnTmFtZSk7XG4gIGlmIChzeW1ib2xOYW1lID09PSB0YWdOYW1lKSAvLyBhbGwtY2FwcyB0YWdOYW1lXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVXNlIHRoZSBsb3dlcmNhc2Ugb3IgY2FtZWxDYXNlIGZvcm0gb2YgJ1wiICsgdGFnTmFtZSArIFwiJyBoZXJlXCIpO1xuXG4gIGlmICghIEhUTUxUYWdzW3N5bWJvbE5hbWVdKVxuICAgIEhUTUxUYWdzW3N5bWJvbE5hbWVdID0gbWFrZVRhZ0NvbnN0cnVjdG9yKHRhZ05hbWUpO1xuXG4gIHJldHVybiBIVE1MVGFnc1tzeW1ib2xOYW1lXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZVRhZyh0YWdOYW1lKSB7XG4gIGdldFRhZyh0YWdOYW1lKTsgLy8gZG9uJ3QgcmV0dXJuIGl0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1RhZ0Vuc3VyZWQgKHRhZ05hbWUpIHtcbiAgcmV0dXJuIGlzS25vd25FbGVtZW50KHRhZ05hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3ltYm9sTmFtZSAodGFnTmFtZSkge1xuICAvLyBcImZvby1iYXJcIiAtPiBcIkZPT19CQVJcIlxuICByZXR1cm4gdGFnTmFtZS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoLy0vZywgJ18nKTtcbn1cblxuZXhwb3J0IGNvbnN0IGtub3duSFRNTEVsZW1lbnROYW1lcyA9ICdhIGFiYnIgYWNyb255bSBhZGRyZXNzIGFwcGxldCBhcmVhIGFydGljbGUgYXNpZGUgYXVkaW8gYiBiYXNlIGJhc2Vmb250IGJkaSBiZG8gYmlnIGJsb2NrcXVvdGUgYm9keSBiciBidXR0b24gY2FudmFzIGNhcHRpb24gY2VudGVyIGNpdGUgY29kZSBjb2wgY29sZ3JvdXAgY29tbWFuZCBkYXRhIGRhdGFncmlkIGRhdGFsaXN0IGRkIGRlbCBkZXRhaWxzIGRmbiBkaXIgZGl2IGRsIGR0IGVtIGVtYmVkIGV2ZW50c291cmNlIGZpZWxkc2V0IGZpZ2NhcHRpb24gZmlndXJlIGZvbnQgZm9vdGVyIGZvcm0gZnJhbWUgZnJhbWVzZXQgaDEgaDIgaDMgaDQgaDUgaDYgaGVhZCBoZWFkZXIgaGdyb3VwIGhyIGh0bWwgaSBpZnJhbWUgaW1nIGlucHV0IGlucyBpc2luZGV4IGtiZCBrZXlnZW4gbGFiZWwgbGVnZW5kIGxpIGxpbmsgbWFpbiBtYXAgbWFyayBtZW51IG1ldGEgbWV0ZXIgbmF2IG5vZnJhbWVzIG5vc2NyaXB0IG9iamVjdCBvbCBvcHRncm91cCBvcHRpb24gb3V0cHV0IHAgcGFyYW0gcHJlIHByb2dyZXNzIHEgcnAgcnQgcnVieSBzIHNhbXAgc2NyaXB0IHNlY3Rpb24gc2VsZWN0IHNtYWxsIHNvdXJjZSBzcGFuIHN0cmlrZSBzdHJvbmcgc3R5bGUgc3ViIHN1bW1hcnkgc3VwIHRhYmxlIHRib2R5IHRkIHRleHRhcmVhIHRmb290IHRoIHRoZWFkIHRpbWUgdGl0bGUgdHIgdHJhY2sgdHQgdSB1bCB2YXIgdmlkZW8gd2JyJy5zcGxpdCgnICcpO1xuLy8gKHdlIGFkZCB0aGUgU1ZHIG9uZXMgYmVsb3cpXG5cbmV4cG9ydCBjb25zdCBrbm93blNWR0VsZW1lbnROYW1lcyA9ICdhbHRHbHlwaCBhbHRHbHlwaERlZiBhbHRHbHlwaEl0ZW0gYW5pbWF0ZSBhbmltYXRlQ29sb3IgYW5pbWF0ZU1vdGlvbiBhbmltYXRlVHJhbnNmb3JtIGNpcmNsZSBjbGlwUGF0aCBjb2xvci1wcm9maWxlIGN1cnNvciBkZWZzIGRlc2MgZWxsaXBzZSBmZUJsZW5kIGZlQ29sb3JNYXRyaXggZmVDb21wb25lbnRUcmFuc2ZlciBmZUNvbXBvc2l0ZSBmZUNvbnZvbHZlTWF0cml4IGZlRGlmZnVzZUxpZ2h0aW5nIGZlRGlzcGxhY2VtZW50TWFwIGZlRGlzdGFudExpZ2h0IGZlRmxvb2QgZmVGdW5jQSBmZUZ1bmNCIGZlRnVuY0cgZmVGdW5jUiBmZUdhdXNzaWFuQmx1ciBmZUltYWdlIGZlTWVyZ2UgZmVNZXJnZU5vZGUgZmVNb3JwaG9sb2d5IGZlT2Zmc2V0IGZlUG9pbnRMaWdodCBmZVNwZWN1bGFyTGlnaHRpbmcgZmVTcG90TGlnaHQgZmVUaWxlIGZlVHVyYnVsZW5jZSBmaWx0ZXIgZm9udCBmb250LWZhY2UgZm9udC1mYWNlLWZvcm1hdCBmb250LWZhY2UtbmFtZSBmb250LWZhY2Utc3JjIGZvbnQtZmFjZS11cmkgZm9yZWlnbk9iamVjdCBnIGdseXBoIGdseXBoUmVmIGhrZXJuIGltYWdlIGxpbmUgbGluZWFyR3JhZGllbnQgbWFya2VyIG1hc2sgbWV0YWRhdGEgbWlzc2luZy1nbHlwaCBwYXRoIHBhdHRlcm4gcG9seWdvbiBwb2x5bGluZSByYWRpYWxHcmFkaWVudCByZWN0IHNldCBzdG9wIHN0eWxlIHN2ZyBzd2l0Y2ggc3ltYm9sIHRleHQgdGV4dFBhdGggdGl0bGUgdHJlZiB0c3BhbiB1c2UgdmlldyB2a2Vybicuc3BsaXQoJyAnKTtcbi8vIEFwcGVuZCBTVkcgZWxlbWVudCBuYW1lcyB0byBsaXN0IG9mIGtub3duIGVsZW1lbnQgbmFtZXNcbmV4cG9ydCBjb25zdCBrbm93bkVsZW1lbnROYW1lcyA9IGtub3duSFRNTEVsZW1lbnROYW1lcy5jb25jYXQoa25vd25TVkdFbGVtZW50TmFtZXMpO1xuXG5leHBvcnQgY29uc3Qgdm9pZEVsZW1lbnROYW1lcyA9ICdhcmVhIGJhc2UgYnIgY29sIGNvbW1hbmQgZW1iZWQgaHIgaW1nIGlucHV0IGtleWdlbiBsaW5rIG1ldGEgcGFyYW0gc291cmNlIHRyYWNrIHdicicuc3BsaXQoJyAnKTtcblxuXG52YXIgdm9pZEVsZW1lbnRTZXQgPSBuZXcgU2V0KHZvaWRFbGVtZW50TmFtZXMpO1xudmFyIGtub3duRWxlbWVudFNldCA9IG5ldyBTZXQoa25vd25FbGVtZW50TmFtZXMpO1xudmFyIGtub3duU1ZHRWxlbWVudFNldCA9IG5ldyBTZXQoa25vd25TVkdFbGVtZW50TmFtZXMpO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNLbm93bkVsZW1lbnQodGFnTmFtZSkge1xuICByZXR1cm4ga25vd25FbGVtZW50U2V0Lmhhcyh0YWdOYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzS25vd25TVkdFbGVtZW50KHRhZ05hbWUpIHtcbiAgcmV0dXJuIGtub3duU1ZHRWxlbWVudFNldC5oYXModGFnTmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1ZvaWRFbGVtZW50KHRhZ05hbWUpIHtcbiAgcmV0dXJuIHZvaWRFbGVtZW50U2V0Lmhhcyh0YWdOYW1lKTtcbn1cblxuXG4vLyBFbnN1cmUgdGFncyBmb3IgYWxsIGtub3duIGVsZW1lbnRzXG5rbm93bkVsZW1lbnROYW1lcy5mb3JFYWNoKGVuc3VyZVRhZyk7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIENoYXJSZWYoYXR0cnMpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBDaGFyUmVmKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQ2hhclJlZihhdHRycyk7XG5cbiAgaWYgKCEgKGF0dHJzICYmIGF0dHJzLmh0bWwgJiYgYXR0cnMuc3RyKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIkhUTUwuQ2hhclJlZiBtdXN0IGJlIGNvbnN0cnVjdGVkIHdpdGggKHtodG1sOi4uLiwgc3RyOi4uLn0pXCIpO1xuXG4gIHRoaXMuaHRtbCA9IGF0dHJzLmh0bWw7XG4gIHRoaXMuc3RyID0gYXR0cnMuc3RyO1xufVxuQ2hhclJlZi5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IENoYXJSZWYuaHRtbGpzVHlwZSA9IFsnQ2hhclJlZiddO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29tbWVudCh2YWx1ZSkge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIENvbW1lbnQpKVxuICAgIC8vIGNhbGxlZCB3aXRob3V0IGBuZXdgXG4gICAgcmV0dXJuIG5ldyBDb21tZW50KHZhbHVlKTtcblxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUwuQ29tbWVudCBtdXN0IGJlIGNvbnN0cnVjdGVkIHdpdGggYSBzdHJpbmcnKTtcblxuICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIC8vIEtpbGwgaWxsZWdhbCBoeXBoZW5zIGluIGNvbW1lbnQgdmFsdWUgKG5vIHdheSB0byBlc2NhcGUgdGhlbSBpbiBIVE1MKVxuICB0aGlzLnNhbml0aXplZFZhbHVlID0gdmFsdWUucmVwbGFjZSgvXi18LS0rfC0kL2csICcnKTtcbn1cbkNvbW1lbnQucHJvdG90eXBlLmh0bWxqc1R5cGUgPSBDb21tZW50Lmh0bWxqc1R5cGUgPSBbJ0NvbW1lbnQnXTtcblxuZXhwb3J0IGZ1bmN0aW9uIFJhdyh2YWx1ZSkge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIFJhdykpXG4gICAgLy8gY2FsbGVkIHdpdGhvdXQgYG5ld2BcbiAgICByZXR1cm4gbmV3IFJhdyh2YWx1ZSk7XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdIVE1MLlJhdyBtdXN0IGJlIGNvbnN0cnVjdGVkIHdpdGggYSBzdHJpbmcnKTtcblxuICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5SYXcucHJvdG90eXBlLmh0bWxqc1R5cGUgPSBSYXcuaHRtbGpzVHlwZSA9IFsnUmF3J107XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXkgKHgpIHtcbiAgcmV0dXJuIHggaW5zdGFuY2VvZiBBcnJheSB8fCBBcnJheS5pc0FycmF5KHgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb25zdHJ1Y3RlZE9iamVjdCAoeCkge1xuICAvLyBGaWd1cmUgb3V0IGlmIGB4YCBpcyBcImFuIGluc3RhbmNlIG9mIHNvbWUgY2xhc3NcIiBvciBqdXN0IGEgcGxhaW5cbiAgLy8gb2JqZWN0IGxpdGVyYWwuICBJdCBjb3JyZWN0bHkgdHJlYXRzIGFuIG9iamVjdCBsaXRlcmFsIGxpa2VcbiAgLy8gYHsgY29uc3RydWN0b3I6IC4uLiB9YCBhcyBhbiBvYmplY3QgbGl0ZXJhbC4gIEl0IHdvbid0IGRldGVjdFxuICAvLyBpbnN0YW5jZXMgb2YgY2xhc3NlcyB0aGF0IGxhY2sgYSBgY29uc3RydWN0b3JgIHByb3BlcnR5IChlLmcuXG4gIC8vIGlmIHlvdSBhc3NpZ24gdG8gYSBwcm90b3R5cGUgd2hlbiBzZXR0aW5nIHVwIHRoZSBjbGFzcyBhcyBpbjpcbiAgLy8gYEZvbyA9IGZ1bmN0aW9uICgpIHsgLi4uIH07IEZvby5wcm90b3R5cGUgPSB7IC4uLiB9YCwgdGhlblxuICAvLyBgKG5ldyBGb28pLmNvbnN0cnVjdG9yYCBpcyBgT2JqZWN0YCwgbm90IGBGb29gKS5cbiAgaWYoIXggfHwgKHR5cGVvZiB4ICE9PSAnb2JqZWN0JykpIHJldHVybiBmYWxzZTtcbiAgLy8gSXMgdGhpcyBhIHBsYWluIG9iamVjdD9cbiAgbGV0IHBsYWluID0gZmFsc2U7XG4gIGlmKE9iamVjdC5nZXRQcm90b3R5cGVPZih4KSA9PT0gbnVsbCkge1xuICAgIHBsYWluID0gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgcHJvdG8gPSB4O1xuICAgIHdoaWxlKE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90bykgIT09IG51bGwpIHtcbiAgICAgIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKTtcbiAgICB9XG4gICAgcGxhaW4gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoeCkgPT09IHByb3RvO1xuICB9XG5cbiAgcmV0dXJuICFwbGFpbiAmJlxuICAgICh0eXBlb2YgeC5jb25zdHJ1Y3RvciA9PT0gJ2Z1bmN0aW9uJykgJiZcbiAgICAoeCBpbnN0YW5jZW9mIHguY29uc3RydWN0b3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdWxseSAobm9kZSkge1xuICBpZiAobm9kZSA9PSBudWxsKVxuICAgIC8vIG51bGwgb3IgdW5kZWZpbmVkXG4gICAgcmV0dXJuIHRydWU7XG5cbiAgaWYgKGlzQXJyYXkobm9kZSkpIHtcbiAgICAvLyBpcyBpdCBhbiBlbXB0eSBhcnJheSBvciBhbiBhcnJheSBvZiBhbGwgbnVsbHkgaXRlbXM/XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmxlbmd0aDsgaSsrKVxuICAgICAgaWYgKCEgaXNOdWxseShub2RlW2ldKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZEF0dHJpYnV0ZU5hbWUgKG5hbWUpIHtcbiAgcmV0dXJuIC9eWzpfQS1aYS16XVs6X0EtWmEtejAtOS5cXC1dKi8udGVzdChuYW1lKTtcbn1cblxuLy8gSWYgYGF0dHJzYCBpcyBhbiBhcnJheSBvZiBhdHRyaWJ1dGVzIGRpY3Rpb25hcmllcywgY29tYmluZXMgdGhlbVxuLy8gaW50byBvbmUuICBSZW1vdmVzIGF0dHJpYnV0ZXMgdGhhdCBhcmUgXCJudWxseS5cIlxuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW5BdHRyaWJ1dGVzIChhdHRycykge1xuICBpZiAoISBhdHRycylcbiAgICByZXR1cm4gYXR0cnM7XG5cbiAgdmFyIGlzTGlzdCA9IGlzQXJyYXkoYXR0cnMpO1xuICBpZiAoaXNMaXN0ICYmIGF0dHJzLmxlbmd0aCA9PT0gMClcbiAgICByZXR1cm4gbnVsbDtcblxuICB2YXIgcmVzdWx0ID0ge307XG4gIGZvciAodmFyIGkgPSAwLCBOID0gKGlzTGlzdCA/IGF0dHJzLmxlbmd0aCA6IDEpOyBpIDwgTjsgaSsrKSB7XG4gICAgdmFyIG9uZUF0dHJzID0gKGlzTGlzdCA/IGF0dHJzW2ldIDogYXR0cnMpO1xuICAgIGlmICgodHlwZW9mIG9uZUF0dHJzICE9PSAnb2JqZWN0JykgfHxcbiAgICAgICAgaXNDb25zdHJ1Y3RlZE9iamVjdChvbmVBdHRycykpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBwbGFpbiBKUyBvYmplY3QgYXMgYXR0cnMsIGZvdW5kOiBcIiArIG9uZUF0dHJzKTtcbiAgICBmb3IgKHZhciBuYW1lIGluIG9uZUF0dHJzKSB7XG4gICAgICBpZiAoISBpc1ZhbGlkQXR0cmlidXRlTmFtZShuYW1lKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSWxsZWdhbCBIVE1MIGF0dHJpYnV0ZSBuYW1lOiBcIiArIG5hbWUpO1xuICAgICAgdmFyIHZhbHVlID0gb25lQXR0cnNbbmFtZV07XG4gICAgICBpZiAoISBpc051bGx5KHZhbHVlKSlcbiAgICAgICAgcmVzdWx0W25hbWVdID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsImltcG9ydCB7XG4gIFRhZyxcbiAgQ2hhclJlZixcbiAgQ29tbWVudCxcbiAgUmF3LFxuICBpc0FycmF5LFxuICBnZXRUYWcsXG4gIGlzQ29uc3RydWN0ZWRPYmplY3QsXG4gIGZsYXR0ZW5BdHRyaWJ1dGVzLFxuICBpc1ZvaWRFbGVtZW50LFxufSBmcm9tICcuL2h0bWwnO1xuXG5cbnZhciBJREVOVElUWSA9IGZ1bmN0aW9uICh4KSB7IHJldHVybiB4OyB9O1xuXG4vLyBfYXNzaWduIGlzIGxpa2UgXy5leHRlbmQgb3IgdGhlIHVwY29taW5nIE9iamVjdC5hc3NpZ24uXG4vLyBDb3B5IHNyYydzIG93biwgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9udG8gdGd0IGFuZCByZXR1cm5cbi8vIHRndC5cbnZhciBfaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIF9hc3NpZ24gPSBmdW5jdGlvbiAodGd0LCBzcmMpIHtcbiAgZm9yICh2YXIgayBpbiBzcmMpIHtcbiAgICBpZiAoX2hhc093blByb3BlcnR5LmNhbGwoc3JjLCBrKSlcbiAgICAgIHRndFtrXSA9IHNyY1trXTtcbiAgfVxuICByZXR1cm4gdGd0O1xufTtcblxuZXhwb3J0IGNvbnN0IFZpc2l0b3IgPSBmdW5jdGlvbiAocHJvcHMpIHtcbiAgX2Fzc2lnbih0aGlzLCBwcm9wcyk7XG59O1xuXG5WaXNpdG9yLmRlZiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIF9hc3NpZ24odGhpcy5wcm90b3R5cGUsIG9wdGlvbnMpO1xufTtcblxuVmlzaXRvci5leHRlbmQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICB2YXIgY3VyVHlwZSA9IHRoaXM7XG4gIHZhciBzdWJUeXBlID0gZnVuY3Rpb24gSFRNTFZpc2l0b3JTdWJ0eXBlKC8qYXJndW1lbnRzKi8pIHtcbiAgICBWaXNpdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH07XG4gIHN1YlR5cGUucHJvdG90eXBlID0gbmV3IGN1clR5cGU7XG4gIHN1YlR5cGUuZXh0ZW5kID0gY3VyVHlwZS5leHRlbmQ7XG4gIHN1YlR5cGUuZGVmID0gY3VyVHlwZS5kZWY7XG4gIGlmIChvcHRpb25zKVxuICAgIF9hc3NpZ24oc3ViVHlwZS5wcm90b3R5cGUsIG9wdGlvbnMpO1xuICByZXR1cm4gc3ViVHlwZTtcbn07XG5cblZpc2l0b3IuZGVmKHtcbiAgdmlzaXQ6IGZ1bmN0aW9uIChjb250ZW50LyosIC4uLiovKSB7XG4gICAgaWYgKGNvbnRlbnQgPT0gbnVsbClcbiAgICAgIC8vIG51bGwgb3IgdW5kZWZpbmVkLlxuICAgICAgcmV0dXJuIHRoaXMudmlzaXROdWxsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICBpZiAodHlwZW9mIGNvbnRlbnQgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoY29udGVudC5odG1sanNUeXBlKSB7XG4gICAgICAgIHN3aXRjaCAoY29udGVudC5odG1sanNUeXBlKSB7XG4gICAgICAgIGNhc2UgVGFnLmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRUYWcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgY2FzZSBDaGFyUmVmLmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRDaGFyUmVmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNhc2UgQ29tbWVudC5odG1sanNUeXBlOlxuICAgICAgICAgIHJldHVybiB0aGlzLnZpc2l0Q29tbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBjYXNlIFJhdy5odG1sanNUeXBlOlxuICAgICAgICAgIHJldHVybiB0aGlzLnZpc2l0UmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBodG1sanMgdHlwZTogXCIgKyBjb250ZW50Lmh0bWxqc1R5cGUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0FycmF5KGNvbnRlbnQpKVxuICAgICAgICByZXR1cm4gdGhpcy52aXNpdEFycmF5LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZpc2l0T2JqZWN0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKCh0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycpIHx8XG4gICAgICAgICAgICAgICAodHlwZW9mIGNvbnRlbnQgPT09ICdib29sZWFuJykgfHxcbiAgICAgICAgICAgICAgICh0eXBlb2YgY29udGVudCA9PT0gJ251bWJlcicpKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdFByaW1pdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRGdW5jdGlvbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb2JqZWN0IGluIGh0bWxqczogXCIgKyBjb250ZW50KTtcblxuICB9LFxuICB2aXNpdE51bGw6IGZ1bmN0aW9uIChudWxsT3JVbmRlZmluZWQvKiwgLi4uKi8pIHt9LFxuICB2aXNpdFByaW1pdGl2ZTogZnVuY3Rpb24gKHN0cmluZ0Jvb2xlYW5Pck51bWJlci8qLCAuLi4qLykge30sXG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uIChhcnJheS8qLCAuLi4qLykge30sXG4gIHZpc2l0Q29tbWVudDogZnVuY3Rpb24gKGNvbW1lbnQvKiwgLi4uKi8pIHt9LFxuICB2aXNpdENoYXJSZWY6IGZ1bmN0aW9uIChjaGFyUmVmLyosIC4uLiovKSB7fSxcbiAgdmlzaXRSYXc6IGZ1bmN0aW9uIChyYXcvKiwgLi4uKi8pIHt9LFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZy8qLCAuLi4qLykge30sXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAob2JqLyosIC4uLiovKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBvYmplY3QgaW4gaHRtbGpzOiBcIiArIG9iaik7XG4gIH0sXG4gIHZpc2l0RnVuY3Rpb246IGZ1bmN0aW9uIChmbi8qLCAuLi4qLykge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgZnVuY3Rpb24gaW4gaHRtbGpzOiBcIiArIGZuKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCBUcmFuc2Zvcm1pbmdWaXNpdG9yID0gVmlzaXRvci5leHRlbmQoKTtcblRyYW5zZm9ybWluZ1Zpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBJREVOVElUWSxcbiAgdmlzaXRQcmltaXRpdmU6IElERU5USVRZLFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXksIC4uLmFyZ3MpIHtcbiAgICB2YXIgcmVzdWx0ID0gYXJyYXk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG9sZEl0ZW0gPSBhcnJheVtpXTtcbiAgICAgIHZhciBuZXdJdGVtID0gdGhpcy52aXNpdChvbGRJdGVtLCAuLi5hcmdzKTtcbiAgICAgIGlmIChuZXdJdGVtICE9PSBvbGRJdGVtKSB7XG4gICAgICAgIC8vIGNvcHkgYGFycmF5YCBvbiB3cml0ZVxuICAgICAgICBpZiAocmVzdWx0ID09PSBhcnJheSlcbiAgICAgICAgICByZXN1bHQgPSBhcnJheS5zbGljZSgpO1xuICAgICAgICByZXN1bHRbaV0gPSBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuICB2aXNpdENvbW1lbnQ6IElERU5USVRZLFxuICB2aXNpdENoYXJSZWY6IElERU5USVRZLFxuICB2aXNpdFJhdzogSURFTlRJVFksXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbihvYmosIC4uLmFyZ3Mpe1xuICAgIC8vIERvbid0IHBhcnNlIE1hcmtkb3duICYgUkNEYXRhIGFzIEhUTUxcbiAgICBpZiAob2JqLnRleHRNb2RlICE9IG51bGwpe1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgaWYgKCdjb250ZW50JyBpbiBvYmopIHtcbiAgICAgIG9iai5jb250ZW50ID0gdGhpcy52aXNpdChvYmouY29udGVudCwgLi4uYXJncyk7XG4gICAgfVxuICAgIGlmICgnZWxzZUNvbnRlbnQnIGluIG9iail7XG4gICAgICBvYmouZWxzZUNvbnRlbnQgPSB0aGlzLnZpc2l0KG9iai5lbHNlQ29udGVudCwgLi4uYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH0sXG4gIHZpc2l0RnVuY3Rpb246IElERU5USVRZLFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZywgLi4uYXJncykge1xuICAgIHZhciBvbGRDaGlsZHJlbiA9IHRhZy5jaGlsZHJlbjtcbiAgICB2YXIgbmV3Q2hpbGRyZW4gPSB0aGlzLnZpc2l0Q2hpbGRyZW4ob2xkQ2hpbGRyZW4sIC4uLmFyZ3MpO1xuXG4gICAgdmFyIG9sZEF0dHJzID0gdGFnLmF0dHJzO1xuICAgIHZhciBuZXdBdHRycyA9IHRoaXMudmlzaXRBdHRyaWJ1dGVzKG9sZEF0dHJzLCAuLi5hcmdzKTtcblxuICAgIGlmIChuZXdBdHRycyA9PT0gb2xkQXR0cnMgJiYgbmV3Q2hpbGRyZW4gPT09IG9sZENoaWxkcmVuKVxuICAgICAgcmV0dXJuIHRhZztcblxuICAgIHZhciBuZXdUYWcgPSBnZXRUYWcodGFnLnRhZ05hbWUpLmFwcGx5KG51bGwsIG5ld0NoaWxkcmVuKTtcbiAgICBuZXdUYWcuYXR0cnMgPSBuZXdBdHRycztcbiAgICByZXR1cm4gbmV3VGFnO1xuICB9LFxuICB2aXNpdENoaWxkcmVuOiBmdW5jdGlvbiAoY2hpbGRyZW4sIC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFycmF5KGNoaWxkcmVuLCAuLi5hcmdzKTtcbiAgfSxcbiAgLy8gVHJhbnNmb3JtIHRoZSBgLmF0dHJzYCBwcm9wZXJ0eSBvZiBhIHRhZywgd2hpY2ggbWF5IGJlIGEgZGljdGlvbmFyeSxcbiAgLy8gYW4gYXJyYXksIG9yIGluIHNvbWUgdXNlcywgYSBmb3JlaWduIG9iamVjdCAoc3VjaCBhc1xuICAvLyBhIHRlbXBsYXRlIHRhZykuXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzLCAuLi5hcmdzKSB7XG4gICAgaWYgKGlzQXJyYXkoYXR0cnMpKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gYXR0cnM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvbGRJdGVtID0gYXR0cnNbaV07XG4gICAgICAgIHZhciBuZXdJdGVtID0gdGhpcy52aXNpdEF0dHJpYnV0ZXMob2xkSXRlbSwgLi4uYXJncyk7XG4gICAgICAgIGlmIChuZXdJdGVtICE9PSBvbGRJdGVtKSB7XG4gICAgICAgICAgLy8gY29weSBvbiB3cml0ZVxuICAgICAgICAgIGlmIChyZXN1bHQgPT09IGF0dHJzKVxuICAgICAgICAgICAgcmVzdWx0ID0gYXR0cnMuc2xpY2UoKTtcbiAgICAgICAgICByZXN1bHRbaV0gPSBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGlmIChhdHRycyAmJiBpc0NvbnN0cnVjdGVkT2JqZWN0KGF0dHJzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGJhc2ljIFRyYW5zZm9ybWluZ1Zpc2l0b3IgZG9lcyBub3Qgc3VwcG9ydCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgXCJmb3JlaWduIG9iamVjdHMgaW4gYXR0cmlidXRlcy4gIERlZmluZSBhIGN1c3RvbSBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgXCJ2aXNpdEF0dHJpYnV0ZXMgZm9yIHRoaXMgY2FzZS5cIik7XG4gICAgfVxuXG4gICAgdmFyIG9sZEF0dHJzID0gYXR0cnM7XG4gICAgdmFyIG5ld0F0dHJzID0gb2xkQXR0cnM7XG4gICAgaWYgKG9sZEF0dHJzKSB7XG4gICAgICB2YXIgYXR0ckFyZ3MgPSBbbnVsbCwgbnVsbF07XG4gICAgICBhdHRyQXJncy5wdXNoLmFwcGx5KGF0dHJBcmdzLCBhcmd1bWVudHMpO1xuICAgICAgZm9yICh2YXIgayBpbiBvbGRBdHRycykge1xuICAgICAgICB2YXIgb2xkVmFsdWUgPSBvbGRBdHRyc1trXTtcbiAgICAgICAgYXR0ckFyZ3NbMF0gPSBrO1xuICAgICAgICBhdHRyQXJnc1sxXSA9IG9sZFZhbHVlO1xuICAgICAgICB2YXIgbmV3VmFsdWUgPSB0aGlzLnZpc2l0QXR0cmlidXRlLmFwcGx5KHRoaXMsIGF0dHJBcmdzKTtcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xuICAgICAgICAgIC8vIGNvcHkgb24gd3JpdGVcbiAgICAgICAgICBpZiAobmV3QXR0cnMgPT09IG9sZEF0dHJzKVxuICAgICAgICAgICAgbmV3QXR0cnMgPSBfYXNzaWduKHt9LCBvbGRBdHRycyk7XG4gICAgICAgICAgbmV3QXR0cnNba10gPSBuZXdWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXdBdHRycztcbiAgfSxcbiAgLy8gVHJhbnNmb3JtIHRoZSB2YWx1ZSBvZiBvbmUgYXR0cmlidXRlIG5hbWUvdmFsdWUgaW4gYW5cbiAgLy8gYXR0cmlidXRlcyBkaWN0aW9uYXJ5LlxuICB2aXNpdEF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB0YWcsIC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdCh2YWx1ZSwgLi4uYXJncyk7XG4gIH1cbn0pO1xuXG5cbmV4cG9ydCBjb25zdCBUb1RleHRWaXNpdG9yID0gVmlzaXRvci5leHRlbmQoKTtcblRvVGV4dFZpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBmdW5jdGlvbiAobnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICB2aXNpdFByaW1pdGl2ZTogZnVuY3Rpb24gKHN0cmluZ0Jvb2xlYW5Pck51bWJlcikge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoc3RyaW5nQm9vbGVhbk9yTnVtYmVyKTtcbiAgICBpZiAodGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuUkNEQVRBKSB7XG4gICAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpO1xuICAgIH0gZWxzZSBpZiAodGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuQVRUUklCVVRFKSB7XG4gICAgICAvLyBlc2NhcGUgYCZgIGFuZCBgXCJgIHRoaXMgdGltZSwgbm90IGAmYCBhbmQgYDxgXG4gICAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgfSxcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgdmFyIHBhcnRzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKylcbiAgICAgIHBhcnRzLnB1c2godGhpcy52aXNpdChhcnJheVtpXSkpO1xuICAgIHJldHVybiBwYXJ0cy5qb2luKCcnKTtcbiAgfSxcbiAgdmlzaXRDb21tZW50OiBmdW5jdGlvbiAoY29tbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGhhdmUgYSBjb21tZW50IGhlcmVcIik7XG4gIH0sXG4gIHZpc2l0Q2hhclJlZjogZnVuY3Rpb24gKGNoYXJSZWYpIHtcbiAgICBpZiAodGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgIHRoaXMudGV4dE1vZGUgPT09IFRFWFRNT0RFLkFUVFJJQlVURSkge1xuICAgICAgcmV0dXJuIGNoYXJSZWYuaHRtbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNoYXJSZWYuc3RyO1xuICAgIH1cbiAgfSxcbiAgdmlzaXRSYXc6IGZ1bmN0aW9uIChyYXcpIHtcbiAgICByZXR1cm4gcmF3LnZhbHVlO1xuICB9LFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZykge1xuICAgIC8vIFJlYWxseSB3ZSBzaG91bGQganVzdCBkaXNhbGxvdyBUYWdzIGhlcmUuICBIb3dldmVyLCBhdCB0aGVcbiAgICAvLyBtb21lbnQgaXQncyB1c2VmdWwgdG8gc3RyaW5naWZ5IGFueSBIVE1MIHdlIGZpbmQuICBJblxuICAgIC8vIHBhcnRpY3VsYXIsIHdoZW4geW91IGluY2x1ZGUgYSB0ZW1wbGF0ZSB3aXRoaW4gYHt7I21hcmtkb3dufX1gLFxuICAgIC8vIHdlIHJlbmRlciB0aGUgdGVtcGxhdGUgYXMgdGV4dCwgYW5kIHNpbmNlIHRoZXJlJ3MgY3VycmVudGx5XG4gICAgLy8gbm8gd2F5IHRvIG1ha2UgdGhlIHRlbXBsYXRlIGJlICpwYXJzZWQqIGFzIHRleHQgKGUuZy4gYDx0ZW1wbGF0ZVxuICAgIC8vIHR5cGU9XCJ0ZXh0XCI+YCksIHdlIGhhY2tpc2hseSBzdXBwb3J0IEhUTUwgdGFncyBpbiBtYXJrZG93blxuICAgIC8vIGluIHRlbXBsYXRlcyBieSBwYXJzaW5nIHRoZW0gYW5kIHN0cmluZ2lmeWluZyB0aGVtLlxuICAgIHJldHVybiB0aGlzLnZpc2l0KHRoaXMudG9IVE1MKHRhZykpO1xuICB9LFxuICB2aXNpdE9iamVjdDogZnVuY3Rpb24gKHgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIG9iamVjdCBpbiBodG1sanMgaW4gdG9UZXh0OiBcIiArIHgpO1xuICB9LFxuICB0b0hUTUw6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIHRvSFRNTChub2RlKTtcbiAgfVxufSk7XG5cblxuXG5leHBvcnQgY29uc3QgVG9IVE1MVmlzaXRvciA9IFZpc2l0b3IuZXh0ZW5kKCk7XG5Ub0hUTUxWaXNpdG9yLmRlZih7XG4gIHZpc2l0TnVsbDogZnVuY3Rpb24gKG51bGxPclVuZGVmaW5lZCkge1xuICAgIHJldHVybiAnJztcbiAgfSxcbiAgdmlzaXRQcmltaXRpdmU6IGZ1bmN0aW9uIChzdHJpbmdCb29sZWFuT3JOdW1iZXIpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKHN0cmluZ0Jvb2xlYW5Pck51bWJlcik7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKTtcbiAgfSxcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgdmFyIHBhcnRzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKylcbiAgICAgIHBhcnRzLnB1c2godGhpcy52aXNpdChhcnJheVtpXSkpO1xuICAgIHJldHVybiBwYXJ0cy5qb2luKCcnKTtcbiAgfSxcbiAgdmlzaXRDb21tZW50OiBmdW5jdGlvbiAoY29tbWVudCkge1xuICAgIHJldHVybiAnPCEtLScgKyBjb21tZW50LnNhbml0aXplZFZhbHVlICsgJy0tPic7XG4gIH0sXG4gIHZpc2l0Q2hhclJlZjogZnVuY3Rpb24gKGNoYXJSZWYpIHtcbiAgICByZXR1cm4gY2hhclJlZi5odG1sO1xuICB9LFxuICB2aXNpdFJhdzogZnVuY3Rpb24gKHJhdykge1xuICAgIHJldHVybiByYXcudmFsdWU7XG4gIH0sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnKSB7XG4gICAgdmFyIGF0dHJTdHJzID0gW107XG5cbiAgICB2YXIgdGFnTmFtZSA9IHRhZy50YWdOYW1lO1xuICAgIHZhciBjaGlsZHJlbiA9IHRhZy5jaGlsZHJlbjtcblxuICAgIHZhciBhdHRycyA9IHRhZy5hdHRycztcbiAgICBpZiAoYXR0cnMpIHtcbiAgICAgIGF0dHJzID0gZmxhdHRlbkF0dHJpYnV0ZXMoYXR0cnMpO1xuICAgICAgZm9yICh2YXIgayBpbiBhdHRycykge1xuICAgICAgICBpZiAoayA9PT0gJ3ZhbHVlJyAmJiB0YWdOYW1lID09PSAndGV4dGFyZWEnKSB7XG4gICAgICAgICAgY2hpbGRyZW4gPSBbYXR0cnNba10sIGNoaWxkcmVuXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgdiA9IHRoaXMudG9UZXh0KGF0dHJzW2tdLCBURVhUTU9ERS5BVFRSSUJVVEUpO1xuICAgICAgICAgIGF0dHJTdHJzLnB1c2goJyAnICsgayArICc9XCInICsgdiArICdcIicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHN0YXJ0VGFnID0gJzwnICsgdGFnTmFtZSArIGF0dHJTdHJzLmpvaW4oJycpICsgJz4nO1xuXG4gICAgdmFyIGNoaWxkU3RycyA9IFtdO1xuICAgIHZhciBjb250ZW50O1xuICAgIGlmICh0YWdOYW1lID09PSAndGV4dGFyZWEnKSB7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspXG4gICAgICAgIGNoaWxkU3Rycy5wdXNoKHRoaXMudG9UZXh0KGNoaWxkcmVuW2ldLCBURVhUTU9ERS5SQ0RBVEEpKTtcblxuICAgICAgY29udGVudCA9IGNoaWxkU3Rycy5qb2luKCcnKTtcbiAgICAgIGlmIChjb250ZW50LnNsaWNlKDAsIDEpID09PSAnXFxuJylcbiAgICAgICAgLy8gVEVYVEFSRUEgd2lsbCBhYnNvcmIgYSBuZXdsaW5lLCBzbyBpZiB3ZSBzZWUgb25lLCBhZGRcbiAgICAgICAgLy8gYW5vdGhlciBvbmUuXG4gICAgICAgIGNvbnRlbnQgPSAnXFxuJyArIGNvbnRlbnQ7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKylcbiAgICAgICAgY2hpbGRTdHJzLnB1c2godGhpcy52aXNpdChjaGlsZHJlbltpXSkpO1xuXG4gICAgICBjb250ZW50ID0gY2hpbGRTdHJzLmpvaW4oJycpO1xuICAgIH1cblxuICAgIHZhciByZXN1bHQgPSBzdGFydFRhZyArIGNvbnRlbnQ7XG5cbiAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoIHx8ICEgaXNWb2lkRWxlbWVudCh0YWdOYW1lKSkge1xuICAgICAgLy8gXCJWb2lkXCIgZWxlbWVudHMgbGlrZSBCUiBhcmUgdGhlIG9ubHkgb25lcyB0aGF0IGRvbid0IGdldCBhIGNsb3NlXG4gICAgICAvLyB0YWcgaW4gSFRNTDUuICBUaGV5IHNob3VsZG4ndCBoYXZlIGNvbnRlbnRzLCBlaXRoZXIsIHNvIHdlIGNvdWxkXG4gICAgICAvLyB0aHJvdyBhbiBlcnJvciB1cG9uIHNlZWluZyBjb250ZW50cyBoZXJlLlxuICAgICAgcmVzdWx0ICs9ICc8LycgKyB0YWdOYW1lICsgJz4nO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb2JqZWN0IGluIGh0bWxqcyBpbiB0b0hUTUw6IFwiICsgeCk7XG4gIH0sXG4gIHRvVGV4dDogZnVuY3Rpb24gKG5vZGUsIHRleHRNb2RlKSB7XG4gICAgcmV0dXJuIHRvVGV4dChub2RlLCB0ZXh0TW9kZSk7XG4gIH1cbn0pO1xuXG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vIFRPSFRNTFxuXG5leHBvcnQgZnVuY3Rpb24gdG9IVE1MKGNvbnRlbnQpIHtcbiAgcmV0dXJuIChuZXcgVG9IVE1MVmlzaXRvcikudmlzaXQoY29udGVudCk7XG59XG5cbi8vIEVzY2FwaW5nIG1vZGVzIGZvciBvdXRwdXR0aW5nIHRleHQgd2hlbiBnZW5lcmF0aW5nIEhUTUwuXG5leHBvcnQgY29uc3QgVEVYVE1PREUgPSB7XG4gIFNUUklORzogMSxcbiAgUkNEQVRBOiAyLFxuICBBVFRSSUJVVEU6IDNcbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHRvVGV4dChjb250ZW50LCB0ZXh0TW9kZSkge1xuICBpZiAoISB0ZXh0TW9kZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0ZXh0TW9kZSByZXF1aXJlZCBmb3IgSFRNTC50b1RleHRcIik7XG4gIGlmICghICh0ZXh0TW9kZSA9PT0gVEVYVE1PREUuU1RSSU5HIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gVEVYVE1PREUuQVRUUklCVVRFKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHRleHRNb2RlOiBcIiArIHRleHRNb2RlKTtcblxuICB2YXIgdmlzaXRvciA9IG5ldyBUb1RleHRWaXNpdG9yKHt0ZXh0TW9kZTogdGV4dE1vZGV9KTtcbiAgcmV0dXJuIHZpc2l0b3IudmlzaXQoY29udGVudCk7XG59XG4iXX0=
