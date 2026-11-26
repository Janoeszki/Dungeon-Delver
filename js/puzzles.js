// Floor 2 puzzle definitions and pure state machine (zero DOM/Three.js dependencies)

function deepFreeze(value) {
    if (!value || typeof value !== 'object') return value;
    Object.freeze(value);
    const values = Array.isArray(value) ? value : Object.values(value);
    for (const item of values) {
        deepFreeze(item);
    }
    return value;
}

export const PUZZLE_TYPES = Object.freeze([
    'rune_sequence',
    'mirror_alignment',
    'alchemist_scales'
]);

const MIRROR_DIRECTIONS = ['N', 'E', 'S', 'W'];

export const PUZZLE_DEFINITIONS = deepFreeze({
    puzzle_twin_moons: {
        id: 'puzzle_twin_moons',
        puzzleType: 'rune_sequence',
        roomId: 'f2_west_puzzle',
        name: 'Dial of the Twin Moons',
        icon: '🌙',
        description: 'Four lunar monoliths hum with dormant arcane resonance. Strike the moon glyphs in their true celestial order to unbind the Rune Gate.',
        clue: 'The Eclipse rises second. The Star closes the cycle. The Crescent precedes the Eclipse.',
        unlocksDoorId: 'door_f2_rune_gate',
        failDamage: 8,
        hintDc: 11,
        reward: { gold: 45, xp: 60 },
        glyphs: [
            { id: 'crescent', label: 'Crescent', icon: '🌙' },
            { id: 'eclipse', label: 'Eclipse', icon: '🌑' },
            { id: 'full', label: 'Full Moon', icon: '🌕' },
            { id: 'star', label: 'Star', icon: '⭐' }
        ],
        solution: ['crescent', 'eclipse', 'full', 'star']
    },
    puzzle_mirror_relay: {
        id: 'puzzle_mirror_relay',
        puzzleType: 'mirror_alignment',
        roomId: 'f2_central_hall',
        name: 'Vault of Mirrors',
        icon: '🔮',
        description: 'Three crystal prisms refract scattered beams of starlight. Rotate the mirrors to focus the beam into the north vault core.',
        clue: 'Channel the West Prism East into the Center Prism, then aim both the Center Prism and East Focus North toward the inner vault.',
        unlocksDoorId: null,
        failDamage: 8,
        hintDc: 12,
        reward: { gold: 55, xp: 75, consumable: 'Mana Draught' },
        mirrors: [
            { id: 'west', label: 'West Prism' },
            { id: 'center', label: 'Center Prism' },
            { id: 'east', label: 'East Focus' }
        ],
        initialAngles: ['S', 'W', 'E'],
        solution: ['E', 'N', 'N']
    },
    puzzle_alchemist_scales: {
        id: 'puzzle_alchemist_scales',
        puzzleType: 'alchemist_scales',
        roomId: 'f2_north_puzzle',
        name: 'Scales of Equilibrium',
        icon: '⚖️',
        description: 'An astral brass balance bars the obsidian seal. Place the exact harmonic weights onto the pan to unlock the Arch-Lich Sanctum.',
        clue: 'Place exactly three runic weights upon the astral scale so their combined resonance equals 15.',
        unlocksDoorId: 'door_f2_obsidian_seal',
        failDamage: 9,
        hintDc: 12,
        reward: { gold: 65, xp: 85, consumable: 'Greater Healing Potion' },
        targetSum: 15,
        requiredCount: 3,
        weights: [
            { value: 2, label: 'Lead (2)' },
            { value: 4, label: 'Iron (4)' },
            { value: 5, label: 'Silver (5)' },
            { value: 6, label: 'Gold (6)' },
            { value: 9, label: 'Obsidian (9)' }
        ]
    }
});

export function createPuzzleState(puzzleId) {
    const def = PUZZLE_DEFINITIONS[puzzleId];
    if (!def) {
        throw new Error(`Unknown puzzleId: ${puzzleId}`);
    }
    return {
        puzzleId: def.id,
        puzzleType: def.puzzleType,
        solved: false,
        attempts: 0,
        hintUsed: false,
        hintText: null,
        sequence: [],
        mirrorAngles: def.initialAngles ? [...def.initialAngles] : [],
        selectedWeights: []
    };
}

