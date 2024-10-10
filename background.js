chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "API_REQUEST") {
    fetch(request.url, request.options)
      .then((response) => response.json())
      .then((data) => sendResponse({ data: data }))
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }
});
