---
title: "小程序 video 组件踩坑记录"
date: "2021-05-30"
tags: ["学习"]
description: "需求是当滑动视窗口的时候，当上一个正在播放的视频消失在视窗的时候，滑动也暂停，将这个视频暂停，同时捕获页面内的视频，播放离顶部最近的视屏。"
readtime: "22分钟"
words: "7871 字"
---

<!--more-->

需求是当滑动视窗口的时候，当上一个正在播放的视频消失在视窗的时候，滑动也暂停，将这个视频暂停，同时捕获页面内的视频，播放离顶部最近的视屏。

最开始我这里是做了一个判断进入页面的时候第一个视频自动播放

```js
autoplay = "{{key===0?true:false}}";
```

然后我们需要先做的就是点击播放视频的时候暂停另外一个视频的播放。这里我们需要用到 wx.createVideoContext 去创造 video 的实例，控制 video 的播放和暂停。

```js
indexCurrent: "video_0",// 记录播放的下标
videoPlay(e) {   //点击播放时触发
// 当点击其他video播放时让原来的video暂停
 if (!this.data.indexCurrent) {
    this.setData({ indexCurrent: curIdx });
    const videoContext = wx.createVideoContext(`${curIdx}`, this);
    //这里对应的视频id
    videoContext.play();
  } else {
    // 有播放时先将prev暂停，再播放当前点击的current
    const videoContextPrev = wx.createVideoContext(`${this.data.indexCurrent}`, this);
    //this是在自定义组件下，当前组件实例的this，以操作组件内 video 组件
    if (this.data.indexCurrent !== curIdx) {
      videoContextPrev.pause();
      this.setData({   indexCurrent: curIdx   });
      const videoContextCurrent = wx.createVideoContext(curIdx, this);
      videoContextCurrent.play();
    }
  }
    // 同时要把此时播放的视频记录下来
    this.setData({      cover_msg: this.data.cover_msg    });}
```

然后是去获取所有 video 的 dom 保存他们距离顶部的距离：

```js
const query = wx.createSelectorQuery();
query
  .selectAll(".video-list")
  .boundingClientRect((rect) => {
    rect.forEach((item) => {
      console.log(item.top);
      this.data.videoAllTop.push(item.top);
    });
  })
  .exec();
```

然后重点就是去监听页面的滚动，我们通过监听此时播放的 video 的 top 值来判断此时播放的 video 是否消失，如果消失我们就用滚动的距离 scrollTop 加上视窗的距离的一半，来判断此时页面滚动的位置然后来播放此时的在页面的距离：

```js
onPageScroll: tool.debounce(function (e) {
  const query = wx.createSelectorQuery();
  const windowHeight = wx.getSystemInfoSync().windowHeight;
  const midWindow = e[0].scrollTop + windowHeight / 2;
  console.log(windowHeight / 2);
  query.select(`#${this.data.indexCurrent}`).boundingClientRect(rect => {
    const bottom = rect.bottom;
    const top = rect.top;
    const videoContextPlay = wx.createVideoContext(`${this.data.indexCurrent}`, this);
    if (bottom < 0) {
      // 下滑动超出视窗口则暂停该视频同时把滑动的距离加上一半视窗的距离算出大概此时滑动到哪个video下然后播放这个video
      videoContextPlay.pause();
      for (let i = 0; i < this.data.videoLength; i++) {
        if (midWindow > this.data.videoAllTop[i] && midWindow > this.data.videoAllTop[i + 1]) {
          const videoContextNextPlay = wx.createVideoContext(`video_${i}`);
          videoContextNextPlay.play();
          this.setData({
            indexCurrent: `video_${i}`
            });
          }
        }
      }
            if (top >= windowHeight) {
              // 上滑超出，重新计算新的需要播放的视频
              videoContextPlay.pause();
              for (let i = 0; i < this.data.videoLength; i++) {
                if (midWindow > this.data.videoAllTop[i] && midWindow > this.data.videoAllTop[i + 1]) {
                  const videoContextNextPlay = wx.createVideoContext(`video_${i}`);
                  videoContextNextPlay.play();
                  this.setData({
                    indexCurrent: `video_${i}`
                  });
                }
              }
            }
          }).exec();
        }),
```

这里监听页面的滚动我们需要做一个防抖的处理：

```js
function debounce(fn, interval) {
  let timer;
  const gapTime = interval || 800;
  //间隔时间
  return function () {
    clearTimeout(timer);
    const context = this;
    const args = arguments;
    timer = setTimeout(function () {
      fn.call(context, args);
    }, gapTime);
  };
}
```

HTML 结构：

```html
<view
  class="video-list"
  wx:for="{{videoData}}"
  wx:for-item="item"
  wx:for-index="key"
  wx:key="key"
