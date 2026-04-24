// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const MAX_HISTORY   = 50;
const MAX_ENTRY_LEN = 2000;
const DATA_DIR      = GLib.build_filenamev([GLib.get_user_data_dir(), 'kapit-launcher']);
const HISTORY_FILE  = GLib.build_filenamev([DATA_DIR, 'clipboard.json']);

// History format: array of { text: string, private: bool }
// Legacy format (plain strings) is migrated on first load.

export class ClipboardProvider extends BaseProvider {
    get id()       { return 'clipboard'; }
    get label()    { return 'Clipboard'; }
    get priority() { return 15; }

    constructor(settings) {
        super(settings);
        this._clipboard = null;
        try {
            this._clipboard = St.Clipboard.get_default();
        } catch (e) {
            console.warn('[Kapit] ClipboardProvider: clipboard unavailable:', e.message);
        }
    }

    query(text) {
        const history = this._loadHistory();
        if (!history.length) return [];

        const needle = text.toLowerCase();

        // For private entries, search the actual text but display masked
        return history
            .filter(entry => {
                if (!needle) return true;
                return entry.text.toLowerCase().includes(needle);
            })
            .map((entry, i) => {
                const isPrivate = !!entry.private;

                // Private entries show bullets instead of content
                const display = isPrivate
                    ? '•'.repeat(Math.min(entry.text.length, 24))
                    : (entry.text.length > 80
                        ? entry.text.slice(0, 80).replace(/\n/g, '↵') + '…'
                        : entry.text.replace(/\n/g, '↵'));

                const subtitle = isPrivate
                    ? `Private · ${entry.text.length} chars · Enter to copy`
                    : `${entry.text.length} chars · Enter to copy · Ctrl+↵ to mark private`;

                return {
                    id:               `clipboard:${i}`,
                    title:            display,
                    subtitle,
                    icon:             null,
                    iconName:         isPrivate ? 'changes-prevent-symbolic' : 'edit-paste-symbolic',
                    badgeLabel:       isPrivate ? 'private' : 'clip',
                    badgeStyle:       isPrivate ? 'purple' : 'teal',
                    activate:         () => this._copyToClipboard(entry.text),
                    activateAlt:      () => isPrivate
                        ? this._togglePrivate(entry.text, false)
                        : this._togglePrivate(entry.text, true),
                    activateAltLabel:    isPrivate ? 'Remove private flag' : 'Mark as private',
                    activateAltKeepOpen: true,
                    // Delete by index so duplicate text values each have independent delete
                    activateDel:      () => this._deleteEntryAt(i),
                };
            });
    }

    // ── History file ──────────────────────────────────────────────────────────

    _loadHistory() {
        try {
            const file = Gio.File.new_for_path(HISTORY_FILE);
            const [ok, contents] = file.load_contents(null);
            if (!ok) return [];

            const parsed = JSON.parse(new TextDecoder().decode(contents));
            if (!Array.isArray(parsed)) return [];

            let max = MAX_HISTORY;
            try { max = this._settings.get_int('clipboard-max-history') || MAX_HISTORY; } catch (_e) {}

            // Migrate legacy plain-string format to object format
            return parsed
                .map(e => {
                    if (typeof e === 'string') return { text: e, private: false };
                    if (e && typeof e.text === 'string') return { text: e.text, private: !!e.private };
                    return null;
                })
                .filter(e => e && e.text.length > 0)
                .slice(0, max);
        } catch (_e) {
            return [];
        }
    }

    _saveHistory(history) {
        try {
            const dir = Gio.File.new_for_path(DATA_DIR);
            if (!dir.query_exists(null))
                dir.make_directory_with_parents(null);
            const file = Gio.File.new_for_path(HISTORY_FILE);
            file.replace_contents(
                new TextEncoder().encode(JSON.stringify(history, null, 2)),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.warn('[Kapit] ClipboardProvider: save failed:', e.message);
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    _copyToClipboard(text) {
        if (!this._clipboard) return;
        try {
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        } catch (_e) {}
    }

    // Delete by index — avoids removing duplicate text entries unintentionally
    _deleteEntryAt(index) {
        const history = this._loadHistory();
        if (index < 0 || index >= history.length) return;
        history.splice(index, 1);
        this._saveHistory(history);
    }

    // Toggle private flag by text match (text is unique enough for this use case)
    _togglePrivate(text, makePrivate) {
        const history = this._loadHistory().map(e =>
            e.text === text ? { ...e, private: makePrivate } : e
        );
        this._saveHistory(history);
    }

    destroy() {
        this._clipboard = null;
    }
}
