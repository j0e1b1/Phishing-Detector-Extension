// background.js
// Listen to all main-frame requests
browser.webRequest.onBeforeRequest.addListener(
  async function(details) {
    let url = details.url;
    let cond = true

    try {
      // Send the URL to the native messaging host.
      // "my_ml_host" is the name of the native messaging host application.
      //let response = await browser.runtime.sendNativeMessage("my_ml_host", { url: url });
      //response && response.phishing == true in if conition
      // If the native ML model determines the site is phishing, redirect.
      if (cond) {
        // Redirect to a warning page in our extension, passing the original URL as a query parameter.
        let redirectUrl = browser.runtime.getURL("warning.html") + "?url=" + encodeURIComponent(url);
        return { redirectUrl: redirectUrl };
      }
    } catch (error) {
      console.error("Native messaging error:", error);
      // On error, allow the site to load normally.
    }
    // Allow the request to continue.
    return {};
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking"]
);
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "allow") {
    // Set cond to false so that the page will load normally.
    cond = false;
  }
});
