(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.term-row'));
  var list = document.getElementById('list'), shown = document.getElementById('shown'), empty = document.getElementById('empty');
  var q = document.getElementById('q'), sort = document.getElementById('sort');
  var types = Array.prototype.slice.call(document.querySelectorAll('input[name=type]'));
  var total = cards.length;

  function apply() {
    var qq = q.value.trim().toLowerCase(), on = {};
    types.forEach(function (t) { on[t.value] = t.checked; });
    var n = 0;
    cards.forEach(function (c) {
      var ok = on[c.dataset.type] !== false;
      if (ok && qq) ok = c.dataset.name.indexOf(qq) >= 0 || c.dataset.aliases.indexOf(qq) >= 0;
      c.hidden = !ok;
      if (ok) n++;
    });
    var key = sort.value;
    var sorted = cards.slice().sort(function (a, b) {
      if (key === 'links') return (+b.dataset.links - +a.dataset.links) || a.dataset.name.localeCompare(b.dataset.name);
      if (key === 'first') return b.dataset.first.localeCompare(a.dataset.first) || a.dataset.name.localeCompare(b.dataset.name);
      if (key === 'found') return (+a.dataset.rank - +b.dataset.rank);
      return a.dataset.name.localeCompare(b.dataset.name);
    });
    sorted.forEach(function (c) { list.appendChild(c); });
    shown.textContent = n + ' of ' + total;
    empty.hidden = n > 0;
  }
  function reset() {
    q.value = ''; sort.value = 'az';
    types.forEach(function (t) { t.checked = true; });
    apply();
  }
  [q, sort].forEach(function (e) { e.addEventListener('input', apply); e.addEventListener('change', apply); });
  types.forEach(function (t) { t.addEventListener('change', apply); });
  document.getElementById('reset').addEventListener('click', reset);
  document.querySelector('.az').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-letter]');
    if (!a) return;
    e.preventDefault();
    var first = cards.filter(function (c) { return !c.hidden && c.dataset.letter === a.dataset.letter; })
      .sort(function (x, y) { return x.dataset.name.localeCompare(y.dataset.name); })[0];
    if (first) first.scrollIntoView({ block: 'start' });
  });
  function onHash() {
    var id = TR.hashId();
    if (!id) return;
    var t = document.getElementById(id);
    if (!t) return;
    if (t.hidden || (t.closest('.term-row') && t.closest('.term-row').hidden)) reset();
    TR.reveal(id);
  }
  window.addEventListener('hashchange', onHash);
  apply();
  onHash();
})();
