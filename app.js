const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  ledger: null,
  journeys: [],
  land: null,
  year: 1781,
  scene: "scale",
  activeVoyages: [],
  selectedVoyage: null,
  selectedFeature: null,
  selectedJourney: null,
  personScale: false,
  playing: false,
  playTimer: null,
  search: "",
  sceneLockUntil: 0,
  hubs: [],
  hoveredHub: null,
  globalMortality: 0,
  hubHitAreas: [],
  pointer: { x: -1, y: -1 },
  hitRoutes: [],
};

const sceneYears = {
  scale: 1781,
  capture: 1725,
  zong: 1781,
  bora: 1819,
  clotilda: 1860,
  after: 1830,
};

const format = new Intl.NumberFormat("en-US");

const nationalityColors = {
  1: "#d68b4c",
  3: "#c9784c",
  4: "#76a66f",
  5: "#9fb85d",
  6: "#8aaa61",
  7: "#d45c55",
  8: "#6d94b8",
  9: "#8db8ca",
  10: "#59a8a0",
  11: "#9b79af",
  12: "#b1986c",
  13: "#87a3aa",
  15: "#8d86b1",
  30: "#9a9182",
};

function nationalityColor(id) {
  return nationalityColors[id] || "#b9ad96";
}

function nationName(id) {
  return state.ledger.nations?.[String(id)] || "Nationality not recorded";
}

function compactVoyage(row) {
  return {
    id: row[0],
    src: row[1],
    dst: row[2],
    embarked: row[3],
    landed: row[4],
    year: row[5],
    month: row[6],
    ship: row[7] || "Unnamed vessel",
    nationId: row[8],
  };
}

function port(id) {
  const value = state.ledger.ports[String(id)];
  return value ? { lat: value[0], lon: value[1], name: value[2] } : null;
}

function buildHubStats() {
  const hubs = {};
  let globalEmbarked = 0;
  let globalLosses = 0;

  const ensureHub = (id) => {
    const key = String(id);
    if (!hubs[key]) {
      const place = port(id);
      hubs[key] = {
        id: Number(id),
        name: place?.name || "Unknown port",
        lat: place?.lat,
        lon: place?.lon,
        outVoyages: 0,
        inVoyages: 0,
        embarked: 0,
        landed: 0,
        exposed: 0,
        losses: 0,
        nations: {},
        connections: {},
      };
    }
    return hubs[key];
  };

  state.ledger.voyages.forEach((row) => {
    const voyage = compactVoyage(row);
    const losses = Math.max(0, voyage.embarked - voyage.landed);
    globalEmbarked += voyage.embarked;
    globalLosses += losses;

    const origin = ensureHub(voyage.src);
    origin.outVoyages += 1;
    origin.embarked += voyage.embarked;
    origin.exposed += voyage.embarked;
    origin.losses += losses;
    origin.nations[voyage.nationId] = (origin.nations[voyage.nationId] || 0) + voyage.embarked;
    origin.connections[voyage.dst] = (origin.connections[voyage.dst] || 0) + voyage.embarked;

    const destination = ensureHub(voyage.dst);
    destination.inVoyages += 1;
    destination.landed += voyage.landed;
    destination.exposed += voyage.embarked;
    destination.losses += losses;
    destination.nations[voyage.nationId] = (destination.nations[voyage.nationId] || 0) + voyage.embarked;
    destination.connections[voyage.src] = (destination.connections[voyage.src] || 0) + voyage.landed;
  });

  state.globalMortality = globalEmbarked ? globalLosses / globalEmbarked : 0;
  return Object.values(hubs)
    .filter((hub) => Number.isFinite(hub.lat) && Number.isFinite(hub.lon))
    .map((hub) => {
      const dominantNation = Object.entries(hub.nations).sort((a, b) => b[1] - a[1])[0];
      const topConnection = Object.entries(hub.connections).sort((a, b) => b[1] - a[1])[0];
      const role = hub.outVoyages > hub.inVoyages * 1.4
        ? "Embarkation hub"
        : hub.inVoyages > hub.outVoyages * 1.4
          ? "Landing hub"
          : "Mixed transit hub";
      return {
        ...hub,
        role,
        voyages: hub.outVoyages + hub.inVoyages,
        activity: hub.embarked + hub.landed,
        mortality: hub.exposed ? hub.losses / hub.exposed : 0,
        dominantNationId: dominantNation ? Number(dominantNation[0]) : 0,
        dominantNationPeople: dominantNation ? dominantNation[1] : 0,
        topConnectionId: topConnection ? Number(topConnection[0]) : null,
        topConnectionPeople: topConnection ? topConnection[1] : 0,
      };
    })
    .sort((a, b) => b.activity - a.activity)
    .slice(0, 120);
}

