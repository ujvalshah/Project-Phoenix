/**
 * Dev-only: double-rAF measure from modal open to first paint after shell state commits.
 * Does not run in production builds (`import.meta.env.DEV` is false).
 */
export function scheduleNuggetModalShellVisibleProbe(): () => void {
  if (!import.meta.env.DEV) {
    return () => {};
  }
  const markStart = `nugget-shell-vis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const markEnd = `${markStart}-end`;
  const measureName = 'nugget-modal-shell-visible';

  try {
    performance.mark(markStart);
  } catch {
    return () => {};
  }

  let raf1 = 0;
  let raf2 = 0;
  let cancelled = false;

  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        performance.mark(markEnd);
        performance.measure(measureName, markStart, markEnd);
        const entry = performance.getEntriesByName(measureName, 'measure').pop() as
          | PerformanceMeasure
          | undefined;
        const ms = entry?.duration ?? 0;
        performance.clearMarks(markStart);
        performance.clearMarks(markEnd);
        performance.clearMeasures(measureName);
      } catch {
        /* ignore */
      }
    });
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
  };
}
