document.addEventListener("DOMContentLoaded", async function () {
  // Tab switching functionality
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", function () {
      // Remove active class from all tabs and content
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Add active class to clicked tab and corresponding content
      this.classList.add("active");
      document.getElementById(this.dataset.tab).classList.add("active");
    });
  });

  // Load stats
  try {
    const stats = await browser.storage.local.get("stats");
    const threatStats = stats.stats || { blocked: 0, checks: 0 };
    document.getElementById("threats-blocked").textContent =
      threatStats.blocked || 0;
    document.getElementById("total-checks").textContent =
      threatStats.checks || 0;
  } catch (error) {
    console.error("Error loading stats:", error);
  }

  // Load whitelist
  try {
    const whitelistData = await browser.storage.local.get("whitelist");
    const whitelist = whitelistData.whitelist || [];
    document.getElementById("sites-whitelisted").textContent = whitelist.length;
    const whitelistContainer = document.getElementById("whitelist-items");
    populateUrlList(whitelistContainer, whitelist, "whitelist");
  } catch (error) {
    console.error("Error loading whitelist:", error);
  }

  // Load blacklist
  try {
    const blacklistData = await browser.storage.local.get("blacklist");
    const blacklist = blacklistData.blacklist || [];
    const blacklistContainer = document.getElementById("blacklist-items");
    populateUrlList(blacklistContainer, blacklist, "blacklist");
  } catch (error) {
    console.error("Error loading blacklist:", error);
  }

  // Get temporary whitelist from background script
  browser.runtime.sendMessage(
    { action: "getTemporaryWhitelist" },
    function (response) {
      const tempContainer = document.getElementById("temp-items");
      populateUrlList(tempContainer, response.temporaryWhitelist, "temp");
    },
  );

  // Clear buttons
  document
    .getElementById("clear-whitelist")
    .addEventListener("click", async function () {
      await browser.storage.local.set({ whitelist: [] });
      document.getElementById("whitelist-items").innerHTML =
        '<div class="empty-list">No trusted sites</div>';
      document.getElementById("sites-whitelisted").textContent = "0";
    });

  document
    .getElementById("clear-blacklist")
    .addEventListener("click", async function () {
      await browser.storage.local.set({ blacklist: [] });
      document.getElementById("blacklist-items").innerHTML =
        '<div class="empty-list">No blocked sites</div>';
    });

  document.getElementById("clear-temp").addEventListener("click", function () {
    browser.runtime.sendMessage({ action: "clearTemporaryWhitelist" });
    document.getElementById("temp-items").innerHTML =
      '<div class="empty-list">No temporarily allowed sites</div>';
  });

  // Check current page status
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const currentUrl = tabs[0].url;
    document.getElementById("current-url").textContent = currentUrl;

    const statusElement = document.getElementById("status");
    const scoreElement = document.getElementById("score-value");

    // Skip checking for extension URLs
    if (currentUrl.startsWith("moz-extension://")) {
      statusElement.className = "unknown";
      scoreElement.textContent = "Unknown";
      scoreElement.className = "score-value unknown";
      return;
    }

    // Get whitelist and blacklist
    const whitelistData = await browser.storage.local.get("whitelist");
    const whitelist = whitelistData.whitelist || [];

    const blacklistData = await browser.storage.local.get("blacklist");
    const blacklist = blacklistData.blacklist || [];

    if (whitelist.includes(currentUrl)) {
      statusElement.className = "safe";
      scoreElement.textContent = "Trusted";
      scoreElement.className = "score-value safe";
    } else if (blacklist.includes(currentUrl)) {
      statusElement.className = "unsafe";
      scoreElement.textContent = "Blocked";
      scoreElement.className = "score-value unsafe";
    } else {
      // Check if in temporary whitelist
      browser.runtime.sendMessage(
        { action: "checkTemporaryWhitelist", url: currentUrl },
        function (response) {
          if (response.isTemporaryWhitelisted) {
            statusElement.className = "unknown";
            scoreElement.textContent = "Temporarily Allowed";
            scoreElement.className = "score-value unknown";
          } else {
            // Get status from background script
            browser.runtime.sendMessage(
              { action: "getUrlStatus", url: currentUrl },
              function (response) {
                if (response && response.status !== undefined) {
                  if (response.status === "safe") {
                    statusElement.className = "safe";
                    scoreElement.textContent = "Safe";
                    scoreElement.className = "score-value safe";
                  } else {
                    statusElement.className = "unsafe";
                    scoreElement.textContent = "Suspicious";
                    scoreElement.className = "score-value unsafe";
                  }
                } else {
                  scoreElement.textContent = "Unknown";
                }
              },
            );
          }
        },
      );
    }
  } catch (error) {
    console.error("Error checking current tab:", error);
  }
});

function populateUrlList(container, urls, listType) {
  if (!urls || urls.length === 0) {
    container.innerHTML = `<div class="empty-list">No ${
      listType === "temp"
        ? "temporarily allowed"
        : listType === "whitelist"
          ? "trusted"
          : "blocked"
    } sites</div>`;
    return;
  }

  container.innerHTML = "";
  urls.forEach((url) => {
    const item = document.createElement("div");
    item.className = "url-item";

    const urlText = document.createElement("div");
    urlText.className = "url-text";
    urlText.title = url; // Show full URL on hover

    // Extract and display hostname for cleaner UI
    try {
      const urlObj = new URL(url);
      urlText.textContent = urlObj.hostname;
    } catch (e) {
      urlText.textContent = url;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.title = "Remove";
    removeBtn.innerHTML = `
      <svg class="remove-btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path fill="#5f6368" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `;

    removeBtn.addEventListener("click", async function () {
      if (listType === "temp") {
        browser.runtime.sendMessage({
          action: "removeFromTemporaryWhitelist",
          url: url,
        });
      } else {
        const data = await browser.storage.local.get(listType);
        const list = data[listType] || [];
        const updatedList = list.filter((u) => u !== url);
        await browser.storage.local.set({ [listType]: updatedList });

        // Update count if whitelist
        if (listType === "whitelist") {
          document.getElementById("sites-whitelisted").textContent =
            updatedList.length;
        }
      }

      item.remove();

      if (container.children.length === 0) {
        container.innerHTML = `<div class="empty-list">No ${
          listType === "temp"
            ? "temporarily allowed"
            : listType === "whitelist"
              ? "trusted"
              : "blocked"
        } sites</div>`;
      }
    });

    item.appendChild(urlText);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}
