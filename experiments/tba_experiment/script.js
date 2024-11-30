// Load JSON data
fetch("game.json")
  .then((response) => response.json())
  .then((data) => startGame(data));

let currentScenarioId = "1"; // Starting scenario ID
let gameData = {};

function startGame(data) {
  gameData = data;
  displayScenario(currentScenarioId);
}

function displayScenario(scenarioId) {
  const scenario = gameData[scenarioId];
  const scenarioElement = document.getElementById("scenario");
  const choicesElement = document.getElementById("choices");

  scenarioElement.innerHTML = `<h2>${scenario.character}</h2><p>${scenario.description}</p>`;
  choicesElement.innerHTML = "";

  for (const [choice, nextScenarioId] of Object.entries(scenario.choices)) {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.innerText = choice;
    button.onclick = () => displayScenario(nextScenarioId);
    choicesElement.appendChild(button);
  }
}
