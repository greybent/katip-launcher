// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';

export default class KapitLauncherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(600, 700);

        // ── Page: General ─────────────────────────────────────────────────
        const generalPage = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(generalPage);

        // Appearance group
        const appearGroup = new Adw.PreferencesGroup({ title: 'Appearance' });
        generalPage.add(appearGroup);

        // Launcher width
        const widthRow = new Adw.SpinRow({
            title: 'Launcher width',
            subtitle: 'Width of the search window in pixels',
            adjustment: new Gtk.Adjustment({
                lower: 400, upper: 1200, step_increment: 10, value: 750,
            }),
        });
        settings.bind('launcher-width', widthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        appearGroup.add(widthRow);

        // Max results
        const maxRow = new Adw.SpinRow({
            title: 'Maximum results',
            subtitle: 'How many results to show before scrolling',
            adjustment: new Gtk.Adjustment({
                lower: 3, upper: 20, step_increment: 1, value: 8,
            }),
        });
        settings.bind('max-results', maxRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        appearGroup.add(maxRow);

        // Overlay
        const overlayRow = new Adw.SwitchRow({
            title: 'Darken background',
            subtitle: 'Show a translucent overlay behind the launcher',
        });
        settings.bind('show-overlay', overlayRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearGroup.add(overlayRow);

        // Color theme
        const themeRow = new Adw.ActionRow({
            title: 'Color theme',
            subtitle: 'Visual style of the launcher window',
        });
        const BUILTIN_THEMES = ['dark', 'muted', 'light', 'soft', 'pastel', 'system'];

        const buildThemeMap = () => {
            const custom = (() => {
                try { return JSON.parse(settings.get_string('custom-themes')); }
                catch (_) { return []; }
            })();
            const customNames = Array.isArray(custom) ? custom.map(t => t.name) : [];
            return [...BUILTIN_THEMES, ...customNames];
        };

        const rebuildThemeCombo = () => {
            const map = buildThemeMap();
            const labels = map.map(n => n.charAt(0).toUpperCase() + n.slice(1));
            themeCombo.set_model(Gtk.StringList.new(labels));
            const current = settings.get_string('color-theme');
            const idx = map.indexOf(current);
            themeCombo.set_selected(idx >= 0 ? idx : 0);
        };

        const themeCombo = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: Gtk.StringList.new([]),
        });
        rebuildThemeCombo();

        themeCombo.connect('notify::selected', () => {
            const map = buildThemeMap();
            const selected = map[themeCombo.get_selected()];
            if (selected) settings.set_string('color-theme', selected);
        });
        settings.connect('changed::color-theme', () => {
            const map = buildThemeMap();
            const idx = map.indexOf(settings.get_string('color-theme'));
            if (idx >= 0 && themeCombo.get_selected() !== idx)
                themeCombo.set_selected(idx);
        });
        // Rebuild when custom themes change so new ones appear immediately
        settings.connect('changed::custom-themes', () => rebuildThemeCombo());

        themeRow.add_suffix(themeCombo);
        appearGroup.add(themeRow);

        // Section headers
        const headersRow = new Adw.SwitchRow({
            title: 'Section headers',
            subtitle: 'Show provider labels and dividers between result groups',
        });
        settings.bind('show-section-headers', headersRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearGroup.add(headersRow);

        // Panel indicator
        const indicatorRow = new Adw.SwitchRow({
            title: 'Show panel icon',
            subtitle: 'Display Kapit icon in the top bar for quick access',
        });
        settings.bind('show-panel-indicator', indicatorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearGroup.add(indicatorRow);

        // Keybinding group
        const keybindGroup = new Adw.PreferencesGroup({
            title: 'Keyboard shortcut',
            description: 'Click the row to record a new shortcut. Press Escape or Backspace to cancel.',
        });
        generalPage.add(keybindGroup);

        const keybindRow = new Adw.ActionRow({
            title: 'Toggle launcher',
            activatable: true,
        });

        const keybindLabel = new Gtk.ShortcutLabel({
            accelerator: settings.get_strv('toggle-launcher')[0] ?? '<Control>space',
            disabled_text: 'Disabled',
            valign: Gtk.Align.CENTER,
        });

        const resetBtn = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Reset to default (Ctrl+Space)',
        });
        resetBtn.connect('clicked', () => {
            settings.set_strv('toggle-launcher', ['<Control>space']);
        });

        keybindRow.add_suffix(keybindLabel);
        keybindRow.add_suffix(resetBtn);
        keybindGroup.add(keybindRow);

        // Capture mode: clicking the row records a new shortcut
        let capturing = false;

        keybindRow.connect('activated', () => {
            if (capturing) return;
            capturing = true;
            keybindLabel.set_accelerator('');
            keybindRow.set_subtitle('Press the new shortcut combination…');
            keybindRow.add_css_class('accent');
        });

        // Intercept keypress on the window to capture the new shortcut
        const keyController = new Gtk.EventControllerKey();
        window.add_controller(keyController);

        keyController.connect('key-pressed', (_ctrl, keyval, keycode, state) => {
            if (!capturing) return false;

            // Escape or Backspace cancels
            if (keyval === Gdk.KEY_Escape || keyval === Gdk.KEY_BackSpace) {
                capturing = false;
                const current = settings.get_strv('toggle-launcher')[0] ?? '<Control>space';
                keybindLabel.set_accelerator(current);
                keybindRow.set_subtitle('');
                keybindRow.remove_css_class('accent');
                return true;
            }

            // Ignore bare modifier keys
            const modifierKeys = [
                Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
                Gdk.KEY_Control_L, Gdk.KEY_Control_R,
                Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
                Gdk.KEY_Super_L, Gdk.KEY_Super_R,
                Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
                Gdk.KEY_Hyper_L, Gdk.KEY_Hyper_R,
                Gdk.KEY_ISO_Level3_Shift,
            ];
            if (modifierKeys.includes(keyval)) return true;

            // Build the accelerator string
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            const accel = Gtk.accelerator_name(keyval, mask);

            if (!accel || accel === '') return true;

            // Save to GSettings
            settings.set_strv('toggle-launcher', [accel]);
            keybindLabel.set_accelerator(accel);
            keybindRow.set_subtitle('');
            keybindRow.remove_css_class('accent');
            capturing = false;
            return true;
        });

        settings.connect('changed::toggle-launcher', () => {
            if (!capturing)
                keybindLabel.set_accelerator(settings.get_strv('toggle-launcher')[0] ?? '');
        });

        // ── Text prefix group ────────────────────────────────────────────
        const prefixGroup = new Adw.PreferencesGroup({
            title: 'Text prefix filter',
            description: 'Type a keyword followed by a space to filter results inline, without clicking a chip.',
        });
        generalPage.add(prefixGroup);

        const prefixCharRow = new Adw.EntryRow({
            title: 'Prefix character',
            show_apply_button: true,
        });
        prefixCharRow.set_tooltip_text(
            'Character that starts a prefixed filter. Default: /\n' +
            'Example with /: type "/file budget" to search files only.\n' +
            'Set to empty to use bare keywords only (e.g. "file budget").'
        );
        // Adw.EntryRow does not support settings.bind() for its text property —
        // wire it manually via get_text/set_text.
        prefixCharRow.set_text(settings.get_string('text-prefix-char') ?? '/');
        prefixCharRow.connect('apply', () => {
            settings.set_string('text-prefix-char', prefixCharRow.get_text());
        });
        settings.connect('changed::text-prefix-char', () => {
            const val = settings.get_string('text-prefix-char') ?? '/';
            if (prefixCharRow.get_text() !== val)
                prefixCharRow.set_text(val);
        });
        prefixGroup.add(prefixCharRow);

        // Reference table of available keywords
        const kwGroup = new Adw.PreferencesGroup({ title: 'Available keywords' });
        generalPage.add(kwGroup);

        const keywords = [
            { kw: 'file, files',          desc: 'File search' },
            { kw: 'window, windows, win', desc: 'Open windows' },
            { kw: 'app, apps',            desc: 'Applications' },
            { kw: 'calc, calculator',     desc: 'Calculator' },
            { kw: 'web, search',          desc: 'Web search (use /web or /search)' },
            { kw: 'shell',                desc: 'Shell command' },
            { kw: 'clip, clipboard',      desc: 'Clipboard history (only when enabled)' },
        ];
        for (const { kw, desc } of keywords) {
            kwGroup.add(new Adw.ActionRow({ title: kw, subtitle: desc }));
        }

        // ── Page: Providers ───────────────────────────────────────────────
        const providersPage = new Adw.PreferencesPage({
            title: 'Providers',
            icon_name: 'system-search-symbolic',
        });
        window.add(providersPage);

        const provGroup = new Adw.PreferencesGroup({
            title: 'Enabled providers',
            description: 'Toggle which result types appear in search',
        });
        providersPage.add(provGroup);

        const provToggles = [
            { key: 'enable-windows',    label: 'Open windows',      subtitle: 'Currently open application windows' },
            { key: 'enable-clipboard',  label: 'Clipboard history', subtitle: 'Recent clipboard entries · off by default' },
            { key: 'enable-apps',       label: 'Applications',      subtitle: 'Installed desktop applications' },
            { key: 'enable-files',      label: 'Files',             subtitle: 'Files found via GNOME Tracker' },
            { key: 'enable-process',    label: 'Process search',    subtitle: 'Running processes · trigger: proc <name> · off by default' },
            { key: 'enable-calculator', label: 'Calculator',        subtitle: 'Math expressions and unit conversions (e.g. 100km to miles)' },
            { key: 'enable-web',        label: 'Web search',        subtitle: 'Search the web via your configured engine' },
        ];
        // Note: Shortcuts, Shell, Settings, and Timer providers are always enabled (no toggle needed)

        // ── Display order ─────────────────────────────────────────────────────
        const orderGroup = new Adw.PreferencesGroup({
            title: 'Display order',
            description: 'Drag to reorder which category appears first when the launcher opens.',
        });
        providersPage.add(orderGroup);

        // All user-visible provider IDs in their default order
        const ORDER_DEFAULTS = [
            { id: 'windows',    label: 'Open windows' },
            { id: 'clipboard',  label: 'Clipboard' },
            { id: 'apps',       label: 'Applications' },
            { id: 'files',      label: 'Files' },
            { id: 'process',    label: 'Processes' },
            { id: 'calculator', label: 'Calculator' },
            { id: 'web',        label: 'Web search' },
        ];

        const loadOrder = () => {
            try {
                const parsed = JSON.parse(settings.get_string('provider-order'));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge: put saved order first, then append any defaults not yet in list
                    const saved = parsed.filter(id => ORDER_DEFAULTS.some(d => d.id === id));
                    const rest  = ORDER_DEFAULTS.filter(d => !saved.includes(d.id)).map(d => d.id);
                    return [...saved, ...rest];
                }
            } catch (_e) {}
            return ORDER_DEFAULTS.map(d => d.id);
        };

        const KNOWN_IDS = new Set(ORDER_DEFAULTS.map(d => d.id));
        const saveOrder = order => {
            // Only save known provider IDs to prevent garbage in settings
            const clean = order.filter(id => KNOWN_IDS.has(id));
            settings.set_string('provider-order', JSON.stringify(clean));
        };

        const orderListBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_start: 12,
            margin_end: 12,
        });
        orderGroup.add(orderListBox);

        const renderOrderList = () => {
            let child = orderListBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                orderListBox.remove(child);
                child = next;
            }
            const order = loadOrder();
            order.forEach((id, idx) => {
                const def   = ORDER_DEFAULTS.find(d => d.id === id);
                if (!def) return;
                const row   = new Adw.ActionRow({ title: def.label });

                const upBtn = new Gtk.Button({
                    icon_name: 'go-up-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    sensitive: idx > 0,
                    tooltip_text: 'Move up',
                });
                upBtn.connect('clicked', () => {
                    const o = loadOrder();
                    [o[idx - 1], o[idx]] = [o[idx], o[idx - 1]];
                    saveOrder(o);
                });

                const downBtn = new Gtk.Button({
                    icon_name: 'go-down-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    sensitive: idx < order.length - 1,
                    tooltip_text: 'Move down',
                });
                downBtn.connect('clicked', () => {
                    const o = loadOrder();
                    [o[idx], o[idx + 1]] = [o[idx + 1], o[idx]];
                    saveOrder(o);
                });

                row.add_suffix(upBtn);
                row.add_suffix(downBtn);
                orderListBox.append(row);
            });

            const resetRow = new Adw.ActionRow({ title: 'Reset to default order' });
            const resetBtn = new Gtk.Button({
                label: 'Reset',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat'],
            });
            resetBtn.connect('clicked', () => saveOrder([]));
            resetRow.add_suffix(resetBtn);
            orderListBox.append(resetRow);
        };

        renderOrderList();
        settings.connect('changed::provider-order', () => renderOrderList());

        // ── Recent first toggle ───────────────────────────────────────────────
        const recentRow = new Adw.SwitchRow({
            title: 'Show most recently used first',
            subtitle: 'When the launcher opens with no search text, sort by your recent activity instead of category order',
        });
        settings.bind('results-recent-first', recentRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        orderGroup.add(recentRow);

        for (const { key, label, subtitle } of provToggles) {
            const row = new Adw.SwitchRow({ title: label, subtitle });
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            provGroup.add(row);

            // Extra setting for clipboard history size
            if (key === 'enable-clipboard') {
                const histSizeRow = new Adw.SpinRow({
                    title: 'History size',
                    subtitle: 'Maximum number of clipboard entries to remember',
                    adjustment: new Gtk.Adjustment({
                        lower: 10, upper: 500, step_increment: 10, value: 50,
                    }),
                });
                settings.bind('clipboard-max-history', histSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
                provGroup.add(histSizeRow);
            }
        }

        // ── Page: Files ───────────────────────────────────────────────────
        const filesPage = new Adw.PreferencesPage({
            title: 'Files',
            icon_name: 'folder-symbolic',
        });
        window.add(filesPage);

        // Editable paths list — fully self-contained, builds its own groups
        this._buildPathsEditor(filesPage, settings);

        // Scan settings for non-Tracker paths
        const scanGroup = new Adw.PreferencesGroup({
            title: 'Network / external path scan',
            description: 'Applied when searching paths outside your home folder (e.g. SMB mounts). Tracker is not used for these paths.',
        });
        filesPage.add(scanGroup);

        const scanDepthRow = new Adw.SpinRow({
            title: 'Max scan depth',
            subtitle: 'Directory levels to recurse into',
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 10, step_increment: 1, value: 4 }),
        });
        settings.bind('scan-max-depth', scanDepthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        scanGroup.add(scanDepthRow);

        const scanResultsRow = new Adw.SpinRow({
            title: 'Max results per path',
            subtitle: 'File matches returned per external path',
            adjustment: new Gtk.Adjustment({ lower: 10, upper: 200, step_increment: 10, value: 50 }),
        });
        settings.bind('scan-max-results', scanResultsRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        scanGroup.add(scanResultsRow);

        // ── Page: Web ─────────────────────────────────────────────────────
        const webPage = new Adw.PreferencesPage({
            title: 'Web',
            icon_name: 'web-browser-symbolic',
        });
        window.add(webPage);

        const webGroup = new Adw.PreferencesGroup({ title: 'Search engine' });
        webPage.add(webGroup);

        const engineLabelRow = new Adw.EntryRow({ title: 'Engine name', show_apply_button: true });
        engineLabelRow.set_text(settings.get_string('web-search-label') ?? '');
        engineLabelRow.connect('apply', () => settings.set_string('web-search-label', engineLabelRow.get_text()));
        settings.connect('changed::web-search-label', () => {
            const v = settings.get_string('web-search-label') ?? '';
            if (engineLabelRow.get_text() !== v) engineLabelRow.set_text(v);
        });
        webGroup.add(engineLabelRow);

        const engineUrlRow = new Adw.EntryRow({
            title: 'Search URL',
            show_apply_button: true,
        });
        engineUrlRow.set_tooltip_text('Use {query} as the placeholder for the search term');
        engineUrlRow.set_text(settings.get_string('web-search-engine') ?? '');
        engineUrlRow.connect('apply', () => settings.set_string('web-search-engine', engineUrlRow.get_text()));
        settings.connect('changed::web-search-engine', () => {
            const v = settings.get_string('web-search-engine') ?? '';
            if (engineUrlRow.get_text() !== v) engineUrlRow.set_text(v);
        });
        webGroup.add(engineUrlRow);

        const presetsGroup = new Adw.PreferencesGroup({ title: 'Quick presets' });
        webPage.add(presetsGroup);

        const presets = [
            { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' },
            { name: 'Google',     url: 'https://www.google.com/search?q={query}' },
            { name: 'Brave',      url: 'https://search.brave.com/search?q={query}' },
            { name: 'Startpage',  url: 'https://www.startpage.com/search?q={query}' },
        ];

        for (const preset of presets) {
            const row = new Adw.ActionRow({
                title: preset.name,
                subtitle: preset.url,
                activatable: true,
            });
            row.add_suffix(new Gtk.Image({ icon_name: 'go-next-symbolic' }));
            row.connect('activated', () => {
                settings.set_string('web-search-engine', preset.url);
                settings.set_string('web-search-label', preset.name);
            });
            presetsGroup.add(row);
        }

        // ── Page: Terminal ────────────────────────────────────────────────
        const termPage = new Adw.PreferencesPage({
            title: 'Terminal',
            icon_name: 'utilities-terminal-symbolic',
        });
        window.add(termPage);

        const termGroup = new Adw.PreferencesGroup({
            title: 'Terminal emulator',
            description: 'Used when running commands via the "shell " prefix in the launcher.',
        });
        termPage.add(termGroup);

        const usageGroup = new Adw.PreferencesGroup({ title: 'How to run commands' });
        termPage.add(usageGroup);
        usageGroup.add(new Adw.ActionRow({
            title: 'Type "shell " followed by a command',
            subtitle: 'e.g.  shell htop  or  shell ls -la ~/Documents',
        }));
        usageGroup.add(new Adw.ActionRow({
            title: 'Enter',
            subtitle: 'Smart launch — GUI apps run silently, CLI tools open in terminal',
        }));
        usageGroup.add(new Adw.ActionRow({
            title: 'Ctrl+Enter',
            subtitle: 'Always run in the configured terminal',
        }));

        const termRow = new Adw.EntryRow({
            title: 'Terminal binary',
            show_apply_button: true,
        });
        termRow.set_tooltip_text('Name or full path of the terminal app, e.g. kgx, gnome-terminal, alacritty');
        termRow.set_text(settings.get_string('terminal-app') ?? 'kgx');
        termRow.connect('apply', () => settings.set_string('terminal-app', termRow.get_text().trim() || 'kgx'));
        settings.connect('changed::terminal-app', () => {
            const v = settings.get_string('terminal-app') ?? 'kgx';
            if (termRow.get_text() !== v) termRow.set_text(v);
        });
        termGroup.add(termRow);

        // ── Page: Shortcuts ───────────────────────────────────────────────
        const shortcutsPage = new Adw.PreferencesPage({
            title: 'Shortcuts',
            icon_name: 'media-flash-symbolic',
        });
        window.add(shortcutsPage);

        this._buildShortcutsEditor(shortcutsPage, settings);

        // ── Page: Custom Themes ───────────────────────────────────────────
        const themesPage = new Adw.PreferencesPage({
            title: 'Custom Themes',
            icon_name: 'preferences-desktop-theme-symbolic',
        });
        window.add(themesPage);
        this._buildCustomThemesEditor(themesPage, settings);
    }

    // ── Paths editor ──────────────────────────────────────────────────────

    _buildPathsEditor(page, settings) {
        // Header group — title and description only, no rows
        const headerGroup = new Adw.PreferencesGroup({
            title: 'Search paths',
            description: 'Directories to include in file search. Use ~ for your home folder.',
        });
        page.add(headerGroup);

        // Use a plain Gtk.ListBox for the path list — it supports proper remove()
        // unlike Adw.PreferencesGroup. Styled with 'boxed-list' to match Adw aesthetics.
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6,
        });
        headerGroup.add(listBox);

        const renderPaths = () => {
            // Remove all current rows
            let child = listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                listBox.remove(child);
                child = next;
            }

            const current = settings.get_strv('file-search-paths');
            for (let i = 0; i < current.length; i++) {
                const path = current[i];
                const idx  = i; // capture loop index for the closure
                const row = new Adw.ActionRow({ title: path });

                const removeBtn = new Gtk.Button({
                    icon_name: 'list-remove-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['destructive-action', 'flat'],
                    tooltip_text: 'Remove path',
                });
                removeBtn.connect('clicked', () => {
                    // Remove by index so duplicate paths each get their own remove button
                    const live = settings.get_strv('file-search-paths');
                    settings.set_strv('file-search-paths',
                        live.filter((_, j) => j !== idx));
                });
                row.add_suffix(removeBtn);
                listBox.append(row);
            }
        };

        renderPaths();

        // Single source of truth — re-render on any settings change
        settings.connect('changed::file-search-paths', () => renderPaths());

        // Add-path entry in its own group below the list
        const addGroup = new Adw.PreferencesGroup();
        page.add(addGroup);

        const addRow = new Adw.EntryRow({
            title: 'Add search path',
            show_apply_button: true,
        });
        addRow.set_tooltip_text('Use ~ for your home folder, or enter an absolute path');
        addRow.connect('apply', () => {
            const val = addRow.get_text().trim();
            if (!val) return;
            const current = settings.get_strv('file-search-paths');
            if (!current.includes(val))
                settings.set_strv('file-search-paths', [...current, val]);
            addRow.set_text('');
        });
        addGroup.add(addRow);
    }
    // ── Shortcuts editor ──────────────────────────────────────────────────

    _buildShortcutsEditor(page, settings) {
        const headerGroup = new Adw.PreferencesGroup({
            title: 'Custom shortcuts',
            description: 'Standalone: type trigger alone (e.g. "gg"). Search: type trigger + space + term (e.g. "aa mugs").',
        });
        page.add(headerGroup);

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6,
        });
        headerGroup.add(listBox);

        const loadShortcuts = () => {
            try { return JSON.parse(settings.get_string('shortcuts')); }
            catch (_) { return []; }
        };
        const saveShortcuts = (arr) =>
            settings.set_string('shortcuts', JSON.stringify(arr));

        // ── Form state ────────────────────────────────────────────────────
        // editIndex = -1 means "add new", >= 0 means editing that index
        let editIndex = -1;

        const formGroup = new Adw.PreferencesGroup({ title: 'Add shortcut' });
        page.add(formGroup);

        const triggerRow = new Adw.EntryRow({ title: 'Trigger' });
        triggerRow.set_tooltip_text('e.g. gg  aa  gh');
        formGroup.add(triggerRow);

        const labelRow = new Adw.EntryRow({ title: 'Label' });
        labelRow.set_tooltip_text('Display name, e.g. Google, Amazon');
        formGroup.add(labelRow);

        const typeRow = new Adw.ActionRow({
            title: 'Type',
            subtitle: 'Open: trigger alone. Search: trigger + space + term.',
        });
        const typeSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        typeRow.add_suffix(new Gtk.Label({
            label: 'Search',
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
            margin_end: 6,
        }));
        typeRow.add_suffix(typeSwitch);
        formGroup.add(typeRow);

        const urlRow = new Adw.EntryRow({
            title: 'URL',
            show_apply_button: true,
        });
        urlRow.set_tooltip_text('Search type: use {query} as placeholder, e.g. https://google.de/search?q={query}');
        formGroup.add(urlRow);

        // Action buttons row
        const btnGroup = new Adw.PreferencesGroup();
        page.add(btnGroup);

        const btnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4,
            halign: Gtk.Align.END,
        });

        const cancelBtn = new Gtk.Button({
            label: 'Cancel',
            visible: false,
            css_classes: ['flat'],
        });
        const saveBtn = new Gtk.Button({
            label: 'Add',
            css_classes: ['suggested-action'],
        });
        btnBox.append(cancelBtn);
        btnBox.append(saveBtn);

        const btnRow = new Adw.ActionRow();
        btnRow.add_suffix(btnBox);
        btnGroup.add(btnRow);

        // ── Form helpers ─────────────────────────────────────────────────

        const clearForm = () => {
            editIndex = -1;
            triggerRow.set_text('');
            labelRow.set_text('');
            urlRow.set_text('');
            typeSwitch.set_active(false);
            saveBtn.set_label('Add');
            cancelBtn.set_visible(false);
            formGroup.set_title('Add shortcut');
        };

        const populateForm = (sc, idx) => {
            editIndex = idx;
            triggerRow.set_text(sc.trigger ?? '');
            labelRow.set_text(sc.label ?? '');
            urlRow.set_text(sc.url ?? '');
            typeSwitch.set_active(sc.type === 'search');
            saveBtn.set_label('Update');
            cancelBtn.set_visible(true);
            formGroup.set_title(`Editing: ${sc.trigger}`);
        };

        const commitForm = () => {
            const trigger = triggerRow.get_text().trim().toLowerCase();
            const label   = labelRow.get_text().trim();
            const url     = urlRow.get_text().trim();
            const type    = typeSwitch.get_active() ? 'search' : 'open';
            if (!trigger || !url) return;

            // Validate URL — must be http(s) to prevent javascript:/file:// being stored
            if (!/^https?:\/\//i.test(url)) {
                urlRow.add_css_class('error');
                urlRow.set_tooltip_text('URL must start with https:// or http://');
                return;
            }
            urlRow.remove_css_class('error');
            urlRow.set_tooltip_text('Search type: use {query} as placeholder, e.g. https://google.de/search?q={query}');

            // Disable button immediately to prevent double-submit on rapid clicks
            saveBtn.set_sensitive(false);

            const current = loadShortcuts();
            const entry   = { trigger, label: label || trigger, type, url };

            if (editIndex >= 0) {
                current[editIndex] = entry;
            } else {
                const existing = current.findIndex(s => s.trigger === trigger);
                if (existing >= 0) current[existing] = entry;
                else current.push(entry);
            }
            saveShortcuts(current);
            clearForm();
            saveBtn.set_sensitive(true);
        };

        saveBtn.connect('clicked', () => commitForm());
        cancelBtn.connect('clicked', () => clearForm());
        // Also allow Enter in the URL field to commit
        urlRow.connect('apply', () => commitForm());

        // ── List renderer ────────────────────────────────────────────────

        const renderList = () => {
            let child = listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                listBox.remove(child);
                child = next;
            }

            const shortcuts = loadShortcuts();
            if (shortcuts.length === 0) {
                listBox.append(new Adw.ActionRow({
                    title: 'No shortcuts yet',
                    subtitle: 'Add one using the form below',
                }));
                return;
            }

            for (let i = 0; i < shortcuts.length; i++) {
                const sc = shortcuts[i];
                const typeLabel = sc.type === 'search' ? 'search' : 'open';
                const row = new Adw.ActionRow({
                    title:    `${sc.trigger}  —  ${sc.label ?? sc.trigger}`,
                    subtitle: `[${typeLabel}]  ${sc.url ?? ''}`,
                    activatable: false,
                });

                // Edit button
                const editBtn = new Gtk.Button({
                    icon_name: 'document-edit-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: 'Edit shortcut',
                });
                editBtn.connect('clicked', () => populateForm(sc, i));
                row.add_suffix(editBtn);

                // Remove button
                const removeBtn = new Gtk.Button({
                    icon_name: 'list-remove-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['destructive-action', 'flat'],
                    tooltip_text: 'Remove shortcut',
                });
                removeBtn.connect('clicked', () => {
                    if (editIndex === i) clearForm();
                    const updated = loadShortcuts().filter((_, idx) => idx !== i);
                    saveShortcuts(updated);
                });
                row.add_suffix(removeBtn);

                listBox.append(row);
            }
        };

        renderList();
        settings.connect('changed::shortcuts', () => renderList());

        // ── Reset to defaults button ──────────────────────────────────────
        const resetGroup = new Adw.PreferencesGroup();
        page.add(resetGroup);

        const resetRow = new Adw.ActionRow({
            title: 'Reset to defaults',
            subtitle: 'Restores gg, aa, dd, ww — your custom shortcuts will be removed',
        });
        const resetBtn = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        resetBtn.connect('clicked', () => {
            const dialog = new Adw.MessageDialog({
                transient_for: page.get_root(),
                heading: 'Reset shortcuts?',
                body: 'This will replace all shortcuts with the four defaults. This cannot be undone.',
            });
            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('reset',  'Reset');
            dialog.set_response_appearance('reset', Adw.ResponseAppearance.DESTRUCTIVE);
            dialog.connect('response', (_d, response) => {
                if (response === 'reset') {
                    const defaults = [
                        { trigger: 'gg',   label: 'Google',         type: 'search', url: 'https://google.de/search?q={query}' },
                        { trigger: 'aa',   label: 'Amazon',          type: 'search', url: 'https://www.amazon.de/s?k={query}' },
                        { trigger: 'dd',   label: 'DuckDuckGo',      type: 'search', url: 'https://duckduckgo.com/?q={query}' },
                        { trigger: 'ww',   label: 'Wikipedia',       type: 'search', url: 'https://en.wikipedia.org/w/index.php?search={query}' },
                        { trigger: 'gh',   label: 'GitHub',          type: 'search', url: 'https://github.com/search?q={query}' },
                        { trigger: 'so',   label: 'Stack Overflow',  type: 'search', url: 'https://stackoverflow.com/search?q={query}' },
                        { trigger: 'mdn',  label: 'MDN Web Docs',    type: 'search', url: 'https://developer.mozilla.org/en-US/search?q={query}' },
                        { trigger: 'pypi', label: 'PyPI',            type: 'search', url: 'https://pypi.org/search/?q={query}' },
                        { trigger: 'cve',  label: 'CVE Search',      type: 'search', url: 'https://www.google.com/search?q=CVE+{query}' },
                        { trigger: 'pkg',  label: 'Fedora Packages', type: 'search', url: 'https://packages.fedoraproject.org/search?searchterm={query}' },
                        { trigger: 'man',  label: 'Linux man pages', type: 'search', url: 'https://man7.org/linux/man-pages/man1/{query}.1.html' },
                        { trigger: 'ad',   label: 'MS Docs',         type: 'search', url: 'https://learn.microsoft.com/en-us/search/?terms={query}' },
                        { trigger: 'yt',   label: 'YouTube',         type: 'search', url: 'https://www.youtube.com/results?search_query={query}' },
                        { trigger: 'maps', label: 'Google Maps',     type: 'search', url: 'https://www.google.com/maps/search/{query}' },
                        { trigger: 'leo',  label: 'LEO Dictionary',  type: 'search', url: 'https://dict.leo.org/german-english/{query}' },
                        { trigger: 'dict', label: 'Duden',           type: 'search', url: 'https://www.duden.de/suchen/dudenonline/{query}' },
                        { trigger: 'wb',   label: 'Wayback Machine', type: 'search', url: 'https://web.archive.org/web/*/{query}' },
                        { trigger: 'cal',  label: 'Google Calendar', type: 'open',   url: 'https://calendar.google.com' },
                    ];
                    saveShortcuts(defaults);
                    clearForm();
                }
            });
            dialog.present();
        });
        resetRow.add_suffix(resetBtn);
        resetGroup.add(resetRow);
    }

    // ── Custom themes editor ──────────────────────────────────────────────────

    _buildCustomThemesEditor(page, settings) {
        const BASE_THEMES = ['dark', 'muted', 'light', 'soft', 'pastel']; // system not a valid base

        // Colour properties the user can override, with friendly labels
        const COLOR_FIELDS = [
            { key: 'launcher',        label: 'Background',        hint: 'background-color: #xxxxxx; border: ...; border-radius: 12px;' },
            { key: 'searchEntry',     label: 'Search text',       hint: 'color: #xxxxxx; caret-color: #xxxxxx;' },
            { key: 'chipRow',         label: 'Chip bar',          hint: 'background-color: ...; border-bottom: ...;' },
            { key: 'chip',            label: 'Chip (inactive)',    hint: 'color: ...; background-color: ...; border: ...;' },
            { key: 'chipActive',      label: 'Chip (active)',      hint: 'color: ...; background-color: ...; border: ...;' },
            { key: 'resultTitle',     label: 'Result title',      hint: 'color: #xxxxxx;' },
            { key: 'resultSubtitle',  label: 'Result subtitle',   hint: 'color: rgba(...);' },
            { key: 'resultHover',     label: 'Result hover',      hint: 'background-color: rgba(...);' },
            { key: 'resultActive',    label: 'Result selected',   hint: 'background-color: rgba(...);' },
            { key: 'footer',          label: 'Footer',            hint: 'background-color: ...; border-top: ...;' },
            { key: 'sectionLabel',    label: 'Section label',     hint: 'color: rgba(...);' },
        ];

        const loadThemes = () => {
            try { return JSON.parse(settings.get_string('custom-themes')); }
            catch (_) { return []; }
        };
        const saveThemes = arr =>
            settings.set_string('custom-themes', JSON.stringify(arr));

        // ── Theme list ────────────────────────────────────────────────────
        const listGroup = new Adw.PreferencesGroup({
            title: 'Your custom themes',
            description: 'Custom themes appear in the Color theme dropdown on the General page.',
        });
        page.add(listGroup);

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6,
        });
        listGroup.add(listBox);

        // Track edit state
        let editIndex = -1;

        const renderList = () => {
            let child = listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                listBox.remove(child);
                child = next;
            }
            const themes = loadThemes();
            if (themes.length === 0) {
                listBox.append(new Adw.ActionRow({
                    title: 'No custom themes yet',
                    subtitle: 'Add one using the form below',
                }));
                return;
            }
            for (let i = 0; i < themes.length; i++) {
                const t = themes[i];
                const row = new Adw.ActionRow({
                    title: t.name,
                    subtitle: `Based on ${t.base} · ${Object.keys(t.overrides ?? {}).length} overrides`,
                });
                const editBtn = new Gtk.Button({
                    icon_name: 'document-edit-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: 'Edit theme',
                });
                editBtn.connect('clicked', () => populateForm(t, i));
                row.add_suffix(editBtn);

                const removeBtn = new Gtk.Button({
                    icon_name: 'list-remove-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['destructive-action', 'flat'],
                    tooltip_text: 'Remove theme',
                });
                removeBtn.connect('clicked', () => {
                    if (editIndex === i) clearForm();
                    saveThemes(loadThemes().filter((_, idx) => idx !== i));
                    // If this was the active theme, fall back to dark
                    if (settings.get_string('color-theme') === t.name)
                        settings.set_string('color-theme', 'dark');
                });
                row.add_suffix(removeBtn);
                listBox.append(row);
            }
        };

        renderList();
        settings.connect('changed::custom-themes', () => renderList());

        // ── Editor form ───────────────────────────────────────────────────
        const formGroup = new Adw.PreferencesGroup({ title: 'Add custom theme' });
        page.add(formGroup);

        const nameRow = new Adw.EntryRow({ title: 'Theme name' });
        nameRow.set_tooltip_text('A unique name, e.g. "My Theme". This will appear in the dropdown.');
        formGroup.add(nameRow);

        // Base theme picker
        const baseRow = new Adw.ActionRow({
            title: 'Base theme',
            subtitle: 'Start from this built-in theme and override individual values',
        });
        const baseCombo = new Gtk.DropDown({
            valign: Gtk.Align.CENTER,
            model: Gtk.StringList.new(BASE_THEMES.map(n => n.charAt(0).toUpperCase() + n.slice(1))),
        });
        baseRow.add_suffix(baseCombo);
        formGroup.add(baseRow);

        // Color override fields
        const overrideGroup = new Adw.PreferencesGroup({
            title: 'Color overrides',
            description: 'Leave blank to inherit from the base theme. Use CSS inline style syntax.',
        });
        page.add(overrideGroup);

        const fieldRows = {};
        for (const { key, label, hint } of COLOR_FIELDS) {
            const row = new Adw.EntryRow({ title: label });
            row.set_tooltip_text(`CSS: ${hint}`);
            overrideGroup.add(row);
            fieldRows[key] = row;
        }

        // Action buttons
        const btnGroup = new Adw.PreferencesGroup();
        page.add(btnGroup);

        const btnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 4,
            margin_bottom: 4,
            halign: Gtk.Align.END,
        });
        const cancelBtn = new Gtk.Button({ label: 'Cancel', visible: false, css_classes: ['flat'] });
        const saveBtn   = new Gtk.Button({ label: 'Add theme', css_classes: ['suggested-action'] });
        btnBox.append(cancelBtn);
        btnBox.append(saveBtn);
        const btnRow = new Adw.ActionRow();
        btnRow.add_suffix(btnBox);
        btnGroup.add(btnRow);

        // ── Form helpers ──────────────────────────────────────────────────

        const clearForm = () => {
            editIndex = -1;
            nameRow.set_text('');
            baseCombo.set_selected(0);
            for (const row of Object.values(fieldRows)) row.set_text('');
            saveBtn.set_label('Add theme');
            cancelBtn.set_visible(false);
            formGroup.set_title('Add custom theme');
        };

        const populateForm = (t, idx) => {
            editIndex = idx;
            nameRow.set_text(t.name ?? '');
            const baseIdx = BASE_THEMES.indexOf(t.base ?? 'dark');
            baseCombo.set_selected(baseIdx >= 0 ? baseIdx : 0);
            for (const { key } of COLOR_FIELDS)
                fieldRows[key].set_text(t.overrides?.[key] ?? '');
            saveBtn.set_label('Update theme');
            cancelBtn.set_visible(true);
            formGroup.set_title(`Editing: ${t.name}`);
        };

        const sanitiseOverrideValue = val => {
            // Cap length to prevent extremely long strings being injected as inline styles
            const capped = val.slice(0, 500);
            // Strip Pango markup characters that could corrupt St label rendering
            return capped.replace(/[<>]/g, '');
        };

        const sanitiseThemeName = name => {
            // Theme names appear in GSettings and the dropdown — strip control chars
            return name.replace(/[^\w\s\-_.()]/g, '').slice(0, 64).trim();
        };

        const commitForm = () => {
            const rawName = nameRow.get_text().trim();
            const name = sanitiseThemeName(rawName);
            if (!name) return;
            const base = BASE_THEMES[baseCombo.get_selected()] ?? 'dark';
            const overrides = {};
            for (const { key } of COLOR_FIELDS) {
                const val = fieldRows[key].get_text().trim();
                if (val) overrides[key] = sanitiseOverrideValue(val);
            }
            const entry = { name, base, overrides };
            const current = loadThemes();
            if (editIndex >= 0) {
                current[editIndex] = entry;
            } else {
                const existing = current.findIndex(t => t.name === name);
                if (existing >= 0) current[existing] = entry;
                else current.push(entry);
            }
            saveThemes(current);
            clearForm();
        };

        saveBtn.connect('clicked', () => commitForm());
        cancelBtn.connect('clicked', () => clearForm());
    }

}
