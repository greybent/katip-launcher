// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/**
 * secureTmp — short-lived scratch files that are not world-readable and do not
 * sit at a predictable path in the shared /tmp namespace.
 *
 * Files land in a 0700 subdirectory of the user's runtime dir (usually
 * /run/user/<uid>, a per-user tmpfs the session manager clears on logout).
 * If no runtime dir is available we fall back to the system temp dir — the
 * directory is still created 0700, so the contents stay owner-only.
 *
 * Names use a random UUID rather than a PID or timestamp, so another local
 * user cannot pre-create the path (or a symlink at it) before we write.
 */

const SUBDIR_NAME     = 'katip-launcher';
const STALE_AGE_SECS  = 300; // prune leftovers older than 5 minutes

let _dirPath = null;

/**
 * Path of the private scratch directory, creating it if needed.
 * @returns {string|null} directory path, or null if it could not be created
 */
export function privateTmpDir() {
    if (_dirPath) return _dirPath;

    const base = GLib.get_user_runtime_dir() || GLib.get_tmp_dir();
    const path = GLib.build_filenamev([base, SUBDIR_NAME]);

    if (GLib.mkdir_with_parents(path, 0o700) !== 0) return null;

    // mkdir_with_parents leaves an existing directory's mode alone, so tighten
    // it explicitly in case an earlier version (or another process) created it
    // with looser permissions.
    try {
        Gio.File.new_for_path(path).set_attribute_uint32(
            'unix::mode', 0o700, Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    } catch (_e) {}

    _dirPath = path;
    return _dirPath;
}

/**
 * Build an unpredictable path inside the private scratch directory.
 * The file is NOT created — callers write it with O_EXCL semantics
 * (Gio.FileCreateFlags.PRIVATE) or rely on the 0700 parent directory.
 *
 * @param {string} prefix — short descriptive prefix, e.g. 'proc'
 * @param {string} suffix — file extension including the dot, e.g. '.txt'
 * @returns {string|null}
 */
export function makeTmpPath(prefix, suffix) {
    const dir = privateTmpDir();
    if (!dir) return null;
    const name = `${prefix}-${GLib.uuid_string_random()}${suffix}`;
    return GLib.build_filenamev([dir, name]);
}

/** Delete a scratch file, ignoring "already gone" and permission errors. */
export function deleteQuietly(path) {
    if (!path) return;
    try { Gio.File.new_for_path(path).delete(null); } catch (_e) {}
}

/**
 * Remove scratch files older than STALE_AGE_SECS. Called opportunistically
 * before writing a new one so files handed to an external viewer (which we
 * cannot delete immediately) do not accumulate for the life of the session.
 */
export function pruneStale() {
    const dir = privateTmpDir();
    if (!dir) return;
    try {
        const cutoff = GLib.get_real_time() / 1_000_000 - STALE_AGE_SECS;
        const enumerator = Gio.File.new_for_path(dir).enumerate_children(
            'standard::name,time::modified',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        try {
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_attribute_uint64('time::modified') < cutoff)
                    deleteQuietly(GLib.build_filenamev([dir, info.get_name()]));
            }
        } finally {
            try { enumerator.close(null); } catch (_e) {}
        }
    } catch (_e) {}
}
