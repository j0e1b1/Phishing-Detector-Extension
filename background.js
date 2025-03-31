// Background script for phishing detection (Firefox)
let temporaryWhitelist = new Set();

// Firefox uses browser.* instead of chrome.*
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Initialize stats if not present
browser.storage.local.get("stats").then((result) => {
  if (!result.stats) {
    browser.storage.local.set({ stats: { blocked: 0, checks: 0 } });
  }
});

// Function to check if URL is in whitelist, blacklist, or needs checking
async function checkUrl(tabId, url) {
  console.log("[PhiCompass] Checking URL:", url);

  // Skip checking for non-HTTP URLs
  if (!url.startsWith("http")) return;

  try {
    // Update checks count whenever a URL is checked
    const statsData = await browser.storage.local.get("stats");
    const stats = statsData.stats || { blocked: 0, checks: 0 };
    stats.checks++;
    await browser.storage.local.set({ stats });

    // Get whitelist
    const whitelistData = await browser.storage.local.get("whitelist");
    const whitelist = whitelistData.whitelist || [];

    if (whitelist.includes(url)) {
      console.log("[PhiCompass] URL is whitelisted:", url);
      return;
    }

    // Check if URL is in temporary whitelist
    if (temporaryWhitelist.has(url)) {
      console.log("[PhiCompass] URL is temporarily whitelisted:", url);
      return;
    }

    // Get blacklist
    const blacklistData = await browser.storage.local.get("blacklist");
    const blacklist = blacklistData.blacklist || [];

    if (blacklist.includes(url)) {
      console.log("[PhiCompass] URL is blacklisted:", url);
      browser.tabs.update(tabId, {
        url:
          browser.runtime.getURL("warning.html") +
          "?url=" +
          encodeURIComponent(url),
      });
      return;
    }

    // URL needs to be checked with the server
    console.log("[PhiCompass] Sending request to server for:", url);
    const response = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    });

    if (!response.ok) {
      console.error("[PhiCompass] Server returned error:", response.status);
      return;
    }

    const result = await response.json();
    console.log("[PhiCompass] Server response:", result);

    if (result.confidence > 0 && result.is_phishing === "good") {
      // Site is safe, add to whitelist
      whitelist.push(url);
      await browser.storage.local.set({ whitelist });
      console.log("[PhiCompass] Site added to whitelist:", url);
    } else {
      // Site is suspicious, show warning
      browser.tabs.update(tabId, {
        url:
          browser.runtime.getURL("warning.html") +
          "?url=" +
          encodeURIComponent(url),
      });

      // Add to blacklist and increment blocked count
      blacklist.push(url);
      await browser.storage.local.set({ blacklist });

      // Increment the blocked count
      stats.blocked++;
      await browser.storage.local.set({ stats });

      console.log("[PhiCompass] Site added to blacklist:", url);
      console.log("[PhiCompass] Blocked count increased to:", stats.blocked);
    }
  } catch (error) {
    console.error("[PhiCompass] Error:", error.message);
  }
}

// Listen for tab updates to check URLs
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && changeInfo.url) {
    console.log("[PhiCompass] Tab updated:", tabId, changeInfo.url);
    checkUrl(tabId, changeInfo.url);
  }
});

// Message handler for user actions from warning page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[PhiCompass] Message received:", message);

  if (message.action === "allowOnce") {
    temporaryWhitelist.add(message.url);
    browser.tabs.update(sender.tab.id, { url: message.url });
    sendResponse({ success: true });
  } else if (message.action === "allowAlways") {
    browser.storage.local.get("whitelist").then((result) => {
      const whitelist = result.whitelist || [];
      whitelist.push(message.url);
      browser.storage.local.set({ whitelist });

      // Remove from blacklist if present
      browser.storage.local.get("blacklist").then((result) => {
        const blacklist = result.blacklist || [];
        const updatedBlacklist = blacklist.filter(
          (item) => item !== message.url,
        );
        browser.storage.local.set({ blacklist: updatedBlacklist });

        browser.tabs.update(sender.tab.id, { url: message.url });
        sendResponse({ success: true });
      });
    });
  } else if (message.action === "getTemporaryWhitelist") {
    sendResponse({ temporaryWhitelist: Array.from(temporaryWhitelist) });
  } else if (message.action === "clearTemporaryWhitelist") {
    temporaryWhitelist.clear();
    sendResponse({ success: true });
  } else if (message.action === "checkTemporaryWhitelist") {
    sendResponse({
      isTemporaryWhitelisted: temporaryWhitelist.has(message.url),
    });
  } else if (message.action === "removeFromTemporaryWhitelist") {
    temporaryWhitelist.delete(message.url);
    sendResponse({ success: true });
  } else if (message.action === "getUrlStatus") {
    // Get site status without score
    fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: message.url }),
    })
      .then((response) => response.json())
      .then((result) => {
        const status =
          result.confidence > 0 && result.is_phishing === "good"
            ? "safe"
            : "suspicious";
        sendResponse({ status: status });
      })
      .catch((error) => {
        console.error("[PhiCompass] Error getting status:", error);
        sendResponse({ status: "unknown" });
      });

    return true; // Keep the message channel open for async response
  }

  return true; // Keep the message channel open for async response
});

// Clean up temporary whitelist when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  console.log("[PhiCompass] Tab closed:", tabId);
  // In Firefox, we need a different approach for cleaning up temporary whitelist
});

// Log extension initialization
console.log(
  "[PhiCompass] Background script initialized - " + new Date().toISOString(),
);
