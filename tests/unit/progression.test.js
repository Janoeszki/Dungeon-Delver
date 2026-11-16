import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as THREE from '../../vendor/three.module.js';
import {
    COOKIE_NAME,
    GOLD_COOKIE_NAME,
    EXP_COOKIE_NAME,
    SHOP_ARMOR,
    SHOP_WEAPONS,
    SHOP_SPELLS,
    SHOP_ANCESTRIES,
    STARTER_ANCESTRIES,
    ALL_ANCESTRIES,
    ANCESTRY_STAT_UPGRADE_CONFIG,
    HTTPCookie,
    ProgressionManager,
    createDefaultProgressionState,
    sanitizeProgressionState
} from '../../js/progression.js';
import { ANCESTRY_DATA, CLASS_DATA, calculateStats } from '../../js/stats.js';
import { CharacterBuilder } from '../../js/characterBuilder.js';
import { SPELLS, resolvePlayerSpell } from '../../js/combat.js';
import { handleRequest } from '../../server.js';

describe('HTTPCookie persistence & cookie header serialization', () => {
    beforeEach(() => {
        HTTPCookie.clearAll();
    });

    it('serializes and parses HTTP Cookie headers accurately', () => {
        const serialized = HTTPCookie.serialize('dd_gold', '250', { path: '/', maxAge: 3600, sameSite: 'Lax' });
        assert.match(serialized, /^dd_gold=250; Path=\/; Max-Age=3600; SameSite=Lax$/);

        const parsed = HTTPCookie.parse('dd_gold=250; dd_exp=480; custom_key=hello%20world');
        assert.equal(parsed.dd_gold, '250');
        assert.equal(parsed.dd_exp, '480');
        assert.equal(parsed.custom_key, 'hello world');
    });

    it('persists and loads full progression state plus dd_gold and dd_exp companion cookies', () => {
        const customState = createDefaultProgressionState();
        customState.gold = 340;
        customState.exp = 520;
        customState.ownedArmor.push('steel_plate');
        customState.equippedArmor = 'steel_plate';
        customState.ownedWeapons.push('runed_broadsword');
        customState.equippedWeapon = 'runed_broadsword';
        customState.ownedSpells.push('frost_nova');
        customState.unlockedAncestries.push('dragonborn');
        customState.ancestryStatBoosts.dragonborn.str = 3;
        customState.ancestryStatBoosts.dragonborn.vit = 2;

        HTTPCookie.saveProgression(customState);

        assert.equal(HTTPCookie.get(GOLD_COOKIE_NAME), '340');
        assert.equal(HTTPCookie.get(EXP_COOKIE_NAME), '520');
        assert.ok(HTTPCookie.get(COOKIE_NAME));

        const reloaded = HTTPCookie.loadProgression();
        assert.equal(reloaded.gold, 340);
        assert.equal(reloaded.exp, 520);
        assert.equal(reloaded.equippedArmor, 'steel_plate');
        assert.equal(reloaded.equippedWeapon, 'runed_broadsword');
        assert.deepEqual(reloaded.ownedSpells, ['frost_nova']);
        assert.ok(reloaded.unlockedAncestries.includes('dragonborn'));
        assert.deepEqual(reloaded.ancestryStatBoosts.dragonborn, { str: 3, agi: 0, int: 0, vit: 2 });
    });

    it('honors dd_gold and dd_exp cookies from raw HTTP Cookie header string', () => {
        const loaded = HTTPCookie.loadProgression('dd_gold=775; dd_exp=910');
        assert.equal(loaded.gold, 775);
        assert.equal(loaded.exp, 910);
        assert.equal(loaded.equippedArmor, 'iron_chainmail');
        assert.equal(loaded.equippedWeapon, 'iron_longsword');
    });

    it('sanitizes corrupted or out-of-range progression payloads safely', () => {
        const dirty = sanitizeProgressionState({
            gold: -50,
            exp: 'not-a-number',
            ownedArmor: ['nonexistent_armor', 'mithril_hauberk'],
            equippedArmor: 'nonexistent_armor',
            ownedWeapons: ['phusza_soulreaver'],
            equippedWeapon: 'unowned_sword',
            ownedSpells: ['frost_nova', 'fake_spell'],
            unlockedAncestries: ['tiefling', 'invalid_race'],
            ancestryStatBoosts: {
                human: { str: 99, agi: -4, int: 2, vit: 1 }
            }
        });

        assert.equal(dirty.gold, 0);
        assert.equal(dirty.exp, 0);
        assert.deepEqual(dirty.ownedArmor, ['iron_chainmail', 'mithril_hauberk']);
        assert.equal(dirty.equippedArmor, 'iron_chainmail');
        assert.deepEqual(dirty.ownedWeapons, ['iron_longsword', 'phusza_soulreaver']);
        assert.equal(dirty.equippedWeapon, 'iron_longsword');
        assert.deepEqual(dirty.ownedSpells, ['frost_nova']);
        assert.ok(dirty.unlockedAncestries.includes('tiefling'));
        assert.equal(dirty.unlockedAncestries.includes('invalid_race'), false);
        assert.deepEqual(dirty.ancestryStatBoosts.human, {
            str: ANCESTRY_STAT_UPGRADE_CONFIG.maxBoostPerStat,
            agi: 0,
            int: 2,
            vit: 1
        });
    });
});

