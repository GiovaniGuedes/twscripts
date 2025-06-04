javascript:
(async function () {
    const groups = [];
    const groupVillageCounts = {};
    const groupVillages = {};
    const coordToId = {};
    const STORAGE_KEY = "tw_last_selected_group";

    const parseCoords = (coord) => {
        const [x, y] = coord.split("|");
        return { x, y };
    };

    // Load village.txt to map coords → id
    const mapData = await $.get("map/village.txt");
    const lines = mapData.trim().split("\n");
    lines.forEach(line => {
        const [id, name, x, y] = line.split(",");
        const coord = `${x}|${y}`;
        coordToId[coord] = id;
    });

    // Load group list
    const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
    for (const group of groupData.result) {
        if (group.group_id != 0) {
            groups.push({ group_id: group.group_id, group_name: group.name });
        }
    }

    // Load village lists per group
    await Promise.all(groups.map(async group => {
        const res = await $.post("/game.php?screen=groups&ajax=load_villages_from_group", {
            group_id: group.group_id
        });
        const doc = new DOMParser().parseFromString(res.html, "text/html");
        const rows = doc.querySelectorAll("#group_table tbody tr");
        const villages = [];

        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            if (tds.length >= 2) {
                const name = tds[0].textContent.trim();
                const coords = tds[1].textContent.trim();
                villages.push({ name, coords });
            }
        });

        groupVillageCounts[group.group_id] = villages.length;
        groupVillages[group.group_id] = villages;
    }));

    // Create "Todas as aldeias" (merged)
    const ALL_GROUP_ID = "ALL";
    const allVillages = Object.values(groupVillages).flat();
    const uniqueVillages = new Map();
    allVillages.forEach(v => uniqueVillages.set(v.coords, v));
    groupVillageCounts[ALL_GROUP_ID] = uniqueVillages.size;
    groupVillages[ALL_GROUP_ID] = [...uniqueVillages.values()];

    // UI
    const html = `
        <div class="vis" style="padding: 10px;">
            <h2>Grupos de Aldeias</h2>
            <div style="display: flex; align-items: center; gap: 10px;">
                <label for="groupSelect"><b>Selecione um grupo:</b></label>
                <select id="groupSelect" style="
                    padding: 4px;
                    background: #f4e4bc;
                    color: #000;
                    border: 1px solid #603000;
                    font-weight: bold;
                "></select>
                <span id="villageCount" style="font-weight: bold;"></span>
            </div>
            <hr>
            <div id="groupVillages" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
    `;
    Dialog.show("tw_group_viewer", html);

    const select = document.getElementById("groupSelect");
    const savedGroupId = localStorage.getItem(STORAGE_KEY);

    // Placeholder
    const placeholder = document.createElement("option");
    placeholder.disabled = true;
    placeholder.selected = !savedGroupId;
    placeholder.hidden = !!savedGroupId;
    placeholder.textContent = "Selecione um grupo";
    select.appendChild(placeholder);

    // Adiciona opção "Todas as Aldeias"
    const allOption = document.createElement("option");
    allOption.value = ALL_GROUP_ID;
    allOption.textContent = `Todas as Aldeias (${groupVillageCounts[ALL_GROUP_ID]})`;
    if (savedGroupId === ALL_GROUP_ID) allOption.selected = true;
    select.appendChild(allOption);

    // Grupos
    groups.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.group_id;
        const count = groupVillageCounts[g.group_id] || 0;
        opt.textContent = `${g.group_name} (${count})`;
        if (savedGroupId == g.group_id) {
            opt.selected = true;
            placeholder.hidden = true;
        }
        select.appendChild(opt);
    });

    // Render aldeias
    async function renderGroup(groupId) {
        localStorage.setItem(STORAGE_KEY, groupId);
        const firstOption = select.querySelector("option[disabled]");
        if (firstOption) firstOption.hidden = true;

        const villages = groupVillages[groupId] || [];
        const total = villages.length;

        if (total === 0) {
            $("#groupVillages").html("<p><i>Nenhuma aldeia no grupo.</i></p>");
            $("#villageCount").text("(0 aldeias)");
            return;
        }

        let output = `<table class="vis" width="100%">
            <thead><tr><th>Nome</th><th>Coordenadas</th><th>Ações</th></tr></thead><tbody>`;
        villages.forEach(v => {
            const id = coordToId[v.coords];
            const link = id
                ? `<a href="/game.php?village=${id}&screen=overview" target="_blank">${v.name}</a>`
                : v.name;

            output += `<tr>
                <td>${link}</td>
                <td><span class="coord-val">${v.coords}</span></td>
                <td><button class="btn copy-coord" data-coord="${v.coords}">📋</button></td>
            </tr>`;
        });
        output += `</tbody></table>`;

        $("#groupVillages").html(output);
        $("#villageCount").text(`(${total} aldeia${total !== 1 ? 's' : ''})`);

        $(".copy-coord").on("click", function () {
            const coord = $(this).data("coord");
            navigator.clipboard.writeText(coord);
            UI.SuccessMessage(`Coordenada ${coord} copiada!`);
        });
    }

    // Evento de seleção
    select.addEventListener("change", function () {
        const groupId = this.value;
        if (!groupId) return;
        renderGroup(groupId);
    });

    // Auto-selecionar último grupo
    if (savedGroupId) {
        renderGroup(savedGroupId);
    }
})();
