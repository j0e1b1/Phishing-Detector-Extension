document.addEventListener("DOMContentLoaded", function () {
  console.log("[PhishingDetector] Warning page loaded");

  // Get URL from query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const suspiciousUrl = urlParams.get("url");

  // Display the URL
  document.getElementById("suspicious-url").textContent = suspiciousUrl;

  // Handle "Go Back" button
  document.getElementById("go-back").addEventListener("click", function () {
    window.history.go(-2);
  });

  // Handle "Continue Just Once" button
  document
    .getElementById("continue-once")
    .addEventListener("click", function () {
      browser.runtime.sendMessage({
        action: "allowOnce",
        url: suspiciousUrl,
      });
    });

  // Handle "Always Allow" button
  document
    .getElementById("continue-always")
    .addEventListener("click", function () {
      browser.runtime.sendMessage({
        action: "allowAlways",
        url: suspiciousUrl,
      });
    });
});
