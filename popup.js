// Configuration constants
const CONFIG = {
  apiKey: "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT",
  orgSlug: "isaac-dyor-d74b42",
  appSlug: "3e4c59f3-7289-4bbd-b00d-517546444317",
  version: "latest",
  apiBaseUrl: "https://api.wordware.ai/v1alpha",
};

let lastRunId = null;

// DOM Elements
const elements = {
  runApp: null,
  status: null,
  result: null,
};

// Initialize the application
document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  elements.runApp = document.getElementById("runApp");
  elements.status = document.getElementById("runStatus");
  elements.result = document.getElementById("result");

  elements.runApp.addEventListener("click", runApp);
}

async function runApp() {
  updateStatus("Initiating app run...");
  elements.result.textContent = "";

  try {
    const runResponse = await sendApiRequest(
      "POST",
      `apps/${CONFIG.orgSlug}/${CONFIG.appSlug}/${CONFIG.version}/runs`,
      {
        inputs: {
          page_contents:
            "Hello, World! i am isaac the king of the world. I have a dream to be the king of the world and i am the king of the world but one day i will be the queen of the world",
        },
      }
    );

    if (runResponse && runResponse.runId) {
      lastRunId = runResponse.runId;
      updateStatus("Run initiated. Checking status...");
      await pollRunStatus(lastRunId);
    } else {
      throw new Error("No runId received in the response");
    }
  } catch (error) {
    handleError("Error occurred", error);
  }
}

async function pollRunStatus(runId) {
  try {
    while (true) {
      const statusResponse = await sendApiRequest("GET", `runs/${runId}`);

      if (statusResponse) {
        updateStatus(`Run Status: ${statusResponse.status || "Unknown"}`);

        if (statusResponse.status === "COMPLETE") {
          elements.status.className = "success";
          elements.result.textContent =
            statusResponse.outputs?.summarize ||
            "Summarization not found in the output.";
          break;
        } else if (statusResponse.status === "FAILED") {
          throw new Error("The run failed. Please try again.");
        }
      } else {
        throw new Error("Unable to fetch run status");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
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

function updateStatus(message, className = "") {
  elements.status.textContent = message;
  elements.status.className = className;
}

function handleError(message, error) {
  console.error(message, error);
  updateStatus(message, "failure");
  elements.result.textContent = `Error: ${error.message}`;
}
