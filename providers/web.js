// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';

// Matches bare domains (google.com, sub.domain.co.uk) and https/http URLs only
const URL_RE = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/\S*)?$/;

export class WebProvider extends BaseProvider {
    get id()       { return 'web'; }
    get label()    { return 'Web'; }
    get priority() { return 50; }

    query(text) {
        const trimmed = text.trim();
        if (!trimmed) return [];

        const results = [];

        // ── URL detection ────────────────────────────────────────────────────
        if (URL_RE.test(trimmed)) {
            const url = /^[a-zA-Z]+:\/\//.test(trimmed)
                ? trimmed
                : `https://${trimmed}`;

            results.push({
                id:         'web:url',
                title:      `Open ${trimmed}`,
                subtitle:   url,
                icon:       null,
                iconName:   'web-browser-symbolic',
                badgeLabel: 'url',
                badgeStyle: 'teal',
                activate:   () => {
                    if (/^https?:\/\//i.test(url))
                        Gio.AppInfo.launch_default_for_uri(url, null);
                },
            });
        }

        // ── Web search ───────────────────────────────────────────────────────
        const engineUrl   = this._settings.get_string('web-search-engine');
        const engineLabel = this._settings.get_string('web-search-label');
        const searchUrl   = engineUrl.replaceAll('{query}', encodeURIComponent(trimmed));

        results.push({
            id:         'web:search',
            title:      `Search "${trimmed}"`,
            subtitle:   `Open in ${engineLabel}`,
            icon:       null,
            iconName:   'system-search-symbolic',
            badgeLabel: 'web',
            badgeStyle: 'purple',
            activate:   () => Gio.AppInfo.launch_default_for_uri(searchUrl, null),
        });

        return results;
    }
}
