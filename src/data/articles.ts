import { Article } from '@/types';

export const ARTICLES: Article[] = [
  {
    id: '1',
    title: "SaaS is more than just a buzzword",
    excerpt: "Discover how software as a service is reshaping the global economy and enabling rapid scaling for small businesses.",
    content: "Software as a Service (SaaS) has fundamentally shifted how companies operate. Gone are the days of purchasing expensive licenses and managing on-premise servers.",
    author: { id: "u1", name: "Akash Solanki" },
    publishedAt: "2025-11-25T18:12:00",
    created_at: "2025-11-25T18:12:00",
    updated_at: "2025-11-25T18:12:00",
    categories: ["Finance", "Business"],
    tags: ["Business", "SaaS"],
    readTime: 5,
    engagement: { likes: 120, bookmarks: 45, shares: 12, views: 1500 },
    source_type: 'link',
    visibility: 'public',
    media: {
        type: "image",
        url: "https://picsum.photos/seed/tech/800/400",
        aspect_ratio: "16:9",
        previewMetadata: {
            url: "https://stripe.com",
            title: "Stripe | Financial Infrastructure",
            description: "Financial infrastructure for the internet.",
            imageUrl: "https://picsum.photos/seed/tech/800/400",
            providerName: "Stripe"
        }
    }
  },
  {
    id: '2',
    title: "The future of remote work",
    excerpt: "Exploring how distributed teams are becoming the new norm and what it means for productivity and company culture.",
    content: "Remote work has transformed from a temporary solution to a permanent fixture in the modern workplace.",
    author: { id: "u2", name: "Hemant Sharma" },
    publishedAt: "2025-11-24T14:30:00",
    created_at: "2025-11-24T14:30:00",
    updated_at: "2025-11-24T14:30:00",
    categories: ["Business", "Lifestyle"],
    tags: ["Remote Work", "Culture"],
    readTime: 4,
    engagement: { likes: 89, bookmarks: 32, shares: 8, views: 1200 },
    source_type: 'link',
    visibility: 'public'
  },
  {
    id: '3',
    title: "Climate tech investments surge",
    excerpt: "Venture capital is pouring into climate technology startups as the world races to meet carbon neutrality goals.",
    content: "The climate tech sector has seen unprecedented growth in funding over the past year.",
    author: { id: "u1", name: "Akash Solanki" },
    publishedAt: "2025-11-23T10:15:00",
    created_at: "2025-11-23T10:15:00",
    updated_at: "2025-11-23T10:15:00",
    categories: ["Environment", "Finance"],
    tags: ["Climate", "Investment"],
    readTime: 6,
    engagement: { likes: 156, bookmarks: 67, shares: 23, views: 2100 },
    source_type: 'link',
    visibility: 'public'
  },
  {
    id: '4',
    title: "India's economic growth trajectory",
    excerpt: "Analyzing the factors driving India's rapid economic expansion and its position in the global market.",
    content: "India has emerged as one of the fastest-growing major economies in the world.",
    author: { id: "u2", name: "Hemant Sharma" },
    publishedAt: "2025-11-22T16:45:00",
    created_at: "2025-11-22T16:45:00",
    updated_at: "2025-11-22T16:45:00",
    categories: ["Finance", "Growth"],
    tags: ["India", "Economy"],
    readTime: 7,
    engagement: { likes: 234, bookmarks: 98, shares: 45, views: 3400 },
    source_type: 'link',
    visibility: 'public'
  },
  {
    id: '5',
    title: "AI in healthcare: promise and challenges",
    excerpt: "How artificial intelligence is revolutionizing medical diagnosis while navigating ethical considerations.",
    content: "Artificial intelligence is making significant strides in healthcare, from diagnostic tools to treatment recommendations.",
    author: { id: "u1", name: "Akash Solanki" },
    publishedAt: "2025-11-21T09:20:00",
    created_at: "2025-11-21T09:20:00",
    updated_at: "2025-11-21T09:20:00",
    categories: ["Health", "Tech"],
    tags: ["AI", "Healthcare"],
    readTime: 5,
    engagement: { likes: 178, bookmarks: 54, shares: 19, views: 1800 },
    source_type: 'link',
    visibility: 'public'
  },
  {
    id: '6',
    title: "Design systems for scale",
    excerpt: "Building maintainable design systems that grow with your product and team.",
    content: "A well-designed system is crucial for maintaining consistency as products and teams scale.",
    author: { id: "u2", name: "Hemant Sharma" },
    publishedAt: "2025-11-20T13:10:00",
    created_at: "2025-11-20T13:10:00",
    updated_at: "2025-11-20T13:10:00",
    categories: ["Design", "Tech"],
    tags: ["Design Systems", "UX"],
    readTime: 4,
    engagement: { likes: 145, bookmarks: 43, shares: 15, views: 1600 },
    source_type: 'link',
    visibility: 'public'
  }
];


