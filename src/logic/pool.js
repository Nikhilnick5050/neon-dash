// Tiny object pool: reuse objects instead of creating new ones every frame.
export class Pool {
  constructor(factory, reset = null, prefill = 0) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.created = 0;
    for (let i = 0; i < prefill; i++) this.free.push(this._make());
  }

  _make() {
    this.created++;
    return this.factory();
  }

  acquire() {
    return this.free.length ? this.free.pop() : this._make();
  }

  release(obj) {
    if (this.reset) this.reset(obj);
    this.free.push(obj);
  }
}

/** Remove item i from an array in O(1) by swapping in the last item (order not kept). */
export function swapRemove(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.length = last;
}
