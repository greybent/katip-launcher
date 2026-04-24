// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';

const ALLOWED_PROTOCOLS = /^https?:\/\//i;

/**
 * ShortcutsProvider — user-defined launch shortcuts.
 *
 * Two types:
 *   "open"   — standalone trigger, e.g. "gg" → opens https://google.de
 *   "search" — trigger + space + term, e.g. "aa mugs" → opens amazon search
 *              URL must contain {query} placeholder
 *
 * Shortcuts are stored as JSON in the 'shortcuts' GSettings key.
 */
export class ShortcutsProvider extends BaseProvider {
    get id()       { return 'shortcuts'; }
    get label()    { return 'Shortcuts'; }
    get priority() { return 5; } // above windows, shown first

    query(text) {
        const shortcuts = this._loadShortcuts();
        if (!shortcuts.length) return [];

        const trimmed = text.trim();
        if (!trimmed) return [];

        const results = [];

        for (const sc of shortcuts) {
            const trigger = (sc.trigger ?? '').trim().toLowerCase();
            if (!trigger) continue;

            if (sc.type === 'search') {
                // Match: trigger followed by a space and at least one char
                const prefix = trigger + ' ';
                if (trimmed.toLowerCase().startsWith(prefix)) {
                    const term = trimmed.slice(prefix.length).trim();
                    if (!term) continue;
                    const url = (sc.url ?? '').replace('{query}', encodeURIComponent(term));
                    results.push({
                        id:         `shortcut:${trigger}:${term}`,
                        title:      `${sc.label ?? trigger}: ${term}`,
                        subtitle:   url,
                        icon:       null,
                        iconName:   'web-browser-symbolic',
                        badgeLabel: trigger,
                        badgeStyle: 'purple',
                        activate:   () => {
                            if (!ALLOWED_PROTOCOLS.test(url)) return;
                            Gio.AppInfo.launch_default_for_uri(url, null);
                        },
                    });
                }
            } else {
                // type "open" — exact trigger match (case-insensitive)
                if (trimmed.toLowerCase() === trigger) {
                    const url = sc.url ?? '';
                    results.push({
                        id:         `shortcut:${trigger}`,
                        title:      sc.label ?? trigger,
                        subtitle:   url,
                        icon:       null,
                        iconName:   'web-browser-symbolic',
                        badgeLabel: trigger,
                        badgeStyle: 'purple',
                        activate:   () => {
                            if (!ALLOWED_PROTOCOLS.test(url)) return;
                            Gio.AppInfo.launch_default_for_uri(url, null);
                        },
                    });
                }
            }
        }

        return results;
    }

    _loadShortcuts() {
        try {
            const raw = this._settings.get_string('shortcuts');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_e) {
            return [];
        }
    }
}
