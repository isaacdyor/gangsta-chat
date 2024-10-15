let lastRunId = null;

// DOM Elements
const elements = {
  scrapeButton: null,
  result: null,
  apiKeyInput: null,
  getAppsButton: null,
  appsList: null,
  appDetail: null,
  appTitle: null,
  appDescription: null,
  appInputs: null,
  backButton: null,
};

// Add these new variables at the top of the file
let currentTheme = "light";
const themeToggle = document.getElementById("themeToggle");

// Add this function to handle theme toggling
function toggleTheme() {
  const lightIcon = document.querySelector(".light-icon");
  const darkIcon = document.querySelector(".dark-icon");

  if (currentTheme === "light") {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");
    currentTheme = "dark";
    lightIcon.style.display = "none";
    darkIcon.style.display = "block";
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    currentTheme = "light";
    lightIcon.style.display = "block";
    darkIcon.style.display = "none";
  }
  localStorage.setItem("theme", currentTheme);
}

// Initialize the application when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  // Get references to DOM elements
  elements.scrapeButton = document.getElementById("scrapeButton");
  elements.result = document.getElementById("result");
  elements.apiKeyInput = document.getElementById("apiKeyInput");
  elements.getAppsButton = document.getElementById("getAppsButton");
  elements.appsList = document.getElementById("appsList");
  elements.appDetail = document.getElementById("appDetail");
  elements.appTitle = document.getElementById("appTitle");
  elements.appDescription = document.getElementById("appDescription");
  elements.appInputs = document.getElementById("appInputs");
  elements.backButton = document.getElementById("backButton");

  // Check for stored API key and apps
  const storedApiKey = localStorage.getItem("wordwareApiKey");
  const storedApps = localStorage.getItem("wordwareApps");

  if (storedApiKey) {
    elements.apiKeyInput.value = storedApiKey;
  }

  if (storedApps) {
    displayAppsList(JSON.parse(storedApps));
  }

  // Always show the API key input and Get Apps button
  elements.apiKeyInput.style.display = "block";
  elements.getAppsButton.style.display = "block";

  // Add click event listener to the get apps button
  elements.getAppsButton.addEventListener("click", getApps);

  // Add click event listener to the back button
  elements.backButton.addEventListener("click", showAppsList);

  // Initialize theme
  currentTheme = localStorage.getItem("theme") || "light";
  const lightIcon = document.querySelector(".light-icon");
  const darkIcon = document.querySelector(".dark-icon");

  if (currentTheme === "dark") {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark-mode");
    lightIcon.style.display = "none";
    darkIcon.style.display = "block";
  } else {
    document.documentElement.classList.add("light");
    document.body.classList.add("light-mode");
    lightIcon.style.display = "block";
    darkIcon.style.display = "none";
  }

  // Add event listener for theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Show home view by default
  showHomeView();
}

function showHomeView() {
  document.getElementById("homeView").style.display = "block";
  document.getElementById("appDetailView").style.display = "none";
}

