let $effectFn = null

function effect(fn) {
  const effectFn = () => {
    cleanup(effectFn)
    $effectFn = effectFn
    fn()
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
  if ($effectFn) {
    const map = bucket.get(target) || new Map()
    const pre = map.get(key) || new Set()
    pre.add($effectFn)
    map.set(key, pre)
    bucket.set(target, map)
    $effectFn.deps.push(pre)
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
  console.log(obj.bool ? obj.name : obj.text)
})
obj.bool = true
obj.text = "new text"
obj.bool = false
obj.text = "new text2"
