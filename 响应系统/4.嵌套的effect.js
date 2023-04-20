const $effectStack = []

function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn)
    $effectStack.push(effectFn)
    fn()
    $effectStack.pop()
  }
  effectFn.deps = []
  effectFn()
}

const data = { text: "text", name: "name", bool: false }

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
  effectsToRun.forEach((fn) => fn())
}

function cleanup(fn) {
  for (const deps of fn.deps) {
    deps.delete(fn)
  }
  fn.deps.length = 0
}

effect(() => {
  effect(() => {
    console.log(obj.text)
  })
  console.log(obj.name)
})
obj.name = "new name"
