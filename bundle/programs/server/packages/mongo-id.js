(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EJSON = Package.ejson.EJSON;
var Random = Package.random.Random;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var hexString, MongoID;

var require = meteorInstall({"node_modules":{"meteor":{"mongo-id":{"id.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                           //
// packages/mongo-id/id.js                                                                   //
//                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////
                                                                                             //
module.export({
  MongoID: () => MongoID
});
let EJSON;
module.link("meteor/ejson", {
  EJSON(v) {
    EJSON = v;
  }
}, 0);
let Random;
module.link("meteor/random", {
  Random(v) {
    Random = v;
  }
}, 1);
const MongoID = {};
MongoID._looksLikeObjectID = str => str.length === 24 && str.match(/^[0-9a-f]*$/);
MongoID.ObjectID = class ObjectID {
  constructor(hexString) {
    //random-based impl of Mongo ObjectID
    if (hexString) {
      hexString = hexString.toLowerCase();
      if (!MongoID._looksLikeObjectID(hexString)) {
        throw new Error('Invalid hexadecimal string for creating an ObjectID');
      }
      // meant to work with _.isEqual(), which relies on structural equality
      this._str = hexString;
    } else {
      this._str = Random.hexString(24);
    }
  }
  equals(other) {
    return other instanceof MongoID.ObjectID && this.valueOf() === other.valueOf();
  }
  toString() {
    return "ObjectID(\"".concat(this._str, "\")");
  }
  clone() {
    return new MongoID.ObjectID(this._str);
  }
  typeName() {
    return 'oid';
  }
  getTimestamp() {
    return Number.parseInt(this._str.substr(0, 8), 16);
  }
  valueOf() {
    return this._str;
  }
  toJSONValue() {
    return this.valueOf();
  }
  toHexString() {
    return this.valueOf();
  }
};
EJSON.addType('oid', str => new MongoID.ObjectID(str));
MongoID.idStringify = id => {
  if (id instanceof MongoID.ObjectID) {
    return id.valueOf();
  } else if (typeof id === 'string') {
    var firstChar = id.charAt(0);
    if (id === '') {
      return id;
    } else if (firstChar === '-' ||
    // escape previously dashed strings
    firstChar === '~' ||
    // escape escaped numbers, true, false
    MongoID._looksLikeObjectID(id) ||
    // escape object-id-form strings
    firstChar === '{') {
      // escape object-form strings, for maybe implementing later
      return "-".concat(id);
    } else {
      return id; // other strings go through unchanged.
    }
  } else if (id === undefined) {
    return '-';
  } else if (typeof id === 'object' && id !== null) {
    throw new Error('Meteor does not currently support objects other than ObjectID as ids');
  } else {
    // Numbers, true, false, null
    return "~".concat(JSON.stringify(id));
  }
};
MongoID.idParse = id => {
  var firstChar = id.charAt(0);
  if (id === '') {
    return id;
  } else if (id === '-') {
    return undefined;
  } else if (firstChar === '-') {
    return id.substr(1);
  } else if (firstChar === '~') {
    return JSON.parse(id.substr(1));
  } else if (MongoID._looksLikeObjectID(id)) {
    return new MongoID.ObjectID(id);
  } else {
    return id;
  }
};
///////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/mongo-id/id.js");

/* Exports */
Package._define("mongo-id", exports, {
  MongoID: MongoID
});

})();

//# sourceURL=meteor://💻app/packages/mongo-id.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28taWQvaWQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiTW9uZ29JRCIsIkVKU09OIiwibGluayIsInYiLCJSYW5kb20iLCJfbG9va3NMaWtlT2JqZWN0SUQiLCJzdHIiLCJsZW5ndGgiLCJtYXRjaCIsIk9iamVjdElEIiwiY29uc3RydWN0b3IiLCJoZXhTdHJpbmciLCJ0b0xvd2VyQ2FzZSIsIkVycm9yIiwiX3N0ciIsImVxdWFscyIsIm90aGVyIiwidmFsdWVPZiIsInRvU3RyaW5nIiwiY2xvbmUiLCJ0eXBlTmFtZSIsImdldFRpbWVzdGFtcCIsIk51bWJlciIsInBhcnNlSW50Iiwic3Vic3RyIiwidG9KU09OVmFsdWUiLCJ0b0hleFN0cmluZyIsImFkZFR5cGUiLCJpZFN0cmluZ2lmeSIsImlkIiwiZmlyc3RDaGFyIiwiY2hhckF0IiwidW5kZWZpbmVkIiwiSlNPTiIsInN0cmluZ2lmeSIsImlkUGFyc2UiLCJwYXJzZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0MsT0FBTyxFQUFDLE1BQUlBO0FBQU8sQ0FBQyxDQUFDO0FBQUMsSUFBSUMsS0FBSztBQUFDSCxNQUFNLENBQUNJLElBQUksQ0FBQyxjQUFjLEVBQUM7RUFBQ0QsS0FBSyxDQUFDRSxDQUFDLEVBQUM7SUFBQ0YsS0FBSyxHQUFDRSxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQUMsSUFBSUMsTUFBTTtBQUFDTixNQUFNLENBQUNJLElBQUksQ0FBQyxlQUFlLEVBQUM7RUFBQ0UsTUFBTSxDQUFDRCxDQUFDLEVBQUM7SUFBQ0MsTUFBTSxHQUFDRCxDQUFDO0VBQUE7QUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBR2hLLE1BQU1ILE9BQU8sR0FBRyxDQUFDLENBQUM7QUFFbEJBLE9BQU8sQ0FBQ0ssa0JBQWtCLEdBQUdDLEdB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QUFDTCxFQUFFLENBQUM7RUFDL0I7QUFDRixDQUFDO0FBRUQ3QixPQUFPLENBQUNtQyxPQUFPLEdBQUlOLEVBQUUsSUFBSztFQUN4QixJQUFJQyxTQUFTLEdBQUdELEVBQUUsQ0FBQ0UsTUFBTSxDQUFDLENBQUMsQ0FBQztFQUM1QixJQUFJRixFQUFFLEtBQUssRUFBRSxFQUFFO0lBQ2IsT0FBT0EsRUFBRTtFQUNYLENBQUMsTUFBTSxJQUFJQSxFQUFFLEtBQUssR0FBRyxFQUFFO0lBQ3JCLE9BQU9HLFNBQVM7RUFDbEIsQ0FBQyxNQUFNLElBQUlGLFNBQVMsS0FBSyxHQUFHLEVBQUU7SUFDNUIsT0FBT0QsRUFBRSxDQUFDTCxNQUFNLENBQUMsQ0FBQyxDQUFDO0VBQ3JCLENBQUMsTUFBTSxJQUFJTSxTQUFTLEtBQUssR0FBRyxFQUFFO0lBQzVCLE9BQU9HLElBQUksQ0FBQ0csS0FBSyxDQUFDUCxFQUFFLENBQUNMLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNqQyxDQUFDLE1BQU0sSUFBSXhCLE9BQU8sQ0FBQ0ssa0JBQWtCLENBQUN3QixFQUFFLENBQUMsRUFBRTtJQUN6QyxPQUFPLElBQUk3QixPQUFPLENBQUNTLFFBQVEsQ0FBQ29CLEVBQUUsQ0FBQztFQUNqQyxDQUFDLE1BQU07SUFDTCxPQUFPQSxFQUFFO0VBQ1g7QUFDRixDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL21vbmdvLWlkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRUpTT04gfSBmcm9tICdtZXRlb3IvZWpzb24nO1xuaW1wb3J0IHsgUmFuZG9tIH0gZnJvbSAnbWV0ZW9yL3JhbmRvbSc7XG5cbmNvbnN0IE1vbmdvSUQgPSB7fTtcblxuTW9uZ29JRC5fbG9va3NMaWtlT2JqZWN0SUQgPSBzdHIgPT4gc3RyLmxlbmd0aCA9PT0gMjQgJiYgc3RyLm1hdGNoKC9eWzAtOWEtZl0qJC8pO1xuXG5Nb25nb0lELk9iamVjdElEID0gY2xhc3MgT2JqZWN0SUQge1xuICBjb25zdHJ1Y3RvciAoaGV4U3RyaW5nKSB7XG4gICAgLy9yYW5kb20tYmFzZWQgaW1wbCBvZiBNb25nbyBPYmplY3RJRFxuICAgIGlmIChoZXhTdHJpbmcpIHtcbiAgICAgIGhleFN0cmluZyA9IGhleFN0cmluZy50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCFNb25nb0lELl9sb29rc0xpa2VPYmplY3RJRChoZXhTdHJpbmcpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXhhZGVjaW1hbCBzdHJpbmcgZm9yIGNyZWF0aW5nIGFuIE9iamVjdElEJyk7XG4gICAgICB9XG4gICAgICAvLyBtZWFudCB0byB3b3JrIHdpdGggXy5pc0VxdWFsKCksIHdoaWNoIHJlbGllcyBvbiBzdHJ1Y3R1cmFsIGVxdWFsaXR5XG4gICAgICB0aGlzLl9zdHIgPSBoZXhTdHJpbmc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N0ciA9IFJhbmRvbS5oZXhTdHJpbmcoMjQpO1xuICAgIH1cbiAgfVxuXG4gIGVxdWFscyhvdGhlcikge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQgJiZcbiAgICB0aGlzLnZhbHVlT2YoKSA9PT0gb3RoZXIudmFsdWVPZigpO1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIGBPYmplY3RJRChcIiR7dGhpcy5fc3RyfVwiKWA7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICByZXR1cm4gbmV3IE1vbmdvSUQuT2JqZWN0SUQodGhpcy5fc3RyKTtcbiAgfVxuXG4gIHR5cGVOYW1lKCkge1xuICAgIHJldHVybiAnb2lkJztcbiAgfVxuXG4gIGdldFRpbWVzdGFtcCgpIHtcbiAgICByZXR1cm4gTnVtYmVyLnBhcnNlSW50KHRoaXMuX3N0ci5zdWJzdHIoMCwgOCksIDE2KTtcbiAgfVxuXG4gIHZhbHVlT2YoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cjtcbiAgfVxuXG4gIHRvSlNPTlZhbHVlKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlT2YoKTtcbiAgfVxuXG4gIHRvSGV4U3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlT2YoKTtcbiAgfVxuXG59XG5cbkVKU09OLmFkZFR5cGUoJ29pZCcsIHN0ciA9PiBuZXcgTW9uZ29JRC5PYmplY3RJRChzdHIpKTtcblxuTW9uZ29JRC5pZFN0cmluZ2lmeSA9IChpZCkgPT4ge1xuICBpZiAoaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEKSB7XG4gICAgcmV0dXJuIGlkLnZhbHVlT2YoKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgaWQgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIGZpcnN0Q2hhciA9IGlkLmNoYXJBdCgwKTtcbiAgICBpZiAoaWQgPT09ICcnKSB7XG4gICAgICByZXR1cm4gaWQ7XG4gICAgfSBlbHNlIGlmIChmaXJzdENoYXIgPT09ICctJyB8fCAvLyBlc2NhcGUgcHJldmlvdXNseSBkYXNoZWQgc3RyaW5nc1xuICAgICAgICAgICAgICAgZmlyc3RDaGFyID09PSAnficgfHwgLy8gZXNjYXBlIGVzY2FwZWQgbnVtYmVycywgdHJ1ZSwgZmFsc2VcbiAgICAgICAgICAgICAgIE1vbmdvSUQuX2xvb2tzTGlrZU9iamVjdElEKGlkKSB8fCAvLyBlc2NhcGUgb2JqZWN0LWlkLWZvcm0gc3RyaW5nc1xuICAgICAgICAgICAgICAgZmlyc3RDaGFyID09PSAneycpIHsgLy8gZXNjYXBlIG9iamVjdC1mb3JtIHN0cmluZ3MsIGZvciBtYXliZSBpbXBsZW1lbnRpbmcgbGF0ZXJcbiAgICAgIHJldHVybiBgLSR7aWR9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGlkOyAvLyBvdGhlciBzdHJpbmdzIGdvIHRocm91Z2ggdW5jaGFuZ2VkLlxuICAgIH1cbiAgfSBlbHNlIGlmIChpZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICctJztcbiAgfSBlbHNlIGlmICh0eXBlb2YgaWQgPT09ICdvYmplY3QnICYmIGlkICE9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRlb3IgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgb2JqZWN0cyBvdGhlciB0aGFuIE9iamVjdElEIGFzIGlkcycpO1xuICB9IGVsc2UgeyAvLyBOdW1iZXJzLCB0cnVlLCBmYWxzZSwgbnVsbFxuICAgIHJldHVybiBgfiR7SlNPTi5zdHJpbmdpZnkoaWQpfWA7XG4gIH1cbn07XG5cbk1vbmdvSUQuaWRQYXJzZSA9IChpZCkgPT4ge1xuICB2YXIgZmlyc3RDaGFyID0gaWQuY2hhckF0KDApO1xuICBpZiAoaWQgPT09ICcnKSB7XG4gICAgcmV0dXJuIGlkO1xuICB9IGVsc2UgaWYgKGlkID09PSAnLScpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9IGVsc2UgaWYgKGZpcnN0Q2hhciA9PT0gJy0nKSB7XG4gICAgcmV0dXJuIGlkLnN1YnN0cigxKTtcbiAgfSBlbHNlIGlmIChmaXJzdENoYXIgPT09ICd+Jykge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGlkLnN1YnN0cigxKSk7XG4gIH0gZWxzZSBpZiAoTW9uZ29JRC5fbG9va3NMaWtlT2JqZWN0SUQoaWQpKSB7XG4gICAgcmV0dXJuIG5ldyBNb25nb0lELk9iamVjdElEKGlkKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbn07XG5cbmV4cG9ydCB7IE1vbmdvSUQgfTtcbiJdfQ==
