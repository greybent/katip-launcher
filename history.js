// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * HistoryManager — tracks launch frequency per result ID.
 *
 * Data is persisted to:
 *   ~/.local/share/kapit-launcher/history.json
 *
 * Schema: { [resultId: string]: { count: number, lastUsed: number } }
 *
 * Usage:
 *   history.record('app:org.gnome.Weather.desktop')
 *   history.getScore('app:org.gnome.Weather.desktop') → number
 */
export class HistoryManager {
    constructor() {
        this._dataDir  = GLib.build_filenamev([
            GLib.get_user_data_dir(), 'kapit-launcher',
        ]);
        this._filePath = GLib.build_filenamev([this._dataDir, 'history.json']);
        this._data     = {};
        this._saveId   = null;
        this._load();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Record a launch. Call this whenever a result is activated.
     * @param {string} id — the result's id field
     */
    record(id) {
        if (!id) return;
        if (!this._data[id])
            this._data[id] = { count: 0, lastUsed: 0 };
        this._data[id].count++;
        this._data[id].lastUsed = Date.now();
        this._scheduleSave();
    }

    /**
     * Returns a score for sorting. Higher = more used.
     * Combines frequency with recency decay so stale entries fade out.
     * @param {string} id
     * @returns {number}
     */
    getScore(id) {
        const entry = this._data[id];
        if (!entry) return 0;

        const daysSince = (Date.now() - entry.lastUsed) / 86_400_000;
        // Decay: halve score every 30 days of non-use
        const decay = Math.pow(0.5, daysSince / 30);
        return entry.count * decay;
    }

    /**
     * Returns the raw launch count (for display if needed).
     */
    getCount(id) {
        return this._data[id]?.count ?? 0;
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    _load() {
        try {
            const file = Gio.File.new_for_path(this._filePath);
            const [ok, contents] = file.load_contents(null);
            if (ok) {
                const json = new TextDecoder().decode(contents);
                const parsed = JSON.parse(json);
                // Validate: must be a plain object with numeric count/lastUsed values
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    this._data = {};
                    for (const [k, v] of Object.entries(parsed)) {
                        if (typeof k === 'string' &&
                            typeof v?.count === 'number' &&
                            typeof v?.lastUsed === 'number') {
                            this._data[k] = { count: v.count, lastUsed: v.lastUsed };
                        }
                    }
                }
            }
        } catch (_e) {
            // File doesn't exist yet or is corrupt — start fresh
            this._data = {};
        }
    }

    _scheduleSave() {
        if (this._saveId) return; // already queued
        // Debounce writes — save 2 seconds after last record() call
        this._saveId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 2000, () => {
            this._saveId = null;
            this._save();
            return GLib.SOURCE_REMOVE;
        });
    }

    _prune() {
        // Cap history at 500 entries to prevent unbounded file growth.
        // Evict entries with the lowest score (least used / oldest).
        const MAX_ENTRIES = 500;
        const keys = Object.keys(this._data);
        if (keys.length <= MAX_ENTRIES) return;

        // Compute scores once — avoids calling Date.now() O(n log n) times
        const now = Date.now();
        const scored = keys.map(k => {
            const entry = this._data[k];
            const daysSince = (now - entry.lastUsed) / 86_400_000;
            return { k, score: entry.count * Math.pow(0.5, daysSince / 30) };
        });
        scored.sort((a, b) => a.score - b.score);
        const toRemove = scored.slice(0, keys.length - MAX_ENTRIES);
        for (const { k } of toRemove) delete this._data[k];
    }

    _save() {
        try {
            this._prune();

            const dir = Gio.File.new_for_path(this._dataDir);
            if (!dir.query_exists(null))
                dir.make_directory_with_parents(null);

            const file = Gio.File.new_for_path(this._filePath);
            const json = JSON.stringify(this._data, null, 2);
            file.replace_contents(
                new TextEncoder().encode(json),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.warn('[Kapit] HistoryManager: save failed —', e.message);
        }
    }

    destroy() {
        if (this._saveId) {
            GLib.source_remove(this._saveId);
            this._saveId = null;
        }
        // Flush any pending write synchronously on shutdown
        this._save();
    }
}
