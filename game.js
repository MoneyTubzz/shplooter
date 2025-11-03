const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==================== INPUT ====================
const keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// ==================== PLAYER ====================
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  color: "lime",
  speed: 3,
  baseFireRate: 400,
  fireRate: 400,
  lastShot: 0,
  hp: 100,
  maxHp: 100,
  damage: 4, // stronger base
  level: 1,
  xp: 0,
  xpToNext: 50,
  pierce: 0,
  lifesteal: false,
  explosive: false, // upgrade toggles this
  powerups: {
    triple: 0,
    rapid: 0,
    shield: 0,
    magnet: 0
  },
  // New stats for upgrades
  xpMultiplier: 1,
  projectileCount: 1,
  bulletSize: 1,
  bulletSpeed: 1,
  critChance: 0,
  critMultiplier: 2,
  regenRate: 0,
  // Weapon modes
  burstMode: false,
  ricochetBullets: false,
  spreadShot: false,
  laserMode: false,
  rocketMode: false,
  chainLightning: false,
  orbitalStrike: false,
  blackHoleGun: false,
  homingBullets: false,
  // Player facing direction
  facingAngle: 0, // Angle in radians the player is facing
  lastMovementDirection: 0 // Last movement direction for when not shooting
};

// ==================== PERMANENT BOOSTS ====================
let permanentBoosts = {
  damageBoost: 0,
  speedBoost: 0,
  healthBoost: 0,
  xpBoost: 0,
  fireRateBoost: 0,
  luckBoost: 0
};

let choosingBossReward = false;
let bossRewardChoices = [];

// Ship facing cache for smooth rotation
let lastFacingAngle = 0;

// ==================== ARRAYS / STATE ====================
let bullets = [];
let enemies = [];
let loot = [];
let xpOrbs = [];
let drones = [];
let floatingTexts = [];
let particles = []; // explosion fx
let stars = [];     // background stars
let chests = [];    // treasure chests
let weapons = [];   // collected weapons

// Stage transition animation
let stageTransition = {
  active: false,
  startTime: 0,
  duration: 2000, // 2 seconds
  stageName: "",
  phase: 0 // 0: fade in, 1: hold, 2: fade out
};

let score = 0;
let lastEnemySpawn = 0;
let gameStartTime = performance.now();
let gameOver = false;
let paused = false;
let choosingUpgrade = false;
let showPauseMenu = true;  // keep start menu on first load
let showStartMenu = true;
let menuIndex = 0;
let pauseMenuItems = ["Resume", "Restart"];

// ==================== WAVE SYSTEM ====================
let currentWave = 1;
let waveEnemiesSpawned = 0;
let waveEnemiesKilled = 0;
let waveQuota = 8; // enemies to spawn in wave 1
let waveComplete = false;
let waveIntermissionStart = 0;
let waveIntermissionDuration = 3000; // 3 seconds
let inWaveIntermission = false;

// ==================== UTILS ====================
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function nowMs() { return performance.now(); }
function isActive(power) { return player.powerups[power] > nowMs(); }
function addFloatingText(text, x, y, color = "white", size = 14) {
  floatingTexts.push({ text, x, y, color, size, alpha: 1, vy: -0.5 });
}
function roman(n) { return ["", "I", "II", "III", "IV", "V"][n] || n; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

// ==================== BACKGROUND (Starfield) ====================
function initStars() {
  stars = [];
  const count = 140;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.4,
      tw: Math.random() * Math.PI * 2,
      s: 0.15 + Math.random() * 0.3
    });
  }
}
initStars();

function drawBackground() {
  // Determine background theme based on miniboss defeats (changes every 5 waves after miniboss)
  const backgroundTheme = Math.floor((currentWave - 1) / 5) % 5;
  
  // Theme-specific gradients and colors
  let gradientColors, nebulaColors, gridColor;
  
  switch(backgroundTheme) {
    case 0: // Deep Space (Purple/Blue) - Waves 1-15
      gradientColors = ["#0a0a20", "#150a25", "#1a0a30", "#050510"];
      nebulaColors = ["rgba(100, 50, 150, 0.03)", "rgba(80, 40, 120, 0.02)", "rgba(60, 30, 90, 0)"];
      gridColor = "#00ffff";
      break;
    case 1: // Crimson Void (Red/Orange) - Waves 16-30
      gradientColors = ["#200a0a", "#250a15", "#300a1a", "#100505"];
      nebulaColors = ["rgba(150, 50, 50, 0.03)", "rgba(120, 40, 40, 0.02)", "rgba(90, 30, 30, 0)"];
      gridColor = "#ff4400";
      break;
    case 2: // Emerald Sector (Green/Teal) - Waves 31-45
      gradientColors = ["#0a200a", "#0a2515", "#0a301a", "#051005"];
      nebulaColors = ["rgba(50, 150, 100, 0.03)", "rgba(40, 120, 80, 0.02)", "rgba(30, 90, 60, 0)"];
      gridColor = "#00ff88";
      break;
    case 3: // Solar Storm (Yellow/Orange) - Waves 46-60
      gradientColors = ["#201a0a", "#25200a", "#302a0a", "#100f05"];
      nebulaColors = ["rgba(150, 130, 50, 0.03)", "rgba(120, 100, 40, 0.02)", "rgba(90, 70, 30, 0)"];
      gridColor = "#ffaa00";
      break;
    case 4: // Void Core (Dark Purple/Black) - Waves 61+
      gradientColors = ["#100510", "#200a20", "#150515", "#050205"];
      nebulaColors = ["rgba(120, 50, 150, 0.04)", "rgba(100, 40, 120, 0.03)", "rgba(80, 30, 90, 0)"];
      gridColor = "#aa44ff";
      break;
  }

  // Dynamic gradient background
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, gradientColors[0]);
  bg.addColorStop(0.3, gradientColors[1]);
  bg.addColorStop(0.6, gradientColors[2]);
  bg.addColorStop(1, gradientColors[3]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Themed nebula clouds
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const time = nowMs() * 0.0001;
  for (let i = 0; i < 8; i++) {
    const x = (canvas.width * (i / 8) + Math.sin(time + i) * 50) % canvas.width;
    const y = (canvas.height * 0.5 + Math.cos(time * 0.7 + i) * 80);
    const size = 120 + Math.sin(time * 0.5 + i) * 30;
    
    const nebula = ctx.createRadialGradient(x, y, 0, x, y, size);
    nebula.addColorStop(0, nebulaColors[0]);
    nebula.addColorStop(0.5, nebulaColors[1]);
    nebula.addColorStop(1, nebulaColors[2]);
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();

  // Enhanced starfield with multiple layers
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  
  // Theme-specific star colors
  let starColor1, starColor2;
  switch(backgroundTheme) {
    case 0: starColor1 = "#4a7c99"; starColor2 = "#7fdcff"; break; // Blue theme
    case 1: starColor1 = "#994a4a"; starColor2 = "#ff7d7d"; break; // Red theme  
    case 2: starColor1 = "#4a994a"; starColor2 = "#7dff7d"; break; // Green theme
    case 3: starColor1 = "#99944a"; starColor2 = "#ffdc7d"; break; // Yellow theme
    case 4: starColor1 = "#7d4a99"; starColor2 = "#c77dff"; break; // Purple theme
  }
  
  // Background stars (small, dim)
  for (let i = 0; i < stars.length * 0.6; i++) {
    const st = stars[i];
    const twinkle = (Math.sin(st.tw + nowMs()/1200) + 1) * 0.5;
    ctx.globalAlpha = 0.1 + twinkle * 0.3;
    ctx.fillStyle = starColor1;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Main stars (medium brightness)
  for (let i = Math.floor(stars.length * 0.6); i < stars.length * 0.9; i++) {
    const st = stars[i];
    const twinkle = (Math.sin(st.tw + nowMs()/800) + 1) * 0.5;
    ctx.globalAlpha = 0.2 + twinkle * 0.5;
    ctx.fillStyle = starColor2;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
    
    // Star movement
    st.x += st.s * 0.02;
    if (st.x > canvas.width + 2) st.x = -2;
  }
  
  // Bright stars (occasional bright flashes)
  for (let i = Math.floor(stars.length * 0.9); i < stars.length; i++) {
    const st = stars[i];
    const twinkle = (Math.sin(st.tw + nowMs()/600) + 1) * 0.5;
    const flash = Math.sin(st.tw + nowMs()/400) > 0.8 ? 1 : 0.3;
    ctx.globalAlpha = (0.4 + twinkle * 0.6) * flash;
    ctx.fillStyle = "#ffffff";
    
    // Cross-shaped bright stars
    ctx.fillRect(st.x - st.r * 2, st.y - st.r * 0.3, st.r * 4, st.r * 0.6);
    ctx.fillRect(st.x - st.r * 0.3, st.y - st.r * 2, st.r * 0.6, st.r * 4);
    
    st.x += st.s * 0.015;
    if (st.x > canvas.width + 4) st.x = -4;
  }
  ctx.restore();

  // Dynamic energy grid (subtle)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  const gridSize = 60;
  const offset = (nowMs() * 0.01) % gridSize;
  
  for (let x = -offset; x < canvas.width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -offset; y < canvas.height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Enhanced vignette with subtle color
  const vg = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height)*0.2,
    canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)*0.7
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(0.7, "rgba(10,5,20,0.2)");
  vg.addColorStop(1, "rgba(5,0,15,0.6)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ==================== PARTICLES (Explosion FX) ====================
function spawnExplosionParticles(x, y) {
  for (let i = 0; i < 16; i++) {
    particles.push({
      x, y,
      vx: rand(-2.4, 2.4),
      vy: rand(-2.4, 2.4),
      size: rand(1.5, 3.5),
      alpha: 1,
      color: Math.random() < 0.5 ? "orange" : "yellow",
      type: "spark"
    });
  }
  particles.push({ x, y, size: 14, alpha: 0.35, type: "ring" });
}
function updateParticles() {
  for (const p of particles) {
    if (p.type === "spark") {
      p.x += p.vx; p.y += p.vy; p.alpha -= 0.045;
    } else if (p.type === "ring") {
      p.size += 2.6; p.alpha -= 0.035;
    }
  }
  particles = particles.filter(p => p.alpha > 0);
}
function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    if (p.type === "spark") {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255,150,0,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function createMuzzleFlash(x, y) {
  // Determine weapon type for muzzle flash effect
  let weaponType = "default";
  if (player.burstMode) weaponType = "burst";
  else if (player.laserMode) weaponType = "laser";
  else if (player.rocketMode) weaponType = "rocket";
  else if (player.chainLightning) weaponType = "chain";
  else if (player.orbitalStrike) weaponType = "orbital";
  else if (player.blackHoleGun) weaponType = "blackhole";
  else if (player.ricochetBullets) weaponType = "ricochet";
  else if (player.spreadShot) weaponType = "spread";
  
  // Create weapon-specific muzzle flash particles
  switch(weaponType) {
    case "burst":
      // Green triple flash
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          size: 2 + Math.random() * 3,
          alpha: 0.8,
          type: "spark",
          color: "rgba(136, 204, 136, 1)"
        });
      }
      break;
      
    case "laser":
      // Blue concentrated beam flash
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: 3 + Math.random() * 2,
          alpha: 0.9,
          type: "spark",
          color: "rgba(136, 136, 255, 1)"
        });
      }
      break;
      
    case "rocket":
      // Orange explosive flash
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 12,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          size: 3 + Math.random() * 4,
          alpha: 0.9,
          type: "spark",
          color: "rgba(255, 140, 60, 1)"
        });
      }
      break;
      
    case "chain":
      // Electric crackling flash
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 15,
          y: y + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          size: 1 + Math.random() * 2,
          alpha: 1,
          type: "spark",
          color: "rgba(255, 255, 150, 1)"
        });
      }
      break;
      
    case "orbital":
      // Golden starlike flash
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        particles.push({
          x: x + Math.cos(angle) * 5,
          y: y + Math.sin(angle) * 5,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          size: 2 + Math.random() * 3,
          alpha: 0.9,
          type: "spark",
          color: "rgba(255, 170, 0, 1)"
        });
      }
      break;
      
    case "blackhole":
      // Dark purple void flash
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * -2, // Particles get sucked in
          vy: (Math.random() - 0.5) * -2,
          size: 2 + Math.random() * 3,
          alpha: 0.8,
          type: "spark",
          color: "rgba(170, 68, 255, 1)"
        });
      }
      break;
      
    case "ricochet":
      // Bright bouncy green flash
      for (let i = 0; i < 5; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          size: 2 + Math.random() * 2,
          alpha: 0.8,
          type: "spark",
          color: "rgba(150, 255, 150, 1)"
        });
      }
      break;
      
    case "spread":
      // Purple spread pattern flash
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 12,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          size: 2 + Math.random() * 2,
          alpha: 0.8,
          type: "spark",
          color: "rgba(200, 150, 255, 1)"
        });
      }
      break;
      
    default:
      // Standard white/yellow flash
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          size: 2 + Math.random() * 2,
          alpha: 0.8,
          type: "spark",
          color: "rgba(255, 255, 200, 1)"
        });
      }
  }
}

// ==================== RESET ====================
function resetGame() {
  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20,
    color: "lime",
    hp: 100,
    maxHp: 100,
    speed: 3,
    baseFireRate: 400,
    fireRate: 400,
    damage: 4,
    level: 1,
    xp: 0,
    xpToNext: 50,
    pierce: 0,
    lifesteal: false,
    explosive: false,
    powerups: { triple: 0, rapid: 0, shield: 0, magnet: 0 },
    // Reset new stats
    xpMultiplier: 1,
    projectileCount: 1,
    bulletSize: 1,
    bulletSpeed: 1,
    critChance: 0,
    critMultiplier: 2,
    regenRate: 0,
    homingBullets: false,
    vampireAura: false,
    // Weapon system properties
    burstMode: false,
    burstCount: 0,
    ricochetBullets: false,
    spreadShot: false,
    laserMode: false,
    rocketMode: false,
    chainLightning: false,
    orbitalStrike: false,
    blackHoleGun: false,
    facingAngle: 0,
    lastMovementDirection: 0
  });
  
  // Reset permanent boosts (they persist across runs)
  // permanentBoosts remain unchanged for permanent progression
  bullets = []; enemies = []; loot = []; xpOrbs = [];
  drones = []; floatingTexts = []; particles = [];
  chests = []; weapons = [];
  score = 0; gameOver = false; paused = false;
  choosingUpgrade = false; choosingBossReward = false; showPauseMenu = false; showStartMenu = false;
  menuIndex = 0; lastEnemySpawn = performance.now(); gameStartTime = performance.now();
  
  // Reset wave system
  currentWave = 1;
  waveEnemiesSpawned = 0;
  waveEnemiesKilled = 0;
  waveQuota = calculateWaveQuota(1);
  waveComplete = false;
  inWaveIntermission = false;
  
  initStars();
}

