// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const TRIGGER = 'timer ';

// Parse duration strings like "25m", "1h30m", "90s", "2h", "1h 30m 10s"
function parseDuration(text) {
    let total = 0;
    const re = /(\d+)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi;
    let match;
    while ((match = re.exec(text)) !== null) {
        const val  = parseInt(match[1]);
        const unit = match[2][0].toLowerCase();
        if      (unit === 'h') total += val * 3600;
        else if (unit === 'm') total += val * 60;
        else if (unit === 's') total += val;
    }
    // Bare number with no unit → assume minutes
    if (total === 0 && /^\d+$/.test(text.trim()))
        total = parseInt(text.trim()) * 60;
    return total;
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || !parts.length) parts.push(`${s}s`);
    return parts.join(' ');
}

export class TimerProvider extends BaseProvider {
    get id()       { return 'timer'; }
    get label()    { return 'Timer'; }
    get priority() { return 42; } // just after calculator

    query(text) {
        const trimmed = text.trim().toLowerCase();
        if (!trimmed.startsWith(TRIGGER)) return [];

        const rest    = text.trim().slice(TRIGGER.length).trim();
        if (!rest) return [];

        // Split optional label from duration: "25m standup" or "standup 25m"
        // Strategy: extract all duration tokens, rest is the label
        const durationSecs = parseDuration(rest);
        if (!durationSecs || durationSecs <= 0) return [];

        const label = rest
            .replace(/(\d+)\s*(h(?:ours?)?|m(?:in(?:utes?)?)?|s(?:ec(?:onds?)?)?)/gi, '')
            .replace(/^\d+$/, '')
            .trim() || 'Timer';

        const display = formatDuration(durationSecs);

        return [{
            id:         `timer:${durationSecs}:${label}`,
            title:      `${display} — ${label}`,
            subtitle:   `Send notification in ${display} · Note: timer is lost if GNOME Shell restarts`,
            icon:       null,
            iconName:   'alarm-symbolic',
            badgeLabel: 'timer',
            badgeStyle: 'purple',
            activate:   () => this._startTimer(durationSecs, label, display),
            activateAlt: null,
        }];
    }

    _startTimer(seconds, label, display) {
        // Use GLib.timeout_add_seconds to fire a GNOME notification
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._sendNotification(label, display);
            return GLib.SOURCE_REMOVE;
        });
    }

    _sendNotification(label, display) {
        try {
            // Use notify-send as it's universally available and reliable
            Gio.Subprocess.new(
                ['notify-send',
                 '--icon=alarm',
                 '--urgency=normal',
                 `Timer: ${label}`,
                 `${display} elapsed`],
                Gio.SubprocessFlags.NONE
            );
        } catch (e) {
            console.warn('[Kapit] TimerProvider notification error:', e.message);
        }
    }
}
