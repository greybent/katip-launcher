// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';

// Matches bare domains (google.com, sub.domain.co.uk) and https/http URLs only
const URL_RE = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/\S*)?$/;

// Common source/text file extensions that look like bare domains
// (e.g. "index.js", "config.yaml") but should not be treated as URLs unless
// an explicit http(s):// scheme is present.
const FILENAME_EXT_RE = /\.(js|mjs|cjs|ts|tsx|jsx|json|ya?ml|toml|ini|cfg|conf|txt|md|py|rb|sh|bash|zsh|c|h|cpp|hpp|rs|go|java|kt|php|lua|sql|css|scss|html?|xml|csv|log|png|jpe?g|gif|svg|pdf|zip|tar|gz)$/i;

export class WebProvider extends BaseProvider {
    get id()       { return 'web'; }
    get label()    { return 'Web'; }
    get priority() { return 50; }

    query(text) {
        const trimmed = text.trim();
        if (!trimmed) return [];

        const results = [];

        // ── URL detection ────────────────────────────────────────────────────
        const hasScheme = /^[a-zA-Z]+:\/\//.test(trimmed);
        // Skip filename-looking input (e.g. "index.js") unless it has a scheme
        // or a path component, so plain filenames don't masquerade as URLs.
        const looksLikeFilename = !hasScheme &&
            !trimmed.includes('/') &&
            FILENAME_EXT_RE.test(trimmed);

        if (URL_RE.test(trimmed) && !looksLikeFilename) {
            const url = hasScheme ? trimmed : `https://${trimmed}`;

            results.push({
                id:         'web:url',
                title:      `Open ${trimmed}`,
                subtitle:   url,
                icon:       null,
                iconName:   'web-browser-symbolic',
                badgeLabel: 'url',
                badgeStyle: 'teal',
                // A typed-out URL is almost always what the user wants — pin it
                // above everything, regardless of how often the search result
                // below has been used.
                forceTop:   true,
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
            activate:   () => {
                if (/^https?:\/\//i.test(searchUrl))
                    Gio.AppInfo.launch_default_for_uri(searchUrl, null);
            },
        });

        return results;
    }
}
