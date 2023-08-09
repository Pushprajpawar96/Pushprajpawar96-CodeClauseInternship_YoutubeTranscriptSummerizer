// Variables for various elements in the web page
var textStore = '',
    reserve = '',
    timeout = null,
    startSummary = document.querySelector('#summaryButton'),
    updateInfo = document.querySelector('#refreshButton'),
    extensionIcon = document.querySelector('#extensionIcon'),
    automateContent = document.querySelector('#automateButton'),
    loadFull = document.querySelector('#loadFullButton'),
    intervalSplit = document.querySelector('#intervalInput'),
    intervalStats = document.querySelector('#delayLabel'),
    temporaryLink = document.querySelector('#temporaryLinkLabel'),
    subtitleLink = document.querySelector('#transcriptText'),
    formattedText = document.querySelector('#formattedText');

// Function to load information and display summarized subtitles
loadInfo();
function loadInfo(limited = true) {
    isLoading(true); // Set background to white when loading data

    // Access local storage to get stored data
    chrome.storage.local.get(['key'], (result) => {
        // Display the temporary link
        if (result.key.temporaryLink) {
            temporaryLink.innerText = result.key.temporaryLink;
            temporaryLink.href = result.key.temporaryLink;
        } else {
            temporaryLink.innerText = '?';
        }

        // Set the selected radio button based on the stored site value
        document.querySelectorAll('input[value="' + result.key.site + '"]')[0].checked = true;
        subtitleLink.innerHTML = "";
        reserve = result.key;

        // Limit to first 50 lines for performance reasons
        textLength = (limited) ? 50 : result.key.timecodes.length;
        for (var i = 0; i < textLength; i++) {
            if (!result.key.phrases[i]) { break; }
            subtitleLink.innerHTML += msToTime(result.key.timecodes[i]) + ' ' + result.key.phrases[i] + '<br/>';
        }
        applyFilter(); // Format text
        isLoading(false); // Revert to the default background when data is loaded
    });
}

// Function to change the background to white while loading data
function isLoading(l) {
    if (l === true) {
        loadFull.style.color = 'rgb(255 255 255)';
        startSummary.style.backgroundColor = 'white';
        updateInfo.style.backgroundColor = 'white';
    } else {
        loadFull.style.color = '#ffffff70';
        startSummary.style.backgroundColor = '';
        updateInfo.style.backgroundColor = '';
    }
}

// Event listeners for interval input changes
intervalSplit.addEventListener('keyup', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
        applyFilter();
    }, 500);
});

intervalSplit.addEventListener("change", function () { applyFilter(); }, false);

// Event listeners for clickable elements
subtitleLink.onclick = () => { copyToClipboard(subtitleLink.innerText) };
updateInfo.onclick = () => { loadInfo(false); }
loadFull.onclick = () => { loadInfo(false); }
formattedText.onclick = () => { copyToClipboard(textStore) };
startSummary.onclick = () => {
    // Save data and open the specified summarizer
    reserve.temporary = textStore;
    chrome.storage.local.set({ key: reserve });
    if (reserve.site === 'c') { chrome.tabs.create({ url: 'https://quillbot.com/summarize', active: true }); }
    else { chrome.tabs.create({ url: 'https://uau.li/', active: true }); }
}

automateContent.onclick = () => {
    // Refresh the current tab and enable subtitles
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { target: 'content', action: "refreshTab" });
    });
    reserve.temporaryLink = "!"; // State used for content script to enable subtitles
    chrome.storage.local.set({ key: reserve });
    window.close();
};

// Function to apply filtering based on the interval input value
function applyFilter() {
    const intervalSec = (intervalSplit.value) ? intervalSplit.value * 1000 : 4000;
    let count = 0;

    // Create a deep copy of the phrases object
    textStore = JSON.parse(JSON.stringify(reserve.phrases));
    for (i in reserve.timecodes) {
        // If the difference between timecodes is higher than the interval, add a newline
        if (i > 0 && reserve.timecodes[i] - reserve.timecodes[i - 1] > intervalSec) {
            count += 1;
            textStore[i - 1] = textStore[i - 1] + '\n';
        }
    }
    // Replace the first newline, as sometimes websites cancel summary if it's in the beginning
    textStore = textStore.join(' ').replace('\n', '').replaceAll('\n ', '\n');
    intervalStats.innerText = `>${intervalSec / 1000}sec found ${count}`;
    formattedText.innerText = textStore;
    document.querySelector('#wordCount').innerText = textStore.trim().split(/\s+/).length + ' words';
}

// Function to copy text to the clipboard
function copyToClipboard(text) {
    let copyFrom = document.createElement("textarea");
    copyFrom.textContent = text;
    document.body.appendChild(copyFrom);
    copyFrom.select();
    document.execCommand('copy');
    copyFrom.blur();
    document.body.removeChild(copyFrom);
}

// Function to convert milliseconds to time format (HH:mm:ss)
function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;
    return hours + ":" + minutes + ":" + seconds;
}

// Add event listener for website change, save changes to storage
for (const radioButton of document.querySelectorAll('input[name="summarizer"]')) {
    radioButton.addEventListener('change', function (e) {
        if (this.checked) {
            reserve.site = this.value;
            chrome.storage.local.set({ key: reserve });
        }
    });
}
