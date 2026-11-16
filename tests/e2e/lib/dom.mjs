export const SEL = {
    forgeBtn: '#btnStartForge, #btnCreator',
    encChoice: '#encOptionsList .encounter-choice-btn, #encOptionsList .choice-btn',
    encDismiss: '#btnDismissEncounter, #btnCloseEncounter',
    hudHp: '#hudHp, #advHpText',
    hudMp: '#hudMp, #advMpText',
    hudXp: '#hudXp, #advXp',
    hudGold: '#hudGold, #advGold',
    hudConsumables: '#hudConsumables, #advItemSlot',
    victoryModal: '#victoryModal'
};

function parsePair(text) {
    if (!text) return { current: NaN, max: NaN };
    const m = String(text).match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return { current: NaN, max: NaN };
    return { current: parseInt(m[1], 10), max: parseInt(m[2], 10) };
}

function parseIntFromText(text) {
    if (text === null || text === undefined) return NaN;
    const m = String(text).match(/-?\d+/);
    return m ? parseInt(m[0], 10) : NaN;
}

export async function isElementVisible(page, selector) {
    return page.eval((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const st = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return st.display !== 'none' && st.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }, selector);
}

export async function assertTitleVisible(page) {
    const state = await page.eval(() => {
        const vis = (id) => {
            const el = document.getElementById(id);
            return el ? getComputedStyle(el).display !== 'none' : false;
        };
        const c = document.querySelector('#viewportStart canvas');
        return {
            start: vis('screenStart'),
            header: vis('mainHeader'),
            creator: vis('screenCreator'),
            adventure: vis('screenAdventure'),
            canvasW: c ? c.width : 0,
            canvasH: c ? c.height : 0
        };
    });
    if (!state.start) throw new Error('Expected #screenStart to be visible');
    if (state.header) throw new Error('Expected #mainHeader to be hidden on Title screen');
    if (state.creator) throw new Error('Expected #screenCreator to be hidden on Title screen');
    if (state.adventure) throw new Error('Expected #screenAdventure to be hidden on Title screen');
    if (state.canvasW <= 0 || state.canvasH <= 0) {
        throw new Error(`Expected #viewportStart canvas rendered, got ${state.canvasW}x${state.canvasH}`);
    }
    return state;
}

export async function openForge(page) {
    await page.click(SEL.forgeBtn);
    await page.waitFor(() => {
        const sc = document.getElementById('screenCreator');
        const hd = document.getElementById('mainHeader');
        const c = document.querySelector('#viewportCreator canvas');
        return sc && getComputedStyle(sc).display !== 'none'
            && hd && getComputedStyle(hd).display !== 'none'
            && c && c.width > 0 && c.height > 0;
    }, { timeoutMs: 8000, label: '#screenCreator + #viewportCreator canvas' });
    await page.sleep(250);
}

export async function forgeHero(page, opts = {}) {
    const {
        name = null,
        ancestry = null,
        charClass = null,
        bodyType = null,
        hairStyle = null,
        beardStyle = null,
        showHelm = null,
        skinColor = null,
        hairColor = null,
        armorColor = null,
        enterDungeon = true
    } = opts;

    const onCreator = await isElementVisible(page, '#screenCreator');
    if (!onCreator) {
        await openForge(page);
    }

    if (name !== null) {
        await page.type('#heroNameInput', name, { clear: true });
    }
    if (ancestry !== null) {
        await page.click(`[data-ancestry="${ancestry}"]`);
    }
    if (charClass !== null) {
        await page.click(`[data-class="${charClass}"]`);
    }
    if (bodyType !== null) {
        await page.click(`[data-body-type="${bodyType}"]`);
    }
    if (hairStyle !== null) {
        await page.click(`[data-hair-style="${hairStyle}"]`);
    }
    if (beardStyle !== null) {
        await page.click(`[data-beard-style="${beardStyle}"]`);
    }
    if (showHelm !== null) {
        const current = await page.eval(() => Boolean(document.getElementById('checkHelm')?.checked));
        if (current !== Boolean(showHelm)) {
            await page.click('#checkHelm');
        }
    }
    if (skinColor !== null) {
        await page.click(`#skinPalette .color-dot[data-color="${skinColor}"]`);
    }
    if (hairColor !== null) {
        await page.click(`#hairPalette .color-dot[data-color="${hairColor}"]`);
    }
    if (armorColor !== null) {
        await page.click(`#armorPalette .color-dot[data-color="${armorColor}"]`);
    }

    await page.sleep(220);

    if (enterDungeon) {
        await page.click('#btnEnterDungeon');
        await waitForAdventureReady(page);
    }
}