describe('ProgressionManager delve rewards & shop purchases', () => {
    beforeEach(() => {
        HTTPCookie.clearAll();
    });

    it('accumulates Gold and EXP across multiple delves and persists in HTTPCookie', () => {
        const mgr = new ProgressionManager();
        assert.equal(mgr.getGold(), 0);
        assert.equal(mgr.getExp(), 0);

        const r1 = mgr.awardDelveRewards({ gold: 120, exp: 180, floor: 1, outcome: 'victory' });
        assert.equal(r1.ok, true);
        assert.equal(mgr.getGold(), 120);
        assert.equal(mgr.getExp(), 180);
        assert.equal(mgr.getState().delvesCompleted, 1);

        const r2 = mgr.awardDelveRewards({ gold: 95, exp: 140, floor: 2, outcome: 'victory' });
        assert.equal(r2.totalGold, 215);
        assert.equal(r2.totalExp, 320);
        assert.equal(mgr.getState().highestFloor, 2);
        assert.equal(mgr.getState().delvesCompleted, 2);

        // Verify a fresh ProgressionManager session reads the accumulated cookies
        const nextSession = new ProgressionManager();
        assert.equal(nextSession.getGold(), 215);
        assert.equal(nextSession.getExp(), 320);
        assert.equal(nextSession.getState().totalGoldEarned, 215);
        assert.equal(nextSession.getState().totalExpEarned, 320);
    });

    it('purchases and equips better armor and weapons with Gold validation', () => {
        const mgr = new ProgressionManager();
        mgr.awardDelveRewards({ gold: 200, exp: 0 });

        const armorBuy = mgr.buyArmor('steel_plate');
        assert.equal(armorBuy.ok, true);
        assert.equal(mgr.getGold(), 200 - SHOP_ARMOR.steel_plate.cost);
        assert.equal(mgr.getState().equippedArmor, 'steel_plate');

        // Buying again fails with already_owned
        assert.equal(mgr.buyArmor('steel_plate').ok, false);
        assert.equal(mgr.buyArmor('steel_plate').reason, 'already_owned');

        // Buying expensive armor without enough gold fails
        assert.equal(mgr.buyArmor('obsidian_dreadplate').ok, false);
        assert.equal(mgr.buyArmor('obsidian_dreadplate').reason, 'insufficient_gold');

        // Buy weapon
        const weaponBuy = mgr.buyWeapon('runed_broadsword');
        assert.equal(weaponBuy.ok, true);
        assert.equal(mgr.getState().equippedWeapon, 'runed_broadsword');

        // Switch back to starter gear and re-equip
        assert.equal(mgr.equipArmor('iron_chainmail').ok, true);
        assert.equal(mgr.getState().equippedArmor, 'iron_chainmail');
        assert.equal(mgr.equipWeapon('iron_longsword').ok, true);
        assert.equal(mgr.getState().equippedWeapon, 'iron_longsword');
    });

    it('purchases spells and unlocks new Ancestries in the shop', () => {
        const mgr = new ProgressionManager();
        mgr.awardDelveRewards({ gold: 400, exp: 0 });

        const spellRes = mgr.buySpell('frost_nova');
        assert.equal(spellRes.ok, true);
        assert.equal(mgr.hasSpell('frost_nova'), true);
        assert.equal(mgr.getOwnedSpells().length, 1);

        assert.equal(mgr.isAncestryUnlocked('dragonborn'), false);
        const ancRes = mgr.buyAncestry('dragonborn');
        assert.equal(ancRes.ok, true);
        assert.equal(mgr.isAncestryUnlocked('dragonborn'), true);
        assert.ok(mgr.getUnlockedAncestries().includes('dragonborn'));
    });

    it('spends EXP to purchase per-Ancestry stat increases with escalating cost', () => {
        const mgr = new ProgressionManager();
        mgr.awardDelveRewards({ gold: 100, exp: 250 });

        // Cannot upgrade a locked ancestry
        const lockedAttempt = mgr.buyAncestryStatBoost('tiefling', 'int');
        assert.equal(lockedAttempt.ok, false);
        assert.equal(lockedAttempt.reason, 'ancestry_locked');

        // Upgrade Human STR twice (costs 40 EXP then 60 EXP)
        assert.equal(mgr.getStatUpgradeCost('human', 'str'), 40);
        const up1 = mgr.buyAncestryStatBoost('human', 'str');
        assert.equal(up1.ok, true);
        assert.equal(up1.cost, 40);
        assert.equal(up1.newLevel, 1);
        assert.equal(mgr.getExp(), 210);

        assert.equal(mgr.getStatUpgradeCost('human', 'str'), 60);
        const up2 = mgr.buyAncestryStatBoost('human', 'str');
        assert.equal(up2.ok, true);
        assert.equal(up2.cost, 60);
        assert.equal(up2.newLevel, 2);
        assert.equal(mgr.getExp(), 150);

        assert.deepEqual(mgr.getAncestryStatBoosts('human'), { str: 2, agi: 0, int: 0, vit: 0 });
        assert.deepEqual(mgr.getAncestryStatBoosts('elf'), { str: 0, agi: 0, int: 0, vit: 0 });
    });
});

