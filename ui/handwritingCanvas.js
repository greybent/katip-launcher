// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

// ── Constants ─────────────────────────────────────────────────────────────────

const STROKE_WIDTH     = 1.0;   // px — as thin as possible
const EXTEND_PX        = 40;    // px to extend above and below the search entry
const IDLE_TIMEOUT_MS  = 800;   // ms after pen lift before recognition fires
const CLEAR_TIMEOUT_MS = 3000;  // ms after recognition before overlay hides
const MIN_DIST_SQ      = 4.0;   // min squared px between points (jitter filter)

const GOOGLE_HW_API =
    'https://inputtools.google.com/request?itc={lang}-t-i0-handwrit&app=demopage';

const LOCALE_LANG_MAP = {
    de: 'de', en: 'en', fr: 'fr', es: 'es',
    it: 'it', nl: 'nl', pt: 'pt', ru: 'ru',
    ja: 'ja', zh: 'zh-CN', ar: 'ar',
};

// MyScript requires locale-style codes (e.g. en_US), not BCP-47 short codes
const MYSCRIPT_LANG_MAP = {
    en: 'en_US', de: 'de_DE', fr: 'fr_FR', es: 'es_ES',
    it: 'it_IT', pt: 'pt_BR', nl: 'nl_NL', ru: 'ru_RU',
    'zh-CN': 'zh_CN', ja: 'ja_JP', ar: 'ar_AE',
};

function detectSystemLanguage() {
    try {
        for (const lang of GLib.get_language_names()) {
            const code = lang.split('_')[0].split('.')[0].toLowerCase();
            if (LOCALE_LANG_MAP[code]) return LOCALE_LANG_MAP[code];
        }
    } catch (_e) {}
    return 'en';
}

function isScribble(points) {
    if (points.length < 8) return false;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const xSpan = Math.max(...xs) - Math.min(...xs);
    const ySpan = Math.max(...ys) - Math.min(...ys);
    if (xSpan < 40 || ySpan > xSpan * 0.9) return false;
    const segs = [];
    for (let i = 1; i < xs.length; i++) {
        const dx = xs[i] - xs[i - 1];
        if (Math.abs(dx) < 4) continue;
        const d = dx > 0 ? 1 : -1;
        if (!segs.length || segs[segs.length - 1] !== d) segs.push(d);
    }
    return segs.reduce((n, d, i) => i > 0 && d !== segs[i - 1] ? n + 1 : n, 0) >= 3;
}

// ── HandwritingCanvas ─────────────────────────────────────────────────────────
// Transparent overlay positioned over the search entry.
// The widget is added to the launcher's top-level actor (not the search row)
// and positioned to exactly cover the entry plus EXTEND_PX above and below.

export class HandwritingCanvas {

