# Changelog

## v74 (current)

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
