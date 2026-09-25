/* Home hero: the knowledge graph as an ambient, glowing map. Hover shows a term, click opens its page. */
(function () {
  var D = TR.D, esc = TR.esc;
  var svgEl = document.getElementById('hero-graph');
  if (!svgEl || !D.graph || !window.d3) return;
  var terms = D.graph.nodes, edges = D.graph.edges, byId = {};
  terms.forEach(function (t) { byId[t.id] = t; });
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = getComputedStyle(document.documentElement);
  function color(type) { return css.getPropertyValue('--g-' + type).trim() || '#8fa3ff'; }
  var svg = d3.select(svgEl), W = svgEl.clientWidth || 1200, H = svgEl.clientHeight || 640;
  var g = svg.append('g');
  var gl = g.append('g').attr('class', 'h-links'), gh = g.append('g').attr('class', 'h-halos'),
      gn = g.append('g').attr('class', 'h-nodes'), gp = g.append('g').attr('class', 'h-pings'), gt = g.append('g').attr('class', 'h-labels');
  function radius(d) { return 3 + 2.0 * Math.sqrt(d.degree || 0); }  // size by links to other terms

  var DIST = { prerequisites: 60, part_of: 52, contrasts_with: 80, related: 96 };
  var STR = { prerequisites: 0.7, part_of: 0.7, contrasts_with: 0.3, related: 0.14 };
  var links = edges.map(function (e) { return { source: e.source, target: e.target, rel: e.rel }; });
  var sim = d3.forceSimulation(terms)
    .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (l) { return DIST[l.rel]; }).strength(function (l) { return STR[l.rel]; }))
    .force('charge', d3.forceManyBody().strength(-120).distanceMax(380))
    .force('collide', d3.forceCollide(function (d) { return radius(d) + 4; }))
    .force('x', d3.forceX(0).strength(0.035)).force('y', d3.forceY(0).strength(0.045))
    .alphaDecay(0.028);

  var link = gl.selectAll('line').data(links).join('line').attr('class', function (l) { return l.rel; });
  var halo = gh.selectAll('circle').data(terms).join('circle').attr('r', function (d) { return radius(d) * 2.6; }).attr('fill', function (d) { return color(d.type); });
  var node = gn.selectAll('circle').data(terms).join('circle').attr('r', radius).attr('fill', function (d) { return color(d.type); })
    .attr('tabindex', -1)
    .on('mouseenter', function (e, d) { hover(d); }).on('mouseleave', function () { hover(null); })
    .on('click', function (e, d) { location.href = 'terms/' + d.id + '.html'; });
  node.append('title').text(function (d) { return d.name; });
  var big = terms.slice().sort(function (a, b) { return b.foundational - a.foundational || b.degree - a.degree; }).slice(0, 18).reduce(function (m, t) { m[t.id] = 1; return m; }, {});
  var label = gt.selectAll('text').data(terms.filter(function (t) { return big[t.id]; })).join('text').text(function (d) { return d.name; });

  var tip = document.getElementById('hero-tip');
  var hovered = null;
  function hover(d) {
    hovered = d;
    node.classed('hi', function (n) { return d && n.id === d.id; });
    link.classed('hi', function (l) { return d && (l.source.id === d.id || l.target.id === d.id); });
    if (!tip) return;
    if (!d) { tip.hidden = true; return; }
    tip.innerHTML = '<span class="badge t-' + esc(d.type) + '"><i></i>' + esc(d.type) + '</span><strong>' + esc(d.name) + '</strong><span class="mono">' + (d.neededBy ? 'needed by ' + d.neededBy + ' \u00b7 ' : '') + d.degree + ' links \u00b7 open \u2192</span>';
    tip.hidden = false;
  }
  svgEl.addEventListener('mousemove', function (e) {
    if (!tip || tip.hidden) return;
    var r = svgEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.left = Math.min(x + 16, r.width - tip.offsetWidth - 12) + 'px';
    tip.style.top = Math.max(12, y - tip.offsetHeight - 14) + 'px';
  });

  // view: keep the cloud centred and scaled to the canvas
  var k = 1;
  function fit(animate) {
    W = svgEl.clientWidth || W; H = svgEl.clientHeight || H;
    var xs = terms.map(function (d) { return d.x; }), ys = terms.map(function (d) { return d.y; });
    var x0 = d3.min(xs), x1 = d3.max(xs), y0 = d3.min(ys), y1 = d3.max(ys);
    if (x0 == null) return;
    // on wide screens the copy sits on the left, so the cloud lives in the right two thirds
    var wide = W > 900, aw = wide ? W * 0.66 : W, cx = wide ? W * 0.64 : W / 2;
    k = Math.min(2.2, 0.96 / Math.max((x1 - x0) / aw, (y1 - y0) / H));
    var t = 'translate(' + (cx - k * (x0 + x1) / 2) + ',' + (H / 2 - k * (y0 + y1) / 2) + ') scale(' + k + ')';
    (animate ? g.transition().duration(700) : g).attr('transform', t);
    label.attr('display', k < 0.55 ? 'none' : null);
  }
  var fitted = false, ticks = 0;
  sim.on('tick', function () {
    link.attr('x1', function (l) { return l.source.x; }).attr('y1', function (l) { return l.source.y; })
      .attr('x2', function (l) { return l.target.x; }).attr('y2', function (l) { return l.target.y; });
    halo.attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; });
    node.attr('cx', function (d) { return d.x; }).attr('cy', function (d) { return d.y; });
    label.attr('x', function (d) { return d.x + radius(d) + 4; }).attr('y', function (d) { return d.y + 4; });
    ticks++;
    if (!fitted && ticks % 12 === 0) fit(false);
  });
  var settled = false, onScreen = true, pingTimer = null;
  function ambient(on) {
    if (reduced || !settled) return;
    if (on) { sim.alphaTarget(0.012).restart(); if (!pingTimer) pingTimer = setInterval(ping, 2600); }
    else { sim.alphaTarget(0); sim.stop(); if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }
  }
  sim.on('end', function () {
    if (settled) return;
    settled = true; fitted = true; fit(true);
    svgEl.classList.add('settled');
    ambient(onScreen);
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; ambient(onScreen); }, { threshold: 0.05 }).observe(svgEl);
  }
  document.addEventListener('visibilitychange', function () { ambient(!document.hidden && onScreen); });
  // warm start: run the layout a little before first paint so the cloud is never a blob
  for (var i = 0; i < 60; i++) sim.tick();
  fit(false);

  // pings: a slow radar pulse on emerging terms
  var emerging = (D.graph.newTerms || []).map(function (id) { return byId[id]; }).filter(Boolean);
  function ping() {
    if (document.hidden || !emerging.length) return;
    var d = emerging[Math.floor(Math.random() * emerging.length)];
    gp.append('circle').attr('cx', d.x).attr('cy', d.y).attr('r', radius(d)).attr('stroke', color(d.type))
      .transition().duration(1800).ease(d3.easeCubicOut).attr('r', radius(d) * 5).style('opacity', 0).remove();
  }

  window.addEventListener('resize', function () { fit(false); });
  document.addEventListener('tr:theme', function () { css = getComputedStyle(document.documentElement); });
})();
