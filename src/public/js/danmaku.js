import {
  SPEED_ARG,
  DEFAULT_TRACK_SIZE,
  DEFAULT_RENDER_INTERVAL,
  defaultDanmakuData,
} from './utils/constants.js';

import {
  getTranslateX,
  hiddenProp,
  visibilityChangeEvent,
} from './utils/dom.js';

export default class Danmaku {
  constructor(options) {
    // 弹幕容器（HTML 元素）
    this._container = options.container;
    // 容器宽度
    this._totalWidth = null;
    // 容器高度
    this._totalHeight = null;
    // 轨道高度
    this._trackSize = options.trackSize || DEFAULT_TRACK_SIZE;
    // 队列轮询间隔
    this._renderInterval =
      parseInt(options.renderInterval) || DEFAULT_RENDER_INTERVAL;
    // 队列轮询 setTimeout 计时器
    this._renderTimer = null;
    // 数据队列
    this._queue = [];
    // 轨道数据
    this._tracks = null;
    // 弹幕自编 id 累加器
    this._autoId = 0;
    this._paused = false;
    this._resumeTimer = null;

    // 初始化容器尺寸和轨道数据结构
    this.resize();
    this._resetTracks();

    this._onVisibilityChange = () => {
      if (document[hiddenProp]) {
        this.pause();
      } else {
        // 必须异步执行，否则恢复后动画速度可能会加快，从而导致弹幕消失或重叠，原因不明
        this._resumeTimer = setTimeout(() => {
          this.resume();
        }, 200);
      }
    };
    document.addEventListener(
      visibilityChangeEvent,
      this._onVisibilityChange,
      false,
    );
  }

  // 弹幕容器大小变化时调用此方法
  resize() {
    // 容器总宽度
    this._totalWidth = this._container.offsetWidth;
    // 容器总高度
    this._totalHeight = this._container.offsetHeight;
    // 避免当前屏的数据错乱，全部清掉
    this.clearScreen();
  }

  // 清屏
  clearScreen() {
    this._clearDanmakuNodes();
    this._resetTracks();
  }

  pause() {
    if (this._resumeTimer) {
      clearTimeout(this._resumeTimer);
    }
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }

    if (this._paused) {
      return;
    }
    this._paused = true;

