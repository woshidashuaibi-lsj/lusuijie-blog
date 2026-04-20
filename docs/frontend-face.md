## 原型 & 原型链

每个对象有一个 `__proto__` 属性指向其构造函数的原型，也就是`prototype`。
当我查找这个对象的属性的时候，先从自身属性上查找，如果没有，我们就可以通过当前原型向上溯源，先从当前对象的构造函数的原型上查找，如果没有找到则继续想着当前构造函数的原型的`__proto__`上继续寻找，直到null为止，这个原型的链路就是原型链。

**proto** 属性是 JavaScript 中的内置属性，用于表示对象的原型。

**proto** 也可以用 Object.getPrototypeOf() 方法获取。

每个函数都有一个 prototype 属性，指向一个对象（原型对象）。每个对象都有一个 **proto** 属性（规范中用 [[Prototype]] 表示），指向创建它的构造函数的 prototype。
当访问对象的某个属性时，JS 引擎会先在对象自身属性上找，找不到就去 **proto**（即构造函数的原型）上找，还找不到就继续沿着原型的 **proto** 向上查找，直到 null 为止。这条链就是原型链。
所有普通对象的原型链最终都指向 Object.prototype，而 Object.prototype.**proto** 为 null，这是原型链的终点。

prototype 和 **proto** 的区别？

prototype 函数才有，是函数作为构造器时，实例的原型
proto 每个对象都有，指向该对象的原型

instanceof 的原理是什么？
instanceof 运算符用于判断一个对象是否属于某个构造函数创建的实例。原理是检查对象的原型链上是否存在构造函数的 prototype 属性。

```js
function myInstanceof(left, right) {
  let proto = Object.getPrototypeOf(left);
  while (proto) {
    if (proto === right.prototype) {
      return true;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

new操作符创建对象的过程：

1. 创建一个空对象
2. 将空对象的 **proto** 指向构造函数的 prototype
3. 将构造函数的 this 指向空对象
4. 返回空对象

```js
function myNew(func) {
  let obj = Object.create(func.prototype); // 创建对象，__proto__ 指向原型
  const result = func.call(obj); // 将构造函数的this 指向空对象
  return result instanceof Object ? result : obj; // 如果构造函数返回对象则用它，否则用 obj
}
// 最后尊重构造函数主动返回对象的意图，但忽略基本类型的返回。
```

Object.create(null) 和 {} 的区别
Object.create(null) 创建的对象没有原型链，是比较纯洁的对象。{} 创建的对象是有原型链的对象，是有比如toString(),hasOwnproperty方法的。

## 作用域与闭包

### 作用域（Scope）

作用域是指变量、函数可被访问的范围。JS 中有三种作用域：

- **全局作用域**：在任何函数外部声明的变量，整个脚本都能访问
- **函数作用域**：在函数内部声明的变量，只能在函数内部访问
- **块级作用域**：ES6 引入，用 `let` / `const` 声明的变量，只在 `{}` 块内有效

```js
var a = 1; // 全局作用域
function foo() {
  var b = 2; // 函数作用域
  if (true) {
    let c = 3; // 块级作用域
    const d = 4; // 块级作用域
  }
  // console.log(c); // ❌ 报错，c 在块外不可访问
}
```

**作用域链**：当查找一个变量时，JS 引擎先在当前作用域找，找不到就向上层作用域找，一直到全局作用域，这条查找链路就是作用域链。（注意：作用域链是在**函数定义时**确定的，即词法作用域）

---

### 闭包（Closure）

闭包是指**函数能够记住并访问其词法作用域**，即使该函数在其词法作用域之外执行。

简单说：**函数 + 它能访问的外部变量 = 闭包**

```js
function outer() {
  let count = 0;
  return function inner() {
    count++;
    console.log(count);
  };
}

const fn = outer();
fn(); // 1
fn(); // 2
fn(); // 3
// outer 已执行完，但 count 没有被销毁，因为 inner 保持了对它的引用
```

**闭包的作用：**

1. 数据私有化（封装变量，外部无法直接访问）
2. 保持变量持久存在（不被垃圾回收）
3. 函数工厂、柯里化等高阶函数场景

**闭包的缺点：**

- 变量不会被垃圾回收，**可能导致内存泄漏**，用完后应手动置 `null`

---

### 面试高频题

#### 1. 经典循环问题：下面输出什么？

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 输出：3 3 3
```

**原因**：`var` 没有块级作用域，三个 `setTimeout` 共享同一个 `i`，等执行时 `i` 已经是 3 了。

**解决方案一：用 `let`**

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 输出：0 1 2  ✅（let 每次循环创建独立的块级作用域）
```

**解决方案二：用闭包**

```js
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
// 输出：0 1 2  ✅（IIFE 为每次循环创建独立作用域，保存当前 i 的值）
```

---

#### 2. 闭包实现数据私有化

```js
function createCounter() {
  let count = 0; // 私有变量，外部无法直接访问
  return {
    increment() {
      count++;
    },
    decrement() {
      count--;
    },
    getCount() {
      return count;
    },
  };
}

const counter = createCounter();
counter.increment();
counter.increment();
console.log(counter.getCount()); // 2
// console.log(count); // ❌ ReferenceError: count is not defined
```

---

#### 3. 作用域链考题

```js
var x = 10;
function foo() {
  console.log(x); // 输出什么？
}
function bar() {
  var x = 20;
  foo();
}
bar(); // 输出 10
```

**原因**：JS 是**词法作用域**（静态作用域），`foo` 在定义时就确定了它的上层作用域是全局，而不是调用时的 `bar`，所以访问的是全局的 `x = 10`。

---

#### 4. 变量提升与暂时性死区（TDZ）

```js
console.log(a); // undefined（var 有变量提升）
var a = 1;

console.log(b); // ❌ ReferenceError（let 有 TDZ，声明前不可访问）
let b = 2;
```

- `var`：变量提升，初始值为 `undefined`
- `let` / `const`：存在暂时性死区（TDZ），声明前访问直接报错

---

#### 5. 闭包与内存泄漏

```js
function bindEvent() {
  const el = document.getElementById("btn");
  el.addEventListener("click", function () {
    console.log(el.id); // 闭包持有 el 引用
  });
}
```

上面的代码中，事件回调持有 `el` 的引用，`el` 又持有 DOM 节点，导致节点即使从 DOM 中移除也无法被垃圾回收。

**解决**：用完后手动解除引用，或将用到的值提前取出：

```js
function bindEvent() {
  const el = document.getElementById("btn");
  const id = el.id; // 只保存需要的值
  el.addEventListener("click", function () {
    console.log(id); // 不再持有 el 引用
  });
}
```

## this 指向

### 核心概念

`this` 是 JS 中的一个关键字，**不是在函数定义时确定，而是在函数调用时确定的**（箭头函数除外）。`this` 的值取决于函数的调用方式。

---

### 四种绑定规则（优先级从低到高）

#### 1. 默认绑定（独立调用）

函数直接调用时，`this` 指向全局对象（浏览器中是 `window`，严格模式下是 `undefined`）

```js
function foo() {
  console.log(this); // window（非严格模式）
}
foo();

("use strict");
function bar() {
  console.log(this); // undefined（严格模式）
}
bar();
```

#### 2. 隐式绑定（方法调用）

函数作为对象的方法调用时，`this` 指向调用它的对象

```js
const obj = {
  name: "maoyan",
  sayName() {
    console.log(this.name);
  },
};
obj.sayName(); // 'maoyan'，this 指向 obj
```

**隐式丢失**（常见陷阱）：把方法赋值给变量后调用，`this` 会丢失

```js
const fn = obj.sayName;
fn(); // undefined，this 变成了 window（严格模式报错）
```

#### 3. 显式绑定（call / apply / bind）

手动指定 `this` 的指向

```js
function greet(greeting) {
  console.log(`${greeting}, ${this.name}`);
}

const user = { name: "maoyan" };

greet.call(user, "Hello"); // Hello, maoyan
greet.apply(user, ["Hi"]); // Hi, maoyan
const boundFn = greet.bind(user);
boundFn("Hey"); // Hey, maoyan
```

三者区别：

- `call`：立即执行，参数逐个传入
- `apply`：立即执行，参数以**数组**传入
- `bind`：**不立即执行**，返回一个新函数，可稍后调用

#### 4. new 绑定（优先级最高）

用 `new` 调用构造函数时，`this` 指向新创建的对象

```js
function Person(name) {
  this.name = name;
}
const p = new Person("maoyan");
console.log(p.name); // 'maoyan'
```

---

### 箭头函数的 this（特殊）

箭头函数**没有自己的 `this`**，它的 `this` 继承自**定义时**所在的外层普通函数的 `this`，且无法被 `call/apply/bind` 改变。

```js
const obj = {
  name: "maoyan",
  sayName: function () {
    const inner = () => {
      console.log(this.name); // 继承外层 sayName 的 this，即 obj
    };
    inner();
  },
};
obj.sayName(); // 'maoyan'
```

```js
const obj2 = {
  name: "maoyan",
  sayName: () => {
    console.log(this.name); // ❌ 箭头函数定义在对象字面量中，外层是全局，this 是 window
  },
};
obj2.sayName(); // undefined
```

---

### 面试高频题

#### 1. 下面输出什么？（隐式丢失）

```js
const obj = {
  name: "maoyan",
  getName: function () {
    return this.name;
  },
};

const fn = obj.getName;
console.log(fn()); // undefined（this 变成 window，window.name 为空）
console.log(obj.getName()); // 'maoyan'
```

---

#### 2. 下面输出什么？（箭头函数 vs 普通函数）

```js
function Timer() {
  this.count = 0;

  // 普通函数：this 丢失
  setInterval(function () {
    this.count++; // this 是 window，不是 Timer 实例
    console.log(this.count); // NaN
  }, 1000);

  // 箭头函数：this 继承外层
  setInterval(() => {
    this.count++;
    console.log(this.count); // 1, 2, 3 ... ✅
  }, 1000);
}

new Timer();
```

---

#### 3. 手写 call / apply / bind

```js
// 手写 call
Function.prototype.myCall = function (context, ...args) {
  context = context || window;
  const key = Symbol(); // 用 Symbol 避免属性名冲突
  context[key] = this; // this 就是调用 myCall 的函数
  const result = context[key](...args);
  delete context[key];
  return result;
};

// 手写 bind
Function.prototype.myBind = function (context, ...args) {
  const fn = this;
  return function (...innerArgs) {
    return fn.apply(context, [...args, ...innerArgs]);
  };
};
```

---

#### 4. 优先级题：下面 this 指向谁？

```js
function foo() {
  console.log(this.name);
}

const obj1 = { name: "obj1", foo };
const obj2 = { name: "obj2", foo };

obj1.foo(); // 'obj1'（隐式绑定）
obj1.foo.call(obj2); // 'obj2'（显式绑定 > 隐式绑定）

function Bar() {
  foo.call(obj1); // 'obj1'（显式绑定在 new 内部也生效）
}
new Bar(); // 但 new 绑定 > 显式绑定（对 Bar 本身而言）
```

优先级：**new 绑定 > 显式绑定（call/apply/bind）> 隐式绑定 > 默认绑定**

---

#### 5. 下面 this 指向谁？（综合题）

```js
const name = "global";

const obj = {
  name: "obj",
  getName: function () {
    return () => this.name; // 箭头函数，this 继承 getName 的 this
  },
};

const arrow = obj.getName(); // getName 被 obj 调用，this 是 obj
console.log(arrow()); // 'obj' ✅

const detached = obj.getName;
const arrow2 = detached(); // detached() 直接调用，this 是 window
console.log(arrow2()); // 'global'（浏览器环境）
```

## 异步：Event Loop

### 核心概念

JS 是**单线程**语言，同一时间只能做一件事。但浏览器/Node 中有很多异步操作（网络请求、定时器、I/O 等），为了不阻塞主线程，JS 通过 **Event Loop（事件循环）** 机制来处理异步任务。

---

### 执行机制

JS 执行环境中有三个核心区域：

1. **调用栈（Call Stack）**：同步代码在这里执行，后进先出（LIFO）
2. **Web APIs**：浏览器提供的异步能力（`setTimeout`、`fetch`、DOM 事件等），异步任务在这里"等待"
3. **任务队列（Task Queue）**：异步任务完成后，回调函数排队等待进入调用栈

**Event Loop 的工作流程**：

> 调用栈清空 → 检查微任务队列，全部执行完 → 取一个宏任务执行 → 再检查微任务队列 → 循环往复

---

### 宏任务 vs 微任务

| 类型                    | 常见 API                                                                          |
| ----------------------- | --------------------------------------------------------------------------------- |
| **宏任务（MacroTask）** | `setTimeout`、`setInterval`、`setImmediate`、`I/O`、`UI渲染`                      |
| **微任务（MicroTask）** | `Promise.then/catch/finally`、`MutationObserver`、`queueMicrotask`、`async/await` |

**关键规则**：每次宏任务执行完毕后，会**清空所有微任务**，再执行下一个宏任务。

```
宏任务 → 清空所有微任务 → 宏任务 → 清空所有微任务 → ...
```

---

### 面试高频题

#### 1. 经典输出顺序题

```js
console.log("1");

setTimeout(() => {
  console.log("2");
}, 0);

Promise.resolve().then(() => {
  console.log("3");
});

console.log("4");

// 输出顺序：1 → 4 → 3 → 2
```

**分析：**

- `1`、`4`：同步代码，直接执行
- `3`：`Promise.then` 是微任务，同步执行完后立即执行
- `2`：`setTimeout` 是宏任务，最后执行

---

#### 2. 综合题（宏任务 + 微任务嵌套）

```js
console.log("start");

setTimeout(() => {
  console.log("timeout1");
  Promise.resolve().then(() => {
    console.log("promise in timeout1");
  });
}, 0);

setTimeout(() => {
  console.log("timeout2");
}, 0);

Promise.resolve().then(() => {
  console.log("promise1");
});

Promise.resolve().then(() => {
  console.log("promise2");
});

console.log("end");

// 输出：start → end → promise1 → promise2 → timeout1 → promise in timeout1 → timeout2
```

**分析：**

1. 同步：`start`、`end`
2. 清空微任务：`promise1`、`promise2`
3. 执行第一个宏任务（timeout1）：`timeout1`，产生新微任务
4. 清空微任务：`promise in timeout1`
5. 执行第二个宏任务（timeout2）：`timeout2`

---

#### 3. async / await 与 Event Loop

`async/await` 是 Promise 的语法糖，`await` 后面的代码相当于 `Promise.then` 的回调（微任务）。

```js
async function async1() {
  console.log("async1 start"); // 2
  await async2(); // 执行 async2，然后挂起，后续是微任务
  console.log("async1 end"); // 6（微任务）
}

async function async2() {
  console.log("async2"); // 3
}

console.log("script start"); // 1

setTimeout(() => {
  console.log("setTimeout"); // 8（宏任务）
}, 0);

async1();

new Promise((resolve) => {
  console.log("promise executor"); // 4（同步，executor 立即执行）
  resolve();
}).then(() => {
  console.log("promise then"); // 7（微任务）
});

console.log("script end"); // 5

// 输出：script start → async1 start → async2 → promise executor → script end
//       → async1 end → promise then → setTimeout
```

---

#### 4. setTimeout 最小延迟

```js
setTimeout(() => console.log("0ms"), 0);
// 实际并不是 0ms 后执行，而是至少 4ms（浏览器规范最小延迟）
// 且要等调用栈清空 + 所有微任务执行完才会执行
```

---

#### 5. Node.js 中的 Event Loop（扩展）

Node 中除了宏任务和微任务，还有 `process.nextTick`（比 Promise.then 优先级更高）和 `setImmediate`（类似 setTimeout(fn, 0)）：

```js
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));

// 输出：nextTick → promise → setTimeout/setImmediate（顺序不固定）
```

优先级：`process.nextTick` > `Promise.then` > `setImmediate` ≈ `setTimeout(fn, 0)`

同步代码
↓
process.nextTick（清空整个队列）
↓
Promise.then / async await（清空整个队列）
↓
timers 阶段（setTimeout / setInterval）
↓
[每个阶段之间都重复上面的 nextTick + 微任务清空]
↓
poll 阶段（I/O 回调）
↓
check 阶段（setImmediate）
↓
close callbacks 阶段（关闭回调）

---

### 一句话总结

> JS 单线程靠 Event Loop 处理异步：**同步代码先执行 → 清空微任务（Promise.then）→ 执行一个宏任务（setTimeout）→ 再清空微任务 → 循环**。

## Promise

### 核心概念

为什么有 Promise？
JS 是单线程的，通过异步回调来处理耗时任务（如网络请求）。但当异步操作存在串行依赖时，回调嵌套会越来越深，形成"回调地狱"，代码难以阅读和维护，错误处理也很分散。
Promise 的出现就是为了解决回调地狱的问题，它用链式调用替代了层层嵌套，统一了错误处理（.catch），让异步代码更线性、更易维护。后来 ES2017 的 async/await 又在 Promise 基础上进一步优化，让异步代码看起来和同步一样直观。

`Promise` 是 ES6 引入的异步编程解决方案，用来解决回调地狱（Callback Hell）问题。它代表一个**异步操作的最终结果**。

---

### 三种状态

Promise 有且只有三种状态，且**状态一旦改变就不可逆**：

| 状态                  | 说明                           |
| --------------------- | ------------------------------ |
| `pending`（进行中）   | 初始状态，既未成功也未失败     |
| `fulfilled`（已成功） | 操作成功完成，调用 `resolve()` |
| `rejected`（已失败）  | 操作失败，调用 `reject()`      |

```js
const p = new Promise((resolve, reject) => {
  // 异步操作
  setTimeout(() => {
    resolve("成功"); // pending → fulfilled
    // reject('失败'); // pending → rejected
  }, 1000);
});
```

---

### 常用 API

```js
// then：处理成功/失败
p.then(
  (res) => console.log(res),
  (err) => console.log(err),
);

// catch：专门处理失败（推荐，比 then 第二个参数更清晰）
p.catch((err) => console.log(err));

// finally：无论成功还是失败都执行，不接收参数
p.finally(() => console.log("结束"));
```

#### Promise 静态方法

```js
// all：全部成功才成功，有一个失败就失败
Promise.all([p1, p2, p3]).then(([r1, r2, r3]) => {});

// allSettled：全部完成（不管成功失败），返回每个结果的状态
Promise.allSettled([p1, p2]).then((results) => {
  // results: [{ status: 'fulfilled', value: ... }, { status: 'rejected', reason: ... }]
});

// race：谁先完成用谁（不管成功失败）
Promise.race([p1, p2]).then((res) => {});

// any：谁先成功用谁，全失败才 reject（ES2021）
Promise.any([p1, p2]).then((res) => {});
```

---

### 面试高频题

#### 1. 手写 Promise（简版）

```js
class MyPromise {
  constructor(executor) {
    this.status = "pending";
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.status === "pending") {
        this.status = "fulfilled";
        this.value = value;
        this.onFulfilledCallbacks.forEach((fn) => fn(value));
      }
    };

    const reject = (reason) => {
      if (this.status === "pending") {
        this.status = "rejected";
        this.reason = reason;
        this.onRejectedCallbacks.forEach((fn) => fn(reason));
      }
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (e) => {
            throw e;
          };

    return new MyPromise((resolve, reject) => {
      if (this.status === "fulfilled") {
        try {
          resolve(onFulfilled(this.value));
        } catch (e) {
          reject(e);
        }
      }
      if (this.status === "rejected") {
        try {
          resolve(onRejected(this.reason));
        } catch (e) {
          reject(e);
        }
      }
      if (this.status === "pending") {
        this.onFulfilledCallbacks.push((v) => {
          try {
            resolve(onFulfilled(v));
          } catch (e) {
            reject(e);
          }
        });
        this.onRejectedCallbacks.push((r) => {
          try {
            resolve(onRejected(r));
          } catch (e) {
            reject(e);
          }
        });
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }
}
```

---

#### 2. Promise 链式调用（then 返回值）

```js
Promise.resolve(1)
  .then((res) => {
    console.log(res); // 1
    return res + 1; // 返回普通值，下一个 then 收到 2
  })
  .then((res) => {
    console.log(res); // 2
    return Promise.resolve(res + 1); // 返回 Promise，等待其完成
  })
  .then((res) => {
    console.log(res); // 3
  });
```

**关键**：`then` 始终返回一个新的 Promise，链式调用不会丢失错误处理能力。

---

#### 3. Promise 错误捕获

```js
// ✅ 推荐：用 catch 统一捕获
Promise.resolve()
  .then(() => {
    throw new Error("出错了");
  })
  .then(() => console.log("不会执行"))
  .catch((err) => console.log(err.message)); // '出错了'

// ❌ then 内部的错误，then 第二个参数无法捕获同级 then 抛出的错误
Promise.reject("失败").then(
  (res) => console.log(res),
  (err) => console.log(err), // '失败'（只能捕获 reject，捕获不了上面 then 里的 throw）
);
```

---

#### 4. Promise.all vs Promise.allSettled

```js
const p1 = Promise.resolve(1);
const p2 = Promise.reject("error");
const p3 = Promise.resolve(3);

// all：一个失败就全部失败
Promise.all([p1, p2, p3])
  .then((res) => console.log(res))
  .catch((err) => console.log(err)); // 'error'

// allSettled：全部结束，不管成功失败
Promise.allSettled([p1, p2, p3]).then((res) => {
  console.log(res);
  // [
  //   { status: 'fulfilled', value: 1 },
  //   { status: 'rejected', reason: 'error' },
  //   { status: 'fulfilled', value: 3 }
  // ]
});
```

**使用场景**：需要知道所有请求的结果（不能因为一个失败中断）时用 `allSettled`，比如批量操作结果统计。

---

#### 5. 实现 Promise 并发控制

面试高频：**限制同时执行的 Promise 数量不超过 n 个**

```js
async function promisePool(tasks, limit) {
  const results = []; // 最终结果，按顺序存所有任务的 Promise
  const running = []; // 当前"跑道"上正在跑的任务（数量不超过 limit）

  for (const task of tasks) {
    // 第一步：启动这个任务，得到它的 Promise
    const p = task();
    results.push(p); // 先把结果占位存起来，不管它跑完没有

    // 第二步：给这个任务加一个"跑完后自动退出跑道"的钩子
    // finally 表示：不管成功还是失败，任务完成后都执行这个回调
    // 回调里做的事：把自己从 running 跑道上移除
    const taskWithCleanup = p.finally(() => {
      const index = running.indexOf(taskWithCleanup); // 找到自己在跑道上的位置
      running.splice(index, 1); // 从跑道上移除自己
    });

    // 第三步：把这个任务放上跑道
    running.push(taskWithCleanup);

    // 第四步：如果跑道满了，就等，直到有人跑完腾出位置
    if (running.length >= limit) {
      await Promise.race(running); // 等最快跑完的那个（它跑完会自动从 running 移除自己）
    }
  }

  // 等所有任务都完成，返回全部结果
  return Promise.all(results);
}
```

---

#### 6. async/await 是 Promise 的语法糖

```js
// Promise 写法
function fetchUser() {
  return fetch("/api/user")
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      return data;
    })
    .catch((err) => console.error(err));
}

// async/await 等价写法（更易读）
async function fetchUser() {
  try {
    const res = await fetch("/api/user");
    const data = await res.json();
    console.log(data);
    return data;
  } catch (err) {
    console.error(err);
  }
}
```

**注意**：`await` 只能用在 `async` 函数内部，`async` 函数始终返回一个 Promise。

---

#### 7. 手写 Promise.all / allSettled / race / any

**手写 Promise.all**

> 全部成功才 resolve，有一个 reject 就立即 reject

```js
Promise.myAll = function (promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let count = 0; // 记录成功的数量

    if (promises.length === 0) return resolve([]);

    promises.forEach((p, index) => {
      Promise.resolve(p)
        .then((val) => {
          results[index] = val; // 按顺序存结果，不能用 push（顺序会乱）
          count++;
          if (count === promises.length) {
            resolve(results); // 全部成功才 resolve
          }
        })
        .catch((err) => {
          reject(err); // 一个失败立即 reject
        });
    });
  });
};

// 测试
Promise.myAll([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3),
]).then(console.log); // [1, 2, 3]

Promise.myAll([
  Promise.resolve(1),
  Promise.reject("error"),
  Promise.resolve(3),
]).catch(console.log); // 'error'
```

---

**手写 Promise.allSettled**

> 全部完成（不管成功失败），返回每个结果的状态对象

```js
Promise.myAllSettled = function (promises) {
  return new Promise((resolve) => {
    const results = [];
    let count = 0;

    if (promises.length === 0) return resolve([]);

    promises.forEach((p, index) => {
      Promise.resolve(p)
        .then((val) => {
          results[index] = { status: "fulfilled", value: val };
        })
        .catch((err) => {
          results[index] = { status: "rejected", reason: err };
        })
        .finally(() => {
          count++;
          if (count === promises.length) {
            resolve(results); // 全部结束才 resolve，永不 reject
          }
        });
    });
  });
};

// 测试
Promise.myAllSettled([
  Promise.resolve(1),
  Promise.reject("error"),
  Promise.resolve(3),
]).then(console.log);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: 'error' },
//   { status: 'fulfilled', value: 3 }
// ]
```

---

**手写 Promise.race**

> 谁先完成（不管成功失败）就用谁的结果

```js
Promise.myRace = function (promises) {
  return new Promise((resolve, reject) => {
    promises.forEach((p) => {
      // 哪个先完成就先触发 resolve/reject，之后状态不可变，其他的忽略
      Promise.resolve(p).then(resolve).catch(reject);
    });
  });
};

// 测试
Promise.myRace([
  new Promise((resolve) => setTimeout(() => resolve("慢"), 200)),
  new Promise((resolve) => setTimeout(() => resolve("快"), 100)),
]).then(console.log); // '快'
```

---

**手写 Promise.any**

> 谁先**成功**就用谁，全部失败才 reject（ES2021）

```js
Promise.myAny = function (promises) {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    const errors = [];

    if (promises.length === 0) {
      return reject(new AggregateError([], "All promises were rejected"));
    }

    promises.forEach((p, index) => {
      Promise.resolve(p)
        .then((val) => {
          resolve(val); // 第一个成功立即 resolve
        })
        .catch((err) => {
          errors[index] = err;
          rejectedCount++;
          if (rejectedCount === promises.length) {
            // 全部失败才 reject，用 AggregateError 包装所有错误
            reject(new AggregateError(errors, "All promises were rejected"));
          }
        });
    });
  });
};

// 测试
Promise.myAny([
  Promise.reject("error1"),
  Promise.resolve("成功"),
  Promise.reject("error2"),
]).then(console.log); // '成功'

