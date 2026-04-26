// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import St from 'gi://St';

export class ClipboardProvider extends BaseProvider {
    get id()       { return 'clipboard'; }
    get label()    { return 'Clipboard'; }
    get priority() { return 15; }

    constructor(settings, clipboardHistory) {
        super(settings);
        this._clipboardHistory = clipboardHistory;
        this._clipboard = null;
        try {
            this._clipboard = St.Clipboard.get_default();
        } catch (e) {
            console.warn('[Kapit] ClipboardProvider: clipboard unavailable:', e.message);
        }
    }

    query(text) {
        const history = this._clipboardHistory.load();
        if (!history.length) return [];

        const needle = text.toLowerCase();

        return history
            .filter(entry => !needle || entry.text.toLowerCase().includes(needle))
            .map(entry => {
                const isPrivate = !!entry.private;

                const display = isPrivate
                    ? '•'.repeat(Math.min(entry.text.length, 24))
                    : (entry.text.length > 80
                        ? entry.text.slice(0, 80).replace(/\n/g, '↵') + '…'
                        : entry.text.replace(/\n/g, '↵'));

                const subtitle = isPrivate
                    ? `Private · ${entry.text.length} chars · Enter to copy`
                    : `${entry.text.length} chars · Enter to copy · Ctrl+↵ to mark private`;

                return {
                    id:                  `clipboard:${entry.text.slice(0, 128)}`,
                    title:               display,
                    subtitle,
                    icon:                null,
                    iconName:            isPrivate ? 'changes-prevent-symbolic' : 'edit-paste-symbolic',
                    badgeLabel:          isPrivate ? 'private' : 'clip',
                    badgeStyle:          isPrivate ? 'purple' : 'teal',
                    activate:            () => this._copyToClipboard(entry.text),
                    activateAlt:         () => this._clipboardHistory.togglePrivate(entry.text, !isPrivate),
                    activateAltLabel:    isPrivate ? 'Remove private flag' : 'Mark as private',
                    activateAltKeepOpen: true,
                    activateDel:         () => this._clipboardHistory.deleteByText(entry.text),
                };
            });
    }

    _copyToClipboard(text) {
        if (!this._clipboard) return;
        try {
            this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        } catch (_e) {}
    }

    destroy() {
        this._clipboard = null;
    }
}
