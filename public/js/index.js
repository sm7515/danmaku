import Danmaku from './danmaku.js';
import init from './utils/init.js';

async function getData() {
  const response = await fetch('http://localhost:3000/messages', {
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
