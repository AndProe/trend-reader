window.TR = (function () {
  var el = document.getElementById('data');
  var D = el ? JSON.parse(el.textContent) : {};
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reveal(id) {
    if (!id) return null;
    var t = document.getElementById(id);
    if (!t) return null;
    var p = t.parentElement;
    while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; }
    if (t.tagName === 'DETAILS') t.open = true;
    t.scrollIntoView({ block: 'start' });
    t.classList.add('flash');
    setTimeout(function () { t.classList.remove('flash'); }, 1600);
    return t;
  }
  function hashId() { return decodeURIComponent(location.hash.slice(1)); }

  // theme toggle: explicit choice is stored; with none stored the system preference applies
  var root = document.documentElement, btn = document.getElementById('theme-btn');
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (btn) btn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('tr-theme', next); } catch (e) {}
    document.dispatchEvent(new CustomEvent('tr:theme', { detail: next }));
  });

  // disclosure toggles: <button data-toggle="id"> opens/closes #id (nav drawer, filter rails)
  var toggles = Array.prototype.slice.call(document.querySelectorAll('[data-toggle]'));
  function setOpen(b, open) {
    var t = document.getElementById(b.dataset.toggle);
    if (!t) return;
    t.classList.toggle('open', open);
    b.classList.toggle('open', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (b.dataset.toggle === 'site-nav') document.body.classList.toggle('nav-open', open);
    else document.body.classList.toggle('drawer-open', open);
  }
  function isOpen(b) { return b.getAttribute('aria-expanded') === 'true'; }
  toggles.forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); setOpen(b, !isOpen(b)); });
  });
  function closeAll() { toggles.forEach(function (b) { if (isOpen(b)) setOpen(b, false); }); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('click', function (e) {
    toggles.forEach(function (b) {
      if (!isOpen(b)) return;
      var t = document.getElementById(b.dataset.toggle);
      if (t && !t.contains(e.target) && !b.contains(e.target)) setOpen(b, false);
    });
  });
  var scrim = document.getElementById('scrim');
  if (scrim) scrim.addEventListener('click', closeAll);

  // Home used to host the graph: old #term-x deep links now belong to graph.html
  if (document.body.classList.contains('landing') && /^#term-/.test(location.hash)) {
    location.replace('graph.html' + location.hash);
  }
  return { D: D, esc: esc, reveal: reveal, hashId: hashId };
})();
