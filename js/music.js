import { sound } from './audio.js';

const NOTE_INDEX = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
};

function noteToFreq(note) {
    const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
    if (!match) return 440;
    const [, pitch, octStr] = match;
    const midi = (parseInt(octStr, 10) + 1) * 12 + NOTE_INDEX[pitch];
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Multi-voice medieval-fantasy Web Audio soundtrack engine.
 * Combines RuneScape-inspired modal lute & horn melodies with
 * World of Warcraft-style orchestral strings, timpani, and cathedral reverb.
 */
class MusicController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.dryBus = null;
        this.wetBus = null;
        this.reverbNode = null;
        this.analyser = null;
        this.freqData = null;

        this.enabled = true;
        this.volume = 0.65;
        this.currentTrack = 'title';
        this.isPlaying = false;
        this.awaitingGesture = false;

        this.stepIndex = 0;
        this.nextNoteTime = 0;
        this.schedulerTimer = null;
        this.listeners = new Set();

        this.tracks = {
            title: this.buildTitleScore(),
            crypt: this.buildCryptScore()
        };
    }

    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyChange() {
        const snapshot = {
            enabled: this.enabled,
            isPlaying: this.isPlaying,
            awaitingGesture: this.awaitingGesture,
            track: this.currentTrack,
            trackTitle: this.currentTrack === 'title' ? 'Gates of Phusza' : 'Echoes of the Crypt',
            volume: this.volume
        };
        this.listeners.forEach((cb) => cb(snapshot));
    }

    ensureGraph() {
        const ctx = sound.init();
        if (!ctx) return null;
        if (this.ctx === ctx && this.masterGain) return ctx;

        this.ctx = ctx;

        // Dynamics protection against layered brass + pads clipping
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, ctx.currentTime);
        compressor.knee.setValueAtTime(18, ctx.currentTime);
        compressor.ratio.setValueAtTime(4, ctx.currentTime);
        compressor.attack.setValueAtTime(0.01, ctx.currentTime);
        compressor.release.setValueAtTime(0.2, ctx.currentTime);

        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? this.volume * 0.72 : 0.0001, ctx.currentTime);

        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

        this.dryBus = ctx.createGain();
        this.dryBus.gain.setValueAtTime(0.85, ctx.currentTime);

        this.wetBus = ctx.createGain();
        this.wetBus.gain.setValueAtTime(0.45, ctx.currentTime);

        this.reverbNode = ctx.createConvolver();
        this.reverbNode.buffer = this.createCathedralImpulse(ctx, 2.4);

        this.dryBus.connect(compressor);
        this.wetBus.connect(this.reverbNode);
        this.reverbNode.connect(compressor);
        compressor.connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(ctx.destination);

        return ctx;
    }

    /** Synthesizes a warm dark stone hall impulse response with high-frequency damping. */
    createCathedralImpulse(ctx, durationSec) {
        const rate = ctx.sampleRate;
        const length = Math.floor(rate * durationSec);
        const impulse = ctx.createBuffer(2, length, rate);

        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            let lp = 0;
            for (let i = 0; i < length; i++) {
                const t = i / length;
                const env = Math.pow(1 - t, 2.6);
                const white = Math.random() * 2 - 1;
                // Gentle single-pole low-pass so hall tail feels like stone, not hiss
                lp = lp * 0.72 + white * 0.28;
                data[i] = lp * env;
            }
        }
        return impulse;
    }

    async tryStart(trackName = this.currentTrack) {
        this.currentTrack = trackName;
        const ctx = this.ensureGraph();
        if (!ctx) {
            this.awaitingGesture = true;
            this.notifyChange();
            return false;
        }

        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch {
                // Autoplay blocked until user gesture
            }
        }

        if (ctx.state !== 'running') {
            this.awaitingGesture = true;
            this.isPlaying = false;
            this.notifyChange();
            return false;
        }

        this.awaitingGesture = false;
        if (this.enabled && !this.isPlaying) {
            this.startLoop();
        } else {
            this.notifyChange();
        }
        return true;
    }

    async playTrack(trackName, { reset = true } = {}) {
        const changed = this.currentTrack !== trackName;
        this.currentTrack = trackName;
        const ok = await this.tryStart(trackName);
        if (!ok || !this.enabled) {
            this.notifyChange();
            return false;
        }
        if (changed || reset) {
            this.stepIndex = 0;
            this.nextNoteTime = this.ctx.currentTime + 0.06;
            if (!this.isPlaying) {
                this.startLoop();
            } else {
                this.notifyChange();
            }
        }
        return true;
    }

    startLoop() {
        if (!this.ctx || this.isPlaying) return;
        this.isPlaying = true;
        this.awaitingGesture = false;

        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
        this.masterGain.gain.linearRampToValueAtTime(this.enabled ? this.volume * 0.72 : 0.0001, now + 0.35);

        this.nextNoteTime = now + 0.06;
        this.schedulerTimer = setInterval(() => this.schedulerTick(), 50);
        this.notifyChange();
    }

    stopLoop({ fadeOutSec = 0.3 } = {}) {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        this.isPlaying = false;
        if (this.ctx && this.masterGain) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
            this.masterGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutSec);
        }
        this.notifyChange();
    }

    async toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            const ok = await this.tryStart(this.currentTrack);
            if (ok && !this.isPlaying) {
                this.startLoop();
            } else if (ok && this.masterGain) {
                const now = this.ctx.currentTime;
                this.masterGain.gain.cancelScheduledValues(now);
                this.masterGain.gain.linearRampToValueAtTime(this.volume * 0.72, now + 0.25);
            }
        } else {
            this.stopLoop({ fadeOutSec: 0.25 });
        }
        this.notifyChange();
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, Number(val)));
        if (this.ctx && this.masterGain && this.enabled) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.setTargetAtTime(this.volume * 0.72, now, 0.05);
        }
        this.notifyChange();
    }

    /** Returns normalized 0..1 frequency band values for UI equalizer bars. */
    getSpectrumBars(count = 10) {
        if (!this.analyser || !this.freqData || !this.isPlaying || !this.enabled) {
            return new Array(count).fill(0);
        }
        this.analyser.getByteFrequencyData(this.freqData);
        const bars = [];
        const usableBins = Math.min(this.freqData.length, 20);
        for (let i = 0; i < count; i++) {
            const bin = Math.floor((i / count) * usableBins);
            bars.push(this.freqData[bin] / 255);
        }
        return bars;
    }

    schedulerTick() {
        if (!this.ctx || !this.isPlaying || !this.enabled) return;

        // Guard against catching up in a burst after browser tab throttling
        if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
            this.nextNoteTime = this.ctx.currentTime + 0.06;
        }

        const score = this.tracks[this.currentTrack] || this.tracks.title;
        const stepDur = 60 / score.bpm / 4; // 16th-note resolution

        while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
            this.scheduleStep(score, this.stepIndex, this.nextNoteTime, stepDur);
            this.nextNoteTime += stepDur;
            this.stepIndex = (this.stepIndex + 1) % score.totalSteps;
        }
    }

    scheduleStep(score, step, time, stepDur) {
        const events = score.eventsByStep.get(step);
        if (!events) return;

        for (const ev of events) {
            const dur = (ev.steps || 4) * stepDur;
            switch (ev.inst) {
                case 'pad':
                    this.playPad(ev.notes, time, dur, ev.gain ?? 0.12);
                    break;
                case 'lute':
                    this.playLute(ev.note, time, dur, ev.gain ?? 0.16);
                    break;
                case 'horn':
                    this.playHorn(ev.note, time, dur, ev.gain ?? 0.19, ev.octave);
                    break;
                case 'bell':
                    this.playCrystalBell(ev.note, time, dur, ev.gain ?? 0.11);
                    break;
                case 'drum':
                    this.playTimpani(ev.note || 'D2', time, ev.gain ?? 0.28);
                    break;
            }
        }
    }

    /* ============================================================== */
    /* ORCHESTRAL / MEDIEVAL SYNTHESIS VOICES                         */
    /* ============================================================== */

    playPad(notes, time, dur, gainVal) {
        const ctx = this.ctx;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, time);
        filter.frequency.linearRampToValueAtTime(1050, time + Math.min(0.8, dur * 0.45));
        filter.frequency.linearRampToValueAtTime(620, time + dur);
        filter.Q.setValueAtTime(0.6, time);

        const env = ctx.createGain();
        const atk = Math.min(0.65, dur * 0.3);
        const rel = Math.min(0.9, dur * 0.35);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(gainVal / Math.max(1, notes.length * 0.7), time + atk);
        env.gain.setValueAtTime(gainVal / Math.max(1, notes.length * 0.7), Math.max(time + atk, time + dur - rel));
        env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.25);

        filter.connect(env);
        env.connect(this.dryBus);
        env.connect(this.wetBus);

        notes.forEach((n) => {
            const freq = noteToFreq(n);
            [-6, 6].forEach((detune, idx) => {
                const osc = ctx.createOscillator();
                osc.type = idx === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.setValueAtTime(freq, time);
                osc.detune.setValueAtTime(detune, time);
                osc.connect(filter);
                osc.start(time);
                osc.stop(time + dur + 0.3);
            });
        });
    }

    playLute(note, time, dur, gainVal) {
        const ctx = this.ctx;
        const freq = noteToFreq(note);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, time);
        filter.frequency.exponentialRampToValueAtTime(420, time + Math.min(0.45, dur + 0.18));
        filter.Q.setValueAtTime(1.4, time);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(gainVal, time + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.32, dur + 0.2));

        const osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, time);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, time);
        osc2.detune.setValueAtTime(4, time);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.32, time);

        osc1.connect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);

        filter.connect(env);
        env.connect(this.dryBus);
        env.connect(this.wetBus);

        osc1.start(time);
        osc2.start(time);
        const stopAt = time + Math.max(0.38, dur + 0.25);
        osc1.stop(stopAt);
        osc2.stop(stopAt);
    }

    playHorn(note, time, dur, gainVal, withOctave = false) {
        const ctx = this.ctx;
        const freq = noteToFreq(note);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(1.1, time);
        filter.frequency.setValueAtTime(340, time);
        filter.frequency.linearRampToValueAtTime(1750, time + Math.min(0.14, dur * 0.25));
        filter.frequency.exponentialRampToValueAtTime(980, time + dur);

        const env = ctx.createGain();
        const atk = Math.min(0.085, dur * 0.18);
        const rel = Math.min(0.24, dur * 0.25);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(gainVal, time + atk);
        env.gain.setValueAtTime(gainVal * 0.88, Math.max(time + atk, time + dur - rel));
        env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.12);

        // Gentle vibrato after the initial brass attack
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(5.2, time);
        lfoGain.gain.setValueAtTime(0, time);
        lfoGain.gain.linearRampToValueAtTime(3.2, time + Math.min(0.35, dur * 0.6));
        lfo.connect(lfoGain);

        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);
        osc1.detune.setValueAtTime(-5, time);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, time);
        osc2.detune.setValueAtTime(5, time);

        const sub = ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(freq * 0.5, time);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.34, time);

        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        osc1.connect(filter);
        osc2.connect(filter);
        sub.connect(subGain);
        subGain.connect(filter);

        const stopAt = time + dur + 0.16;

        if (withOctave) {
            const high = ctx.createOscillator();
            high.type = 'sawtooth';
            high.frequency.setValueAtTime(freq * 2, time);
            const highGain = ctx.createGain();
            highGain.gain.setValueAtTime(0.28, time);
            high.connect(highGain);
            highGain.connect(filter);
            high.start(time);
            high.stop(stopAt);
        }

        filter.connect(env);
        env.connect(this.dryBus);
        env.connect(this.wetBus);

        lfo.start(time);
        osc1.start(time);
        osc2.start(time);
        sub.start(time);

        lfo.stop(stopAt);
        osc1.stop(stopAt);
        osc2.stop(stopAt);
        sub.stop(stopAt);
    }

    playCrystalBell(note, time, dur, gainVal) {
        const ctx = this.ctx;
        const freq = noteToFreq(note);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(gainVal, time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.9, dur + 0.6));

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const harmonic = ctx.createOscillator();
        harmonic.type = 'sine';
        harmonic.frequency.setValueAtTime(freq * 2.0, time);
        const harmGain = ctx.createGain();
        harmGain.gain.setValueAtTime(0.25, time);

        osc.connect(env);
        harmonic.connect(harmGain);
        harmGain.connect(env);

        env.connect(this.dryBus);
        env.connect(this.wetBus);

        const stopAt = time + Math.max(1.0, dur + 0.7);
        osc.start(time);
        harmonic.start(time);
        osc.stop(stopAt);
        harmonic.stop(stopAt);
    }

    playTimpani(note, time, gainVal) {
        const ctx = this.ctx;
        const freq = noteToFreq(note);

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.55, time);
        osc.frequency.exponentialRampToValueAtTime(freq, time + 0.11);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(gainVal, time + 0.015);
        env.gain.exponentialRampToValueAtTime(0.0001, time + 0.65);

        osc.connect(env);
        env.connect(this.dryBus);

        osc.start(time);
        osc.stop(time + 0.7);
    }

    /* ============================================================== */
    /* COMPOSITIONS                                                   */
    /* ============================================================== */

    /**
     * "Gates of Phusza" — 24-bar orchestral medieval theme (92 BPM, D Minor / Dorian).
     * 16 steps = 1 bar of 4/4 time.
     */
    buildTitleScore() {
        const bars = 24;
        const totalSteps = bars * 16;
        const eventsByStep = new Map();

        const add = (step, event) => {
            const s = ((step % totalSteps) + totalSteps) % totalSteps;
            if (!eventsByStep.has(s)) eventsByStep.set(s, []);
            eventsByStep.get(s).push(event);
        };

        const addArpBar = (bar, notes, gain = 0.13) => {
            const base = bar * 16;
            notes.forEach((n, idx) => {
                if (n) add(base + idx * 2, { inst: 'lute', note: n, steps: 3, gain });
            });
        };

        const addMelody = (bar, offsetStep, note, steps, gain = 0.18, octave = false) => {
            add(bar * 16 + offsetStep, { inst: 'horn', note, steps, gain, octave });
        };

        // --- SECTION 1 (Bars 0-3): Mysterious Runic Awakening ---
        add(0 * 16, { inst: 'pad', notes: ['D3', 'A3', 'F4'], steps: 32, gain: 0.12 });
        add(2 * 16, { inst: 'pad', notes: ['Bb2', 'F3', 'D4'], steps: 16, gain: 0.12 });
        add(3 * 16, { inst: 'pad', notes: ['A2', 'E3', 'C#4'], steps: 16, gain: 0.12 });

        addArpBar(0, ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'], 0.13);
        addArpBar(1, ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'], 0.13);
        addArpBar(2, ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'], 0.13);
        addArpBar(3, ['A2', 'E3', 'A3', 'D4', 'E4', 'C#4', 'A3', 'E3'], 0.13);

        // Sparkling Phusza crystal chimes
        add(0 * 16 + 0, { inst: 'bell', note: 'A5', steps: 8, gain: 0.10 });
        add(1 * 16 + 8, { inst: 'bell', note: 'G5', steps: 8, gain: 0.09 });
        add(2 * 16 + 0, { inst: 'bell', note: 'F5', steps: 8, gain: 0.10 });
        add(3 * 16 + 8, { inst: 'bell', note: 'E5', steps: 8, gain: 0.11 });

        // Soft intro drum heartbeat on bars 2-3
        add(2 * 16, { inst: 'drum', note: 'Bb1', gain: 0.22 });
        add(3 * 16, { inst: 'drum', note: 'A1', gain: 0.24 });
        add(3 * 16 + 12, { inst: 'drum', note: 'A1', gain: 0.18 });

        // --- SECTION 2 (Bars 4-11): Noble RuneScape-inspired Horn Theme ---
        const sec2Chords = [
            ['D3', 'A3', 'F4'],
            ['C3', 'G3', 'E4'],
            ['Bb2', 'F3', 'D4'],
            ['A2', 'E3', 'C#4'],
            ['D3', 'A3', 'F4'],
            ['F3', 'C4', 'A4'],
            ['G2', 'D3', 'Bb3'],
            ['A2', 'E3', 'C#4']
        ];
        const sec2Arps = [
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'],
            ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
            ['A2', 'E3', 'A3', 'C#4', 'E4', 'C#4', 'A3', 'E3'],
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['F3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C4'],
            ['G2', 'D3', 'G3', 'Bb3', 'D4', 'Bb3', 'G3', 'D3'],
            ['A2', 'E3', 'A3', 'D4', 'C#4', 'E4', 'A4', 'E4']
        ];
        const sec2Drums = ['D2', 'C2', 'Bb1', 'A1', 'D2', 'F2', 'G2', 'A1'];

        sec2Chords.forEach((ch, idx) => {
            const bar = 4 + idx;
            add(bar * 16, { inst: 'pad', notes: ch, steps: 16, gain: 0.14 });
            addArpBar(bar, sec2Arps[idx], 0.14);
            add(bar * 16, { inst: 'drum', note: sec2Drums[idx], gain: 0.26 });
            add(bar * 16 + 8, { inst: 'drum', note: sec2Drums[idx], gain: 0.17 });
        });

        // Lyrical French Horn melody (Bars 4-11)
        addMelody(4, 0, 'D4', 6, 0.19);
        addMelody(4, 6, 'E4', 2, 0.17);
        addMelody(4, 8, 'F4', 4, 0.19);
        addMelody(4, 12, 'A4', 4, 0.20);

        addMelody(5, 0, 'G4', 8, 0.19);
        addMelody(5, 8, 'E4', 4, 0.17);
        addMelody(5, 12, 'C4', 4, 0.17);

        addMelody(6, 0, 'D4', 4, 0.18);
        addMelody(6, 4, 'F4', 4, 0.19);
        addMelody(6, 8, 'Bb4', 6, 0.21);
        addMelody(6, 14, 'A4', 2, 0.18);

        addMelody(7, 0, 'E4', 8, 0.19);
        addMelody(7, 8, 'C#4', 4, 0.18);
        addMelody(7, 12, 'E4', 4, 0.19);

        addMelody(8, 0, 'F4', 6, 0.20);
        addMelody(8, 6, 'G4', 2, 0.18);
        addMelody(8, 8, 'A4', 4, 0.20);
        addMelody(8, 12, 'D5', 4, 0.22);

        addMelody(9, 0, 'C5', 8, 0.21);
        addMelody(9, 8, 'A4', 4, 0.19);
        addMelody(9, 12, 'F4', 4, 0.18);

        addMelody(10, 0, 'G4', 4, 0.19);
        addMelody(10, 4, 'A4', 4, 0.19);
        addMelody(10, 8, 'Bb4', 4, 0.20);
        addMelody(10, 12, 'G4', 4, 0.18);

        addMelody(11, 0, 'A4', 14, 0.21);
        add(11 * 16 + 4, { inst: 'bell', note: 'E5', steps: 4, gain: 0.10 });
        add(11 * 16 + 8, { inst: 'bell', note: 'A5', steps: 6, gain: 0.11 });
        add(11 * 16 + 12, { inst: 'drum', note: 'A1', gain: 0.20 });
        add(11 * 16 + 14, { inst: 'drum', note: 'A1', gain: 0.23 });

        // --- SECTION 3 (Bars 12-19): WoW-style Climactic Heroic Brass Chorus ---
        const sec3Chords = [
            ['D3', 'A3', 'F4'],
            ['Bb2', 'F3', 'D4'],
            ['C3', 'G3', 'E4'],
            ['D3', 'A3', 'F4'],
            ['Bb2', 'F3', 'D4'],
            ['A2', 'F3', 'C4'],
            ['G2', 'D3', 'Bb3'],
            ['A2', 'E3', 'C#4']
        ];
        const sec3Arps = [
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
            ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'],
            ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
            ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
            ['A2', 'F3', 'C4', 'F4', 'A4', 'F4', 'C4', 'F3'],
            ['G2', 'D3', 'G3', 'Bb3', 'D4', 'Bb3', 'G3', 'D3'],
            ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4', 'C#5', 'E5']
        ];
        const sec3Drums = ['D2', 'Bb1', 'C2', 'D2', 'Bb1', 'A1', 'G1', 'A1'];

        sec3Chords.forEach((ch, idx) => {
            const bar = 12 + idx;
            add(bar * 16, { inst: 'pad', notes: ch, steps: 16, gain: 0.17 });
            addArpBar(bar, sec3Arps[idx], 0.15);
            // Driving epic timpani pattern
            add(bar * 16 + 0, { inst: 'drum', note: sec3Drums[idx], gain: 0.30 });
            add(bar * 16 + 6, { inst: 'drum', note: sec3Drums[idx], gain: 0.19 });
            add(bar * 16 + 8, { inst: 'drum', note: sec3Drums[idx], gain: 0.26 });
            add(bar * 16 + 12, { inst: 'drum', note: sec3Drums[idx], gain: 0.21 });
        });

        // Octave brass chorus melody
        addMelody(12, 0, 'D5', 8, 0.21, true);
        addMelody(12, 8, 'A4', 4, 0.19, false);
        addMelody(12, 12, 'D5', 4, 0.21, true);

        addMelody(13, 0, 'F5', 6, 0.22, false);
        addMelody(13, 6, 'E5', 2, 0.19, false);
        addMelody(13, 8, 'D5', 4, 0.21, true);
        addMelody(13, 12, 'Bb4', 4, 0.19, false);

        addMelody(14, 0, 'C5', 8, 0.21, true);
        addMelody(14, 8, 'G4', 4, 0.18, false);
        addMelody(14, 12, 'C5', 4, 0.20, true);

        addMelody(15, 0, 'D5', 12, 0.22, true);
        addMelody(15, 12, 'A4', 4, 0.19, false);
        add(15 * 16 + 8, { inst: 'bell', note: 'A5', steps: 6, gain: 0.11 });

        addMelody(16, 0, 'Bb4', 4, 0.20, false);
        addMelody(16, 4, 'D5', 4, 0.21, true);
        addMelody(16, 8, 'F5', 8, 0.22, false);

        addMelody(17, 0, 'C5', 6, 0.21, true);
        addMelody(17, 6, 'D5', 2, 0.19, false);
        addMelody(17, 8, 'C5', 4, 0.20, true);
        addMelody(17, 12, 'A4', 4, 0.19, false);

        addMelody(18, 0, 'G4', 4, 0.19, false);
        addMelody(18, 4, 'Bb4', 4, 0.20, false);
        addMelody(18, 8, 'D5', 4, 0.21, true);
        addMelody(18, 12, 'Bb4', 4, 0.19, false);

        addMelody(19, 0, 'A4', 15, 0.22, true);
        // Dramatic timpani roll into resolving bridge
        add(19 * 16 + 10, { inst: 'drum', note: 'A1', gain: 0.18 });
        add(19 * 16 + 12, { inst: 'drum', note: 'A1', gain: 0.22 });
        add(19 * 16 + 14, { inst: 'drum', note: 'A1', gain: 0.27 });
        add(19 * 16 + 8, { inst: 'bell', note: 'E5', steps: 4, gain: 0.11 });
        add(19 * 16 + 12, { inst: 'bell', note: 'A5', steps: 6, gain: 0.12 });

        // --- SECTION 4 (Bars 20-23): Gentle Resolution & Loop Bridge ---
        add(20 * 16, { inst: 'pad', notes: ['D3', 'A3', 'F4'], steps: 16, gain: 0.15 });
        add(21 * 16, { inst: 'pad', notes: ['C3', 'G3', 'E4'], steps: 16, gain: 0.13 });
        add(22 * 16, { inst: 'pad', notes: ['Bb2', 'F3', 'D4'], steps: 16, gain: 0.12 });
        add(23 * 16, { inst: 'pad', notes: ['A2', 'E3', 'D4'], steps: 16, gain: 0.11 });

        addArpBar(20, ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'], 0.13);
        addArpBar(21, ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'], 0.12);
        addArpBar(22, ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'], 0.11);
        addArpBar(23, ['A2', 'E3', 'A3', 'D4', 'E4', null, null, null], 0.10);

        addMelody(20, 0, 'D5', 8, 0.20);
        addMelody(20, 8, 'C5', 8, 0.18);
        addMelody(21, 0, 'Bb4', 8, 0.17);
        addMelody(21, 8, 'A4', 8, 0.16);
        addMelody(22, 0, 'F4', 12, 0.15);
        add(22 * 16 + 0, { inst: 'bell', note: 'D5', steps: 8, gain: 0.10 });
        add(23 * 16 + 0, { inst: 'bell', note: 'A4', steps: 10, gain: 0.09 });
        add(20 * 16, { inst: 'drum', note: 'D2', gain: 0.26 });

        return { bpm: 92, totalSteps, eventsByStep };
    }

    /**
     * "Echoes of the Crypt" — Atmospheric dungeon exploration underscore (72 BPM).
     */
    buildCryptScore() {
        const bars = 8;
        const totalSteps = bars * 16;
        const eventsByStep = new Map();

        const add = (step, event) => {
            const s = ((step % totalSteps) + totalSteps) % totalSteps;
            if (!eventsByStep.has(s)) eventsByStep.set(s, []);
            eventsByStep.get(s).push(event);
        };

        add(0 * 16, { inst: 'pad', notes: ['D2', 'A2', 'F3'], steps: 32, gain: 0.11 });
        add(2 * 16, { inst: 'pad', notes: ['C2', 'G2', 'Eb3'], steps: 32, gain: 0.10 });
        add(4 * 16, { inst: 'pad', notes: ['Bb1', 'F2', 'D3'], steps: 32, gain: 0.11 });
        add(6 * 16, { inst: 'pad', notes: ['A1', 'E2', 'C#3'], steps: 32, gain: 0.10 });

        // Sparse cavern harp & crystal echoes
        add(0 * 16 + 2, { inst: 'lute', note: 'D3', steps: 6, gain: 0.10 });
        add(0 * 16 + 8, { inst: 'lute', note: 'A3', steps: 6, gain: 0.09 });
        add(1 * 16 + 4, { inst: 'bell', note: 'F5', steps: 10, gain: 0.07 });

        add(2 * 16 + 0, { inst: 'drum', note: 'D2', gain: 0.16 });
        add(2 * 16 + 6, { inst: 'lute', note: 'G3', steps: 6, gain: 0.09 });
        add(3 * 16 + 8, { inst: 'bell', note: 'Eb5', steps: 10, gain: 0.07 });

        add(4 * 16 + 0, { inst: 'lute', note: 'F3', steps: 6, gain: 0.10 });
        add(4 * 16 + 10, { inst: 'lute', note: 'D4', steps: 6, gain: 0.09 });
        add(5 * 16 + 6, { inst: 'bell', note: 'A4', steps: 10, gain: 0.08 });

        add(6 * 16 + 0, { inst: 'drum', note: 'A1', gain: 0.16 });
        add(6 * 16 + 8, { inst: 'lute', note: 'E3', steps: 6, gain: 0.09 });
        add(7 * 16 + 4, { inst: 'bell', note: 'C#5', steps: 10, gain: 0.07 });

        return { bpm: 72, totalSteps, eventsByStep };
    }
}

export const music = new MusicController();
