# Changelog

## v84 (current)

Code review pass — one load-blocking regression, four security hardening changes, and a set of correctness fixes.

**Critical**

- **Fix:** `ui/launcher.js` contained a duplicated `_displayResults` method header left behind by a bad merge conflict resolution. GJS loads the file as an ES module, where that is a hard `SyntaxError`, so `extension.js` could not import `LauncherWidget` and the extension failed to enable at all. (Note: `node --check file.js` does not catch this; it only appears when the file is parsed as a module.)
- **Fix:** restored the executable bit on `install.sh`, dropped by the same merge

**Security**

- **Fix:** new `secureTmp.js` — scratch files now live in a 0700 directory under `$XDG_RUNTIME_DIR` with random UUID names, replacing predictable world-readable paths in the shared `/tmp` namespace. Covers `ProcessProvider._showDetails` (`/tmp/katip-proc-<pid>.txt`, which was also never deleted) and the Tesseract handwriting PNG (`/tmp/katip-hw-<monotonic>.png`)
- **Fix:** handwriting PNG is now deleted on every exit path — success, recognition failure, and cancellation — instead of only when recognition returned text
- **Fix:** `clipboard.json` and `history.json` are written with `Gio.FileCreateFlags.PRIVATE` and their directory created 0700. Previously the file existed at the umask default (usually 0644) for the window between `replace_contents` and the follow-up `chmod`, on every single save
- **Fix:** MyScript API keys use `Adw.PasswordEntryRow` instead of a plain `Adw.EntryRow`, so credentials are not displayed in clear text
- **Docs:** clipboard "private mode" is now described accurately in both the README and the provider subtitle — it masks the on-screen display, it does not encrypt the stored value. The previous wording claimed it protected passwords

**Fixes**

- **Fix:** `HandwritingCanvas` use-after-destroy — `destroy()` now cancels the in-flight Soup request and Tesseract subprocess via a `Gio.Cancellable` and sets a `_destroyed` flag that every async callback checks. A recognition response landing after the launcher closed previously dereferenced a nulled `_borderBox` and registered an uncancellable timeout against freed actors
- **Fix:** power actions no longer trigger on 2-character prefixes. Typing `lo` surfaced "Lock screen" and `su` surfaced "Suspend" — neither is destructive, so neither asks to confirm, and a stray Enter ended the session. Minimum is now 4 characters (every keyword is at least that long), and the provider's priority moved from 18 to 25 so app matches rank above it
- **Fix:** `_seedDefaultShortcuts` was dead code — it bailed whenever the effective value was non-empty, but the gschema default already ships 4 entries, so the 18-entry default list never applied. Now keyed on `get_user_value()` being unset
- **Fix:** `ProcessProvider` no longer calls `GLib.spawn_command_line_sync` on the compositor thread — every `proc ` keystroke froze the entire desktop for the duration of `ps`. Now async via `communicate_utf8_async`, as is the details view
- **Fix:** `ProcessProvider` parses `ps -eo pid=,args=` (two fields, args last) instead of `pid,comm,args` split on whitespace, which mangled every process whose name contains a space
- **Fix:** filesystem scan checks its 500 ms deadline per directory entry, not just per directory — a single directory with thousands of files previously ran to completion regardless
- **Fix:** panel indicator resolves its icon from the real extension path instead of a hardcoded `~/.local/share/...`, so a system-wide install no longer silently falls back to the generic search icon
- **Fix:** prefs disconnects its ~16 GSettings handlers when the window closes and holds a strong reference to the settings object, per GJS guidance
- **Fix:** empty `text-prefix-char` now means "bare keywords only" as its tooltip promises, instead of falling back to `/`
- **Fix:** shortcut URLs use `replaceAll('{query}', …)`, matching `WebProvider`; a template with two placeholders only had the first substituted
- **Fix:** `loadShortcuts`/`loadThemes` in prefs guard with `Array.isArray`, matching the launcher-side loader — a hand-edited non-array dconf value no longer throws
- **Fix:** `providerManager` REGISTRY no longer names four gschema keys that do not exist (`enable-shortcuts`, `enable-command`, `enable-settings`, `enable-timer`); those providers are `alwaysOn` and their key is now explicitly `null`
- **Docs:** handwriting privacy note updated — the default backend is Tesseract (offline), not Google Input Tools

## v80

- **Feature:** Calculator chaining — pressing Enter on a calculator result fills the search entry with the result instead of closing the launcher, enabling chained calculations (e.g. `5+5` → Enter → `10` → type `+3` → `13`)
- **Feature:** Calculator Ctrl+C copies the result to clipboard; Ctrl+↵ also copies
- **Feature:** Calculator shows previous result as a second `prev`-badged item when it differs from the current result
- **Feature:** `activateFill` and `activateCopy` result properties — general mechanism any provider can use to fill the search entry or copy on Ctrl+C without closing the launcher

