// Player uu tien AVPlay (Tizen 3-4), fallback <video> native.
// AVPlay la cach on dinh nhat de phat HLS tren TV Samsung doi cu.

type Avplay = {
  open: (url: string) => void;
  close: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  prepareAsync: (ok: () => void, fail?: () => void) => void;
  setDisplayRect: (x: number, y: number, w: number, h: number) => void;
  setListener: (l: Record<string, (...a: unknown[]) => void>) => void;
};

export type PlayEvents = {
  onError: (msg: string) => void;
  onPlaying: () => void;
};

function getAvplay(): Avplay | null {
  try {
    const w = window as unknown as { webapis?: { avplay?: Avplay } };
    return w.webapis && w.webapis.avplay ? w.webapis.avplay : null;
  } catch {
    return null;
  }
}

export class TvPlayer {
  private video: HTMLVideoElement | null;
  private useAvplay = false;
  private events: PlayEvents = { onError: () => {}, onPlaying: () => {} };

  constructor(videoEl: HTMLVideoElement | null) {
    this.video = videoEl;
    if (this.video) {
      this.video.addEventListener('error', () => this.events.onError('Video error'));
      this.video.addEventListener('playing', () => this.events.onPlaying());
    }
  }

  on(ev: PlayEvents): void {
    this.events = ev;
  }

  play(url: string): void {
    this.stop();
    const av = getAvplay();
    if (av) {
      try {
        this.useAvplay = true;
        av.open(url);
        av.setDisplayRect(0, 0, 1920, 1080);
        av.setListener({
          onbufferingstart: () => {},
          onbufferingcomplete: () => this.events.onPlaying(),
          onerror: () => {
            this.useAvplay = false;
            this.playNative(url);
          },
        });
        av.prepareAsync(
          () => av.play(),
          () => {
            this.useAvplay = false;
            this.playNative(url);
          },
        );
        return;
      } catch {
        this.useAvplay = false;
      }
    }
    this.playNative(url);
  }

  private playNative(url: string): void {
    if (!this.video) {
      this.events.onError('No video element');
      return;
    }
    this.video.src = url;
    const r = this.video.play();
    if (r && typeof (r as Promise<void>).catch === 'function') {
      (r as Promise<void>).catch(() => this.events.onError('Play failed'));
    }
  }

  pauseToggle(): void {
    const av = this.useAvplay ? getAvplay() : null;
    if (av) {
      try {
        av.pause();
        return;
      } catch {
        // roi xuong video
      }
    }
    if (!this.video) return;
    if (this.video.paused) {
      this.video.play().catch(() => {});
    } else {
      this.video.pause();
    }
  }

  stop(): void {
    const av = getAvplay();
    if (this.useAvplay && av) {
      try {
        av.stop();
        av.close();
      } catch {
        // bo qua
      }
    }
    this.useAvplay = false;
    if (this.video) {
      try {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      } catch {
        // bo qua
      }
    }
  }
}
