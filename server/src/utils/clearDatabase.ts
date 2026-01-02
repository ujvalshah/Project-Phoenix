import { Article } from '../models/Article.js';
import { Collection } from '../models/Collection.js';
import { User } from '../models/User.js';
import { Tag } from '../models/Tag.js';
import { LegalPage } from '../models/LegalPage.js';
import { Feedback } from '../models/Feedback.js';
import { Report } from '../models/Report.js';
import { isMongoConnected } from './db.js';

/**
 * Clear all data from MongoDB without seeding
 * Use this if you want to empty the database
 */
export async function clearDatabase(): Promise<void> {
  if (!isMongoConnected()) {
    console.log('[ClearDB] Skipped - MongoDB not connected');
    return;
  }

  try {
    console.log('[ClearDB] Clearing all data from database...');
    
    // Clear all collections
    const articleResult = await Article.deleteMany({});
    const userResult = await User.deleteMany({});
    const collectionResult = await Collection.deleteMany({});
    const tagResult = await Tag.deleteMany({});
    const legalPageResult = await LegalPage.deleteMany({});
    const feedbackResult = await Feedback.deleteMany({});
    const reportResult = await Report.deleteMany({});
    
    console.log('[ClearDB] ✓ Database cleared successfully');
    console.log(`[ClearDB] Deleted: ${articleResult.deletedCount} articles, ${userResult.deletedCount} users, ${collectionResult.deletedCount} collections, ${tagResult.deletedCount} tags, ${legalPageResult.deletedCount} legal pages, ${feedbackResult.deletedCount} feedback entries, ${reportResult.deletedCount} reports`);
  } catch (error: any) {
    console.error('[ClearDB] Error clearing database:', error);
    throw error;
  }
}











