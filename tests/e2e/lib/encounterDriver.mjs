import { SEL, detectOpenModal, isElementVisible } from './dom.mjs';

export function parseCheckBadge(text) {
    if (!text) return { stat: null, mod: 0, dc: 10 };
    const m = String(text).match(/\[([A-Za-z]+)\s*([+-]?\d+)\s*vs\s*DC\s*(\d+)\]/i);
    if (!m) return { stat: null, mod: 0, dc: 10 };
    return {
        stat: m[1].toUpperCase(),
        mod: parseInt(m[2], 10),
        dc: parseInt(m[3], 10)
    };
}

export async function readEncounterModal(page) {
    const info = await page.eval((choiceSel) => {
        const modal = document.getElementById('encounterModal');
        const open = Boolean(modal && getComputedStyle(modal).display !== 'none');
        if (!open) return { open: false };

        const options = Array.from(document.querySelectorAll(choiceSel)).map((btn, idx) => {
            const badge = btn.querySelector('.check-badge')?.textContent?.trim() || '';
            return {
                index: idx,
                text: btn.textContent.replace(/\s+/g, ' ').trim(),
                badgeText: badge,
                visible: getComputedStyle(btn).display !== 'none',
                disabled: Boolean(btn.disabled)
            };
        });

        const stage = document.getElementById('diceRollStage');
        const banner = document.getElementById('rollOutcomeBanner');
        const dismiss = document.querySelector('#btnDismissEncounter, #btnCloseEncounter');

        return {
            open: true,
            icon: document.getElementById('encIcon')?.textContent?.trim() || '',
            title: document.getElementById('encTitle')?.textContent?.trim() || '',
            story: document.getElementById('encStory')?.textContent?.trim() || '',
            options,
            optionsVisible: document.getElementById('encOptionsList')
                ? getComputedStyle(document.getElementById('encOptionsList')).display !== 'none'
                : false,
            diceStageVisible: stage ? getComputedStyle(stage).display !== 'none' : false,
            rawRollText: document.getElementById('d20Value')?.textContent?.trim() || '',
            rollFormula: document.getElementById('rollFormula')?.textContent?.trim() || '',
            outcomeBanner: banner?.textContent?.trim() || '',
            outcomeClass: banner?.className || '',
            resultText: document.getElementById('rollResultText')?.textContent?.trim() || '',
            dismissVisible: dismiss ? getComputedStyle(dismiss).display !== 'none' : false
        };
    }, SEL.encChoice);

    if (info.open && info.options) {
        info.options = info.options.map((o) => ({
            ...o,
            ...parseCheckBadge(o.badgeText || o.text)
        }));
        info.kind = classifyEncounter(info);
    }
    return info;
}

export function classifyEncounter(info) {
    const combined = `${info.title || ''} ${info.story || ''} ${(info.options || []).map((o) => o.text).join(' ')}`;
    if (/floor\s*1\s*(exit|seal|stairs|ascend|complete)|escaped the floor|exit victory|crown vault/i.test(combined)) {
        return 'exit';
    }
    if (/portcullis|locked door|heavy.*door|iron gate|barred door|seal.*door|pick.*lock|force.*gate|gate/i.test(combined)) {
        return 'door';
    }
    if (/trap|spike|pit|scythe|pendulum|dart|blood\s*rune|tripwire|snare|disarm/i.test(combined)) {
        return 'trap';
    }
    if (/fountain|font|shrine|monolith|sarcophagus|altar|chest/i.test(combined)) {
        return 'shrine';
    }
    return 'other';
}

export function pickOption(options, strategy = 'optimal') {
    if (!options || options.length === 0) {
        throw new Error('Encounter modal has no selectable option buttons');
    }
    if (strategy.startsWith('stat:')) {
        const wanted = strategy.slice(5).toUpperCase();
        const found = options.find((o) => o.stat && o.stat.startsWith(wanted));
        if (found) return found;
    }
    if (strategy === 'weakest') {
        return [...options].sort((a, b) => (b.dc - b.mod) - (a.dc - a.mod))[0];
    }
    // optimal: lowest (dc - mod)
    return [...options].sort((a, b) => (a.dc - a.mod) - (b.dc - b.mod))[0];
}

