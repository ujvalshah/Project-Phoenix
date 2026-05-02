import { describe, expect, it } from 'vitest';
import {
  PRIORITY_THUMBNAIL_CAP,
  getPriorityThumbnailCount,
} from '@/constants/aboveFoldPriority';

describe('getPriorityThumbnailCount', () => {
  it('covers one grid row plus one slack tile under the ceiling', () => {
    expect(getPriorityThumbnailCount(1)).toBe(2);
    expect(getPriorityThumbnailCount(2)).toBe(3);
    expect(getPriorityThumbnailCount(3)).toBe(4);
    expect(getPriorityThumbnailCount(4)).toBe(5);
    expect(getPriorityThumbnailCount(8)).toBe(PRIORITY_THUMBNAIL_CAP);
  });

  it('floors invalid column counts to 1', () => {
    expect(getPriorityThumbnailCount(0)).toBe(getPriorityThumbnailCount(1));
  });
});
