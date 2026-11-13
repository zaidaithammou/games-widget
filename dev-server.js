// Dev-only static server for debugging the renderer in a plain browser.
// Each port simulates one window mode at its real Electron pixel size.
// Usage: node dev-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const ASSETS = path.join(ROOT, 'assets');

const MODES = {
    3100: { name: 'library',            width: 560, height: 520 },
    3101: { name: 'perf-vertical',       width: 202, height: 265, mode: 'performance' },
    3102: { name: 'perf-horizontal',     width: 492, height: 50,  mode: 'performance', horizontal: true },
    3103: { name: 'settings-open',       width: 560, height: 520, openSettings: true },
    3104: { name: 'compact',             width: 56,  height: 56,  compact: true },
};

const FAKE_GAMES = [
    { id: 'g1', name: 'Elden Ring',            platform: 'Steam',          category: 'Action RPG',   group: null },
    { id: 'g2', name: 'Cyberpunk 2077',        platform: 'GOG',            category: 'RPG',          group: null },
    { id: 'g3', name: 'Hades II',              platform: 'Epic Games',     category: 'Roguelike',    group: null },
    { id: 'g4', name: 'Baldur\'s Gate 3',      platform: 'Steam',          category: 'RPG',          group: null },
    { id: 'g5', name: 'Helldivers 2',          platform: 'Steam',          category: 'Shooter',      group: null },
    { id: 'g6', name: 'Stardew Valley',        platform: 'GOG',            category: 'Simulation',   group: null },
    { id: 'g7', name: 'Hollow Knight',         platform: 'Steam',          category: 'Metroidvania', group: null },
    { id: 'g8', name: 'Civilization VII',      platform: 'Steam',          category: 'Strategy',     group: null },
];