export async function waitForAdventureReady(page, timeoutMs = 12000) {
    await page.waitFor(() => {
        const adv = document.getElementById('screenAdventure');
        const c = document.querySelector('#viewportAdventure canvas');
        return adv && getComputedStyle(adv).display !== 'none' && c && c.width > 0 && c.height > 0;
    }, { timeoutMs, label: '#screenAdventure + #viewportAdventure canvas' });
    await page.sleep(220);
}

export async function quickDelve(page) {
    await page.click('#btnQuickDelve');
    await waitForAdventureReady(page);
}

export async function returnToForge(page) {
    await page.click('#btnSwitchMode');
    await page.waitFor(() => {
        const sc = document.getElementById('screenCreator');
        const c = document.querySelector('#viewportCreator canvas');
        return sc && getComputedStyle(sc).display !== 'none' && c && c.width > 0;
    }, { timeoutMs: 8000, label: 'return to #screenCreator' });
    await page.sleep(250);
}

export async function returnToTitle(page) {
    await page.click('#btnReturnTitle');
    await page.waitFor(() => {
        const st = document.getElementById('screenStart');
        const hd = document.getElementById('mainHeader');
        return st && getComputedStyle(st).display !== 'none' && (!hd || getComputedStyle(hd).display === 'none');
    }, { timeoutMs: 8000, label: 'return to #screenStart' });
    await page.sleep(250);
}

export async function readCreatorStats(page) {
    return page.eval(() => {
        const text = (id) => document.getElementById(id)?.textContent?.trim() || '';
        const intVal = (id) => parseInt(text(id), 10);
        const activeAttr = (sel, attr) => document.querySelector(`${sel}.active`)?.getAttribute(attr) || null;
        const elAnc = document.getElementById('heroAncestryClassBadge')
            || document.getElementById('heroancestryClassBadge')
            || document.getElementById('heroRaceClassBadge');
        const elPerkTitle = document.getElementById('racialPerkTitle')
            || document.getElementById('ancestryPerkTitle');
        const elPerkDesc = document.getElementById('racialPerkDesc')
            || document.getElementById('ancestryPerkDesc');
        return {
            nameInput: document.getElementById('heroNameInput')?.value ?? '',
            nameBadge: text('heroNameBadge'),
            ancestryClassBadge: elAnc?.textContent?.trim() || '',
            ancestry: activeAttr('[data-ancestry]', 'data-ancestry'),
            charClass: activeAttr('[data-class]', 'data-class'),
            bodyType: activeAttr('[data-body-type]', 'data-body-type'),
            hairStyle: activeAttr('[data-hair-style]', 'data-hair-style'),
            beardStyle: activeAttr('[data-beard-style]', 'data-beard-style'),
            showHelm: Boolean(document.getElementById('checkHelm')?.checked),
            skinColor: activeAttr('#skinPalette .color-dot', 'data-color'),
            hairColor: activeAttr('#hairPalette .color-dot', 'data-color'),
            armorColor: activeAttr('#armorPalette .color-dot', 'data-color'),
            hp: intVal('statHpVal'),
            mp: intVal('statMpVal'),
            str: intVal('statStrVal'),
            vit: intVal('statVitVal'),
            agi: intVal('statAgiVal'),
            int: intVal('statIntVal'),
            hpBarWidth: document.getElementById('statHpBar')?.style.width || '',
            mpBarWidth: document.getElementById('statMpBar')?.style.width || '',
            racialPerkTitle: elPerkTitle?.textContent?.trim() || '',
            racialPerkDesc: elPerkDesc?.textContent?.trim() || '',
            classAbilityTitle: text('classAbilityTitle'),
            classAbilityDesc: text('classAbilityDesc')
        };
    });
}

