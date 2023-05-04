# 渲染器设计

## 渲染器与响应系统

渲染器用于执行渲染任务，如在浏览器平台中就是将虚拟 DOM 渲染为真实 DOM 元素。

而对于 DOM 的更改，可以视为是一种**副作用**。结合响应式系统，将渲染器的执行放在 `effect` 方法中，即可实现响应式的渲染和更新。

渲染器要处理的三种情况：

- mount：首次挂载
- patch：后续更新
- unmount：卸载

## 基本概念

### renderer 和 render

- renderer：名词，渲染器，用于执行渲染
- render：动词，表示渲染操作

### 虚拟 DOM（vdom）

由一个个节点组成的树形结构，用于表示真实的 DOM。每个节点（vnode）也都是一颗树

### 挂载（mount）

renderer 将虚拟 DOM 渲染为真实节点的过程

### 更新/打补丁（patch）

非首次挂载时，比较两次 vdom 的区别，并更新至真实 DOM

## 自定义渲染器

渲染器用于渲染 vDom，而对于不同平台，vDom 是通用的。
要实现跨平台只需要提供平台特定的操作真实 DOM 的 API，如创建节点、在父容器中挂载节点等等。
Vue 中就是如此实现，在创建 renderer 时可以传入平台特定 API 即可实现跨平台。

## HTML Attribute 和 DOM Property 的区别

当在 HTML 中定义一个标签，并添加属性（HTML Attribute）：

```HTML
<input id='my_input' value='foo' />
```

浏览器会创建一个对应的 DOM 元素对象，可通过 JS 选择器获取。

该对象有很多属性（DOM Property），通常会与同名的 HTML Attribute 直接映射，但有些属性例外，如 value、class 等。

实际上，**HTML Attribute 的作用是给对应的 DOM Property（不一定同名）提供初始值。**

## 挂载子节点和元素属性

将 Vdom 中的 props 设置到元素的属性，需要处理以下几个问题：

- **判断是应该通过 setAttribute，还是直接修改 Dom 的属性**。有些属性是只读的，如表单元素的 form 属性
- **处理布尔类型的属性（如 disabled）**。因为 setAttribute 会将值转为字符串，布尔类型取值为 false 时会出错
- **处理 class 和 style**。
  - Vue 中对 class 和 style 做了增强，如可以使用数组、对象，需要先做格式的归一化转换
  - 修改 class 将通过 el.className 而不是 setAttribute，因为前者性能表现更好

## 卸载元素

### 最简实现

实现卸载最简单的方式是 `el.innerHTML = ''`，即清空 html 内容。

这样存在的问题：

1. 容器内容可能是组件，应该触发它们的生命周期
2. 有的元素存在自定义指令，应该触发它们的钩子函数
3. 不会移除绑定在 DOM 上的事件处理函数

### 优化

将卸载操作封装为 unmount 函数，其通过原生方法（removeChild）卸载元素。

在该方法中还应调用绑定在元素上的钩子函数，以及组件的生命周期函数。

## 事件处理

约定以 on 开头的属性，作为事件，通过 addEventListener 添加到元素。

### 更新事件

- 绑定事件时，使用一个代理事件函数 invoker，在回调中调用 invoker.value
- 事件更新时，更新 invoker.value。这样不需要解绑和重新绑定，就可以更新真正执行的处理函数。

### 更新时机问题

若响应式数据的改变会导致回调函数绑定的改变，则该改变的结果在事件冒泡之后，导致不该触发的回调被触发。
如下代码，点击 p 元素后，父元素回调也会执行。

```JS
const { effect, ref } = VueReactivity
const bol = ref(false)
effect(() => {
  // 创建 vnode
  const vnode = {
    type: 'div',
    props: bol.value ? {
      onClick: () => {
        alert('父元素 clicked')
      }
    } : {},
    children: [
      {
        type: 'p',
        props: {
          onClick: () => {
            bol.value = true
          }
        },
        children: 'text'
      }
    ]
  }
  // 渲染 vnode
  renderer.render(vnode, document.querySelector('#app'))
})
```

解决办法：判断事件发生和回调绑定的时间戳，过滤在绑定前触发的事件。

## 更新子节点

patch 的最后一步，就是完成所有子节点的更新。子节点类型分三种，无、文本节点、多个子节点。

其中当更新前后的子节点类型都为列表时是最复杂的情况，会涉及到核心的 diff 算法。

> Vue3 中为什么可以有多个根节点？

新增了 `Fragment` 节点类型，作为一个虚拟节点，不会渲染出任何内容，只会渲染其所有子元素
