// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Hard cap on total files visited regardless of settings (safety valve)
const SCAN_MAX_FILES = 5000;

export class FilesProvider extends BaseProvider {
    get id()       { return 'files'; }
    get label()    { return 'Files'; }
    get priority() { return 30; }

    constructor(settings) {
        super(settings);
        this._connection = null;
        this._available  = false;
        this._ontology   = null;
        this._initConnection();
    }

    async _initConnection() {
        try {
            // Dynamic import — Tracker may not be installed on all systems
            const { default: Tracker } = await import('gi://Tracker');
            this._connection = Tracker.SparqlConnection.bus_new(
                'org.freedesktop.Tracker3.Miner.Files',
                null, null
            );
            this._available = true;
        } catch (e) {
            console.warn('[Kapit] FilesProvider: Tracker unavailable —', e.message);
            this._available = false;
        }
    }

    async query(text) {
        if (!text || text.length < 2) return [];

        const homeDir = GLib.get_home_dir();
        const allPaths = this._settings.get_strv('file-search-paths')
            .map(p => p === '~' ? homeDir : p);

        // Split paths into Tracker-indexed (home) and unindexed (everything else)
        const trackerPaths = allPaths.filter(p => p === homeDir || p.startsWith(homeDir + '/'));
        const scanPaths    = allPaths.filter(p => p !== homeDir && !p.startsWith(homeDir + '/'));

        const results = [];
        const seen    = new Set();

        // ── Tracker query for home directory paths ────────────────────────────
        if (trackerPaths.length > 0 && this._available) {
            const trackerResults = await this._queryTracker(text, trackerPaths);
            for (const r of trackerResults) {
                if (!seen.has(r.id)) {
                    seen.add(r.id);
                    results.push(r);
                }
            }
        }

        // ── Filesystem scan for all other paths ───────────────────────────────
        for (const scanPath of scanPaths) {
            const scanResults = await this._scanDirectory(text, scanPath);
            for (const r of scanResults) {
                if (!seen.has(r.id)) {
                    seen.add(r.id);
                    results.push(r);
                }
            }
        }

        return results;
    }

    // ── Tracker SPARQL query ──────────────────────────────────────────────────

    async _queryTracker(text, paths) {
        if (!this._connection) return [];

        if (!this._ontology) {
            this._ontology = await this._detectOntology();
            if (!this._ontology) {
                console.warn('[Kapit] FilesProvider: ontology detection failed');
                return [];
            }
        }

        // Whitelist: only allow characters that are safe inside a SPARQL string literal
        const safe = text.replace(/[^a-zA-Z0-9 .\-_äöüÄÖÜß]/g, '').trim();
        if (!safe) return [];

        const { prefixBlock, nie, nfo } = this._ontology;

        const unionBlocks = paths.map(p => `{
                ?file a ${nfo}FileDataObject ;
                      ${nie}url ?url ;
                      ${nfo}fileName ?name .
                FILTER (STRSTARTS(STR(?url), "file://${p}/"))
                FILTER (CONTAINS(LCASE(?name), LCASE("${safe}")))
            }`).join('\nUNION\n');

        const sparql = `${prefixBlock}
            SELECT DISTINCT ?url ?name WHERE {
                ${unionBlocks}
            }
            ORDER BY ?name
            LIMIT 40
        `;

        try {
            const cursor = await new Promise((resolve, reject) => {
                this._connection.query_async(sparql, null, (conn, res) => {
                    try { resolve(conn.query_finish(res)); }
                    catch (e) { reject(e); }
                });
            });

            const results = [];
            while (cursor.next(null)) {
                const urlStr = cursor.get_string(0)[0];
                const name   = cursor.get_string(1)[0];
                results.push(this._makeResult(name, urlStr));
            }
            cursor.close();
            return results;

        } catch (e) {
            console.warn('[Kapit] FilesProvider Tracker query failed:', e.message);
            this._ontology = null;
            return [];
        }
    }

    // ── Filesystem scanner for non-Tracker paths ──────────────────────────────

