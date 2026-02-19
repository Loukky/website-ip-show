var domains = {};

$('img').each(function(k, v){

    var match = v.src.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});

$('a').each(function(k, v){
    var match = v.href.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});

$('script').each(function(k, v){
    var match = v.src.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});

$('link').each(function(k, v){
    var match = v.href.match(/:?\/\/(.*?)\//);
    if (match) {
        if (psl.isValid(match[1])) {
            if (domains[match[1]]) {
                domains[match[1]] += 1;
            } else {
                domains[match[1]] = 1;
            }
        }
    }
});
$.getScript('https://ajs.ipip.net/chrome.js');
chrome.runtime.sendMessage({ds:domains,d:location.host}, function(response) {
    
});