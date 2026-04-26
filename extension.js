// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { ProviderManager }  from './providerManager.js';
import { HistoryManager }   from './history.js';
import { LauncherWidget }   from './ui/launcher.js';
import { KapitIndicator }   from './ui/panelIndicator.js';

export default class KatipLauncher extends Extension {
    enable() {
        this._settings          = this.getSettings();
        this._providerManager   = null;
        this._history           = new HistoryManager();
        this._overlay           = null;
        this._backgroundBin     = null;
        this._monitorChangedId  = null;
        this._stageEventId      = null;
        this._focusWindowId     = null;
        this._focusGuardId      = null;
        this._grab              = null;
        this._indicator         = null;
        this._clipboardWatchId  = null;
        this._lastClipboardText = null;
        this._settingsIds       = [];

        // Seed default shortcuts if user has none yet
        this._seedDefaultShortcuts();

        // Start background clipboard watcher if the provider is enabled
        this._startClipboardWatcher();
        this._settingsIds.push(
            this._settings.connect('changed::enable-clipboard', () => {
                if (this._settings.get_boolean('enable-clipboard'))
                    this._startClipboardWatcher();
                else
                    this._stopClipboardWatcher();
            })
        );

        // Provider order — applied each time the launcher opens (via _open)
        this._settingsIds.push(
            this._settings.connect('changed::provider-order', () => this._applyProviderOrder())
        );

        // Panel indicator
        this._applyIndicatorSetting();
        this._settingsIds.push(
            this._settings.connect('changed::show-panel-indicator', () => {
                this._applyIndicatorSetting();
            })
        );

        // Keybinding
        Main.wm.addKeybinding(
            'toggle-launcher',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggle()
        );
    }

    disable() {
        Main.wm.removeKeybinding('toggle-launcher');
        this._removeIndicator();
        this._stopClipboardWatcher();
        this._close();
        this._history?.destroy();
        this._history = null;

        // Disconnect all settings signals
        for (const id of (this._settingsIds ?? []))
            this._settings.disconnect(id);
        this._settingsIds = null;
        this._settings    = null;
    }

    // ── Background clipboard watcher ─────────────────────────────────────────
    // Polls clipboard every second so history is built even while launcher is closed.
    // Only runs when enable-clipboard is true.

