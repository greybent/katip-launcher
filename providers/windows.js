// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import * as fuzzy from '../ui/fuzzy.js';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';

export class WindowsProvider extends BaseProvider {
    get id() { return 'windows'; }
    get label() { return 'Windows'; }
    get priority() { return 10; }

    query(text) {
        const results = [];
        const tracker = Shell.WindowTracker.get_default();
        const actors = global.get_window_actors();

        for (const actor of actors) {
            const win = actor.get_meta_window();

            if (!win) continue;
            if (win.is_skip_taskbar()) continue;
            if (win.get_window_type() !== Meta.WindowType.NORMAL) continue;

            const title = win.get_title() ?? '';
            const appName = win.get_wm_class() ?? '';
            const combined = `${title} ${appName}`;

            if (text.length > 0 && !fuzzy.match(text, combined)) continue;

            const app = tracker.get_window_app(win);
            const icon = app?.get_icon() ?? null;
            const iconName = icon ? null : 'window-symbolic';
            const workspace = win.get_workspace()?.index() ?? 0;

            results.push({
                id: `window:${win.get_stable_sequence()}`,
                title,
                subtitle: `${appName} · workspace ${workspace + 1}`,
                icon,
                iconName,
                badgeLabel: 'window',
                badgeStyle: 'teal',
                activate: () => {
                    win.activate(global.get_current_time());
                    const ws = win.get_workspace();
                    if (ws) ws.activate(global.get_current_time());
                },
            });
        }

        return results;
    }
}
