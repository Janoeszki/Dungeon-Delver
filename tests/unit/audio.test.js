import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sound, SoundController } from '../../js/audio.js';
import { music, MusicController } from '../../js/music.js';

function createMockAudioParam(initialValue = 0) {
    const events = [];
    const param = {
        value: initialValue,
        events,
        setValueAtTime(value, startTime) {
            if (!Number.isFinite(value) || !Number.isFinite(startTime)) {
                throw new TypeError(`Non-finite AudioParam setValueAtTime(${value}, ${startTime})`);
            }
            param.value = value;
            events.push({ op: 'setValueAtTime', value, time: startTime });
        },
        linearRampToValueAtTime(value, endTime) {
            if (!Number.isFinite(value) || !Number.isFinite(endTime)) {
                throw new TypeError(`Non-finite AudioParam linearRampToValueAtTime(${value}, ${endTime})`);
            }
            param.value = value;
            events.push({ op: 'linearRampToValueAtTime', value, time: endTime });
        },
        exponentialRampToValueAtTime(value, endTime) {
            if (!Number.isFinite(value) || !Number.isFinite(endTime)) {
                throw new TypeError(`Non-finite AudioParam exponentialRampToValueAtTime(${value}, ${endTime})`);
            }
            if (value <= 0) {
                throw new RangeError(`exponentialRampToValueAtTime target must be > 0, got ${value}`);
            }
            param.value = value;
            events.push({ op: 'exponentialRampToValueAtTime', value, time: endTime });
        },
        setTargetAtTime(target, startTime, timeConstant) {
            if (!Number.isFinite(target) || !Number.isFinite(startTime) || !Number.isFinite(timeConstant)) {
                throw new TypeError(`Non-finite AudioParam setTargetAtTime(${target}, ${startTime}, ${timeConstant})`);
            }
            param.value = target;
            events.push({ op: 'setTargetAtTime', value: target, time: startTime, timeConstant });
        },
        cancelScheduledValues(cancelTime) {
            if (!Number.isFinite(cancelTime)) {
                throw new TypeError(`Non-finite AudioParam cancelScheduledValues(${cancelTime})`);
            }
            events.push({ op: 'cancelScheduledValues', time: cancelTime });
        }
    };
    return param;
}

