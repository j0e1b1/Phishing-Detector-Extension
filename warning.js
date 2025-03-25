(function() {
  // Extract the original URL from the query parameter.
  const params = new URLSearchParams(window.location.search);
  const originalUrl = params.get('url');

  // Proceed button: load the original site.
  document.getElementById('proceed').addEventListener('click', function() {
    if (originalUrl) {
      browser.runtime.sendMessage({ action: "allow", url: originalUrl })
        .then(response => {
          // After receiving confirmation from the background script,
          // navigate to the original URL.
          window.location.assign(originalUrl);
        });
    }
  });

  // Go Back button: return to the previous page, if available.
  document.getElementById('goback').addEventListener('click', function() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history exists, redirect to a safe default (e.g., about:home).
      window.location.href = "about:home";
    }
  });
})();

