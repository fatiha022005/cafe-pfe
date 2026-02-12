let inventoryProducts = [];
let inventoryUserId = null;

window.renderInventory = async function() {
    const container = document.getElementById('main-view');
    container.innerHTML = `
        <div class="action-header">
            <div>
                <h3>Stock & Ajustements</h3>
                <p class="text-muted">Stock actuel et historique des mouvements</p>
            </div>
            <div class="filters">
                <select id="inv-filter" class="select-std select-center">
                    <option value="all">Tous</option>
                    <option value="restock">Réassort</option>
                    <option value="correction">Correction</option>
                    <option value="damage">Dégâts</option>
                    <option value="waste">Pertes</option>
                    <option value="sale">Ventes</option>
                    <option value="cancel">Annulations</option>
                </select>
                <button id="btn-adjust" class="btn-primary">+ Ajustement</button>
            </div>
        </div>

        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Stock Actuel</th>
                        <th class="text-center">Quantité</th>
                        <th class="text-center">Alerte</th>
                    </tr>
                </thead>
                <tbody id="current-stock-list">
                    <tr><td colspan="3" class="loading-text">Chargement...</td></tr>
                </tbody>
            </table>
        </div>

        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Produit</th>
                        <th class="text-center">Type</th>
                        <th class="text-center">Quantité</th>
                        <th>Par</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody id="inv-list">
                    <tr><td colspan="6" class="loading-text">Chargement...</td></tr>
                </tbody>
            </table>
        </div>

        <div id="inventory-modal-area"></div>
    `;

    document.getElementById('btn-adjust').addEventListener('click', openAdjustModal);
    document.getElementById('inv-filter').addEventListener('change', () => loadInventory());

    await Promise.all([loadInventoryProducts(), ensureInventoryUser(), loadInventory()]);
};

async function ensureInventoryUser() {
    if (inventoryUserId) return inventoryUserId;
    const { data: authData } = await sb.auth.getUser();
    const authId = authData?.user?.id;
    if (!authId) return null;

    const { data, error } = await sb.from('users')
        .select('id')
        .eq('auth_user_id', authId)
        .single();

    if (error) {
        console.error(error);
        return null;
    }
    inventoryUserId = data.id;
    return inventoryUserId;
}

async function loadInventoryProducts() {
    const { data, error } = await sb.from('products')
        .select('id, name, stock_quantity, min_stock_alert')
        .order('name');

    if (error) {
        console.error(error);
        inventoryProducts = [];
        renderCurrentStock();
        return;
    }
    inventoryProducts = data || [];
    renderCurrentStock();
}