// ==================== WAVE MANAGEMENT ====================
function calculateWaveQuota(wave) {
  // Base quota increases with each wave, with slight randomization
  // Later waves have exponentially more enemies
  const baseQuota = 8 + (wave - 1) * 2.5;
  const exponentialScale = wave > 10 ? Math.pow(1.1, wave - 10) : 1;
  return Math.floor(baseQuota * exponentialScale + Math.random() * 3);
}

function getDifficultyMultiplier(wave) {
  // Returns a multiplier for various difficulty aspects based on wave
  return {
    health: 1 + (wave - 1) * 0.15,
    damage: 1 + (wave - 1) * 0.12,
    speed: Math.min(2.0, 1 + (wave - 1) * 0.04), // Capped at 2x speed max
    spawnRate: Math.min(0.3, 1 - (wave - 1) * 0.03) // Gets faster, caps at 30% of original
  };
}

function startNewWave() {
  currentWave++;
  waveEnemiesSpawned = 0;
  waveEnemiesKilled = 0;
  waveQuota = calculateWaveQuota(currentWave);
  waveComplete = false;
  inWaveIntermission = false;
  
  // Check for background change (after miniboss waves)
  if (currentWave % 5 === 1 && currentWave > 1) {
    const backgroundTheme = Math.floor((currentWave - 1) / 5) % 5;
    const themeNames = ["Deep Space", "Crimson Void", "Emerald Sector", "Solar Storm", "Void Core"];
    startStageTransition(`ENTERING ${themeNames[backgroundTheme]}`);
  }
  
  // Check if this is a miniboss wave (every 5 waves)
  if (currentWave % 5 === 0) {
    spawnMiniboss();
    waveQuota++; // Add miniboss to the quota
  }
  
  addFloatingText(`Wave ${currentWave}`, canvas.width/2, canvas.height/2 - 50, "#00ff88", 24);
}

function startStageTransition(stageName) {
  stageTransition.active = true;
  stageTransition.startTime = nowMs();
  stageTransition.stageName = stageName;
  stageTransition.phase = 0;
}

function updateStageTransition() {
  if (!stageTransition.active) return;
  
  const elapsed = nowMs() - stageTransition.startTime;
  
  if (elapsed < 500) {
    stageTransition.phase = 0; // Fade in
  } else if (elapsed < 1500) {
    stageTransition.phase = 1; // Hold
  } else if (elapsed < 2000) {
    stageTransition.phase = 2; // Fade out
  } else {
    stageTransition.active = false; // End
  }
}

function drawStageTransition() {
  if (!stageTransition.active) return;
  
  const elapsed = nowMs() - stageTransition.startTime;
  let alpha = 0;
  
  // Calculate animation values based on phase
  if (stageTransition.phase === 0) { // Fade in
    const fadeProgress = elapsed / 500;
    alpha = fadeProgress;
  } else if (stageTransition.phase === 1) { // Hold
    alpha = 1;
  } else if (stageTransition.phase === 2) { // Fade out
    const fadeProgress = (elapsed - 1500) / 500;
    alpha = 1 - fadeProgress;
  }
  
  // Dark overlay
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Simple stage text
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px monospace";
  ctx.fillText(stageTransition.stageName, canvas.width/2, canvas.height/2);
  
  ctx.restore();
}

function checkWaveComplete() {
  if (!waveComplete && waveEnemiesSpawned >= waveQuota && enemies.length === 0) {
    waveComplete = true;
    inWaveIntermission = true;
    waveIntermissionStart = nowMs();
    addFloatingText("Wave Complete!", canvas.width/2, canvas.height/2, "#ffaa00", 20);
  }
  
  // Check if intermission is over
  if (inWaveIntermission && nowMs() - waveIntermissionStart >= waveIntermissionDuration) {
    startNewWave();
  }
}

// ==================== SPAWN ====================
function getSpawnInterval() {
  // Faster spawning based on wave progression with difficulty multiplier
  const baseInterval = 1200;
  const difficulty = getDifficultyMultiplier(currentWave);
  return Math.max(300, baseInterval * difficulty.spawnRate);
}

function spawnEnemy() {
  // Don't spawn if wave quota is reached or in intermission
  if (waveEnemiesSpawned >= waveQuota || inWaveIntermission) return;
  
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch (edge) {
    case 0: x = Math.random() * canvas.width; y = -20; break;
    case 1: x = canvas.width + 20; y = Math.random() * canvas.height; break;
    case 2: x = Math.random() * canvas.width; y = canvas.height + 20; break;
    case 3: x = -20; y = Math.random() * canvas.height; break;
  }

  const L = player.level;
  const W = currentWave;
  const canSpawnElites = L >= 3 || W >= 3;
  const canSpawnSpecials = L >= 2 || W >= 2;

  const weights = [
    { type: "normal", w: Math.max(20, 65 - L * 1.5 - W * 0.8) },
    { type: "fast",   w: canSpawnSpecials ? 12 + L + W * 0.5 : 0 },
    { type: "tank",   w: canSpawnSpecials ? 10 + L * 0.5 + W * 0.3 : 0 },
    { type: "swarm",  w: canSpawnSpecials ? 12 + L + W * 0.4 : 0 },
    { type: "elite",  w: canSpawnElites ? 5 + L * 0.4 + W * 0.6 : 0 },
  ];
  const valid = weights.filter(w => w.w > 0);
  const total = valid.reduce((s, o) => s + o.w, 0);
  let roll = Math.random() * total;
  let chosen = "normal";
  for (const o of valid) { if (roll < o.w) { chosen = o.type; break; } roll -= o.w; }

  const difficulty = getDifficultyMultiplier(W);
  
  const hpScale = {
    normal: { base: 3, scale: 0.5 },
    fast:   { base: 3, scale: 0.4 },
    tank:   { base: 8, scale: 1.0 },
    elite:  { base: 18, scale: 1.8 },
    swarm:  { base: 2, scale: 0.3 },
  };
  const config = hpScale[chosen];
  const baseSpeed = {
    normal: 1.6 * difficulty.speed + L * 0.03,
    fast:   2.2 * difficulty.speed + L * 0.03, // Reduced from 2.8
    tank:   1.1 * difficulty.speed + L * 0.02,
    elite:  1.3 * difficulty.speed + L * 0.02,
    swarm:  1.8 * difficulty.speed + L * 0.02, // Significantly reduced from 2.4
  };

  const baseDamage = {
    normal: 6, fast: 6, tank: 12, elite: 18, swarm: 5
  };
  
  if (chosen === "swarm") {
    const count = Math.floor(rand(4, 8));
    for (let i = 0; i < count; i++) {
      enemies.push({
        x: x + rand(-15, 15), y: y + rand(-15, 15),
        size: 12, baseSpeed: baseSpeed.swarm,
        hp: Math.floor((config.base + L * config.scale) * difficulty.health),
        damage: Math.floor(baseDamage.swarm * difficulty.damage), 
        type: "swarm", t: Math.random() * Math.PI * 2
      });
    }
    waveEnemiesSpawned += count; // Count all swarm enemies
    return;
  }

  enemies.push({
    x, y,
    size: chosen === "tank" ? 28 : chosen === "elite" ? 35 : 20,
    baseSpeed: baseSpeed[chosen],
    hp: Math.floor((config.base + L * config.scale) * difficulty.health),
    damage: Math.floor(baseDamage[chosen] * difficulty.damage),
    type: chosen,
    dashCd: 0
  });
  waveEnemiesSpawned++;
}

function spawnMiniboss() {
  // Spawn miniboss at center of a random edge
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch (edge) {
    case 0: x = canvas.width / 2; y = -40; break;
    case 1: x = canvas.width + 40; y = canvas.height / 2; break;
    case 2: x = canvas.width / 2; y = canvas.height + 40; break;
    case 3: x = -40; y = canvas.height / 2; break;
  }

  const W = currentWave;
  const bossLevel = Math.floor(W / 5);
  const difficulty = getDifficultyMultiplier(W);
  
  // Determine boss type based on wave
  let bossType = "assault"; // Default
  if (W >= 10) bossType = "sniper";
  if (W >= 15) bossType = "tank";
  if (W >= 20) bossType = "swarm";
  if (W >= 25) bossType = "nightmare";
  
  // Add some randomization for higher waves
  if (W >= 15) {
    const bossTypes = ["assault", "sniper", "tank"];
    if (W >= 20) bossTypes.push("swarm");
    if (W >= 25) bossTypes.push("nightmare");
    bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
  }
  
  const bossHp = Math.floor((80 + bossLevel * 40) * difficulty.health * 1.5);
  const baseBoss = {
    x, y,
    hp: bossHp,
    maxHp: bossHp,
    type: "miniboss",
    bossType: bossType,
    dashCd: 0,
    lastSpecialAttack: 0,
    specialAttackCooldown: Math.max(1500, 3000 - bossLevel * 200 - W * 50)
  };
  
  // Apply boss-specific stats
  switch(bossType) {
    case "assault":
      Object.assign(baseBoss, {
        size: 50 + bossLevel * 5,
        baseSpeed: (1.2 + bossLevel * 0.1) * difficulty.speed,
        damage: Math.floor((25 + bossLevel * 10) * difficulty.damage),
        color: "#ff4444"
      });
      break;
      
    case "sniper":
      Object.assign(baseBoss, {
        size: 40 + bossLevel * 3,
        baseSpeed: (0.6 + bossLevel * 0.05) * difficulty.speed,
        damage: Math.floor((40 + bossLevel * 15) * difficulty.damage),
        color: "#44ff44",
        sniperRange: 400,
        lastSniperShot: 0
      });
      break;
      
    case "tank":
      Object.assign(baseBoss, {
        size: 80 + bossLevel * 8,
        baseSpeed: (0.4 + bossLevel * 0.03) * difficulty.speed,
        damage: Math.floor((15 + bossLevel * 6) * difficulty.damage),
        hp: bossHp * 2, // Double HP
        maxHp: bossHp * 2,
        color: "#4444ff",
        armor: 0.3 // 30% damage reduction
      });
      break;
      
    case "swarm":
      Object.assign(baseBoss, {
        size: 60 + bossLevel * 6,
        baseSpeed: (0.7 + bossLevel * 0.08) * difficulty.speed,
        damage: Math.floor((18 + bossLevel * 7) * difficulty.damage),
        color: "#ff44ff",
        swarmSpawnTimer: 0,
        minionsSpawned: 0
      });
      break;
      
    case "nightmare":
      Object.assign(baseBoss, {
        size: 70 + bossLevel * 7,
        baseSpeed: (1.0 + bossLevel * 0.12) * difficulty.speed,
        damage: Math.floor((35 + bossLevel * 12) * difficulty.damage),
        hp: bossHp * 1.5,
        maxHp: bossHp * 1.5,
        color: "#aa00aa",
        phaseShift: 0,
        teleportTimer: 0
      });
      break;
  }
  
  enemies.push(baseBoss);
  
  // Boss-specific announcement
  let bossName = "MINIBOSS";
  switch(bossType) {
    case "assault": bossName = "ASSAULT BOSS"; break;
    case "sniper": bossName = "SNIPER BOSS"; break;
    case "tank": bossName = "TANK BOSS"; break;
    case "swarm": bossName = "SWARM BOSS"; break;
    case "nightmare": bossName = "NIGHTMARE BOSS"; break;
  }
  
  addFloatingText(`${bossName} WAVE ${W}!`, canvas.width/2, canvas.height/2 - 80, baseBoss.color || "#ff4444", 28);
  waveEnemiesSpawned++;
}

