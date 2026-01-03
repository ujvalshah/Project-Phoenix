
import { ProfileFormData, UserPreferences } from '../types/settings';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class UserSettingsService {
  async updateProfile(userId: string, data: ProfileFormData): Promise<void> {
    await delay(1000);
    // In a real app, verify username uniqueness here
  }

  async updateAccountInfo(userId: string, data: { email: string }): Promise<void> {
    await delay(1000);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await delay(800);
  }

  async updatePassword(userId: string, current: string, next: string): Promise<void> {
    await delay(1500);
    if (current === 'wrong') throw new Error("Incorrect current password");
  }

  async updatePreferences(userId: string, prefs: UserPreferences): Promise<void> {
    await delay(600);
  }

  async deleteAccount(userId: string): Promise<void> {
    await delay(2000);
  }
}

export const userSettingsService = new UserSettingsService();