Promise.myAny([Promise.reject("error1"), Promise.reject("error2")]).catch(
  (err) => console.log(err.message),
); // 'All promises were rejected'
```

---

**四个方法对比总结**

| 方法         | 成功条件                 | 失败条件       | 使用场景                 |
| ------------ | ------------------------ | -------------- | ------------------------ |
| `all`        | 全部成功                 | 一个失败就失败 | 多个请求都需要成功       |
| `allSettled` | 全部完成（永不 reject）  | 无             | 需要知道每个结果，不中断 |
| `race`       | 第一个完成（成功或失败） | 第一个失败     | 超时控制、取最快结果     |
| `any`        | 第一个成功               | 全部失败       | 取最快成功的，容忍失败   |

---

### 一句话总结

> Promise 用**状态机**管理异步结果（pending → fulfilled/rejected），状态不可逆；`.then` 返回新 Promise 实现链式调用；`async/await` 是其语法糖，让异步代码看起来像同步。

## ES6+ 常考点

### 1. let / const / var 的区别

| 特性          | var                       | let               | const                         |
| ------------- | ------------------------- | ----------------- | ----------------------------- |
| 作用域        | 函数作用域                | 块级作用域        | 块级作用域                    |
| 变量提升      | ✅ 提升，初始值 undefined | ✅ 提升，但有 TDZ | ✅ 提升，但有 TDZ             |
| 重复声明      | ✅ 允许                   | ❌ 不允许         | ❌ 不允许                     |
| 重新赋值      | ✅ 允许                   | ✅ 允许           | ❌ 不允许（引用类型内部可改） |
| 挂载到 window | ✅                        | ❌                | ❌                            |

```js
// const 的引用类型内部可修改
const obj = { name: "maoyan" };
obj.name = "new name"; // ✅ 可以，修改的是属性
obj = {}; // ❌ 报错，不能重新赋值（改变引用）
```

**面试点**：`const` 保证的是**绑定不变**（指针不变），不是值不变。

---

### 2. 解构赋值

```js
// 数组解构
const [a, b, c = 3] = [1, 2]; // 支持默认值
console.log(a, b, c); // 1 2 3

// 对象解构 + 重命名
const { name: myName, age = 18 } = { name: "maoyan" };
console.log(myName, age); // 'maoyan' 18

// 函数参数解构（常见）
function greet({ name, age = 18 } = {}) {
  console.log(name, age);
}
greet({ name: "maoyan" }); // 'maoyan' 18

// 嵌套解构
const {
  a: { b: val },
} = { a: { b: 42 } };
console.log(val); // 42

// 交换变量（经典技巧）
let x = 1,
  y = 2;
[x, y] = [y, x];
console.log(x, y); // 2 1
```

---

### 3. 展开运算符 / 剩余参数（`...`）

```js
// 展开数组
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]

// 展开对象（浅拷贝）
const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 }; // { a: 1, b: 2, c: 3 }

// 后面的属性会覆盖前面的
const merged = { ...obj1, b: 99 }; // { a: 1, b: 99 }

// 剩余参数（收集多余参数）
function sum(first, ...rest) {
  return first + rest.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3, 4); // 10
```

**面试点**：展开运算符是**浅拷贝**，嵌套对象仍然是引用。

---

### 4. 模板字符串

```js
const name = "maoyan";
const age = 18;

// 基本用法
console.log(`我叫 ${name}，今年 ${age} 岁`);

// 支持表达式
console.log(`1 + 1 = ${1 + 1}`);

// 支持多行
const html = `
  <div>
    <p>${name}</p>
  </div>
`;

// 标签模板（高级用法，styled-components 用的就是这个）
function tag(strings, ...values) {
  return strings.reduce(
    (result, str, i) => result + str + (values[i] || ""),
    "",
  );
}
tag`Hello ${name}, age ${age}`; // 'Hello maoyan, age 18'
```

---

### 5. 箭头函数

```js
// 普通函数 vs 箭头函数
const add = (a, b) => a + b; // 单行，隐式返回
const getObj = () => ({ key: "val" }); // 返回对象要加括号
const fn = (x) => x * 2; // 单参数可省括号

// 与普通函数的核心区别
// 1. 没有自己的 this（继承外层）
// 2. 没有 arguments 对象
// 3. 不能用 new 调用（没有 prototype）
// 4. 不能用 call/apply/bind 改变 this

function Foo() {}
const Bar = () => {};
new Foo(); // ✅
new Bar(); // ❌ TypeError: Bar is not a constructor
```

---

### 6. Symbol

ES6 新增的**原始数据类型**，表示唯一的值，常用于对象属性的唯一 key。

```js
const s1 = Symbol("描述");
const s2 = Symbol("描述");
console.log(s1 === s2); // false，每个 Symbol 都是唯一的

// 用作对象的唯一属性键，避免属性名冲突
const ID = Symbol("id");
const user = { [ID]: 123, name: "maoyan" };
user[ID]; // 123
// Symbol 属性不会出现在 for...in 和 Object.keys() 中

// Symbol.for() 全局共享
const s3 = Symbol.for("shared");
const s4 = Symbol.for("shared");
console.log(s3 === s4); // true
```

**面试点**：Symbol 作为属性 key 不可枚举，可用于定义"私有"属性或避免库属性冲突。

---

### 7. Set 和 Map

**Set**：值的集合，**自动去重**，值唯一

```js
const set = new Set([1, 2, 2, 3, 3]);
console.log([...set]); // [1, 2, 3]

set.add(4);
set.has(2); // true
set.delete(1);
set.size; // 3

// 数组去重（最常见用法）
const arr = [1, 2, 2, 3];
const unique = [...new Set(arr)]; // [1, 2, 3]

// 两数组取交集
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);
const intersection = [...a].filter((x) => b.has(x)); // [2, 3]
```

**Map**：键值对集合，**键可以是任意类型**（普通对象的键只能是字符串/Symbol）

```js
const map = new Map();
map.set('name', 'maoyan');
map.set(123, 'number key');
map.set({}, 'object key'); // 对象也可以作为 key

map.get('name');  // 'maoyan'
map.has('name'); // true
map.size;        // 3

// 遍历
map.forEach((value, key) => console.log(key, value));
for (const [key, value] of map) { ... }
```

**Map vs Object**：

| 对比     | Object                    | Map              |
| -------- | ------------------------- | ---------------- |
| key 类型 | 字符串/Symbol             | 任意类型         |
| 有序性   | 不保证（整数 key 会排序） | 插入顺序         |
| 大小     | 需手动计算                | `.size` 直接获取 |
| 性能     | 频繁增删较慢              | 频繁增删更快     |

---

### 8. Proxy 与 Reflect

**Proxy**：对对象的访问进行**拦截和自定义**（Vue3 响应式原理）

```js
const handler = {
  get(target, key) {
    console.log(`访问了 ${key}`);
    return Reflect.get(target, key); // 用 Reflect 执行默认行为
  },
  set(target, key, value) {
    console.log(`设置 ${key} = ${value}`);
    return Reflect.set(target, key, value);
  },
};

const obj = new Proxy({ name: "maoyan" }, handler);
obj.name; // 触发 get，打印 "访问了 name"
obj.age = 18; // 触发 set，打印 "设置 age = 18"
```

**面试点**：Vue2 用 `Object.defineProperty` 做响应式，缺点是无法监听新增属性和数组下标；Vue3 改用 `Proxy`，可以拦截所有操作，更强大。

---

### 9. 可选链（`?.`）和 空值合并（`??`）（ES2020）

```js
const user = { profile: { name: "maoyan" } };

// 可选链：安全访问深层属性，遇到 null/undefined 直接返回 undefined
user?.profile?.name; // 'maoyan'
user?.address?.city; // undefined（不报错）
user?.getName?.(); // 安全调用方法

// 空值合并：只有左侧是 null 或 undefined 时才用右侧的默认值
const age = null ?? 18; // 18
const count = 0 ?? 100; // 0（0 不是 null/undefined，不触发）
const str = "" ?? "default"; // ''（空字符串也不触发）

// 与 || 的区别
const val1 = 0 || 100; // 100（0 是假值，触发）
const val2 = 0 ?? 100; // 0（0 不是 null/undefined，不触发）
```

---

### 10. 面试综合题

**题1：var/let/const 经典面试题**

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 3 3 3
}
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 0 1 2
}
```

**题2：下面输出什么？（解构 + 默认值）**

```js
const [a = 1, b = 2] = [undefined, null];
console.log(a, b); // 1 null
// undefined 触发默认值，null 不触发默认值
```

**题3：Set 去重的特殊情况**

```js
const set = new Set([NaN, NaN, undefined, undefined, null, null]);
console.log(set.size); // 3
// Set 中 NaN === NaN（特殊处理），undefined、null 也只保留一个
```

**题4：Map 和 WeakMap 的区别**

| 对比     | Map                   | WeakMap                               |
| -------- | --------------------- | ------------------------------------- |
| key 类型 | 任意类型              | 只能是对象                            |
| 垃圾回收 | 强引用，key 不会被 GC | 弱引用，key 对象被 GC 后自动清除      |
| 可枚举   | ✅ 可遍历             | ❌ 不可遍历                           |
| 使用场景 | 通用                  | 缓存、关联 DOM 节点数据（防内存泄漏） |

```js
// WeakMap 典型场景：给 DOM 节点附加数据，节点被移除后自动释放
const cache = new WeakMap();
const el = document.getElementById("btn");
cache.set(el, { clickCount: 0 }); // el 被删除后，cache 中的数据也会被 GC
```

## 深拷贝

### 核心概念：浅拷贝 vs 深拷贝

**浅拷贝**：只复制对象的第一层，嵌套的引用类型仍然共享同一个内存地址。

**深拷贝**：递归复制所有层级，新旧对象完全独立，互不影响。

```js
const obj = { name: "maoyan", info: { age: 18 } };

// 浅拷贝
const shallow = { ...obj };
shallow.name = "new"; // ✅ 不影响原对象
shallow.info.age = 99; // ❌ 影响原对象！info 是同一个引用

// 深拷贝
const deep = JSON.parse(JSON.stringify(obj));
deep.info.age = 99; // ✅ 不影响原对象
```

---

### 常见浅拷贝方式

```js
const obj = { a: 1, b: { c: 2 } };

Object.assign({}, obj);    // 浅拷贝
{ ...obj }                 // 展开运算符，浅拷贝
arr.slice()                // 数组浅拷贝
[...arr]                   // 数组展开，浅拷贝
Array.from(arr)            // 数组浅拷贝
```

---

### 深拷贝的几种方案

#### 方案一：`JSON.parse(JSON.stringify(obj))`（最简单但有缺陷）

```js
const obj = { a: 1, b: { c: 2 } };
const clone = JSON.parse(JSON.stringify(obj));
```

**缺陷：**

```js
const obj = {
  fn: function () {}, // ❌ 函数会丢失
  sym: Symbol("s"), // ❌ Symbol 会丢失
  undef: undefined, // ❌ undefined 会丢失
  date: new Date(), // ❌ Date 变成字符串
  reg: /abc/, // ❌ RegExp 变成 {}
  nan: NaN, // ❌ NaN 变成 null
  inf: Infinity, // ❌ Infinity 变成 null
};
// 也无法处理循环引用（直接报错）
const circular = {};
circular.self = circular;
JSON.stringify(circular); // ❌ TypeError: Converting circular structure
```

#### 方案二：`structuredClone()`（现代浏览器原生方法，推荐）

```js
const obj = {
  a: 1,
  b: { c: [1, 2, 3] },
  date: new Date(),
  reg: /abc/,
};

const clone = structuredClone(obj);
clone.b.c.push(4);
console.log(obj.b.c); // [1, 2, 3] ✅ 不受影响
```

**支持**：Date、RegExp、Map、Set、ArrayBuffer、循环引用等
**不支持**：函数、Symbol、DOM 节点

#### 方案三：手写递归深拷贝（面试必考）

```js
function deepClone(target, map = new WeakMap()) {
  // 基本类型和 null 直接返回
  if (target === null || typeof target !== "object") return target;

  // 处理循环引用：如果已经克隆过，直接返回缓存的结果
  if (map.has(target)) return map.get(target);

  // 处理特殊对象类型
  if (target instanceof Date) return new Date(target);
  if (target instanceof RegExp) return new RegExp(target);

  // 处理数组和普通对象
  const clone = Array.isArray(target) ? [] : {};

  // 存入 map，防止循环引用
  map.set(target, clone);

  // 递归拷贝每个属性
  for (const key in target) {
    if (target.hasOwnProperty(key)) {
      clone[key] = deepClone(target[key], map);
    }
  }

  return clone;
}
```

**测试：**

```js
const obj = {
  a: 1,
  b: { c: [1, 2, { d: 3 }] },
  date: new Date(),
  reg: /abc/gi,
};
// 循环引用测试
obj.self = obj;

const clone = deepClone(obj);
clone.b.c.push(99);

console.log(obj.b.c); // [1, 2, { d: 3 }] ✅ 不受影响
console.log(clone.self === clone); // true ✅ 循环引用正确处理
```

---

### 面试高频题

#### 1. 手写深拷贝的关键考点

面试官关注的三个点：

**① 能否处理基本类型**

```js
// 基本类型直接返回，不需要拷贝
if (typeof target !== "object" || target === null) return target;
```

**② 能否处理循环引用**

```js
// 用 WeakMap 缓存已拷贝的对象，防止死循环
const map = new WeakMap();
if (map.has(target)) return map.get(target);
map.set(target, clone);
```

**③ 能否处理特殊类型（Date、RegExp 等）**

```js
if (target instanceof Date) return new Date(target);
if (target instanceof RegExp) return new RegExp(target);
```

---

#### 2. 为什么用 WeakMap 而不是 Map？

```js
// WeakMap 的 key 是弱引用，当 target 对象没有其他引用时，
// GC 可以自动回收，避免内存泄漏
// Map 是强引用，即使外部已经没有对象的引用，Map 还持有，GC 无法回收
```

---

#### 3. 各方案对比

| 方案               | 函数     | Symbol   | undefined | Date       | RegExp   | 循环引用      | 性能 |
| ------------------ | -------- | -------- | --------- | ---------- | -------- | ------------- | ---- |
| `JSON`             | ❌丢失   | ❌丢失   | ❌丢失    | ❌变字符串 | ❌变`{}` | ❌报错        | 快   |
| `structuredClone`  | ❌不支持 | ❌不支持 | ✅        | ✅         | ✅       | ✅            | 较快 |
| 手写递归           | 可扩展   | 可扩展   | ✅        | ✅         | ✅       | ✅（WeakMap） | 较慢 |
| `lodash.cloneDeep` | ❌       | ✅       | ✅        | ✅         | ✅       | ✅            | 快   |

---

#### 4. 扩展：`Object.assign` 是浅拷贝还是深拷贝？

```js
const obj = { a: 1, b: { c: 2 } };
const clone = Object.assign({}, obj);

clone.b.c = 99;
console.log(obj.b.c); // 99 ❌ 影响了原对象，说明是浅拷贝

// Object.assign 只对第一层有效
clone.a = 100;
console.log(obj.a); // 1 ✅ 第一层不受影响
```

---

### 一句话总结

> 浅拷贝只复制第一层引用，深拷贝递归复制所有层级。面试手写深拷贝三个核心：**基本类型直接返回**、**WeakMap 处理循环引用**、**特殊类型单独处理（Date/RegExp）**。

## 1.8 防抖与节流

```javascript
// 防抖：最后一次触发后 delay ms 执行（搜索输入）
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流：每隔 interval ms 最多执行一次（scroll/resize）
function throttle(fn, interval) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}
```

---

---

## BFC（块格式化上下文）

### 核心概念

**BFC（Block Formatting Context，块格式化上下文）** 是 CSS 中一个独立的渲染区域，内部元素的布局不会影响外部，外部也不会影响内部。可以理解为一个**与外界隔离的独立容器**。

---

### 触发 BFC 的条件（满足任意一个即可）

```css
/* 常见触发方式 */
overflow: hidden / auto / scroll; /* 最常用 */
display: flex / inline-flex;
display: grid / inline-grid;
display: inline-block;
display: flow-root; /* 专门为触发 BFC 设计，推荐 */
position: absolute / fixed;
float: left / right;
```

---

### BFC 的四个核心特性

#### 特性一：BFC 内部的块元素垂直排列，相邻块元素 margin 会合并（塌陷）

```html
<!-- 两个 div 都在同一个 BFC（body）里，margin 发生合并 -->
<div style="margin-bottom: 20px">div1</div>
<div style="margin-top: 30px">div2</div>
<!-- 实际间距是 30px，不是 50px（取较大值） -->
```

**解决方案**：让其中一个 div 包裹在新的 BFC 容器里

```html
<div style="margin-bottom: 20px">div1</div>
<div style="overflow: hidden">
  <!-- 触发 BFC，隔离 margin -->
  <div style="margin-top: 30px">div2</div>
</div>
<!-- 实际间距是 50px ✅ -->
```

#### 特性二：BFC 区域不会与浮动元素重叠

```html
<div style="float: left; width: 100px; height: 100px; background: red;"></div>
<div style="background: blue;">
  <!-- 这个 div 会被浮动元素覆盖 -->
  我是普通文字
</div>

<!-- 触发 BFC 后，不再与浮动元素重叠，实现两栏布局 -->
<div style="float: left; width: 100px; height: 100px; background: red;"></div>
<div style="overflow: hidden; background: blue;">
  <!-- 触发 BFC -->
  我不会被覆盖了，自动占据剩余空间 ✅
</div>
```

#### 特性三：BFC 容器会包含其内部的浮动子元素（清除浮动）

```html
<!-- 父元素高度塌陷：子元素浮动，父元素高度为 0 -->
<div style="border: 1px solid red;">
  <div style="float: left; height: 100px;">浮动子元素</div>
</div>

<!-- 触发父元素 BFC，父元素高度被撑开 -->
<div style="border: 1px solid red; overflow: hidden;">
  <!-- 触发 BFC -->
  <div style="float: left; height: 100px;">浮动子元素</div>
</div>
<!-- 父元素高度变为 100px ✅ -->
```

#### 特性四：BFC 内部每个元素的 margin-left 紧贴容器的 border-left

---

### BFC 解决的三大经典问题

| 问题                                   | 解决方案                           |
| -------------------------------------- | ---------------------------------- |
| **margin 合并（塌陷）**                | 给其中一个元素套一层 BFC 容器      |
| **高度塌陷（浮动子元素撑不开父元素）** | 给父元素触发 BFC                   |
| **浮动元素覆盖普通元素**               | 给被覆盖元素触发 BFC，实现两栏布局 |

---

### 面试高频题

#### 1. 什么是 BFC？如何触发？

> BFC 是一个独立的渲染区域，内外布局互不影响。常见触发方式：`overflow: hidden`、`display: flex`、`position: absolute`、`float` 不为 none、`display: flow-root`（语义最清晰，专门触发 BFC）。

---

#### 2. margin 塌陷问题（父子之间）

```html
<!-- 问题：父元素没有 border/padding，子元素的 margin-top 会"逃出"到父元素外 -->
<div class="parent">
  <div class="child" style="margin-top: 50px">子元素</div>
</div>
<!-- 结果：不是子元素距父元素顶部 50px，而是父元素整体下移 50px -->
```

**解决方案：**

```css
/* 方案一：给父元素触发 BFC */
.parent {
  overflow: hidden;
}

/* 方案二：给父元素加 border 或 padding（隔断 margin） */
.parent {
  border-top: 1px solid transparent;
}
.parent {
  padding-top: 1px;
}
```

---

#### 3. 清除浮动的几种方式

```css
/* 方案一：触发父元素 BFC（推荐） */
.parent { overflow: hidden; }
.parent { display: flow-root; } /* 最语义化 */

/* 方案二：伪元素清除浮动（经典 clearfix） */
.clearfix::after {
  content: '';
  display: block;
  clear: both;
}

/* 方案三：在浮动元素后面加空 div */
<div style="clear: both"></div>
```

---

#### 4. 用 BFC 实现两栏布局

```html
<!-- 左边固定宽度浮动，右边 BFC 自适应 -->
<div class="container">
  <div class="left">左栏（固定宽度）</div>
  <div class="right">右栏（自适应）</div>
</div>
```

```css
.left {
  float: left;
  width: 200px;
}

.right {
  overflow: hidden; /* 触发 BFC，不与浮动元素重叠，自动占满剩余宽度 */
}
```

---

#### 5. `overflow: hidden` 的副作用 vs `display: flow-root`

```css
/* overflow: hidden 有副作用：超出内容会被裁剪 */
.parent {
  overflow: hidden;
} /* ❌ 下拉菜单、tooltip 等会被截断 */

/* display: flow-root 专门用于触发 BFC，无副作用 */
.parent {
  display: flow-root;
} /* ✅ 推荐，语义明确 */
```

---

### 一句话总结

> BFC 是独立的布局容器，内外互不影响。掌握三个应用场景：**清除浮动（解决高度塌陷）**、**防止 margin 合并**、**两栏布局（BFC 不与浮动重叠）**。

## 盒模型

content-box：width 是内容的宽，padding/border 往外加，盒子会变大。 border-box：width 是整个盒子的宽，padding/border 往里缩，盒子不变大。

```css
/* 标准盒模型（默认）：width = content 宽度 */
box-sizing: content-box;
/* 实际占地 = width + padding + border */

/* IE 盒模型（推荐全局设置）：width = content + padding + border */
box-sizing: border-box;
/* 实际占地 = width（更直观）*/
```

---

## Flex 布局

### 核心概念

Flexbox（弹性布局）是一维布局方案，专门解决**元素在容器中的排列、对齐、空间分配**问题。分为**容器属性**（作用在父元素）和**子项属性**（作用在子元素）两类。

```css
.container {
  display: flex; /* 开启 flex，子元素自动变为 flex item */
}
```

---

### 容器属性（父元素）

#### `flex-direction`：主轴方向

```css
flex-direction: row; /* 默认：水平从左到右 → */
flex-direction: row-reverse; /* 水平从右到左 ← */
flex-direction: column; /* 垂直从上到下 ↓ */
flex-direction: column-reverse; /* 垂直从下到上 ↑ */
```

#### `flex-wrap`：是否换行

```css
flex-wrap: nowrap; /* 默认：不换行，子项可能被压缩 */
flex-wrap: wrap; /* 换行，从上到下 */
flex-wrap: wrap-reverse; /* 换行，从下到上 */
```

#### `justify-content`：主轴对齐（水平方向）

```css
justify-content: flex-start; /* 默认：靠主轴起点 */
justify-content: flex-end; /* 靠主轴终点 */
justify-content: center; /* 居中 */
justify-content: space-between; /* 两端对齐，间距均分 */
justify-content: space-around; /* 每个元素两侧间距相等（两端有半格） */
justify-content: space-evenly; /* 所有间距完全相等 */
```

#### `align-items`：交叉轴对齐（垂直方向，单行）

```css
align-items: stretch; /* 默认：拉伸填满容器高度 */
align-items: flex-start; /* 靠交叉轴起点（顶部） */
align-items: flex-end; /* 靠交叉轴终点（底部） */
align-items: center; /* 垂直居中 */
align-items: baseline; /* 按文字基线对齐 */
```

#### `align-content`：多行时交叉轴对齐（需要 `flex-wrap: wrap`）

```css
align-content: flex-start; /* 多行靠顶 */
align-content: center; /* 多行整体居中 */
justify-content: space-between; /* 多行两端对齐 */
/* ... 与 justify-content 值相同 */
```

> `align-items` 控制**单行内**子项的垂直对齐；`align-content` 控制**多行之间**的间距。

---

### 子项属性（子元素）

#### `flex`：最重要的属性，是以下三个的简写

```css
flex: flex-grow flex-shrink flex-basis;
flex: 1; /* 等价于 flex: 1 1 0%，自动填满剩余空间 */
flex: auto; /* 等价于 flex: 1 1 auto */
flex: none; /* 等价于 flex: 0 0 auto，不伸缩 */
```

- **`flex-grow`**：剩余空间的**分配比例**（默认 0，不放大）
- **`flex-shrink`**：空间不足时的**收缩比例**（默认 1，会收缩）
- **`flex-basis`**：主轴方向的**初始大小**（默认 auto，取 width/height）

```css
/* 三个子项，比例 1:2:1 分配空间 */
.a {
  flex: 1;
}
.b {
  flex: 2;
}
.c {
  flex: 1;
}
```

#### `align-self`：覆盖父容器的 `align-items`

```css
.special {
  align-self: flex-end; /* 这个子项单独靠底部，其他不受影响 */
}
```

#### `order`：排列顺序（默认 0，值越小越靠前）

```css
.first {
  order: -1;
} /* 排到最前面 */
.last {
  order: 1;
} /* 排到最后面 */
```

---

### 面试高频题

#### 1. 水平垂直居中（最常考）

```css
/* 方案一：flex 居中（最简洁，推荐） */
.parent {
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
}

/* 方案二：flex + margin auto */
.parent {
  display: flex;
}
.child {
  margin: auto;
} /* auto margin 会吸收所有剩余空间 */

/* 方案三：绝对定位 + transform */
.parent {
  position: relative;
}
.child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 方案四：绝对定位 + margin auto（需要固定宽高） */
.child {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  width: 100px;
  height: 100px;
}
```

---

#### 2. `flex: 1` 是什么意思？

```css
flex: 1;
/* 等价于 */
flex-grow: 1; /* 有剩余空间就等比例放大 */
flex-shrink: 1; /* 空间不足就等比例缩小 */
flex-basis: 0%; /* 初始大小为 0，从 0 开始分配 */
```

常见用法：

```css
/* 左边固定，右边自适应 */
.left {
  width: 200px;
  flex-shrink: 0;
} /* 不允许收缩 */
.right {
  flex: 1;
} /* 占满剩余空间 */
```

---

#### 3. `flex-basis` vs `width` 的优先级？

```css
.item {
  width: 100px;
  flex-basis: 200px; /* flex-basis 优先级高于 width */
}
/* 实际初始大小是 200px（在 flex 容器中） */
```

优先级：`max-width/min-width` > `flex-basis` > `width`

---

#### 4. `space-between` vs `space-around` vs `space-evenly`

```
子项：[A]  [B]  [C]

space-between: |[A]----[B]----[C]|   两端无间距，中间均分
space-around:  |--[A]--[B]--[C]--|   每项两侧各半格（端部=中间一半）
space-evenly:  |---[A]---[B]---[C]---|  所有间距完全相等
```

---

#### 5. `flex-shrink` 的计算（加权收缩）