export function applyPuzzleInput(state, action) {
    if (!state || typeof state !== 'object') {
        return { state, autoEvaluate: false };
    }
    const def = PUZZLE_DEFINITIONS[state.puzzleId];
    if (!def || state.solved) {
        return { state, autoEvaluate: false };
    }

    const act = action && typeof action === 'object' ? action : {};
    let autoEvaluate = false;

    if (def.puzzleType === 'rune_sequence') {
        if (act.type === 'reset_runes') {
            state.sequence = [];
        } else if (act.type === 'select_rune' && typeof act.runeId === 'string') {
            const validGlyph = def.glyphs.some((g) => g.id === act.runeId);
            if (validGlyph && !state.sequence.includes(act.runeId) && state.sequence.length < def.solution.length) {
                state.sequence.push(act.runeId);
                if (state.sequence.length === def.solution.length) {
                    autoEvaluate = true;
                }
            }
        }
    } else if (def.puzzleType === 'mirror_alignment') {
        if (act.type === 'rotate_mirror' && Number.isInteger(act.index)) {
            const idx = act.index;
            if (idx >= 0 && idx < state.mirrorAngles.length) {
                const curDir = state.mirrorAngles[idx];
                const nextIdx = (MIRROR_DIRECTIONS.indexOf(curDir) + 1) % MIRROR_DIRECTIONS.length;
                state.mirrorAngles[idx] = MIRROR_DIRECTIONS[nextIdx];
            }
        }
    } else if (def.puzzleType === 'alchemist_scales') {
        if (act.type === 'toggle_weight' && Number.isFinite(act.weight)) {
            const val = Number(act.weight);
            const validWeight = def.weights.some((w) => w.value === val);
            if (validWeight) {
                const existingIdx = state.selectedWeights.indexOf(val);
                if (existingIdx !== -1) {
                    state.selectedWeights.splice(existingIdx, 1);
                } else if (state.selectedWeights.length < def.requiredCount) {
                    state.selectedWeights.push(val);
                }
            }
        } else if (act.type === 'reset_weights') {
            state.selectedWeights = [];
        }
    }

    return { state, autoEvaluate };
}

