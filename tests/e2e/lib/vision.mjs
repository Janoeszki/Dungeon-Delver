import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function hasPngMagicHeader(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIG);
}

function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

export function decodePng(buffer) {
    if (!hasPngMagicHeader(buffer)) {
        throw new Error('Invalid PNG buffer: missing PNG magic signature');
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idatChunks = [];

    while (offset + 8 <= buffer.length) {
        const len = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + len;
        if (dataEnd + 4 > buffer.length) break;

        if (type === 'IHDR') {
            width = buffer.readUInt32BE(dataStart);
            height = buffer.readUInt32BE(dataStart + 4);
            bitDepth = buffer[dataStart + 8];
            colorType = buffer[dataStart + 9];
            interlace = buffer[dataStart + 12];
        } else if (type === 'IDAT') {
            idatChunks.push(buffer.subarray(dataStart, dataEnd));
        } else if (type === 'IEND') {
            break;
        }
        offset = dataEnd + 4;
    }

    if (!width || !height || idatChunks.length === 0) {
        throw new Error('Malformed PNG: missing IHDR or IDAT chunks');
    }
    if (bitDepth !== 8 || interlace !== 0) {
        throw new Error(`Unsupported PNG format (bitDepth=${bitDepth}, interlace=${interlace})`);
    }

    let bpp;
    if (colorType === 6) bpp = 4; // RGBA
    else if (colorType === 2) bpp = 3; // RGB
    else if (colorType === 4) bpp = 2; // Grayscale + Alpha
    else if (colorType === 0) bpp = 1; // Grayscale
    else throw new Error(`Unsupported PNG colorType=${colorType}`);

    const raw = zlib.inflateSync(Buffer.concat(idatChunks));
    const stride = width * bpp;
    const expectedLen = height * (stride + 1);
    if (raw.length < expectedLen) {
        throw new Error(`PNG inflated data too short (${raw.length} < ${expectedLen})`);
    }

    const unfiltered = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
        const rowIn = y * (stride + 1);
        const filterType = raw[rowIn];
        const rowOut = y * stride;
        const prevOut = (y - 1) * stride;

        for (let x = 0; x < stride; x++) {
            const rawByte = raw[rowIn + 1 + x];
            const a = x >= bpp ? unfiltered[rowOut + x - bpp] : 0;
            const b = y > 0 ? unfiltered[prevOut + x] : 0;
            const c = (y > 0 && x >= bpp) ? unfiltered[prevOut + x - bpp] : 0;

            let val;
            switch (filterType) {
                case 0:
                    val = rawByte;
                    break;
                case 1:
                    val = (rawByte + a) & 0xff;
                    break;
                case 2:
                    val = (rawByte + b) & 0xff;
                    break;
                case 3:
                    val = (rawByte + ((a + b) >> 1)) & 0xff;
                    break;
                case 4:
                    val = (rawByte + paethPredictor(a, b, c)) & 0xff;
                    break;
                default:
                    throw new Error(`Unknown PNG filter type: ${filterType}`);
            }
            unfiltered[rowOut + x] = val;
        }
    }

    // Normalize to RGBA
    const rgba = new Uint8Array(width * height * 4);
    if (bpp === 4) {
        rgba.set(unfiltered);
    } else if (bpp === 3) {
        for (let i = 0, j = 0; i < unfiltered.length; i += 3, j += 4) {
            rgba[j] = unfiltered[i];
            rgba[j + 1] = unfiltered[i + 1];
            rgba[j + 2] = unfiltered[i + 2];
            rgba[j + 3] = 255;
        }
    } else if (bpp === 2) {
        for (let i = 0, j = 0; i < unfiltered.length; i += 2, j += 4) {
            const g = unfiltered[i];
            rgba[j] = g;
            rgba[j + 1] = g;
            rgba[j + 2] = g;
            rgba[j + 3] = unfiltered[i + 1];
        }
    } else {
        for (let i = 0, j = 0; i < unfiltered.length; i += 1, j += 4) {
            const g = unfiltered[i];
            rgba[j] = g;
            rgba[j + 1] = g;
            rgba[j + 2] = g;
            rgba[j + 3] = 255;
        }
    }

    return { width, height, data: rgba };
}

