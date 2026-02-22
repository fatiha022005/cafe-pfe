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
                <div class="table-scroll" style="max-height: 260px; overflow-y: auto;">
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
                <div class="table-scroll" style="max-height: 260px; overflow-y: auto;">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Produit</th>
                                <th>Employé</th>
                                <th class="text-center">Cause</th>
                                <th class="text-center">Qté</th>
                            </tr>
                        </thead>
                        <tbody id="loss-list">
                            <tr><td colspan="5" class="loading-text">Chargement...</td></tr>
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
        let itemsError = null;
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
                itemsError = orderIdsError;
            } else {
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
                        itemsError = fallback.error;
                    } else {
                        items = fallback.data || [];
                    }
                }
            }
        } else {
            items = primary.data || [];
        }

        if (itemsError) {
            console.error('Erreur Reports (items):', itemsError);
            items = [];
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

        try {
            const { data: orders, error: ordersError } = await sb.from('orders')
                .select('total_amount, status, users!orders_user_id_fkey(first_name, last_name)')
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
                .sort((a, b) => (b[1].total - a[1].total)
                    || (b[1].count - a[1].count)
                    || String(a[0]).localeCompare(String(b[0]))
                )
                .map(([name, stats]) => `
                    <tr>
                        <td>${escapeHtml(name)}</td>
                        <td class="text-center">${stats.count}</td>
                        <td class="text-center font-bold">${formatMoney(stats.total)}</td>
                        <td class="text-center">${formatMoney(stats.count ? stats.total / stats.count : 0)}</td>
                    </tr>
                `).join('');

            document.getElementById('emp-perf-list').innerHTML = perfRows || '<tr><td colspan="4" class="text-center text-muted">Aucune donnée.</td></tr>';
        } catch (e) {
            console.error('Erreur Reports (performance):', e);
            document.getElementById('emp-perf-list').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Erreur de chargement.</td></tr>';
        }

        let losses = [];
        try {
            const { data: lossData, error: lossError } = await sb.from('stock_logs')
                .select('product_id, user_id, change_amount, reason, created_at, notes, products(name), users(first_name, last_name)')
                .in('reason', ['damage', 'waste'])
                .gte('created_at', start)
                .lte('created_at', end);

            if (lossError) throw lossError;
            losses = lossData || [];
        } catch (e) {
            console.error('Erreur Reports (stock logs):', e);
            losses = [];
        }

        let cancelledOrders = [];
        try {
            const { data: cancelledData, error: cancelledError } = await sb.from('orders')
                .select('user_id, cancelled_at, updated_at, created_at, cancel_reason, cancel_note, users(first_name, last_name), order_items(product_id, quantity, products(name))')
                .eq('status', 'cancelled')
                .in('cancel_reason', ['damage', 'loss'])
                .gte('cancelled_at', start)
                .lte('cancelled_at', end);

            if (cancelledError) throw cancelledError;
            cancelledOrders = cancelledData || [];
        } catch (e) {
            console.error('Erreur Reports (annulations):', e);
            cancelledOrders = [];
        }

        const lossLogsIndex = (losses || []).map(l => ({
            product_id: l.product_id,
            user_id: l.user_id,
            qty: Math.abs(toNumber(l.change_amount)),
            ts: new Date(l.created_at).getTime()
        }));

        const orderLosses = (cancelledOrders || []).flatMap(o => {
            const when = o.cancelled_at || o.updated_at || o.created_at;
            const reason = o.cancel_reason === 'loss' ? 'waste' : 'damage';
            const items = o.order_items || [];
            return items.map(item => ({
                created_at: when,
                reason,
                notes: o.cancel_note,
                products: item.products || { name: 'Produit' },
                users: o.users,
                product_id: item.product_id,
                user_id: o.user_id,
                change_amount: -Math.abs(toNumber(item.quantity))
            }));
        }).filter(entry => {
            const entryTs = new Date(entry.created_at).getTime();
            return !lossLogsIndex.some(log =>
                log.product_id === entry.product_id &&
                log.qty === Math.abs(toNumber(entry.change_amount)) &&
                (log.user_id || null) === (entry.user_id || null) &&
                Math.abs(log.ts - entryTs) <= 5 * 60 * 1000
            );
        });

        const allLosses = [...(losses || []), ...orderLosses];
        const totalLoss = allLosses.reduce((sum, l) => sum + Math.abs(toNumber(l.change_amount)), 0);
        document.getElementById('loss-total').textContent = `Total: ${totalLoss}`;

        const recentLosses = allLosses
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20);

        const toCauseLabel = (entry) => {
            const raw = (entry?.notes || '').toString().trim().toLowerCase();
            if (raw) {
                if (raw.includes('renvers')) return 'Renversé';
                if (raw.includes('casse')) return 'Cassé';
                if (raw.includes('changement')) return 'Changement';
                return escapeHtml(entry.notes);
            }
            if (entry?.reason === 'damage') return 'Dégât';
            if (entry?.reason === 'waste') return 'Perte';
            return '—';
        };

        const lossRows = (recentLosses || []).map(l => {
            const empName = l.users ? `${l.users.first_name || ''} ${l.users.last_name || ''}`.trim() : '';
            return `
            <tr>
                <td class="text-muted">${formatDate(l.created_at)}</td>
                <td>${escapeHtml(l.products?.name || 'Produit')}</td>
                <td>${escapeHtml(empName || '—')}</td>
                <td class="text-center">${toCauseLabel(l)}</td>
                <td class="text-center font-bold">${Math.abs(toNumber(l.change_amount))}</td>
            </tr>
        `;
        }).join('');

        document.getElementById('loss-list').innerHTML = lossRows || '<tr><td colspan="5" class="text-center text-muted">Aucune donnée.</td></tr>';

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
                    ticks: {
                        color: '#475569',
                        stepSize: 10,
                        precision: 0
                    }
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