export function evaluatePuzzleAttempt(state) {
    if (!state || typeof state !== 'object') {
        return {
            solved: false,
            correctCount: 0,
            totalCount: 0,
            feedback: 'Invalid puzzle state.',
            failDamage: 0,
            reward: null,
            unlocksDoorId: null
        };
    }
    const def = PUZZLE_DEFINITIONS[state.puzzleId];
    if (!def) {
        return {
            solved: false,
            correctCount: 0,
            totalCount: 0,
            feedback: 'Unknown puzzle.',
            failDamage: 0,
            reward: null,
            unlocksDoorId: null
        };
    }

    state.attempts = (state.attempts || 0) + 1;

    if (def.puzzleType === 'rune_sequence') {
        const totalCount = def.solution.length;
        let correctCount = 0;
        for (let i = 0; i < totalCount; i++) {
            if (state.sequence[i] === def.solution[i]) {
                correctCount++;
            }
        }
        const solved = state.sequence.length === totalCount && correctCount === totalCount;
        if (solved) {
            state.solved = true;
            return {
                solved: true,
                correctCount,
                totalCount,
                feedback: 'The four lunar glyphs blaze with silver fire! The Rune Gate unbinds.',
                failDamage: 0,
                reward: { ...def.reward },
                unlocksDoorId: def.unlocksDoorId
            };
        }
        state.sequence = [];
        return {
            solved: false,
            correctCount,
            totalCount,
            feedback: `The dial recoils with an arcane shock (${correctCount}/${totalCount} glyphs in the right position).`,
            failDamage: def.failDamage,
            reward: null,
            unlocksDoorId: null
        };
    }

    if (def.puzzleType === 'mirror_alignment') {
        const totalCount = def.solution.length;
        let correctCount = 0;
        for (let i = 0; i < totalCount; i++) {
            if (state.mirrorAngles[i] === def.solution[i]) {
                correctCount++;
            }
        }
        const solved = correctCount === totalCount;
        if (solved) {
            state.solved = true;
            return {
                solved: true,
                correctCount,
                totalCount,
                feedback: 'The starlight beam locks cleanly through all three prisms, cracking open a hidden cache!',
                failDamage: 0,
                reward: { ...def.reward },
                unlocksDoorId: def.unlocksDoorId
            };
        }
        return {
            solved: false,
            correctCount,
            totalCount,
            feedback: `Refracted light scatters off-axis (${correctCount}/${totalCount} prisms aligned).`,
            failDamage: def.failDamage,
            reward: null,
            unlocksDoorId: null
        };
    }

    // alchemist_scales
    const count = state.selectedWeights.length;
    const sum = state.selectedWeights.reduce((acc, v) => acc + v, 0);
    const solved = count === def.requiredCount && sum === def.targetSum;
    if (solved) {
        state.solved = true;
        return {
            solved: true,
            correctCount: def.requiredCount,
            totalCount: def.requiredCount,
            feedback: `The astral scale settles at exactly ${def.targetSum}! The Obsidian Seal unlocks ahead.`,
            failDamage: 0,
            reward: { ...def.reward },
            unlocksDoorId: def.unlocksDoorId
        };
    }

    const reason = count !== def.requiredCount
        ? `Select exactly ${def.requiredCount} weights (currently ${count}).`
        : `Total weight is ${sum}, not ${def.targetSum}.`;
    return {
        solved: false,
        correctCount: sum === def.targetSum ? 1 : 0,
        totalCount: def.requiredCount,
        feedback: `The balance tips violently! ${reason}`,
        failDamage: def.failDamage,
        reward: null,
        unlocksDoorId: null
    };
}

export function getPuzzleHint(state) {
    if (!state || typeof state !== 'object') return '';
    const def = PUZZLE_DEFINITIONS[state.puzzleId];
    if (!def) return '';

    state.hintUsed = true;

    if (def.puzzleType === 'rune_sequence') {
        const nextIdx = Math.min(state.sequence.length, def.solution.length - 1);
        const nextId = def.solution[nextIdx];
        const glyph = def.glyphs.find((g) => g.id === nextId);
        const hint = `Slot ${nextIdx + 1} calls for the ${glyph ? glyph.label : nextId} glyph.`;
        state.hintText = hint;
        return hint;
    }

    if (def.puzzleType === 'mirror_alignment') {
        let targetIdx = 0;
        for (let i = 0; i < def.solution.length; i++) {
            if (state.mirrorAngles[i] !== def.solution[i]) {
                targetIdx = i;
                break;
            }
        }
        const mirrorName = def.mirrors[targetIdx]?.label || `Prism ${targetIdx + 1}`;
        const hint = `Aim the ${mirrorName} toward ${def.solution[targetIdx]}.`;
        state.hintText = hint;
        return hint;
    }

    // alchemist_scales: find a valid 3-weight solution compatible with current selection or default [4, 5, 6]
    const values = def.weights.map((w) => w.value);
    let chosenTriad = [4, 5, 6];
    for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
            for (let k = j + 1; k < values.length; k++) {
                const triad = [values[i], values[j], values[k]];
                if (triad[0] + triad[1] + triad[2] === def.targetSum) {
                    const matchesCurrent = state.selectedWeights.every((w) => triad.includes(w));
                    if (matchesCurrent) {
                        chosenTriad = triad;
                        break;
                    }
                }
            }
        }
    }
    const missing = chosenTriad.find((w) => !state.selectedWeights.includes(w)) ?? chosenTriad[0];
    const hint = `Try combining 3 weights that sum to ${def.targetSum}, including ${missing}.`;
    state.hintText = hint;
    return hint;
}