```css
.a {
  flex-basis: 200px;
  flex-shrink: 1;
}
.b {
  flex-basis: 300px;
  flex-shrink: 2;
}
/* 容器宽 400px，子项总宽 500px，需要收缩 100px */

/* 加权总量 = 200×1 + 300×2 = 800 */
/* a 收缩 = 100 × (200×1 / 800) = 25px → a 实际 175px */
/* b 收缩 = 100 × (300×2 / 800) = 75px → b 实际 225px */
```

`flex-shrink` 值越大 + `flex-basis` 越大，收缩越多（**按加权比例**，不是按数值直接比）。

---

#### 6. 用 flex 实现常见布局

**圣杯布局（三栏，中间自适应）：**

```css
.container {
  display: flex;
}
.left,
.right {
  width: 200px;
  flex-shrink: 0; /* 固定宽度不收缩 */
}
.main {
  flex: 1; /* 中间自适应 */
}
```

**底部固定（sticky footer）：**

```css
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1;
} /* 撑满剩余高度 */
footer {
  /* 自然在底部 */
}
```

---

### 一句话总结

> Flex 是一维布局，**父元素**用 `justify-content`（主轴）+ `align-items`（交叉轴）控制对齐，**子元素**用 `flex: grow shrink basis` 控制伸缩。面试重点：水平垂直居中、`flex:1` 的含义、`flex-basis` vs `width` 优先级。

## 2.5 定位

```
static：默认，无定位
relative：相对自身原位偏移，仍占位
absolute：相对最近的 非static 祖先定位，脱离文档流
fixed：相对视口，脱离文档流
sticky：相对定位 + 滚动到阈值后变 fixed（导航栏吸顶）
```

## CSS 动画

### 两种实现方式

CSS 动画有两种核心方案：

|          | `transition`（过渡）                     | `animation`（动画）    |
| -------- | ---------------------------------------- | ---------------------- |
| 触发方式 | 需要状态变化触发（如 hover、class 切换） | 自动播放，无需触发     |
| 控制能力 | 简单，只有开始和结束两个状态             | 复杂，可定义多个关键帧 |
| 循环播放 | ❌ 不支持                                | ✅ 支持                |
| 适用场景 | 简单交互效果                             | 复杂序列动画           |

---

### `transition`（过渡）

```css
/* 语法：transition: 属性 时长 缓动函数 延迟; */
.box {
  width: 100px;
  background: blue;
  transition: all 0.3s ease 0s;

  /* 也可以分开写多个属性 */
  transition:
    width 0.3s ease,
    background 0.5s linear;
}

.box:hover {
  width: 200px;
  background: red;
}
```

**常用缓动函数：**

```css
transition-timing-function: ease; /* 默认：慢-快-慢 */
transition-timing-function: linear; /* 匀速 */
transition-timing-function: ease-in; /* 慢进快出 */
transition-timing-function: ease-out; /* 快进慢出 */
transition-timing-function: ease-in-out; /* 慢进慢出 */
transition-timing-function: cubic-bezier(
  0.25,
  0.1,
  0.25,
  1
); /* 自定义贝塞尔曲线 */
```

---

### `animation`（动画）+ `@keyframes`

```css
/* 第一步：定义关键帧 */
@keyframes slideIn {
  0% {
    transform: translateX(-100px);
    opacity: 0;
  }
  60% {
    transform: translateX(10px);
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 第二步：使用动画 */
.box {
  animation: slideIn 0.5s ease-out forwards;
  /*         名称    时长  缓动    填充模式 */
}

/* 完整写法 */
.box {
  animation-name: slideIn;
  animation-duration: 0.5s;
  animation-timing-function: ease-out;
  animation-delay: 0.2s; /* 延迟 */
  animation-iteration-count: 3; /* 播放次数，infinite 为无限 */
  animation-direction: alternate; /* 播放方向：alternate 正反交替 */
  animation-fill-mode: forwards; /* 结束后保持最后状态 */
  animation-play-state: running; /* running / paused 暂停控制 */
}
```

**`animation-fill-mode` 详解：**

```css
fill-mode: none; /* 默认：结束后回到初始状态 */
fill-mode: forwards; /* 结束后保持最后一帧 */
fill-mode: backwards; /* 延迟期间就应用第一帧 */
fill-mode: both; /* forwards + backwards 都生效 */
```

---

### `transform`（变换）

`transform` 本身不是动画，但和 `transition`/`animation` 配合是性能最优的动画方式。

```css
.box {
  /* 位移 */
  transform: translateX(100px) translateY(50px);
  transform: translate(100px, 50px); /* 简写 */

  /* 缩放 */
  transform: scale(1.5); /* 等比放大 1.5 倍 */
  transform: scaleX(2); /* 只缩放 X 轴 */

  /* 旋转 */
  transform: rotate(45deg); /* 顺时针旋转 45° */
  transform: rotateY(180deg); /* 绕 Y 轴旋转（翻牌效果） */

  /* 倾斜 */
  transform: skew(30deg, 10deg);

  /* 多个变换叠加（从右往左执行！） */
  transform: translateX(100px) rotate(45deg) scale(1.2);
}
```

---

### 面试高频题

#### 1. `transition` 和 `animation` 的区别？

> - `transition` 需要**事件触发**（hover、JS 改 class），只有两个状态；`animation` 自动播放，可有任意多个关键帧
> - `transition` 不能循环，`animation` 支持 `infinite` 无限循环
> - `animation` 功能更强大，可控制每一帧、暂停、延迟等

---

#### 2. 为什么用 `transform` 而不是 `top/left` 做动画？（性能关键题）

```css
/* ❌ 性能差：改变 top/left 会触发重排（reflow）→ 重绘（repaint） */
.box {
  position: absolute;
  top: 0;
}
.box:hover {
  top: 100px;
}

/* ✅ 性能好：transform 只触发合成（composite），不触发重排重绘 */
.box {
  transform: translateY(0);
}
.box:hover {
  transform: translateY(100px);
}
```

**浏览器渲染流程：**

```
JS → Style → Layout（重排）→ Paint（重绘）→ Composite（合成）
```

- `top/left/width/height` 改变 → 触发 **Layout（重排）**，性能最差
- `color/background` 改变 → 触发 **Paint（重绘）**，性能次之
- `transform/opacity` 改变 → 只触发 **Composite（合成）**，性能最好 ✅

`transform` 和 `opacity` 会被提升到**独立的合成层（GPU 加速）**，不影响其他元素渲染。

---

#### 3. 如何用 CSS 实现常见动画效果？

**无限旋转 loading：**

```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading {
  animation: spin 1s linear infinite;
}
```

**渐入淡出：**

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.element {
  animation: fadeIn 0.4s ease-out forwards;
}
```

**心跳跳动：**

```css
@keyframes heartbeat {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
}

.heart {
  animation: heartbeat 0.8s ease-in-out infinite;
}
```

---

#### 4. `will-change` 的作用？

```css
/* 提前告诉浏览器该元素要做变换，让它提前创建合成层（GPU 加速） */
.box {
  will-change: transform, opacity;
}
/* ⚠️ 不要滥用：每个合成层都消耗内存，只对真正需要动画的元素使用 */
```

---

#### 5. JS 控制 CSS 动画

```js
const el = document.querySelector(".box");

// 暂停 / 恢复动画
el.style.animationPlayState = "paused";
el.style.animationPlayState = "running";

// 监听动画结束
el.addEventListener("animationend", () => {
  console.log("动画结束");
});

// 监听过渡结束
el.addEventListener("transitionend", () => {
  console.log("过渡结束");
});

// 重置动画（先移除再添加 class）
el.classList.remove("animate");
void el.offsetWidth; // 强制回流，让浏览器"刷新"状态
el.classList.add("animate");
```

---

### 一句话总结

> CSS 动画两种方式：`transition` 适合简单交互触发的状态过渡，`animation + @keyframes` 适合复杂多帧自动播放动画。性能优化核心：**用 `transform/opacity` 替代 `top/left/width` 做动画，只触发合成层，不触发重排重绘**。

## 响应式布局

### 核心概念

响应式布局（Responsive Design）是指网页能够根据**不同屏幕尺寸、设备类型**自动调整布局和样式，提供最佳的视觉体验。

核心思想：**同一套代码，适配手机、平板、PC 三端。**

---

### 核心技术

#### 1. `viewport` 元标签（基础，必须有）

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

- `width=device-width`：让视口宽度等于设备物理宽度
- `initial-scale=1.0`：初始缩放比例为 1

**没有这行，移动端会默认以 980px 宽度渲染，页面会缩小变形。**

---

#### 2. 媒体查询（Media Query）

```css
/* 移动优先（推荐）：从小屏写起，大屏用 min-width 覆盖 */
.container {
  width: 100%; /* 手机：全宽 */
}

@media (min-width: 768px) {
  .container {
    width: 750px; /* 平板 */
  }
}

@media (min-width: 1200px) {
  .container {
    width: 1170px; /* PC */
  }
}

/* 也可以组合条件 */
@media (min-width: 768px) and (max-width: 1199px) {
  /* 只在平板生效 */
}

/* 针对打印 */
@media print {
  .sidebar {
    display: none;
  }
}
```

**常见断点（Bootstrap 参考）：**

| 设备   | 断点     |
| ------ | -------- |
| 手机   | < 576px  |
| 平板   | ≥ 768px  |
| PC 小  | ≥ 992px  |
| PC 大  | ≥ 1200px |
| 超宽屏 | ≥ 1400px |

---

#### 3. 相对单位

```css
/* rem：相对根元素（html）的字体大小 */
html {
  font-size: 16px;
}
.box {
  width: 10rem;
} /* 160px */

/* em：相对当前元素（或父元素）的字体大小 */
.parent {
  font-size: 20px;
}
.child {
  padding: 1em;
} /* 20px */

/* vw / vh：视口宽度/高度的百分比 */
.hero {
  height: 100vh;
} /* 满屏高 */
.banner {
  width: 50vw;
} /* 屏幕宽度的一半 */

/* %：相对父元素 */
.inner {
  width: 80%;
}

/* clamp()：响应式字体大小的终极方案 */
h1 {
  /* 最小 1rem，最大 3rem，中间根据视口线性变化 */
  font-size: clamp(1rem, 4vw, 3rem);
}
```

---

#### 4. Flex / Grid 自适应布局

```css
/* Flex 自动换行 */
.list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.list-item {
  flex: 1 1 200px; /* 最小 200px，可放大可缩小 */
}

/* Grid 自动适应列数（最常用的响应式 Grid） */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  /* auto-fill：尽量多放，minmax：每列最小 200px，最大平分剩余空间 */
  gap: 16px;
}
/* 不需要媒体查询，自动根据容器宽度决定列数 */
```

---

### 面试高频题

#### 1. `em` vs `rem` 的区别？

```css
html {
  font-size: 16px;
}

.parent {
  font-size: 20px;
  padding: 1em; /* 1em = 20px（相对自身或父元素） */
}

.child {
  font-size: 1rem; /* 1rem = 16px（永远相对 html） */
  padding: 1em; /* 1em = 16px（相对自身 font-size）*/
}
```

> `rem` 更可控，全局只改 `html` 的 `font-size` 即可缩放整个页面；`em` 会层层继承，容易出问题。

---

#### 2. 移动端适配方案对比（工程化重点）

**方案一：`rem` + 动态设置根字体（传统方案）**

```js
// 根据屏幕宽度动态设置 html font-size
function setRem() {
  const designWidth = 375; // 设计稿宽度（通常 375 或 750）
  const htmlEl = document.documentElement;
  const screenWidth = htmlEl.clientWidth;
  // 1rem = 屏幕宽度 / 10（方便计算：375px 设计稿下 1rem = 37.5px）
  htmlEl.style.fontSize = screenWidth / 10 + "px";
}
setRem();
window.addEventListener("resize", setRem);
```

```css
/* 设计稿 375px，1rem = 37.5px */
/* 设计稿里某元素宽 150px → 150/37.5 = 4rem */
.box {
  width: 4rem;
}
```

**缺点**：需要手动换算 px → rem，繁琐。

---

**方案二：`postcss-pxtorem` 自动转换（现代工程化推荐）**

```js
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-pxtorem": {
      rootValue: 37.5, // 设计稿 375px 时，1rem = 37.5px
      propList: ["*"], // 所有属性都转换
      selectorBlackList: [".ignore-"], // 黑名单，不转换
    },
  },
};
```

```css
/* 写 px，构建时自动转 rem，不需要手动换算 */
.box {
  width: 150px;
} /* → 自动编译为 4rem */
```

---

**方案三：`vw/vh` 方案（更现代，无需 JS）**

```css
/* 设计稿 375px，1vw = 3.75px */
/* 设计稿里 150px → 150/3.75 = 40vw */
.box {
  width: 40vw;
}

/* 配合 postcss-px-to-viewport 自动转换 */
```

```js
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-px-to-viewport": {
      viewportWidth: 375, // 设计稿宽度
      unitPrecision: 5,
      viewportUnit: "vw",
      selectorBlackList: [],
      minPixelValue: 1,
      mediaQuery: false,
    },
  },
};
```

**优点**：不依赖 JS，纯 CSS 方案，配合 PostCSS 自动换算。

---

**方案四：Tailwind CSS 响应式（现代框架首选）**

```html
<!-- 移动优先，用前缀控制断点 -->
<div
  class="
  w-full          <!-- 手机：全宽 -->
  md:w-1/2        <!-- 平板(768px+)：半宽 -->
  lg:w-1/3        <!-- PC(1024px+)：三分之一 -->
  p-4 md:p-8      <!-- 内边距响应式 -->
  text-sm md:text-base lg:text-lg   <!-- 字体响应式 -->
"
></div>
```

**优点**：原子类，无需写媒体查询，构建时 Tree-shaking 去掉未用样式，性能极好。

---

#### 3. `1px` 问题（移动端高频）

**问题**：高清屏（DPR=2/3）上 CSS 的 `1px` 看起来会比设计稿的 1px 粗。

```
DPR（设备像素比）= 物理像素 / CSS 像素
DPR=2 时：CSS 1px = 物理 2px（看起来偏粗）
```

**解决方案：**

```css
/* 方案一：transform 缩放（推荐） */
.border-1px {
  position: relative;
}
.border-1px::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  transform: scale(0.5); /* DPR=2 缩放 0.5 */
  transform-origin: 0 0;
  box-sizing: border-box;
}

/* 方案二：媒体查询根据 DPR 设置 */
@media (-webkit-min-device-pixel-ratio: 2) {
  .border {
    border-width: 0.5px;
  }
}
@media (-webkit-min-device-pixel-ratio: 3) {
  .border {
    border-width: 0.333px;
  }
}
```

---

#### 4. 图片响应式

```html
<!-- srcset：根据屏幕分辨率选择合适图片 -->
<img
  src="image.jpg"
  srcset="image@2x.jpg 2x, image@3x.jpg 3x"
  alt="响应式图片"
/>

<!-- sizes + srcset：根据视口宽度选择合适尺寸 -->
<img
  srcset="small.jpg 480w, medium.jpg 800w, large.jpg 1200w"
  sizes="(max-width: 600px) 480px, (max-width: 900px) 800px, 1200px"
  src="large.jpg"
  alt="响应式图片"
/>

<!-- picture：不同屏幕加载不同格式/比例图片 -->
<picture>
  <source media="(max-width: 600px)" srcset="mobile.jpg" />
  <source media="(max-width: 1200px)" srcset="tablet.jpg" />
  <img src="desktop.jpg" alt="响应式图片" />
</picture>
```

```css
/* CSS 方式：图片不超出容器 */
img {
  max-width: 100%;
  height: auto;
}
```

---

#### 5. 现代工程化如何处理响应式？（综合题）

**推荐方案组合：**

```
设计稿（Figma/Sketch）
    ↓
PostCSS 自动转换 px → vw 或 rem（postcss-px-to-viewport / postcss-pxtorem）
    ↓
Tailwind CSS / CSS Modules 组件级样式隔离
    ↓
媒体查询断点统一在设计 token 中管理（如 Tailwind theme.screens）
    ↓
图片用 CDN + WebP 格式 + <picture> 标签响应式加载
```

**Tailwind CSS 断点配置（团队统一规范）：**

```js
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      sm: "576px",
      md: "768px",
      lg: "992px",
      xl: "1200px",
      "2xl": "1400px",
    },
  },
};
```

**Next.js / Nuxt 中的最佳实践：**

```jsx
// Next.js Image 组件：自动响应式 + WebP 转换 + 懒加载
import Image from "next/image";

<Image
  src="/banner.jpg"
  alt="banner"
  width={1200}
  height={600}
  sizes="(max-width: 768px) 100vw, 1200px"
  priority // 首屏图片优先加载
/>;
```

---

### 移动优先 vs 桌面优先

```css
/* ✅ 移动优先（推荐）：base 样式针对手机，用 min-width 逐步增强 */
.box {
  font-size: 14px;
}
@media (min-width: 768px) {
  .box {
    font-size: 16px;
  }
}
@media (min-width: 1200px) {
  .box {
    font-size: 18px;
  }
}

/* ❌ 桌面优先：base 样式针对 PC，用 max-width 逐步降级 */
.box {
  font-size: 18px;
}
@media (max-width: 1199px) {
  .box {
    font-size: 16px;
  }
}
@media (max-width: 767px) {
  .box {
    font-size: 14px;
  }
}
```

**为什么移动优先更好？**

- 移动设备是主流流量入口
- CSS 加载时默认样式更轻量（移动端先匹配）
- 更容易渐进增强，而非降级处理

---

### 一句话总结

> 响应式三板斧：**viewport 元标签 + 媒体查询 + 相对单位（rem/vw）**。现代工程化首选：**PostCSS 自动转换 px → vw，Tailwind CSS 响应式原子类，Next.js Image 组件自动优化**。移动端还要处理 1px 问题（transform scale 方案）和图片适配（srcset/picture）。

## Hero 背景图用了 background-attachment: fixed，产生视差效果，背景图不动、内容滚动

## 暗黑模式（Dark Mode）

### 核心概念

暗黑模式是现代 Web 应用的标配功能，有两种触发来源：

- **系统级**：用户在操作系统设置了深色模式，浏览器通过 `prefers-color-scheme` 媒体查询感知
- **手动切换**：用户在页面内点击按钮手动切换，结果需要持久化到 `localStorage`

---

### 实现方案对比

| 方案                         | 原理                            | 优点                 | 缺点           |
| ---------------------------- | ------------------------------- | -------------------- | -------------- |
| CSS 变量 + class 切换        | 在 `:root.dark` 下覆盖 CSS 变量 | 简单、性能好、无闪烁 | 需手动管理变量 |
| `data-theme` 属性            | `[data-theme="dark"]` 选择器    | 语义清晰             | 本质同上       |
| CSS `prefers-color-scheme`   | 纯媒体查询，无需 JS             | 自动跟随系统         | 无法手动覆盖   |
| Tailwind `darkMode: 'class'` | 配置后用 `dark:` 前缀类         | 开发体验好           | 需要 Tailwind  |

**当前博客采用方案：CSS 变量 + `html` 元素 `dark` class 切换**

---

### 第一步：定义 CSS 变量（亮色 / 暗色两套）

```css
/* globals.css */

/* 亮色主题（默认） */
:root {
  --background: #ffffff;
  --foreground: #171717;
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --text-color: #2c3e50;
  --border-color: #e1e8ed;
  --hover-color: #f8f9fa;
  --card-bg: #ffffff;
  --nav-bg: #ffffff;
  --shadow: rgba(0, 0, 0, 0.1);
}

/* 暗色主题：给 html 加 .dark class 即可覆盖 */
:root.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
  --primary-color: #4a90e2;
  --secondary-color: #64b5f6;
  --text-color: #ededed;
  --border-color: #333333;
  --hover-color: #1a1a1a;
  --card-bg: #111111;
  --nav-bg: #111111;
  --shadow: rgba(255, 255, 255, 0.1);
}

/* 自动跟随系统暗色模式（用户没有手动设置时生效） */
@media (prefers-color-scheme: dark) {
  :root:not(.dark) {
    /* 同上暗色变量... */
  }
}
```

**原理**：所有组件只使用 `var(--background)` 等语义化变量，切换主题只需切换变量值，组件样式无需改动。

---

### 第二步：View Transition API 实现过渡动画

```css
/* globals.css：禁用默认过渡，由 JS 控制动画 */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

/* 旧内容层级低 */
::view-transition-old(root) {
  z-index: 1;
}

/* 新内容在最上层展开 */
::view-transition-new(root) {
  z-index: 9999;
}
```

---

### 第三步：ThemeToggle 组件实现

```tsx
// ThemeToggle/index.tsx
const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);

  // 初始化：读取 localStorage 或跟随系统
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const isDarkBefore = document.documentElement.classList.contains("dark");

    // 持久化到 localStorage
    localStorage.setItem("theme", isDarkBefore ? "light" : "dark");

    // 检测浏览器是否支持 View Transition API
    const hasViewTransitions = "startViewTransition" in document;

    if (!hasViewTransitions) {
      // 降级：直接切换 class，无动画
      document.documentElement.classList.toggle("dark");
      return;
    }

    // 支持 View Transition：先切换 class，再执行圆形扩散动画
    const transition = document.startViewTransition(() => {
      document.documentElement.classList.toggle("dark");
    });

    transition.ready.then(() => {
      const { clientX, clientY } = event; // 鼠标点击坐标（作为圆心）
      // 计算圆形扩散的最大半径（覆盖整个屏幕的最远角）
      const endRadius = Math.hypot(
        Math.max(clientX, innerWidth - clientX),
        Math.max(clientY, innerHeight - clientY),
      );

      if (isDarkBefore) {
        // 暗 → 亮：新的亮色内容从点击处圆形展开
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${clientX}px ${clientY}px)`, // 起始：圆半径为 0
              `circle(${endRadius}px at ${clientX}px ${clientY}px)`, // 结束：圆覆盖全屏
            ],
          },
          {
            duration: 450,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      } else {
        // 亮 → 暗：旧的亮色内容从点击处圆形收缩消失
        document.documentElement.animate(
          {
            clipPath: [
              `circle(${endRadius}px at ${clientX}px ${clientY}px)`,
              `circle(0px at ${clientX}px ${clientY}px)`,
            ],
          },
          {
            duration: 450,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-old(root)",
          },
        );
        // 新的暗色内容淡入
        document.documentElement.animate(
          { opacity: [0, 1] },
          {
            duration: 450,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      }
    });
  };

  // SSR 期间不渲染，避免服务端/客户端不一致（hydration mismatch）
  if (!mounted) return <div className={styles.themeButton}></div>;

  return (
    <button onClick={toggleTheme} aria-label="切换主题">
      🌓
    </button>
  );
};
```

---

### 关键技术点解析

#### 1. `mounted` 状态防止 Hydration Mismatch

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true); // 只在客户端执行
}, []);

if (!mounted) return <div></div>; // 服务端渲染时返回空占位
```

**原因**：Next.js SSR 时服务端不知道用户的主题偏好，若直接渲染 `🌓` 图标，客户端 hydration 时 DOM 可能不一致，导致报错。用 `mounted` 保证只在客户端渲染实际内容。

---

#### 2. View Transition API（视图过渡 API）深度解析

**核心原理：浏览器自动截图 + 伪元素叠层**

截图是浏览器渲染引擎自动在内部完成的，把当前帧的渲染结果存成 GPU 纹理，挂到 ::view-transition-old/new 伪元素上。开发者无法手动调用这个过程，也拿不到这张"截图"，只能通过 CSS/JS 控制这两个伪元素的动画行为。

当调用 `document.startViewTransition(callback)` 时，浏览器在内部会执行以下步骤：

```
第一步：冻结当前页面，对当前 DOM 状态截图（生成旧快照）
    ↓
第二步：执行 callback（在这里修改 DOM，比如切换 .dark class）
    ↓
第三步：对新 DOM 状态截图（生成新快照）
    ↓
第四步：将两张截图叠加在 ::view-transition 伪元素层上
    ↓
第五步：默认执行淡入淡出动画（旧快照淡出，新快照淡入）
    ↓
第六步：动画结束，移除伪元素层，显示真实 DOM
```

```js
// startViewTransition 返回一个 ViewTransition 对象，有三个 Promise 属性
const transition = document.startViewTransition(() => {
  document.documentElement.classList.toggle("dark"); // 修改 DOM
});

transition.ready; // 截图完成、动画即将开始时 resolve → 此处自定义动画
transition.finished; // 动画完全结束时 resolve
transition.updateCallbackDone; // callback 执行完成时 resolve
```

**伪元素层级结构**（浏览器内部自动创建）：

```
::view-transition                          ← 覆盖全屏的透明容器
  └── ::view-transition-group(root)
        ├── ::view-transition-old(root)    ← 旧页面的截图（PNG 图片层）
        └── ::view-transition-new(root)    ← 新页面的截图（PNG 图片层）
```

```css
/* 浏览器默认给这两层加的动画（我们要覆盖它） */
::view-transition-old(root) {
  animation: fade-out 0.25s ease-out; /* 旧截图：淡出 */
}
::view-transition-new(root) {
  animation: fade-in 0.25s ease-in; /* 新截图：淡入 */
}

/* 本项目：禁用默认动画，改为自定义圆形扩散 */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none; /* 禁用默认的淡入淡出 */
  mix-blend-mode: normal; /* 禁用混合模式，防止颜色叠加异常 */
}
::view-transition-old(root) {
  z-index: 1;
} /* 旧截图在下层 */
::view-transition-new(root) {
  z-index: 9999;
} /* 新截图在最上层 */
```

**关键理解**：`::view-transition-old` 和 `::view-transition-new` 本质是两张全屏截图，叠在真实内容上面。我们通过 `clipPath` 控制新截图的可见区域，实现圆形扩散效果。

① 用户点击按钮前：
用户看到：亮色页面（真实 DOM）

② 调用 startViewTransition()：
浏览器截图 → 生成"旧截图"（亮色）

③ callback 执行：classList.toggle('dark')
DOM 真实变成暗色了！但用户还看不到...
浏览器再截图 → 生成"新截图"（暗色）

④ 两张截图叠上去，盖住真实 DOM：
用户看到：还是亮色（被旧截图盖住）

⑤ transition.ready → 我们开始执行动画：

[亮 → 暗] 的情况：
旧截图（亮色）：全屏 → 从鼠标处圆形收缩消失
新截图（暗色）：在下面，随着旧截图消失而逐渐露出来

⑥ 动画结束（450ms）：
两张截图都被移除
用户看到：真实 DOM（暗色）—— 就是第③步已经变好的

---

#### 3. 圆形扩散动画原理（`clipPath` + `circle()`）深度解析

**`clip-path: circle()` 语法：**

```css
/* circle(半径 at 圆心X 圆心Y) */
clip-path: circle(50px at 100px 200px);
/* 含义：以 (100px, 200px) 为圆心，只显示半径 50px 以内的内容，其余裁掉 */

