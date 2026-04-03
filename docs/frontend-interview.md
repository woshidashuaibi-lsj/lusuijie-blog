# 前端面试八股文复习手册

> 5 年经验前端，15 天冲刺复习。聚焦高频考点，每个知识点配有"标准答案"+ 追问预测。

---

## 目录

- [一、JavaScript 核心](#一javascript-核心)
- [二、CSS 核心](#二css-核心)
- [三、React / Vue 框架](#三react--vue-框架)
- [四、计算机网络](#四计算机网络)
- [五、浏览器原理与性能优化](#五浏览器原理与性能优化)
- [六、小程序](#六小程序)
- [七、工程化（Webpack / Vite）](#七工程化webpack--vite)
- [八、算法高频题](#八算法高频题)
- [九、复习计划](#九复习计划)

---

## 一、JavaScript 核心

### 1.1 原型与原型链

**标准答案**：

每个对象都有一个 `__proto__` 属性指向其构造函数的 `prototype`。查找属性时，如果当前对象没有，就沿着原型链向上查找，直到 `Object.prototype.__proto__ = null` 为止。

```javascript
function Person(name) { this.name = name; }
Person.prototype.say = function() { console.log(this.name); };

const p = new Person('Tom');
// p.__proto__ === Person.prototype
// Person.prototype.__proto__ === Object.prototype
// Object.prototype.__proto__ === null
```

**关键等式**：

```javascript
p.__proto__ === Person.prototype           // true
Person.prototype.constructor === Person    // true
p instanceof Person                        // true

// instanceof 原理：
// 沿着 p.__proto__ 链查找，有没有等于 Person.prototype 的
```

**`new` 操作符做了什么**：

```javascript
function myNew(Fn, ...args) {
  const obj = Object.create(Fn.prototype);  // 1. 创建空对象，原型指向 Fn.prototype
  const result = Fn.apply(obj, args);        // 2. 执行构造函数，this = obj
  return result instanceof Object ? result : obj;  // 3. 构造函数有返回对象则用它，否则返回 obj
}
```

**追问**：`Object.create(null)` 和 `{}` 的区别？
> `Object.create(null)` 创建的对象没有原型链，纯净对象，常用于创建字典/哈希表，不会有原型污染。

---

### 1.2 作用域与闭包

**作用域链**：JS 采用词法作用域（静态作用域），函数定义时就确定了作用域链，而不是调用时。

```javascript
let x = 1;
function outer() {
  let x = 2;
  function inner() {
    console.log(x); // 2，inner 定义在 outer 里，向上找到 outer 的 x
  }
  return inner;
}
outer()(); // 2
```

**闭包定义**：函数能够访问其词法作用域中的变量，即使函数在其词法作用域之外执行。

```javascript
function makeCounter() {
  let count = 0;  // 被闭包持有，不会被 GC
  return {
    inc: () => ++count,
    dec: () => --count,
    get: () => count
  };
}
const counter = makeCounter();
counter.inc(); // 1
counter.inc(); // 2
```

**闭包的内存泄漏**：

```javascript
// 问题：DOM 节点持有闭包，闭包持有 DOM，循环引用
function bindEvent() {
  const el = document.getElementById('btn');
  el.onclick = function() {
    console.log(el.id); // 闭包引用了 el
  };
  // 解决：用完后 el = null，或用 event 参数替代直接引用
}
```

**经典题：循环中的闭包**：

```javascript
// 问题：输出 5 个 5
for (var i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 0);  // i 是共享的
}

// 解法 1：let（块级作用域，每次循环独立的 i）
for (let i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 0);  // 0 1 2 3 4
}

// 解法 2：IIFE
for (var i = 0; i < 5; i++) {
  (function(j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
```

---

### 1.3 this 指向

**四种绑定规则**（优先级从高到低）：

| 绑定方式 | 场景 | this 指向 |
|---------|------|----------|
| **new 绑定** | `new Fn()` | 新创建的对象 |
| **显式绑定** | `call/apply/bind` | 指定的对象 |
| **隐式绑定** | `obj.fn()` | 调用对象 obj |
| **默认绑定** | `fn()` 直接调用 | 严格模式 undefined，非严格 window |

**箭头函数**：没有自己的 this，继承外层词法作用域的 this，且不能被 call/apply/bind 改变。

```javascript
const obj = {
  name: 'Tom',
  say: function() {
    setTimeout(function() {
      console.log(this.name); // undefined（this=window）
    }, 0);
    setTimeout(() => {
      console.log(this.name); // 'Tom'（箭头函数，this继承外层）
    }, 0);
  }
};
```

**call/apply/bind 区别**：

```javascript
fn.call(obj, arg1, arg2)          // 立即执行，参数逐个传
fn.apply(obj, [arg1, arg2])       // 立即执行，参数数组传
const boundFn = fn.bind(obj, arg1) // 不立即执行，返回新函数
```

**手写 bind**：

```javascript
Function.prototype.myBind = function(ctx, ...args) {
  const fn = this;
  return function(...innerArgs) {
    // 处理 new 的情况
    if (this instanceof fn) {
      return new fn(...args, ...innerArgs);
    }
    return fn.apply(ctx, [...args, ...innerArgs]);
  };
};
```

---

### 1.4 异步：Event Loop

**浏览器事件循环**：

```
同步代码（调用栈）→ 执行完
      ↓
微任务队列（Microtask）→ 全部执行完（Promise.then / MutationObserver / queueMicrotask）
      ↓
宏任务（Macrotask）→ 取一个执行（setTimeout / setInterval / I/O / MessageChannel）
      ↓
重新检查微任务队列...（循环）
```

**经典输出题**：

```javascript
console.log(1);

setTimeout(() => console.log(2), 0);

Promise.resolve()
  .then(() => console.log(3))
  .then(() => console.log(4));

console.log(5);

// 输出：1 5 3 4 2
// 分析：
// 同步：1, 5
// 微任务：3（第一个 then）→ 4（3执行后加入第二个 then）
// 宏任务：2
```

**Node.js 事件循环** 和浏览器的区别：

| | 浏览器 | Node.js |
|--|--------|---------|
| 微任务 | Promise.then、MutationObserver | Promise.then、process.nextTick（优先级更高）|
| 宏任务阶段 | 统一队列 | timers → I/O → check(setImmediate) 等多阶段 |

---

### 1.5 Promise

**手写 Promise（核心）**：

```javascript
class MyPromise {
  static PENDING = 'pending';
  static FULFILLED = 'fulfilled';
  static REJECTED = 'rejected';

  constructor(executor) {
    this.status = MyPromise.PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.status !== MyPromise.PENDING) return;
      this.status = MyPromise.FULFILLED;
      this.value = value;
      this.onFulfilledCallbacks.forEach(fn => fn(value));
    };

    const reject = (reason) => {
      if (this.status !== MyPromise.PENDING) return;
      this.status = MyPromise.REJECTED;
      this.reason = reason;
      this.onRejectedCallbacks.forEach(fn => fn(reason));
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v;
    onRejected = typeof onRejected === 'function' ? onRejected : r => { throw r; };

    return new MyPromise((resolve, reject) => {
      const handle = (fn, val) => {
        setTimeout(() => {  // 模拟微任务异步
          try {
            const result = fn(val);
            result instanceof MyPromise ? result.then(resolve, reject) : resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      };

      if (this.status === MyPromise.FULFILLED) handle(onFulfilled, this.value);
      else if (this.status === MyPromise.REJECTED) handle(onRejected, this.reason);
      else {
        this.onFulfilledCallbacks.push(v => handle(onFulfilled, v));
        this.onRejectedCallbacks.push(r => handle(onRejected, r));
      }
    });
  }
}
```

**Promise 常用 API 区别**：

```javascript
// all：全部成功才成功，一个失败就失败
Promise.all([p1, p2, p3])

// allSettled：全部结束（无论成败）
Promise.allSettled([p1, p2])

// race：第一个结束的（成功或失败）决定结果
Promise.race([p1, p2])

// any：第一个成功的，全部失败才失败（ES2021）
Promise.any([p1, p2])
```

---

### 1.6 ES6+ 常考点

**let / const / var 区别**：

| | var | let | const |
|--|-----|-----|-------|
| 作用域 | 函数/全局 | 块级 | 块级 |
| 变量提升 | ✅（undefined）| ❌（暂时性死区 TDZ）| ❌ |
| 重复声明 | ✅ | ❌ | ❌ |
| 全局属性 | ✅（window.x）| ❌ | ❌ |

**解构赋值**：

```javascript
// 默认值
const { a = 1, b = 2 } = { a: 10 };  // a=10, b=2

// 重命名
const { name: userName } = { name: 'Tom' };  // userName='Tom'

// 数组解构 + 跳过
const [, second, , fourth] = [1, 2, 3, 4];

// 函数参数解构
function fn({ name, age = 18 } = {}) {}
```

**扩展运算符 vs rest 参数**：

```javascript
// 扩展：展开数组/对象
const merged = { ...obj1, ...obj2 };
const arr = [...arr1, ...arr2];

// rest：收集剩余参数
function fn(first, ...rest) {
  // rest 是数组
}
```

**可选链 `?.` 和空值合并 `??`**：

```javascript
const city = user?.address?.city;     // 链式安全访问
const name = user.name ?? '匿名';    // 只有 null/undefined 才用默认值
// ?? 和 || 的区别：|| 对 0、''、false 也会取后者，?? 不会
```

**WeakMap / WeakSet**：

- 键名必须是对象，弱引用（不阻止 GC）
- 没有 `size` 属性，不可遍历
- 常用场景：给 DOM 元素关联数据，DOM 被删除后自动 GC；实现私有属性

---

### 1.7 深拷贝

```javascript
function deepClone(target, map = new WeakMap()) {
  // 处理基本类型
  if (typeof target !== 'object' || target === null) return target;
  
  // 处理循环引用
  if (map.has(target)) return map.get(target);
  
  // 处理特殊类型
  if (target instanceof Date) return new Date(target);
  if (target instanceof RegExp) return new RegExp(target);
  
  // 处理数组和对象
  const clone = Array.isArray(target) ? [] : {};
  map.set(target, clone);  // 先存，防止循环引用
  
  for (const key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      clone[key] = deepClone(target[key], map);
    }
  }
  return clone;
}
```

---

### 1.8 防抖与节流

```javascript
// 防抖：最后一次触发后 delay ms 执行（搜索输入）
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流：每隔 interval ms 最多执行一次（scroll/resize）
function throttle(fn, interval) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}
```

---

## 二、CSS 核心

### 2.1 BFC（块格式化上下文）

**触发 BFC 的条件**：
- `overflow: hidden / auto / scroll`（非 visible）
- `display: flex / grid / inline-block / table-cell`
- `position: absolute / fixed`
- `float: left / right`

**BFC 的特性**：
1. 内部 Box 垂直排列
2. **同一 BFC 内的相邻 margin 会折叠**（解决方案：让两者处于不同 BFC）
3. **BFC 不与浮动元素重叠**
4. **BFC 计算高度时包含浮动子元素**（清除浮动）

**清除浮动的方法**：

```css
/* 方法 1：伪元素 clearfix（推荐）*/
.clearfix::after {
  content: '';
  display: block;
  clear: both;
}

/* 方法 2：overflow: hidden（触发 BFC）*/
.container {
  overflow: hidden;
}

/* 方法 3：额外元素 clear:both（不推荐，污染 DOM）*/
```

---

### 2.2 盒模型

```css
/* 标准盒模型（默认）：width = content 宽度 */
box-sizing: content-box;
/* 实际占地 = width + padding + border */

/* IE 盒模型（推荐全局设置）：width = content + padding + border */
box-sizing: border-box;
/* 实际占地 = width（更直观）*/
```

---

### 2.3 Flex 布局高频

```css
/* 容器属性 */
.container {
  display: flex;
  flex-direction: row | column;
  flex-wrap: nowrap | wrap;
  justify-content: flex-start | center | space-between | space-around | space-evenly;
  align-items: stretch | center | flex-start | flex-end | baseline;
  align-content: /* 多行时的行间距 */;
  gap: 10px;
}

/* 子项属性 */
.item {
  flex: 1;           /* flex-grow:1 flex-shrink:1 flex-basis:0% */
  flex: 0 0 200px;   /* 固定宽度，不缩放 */
  align-self: center; /* 单独覆盖 align-items */
  order: 1;          /* 排序 */
}
```

**常见布局实现**：

```css
/* 水平垂直居中 */
.parent {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 左固定右自适应 */
.left { flex: 0 0 200px; }
.right { flex: 1; }

/* 圣杯布局（三栏，中间自适应）*/
.container { display: flex; }
.left { flex: 0 0 200px; order: -1; }
.right { flex: 0 0 200px; }
.main { flex: 1; }
```

---

### 2.4 Grid 布局

```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr 200px;  /* 三列：固定-自适应-固定 */
  grid-template-rows: auto;
  gap: 10px;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
}

.header { grid-area: header; }
.main   { grid-area: main;   }
```

---

### 2.5 定位

```
static：默认，无定位
relative：相对自身原位偏移，仍占位
absolute：相对最近的 非static 祖先定位，脱离文档流
fixed：相对视口，脱离文档流
sticky：相对定位 + 滚动到阈值后变 fixed（导航栏吸顶）
```

**层叠上下文（Stacking Context）**：

- `z-index` 只在同一层叠上下文内比较
- 触发新层叠上下文：`position + z-index≠auto`、`opacity<1`、`transform`、`will-change`

---

### 2.6 CSS 动画

```css
/* Transition：状态过渡 */
.btn {
  transition: all 0.3s ease;
}
.btn:hover {
  transform: scale(1.1);
}

/* Animation：关键帧动画 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.box {
  animation: fadeIn 0.5s ease forwards;
  /* name | duration | timing | fill-mode */
}
```

**性能优化**：只用 `transform` 和 `opacity` 做动画（不触发重排重绘，走合成器线程）。

---

### 2.7 响应式

```css
/* 媒体查询 */
@media (max-width: 768px) {
  .container { flex-direction: column; }
}

/* 移动端适配方案对比 */
/* 1. rem：根据 html font-size，需要 JS 动态设置 */
/* 2. vw/vh：相对视口，100vw = 视口宽度（推荐）*/
/* 3. flex + 百分比：流式布局 */

/* viewport meta */
/* <meta name="viewport" content="width=device-width, initial-scale=1"> */
```

---

### 2.8 选择器优先级

```
!important > 内联 > ID(100) > 类/伪类/属性(10) > 标签/伪元素(1) > * (0)

div.active p       → 0-1-1 = 12
#nav .item:hover   → 1-2-0 = 120
```

---

## 三、React / Vue 框架

### 3.1 React Hooks 高频

#### useState

```javascript
const [count, setCount] = useState(0);

// 函数式更新（依赖上一个状态时必须用）
setCount(prev => prev + 1);

// 惰性初始化（复杂计算只执行一次）
const [state] = useState(() => expensiveCompute());
```

#### useEffect

```javascript
// 依赖数组的三种形式
useEffect(() => { /* 每次渲染后执行 */ });
useEffect(() => { /* 只在 mount 执行 */ }, []);
useEffect(() => { /* dep 变化后执行 */ }, [dep]);

// 清理函数（组件卸载 or 下次 effect 前执行）
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);  // 清理
}, []);
```

#### useCallback / useMemo

```javascript
// useMemo：缓存计算结果（值）
const expensiveValue = useMemo(() => heavyCompute(a, b), [a, b]);

// useCallback：缓存函数引用（防止子组件不必要重渲染）
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

**什么时候用**：子组件用 `React.memo` 包裹 + 父组件传函数时，才需要 `useCallback`，否则无意义。

#### useRef

```javascript
// 两种用途：
// 1. 访问 DOM
const inputRef = useRef(null);
<input ref={inputRef} />
inputRef.current.focus();

// 2. 保存不触发渲染的变量（如定时器 ID）
const timerRef = useRef(null);
timerRef.current = setInterval(() => {}, 1000);
```

#### useReducer

```javascript
// 适合复杂状态逻辑（代替 useState + 多个 setState）
const reducer = (state, action) => {
  switch (action.type) {
    case 'inc': return { count: state.count + 1 };
    case 'dec': return { count: state.count - 1 };
    default: return state;
  }
};

const [state, dispatch] = useReducer(reducer, { count: 0 });
dispatch({ type: 'inc' });
```

---

### 3.2 React 性能优化

**避免不必要重渲染**：

```javascript
// 1. React.memo：props 不变则跳过渲染
const Child = React.memo(({ name }) => <div>{name}</div>);

// 2. 结合 useCallback 防止函数引用变化触发重渲染
const handleClick = useCallback(() => {}, []);
<Child onClick={handleClick} />

// 3. 状态下移：只影响局部的状态不要放顶层
// 4. 列表加 key（稳定的、唯一的）
```

**Code Splitting 懒加载**：

```javascript
const LazyPage = React.lazy(() => import('./Page'));
<Suspense fallback={<Loading />}>
  <LazyPage />
</Suspense>
```

---

### 3.3 Fiber 架构与 Diff 算法

**Fiber 解决什么问题**：

旧版 React（Stack Reconciler）是递归同步处理，一旦开始就无法中断。大型组件树更新时会阻塞主线程，导致掉帧。

**Fiber 的核心**：
- 把渲染工作切成小单元（Fiber 节点）
- 每个小单元执行后，检查是否有更高优先级的任务（用户输入等），有则中断
- 利用 `requestIdleCallback`（实际是自研 `MessageChannel` 实现）在空闲时间执行

**Diff 算法（协调）的三个策略**：

1. **同层比较**：不跨层移动 DOM，只对比同一层级的节点
2. **类型不同直接替换**：`<div>` 变成 `<span>` 时直接销毁重建
3. **key 优化列表**：有 key 时通过 key 找到可复用的节点，避免全量重建

```jsx
// 为什么不用 index 做 key
// 删除第一项时，后面所有项的 index 变化，导致全部重渲染
// 应该用数据的唯一 ID
<li key={item.id}>{item.name}</li>
```

---

### 3.4 Vue 响应式原理

**Vue 2（Object.defineProperty）**：

```javascript
function defineReactive(obj, key, val) {
  const dep = new Dep();  // 依赖收集器
  Object.defineProperty(obj, key, {
    get() {
      dep.depend();  // 收集当前 Watcher
      return val;
    },
    set(newVal) {
      val = newVal;
      dep.notify();  // 通知所有 Watcher 更新
    }
  });
}
```

**Vue 2 的缺陷**：
- 无法检测对象属性的添加/删除（需要 `Vue.set`）
- 无法检测数组下标变化（需要重写数组方法）

**Vue 3（Proxy）**：

```javascript
const reactive = (target) => {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);  // 收集依赖
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key);  // 触发更新
      return result;
    }
  });
};
```

**Vue 3 的优势**：
- Proxy 拦截整个对象，包括属性新增、删除
- 惰性递归（只有访问到才深度代理，性能更好）
- 支持 Map / Set / WeakMap / WeakSet

---

### 3.5 Vue 生命周期

```
创建阶段：
  beforeCreate → created（data/methods 可用，无 DOM）

挂载阶段：
  beforeMount → mounted（DOM 可访问）

更新阶段：
  beforeUpdate → updated（state 变化后）

销毁阶段：
  beforeDestroy → destroyed（Vue 2）
  beforeUnmount → unmounted（Vue 3）
```

**父子组件生命周期顺序**：

```
父 beforeCreate → 父 created → 父 beforeMount
  → 子 beforeCreate → 子 created → 子 beforeMount → 子 mounted
父 mounted
```

---

### 3.6 Vuex / Pinia / Redux 对比

| | Vuex | Pinia | Redux |
|--|------|-------|-------|
| **框架** | Vue 2/3 | Vue 3（推荐）| React |
| **语法** | options API | composition API | 纯函数 reducer |
| **模块化** | modules（繁琐）| 直接多个 store | combineReducers |
| **TypeScript** | 一般 | 完美 | 一般（RTK 优化）|
| **DevTools** | ✅ | ✅ | ✅ |

---

## 四、计算机网络

### 4.1 HTTP 状态码

```
1xx：信息性（100 Continue）
2xx：成功
  200 OK
  201 Created（POST 创建成功）
  204 No Content（DELETE 成功，无响应体）
  206 Partial Content（Range 请求，分片下载）
3xx：重定向
  301 Moved Permanently（永久重定向，浏览器缓存）
  302 Found（临时重定向）
  304 Not Modified（协商缓存命中）
  307 Temporary Redirect（与302类似，但保证方法不变）
4xx：客户端错误
  400 Bad Request
  401 Unauthorized（未认证）
  403 Forbidden（已认证但无权限）
  404 Not Found
  429 Too Many Requests（限流）
5xx：服务端错误
  500 Internal Server Error
  502 Bad Gateway（反向代理收到上游无效响应）
  503 Service Unavailable（服务器超载/维护）
```

---

### 4.2 HTTP 缓存机制

**强缓存**（不发请求）：

```
响应头：
  Cache-Control: max-age=3600   ← 优先级更高
  Expires: Wed, 01 Jan 2025 00:00:00 GMT  ← 旧标准，绝对时间

浏览器判断：
  当前时间 < 过期时间 → 直接用缓存（200 from cache）
  过期了 → 进入协商缓存
```

**协商缓存**（发请求，服务器判断）：

```
Last-Modified / If-Modified-Since（时间精度秒级）
  响应：Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT
  请求：If-Modified-Since: Mon, 01 Jan 2024 00:00:00 GMT
  服务器判断：未修改 → 304，修改了 → 200 + 新内容

ETag / If-None-Match（精确，推荐）
  响应：ETag: "abc123"
  请求：If-None-Match: "abc123"
  服务器比较 ETag → 未变化 → 304
```

**Cache-Control 常用指令**：

```
max-age=N：N 秒内使用强缓存
no-cache：每次都进行协商缓存（不跳过请求）
no-store：完全不缓存
public：可被代理服务器缓存
private：只允许浏览器缓存
must-revalidate：过期后必须重新验证
```

**前端工程化的缓存策略**：

```
HTML：Cache-Control: no-cache（每次协商，保证拿到最新 HTML）
JS/CSS/图片（带 hash）：Cache-Control: max-age=31536000（永久缓存）
  → 文件内容变化时 hash 变化，URL 变化，自动破坏缓存
```

---

### 4.3 HTTP/1.1 vs HTTP/2 vs HTTP/3

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|---------|--------|--------|
| **连接** | 每个请求一个 TCP（keep-alive 复用有限）| 多路复用（一个 TCP + 多 stream）| QUIC（UDP）|
| **队头阻塞** | 有（请求串行）| TCP 层面仍有 | 无（QUIC stream 独立）|
| **头部压缩** | 无 | HPACK 压缩 | QPACK 压缩 |
| **服务端推送** | ❌ | ✅（Server Push）| ✅ |
| **0-RTT** | ❌ | ❌（TLS 握手）| ✅（QUIC 支持）|

---

### 4.4 HTTPS

**TLS 握手过程（TLS 1.2）**：

```
Client → Server：Client Hello（支持的加密套件、随机数 C）
Server → Client：Server Hello（选定的套件、随机数 S、证书）
Client：验证证书（CA 签名验证）
Client → Server：Pre-Master Secret（用服务端公钥加密）
双方：用 C + S + Pre-Master 生成 Session Key（对称密钥）
后续通信：用 Session Key 加密
```

**为什么用非对称 + 对称组合**：非对称加密安全但慢，对称加密快但密钥传输不安全。TLS 用非对称加密传递对称密钥，后续通信用对称加密。

**证书链**：

```
根 CA（内置浏览器）→ 中间 CA → 服务器证书
验证时从服务器证书开始，逐层用上级公钥验证签名，直到根 CA
```

---

### 4.5 TCP 三次握手 / 四次挥手

**三次握手**：

```
Client → Server：SYN（seq=x）
Server → Client：SYN+ACK（seq=y, ack=x+1）
Client → Server：ACK（ack=y+1）
```

**为什么是三次不是两次**：两次握手只能确认客户端→服务端方向通畅，三次才能确认双向都通。防止历史连接请求延迟到达导致错误建立连接。

**四次挥手**：

```
Client → Server：FIN（我要关闭发送）
Server → Client：ACK（收到，等我处理完）
Server → Client：FIN（我也处理完了）
Client → Server：ACK（好的）
→ Client 等待 2MSL 后关闭（TIME_WAIT）
```

**TIME_WAIT 的作用**：确保最后一个 ACK 送达（如果 Server 没收到会重发 FIN，Client 需要在 2MSL 内能响应）。

---

### 4.6 跨域与 CORS

**同源策略**：协议 + 域名 + 端口 三者完全相同才算同源。

**CORS 响应头**：

```
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true   ← 允许携带 Cookie
Access-Control-Max-Age: 86400            ← 预检结果缓存时间
```

**简单请求 vs 预检请求**：

```
简单请求（直接发）：
  方法：GET / POST / HEAD
  Content-Type：text/plain / multipart/form-data / application/x-www-form-urlencoded

预检请求（先 OPTIONS）：
  其他方法（PUT/DELETE）或 JSON Content-Type
  浏览器先发 OPTIONS，服务端允许后才发真实请求
```

**其他解决跨域的方法**：

```
1. Nginx 反向代理（生产环境最常用）
2. JSONP（只支持 GET，已淘汰）
3. PostMessage（跨页面/iframe 通信）
4. WebSocket（协议不同，无跨域限制）
```

---

### 4.7 从输入 URL 到页面展示

```
1. URL 解析（协议/域名/路径/参数）
2. DNS 查询
   缓存查询：浏览器缓存 → OS 缓存 → 本地 hosts → DNS 服务器
   递归/迭代查询：根DNS → 顶级域DNS → 权威DNS → 返回 IP
3. 建立 TCP 连接（三次握手）
4. TLS 握手（HTTPS）
5. 发送 HTTP 请求
6. 服务端处理，返回响应
7. 浏览器解析 HTML
   解析 HTML → 构建 DOM 树
   解析 CSS → 构建 CSSOM 树
   DOM + CSSOM → Render Tree
   Layout（计算位置大小）
   Paint（绘制）
   Composite（合成，交给 GPU）
8. 执行 JS（可能修改 DOM/CSSOM，触发重排重绘）
```

---

## 五、浏览器原理与性能优化

### 5.1 重排（Reflow）与重绘（Repaint）

**重排**（Layout）：元素的几何属性改变（位置、尺寸），影响布局，需要重新计算所有受影响元素的位置。

**触发重排的操作**：
- 改变 `width/height/margin/padding/border`
- 读取 `offsetWidth/offsetHeight/getBoundingClientRect()`（强制刷新布局）
- 添加/删除 DOM 元素
- 字体大小、内容变化

**重绘**：元素外观变化但不影响布局（`color/background/visibility`）。

**性能规则**：
- 重排必然触发重绘，重绘不一定触发重排
- 用 `transform/opacity` 代替改变位置/透明度（走合成层，不触发重排重绘）
- 批量 DOM 操作：用 `DocumentFragment` 或先 `display:none`，操作完再显示
- 避免频繁读取会触发重排的属性，用变量缓存

---

### 5.2 前端性能优化

**加载优化**：

```
1. 资源压缩：gzip/brotli 压缩（服务端配置）
2. 图片优化：WebP 格式、懒加载（IntersectionObserver）、雪碧图
3. CDN：静态资源走 CDN，就近访问
4. 代码分割：路由懒加载（React.lazy / Vue import()）
5. 预加载：
   <link rel="preload" href="critical.css" as="style">
   <link rel="prefetch" href="next-page.js">
6. HTTP/2 多路复用，减少请求队头阻塞
```

**渲染优化**：

```
1. CSS 放 <head>，JS 放 <body> 底部或 defer/async
2. 避免频繁重排（transform 替代 top/left）
3. 长列表虚拟滚动（只渲染可视区域）
4. Web Worker 处理 CPU 密集任务（不阻塞主线程）
5. requestAnimationFrame 替代 setTimeout 做动画
```

**`defer` vs `async`**：

```
<script>         → 下载时阻塞 HTML 解析，下载完立即执行
<script defer>   → 并行下载，HTML 解析完后、DOMContentLoaded 前执行，顺序保证
<script async>   → 并行下载，下载完立即执行，顺序不保证（适合无依赖的独立脚本）
```

---

### 5.3 安全：XSS / CSRF

**XSS（跨站脚本攻击）**：

```
存储型：恶意脚本存入数据库，用户访问时执行
反射型：URL 参数中注入脚本，服务端反射到响应中
DOM型：JS 直接操作 DOM 注入脚本

防御：
  1. 输入转义（HTML 实体编码：< > " ' &）
  2. CSP（Content-Security-Policy）限制脚本来源
  3. HttpOnly Cookie（JS 无法读取）
  4. 不用 innerHTML/document.write，用 textContent
```

**CSRF（跨站请求伪造）**：

```
原理：用户登录 A 站，在 B 站点击链接，B 站偷偷向 A 站发请求，携带 Cookie

防御：
  1. CSRF Token（服务端生成随机 token，表单/请求头带上，服务端验证）
  2. SameSite Cookie（Lax/Strict 限制第三方携带 Cookie）
  3. Referer / Origin 验证（有局限）
  4. 重要操作要求二次验证
```

---

### 5.4 Web Storage / Cookie 对比

| | Cookie | localStorage | sessionStorage | IndexedDB |
|--|--------|-------------|----------------|----------|
| **大小** | 4KB | 5MB | 5MB | 理论无限 |
| **服务端访问** | ✅（随请求发送）| ❌ | ❌ | ❌ |
| **有效期** | 可设置 | 永久 | 标签页关闭清除 | 永久 |
| **跨标签页** | ✅ | ✅ | ❌ | ✅ |
| **异步** | 同步 | 同步 | 同步 | 异步 |

---

## 六、小程序

### 6.1 双线程架构

微信小程序运行在两个独立的线程中：

```
渲染层（WebView）
  ├─ 负责页面渲染（WXML + WXSS）
  └─ 每个页面一个 WebView

逻辑层（JS Engine，JavascriptCore/V8）
  ├─ 负责 JS 业务逻辑
  └─ 所有页面共用一个 JS 环境

两者通过 Native Bridge（微信客户端）通信
渲染层 ←→ Native Bridge ←→ 逻辑层
```

**为什么用双线程**：
- 安全：逻辑层无法直接操作 DOM，防止恶意操作
- 性能：渲染和逻辑分离，不互相阻塞（但通信有开销）

**双线程的限制**：
- 不能直接访问 DOM（用 `SelectorQuery` 代替）
- 不能使用 `window/document`
- 通信有延迟（`setData` 触发序列化 + Bridge 通信）

---

### 6.2 setData 性能优化

```javascript
// ❌ 不好：频繁 setData，每次都要 Bridge 通信
for (let i = 0; i < 100; i++) {
  this.setData({ count: i });
}

// ✅ 好：批量更新
this.setData({ count: 100 });

// ❌ 不好：setData 传大量数据
this.setData({ list: hugeList }); // 序列化开销大

// ✅ 好：只更新需要渲染的数据，其余存 this 上
this.bigList = hugeList;          // 不触发渲染
this.setData({ renderList: hugeList.slice(0, 20) }); // 只渲染可见部分

// ✅ 好：局部更新（路径赋值）
this.setData({ 'array[0].name': 'Tom' }); // 不用整个 array 重新传
```

---

### 6.3 小程序生命周期

**应用生命周期**：

```javascript
App({
  onLaunch(options) {},   // 小程序初始化（全局只触发一次）
  onShow(options) {},     // 切到前台
  onHide() {},            // 切到后台
  onError(msg) {},        // 报错
})
```

**页面生命周期**：

```javascript
Page({
  onLoad(options) {},    // 页面加载（只一次，适合请求数据）
  onShow() {},           // 页面显示（每次显示都触发）
  onReady() {},          // 首次渲染完成（适合操作DOM）
  onHide() {},           // 页面隐藏
  onUnload() {},         // 页面卸载
  onPullDownRefresh() {},// 下拉刷新
  onReachBottom() {},    // 上拉触底
  onPageScroll(e) {},    // 页面滚动
})
```

**页面栈**：最多 10 层，超出无法 `navigateTo`，需要用 `redirectTo`。

---

### 6.4 小程序登录流程

```
1. 前端：wx.login() → code（临时凭证，5分钟有效）
2. 前端：把 code 发给自己的服务端
3. 服务端：用 code + appid + secret 请求微信 API
   GET https://api.weixin.qq.com/sns/jscode2session
4. 微信返回：openid + session_key
5. 服务端：生成自定义登录态（token），存入缓存（如 Redis）
6. 返回 token 给前端
7. 前端：wx.setStorageSync('token', token)，后续请求携带

注意：
  - openid：用户在该小程序的唯一标识
  - unionid：用户在同一开放平台账号下的唯一标识（需绑定开放平台）
  - session_key 不要传给前端！用于解密用户敏感数据
```

---

### 6.5 小程序优化

```
1. 分包加载：
   主包 < 2MB，总包 < 20MB
   按页面/功能拆分分包，按需下载

2. 图片优化：
   CDN 图片，webp 格式
   图片懒加载（image lazy-load 属性）

3. 骨架屏：首屏数据返回前展示占位骨架

4. 缓存策略：
   wx.setStorage 缓存接口数据
   用户打开时先显示缓存，再请求更新

5. 长列表：虚拟列表或分页加载，避免一次渲染大量节点
```

---

## 七、工程化（Webpack / Vite）

### 7.1 Webpack 核心概念

```javascript
module.exports = {
  entry: './src/index.js',      // 入口
  output: { path: 'dist', filename: '[name].[contenthash].js' },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      // css-loader：处理 @import 和 url()
      // style-loader：注入到 <style> 标签
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './index.html' }),
    new MiniCssExtractPlugin(),  // 提取 CSS 到文件
  ],
  optimization: {
    splitChunks: {           // 代码分割
      chunks: 'all',
      cacheGroups: {
        vendors: { test: /node_modules/, name: 'vendors' }
      }
    }
  }
}
```

**Loader vs Plugin**：

- **Loader**：转换文件（非 JS 变为 JS），链式调用，从右到左
- **Plugin**：扩展构建功能（压缩、注入变量、提取文件），监听 Webpack 的生命周期钩子

---

### 7.2 Vite vs Webpack

| | Webpack | Vite |
|--|---------|------|
| **开发服务器** | 全量打包后启动（慢）| 基于原生 ESM，按需编译（快） |
| **HMR** | 更新整个模块图 | 只更新变化的模块（毫秒级）|
| **生产构建** | Webpack | Rollup |
| **配置复杂度** | 复杂 | 简单 |
| **旧浏览器支持** | 好 | 需要额外 polyfill |

**Vite 为什么开发时快**：

```
Webpack：
  启动时：打包全部模块 → 生成 bundle → 启动 DevServer
  HMR：某个文件改变 → 重新打包受影响的模块 → 推送给浏览器

Vite：
  启动时：直接启动 DevServer（近乎瞬间）
  请求时：浏览器请求哪个模块，才编译那个模块（原生 ESM import）
  HMR：某个文件改变 → 只通知浏览器刷新该模块（精准）
```

---

### 7.3 Tree Shaking

**条件**：
1. 使用 ES Module（`import/export`），而非 CommonJS（`require`）
2. 生产模式（Webpack `mode: 'production'`）
3. 代码没有副作用（`package.json` 中 `"sideEffects": false`）

**为什么 ES Module 才能 Tree Shaking**：ES Module 的 `import/export` 是静态的（编译时确定），工具可以分析依赖关系；CommonJS 的 `require` 是动态的（运行时执行），无法静态分析。

---

### 7.4 构建优化

```javascript
// 1. 分析打包结果
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// 2. 按需引入（替代全量引入）
import { Button } from 'antd';  // 配合 babel-plugin-import

// 3. 外部化大依赖（CDN 引入）
externals: { 'react': 'React', 'react-dom': 'ReactDOM' }

// 4. gzip 压缩
const CompressionPlugin = require('compression-webpack-plugin');

// 5. 图片压缩（image-minimizer-webpack-plugin）

// 6. 持久化缓存（Webpack 5）
cache: { type: 'filesystem' }
```

---

## 八、算法高频题

### 8.1 排序算法

**快速排序（平均 O(n log n)）**：

```javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left  = arr.filter(x => x < pivot);
  const mid   = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), ...mid, ...quickSort(right)];
}
```

**归并排序（稳定，O(n log n)）**：

```javascript
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) result.push(left[i++]);
    else result.push(right[j++]);
  }
  return [...result, ...left.slice(i), ...right.slice(j)];
}
```

---

### 8.2 链表高频题

**反转链表**：

```javascript
function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
```

**判断环形链表**（快慢指针）：

```javascript
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

