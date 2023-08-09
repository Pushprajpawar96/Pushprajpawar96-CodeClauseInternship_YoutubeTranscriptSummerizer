const DEFAULT_SETTINGS = {
    'timecodes': [0], // Stores only timecodes
    'phrases': ['Nothing yet'], // Stores only text (must have the same size as timecodes)
    'temporary': '', // Formatted text
    'temporaryLink': '', // Formatted text location URL
    'site': 'a' // Options a, b, c
}

var subtitleLink = '',
    [timecode, phrase] = [[], []]; // Initialize arrays for storing timecodes and phrases.

// Initialize default value when the extension is first used or refreshed.
chrome.runtime.onInstalled.addListener(() => { chrome.storage.local.set({ key: DEFAULT_SETTINGS }); });

// onBeforeNavigate used to wake service worker from sleep.
chrome.webNavigation.onBeforeNavigate.addListener(function () {
    // Look through network traffic requests to find the YouTube API request for timed text (subtitles).
    chrome.webRequest.onBeforeRequest.addListener(
        function (details) {
            if (details.url.toString().includes('https://www.youtube.com/api/timedtext')) {
                // Prevent usage of the same link as it may lead to overload.
                if (subtitleLink.toString() === details.url.toString()) { return; }
                subtitleLink = details.url.toString();
                requestJSON(subtitleLink);
            }
        }, { urls: ["<all_urls>"] }, ['requestBody']
    );
});

// Request subtitles in JSON format.
const requestJSON = async (jsonUrl) => {
    const response = await fetch(jsonUrl),
        json = await response.text(),
        jsonEvent = JSON.parse(json).events;

    start = performance.now();
    // Read JSON object, extract text with timecodes.
    for (_ in jsonEvent) { loopThrough(jsonEvent[_]); }
    end = performance.now();

    // Save acquired data to local storage.
    chrome.storage.local.get(['key'], (result) => {
        chrome.storage.local.set({ key: { 'timecodes': timecode, 'phrases': phrase, "site": result.key.site } }, () => {
            [timecode, phrase] = [[], []]; // Clear variable values after saving.
        });
    });

    console.log('[PERFORMANCE TIME] is ' + Math.ceil((end - start) / 1000) + ' sec');
}

// Extracts timecodes and text from the JSON file.
function loopThrough(obj) {
    let sentence = '';
    for (i in obj) {
        if (Object.keys(obj[i]).length > 0 && typeof obj[i] !== 'string') {
            if (i === 'segs' && Object.keys(obj[i]).length > 0) {
                if (Object.keys(obj[i]).length === 1) {
                    if (obj[i][0].utf8 === '\n') { return; }
                    phrase.push(obj[i][0].utf8.replaceAll('\n', ' '));
                    timecode.push(obj.tStartMs);
                } else {
                    for (let l = 0; l < Object.keys(obj[i]).length; l++) { sentence += obj[i][l].utf8; }
                    phrase.push(sentence.replaceAll('\n', ' '));
                    timecode.push(obj.tStartMs);
                }
            }
        }
    }
}

// Create a context menu option to reset settings to default.
chrome.contextMenus.removeAll();
chrome.contextMenus.create({
    id: 'YS_ID',
    title: "Reset to default",
    contexts: ["action"]
});

// Event listener for the context menu option.
chrome.contextMenus.onClicked.addListener((info) => {
    const { menuItemId } = info;
    if (menuItemId === 'YS_ID') {
        chrome.storage.local.set({ key: DEFAULT_SETTINGS }); // Reset settings to default.
    }
});