clip-path: circle(0px at 300px 400px);
/* 半径为 0 → 什么都看不见 */

clip-path: circle(100% at center);
/* 半径足够大 → 全部可见（等同于无裁剪） */
```

**暗 → 亮（新的亮色从点击处"扩散"展开）：**

```js
// 新截图（亮色）初始半径为 0，从鼠标点逐渐扩散到覆盖全屏
document.documentElement.animate(
  {
    clipPath: [
      `circle(0px at ${clientX}px ${clientY}px)`, // 起始：圆半径为 0，完全不可见
      `circle(${endRadius}px at ${clientX}px ${clientY}px)`, // 结束：圆覆盖全屏，完全可见
    ],
  },
  {
    duration: 450,
    easing: "ease-in-out",
    pseudoElement: "::view-transition-new(root)", // 动画作用在新截图层上
  },
);

// 效果：新的亮色内容像水波一样，从鼠标点击位置向四周扩散展开 🌊
```

**亮 → 暗（旧的亮色从点击处"收缩"消失）：**

clip-path: circle(50px at 300px 400px) 的意思就是：
以 (300, 400) 为圆心，只保留半径 50px 以内的内容可见，其余全部隐藏

```js
// 旧截图（亮色）从全屏逐渐收缩到鼠标点消失
document.documentElement.animate(
  {
    clipPath: [
      `circle(${endRadius}px at ${clientX}px ${clientY}px)`, // 起始：覆盖全屏
      `circle(0px at ${clientX}px ${clientY}px)`, // 结束：收缩到消失
    ],
  },
  {
    duration: 450,
    easing: "ease-in-out",
    pseudoElement: "::view-transition-old(root)", // 动画作用在旧截图层上
  },
);
// 同时，新的暗色截图从不透明度 0 淡入
document.documentElement.animate(
  { opacity: [0, 1] },
  {
    duration: 450,
    easing: "ease-in-out",
    pseudoElement: "::view-transition-new(root)",
  },
);

// 效果：亮色内容像被鼠标"吸走"一样向点击处收缩消失，暗色淡入 🌑
```

**`endRadius` 的数学计算（面试重点）：**

```js
const { clientX, clientY } = event; // 鼠标点击位置（相对视口）

const endRadius = Math.hypot(
  Math.max(clientX, innerWidth - clientX), // 水平方向：鼠标到左边 vs 到右边，取较大值
  Math.max(clientY, innerHeight - clientY), // 垂直方向：鼠标到上边 vs 到下边，取较大值
);
```

**为什么这样算？**

```
假设屏幕 1200×800，鼠标点击在右上角 (1100, 50)：

水平方向：Math.max(1100, 1200-1100) = Math.max(1100, 100) = 1100
垂直方向：Math.max(50,  800-50)   = Math.max(50,  750) = 750

endRadius = Math.hypot(1100, 750) ≈ 1336px

→ 圆的半径 1336px，能覆盖从 (1100, 50) 出发的整个 1200×800 屏幕 ✅
```

```
核心思路：
- 鼠标点击位置到屏幕四个角的距离各不相同
- 我们需要圆半径 ≥ 鼠标到最远角的距离，才能保证圆覆盖全屏
- Math.hypot(a, b) = √(a² + b²)（勾股定理，计算两点距离）
- Math.max(clientX, innerWidth - clientX) → 取鼠标到左右两侧的较大值（即更远的那侧）
- 两个较大值组合 → 得到从该点出发覆盖全屏所需的最小半径
```

**完整动画时序图：**

```
用户点击 🌓 按钮
    ↓
startViewTransition() 被调用
    ↓
浏览器截图当前页面（快照A：旧主题）
    ↓
callback 执行：classList.toggle('dark')（DOM 已变更）
    ↓
浏览器截图新页面（快照B：新主题）
    ↓
transition.ready Promise resolve
    ↓
我们调用 element.animate() 对 ::view-transition-new(root) 执行 clipPath 动画
    ↓
[暗→亮]：新截图从 circle(0px) → circle(endRadius)，圆形扩散展开
[亮→暗]：旧截图从 circle(endRadius) → circle(0px)，圆形收缩消失
    ↓
动画结束（450ms）
    ↓
浏览器移除 ::view-transition 伪元素，显示真实 DOM（已是新主题）
```

---

#### 4. 优先级设计：手动 > 系统

```
用户行为                  localStorage 存储     html class
────────────────────────────────────────────────────────
从未设置                  null                  跟随 prefers-color-scheme
手动切换为暗色            'dark'                 加 .dark
手动切换为亮色            'light'                不加 .dark（即使系统是暗色）
```

```js
const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

// 手动设置优先，没有手动设置才跟随系统
if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
  document.documentElement.classList.add("dark");
}
```

---

### CSS 变量切换的底层原理：JS 如何操作

**问题：只维护一套样式，JS 是怎么做到切换主题的？**

核心只有一行代码：

```js
// 给 <html> 元素加上 / 去掉 'dark' class
document.documentElement.classList.add("dark"); // 开启暗色
document.documentElement.classList.remove("dark"); // 关闭暗色
document.documentElement.classList.toggle("dark"); // 来回切换
```

`document.documentElement` 就是 `<html>` 元素，加上 `dark` class 后，CSS 中的 `:root.dark` 选择器生效，变量值被覆盖：

```css
/* 亮色（默认）：:root 上的变量 */
:root {
  --background: #ffffff;
  --text-color: #2c3e50;
}

/* 暗色：html 上有 .dark class 时，覆盖同名变量 */
:root.dark {
  --background: #0a0a0a; /* 同名变量被覆盖 */
  --text-color: #ededed;
}
```

```css
/* 组件样式只引用变量名，不关心具体值 */
.card {
  background: var(--background); /* 亮色时 #ffffff，暗色时 #0a0a0a */
  color: var(--text-color); /* 亮色时 #2c3e50，暗色时 #ededed */
}
```

**变量覆盖的完整链路：**

```
JS: document.documentElement.classList.add('dark')
  ↓
HTML: <html class="dark">
  ↓
CSS: :root.dark { --background: #0a0a0a } 选择器命中，变量被覆盖
  ↓
所有用了 var(--background) 的地方自动更新颜色
  ↓
浏览器重新渲染（只触发重绘，不触发重排，性能好）
```

**也可以用 JS 直接修改变量值（动态主题色）：**

```js
// 直接修改 :root 上的 CSS 变量值
document.documentElement.style.setProperty("--background", "#0a0a0a");
document.documentElement.style.setProperty("--text-color", "#ededed");

// 读取变量值
const bg = getComputedStyle(document.documentElement).getPropertyValue(
  "--background",
); // '#ffffff'

// 批量修改（比如用户自定义主题色）
const darkTheme = {
  "--background": "#0a0a0a",
  "--text-color": "#ededed",
  "--primary-color": "#4a90e2",
};
Object.entries(darkTheme).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value);
});
```

---

### 暗黑模式下的特殊样式覆盖

**场景：某个组件在暗黑模式下不想用全局变量，需要单独定制**

**方法一：直接用 `:root.dark` 下的后代选择器（最简单）**

```css
/* 亮色下的卡片 */
.specialCard {
  background: #f5f5f5;
  border: 1px solid #ddd;
  color: #333;
}

/* 暗色下，单独给这个卡片设置完全不同的样式 */
:root.dark .specialCard {
  background: linear-gradient(
    135deg,
    #1a1a2e,
    #16213e
  ); /* 渐变背景，不用变量 */
  border: 1px solid #4a90e2; /* 蓝色描边 */
  color: #a8d8ea; /* 自定义字色 */
  box-shadow: 0 0 20px rgba(74, 144, 226, 0.3); /* 发光效果 */
}
```

**方法二：在 CSS Modules 中配合全局选择器（Next.js / React 项目常用）**

```css
/* Card.module.css */

.card {
  background: #f5f5f5;
  color: #333;
}

/* :global() 穿透 CSS Modules 的作用域，匹配全局的 .dark class */
:global(.dark) .card {
  background: #1a1a2e;
  color: #a8d8ea;
  border-color: #4a90e2;
}
```

**方法三：用 `@media` + `data-theme` 组合（更语义化）**

```css
/* 用 data-theme 属性替代 class，更语义化 */
[data-theme="dark"] .specialCard {
  background: #1c1c1e;
}

