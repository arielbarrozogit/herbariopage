let DATA = [];
let map, layer;

// Para sincronizar tarjeta ↔ punto
let markerByKey = new Map();   // "lat,lon" -> marker
let keyBySpecId = new Map();   // specimenId -> "lat,lon"

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ portal.js cargado", location.pathname);

  // MAPA
  map = L.map("map").setView([-38, -65], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  layer = L.layerGroup().addTo(map);

  // UI (protegido para que el script no se muera si falta algo) [1](https://stackoverflow.com/questions/26107125/cannot-read-property-addeventlistener-of-null)[2](https://bing.com/search?q=JavaScript+addEventListener+null+stops+script+TypeError+cannot+read+properties+of+null+addEventListener)
  document.getElementById("busqueda")?.addEventListener("input", debounce(aplicarFiltros, 150));
  document.getElementById("filtro-plaga")?.addEventListener("change", aplicarFiltros);
  document.getElementById("filtro-clave-roja")?.addEventListener("change", aplicarFiltros);

  // Cargar JSON
  fetch("datos/specimens.json")
    .then(r => r.json())
    .then(json => {
      DATA = json.specimens || [];

      // Metadatos
      document.getElementById("total-registros").textContent =
        json.metadata?.total_registros ?? DATA.length;
      document.getElementById("fecha-datos").textContent =
        json.metadata?.actualizado_hasta ?? "–";

      // Si no existe clave_roja en el JSON, deshabilito el checkbox (para no confundir)
      const chkRoja = document.getElementById("filtro-clave-roja");
      const notaRoja = document.getElementById("nota-clave-roja");
      const hayClaveRoja = DATA.some(s => s.clave_roja === true);
      if (chkRoja && !hayClaveRoja) {
        chkRoja.checked = false;
        chkRoja.disabled = true;
        if (notaRoja) notaRoja.textContent = "(no disponible aún)";
      }

      aplicarFiltros();
      setTimeout(() => map.invalidateSize(), 300); // útil con grids/layouts
    })
    .catch(err => console.error("❌ Error cargando JSON:", err));
});

function aplicarFiltros() {
  const texto = (document.getElementById("busqueda")?.value || "").toLowerCase().trim();
  const tokens = texto.split(/\s+/).filter(Boolean);

  const soloPlaga = !!document.getElementById("filtro-plaga")?.checked;
  const claveRoja = !!document.getElementById("filtro-clave-roja")?.checked;

  const filtrados = DATA.filter(s => {
    // filtros
    if (soloPlaga && !s.plaga) return false;
    if (claveRoja && !s.clave_roja) return false;

    // sin texto => pasa
    if (!tokens.length) return true;

    const hay = buildHaystack(s);
    // AND: todas las palabras deben estar
    return tokens.every(t => hay.includes(t));
  });

  renderLista(filtrados);
  renderMapaAgrupado(filtrados);
}

function buildHaystack(s) {
  const dig = getDigitalizacion(s);
  const nroCol = getNroColector(s);
  const nroHer = getNroHerbario(s);

  return [
    s.taxon, s.family, s.genus, s.specie,
    s.colector, s.collector,
    s.localidad, s.provincia, s.pais,
    dig, nroCol, nroHer,
    s.anio
  ].filter(Boolean).join(" ").toLowerCase();
}

