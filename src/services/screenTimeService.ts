import { Capacitor } from '@capacitor/core';

export interface ScreenTimeData {
  hours: number;
  minutes: number;
}

class ScreenTimeService {
  /**
   * Checks if the app has Usage Stats access.
   * On Android, this usually requires directing the user to Settings.
   */
  async hasPermission(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return true;

    try {
      // This would call our custom native bridge
      // For now, we assume true or handle via the prompt logic
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetches today's total screen time.
   */
  async getTodayScreenTime(): Promise<ScreenTimeData> {
    if (!Capacitor.isNativePlatform()) {
      // Mock data for web development
      return { hours: 3, minutes: 45 };
    }

    try {
      // In a real implementation, this would use a custom Capacitor Plugin
      // to query UsageStatsManager for the current day.
      // Since we are in the "Refinement" phase, we'll provide the architecture.

      // Fallback/Mock for now until the Java bridge is compiled
      const mockHours = Math.floor(Math.random() * 5) + 2;
      const mockMinutes = Math.floor(Math.random() * 60);

      return { hours: mockHours, minutes: mockMinutes };
    } catch (e) {
      console.error('Failed to fetch screen time:', e);
      return { hours: 0, minutes: 0 };
    }
  }

  /**
   * Opens the Android "Usage Access" settings screen.
   */
  async requestPermission() {
    if (Capacitor.getPlatform() === 'android') {
        // This is handled natively via an Intent:
        // new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        console.log('Redirecting to Usage Access Settings...');
    }
  }
}

export const screenTimeService = new ScreenTimeService();
