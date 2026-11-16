import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, cleanupAllServers } from './lib/serverManager.mjs';
import { launchChromium, cleanupAllBrowsers } from './lib/cdp.mjs';
import { getTier1Tests } from './suites/tier1.mjs';
import { getTier2Tests } from './suites/tier2.mjs';
import { getTier3Tests } from './suites/tier3.mjs';
import { getTier4Tests } from './suites/tier4.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

function parseArgs(argv) {
    const opts = {
        tiers: new Set(),
        all: false,
        idFilter: null,
        timeoutMs: null,
        keepArtifacts: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--all') {
            opts.all = true;
        } else if (arg === '--tier') {
            if (i + 1 >= argv.length) throw new Error('Missing value after --tier');
            const val = Number(argv[++i]);
            if (![1, 2, 3, 4].includes(val)) {
                throw new Error(`Invalid --tier value: ${argv[i]} (expected 1, 2, 3, or 4)`);
            }
            opts.tiers.add(val);
        } else if (arg.startsWith('--tier=')) {
            const val = Number(arg.split('=')[1]);
            if (![1, 2, 3, 4].includes(val)) {
                throw new Error(`Invalid --tier value: ${val}`);
            }
            opts.tiers.add(val);
        } else if (arg === '--id') {
            if (i + 1 >= argv.length) throw new Error('Missing value after --id');
            opts.idFilter = String(argv[++i] || '').trim();
        } else if (arg.startsWith('--id=')) {
            opts.idFilter = arg.slice(5).trim();
        } else if (arg === '--timeout') {
            if (i + 1 >= argv.length) throw new Error('Missing value after --timeout');
            opts.timeoutMs = Number(argv[++i]);
            if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
                throw new Error('Invalid --timeout value');
            }
        } else if (arg.startsWith('--timeout=')) {
            opts.timeoutMs = Number(arg.split('=')[1]);
            if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
                throw new Error('Invalid --timeout value');
            }
        } else if (arg === '--keep-artifacts') {
            opts.keepArtifacts = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(
                'Usage: node tests/e2e/run.mjs [--tier 1|2|3|4] [--all] [--id <substr>] [--timeout <ms>] [--keep-artifacts]'
            );
            process.exit(0);
        } else {
            throw new Error(`Unknown CLI argument: ${arg}`);
        }
    }

    if (opts.all || (opts.tiers.size === 0)) {
        opts.tiers = new Set([1, 2, 3, 4]);
    }
    return opts;
}

