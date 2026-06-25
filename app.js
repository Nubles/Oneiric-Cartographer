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
  let selectedIslandId = null;
  let activeModalIsland = null;

  // Viewport/Camera State
  const camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    isDragging: false,
    startX: 0,
    startY: 0
  };

  // Environment Settings
  let timeOfDay = "night"; // default
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
    hudCount.textContent = islands.length;
  }

  function loadState() {
    const saved = localStorage.getItem("oneiric_archipelago");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        islands = parsed.map(data => new Island(data));
      } catch (e) {
        console.error("Could not parse saved archipelago:", e);
        loadDefaultIslands();
      }
    } else {
      loadDefaultIslands();
    }
    hudCount.textContent = islands.length;
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
    saveState();
  }

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
    // Check if clicked an island first
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
      openDetailModal(clicked);
    } else {
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

    // Keep zoom centered on cursor
    camera.x = mouseX - worldX * camera.zoom;
    camera.y = mouseY - worldY * camera.zoom;
  }, { passive: false });

  // Double click to spawn quick random island
  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX - camera.x) / camera.zoom;
    const worldY = (mouseY - camera.y) / camera.zoom;

    // Check if clicked close to existing island
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
      
      // Floating text effect
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

  // --- Drift Physics Simulation ---
  function updatePhysics() {
    const speedLimit = 0.2;
    
    // 1. Repulsion between islands (prevent overlaps)
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const islA = islands[i];
        const islB = islands[j];
        const dx = islB.x - islA.x;
        const dy = islB.y - islA.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = (islA.radius + islB.radius) * 1.5;

        if (dist < minDist && dist > 0) {
          const force = (minDist - dist) * 0.0003;
          const forceX = (dx / dist) * force;
          const forceY = (dy / dist) * force;

          islA.vx -= forceX;
          islA.vy -= forceY;
          islB.vx += forceX;
          islB.vy += forceY;
        }
      }

      // 2. Slow friction + pull towards central origin so they don't wander off completely
      const originDist = Math.sqrt(islands[i].x * islands[i].x + islands[i].y * islands[i].y);
      if (originDist > 600) {
        const centerPull = 0.00002 * (originDist - 600);
        islands[i].vx -= (islands[i].x / originDist) * centerPull;
        islands[i].vy -= (islands[i].y / originDist) * centerPull;
      }

      // Add gentle random dream current
      islands[i].vx += (Math.random() - 0.5) * 0.01;
      islands[i].vy += (Math.random() - 0.5) * 0.01;

      // Friction
      islands[i].vx *= 0.98;
      islands[i].vy *= 0.98;

      // Speed clamp
      islands[i].vx = Math.max(-speedLimit, Math.min(speedLimit, islands[i].vx));
      islands[i].vy = Math.max(-speedLimit, Math.min(speedLimit, islands[i].vy));

      // Apply velocities
      islands[i].x += islands[i].vx;
      islands[i].y += islands[i].vy;
    }
  }

  // --- Rendering Loop ---
  function renderApp() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply lighting gradient to the ocean background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const oceanTop = getComputedStyle(document.body).getPropertyValue('--bg-ocean-top').trim();
    const oceanBottom = getComputedStyle(document.body).getPropertyValue('--bg-ocean-bottom').trim();
    bgGradient.addColorStop(0, oceanTop);
    bgGradient.addColorStop(1, oceanBottom);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw ocean grid ripples/particles (moving in background)
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    gridParticles.forEach(p => {
      p.phase += p.speed;
      const pulseSize = p.size * (1 + Math.sin(p.phase) * 0.35);
      const alpha = 0.08 + Math.sin(p.phase) * 0.04;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw grid coordinate system lines (subtle hand-drawn styled grid)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
    ctx.lineWidth = 0.8 / camera.zoom;
    const gridSpacing = 200;
    const worldLeft = -camera.x / camera.zoom;
    const worldRight = (canvas.width - camera.x) / camera.zoom;
    const worldTop = -camera.y / camera.zoom;
    const worldBottom = (canvas.height - camera.y) / camera.zoom;

    const startGridX = Math.floor(worldLeft / gridSpacing) * gridSpacing;
    const endGridX = Math.ceil(worldRight / gridSpacing) * gridSpacing;
    for (let gx = startGridX; gx <= endGridX; gx += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(gx, worldTop);
      ctx.lineTo(gx, worldBottom);
      ctx.stroke();
    }

    const startGridY = Math.floor(worldTop / gridSpacing) * gridSpacing;
    const endGridY = Math.ceil(worldBottom / gridSpacing) * gridSpacing;
    for (let gy = startGridY; gy <= endGridY; gy += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(worldLeft, gy);
      ctx.lineTo(worldRight, gy);
      ctx.stroke();
    }

    // Render Islands
    islands.forEach(isl => {
      ctx.save();
      ctx.translate(isl.x, isl.y);
      isl.render(ctx, 1.0, true);
      ctx.restore();
    });

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
    
    // Format dynamic system clock
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
    document.body.className = ""; // clear all
    document.body.classList.add(`theme-${theme}`);
    
    // Map overlay effects
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

    // Pick random location around central viewport
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

    // Reset Form
    form.reset();
    sliders.forEach(id => {
      document.getElementById(`val-${id}`).textContent = "50%";
    });

    // Smooth pan to focus new island
    camera.x = canvas.width / 2 - newIsl.x * camera.zoom;
    camera.y = canvas.height / 2 - newIsl.y * camera.zoom;
  });

  // --- Detail Modal logic ---
  function openDetailModal(isl) {
    activeModalIsland = isl;
    modalTitle.textContent = isl.title;
    modalDate.textContent = `Logged on ${isl.date}`;
    modalNotes.textContent = isl.notes || "No conscious logs written for this dream state.";

    // Render dimensions grid
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

    // Render large preview of the island on modal canvas
    modalPreviewCanvas.width = 260;
    modalPreviewCanvas.height = 260;
    const mCtx = modalPreviewCanvas.getContext("2d");
    mCtx.clearRect(0, 0, 260, 260);

    // Save actual position & radius to render centrally
    const tempX = isl.x;
    const tempY = isl.y;
    isl.x = 0;
    isl.y = 0;
    
    mCtx.save();
    mCtx.translate(130, 130);
    // Draw inside preview modal
    isl.render(mCtx, 1.0, false);
    mCtx.restore();

    // Restore actual positions
    isl.x = tempX;
    isl.y = tempY;

    // Show modal
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
      islands = islands.filter(isl => isl.id !== activeModalIsland.id);
      saveState();
      closeModal();
    }
  });

  // --- Reset/Export/Import HUD Buttons ---
  btnReset.addEventListener("click", () => {
    if (confirm("Are you sure you want to dissolve the entire subconscious archipelago? This action is permanent.")) {
      islands = [];
      saveState();
    }
  });

  btnExport.addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(islands));
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
        if (Array.isArray(parsed)) {
          islands = parsed.map(data => new Island(data));
          saveState();
          alert("Archipelago data imported successfully.");
        } else {
          alert("Invalid data format. Must be an array of islands.");
        }
      } catch (err) {
        alert("Error parsing file. Ensure it is a valid backup JSON.");
      }
    };
    reader.readAsText(file);
  });
});