function minibossSpecialAttack(boss) {
  const W = currentWave;
  const bossLevel = Math.floor(W / 5);
  
  // Boss-type specific attacks
  switch(boss.bossType) {
    case "assault":
      // Fast aggressive attacks
      const assaultAttacks = Math.floor(Math.random() * 2);
      if (assaultAttacks === 0) {
        // Rapid bullet barrage
        for (let i = 0; i < 12 + bossLevel * 2; i++) {
          const angle = (Math.PI * 2 / (12 + bossLevel * 2)) * i;
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * 3, Math.sin(angle) * 3);
        }
        addFloatingText("BULLET STORM!", boss.x, boss.y - 60, "#ff4444", 12);
      } else {
        // Aggressive charge
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const mag = Math.sqrt(dx*dx + dy*dy) || 1;
        boss.chargeVelX = (dx/mag) * (6 + bossLevel * 0.8);
        boss.chargeVelY = (dy/mag) * (6 + bossLevel * 0.8);
        boss.charging = true;
        boss.chargeEnd = nowMs() + 800;
        addFloatingText("ASSAULT!", boss.x, boss.y - 60, "#ff0000", 12);
      }
      break;
      
    case "sniper":
      // Long-range precision attacks
      const dx = player.x - boss.x;
      const dy = player.y - boss.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < boss.sniperRange) {
        // Sniper shot - high damage, precise
        const angle = Math.atan2(dy, dx);
        spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * 8, Math.sin(angle) * 8, boss.damage * 2);
        addFloatingText("SNIPER SHOT!", boss.x, boss.y - 60, "#44ff44", 12);
      } else {
        // Triple shot pattern
        const baseAngle = Math.atan2(dy, dx);
        for (let i = -1; i <= 1; i++) {
          const angle = baseAngle + i * 0.2;
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * 5, Math.sin(angle) * 5);
        }
        addFloatingText("TRIPLE SHOT!", boss.x, boss.y - 60, "#44ff44", 12);
      }
      break;
      
    case "tank":
      // Defensive/area attacks
      const tankAttack = Math.floor(Math.random() * 2);
      if (tankAttack === 0) {
        // Shockwave - damages everything nearby
        addFloatingText("SHOCKWAVE!", boss.x, boss.y - 60, "#4444ff", 12);
        // Create expanding damage circle
        for (let i = 0; i < 16; i++) {
          const angle = (Math.PI * 2 / 16) * i;
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * 4, Math.sin(angle) * 4);
        }
      } else {
        // Spawn defensive minions
        const minionCount = 3 + Math.floor(bossLevel / 2);
        for (let i = 0; i < minionCount; i++) {
          const angle = (Math.PI * 2 / minionCount) * i;
          const distance = 60;
          enemies.push({
            x: boss.x + Math.cos(angle) * distance,
            y: boss.y + Math.sin(angle) * distance,
            size: 18,
            baseSpeed: 1.0,
            hp: 8 + W * 0.8,
            damage: 6 + W * 0.4,
            type: "guardian",
            dashCd: 0,
            color: "#6666ff"
          });
        }
        addFloatingText("GUARDIANS!", boss.x, boss.y - 60, "#4444ff", 12);
      }
      break;
      
    case "swarm":
      // Spawns lots of weak enemies
      const swarmCount = 4 + bossLevel;
      for (let i = 0; i < swarmCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 40;
        enemies.push({
          x: boss.x + Math.cos(angle) * distance,
          y: boss.y + Math.sin(angle) * distance,
          size: 12,
          baseSpeed: 2.5,
          hp: 2 + W * 0.3,
          damage: 3 + W * 0.2,
          type: "swarmling",
          dashCd: 0,
          color: "#ff88ff"
        });
      }
      boss.minionsSpawned += swarmCount;
      addFloatingText("SWARM SPAWN!", boss.x, boss.y - 60, "#ff44ff", 12);
      break;
      
    case "nightmare":
      // Teleportation and chaos attacks
      const nightmareAttack = Math.floor(Math.random() * 3);
      if (nightmareAttack === 0) {
        // Teleport near player
        const teleportDistance = 100 + Math.random() * 50;
        const teleportAngle = Math.random() * Math.PI * 2;
        boss.x = player.x + Math.cos(teleportAngle) * teleportDistance;
        boss.y = player.y + Math.sin(teleportAngle) * teleportDistance;
        // Keep in bounds
        boss.x = Math.max(boss.size, Math.min(canvas.width - boss.size, boss.x));
        boss.y = Math.max(boss.size, Math.min(canvas.height - boss.size, boss.y));
        addFloatingText("TELEPORT!", boss.x, boss.y - 60, "#aa00aa", 12);
      } else if (nightmareAttack === 1) {
        // Chaos spray - random bullets everywhere
        for (let i = 0; i < 20 + bossLevel * 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 4;
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        addFloatingText("CHAOS SPRAY!", boss.x, boss.y - 60, "#aa00aa", 12);
      } else {
        // Phase shift - becomes temporarily invulnerable and fast
        boss.phaseShift = nowMs() + 2000;
        boss.baseSpeed *= 2;
        addFloatingText("PHASE SHIFT!", boss.x, boss.y - 60, "#aa00aa", 12);
      }
      break;
      
    default:
      // Fallback to original attack pattern
      const attackType = Math.floor(Math.random() * 3);
      switch(attackType) {
        case 0: // Bullet spray
          for (let i = 0; i < 8 + bossLevel; i++) {
            const angle = (Math.PI * 2 / (8 + bossLevel)) * i;
            spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * 2, Math.sin(angle) * 2);
          }
          addFloatingText("BULLET SPRAY!", boss.x, boss.y - 60, "#ff4444", 12);
          break;
          
        case 1: // Spawn minions
          const minionCount = 2 + Math.floor(bossLevel / 2);
          for (let i = 0; i < minionCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 30;
            enemies.push({
              x: boss.x + Math.cos(angle) * distance,
              y: boss.y + Math.sin(angle) * distance,
              size: 15,
              baseSpeed: 1.8,
              hp: 3 + W * 0.5,
              damage: 4 + W * 0.3,
              type: "minion",
              dashCd: 0
            });
          }
          addFloatingText("MINIONS!", boss.x, boss.y - 60, "#ff8844", 12);
          break;
          
        case 2: // Charge attack
          const dx = player.x - boss.x;
          const dy = player.y - boss.y;
          const mag = Math.sqrt(dx*dx + dy*dy) || 1;
          boss.chargeVelX = (dx/mag) * (4 + bossLevel * 0.5);
          boss.chargeVelY = (dy/mag) * (4 + bossLevel * 0.5);
          boss.charging = true;
          boss.chargeEnd = nowMs() + 1000;
          addFloatingText("CHARGE!", boss.x, boss.y - 60, "#ff0000", 12);
          break;
      }
      break;
  }
}

function spawnEnemyBullet(x, y, velX, velY, customDamage = null) {
  // Create enemy projectiles (different from player bullets)
  if (!enemies.enemyBullets) enemies.enemyBullets = [];
  enemies.enemyBullets.push({
    x: x, y: y,
    velX: velX, velY: velY,
    size: 6,
    damage: customDamage || (8 + currentWave * 0.5),
    life: 180 // frames until disappears
  });
}

// ==================== XP / LEVEL ====================
function gainXP(amount) {
  const multipliedAmount = Math.floor(amount * player.xpMultiplier);
  player.xp += multipliedAmount;
  if (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.5);
    triggerLevelUp();
  }
}
function triggerLevelUp() {
  paused = true; choosingUpgrade = true; upgradeChoices = pickUpgrades(); menuIndex = 0;
}

// ==================== SHOOTING ====================
function getNearestEnemy() {
  if (enemies.length === 0) return null;
  let nearest = enemies[0], nearestDist = Infinity;
  for (const e of enemies) {
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) { nearest = e; nearestDist = dist; }
  }
  return nearest;
}
function fireOneBulletTowards(target, ox, oy, dmg, angleOffset = 0) {
  const dx = target.x - ox, dy = target.y - oy;
  const baseAngle = Math.atan2(dy, dx) + angleOffset;
  
  // Calculate critical hit
  const isCrit = Math.random() < player.critChance;
  let finalDamage = isCrit ? dmg * player.critMultiplier : dmg;
  
  // Reduce ricochet bullet damage to balance bouncing
  if (player.ricochetBullets) {
    finalDamage *= 0.6; // 40% damage reduction for ricochet bullets
  }
  
  const baseSpeed = 7 * player.bulletSpeed;
  
  // Determine weapon type for visual effects
  let weaponType = "default";
  if (player.burstMode) weaponType = "burst";
  else if (player.laserMode) weaponType = "laser";
  else if (player.rocketMode) weaponType = "rocket";
  else if (player.chainLightning) weaponType = "chain";
  else if (player.orbitalStrike) weaponType = "orbital";
  else if (player.blackHoleGun) weaponType = "blackhole";
  else if (player.ricochetBullets) weaponType = "ricochet";
  else if (player.spreadShot) weaponType = "spread";
  
  bullets.push({
    x: ox, y: oy,
    velX: Math.cos(baseAngle) * baseSpeed,
    velY: Math.sin(baseAngle) * baseSpeed,
    size: 6 * player.bulletSize, 
    damage: finalDamage, 
    pierce: player.pierce,
    trail: [],
    explosive: player.explosive,
    exploded: false,
    isCrit: isCrit,
    homing: player.homingBullets,
    weaponType: weaponType,
    lifetime: 0,
    rotationSpeed: Math.random() * 0.2 - 0.1,
    bounceCount: 0,
    maxBounces: getMaxBounces(weaponType)
  });
}
function shootBullet(target, ox = player.x, oy = player.y, dmg = player.damage) {
  if (!target) return;
  
  let hasBasicShot = true; // Track if we need a basic shot
  
  // Fire each active weapon type
  if (player.burstMode) {
    // Burst Fire: Fire 3 bullets in quick succession
    fireOneBulletTowards(target, ox, oy, dmg, 0);
    setTimeout(() => fireOneBulletTowards(target, ox, oy, dmg * 0.8, 0), 50);
    setTimeout(() => fireOneBulletTowards(target, ox, oy, dmg * 0.8, 0), 100);
    hasBasicShot = false; // Burst mode replaces basic shot
  }
  
  if (player.spreadShot) {
    // Spread Shot: Fire 5 bullets in a spread pattern
    const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4];
    spreadAngles.forEach(angle => {
      fireOneBulletTowards(target, ox, oy, dmg * 0.7, angle);
    });
    hasBasicShot = false; // Spread shot replaces basic shot
  }
  
  if (player.laserMode) {
    // Laser Beam: Create a continuous piercing beam
    createLaserBeam(target, ox, oy, dmg * 1.2);
  }
  
  if (player.rocketMode) {
    // Rocket Launcher: Fire explosive rockets
    fireRocket(target, ox, oy, dmg * 1.5);
  }
  
  if (player.chainLightning) {
    // Chain Lightning: Fire lightning that chains between enemies
    fireChainLightning(target, ox, oy, dmg);
  }
  
  if (player.orbitalStrike) {
    // Orbital Strike: Call down bombardment from above
    callOrbitalStrike(target, dmg * 2);
  }
  
  if (player.blackHoleGun) {
    // Black Hole Gun: Create gravity wells
    createBlackHole(target, ox, oy, dmg);
  }
  
  // Fire basic shots if no primary weapon is active
  if (hasBasicShot) {
    const projectileCount = player.projectileCount + (isActive("triple") ? 2 : 0);
    
    if (projectileCount === 1) {
      fireOneBulletTowards(target, ox, oy, dmg, 0);
    } else {
      // Always fire one bullet straight ahead
      fireOneBulletTowards(target, ox, oy, dmg, 0);
      
      // Then spread the remaining projectiles around it
      const remainingProjectiles = projectileCount - 1;
      if (remainingProjectiles > 0) {
        const totalSpread = Math.PI / 4; // 45 degrees total spread for side bullets
        const angleStep = totalSpread / (remainingProjectiles + 1);
        
        for (let i = 1; i <= remainingProjectiles; i++) {
          const side = i % 2 === 1 ? 1 : -1; // Alternate sides
          const index = Math.ceil(i / 2);
          const offset = side * angleStep * index;
          fireOneBulletTowards(target, ox, oy, dmg, offset);
        }
      }
    }
  }
}

// ==================== WEAPON-SPECIFIC FUNCTIONS ====================
function createLaserBeam(target, ox, oy, dmg) {
  // Create a piercing laser beam that hits multiple enemies
  const dx = target.x - ox;
  const dy = target.y - oy;
  const angle = Math.atan2(dy, dx);
  const length = 800; // Maximum beam length
  
  // Get laser weapon level for enhanced effects
  const laserWeapon = weapons.find(w => w.id === "laser");
  const laserLevel = laserWeapon ? (laserWeapon.level || 1) : 1;
  
  // Create laser beam as a special bullet type
  const baseSpeed = 15 * player.bulletSpeed;
  bullets.push({
    x: ox, y: oy,
    velX: Math.cos(angle) * baseSpeed,
    velY: Math.sin(angle) * baseSpeed,
    size: (8 + laserLevel * 2) * player.bulletSize, // Bigger with levels
    damage: dmg * (1 + laserLevel * 0.3), // More damage with levels
    pierce: 999, // Pierces through everything
    trail: [],
    explosive: false,
    exploded: false,
    isCrit: Math.random() < player.critChance,
    homing: false,
    weaponType: "laser",
    lifetime: 0,
    rotationSpeed: 0,
    laserLength: length,
    weaponLevel: laserLevel,
    bounceCount: 0,
    maxBounces: getMaxBounces("laser")
  });
}

function fireRocket(target, ox, oy, dmg) {
  // Fire an explosive rocket
  const dx = target.x - ox;
  const dy = target.y - oy;
  const angle = Math.atan2(dy, dx);
  
  // Get rocket weapon level for enhanced effects
  const rocketWeapon = weapons.find(w => w.id === "rocket");
  const rocketLevel = rocketWeapon ? (rocketWeapon.level || 1) : 1;
  
  const baseSpeed = 5 * player.bulletSpeed; // Slower but more powerful
  
  // Fire multiple rockets at higher levels
  const rocketCount = Math.min(rocketLevel, 3);
  const spreadAngle = rocketLevel > 1 ? 0.3 : 0;
  
  for (let i = 0; i < rocketCount; i++) {
    const offsetAngle = rocketCount > 1 ? (i - (rocketCount - 1) / 2) * spreadAngle : 0;
    
    bullets.push({
      x: ox, y: oy,
      velX: Math.cos(angle + offsetAngle) * baseSpeed,
      velY: Math.sin(angle + offsetAngle) * baseSpeed,
      size: (12 + rocketLevel * 2) * player.bulletSize,
      damage: dmg * (1 + rocketLevel * 0.4),
      pierce: 0,
      trail: [],
      explosive: true,
      exploded: false,
      isCrit: Math.random() < player.critChance,
      homing: false,
      weaponType: "rocket",
      lifetime: 0,
      rotationSpeed: 0,
      explosionRadius: 80 + rocketLevel * 20,
      weaponLevel: rocketLevel,
      bounceCount: 0,
      maxBounces: getMaxBounces("rocket")
    });
  }
}

function fireChainLightning(target, ox, oy, dmg) {
  // Fire lightning that chains between enemies
  const dx = target.x - ox;
  const dy = target.y - oy;
  const angle = Math.atan2(dy, dx);
  
  // Get chain lightning weapon level
  const chainWeapon = weapons.find(w => w.id === "chain");
  const chainLevel = chainWeapon ? (chainWeapon.level || 1) : 1;
  
  const baseSpeed = 12 * player.bulletSpeed;
  bullets.push({
    x: ox, y: oy,
    velX: Math.cos(angle) * baseSpeed,
    velY: Math.sin(angle) * baseSpeed,
    size: (6 + chainLevel) * player.bulletSize,
    damage: dmg * (1 + chainLevel * 0.25),
    pierce: 3 + chainLevel,
    trail: [],
    explosive: false,
    exploded: false,
    isCrit: Math.random() < player.critChance,
    homing: false,
    weaponType: "chain",
    lifetime: 0,
    rotationSpeed: 0,
    chainCount: 0,
    maxChains: 4 + chainLevel * 2, // More chains at higher levels
    weaponLevel: chainLevel,
    bounceCount: 0,
    maxBounces: getMaxBounces("chain")
  });
}

