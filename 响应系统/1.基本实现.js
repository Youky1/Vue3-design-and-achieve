const data = { text: "obj" }

const bucket = new Set()

const obj = new Proxy(data, {
  get(target, key) {
    bucket.add(effect)
    return target[key]
  },
  set(target, key, value) {
    target[key] = value
    bucket.forEach((fn) => fn())
  }
})

function effect() {
  console.log(obj.text)
}

effect()

obj.text = "new text"
