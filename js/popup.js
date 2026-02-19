var queryIp = '';
var queryDomain = '';
var clientIP = '';
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
var refreshClientIP = function(callback) {
    var year = new Date().getFullYear();
    if (year < 2019) year = 2019;
    T('since_year').innerHTML = year;

    ajaxGet('https://geoip.loukky.com/ip.php', function(info) {
        if (info.status === 'success') {
            clientIP = info.ip;
            T('client_ip').innerHTML = info.ip + ' ' + info.location;
        } else {
            T('client_ip').innerHTML = '获取失败';
        }

        // 拿到 clientIP 后触发回调
        if (callback) callback();
    });
};

// 加载指定 IP 或域名信息
var load = function(ip, domain) {
    var url = "https://geoip.loukky.com/ip.php?";
    var isLocalIP = (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0");

    if (ip && ip !== "" && !isLocalIP) {
        url += "ip=" + encodeURIComponent(ip);
    } else if (domain && domain !== "") {
        url += "ip=" + encodeURIComponent(domain);
        if (clientIP) {
            url += "&ecs=" + encodeURIComponent(clientIP);
        }
    } else {
        return;
    }

    ajaxGet(url, function(info) {
        if (info.status === 'success') {
            // 结构映射
            var data = {
                ip: info.ip,
                country: info.country,
                province: info.province,
                city: info.city,
                isp: info.isp,
                asn: ["AS" + info.asn],
                ports: [],
                icon: info.icon
            };
            render(data);
        } else {
            T('load').style.display = '';
        }
    });
};


// 渲染到页面
var render = function(info){
    T('show_ip').innerHTML = info.ip;
    T('location').innerHTML = [info.country, info.province, info.city].filter(Boolean).join(" ");
    T('isp').innerHTML = info.isp || '';
    T('asn').innerHTML = info.asn.join("<br/>");
    T('ports').innerHTML = info.ports.join(" ");
};

// 刷新当前活动标签 IP / 域名
var refresh = function() {

    // 如果 clientIP 还没拿到，什么都不做
    if (!clientIP) return;
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
        load(queryIp, queryDomain);
    } else {
        if (refreshCount >= maxRefresh) {
            clearInterval(refreshTimerId);
            return;
        }
        refreshCount++;
    }
};


// 初始化
var init = function() {
    $('.ips').delegate('dd', 'click', function(){
        var ip = $(this).text();
        if (!!background.dnsData[queryIp]) {
            $('.ips dd').removeClass('active');
            $(this).addClass('active');
            $.each(background.dnsData[queryIp], function(k, v){
                if (v.ip == ip) {
                    render(v);
                }
            })
        }
    });

    refreshClientIP(function() {
        // clientIP 已经拿到后才开始刷新标签信息
        chrome.tabs.query({ active: true, windowId: chrome.windows.WINDOW_ID_CURRENT }, function(tabs) {
            if (tabs.length > 0) {
                activeTabId = tabs[0].id;
                refreshTimerId = setInterval(refresh, 500);
                refresh();
            }
        });
    });

    if (language.indexOf('CN') > -1) {
        chrome.browserAction.setTitle({
            title: "网站IP数据信息 Powered by Loukky GeoIP"
        });
    } else {
        chrome.browserAction.setTitle({
            title: "WebSite IP Information Powered by Loukky GeoIP"
        });
    }

    chrome.tabs.query({ active: true, windowId: chrome.windows.WINDOW_ID_CURRENT }, function(tabs) {
        if (tabs.length > 0) {
            activeTabId = tabs[0].id;
            refreshTimerId = setInterval(refresh, 500);
            refresh();
        }
    });

    $('#copyright').on('click', function(){
        chrome.tabs.create({ url: "https://geoip.loukky.com", selected: true });
    });

    c = new ClipboardJS("#copy");
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
