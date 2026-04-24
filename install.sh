#!/usr/bin/env bash
# install.sh — Build and install Kapit Launcher
# Run from the directory containing this file.
set -euo pipefail

EXTENSION_UUID="kapit-launcher@local"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCHEMA_ID="org.gnome.shell.extensions.kapit-launcher"

# ── Count keys in schema XML ──────────────────────────────────────────────────
count_schema_keys() {
    grep -c '<key name=' "$1/schemas/org.gnome.shell.extensions.kapit-launcher.gschema.xml" 2>/dev/null || echo 0
}

echo "==> Installing to $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"

# Count keys in source schema before copying
SOURCE_KEY_COUNT=$(count_schema_keys ".")

rsync -a --delete \
    --exclude='.git' \
    --exclude='install.sh' \
    --exclude='uninstall.sh' \
    --exclude='README.md' \
    ./ "$INSTALL_DIR/"

# ── Compile schema in DESTINATION ────────────────────────────────────────────
# glib-compile-schemas writes gschemas.compiled into the target directory,
# which is where GNOME Shell looks for it at runtime.
echo "==> Compiling GSettings schema in $INSTALL_DIR/schemas/ ..."
glib-compile-schemas "$INSTALL_DIR/schemas/"

# ── Schema mismatch check ─────────────────────────────────────────────────────
# Compare the number of keys in the source XML against what the running
# GNOME Shell session has registered. A mismatch means the session was
# started before the new keys were added and needs a full logout/login.
SCHEMA_NEEDS_LOGOUT=false

DEST_KEY_COUNT=$(count_schema_keys "$INSTALL_DIR")

# Check if the schema is visible to the session at all
if ! GSETTINGS_SCHEMA_DIR="$INSTALL_DIR/schemas" \
     gsettings list-keys "$SCHEMA_ID" >/dev/null 2>&1; then
    SCHEMA_NEEDS_LOGOUT=true
else
    # Schema is visible — check if the session's compiled version has all keys
    SESSION_KEY_COUNT=$(gsettings list-keys "$SCHEMA_ID" 2>/dev/null | wc -l || echo 0)
    if [ "$SESSION_KEY_COUNT" -lt "$SOURCE_KEY_COUNT" ]; then
        SCHEMA_NEEDS_LOGOUT=true
    fi
fi

echo ""
echo "==> Done."
echo ""

if [ "$SCHEMA_NEEDS_LOGOUT" = true ]; then
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║  ⚠  SCHEMA CHANGE DETECTED — FULL LOGOUT REQUIRED               ║"
    echo "╠══════════════════════════════════════════════════════════════════╣"
    echo "║  New GSettings keys were added that the current session does     ║"
    echo "║  not know about yet. The keybinding (Ctrl+Space) will NOT work   ║"
    echo "║  until you log out and back in.                                  ║"
    echo "║                                                                  ║"
    echo "║  1. Log out of your GNOME session                                ║"
    echo "║  2. Log back in                                                  ║"
    echo "║  3. Run: gnome-extensions enable kapit-launcher@local            ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
else
    echo "  Schema is up to date — no logout needed."
    echo ""
    echo "  Reload the extension:"
    echo "    gnome-extensions disable $EXTENSION_UUID"
    echo "    gnome-extensions enable  $EXTENSION_UUID"
    echo ""
fi

echo "  Open settings:  gnome-extensions prefs $EXTENSION_UUID"
echo "  Shortcut:       Ctrl+Space  (or Super+Space if IBus intercepts it)"
echo ""
