// Retro 8-Bit Web Audio Synthesizer
class SoundController {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'square', duration = 0.1, gainVal = 0.15) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playSelect() {
        this.playTone(520, 'square', 0.08, 0.12);
    }

    playStep() {
        this.playTone(160 + Math.random() * 40, 'triangle', 0.04, 0.06);
    }

    playRaceSwitch() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playClassEquip(className) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        if (className === 'warrior') {
            // Metallic clash
            [440, 660, 880].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq + idx * 80, now + idx * 0.04);

                gain.gain.setValueAtTime(0.18, now + idx * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.04);
                osc.stop(now + idx * 0.04 + 0.16);
            });
        } else {
            // Magical shimmer
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.06);

                gain.gain.setValueAtTime(0.18, now + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.06);
                osc.stop(now + idx * 0.06 + 0.25);
            });
        }
    }

    playFanfare() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const notes = [
            { f: 440, d: 0.1 },
            { f: 554.37, d: 0.1 },
            { f: 659.25, d: 0.12 },
            { f: 880, d: 0.35 }
        ];
        let delay = 0;
        notes.forEach(n => {
            setTimeout(() => {
                this.playTone(n.f, 'square', n.d, 0.2);
            }, delay * 1000);
            delay += n.d * 0.85;
        });
    }

    playDiceRoll() {
        if (!this.enabled) return;
        this.init();
        // Rapid clattering rolls
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                this.playTone(320 + Math.random() * 280, 'triangle', 0.04, 0.12);
            }, i * 50);
        }
    }

    playDiceLand(isCrit = false) {
        if (!this.enabled) return;
        if (isCrit) {
            this.playFanfare();
        } else {
            this.playTone(587.33, 'square', 0.15, 0.2);
        }
    }

    playSuccess() {
        if (!this.enabled) return;
        this.init();
        const chord = [523.25, 659.25, 783.99, 1046.50];
        chord.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.18, 0.18);
            }, idx * 70);
        });
    }

    playFailure() {
        if (!this.enabled) return;
        this.init();
        const drop = [320, 260, 200, 140];
        drop.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'sawtooth', 0.15, 0.15);
            }, idx * 80);
        });
    }

    playChestOpen() {
        if (!this.enabled) return;
        this.init();
        [440, 554, 659, 880, 1108].forEach((f, i) => {
            setTimeout(() => {
                this.playTone(f, 'sine', 0.12, 0.15);
            }, i * 60);
        });
    }

    playHit() {
        this.playTone(120, 'sawtooth', 0.12, 0.25);
    }

    playRandomize() {
        if (!this.enabled) return;
        this.init();
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                this.playTone(250 + Math.random() * 400, 'triangle', 0.06, 0.12);
            }, i * 40);
        }
    }
}

export const sound = new SoundController();
