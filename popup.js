const CONFIG = {
  apiKey: "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT",
  orgSlug: "isaac-dyor-d74b42",
  appSlug: "318cfdc8-ebf9-46a6-beb3-3b1953926f93",
  version: "latest",
  apiBaseUrl: "https://api.wordware.ai/v1alpha",
};

// DOM Elements
const elements = {
  sendButton: null,
  userInput: null,
  chatContainer: null,
  themeToggle: null,
  lightIcon: null,
  darkIcon: null,
  logoLight: null,
  logoDark: null,
};

let isFirstMessage = true;
let pageContent = "";
let currentTheme = "light";

// Initialize the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  // Get references to DOM elements
  elements.sendButton = document.getElementById("sendButton");
  elements.userInput = document.getElementById("userInput");
  elements.chatContainer = document.getElementById("chatContainer");
  elements.themeToggle = document.getElementById("themeToggle");
  elements.lightIcon = document.querySelector(".light-icon");
  elements.darkIcon = document.querySelector(".dark-icon");
  elements.logoLight = document.getElementById("logo-light");
  elements.logoDark = document.getElementById("logo-dark");

  // Add click event listener to the send button
  elements.sendButton.addEventListener("click", handleSendMessage);

  // Add keypress event listener to the input field
  elements.userInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      handleSendMessage();
    }
  });

  // Add click event listener to the theme toggle button
  elements.themeToggle.addEventListener("click", toggleTheme);

  // Get the page content when the extension is opened
  getPageContent()
    .then((content) => {
      pageContent = content;
    })
    .catch((error) => {
      console.error("Error getting page content:", error);
    });

  // Initialize theme
  currentTheme = localStorage.getItem("theme") || "light";
  setTheme(currentTheme);
}

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

async function handleSendMessage() {
  const userMessage = elements.userInput.value.trim();
  if (userMessage === "") return;

  // Display user message
  addMessageToChat(userMessage, "user");

  // Clear input field
  elements.userInput.value = "";

  // Disable input and button while processing
  elements.userInput.disabled = true;
  elements.sendButton.disabled = true;

  try {
    const inputs = isFirstMessage
      ? { user_input: userMessage, page_content: pageContent }
      : { user_input: userMessage };

    const response = await sendApiRequest(
      "POST",
      `apps/${CONFIG.orgSlug}/${CONFIG.appSlug}/${CONFIG.version}/runs`,
      { inputs: inputs }
    );

    if (response.runId) {
      await pollRunStatus(response.runId);
    } else {
      throw new Error("No runId received in the response");
    }

    isFirstMessage = false;
  } catch (error) {
    handleError("Error occurred while sending message", error);
  } finally {
    // Re-enable input and button
    elements.userInput.disabled = false;
    elements.sendButton.disabled = false;
  }
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

// Function to send API requests
function sendApiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(`${CONFIG.apiBaseUrl}/${endpoint}`, options).then((response) =>
    response.json()
  );
}

// Function to handle errors and update the UI accordingly
function handleError(message, error) {
  console.error(message, error);
  elements.sendButton.disabled = false;
  elements.sendButton.textContent = "Send Page Content";
  elements.result.textContent = `Error: ${error.message}`;
}

async function pollRunStatus(runId) {
  try {
    while (true) {
      const statusResponse = await sendApiRequest("GET", `runs/${runId}`);

      if (statusResponse.status === "COMPLETE") {
        if (statusResponse.outputs && statusResponse.outputs.audio_url) {
          addMessageToChat(statusResponse.outputs.audio_url, "bot");
        } else {
          addMessageToChat("No audio response received.", "bot");
        }
        break;
      } else if (statusResponse.status === "FAILED") {
        throw new Error(
          "The run failed. Error: " +
            (statusResponse.errors?.[0]?.message || "Unknown error")
        );
      }

      if (statusResponse.status !== "RUNNING") {
        addMessageToChat(
          `Run stopped with status: ${statusResponse.status}`,
          "bot"
        );
        break;
      }

      // Wait for 2 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (error) {
    handleError("Error occurred while polling run status", error);
  }
}

function addMessageToChat(content, sender) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", `${sender}-message`);

  if (sender === "bot" && content.startsWith("http")) {
    // It's an audio URL
    const audio = document.createElement("audio");
    audio.src = content;
    audio.controls = true;
    messageElement.appendChild(audio);
  } else {
    messageElement.textContent = content;
  }

  elements.chatContainer.appendChild(messageElement);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}
