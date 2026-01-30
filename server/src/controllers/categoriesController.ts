/**
 * Categories Controller (Legacy)
 *
 * Re-exports tags controller functions with legacy category names.
 * The "categories" endpoint is maintained for backward compatibility
 * but internally uses the Tags system.
 */

import { getTags } from './tagsController.js';

// Re-export getTags as getCategories for legacy API compatibility
export const getCategories = getTags;
