(async function () {
  try {
    const STORAGE_KEY = "tw_last_selected_group";
    const groups = [];
    const coordToId = {};

    // Carrega grupos
    const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
    groupData.result.forEach(g => groups.push({ group_id: g.group_id, group_name: g.name }));

    // Mapeia coordenadas para ID
    const mapData = await $.get("map/village.txt");
    mapData.trim().split("\n").forEach(line => {
      const [id,, x, y] = line.split(",");
      coordToId[`${x}|${y}`] = id;
    });

    // Monta o painel
    const html = `
      <div class="vis" style="padding: 10px;">
        <h2>Painel de Scripts</h2>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label for="groupSelect"><b>Visualizador de grupo:</b></label>
          <select id="groupSelect" style="padding:4px; background:#f4e4bc; color:#000; border:1px solid #603000; font-weight:bold;"></select>
          <span id="villageCount" style="font-weight: bold;"></span>
        </div>
        <hr>
        <div id="groupVillages" style="max-height: 300px; overflow-y: auto;"></div>
      </div>
      <style>
        .progress-bar-container {
          background: #ddd;
          border-radius: 4px;
          width: 100%;
          height: 18px;
          position: relative;
        }
        .progress-bar-fill {
          background: linear-gradient(90deg, #6aaf6a, #3b8a3b);
          height: 100%;
          border-radius: 4px;
          text-align: center;
          color: #fff;
          font-weight: bold;
          white-space: nowrap;
          overflow: hidden;
        }
      </style>
    `;
    Dialog.show("tw_group_viewer", html);
    $("#popup_box_tw_group_viewer").css({ width: "750px", maxWidth: "95vw" });

    const select = document.getElementById("groupSelect");
    const savedGroupId = localStorage.getItem(STORAGE_KEY);
    const placeholder = new Option("Selecione um grupo", "", true, true);
    placeholder.disabled = true;
    select.appendChild(placeholder);

    groups.forEach(g => {
      const opt = new Option(g.group_name, g.group_id, false, g.group_id == savedGroupId);
      if (!g.group_name) opt.disabled = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", async function () {
      const groupId = this.value;
      if (!groupId) return;
      localStorage.setItem(STORAGE_KEY, groupId);
      $("#groupVillages").html("<i>Carregando aldeias...</i>");
      $("#villageCount").text("");

      // Busca aldeias do grupo
      const response = await $.post("/game.php?screen=groups&ajax=load_villages_from_group", { group_id: groupId });
      const doc = new DOMParser().parseFromString(response.html, "text/html");
      const rows = doc.querySelectorAll("#group_table tbody tr");
      if (!rows.length) {
        $("#groupVillages").html("<p><i>Nenhuma aldeia no grupo.</i></p>");
        $("#villageCount").text("0 aldeias");
        return;
      }

      const coordsList = [];
      rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length >= 2) coordsList.push(tds[1].textContent.trim());
      });

      // Busca pontuação na tela overview aldeias (modo combined)
      const combinedHtml = await $.get("/game.php?screen=overview_villages&mode=combined");
      const combinedDoc = new DOMParser().parseFromString(combinedHtml, "text/html");
      const combinedRows = combinedDoc.querySelectorAll("table.vis tbody tr");

      const pointsMap = {};
      combinedRows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length >= 6) {
          const coord = tds[1].textContent.trim();
          const pointsText = tds[5].textContent.trim().replace(/\./g, "");
          const points = parseInt(pointsText, 10);
          if (!isNaN(points)) pointsMap[coord] = points;
        }
      });

      // Limites fixos para barra
      const minPoints = 0;
      const maxPoints = 12000;

      let output = `<table class="vis" width="100%">
        <thead><tr><th>Nome</th><th style="width:90px;">Coord</th><th style="width:140px;">Pontos</th><th>Ações</th></tr></thead><tbody>`;
      let total = 0;

      rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length >= 2) {
          const name = tds[0].textContent.trim();
          const coords = tds[1].textContent.trim();
          const id = coordToId[coords];
          const points = pointsMap[coords] || 0;

          const link = id ? `<a href="/game.php?village=${id}&screen=overview" target="_blank">${name}</a>` : name;

          const pct = Math.min(100, (points / maxPoints) * 100);

          output += `<tr>
            <td>${link}</td>
            <td><span class="coord-val">${coords}</span></td>
            <td>
              <div class="progress-bar-container" title="${points.toLocaleString()} pontos">
                <div class="progress-bar-fill" style="width:${pct}%; min-width: 30px;">${points.toLocaleString()}</div>
              </div>
            </td>
            <td><button class="btn copy-coord" data-coord="${coords}">📋</button></td>
          </tr>`;
          total++;
        }
      });

      output += "</tbody></table>";
      $("#groupVillages").html(`<button id="copyAllCoords" class="btn" style="margin-bottom:5px;">📋 Copiar todas as coordenadas</button>${output}`);
      $("#villageCount").text(`${total} aldeias`);

      $(".copy-coord").on("click", function () {
        const coord = $(this).data("coord");
        navigator.clipboard.writeText(coord);
        UI.SuccessMessage(`Coordenada ${coord} copiada!`);
      });

      $("#copyAllCoords").on("click", function () {
        const coords = [...document.querySelectorAll(".coord-val")].map(el => el.textContent.trim()).join(" ");
        navigator.clipboard.writeText(coords);
        UI.SuccessMessage("Todas as coordenadas copiadas!");
      });
    });

    if (savedGroupId) {
      select.dispatchEvent(new Event("change"));
    }
  } catch (err) {
    console.error("Erro no script:", err);
  }
})();