export async function readAdventureHud(page) {
    const raw = await page.eval((sel) => {
        const query = (s) => document.querySelector(s);
        const isVis = (el) => {
            if (!el) return false;
            const st = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };

        const hpEl = query(sel.hudHp);
        const mpEl = query(sel.hudMp);
        const xpEl = query(sel.hudXp);
        const goldEl = query(sel.hudGold);
        const itemEl = query(sel.hudConsumables);
        const roomEl = document.getElementById('hudRoom');
        const screenAdv = document.getElementById('screenAdventure');

        const logs = Array.from(document.querySelectorAll('#advLog .log-msg')).map((el) => ({
            text: el.textContent.trim(),
            className: el.className,
            isDread: el.classList.contains('dread')
        }));

        const advStyle = screenAdv ? getComputedStyle(screenAdv) : null;
        const dangerEls = Array.from(document.querySelectorAll(
            '#screenAdventure, .adventure-vignette, #adventureVignette, #lowHpVignette, .damage-vignette, .vignette'
        )).map((el) => ({
            id: el.id,
            className: el.className,
            animationName: getComputedStyle(el).animationName,
            borderColor: getComputedStyle(el).borderColor,
            boxShadow: getComputedStyle(el).boxShadow,
            backgroundImage: getComputedStyle(el).backgroundImage,
            opacity: getComputedStyle(el).opacity
        }));

        return {
            heroName: document.getElementById('advHeroName')?.textContent?.trim() || '',
            heroClass: document.getElementById('advHeroClass')?.textContent?.trim() || '',
            hpText: hpEl?.textContent?.trim() || '',
            mpText: mpEl?.textContent?.trim() || '',
            xpText: xpEl?.textContent?.trim() || '',
            goldText: goldEl?.textContent?.trim() || '',
            consumableText: itemEl?.textContent?.trim() || '',
            roomExists: Boolean(roomEl),
            roomVisible: isVis(roomEl),
            roomText: roomEl?.textContent?.trim() || '',
            canvasCount: document.querySelectorAll('#viewportAdventure canvas').length,
            screenAdvClass: screenAdv?.className || '',
            screenAdvBorder: advStyle?.borderColor || '',
            screenAdvBoxShadow: advStyle?.boxShadow || '',
            dangerEls,
            logs
        };
    }, SEL);

    const hp = parsePair(raw.hpText);
    const mp = parsePair(raw.mpText);
    return {
        ...raw,
        hp: hp.current,
        maxHp: hp.max,
        mp: mp.current,
        maxMp: mp.max,
        xp: parseIntFromText(raw.xpText),
        gold: parseIntFromText(raw.goldText),
        dreadLogs: raw.logs.filter((l) => l.isDread).map((l) => l.text)
    };
}

export async function requireRoomBanner(page, timeoutMs = 1500) {
    const start = Date.now();
    const deadline = start + timeoutMs;
    while (Date.now() < deadline) {
        const hud = await readAdventureHud(page);
        if (hud.roomExists && hud.roomVisible && hud.roomText.length > 0) {
            return hud.roomText;
        }
        // Fail fast if #hudRoom does not exist at all after Adventure has settled
        if (!hud.roomExists && Date.now() - start >= 300) {
            break;
        }
        await page.sleep(80);
    }
    const hud = await readAdventureHud(page);
    if (!hud.roomExists) {
        throw new Error('Missing M5 contract [#hudRoom]: Room banner element #hudRoom does not exist in #screenAdventure');
    }
    if (!hud.roomVisible) {
        throw new Error('M5 contract failure [#hudRoom]: #hudRoom exists but is not visible');
    }
    throw new Error('M5 contract failure [#hudRoom]: #hudRoom is visible but has empty text');
}

