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
var IdMap;

var require = meteorInstall({"node_modules":{"meteor":{"id-map":{"id-map.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////
//                                                                              //
// packages/id-map/id-map.js                                                    //
//                                                                              //
//////////////////////////////////////////////////////////////////////////////////
                                                                                //
module.export({
  IdMap: () => IdMap
});
class IdMap {
  constructor(idStringify, idParse) {
    this._map = new Map();
    this._idStringify = idStringify || JSON.stringify;
    this._idParse = idParse || JSON.parse;
  }

  // Some of these methods are designed to match methods on OrderedDict, since
  // (eg) ObserveMultiplex and _CachingChangeObserver use them interchangeably.
  // (Conceivably, this should be replaced with "UnorderedDict" with a specific
  // set of methods that overlap between the two.)

  get(id) {
    const key = this._idStringify(id);
    return this._map.get(key);
  }
  set(id, value) {
    const key = this._idStringify(id);
    this._map.set(key, value);
  }
  remove(id) {
    const key = this._idStringify(id);
    this._map.delete(key);
  }
  has(id) {
    const key = this._idStringify(id);
    return this._map.has(key);
  }
  empty() {
    return this._map.size === 0;
  }
  clear() {
    this._map.clear();
  }

  // Iterates over the items in the map. Return `false` to break the loop.
  forEach(iterator) {
    // don't use _.each, because we can't break out of it.
    for (let [key, value] of this._map) {
      const breakIfFalse = iterator.call(null, value, this._idParse(key));
      if (breakIfFalse === false) {
        return;
      }
    }
  }
  size() {
    return this._map.size;
  }
  setDefault(id, def) {
    const key = this._idStringify(id);
    if (this._map.has(key)) {
      return this._map.get(key);
    }
    this._map.set(key, def);
    return def;
  }

  // Assumes that values are EJSON-cloneable, and that we don't need to clone
  // IDs (ie, that nobody is going to mutate an ObjectId).
  clone() {
    const clone = new IdMap(this._idStringify, this._idParse);
    // copy directly to avoid stringify/parse overhead
    this._map.forEach(function (value, key) {
      clone._map.set(key, EJSON.clone(value));
    });
    return clone;
  }
}
//////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/id-map/id-map.js");

/* Exports */
Package._define("id-map", exports, {
  IdMap: IdMap
});

})();

//# sourceURL=meteor://💻app/packages/id-map.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaWQtbWFwL2lkLW1hcC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnQiLCJJZE1hcCIsImNvbnN0cnVjdG9yIiwiaWRTdHJpbmdpZnkiLCJpZFBhcnNlIiwiX21hcCIsIk1hcCIsIl9pZFN0cmluZ2lmeSIsIkpTT04iLCJzdHJpbmdpZnkiLCJfaWRQYXJzZSIsInBhcnNlIiwiZ2V0IiwiaWQiLCJrZXkiLCJzZXQiLCJ2YWx1ZSIsInJlbW92ZSIsImRlbGV0ZSIsImhhcyIsImVtcHR5Iiwic2l6ZSIsImNsZWFyIiwiZm9yRWFjaCIsIml0ZXJhdG9yIiwiYnJlYWtJZkZhbHNlIiwiY2FsbCIsInNldERlZmF1bHQiLCJkZWYiLCJjbG9uZSIsIkVKU09OIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDO0VBQUNDLEtBQUssRUFBQyxNQUFJQTtBQUFLLENBQUMsQ0FBQztBQUN6QixNQUFNQSxLQUFLLENBQUM7RUFDakJDLFdBQVcsQ0FBQ0MsV0FBVyxFQUFFQyxPQUFPLEVBQUU7SUFDaEMsSUFBSSxDQUFDQyxJQUFJLEdBQUcsSUFBSUMsR0FBRyxFQUFFO0lBQ3JCLElBQUksQ0FBQ0MsWUFBWSxHQUFHSixXQUFXLElBQUlLLElBQUksQ0FBQ0MsU0FBUztJQUNqRCxJQUFJLENBQUNDLFFBQVEsR0FBR04sT0FBTyxJQUFJSSxJQUFJLENBQUNHLEtBQUs7RUFDdkM7O0VBRUY7RUFDQTtFQUNBO0VBQ0E7O0VBRUVDLEdBQUcsQ0FBQ0MsRUFBRSxFQUFFO0lBQ04sTUFBTUMsR0FBRyxHQUFHLElBQUksQ0FBQ1AsWUFBWSxDQUFDTSxFQUFFLENBQUM7SUFDakMsT0FBTyxJQUFJLENBQUNSLElBQUksQ0FBQ08sR0FBRyxDQUFDRSxHQUFHLENBQUM7RUFDM0I7RUFFQUMsR0FBRyxDQUFDRixFQUFFLEVBQUVHLEtBQUssRUFBRTtJQUNiLE1BQU1GLEdBQUcsR0FBRyxJQUFJLENBQUNQLFlBQVksQ0FBQ00sRUFBRSxDQUFDO0lBQ2pDLElBQUksQ0FBQ1IsSUFBSSxDQUFDVSxHQUFHLENBQUNELEdBQUcsRUFBRUUsS0FBSyxDQUFDO0VBQzNCO0VBRUFDLE1BQU0sQ0FBQ0osRUFBRSxFQUFFO0lBQ1QsTUFBTUMsR0FBRyxHQUFHLElBQUksQ0FBQ1AsWUFBWSxDQUFDTSxFQUFFLENBQUM7SUFDakMsSUFBSSxDQUFDUixJQUFJLENBQUNhLE1BQU0sQ0FBQ0osR0FBRyxDQUFDO0VBQ3ZCO0VBRUFLLEdBQUcsQ0FBQ04sRUFBRSxFQUFFO0lBQ04sTUFBTUMsR0FBRyxHQUFHLElBQUksQ0FBQ1AsWUFBWSxDQUFDTSxFQUFFLENBQUM7SUFDakMsT0FBTyxJQUFJLENBQUNSLElBQUksQ0FBQ2MsR0FBRyxDQUFDTCxHQUFHLENBQUM7RUFDM0I7RUFFQU0sS0FBSyxHQUFHO0lBQ04sT0FBTyxJQUFJLENBQUNmLElBQUksQ0FBQ2dCLElBQUksS0FBSyxDQUFDO0VBQzdCO0VBRUFDLEtBQUssR0FBRztJQUNOLElBQUksQ0FBQ2pCLElBQUksQ0FBQ2lCLEtBQUssRUFBRTtFQUNuQjs7RUFFQTtFQUNBQyxPQUFPLENBQUNDLFFBQVEsRUFBRTtJQUNoQjtJQUNBLEtBQUssSUFBSSxDQUFDVixHQUFHLEVBQUVFLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQ1gsSUFBSSxFQUFDO01BQ2pDLE1BQU1vQixZQUFZLEdBQUdELFFBQVEsQ0FBQ0UsSUFBSSxDQUNoQyxJQUFJLEVBQ0pWLEtBQUssRUFDTCxJQUFJLENBQUNOLFFBQVEsQ0FBQ0ksR0FBRyxDQUFDLENBQ25CO01BQ0QsSUFBSVcsWUFBWSxLQUFLLEtBQUssRUFBRTtRQUMxQjtNQUNGO0lBQ0Y7RUFDRjtFQUVBSixJQUFJLEdBQUc7SUFDTCxPQUFPLElBQUksQ0FBQ2hCLElBQUksQ0FBQ2dCLElBQUk7RUFDdkI7RUFFQU0sVUFBVSxDQUFDZCxFQUFFLEVBQUVlLEdBQUcsRUFBRTtJQUNsQixNQUFNZCxHQUFHLEdBQUcsSUFBSSxDQUFDUCxZQUFZLENBQUNNLEVBQUUsQ0FBQztJQUNqQyxJQUFJLElBQUksQ0FBQ1IsSUFBSSxDQUFDYyxHQUFHLENBQUNMLEdBQUcsQ0FBQyxFQUFFO01BQ3RCLE9BQU8sSUFBSSxDQUFDVCxJQUFJLENBQUNPLEdBQUcsQ0FBQ0UsR0FBRyxDQUFDO0lBQzNCO0lBQ0EsSUFBSSxDQUFDVCxJQUFJLENBQUNVLEdBQUcsQ0FBQ0QsR0FBRyxFQUFFYyxHQUFHLENBQUM7SUFDdkIsT0FBT0EsR0FBRztFQUNaOztFQUVBO0VBQ0E7RUFDQUMsS0FBSyxHQUFHO0lBQ04sTUFBTUEsS0FBSyxHQUFHLElBQUk1QixLQUFLLENBQUMsSUFBSSxDQUFDTSxZQUFZLEVBQUUsSUFBSSxDQUFDRyxRQUFRLENBQUM7SUFDekQ7SUFDQSxJQUFJLENBQUNMLElBQUksQ0FBQ2tCLE9BQU8sQ0FBQyxVQUFTUCxLQUFLLEVBQUVGLEdBQUcsRUFBQztNQUNwQ2UsS0FBSyxDQUFDeEIsSUFBSSxDQUFDVSxHQUFHLENBQUNELEdBQUcsRUFBRWdCLEtBQUssQ0FBQ0QsS0FBSyxDQUFDYixLQUFLLENBQUMsQ0FBQztJQUN6QyxDQUFDLENBQUM7SUFDRixPQUFPYSxLQUFLO0VBQ2Q7QUFDRixDIiwiZmlsZSI6Ii9wYWNrYWdlcy9pZC1tYXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmV4cG9ydCBjbGFzcyBJZE1hcCB7XG4gIGNvbnN0cnVjdG9yKGlkU3RyaW5naWZ5LCBpZFBhcnNlKSB7XG4gICAgdGhpcy5fbWFwID0gbmV3IE1hcCgpO1xuICAgIHRoaXMuX2lkU3RyaW5naWZ5ID0gaWRTdHJpbmdpZnkgfHwgSlNPTi5zdHJpbmdpZnk7XG4gICAgdGhpcy5faWRQYXJzZSA9IGlkUGFyc2UgfHwgSlNPTi5wYXJzZTtcbiAgfVxuXG4vLyBTb21lIG9mIHRoZXNlIG1ldGhvZHMgYXJlIGRlc2lnbmVkIHRvIG1hdGNoIG1ldGhvZHMgb24gT3JkZXJlZERpY3QsIHNpbmNlXG4vLyAoZWcpIE9ic2VydmVNdWx0aXBsZXggYW5kIF9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIgdXNlIHRoZW0gaW50ZXJjaGFuZ2VhYmx5LlxuLy8gKENvbmNlaXZhYmx5LCB0aGlzIHNob3VsZCBiZSByZXBsYWNlZCB3aXRoIFwiVW5vcmRlcmVkRGljdFwiIHdpdGggYSBzcGVjaWZpY1xuLy8gc2V0IG9mIG1ldGhvZHMgdGhhdCBvdmVybGFwIGJldHdlZW4gdGhlIHR3by4pXG5cbiAgZ2V0KGlkKSB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIHJldHVybiB0aGlzLl9tYXAuZ2V0KGtleSk7XG4gIH1cblxuICBzZXQoaWQsIHZhbHVlKSB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIHRoaXMuX21hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gIH1cblxuICByZW1vdmUoaWQpIHtcbiAgICBjb25zdCBrZXkgPSB0aGlzLl9pZFN0cmluZ2lmeShpZCk7XG4gICAgdGhpcy5fbWFwLmRlbGV0ZShrZXkpO1xuICB9XG5cbiAgaGFzKGlkKSB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIHJldHVybiB0aGlzLl9tYXAuaGFzKGtleSk7XG4gIH1cblxuICBlbXB0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFwLnNpemUgPT09IDA7XG4gIH1cblxuICBjbGVhcigpIHtcbiAgICB0aGlzLl9tYXAuY2xlYXIoKTtcbiAgfVxuXG4gIC8vIEl0ZXJhdGVzIG92ZXIgdGhlIGl0ZW1zIGluIHRoZSBtYXAuIFJldHVybiBgZmFsc2VgIHRvIGJyZWFrIHRoZSBsb29wLlxuICBmb3JFYWNoKGl0ZXJhdG9yKSB7XG4gICAgLy8gZG9uJ3QgdXNlIF8uZWFjaCwgYmVjYXVzZSB3ZSBjYW4ndCBicmVhayBvdXQgb2YgaXQuXG4gICAgZm9yIChsZXQgW2tleSwgdmFsdWVdIG9mIHRoaXMuX21hcCl7XG4gICAgICBjb25zdCBicmVha0lmRmFsc2UgPSBpdGVyYXRvci5jYWxsKFxuICAgICAgICBudWxsLFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgdGhpcy5faWRQYXJzZShrZXkpXG4gICAgICApO1xuICAgICAgaWYgKGJyZWFrSWZGYWxzZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hcC5zaXplO1xuICB9XG5cbiAgc2V0RGVmYXVsdChpZCwgZGVmKSB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIGlmICh0aGlzLl9tYXAuaGFzKGtleSkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYXAuZ2V0KGtleSk7XG4gICAgfVxuICAgIHRoaXMuX21hcC5zZXQoa2V5LCBkZWYpO1xuICAgIHJldHVybiBkZWY7XG4gIH1cblxuICAvLyBBc3N1bWVzIHRoYXQgdmFsdWVzIGFyZSBFSlNPTi1jbG9uZWFibGUsIGFuZCB0aGF0IHdlIGRvbid0IG5lZWQgdG8gY2xvbmVcbiAgLy8gSURzIChpZSwgdGhhdCBub2JvZHkgaXMgZ29pbmcgdG8gbXV0YXRlIGFuIE9iamVjdElkKS5cbiAgY2xvbmUoKSB7XG4gICAgY29uc3QgY2xvbmUgPSBuZXcgSWRNYXAodGhpcy5faWRTdHJpbmdpZnksIHRoaXMuX2lkUGFyc2UpO1xuICAgIC8vIGNvcHkgZGlyZWN0bHkgdG8gYXZvaWQgc3RyaW5naWZ5L3BhcnNlIG92ZXJoZWFkXG4gICAgdGhpcy5fbWFwLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIGtleSl7XG4gICAgICBjbG9uZS5fbWFwLnNldChrZXksIEVKU09OLmNsb25lKHZhbHVlKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG59XG4iXX0=
