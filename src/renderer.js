// Game Library State
let games = [];
let coverArtStyle = 'icons';
let sortBy = 'name';
let userGroups = [];
let expandedGameGroups = new Set();
let editingGame = null;
let pendingGameWallpaper = null;

// DOM Elements
const gamesGrid = document.getElementById('gamesGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const coverArtToggle = document.getElementById('coverArtToggle');
const coverArtToggleIcon = document.getElementById('coverArtToggleIcon');
const COVER_ICONS = {
    icons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    disks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>'
};
const settingsBtn = document.getElementById('settingsBtn');
const scanGamesBtn = document.getElementById('scanGamesBtn');
const settingsPanel = document.getElementById('settingsPanel');
const editGamePanel = document.getElementById('editGamePanel');
const scannerPanel = document.getElementById('scannerPanel');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const compactRestoreBtn = document.getElementById('compactRestoreBtn');
const performanceBtn = document.getElementById('performanceBtn');
const performancePanel = document.getElementById('performancePanel');
const performanceLayoutBtn = document.getElementById('performanceLayoutBtn');
const LAUNCHER_GROUPS = ['Steam', 'Epic Games', 'GOG', 'Xbox', 'Battle.net', 'Ubisoft Connect', 'EA App', 'Manual'];
const LAUNCH_FIELDS = ['epicAppName', 'epicCatalogNamespace', 'epicCatalogItemId', 'xboxPackageFamilyName', 'xboxAppId', 'ubisoftId', 'battleNetProductCode'];

// Initialize
async function init() {
    applyTheme(localStorage.getItem('widgetTheme') || 'dark');
    setupAccordion();
    setupThemeSwitcher();
    await loadSettings();
    await loadGames();
    setupEventListeners();
    renderGames();
    fetchMissingArtwork();
    fetchExecutableIcons();
}

async function fetchExecutableIcons() {
    let changed = false;
    await Promise.all(games.filter((game) => game.executablePath || game.installPath).map(async (game) => {
        try {
            const result = await window.gamesWidget.getExecutableIcon(game.executablePath, game.installPath, game.name);
            if (result?.image) {
                if (game.executablePath !== result.executablePath || game.appIconImage !== result.image) {
                    game.executablePath = result.executablePath;
                    game.appIconImage = result.image;
                    changed = true;
                }
            }
        } catch (error) {
            console.warn(`Could not load the executable icon for ${game.name}:`, error);
        }
    }));
    if (changed) saveGames();
    renderGames();
}

// Load Settings
async function loadSettings() {
    const savedStyle = localStorage.getItem('coverArtStyle');
    if (savedStyle) {
        coverArtStyle = savedStyle === 'disks' ? 'disks' : 'icons';
        updateCoverArtToggle();
    }

    const savedPlatforms = localStorage.getItem('platformSettings');
    if (savedPlatforms) {
        try {
            const platforms = JSON.parse(savedPlatforms);
            if (platforms.steamEnabled !== undefined) document.getElementById('steamEnabled').checked = platforms.steamEnabled;
            if (platforms.epicEnabled !== undefined) document.getElementById('epicEnabled').checked = platforms.epicEnabled;
            if (platforms.gogEnabled !== undefined) document.getElementById('gogEnabled').checked = platforms.gogEnabled;
            if (platforms.xboxEnabled !== undefined) document.getElementById('xboxEnabled').checked = platforms.xboxEnabled;
            if (platforms.battlenetEnabled !== undefined) document.getElementById('battlenetEnabled').checked = platforms.battlenetEnabled;
            if (platforms.ubisoftEnabled !== undefined) document.getElementById('ubisoftEnabled').checked = platforms.ubisoftEnabled;
            if (platforms.eaEnabled !== undefined) document.getElementById('eaEnabled').checked = platforms.eaEnabled;
        } catch (error) {
            console.warn('Could not load platform settings:', error);
        }
    }

    const savedSort = localStorage.getItem('sortBy');
    if (savedSort) {
        sortBy = savedSort;
        sortSelect.value = savedSort;
    }

    let savedGroups = null;
    try { savedGroups = await window.gamesWidget.loadUserGroups(); } catch (error) {
        console.warn('Could not load saved user groups:', error);
    }
    if (!Array.isArray(savedGroups)) {
        try { savedGroups = JSON.parse(localStorage.getItem('userGroups') || '[]'); }
        catch { savedGroups = []; }
    }
    userGroups = [...new Set(savedGroups.filter((group) => typeof group === 'string' && group.trim()))];
    saveUserGroups();

    try {
        const expanded = JSON.parse(localStorage.getItem('expandedGameGroups') || '[]');
        expandedGameGroups = new Set(Array.isArray(expanded) ? expanded : []);
    } catch { expandedGameGroups = new Set(); }
}

// Load Games
async function loadGames() {
    let storedGames = null;
    try { storedGames = await window.gamesWidget.loadGames(); } catch (error) {
        console.warn('Could not load the saved game library file:', error);
    }
    if (!Array.isArray(storedGames)) {
        try { storedGames = JSON.parse(localStorage.getItem('games') || '[]'); }
        catch (error) {
            console.warn('Could not load the saved game list:', error);
            storedGames = [];
        }
    }
    const unique = new Map();
    for (const game of storedGames) {
        if (typeof game.iconImage === 'string' && game.iconImage.startsWith('data:image/')) {
            game.appIconImage = game.appIconImage || game.iconImage;
            game.iconImage = null;
            game.artworkChecked = false;
        }
        const identity = game.steamAppId
            ? `${game.platform}:appid:${game.steamAppId}`
            : `${game.platform}:${game.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
        if (!unique.has(identity)) unique.set(identity, game);
    }
    games = [...unique.values()];
    saveGames();
}

async function syncSteamLastPlayed() {}

async function fetchMissingArtwork() {
    const withoutArtwork = games.filter((game) => !game.artworkChecked || !game.iconImage);
    if (!withoutArtwork.length) return;
    let changed = false;
    await Promise.all(withoutArtwork.map(async (game) => {
        try {
            const artwork = await window.gamesWidget.findArtwork(game.name, game.steamAppId);
            if (artwork?.image) {
                if (artwork.landscapeImage) {
                    game.coverImage = artwork.landscapeImage;
                    game.landscapeImage = artwork.landscapeImage;
                } else {
                    game.coverImage = game.coverImage || artwork.image;
                }
                game.iconImage = artwork.iconImage || artwork.image || game.iconImage;
                game.steamAppId = game.steamAppId || artwork.appid;
                game.artworkSource = artwork.source || game.artworkSource;
                changed = true;
            }
            if (!game.artworkChecked) {
                game.artworkChecked = true;
                changed = true;
            }
        } catch (error) {
            console.warn(`Artwork lookup failed for ${game.name}:`, error);
        }
    }));
    if (changed) {
        saveGames();
        renderGames();
    }
}

// Save Games
function saveGames() {
    localStorage.setItem('games', JSON.stringify(games));
    window.gamesWidget.saveGames(games);
}

// Theme switching
const THEMES = ['dark', 'light', 'cyber', 'nord', 'emerald'];

function applyTheme(theme) {
    const next = THEMES.includes(theme) ? theme : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('widgetTheme', next);
    document.querySelectorAll('.theme-option').forEach((option) => {
        option.classList.toggle('is-active', option.dataset.theme === next);
    });
}

function setupThemeSwitcher() {
    document.querySelectorAll('.theme-option').forEach((option) => {
        option.addEventListener('click', () => applyTheme(option.dataset.theme));
    });
}

// Settings accordion (exclusive open)
function setupAccordion() {
    document.querySelectorAll('.accordion-header').forEach((header) => {
        header.addEventListener('click', () => {
            const item = header.closest('.accordion-item');
            const isOpen = item.classList.contains('is-open');
            closeAllAccordionItems();
            if (!isOpen) {
                item.classList.add('is-open');
                header.setAttribute('aria-expanded', 'true');
                localStorage.setItem('openSettingsSection', item.dataset.section || '');
            } else {
                localStorage.removeItem('openSettingsSection');
            }
        });
    });
}

function closeAllAccordionItems() {
    document.querySelectorAll('.accordion-item.is-open').forEach((item) => {
        item.classList.remove('is-open');
        const header = item.querySelector('.accordion-header');
        if (header) header.setAttribute('aria-expanded', 'false');
    });
}

function restoreOpenAccordionSection() {
    closeAllAccordionItems();
    const section = localStorage.getItem('openSettingsSection');
    if (!section) return;
    const item = document.querySelector(`.accordion-item[data-section="${section}"]`);
    if (!item) return;
    item.classList.add('is-open');
    const header = item.querySelector('.accordion-header');
    if (header) header.setAttribute('aria-expanded', 'true');
}

// Setup Event Listeners
function setupEventListeners() {
    minimizeBtn.addEventListener('click', () => window.gamesWidget.minimize());
    closeBtn.addEventListener('click', () => window.gamesWidget.close());
    performanceBtn.addEventListener('click', () => window.gamesWidget.togglePerformanceMode());
    document.getElementById('performanceExitBtn').addEventListener('click', () => window.gamesWidget.togglePerformanceMode());
    document.getElementById('performanceMinBtn').addEventListener('click', () => window.gamesWidget.minimize());
    performanceLayoutBtn.addEventListener('click', () => {
        setPerformanceOrientation(performanceOrientation === 'vertical' ? 'horizontal' : 'vertical');
    });
    window.gamesWidget.onWindowMode((mode) => {
        const performance = mode === 'performance';
        if (performance && !document.body.classList.contains('performance')) resetPerformancePanel();
        document.body.classList.toggle('performance', performance);
    });
    window.gamesWidget.onPerformanceSample(updatePerformancePanel);
    window.gamesWidget.onRtssStatus(updateRtssStatus);

    let suppressCompactClick = false;
    function makeDraggable(handle, canStart) {
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let moved = false;
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || !canStart(event)) return;
            pointerId = event.pointerId;
            startX = event.screenX;
            startY = event.screenY;
            moved = false;
            handle.setPointerCapture(pointerId);
            window.gamesWidget.beginDrag();
        });
        handle.addEventListener('pointermove', (event) => {
            if (event.pointerId === pointerId && (Math.abs(event.screenX - startX) > 4 || Math.abs(event.screenY - startY) > 4)) moved = true;
        });
        const finishDrag = (event) => {
            if (event.pointerId !== pointerId) return;
            pointerId = null;
            window.gamesWidget.endDrag();
            if (handle === compactRestoreBtn && moved) {
                suppressCompactClick = true;
                setTimeout(() => { suppressCompactClick = false; }, 0);
            }
        };
        handle.addEventListener('pointerup', finishDrag);
        handle.addEventListener('pointercancel', finishDrag);
    }
    const canDragTopBar = (event) => !event.target.closest('button, input, select, a');
    makeDraggable(document.querySelector('.window-controls'), canDragTopBar);
    makeDraggable(document.querySelector('.widget-header'), canDragTopBar);
    makeDraggable(compactRestoreBtn, () => true);
    makeDraggable(performancePanel, canDragTopBar);
    compactRestoreBtn.addEventListener('click', (event) => {
        if (suppressCompactClick) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        window.gamesWidget.minimize();
    });
    window.gamesWidget.onCompactState((compact) => {
        document.body.classList.toggle('compact', compact);
        minimizeBtn.textContent = compact ? '＋' : '−';
        minimizeBtn.title = compact ? 'Expand widget' : 'Compact widget';
        minimizeBtn.setAttribute('aria-label', minimizeBtn.title);
    });

    // Search
    searchInput.addEventListener('input', () => {
        renderGames();
    });

    // Sort
    sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        localStorage.setItem('sortBy', sortBy);
        renderGames();
    });

    // Cover Art Style
    coverArtToggle.addEventListener('click', () => {
        coverArtToggle.classList.add('is-swapping');
        setTimeout(() => coverArtToggle.classList.remove('is-swapping'), 260);
        coverArtStyle = coverArtStyle === 'icons' ? 'disks' : 'icons';
        localStorage.setItem('coverArtStyle', coverArtStyle);
        updateCoverArtToggle();
        updateCoverArtSettings();
        renderGames();
    });

    // Settings
    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'flex';
        loadSettingsUI();
        restoreOpenAccordionSection();
    });

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
        settingsPanel.style.display = 'none';
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        saveSettingsFromUI();
        settingsPanel.style.display = 'none';
    });

    // Game Scanner
    scanGamesBtn.addEventListener('click', () => {
        scannerPanel.style.display = 'flex';
    });

    document.getElementById('cancelScanBtn').addEventListener('click', () => {
        scannerPanel.style.display = 'none';
        resetScanner();
    });

    document.getElementById('startScanBtn').addEventListener('click', startGameScan);
    document.getElementById('addManualGameBtn').addEventListener('click', addManualGames);

    document.getElementById('selectAllBtn').addEventListener('click', selectAllFoundGames);
    document.getElementById('addSelectedBtn').addEventListener('click', addSelectedGames);

    // User Groups
    document.getElementById('addGroupBtn').addEventListener('click', showAddGroupForm);
    document.getElementById('addGroupForm').addEventListener('submit', createUserGroup);
    document.getElementById('cancelGroupBtn').addEventListener('click', hideAddGroupForm);
    document.getElementById('editGameForm').addEventListener('submit', saveEditedGame);
    document.getElementById('cancelEditGameBtn').addEventListener('click', closeEditGame);
    document.getElementById('chooseWallpaperBtn').addEventListener('click', chooseGameWallpaper);

    // IPC Listeners
    window.gamesWidget.onOpenSettings(() => {
        settingsPanel.style.display = 'flex';
        loadSettingsUI();
        restoreOpenAccordionSection();
    });

}

// Render Games
function renderGames() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredGames = games.filter(game =>
        getDisplayName(game).toLowerCase().includes(searchTerm) ||
        game.name.toLowerCase().includes(searchTerm) ||
        String(game.category || '').toLowerCase().includes(searchTerm) ||
        getGameGroupName(game).toLowerCase().includes(searchTerm)
    );
    // Sort games
    filteredGames.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'category':
                return a.category.localeCompare(b.category);
            default:
                return 0;
        }
    });

    gamesGrid.innerHTML = '';

    if (filteredGames.length === 0) {
        gamesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎮</div>
                <div class="empty-state-text">No games found</div>
                <div class="empty-state-subtext">Click "Scan Games" to add games to your library</div>
            </div>
        `;
        return;
    }

    if (sortBy === 'group') {
        renderGameFolders(filteredGames);
        return;
    }

    filteredGames.forEach(game => {
        const gameCard = createGameCard(game);
        gamesGrid.appendChild(gameCard);
    });
}

function getGameGroupName(game) {
    if (game.group && userGroups.includes(game.group)) return game.group;
    const platform = String(game.platform || game.category || '').trim().toLowerCase();
    if (platform.includes('steam')) return 'Steam';
    if (platform.includes('epic')) return 'Epic Games';
    if (platform.includes('gog')) return 'GOG';
    if (platform.includes('xbox')) return 'Xbox';
    if (platform.includes('battle')) return 'Battle.net';
    if (platform.includes('ubisoft')) return 'Ubisoft Connect';
    if (platform === 'ea app' || platform === 'ea') return 'EA App';
    if (platform.includes('manual')) return 'Manual';
    return 'Unassigned';
}

function compareGameGroups(a, b) {
    const standard = [...LAUNCHER_GROUPS];
    const indexA = standard.indexOf(a);
    const indexB = standard.indexOf(b);
    if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    const customA = userGroups.indexOf(a);
    const customB = userGroups.indexOf(b);
    if (customA !== -1 || customB !== -1) return (customA === -1 ? 99 : customA) - (customB === -1 ? 99 : customB);
    return a.localeCompare(b);
}

function renderGameFolders(filteredGames) {
    const grouped = new Map();
    for (const game of filteredGames) {
        const name = getGameGroupName(game);
        if (!grouped.has(name)) grouped.set(name, []);
        grouped.get(name).push(game);
    }
    for (const [groupName, groupGames] of [...grouped.entries()].sort(([a], [b]) => compareGameGroups(a, b))) {
        const folder = document.createElement('section');
        folder.className = `game-folder${expandedGameGroups.has(groupName) ? ' is-open' : ''}`;
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'game-folder-header';
        header.setAttribute('aria-expanded', String(expandedGameGroups.has(groupName)));
        const icon = document.createElement('span');
        icon.className = 'game-folder-icon';
        icon.textContent = expandedGameGroups.has(groupName) ? '📂' : '📁';
        const name = document.createElement('span');
        name.className = 'game-folder-name';
        name.textContent = groupName;
        const count = document.createElement('span');
        count.className = 'game-folder-count';
        count.textContent = String(groupGames.length);
        const chevron = document.createElement('span');
        chevron.className = 'game-folder-chevron';
        chevron.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
        header.append(icon, name, count, chevron);

        const panel = document.createElement('div');
        panel.className = 'game-folder-panel';
        const content = document.createElement('div');
        content.className = 'game-folder-content';
        for (const game of groupGames) content.appendChild(createGameCard(game));
        panel.appendChild(content);
        header.addEventListener('click', () => {
            const isOpen = folder.classList.toggle('is-open');
            header.setAttribute('aria-expanded', String(isOpen));
            icon.textContent = isOpen ? '📂' : '📁';
            if (isOpen) expandedGameGroups.add(groupName);
            else expandedGameGroups.delete(groupName);
            localStorage.setItem('expandedGameGroups', JSON.stringify([...expandedGameGroups]));
        });
        folder.append(header, panel);
        gamesGrid.appendChild(folder);
    }
}

// Create Game Card
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.gameId = game.id;

    const cover = document.createElement('div');
    cover.className = `game-cover style-${coverArtStyle}`;

    const imageSource = game.customWallpaper || (coverArtStyle === 'icons'
        ? (game.landscapeImage || game.coverImage)
        : coverArtStyle === 'disks'
            ? (game.coverImage || game.landscapeImage || game.iconImage || game.appIconImage)
            : (game.coverImage || game.landscapeImage || game.iconImage || game.appIconImage));
    if (imageSource) {
        const img = document.createElement('img');
        img.src = imageSource;
        img.alt = game.name;
        img.onerror = async () => {
            if (game.customWallpaper === imageSource) {
                game.customWallpaper = null;
                saveGames();
                renderGames();
                return;
            }
            if (img.dataset.backupAttempted) {
                if (game.coverImage === imageSource) game.coverImage = null;
                if (game.iconImage === imageSource) game.iconImage = null;
                saveGames();
                img.style.display = 'none';
                cover.textContent = getGameEmoji(game.category);
                return;
            }
            img.dataset.backupAttempted = 'true';
            if (coverArtStyle === 'disks' && game.coverImage && game.coverImage !== imageSource) {
                game.iconImage = game.coverImage;
                saveGames();
                renderGames();
                return;
            }
            try {
                const backup = await window.gamesWidget.findBackupArtwork(game.name);
                if (backup?.image) {
                    game.coverImage = backup.image;
                    if (backup.landscapeImage) game.landscapeImage = backup.landscapeImage;
                    game.iconImage = backup.iconImage || backup.image;
                    game.artworkSource = backup.source || game.artworkSource;
                    saveGames();
                    renderGames();
                    return;
                }
            } catch (error) {
                console.warn(`Backup artwork lookup failed for ${game.name}:`, error);
            }
            if (game.coverImage === imageSource) game.coverImage = null;
            if (game.iconImage === imageSource) game.iconImage = null;
            saveGames();
            img.style.display = 'none';
            cover.textContent = getGameEmoji(game.category);
        };
        cover.appendChild(img);
    } else {
        cover.textContent = getGameEmoji(game.category);
    }

    const info = document.createElement('div');
    info.className = 'game-info';

    const title = document.createElement('div');
    title.className = 'game-title';
    title.textContent = getDisplayName(game);

    const category = document.createElement('div');
    category.className = 'game-category';
    category.textContent = game.category;

    info.appendChild(title);
    info.appendChild(category);

    if (game.group) {
        const group = document.createElement('div');
        group.className = 'game-group';
        group.textContent = game.group;
        info.appendChild(group);
    }

    const actions = document.createElement('div');
    actions.className = 'game-actions';
    const displayName = getDisplayName(game);
    const actionDefinitions = [
        { className: 'game-action-btn is-primary', text: '▶', title: `Play ${displayName}`, action: () => launchGame(game) },
        { className: 'game-action-btn', text: '✎', title: `Edit ${displayName}`, action: () => editGame(game) },
        { className: 'game-action-btn', text: '⇄', title: `Move ${displayName} to group`, action: (event) => showGameGroupMenu(event.pageX || event.clientX, event.pageY || event.clientY, game) },
        { className: 'game-action-btn is-danger', text: '×', title: `Remove ${displayName}`, action: () => removeGame(game) }
    ];
    for (const definition of actionDefinitions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = definition.className;
        button.textContent = definition.text;
        button.title = definition.title;
        button.setAttribute('aria-label', definition.title);
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            definition.action(event);
        });
        actions.appendChild(button);
    }

    card.appendChild(cover);
    card.appendChild(info);
    card.appendChild(actions);

    // Click to launch game (placeholder)
    card.addEventListener('click', () => {
        launchGame(game);
    });

    return card;
}