export async function resolveEncounterModal(page, {
    strategy = 'optimal',
    doubleClick = false,
    dismiss = true,
    timeoutMs = 6000
} = {}) {
    const before = await readEncounterModal(page);
    if (!before.open) {
        throw new Error('resolveEncounterModal called while #encounterModal is closed');
    }

    const chosen = pickOption(before.options, strategy);
    const prevLogCount = await page.eval(() => document.querySelectorAll('#advLog .log-msg').length);

    // Compute exact button bounding box and click via real CDP mouse input
    const box = await page.eval((choiceSel, idx) => {
        const btns = Array.from(document.querySelectorAll(choiceSel));
        const btn = btns[idx];
        if (!btn) return null;
        btn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
    }, SEL.encChoice, chosen.index);

    if (!box || box.width <= 0) {
        throw new Error(`Encounter option button #${chosen.index} not clickable`);
    }

    await page.clickAt(box.x, box.y);
    if (doubleClick) {
        await page.sleep(25);
        await page.clickAt(box.x, box.y);
    }

    // Wait for D20 animation to finish and dismiss button to appear
    await page.waitFor((dismissSel) => {
        const btn = document.querySelector(dismissSel);
        return Boolean(btn && getComputedStyle(btn).display !== 'none');
    }, {
        timeoutMs,
        intervalMs: 70,
        label: 'encounter D20 roll completion',
        args: [SEL.encDismiss]
    });

    const after = await readEncounterModal(page);
    const logsAdded = await page.eval((prev) => {
        const msgs = Array.from(document.querySelectorAll('#advLog .log-msg'));
        const delta = msgs.length - prev;
        return msgs.slice(0, Math.max(0, delta)).map((el) => ({
            text: el.textContent.trim(),
            className: el.className
        }));
    }, prevLogCount);

    const rawRoll = parseInt(after.rawRollText, 10);
    const isNat20 = rawRoll === 20 || /natural 20/i.test(after.outcomeBanner);
    const isNat1 = rawRoll === 1 || /natural 1/i.test(after.outcomeBanner);
    const success = /outcome-crit|outcome-success/i.test(after.outcomeClass)
        || /passed|critical success/i.test(after.outcomeBanner);

    // Verify D20 math if log line carries formula `(raw + mod = total vs DC dc)`
    let parsedMath = null;
    for (const l of logsAdded) {
        const m = l.text.match(/\((\d+)\s*\+\s*([+-]?\d+)\s*=\s*(-?\d+)\s*vs\s*DC\s*(\d+)\)/i);
        if (m) {
            parsedMath = {
                raw: parseInt(m[1], 10),
                mod: parseInt(m[2], 10),
                total: parseInt(m[3], 10),
                dc: parseInt(m[4], 10)
            };
            break;
        }
    }

    if (dismiss) {
        await page.click(SEL.encDismiss);
        await page.waitFor(() => {
            const modal = document.getElementById('encounterModal');
            return !modal || getComputedStyle(modal).display === 'none';
        }, { timeoutMs: 3000, label: '#encounterModal dismissal' });
        await page.sleep(150);
    }

    return {
        kind: before.kind,
        title: before.title,
        story: before.story,
        options: before.options,
        chosen,
        rawRoll,
        parsedMath,
        rollFormula: after.rollFormula,
        outcomeBanner: after.outcomeBanner,
        outcomeClass: after.outcomeClass,
        resultText: after.resultText,
        success,
        isNat20,
        isNat1,
        logsAdded,
        modalStillOpen: (await detectOpenModal(page)) === 'encounter'
    };
}

export async function dismissEncounterIfOpen(page) {
    if (await isElementVisible(page, '#encounterModal')) {
        if (await isElementVisible(page, SEL.encDismiss)) {
            await page.click(SEL.encDismiss);
            await page.sleep(150);
        }
    }
}
