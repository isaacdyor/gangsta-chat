document.addEventListener("DOMContentLoaded", function () {
  const runAppButton = document.getElementById("runApp");
  runAppButton.addEventListener("click", runApp);

  // Add new button for checking status
  const checkStatusButton = document.getElementById("checkStatus");
  checkStatusButton.addEventListener("click", checkLastRunStatus);
});

const apiKey = "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT";
const orgSlug = "isaac-dyor-d74b42";
const appSlug = "3e4c59f3-7289-4bbd-b00d-517546444317";
const version = "latest"; // You can change this if you want to use a specific version

let lastRunId = null; // Store the last run ID

async function runApp() {
  const resultElement = document.getElementById("result");
  const statusElement = document.getElementById("runStatus");
  statusElement.textContent = "Initiating app run...";
  statusElement.className = "";
  resultElement.textContent = "";

  try {
    // First API call to initiate the run
    const runResponse = await sendMessage({
      type: "API_REQUEST",
      url: `https://api.wordware.ai/v1alpha/apps/${orgSlug}/${appSlug}/${version}/runs`,
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            page_contents:
              "Hello, World! i am isaac the king of the world. I have a dream to be the king of the world and i am the king of the world but one day i will be the queen of the world",
          },
        }),
      },
    });

    if (runResponse && runResponse.runId) {
      lastRunId = runResponse.runId;
      statusElement.textContent = "Run initiated. Checking status...";
      await checkRunStatus(lastRunId);
    } else {
      throw new Error("No runId received in the response");
    }
  } catch (error) {
    console.error("Error:", error);
    statusElement.textContent = "Failure: Error occurred";
    statusElement.className = "failure";
    resultElement.textContent = "Error: " + error.message;
  }
}

async function checkRunStatus(runId) {
  const statusElement = document.getElementById("runStatus");
  const resultElement = document.getElementById("result");

  try {
    const statusResponse = await sendMessage({
      type: "API_REQUEST",
      url: `https://api.wordware.ai/v1alpha/runs/${runId}`,
      options: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });

    if (statusResponse) {
      statusElement.textContent = `Run Status: ${
        statusResponse.status || "Unknown"
      }`;
      statusElement.className =
        statusResponse.status === "completed" ? "success" : "";
      resultElement.textContent = JSON.stringify(statusResponse, null, 2);
    } else {
      statusElement.textContent = "Unable to fetch run status";
      statusElement.className = "failure";
      resultElement.textContent =
        "Failed to fetch run status. Response:\n\n" +
        JSON.stringify(statusResponse, null, 2);
    }
  } catch (error) {
    console.error("Error checking run status:", error);
    statusElement.textContent = "Failure: Error occurred while checking status";
    statusElement.className = "failure";
    resultElement.textContent = "Error: " + error.message;
  }
}

function checkLastRunStatus() {
  if (lastRunId) {
    checkRunStatus(lastRunId);
  } else {
    const statusElement = document.getElementById("runStatus");
    statusElement.textContent = "No previous run to check";
    statusElement.className = "failure";
  }
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