function shimSource(cfg) {
    return `// Auto-generated dev shim for mode "${cfg.name}" — not part of the app.
(function () {
    const cfg = ${JSON.stringify(cfg)};
    const listeners = { windowMode: [], compact: [], sample: [], rtss: [], openSettings: [] };

    window.gamesWidget = {
        minimize() {}, close() {}, togglePerformanceMode() {}, beginDrag() {}, endDrag() {},
        setPerformanceLayout(layout) { console.log('[dev] setPerformanceLayout', layout); },
        saveGames() {}, saveUserGroups() {},
        openExternal(url) { console.log('[dev] openExternal', url); },
        scanInstalledGames: async () => [],
        chooseManualGames: async () => [],
        findArtwork: async () => null,
        findBackupArtwork: async () => null,
        getExecutableIcon: async () => null,
        launchGame: async () => ({ ok: false }),
        chooseGameWallpaper: async () => null,
        loadGames: async () => ${JSON.stringify(FAKE_GAMES)},
        loadUserGroups: async () => ['Favorites'],
        onWindowMode: (cb) => listeners.windowMode.push(cb),
        onCompactState: (cb) => listeners.compact.push(cb),
        onPerformanceSample: (cb) => listeners.sample.push(cb),
        onRtssStatus: (cb) => listeners.rtss.push(cb),
        onOpenSettings: (cb) => listeners.openSettings.push(cb),
    };

    const style = document.createElement('style');
    style.textContent = [
        'html,body{margin:0;padding:0}',
        'body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#101319}',
        '#app{flex:none}',
        '.widget-container{width:' + cfg.width + 'px;height:' + cfg.height + 'px;' +
            'box-shadow:0 16px 48px rgba(0,0,0,.55);border-radius:12px;overflow:hidden}',
    ].join('');
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (cfg.compact) {
                document.body.classList.add('compact');
                listeners.compact.forEach((cb) => cb(true));
            }
            if (cfg.mode === 'performance') {
                listeners.windowMode.forEach((cb) => cb('performance'));
                if (cfg.horizontal) {
                    // Route through the real toggle so internal orientation state stays in sync.
                    document.getElementById('performanceLayoutBtn')?.click();
                }
                let t = 0;
                setInterval(() => {
                    t += 1;
                    const wobble = (base, amp, speed, phase = 0) =>
                        Math.max(0, Math.min(100, base + amp * Math.sin(t / speed + phase) + (Math.random() - 0.5) * 6));
                    listeners.sample.forEach((cb) => cb({
                        fps: Math.round(140 + 45 * Math.sin(t / 9) + 15 * Math.sin(t / 2.7)),
                        frameTime: null,
                        cpuTemp: Math.round(wobble(58, 9, 11)),
                        cpuLoad: Math.round(wobble(35, 25, 8)),
                        gpuTemp: Math.round(wobble(52, 8, 13, 2)),
                        gpuLoad: Math.round(wobble(30, 30, 7, 1)),
                        ramUsedGb: 11.4,
                        ramLoad: Math.round(wobble(62, 12, 10, 3)),
                        dependencies: { rtss: true, afterburner: true },
                    }));
                }, 400);
            }
            if (cfg.openSettings) document.getElementById('settingsBtn')?.click();
            listeners.rtss.forEach((cb) => cb({ state: 'ok' }));
            // One-shot layout dump for remote debugging — read via console capture.
            setTimeout(() => {
                const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), w: +r.width.toFixed(1), right: +r.right.toFixed(1) }; };
                const dump = {
                    mode: cfg.name,
                    panel: rect(document.querySelector('.performance-panel, .widget-container')),
                    rows: [...document.querySelectorAll('.perf-row')].map((row) => ({
                        rect: rect(row),
                        cols: getComputedStyle(row).gridTemplateColumns,
                        kids: [...row.children].map((k) => ({
                            cls: String(k.className && k.className.baseVal !== undefined ? k.className.baseVal : k.className).slice(0, 40),
                            id: k.id || '',
                            text: (k.textContent || '').trim().slice(0, 12),
                            ...rect(k),
                        })),
                    })),
                    cards: [...document.querySelectorAll('.perf-card')].map((c) => rect(c)),
                };
                console.log('LAYOUT-DUMP ' + JSON.stringify(dump));
            }, 1600);
        }, 60);
    });

    // --- Debug / annotation panel (dev only) ---
    const dbgBtn = document.createElement('button');
    dbgBtn.textContent = 'Debug';
    Object.assign(dbgBtn.style, {
        position: 'fixed', right: '12px', bottom: '12px', zIndex: '99999',
        padding: '6px 14px', borderRadius: '8px', border: '1px solid #3a3f4b',
        background: '#1c1f27', color: '#e6e8ee', cursor: 'pointer', font: '12px sans-serif',
    });
    document.body.appendChild(dbgBtn);

    const dbgPanel = document.createElement('div');
    Object.assign(dbgPanel.style, {
        position: 'fixed', right: '12px', bottom: '52px', zIndex: '99999', width: '320px',
        background: '#171a21', border: '1px solid #3a3f4b', borderRadius: '10px',
        padding: '12px', color: '#e6e8ee', font: '12px sans-serif', display: 'none',
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
    });
    dbgPanel.innerHTML =
        '<div style="font-weight:600;margin-bottom:6px">Annotate for Devin</div>' +
        '<div style="margin-bottom:6px;opacity:.75">1. Click "Pick element", then click anything in the widget.<br>2. Describe the issue below.<br>3. Click "Copy report" and paste it to me.</div>' +
        '<button id="dbgPick" style="margin-bottom:8px">Pick element</button>' +
        '<div id="dbgPicked" style="margin-bottom:8px;opacity:.8;max-height:80px;overflow:auto"></div>' +
        '<textarea id="dbgNotes" rows="4" placeholder="What looks wrong? Expected vs actual..." ' +
        'style="width:100%;box-sizing:border-box;background:#0f1116;color:#e6e8ee;border:1px solid #3a3f4b;border-radius:6px;padding:6px;font:12px sans-serif;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button id="dbgCopy" style="flex:1">Copy report</button>' +
        '<button id="dbgClear" style="flex:1">Clear</button></div>';
    document.body.appendChild(dbgPanel);
    dbgBtn.addEventListener('click', () => { dbgPanel.style.display = dbgPanel.style.display === 'none' ? 'block' : 'none'; });

    const picked = [];
    const pickedEl = dbgPanel.querySelector('#dbgPicked');
    const notesEl = dbgPanel.querySelector('#dbgNotes');
    let picking = false, hoverEl = null;

    function describe(el) {
        if (!el || el === document.body || el === document.documentElement) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '';
        return {
            sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + String(cls).trim().split(/\s+/).join('.') : ''),
            rect: Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height),
            font: cs.fontSize + '/' + cs.fontWeight + ' ' + cs.fontFamily.split(',')[0],
            color: cs.color,
        };
    }
    function renderPicked() {
        pickedEl.innerHTML = picked.map((p, i) => '<div>' + (i + 1) + '. ' + p.sel + ' <span style="opacity:.6">(' + p.rect + ', ' + p.font + ')</span></div>').join('');
    }
    dbgPanel.querySelector('#dbgPick').addEventListener('click', (e) => {
        picking = !picking;
        e.target.textContent = picking ? 'Picking... (click widget)' : 'Pick element';
        document.body.style.cursor = picking ? 'crosshair' : '';
    });
    document.addEventListener('mouseover', (e) => {
        if (!picking) return;
        if (hoverEl) hoverEl.style.outline = '';
        hoverEl = e.target;
        hoverEl.style.outline = '2px solid #38bdf8';
    });
    document.addEventListener('click', (e) => {
        if (!picking) return;
        e.preventDefault(); e.stopPropagation();
        const info = describe(e.target);
        if (info) { picked.push(info); renderPicked(); }
        picking = false;
        document.body.style.cursor = '';
        if (hoverEl) { hoverEl.style.outline = ''; hoverEl = null; }
        dbgPanel.querySelector('#dbgPick').textContent = 'Pick element';
    }, true);
    dbgPanel.querySelector('#dbgCopy').addEventListener('click', () => {
        const report = [
            'Mode: ' + cfg.name + ' (' + cfg.width + 'x' + cfg.height + ')',
            'URL: ' + location.href,
            'Theme: ' + (document.body.dataset.theme || 'dark'),
            'Body classes: ' + document.body.className,
            '',
            'Picked elements:',
            picked.length ? picked.map((p, i) => (i + 1) + '. ' + p.sel + ' | rect ' + p.rect + ' | ' + p.font + ' | color ' + p.color).join('\\n') : '(none)',
            '',
            'Notes:',
            notesEl.value || '(none)',
        ].join('\\n');
        navigator.clipboard.writeText(report).then(() => {
            dbgPanel.querySelector('#dbgCopy').textContent = 'Copied!';
            setTimeout(() => { dbgPanel.querySelector('#dbgCopy').textContent = 'Copy report'; }, 1500);
        }).catch(() => { notesEl.value = report; notesEl.select(); });
    });
    dbgPanel.querySelector('#dbgClear').addEventListener('click', () => {
        picked.length = 0; renderPicked(); notesEl.value = '';
    });

    // --- Layout editor: select/drag/resize elements, apply CSS overrides, export JSON ---
    var editOn = false, editSel = null, edits = {}, drag = null, handle = null;
    var LSKEY = 'gw-edit2-' + location.port;
    try { edits = JSON.parse(localStorage.getItem(LSKEY) || '{}'); } catch (e) { edits = {}; }

    function cssPath(el) {
        var parts = [];
        while (el && el !== document.body && el !== document.documentElement) {
            var p = el.parentElement;
            if (!p) break;
            var i = 1, sib = el.previousElementSibling;
            while (sib) { if (sib.tagName === el.tagName) i++; sib = sib.previousElementSibling; }
            var cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
            parts.unshift(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ':nth-of-type(' + i + ')');
            el = p;
        }
        return parts.join('>');
    }
    function entryFor(el) {
        var p = cssPath(el);
        if (!edits[p]) edits[p] = { css: '', tx: 0, ty: 0, w: 0, h: 0 };
        return { path: p, e: edits[p] };
    }
    function compose(e) {
        var cs = e.css || '';
        if (e.tx || e.ty) cs += ';transform:translate(' + e.tx + 'px,' + e.ty + 'px)';
        if (e.w) cs += ';width:' + e.w + 'px';
        if (e.h) cs += ';height:' + e.h + 'px';
        return cs.replace(/^;+/, '');
    }
    function applyEntry(el, ent) { el.style.cssText = compose(ent.e); }
    function applyAll() {
        for (var p in edits) {
            var el = document.querySelector(p);
            if (el) applyEntry(el, { path: p, e: edits[p] });
        }
    }
    function saveEdits() {
        try { localStorage.setItem(LSKEY, JSON.stringify(edits)); } catch (e) {}
        try {
            fetch('/__edits', { method: 'POST', body: JSON.stringify(edits) }).catch(() => {});
        } catch (e) {}
    }

    var eb = document.createElement('div');
    Object.assign(eb.style, {
        position: 'fixed', left: '12px', bottom: '12px', zIndex: '99999', width: '300px',
        background: '#171a21', border: '1px solid #3a3f4b', borderRadius: '10px',
        padding: '12px', color: '#e6e8ee', font: '12px sans-serif', display: 'none',
        boxShadow: '0 12px 32px rgba(0,0,0,.5)',
    });
    eb.innerHTML =
        '<div style="font-weight:600;margin-bottom:6px">Layout editor</div>' +
        '<div id="ebInfo" style="margin-bottom:6px;opacity:.75;word-break:break-all">No element selected. Click anything in the widget, then drag to move or pull the corner handle to resize.</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:6px">' +
        '<input id="ebW" type="number" placeholder="W" style="width:52px;background:#0f1116;color:#e6e8ee;border:1px solid #3a3f4b;border-radius:6px;padding:4px;font:12px sans-serif">' +
        '<input id="ebH" type="number" placeholder="H" style="width:52px;background:#0f1116;color:#e6e8ee;border:1px solid #3a3f4b;border-radius:6px;padding:4px;font:12px sans-serif">' +
        '<input id="ebDX" type="number" placeholder="dX" style="width:52px;background:#0f1116;color:#e6e8ee;border:1px solid #3a3f4b;border-radius:6px;padding:4px;font:12px sans-serif">' +
        '<input id="ebDY" type="number" placeholder="dY" style="width:52px;background:#0f1116;color:#e6e8ee;border:1px solid #3a3f4b;border-radius:6px;padding:4px;font:12px sans-serif">' +
        '</div>' +
        '<textarea id="ebCss" rows="5" placeholder="CSS overrides, e.g. grid-template-columns: 20px 10px 40px; padding-right: 8px;" ' +
        'style="width:100%;box-sizing:border-box;background:#0f1116;color:#e6e8ee;border:1px solid #3a3f4b;border-radius:6px;padding:6px;font:11px monospace;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
        '<button id="ebApply" style="flex:1">Apply CSS</button>' +
        '<button id="ebCopy" style="flex:1">Copy overrides</button>' +
        '<button id="ebReset" style="flex:1">Reset element</button>' +
        '<button id="ebDone" style="flex:1">Done</button></div>';
    document.body.appendChild(eb);

    var ebInfo = eb.querySelector('#ebInfo'), ebCss = eb.querySelector('#ebCss'),
        ebW = eb.querySelector('#ebW'), ebH = eb.querySelector('#ebH'),
        ebDX = eb.querySelector('#ebDX'), ebDY = eb.querySelector('#ebDY');

    function selectEl(el) {
        editSel = el;
        var ent = entryFor(el);
        var r = el.getBoundingClientRect();
        ebInfo.textContent = cssPath(el) + '  |  ' + Math.round(r.width) + 'x' + Math.round(r.height);
        ebCss.value = ent.e.css || '';
        ebW.value = ent.e.w || ''; ebH.value = ent.e.h || '';
        ebDX.value = ent.e.tx || ''; ebDY.value = ent.e.ty || '';
        positionHandle();
    }
    function positionHandle() {
        if (!handle) {
            handle = document.createElement('div');
            handle.id = 'ebHandle';
            Object.assign(handle.style, {
                position: 'fixed', width: '12px', height: '12px', zIndex: '99998',
                background: '#38bdf8', border: '2px solid #0b0d12', borderRadius: '3px',
                cursor: 'nwse-resize', display: 'none',
            });
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (!editSel) return;
                var ent = entryFor(editSel);
                var startX = e.clientX, startY = e.clientY;
                var sw = ent.e.w || editSel.getBoundingClientRect().width;
                var sh = ent.e.h || editSel.getBoundingClientRect().height;
                function mv(ev) {
                    ent.e.w = Math.max(8, Math.round(sw + ev.clientX - startX));
                    ent.e.h = Math.max(8, Math.round(sh + ev.clientY - startY));
                    applyEntry(editSel, ent); saveEdits(); positionHandle();
                    ebW.value = ent.e.w; ebH.value = ent.e.h;
                }
                function up() {
                    document.removeEventListener('mousemove', mv);
                    document.removeEventListener('mouseup', up);
                }
                document.addEventListener('mousemove', mv);
                document.addEventListener('mouseup', up);
            });
            document.body.appendChild(handle);
        }
        if (editOn && editSel) {
            var r = editSel.getBoundingClientRect();
            handle.style.display = 'block';
            handle.style.left = (r.right - 8) + 'px';
            handle.style.top = (r.bottom - 8) + 'px';
        } else handle.style.display = 'none';
    }
    setInterval(positionHandle, 400);

    dbgPanel.querySelector('#dbgPick').insertAdjacentHTML('afterend',
        '<button id="dbgEdit" style="margin-bottom:8px;margin-left:6px">Edit layout</button>');
    var dbgEditBtn = dbgPanel.querySelector('#dbgEdit');
    dbgEditBtn.addEventListener('click', () => {
        editOn = !editOn;
        dbgEditBtn.textContent = editOn ? 'Editing ON' : 'Edit layout';
        eb.style.display = editOn ? 'block' : 'none';
        document.body.style.cursor = editOn ? 'crosshair' : '';
        if (!editOn) { editSel = null; positionHandle(); }
    });

    document.addEventListener('mouseover', (e) => {
        if (!editOn || e.target === handle) return;
        if (hoverEl && hoverEl !== e.target) hoverEl.style.outline = '';
        hoverEl = e.target;
        if (hoverEl && hoverEl !== document.body) hoverEl.style.outline = '1px dashed #38bdf8';
    });
    document.addEventListener('mousedown', (e) => {
        if (!editOn || e.target === handle || eb.contains(e.target) || dbgPanel.contains(e.target)) return;
        if (e.target === document.body || e.target === document.documentElement) return;
        e.preventDefault(); e.stopPropagation();
        selectEl(e.target);
        drag = { el: e.target, x: e.clientX, y: e.clientY, ent: entryFor(e.target), moved: false };
    }, true);
    document.addEventListener('mousemove', (e) => {
        if (handle && e.target === handle) return;
        if (drag) {
            var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
            if (drag.moved) {
                drag.ent.e.tx = Math.round(dx); drag.ent.e.ty = Math.round(dy);
                applyEntry(drag.el, drag.ent);
                saveEdits(); positionHandle();
            }
        }
    });
    document.addEventListener('mouseup', () => {
        if (drag) { drag = null; }
        if (editSel) {
            var ent = entryFor(editSel);
            ebDX.value = ent.e.tx || ''; ebDY.value = ent.e.ty || '';
        }
    });
    function numericField(input, key) {
        input.addEventListener('change', () => {
            if (!editSel) return;
            var ent = entryFor(editSel);
            ent.e[key] = parseInt(input.value, 10) || 0;
            applyEntry(editSel, ent); saveEdits(); positionHandle();
        });
    }
    numericField(ebW, 'w'); numericField(ebH, 'h'); numericField(ebDX, 'tx'); numericField(ebDY, 'ty');

    eb.querySelector('#ebApply').addEventListener('click', () => {
        if (!editSel) return;
        var ent = entryFor(editSel);
        ent.e.css = ebCss.value;
        applyEntry(editSel, ent); saveEdits(); positionHandle();
    });
    eb.querySelector('#ebCopy').addEventListener('click', () => {
        var txt = JSON.stringify(edits, null, 1);
        navigator.clipboard.writeText(txt).then(() => {
            eb.querySelector('#ebCopy').textContent = 'Copied!';
            setTimeout(() => { eb.querySelector('#ebCopy').textContent = 'Copy overrides'; }, 1500);
        }).catch(() => { ebCss.value = txt; ebCss.select(); });
    });
    eb.querySelector('#ebReset').addEventListener('click', () => {
        if (!editSel) return;
        var p = cssPath(editSel);
        delete edits[p];
        editSel.style.cssText = '';
        saveEdits(); selectEl(editSel);
    });
    eb.querySelector('#ebDone').addEventListener('click', () => dbgEditBtn.click());

    var ebResetAll = document.createElement('button');
    ebResetAll.textContent = 'Reset all overrides';
    Object.assign(ebResetAll.style, { marginTop: '8px', width: '100%', background: '#3a1d22', color: '#ffb3ba', border: '1px solid #5a2b31', borderRadius: '6px', padding: '6px', cursor: 'pointer', font: '12px sans-serif' });
    ebResetAll.addEventListener('click', () => {
        edits = {};
        try { localStorage.removeItem(LSKEY); } catch (e) {}
        document.querySelectorAll('[style]').forEach((el) => { el.style.cssText = ''; });
        location.reload();
    });
    eb.appendChild(ebResetAll);

    applyAll();
    saveEdits(); // push existing localStorage overrides to the dev server once
})();
`;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'text/plain') {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
}

