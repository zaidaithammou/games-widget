const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { spawn } = require('node:child_process');

let mainWindow;
let tray;
let isQuitting = false;
let compact = false;
let expandedBounds;
let dragTimer;
let saveBoundsTimer;
let dragOrigin;
const artworkLookupCache = new Map();
const settingsPath = () => path.join(app.getPath('userData'), 'widget-settings.json');
const libraryPath = () => path.join(app.getPath('userData'), 'games-library.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch { return {}; }
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const settings = readSettings();
  const bounds = mainWindow.getBounds();
  settings.bounds = compact && settings.bounds
    ? { ...settings.bounds, x: bounds.x, y: bounds.y }
    : bounds;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch (error) { console.error('Could not save widget position:', error); }
}

function queueSaveWindowBounds() {
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(saveWindowBounds, 250);
}

function getInitialBounds() {
  const saved = readSettings().bounds;
  const fallback = { width: 400, height: 600, x: 100, y: 100 };
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return fallback;
  const display = screen.getDisplayMatching(saved);
  const area = display.workArea;
  const width = Math.max(320, Math.min(Number(saved.width) || fallback.width, area.width));
  const height = Math.max(360, Math.min(Number(saved.height) || fallback.height, area.height));
  return {
    width, height,
    x: Math.max(area.x, Math.min(saved.x, area.x + area.width - Math.min(width, 320))),
    y: Math.max(area.y, Math.min(saved.y, area.y + area.height - Math.min(height, 360)))
  };
}

function setCompactMode(nextCompact) {
  if (!mainWindow || mainWindow.isDestroyed() || compact === nextCompact) return;
  if (nextCompact) {
    saveWindowBounds();
    expandedBounds = mainWindow.getBounds();
    compact = true;
    mainWindow.setMinimumSize(56, 56);
    mainWindow.setSize(56, 56, true);
  } else {
    compact = false;
    mainWindow.setMinimumSize(320, 360);
    const bounds = expandedBounds || readSettings().bounds || { width: 400, height: 600 };
    mainWindow.setSize(Math.max(320, bounds.width), Math.max(360, bounds.height), true);
  }
  mainWindow.webContents.send('widget:compact-state', compact);
}

function beginDrag() {
  if (!mainWindow || dragTimer) return;
  const [x, y] = mainWindow.getPosition();
  const cursor = screen.getCursorScreenPoint();
  dragOrigin = { x, y, cursorX: cursor.x, cursorY: cursor.y };
  dragTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !dragOrigin) return;
    const cursorNow = screen.getCursorScreenPoint();
    mainWindow.setPosition(
      dragOrigin.x + cursorNow.x - dragOrigin.cursorX,
      dragOrigin.y + cursorNow.y - dragOrigin.cursorY,
      false
    );
  }, 16);
}

function endDrag() {
  clearInterval(dragTimer);
  dragTimer = null;
  dragOrigin = null;
  saveWindowBounds();
}

function runRegistryQuery(key) {
  try {
    return execFileSync('reg.exe', ['query', key, '/s'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  } catch { return ''; }
}

function steamRoots() {
  const roots = new Set();
  const registry = runRegistryQuery('HKCU\\Software\\Valve\\Steam');
  const match = registry.match(/SteamPath\s+REG_SZ\s+(.+)/i);
  if (match) roots.add(match[1].trim().replace(/\//g, path.sep));
  for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]) {
    if (base) roots.add(path.join(base, 'Steam'));
  }
  const result = new Set();
  for (const root of roots) {
    if (fs.existsSync(path.join(root, 'steamapps'))) result.add(path.resolve(root));
    const libraryFile = path.join(root, 'steamapps', 'libraryfolders.vdf');
    try {
      const text = fs.readFileSync(libraryFile, 'utf8');
      for (const [, library] of text.matchAll(/"path"\s+"([^"]+)"/gi)) {
        const normalized = library.replace(/\\\\/g, path.sep).replace(/\\/g, path.sep);
        if (fs.existsSync(path.join(normalized, 'steamapps'))) result.add(path.resolve(normalized));
      }
    } catch { /* Steam library file may not exist */ }
  }
  return result;
}

function findGameExecutable(installPath, gameName) {
  if (!installPath || !fs.existsSync(installPath)) return null;
  const excluded = /^(unins|uninstall|setup|launcher|crashreporter|unitycrashhandler|vc_redist)/i;
  const normalizedName = String(gameName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = [];
  const queue = [{ dir: installPath, depth: 0 }];
  let inspected = 0;
  while (queue.length && inspected < 1800) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (++inspected > 1800) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe') && !excluded.test(entry.name)) candidates.push(fullPath);
      else if (entry.isDirectory() && depth < 3 && !/^(redist|redistributables|support|crash|easyanticheat|battleye|prerequisites|__installer)$/i.test(entry.name)) queue.push({ dir: fullPath, depth: depth + 1 });
    }
  }
  if (!candidates.length) return null;
  const score = (file) => {
    const base = path.basename(file, '.exe').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (base === normalizedName ? 0 : base.includes(normalizedName) || normalizedName.includes(base) ? 1 : 2) * 10 + file.split(path.sep).length;
  };
  candidates.sort((a, b) => score(a) - score(b));
  return candidates[0];
}

