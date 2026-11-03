// Game Library State
let games = [];
let coverArtStyle = 'icons';
let sortBy = 'name';
let userGroups = [];
let expandedGameGroups = new Set();

// DOM Elements
const gamesGrid = document.getElementById('gamesGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const coverArtSelect = document.getElementById('coverArtSelect');
const settingsBtn = document.getElementById('settingsBtn');
const scanGamesBtn = document.getElementById('scanGamesBtn');
const settingsPanel = document.getElementById('settingsPanel');
const scannerPanel = document.getElementById('scannerPanel');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const compactRestoreBtn = document.getElementById('compactRestoreBtn');

// Initialize
async function init() {
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
        coverArtSelect.value = coverArtStyle;
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

// Setup Event Listeners
function setupEventListeners() {
    minimizeBtn.addEventListener('click', () => window.gamesWidget.minimize());
    closeBtn.addEventListener('click', () => window.gamesWidget.close());

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
    coverArtSelect.addEventListener('change', (e) => {
        coverArtStyle = e.target.value;
        localStorage.setItem('coverArtStyle', coverArtStyle);
        updateCoverArtSettings();
        renderGames();
    });

    // Settings
    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'flex';
        loadSettingsUI();
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

    document.getElementById('selectAllBtn').addEventListener('click', selectAllFoundGames);
    document.getElementById('addSelectedBtn').addEventListener('click', addSelectedGames);

    // User Groups
    document.getElementById('addGroupBtn').addEventListener('click', showAddGroupForm);
    document.getElementById('addGroupForm').addEventListener('submit', createUserGroup);
    document.getElementById('cancelGroupBtn').addEventListener('click', hideAddGroupForm);

    // IPC Listeners
    window.gamesWidget.onOpenSettings(() => {
        settingsPanel.style.display = 'flex';
        loadSettingsUI();
    });

}

// Render Games
function renderGames() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredGames = games.filter(game => 
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
    return 'Unassigned';
}

function compareGameGroups(a, b) {
    const standard = ['Steam', 'Epic Games', 'GOG'];
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
        chevron.textContent = '⌄';
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

    const removeButton = document.createElement('button');
    removeButton.className = 'game-remove-btn';
    removeButton.type = 'button';
    const removeGlyph = document.createElement('span');
    removeGlyph.textContent = '×';
    removeButton.appendChild(removeGlyph);
    removeButton.title = `Remove ${game.name}`;
    removeButton.setAttribute('aria-label', `Remove ${game.name} from library`);
    removeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        removeGame(game);
    });

    const imageSource = coverArtStyle === 'icons'
        ? (game.landscapeImage || game.coverImage)
        : coverArtStyle === 'disks'
            ? (game.coverImage || game.landscapeImage || game.iconImage || game.appIconImage)
            : (game.coverImage || game.landscapeImage || game.iconImage || game.appIconImage);
    if (imageSource) {
        const img = document.createElement('img');
        img.src = imageSource;
        img.alt = game.name;
        img.onerror = async () => {
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
    title.textContent = game.name;

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
    const playButton = document.createElement('button');
    playButton.className = 'game-play-btn';
    playButton.type = 'button';
    playButton.textContent = '▶ Play';
    playButton.setAttribute('aria-label', `Play ${game.name}`);
    playButton.addEventListener('click', (event) => {
        event.stopPropagation();
        launchGame(game);
    });
    actions.appendChild(playButton);
    actions.appendChild(removeButton);

    card.appendChild(cover);
    card.appendChild(info);
    card.appendChild(actions);

    // Click to launch game (placeholder)
    card.addEventListener('click', () => {
        launchGame(game);
    });

    // Right-click for context menu
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showGameContextMenu(e, game);
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
    try {
        const result = await window.gamesWidget.launchGame(game);
        if (!result?.ok) alert(result?.error || `Could not start ${game.name}.`);
    } catch (error) {
        alert(`Could not start ${game.name}: ${error.message}`);
    }
}

// Show Game Context Menu
function showGameContextMenu(event, game) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.style.background = 'rgba(30, 30, 40, 0.95)';
    menu.style.borderRadius = '8px';
    menu.style.padding = '8px 0';
    menu.style.minWidth = '150px';
    menu.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    menu.style.zIndex = '1000';

    const options = [
        { text: 'Launch', action: () => launchGame(game) },
        { text: 'Edit', action: () => editGame(game) },
        { text: 'Move to Group…', action: () => showGameGroupMenu(event.pageX, event.pageY, game) },
        { text: 'Remove', action: () => removeGame(game) }
    ];

    options.forEach(option => {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.textContent = option.text;
        item.style.padding = '8px 16px';
        item.style.cursor = 'pointer';
        item.style.transition = 'background 0.2s';

        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(102, 126, 234, 0.3)';
        });

        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });

        item.addEventListener('click', () => {
            document.body.removeChild(menu);
            option.action();
        });

        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Close menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
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


// Edit Game
function editGame(game) {
    const newName = prompt('Enter new game name:', game.name);
    if (newName && newName.trim()) {
        game.name = newName.trim();
        saveGames();
        renderGames();
    }
}

// Remove Game
function removeGame(game) {
    if (confirm(`Remove ${game.name} from your library?`)) {
        games = games.filter(g => g.id !== game.id);
        saveGames();
        renderGames();
    }
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
    renderUserGroups();
}

// Save Settings from UI
function saveSettingsFromUI() {
    const selectedStyle = document.querySelector('input[name="coverStyle"]:checked');
    if (selectedStyle) {
        coverArtStyle = selectedStyle.value;
        localStorage.setItem('coverArtStyle', coverArtStyle);
        coverArtSelect.value = coverArtStyle;
    }

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
    const reserved = ['Steam', 'Epic Games', 'GOG', 'Unassigned'];
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
    const scanSteam = document.getElementById('scanSteam').checked;
    const scanEpic = document.getElementById('scanEpic').checked;
    const scanGog = document.getElementById('scanGog').checked;

    if (!scanSteam && !scanEpic && !scanGog) {
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
        foundGames = await window.gamesWidget.scanInstalledGames({ steam: scanSteam, epic: scanEpic, gog: scanGog });
        const selectedPlatforms = new Set([
            ...(scanSteam ? ['Steam'] : []), ...(scanEpic ? ['Epic Games', 'Epic'] : []), ...(scanGog ? ['GOG'] : [])
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
            if (foundGame.epicAppName) existingGame.epicAppName = foundGame.epicAppName;
            if (foundGame.epicCatalogNamespace) existingGame.epicCatalogNamespace = foundGame.epicCatalogNamespace;
            if (foundGame.epicCatalogItemId) existingGame.epicCatalogItemId = foundGame.epicCatalogItemId;
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
            epicAppName: foundGame.epicAppName || null,
            epicCatalogNamespace: foundGame.epicCatalogNamespace || null,
            epicCatalogItemId: foundGame.epicCatalogItemId || null,
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

// Initialize the app
init();