// Get Game Emoji based on category
function getGameEmoji(category) {
    const emojis = {
        'Action': '⚔️',
        'Adventure': '🗺️',
        'RPG': '🎭',
        'Strategy': '🏰',
        'Sports': '⚽',
        'Racing': '🏎️',
        'Puzzle': '🧩',
        'Horror': '👻',
        'Simulation': '🌍',
        'Indie': '🎨',
        'Multiplayer': '👥',
        'Shooter': '🔫',
        'Platformer': '🦘'
    };
    return emojis[category] || '🎮';
}

async function launchGame(game) {
    const displayName = getDisplayName(game);
    try {
        const result = await window.gamesWidget.launchGame(game);
        if (!result?.ok) {
            alert(result?.error || `Could not start ${displayName}.`);
            return;
        }
    } catch (error) {
        alert(`Could not start ${displayName}: ${error.message}`);
    }
}

function showGameGroupMenu(x, y, game) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 210))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 220))}px`;
    menu.style.zIndex = '1001';
    menu.setAttribute('role', 'menu');
    const options = [
        { text: `Use launcher group (${getGameGroupName({ ...game, group: null })})`, group: null },
        ...userGroups.map((group) => ({ text: group, group }))
    ];
    for (const option of options) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'context-menu-item';
        item.textContent = option.text;
        item.addEventListener('click', () => {
            game.group = option.group;
            saveGames();
            renderGames();
            menu.remove();
        });
        menu.appendChild(item);
    }
    document.body.appendChild(menu);
    const menuHeight = menu.getBoundingClientRect().height;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8))}px`;
    setTimeout(() => {
        document.addEventListener('click', function closeGroupMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeGroupMenu);
            }
        });
    }, 0);
}


