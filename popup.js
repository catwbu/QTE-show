document.addEventListener('DOMContentLoaded', () => {
    const domainInput = document.getElementById('domain-input');
    const addBtn = document.getElementById('add-domain-btn');
    const domainList = document.getElementById('domain-list');
    const debugBtn = document.getElementById('debug-btn');

    // 從存儲中讀取並顯示已封鎖的域名
    const loadDomains = () => {
        chrome.storage.sync.get({ blockedDomains: [] }, (data) => {
            domainList.innerHTML = ''; // 清空列表
            data.blockedDomains.forEach(domain => {
                const li = document.createElement('li');
                li.className = 'domain-item';
                
                const domainText = document.createElement('span');
                domainText.textContent = domain;
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.textContent = '移除';
                removeBtn.title = `移除 ${domain}`;
                removeBtn.addEventListener('click', () => removeDomain(domain));
                
                li.appendChild(domainText);
                li.appendChild(removeBtn);
                domainList.appendChild(li);
            });
        });
    };

    // 新增一個域名到封鎖列表
    const addDomain = () => {
        // 簡單清理一下輸入，移除 http://, https://, www. 等
        let domain = domainInput.value.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        
        if (domain) {
            chrome.storage.sync.get({ blockedDomains: [] }, (data) => {
                const blockedDomains = data.blockedDomains;
                if (!blockedDomains.includes(domain)) {
                    blockedDomains.push(domain);
                    chrome.storage.sync.set({ blockedDomains }, () => {
                        domainInput.value = '';
                        loadDomains();
                    });
                } else {
                    // 如果域名已存在，可以給予提示
                    domainInput.style.borderColor = '#ff3d00';
                    setTimeout(() => { domainInput.style.borderColor = '#444'; }, 1500);
                }
            });
        }
    };

    // 從封鎖列表中移除一個域名
    const removeDomain = (domainToRemove) => {
        chrome.storage.sync.get({ blockedDomains: [] }, (data) => {
            const blockedDomains = data.blockedDomains.filter(d => d !== domainToRemove);
            chrome.storage.sync.set({ blockedDomains }, loadDomains);
        });
    };

    // 調試按鈕：在新分頁中開啟 QTE 遊戲
    debugBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('qte.html') });
    });

    // 綁定事件
    addBtn.addEventListener('click', addDomain);
    domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addDomain();
        }
    });

    // 初始載入
    loadDomains();
});
