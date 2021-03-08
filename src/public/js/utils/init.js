export default function init(danmaku, container, data) {
  for (let i = 0; i < data.length; i++) {
    const index = parseInt(Math.random() * data.length);
    danmaku.add({
      msg: data[index].data,
      createdAt: data[index].date,
      fontSize: Math.floor(Math.random() * 20) + 20,
    });
  }

  let width = container.offsetWidth;
  let height = container.offsetHeight;
  window.addEventListener(
    'resize',
    function () {
      if (
        container.offsetWidth !== width ||
        container.offsetHeight !== height
      ) {
        danmaku.resize();
        width = container.offsetWidth;
        height = container.offsetHeight;
      }
    },
    false,
  );
}
