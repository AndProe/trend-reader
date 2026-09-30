(function () {
  // Research page: hash reveal for earlier reports. Post notes are not published, so there is no post panel.
  function onHash() {
    var id = TR.hashId();
    if (id) TR.reveal(id);
  }
  window.addEventListener('hashchange', onHash);
  window.addEventListener('popstate', onHash);
  onHash();
})();