function getDisplayName(game) {
    return typeof game.displayName === 'string' && game.displayName.trim() ? game.displayName.trim() : game.name;
}

function editGame(game) {
    editingGame = game;
    pendingGameWallpaper = game.customWallpaper || null;
    document.getElementById('editGameName').value = getDisplayName(game);
    document.getElementById('editGameStatus').textContent = '';
    updateEditWallpaperPreview(pendingGameWallpaper || game.landscapeImage || game.coverImage || game.iconImage || game.appIconImage);
    settingsPanel.style.display = 'none';
    editGamePanel.style.display = 'flex';
    document.getElementById('editGameName').focus();
}

function updateEditWallpaperPreview(imageUrl) {
    const previewWrap = document.getElementById('editWallpaperPreviewWrap');
    const preview = document.getElementById('editWallpaperPreview');
    const placeholder = document.getElementById('editWallpaperPlaceholder');
    if (imageUrl) {
        preview.src = imageUrl;
        previewWrap.classList.add('has-image');
        placeholder.textContent = 'Current wallpaper';
    } else {
        preview.removeAttribute('src');
        previewWrap.classList.remove('has-image');
        placeholder.textContent = 'No wallpaper available';
    }
}

async function chooseGameWallpaper() {
    if (!editingGame) return;
    const status = document.getElementById('editGameStatus');
    try {
        const result = await window.gamesWidget.chooseGameWallpaper(editingGame.id);
        if (result?.canceled) return;
        if (!result?.ok) {
            status.textContent = result?.error || 'Could not load that image.';
            return;
        }
        pendingGameWallpaper = result.image;
        updateEditWallpaperPreview(pendingGameWallpaper);
        status.textContent = '';
    } catch (error) {
        status.textContent = `Could not load that image: ${error.message}`;
    }
}

