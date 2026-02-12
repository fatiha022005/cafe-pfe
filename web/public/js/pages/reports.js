let reportChart = null;

const toDateInputValue = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];

window.renderReports = async function() {
    const container = document.getElementById('main-view');
    
    const today = toDateInputValue(new Date());
    const firstDay = new Date(); 
    firstDay.setDate(1); 
    const startStr = toDateInputValue(firstDay);

    container.innerHTML = `
        <div class="page-header-pro">
            <div>
                <h2 class="page-title-big">Rapports & Analytique</h2>
                <p class="text-muted" style="margin-top: 5px;">Performance des produits</p>
            </div>
            
            <div class="date-inputs-wrapper">
                <input type="date" id="r-start" value="${startStr}">
                <span style="color:var(--text-muted)">➜</span>
                <input type="date" id="r-end" value="${today}">
                <button id="btn-refresh" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-left: 8px;">
                    Actualiser
                </button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-head"><span class="stat-label">Total Ventes</span></div>
                <div class="stat-value text-primary" id="rep-total">--</div>
            </div>
            <div class="stat-card">
                <div class="stat-head"><span class="stat-label">Quantité Vendue</span></div>
                <div class="stat-value" id="rep-qty">--</div>
            </div>
            <div class="stat-card">
                <div class="stat-head"><span class="stat-label">Panier Moyen (Est.)</span></div>
                <div class="stat-value" id="rep-avg">--</div>
            </div>
        </div>

        <div class="chart-container-pro" style="height: 340px; margin-top: 24px;">
            <h3 class="font-bold text-white mb-4" style="font-size: 1.1rem;">Top 10 Produits les plus vendus</h3>
            <div style="height: 280px; width: 100%;">
                <canvas id="topProductsChart"></canvas>
            </div>
        </div>

        <div class="report-split">
            <div class="chart-container-pro">
                <h3 class="font-bold text-white mb-4" style="font-size: 1rem;">Performance Équipe</h3>
                <div class="table-scroll">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Employé</th>
                                <th class="text-center">Commandes</th>
                                <th class="text-center">CA</th>
                                <th class="text-center">Panier moyen</th>
                            </tr>
                        </thead>
                        <tbody id="emp-perf-list">
                            <tr><td colspan="4" class="loading-text">Chargement...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="chart-container-pro">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-white" style="font-size: 1rem;">Dégâts & Pertes</h3>
                    <span class="text-muted" id="loss-total">--</span>
                </div>
                <div class="table-scroll">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Produit</th>
                                <th class="text-center">Type</th>
                                <th class="text-center">Qté</th>
                            </tr>
                        </thead>
                        <tbody id="loss-list">
                            <tr><td colspan="4" class="loading-text">Chargement...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-refresh').addEventListener('click', loadReportsData);
    
    await loadReportsData();
};

async function loadReportsData() {
    const btn = document.getElementById('btn-refresh');
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    const start = document.getElementById('r-start').value;
    const endDate = new Date(document.getElementById('r-end').value);
    endDate.setHours(23, 59, 59, 999);
    const end = endDate.toISOString();

    try {
        let items = [];
        const primary = await sb.from('order_items')
            .select(`
                net_quantity,
                net_subtotal,
                products (name),
                orders!inner (status)
            `)
            .gte('created_at', start)
            .lte('created_at', end)
            .eq('orders.status', 'completed');

        if (primary.error) {
            const { data: orderIds, error: orderIdsError } = await sb.from('orders')
                .select('id')
                .gte('created_at', start)
                .lte('created_at', end)
                .eq('status', 'completed');

            if (orderIdsError) {
                throw orderIdsError;
            }

            const ids = (orderIds || []).map(o => o.id);
            if (!ids.length) {
                items = [];
            } else {
                const fallback = await sb.from('order_items')
                    .select(`
                        quantity,
                        subtotal,
                        products (name)
                    `)
                    .in('order_id', ids);

                if (fallback.error) {
                    throw fallback.error;
                }
                items = fallback.data || [];
            }
        } else {
            items = primary.data || [];
        }

        let totalRev = 0;
        let totalQty = 0;
        const productStats = {};

        items.forEach(item => {
            totalRev += toNumber(item.net_subtotal ?? item.subtotal);
            totalQty += toNumber(item.net_quantity ?? item.quantity);
            
            const pName = item.products?.name || 'Produit Inconnu';
            productStats[pName] = (productStats[pName] || 0) + toNumber(item.net_quantity ?? item.quantity);
        });

        document.getElementById('rep-total').textContent = formatMoney(totalRev);
        document.getElementById('rep-qty').textContent = totalQty;
        document.getElementById('rep-avg').textContent = items.length > 0 ? formatMoney(totalRev / items.length) : formatMoney(0);

        const sortedProducts = Object.entries(productStats)
            .sort(([, qtyA], [, qtyB]) => qtyB - qtyA)
            .slice(0, 10);

        renderReportChart(sortedProducts);

        const { data: orders, error: ordersError } = await sb.from('orders')
            .select('total_amount, status, users(first_name, last_name)')
            .gte('created_at', start)
            .lte('created_at', end)
            .eq('status', 'completed');

        if (ordersError) throw ordersError;

        const perfMap = new Map();
        (orders || []).forEach(o => {
            const name = o.users ? `${o.users.first_name || ''} ${o.users.last_name || ''}`.trim() : 'Sans assignation';
            const current = perfMap.get(name) || { count: 0, total: 0 };
            current.count += 1;
            current.total += toNumber(o.total_amount);
            perfMap.set(name, current);
        });

        const perfRows = Array.from(perfMap.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([name, stats]) => `
                <tr>
                    <td>${escapeHtml(name)}</td>
                    <td class="text-center">${stats.count}</td>
                    <td class="text-center font-bold">${formatMoney(stats.total)}</td>
                    <td class="text-center">${formatMoney(stats.count ? stats.total / stats.count : 0)}</td>
                </tr>
            `).join('');

        document.getElementById('emp-perf-list').innerHTML = perfRows || '<tr><td colspan="4" class="text-center text-muted">Aucune donnée.</td></tr>';

        const { data: losses, error: lossError } = await sb.from('stock_logs')
            .select('change_amount, reason, created_at, products(name)')
            .in('reason', ['damage', 'waste'])
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false })
            .limit(20);

        if (lossError) throw lossError;

        const totalLoss = (losses || []).reduce((sum, l) => sum + Math.abs(toNumber(l.change_amount)), 0);
        document.getElementById('loss-total').textContent = `Total: ${totalLoss}`;

        const lossRows = (losses || []).map(l => `
            <tr>
                <td class="text-muted">${formatDate(l.created_at)}</td>
                <td>${escapeHtml(l.products?.name || 'Produit')}</td>
                <td class="text-center">${l.reason === 'damage' ? 'Dégât' : 'Perte'}</td>
                <td class="text-center font-bold">${Math.abs(toNumber(l.change_amount))}</td>
            </tr>
        `).join('');

        document.getElementById('loss-list').innerHTML = lossRows || '<tr><td colspan="4" class="text-center text-muted">Aucune donnée.</td></tr>';

    } catch (e) {
        console.error('Erreur Reports:', e);
        alert('Impossible de charger les rapports.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function renderReportChart(dataArray) {
    const ctx = document.getElementById('topProductsChart').getContext('2d');
    
    const colors = [
        '#c85c2a', '#d47238', '#e2904f', '#efad77',
        '#2f6f6a', '#3b827b', '#5aa39b',
        '#1d4ed8', '#3b82f6', '#60a5fa'
    ];

    if (reportChart) reportChart.destroy();

    reportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dataArray.map(d => d[0]),
            datasets: [{
                label: 'Unités Vendues',
                data: dataArray.map(d => d[1]),
                backgroundColor: colors,
                borderRadius: 4,
                barPercentage: 0.7
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#fff',
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(15, 23, 42, 0.08)' },
                    ticks: { color: '#475569' }
                },
                y: {
                    grid: { display: false },
                    ticks: { 
                        color: '#0f172a', 
                        font: { weight: '600' }
                    }
                }
            }
        }
    });
}
