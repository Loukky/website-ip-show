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

var tabsIPMap = {};
var tabsDomainMap = {};
var clientIP = '';
var lang = navigator.language;
var tabipdatainfo = {};
var tabdomaindatainfo = {};
var tabDomains = {};

// 获取本机 IP
function initClientIP() {
    ajaxGet("https://geoip.loukky.com/myip.php", function (res) {
        clientIP = (typeof res === 'string') ? res.trim() : (res.ip || "");
    });
}
initClientIP();

var renderIcon = function(tabId){
    if (tabId == null || tabId < 0) return;
    var info = tabipdatainfo[tabId] || tabdomaindatainfo[tabId];
    if (!info) return;
    
    // 构造 Title：info.location 包含了国家城市等完整信息
    var title = info.location;
    
    if (lang.indexOf('zh') > -1) {
        chrome.browserAction.setTitle({title: "当前网站IP：" + title, tabId: tabId});
    } else {
        chrome.browserAction.setTitle({title: "Site IP: " + title, tabId: tabId});
    }
    
    // 设置图标：优先使用 code2 转大写匹配本地文件名
    if (info.code2 && info.code2 !== "zz" && info.code2.length == 2) {
        chrome.browserAction.setIcon({path: "icons/" + info.code2.toUpperCase() + ".png", tabId: tabId});
    } else {
        chrome.browserAction.setIcon({path: "Q.png", tabId: tabId});
    }
};

var fetchIPInfo = function(e, domain, retryCount, reinitCount) {
    reinitCount = reinitCount || 0;
    // 如果 clientIP 还没拿到
    if (!clientIP) {
        if (retryCount < 5) {
            // 正常的短时间轮询重试
            setTimeout(function() {
                fetchIPInfo(e, domain, retryCount + 1, reinitCount);
            }, 300);
        } else {
            if (reinitCount < 2) {
                console.log("ClientIP 获取持续失败，尝试重新初始化 initClientIP...");
                initClientIP();
                setTimeout(function() {
                    fetchIPInfo(e, domain, 0, reinitCount + 1);
                }, 1000);
            } else {
                console.warn("ClientIP 获取最终失败，放弃重试 tabId:", e.tabId);
            }
        }
        return;
    }

    const baseUrl = "https://geoip.loukky.com/ip.php?";
    const ecsPart = `&ecs=${encodeURIComponent(clientIP)}`;
    // 查询 IP
    if (e.ip && !['127.0.0.1', '::1', '0.0.0.0'].includes(e.ip)) {
        const ipUrl = `${baseUrl}ip=${encodeURIComponent(e.ip)}`;
        ajaxGet(ipUrl, data => {
            if (data?.status === 'success') {
                tabipdatainfo[e.tabId] = data;
                renderIcon(e.tabId);
                chrome.browserAction.enable(e.tabId);
            }
        });
    }

    // 查询域名
    if (domain) {
        const domainUrl = `${baseUrl}ip=${encodeURIComponent(domain)}${ecsPart}`;
        ajaxGet(domainUrl, data => {
            if (data?.status === 'success') {
                tabdomaindatainfo[e.tabId] = data;
                if (!tabipdatainfo[e.tabId]) {
                    renderIcon(e.tabId);
                    chrome.browserAction.enable(e.tabId);
                }
            }
        });
    }
};

chrome.webRequest.onCompleted.addListener(function(e) {
    if (e.tabId === -1) return;
    
    var domainMatch = e.url.match(/:\/\/(.*?)\//);
    var domain = domainMatch ? domainMatch[1] : "";
    
    tabsDomainMap[e.tabId] = domain;
    tabsIPMap[e.tabId] = e.ip;

    fetchIPInfo(e, domain, 0, 0);

}, {
    urls: ["http://*/*", "https://*/*"],
    types: ["main_frame"]
});

chrome.runtime.onMessage.addListener(function(msg, sender) {
    if (!sender.tab || sender.tab.id === undefined) return;

    if (msg.ds) {
        var tid = sender.tab.id;

        if (!tabDomains[tid]) {
            tabDomains[tid] = {};
        }

        var current = tabDomains[tid];
        var incoming = msg.ds;

        Object.keys(incoming).forEach(function(domain) {
            if (current[domain]) {
                current[domain] += incoming[domain];
            } else {
                current[domain] = incoming[domain];
            }
        });
    }
});

chrome.webRequest.onBeforeRequest.addListener(function(e) {
    if (e.tabId !== -1) {
        // 请求开始，立即禁用图标并重置该 Tab 的缓存，防止旧图标残留
        chrome.browserAction.disable(e.tabId);
        chrome.browserAction.setIcon({path:"images/icon_gray_38.png", tabId: e.tabId});
        
        delete tabipdatainfo[e.tabId];
        delete tabdomaindatainfo[e.tabId];
        delete tabsIPMap[e.tabId];
        delete tabsDomainMap[e.tabId];
        delete tabDomains[e.tabId];
    }
}, {
    urls: ["http://*/*", "https://*/*"],
    types: ["main_frame"]
});

// 标签切换修复
chrome.tabs.onActivated.addListener(function(activeInfo) {
    var tid = activeInfo.tabId;

    // 优先使用 IP 查询缓存
    var data = tabipdatainfo[tid] || tabdomaindatainfo[tid];

    if (data) {
        renderIcon(tid);
        chrome.browserAction.enable(tid);
    } else {
        // 如果没有缓存，可能还在加载，先设为默认灰色图标
        chrome.browserAction.setIcon({ path: "images/icon_gray_38.png", tabId: tid });
    }
});

// 资源释放
chrome.tabs.onRemoved.addListener(function(tabId) {
    delete tabsIPMap[tabId];
    delete tabsDomainMap[tabId];
    delete tabipdatainfo[tabId];
    delete tabdomaindatainfo[tabId];
    delete tabDomains[tabId];
});

// 初始状态
chrome.tabs.onCreated.addListener(function(tab){
    chrome.browserAction.disable(tab.id);
    chrome.browserAction.setIcon({path:"images/icon_gray_38.png", tabId: tab.id});
});

// chrome.browserAction.onClicked.addListener(function(tab) {
//     chrome.browserAction.setPopup({popup:"popup.html"});
// });