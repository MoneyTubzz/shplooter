const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// INPUT
const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// PLAYER
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  color: "lime",
  speed: 3,
  fireRate: 400,
  lastShot: 0,
  hp: 100,
  maxHp: 100,
  damage: 1,
  level: 1,
  xp: 0,
  xpToNext: 50
};

// ARRAYS
let bullets = [];
let enemies = [];
let loot = [];
let xpOrbs = [];
let score = 0;
let lastEnemySpawn = 0;
let gameOver = false;
let paused = false;
let choosingUpgrade = false;
let showPauseMenu = false;

// RESET LOGIC (hold R)
let resetHoldStart = null;
let resetProgress = 0;

// --- Utility ---
function rand(min, max) { return Math.random() * (max - min) + min; }

// --- Reset ---
function resetGame() {
  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height / 2,
    hp: player.maxHp,
    speed: 3,
    fireRate: 400,
    damage: 1,
    level: 1,
    xp: 0,
    xpToNext: 50
  });
  bullets = [];
  enemies = [];
  loot = [];
  xpOrbs = [];
  score = 0;
  gameOver = false;
  paused = false;
  choosingUpgrade = false;
  showPauseMenu = false;
  resetHoldStart = null;
  resetProgress = 0;
}

// --- Spawning ---
function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch (edge) {
    case 0: x = Math.random() * canvas.width; y = -20; break;
    case 1: x = canvas.width + 20; y = Math.random() * canvas.height; break;
    case 2: x = Math.random() * canvas.width; y = canvas.height + 20; break;
    case 3: x = -20; y = Math.random() * canvas.height; break;
  }
  const speed = 1.4 + Math.random() * 0.3 + player.level * 0.1;
  const hp = 2 + Math.floor(Math.random() * 2 + player.level * 0.4);
  enemies.push({ x, y, size: 20, speed, hp });
}

// --- XP & Level ---
function gainXP(amount) {
  player.xp += amount;
  if (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.5);
    triggerLevelUp();
  }
}

function triggerLevelUp() {
  paused = true;
  choosingUpgrade = true;
  upgradeChoices = pickUpgrades();
}

// --- Shooting ---
function getNearestEnemy() {
  if (enemies.length === 0) return null;
  let nearest = enemies[0];
  let nearestDist = Infinity;
  for (const e of enemies) {
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearest = e;
      nearestDist = dist;
    }
  }
  return nearest;
}

function shootBullet(target) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  const velX = (dx / mag) * 5;
  const velY = (dy / mag) * 5;
  bullets.push({ x: player.x, y: player.y, velX, velY, size: 6, damage: player.damage });
}

// --- Loot ---
function dropLoot(x, y) {
  if (Math.random() < 0.08) {
    const types = ["heal", "speed", "firerate"];
    const type = types[Math.floor(Math.random() * types.length)];
    const color = type === "heal" ? "lime" : type === "speed" ? "cyan" : "yellow";
    loot.push({ x, y, size: 10, type, color });
  }
}

function collectLoot(l) {
  switch (l.type) {
    case "heal":
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case "speed":
      player.speed += 1;
      setTimeout(() => (player.speed -= 1), 5000);
      break;
    case "firerate":
      player.fireRate *= 0.8;
      setTimeout(() => (player.fireRate /= 0.8), 5000);
      break;
  }
}

// --- XP Orbs ---
function dropXP(x, y) {
  const amount = Math.floor(rand(8, 15));
  xpOrbs.push({ x, y, size: 6, value: amount, color: "aqua" });
}

// --- Upgrade System ---
const upgradePool = [
  { name: "Increase Damage", apply: () => (player.damage += 0.5) },
  { name: "Increase Max HP", apply: () => (player.maxHp += 20, player.hp += 20) },
  { name: "Increase Speed", apply: () => (player.speed += 0.5) },
  { name: "Faster Fire Rate", apply: () => (player.fireRate *= 0.85) },
  { name: "Regeneration", apply: () => {
      const regen = setInterval(() => {
        if (player.hp < player.maxHp && !gameOver && !paused) player.hp += 0.5;
      }, 500);
      setTimeout(() => clearInterval(regen), 15000);
    }
  }
];

let upgradeChoices = [];

function pickUpgrades() {
  const choices = [];
  while (choices.length < 3) {
    const pick = upgradePool[Math.floor(Math.random() * upgradePool.length)];
    if (!choices.includes(pick)) choices.push(pick);
  }
  return choices;
}

function chooseUpgrade(index) {
  upgradeChoices[index].apply();
  choosingUpgrade = false;
  paused = false;
}

