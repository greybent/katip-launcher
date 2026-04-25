// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import * as fuzzy from '../ui/fuzzy.js';
import Shell from 'gi://Shell';

export class AppsProvider extends BaseProvider {
    get id()       { return 'apps'; }
    get label()    { return 'Apps'; }
    get priority() { return 20; }

    constructor(settings) {
        super(settings);
        this._appSystem = Shell.AppSystem.get_default();
    }

    query(text) {
        const apps = this._appSystem.get_installed();
        const results = [];

        for (const app of apps) {
            const name = app.get_name() ?? '';
            if (!name) continue;

            const appInfo = app.app_info;
            if (appInfo?.get_nodisplay()) continue;

            const appId      = app.get_id() ?? '';
            const executable = appInfo?.get_executable() ?? '';

            const description = appInfo?.get_description() ?? '';
            const keywords    = appInfo?.get_keywords()?.join(' ') ?? '';
            const combined    = `${name} ${description} ${keywords}`;

            if (text.length > 0 && !fuzzy.match(text, combined)) continue;

            results.push({
                id:         `app:${appId}`,
                title:      name,
                subtitle:   description || executable,
                icon:       app.get_icon(),
                iconName:   null,
                badgeLabel: 'app',
                badgeStyle: 'blue',
                activate:   () => {
                    const freshApp = this._appSystem.lookup_app(appId);
                    if (!freshApp) {
                        appInfo?.launch(null, null);
                        return;
                    }
                    const state = freshApp.get_state();
                    if (state === Shell.AppState.RUNNING)
                        freshApp.activate();
                    else
                        freshApp.launch(0, -1, Shell.AppLaunchGpu.APP_PREF);
                },
            });
        }

        if (text.length > 0)
            results.sort((a, b) => fuzzy.score(text, b.title) - fuzzy.score(text, a.title));

        return results;
    }
}
