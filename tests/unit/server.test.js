import { test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../../server.js';

async function withServer(fn) {
    await new Promise((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}`;
    try { await fn(base); } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
}

const get = (base, u) => fetch(base + u);

test('static serving allowlist and traversal protection', async () => {
    await withServer(async (base) => {
        for (const u of ['/', '/index.html', '/js/progression.js', '/vendor/three.module.js']) {
            assert.equal((await get(base, u)).status, 200, u);
        }
        for (const u of ['/.git/HEAD', '/server.js', '/PROJECT.md', '/package.json', '/tests/unit/combat.test.js', '/probe.js', '/.env']) {
            assert.equal((await get(base, u)).status, 404, u);
        }
        for (const u of ['/..%2f..%2f..%2fetc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/..%5c..%5cetc/passwd', '/%00', '/%zz']) {
            const s = (await get(base, u)).status;
            assert.ok(s === 400 || s === 404, `${u} -> ${s}`);
        }
        assert.notEqual((await get(base, '/../server.js')).status, 200);
    });
});

test('security headers are present', async () => {
    await withServer(async (base) => {
        for (const u of ['/index.html', '/api/progression', '/nope']) {
            const r = await get(base, u);
            assert.equal(r.headers.get('x-content-type-options'), 'nosniff', u);
            assert.equal(r.headers.get('x-frame-options'), 'DENY', u);
            assert.ok(r.headers.get('content-security-policy'), u);
        }
    });
});