/* JS 切换方式 */
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.setAttribute('data-theme', 'light');
```

**方法四：组件内直接定义局部暗色变量（变量局部覆盖）**

```css
/* 全局变量是通用色板，组件内可以定义自己的局部变量 */
.heroSection {
  /* 局部变量：只在这个组件内有效 */
  --hero-bg: linear-gradient(to bottom, #1a1a2e, #16213e);
  --hero-text: #ffffff;
  --hero-overlay: rgba(0, 0, 0, 0.4);

  background: var(--hero-bg);
  color: var(--hero-text);
}

/* 暗色模式下覆盖局部变量 */
:root.dark .heroSection {
  --hero-bg: linear-gradient(to bottom, #000000, #0a0a0a); /* 更深的背景 */
  --hero-text: #cccccc; /* 稍暗的文字 */
  --hero-overlay: rgba(0, 0, 0, 0.6);
}
```

**方法五：完全独立于变量体系，直接硬编码（适合特效组件）**

```css
/* 某些组件就是要固定样式，不随主题变化（比如代码高亮、图表等） */
.codeBlock {
  /* 强制使用暗色风格，不管当前主题 */
  background: #1e1e1e !important;
  color: #d4d4d4 !important;
  border: 1px solid #333 !important;
}

/* 或者用 color-scheme 属性告诉浏览器这个元素固定是暗色 */
.codeBlock {
  color-scheme: dark; /* 浏览器会用暗色渲染滚动条、表单控件等原生 UI */
}
```

**实际项目推荐策略：**

```
全局通用颜色 → 放进 CSS 变量（:root / :root.dark）
组件特有样式 → :root.dark .component 局部覆盖
特效组件     → 直接硬编码，不走变量体系
用户自定义   → JS 动态 setProperty 修改变量值
```

---

### 面试高频题

#### 1. 暗黑模式的 CSS 变量方案 vs 多套样式文件方案？

> CSS 变量方案：只维护一套组件样式，通过切换 `:root` 上的变量值实现主题切换，**零重复代码，推荐**。
> 多套样式文件：`.light.css` / `.dark.css` 两份，切换时动态加载，**文件多、维护成本高，不推荐**。

---

#### 2. 为什么要用 `prefers-color-scheme` 媒体查询？

```css
@media (prefers-color-scheme: dark) {
  :root:not(.dark) {
    /* 只在用户没手动设置时跟随系统 */
  }
}
```

> 提升用户体验：用户第一次访问还没有手动偏好时，自动跟随系统主题，不会出现"白色闪屏"。`:not(.dark)` 确保手动设置优先于系统设置。

---

#### 3. View Transition API 的降级处理？

```js
// 特性检测：判断浏览器是否支持
if (!("startViewTransition" in document)) {
  // 降级：直接切换，无动画效果
  document.documentElement.classList.toggle("dark");
  return;
}
// 支持时才执行动画
document.startViewTransition(/* ... */);
```

> 渐进增强原则：先保证功能（切换主题）可用，在支持的浏览器上叠加动画体验。Safari < 18、Firefox 均不支持，需要降级。

---

### 一句话总结

> 暗黑模式实现三要素：**CSS 变量定义双主题色板**、**`localStorage` 持久化用户偏好**、**`prefers-color-scheme` 跟随系统**。进阶体验：用 **View Transition API** 实现从鼠标点击位置圆形扩散的切换动画（`clipPath` 从 `circle(0px)` 扩散到覆盖全屏）。

## 选择器优先级

### 核心概念

CSS 选择器优先级（Specificity）决定了当多条规则作用在同一个元素上时，哪条规则最终生效。优先级由**权重值**决定，权重越高越优先。

---

### 优先级权重规则

优先级从高到低分为四个等级，用 `(a, b, c, d)` 表示：

| 等级     | 类型                   | 权重     | 示例                                   |
| -------- | ---------------------- | -------- | -------------------------------------- |
| **最高** | `!important`           | 凌驾一切 | `color: red !important`                |
| **a**    | 内联样式（style 属性） | 1,0,0,0  | `<div style="color:red">`              |
| **b**    | ID 选择器              | 0,1,0,0  | `#header`                              |
| **c**    | 类、伪类、属性选择器   | 0,0,1,0  | `.active` / `:hover` / `[type="text"]` |
| **d**    | 元素、伪元素选择器     | 0,0,0,1  | `div` / `p` / `::before`               |
| **最低** | 通配符、继承、关系符   | 0,0,0,0  | `*` / `>` / `+` / `~`                  |

---

### 权重计算规则

```css
/* 计算方式：数每类选择器的个数，拼成 (a, b, c, d) 比较 */

div                    /* (0, 0, 0, 1) */
.class                 /* (0, 0, 1, 0) */
#id                    /* (0, 1, 0, 0) */
div p                  /* (0, 0, 0, 2) → 两个元素选择器 */
div.class              /* (0, 0, 1, 1) → 1个元素 + 1个类 */
#id .class div         /* (0, 1, 1, 1) → 1个ID + 1个类 + 1个元素 */
div:hover              /* (0, 0, 1, 1) → 1个元素 + 1个伪类 */
div::before            /* (0, 0, 0, 2) → 1个元素 + 1个伪元素 */
```

**比较规则**：从左到右逐位比较，第一位不同就直接得出结果，不进位（就算 100 个类选择器也赢不了 1 个 ID 选择器）。

```css
/* 100 个类选择器 vs 1 个 ID 选择器 */
/* .c1.c2.c3...c100 → (0, 0, 100, 0) */
/* #id              → (0, 1, 0, 0)   */
/* 结论：#id 赢，高位优先，不进位 */
```

---

### 特殊规则

#### 同权重：后定义覆盖先定义（就近原则）

```css
/* 权重相同时，CSS 文件中靠后的规则生效 */
.box {
  color: red;
}
.box {
  color: blue;
} /* ✅ 最终生效，后定义覆盖先定义 */
```

#### `!important`：打破权重，强制生效

```css
.text {
  color: red !important;
}
#title {
  color: blue;
}

/* <p id="title" class="text"> 最终显示红色 */
/* !important 直接胜出，无视权重计算 */
```

**⚠️ 注意**：两个 `!important` 冲突时，权重高的那个 `!important` 胜出。

```css
#id {
  color: red !important;
} /* (0,1,0,0) + !important */
.cls {
  color: blue !important;
} /* (0,0,1,0) + !important */
/* 两个都有 !important，比权重：#id 胜 → 红色 */
```

#### `:is()` / `:not()` / `:has()` 的优先级特殊处理

```css
/* :is() / :not() / :has() 本身不计权重，但括号内的选择器权重正常计算 */
:is(#id, .class) {
  color: red;
}
/* 括号内有 #id（0,1,0,0），所以整个选择器权重是 (0,1,0,0) */

:not(.active) {
  color: blue;
}
/* 括号内 .active（0,0,1,0），整体权重 (0,0,1,0) */
```

#### `:where()` 权重永远为 0

```css
/* :where() 括号内无论什么选择器，权重贡献都是 0 */
:where(#id, .class) div {
  color: red;
}
/* 权重 = (0, 0, 0, 1)，:where() 的内容不计 */

/* 作用：写基础样式，方便被覆盖，不用担心优先级冲突 */
```

---

### 继承属性的优先级

```css
/* 继承来的样式权重最低，任何直接声明的样式都能覆盖它 */
body {
  color: red;
} /* 子元素会继承 color */
p {
  color: blue;
} /* p 直接声明，覆盖继承的红色 */

/* 用 inherit 强制继承父元素值 */
p {
  color: inherit;
}
```

**可继承属性**：`color`、`font-*`、`line-height`、`text-*`、`visibility`、`cursor` 等文字相关属性。  
**不可继承属性**：`width`、`height`、`margin`、`padding`、`border`、`background`、`display`、`position` 等盒模型/布局属性。

---

### 面试高频题

#### 1. 下面哪个颜色最终生效？

```html
<div id="box" class="container" style="color: green;">文字</div>
```

```css
#box {
  color: red;
} /* (0,1,0,0) */
.container {
  color: blue;
} /* (0,0,1,0) */
div {
  color: purple;
} /* (0,0,0,1) */
/* style="color: green"       内联 (1,0,0,0) */
```

> **答案：绿色（green）**。内联样式权重最高 `(1,0,0,0)`，远高于 `#box` 的 `(0,1,0,0)`。

---

#### 2. 下面两个选择器哪个优先级更高？

```css
/* A */
.nav ul li a:hover {
  color: red;
}

/* B */
#nav a {
  color: blue;
}
```

```
A: .nav(0,0,1,0) + ul(0,0,0,1) + li(0,0,0,1) + a(0,0,0,1) + :hover(0,0,1,0)
   = (0, 0, 2, 3)

B: #nav(0,1,0,0) + a(0,0,0,1)
   = (0, 1, 0, 1)
```

> **答案：B 更高**。B 有 1 个 ID 选择器（第二位为 1），A 没有 ID，第二位为 0，ID 位直接决定胜负。

---

#### 3. 为什么尽量避免用 `!important`？

```css
/* 问题一：破坏优先级规则，代码难以预测和维护 */
.btn {
  color: red !important;
}

/* 后续想覆盖时，必须也加 !important，形成"!important 地狱" */
.btn-primary {
  color: blue !important;
} /* 不得不再加 */

/* 问题二：难以调试，特别是第三方库加了 !important */
```

**替代方案**：

```css
/* ✅ 用更高权重的选择器代替 !important */
/* 原来 */
.btn {
  color: red !important;
}

/* 改为：提高选择器权重 */
.container .btn {
  color: red;
} /* 多加一层父选择器 */
#app .btn {
  color: red;
} /* 或加 ID */
```

---

#### 4. `div div div div div div div div div div div` 能否超过 `.class`？

```
11 个 div 元素选择器：(0, 0, 0, 11)
1 个类选择器：        (0, 0, 1, 0)
```

> **答案：不能**。第三位（类选择器）为 1 vs 0，类选择器直接胜出。权重**不进位**，再多 `div` 也无法突破类选择器。

---

#### 5. `::before` 和 `:before` 有什么区别？优先级一样吗？

```css
div::before {
  content: "双冒号";
} /* CSS3 规范，伪元素 (0,0,0,1) */
div:before {
  content: "单冒号";
} /* CSS2 写法，兼容旧浏览器 */
```

> **区别**：`::` 双冒号是 CSS3 规范写法，用于区分**伪元素**（`::before`、`::after`、`::placeholder`）和**伪类**（`:hover`、`:nth-child()`）；`:` 单冒号是 CSS2 写法，现代浏览器两种都支持。  
> **优先级**：两者权重完全一样，都是 `(0,0,0,1)`，没有区别。

---

#### 6. 属性选择器的优先级？

```css
a[href]            /* (0, 0, 1, 1) → 1个属性选择器 + 1个元素 */
a[href^="https"]   /* (0, 0, 1, 1) → 同上 */
input[type="text"] /* (0, 0, 1, 1) → 同上 */

/* 属性选择器和类选择器权重相同，都是 (0,0,1,0) */
.active     /* (0, 0, 1, 0) */
[class]     /* (0, 0, 1, 0) */
```

---

#### 7. `:nth-child()` vs `:nth-of-type()` 的优先级？

```css
:nth-child(2)      /* (0, 0, 1, 0) → 伪类，权重与 .class 相同 */
:nth-of-type(2)    /* (0, 0, 1, 0) → 伪类，权重与 .class 相同 */
p:nth-child(2)     /* (0, 0, 1, 1) → 伪类 + 元素选择器 */
```

---

### 实际工程中的最佳实践

```
原则一：尽量用类选择器（.class），避免 ID 选择器（权重太高，难覆盖）
原则二：选择器层级不超过 3 层（性能 + 可维护性）
原则三：禁止滥用 !important，实在需要覆盖时优先提升选择器权重
原则四：CSS Modules / Tailwind 天然避免优先级冲突（样式局部作用域）
原则五：组件库集成时，用 :global() 穿透或提高一层权重，而不是 !important
```

```css
/* ❌ 反例：层级过深，权重过高，难以维护 */
#app .layout .sidebar .menu ul li a:hover {
  color: red;
}

/* ✅ 正例：平铺类选择器，简洁清晰 */
.menu-link:hover {
  color: red;
}
```

---

### 一句话总结

> 选择器优先级从高到低：**`!important` > 内联样式 > ID > 类/伪类/属性 > 元素/伪元素 > 通配符**。权重用 `(a,b,c,d)` 四元组表示，高位优先、不进位。工程实践中尽量用类选择器，避免 `!important`，CSS Modules 从根本上解决优先级冲突问题。

## React Hooks 高频

### React 生命周期

#### Class 组件生命周期（经典，面试必考）

```
挂载阶段（Mount）
  constructor()              → 初始化 state，绑定方法
  static getDerivedStateFromProps()  → props → state 映射（少用）
  render()                   → 返回 JSX，纯函数，不能有副作用
  componentDidMount()        → DOM 已挂载，发请求、添加事件监听

更新阶段（Update）
  static getDerivedStateFromProps()  → 同上
  shouldComponentUpdate()    → 返回 false 阻止渲染（性能优化）
  render()
  getSnapshotBeforeUpdate()  → 获取更新前 DOM 信息（如滚动位置）
  componentDidUpdate()       → 更新后执行（对比 prevProps/prevState）

卸载阶段（Unmount）
  componentWillUnmount()     → 清理：取消订阅、清定时器、移除监听
```

```jsx
class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  componentDidMount() {
    // ✅ 发数据请求、添加全局事件监听
    this.timer = setInterval(() => {
      this.setState((s) => ({ count: s.count + 1 }));
    }, 1000);
  }

  shouldComponentUpdate(nextProps, nextState) {
    // 只在 count 变化时才重新渲染（性能优化）
    return nextState.count !== this.state.count;
  }

  componentDidUpdate(prevProps, prevState) {
    // 对比前后值，避免死循环
    if (prevState.count !== this.state.count) {
      console.log("count 变了:", this.state.count);
    }
  }

  componentWillUnmount() {
    // ✅ 必须清理，否则内存泄漏
    clearInterval(this.timer);
  }

  render() {
    return <div>{this.state.count}</div>;
  }
}
```

---

#### 函数组件用 `useEffect` 模拟生命周期

```tsx
function MyComponent({ userId }) {
  const [data, setData] = useState(null);

  // ✅ componentDidMount：只在挂载时执行一次
  useEffect(() => {
    console.log("组件挂载了");
    initSomething();
  }, []);

  // ✅ componentDidUpdate：依赖变化时执行
  useEffect(() => {
    fetchUser(userId).then(setData);
  }, [userId]); // userId 变化时重新请求

  // ✅ componentWillUnmount：return 的清理函数
  useEffect(() => {
    const timer = setInterval(() => {}, 1000);
    return () => {
      clearInterval(timer); // 卸载时清理
      console.log("组件卸载了");
    };
  }, []);

  // ✅ componentDidMount + componentWillUnmount 合并写
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <div>{data?.name}</div>;
}
```

---

#### Class 生命周期 → Hooks 对照表

| Class 生命周期             | Hooks 等价写法                             |
| -------------------------- | ------------------------------------------ |
| `constructor`              | `useState` 初始化                          |
| `componentDidMount`        | `useEffect(() => {}, [])`                  |
| `componentDidUpdate`       | `useEffect(() => {}, [deps])`              |
| `componentWillUnmount`     | `useEffect(() => { return () => {} }, [])` |
| `shouldComponentUpdate`    | `React.memo` / `useMemo`                   |
| `getSnapshotBeforeUpdate`  | `useLayoutEffect`（执行时机在 DOM 更新前） |
| `getDerivedStateFromProps` | `useState` + `useMemo` 推导                |

---

#### `useLayoutEffect` vs `useEffect`（面试常考）

```tsx
// useEffect：   DOM 更新后异步执行（不阻塞浏览器绘制）✅ 绝大多数场景用这个
// useLayoutEffect：DOM 更新后同步执行（阻塞浏览器绘制）⚠️ 只在需要读取/操作 DOM 尺寸时用

useLayoutEffect = "在用户睁眼之前偷偷改 DOM"。需要读取 DOM 尺寸/位置、然后立刻根据这个值再修改 DOM 时用它，避免用户看到两次渲染之间的闪烁。其他 99% 的副作用都用 useEffect。

useLayoutEffect(() => {
  // 在浏览器绘制前同步执行
  // 适合：读取 DOM 尺寸后立刻更新，避免闪烁
  const height = ref.current.getBoundingClientRect().height;
  setHeight(height); // 同步更新，用户看不到中间状态
}, []);

useEffect(() => {
  // 在浏览器绘制后异步执行
  // 适合：数据请求、事件订阅等副作用（99% 的场景）
}, []);
```

**执行顺序：**

```
render → DOM 更新 → useLayoutEffect → 浏览器绘制 → useEffect
```

---

#### 面试高频：React 生命周期执行顺序题

```jsx
// 父子组件挂载顺序
// 父 render → 子 render → 子 componentDidMount → 父 componentDidMount

// 父子组件更新顺序
// 父 render → 子 render → 子 componentDidUpdate → 父 componentDidUpdate

// 父子组件卸载顺序
// 父 componentWillUnmount → 子 componentWillUnmount
```

```tsx
// 函数组件版本（用 useEffect 验证）
function Parent() {
  useEffect(() => {
    console.log("父 mount"); // 4
    return () => console.log("父 unmount"); // 先父后子
  }, []);
  return <Child />;
}

function Child() {
  useEffect(() => {
    console.log("子 mount"); // 3（子先于父 mount）
    return () => console.log("子 unmount");
  }, []);
  return <div>child</div>;
}
// 挂载输出顺序：子 mount → 父 mount（子先完成）
```

---

### 核心概念

React Hooks 是 React 16.8 引入的特性，让函数组件也能使用 state、生命周期等能力，彻底替代了 Class 组件写法。

**为什么要有 Hooks？**

- Class 组件：生命周期分散（同一个功能的代码分布在 `componentDidMount`、`componentDidUpdate`、`componentWillUnmount` 三处），复用逻辑困难（HOC/Render Props 嵌套地狱），`this` 指向问题
- Hooks：**按功能聚合代码**，逻辑复用通过自定义 Hook 实现，更简洁、更易测试

**Hooks 使用规则（两条铁律）：**

1. 只能在**函数组件顶层**调用，不能在条件/循环/嵌套函数中调用
2. 只能在**函数组件**或**自定义 Hook** 中调用，不能在普通 JS 函数中调用

铁律一：Hook 靠「调用顺序」识别身份，顺序乱了状态就乱了。
铁律二：Hook 靠「React 渲染指针」找到所属组件，在渲染流程之外调用，指针是空的，直接报错。

---

### `useState`：状态管理

```tsx
const [state, setState] = useState(initialValue);
```

```tsx
const [count, setCount] = useState(0);
const [user, setUser] = useState({ name: "", age: 0 });

// 更新基本类型
setCount(count + 1);
setCount((prev) => prev + 1); // ✅ 推荐：基于上一次值更新（异步批量更新时更安全）

// 更新对象：必须展开，否则会整体替换
setUser((prev) => ({ ...prev, name: "maoyan" })); // ✅ 只更新 name
setUser({ name: "maoyan" }); // ❌ age 会丢失
```

**关键特性：**

```tsx
// 1. 惰性初始化：initialValue 传函数，避免每次渲染都执行昂贵计算
const [data, setData] = useState(() => {
  return JSON.parse(localStorage.getItem("data") || "[]");
});

// 2. 批量更新（React 18 默认所有场景都批量更新）每次渲染太浪费了用户体验也不好，一次收集合并所有更新
function handleClick() {
  setCount((c) => c + 1);
  setCount((c) => c + 1); // 两次 setState 只触发一次渲染
  // 最终 count + 2
}

// 3. 状态不可变：直接修改 state 不会触发渲染
state.name = "new"; // ❌ 不会重新渲染
setState({ ...state, name: "new" }); // ✅ 创建新对象才触发
```

// ❌ 直接传值（闭包陷阱）
function handleClick() {
setCount(count + 1); // count 此时是 0，快照
setCount(count + 1); // count 还是 0，还是快照！
// 最终结果：1，不是 2
}

// ✅ 函数式（基于上一次值）
function handleClick() {
setCount(c => c + 1); // c 是队列里最新的值 0 → 1
setCount(c => c + 1); // c 是队列里最新的值 1 → 2
// 最终结果：2 ✅
}

---

### `useEffect`：副作用处理

副作用：数据请求、DOM 操作、事件监听、定时器、订阅等

```tsx
// 语法：useEffect(callback, deps?)
useEffect(() => {
  // 副作用逻辑

  return () => {
    // 清理函数（组件卸载 or 下次 effect 执行前调用）
  };
}, [deps]); // 依赖项数组
```

**三种执行时机：**

```tsx
// 1. 无依赖数组：每次渲染后都执行（慎用！）
useEffect(() => {
  console.log("每次渲染都执行");
});

// 2. 空依赖数组：只在组件挂载时执行一次（相当于 componentDidMount）
useEffect(() => {
  fetchData();
  return () => cleanup(); // 相当于 componentWillUnmount
}, []);

// 3. 有依赖项：依赖变化时执行（相当于 componentDidUpdate + 依赖对比）
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]); // count 变化时才执行
```

**常见用法：**

```tsx
// 数据请求
useEffect(() => {
  let cancelled = false;
  async function fetchUser() {
    const data = await fetch(`/api/user/${userId}`).then((r) => r.json());
    if (!cancelled) setUser(data); // 防止组件卸载后设置 state
  }
  fetchUser();
  return () => {
    cancelled = true;
  };
}, [userId]);

// 事件监听 + 清理
useEffect(() => {
  const handler = () => setWidth(window.innerWidth);
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler); // ✅ 必须清理
}, []);

// 定时器 + 清理
useEffect(() => {
  const timer = setInterval(() => setCount((c) => c + 1), 1000);
  return () => clearInterval(timer); // ✅ 必须清理
}, []);
```

---

### `useCallback`：缓存函数引用

```tsx
// 语法：const memoizedFn = useCallback(fn, deps)
const handleClick = useCallback(() => {
  console.log(count);
}, [count]); // deps 变化才重新创建函数
```

**为什么需要 useCallback？**

父组件重新渲染，子组件无条件跟着重新渲染，不管 props 有没有变。
但如果你用了 React.memo 包裹子组件，它会对 props 做浅比较，props 没变就跳过渲染：
但是如果穿的是方法的，每次创建的是一个新的方法会导致这个浅比较失效，所以需要 useCallback 缓存方法引用。

函数组件每次渲染都会创建新函数，引用地址变了，即使逻辑没变，React.memo 也会认为 props 变了而重新渲染子组件。useCallback 的作用就是缓存函数引用，让 deps 不变时地址保持一致，配合 React.memo 才能真正跳过子组件的无意义渲染。

```tsx
// 问题：函数组件每次渲染都会创建新的函数引用
function Parent() {
  const [count, setCount] = useState(0);
  const handleClick = () => {}; // 每次渲染都是新引用

  // Child 接收到新的 handleClick 引用 → 即使 props 逻辑没变也会重渲染
  return <Child onClick={handleClick} />;
}

// 解决：useCallback 缓存函数，deps 不变时引用不变
const handleClick = useCallback(() => {}, []); // 引用稳定，Child 不会无效重渲染
```

**搭配 `React.memo` 使用：**

```tsx
// React.memo：对 props 进行浅比较，相同则跳过渲染
const Child = React.memo(({ onClick }) => {
  console.log("Child 渲染");
  return <button onClick={onClick}>点击</button>;
});

function Parent() {
  const handleClick = useCallback(() => {
    // ...
  }, []); // 引用稳定 → Child 不会无效重渲染 ✅

  return <Child onClick={handleClick} />;
}
```

---

### `useMemo`：缓存计算结果

```tsx
// 语法：const memoizedValue = useMemo(() => compute(), deps)
const expensiveResult = useMemo(() => {
  return list
    .filter((item) => item.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}, [list]); // list 变化才重新计算
```

**`useMemo` vs `useCallback`：**

```tsx
// useMemo 缓存值（任意类型）
const memoValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);

// useCallback 缓存函数（等价于 useMemo 返回函数）
const memoFn = useCallback(() => doSomething(a, b), [a, b]);
// 等价于：
const memoFn = useMemo(() => () => doSomething(a, b), [a, b]);
```

**什么时候用 useMemo？**

```tsx
// ✅ 值：计算量大（复杂过滤/排序/数学运算）
const result = useMemo(() => heavyCompute(data), [data]);

// ✅ 引用稳定：避免子组件因对象/数组引用变化而重渲染
const config = useMemo(() => ({ theme: "dark", lang: "zh" }), []);
// 不用 useMemo：每次渲染都是新对象 → 传给子组件会触发重渲染

// ❌ 不适合：简单计算，useMemo 本身也有开销
const doubled = useMemo(() => count * 2, [count]); // 没必要
const doubled = count * 2; // ✅ 直接算即可
```

---

### `useRef`：持久化引用

```tsx
const ref = useRef(initialValue);
// ref.current 始终指向最新值，修改不触发重渲染
```

**两大用途：**

```tsx
// 用途一：访问 DOM 节点
function Input() {
  const inputRef = useRef(null);
  const focus = () => inputRef.current?.focus();
  return <input ref={inputRef} />;
}

// 用途二：保存不需要触发渲染的值（定时器ID、上一次的值、是否首次渲染等）
function Timer() {
  const timerRef = useRef(null);
  const [count, setCount] = useState(0);

  const start = () => {
    timerRef.current = setInterval(() => setCount((c) => c + 1), 1000);
  };
  const stop = () => clearInterval(timerRef.current); // ref 修改不触发渲染

  return <button onClick={stop}>Stop</button>;
}

// 典型场景：记录上一次的 props/state
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; // 渲染后更新
  });
  return ref.current; // 返回上一次的值
}
```

**`useRef` vs `useState` 关键区别：**

```
useRef：  修改 ref.current 不触发重渲染，值在渲染间持久存在
useState：修改 state 触发重渲染，适合需要更新 UI 的数据
```

---

### `useContext`：跨组件传值

```tsx
// 1. 创建 Context
const ThemeContext = createContext("light");

// 2. Provider 提供值
function App() {
  const [theme, setTheme] = useState("dark");
  return (
    <ThemeContext.Provider value={theme}>
      <DeepChild />
    </ThemeContext.Provider>
  );
}

// 3. 任意子孙组件消费，无需逐层传 props
function DeepChild() {
  const theme = useContext(ThemeContext);
  return <div className={theme}>内容</div>;
}
```

**注意：Context 变化会导致所有消费该 Context 的组件重渲染，需要配合 `useMemo` 优化 value。**

```tsx
// ❌ 每次渲染都创建新对象，所有消费者都会重渲染
<UserContext.Provider value={{ user, setUser }}>

// ✅ 用 useMemo 稳定 value 引用
const value = useMemo(() => ({ user, setUser }), [user]);
<UserContext.Provider value={value}>
```

---

### `useReducer`：复杂状态管理

useReducer 就是把「状态怎么更新」的逻辑抽到组件外面的 reducer 函数里统一管理，组件只负责 dispatch 描述「做了什么操作」。特别适合多个关联状态、复杂更新逻辑的场景，本质上就是组件级的 Redux。

```tsx
// 语法：const [state, dispatch] = useReducer(reducer, initialState)
const reducer = (state, action) => {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return { count: 0 };
    default:
      return state;
  }
};

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  return (
    <>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: "increment" })}>+</button>
      <button onClick={() => dispatch({ type: "decrement" })}>-</button>
    </>
  );
}
```

**`useReducer` vs `useState`：**

```
useState：   简单值、少量状态，直接 setX
useReducer： 多个相关状态、复杂更新逻辑、状态转换有明确规则（类似 Redux）
```

---

### 自定义 Hook：逻辑复用

自定义 Hook 是以 `use` 开头的函数，内部可以调用其他 Hook，用于**抽取和复用有状态的逻辑**。

```tsx
// 封装数据请求逻辑
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [url]);

  return { data, loading, error };
}

// 使用：逻辑复用，无需 HOC 或 Render Props
function UserPage() {
  const { data, loading, error } = useFetch("/api/user");
  if (loading) return <Spinner />;
  if (error) return <Error />;
  return <User data={data} />;
}
```

```tsx
// 封装本地存储
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue) => {
      setValue(newValue);
      localStorage.setItem(key, JSON.stringify(newValue));
    },
    [key],
  );

  return [value, setStoredValue];
}
```

---

### 面试高频题

#### 1. `useState` 的更新是同步还是异步？

```tsx
function handleClick() {
  setCount(count + 1);
  console.log(count); // ❓ 还是旧值！不是最新值

  // 原因：setState 是异步的（批量更新），不会立即修改 count
  // 要拿最新值，用 useEffect 监听或传函数形式
}

// ✅ 正确获取最新 state：
useEffect(() => {
  console.log(count); // 渲染后才拿到最新值
}, [count]);

// ✅ 或用函数式更新（保证基于最新值）：
setCount((prev) => prev + 1);
```

---

#### 2. `useEffect` 依赖数组常见错误？

```tsx
// ❌ 错误一：缺少依赖项（ESLint react-hooks/exhaustive-deps 会警告）
useEffect(() => {
  fetchUser(userId); // 用了 userId 但没加依赖
}, []); // userId 变化时不会重新请求

// ❌ 错误二：依赖项是对象/函数（每次渲染都是新引用）
useEffect(() => {
  doSomething(config);
}, [config]); // config 是对象，每次渲染都变，导致死循环

// ✅ 解决：用 useMemo 稳定 config 引用，或在 effect 内部定义
const config = useMemo(() => ({ key: "val" }), []);

// ❌ 错误三：忘记清理副作用（内存泄漏）
useEffect(() => {
  const sub = subscribe(callback); // 没有 return 清理函数
}, []);
```

---

#### 3. `useCallback` 一定需要吗？什么时候用？

```tsx
// ❌ 过度使用 useCallback（没有优化效果）
const handleClick = useCallback(() => {
  setCount((c) => c + 1);
}, []); // 函数本身很简单，useCallback 本身也有开销

// ✅ 真正需要 useCallback 的场景：
// 1. 函数作为 props 传给用 React.memo 包裹的子组件
// 2. 函数作为 useEffect 的依赖项

const fetchData = useCallback(async () => {
  const data = await api.get(url);
  setData(data);
}, [url]);

useEffect(() => {
  fetchData(); // fetchData 是依赖，需要保证引用稳定
}, [fetchData]);
```

---

#### 4. 如何在 `useEffect` 中正确使用 `async/await`？

```tsx
// ❌ 错误：不能直接把 async 函数传给 useEffect
useEffect(async () => {
  const data = await fetchData(); // ❌ useEffect 回调不能是 async 函数
  setData(data);
}, []);
// 原因：async 函数返回 Promise，但 useEffect 期望返回 cleanup 函数或 undefined

// ✅ 正确写法一：在 effect 内定义 async 函数再立即调用
useEffect(() => {
  async function load() {
    const data = await fetchData();
    setData(data);
  }
  load();
}, []);

// ✅ 正确写法二：IIFE
useEffect(() => {
  (async () => {
    const data = await fetchData();
    setData(data);
  })();
}, []);
```

---

#### 5. `useRef` 和 `useState` 什么时候选哪个？

```tsx
// 场景判断：
// 需要触发重渲染 → useState
// 不需要触发重渲染，只是存储值 → useRef

// ✅ useRef 适合场景：
const isFirstRender = useRef(true); // 首次渲染标志
const prevValue = useRef(value); // 记录上一次的值
const timerRef = useRef(null); // 存储定时器 ID
const inputRef = useRef(null); // 访问 DOM 节点

// ❌ 不要用 useRef 存需要展示在 UI 的数据
const countRef = useRef(0);
countRef.current++; // 不会触发重渲染，UI 不会更新
```

---

#### 6. Hooks 为什么不能在条件语句中调用？

```tsx
// ❌ 错误
if (condition) {
  const [value, setValue] = useState(0); // 违规！
}

// 原因：React 通过调用顺序（链表）来对应每个 Hook 的状态
// 每次渲染 Hooks 必须以相同的顺序调用，条件/循环会导致顺序错乱

// 第一次渲染：Hook1 → Hook2 → Hook3（顺序固定）
// condition=false 时渲染：Hook1 → Hook3（跳过 Hook2，状态对应错位！）
```

---

#### 7. 父子组件通信如何用 Hooks 实现？

```tsx
// 父 → 子：props 传值（基本）
// 子 → 父：父传回调函数给子，子调用回调

function Parent() {
  const [count, setCount] = useState(0);
  const handleChange = useCallback((val) => setCount(val), []);
  return <Child value={count} onChange={handleChange} />;
}

// 子组件暴露方法给父组件（useImperativeHandle + forwardRef）
const Child = forwardRef((props, ref) => {
  const [val, setVal] = useState("");

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    getValue: () => val,
    reset: () => setVal(""),
  }));

  const inputRef = useRef(null);
  return (
    <input
      ref={inputRef}
      value={val}
      onChange={(e) => setVal(e.target.value)}
    />
  );
});

function Parent() {
  const childRef = useRef(null);
  return (
    <>
      <Child ref={childRef} />
      <button onClick={() => childRef.current.focus()}>聚焦</button>
    </>
  );
}
```

---

### 常用 Hooks 速查表

| Hook          | 作用         | 触发渲染 | 使用场景                      |
| ------------- | ------------ | -------- | ----------------------------- |
| `useState`    | 管理组件状态 | ✅ 是    | 需要 UI 响应的数据            |
| `useEffect`   | 处理副作用   | ❌ 否    | 请求、监听、定时器            |
| `useCallback` | 缓存函数引用 | ❌ 否    | 传给子组件的回调、effect 依赖 |
| `useMemo`     | 缓存计算结果 | ❌ 否    | 耗时计算、稳定对象引用        |
| `useRef`      | 持久化引用   | ❌ 否    | DOM 节点、定时器 ID、上一次值 |
| `useContext`  | 消费 Context | ✅ 是    | 跨层级传值                    |
| `useReducer`  | 复杂状态机   | ✅ 是    | 多状态联动、复杂更新逻辑      |

---

### 一句话总结

> React Hooks 让函数组件拥有状态和生命周期能力。核心：**`useState` 管状态触发渲染**、**`useEffect` 处理副作用并清理**、**`useCallback/useMemo` 缓存引用避免无效重渲染**、**`useRef` 持久存值不触发渲染**。Hooks 两大铁律：只在顶层调用、只在函数组件/自定义 Hook 中调用。

## React 性能优化

### 核心概念

React 性能优化的本质是**减少不必要的重渲染**。函数组件每次 state/props 变化都会重新执行，子组件也会跟着执行，优化的核心手段就是**跳过不必要的渲染**和**减少每次渲染的计算量**。

---

### 重渲染的触发条件

```
1. 自身 state 变化 → 组件重渲染
2. 父组件重渲染 → 子组件无条件重渲染（即使 props 没变）
3. Context 变化 → 所有消费该 Context 的组件重渲染
```

**关键问题**：父组件渲染时，会创建新的函数引用、对象引用，即使逻辑没变，浅比较也会认为 props 变了，子组件无效重渲染。

---

### 工具一：`React.memo` —— 跳过子组件无效渲染

```tsx
// 包裹后，只有 props 浅比较变化时才重新渲染
const Child = React.memo(({ name, onClick }) => {
  console.log("Child 渲染");
  return <button onClick={onClick}>{name}</button>;
});

// 自定义比较函数（第二个参数）
const Child = React.memo(
  ({ user }) => <div>{user.name}</div>,
  (prevProps, nextProps) => prevProps.user.id === nextProps.user.id,
  // 返回 true 表示相同，跳过渲染；返回 false 表示不同，触发渲染
);
```

**注意**：`React.memo` 只做**浅比较**，引用类型（对象/数组/函数）每次渲染都是新引用，会导致 memo 失效。 （深比较本身是比较消耗的性能的，择机使用）

---

### 工具二：`useCallback` —— 稳定函数引用

```tsx
// ❌ 问题：每次父组件渲染，handleClick 都是新引用 → memo 失效
function Parent() {
  const handleClick = () => {
    console.log("click");
  };
  return <Child onClick={handleClick} />;
}

// ✅ 解决：useCallback 缓存函数，deps 不变时引用不变
function Parent() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    console.log("click");
  }, []); // 无依赖，引用永远稳定

  return <Child onClick={handleClick} />;
}

// 搭配 React.memo，才能真正跳过子组件重渲染
const Child = React.memo(({ onClick }) => {
  console.log("Child 渲染");
  return <button onClick={onClick}>点击</button>;
});
```

---

### 工具三：`useMemo` —— 缓存计算结果

```tsx
// ❌ 问题：每次渲染都重新过滤排序（假设 list 很大）
function ProductList({ list, keyword }) {
  const filtered = list
    .filter((item) => item.name.includes(keyword))
    .sort((a, b) => a.price - b.price); // 每次渲染都执行

  return filtered.map((item) => <Item key={item.id} item={item} />);
}

// ✅ 解决：useMemo 缓存，只在 list/keyword 变化时重新计算
function ProductList({ list, keyword }) {
  const filtered = useMemo(
    () =>
      list
        .filter((item) => item.name.includes(keyword))
        .sort((a, b) => a.price - b.price),
    [list, keyword], // 依赖变化才重新计算
  );

  return filtered.map((item) => <Item key={item.id} item={item} />);
}
```

**稳定对象引用，防止 Context/子组件重渲染：**

```tsx
// ❌ 每次渲染都是新对象 → 所有 Context 消费者重渲染
<UserContext.Provider value={{ user, setUser }}>

// ✅ 用 useMemo 稳定 value 引用
const value = useMemo(() => ({ user, setUser }), [user]);
<UserContext.Provider value={value}>
```

---

### 工具四：代码分割与懒加载

```tsx
import { lazy, Suspense } from "react";

// 路由级别懒加载（页面按需加载，减少首屏体积）
const HeavyPage = lazy(() => import("./pages/HeavyPage"));
const ChartPage = lazy(() => import("./pages/ChartPage"));

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <Routes>
        <Route path="/heavy" element={<HeavyPage />} />
        <Route path="/chart" element={<ChartPage />} />
      </Routes>
    </Suspense>
  );
}
```

```tsx
// 组件级懒加载（仅在需要时加载重型组件）
const HeavyModal = lazy(() => import("./HeavyModal"));

function Parent() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button onClick={() => setShow(true)}>打开弹窗</button>
      {show && (
        <Suspense fallback={<Spinner />}>
          <HeavyModal />
        </Suspense>
      )}
    </>
  );
}
```

---

### 工具五：虚拟列表（长列表优化）

当列表数据量超过几百条时，全部渲染 DOM 会导致页面卡顿。虚拟列表**只渲染可视区域内的元素**。

```tsx
// 使用 react-window（最常见）
import { FixedSizeList } from "react-window";

function VirtualList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  );

  return (
    <FixedSizeList
      height={600} // 可视区域高度
      itemCount={10000} // 总条数
      itemSize={50} // 每行高度（固定）
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

**核心原理**：

```
总共 10000 条 → 只渲染可视区域内约 12 条 DOM
滚动时动态替换渲染内容（不是创建新 DOM，是复用）
```

---

### 工具六：避免在渲染中创建新引用

```tsx
// ❌ 每次渲染都创建新对象/数组，传给子组件会导致重渲染
function Parent() {
  return (
    <Child
      config={{ theme: "dark" }} // ❌ 新对象
      items={[1, 2, 3]} // ❌ 新数组
      onClick={() => {}} // ❌ 新函数
    />
  );
}

// ✅ 提取到组件外部（不依赖 state/props 时）
const CONFIG = { theme: "dark" }; // 模块级常量，引用永远稳定
const ITEMS = [1, 2, 3];

function Parent() {
  const handleClick = useCallback(() => {}, []);
  return <Child config={CONFIG} items={ITEMS} onClick={handleClick} />;
}
```

---

### 工具七：`useTransition` —— 非紧急更新降优先级（React 18）

```tsx
import { useState, useTransition } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e) => {
    setQuery(e.target.value); // 高优先级：输入框立即更新

    startTransition(() => {
      // 低优先级：搜索结果延迟更新（不阻塞输入）
      setResults(heavySearch(e.target.value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleSearch} />
      {isPending ? <Spinner /> : <ResultList items={results} />}
    </>
  );
}
```

**使用场景**：用户输入、tab 切换等需要"输入流畅、结果稍后显示"的场景。

---

### 工具八：`key` 的正确使用

```tsx
// ❌ 用 index 作为 key（列表顺序变化时状态错乱）
{
  items.map((item, index) => <Item key={index} item={item} />);
}

// ✅ 用唯一且稳定的 ID 作为 key
{
  items.map((item) => <Item key={item.id} item={item} />);
}

// 巧用 key 强制重置组件状态（key 变化 → 组件销毁重建）
<UserForm key={userId} userId={userId} />;
// userId 变化时，整个 UserForm 重置为初始状态，无需手动清理
```

---

### 性能优化速查表

| 问题                             | 解决方案                                      |
| -------------------------------- | --------------------------------------------- |
| 父渲染导致子组件无效重渲染       | `React.memo` + `useCallback`/`useMemo`        |
| 传给子组件的函数每次都是新引用   | `useCallback`                                 |
| 传给子组件的对象每次都是新引用   | `useMemo` / 提升到组件外部                    |
| Context 变化导致所有消费者重渲染 | `useMemo` 稳定 value / 拆分 Context           |
| 首屏加载慢（JS 包太大）          | `React.lazy` + `Suspense` 代码分割            |
| 长列表渲染慢                     | `react-window` / `react-virtualized` 虚拟列表 |
| 耗时计算每次都重新执行           | `useMemo`                                     |
| 输入时搜索结果更新卡顿           | `useTransition` / `useDeferredValue`          |

---

### 面试高频题

#### 1. `React.memo`、`useCallback`、`useMemo` 的关系和使用场景？

```
三者都是"避免不必要的重渲染"，但层次不同：

React.memo：  组件级别，跳过整个子组件的渲染（props 浅比较）
useCallback：  函数级别，保证函数引用稳定（配合 React.memo 使用）
useMemo：      值级别，缓存计算结果（避免耗时计算 + 稳定引用）

三者协作：
父组件用 useCallback 稳定函数引用
子组件用 React.memo 跳过无效渲染
传给 Context 的对象用 useMemo 稳定引用
```

---

#### 2. 什么时候不需要用 `useCallback` / `useMemo`？

```tsx
// ❌ 过度优化（没有意义，自身也有开销）
// 1. 子组件没有用 React.memo 包裹
const handleClick = useCallback(() => setCount((c) => c + 1), []);
// 父组件每次渲染，子组件也会渲染，useCallback 毫无作用

// 2. 计算本身很简单
const doubled = useMemo(() => count * 2, [count]); // ❌
const doubled = count * 2; // ✅ 直接算即可

// 正确的使用判断：
// useCallback → 函数要传给 React.memo 子组件 或 作为 useEffect 依赖
// useMemo → 计算耗时（大量数据过滤/排序）或 需要稳定引用（传 Context/子组件）
```

---

#### 3. 为什么 `React.memo` 有时候不生效？

```tsx
// 原因：传入了引用类型（对象/数组/函数），每次都是新引用，浅比较失败

const Child = React.memo(({ config }) => <div>{config.theme}</div>);

// ❌ memo 不生效：config 每次渲染都是新对象
function Parent() {
  return <Child config={{ theme: "dark" }} />;
}

// ✅ 解决方案一：useMemo 稳定 config 引用
const config = useMemo(() => ({ theme: "dark" }), []);
return <Child config={config} />;

// ✅ 解决方案二：提升到组件外部（不依赖 state/props）
const CONFIG = { theme: "dark" };
return <Child config={CONFIG} />;

// ✅ 解决方案三：自定义比较函数
const Child = React.memo(
  ({ config }) => <div>{config.theme}</div>,
  (prev, next) => prev.config.theme === next.config.theme,
);
```

---

#### 4. 如何优化 Context 导致的全量重渲染？

```tsx
// 问题：Context value 变化，所有消费该 Context 的组件都重渲染
const UserContext = createContext(null);

// ❌ 每次 App 渲染都创建新对象 → 所有消费者重渲染
function App() {
  const [user, setUser] = useState({ name: "maoyan" });
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <DeepTree />
    </UserContext.Provider>
  );
}

// ✅ 方案一：useMemo 稳定 value 引用
function App() {
  const [user, setUser] = useState({ name: "maoyan" });
  const value = useMemo(() => ({ user, setUser }), [user]);
  return (
    <UserContext.Provider value={value}>
      <DeepTree />
    </UserContext.Provider>
  );
}

// ✅ 方案二：拆分 Context（读写分离）
const UserStateContext = createContext(null); // 只放 user（状态）
const UserDispatchContext = createContext(null); // 只放 setUser（稳定引用）

// setUser 是稳定引用（useState 返回的 setter 不会变）
// 只读 user 的组件不会因 setUser 变化而重渲染
```

---

#### 5. `useTransition` 和 `useDeferredValue` 的区别？

```tsx
// useTransition：控制"更新的发起方"（主动标记为低优先级）
const [isPending, startTransition] = useTransition();
startTransition(() => {
  setHeavyState(newValue); // 这个更新是低优先级
});

// useDeferredValue：控制"值的消费方"（延迟使用某个值）
const deferredQuery = useDeferredValue(query); // 延迟跟上 query 的变化
const results = useMemo(() => heavySearch(deferredQuery), [deferredQuery]);

// 区别：
// useTransition → 控制 setter，有 isPending 状态可用于 loading 展示
// useDeferredValue → 控制值，适合无法修改 setter 的第三方数据场景
```

---

#### 6. 长列表为什么会卡？如何解决？

```
原因：渲染 10000 条数据 → 创建 10000 个 DOM 节点 →
     浏览器 Layout/Paint 耗时极长 → 页面卡顿

解决：虚拟列表（Virtual List）
核心思路：只渲染可视区域内的约 10-20 条，滚动时动态计算偏移量

实现方式：
1. react-window（轻量，推荐）- FixedSizeList / VariableSizeList
2. react-virtualized（功能更多）
3. 手写：监听 scroll → 计算 startIndex/endIndex → 只渲染这个范围的数据

手写核心逻辑：
const startIndex = Math.floor(scrollTop / itemHeight);
const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
const visibleItems = items.slice(startIndex, endIndex);
```

---

#### 7. 首屏性能优化有哪些手段？

```
1. 代码分割（Code Splitting）
   React.lazy + Suspense 按路由/组件懒加载
   减少首屏需要解析的 JS 体积

2. SSR / SSG（Next.js）
   服务端渲染：首屏 HTML 由服务器直接返回，无需等 JS 执行
   静态生成：构建时生成 HTML，CDN 直接返回

3. 图片优化
   懒加载：<img loading="lazy" />
   现代格式：WebP / AVIF
   响应式：srcset 按屏幕尺寸加载合适分辨率

4. 资源预加载
   <link rel="preload" href="..." as="script">  // 预加载关键资源
   <link rel="prefetch" href="...">              // 预取下一页资源

5. Tree Shaking
   只打包实际使用的代码（按需引入，不要整包引入）
   import { debounce } from 'lodash-es'; // ✅
   import _ from 'lodash';               // ❌ 引入整个 lodash
```

---

### 一句话总结

> React 性能优化核心三板斧：**`React.memo` 跳过子组件无效渲染**、**`useCallback/useMemo` 稳定引用避免 memo 失效**、**`React.lazy` 代码分割减少首屏体积**。长列表用虚拟列表（react-window），输入卡顿用 `useTransition` 降低更新优先级。优化前先用 React DevTools Profiler 定位瓶颈，避免过度优化。

## Fiber 架构与 Diff 算法

### 核心概念：为什么需要 Fiber？

React 16 之前（Stack Reconciler）采用**同步递归**方式遍历虚拟 DOM 树，一旦开始就无法中断，遇到组件树很深时会长时间占用主线程，导致页面卡顿、动画掉帧（JS 单线程，渲染任务和 JS 抢占主线程）。

**Fiber 的核心目的**：把渲染工作拆分成可中断的小单元，让浏览器在每帧的空闲时间执行，高优先级任务（用户输入、动画）可以随时打断低优先级任务（列表渲染），执行完再继续。

```
Stack Reconciler（旧）：同步递归，一口气干完，主线程被独占
Fiber Reconciler（新）：异步可中断，每帧分配时间片，让出主线程
```

---

### Fiber 是什么？

**Fiber 是 React 内部的一种数据结构**，本质是一个 JS 对象，代表一个工作单元（一个组件或一个 DOM 节点）。

```js
// Fiber 节点的核心字段（简化版）
const fiber = {
  type: "div", // 组件类型（函数/类/字符串）
  key: null, // Diff 时的唯一标识
  stateNode: domNode, // 对应的真实 DOM 节点 / 组件实例

  // 链表结构（Fiber Tree 是链表，不是递归树）
  child: childFiber, // 第一个子节点
  sibling: siblingFiber, // 下一个兄弟节点
  return: parentFiber, // 父节点（回溯用）

  // 状态与副作用
  pendingProps: {}, // 新的 props（本次渲染）
  memoizedProps: {}, // 已确认的 props（上次渲染）
  memoizedState: {}, // hooks 链表 / class 组件 state
  effectTag: "UPDATE", // 需要执行的副作用（Placement/Update/Deletion）

  // 优先级
  lanes: Lanes, // 该 Fiber 的优先级（React 18 Lane 模型）
};
```

**Fiber Tree 是链表结构，不是普通树**：

```
App
 └── Header      child ↓
      └── Nav    child ↓，sibling →
 └── Main        ← sibling（Header 的兄弟）
      └── List

遍历顺序（深度优先 + 链表）：
App → Header → Nav → (return → Header) → Main → List
每一步都是独立的工作单元，可以在任意步骤暂停 ✅
```

---

### 双缓冲机制（Double Buffering）

React 维护**两棵 Fiber Tree**：

```
current Tree：当前屏幕上正在显示的内容
workInProgress Tree：正在后台构建的新内容

用户看到的永远是 current Tree
React 在 workInProgress Tree 上计算差异
计算完成后，两棵树互换（commit 阶段）→ workInProgress 变成新的 current
```

```
优点：
1. 后台默默计算，用户无感知
2. 计算过程随时可以丢弃（直接废弃 workInProgress Tree），不影响页面显示
3. commit 阶段是同步的，一旦开始就完成，不会显示中间状态
```

---

### 两个工作阶段

React 的渲染分为两个阶段：

#### 阶段一：Render 阶段（可中断）

```
构建 workInProgress Fiber Tree
对比新旧 Fiber（Diff 算法就在这里）
打上副作用标记（effectTag：新增/更新/删除）
这个阶段是纯计算，不操作 DOM，可以被打断
```

#### 阶段二：Commit 阶段（不可中断）

```
遍历副作用链表（effect list）
根据 effectTag 操作真实 DOM（插入/更新/删除）
执行生命周期：componentDidMount / componentDidUpdate
执行 useLayoutEffect
这个阶段必须一次性完成，不能中断（DOM 操作是不可逆的）
```

---

### 时间切片（Time Slicing）

React 利用 **`MessageChannel`**（或 `requestIdleCallback` 降级）实现时间切片，每帧给 React 留约 5ms 的执行窗口：

```
浏览器每帧（16.6ms @ 60fps）：
  ├── JS 执行（用户事件、React 渲染等）
  ├── Style 计算
  ├── Layout
  ├── Paint
  └── 空闲时间 → React 利用这段时间推进 Fiber 工作

React 执行逻辑：
  while (工作未完成 && 当前帧还有时间) {
    执行一个 Fiber 工作单元;
  }
  if (工作未完成) {
    // 让出主线程，等下一帧继续
    scheduleCallback(继续工作);
  }
```

---

### 优先级调度（Lane 模型）

React 18 引入 **Lane 模型**，用二进制位表示优先级，不同类型的更新有不同的 Lane：

```
SyncLane（同步）        → 最高优先级：离散用户事件（click、keydown）
InputContinuousLane    → 连续事件（scroll、mousemove）
DefaultLane            → 普通更新（setTimeout、fetch 后的 setState）
TransitionLane         → 过渡更新（useTransition 标记的更新）
IdleLane               → 空闲更新（offscreen 渲染）
```

高优先级的 Lane 可以打断低优先级 Lane 的渲染，被打断的低优先级工作会在高优先级完成后重新开始（重新执行，不是恢复）。

---

### Diff 算法：三大策略

Diff 算法在 Render 阶段，用于对比**旧 Fiber Tree** 和**新 ReactElement**，计算出最小变更。

React Diff 基于三个前提假设（降低 O(n³) 到 O(n)）：

```
策略一（同层比较）：只对同一层级的节点做对比，不跨层级
策略二（类型判断）：类型不同，直接销毁旧树，创建新树（不复用）
策略三（key 优化）：同类型的同层节点，通过 key 识别身份，实现高效复用
```

---

### Diff 的三种场景

#### 场景一：单节点 Diff

```jsx
// 旧：<div key="a">
// 新：<div key="a">  → key 相同、类型相同 → 复用旧节点，更新 props ✅
// 新：<p key="a">    → key 相同、类型不同 → 销毁旧节点，创建新节点 ❌
// 新：<div key="b">  → key 不同 → 销毁旧节点，创建新节点 ❌
```

#### 场景二：多节点 Diff（列表）—— 最复杂

```jsx
// 旧：[A, B, C, D]
// 新：[A, C, B, E]

// React 使用两轮遍历：
// 第一轮：从左到右，找出可复用的节点（key 和 type 都相同）
//   A→A：复用 ✅
//   B→C：key 不同，停止第一轮
// 第二轮：把旧节点存进 Map（key → fiber），用新节点去 Map 里找
//   C：在 Map 里找到旧 C，复用，标记移动（index > lastPlacedIndex）
//   B：在 Map 里找到旧 B，复用，标记移动
//   E：Map 里没有，新建，标记插入
//   剩余 D：Map 里还有，标记删除
```

```jsx
// 关键：React 不移动"最长不需要移动的序列"，而是移动其他节点
// 最终操作：D 删除，E 插入，C 和 B 根据 index 判断是否需要移动
```

#### 场景三：类型变化

```jsx
// 旧：<Counter />（函数组件）
// 新：<div />（DOM 元素）
// → 类型不同，直接卸载 Counter（触发 componentWillUnmount/useEffect cleanup），
//   创建新 div，不做任何复用
```

---

### key 的作用（面试必问）

```jsx
// 没有 key 时：React 按位置对比，位置相同就复用
// [A, B, C] → [B, C]
// 位置0：A vs B（type 相同），复用 A 的位置，更新 A 的内容为 B（低效！）

// 有 key 时：React 按 key 识别身份
// key="a"的A、key="b"的B → 直接删 A，复用 B、C（高效！）

// ❌ 为什么不能用 index 作为 key？
const list = ["Alice", "Bob", "Charlie"];
// 渲染：key=0:Alice, key=1:Bob, key=2:Charlie

// 删除 Alice 后：
// 渲染：key=0:Bob, key=1:Charlie
// React 认为 key=0 的节点还在（只是内容从 Alice 变成 Bob）→ 更新而不是删除
// 如果 Alice 有 input 焦点/动画等状态 → 状态会错乱 ❌

// ✅ 用稳定唯一的业务 ID
<li key={item.id}>{item.name}</li>;
```

---

### 速查对比表

| 概念            | 说明                                            |
| --------------- | ----------------------------------------------- |
| **Fiber**       | React 内部数据结构，链表节点，代表一个工作单元  |
| **Fiber Tree**  | 链表组成的树，支持遍历中断                      |
| **双缓冲**      | current + workInProgress 两棵树，计算完成后互换 |
| **Render 阶段** | 可中断，构建 workInProgress Tree，运行 Diff     |
| **Commit 阶段** | 不可中断，操作真实 DOM，执行生命周期/Effects    |
| **时间切片**    | 每帧分配时间片，超时让出主线程，下帧继续        |
| **Lane 模型**   | 二进制位表示优先级，高优先级打断低优先级        |
| **Diff 三策略** | 同层比较 + 类型判断 + key 复用                  |

---

### 面试高频题

#### 1. React Fiber 是什么？解决了什么问题？

```
问题：React 15 使用递归同步渲染，长时间占用主线程 → 页面卡顿

Fiber 解决方案：
1. 把渲染工作分解为链表上的一个个 Fiber 节点（工作单元）
2. 每次执行一个工作单元后检查是否还有剩余时间
3. 没时间了就让出主线程，等下帧继续
4. 高优先级任务（用户点击）可以打断低优先级渲染

核心能力：
- 可中断渲染（Interruptible Rendering）
- 优先级调度（Priority Scheduling）
- 并发模式基础（Concurrent Mode）
```

---

#### 2. Fiber 和虚拟 DOM（VNode）的区别？

```
虚拟 DOM（VNode）：描述 UI 结构的 JS 对象树（React.createElement 的输出）
Fiber：React 内部的工作单元，是对 VNode 的增强

VNode：
  { type: 'div', props: { className: 'box' }, children: [...] }
  纯粹的数据结构，描述"是什么"

Fiber：
  { type, key, stateNode, child, sibling, return,
    memoizedState（hooks链表）, effectTag, lanes, ... }
  包含渲染过程中需要的所有信息：指针、状态、副作用、优先级

关系：每个 VNode 对应一个 Fiber 节点
```

---

#### 3. React Diff 算法的时间复杂度是多少？如何优化到 O(n)？

```
朴素的树 Diff 算法：O(n³)（遍历 + 比较 + 排序）
React 的 Diff 算法：O(n)

优化手段（三个假设）：
1. 只做同层对比（放弃跨层移动节点的复用）
   → 跨层操作极少，可以直接删除 + 新建

2. 类型不同就直接销毁重建
   → div → p，组件 A → 组件 B，不做内部对比

3. key 提供稳定身份
   → 列表节点靠 key 识别，O(1) 查找而不是 O(n) 遍历

代价：放弃了一些极端情况下的最优解（如跨层移动）
收益：95% 的场景性能极好，整体远优于朴素算法
```

---

#### 4. React 的渲染过程（render 到 commit）详细说一下？

```
触发更新
  ↓
Schedule 调度阶段
  根据更新的类型分配优先级（Lane）
  通过调度器（Scheduler）安排执行时机
  ↓
Render 阶段（可中断）
  1. beginWork：从上到下处理每个 Fiber 节点
     - 对比新旧 props，决定是否需要更新
     - 执行函数组件 / class 组件的 render
     - 创建/复用子 Fiber，打 effectTag
  2. completeWork：从下到上归并
     - 创建/更新 DOM 节点（还未挂载）
     - 收集副作用到 effect list
  ↓
Commit 阶段（不可中断，三个子阶段）
  1. Before Mutation：DOM 变更前
     - 执行 getSnapshotBeforeUpdate
     - 调度 useEffect（异步）
  2. Mutation：操作 DOM
     - 根据 effectTag 插入/更新/删除 DOM
     - 执行 useLayoutEffect cleanup（同步）
  3. Layout：DOM 变更后
     - 执行 componentDidMount/componentDidUpdate
     - 执行 useLayoutEffect（同步）
     - current Tree 切换（workInProgress → current）
  之后异步执行 useEffect
```

---

#### 5. 为什么 React 的 Commit 阶段不能中断？

```
原因：Commit 阶段直接操作真实 DOM，DOM 操作是有副作用的、不可逆的

如果中断：
  - 删除了 A 节点，还没插入 B 节点 → 用户看到残缺状态
  - 执行了 componentDidMount 一半 → 副作用不完整
  - 无法恢复到一致的中间状态

React 的解决方案：
  Commit 阶段同步执行，但非常短（只遍历 effect list，不做 Diff）
  耗时长的 Diff 计算放在可中断的 Render 阶段
```

---

#### 6. key 的工作原理？为什么不能用 index 作为 key？

```
key 的作用：
  React 在 Diff 多子节点时，会把旧节点存入 Map<key, fiber>
  新节点渲染时，用自己的 key 去 Map 里找对应的旧 fiber
  找到了 → 复用（更新 props）
  没找到 → 新建
  Map 里剩余的 → 删除

index 作为 key 的问题：
  [A(0), B(1), C(2)] → 删除 A → [B(0), C(1)]
  key=0 还在，React 认为"key=0 的节点内容从 A 变成了 B" → 更新而不是删除
  如果组件内有 input/动画/定时器等内部状态 → 状态不会重置 → 错乱！

正确做法：
  用稳定的业务 ID（如 item.id）作为 key
  保证 key 在整个列表生命周期内唯一且稳定
```

---

#### 7. React 18 并发模式（Concurrent Mode）和 Fiber 的关系？

```
Fiber 是并发模式的基础设施：
  - 可中断：让并发成为可能（高优先级任务能打断低优先级）
  - Lane 优先级模型：为并发调度提供依据
  - 双缓冲：支持在后台准备新 UI，随时丢弃或提交

并发模式的上层 API（基于 Fiber 调度）：
  useTransition：把更新标记为低优先级 Transition Lane
  useDeferredValue：让值"延迟"响应，后台渲染新值
  Suspense + 流式 SSR：边加载边渲染，用占位符等待数据

一句话：Fiber 是"发动机"，并发模式是"驾驶舱"
```

---

### 一句话总结

> Fiber 把 React 渲染从"同步递归一口气干完"改成"链表分片可中断执行"，分为**可中断的 Render 阶段**（Diff + 打标记）和**不可中断的 Commit 阶段**（操作真实 DOM）。Diff 算法靠**同层比较 + 类型判断 + key 复用**将复杂度降至 O(n)。Fiber 是 React 并发模式（`useTransition`/`useDeferredValue`）的底层基础。

## HTTP 状态码

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

## HTTP 缓存机制

### 核心概念

HTTP 缓存是浏览器将服务器返回的资源存储在本地，下次请求同一资源时直接从本地读取，减少网络请求，提升页面加载速度。

缓存分为两大类：**强缓存**（不发请求）和**协商缓存**（发请求，服务器决定）。

---

### 完整缓存流程

```
浏览器发起请求
    ↓
1. 检查强缓存（Cache-Control / Expires）
    ↓ 命中 → 直接返回本地缓存（200 from memory/disk cache），不发请求 ✅
    ↓ 未命中（过期）
    ↓
2. 发请求，携带协商缓存标识（If-None-Match / If-Modified-Since）
    ↓ 服务器判断：资源未变化 → 返回 304 Not Modified（无响应体，浏览器用缓存）
    ↓ 服务器判断：资源已变化 → 返回 200 + 新资源内容
```

---

### 强缓存

不发网络请求，直接读取本地缓存。通过响应头控制。

#### Cache-Control（优先级更高，HTTP/1.1）

```
Cache-Control: max-age=3600        ← 相对时间，缓存 3600 秒
Cache-Control: no-cache            ← 不使用强缓存，每次都去服务器验证（走协商缓存）
Cache-Control: no-store            ← 完全不缓存，每次都请求全新内容
Cache-Control: public              ← 可被任何缓存（浏览器 + CDN 代理）缓存
Cache-Control: private             ← 只能被浏览器缓存（默认），CDN 不缓存
Cache-Control: must-revalidate     ← 缓存过期后必须重新验证，不能直接用过期缓存
```

**Cache-Control 常见指令含义：**

| 指令              | 含义                                           |
| ----------------- | ---------------------------------------------- |
| `max-age=N`       | 缓存 N 秒，期间不发请求                        |
| `no-cache`        | 每次必须向服务器验证（协商缓存），并非"不缓存" |
| `no-store`        | 完全不缓存，每次全量请求（真正的不缓存）       |
| `public`          | 可被 CDN/代理服务器缓存                        |
| `private`         | 只能浏览器缓存，不能被 CDN 缓存                |
| `must-revalidate` | 过期后不能使用陈旧缓存，必须重新验证           |
| `s-maxage=N`      | 代理服务器（CDN）的缓存时长，覆盖 max-age      |

> ⚠️ **`no-cache` ≠ 不缓存**：`no-cache` 是"先验证再使用"，资源还是会被缓存，只是每次用之前要去服务器确认。`no-store` 才是完全不缓存。

#### Expires（旧标准，HTTP/1.0）

```http
Expires: Wed, 01 Jan 2025 00:00:00 GMT
```

绝对时间，缺点是依赖客户端时钟，客户端时间不准会导致缓存判断出错。**已被 Cache-Control 取代，两者同时存在时 Cache-Control 优先。**

---

### 协商缓存

强缓存过期后，浏览器带上缓存标识发请求，由**服务器**判断资源是否变化。

#### ETag / If-None-Match（推荐，精确）

```
第一次请求：
  服务器响应 → ETag: "abc123"（资源内容的哈希值）

下次请求：
  浏览器请求 → If-None-Match: "abc123"
  服务器对比：
    ETag 未变 → 304 Not Modified（响应体为空，浏览器用本地缓存）
    ETag 已变 → 200 + 新内容 + 新 ETag
```

**优点**：精确，基于文件内容哈希，不受时间精度影响。

#### Last-Modified / If-Modified-Since（旧方式，精度秒级）

```
第一次请求：
  服务器响应 → Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT

下次请求：
  浏览器请求 → If-Modified-Since: Mon, 01 Jan 2024 00:00:00 GMT
  服务器对比：
    未修改 → 304 Not Modified
    已修改 → 200 + 新内容 + 新 Last-Modified
```

**缺点**：

1. 精度只到秒，1秒内多次修改无法识别
2. 文件内容没变但修改时间变了（比如重新部署），会错误地返回新内容

> **优先级**：`ETag / If-None-Match` 优先级高于 `Last-Modified / If-Modified-Since`，两者同时存在时以 ETag 为准。

---

### 两种缓存对比

| 对比项     | 强缓存                  | 协商缓存             |
| ---------- | ----------------------- | -------------------- |
| 是否发请求 | ❌ 不发                 | ✅ 发请求            |
| 响应码     | 200（from cache）       | 304（Not Modified）  |
| 控制方式   | Cache-Control / Expires | ETag / Last-Modified |
| 适用场景   | 变化频率低的静态资源    | 需要及时更新的资源   |

---

### 前端工程化的缓存策略（面试重点）

现代前端项目（Webpack/Vite 构建）的最佳缓存实践：

```
HTML 文件：Cache-Control: no-cache
  ↓ 原因：HTML 是入口，必须每次向服务器验证，确保引用的是最新的 JS/CSS
  ↓ 效果：浏览器每次都走协商缓存，服务器可以返回 304（快）或最新 HTML（有更新时）

JS / CSS / 图片（带 hash 的静态资源）：Cache-Control: max-age=31536000
  ↓ 原因：文件名包含内容 hash（如 main.a3b4c5.js），内容变了文件名就变了，是全新资源
  ↓ 效果：缓存一年，命中率极高，完全不发请求
```

**为什么可以永久缓存带 hash 的资源？**

```
构建产物举例：
  main.abc123.js   ← 内容哈希，内容变化时 hash 变化
  style.def456.css

发布新版本时：
  main.xyz789.js   ← 文件名变了 = 全新 URL = 不受旧缓存影响
  HTML 里的引用也更新了（html 走 no-cache，能拿到最新内容）

这样既保证老资源被浏览器缓存（性能好），
又保证新版本发布后用户能立即加载最新资源（不会用旧缓存）
```

**完整策略总结：**

```
nginx 配置示例：
  location /index.html {
    add_header Cache-Control "no-cache";   # HTML：每次验证
  }
  location /static/ {
    add_header Cache-Control "public, max-age=31536000, immutable";  # 静态资源：永久缓存
  }
  # immutable：告诉浏览器，资源在 max-age 期间内容绝对不会变，不用发重新验证请求
```

---

### 其他缓存类型

#### Service Worker 缓存

```
Service Worker 拦截所有网络请求，可以完全自定义缓存策略：
- Cache First（离线优先）：先查缓存，没有再请求网络
- Network First（网络优先）：先请求网络，失败再用缓存
- Stale While Revalidate：先返回缓存（快），后台同时更新缓存
```

#### Memory Cache vs Disk Cache

```
Memory Cache（内存缓存）：
  存在内存中，读取速度极快
  关闭 Tab 后清除
  通常是 JS/CSS 等当前页面用到的资源

Disk Cache（磁盘缓存）：
  存在硬盘中，读取速度较慢但持久
  重启浏览器后仍然存在
  体积较大的资源（图片等）倾向于存磁盘
```

---

### 面试高频题

#### 1. 强缓存和协商缓存的区别？

```
强缓存：不发请求，浏览器直接读本地缓存（200 from cache）
        靠 Cache-Control: max-age / Expires 控制有效期

协商缓存：发请求到服务器，服务器判断资源有没有变化
          资源没变 → 304（浏览器用本地缓存）
          资源变了 → 200 + 新资源

顺序：先走强缓存，强缓存过期后走协商缓存
```

---

#### 2. `no-cache` 和 `no-store` 的区别？

```
no-cache：
  不是"不缓存"，而是"每次使用缓存前必须先向服务器验证"
  资源还是会被存储，只是每次要验证一下
  走协商缓存（ETag / Last-Modified），服务器没变可以返回 304
  适合：HTML 入口文件（保证能拿到最新版本，但验证命中时很快）

no-store：
  完全不存储，每次都发完整请求，下载完整响应
  适合：敏感数据（如银行账单、个人隐私数据）
```

---

#### 3. ETag 和 Last-Modified 的区别，为什么 ETag 更精确？

```
Last-Modified（时间戳）：
  精度只到秒，1秒内多次修改无法区分
  文件内容没变但时间戳变了（重新部署）→ 误判为资源变化

ETag（内容哈希）：
  基于文件内容生成，内容不变 ETag 就不变，和时间无关
  精确反映内容是否变化，不受部署时间影响
  优先级更高（两者同时存在时，以 ETag 为准）
```

---

#### 4. 为什么 HTML 用 no-cache，静态资源用 max-age=很长时间？

```
静态资源（JS/CSS/图片）构建时带 content hash（如 app.a3b4c.js）：
  内容变了 → hash 变了 → URL 变了 → 旧缓存自然失效
  所以可以放心设置超长缓存（max-age=31536000），不用担心用户用到旧版

HTML 不带 hash：
  URL 永远是 /index.html，如果也缓存很久，发版后用户还会用旧 HTML
  旧 HTML 里引用的 JS/CSS 是旧 hash → 加载旧资源
  所以 HTML 必须设 no-cache，确保每次都能拿到最新 HTML
```

---

#### 5. 用户刷新页面和强制刷新有什么区别（缓存角度）？

```
普通刷新（F5 / Ctrl+R）：
  强缓存有效 → 200 from cache
  强缓存过期 → 协商缓存（If-None-Match / If-Modified-Since）

强制刷新（Ctrl+Shift+R / 清空缓存并刷新）：
  忽略所有本地缓存，发完整请求
  请求头不携带 If-None-Match / If-Modified-Since
  服务器必定返回 200 + 完整响应
```

---

### 一句话总结

> HTTP 缓存两级：**强缓存**（`Cache-Control: max-age`，不发请求，200 from cache）→ **协商缓存**（发请求，服务器验证，304 or 200）。前端工程化最佳实践：**HTML 设 `no-cache`（每次验证），带 hash 的静态资源设 `max-age=31536000`（永久缓存）**，靠 hash 变化让浏览器识别新版本。

## HTTP/1.1 vs HTTP/2 vs HTTP/3

### 核心概念

HTTP 协议经历了三代演进，每一代都是为了解决上一代的性能瓶颈：

```
HTTP/1.1（1997）→ 队头阻塞、多连接浪费
    ↓ 解决
HTTP/2（2015）→ 二进制分帧、多路复用（TCP 层队头阻塞还在）
    ↓ 解决
HTTP/3（2022）→ 基于 QUIC/UDP，彻底解决队头阻塞
```

---

### HTTP/1.1

**主要特性：**

```
持久连接（Keep-Alive）：默认复用 TCP 连接，不用每次都三次握手
管道化（Pipelining）：允许发多个请求不等响应，但响应必须按顺序返回
```

**核心问题：队头阻塞（Head-of-Line Blocking）**

```
请求必须排队：
  请求1 → 请求2 → 请求3（必须等请求1响应回来才能处理请求2）

  如果请求1很慢，后面的请求都被阻塞，即使服务器已经处理好了请求2、3
```

**浏览器的绕过方案：**

```
每个域名最多 6 个 TCP 连接（并行请求）
  → 前端优化：域名分片（把资源分散到多个子域名）
  → 但 6 条连接本身有握手/慢启动开销
```

---

### HTTP/2

**核心改进：**

#### 1. 二进制分帧（Binary Framing）

```
HTTP/1.1：文本协议，请求/响应是纯文本
HTTP/2：二进制协议，数据分成帧（Frame）传输

帧是最小传输单元，每帧携带：
  - Stream ID（属于哪个请求流）
  - 帧类型（数据帧/头部帧/设置帧等）
  - 数据内容

好处：解析效率更高，错误检测更可靠
```

#### 2. 多路复用（Multiplexing）—— 最重要

```
HTTP/1.1：一个 TCP 连接同一时刻只能处理一个请求（队头阻塞）
HTTP/2：一个 TCP 连接可以同时并行传输多个请求和响应

原理：每个请求/响应分配一个 Stream ID
  → 帧可以交错发送（Stream1的帧、Stream2的帧交替传输）
  → 接收方按 Stream ID 重新组装

效果：完全解决 HTTP 层的队头阻塞
```

```
HTTP/1.1（6个连接）：
  连接1: ████████ (请求A) 等 ████ (请求B)
  连接2: ████ (请求C) 等
  ...

HTTP/2（1个连接，多路复用）：
  连接1: [A帧][B帧][A帧][C帧][B帧] 交错传输，互不阻塞 ✅
```

#### 3. 头部压缩（HPACK）

```
HTTP/1.1：每次请求都要携带完整的 HTTP 头（Cookie、UA 等动辄几百字节）
HTTP/2：HPACK 算法压缩头部
  - 静态表：预定义 61 个常见头部字段（如 :method GET）
  - 动态表：已发送的头部缓存，后续用索引代替完整字符串
  - 效果：重复头部压缩率可达 90%+
```

#### 4. 服务器推送（Server Push）

```
HTTP/1.1：客户端请求 index.html → 解析 HTML → 再请求 main.js、style.css
HTTP/2：服务器可以主动推送资源，客户端还没请求就提前发过来

实际使用：已基本被废弃（Chrome 2022 年移除了对 Server Push 的支持）
          因为客户端本地有缓存时，Push 反而浪费带宽
```

**HTTP/2 残留问题：TCP 层队头阻塞**

```
HTTP/2 解决了 HTTP 层的队头阻塞，但 TCP 层的队头阻塞还在：

TCP 是可靠传输，如果一个数据包丢失，后续所有数据包都要等重传
  → 即使 HTTP/2 多路复用，底层 TCP 一个包丢了，所有 Stream 都被阻塞

网络越差（丢包率高），HTTP/2 的多路复用优势越小，甚至不如 HTTP/1.1
```

---

### HTTP/3

**核心改变：用 QUIC 替代 TCP**

```
HTTP/3 = HTTP（语义层）+ QUIC（传输层）
QUIC = UDP + 可靠性保证 + 加密（TLS 1.3 内置）
```

#### 1. 彻底解决队头阻塞

```
QUIC 在 UDP 上实现了流（Stream）的独立传输：
  - 每个 Stream 独立，一个 Stream 丢包不影响其他 Stream
  - HTTP/2 的 TCP 丢包 → 所有 Stream 阻塞
  - HTTP/3 的 QUIC 丢包 → 只有对应的 Stream 阻塞，其他继续传输 ✅
```

#### 2. 0-RTT / 1-RTT 握手（建连更快）

```
TCP + TLS 1.2：3次握手（1.5RTT）+ TLS 握手（2RTT）= 3.5RTT
TCP + TLS 1.3：3次握手（1.5RTT）+ TLS 握手（1RTT）= 2.5RTT
QUIC（首次）：1-RTT（握手 + 加密协商合并）
QUIC（重连）：0-RTT（直接发数据，服务器用缓存的会话信息验证）

0-RTT 的意义：移动端网络切换（4G → WiFi）时，几乎感知不到重新建连
```

#### 3. 连接迁移（Connection Migration）

```
HTTP/1.1 / 2 基于 TCP：连接由 "源IP + 源端口 + 目标IP + 目标端口" 四元组标识
  网络切换（WiFi → 4G）→ IP 变了 → TCP 连接断开 → 需要重新建立

HTTP/3 基于 QUIC：连接由 Connection ID 标识（与 IP/端口无关）
  网络切换 → Connection ID 不变 → 连接无缝迁移 → 手机切网无感 ✅
```

---

### 三代协议对比表

| 特性           | HTTP/1.1      | HTTP/2           | HTTP/3              |
| -------------- | ------------- | ---------------- | ------------------- |
| **传输层**     | TCP           | TCP              | QUIC（UDP）         |
| **协议格式**   | 文本          | 二进制帧         | 二进制帧            |
| **多路复用**   | ❌            | ✅               | ✅                  |
| **头部压缩**   | ❌            | ✅ HPACK         | ✅ QPACK            |
| **队头阻塞**   | HTTP层+TCP层  | 仅TCP层          | ❌ 彻底解决         |
| **握手RTT**    | 1.5RTT + TLS  | 1.5RTT + TLS     | 1-RTT / 0-RTT       |
| **连接迁移**   | ❌            | ❌               | ✅ Connection ID    |
| **服务器推送** | ❌            | ✅（已废弃）     | ✅（实验中）        |
| **加密**       | 可选（HTTPS） | 可选（实践强制） | 强制（TLS 1.3内置） |

---

### HTTPS 与 TLS（面试常问）

```
HTTPS = HTTP + TLS（Transport Layer Security）

TLS 握手过程（简化版）：
1. Client Hello：客户端发送支持的加密套件、随机数
2. Server Hello：服务器选择加密套件，发送证书（公钥）、随机数
3. 客户端验证证书（CA 签名验证）
4. 客户端用公钥加密"预主密钥"发给服务器
5. 双方用三个随机数生成"会话密钥"（对称密钥）
6. 后续通信使用对称加密（AES 等）

为什么混合加密（非对称 + 对称）？
  非对称加密（RSA/ECDHE）：安全但慢，只用于握手阶段交换密钥
  对称加密（AES）：快，用于实际数据传输
```

---

### 面试高频题

#### 1. HTTP/2 的多路复用和 HTTP/1.1 的 Keep-Alive 有什么区别？

```
Keep-Alive（HTTP/1.1）：
  复用 TCP 连接，但同一时刻一条连接只能处理一个请求
  请求必须串行：请求1完成 → 请求2 → 请求3
  虽然不用每次建TCP连接，但还是有队头阻塞

多路复用（HTTP/2）：
  一条 TCP 连接同时并行传输多个请求/响应
  请求/响应以"帧"为单位交错传输，用 Stream ID 区分
  真正的并行，无需等待前一个完成

本质区别：Keep-Alive 是"复用连接"，多路复用是"并行请求"
```

---

#### 2. HTTP/2 解决了队头阻塞，为什么还需要 HTTP/3？

```
HTTP/2 解决了 HTTP 层的队头阻塞（应用层多路复用）
但底层是 TCP，TCP 本身有队头阻塞：

TCP 保证数据包有序到达，一个包丢失 → 所有后续包等重传
  即使 HTTP/2 有 10 个 Stream，TCP 一个包丢了 → 10 个 Stream 全阻塞

  TCP 不知道上层是什么（HTTP/2 还是别的协议）
  TCP 只负责：给你一个"完整的、有序的字节流"

  如果乱序交付（比如先给包3、4、5），
  HTTP/2 解析到一半的数据是错乱的，完全无法使用
  所以 TCP 必须"等到缺失的包补来，才能按序交付"

HTTP/3 用 QUIC（基于 UDP）：
  每个 Stream 数据包独立传输，互不依赖
  一个 Stream 丢包 → 只影响这个 Stream，其他 Stream 正常

特别是在移动网络（丢包率高）场景，HTTP/3 优势明显
```

---

#### 3. 为什么 QUIC 基于 UDP 而不是 TCP？

```
TCP 的问题：
  1. 队头阻塞：有序传输，丢包要等重传
  2. 握手慢：3次握手（1.5RTT）+ TLS（1-2RTT）
  3. 协议僵化：TCP 在操作系统内核实现，升级困难
  4. 不支持连接迁移：基于四元组，IP变了连接断

选 UDP 的原因：
  UDP 本身是"无状态裸传"，QUIC 在 UDP 之上自己实现：
    - 可靠传输（确认 + 重传）
    - 流量控制
    - 拥塞控制
    - 加密（TLS 1.3 内置，无需额外握手）

  在用户态实现，升级部署灵活（不需要改内核）
  彻底重设计，没有历史包袱
```

---

#### 4. HTTP/3 的 0-RTT 是什么？有什么安全风险？

```
0-RTT：客户端重连时，直接在第一个数据包里附带请求数据，无需等握手完成

原理：
  首次连接 → 服务器发给客户端"会话票据"（Session Ticket）
  下次连接 → 客户端用票据直接发 0-RTT 数据，服务器验证后立即处理

安全风险：重放攻击（Replay Attack）
  攻击者截获 0-RTT 数据包，重新发送
  服务器可能重复处理同一个请求（如重复转账）

缓解措施：
  0-RTT 只用于幂等请求（GET、HEAD）
  服务器记录 nonce（一次性随机数），防止重放
  敏感操作（POST/支付等）不走 0-RTT
```

---

#### 5. 前端开发需要关心 HTTP 版本吗？如何查看？

```
查看方式：
  Chrome DevTools → Network → 选中请求 → Headers → 查看 Protocol 列
  或在 Network 面板列头右键，勾选 "Protocol" 列

前端能做的优化（针对不同版本）：
  HTTP/1.1 时代：
    - 合并资源（CSS Sprites、JS/CSS 打包）减少请求数
    - 域名分片（多域名绕过 6 个连接限制）

  HTTP/2 时代（以上优化反而有害）：
    - 不需要合并资源（多路复用，请求数不是瓶颈）
    - 不需要域名分片（多域名反而增加握手开销）
    - 应该拆分资源（细粒度缓存，改一个文件不影响其他文件的缓存）

  HTTP/3 时代：
    - 移动端体验会显著提升（弱网/切网无感）
    - CDN 支持 HTTP/3（阿里云、Cloudflare 等已支持）
```

---

### 一句话总结

> HTTP/1.1 靠多连接绕开队头阻塞；HTTP/2 用**二进制分帧 + 多路复用**解决 HTTP 层队头阻塞，但 TCP 层阻塞依然存在；HTTP/3 用 **QUIC（基于 UDP）**彻底解决队头阻塞，并带来 0-RTT 快速建连和连接迁移能力。前端实践：**HTTP/2 下不需要合并资源、不需要域名分片**，反而应该细粒度拆分资源配合长缓存。

## TCP 三次握手 / 四次挥手

### 核心概念

TCP（Transmission Control Protocol）是**面向连接、可靠传输**的传输层协议。建立连接需要**三次握手**，断开连接需要**四次挥手**。

```
为什么需要握手/挥手？
  TCP 是全双工通信（双方都能收发数据）
  建立连接：双方都要确认"我能发、你能收；你能发、我能收"
  断开连接：双方都要各自关闭自己的发送通道（所以多一次）
```

---

### 三次握手（建立连接）

```
客户端（Client）                    服务器（Server）
     |                                    |
     |  ① SYN（seq=x）                   |   客户端发：我想连接，序号是 x
     | ---------------------------------> |   Server 状态：SYN_RECEIVED
     |                                    |
     |  ② SYN + ACK（seq=y, ack=x+1）   |   服务器回：收到了，我也想连接，序号是 y
     | <--------------------------------- |
     |                                    |
     |  ③ ACK（ack=y+1）                 |   客户端回：收到了，连接建立！
     | ---------------------------------> |   双方状态：ESTABLISHED
     |                                    |
```

**三次握手详解：**

```
第一次握手：Client → Server  发送 SYN（同步序列号）
  Client 说："我要连接你，我的序号是 x"
  Client 状态：SYN_SENT

第二次握手：Server → Client  发送 SYN + ACK
  Server 说："收到，我同意，我的序号是 y，我期待你下一个包的序号是 x+1"
  Server 状态：SYN_RECEIVED

第三次握手：Client → Server  发送 ACK
  Client 说："收到，期待你下一个包的序号是 y+1"
  双方状态：ESTABLISHED（连接建立）
```

---

### 四次挥手（断开连接）

```
客户端（Client）                    服务器（Server）
     |                                    |
     |  ① FIN（seq=u）                   |   客户端发：我不再发数据了（但还能收）
     | ---------------------------------> |   Client 状态：FIN_WAIT_1
     |                                    |
     |  ② ACK（ack=u+1）                 |   服务器回：收到，我知道你要关了
     | <--------------------------------- |   Client 状态：FIN_WAIT_2
     |                                    |   （Server 可能还有数据要发）
     |  ③ FIN（seq=v）                   |   服务器发：我的数据也发完了，我也要关了
     | <--------------------------------- |   Server 状态：LAST_ACK
     |                                    |
     |  ④ ACK（ack=v+1）                 |   客户端回：收到，我等 2MSL 后关闭
     | ---------------------------------> |   Client 状态：TIME_WAIT → CLOSED
     |                                    |   Server 状态：CLOSED
```

**四次挥手详解：**

```
第一次挥手：Client → Server  发送 FIN
  Client 说："我没有数据要发了，申请关闭"
  Client 进入 FIN_WAIT_1

第二次挥手：Server → Client  发送 ACK
  Server 说："收到，但我可能还有数据要发，稍等"
  Client 进入 FIN_WAIT_2（半关闭状态：Client 不发，但能收）

第三次挥手：Server → Client  发送 FIN
  Server 说："我的数据也发完了，我也要关闭了"
  Server 进入 LAST_ACK

第四次挥手：Client → Server  发送 ACK
  Client 说："收到，再见"
  Client 进入 TIME_WAIT（等待 2MSL 后彻底关闭）
  Server 收到 ACK 后立即关闭
```

---

### TIME_WAIT（面试重点）

```
为什么需要 TIME_WAIT？等待 2MSL（最大报文段生存时间，约 1-2 分钟）

原因一：确保最后一个 ACK 能到达服务器
  如果 Client 最后的 ACK 丢失了，Server 会重发 FIN
  Client 在 TIME_WAIT 期间能重发 ACK，避免 Server 永远等待

原因二：让网络中残留的旧数据包自然消亡
  防止旧连接的延迟包被新连接误收
  2MSL = 一来一回的最大存活时间，过了之后旧包必定已消失
```

---

### 为什么是三次握手，不是两次或四次？

```
两次握手不够：
  Server 无法确认 Client 能接收到 Server 的数据
  场景：旧的 SYN 延迟到达 → Server 建连 → Client 早就放弃了 → Server 资源浪费

四次握手多余：
  第二次握手时，Server 可以把 SYN 和 ACK 合并成一个包发送
  所以三次就够了

三次握手的本质：
  最少需要 3 次，才能保证双方都确认了"我能发、对方能收"
  第1次：Client 能发，Server 能收 ✅
  第2次：Server 能发，Client 能收 ✅（Client 收到了 Server 的 SYN+ACK）
  第3次：让 Server 确认 Client 确实收到了自己的 SYN+ACK ✅
```

---

### 为什么是四次挥手，不是三次？

```
TCP 是全双工的：双方各有独立的发送通道，需要分别关闭

关闭流程：
  Client 关闭发送通道（FIN） → Server 确认（ACK）
  Server 关闭发送通道（FIN） → Client 确认（ACK）

为什么不能像握手一样合并？
  第二次挥手（ACK）和第三次挥手（FIN）不能合并：
  Server 收到 Client 的 FIN 后，可能还有数据没发完
  需要先 ACK（告诉 Client 我知道了），等数据发完再 FIN

  如果 Server 没有剩余数据，则第二、三次挥手会合并 → 变成三次挥手
  （这也是 TCP 协议允许的，称为"同时关闭"场景）
```

---

### TCP 状态速查

```
建立连接时的状态变化：
  Client: CLOSED → SYN_SENT → ESTABLISHED
  Server: CLOSED → LISTEN → SYN_RECEIVED → ESTABLISHED

断开连接时的状态变化（主动关闭方=Client）：
  Client: ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED
  Server: ESTABLISHED → CLOSE_WAIT → LAST_ACK → CLOSED
```

---

### SYN Flood 攻击（面试加分项）

```
攻击原理：
  攻击者伪造大量 SYN 包，占满 Server 的半连接队列（SYN_RECEIVED 状态）
  Server 为每个 SYN 分配资源等待 ACK，但 ACK 永远不来
  导致正常连接无法建立（拒绝服务 DoS 攻击）

防御手段：
  SYN Cookie：Server 不立即分配资源，用算法生成 Cookie 作为 ISN
               等收到第三次握手的 ACK 后再验证，合法才建连
  缩短 SYN 等待超时时间
  防火墙限制单 IP 的 SYN 频率
```

---

### 面试高频题

#### 1. 为什么 TCP 建立连接需要三次握手？

```
核心：三次是最少次数，能保证双方都确认"我能发、对方能收"

第一次：Client → Server  SYN
  证明：Client 能发送数据

第二次：Server → Client  SYN+ACK
  证明：Server 能收（收到了 SYN）且能发（发出了 SYN+ACK）
        Client 能收（收到了 SYN+ACK）

第三次：Client → Server  ACK
  证明：Server 收到了 Client 的确认，连接可靠建立

少于三次（两次）的问题：
  两次握手，Server 无法确认 Client 能接收数据
  历史失效的 SYN 包可能导致 Server 错误建立连接，浪费资源
```

---

#### 2. 为什么断开连接需要四次挥手，不是三次？

```
TCP 是全双工通信，发送和接收是独立的两条通道

断开时，两条通道需要分别关闭：
  Client → Server：Client 的发送通道关闭（FIN + ACK）
  Server → Client：Server 的发送通道关闭（FIN + ACK）

为什么第二次和第三次不能合并？
  Server 收到 Client 的 FIN 时，可能还有数据没发完
  需要先 ACK（确认收到），等数据发完再发 FIN
  所以必须是独立的两个包

特殊情况：Server 没有剩余数据发送时，可以合并 ACK+FIN，变成三次挥手
```

---

#### 3. TIME_WAIT 状态为什么要等 2MSL？

```
MSL（Maximum Segment Lifetime）：报文段最大生存时间，通常 30s-1min

等待 2MSL 的两个原因：

原因1：保证最后一个 ACK 能成功到达 Server
  如果 Client 的最后 ACK 丢失，Server 会重发 FIN
  Client 在 TIME_WAIT 期间收到重发的 FIN，可以重新发 ACK
  2MSL = ACK 到 Server 的时间（1MSL）+ Server 重发 FIN 到 Client 的时间（1MSL）

原因2：让本次连接的所有报文段在网络中消亡
  防止旧连接的延迟包被新连接误收
  2MSL 后，所有旧包必定已超时丢弃
```

---

#### 4. TCP 和 UDP 的区别？

```
TCP（面向连接）：
  建立连接：三次握手
  可靠传输：确认 + 重传 + 有序
  流量控制：滑动窗口
  拥塞控制：慢启动、拥塞避免
  速度：较慢（保证可靠）
  场景：HTTP/HTTPS、文件传输、邮件

UDP（无连接）：
  无需建立连接，直接发送
  不可靠：不保证到达、不保证有序、不重传
  速度：快（无额外开销）
  场景：视频直播、游戏、DNS 查询、QUIC（在应用层自己实现可靠性）

对比表：
```

| 特性     | TCP       | UDP           |
| -------- | --------- | ------------- |
| 连接     | 面向连接  | 无连接        |
| 可靠性   | ✅ 可靠   | ❌ 不可靠     |
| 有序性   | ✅ 有序   | ❌ 无序       |
| 速度     | 较慢      | 快            |
| 头部开销 | 20字节    | 8字节         |
| 适用场景 | 文件/网页 | 直播/游戏/DNS |

---

#### 5. TCP 如何保证可靠传输？

```
1. 序列号（Sequence Number）：
   每个字节都有编号，接收方按序号重组数据

2. 确认应答（ACK）：
   接收方收到数据后发 ACK，发送方确认对方已收到

3. 超时重传：
   发送方设置计时器，超时未收到 ACK → 重传该数据包

4. 流量控制（滑动窗口）：
   接收方告知发送方自己的缓冲区大小（窗口大小）
   发送方不能超过窗口大小发数据，防止淹没接收方

5. 拥塞控制：
   慢启动：从小窗口开始，指数级增大
   拥塞避免：达到阈值后，线性增大
   快重传/快恢复：收到 3 个重复 ACK，直接重传而不等超时
```

---

### 速查对比表

| 概念           | 说明                                         |
| -------------- | -------------------------------------------- |
| **三次握手**   | 建立连接，确认双方收发能力，最少需要 3 次    |
| **四次挥手**   | 断开连接，全双工各自关闭发送通道             |
| **SYN**        | 同步序列号，请求建立连接                     |
| **FIN**        | 结束标志，请求关闭连接                       |
| **ACK**        | 确认号，确认收到数据                         |
| **TIME_WAIT**  | 主动关闭方等待 2MSL，确保 ACK 到达且旧包消亡 |
| **CLOSE_WAIT** | 被动关闭方收到 FIN 后，还有数据未发完的状态  |
| **SYN Flood**  | 伪造大量 SYN，占满半连接队列，DoS 攻击       |

---

### 一句话总结

> TCP 三次握手确保双方都具备收发能力（最少三次）；四次挥手因为 TCP 全双工、双方各自关闭发送通道所以多一次；**TIME_WAIT 等待 2MSL** 是为了保证最后 ACK 到达且旧包消亡。前端面试关注点：握手次数原因、TIME_WAIT 作用、TCP vs UDP 区别、SYN Flood 攻击原理。

## harness

早起 AI 工程化其实是经历过三次变革的，第一次是提示词工程，初期我们接触大模型，为了让大模型生成更符合我们的结果，我们会通过提示词去约束他，比如设置一些类似soul.md 设置他是一个什么身份，等等，要求他输出的格式等等。

大模型本质是一个概率生成系统，我们通过提示词约束他的生成的概率空间，让他往我们希望的空间方向上去生成，早期的prompt提示词其实是在做语言的设计

但是提示词就很快有瓶颈，当我们想要他根据比如我们的工程文档为范本，阅读理解范本生成对应结果，这时候提示词工程就无能为力。
提示词是比较适合长期任务约束输出，激发模型的已有能力。
但是没法 弥补缺失的知识，管理动态信息，处理长联路任务里的状态。

这时候的新的路线就出现了，我们的上下文工程，之前提示词工程的时候我们可能只是做简单的对话，但是后来我们agent 需要 去复杂环境处理问题，多轮对话，写代码，阅读文件等等

上下文工程也不仅仅是做RAG检索，他是需要具备完整的链路，
文档怎么切块，结果怎么排序
长文怎么压缩
历史对话什么要保留，什么时候压缩摘要
skill工具返回要不要全部暴露给模型
多个 Agent 之间到底如何传递数据等等

上下文优化不只是给的更多就越好，而是按需给，分层给，在正确的时机给

上下文工程其实已经是很好工程化的落地了，但是不管我们如何的优化最后的结果还是有概率是错误偏差的。
这时候我们就需要思考如何去保证这个质量，harness Engineerig 马鞍工程就是来做这个质量纠正的，当模型开始连续行动的时候，来监督它、约束他和纠偏它。

前两代模型是让al跑的更好更快更远
harness 关注的是如如何让模型**别跑偏跑的稳，出了错还能拉回来**

完整的 harness Engineering 的六层架构

第一层：上下文管理
角色的目标和定义（比如定义你是一个什么样子的人）
信息的裁剪和选择（比如拖入相关的文件）
结构化的组织 （比如定义规则放在哪里，当前任务放在哪里，运行状态等等）

第二层工具系统
大模型本质是文本预测器，会解释总结，但它接触不到真实的世界，只有帮助他链接上工具，比如搜网页，读文档，写代码，调api等等，但是我们不仅仅是把工具给他就可以

1. 给他什么工具
2. 什么时候调用工具
3. 工具结果怎么重新喂回模型

第三层任务编排
agent 正常是只知道当前要干什么，但是不知道下一步该干什么，让他做一件单独的事情他是能够满足的，比如查代码，但是查完之后，下一步该干嘛，如果没有任务编排的话，他交付的东西就是一段乱七八糟的产物，或者说是一堆半成品

正常完成的一个任务是需要这样的一个轨道：
理解目标 -》判断信息是否足够，不够继续获取补充信息 -〉基于结果继续分析-》生成输出-〉检查数据 -》不满足要求就修正或重试

第四层记忆和状态
如果没有状态，agent 每一轮都不知道刚刚做了什么，状态到哪里了，哪些结论确认了，哪些问题还没解决，需要管理状态

1. 了解当前任务的状态
2. 会话中的中间结果
3. 长期的记忆和用户偏好

第五层评估和观测（需要构建一个这个的系统对整个过程做验收）
对产物需要有独立的评估和观测的能力

输出和验收环节的验证 → 这次生成的结果达标了吗？
自动的测试 → 批量跑，看通过率多少？
日志和指标 → 系统层面：延迟多少、成功率多少、哪个环节最容易挂？
错误的归因 → 这次失败是哪里出了问题？是检索没搜到？还是模型理解错了？

第六层约束校验与失败恢复（实时干预，面向“运行时稳定”）
决定一个系统能不能上线的关键，真实的环境里，失败不是例外，而是常态

1. 约束 执行之前规定边界，防止模型做不该做的事（比如禁止删数据库、禁止调用某些 API）
2. 校验 执行过程中校验，参数校验，结构校验，语法校验等
3. 恢复 重试降级回滚让系统从错误中活下去

一些实践
上下文交易
上下文压缩，可能会丢失关键内容，注意力涣散，认知疲劳
上下文重启
直接重启一个新的agent 将之前的
问题 执行到哪里产生的结果，还需要做什么交付给下一个agent

自评失真
自己给自己打分会比较乐观，拆分角色和职责，验收和完成需求的人分别给到两个人

渐进式纰漏
写一个巨大的 `agent.md`把所有规范框架约定写进一个目录里面，上下文过长，只保留目录索引渐进式的获取需要的内容

## 小程序

### 核心概念

微信小程序是运行在微信客户端的轻量级应用，基于**双线程模型**构建，逻辑层与渲染层分离，通过 Native 桥通信。

---

### 双线程模型（核心架构）

```
┌──────────────────────────────────────────────────┐
│                   微信客户端（Native）              │
│                                                    │
│  ┌─────────────────┐     ┌──────────────────────┐  │
│  │   渲染层（WebView）│     │  逻辑层（JS Engine）  │  │
│  │                 │     │                      │  │
│  │  WXML + WXSS    │     │  app.js / page.js    │  │
│  │  负责 UI 渲染    │◄───►│  数据处理 / 网络请求  │  │
│  │                 │ JSB │  setData 触发更新     │  │
│  └─────────────────┘ridge└──────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**为什么要双线程？**

```
Web 单线程模型缺陷：JS 和 UI 渲染共享同一线程
  → JS 执行时间过长 → 页面卡顿（主线程被阻塞）
  → 开发者可以直接操作 DOM → 安全性差（XSS 等风险）

小程序双线程方案：
  渲染层：只负责 UI，运行在独立 WebView
  逻辑层：只负责数据和逻辑，运行在独立 JS 引擎（不能访问 DOM）
  通信：通过 JSBridge（Native 中转），数据序列化后传递
```

**双线程的代价：**

```
- 逻辑层无法直接操作 DOM（不能用 document.querySelector）
- 通信需要序列化，频繁 setData 会有性能损耗
- 页面初次渲染比普通 Web 多一次通信开销
```

---

### 生命周期

#### 应用生命周期（App）

```js
App({
  onLaunch(options) {
    // 小程序初始化完成，全局只触发一次
    // options：{ path, query, scene, referrerInfo }
  },
  onShow(options) {
    // 小程序启动，或从后台进入前台
  },
  onHide() {
    // 小程序从前台进入后台（按Home键、切换小程序）
  },
  onError(msg) {
    // 脚本错误或 API 调用失败
  },
  globalData: {}, // 全局数据
});
```

#### 页面生命周期（Page）

```js
Page({
  onLoad(options) {
    // 页面加载，只触发一次
    // options：URL 中的查询参数
  },
  onShow() {
    // 页面显示（每次进入都触发，包括从其他页面返回）
  },
  onReady() {
    // 页面初次渲染完成，只触发一次
    // 此时可以操作页面元素（如 createSelectorQuery）
  },
  onHide() {
    // 页面隐藏（navigateTo 到其他页面、小程序切后台）
  },
  onUnload() {
    // 页面卸载（redirectTo / navigateBack）
  },
  // 页面事件处理
  onPullDownRefresh() {}, // 下拉刷新
  onReachBottom() {}, // 上拉触底
  onShareAppMessage() {}, // 点击分享
  onPageScroll(e) {}, // 页面滚动
});
```

**完整生命周期时序：**

```
onLaunch（App）→ onShow（App）
  → onLoad（Page）→ onShow（Page）→ onReady（Page）
  → [使用中]
  → navigateTo 新页面：当前页 onHide → 新页 onLoad/onShow/onReady
  → navigateBack：当前页 onUnload → 上一页 onShow
  → 小程序切后台：onHide（Page）→ onHide（App）
  → 再次进入：onShow（App）→ onShow（Page）
```

#### 组件生命周期

```js
Component({
  lifetimes: {
    created() {
      // 组件实例刚创建，不能调用 setData
    },
    attached() {
      // 组件挂载到页面节点树，可以调用 setData
    },
    ready() {
      // 组件布局完成，可以获取节点信息
    },
    moved() {
      // 组件被移动到节点树另一个位置
    },
    detached() {
      // 组件从页面节点树移除（清理定时器等副作用）
    },
  },
  pageLifetimes: {
    show() {}, // 组件所在页面显示时触发
    hide() {}, // 组件所在页面隐藏时触发
  },
});
```

---

### `setData` 的原理与优化

#### 原理

```
逻辑层调用 setData(data)
  → 数据 JSON.stringify 序列化
  → 通过 JSBridge 发送到渲染层
  → 渲染层 diff 数据，更新对应 DOM
  → 渲染完成后回调
```

#### setData 性能问题

```
1. 数据量过大：序列化耗时，通信耗时
2. 频率过高：多次 setData 堆积，渲染层处理不过来
3. 不必要的字段更新：把整个对象 setData，即使只变了一个字段
```

#### 优化方案

```js
// ❌ 每次操作都触发 setData
this.setData({ list: [...this.data.list, newItem] });
this.setData({ loading: false });

// ✅ 合并成一次 setData
this.setData({
  list: [...this.data.list, newItem],
  loading: false,
});

// ❌ 更新嵌套对象整体传递
this.setData({ userInfo: { ...this.data.userInfo, name: "新名字" } });

// ✅ 用路径语法只更新变化的字段
this.setData({ "userInfo.name": "新名字" });

// ❌ 循环中频繁 setData
list.forEach((item) => {
  this.setData({ [`items[${index}].checked`]: true }); // 每次都触发通信
});

// ✅ 一次性构建好再 setData
const updates = {};
list.forEach((item, index) => {
  updates[`items[${index}].checked`] = true;
});
this.setData(updates); // 一次通信
```

---

### 路由跳转

```js
// navigateTo：保留当前页，跳转到新页面（页面栈 +1，最多 10 层）
wx.navigateTo({ url: "/pages/detail/index?id=123" });

// redirectTo：关闭当前页，跳转（页面栈不增加）
wx.redirectTo({ url: "/pages/login/index" });

// navigateBack：返回上一页（或多级）
wx.navigateBack({ delta: 1 }); // delta 表示返回几层

// switchTab：跳转到 tabBar 页面，关闭所有非 tabBar 页面
wx.switchTab({ url: "/pages/home/index" });

// reLaunch：关闭所有页面，打开新页面（页面栈清空）
wx.reLaunch({ url: "/pages/home/index" });
```

**页面间传参：**

```js
// 跳转时传参（URL 拼接）
wx.navigateTo({ url: '/pages/detail/index?id=123&type=article' });

// 目标页面 onLoad 接收
onLoad(options) {
  console.log(options.id);   // '123'
  console.log(options.type); // 'article'
}

// 返回时传参：使用 EventChannel（推荐）
// 跳转时
wx.navigateTo({
  url: '/pages/picker/index',
  events: {
    selectItem: (data) => {
      console.log('收到数据', data);
    }
  }
});

// 子页面回传
const eventChannel = this.getOpenerEventChannel();
eventChannel.emit('selectItem', { id: 1, name: '选项A' });
wx.navigateBack();
```

---

### 数据通信方式

#### 1. URL 参数（跳转传参）

```js
// 适合简单参数
wx.navigateTo({ url: "/pages/detail?id=123" });
```

#### 2. 全局 globalData

```js
// app.js
App({ globalData: { userInfo: null, token: "" } });

// 任意页面读写
const app = getApp();
app.globalData.token = "xxx";
console.log(app.globalData.userInfo);
```

#### 3. 本地存储

```js
// 同步（简单）
wx.setStorageSync("key", value);
const val = wx.getStorageSync("key");

// 异步（推荐，不阻塞）
wx.setStorage({ key: "userInfo", data: { name: "maoyan" } });
wx.getStorage({ key: "userInfo", success: (res) => console.log(res.data) });
```

#### 4. 事件总线（EventChannel / 自定义事件）

```js
// 父传子：properties
// 子传父：triggerEvent
Component({
  methods: {
    handleTap() {
      this.triggerEvent("select", { id: this.data.id }); // 向父组件发送事件
    },
  },
});

// 父组件监听
// <my-comp bind:select="onSelect" />
Page({
  onSelect(e) {
    console.log(e.detail.id);
  },
});
```

---

### 组件通信

```
父 → 子：properties（props）+ selectComponent 获取子组件实例
子 → 父：triggerEvent 自定义事件
兄弟组件：通过共同父组件中转，或全局 globalData，或 Storage
跨层级：behaviors（类似 mixin）+ 全局状态
```

```js
// 父获取子实例（直接调用子方法）
// <child-comp id="myChild" />
Page({
  onLoad() {
    const child = this.selectComponent("#myChild");
    child.someMethod(); // 调用子组件的方法
  },
});
```

---

### 性能优化

#### 1. 分包加载（必考）

```json
// app.json
{
  "pages": ["pages/index/index"], // 主包
  "subpackages": [
    {
      "root": "packageA", // 分包根目录
      "pages": ["pages/detail/index"]
    },
    {
      "root": "packageB",
      "pages": ["pages/order/index"],
      "independent": true // 独立分包：不依赖主包，可直接启动
    }
  ]
}
```

```
主包：启动时必须下载（包含 tabBar 页面和公共资源）
分包：用到时才下载（按需加载，加快启动速度）

大小限制：
  主包 ≤ 2MB
  单个分包 ≤ 2MB
  所有包总大小 ≤ 20MB（含主包）

优化策略：
  把首屏不需要的页面放到分包
  独立分包处理完全独立的业务模块（如客服、物流追踪）
```

#### 2. 图片优化

```js
// 图片懒加载
<image lazy-load src="{{url}}" />

// 使用 webp 格式（体积更小）
// 避免大图：用 CDN 裁剪到合适尺寸
// 骨架屏替代 loading 状态
```

#### 3. 长列表优化

```js
// 使用虚拟列表组件（recycle-view）
// 或者自实现：只渲染可视区域的数据

// scroll-view 开启增强模式
<scroll-view type="list" scroll-y>
  <view wx:for="{{visibleList}}" wx:key="id">
    ...
  </view>
</scroll-view>
```

#### 4. 启动优化

```
- 代码包精简：移除无用代码、图片、第三方库
- 分包加载：减少主包体积
- 数据预拉取：wx.setBackgroundFetchToken + wx.getBackgroundFetchData
- 周期性更新：定时预拉取数据
- 骨架屏：视觉上减少白屏时间
- 避免 onLaunch 里做耗时操作
```

---

### 登录流程（高频）

#### 完整时序图

```
小程序端                          业务服务器                    微信服务器
  │                                    │                           │
  │  ① wx.login()                      │                           │
  │─────────────────────────────────────────────────────────────►│
  │◄── 返回 code（临时凭证，5分钟有效，用一次就失效）──────────────│
  │                                    │                           │
  │  ② 把 code 发给自己的服务器          │                           │
  │──────────── POST /api/login ───────►│                           │
  │            { code }                │                           │
  │                                    │  ③ 用 code + appid +      │
  │                                    │     appsecret 换取身份    │
  │                                    │──── GET jscode2session ──►│
  │                                    │◄─── openid + session_key ─│
  │                                    │                           │
  │                                    │  ④ 服务器处理：           │
  │                                    │     - 用 openid 查/建用户  │
  │                                    │     - 生成自定义 token     │
  │                                    │     - 保存 session_key    │
  │                                    │                           │
  │◄────────── 返回 token ─────────────│                           │
  │                                    │                           │
  │  ⑤ 存储 token，后续所有请求带上     │                           │
  │──────────── 带 token 请求 ─────────►│                           │
  │◄────────── 正常业务响应 ───────────│                           │
```

#### 逐步详解

**第①步：wx.login() 拿 code**

```js
const { code } = await wx.login();
// code 是微信临时凭证，特点：
//   - 每次调用都不一样（一次性的）
//   - 5分钟内有效，且只能用一次
//   - code 本身不包含任何用户信息，仅作为"换票凭证"
```

```
为什么要 code 这个中间层？
  直接原因：防止前端拿到 openid 后绕过服务器直接伪造身份
  code 是一次性的，即使被截获也无法重复使用
  真正敏感的 openid 和 session_key 只在服务器之间流通
```

**第②步：前端把 code 发给自己的业务服务器**

```js
// 前端：把 code 交给自己的后端
const res = await wx.request({
  url: "https://your-server.com/api/login",
  method: "POST",
  data: { code },
});
```

```
注意：前端不能直接调用微信的 jscode2session 接口
  原因：该接口需要 appsecret（小程序密钥），appsecret 绝对不能放在前端代码里
  前端代码可以被反编译，appsecret 一旦泄露，攻击者可以模拟任何用户
```

**第③步：服务器用 code 换取 openid + session_key**

```
服务器调用微信接口：
GET https://api.weixin.qq.com/sns/jscode2session
  ?appid=YOUR_APPID
  &secret=YOUR_APPSECRET    ← 只在服务器保管，从不传给前端
  &js_code=CODE             ← 前端传来的 code
  &grant_type=authorization_code

微信返回：
{
  "openid": "oXXXXX...",          // 用户在该小程序的唯一标识（永久不变）
  "session_key": "xxx==",         // 会话密钥（用于解密敏感数据，如手机号）
  "unionid": "oYYYY..."           // 如果加入了微信开放平台，还会有 unionid
}
```

**第④步：服务器生成自定义 token**

```
服务器拿到 openid 后：
  1. 用 openid 在数据库里查找用户
     - 存在 → 已注册用户，直接返回用户信息
     - 不存在 → 新用户，自动完成注册（插入用户记录）

  2. 生成自定义登录态 token（通常是 JWT）
     JWT 内容示例：
     {
       "userId": 12345,
       "openid": "oXXXXX...",
       "exp": 1717000000   // 过期时间
     }

  3. session_key 的处理：
     - 方案一：存 Redis（key = openid，value = session_key，设置过期时间）
     - 方案二：不存，等需要解密时重新让用户登录获取
     - 绝对不能返回给前端！
```

**第⑤步：前端存储 token，后续携带**

```js
// 登录完整代码
async function login() {
  // 1. 获取 code
  const { code } = await wx.login();

  // 2. 发给服务器换 token
  const { token, userInfo } = await request("/api/login", { code }, "POST");

  // 3. 持久化存储（下次启动不用重新登录）
  wx.setStorageSync("token", token);
  wx.setStorageSync("userInfo", userInfo);
}

// 后续请求统一带上 token
function request(url, data, method = "GET") {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://your-server.com${url}`,
      method,
      data,
      header: {
        Authorization: `Bearer ${wx.getStorageSync("token")}`,
      },
      success: (res) => resolve(res.data),
      fail: reject,
    });
  });
}
```

---

#### 关键概念对比

| 字段              | 含义                         | 谁能持有     | 特点                       |
| ----------------- | ---------------------------- | ------------ | -------------------------- |
| `code`            | 临时换票凭证                 | 前端（短暂） | 一次性，5分钟有效          |
| `openid`          | 用户在该小程序的唯一ID       | 服务器       | 永久不变，不能暴露给前端   |
| `session_key`     | 解密敏感数据的密钥           | 服务器       | 有过期时间，绝对不能给前端 |
| `unionid`         | 用户在同一开放平台下的唯一ID | 服务器       | 需要绑定开放平台才有       |
| `token`（自定义） | 业务系统的登录凭证           | 前端         | 由服务器生成，用于鉴权     |

**openid vs unionid：**

```
openid：  用户在「单个小程序」内的唯一标识
          同一个用户在不同小程序里 openid 不同

