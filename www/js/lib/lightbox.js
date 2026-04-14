let current = 0;
let images = [];
let box = null;

function open(srcs, index = 0) {
  images = Array.isArray(srcs) ? srcs : [srcs];
  current = index;
  if (!box) create();
  box.classList.add('active');
  show();
  document.addEventListener('keydown', onKey);
}

function close() {
  if (box) box.classList.remove('active');
  document.removeEventListener('keydown', onKey);
}

function show() {
  if (!box) return;
  box.querySelector('.lb-img').src = images[current];
  box.querySelector('.lb-counter').textContent = images.length > 1 ? `${current + 1} / ${images.length}` : '';
  box.querySelector('.lb-prev').style.display = images.length > 1 ? '' : 'none';
  box.querySelector('.lb-next').style.display = images.length > 1 ? '' : 'none';
}

function onKey(e) {
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft' && current > 0) { current--; show(); }
  if (e.key === 'ArrowRight' && current < images.length - 1) { current++; show(); }
}

function create() {
  box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `
    <div class="lb-overlay"></div>
    <div class="lb-content">
      <button class="lb-close">&times;</button>
      <button class="lb-prev">&lsaquo;</button>
      <img class="lb-img" src="">
      <button class="lb-next">&rsaquo;</button>
      <div class="lb-counter"></div>
    </div>`;
  box.querySelector('.lb-overlay').onclick = close;
  box.querySelector('.lb-close').onclick = close;
  box.querySelector('.lb-prev').onclick = () => { if (current > 0) { current--; show(); } };
  box.querySelector('.lb-next').onclick = () => { if (current < images.length - 1) { current++; show(); } };
  document.getElementById('lightbox-container').appendChild(box);
}

export { open, close };