describe('calculateStats integration with Ancestries, Stat Boosts & Equipment', () => {
    it('preserves baseline 2-arg hero HP bounds [72, 287] across all 9 ancestries', () => {
        assert.equal(Object.keys(ANCESTRY_DATA).length, 9);
        const hps = [];
        for (const anc of Object.keys(ANCESTRY_DATA)) {
            for (const cls of Object.keys(CLASS_DATA)) {
                const st = calculateStats(anc, cls);
                hps.push(st.maxHp);
            }
        }
        assert.equal(Math.min(...hps), 72);
        assert.equal(Math.max(...hps), 287);

        // Starter baselines
        const humanWarrior = calculateStats('human', 'warrior');
        assert.equal(humanWarrior.maxHp, 196);
        assert.equal(humanWarrior.str, 16);
        assert.equal(humanWarrior.vit, 14);

        const elfMage = calculateStats('elf', 'mage');
        assert.equal(elfMage.maxHp, 72);
        assert.equal(elfMage.maxMp, 355);
    });

    it('applies per-Ancestry EXP stat boosts and equipped weapon/armor bonuses in Floor 1', () => {
        HTTPCookie.clearAll();
        const mgr = new ProgressionManager();
        mgr.awardDelveRewards({ gold: 500, exp: 500 });
        mgr.buyArmor('mithril_hauberk'); // +2 AC, +35 HP, +20 MP, +1 VIT, +2 AGI, -2 dmg reduction
        mgr.buyWeapon('flametongue_blade'); // +2 hit, +5 dmg, +2 STR, +2 INT
        mgr.buyAncestryStatBoost('human', 'str'); // +1 STR
        mgr.buyAncestryStatBoost('human', 'vit'); // +1 VIT

        const base = calculateStats('human', 'warrior');
        const boosted = calculateStats('human', 'warrior', mgr);

        // STR: base 16 + 1 (boost) + 2 (weapon) = 19
        assert.equal(boosted.str, base.str + 1 + 2);
        // AGI: base 10 + 0 (boost) + 2 (armor) = 12
        assert.equal(boosted.agi, base.agi + 2);
        // INT: base 7 + 0 (boost) + 2 (weapon) = 9
        assert.equal(boosted.int, base.int + 2);
        // VIT: base 14 + 1 (boost) + 1 (armor) = 16
        assert.equal(boosted.vit, base.vit + 1 + 1);
        // MaxHP: 16 * 14 + 35 (armor) = 259
        assert.equal(boosted.maxHp, 16 * 14 + 35);
        // MaxMP: 9 * 6 + 20 (armor) = 74
        assert.equal(boosted.maxMp, 9 * 6 + 20);
        assert.equal(boosted.acBonus, 2);
        assert.equal(boosted.damageReduction, 2);
        assert.equal(boosted.attackBonus, 2);
        assert.equal(boosted.damageBonus, 5);
    });
});

