// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const TRIGGER = 'proc ';

export class ProcessProvider extends BaseProvider {
    get id()       { return 'process'; }
    get label()    { return 'Processes'; }
    get priority() { return 35; } // after files, before calculator

    query(text) {
        const trimmed = text.trim();
        if (!trimmed.toLowerCase().startsWith(TRIGGER)) return [];

        const needle = trimmed.slice(TRIGGER.length).trim().toLowerCase();
        if (!needle) return [];

        try {
            const [ok, stdout] = GLib.spawn_command_line_sync(
                `ps -eo pid,comm,args --no-headers`
            );
            if (!ok || !stdout) return [];

            const output = new TextDecoder().decode(stdout);
            const results = [];

            for (const line of output.split('\n')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 2) continue;

                const pid  = parts[0];
                const comm = parts[1];
                const args = parts.slice(2).join(' ');

                // Validate PID is a positive integer before any shell use
                if (!/^\d+$/.test(pid)) continue;

                if (!comm.toLowerCase().includes(needle) &&
                    !args.toLowerCase().includes(needle)) continue;

                // Skip kernel threads (no args) and the ps command itself
                if (!args || comm === 'ps') continue;

                const preview = args.length > 60 ? args.slice(0, 60) + '…' : args;
                results.push({
                    id:               `process:${pid}`,
                    title:            `${comm} (${pid})`,
                    subtitle:         preview,
                    icon:             null,
                    iconName:         'system-run-symbolic',
                    badgeLabel:       'proc',
                    badgeStyle:       'amber',
                    activate:         () => this._killProcess(pid, comm),
                    activateAlt:      () => this._showDetails(pid),
                    activateAltLabel: 'Show details',
                });

                if (results.length >= 20) break;
            }
            return results;
        } catch (e) {
            console.warn('[Kapit] ProcessProvider error:', e.message);
            return [];
        }
    }

    _killProcess(pid, comm) {
        try {
            if (!/^\d+$/.test(pid)) return; // safety guard
            GLib.spawn_command_line_async(`kill ${pid}`);
            console.log(`[Kapit] ProcessProvider: sent SIGTERM to ${comm} (${pid})`);
        } catch (e) {
            console.warn('[Kapit] ProcessProvider kill error:', e.message);
        }
    }

    _showDetails(pid) {
        try {
            if (!/^\d+$/.test(pid)) return; // safety guard
            const terminal = this._settings.get_string('terminal-app') || 'kgx';
            Gio.Subprocess.new(
                [terminal, '-e', `bash -c 'ps -p ${pid} -f; echo; cat /proc/${pid}/status 2>/dev/null; exec bash'`],
                Gio.SubprocessFlags.NONE
            );
        } catch (e) {
            console.warn('[Kapit] ProcessProvider show details error:', e.message);
        }
    }
}
