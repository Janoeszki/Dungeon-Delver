import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const srcDir = path.join(rootDir, 'src');

function collectFiles(dir, extensions) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectFiles(full, extensions));
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
            results.push(full);
        }
    }
    return results;
}

const templateSources = collectFiles(path.join(srcDir, 'app'), ['.html'])
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
const tsSources = collectFiles(path.join(srcDir, 'app'), ['.ts'])
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
const styleSources = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8') + '\n' +
    collectFiles(path.join(srcDir, 'app'), ['.css'])
        .map((f) => fs.readFileSync(f, 'utf8'))
        .join('\n');
const creatorJs = fs.readFileSync(path.join(rootDir, 'js/characterCreator.js'), 'utf8');

describe('M5: Angular Controller & Markup Contracts', () => {
    it('contains all required Floor 1 DOM IDs and overlays across Angular component templates', () => {
        const requiredIds = [
            'screenStart',
            'screenCreator',
            'screenAdventure',
            'hudRoom',
            'adventureVignette',
            'victoryModal',
            'victoryTitle',
            'victoryStory',
            'victorySummaryBox',
            'victoryStatsLine',
            'victoryBankLine',
            'victoryRoomsLine',
            'btnVictoryShop',
            'btnPlayAgain',
            'btnVictoryTitle',
            'shopModal',
            'shopGoldBalance',
            'shopExpBalance',
            'shopArmorList',
            'shopWeaponsList',
            'shopSpellsList',
            'shopAncestriesList',
            'shopStatAncestryTabs',
            'shopFloor1StatPreview',
            'shopStatUpgradeGrid',
            'btnOpenShopHeader',
            'btnOpenShopForge',
            'btnOpenShopAdventure',
            'btnStartShop',
            'btnCloseShop',
            'btnShopNewDelve',
            'btnShopToForge',
            'encounterModal',
            'btnDismissEncounter',
            'combatModal',
            'btnTabSpells',
            'btnDismissCombat',
            'advLog',
            'advHpFill',
            'advHpText',
            'advMpFill',
            'advMpText',
            'advGold',
            'advXp',
            'advBankGold',
            'advBankExp',
            'advItemSlot'
        ];

        for (const id of requiredIds) {
            assert.match(templateSources, new RegExp(`id=["']${id}["']`), `Missing required DOM element #${id}`);
        }
    });

    it('contains all 9 ancestries (6 starter + 3 shop unlockable) in Character Forge model/template', () => {
        const ancestries = [
            'human', 'elf', 'dwarf', 'orc', 'goblin', 'catfolk',
            'dragonborn', 'tiefling', 'golem'
        ];
        for (const anc of ancestries) {
            assert.match(
                tsSources,
                new RegExp(`key:\\s*['"]${anc}['"]`),
                `Missing ancestry key "${anc}" in FORGE_ANCESTRIES`
            );
        }
        assert.match(templateSources, /\[attr\.data-ancestry\]=["']anc\.key["']/);
    });

    it('wires HTTPCookie progression, shop purchase actions, and Floor 1 / Combat progression stats', () => {
        assert.match(tsSources, /HTTPCookie/);
        assert.match(tsSources, /progression\.buyArmor\s*\(/);
        assert.match(tsSources, /progression\.buyWeapon\s*\(/);
        assert.match(tsSources, /progression\.buySpell\s*\(/);
        assert.match(tsSources, /progression\.buyAncestry\s*\(/);
        assert.match(tsSources, /progression\.buyAncestryStatBoost\s*\(/);
        assert.match(tsSources, /resolvePlayerSpell\s*\(/);
        assert.match(tsSources, /calculateStats\b/);
        assert.match(creatorJs, /calculateStats\s*\(\s*ancestryKey\s*,\s*this\.config\.charClass\s*,\s*progression\s*\)/);
    });

    it('uses Angular signals across services and components', () => {
        assert.match(tsSources, /\bsignal\s*</);
        assert.match(tsSources, /\bcomputed\s*(<|\()/);
        assert.match(tsSources, /\beffect\s*\(/);
        assert.match(tsSources, /viewChild\.required/);
    });

    it('contains horror CSS classes (.log-msg.dread, .adventure-room-banner, .adventure-vignette, .low-hp-crimson, .damage-flash)', () => {
        assert.match(styleSources, /\.log-msg\.dread\b/);
        assert.match(styleSources, /\.adventure-room-banner\b/);
        assert.match(styleSources, /\.adventure-vignette\b/);
        assert.match(styleSources, /\.low-hp-crimson\b/);
        assert.match(styleSources, /\.damage-flash\b/);
    });

    it('has Angular production build output in dist/dungeon-delver/browser/index.html', () => {
        const distIndex = path.join(rootDir, 'dist/dungeon-delver/browser/index.html');
        assert.ok(fs.existsSync(distIndex), 'Expected Angular build output at dist/dungeon-delver/browser/index.html');
        const distHtml = fs.readFileSync(distIndex, 'utf8');
        assert.match(distHtml, /<app-root>/);
    });

    it('removes the legacy 1-HP trap clamp and wires true 0-HP lethality + entrance respawn', () => {
        assert.doesNotMatch(
            tsSources,
            /Math\.max\(\s*1\s*,\s*(?:prev\.currentHp|playerStats\.currentHp)\s*-\s*(?:opt\.penalty\.hpDamage|dmg)\s*\)/,
            'Legacy 1-HP clamp on trap/encounter damage must be removed'
        );
        assert.match(
            tsSources,
            /Math\.max\(\s*0\s*,\s*prev\.currentHp\s*-\s*dmg\s*\)/,
            'Expected 0-HP floor on trap/encounter damage'
        );
        assert.match(tsSources, /respawnAtEntrance\(\)/);
    });

    it('wires DungeonWorldApp callbacks (onRoomEnter, onTrapStep, onFloorVictory), chooseMonsterAction, and clearActiveEncounter', () => {
        assert.match(tsSources, /onRoomEnter\s*:/);
        assert.match(tsSources, /onTrapStep\s*:/);
        assert.match(tsSources, /onFloorVictory\s*:/);
        assert.match(tsSources, /chooseMonsterAction\s*\(/);
        assert.match(tsSources, /clearActiveEncounter\s*\(\)/);
    });
});