// --- Update ---
function update() {
  if (gameOver || paused) return;

  if (keys["w"] || keys["arrowup"]) player.y -= player.speed;
  if (keys["s"] || keys["arrowdown"]) player.y += player.speed;
  if (keys["a"] || keys["arrowleft"]) player.x -= player.speed;
  if (keys["d"] || keys["arrowright"]) player.x += player.speed;

  player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
  player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));

  const now = performance.now();
  if (now - player.lastShot > player.fireRate) {
    const target = getNearestEnemy();
    if (target) {
      shootBullet(target);
      player.lastShot = now;
    }
  }

  bullets.forEach(b => { b.x += b.velX; b.y += b.velY; });
  bullets = bullets.filter(b => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height);

  if (now - lastEnemySpawn > Math.max(1500 - player.level * 80, 400)) {
    spawnEnemy();
    lastEnemySpawn = now;
  }

  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    e.x += (dx / mag) * e.speed;
    e.y += (dy / mag) * e.speed;
  }

  // Bullets vs enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < e.size / 2 + b.size / 2) {
        e.hp -= b.damage;
        bullets.splice(j, 1);
        if (e.hp <= 0) {
          enemies.splice(i, 1);
          score++;
          dropXP(e.x, e.y);
          dropLoot(e.x, e.y);
          break;
        }
      }
    }
  }

  // Enemy-player
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < e.size / 2 + player.size / 2) {
      player.hp -= 10;
      enemies.splice(i, 1);
      if (player.hp <= 0) gameOver = true;
    }
  }

  // XP pickup + magnet pull
  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const xp = xpOrbs[i];
    const dx = player.x - xp.x;
    const dy = player.y - xp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const pullRadius = 140;
    const pickupRadius = 30;

    if (dist < pullRadius && dist > pickupRadius) {
      xp.x += (dx / dist) * 2.2;
      xp.y += (dy / dist) * 2.2;
    }

    if (dist < pickupRadius) {
      gainXP(xp.value);
      xpOrbs.splice(i, 1);
    }
  }

  // Loot pickup
  for (let i = loot.length - 1; i >= 0; i--) {
    const l = loot[i];
    const dx = l.x - player.x;
    const dy = l.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.size / 2 + l.size / 2) {
      collectLoot(l);
      loot.splice(i, 1);
    }
  }
}

// --- Draw ---
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#050505");
  g.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHUD() {
  ctx.fillStyle = "white";
  ctx.font = "18px monospace";
  ctx.fillText(`Score: ${score}`, 10, 25);

  const hpBar = 200;
  ctx.fillStyle = "red";
  ctx.fillRect(10, 40, hpBar, 12);
  ctx.fillStyle = "lime";
  ctx.fillRect(10, 40, (player.hp / player.maxHp) * hpBar, 12);
  ctx.strokeStyle = "#333";
  ctx.strokeRect(10, 40, hpBar, 12);

  ctx.fillStyle = "blue";
  ctx.fillRect(10, 58, (player.xp / player.xpToNext) * hpBar, 8);
  ctx.strokeRect(10, 58, hpBar, 8);
  ctx.fillStyle = "white";
  ctx.font = "12px monospace";
  ctx.fillText(`Lv ${player.level}`, 220, 66);
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "48px monospace";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "24px monospace";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
  ctx.textAlign = "left";
}

function drawPauseMenu() {
  drawOverlay("PAUSED", "Press ESC or P to Resume");
  ctx.textAlign = "center";
  ctx.font = "20px monospace";
  ctx.fillText("Hold R for 2 seconds to Reset", canvas.width / 2, canvas.height / 2 + 80);
  ctx.textAlign = "left";
  if (resetHoldStart) {
    const elapsed = (performance.now() - resetHoldStart) / 2000;
    ctx.fillStyle = "lime";
    ctx.fillRect(canvas.width / 2 - 100, canvas.height / 2 + 100, Math.min(elapsed * 200, 200), 8);
    ctx.strokeStyle = "white";
    ctx.strokeRect(canvas.width / 2 - 100, canvas.height / 2 + 100, 200, 8);
  }
}

function drawUpgradeOverlay() {
  drawOverlay("Level Up!", "Choose an Upgrade");
  ctx.textAlign = "center";
  ctx.font = "20px monospace";
  upgradeChoices.forEach((u, i) => {
    const y = canvas.height / 2 + 80 + i * 50;
    ctx.fillStyle = "lime";
    ctx.fillText(`[${i + 1}] ${u.name}`, canvas.width / 2, y);
  });
  ctx.textAlign = "left";
}

// --- Draw Loop ---
function draw() {
  drawBackground();

  // Entities
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "yellow";
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "red";
  enemies.forEach(e => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  xpOrbs.forEach(xp => {
    ctx.fillStyle = xp.color;
    ctx.beginPath();
    ctx.arc(xp.x, xp.y, xp.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  loot.forEach(l => {
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  drawHUD();

  if (gameOver) drawOverlay("GAME OVER", "Press R to Restart");
  if (choosingUpgrade) drawUpgradeOverlay();
  if (showPauseMenu) drawPauseMenu();
}

// --- Loop ---
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// --- Controls ---
document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();

  // Toggle Pause
  if ((k === "p" || k === "escape") && !choosingUpgrade && !gameOver) {
    showPauseMenu = !showPauseMenu;
    paused = showPauseMenu;
  }

  // Level-up choices
  if (choosingUpgrade && ["1", "2", "3"].includes(k)) {
    chooseUpgrade(Number(k) - 1);
  }

  // Restart instantly if game over
  if (k === "r" && gameOver) resetGame();

  // Hold R to reset (in pause)
  if (k === "r" && showPauseMenu) {
    if (!resetHoldStart) resetHoldStart = performance.now();
  }
});

document.addEventListener("keyup", e => {
  if (e.key.toLowerCase() === "r") resetHoldStart = null;
});

// --- Check hold duration ---
setInterval(() => {
  if (resetHoldStart && showPauseMenu) {
    const held = performance.now() - resetHoldStart;
    if (held >= 2000) {
      resetGame();
    }
  }
}, 100);