function saveEditedGame(event) {
    event.preventDefault();
    if (!editingGame) return;
    const name = document.getElementById('editGameName').value.trim();
    if (!name) {
        document.getElementById('editGameStatus').textContent = 'Enter a name for this game.';
        return;
    }
    editingGame.displayName = name;
    if (pendingGameWallpaper) editingGame.customWallpaper = pendingGameWallpaper;
    saveGames();
    closeEditGame();
    renderGames();
}

function closeEditGame() {
    editGamePanel.style.display = 'none';
    editingGame = null;
    pendingGameWallpaper = null;
}

// Remove Game
function removeGame(game) {
    if (confirm(`Remove ${getDisplayName(game)} from your library?`)) {
        games = games.filter(g => g.id !== game.id);
        saveGames();
        renderGames();
    }
}

// Update Cover Art Toggle Button
function updateCoverArtToggle() {
    if (!coverArtToggleIcon) return;
    coverArtToggleIcon.innerHTML = COVER_ICONS[coverArtStyle] || COVER_ICONS.icons;
    const hint = coverArtStyle === 'disks' ? 'Switch to Icons view' : 'Switch to Disks view';
    coverArtToggle.title = hint;
    coverArtToggle.setAttribute('aria-label', hint);
}

// Update Cover Art Settings
function updateCoverArtSettings() {
    const styleRadios = document.querySelectorAll('input[name="coverStyle"]');
    styleRadios.forEach(radio => {
        radio.checked = radio.value === coverArtStyle;
    });
}

