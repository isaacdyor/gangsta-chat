document.getElementById("runApp").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    function getTextContent() {
      // Create a new element to hold the body content
      const tempElement = document.createElement("div");
      tempElement.innerHTML = document.body.innerHTML;

      // Remove script and style elements
      const scripts = tempElement.getElementsByTagName("script");
      const styles = tempElement.getElementsByTagName("style");
      while (scripts[0]) scripts[0].parentNode.removeChild(scripts[0]);
      while (styles[0]) styles[0].parentNode.removeChild(styles[0]);

      // Get the text content
      let text = tempElement.textContent || tempElement.innerText;

      // Remove extra whitespace
      text = text.replace(/\s+/g, " ").trim();

      return text;
    }

    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        func: getTextContent,
      })
      .then((injectionResults) => {
        const textContent = injectionResults[0].result;
        console.log("Text content:", textContent);

        // Update the result in the popup directly
        document.getElementById("result").innerText = textContent;

        // Only send message if we have a background script to receive it
        if (chrome.runtime.getManifest().background) {
          chrome.runtime.sendMessage({ info: textContent }, (response) => {
            if (chrome.runtime.lastError) {
              console.log(
                "Error sending message:",
                chrome.runtime.lastError.message
              );
            } else {
              console.log("Response from background:", response);
            }
          });
        }
      })
      .catch((err) => console.error("Failed to execute script:", err));
  });
});