## v79

- **Fix:** Clipboard watcher callback now null-checks `_clipboardHistory` before calling `append()` — prevents a potential error if the 3-second timer fires during the brief window between `disable()` clearing the reference and the GLib source being removed
- **Fix:** `_close()` now nulls `this._overlay` and `this._backgroundBin` before calling `removeChrome`/`destroy()` on them — prevents reentrancy if a signal fires mid-destroy and checks those references
- **Fix:** SPARQL file path filter now escapes `\` and `"` before embedding in the query string — a directory name containing a double-quote no longer breaks the SPARQL string literal

## v78

- **Fix:** Clipboard file write race — `ClipboardHistory` class introduced as the sole owner of `clipboard.json`; background watcher (`extension.js`) and `ClipboardProvider` now share one instance instead of each doing independent read-modify-write cycles
- **Fix:** Clipboard result IDs changed from filtered-array index (`clipboard:0`) to text-based prefix (`clipboard:<first 128 chars>`) — IDs are now stable across searches so history boost applies to the correct entries
- **Fix:** Clipboard delete now looks up the entry by text in the full history instead of by filtered-list index, preventing the wrong entry being deleted when a search is active

## v77

- **Fix:** `hwCanvas?.reposition?.()` — idle callback in `extension.js` now uses optional chaining so a destroyed handwriting canvas object is not accessed if the launcher is closed before the idle fires
- **Fix:** `WebProvider` search result now guards activation with `https?://` protocol check, matching the existing guard on URL results and the shortcuts provider — prevents a tampered `web-search-engine` setting from opening non-http URIs
- **Fix:** `ProcessProvider._showDetails` (Ctrl+↵ on a process result) rewritten to avoid terminal emulator CLI entirely — reads `ps` output and `/proc/$pid/status` via GJS directly, writes to a temp file, and opens it with the default text viewer via `xdg-open`; the previous approach was unreliable against ptyxis's GApplication D-Bus routing

## v76

- **Fix:** Typo "Katip" → "Katip" in clipboard watcher console warning
- **Fix:** Handwriting canvas `destroy()` now nulls `onTextRecognised` and `onCanvasHidden` callbacks before tearing down widgets — prevents in-flight async recognition callbacks from touching already-destroyed objects
- **Fix:** `_borderBox` and `_drawArea` explicitly nulled in `destroy()`; separate `destroyBorderBox()` method removed (merged into `destroy()`)
- **Fix:** `_drawArea.queue_repaint()` made null-safe (`_drawArea?.queue_repaint()`)
- **Fix:** `hwCanvas._borderBox` null-checked before `removeChrome` call in `extension.js`
- **Fix:** `PROXIMITY_IN` / `PROXIMITY_OUT` defined as named constants instead of magic numbers 16/17
- **Fix:** System theme watcher uses `_desktopSettings` reference consistently throughout
- **Fix:** Null guard added before system theme watcher setup
- **Fix:** Stale `_settingsIds` array initialisation removed from `extension.js`
- **Fix:** `_hwCanvas` nulled after destroy in launcher cleanup

## v74

- **Fix:** `imports.gi.Tracker` replaced with ESM dynamic `import()` per GNOME 45+ guidelines
- **Fix:** `Gio.Settings` for system theme now cached and ref-counted instead of created on every launcher open
- **Fix:** All `settings.connect()` signals in `enable()` now properly disconnected in `disable()`
- **Fix:** Focus guard timer now stored on `this` and cleaned up if launcher closes before it fires
- **Fix:** Removed excessive `console.log` from files, process and timer providers
- **Fix:** `metadata.json` cleaned — deprecated `version` field removed, empty `url` removed, `shell-version` expanded to 45–49

## v73

- **Fix:** 10 bugs and security issues from code audit
- **Fix:** Delete clipboard entries by index (not text equality) to handle duplicates correctly
- **Fix:** Provider display order uses 1000+ priority range to avoid collision with hardcoded values
- **Fix:** Section header lookup respects custom provider order
- **Fix:** PID validated as numeric before use in process provider shell commands
- **Fix:** `Math.max(1, maxHistory)` guard prevents zero-value erasing clipboard history
- **Fix:** Provider order editor validates IDs before saving to GSettings
- **Fix:** `install.sh` now detects schema mismatches and warns when a logout/login is required

## v72

- **Feature:** `install.sh` schema mismatch detection — prints a clear warning when a full logout/login is needed after a schema change

## v71