    constructor(settings) {
        this._settings      = settings;
        this._strokes       = [];
        this._currentStroke = null;
        this._drawing       = false;
        this._idleId        = null;
        this._clearId       = null;
        this._soup          = null;
        this._entryRef      = null; // reference to the search entry actor

        // Callbacks set by caller
        this.onTextRecognised = null;
        this.onCanvasHidden   = null;
        this._tintAlpha       = 0;
        this._fadeId          = null;

        // Main drawing area — transparent, extends EXTEND_PX above/below entry
        this.widget = new St.Bin({
            reactive:  false,
            visible:   false,
            x_expand:  false,
            y_expand:  false,
            style:     'background: transparent;',
        });

        this._drawArea = new St.DrawingArea({
            reactive:  false,
            x_expand:  true,
            y_expand:  true,
        });
        this._drawArea.connect('repaint', this._onRepaint.bind(this));
        this.widget.set_child(this._drawArea);

        // Border box — sits over the search entry only, no extension above/below
        this._borderBox = new St.Bin({
            reactive:  false,
            visible:   false,
            x_expand:  false,
            y_expand:  false,
            style:     'background: transparent;',
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────

    // Call after adding widget to the launcher overlay actor.
    // entryActor: the St.Entry or its parent St.BoxLayout for positioning.
    setEntryActor(entryActor) {
        this._entryRef = entryActor;
    }

    hasStrokes() {
        return this._strokes.length > 0 || this._currentStroke !== null;
    }

    // Reposition overlay to cover the entry. Call when launcher opens/resizes.
    reposition() {
        if (!this._entryRef) return;

        // get_transformed_position() returns the actor's absolute stage coords
        const [ex, ey] = this._entryRef.get_transformed_position();
        const lw = this._entryRef.get_transformed_size()[0];
        const lh = this._entryRef.height;

        if (!lw || lw <= 0) return;

        const x = Math.round(ex);
        const y = Math.round(ey - EXTEND_PX);
        const w = Math.round(lw);
        const h = Math.round(lh + EXTEND_PX * 2);

        this.widget.set_position(x, y);
        this.widget.set_size(w, h);
        this._drawArea?.set_size(w, h);
        this._drawArea?.queue_repaint();

        // Border box covers only the search entry (no extension)
        const bx = Math.round(ex);
        const by = Math.round(ey);
        const bw = Math.round(lw);
        const bh = Math.round(this._entryRef.height);
        this._borderBox.set_position(bx, by);
        this._borderBox.set_size(bw, bh);
    }

    showOverlay() {
        this.widget.visible    = true;
        this.widget.reactive   = true;
        this.widget.style      = 'background: transparent;';
        this._borderBox.visible = true;
        this._borderBox.style  = 'background: transparent;';
        this.reposition();
        // Fade tint in over 400ms
        this._tintAlpha = 0;
        this._startTintFadeIn();
    }

    _startTintFadeIn() {
        this._cancelFade();
        const TARGET  = 0.025; // very subtle max alpha
        const STEPS   = 20;
        const STEP_MS = 20;    // 20 steps × 20ms = 400ms
        const delta   = TARGET / STEPS;
        this._fadeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, STEP_MS, () => {
            this._tintAlpha = Math.min(TARGET, (this._tintAlpha ?? 0) + delta);
            this._drawArea.queue_repaint();
            if (this._tintAlpha >= TARGET - 0.0001) {
                this._fadeId = null;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    hideOverlay() {
        this._cancelIdle();
        this._cancelClear();
        this._cancelFade();
        this._tintAlpha = 0;
        this.widget.reactive    = false;
        this.widget.visible     = false;
        this._borderBox.visible = false;
        this._borderBox.style   = 'background: transparent;';
        this._clearStrokes();
        if (this.onCanvasHidden) this.onCanvasHidden();
    }

    handleEvent(event) {
        const type = event.type();
        if (type === Clutter.EventType.BUTTON_PRESS)   { this._penDown(event); return Clutter.EVENT_STOP; }
        if (type === Clutter.EventType.MOTION)         { this._penMove(event); return Clutter.EVENT_STOP; }
        if (type === Clutter.EventType.BUTTON_RELEASE) { this._penUp(event);   return Clutter.EVENT_STOP; }
        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        this._cancelIdle();
        this._cancelClear();
        this._cancelFade();
        // Null callbacks first — in-flight async recognition callbacks check
        // these before touching the (now-being-destroyed) launcher entry widget.
        this.onTextRecognised = null;
        this.onCanvasHidden   = null;
        this._soup = null;
        this._borderBox?.destroy();
        this._borderBox = null;
        this.widget.destroy();
        this._drawArea = null;
    }

    // ── Stroke lifecycle ──────────────────────────────────────────────────────

    _penDown(event) {
        this._cancelIdle();
        this._cancelClear();
        // Make sure overlay stays visible and border is shown
        // keep border box visible while drawing
        this._drawing = true;
        const [x, y] = this._localCoords(event);
        this._currentStroke = [[x, y]];
    }

    _penMove(event) {
        if (!this._drawing || !this._currentStroke) return;
        const [x, y] = this._localCoords(event);
        const pts = this._currentStroke;
        if (pts.length) {
            const [lx, ly] = pts[pts.length - 1];
            if ((x - lx) ** 2 + (y - ly) ** 2 < MIN_DIST_SQ) return;
        }
        pts.push([x, y]);
        this._drawArea.queue_repaint();
    }

    _penUp(event) {
        if (!this._drawing) return;
        this._drawing = false;
        const [x, y] = this._localCoords(event);

        if (this._currentStroke) {
            this._currentStroke.push([x, y]);

            if (isScribble(this._currentStroke)) {
                this._clearStrokes();
                this._currentStroke = null;
                return;
            }

            if (this._currentStroke.length >= 2)
                this._strokes.push(this._currentStroke);
            this._currentStroke = null;
        }

        this._drawArea.queue_repaint();

        if (this._strokes.length > 0) {
            this._idleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, IDLE_TIMEOUT_MS, () => {
                this._idleId = null;
                this._recognise();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _localCoords(event) {
        // get_coords() returns [x, y] — both valid for TABLET_DEVICE events
        const c = event.get_coords();
        const sx = c[0];
        const sy = c[1];

        if (sx === undefined || sy === undefined || isNaN(sx) || isNaN(sy))
            return [0, 0];

        const [ok, lx, ly] = this._drawArea.transform_stage_point(sx, sy);
        return (ok && !isNaN(lx) && !isNaN(ly)) ? [lx, ly] : [sx, sy];
    }

    // ── Cairo rendering ───────────────────────────────────────────────────────

    _onRepaint(_area) {
        const cr = this._drawArea.get_context();
        const w  = this._drawArea.get_width();
        const h  = this._drawArea.get_height();

        // Clear to fully transparent
        cr.setOperator(1); // SOURCE
        cr.setSourceRGBA(0, 0, 0, 0);
        cr.paint();

        cr.setOperator(2); // OVER

        // Draw animated tint + border together so both fade in smoothly
        if (this._tintAlpha > 0) {
            // Tint over entry area only
            cr.setSourceRGBA(0.31, 0.43, 1.0, this._tintAlpha);
            cr.rectangle(0, EXTEND_PX, w, h - EXTEND_PX * 2);
            cr.fill();

            // Border around entry area — fades at 8× the tint alpha (max ~0.2)
            const borderAlpha = Math.min(0.20, this._tintAlpha * 8);
            cr.setSourceRGBA(0.39, 0.56, 1.0, borderAlpha);
            cr.setLineWidth(1.0);
            cr.rectangle(0.5, EXTEND_PX + 0.5, w - 1, h - EXTEND_PX * 2 - 1);
            cr.stroke();
        }

        // Draw strokes
        cr.setLineCap(1);  // ROUND
        cr.setLineJoin(1); // ROUND
        cr.setLineWidth(STROKE_WIDTH);

        for (const stroke of this._strokes)
            this._drawStroke(cr, stroke, 0.85);

        if (this._currentStroke && this._currentStroke.length >= 2)
            this._drawStroke(cr, this._currentStroke, 1.0);

        cr.$dispose();
    }

    _drawStroke(cr, pts, alpha) {
        if (pts.length < 2) return;
        cr.setSourceRGBA(1, 1, 1, alpha);
        cr.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++)
            cr.lineTo(pts[i][0], pts[i][1]);
        cr.stroke();
    }

    _clearStrokes() {
        this._strokes = [];
        this._currentStroke = null;
        this._drawArea?.queue_repaint();
    }

    // ── Recognition ───────────────────────────────────────────────────────────

    _recognise() {
        if (!this._strokes.length) return;
        let backend = 'tesseract';
        try { backend = this._settings.get_string('handwriting-backend') || 'tesseract'; } catch (_e) {}
        if (backend === 'myscript')       this._recogniseMyScript();
        else if (backend === 'google')    this._recogniseGoogle();
        else                              this._recogniseTesseract();
    }

    _onRecognised(text) {
        if (!text) return;
        this._clearStrokes();
        this._borderBox.visible = false;
        if (this.onTextRecognised) this.onTextRecognised(text);
        this._clearId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLEAR_TIMEOUT_MS, () => {
            this._clearId = null;
            this.hideOverlay();
            return GLib.SOURCE_REMOVE;
        });
    }

    _buildInk() {
        return this._strokes.filter(s => s.length >= 2)
            .map(s => [s.map(p => p[0]), s.map(p => p[1])]);
    }

    _getLanguage() {
        try {
            const lang = this._settings.get_string('handwriting-language');
            if (lang && lang !== 'auto') return lang;
        } catch (_e) {}
        return detectSystemLanguage();
    }

    _getTesseractLang() {
        const map = { en: 'eng', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', nl: 'nld' };
        return map[this._getLanguage()] || 'eng';
    }

    // ── Google backend ────────────────────────────────────────────────────────

    _recogniseGoogle() {
        const lang = this._getLanguage();
        const url  = GOOGLE_HW_API.replace('{lang}', lang);
        const ink  = this._buildInk();
        if (!ink.length) return;

        const w = this._drawArea.get_width()  || 600;
        const h = this._drawArea.get_height() || 80;
        const payload = JSON.stringify({
            app_version: 0.4, api_level: '5.37.3', device: '5.0',
            input_type: 0, options: 'enable_pre_space',
            requests: [{ writing_guide: { width: w, height: h }, ink, language: lang }],
        });

        if (!this._soup) this._soup = new Soup.Session();
        const msg = Soup.Message.new('POST', url);
        msg.set_request_body_from_bytes('application/json',
            GLib.Bytes.new(new TextEncoder().encode(payload)));
        this._soup.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                const data  = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                if (Array.isArray(data) && data.length > 1 &&
                    Array.isArray(data[1]?.[0]?.[1]) && data[1][0][1].length &&
                    typeof data[1][0][1][0] === 'string')
                    this._onRecognised(data[1][0][1][0].trim());
            } catch (e) { console.warn('[Katip] Google HW failed:', e.message); }
        });
    }

    // ── MyScript backend ──────────────────────────────────────────────────────
    // The hmac header must be HMAC-SHA512(body, appKey+hmacKey) in hex.
    // GJS has no native HMAC so we compute it via openssl subprocess.

    _recogniseMyScript() {
        let appKey = '', hmacKey = '';
        try {
            appKey  = this._settings.get_string('handwriting-myscript-app-key')  || '';
            hmacKey = this._settings.get_string('handwriting-myscript-hmac-key') || '';
        } catch (_e) {}
        if (!appKey || !hmacKey) {
            console.warn('[Katip] MyScript: API keys not configured in Settings → Handwriting');
            return;
        }

        const w = this._drawArea.get_width()  || 600;
        const h = this._drawArea.get_height() || 80;
        const lang   = this._getLanguage();
        const msLang = MYSCRIPT_LANG_MAP[lang] || lang;

        const strokes = this._strokes.filter(s => s.length >= 2)
            .map(s => ({
                x: s.map(p => p[0]),
                y: s.map(p => p[1]),
                t: s.map((_, i) => i * 10),  // synthetic 10ms timestamps required by API
            }));
        if (!strokes.length) return;

        const payload = JSON.stringify({
            contentType:  'Text',
            xDPI: 96, yDPI: 96,
            width: w, height: h,
            language: msLang,
            strokeGroups: [{ strokes }],
        });

        // Compute HMAC-SHA512(payload, appKey+hmacKey) via openssl
        const userKey = appKey + hmacKey;
        const proc = new Gio.Subprocess({
            argv: ['openssl', 'dgst', '-sha512', '-hmac', userKey],
            flags: Gio.SubprocessFlags.STDIN_PIPE |
                   Gio.SubprocessFlags.STDOUT_PIPE |
                   Gio.SubprocessFlags.STDERR_SILENCE,
        });
        proc.init(null);
        proc.communicate_utf8_async(payload, null, (_proc, res) => {
            try {
                const [, stdout] = _proc.communicate_utf8_finish(res);
                // openssl outputs: "HMAC-SHA512(stdin)= <hex>"
                const hmacHex = (stdout || '').trim().split('=').pop().trim();
                if (!hmacHex) {
                    console.warn('[Katip] MyScript: HMAC computation failed');
                    return;
                }
                this._sendMyScript(payload, appKey, hmacHex);
            } catch (e) { console.warn('[Katip] MyScript HMAC failed:', e.message); }
        });
    }

    _sendMyScript(payload, appKey, hmacHex) {
        if (!this._soup) this._soup = new Soup.Session();
        const msg = Soup.Message.new('POST', 'https://cloud.myscript.com/api/v4.0/iink/batch');
        // Set Content-Type via headers first, then pass null to set_request_body_from_bytes
        // so libsoup3 does not try to also set Content-Type internally — doing both
        // trips a GJS non-null assertion ("parameter contentType must not be null").
        const reqHeaders = msg.get_request_headers();
        reqHeaders.replace('Content-Type',   'application/json');
        reqHeaders.replace('Accept',         'application/vnd.myscript.jiix');
        reqHeaders.replace('applicationKey', appKey);
        reqHeaders.replace('hmac',           hmacHex);
        msg.set_request_body_from_bytes(null,
            GLib.Bytes.new(new TextEncoder().encode(payload)));
        this._soup.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                const data  = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                const text  = (data?.label || '').trim();
                if (text) this._onRecognised(text);
                else console.warn('[Katip] MyScript: no label in response', JSON.stringify(data));
            } catch (e) { console.warn('[Katip] MyScript HW failed:', e.message); }
        });
    }

    // ── Tesseract backend ─────────────────────────────────────────────────────

    _recogniseTesseract() {
        if (!this._strokes.length) return;
        try {
            const w = Math.max(400, this._drawArea.get_width());
            const h = Math.max(80,  this._drawArea.get_height());

            // Render strokes to PNG with white background
            const cairo  = imports.gi.cairo;
            const surface = new cairo.ImageSurface(0, w, h); // ARGB32
            const cr      = new cairo.Context(surface);
            cr.setSourceRGB(1, 1, 1);
            cr.paint();
            cr.setSourceRGB(0, 0, 0);
            cr.setLineWidth(2.5);
            cr.setLineCap(1);
            cr.setLineJoin(1);
            for (const stroke of this._strokes) {
                if (stroke.length < 2) continue;
                cr.moveTo(stroke[0][0], stroke[0][1]);
                for (let i = 1; i < stroke.length; i++)
                    cr.lineTo(stroke[i][0], stroke[i][1]);
                cr.stroke();
            }

            const tmpPng = GLib.build_filenamev([GLib.get_tmp_dir(), 'katip-hw.png']);
            surface.writeToPNG(tmpPng);

            const lang = this._getTesseractLang();
            const proc = new Gio.Subprocess({
                argv:  ['tesseract', tmpPng, 'stdout', '-l', lang, '--psm', '7'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (_proc, res) => {
                try {
                    const [, stdout] = _proc.communicate_utf8_finish(res);
                    const text = (stdout || '').trim().replace(//g, '');
                    if (text) this._onRecognised(text);
                    try { Gio.File.new_for_path(tmpPng).delete(null); } catch (_e) {}
                } catch (e) { console.warn('[Katip] Tesseract failed:', e.message); }
            });
        } catch (e) {
            console.warn('[Katip] Tesseract render failed:', e.message);
        }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    _cancelIdle() {
        if (this._idleId) { GLib.source_remove(this._idleId); this._idleId = null; }
    }

    _cancelClear() {
        if (this._clearId) { GLib.source_remove(this._clearId); this._clearId = null; }
    }

    _cancelFade() {
        if (this._fadeId) { GLib.source_remove(this._fadeId); this._fadeId = null; }
    }
}
