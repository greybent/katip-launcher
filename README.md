# Kapit Launcher

A fast, keyboard-driven launcher for GNOME Shell — search apps, files, run commands, do math and more from a single shortcut.

**Default shortcut:** `Ctrl+Space`

> Developed with [Claude](https://claude.ai) (Anthropic). Released under the MIT License.

---

## Installation

```bash
chmod +x install.sh uninstall.sh
./install.sh
```

Log out and back in (required on Wayland), then enable:

```bash
gnome-extensions enable kapit-launcher@local
```

To open settings at any time:

```bash
gnome-extensions prefs kapit-launcher@local
```

## Uninstalling

```bash
./uninstall.sh
# log out and back in
```

## Updating

```bash
./install.sh
gnome-extensions disable kapit-launcher@local
gnome-extensions enable kapit-launcher@local
```

If the update includes a schema change (noted in the release), log out and back in instead of just disabling/enabling.

---

## What you can do

### Search and launch
Type anything to search across all categories at once. Results are ranked by how often you use them — the more you launch something, the higher it appears.

### Filter by category
Click one of the filter chips at the top of the launcher, or type a keyword followed by a space to filter inline:

| Type this | Shows only |
|---|---|
| `file budget` | Files matching "budget" |
| `files budget` | Files matching "budget" |
| `window firefox` | Open windows matching "firefox" |
| `win teams` | Open windows matching "teams" |
| `app calc` | Applications matching "calc" |
| `apps gnome` | Applications matching "gnome" |
| `clip password` | Clipboard entries containing "password" |
| `clipboard hello` | Clipboard entries containing "hello" |
| `/web rust news` | Web search results only |
| `/search rust news` | Web search results only |

You can change the prefix character (default `/`) in Settings → General → Text prefix filter.

### Run shell commands
Type `shell ` followed by any command:

| Type this | What happens |
|---|---|
| `shell firefox` | Launches Firefox silently |
| `shell htop` | Opens htop in your terminal |
| `shell ls -la ~/Documents` | Opens a terminal and runs the command |

Press **Enter** to run. Press **Ctrl+Enter** to run and keep the terminal open after the command finishes — useful for reading output.

### Calculator
Type any math expression directly:

```
5 * 1.19
sqrt(144)
sin(pi/2)
(100 + 50) / 3
```

Press Enter to copy the result to the clipboard.

### Unit conversion
Type a conversion in plain language:

```
100 km to miles
32 F to C
1.5 kg to lbs
1 GB to MB
100 bar to psi
```

Supported categories: length, mass, temperature, speed, volume, data and pressure.

### Web search
Type anything and a web search result appears at the bottom. Press Enter to open it in your browser. The search engine is configurable in Settings → Web (DuckDuckGo by default).

Type a URL or domain directly (e.g. `github.com`) to open it without going through a search engine.

### Custom shortcuts
Create your own quick-launch triggers in Settings → Shortcuts:

| Type this | What happens |
|---|---|
| `gg linux tips` | Searches Google for "linux tips" |
| `gh kapit` | Searches GitHub for "kapit" |
| `cal` | Opens Google Calendar |

18 shortcuts are included by default covering search engines, development tools and general use.

### GNOME Settings panels
Type `settings ` followed by a panel name to jump directly to any GNOME Settings page:

```
settings wifi
settings display
settings bluetooth
settings users
settings keyboard
```

### Timers
Type `timer ` followed by a duration to set a desktop notification:

```
timer 25m
timer 1h30m standup
timer 90s
```

The notification fires when the time is up. You can include a label (like "standup") and it will appear in the notification title.

### Clipboard history *(optional, off by default)*
Enable in Settings → Providers. Kapit watches your clipboard in the background and builds a searchable history. Type `clip` or `clipboard` followed by a search term to filter entries. Press Enter to copy an entry back to the clipboard.

**Managing entries:**
- `Delete` key — removes the selected entry from history permanently
- `Ctrl+Enter` — toggles private mode on the entry. Private entries show `••••••••` instead of their content so passwords and sensitive text are hidden from view. The entry still works normally — you can still find it by searching and copy it with Enter. Press `Ctrl+Enter` again to reveal it.

History size (default 50) and the polling interval are configurable in Settings → Providers.

### Process search *(optional, off by default)*
Enable in Settings → Providers. Type `proc ` followed by a process name to list matching running processes. Press Enter to send a stop signal, or Ctrl+Enter to open a terminal with details.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+Space` | Open / close launcher (configurable) |
| `↑ / ↓` | Navigate results |
| `Enter` | Open / launch selected result |
| `Ctrl+Enter` | Alternative action (open folder for files, keep terminal open for commands, toggle private for clipboard) |
| `Delete` | Remove selected clipboard entry from history |
| `Tab` | Cycle through category filter chips |
| `Escape` or `Super` | Close launcher |

---

## Appearance

Choose from six built-in color themes in Settings → General:

- **System** — follows your GNOME accent color and dark/light mode setting, updates live
- **Dark** — deep blue-dark with blue accents
- **Muted** — warm brown-dark with amber accents
- **Light** — clean white with blue accents
- **Soft** — near-black with green accents, minimal chip styling
- **Pastel** — warm off-white with soft purple accents

You can also create your own themes in Settings → Custom Themes by choosing a base theme and overriding individual colors.

---

## Result ordering

**Category order** — Settings → Providers → Display order lets you reorder which category appears first when the launcher opens. Use the ↑ ↓ buttons to arrange categories to your preference. Changes take effect on the next launcher open.

**Most recently used first** — a toggle in the same section. When enabled, the launcher ignores category order entirely when the search box is empty and sorts everything by your personal usage history instead — whatever you used most recently appears at the top. As soon as you start typing, normal search scoring takes over.

---

## File search prerequisites

File search uses GNOME's built-in file indexer. On Fedora 41+:

```bash
sudo dnf install tinysparql
```

On Fedora 38–40:

```bash
sudo dnf install tracker tracker-miners
```

Files outside your home directory (such as network shares) are searched directly without the indexer — you can add extra search paths in Settings → Files.

---

## License

MIT — see [LICENSE](LICENSE).

Developed with [Claude](https://claude.ai) (Anthropic).
