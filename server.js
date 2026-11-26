import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    HTTPCookie,
    createDefaultProgressionState,
    sanitizeProgressionState
} from './js/progression.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const ROOT = path.resolve(__dirname);
const DIST_DIR = path.resolve(ROOT, 'dist', 'dungeon-delver', 'browser');

// Only these paths are served statically. Everything else (.git, server.js,
// tests/, *.md, src/, scripts) returns 404.
const PUBLIC_FILES = new Set([
    'dungeon_delver_logo_small.png',
    'dungeon_delver_chronicles-of-phusza.png'
]);
const PUBLIC_DIRS = ['js', 'vendor'];

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "media-src 'self' data: blob:",
        "worker-src 'self' blob:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'"
    ].join('; ')
};

// Returns an absolute path inside baseDir, or null if the URL is malformed or escapes baseDir.
export function resolveSafeIn(baseDir, reqUrl) {
    let decoded;
    try {
        decoded = decodeURIComponent(reqUrl);
    } catch {
        return null;
    }
    if (decoded.includes('\0') || decoded.includes('\\')) return null;

    const filePath = path.resolve(baseDir, '.' + decoded);
    if (!filePath.startsWith(baseDir + path.sep)) return null;
    return filePath;
}

export function resolveSafe(reqUrl) {
    return resolveSafeIn(ROOT, reqUrl);
}

function isPublic(filePath) {
    const rel = path.relative(ROOT, filePath).split(path.sep);
    if (rel.some((seg) => seg.startsWith('.'))) return false;
    if (rel.length === 1) return PUBLIC_FILES.has(rel[0]);
    return PUBLIC_DIRS.includes(rel[0]);
}

function isDistPublic(filePath) {
    const rel = path.relative(DIST_DIR, filePath).split(path.sep);
    return !rel.some((seg) => seg.startsWith('.'));
}

export function handleRequest(req, res) {
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (status, headers = {}) => origWriteHead(status, { ...SECURITY_HEADERS, ...headers });

    let reqUrl = (req.url || '/').split('?')[0];

    if (reqUrl === '/api/progression') {
        const cookieHeader = req.headers?.cookie || '';

        if (req.method === 'GET') {
            const state = HTTPCookie.loadProgression(cookieHeader);
            const setCookies = HTTPCookie.toSetCookieHeaders(state);
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Set-Cookie': setCookies
            });
            res.end(JSON.stringify({ ok: true, state }));
            return;
        }

        if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => {
                bodyStr += chunk.toString('utf8');
                if (bodyStr.length > 65536) {
                    req.destroy();
                }
            });
            req.on('end', () => {
                let parsedBody = {};
                if (bodyStr.trim()) {
                    try {
                        parsedBody = JSON.parse(bodyStr);
                    } catch {
                        res.writeHead(400, {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Cache-Control': 'no-cache'
                        });
                        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
                        return;
                    }
                }

                let nextState;
                if (parsedBody && parsedBody.action === 'reset') {
                    nextState = createDefaultProgressionState();
                } else {
                    const current = HTTPCookie.loadProgression(cookieHeader);
                    const incoming = (parsedBody && typeof parsedBody.state === 'object' && parsedBody.state !== null)
                        ? parsedBody.state
                        : parsedBody;
                    nextState = sanitizeProgressionState({ ...current, ...incoming });
                }

                const setCookies = HTTPCookie.toSetCookieHeaders(nextState);
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Set-Cookie': setCookies
                });
                res.end(JSON.stringify({ ok: true, state: nextState }));
            });
            return;
        }

        if (req.method === 'DELETE') {
            const resetState = createDefaultProgressionState();
            const setCookies = HTTPCookie.toSetCookieHeaders(resetState);
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Set-Cookie': setCookies
            });
            res.end(JSON.stringify({ ok: true, state: resetState }));
            return;
        }

        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
        return;
    }

    if (reqUrl === '/') reqUrl = '/index.html';

    const distPath = resolveSafeIn(DIST_DIR, reqUrl);
    const rootPath = resolveSafe(reqUrl);
    if (!distPath && !rootPath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
        return;
    }

    const serveFile = (targetPath) => {
        const ext = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(targetPath);
        stream.pipe(res);
    };

    const tryRootFallback = () => {
        if (!rootPath) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        fs.stat(rootPath, (err, stats) => {
            if (err || !stats.isFile() || !isPublic(rootPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }
            serveFile(rootPath);
        });
    };

    if (distPath && isDistPublic(distPath)) {
        fs.stat(distPath, (err, stats) => {
            if (!err && stats.isFile()) {
                serveFile(distPath);
                return;
            }
            tryRootFallback();
        });
        return;
    }

    tryRootFallback();
}

export const server = http.createServer(handleRequest);

export function startServer(port = DEFAULT_PORT) {
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} in use, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, () => {
        console.log(`===============================================`);
        console.log(`🏰 Dungeon Crawl dev server is live!`);
        console.log(`👉 Open http://localhost:${port} in your browser`);
        console.log(`===============================================`);
    });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMainModule) {
    startServer(DEFAULT_PORT);
}
