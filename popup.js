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
};

let currentTheme = "light";

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
  elements.result.textContent = "";
}

// Function to set the UI state after receiving results
function setResultsState(message) {
  elements.sendButton.disabled = false;
  elements.sendButton.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
  elements.result.textContent = message;
}

// Function to handle errors and update the UI accordingly
function handleError(message, error) {
  console.error(message, error);
  elements.sendButton.disabled = false;
  elements.sendButton.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
  elements.result.textContent = `Error: ${error.message}`;
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
    renderAudio(audioUrl);
  } catch (error) {
    console.error("Error in text-to-speech conversion:", error);
    handleError("Error in text-to-speech conversion", error);
  }
}

// Add this new function to render the audio
function renderAudio(audioUrl) {
  elements.audioPlayer.src = audioUrl;
  elements.audioPlayer.style.display = "block";
  setResultsState("Audio generated successfully. Press play to listen.");
}
