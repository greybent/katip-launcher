#!/usr/bin/env bash
# uninstall.sh — Remove Kapit Launcher
set -euo pipefail

EXTENSION_UUID="kapit-launcher@local"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Extension not found at $INSTALL_DIR — nothing to do."
    exit 0
fi

echo "==> Disabling extension..."
gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || true

echo "==> Removing $INSTALL_DIR ..."
rm -rf "$INSTALL_DIR"

echo ""
echo "==> Done. Kapit Launcher has been removed."
echo "    Log out and back in (Wayland) or press Alt+F2 → r (X11) to fully unload it."
