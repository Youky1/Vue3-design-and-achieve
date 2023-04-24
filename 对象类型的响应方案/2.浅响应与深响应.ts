type Callback = Function & { deps: Set<Function>[]; options: Options }
type Key = string | Symbol
interface Options {
  lazy?: boolean
  scheduler?: Function
}
export {}

const $effectStack: Array<Callback> = []
const bucket = new WeakMap<Object, Map<Key, Set<Callback>>>()
const ITERATE_KEY = Symbol()
const RAW_KEY = Symbol()

const data = { name: "name", age: 23 }

const obj = reactive(data)

function track(target: Object, key: Key) {
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

function trigger(target: Object, key: Key) {
  const map = bucket.get(target)
  const cb = map?.get(key)
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

function cleanup(fn: Callback) {
  for (const deps of fn.deps) {
    deps.delete(fn)
  }
  fn.deps.length = 0
}

function effect(fn: Function, options: Options = {}) {
  const effectFn: Callback = () => {
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

function createReactive(data: Object, isShallow = false) {
  return new Proxy(data, {
    // 拦截属性读取
    get(target, key, receiver) {
      if (key === RAW_KEY) {
        return target
      }
      const res = Reflect.get(target, key, receiver)
      track(target, key)
      if (!isShallow && res && typeof res === "object") {
        return reactive(res)
      }
      return res
    },
    // 拦截 in 操作符
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    // 拦截 for in 循环
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    set(target, key, value, receiver) {
      const type = Reflect.has(target, key) ? "SET" : "ADD"
      const oldValue = Reflect.get(target, key)
      const res = Reflect.set(target, key, value, receiver)
      if (!Object.is(oldValue, value) && target === receiver[RAW_KEY]) {
        trigger(target, key)
      }
      if (type === "ADD") {
        trigger(target, ITERATE_KEY)
      }
      return res
    },
    deleteProperty(target, key) {
      const isDelete = Reflect.has(target, key)
      const res = Reflect.deleteProperty(target, key)
      if (isDelete) {
        trigger(target, ITERATE_KEY)
      }
      return res
    }
  })
}

function reactive(data: Object) {
  return createReactive(data)
}

function shallowReactive(data: Object) {
  return createReactive(data, true)
}