function createMockAudioContextClass(options = {}) {
    const contexts = [];

    class MockAudioContext {
        constructor() {
            if (options.throwOnConstruct) {
                throw new Error('Mock AudioContext construction blocked');
            }
            this.currentTime = options.currentTime ?? 0;
            this.sampleRate = options.sampleRate ?? 44100;
            this.state = options.initialState ?? 'running';
            this.destination = { kind: 'destination' };

            this.oscillators = [];
            this.gains = [];
            this.filters = [];
            this.buffers = [];
            this.bufferSources = [];
            this.panners = [];
            this.compressors = [];
            this.analysers = [];
            this.convolvers = [];
            this.connections = [];
            this.paramOwners = new Map();
            this.resumeCalls = 0;
            this.closeCalls = 0;

            if (options.minimal) {
                this.createDynamicsCompressor = undefined;
                this.createConvolver = undefined;
                this.createAnalyser = undefined;
            }

            contexts.push(this);
        }

        _trackConnect(source, dest) {
            this.connections.push({ source, dest });
            return dest;
        }

        resume() {
            this.resumeCalls += 1;
            const mode = options.resumeMode ?? 'resolve';
            if (mode === 'missing') return undefined;
            if (mode === 'sync-undefined') return undefined;
            if (mode === 'sync-throw') throw new Error('Sync resume failure');
            if (mode === 'reject') {
                return Promise.reject(new Error('Autoplay policy blocked'));
            }
            if (mode === 'stay-suspended') {
                return Promise.resolve();
            }
            if (mode === 'deferred') {
                return new Promise((resolve) => {
                    const deferQueue = options.deferredResolvers || [];
                    deferQueue.push(() => {
                        this.state = 'running';
                        resolve();
                    });
                    options.deferredResolvers = deferQueue;
                });
            }
            this.state = 'running';
            return Promise.resolve();
        }

        close() {
            this.closeCalls += 1;
            this.state = 'closed';
            return Promise.resolve();
        }

        createOscillator() {
            const ctx = this;
            const node = {
                kind: 'oscillator',
                type: 'sine',
                frequency: createMockAudioParam(440),
                detune: createMockAudioParam(0),
                startedAt: null,
                stoppedAt: null,
                stopCalls: [],
                connectedTo: [],
                onended: null,
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {},
                start(when = 0) {
                    node.startedAt = when;
                },
                stop(when = 0) {
                    node.stoppedAt = when;
                    node.stopCalls.push(when);
                }
            };
            this.oscillators.push(node);
            this.paramOwners.set(node.frequency, node);
            this.paramOwners.set(node.detune, node);
            return node;
        }

        createGain() {
            const ctx = this;
            const node = {
                kind: 'gain',
                gain: createMockAudioParam(1),
                connectedTo: [],
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {}
            };
            this.gains.push(node);
            return node;
        }

        createBiquadFilter() {
            const ctx = this;
            const node = {
                kind: 'biquadFilter',
                type: 'lowpass',
                frequency: createMockAudioParam(350),
                Q: createMockAudioParam(1),
                gain: createMockAudioParam(0),
                connectedTo: [],
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {}
            };
            this.filters.push(node);
            return node;
        }

        createBuffer(channels, length, sampleRate) {
            const channelData = Array.from({ length: channels }, () => new Float32Array(length));
            const buffer = {
                kind: 'audioBuffer',
                numberOfChannels: channels,
                length,
                sampleRate,
                duration: length / sampleRate,
                getChannelData(ch) {
                    return channelData[ch];
                }
            };
            this.buffers.push(buffer);
            return buffer;
        }

        createBufferSource() {
            const ctx = this;
            const node = {
                kind: 'bufferSource',
                buffer: null,
                loop: false,
                playbackRate: createMockAudioParam(1),
                startedAt: null,
                stoppedAt: null,
                stopCalls: [],
                connectedTo: [],
                onended: null,
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {},
                start(when = 0) {
                    node.startedAt = when;
                },
                stop(when = 0) {
                    node.stoppedAt = when;
                    node.stopCalls.push(when);
                }
            };
            this.bufferSources.push(node);
            return node;
        }

        createStereoPanner() {
            const ctx = this;
            const node = {
                kind: 'panner',
                pan: createMockAudioParam(0),
                connectedTo: [],
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {}
            };
            this.panners.push(node);
            return node;
        }

        createDynamicsCompressor() {
            const ctx = this;
            const node = {
                kind: 'compressor',
                threshold: createMockAudioParam(-24),
                knee: createMockAudioParam(30),
                ratio: createMockAudioParam(12),
                attack: createMockAudioParam(0.003),
                release: createMockAudioParam(0.25),
                connectedTo: [],
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {}
            };
            this.compressors.push(node);
            return node;
        }

        createAnalyser() {
            const ctx = this;
            const node = {
                kind: 'analyser',
                fftSize: 2048,
                smoothingTimeConstant: 0.8,
                connectedTo: [],
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {},
                getByteFrequencyData(arr) {
                    const fillVal = options.analyserByteValue ?? 128;
                    for (let i = 0; i < arr.length; i++) {
                        arr[i] = fillVal;
                    }
                }
            };
            if (!options.omitFrequencyBinCount) {
                Object.defineProperty(node, 'frequencyBinCount', {
                    enumerable: true,
                    get() {
                        return Math.floor(node.fftSize / 2);
                    }
                });
            }
            this.analysers.push(node);
            return node;
        }

        createConvolver() {
            const ctx = this;
            const node = {
                kind: 'convolver',
                buffer: null,
                connectedTo: [],
                connect(dest) {
                    node.connectedTo.push(dest);
                    return ctx._trackConnect(node, dest);
                },
                disconnect() {}
            };
            this.convolvers.push(node);
            return node;
        }
    }

    if (options.resumeMode === 'missing') {
        MockAudioContext.prototype.resume = undefined;
    }

    return { MockAudioContext, contexts };
}

function invokeAllSoundMethods(ctrl) {
    ctrl.playTone(440, 'sine', 0.1, 0.12);
    ctrl.playSelect();
    ctrl.playStep();
    ctrl.playRaceSwitch();
    ctrl.playClassEquip('warrior');
    ctrl.playClassEquip('mage');
    ctrl.playFanfare();
    ctrl.playDiceRoll();
    ctrl.playDiceLand(false);
    ctrl.playDiceLand(true);
    ctrl.playSuccess();
    ctrl.playFailure();
    ctrl.playChestOpen();
    ctrl.playHit();
    ctrl.playRandomize();
    ctrl.playSlash();
    ctrl.playShieldBlock();
    ctrl.playSpellCast();
    ctrl.playPotionDrink();
    ctrl.playFlee();
    ctrl.playTitleEnter();
    ctrl.playCrystalChime();
    ctrl.playTrapTrigger();
    ctrl.playTrapDisarm();
    ctrl.playDoorOpen();
    ctrl.playDoorLocked();
    ctrl.playMonsterGrowl();
    ctrl.playDreadStinger();
    ctrl.playRoomDiscover();
}

