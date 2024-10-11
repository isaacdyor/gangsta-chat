document.addEventListener("DOMContentLoaded", function () {
  const runAppButton = document.getElementById("runApp");
  runAppButton.addEventListener("click", runApp);
});

const apiKey = "ww-EJMMJyem1tLB8E7PNXcOQto2sxllGFDUnIc96uJknQmxurpaKrihUT";
const orgSlug = "isaac-dyor-d74b42";
const appSlug = "3e4c59f3-7289-4bbd-b00d-517546444317";
const version = "latest";

let lastRunId = null;

async function runApp() {
  const statusElement = document.getElementById("runStatus");
  const resultElement = document.getElementById("result");
  statusElement.textContent = "Initiating app run...";
  statusElement.className = "";
  resultElement.textContent = "";

  try {
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
      await pollRunStatus(lastRunId);
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

async function pollRunStatus(runId) {
  const statusElement = document.getElementById("runStatus");
  const resultElement = document.getElementById("result");

  try {
    while (true) {
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
        if (statusResponse.status === "COMPLETE") {
          statusElement.textContent = "Run Status: COMPLETE";
          statusElement.className = "success";
          if (statusResponse.outputs && statusResponse.outputs.summarize) {
            resultElement.textContent = statusResponse.outputs.summarize;
          } else {
            resultElement.textContent =
              "Summarization not found in the output.";
          }
          break; // Exit the loop when the status is COMPLETE
        } else if (statusResponse.status === "FAILED") {
          statusElement.textContent = "Run Status: FAILED";
          statusElement.className = "failure";
          resultElement.textContent = "The run failed. Please try again.";
          break; // Exit the loop if the status is FAILED
        } else {
          statusElement.textContent = `Run Status: ${
            statusResponse.status || "Unknown"
          }`;
          // Don't update the result element for non-COMPLETE statuses
        }
      } else {
        throw new Error("Unable to fetch run status");
      }

      // Wait for 5 seconds before the next poll
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Error checking run status:", error);
    statusElement.textContent = "Failure: Error occurred while checking status";
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
