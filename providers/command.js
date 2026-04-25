// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

const TRIGGER = 'shell ';

/**
 * CommandProvider — runs shell commands via the "shell " prefix.
 *
 * Usage:
 *   shell firefox          → launch silently via Gio.Subprocess
 *   shell htop             → auto-detects no display, opens in terminal
 *   Ctrl+Enter on result   → always force-open in terminal
 *
 * Terminal is read from the 'terminal-app' GSettings key (default: ptyxis).
 */
export class CommandProvider extends BaseProvider {
    get id()       { return 'command'; }
    get label()    { return 'Shell'; }
    get priority() { return 8; } // just after shortcuts, before windows

    query(text) {
        const trimmed = text.trim();
        if (!trimmed.toLowerCase().startsWith(TRIGGER)) return [];

        const cmd = trimmed.slice(TRIGGER.length).trim();
        if (!cmd) return [];

        const terminal = this._settings.get_string('terminal-app') || 'ptyxis';
        const needsTerm = this._likelyNeedsTerminal(cmd);

        return [{
            id:         `command:${cmd}`,
            title:      cmd,
            subtitle:   needsTerm
                ? `Run in ${terminal} · Ctrl+↵ to keep terminal open`
                : `Run silently · Ctrl+↵ to run in ${terminal}`,
            icon:       null,
            iconName:   needsTerm
                ? 'utilities-terminal-symbolic'
                : 'system-run-symbolic',
            badgeLabel: 'shell',
            badgeStyle: 'gray',

            // Enter: run — terminal closes when command exits
            activate: () => {
                if (needsTerm) {
                    this._runInTerminal(cmd, terminal, false);
                } else {
                    this._runSilent(cmd);
                }
            },

            // Ctrl+Enter: open in terminal and keep it open
            activateAlt:      () => this._runInTerminal(cmd, terminal, true),
            activateAltLabel: `Run in ${terminal} (stay open)`,
        }];
    }

    /**
     * Heuristic: does this command likely need a terminal?
     * Returns true if the binary exists in PATH but has no .desktop file,
     * or if the command contains pipes/redirects/shell syntax.
     */
    _likelyNeedsTerminal(cmd) {
        try {
            // Shell syntax always needs a terminal
            if (/[|;&<>$`]/.test(cmd)) return true;

            // Extract the binary name (first word)
            const bin = cmd.split(/\s+/)[0];

            // Check if there's a .desktop app for this binary — if so, GUI app
            const appSystem = Shell.AppSystem.get_default();
            if (appSystem) {
                const apps = appSystem.get_installed();
                for (const app of apps) {
                    const exe = app.app_info?.get_executable?.() ?? '';
                    if (exe === bin || exe.endsWith(`/${bin}`)) return false;
                }
            }

            // Check if binary exists in PATH
            const inPath = GLib.find_program_in_path(bin);
            if (!inPath) return true; // unknown binary — prefer terminal so error is visible

            // Known GUI app patterns
            if (/\.(py|rb|js|sh|bash|zsh|fish)$/.test(bin)) return true;

            return true; // default: prefer terminal for unknown binaries
        } catch (e) {
            console.warn('[Kapit] CommandProvider._likelyNeedsTerminal error:', e.message);
            return true; // safe default
        }
    }

    _runSilent(cmd) {
        try {
            const [ok, argv] = GLib.shell_parse_argv(cmd);
            if (!ok || !argv.length) return;
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            proc.wait_async(null, null); // don't block
        } catch (e) {
            console.warn('[Kapit] CommandProvider silent launch failed:', e.message);
            // Fallback to terminal
            const terminal = this._settings.get_string('terminal-app') || 'ptyxis';
            this._runInTerminal(cmd, terminal);
        }
    }

    // Run cmd in terminal, optionally keeping it open afterwards.
    // keepOpen=true wraps with bash -c 'cmd; exec bash' so the window stays.
    _runInTerminal(cmd, terminal, keepOpen = false) {
        try {
            const safeTerm = terminal.replace(/[^a-zA-Z0-9._/-]/g, '');
            if (!safeTerm) return;

            let argv;
            if (keepOpen) {
                // Keep terminal open after command exits by dropping into a shell
                argv = [safeTerm, '-e', `bash -c '${cmd.replace(/'/g, "'\''")}; exec bash'`];
            } else {
                argv = [safeTerm, '-e', cmd];
            }
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (e) {
            console.warn('[Kapit] CommandProvider terminal launch failed:', e.message);
        }
    }
}
