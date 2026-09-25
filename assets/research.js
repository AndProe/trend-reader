(function () {
  // Research page: queue status filter and hash reveal. Post notes are not published, so there is no post panel.
  function onHash() {
    var id = TR.hashId();
    if (id) TR.reveal(id);
  }
  window.addEventListener('hashchange', onHash);
  window.addEventListener('popstate', onHash);

  // research queue status filter
  var tabs = document.getElementById('status-tabs'), rows = Array.prototype.slice.call(document.querySelectorAll('#queue-body tr'));
  if (tabs) tabs.addEventListener('click', function (e) {
    var t = e.target.closest('.tab');
    if (!t) return;
    tabs.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === t); });
    rows.forEach(function (r) { r.hidden = !!t.dataset.status && r.dataset.status !== t.dataset.status; });
  });
  onHash();
})();
