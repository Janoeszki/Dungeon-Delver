import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_CHROME_BIN = process.env.CHROME_BIN || '/usr/bin/chromium';

const activeBrowsers = new Set();
let hooksRegistered = false;

function registerBrowserHooks() {
    if (hooksRegistered) return;
    hooksRegistered = true;

    const cleanupSync = () => {
        for (const entry of activeBrowsers) {
            try {
                if (entry.proc && !entry.proc.killed) {
                    entry.proc.kill('SIGKILL');
                }
            } catch {
                // ignore
            }
            try {
                if (entry.userDataDir) {
                    fsSync.rmSync(entry.userDataDir, { recursive: true, force: true });
                }
            } catch {
                // ignore
            }
        }
        activeBrowsers.clear();
    };

    process.once('exit', cleanupSync);
}

const KEY_DEFS = {
    KeyW: { key: 'w', code: 'KeyW', keyCode: 87, text: 'w' },
    KeyA: { key: 'a', code: 'KeyA', keyCode: 65, text: 'a' },
    KeyS: { key: 's', code: 'KeyS', keyCode: 83, text: 's' },
    KeyD: { key: 'd', code: 'KeyD', keyCode: 68, text: 'd' },
    KeyM: { key: 'm', code: 'KeyM', keyCode: 77, text: 'm' },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, text: '' },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, text: '' },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, text: '' },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, text: '' },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27, text: '' },
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
    Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8, text: '' },
    Space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
    Tab: { key: 'Tab', code: 'Tab', keyCode: 9, text: '' }
};

