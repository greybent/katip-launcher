// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const MAX_ENTRY_LEN = 2000;
const DATA_DIR      = GLib.build_filenamev([GLib.get_user_data_dir(), 'katip-launcher']);
const HISTORY_FILE  = GLib.build_filenamev([DATA_DIR, 'clipboard.json']);

/**
 * ClipboardHistory — sole owner of clipboard.json.
 *
 * All reads and writes go through this class so that the background
 * watcher (extension.js) and ClipboardProvider share a single code
 * path and cannot race each other on the file.
 */
export class ClipboardHistory {
    constructor(settings) {
        this._settings = settings;
    }

    _maxHistory() {
        try { return Math.max(1, this._settings.get_int('clipboard-max-history') || 50); } catch (_e) { return 50; }
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    load() {
        try {
            const [ok, contents] = Gio.File.new_for_path(HISTORY_FILE).load_contents(null);
            if (!ok) return [];
            const parsed = JSON.parse(new TextDecoder().decode(contents));
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map(e => {
                    if (typeof e === 'string') return { text: e, private: false };
                    if (e && typeof e.text === 'string') return { text: e.text, private: !!e.private };
                    return null;
                })
                .filter(e => e && e.text.length > 0)
                .slice(0, this._maxHistory());
        } catch (_e) {
            return [];
        }
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    _save(history) {
        try {
            const dir = Gio.File.new_for_path(DATA_DIR);
            if (!dir.query_exists(null))
                dir.make_directory_with_parents(null);
            Gio.File.new_for_path(HISTORY_FILE).replace_contents(
                new TextEncoder().encode(JSON.stringify(history, null, 2)),
                null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null
            );
        } catch (e) {
            console.warn('[Katip] ClipboardHistory: save failed:', e.message);
        }
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    append(text) {
        const trimmed = text.slice(0, MAX_ENTRY_LEN);
        const history = this.load();
        if (history[0]?.text === trimmed) return;
        const existing = history.find(e => e.text === trimmed);
        const newEntry = { text: trimmed, private: existing?.private ?? false };
        this._save([newEntry, ...history.filter(e => e.text !== trimmed)].slice(0, this._maxHistory()));
    }

    deleteByText(text) {
        const history = this.load();
        const idx = history.findIndex(e => e.text === text);
        if (idx === -1) return;
        history.splice(idx, 1);
        this._save(history);
    }

    togglePrivate(text, makePrivate) {
        this._save(this.load().map(e =>
            e.text === text ? { ...e, private: makePrivate } : e
        ));
    }
}
