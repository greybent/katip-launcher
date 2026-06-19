// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';

// Each action: keywords to match, display info, the command to run, and whether
// it is destructive (loses your session / powers off the machine) and therefore
// requires a two-step Enter-to-confirm before it fires. Non-destructive actions
// (lock, suspend) run immediately on the first Enter.
const ACTIONS = [
    {
        id: 'lock', title: 'Lock screen',
        keywords: ['lock'],
        icon: 'system-lock-screen-symbolic',
        destructive: false,
        argv: ['loginctl', 'lock-session'],
    },
    {
        id: 'suspend', title: 'Suspend',
        keywords: ['suspend', 'sleep'],
        icon: 'weather-clear-night-symbolic',
        destructive: false,
        argv: ['systemctl', 'suspend'],
    },
    {
        id: 'logout', title: 'Log out',
        keywords: ['logout', 'log out', 'sign out', 'signout'],
        icon: 'system-log-out-symbolic',
        destructive: true,
        argv: ['gnome-session-quit', '--logout', '--no-prompt'],
    },
    {
        id: 'reboot', title: 'Restart',
        keywords: ['reboot', 'restart'],
        icon: 'system-reboot-symbolic',
        destructive: true,
        argv: ['systemctl', 'reboot'],
    },
    {
        id: 'shutdown', title: 'Shut down',
        keywords: ['shutdown', 'shut down', 'poweroff', 'power off'],
        icon: 'system-shutdown-symbolic',
        destructive: true,
        argv: ['systemctl', 'poweroff'],
    },
    {
        id: 'hibernate', title: 'Hibernate',
        keywords: ['hibernate'],
        icon: 'document-save-symbolic',
        destructive: true,
        argv: ['systemctl', 'hibernate'],
    },
];

/**
 * PowerProvider — session and power actions (lock, suspend, log out, restart,
 * shut down, hibernate).
 *
 * Destructive actions use a two-step confirm: the first Enter does NOT execute,
 * it re-renders the row into a "press Enter again to confirm" state (the launcher
 * stays open via activateKeepOpen). The second Enter runs it. This prevents a
 * stray Enter on an auto-selected "Shut down" result from killing your session.
 */
export class PowerProvider extends BaseProvider {
    get id()       { return 'power'; }
    get label()    { return 'Power'; }
    get priority() { return 18; } // just before apps (20)

    constructor(settings) {
        super(settings);
        // The destructive action waiting for a second Enter, or null. Lives on the
        // instance so it resets automatically when the launcher (and this provider)
        // is destroyed on close.
        this._armed = null;
    }

    query(text) {
        const needle = text.trim().toLowerCase();

        // While an action is armed, keep showing only its confirm row for as long
        // as the query still matches it; if the user typed something else, cancel.
        if (this._armed) {
            if (needle && this._matches(this._armed, needle))
                return [this._confirmResult(this._armed)];
            this._armed = null;
        }

        if (needle.length < 2) return [];

        return ACTIONS
            .filter(a => this._matches(a, needle))
            // Pin to the top only when the query is an exact keyword (e.g. typing
            // the full word "shutdown"), so a deliberate match outranks everything
            // else; partial matches stay at normal priority to avoid hijacking
            // short queries that also match apps.
            .map(a => this._actionResult(a, a.keywords.includes(needle)));
    }

    _matches(action, needle) {
        return action.keywords.some(k => k.startsWith(needle) || needle.startsWith(k));
    }

    _actionResult(action, exact) {
        return {
            id:         `power:${action.id}`,
            title:      action.title,
            subtitle:   action.destructive
                ? 'System action · Enter asks to confirm'
                : 'System action',
            icon:       null,
            iconName:   action.icon,
            badgeLabel: 'power',
            badgeStyle: action.destructive ? 'amber' : 'gray',
            forceTop:   exact,
            activate:   () => {
                if (action.destructive) this._arm(action);
                else this._run(action);
            },
            // Destructive actions keep the launcher open after the first Enter so
            // the re-query can show the confirm row instead of closing.
            activateKeepOpen: action.destructive,
        };
    }

    _confirmResult(action) {
        return {
            id:         `power:${action.id}:confirm`,
            title:      `${action.title} — press Enter again to confirm`,
            subtitle:   'Press Escape to cancel',
            icon:       null,
            iconName:   action.icon,
            badgeLabel: 'confirm',
            badgeStyle: 'amber',
            // Must stay selected so the second Enter actually confirms, even if a
            // frequently-used result would otherwise sort above it.
            forceTop:   true,
            activate:   () => this._run(action),
        };
    }

    _arm(action) {
        this._armed = action;
    }

    _run(action) {
        this._armed = null;
        try {
            Gio.Subprocess.new(action.argv, Gio.SubprocessFlags.NONE);
        } catch (e) {
            console.warn(`[Katip] PowerProvider: ${action.id} failed:`, e.message);
        }
    }
}