unionid： 用户在「同一微信开放平台账号下」所有应用的唯一标识
          同一个用户在 A小程序、B小程序、公众号里 unionid 相同

场景：公司有小程序 + 公众号，想识别"这是同一个用户"→ 用 unionid
```

---

#### 常见追问

**Q：为什么不直接把 openid 返回给前端当 token 用？**

```
openid 是用户的永久唯一标识，如果作为 token 使用：
  - 请求中携带 openid，被中间人截获 → 可以永久伪造该用户的请求
  - openid 是固定的，无法失效，无法"注销登录"

自定义 token（JWT）的优势：
  - 可以设置过期时间（1天、7天等）
  - 服务器可以主动让 token 失效（踢下线）
  - 可以在 token 中携带用户角色、权限等业务信息
```

**Q：session_key 有什么用？为什么不能给前端？**

```
session_key 用途：
  解密用户敏感信息，如手机号、微信运动步数等加密数据
  微信把这些数据加密后给前端，前端传给服务器，服务器用 session_key 解密

为什么不能给前端：
  前端拿到 session_key，就能自己解密任何用户的敏感数据
  攻击者可以构造任意加密数据包，用 session_key 解密
  等价于把用户隐私数据的"万能钥匙"公开了
```

**Q：wx.checkSession 是什么？**

```js
// session_key 有过期时间（微信不公开具体时间，取决于用户活跃度）
// 如果 session_key 过期，需要重新 wx.login() 获取新的

