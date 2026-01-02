import { Collection } from '../models/Collection.js';

/**
 * Remove article references from all collections when an article is deleted.
 * This maintains referential integrity by cleaning up stale entries.
 * 
 * @param articleId - The ID of the deleted article
 * @returns Promise resolving to the number of collections updated
 */
export async function cleanupCollectionEntries(articleId: string): Promise<number> {
  try {
    // First, find collections that contain this articleId
    const affectedCollections = await Collection.find({
      'entries.articleId': articleId
    });
    
    if (affectedCollections.length === 0) {
      return 0; // No collections to update
    }
    
    // Use $pull to atomically remove entries matching the articleId
    // Also decrement validEntriesCount if it exists
    const result = await Collection.updateMany(
      { 'entries.articleId': articleId },
      {
        $pull: { entries: { articleId } },
        $set: { updatedAt: new Date().toISOString() },
        $inc: { validEntriesCount: -1 } // Decrement count if field exists
      }
    );
    
    // For collections where validEntriesCount was undefined/null, recalculate after update
    // This handles legacy collections that don't have the field set
    const updatedCollections = await Collection.find({
      _id: { $in: affectedCollections.map(c => c._id) }
    });
    
    for (const collection of updatedCollections) {
      // If validEntriesCount is undefined, null, or negative, recalculate from entries
      if (collection.validEntriesCount === undefined || 
          collection.validEntriesCount === null || 
          collection.validEntriesCount < 0) {
        collection.validEntriesCount = collection.entries.length;
        await collection.save();
      }
    }
    
    return result.modifiedCount;
  } catch (error: any) {
    // Log error but don't throw - deletion should succeed even if cleanup fails
    // This prevents cascading failures
    console.error(`[CollectionHelpers] Failed to cleanup entries for article ${articleId}:`, error);
    return 0;
  }
}

/**
 * Recalculate and update validEntriesCount for a collection.
 * This validates entries against existing articles and updates the count.
 * 
 * @param collectionId - The ID of the collection to update
 * @param validArticleIds - Set of valid article IDs (from Article.find())
 * @returns Promise resolving to the updated collection or null
 */
export async function updateValidEntriesCount(
  collectionId: string,
  validArticleIds: Set<string>
): Promise<number> {
  try {
    const collection = await Collection.findById(collectionId);
    if (!collection) return 0;
    
    // Filter entries to only those with valid article IDs
    const validEntries = collection.entries.filter(entry => 
      validArticleIds.has(entry.articleId)
    );
    
    const validCount = validEntries.length;
    
    // Update collection with validated entries and count
    await Collection.findByIdAndUpdate(
      collectionId,
      {
        entries: validEntries,
        validEntriesCount: validCount,
        updatedAt: new Date().toISOString()
      }
    );
    
    return validCount;
  } catch (error: any) {
    console.error(`[CollectionHelpers] Failed to update validEntriesCount for collection ${collectionId}:`, error);
    return 0;
  }
}

