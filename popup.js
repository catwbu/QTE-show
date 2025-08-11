/**
 * popup.js
 * 處理擴充功能彈出視窗的互動。
 */
document.addEventListener('DOMContentLoaded', function() {
  const trainingButton = document.getElementById('start-training-btn');
  const optionsButton = document.getElementById('options-btn');

  // 為 "訓練模式" 按鈕添加點擊事件
  if (trainingButton) {
    trainingButton.addEventListener('click', function() {
      chrome.tabs.create({ url: 'QTE.html' });
    });
  }

  // 為 "網站封鎖設定" 按鈕添加點擊事件
  if (optionsButton) {
    optionsButton.addEventListener('click', function() {
      // 使用 Chrome API 打開設定頁面
      chrome.runtime.openOptionsPage();
    });
  }
});
