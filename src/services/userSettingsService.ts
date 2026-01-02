
import { ProfileFormData, UserPreferences } from '../types/settings';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class UserSettingsService {
  async updateProfile(userId: string, data: ProfileFormData): Promise<void> {
    await delay(1000);
    console.log(`[Mock] Updated profile for ${userId}:`, data);
    // In a real app, verify username uniqueness here
  }

  async updateAccountInfo(userId: string, data: { email: string }): Promise<void> {
    await delay(1000);
    console.log(`[Mock] Updated account info for ${userId}:`, data);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await delay(800);
    console.log(`[Mock] Verification email sent to ${email}`);
  }

  async updatePassword(userId: string, current: string, next: string): Promise<void> {
    await delay(1500);
    if (current === 'wrong') throw new Error("Incorrect current password");
    console.log(`[Mock] Password updated for ${userId}`);
  }

  async updatePreferences(userId: string, prefs: UserPreferences): Promise<void> {
    await delay(600);
    console.log(`[Mock] Preferences updated for ${userId}:`, prefs);
  }

  async deleteAccount(userId: string): Promise<void> {
    await delay(2000);
    console.log(`[Mock] Account ${userId} deleted`);
  }
}

export const userSettingsService = new UserSettingsService();