function scanSteam() {
  const games = [];
  for (const root of steamRoots()) {
    const appsDir = path.join(root, 'steamapps');
    let files = [];
    try { files = fs.readdirSync(appsDir); } catch { continue; }
    for (const file of files) {
      const manifest = file.match(/^appmanifest_(\d+)\.acf$/i);
      if (!manifest) continue;
      try {
        const acf = fs.readFileSync(path.join(appsDir, file), 'utf8');
        const name = acf.match(/"name"\s+"([^"]+)"/i)?.[1];
        const installDir = acf.match(/"installdir"\s+"([^"]+)"/i)?.[1];
        const stateFlags = Number(acf.match(/"StateFlags"\s+"(\d+)"/i)?.[1] || 0);
        if (!name || !(stateFlags & 4) || !installDir || !fs.existsSync(path.join(appsDir, 'common', installDir))) continue;
        const installPath = path.join(appsDir, 'common', installDir);
        games.push({ id: `steam-${manifest[1]}`, steamAppId: manifest[1], name, category: 'Steam', platform: 'Steam', installPath, executablePath: findGameExecutable(installPath, name) });
      } catch { /* Ignore incomplete or unreadable manifests */ }
    }
  }
  return games;
}

function scanEpic() {
  const manifestsDir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files = [];
  try { files = fs.readdirSync(manifestsDir); } catch { return []; }
  const games = [];
  for (const file of files.filter((entry) => entry.endsWith('.item'))) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(manifestsDir, file), 'utf8'));
      if (manifest.bIsIncomplete || manifest.bIsIncompleteInstall || !manifest.bIsApplication || !manifest.DisplayName || !manifest.InstallLocation) continue;
      if (!fs.existsSync(manifest.InstallLocation)) continue;
      const executablePath = manifest.LaunchExecutable ? path.resolve(manifest.InstallLocation, manifest.LaunchExecutable) : findGameExecutable(manifest.InstallLocation, manifest.DisplayName);
      games.push({ id: `epic-${manifest.InstallationGuid || manifest.AppName}`, name: manifest.DisplayName, category: 'Epic', platform: 'Epic Games', installPath: manifest.InstallLocation, executablePath: executablePath && fs.existsSync(executablePath) ? executablePath : findGameExecutable(manifest.InstallLocation, manifest.DisplayName), epicAppName: manifest.AppName || null });
    } catch { /* Ignore invalid or partial Epic manifests */ }
  }
  return games;
}

