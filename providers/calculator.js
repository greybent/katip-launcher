// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Grey — developed with Claude (Anthropic)

'use strict';

import { BaseProvider } from './base.js';
import St from 'gi://St';

/**
 * CalculatorProvider — safe math expression evaluator.
 *
 * Uses a hand-written recursive descent parser instead of Function()
 * because GNOME Shell's GJS sandbox blocks dynamic code evaluation.
 *
 * Supports:
 *   Arithmetic:  + - * / ^ % ( )
 *   Unary:       -x
 *   Functions:   sqrt abs floor ceil round sin cos tan log log2 log10
 *   Constants:   pi e
 *
 * Activating a result copies it to clipboard.
 */
export class CalculatorProvider extends BaseProvider {
    get id()       { return 'calculator'; }
    get label()    { return 'Calculator'; }
    get priority() { return 40; }

    query(text) {
        const expr = text.trim();
        if (!expr) return [];

        // Try unit conversion first
        const conv = this._tryConvert(expr);
        if (conv) {
            return [{
                id:         'calculator:convert',
                title:      conv.result,
                subtitle:   conv.label,
                icon:       null,
                iconName:   'accessories-calculator-symbolic',
                badgeLabel: 'calc',
                badgeStyle: 'amber',
                activate:   () => {
                    const clipboard = St.Clipboard.get_default();
                    clipboard.set_text(St.ClipboardType.CLIPBOARD, conv.result);
                },
            }];
        }

        if (!this._looksLikeMath(expr)) return [];

        try {
            const result = this._parse(expr);
            if (result === null || !isFinite(result)) return [];

            const formatted = this._format(result);
            return [{
                id:         'calculator:result',
                title:      formatted,
                subtitle:   expr,
                icon:       null,
                iconName:   'accessories-calculator-symbolic',
                badgeLabel: 'calc',
                badgeStyle: 'amber',
                activate:   () => {
                    const clipboard = St.Clipboard.get_default();
                    clipboard.set_text(St.ClipboardType.CLIPBOARD, formatted);
                },
            }];
        } catch (_e) {
            return [];
        }
    }

    // ── Unit conversion ────────────────────────────────────────────────────
    // Accepts patterns like "100 km to miles", "32F to C", "1.5 kg in lbs"

    _tryConvert(text) {
        const m = text.trim().match(
            /^([\d.]+)\s*([a-zA-Z°]+)\s+(?:to|in|as)\s+([a-zA-Z°]+)$/i
        );
        if (!m) return null;

        const val  = parseFloat(m[1]);
        const from = m[2].toLowerCase().replace('°', '');
        const to   = m[3].toLowerCase().replace('°', '');
        if (isNaN(val)) return null;

        // Conversion table: [fromUnit, toUnit, factor or function]
        const CONVERSIONS = [
            // Length
            ['km',  'mi',    v => v * 0.621371],
            ['mi',  'km',    v => v * 1.60934],
            ['km',  'miles', v => v * 0.621371],
            ['miles','km',   v => v * 1.60934],
            ['m',   'ft',    v => v * 3.28084],
            ['ft',  'm',     v => v / 3.28084],
            ['m',   'yards', v => v * 1.09361],
            ['yards','m',    v => v / 1.09361],
            ['cm',  'in',    v => v / 2.54],
            ['in',  'cm',    v => v * 2.54],
            ['in',  'inches',v => v * 2.54, 'cm'],
            // Mass
            ['kg',  'lbs',   v => v * 2.20462],
            ['kg',  'lb',    v => v * 2.20462],
            ['lbs', 'kg',    v => v / 2.20462],
            ['lb',  'kg',    v => v / 2.20462],
            ['g',   'oz',    v => v / 28.3495],
            ['oz',  'g',     v => v * 28.3495],
            // Temperature
            ['c',   'f',     v => v * 9/5 + 32],
            ['f',   'c',     v => (v - 32) * 5/9],
            ['celsius','fahrenheit', v => v * 9/5 + 32],
            ['fahrenheit','celsius', v => (v - 32) * 5/9],
            ['c',   'k',     v => v + 273.15],
            ['k',   'c',     v => v - 273.15],
            // Speed
            ['kmh', 'mph',   v => v * 0.621371],
            ['mph', 'kmh',   v => v / 0.621371],
            ['km/h','mph',   v => v * 0.621371],
            ['mph', 'km/h',  v => v / 0.621371],
            ['ms',  'kmh',   v => v * 3.6],
            ['m/s', 'km/h',  v => v * 3.6],
            // Volume
            ['l',   'gal',   v => v * 0.264172],
            ['gal', 'l',     v => v / 0.264172],
            ['ml',  'oz',    v => v / 29.5735],
            ['oz',  'ml',    v => v * 29.5735],
            // Data
            ['gb',  'mb',    v => v * 1024],
            ['mb',  'gb',    v => v / 1024],
            ['tb',  'gb',    v => v * 1024],
            ['gb',  'tb',    v => v / 1024],
            ['mb',  'kb',    v => v * 1024],
            ['kb',  'mb',    v => v / 1024],
            // Pressure
            ['bar', 'psi',   v => v * 14.5038],
            ['psi', 'bar',   v => v / 14.5038],
            ['bar', 'kpa',   v => v * 100],
            ['kpa', 'bar',   v => v / 100],
        ];

        for (const row of CONVERSIONS) {
            if (row[0] === from && row[1] === to) {
                const converted = row[2](val);
                const formatted = Number.isInteger(converted)
                    ? String(converted)
                    : parseFloat(converted.toPrecision(6)).toString();
                return {
                    result: `${formatted} ${m[3]}`,
                    label:  `${m[1]} ${m[2]} → ${m[3]}`,
                };
            }
        }
        return null;
    }