// Load Settings UI
function loadSettingsUI() {
    updateCoverArtSettings();
    loadPlatformSettingsUI();
    renderUserGroups();
}

function loadPlatformSettingsUI() {
    const savedPlatforms = localStorage.getItem('platformSettings');
    if (savedPlatforms) {
        try {
            const platforms = JSON.parse(savedPlatforms);
            if (platforms.steamEnabled !== undefined) document.getElementById('steamEnabled').checked = platforms.steamEnabled;
            if (platforms.epicEnabled !== undefined) document.getElementById('epicEnabled').checked = platforms.epicEnabled;
            if (platforms.gogEnabled !== undefined) document.getElementById('gogEnabled').checked = platforms.gogEnabled;
            if (platforms.xboxEnabled !== undefined) document.getElementById('xboxEnabled').checked = platforms.xboxEnabled;
            if (platforms.battlenetEnabled !== undefined) document.getElementById('battlenetEnabled').checked = platforms.battlenetEnabled;
            if (platforms.ubisoftEnabled !== undefined) document.getElementById('ubisoftEnabled').checked = platforms.ubisoftEnabled;
            if (platforms.eaEnabled !== undefined) document.getElementById('eaEnabled').checked = platforms.eaEnabled;
        } catch (error) {
            console.warn('Could not load platform settings UI:', error);
        }
    }
}

// Save Settings from UI
function saveSettingsFromUI() {
    const selectedStyle = document.querySelector('input[name="coverStyle"]:checked');
    if (selectedStyle) {
        coverArtStyle = selectedStyle.value;
        localStorage.setItem('coverArtStyle', coverArtStyle);
        updateCoverArtToggle();
    }

    // Save platform settings
    const platforms = {
        steamEnabled: document.getElementById('steamEnabled').checked,
        epicEnabled: document.getElementById('epicEnabled').checked,
        gogEnabled: document.getElementById('gogEnabled').checked,
        xboxEnabled: document.getElementById('xboxEnabled').checked,
        battlenetEnabled: document.getElementById('battlenetEnabled').checked,
        ubisoftEnabled: document.getElementById('ubisoftEnabled').checked,
        eaEnabled: document.getElementById('eaEnabled').checked
    };
    localStorage.setItem('platformSettings', JSON.stringify(platforms));

    saveUserGroups();
    renderGames();
}

