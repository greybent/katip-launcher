# Katip Launcher

A fast, keyboard-driven launcher for GNOME Shell 45+ — search apps, files, windows and clipboard history, run commands, do math, set timers, control your session and more, all from a single shortcut.

**Default shortcut:** `Ctrl+Space`

> Developed with [Claude](https://claude.ai) (Anthropic). Released under the MIT License.
> Source code: [github.com/greybent/katip-launcher](https://github.com/greybent/katip-launcher)
> Blog post: [Katip Launcher — a KRunner-like Launcher for GNOME 3/v40 (Vibe Coding with Claude AI)](https://random-it-blog.de/fedora/katip-launcher-a-krunner-like-launcher-for-gnome-3-v40-vibe-coding-claude-ai/)

---

## Preview

<video src="https://github.com/user-attachments/assets/a20aa84c-0b18-4eea-b42e-7164789d1342" controls width="100%"></video>

<video src="https://github.com/user-attachments/assets/87be1356-e1f0-4dac-8449-779284041c1c" controls width="100%"></video>

<video src="https://github.com/user-attachments/assets/c86ec648-3c87-47bf-89cf-480a836b4ad6" controls width="100%"></video>

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

### Application actions
When you search for an app by name, its desktop actions appear right beneath it — for example **New Window** and **New Private Window** under a browser, or **New Document** under an editor. Press Enter on the action to run it directly.

Toggle this in Settings → Providers → Applications → *Application actions*.

### Filter by category
Click a filter chip at the top of the launcher, or type a keyword followed by a space:

| Type this | Shows only |
|---|---|
| `file budget` | Files matching "budget" |
| `window firefox` | Open windows matching "firefox" |
| `win teams` | Open windows matching "teams" |
| `app gnome` | Applications matching "gnome" |
| `clip password` | Clipboard entries containing "password" |
| `settings wifi` | GNOME Settings panels matching "wifi" |
| `settings ` | Every GNOME Settings panel |
| `timer 25m` | Timer only |
| `proc firefox` | Running processes matching "firefox" |
| `shell htop` | Shell command only |
| `/web rust news` | Web search only |
| `/search rust news` | Web search only |

The prefix character (default `/`) is configurable in Settings → General.

A keyword filters **exclusively** — no other provider's results are mixed in. So
`settings wifi` shows Settings panels and nothing else, and a keyword with no
match shows nothing rather than falling back to a web search.

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

### Power & session actions
Type the name of a session action to control your machine:

| Type this | Action |
|---|---|
| `lock` | Lock the screen |
| `suspend` / `sleep` | Suspend |
| `logout` | Log out of the GNOME session |
| `restart` / `reboot` | Restart |
| `shutdown` / `poweroff` | Power off |
| `hibernate` | Hibernate |

**Lock** and **suspend** run immediately. The destructive actions (log out, restart, shut down, hibernate) use a two-step confirm: the first Enter turns the row into *"press Enter again to confirm"*, and only the second Enter runs it — so a stray Enter can't end your session by accident. Press Escape to cancel.

Toggle the whole category in Settings → Providers → *Power actions*.

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
- **Ctrl+Enter** — toggles private mode. Private entries show `••••••••` instead of their content, so they are not readable over your shoulder or on a shared screen. The entry still copies normally. Press Ctrl+Enter again to reveal.

> **Storage note:** history is written to `~/.local/share/katip-launcher/clipboard.json`
> as **plain text**, in a directory and file readable only by your user account (0700/0600).
> Private mode masks the on-screen display only — it does **not** encrypt the stored value,
> and it does not protect against anything that can already read your home directory.
> If you copy passwords, either leave this provider off (it is off by default) or delete
> those entries with the Delete key afterwards.

### Process search *(optional, off by default)*
Enable in Settings → Providers. Type `proc ` followed by a process name. Press Enter to send SIGTERM, Ctrl+Enter to open a terminal with process details.

### Handwriting input *(stylus only)*
When a stylus pen is detected, a transparent writing overlay appears over the search field. Write directly on the search bar — ink strokes appear in real time. After a short pause, the handwriting is recognised and inserted into the search field.

Scribble back and forth horizontally to clear the canvas. Move the stylus away from the screen to dismiss the overlay.

Configure in Settings → General → Handwriting recognition: enable/disable, append vs replace mode, recognition language.

Three recognition backends are selectable in Settings → Handwriting:

| Backend | Where recognition happens |
|---|---|
| **Tesseract** *(default)* | Fully offline. Requires the `tesseract` package. Nothing leaves your device. |
| **Google Input Tools** | Stroke data sent to `inputtools.google.com`. |
| **MyScript iink** | Stroke data sent to `cloud.myscript.com`. Requires your own API keys. |

> **Privacy note:** the default backend is Tesseract, which runs locally — no network
> traffic. The two online backends are opt-in. Google Input Tools uses an unofficial
> endpoint (the one behind Google's own handwriting demo page): stroke data (vector
> coordinates, not images) is sent to Google's servers with no API agreement or privacy
> guarantee. MyScript requires API keys you supply yourself; those are stored unencrypted
> in dconf, like all GSettings values.
>
> Tesseract renders your strokes to a temporary PNG. It is written to a private,
> owner-only directory under `$XDG_RUNTIME_DIR` and deleted as soon as recognition
> finishes.

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

## About

Settings → About shows the installed version, the extension UUID, the supported GNOME Shell
range, your GTK/libadwaita versions and the install location, plus links to the source, the
issue tracker and the changelog. **Copy version info** puts all of it on the clipboard in one
click — please include that when filing a bug.

The version shown is read from `metadata.json` at runtime, so it always reflects what is
actually installed rather than what the docs happen to say.

---

## License

MIT — see [LICENSE](LICENSE).

Developed with [Claude](https://claude.ai) (Anthropic).