function callOrbitalStrike(target, dmg) {
  // Call down orbital bombardment at target location
  const strikeX = target.x + (Math.random() - 0.5) * 100;
  const strikeY = target.y + (Math.random() - 0.5) * 100;
  
  // Create orbital projectile that falls from the sky
  bullets.push({
    x: strikeX, y: -50,
    velX: 0,
    velY: 8 * player.bulletSpeed,
    size: 15 * player.bulletSize,
    damage: dmg,
    pierce: 0,
    trail: [],
    explosive: true,
    exploded: false,
    isCrit: Math.random() < player.critChance,
    homing: false,
    weaponType: "orbital",
    lifetime: 0,
    rotationSpeed: 0.1,
    explosionRadius: 120,
    bounceCount: 0,
    maxBounces: getMaxBounces("orbital")
  });
}

function createBlackHole(target, ox, oy, dmg) {
  // Create a black hole that pulls enemies and does damage over time
  const dx = target.x - ox;
  const dy = target.y - oy;
  const angle = Math.atan2(dy, dx);
  
  // Get black hole weapon level for enhanced effects
  const blackHoleWeapon = weapons.find(w => w.id === "blackhole");
  const blackHoleLevel = blackHoleWeapon ? (blackHoleWeapon.level || 1) : 1;
  
  const baseSpeed = 12 * player.bulletSpeed; // Doubled speed
  bullets.push({
    x: ox, y: oy,
    velX: Math.cos(angle) * baseSpeed,
    velY: Math.sin(angle) * baseSpeed,
    size: (25 + blackHoleLevel * 5) * player.bulletSize, // Bigger with levels
    damage: dmg * (0.6 + blackHoleLevel * 0.2), // Better damage scaling
    pierce: 999,
    trail: [],
    explosive: false,
    exploded: false,
    isCrit: false,
    homing: false,
    weaponType: "blackhole",
    lifetime: 0,
    rotationSpeed: 0,
    pullRadius: 180 + blackHoleLevel * 30, // Larger pull radius with levels
    duration: 450 + blackHoleLevel * 150, // Lasts longer with levels
    bounceCount: 0,
    maxBounces: getMaxBounces("blackhole"),
    weaponLevel: blackHoleLevel,
    pullStrength: 0.8 + blackHoleLevel * 0.3 // Stronger pull with levels
  });
}

function currentFireRate() {
  let rate = player.fireRate;
  if (isActive("rapid")) rate *= 0.6;
  
  // Find the slowest weapon modifier (highest multiplier)
  let slowestMultiplier = 1;
  
  if (player.rocketMode) slowestMultiplier = Math.max(slowestMultiplier, 2);
  if (player.orbitalStrike) slowestMultiplier = Math.max(slowestMultiplier, 3);
  if (player.blackHoleGun) slowestMultiplier = Math.max(slowestMultiplier, 1.8); // Faster than before
  if (player.burstMode) slowestMultiplier = Math.max(slowestMultiplier, 1.5);
  if (player.ricochetBullets) slowestMultiplier = Math.max(slowestMultiplier, 1.3); // Slightly slower firing
  
  // Apply fastest weapon bonus if we have fast weapons
  if (player.laserMode && slowestMultiplier === 1) rate *= 0.8;
  
  return rate * slowestMultiplier;
}

function getMaxBounces(weaponType) {
  if (weaponType === "ricochet" || player.ricochetBullets) {
    // Get ricochet weapon level for enhanced bouncing
    const ricochetWeapon = weapons.find(w => w.id === "ricochet");
    const ricochetLevel = ricochetWeapon ? (ricochetWeapon.level || 1) : 1;
    return Math.min(1 + ricochetLevel, 4); // Base 2 bounces, +1 per level, max 4
  }
  return 0; // No bounces for other weapon types
}

// ==================== LOOT / POWERUPS ====================
function dropLoot(x, y) {
  if (Math.random() > 0.11) return;
  const table = [
    { type: "heal", w: 18 }, { type: "speed", w: 12 }, { type: "firerate", w: 12 },
    { type: "triple", w: 10 }, { type: "rapid", w: 10 }, { type: "shield", w: 8 }, { type: "magnet", w: 6 }
  ];
  const total = table.reduce((s, o) => s + o.w, 0);
  let roll = Math.random() * total, chosen = "heal";
  for (const o of table) { if (roll < o.w) { chosen = o.type; break; } roll -= o.w; }
  const colors = {
    heal: "lime", speed: "cyan", firerate: "gold",
    triple: "violet", rapid: "orange", shield: "deepskyblue", magnet: "aqua"
  };
  loot.push({ x, y, size: 18, type: chosen, color: colors[chosen] });
}
function collectLoot(l) {
  const msg = (t, c) => addFloatingText(t, player.x, player.y - 20, c);
  switch (l.type) {
    case "heal": player.hp = Math.min(player.maxHp, player.hp + 25); msg("+25 HP", "lime"); break;
    case "speed": player.speed += 1; msg("SPEED ↑", "cyan"); setTimeout(() => player.speed -= 1, 5000); break;
    case "firerate": player.fireRate *= 0.8; msg("FIRE RATE ↑", "gold"); setTimeout(() => player.fireRate /= 0.8, 5000); break;
    case "triple": player.powerups.triple = nowMs() + 12000; msg("TRIPLE SHOT", "violet"); break;
    case "rapid": player.powerups.rapid = nowMs() + 10000; msg("RAPID FIRE", "orange"); break;
    case "shield": player.powerups.shield = nowMs() + 12000; msg("SHIELD", "deepskyblue"); break;
    case "magnet": player.powerups.magnet = nowMs() + 6000; msg("MAGNET", "aqua"); xpOrbs.forEach(xp => xp.vacuum = true); break;
  }
}

// ==================== XP ORBS ====================
function dropXP(x, y, amount = Math.floor(rand(8, 15))) {
  xpOrbs.push({ x, y, size: 4, value: amount, color: "aqua", vacuum: false });
}

// ==================== UPGRADES ====================
const upgradePool = [
  // Basic stats (tiered)
  { id: "damage", tier: 1, maxTier: 5, name: "Damage I", apply: () => player.damage += 1 + permanentBoosts.damageBoost },
  { id: "firerate", tier: 1, maxTier: 5, name: "Fire Rate I", apply: () => player.fireRate *= 0.85 },
  { id: "speed", tier: 1, maxTier: 5, name: "Speed I", apply: () => player.speed += 0.4 + permanentBoosts.speedBoost * 0.1 },
  { id: "hp", tier: 1, maxTier: 5, name: "Max HP I", apply: () => { player.maxHp += 20 + permanentBoosts.healthBoost * 5; player.hp += 20 + permanentBoosts.healthBoost * 5; } },
  
  // XP and progression
  { id: "xpgain", tier: 1, maxTier: 3, name: "XP Gain I", apply: () => player.xpMultiplier += 0.25 + permanentBoosts.xpBoost * 0.1 },
  { id: "regen", tier: 1, maxTier: 3, name: "Health Regen I", apply: () => player.regenRate += 0.15 },
  
  // Projectile upgrades
  { id: "multishot", tier: 1, maxTier: 2, name: "Multi-Shot I", apply: () => player.projectileCount += 1 },
  { id: "bulletsize", tier: 1, maxTier: 3, name: "Bullet Size I", apply: () => player.bulletSize += 0.3 },
  { id: "bulletspeed", tier: 1, maxTier: 3, name: "Bullet Speed I", apply: () => player.bulletSpeed += 0.4 },
  
  // Critical hits
  { id: "critchance", tier: 1, maxTier: 3, name: "Critical Chance I", apply: () => player.critChance += 0.1 + permanentBoosts.luckBoost * 0.02 },
  { id: "critdamage", tier: 1, maxTier: 3, name: "Critical Damage I", apply: () => player.critMultiplier += 0.5 },
  
  // Special abilities (rare)
  { id: "pierce", rare: true, name: "Piercing Bullets", apply: () => player.pierce = (player.pierce || 0) + 1 },
  { id: "lifesteal", rare: true, name: "Life Steal", apply: () => player.lifesteal = true },
  { id: "explosive", rare: true, name: "Explosive Shots", apply: () => player.explosive = true },
  { id: "drone", rare: true, name: "Drone Companion", apply: () => spawnDrone() },
  
  // Power-ups duration (rare)
  { id: "powerup_duration", rare: true, name: "Power-up Duration", apply: () => {
    // Increase all future powerup durations by 50%
    Object.keys(player.powerups).forEach(key => {
      if (player.powerups[key] > nowMs()) {
        player.powerups[key] += 3000;
      }
    });
  }},
  
  // Unique abilities (very rare)
  { id: "homing", legendary: true, name: "Homing Bullets", apply: () => player.homingBullets = true },
  { id: "vampire", legendary: true, name: "Vampiric Aura", apply: () => player.vampireAura = true },
  { id: "bulletspeed_legendary", legendary: true, name: "Bullet Speed", apply: () => player.bulletSpeed += 1.0 }
];
let upgradeChoices = [];

// ==================== WEAPON SYSTEM ====================
function clearAllWeapons() {
  player.burstMode = false;
  player.ricochetBullets = false;
  player.spreadShot = false;
  player.laserMode = false;
  player.rocketMode = false;
  player.chainLightning = false;
  player.orbitalStrike = false;
  player.blackHoleGun = false;
}

const weaponPool = [
  // Common weapons (60%)
  { id: "burst", rarity: "common", name: "Burst Fire", color: "#88cc88", icon: "≡", 
    description: "Every 3rd shot fires a 3-round burst", 
    apply: () => player.burstMode = true },
  { id: "spread", rarity: "common", name: "Spread Shot", color: "#88cc88", icon: "※", 
    description: "Fires 5 bullets in a spread pattern", 
    apply: () => player.spreadShot = true },
  
  // Rare weapons (30%)
  { id: "laser", rarity: "rare", name: "Laser Beam", color: "#8888ff", icon: "═", 
    description: "Continuous piercing laser beam", 
    apply: () => player.laserMode = true },
  { id: "rocket", rarity: "rare", name: "Rocket Launcher", color: "#8888ff", icon: "🚀", 
    description: "Fires explosive rockets", 
    apply: () => player.rocketMode = true },
  { id: "chain", rarity: "rare", name: "Chain Lightning", color: "#8888ff", icon: "⚡", 
    description: "Lightning chains between enemies", 
    apply: () => player.chainLightning = true },
  
  // Legendary weapons (10%)
  { id: "ricochet", rarity: "legendary", name: "Ricochet", color: "#ffaa00", icon: "◊", 
    description: "Bullets bounce off screen edges (more bounces with levels)", 
    apply: () => player.ricochetBullets = true },
  { id: "orbital", rarity: "legendary", name: "Orbital Strike", color: "#ffaa00", icon: "✦", 
    description: "Calls down orbital bombardment", 
    apply: () => player.orbitalStrike = true },
  { id: "blackhole", rarity: "legendary", name: "Black Hole Gun", color: "#ffaa00", icon: "●", 
    description: "Creates gravity wells that pull enemies", 
    apply: () => player.blackHoleGun = true }
];

function spawnChest() {
  const x = Math.random() * (canvas.width - 100) + 50;
  const y = Math.random() * (canvas.height - 100) + 50;
  chests.push({
    x: x, y: y, size: 25,
    opened: false,
    pulseTime: 0,
    rarity: Math.random() < 0.1 ? "legendary" : (Math.random() < 0.4 ? "rare" : "common")
  });
}

function openChest(chest) {
  chest.opened = true;
  
  // Filter weapons by rarity
  const availableWeapons = weaponPool.filter(w => {
    if (chest.rarity === "legendary") return w.rarity === "legendary";
    if (chest.rarity === "rare") return w.rarity === "rare" || w.rarity === "common";
    return w.rarity === "common";
  });
  
  if (availableWeapons.length > 0) {
    const selectedWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
    
    // Check if we already have this weapon
    const existingWeapon = weapons.find(existing => existing.id === selectedWeapon.id);
    
    if (existingWeapon) {
      // Upgrade existing weapon
      existingWeapon.level = (existingWeapon.level || 1) + 1;
      addFloatingText(`${selectedWeapon.name} Enhanced! Lv.${existingWeapon.level}`, chest.x, chest.y - 30, selectedWeapon.color, 16);
    } else {
      // Add new weapon
      const newWeapon = { ...selectedWeapon, level: 1 };
      weapons.push(newWeapon);
      selectedWeapon.apply();
      addFloatingText(`${selectedWeapon.name}!`, chest.x, chest.y - 30, selectedWeapon.color, 16);
    }
    
    spawnExplosionParticles(chest.x, chest.y);
  }
}

function pickUpgrades() {
  // Filter out invalid upgrades (ones with broken names or duplicates)
  const validPool = upgradePool.filter(u => 
    u.name && 
    u.name.length > 0 && 
    u.apply && 
    typeof u.apply === 'function'
  );
  
  const pool = [...validPool];
  const choices = [];
  
  while (choices.length < 3 && pool.length > 0) {
    let selectedUpgrade;
    const roll = Math.random();
    
    // Rarity system: legendary 2%, rare 15%, normal 83%
    if (roll < 0.02 + permanentBoosts.luckBoost * 0.01) {
      // Try to pick legendary
      const legendaries = pool.filter(u => u.legendary);
      if (legendaries.length > 0) {
        selectedUpgrade = legendaries[Math.floor(Math.random() * legendaries.length)];
      }
    } else if (roll < 0.17 + permanentBoosts.luckBoost * 0.03) {
      // Try to pick rare
      const rares = pool.filter(u => u.rare);
      if (rares.length > 0) {
        selectedUpgrade = rares[Math.floor(Math.random() * rares.length)];
      }
    }
    
    // Fall back to any upgrade if no rarity match
    if (!selectedUpgrade) {
      selectedUpgrade = pool[Math.floor(Math.random() * pool.length)];
    }
    
    choices.push(selectedUpgrade);
    pool.splice(pool.indexOf(selectedUpgrade), 1);
  }
  
  return choices;
}
function chooseUpgrade(i) {
  const u = upgradeChoices[i];
  u.apply();
  if (u.maxTier && u.tier < u.maxTier) {
    const nextTier = u.tier + 1;
    // Fix: Keep the full name minus the Roman numeral, then add new tier
    const baseName = u.name.replace(/ [IVX]+$/, ''); // Remove existing Roman numeral
    const newName = `${baseName} ${roman(nextTier)}`;
    
    // Only add if this exact upgrade doesn't already exist in pool
    const existingUpgrade = upgradePool.find(existing => 
      existing.id === u.id && existing.tier === nextTier
    );
    if (!existingUpgrade) {
      upgradePool.push({ ...u, tier: nextTier, name: newName });
    }
  }
  choosingUpgrade = false; paused = false;
}
function spawnDrone() {
  drones.push({ x: player.x + 30, y: player.y, size: 12, angle: 0, orbit: 40, fireRate: 800, lastShot: 0 });
}

