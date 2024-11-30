const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const stateInput = document.getElementById("stateInput");
const getNextStateButton = document.getElementById("getNextState");
const drawButton = document.getElementById("draw");
const playButton = document.getElementById("play");
const pauseButton = document.getElementById("pause");
const genPerSecondInput = document.getElementById("genPerSecond");
let intervalId = 0;

// Get a reference to the checkbox element
const checkbox = document.getElementById("afterimage");
const genPerSecond = document.getElementById("genPerSecond");

// Initialize a boolean variable to store the checkbox state
let afterimage = false;

playButton.addEventListener("click", () => {
  let intervalLength = 1000 / parseFloat(genPerSecond.value);
  console.log(`playing with a new generation every ${intervalLength}ms`);

  //set interval only if an existing interval is not running
  if (intervalId == 0) {
    intervalId = setInterval(drawNextGeneration, intervalLength);
  }
});

pauseButton.addEventListener("click", () => {
  clearInterval(intervalId);
  intervalId = 0;
});

getNextStateButton.addEventListener("click", drawNextGeneration);

drawButton.addEventListener("click", drawThisGeneration);

checkbox.addEventListener("change", () => {
  afterimage = checkbox.checked;
  console.log("Checkbox is checked:", isChecked);
});

const sampleState = [
  // [xcoordinate, ycoordinate, velocityX, velocityY, chargeType, chargeValue, mass]
  [150, 200, 0, 0, 0, 10, 20],
  [350, 200, 0, 0, 1, 10, 20],
];

function drawNextGeneration() {
  const particles = parseInputState(stateInput.value);
  const newParticles = getNextState(particles);
  let newStateString = stringifyInputState(newParticles);
  stateInput.value = newStateString;
  console.log(newStateString);
  drawWorld(particles, afterimage);
  return newStateString;
}

function drawThisGeneration() {
  const particles = parseInputState(stateInput.value);
  drawWorld(particles, afterimage);
}

function drawWorld(particles, afterimage) {
  const { width, height } = canvas.getBoundingClientRect();
  if (afterimage == true) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  } else {
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
  }
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    particle = particles[i];
    if (particle.chargeType == 0) {
      ctx.fillStyle = "#800";
      ctx.strokeStyle = "#C00";
    } else if (particle.chargeType == 1) {
      ctx.fillStyle = "#228";
      ctx.strokeStyle = "#44C";
    } else {
      ctx.fillStyle = "#880";
      ctx.strokeStyle = "#CC0";
    }

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.arc(
      particle.position.x,
      particle.position.y,
      particle.mass,
      0,
      2 * Math.PI
    );
    ctx.fill();

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.arc(
      particle.position.x,
      particle.position.y,
      particle.charge,
      0,
      2 * Math.PI
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.moveTo(particle.position.x, particle.position.y);
    ctx.lineTo(
      particle.position.x + particle.velocity.x * 5,
      particle.position.y + particle.velocity.y * 5
    );
    ctx.stroke();
  }
}

function getNextState(particles) {
  let newParticles = [];
  for (let i = 0; i < particles.length; i++) {
    let fx = 0;
    let fy = 0;
    const p1 = particles[i];
    for (let j = 0; j < particles.length; j++) {
      const p2 = particles[j];
      if (i == j) {
        continue;
      }
      const [nfx, nfy] = calculateForce(p1, p2);
      fx += nfx;
      fy += nfy;
    }
    ax = fx / p1.mass;
    ay = fy / p1.mass;
    vx = p1.velocity.x + ax;
    vy = p1.velocity.y + ay;
    px = p1.position.x + vx;
    py = p1.position.y + vy;
    newParticles.push({
      position: {
        x: dec2(px),
        y: dec2(py),
      },
      velocity: {
        x: dec2(vx),
        y: dec2(vy),
      },
      chargeType: dec2(p1.chargeType),
      charge: dec2(p1.charge),
      mass: dec2(p1.mass),
    });
  }

  return newParticles;

  //internal functions after this

  function calculateForce(p1, p2) {
    const [xcomp, ycomp] = calculateComponents(p1, p2);
    const distance = calculateDistance(p1, p2);
    if (distance < 10) {
      return [0, 0];
    }
    let f = ((p1.charge * p2.charge) / distance) * 10;
    if (
      (p1.chargeType == 0 && p2.chargeType == 1) ||
      (p1.chargeType == 1 && p2.chargeType == 0)
    ) {
      f = f * -1;
    } else if (
      (p1.chargeType == 0 && p2.chargeType == 0) ||
      (p1.chargeType == 1 && p2.chargeType == 1) ||
      (p1.chargeType == 2 && p2.chargeType == 2)
    ) {
      f = 0;
    } else if (p1.chargeType == 2) {
      if (p2.chargeType == 1) {
        f = f * 1;
      } else if (p2.chargeType == 0) {
        f = f * -1;
      }
    } else {
      f = 0;
    }
    return [f * xcomp, f * ycomp];
  }

  function calculateDistance(p1, p2) {
    return Math.sqrt(
      Math.pow(p1.position.x - p2.position.x, 2) +
        Math.pow(p1.position.y - p2.position.y, 2)
    );
  }

  function calculateComponents(p1, p2) {
    return [
      (p1.position.x - p2.position.x) / calculateDistance(p1, p2),
      (p1.position.y - p2.position.y) / calculateDistance(p1, p2),
    ];
  }
}

function parseInputState(inputStateString) {
  let inputStateJson;
  let parsedInputState = [];
  try {
    inputStateJson = JSON.parse(inputStateString);
  } catch (err) {
    alert(err);
    throw err;
  }

  if (!Array.isArray(inputStateJson)) {
    alert("Input JSON is not an array");
  }

  for (let i = 0; i < inputStateJson.length; i++) {
    if (!Array.isArray(inputStateJson[i])) {
      alert(`Element with index ${i} in Input JSON is not an array`);
    }

    let particle = getParticle(inputStateJson[i]);

    // Add particle domain validations here

    parsedInputState.push(particle);
  }
  return parsedInputState;
}

function stringifyInputState(particles) {
  returnJson = [];
  for (let i = 0; i < particles.length; i++) {
    returnJson.push(getArrayFromParticle(particles[i]));
  }
  return JSON.stringify(returnJson);
}

function getParticle(stateItem) {
  return {
    position: {
      x: stateItem[0],
      y: stateItem[1],
    },
    velocity: {
      x: stateItem[2],
      y: stateItem[3],
    },
    chargeType: stateItem[4],
    charge: stateItem[5],
    mass: stateItem[6],
  };
}

function getArrayFromParticle(p) {
  return [
    p.position.x,
    p.position.y,
    p.velocity.x,
    p.velocity.y,
    p.chargeType,
    p.charge,
    p.mass,
  ];
}

function dec2(a) {
  return Math.floor(a * 100) / 100;
}

function nextGen(json) {
  return JSON.parse(
    stringifyInputState(getNextState(parseInputState(JSON.stringify(json))))
  );
}

drawThisGeneration();
