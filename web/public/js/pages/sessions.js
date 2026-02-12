let sessionCache = new Map();

const toDateInputValueSessions = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];

window.renderSessions = async function() {
    const container = document.getElementById('main-view');

    const today = toDateInputValueSessions(new Date());
    const firstDay = new Date();
    firstDay.setDate(1);
    const startStr = toDateInputValueSessions(firstDay);

    container.innerHTML = `
        <div class="action-header">
            <div>
                <h3>Sessions Serveurs</h3>
                <p class="text-muted">Ouvertures / fermetures par serveur</p>
            </div>
            <div class="filters">
                <select id="session-status" class="select-std select-center">
                    <option value="all">Toutes</option>
                    <option value="open">Ouvertes</option>
                    <option value="closed">Fermées</option>
                </select>
                <input type="date" id="session-start" value="${startStr}">
                <input type="date" id="session-end" value="${today}">
                <button id="session-refresh" class="btn-secondary btn-sm">Actualiser</button>
            </div>
        </div>

        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Serveur</th>
                        <th>Ouverture</th>
                        <th>Fermeture</th>
                        <th class="text-center">Collecte</th>
                        <th class="text-center">Statut</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody id="sessions-list">
                    <tr><td colspan="6" class="loading-text">Chargement...</td></tr>
                </tbody>
            </table>
        </div>

        <div id="sessions-modal-area"></div>
    `;

    document.getElementById('session-refresh').addEventListener('click', () => loadSessions());
    document.getElementById('session-status').addEventListener('change', () => loadSessions());

    document.getElementById('sessions-list').addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-session-btn');
        const closeBtn = e.target.closest('.close-session-btn');
        if (viewBtn?.dataset.id) showSessionDetails(viewBtn.dataset.id);
        if (closeBtn?.dataset.id) openCloseSessionModal(closeBtn.dataset.id);
    });

    await loadSessions();
};

async function loadSessions() {
    const status = document.getElementById('session-status').value;
    const startInput = document.getElementById('session-start').value;
    const endInput = document.getElementById('session-end').value;

    let query = sb.from('sessions_serveurs')
        .select('id, user_id, start_time, end_time, total_collecte, users(first_name, last_name)')
        .order('start_time', { ascending: false })
        .limit(100);

    if (status === 'open') query = query.is('end_time', null);
    if (status === 'closed') query = query.not('end_time', 'is', null);

    if (startInput) {
        const startDate = new Date(startInput);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('start_time', startDate.toISOString());
    }
    if (endInput) {
        const endDate = new Date(endInput);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;
    const tbody = document.getElementById('sessions-list');
    if (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Erreur de chargement.</td></tr>';
        return;
    }

    sessionCache = new Map((data || []).map(s => [s.id, s]));
    if (!data || !data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aucune session.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(s => {
        const userName = s.users ? `${s.users.first_name || ''} ${s.users.last_name || ''}`.trim() : 'N/A';
        const isOpen = !s.end_time;
        const total = formatMoney(toNumber(s.total_collecte));
        const statusLabel = isOpen ? 'Ouverte' : 'Fermée';
        const statusClass = isOpen ? 'badge-warning' : 'badge-success';

        return `
            <tr>
                <td>${escapeHtml(userName || 'N/A')}</td>
                <td class="text-muted">${formatDate(s.start_time)}</td>
                <td class="text-muted">${s.end_time ? formatDate(s.end_time) : 'â€”'}</td>
                <td class="text-center font-bold">${total}</td>
                <td class="text-center"><span class="badge ${statusClass}">${statusLabel}</span></td>
                <td class="text-right">
                    <button class="btn-secondary btn-sm view-session-btn" data-id="${s.id}">Voir</button>
                    ${isOpen ? `<button class="btn-primary btn-sm close-session-btn" data-id="${s.id}">Clôturer</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function showSessionDetails(sessionId) {
    const session = sessionCache.get(sessionId);
    if (!session) return;

    const { data: orders, error } = await sb.from('orders')
        .select('id, order_number, total_amount, created_at, status, tables(label), users(first_name, last_name)')
        .eq('session_id', sessionId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

    if (error) {
        alert('Impossible de charger les commandes de la session.');
        return;
    }

    const totalOrders = (orders || []).length;
    const totalAmount = (orders || []).reduce((sum, o) => sum + toNumber(o.total_amount), 0);
    const rows = (orders || []).map(o => `
        <tr>
            <td class="font-mono">#${o.order_number}</td>
            <td class="text-muted">${formatDate(o.created_at)}</td>
            <td>${escapeHtml(o.users ? `${o.users.first_name || ''} ${o.users.last_name || ''}`.trim() : 'N/A')}</td>
            <td>${escapeHtml(o.tables?.label || '-')}</td>
            <td class="text-center font-bold">${formatMoney(toNumber(o.total_amount))}</td>
            <td class="text-center"><span class="badge ${getStatusClass(o.status)}">${getStatusLabel(o.status)}</span></td>
        </tr>
    `).join('');

    const modalHtml = `
        <div class="modal-backdrop" onclick="this.remove()">
            <div class="modal-window" onclick="event.stopPropagation()">
                <div class="modal-head">
                    <h3>Détails Session</h3>
                    <button class="close-modal" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="flex justify-between items-center">
                        <span class="text-muted">Commandes</span>
                        <strong>${totalOrders}</strong>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-muted">Total encaissé</span>
                        <strong>${formatMoney(totalAmount)}</strong>
                    </div>
                    <div class="table-wrapper" style="margin-top: 12px;">
                        <table class="table-modern">
                            <thead>
                                <tr>
                                    <th>Ticket</th>
                                    <th>Date</th>
                                    <th>Serveur</th>
                                    <th>Table</th>
                                    <th class="text-center">Total</th>
                                    <th class="text-center">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="6" class="text-center text-muted">Aucune commande.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('sessions-modal-area').innerHTML = modalHtml;
}

function openCloseSessionModal(sessionId) {
    const session = sessionCache.get(sessionId);
    if (!session) return;

    const modalHtml = `
        <div class="modal-backdrop" id="close-session-modal" onclick="this.remove()">
            <div class="modal-window" onclick="event.stopPropagation()">
                <div class="modal-head">
                    <h3>Clôturer la session</h3>
                    <button class="close-modal" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
                </div>
                <form id="close-session-form">
                    <div class="modal-body">
                        <p>Confirmer la clôture de la session ?</p>
                        <p class="text-muted">Total collecte: <strong>${formatMoney(toNumber(session.total_collecte))}</strong></p>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('close-session-modal').remove()">Annuler</button>
                        <button type="submit" class="btn-primary">Clôturer</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('sessions-modal-area').innerHTML = modalHtml;

    document.getElementById('close-session-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await sb.rpc('close_server_session', {
            p_session_id: sessionId
        });

        if (error) {
            alert('Erreur: ' + error.message);
            return;
        }

        document.getElementById('close-session-modal').remove();
        loadSessions();
    });
}

