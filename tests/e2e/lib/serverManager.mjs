import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
export const SERVER_ENTRY = path.join(REPO_ROOT, 'server.js');

const activeServers = new Set();
let hooksRegistered = false;

function registerCleanupHooks() {
    if (hooksRegistered) return;
    hooksRegistered = true;

    const killAllSync = () => {
        for (const proc of activeServers) {
            try {
                if (!proc.killed) proc.kill('SIGKILL');
            } catch {
                // ignore
            }
        }
        activeServers.clear();
    };

    process.once('exit', killAllSync);
    process.once('SIGINT', () => {
        killAllSync();
        if (!globalThis.__ddE2eRunnerHandlingSignals) {
            process.exit(130);
        }
    });
    process.once('SIGTERM', () => {
        killAllSync();
        if (!globalThis.__ddE2eRunnerHandlingSignals) {
            process.exit(143);
        }
    });
}

export function allocateFreePort(host = '127.0.0.1') {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, host, () => {
            const addr = srv.address();
            const port = typeof addr === 'object' && addr ? addr.port : 0;
            srv.close((err) => {
                if (err) reject(err);
                else resolve(port);
            });
        });
    });
}

export async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.unref();
        srv.once('error', () => resolve(false));
        srv.listen(port, () => {
            srv.close(() => resolve(true));
        });
    });
}

export async function allocateAdjacentFreePorts(host = '127.0.0.1', maxAttempts = 25) {
    for (let i = 0; i < maxAttempts; i++) {
        const p1 = await allocateFreePort(host);
        if ((await isPortAvailable(p1)) && (await isPortAvailable(p1 + 1))) {
            return [p1, p1 + 1];
        }
    }
    throw new Error('Unable to allocate two adjacent free TCP ports');
}

export async function waitForHttpReady(url, { timeoutMs = 10000, intervalMs = 50, child = null } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        if (child && child.exitCode !== null) {
            throw new Error(`Server exited early with code ${child.exitCode} while waiting for ${url}`);
        }
        try {
            const res = await fetch(url);
            if (res.status === 200) {
                await res.arrayBuffer();
                return;
            }
            lastError = new Error(`Unexpected status ${res.status} from ${url}`);
        } catch (err) {
            lastError = err;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timed out waiting for ${url} (${timeoutMs}ms): ${lastError ? lastError.message : 'unknown'}`);
}

export async function stopChildProcess(child, graceMs = 1500) {
    if (!child) return;
    activeServers.delete(child);
    if (child.exitCode !== null || child.signalCode !== null) return;

    await new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve();
        };
        child.once('exit', finish);
        try {
            child.kill('SIGTERM');
        } catch {
            finish();
            return;
        }
        const timer = setTimeout(() => {
            try {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGKILL');
                }
            } catch {
                // ignore
            }
            finish();
        }, graceMs);
    });
}

export async function startServer({
    port = null,
    readyPort = null,
    env = {},
    waitForReady = true,
    timeoutMs = 10000
} = {}) {
    registerCleanupHooks();

    const targetPort = port === null ? await allocateFreePort() : port;
    const checkPort = readyPort === null ? targetPort : readyPort;

    const child = spawn(process.execPath, [SERVER_ENTRY], {
        cwd: REPO_ROOT,
        env: {
            ...process.env,
            PORT: String(targetPort),
            ...env
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    activeServers.add(child);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
    });
    child.once('exit', () => {
        activeServers.delete(child);
    });

    const baseUrl = `http://127.0.0.1:${checkPort}`;
    if (waitForReady) {
        try {
            await waitForHttpReady(`${baseUrl}/`, { timeoutMs, child });
        } catch (err) {
            await stopChildProcess(child);
            throw new Error(`${err.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
        }
    }

    return {
        port: checkPort,
        requestedPort: targetPort,
        baseUrl,
        process: child,
        getLogs: () => ({ stdout, stderr }),
        stop: () => stopChildProcess(child)
    };
}

export async function cleanupAllServers() {
    const procs = Array.from(activeServers);
    await Promise.all(procs.map((p) => stopChildProcess(p)));
}
