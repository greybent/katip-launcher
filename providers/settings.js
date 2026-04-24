// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';

const TRIGGER = 'settings ';

// GNOME Settings panels — display name + D-Bus activation path
const PANELS = [
    { name: 'Wi-Fi',              keywords: ['wifi', 'wireless', 'network', 'wlan'],     panel: 'wifi' },
    { name: 'Bluetooth',          keywords: ['bluetooth', 'bt'],                          panel: 'bluetooth' },
    { name: 'Display',            keywords: ['display', 'screen', 'resolution', 'monitor', 'hdmi'], panel: 'display' },
    { name: 'Sound',              keywords: ['sound', 'audio', 'volume', 'speaker', 'microphone', 'mic'], panel: 'sound' },
    { name: 'Power',              keywords: ['power', 'battery', 'sleep', 'suspend'],    panel: 'power' },
    { name: 'Notifications',      keywords: ['notifications', 'notify', 'alerts'],       panel: 'notifications' },
    { name: 'Search',             keywords: ['search'],                                   panel: 'search' },
    { name: 'Privacy',            keywords: ['privacy', 'location', 'camera'],           panel: 'privacy' },
    { name: 'Online Accounts',    keywords: ['accounts', 'google', 'microsoft', 'cloud', 'online'], panel: 'online-accounts' },
    { name: 'Sharing',            keywords: ['sharing', 'remote', 'vnc', 'rdp'],         panel: 'sharing' },
    { name: 'Keyboard',           keywords: ['keyboard', 'shortcut', 'input'],           panel: 'keyboard' },
    { name: 'Mouse & Touchpad',   keywords: ['mouse', 'touchpad', 'pointer', 'cursor'],  panel: 'mouse' },
    { name: 'Printers',           keywords: ['printer', 'print', 'cups'],                panel: 'printers' },
    { name: 'Region & Language',  keywords: ['language', 'locale', 'region', 'timezone', 'format'], panel: 'region' },
    { name: 'Accessibility',      keywords: ['accessibility', 'a11y', 'contrast', 'zoom'], panel: 'universal-access' },
    { name: 'Users',              keywords: ['users', 'accounts', 'password', 'user'],   panel: 'user-accounts' },
    { name: 'Date & Time',        keywords: ['date', 'time', 'clock', 'ntp'],            panel: 'datetime' },
    { name: 'About',              keywords: ['about', 'system', 'info', 'version'],      panel: 'info-overview' },
    { name: 'Appearance',         keywords: ['appearance', 'theme', 'wallpaper', 'dark', 'light'], panel: 'background' },
    { name: 'Apps',               keywords: ['apps', 'applications', 'default'],         panel: 'applications' },
    { name: 'Network',            keywords: ['network', 'vpn', 'proxy', 'ethernet', 'lan'], panel: 'network' },
    { name: 'Multitasking',       keywords: ['multitasking', 'workspaces', 'overview'],  panel: 'multitasking' },
];

export class SettingsProvider extends BaseProvider {
    get id()       { return 'settings'; }
    get label()    { return 'Settings'; }
    get priority() { return 12; } // between command and windows

    query(text) {
        const trimmed = text.trim().toLowerCase();

        // Only activate when text starts with "settings "
        if (!trimmed.startsWith(TRIGGER)) return [];

        const needle = trimmed.slice(TRIGGER.length).trim();

        const matches = PANELS.filter(p =>
            !needle ||
            p.name.toLowerCase().includes(needle) ||
            p.keywords.some(k => k.includes(needle))
        );

        return matches.map(p => ({
            id:         `settings:${p.panel}`,
            title:      p.name,
            subtitle:   'GNOME Settings',
            icon:       null,
            iconName:   'preferences-system-symbolic',
            badgeLabel: 'settings',
            badgeStyle: 'blue',
            activate:   () => this._openPanel(p.panel),
            activateAlt: null,
        }));
    }

    _openPanel(panel) {
        try {
            Gio.AppInfo.launch_default_for_uri(`gnome-control-center://${panel}`, null);
        } catch (_e) {
            // Fallback: launch gnome-control-center directly
            try {
                Gio.Subprocess.new(['gnome-control-center', panel], Gio.SubprocessFlags.NONE);
            } catch (e) {
                console.warn('[Kapit] SettingsProvider: cannot open panel', panel, e.message);
            }
        }
    }
}
