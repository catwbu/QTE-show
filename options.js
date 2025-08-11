/**
 * options.js
 * 處理全新設定頁面的所有邏輯。
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- 新增：動態注入樣式以調整寬度、顏色和對齊 ---
    const style = document.createElement('style');
    style.textContent = `
        /* --- 主要佈局與寬度調整 --- */
        .sidebar {
            width: 180px;
        }
        .main-content .tab-pane,
        .main-content > .btn-save,
        .main-content > #status {
            max-width: 750px;
            margin-left: auto;
            margin-right: auto;
        }
        /* 修正按鈕重疊問題，並縮小間距 */
        .main-content .tab-pane {
            margin-bottom: 40px;
        }

        /* --- 統一按鈕顏色風格 (黑白灰) --- */
        button {
            background-color: #3a3a3a;
            border: 1px solid #555;
            transition: background-color 0.2s, color 0.2s;
        }
        button:hover {
            background-color: #4a4a4a;
        }
        .btn-save {
            background-color: #2a2a2a;
            display: block;
        }
        .btn-save:hover {
            background-color: #3a3a3a;
        }

        /* --- 側邊欄選中狀態顏色 --- */
        .sidebar-nav-item.active {
            border-left-color: #888;
        }

        /* --- "自訂互動" 頁籤重新設計 --- */
        textarea {
            resize: none; /* 封鎖列表輸入框不可變動大小 */
        }
        .card-grid {
            display: grid;
            grid-template-columns: 1fr; /* 卡片改成長條狀 */
            gap: 15px;
        }
        .add-website-container {
            margin-top: 20px;
            text-align: center;
        }
        .btn-add-website {
            background-color: #4a4a4a; /* 中灰色 */
            padding: 10px 25px;
            font-size: 16px;
            width: auto !important; /* 覆寫 button 的 width: 100% */
        }
        .btn-add-website:hover {
            background-color: #5a5a5a;
        }

        /* --- 卡片內部樣式調整 --- */
        .interaction-card {
            position: relative; /* 為了刪除按鈕的絕對定位 */
            padding: 20px;
        }
        .interaction-card textarea.card-url {
            height: 80px; /* 自訂網址輸入框高度 */
        }
        /* 刪除按鈕改為 X 樣式 */
        .btn-delete-x {
            position: absolute;
            top: 15px;
            right: 15px;
            width: 26px !important;
            height: 26px !important;
            padding: 0;
            font-size: 24px;
            line-height: 26px;
            text-align: center;
            color: #888; /* 預設為灰色 */
            background-color: transparent; /* 無背景 */
            border: none;
            font-family: 'Arial', sans-serif;
            font-weight: bold;
        }
        .btn-delete-x:hover {
            color: #fff; /* 滑鼠懸停時變白 */
            background-color: transparent;
        }


        /* --- 全新自訂設定區塊 Grid 佈局 --- */
        .custom-settings {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #444;
        }
        .settings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr; /* 兩欄佈局 */
            gap: 15px 25px; /* 垂直與水平間距 */
        }
        .grid-item > label {
            font-size: 14px;
            margin-bottom: 6px;
        }
        .min-max-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .min-max-group input {
            flex: 1;
            min-width: 50px;
        }
        .min-max-group span {
            color: #888;
        }
    `;
    document.head.append(style);
    // --- 樣式注入結束 ---

    // --- DOM 元素獲取 ---
    const saveButton = document.getElementById('save-btn');
    const statusDiv = document.getElementById('status');
    
    // 頁籤1: 網站封鎖
    const blockedSitesTextarea = document.getElementById('blocked-sites-textarea');
    const difficultySelect = document.getElementById('difficulty-select');

    // 頁籤2: 自訂互動
    const addCardButton = document.getElementById('add-card-btn');
    const cardContainer = document.getElementById('card-container');

    // 頁籤切換
    const sidebarItems = document.querySelectorAll('.sidebar-nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // --- 事件綁定 ---
    saveButton.addEventListener('click', saveOptions);
    addCardButton.addEventListener('click', addCard);
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            // 更新側邊欄樣式
            sidebarItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // 顯示對應的內容面板
            const targetTab = item.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                pane.style.display = pane.id === targetTab ? 'block' : 'none';
            });
        });
    });

    // --- 自訂互動卡片相關函式 ---

    // 渲染所有自訂互動卡片
    function renderCards(cards = []) {
        cardContainer.innerHTML = ''; // 清空容器
        cards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'interaction-card';
            cardElement.setAttribute('data-index', index);
            
            // 預設值處理
            const settings = card.settings || {};
            const toleranceMin = settings.toleranceRange ? settings.toleranceRange.min : 10;
            const toleranceMax = settings.toleranceRange ? settings.toleranceRange.max : 25;
            const speedMin = settings.speedRange ? settings.speedRange.min : 120;
            const speedMax = settings.speedRange ? settings.speedRange.max : 360;
            const reactionMin = settings.reactionTimeRange ? settings.reactionTimeRange.min : 300;
            const reactionMax = settings.reactionTimeRange ? settings.reactionTimeRange.max : 2000;
            const cycles = settings.cycleCount || 1;
            const urls = card.urls ? card.urls.join('\n') : '';

            cardElement.innerHTML = `
                <button class="btn-delete-x">&times;</button>
                <label>觸發網址 (每行一個)</label>
                <textarea class="card-url" placeholder="https://www.example.com/page1&#10;https://www.example.com/page2">${urls}</textarea>
                
                <label>觸發難度</label>
                <select class="card-difficulty-type">
                    <option value="easy" ${card.difficultyType === 'easy' ? 'selected' : ''}>簡單</option>
                    <option value="custom" ${card.difficultyType === 'custom' ? 'selected' : ''}>自訂</option>
                </select>

                <div class="custom-settings" style="display: ${card.difficultyType === 'custom' ? 'block' : 'none'};">
                    <div class="settings-grid">
                        <div class="grid-item">
                            <label>循環次數</label>
                            <input type="number" class="card-cycles" value="${cycles}" min="1">
                        </div>
                        <div class="grid-item">
                            <label>驗證區間 (度)</label>
                            <div class="min-max-group">
                                <input type="number" class="card-tolerance-min" value="${toleranceMin}" placeholder="Min">
                                <span>-</span>
                                <input type="number" class="card-tolerance-max" value="${toleranceMax}" placeholder="Max">
                            </div>
                        </div>
                        <div class="grid-item">
                            <label>指針速度 (度/秒)</label>
                            <div class="min-max-group">
                                 <input type="number" class="card-speed-min" value="${speedMin}" placeholder="Min">
                                 <span>-</span>
                                 <input type="number" class="card-speed-max" value="${speedMax}" placeholder="Max">
                            </div>
                        </div>
                        <div class="grid-item">
                            <label>反應區間 (ms)</label>
                            <div class="min-max-group">
                                 <input type="number" class="card-reaction-min" value="${reactionMin}" placeholder="Min">
                                 <span>-</span>
                                 <input type="number" class="card-reaction-max" value="${reactionMax}" placeholder="Max">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            cardContainer.appendChild(cardElement);
        });

        // 為新生成的元素綁定事件
        bindCardEvents();
    }

    // 為卡片內的元素綁定事件
    function bindCardEvents() {
        // 難度選擇下拉選單
        document.querySelectorAll('.card-difficulty-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const customSettingsDiv = e.target.closest('.interaction-card').querySelector('.custom-settings');
                customSettingsDiv.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        });

        // 刪除按鈕
        document.querySelectorAll('.btn-delete-x').forEach(button => {
            button.addEventListener('click', (e) => {
                const cardIndex = e.target.closest('.interaction-card').getAttribute('data-index');
                deleteCard(parseInt(cardIndex, 10));
            });
        });
    }

    // 新增卡片並立即儲存
    function addCard() {
        chrome.storage.sync.get({ customInteractions: [] }, (items) => {
            const newCards = [...items.customInteractions, { urls: [], difficultyType: 'easy' }];
            // 立即儲存新增的空卡片
            chrome.storage.sync.set({ customInteractions: newCards }, () => {
                renderCards(newCards);
            });
        });
    }

    // 刪除卡片
    function deleteCard(indexToDelete) {
        chrome.storage.sync.get({ customInteractions: [] }, (items) => {
            const newCards = items.customInteractions.filter((_, index) => index !== indexToDelete);
            // 儲存刪除後的狀態並重新渲染
            chrome.storage.sync.set({ customInteractions: newCards }, () => {
                renderCards(newCards);
            });
        });
    }

    // --- 主要儲存與讀取邏輯 ---

    // 儲存所有設定
    function saveOptions() {
        // 1. 儲存網站封鎖列表和全域難度
        const sitesText = blockedSitesTextarea.value;
        const sitesArray = sitesText.split('\n').filter(site => site.trim() !== '');
        const selectedDifficulty = difficultySelect.value;

        // 2. 儲存自訂互動卡片
        const customInteractions = [];
        document.querySelectorAll('.interaction-card').forEach(cardElement => {
            const urlsText = cardElement.querySelector('.card-url').value;
            const urls = urlsText.split('\n').filter(url => url.trim() !== '');
            const difficultyType = cardElement.querySelector('.card-difficulty-type').value;
            
            const cardData = { urls, difficultyType };

            if (difficultyType === 'custom') {
                cardData.settings = {
                    cycleCount: parseInt(cardElement.querySelector('.card-cycles').value, 10),
                    toleranceRange: {
                        min: parseFloat(cardElement.querySelector('.card-tolerance-min').value),
                        max: parseFloat(cardElement.querySelector('.card-tolerance-max').value)
                    },
                    speedRange: {
                        min: parseFloat(cardElement.querySelector('.card-speed-min').value),
                        max: parseFloat(cardElement.querySelector('.card-speed-max').value)
                    },
                    reactionTimeRange: {
                        min: parseInt(cardElement.querySelector('.card-reaction-min').value, 10),
                        max: parseInt(cardElement.querySelector('.card-reaction-max').value, 10)
                    }
                };
            }
            if (urls.length > 0) { // 只儲存有填寫網址的卡片
                customInteractions.push(cardData);
            }
        });

        // 3. 將所有設定一次性存入 storage
        chrome.storage.sync.set({ 
            blockedSites: sitesArray,
            difficulty: selectedDifficulty,
            customInteractions: customInteractions
        }, () => {
            statusDiv.textContent = '所有設定已儲存！';
            setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        });
    }

    // 讀取並還原所有設定
    function restoreOptions() {
        chrome.storage.sync.get({ 
            blockedSites: [],
            difficulty: 'hard',
            customInteractions: []
        }, (items) => {
            // 還原網站封鎖列表和難度
            blockedSitesTextarea.value = items.blockedSites.join('\n');
            difficultySelect.value = items.difficulty;

            // 渲染自訂互動卡片
            renderCards(items.customInteractions);
        });
    }

    // 頁面載入時執行
    restoreOptions();
});
