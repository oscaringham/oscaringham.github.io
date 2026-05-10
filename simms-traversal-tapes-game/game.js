const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const spaceTouch = document.getElementById("spaceTouch");
const rTouch = document.getElementById("rTouch");
const cassetteEl = document.getElementById("cassette");

const GAME_DURATION_MS = 60000;
const GRAVITY = 1550;
const JUMP_VELOCITY = -620;
const OBSTACLE_SPEED = 270;
const JIGGLE_DURATION = 400;
const ANIM_DIST = 80;

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
let playerJiggleStart = -Infinity;

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
  playerJiggleStart = performance.now();
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

function getObstacleScale(obstacle) {
  const centerX = obstacle.x + obstacle.width / 2;
  let scale = 1;
  if (centerX > canvas.width - ANIM_DIST) {
    scale = (canvas.width - centerX) / ANIM_DIST;
  } else if (centerX < ANIM_DIST) {
    scale = centerX / ANIM_DIST;
  }
  return Math.max(0, Math.min(1, scale));
}

function checkCollision(obstacle) {
  const scale = getObstacleScale(obstacle);
  const playerLeft = player.x + 16;
  const playerRight = player.x + player.width - 16;
  const playerTop = player.y + 4;
  const playerBottom = player.y + player.height;

  const centerX = obstacle.x + obstacle.width / 2;
  const obstacleLeft = centerX - (obstacle.width / 2) * scale;
  const obstacleRight = centerX + (obstacle.width / 2) * scale;

  if (playerRight <= obstacleLeft || playerLeft >= obstacleRight) {
    return false;
  }

  const playerCenterX = (playerLeft + playerRight) / 2;
  const effectiveWidth = obstacle.width * scale;
  const u = effectiveWidth > 0
    ? Math.max(0, Math.min(1, (playerCenterX - obstacleLeft) / effectiveWidth))
    : 0;
  const archHeight = obstacle.height * scale * 4 * u * (1 - u);
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
  const scale = getObstacleScale(obstacle);
  const baseY = groundY();
  const centerX = obstacle.x + obstacle.width / 2;
  const halfWidth = (obstacle.width / 2) * scale;
  const topY = baseY - obstacle.height * scale;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(centerX - halfWidth, baseY);
  ctx.quadraticCurveTo(centerX, topY, centerX + halfWidth, baseY);
  ctx.stroke();
}

function drawPlayer() {
  const jiggleElapsed = performance.now() - playerJiggleStart;
  if (!skaterSprite.complete) {
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    return;
  }
  if (jiggleElapsed < JIGGLE_DURATION) {
    const t = jiggleElapsed / JIGGLE_DURATION;
    const angle = Math.sin(t * Math.PI * 4) * 0.14 * (1 - t);
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(skaterSprite, -player.width / 2, -player.height / 2, player.width, player.height);
    ctx.restore();
  } else {
    ctx.drawImage(skaterSprite, player.x, player.y, player.width, player.height);
  }
}

function drawStatus() {
  const cx = canvas.width / 2;
  ctx.textAlign = "center";

  if (state === "idle") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 26px 'Inter', sans-serif";
    ctx.fillText(`LEVEL ${currentLevel + 1} OF ${LEVELS.length}`, cx, 42);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "400 14px 'Inter', sans-serif";
    ctx.fillText(LEVELS[currentLevel].song, cx, 64);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px 'Inter', sans-serif";
    ctx.fillText("TAP JUMP TO START", cx, 112);
  }

  if (state === "running") {
    const left = Math.max(0, GAME_DURATION_MS - (performance.now() - gameStartTime));
    const seconds = Math.ceil(left / 1000);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 22px 'Inter', sans-serif";
    ctx.fillText(`${seconds}s`, cx, 42);
  }

  if (state === "crashed") {
    ctx.fillStyle = "#ff4f4f";
    ctx.font = "700 22px 'Inter', sans-serif";
    ctx.fillText("CRASHED", cx, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px 'Inter', sans-serif";
    ctx.fillText("TAP RESTART", cx, 68);
  }

  if (state === "won") {
    ctx.fillStyle = "#54ff8e";
    ctx.font = "700 22px 'Inter', sans-serif";
    ctx.fillText(`LEVEL ${currentLevel} COMPLETE`, cx, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px 'Inter', sans-serif";
    ctx.fillText(`TAP JUMP FOR LEVEL ${currentLevel + 1}`, cx, 68);
  }

  if (state === "all_complete") {
    ctx.fillStyle = "#54ff8e";
    ctx.font = "700 22px 'Inter', sans-serif";
    ctx.fillText("ALL TAPES UNLOCKED", cx, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px 'Inter', sans-serif";
    ctx.fillText("TAP RESTART TO REPLAY", cx, 68);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGroundLine();

  for (const obstacle of obstacles) {
    drawSoundwave(obstacle);
  }

  drawPlayer();
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
document.fonts.ready.then(() => requestAnimationFrame(tick));