export function ensurePng(input) {
    if (Buffer.isBuffer(input)) return decodePng(input);
    if (input && input.width && input.height && input.data) return input;
    throw new Error('Expected PNG Buffer or decoded PNG object');
}

export function normRect(png, rx, ry, rw, rh) {
    const x0 = Math.max(0, Math.min(png.width - 1, Math.floor(rx * png.width)));
    const y0 = Math.max(0, Math.min(png.height - 1, Math.floor(ry * png.height)));
    const x1 = Math.max(x0 + 1, Math.min(png.width, Math.ceil((rx + rw) * png.width)));
    const y1 = Math.max(y0 + 1, Math.min(png.height, Math.ceil((ry + rh) * png.height)));
    return { x0, y0, x1, y1 };
}

export function computeMeanLuminance(pngInput, rect = null, step = 1) {
    const png = ensurePng(pngInput);
    const { x0, y0, x1, y1 } = rect
        ? {
            x0: Math.max(0, Math.floor(rect.x)),
            y0: Math.max(0, Math.floor(rect.y)),
            x1: Math.min(png.width, Math.ceil(rect.x + rect.width)),
            y1: Math.min(png.height, Math.ceil(rect.y + rect.height))
        }
        : { x0: 0, y0: 0, x1: png.width, y1: png.height };

    let sumLum = 0;
    let sumWarm = 0;
    let count = 0;
    let nonBlack = 0;
    let minLum = 255;
    let maxLum = 0;

    const { width, data } = png;
    for (let y = y0; y < y1; y += step) {
        const rowBase = y * width * 4;
        for (let x = x0; x < x1; x += step) {
            const idx = rowBase + x * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sumLum += lum;
            if (r > b + 12 && lum > 15) sumWarm++;
            if (lum > 8) nonBlack++;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
            count++;
        }
    }

    if (count === 0) {
        return { mean: 0, min: 0, max: 0, nonBlackRatio: 0, warmRatio: 0, count: 0 };
    }

    return {
        mean: sumLum / count,
        min: minLum,
        max: maxLum,
        nonBlackRatio: nonBlack / count,
        warmRatio: sumWarm / count,
        count
    };
}

export function computePatchLuminance(pngInput, cxNorm, cyNorm, radiusNorm = 0.08, step = 1) {
    const png = ensurePng(pngInput);
    const rx = Math.max(0, cxNorm - radiusNorm);
    const ry = Math.max(0, cyNorm - radiusNorm);
    const rw = Math.min(1 - rx, radiusNorm * 2);
    const rh = Math.min(1 - ry, radiusNorm * 2);
    const r = normRect(png, rx, ry, rw, rh);
    return computeMeanLuminance(png, {
        x: r.x0,
        y: r.y0,
        width: r.x1 - r.x0,
        height: r.y1 - r.y0
    }, step);
}

/**
 * Computes RMS pixel delta between two screenshots.
 * Optional includeRectNorm ({ rx, ry, rw, rh }) and excludeNormRects ([{ rx, ry, rw, rh }])
 * allow focusing on peripheral dungeon geometry while ignoring center hero/torch flicker & HUD.
 */
export function computeRmsDelta(pngInputA, pngInputB, {
    includeNorm = { rx: 0.02, ry: 0.18, rw: 0.96, rh: 0.56 },
    excludeNorms = [{ rx: 0.42, ry: 0.36, rw: 0.16, rh: 0.28 }],
    step = 2
} = {}) {
    const a = ensurePng(pngInputA);
    const b = ensurePng(pngInputB);
    if (a.width !== b.width || a.height !== b.height) {
        throw new Error(`Screenshot dimensions mismatch (${a.width}x${a.height} vs ${b.width}x${b.height})`);
    }

    const inc = normRect(a, includeNorm.rx, includeNorm.ry, includeNorm.rw, includeNorm.rh);
    const excs = (excludeNorms || []).map((r) => normRect(a, r.rx, r.ry, r.rw, r.rh));

    let sqSum = 0;
    let count = 0;
    const width = a.width;

    for (let y = inc.y0; y < inc.y1; y += step) {
        const rowBase = y * width * 4;
        for (let x = inc.x0; x < inc.x1; x += step) {
            let skip = false;
            for (let k = 0; k < excs.length; k++) {
                const ex = excs[k];
                if (x >= ex.x0 && x < ex.x1 && y >= ex.y0 && y < ex.y1) {
                    skip = true;
                    break;
                }
            }
            if (skip) continue;

            const idx = rowBase + x * 4;
            const dr = a.data[idx] - b.data[idx];
            const dg = a.data[idx + 1] - b.data[idx + 1];
            const db = a.data[idx + 2] - b.data[idx + 2];
            sqSum += (dr * dr + dg * dg + db * db) / 3;
            count++;
        }
    }

    if (count === 0) return 0;
    return Math.sqrt(sqSum / count);
}