**合并两个有序链表**：

```javascript
function mergeTwoLists(l1, l2) {
  const dummy = new ListNode(0);
  let curr = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next; }
    else { curr.next = l2; l2 = l2.next; }
    curr = curr.next;
  }
  curr.next = l1 || l2;
  return dummy.next;
}
```

---

### 8.3 二叉树高频题

**三种遍历（迭代）**：

```javascript
// 前序：根-左-右
function preorder(root) {
  const result = [], stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    result.push(node.val);
    stack.push(node.right);  // 先压右，后压左（栈后进先出）
    stack.push(node.left);
  }
  return result;
}

// 层序 BFS
function levelOrder(root) {
  if (!root) return [];
  const result = [], queue = [root];
  while (queue.length) {
    const size = queue.length;
    const level = [];
    for (let i = 0; i < size; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(level);
  }
  return result;
}
```

---

### 8.4 动态规划

**爬楼梯（Fibonacci 变体）**：

```javascript
function climbStairs(n) {
  if (n <= 2) return n;
  let [a, b] = [1, 2];
  for (let i = 3; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
```

**最长公共子序列（LCS）**：

```javascript
function longestCommonSubsequence(text1, text2) {
  const m = text1.length, n = text2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (text1[i-1] === text2[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
      else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[m][n];
}
```

