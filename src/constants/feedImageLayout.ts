/**
 * Responsive `sizes` hints for feed card thumbnails (Hero / masonry columns ≈ ArticleGrid breakpoints).
 * Used with `<img>`; pair with responsive `srcset` when CDN delivers derivatives.
 */

/** Approx full card media width (grid-cols: 1 / 2 / 3 / xl:4); matches Tailwind `sm`/`md`/`lg`/`xl`. */
export const FEED_CARD_HERO_IMAGE_SIZES =
  '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 34vw, 25vw';

/**
 * Per-cell widths for multi-image card thumbnails (`sm`: 2-column split; below `sm` cells stack ~full width).
 */
export const FEED_CARD_GRID_CELL_IMAGE_SIZES =
  '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 18vw, 14vw';

/** 16:9 intrinsic hints for hero area inside fixed aspect-ratio card media (`CardMedia`). */
export const FEED_CARD_MEDIA_INTRINSIC_WIDTH = 640;
export const FEED_CARD_MEDIA_INTRINSIC_HEIGHT = 360;

/** MySpace / workspace grid cards (`md:2` / `xl:3`); same band as feed hero thumbnails. */
export const WORKSPACE_GRID_CARD_IMAGE_SIZES = FEED_CARD_HERO_IMAGE_SIZES;

/** Compact list-row thumb (~6rem wide). */
export const WORKSPACE_LIST_ROW_IMAGE_SIZES =
  '(max-width: 767px) 28vw, 112px';

export const WORKSPACE_LIST_THUMB_WIDTH = 112;
export const WORKSPACE_LIST_THUMB_HEIGHT = 63;
