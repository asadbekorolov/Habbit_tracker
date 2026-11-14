import { Haptics, ImpactStyle } from '@capacitor/haptics';

type SoundType = 'task_complete' | 'streak_levelup' | 'tab_click' | 'button_tap';

class SoundService {
  private soundEnabled: boolean = true;
  private audioContext: any = null;
  private audioCache: Record<string, any> = {};

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem('sound_enabled');
      this.soundEnabled = stored === null ? true : stored === 'true';
    } catch {
      this.soundEnabled = true;
    }
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('sound_enabled', String(enabled));
    } catch {}
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  private async initAudioContext() {
    if (this.audioContext) return;
    try {
      const win = window as any;
      const AudioContextClass = win['AudioContext'] || win['webkitAudioContext'];

      if (typeof AudioContextClass === 'function') {
        try {
          this.audioContext = new AudioContextClass();
        } catch (innerErr) {
          console.warn('Failed to instantiate AudioContext:', innerErr);
          this.audioContext = null;
        }
      }
    } catch (e) {
      console.warn('AudioContext class lookup failed:', e);
      this.audioContext = null;
    }
  }

  private playViaAudioTag(type: string) {
    try {
      const win = window as any;
      if (typeof win === 'undefined' || typeof document === 'undefined') return;

      let audio = this.audioCache[type];
      if (!audio) {
        try {
          audio = document.createElement('audio');
          audio.src = `/sounds/${type}.mp3`;
          this.audioCache[type] = audio;
        } catch (innerErr) {
          return;
        }
      }

      if (audio && typeof audio.play === 'function') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.warn('HTMLAudio playback failed:', e);
    }
  }

  private playSynthetic(type: SoundType) {
    if (!this.audioContext || typeof this.audioContext.createOscillator !== 'function') {
      this.playViaAudioTag(type);
      return;
    }

    try {
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case 'task_complete':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        case 'streak_levelup':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.1);
          osc.frequency.setValueAtTime(783.99, now + 0.2);
          osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.35);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        case 'tab_click':
        case 'button_tap':
          // Keep minor UI clicks silent to reduce noise and save battery
          break;
      }
    } catch (e) {
      console.warn('Synthetic playback failed:', e);
      if (type === 'task_complete' || type === 'streak_levelup') {
        this.playViaAudioTag(type);
      }
    }
  }

  public async play(type: SoundType) {
    if (!this.soundEnabled) return;

    // Do not play audio or haptics for generic tab/button clicks
    if (type === 'tab_click' || type === 'button_tap') {
      return;
    }

    try {
      await this.initAudioContext();
      this.playSynthetic(type);

      switch (type) {
        case 'task_complete':
          try {
            await Haptics.impact({ style: ImpactStyle.Light });
          } catch {}
          break;
        case 'streak_levelup':
          try {
            await Haptics.notification({ type: 'success' as any });
          } catch {}
          break;
      }
    } catch (e) {
      console.error('Audio/Haptic playback failed:', e);
    }
  }
}

export const soundService = new SoundService();