// 检查 session_key 是否还有效
wx.checkSession({
  success() {
    // session_key 未过期，可以继续使用
  },
  fail() {
    // session_key 已过期，需要重新登录
    login();
  },
});

// 实践：在需要解密手机号等敏感数据前，先 checkSession
// 不需要每次启动都 checkSession，只在用到 session_key 时才检查
```

---

### 授权与获取用户信息

```js
// 获取头像昵称（新版方案，2022年后）
// 旧的 getUserInfo 接口已不再返回真实信息
// 新方案：open-type="getUserInfo" 的 button 组件

// 获取手机号（需要企业主体）
<button open-type="getPhoneNumber" bindgetphonenumber="getPhoneNumber">
  授权手机号
</button>;

Page({
  async getPhoneNumber(e) {
    if (e.detail.code) {
      // 用 code 换取手机号（服务端调用 wx.getUserPhoneNumber 接口）
      const { phone } = await request("/api/getPhone", { code: e.detail.code });
    }
  },
});
```

---

### 自定义组件

```js
// 组件定义
Component({
  options: {
    multipleSlots: true, // 启用多个 slot
    styleIsolation: "isolated", // 样式隔离（默认）
  },
  properties: {
    title: {
      type: String,
      value: "默认标题",
      observer(newVal) {}, // 值变化回调（不推荐，改用 watch 或 computed）
    },
  },
  data: { count: 0 },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1 });
      this.triggerEvent("change", { count: this.data.count + 1 });
    },
  },
});
```

**样式隔离：**

```
isolated（默认）：组件内外样式完全隔离，组件样式不影响页面，页面样式不影响组件
apply-shared：页面的 wxss 样式可以影响组件，但组件样式不影响页面
shared：双向不隔离（不推荐）

