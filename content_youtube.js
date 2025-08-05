let qteIframe = null;
let currentAdVideo = null;
let qteIsActive = false;

// 創建並顯示 QTE iframe
const showQTE = (prompt) => {
    if (qteIsActive) return; // 如果 QTE 已經在執行中，則不重複觸發
    qteIsActive = true;

    // 暫停廣告影片
    if (currentAdVideo) {
        currentAdVideo.pause();
    }

    qteIframe = document.createElement('iframe');
    qteIframe.id = 'qte-everywhere-iframe';
    // 將提示文字作為 URL 參數傳遞給 qte.html
    qteIframe.src = chrome.runtime.getURL(`qte.html?prompt=${encodeURIComponent(prompt)}`);
    document.body.appendChild(qteIframe);
};

// 移除 QTE iframe
const removeQTE = () => {
    if (qteIframe) {
        qteIframe.remove();
        qteIframe = null;
    }
    // 延遲一小段時間後重設狀態，避免廣告元素快速變化導致重複觸發
    setTimeout(() => {
        qteIsActive = false;
        currentAdVideo = null;
    }, 500);
};

// 監聽來自 QTE iframe 的結果
window.addEventListener('message', (event) => {
    // 安全性檢查：確保訊息來自我們的 iframe
    if (event.source !== qteIframe.contentWindow) {
        return;
    }

    if (event.data && event.data.type === 'QTE_RESULT') {
        if (event.data.success) {
            // QTE 成功：加速廣告並點擊跳過
            if (currentAdVideo) {
                currentAdVideo.muted = true;
                currentAdVideo.playbackRate = 12; // 按照要求設定為 12 倍速
                currentAdVideo.play(); // 確保影片在加速後繼續播放
            }
            // 持續嘗試點擊跳過按鈕
            const clickSkipButton = () => {
                const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, [id^="skip-button:"]');
                let clicked = false;
                skipButtons.forEach(button => {
                    if (button && typeof button.click === 'function') {
                        button.click();
                        clicked = true;
                    }
                });
                return clicked;
            };
            // 嘗試立即點擊，如果按鈕還沒出現，則每隔一段時間再試一次
            let attempts = 0;
            const intervalId = setInterval(() => {
                if (clickSkipButton() || attempts > 20) {
                    clearInterval(intervalId);
                }
                attempts++;
            }, 100);

        } else {
            // QTE 失敗：減速廣告
            if (currentAdVideo) {
                currentAdVideo.playbackRate = 0.5; // 按照要求設定為 0.5 倍速
                currentAdVideo.play(); // 確保影片在減速後繼續播放
            }
        }
        // 移除 QTE 介面
        removeQTE();
    }
});

// 使用 MutationObserver 監測頁面變化以偵測廣告
const adObserver = new MutationObserver((mutations) => {
    // 尋找影片廣告容器
    const adShowingElement = document.querySelector('.ad-showing');
    if (adShowingElement && !qteIsActive) {
        const adVideo = adShowingElement.querySelector('video.html5-main-video');
        // 確保找到影片元素且不是上一個處理過的廣告
        if (adVideo && adVideo !== currentAdVideo) {
            currentAdVideo = adVideo;
            showQTE('跳過廣告');
        }
    }

    // 沿用 yt_ads_slayer 的邏輯來隱藏靜態廣告版位
    const staticAdSelectors = [
      "ytd-display-ad-renderer", "ytd-promoted-sparkles-web-renderer",
      "ytd-in-feed-ad-layout-renderer", 'ytd-ad-slot-renderer',
      '.video-ads', 'ytd-banner-promo-renderer', 'ytd-player-legacy-desktop-watch-ads-renderer'
    ];
    document.querySelectorAll(staticAdSelectors.join(', ')).forEach(adElement => {
      const container = adElement.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-ad-inline-playback-renderer');
      const elementToHide = container || adElement;
      if (elementToHide.style.display !== 'none') {
        elementToHide.style.display = 'none';
      }
    });
});

// 啟動觀察器，監聽整個文件的子節點和子樹變化
adObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
});
