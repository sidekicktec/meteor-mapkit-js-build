(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Decimal;

var require = meteorInstall({"node_modules":{"meteor":{"mongo-decimal":{"decimal.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/mongo-decimal/decimal.js                                 //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
module.export({
  Decimal: () => Decimal
});
let EJSON;
module.link("meteor/ejson", {
  EJSON(v) {
    EJSON = v;
  }
}, 0);
let Decimal;
module.link("decimal.js", {
  Decimal(v) {
    Decimal = v;
  }
}, 1);
Decimal.prototype.typeName = function () {
  return 'Decimal';
};
Decimal.prototype.toJSONValue = function () {
  return this.toJSON();
};
Decimal.prototype.clone = function () {
  return Decimal(this.toString());
};
EJSON.addType('Decimal', function (str) {
  return Decimal(str);
});
///////////////////////////////////////////////////////////////////////

},"node_modules":{"decimal.js":{"package.json":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// node_modules/meteor/mongo-decimal/node_modules/decimal.js/package //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
module.exports = {
  "name": "decimal.js",
  "version": "10.3.1",
  "main": "decimal"
};

///////////////////////////////////////////////////////////////////////

},"decimal.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// node_modules/meteor/mongo-decimal/node_modules/decimal.js/decimal //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
module.useNode();
///////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/mongo-decimal/decimal.js");

/* Exports */
Package._define("mongo-decimal", exports, {
  Decimal: Decimal
});

})();

//# sourceURL=meteor://💻app/packages/mongo-decimal.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28tZGVjaW1hbC9kZWNpbWFsLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkRlY2ltYWwiLCJFSlNPTiIsImxpbmsiLCJ2IiwicHJvdG90eXBlIiwidHlwZU5hbWUiLCJ0b0pTT05WYWx1ZSIsInRvSlNPTiIsImNsb25lIiwidG9TdHJpbmciLCJhZGRUeXBlIiwic3RyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDO0VBQUNDLE9BQU8sRUFBQyxNQUFJQTtBQUFPLENBQUMsQ0FBQztBQUFDLElBQUlDLEtBQUs7QUFBQ0gsTUFBTSxDQUFDSSxJQUFJLENBQUMsY0FBYyxFQUFDO0VBQUNELEtBQUssQ0FBQ0UsQ0FBQyxFQUFDO0lBQUNGLEtBQUssR0FBQ0UsQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQUFDLElBQUlILE9BQU87QUFBQ0YsTUFBTSxDQUFDSSxJQUFJLENBQUMsWUFBWSxFQUFDO0VBQUNGLE9BQU8sQ0FBQ0csQ0FBQyxFQUFDO0lBQUNILE9BQU8sR0FBQ0csQ0FBQztFQUFBO0FBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztBQUdoS0gsT0FBTyxDQUFDSSxTQUFTLENBQUNDLFFBQVEsR0FBRyxZQUFXO0VBQ3RDLE9BQU8sU0FBUztBQUNsQixDQUFDO0FBRURMLE9BQU8sQ0FBQ0ksU0FBUyxDQUFDRSxXQUFXLEdBQUcsWUFBWTtFQUMxQyxPQUFPLElBQUksQ0FBQ0MsTUFBTSxFQUFFO0FBQ3RCLENBQUM7QUFFRFAsT0FBTyxDQUFDSSxTQUFTLENBQUNJLEtBQUssR0FBRyxZQUFZO0VBQ3BDLE9BQU9SLE9BQU8sQ0FBQyxJQUFJLENBQUNTLFFBQVEsRUFBRSxDQUFDO0FBQ2pDLENBQUM7QUFFRFIsS0FBSyxDQUFDUyxPQUFPLENBQUMsU0FBUyxFQUFFLFVBQVVDLEdBQUcsRUFBRTtFQUN0QyxPQUFPWCxPQUFPLENBQUNXLEdBQUcsQ0FBQztBQUNyQixDQUFDLENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvbW9uZ28tZGVjaW1hbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IERlY2ltYWwgfSBmcm9tICdkZWNpbWFsLmpzJztcblxuRGVjaW1hbC5wcm90b3R5cGUudHlwZU5hbWUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuICdEZWNpbWFsJztcbn07XG5cbkRlY2ltYWwucHJvdG90eXBlLnRvSlNPTlZhbHVlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy50b0pTT04oKTtcbn07XG5cbkRlY2ltYWwucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gRGVjaW1hbCh0aGlzLnRvU3RyaW5nKCkpO1xufTtcblxuRUpTT04uYWRkVHlwZSgnRGVjaW1hbCcsIGZ1bmN0aW9uIChzdHIpIHtcbiAgcmV0dXJuIERlY2ltYWwoc3RyKTtcbn0pO1xuXG5leHBvcnQgeyBEZWNpbWFsIH07XG4iXX0=
