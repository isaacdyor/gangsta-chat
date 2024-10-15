let isSelecting = false;
let currentInputName = null;
let highlightedElement = null;

function startSelection(inputName) {
  isSelecting = true;
  currentInputName = inputName;
  document.body.style.cursor = "crosshair";
  addSelectionListeners();
}

function stopSelection() {
  isSelecting = false;
  currentInputName = null;
  document.body.style.cursor = "default";
  removeSelectionListeners();
  if (highlightedElement) {
    highlightedElement.style.outline = "";
    highlightedElement = null;
  }
}

function addSelectionListeners() {
  document.addEventListener("mouseover", handleMouseOver);
  document.addEventListener("mouseout", handleMouseOut);
  document.addEventListener("click", handleClick);
}

function removeSelectionListeners() {
  document.removeEventListener("mouseover", handleMouseOver);
  document.removeEventListener("mouseout", handleMouseOut);
  document.removeEventListener("click", handleClick);
}

function handleMouseOver(event) {
  if (!isSelecting) return;
  event.stopPropagation();
  if (highlightedElement) {
    highlightedElement.style.outline = "";
  }
  highlightedElement = event.target;
  highlightedElement.style.outline = "2px solid red";
}

function handleMouseOut(event) {
  if (!isSelecting) return;
  event.stopPropagation();
  if (highlightedElement) {
    highlightedElement.style.outline = "";
    highlightedElement = null;
  }
}

function handleClick(event) {
  if (!isSelecting) return;
  event.preventDefault();
  event.stopPropagation();
  const selectedContent = event.target.innerText || event.target.textContent;
  chrome.runtime.sendMessage({
    action: "contentSelected",
    inputName: currentInputName,
    content: selectedContent,
  });
  stopSelection();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startSelection") {
    startSelection(message.inputName);
    sendResponse({ success: true });
  }
});