const EDITS_DIR = path.join(ROOT, '.edit-overrides');
try { fs.mkdirSync(EDITS_DIR, { recursive: true }); } catch (e) {}

function makeServer(cfg, port) {
    return http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        let pathname = decodeURIComponent(url.pathname);

        if (pathname === '/__edits' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
            req.on('end', () => {
                try {
                    fs.writeFileSync(path.join(EDITS_DIR, port + '.json'), body);
                    send(res, 200, 'ok');
                } catch (e) { send(res, 500, 'err'); }
            });
            return;
        }
        if (pathname === '/__edits') {
            const f = path.join(EDITS_DIR, port + '.json');
            return send(res, 200, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '{}', 'application/json');
        }

        if (pathname === '/dev-shim.js') {
            return send(res, 200, shimSource(cfg), 'text/javascript; charset=utf-8');
        }
        if (pathname === '/') pathname = '/index.html';
        if (pathname.startsWith('/assets/')) {
            const file = path.join(ASSETS, pathname.slice('/assets/'.length));
            if (file.startsWith(ASSETS) && fs.existsSync(file)) {
                return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
            }
            return send(res, 404, 'not found');
        }

        const file = path.join(SRC, pathname);
        if (!file.startsWith(SRC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            return send(res, 404, 'not found');
        }
        let body = fs.readFileSync(file);
        if (pathname === '/index.html') {
            const html = body.toString('utf8').replace(
                '<script src="renderer.js"></script>',
                '<script src="/dev-shim.js"></script>\n    <script src="renderer.js"></script>'
            );
            return send(res, 200, html, 'text/html; charset=utf-8');
        }
        send(res, 200, body, MIME[path.extname(file)] || 'application/octet-stream');
    });
}

for (const [port, cfg] of Object.entries(MODES)) {
    makeServer(cfg, port).listen(Number(port), () => {
        console.log(`http://localhost:${port}  ->  ${cfg.name}  (${cfg.width}x${cfg.height})`);
    });
}
