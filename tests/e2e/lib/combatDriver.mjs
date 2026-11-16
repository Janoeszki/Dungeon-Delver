function parsePair(text) {
    if (!text) return { current: NaN, max: NaN };
    const m = String(text).match(/(\d+)\s*\/\s*(\d+)/);
    return m ? { current: parseInt(m[1], 10), max: parseInt(m[2], 10) } : { current: NaN, max: NaN };
}

export async function readCombatState(page) {
    const raw = await page.eval(() => {
        const modal = document.getElementById('combatModal');
        const open = Boolean(modal && getComputedStyle(modal).display !== 'none');
        if (!open) return { open: false };

        const vis = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };

        const c3d = document.querySelector('#combatViewport3D canvas');
        const logs = Array.from(document.querySelectorAll('#combatLogBox .combat-log-entry')).map((el) => ({
            text: el.textContent.trim(),
            className: el.className
        }));

        const roundText = document.getElementById('combatRoundText')?.textContent?.trim() || '';
        const roundMatch = roundText.match(/(\d+)/);

        const submenuButtons = Array.from(document.querySelectorAll('#combatSubmenu .combat-action-btn')).map((b, i) => ({
            index: i,
            text: b.textContent.replace(/\s+/g, ' ').trim(),
            disabled: Boolean(b.disabled),
            visible: getComputedStyle(b).display !== 'none'
        }));

        return {
            open: true,
            arenaTitle: document.getElementById('combatArenaTitle')?.textContent?.trim() || '',
            monsterName: document.getElementById('combatMonsterName')?.textContent?.trim() || '',
            monsterIcon: document.getElementById('combatMonsterIcon')?.textContent?.trim() || '',
            turnBadge: document.getElementById('combatTurnBadge')?.textContent?.trim() || '',
            roundText,
            round: roundMatch ? parseInt(roundMatch[1], 10) : 1,
            d20Val: document.getElementById('combatD20Val')?.textContent?.trim() || '',
            heroName: document.getElementById('combatHeroName')?.textContent?.trim() || '',
            heroHpText: document.getElementById('combatHeroHpVal')?.textContent?.trim() || '',
            heroMpText: document.getElementById('combatHeroMpVal')?.textContent?.trim() || '',
            heroAcText: document.getElementById('combatHeroAc')?.textContent?.trim() || '',
            heroBuffs: document.getElementById('combatHeroBuffs')?.textContent?.trim() || '',
            monsterHpText: document.getElementById('combatMonsterHpVal')?.textContent?.trim() || '',
            monsterAcText: document.getElementById('combatMonsterAc')?.textContent?.trim() || '',
            monsterBuffs: document.getElementById('combatMonsterBuffs')?.textContent?.trim() || '',
            canvasW: c3d ? c3d.width : 0,
            canvasH: c3d ? c3d.height : 0,
            actionsVisible: vis('#combatActionsPanel'),
            dismissVisible: vis('#btnDismissCombat'),
            dismissText: document.getElementById('btnDismissCombat')?.textContent?.trim() || '',
            directIds: {
                attack: vis('#btnAttack'),
                special: vis('#btnSpecial'),
                defend: vis('#btnDefend'),
                item: vis('#btnItem'),
                flee: vis('#btnFlee')
            },
            tabIds: {
                attack: vis('#btnTabAttack'),
                defend: vis('#btnTabDefend'),
                items: vis('#btnTabItems'),
                flee: vis('#btnTabFlee')
            },
            submenuButtons,
            logs
        };
    });

    if (!raw.open) return raw;
    const heroHp = parsePair(raw.heroHpText);
    const heroMp = parsePair(raw.heroMpText);
    const monsterHp = parsePair(raw.monsterHpText);
    const acMatch = raw.heroBuffs.match(/AC:\s*(\d+)/i);
    return {
        ...raw,
        heroHp: heroHp.current,
        heroMaxHp: heroHp.max,
        heroMp: heroMp.current,
        heroMaxMp: heroMp.max,
        monsterHp: monsterHp.current,
        monsterMaxHp: monsterHp.max,
        heroEffectiveAc: acMatch ? parseInt(acMatch[1], 10) : parseInt(raw.heroAcText, 10)
    };
}