// ==================== BOSS REWARDS ====================
const bossRewardPool = [
  { name: "Eternal Damage", desc: "+2 permanent damage", apply: () => { permanentBoosts.damageBoost += 2; player.damage += 2; } },
  { name: "Swift Reflexes", desc: "+0.5 permanent speed", apply: () => { permanentBoosts.speedBoost += 1; player.speed += 0.5; } },
  { name: "Reinforced Hull", desc: "+30 permanent max HP", apply: () => { permanentBoosts.healthBoost += 6; player.maxHp += 30; player.hp += 30; } },
  { name: "Ancient Wisdom", desc: "+50% permanent XP gain", apply: () => { permanentBoosts.xpBoost += 1; player.xpMultiplier += 0.5; } },
  { name: "Blessed Trigger", desc: "+15% permanent fire rate", apply: () => { permanentBoosts.fireRateBoost += 1; player.fireRate *= 0.85; } },
  { name: "Fortune's Favor", desc: "+10% rare upgrade chance", apply: () => { permanentBoosts.luckBoost += 1; } },
  { name: "Battle Hardened", desc: "+1 damage, +10 HP, +0.2 speed", apply: () => { 
    permanentBoosts.damageBoost += 1; permanentBoosts.healthBoost += 2; permanentBoosts.speedBoost += 1;
    player.damage += 1; player.maxHp += 10; player.hp += 10; player.speed += 0.2; 
  }},
  { name: "Master's Focus", desc: "+20% crit chance, +0.5 crit damage", apply: () => { 
    player.critChance += 0.2; player.critMultiplier += 0.5; 
  }}
];

function triggerBossReward() {
  choosingBossReward = true;
  paused = true;
  bossRewardChoices = [];
  
  const pool = [...bossRewardPool];
  while (bossRewardChoices.length < 3 && pool.length > 0) {
    const selected = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    bossRewardChoices.push(selected);
  }
  
  menuIndex = 0;
}

function chooseBossReward(i) {
  const reward = bossRewardChoices[i];
  reward.apply();
  addFloatingText(`${reward.name}!`, canvas.width/2, canvas.height/2, "#ffaa00", 18);
  choosingBossReward = false;
  paused = false;
}

// ==================== UPDATE ====================
function update() {
  if (gameOver || paused || showStartMenu) return;

  // movement and facing direction
  let moveX = 0, moveY = 0;
  if (keys["w"] || keys["arrowup"]) { player.y -= player.speed; moveY = -1; }
  if (keys["s"] || keys["arrowdown"]) { player.y += player.speed; moveY = 1; }
  if (keys["a"] || keys["arrowleft"]) { player.x -= player.speed; moveX = -1; }
  if (keys["d"] || keys["arrowright"]) { player.x += player.speed; moveX = 1; }
  
  // Update facing direction based on movement
  if (moveX !== 0 || moveY !== 0) {
    player.lastMovementDirection = Math.atan2(moveY, moveX);
  }
  
  player.x = clamp(player.x, player.size / 2, canvas.width - player.size / 2);
  player.y = clamp(player.y, player.size / 2, canvas.height - player.size / 2);

  const now = nowMs();
  
  // Health regeneration
  if (player.regenRate > 0 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + player.regenRate);
  }

  // Update facing direction - prioritize player control
  const t = getNearestEnemy();
  const isPlayerControlling = (moveX !== 0 || moveY !== 0);
  
  if (isPlayerControlling) {
    // Player is actively moving - always face movement direction
    player.facingAngle = player.lastMovementDirection;
  }
  
  // Shooting logic
  if (now - player.lastShot > currentFireRate()) {
    if (t) { 
      // Only face enemy when shooting if player is not controlling movement
      if (!isPlayerControlling) {
        const dx = t.x - player.x;
        const dy = t.y - player.y;
        player.facingAngle = Math.atan2(dy, dx);
      }
      
      shootBullet(t); 
      player.lastShot = now;
    }
    // If no enemy and not moving, keep current facing direction
  }
  // When not shooting and not moving, keep current facing direction

  // drones
  for (const d of drones) {
    d.angle += 0.03;
    d.x = player.x + Math.cos(d.angle) * d.orbit;
    d.y = player.y + Math.sin(d.angle) * d.orbit;
    if (now - d.lastShot > d.fireRate) {
      const t = getNearestEnemy(); if (t) { shootBullet(t, d.x, d.y, player.damage * 0.5); d.lastShot = now; }
    }
  }

  // bullets move + comet trails
  bullets.forEach(b => {
    b.trail.unshift({ x: b.x, y: b.y, alpha: 1 });
    if (b.trail.length > 8) b.trail.pop();
    
    // Weapon-specific behaviors
    if (b.weaponType === "blackhole") {
      // Black hole: Pull nearby enemies and last longer
      b.lifetime++;
      if (b.lifetime > b.duration) {
        b.pierce = 0; // Will be removed next frame
      } else {
        // Pull enemies towards the black hole
        enemies.forEach(enemy => {
          const dx = b.x - enemy.x;
          const dy = b.y - enemy.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < b.pullRadius && dist > 0) {
            const pullStrength = (b.pullRadius - dist) / b.pullRadius * (b.pullStrength || 0.8);
            enemy.x += (dx/dist) * pullStrength;
            enemy.y += (dy/dist) * pullStrength;
            
            // Slow down enemies caught in the black hole
            enemy.baseSpeed *= 0.95;
            
            // Add visual suction effect
            if (Math.random() < 0.3) {
              particles.push({
                x: enemy.x + (Math.random() - 0.5) * 20,
                y: enemy.y + (Math.random() - 0.5) * 20,
                vx: (dx/dist) * 2,
                vy: (dy/dist) * 2,
                size: 2,
                alpha: 0.6,
                type: "spark",
                color: "rgba(180,100,255,0.8)"
              });
            }
          }
        });
        
        // Black holes slow down over time but don't stop completely
        b.velX *= 0.992; // Slower deceleration
        b.velY *= 0.992;
      }
    }
    
    // Homing behavior (for regular homing bullets)
    if (b.homing && enemies.length > 0) {
      const target = getNearestEnemy();
      if (target) {
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
          const homingStrength = 0.15;
          b.velX += (dx/dist) * homingStrength;
          b.velY += (dy/dist) * homingStrength;
          
          // Normalize speed to maintain bullet velocity
          const speed = Math.sqrt(b.velX*b.velX + b.velY*b.velY);
          const targetSpeed = 7 * player.bulletSpeed;
          b.velX = (b.velX/speed) * targetSpeed;
          b.velY = (b.velY/speed) * targetSpeed;
        }
      }
    }
    
    // Ricochet behavior
    if (b.weaponType === "ricochet" || player.ricochetBullets) {
      let bounced = false;
      
      // Bounce off screen edges
      if (b.x <= 0 || b.x >= canvas.width) {
        if (b.bounceCount < b.maxBounces) {
          b.velX = -b.velX;
          b.x = Math.max(0, Math.min(canvas.width, b.x));
          bounced = true;
        } else {
          // Exceeded bounce limit, mark for removal
          b.pierce = 0;
        }
      }
      if (b.y <= 0 || b.y >= canvas.height) {
        if (b.bounceCount < b.maxBounces) {
          b.velY = -b.velY;
          b.y = Math.max(0, Math.min(canvas.height, b.y));
          bounced = true;
        } else {
          // Exceeded bounce limit, mark for removal
          b.pierce = 0;
        }
      }
      
      // Increment bounce counter if we bounced
      if (bounced) {
        b.bounceCount++;
        // Reduce damage with each bounce
        b.damage *= 0.75; // 25% damage reduction per bounce
        // Reduce size slightly with each bounce
        b.size *= 0.95;
        
        // Add visual effect for bouncing
        if (Math.random() < 0.5) {
          particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: 2,
            alpha: 0.8,
            type: "spark",
            color: "rgba(150,255,150,1)"
          });
        }
      }
    }
    
    b.x += b.velX; b.y += b.velY;
  });
  bullets = bullets.filter(b => b.x>-10 && b.x<canvas.width+10 && b.y>-10 && b.y<canvas.height+10);

  // enemy bullets movement and collision
  if (!enemies.enemyBullets) enemies.enemyBullets = [];
  for (let i = enemies.enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemies.enemyBullets[i];
    eb.x += eb.velX; eb.y += eb.velY; eb.life--;
    
    // Check collision with player
    const dx = eb.x - player.x, dy = eb.y - player.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < player.size/2 + eb.size/2) {
      if (!isActive("shield")) {
        player.hp -= eb.damage * 0.3;
        if (player.hp <= 0) gameOver = true;
      }
      enemies.enemyBullets.splice(i, 1);
      continue;
    }
    
    // Remove if out of bounds or expired
    if (eb.life <= 0 || eb.x < -20 || eb.x > canvas.width + 20 || 
        eb.y < -20 || eb.y > canvas.height + 20) {
      enemies.enemyBullets.splice(i, 1);
    }
  }

  // spawn pacing
  if (now - lastEnemySpawn > getSpawnInterval()) { spawnEnemy(); lastEnemySpawn = now; }
  
  // chest spawning (rare)
  if (Math.random() < 0.002 && chests.length < 2) { // Rare spawn, increased for testing
    spawnChest();
  }

  // enemy movement
  for (const e of enemies) {
    const dx = player.x - e.x, dy = player.y - e.y, mag = Math.sqrt(dx*dx+dy*dy)||1;
    
    if (e.type === "miniboss") {
      // Miniboss charging behavior
      if (e.charging && now < e.chargeEnd) {
        e.x += e.chargeVelX;
        e.y += e.chargeVelY;
        // Slow down charge over time
        e.chargeVelX *= 0.95;
        e.chargeVelY *= 0.95;
      } else if (e.charging) {
        e.charging = false;
      } else {
        // Normal miniboss movement and abilities
        const distToPlayer = Math.sqrt(dx*dx + dy*dy);
        
        // Circle strafe at medium distance
        if (distToPlayer > 100 && distToPlayer < 200) {
          const angle = Math.atan2(dy, dx) + Math.PI/2;
          e.x += Math.cos(angle) * e.baseSpeed * 0.8;
          e.y += Math.sin(angle) * e.baseSpeed * 0.8;
        } else {
          e.x += (dx/mag) * e.baseSpeed * 0.6;
          e.y += (dy/mag) * e.baseSpeed * 0.6;
        }
        
        // Special attacks
        if (now - e.lastSpecialAttack > e.specialAttackCooldown) {
          minibossSpecialAttack(e);
          e.lastSpecialAttack = now;
        }
      }
    } else {
      e.x += (dx/mag)*e.baseSpeed; 
      e.y += (dy/mag)*e.baseSpeed;
    }
  }

  // Check wave completion
  checkWaveComplete();

  // bullets vs enemies (+ non-recursive explosion AoE)
  for (let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    for (let j=bullets.length-1;j>=0;j--){
      const b=bullets[j];
      const dx=e.x-b.x,dy=e.y-b.y,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<e.size/2+b.size/2){
        e.hp-=b.damage;
        const dmgText=(b.damage%1===0)?`-${Math.floor(b.damage)}`:`-${b.damage.toFixed(1)}`;
        const critColor = b.isCrit ? "#ffff00" : "orange";
        const critSize = b.isCrit ? 16 : 12;
        const critPrefix = b.isCrit ? "CRIT " : "";
        addFloatingText(critPrefix + dmgText,e.x,e.y-e.size/2,critColor,critSize);

        // Weapon-specific hit effects
        if (b.weaponType === "blackhole") {
          // Black holes deal continuous damage but at reduced rate
          // Don't remove the bullet, let it continue existing
          if (Math.random() < 0.1) { // 10% chance per frame to deal damage again
            e.hp -= b.damage * 0.5; // Reduced continuous damage
            addFloatingText(`-${Math.floor(b.damage * 0.5)}`, e.x + Math.random() * 10 - 5, e.y - e.size/2, "#aa44ff", 10);
          }
        } else if (b.weaponType === "chain" && b.chainCount < b.maxChains) {
          // Chain lightning: jump to nearby enemies
          b.chainCount++;
          const chainRange = 120;
          let closestEnemy = null;
          let closestDist = chainRange;
          
          for (const e2 of enemies) {
            if (e2 === e) continue; // Don't chain to the same enemy
            const dx2 = e2.x - e.x;
            const dy2 = e2.y - e.y;
            const d2 = Math.sqrt(dx2*dx2 + dy2*dy2);
            if (d2 < closestDist) {
              closestEnemy = e2;
              closestDist = d2;
            }
          }
          
          if (closestEnemy) {
            // Create visual lightning effect
            addFloatingText("⚡", (e.x + closestEnemy.x) / 2, (e.y + closestEnemy.y) / 2, "#ffff88", 14);
            // Damage the chained enemy
            closestEnemy.hp -= b.damage * 0.8; // Reduced damage for chained hits
            addFloatingText(`-${Math.floor(b.damage * 0.8)}`, closestEnemy.x, closestEnemy.y - closestEnemy.size/2, "#ffff88", 12);
          }
        }
        
        if (b.weaponType === "blackhole") {
          // Black holes do continuous damage but don't get consumed
          // They already handle their own lifetime in the movement code
        } else if (b.explosive && !b.exploded) {
          b.exploded = true;
          const radius = b.explosionRadius || 60;
          const splash = Math.max(1, Math.floor(b.damage * 0.6));
          for (const e2 of enemies) {
            const dx2=e2.x-e.x, dy2=e2.y-e.y, d2=Math.sqrt(dx2*dx2+dy2*dy2);
            if (d2 < radius) {
              e2.hp -= splash;
              addFloatingText(`-${splash}`, e2.x, e2.y - e2.size/2, "#ff8800", 10);
            }
          }
          spawnExplosionParticles(e.x, e.y);
        }

        if(player.lifesteal) player.hp=Math.min(player.maxHp,player.hp+1);
        
        // Black holes don't get consumed on hit, but have limited duration
        if(b.weaponType === "blackhole") {
          // Do nothing, let it continue existing
        } else if(b.pierce<=0) {
          bullets.splice(j,1); 
        } else {
          b.pierce--;
        }
        if(e.hp<=0){
          dropLoot(e.x,e.y); dropXP(e.x,e.y); score++;
          waveEnemiesKilled++; // Track wave kills
          
          // Check if this was a miniboss
          if (e.type === "miniboss") {
            addFloatingText("MINIBOSS DEFEATED!", e.x, e.y - 40, "#ffaa00", 20);
            triggerBossReward();
          }
          
          enemies.splice(i,1); break;
        }
      }
    }
  }

  // enemy touch dmg
  for(const e of enemies){
    const dx=e.x-player.x,dy=e.y-player.y,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<e.size/2+player.size/2){
      if(isActive("shield"))continue;
      player.hp-=e.damage*0.2;
      if(player.hp<=0)gameOver=true;
    }
  }

  // XP orbs
  for(let i=xpOrbs.length-1;i>=0;i--){
    const xp=xpOrbs[i];
    const dx=player.x-xp.x,dy=player.y-xp.y,dist=Math.sqrt(dx*dx+dy*dy);
    const pull=(isActive("magnet")||xp.vacuum)?0.4:0.15;
    xp.x+=dx*pull;xp.y+=dy*pull;
    const pickupRadius=isActive("magnet")?90:40;
    if(dist<pickupRadius){
      gainXP(xp.value);
      addFloatingText(`+${Math.floor(xp.value)} XP`, player.x, player.y - 20, "aqua");
      xpOrbs.splice(i,1);
    }
  }

  // loot pickup
  for(let i=loot.length-1;i>=0;i--){
    const l=loot[i];const dx=player.x-l.x,dy=player.y-l.y,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<player.size/2+l.size/2+15){collectLoot(l);loot.splice(i,1);}
  }
  
  // chest interaction
  for(let i=chests.length-1;i>=0;i--){
    const chest=chests[i];
    if(chest.opened) continue;
    
    const dx=player.x-chest.x,dy=player.y-chest.y,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<player.size/2+chest.size/2+10){
      openChest(chest);
      setTimeout(() => chests.splice(i,1), 2000); // Remove after 2 seconds
    }
  }

  // floating texts
  for(const f of floatingTexts){f.y+=f.vy;f.alpha-=0.02;}
  floatingTexts=floatingTexts.filter(f=>f.alpha>0);

  // stage transition animation
  updateStageTransition();

  // particles
  updateParticles();
}