function saveUserGroups() {
    localStorage.setItem('userGroups', JSON.stringify(userGroups));
    window.gamesWidget.saveUserGroups(userGroups);
}

// Render User Groups
function renderUserGroups() {
    const groupsList = document.getElementById('userGroupsList');
    groupsList.innerHTML = '';

    userGroups.forEach((group, index) => {
        const groupItem = document.createElement('div');
        groupItem.className = 'user-group-item';

        const groupName = document.createElement('span');
        groupName.className = 'user-group-name';
        groupName.textContent = group;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-group-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            const [removedGroup] = userGroups.splice(index, 1);
            games.forEach((game) => { if (game.group === removedGroup) game.group = null; });
            expandedGameGroups.delete(removedGroup);
            saveUserGroups();
            localStorage.setItem('expandedGameGroups', JSON.stringify([...expandedGameGroups]));
            saveGames();
            renderUserGroups();
            renderGames();
        });

        groupItem.appendChild(groupName);
        groupItem.appendChild(deleteBtn);
        groupsList.appendChild(groupItem);
    });
}

function showAddGroupForm() {
    const form = document.getElementById('addGroupForm');
    form.hidden = false;
    document.getElementById('groupFormStatus').textContent = '';
    document.getElementById('newGroupName').focus();
}

function hideAddGroupForm() {
    document.getElementById('addGroupForm').hidden = true;
    document.getElementById('newGroupName').value = '';
    document.getElementById('groupFormStatus').textContent = '';
}

function createUserGroup(event) {
    event.preventDefault();
    const input = document.getElementById('newGroupName');
    const status = document.getElementById('groupFormStatus');
    const name = input.value.trim();
    const reserved = [...LAUNCHER_GROUPS, 'Unassigned'];
    if (!name) {
        status.textContent = 'Enter a name for this group.';
        input.focus();
        return;
    }
    if (userGroups.some((group) => group.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        status.textContent = 'A group with that name already exists.';
        input.focus();
        return;
    }
    if (reserved.some((item) => item.toLowerCase() === name.toLowerCase())) {
        status.textContent = 'That name is reserved for a launcher group.';
        input.focus();
        return;
    }

    userGroups.push(name);
    saveUserGroups();
    renderUserGroups();
    renderGames();
    hideAddGroupForm();
}

// Game Scanning
let foundGames = [];
let selectedFoundGames = new Set();

async function startGameScan() {
    const platforms = {
        steam: document.getElementById('scanSteam').checked,
        epic: document.getElementById('scanEpic').checked,
        gog: document.getElementById('scanGog').checked,
        xbox: document.getElementById('scanXbox').checked,
        battlenet: document.getElementById('scanBattlenet').checked,
        ubisoft: document.getElementById('scanUbisoft').checked,
        ea: document.getElementById('scanEa').checked
    };

    if (!Object.values(platforms).some(Boolean)) {
        alert('Please select at least one platform to scan');
        return;
    }

    // Scan actual installed-game records on this PC.
    document.getElementById('scanProgress').style.display = 'block';
    document.getElementById('scanResults').style.display = 'none';
    document.getElementById('startScanBtn').disabled = true;
    const scanStatus = document.getElementById('scanStatus');
    scanStatus.textContent = 'Checking installed game files…';
    try {
        foundGames = await window.gamesWidget.scanInstalledGames(platforms);
        const selectedPlatforms = new Set([
            ...(platforms.steam ? ['Steam'] : []), ...(platforms.epic ? ['Epic Games', 'Epic'] : []), ...(platforms.gog ? ['GOG'] : [])
        ]);
        const oldDemoRecords = new Set([
            'Steam|counter strike 2', 'Steam|dota 2', 'Steam|team fortress 2',
            'Epic|fortnite', 'Epic|rocket league', 'GOG|the witcher 3'
        ]);
        const installedNames = new Set(foundGames.map((game) => `${game.platform}|${game.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`));
        const beforeCleanup = games.length;
        games = games.filter((game) => {
            const name = game.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            const sourcePlatform = game.platform || game.category;
            const platform = sourcePlatform === 'Epic' ? 'Epic Games' : sourcePlatform;
            return !(!game.installPath && !game.steamAppId && selectedPlatforms.has(platform) &&
                oldDemoRecords.has(`${sourcePlatform}|${name}`) &&
                !installedNames.has(`${platform}|${name}`));
        });
        if (games.length !== beforeCleanup) saveGames();
        const foundUnique = new Map();
        for (const found of foundGames) foundUnique.set(`${found.platform}:${found.name.toLocaleLowerCase()}`, found);
        foundGames = [...foundUnique.values()];
        scanStatus.textContent = foundGames.length
            ? `Found ${foundGames.length} installed game${foundGames.length === 1 ? '' : 's'}.`
            : 'No installed games found for the selected platforms.';
        displayFoundGames();
    } catch (error) {
        foundGames = [];
        scanStatus.textContent = error.message || 'Game scan failed.';
        displayFoundGames();
    } finally {
        document.getElementById('startScanBtn').disabled = false;
    }
}

async function addManualGames() {
    const button = document.getElementById('addManualGameBtn');
    button.disabled = true;
    try {
        const chosen = await window.gamesWidget.chooseManualGames();
        if (!chosen?.length) return;
        foundGames = chosen;
        const scanStatus = document.getElementById('scanStatus');
        scanStatus.textContent = `Selected ${chosen.length} game${chosen.length === 1 ? '' : 's'}. You can rename them later with Edit.`;
        displayFoundGames();
        selectAllFoundGames();
    } catch (error) {
        alert(`Could not add the game: ${error.message}`);
    } finally {
        button.disabled = false;
    }
}

function displayFoundGames() {
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('scanResults').style.display = 'block';

    const foundGamesList = document.getElementById('foundGamesList');
    foundGamesList.innerHTML = '';
    selectedFoundGames.clear();

    const summary = document.getElementById('scanSummary');
    summary.textContent = document.getElementById('scanStatus').textContent;
    if (!foundGames.length) {
        const message = document.createElement('p');
        message.className = 'scan-empty';
        message.textContent = summary.textContent;
        foundGamesList.appendChild(message);
        return;
    }

    foundGames.forEach((game, index) => {
        const gameItem = document.createElement('div');
        gameItem.className = 'found-game-item';
        gameItem.dataset.index = index;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedFoundGames.add(index);
                gameItem.classList.add('selected');
            } else {
                selectedFoundGames.delete(index);
                gameItem.classList.remove('selected');
            }
        });

        const gameInfo = document.createElement('div');
        gameInfo.className = 'found-game-info';

        const gameName = document.createElement('div');
        gameName.className = 'found-game-name';
        gameName.textContent = game.name;

        const gamePlatform = document.createElement('div');
        gamePlatform.className = 'found-game-platform';
        gamePlatform.textContent = game.platform;

        gameInfo.appendChild(gameName);
        gameInfo.appendChild(gamePlatform);

        gameItem.appendChild(checkbox);
        gameItem.appendChild(gameInfo);

        gameItem.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        foundGamesList.appendChild(gameItem);
    });
}

