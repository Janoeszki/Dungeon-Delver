import { sound } from './audio.js';

/**
 * D20 Action Dice Engine
 * Translates RPG stats into roll modifiers and evaluates DC checks.
 */

export function getStatModifier(statValue) {
    return Math.floor((statValue - 10) / 2);
}

export function formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Rolls a D20 with stat modifier against Difficulty Class (DC)
 */
export function rollD20(statValue, statName, dc) {
    const rawRoll = Math.floor(Math.random() * 20) + 1;
    const modifier = getStatModifier(statValue);
    const total = rawRoll + modifier;

    const isNat20 = rawRoll === 20;
    const isNat1 = rawRoll === 1;

    let success = false;
    if (isNat20) {
        success = true;
    } else if (isNat1) {
        success = false;
    } else {
        success = total >= dc;
    }

    return {
        rawRoll,
        modifier,
        statName,
        total,
        dc,
        isNat20,
        isNat1,
        success
    };
}

/**
 * Animate suspenseful dice rolling
 */
export function animateDiceRoll(onTick, onComplete, durationMs = 850) {
    sound.playDiceRoll();
    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        if (elapsed < durationMs) {
            const fakeRoll = Math.floor(Math.random() * 20) + 1;
            onTick(fakeRoll);
            requestAnimationFrame(frame);
        } else {
            onComplete();
        }
    }

    requestAnimationFrame(frame);
}