function resetSingletons() {
    music.stop({ fadeOutSec: 0 });
    music.ctx = null;
    music.masterGain = null;
    music.compressor = null;
    music.dryBus = null;
    music.wetBus = null;
    music.reverbNode = null;
    music.trackBus = null;
    music.trackDryBus = null;
    music.trackWetBus = null;
    music.stingerBus = null;
    music.analyser = null;
    music.freqData = null;
    music.setMuted(false);
    music.volume = 0.65;
    music.tension = 0;
    music.currentTrack = 'title';
    music.isPlaying = false;
    music.awaitingGesture = false;
    music.stepIndex = 0;
    music.nextNoteTime = 0;
    music.listeners.clear();
    music.activeLoopSources.clear();
    music._windNoiseBuffer = null;
    music._windNoiseCtx = null;
    music._wasPlayingBeforeMute = false;
    music._lastStingerTimes.clear();

    sound.ctx = null;
    sound.setMuted(false);
}

function hasPathToDestination(ctx, startNode) {
    const visited = new Set();
    const queue = [startNode];
    while (queue.length > 0) {
        const cur = queue.shift();
        if (cur === ctx.destination) return true;
        if (!cur || visited.has(cur)) continue;
        visited.add(cur);
        const owner = ctx.paramOwners?.get(cur);
        if (owner && !visited.has(owner)) {
            queue.push(owner);
        }
        for (const edge of ctx.connections) {
            if (edge.source === cur && !visited.has(edge.dest)) {
                queue.push(edge.dest);
            }
        }
    }
    return false;
}

const GLOBAL_KEYS = ['window', 'AudioContext', 'webkitAudioContext'];
let savedDescriptors = new Map();
const localMusicInstances = [];

function createIsolatedMusic(opts) {
    const ctrl = new MusicController(opts);
    localMusicInstances.push(ctrl);
    return ctrl;
}

