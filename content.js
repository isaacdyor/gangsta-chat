// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    // Get all text content from the page
    const pageContent = document.body.innerText;
    sendResponse({ content: pageContent });
  }
});
