// Add these functions to your background.js file:

// Initialize stats if not present
browser.storage.local.get("stats").then((result) => {
  if (!result.stats) {
    browser.storage.local.set({ stats: { blocked: 0, checks: 0 } });
  }
});

// Track URL scores for popup display
let urlScores = new Map();

// Modify your checkUrl function to track stats
async function checkUrl(tabId, url) {
  // Rest of the function remains the same...

  // Update checks count
  const statsData = await browser.storage.local.get("stats");
  const stats = statsData.stats || { blocked: 0, checks: 0 };
  stats.checks++;
  await browser.storage.local.set({ stats });

  // When blocking a site:
  if (result.confidence <= 0 || result.is_phishing !== "good") {
    // Existing blocking code...

    // Update blocked count
    stats.blocked++;
    await browser.storage.local.set({ stats });
  }

  // Store the score for this URL
  urlScores.set(url, result.confidence);
}

// Add this handler to your onMessage listener in background.js
if (message.action === "getUrlScore") {
  if (urlScores.has(message.url)) {
    sendResponse({ score: urlScores.get(message.url) });
  } else {
    // Try to get score from server
    fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: message.url }),
    })
      .then((response) => response.json())
      .then((result) => {
        urlScores.set(message.url, result.confidence);
        sendResponse({ score: result.confidence });
      })
      .catch((error) => {
        console.error("Error getting score:", error);
        sendResponse({ score: undefined });
      });

    return true; // Keep the channel open for async response
  }
}
