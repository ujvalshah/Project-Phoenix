/**
 * Dev-only Web Vitals (INP + attribution). Loaded via dynamic import from main.tsx
 * only when `import.meta.env.DEV` is true so production bundles omit this module.
 */
/* eslint-disable no-console -- intentional dev-only console grouping for local INP debugging */
import { onINP } from 'web-vitals/attribution';

let started = false;

export function startDevPerfVitals(): void {
  if (started) return;
  started = true;

  onINP((metric) => {
    const a = metric.attribution;
    console.groupCollapsed(
      `[web-vitals] INP ${Math.round(metric.value)}ms (${metric.rating})`,
    );
    console.log({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      interactionTarget: a?.interactionTarget,
      interactionType: a?.interactionType,
      inputDelay: a?.inputDelay,
      processingDuration: a?.processingDuration,
      presentationDelay: a?.presentationDelay,
      longestScript: a?.longestScript,
      longAnimationFrameEntries: a?.longAnimationFrameEntries,
    });
    console.groupEnd();
  });
}