export async function requireDreadLogs(page, minCount = 1) {
    const hud = await readAdventureHud(page);
    if (hud.dreadLogs.length < minCount) {
        throw new Error(
            `Missing M5 contract [.log-msg.dread]: Expected >= ${minCount} dread room whisper(s) in #advLog, found ${hud.dreadLogs.length}`
        );
    }
    return hud.dreadLogs;
}

export async function detectOpenModal(page) {
    return page.eval(() => {
        const isVis = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            return getComputedStyle(el).display !== 'none';
        };
        if (isVis('victoryModal')) return 'victory';
        if (isVis('combatModal')) return 'combat';
        if (isVis('encounterModal')) {
            const title = document.getElementById('encTitle')?.textContent || '';
            const story = document.getElementById('encStory')?.textContent || '';
            const res = document.getElementById('rollResultText')?.textContent || '';
            const banner = document.getElementById('rollOutcomeBanner')?.textContent || '';
            const combined = `${title} ${story} ${res} ${banner}`;
            const hasReplayBtn = Boolean(document.querySelector('#victoryPlayAgain, #btnPlayAgain, #btnNewDelve'));
            if (hasReplayBtn || /floor 1 complete|escaped the floor|exit victory|ascend.*victory/i.test(combined)) {
                return 'victory';
            }
            return 'encounter';
        }
        if (isVis('loreModal')) return 'lore';
        return null;
    });
}

export async function readVictoryUi(page) {
    return page.eval(() => {
        const vm = document.getElementById('victoryModal');
        const em = document.getElementById('encounterModal');
        const vmVis = vm && getComputedStyle(vm).display !== 'none';
        const emVis = em && getComputedStyle(em).display !== 'none';
        const container = vmVis ? vm : (emVis ? em : null);
        if (!container) return { open: false, text: '', buttons: [] };
        const buttons = Array.from(container.querySelectorAll('button'))
            .filter((b) => getComputedStyle(b).display !== 'none')
            .map((b) => ({
                id: b.id,
                text: b.textContent.trim(),
                className: b.className
            }));
        return {
            open: true,
            modalId: container.id,
            text: container.textContent.replace(/\s+/g, ' ').trim(),
            buttons
        };
    });
}

export async function clickVictoryAction(page, kind = 'playAgain') {
    const info = await readVictoryUi(page);
    if (!info.open) {
        throw new Error('Cannot click victory action: Victory UI is not open');
    }
    const matcher = kind === 'title'
        ? /title|menu|gate/i
        : /play again|new delve|delve again|restart|replay/i;
    const match = info.buttons.find((b) => matcher.test(b.text) || matcher.test(b.id));
    if (!match) {
        throw new Error(`Victory UI missing '${kind}' button. Found buttons: ${JSON.stringify(info.buttons)}`);
    }
    if (match.id) {
        await page.click(`#${match.id}`);
    } else {
        const box = await page.eval((modalId, targetText) => {
            const c = document.getElementById(modalId);
            const btn = Array.from(c.querySelectorAll('button')).find((b) => b.textContent.trim() === targetText);
            if (!btn) return null;
            btn.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
            const r = btn.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
        }, info.modalId, match.text);
        if (!box || box.width <= 0) {
            throw new Error(`Victory button "${match.text}" has invalid bounding box`);
        }
        await page.clickAt(box.x, box.y);
    }
    await page.sleep(300);
}

export async function readModalDisplays(page) {
    return page.eval(() => {
        const disp = (id) => {
            const el = document.getElementById(id);
            return el ? getComputedStyle(el).display : 'missing';
        };
        return {
            encounter: disp('encounterModal'),
            combat: disp('combatModal'),
            victory: disp('victoryModal'),
            lore: disp('loreModal')
        };
    });
}
