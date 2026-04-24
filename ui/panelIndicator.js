// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * KapitIndicator — top-bar panel button with right-click menu.
 *
 * Left-click  → open launcher
 * Right-click → popup menu (Open launcher / Settings / Disable)
 */
export const KapitIndicator = GObject.registerClass(
    class KapitIndicator extends PanelMenu.Button {

        _init(onOpen, onPrefs) {
            super._init(0.0, 'Kapit Launcher');

            this._onOpen  = onOpen;
            this._onPrefs = onPrefs;

            // Panel icon — use symbolic SVG from our icons/ folder
            const icon = new St.Icon({
                style_class: 'system-status-icon',
            });

            // Try loading our custom symbolic icon; fall back to system-search
            try {
                const gicon = new St.FileIcon({ path: this._getIconPath() });
                icon.gicon = gicon;
            } catch (_e) {
                icon.icon_name = 'system-search-symbolic';
            }

            this.add_child(icon);

            // Left-click opens launcher directly
            this.connect('button-press-event', (_actor, event) => {
                if (event.get_button() === 1) {
                    this.menu.close();
                    this._onOpen();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            // ── Popup menu ───────────────────────────────────────────────────

            const openItem = new PopupMenu.PopupMenuItem('Open Kapit');
            openItem.connect('activate', () => this._onOpen());
            this.menu.addMenuItem(openItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const prefsItem = new PopupMenu.PopupMenuItem('Settings…');
            prefsItem.connect('activate', () => this._onPrefs());
            this.menu.addMenuItem(prefsItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const disableItem = new PopupMenu.PopupMenuItem('Disable Kapit');
            disableItem.connect('activate', () => {
                const { extensionManager } = Main;
                const ext = extensionManager.lookup('kapit-launcher@local');
                if (ext) extensionManager.disableExtension(ext);
            });
            this.menu.addMenuItem(disableItem);
        }

        _getIconPath() {
            // Walk up from this file to find the extension root
            // Extensions live at: ~/.local/share/gnome-shell/extensions/kapit-launcher@local/
            const candidates = [
                GLib.build_filenamev([
                    GLib.get_home_dir(),
                    '.local', 'share', 'gnome-shell', 'extensions',
                    'kapit-launcher@local', 'icons', 'kapit-launcher-symbolic.svg',
                ]),
            ];
            for (const p of candidates) {
                if (GLib.file_test(p, GLib.FileTest.EXISTS)) return p;
            }
            throw new Error('icon not found');
        }
    }
);