function project(lat, lon, width, height) {
  const minLon = -112;
  const maxLon = 58;
  const minLat = -43;
  const maxLat = 66;
  return {
    x: ((lon - minLon) / (maxLon - minLon)) * width,
    y: ((maxLat - lat) / (maxLat - minLat)) * height,
  };
}

function curveFor(origin, destination, width, height) {
  const a = project(origin.lat, origin.lon, width, height);
  const b = project(destination.lat, destination.lon, width, height);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    a,
    b,
    c: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - Math.min(150, distance * .22),
    },
  };
}

function pointOnCurve(curve, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * curve.a.x + 2 * mt * t * curve.c.x + t * t * curve.b.x,
    y: mt * mt * curve.a.y + 2 * mt * t * curve.c.y + t * t * curve.b.y,
  };
}

function fitCanvas(canvas) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { ctx: canvas.getContext("2d"), width, height, ratio };
}

function drawGeometry(ctx, coordinates, width, height) {
  coordinates.forEach((ring) => {
    ctx.beginPath();
    ring.forEach(([lon, lat], index) => {
      const point = project(lat, lon, width, height);
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function drawLand(ctx, width, height) {
  if (!state.land) return;
  ctx.save();
  ctx.fillStyle = "rgba(214, 204, 181, .09)";
  ctx.strokeStyle = "rgba(214, 204, 181, .12)";
  ctx.lineWidth = 1;
  state.land.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (geometry.type === "Polygon") drawGeometry(ctx, geometry.coordinates, width, height);
    if (geometry.type === "MultiPolygon") geometry.coordinates.forEach((polygon) => drawGeometry(ctx, polygon, width, height));
  });
  ctx.restore();
}

function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(222, 213, 193, .045)";
  ctx.lineWidth = 1;
  for (let lon = -100; lon <= 40; lon += 20) {
    const x = project(0, lon, width, height).x;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -40; lat <= 60; lat += 20) {
    const y = project(lat, 0, width, height).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHubs(ctx, width, height) {
  state.hubHitAreas = [];
  ctx.save();
  state.hubs.forEach((hub) => {
    const point = project(hub.lat, hub.lon, width, height);
    const radius = Math.max(2.2, Math.min(9, 1.4 + Math.log10(Math.max(10, hub.activity)) * .95));
    const hovered = state.hoveredHub?.id === hub.id;
    const fill = hub.role === "Embarkation hub" ? "#a88b51" : hub.role === "Landing hub" ? "#9e2f25" : "#567780";
    ctx.beginPath();
    ctx.arc(point.x, point.y, hovered ? radius + 3 : radius, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? "#eee8d9" : fill;
    ctx.fill();
    ctx.strokeStyle = hovered ? fill : "rgba(238,232,217,.32)";
    ctx.lineWidth = hovered ? 2.5 : .8;
    ctx.stroke();
    state.hubHitAreas.push({ hub, x: point.x, y: point.y, radius: Math.max(12, radius + 5) });
  });
  ctx.restore();
}

function drawRoute(ctx, voyage, time, width, height, selected = false) {
  const origin = port(voyage.src);
  const destination = port(voyage.dst);
  if (!origin || !destination) return;

  const curve = curveFor(origin, destination, width, height);
  const nationColor = nationalityColor(voyage.nationId);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(curve.a.x, curve.a.y);
  ctx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
  ctx.strokeStyle = selected ? nationColor : `${nationColor}35`;
  ctx.lineWidth = selected ? 2.2 : .7;
  ctx.stroke();

  const peoplePerDot = state.personScale && selected ? 1 : 25;
  const dots = Math.max(1, Math.ceil(voyage.embarked / peoplePerDot));
  const lostRatio = voyage.embarked ? Math.max(0, (voyage.embarked - voyage.landed) / voyage.embarked) : 0;
  for (let i = 0; i < dots; i += 1) {
    const t = (time * (selected ? .000055 : .000025) + i / dots + (voyage.id % 97) / 97) % 1;
    const point = pointOnCurve(curve, t);
    const lost = i / dots > 1 - lostRatio;
    ctx.beginPath();
    ctx.arc(point.x, point.y, selected && state.personScale ? 1.2 : selected ? 2.3 : 1.25, 0, Math.PI * 2);
    ctx.fillStyle = lost ? "rgba(211,75,62,.9)" : selected ? nationColor : `${nationColor}b5`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(curve.a.x, curve.a.y, selected ? 4 : 2, 0, Math.PI * 2);
  ctx.fillStyle = selected ? "#eee8d9" : "rgba(222,213,193,.45)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(curve.b.x, curve.b.y, selected ? 4 : 2, 0, Math.PI * 2);
  ctx.fillStyle = selected ? "#d34b3e" : "rgba(211,75,62,.5)";
  ctx.fill();
  ctx.restore();

  if (selected || state.activeVoyages.length < 140) {
    state.hitRoutes.push({ voyage, curve });
  }
}

function featureAsVoyage(feature) {
  const origin = feature.origin || feature.origin_region;
  const destination = feature.destination || feature.destination_region;
  if (!origin || !destination) return null;
  return {
    id: feature.id,
    src: `feature-origin-${feature.id}`,
    dst: `feature-destination-${feature.id}`,
    embarked: feature.embarked || 0,
    landed: feature.landed || 0,
    year: (feature.departure || {}).year,
    ship: feature.ship || "Named person",
    origin,
    destination,
  };
}

function drawFeatureRoute(ctx, feature, time, width, height) {
  const voyage = featureAsVoyage(feature);
  if (!voyage) return;
  const curve = curveFor(voyage.origin, voyage.destination, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(curve.a.x, curve.a.y);
  ctx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
  ctx.strokeStyle = "rgba(211,75,62,.82)";
  ctx.lineWidth = 2.3;
  ctx.stroke();
  const exactDots = state.personScale ? voyage.embarked : Math.min(28, Math.ceil(voyage.embarked / 20));
  const loss = Math.max(0, voyage.embarked - voyage.landed);
  for (let i = 0; i < exactDots; i += 1) {
    const t = (time * .00005 + i / exactDots) % 1;
    const point = pointOnCurve(curve, t);
    ctx.beginPath();
    ctx.arc(point.x, point.y, state.personScale ? 1.25 : 2, 0, Math.PI * 2);
    ctx.fillStyle = state.personScale && i >= exactDots - loss ? "#d34b3e" : "#eee8d9";
    ctx.fill();
  }
  ctx.restore();
}

function certaintyTone(certainty = "") {
  const value = certainty.toLowerCase();
  if (value.includes("documented")) return { stroke: "rgba(238,232,217,.92)", fill: "#eee8d9", dash: [] };
  if (value.includes("reported") || value.includes("inferred")) return { stroke: "rgba(168,139,81,.86)", fill: "#a88b51", dash: [7, 6] };
  if (value.includes("probable") || value.includes("estimated") || value.includes("distribution")) return { stroke: "rgba(86,119,128,.86)", fill: "#7ea0a8", dash: [3, 6] };
  return { stroke: "rgba(117,109,95,.65)", fill: "#756d5f", dash: [2, 8] };
}

function drawJourney(ctx, journey, time, width, height) {
  if (!journey || !journey.nodes || journey.nodes.length < 2) return;
  ctx.save();
  journey.nodes.forEach((node, index) => {
    if (!index) return;
    const previous = journey.nodes[index - 1];
    const tone = certaintyTone(node.certainty);
    const curve = curveFor(previous, node, width, height);
    ctx.beginPath();
    ctx.setLineDash(tone.dash);
    ctx.moveTo(curve.a.x, curve.a.y);
    ctx.quadraticCurveTo(curve.c.x, curve.c.y, curve.b.x, curve.b.y);
    ctx.strokeStyle = tone.stroke;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 5; i += 1) {
      const point = pointOnCurve(curve, (time * .000045 + i / 5 + index * .09) % 1);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = tone.fill;
      ctx.fill();
    }
  });

  ctx.font = `${10 * (devicePixelRatio || 1)}px SFMono-Regular, Consolas, monospace`;
  ctx.textBaseline = "middle";
  journey.nodes.forEach((node, index) => {
    const tone = certaintyTone(node.certainty);
    const p = project(node.lat, node.lon, width, height);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = tone.fill;
    ctx.fill();
    ctx.strokeStyle = "rgba(18,17,14,.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (index === 0 || index === journey.nodes.length - 1 || width > 950) {
      ctx.fillStyle = "rgba(238,232,217,.86)";
      ctx.fillText(node.label.toUpperCase(), p.x + 9, p.y - 1);
    }
  });
  ctx.restore();
}

function drawMap(time = 0) {
  const canvas = $("#map-canvas");
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const ocean = ctx.createRadialGradient(width * .45, height * .4, 0, width * .45, height * .4, width * .8);
  ocean.addColorStop(0, "#1b211f");
  ocean.addColorStop(1, "#0d0d0b");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  drawLand(ctx, width, height);
  state.hitRoutes = [];

  const selectedId = state.selectedVoyage ? state.selectedVoyage.id : null;
  state.activeVoyages.forEach((voyage) => drawRoute(ctx, voyage, time, width, height, voyage.id === selectedId));

  if (state.selectedFeature === "zong") drawFeatureRoute(ctx, state.ledger.featured.zong, time, width, height);
  if (state.selectedFeature === "clotilda") drawFeatureRoute(ctx, state.ledger.featured.clotilda, time, width, height);
  if (state.selectedFeature === "bora") drawFeatureRoute(ctx, state.ledger.featured.bora.voyage, time, width, height);
  drawHubs(ctx, width, height);
  if (state.selectedJourney) drawJourney(ctx, state.selectedJourney, time, width, height);

  requestAnimationFrame(drawMap);
}

function renderNationalityLegend() {
  const totals = {};
  let totalPeople = 0;
  state.activeVoyages.forEach((voyage) => {
    totals[voyage.nationId] = (totals[voyage.nationId] || 0) + voyage.embarked;
    totalPeople += voyage.embarked;
  });
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("#nationality-legend").innerHTML = top.map(([id, people]) => `
    <span><i style="background:${nationalityColor(Number(id))}"></i>${nationName(id)} <b>${totalPeople ? Math.round((people / totalPeople) * 100) : 0}%</b></span>
  `).join("");
}

function setYear(year, keepFeature = false) {
  state.year = Math.max(1501, Math.min(1866, Number(year)));
  if (!keepFeature) state.selectedFeature = null;
  state.activeVoyages = state.ledger.voyages
    .filter((row) => row[5] === state.year)
    .map(compactVoyage);
  const embarked = state.activeVoyages.reduce((sum, voyage) => sum + voyage.embarked, 0);
  const landed = state.activeVoyages.reduce((sum, voyage) => sum + voyage.landed, 0);
  $("#map-year").textContent = state.year;
  $("#explore-year").textContent = state.year;
  $("#year-slider").value = state.year;
  $("#map-embarked").textContent = format.format(embarked);
  $("#map-landed").textContent = format.format(landed);
  renderNationalityLegend();
  renderVoyageList();
}

function sourceCountLabel(feature) {
  return feature.sources && feature.sources.length ? `${feature.sources.length} SOURCE${feature.sources.length === 1 ? "" : "S"}` : "SOURCE-LINKED";
}

function showShipCard(key) {
  const feature = state.ledger.featured[key];
  const card = $("#ship-card");
  $("#person-card").hidden = true;
  $("#journey-card").hidden = true;
  card.innerHTML = `
    <div class="card-topline"><span>VOYAGE / ${feature.id}</span><span>${sourceCountLabel(feature)}</span></div>
    <h3>${feature.ship}</h3>
    <div class="card-subtitle">${feature.origin?.name || feature.origin_region?.name || "Origin unknown"} → ${feature.destination?.name || feature.destination_region?.name || "Destination unknown"} · ${feature.departure?.year || "Date unknown"}</div>
    <div class="card-metrics">
      <div><strong>${format.format(feature.embarked || 0)}</strong><span>embarked · imputed</span></div>
      <div><strong>${format.format(feature.landed || 0)}</strong><span>landed · imputed</span></div>
      <div><strong>${format.format(feature.deaths || 0)}</strong><span>mortality · imputed</span></div>
    </div>
    <p class="card-evidence"><b>Documented:</b> ship, ports, dates, venture participants, and source trail.<br><b>Not established here:</b> every captive's identity, cause of enslavement, or post-landing life.</p>
  `;
  card.hidden = false;
}

function showBoraCard() {
  const bora = state.ledger.featured.bora;
  const card = $("#person-card");
  $("#ship-card").hidden = true;
  $("#journey-card").hidden = true;
  card.innerHTML = `
    <div class="card-topline"><span>NAMED PERSON / ${bora.id}</span><span>${bora.sources.length} SOURCES</span></div>
    <h3>${bora.documented_name}</h3>
    <div class="card-subtitle">${bora.age} years old · ${bora.gender} · ${bora.voyage.ship} · ${bora.voyage.departure?.year}</div>
    <div class="card-metrics">
      <div><strong>${bora.voyage.origin?.name || "Unknown"}</strong><span>embarkation port</span></div>
      <div><strong>${bora.voyage.destination?.name || "Unknown"}</strong><span>disembarkation</span></div>
      <div><strong>${bora.fate}</strong><span>recorded fate</span></div>
    </div>
    <p class="card-evidence"><b>Inferred:</b> ${bora.language_group || "No language group recorded"}.<br><b>Unknown:</b> ancestral home and cause of enslavement. The interface refuses to invent them.</p>
  `;
  card.hidden = false;
}

function showJourneyCard(journey) {
  if (!journey) return;
  state.selectedJourney = journey;
  const card = $("#journey-card");
  $("#ship-card").hidden = true;
  $("#person-card").hidden = true;
  card.innerHTML = `
    <div class="card-topline"><span>${journey.kind.toUpperCase()}</span><span>${journey.confidence.toUpperCase()}</span></div>
    <h3>${journey.title}</h3>
    <div class="card-subtitle">${journey.subtitle}</div>
    <p class="card-evidence"><b>Why enslaved:</b> ${journey.why_enslaved.label} · ${journey.why_enslaved.certainty}</p>
    <ol class="journey-steps">
      ${journey.nodes.map((node) => `<li><b>${node.label}</b><span>${node.type} · ${node.certainty}</span></li>`).join("")}
    </ol>
    <p class="card-evidence">${journey.summary}</p>
    <div class="card-links">${journey.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noopener">${source.name}</a>`).join("")}</div>
  `;
  card.hidden = false;
  $("#map-mode").textContent = journey.kind === "regional-probability" ? "PROBABLE CORRIDOR" : "PERSON-SPECIFIC JOURNEY";
}

function setScene(scene) {
  state.scene = scene;
  state.selectedVoyage = null;
  state.selectedFeature = ["zong", "bora", "clotilda"].includes(scene) ? scene : null;
  state.selectedJourney = null;
  state.personScale = scene === "bora";
  $("#person-scale-button").classList.toggle("active", state.personScale);
  $("#map-mode").textContent = scene === "bora" ? "NAMED-PERSON EVIDENCE CHAIN" : scene === "after" ? "THE ARCHIVE AFTER LANDING" : "DOCUMENTED VOYAGES";
  $("#ship-card").hidden = true;
  $("#person-card").hidden = true;
  $("#journey-card").hidden = true;
  setYear(sceneYears[scene] || state.year, true);
  if (scene === "zong") showShipCard("zong");
  if (scene === "clotilda") {
    showShipCard("clotilda");
    showJourneyCard(state.journeys.find((journey) => journey.id === "kossola-clotilda"));
  }
  if (scene === "bora") {
    showBoraCard();
    state.selectedJourney = state.journeys.find((journey) => journey.id === "bora-liberated-african");
  }
  if (scene === "after") showJourneyCard(state.journeys.find((journey) => journey.id === "slave-coast-corridor"));
}

function renderVoyageList() {
  const query = state.search.trim().toLowerCase();
  let voyages = query
    ? state.ledger.voyages.map(compactVoyage).filter((voyage) => voyage.ship.toLowerCase().includes(query))
    : state.activeVoyages;
  voyages = voyages
    .sort((a, b) => b.embarked - a.embarked)
    .slice(0, 35);

  $("#voyage-list").innerHTML = voyages.length
    ? voyages.map((voyage) => {
      const origin = port(voyage.src);
      const destination = port(voyage.dst);
      return `
        <button class="voyage-row ${state.selectedVoyage?.id === voyage.id ? "active" : ""}" data-voyage="${voyage.id}">
          <strong>${voyage.year} / ${voyage.ship}</strong>
          <span>${origin?.name || "Unknown port"} → ${destination?.name || "Unknown port"} · ${nationName(voyage.nationId)}</span>
          <b>${format.format(voyage.embarked)}</b>
          <span>#${voyage.id}</span>
        </button>
      `;
    }).join("")
    : `<div class="empty-row">No matching voyage records in this snapshot.</div>`;

  $$("[data-voyage]").forEach((button) => {
    button.addEventListener("click", () => {
      const voyage = state.ledger.voyages.map(compactVoyage).find((item) => item.id === Number(button.dataset.voyage));
      state.selectedVoyage = voyage;
      state.selectedFeature = null;
      state.selectedJourney = null;
      setYear(voyage.year);
      renderVoyageList();
      const origin = port(voyage.src);
      const destination = port(voyage.dst);
      const card = $("#ship-card");
      $("#person-card").hidden = true;
      $("#journey-card").hidden = true;
      card.innerHTML = `
        <div class="card-topline"><span>VOYAGE / ${voyage.id}</span><span>COMPACT ARCHIVE RECORD</span></div>
        <h3>${voyage.ship}</h3>
        <div class="card-subtitle">${origin?.name || "Unknown"} → ${destination?.name || "Unknown"} · ${voyage.year} · ${nationName(voyage.nationId)}</div>
        <div class="card-metrics">
          <div><strong>${format.format(voyage.embarked)}</strong><span>embarked</span></div>
          <div><strong>${format.format(voyage.landed)}</strong><span>landed</span></div>
          <div><strong>${format.format(Math.max(0, voyage.embarked - voyage.landed))}</strong><span>difference</span></div>
        </div>
        <p class="card-evidence">Open SlaveVoyages record: <b>voyage ${voyage.id}</b>. The compact map snapshot preserves route and count fields; the full API record carries field-level sources and detail.</p>
      `;
      card.hidden = false;
      $("#map-canvas").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function populateSources() {
  $("#sources-list").innerHTML = state.ledger.sources.map((source) => `
    <article class="source-entry">
      <a href="${source.url}" target="_blank" rel="noopener">${source.name} ↗</a>
      <p>${source.role}</p>
    </article>
  `).join("");
}

function renderJourneyModels() {
  $("#journey-model-list").innerHTML = state.journeys.map((journey) => `
    <button class="journey-model ${state.selectedJourney?.id === journey.id ? "active" : ""}" data-journey="${journey.id}">
      <span>${journey.kind}</span>
      <strong>${journey.title}</strong>
      <small>${journey.confidence}</small>
    </button>
  `).join("");

  $$("[data-journey]").forEach((button) => {
    button.addEventListener("click", () => {
      const journey = state.journeys.find((item) => item.id === button.dataset.journey);
      state.sceneLockUntil = Date.now() + 1800;
      showJourneyCard(journey);
      setYear(journey.year, true);
      renderJourneyModels();
      $("#map-canvas").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

function buildOpeningDots() {
  const count = Math.ceil(state.ledger.stats.estimated_embarked / 4000);
  const lost = Math.ceil((state.ledger.stats.estimated_embarked - state.ledger.stats.estimated_landed) / 4000);
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement("i");
    if (index >= count - lost) dot.className = "lost";
    fragment.appendChild(dot);
  }
  $("#opening-dots").appendChild(fragment);
}

function showHubTooltip(hub, event) {
  const tooltip = $("#hub-tooltip");
  const topConnection = hub.topConnectionId ? port(hub.topConnectionId) : null;
  const mortalityDelta = hub.mortality - state.globalMortality;
  const treatmentSignal = Math.abs(mortalityDelta) < .005
    ? "Similar to the archive-wide recorded shipboard mortality"
    : `${Math.abs(mortalityDelta * 100).toFixed(1)} points ${mortalityDelta > 0 ? "above" : "below"} archive-wide recorded shipboard mortality`;
  tooltip.innerHTML = `
    <div class="hub-topline"><span>${hub.role}</span><b>${format.format(hub.voyages)} route records</b></div>
    <h3>${hub.name}</h3>
    <div class="hub-metrics">
      <div><strong>${format.format(hub.embarked)}</strong><span>recorded embarked</span></div>
      <div><strong>${format.format(hub.landed)}</strong><span>recorded landed</span></div>
      <div><strong>${(hub.mortality * 100).toFixed(1)}%</strong><span>weighted shipboard loss</span></div>
    </div>
    <dl>
      <div><dt>Dominant carrier</dt><dd><i style="background:${nationalityColor(hub.dominantNationId)}"></i>${nationName(hub.dominantNationId)}</dd></div>
      <div><dt>Largest connection</dt><dd>${topConnection?.name || "Not available"} · ${format.format(hub.topConnectionPeople)} people</dd></div>
      <div><dt>Embarked-landed difference</dt><dd>${format.format(hub.losses)} across connected voyages. This may include deaths and record gaps; it is not always a confirmed death count.</dd></div>
      <div><dt>Treatment signal</dt><dd>${treatmentSignal}. Mortality is not a complete treatment score.</dd></div>
      <div><dt>Prices and sale terms</dt><dd>Not present in the compact route snapshot; requires linked market or sale records.</dd></div>
    </dl>
  `;
  const stage = $(".map-stage");
  const maxLeft = Math.max(12, stage.clientWidth - 340);
  const maxTop = Math.max(82, stage.clientHeight - 330);
  tooltip.style.left = `${Math.min(maxLeft, event.offsetX + 16)}px`;
  tooltip.style.top = `${Math.min(maxTop, Math.max(80, event.offsetY - 25))}px`;
  tooltip.hidden = false;
}

function initInteractions() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (Date.now() < state.sceneLockUntil) return;
        $$(".story-step").forEach((step) => step.classList.remove("active"));
        entry.target.classList.add("active");
        setScene(entry.target.dataset.scene);
      }
    });
  }, { rootMargin: "-35% 0px -45% 0px", threshold: 0 });
  $$(".story-step").forEach((step) => observer.observe(step));

  $$("[data-feature]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFeature = button.dataset.feature;
      if (state.selectedFeature === "bora") showBoraCard();
      else showShipCard(state.selectedFeature);
    });
  });

  $("#year-slider").addEventListener("input", (event) => {
    state.selectedVoyage = null;
    state.personScale = false;
    setYear(event.target.value);
  });
  $("#ship-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderVoyageList();
  });
  $("#person-scale-button").addEventListener("click", () => {
    state.personScale = !state.personScale;
    $("#person-scale-button").classList.toggle("active", state.personScale);
  });
  $("#play-button").addEventListener("click", () => {
    state.playing = !state.playing;
    $("#play-button").classList.toggle("active", state.playing);
    $("#play-button span").textContent = state.playing ? "Pause timeline" : "Play timeline";
    clearInterval(state.playTimer);
    if (state.playing) {
      state.playTimer = setInterval(() => setYear(state.year >= 1866 ? 1501 : state.year + 1), 170);
    }
  });

  const mapCanvas = $("#map-canvas");
  mapCanvas.addEventListener("pointermove", (event) => {
    const scaleX = mapCanvas.width / mapCanvas.clientWidth;
    const scaleY = mapCanvas.height / mapCanvas.clientHeight;
    const x = event.offsetX * scaleX;
    const y = event.offsetY * scaleY;
    let closest = null;
    let closestDistance = Infinity;
    state.hubHitAreas.forEach((candidate) => {
      const distance = Math.hypot(candidate.x - x, candidate.y - y);
      if (distance <= candidate.radius && distance < closestDistance) {
        closest = candidate.hub;
        closestDistance = distance;
      }
    });
    state.hoveredHub = closest;
    mapCanvas.style.cursor = closest ? "crosshair" : "default";
    if (closest) showHubTooltip(closest, event);
    else $("#hub-tooltip").hidden = true;
  });
  mapCanvas.addEventListener("pointerleave", () => {
    state.hoveredHub = null;
    $("#hub-tooltip").hidden = true;
  });

  const drawer = $("#sources-drawer");
  const backdrop = $("#drawer-backdrop");
  const closeDrawer = () => {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
  };
  $("#sources-button").addEventListener("click", () => {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
  });
  $("#sources-close").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
}

async function init() {
  try {
    const [ledgerResponse, journeyResponse, landResponse] = await Promise.all([
      fetch("data/ledger.json"),
      fetch("data/probable-journeys.json"),
      fetch("assets/countries.geojson"),
    ]);
    state.ledger = await ledgerResponse.json();
    state.journeys = (await journeyResponse.json()).models;
    state.land = await landResponse.json();
    state.hubs = buildHubStats();
    $("#stat-voyages").textContent = format.format(state.ledger.stats.drawable_voyages);
    buildOpeningDots();
    populateSources();
    initInteractions();
    renderJourneyModels();
    setYear(1781);
    requestAnimationFrame(drawMap);
  } catch (error) {
    document.body.innerHTML = `<main class="opening"><div class="opening-copy"><p class="kicker">DATA LOAD FAILED</p><h1>The ledger could not open.</h1><p class="deck">Run this project through <code>python3 server.py</code> so the local data snapshot can load.</p></div></main>`;
    console.error(error);
  }
}

init();
