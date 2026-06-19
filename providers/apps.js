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

        let withActions = true;
        try { withActions = this._settings.get_boolean('enable-app-actions'); } catch (_e) {}

        // Collect each app together with its desktop actions so the actions can
        // be emitted right after their parent app once the list is sorted.
        const entries = [];

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

            const appResult = {
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
            };

            // Desktop actions (e.g. "New Window", "New Private Window"). Only
            // shown when the query matches the app by name, so they appear
            // grouped under their app rather than scattered everywhere.
            const actionResults = (withActions && appInfo && text.length >= 2 &&
                                   fuzzy.match(text, name))
                ? this._buildActionResults(app, appInfo, appId, name)
                : [];

            entries.push({ appResult, actionResults });
        }

        if (text.length > 0)
            entries.sort((a, b) =>
                fuzzy.score(text, b.appResult.title) - fuzzy.score(text, a.appResult.title));

        const results = [];
        for (const { appResult, actionResults } of entries) {
            results.push(appResult);
            for (const ar of actionResults) results.push(ar);
        }
        return results;
    }

    _buildActionResults(app, appInfo, appId, appName) {
        let actions = [];
        try { actions = appInfo.list_actions() ?? []; } catch (_e) { return []; }

        return actions.map(actionName => ({
            id:         `app-action:${appId}:${actionName}`,
            title:      appInfo.get_action_name(actionName) || actionName,
            subtitle:   `${appName} · action`,
            // Distinct "run" glyph rather than repeating the parent app's icon —
            // makes action rows easy to tell apart from the app they sit under.
            icon:       null,
            iconName:   'system-run-symbolic',
            badgeLabel: 'action',
            badgeStyle: 'blue',
            activate:   () => {
                try {
                    const ctx = global.create_app_launch_context?.(0, -1) ?? null;
                    appInfo.launch_action(actionName, ctx);
                } catch (e) {
                    console.warn('[Katip] AppsProvider: action launch failed:', e.message);
                }
            },
        }));
    }
}