function resolveKeySpec(keyOrCode) {
    if (KEY_DEFS[keyOrCode]) return KEY_DEFS[keyOrCode];
    if (typeof keyOrCode === 'string' && keyOrCode.length === 1) {
        const ch = keyOrCode;
        const upper = ch.toUpperCase();
        const code = upper >= 'A' && upper <= 'Z'
            ? `Key${upper}`
            : (upper >= '0' && upper <= '9' ? `Digit${upper}` : '');
        const keyCode = ch === ' ' ? 32 : upper.charCodeAt(0);
        return { key: ch, code, keyCode, text: ch };
    }
    return { key: String(keyOrCode), code: String(keyOrCode), keyCode: 0, text: '' };
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

export async function launchChromium({
    executablePath = DEFAULT_CHROME_BIN,
    windowSize = '1280,800',
    launchTimeoutMs = 15000
} = {}) {
    registerBrowserHooks();

    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dd-e2e-chrome-'));
    const args = [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        `--window-size=${windowSize}`,
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ];

    const proc = spawn(executablePath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    const tracker = { proc, userDataDir };
    activeBrowsers.add(tracker);

    let stderrBuf = '';
    const wsUrl = await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error(`Timed out waiting for Chromium DevTools WS URL.\nstderr:\n${stderrBuf}`));
        }, launchTimeoutMs);

        const onData = (chunk) => {
            const text = chunk.toString('utf8');
            stderrBuf += text;
            const m = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s\r\n]+)/);
            if (m && !settled) {
                settled = true;
                clearTimeout(timer);
                resolve(m[1]);
            }
        };

        proc.stderr.on('data', onData);
        proc.once('exit', (code, signal) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(new Error(`Chromium exited early (${code}/${signal}).\nstderr:\n${stderrBuf}`));
            }
        });
        proc.once('error', (err) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
            }
        });
    });

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out connecting to Chromium CDP WebSocket')), 10000);
        ws.addEventListener('open', () => {
            clearTimeout(timer);
            resolve();
        }, { once: true });
        ws.addEventListener('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`CDP WebSocket error: ${err?.message || 'connection failed'}`));
        }, { once: true });
    });

    let nextMsgId = 1;
    const pending = new Map();
    const sessionListeners = new Map();

    const dispatchEvent = (sessionKey, method, params) => {
        const map = sessionListeners.get(sessionKey);
        if (!map) return;
        const handlers = map.get(method);
        if (!handlers) return;
        for (const fn of Array.from(handlers)) {
            try {
                fn(params);
            } catch {
                // ignore listener failure
            }
        }
    };

    ws.addEventListener('message', (event) => {
        const raw = typeof event.data === 'string'
            ? event.data
            : Buffer.from(event.data).toString('utf8');
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }
        if (msg.id !== undefined) {
            const entry = pending.get(msg.id);
            if (!entry) return;
            pending.delete(msg.id);
            clearTimeout(entry.timer);
            if (msg.error) {
                entry.reject(new Error(`CDP ${entry.method} failed: ${msg.error.message} (${msg.error.code})`));
            } else {
                entry.resolve(msg.result || {});
            }
        } else if (msg.method) {
            dispatchEvent(msg.sessionId || 'browser', msg.method, msg.params || {});
        }
    });

    ws.addEventListener('close', () => {
        for (const [, entry] of pending) {
            clearTimeout(entry.timer);
            entry.reject(new Error('CDP WebSocket closed'));
        }
        pending.clear();
    });

    function send(method, params = {}, sessionId = null, timeoutMs = 15000) {
        if (ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error(`Cannot send ${method}: CDP WebSocket not open`));
        }
        const id = nextMsgId++;
        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            pending.set(id, { resolve, reject, timer, method });
            ws.send(JSON.stringify(payload));
        });
    }

    function on(sessionId, method, handler) {
        const key = sessionId || 'browser';
        if (!sessionListeners.has(key)) sessionListeners.set(key, new Map());
        const map = sessionListeners.get(key);
        if (!map.has(method)) map.set(method, new Set());
        map.get(method).add(handler);
        return () => {
            const set = map.get(method);
            if (set) set.delete(handler);
        };
    }

    function clearSessionListeners(sessionId) {
        sessionListeners.delete(sessionId);
    }

    async function newPage({
        url = null,
        viewport = { width: 1280, height: 800 },
        fontMode = 'fulfill', // 'fulfill' | 'abort' | 'passthrough'
        loadTimeoutMs = 25000,
        waitForCanvas = '#viewportStart canvas'
    } = {}) {
        const { browserContextId } = await send('Target.createBrowserContext');
        const { targetId } = await send('Target.createTarget', {
            url: 'about:blank',
            browserContextId
        });
        const { sessionId } = await send('Target.attachToTarget', {
            targetId,
            flatten: true
        });

        await send('Page.enable', {}, sessionId);
        await send('Runtime.enable', {}, sessionId);
        await send('DOM.enable', {}, sessionId);
        await send('Network.enable', {}, sessionId);
        await send('Log.enable', {}, sessionId);
        await send('Emulation.setDeviceMetricsOverride', {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 1,
            mobile: false
        }, sessionId);

        const pageErrors = [];
        const consoleErrors = [];
        const networkErrors = [];
        const webglErrors = [];
        const interceptedFonts = [];
        const consoleWarnings = [];
        const requestsById = new Map();

        let closed = false;

        if (fontMode === 'fulfill' || fontMode === 'abort') {
            await send('Fetch.enable', {
                patterns: [
                    { urlPattern: '*fonts.googleapis.com*' },
                    { urlPattern: '*fonts.gstatic.com*' }
                ]
            }, sessionId);

            on(sessionId, 'Fetch.requestPaused', async (params) => {
                if (closed) return;
                const reqUrl = params.request?.url || '';
                interceptedFonts.push(reqUrl);
                try {
                    if (fontMode === 'abort') {
                        await send('Fetch.failRequest', {
                            requestId: params.requestId,
                            errorReason: 'Aborted'
                        }, sessionId, 5000);
                    } else {
                        const isCss = reqUrl.includes('fonts.googleapis.com');
                        await send('Fetch.fulfillRequest', {
                            requestId: params.requestId,
                            responseCode: 200,
                            responseHeaders: [
                                { name: 'Content-Type', value: isCss ? 'text/css; charset=utf-8' : 'font/woff2' }
                            ],
                            body: ''
                        }, sessionId, 5000);
                    }
                } catch {
                    // ignore if closed mid-flight
                }
            });
        }

        const isFontUrl = (u) => u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com');
        const isFavicon = (u) => {
            try {
                return new URL(u).pathname === '/favicon.ico';
            } catch {
                return u.endsWith('/favicon.ico');
            }
        };

        on(sessionId, 'Network.requestWillBeSent', (params) => {
            requestsById.set(params.requestId, params.request?.url || '');
        });

        on(sessionId, 'Runtime.exceptionThrown', (params) => {
            const d = params.exceptionDetails || {};
            const desc = d.exception?.description || d.text || 'Uncaught exception';
            pageErrors.push(desc);
        });

        on(sessionId, 'Runtime.consoleAPICalled', (params) => {
            const text = (params.args || []).map((a) => (
                a.value !== undefined ? String(a.value) : (a.description || a.type || '')
            )).join(' ');
            if (params.type === 'error') {
                consoleErrors.push(text);
                if (/webgl|shader|gl_invalid|context.?lost|pointlight/i.test(text)) {
                    webglErrors.push(text);
                }
            } else if (params.type === 'warning') {
                consoleWarnings.push(text);
                if (/webgl:\s*context_lost|gl_invalid|too many active|shader.*error|program not linked/i.test(text)) {
                    webglErrors.push(text);
                }
            }
        });

        on(sessionId, 'Log.entryAdded', (params) => {
            const entry = params.entry || {};
            const entryUrl = entry.url || '';
            const txt = entry.text || '';
            if (entry.level === 'error') {
                if (isFavicon(entryUrl) || txt.includes('/favicon.ico')) return;
                if (isFontUrl(entryUrl) || txt.includes('fonts.googleapis.com') || txt.includes('fonts.gstatic.com')) {
                    if (fontMode === 'abort' || fontMode === 'fulfill') return;
                }
                if (entry.source === 'network') {
                    networkErrors.push(`${entryUrl}: ${txt}`);
                } else {
                    consoleErrors.push(`[${entry.source}] ${txt}`);
                }
            }
            if (/webgl:\s*context_lost|gl_invalid|too many active|shader.*error|program not linked/i.test(txt)) {
                webglErrors.push(txt);
            }
        });

        on(sessionId, 'Network.loadingFailed', (params) => {
            const reqUrl = requestsById.get(params.requestId) || '';
            if (params.canceled) return;
            if (isFavicon(reqUrl)) return;
            if (isFontUrl(reqUrl) && (fontMode === 'abort' || fontMode === 'fulfill')) return;
            networkErrors.push(`${reqUrl || params.requestId}: ${params.errorText || 'loadingFailed'}`);
        });

        on(sessionId, 'Network.responseReceived', (params) => {
            const resp = params.response || {};
            const reqUrl = resp.url || '';
            if (resp.status >= 400) {
                if (isFavicon(reqUrl)) return;
                if (isFontUrl(reqUrl) && (fontMode === 'abort' || fontMode === 'fulfill')) return;
                networkErrors.push(`HTTP ${resp.status} ${reqUrl}`);
            }
        });

        async function evalFn(fnOrExpr, ...args) {
            const expression = typeof fnOrExpr === 'function'
                ? `(${fnOrExpr.toString()})(...${JSON.stringify(args)})`
                : String(fnOrExpr);
            const res = await send('Runtime.evaluate', {
                expression,
                awaitPromise: true,
                returnByValue: true
            }, sessionId, 20000);
            if (res.exceptionDetails) {
                const msg = res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Evaluation threw';
                throw new Error(`Page eval error: ${msg}`);
            }
            return res.result ? res.result.value : undefined;
        }

        async function waitFor(predicateFn, {
            timeoutMs = 5000,
            intervalMs = 80,
            label = 'condition',
            args = []
        } = {}) {
            const deadline = Date.now() + timeoutMs;
            let lastVal;
            while (Date.now() < deadline) {
                if (typeof predicateFn === 'function') {
                    // Support both browser-eval functions and local async functions via option
                    lastVal = await evalFn(predicateFn, ...args);
                } else {
                    lastVal = await predicateFn();
                }
                if (lastVal) return lastVal;
                await sleep(intervalMs);
            }
            throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label} (last=${JSON.stringify(lastVal)})`);
        }

        async function waitForLocal(asyncCheck, {
            timeoutMs = 5000,
            intervalMs = 80,
            label = 'condition'
        } = {}) {
            const deadline = Date.now() + timeoutMs;
            let lastVal;
            while (Date.now() < deadline) {
                lastVal = await asyncCheck();
                if (lastVal) return lastVal;
                await sleep(intervalMs);
            }
            throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
        }

        async function clickAt(x, y, { button = 'left', clickCount = 1 } = {}) {
            await send('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x,
                y,
                button: 'none'
            }, sessionId);
            await send('Input.dispatchMouseEvent', {
                type: 'mousePressed',
                x,
                y,
                button,
                clickCount
            }, sessionId);
            await send('Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x,
                y,
                button,
                clickCount
            }, sessionId);
        }

        async function getElementBox(selector) {
            return evalFn((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
                const rect = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                return {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
                    disabled: Boolean(el.disabled)
                };
            }, selector);
        }

        async function click(selector, { allowDisabled = false, waitMs = 1500 } = {}) {
            let box = await getElementBox(selector);
            if ((!box || !box.visible) && waitMs > 0) {
                const deadline = Date.now() + waitMs;
                while (Date.now() < deadline) {
                    await sleep(60);
                    box = await getElementBox(selector);
                    if (box && box.visible) break;
                }
            }
            if (!box) throw new Error(`Element not found for click: ${selector}`);
            if (!box.visible) throw new Error(`Element not visible for click: ${selector}`);
            if (box.disabled && !allowDisabled) {
                throw new Error(`Element is disabled and cannot be clicked: ${selector}`);
            }
            await clickAt(box.x, box.y);
            return box;
        }

        async function doubleClick(selector) {
            const box = await getElementBox(selector);
            if (!box || !box.visible) {
                throw new Error(`Element not visible for doubleClick: ${selector}`);
            }
            await clickAt(box.x, box.y, { clickCount: 1 });
            await sleep(20);
            await clickAt(box.x, box.y, { clickCount: 2 });
            return box;
        }

        async function drag(x1, y1, x2, y2, steps = 10) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, button: 'none' }, sessionId);
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 }, sessionId);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = x1 + (x2 - x1) * t;
                const y = y1 + (y2 - y1) * t;
                await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 }, sessionId);
                await sleep(16);
            }
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 }, sessionId);
        }

        async function keyDown(keyOrCode) {
            const spec = resolveKeySpec(keyOrCode);
            await send('Input.dispatchKeyEvent', {
                type: spec.text ? 'keyDown' : 'rawKeyDown',
                key: spec.key,
                code: spec.code,
                windowsVirtualKeyCode: spec.keyCode,
                nativeVirtualKeyCode: spec.keyCode,
                text: spec.text || undefined,
                unmodifiedText: spec.text || undefined
            }, sessionId);
        }

        async function keyUp(keyOrCode) {
            const spec = resolveKeySpec(keyOrCode);
            await send('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: spec.key,
                code: spec.code,
                windowsVirtualKeyCode: spec.keyCode,
                nativeVirtualKeyCode: spec.keyCode
            }, sessionId);
        }

        async function pressKey(keyOrCode, holdMs = 40) {
            await keyDown(keyOrCode);
            if (holdMs > 0) await sleep(holdMs);
            await keyUp(keyOrCode);
        }

        async function holdKeys(codes, durationMs = 300) {
            for (const c of codes) {
                await keyDown(c);
            }
            await sleep(durationMs);
            for (let i = codes.length - 1; i >= 0; i--) {
                await keyUp(codes[i]);
            }
        }

        async function type(selector, text, { clear = true } = {}) {
            await click(selector);
            if (clear) {
                await evalFn((sel) => {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.focus();
                        if (typeof el.select === 'function') el.select();
                    }
                }, selector);
                await pressKey('Backspace', 15);
                // Ensure empty if text selection missed anything
                const remaining = await evalFn((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.value.length : 0;
                }, selector);
                for (let i = 0; i < remaining; i++) {
                    await pressKey('Backspace', 5);
                }
            }
            for (const ch of text) {
                if (ch.charCodeAt(0) > 127) {
                    await send('Input.insertText', { text: ch }, sessionId);
                } else {
                    await keyDown(ch);
                    await keyUp(ch);
                }
            }
        }

        async function setViewport(width, height) {
            await send('Emulation.setDeviceMetricsOverride', {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: false
            }, sessionId);
            await sleep(180);
        }

        async function screenshot() {
            const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId, 15000);
            return Buffer.from(data, 'base64');
        }

        async function goto(targetUrl, { timeoutMs = loadTimeoutMs, canvasSelector = waitForCanvas } = {}) {
            let dclResolve;
            const dclPromise = new Promise((resolve) => {
                dclResolve = resolve;
            });
            const unsubDcl = on(sessionId, 'Page.domContentEventFired', () => dclResolve());

            const navPromise = send('Page.navigate', { url: targetUrl }, sessionId, timeoutMs);
            await Promise.race([
                Promise.all([navPromise, dclPromise]),
                sleep(timeoutMs).then(() => {
                    throw new Error(`Timed out after ${timeoutMs}ms waiting for page load at ${targetUrl}`);
                })
            ]);
            unsubDcl();

            if (canvasSelector) {
                await waitFor((sel) => {
                    const c = document.querySelector(sel);
                    return Boolean(c && c.width > 0 && c.height > 0);
                }, {
                    timeoutMs,
                    intervalMs: 80,
                    label: `canvas ${canvasSelector}`,
                    args: [canvasSelector]
                });
                await sleep(180);
            }
        }

        function assertZeroErrors(label = 'page') {
            const issues = [];
            if (pageErrors.length > 0) issues.push(`pageErrors: ${pageErrors.join(' | ')}`);
            if (consoleErrors.length > 0) issues.push(`consoleErrors: ${consoleErrors.join(' | ')}`);
            if (networkErrors.length > 0) issues.push(`networkErrors: ${networkErrors.join(' | ')}`);
            if (webglErrors.length > 0) issues.push(`webglErrors: ${webglErrors.join(' | ')}`);
            if (issues.length > 0) {
                throw new Error(`Unexpected runtime errors (${label}): ${issues.join(' ; ')}`);
            }
        }

        async function close() {
            if (closed) return;
            closed = true;
            clearSessionListeners(sessionId);
            try {
                await send('Target.closeTarget', { targetId }, null, 1500);
            } catch {
                // ignore
            }
            try {
                await send('Target.disposeBrowserContext', { browserContextId }, null, 1500);
            } catch {
                // ignore
            }
        }

        const page = {
            targetId,
            sessionId,
            browserContextId,
            pageErrors,
            consoleErrors,
            networkErrors,
            webglErrors,
            consoleWarnings,
            interceptedFonts,
            send: (m, p) => send(m, p, sessionId),
            eval: evalFn,
            waitFor,
            waitForLocal,
            click,
            doubleClick,
            clickAt,
            drag,
            getElementBox,
            keyDown,
            keyUp,
            pressKey,
            holdKeys,
            type,
            setViewport,
            screenshot,
            goto,
            assertZeroErrors,
            close,
            sleep
        };

        if (url) {
            await goto(url, { timeoutMs: loadTimeoutMs, canvasSelector: waitForCanvas });
        }

        return page;
    }

    async function close() {
        activeBrowsers.delete(tracker);
        try {
            if (ws.readyState === WebSocket.OPEN) {
                await Promise.race([send('Browser.close'), sleep(1500)]);
            }
        } catch {
            // ignore
        }
        try {
            ws.close();
        } catch {
            // ignore
        }
        await new Promise((resolve) => {
            if (proc.exitCode !== null || proc.signalCode !== null) {
                resolve();
                return;
            }
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                clearTimeout(t);
                resolve();
            };
            proc.once('exit', finish);
            try {
                proc.kill('SIGTERM');
            } catch {
                finish();
                return;
            }
            const t = setTimeout(() => {
                try {
                    if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
                } catch {
                    // ignore
                }
                finish();
            }, 1500);
        });
        await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }

    return {
        wsUrl,
        process: proc,
        newPage,
        close
    };
}

export async function cleanupAllBrowsers() {
    const entries = Array.from(activeBrowsers);
    for (const entry of entries) {
        try {
            if (entry.proc && !entry.proc.killed) entry.proc.kill('SIGKILL');
        } catch {
            // ignore
        }
        await fs.rm(entry.userDataDir, { recursive: true, force: true }).catch(() => {});
    }
    activeBrowsers.clear();
}