function selectAllFoundGames() {
    const checkboxes = document.querySelectorAll('#foundGamesList input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = true;
        selectedFoundGames.add(index);
        checkbox.closest('.found-game-item').classList.add('selected');
    });
}

async function addSelectedGames() {
    if (selectedFoundGames.size === 0) {
        alert('Please select at least one game to add');
        return;
    }

    const addButton = document.getElementById('addSelectedBtn');
    addButton.disabled = true;
    addButton.textContent = 'Fetching artwork…';
    const newEntries = await Promise.all([...selectedFoundGames].map(async (index) => {
        const foundGame = foundGames[index];
        const existingGame = games.find((game) =>
            (foundGame.steamAppId && String(game.steamAppId) === String(foundGame.steamAppId)) ||
            (game.platform === foundGame.platform && game.installPath && game.installPath === foundGame.installPath)
        );
        if (existingGame) {
            if (foundGame.executablePath) existingGame.executablePath = foundGame.executablePath;
            for (const field of LAUNCH_FIELDS) if (foundGame[field]) existingGame[field] = foundGame[field];
            try {
                const result = await window.gamesWidget.getExecutableIcon(existingGame.executablePath, existingGame.installPath, existingGame.name);
                if (result?.image) {
                    existingGame.executablePath = result.executablePath;
                    existingGame.appIconImage = result.image;
                }
            } catch { /* Keep the existing cover art when the executable has no extractable icon. */ }
            return null;
        }
        let artwork = null;
        try { artwork = await window.gamesWidget.findArtwork(foundGame.name, foundGame.steamAppId); }
        catch (error) { console.warn(`Could not find Steam artwork for ${foundGame.name}:`, error); }
        const newGame = {
            id: foundGame.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: foundGame.name,
            category: foundGame.category,
            platform: foundGame.platform,
            steamAppId: artwork?.appid || foundGame.steamAppId,
            coverImage: artwork?.image || null,
            landscapeImage: artwork?.landscapeImage || null,
            iconImage: artwork?.iconImage || artwork?.image || null,
            artworkChecked: true,
            artworkSource: artwork?.source || null,
            installPath: foundGame.installPath,
            executablePath: foundGame.executablePath || null,
            ...Object.fromEntries(LAUNCH_FIELDS.map((field) => [field, foundGame[field] || null])),
            group: null
        };
        if (newGame.executablePath || newGame.installPath) {
            try {
                const result = await window.gamesWidget.getExecutableIcon(newGame.executablePath, newGame.installPath, newGame.name);
                if (result?.image) {
                    newGame.executablePath = result.executablePath;
                    newGame.appIconImage = result.image;
                }
            } catch { /* Keep store artwork if Windows cannot extract an executable icon. */ }
        }
        return newGame;
    }));
    games.push(...newEntries.filter(Boolean));

    saveGames();
    renderGames();
    addButton.disabled = false;
    addButton.textContent = 'Add Selected';
    scannerPanel.style.display = 'none';
    resetScanner();
}

function resetScanner() {
    document.getElementById('scanProgress').style.display = 'none';
    document.getElementById('scanResults').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('scanStatus').textContent = 'Scanning...';
    foundGames = [];
    selectedFoundGames.clear();
}

// Performance Mode
const performanceHistory = { fps: [], cpu: [] };
const PERFORMANCE_HISTORY_LENGTH = 40;
let performanceOrientation = 'vertical';
let performanceDependenciesVisible = false;
let performanceStatusVisible = false;
let performanceDependenciesInstalled = { rtss: null, afterburner: null };
let lastPerformanceLayoutKey = '';

function syncPerformanceLayout() {
    const key = `${performanceOrientation}:${performanceDependenciesVisible}:${performanceStatusVisible}`;
    if (key === lastPerformanceLayoutKey) return;
    lastPerformanceLayoutKey = key;
    window.gamesWidget.setPerformanceLayout({
        orientation: performanceOrientation,
        showDependencies: performanceDependenciesVisible,
        showStatus: performanceStatusVisible
    });
}

