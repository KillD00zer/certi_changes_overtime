/**
 * Background Service Worker for Google Earth Survey Extension (Manifest V3)
 * Handles tab captures, context menus, keyboard shortcuts (Ctrl+Shift+S),
 * programmatic injection, and state synchronization.
 */

// Enable Side Panel on toolbar action click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(err => console.warn('Could not set side panel behavior:', err));
}

// Start fresh on browser startup: clear previous session data
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove(['currentParcel', 'capturedShots', 'selectedYear'], () => {
    console.log('[EarthSurvey] Browser started fresh: session data cleared.');
  });
});

// Setup Context Menu and auto-inject on install or reload
chrome.runtime.onInstalled.addListener(async () => {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'capture_earth_map',
        title: '📸 التقاط خريطة Google Earth وتوثيقها',
        contexts: ['all'],
        documentUrlPatterns: ['*://earth.google.com/*']
      });
    });
  } catch (e) {
    console.warn('Context menu creation note:', e);
  }

  // Auto-inject content script into any already-open Earth tabs
  chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
    if (tabs && tabs.length > 0) {
      tabs.forEach(t => ensureInjected(t.id));
    }
  });
});

// Helper: programmatic injection into tabs that were already open
async function ensureInjected(tabId) {
  if (!tabId) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['libs/proj4.js', 'scripts/content_script.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['styles/overlay.css']
    });
    return true;
  } catch (err) {
    return false;
  }
}

// Direct capture function (invoked via Context Menu or Keyboard Shortcut)
// Both explicitly grant activeTab permission to the target tab!
async function captureTabDirect(tab) {
  if (!tab || !tab.id) return;
  try {
    await ensureInjected(tab.id);

    // 1. Get map bounds from content script (polygon stays visible!)
    let bounds = null;
    try {
      bounds = await chrome.tabs.sendMessage(tab.id, { action: 'GET_MAP_BOUNDS' });
    } catch (e) {
      console.warn('Could not get map bounds:', e);
    }

    // 2. Capture visible tab
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'فشل التقاط الشاشة';
        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_TOAST',
          message: '❌ تعذر التقاط الشاشة: ' + err
        }).catch(() => {});
        return;
      }

      // 3. Forward to content script to crop to map bounds and save to storage
      chrome.tabs.sendMessage(tab.id, {
        action: 'PROCESS_AND_SAVE_CAPTURE',
        dataUrl: dataUrl,
        bounds: bounds
      }).catch((err) => {
        console.error('Error forwarding capture to content script:', err);
      });
    });
  } catch (err) {
    console.error('Error in captureTabDirect:', err);
  }
}

// Context Menu click listener
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture_earth_map' && tab) {
    captureTabDirect(tab);
  }
});

// Keyboard Shortcut command listener (Ctrl+Shift+S)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-map') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0 && tabs[0].url && tabs[0].url.includes('earth.google.com')) {
        captureTabDirect(tabs[0]);
      } else {
        // Find any Earth tab
        chrome.tabs.query({ url: '*://earth.google.com/*' }, (earthTabs) => {
          if (earthTabs && earthTabs.length > 0) {
            chrome.tabs.update(earthTabs[0].id, { active: true }, (actTab) => {
              captureTabDirect(actTab);
            });
          }
        });
      }
    });
  }
});

// Runtime Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CAPTURE_VISIBLE_TAB') {
    let winId = message.windowId || null;

    const performCapture = (targetWinId) => {
      chrome.tabs.captureVisibleTab(targetWinId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Error capturing visible tab:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, dataUrl: dataUrl });
        }
      });
    };

    if (winId) {
      performCapture(winId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let fallbackWinId = (tabs && tabs.length > 0) ? tabs[0].windowId : null;
        if (!fallbackWinId && sender && sender.tab) {
          fallbackWinId = sender.tab.windowId;
        }
        performCapture(fallbackWinId);
      });
    }
    return true; // Keep message channel open for async response
  }

  if (message.action === 'ENSURE_INJECTED') {
    ensureInjected(message.tabId).then((res) => {
      sendResponse({ success: res });
    });
    return true;
  }

  if (message.action === 'OPEN_EARTH_TAB') {
    const url = message.url || 'https://earth.google.com/web';
    
    // Check if Google Earth tab already exists
    chrome.tabs.query({ url: '*://earth.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Update existing tab and make it active
        chrome.tabs.update(tabs[0].id, { url: url, active: true }, (updatedTab) => {
          setTimeout(() => ensureInjected(updatedTab.id), 1000);
          sendResponse({ success: true, tabId: updatedTab.id, windowId: updatedTab.windowId });
        });
      } else {
        // Open new tab
        chrome.tabs.create({ url: url, active: true }, (newTab) => {
          setTimeout(() => ensureInjected(newTab.id), 2500);
          sendResponse({ success: true, tabId: newTab.id, windowId: newTab.windowId });
        });
      }
    });
    return true;
  }

  if (message.action === 'PING') {
    sendResponse({ status: 'PONG', time: Date.now() });
    return false;
  }
});
