// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

/**
 * Lightweight fuzzy match utilities.
 *
 * match(needle, haystack) → boolean
 *   Returns true if all characters of needle appear in haystack in order,
 *   case-insensitively. Empty needle always matches.
 *
 * score(needle, haystack) → number
 *   Higher = better match. Used for sorting.
 *   Rewards: consecutive character runs, word boundary hits, prefix hits.
 */

export function match(needle, haystack) {
    if (!needle) return true;
    const n = needle.toLowerCase();
    const h = haystack.toLowerCase();
    let ni = 0;
    for (let hi = 0; hi < h.length && ni < n.length; hi++) {
        if (h[hi] === n[ni]) ni++;
    }
    return ni === n.length;
}

export function score(needle, haystack) {
    if (!needle) return 0;
    const n = needle.toLowerCase();
    const h = haystack.toLowerCase();

    let score = 0;
    let ni = 0;
    let consecutive = 0;
    let prevMatch = false;

    for (let hi = 0; hi < h.length && ni < n.length; hi++) {
        if (h[hi] === n[ni]) {
            // Consecutive run bonus
            if (prevMatch) {
                consecutive++;
                score += consecutive * 3;
            } else {
                consecutive = 0;
            }
            // Word boundary bonus (preceded by space, dash, dot, underscore or start)
            if (hi === 0 || /[\s\-._/]/.test(h[hi - 1])) {
                score += 8;
            }
            // Prefix bonus
            if (hi === 0) score += 10;
            score += 1;
            prevMatch = true;
            ni++;
        } else {
            prevMatch = false;
        }
    }

    if (ni < n.length) return 0; // didn't match all chars
    return score;
}
