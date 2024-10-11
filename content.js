// Function to extract text content from the page
function getTextContent() {
  const tempElement = document.createElement("div");
  tempElement.innerHTML = document.body.innerHTML;

  // Remove script and style elements
  ["script", "style"].forEach((tag) => {
    const elements = tempElement.getElementsByTagName(tag);
    while (elements[0]) elements[0].remove();
  });

  // Get the text content and remove extra whitespace
  return (tempElement.textContent || tempElement.innerText)
    .replace(/\s+/g, " ")
    .trim();
}

// Function to handle the script execution
function handleScriptExecution(tab) {
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: getTextContent,
    })
    .then(([{ result: textContent }]) => {
      // Send the textContent to the popup
      chrome.runtime.sendMessage({
        type: "TEXT_CONTENT",
        content: textContent,
      });

      document.getElementById("result").textContent = textContent;
    })
    .catch((err) => console.error("Failed to execute script:", err));
}

// Event listener for the "Run App" button
document.getElementById("runApp").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) {
      handleScriptExecution(tab);
    } else {
      console.error("No active tab found");
    }
  });
});
