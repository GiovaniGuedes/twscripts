javascript:
(async function () {
    const groups = [];

    // Obter TODOS os grupos (manuais + dinâmicos)
    const groupData = await $.get("/game.php?screen=groups&mode=overview&ajax=load_group_menu");
    groupData.result.forEach(group => {
        if (group.group_id != 0) {
            groups.push({ group_id: group.group_id, group_name: group.name });
        }
    });

    // Interface
    const html = `
        <div class="vis" style="padding: 10px;">
            <h2>Grupos de Aldeias</h2>
            <label for="groupSelect"><b>Selecione um grupo:</b></label><br>
            <select id="groupSelect" style="
                margin-top: 5px;
                padding: 4px;
                background: #f4e4bc;
                color: #000;
                border: 1px solid #603000;
                font-weight: bold;
            ">
                <option disabled selected>Selecione...</option>
            </select>
            <hr>
            <div id="groupVillages" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
    `;
    Dialog.show("tw_group_viewer", html);

    // Preencher select com todos os grupos
    const select = document.getElementById("groupSelect");
    groups.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.group_id;
        opt.textContent = g.group_name;
        select.appendChild(opt);
    });

    // Carregar aldeias do grupo selecionado
    select.addEventListener("change", async function () {
        const groupId = this.value;
        $("#groupVillages").html("<i>Carregando aldeias...</i>");

        const response = await $.post("/game.php?screen=groups&ajax=load_villages_from_group", {
            group_id: groupId
        });

        const doc = new DOMParser().parseFromString(response.html, "text/html");
        const rows = doc.querySelectorAll("#group_table tbody tr");

        if (!rows.length) {
            $("#groupVillages").html("<p><i>Nenhuma aldeia no grupo.</i></p>");
            return;
        }

        let output = `<table class="vis" width="100%">
            <thead><tr><th>Nome</th><th>Coordenadas</th></tr></thead><tbody>`;
        rows.forEach(row => {
            const name = row.querySelector("td:nth-child(1)")?.textContent.trim();
            const coords = row.querySelector("td:nth-child(2)")?.textContent.trim();
            output += `<tr><td>${name}</td><td><b>${coords}</b></td></tr>`;
        });
        output += `</tbody></table>`;

        $("#groupVillages").html(output);
    });
})();
