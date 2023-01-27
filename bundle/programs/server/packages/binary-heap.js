(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var idx, MaxHeap, MinHeap, MinMaxHeap;

var require = meteorInstall({"node_modules":{"meteor":{"binary-heap":{"binary-heap.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// packages/binary-heap/binary-heap.js                                                    //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
module.link("./max-heap.js", {
  MaxHeap: "MaxHeap"
}, 0);
module.link("./min-heap.js", {
  MinHeap: "MinHeap"
}, 1);
module.link("./min-max-heap.js", {
  MinMaxHeap: "MinMaxHeap"
}, 2);
////////////////////////////////////////////////////////////////////////////////////////////

},"max-heap.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// packages/binary-heap/max-heap.js                                                       //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
module.export({
  MaxHeap: () => MaxHeap
});
class MaxHeap {
  constructor(comparator) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    if (typeof comparator !== 'function') {
      throw new Error('Passed comparator is invalid, should be a comparison function');
    }

    // a C-style comparator that is given two values and returns a number,
    // negative if the first value is less than the second, positive if the second
    // value is greater than the first and zero if they are equal.
    this._comparator = comparator;
    if (!options.IdMap) {
      options.IdMap = IdMap;
    }

    // _heapIdx maps an id to an index in the Heap array the corresponding value
    // is located on.
    this._heapIdx = new options.IdMap();

    // The Heap data-structure implemented as a 0-based contiguous array where
    // every item on index idx is a node in a complete binary tree. Every node can
    // have children on indexes idx*2+1 and idx*2+2, except for the leaves. Every
    // node has a parent on index (idx-1)/2;
    this._heap = [];

    // If the initial array is passed, we can build the heap in linear time
    // complexity (O(N)) compared to linearithmic time complexity (O(nlogn)) if
    // we push elements one by one.
    if (Array.isArray(options.initData)) {
      this._initFromData(options.initData);
    }
  }

  // Builds a new heap in-place in linear time based on passed data
  _initFromData(data) {
    this._heap = data.map(_ref => {
      let {
        id,
        value
      } = _ref;
      return {
        id,
        value
      };
    });
    data.forEach((_ref2, i) => {
      let {
        id
      } = _ref2;
      return this._heapIdx.set(id, i);
    });
    if (!data.length) {
      return;
    }

    // start from the first non-leaf - the parent of the last leaf
    for (let i = parentIdx(data.length - 1); i >= 0; i--) {
      this._downHeap(i);
    }
  }
  _downHeap(idx) {
    while (leftChildIdx(idx) < this.size()) {
      const left = leftChildIdx(idx);
      const right = rightChildIdx(idx);
      let largest = idx;
      if (left < this.size()) {
        largest = this._maxIndex(largest, left);
      }
      if (right < this.size()) {
        largest = this._maxIndex(largest, right);
      }
      if (largest === idx) {
        break;
      }
      this._swap(largest, idx);
      idx = largest;
    }
  }
  _upHeap(idx) {
    while (idx > 0) {
      const parent = parentIdx(idx);
      if (this._maxIndex(parent, idx) === idx) {
        this._swap(parent, idx);
        idx = parent;
      } else {
        break;
      }
    }
  }
  _maxIndex(idxA, idxB) {
    const valueA = this._get(idxA);
    const valueB = this._get(idxB);
    return this._comparator(valueA, valueB) >= 0 ? idxA : idxB;
  }

  // Internal: gets raw data object placed on idxth place in heap
  _get(idx) {
    return this._heap[idx].value;
  }
  _swap(idxA, idxB) {
    const recA = this._heap[idxA];
    const recB = this._heap[idxB];
    this._heapIdx.set(recA.id, idxB);
    this._heapIdx.set(recB.id, idxA);
    this._heap[idxA] = recB;
    this._heap[idxB] = recA;
  }
  get(id) {
    return this.has(id) ? this._get(this._heapIdx.get(id)) : null;
  }
  set(id, value) {
    if (this.has(id)) {
      if (this.get(id) === value) {
        return;
      }
      const idx = this._heapIdx.get(id);
      this._heap[idx].value = value;

      // Fix the new value's position
      // Either bubble new value up if it is greater than its parent
      this._upHeap(idx);
      // or bubble it down if it is smaller than one of its children
      this._downHeap(idx);
    } else {
      this._heapIdx.set(id, this._heap.length);
      this._heap.push({
        id,
        value
      });
      this._upHeap(this._heap.length - 1);
    }
  }
  remove(id) {
    if (this.has(id)) {
      const last = this._heap.length - 1;
      const idx = this._heapIdx.get(id);
      if (idx !== last) {
        this._swap(idx, last);
        this._heap.pop();
        this._heapIdx.remove(id);

        // Fix the swapped value's position
        this._upHeap(idx);
        this._downHeap(idx);
      } else {
        this._heap.pop();
        this._heapIdx.remove(id);
      }
    }
  }
  has(id) {
    return this._heapIdx.has(id);
  }
  empty() {
    return !this.size();
  }
  clear() {
    this._heap = [];
    this._heapIdx.clear();
  }

  // iterate over values in no particular order
  forEach(iterator) {
    this._heap.forEach(obj => iterator(obj.value, obj.id));
  }
  size() {
    return this._heap.length;
  }
  setDefault(id, def) {
    if (this.has(id)) {
      return this.get(id);
    }
    this.set(id, def);
    return def;
  }
  clone() {
    const clone = new MaxHeap(this._comparator, this._heap);
    return clone;
  }
  maxElementId() {
    return this.size() ? this._heap[0].id : null;
  }
  _selfCheck() {
    for (let i = 1; i < this._heap.length; i++) {
      if (this._maxIndex(parentIdx(i), i) !== parentIdx(i)) {
        throw new Error("An item with id ".concat(this._heap[i].id) + " has a parent younger than it: " + this._heap[parentIdx(i)].id);
      }
    }
  }
}
const leftChildIdx = i => i * 2 + 1;
const rightChildIdx = i => i * 2 + 2;
const parentIdx = i => i - 1 >> 1;
////////////////////////////////////////////////////////////////////////////////////////////

},"min-heap.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// packages/binary-heap/min-heap.js                                                       //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
module.export({
  MinHeap: () => MinHeap
});
let MaxHeap;
module.link("./max-heap.js", {
  MaxHeap(v) {
    MaxHeap = v;
  }
}, 0);
class MinHeap extends MaxHeap {
  constructor(comparator, options) {
    super((a, b) => -comparator(a, b), options);
  }
  maxElementId() {
    throw new Error("Cannot call maxElementId on MinHeap");
  }
  minElementId() {
    return super.maxElementId();
  }
}
;
////////////////////////////////////////////////////////////////////////////////////////////

},"min-max-heap.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                        //
// packages/binary-heap/min-max-heap.js                                                   //
//                                                                                        //
////////////////////////////////////////////////////////////////////////////////////////////
                                                                                          //
module.export({
  MinMaxHeap: () => MinMaxHeap
});
let MaxHeap;
module.link("./max-heap.js", {
  MaxHeap(v) {
    MaxHeap = v;
  }
}, 0);
let MinHeap;
module.link("./min-heap.js", {
  MinHeap(v) {
    MinHeap = v;
  }
}, 1);
class MinMaxHeap extends MaxHeap {
  constructor(comparator, options) {
    super(comparator, options);
    this._minHeap = new MinHeap(comparator, options);
  }
  set() {
    super.set(...arguments);
    this._minHeap.set(...arguments);
  }
  remove() {
    super.remove(...arguments);
    this._minHeap.remove(...arguments);
  }
  clear() {
    super.clear(...arguments);
    this._minHeap.clear(...arguments);
  }
  setDefault() {
    super.setDefault(...arguments);
    return this._minHeap.setDefault(...arguments);
  }
  clone() {
    const clone = new MinMaxHeap(this._comparator, this._heap);
    return clone;
  }
  minElementId() {
    return this._minHeap.minElementId();
  }
}
;
////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/binary-heap/binary-heap.js");

/* Exports */
Package._define("binary-heap", exports, {
  MaxHeap: MaxHeap,
  MinHeap: MinHeap,
  MinMaxHeap: MinMaxHeap
});

})();

