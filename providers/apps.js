// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import * as fuzzy from '../ui/fuzzy.js';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

export class AppsProvider extends BaseProvider {
    get id()       { return 'apps'; }
    get label()    { return 'Apps'; }
    get priority() { return 20; }

    constructor(settings) {
        super(settings);
        this._appSystem = Shell.AppSystem.get_default();
    }

    query(text) {
        const results = [];
        const apps = this._appSystem.get_installed();

        for (const app of apps) {
            const name = app.get_name() ?? '';
            if (!name) continue;

            const appInfo     = app.app_info;
            const description = appInfo?.get_description() ?? '';
            const keywords    = appInfo?.get_keywords()?.join(' ') ?? '';
            const nodisplay   = appInfo?.get_nodisplay() ?? false;

            if (nodisplay) continue;

            const combined = `${name} ${description} ${keywords}`;
            if (text.length > 0 && !fuzzy.match(text, combined)) continue;

            const executable = appInfo?.get_executable() ?? '';
            const appId = app.get_id() ?? '';

            results.push({
                id:         `app:${appId}`,
                title:      name,
                subtitle:   description || executable,
                icon:       app.get_icon(),
                iconName:   null,
                badgeLabel: 'app',
                badgeStyle: 'blue',
                activate:   () => {
                    // Re-lookup the app at activation time so we always
                    // get the current running state, not the stale query-time one.
                    const freshApp = this._appSystem.lookup_app(appId);
                    if (!freshApp) {
                        // Fallback: launch via Gio directly
                        if (appInfo)
                            appInfo.launch(null, null);
                        return;
                    }

                    const state = freshApp.get_state();
                    if (state === Shell.AppState.RUNNING) {
                        freshApp.activate();
                    } else {
                        // launch_action with no action name = default launch
                        freshApp.launch(0, -1, Shell.AppLaunchGpu.APP_PREF);
                    }
                },
            });
        }

        if (text.length > 0)
            results.sort((a, b) => fuzzy.score(text, b.title) - fuzzy.score(text, a.title));

        return results;
    }
}
