import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(__dirname, '../../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const creatorJsPath = path.resolve(__dirname, '../../js/characterCreator.js');
const creatorJs = fs.readFileSync(creatorJsPath, 'utf8');

describe('M5 — index.html Controller & Markup Contracts', () => {
    it('contains all required Floor 1 DOM IDs and overlays', () => {
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
            assert.match(indexHtml, new RegExp(`id=["']${id}["']`), `Missing required DOM element #${id}`);
        }
    });

    it('contains all 9 ancestries (6 starter + 3 shop unlockable) in Character Forge markup', () => {
        const ancestries = [
            'human', 'elf', 'dwarf', 'orc', 'goblin', 'catfolk',
            'dragonborn', 'tiefling', 'golem'
        ];
        for (const anc of ancestries) {
            assert.match(
                indexHtml,
                new RegExp(`data-ancestry=["']${anc}["']`),
                `Missing data-ancestry="${anc}" card in Character Forge`
            );
        }
    });

    it('wires HTTPCookie progression, shop purchase actions, and Floor 1 / Combat progression stats', () => {
        assert.match(indexHtml, /HTTPCookie/);
        assert.match(indexHtml, /progression\.buyArmor\s*\(/);
        assert.match(indexHtml, /progression\.buyWeapon\s*\(/);
        assert.match(indexHtml, /progression\.buySpell\s*\(/);
        assert.match(indexHtml, /progression\.buyAncestry\s*\(/);
        assert.match(indexHtml, /progression\.buyAncestryStatBoost\s*\(/);
        assert.match(indexHtml, /resolvePlayerSpell\s*\(/);
        assert.match(indexHtml, /calculateStats\s*\(\s*conf\.ancestry\s*,\s*conf\.charClass\s*,\s*progression\s*\)/);
        assert.match(creatorJs, /calculateStats\s*\(\s*ancestryKey\s*,\s*this\.config\.charClass\s*,\s*progression\s*\)/);
    });

    it('contains horror CSS classes (.log-msg.dread, .adventure-room-banner, .adventure-vignette, .low-hp-crimson, .damage-flash)', () => {
        assert.match(indexHtml, /\.log-msg\.dread\b/);
        assert.match(indexHtml, /\.adventure-room-banner\b/);
        assert.match(indexHtml, /\.adventure-vignette\b/);
        assert.match(indexHtml, /\.low-hp-crimson\b/);
        assert.match(indexHtml, /\.damage-flash\b/);
    });

    it('has valid JavaScript syntax in the <script type="module"> block', () => {
        const match = indexHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
        assert.ok(match, 'Could not find <script type="module"> block in index.html');
        const scriptContent = match[1];

        // Replace static ESM imports with dummy declarations to syntax-check with new Function
        const strippedImports = scriptContent.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
        assert.doesNotThrow(() => {
            new Function(strippedImports);
        }, 'Controller script has syntax errors');
    });

    it('removes the legacy 1-HP trap clamp and wires true 0-HP lethality + entrance respawn', () => {
        assert.doesNotMatch(
            indexHtml,
            /Math\.max\(\s*1\s*,\s*playerStats\.currentHp\s*-\s*opt\.penalty\.hpDamage\s*\)/,
            'Legacy 1-HP clamp on trap/encounter damage must be removed'
        );
        assert.match(
            indexHtml,
            /Math\.max\(\s*0\s*,\s*playerStats\.currentHp\s*-\s*opt\.penalty\.hpDamage\s*\)/,
            'Expected 0-HP floor on trap/encounter damage'
        );
        assert.match(indexHtml, /respawnAtEntrance\(\)/);
    });

    it('wires DungeonWorldApp callbacks (onRoomEnter, onTrapStep, onFloorVictory), chooseMonsterAction, and clearActiveEncounter', () => {
        assert.match(indexHtml, /onRoomEnter\s*:/);
        assert.match(indexHtml, /onTrapStep\s*:/);
        assert.match(indexHtml, /onFloorVictory\s*:/);
        assert.match(indexHtml, /chooseMonsterAction\s*\(/);
        assert.match(indexHtml, /clearActiveEncounter\s*\(\)/);
    });
});
