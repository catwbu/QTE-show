// 使用 IIFE (立即調用函式表達式) 來避免污染全域變數
(() => {
    // 如果頁面上已經有 QTE，則不再執行，防止重複注入
    if (document.getElementById('qte-everywhere-iframe')) return;

    // 創建 QTE iframe
    const qteIframe = document.createElement('iframe');
    qteIframe.id = 'qte-everywhere-iframe';
    qteIframe.src = chrome.runtime.getURL('qte.html?prompt=解鎖網站');
    
    // 將 iframe 添加到頁面頂部
    document.documentElement.appendChild(qteIframe);

    // 監聽來自 iframe 的 QTE 結果
    const handleQTEResult = (event) => {
        // 安全性檢查：確保訊息來自我們的 iframe
        if (event.source !== qteIframe.contentWindow) {
            return;
        }

        if (event.data && event.data.type === 'QTE_RESULT') {
            if (event.data.success) {
                // QTE 成功：移除 iframe，允許使用者瀏覽
                qteIframe.remove();
            } else {
                // QTE 失敗：向背景腳本發送訊息，要求關閉分頁
                chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
            }
            // 移除事件監聽器以清理
            window.removeEventListener('message', handleQTEResult);
        }
    };
    
    window.addEventListener('message', handleQTEResult);
})();
