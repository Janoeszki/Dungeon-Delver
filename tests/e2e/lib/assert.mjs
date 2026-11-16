export function fail(msg) {
    throw new Error(msg);
}

export function assert(cond, msg = 'Assertion failed') {
    if (!cond) throw new Error(msg);
}

export function assertEqual(actual, expected, label = 'value') {
    if (actual !== expected) {
        throw new Error(`Expected ${label} to equal ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export function assertNotEqual(actual, notExpected, label = 'value') {
    if (actual === notExpected) {
        throw new Error(`Expected ${label} NOT to equal ${JSON.stringify(notExpected)}`);
    }
}

export function assertGt(actual, minExclusive, label = 'value') {
    if (!(actual > minExclusive)) {
        throw new Error(`Expected ${label} (${actual}) > ${minExclusive}`);
    }
}

export function assertGte(actual, minInclusive, label = 'value') {
    if (!(actual >= minInclusive)) {
        throw new Error(`Expected ${label} (${actual}) >= ${minInclusive}`);
    }
}

export function assertLte(actual, maxInclusive, label = 'value') {
    if (!(actual <= maxInclusive)) {
        throw new Error(`Expected ${label} (${actual}) <= ${maxInclusive}`);
    }
}

export function assertBetween(actual, minInclusive, maxInclusive, label = 'value') {
    if (!(actual >= minInclusive && actual <= maxInclusive)) {
        throw new Error(`Expected ${label} (${actual}) to be within [${minInclusive}, ${maxInclusive}]`);
    }
}

export function assertIncludes(haystack, needle, label = 'text') {
    if (!String(haystack).includes(String(needle))) {
        throw new Error(`Expected ${label} (${JSON.stringify(haystack)}) to include ${JSON.stringify(needle)}`);
    }
}

export function assertMatch(haystack, regex, label = 'text') {
    if (!regex.test(String(haystack))) {
        throw new Error(`Expected ${label} (${JSON.stringify(haystack)}) to match ${regex}`);
    }
}
