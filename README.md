# Katip Launcher

A fast, keyboard-driven launcher for GNOME Shell 45+ — search apps, files, windows and clipboard history, run commands, do math, set timers and more, all from a single shortcut.

**Default shortcut:** `Ctrl+Space`

> Developed with [Claude](https://claude.ai) (Anthropic). Released under the MIT License.
> Source code: [github.com/greybent/katip-launcher](https://github.com/greybent/katip-launcher)
> Blog post: [Katip Launcher — a KRunner-like Launcher for GNOME 3/v40 (Vibe Coding with Claude AI)](https://random-it-blog.de/fedora/katip-launcher-a-krunner-like-launcher-for-gnome-3-v40-vibe-coding-claude-ai/)

---

## Requirements

- GNOME Shell 45 or newer
- Wayland or X11
- Fedora 41+ (other distributions with GNOME Shell 45+ should work)
- `tinysparql` for file search (`sudo dnf install tinysparql`)

---

## Installation

```bash
chmod +x install.sh uninstall.sh
./install.sh
```

Log out and back in (required on Wayland for schema registration), then enable:

```bash
gnome-extensions enable katip-launcher@local
```

To open settings:

```bash
gnome-extensions prefs katip-launcher@local
```

## Uninstalling

```bash
./uninstall.sh
# log out and back in
```

## Updating

```bash
./install.sh
gnome-extensions disable katip-launcher@local
gnome-extensions enable katip-launcher@local
```

If the update includes a schema change (noted in the release), log out and back in instead of disabling/enabling. The install script detects this automatically and warns you.

---

## Features

### Search and launch
Type anything to search across all categories simultaneously. Results are ranked by how often you use them — the more you launch something, the higher it appears.

### Filter by category
Click a filter chip at the top of the launcher, or type a keyword followed by a space:

| Type this | Shows only |
|---|---|
| `file budget` | Files matching "budget" |
| `window firefox` | Open windows matching "firefox" |
| `win teams` | Open windows matching "teams" |
| `app gnome` | Applications matching "gnome" |
| `clip password` | Clipboard entries containing "password" |
| `/web rust news` | Web search only |
| `/search rust news` | Web search only |

The prefix character (default `/`) is configurable in Settings → General.

### Shell commands
Type `shell ` followed by any command:

| Type this | What happens |
|---|---|
| `shell firefox` | Launches Firefox silently |
| `shell htop` | Opens htop in your terminal |
| `shell ls -la ~/Documents` | Runs command in terminal |

**Enter** — run. **Ctrl+Enter** — run and keep terminal open after the command finishes.

### Calculator
Type any math expression directly — no trigger needed:

```
5 * 1.19    sqrt(144)    sin(pi/2)    (100 + 50) / 3
```

Press Enter to copy the result to clipboard.

### Unit conversion
Type a conversion in plain language:

```
100 km to miles    32 F to C    1.5 kg to lbs    1 GB to MB    100 bar to psi
```

Supported: length, mass, temperature, speed, volume, data, pressure.

### Web search
A web search result appears automatically at the bottom of every search. Press Enter to open it in your browser. The search engine is configurable (DuckDuckGo by default). Type a domain like `github.com` to open it directly.

### Custom shortcuts
Create quick-launch triggers in Settings → Shortcuts. 18 are included by default:

| Trigger | Action |
|---|---|
| `gg linux tips` | Google search |
| `gh katip` | GitHub search |
| `yt lofi` | YouTube search |
| `cal` | Google Calendar |
| `so python list` | Stack Overflow search |

### GNOME Settings
Type `settings ` followed by a panel name:

```
settings wifi    settings display    settings bluetooth    settings users
```

### Timers
Type `timer ` followed by a duration and optional label:

```
timer 25m    timer 1h30m standup    timer 90s    timer 2h deep work
```

A desktop notification fires when the time is up.

### Clipboard history *(optional, off by default)*
Enable in Settings → Providers. Katip watches your clipboard in the background every 3 seconds and builds a searchable history (up to 50 entries by default, configurable).

Type `clip` or `clipboard` to filter entries. Press Enter to copy an entry back to the clipboard.

- **Delete** key — removes the selected entry permanently
- **Ctrl+Enter** — toggles private mode. Private entries show `••••••••` instead of their content, protecting passwords and sensitive text. The entry still copies normally. Press Ctrl+Enter again to reveal.

### Process search *(optional, off by default)*
Enable in Settings → Providers. Type `proc ` followed by a process name. Press Enter to send SIGTERM, Ctrl+Enter to open a terminal with process details.

### Handwriting input *(stylus only)*
When a stylus pen is detected, a transparent writing overlay appears over the search field. Write directly on the search bar — ink strokes appear in real time. After a short pause, the handwriting is recognised and inserted into the search field.

Scribble back and forth horizontally to clear the canvas. Move the stylus away from the screen to dismiss the overlay.

Configure in Settings → General → Handwriting recognition: enable/disable, append vs replace mode, recognition language.

> **Privacy note:** Handwriting recognition uses an unofficial Google Input Tools endpoint
> (`inputtools.google.com`). Stroke data (vector coordinates, not images) is sent to
> Google's servers for recognition. This is the same endpoint used by Google's own
> handwriting demo page. There is no official API agreement or privacy guarantee.
> If this is a concern, disable handwriting input in Settings → General.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+Space` | Open / close (configurable) |
| `↑ / ↓` | Navigate results |
| `Enter` | Open / launch |
| `Ctrl+Enter` | Alternative action (open folder, keep terminal open, toggle clipboard private) |
| `Delete` | Remove clipboard entry from history |
| `Tab` | Cycle category chips |
| `Escape` or `Super` | Close launcher |

---

## Appearance

Six built-in themes in Settings → General:

- **System** — follows your GNOME accent color and dark/light setting, updates live
- **Dark** — deep blue-dark with blue accents
- **Muted** — warm brown-dark with amber accents
- **Light** — clean white with blue accents
- **Soft** — near-black with green accents
- **Pastel** — warm off-white with soft purple accents

Create custom themes in Settings → Custom Themes.

---

## Result ordering

**Category order** — Settings → Providers → Display order. Use ↑ ↓ buttons to arrange which category appears first.

**Most recently used first** — toggle in the same section. Sorts by personal usage history when the search box is empty. Normal search scoring resumes when you start typing.

---

## File search

File search uses GNOME's built-in file indexer. On Fedora 41+:

```bash
sudo dnf install tinysparql
```

On Fedora 38–40:

```bash
sudo dnf install tracker tracker-miners
```

Files outside your home directory are searched directly — add extra paths in Settings → Files.

---

## License

MIT — see [LICENSE](LICENSE).

Developed with [Claude](https://claude.ai) (Anthropic).
