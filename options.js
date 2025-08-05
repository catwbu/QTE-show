const domainsTextarea = document.getElementById('domains');
const saveButton = document.getElementById('save');
const statusDiv = document.getElementById('status');

// 載入已儲存的設定
function loadOptions() {
    chrome.storage.sync.get(['blockedDomains'], (data) => {
        if (data.blockedDomains) {
            domainsTextarea.value = data.blockedDomains.join('\n');
        }
    });
}

// 儲存設定
function saveOptions() {
    const domains = domainsTextarea.value.split('\n').filter(domain => domain.trim() !== '');
    chrome.storage.sync.set({ blockedDomains: domains }, () => {
        statusDiv.textContent = '設定已儲存！';
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 2000);
    });
}

document.addEventListener('DOMContentLoaded', loadOptions);
saveButton.addEventListener('click', saveOptions);