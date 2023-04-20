const $effectStack = []

function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    $effectStack.push(effectFn)
    const res = fn()
    $effectStack.pop()
    return res
  }
  effectFn.deps = []
  effectFn.options = options
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

const data = { name: "name", age: 23 }

const bucket = new WeakMap()

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, value) {
    target[key] = value
    trigger(target, key)
  }
})

function track(target, key) {
  if ($effectStack.length) {
    const currentEffect = $effectStack[$effectStack.length - 1]
    const map = bucket.get(target) || new Map()
    const effects = map.get(key) || new Set()
    effects.add(currentEffect)
    map.set(key, effects)
    bucket.set(target, map)
    currentEffect.deps.push(effects)
  }
}

function trigger(target, key) {
  const map = bucket.get(target)
  const cb = map.get(key)
  const effectsToRun = new Set(cb)
  effectsToRun.forEach((fn) => {
    if (fn !== $effectStack[$effectStack.length - 1]) {
      if (fn.options.scheduler) {
        fn.options.scheduler(fn)
      } else {
        fn()
      }
    }
  })
}

function cleanup(fn) {
  for (const deps of fn.deps) {
    deps.delete(fn)
  }
  fn.deps.length = 0
}

const jobQueue = new Set()
let isFlush = false
function flushJob() {
  if (isFlush) {
    return
  }
  isFlush = true
  Promise.resolve()
    .then(() => {
      jobQueue.forEach((fn) => fn())
    })
    .finally(() => {
      isFlush = false
    })
}

function computed(getter) {
  let value
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (!dirty) {
        dirty = true
        trigger(obj, "value")
      }
    }
  })
  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      track(obj, "value")
      return value
    }
  }
  return obj
}

const comp = computed(() => `name: ${obj.name}; age:${obj.age}`)
effect(() => console.log(comp.value))
obj.name = "new name"
// console.log(comp.value)