//# sourceURL=meteor://💻app/packages/binary-heap.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYmluYXJ5LWhlYXAvYmluYXJ5LWhlYXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JpbmFyeS1oZWFwL21heC1oZWFwLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9iaW5hcnktaGVhcC9taW4taGVhcC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYmluYXJ5LWhlYXAvbWluLW1heC1oZWFwLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImxpbmsiLCJNYXhIZWFwIiwiTWluSGVhcCIsIk1pbk1heEhlYXAiLCJleHBvcnQiLCJjb25zdHJ1Y3RvciIsImNvbXBhcmF0b3IiLCJvcHRpb25zIiwiRXJyb3IiLCJfY29tcGFyYXRvciIsIklkTWFwIiwiX2hlYXBJZHgiLCJfaGVhcCIsIkFycmF5IiwiaXNBcnJheSIsImluaXREYXRhIiwiX2luaXRGcm9tRGF0YSIsImRhdGEiLCJtYXAiLCJpZCIsInZhbHVlIiwiZm9yRWFjaCIsImkiLCJzZXQiLCJsZW5ndGgiLCJwYXJlbnRJZHgiLCJfZG93bkhlYXAiLCJpZHgiLCJsZWZ0Q2hpbGRJZHgiLCJzaXplIiwibGVmdCIsInJpZ2h0IiwicmlnaHRDaGlsZElkeCIsImxhcmdlc3QiLCJfbWF4SW5kZXgiLCJfc3dhcCIsIl91cEhlYXAiLCJwYXJlbnQiLCJpZHhBIiwiaWR4QiIsInZhbHVlQSIsIl9nZXQiLCJ2YWx1ZUIiLCJyZWNBIiwicmVjQiIsImdldCIsImhhcyIsInB1c2giLCJyZW1vdmUiLCJsYXN0IiwicG9wIiwiZW1wdHkiLCJjbGVhciIsIml0ZXJhdG9yIiwib2JqIiwic2V0RGVmYXVsdCIsImRlZiIsImNsb25lIiwibWF4RWxlbWVudElkIiwiX3NlbGZDaGVjayIsInYiLCJhIiwiYiIsIm1pbkVsZW1lbnRJZCIsIl9taW5IZWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE1BQU0sQ0FBQ0MsSUFB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QVUsQ0FBQyxZQUFPLENBQUM7SUFDekIsT0FBTyxJQUFJLENBQUNTLFFBQVEsQ0FBQ1QsVUFBVSxDQUFDLFlBQU8sQ0FBQztFQUMxQztFQUVBRSxLQUFLLEdBQUc7SUFDTixNQUFNQSxLQUFLLEdBQUcsSUFBSXRELFVBQVUsQ0FBQyxJQUFJLENBQUNNLFdBQVcsRUFBRSxJQUFJLENBQUNHLEtBQUssQ0FBQztJQUMxRCxPQUFPNkMsS0FBSztFQUNkO0VBRUFNLFlBQVksR0FBRztJQUNiLE9BQU8sSUFBSSxDQUFDQyxRQUFRLENBQUNELFlBQVksRUFBRTtFQUNyQztBQUVGO0FBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvYmluYXJ5LWhlYXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgeyBNYXhIZWFwIH0gZnJvbSAnLi9tYXgtaGVhcC5qcyc7XG5leHBvcnQgeyBNaW5IZWFwIH0gZnJvbSAnLi9taW4taGVhcC5qcyc7XG5leHBvcnQgeyBNaW5NYXhIZWFwIH0gZnJvbSAnLi9taW4tbWF4LWhlYXAuanMnO1xuIiwiLy8gQ29uc3RydWN0b3Igb2YgSGVhcFxuLy8gLSBjb21wYXJhdG9yIC0gRnVuY3Rpb24gLSBnaXZlbiB0d28gaXRlbXMgcmV0dXJucyBhIG51bWJlclxuLy8gLSBvcHRpb25zOlxuLy8gICAtIGluaXREYXRhIC0gQXJyYXkgLSBPcHRpb25hbCAtIHRoZSBpbml0aWFsIGRhdGEgaW4gYSBmb3JtYXQ6XG4vLyAgICAgICAgT2JqZWN0OlxuLy8gICAgICAgICAgLSBpZCAtIFN0cmluZyAtIHVuaXF1ZSBpZCBvZiB0aGUgaXRlbVxuLy8gICAgICAgICAgLSB2YWx1ZSAtIEFueSAtIHRoZSBkYXRhIHZhbHVlXG4vLyAgICAgIGVhY2ggdmFsdWUgaXMgcmV0YWluZWRcbi8vICAgLSBJZE1hcCAtIENvbnN0cnVjdG9yIC0gT3B0aW9uYWwgLSBjdXN0b20gSWRNYXAgY2xhc3MgdG8gc3RvcmUgaWQtPmluZGV4XG4vLyAgICAgICBtYXBwaW5ncyBpbnRlcm5hbGx5LiBTdGFuZGFyZCBJZE1hcCBpcyB1c2VkIGJ5IGRlZmF1bHQuXG5leHBvcnQgY2xhc3MgTWF4SGVhcCB7IFxuICBjb25zdHJ1Y3Rvcihjb21wYXJhdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBpZiAodHlwZW9mIGNvbXBhcmF0b3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGFzc2VkIGNvbXBhcmF0b3IgaXMgaW52YWxpZCwgc2hvdWxkIGJlIGEgY29tcGFyaXNvbiBmdW5jdGlvbicpO1xuICAgIH1cblxuICAgIC8vIGEgQy1zdHlsZSBjb21wYXJhdG9yIHRoYXQgaXMgZ2l2ZW4gdHdvIHZhbHVlcyBhbmQgcmV0dXJucyBhIG51bWJlcixcbiAgICAvLyBuZWdhdGl2ZSBpZiB0aGUgZmlyc3QgdmFsdWUgaXMgbGVzcyB0aGFuIHRoZSBzZWNvbmQsIHBvc2l0aXZlIGlmIHRoZSBzZWNvbmRcbiAgICAvLyB2YWx1ZSBpcyBncmVhdGVyIHRoYW4gdGhlIGZpcnN0IGFuZCB6ZXJvIGlmIHRoZXkgYXJlIGVxdWFsLlxuICAgIHRoaXMuX2NvbXBhcmF0b3IgPSBjb21wYXJhdG9yO1xuXG4gICAgaWYgKCEgb3B0aW9ucy5JZE1hcCkge1xuICAgICAgb3B0aW9ucy5JZE1hcCA9IElkTWFwO1xuICAgIH1cblxuICAgIC8vIF9oZWFwSWR4IG1hcHMgYW4gaWQgdG8gYW4gaW5kZXggaW4gdGhlIEhlYXAgYXJyYXkgdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVcbiAgICAvLyBpcyBsb2NhdGVkIG9uLlxuICAgIHRoaXMuX2hlYXBJZHggPSBuZXcgb3B0aW9ucy5JZE1hcDtcblxuICAgIC8vIFRoZSBIZWFwIGRhdGEtc3RydWN0dXJlIGltcGxlbWVudGVkIGFzIGEgMC1iYXNlZCBjb250aWd1b3VzIGFycmF5IHdoZXJlXG4gICAgLy8gZXZlcnkgaXRlbSBvbiBpbmRleCBpZHggaXMgYSBub2RlIGluIGEgY29tcGxldGUgYmluYXJ5IHRyZWUuIEV2ZXJ5IG5vZGUgY2FuXG4gICAgLy8gaGF2ZSBjaGlsZHJlbiBvbiBpbmRleGVzIGlkeCoyKzEgYW5kIGlkeCoyKzIsIGV4Y2VwdCBmb3IgdGhlIGxlYXZlcy4gRXZlcnlcbiAgICAvLyBub2RlIGhhcyBhIHBhcmVudCBvbiBpbmRleCAoaWR4LTEpLzI7XG4gICAgdGhpcy5faGVhcCA9IFtdO1xuXG4gICAgLy8gSWYgdGhlIGluaXRpYWwgYXJyYXkgaXMgcGFzc2VkLCB3ZSBjYW4gYnVpbGQgdGhlIGhlYXAgaW4gbGluZWFyIHRpbWVcbiAgICAvLyBjb21wbGV4aXR5IChPKE4pKSBjb21wYXJlZCB0byBsaW5lYXJpdGhtaWMgdGltZSBjb21wbGV4aXR5IChPKG5sb2duKSkgaWZcbiAgICAvLyB3ZSBwdXNoIGVsZW1lbnRzIG9uZSBieSBvbmUuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkob3B0aW9ucy5pbml0RGF0YSkpIHtcbiAgICAgIHRoaXMuX2luaXRGcm9tRGF0YShvcHRpb25zLmluaXREYXRhKTtcbiAgICB9XG4gIH1cblxuICAvLyBCdWlsZHMgYSBuZXcgaGVhcCBpbi1wbGFjZSBpbiBsaW5lYXIgdGltZSBiYXNlZCBvbiBwYXNzZWQgZGF0YVxuICBfaW5pdEZyb21EYXRhKGRhdGEpIHtcbiAgICB0aGlzLl9oZWFwID0gZGF0YS5tYXAoKHsgaWQsIHZhbHVlIH0pID0+ICh7IGlkLCB2YWx1ZSB9KSk7XG5cbiAgICBkYXRhLmZvckVhY2goKHsgaWQgfSwgaSkgPT4gdGhpcy5faGVhcElkeC5zZXQoaWQsIGkpKTtcblxuICAgIGlmICghIGRhdGEubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc3RhcnQgZnJvbSB0aGUgZmlyc3Qgbm9uLWxlYWYgLSB0aGUgcGFyZW50IG9mIHRoZSBsYXN0IGxlYWZcbiAgICBmb3IgKGxldCBpID0gcGFyZW50SWR4KGRhdGEubGVuZ3RoIC0gMSk7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0aGlzLl9kb3duSGVhcChpKTtcbiAgICB9XG4gIH1cblxuICBfZG93bkhlYXAoaWR4KSB7XG4gICAgd2hpbGUgKGxlZnRDaGlsZElkeChpZHgpIDwgdGhpcy5zaXplKCkpIHtcbiAgICAgIGNvbnN0IGxlZnQgPSBsZWZ0Q2hpbGRJZHgoaWR4KTtcbiAgICAgIGNvbnN0IHJpZ2h0ID0gcmlnaHRDaGlsZElkeChpZHgpO1xuICAgICAgbGV0IGxhcmdlc3QgPSBpZHg7XG5cbiAgICAgIGlmIChsZWZ0IDwgdGhpcy5zaXplKCkpIHtcbiAgICAgICAgbGFyZ2VzdCA9IHRoaXMuX21heEluZGV4KGxhcmdlc3QsIGxlZnQpO1xuICAgICAgfVxuXG4gICAgICBpZiAocmlnaHQgPCB0aGlzLnNpemUoKSkge1xuICAgICAgICBsYXJnZXN0ID0gdGhpcy5fbWF4SW5kZXgobGFyZ2VzdCwgcmlnaHQpO1xuICAgICAgfVxuXG4gICAgICBpZiAobGFyZ2VzdCA9PT0gaWR4KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9zd2FwKGxhcmdlc3QsIGlkeCk7XG4gICAgICBpZHggPSBsYXJnZXN0O1xuICAgIH1cbiAgfVxuXG4gIF91cEhlYXAoaWR4KSB7XG4gICAgd2hpbGUgKGlkeCA+IDApIHtcbiAgICAgIGNvbnN0IHBhcmVudCA9IHBhcmVudElkeChpZHgpO1xuICAgICAgaWYgKHRoaXMuX21heEluZGV4KHBhcmVudCwgaWR4KSA9PT0gaWR4KSB7XG4gICAgICAgIHRoaXMuX3N3YXAocGFyZW50LCBpZHgpXG4gICAgICAgIGlkeCA9IHBhcmVudDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9tYXhJbmRleChpZHhBLCBpZHhCKSB7XG4gICAgY29uc3QgdmFsdWVBID0gdGhpcy5fZ2V0KGlkeEEpO1xuICAgIGNvbnN0IHZhbHVlQiA9IHRoaXMuX2dldChpZHhCKTtcbiAgICByZXR1cm4gdGhpcy5fY29tcGFyYXRvcih2YWx1ZUEsIHZhbHVlQikgPj0gMCA/IGlkeEEgOiBpZHhCO1xuICB9XG5cbiAgLy8gSW50ZXJuYWw6IGdldHMgcmF3IGRhdGEgb2JqZWN0IHBsYWNlZCBvbiBpZHh0aCBwbGFjZSBpbiBoZWFwXG4gIF9nZXQoaWR4KSB7XG4gICAgcmV0dXJuIHRoaXMuX2hlYXBbaWR4XS52YWx1ZTtcbiAgfVxuXG4gIF9zd2FwKGlkeEEsIGlkeEIpIHtcbiAgICBjb25zdCByZWNBID0gdGhpcy5faGVhcFtpZHhBXTtcbiAgICBjb25zdCByZWNCID0gdGhpcy5faGVhcFtpZHhCXTtcblxuICAgIHRoaXMuX2hlYXBJZHguc2V0KHJlY0EuaWQsIGlkeEIpO1xuICAgIHRoaXMuX2hlYXBJZHguc2V0KHJlY0IuaWQsIGlkeEEpO1xuXG4gICAgdGhpcy5faGVhcFtpZHhBXSA9IHJlY0I7XG4gICAgdGhpcy5faGVhcFtpZHhCXSA9IHJlY0E7XG4gIH1cblxuICBnZXQoaWQpIHtcbiAgICByZXR1cm4gdGhpcy5oYXMoaWQpID9cbiAgICAgIHRoaXMuX2dldCh0aGlzLl9oZWFwSWR4LmdldChpZCkpIDpcbiAgICAgIG51bGw7XG4gIH1cblxuICBzZXQoaWQsIHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuaGFzKGlkKSkge1xuICAgICAgaWYgKHRoaXMuZ2V0KGlkKSA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpZHggPSB0aGlzLl9oZWFwSWR4LmdldChpZCk7XG4gICAgICB0aGlzLl9oZWFwW2lkeF0udmFsdWUgPSB2YWx1ZTtcblxuICAgICAgLy8gRml4IHRoZSBuZXcgdmFsdWUncyBwb3NpdGlvblxuICAgICAgLy8gRWl0aGVyIGJ1YmJsZSBuZXcgdmFsdWUgdXAgaWYgaXQgaXMgZ3JlYXRlciB0aGFuIGl0cyBwYXJlbnRcbiAgICAgIHRoaXMuX3VwSGVhcChpZHgpO1xuICAgICAgLy8gb3IgYnViYmxlIGl0IGRvd24gaWYgaXQgaXMgc21hbGxlciB0aGFuIG9uZSBvZiBpdHMgY2hpbGRyZW5cbiAgICAgIHRoaXMuX2Rvd25IZWFwKGlkeCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2hlYXBJZHguc2V0KGlkLCB0aGlzLl9oZWFwLmxlbmd0aCk7XG4gICAgICB0aGlzLl9oZWFwLnB1c2goeyBpZCwgdmFsdWUgfSk7XG4gICAgICB0aGlzLl91cEhlYXAodGhpcy5faGVhcC5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cblxuICByZW1vdmUoaWQpIHtcbiAgICBpZiAodGhpcy5oYXMoaWQpKSB7XG4gICAgICBjb25zdCBsYXN0ID0gdGhpcy5faGVhcC5sZW5ndGggLSAxO1xuICAgICAgY29uc3QgaWR4ID0gdGhpcy5faGVhcElkeC5nZXQoaWQpO1xuXG4gICAgICBpZiAoaWR4ICE9PSBsYXN0KSB7XG4gICAgICAgIHRoaXMuX3N3YXAoaWR4LCBsYXN0KTtcbiAgICAgICAgdGhpcy5faGVhcC5wb3AoKTtcbiAgICAgICAgdGhpcy5faGVhcElkeC5yZW1vdmUoaWQpO1xuXG4gICAgICAgIC8vIEZpeCB0aGUgc3dhcHBlZCB2YWx1ZSdzIHBvc2l0aW9uXG4gICAgICAgIHRoaXMuX3VwSGVhcChpZHgpO1xuICAgICAgICB0aGlzLl9kb3duSGVhcChpZHgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5faGVhcC5wb3AoKTtcbiAgICAgICAgdGhpcy5faGVhcElkeC5yZW1vdmUoaWQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGhhcyhpZCkge1xuICAgIHJldHVybiB0aGlzLl9oZWFwSWR4LmhhcyhpZCk7XG4gIH1cblxuICBlbXB0eSgpIHtcbiAgICByZXR1cm4gIXRoaXMuc2l6ZSgpO1xuICB9XG5cbiAgY2xlYXIoKSB7XG4gICAgdGhpcy5faGVhcCA9IFtdO1xuICAgIHRoaXMuX2hlYXBJZHguY2xlYXIoKTtcbiAgfVxuXG4gIC8vIGl0ZXJhdGUgb3ZlciB2YWx1ZXMgaW4gbm8gcGFydGljdWxhciBvcmRlclxuICBmb3JFYWNoKGl0ZXJhdG9yKSB7XG4gICAgdGhpcy5faGVhcC5mb3JFYWNoKG9iaiA9PiBpdGVyYXRvcihvYmoudmFsdWUsIG9iai5pZCkpO1xuICB9XG5cbiAgc2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGVhcC5sZW5ndGg7XG4gIH1cblxuICBzZXREZWZhdWx0KGlkLCBkZWYpIHtcbiAgICBpZiAodGhpcy5oYXMoaWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZXQoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuc2V0KGlkLCBkZWYpO1xuICAgIHJldHVybiBkZWY7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5ldyBNYXhIZWFwKHRoaXMuX2NvbXBhcmF0b3IsIHRoaXMuX2hlYXApO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIG1heEVsZW1lbnRJZCgpIHtcbiAgICByZXR1cm4gdGhpcy5zaXplKCkgPyB0aGlzLl9oZWFwWzBdLmlkIDogbnVsbDtcbiAgfVxuXG4gIF9zZWxmQ2hlY2soKSB7XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCB0aGlzLl9oZWFwLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy5fbWF4SW5kZXgocGFyZW50SWR4KGkpLCBpKSAhPT0gcGFyZW50SWR4KGkpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBbiBpdGVtIHdpdGggaWQgJHt0aGlzLl9oZWFwW2ldLmlkfWAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBoYXMgYSBwYXJlbnQgeW91bmdlciB0aGFuIGl0OiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2hlYXBbcGFyZW50SWR4KGkpXS5pZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IGxlZnRDaGlsZElkeCA9IGkgPT4gaSAqIDIgKyAxO1xuY29uc3QgcmlnaHRDaGlsZElkeCA9IGkgPT4gaSAqIDIgKyAyO1xuY29uc3QgcGFyZW50SWR4ID0gaSA9PiAoaSAtIDEpID4+IDE7XG4iLCJpbXBvcnQgeyBNYXhIZWFwIH0gZnJvbSAnLi9tYXgtaGVhcC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBNaW5IZWFwIGV4dGVuZHMgTWF4SGVhcCB7XG4gIGNvbnN0cnVjdG9yKGNvbXBhcmF0b3IsIG9wdGlvbnMpIHtcbiAgICBzdXBlcigoYSwgYikgPT4gLWNvbXBhcmF0b3IoYSwgYiksIG9wdGlvbnMpO1xuICB9XG5cbiAgbWF4RWxlbWVudElkKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBjYWxsIG1heEVsZW1lbnRJZCBvbiBNaW5IZWFwXCIpO1xuICB9XG5cbiAgbWluRWxlbWVudElkKCkge1xuICAgIHJldHVybiBzdXBlci5tYXhFbGVtZW50SWQoKTtcbiAgfVxufTtcbiIsImltcG9ydCB7IE1heEhlYXAgfSBmcm9tICcuL21heC1oZWFwLmpzJztcbmltcG9ydCB7IE1pbkhlYXAgfSBmcm9tICcuL21pbi1oZWFwLmpzJztcblxuLy8gVGhpcyBpbXBsZW1lbnRhdGlvbiBvZiBNaW4vTWF4LUhlYXAgaXMganVzdCBhIHN1YmNsYXNzIG9mIE1heC1IZWFwXG4vLyB3aXRoIGEgTWluLUhlYXAgYXMgYW4gZW5jYXBzdWxhdGVkIHByb3BlcnR5LlxuLy9cbi8vIE1vc3Qgb2YgdGhlIG9wZXJhdGlvbnMgYXJlIGp1c3QgcHJveHkgbWV0aG9kcyB0byBjYWxsIHRoZSBzYW1lIG1ldGhvZCBvbiBib3RoXG4vLyBoZWFwcy5cbi8vXG4vLyBUaGlzIGltcGxlbWVudGF0aW9uIHRha2VzIDIqTiBtZW1vcnkgYnV0IGlzIGZhaXJseSBzaW1wbGUgdG8gd3JpdGUgYW5kXG4vLyB1bmRlcnN0YW5kLiBBbmQgdGhlIGNvbnN0YW50IGZhY3RvciBvZiBhIHNpbXBsZSBIZWFwIGlzIHVzdWFsbHkgc21hbGxlclxuLy8gY29tcGFyZWQgdG8gb3RoZXIgdHdvLXdheSBwcmlvcml0eSBxdWV1ZXMgbGlrZSBNaW4vTWF4IEhlYXBzXG4vLyAoaHR0cDovL3d3dy5jcy5vdGFnby5hYy5uei9zdGFmZnByaXYvbWlrZS9QYXBlcnMvTWluTWF4SGVhcHMvTWluTWF4SGVhcHMucGRmKVxuLy8gYW5kIEludGVydmFsIEhlYXBzXG4vLyAoaHR0cDovL3d3dy5jaXNlLnVmbC5lZHUvfnNhaG5pL2RzYWFjL2VucmljaC9jMTMvZG91YmxlLmh0bSlcbmV4cG9ydCBjbGFzcyBNaW5NYXhIZWFwIGV4dGVuZHMgTWF4SGVhcCB7XG4gIGNvbnN0cnVjdG9yKGNvbXBhcmF0b3IsIG9wdGlvbnMpIHtcbiAgICBzdXBlcihjb21wYXJhdG9yLCBvcHRpb25zKTtcbiAgICB0aGlzLl9taW5IZWFwID0gbmV3IE1pbkhlYXAoY29tcGFyYXRvciwgb3B0aW9ucyk7XG4gIH1cblxuICBzZXQoLi4uYXJncykge1xuICAgIHN1cGVyLnNldCguLi5hcmdzKTtcbiAgICB0aGlzLl9taW5IZWFwLnNldCguLi5hcmdzKTtcbiAgfVxuXG4gIHJlbW92ZSguLi5hcmdzKSB7XG4gICAgc3VwZXIucmVtb3ZlKC4uLmFyZ3MpO1xuICAgIHRoaXMuX21pbkhlYXAucmVtb3ZlKC4uLmFyZ3MpO1xuICB9XG5cbiAgY2xlYXIoLi4uYXJncykge1xuICAgIHN1cGVyLmNsZWFyKC4uLmFyZ3MpO1xuICAgIHRoaXMuX21pbkhlYXAuY2xlYXIoLi4uYXJncyk7XG4gIH1cblxuICBzZXREZWZhdWx0KC4uLmFyZ3MpIHtcbiAgICBzdXBlci5zZXREZWZhdWx0KC4uLmFyZ3MpO1xuICAgIHJldHVybiB0aGlzLl9taW5IZWFwLnNldERlZmF1bHQoLi4uYXJncyk7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5ldyBNaW5NYXhIZWFwKHRoaXMuX2NvbXBhcmF0b3IsIHRoaXMuX2hlYXApO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIG1pbkVsZW1lbnRJZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWluSGVhcC5taW5FbGVtZW50SWQoKTtcbiAgfVxuXG59O1xuIl19