    _looksLikeMath(expr) {
        // Must contain a digit OR a known constant, and look like an expression
        return /[\d.]/.test(expr) || /\b(pi|e|sqrt|abs|sin|cos|tan|log)\b/.test(expr);
    }

    // ── Recursive descent parser ────────────────────────────────────────────

    _parse(expr) {
        // Reject absurdly long expressions before parsing
        if (expr.length > 200) return null;

        // Normalise: lowercase, collapse spaces, replace constants
        const s = expr
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/\bpi\b/g, String(Math.PI))
            .replace(/\be\b/g, String(Math.E));

        this._src   = s;
        this._pos   = 0;
        this._depth = 0; // recursion depth guard
        const result = this._parseExpr();
        if (this._pos !== this._src.length) return null; // unconsumed input
        return result;
    }

    _parseExpr() { return this._parseAddSub(); }

    _parseAddSub() {
        let left = this._parseMulDiv();
        while (this._pos < this._src.length) {
            const op = this._src[this._pos];
            if (op !== '+' && op !== '-') break;
            this._pos++;
            const right = this._parseMulDiv();
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }

    _parseMulDiv() {
        let left = this._parsePow();
        while (this._pos < this._src.length) {
            const op = this._src[this._pos];
            if (op !== '*' && op !== '/' && op !== '%') break;
            this._pos++;
            const right = this._parsePow();
            if (op === '*') left *= right;
            else if (op === '/') left /= right;
            else left %= right;
        }
        return left;
    }

    _parsePow() {
        let base = this._parseUnary();
        if (this._pos < this._src.length && this._src[this._pos] === '^') {
            this._pos++;
            const exp = this._parsePow(); // right-associative
            base = Math.pow(base, exp);
        }
        return base;
    }

    _parseUnary() {
        if (++this._depth > 100) throw new Error('expression too deeply nested');
        try {
            if (this._pos < this._src.length && this._src[this._pos] === '-') {
                this._pos++;
                return -this._parseUnary();
            }
            if (this._pos < this._src.length && this._src[this._pos] === '+') {
                this._pos++;
                return this._parseUnary();
            }
            return this._parseCallOrAtom();
        } finally {
            this._depth--;
        }
    }

    _parseCallOrAtom() {
        // Named functions
        const fnMap = {
            sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor,
            ceil: Math.ceil, round: Math.round, sin: Math.sin,
            cos: Math.cos, tan: Math.tan, log2: Math.log2,
            log10: Math.log10, log: Math.log,
        };
        // Try longest match first (log10 before log)
        for (const name of Object.keys(fnMap).sort((a, b) => b.length - a.length)) {
            if (this._src.startsWith(name, this._pos)) {
                const after = this._pos + name.length;
                if (after < this._src.length && this._src[after] === '(') {
                    this._pos = after + 1;
                    const arg = this._parseExpr();
                    if (this._src[this._pos] !== ')') throw new Error('missing )');
                    this._pos++;
                    return fnMap[name](arg);
                }
            }
        }
        return this._parseAtom();
    }

    _parseAtom() {
        if (this._src[this._pos] === '(') {
            this._pos++;
            const v = this._parseExpr();
            if (this._src[this._pos] !== ')') throw new Error('missing )');
            this._pos++;
            return v;
        }
        // Number
        const numMatch = /^-?[\d]+(?:\.[\d]+)?(?:e[+-]?[\d]+)?/.exec(
            this._src.slice(this._pos)
        ) || /^[\d]+(?:\.[\d]+)?(?:e[+-]?[\d]+)?/.exec(this._src.slice(this._pos));
        if (numMatch) {
            this._pos += numMatch[0].length;
            return parseFloat(numMatch[0]);
        }
        throw new Error(`unexpected char at pos ${this._pos}: ${this._src[this._pos]}`);
    }

    _format(n) {
        if (!isFinite(n)) return String(n);
        if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
        return parseFloat(n.toPrecision(10)).toString();
    }
}