>
  <video
    class="video"
    src="{{item.videoUrl}}"
    enable-play-gesture="{{true}}"
    show-play-btn="{{true}}"
    show-center-play-btn="{{true}}"
    bindpause="videoPause"
    autoplay="{{key===0?true:false}}"
    bindplay="videoPlay"
    bindended="videoEnd"
    id="video_{{key}}"
  >
    <view wx:if="{{cover_msg[key]}}" class="msg-time-number" id="cover">
      {{item.weight}}万播放
    </view>
  </video>
</view>
```

## 总结

一开始的时候我是判断下滑超出视频窗口就直接切换到下一个播放，但是这样做如果滚动过快会发生视频的抖动，可能会多个视频一起播放，所以换成这样的方式处理会更好一点。

----------------------------------分割线---------------------------------------------

上一版的 video 还是有很些用户体验不是很好的操作，在这前我们是通过判断视频是否消失于视窗口以后在去重新捕获页面中间的视频，然后播放，这就导致有可能一个播放的视频此时其实在视窗口的最下方只出现一点，但是条件判断此时视频没有消失，这给用户的体验是非常不好的，于是重新做了一下滚动那部分的判断，我们直接监听滚动是上滑还是下滑：

```js
if (e[0].scrollTop > scrollTopTo || e[0].scrollTop >= this.data.scrollHeight) {
  // 判断时下滑时的操作。
  // for (let i = 0; i < this.data.testvideo.length; i++) {
  for (let i = 0; i < this.data.videoLength; i++) {
    if (
      midWindow > this.data.videoAllTop[i] &&
      midWindow < this.data.videoAllTop[i + 1] &&
      i !== index
    ) {
      //如果滑动的距离超过一定距离，暂停该视频同时把滑动的距离加上一半视窗的距离算出大概此时滑动到哪个video下然后播放这个video
      // const videoContextPlay = wx.createVideoContext(`${this.data.indexCurrent}`, this);
      videoContextPlay.pause();
      const videoContextNextPlay = wx.createVideoContext(`video_${i}`);
      videoContextNextPlay.play();
      const coverViewIndex = "cover_view[" + index + "]";
      const coverViewI = "cover_view[" + i + "]";
      this.setData({
        [coverViewIndex]: true,
        [coverViewI]: false,
        indexCurrent: `video_${i}`,
      });
    }
  }
}
if (e[0].scrollTop < scrollTopTo) {
  // 上滑超出，重新计算新的需要播放的视频
  // for (let i = 0; i < this.data.testvideo.length; i++) {
  for (let i = 0; i < this.data.videoLength; i++) {
    if (
      midWindow > this.data.videoAllTop[i] &&
      midWindow < this.data.videoAllTop[i + 1] &&
      i !== index
    ) {
      videoContextPlay.pause();
      const videoContextNextPlay = wx.createVideoContext(`video_${i}`);
      videoContextNextPlay.play();
      const coverViewIndex = "cover_view[" + index + "]";
      const coverViewI = "cover_view[" + i + "]";
      this.setData({
        [coverViewIndex]: true,
        [coverViewI]: false,
        indexCurrent: `video_${i}`,
      });
    }
  }
}
```

scrollTopTo 是我们用来记录上一次滚动的距离然后这次滚动的距离做比较来判断是上滑还是下滑，来控制元素的播放。此时再用上之前的防抖就能很好的控制滑动播放窗口之前的视频。

但是此时出现了另外一个意向之外的 bug，当我点击视频列表中的第二个视频的全屏按钮时，这个视频会突然终止，然后出现第一个视频的声音。经过多次排查后发现是当我们点击放大按钮的时候，是会触发 onPageScroll 的这个时间，也就是滚动事件。经过打印日志发现，不管你点击哪个视频的全屏按钮都是会触发滚动事件，并且滚动距离为 e[0].scrollTop===0 也就是滚动到最顶部。

因此我在滚动哪里做了一层判断：

```js
if (e[0].scrollTop === 0 && this.scrollTop !== 0) {
  return;
  // 点击全屏时iphone端会触发一次滚动时间且e[0].scrollTop为0，所以我们这里需要做一层判断
}
```

滚动为 0 的时候不让他触发事件。

最后是做了一个优化播放视频出错时的状态：就是给视频加了一个蒙层当没有网络或这播放出错时展现的状态。

结束------------------------------------------