**背包问题（0/1）**：

```javascript
function knapsack(weights, values, capacity) {
  const n = weights.length;
  const dp = new Array(capacity + 1).fill(0);
  for (let i = 0; i < n; i++) {
    // 从后往前，防止同一物品被选多次
    for (let j = capacity; j >= weights[i]; j--) {
      dp[j] = Math.max(dp[j], dp[j - weights[i]] + values[i]);
    }
  }
  return dp[capacity];
}
```

---

### 8.5 高频手写题

**数组扁平化**：

```javascript
// 递归
const flatten = (arr) =>
  arr.reduce((acc, val) =>
    Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);

// ES2019
arr.flat(Infinity);
```

**数组去重**：

```javascript
[...new Set(arr)]
arr.filter((v, i, a) => a.indexOf(v) === i)
```

**函数柯里化**：

```javascript
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function(...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

// 使用
const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);
curriedAdd(1)(2)(3); // 6
curriedAdd(1, 2)(3); // 6
```

**LRU 缓存**：

```javascript
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();  // Map 保持插入顺序
  }
  
  get(key) {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);  // 移到末尾（最近使用）
    return val;
  }
  
  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.capacity) {
      this.cache.delete(this.cache.keys().next().value);  // 删除最久未使用（第一个）
    }
    this.cache.set(key, value);
  }
}
```

