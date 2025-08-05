document.addEventListener('DOMContentLoaded', () => {
    // 確保 qteGame 物件已由 qte_game_logic.js 初始化
    if (window.qteGame) {
        setupCommunication();
    } else {
        // 如果尚未初始化，延遲一小段時間再試一次
        setTimeout(setupCommunication, 100);
    }
});

function setupCommunication() {
    if (!window.qteGame) {
        console.error("QTE Game instance not found!");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tabId = parseInt(urlParams.get('tabId'));
    const context = urlParams.get('context');

    // 根據上下文 (context) 決定行為：是網站封鎖/廣告，還是獨立的調試模式
    if (context === 'siteBlock' || context === 'youtubeAd') {
        // 覆寫成功/失敗函數，以發送訊息給 background script
        const originalOnSuccess = window.qteGame.onSuccess;
        window.qteGame.onSuccess = function() {
            originalOnSuccess.apply(this, arguments);
            if (chrome.runtime && tabId) {
                chrome.runtime.sendMessage({ action: 'qteResult', result: 'success', tabId: tabId });
            }
        };

        const originalOnMiss = window.qteGame.onMiss;
        window.qteGame.onMiss = function() {
            originalOnMiss.apply(this, arguments);
            if (chrome.runtime && tabId) {
                chrome.runtime.sendMessage({ action: 'qteResult', result: 'failure', tabId: tabId });
            }
        };
    } else {
        // 在獨立的調試模式下，成功後自動重置遊戲
        const originalOnSuccess = window.qteGame.onSuccess;
        window.qteGame.onSuccess = function() {
            originalOnSuccess.apply(this, arguments);
            console.log("QTE Success (Debug Mode)");
            setTimeout(() => this.resetGame(), 500);
        };

         const originalOnMiss = window.qteGame.onMiss;
         window.qteGame.onMiss = function() {
            originalOnMiss.apply(this, arguments);
            console.log("QTE Miss (Debug Mode)");
        };
    }
}