function collectTests(opts) {
    const builders = new Map([
        [1, getTier1Tests],
        [2, getTier2Tests],
        [3, getTier3Tests],
        [4, getTier4Tests]
    ]);

    let tests = [];
    for (const tierNum of [1, 2, 3, 4]) {
        if (!opts.tiers.has(tierNum)) continue;
        const list = builders.get(tierNum)().map((t) => ({ ...t, tier: tierNum }));
        tests.push(...list);
    }

    if (opts.idFilter) {
        const needle = opts.idFilter.toLowerCase();
        tests = tests.filter((t) => t.id.toLowerCase().includes(needle) || t.desc.toLowerCase().includes(needle));
    }
    return tests;
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`Test timed out after ${ms}ms (${label})`));
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runSuite() {
    const opts = parseArgs(process.argv.slice(2));
    const tests = collectTests(opts);

    if (tests.length === 0) {
        console.error('No tests matched the given flags.');
        process.exit(1);
    }

    globalThis.__ddE2eRunnerHandlingSignals = true;
    let sharedServer = null;
    let browser = null;
    let signalAborted = false;

    const handleSignal = async (sigName, code) => {
        if (signalAborted) return;
        signalAborted = true;
        console.error(`\nReceived ${sigName}, cleaning up E2E processes...`);
        await browser?.close().catch(() => {});
        await sharedServer?.stop().catch(() => {});
        await cleanupAllBrowsers().catch(() => {});
        await cleanupAllServers().catch(() => {});
        process.exit(code);
    };

    process.once('SIGINT', () => { handleSignal('SIGINT', 130); });
    process.once('SIGTERM', () => { handleSignal('SIGTERM', 143); });

    sharedServer = await startServer();
    browser = await launchChromium();

    const tierStats = new Map();
    for (const t of [1, 2, 3, 4]) {
        tierStats.set(t, { total: 0, passed: 0, failed: 0 });
    }

    const failures = [];
    let passed = 0;
    let failed = 0;
    const suiteStart = Date.now();

    console.log(`Dungeon-Delver E2E Runner | Server: ${sharedServer.baseUrl} | Tests: ${tests.length}`);
    console.log('='.repeat(80));

    let testsSinceLaunch = 0;

    try {
        for (const tc of tests) {
            if (signalAborted) break;
            if (testsSinceLaunch >= 10 || browser.process.exitCode !== null) {
                await browser.close().catch(() => {});
                browser = await launchChromium();
                testsSinceLaunch = 0;
            }
            testsSinceLaunch++;

            const defaultTimeout = tc.tier === 4 ? 180000 : (tc.tier === 3 ? 60000 : 45000);
            const timeoutMs = opts.timeoutMs || tc.timeoutMs || defaultTimeout;

            const activePages = [];
            const ctx = {
                baseUrl: sharedServer.baseUrl,
                server: sharedServer,
                browser,
                openPage: async (pageOpts = {}) => {
                    const p = await browser.newPage({
                        url: sharedServer.baseUrl,
                        ...pageOpts
                    });
                    activePages.push(p);
                    return p;
                },
                openBlankPage: async (pageOpts = {}) => {
                    const p = await browser.newPage({
                        url: null,
                        waitForCanvas: null,
                        ...pageOpts
                    });
                    activePages.push(p);
                    return p;
                }
            };

            const t0 = Date.now();
            const ts = tierStats.get(tc.tier);
            ts.total++;

            try {
                await withTimeout(tc.run(ctx), timeoutMs, tc.id);
                const ms = Date.now() - t0;
                passed++;
                ts.passed++;
                console.log(`[PASS] ${tc.id} (${tc.ra}) — ${tc.desc} (${ms}ms)`);
            } catch (err) {
                const ms = Date.now() - t0;
                failed++;
                ts.failed++;
                const errMsg = err && err.message ? err.message : String(err);
                failures.push({ id: tc.id, ra: tc.ra, tier: tc.tier, desc: tc.desc, error: errMsg });
                console.log(`[FAIL] ${tc.id} (${tc.ra}) — ${tc.desc} (${ms}ms)`);
                console.log(`       ${errMsg.replace(/\n/g, '\n       ')}`);

                if (opts.keepArtifacts && activePages.length > 0) {
                    try {
                        await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
                        const png = await activePages[activePages.length - 1].screenshot();
                        await fs.writeFile(path.join(ARTIFACTS_DIR, `${tc.id}.png`), png);
                    } catch {
                        // ignore screenshot capture error on failure
                    }
                }
            } finally {
                for (const p of activePages) {
                    await p.close().catch(() => {});
                }
            }
        }
    } finally {
        await browser.close().catch(() => {});
        await sharedServer.stop().catch(() => {});
        await cleanupAllBrowsers().catch(() => {});
        await cleanupAllServers().catch(() => {});
    }

    const totalMs = Date.now() - suiteStart;
    console.log('='.repeat(80));
    console.log('Tier Summary:');
    for (const tierNum of [1, 2, 3, 4]) {
        const st = tierStats.get(tierNum);
        if (st.total > 0) {
            console.log(`  Tier ${tierNum}: ${st.passed}/${st.total} passed, ${st.failed} failed`);
        }
    }
    console.log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed} | Duration: ${(totalMs / 1000).toFixed(2)}s`);

    if (failed > 0 || tests.length === 0) {
        process.exitCode = 1;
    }
}

runSuite().catch(async (err) => {
    console.error('E2E Runner fatal error:', err);
    await cleanupAllBrowsers().catch(() => {});
    await cleanupAllServers().catch(() => {});
    process.exit(1);
});