describe('3D CharacterBuilder & Spell Resolution for new content', () => {
    it('builds valid 3D character models for dragonborn, tiefling, and golem', () => {
        const builder = new CharacterBuilder();
        for (const ancestry of ['dragonborn', 'tiefling', 'golem']) {
            for (const charClass of ['warrior', 'mage']) {
                const model = builder.createCharacter({ ancestry, charClass, bodyType: 'a' });
                assert.ok(model.group instanceof THREE.Group);
                let meshes = 0;
                model.group.traverse((obj) => {
                    if (obj.isMesh) meshes++;
                });
                assert.ok(meshes > 15, `Expected >15 meshes for ${ancestry} ${charClass}, got ${meshes}`);
            }
        }
    });

    it('resolves all 4 purchasable spells accurately in combat', () => {
        assert.equal(Object.keys(SPELLS).length, 4);

        const lowMp = resolvePlayerSpell('frost_nova', { currentMp: 3, int: 18 }, { ac: 12 });
        assert.equal(lowMp.ok, false);
        assert.equal(lowMp.reason, 'insufficient_mp');

        const frost = resolvePlayerSpell('frost_nova', { currentMp: 50, int: 18 }, { ac: 12 });
        assert.equal(frost.ok, true);
        assert.equal(frost.mpCost, 12);
        assert.equal(frost.chillPenalty, 2);
        assert.ok(frost.damage >= 8);

        const volley = resolvePlayerSpell('arcane_bolt_barrage', { currentMp: 50, int: 16 }, { ac: 14 });
        assert.equal(volley.ok, true);
        assert.equal(volley.autoHit, true);

        const drain = resolvePlayerSpell('vampiric_drain', { currentMp: 50, int: 16 }, { ac: 12 });
        assert.equal(drain.ok, true);
        assert.ok(drain.healAmount >= 1);

        const storm = resolvePlayerSpell('chronos_thunder', { currentMp: 50, int: 20 }, { ac: 13 });
        assert.equal(storm.ok, true);
        assert.equal(storm.mpCost, 20);
        assert.ok(storm.damage >= 17);
    });
});

describe('server.js /api/progression HTTP Cookie endpoint', () => {
    it('handles GET and POST /api/progression with Set-Cookie headers', async () => {
        // 1. GET with Cookie header
        const getReq = new EventEmitter();
        getReq.url = '/api/progression';
        getReq.method = 'GET';
        getReq.headers = { cookie: 'dd_gold=145; dd_exp=260' };

        let getStatus = 0;
        let getHeaders = {};
        let getBody = '';
        const getRes = {
            writeHead(status, headers) {
                getStatus = status;
                getHeaders = headers;
            },
            end(chunk) {
                getBody = chunk || '';
            }
        };

        handleRequest(getReq, getRes);
        assert.equal(getStatus, 200);
        assert.ok(Array.isArray(getHeaders['Set-Cookie']));
        assert.equal(getHeaders['Set-Cookie'].length, 3);
        const getJson = JSON.parse(getBody);
        assert.equal(getJson.ok, true);
        assert.equal(getJson.state.gold, 145);
        assert.equal(getJson.state.exp, 260);

        // 2. POST updated progression state
        const postReq = new EventEmitter();
        postReq.url = '/api/progression';
        postReq.method = 'POST';
        postReq.headers = { cookie: 'dd_gold=145; dd_exp=260' };

        let postStatus = 0;
        let postHeaders = {};
        let postBody = '';
        const postRes = {
            writeHead(status, headers) {
                postStatus = status;
                postHeaders = headers;
            },
            end(chunk) {
                postBody = chunk || '';
            }
        };

        handleRequest(postReq, postRes);
        postReq.emit('data', Buffer.from(JSON.stringify({
            gold: 310,
            exp: 420,
            ownedSpells: ['frost_nova']
        })));
        postReq.emit('end');

        assert.equal(postStatus, 200);
        assert.ok(Array.isArray(postHeaders['Set-Cookie']));
        assert.ok(postHeaders['Set-Cookie'].some((c) => c.startsWith('dd_gold=310;')));
        assert.ok(postHeaders['Set-Cookie'].some((c) => c.startsWith('dd_exp=420;')));
        const postJson = JSON.parse(postBody);
        assert.equal(postJson.ok, true);
        assert.equal(postJson.state.gold, 310);
        assert.equal(postJson.state.exp, 420);
        assert.deepEqual(postJson.state.ownedSpells, ['frost_nova']);
    });
});
