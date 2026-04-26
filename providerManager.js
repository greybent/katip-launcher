// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { ShortcutsProvider }   from './providers/shortcuts.js';
import { CommandProvider }     from './providers/command.js';
import { WindowsProvider }     from './providers/windows.js';
import { ClipboardProvider }   from './providers/clipboard.js';
import { AppsProvider }        from './providers/apps.js';
import { FilesProvider }       from './providers/files.js';
import { SettingsProvider }    from './providers/settings.js';
import { ProcessProvider }     from './providers/process.js';
import { CalculatorProvider }  from './providers/calculator.js';
import { TimerProvider }       from './providers/timer.js';
import { WebProvider }         from './providers/web.js';

const REGISTRY = [
    { key: 'enable-shortcuts',  Cls: ShortcutsProvider,  alwaysOn: true },
    { key: 'enable-command',    Cls: CommandProvider,     alwaysOn: true },
    { key: 'enable-windows',    Cls: WindowsProvider },
    { key: 'enable-clipboard',  Cls: ClipboardProvider },
    { key: 'enable-apps',       Cls: AppsProvider },
    { key: 'enable-files',      Cls: FilesProvider },
    { key: 'enable-settings',   Cls: SettingsProvider,    alwaysOn: true },
    { key: 'enable-process',    Cls: ProcessProvider },
    { key: 'enable-calculator', Cls: CalculatorProvider },
    { key: 'enable-timer',      Cls: TimerProvider,       alwaysOn: true },
    { key: 'enable-web',        Cls: WebProvider },
];

export class ProviderManager {
    constructor(settings, clipboardHistory = null) {
        this._settings         = settings;
        this._clipboardHistory = clipboardHistory;
        this._providers        = [];
        this._load();
    }

    _load() {
        for (const { key, Cls, alwaysOn } of REGISTRY) {
            // alwaysOn providers (shortcuts) don't have a settings toggle
            if (!alwaysOn && !this._settings.get_boolean(key)) continue;
            try {
                const provider = Cls === ClipboardProvider
                    ? new Cls(this._settings, this._clipboardHistory)
                    : new Cls(this._settings);
                const originalQuery = provider.query.bind(provider);
                provider.query = (text) => {
                    const ret = originalQuery(text);
                    const stamp = (results) => {
                        const prio = provider._customPriority ?? provider.priority;
                        return results.map(r => ({ ...r, _providerPriority: prio }));
                    };
                    if (ret && typeof ret.then === 'function')
                        return ret.then(stamp);
                    return stamp(Array.isArray(ret) ? ret : []);
                };
                this._providers.push(provider);
            } catch (e) {
                console.error(`[Kapit] Failed to load provider ${Cls.name}:`, e);
            }
        }
        this._providers.sort((a, b) => a.priority - b.priority);
    }

    get providers() {
        return this._providers;
    }

    // Apply user-defined provider order from settings.
    // Providers not in the order list keep their default priority.
    applyOrder(orderJson) {
        try {
            const order = JSON.parse(orderJson);
            if (!Array.isArray(order) || order.length === 0) return;
            // Use 1000+ range to avoid any collision with hardcoded provider
            // priorities (which are all below 100).
            for (const provider of this._providers) {
                const idx = order.indexOf(provider.id);
                if (idx !== -1) {
                    provider._customPriority = 1000 + idx;
                } else {
                    // Provider not in custom order — push to end after ordered ones
                    provider._customPriority = 2000 + provider.priority;
                }
            }
        } catch (_e) {}
    }

    destroy() {
        for (const p of this._providers) {
            try { p.destroy(); } catch (_) {}
        }
        this._providers = [];
    }
}
