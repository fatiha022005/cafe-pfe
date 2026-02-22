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

const productImageColor = (category) => {
    const map = {
        'Café': '#c85c2a',
        'Cafe': '#c85c2a',
        'Boissons': '#2563eb',
        'Boissons Chaudes': '#c85c2a',
        'Boissons Froides': '#2563eb',
        'Froid': '#2563eb',
        'Snack': '#16a34a',
        'Nourriture': '#16a34a',
        'Sale': '#16a34a',
        'Sucre': '#b45309',
        'Viennoiseries': '#b45309',
        'Signature': '#7c3aed',
        'Petit Dejeuner': '#9333ea',
        'Plats': '#dc2626'
    };
    return map[category] || '#6b7280';
};

const buildProductImage = (name, category) => {
    const safeName = (name || 'Produit').trim() || 'Produit';
    const parts = safeName.split(/\s+/).filter(Boolean);
    const initials = parts.length === 0
        ? 'PR'
        : parts.length === 1
            ? parts[0].slice(0, 2).toUpperCase()
            : (parts[0][0] + parts[1][0]).toUpperCase();
    const bg = productImageColor(category);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="24" fill="${bg}"/><text x="100" y="115" font-family="Sora, Arial" font-size="72" font-weight="700" text-anchor="middle" fill="#fffaf4">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const sanitizeFileName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

async function uploadProductImage(productId, file) {
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
    const safeExt = String(ext || 'jpg').toLowerCase();
    const filePath = `products/${productId}.${safeExt}`;
    const { error: uploadError } = await sb.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true, cacheControl: '3600', contentType: file.type || 'image/jpeg' });

    if (uploadError) throw uploadError;
    const { data } = sb.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
}

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
                        <th class="text-center">Dispo</th>
                        <th class="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody id="p-list"><tr><td colspan="6" class="loading-row">Chargement...</td></tr></tbody>
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
                            <option>Café</option>
                            <option>Froid</option>
                            <option>Sale</option>
                            <option>Sucre</option>
                            <option>Signature</option>
                            <option>Boissons</option>
                            <option>Snack</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>Prix (MAD)</label>
                        <input type="number" step="0.5" name="price" required class="input-std">
                    </div>
                    <div class="field">
                        <label>Coût (MAD)</label>
                        <input type="number" step="0.5" name="cost" class="input-std" value="0">
                    </div>
                    <div class="field">
                        <label>Stock</label>
                        <input type="number" name="stock_quantity" required class="input-std">
                    </div>
                    <div class="field">
                        <label>Stock min</label>
                        <input type="number" name="min_stock_alert" class="input-std" value="10">
                    </div>
                    <div class="field full">
                        <label>Disponible</label>
                        <select name="is_available" class="input-std">
                            <option value="true">Disponible</option>
                            <option value="false">Indisponible</option>
                        </select>
                    </div>
                <div class="field full">
                    <label>Description</label>
                    <input type="text" name="description" class="input-std" placeholder="Optionnel">
                </div>
                <div class="field full">
                    <label>Image (fichier)</label>
                    <input type="file" name="image_file" accept="image/*" class="input-std">
                    <div id="image-preview" style="margin-top:10px; display:flex; align-items:center; gap:10px;">
                        <span class="text-muted">Aucune image</span>
                    </div>
                </div>
                <div class="field full">
                    <label>Image (URL)</label>
                    <input type="text" name="image_url" class="input-std" placeholder="Optionnel (auto-généré si vide)">
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
    if (data && data.length) {
        const updates = data
            .filter(p => !p.image_url)
            .map(p => ({
                id: p.id,
                image_url: buildProductImage(p.name, p.category)
            }));

        if (updates.length) {
            await Promise.all(updates.map(u => sb.from('products').update({ image_url: u.image_url }).eq('id', u.id)));
            data.forEach(p => {
                if (!p.image_url) {
                    p.image_url = updates.find(u => u.id === p.id)?.image_url || p.image_url;
                }
            });
        }
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
            <td class="text-center">
                <span class="badge ${p.is_available === false ? 'badge-danger' : 'badge-success'}">
                    ${p.is_available === false ? 'Indispo' : 'OK'}
                </span>
            </td>
            <td class="text-center actions-center">
                <button class="btn-icon-sm edit-btn" data-id="${p.id}" aria-label="Modifier">${ICON_EDIT}</button>
                <button class="btn-icon-sm delete-btn" data-id="${p.id}" aria-label="Supprimer">${ICON_DELETE}</button>
            </td>
        </tr>
    `).join('');
    document.getElementById('p-list').innerHTML = html || '<tr><td colspan="6" class="text-center">Aucun résultat</td></tr>';
}

function bindProductEvents() {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('p-form');
    const imagePreview = document.getElementById('image-preview');
    const imageFileInput = form.querySelector('[name="image_file"]');
    const imageUrlInput = form.querySelector('[name="image_url"]');

    const toggleModal = (show) => modal.classList.toggle('hidden', !show);

    const setImagePreview = (url) => {
        if (!imagePreview) return;
        if (!url) {
            imagePreview.innerHTML = '<span class="text-muted">Aucune image</span>';
            return;
        }
        imagePreview.innerHTML = `
            <img src="${url}" alt="Aperçu" style="width:72px;height:72px;border-radius:12px;object-fit:cover;border:1px solid rgba(15,23,42,0.12);" />
            <span class="text-muted" style="font-size:0.85rem;">Aperçu</span>
        `;
    };

    if (imageFileInput) {
        imageFileInput.addEventListener('change', () => {
            const file = imageFileInput.files?.[0];
            if (file) {
                setImagePreview(URL.createObjectURL(file));
            } else if (imageUrlInput?.value) {
                setImagePreview(imageUrlInput.value.trim());
            } else {
                setImagePreview('');
            }
        });
    }

    if (imageUrlInput) {
        imageUrlInput.addEventListener('input', () => {
            if (!imageFileInput?.files?.length) {
                setImagePreview(imageUrlInput.value.trim());
            }
        });
    }
    
    document.getElementById('btn-add').onclick = () => {
        form.reset();
        document.querySelector('[name="id"]').value = '';
        document.getElementById('m-title').textContent = 'Nouveau Produit';
        if (imageFileInput) imageFileInput.value = '';
        if (imageUrlInput) imageUrlInput.value = '';
        setImagePreview('');
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
            if (imageFileInput) imageFileInput.value = '';
            if (imageUrlInput) imageUrlInput.value = data.image_url || '';
            setImagePreview(data.image_url || buildProductImage(data.name, data.category));
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
        const imageFile = imageFileInput?.files?.[0] || null;
        delete data.image_file;
        if (data.name) data.name = data.name.trim();
        if (data.category) data.category = data.category.trim();
        if (data.description) data.description = data.description.trim();
        if (data.image_url) data.image_url = data.image_url.trim();
        data.price = toNumber(data.price);
        data.cost = toNumber(data.cost);
        data.stock_quantity = parseInt(data.stock_quantity, 10) || 0;
        data.min_stock_alert = parseInt(data.min_stock_alert, 10) || 10;
        data.is_available = data.is_available === 'true';
        if (!data.description) data.description = null;
        const imageUrlText = data.image_url || '';
        delete data.image_url;

        try {
            let productId = id;
            let imageUrl = imageUrlText;

            if (id) {
                const { error: updateError } = await sb.from('products').update(data).eq('id', id);
                if (updateError) throw updateError;
            } else {
                const { data: inserted, error: insertError } = await sb.from('products').insert(data).select('id').single();
                if (insertError) throw insertError;
                productId = inserted.id;
            }

            if (imageFile && productId) {
                imageUrl = await uploadProductImage(productId, imageFile);
            }
            if (!imageUrl) {
                imageUrl = buildProductImage(data.name, data.category);
            }
            if (productId) {
                const { error: imgError } = await sb.from('products').update({ image_url: imageUrl }).eq('id', productId);
                if (imgError) throw imgError;
            }

            toggleModal(false);
            fetchProducts();
        } catch (err) {
            alert('Erreur: ' + (err?.message || err));
        }
    };
}