    async _scanDirectory(text, rootPath) {
        return new Promise(resolve => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                const maxDepth   = this._settings.get_int('scan-max-depth');
                const maxResults = this._settings.get_int('scan-max-results');
                const results    = [];
                const needle     = text.toLowerCase();
                let   visited    = 0;
                const deadline   = Date.now() + 500; // 500ms cap to avoid blocking shell

                const scan = (dirPath, depth) => {
                    if (depth > maxDepth) return;
                    if (visited >= SCAN_MAX_FILES) return;
                    if (results.length >= maxResults) return;
                    if (Date.now() > deadline) return;

                    let dir, enumerator;
                    try {
                        dir = Gio.File.new_for_path(dirPath);
                        enumerator = dir.enumerate_children(
                            'standard::name,standard::type',
                            Gio.FileQueryInfoFlags.NONE,
                            null
                        );
                    } catch (_e) {
                        return; // unreadable directory — skip silently
                    }

                    try {
                        let info;
                        while ((info = enumerator.next_file(null)) !== null) {
                            visited++;
                            if (visited >= SCAN_MAX_FILES) break;
                            if (results.length >= maxResults) break;

                            const name     = info.get_name();
                            const fileType = info.get_file_type();
                            const child    = dir.get_child(name);
                            const childPath = child.get_path();

                            if (fileType === Gio.FileType.DIRECTORY) {
                                // Skip hidden directories
                                if (!name.startsWith('.'))
                                    scan(childPath, depth + 1);
                            } else if (fileType === Gio.FileType.REGULAR) {
                                if (name.toLowerCase().includes(needle))
                                    results.push(this._makeResult(name, child.get_uri()));
                            }
                        }
                    } finally {
                        try { enumerator.close(null); } catch (_) {}
                    }
                };

                scan(rootPath, 0);
                resolve(results);
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    // ── Shared result builder ─────────────────────────────────────────────────

    _makeResult(name, urlStr) {
        const file        = Gio.File.new_for_uri(urlStr);
        const contentType = Gio.content_type_guess(name, null)[0];
        const gicon       = Gio.content_type_get_icon(contentType);
        const parent      = file.get_parent();
        const parentPath  = parent?.get_path() ?? '';
        const homeDir     = GLib.get_home_dir();
        const shortPath   = parentPath.startsWith(homeDir)
            ? '~' + parentPath.slice(homeDir.length)
            : parentPath;
        const parentUri   = parent?.get_uri() ?? null;

        return {
            id:               `file:${urlStr}`,
            title:            name,
            subtitle:         shortPath,
            icon:             gicon,
            iconName:         null,
            badgeLabel:       'file',
            badgeStyle:       'green',
            activate:         () => Gio.AppInfo.launch_default_for_uri(urlStr, null),
            activateAlt:      parentUri
                ? () => Gio.AppInfo.launch_default_for_uri(parentUri, null)
                : null,
            activateAltLabel: 'Open folder',
        };
    }

    // ── Ontology detection ────────────────────────────────────────────────────

    async _detectOntology() {
        const candidates = [
            {
                label: 'tracker.api.gnome.org/v3',
                prefixBlock: `PREFIX nie: <http://tracker.api.gnome.org/ontology/v3/nie#>\nPREFIX nfo: <http://tracker.api.gnome.org/ontology/v3/nfo#>`,
                nie: 'nie:', nfo: 'nfo:',
            },
            {
                label: 'semanticdesktop.org (legacy)',
                prefixBlock: `PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>\nPREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>`,
                nie: 'nie:', nfo: 'nfo:',
            },
        ];

        for (const candidate of candidates) {
            const probe = `${candidate.prefixBlock}\nSELECT ?n WHERE { ?f a ${candidate.nfo}FileDataObject ; ${candidate.nfo}fileName ?n . } LIMIT 1`;
            try {
                const cursor = await new Promise((resolve, reject) => {
                    this._connection.query_async(probe, null, (conn, res) => {
                        try { resolve(conn.query_finish(res)); }
                        catch (e) { reject(e); }
                    });
                });
                cursor.close();
                return candidate;
            } catch (_e) {}
        }
        return null;
    }

    destroy() {
        try { this._connection?.close(); } catch (_) {}
        this._connection = null;
    }
}