async function loadInventory() {
    const filter = document.getElementById('inv-filter').value;
    let query = sb.from('stock_logs')
        .select('id, change_amount, reason, notes, created_at, products(name), users(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(60);

    if (filter !== 'all') query = query.eq('reason', filter);

    const { data, error } = await query;
    const tbody = document.getElementById('inv-list');
    if (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Erreur de chargement.</td></tr>';
        return;
    }

    if (!data || !data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aucun mouvement. Le stock actuel est affiché ci-dessus.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(l => {
        const qty = toNumber(l.change_amount);
        const qtyClass = qty < 0 ? 'text-danger' : 'text-success';
        const userName = l.users ? `${l.users.first_name || ''} ${l.users.last_name || ''}`.trim() : 'N/A';
        return `
            <tr>
                <td class="text-muted">${formatDate(l.created_at)}</td>
                <td>${escapeHtml(l.products?.name || 'Produit')}</td>
                <td class="text-center">${getReasonLabel(l.reason)}</td>
                <td class="text-center ${qtyClass} font-bold">${qty > 0 ? '+' : ''}${qty}</td>
                <td>${escapeHtml(userName || 'N/A')}</td>
                <td>${escapeHtml(l.notes || '')}</td>
            </tr>
        `;
    }).join('');
}

function renderCurrentStock() {
    const tbody = document.getElementById('current-stock-list');
    if (!tbody) return;
    if (!inventoryProducts || !inventoryProducts.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Aucun produit.</td></tr>';
        return;
    }
    tbody.innerHTML = inventoryProducts.map(p => {
        const stock = toNumber(p.stock_quantity);
        const minAlert = toNumber(p.min_stock_alert ?? 10);
        const status = stock <= minAlert ? 'Stock bas' : 'OK';
        return `
        <tr>
            <td>${escapeHtml(p.name || 'Produit')}</td>
            <td class="text-center font-bold">${stock}</td>
            <td class="text-center">${status}</td>
        </tr>
    `;}).join('');
}

function getReasonLabel(reason) {
    return {
        restock: 'Réassort',
        correction: 'Correction',
        damage: 'Dégât',
        waste: 'Perte',
        sale: 'Vente',
        cancel: 'Annulation'
    }[reason] || reason;
}

function openAdjustModal() {
    if (!inventoryProducts.length) {
        alert('Aucun produit disponible.');
        return;
    }

    const options = inventoryProducts.map(p => `
        <option value="${p.id}" data-stock="${toNumber(p.stock_quantity)}">${escapeHtml(p.name)}</option>
    `).join('');

    const modalHtml = `
        <div class="modal-backdrop" id="inv-modal" onclick="this.remove()">
            <div class="modal-window" onclick="event.stopPropagation()">
                <div class="modal-head">
                    <h3>Nouvel Ajustement</h3>
                    <button class="close-modal" onclick="document.getElementById('inv-modal').remove()">&times;</button>
                </div>
                <form id="inv-form">
                    <div class="form-grid">
                        <div class="field full">
                            <label>Produit</label>
                            <select id="inv-product" class="input-std">${options}</select>
                            <small class="text-muted">Stock actuel: <strong id="inv-stock">--</strong></small>
                        </div>
                        <div class="field">
                            <label>Type</label>
                            <select id="inv-reason" class="input-std">
                                <option value="restock">Réassort</option>
                                <option value="correction">Correction</option>
                                <option value="damage">Dégât</option>
                                <option value="waste">Perte</option>
                            </select>
                        </div>
                        <div class="field" id="inv-direction-field">
                            <label>Sens</label>
                            <select id="inv-direction" class="input-std">
                                <option value="positive">+ Ajouter</option>
                                <option value="negative">- Retirer</option>
                            </select>
                        </div>
                        <div class="field">
                            <label>Quantité</label>
                            <input type="number" id="inv-qty" min="1" class="input-std" required>
                        </div>
                        <div class="field full">
                            <label>Notes</label>
                            <input type="text" id="inv-notes" class="input-std" placeholder="Optionnel">
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('inv-modal').remove()">Annuler</button>
                        <button type="submit" class="btn-primary">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('inventory-modal-area').innerHTML = modalHtml;

    const productSelect = document.getElementById('inv-product');
    const reasonSelect = document.getElementById('inv-reason');
    const directionField = document.getElementById('inv-direction-field');
    const stockLabel = document.getElementById('inv-stock');

    const updateStockLabel = () => {
        const selected = productSelect.options[productSelect.selectedIndex];
        stockLabel.textContent = selected?.dataset?.stock ?? '--';
    };

    const updateDirectionVisibility = () => {
        const show = reasonSelect.value === 'correction';
        directionField.classList.toggle('hidden', !show);
    };

    productSelect.addEventListener('change', updateStockLabel);
    reasonSelect.addEventListener('change', updateDirectionVisibility);

    updateStockLabel();
    updateDirectionVisibility();

    document.getElementById('inv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const productId = productSelect.value;
        const reason = reasonSelect.value;
        const qty = parseInt(document.getElementById('inv-qty').value, 10);
        const notes = document.getElementById('inv-notes').value.trim();
        const direction = document.getElementById('inv-direction').value;

        if (!productId || !reason || !qty || qty <= 0) {
            alert('Veuillez renseigner une Quantité valide.');
            return;
        }

        let change = qty;
        if (reason === 'damage' || reason === 'waste') change = -qty;
        if (reason === 'correction') change = direction === 'negative' ? -qty : qty;

        const userId = await ensureInventoryUser();
        if (!userId) {
            alert('Impossible dâ€™identifier lâ€™utilisateur.');
            return;
        }

        const { error } = await sb.rpc('adjust_stock', {
            p_user_id: userId,
            p_product_id: productId,
            p_change_amount: change,
            p_reason: reason,
            p_notes: notes || null
        });

        if (error) {
            alert('Erreur: ' + error.message);
            return;
        }

        document.getElementById('inv-modal').remove();
        await loadInventoryProducts();
        await loadInventory();
    });
}