function scanGog() {
  const keys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games',
    'HKLM\\SOFTWARE\\GOG.com\\Games',
    'HKCU\\SOFTWARE\\GOG.com\\Games'
  ];
  const games = [];
  const seen = new Set();
  for (const key of keys) {
    const output = runRegistryQuery(key);
    const subkeys = output.split(/\r?\n(?=HKEY_)/i).filter((block) => /^HKEY_/i.test(block.trim()));
    for (const block of subkeys) {
      const name = block.match(/gameName\s+REG_SZ\s+(.+)/i)?.[1]?.trim();
      const installPath = block.match(/(?:^|\n)\s*path\s+REG_SZ\s+(.+)/i)?.[1]?.trim();
      if (!name || !installPath || !fs.existsSync(installPath)) continue;
      const id = `gog-${path.basename(block.match(/^HKEY_[^\\]+\\(.+)/i)?.[1] || installPath)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const exeValue = block.match(/(?:^|\n)\s*exe\s+REG_SZ\s+(.+)/i)?.[1]?.trim();
      const executablePath = exeValue ? path.resolve(installPath, exeValue) : findGameExecutable(installPath, name);
      games.push({ id, name, category: 'GOG', platform: 'GOG', installPath, executablePath: executablePath && fs.existsSync(executablePath) ? executablePath : findGameExecutable(installPath, name) });
    }
  }
  return games;
}

function discoverInstalledGames(platforms = {}) {
  if (process.platform !== 'win32') throw new Error('Installed game scanning is currently supported on Windows only.');
  const results = [];
  if (platforms.steam) results.push(...scanSteam());
  if (platforms.epic) results.push(...scanEpic());
  if (platforms.gog) results.push(...scanGog());
  return [...new Map(results.map((game) => [`${game.platform}:${game.id}`, game])).values()];
}

async function steamRequest(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'GamesWidget/1.0' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Steam returned HTTP ${response.status}`);
  return response.json();
}

async function findSteamArtwork(query, knownAppId) {
  const term = String(query || '').trim().slice(0, 100);
  if (knownAppId && /^\d+$/.test(String(knownAppId))) {
    try {
      const details = await steamRequest(`https://store.steampowered.com/api/appdetails?appids=${knownAppId}&l=english`);
      const item = details[knownAppId]?.data;
      if (item?.header_image) return {
        appid: Number(knownAppId), name: item.name || term, image: item.header_image, landscapeImage: item.header_image,
        iconImage: item.small_capsule_image || item.capsule_imagev5 || item.capsule_image || item.header_image
      };
    } catch { /* The CDN image URL is still known from the installed app ID. */ }
    return {
      appid: Number(knownAppId), name: term,
      image: `https://cdn.akamai.steamstatic.com/steam/apps/${knownAppId}/header.jpg`,
      landscapeImage: `https://cdn.akamai.steamstatic.com/steam/apps/${knownAppId}/header.jpg`,
      iconImage: `https://cdn.akamai.steamstatic.com/steam/apps/${knownAppId}/capsule_184x69.jpg`
    };
  }
  if (term.length < 2) return null;
  const searchUrl = new URL('https://store.steampowered.com/api/storesearch/');
  searchUrl.searchParams.set('term', term);
  searchUrl.searchParams.set('l', 'english');
  searchUrl.searchParams.set('cc', 'us');
  const data = await steamRequest(searchUrl);
  const items = (data.items || []).slice(0, 8);
  const normalized = term.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const exact = items.find((item) => item.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalized);
  const item = exact;
  if (!item) return null;
  try {
    const details = await steamRequest(`https://store.steampowered.com/api/appdetails?appids=${item.id}&l=english`);
    const game = details[item.id]?.data;
    const image = game?.header_image || item.tiny_image;
    if (image) return {
      appid: item.id, name: item.name, image, landscapeImage: image,
      iconImage: game?.small_capsule_image || game?.capsule_imagev5 || item.tiny_image || image
    };
  } catch { /* Steam search result still contains a small capsule image */ }
  return item.tiny_image ? { appid: item.id, name: item.name, image: item.tiny_image, iconImage: item.tiny_image } : null;
}

