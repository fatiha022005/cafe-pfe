window.renderOrders = async function() {
    const container = document.getElementById('main-view');
    container.innerHTML = `
        <div class="action-header">
            <h3>Historique</h3>
            <div class="filters">
                <select id="status-filter" class="select-std select-center">
                    <option value="all">Tous les statuts</option>
                    <option value="completed">Terminées</option>
                    <option value="pending">En cours</option>
                    <option value="cancelled">Annulées</option>
                </select>
            </div>
        </div>

        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>N° Ticket</th>
                        <th>Date</th>
                        <th>Serveur</th>
                        <th>Table</th>
                        <th class="text-center">Total</th>
                        <th class="text-center">Statut</th>
                        <th class="text-right">Action</th>
                    </tr>
                </thead>
                <tbody id="orders-list">
                    <tr><td colspan="7" class="loading-text">Chargement...</td></tr>
                </tbody>
            </table>
        </div>
        <div id="modal-area"></div>
    `;

    document.getElementById('status-filter').addEventListener('change', (e) => loadOrders(e.target.value));
    document.getElementById('orders-list').addEventListener('click', (e) => {
        const btn = e.target.closest('.view-order-btn');
        if (btn?.dataset.id) showOrderDetails(btn.dataset.id);
    });
    await loadOrders();
};

async function loadOrders(status = 'all') {
    let query = sb.from('orders')
        .select('*, users(first_name, last_name), tables(label)')
        .order('created_at', { ascending: false })
        .limit(50);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    const tbody = document.getElementById('orders-list');
    if (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Erreur de chargement.</td></tr>';
        return;
    }
    
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Aucune commande.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(o => {
        const userName = o.users ? `${o.users.first_name || ''} ${o.users.last_name || ''}`.trim() : 'N/A';
        const tableLabel = o.tables?.label || '-';
        return `
        <tr>
            <td class="font-mono">#${o.order_number}</td>
            <td class="text-muted">${new Date(o.created_at).toLocaleString(CONFIG.LOCALE)}</td>
            <td>${escapeHtml(userName || 'N/A')}</td>
            <td>${escapeHtml(tableLabel)}</td>
            <td class="text-center font-bold">${formatMoney(toNumber(o.total_amount))}</td>
            <td class="text-center"><span class="badge ${getStatusClass(o.status)}">${getStatusLabel(o.status)}</span></td>
            <td class="text-right">
                <button class="btn-secondary btn-sm view-order-btn" data-id="${o.id}">Voir</button>
            </td>
        </tr>
    `}).join('');
}

window.showOrderDetails = async function(orderId) {
    const { data: order, error } = await sb.from('orders')
        .select('*, order_items(*, products(name))')
        .eq('id', orderId)
        .single();
    if (error || !order) {
        alert('Impossible de charger la commande.');
        return;
    }

    const items = order.order_items || [];
    const itemsHtml = items.length ? items.map(item => `
        <div class="order-item-row">
            <span>${escapeHtml(item.products?.name || 'Produit')} <small class="text-muted">x${toNumber(item.quantity)}</small></span>
            <span>${formatMoney(toNumber(item.subtotal))}</span>
        </div>
    `).join('') : '<div class="text-muted">Aucun article.</div>';

    const modalHtml = `
        <div class="modal-backdrop" onclick="this.remove()">
            <div class="modal-window" onclick="event.stopPropagation()">
                <div class="modal-head">
                    <h3>Commande #${escapeHtml(order.order_number)}</h3>
                    <button class="close-modal" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="order-items-list">${itemsHtml}</div>
                    <div class="order-total-row">
                        <strong>TOTAL</strong>
                        <strong class="text-primary">${formatMoney(toNumber(order.total_amount))}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-area').innerHTML = modalHtml;
};

function getStatusClass(s) {
    return { 'completed': 'badge-success', 'pending': 'badge-warning', 'cancelled': 'badge-danger' }[s] || 'badge-neutral';
}
function getStatusLabel(s) {
    return { 'completed': 'Terminée', 'pending': 'En cours', 'cancelled': 'Annulée' }[s] || s;
}
