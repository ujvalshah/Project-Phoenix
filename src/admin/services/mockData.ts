import { AdminUser, AdminNugget, AdminCollection, AdminTag, AdminReport, AdminActivityEvent, AdminFeedback } from '../types/admin';

export const MOCK_ADMIN_USERS: AdminUser[] = Array.from({ length: 25 }).map((_, i) => {
  const totalNuggets = Math.floor(Math.random() * 50);
  const publicNuggets = Math.floor(totalNuggets * 0.7); // 70% public
  const firstName = ['Alice', 'Bob', 'Charlie', 'David', 'Eva', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'][i % 10];
  const lastName = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'][i % 10];
  
  return {
    id: `u-${1000 + i + 1}`,
    name: i === 0 ? 'Akash Solanki' : `${firstName} ${lastName}`,
    fullName: i === 0 ? 'Akash Solanki' : `${firstName} James ${lastName}`,
    username: i === 0 ? 'akash_ux' : `user_${i + 1}`,
    email: i === 0 ? 'akash@nuggets.app' : `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    role: i === 0 ? 'admin' : 'user',
    status: i % 7 === 0 ? 'suspended' : 'active',
    joinedAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    lastLoginAt: i % 3 === 0 ? new Date(Date.now() - Math.random() * 8640000000).toISOString() : new Date().toISOString(), // Some inactive
    stats: {
      nuggets: totalNuggets,
      nuggetsPublic: publicNuggets,
      nuggetsPrivate: totalNuggets - publicNuggets,
      collections: Math.floor(Math.random() * 8),
      collectionsFollowing: Math.floor(Math.random() * 15),
      reports: Math.floor(Math.random() * 2),
    }
  };
});

export const MOCK_ADMIN_NUGGETS: AdminNugget[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `n-${i + 1}`,
  title: [
    "The Future of SaaS", 
    "React 19 Features", 
    "Minimalist Design Principles", 
    "How to Scale Node.js", 
    "AI in 2025"
  ][i % 5] + ` (Part ${i + 1})`,
  excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  author: {
    id: `u-${(i % 5) + 1}`,
    name: `User ${(i % 5) + 1}`,
    email: `user${(i % 5) + 1}@example.com`,
  },
  type: ['link', 'text', 'video', 'image', 'idea'][i % 5] as any,
  url: 'https://example.com',
  visibility: i % 3 === 0 ? 'private' : 'public',
  status: i === 2 ? 'flagged' : 'active',
  createdAt: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
  reports: i === 2 ? 3 : 0,
  tags: ['Tech', 'Design']
}));

export const MOCK_ADMIN_COLLECTIONS: AdminCollection[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `c-${i + 1}`,
  name: ["Must Read Tech", "Design Systems", "My Favs", "Startup Ideas", "Daily News"][i % 5],
  description: "A curated list of the most important updates in the industry.",
  creator: {
    id: `u-${(i % 5) + 1}`,
    name: `User ${(i % 5) + 1}`,
  },
  type: i % 4 === 0 ? 'private' : 'public',
  itemCount: Math.floor(Math.random() * 100),
  followerCount: Math.floor(Math.random() * 500),
  status: 'active',
  createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  updatedAt: new Date().toISOString(),
}));

export const MOCK_ADMIN_TAGS: AdminTag[] = [
  { id: 't-1', name: 'Technology', usageCount: 1240, type: 'category', isOfficial: true, status: 'active' },
  { id: 't-2', name: 'Design', usageCount: 890, type: 'category', isOfficial: true, status: 'active' },
  { id: 't-3', name: 'Business', usageCount: 650, type: 'category', isOfficial: true, status: 'active' },
  { id: 't-4', name: 'productivity', usageCount: 120, type: 'tag', isOfficial: false, status: 'active' },
  { id: 't-5', name: 'ai-tools', usageCount: 85, type: 'tag', isOfficial: false, status: 'active' },
  { id: 't-6', name: 'Health', usageCount: 430, type: 'category', isOfficial: true, status: 'active' },
  { id: 't-7', name: 'startup-life', usageCount: 45, type: 'tag', isOfficial: false, status: 'active' },
  { id: 'new-1', name: 'India Growth', usageCount: 320, type: 'tag', isOfficial: false, status: 'active' },
  { id: 'req-1', name: 'Crypto', usageCount: 0, type: 'tag', isOfficial: false, status: 'pending', requestedBy: 'User 2' },
  { id: 'req-2', name: 'Sustainability', usageCount: 0, type: 'category', isOfficial: false, status: 'pending', requestedBy: 'User 3' },
];

export const MOCK_REPORTS: AdminReport[] = [
  {
    id: 'r-1',
    targetId: 'n-3',
    targetType: 'nugget',
    reason: 'spam',
    description: 'This is clearly just an advertisement for a crypto scam.',
    reporter: { id: 'u-5', name: 'User 5' },
    respondent: { id: 'u-3', name: 'User 3' },
    status: 'open',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 'r-2',
    targetId: 'u-4',
    targetType: 'user',
    reason: 'harassment',
    description: 'User is posting offensive comments on multiple collections.',
    reporter: { id: 'u-2', name: 'User 2' },
    respondent: { id: 'u-4', name: 'User 4' },
    status: 'open',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 'r-3',
    targetId: 'c-2',
    targetType: 'collection',
    reason: 'misinformation',
    description: 'Collection promotes dangerous health advice.',
    reporter: { id: 'u-8', name: 'User 8' },
    respondent: { id: 'u-1', name: 'Akash Solanki' },
    status: 'resolved',
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
  }
];

export const MOCK_FEEDBACK: AdminFeedback[] = [
  { 
    id: 'f-1', 
    user: { id: 'u-2', name: 'Bob Johnson', fullName: 'Bob James Johnson', username: 'bobby_j' },
    type: 'bug', 
    content: 'Dark mode flickers on iOS Safari.', 
    status: 'new', 
    createdAt: new Date(Date.now() - 3600000).toISOString() 
  },
  { 
    id: 'f-2', 
    user: { id: 'u-5', name: 'Eva Brown', fullName: 'Eva Brown', username: 'eva_b' },
    type: 'feature', 
    content: 'Please add folder support for collections!', 
    status: 'new', 
    createdAt: new Date(Date.now() - 7200000).toISOString() 
  },
  { 
    id: 'f-3', 
    type: 'general', 
    content: 'Love the app, but the font size is too small on mobile.', 
    status: 'read', 
    createdAt: new Date(Date.now() - 86400000).toISOString() 
  },
  { 
    id: 'f-4', 
    user: { id: 'u-10', name: 'Jack Taylor', fullName: 'Jack Taylor', username: 'jack_t' },
    type: 'bug', 
    content: 'Login with Google failing intermittently.', 
    status: 'archived', 
    createdAt: new Date(Date.now() - 172800000).toISOString() 
  },
];

export const MOCK_ACTIVITY_LOG: AdminActivityEvent[] = [
  { id: 'ev-1', actor: { id: 'u-1', name: 'Akash Solanki' }, action: 'suspended', target: 'u-bad', metadata: 'Spam activity detected', timestamp: new Date(Date.now() - 300000).toISOString(), type: 'danger' },
  { id: 'ev-2', actor: { id: 'u-1', name: 'Akash Solanki' }, action: 'approved tag', target: '#IndiaGrowth', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'success' },
  { id: 'ev-3', actor: { id: 'u-1', name: 'Akash Solanki' }, action: 'updated config', target: 'Feature Flags', metadata: 'Enabled beta search', timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'warning' },
  { id: 'ev-4', actor: { id: 'u-1', name: 'Akash Solanki' }, action: 'resolved report', target: 'r-3', timestamp: new Date(Date.now() - 172800000).toISOString(), type: 'info' },
  { id: 'ev-5', actor: { id: 'u-1', name: 'Akash Solanki' }, action: 'login', timestamp: new Date(Date.now() - 200000000).toISOString(), type: 'info' },
  { id: 'ev-6', actor: { id: 'u-admin-2', name: 'Sarah Admin' }, action: 'deleted nugget', target: 'n-291', metadata: 'Copyright violation', timestamp: new Date(Date.now() - 250000000).toISOString(), type: 'danger' },
];
