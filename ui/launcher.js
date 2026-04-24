// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import { ResultItem } from './resultItem.js';

const DEBOUNCE_MS = 150;

const PROVIDER_LABELS = {
    shortcuts:  'Shortcuts',
    command:    'Shell',
    windows:    'Windows',
    apps:       'Applications',
    files:      'Files',
    calculator: 'Calculator',
    web:        'Web',
};

// Text-based provider prefixes.
// Maps lowercase keyword → provider id.
// The prefix character (default '/') is prepended at query time from settings.
// Both bare words ("file x") and prefixed ("/file x") are supported.
const TEXT_PREFIXES = {
    'file':       'files',
    'files':      'files',
    'window':     'windows',
    'windows':    'windows',
    'win':        'windows',
    'app':        'apps',
    'apps':       'apps',
    'calc':       'calculator',
    'calculator': 'calculator',
    'web':        'web',
    'search':     'web',
    'clip':       'clipboard',
    'clipboard':  'clipboard',
};

// Provider IDs that require a GSettings key to be true before their
// TEXT_PREFIXES keyword is honoured. If the key is false the keyword
// falls through to a normal all-provider search.
const PREFIX_REQUIRES_ENABLED = {
    'clipboard': 'enable-clipboard',
    'process':   'enable-process',
};

// Prefix-only keywords (only active with the prefix char, e.g. /web)
const PREFIXED_ONLY = {};

// Keywords that route to a provider but pass the FULL original text (including
// the keyword itself) to the provider, because the provider parses its own trigger.
// 'shell' is handled this way — CommandProvider expects "shell <cmd>" intact.
const PASSTHROUGH_PREFIXES = {
    'shell': 'command',
};

// Maps org.gnome.desktop.interface accent-color string values to hex colors.
// Each entry: [light-mode hex, dark-mode hex]
const ACCENT_COLORS = {
    blue:   ['#1c71d8', '#78aeed'],
    teal:   ['#0a7c72', '#4fd2c2'],
    green:  ['#2a7e32', '#8de16a'],
    yellow: ['#9c8c00', '#f8e45c'],
    orange: ['#c84800', '#ffa348'],
    red:    ['#c01c28', '#ff7070'],
    pink:   ['#a5367a', '#dc8fcc'],
    purple: ['#613583', '#c061cb'],
    slate:  ['#3d4858', '#9db3c8'],
    zinc:   ['#4a4a4a', '#b0b0b0'],
};

// Cached settings object for org.gnome.desktop.interface — created once,
// reused across theme builds, avoids constructing a new GSettings on every
// launcher open. Cleared when the last LauncherWidget is destroyed.
let _desktopSettings = null;
let _desktopSettingsRefCount = 0;

function _acquireDesktopSettings() {
    if (!_desktopSettings) {
        try {
            _desktopSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        } catch (_e) {}
    }
    _desktopSettingsRefCount++;
    return _desktopSettings;
}

function _releaseDesktopSettings() {
    _desktopSettingsRefCount = Math.max(0, _desktopSettingsRefCount - 1);
    if (_desktopSettingsRefCount === 0) {
        _desktopSettings = null;
    }
}

