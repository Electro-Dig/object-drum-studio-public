export function buildLilyGraph(nodes = [], options = {}) {
  const range = Math.max(1, numberOr(options.range, 90));
  const validNodes = nodes.filter((node) => node?.id && Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y)));
  const edges = [];
  const neighborsById = Object.fromEntries(validNodes.map((node) => [node.id, []]));

  for (let i = 0; i < validNodes.length; i += 1) {
    for (let j = i + 1; j < validNodes.length; j += 1) {
      const a = validNodes[i];
      const b = validNodes[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > range) continue;

      edges.push({ from: a.id, to: b.id, distance });
      neighborsById[a.id].push({ id: b.id, node: b, distance });
      neighborsById[b.id].push({ id: a.id, node: a, distance });
    }
  }

  for (const neighbors of Object.values(neighborsById)) {
    neighbors.sort((a, b) => a.distance - b.distance || String(a.id).localeCompare(String(b.id)));
  }

  return { nodes: validNodes, edges, neighborsById };
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
