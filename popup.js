// Configuration constants
const CONFIG = {
  apiKey: "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT",
  orgSlug: "isaac-dyor-d74b42",
  appSlug: "318cfdc8-ebf9-46a6-beb3-3b1953926f93",
  version: "latest",
  apiBaseUrl: "https://api.wordware.ai/v1alpha",
};

let lastRunId = null;

// DOM Elements
const elements = {
  scrapeButton: null,
  result: null,
};

// Initialize the application
document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  elements.scrapeButton = document.getElementById("scrapeButton");
  elements.result = document.getElementById("result");

  elements.scrapeButton.addEventListener("click", runApp);
}

async function runApp() {
  setScrapingState();

  try {
    const pageContent = await getPageContent();
    if (pageContent) {
      await initiateApiRun(pageContent);
    } else {
      throw new Error("Failed to retrieve page content");
    }
  } catch (error) {
    handleError("Error occurred", error);
  }
}

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

async function initiateApiRun(pageContent) {
  try {
    const runResponse = await sendApiRequest(
      "POST",
      `apps/${CONFIG.orgSlug}/${CONFIG.appSlug}/${CONFIG.version}/runs`,
      {
        inputs: {
          company_list: pageContent,
        },
      }
    );

    if (runResponse && runResponse.runId) {
      lastRunId = runResponse.runId;
      await pollRunStatus(lastRunId);
    } else {
      throw new Error("No runId received in the response");
    }
  } catch (error) {
    throw error;
  }
}

async function pollRunStatus(runId) {
  try {
    while (true) {
      const statusResponse = await sendApiRequest("GET", `runs/${runId}`);

      if (statusResponse) {
        if (statusResponse.status === "COMPLETE") {
          setResultsState(
            statusResponse.outputs?.answer || "No results found."
          );
          break;
        } else if (statusResponse.status === "FAILED") {
          throw new Error("The run failed. Please try again.");
        }
      } else {
        throw new Error("Unable to fetch run status");
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    handleError("Error occurred while checking status", error);
  }
}

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

function setScrapingState() {
  elements.scrapeButton.disabled = true;
  elements.scrapeButton.innerHTML = '<span class="loader"></span> Scraping...';
  elements.result.textContent = "";
}

function setResultsState(results) {
  elements.scrapeButton.disabled = false;
  elements.scrapeButton.textContent = "Scrape Contacts";
  elements.result.textContent = results;
}

function handleError(message, error) {
  console.error(message, error);
  elements.scrapeButton.disabled = false;
  elements.scrapeButton.textContent = "Scrape Contacts";
  elements.result.textContent = `Error: ${error.message}`;
}
