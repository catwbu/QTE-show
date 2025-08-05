// 監聽分頁更新事件，用於檢查是否進入被封鎖的網站
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 確保頁面已載入完成且有 URL
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const url = new URL(tab.url);
            // 忽略 Chrome 的內部頁面和擴充功能頁面
            if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
                return;
            }

            chrome.storage.sync.get({ blockedDomains: [] }, (data) => {
                const blockedDomains = data.blockedDomains;
                // 檢查當前網站的域名是否存在於封鎖列表中
                if (blockedDomains.some(domain => url.hostname.includes(domain))) {
                    
                    // 注入 CSS 樣式
                    chrome.scripting.insertCSS({
                        target: { tabId: tabId },
                        files: ['qte_styles.css']
                    }).catch(err => console.error("CSS injection failed:", err));

                    // 注入網站封鎖的內容腳本
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content_blocker.js']
                    }).catch(err => console.error("Script injection failed:", err));
                }
            });
        } catch (e) {
            // 如果 URL 無效，則忽略
            console.log("Could not construct URL:", tab.url, e);
        }
    }
});

// 監聽來自內容腳本的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 如果收到關閉分頁的請求 (來自 QTE 失敗)
    if (message.type === 'CLOSE_TAB') {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
    }
    // 返回 true 以表示將會異步發送響應 (雖然此處沒用到)
    return true;
});
