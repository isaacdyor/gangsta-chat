document.addEventListener("DOMContentLoaded", function () {
  const fetchAppsButton = document.getElementById("fetchApps");
  fetchAppsButton.addEventListener("click", fetchApps);

  const runAppButton = document.getElementById("runApp");
  runAppButton.addEventListener("click", runApp);
});

const apiKey = "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT";
const orgSlug = "isaac-dyor-d74b42";
const appSlug = "3e4c59f3-7289-4bbd-b00d-517546444317";
const version = "latest"; // You can change this if you want to use a specific version

async function fetchApps() {
  const appListElement = document.getElementById("appList");
  appListElement.innerHTML = "Loading...";

  try {
    const response = await sendMessage({
      type: "API_REQUEST",
      url: "https://api.wordware.ai/v1alpha/apps/",
      options: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });

    displayApps(response.data);
  } catch (error) {
    console.error("Error fetching apps:", error);
    appListElement.innerHTML =
      "Error fetching apps. Please check the console for details.";
  }
}

function displayApps(apps) {
  const appListElement = document.getElementById("appList");
  appListElement.innerHTML = "<h2>Wordware Apps:</h2>";

  const ul = document.createElement("ul");
  apps.forEach((app) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${app.appSlug}</strong> (${app.orgSlug})<br>
      Visibility: ${app.visibility}<br>
      Latest Version: ${app.latestVersion}<br>
      Created: ${new Date(app.created).toLocaleString()}<br>
      Last Updated: ${new Date(app.lastUpdated).toLocaleString()}
    `;
    ul.appendChild(li);
  });

  appListElement.appendChild(ul);
}

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
            string: "Hello, World!",
          },
        }),
      },
    });

    if (runResponse && runResponse.runId) {
      const runId = runResponse.runId;
      statusElement.textContent = "Run initiated. Checking status...";

      // Second API call to check the run status
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