// --------------------
// LISTA (tarjetas)
// --------------------
function renderLista(lista) {
  const cont = document.getElementById("lista-especimenes");
  cont.innerHTML = "";

  if (!lista.length) {
    cont.innerHTML = "<p>No hay resultados.</p>";
    return;
  }

  const MAX = 300;
  const vista = lista.slice(0, MAX);

  vista.forEach(s => {
    const dig = getDigitalizacion(s);
    const nroCol = getNroColector(s);
    const nroHer = getNroHerbario(s);
    const loc = [s.localidad, s.provincia].filter(Boolean).join(" – ");
    const anio = s.anio ?? "s/d";

    const card = document.createElement("div");
    card.className = "specimen-card";
    card.id = `card-${dig}`;

    card.innerHTML = `
      <div><strong>${s.taxon ?? "(sin taxón)"}</strong> ${s.family ? `(${s.family})` : ""}</div>
      <div style="margin-top:4px">${loc}</div>
      <div style="margin-top:4px">Año: ${anio}</div>
      <div style="margin-top:6px;color:#555;font-size:13px;font-family:monospace">
        ${dig ? `Nro.Digitalización: ${dig}` : ""}
        ${nroCol ? ` · Colector#: ${nroCol}` : ""}
        ${nroHer ? ` · Herbario: ${nroHer}` : ""}
      </div>
    `;

    // Click tarjeta -> centrar en el punto + abrir popup
    card.addEventListener("click", () => {
      const key = keyBySpecId.get(dig);
      const mk = key ? markerByKey.get(key) : null;
      if (mk) {
        map.setView(mk.getLatLng(), 10, { animate: true });
        mk.openPopup();
      }
    });

    cont.appendChild(card);
  });

  if (lista.length > vista.length) {
    const more = document.createElement("div");
    more.style.color = "#777";
    more.style.fontSize = "13px";
    more.style.padding = "8px";
    more.textContent = `Mostrando ${vista.length} de ${lista.length}. Refina la búsqueda para ver menos.`;
    cont.appendChild(more);
  }
}

// --------------------
// MAPA con agrupación
// --------------------
function renderMapaAgrupado(lista) {
  layer.clearLayers();
  markerByKey.clear();
  keyBySpecId.clear();

  const grupos = new Map(); // key -> array specimens
  const bounds = [];

  for (const s of lista) {
    const lat = Number(s.lat);
    const lon = Number(s.lon);
    if (!lat || !lon || lat === 0 || lon === 0) continue;

    // agrupar por coordenada
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(s);

    const dig = getDigitalizacion(s);
    if (dig) keyBySpecId.set(dig, key);
  }

  for (const [key, arr] of grupos.entries()) {
    const [latStr, lonStr] = key.split(",");
    const lat = Number(latStr), lon = Number(lonStr);

    const loc = [arr[0].localidad, arr[0].provincia, arr[0].pais].filter(Boolean).join(" – ");

    // Popup: lista todos los especímenes en ese punto con IDs útiles
    const items = arr.slice(0, 30).map(x => {
      const tax = x.taxon ?? "(sin taxón)";
      const dig = getDigitalizacion(x);
      const nroCol = getNroColector(x);
      const nroHer = getNroHerbario(x);
      const anio = x.anio ?? "s/d";
      return `• <strong>${tax}</strong> <small>(${anio})</small><br>
              <small style="font-family:monospace">
                ${dig ? `Nro.Digitalización: ${dig}` : "Nro.Digitalización: —"}
                ${nroCol ? ` · Colector#: ${nroCol}` : ""}
                ${nroHer ? ` · Herbario: ${nroHer}` : ""}
              </small>`;
    }).join("<br>");

    const extra = arr.length > 30 ? `<br><em>+${arr.length - 30} más…</em>` : "";

    const popup = `
      <div style="min-width:280px">
        <strong>${arr.length} espécimen(es) en este punto</strong><br>
        ${loc}<br><br>
        ${items}${extra}
        <br><br><small>Lat/Lon: ${lat.toFixed(5)}, ${lon.toFixed(5)}</small>
      </div>
    `;

    const mk = L.circleMarker([lat, lon], {
      radius: 6,
      color: "green",
      fillOpacity: 0.8
    }).bindPopup(popup).addTo(layer);

    // Tooltip al pasar el mouse (como “portal viejo”)
    mk.bindTooltip(`${arr[0].taxon ?? loc}`, { sticky: true });

    markerByKey.set(key, mk);
    bounds.push([lat, lon]);

    // Click punto -> scroll a tarjeta del primer espécimen del grupo
    mk.on("click", () => {
      const dig = getDigitalizacion(arr[0]);
      const card = dig ? document.getElementById(`card-${dig}`) : null;
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("resaltado");
        setTimeout(() => card.classList.remove("resaltado"), 1200);
      }
    });
  }

  if (bounds.length) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
  }
}

// Helpers (adaptan nombres posibles)
function getDigitalizacion(s) {
  return (s.nro_digitalizacion ?? s.id ?? "").toString();
}
function getNroColector(s) {
  return (s.nro_colector ?? s.collector_number ?? s.colector_numero ?? "").toString();
}
function getNroHerbario(s) {
  return (s.nro_herbario ?? "").toString();
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}
