function post() {
  const form = document.getElementById('form');
  const formData = new FormData(form);
  const content = { content: formData.get('content') };

  fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(content),
  }).then((res) => {
    if (res.status === 500) window.alert('发射失败');
    else {
      window.alert('发射成功');
      window.location.reload();
    }
  });
}
