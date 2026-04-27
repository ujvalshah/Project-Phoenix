import { isNuggetEditorLazySplitEnabled } from '@/config/nuggetPerformanceConfig';
import { shouldEnableNuggetModalPreloadForUser } from '@/utils/performanceRollout';

/**
 * Single shared `import()` promise for the CreateNuggetModal module graph.
 * – Used by `CreateNuggetModalLoadable` (React.lazy) so there is one chunk + one in-flight request.
 * – Call `preloadCreateNuggetModalChunk()` on user intent (hover / pointer down) to start fetch early.
 */
let createNuggetModalModulePromise: Promise<typeof import('./CreateNuggetModal')> | null = null;

export function loadCreateNuggetModalModule(): Promise<typeof import('./CreateNuggetModal')> {
  if (!createNuggetModalModulePromise) {
    createNuggetModalModulePromise = import('./CreateNuggetModal');
  }
  return createNuggetModalModulePromise;
}

/** Same graph as `React.lazy` inside CreateNuggetModal — prewarm to avoid a second network round-trip after the shell chunk. */
let contentEditorModulePromise: Promise<typeof import('./CreateNuggetModal/ContentEditor')> | null = null;
function loadContentEditorModule(): Promise<typeof import('./CreateNuggetModal/ContentEditor')> {
  if (!contentEditorModulePromise) {
    contentEditorModulePromise = import('./CreateNuggetModal/ContentEditor');
  }
  return contentEditorModulePromise;
}

export type PreloadCreateNuggetModalOptions = {
  /** Used with rollout % for stable cohorting (pass `user?.id` when available). */
  userId?: string | null;
};

function shouldPreloadEditorSubchunk(): boolean {
  return isNuggetEditorLazySplitEnabled();
}

/**
 * Start fetch of the nugget editor shell and (when editor is lazy) the body editor sub-chunk
 * in parallel — same `import()` promises the app uses when the modal mounts.
 * No-ops when the chunk-preload feature or canary cohort is off.
 */
export function preloadCreateNuggetModalChunk(options?: PreloadCreateNuggetModalOptions): void {
  if (!shouldEnableNuggetModalPreloadForUser(options?.userId)) {
    return;
  }
  void loadCreateNuggetModalModule();
  if (shouldPreloadEditorSubchunk()) {
    void loadContentEditorModule();
  }
}
