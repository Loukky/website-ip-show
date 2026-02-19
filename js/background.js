var ajaxGet = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onerror = function(e){
        callback({ ret:-1, msg:"Network Error" });
    };
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            var responseData;
            var text = xhr.responseText.trim();
            try {
                if (text.indexOf('{') === 0 || text.indexOf('[') === 0) {
                    responseData = JSON.parse(text);
                } else {
                    responseData = text; 
                }
            } catch (e) {
                responseData = text; 
            }
            callback(responseData);
        }
    };
    xhr.send();
};

var isIping = true;
var tabsIPMap = {};
var tabsDomainMap = {};
var clientIP = '';
var tabDataCache = {};
var lang = navigator.language;

// 获取本机 IP
var initClientIP = function() {
    isIping = true;
    ajaxGet("https://geoip.loukky.com/myip.php", function(res) {
        clientIP = (typeof res === 'string') ? res.trim() : (res.ip || "");
        isIping = false;
    });
};
initClientIP();

// 核心修复 1: 渲染函数补齐
var renderIcon = function(info, tabId){
    if (!info || tabId == null || tabId < 0) return;
    
    // 构造 Title：info.location 包含了国家城市等完整信息
    var title = info.location;
    
    if (lang.indexOf('zh') > -1) {
        chrome.browserAction.setTitle({title: "当前网站IP：" + title, tabId: tabId});
    } else {
        chrome.browserAction.setTitle({title: "Site IP: " + title, tabId: tabId});
    }
    
    // 设置图标：优先使用 code2 转大写匹配本地文件名
    if (info.code2 && info.code2.length == 2) {
        chrome.browserAction.setIcon({path: "icons/" + info.code2.toUpperCase() + ".png", tabId: tabId});
    } else {
        chrome.browserAction.setIcon({path: "Q.png", tabId: tabId});
    }
};

// 核心修复 2: 封装带等待机制的查询
var fetchIPInfo = function(e, domain, retryCount) {
    // 如果 clientIP 还没拿到且正在请求中，最多等待 3 次 (约 1.5 秒)
    if (isIping && !clientIP && retryCount < 3) {
        setTimeout(function() {
            fetchIPInfo(e, domain, retryCount + 1);
        }, 500);
        return;
    }

    var isLocalIP = (e.ip === "127.0.0.1" || e.ip === "::1" || e.ip === "0.0.0.0");
    var url = "https://geoip.loukky.com/ip.php?";
    
    if (e.ip && e.ip.length > 0 && !isLocalIP) {
        url += "ip=" + encodeURIComponent(e.ip);
    } else if (domain) {
        url += "ip=" + encodeURIComponent(domain);
    }
    
    // 此时不论有没有，只要拿到了就带上 ecs
    if (clientIP) {
        url += "&ecs=" + encodeURIComponent(clientIP);
    }

    ajaxGet(url, function(info){
        if (info.status === 'success') {
            tabDataCache[e.tabId] = info; // 以 tabId 为 Key 存储
            renderIcon(info, e.tabId);    // 显式传入 tabId
            chrome.browserAction.enable(e.tabId);
        } 
    });
};

chrome.webRequest.onCompleted.addListener(function(e) {
    if (e.tabId === -1) return;
    
    var domainMatch = e.url.match(/:\/\/(.*?)\//);
    var domain = domainMatch ? domainMatch[1] : "";
    
    tabsDomainMap[e.tabId] = domain;
    tabsIPMap[e.tabId] = e.ip;

    fetchIPInfo(e, domain, 0); // 发起带等待机制的查询

}, {
    urls: ["http://*/*", "https://*/*"],
    types: ["main_frame"]
});

// 标签切换修复
chrome.tabs.onActivated.addListener(function(activeInfo) {
    var tid = activeInfo.tabId;
    if (tabDataCache[tid]) {
        renderIcon(tabDataCache[tid], tid);
        chrome.browserAction.enable(tid);
    } else {
        // 如果没有缓存，可能还在加载，先设为默认
        chrome.browserAction.setIcon({path: "images/icon_gray_38.png", tabId: tid});
    }
});

// 资源释放
chrome.tabs.onRemoved.addListener(function(tabId) {
    delete tabsIPMap[tabId];
    delete tabsDomainMap[tabId];
    delete tabDataCache[tabId];
});

// 初始状态
chrome.tabs.onCreated.addListener(function(tab){
    chrome.browserAction.disable(tab.tabId);
    chrome.browserAction.setIcon({path:"images/icon_gray_38.png", tabId: tab.tabId});
});

chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.browserAction.setPopup({popup:"popup.html"});
});