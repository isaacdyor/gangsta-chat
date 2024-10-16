// Configuration constants
const CONFIG = {
  apiKey: "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT",
  orgSlug: "isaac-dyor-d74b42",
  appSlug: "ad64f510-cc08-4b42-9cfd-ba6089397e16",
  version: "1.2",
  apiBaseUrl: "https://api.wordware.ai/v1alpha",
  elevenLabsApiKey: "sk_019aa886d22e7e4fa060bf0f216ed6215dd9fb3f1e4bfc33",
  elevenLabsVoiceId: "bIHbv24MWmeRgasZH58o",
};

// Store the last run ID for potential future use
let lastRunId = null;
let currentRunId = null;
let currentTabId = null;
let tabConversations = {};

// DOM Elements
const elements = {
  sendButton: null,
  userInput: null,
  result: null,
  audioPlayer: null,
  themeToggle: null,
  lightIcon: null,
  darkIcon: null,
  logoLight: null,
  logoDark: null,
  chatContainer: null,
};

let currentTheme = "light";
let messages = [];

// Initialize the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  // Get references to DOM elements
  elements.sendButton = document.getElementById("sendButton");
  elements.userInput = document.getElementById("userInput");
  elements.result = document.getElementById("result");
  elements.audioPlayer = document.getElementById("audioPlayer");
  elements.themeToggle = document.getElementById("themeToggle");
  elements.lightIcon = document.querySelector(".light-icon");
  elements.darkIcon = document.querySelector(".dark-icon");
  elements.logoLight = document.getElementById("logo-light");
  elements.logoDark = document.getElementById("logo-dark");
  elements.chatContainer = document.getElementById("chatContainer");

  // Add click event listener to the send button
  elements.sendButton.addEventListener("click", runApp);

  // Add keypress event listener to the input field
  elements.userInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      runApp();
    }
  });

  // Add click event listener to the theme toggle button
  elements.themeToggle.addEventListener("click", toggleTheme);

  // Initialize theme
  currentTheme = localStorage.getItem("theme") || "light";
  setTheme(currentTheme);

  // Add listener for tab activation
  chrome.tabs.onActivated.addListener(handleTabChange);

  // Initialize currentTabId and load the conversation for the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) {
      currentTabId = tab.id;
      loadConversationForTab(currentTabId);
    }
  });
}

function handleTabChange(activeInfo) {
  currentTabId = activeInfo.tabId;
  loadConversationForTab(currentTabId);
}

function loadConversationForTab(tabId) {
  chrome.storage.local.get([`conversation_${tabId}`], function (result) {
    if (chrome.runtime.lastError) {
      console.error("Error loading conversation:", chrome.runtime.lastError);
    } else {
      messages = result[`conversation_${tabId}`] || [];
      elements.chatContainer.innerHTML = "";
      messages.forEach((message) => {
        if (message.type === "text") {
          addMessageToChat(message.content, message.sender, false);
        } else if (message.type === "audio") {
          addAudioMessageToChat(message.url, message.sender, false);
        }
      });
    }
  });
}

function saveMessages() {
  const conversationKey = `conversation_${currentTabId}`;
  chrome.storage.local.set({ [conversationKey]: messages }, function () {
    if (chrome.runtime.lastError) {
      console.error("Error saving messages:", chrome.runtime.lastError);
    }
  });
}

// ... (rest of the existing functions)

// Modify the runApp function
async function runApp() {
  const userMessage = elements.userInput.value.trim();
  if (!userMessage) return;

  // Display user message
  addMessageToChat(userMessage, "user");

  // Clear input field and unfocus it
  elements.userInput.value = "";
  elements.userInput.blur();

  setScrapingState();

  // Add thinking message
  const thinkingElement = addThinkingMessage();

  try {
    if (!currentRunId) {
      // This is the first message, initiate a new run
      const pageContent = await getPageContent();
      if (pageContent) {
        console.log("Page content:", pageContent);
        // await initiateApiRun(pageContent, userMessage);
      } else {
        throw new Error("Failed to retrieve page content");
      }
    } else {
      // This is a subsequent message, send it as an ask
      await sendAsk(userMessage);
    }
  } catch (error) {
    handleError("Error occurred", error);
  } finally {
    // Remove thinking message
    thinkingElement.remove();
  }
}

// ... (rest of the existing functions)

// Function to poll the run status
async function pollRunStatus(runId) {
  try {
    let hasReceivedResponse = false;
    while (true) {
      const statusResponse = await sendApiRequest("GET", `runs/${runId}`);

      if (statusResponse) {
        if (statusResponse.status === "COMPLETE") {
          const text = statusResponse.outputs?.answer || "No results found.";
          await convertTextToSpeech(text);
          break;
        } else if (statusResponse.status === "FAILED") {
          throw new Error("The run failed. Please try again.");
        } else if (
          statusResponse.status === "RUNNING" &&
          statusResponse.outputs?.answer
        ) {
          // Handle intermediate response
          const text = statusResponse.outputs.answer;
          await convertTextToSpeech(text);
          hasReceivedResponse = true;
        } else if (statusResponse.status === "AWAITING_INPUT") {
          if (!hasReceivedResponse) {
            // If we haven't received a response yet, continue polling
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          // If we've received a response and now it's awaiting input, break the loop
          break;
        }
      } else {
        throw new Error("Unable to fetch run status");
      }

      // Wait for 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (error) {
    handleError("Error occurred while checking status", error);
  }
}

// ... (rest of the existing functions)

function toggleTheme() {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  setTheme(currentTheme);
  localStorage.setItem("theme", currentTheme);
}

function setTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    elements.lightIcon.style.display = "none";
    elements.darkIcon.style.display = "block";
    elements.logoLight.style.display = "none";
    elements.logoDark.style.display = "block";
  } else {
    document.documentElement.classList.remove("dark");
    elements.lightIcon.style.display = "block";
    elements.darkIcon.style.display = "none";
    elements.logoLight.style.display = "block";
    elements.logoDark.style.display = "none";
  }
}

function addMessageToChat(content, sender, save = true) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", `${sender}-message`);
  messageElement.textContent = content;

  // Insert the new message at the end of the chat container
  elements.chatContainer.appendChild(messageElement);

  // Scroll to the bottom of the chat container
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

  // Save the message to the messages array and Chrome storage only if save is true
  if (save) {
    messages.push({ type: "text", content, sender });
    saveMessages();
  }
}

function addThinkingMessage() {
  const thinkingElement = document.createElement("div");
  thinkingElement.classList.add(
    "message",
    "system-message",
    "thinking-message"
  );
  thinkingElement.textContent = "Thinking...";
  elements.chatContainer.appendChild(thinkingElement);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
  return thinkingElement;
}

function setScrapingState() {
  elements.sendButton.disabled = true;
  elements.sendButton.innerHTML =
    '<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
}

function handleError(message, error) {
  console.error(message, error);
  setResultsState();
  addMessageToChat(`Error: ${error.message}`, "bot");
}

function setResultsState() {
  elements.sendButton.disabled = false;
  elements.sendButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send">
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  `;
}

// Function to get the content of the active tab
function getPageContent() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: getTextContent,
          })
          .then(([{ result: textContent }]) => {
            resolve(textContent);
          })
          .catch((err) => reject(err));
      } else {
        reject(new Error("No active tab found"));
      }
    });
  });
}

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

// ... (rest of the existing functions)