- **Fix:** 10 bugs and security issues from code audit
- **Fix:** `Gio` added as ES module import in `extension.js`
- **Fix:** All settings `EntryRow` bindings (web engine, web label, terminal, prefix char) now use manual `set_text`/`apply` pattern since `settings.bind()` does not work on `Adw.EntryRow`

## v70

- **Feature:** Custom provider display order — reorder categories via ↑↓ buttons in Settings → Providers
- **Feature:** Most-recently-used-first toggle — sort by history score instead of category order when search is empty

## v69

- **Fix:** Ctrl+Enter on clipboard entries (private mode toggle) no longer closes the launcher

## v68

- **Feature:** Clipboard private mode — Ctrl+Enter hides entry behind bullets `••••••••`
- **Feature:** Delete clipboard entries with the Delete key
- **Fix:** Clipboard history format migrated to `{text, private}` objects

## v67

- **Feature:** Clipboard history size configurable in Settings → Providers (default 50)

## v66

- **Fix:** Clipboard background watcher interval changed to 3 seconds

## v65

- **Feature:** Background clipboard watcher — history now captured continuously, not just on launcher open
- **Fix:** Clipboard provider simplified to read-only; all writes handled by background watcher

## v64

- **Feature:** Clipboard history persisted to `~/.local/share/katip-launcher/clipboard.json`

## v63

- **Fix:** All `Adw.EntryRow` settings bindings fixed (web engine, label, terminal, prefix char)

## v62

- **Fix:** Outside click handling moved to overlay `event` signal — works correctly with `global.stage.grab()`

## v61

- **Fix:** Outside clicks dismiss grab before closing so the click reaches its target window

## v60

- **Feature:** `global.stage.grab()` for input containment — prevents scroll events reaching other Wayland surfaces (e.g. Firefox zoom)

## v58

- **Feature:** `clip` / `clipboard` inline filter keyword (only active when clipboard provider is enabled)

## v57

- **Feature:** 5 new providers: Clipboard history, Process search, GNOME Settings, Timer, Unit conversion in Calculator
- **Feature:** Custom provider display order schema keys

## v56

- **Feature:** Clipboard history provider (optional, off by default)
- **Feature:** Process search provider (optional, off by default)  
- **Feature:** GNOME Settings panel search (`settings wifi` etc.)
- **Feature:** Timer provider (`timer 25m standup`)
- **Feature:** Unit conversion in calculator (`100km to miles`)

## v55

- **Fix:** Ctrl+Enter on shell commands now keeps terminal open (`bash -c 'cmd; exec bash'`)
- **Fix:** Missing `Shell` import in `command.js` — Enter/Ctrl+Enter now behave differently

## v54

- **Fix:** Added missing `Shell` import to `command.js`

## v53

- **Fix:** `_likelyNeedsTerminal` wrapped in try/catch — was silently crashing and returning no results

## v52

- **Fix:** `_parseTextPrefix` settings read moved outside outer try/catch — missing schema key now uses default `/` instead of disabling all prefix detection

## v51

- **Fix:** `web`/`search` removed from bare keyword matching to prevent conflict with normal searches
- **Feature:** `PASSTHROUGH_PREFIXES` — `shell` routes to command provider with full text intact

## v49

- **Feature:** Close launcher when another window gains focus (`notify::focus-window` on `global.display`)

## v48

- **Fix:** Scroll handling switched to `captured-event` on `global.stage` — swallows all scroll events while launcher is open

## v47

- **Fix:** Background bin set to `reactive: false`; outside click detection moved to `global.stage` `captured-event`

## v46

- **Feature:** Close launcher by clicking outside (stage button-press capture)
- **Feature:** Close launcher with Super key

## v45

- **Fix:** `_parseTextPrefix` outer try/catch restructured — missing `text-prefix-char` schema key no longer kills all prefix detection

## v44

- **Fix:** Removed `shell`/`shortcuts` from text prefix map — they conflicted with provider internals

## v43

- **Feature:** Text prefix filter — `file x`, `win x`, `app x` inline category filtering
- **Feature:** Configurable prefix character (default `/`)
- **Feature:** `/web`, `/search` prefix-only keywords

## v42

- **Fix:** 11 bugs and security issues from code audit
- **Fix:** Removed `ftp://` from URL detection
- **Fix:** Cursor close uses no arguments (TinySPARQL fix)
- **Fix:** `web.js` uses `replaceAll` for `{query}` substitution
- **Fix:** Shortcut URL validated on save, not just on activate

## v41

- **Fix:** 6 bugs and security issues
- **Fix:** SPARQL sanitisation switched to whitelist
- **Fix:** Filesystem scanner has 500ms deadline to prevent shell freeze

## v40 and earlier

Initial development — core launcher, all providers, theming system, preferences window.
