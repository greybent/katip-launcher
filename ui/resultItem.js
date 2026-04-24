// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';

const BADGE_COLORS = {
    blue:   { bg: '#1a73e8', fg: '#ffffff' },
    green:  { bg: '#34a853', fg: '#ffffff' },
    amber:  { bg: '#f9a825', fg: '#1a1a1a' },
    purple: { bg: '#7c4dff', fg: '#ffffff' },
    teal:   { bg: '#00897b', fg: '#ffffff' },
    gray:   { bg: '#757575', fg: '#ffffff' },
};

export class ResultItem {
    constructor(result, isActive = false, theme = {}) {
        this._result = result;
        this._theme  = theme;

        this.actor = new St.BoxLayout({
            style_class: 'kapit-result-item',
            reactive: true,
            track_hover: true,
            x_expand: true,
        });

        this._buildLayout(result, theme);
        this.setActive(isActive);
    }

    _buildLayout(result, t) {
        const iconBin = new St.Bin({
            style_class: 'kapit-result-icon',
            style: t.resultIcon ?? '',
            width: 36,
            height: 36,
            y_align: Clutter.ActorAlign.CENTER,
        });

        if (result.icon)
            iconBin.child = new St.Icon({ gicon: result.icon, icon_size: 24 });
        else if (result.iconName)
            iconBin.child = new St.Icon({ icon_name: result.iconName, icon_size: 24 });

        this.actor.add_child(iconBin);

        const textBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding: 0 8px;',
        });

        const titleLabel = new St.Label({
            style_class: 'kapit-result-title',
            style: t.resultTitle ?? '',
            text: result.title ?? '',
            x_expand: true,
        });
        titleLabel.clutter_text.ellipsize = 3;

        const subtitleLabel = new St.Label({
            style_class: 'kapit-result-subtitle',
            style: t.resultSubtitle ?? '',
            text: result.subtitle ?? '',
            x_expand: true,
        });
        subtitleLabel.clutter_text.ellipsize = 3;

        textBox.add_child(titleLabel);
        textBox.add_child(subtitleLabel);
        this.actor.add_child(textBox);

        if (result.badgeLabel) {
            const colors = BADGE_COLORS[result.badgeStyle] ?? BADGE_COLORS.gray;
            this.actor.add_child(new St.Label({
                text: result.badgeLabel,
                y_align: Clutter.ActorAlign.CENTER,
                style: `background-color: ${colors.bg}; color: ${colors.fg};` +
                       `border-radius: 4px; padding: 2px 7px; font-size: 11px;`,
            }));
        }
    }

    setActive(active) {
        const t = this._theme;
        if (active) {
            this.actor.add_style_class_name('kapit-result-item-active');
            this.actor.set_style(t.resultActive ?? '');
        } else {
            this.actor.remove_style_class_name('kapit-result-item-active');
            this.actor.set_style('');
        }
    }

    destroy() {
        this.actor.destroy();
    }
}
