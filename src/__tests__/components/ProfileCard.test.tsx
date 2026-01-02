/**
 * Test Suite: ProfileCard Component
 * 
 * Tests profile card rendering, avatar fallback, and conditional field display
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { User } from '@/types';

// Mock dependencies
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/services/storageService', () => ({
  storageService: {
    updateUser: vi.fn(),
  },
}));

vi.mock('@/admin/services/adminConfigService', () => ({
  adminConfigService: {
    getFeatureFlags: vi.fn().mockResolvedValue({ enableAvatarUpload: true }),
  },
}));

vi.mock('@/hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({
    upload: vi.fn(),
    error: null,
  }),
}));

vi.mock('@/constants/layout', () => ({
  LAYOUT_CLASSES: {
    STICKY_BELOW_HEADER: 'sticky-top',
  },
}));

// Helper to create mock user
const createMockUser = (overrides: Partial<User> = {}): User => {
  const baseUser: User = {
    id: 'user-1',
    role: 'user',
    auth: {
      email: 'test@example.com',
      emailVerified: true,
      provider: 'email',
      createdAt: '2024-01-15T00:00:00Z',
    },
    profile: {
      displayName: 'John Doe',
      username: 'johndoe',
      bio: 'Test bio',
      avatarUrl: undefined,
      avatarColor: 'blue',
      location: 'San Francisco, CA',
      website: 'https://johndoe.com',
      twitter: 'johndoe',
      linkedin: 'johndoe',
      title: undefined,
      company: undefined,
    },
    security: {
      mfaEnabled: false,
    },
    preferences: {
      theme: 'system',
      defaultVisibility: 'public',
      interestedCategories: [],
      compactMode: false,
      richMediaPreviews: true,
      autoFollowCollections: true,
      notifications: {
        emailDigest: true,
        productUpdates: false,
        newFollowers: true,
      },
    },
    appState: {
      onboardingCompleted: true,
    },
  };

  return {
    ...baseUser,
    ...overrides,
    profile: {
      ...baseUser.profile,
      ...(overrides.profile || {}),
    },
  };
};

describe('ProfileCard Component', () => {
  const defaultProps = {
    isOwner: true,
    nuggetCount: 43,
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Name and Display Handle', () => {
    it('should display fullName as primary heading', () => {
      const user = createMockUser({
        profile: {
          displayName: 'Jane Smith',
          username: 'janesmith',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Jane Smith');
    });

    it('should display handle below name in @username format', () => {
      const user = createMockUser({
        profile: {
          displayName: 'John Doe',
          username: 'johndoe',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('@johndoe')).toBeInTheDocument();
    });

    it('should gracefully omit handle line when username is missing', () => {
      const user = createMockUser({
        profile: {
          displayName: 'John Doe',
          username: '',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });
  });

  describe('Avatar Rendering', () => {
    it('should display profile image when avatarUrl exists', () => {
      const user = createMockUser({
        profile: {
          displayName: 'John Doe',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      const avatarImage = screen.getByAltText('John Doe');
      expect(avatarImage).toBeInTheDocument();
      expect(avatarImage).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should generate initials avatar when no profile image exists', () => {
      const user = createMockUser({
        profile: {
          displayName: 'Sarah Parker',
          avatarUrl: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Should show initials "SP" (first letter of first word + first letter of last word)
      const avatarContainer = screen.getByText('SP').closest('.rounded-full');
      expect(avatarContainer).toBeInTheDocument();
    });

    it('should generate correct initials for single word name', () => {
      const user = createMockUser({
        profile: {
          displayName: 'Madonna',
          avatarUrl: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Single word should show first letter only
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('should generate correct initials for multi-word name', () => {
      const user = createMockUser({
        profile: {
          displayName: 'John Michael Smith',
          avatarUrl: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Should show "JS" (first letter of first word + first letter of last word)
      expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('should handle empty name gracefully', () => {
      const user = createMockUser({
        profile: {
          displayName: '',
          avatarUrl: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Should show fallback "??"
      expect(screen.getByText('??')).toBeInTheDocument();
    });
  });

  describe('Occupation / Headline Field', () => {
    it('should display occupation when both title and company are provided', () => {
      const user = createMockUser({
        profile: {
          title: 'Senior Product Designer',
          company: 'TechFlow Inc.',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('Senior Product Designer at TechFlow Inc.')).toBeInTheDocument();
    });

    it('should display only title when company is missing', () => {
      const user = createMockUser({
        profile: {
          title: 'Senior Product Designer',
          company: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('Senior Product Designer')).toBeInTheDocument();
      expect(screen.queryByText(/at/)).not.toBeInTheDocument();
    });

    it('should display only company when title is missing', () => {
      const user = createMockUser({
        profile: {
          title: undefined,
          company: 'TechFlow Inc.',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('TechFlow Inc.')).toBeInTheDocument();
      expect(screen.queryByText(/at/)).not.toBeInTheDocument();
    });

    it('should NOT render occupation section when both title and company are missing', () => {
      const user = createMockUser({
        profile: {
          title: undefined,
          company: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Should not show any occupation-related text
      expect(screen.queryByText(/Senior Product Designer/)).not.toBeInTheDocument();
      expect(screen.queryByText(/TechFlow/)).not.toBeInTheDocument();
      expect(screen.queryByText(/at/)).not.toBeInTheDocument();
    });

    it('should NOT render empty placeholder text for occupation', () => {
      const user = createMockUser({
        profile: {
          title: '',
          company: '',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Should not show empty strings or placeholders
      const occupationElements = screen.queryAllByText('');
      expect(occupationElements.every(el => !el.textContent?.trim())).toBe(true);
    });
  });

  describe('Additional Field Validation', () => {
    it('should conditionally render bio when provided', () => {
      const user = createMockUser({
        profile: {
          bio: 'Building minimalist interfaces for busy people.',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('Building minimalist interfaces for busy people.')).toBeInTheDocument();
    });

    it('should NOT render bio when not provided', () => {
      const user = createMockUser({
        profile: {
          bio: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Bio paragraph should not exist
      const bioParagraphs = screen.queryAllByText(/Building minimalist/);
      expect(bioParagraphs).toHaveLength(0);
    });

    it('should conditionally render location when provided', () => {
      const user = createMockUser({
        profile: {
          location: 'San Francisco, CA',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    it('should conditionally render join date from auth.createdAt', () => {
      const user = createMockUser({
        auth: {
          email: 'test@example.com',
          emailVerified: true,
          provider: 'email',
          createdAt: '2024-01-15T00:00:00Z',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText(/Joined/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 2024/)).toBeInTheDocument();
    });

    it('should conditionally render social links when provided', () => {
      const user = createMockUser({
        profile: {
          website: 'https://johndoe.com',
          twitter: 'johndoe',
          linkedin: 'johndoe',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      const websiteLink = screen.getByRole('link', { name: /website/i });
      const twitterLink = screen.getByRole('link', { name: /twitter/i });
      const linkedinLink = screen.getByRole('link', { name: /linkedin/i });

      expect(websiteLink).toHaveAttribute('href', 'https://johndoe.com');
      expect(twitterLink).toHaveAttribute('href', 'https://twitter.com/johndoe');
      expect(linkedinLink).toHaveAttribute('href', 'https://linkedin.com/in/johndoe');
    });

    it('should NOT render social links when not provided', () => {
      const user = createMockUser({
        profile: {
          website: undefined,
          twitter: undefined,
          linkedin: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Social icons should not be rendered
      const socialLinks = screen.queryAllByRole('link');
      expect(socialLinks).toHaveLength(0);
    });
  });

  describe('Data Verification', () => {
    it('should handle missing optional profile fields gracefully', () => {
      const user = createMockUser({
        profile: {
          bio: undefined,
          location: undefined,
          website: undefined,
          twitter: undefined,
          linkedin: undefined,
          title: undefined,
          company: undefined,
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      // Should still render name and handle
      expect(screen.getByText(user.profile.displayName)).toBeInTheDocument();
      expect(screen.getByText(`@${user.profile.username}`)).toBeInTheDocument();
    });

    it('should use correct User structure (profile.displayName, profile.username, profile.avatarUrl)', () => {
      const user = createMockUser({
        profile: {
          displayName: 'Test User',
          username: 'testuser',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });

      render(<ProfileCard user={user} {...defaultProps} />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
      expect(screen.getByAltText('Test User')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });
  });
});



