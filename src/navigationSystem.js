export const NAV_STEP = 16;
export const NAV_OFFSET = NAV_STEP / 2;

export function nearestNavCenter(center, size, worldSize, margin = 2) {
  const half = size / 2;
  const minCenter = margin + half;
  const maxCenter = worldSize - margin - half;

  const minIndex = Math.ceil((minCenter - NAV_OFFSET) / NAV_STEP);
  const maxIndex = Math.floor((maxCenter - NAV_OFFSET) / NAV_STEP);

  const rawIndex = Math.round((center - NAV_OFFSET) / NAV_STEP);
  const index = Math.max(minIndex, Math.min(maxIndex, rawIndex));

  return NAV_OFFSET + index * NAV_STEP;
}

export function nearestNavStart(center, size, worldSize, margin = 2) {
  return nearestNavCenter(center, size, worldSize, margin) - size / 2;
}

export function isNavAlignedStart(start, size, worldSize, tolerance = 0.05, margin = 2) {
  const center = start + size / 2;
  const nearest = nearestNavCenter(center, size, worldSize, margin);
  return Math.abs(center - nearest) <= tolerance;
}

export function navLaneIndexFromStart(start, size) {
  const center = start + size / 2;
  return Math.round((center - NAV_OFFSET) / NAV_STEP);
}

export function navStartCandidates(center, size, worldSize, margin = 2, radius = 2) {
  const half = size / 2;
  const minCenter = margin + half;
  const maxCenter = worldSize - margin - half;
  const minIndex = Math.ceil((minCenter - NAV_OFFSET) / NAV_STEP);
  const maxIndex = Math.floor((maxCenter - NAV_OFFSET) / NAV_STEP);
  const rawIndex = (center - NAV_OFFSET) / NAV_STEP;
  const nearestIndex = Math.round(rawIndex);
  const currentStart = center - half;
  const candidates = [];

  for (let delta = -radius; delta <= radius; delta++) {
    const index = nearestIndex + delta;
    if (index < minIndex || index > maxIndex) continue;
    const laneCenter = NAV_OFFSET + index * NAV_STEP;
    const start = laneCenter - half;
    candidates.push({
      index,
      center: laneCenter,
      start,
      distance: Math.abs(start - currentStart),
    });
  }

  return candidates.sort((a, b) =>
    a.distance - b.distance ||
    Math.abs(a.index - rawIndex) - Math.abs(b.index - rawIndex) ||
    a.index - b.index
  );
}