function buildSystemTheme(desktopSettings) {
    let isDark  = true;
    let accentL = '#1c71d8'; // fallback light
    let accentD = '#78aeed'; // fallback dark

    try {
        const s = desktopSettings;
        if (s) {
            isDark = s.get_string('color-scheme') === 'prefer-dark';
            const pair = ACCENT_COLORS[s.get_string('accent-color')] ?? ACCENT_COLORS.blue;
            accentL = pair[0];
            accentD = pair[1];
        }
    } catch (_e) {}

    const accent   = isDark ? accentD : accentL;
    const accentRgb = hexToRgb(accent);
    const bg       = isDark ? '#1e1e1e' : '#f6f5f4';
    const surface  = isDark ? '#2a2a2a' : '#ffffff';
    const text     = isDark ? '#eeeeee' : '#1a1a1a';
    const textMid  = isDark ? 'rgba(238,238,238,0.6)' : 'rgba(26,26,26,0.6)';
    const textLow  = isDark ? 'rgba(238,238,238,0.35)' : 'rgba(26,26,26,0.35)';
    const border   = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
    const borderLo = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const hover    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const iconBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    const chipBase   = `color: ${textMid}; background-color: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}; border: 1px solid ${borderLo}; border-radius: 20px; padding: 3px 10px; font-size: 12px;`;
    const chipHover  = `color: ${text}; background-color: ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}; border: 1px solid ${border}; border-radius: 20px; padding: 3px 10px; font-size: 12px;`;
    const chipActive = `color: ${accent}; background-color: rgba(${accentRgb},0.14); border: 1px solid rgba(${accentRgb},0.38); border-radius: 20px; padding: 3px 10px; font-size: 12px;`;
    const chipActiveHover = `color: ${accent}; background-color: rgba(${accentRgb},0.22); border: 1px solid rgba(${accentRgb},0.52); border-radius: 20px; padding: 3px 10px; font-size: 12px;`;

    return {
        launcher:         `background-color: ${bg}; border: 1px solid ${border}; border-radius: 12px;`,
        searchRow:        `border-bottom: 1px solid ${borderLo};`,
        searchEntry:      `color: ${text}; caret-color: ${accent};`,
        chipRow:          `border-bottom: 1px solid ${borderLo}; background-color: ${isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)'};`,
        chip:             chipBase,
        chipHover:        chipHover,
        chipActive:       chipActive,
        chipActiveHover:  chipActiveHover,
        sectionLabel:     `color: rgba(${isDark ? '238,238,238' : '26,26,26'},0.32);`,
        sectionLine:      `background-color: ${borderLo};`,
        resultHover:      `background-color: ${hover};`,
        resultActive:     `background-color: rgba(${accentRgb},0.10);`,
        resultIcon:       `background-color: ${iconBg};`,
        resultTitle:      `color: ${text};`,
        resultSubtitle:   `color: ${textMid};`,
        footer:           `border-top: 1px solid ${borderLo}; background-color: ${isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)'}; border-radius: 0 0 12px 12px;`,
        footerText:       `color: ${textLow};`,
        footerHint:       `color: ${isDark ? 'rgba(238,238,238,0.22)' : 'rgba(26,26,26,0.22)'};`,
        kbd:              `color: ${textMid}; background-color: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}; border: 1px solid ${borderLo}; border-radius: 4px; padding: 1px 5px; font-size: 11px;`,
        settingsBtn:      `color: ${textLow}; border-radius: 6px; padding: 4px 5px; background-color: transparent; border: none;`,
        settingsBtnHover: `color: ${text}; border-radius: 6px; padding: 4px 5px; background-color: ${hover}; border: none;`,
    };
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r},${g},${b}`;
}

// ── Theme definitions ────────────────────────────────────────────────────────
// All colors applied as inline styles (St pseudo-class :hover doesn't work
// with inline styles, so hover is handled via enter-event/leave-event signals).
const THEMES = {
    dark: {
        launcher:           'background-color: #1e1e2e; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px;',
        searchRow:          'border-bottom: 1px solid rgba(255,255,255,0.08);',
        searchEntry:        'color: #cdd6f4; caret-color: #89b4fa;',
        chipRow:            'border-bottom: 1px solid rgba(255,255,255,0.08); background-color: rgba(0,0,0,0.15);',
        chip:               'color: rgba(205,214,244,0.6); background-color: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipHover:          'color: #cdd6f4; background-color: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActive:         'color: #89b4fa; background-color: rgba(137,180,250,0.15); border: 1px solid rgba(137,180,250,0.4); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActiveHover:    'color: #a8c8ff; background-color: rgba(137,180,250,0.22); border: 1px solid rgba(137,180,250,0.55); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        sectionLabel:       'color: rgba(205,214,244,0.35);',
        sectionLine:        'background-color: rgba(255,255,255,0.07);',
        resultHover:        'background-color: rgba(255,255,255,0.06);',
        resultActive:       'background-color: rgba(137,180,250,0.12);',
        resultIcon:         'background-color: rgba(255,255,255,0.07);',
        resultTitle:        'color: #cdd6f4;',
        resultSubtitle:     'color: rgba(205,214,244,0.5);',
        footer:             'border-top: 1px solid rgba(255,255,255,0.07); background-color: rgba(0,0,0,0.15); border-radius: 0 0 12px 12px;',
        footerText:         'color: rgba(205,214,244,0.45);',
        footerHint:         'color: rgba(205,214,244,0.3);',
        kbd:                'color: rgba(205,214,244,0.5); background-color: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 1px 5px; font-size: 11px;',
        settingsBtn:        'color: rgba(205,214,244,0.4); border-radius: 6px; padding: 4px 5px; background-color: transparent; border: none;',
        settingsBtnHover:   'color: #cdd6f4; border-radius: 6px; padding: 4px 5px; background-color: rgba(255,255,255,0.10); border: none;',
    },
    // Muted: warm medium-dark gray, earthy tones, amber accent
    muted: {
        launcher:           'background-color: #2a2825; border: 1px solid rgba(255,220,180,0.10); border-radius: 12px;',
        searchRow:          'border-bottom: 1px solid rgba(255,220,180,0.07);',
        searchEntry:        'color: #d4cfc8; caret-color: #c8a96e;',
        chipRow:            'border-bottom: 1px solid rgba(255,220,180,0.07); background-color: rgba(0,0,0,0.18);',
        chip:               'color: rgba(212,207,200,0.5); background-color: rgba(255,220,180,0.04); border: 1px solid rgba(255,220,180,0.10); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipHover:          'color: #d4cfc8; background-color: rgba(255,220,180,0.09); border: 1px solid rgba(255,220,180,0.18); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActive:         'color: #c8a96e; background-color: rgba(200,169,110,0.14); border: 1px solid rgba(200,169,110,0.35); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActiveHover:    'color: #dfc080; background-color: rgba(200,169,110,0.22); border: 1px solid rgba(200,169,110,0.50); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        sectionLabel:       'color: rgba(212,207,200,0.28);',
        sectionLine:        'background-color: rgba(255,220,180,0.06);',
        resultHover:        'background-color: rgba(255,220,180,0.05);',
        resultActive:       'background-color: rgba(200,169,110,0.10);',
        resultIcon:         'background-color: rgba(255,220,180,0.05);',
        resultTitle:        'color: #d4cfc8;',
        resultSubtitle:     'color: rgba(212,207,200,0.45);',
        footer:             'border-top: 1px solid rgba(255,220,180,0.06); background-color: rgba(0,0,0,0.18); border-radius: 0 0 12px 12px;',
        footerText:         'color: rgba(212,207,200,0.38);',
        footerHint:         'color: rgba(212,207,200,0.22);',
        kbd:                'color: rgba(212,207,200,0.42); background-color: rgba(255,220,180,0.05); border: 1px solid rgba(255,220,180,0.10); border-radius: 4px; padding: 1px 5px; font-size: 11px;',
        settingsBtn:        'color: rgba(212,207,200,0.32); border-radius: 6px; padding: 4px 5px; background-color: transparent; border: none;',
        settingsBtnHover:   'color: #d4cfc8; border-radius: 6px; padding: 4px 5px; background-color: rgba(255,220,180,0.07); border: none;',
    },
    light: {
        launcher:           'background-color: #ffffff; border: 1px solid rgba(0,0,0,0.12); border-radius: 12px;',
        searchRow:          'border-bottom: 1px solid rgba(0,0,0,0.07);',
        searchEntry:        'color: #1c1c2e; caret-color: #3a6bc9;',
        chipRow:            'border-bottom: 1px solid rgba(0,0,0,0.07); background-color: rgba(0,0,0,0.02);',
        chip:               'color: rgba(28,28,46,0.55); background-color: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.10); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipHover:          'color: #1c1c2e; background-color: rgba(0,0,0,0.10); border: 1px solid rgba(0,0,0,0.18); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActive:         'color: #3a6bc9; background-color: rgba(58,107,201,0.10); border: 1px solid rgba(58,107,201,0.35); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActiveHover:    'color: #2a5bb9; background-color: rgba(58,107,201,0.17); border: 1px solid rgba(58,107,201,0.50); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        sectionLabel:       'color: rgba(28,28,46,0.38);',
        sectionLine:        'background-color: rgba(0,0,0,0.07);',
        resultHover:        'background-color: rgba(0,0,0,0.04);',
        resultActive:       'background-color: rgba(58,107,201,0.08);',
        resultIcon:         'background-color: rgba(0,0,0,0.05);',
        resultTitle:        'color: #1c1c2e;',
        resultSubtitle:     'color: rgba(28,28,46,0.5);',
        footer:             'border-top: 1px solid rgba(0,0,0,0.07); background-color: rgba(0,0,0,0.02); border-radius: 0 0 12px 12px;',
        footerText:         'color: rgba(28,28,46,0.45);',
        footerHint:         'color: rgba(28,28,46,0.3);',
        kbd:                'color: rgba(28,28,46,0.45); background-color: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.12); border-radius: 4px; padding: 1px 5px; font-size: 11px;',
        settingsBtn:        'color: rgba(28,28,46,0.38); border-radius: 6px; padding: 4px 5px; background-color: transparent; border: none;',
        settingsBtnHover:   'color: #1c1c2e; border-radius: 6px; padding: 4px 5px; background-color: rgba(0,0,0,0.08); border: none;',
    },
    // Pastel: medium dark with soft pastel pink/lavender accents
    pastel: {
        launcher:           'background-color: #2d2438; border: 1px solid rgba(220,180,255,0.15); border-radius: 12px;',
        searchRow:          'border-bottom: 1px solid rgba(220,180,255,0.10);',
        searchEntry:        'color: #e8d8f0; caret-color: #d4a8e8;',
        chipRow:            'border-bottom: 1px solid rgba(220,180,255,0.10); background-color: rgba(0,0,0,0.18);',
        chip:               'color: rgba(232,216,240,0.5); background-color: rgba(220,180,255,0.05); border: 1px solid rgba(220,180,255,0.12); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipHover:          'color: #e8d8f0; background-color: rgba(220,180,255,0.10); border: 1px solid rgba(220,180,255,0.22); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActive:         'color: #d4a8e8; background-color: rgba(212,168,232,0.16); border: 1px solid rgba(212,168,232,0.38); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActiveHover:    'color: #e8c4f8; background-color: rgba(212,168,232,0.24); border: 1px solid rgba(212,168,232,0.52); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        sectionLabel:       'color: rgba(232,216,240,0.30);',
        sectionLine:        'background-color: rgba(220,180,255,0.08);',
        resultHover:        'background-color: rgba(220,180,255,0.06);',
        resultActive:       'background-color: rgba(212,168,232,0.12);',
        resultIcon:         'background-color: rgba(220,180,255,0.07);',
        resultTitle:        'color: #e8d8f0;',
        resultSubtitle:     'color: rgba(232,216,240,0.48);',
        footer:             'border-top: 1px solid rgba(220,180,255,0.08); background-color: rgba(0,0,0,0.18); border-radius: 0 0 12px 12px;',
        footerText:         'color: rgba(232,216,240,0.40);',
        footerHint:         'color: rgba(232,216,240,0.22);',
        kbd:                'color: rgba(232,216,240,0.45); background-color: rgba(220,180,255,0.07); border: 1px solid rgba(220,180,255,0.12); border-radius: 4px; padding: 1px 5px; font-size: 11px;',
        settingsBtn:        'color: rgba(232,216,240,0.38); border-radius: 6px; padding: 4px 5px; background-color: transparent; border: none;',
        settingsBtnHover:   'color: #e8d8f0; border-radius: 6px; padding: 4px 5px; background-color: rgba(220,180,255,0.09); border: none;',
    },
    // Soft: near-black, green-tinted accent, very minimal chips
    soft: {
        launcher:           'background-color: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;',
        searchRow:          'border-bottom: 1px solid rgba(255,255,255,0.06);',
        searchEntry:        'color: #c8c8c8; caret-color: #7ab87a;',
        chipRow:            'border-bottom: 1px solid rgba(255,255,255,0.05); background-color: rgba(0,0,0,0.25);',
        chip:               'color: rgba(200,200,200,0.35); background-color: transparent; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipHover:          'color: rgba(200,200,200,0.6); background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActive:         'color: #7ab87a; background-color: rgba(122,184,122,0.12); border: 1px solid rgba(122,184,122,0.30); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        chipActiveHover:    'color: #96cc96; background-color: rgba(122,184,122,0.20); border: 1px solid rgba(122,184,122,0.45); border-radius: 20px; padding: 3px 10px; font-size: 12px;',
        sectionLabel:       'color: rgba(200,200,200,0.22);',
        sectionLine:        'background-color: rgba(255,255,255,0.04);',
        resultHover:        'background-color: rgba(255,255,255,0.04);',
        resultActive:       'background-color: rgba(122,184,122,0.09);',
        resultIcon:         'background-color: rgba(255,255,255,0.05);',
        resultTitle:        'color: #c8c8c8;',
        resultSubtitle:     'color: rgba(200,200,200,0.4);',
        footer:             'border-top: 1px solid rgba(255,255,255,0.05); background-color: rgba(0,0,0,0.25); border-radius: 0 0 12px 12px;',
        footerText:         'color: rgba(200,200,200,0.32);',
        footerHint:         'color: rgba(200,200,200,0.18);',
        kbd:                'color: rgba(200,200,200,0.35); background-color: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; padding: 1px 5px; font-size: 11px;',
        settingsBtn:        'color: rgba(200,200,200,0.3); border-radius: 6px; padding: 4px 5px; background-color: transparent; border: none;',
        settingsBtnHover:   'color: rgba(200,200,200,0.65); border-radius: 6px; padding: 4px 5px; background-color: rgba(255,255,255,0.06); border: none;',
    },
};

export const LauncherWidget = GObject.registerClass(
    { Signals: { 'close': {} } },
    class LauncherWidget extends St.BoxLayout {

        _init(settings, providerManager, history, onPrefs) {
            super._init({
                vertical: true,
                style_class: 'katip-launcher',
                reactive: true,
            });

            this._settings        = settings;
            this._providerManager = providerManager;
            this._history         = history;
            this._onPrefs         = onPrefs;
            this._results         = [];
            this._activeIndex     = 0;
            this._activeMode      = 'all';
            this._debounceId      = null;
            this._resultItems     = [];
            this._queryGen        = 0;
            // Acquire cached desktop settings for system theme
            this._desktopSettings = _acquireDesktopSettings();
            this._t               = this._getTheme();

            this.set_style(this._t.launcher);

            this._buildSearchBar();
            this._buildModeChips();
            this._buildResultsBox();
            this._buildFooter();
        }

        _getTheme() {
            let name = 'dark';
            try { name = this._settings.get_string('color-theme') ?? 'dark'; } catch (_e) {}

            // System theme — built dynamically from GSettings
            if (name === 'system') return buildSystemTheme(this._desktopSettings);

            // Check user custom themes first
            try {
                const raw = this._settings.get_string('custom-themes');
                const customs = JSON.parse(raw);
                if (Array.isArray(customs)) {
                    const custom = customs.find(t => t.name === name);
                    if (custom) {
                        const base = THEMES[custom.base] ?? THEMES.dark;
                        return { ...base, ...(custom.overrides ?? {}) };
                    }
                }
            } catch (_e) {}

            return THEMES[name] ?? THEMES.dark;
        }

        _connectSystemThemeSignals() {
            this._disconnectSystemThemeSignals();
            try {
                this._ifaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
                this._systemThemeIds = [];
                for (const key of ['color-scheme', 'accent-color']) {
                    this._systemThemeIds.push(
                        this._ifaceSettings.connect(`changed::${key}`, () => {
                            if (this._settings.get_string('color-theme') === 'system')
                                this._rebuildTheme();
                        })
                    );
                }
            } catch (_e) {}
        }

        _disconnectSystemThemeSignals() {
            try {
                if (this._ifaceSettings) {
                    for (const id of (this._systemThemeIds ?? []))
                        this._ifaceSettings.disconnect(id);
                    this._ifaceSettings = null;
                }
                this._systemThemeIds = [];
            } catch (_e) {}
        }

        _rebuildTheme() {
            this._t = this._getTheme();
            this.set_style(this._t.launcher);
            if (this._searchRow) this._searchRow.set_style(this._t.searchRow);
            if (this._entry) this._entry.set_style(this._t.searchEntry);
            if (this._escLabel) this._escLabel.set_style(this._t.kbd);
            if (this._chipBox) this._chipBox.set_style(this._t.chipRow);
            for (const [id, chip] of Object.entries(this._chips ?? {})) {
                const isActive = id === this._activeMode;
                chip.set_style(isActive ? this._t.chipActive : this._t.chip);
            }
            if (this._footer) this._footer.set_style(this._t.footer);
            // Rebuild footer label styles
            for (const lbl of (this._footerKeyLabels ?? []))
                lbl.set_style(this._t.kbd);
            for (const lbl of (this._footerTextLabels ?? []))
                lbl.set_style(`font-size: 11px; ${this._t.footerText}`);
            if (this._footerHintLabel)
                this._footerHintLabel.set_style(`font-size: 11px; ${this._t.footerHint}`);
        }

        // Wire hover highlight on any St.Button using JS signals,
        // since set_style() overrides :hover pseudo-class CSS entirely.
        _addHover(btn, normalStyle, hoverStyle) {
            btn.connect('enter-event', () => {
                btn.set_style(hoverStyle);
                return Clutter.EVENT_PROPAGATE;
            });
            btn.connect('leave-event', () => {
                btn.set_style(normalStyle);
                return Clutter.EVENT_PROPAGATE;
            });
        }

        // ── Build ────────────────────────────────────────────────────────────

        _buildSearchBar() {
            const t = this._t;

            this._searchRow = new St.BoxLayout({
                style_class: 'kapit-search-row',
                style: t.searchRow,
                x_expand: true,
            });

            this._searchRow.add_child(new St.Icon({
                icon_name: 'system-search-symbolic',
                icon_size: 16,
                style: `margin: 0 8px 0 4px; opacity: 0.6;`,
                y_align: Clutter.ActorAlign.CENTER,
            }));

            this._entry = new St.Entry({
                style_class: 'kapit-search-entry',
                style: t.searchEntry,
                hint_text: 'Search apps, files, calculate…',
                x_expand: true,
                can_focus: true,
            });
            this._entry.clutter_text.connect('text-changed', () => this._scheduleQuery());
            this._entry.clutter_text.connect('key-press-event', (_a, ev) => this._onKeyPress(ev));

            this._searchRow.add_child(this._entry);

            this._escLabel = new St.Label({
                text: 'Esc',
                style_class: 'kapit-kbd-hint',
                style: t.kbd,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._searchRow.add_child(this._escLabel);

            const settingsBtn = new St.Button({
                style_class: 'kapit-settings-btn',
                style: t.settingsBtn,
                can_focus: false,
                reactive: true,
                track_hover: true,
                y_align: Clutter.ActorAlign.CENTER,
                child: new St.Icon({
                    icon_name: 'emblem-system-symbolic',
                    icon_size: 14,
                }),
            });
            settingsBtn.connect('clicked', () => {
                // Schedule prefs after the close signal so the overlay is
                // fully destroyed before the prefs window opens
                const onPrefs = this._onPrefs;
                this.emit('close');
                if (onPrefs) {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        onPrefs();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            });
            this._addHover(settingsBtn, t.settingsBtn, t.settingsBtnHover);
            this._searchRow.add_child(settingsBtn);
            this.add_child(this._searchRow);
        }

        _buildModeChips() {
            const t = this._t;

            this._chipBox = new St.BoxLayout({
                style_class: 'kapit-chip-row',
                style: t.chipRow,
                x_expand: true,
            });

            this._chips = {};
            const modes = [
                { id: 'all', label: 'All' },
                ...this._providerManager.providers.map(p => ({ id: p.id, label: p.label })),
            ];

            for (const mode of modes) {
                const isActive = mode.id === 'all';
                const chip = new St.Button({
                    label: mode.label,
                    style_class: 'kapit-chip',
                    style: isActive ? t.chipActive : t.chip,
                    reactive: true,
                    track_hover: true,
                    can_focus: false,
                });
                chip.connect('clicked', () => this._setMode(mode.id));
                // Hover: use chipHover for inactive, chipActiveHover for active
                chip.connect('enter-event', () => {
                    const isActive = this._activeMode === mode.id;
                    chip.set_style(isActive ? this._t.chipActiveHover : this._t.chipHover);
                    return Clutter.EVENT_PROPAGATE;
                });
                chip.connect('leave-event', () => {
                    const isActive = this._activeMode === mode.id;
                    chip.set_style(isActive ? this._t.chipActive : this._t.chip);
                    return Clutter.EVENT_PROPAGATE;
                });
                this._chips[mode.id] = chip;
                this._chipBox.add_child(chip);
            }

            this.add_child(this._chipBox);
        }

        _buildResultsBox() {
            this._resultsBox = new St.BoxLayout({
                vertical: true,
                x_expand: true,
                style_class: 'kapit-results-box',
            });
            this.add_child(this._resultsBox);
        }

        _buildFooter() {
            const t = this._t;

            this._footer = new St.BoxLayout({
                style_class: 'kapit-footer',
                style: t.footer,
                x_expand: true,
            });

            this._footerKeyLabels  = [];
            this._footerTextLabels = [];
            for (const [key, desc] of [['↑ ↓', 'navigate'], ['↵', 'open'], ['⇥', 'filter']]) {
                const hint = new St.BoxLayout({ style: 'margin-right: 14px;' });
                const keyLbl = new St.Label({
                    text: key,
                    style_class: 'kapit-kbd-hint',
                    style: t.kbd,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                const descLbl = new St.Label({
                    text: ` ${desc}`,
                    style: `font-size: 11px; ${t.footerText}`,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                this._footerKeyLabels.push(keyLbl);
                this._footerTextLabels.push(descLbl);
                hint.add_child(keyLbl);
                hint.add_child(descLbl);
                this._footer.add_child(hint);
            }

            this._altHintBox = new St.BoxLayout({ style: 'margin-right: 14px;', visible: false });
            this._altHintBox.add_child(new St.Label({
                text: 'Ctrl+↵',
                style_class: 'kapit-kbd-hint',
                style: t.kbd,
                y_align: Clutter.ActorAlign.CENTER,
            }));
            this._altHintLabel = new St.Label({
                text: '',
                style: `font-size: 11px; ${t.footerText}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._altHintBox.add_child(this._altHintLabel);
            this._footer.add_child(this._altHintBox);

            this._footer.add_child(new St.Widget({ x_expand: true }));

            // Format the actual keybinding from settings for display
            const accelStr = (() => {
                try {
                    const raw = this._settings.get_strv('toggle-launcher')[0] ?? '<Control>space';
                    return raw
                        .replace('<Control>', 'Ctrl+')
                        .replace('<Shift>', 'Shift+')
                        .replace('<Alt>', 'Alt+')
                        .replace('<Super>', 'Super+')
                        .replace('<Primary>', 'Ctrl+')
                        .replace('space', 'Space')
                        .replace('Return', 'Enter');
                } catch (_e) { return 'Ctrl+Space'; }
            })();
            this._footerHintLabel = new St.Label({
                text: accelStr,
                style: `font-size: 11px; ${t.footerHint}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._footer.add_child(this._footerHintLabel);

            this.add_child(this._footer);
        }

        // ── Mode ─────────────────────────────────────────────────────────────

        _setMode(modeId) {
            const t = this._t;
            if (this._chips[this._activeMode])
                this._chips[this._activeMode].set_style(t.chip);
            this._activeMode = modeId;
            if (this._chips[modeId])
                this._chips[modeId].set_style(t.chipActive);
            this._entry.grab_key_focus();
            this._runQuery(this._entry.get_text());
        }

        // Visually highlight the chip matching a detected text prefix.
        // Uses a distinct accent ring rather than fully activating the chip,
        // so the user can see the filter is text-driven (not chip-selected).
        _updateChipForPrefix(prefixProviderId) {
            const t = this._t;
            for (const [id, chip] of Object.entries(this._chips ?? {})) {
                const isChipActive  = id === this._activeMode;
                const isPrefixMatch = id === prefixProviderId;
                if (isPrefixMatch && !isChipActive) {
                    // Highlight without marking as the active chip
                    chip.set_style(t.chipActive +
                        ' box-shadow: 0 0 0 2px rgba(255,255,255,0.25);');
                } else {
                    chip.set_style(isChipActive ? t.chipActive : t.chip);
                }
            }
        }

        // ── Query ─────────────────────────────────────────────────────────────

        _scheduleQuery() {
            if (this._debounceId) {
                GLib.source_remove(this._debounceId);
                this._debounceId = null;
            }
            this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
                this._debounceId = null;
                this._runQuery(this._entry.get_text());
                return GLib.SOURCE_REMOVE;
            });
        }

        // Parse a text prefix from the query, e.g. "file budget.pdf" or "/file budget.pdf".
        // Returns { providerId, searchText } or null if no prefix detected.
        // Fully wrapped in try/catch — a missing schema key must never break _runQuery.
        _parseTextPrefix(text) {
            if (!text) return null;

            // Read prefix char — default '/' if key missing (schema not compiled yet)
            let prefixChar = '/';
            try {
                const val = this._settings.get_string('text-prefix-char');
                if (val) prefixChar = val;
            } catch (_e) { /* key not in schema yet — use default */ }

            try {

            // Try slash-prefixed form first: "/keyword rest"
            if (text.startsWith(prefixChar)) {
                const rest = text.slice(prefixChar.length);
                const spaceIdx = rest.indexOf(' ');
                const keyword = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
                const providerId = TEXT_PREFIXES[keyword] ?? PREFIXED_ONLY[keyword];
                if (keyword && providerId) {
                    // If this provider requires being enabled, check the setting
                    const requiredKey = PREFIX_REQUIRES_ENABLED[providerId];
                    if (requiredKey) {
                        try {
                            if (!this._settings.get_boolean(requiredKey)) return null;
                        } catch (_e) { return null; }
                    }
                    return {
                        providerId,
                        searchText:  spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1),
                        prefixUsed:  prefixChar + keyword,
                    };
                }
            }

            // Try bare keyword form: "keyword rest" — only when followed by a space
            const spaceIdx = text.indexOf(' ');
            if (spaceIdx > 0) {
                const keyword = text.slice(0, spaceIdx).toLowerCase();

                // Passthrough: route to provider but keep full text intact
                if (PASSTHROUGH_PREFIXES[keyword]) {
                    return {
                        providerId:  PASSTHROUGH_PREFIXES[keyword],
                        searchText:  text,   // full text — provider parses its own trigger
                        prefixUsed:  keyword,
                        passthrough: true,
                    };
                }

                if (TEXT_PREFIXES[keyword]) {
                    const pid = TEXT_PREFIXES[keyword];
                    // If this provider requires being enabled, check the setting
                    const requiredKey = PREFIX_REQUIRES_ENABLED[pid];
                    if (requiredKey) {
                        try {
                            if (!this._settings.get_boolean(requiredKey)) {
                                // Provider disabled — fall through to normal search
                                return null;
                            }
                        } catch (_e) { return null; }
                    }
                    return {
                        providerId:  pid,
                        searchText:  text.slice(spaceIdx + 1),
                        prefixUsed:  keyword,
                    };
                }
            }

            return null;
            } catch (_e) {
                // Parsing error — return null so _runQuery falls back to normal behaviour
                return null;
            }
        }

        _runQuery(text) {
            const gen = ++this._queryGen;
            const maxResults = this._settings.get_int('max-results');

            // Check for text-based prefix filter, e.g. "file budget" or "/win firefox"
            const prefixMatch = this._parseTextPrefix(text);
            const effectiveMode = prefixMatch ? prefixMatch.providerId : this._activeMode;
            const effectiveText = prefixMatch ? prefixMatch.searchText  : text;

            // Highlight the matching chip when a prefix is detected
            this._updateChipForPrefix(prefixMatch ? prefixMatch.providerId : null);

            const providers = effectiveMode === 'all'
                ? this._providerManager.providers
                : this._providerManager.providers.filter(p => p.id === effectiveMode);

            const syncResults = [];

            for (const provider of providers) {
                try {
                    const ret = provider.query(effectiveText);
                    if (ret && typeof ret.then === 'function') {
                        ret.then(results => {
                            if (gen !== this._queryGen) return;
                            // Guard against widget being destroyed before async result arrives
                            if (!this.get_parent()) return;
                            this._spliceResults(this._applyHistory(results, effectiveText), maxResults);
                        }).catch(e => console.warn(`[Kapit] async ${provider.id}:`, e.message));
                    } else {
                        syncResults.push(...(Array.isArray(ret) ? ret : []));
                    }
                } catch (e) {
                    console.warn(`[Kapit] provider ${provider.id} threw:`, e.message);
                }
            }

            if (gen !== this._queryGen) return;
            this._displayResults(this._applyHistory(syncResults, effectiveText).slice(0, maxResults));
        }

        _applyHistory(results, text) {
            if (!this._history) return results;
            if (!text) {
                // Recent-first mode: sort entirely by history score, ignoring provider priority
                let recentFirst = false;
                try { recentFirst = this._settings.get_boolean('results-recent-first'); } catch (_e) {}
                if (recentFirst) {
                    return [...results].sort((a, b) =>
                        this._history.getScore(b.id) - this._history.getScore(a.id)
                    );
                }
                // Default: sort by provider priority, break ties with history score
                return [...results].sort((a, b) => {
                    if (a._providerPriority !== b._providerPriority)
                        return (a._providerPriority ?? 99) - (b._providerPriority ?? 99);
                    return this._history.getScore(b.id) - this._history.getScore(a.id);
                });
            }
            return [...results].sort((a, b) => {
                const ha = this._history.getScore(a.id);
                const hb = this._history.getScore(b.id);
                return ((hb > 5 ? 1 : 0) - (ha > 5 ? 1 : 0)) || (hb - ha);
            });
        }

        _spliceResults(newResults, maxResults) {
            this._displayResults([...this._results, ...newResults].slice(0, maxResults));
        }

        // ── Display ───────────────────────────────────────────────────────────

        _displayResults(results) {
            for (const item of this._resultItems) item.destroy();
            this._resultItems = [];
            this._resultsBox.remove_all_children();

            this._results     = results;
            this._activeIndex = results.length > 0 ? 0 : -1;

            const t           = this._t;
            const showHeaders = this._settings.get_boolean('show-section-headers');
            let lastPriority  = null;

            for (let i = 0; i < results.length; i++) {
                const result   = results[i];
                const priority = result._providerPriority ?? 99;

                if (showHeaders && priority !== lastPriority) {
                    // Match by _customPriority if set, otherwise by default priority
                    const providerId = this._providerManager.providers
                        .find(p => (p._customPriority ?? p.priority) === priority)?.id ?? '';
                    const label = (PROVIDER_LABELS[providerId] ?? providerId).toUpperCase();

                    const headerRow = new St.BoxLayout({
                        style_class: 'kapit-section-header',
                        x_expand: true,
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    headerRow.add_child(new St.Label({
                        text: label,
                        style_class: 'kapit-section-label',
                        style: t.sectionLabel,
                        y_align: Clutter.ActorAlign.CENTER,
                    }));
                    const line = new St.Widget({
                        style_class: 'kapit-section-line',
                        style: t.sectionLine,
                        x_expand: true,
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    headerRow.add_child(line);
                    this._resultsBox.add_child(headerRow);
                    lastPriority = priority;
                }

                const item = new ResultItem(result, i === 0, t);
                item.actor.connect('enter-event', () => {
                    this._setActiveIndex(i);
                    return Clutter.EVENT_PROPAGATE;
                });
                item.actor.connect('button-press-event', (_a, event) => {
                    const ctrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
                    if (event.get_button() === 2 || ctrl) {
                        if (result.activateAlt) {
                            result.activateAlt();
                            if (result.activateAltKeepOpen) {
                                this._runQuery(this._entry.get_text());
                                return Clutter.EVENT_STOP;
                            }
                        }
                    }
                    else
                        this._activateResult(result);
                    this.emit('close');
                    return Clutter.EVENT_STOP;
                });
                this._resultItems.push(item);
                this._resultsBox.add_child(item.actor);
            }

            this._updateAltHint();
        }

        _setActiveIndex(idx) {
            if (idx < 0 || idx >= this._results.length) return;
            this._resultItems[this._activeIndex]?.setActive(false);
            this._activeIndex = idx;
            this._resultItems[this._activeIndex]?.setActive(true);
            this._updateAltHint();
        }

        _updateAltHint() {
            const result = this._results[this._activeIndex];
            if (result?.activateAlt && result?.activateAltLabel) {
                let hint = ` ${result.activateAltLabel}`;
                if (result.activateDel) hint += ' · Del to delete';
                this._altHintLabel.set_text(hint);
                this._altHintBox.visible = true;
            } else if (result?.activateDel) {
                this._altHintLabel.set_text(' Del to delete');
                this._altHintBox.visible = true;
            } else {
                this._altHintBox.visible = false;
            }
        }

        _activateResult(result) {
            this._history?.record(result.id);
            result.activate?.();
        }

        // ── Keyboard ──────────────────────────────────────────────────────────

        _onKeyPress(event) {
            const sym  = event.get_key_symbol();
            const ctrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;

            switch (sym) {
            case Clutter.KEY_Escape:
            case Clutter.KEY_Super_L:
            case Clutter.KEY_Super_R:
                this.emit('close');
                return Clutter.EVENT_STOP;

            case Clutter.KEY_Delete: {
                const delResult = this._results[this._activeIndex];
                if (delResult?.activateDel) {
                    delResult.activateDel();
                    this._runQuery(this._entry.get_text());
                }
                return Clutter.EVENT_STOP;
            }
            case Clutter.KEY_Up:
                this._setActiveIndex(this._activeIndex - 1);
                return Clutter.EVENT_STOP;
            case Clutter.KEY_Down:
                this._setActiveIndex(this._activeIndex + 1);
                return Clutter.EVENT_STOP;
            case Clutter.KEY_Return:
            case Clutter.KEY_KP_Enter: {
                const result = this._results[this._activeIndex];
                if (result) {
                    if (ctrl && result.activateAlt) {
                        result.activateAlt();
                        if (result.activateAltKeepOpen) {
                            // Refresh results in place instead of closing
                            this._runQuery(this._entry.get_text());
                            return Clutter.EVENT_STOP;
                        }
                    } else {
                        this._activateResult(result);
                    }
                    this.emit('close');
                }
                return Clutter.EVENT_STOP;
            }
            case Clutter.KEY_Tab:
                this._cycleMode();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        _cycleMode() {
            const ids = ['all', ...this._providerManager.providers.map(p => p.id)];
            const cur = ids.indexOf(this._activeMode);
            this._setMode(ids[(cur + 1) % ids.length]);
        }

        grabFocus() {
            global.stage.set_key_focus(this._entry);
            this._entry.grab_key_focus();
            this._connectSystemThemeSignals();
            this._runQuery('');
        }

        destroy() {
            if (this._debounceId) {
                GLib.source_remove(this._debounceId);
                this._debounceId = null;
            }
            this._disconnectSystemThemeSignals();
            _releaseDesktopSettings();
            this._desktopSettings = null;
            super.destroy();
        }
    }
);
