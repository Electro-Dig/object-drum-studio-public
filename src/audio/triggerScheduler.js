export function nextStrictStartTime(lastStarts, key, requestedTime, currentTime, minGap = 0.002) {
  const gap = Math.max(0.0001, numberOr(minGap, 0.002));
  const baseTime = numberOr(requestedTime, numberOr(currentTime, 0));
  const lastTime = lastStarts.get(key) ?? -Infinity;
  const startTime = baseTime <= lastTime ? lastTime + gap : baseTime;
  lastStarts.set(key, startTime);
  return startTime;
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
