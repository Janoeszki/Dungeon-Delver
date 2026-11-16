import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(__dirname, '../../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

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
            'victoryRoomsLine',
            'btnPlayAgain',
            'btnVictoryTitle',
            'encounterModal',
            'btnDismissEncounter',
            'combatModal',
            'btnDismissCombat',
            'advLog',
            'advHpFill',
            'advHpText',
            'advMpFill',
            'advMpText',
            'advGold',
            'advXp',
            'advItemSlot'
        ];

        for (const id of requiredIds) {
            assert.match(indexHtml, new RegExp(`id=["']${id}["']`), `Missing required DOM element #${id}`);
        }
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
