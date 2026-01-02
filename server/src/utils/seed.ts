import { Article } from '../models/Article.js';
import { Collection } from '../models/Collection.js';
import { User } from '../models/User.js';
import { Tag } from '../models/Tag.js';
import { LegalPage } from '../models/LegalPage.js';
import { Feedback } from '../models/Feedback.js';
import { Report } from '../models/Report.js';
import { isMongoConnected } from './db.js';
import bcrypt from 'bcryptjs';

/**
 * Seed MongoDB with initial data if collections are empty
 * This runs automatically on first MongoDB connection
 * 
 * SECURITY: This function is disabled in production to prevent accidental
 * creation of demo users in production databases.
 */
export async function seedDatabase(): Promise<void> {
  // Prevent seeding in production
  if (process.env.NODE_ENV === 'production') {
    console.log('[Seed] Skipped - Seeding disabled in production');
    return;
  }

  if (!isMongoConnected()) {
    console.log('[Seed] Skipped - MongoDB not connected');
    return;
  }

  try {
    // Check if database is already populated
    const articleCount = await Article.countDocuments();
    const userCount = await User.countDocuments();
    const collectionCount = await Collection.countDocuments();
    const tagCount = await Tag.countDocuments();
    const legalPageCount = await LegalPage.countDocuments();
    const feedbackCount = await Feedback.countDocuments();
    const reportCount = await Report.countDocuments();

    if (articleCount > 0 || userCount > 0 || collectionCount > 0 || tagCount > 0 || legalPageCount > 0 || feedbackCount > 0 || reportCount > 0) {
      console.log('[Seed] Skipped - Database already populated');
      console.log(`[Seed] Current counts: Articles: ${articleCount}, Users: ${userCount}, Collections: ${collectionCount}, Tags: ${tagCount}, Legal Pages: ${legalPageCount}, Feedback: ${feedbackCount}, Reports: ${reportCount}`);
      return;
    }

    console.log('[Seed] Database is empty, seeding initial data...');

    // Seed Tags/Categories
    const tags = ['Tech', 'Business', 'Finance', 'Design', 'Lifestyle', 'India', 'Innovation', 'Sustainability', 'Startups', 'Economy', 'Growth', 'Development'];
    const tagDocs = tags.map(name => ({ 
      name,
      type: 'category' as const,
      status: 'active' as const,
      isOfficial: true
    }));
    await Tag.insertMany(tagDocs);
    console.log(`[Seed] ✓ Created ${tags.length} tags`);

    // Seed Users (using new modular structure)
    const now1 = '2025-01-15T10:00:00Z';
    const now2 = '2025-02-20T14:30:00Z';
    
    // Hash passwords for demo users (password: "password")
    const hashedPassword = await bcrypt.hash('password', 10);
    
    const users = [
      {
        role: 'admin' as const,
        password: hashedPassword,
        auth: {
          email: 'akash@example.com',
          emailVerified: true,
          provider: 'email' as const,
          createdAt: now1,
          updatedAt: now1
        },
        profile: {
          displayName: 'Akash Solanki',
          username: 'akash',
          avatarColor: 'blue' as const
        },
        security: {
          mfaEnabled: false
        },
        preferences: {
          theme: 'system' as const,
          defaultVisibility: 'public' as const,
          interestedCategories: ['Tech', 'Business', 'Finance'],
          compactMode: false,
          richMediaPreviews: true,
          autoFollowCollections: true,
          notifications: {
            emailDigest: true,
            productUpdates: true,
            newFollowers: true
          }
        },
        appState: {
          lastLoginAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          onboardingCompleted: true
        }
      },
      {
        role: 'user' as const,
        password: hashedPassword,
        auth: {
          email: 'hemant@example.com',
          emailVerified: true,
          provider: 'email' as const,
          createdAt: now2,
          updatedAt: now2
        },
        profile: {
          displayName: 'Hemant Sharma',
          username: 'hemant',
          avatarColor: 'green' as const
        },
        security: {
          mfaEnabled: false
        },
        preferences: {
          theme: 'system' as const,
          defaultVisibility: 'public' as const,
          interestedCategories: ['Design', 'Lifestyle'],
          compactMode: false,
          richMediaPreviews: true,
          autoFollowCollections: true,
          notifications: {
            emailDigest: true,
            productUpdates: false,
            newFollowers: true
          }
        },
        appState: {
          lastLoginAt: new Date().toISOString(),
          onboardingCompleted: true
        }
      }
    ];
    const userDocs = await User.insertMany(users);
    const u1Id = userDocs[0]._id.toString();
    const u2Id = userDocs[1]._id.toString();
    console.log(`[Seed] ✓ Created ${users.length} users`);

    // Seed Articles (8-12 articles with realistic data)
    const articles = [
      {
        title: 'India\'s Economic Growth Hits 8%',
        excerpt: 'India\'s economy reaches 8% GDP growth, driven by strong manufacturing and digital initiatives.',
        content: 'India\'s economy has shown remarkable growth, reaching an 8% GDP growth rate. This achievement reflects strong manufacturing output, robust services sector, and increased foreign investment. The government\'s infrastructure push and digital initiatives have played a crucial role in this economic expansion.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Business',
        categories: ['Business', 'Economy'],
        publishedAt: '2025-10-01T08:00:00Z',
        tags: ['India', 'Economy', 'Growth'],
        readTime: 3,
        visibility: 'public'
      },
      {
        title: 'Tech Innovation in Bangalore',
        excerpt: 'Bangalore leads tech innovation with 500+ new startups, driven by world-class talent and strong VC presence.',
        content: 'Bangalore continues to lead in tech innovation, with over 500 new startups launched this year. The city\'s ecosystem benefits from world-class engineering talent, supportive government policies, and strong venture capital presence. Key sectors include AI, fintech, and enterprise software.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Tech',
        categories: ['Tech', 'Innovation'],
        publishedAt: '2025-10-02T09:30:00Z',
        tags: ['Tech', 'Innovation', 'Bangalore'],
        readTime: 4,
        visibility: 'public'
      },
      {
        title: 'Sustainable Development Goals Progress',
        excerpt: 'India makes significant progress on SDGs with 40% year-over-year growth in solar capacity.',
        content: 'India\'s progress on SDGs shows significant improvement in renewable energy adoption, with solar capacity increasing by 40% year-over-year. The country is on track to meet its 2030 targets for clean energy and water conservation initiatives.',
        authorId: u2Id,
        authorName: 'Hemant Sharma',
        category: 'Lifestyle',
        categories: ['Lifestyle', 'Sustainability'],
        publishedAt: '2025-10-03T10:15:00Z',
        tags: ['Sustainability', 'Development'],
        readTime: 3,
        visibility: 'public'
      },
      {
        title: 'Startup Ecosystem Expansion',
        excerpt: 'India\'s startup ecosystem expands with unicorns emerging across fintech, edtech, and healthtech sectors.',
        content: 'India\'s startup ecosystem continues to expand, with unicorns emerging across fintech, edtech, and healthtech sectors. Government initiatives like Startup India and Make in India have created a favorable environment for entrepreneurship and innovation.',
        authorId: u2Id,
        authorName: 'Hemant Sharma',
        category: 'Business',
        categories: ['Business', 'Startups'],
        publishedAt: '2025-10-04T11:00:00Z',
        tags: ['Startups', 'Business', 'India'],
        readTime: 4,
        visibility: 'public'
      },
      {
        title: 'Digital Payment Revolution',
        excerpt: 'UPI transactions cross 10 billion monthly, making India a global leader in digital payments.',
        content: 'UPI transactions have crossed 10 billion monthly transactions, making India a global leader in digital payments. The seamless integration of banking, e-commerce, and government services has transformed how Indians transact.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Finance',
        categories: ['Finance', 'Technology'],
        publishedAt: '2025-10-05T12:00:00Z',
        tags: ['Finance', 'Innovation', 'India'],
        readTime: 3,
        visibility: 'public'
      },
      {
        title: 'AI Research Breakthroughs',
        excerpt: 'Indian research institutions publish groundbreaking AI papers, accelerating innovation in NLP and computer vision.',
        content: 'Indian research institutions have published groundbreaking papers in AI and machine learning. Collaborations between IITs and global tech companies are accelerating innovation in natural language processing and computer vision.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Tech',
        categories: ['Tech', 'AI'],
        publishedAt: '2025-10-06T13:30:00Z',
        tags: ['Tech', 'Innovation', 'AI'],
        readTime: 4,
        visibility: 'public'
      },
      {
        title: 'Sustainable Fashion Movement',
        excerpt: 'Indian fashion brands lead the sustainable fashion movement with organic materials and ethical practices.',
        content: 'Indian fashion brands are leading the sustainable fashion movement, using organic materials and ethical production practices. Consumer awareness about environmental impact is driving demand for eco-friendly clothing options.',
        authorId: u2Id,
        authorName: 'Hemant Sharma',
        category: 'Design',
        categories: ['Design', 'Lifestyle'],
        publishedAt: '2025-10-07T14:00:00Z',
        tags: ['Design', 'Sustainability', 'Lifestyle'],
        readTime: 3,
        visibility: 'public'
      },
      {
        title: 'Healthcare Innovation Hub',
        excerpt: 'India becomes a global healthcare innovation hub with telemedicine platforms serving millions of patients.',
        content: 'India is becoming a global healthcare innovation hub, with telemedicine platforms serving millions of patients. The integration of AI in diagnostics and personalized medicine is transforming healthcare delivery across the country.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Tech',
        categories: ['Tech', 'Healthcare'],
        publishedAt: '2025-10-08T15:00:00Z',
        tags: ['Tech', 'Innovation', 'Development'],
        readTime: 4,
        visibility: 'public'
      },
      {
        title: 'Green Energy Transition',
        excerpt: 'India\'s commitment to green energy evident in ambitious renewable targets and large-scale wind/solar projects.',
        content: 'India\'s commitment to green energy is evident in its ambitious renewable energy targets. Wind and solar projects are being deployed at scale, creating jobs and reducing carbon emissions while meeting growing energy demand.',
        authorId: u2Id,
        authorName: 'Hemant Sharma',
        category: 'Lifestyle',
        categories: ['Lifestyle', 'Sustainability'],
        publishedAt: '2025-10-09T16:00:00Z',
        tags: ['Sustainability', 'Development', 'Economy'],
        readTime: 3,
        visibility: 'public'
      },
      {
        title: 'Fintech Innovation Wave',
        excerpt: 'Indian fintech companies revolutionize financial services with innovative lending, insurance, and wealth solutions.',
        content: 'Indian fintech companies are revolutionizing financial services with innovative solutions for lending, insurance, and wealth management. Regulatory support and digital infrastructure have enabled rapid growth in this sector.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Finance',
        categories: ['Finance', 'Technology'],
        publishedAt: '2025-10-10T17:00:00Z',
        tags: ['Finance', 'Innovation', 'Startups'],
        readTime: 3,
        visibility: 'public'
      },
      {
        title: 'Smart City Initiatives',
        excerpt: 'Smart city projects improve urban living through IoT sensors, data analytics, and citizen engagement platforms.',
        content: 'Smart city projects across India are improving urban living through IoT sensors, data analytics, and citizen engagement platforms. These initiatives are making cities more efficient, sustainable, and livable.',
        authorId: u2Id,
        authorName: 'Hemant Sharma',
        category: 'Design',
        categories: ['Design', 'Technology'],
        publishedAt: '2025-10-11T18:00:00Z',
        tags: ['Design', 'Innovation', 'Development'],
        readTime: 4,
        visibility: 'public'
      },
      {
        title: 'Space Technology Achievements',
        excerpt: 'India\'s space program achieves milestones with successful satellite launches and interplanetary missions.',
        content: 'India\'s space program continues to achieve milestones with successful satellite launches and interplanetary missions. The cost-effective approach and technological innovations have positioned India as a key player in global space exploration.',
        authorId: u1Id,
        authorName: 'Akash Solanki',
        category: 'Tech',
        categories: ['Tech', 'Science'],
        publishedAt: '2025-10-12T19:00:00Z',
        tags: ['Tech', 'Innovation', 'India'],
        readTime: 3,
        visibility: 'public'
      }
    ];
    const articleDocs = await Article.insertMany(articles);
    const article1Id = articleDocs[0]._id.toString();
    const article4Id = articleDocs[3]._id.toString();
    console.log(`[Seed] ✓ Created ${articles.length} articles`);

    // Seed Collections
    const collections = [
      {
        name: 'General Bookmarks',
        description: 'Auto-saved bookmarks.',
        creatorId: u1Id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        followersCount: 0,
        entries: [],
        type: 'private' as const
      },
      {
        name: 'The India Growth Story',
        description: 'A curated list of nuggets tracking India\'s economic rise.',
        creatorId: u1Id,
        createdAt: '2025-10-01T10:00:00Z',
        updatedAt: '2025-10-02T11:30:00Z',
        followersCount: 15420,
        entries: [
          { articleId: article1Id, addedByUserId: u1Id, addedAt: '2025-10-01T10:00:00Z', flaggedBy: [] },
          { articleId: article4Id, addedByUserId: u2Id, addedAt: '2025-10-02T11:30:00Z', flaggedBy: [] }
        ],
        type: 'public' as const
      }
    ];
    await Collection.insertMany(collections);
    console.log(`[Seed] ✓ Created ${collections.length} collections`);

    // Seed Legal Pages
    const legalPages = [
      { 
        id: 'about', 
        title: 'About Us', 
        slug: 'about', 
        isEnabled: true, 
        content: '# About Us\nWe are Nuggets.', 
        lastUpdated: new Date().toISOString() 
      },
      { 
        id: 'terms', 
        title: 'Terms', 
        slug: 'terms', 
        isEnabled: true, 
        content: '# Terms\nBe nice.', 
        lastUpdated: new Date().toISOString() 
      },
      { 
        id: 'privacy', 
        title: 'Privacy', 
        slug: 'privacy', 
        isEnabled: true, 
        content: '# Privacy\nWe respect it.', 
        lastUpdated: new Date().toISOString() 
      }
    ];
    await LegalPage.insertMany(legalPages);
    console.log(`[Seed] ✓ Created ${legalPages.length} legal pages`);

    // Seed Feedback
    const feedbacks = [
      {
        content: 'Dark mode flickers on iOS Safari. The transition between light and dark mode is not smooth.',
        type: 'bug' as const,
        status: 'new' as const,
        user: {
          id: u2Id,
          name: 'Hemant Sharma',
          username: 'hemant',
          avatar: undefined
        },
        email: undefined
      },
      {
        content: 'It would be great to have keyboard shortcuts for common actions like creating a new nugget.',
        type: 'feature' as const,
        status: 'new' as const,
        user: {
          id: u1Id,
          name: 'Akash Solanki',
          username: 'akash',
          avatar: undefined
        },
        email: undefined
      },
      {
        content: 'Love the new collection feature! Keep up the great work.',
        type: 'general' as const,
        status: 'read' as const,
        user: undefined,
        email: 'anonymous@example.com'
      },
      {
        content: 'The search functionality could be improved. Sometimes it doesn\'t find articles I know exist.',
        type: 'bug' as const,
        status: 'new' as const,
        user: undefined,
        email: 'user@example.com'
      }
    ];
    await Feedback.insertMany(feedbacks);
    console.log(`[Seed] ✓ Created ${feedbacks.length} feedback entries`);

    // Seed Reports
    const reports = [
      {
        targetId: article1Id,
        targetType: 'nugget' as const,
        reason: 'spam' as const,
        description: 'This article contains promotional content and appears to be spam.',
        reporter: {
          id: u2Id,
          name: 'Hemant Sharma'
        },
        respondent: {
          id: u1Id,
          name: 'Akash Solanki'
        },
        status: 'open' as const
      },
      {
        targetId: u1Id,
        targetType: 'user' as const,
        reason: 'harassment' as const,
        description: 'User has been sending inappropriate messages.',
        reporter: {
          id: u2Id,
          name: 'Hemant Sharma'
        },
        respondent: {
          id: u1Id,
          name: 'Akash Solanki'
        },
        status: 'open' as const
      },
      {
        targetId: article4Id,
        targetType: 'nugget' as const,
        reason: 'misinformation' as const,
        description: 'The information in this article is factually incorrect.',
        reporter: {
          id: u1Id,
          name: 'Akash Solanki'
        },
        respondent: {
          id: u2Id,
          name: 'Hemant Sharma'
        },
        status: 'resolved' as const
      }
    ];
    await Report.insertMany(reports);
    console.log(`[Seed] ✓ Created ${reports.length} reports`);

    console.log('[Seed] ✓ Database seeded successfully');
  } catch (error: any) {
    console.error('[Seed] Error seeding database:', error);
    // Don't throw - allow server to continue even if seeding fails
  }
}












