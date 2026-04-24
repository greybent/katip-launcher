# Contributing to Kapit Launcher

Thanks for your interest in contributing.

## Reporting bugs

Open an issue and include:
- Your GNOME Shell version (`gnome-shell --version`)
- Your distribution and version
- What you expected to happen and what actually happened
- Relevant output from the journal:
  ```bash
  journalctl /usr/bin/gnome-shell --since "5 min ago" | grep -i kapit
  ```

## Development setup

```bash
git clone https://github.com/yourusername/kapit-launcher.git
cd kapit-launcher
chmod +x install.sh uninstall.sh
./install.sh
# log out and back in (Wayland)
gnome-extensions enable kapit-launcher@local
```

After code changes (no schema change):
```bash
./install.sh
gnome-extensions disable kapit-launcher@local
gnome-extensions enable kapit-launcher@local
```

After schema changes:
```bash
./install.sh
# log out and back in
gnome-extensions enable kapit-launcher@local
```

## Code style

- ES modules only (`import ... from 'gi://...'`) — no `imports.gi`
- All objects created in `enable()` must be destroyed in `disable()`
- All signals connected in `enable()` must be disconnected in `disable()`
- All GLib sources added in `enable()` must be removed in `disable()`
- No `console.log` in production code — use `console.warn` for genuine errors only
- No GTK/Adw/Gdk imports in Shell-side files (`extension.js`, `ui/`, `providers/`)
- No Clutter/Meta/St/Shell imports in `prefs.js`

## Adding a new provider

1. Create `providers/myprovider.js` extending `BaseProvider`
2. Implement `get id()`, `get label()`, `get priority()`, `query(text)`
3. Register in `providerManager.js` REGISTRY array
4. If optional: add `<key>` to schema, `SwitchRow` to prefs Providers page
5. If it has a text trigger keyword: add to `TEXT_PREFIXES` in `ui/launcher.js`

Result object shape:
```js
{
    id:                  string,
    title:               string,
    subtitle:            string,
    icon:                Gio.Icon | null,
    iconName:            string | null,
    badgeLabel:          string,
    badgeStyle:          'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'gray',
    activate:            () => void,
    activateAlt:         () => void,   // optional — Ctrl+Enter
    activateAltLabel:    string,
    activateAltKeepOpen: bool,         // true = don't close launcher on Ctrl+Enter
    activateDel:         () => void,   // optional — Delete key
}
```

## License

By contributing you agree that your contributions will be licensed under the MIT License.
