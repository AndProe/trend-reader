(function () {
  var D = TR.D, esc = TR.esc;
  var terms = D.terms, edges = D.edges, byId = {};
  terms.forEach(function (t) { byId[t.id] = t; });
  var RELS = ['prerequisites', 'part_of', 'contrasts_with', 'related'];
  var REL_KEY = { prerequisites: 'prerequisites', part_of: 'partOf', contrasts_with: 'contrastsWith', related: 'related' };
  var REL_LABEL = { prerequisites: 'Prerequisites', partOf: 'Part of', contrastsWith: 'Contrasts with', related: 'Related' };
  var DIST = { prerequisites: 70, part_of: 60, contrasts_with: 90, related: 110 };
  var STR = { prerequisites: 0.7, part_of: 0.7, contrasts_with: 0.3, related: 0.12 };
  var CORE = { concept: 1, technique: 1, metric: 1 };
  var css = getComputedStyle(document.documentElement);
  function color(type) { return css.getPropertyValue('--g-' + type).trim() || css.getPropertyValue('--c-' + type).trim() || '#888'; }
  function kcolor(cat) { return css.getPropertyValue('--k-' + cat).trim() || '#888'; }

  var allTypes = Object.keys(D.stats.termsByType).filter(function (k) { return D.stats.termsByType[k]; });
  var allCats = Object.keys(D.stats.termsByCategory).filter(function (k) { return D.stats.termsByCategory[k]; });
  var CAT_LABEL = D.stats.categoryLabels || {};
  var weeks = Object.keys(D.stats.termsFirstSeenByWeek).sort();
  var state = { types: {}, cats: {}, rels: {}, from: weeks[0], to: weeks[weeks.length - 1], q: '',
    hideIsolated: false, neighbours: false, selected: null };
  allTypes.forEach(function (t) { state.types[t] = true; });
  allCats.forEach(function (c) { state.cats[c] = true; });
  RELS.forEach(function (r) { state.rels[r] = true; });

  // ---------- svg scaffolding ----------
  var svgEl = document.getElementById('graph'), svg = d3.select(svgEl);
  var W = svgEl.clientWidth || 800, H = svgEl.clientHeight || 600;
  var defs = svg.append('defs');
  defs.append('marker').attr('id', 'arrow-pre').attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4Z');
  defs.append('marker').attr('id', 'arrow-part').attr('class', 'hollow').attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0.5,-3.5L7.5,0L0.5,3.5Z');
  var g = svg.append('g');
  var gl = g.append('g').attr('class', 'links'), gh = g.append('g').attr('class', 'halos'), gn = g.append('g').attr('class', 'nodes'), gp = g.append('g').attr('class', 'pings'), gt = g.append('g').attr('class', 'labels');
  var zoomK = 1;
  var zoom = d3.zoom().scaleExtent([0.15, 6]).on('zoom', function (e) { g.attr('transform', e.transform); zoomK = e.transform.k; refreshLabels(); });
  svg.call(zoom).on('dblclick.zoom', null);
  svg.on('click', function (e) { if (e.target === svgEl) select(null); });

  // node size follows connectivity (links to other terms), never post or source counts
  function radius(d) { return 4 + 2.2 * Math.sqrt(d.degree || 0); }

  var sim = d3.forceSimulation()
    .force('link', d3.forceLink().id(function (d) { return d.id; }).distance(function (l) { return DIST[l.rel]; }).strength(function (l) { return STR[l.rel]; }))
    .force('charge', d3.forceManyBody().strength(-140).distanceMax(400))
    .force('collide', d3.forceCollide(function (d) { return radius(d) + 3; }))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('x', d3.forceX(W / 2).strength(0.03)).force('y', d3.forceY(H / 2).strength(0.03))
    .alphaDecay(0.03);

  var node = gn.selectAll('circle'), halo = gh.selectAll('circle'), link = gl.selectAll('line'), label = gt.selectAll('text');
  var fitted = false;
  // the visible part of the canvas: on wide screens the glass panels cover its edges
  var railEl = document.getElementById('rail'), sideEl = document.getElementById('side'), stripEl = document.getElementById('strip');
  function insets() {
    if (window.innerWidth < 1024) return { l: 0, r: 0, t: 0, b: 0 };
    return { l: railEl.classList.contains('collapsed') ? 0 : railEl.offsetWidth + 32, r: sideEl.classList.contains('collapsed') ? 0 : sideEl.offsetWidth + 32,
      t: 16, b: stripEl.classList.contains('collapsed') ? 48 : stripEl.offsetHeight + 24 };
  }
  function view() {
    W = svgEl.clientWidth || W; H = svgEl.clientHeight || H;
    var p = insets();
    if (W - p.l - p.r < 520) { p.l = 0; p.r = 0; }  // narrow desktops: let the cloud run under the panels
    var aw = Math.max(200, W - p.l - p.r), ah = Math.max(200, H - p.t - p.b);
    return { w: aw, h: ah, cx: p.l + aw / 2, cy: p.t + ah / 2 };
  }
  function fit() {
    if (!curNodes.length) return;
    var v = view();
    var xs = curNodes.map(function (d) { return d.x; }), ys = curNodes.map(function (d) { return d.y; });
    var x0 = d3.min(xs) - 30, x1 = d3.max(xs) + 30, y0 = d3.min(ys) - 30, y1 = d3.max(ys) + 30;
    var k = Math.min(6, 0.95 / Math.max((x1 - x0) / v.w, (y1 - y0) / v.h));
    svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(v.cx - k * (x0 + x1) / 2, v.cy - k * (y0 + y1) / 2).scale(k));
  }
  sim.on('end', function () { if (!fitted && !state.selected) { fitted = true; fit(); } });
  var curNodes = [], curLinks = [], neighbourSet = null;

  sim.on('tick', function () {
    link.attr('x1', function (l) { return l.source.x; }).attr('y1', function (l) { return l.source.y; })
      .attr('x2', function (l) { return endpoint(l, 'x'); }).attr('y2', function (l) { return endpoint(l, 'y'); });
    node.attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; });
    halo.attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; });
    label.attr('x', function (d) { return d.x + radius(d) + 3; }).attr('y', function (d) { return d.y + 4; });
  });
  function endpoint(l, axis) {
    if (l.rel !== 'prerequisites' && l.rel !== 'part_of') return l.target[axis];
    var dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var r = radius(l.target) + 2;
    return axis === 'x' ? l.target.x - dx / len * r : l.target.y - dy / len * r;
  }

  function visible(t) {
    if (!state.types[t.type]) return false;
    if (!state.cats[t.category]) return false;
    if (t.firstSeen && (t.firstSeen < state.from || t.firstSeen > state.to)) return false;
    if (state.q) {
      var q = state.q;
      if (t.name.toLowerCase().indexOf(q) < 0 && !t.aliases.some(function (a) { return a.toLowerCase().indexOf(q) >= 0; })) return false;
    }
    return true;
  }

  function update(restart) {
    var vis = terms.filter(visible), ids = {};
    vis.forEach(function (t) { ids[t.id] = true; });
    var links = edges.filter(function (e) { return state.rels[e.rel] && ids[e.source] && ids[e.target]; })
      .map(function (e) { return { source: e.source, target: e.target, rel: e.rel }; });
    var nodes = vis;
    if (state.hideIsolated) {
      var deg = {};
      links.forEach(function (l) { deg[l.source] = 1; deg[l.target] = 1; });
      nodes = vis.filter(function (t) { return deg[t.id]; });
    }
    curNodes = nodes; curLinks = links;
    sim.nodes(nodes);
    sim.force('link').links(links);
    link = gl.selectAll('line').data(links, function (l) { return l.rel + '|' + (l.source.id || l.source) + '|' + (l.target.id || l.target); })
      .join(function (enter) { return enter.append('line'); })
      .attr('class', function (l) { return l.rel; })
      .attr('marker-end', function (l) { return l.rel === 'prerequisites' ? 'url(#arrow-pre)' : l.rel === 'part_of' ? 'url(#arrow-part)' : null; });
    node = gn.selectAll('circle').data(nodes, function (d) { return d.id; })
      .join(function (enter) {
        return enter.append('circle')
          .on('click', function (e, d) { e.stopPropagation(); select(d.id); })
          .on('dblclick', function (e, d) { e.stopPropagation(); d.fx = d.fy = null; d3.select(this).classed('pinned', false); sim.alpha(0.3).restart(); })
          .call(d3.drag()
            .on('start', function (e, d) { if (!e.active) sim.alphaTarget(0.3).restart(); })
            .on('drag', function (e, d) { d.fx = e.x; d.fy = e.y; })
            .on('end', function (e, d) { if (!e.active) sim.alphaTarget(0); d3.select(this).classed('pinned', true); }))
          .append('title').select(function () { return this.parentNode; });
      })
      .attr('r', radius).attr('fill', function (d) { return color(d.type); });
    halo = gh.selectAll('circle').data(nodes, function (d) { return d.id; }).join('circle')
      .attr('r', function (d) { return radius(d) * 2.4; }).attr('fill', function (d) { return color(d.type); });
    node.select('title').text(function (d) { return d.name + ' · ' + d.type + ' · ' + (CAT_LABEL[d.category] || d.category) + ' · needed by ' + d.neededBy + ' · ' + d.degree + ' links'; });
    label = gt.selectAll('text').data(nodes, function (d) { return d.id; })
      .join(function (enter) { return enter.append('text'); })
      .text(function (d) { return d.name; });
    document.getElementById('gcount').textContent = nodes.length + ' of ' + terms.length + ' terms · ' + links.length + ' edges';
    if (state.selected && !ids[state.selected]) state.selected = null;
    applySelection();
    if (restart !== false) sim.alpha(0.5).restart();
  }

  function refreshLabels() {
    label.attr('display', function (d) {
      if (state.selected && (d.id === state.selected || (neighbourSet && neighbourSet[d.id]))) return null;
      return radius(d) >= 11 || zoomK >= 1.6 ? null : 'none';
    });
  }

  function applySelection() {
    var sel = state.selected;
    neighbourSet = null;
    if (sel) {
      neighbourSet = {};
      curLinks.forEach(function (l) {
        var s = l.source.id || l.source, t = l.target.id || l.target;
        if (s === sel) neighbourSet[t] = 1;
        if (t === sel) neighbourSet[s] = 1;
      });
    }
    var dim = sel && state.neighbours;
    node.classed('sel', function (d) { return d.id === sel; })
      .classed('faded', function (d) { return dim && d.id !== sel && !neighbourSet[d.id]; });
    halo.classed('sel', function (d) { return d.id === sel; }).classed('faded', function (d) { return dim && d.id !== sel && !neighbourSet[d.id]; });
    if (sel && byId[sel] && byId[sel].x != null) {
      var sd = byId[sel];
      gp.append('circle').attr('cx', sd.x).attr('cy', sd.y).attr('r', radius(sd)).attr('stroke', color(sd.type))
        .transition().duration(900).ease(d3.easeCubicOut).attr('r', radius(sd) * 4).style('opacity', 0).remove();
    }
    link.classed('hi', function (l) { return sel && ((l.source.id || l.source) === sel || (l.target.id || l.target) === sel); })
      .classed('faded', function (l) { return dim && (l.source.id || l.source) !== sel && (l.target.id || l.target) !== sel; });
    label.classed('faded', function (d) { return dim && d.id !== sel && !neighbourSet[d.id]; });
    refreshLabels();
    renderSide();
  }

  function select(id, center) {
    if (id && !byId[id]) return;
    if (id && !curNodes.some(function (n) { return n.id === id; })) { resetFilters(false); update(); }
    state.selected = id;
    applySelection();
    var want = id ? '#term-' + id : location.pathname;
    if (location.hash !== (id ? want : '')) history.replaceState(null, '', want);
    if (id && center) centerOn(id);
  }
  function centerOn(id) {
    var d = byId[id];
    function go() {
      if (d.x == null) return;
      var k = Math.max(zoomK, 1.2), v = view();
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(v.cx - d.x * k, v.cy - d.y * k).scale(k));
    }
    go();
    setTimeout(go, 900);
  }

  // ---------- side panel ----------
  var home = document.getElementById('home'), detail = document.getElementById('detail'), foundBody = document.getElementById('found-body');
  var maxNeeded = d3.max(terms, function (t) { return t.neededBy; }) || 1;
  function termRow(t, i) {
    return '<tr data-id="' + t.id + '">' + (i != null ? '<td>' + (i + 1) + '</td>' : '') +
      '<td><span class="badge t-' + t.type + '"><i></i></span> ' + esc(t.name) + '</td>' +
      (i != null ? '<td class="num mono"><span class="ibar" style="--w:' + Math.round(100 * t.neededBy / maxNeeded) + '%"></span>' + t.neededBy + '</td>' : '<td><span class="dim small">' + esc(t.type) + '</span></td>') +
      '<td class="num mono">' + t.degree + '</td></tr>';
  }
  function renderHome() {
    var H = D.home || {};
    document.getElementById('notes-home').innerHTML = (H.notes || []).map(function (n) {
      return '<article class="note-card"><span class="eyebrow">' + esc(n.date) + (n.raisedIn ? ' · raised in ' + esc(n.raisedIn) : '') + '</span>' +
        '<h3><a href="research.html#note-' + n.id + '">' + esc(n.topic) + '</a></h3>' +
        (n.question ? '<p class="question">' + esc(n.question) + '</p>' : '') +
        (n.summary ? '<p class="small">' + esc(n.summary) + '</p>' : '') +
        '<p class="mono dim small">' + esc(n.status) + '</p>' +
        '<a class="btn small" href="research.html#note-' + n.id + '">Read the note</a></article>';
    }).join('') || '<p class="dim small">No research notes yet.</p>';
    var q = H.queue || { total: 0, byStatus: {} };
    var parts = Object.keys(q.byStatus).map(function (k) { return q.byStatus[k] + ' ' + k; });
    document.getElementById('queue-home').innerHTML = '<a href="research.html#research-queue">' + q.total + ' topics in the Research Queue</a>' + (parts.length ? ' <span class="dim">(' + esc(parts.join(', ')) + ')</span>' : '');
  }
  function renderFound() {
    var all = document.getElementById('found-all').checked;
    var rows = terms.filter(function (t) { return (all || CORE[t.type]) && t.foundational > 0; })
      .sort(function (a, b) { return b.foundational - a.foundational || b.neededBy - a.neededBy || b.degree - a.degree || a.name.localeCompare(b.name); }).slice(0, 30);
    foundBody.innerHTML = rows.slice(0, 12).map(termRow).join('') || '<tr><td colspan="4" class="dim">No term is needed by another yet.</td></tr>';
  }
  home.addEventListener('click', function (e) {
    var r = e.target.closest('tr[data-id], .chip.rel');
    if (r) select(r.dataset.id, true);
  });
  document.getElementById('found-all').addEventListener('change', renderFound);

  function chips(ids, rel) {
    return ids.map(function (i) { return '<button type="button" class="chip rel" data-id="' + i + '">' + esc(byId[i] ? byId[i].name : i) + '</button>'; }).join('');
  }
  var sideTitle = document.getElementById('side-title');
  function renderSide() {
    var t = state.selected && byId[state.selected];
    home.hidden = !!t; detail.hidden = !t;
    if (sideTitle) sideTitle.textContent = t ? 'Term' : 'Explore';
    if (t) setCollapsed('side', false);
    if (!t) return;
    var rels = Object.keys(REL_LABEL).filter(function (k) { return t[k] && t[k].length; })
      .map(function (k) { return '<div class="rel-row"><dt>' + REL_LABEL[k] + '</dt><dd>' + chips(t[k]) + '</dd></div>'; }).join('');
    var incoming = terms.filter(function (o) { return o.prerequisites.indexOf(t.id) >= 0; });
    if (incoming.length) rels += '<div class="rel-row"><dt>Needed by</dt><dd>' + chips(incoming.map(function (o) { return o.id; })) + '</dd></div>';
    var usage = t.usage.map(function (u) {
      return '<li>' + (u.author ? '<span class="who">' + esc(u.author) + ' <span class="dim">(' + esc(u.source) + ', ' + esc(u.date) + ')</span></span> ' : '') + '<span class="reading">' + u.readingHtml + '</span></li>';
    }).join('');
    var ev = t.evidence.map(function (e) {
      return '<li><span class="mono dim">' + esc(e.date) + '</span> ' + (e.url ? '<a class="wl wl-post" href="' + esc(e.url) + '" target="_blank" rel="noopener">' + esc(e.title) + '</a>' : esc(e.title)) + (e.author ? ' <span class="dim">· ' + esc(e.author) + '</span>' : '') + '</li>';
    }).join('');
    detail.innerHTML = '<span class="badge t-' + t.type + '"><i></i>' + esc(t.type) + '</span> <span class="badge k-' + t.category + '"><i></i>' + esc(CAT_LABEL[t.category] || t.category) + '</span><h2>' + esc(t.name) + '</h2>' +
      '<p class="def">' + t.definitionHtml + '</p>' +
      (t.aliases.length ? '<p class="aliases"><span class="dim">Also seen as</span> ' + esc(t.aliases.join(', ')) + '</p>' : '') +
      '<dl class="kv"><dt>first seen</dt><dd>' + esc(t.firstSeen || '—') + '</dd><dt>needed by</dt><dd>' + t.neededBy + '</dd><dt>links</dt><dd>' + t.degree + '</dd>' +
      '<dt>rank</dt><dd>' + t.rank + ' <span class="dim">of ' + terms.length + ' · score ' + t.foundational + '</span></dd></dl>' +
      '<dl class="rels">' + rels + '</dl>' +
      '<div class="actions"><a class="btn" href="terms/' + t.id + '.html">Open the term page</a><button type="button" class="btn ghost" id="clear-sel">Clear selection</button></div>' +
      (usage ? '<details><summary>How the sources use it</summary><ul class="usage">' + usage + '</ul></details>' : '') +
      (ev ? '<details open><summary>Where it appears</summary><ul class="evidence">' + ev + '</ul></details>' : '');
    detail.scrollTop = 0;
  }
  detail.addEventListener('click', function (e) {
    var c = e.target.closest('.chip.rel');
    if (c) { select(c.dataset.id, true); return; }
    if (e.target.id === 'clear-sel') select(null);
  });

  // ---------- controls ----------
  var q = document.getElementById('q');
  q.addEventListener('input', function () {
    state.q = q.value.trim().toLowerCase();
    update();
    if (state.q && curNodes.length === 1) select(curNodes[0].id, true);
  });
  document.querySelectorAll('input[name=type]').forEach(function (cb) {
    cb.addEventListener('change', function () { state.types[cb.value] = cb.checked; update(); });
  });
  document.querySelectorAll('input[name=cat]').forEach(function (cb) {
    cb.addEventListener('change', function () { state.cats[cb.value] = cb.checked; update(); drawStrip(); });
  });
  document.querySelectorAll('input[name=rel]').forEach(function (cb) {
    cb.addEventListener('change', function () { state.rels[cb.value] = cb.checked; update(); });
  });
  var wFrom = document.getElementById('w-from'), wTo = document.getElementById('w-to');
  wFrom.addEventListener('change', function () { state.from = wFrom.value; if (state.to < state.from) { state.to = state.from; wTo.value = state.to; } update(); });
  wTo.addEventListener('change', function () { state.to = wTo.value; if (state.to < state.from) { state.from = state.to; wFrom.value = state.from; } update(); });
  document.getElementById('hide-isolated').addEventListener('change', function (e) { state.hideIsolated = e.target.checked; update(); });
  document.getElementById('neighbours').addEventListener('change', function (e) { state.neighbours = e.target.checked; applySelection(); });
  function resetFilters(doUpdate) {
    state.q = ''; q.value = '';
    allTypes.forEach(function (t) { state.types[t] = true; });
    allCats.forEach(function (c) { state.cats[c] = true; });
    RELS.forEach(function (r) { state.rels[r] = true; });
    state.from = weeks[0]; state.to = weeks[weeks.length - 1]; state.hideIsolated = false;
    document.querySelectorAll('input[name=type],input[name=cat],input[name=rel]').forEach(function (cb) { cb.checked = true; });
    wFrom.value = state.from; wTo.value = state.to;
    document.getElementById('hide-isolated').checked = false;
    if (doUpdate !== false) update();
  }
  document.getElementById('reset').addEventListener('click', function () { resetFilters(); drawStrip(); });
  document.getElementById('fit').addEventListener('click', fit);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.selected) select(null); });

  // ---------- stats strip ----------
  function barChart(sel, rows, opts) {
    var el = document.querySelector(sel), w = el.clientWidth || 300, rh = 16, gap = 4, vw = 30;
    var lw = Math.min(opts.maxLabel || 150, Math.round(w * (opts.labelRatio || 0.42))), cut = opts.cut || 20;
    var h = rows.length * (rh + gap);
    var s = d3.select(sel).attr('viewBox', '0 0 ' + w + ' ' + h).attr('height', h);
    s.selectAll('*').remove();
    var max = d3.max(rows, function (r) { return r.value; }) || 1;
    var x = d3.scaleLinear().domain([0, max]).range([0, Math.max(10, w - lw - vw - 8)]);
    var gr = s.selectAll('g').data(rows).join('g').attr('class', function (r) { return r.muted ? 'muted' : null; })
      .attr('transform', function (r, i) { return 'translate(0,' + i * (rh + gap) + ')'; });
    gr.append('text').attr('class', 'lbl').attr('x', lw - 6).attr('y', rh - 4).attr('text-anchor', 'end')
      .text(function (r) { return r.label.length > cut ? r.label.slice(0, cut - 1) + '\u2026' : r.label; })
      .append('title').text(function (r) { return r.label; });
    gr.append('rect').attr('x', lw).attr('y', 1).attr('height', rh - 2).attr('width', function (r) { return Math.max(2, x(r.value)); }).attr('rx', 2)
      .attr('fill', function (r) { return r.color; }).on('click', function (e, r) { opts.onClick(r); })
      .append('title').text(function (r) { return r.title || (r.label + ': ' + r.value); });
    gr.append('text').attr('class', 'val').attr('x', function (r) { return lw + Math.max(2, x(r.value)) + 5; }).attr('y', rh - 4)
      .text(function (r) { return r.tag ? r.value + ' ' + r.tag : r.value; });
  }
  function drawStrip() {
    var fresh = css.getPropertyValue('--emerging').trim() || '#e8590c';
    var em = ((D.home || {}).newTerms || []).map(function (id) { return byId[id]; }).filter(Boolean);
    var cEm = document.getElementById('c-new');
    if (!em.length) {
      cEm.setAttribute('height', 24); cEm.innerHTML = '<text class="lbl" x="0" y="14">No new terms in the last two weeks.</text>';
    } else {
      barChart('#c-new', em.map(function (t) {
        return { key: t.id, label: t.name, value: t.degree, color: fresh, tag: t.degree === 1 ? 'link' : 'links',
          title: t.name + ': needed by ' + t.neededBy + ', ' + t.degree + ' links \u00b7 first seen ' + t.firstSeen };
      }), { cut: 24, onClick: function (r) { select(r.key, true); } });
    }
    barChart('#c-cat', allCats.map(function (k) {
      return { key: k, label: CAT_LABEL[k] || k, value: D.stats.termsByCategory[k], color: kcolor(k), muted: !state.cats[k] };
    }), { labelRatio: 0.5, maxLabel: 190, cut: 28, onClick: function (r) {
      var only = allCats.every(function (k) { return state.cats[k] === (k === r.key); });
      allCats.forEach(function (k) { state.cats[k] = only ? true : k === r.key; });
      document.querySelectorAll('input[name=cat]').forEach(function (cb) { cb.checked = state.cats[cb.value]; });
      update(); drawStrip();
    } });
  }
  document.addEventListener('tr:theme', function () {
    node.attr('fill', function (d) { return color(d.type); });
    halo.attr('fill', function (d) { return color(d.type); });
    drawStrip();
  });

  // ---------- glass panels ----------
  function setCollapsed(id, collapsed) {
    var el = document.getElementById(id), btn = document.querySelector('[data-collapse="' + id + '"]');
    if (!el || el.classList.contains('collapsed') === collapsed) return;
    el.classList.toggle('collapsed', collapsed);
    if (btn) { btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true'); btn.title = (collapsed ? 'Show ' : 'Hide ') + (id === 'rail' ? 'the filters' : id === 'side' ? 'this panel' : 'the charts'); }
    if (id === 'strip' && !collapsed) drawStrip();
    if (state.selected) centerOn(state.selected); else fit();
  }
  document.querySelectorAll('[data-collapse]').forEach(function (b) {
    b.addEventListener('click', function () { var el = document.getElementById(b.dataset.collapse); setCollapsed(b.dataset.collapse, !el.classList.contains('collapsed')); });
  });

  // ---------- boot ----------
  renderFound();
  renderHome();
  update();
  drawStrip();
  function onHash() {
    var id = TR.hashId();
    if (/^term-/.test(id)) select(id.slice(5), true);
    if (id === 'strip') { setCollapsed('strip', false); if (window.innerWidth < 1024) TR.reveal('strip'); }
  }
  window.addEventListener('hashchange', onHash);
  setTimeout(onHash, 300);
  window.addEventListener('resize', function () {
    W = svgEl.clientWidth || W; H = svgEl.clientHeight || H;
    sim.force('center', d3.forceCenter(W / 2, H / 2)).force('x', d3.forceX(W / 2).strength(0.03)).force('y', d3.forceY(H / 2).strength(0.03));
    drawStrip();
    if (!state.selected) fit();
  });
})();
