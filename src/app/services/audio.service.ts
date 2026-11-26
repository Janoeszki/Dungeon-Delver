import { Injectable, computed, signal } from '@angular/core';
import { sound } from '../../../js/audio.js';
import { music } from '../../../js/music.js';

interface AudioToggleable {
    enabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class AudioService {
    readonly sound = sound as typeof sound & AudioToggleable;
    readonly music = music as typeof music & AudioToggleable;

    readonly musicEnabled = signal<boolean>(Boolean((music as unknown as AudioToggleable).enabled));
    readonly musicPlaying = signal<boolean>(Boolean(music.isPlaying));
    readonly awaitingGesture = signal<boolean>(Boolean(music.awaitingGesture));
    readonly trackTitle = signal<string>(
        music.currentTrack === 'title' ? 'Gates of Phusza' : 'Echoes of the Crypt'
    );
    readonly musicVolume = signal<number>(Math.round((Number(music.volume) || 0.65) * 100));
    readonly sfxEnabled = signal<boolean>(Boolean((sound as unknown as AudioToggleable).enabled));

    readonly headerMusicLabel = computed(() =>
        this.musicEnabled() ? '🎵 MUSIC: ON' : '🔇 MUSIC: OFF'
    );
    readonly headerSfxLabel = computed(() =>
        this.sfxEnabled() ? '🔊 SFX: ON' : '🔇 SFX: OFF'
    );
    readonly startSfxLabel = computed(() =>
        this.sfxEnabled() ? '🔊 SFX' : '🔇 SFX'
    );

    readonly startMusicButtonLabel = computed(() => {
        if (!this.musicEnabled()) return '🔇 MUTED';
        if (this.awaitingGesture() || !this.musicPlaying()) return '🎵 PLAY';
        return '⏸ PAUSE';
    });

    readonly needsAwaken = computed(() =>
        this.musicEnabled() && (this.awaitingGesture() || !this.musicPlaying())
    );

    readonly musicStatusText = computed(() => {
        if (!this.musicEnabled()) return 'Music Off';
        if (this.awaitingGesture() || !this.musicPlaying()) return 'Theme Ready';
        return 'Now Playing';
    });

    readonly audioPromptText = computed(() => {
        if (!this.musicEnabled()) {
            return '🔇 Music Muted • Press M or click PLAY to hear "Gates of Phusza"';
        }
        if (this.awaitingGesture() || !this.musicPlaying()) {
            return '✨ Click anywhere to play the "Gates of Phusza" theme';
        }
        return '♪ Now Playing: "Gates of Phusza" • Click the Runic Arch logo for a chime';
    });

    private gestureInitialized = false;

    constructor() {
        music.onChange((state: {
            enabled: boolean;
            isPlaying: boolean;
            awaitingGesture: boolean;
            trackTitle: string;
            volume: number;
        }) => {
            this.musicEnabled.set(Boolean(state.enabled));
            this.musicPlaying.set(Boolean(state.isPlaying));
            this.awaitingGesture.set(Boolean(state.awaitingGesture));
            this.trackTitle.set(state.trackTitle || 'Gates of Phusza');
            if (typeof state.volume === 'number') {
                this.musicVolume.set(Math.round(state.volume * 100));
            }
            this.sfxEnabled.set(Boolean(this.sound.enabled));
        });
    }

    initAutoplay(): void {
        if (this.gestureInitialized) return;
        this.gestureInitialized = true;

        music.tryStart('title');

        if (typeof window === 'undefined') return;
        const awakenEvents = [
            'pointerdown',
            'mousedown',
            'keydown',
            'touchstart',
            'pointermove',
            'mousemove',
            'wheel',
            'focus'
        ];

        const awakenAudioOnGesture = (e: Event) => {
            const target = e?.target as HTMLElement | null;
            if (
                target &&
                typeof target.closest === 'function' &&
                target.closest('#btnStartMusicToggle, #btnMusicToggle, #btnStartSfxToggle, #btnSoundToggle')
            ) {
                return;
            }
            if (this.music.enabled && (music.awaitingGesture || !music.isPlaying)) {
                music.tryStart(music.currentTrack).then((started: boolean) => {
                    if (started) {
                        awakenEvents.forEach((ev) =>
                            window.removeEventListener(ev, awakenAudioOnGesture, true)
                        );
                    }
                });
            }
        };

        awakenEvents.forEach((ev) => {
            window.addEventListener(ev, awakenAudioOnGesture, { capture: true, passive: true });
        });
    }

    async toggleMusic(): Promise<void> {
        if (music.awaitingGesture && this.music.enabled) {
            await music.playTrack(music.currentTrack, { reset: false });
            return;
        }
        await music.toggle();
    }

    toggleSfx(): void {
        this.sound.enabled = !this.sound.enabled;
        this.sfxEnabled.set(Boolean(this.sound.enabled));
        if (this.sound.enabled) {
            sound.playSelect();
        }
    }

    setVolume(percent: number): void {
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        this.musicVolume.set(clamped);
        music.setVolume(clamped / 100);
    }

    async awakenFromPrompt(): Promise<void> {
        if (!this.music.enabled) {
            await music.toggle();
        } else {
            await music.playTrack(music.currentTrack, { reset: false });
        }
    }

    playTrack(track: 'title' | 'crypt', opts: { reset?: boolean } = {}): void {
        music.playTrack(track, opts);
    }

    getSpectrumBars(count: number): number[] {
        return music.getSpectrumBars(count);
    }
}
