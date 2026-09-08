// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';
import { makeTmpPath, pruneStale } from '../secureTmp.js';

const TRIGGER = 'proc ';

export class ProcessProvider extends BaseProvider {
    get id()       { return 'process'; }
    get label()    { return 'Processes'; }
    get priority() { return 35; } // after files, before calculator

    // Runs `ps` without blocking the compositor. GNOME Shell is single
    // threaded, so a synchronous spawn here would freeze the whole desktop
    // for the duration of every keystroke.
    _spawnRead(argv) {
        return new Promise(resolve => {
            let proc;
            try {
                proc = Gio.Subprocess.new(argv,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            } catch (e) {
                console.warn('[Katip] ProcessProvider spawn failed:', e.message);
                resolve('');
                return;
            }
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [, stdout] = p.communicate_utf8_finish(res);
                    resolve(stdout ?? '');
                } catch (e) {
                    console.warn('[Katip] ProcessProvider read failed:', e.message);
                    resolve('');
                }
            });
        });
    }

    async query(text) {
        const trimmed = text.trim();
        if (!trimmed.toLowerCase().startsWith(TRIGGER)) return [];

        const needle = trimmed.slice(TRIGGER.length).trim().toLowerCase();
        if (!needle) return [];

        // "pid=,args=" gives exactly two fields with args last, so a process
        // name containing spaces cannot bleed into the wrong column the way it
        // does with a three-field "pid,comm,args" format.
        const output = await this._spawnRead(['ps', '-eo', 'pid=,args=']);
        if (!output) return [];

        const results = [];

        for (const line of output.split('\n')) {
            const m = /^\s*(\d+)\s+(.*\S)\s*$/.exec(line);
            if (!m) continue;

            const pid  = m[1];
            const args = m[2];

            // Kernel threads are reported as "[kthreadd]" and have nothing to show
            if (args.startsWith('[') && args.endsWith(']')) continue;

            // Display name: basename of argv[0], e.g. "/usr/bin/firefox" → "firefox"
            const argv0 = args.split(/\s+/)[0];
            const comm  = argv0.slice(argv0.lastIndexOf('/') + 1);

            // Skip the `ps` invocation we just made ourselves
            if (comm === 'ps') continue;

            if (!comm.toLowerCase().includes(needle) &&
                !args.toLowerCase().includes(needle)) continue;

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
    }

    _killProcess(pid, _comm) {
        try {
            if (!/^\d+$/.test(pid)) return; // safety guard
            Gio.Subprocess.new(['kill', pid], Gio.SubprocessFlags.NONE);
        } catch (e) {
            console.warn('[Katip] ProcessProvider kill error:', e.message);
        }
    }

    async _showDetails(pid) {
        try {
            if (!/^\d+$/.test(pid)) return; // safety guard

            const lines = [];

            const psOut = await this._spawnRead(['ps', '-p', pid, '-f']);
            if (psOut) lines.push(psOut.trim());

            lines.push('');

            try {
                const [, statusBytes] = Gio.File.new_for_path(`/proc/${pid}/status`)
                    .load_contents(null);
                lines.push(new TextDecoder().decode(statusBytes).trim());
            } catch (_e) {}

            // Process details are written to a private 0700 directory under an
            // unpredictable name, not to a guessable path in the shared /tmp.
            pruneStale();
            const tmpPath = makeTmpPath(`proc-${pid}`, '.txt');
            if (!tmpPath) return;

            Gio.File.new_for_path(tmpPath).replace_contents(
                new TextEncoder().encode(lines.join('\n')),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION | Gio.FileCreateFlags.PRIVATE,
                null
            );
            // Handed to an external viewer, so it cannot be deleted here —
            // pruneStale() above clears it on a later run, and the runtime dir
            // is wiped at logout.
            Gio.AppInfo.launch_default_for_uri(`file://${tmpPath}`, null);
        } catch (e) {
            console.warn('[Katip] ProcessProvider show details error:', e.message);
        }
    }
}
