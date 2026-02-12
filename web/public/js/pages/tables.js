let tableCache = new Map();

window.renderTables = async function() {
    const container = document.getElementById('main-view');
    container.innerHTML = `
        <div class="action-header">
            <input type="text" id="table-search" placeholder="Rechercher une table..." class="input-search">
            <button id="btn-add-table" class="btn-primary">
                <span>+</span> Ajouter Table
            </button>
        </div>

        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Label</th>
                        <th class="text-center">Capacité</th>
                        <th class="text-center">Statut</th>
                        <th class="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody id="tables-list"><tr><td colspan="4" class="loading-row">Chargement...</td></tr></tbody>
            </table>
        </div>

        ${getTableModalTemplate()}
    `;

    bindTableEvents();
    await fetchTables();
};

function getTableModalTemplate() {
    return `
    <div id="table-modal" class="modal-backdrop hidden">
        <div class="modal-window">
            <div class="modal-head">
                <h3 id="t-title">Nouvelle Table</h3>
                <button class="close-modal">&times;</button>
            </div>
            <form id="t-form">
                <input type="hidden" name="id">
                <div class="form-grid">
                    <div class="field">
                        <label>Label</label>
                        <input type="text" name="label" required class="input-std" placeholder="T1, T2...">
                    </div>
                    <div class="field">
                        <label>Capacité</label>
                        <input type="number" name="capacity" min="1" required class="input-std" value="2">
                    </div>
                    <div class="field full">
                        <label>Statut</label>
                        <select name="is_active" class="input-std">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary close-modal">Annuler</button>
                    <button type="submit" class="btn-primary">Enregistrer</button>
                </div>
            </form>
        </div>
    </div>`;
}

async function fetchTables(query = '') {
    let req = sb.from('tables').select('*').order('label');
    if (query) req = req.ilike('label', `%${query}%`);

    const { data, error } = await req;
    if (error) {
        console.error(error);
        document.getElementById('tables-list').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Erreur de chargement.</td></tr>';
        return;
    }

    tableCache = new Map((data || []).map(t => [t.id, t]));
    renderTableList(data || []);
}

function renderTableList(tables) {
    const html = tables.map(t => `
        <tr class="${t.is_active === false ? 'opacity-50' : ''}">
            <td class="font-medium">${escapeHtml(t.label)}</td>
            <td class="text-center">${toNumber(t.capacity)}</td>
            <td class="text-center">
                <span class="badge ${t.is_active === false ? 'badge-danger' : 'badge-success'}">
                    ${t.is_active === false ? 'Inactive' : 'Active'}
                </span>
            </td>
            <td class="text-center actions-center">
                <button class="btn-icon-sm edit-table-btn" data-id="${t.id}" aria-label="Modifier">
                    <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                    </svg>
                </button>
                <button class="btn-icon-sm delete-table-btn" data-id="${t.id}" aria-label="Supprimer">
                    <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');

    document.getElementById('tables-list').innerHTML = html || '<tr><td colspan="4" class="text-center">Aucune table.</td></tr>';
}

function bindTableEvents() {
    const modal = document.getElementById('table-modal');
    const form = document.getElementById('t-form');

    const toggleModal = (show) => modal.classList.toggle('hidden', !show);

    document.getElementById('btn-add-table').onclick = () => {
        form.reset();
        form.querySelector('[name="id"]').value = '';
        document.getElementById('t-title').textContent = 'Nouvelle Table';
        toggleModal(true);
    };

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => toggleModal(false));

    document.getElementById('table-search').addEventListener('input', (e) => fetchTables(e.target.value));

    document.getElementById('tables-list').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-table-btn');
        const deleteBtn = e.target.closest('.delete-table-btn');

        if (editBtn) {
            const data = tableCache.get(editBtn.dataset.id);
            if (!data) return;
            Object.keys(data).forEach(k => {
                const input = form.querySelector(`[name="${k}"]`);
                if (input) input.value = data[k];
            });
            document.getElementById('t-title').textContent = 'Modifier Table';
            toggleModal(true);
        }

        if (deleteBtn) {
            if (confirm('Supprimer cette table ?')) {
                await sb.from('tables').delete().eq('id', deleteBtn.dataset.id);
                fetchTables();
            }
        }
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const id = data.id;
        delete data.id;
        data.label = (data.label || '').trim();
        data.capacity = parseInt(data.capacity, 10) || 0;
        data.is_active = data.is_active === 'true';

        const { error } = id
            ? await sb.from('tables').update(data).eq('id', id)
            : await sb.from('tables').insert(data);

        if (!error) {
            toggleModal(false);
            fetchTables();
        } else {
            alert('Erreur: ' + error.message);
        }
    };
}