function setPerformanceOrientation(orientation) {
    const nextOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    if (nextOrientation === performanceOrientation) return;
    performanceOrientation = nextOrientation;
    const horizontal = performanceOrientation === 'horizontal';
    document.body.classList.toggle('performance-horizontal', horizontal);
    performanceLayoutBtn.classList.toggle('is-horizontal', horizontal);
    const label = horizontal ? 'Switch to vertical layout' : 'Switch to horizontal layout';
    performanceLayoutBtn.title = label;
    performanceLayoutBtn.setAttribute('aria-label', label);
    performanceLayoutBtn.setAttribute('aria-pressed', String(horizontal));
    if (horizontal) {
        performanceDependenciesVisible = false;
        document.getElementById('perfDownloads').hidden = true;
    }
    syncPerformanceLayout();
}

function updateRtssStatus(status) {
    const element = document.getElementById('perfStatus');
    performanceStatusVisible = Boolean(status && status.state !== 'ok');
    if (!element) {
        syncPerformanceLayout();
        return;
    }
    if (!performanceStatusVisible) {
        element.hidden = true;
        element.textContent = '';
    } else {
        element.textContent = status.message || 'RTSS status unavailable';
        element.hidden = false;
    }
    syncPerformanceLayout();
}

function updateDependencyButtons() {
    document.querySelectorAll('.perf-link[data-dependency]').forEach((link) => {
        link.hidden = performanceDependenciesInstalled[link.dataset.dependency] !== false;
    });
}

function formatMetric(value, digits = 0) {
    return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function metricTone(value, warm, hot) {
    if (!Number.isFinite(value)) return 'idle';
    return value >= hot ? 'hot' : value >= warm ? 'warm' : 'good';
}

function setPerformanceMetric(id, value, ringPercent, tone, digits = 0) {
    document.getElementById(id).textContent = formatMetric(value, digits);
    const ring = document.getElementById(`${id}Ring`);
    const percent = Number.isFinite(ringPercent) ? Math.max(0, Math.min(100, ringPercent)) : 0;
    ring.style.strokeDasharray = `${percent} 100`;
    ring.dataset.tone = tone;
}

function resetPerformancePanel() {
    performanceHistory.fps = [];
    performanceHistory.cpu = [];
    performanceDependenciesInstalled = { rtss: null, afterburner: null };
    updatePerformancePanel({});
}

function updatePerformancePanel(sample = {}) {
    const hasFps = Number.isFinite(sample.fps);
    document.getElementById('perfFps').textContent = formatMetric(sample.fps);
    document.getElementById('perfFrameTime').textContent = `${formatMetric(sample.frameTime ?? (hasFps && sample.fps > 0 ? 1000 / sample.fps : null), 1)} ms`;
    document.getElementById('perfFpsHint').style.display = hasFps ? 'none' : 'block';
    setPerformanceMetric('perfCpuTemp', sample.cpuTemp, sample.cpuTemp, metricTone(sample.cpuTemp, 70, 85));
    setPerformanceMetric('perfCpuLoad', sample.cpuLoad, sample.cpuLoad, metricTone(sample.cpuLoad, 101, 101));
    setPerformanceMetric('perfGpuTemp', sample.gpuTemp, sample.gpuTemp, metricTone(sample.gpuTemp, 70, 85));
    setPerformanceMetric('perfGpuLoad', sample.gpuLoad, sample.gpuLoad, metricTone(sample.gpuLoad, 101, 101));
    setPerformanceMetric('perfRam', sample.ramUsedGb, sample.ramLoad, metricTone(sample.ramLoad, 101, 101), 1);
    document.getElementById('perfRamLoad').textContent = formatMetric(sample.ramLoad);
    const ramLoadRing = document.getElementById('perfRamLoadRing');
    const ramLoadPercent = Number.isFinite(sample.ramLoad) ? Math.max(0, Math.min(100, sample.ramLoad)) : 0;
    ramLoadRing.style.strokeDasharray = `${ramLoadPercent} 100`;
    ramLoadRing.dataset.tone = metricTone(sample.ramLoad, 101, 101);

    if (hasFps) performanceHistory.fps.push(sample.fps);
    if (Number.isFinite(sample.cpuLoad)) performanceHistory.cpu.push(sample.cpuLoad);
    for (const history of Object.values(performanceHistory)) history.splice(0, Math.max(0, history.length - PERFORMANCE_HISTORY_LENGTH));
    const history = hasFps ? performanceHistory.fps : performanceHistory.cpu;
    const max = Math.max(hasFps ? 60 : 100, ...history);
    const step = 100 / (PERFORMANCE_HISTORY_LENGTH - 1);
    const offset = PERFORMANCE_HISTORY_LENGTH - history.length;
    document.getElementById('perfGraph').setAttribute('points', history.length > 1
        ? history.map((value, index) => `${((offset + index) * step).toFixed(2)},${(22 - (value / max) * 20).toFixed(2)}`).join(' ')
        : '0,22 100,22');

    const detectedDependencies = sample.dependencies;
    if (detectedDependencies && typeof detectedDependencies === 'object') {
        performanceDependenciesInstalled = {
            rtss: detectedDependencies.rtss === true,
            afterburner: detectedDependencies.afterburner === true
        };
    }
    const dependenciesKnown = performanceDependenciesInstalled.rtss !== null && performanceDependenciesInstalled.afterburner !== null;
    const showDependencies = performanceOrientation !== 'horizontal'
        && dependenciesKnown
        && (performanceDependenciesInstalled.rtss === false || performanceDependenciesInstalled.afterburner === false);
    performanceDependenciesVisible = showDependencies;
    document.getElementById('perfDownloads').hidden = !showDependencies;
    updateDependencyButtons();
    syncPerformanceLayout();
    document.querySelectorAll('.perf-link').forEach((link) => {
        link.onclick = () => {
            if (!link.hidden) window.gamesWidget.openExternal(link.dataset.url);
        };
    });
}

// Initialize the app
init();
