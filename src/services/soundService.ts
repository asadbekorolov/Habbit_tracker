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
          // Use document.createElement('audio') instead of new Audio()
          // to avoid "Illegal constructor" in restricted WebViews.
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
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        case 'streak_levelup':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.1);
          osc.frequency.setValueAtTime(783.99, now + 0.2);
          osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.4);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'tab_click':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.linearRampToValueAtTime(100, now + 0.05);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        case 'button_tap':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.linearRampToValueAtTime(300, now + 0.03);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
          osc.start(now);
          osc.stop(now + 0.03);
          break;
      }
    } catch (e) {
      console.warn('Synthetic playback failed:', e);
      this.playViaAudioTag(type);
    }
  }

  public async play(type: SoundType) {
    if (!this.soundEnabled) return;

    try {
      await this.initAudioContext();
      this.playSynthetic(type);

      switch (type) {
        case 'task_complete':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'streak_levelup':
          await Haptics.notification({ type: 'success' as any });
          break;
        case 'tab_click':
        case 'button_tap':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
      }
    } catch (e) {
      console.error('Audio/Haptic playback failed:', e);
    }
  }
}

export const soundService = new SoundService();
