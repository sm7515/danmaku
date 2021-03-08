import Danmaku from './danmaku.js';
import init from './utils/init.js';

async function getData() {
  const response = await fetch('https://danmakuwall.herokuapp.com/messages', {
    method: 'GET',
  });
  return response.json();
}

getData().then((data) => {
  const container = document.getElementById('container');
  const danmaku = new Danmaku({
    container,
  });
  init(danmaku, container, data);
  setInterval(function () {
    init(danmaku, container, data);
  }, 5000);
});
