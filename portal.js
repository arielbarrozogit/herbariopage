/* =========================
   MAPA BASE – ARGENTINA
   ========================= */

const mapa = L.map('map', {
  center: [-38, -63],
  zoom: 4,
  minZoom: 3
});

/* =========================
   CAPA BASE IGN
   ========================= */
const baseOSM = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "© OpenStreetMap · Referencias cartográficas: IGN Argentina"
  }
);

baseOSM.addTo(mapa);


//baseIGN.addTo(mapa);

/* =========================
   CAPA SUELOS INTA / GEOINTA
   ========================= */

const suelosINTA = L.tileLayer.wms(
  "https://geoservicios.inta.gob.ar/geoserver/suelos/wms",
  {
    layers: "suelos_argentina",
    format: "image/png",
    transparent: true,
    opacity: 0.6,
    attribution: "© INTA – GeoINTA"
  }
);

/* =========================
   CONTROL DE CAPAS
   ========================= */

L.control.layers(
  {
    "Base IGN Argentina": baseOSM
  },
  {
    "Suelos (INTA / GeoINTA)": suelosINTA
  },
  { collapsed: false }
).addTo(mapa);

mapa.attributionControl.addAttribution(
  "Datos cartográficos: © IGN Argentina · © INTA – GeoINTA"
);

/* =========================
   CAPA DE ESPECÍMENES BAB
   ========================= */

const capaBAB = L.layerGroup().addTo(mapa);

/* =========================
   CARGA DE DATOS
   ========================= */

fetch('datos/specimens.json')
  .then(r => r.json())
  .then(data => {

    const meta = data.metadata;
    const specimens = data.specimens;

    document.getElementById('total-registros').textContent = meta.total;
    document.getElementById('fecha-datos').textContent = meta.actualizado_hasta;

    renderLista(specimens);
    renderMapa(specimens);

    document.getElementById('busqueda').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();

      const filtrados = specimens.filter(s =>
        s.taxon.toLowerCase().includes(q) ||
        s.colector.toLowerCase().includes(q) ||
        s.localidad.toLowerCase().includes(q)
      );

      renderLista(filtrados);
      renderMapa(filtrados);
    });
  });

/* =========================
   RENDER LISTA
   ========================= */

function renderLista(specimens) {
  const cont = document.getElementById('lista-especimenes');
  cont.innerHTML = '';

  specimens.forEach(s => {
    const card = document.createElement('div');
    card.className = 'specimen-card';

    card.innerHTML = `
      <h3>${s.taxon}</h3>
      <p><strong>${s.colector}</strong> · ${s.anio}</p>
      <p>${s.localidad}, ${s.provincia}</p>
      <small>${s.id}</small>
    `;

    cont.appendChild(card);
  });
}

/* =========================
   RENDER MAPA
   ========================= */

function renderMapa(specimens) {
  capaBAB.clearLayers();

  specimens.forEach(s => {
    if (s.lat && s.lon) {
      L.marker([s.lat, s.lon])
        .bindPopup(`
          <b>${s.taxon}</b><br>
          ${s.localidad}, ${s.provincia}<br>
          ${s.colector} (${s.anio})
        `)
        .addTo(capaBAB);
    }
  });
}