function showAppDetailView() {
  document.getElementById("homeView").style.display = "none";
  document.getElementById("appDetailView").style.display = "block";
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
function sendApiRequest(method, endpoint, body = null, apiKey = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  options.headers.Authorization = `Bearer ${apiKey}`;

  if (body) {
    options.body = JSON.stringify(body);
  }

  return sendMessage({
    type: "API_REQUEST",
    url: `https://api.wordware.ai/v1alpha/${endpoint}`,
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

// Function to handle errors and update the UI accordingly
function handleError(message, error) {
  console.error(message, error);
  elements.scrapeButton.disabled = false;
  elements.scrapeButton.textContent = "Scrape Contacts";
  elements.result.textContent = `Error: ${error.message}`;

  // Also reset the Get Apps button
  elements.getAppsButton.disabled = false;
  elements.getAppsButton.textContent = "Get Apps";
}

async function getApps() {
  const apiKey = elements.apiKeyInput.value.trim();
  if (!apiKey) {
    alert("Please enter an API key");
    return;
  }

  elements.getAppsButton.disabled = true;
  elements.getAppsButton.innerHTML =
    '<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

  try {
    const apps = await sendApiRequest("GET", "apps", null, apiKey);
    const appsWithDetails = await Promise.all(
      apps.map(async (app) => {
        const versions = await sendApiRequest(
          "GET",
          `apps/${app.orgSlug}/${app.appSlug}/versions`,
          null,
          apiKey
        );
        const latestVersion = versions[0];
        return {
          ...app,
          title: latestVersion.title || app.appSlug,
          description: latestVersion.description,
        };
      })
    );

    // Store the apps and API key in local storage
    localStorage.setItem("wordwareApps", JSON.stringify(appsWithDetails));
    localStorage.setItem("wordwareApiKey", apiKey);

    displayAppsList(appsWithDetails);
  } catch (error) {
    handleError("Error occurred while fetching apps", error);
  } finally {
    elements.getAppsButton.disabled = false;
    elements.getAppsButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 16h5v5"/>
      </svg>
    `;
  }
}

function displayAppsList(apps) {
  const currentAppsList = elements.appsList.innerHTML;
  const newAppsList = apps
    .map(
      (app) => `
    <div class="app-item" data-org-slug="${app.orgSlug}" data-app-slug="${
        app.appSlug
      }">
      <div class="app-title">${app.title || app.appSlug}</div>
    </div>
  `
    )
    .join("");

  if (currentAppsList !== newAppsList) {
    elements.appsList.innerHTML = newAppsList;
    elements.appsList.addEventListener("click", handleAppClick);
  }

  showHomeView();
}

async function handleAppClick(event) {
  const appItem = event.target.closest(".app-item");
  if (!appItem) return;

  const orgSlug = appItem.dataset.orgSlug;
  const appSlug = appItem.dataset.appSlug;
  const apiKey = elements.apiKeyInput.value.trim();

  try {
    const versions = await sendApiRequest(
      "GET",
      `apps/${orgSlug}/${appSlug}/versions`,
      null,
      apiKey
    );
    const latestVersion = versions[0];
    displayAppDetail(latestVersion, orgSlug, appSlug);
  } catch (error) {
    handleError("Error occurred while fetching app details", error);
  }
}

function displayAppDetail(app, orgSlug, appSlug) {
  elements.appTitle.textContent = app.title || appSlug;
  elements.appDescription.textContent =
    app.description || "No description available";

  elements.appInputs.innerHTML = app.inputs
    .map(
      (input) => `
    <div class="input-field">
      <label for="${input.name}">${input.name}</label>
      <div class="input-container">
        ${getInputElement(input)}
        <button class="select-page-content" data-input="${
          input.name
        }">Select Page Content</button>
      </div>
      <div class="page-content-badge" id="badge-${
        input.name
      }" style="display: none;">
        Page Content
        <span class="remove-badge" data-input="${input.name}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </span>
      </div>
    </div>
  `
    )
    .join("");

  // Add "Run App" button
  elements.appInputs.innerHTML += `
    <button id="runAppButton">Run App</button>
    <div id="appResult"></div>
  `;

  showAppDetailView();

  // Add event listeners for the new buttons
  document.querySelectorAll(".select-page-content").forEach((button) => {
    button.addEventListener("click", handleSelectPageContent);
  });

  document.querySelectorAll(".remove-badge").forEach((badge) => {
    badge.addEventListener("click", handleRemovePageContent);
  });

  // Add event listener for the "Run App" button
  document
    .getElementById("runAppButton")
    .addEventListener("click", () => runApp(app, orgSlug, appSlug));
}

function getInputElement(input) {
  switch (input.type) {
    case "longtext":
      return `<textarea id="${input.name}" placeholder="${input.description}"></textarea>`;
    case "text":
    case "image":
    case "audio":
    default:
      return `<input type="text" id="${input.name}" placeholder="${input.description}">`;
  }
}

function showAppsList() {
  showHomeView();
}

function handleSelectPageContent(event) {
  const inputName = event.target.dataset.input;
  const badgeElement = document.getElementById(`badge-${inputName}`);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        files: ["content.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error injecting script: " + chrome.runtime.lastError.message
          );
        } else {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { action: "activateSelection", inputName: inputName },
            function (response) {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
              } else if (response && response.success) {
                console.log("Selection mode activated");
              }
            }
          );
        }
      }
    );
  });
}

function handleRemovePageContent(event) {
  const inputName = event.target.closest(".remove-badge").dataset.input;
  const selectButton = document.querySelector(
    `.select-page-content[data-input="${inputName}"]`
  );
  const badgeElement = document.getElementById(`badge-${inputName}`);

  // Remove the stored page content
  delete selectButton.dataset.pageContent;
  badgeElement.style.display = "none";
}

async function runApp(app, orgSlug, appSlug) {
  const apiKey = elements.apiKeyInput.value.trim();
  if (!apiKey) {
    alert("Please enter an API key");
    return;
  }

  const runAppButton = document.getElementById("runAppButton");
  const appResult = document.getElementById("appResult");

  runAppButton.disabled = true;
  runAppButton.innerHTML = '<span class="loader"></span> Running App...';
  appResult.textContent = "";

  try {
    const inputs = {};
    app.inputs.forEach((input) => {
      const inputElement = document.getElementById(input.name);
      const selectButton = document.querySelector(
        `.select-page-content[data-input="${input.name}"]`
      );

      // Use page content if available, otherwise use input value
      inputs[input.name] =
        selectButton.dataset.pageContent || inputElement.value;
    });

    console.log("Sending run request with inputs:", inputs);

    const runResponse = await sendApiRequest(
      "POST",
      `apps/${orgSlug}/${appSlug}/${app.version}/runs`,
      { inputs },
      apiKey
    );

    console.log("Initial run response:", runResponse);

    if (runResponse && runResponse.runId) {
      await pollRunStatus(runResponse.runId, apiKey);
    } else {
      throw new Error("No runId received in the response");
    }
  } catch (error) {
    handleError("Error occurred while running the app", error);
  } finally {
    runAppButton.disabled = false;
    runAppButton.textContent = "Run App";
  }
}

async function pollRunStatus(runId, apiKey) {
  const appResult = document.getElementById("appResult");

  try {
    while (true) {
      const statusResponse = await sendApiRequest(
        "GET",
        `runs/${runId}`,
        null,
        apiKey
      );

      console.log("Run status response:", statusResponse);

      if (statusResponse.status === "COMPLETE") {
        if (
          statusResponse.outputs &&
          Object.keys(statusResponse.outputs).length > 0
        ) {
          // Dynamically parse and display the outputs
          let outputContent = "";
          for (const [key, value] of Object.entries(statusResponse.outputs)) {
            outputContent += `${key}:\n${JSON.stringify(value, null, 2)}\n\n`;
          }
          appResult.textContent = outputContent;
        } else {
          appResult.textContent =
            "Run completed, but no outputs were returned.\n\n";
          appResult.textContent +=
            "Full response:\n" + JSON.stringify(statusResponse, null, 2);
        }
        break;
      } else if (statusResponse.status === "FAILED") {
        throw new Error(
          "The run failed. Error: " +
            (statusResponse.errors?.[0]?.message || "Unknown error")
        );
      } else if (statusResponse.ask) {
        console.log("Ask received:", statusResponse.ask);
        appResult.textContent =
          "The app is asking for additional input:\n" +
          JSON.stringify(statusResponse.ask, null, 2);
        // You may want to implement a way to handle asks here
        break;
      }

      if (statusResponse.status !== "RUNNING") {
        appResult.textContent =
          "Run stopped with status: " + statusResponse.status + "\n\n";
        appResult.textContent +=
          "Full response:\n" + JSON.stringify(statusResponse, null, 2);
        break;
      }

      // Wait for 5 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    handleError("Error occurred while polling run status", error);
  }
}

// Add this new function to handle messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentSelected") {
    const { inputName, content } = message;
    const selectButton = document.querySelector(
      `.select-page-content[data-input="${inputName}"]`
    );
    const badgeElement = document.getElementById(`badge-${inputName}`);
    const inputElement = document.getElementById(inputName);

    selectButton.dataset.pageContent = content;
    badgeElement.style.display = "inline-flex";
    inputElement.value = content; // Update the input field with the selected content

    sendResponse({ success: true });
  }
});
