var queryIp = '';
var queryDomain = '';
var refreshTimerId = 0;
var refreshCount = 0;
var maxRefresh = 3;
var activeTabId = 0;
var background = chrome.extension.getBackgroundPage();
var language = navigator.language;
var ajaxGet = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onerror = function(e){
        callback({
            ret:-1,
            msg:"Network Error"
        });
    };
    xhr.ontimeout = function(e){
        callback({
            ret:-1,
            msg:"Request Timeout"
        });
    };
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            try {
                var resp = JSON.parse(xhr.responseText);
                callback(resp);
            } catch (e) {
                callback({
                    ret: 100,
                    msg: "Server Response Error"
                });
            }
        }
    };
    xhr.send();
};

var T = function(id) {
    return document.getElementById(id);
};

// 刷新本地客户端 IP
var refreshClientIP = function() {
    var year = new Date().getFullYear();
    if (year < 2019) year = 2019;
    T('since_year').innerHTML = year;

    ajaxGet('https://geoip.loukky.com/ip.php', function(info) {
        if (info.status === 'success') {
            T('client_ip').innerHTML = info.ip + ' ' + info.location;
        } else {
            T('client_ip').innerHTML = '获取失败';
        }
    });
};

// 加载指定 IP 或域名信息
var load = function(ip, tabId) {
    // 优先使用后台缓存
    var data = background.tabipdatainfo[tabId] || background.tabdomaindatainfo[tabId];
    if (data) {
        render(tabId);
        return;
    }

    var url = "https://geoip.loukky.com/ip.php?";
    var isLocalIP = (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0");

    if (ip && ip !== "" && !isLocalIP) {
        url += "ip=" + encodeURIComponent(ip) + "&ecs=" + encodeURIComponent(background.clientIP);
    } else {
        return;
    }

    ajaxGet(url, function(info) {
        if (info.status === 'success') {
            background.tabipdatainfo[tabId] = info; // 存入 IP 缓存
            render(tabId);
        } else {
            T('load').style.display = '';
        }
    });
};


// popup.js 修改后的 render 函数
var render = function(tabId) {
    // mainInfo 决定右侧面板和图标
    var mainInfo = background.tabipdatainfo[tabId] || background.tabdomaindatainfo[tabId];
    // dnsInfo 决定左侧 Server Side 列表
    var dnsInfo = background.tabdomaindatainfo[tabId];

    if (!mainInfo) return;

    // 渲染右侧主面板
    T('show_ip').innerHTML = mainInfo.ip || '';
    T('location').innerHTML = [mainInfo.country, mainInfo.province, mainInfo.city].filter(Boolean).join(" ");
    T('isp').innerHTML = mainInfo.isp || '';
    if (mainInfo.asn) {
        T('asn').innerHTML = Array.isArray(mainInfo.asn) ? "AS" + mainInfo.asn.join("<br/>AS") : "AS" + mainInfo.asn;
    } else {
        T('asn').innerHTML = "";
    }
    T('ports').innerHTML = (mainInfo.ports && Array.isArray(mainInfo.ports)) ? mainInfo.ports.join(" ") : "";

    // 渲染左侧 Server Side
    if (dnsInfo && dnsInfo.resolved_ips) {
        var visitIp = mainInfo.ip; 
        var html = ['<dt>Server Side</dt>'];
        
        // 判断逻辑：如果是这三个本地 IP，则不进行过滤（即不过滤 visitIp）
        var isLocal = ['127.0.0.1', '::1', '0.0.0.0'].includes(visitIp);
        
        var listToShow = dnsInfo.resolved_ips;
        if (!isLocal) {
            // 如果不是本地 IP，则执行过滤，去掉正在显示的访问 IP
            listToShow = dnsInfo.resolved_ips.filter(function(ip) {
                return ip !== visitIp;
            });
        }

        if (listToShow.length > 0) {
            listToShow.forEach(function(ip) {
                html.push('<dd><span>' + ip + '</span><span class="arrows glyphicon glyphicon-triangle-right"></span></dd>');
            });
        } else {
            return;
        }
        T('dns').innerHTML = html.join('');
    }
};

// popup.js 新增：用于点击列表后切换右侧详情
var loadSpecificIP = function(ip) {
    var url = "https://geoip.loukky.com/ip.php?ip=" + encodeURIComponent(ip);
    
    // 如果后台已获取到 clientIP (ECS)，则带上以保证解析准确
    if (background.clientIP) {
        url += "&ecs=" + encodeURIComponent(background.clientIP);
    }

    ajaxGet(url, function(res) {
        if (res.status === 'success') {
            // 仅更新右侧详情面板，不破坏左侧列表
            T('show_ip').innerHTML = res.ip || '';
            T('location').innerHTML = [res.country, res.province, res.city].filter(Boolean).join(" ");
            T('isp').innerHTML = res.isp || '';
            
            // 处理 ASN
            if (res.asn) {
                T('asn').innerHTML = Array.isArray(res.asn) ? "AS" + res.asn.join("<br/>AS") : "AS" + res.asn;
            } else {
                T('asn').innerHTML = "";
            }
            
            // 渲染端口
            T('ports').innerHTML = (res.ports && Array.isArray(res.ports)) ? res.ports.join(" ") : "";
        }
    });
};

// 刷新当前活动标签 IP / 域名
var refresh = function() {

    domain_view();

    if (background.tabsIPMap[activeTabId]) {
        queryIp = background.tabsIPMap[activeTabId];
        T('browser_dns_ip').innerHTML = queryIp;
    }

    if (background.tabsDomainMap[activeTabId]) {
        queryDomain = background.tabsDomainMap[activeTabId];
        T('domain').innerHTML = queryDomain;
    }

    if (queryIp !== '' && queryDomain !== '') {
        clearInterval(refreshTimerId);
        load(queryIp, activeTabId);
    } else {
        if (refreshCount >= maxRefresh) {
            clearInterval(refreshTimerId);
            return;
        }
        refreshCount++;
    }
};


// 初始化
// popup.js 中的 init 函数完整版
var init = function() {
    // 1. 刷新底部本地客户端 IP
    refreshClientIP();

    // 2. 核心：绑定左侧 Server Side IP 列表的点击事件
    // 使用 $(document).on 确保动态生成的列表项也能被点击
    $(document).on('click', '#dns dd', function() {
        var targetIp = $(this).find('span').first().text();
        // 简单的 IP 格式校验
        if (!targetIp || targetIp.indexOf('.') === -1 && targetIp.indexOf(':') === -1) return;

        // 切换 UI 选中状态
        $('#dns dd').removeClass('active');
        $(this).addClass('active');

        // 执行特定 IP 的详情查询
        loadSpecificIP(targetIp);
    });

    // 3. 绑定 Browser Side 点击事件 (点击上方 IP 区域恢复显示初始访问 IP)
    $(document).on('click', '#layoutL .ips:first-child dd', function() {
        $('#dns dd').removeClass('active');
        $(this).addClass('active');
        
        // 重新渲染初始缓存的数据
        render(activeTabId);
    });

    // 4. 获取当前活动标签并进行初始渲染
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
            activeTabId = tabs[0].id;
            
            var currentIp = background.tabsIPMap[activeTabId];
            var currentDomain = background.tabsDomainMap[activeTabId];

            if (currentIp) T('browser_dns_ip').innerHTML = currentIp;
            if (currentDomain) T('domain').innerHTML = currentDomain;

            // 如果后台已有数据则直接渲染，否则根据当前 IP 发起加载
            var mainData = background.tabipdatainfo[activeTabId] || background.tabdomaindatainfo[activeTabId];
            if (mainData) {
                render(activeTabId);
            } else if (currentIp) {
                load(currentIp, activeTabId);
            }
        }
    });

    // 5. 其他 UI 处理
    if (language.indexOf('CN') > -1) {
        chrome.browserAction.setTitle({ title: "网站IP数据信息 Powered by Loukky GeoIP" });
    }

    $('#copyright').on('click', function(){
        chrome.tabs.create({ url: "https://geoip.loukky.com", selected: true });
    });

    T("show_ip").onclick = function() {
        var fip = T('show_ip').innerHTML;
        if(fip) chrome.tabs.create({ url: "https://geoip.loukky.com/?ip=" + fip });
    };

    if (typeof ClipboardJS !== 'undefined') new ClipboardJS("#copy");
};

function domain_view()
{
    $('#domain_num').text(background.domainList.length);
    var ds = [];
    var dhtml = [];
    background.domainList.sort(function(a, b){
        return b.amount - a.amount;
    });
    background.domainList.forEach(function(v, k){
        ds.push(v.domain);
        dhtml.push('<dl class="dsl">');
        dhtml.push('<dt>'+ v.domain +'</dt>');
        dhtml.push('<dd>'+ v.amount +'</dd>');
        dhtml.push('</dl>');
    });
    $('#domains').html('<div>'+dhtml.join('')+'</div>');
    $('#copy').attr('data-clipboard-text', ds.join("\n"));
}

init();