export async function inspectCombatButtons(page) {
    const state = await readCombatState(page);
    if (!state.open) throw new Error('Combat modal is not open');

    if (state.directIds.attack) {
        return page.eval(() => {
            const read = (id) => {
                const el = document.getElementById(id);
                if (!el) return null;
                return { id, text: el.textContent.trim(), disabled: Boolean(el.disabled) };
            };
            return {
                mode: 'direct',
                attack: read('btnAttack'),
                special: read('btnSpecial'),
                defend: read('btnDefend'),
                item: read('btnItem'),
                flee: read('btnFlee')
            };
        });
    }

    // Two-step tabs: open attack tab to inspect basic & special buttons
    await page.click('#btnTabAttack');
    await page.sleep(80);
    const atkState = await readCombatState(page);
    return {
        mode: 'tabbed',
        attack: atkState.submenuButtons[0] || null,
        special: atkState.submenuButtons[1] || null,
        submenuButtons: atkState.submenuButtons
    };
}

export async function listCombatItems(page) {
    const state = await readCombatState(page);
    if (!state.open) throw new Error('Combat modal is not open');
    if (state.directIds.item) {
        await page.click('#btnItem');
        await page.sleep(80);
    } else {
        await page.click('#btnTabItems');
        await page.sleep(80);
    }
    const updated = await readCombatState(page);
    const emptyText = await page.eval(() => document.getElementById('combatSubmenu')?.textContent?.trim() || '');
    return { items: updated.submenuButtons, emptyText };
}

export async function triggerCombatAction(page, action, { itemName = null } = {}) {
    const state = await readCombatState(page);
    if (!state.open) throw new Error('Cannot trigger combat action: #combatModal is not open');
    if (state.dismissVisible) {
        throw new Error(`Combat already ended (${state.dismissText})`);
    }

    const prevRound = state.round;

    if (action === 'attack') {
        if (state.directIds.attack) {
            await page.click('#btnAttack');
        } else {
            await page.click('#btnTabAttack');
            await page.sleep(60);
            const box = await page.eval(() => {
                const btns = Array.from(document.querySelectorAll('#combatSubmenu .combat-action-btn'));
                const btn = btns[0];
                if (!btn || btn.disabled) return null;
                const r = btn.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            });
            if (!box) throw new Error('Basic attack button unavailable in #combatSubmenu');
            await page.clickAt(box.x, box.y);
        }
    } else if (action === 'special') {
        if (state.directIds.special) {
            await page.click('#btnSpecial');
        } else {
            await page.click('#btnTabAttack');
            await page.sleep(60);
            const info = await page.eval(() => {
                const btns = Array.from(document.querySelectorAll('#combatSubmenu .combat-action-btn'));
                const btn = btns[1];
                if (!btn) return { exists: false };
                const r = btn.getBoundingClientRect();
                return { exists: true, disabled: Boolean(btn.disabled), x: r.left + r.width / 2, y: r.top + r.height / 2 };
            });
            if (!info.exists) throw new Error('Special attack button missing in #combatSubmenu');
            if (info.disabled) throw new Error('Special attack button is disabled (insufficient MP)');
            await page.clickAt(info.x, info.y);
        }
    } else if (action === 'defend') {
        if (state.directIds.defend) {
            await page.click('#btnDefend');
        } else {
            await page.click('#btnTabDefend');
            await page.sleep(60);
            await page.click('#combatSubmenu .combat-action-btn');
        }
    } else if (action === 'item') {
        if (state.directIds.item) {
            await page.click('#btnItem');
            await page.sleep(60);
        } else {
            await page.click('#btnTabItems');
            await page.sleep(60);
        }
        const box = await page.eval((wanted) => {
            const btns = Array.from(document.querySelectorAll('#combatSubmenu .combat-action-btn'));
            if (btns.length === 0) return null;
            const target = wanted
                ? btns.find((b) => b.textContent.toLowerCase().includes(wanted.toLowerCase()))
                : btns[0];
            if (!target) return { missingWanted: true, available: btns.map((b) => b.textContent.trim()) };
            const r = target.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: target.textContent.trim() };
        }, itemName);
        if (!box) throw new Error('No consumable buttons available in #combatSubmenu');
        if (box.missingWanted) {
            throw new Error(`Requested consumable "${itemName}" not found. Available: ${box.available.join(', ')}`);
        }
        await page.clickAt(box.x, box.y);
    } else if (action === 'flee') {
        if (state.directIds.flee) {
            await page.click('#btnFlee');
        } else {
            await page.click('#btnTabFlee');
            await page.sleep(60);
            await page.click('#combatSubmenu .combat-action-btn');
        }
    } else {
        throw new Error(`Unknown combat action: ${action}`);
    }

    // Wait for either modal close (flee success), dismiss button (victory/defeat), or next player round
    await page.waitFor((prevR) => {
        const modal = document.getElementById('combatModal');
        if (!modal || getComputedStyle(modal).display === 'none') return 'fled';
        const dismiss = document.getElementById('btnDismissCombat');
        if (dismiss && getComputedStyle(dismiss).display !== 'none') return 'ended';
        const badge = document.getElementById('combatTurnBadge')?.textContent?.trim() || '';
        const rTxt = document.getElementById('combatRoundText')?.textContent?.trim() || '';
        const rm = rTxt.match(/(\d+)/);
        const curR = rm ? parseInt(rm[1], 10) : 1;
        // Ensure submenu isn't in "Waiting for turn resolution..." state
        const subBtn = document.querySelector('#combatSubmenu .combat-action-btn');
        if (badge === 'HERO TURN' && curR > prevR && subBtn) return 'next_turn';
        return false;
    }, {
        timeoutMs: 9000,
        intervalMs: 80,
        label: `combat turn resolution after ${action}`,
        args: [prevRound]
    });

    return readCombatState(page);
}

