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
    '.mp3': 'audio/mpeg'
};

export function handleRequest(req, res) {
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

    const safePath = path.normalize(decodeURIComponent(reqUrl)).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
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
