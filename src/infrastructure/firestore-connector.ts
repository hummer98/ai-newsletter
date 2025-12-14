import { Firestore } from '@google-cloud/firestore';
import type { Theme, Subscriber } from '../types/index.js';

/**
 * Simple email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates if a string is a valid email format
 */
function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length > 0 && EMAIL_REGEX.test(email);
}

/**
 * Connector for Firestore database operations
 * Handles theme and subscriber data access
 */
export class FirestoreConnector {
  private firestore: Firestore;

  constructor(firestore?: Firestore) {
    this.firestore = firestore || new Firestore();
  }

  /**
   * Get all themes from Firestore
   * Only returns themes with valid prompt fields
   */
  async getThemes(): Promise<Theme[]> {
    try {
      const snapshot = await this.firestore.collection('themes').get();
      const themes: Theme[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const prompt = data.prompt;

        // Skip themes without valid prompt
        if (typeof prompt === 'string' && prompt.length > 0) {
          themes.push({
            id: doc.id,
            prompt: prompt
          });
        }
      }

      return themes;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch themes: ${message}`);
    }
  }

  /**
   * Get a single theme by ID
   * Returns null if theme doesn't exist or has no valid prompt
   */
  async getThemeById(themeId: string): Promise<Theme | null> {
    try {
      const doc = await this.firestore.collection('themes').doc(themeId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      const prompt = data?.prompt;

      // Return null if prompt is missing or empty
      if (typeof prompt !== 'string' || prompt.length === 0) {
        return null;
      }

      return {
        id: doc.id,
        prompt: prompt
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch theme ${themeId}: ${message}`);
    }
  }

  /**
   * Get all subscribers for a theme
   * Only returns subscribers with valid email addresses
   */
  async getSubscribers(themeId: string): Promise<Subscriber[]> {
    try {
      const snapshot = await this.firestore
        .collection('themes')
        .doc(themeId)
        .collection('mailto')
        .get();

      const subscribers: Subscriber[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const mailto = data.mailto;

        // Only include valid email addresses
        if (isValidEmail(mailto)) {
          subscribers.push({
            mailto: mailto
          });
        }
      }

      return subscribers;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch subscribers for theme ${themeId}: ${message}`);
    }
  }
}
