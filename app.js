/**
 * Main Application Script for Oneiric Cartographer
 */

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean-canvas");
  const ctx = canvas.getContext("2d");
  const container = document.getElementById("canvas-container");
  const atmosphere = document.getElementById("atmosphere-overlay");

  // DOM Elements
  const form = document.getElementById("island-form");
  const dreamTitleInput = document.getElementById("dream-title");
  const dreamNotesInput = document.getElementById("dream-notes");
  const sliders = ["lucidity", "chaos", "warmth", "gravity", "vertigo"];
  const hudClock = document.getElementById("hud-clock");
  const hudCount = document.getElementById("hud-count");
  const timeSelect = document.getElementById("time-cycle-select");
  const btnReset = document.getElementById("btn-reset");
  const btnExport = document.getElementById("btn-export");
  const btnImport = document.getElementById("btn-import");
  const importFile = document.getElementById("import-file");
  const btnAudio = document.getElementById("btn-audio");

  // Linking Interface
  const linkingHud = document.getElementById("linking-hud");
  const btnCancelLink = document.getElementById("btn-cancel-link");
  const btnLinkMode = document.getElementById("btn-link-mode");
  
  // Sidebar Explorer Explorer
  const explorerList = document.getElementById("explorer-list");
  const explorerSearch = document.getElementById("explorer-search");
  
  // Modal Elements
  const modal = document.getElementById("detail-modal");
  const modalClose = document.getElementById("modal-close");
  const modalTitle = document.getElementById("modal-title");
  const modalDate = document.getElementById("modal-date");
  const modalNotes = document.getElementById("modal-notes");
  const modalDims = document.getElementById("modal-dimensions");
  const modalPreviewCanvas = document.getElementById("modal-preview-canvas");
  const btnDeleteIsland = document.getElementById("btn-delete-island");

  // Application State
  let islands = [];
  let constellationLinks = []; // Array of arrays: [id1, id2]
  let selectedIslandId = null;
  let activeModalIsland = null;
  let isLinkingMode = false;
  let linkSourceId = null;

  // Viewport/Camera State
  const camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    isDragging: false,
    startX: 0,
    startY: 0,
    targetX: null,
    targetY: null,
    targetZoom: null
  };

  // Environment Settings
  let timeOfDay = "night";
  let customTimeSelect = "realtime";
  
  // Particle waves/grid structure
  const gridParticles = [];
  for (let i = 0; i < 60; i++) {
    gridParticles.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      size: Math.random() * 2 + 1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03
    });
  }

  // --- Web Audio Synthesizer Engine ---
  let audioCtx = null;
  let masterGain = null;
  let lowDroneOsc = null;
  let audioEnabled = false;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Low ambient background drone oscillator
      lowDroneOsc = audioCtx.createOscillator();
      lowDroneOsc.type = "sine";
      lowDroneOsc.frequency.setValueAtTime(65, audioCtx.currentTime); // C2

      const droneFilter = audioCtx.createBiquadFilter();
      droneFilter.type = "lowpass";
      droneFilter.frequency.setValueAtTime(120, audioCtx.currentTime);

      const droneGain = audioCtx.createGain();
      droneGain.gain.setValueAtTime(0.4, audioCtx.currentTime);

      lowDroneOsc.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(masterGain);
      
      lowDroneOsc.start();
    } catch (e) {
      console.warn("Web Audio API is not supported on this browser", e);
    }
  }

  function playIslandTone(isl) {
    if (!audioEnabled || !audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const t = audioCtx.currentTime;
    
    // Warmth dictates fundamental scale root (e.g. C3 to G3)
    const baseFreq = 130.81 + (isl.warmth / 100) * 196; // C3 (130Hz) to G3 (326Hz)
    
    // Choose wave shape based on warmth
    const type = isl.warmth > 45 ? "sine" : "triangle";
    
    // Setup filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    
    // High lucidity = bright (higher cutoff), Low lucidity = muffled (low cutoff)
    const cutoff = 180 + (isl.lucidity / 100) * 1500;
    filter.frequency.setValueAtTime(cutoff, t);
    
    // High gravity = steep resonance Q
    filter.Q.setValueAtTime((isl.gravity / 100) * 12, t);

    // Dynamic gain envelope
    const noteGain = audioCtx.createGain();
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(0.4, t + 0.08); // attack
    // Decay tail depends on chaos
    const decayDuration = 0.5 + (isl.chaos / 100) * 2.5;
    noteGain.gain.exponentialRampToValueAtTime(0.001, t + decayDuration);

    // Create three voice oscillators for a rich harmonic chord (triad)
    const voiceCount = 3;
    const intervals = [1.0, 1.25, 1.5]; // major triad: root, major third, fifth
    
    for (let i = 0; i < voiceCount; i++) {
      const osc = audioCtx.createOscillator();
      osc.type = type;
      
      // Calculate detuned note frequencies
      const detuneAmount = (Math.random() - 0.5) * (isl.chaos / 10);
      const voiceFreq = baseFreq * intervals[i] + detuneAmount;
      
      osc.frequency.setValueAtTime(voiceFreq, t);
      osc.connect(filter);
      
      osc.start(t);
      osc.stop(t + decayDuration + 0.1);
    }

    filter.connect(noteGain);
    noteGain.connect(masterGain);
  }

  // --- Dynamic Slider Values ---
  sliders.forEach(id => {
    const slider = document.getElementById(`slider-${id}`);
    const valLabel = document.getElementById(`val-${id}`);
    if (slider && valLabel) {
      slider.addEventListener("input", (e) => {
        valLabel.textContent = `${e.target.value}%`;
      });
    }
  });

  // --- Local Storage Management ---
  function saveState() {
    localStorage.setItem("oneiric_archipelago", JSON.stringify(islands.map(isl => ({
      id: isl.id,
      title: isl.title,
      notes: isl.notes,
      date: isl.date,
      lucidity: isl.lucidity,
      chaos: isl.chaos,
      warmth: isl.warmth,
      gravity: isl.gravity,
      vertigo: isl.vertigo,
      seedX: isl.seedX,
      seedY: isl.seedY,
      x: isl.x,
      y: isl.y
    }))));
    localStorage.setItem("oneiric_links", JSON.stringify(constellationLinks));
    hudCount.textContent = islands.length;
    renderExplorerList();
  }

  function loadState() {
    const savedIslands = localStorage.getItem("oneiric_archipelago");
    const savedLinks = localStorage.getItem("oneiric_links");
    
    if (savedIslands) {
      try {
        const parsed = JSON.parse(savedIslands);
        islands = parsed.map(data => new Island(data));
      } catch (e) {
        console.error("Could not parse saved islands:", e);
        loadDefaultIslands();
      }
    } else {
      loadDefaultIslands();
    }

    if (savedLinks) {
      try {
        constellationLinks = JSON.parse(savedLinks);
      } catch (e) {
        console.error("Could not parse saved links:", e);
        constellationLinks = [];
      }
    }

    hudCount.textContent = islands.length;
    renderExplorerList();
  }

  function loadDefaultIslands() {
    islands = [
      new Island({
        title: "Isle of Lucid Epiphany",
        notes: "A towering, crystalline ridge of high clarity and sharp angles. Felt as though I was floating above a glass geometric matrix.",
        lucidity: 90, chaos: 30, warmth: 20, gravity: 80, vertigo: 10,
        x: -200, y: -100
      }),
      new Island({
        title: "The Maelstrom Atoll",
        notes: "A chaotic, swirling coral network. The shoreline shifts constantly under waves of colorful vertigo.",
        lucidity: 45, chaos: 85, warmth: 80, gravity: 35, vertigo: 85,
        x: 180, y: 150
      }),
      new Island({
        title: "Solitary Moss Dunes",
        notes: "A serene, slow-sloping grassland. Greenish-blue hills fading off into comfortable, warm fog.",
        lucidity: 60, chaos: 15, warmth: 45, gravity: 15, vertigo: 5,
        x: -50, y: 200
      })
    ];
    constellationLinks = [];
    saveState();
  }

  // --- Explorer Explorer Panel Logic ---
  function renderExplorerList() {
    explorerList.innerHTML = "";
    const filterText = explorerSearch.value.trim().toLowerCase();
    
    const filtered = islands.filter(isl => {
      return isl.title.toLowerCase().includes(filterText) ||
             isl.notes.toLowerCase().includes(filterText);
    });

    if (filtered.length === 0) {
      explorerList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 16px 0;">No matching dreams logged</div>`;
      return;
    }

    filtered.forEach(isl => {
      const item = document.createElement("div");
      item.className = "explorer-item";
      if (selectedIslandId === isl.id) {
        item.classList.add("active");
      }

      item.innerHTML = `
        <span class="explorer-item-title">${isl.title}</span>
        <span class="explorer-item-date">${isl.date.split(',')[0]}</span>
      `;

      item.addEventListener("click", () => {
        focusOnIsland(isl);
        playIslandTone(isl);
      });

      explorerList.appendChild(item);
    });
  }

  explorerSearch.addEventListener("input", renderExplorerList);

  function focusOnIsland(isl) {
    selectedIslandId = isl.id;
    renderExplorerList();

    // Trigger smooth panning to the island coordinates
    camera.targetX = canvas.width / 2 - isl.x * 1.2;
    camera.targetY = canvas.height / 2 - isl.y * 1.2;
    camera.targetZoom = 1.2;
  }

  // --- Audio Toggle button ---
  btnAudio.addEventListener("click", () => {
    initAudio();
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      btnAudio.textContent = "🔊 Soundscape On";
      btnAudio.classList.add("enabled");
      
      // Play brief test sound
      if (islands.length > 0) {
        playIslandTone(islands[0]);
      }
    } else {
      btnAudio.textContent = "🔇 Soundscape Off";
      btnAudio.classList.remove("enabled");
    }
  });

  // --- Canvas Panning and Zooming ---
  function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // Center camera initially
  camera.x = canvas.width / 2;
  camera.y = canvas.height / 2;

  canvas.addEventListener("mousedown", (e) => {
    // Disable panning animations once user manually interacts
    camera.targetX = null;
    camera.targetY = null;
    camera.targetZoom = null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Map mouse click to world coordinates
    const worldX = (mouseX - camera.x) / camera.zoom;
    const worldY = (mouseY - camera.y) / camera.zoom;

    const clicked = islands.find(isl => {
      const dx = worldX - isl.x;
      const dy = worldY - isl.y;
      return Math.sqrt(dx*dx + dy*dy) < isl.radius;
    });

    if (clicked) {
      if (isLinkingMode) {
        completeLinking(clicked);
      } else {
        focusOnIsland(clicked);
        playIslandTone(clicked);
        openDetailModal(clicked);
      }
    } else {
      if (isLinkingMode) {
        cancelLinking();
      }
      camera.isDragging = true;
      camera.startX = e.clientX - camera.x;
      camera.startY = e.clientY - camera.y;
      canvas.style.cursor = "grabbing";
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (camera.isDragging) {
      camera.x = e.clientX - camera.startX;
      camera.y = e.clientY - camera.startY;
    }
  });

  window.addEventListener("mouseup", () => {
    camera.isDragging = false;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    camera.targetX = null;
    camera.targetY = null;
    camera.targetZoom = null;

    const zoomFactor = 1.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - camera.x) / camera.zoom;
    const worldY = (mouseY - camera.y) / camera.zoom;

    if (e.deltaY < 0) {
      camera.zoom = Math.min(camera.zoom * zoomFactor, 3.0);
    } else {
      camera.zoom = Math.max(camera.zoom / zoomFactor, 0.3);
    }

    camera.x = mouseX - worldX * camera.zoom;
    camera.y = mouseY - worldY * camera.zoom;
  }, { passive: false });

  // Double click to spawn quick random island
  canvas.addEventListener("dblclick", (e) => {
    if (isLinkingMode) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX - camera.x) / camera.zoom;
    const worldY = (mouseY - camera.y) / camera.zoom;

    const collision = islands.find(isl => {
      const dx = worldX - isl.x;
      const dy = worldY - isl.y;
      return Math.sqrt(dx*dx + dy*dy) < (isl.radius * 2);
    });

    if (!collision) {
      const adjectives = ["Ethereal", "Whispering", "Labyrinthine", "Glimmering", "Lost", "Infinite", "Abyssal", "Shattered"];
      const nouns = ["Cove", "Vortex", "Spires", "Reef", "Plateau", "Mirage", "Shrine", "Sands"];
      const title = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
      
      const newIsl = new Island({
        title: title,
        notes: "A spontaneous projection formed directly from the deep subconscious waters.",
        lucidity: Math.floor(Math.random() * 80) + 20,
        chaos: Math.floor(Math.random() * 90) + 10,
        warmth: Math.floor(Math.random() * 100),
        gravity: Math.floor(Math.random() * 80) + 20,
        vertigo: Math.floor(Math.random() * 90) + 10,
        x: worldX,
        y: worldY
      });
      islands.push(newIsl);
      saveState();
      focusOnIsland(newIsl);
      playIslandTone(newIsl);
      
      showSpawnIndicator(mouseX, mouseY, title);
    }
  });

  function showSpawnIndicator(x, y, text) {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = "var(--accent)";
    el.style.textShadow = "0 0 10px var(--accent-glow)";
    el.style.fontFamily = "var(--font-display)";
    el.style.fontSize = "1.2rem";
    el.style.transform = "translate(-50%, -50%)";
    el.style.pointerEvents = "none";
    el.style.zIndex = "99";
    el.style.transition = "all 1s cubic-bezier(0.1, 0.8, 0.3, 1)";
    el.style.opacity = "1";
    el.textContent = `+ ${text}`;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = "translate(-50%, -100%) scale(1.1)";
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 1000);
  }

  // --- Constellation Linking Engine ---
  btnLinkMode.addEventListener("click", () => {
    if (activeModalIsland) {
      isLinkingMode = true;
      linkSourceId = activeModalIsland.id;
      closeModal();
      linkingHud.classList.remove("hidden");
    }
  });

  btnCancelLink.addEventListener("click", cancelLinking);

  function cancelLinking() {
    isLinkingMode = false;
    linkSourceId = null;
    linkingHud.classList.add("hidden");
  }

  function completeLinking(targetIsland) {
    if (!linkSourceId || linkSourceId === targetIsland.id) {
      cancelLinking();
      return;
    }

    // Check if link already exists
    const exists = constellationLinks.some(link => {
      return (link[0] === linkSourceId && link[1] === targetIsland.id) ||
             (link[1] === linkSourceId && link[0] === targetIsland.id);
    });

    if (!exists) {
      constellationLinks.push([linkSourceId, targetIsland.id]);
      saveState();
      
      // Trigger a beautiful audio sweep if sound is enabled
      if (audioEnabled && audioCtx) {
        const t = audioCtx.currentTime;
        const noteGain = audioCtx.createGain();
        noteGain.gain.setValueAtTime(0, t);
        noteGain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.4);
        
        osc.connect(noteGain);
        noteGain.connect(masterGain);
        
        osc.start(t);
        osc.stop(t + 0.85);
      }
    }

    cancelLinking();
  }

  // --- Drift Physics Simulation ---
  function updatePhysics() {
    const speedLimit = 0.15;
    
    // 1. Repulsion between islands
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const islA = islands[i];
        const islB = islands[j];
        const dx = islB.x - islA.x;
        const dy = islB.y - islA.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = (islA.radius + islB.radius) * 1.5;

        if (dist < minDist && dist > 0) {
          const force = (minDist - dist) * 0.0002;
          const forceX = (dx / dist) * force;
          const forceY = (dy / dist) * force;

          islA.vx -= forceX;
          islA.vy -= forceY;
          islB.vx += forceX;
          islB.vy += forceY;
        }
      }

      // 2. Slow pull to origin
      const originDist = Math.sqrt(islands[i].x * islands[i].x + islands[i].y * islands[i].y);
      if (originDist > 550) {
        const centerPull = 0.000015 * (originDist - 550);
        islands[i].vx -= (islands[i].x / originDist) * centerPull;
        islands[i].vy -= (islands[i].y / originDist) * centerPull;
      }

      // Gentle random current walk
      islands[i].vx += (Math.random() - 0.5) * 0.008;
      islands[i].vy += (Math.random() - 0.5) * 0.008;

      islands[i].vx *= 0.98;
      islands[i].vy *= 0.98;

      const isl = islands[i];
      isl.vx = Math.max(-speedLimit, Math.min(speedLimit, isl.vx));
      isl.vy = Math.max(-speedLimit, Math.min(speedLimit, isl.vy));

      isl.x += isl.vx;
      isl.y += isl.vy;
    }

    // 3. Smooth Camera Panning animations
    if (camera.targetX !== null && camera.targetY !== null) {
      camera.x += (camera.targetX - camera.x) * 0.08;
      camera.y += (camera.targetY - camera.y) * 0.08;
      
      // Stop animation once very close
      if (Math.abs(camera.targetX - camera.x) < 0.5 && Math.abs(camera.targetY - camera.y) < 0.5) {
        camera.targetX = null;
        camera.targetY = null;
      }
    }

    if (camera.targetZoom !== null) {
      camera.zoom += (camera.targetZoom - camera.zoom) * 0.08;
      if (Math.abs(camera.targetZoom - camera.zoom) < 0.01) {
        camera.targetZoom = null;
      }
    }

    // Dynamic drone modulation based on panning coordinates
    if (audioEnabled && audioCtx && lowDroneOsc) {
      const modulation = (camera.x + camera.y) / 50;
      lowDroneOsc.frequency.setValueAtTime(65 + (modulation % 10), audioCtx.currentTime);
    }
  }

  // --- Rendering Loop ---
  function renderApp() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const oceanTop = getComputedStyle(document.body).getPropertyValue('--bg-ocean-top').trim();
    const oceanBottom = getComputedStyle(document.body).getPropertyValue('--bg-ocean-bottom').trim();
    bgGradient.addColorStop(0, oceanTop);
    bgGradient.addColorStop(1, oceanBottom);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw animated ocean swells (wavy grid lines)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.014)";
    ctx.lineWidth = 1.5;
    const waveCount = 5;
    const timeFactor = Date.now() * 0.0015;
    
    for (let w = 0; w < waveCount; w++) {
      ctx.beginPath();
      const waveY = -500 + w * 300 + (Math.sin(timeFactor + w) * 20);
      for (let wx = -1500; wx <= 1500; wx += 50) {
        const offset = Math.sin(wx * 0.005 + timeFactor) * 15;
        if (wx === -1500) ctx.moveTo(wx, waveY + offset);
        else ctx.lineTo(wx, waveY + offset);
      }
      ctx.stroke();
    }

    // Draw coordinate dots
    gridParticles.forEach(p => {
      p.phase += p.speed;
      const pulseSize = p.size * (1 + Math.sin(p.phase) * 0.35);
      const alpha = 0.08 + Math.sin(p.phase) * 0.04;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Constellation Connection Lines
    constellationLinks.forEach(link => {
      const islA = islands.find(isl => isl.id === link[0]);
      const islB = islands.find(isl => isl.id === link[1]);
      if (islA && islB) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        
        ctx.beginPath();
        ctx.moveTo(islA.x, islA.y);
        ctx.lineTo(islB.x, islB.y);
        ctx.stroke();
        ctx.restore();
      }
    });

    // Draw Islands
    islands.forEach(isl => {
      ctx.save();
      ctx.translate(isl.x, isl.y);
      isl.render(ctx, 1.0, true);
      ctx.restore();
    });

    // Draw Link-mode target lines (active feedback)
    if (isLinkingMode && linkSourceId) {
      const srcIsl = islands.find(isl => isl.id === linkSourceId);
      if (srcIsl) {
        // Find cursor target position
        // Set canvas cursor to crosshair
        canvas.style.cursor = "crosshair";
      }
    }

    ctx.restore();
  }

  // Animation Loop
  function tick() {
    updatePhysics();
    renderApp();
    requestAnimationFrame(tick);
  }
  loadState();
  requestAnimationFrame(tick);

  // --- Clock / Subconscious Time Logic ---
  function updateTimeOfDay() {
    const date = new Date();
    hudClock.textContent = date.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    if (customTimeSelect === "realtime") {
      const hour = date.getHours();
      let selectedTheme = "night";
      if (hour >= 5 && hour < 8) selectedTheme = "dawn";
      else if (hour >= 8 && hour < 17) selectedTheme = "day";
      else if (hour >= 17 && hour < 20) selectedTheme = "dusk";
      setThemeMode(selectedTheme);
    }
  }

  function setThemeMode(theme) {
    timeOfDay = theme;
    document.body.className = "";
    document.body.classList.add(`theme-${theme}`);
    
    if (theme === "night") {
      atmosphere.style.background = "radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.8) 100%)";
    } else if (theme === "dawn") {
      atmosphere.style.background = "radial-gradient(circle at center, rgba(253, 174, 143, 0.05) 20%, rgba(15, 10, 20, 0.6) 100%)";
    } else if (theme === "day") {
      atmosphere.style.background = "radial-gradient(circle at center, rgba(255, 255, 255, 0.08) 20%, rgba(0, 0, 0, 0.3) 100%)";
    } else if (theme === "dusk") {
      atmosphere.style.background = "radial-gradient(circle at center, rgba(235, 104, 189, 0.05) 20%, rgba(10, 3, 13, 0.7) 100%)";
    }
  }

  setInterval(updateTimeOfDay, 1000);
  updateTimeOfDay();

  timeSelect.addEventListener("change", (e) => {
    customTimeSelect = e.target.value;
    if (customTimeSelect !== "realtime") {
      setThemeMode(customTimeSelect);
    } else {
      updateTimeOfDay();
    }
  });

  // --- Form submission to create island ---
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = dreamTitleInput.value.trim();
    const notes = dreamNotesInput.value.trim();

    const viewportCenterX = (canvas.width / 2 - camera.x) / camera.zoom;
    const viewportCenterY = (canvas.height / 2 - camera.y) / camera.zoom;
    const randomOffsetAngle = Math.random() * Math.PI * 2;
    const randomOffsetDist = 100 + Math.random() * 200;
    
    const x = viewportCenterX + Math.cos(randomOffsetAngle) * randomOffsetDist;
    const y = viewportCenterY + Math.sin(randomOffsetAngle) * randomOffsetDist;

    const newIsl = new Island({
      title: title,
      notes: notes,
      lucidity: parseInt(document.getElementById("slider-lucidity").value),
      chaos: parseInt(document.getElementById("slider-chaos").value),
      warmth: parseInt(document.getElementById("slider-warmth").value),
      gravity: parseInt(document.getElementById("slider-gravity").value),
      vertigo: parseInt(document.getElementById("slider-vertigo").value),
      x: x,
      y: y
    });

    islands.push(newIsl);
    saveState();

    form.reset();
    sliders.forEach(id => {
      document.getElementById(`val-${id}`).textContent = "50%";
    });

    focusOnIsland(newIsl);
    playIslandTone(newIsl);
  });

  // --- Detail Modal logic ---
  function openDetailModal(isl) {
    activeModalIsland = isl;
    modalTitle.textContent = isl.title;
    modalDate.textContent = `Logged on ${isl.date}`;
    modalNotes.textContent = isl.notes || "No conscious logs written for this dream state.";

    modalDims.innerHTML = `
      <div class="modal-dim-card">
        <span class="modal-dim-label">Lucidity</span>
        <span class="modal-dim-val">${isl.lucidity}%</span>
      </div>
      <div class="modal-dim-card">
        <span class="modal-dim-label">Chaos</span>
        <span class="modal-dim-val">${isl.chaos}%</span>
      </div>
      <div class="modal-dim-card">
        <span class="modal-dim-label">Warmth</span>
        <span class="modal-dim-val">${isl.warmth}%</span>
      </div>
      <div class="modal-dim-card">
        <span class="modal-dim-label">Gravity</span>
        <span class="modal-dim-val">${isl.gravity}%</span>
      </div>
      <div class="modal-dim-card">
        <span class="modal-dim-label">Vertigo</span>
        <span class="modal-dim-val">${isl.vertigo}%</span>
      </div>
    `;

    modalPreviewCanvas.width = 260;
    modalPreviewCanvas.height = 260;
    const mCtx = modalPreviewCanvas.getContext("2d");
    mCtx.clearRect(0, 0, 260, 260);

    const tempX = isl.x;
    const tempY = isl.y;
    isl.x = 0;
    isl.y = 0;
    
    mCtx.save();
    mCtx.translate(130, 130);
    isl.render(mCtx, 0.95, false);
    mCtx.restore();

    isl.x = tempX;
    isl.y = tempY;

    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
    activeModalIsland = null;
  }

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Dematerialize/Delete island
  btnDeleteIsland.addEventListener("click", () => {
    if (activeModalIsland) {
      // Remove links referencing this island
      constellationLinks = constellationLinks.filter(link => {
        return link[0] !== activeModalIsland.id && link[1] !== activeModalIsland.id;
      });

      islands = islands.filter(isl => isl.id !== activeModalIsland.id);
      saveState();
      closeModal();
    }
  });

  // --- Reset/Export/Import HUD Buttons ---
  btnReset.addEventListener("click", () => {
    if (confirm("Are you sure you want to dissolve the entire subconscious archipelago? This action is permanent.")) {
      islands = [];
      constellationLinks = [];
      saveState();
    }
  });

  btnExport.addEventListener("click", () => {
    const dataPack = {
      islands: islands,
      links: constellationLinks
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataPack));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `subconscious-archipelago-${Date.now()}.json`);
    dlAnchorElem.click();
  });

  btnImport.addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.islands && Array.isArray(parsed.islands)) {
          islands = parsed.islands.map(data => new Island(data));
          constellationLinks = parsed.links || [];
          saveState();
          alert("Archipelago data imported successfully.");
        } else if (Array.isArray(parsed)) { // Legacy fallback
          islands = parsed.map(data => new Island(data));
          constellationLinks = [];
          saveState();
          alert("Legacy data imported successfully.");
        } else {
          alert("Invalid data format.");
        }
      } catch (err) {
        alert("Error parsing file. Ensure it is a valid JSON.");
      }
    };
    reader.readAsText(file);
  });
});