/**
 * Measures red dominance along outer viewport borders (to detect low-HP crimson vignette / damage flash).
 */
export function computeBorderRedness(pngInput, stripPx = 18) {
    const png = ensurePng(pngInput);
    const { width, height, data } = png;
    let redExcessSum = 0;
    let redRatioHits = 0;
    let count = 0;

    for (let y = 0; y < height; y += 2) {
        const inVertStrip = y < stripPx || y >= height - stripPx;
        for (let x = 0; x < width; x += 2) {
            const inHorizStrip = x < stripPx || x >= width - stripPx;
            if (!inVertStrip && !inHorizStrip) continue;

            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const excess = Math.max(0, r - (g + b) * 0.5);
            redExcessSum += excess;
            if (r > 70 && r > g * 1.45 && r > b * 1.45) redRatioHits++;
            count++;
        }
    }

    return {
        meanRedExcess: count ? redExcessSum / count : 0,
        redPixelRatio: count ? redRatioHits / count : 0,
        count
    };
}

/**
 * Scans the playable 3D Adventure canvas band (between top HUD and bottom HUD)
 * for glowing gold (#ffcf40) or cyan (#38bdf8) beacon markers and clusters them into clickable centroids.
 */
export function findWalkableBeacons(pngInput, {
    playBand = { rx: 0.06, ry: 0.18, rw: 0.88, rh: 0.54 },
    excludeCenterHero = { rx: 0.45, ry: 0.40, rw: 0.10, rh: 0.22 },
    minClusterSize = 4
} = {}) {
    const png = ensurePng(pngInput);
    const band = normRect(png, playBand.rx, playBand.ry, playBand.rw, playBand.rh);
    const heroBox = excludeCenterHero
        ? normRect(png, excludeCenterHero.rx, excludeCenterHero.ry, excludeCenterHero.rw, excludeCenterHero.rh)
        : null;

    const hits = [];
    const { width, data } = png;

    for (let y = band.y0; y < band.y1; y += 3) {
        const rowBase = y * width * 4;
        for (let x = band.x0; x < band.x1; x += 3) {
            if (heroBox && x >= heroBox.x0 && x < heroBox.x1 && y >= heroBox.y0 && y < heroBox.y1) {
                continue;
            }
            const idx = rowBase + x * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Gold diamond (#ffcf40) or cyan beacon ring (#38bdf8)
            const isGoldBeacon = r > 210 && g > 170 && b < 110 && (r - b > 120);
            const isCyanBeacon = b > 200 && g > 155 && r < 110 && (b - r > 110);
            if (isGoldBeacon || isCyanBeacon) {
                hits.push({ x, y, weight: (r + g + b) / 3 });
            }
        }
    }

    // Simple radius clustering
    const clusters = [];
    const radiusSq = 28 * 28;
    for (const h of hits) {
        let matched = null;
        for (const c of clusters) {
            const dx = h.x - c.cx;
            const dy = h.y - c.cy;
            if (dx * dx + dy * dy <= radiusSq) {
                matched = c;
                break;
            }
        }
        if (matched) {
            matched.sumX += h.x;
            matched.sumY += h.y;
            matched.count += 1;
            matched.cx = matched.sumX / matched.count;
            matched.cy = matched.sumY / matched.count;
            matched.score += h.weight;
        } else {
            clusters.push({
                sumX: h.x,
                sumY: h.y,
                cx: h.x,
                cy: h.y,
                count: 1,
                score: h.weight
            });
        }
    }

    return clusters
        .filter((c) => c.count >= minClusterSize)
        .sort((a, b) => b.score - a.score)
        .map((c) => ({
            x: Math.round(c.cx),
            y: Math.round(c.cy),
            count: c.count,
            score: Math.round(c.score)
        }));
}
