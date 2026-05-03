import { Article } from '../models/Article.js';
import { Collection } from '../models/Collection.js';
import { User } from '../models/User.js';
import { Tag } from '../models/Tag.js';
import { Feedback } from '../models/Feedback.js';
import { Report } from '../models/Report.js';
import { LegalPage } from '../models/LegalPage.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { isMongoConnected } from './db.js';
/**
 * Clear all data from MongoDB without seeding
 * Use this if you want to empty the database
 */
export async function clearDatabase() {
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
        const feedbackResult = await Feedback.deleteMany({});
        const reportResult = await Report.deleteMany({});
        const legalResult = await LegalPage.deleteMany({});
        const contactResult = await ContactMessage.deleteMany({});
        console.log('[ClearDB] ✓ Database cleared successfully');
        console.log(`[ClearDB] Deleted: ${articleResult.deletedCount} articles, ${userResult.deletedCount} users, ${collectionResult.deletedCount} collections, ${tagResult.deletedCount} tags, ${feedbackResult.deletedCount} feedback entries, ${reportResult.deletedCount} reports, ${legalResult.deletedCount} legal pages, ${contactResult.deletedCount} contact messages`);
    }
    catch (error) {
        console.error('[ClearDB] Error clearing database:', error);
        throw error;
    }
}
//# sourceMappingURL=clearDatabase.js.map