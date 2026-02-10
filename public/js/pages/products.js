let productCache = new Map();

const ICON_EDIT = `
<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 20h9"></path>
  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
</svg>`;

const ICON_DELETE = `
<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
  <path d="M10 11v6"></path>
  <path d="M14 11v6"></path>
  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
</svg>`;

window.renderProducts = async function() {
    const container = document.getElementById('main-view');
    container.innerHTML = `
        <div class="action-header">
            <input type="text" id="search-input" placeholder="Rechercher..." class="input-search">
            <button id="btn-add" class="btn-primary">
                <span>+</span> Ajouter Produit
            </button>
        </div>

        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Catégorie</th>
                        <th class="text-center">Prix</th>
                        <th class="text-center">Stock</th>
                        <th class="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody id="p-list"><tr><td colspan="5" class="loading-row">Chargement...</td></tr></tbody>
            </table>
        </div>
        
        ${getModalTemplate()} 
    `;

    bindProductEvents();
    await fetchProducts();
};

function getModalTemplate() {
    return `
    <div id="product-modal" class="modal-backdrop hidden">
        <div class="modal-window">
            <div class="modal-head">
                <h3 id="m-title">Nouveau Produit</h3>
                <button class="close-modal">&times;</button>
            </div>
            <form id="p-form">
                <input type="hidden" name="id">
                <div class="form-grid">
                    <div class="field">
                        <label>Nom</label>
                        <input type="text" name="name" required class="input-std">
                    </div>
                    <div class="field">
                        <label>Catégorie</label>
                        <select name="category" class="input-std">
                            <option>Café</option><option>Boissons</option><option>Snack</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>Prix (MAD)</label>
                        <input type="number" step="0.5" name="price" required class="input-std">
                    </div>
                    <div class="field">
                        <label>Stock</label>
                        <input type="number" name="stock_quantity" required class="input-std">
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

async function fetchProducts(query = '') {
    let req = sb.from('products').select('*').order('name');
    if (query) req = req.ilike('name', `%${query}%`);
    
    const { data, error } = await req;
    if (error) {
        console.error(error);
        document.getElementById('p-list').innerHTML = '<tr><td colspan="5" class="text-center text-muted">Erreur de chargement.</td></tr>';
        return;
    }
    productCache = new Map((data || []).map(p => [p.id, p]));
    renderList(data || []);
}

function renderList(products) {
    const html = products.map(p => `
        <tr>
            <td class="font-medium">${escapeHtml(p.name)}</td>
            <td><span class="badge-soft">${escapeHtml(p.category)}</span></td>
            <td class="text-center font-bold">${formatMoney(toNumber(p.price))}</td>
            <td class="text-center">
                <span class="${toNumber(p.stock_quantity) <= toNumber(p.min_stock_alert) ? 'text-danger' : 'text-success'}">
                    ${toNumber(p.stock_quantity)}
                </span>
            </td>
            <td class="text-center actions-center">
                <button class="btn-icon-sm edit-btn" data-id="${p.id}" aria-label="Modifier">${ICON_EDIT}</button>
                <button class="btn-icon-sm delete-btn" data-id="${p.id}" aria-label="Supprimer">${ICON_DELETE}</button>
            </td>
        </tr>
    `).join('');
    document.getElementById('p-list').innerHTML = html || '<tr><td colspan="5" class="text-center">Aucun résultat</td></tr>';
}

function bindProductEvents() {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('p-form');

    const toggleModal = (show) => modal.classList.toggle('hidden', !show);
    
    document.getElementById('btn-add').onclick = () => {
        form.reset();
        document.querySelector('[name="id"]').value = '';
        document.getElementById('m-title').textContent = 'Nouveau Produit';
        toggleModal(true);
    };

    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => toggleModal(false));

    document.getElementById('search-input').addEventListener('input', (e) => fetchProducts(e.target.value));

    document.getElementById('p-list').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const data = productCache.get(editBtn.dataset.id);
            if (!data) return;
            Object.keys(data).forEach(k => {
                const input = form.querySelector(`[name="${k}"]`);
                if (input) input.value = data[k];
            });
            document.getElementById('m-title').textContent = 'Modifier';
            toggleModal(true);
        }
        
        if (deleteBtn) {
            if (confirm('Supprimer ce produit ?')) {
                await sb.from('products').delete().eq('id', deleteBtn.dataset.id);
                fetchProducts();
            }
        }
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const id = data.id;
        delete data.id;
        if (data.name) data.name = data.name.trim();
        if (data.category) data.category = data.category.trim();
        data.price = toNumber(data.price);
        data.stock_quantity = parseInt(data.stock_quantity, 10) || 0;

        const { error } = id 
            ? await sb.from('products').update(data).eq('id', id)
            : await sb.from('products').insert(data);

        if (!error) {
            toggleModal(false);
            fetchProducts();
        } else {
            alert('Erreur: ' + error.message);
        }
    };
}