export async function runCombat(page, tactic = 'win', {
    maxRounds = 25,
    autoDismiss = true,
    itemName = null,
    lowHpRatio = 0.55
} = {}) {
    let state = await readCombatState(page);
    if (!state.open) throw new Error('runCombat called while #combatModal is closed');

    let usedItem = false;
    let rounds = 0;

    while (state.open && !state.dismissVisible && rounds < maxRounds) {
        rounds++;
        let action = 'attack';

        if (tactic === 'flee') {
            action = 'flee';
        } else if (tactic === 'defendOnly') {
            action = 'defend';
        } else if (tactic === 'lowHpThenFlee') {
            const threshold = Math.max(4, Math.floor(state.heroMaxHp * lowHpRatio));
            if (state.heroHp <= threshold) {
                action = 'flee';
            } else if (state.heroHp <= threshold + 14 || state.monsterHp <= 16) {
                // Guard stance halves incoming blows so HP lands gently inside threshold without dying or killing the monster
                action = 'defend';
            } else {
                action = 'attack';
            }
        } else if (tactic === 'lose') {
            // Avoid accidentally slaying the monster while taking hits until 0 HP
            if (state.monsterHp <= 18 || state.heroHp <= 36) {
                action = 'defend';
            } else {
                action = 'attack';
            }
        } else if (tactic === 'useItem' && !usedItem) {
            action = 'item';
            usedItem = true;
        } else {
            // 'win' tactic
            const btns = await inspectCombatButtons(page);
            const hpPct = state.heroHp / Math.max(1, state.heroMaxHp);
            if (hpPct < 0.32) {
                const { items } = await listCombatItems(page);
                const heal = items.find((it) => /healing potion/i.test(it.text));
                if (heal) {
                    action = 'item';
                    itemName = 'Healing Potion';
                }
            }
            if (action === 'attack' && btns.special && !btns.special.disabled && state.monsterHp > 12) {
                action = 'special';
            }
        }

        state = await triggerCombatAction(page, action, { itemName });

        if (!state.open) {
            return {
                outcome: 'fled',
                rounds,
                state
            };
        }
        if (state.dismissVisible) {
            break;
        }
    }

    if (!state.open) {
        return { outcome: 'fled', rounds, state };
    }
    if (!state.dismissVisible) {
        throw new Error(`Combat did not conclude within ${maxRounds} rounds (heroHp=${state.heroHp}, monsterHp=${state.monsterHp})`);
    }

    const isDefeat = /retreat|defeated|restore/i.test(state.dismissText)
        || state.logs.some((l) => /DEFEATED!/i.test(l.text));
    const outcome = isDefeat ? 'defeat' : 'victory';
    const finalState = state;

    if (autoDismiss) {
        await page.click('#btnDismissCombat');
        await page.waitFor(() => {
            const modal = document.getElementById('combatModal');
            return !modal || getComputedStyle(modal).display === 'none';
        }, { timeoutMs: 4000, label: '#combatModal dismissal' });
        await page.sleep(200);
    }

    return {
        outcome,
        rounds,
        state: finalState
    };
}
