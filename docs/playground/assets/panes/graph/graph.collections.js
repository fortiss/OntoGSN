// assets/panes/graph/graph.collections.js

export function createCollectionsController({
  layer,
  pos,
  ctxPos,
  label = (x) => x,
  labelWidth,
}) {
  function getHostPos(id) {
    const key = String(id).trim();
    const p = pos.get(key) || ctxPos.get(key);
    return p ? { x: p.x, y: p.y } : null;
  }

  function clearCollections() {
    layer.selectAll("*").remove();
  }

  function addCollections(rows, opts = {}) {
    clearCollections();

    const dxHub = opts.dxHub ?? opts.dx ?? 90;
    const dyHub = opts.dyHub ?? opts.dy ?? 40;
    const dyStride = opts.dyStride ?? 30;

    const rHub = opts.rHub ?? 5;
    const armLen = opts.armLen ?? 50;
    const maxPerRow = opts.maxPerRow ?? 6;
    const ringGap = opts.ringGap ?? 16;
    const startAngle = opts.startAngle ?? (Math.PI / 2);

    // Group by context + collection
    const groups = new Map(); // `${ctx}||${clt}` -> { ctx, clt, items:Set }

    for (const r of rows) {
      if (!r?.ctx || !r?.clt || !r?.item) continue;

      const key = `${r.ctx}||${r.clt}`;
      let g = groups.get(key);

      if (!g) {
        g = { ctx: r.ctx, clt: r.clt, items: new Set() };
        groups.set(key, g);
      }

      g.items.add(r.item);
    }

    const hubsPerCtx = new Map(); // ctx -> count

    for (const g of groups.values()) {
      const host = getHostPos(g.ctx);
      if (!host) continue;

      const idx = hubsPerCtx.get(g.ctx) ?? 0;
      hubsPerCtx.set(g.ctx, idx + 1);

      const hubX = host.x + dxHub;
      const hubY = host.y + dyHub + idx * dyStride;

      // Link from host to hub
      layer.append("path")
        .attr("class", "gsn-link collection")
        .attr("d", `M${host.x},${host.y} L${hubX},${hubY}`);

      // Hub dot
      const hub = layer.append("g")
        .attr("class", "collection-hub")
        .attr("transform", `translate(${hubX},${hubY})`);

      hub.append("circle")
        .attr("r", rHub)
        .attr("class", "collection-dot");

      const itemList = Array.from(g.items);
      const perRing = Math.max(1, maxPerRow);

      itemList.forEach((itemId, i) => {
        const ring = Math.floor(i / perRing);
        const posInRing = i % perRing;

        const angle = startAngle + (2 * Math.PI / perRing) * posInRing;
        const radius = armLen + ring * ringGap;

        const ix = hubX + Math.cos(angle) * radius;
        const iy = hubY + Math.sin(angle) * radius;

        // Spoke
        layer.append("path")
          .attr("class", "gsn-link collection")
          .attr("d", `M${hubX},${hubY} L${ix},${iy}`);

        const itemLabel = label(itemId);
        const w = Math.max(42, Math.min(180, labelWidth(itemLabel)));
        const h = 20;

        const gi = layer.append("g")
          .attr("class", "gsn-node collection item")
          .attr("transform", `translate(${ix},${iy})`);

        gi.append("rect")
          .attr("width", w)
          .attr("height", h)
          .attr("x", -w / 2)
          .attr("y", -h / 2);

        gi.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .text(itemLabel)
          .append("title")
          .text(String(itemId));
      });
    }
  }

  return { addCollections, clearCollections };
}