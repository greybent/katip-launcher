// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

/**
 * BaseProvider — abstract base class for all Katip Launcher providers.
 *
 * Each provider must implement:
 *   - get id()         → unique string, e.g. 'windows'
 *   - get label()      → human-readable name, e.g. 'Open Windows'
 *   - get priority()   → lower number = listed first in results
 *   - query(text)      → returns Promise<Result[]> or Result[]
 *
 * A Result object shape:
 * {
 *   id:          string        — unique within provider, e.g. 'app:firefox'
 *   title:       string        — primary label
 *   subtitle:    string        — secondary label (path, description, etc.)
 *   icon:        Gio.Icon|null — icon to display
 *   iconName:    string|null   — fallback icon-name string
 *   badgeLabel:  string        — short type badge, e.g. 'app', 'window'
 *   badgeStyle:  string        — CSS class suffix: 'blue'|'green'|'amber'|'purple'|'gray'
 *   activate:    function      — called when user selects this result
 * }
 */
export class BaseProvider {
    constructor(settings) {
        this._settings = settings;
    }

    /** Unique machine-readable ID */
    get id() {
        throw new Error(`${this.constructor.name} must implement get id()`);
    }

    /** Human-readable label shown in mode chips */
    get label() {
        throw new Error(`${this.constructor.name} must implement get label()`);
    }

    /**
     * Sort priority — lower = appears earlier in merged results list.
     * Recommended defaults:
     *   windows:    10
     *   apps:       20
     *   files:      30
     *   calculator: 40
     *   web:        50
     */
    get priority() {
        return 99;
    }

    /**
     * Query the provider.
     * @param {string} text — the current search string
     * @returns {Result[]|Promise<Result[]>}
     */
    query(_text) {
        return [];
    }

    /**
     * Called when the launcher is destroyed or the provider is disabled.
     * Override to clean up DBus connections, file monitors, etc.
     */
    destroy() {}
}
