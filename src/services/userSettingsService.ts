
import { ProfileFormData, UserPreferences } from '../types/settings';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class UserSettingsService {
  async updateProfile(_userId: string, _data: ProfileFormData): Promise<void> {
    await delay(1000);
    // In a real app, verify username uniqueness here
  }

  async updateAccountInfo(_userId: string, _data: { email: string }): Promise<void> {
    await delay(1000);
  }

  async resendVerificationEmail(_email: string): Promise<void> {
    await delay(800);
  }

  async updatePassword(_userId: string, current: string, _next: string): Promise<void> {
    await delay(1500);
    if (current === 'wrong') throw new Error("Incorrect current password");
  }

  async updatePreferences(_userId: string, _prefs: UserPreferences): Promise<void> {
    await delay(600);
  }

  async deleteAccount(_userId: string): Promise<void> {
    await delay(2000);
  }
}

export const userSettingsService = new UserSettingsService();
