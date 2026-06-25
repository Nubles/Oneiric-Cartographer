# Oneiric Cartographer: Subconscious Archipelago

An interactive web application designed to map and materialize your dream states and subconscious moods into an evolving, procedurally generated archipelago of floating islands.

Built using native Web APIs, zero build-step overhead, and customized styling.

## 🌟 Key Features

- **Procedural Land Generation**: Sliders represent subconscious dimensions (**Lucidity**, **Chaos**, **Warmth**, **Gravity**, and **Vertigo**) that dynamically warp coordinates and regenerate topography via a custom layered 2D Perlin Noise algorithm.
- **Drift Physics Simulation**: A light-weight multi-body physics engine ensures islands drift dynamically and push away from one another, preventing overlap.
- **Interactive Map**: Supports click-and-drag panning, scroll wheel zooming, and double-clicking on the ocean to spawn quick random islands.
- **Subconscious Journal**: Save dream narratives, checklist memories, and custom logs for individual islands. Clicking an island displays its detailed view and dimensions.
- **Atmospheric Cycles**: A real-time day/night clock adjusts environmental lighting overlay colors (Dawn, Day, Dusk, Night) based on local system time or manual override.
- **Data Portability**: Export and import your archipelago maps as JSON backups.

## 🛠️ Architecture & Tech Stack

- **Core**: Vanilla HTML5, Canvas API (for island renderings, grid lines, and particle currents).
- **Styling**: Vanilla CSS featuring modern glassmorphism panels, customized slider inputs, and dynamic theme classes.
- **Fonts**: Pairing [Cinzel](https://fonts.google.com/specimen/Cinzel) (for heading hierarchy) and [Outfit](https://fonts.google.com/specimen/Outfit) (for modern interface elements).
- **Physics & Generation**: Self-contained mathematical Perlin noise generators, trigonometric coordinate twisting, and spring-mass friction repulsion.

## 🚀 How to Run Locally

Since this project has no build step or dependencies:
1. Clone the repository:
   ```bash
   git clone https://github.com/Nubles/Oneiric-Cartographer.git
   ```
2. Open `index.html` in any modern web browser.

## 🌐 Deploying to GitHub Pages

Because this is a pure static website:
1. Push the code to the `main` branch.
2. Go to your repository settings on GitHub: **Settings** -> **Pages**.
3. Under **Build and deployment**, set the Source to **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder, then click **Save**.
5. Your app will be live at `https://<username>.github.io/Oneiric-Cartographer/` within a couple of minutes!
