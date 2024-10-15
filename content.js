// Check if the script has already been injected
if (typeof window.wordwareSelectionMode === "undefined") {
  window.wordwareSelectionMode = {
    isSelectionMode: false,
    currentInputName: null,

    activateSelectionMode: function (inputName) {
      this.isSelectionMode = true;
      this.currentInputName = inputName;
      document.body.style.cursor = "crosshair";
      document.addEventListener("mouseover", this.highlightElement);
      document.addEventListener("mouseout", this.removeHighlight);
      document.addEventListener("click", this.selectElement);
    },

    deactivateSelectionMode: function () {
      this.isSelectionMode = false;
      this.currentInputName = null;
      document.body.style.cursor = "default";
      document.removeEventListener("mouseover", this.highlightElement);
      document.removeEventListener("mouseout", this.removeHighlight);
      document.removeEventListener("click", this.selectElement);
    },

    highlightElement: function (e) {
      if (!window.wordwareSelectionMode.isSelectionMode) return;
      e.target.style.outline = "2px solid red";
      e.stopPropagation();
    },

    removeHighlight: function (e) {
      if (!window.wordwareSelectionMode.isSelectionMode) return;
      e.target.style.outline = "";
    },

    selectElement: function (e) {
      if (!window.wordwareSelectionMode.isSelectionMode) return;
      e.preventDefault();
      e.stopPropagation();

      const selectedContent = e.target.textContent.trim();

      chrome.runtime.sendMessage(
        {
          action: "contentSelected",
          inputName: window.wordwareSelectionMode.currentInputName,
          content: selectedContent,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log("Content selected successfully");
            // Send message to reopen popup
            chrome.runtime.sendMessage({ action: "reopenPopup" });
          }
        }
      );

      window.wordwareSelectionMode.deactivateSelectionMode();
    },
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "activateSelection") {
      window.wordwareSelectionMode.activateSelectionMode(message.inputName);
      sendResponse({ success: true });
    }
  });
}