    _startClipboardWatcher() {
        if (this._clipboardWatchId) return; // already running
        try {
            if (!this._settings.get_boolean('enable-clipboard')) return;
        } catch (_e) { return; }

        const clipboard = St.Clipboard.get_default();
        if (!clipboard) return;

        this._clipboardWatchId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT_IDLE, 3, () => {
                if (!this._clipboardWatchId) return GLib.SOURCE_REMOVE;
                try {
                    clipboard.get_text(St.ClipboardType.CLIPBOARD, (_c, text) => {
                        if (!text || !text.trim()) return;
                        if (text === this._lastClipboardText) return;
                        this._lastClipboardText = text;
                        // Write to clipboard history file directly
                        this._appendClipboardEntry(text);
                    });
                } catch (_e) {}
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopClipboardWatcher() {
        if (this._clipboardWatchId) {
            GLib.source_remove(this._clipboardWatchId);
            this._clipboardWatchId = null;
        }
        this._lastClipboardText = null;
    }

    _appendClipboardEntry(text) {
        const dataDir  = GLib.build_filenamev([GLib.get_user_data_dir(), 'katip-launcher']);
        const histFile = GLib.build_filenamev([dataDir, 'clipboard.json']);
        let maxHistory = 50;
        try { maxHistory = Math.max(1, this._settings.get_int('clipboard-max-history') || 50); } catch (_e) {}
        const maxLen = 2000;

        try {
            // Read and migrate existing history to object format
            let history = [];
            try {
                const file = Gio.File.new_for_path(histFile);
                const [ok, contents] = file.load_contents(null);
                if (ok) {
                    const parsed = JSON.parse(new TextDecoder().decode(contents));
                    if (Array.isArray(parsed)) {
                        history = parsed
                            .map(e => {
                                if (typeof e === 'string') return { text: e, private: false };
                                if (e && typeof e.text === 'string') return { text: e.text, private: !!e.private };
                                return null;
                            })
                            .filter(e => e && e.text.length > 0);
                    }
                }
            } catch (_e) {}

            const trimmed = text.slice(0, maxLen);
            // Don't add if identical to most recent entry
            if (history[0]?.text === trimmed) return;

            // Preserve private flag if this text was already in history
            const existing = history.find(e => e.text === trimmed);
            const newEntry = { text: trimmed, private: existing?.private ?? false };
            history = [newEntry, ...history.filter(e => e.text !== trimmed)].slice(0, maxHistory);

            // Ensure directory exists
            const dir = Gio.File.new_for_path(dataDir);
            if (!dir.query_exists(null))
                dir.make_directory_with_parents(null);

            const outFile = Gio.File.new_for_path(histFile);
            outFile.replace_contents(
                new TextEncoder().encode(JSON.stringify(history, null, 2)),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            console.warn('[Katip] clipboard watcher write failed:', e.message);
        }
    }

    _applyProviderOrder() {
        if (!this._providerManager) return;
        try {
            const order = this._settings.get_string('provider-order');
            this._providerManager.applyOrder(order);
        } catch (_e) {}
    }

    // ── Panel indicator ───────────────────────────────────────────────────────

    _seedDefaultShortcuts() {
        const current = this._settings.get_string('shortcuts');
        let parsed = [];
        try { parsed = JSON.parse(current); } catch (_) {}
        if (Array.isArray(parsed) && parsed.length > 0) return;

        const defaults = [
            // Search engines
            { trigger: 'gg',   label: 'Google',          type: 'search', url: 'https://google.de/search?q={query}' },
            { trigger: 'aa',   label: 'Amazon',           type: 'search', url: 'https://www.amazon.de/s?k={query}' },
            { trigger: 'dd',   label: 'DuckDuckGo',       type: 'search', url: 'https://duckduckgo.com/?q={query}' },
            { trigger: 'ww',   label: 'Wikipedia',        type: 'search', url: 'https://en.wikipedia.org/w/index.php?search={query}' },
            // Development
            { trigger: 'gh',   label: 'GitHub',           type: 'search', url: 'https://github.com/search?q={query}' },
            { trigger: 'so',   label: 'Stack Overflow',   type: 'search', url: 'https://stackoverflow.com/search?q={query}' },
            { trigger: 'mdn',  label: 'MDN Web Docs',     type: 'search', url: 'https://developer.mozilla.org/en-US/search?q={query}' },
            { trigger: 'pypi', label: 'PyPI',             type: 'search', url: 'https://pypi.org/search/?q={query}' },
            // IT / Sysadmin
            { trigger: 'cve',  label: 'CVE Search',       type: 'search', url: 'https://www.google.com/search?q=CVE+{query}' },
            { trigger: 'pkg',  label: 'Fedora Packages',  type: 'search', url: 'https://packages.fedoraproject.org/search?searchterm={query}' },
            { trigger: 'man',  label: 'Linux man pages',  type: 'search', url: 'https://man7.org/linux/man-pages/man1/{query}.1.html' },
            { trigger: 'ad',   label: 'MS Docs',          type: 'search', url: 'https://learn.microsoft.com/en-us/search/?terms={query}' },
            // General
            { trigger: 'yt',   label: 'YouTube',          type: 'search', url: 'https://www.youtube.com/results?search_query={query}' },
            { trigger: 'maps', label: 'Google Maps',      type: 'search', url: 'https://www.google.com/maps/search/{query}' },
            { trigger: 'leo',  label: 'LEO Dictionary',   type: 'search', url: 'https://dict.leo.org/german-english/{query}' },
            { trigger: 'dict', label: 'Duden',            type: 'search', url: 'https://www.duden.de/suchen/dudenonline/{query}' },
            { trigger: 'wb',   label: 'Wayback Machine',  type: 'search', url: 'https://web.archive.org/web/*/{query}' },
            // Standalone
            { trigger: 'cal',  label: 'Google Calendar',  type: 'open',   url: 'https://calendar.google.com' },
        ];
        this._settings.set_string('shortcuts', JSON.stringify(defaults));
    }

    _applyIndicatorSetting() {
        if (this._settings.get_boolean('show-panel-indicator')) {
            if (!this._indicator) this._addIndicator();
        } else {
            this._removeIndicator();
        }
    }

    _addIndicator() {
        this._indicator = new KapitIndicator(
            () => this._open(),
            () => this._openPrefs()
        );
        Main.panel.addToStatusArea('katip-launcher', this._indicator);
    }

    _removeIndicator() {
        this._indicator?.destroy();
        this._indicator = null;
    }

    _openPrefs() {
        this._close();
        this.openPreferences();
    }

    // ── Toggle / Open / Close ────────────────────────────────────────────────

    _toggle() {
        if (this._overlay) this._close();
        else this._open();
    }

    _open() {
        if (this._overlay) return;

        this._providerManager = new ProviderManager(this._settings);
        this._applyProviderOrder();

        const showOverlay = this._settings.get_boolean('show-overlay');

        this._backgroundBin = new St.Bin({
            reactive: false,
            style: showOverlay
                ? 'background-color: rgba(0,0,0,0.5);'
                : 'background-color: transparent;',
        });

        this._overlay = new LauncherWidget(
            this._settings,
            this._providerManager,
            this._history,
            () => this._openPrefs()   // settings button callback
        );
        this._overlay.set_width(this._settings.get_int('launcher-width'));
        this._overlay.connect('close', () => this._close());

        // hw canvas chrome added after launcher chrome below

        // Both actors use affectsInputRegion:false so no input region is
        // claimed — this avoids the scroll/resize side-effect on Wayland.
        // Outside clicks are detected via a global stage capture instead.
        Main.layoutManager.addTopChrome(this._backgroundBin, {
            affectsInputRegion: false,
            affectsStruts: false,
            trackFullscreen: false,
        });
        Main.layoutManager.addTopChrome(this._overlay, {
            affectsInputRegion: false,
            affectsStruts: false,
            trackFullscreen: false,
        });

        // Add hw canvas AFTER launcher so it sits on top in Z-order
        const hwCanvas = this._overlay.getHwCanvas?.();
        if (hwCanvas) {
            Main.layoutManager.addTopChrome(hwCanvas.widget, {
                affectsInputRegion: false,
                affectsStruts:      false,
                trackFullscreen:    false,
            });
            // Border box sits on top of everything
            Main.layoutManager.addTopChrome(hwCanvas._borderBox, {
                affectsInputRegion: false,
                affectsStruts:      false,
                trackFullscreen:    false,
            });
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                hwCanvas?.reposition?.();
                return GLib.SOURCE_REMOVE;
            });
        }

        // global.stage.grab() routes all input through Shell while the launcher
        // is open, preventing scroll/click events reaching other Wayland surfaces.
        // Unlike pushModal it does not require an input region to be set.
        try {
            this._grab = global.stage.grab(this._overlay);
        } catch (_e) {
            // grab() not available (GNOME < 45) — fall back gracefully
            this._grab = null;
        }

        // With a grab active, all events are delivered to the grabbed actor (overlay).
        // We handle button-press on the overlay to detect outside clicks,
        // and handle event on the stage only as a fallback for scroll swallowing.
        this._stageEventId = this._overlay.connect('event', (_actor, event) => {
            const type = event.type();

            // Outside click — dismiss grab and close so the click reaches its target
            if (type === Clutter.EventType.BUTTON_PRESS) {
                const [ex, ey] = event.get_coords();
                const [ox, oy] = this._overlay.get_transformed_position();
                const [ow, oh] = [this._overlay.width, this._overlay.height];
                const inside = ex >= ox && ex <= ox + ow && ey >= oy && ey <= oy + oh;
                if (!inside) {
                    if (this._grab) {
                        this._grab.dismiss();
                        this._grab = null;
                    }
                    this._close();
                    return Clutter.EVENT_PROPAGATE;
                }
            }

            // Swallow scroll events that land outside the launcher widget
            if (type === Clutter.EventType.SCROLL) {
                const [ex, ey] = event.get_coords();
                const [ox, oy] = this._overlay.get_transformed_position();
                const [ow, oh] = [this._overlay.width, this._overlay.height];
                const inside = ex >= ox && ex <= ox + ow && ey >= oy && ey <= oy + oh;
                if (!inside) return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });

        this._positionOverlay();

        this._monitorChangedId = Main.layoutManager.connect(
            'monitors-changed', () => this._positionOverlay()
        );

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._overlay?.grabFocus();
            return GLib.SOURCE_REMOVE;
        });

        // Close when the user clicks into another window.
        // The guard flag ignores the first focus change that happens as the
        // launcher opens and grabs key focus from whatever had it before.
        let focusGuard = true;
        this._focusGuardId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this._focusGuardId = null;
            focusGuard = false;
            return GLib.SOURCE_REMOVE;
        });
        this._focusWindowId = global.display.connect('notify::focus-window', () => {
            if (focusGuard) return;
            if (!this._overlay) return;
            // Only close if a real window gained focus (not null, which happens
            // transiently during workspace switches or overview transitions)
            if (global.display.focus_window !== null)
                this._close();
        });
    }

    _close() {
        if (!this._overlay) return;

        if (this._focusGuardId) {
            GLib.source_remove(this._focusGuardId);
            this._focusGuardId = null;
        }

        // Remove hw canvas chrome — widget and borderBox are removed from the
        // layout manager here; hwCanvas.destroy() (called via overlay.destroy()
        // below) then destroys both GObjects and cancels any pending timers.
        const hwCanvas = this._overlay?.getHwCanvas?.();
        if (hwCanvas) {
            Main.layoutManager.removeChrome(hwCanvas.widget);
            if (hwCanvas._borderBox)
                Main.layoutManager.removeChrome(hwCanvas._borderBox);
        }

        if (this._grab) {
            this._grab.dismiss();
            this._grab = null;
        }

        if (this._stageEventId && this._overlay) {
            this._overlay.disconnect(this._stageEventId);
            this._stageEventId = null;
        }

        if (this._focusWindowId) {
            global.display.disconnect(this._focusWindowId);
            this._focusWindowId = null;
        }

        if (this._monitorChangedId) {
            Main.layoutManager.disconnect(this._monitorChangedId);
            this._monitorChangedId = null;
        }

        Main.layoutManager.removeChrome(this._overlay);
        this._overlay.destroy();
        this._overlay = null;

        Main.layoutManager.removeChrome(this._backgroundBin);
        this._backgroundBin?.destroy();
        this._backgroundBin = null;

        this._providerManager?.destroy();
        this._providerManager = null;
    }

    // ── Positioning ───────────────────────────────────────────────────────────

    _positionOverlay() {
        if (!this._overlay) return;

        const monitorIdx = global.display.get_current_monitor();
        const geom = global.display.get_monitor_geometry(monitorIdx);

        this._backgroundBin.set_position(geom.x, geom.y);
        this._backgroundBin.set_size(geom.width, geom.height);

        const launcherWidth = this._settings.get_int('launcher-width');
        const x = geom.x + Math.floor((geom.width - launcherWidth) / 2);
        const y = geom.y + Math.floor(geom.height * 0.20);

        this._overlay.set_position(x, y);
    }
}
