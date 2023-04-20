let $effectFn = null

function effect(fn) {
  $effectFn = fn
  fn()
  $effectFn = null
}

const data = { text: "obj" }

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
  }
}

function trigger(target, key) {
  const map = bucket.get(target)
  const cb = map.get(key)
  cb && cb.forEach((fn) => fn())
}

effect(() => {
  console.log(obj.text)
})
obj.text = "new text"
obj.name = "obj"
