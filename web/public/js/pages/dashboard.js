let dashboardChart = null;

const ICON_REVENUE = `
<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 1v22"></path>
  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"></path>
</svg>`;

const ICON_ORDERS = `
<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="4" y="3" width="16" height="18" rx="2"></rect>
  <path d="M8 7h8"></path>
  <path d="M8 11h8"></path>
  <path d="M8 15h5"></path>
</svg>`;

const ICON_AVG = `
<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 19h16"></path>
  <path d="M7 15l4-6 3 4 3-6"></path>
  <circle cx="7" cy="15" r="1"></circle>
  <circle cx="11" cy="9" r="1"></circle>
  <circle cx="14" cy="13" r="1"></circle>
  <circle cx="17" cy="7" r="1"></circle>
</svg>`;

const ICON_ALERT = `
<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 9v4"></path>
  <path d="M12 17h.01"></path>
  <path d="M10.3 3.3L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"></path>
</svg>`;

window.renderDashboard = async function() {
    const container = document.getElementById('main-view');
    
    container.innerHTML = `
        <div class="page-header-pro">
            <div>
                <h2 class="page-title-big">Tableau de Bord</h2>
                <p class="text-muted" style="margin-top: 5px;">Activité du restaurant en temps réel</p>
            </div>
            <div class="flex gap-2">
                <button class="filter-pill active" data-range="today">Aujourd'hui</button>
                <button class="filter-pill" data-range="week">7 Jours</button>
                <button class="filter-pill" data-range="month">Mois</button>
                <button class="filter-pill" data-range="year">An</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-head">
                    <span class="stat-label">Chiffre d'Affaires</span>
                    <span class="stat-icon">${ICON_REVENUE}</span>
                </div>
                <div class="stat-value" id="d-revenue">--</div>
                <div class="stat-trend text-success">
                    <span>▲</span> Revenus encaissés
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-head">
                    <span class="stat-label">Commandes</span>
                    <span class="stat-icon">${ICON_ORDERS}</span>
                </div>
                <div class="stat-value" id="d-orders">--</div>
                <div class="stat-trend text-info">Tickets validés</div>
            </div>

            <div class="stat-card">
                <div class="stat-head">
                    <span class="stat-label">Panier Moyen</span>
                    <span class="stat-icon">${ICON_AVG}</span>
                </div>
                <div class="stat-value" id="d-avg">--</div>
                <div class="stat-trend text-muted">Moyenne par client</div>
            </div>

            <div class="stat-card" style="border-color: rgba(239, 68, 68, 0.3);">
                <div class="stat-head">
                    <span class="stat-label text-danger">Stock Faible</span>
                    <span class="stat-icon">${ICON_ALERT}</span>
                </div>
                <div class="stat-value text-danger" id="d-stock">--</div>
                <div class="stat-trend text-danger">Produits à commander</div>
            </div>
        </div>

        <div class="dashboard-split">
            <div class="chart-container-pro">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-white">Évolution des Ventes</h3>
                </div>
                <div style="height: 300px; width: 100%;">
                    <canvas id="mainChart"></canvas>
                </div>
            </div>

            <div class="chart-container-pro">
                <h3 class="font-bold text-white mb-4" style="font-size: 1rem;">Alertes Stock</h3>
                <div style="max-height: 280px; overflow-y: auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Produit</th>
                                <th class="text-right">Qté</th>
                            </tr>
                        </thead>
                        <tbody id="stock-alert-list">
                            <tr><td colspan="2">Chargement...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadDashboardData(e.target.dataset.range);
        });
    });

    await loadDashboardData('today');
};

async function loadDashboardData(range) {
    const start = new Date();
    if (range === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (range === 'week') {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else if (range === 'year') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
    }

    try {
        const { data: orders, error: errOrders } = await sb.from('orders')
            .select('total_amount, created_at')
            .gte('created_at', start.toISOString())
            .neq('status', 'cancelled');

        if (errOrders) throw errOrders;

        const { data: stock, error: errStock } = await sb.from('products')
            .select('name, stock_quantity')
            .lte('stock_quantity', 10)
            .order('stock_quantity', { ascending: true })
            .limit(10);

        if (errStock) throw errStock;

        const totalRevenue = orders.reduce((acc, o) => acc + toNumber(o.total_amount), 0);
        const totalOrders = orders.length;
        const averageBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        document.getElementById('d-revenue').textContent = formatMoney(totalRevenue);
        document.getElementById('d-orders').textContent = totalOrders;
        document.getElementById('d-avg').textContent = formatMoney(averageBasket);
        document.getElementById('d-stock').textContent = stock.length;

        const stockTbody = document.getElementById('stock-alert-list');
        if (stock.length === 0) {
            stockTbody.innerHTML = '<tr><td colspan="2" class="text-muted text-center">Tout est OK</td></tr>';
        } else {
            stockTbody.innerHTML = stock.map(p => `
                <tr>
                    <td>${escapeHtml(p.name)}</td>
                    <td class="text-right text-danger font-bold">${toNumber(p.stock_quantity)}</td>
                </tr>
            `).join('');
        }

        renderMainChart(orders, range);

    } catch (err) {
        console.error('Erreur Dashboard:', err);
    }
}

function renderMainChart(orders, range) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    orders = orders || [];
    const bucket = new Map();

    orders.forEach(o => {
        const d = new Date(o.created_at);
        let sortKey;
        let label;
        
        if (range === 'today') {
            const hour = d.getHours();
            sortKey = hour;
            label = String(hour).padStart(2, '0') + 'h';
        } else if (range === 'week') {
            const dayKey = d.toISOString().split('T')[0];
            sortKey = dayKey;
            label = new Date(dayKey).toLocaleDateString(CONFIG.LOCALE, { weekday: 'short' });
        } else if (range === 'month') {
            const dayKey = d.toISOString().split('T')[0];
            sortKey = dayKey;
            label = new Date(dayKey).toLocaleDateString(CONFIG.LOCALE, { day: '2-digit', month: 'short' });
        } else {
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            sortKey = monthKey;
            label = new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString(CONFIG.LOCALE, { month: 'short' });
        }
        
        const current = bucket.get(sortKey) || { label, value: 0 };
        current.value += toNumber(o.total_amount);
        bucket.set(sortKey, current);
    });

    const sortedKeys = Array.from(bucket.keys()).sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    });

    const labels = sortedKeys.map(k => bucket.get(k).label);
    const dataPoints = sortedKeys.map(k => bucket.get(k).value);

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(200, 92, 42, 0.35)');
    gradient.addColorStop(1, 'rgba(200, 92, 42, 0.0)');

    if (dashboardChart) dashboardChart.destroy();

    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventes (MAD)',
                data: dataPoints,
                borderColor: '#c85c2a',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#fff7ee',
                pointBorderColor: '#c85c2a',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    borderColor: 'rgba(15, 23, 42, 0.15)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(15, 23, 42, 0.08)' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    border: { display: false }
                }
            }
        }
    });
}
