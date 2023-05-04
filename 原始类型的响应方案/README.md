# 原始类型的响应方案

## Ref 的概念

由于 Proxy 无法对原始类型的值进行代理，处理思路是用一个对象对原始值进行包裹。

```JS
const obj = {
  value: 'foo'
}
const name = reactive(obj)
name.value // foo
```

将该过程封装为一个自动生成 ref 的函数。

### 源码中的 Ref

Vue 源码中，ref 返回的是一个 RefImpl 类的实例。

有一个只读属性 `__v_isRef` 表示其是 ref。

同时 value 属性是以 getter 和 setter 的形式定义的。其响应能力确实也是通过复用代理对象的 reactive 方法（源码中的 toReactive）

## 响应丢失问题

场景：当在 setup 中通过扩展运算符暴露内容时，内容将会失去响应性。
需求：将一个对象的每个属性，都转为 ref，即 `toRefs`

toRefs 的使用对象：reactive 代理后的响应式数据

## 自动脱 Ref

由 ref 包裹的普通变量，访问时必须通过`.value`，使用不便。
为了能在模板中直接使用 ref 变量，可以对一个属性值都是 ref 的对象进行代理，在读取属性时判断若属性是 ref，则返回其 value 属性。

> 为什么在 JS 中不能使用脱 Ref，而在模板中可以？

因为 setup 导出的是一个对象，会传入 proxyRefs 进行脱 ref。而 JS 中，使用 ref 代理的是原始值。
