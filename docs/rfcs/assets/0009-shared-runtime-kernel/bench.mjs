// Micro-bench: class w/ private fields + methods vs plain kernel record + free functions.
// Mirrors the flush pipeline shape without DOM.

class C {
  #dirty = new Set()
  #full = true
  #cache = new Map()
  #state = { n: 0 }
  #updates = 0

  markDirty(s) {
    this.#dirty.add(s)
    this.#cache.clear()
  }
  #consume() {
    if (this.#full) {
      this.#full = false
      this.#dirty.clear()
      return null
    }
    const d = this.#dirty
    this.#dirty = new Set()
    return d
  }
  shouldUpdate(deps, dirty) {
    if (dirty === null || deps === null) return true
    for (const s of deps) if (dirty.has(s)) return true
    return false
  }
  flush() {
    const dirty = this.#consume()
    this.#cache.clear()
    if (this.shouldUpdate(["n"], dirty)) this.#updates += 1
    if (this.shouldUpdate(["m"], dirty)) this.#updates += 1
  }
  bump() {
    this.#state.n += 1
    this.markDirty("n")
    this.flush()
  }
  get updates() {
    return this.#updates
  }
}

function createK() {
  return { dirty: new Set(), full: true, cache: new Map(), state: { n: 0 }, updates: 0 }
}
function markDirty(k, s) {
  k.dirty.add(s)
  k.cache.clear()
}
function consume(k) {
  if (k.full) {
    k.full = false
    k.dirty.clear()
    return null
  }
  const d = k.dirty
  k.dirty = new Set()
  return d
}
function shouldUpdate(deps, dirty) {
  if (dirty === null || deps === null) return true
  for (const s of deps) if (dirty.has(s)) return true
  return false
}
function flush(k) {
  const dirty = consume(k)
  k.cache.clear()
  if (shouldUpdate(["n"], dirty)) k.updates += 1
  if (shouldUpdate(["m"], dirty)) k.updates += 1
}
function bump(k) {
  k.state.n += 1
  markDirty(k, "n")
  flush(k)
}

const N_INST = 20000
const N_OPS = 200

function benchClass() {
  const t0 = performance.now()
  const items = []
  for (let i = 0; i < N_INST; i++) items.push(new C())
  const t1 = performance.now()
  let acc = 0
  for (let r = 0; r < N_OPS; r++) for (const c of items) c.bump()
  for (const c of items) acc += c.updates
  const t2 = performance.now()
  return { create: t1 - t0, ops: t2 - t1, acc }
}

function benchFn() {
  const t0 = performance.now()
  const items = []
  for (let i = 0; i < N_INST; i++) items.push(createK())
  const t1 = performance.now()
  let acc = 0
  for (let r = 0; r < N_OPS; r++) for (const k of items) bump(k)
  for (const k of items) acc += k.updates
  const t2 = performance.now()
  return { create: t1 - t0, ops: t2 - t1, acc }
}

// warmup + interleaved runs
benchClass()
benchFn()
const rc = [],
  rf = []
for (let i = 0; i < 5; i++) {
  rc.push(benchClass())
  rf.push(benchFn())
}
const med = (arr, key) => arr.map((x) => x[key]).sort((a, b) => a - b)[2]
console.log(
  `class: create ${med(rc, "create").toFixed(1)} ms, ${N_OPS}x${N_INST} updates ${med(rc, "ops").toFixed(1)} ms`,
)
console.log(
  `fn:    create ${med(rf, "create").toFixed(1)} ms, ${N_OPS}x${N_INST} updates ${med(rf, "ops").toFixed(1)} ms`,
)
// memory: rough per-instance retained size
global.gc?.()
const m0 = process.memoryUsage().heapUsed
const keep = []
for (let i = 0; i < 50000; i++) keep.push(new C())
global.gc?.()
const m1 = process.memoryUsage().heapUsed
const keep2 = []
for (let i = 0; i < 50000; i++) keep2.push(createK())
global.gc?.()
const m2 = process.memoryUsage().heapUsed
console.log(
  `heap/instance: class ~${((m1 - m0) / 50000).toFixed(0)} B, kernel ~${((m2 - m1) / 50000).toFixed(0)} B (${keep.length + keep2.length})`,
)
