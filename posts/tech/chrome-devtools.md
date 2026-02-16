---
title: "Chrome DevTools 快速入门"
date: "2021-06-20"
tags: ["学习"]
description: "俗话说的好，工欲善其事，必先利其器。要想做好前端开发，就必须快速精准的定位bug和查看代码的质量，所以首先就得学会使用Chrome控制台的使用."
readtime: "16分钟"
words: "4145 字"
---

<!--more-->

俗话说的好，工欲善其事，必先利其器。要想做好前端开发，就必须快速精准的定位 bug 和查看代码的质量，所以首先就得学会使用 Chrome 控制台的使用。废话不多说直接开淦！

首先第一步 Chrome DevTools 打开的快捷键 ：

使用 Ctrl + Shift + I (Mac 上为 Cmd+Opt+I)打开 DevTools。
使用 Ctrl + Shift + J (Mac 上为 Cmd+Opt+J)打开 DevTools 中的控制台
使用 Ctrl + Shift + C (Mac 上为 Cmd+Shift+C)打开 DevTools 的审查元素模式。
除此之外还可以右击鼠标检查

## Element

打开控制台以后咱先从最上面的开始看起。

首先点击右上角的鼠标箭头以后可以通过鼠标直接获取元素 dom

下面是

**styles** ：主要是当前选中元素的样式相关，我们平常可以直接在上面调试样式，边看边修改，会比在编辑器里面修改方便很多。

**Computed** ：这里主要方便我们查看元素 css 的具体属性值。

**Layout** ：布局相关

**EventListeners** ：这个属性是用来帮助我们监听 dom 事件的并且可以帮助我们定位到相应的触发事件的代码：

**DOMBreakpoint** ：这个是给相应的 dom 打断点

- Subtree modifications: 子节点删除或添加时
- Attributes modifications: 属性修改时
- Node Removal: 节点删除时

**Properties** ：dom 属性

**Accessibility** ：dom 可访问性

除此之外我们还可以右击元素，有多种对元素的操作，比如直接编辑元素 html，或者修改删除 dom，DOM 元素也是可以直接进行拖动编辑修改的,还有打断点，直接生成并且下载 dom 元素图片等等骚操作。

## 如何快速定位代码位置

1. 最简单粗暴的就是直接在编辑器里面 command+shift+F 查找关键词，比如页面上出现的唯一汉字，或者 dom 上的 class id 名等

2. 还有我们上面提到过的 EventListeners 这个属性是用来帮助我们监听 dom 事件的并且可以帮助我们定位到相应的触发事件的代码。

3. DOMBreakpoint 相应的 dom 打断点，然后去触发那个事件

4. 我们也能通过 styles 来定位 css 文件和代码

## Console

这个面板内主要是我们用来看打印日志和一些警告和错误（当我们看见控制台中的错误时，不管代码是不是能否跑通我们都应该去解决这个错误，这是一个程序员应该有的好习惯），我们也可以吧这个当成是一个 js 编辑器可以直接在上面测试一些 js 代码。

下面是一些 console 的一些方法除了常见的几个 log 和 error 等，time 和 timeEnd 这个也是比较常用的一般我们可以用这两个方法来判断一个方法或者函数执行的事件。

补充一个，在控制台输入 document.body.contentEditable="true"或者 document.designMode = 'on'就可以实现对网页的编辑。

## Source

这个面板是用来存放源代码的，我们可以在这里查找代码然后给代码打上断点，（除此之外你也可以在代码上打上 debugger 来打断点）

## Performance（性能监控）

### 1. 代码覆盖率

在这里我们能看到这个某个 js 文件在当前页面被执行了多少，从而可以队代码进行优化。

### 2. 函数执行时间

Performance 面板的 call tree 可以查看每个函数的执行时间，方便我们找到性能瓶颈。

记录过程：

- 首先点击控制条左边的第一个圆圈，开始记录日志
- 等待几分钟 (正常操作页面)
- 点击 Stop 按钮，Devtools 停止录制，处理数据，然后显示性能报告

### 3. 相关性能指标

接下来咱们来了解浏览器的几个性能指标（其中核心指标为 LCP-加载，FID-交互,CLS-视觉稳定）

- First contentful paint (FCP): 测量页面开始加载到某一块内容显示在页面上的时间。
- Largest contentful paint (LCP): 测量页面开始加载到最大文本块内容或图片显示在页面中的时间。
- First input delay (FID): 测量用户首次与网站进行交互(例如点击一个链接、按钮、js 自定义控件)到浏览器真正进行响应的时间。
- Time to Interactive (TTI): 测量从页面加载到可视化呈现、页面初始化脚本已经加载，并且可以可靠地快速响应用户的时间。
- Total blocking time (TBT): 测量从 FCP 到 TTI 之间的时间，这个时间内主线程被阻塞无法响应用户输入。
- Cumulative layout shift (CLS): 测量从页面开始加载到状态变为隐藏过程中，发生不可预期的 layout shifts 的累积分数。

Google 官方提供了一个 web-vitals 库，线上或本地都可以测量上面提到的 3 个指标。

## Network

我们在这个面板是查看接口请求的情况

我们可以在这个面板中控制网速，Network-->nothrotling。

平时我们和后端连调，如果后端要你发接口情况，右击接口-->copy-->copy as cURL ,将其发送给后端，当然我们自己也要学会看请求头里面的一些基本信息，比如跨域， 缓存，302 301 等等，如果想重新请求一个接口也不需要重新刷新一个页面，直接右击接口-->Replay XHR

## Application

**storage 浏览器携带的存储**

- Local Storage 永久存储
- session Storage 会话级的存储
- Web Sql Database，"本地数据库"，是随着 HTML5 规范加入的在浏览器端运行的轻量级数据库。
- IndexedDB 是 HTML5 规范里新出现的浏览器里内置的数据库。
- cookie: httponly 禁止通过 document.cookie 获取 cookie 值一种安全策略。
- samesite:防止 CSRF 攻击和用户追踪。

## 总结

除了上面的这些常用的基本操作，浏览器还提供了很多的功能等待我们去发掘。

---
将原来掘金的文章迁移过来图片得重新发一遍 cdn，不想搞了，凑合着用，原文： https://juejin.cn/post/6975882356737458183
