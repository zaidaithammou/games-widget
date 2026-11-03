// Game Library State
let games = [];
let coverArtStyle = 'icons';
let sortBy = 'name';
let userGroups = [];

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
function init() {
    loadSettings();
    loadGames();
    setupEventListeners();
    renderGames();
    fetchMissingArtwork();
    fetchExecutableIcons();
}

async function fetchExecutableIcons() {
    await Promise.all(games.filter((game) => game.executablePath).map(async (game) => {
        try {
            const icon = await window.gamesWidget.getExecutableIcon(game.executablePath);
            if (icon && game.iconImage !== icon) {
                game.iconImage = icon;
                saveGames();
            }
        } catch (error) {
            console.warn(`Could not load the executable icon for ${game.name}:`, error);
        }
    }));
    renderGames();
}

// Load Settings
function loadSettings() {
    const savedStyle = localStorage.getItem('coverArtStyle');
    if (savedStyle) {
        coverArtStyle = savedStyle;
        coverArtSelect.value = savedStyle;
    }

    const savedSort = localStorage.getItem('sortBy');
    if (savedSort) {
        sortBy = savedSort;
        sortSelect.value = savedSort;
    }

    const savedGroups = localStorage.getItem('userGroups');
    if (savedGroups) {
        userGroups = JSON.parse(savedGroups);
    }
}

// Load Games
function loadGames() {
    const savedGames = localStorage.getItem('games');
    if (savedGames) {
        try {
            const storedGames = JSON.parse(savedGames);
            const unique = new Map();
            for (const game of storedGames) {
                const identity = game.steamAppId
                    ? `${game.platform}:appid:${game.steamAppId}`
                    : `${game.platform}:${game.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
                if (!unique.has(identity)) unique.set(identity, game);
            }
            games = [...unique.values()];
            if (games.length !== storedGames.length) saveGames();
        } catch (error) {
            console.warn('Could not load the saved game list:', error);
            games = [];
        }
    }
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
    makeDraggable(document.querySelector('.widget-header'), (event) => !event.target.closest('button, input, select'));
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
    document.getElementById('addGroupBtn').addEventListener('click', addNewGroup);

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
        game.category.toLowerCase().includes(searchTerm)
    );

    // Sort games
    filteredGames.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'category':
                return a.category.localeCompare(b.category);
            case 'group':
                const groupA = a.group || '';
                const groupB = b.group || '';
                return groupA.localeCompare(groupB);
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

    filteredGames.forEach(game => {
        const gameCard = createGameCard(game);
        gamesGrid.appendChild(gameCard);
    });
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
    removeButton.textContent = '×';
    removeButton.title = `Remove ${game.name}`;
    removeButton.setAttribute('aria-label', `Remove ${game.name} from library`);
    removeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        removeGame(game);
    });

    const imageSource = coverArtStyle === 'wallpaper'
        ? (game.landscapeImage || game.coverImage)
        : (game.iconImage || game.coverImage);
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
            if (coverArtStyle !== 'wallpaper' && game.coverImage && game.coverImage !== imageSource) {
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

    card.appendChild(cover);
    card.appendChild(info);
    card.appendChild(removeButton);

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

// Launch Game (placeholder)
function launchGame(game) {
    console.log('Launching game:', game.name);
    // In a real implementation, this would launch the game executable
    alert(`Launching ${game.name}...`);
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
            option.action();
            document.body.removeChild(menu);
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

    localStorage.setItem('userGroups', JSON.stringify(userGroups));
    renderGames();
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
            userGroups.splice(index, 1);
            renderUserGroups();
        });

        groupItem.appendChild(groupName);
        groupItem.appendChild(deleteBtn);
        groupsList.appendChild(groupItem);
    });
}

// Add New Group
function addNewGroup() {
    const groupName = prompt('Enter group name:');
    if (groupName && groupName.trim() && !userGroups.includes(groupName.trim())) {
        userGroups.push(groupName.trim());
        renderUserGroups();
    }
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
            try {
                const icon = existingGame.executablePath && await window.gamesWidget.getExecutableIcon(existingGame.executablePath);
                if (icon) existingGame.iconImage = icon;
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
            group: null
        };
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
