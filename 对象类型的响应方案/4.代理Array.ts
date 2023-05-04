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

function trigger(target: Object, key: Key, newVal?: any) {
  const map = bucket.get(target)
  const cb = map?.get(key)
  const effectsToRun = new Set(cb)
  if (newVal && Array.isArray(target) && key === "length") {
    map?.forEach((callbacks, k) => {
      if (k > newVal) {
        callbacks.forEach((fn) => {
          if (fn !== $effectStack[$effectStack.length - 1]) {
            effectsToRun.add(fn)
          }
        })
      }
    })
  }
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

function createReactive(
  data: Object,
  isShallow = false,
  isReadonly = false
): any {
  return new Proxy(data, {
    // 拦截属性读取
    get(target, key, receiver) {
      if (key === RAW_KEY) {
        return target
      }
      const res = Reflect.get(target, key, receiver)
      if (!isReadonly) {
        track(target, key)
      }
      if (!isShallow && res && typeof res === "object") {
        return isReadonly ? readonly(res) : reactive(res)
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
      if (isReadonly) {
        console.warn(`${String(key)} is readonly`)
        return true
      }
      const isArray = Array.isArray(target)
      const type = isArray
        ? Number(key) < target.length
          ? "SET"
          : "ADD"
        : Reflect.has(target, key)
        ? "SET"
        : "ADD"
      const oldValue = Reflect.get(target, key)
      const res = Reflect.set(target, key, value, receiver)
      if (!Object.is(oldValue, value) && target === receiver[RAW_KEY]) {
        trigger(target, key, value)
      }
      if (type === "ADD") {
        trigger(target, isArray ? "length" : ITERATE_KEY, value)
      }
      return res
    },
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`${String(key)} is readonly`)
        return true
      }
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

function readonly(obj: Object) {
  return createReactive(obj, false, true)
}
function shallowReadonly(obj: Object) {
  return createReactive(obj, true, true)
}

const a = reactive([1, 2, 3])