// ==================== PLAYER SHIP (Dynamic Grey Ship) ====================
function drawPlayerShip() {
  // Use the player's facing angle (already determined in game loop)
  lastFacingAngle = lerpAngle(lastFacingAngle, player.facingAngle, 0.18);

  // Aura (subtle blue-grey glow around ship)
  const pulse = Math.sin(Date.now()/300)*3+6;
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  const gr=ctx.createRadialGradient(player.x,player.y,0,player.x,player.y,player.size+pulse);
  gr.addColorStop(0,"rgba(100,120,140,0.7)");
  gr.addColorStop(1,"rgba(80,100,120,0)");
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(player.x,player.y,player.size+pulse,0,Math.PI*2);ctx.fill();
  ctx.restore();

  // Enhanced shield effect if active
  if (isActive("shield")) {
    ctx.save();
    
    // Rotating shield energy
    const shieldRotation = Date.now() * 0.002;
    const shieldPulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    
    // Outer energy ring
    ctx.globalCompositeOperation = "lighter";
    const shieldGradient = ctx.createRadialGradient(player.x, player.y, player.size * 0.8, player.x, player.y, player.size * 1.4);
    shieldGradient.addColorStop(0, "rgba(0, 150, 255, 0)");
    shieldGradient.addColorStop(0.7, `rgba(0, 200, 255, ${shieldPulse * 0.4})`);
    shieldGradient.addColorStop(1, "rgba(0, 100, 200, 0)");
    ctx.fillStyle = shieldGradient;
    ctx.beginPath(); 
    ctx.arc(player.x, player.y, player.size * 1.2, 0, Math.PI * 2); 
    ctx.fill();
    
    // Multiple rotating rings
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 3; i++) {
      const ringOffset = (i * Math.PI * 2 / 3) + shieldRotation;
      const ringRadius = player.size + (i * 3);
      const alpha = (shieldPulse + i * 0.2) * 0.6;
      
      ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
      ctx.lineWidth = 2 - i * 0.3;
      ctx.shadowColor = "deepskyblue"; 
      ctx.shadowBlur = 8;
      ctx.beginPath(); 
      ctx.arc(player.x, player.y, ringRadius, ringOffset, ringOffset + Math.PI * 1.5); 
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Ship body (triangle) with neon strokes & fill; oriented by angle
  const s = player.size; // reference size
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(lastFacingAngle);

  // Fire thrusters (animated, dynamic flames)
  const flameLen = 8 + Math.sin(Date.now()/60 + player.x*0.01)*4;
  const flameWobble = Math.sin(Date.now()/120)*0.1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  
  // Main flame (orange-red)
  ctx.fillStyle = "rgba(255,100,20,0.9)";
  // left thruster
  ctx.beginPath();
  ctx.moveTo(-s*0.7, -s*0.45);
  ctx.lineTo(-s*0.7 - flameLen + flameWobble, -s*0.15);
  ctx.lineTo(-s*0.7, -s*0.05);
  ctx.closePath(); ctx.fill();
  // right thruster
  ctx.beginPath();
  ctx.moveTo(-s*0.7, s*0.45);
  ctx.lineTo(-s*0.7 - flameLen + flameWobble, s*0.15);
  ctx.lineTo(-s*0.7, s*0.05);
  ctx.closePath(); ctx.fill();
  
  // Inner flame (yellow-white core)
  ctx.fillStyle = "rgba(255,220,100,0.8)";
  const innerFlame = flameLen * 0.6;
  // left thruster core
  ctx.beginPath();
  ctx.moveTo(-s*0.7, -s*0.35);
  ctx.lineTo(-s*0.7 - innerFlame, -s*0.18);
  ctx.lineTo(-s*0.7, -s*0.15);
  ctx.closePath(); ctx.fill();
  // right thruster core
  ctx.beginPath();
  ctx.moveTo(-s*0.7, s*0.35);
  ctx.lineTo(-s*0.7 - innerFlame, s*0.18);
  ctx.lineTo(-s*0.7, s*0.15);
  ctx.closePath(); ctx.fill();
  
  ctx.restore();

  // Ship hull (sleek grey design): front tip -> back left -> back right
  const hullGrad = ctx.createLinearGradient(s,0,-s,0);
  hullGrad.addColorStop(0, "#c8d2dc");  // lighter grey at front
  hullGrad.addColorStop(0.5, "#8a95a0"); // medium grey
  hullGrad.addColorStop(1, "#5a6670");   // darker grey at back
  ctx.fillStyle = hullGrad;
  ctx.strokeStyle = "rgba(160,180,200,0.9)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(120,140,160,0.8)";
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.moveTo(s, 0);               // nose
  ctx.lineTo(-s*0.6, -s*0.85);    // back left
  ctx.lineTo(-s*0.6,  s*0.85);    // back right
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner highlight panel (metallic reflection)
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(220,230,240,0.6)";
  ctx.beginPath();
  ctx.moveTo(s*0.8, 0);
  ctx.lineTo(-s*0.5, -s*0.65);
  ctx.lineTo(-s*0.5,  s*0.65);
  ctx.closePath();
  ctx.stroke();

  // Additional hull details (wing panels)
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(180,190,200,0.4)";
  ctx.beginPath();
  ctx.moveTo(s*0.3, -s*0.3);
  ctx.lineTo(-s*0.3, -s*0.6);
  ctx.moveTo(s*0.3, s*0.3);
  ctx.lineTo(-s*0.3, s*0.6);
  ctx.stroke();

  // Rapid fire muzzle flash effect
  if (isActive("rapid") && nowMs() - player.lastShot < 100) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flashIntensity = 1 - (nowMs() - player.lastShot) / 100;
    ctx.fillStyle = `rgba(255, 150, 0, ${flashIntensity * 0.8})`;
    // Muzzle flash at the nose
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(s + 15 * flashIntensity, -5 * flashIntensity);
    ctx.lineTo(s + 10 * flashIntensity, 0);
    ctx.lineTo(s + 15 * flashIntensity, 5 * flashIntensity);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Triple shot visual indicator
  if (isActive("triple") || player.projectileCount > 1) {
    ctx.strokeStyle = "rgba(200, 150, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s*0.9, -3);
    ctx.lineTo(s*0.9, 3);
    ctx.moveTo(s*0.9, -8);
    ctx.lineTo(s*0.9, -5);
    ctx.moveTo(s*0.9, 5);
    ctx.lineTo(s*0.9, 8);
    ctx.stroke();
  }

  // Cockpit glow (bright blue-white)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(180,220,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(s*0.45, 0, s*0.18, s*0.12, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Engine vents (small rectangles at the back)
  ctx.fillStyle = "rgba(40,50,60,0.8)";
  ctx.fillRect(-s*0.65, -s*0.15, s*0.1, s*0.08);
  ctx.fillRect(-s*0.65, s*0.07, s*0.1, s*0.08);

  ctx.restore();
}

// ==================== DRAW ====================
function draw() {
  drawBackground();

  // START MENU
  if(showStartMenu){
    ctx.textAlign="center";ctx.fillStyle="white";ctx.font="72px monospace";ctx.shadowColor="lime";ctx.shadowBlur=25;
    ctx.fillText("SHPLOOTER",canvas.width/2,canvas.height/2-60);
    ctx.shadowBlur=0;ctx.font="20px monospace";ctx.fillStyle="lightgray";
    ctx.fillText("Press Enter to Start",canvas.width/2,canvas.height/2-10);
    ctx.font="16px monospace";ctx.fillStyle="gray";
    ctx.fillText("Move: WASD or Arrow Keys",canvas.width/2,canvas.height/2+40);
    ctx.fillText("Pause: P or Esc",canvas.width/2,canvas.height/2+65);
    ctx.textAlign="left";return;
  }

  // PLAYER (triangle ship)
  drawPlayerShip();
  
  // MAGNETIC FIELD VISUALIZATION (when magnet is active)
  if (isActive("magnet")) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3;
    
    // Pulsing magnetic field rings
    const magnetPulse = Math.sin(Date.now() * 0.004) * 0.4 + 0.6;
    const fieldRadius = 90; // Same as pickup radius
    
    // Multiple concentric rings for field effect
    for (let ring = 1; ring <= 3; ring++) {
      const radius = (fieldRadius / 3) * ring * magnetPulse;
      const alpha = (4 - ring) / 6;
      
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = Date.now() * 0.01 * ring;
      
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Magnetic field sparkles
    for (let i = 0; i < 8; i++) {
      const angle = (Date.now() * 0.002) + (i * Math.PI * 2 / 8);
      const sparkleX = player.x + Math.cos(angle) * fieldRadius * 0.7;
      const sparkleY = player.y + Math.sin(angle) * fieldRadius * 0.7;
      const sparkleAlpha = Math.sin(Date.now() * 0.01 + i) * 0.5 + 0.5;
      
      ctx.globalAlpha = sparkleAlpha * 0.6;
      ctx.fillStyle = "#66ffff";
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.setLineDash([]); // Reset line dash
    ctx.restore();
  }

  // DRONES (enhanced metallic design)
  drones.forEach(d => {
    ctx.save();
    
    // Pulsing energy core
    const pulse = Math.sin(Date.now() * 0.008 + d.angle) * 0.3 + 0.7;
    
    // Main body gradient
    const gradient = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size);
    gradient.addColorStop(0, `rgba(120, 150, 180, ${pulse})`);
    gradient.addColorStop(0.6, "rgba(80, 100, 120, 0.9)");
    gradient.addColorStop(1, "rgba(40, 60, 80, 0.8)");
    
    // Outer glow
    ctx.shadowColor = "#4a90e2";
    ctx.shadowBlur = 12;
    ctx.fillStyle = gradient;
    ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size, d.size);
    
    // Inner energy core
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(100, 200, 255, ${pulse})`;
    const coreSize = d.size * 0.4;
    ctx.fillRect(d.x - coreSize/2, d.y - coreSize/2, coreSize, coreSize);
    
    // Corner accent lines
    ctx.strokeStyle = "rgba(150, 200, 255, 0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(d.x - d.size/2, d.y - d.size/2, d.size, d.size);
    
    ctx.restore();
  });

  // ENHANCED COMET BULLETS (weapon-specific visual effects)
  bullets.forEach(b=>{
    b.lifetime += 1; // Track bullet age for animations
    
    // Weapon-specific trail effects
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    b.trail.forEach((t,idx)=>{
      ctx.globalAlpha = t.alpha*0.6;
      
      // Weapon-specific trail colors and effects
      switch(b.weaponType) {
        case "burst":
          ctx.fillStyle = "rgba(140, 220, 140, 1)"; // Bright green
          break;
        case "laser":
          ctx.fillStyle = "rgba(136, 136, 255, 1)"; // Blue laser
          // Add laser beam effect
          if (idx === 0) {
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = "rgba(136, 136, 255, 0.6)";
            ctx.lineWidth = b.size * 0.3;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y);
            if (b.trail[1]) ctx.lineTo(b.trail[1].x, b.trail[1].y);
            ctx.stroke();
          }
          break;
        case "rocket":
          ctx.fillStyle = "rgba(255, 140, 60, 1)"; // Orange rocket trail
          // Add exhaust particles
          if (Math.random() < 0.3) {
            ctx.fillStyle = "rgba(255, 80, 20, 0.8)";
            ctx.beginPath();
            ctx.arc(t.x + (Math.random() - 0.5) * 4, t.y + (Math.random() - 0.5) * 4, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "chain":
          ctx.fillStyle = "rgba(255, 255, 150, 1)"; // Electric yellow
          // Add lightning crackle effect
          if (Math.random() < 0.4) {
            ctx.strokeStyle = "rgba(255, 255, 200, 0.9)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y);
            ctx.lineTo(t.x + (Math.random() - 0.5) * 8, t.y + (Math.random() - 0.5) * 8);
            ctx.stroke();
          }
          break;
        case "orbital":
          ctx.fillStyle = "rgba(255, 200, 100, 1)"; // Golden orbital
          // Add sparkling effect
          if (Math.random() < 0.5) {
            ctx.fillStyle = "rgba(255, 255, 200, 0.8)";
            ctx.beginPath();
            ctx.arc(t.x + Math.sin(b.lifetime * 0.1) * 3, t.y + Math.cos(b.lifetime * 0.1) * 3, 1, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "blackhole":
          ctx.fillStyle = "rgba(180, 100, 255, 1)"; // Purple/dark energy
          // Add gravitational distortion effect
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = "rgba(80, 40, 120, 0.8)";
          break;
        case "ricochet":
          ctx.fillStyle = "rgba(150, 255, 150, 1)"; // Bouncy green
          break;
        case "spread":
          ctx.fillStyle = "rgba(200, 150, 255, 1)"; // Purple spread
          break;
        default:
          // Default bullet effects
          if (b.isCrit) {
            ctx.fillStyle = "rgba(255,255,100,1)"; // Golden for crits
          } else if (b.homing) {
            ctx.fillStyle = "rgba(150,255,150,1)"; // Green for homing
          } else if (b.explosive) {
            ctx.fillStyle = "rgba(255,180,60,1)"; // Orange for explosive
          } else {
            ctx.fillStyle = "rgba(255,255,200,1)"; // Default white/yellow
          }
      }
      
      ctx.beginPath();
      ctx.arc(t.x,t.y,b.size/2*(1-idx/8),0,Math.PI*2);
      ctx.fill();
      t.alpha -= 0.1;
    });
    ctx.restore();

    // Weapon-specific bullet core effects
    ctx.save();
    
    // Set up rotation for certain weapon types
    if (b.weaponType === "orbital" || b.weaponType === "blackhole") {
      b.rotationSpeed += 0.05;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotationSpeed);
      ctx.translate(-b.x, -b.y);
    }
    
    switch(b.weaponType) {
      case "burst":
        ctx.shadowColor = "#88cc88";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#aaffaa";
        // Triple-layered core for burst effect
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/2, 0, Math.PI*2); 
        ctx.fill();
        ctx.fillStyle = "#88cc88";
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/3, 0, Math.PI*2); 
        ctx.fill();
        break;
        
      case "laser":
        ctx.shadowColor = "#8888ff";
        ctx.shadowBlur = 22;
        ctx.fillStyle = "#aaaaff";
        // Rectangular laser projectile
        ctx.fillRect(b.x - b.size/2, b.y - b.size/4, b.size, b.size/2);
        // Inner bright core
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(b.x - b.size/3, b.y - b.size/6, b.size*2/3, b.size/3);
        break;
        
      case "rocket":
        ctx.shadowColor = "#ff8800";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#ffaa44";
        // Rocket shape
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.size/2, b.size/3, 0, 0, Math.PI*2);
        ctx.fill();
        // Nose cone
        ctx.fillStyle = "#ffccaa";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size/4, 0, Math.PI*2);
        ctx.fill();
        break;
        
      case "chain":
        ctx.shadowColor = "#ffff88";
        ctx.shadowBlur = 25;
        ctx.fillStyle = "#ffffff";
        const electricPulse = Math.sin(b.lifetime * 0.3) * 0.5 + 0.5;
        ctx.globalAlpha = 0.7 + electricPulse * 0.3;
        // Electric orb with crackling edges
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/2 * (1 + electricPulse * 0.2), 0, Math.PI*2); 
        ctx.fill();
        // Add electric arcs
        for (let i = 0; i < 4; i++) {
          const angle = (b.lifetime * 0.1) + (i * Math.PI / 2);
          const arcX = b.x + Math.cos(angle) * b.size * 0.8;
          const arcY = b.y + Math.sin(angle) * b.size * 0.8;
          ctx.strokeStyle = "#ffff88";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(arcX, arcY);
          ctx.stroke();
        }
        break;
        
      case "orbital":
        ctx.shadowColor = "#ffaa00";
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#ffcc44";
        // Star-shaped orbital projectile
        const starSpikes = 6;
        const outerRadius = b.size/2;
        const innerRadius = b.size/4;
        ctx.beginPath();
        for (let i = 0; i < starSpikes * 2; i++) {
          const angle = (i * Math.PI) / starSpikes;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const x = b.x + Math.cos(angle) * radius;
          const y = b.y + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        // Bright center
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/6, 0, Math.PI*2); 
        ctx.fill();
        break;
        
      case "blackhole":
        ctx.shadowColor = "#aa44ff";
        ctx.shadowBlur = 35;
        // Dark void with purple edge
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.size/2);
        gradient.addColorStop(0, "rgba(20, 20, 40, 1)");
        gradient.addColorStop(0.7, "rgba(80, 40, 120, 0.8)");
        gradient.addColorStop(1, "rgba(170, 68, 255, 0.9)");
        ctx.fillStyle = gradient;
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/2, 0, Math.PI*2); 
        ctx.fill();
        // Event horizon ring
        ctx.strokeStyle = "#aa44ff";
        ctx.lineWidth = 2;
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/2, 0, Math.PI*2); 
        ctx.stroke();
        break;
        
      case "ricochet":
        ctx.shadowColor = "#88ff88";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#aaffaa";
        // Diamond shape for bouncy bullets
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - b.size/2);
        ctx.lineTo(b.x + b.size/2, b.y);
        ctx.lineTo(b.x, b.y + b.size/2);
        ctx.lineTo(b.x - b.size/2, b.y);
        ctx.closePath();
        ctx.fill();
        break;
        
      case "spread":
        ctx.shadowColor = "#cc88ff";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#ddaaff";
        // Pentagon shape for spread shots
        const sides = 5;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides - Math.PI/2;
          const x = b.x + Math.cos(angle) * b.size/2;
          const y = b.y + Math.sin(angle) * b.size/2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
        
      default:
        // Enhanced default bullets based on properties
        if (b.isCrit) {
          ctx.shadowColor = "#ffff00";
          ctx.shadowBlur = 20;
          ctx.fillStyle = "#ffff00";
          const sparkleTime = Date.now() * 0.01;
          ctx.globalAlpha = 0.8 + Math.sin(sparkleTime) * 0.2;
        } else if (b.homing) {
          ctx.shadowColor = "#00ff88";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#66ff99";
        } else if (b.explosive) {
          ctx.shadowColor = "orange";
          ctx.shadowBlur = 18;
          ctx.fillStyle = "#ff8800";
        } else {
          ctx.shadowColor = "white";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "white";
        }
        ctx.beginPath(); 
        ctx.arc(b.x, b.y, b.size/2, 0, Math.PI*2); 
        ctx.fill();
    }
    ctx.restore();
  });

  // ENEMY BULLETS
  if (enemies.enemyBullets) {
    enemies.enemyBullets.forEach(eb => {
      ctx.save();
      ctx.shadowColor = "#ff4444";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ff6666";
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.size/2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ENHANCED POWERUPS (each type has unique shape and styling)
  loot.forEach(l => {
    ctx.save();
    
    // Pulsing glow effect
    const pulsePower = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
    const pulseSize = Math.sin(Date.now() * 0.005) * 2 + l.size;
    const rotation = Date.now() * 0.002;
    
    ctx.translate(l.x, l.y);
    ctx.globalCompositeOperation = "lighter";
    
    // Type-specific shapes and styling
    switch(l.type) {
      case "heal": // Cross/Plus shape (medical)
        ctx.shadowColor = "#00ff00";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#88ff88";
        // Horizontal bar
        ctx.fillRect(-l.size/2, -l.size/6, l.size, l.size/3);
        // Vertical bar
        ctx.fillRect(-l.size/6, -l.size/2, l.size/3, l.size);
        // Inner glow
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 255, 255, ${pulsePower})`;
        ctx.fillRect(-l.size/4, -l.size/8, l.size/2, l.size/4);
        ctx.fillRect(-l.size/8, -l.size/4, l.size/4, l.size/2);
        break;
        
      case "speed": // Arrow pointing right (speed)
        ctx.rotate(rotation);
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#88ffff";
        ctx.beginPath();
        ctx.moveTo(-l.size/2, -l.size/3);
        ctx.lineTo(l.size/3, 0);
        ctx.lineTo(-l.size/2, l.size/3);
        ctx.lineTo(-l.size/4, 0);
        ctx.closePath();
        ctx.fill();
        // Inner shine
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 255, 255, ${pulsePower})`;
        ctx.beginPath();
        ctx.moveTo(-l.size/3, -l.size/6);
        ctx.lineTo(l.size/6, 0);
        ctx.lineTo(-l.size/3, l.size/6);
        ctx.closePath();
        ctx.fill();
        break;
        
      case "firerate": // Star burst shape (rapid fire)
        ctx.rotate(rotation * 2);
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#ffff88";
        for(let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0, -l.size/2);
          ctx.lineTo(l.size/8, -l.size/8);
          ctx.lineTo(0, l.size/4);
          ctx.lineTo(-l.size/8, -l.size/8);
          ctx.closePath();
          ctx.fill();
        }
        break;
        
      case "triple": // Three triangles (triple shot)
        ctx.shadowColor = "#aa66ff";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#cc88ff";
        // Center triangle
        ctx.beginPath();
        ctx.moveTo(0, -l.size/3);
        ctx.lineTo(l.size/4, l.size/4);
        ctx.lineTo(-l.size/4, l.size/4);
        ctx.closePath();
        ctx.fill();
        // Left triangle
        ctx.beginPath();
        ctx.moveTo(-l.size/2, -l.size/4);
        ctx.lineTo(-l.size/4, l.size/3);
        ctx.lineTo(-l.size/2, l.size/3);
        ctx.closePath();
        ctx.fill();
        // Right triangle
        ctx.beginPath();
        ctx.moveTo(l.size/2, -l.size/4);
        ctx.lineTo(l.size/4, l.size/3);
        ctx.lineTo(l.size/2, l.size/3);
        ctx.closePath();
        ctx.fill();
        break;
        
      case "rapid": // Lightning bolt (rapid fire)
        ctx.shadowColor = "#ff8800";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#ffaa66";
        ctx.beginPath();
        ctx.moveTo(-l.size/6, -l.size/2);
        ctx.lineTo(l.size/4, -l.size/6);
        ctx.lineTo(0, -l.size/6);
        ctx.lineTo(l.size/6, l.size/2);
        ctx.lineTo(-l.size/4, l.size/6);
        ctx.lineTo(0, l.size/6);
        ctx.closePath();
        ctx.fill();
        // Inner glow
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 255, 255, ${pulsePower})`;
        ctx.beginPath();
        ctx.moveTo(-l.size/8, -l.size/3);
        ctx.lineTo(l.size/6, -l.size/8);
        ctx.lineTo(l.size/8, l.size/3);
        ctx.lineTo(-l.size/6, l.size/8);
        ctx.closePath();
        ctx.fill();
        break;
        
      case "shield": // Hexagon (shield shape)
        ctx.rotate(rotation * 0.5);
        ctx.shadowColor = "#4499ff";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#88bbff";
        ctx.beginPath();
        for(let i = 0; i < 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          const x = Math.cos(angle) * l.size/2;
          const y = Math.sin(angle) * l.size/2;
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        // Inner hexagon
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 255, 255, ${pulsePower})`;
        ctx.beginPath();
        for(let i = 0; i < 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          const x = Math.cos(angle) * l.size/4;
          const y = Math.sin(angle) * l.size/4;
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
        
      case "magnet": // Double horseshoe (magnet)
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#66ffff";
        ctx.strokeStyle = "#66ffff";
        ctx.lineWidth = l.size/4;
        ctx.lineCap = "round";
        // Left magnet arm
        ctx.beginPath();
        ctx.arc(-l.size/4, 0, l.size/3, Math.PI, 0, false);
        ctx.stroke();
        // Right magnet arm
        ctx.beginPath();
        ctx.arc(l.size/4, 0, l.size/3, Math.PI, 0, false);
        ctx.stroke();
        break;
        
      default: // Diamond fallback
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 15 * pulsePower;
        ctx.fillStyle = "#cccccc";
        ctx.beginPath();
        ctx.moveTo(0, -l.size/2);
        ctx.lineTo(l.size/2, 0);
        ctx.lineTo(0, l.size/2);
        ctx.lineTo(-l.size/2, 0);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.restore();
  });

  // TREASURE CHESTS (rarity-based styling)
  chests.forEach(chest => {
    if (chest.opened) return;
    
    ctx.save();
    chest.pulseTime += 0.02;
    const pulse = Math.sin(chest.pulseTime) * 0.3 + 0.7;
    
    // Rarity colors
    let chestColor, glowColor;
    switch(chest.rarity) {
      case "legendary": chestColor = "#ffaa00"; glowColor = "#ffd700"; break;
      case "rare": chestColor = "#8888ff"; glowColor = "#aa88ff"; break;
      default: chestColor = "#88cc88"; glowColor = "#aaffaa"; break;
    }
    
    ctx.translate(chest.x, chest.y);
    
    // Glow effect
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15 * pulse;
    ctx.fillStyle = glowColor + "44";
    ctx.fillRect(-chest.size/2 * 1.2, -chest.size/2 * 1.2, chest.size * 1.2, chest.size * 1.2);
    
    // Main chest body
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 8 * pulse;
    ctx.fillStyle = chestColor;
    ctx.fillRect(-chest.size/2, -chest.size/3, chest.size, chest.size * 0.8);
    
    // Chest lid
    ctx.fillStyle = "#654321";
    ctx.fillRect(-chest.size/2, -chest.size/2, chest.size, chest.size/3);
    
    // Lock/keyhole
    ctx.fillStyle = "#333333";
    ctx.fillRect(-chest.size/8, -chest.size/6, chest.size/4, chest.size/6);
    
    // Sparkles around legendary chests
    if (chest.rarity === "legendary") {
      for (let i = 0; i < 6; i++) {
        const angle = chest.pulseTime * 2 + (i * Math.PI * 2 / 6);
        const sparkleX = Math.cos(angle) * chest.size * 0.8;
        const sparkleY = Math.sin(angle) * chest.size * 0.8;
        
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  });

  // ENHANCED XP CRYSTALS (small triangular gems)
  xpOrbs.forEach(xp => {
    ctx.save();
    
    // Magnet effect when active
    if (isActive("magnet") || xp.vacuum) {
      // Magnetic field lines
      ctx.strokeStyle = "rgba(0, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      const dx = player.x - xp.x;
      const dy = player.y - xp.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
        ctx.beginPath();
        ctx.moveTo(xp.x, xp.y);
        ctx.lineTo(xp.x + (dx/dist) * 15, xp.y + (dy/dist) * 15);
        ctx.stroke();
      }
    }
    
    // Pulsing XP crystal
    const xpPulse = Math.sin(Date.now() * 0.01 + xp.x * 0.01) * 0.2 + 0.8;
    const crystalSize = xp.size + Math.sin(Date.now() * 0.008) * 0.5;
    
    ctx.translate(xp.x, xp.y);
    
    // Outer glow
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 6 * xpPulse;
    ctx.fillStyle = `rgba(0, 255, 255, ${xpPulse * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(0, -crystalSize * 1.2);
    ctx.lineTo(crystalSize * 0.8, crystalSize * 0.6);
    ctx.lineTo(-crystalSize * 0.8, crystalSize * 0.6);
    ctx.closePath();
    ctx.fill();
    
    // Core crystal triangle
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 4 * xpPulse;
    ctx.fillStyle = "#66ffff";
    ctx.beginPath();
    ctx.moveTo(0, -crystalSize);
    ctx.lineTo(crystalSize * 0.6, crystalSize * 0.5);
    ctx.lineTo(-crystalSize * 0.6, crystalSize * 0.5);
    ctx.closePath();
    ctx.fill();
    
    // Inner shine
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 255, 255, ${xpPulse * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(0, -crystalSize * 0.5);
    ctx.lineTo(crystalSize * 0.3, crystalSize * 0.2);
    ctx.lineTo(-crystalSize * 0.3, crystalSize * 0.2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  });

  // ENEMIES (type-based neon gradients + glow)
  enemies.forEach(e => {
    ctx.save();
    let g; let sc="#000"; let sb=15;
    switch (e.type) {
      case "elite":
        g = ctx.createRadialGradient(e.x,e.y,5,e.x,e.y,e.size/1.5);
        g.addColorStop(0,"rgba(255,200,80,1)");
        g.addColorStop(1,"rgba(120,60,0,0.9)");
        sc="orange"; sb=25; break;
      case "fast":
        g = ctx.createRadialGradient(e.x,e.y,4,e.x,e.y,e.size/1.6);
        g.addColorStop(0,"rgba(220,140,255,1)");
        g.addColorStop(1,"rgba(80,0,120,0.9)");
        sc="violet"; sb=18; break;
      case "tank":
        g = ctx.createRadialGradient(e.x,e.y,6,e.x,e.y,e.size/1.6);
        g.addColorStop(0,"rgba(140,180,255,1)");
        g.addColorStop(1,"rgba(0,40,120,0.9)");
        sc="dodgerblue"; sb=20; break;
      case "swarm":
        g = ctx.createRadialGradient(e.x,e.y,3,e.x,e.y,e.size/1.8);
        g.addColorStop(0,"rgba(140,255,180,1)");
        g.addColorStop(1,"rgba(0,100,40,0.9)");
        sc="lightgreen"; sb=12; break;
      case "miniboss":
        g = ctx.createRadialGradient(e.x,e.y,8,e.x,e.y,e.size/1.3);
        g.addColorStop(0,"rgba(255,50,50,1)");
        g.addColorStop(0.5,"rgba(200,20,20,0.95)");
        g.addColorStop(1,"rgba(80,0,0,0.9)");
        sc="crimson"; sb=35; break;
      case "minion":
        g = ctx.createRadialGradient(e.x,e.y,3,e.x,e.y,e.size/1.6);
        g.addColorStop(0,"rgba(255,150,50,1)");
        g.addColorStop(1,"rgba(120,40,0,0.9)");
        sc="darkorange"; sb=12; break;
      default:
        g = ctx.createRadialGradient(e.x,e.y,5,e.x,e.y,e.size/1.5);
        g.addColorStop(0,"rgba(255,100,100,0.95)");
        g.addColorStop(1,"rgba(100,0,0,0.9)");
        sc="red"; sb=15;
    }
    ctx.shadowColor=sc; ctx.shadowBlur=sb;
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(e.x,e.y,e.size/2,0,Math.PI*2); ctx.fill();
    
    // Miniboss health bar and effects
    if (e.type === "miniboss") {
      // Pulsing outline
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
      const bossColor = e.color || "#ff4444";
      // Convert hex to rgba for pulsing effect
      const r = parseInt(bossColor.slice(1, 3), 16);
      const g = parseInt(bossColor.slice(3, 5), 16);
      const b = parseInt(bossColor.slice(5, 7), 16);
      ctx.strokeStyle = `rgba(${r},${g},${b},${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); 
      ctx.arc(e.x, e.y, e.size/2 + 5, 0, Math.PI*2); 
      ctx.stroke();
      
      // Health bar above miniboss
      const barWidth = 80;
      const barHeight = 8;
      const healthPercent = e.hp / e.maxHp;
      
      ctx.fillStyle = "#333";
      ctx.fillRect(e.x - barWidth/2, e.y - e.size/2 - 20, barWidth, barHeight);
      ctx.fillStyle = e.color || "#ff4444";
      ctx.fillRect(e.x - barWidth/2, e.y - e.size/2 - 20, barWidth * healthPercent, barHeight);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(e.x - barWidth/2, e.y - e.size/2 - 20, barWidth, barHeight);
    }
    
    ctx.restore();
  });

  // EXPLOSION PARTICLES
  drawParticles();

  // FLOATING TEXTS
  for(const f of floatingTexts){
    ctx.globalAlpha=f.alpha; ctx.fillStyle=f.color; ctx.font=`${f.size}px monospace`;
    ctx.fillText(f.text,f.x,f.y); ctx.globalAlpha=1;
  }

  // HUD
  ctx.fillStyle="white"; ctx.font="18px monospace"; ctx.shadowColor="black"; ctx.shadowBlur=5;
  ctx.fillText(`Score: ${score}`,10,25); ctx.shadowBlur=0;

  const hpBar=200;
  ctx.fillStyle="#222"; ctx.fillRect(10,40,hpBar,12);
  ctx.fillStyle="lime"; ctx.fillRect(10,40,(player.hp/player.maxHp)*hpBar,12);
  ctx.strokeStyle="#555"; ctx.strokeRect(10,40,hpBar,12);
  ctx.fillStyle="aqua"; ctx.fillRect(10,58,(player.xp/player.xpToNext)*hpBar,8);
  ctx.strokeRect(10,58,hpBar,8);

  ctx.fillStyle="white"; ctx.font="12px monospace";
  ctx.fillText(`Lv ${player.level}`,220,66);
  
  // Permanent boosts indicator
  const totalBoosts = Object.values(permanentBoosts).reduce((sum, val) => sum + val, 0);
  if (totalBoosts > 0) {
    ctx.fillStyle="#ffaa00"; ctx.font="12px monospace";
    ctx.fillText(`Eternal Power: ${totalBoosts}`, canvas.width - 150, 25);
  }
  
  // WEAPON INVENTORY (centered at bottom of screen)
  if (weapons.length > 0) {
    const iconSize = 40;
    const spacing = 50;
    const totalWidth = weapons.length * spacing - (spacing - iconSize);
    const startX = (canvas.width - totalWidth) / 2;
    const startY = canvas.height - 40;
    
    // Weapons label (centered above icons)
    ctx.fillStyle = "white";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Weapons", canvas.width / 2, startY - 25);
    
    weapons.forEach((weapon, i) => {
      const x = startX + i * spacing;
      const y = startY;
      
      ctx.save();
      
      // Weapon slot background
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(x - iconSize/2, y - iconSize/2, iconSize, iconSize);
      
      // Rarity border
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - iconSize/2, y - iconSize/2, iconSize, iconSize);
      
      // Weapon icon
      ctx.fillStyle = weapon.color;
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(weapon.icon, x, y + 5);
      
      // Weapon level indicator
      if (weapon.level && weapon.level > 1) {
        ctx.fillStyle = "#ffff00";
        ctx.font = "10px monospace";
        ctx.fillText(`Lv${weapon.level}`, x, y - iconSize/2 + 10);
      }
      
      // Weapon name below
      ctx.fillStyle = "white";
      ctx.font = "8px monospace";
      ctx.fillText(weapon.name.substring(0, 8), x, y + iconSize/2 + 15);
      
      ctx.restore();
    });
  }
  
  // Wave information (bottom left)
  ctx.fillStyle="white"; ctx.font="16px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Wave ${currentWave}`, 10, canvas.height - 100);
  
  // Difficulty indicator
  const difficulty = getDifficultyMultiplier(currentWave);
  const difficultyLevel = currentWave <= 5 ? "Easy" : currentWave <= 10 ? "Normal" : 
                         currentWave <= 15 ? "Hard" : currentWave <= 25 ? "Extreme" : "NIGHTMARE";
  const diffColor = currentWave <= 5 ? "#00ff00" : currentWave <= 10 ? "#ffff00" : 
                   currentWave <= 15 ? "#ff8800" : currentWave <= 25 ? "#ff4400" : "#ff0044";
  ctx.fillStyle = diffColor;
  ctx.font = "12px monospace";
  ctx.fillText(`Difficulty: ${difficultyLevel}`, 10, canvas.height - 80);
  
  ctx.fillStyle="white"; ctx.font="12px monospace";
  if (inWaveIntermission) {
    const timeLeft = Math.ceil((waveIntermissionDuration - (nowMs() - waveIntermissionStart)) / 1000);
    ctx.fillText(`Next wave in: ${timeLeft}s`, 10, canvas.height - 60);
  } else {
    const remaining = waveQuota - waveEnemiesKilled;
    ctx.fillText(`Enemies left: ${remaining}`, 10, canvas.height - 60);
  }
  if (currentWave % 5 === 0 && !waveComplete) {
    ctx.fillStyle="#ff4444"; ctx.font="14px monospace";
    ctx.fillText("MINIBOSS WAVE!", 10, canvas.height - 10);
  }

  if(gameOver) drawOverlay("GAME OVER","Press R to Restart");
  if(showPauseMenu) drawMenu(pauseMenuItems,"PAUSED");
  if(choosingUpgrade) drawMenu(upgradeChoices,"LEVEL UP!");
  if(choosingBossReward) drawBossRewardMenu();
  
  // Stage transition animation (draw on top of everything)
  drawStageTransition();
}

function drawOverlay(title,subtitle){
  ctx.fillStyle="rgba(0,0,0,0.6)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign="center"; ctx.fillStyle="white";
  ctx.font="64px monospace"; ctx.fillText(title,canvas.width/2,canvas.height/2-20);
  ctx.font="20px monospace"; ctx.fillText(subtitle,canvas.width/2,canvas.height/2+40);
  ctx.textAlign="left";
}
function drawMenu(items,title){
  ctx.fillStyle="rgba(0,0,0,0.7)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign="center"; ctx.fillStyle="white"; ctx.font="48px monospace";
  ctx.fillText(title,canvas.width/2,canvas.height/2-60);
  ctx.font="22px monospace";
  items.forEach((it,i)=>{
    const y=canvas.height/2+80+i*40;
    ctx.fillStyle=i===menuIndex?"lime":"white";
    ctx.fillText(it.name||it,canvas.width/2,y);
  });
  ctx.textAlign="left";
}
function drawBossRewardMenu(){
  ctx.fillStyle="rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign="center"; ctx.fillStyle="#ffaa00"; ctx.font="48px monospace";
  ctx.fillText("MINIBOSS DEFEATED!",canvas.width/2,canvas.height/2-100);
  ctx.fillStyle="white"; ctx.font="32px monospace";
  ctx.fillText("Choose Your Reward",canvas.width/2,canvas.height/2-60);
  ctx.font="18px monospace";
  bossRewardChoices.forEach((reward,i)=>{
    const y=canvas.height/2+40+i*60;
    ctx.fillStyle=i===menuIndex?"#ffaa00":"white";
    ctx.fillText(reward.name,canvas.width/2,y);
    ctx.fillStyle=i===menuIndex?"#ffcc44":"#cccccc";
    ctx.font="14px monospace";
    ctx.fillText(reward.desc,canvas.width/2,y+20);
    ctx.font="18px monospace";
  });
  ctx.textAlign="left";
}

// ==================== LOOP ====================
function loop(){ update(); draw(); requestAnimationFrame(loop); }
loop();

// ==================== CONTROLS ====================
document.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(showStartMenu&&k==="enter"){ resetGame(); return; }
  if((k==="p"||k==="escape")&&!choosingUpgrade&&!gameOver){
    showPauseMenu=!showPauseMenu; paused=showPauseMenu; menuIndex=0;
  }
  if(showPauseMenu||choosingUpgrade||choosingBossReward){
    const items=showPauseMenu?pauseMenuItems:choosingBossReward?bossRewardChoices:upgradeChoices;
    const len=items.length;
    if(k==="arrowdown"||k==="s")menuIndex=(menuIndex+1)%len;
    if(k==="arrowup"||k==="w")menuIndex=(menuIndex-1+len)%len;
  }
  if(showPauseMenu&&k==="enter"){
    const c=pauseMenuItems[menuIndex];
    if(c==="Resume"){ showPauseMenu=false; paused=false; }
    if(c==="Restart") resetGame();
  }
  if(choosingUpgrade&&( ["1","2","3"].includes(k)||k==="enter")){
    const i=k==="enter"?menuIndex:Number(k)-1;
    if(i>=0&&i<upgradeChoices.length) chooseUpgrade(i);
  }
  if(choosingBossReward&&( ["1","2","3"].includes(k)||k==="enter")){
    const i=k==="enter"?menuIndex:Number(k)-1;
    if(i>=0&&i<bossRewardChoices.length) chooseBossReward(i);
  }
  if(k==="r"&&gameOver) resetGame();
});
