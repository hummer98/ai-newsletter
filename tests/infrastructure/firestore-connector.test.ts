import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreConnector } from '../../src/infrastructure/firestore-connector.js';
import type { Theme, Subscriber } from '../../src/types/index.js';

// Mock Firestore
vi.mock('@google-cloud/firestore', () => {
  return {
    Firestore: vi.fn()
  };
});

describe('FirestoreConnector', () => {
  let connector: FirestoreConnector;
  let mockFirestore: {
    collection: ReturnType<typeof vi.fn>;
  };
  let mockCollection: ReturnType<typeof vi.fn>;
  let mockDoc: ReturnType<typeof vi.fn>;
  let mockSubcollection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock structure
    mockSubcollection = vi.fn();
    mockDoc = vi.fn();
    mockCollection = vi.fn();

    mockFirestore = {
      collection: mockCollection
    };
  });

  describe('getThemes', () => {
    it('should return all themes from Firestore', async () => {
      const mockThemes = [
        { id: 'theme-1', data: () => ({ prompt: 'Tech news prompt' }) },
        { id: 'theme-2', data: () => ({ prompt: 'Sports news prompt' }) }
      ];

      mockCollection.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: mockThemes
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const themes = await connector.getThemes();

      expect(themes).toHaveLength(2);
      expect(themes[0]).toEqual({ id: 'theme-1', prompt: 'Tech news prompt' });
      expect(themes[1]).toEqual({ id: 'theme-2', prompt: 'Sports news prompt' });
      expect(mockCollection).toHaveBeenCalledWith('themes');
    });

    it('should return empty array when no themes exist', async () => {
      mockCollection.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: []
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const themes = await connector.getThemes();

      expect(themes).toHaveLength(0);
    });

    it('should throw error when Firestore connection fails', async () => {
      mockCollection.mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('Connection failed'))
      });

      connector = new FirestoreConnector(mockFirestore as never);

      await expect(connector.getThemes()).rejects.toThrow('Failed to fetch themes: Connection failed');
    });

    it('should skip themes without prompt field', async () => {
      const mockThemes = [
        { id: 'theme-1', data: () => ({ prompt: 'Valid prompt' }) },
        { id: 'theme-2', data: () => ({}) }, // No prompt
        { id: 'theme-3', data: () => ({ prompt: '' }) } // Empty prompt
      ];

      mockCollection.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: mockThemes
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const themes = await connector.getThemes();

      expect(themes).toHaveLength(1);
      expect(themes[0].id).toBe('theme-1');
    });
  });

  describe('getThemeById', () => {
    it('should return theme by ID', async () => {
      const mockDocSnapshot = {
        exists: true,
        id: 'theme-1',
        data: () => ({ prompt: 'Tech news prompt' })
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockDocSnapshot)
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const theme = await connector.getThemeById('theme-1');

      expect(theme).toEqual({ id: 'theme-1', prompt: 'Tech news prompt' });
    });

    it('should return null when theme does not exist', async () => {
      const mockDocSnapshot = {
        exists: false,
        id: 'nonexistent',
        data: () => null
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockDocSnapshot)
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const theme = await connector.getThemeById('nonexistent');

      expect(theme).toBeNull();
    });

    it('should return null when theme has no prompt', async () => {
      const mockDocSnapshot = {
        exists: true,
        id: 'theme-1',
        data: () => ({})
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockDocSnapshot)
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const theme = await connector.getThemeById('theme-1');

      expect(theme).toBeNull();
    });

    it('should throw error when Firestore query fails', async () => {
      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockRejectedValue(new Error('Query failed'))
        })
      });

      connector = new FirestoreConnector(mockFirestore as never);

      await expect(connector.getThemeById('theme-1')).rejects.toThrow('Failed to fetch theme theme-1: Query failed');
    });
  });

  describe('getSubscribers', () => {
    it('should return all subscribers for a theme', async () => {
      const mockSubscribers = [
        { id: 'sub-1', data: () => ({ mailto: 'user1@example.com' }) },
        { id: 'sub-2', data: () => ({ mailto: 'user2@example.com' }) }
      ];

      const mockDocRef = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: mockSubscribers
          })
        })
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef)
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const subscribers = await connector.getSubscribers('theme-1');

      expect(subscribers).toHaveLength(2);
      expect(subscribers[0]).toEqual({ mailto: 'user1@example.com' });
      expect(subscribers[1]).toEqual({ mailto: 'user2@example.com' });
      expect(mockDocRef.collection).toHaveBeenCalledWith('mailto');
    });

    it('should return empty array when no subscribers exist', async () => {
      const mockDocRef = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: []
          })
        })
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef)
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const subscribers = await connector.getSubscribers('theme-1');

      expect(subscribers).toHaveLength(0);
    });

    it('should skip subscribers with invalid email format', async () => {
      const mockSubscribers = [
        { id: 'sub-1', data: () => ({ mailto: 'valid@example.com' }) },
        { id: 'sub-2', data: () => ({ mailto: 'invalid-email' }) },
        { id: 'sub-3', data: () => ({ mailto: '' }) },
        { id: 'sub-4', data: () => ({}) } // No mailto field
      ];

      const mockDocRef = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: mockSubscribers
          })
        })
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef)
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const subscribers = await connector.getSubscribers('theme-1');

      expect(subscribers).toHaveLength(1);
      expect(subscribers[0].mailto).toBe('valid@example.com');
    });

    it('should throw error when Firestore query fails', async () => {
      const mockDocRef = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockRejectedValue(new Error('Subcollection query failed'))
        })
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef)
      });

      connector = new FirestoreConnector(mockFirestore as never);

      await expect(connector.getSubscribers('theme-1')).rejects.toThrow(
        'Failed to fetch subscribers for theme theme-1: Subcollection query failed'
      );
    });
  });

  describe('email validation', () => {
    it('should validate proper email formats', async () => {
      const mockSubscribers = [
        { id: '1', data: () => ({ mailto: 'test@example.com' }) },
        { id: '2', data: () => ({ mailto: 'user.name+tag@domain.co.jp' }) },
        { id: '3', data: () => ({ mailto: 'user@subdomain.example.org' }) }
      ];

      const mockDocRef = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: mockSubscribers
          })
        })
      };

      mockCollection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef)
      });

      connector = new FirestoreConnector(mockFirestore as never);
      const subscribers = await connector.getSubscribers('theme-1');

      expect(subscribers).toHaveLength(3);
    });
  });
});
