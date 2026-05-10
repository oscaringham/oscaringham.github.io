const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const spaceTouch = document.getElementById("spaceTouch");
const rTouch = document.getElementById("rTouch");
const cassetteEl = document.getElementById("cassette");

const GAME_DURATION_MS = 60000;
const GRAVITY = 1550;
const JUMP_VELOCITY = -620;
const OBSTACLE_SPEED = 270;

const LEVELS = [
  { color: "#ff003d", song: "01_missing_u_stem_drums.mp3" },
  { color: "#ff6700", song: "01_missing_u_stem_melody.mp3" },
  { color: "#33a8ff", song: "01_missing_u_stem_vocals.mp3" },
];

const skaterSprite = new Image();
skaterSprite.src = "skate_board.png";

let state = "idle";
let spaceHeld = false;
let rHeld = false;
let obstacleTimer = 0;
let gameStartTime = 0;
let lastFrameTime = 0;
let currentLevel = 0;
let audio = null;

const player = {
  x: 68,
  width: 90,
  height: 26,
  y: 0,
  velocityY: 0,
  grounded: true,
};

const obstacles = [];

function groundY() {
  return canvas.height - 10;
}

function applyLevelTheme(levelIndex) {
  const level = LEVELS[levelIndex];
  document.documentElement.style.setProperty("--level-color", level.color);
  if (audio) {
    audio.pause();
  }
  audio = new Audio(level.song);
  audio.loop = true;
}

function resetPlayer() {
  player.y = groundY() - player.height;
  player.velocityY = 0;
  player.grounded = true;
}

function resetGame() {
  state = "idle";
  obstacleTimer = randomObstacleDelay();
  obstacles.length = 0;
  resetPlayer();
  gameStartTime = 0;
}

function resetToLevelOne() {
  currentLevel = 0;
  applyLevelTheme(0);
  resetGame();
}

function startGame(now) {
  state = "running";
  gameStartTime = now;
  obstacleTimer = randomObstacleDelay();
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

function randomObstacleDelay() {
  return 0.75 + Math.random() * 0.8;
}

function spawnSoundwave() {
  const width = 38 + Math.floor(Math.random() * 16);
  const height = 56 + Math.floor(Math.random() * 30);
  obstacles.push({
    x: canvas.width + width,
    width,
    height,
  });
}

function jump() {
  if (!player.grounded || state !== "running") {
    return;
  }
  player.velocityY = JUMP_VELOCITY;
  player.grounded = false;
  cassetteEl.classList.remove("cassette-bounce");
  void cassetteEl.offsetWidth;
  cassetteEl.classList.add("cassette-bounce");
}

function pressSpace() {
  if (!spaceHeld) {
    spaceHeld = true;
    if (state === "idle" || state === "won") {
      startGame(performance.now());
    }
    jump();
  }
}

function releaseSpace() {
  spaceHeld = false;
}

function pressR() {
  if (!rHeld) {
    rHeld = true;
    if (state === "all_complete") {
      resetToLevelOne();
    } else {
      resetGame();
    }
  }
}

function releaseR() {
  rHeld = false;
}

function checkCollision(obstacle) {
  const playerLeft = player.x + 16;
  const playerRight = player.x + player.width - 16;
  const playerTop = player.y + 4;
  const playerBottom = player.y + player.height;

  const obstacleLeft = obstacle.x;
  const obstacleRight = obstacle.x + obstacle.width;

  if (playerRight <= obstacleLeft || playerLeft >= obstacleRight) {
    return false;
  }

  // Compute arch height at player centre using parabolic approximation of the Bézier
  const playerCenterX = (playerLeft + playerRight) / 2;
  const u = Math.max(0, Math.min(1, (playerCenterX - obstacleLeft) / obstacle.width));
  const archHeight = obstacle.height * 4 * u * (1 - u);
  const archTop = groundY() - archHeight;

  return playerBottom > archTop && playerTop < groundY();
}

function update(deltaSeconds, now) {
  if (state !== "running") {
    return;
  }

  const elapsed = now - gameStartTime;
  if (elapsed >= GAME_DURATION_MS) {
    if (audio) {
      audio.pause();
    }
    if (currentLevel < LEVELS.length - 1) {
      currentLevel += 1;
      applyLevelTheme(currentLevel);
      state = "won";
    } else {
      state = "all_complete";
    }
    return;
  }

  player.velocityY += GRAVITY * deltaSeconds;
  player.y += player.velocityY * deltaSeconds;

  const floor = groundY() - player.height;
  if (player.y >= floor) {
    player.y = floor;
    player.velocityY = 0;
    player.grounded = true;
  }

  obstacleTimer -= deltaSeconds;
  if (obstacleTimer <= 0) {
    spawnSoundwave();
    obstacleTimer = randomObstacleDelay();
  }

  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i];
    obstacle.x -= OBSTACLE_SPEED * deltaSeconds;

    if (checkCollision(obstacle)) {
      state = "crashed";
      if (audio) {
        audio.pause();
      }
    }

    if (obstacle.x + obstacle.width < -12) {
      obstacles.splice(i, 1);
    }
  }
}

function drawGroundLine() {
  const y = groundY();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(canvas.width, y);
  ctx.stroke();
}

function drawSoundwave(obstacle) {
  const baseY = groundY();
  const centerX = obstacle.x + obstacle.width * 0.5;
  const topY = baseY - obstacle.height;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(obstacle.x, baseY);
  ctx.quadraticCurveTo(centerX, topY, obstacle.x + obstacle.width, baseY);
  ctx.stroke();
}

function drawStatus() {
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px 'Courier New', monospace";
  ctx.textAlign = "left";

  if (state === "idle") {
    ctx.fillText(`LEVEL ${currentLevel + 1} OF ${LEVELS.length}`, 20, 30);
    ctx.fillText("TAP JUMP TO START", 20, 52);
  }

  if (state === "running") {
    const left = Math.max(0, GAME_DURATION_MS - (performance.now() - gameStartTime));
    const seconds = Math.ceil(left / 1000);
    ctx.fillText(`TIME: ${seconds}s`, 20, 30);
  }

  if (state === "crashed") {
    ctx.fillStyle = "#ff4f4f";
    ctx.fillText("CRASHED", 20, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("TAP RESTART", 20, 52);
  }

  if (state === "won") {
    ctx.fillStyle = "#54ff8e";
    ctx.fillText(`LEVEL ${currentLevel} COMPLETE`, 20, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`TAP JUMP FOR LEVEL ${currentLevel + 1}`, 20, 52);
  }

  if (state === "all_complete") {
    ctx.fillStyle = "#54ff8e";
    ctx.fillText("ALL TAPES UNLOCKED", 20, 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("TAP RESTART TO REPLAY", 20, 52);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGroundLine();

  for (const obstacle of obstacles) {
    drawSoundwave(obstacle);
  }

  if (skaterSprite.complete) {
    ctx.drawImage(skaterSprite, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  drawStatus();
}

function tick(now) {
  if (!lastFrameTime) {
    lastFrameTime = now;
  }
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  update(deltaSeconds, now);
  render();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    pressSpace();
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    pressR();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    releaseSpace();
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    releaseR();
  }
});

function bindTouchButton(button, press, release) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press();
  });

  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    release();
  });

  button.addEventListener("pointercancel", () => {
    release();
  });

  button.addEventListener("pointerleave", () => {
    release();
  });
}

bindTouchButton(spaceTouch, pressSpace, releaseSpace);
bindTouchButton(rTouch, pressR, releaseR);

applyLevelTheme(0);
resetGame();
requestAnimationFrame(tick);
