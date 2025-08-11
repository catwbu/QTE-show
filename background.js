/**
 * background.js
 * 擴充功能的背景服務工作線程。
 * 負責監聽分頁更新、攔截網站，並管理已通過挑戰的分頁。
 */

// 使用 Set 來儲存已成功通過 QTE 挑戰的分頁 ID。
// 這可以防止在同一個分頁中重複觸發 QTE。
const passedTabs = new Set();

// 監聽分頁更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 確保頁面已載入完成且有 URL
  if (changeInfo.status === 'complete' && tab.url) {
    
    // 如果此分頁已通過挑戰，則直接返回，不進行任何操作
    if (passedTabs.has(tabId)) {
      return;
    }

    // 從存儲中獲取封鎖列表
    chrome.storage.sync.get(['blockedSites'], (result) => {
      const blockedSites = result.blockedSites || [];
      const currentUrl = new URL(tab.url);
      const currentDomain = currentUrl.hostname.replace('www.', '');

      // 檢查目前網域是否在封鎖列表中
      const isBlocked = blockedSites.some(blockedDomain => {
        if (typeof blockedDomain === 'string' && blockedDomain.trim() !== '') {
            return currentDomain.includes(blockedDomain.trim());
        }
        return false;
      });

      if (isBlocked) {
        // 避免在 QTE 頁面本身觸發無限重定向循環
        if (currentUrl.pathname.includes('qte_trigger.html')) {
          return;
        }

        // 將原始目標 URL 和當前 tabId 編碼後作為參數傳遞
        const targetUrl = encodeURIComponent(tab.url);
        const qtePageUrl = chrome.runtime.getURL(`qte_trigger.html?target=${targetUrl}&tabId=${tabId}`);

        // 更新分頁，重定向到 QTE 挑戰頁面
        chrome.tabs.update(tabId, { url: qtePageUrl });
      }
    });
  }
});

// 監聽來自內容腳本 (qte_trigger.js) 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 如果訊息表示 QTE 成功，則將該分頁的 ID 加入到 passedTabs 集合中
  if (message.qte === 'success' && message.tabId) {
    passedTabs.add(parseInt(message.tabId, 10));
  }
});

// 監聽分頁關閉事件，以便清理 passedTabs 集合，防止記憶體洩漏
chrome.tabs.onRemoved.addListener((tabId) => {
  if (passedTabs.has(tabId)) {
    passedTabs.delete(tabId);
  }
});
