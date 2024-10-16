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

  // Load stored messages
  loadMessages();
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

// Main function to run the application
async function runApp() {
  const userMessage = elements.userInput.value.trim();
  if (!userMessage) return;

  // Display user message
  addMessageToChat(userMessage, "user");

  // Clear input field
  elements.userInput.value = "";

  setScrapingState();

  try {
    // Get the content of the active tab
    const pageContent = await getPageContent();
    if (pageContent) {
      // Console log the page content
      console.log("Page content:", pageContent);

      // Initiate the API run with the retrieved content and user message
      await initiateApiRun(pageContent, userMessage);
    } else {
      throw new Error("Failed to retrieve page content");
    }
  } catch (error) {
    handleError("Error occurred", error);
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

// Function to initiate an API run
async function initiateApiRun(pageContent, userMessage) {
  try {
    // Send a POST request to start a new run
    const runResponse = await sendApiRequest(
      "POST",
      `apps/${CONFIG.orgSlug}/${CONFIG.appSlug}/${CONFIG.version}/runs`,
      {
        inputs: {
          page_content: pageContent,
          // page_content: "test",
          question: userMessage,
        },
      }
    );

    console.log("API response:", runResponse);

    if (runResponse && runResponse.runId) {
      lastRunId = runResponse.runId;
      // Poll for the run status
      await pollRunStatus(lastRunId);
    } else {
      throw new Error("No runId received in the response");
    }
  } catch (error) {
    console.error("Error in initiateApiRun:", error);
    throw error;
  }
}

// Function to poll the run status
async function pollRunStatus(runId) {
  try {
    while (true) {
      // Check the status of the run
      const statusResponse = await sendApiRequest("GET", `runs/${runId}`);

      if (statusResponse) {
        if (statusResponse.status === "COMPLETE") {
          const text = statusResponse.outputs?.answer || "No results found.";
          await convertTextToSpeech(text);
          break;
        } else if (statusResponse.status === "FAILED") {
          throw new Error("The run failed. Please try again.");
        }
      } else {
        throw new Error("Unable to fetch run status");
      }

      // Wait for 5 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    handleError("Error occurred while checking status", error);
  }
}

// Function to send API requests
function sendApiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${CONFIG.apiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return sendMessage({
    type: "API_REQUEST",
    url: `${CONFIG.apiBaseUrl}/${endpoint}`,
    options,
  });
}

// Function to send messages to the background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
      }
    });
  });
}

// Function to set the UI state while scraping
function setScrapingState() {
  elements.sendButton.disabled = true;
  elements.sendButton.innerHTML =
    '<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
}

// Function to set the UI state after receiving results
function setResultsState() {
  elements.sendButton.disabled = false;
  elements.sendButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send">
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  `;
}

// Function to handle errors and update the UI accordingly
function handleError(message, error) {
  console.error(message, error);
  setResultsState();
  addMessageToChat(`Error: ${error.message}`, "bot");
}

// Add this new function to convert text to speech
async function convertTextToSpeech(text) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("xi-api-key", CONFIG.elevenLabsApiKey);

  const raw = JSON.stringify({
    text: text,
    voice_settings: {
      stability: 0.1,
      similarity_boost: 0.3,
      style: 0.2,
    },
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.elevenLabsVoiceId}`,
      requestOptions
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    addAudioMessageToChat(audioUrl, "bot");
  } catch (error) {
    console.error("Error in text-to-speech conversion:", error);
    handleError("Error in text-to-speech conversion", error);
  } finally {
    // Set the UI back to the non-loading state
    setResultsState();
  }
}

// New function to add audio message to chat
function addAudioMessageToChat(audioUrl, sender, save = true) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", `${sender}-message`);

  const audioContainer = document.createElement("div");
  audioContainer.classList.add("audio-container");

  const audioElement = document.createElement("audio");
  audioElement.src = audioUrl;

  const playButton = document.createElement("button");
  playButton.classList.add("play-button");
  playButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  `;

  const timeline = document.createElement("input");
  timeline.type = "range";
  timeline.min = 0;
  timeline.max = 100;
  timeline.value = 0;
  timeline.classList.add("timeline");

  audioContainer.appendChild(playButton);
  audioContainer.appendChild(timeline);
  messageElement.appendChild(audioContainer);

  // Play/Pause functionality
  playButton.addEventListener("click", () => {
    if (audioElement.paused) {
      audioElement.play();
      playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      `;
    } else {
      audioElement.pause();
      playButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
    }
  });

  // Update timeline
  audioElement.addEventListener("timeupdate", () => {
    const progress = (audioElement.currentTime / audioElement.duration) * 100;
    timeline.value = progress;
  });

  // Seek functionality
  timeline.addEventListener("input", () => {
    const time = (timeline.value / 100) * audioElement.duration;
    audioElement.currentTime = time;
  });

  // Reset play button when audio ends
  audioElement.addEventListener("ended", () => {
    playButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
  });

  // Insert the new message at the end of the chat container
  elements.chatContainer.appendChild(messageElement);

  // Scroll to the bottom of the chat container
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

  // Save the message to the messages array and Chrome storage only if save is true
  if (save) {
    messages.push({ type: "audio", url: audioUrl, sender });
    saveMessages();
  }
}

// Update this function to handle audio messages
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

function saveMessages() {
  chrome.storage.local.set({ messages: messages }, function () {
    if (chrome.runtime.lastError) {
      console.error("Error saving messages:", chrome.runtime.lastError);
    }
  });
}

function loadMessages() {
  chrome.storage.local.get(["messages"], function (result) {
    if (chrome.runtime.lastError) {
      console.error("Error loading messages:", chrome.runtime.lastError);
    } else if (result.messages) {
      messages = result.messages;
      // Only clear and repopulate if the chat container is empty
      if (elements.chatContainer.children.length === 0) {
        messages.forEach((message) => {
          if (message.type === "text") {
            addMessageToChat(message.content, message.sender, false);
          } else if (message.type === "audio") {
            addAudioMessageToChat(message.url, message.sender, false);
          }
        });
      }
    }
  });
}
