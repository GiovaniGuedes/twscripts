javascript:
(async function () {
    const STORAGE_KEY = "tw_last_selected_group";
    const COUNTER_KEY = "tw_rename_counter";
    const PENDING_RENAME_KEY = "tw_pending_rename_group";

    // Se estiver na tela de renomeação e houver ação pendente
    if (window.location.href.includes("screen=overview_villages") && localStorage.getItem(PENDING_RENAME_KEY)) {
        const { tag, groupId } = JSON.parse(localStorage.getItem(PENDING_RENAME_KEY));
        let counter = parseInt(localStorage.getItem(COUNTER_KEY) || "1");

        Dialog.close();

        const icons = Array.from(document.querySelectorAll(".rename-icon"));
        const total = icons.length;

        icons.forEach((icon, i) => {
            setTimeout(() => {
                icon.click();

                setTimeout(() => {
                    const input = document.querySelector('.vis input[type="text"]');
                    if (input) {
                        input.value = `${String(counter).padStart(2, "0")} |${tag}|`;
                        counter++;
                        const okButton = Array.from(document.querySelectorAll('input[type="button"]'))
    .find(btn => btn.value.toLowerCase().includes("ok") || btn.value.toLowerCase().includes("salvar"));
if (okButton) okButton.click();

                        UI.SuccessMessage(`Renomeado ${i + 1}/${total}`);
                    }
                }, 100);
            }, i * 250);
        });

        localStorage.setItem(COUNTER_KEY, counter);
        localStorage.removeItem(PENDING_RENAME_KEY);
        return;
    }

    // Modo normal: painel
    const groups = [];
    const coordToId = {};
    const mapData = await $.get("map/village.txt");
    mapData.trim().split("\n").forEach(line => {
        const [id, name, x, y] = line.split(",");
        coordToId[`${x}|${y}`] = id;
    });

    const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
    groupData.result.forEach(group => {
        groups.push({ group_id: group.group_id, group_name: group.name });
    });

    const html = `
        <div class="vis" style="padding: 10px; width: 700px;">
            <h2>Grupos de Aldeias</h2>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label for="groupSelect"><b>Grupo:</b></label>
                <select id="groupSelect" style="padding: 4px; background: #f4e4bc; color: #000; border: 1px solid #603000; font-weight: bold;"></select>
                <button id="renameVillagesBtn" class="btn" style="padding: 4px; font-weight: bold;">Renomear aldeias</button>
                <button id="resetCounter" class="btn" style="padding: 4px;">Resetar contagem</button>
                <span id="villageCount" style="font-weight: bold;"></span>
            </div>
            <hr>
            <div id="groupVillages" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
    `;
    Dialog.show("tw_group_viewer", html);

    const select = document.getElementById("groupSelect");
    const savedGroupId = localStorage.getItem(STORAGE_KEY);

    const placeholder = document.createElement("option");
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.hidden = false;
    placeholder.textContent = "Selecione um grupo";
    select.appendChild(placeholder);

    groups.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.group_id;
        opt.textContent = g.group_name || "";
        if (!g.group_name) {
            opt.disabled = true;
            opt.style.color = "#999";
        }
        if (savedGroupId == g.group_id) {
            opt.selected = true;
            placeholder.hidden = true;
        }
        select.appendChild(opt);
    });

    select.addEventListener("change", async function () {
        const groupId = this.value;
        if (!groupId) return;
        localStorage.setItem(STORAGE_KEY, groupId);

        const firstOption = this.querySelector("option[disabled]");
        if (firstOption) firstOption.hidden = true;

        $("#groupVillages").html("<i>Carregando aldeias...</i>");
        $("#villageCount").text("");

        const response = await $.post("/game.php?screen=groups&ajax=load_villages_from_group", {
            group_id: groupId
        });

        const doc = new DOMParser().parseFromString(response.html, "text/html");
        const rows = doc.querySelectorAll("#group_table tbody tr");

        if (!rows.length) {
            $("#groupVillages").html("<p><i>Nenhuma aldeia no grupo.</i></p>");
            $("#villageCount").text("0");
            return;
        }

        let output = `<table class="vis" width="100%">
            <thead><tr><th>Nome</th><th>Coordenadas</th><th>Ações</th></tr></thead><tbody>`;
        let total = 0;

        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            if (tds.length >= 2) {
                const name = tds[0].textContent.trim();
                const coords = tds[1].textContent.trim();
                const id = coordToId[coords];
                const link = id
                    ? `<a href="/game.php?village=${id}&screen=overview" target="_blank">${name}</a>`
                    : name;

                output += `<tr>
                    <td>${link}</td>
                    <td><span class="coord-val">${coords}</span></td>
                    <td><button class="btn copy-coord" data-coord="${coords}">📋</button></td>
                </tr>`;
                total++;
            }
        });
        output += `</tbody></table>`;

        $("#groupVillages").html(output);
        $("#villageCount").text(`${total}`);

        $(".copy-coord").on("click", function () {
            const coord = $(this).data("coord");
            navigator.clipboard.writeText(coord);
            UI.SuccessMessage(`Coordenada ${coord} copiada!`);
        });
    });

    document.getElementById("renameVillagesBtn").addEventListener("click", function () {
        const groupId = select.value;
        if (!groupId) return;

        const group = groups.find(g => g.group_id == groupId);
        if (!group) {
            UI.ErrorMessage("Grupo não encontrado.");
            return;
        }

        const defaultTag = (group.group_name || "GRP").trim().toUpperCase().slice(0, 3).replace(/\s/g, '') || "GRP";
        const tagInput = prompt("Informe a TAG para usar na renomeação:", defaultTag);
        if (!tagInput) return;

        localStorage.setItem(PENDING_RENAME_KEY, JSON.stringify({ tag: tagInput, groupId }));
        const redirectUrl = game_data.link_base_pure + `overview_villages&mode=combined&group=${groupId}`;
        window.location.href = redirectUrl;
    });

    document.getElementById("resetCounter").addEventListener("click", () => {
        localStorage.setItem(COUNTER_KEY, "1");
        UI.SuccessMessage("Contador resetado para 1.");
    });

    if (savedGroupId) {
        select.dispatchEvent(new Event("change"));
    }
})();