---

## 九、复习计划

### 15 天冲刺计划

| 天数 | 内容 | 重点 |
|------|------|------|
| Day 1-2 | JavaScript 核心 | 原型链、闭包、this、事件循环 |
| Day 3 | 异步 | Promise 手写、async/await、面试题 |
| Day 4 | CSS | BFC、Flex、定位、响应式 |
| Day 5-6 | React | Hooks 原理、Fiber、性能优化 |
| Day 7 | Vue | 响应式原理（Proxy vs defineProperty）、生命周期 |
| Day 8-9 | 计算机网络 | HTTP 缓存、HTTPS、跨域、TCP |
| Day 10 | 浏览器 | 重排重绘、安全（XSS/CSRF）、性能优化 |
| Day 11 | 小程序 | 双线程、setData、登录流程 |
| Day 12 | 工程化 | Webpack/Vite 原理、Tree Shaking |
| Day 13 | 算法 | 排序、链表、树遍历 |
| Day 14 | 算法 | 动态规划、高频手写题 |
| Day 15 | 模拟面试 | 整体串联，重点复习薄弱点 |

### 每天复习方法

1. **早上**：先看今天的内容，理解原理
2. **中午**：手写 2-3 道代码题（不看答案）
3. **晚上**：复述今天内容（费曼学习法，说给自己听）
4. **睡前**：快速过一遍昨天的内容防止遗忘

### 面试答题技巧

1. **先说概念再说细节**：先给结论，再展开解释
2. **主动说优缺点和使用场景**：体现深度思考
3. **联系实际项目**：举自己项目中用到的例子（尤其是踩坑）
4. **不会的不要瞎猜**：说"这个我了解不深，但我知道大致原理是..."比乱答强

---

*创建日期：2026-04-03*