describe('Dungeon-Delver Audio & Music Engine (M3)', () => {
    beforeEach(() => {
        savedDescriptors = new Map();
        for (const key of GLOBAL_KEYS) {
            const desc = Object.getOwnPropertyDescriptor(globalThis, key);
            savedDescriptors.set(key, desc);
            Reflect.deleteProperty(globalThis, key);
        }
        resetSingletons();
    });

    afterEach(() => {
        while (localMusicInstances.length > 0) {
            const inst = localMusicInstances.pop();
            inst.stop({ fadeOutSec: 0 });
        }
        resetSingletons();
        for (const key of GLOBAL_KEYS) {
            const desc = savedDescriptors.get(key);
            if (desc) {
                Reflect.defineProperty(globalThis, key, desc);
            } else {
                Reflect.deleteProperty(globalThis, key);
            }
        }
    });

    describe('1. Headless / Missing Web Audio API Fail-Safety', () => {
        it('no-ops cleanly across all 27 SoundController methods when window & AudioContext are absent', () => {
            assert.equal(sound.init(), null);
            assert.doesNotThrow(() => invokeAllSoundMethods(sound));

            const fresh = new SoundController();
            assert.equal(fresh.init(), null);
            assert.doesNotThrow(() => invokeAllSoundMethods(fresh));
        });

        it('no-ops cleanly when window = {} lacks AudioContext and webkitAudioContext, or window = null', () => {
            globalThis.window = {};
            const ctrl = new SoundController();
            assert.equal(ctrl.init(), null);
            assert.doesNotThrow(() => invokeAllSoundMethods(ctrl));

            globalThis.window = null;
            assert.equal(ctrl.init(), null);
            assert.doesNotThrow(() => invokeAllSoundMethods(ctrl));
        });

        it('handles throwing AudioContext constructor without throwing', () => {
            const { MockAudioContext } = createMockAudioContextClass({ throwOnConstruct: true });
            globalThis.window = { AudioContext: MockAudioContext };

            const ctrl = new SoundController();
            assert.equal(ctrl.init(), null);
            assert.doesNotThrow(() => invokeAllSoundMethods(ctrl));
        });

        it('MusicController fails safe across all methods when AudioContext is unavailable', async () => {
            const ctrl = createIsolatedMusic({ audio: new SoundController() });

            const startedTitle = await ctrl.tryStart('title');
            assert.equal(startedTitle, false);
            assert.equal(ctrl.awaitingGesture, true);
            assert.equal(ctrl.isPlaying, false);

            const startedCrypt = await ctrl.playTrack('crypt');
            assert.equal(startedCrypt, false);
            assert.equal(ctrl.currentTrack, 'crypt');

            for (const kind of ['dread', 'trap', 'combat', 'discover', 'victory', undefined]) {
                assert.equal(ctrl.triggerStinger(kind), false);
            }

            assert.doesNotThrow(() => {
                ctrl.setVolume(0.4);
                ctrl.setTension(0.8);
                ctrl.setMuted(true);
                ctrl.setMuted(false);
                ctrl.stop();
                ctrl.stopLoop({ fadeOutSec: 0 });
            });
            assert.deepEqual(ctrl.getSpectrumBars(10), new Array(10).fill(0));
        });
    });

    describe('2. AudioContext Resolution, Suspended Resume & Closed Recovery', () => {
        it('resolves webkitAudioContext from window and AudioContext from globalThis', () => {
            const { MockAudioContext: WebkitCtx, contexts: webkitContexts } = createMockAudioContextClass();
            globalThis.window = { webkitAudioContext: WebkitCtx };

            const s1 = new SoundController();
            const ctx1 = s1.init();
            assert.ok(ctx1);
            assert.equal(webkitContexts.length, 1);

            Reflect.deleteProperty(globalThis, 'window');
            const { MockAudioContext: GlobalCtx, contexts: globalContexts } = createMockAudioContextClass();
            globalThis.AudioContext = GlobalCtx;

            const s2 = new SoundController();
            const ctx2 = s2.init();
            assert.ok(ctx2);
            assert.equal(globalContexts.length, 1);
        });

        it('handles suspended AudioContext across rejecting, missing, sync-undefined, and sync-throw resume()', async () => {
            for (const resumeMode of ['reject', 'missing', 'sync-undefined', 'sync-throw']) {
                const { MockAudioContext, contexts } = createMockAudioContextClass({
                    initialState: 'suspended',
                    resumeMode
                });
                globalThis.window = { AudioContext: MockAudioContext };

                const s = new SoundController();
                assert.doesNotThrow(() => {
                    const ctx = s.init();
                    assert.ok(ctx);
                });
                if (resumeMode !== 'missing') {
                    assert.equal(contexts[0].resumeCalls, 1);
                }
                assert.doesNotThrow(() => {
                    s.playTrapTrigger();
                });
                if (resumeMode !== 'missing') {
                    assert.equal(contexts[0].resumeCalls, 2);
                }

                const m = createIsolatedMusic({ audio: new SoundController() });
                const ok = await m.tryStart('crypt');
                assert.equal(ok, false);
                assert.equal(m.awaitingGesture, true);
                assert.equal(m.isPlaying, false);
                assert.equal(m.triggerStinger('dread'), false);
            }
        });

        it('transitions suspended AudioContext to running when resume() resolves', async () => {
            const { MockAudioContext } = createMockAudioContextClass({
                initialState: 'suspended',
                resumeMode: 'resolve'
            });
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            const ok = await m.tryStart('crypt');
            assert.equal(ok, true);
            assert.equal(m.isPlaying, true);
            assert.equal(m.awaitingGesture, false);
        });

        it('recovers cleanly if a previous AudioContext becomes closed', async () => {
            const { MockAudioContext, contexts } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const s = new SoundController();
            const firstCtx = s.init();
            await firstCtx.close();
            assert.equal(firstCtx.state, 'closed');

            const recoveredCtx = s.init();
            assert.ok(recoveredCtx);
            assert.notEqual(recoveredCtx, firstCtx);
            assert.equal(contexts.length, 2);

            const m = createIsolatedMusic({ audio: s });
            assert.equal(await m.playTrack('crypt'), true);
            await m.ctx.close();
            assert.equal(m.triggerStinger('dread'), true);
            assert.equal(contexts.length, 3);
        });
    });

    describe('3. Muted State Synchronization & Zero-Node No-Op Contracts', () => {
        it('keeps sound.enabled and sound.muted strictly bidirectionally synchronized and prevents node allocation when muted', () => {
            const { MockAudioContext, contexts } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const s = new SoundController();
            assert.equal(s.enabled, true);
            assert.equal(s.muted, false);

            s.setMuted(true);
            assert.equal(s.muted, true);
            assert.equal(s.enabled, false);
            invokeAllSoundMethods(s);
            assert.equal(contexts.length, 0);

            s.enabled = true;
            assert.equal(s.muted, false);
            assert.equal(s.enabled, true);

            s.enabled = false;
            assert.equal(s.muted, true);
            invokeAllSoundMethods(s);
            assert.equal(contexts.length, 0);

            s.muted = false;
            assert.equal(s.enabled, true);
            s.playTrapTrigger();
            assert.equal(contexts.length, 1);
            assert.ok(contexts[0].oscillators.length > 0);
        });

        it('keeps music.enabled and music.muted synchronized, creates 0 nodes when muted, and preserves cross-mute independence', async () => {
            const { MockAudioContext, contexts } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const s = new SoundController();
            s.setMuted(true);

            const m = createIsolatedMusic({ audio: s });
            m.setMuted(true);
            assert.equal(m.muted, true);
            assert.equal(m.enabled, false);

            assert.equal(await m.playTrack('crypt'), false);
            assert.equal(m.currentTrack, 'crypt');
            assert.equal(m.stepIndex, 0);
            assert.equal(await m.tryStart('title'), false);
            assert.equal(m.triggerStinger('dread'), false);
            assert.equal(contexts.length, 0);

            // Cross-mute: sound muted while music unmuted must still initialize shared AudioContext!
            m.setMuted(false);
            assert.equal(m.muted, false);
            assert.equal(m.enabled, true);
            assert.equal(await m.playTrack('crypt'), true);
            assert.equal(contexts.length, 1);
            assert.equal(m.isPlaying, true);
            assert.equal(s.muted, true);

            // toggle() disables and stops loop
            await m.toggle();
            assert.equal(m.enabled, false);
            assert.equal(m.muted, true);
            assert.equal(m.isPlaying, false);

            // toggle() again re-enables and restarts loop
            await m.toggle();
            assert.equal(m.enabled, true);
            assert.equal(m.muted, false);
            assert.equal(m.isPlaying, true);
        });

        it('setMuted(false) resumes playback only if music was playing before mute', async () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            await m.playTrack('title');
            assert.equal(m.isPlaying, true);

            m.setMuted(true);
            assert.equal(m.isPlaying, false);
            m.setMuted(false);
            // wait microtask for async tryStart inside setMuted(false)
            await Promise.resolve();
            assert.equal(m.isPlaying, true);

            // Explicit stop() while muted cancels prior resume intent
            m.setMuted(true);
            m.stop({ fadeOutSec: 0 });
            m.setMuted(false);
            await Promise.resolve();
            assert.equal(m.isPlaying, false);
        });
    });

    describe('4. SoundController Procedural Synthesis (7 New Horror SFX + 20 Existing)', () => {
        it('synthesizes all 7 new horror/dungeon SFX with real Web Audio nodes and valid envelopes', () => {
            const { MockAudioContext, contexts } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const assertMethodNodes = (name, minOsc, minBuffers, minFilters, extraAssert) => {
                const s = new SoundController();
                s[name]();
                assert.equal(contexts.length >= 1, true, `${name} should create AudioContext`);
                const ctx = contexts[contexts.length - 1];

                assert.ok(ctx.oscillators.length >= minOsc, `${name} expected >= ${minOsc} oscillators, got ${ctx.oscillators.length}`);
                assert.ok(ctx.buffers.length >= minBuffers, `${name} expected >= ${minBuffers} buffers, got ${ctx.buffers.length}`);
                assert.ok(ctx.bufferSources.length >= minBuffers, `${name} expected >= ${minBuffers} bufferSources`);
                assert.ok(ctx.filters.length >= minFilters, `${name} expected >= ${minFilters} filters, got ${ctx.filters.length}`);

                for (const osc of ctx.oscillators) {
                    assert.ok(osc.stoppedAt > osc.startedAt, `${name} oscillator must stop after start`);
                    assert.ok(hasPathToDestination(ctx, osc), `${name} oscillator must connect to destination`);
                }
                for (const bs of ctx.bufferSources) {
                    assert.ok(bs.buffer, `${name} bufferSource must have buffer`);
                    assert.ok(bs.stoppedAt > bs.startedAt, `${name} bufferSource must stop after start`);
                    assert.ok(hasPathToDestination(ctx, bs), `${name} bufferSource must connect to destination`);
                }
                if (extraAssert) extraAssert(ctx);
            };

            assertMethodNodes('playTrapTrigger', 3, 2, 2);
            assertMethodNodes('playTrapDisarm', 5, 2, 2);
            assertMethodNodes('playDoorOpen', 4, 1, 3, (ctx) => {
                // Verify FM LFO modulation connection to carrier frequency
                const hasFreqMod = ctx.connections.some((c) => ctx.oscillators.some((o) => o.frequency === c.dest));
                assert.equal(hasFreqMod, true, 'playDoorOpen should wire FM LFO to carrier.frequency');
            });
            assertMethodNodes('playDoorLocked', 4, 3, 3);
            assertMethodNodes('playMonsterGrowl', 3, 1, 2, (ctx) => {
                // Verify FM throat growl modulation connection to carrier frequency
                const hasFreqMod = ctx.connections.some((c) => ctx.oscillators.some((o) => o.frequency === c.dest));
                assert.equal(hasFreqMod, true, 'playMonsterGrowl should wire FM modulator to carrier.frequency');
            });
            assertMethodNodes('playDreadStinger', 5, 1, 2, (ctx) => {
                const freqs = ctx.oscillators.map((o) => o.frequency.events[0]?.value ?? o.frequency.value);
                assert.ok(freqs.some((f) => Math.abs(f - 293.66) < 2), 'playDreadStinger should include D4');
                assert.ok(freqs.some((f) => Math.abs(f - 311.13) < 2), 'playDreadStinger should include Eb4 minor 2nd');
                assert.ok(freqs.some((f) => Math.abs(f - 415.30) < 2), 'playDreadStinger should include G#4 tritone');
            });
            assertMethodNodes('playRoomDiscover', 3, 2, 2);
        });

        it('executes all 20 existing SoundController methods synchronously (zero setTimeout leaks)', () => {
            const { MockAudioContext, contexts } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const s = new SoundController();
            const ctx = s.init();
            const existingCalls = [
                () => s.playTone(440, 'square', 0.1, 0.15),
                () => s.playSelect(),
                () => s.playStep(),
                () => s.playRaceSwitch(),
                () => s.playClassEquip('warrior'),
                () => s.playClassEquip('mage'),
                () => s.playFanfare(),
                () => s.playDiceRoll(),
                () => s.playDiceLand(false),
                () => s.playDiceLand(true),
                () => s.playSuccess(),
                () => s.playFailure(),
                () => s.playChestOpen(),
                () => s.playHit(),
                () => s.playRandomize(),
                () => s.playSlash(),
                () => s.playShieldBlock(),
                () => s.playSpellCast(),
                () => s.playPotionDrink(),
                () => s.playFlee(),
                () => s.playTitleEnter(),
                () => s.playCrystalChime()
            ];

            for (const fn of existingCalls) {
                const before = ctx.oscillators.length;
                fn();
                assert.ok(ctx.oscillators.length > before, 'Method should synchronously schedule Web Audio oscillators');
            }
            assert.equal(contexts.length, 1);
            for (const osc of ctx.oscillators) {
                assert.ok(osc.stoppedAt > osc.startedAt);
                assert.ok(hasPathToDestination(ctx, osc));
            }
        });
    });

    describe('5. MusicController Graph, Tracks, Deepened Crypt, Stingers & Tension', () => {
        it('builds full audio graph in ensureGraph() and degrades safely on minimal contexts', () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            const ctx = m.ensureGraph();
            assert.ok(ctx);
            assert.equal(ctx.compressors.length, 1);
            assert.equal(ctx.analysers.length, 1);
            assert.equal(ctx.convolvers.length, 1);
            assert.equal(ctx.buffers.length, 1);
            assert.equal(ctx.buffers[0].numberOfChannels, 2);
            assert.ok(m.trackBus);
            assert.ok(m.stingerBus);
            assert.ok(hasPathToDestination(ctx, m.trackBus));
            assert.ok(hasPathToDestination(ctx, m.stingerBus));

            // Minimal context lacking compressor, convolver, analyser
            const { MockAudioContext: MinimalCtx, contexts: minContexts } = createMockAudioContextClass({ minimal: true });
            const minMusic = createIsolatedMusic({ ctx: new MinimalCtx() });
            assert.ok(minMusic.ensureGraph());
            assert.equal(minContexts[0].compressors.length, 0);
            assert.ok(hasPathToDestination(minContexts[0], minMusic.trackBus));
        });

        it('preserves 24-bar title score and deepens crypt score to 16 bars with sub, wind noise, and haunted chimes', async () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            assert.equal(m.tracks.title.bpm, 92);
            assert.equal(m.tracks.title.totalSteps, 24 * 16);
            assert.equal(m.tracks.crypt.bpm, 72);
            assert.equal(m.tracks.crypt.totalSteps, 16 * 16);

            // Verify conservative headroom on crypt events
            for (const events of m.tracks.crypt.eventsByStep.values()) {
                for (const ev of events) {
                    if (ev.gain !== undefined) {
                        assert.ok(ev.gain <= 0.15, `Crypt event ${ev.inst} gain ${ev.gain} exceeds 0.15 headroom cap`);
                    }
                }
            }

            const snapshots = [];
            const unsubscribe = m.onChange((s) => snapshots.push(s));

            assert.equal(await m.playTrack('crypt'), true);
            const ctx = m.ctx;
            assert.equal(m.currentTrack, 'crypt');
            assert.equal(m.isPlaying, true);
            // Step 0 runs synchronously inside startLoop(), triggering sub + wind + pad
            assert.ok(ctx.oscillators.length > 0, 'Step 0 should schedule oscillators synchronously');
            assert.ok(ctx.bufferSources.length >= 1, 'Crypt step 0 should schedule wind noise bufferSource');
            assert.ok(ctx.filters.length >= 1, 'Crypt step 0 should schedule bandpass/lowpass filters');

            const lastSnap = snapshots[snapshots.length - 1];
            assert.equal(lastSnap.track, 'crypt');
            assert.equal(lastSnap.trackTitle, 'Echoes of the Crypt');
            assert.equal(lastSnap.enabled, true);
            assert.equal(lastSnap.muted, false);
            assert.equal(lastSnap.isPlaying, true);
            assert.equal(typeof lastSnap.volume, 'number');

            // Test every step in the 16-bar crypt score schedules cleanly and caches wind buffer
            const buffersBeforeSweep = ctx.buffers.length;
            const stepDur = 60 / m.tracks.crypt.bpm / 4;
            for (let step = 0; step < m.tracks.crypt.totalSteps; step++) {
                m.scheduleStep(m.tracks.crypt, step, 1 + step * stepDur, stepDur);
            }
            assert.equal(ctx.buffers.length, buffersBeforeSweep, 'Crypt wind noise buffer should be cached');

            unsubscribe();
            const countBeforeStop = snapshots.length;
            m.stop({ fadeOutSec: 0 });
            assert.equal(snapshots.length, countBeforeStop, 'Unsubscribed listener must not receive updates');

            // Verify 24-bar title score steps and singleton sound/music integration
            assert.equal(await music.playTrack('title'), true);
            const titleStepDur = 60 / music.tracks.title.bpm / 4;
            for (let step = 0; step < music.tracks.title.totalSteps; step++) {
                music.scheduleStep(music.tracks.title, step, 1 + step * titleStepDur, titleStepDur);
            }
            assert.ok(music.ctx.oscillators.length > 50);
            assert.equal(await music.playTrack('crypt'), true);
            assert.equal(music.currentTrack, 'crypt');
            sound.playTrapTrigger();
            assert.equal(music.triggerStinger('discover'), true);
            music.stop({ fadeOutSec: 0 });
        });

        it('triggers all stinger kinds cleanly, obeys brief same-kind cooldown, and sounds after stop()', async () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            await m.playTrack('crypt');
            const ctx = m.ctx;

            m.stop({ fadeOutSec: 0 });
            assert.equal(m.isPlaying, false);
            assert.equal(m.activeLoopSources.size, 0);

            for (const kind of ['dread', 'trap', 'combat', 'discover', 'room', 'victory', 'exit', 'unknown', undefined]) {
                const oscBefore = ctx.oscillators.length;
                const played = m.triggerStinger(kind);
                assert.equal(played, true, `triggerStinger(${String(kind)}) should succeed after stop() while unmuted`);
                assert.ok(ctx.oscillators.length > oscBefore, `triggerStinger(${String(kind)}) should create oscillators`);
            }

            // Test cooldown when currentTime > 0
            ctx.currentTime = 2.0;
            assert.equal(m.triggerStinger('dread'), true);
            ctx.currentTime = 2.02;
            assert.equal(m.triggerStinger('dread'), false);
            assert.equal(m.triggerStinger('trap'), true);
            ctx.currentTime = 2.10;
            assert.equal(m.triggerStinger('dread'), true);
        });

        it('supports setTension clamping and triggers high-tension crypt pulse', async () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            assert.equal(m.setTension(NaN), 0);
            assert.equal(m.setTension(-0.5), 0);
            assert.equal(m.setTension(2.5), 1);

            await m.playTrack('crypt');
            m.setTension(0.8);
            assert.equal(m.tension, 0.8);
            const oscBefore = m.ctx.oscillators.length;
            m.scheduleStep(m.tracks.crypt, 16, 1.0, 0.2);
            assert.ok(m.ctx.oscillators.length > oscBefore, 'High tension should schedule heartbeat drum pulse');
        });
    });

    describe('6. Rapid Switches, Async Race Protection, Edge Cases & Cleanup', () => {
        it('retires previous track loop sources cleanly on track switch and stop()', async () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            await m.playTrack('title');
            const titleOscs = [...m.ctx.oscillators];
            assert.ok(titleOscs.length > 0);
            assert.ok(m.activeLoopSources.size > 0);

            await m.playTrack('crypt');
            // Every previously tracked title oscillator should have received an early stop() call
            assert.ok(titleOscs.every((o) => o.stopCalls.length >= 2));
            assert.equal(m.currentTrack, 'crypt');

            const cryptSources = [...m.activeLoopSources];
            assert.ok(cryptSources.length > 0);
            m.stop({ fadeOutSec: 0.05 });
            assert.equal(m.isPlaying, false);
            assert.equal(m.schedulerTimer, null);
            assert.equal(m.activeLoopSources.size, 0);
            assert.ok(cryptSources.every((s) => s.stopCalls.length >= 2));

            // Idempotent repeated stop()
            assert.doesNotThrow(() => m.stop());
            assert.doesNotThrow(() => m.stopLoop());
        });

        it('cancels stale async tryStart/playTrack calls across pending resume() via _playToken', async () => {
            const opts = { initialState: 'suspended', resumeMode: 'deferred', deferredResolvers: [] };
            const { MockAudioContext } = createMockAudioContextClass(opts);
            globalThis.window = { AudioContext: MockAudioContext };

            const m1 = createIsolatedMusic({ audio: new SoundController() });
            const pTitle = m1.playTrack('title');
            const pCrypt = m1.playTrack('crypt');
            while (opts.deferredResolvers.length > 0) {
                opts.deferredResolvers.shift()();
            }
            const [resTitle, resCrypt] = await Promise.all([pTitle, pCrypt]);
            assert.equal(resTitle, false);
            assert.equal(resCrypt, true);
            assert.equal(m1.currentTrack, 'crypt');
            assert.equal(m1.isPlaying, true);

            // Now test playTrack interrupted by stop() before resume resolves
            const opts2 = { initialState: 'suspended', resumeMode: 'deferred', deferredResolvers: [] };
            const { MockAudioContext: Mock2 } = createMockAudioContextClass(opts2);
            const m2 = createIsolatedMusic({ ctx: new Mock2() });
            const pPending = m2.playTrack('crypt');
            m2.stop({ fadeOutSec: 0 });
            while (opts2.deferredResolvers.length > 0) {
                opts2.deferredResolvers.shift()();
            }
            assert.equal(await pPending, false);
            assert.equal(m2.isPlaying, false);
        });

        it('handles setVolume and getSpectrumBars edge cases safely with zero NaNs', async () => {
            const { MockAudioContext } = createMockAudioContextClass({
                omitFrequencyBinCount: true,
                analyserByteValue: 180
            });
            globalThis.window = { AudioContext: MockAudioContext };

            const m = createIsolatedMusic({ audio: new SoundController() });
            assert.equal(m.setVolume(NaN), 0.65);
            assert.equal(m.setVolume(undefined), 0.65);
            assert.equal(m.setVolume(-2), 0);
            assert.equal(m.setVolume(5), 1);
            assert.equal(m.setVolume(0.5), 0.5);

            await m.playTrack('title');
            // Even when analyser lacked frequencyBinCount, getSpectrumBars must return zeros, never NaN
            const barsNoBins = m.getSpectrumBars(10);
            assert.equal(barsNoBins.length, 10);
            assert.ok(barsNoBins.every((v) => v === 0 && !Number.isNaN(v)));

            // Now with normal analyser
            const { MockAudioContext: FullCtx } = createMockAudioContextClass({ analyserByteValue: 127.5 });
            const m2 = createIsolatedMusic({ ctx: new FullCtx() });
            await m2.playTrack('title');
            const activeBars = m2.getSpectrumBars(10);
            assert.equal(activeBars.length, 10);
            assert.ok(activeBars.every((v) => Number.isFinite(v) && v >= 0 && v <= 1 && v > 0));
            assert.deepEqual(m2.getSpectrumBars(0), []);
            assert.deepEqual(m2.getSpectrumBars(NaN), []);
        });

        it('survives rapid bursts of SFX calls without throwing', () => {
            const { MockAudioContext } = createMockAudioContextClass();
            globalThis.window = { AudioContext: MockAudioContext };

            const s = new SoundController();
            assert.doesNotThrow(() => {
                for (let i = 0; i < 20; i++) {
                    s.playTrapTrigger();
                    s.playMonsterGrowl();
                    s.playDoorOpen();
                    s.playDoorLocked();
                    s.playTrapDisarm();
                    s.playDreadStinger();
                    s.playRoomDiscover();
                }
            });
        });
    });
});
