export interface PlayerEvents {
  play: () => void;
  pause: () => void;
  error: (error: Error) => void;
  ended: () => void;
  timeupdate: (time: number) => void;
  loadstart: () => void;
  canplay: () => void;
}

export class Player {
  private video: HTMLVideoElement;
  private listeners: Partial<PlayerEvents> = {};
  private retryCount = 0;
  private maxRetries = 3;
  private currentUrl = '';

  constructor(videoEl: HTMLVideoElement) {
    this.video = videoEl;
    this.setupEvents();
  }

  private setupEvents(): void {
    this.video.addEventListener('play', () => {
      this.retryCount = 0;
      this.listeners.play?.();
    });

    this.video.addEventListener('pause', () => {
      this.listeners.pause?.();
    });

    this.video.addEventListener('error', () => {
      const error = this.video.error;
      const msg = error ? `Code ${error.code}: ${error.message}` : 'Unknown error';
      this.listeners.error?.(new Error(msg));

      if (this.retryCount < this.maxRetries && this.currentUrl) {
        this.retryCount++;
        setTimeout(() => {
          this.video.src = this.currentUrl;
          this.video.play().catch(() => {});
        }, 2000);
      }
    });

    this.video.addEventListener('ended', () => {
      this.listeners.ended?.();
    });

    this.video.addEventListener('timeupdate', () => {
      this.listeners.timeupdate?.(this.video.currentTime);
    });

    this.video.addEventListener('loadstart', () => {
      this.listeners.loadstart?.();
    });

    this.video.addEventListener('canplay', () => {
      this.listeners.canplay?.();
    });
  }

  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): void {
    this.listeners[event] = callback;
  }

  async load(url: string): Promise<void> {
    this.currentUrl = url;
    this.retryCount = 0;
    this.video.src = url;
    try {
      await this.video.play();
    } catch {
      // Will retry via error handler
    }
  }

  play(): void {
    this.video.play().catch(() => {});
  }

  pause(): void {
    this.video.pause();
  }

  togglePlay(): void {
    if (this.video.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(delta: number): void {
    this.video.currentTime = Math.max(0, this.video.currentTime + delta);
  }

  setVolume(delta: number): void {
    this.video.volume = Math.max(0, Math.min(1, this.video.volume + delta));
  }

  get isPaused(): boolean {
    return this.video.paused;
  }

  get currentTime(): number {
    return this.video.currentTime;
  }

  get duration(): number {
    return this.video.duration;
  }
}