    this._eachDanmakuNode((node, y, id) => {
      const data = this._findData(y, id);
      if (data) {
        // 获取已滚动距离
        data.rolledDistance = -getTranslateX(node);

        // 移除动画，计算出弹幕所在的位置，固定样式
        node.style.transition = '';
        node.style.transform = `translateX(-${data.rolledDistance}px)`;
      }
    });
  }

  resume() {
    if (!this._paused) {
      return;
    }

    this._eachDanmakuNode((node, y, id) => {
      const data = this._findData(y, id);
      if (data) {
        data.startTime = Date.now();
        // 重新计算滚完剩余距离需要多少时间
        data.rollTime =
          (data.totalDistance - data.rolledDistance) / data.rollSpeed;
        node.style.transition = `transform ${data.rollTime}s linear`;
        node.style.transform = `translateX(-${data.totalDistance}px)`;
      }
    });

    this._paused = false;

    if (!this._renderTimer) {
      this._render();
    }
  }

  // 请求节点
  _requireNode(data) {
    let node;
    let isNewNode;
    if (this._nodeRecycleBin.length) {
      node = this._nodeRecycleBin.shift();
      node.style.transition = node.style.transform = '';
    } else {
      node = document.createElement('div');
      node.style.position = 'absolute';
      node.style.left = '100%';
      node.style.whiteSpace = 'nowrap';
      node.style.willChange = 'transform';
      isNewNode = true;
    }
    node.innerText = data.msg;
    node.style.color = data.fontColor;
    node.style.fontSize = data.fontSize + 'px';
    node.ontransitionend = () => {
      // node.style.transition 为空时，是暂停状态，不用移除
      if (node.style.transition) {
        this._removeFromTrack(data.y, data.autoId);
        this._recycleNode(node);
      }
    };

    if (isNewNode) {
      this._container.appendChild(node);
    }

    return node;
  }
  // 重置轨道数据
  _resetTracks() {
    const totalTracks = Math.floor(this._totalHeight / this._trackSize);
    this._tracks = new Array(totalTracks);
    for (let i = 0; i < totalTracks; i++) {
      this._tracks[i] = [];
    }
    this._maxAmountPerRender = Math.floor(totalTracks / 3);
  }

  // 循环弹幕节点
  _eachDanmakuNode(fn) {
    let child = this._container.firstChild;
    let id, y;
    while (child) {
      if (child.nodeType === 1) {
        y = child.getAttribute('data-y');
        id = child.getAttribute('data-id');
        if (y && id) {
          fn(child, Number(y), Number(id));
        }
      }
      child = child.nextSibling;
    }
  }

  // 清空所有播放中的弹幕节点
  _clearDanmakuNodes() {
    const nodes = [];
    this._eachDanmakuNode((node) => {
      nodes.push(node);
    });
    nodes.forEach((node) => {
      this._container.removeChild(node);
    });
  }

  // 数据解析与复制
  _parseData(data) {
    const autoId = ++this._autoId;
    // Math.pow(2, 53) - 1 即 Number.MAX_SAFE_INTEGER
    if (autoId >= Math.pow(2, 53) - 1) {
      this._autoId = 0;
    }
    return Object.assign(
      {
        autoId,
        timestamp: Date.now(),
      },
      defaultDanmakuData,
      data,
    );
  }

  // 添加弹幕数据到队列
  add(data) {
    this._queue.push(this._parseData(data));
    // 如果队列轮询已经停止，则启动
    if (!this._renderTimer) {
      this._render();
    }
  }

  // 把弹幕数据放置到合适的轨道
  _addToTrack(data) {
    // 单条轨道
    let track;
    // 轨道的最后一项弹幕数据
    let lastItem;
    // 弹幕已经走的路程
    let distance;
    // 弹幕数据最终坐落的轨道索引
    // 有些弹幕会占多条轨道，所以 y 是个数组
    let y = [];

    const now = Date.now();

    for (let i = 0; i < this._tracks.length; i++) {
      track = this._tracks[i];

      if (track.length) {
        // 轨道被占用，要计算是否会重叠
        // 只需要跟轨道最后一条弹幕比较即可
        lastItem = track[track.length - 1];

        distance =
          lastItem.rolledDistance +
          (lastItem.rollSpeed * (now - lastItem.startTime)) / 1000;

        // 通过速度差，计算最后一条弹幕全部消失前，是否会与新增弹幕重叠
        // 如果不会重叠，则可以使用当前轨道
        if (
          distance > lastItem.width &&
          (data.rollSpeed <= lastItem.rollSpeed ||
            (distance - lastItem.width) /
              (data.rollSpeed - lastItem.rollSpeed) >
              (this._totalWidth + lastItem.width - distance) /
                lastItem.rollSpeed)
        ) {
          y.push(i);
        } else {
          y = [];
        }
      } else {
        // 轨道未被占用
        y.push(i);
      }

      // 有足够的轨道可以用时，就可以新增弹幕了，否则等下一次轮询
      if (y.length && y.length >= data.useTracks) {
        data.y = y;
        y.forEach((i) => {
          this._tracks[i].push(data);
        });
        break;
      }
    }
  }

  // （弹幕飘到尽头后）从轨道中移除对应数据
  _removeFromTrack(y, id) {
    y.forEach((i) => {
      const track = this._tracks[i];
      for (let j = 0; j < track.length; j++) {
        if (track[j].autoId === id) {
          track.splice(j, 1);
          break;
        }
      }
    });
  }

  // 通过 y 和 id 获取弹幕数据
  _findData(y, id) {
    const track = this._tracks[y];
    for (let j = 0; j < track.length; j++) {
      if (track[j].autoId === id) {
        return track[j];
      }
    }
  }

  // 轮询渲染
  _render() {
    if (this._paused) {
      return;
    }
    try {
      this._renderToDOM();
    } finally {
      this._renderEnd();
    }
  }

  // 渲染为 DOM 节点
  _renderToDOM() {
    // 根据轨道数量每次处理一定数量的弹幕数据
    // 数量越大，弹幕越密集
    let count = this._maxAmountPerRender;

    let i = 0;
    while (count && i < this._queue.length) {
      const data = this._queue[i];
      let node = data.node;
      if (!node) {
        // 弹幕节点基本样式
        data.node = node = document.createElement('div');
        node.innerText = data.msg;
        node.style.position = 'absolute';
        node.style.left = '100%';
        node.style.whiteSpace = 'nowrap';
        node.style.color = data.fontColor;
        node.style.fontSize = data.fontSize + 'px';
        node.style.willChange = 'transform';
        this._container.appendChild(node);

        data.useTracks = Math.ceil(node.offsetHeight / this._trackSize);
        // 占用的轨道数多于轨道总数，则忽略此数据
        if (data.useTracks > this._tracks.length) {
          this._queue.splice(i, 1);
          this._container.removeChild(node);
          continue;
        }

        data.width = node.offsetWidth;
        data.totalDistance = data.width + this._totalWidth;
        data.rollTime =
          data.rollTime ||
          Math.floor(
            data.totalDistance * SPEED_ARG * (Math.random() * 0.3 + 0.7),
          );
        data.rollSpeed = data.totalDistance / data.rollTime;
      }

      this._addToTrack(data);

      if (data.y) {
        this._queue.splice(i, 1);

        node.setAttribute('data-id', data.autoId);
        node.setAttribute('data-y', data.y[0]);
        node.style.top = data.y[0] * this._trackSize + 'px';
        node.style.transition = `transform ${data.rollTime}s linear`;
        node.style.transform = `translateX(-${data.totalDistance}px)`;
        node.addEventListener(
          'transitionstart',
          () => {
            data.startTime = Date.now();
          },
          false,
        );
        node.addEventListener(
          'transitionend',
          () => {
            // node.style.transition 为空时，是暂停状态，不用移除
            if (node.style.transition) {
              this._removeFromTrack(data.y, data.autoId);
              this._container.removeChild(node);
            }
          },
          false,
        );

        data.startTime = Date.now() + 80;
      } else {
        // 当前弹幕要排队，继续处理下一条
        i++;
      }

      // 处理一条，减掉一条
      count--;
    }
  }

  // 轮询结束后，根据队列长度继续执行或停止执行
  _renderEnd() {
    if (this._queue.length > 0) {
      this._renderTimer = setTimeout(() => {
        this._render();
      }, this._renderInterval);
    } else {
      // 如果已经没有数据，就不再轮询了，等有数据时（add 方法中）再开启轮询
      this._renderTimer = null;
    }
  }
}