// 穿透方案（isolated 模式下修改子组件样式）：
// 使用 CSS 变量传递
```

---

### behaviors（类似 mixin）

```js
// 定义 behavior
const myBehavior = Behavior({
  data: { sharedData: "hello" },
  methods: {
    sharedMethod() {
      console.log("来自 behavior 的方法");
    },
  },
  lifetimes: {
    attached() {
      console.log("behavior attached");
    },
  },
});

// 组件中使用
Component({
  behaviors: [myBehavior],
  // 组件自身的属性和方法会与 behavior 合并
});
```

---

### 网络请求封装

```js
// 封装 request
function request(url, data = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://api.example.com${url}`,
      data,
      method,
      header: {
        Authorization: `Bearer ${wx.getStorageSync("token")}`,
        "Content-Type": "application/json",
      },
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // token 过期，重新登录
          wx.reLaunch({ url: "/pages/login/index" });
          reject(res);
        } else {
          reject(res);
        }
      },
      fail: reject,
    });
  });
}
```

**注意**：小程序网络请求域名必须在微信后台配置白名单（request 合法域名），且必须是 HTTPS。

---

### 常见面试高频题

#### 1. 小程序和普通 Web 的区别？

```
运行环境：
  Web：浏览器，JS 在浏览器主线程运行，可操作 DOM
  小程序：微信客户端，双线程（逻辑层 + 渲染层），逻辑层不能操作 DOM

API：
  Web：浏览器 Web API（window / document / localStorage）
  小程序：微信提供的 API（wx.request / wx.navigateTo / wx.getStorageSync）

发布：
  Web：部署到服务器，URL 访问
  小程序：提交到微信后台审核，用户扫码/搜索使用

能力：
  小程序有更多原生能力（定位、摄像头、蓝牙、NFC、支付）
  小程序受限更多（不能随意跳转外部链接、包大小限制、域名白名单）
```

---

#### 2. 小程序的页面栈机制？

```
微信小程序维护一个页面栈，最多 10 层

navigateTo：入栈（当前页面保留在栈中）
navigateBack：出栈（当前页面销毁，返回上一页）
redirectTo：替换栈顶（当前页面销毁，新页面替换位置）
reLaunch：清空栈，只保留新页面
switchTab：清空所有非 tabBar 页面栈，切换 tabBar

获取当前页面栈：
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1]; // 当前页
const prevPage = pages[pages.length - 2];    // 上一页
prevPage.setData({ xxx: 'xxx' });             // 直接操作上一页数据（另一种传参方式）
```

---

#### 3. 如何实现小程序的全局状态管理？

```
方案一：globalData（最简单）
  App({ globalData: { userInfo: null } })
  const app = getApp(); app.globalData.userInfo = ...
  缺点：数据变化不响应式，需要手动传递

方案二：本地存储（持久化）
  wx.setStorageSync / wx.getStorageSync
  适合：token、用户配置等需要持久化的数据

方案三：EventBus（事件总线）
  自己实现或使用第三方库，发布订阅模式，跨页面通信

方案四：小程序状态管理库
  mobx-miniprogram：类 MobX，响应式
  westore：官方推荐，类 Redux

方案五：Computed + Store 模式（大型项目）
  基于 behaviors 封装全局 store
```

---

#### 4. wx:if 和 hidden 的区别？

```
wx:if：条件为假时，组件不会渲染到节点树（完全销毁 + 重建）
  → 切换成本高，适合不频繁切换的场景
  → 初始为 false 时，完全不渲染（节省初始开销）

hidden：只是通过 CSS display:none 隐藏，节点始终存在于节点树
  → 切换成本低，适合频繁切换
  → 组件始终存在，初始渲染有开销

类比 React：wx:if ≈ 条件渲染，hidden ≈ visibility/display 控制
```

---

#### 5. 小程序如何处理登录态过期？

```js
// 方案：请求拦截器 + 自动刷新
async function request(url, data) {
  const token = wx.getStorageSync("token");

  // 1. 先检查 token 是否存在
  if (!token) {
    await login(); // 重新登录
    return request(url, data); // 重试
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      header: { Authorization: `Bearer ${token}` },
      success(res) {
        if (res.data.code === 401) {
          // 2. 服务器返回 401，token 过期
          wx.removeStorageSync("token");
          login().then(() => resolve(request(url, data))); // 重新登录后重试
        } else {
          resolve(res.data);
        }
      },
    });
  });
}
```

---

#### 6. 小程序为什么不能用 npm 包里的 DOM 操作代码？

```
小程序逻辑层运行在 JS Engine（V8 / JavaScriptCore）中
这个环境没有 window、document 对象
无法使用任何 DOM API

可以使用 npm 包中：
  ✅ 纯逻辑库：lodash、dayjs、axios（需适配）
  ✅ 微信小程序适配的 npm 包
  ❌ 依赖 DOM/BOM 的库：jQuery、DOM-based 动画库等

npm 使用注意：
  需要在开发者工具中点击"构建 npm"，会生成 miniprogram_npm 目录
  package.json 中需标注 miniprogram 字段（指向小程序兼容版本）
```

---

#### 7. 如何优化小程序首屏加载速度？

```
1. 分包加载：主包只放首屏必要页面，其他页面放分包
2. 预加载分包：wx.loadSubpackage 提前下载可能用到的分包
3. 数据预拉取：wx.setBackgroundFetchToken 配置后，微信会提前拉数据
4. 骨架屏：开发者工具自动生成，减少白屏感知时间
5. 精简主包体积：
   - 清理无用图片/代码
   - 图片放 CDN，不打包进代码包
   - 分析代码依赖，移除多余库
6. 首屏接口并行请求：onLoad 中同时发多个请求（不要串行）
7. 缓存策略：先展示本地缓存数据，再请求最新数据（cache-then-network）
```

---

#### 8. 小程序的更新机制？

```
启动时检查更新：
  wx.getUpdateManager().onUpdateReady(() => {
    wx.showModal({
      title: '更新提示',
      content: '新版本已经准备好，是否重启应用？',
      success(res) {
        if (res.confirm) {
          wx.getUpdateManager().applyUpdate(); // 重启并应用新版本
        }
      }
    });
  });

版本更新流程：
  1. 小程序启动时，微信后台检查是否有新版本
  2. 后台静默下载新版本包（不影响当前使用）
  3. 下载完成触发 onUpdateReady
  4. 调用 applyUpdate() 重启小程序并应用新版本

冷启动 vs 热启动：
  冷启动：小程序被销毁后重新打开（完整初始化流程）
  热启动：小程序在后台（5分钟内），重新切到前台（直接 onShow，不走 onLaunch）
  微信可能随时销毁后台的小程序（资源紧张时）
```

---

### 一句话总结

> 小程序面试核心：**双线程模型**（渲染层 + 逻辑层，JSBridge 通信）、**生命周期**（App/Page/Component 三层）、**setData 优化**（减少数据量、合并调用、路径语法）、**分包加载**（主包 ≤ 2MB，按需下载）、**登录流程**（code 换 openid，服务端维护 session）。

### 小程序分包优化

打包后是3.8M的代码压缩完以后2M超了主包的最大限制

首先排查发现是common.js 占了1.3M 混合了公共组件和工具函数等等（电影侧和演出侧的） 将这部分放到拆分一下啊，不要放到一起演出的放到演出里面去，梳理一下这样主包正常就笑了400kb

首次进入判断权限的时候加载主包的同时在请求权限判断的时候做一下预加载，不要等权限请求完以后再去请求数据
然后二次进入直接在 onLaunch 里面通过权限判断预加载对应的包

降低 `baseLevel` — 减少 base.wxml（收益最大，优先做）\*\* 这是 Taro 把所有组件模板集中输出到主包的产物

`baseLevel` 控制 Taro 在生成组件模板时的递归深度。值越大，越多的模板会被打进主包的 `base.wxml`，而不是分散到各分包的 wxml 文件里。

同时演出的页面全部都在一个root里面加载任意一个页面，所有都要加载

模块打包 将散落的 jscss 等按依赖打包成浏览器能识别的文件
编译兼容 es6 ts 等打包成标准的js 和 css
功能拓展 tree shink 压缩 代码分割 性能优化

核心配置

loader