async function findEpicArtwork(query) {
  const term = String(query || '').trim().slice(0, 100);
  if (term.length < 2) return null;
  const queryText = `query SearchStore($keywords: String, $count: Int, $country: String!, $locale: String) {
    Catalog { searchStore(keywords: $keywords, count: $count, country: $country, locale: $locale) {
      elements { title keyImages { type url } }
    } }
  }`;
  const response = await fetch('https://store.epicgames.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://store.epicgames.com',
      'Referer': 'https://store.epicgames.com/en-US/browse',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      query: queryText,
      variables: { keywords: term, count: 8, country: 'US', locale: 'en-US' }
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Epic Store returned HTTP ${response.status}`);
  const data = await response.json();
  const normalizedTerm = term.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const result = (data.data?.Catalog?.searchStore?.elements || []).find((item) =>
    item.title?.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalizedTerm
  );
  if (!result) return null;
  const images = result.keyImages || [];
  const landscapeImage = ['OfferImageWide', 'DieselStoreFrontWide'].map((type) => images.find((candidate) => candidate.type === type)?.url).find(Boolean);
  const iconImage = ['Thumbnail', 'DieselGameBoxTall', 'OfferImageTall', 'DieselStoreFrontTall', 'OfferImageWide', 'DieselStoreFrontWide'].map((type) => images.find((candidate) => candidate.type === type)?.url).find(Boolean);
  const image = landscapeImage || iconImage || images.find((candidate) => candidate.url)?.url;
  return image ? { name: result.title, image, landscapeImage: landscapeImage || null, iconImage: iconImage || image, source: 'Epic Games Store' } : null;
}

function collectEpicImages(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectEpicImages(item, output);
  } else if (value && typeof value === 'object') {
    if (typeof value.url === 'string' && /^https:\/\//i.test(value.url)) {
      output.push({ type: String(value.type || value.typeKey || ''), url: value.url });
    }
    for (const [key, child] of Object.entries(value)) {
      if (/image|asset|media|item/i.test(key)) collectEpicImages(child, output);
    }
  }
  return output;
}

function chooseEpicImages(images) {
  const landscapeImage = ['OfferImageWide', 'DieselStoreFrontWide'].map((type) => images.find((entry) => entry.type === type)?.url).find(Boolean);
  const iconImage = ['Thumbnail', 'DieselGameBoxTall', 'OfferImageTall', 'DieselStoreFrontTall', 'OfferImageWide', 'DieselStoreFrontWide'].map((type) => images.find((entry) => entry.type === type)?.url).find(Boolean);
  const image = landscapeImage || iconImage || images[0]?.url;
  return image ? { image, landscapeImage: landscapeImage || null, iconImage: iconImage || image } : null;
}

async function findEgdataArtwork(query) {
  const term = String(query || '').trim().slice(0, 100);
  if (term.length < 2) return null;
  const searchUrl = new URL('https://api.egdata.app/search/v2/search');
  searchUrl.searchParams.set('country', 'US');
  searchUrl.searchParams.set('locale', 'en-US');
  const searchResponse = await fetch(searchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ title: term, offerType: 'BASE_GAME', page: 1, limit: 8 }),
    signal: AbortSignal.timeout(10000)
  });
  if (!searchResponse.ok) throw new Error(`EGDATA search returned HTTP ${searchResponse.status}`);
  const searchData = await searchResponse.json();
  const normalize = (text) => String(text || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const offer = (searchData.offers || []).find((entry) => normalize(entry.title) === normalize(term));
  if (!offer?.id) return null;

  let details = offer;
  try {
    const detailResponse = await fetch(`https://api.egdata.app/offers/${encodeURIComponent(offer.id)}?locale=en-US`, { signal: AbortSignal.timeout(10000) });
    if (detailResponse.ok) details = await detailResponse.json();
  } catch { /* The search result may already contain the image metadata. */ }
  let images = collectEpicImages(details);

  if (!images.length) {
    try {
      const itemsResponse = await fetch(`https://api.egdata.app/offers/${encodeURIComponent(offer.id)}/items`, { signal: AbortSignal.timeout(10000) });
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        const itemIds = (Array.isArray(itemsData) ? itemsData : itemsData.items || itemsData.data?.items || []).map((item) => typeof item === 'string' ? item : item.id).filter(Boolean).slice(0, 3);
        const itemDetails = await Promise.all(itemIds.map(async (id) => {
          try {
            const itemResponse = await fetch(`https://api.egdata.app/items/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10000) });
            return itemResponse.ok ? itemResponse.json() : null;
          } catch { return null; }
        }));
        for (const item of itemDetails) images.push(...collectEpicImages(item));
      }
    } catch { /* Continue to the documented preview image fallback. */ }
  }

  const selected = chooseEpicImages(images);
  if (selected) {
    const isFortnite = String(offer.title).toLocaleLowerCase() === 'fortnite';
    const fortniteLandscape = 'https://cdn1.epicgames.com/offer/fn/FNBR_42-30_Fortnitemares_KeyArt_Fortnitemares_EGS_Launcher_Blade_2560x1440_2560x1440-75958091d6bd48dc847c3b17abedd28a?quality=high&resize=1&w=720';
    if (isFortnite && !selected.landscapeImage) selected.image = selected.landscapeImage = fortniteLandscape;
    return { name: offer.title, ...selected, source: 'EGDATA' };
  }
  return {
    name: offer.title,
    image: `https://api.egdata.app/offers/${encodeURIComponent(offer.id)}/og.webp?country=US`,
    landscapeImage: `https://api.egdata.app/offers/${encodeURIComponent(offer.id)}/og.webp?country=US`,
    source: 'EGDATA'
  };
}

async function findEpicArtworkWithFallback(query) {
  try {
    const artwork = await findEgdataArtwork(query);
    if (artwork) return artwork;
  } catch (error) {
    console.warn(`EGDATA artwork lookup failed for ${query}:`, error.message);
  }
  try {
    return await findEpicArtwork(query);
  } catch (error) {
    console.warn(`Epic Store artwork lookup failed for ${query}:`, error.message);
    return null;
  }
}

async function findArtwork(query, knownAppId) {
  try {
    const steam = await findSteamArtwork(query, knownAppId);
    if (steam) return { ...steam, source: 'Steam' };
  } catch (error) {
    console.warn(`Steam artwork lookup failed for ${query}:`, error.message);
  }
  const epic = await findEpicArtworkWithFallback(query);
  if (epic) return epic;
  if (String(query || '').trim().toLocaleLowerCase() === 'fortnite') {
    const image = 'https://cdn1.epicgames.com/offer/fn/FNBR_42-30_Fortnitemares_KeyArt_Fortnitemares_EGS_Launcher_Blade_2560x1440_2560x1440-75958091d6bd48dc847c3b17abedd28a?quality=high&resize=1&w=720';
    return { name: 'Fortnite', image, landscapeImage: image, iconImage: 'https://api.egdata.app/offers/027c646e4b0445e28f9d9abd0326ba36/og.webp?country=US', source: 'EGDATA' };
  }
  return null;
}

function cachedArtwork(key, lookup) {
  if (!artworkLookupCache.has(key)) {
    const pending = lookup().catch((error) => {
      artworkLookupCache.delete(key);
      throw error;
    });
    artworkLookupCache.set(key, pending);
  }
  return artworkLookupCache.get(key);
}

function lookupArtwork(query, appId) {
  const term = String(query || '').trim().toLocaleLowerCase();
  return cachedArtwork(`primary:${appId || ''}:${term}`, () => findArtwork(query, appId));
}

function lookupBackupArtwork(query) {
  const term = String(query || '').trim().toLocaleLowerCase();
  return cachedArtwork(`backup:${term}`, async () => {
    const result = await findEpicArtworkWithFallback(query);
    if (result) return result;
    if (term === 'fortnite') {
      return {
        name: 'Fortnite', source: 'EGDATA',
        image: 'https://cdn1.epicgames.com/offer/fn/FNBR_42-30_Fortnitemares_KeyArt_Fortnitemares_EGS_Launcher_Blade_2560x1440_2560x1440-75958091d6bd48dc847c3b17abedd28a?quality=high&resize=1&w=720',
        landscapeImage: 'https://cdn1.epicgames.com/offer/fn/FNBR_42-30_Fortnitemares_KeyArt_Fortnitemares_EGS_Launcher_Blade_2560x1440_2560x1440-75958091d6bd48dc847c3b17abedd28a?quality=high&resize=1&w=720',
        iconImage: 'https://api.egdata.app/offers/027c646e4b0445e28f9d9abd0326ba36/og.webp?country=US'
      };
    }
    return null;
  });
}

function createWindow() {
  expandedBounds = getInitialBounds();
  mainWindow = new BrowserWindow({
    ...expandedBounds,
    minWidth: 320,
    minHeight: 360,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('move', queueSaveWindowBounds);
  mainWindow.on('resize', queueSaveWindowBounds);
  mainWindow.on('close', (event) => {
    if (!isQuitting) { event.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function showWidget() {
  if (!mainWindow) createWindow();
  if (compact) setCompactMode(false);
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  if (!fs.existsSync(iconPath)) return;
  try { tray = new Tray(iconPath); }
  catch (error) {
    console.error('Could not create the Games Widget tray icon:', error);
    return;
  }
  tray.setToolTip('Games Widget');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Expand Games Widget', click: showWidget },
    { label: 'Hide Widget', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Settings', click: () => { showWidget(); mainWindow.webContents.send('open-settings'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', showWidget);
}

app.whenReady().then(() => {
  ipcMain.on('widget:minimize', () => setCompactMode(!compact));
  ipcMain.on('widget:close', () => mainWindow?.hide());
  ipcMain.on('widget:drag-start', beginDrag);
  ipcMain.on('widget:drag-end', endDrag);
  ipcMain.handle('games:scan', (_event, platforms) => discoverInstalledGames(platforms));
  ipcMain.handle('games:artwork', (_event, query, appId) => lookupArtwork(query, appId));
  ipcMain.handle('games:load', () => {
    try {
      const loaded = JSON.parse(fs.readFileSync(libraryPath(), 'utf8'));
      return Array.isArray(loaded) ? loaded : null;
    } catch { return null; }
  });
  ipcMain.on('games:save', (_event, library) => {
    if (!Array.isArray(library)) return;
    try {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      fs.writeFileSync(libraryPath(), JSON.stringify(library), 'utf8');
    } catch (error) { console.error('Could not save the game library:', error); }
  });
  ipcMain.handle('games:launch', async (_event, game) => {
    if (!game || typeof game !== 'object') return { ok: false, error: 'Invalid game entry.' };
    try {
      if (game.platform === 'Steam' && /^\d+$/.test(String(game.steamAppId || ''))) {
        await shell.openExternal(`steam://run/${game.steamAppId}`);
        return { ok: true };
      }
      if (game.platform === 'Epic Games' && /^[\w.-]+$/.test(String(game.epicAppName || ''))) {
        await shell.openExternal(`com.epicgames.launcher://apps/${encodeURIComponent(game.epicAppName)}?action=launch&silent=true`);
        return { ok: true };
      }
      const root = typeof game.installPath === 'string' ? path.resolve(game.installPath) : '';
      let executablePath = typeof game.executablePath === 'string' ? path.resolve(game.executablePath) : '';
      const relative = root && executablePath ? path.relative(root, executablePath) : '';
      if (!executablePath || !root || !relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(executablePath)) {
        executablePath = root ? findGameExecutable(root, game.name) : null;
      }
      if (!executablePath || !fs.existsSync(executablePath)) return { ok: false, error: `Could not find the game executable for ${game.name}.` };
      const child = spawn(executablePath, [], { cwd: path.dirname(executablePath), detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message || 'Could not start the game.' }; }
  });
  ipcMain.handle('games:executable-icon', async (_event, executablePath, installPath, gameName) => {
    if (process.platform !== 'win32') return null;
    if (typeof executablePath !== 'string' || path.extname(executablePath).toLowerCase() !== '.exe' || !path.isAbsolute(executablePath) || !fs.existsSync(executablePath)) {
      executablePath = typeof installPath === 'string' && path.isAbsolute(installPath) ? findGameExecutable(installPath, gameName) : null;
    }
    if (!executablePath || !fs.existsSync(executablePath)) return null;
    try {
      const icon = await app.getFileIcon(executablePath, { size: 'normal' });
      return icon.isEmpty() ? null : { executablePath, image: icon.resize({ width: 128, height: 128 }).toDataURL() };
    } catch { return null; }
  });
  ipcMain.handle('games:backup-artwork', (_event, query) => lookupBackupArtwork(query));
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Alt+G', () => mainWindow?.isVisible() ? mainWindow.hide() : showWidget());
  app.on('activate', showWidget);
});

app.on('before-quit', () => { isQuitting = true; endDrag(); globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { /* Keep the tray resident until the user selects Quit. */ });
