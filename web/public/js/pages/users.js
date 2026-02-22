let userCache = new Map();
let currentAuthId = null;

window.renderUsers = async function() {
    const container = document.getElementById('main-view');
    container.innerHTML = `
        <div class="action-header">
            <h3>Équipe</h3>
            <div class="flex gap-2">
                <button class="btn-secondary" onclick="openAdminModal()">+ Admin Web</button>
                <button class="btn-primary" onclick="openUserModal()">+ Ajouter un serveur</button>
            </div>
        </div>
        <div class="card table-wrapper">
            <table class="table-modern">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Rôle</th>
                        <th>Email / Login</th>
                        <th>PIN (Mobile)</th>
                        <th>État</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody id="users-list"></tbody>
            </table>
        </div>
        <div id="user-modal-container"></div>
    `;
    await loadUsers();
};

async function loadUsers() {
    const { data: authData } = await sb.auth.getUser();
    currentAuthId = authData?.user?.id || null;

    const { data, error } = await sb.from('users')
        .select('id, auth_user_id, first_name, last_name, role, email, is_active, created_at')
        .order('created_at');
    if (error) {
        console.error(error);
        document.getElementById('users-list').innerHTML = '<tr><td colspan="6" class="text-center text-muted">Erreur de chargement.</td></tr>';
        return;
    }
    
    userCache = new Map((data || []).map(u => [u.id, u]));
    document.getElementById('users-list').innerHTML = (data || []).map(u => `
        <tr class="${!u.is_active ? 'opacity-50' : ''}">
            <td class="font-medium">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-neutral'}">${u.role}</span></td>
            <td class="text-muted">${escapeHtml(u.email || '-')}</td>
            <td class="font-mono">••••</td>
            <td><span class="status-dot ${u.is_active ? 'bg-success' : 'bg-danger'}"></span></td>
            <td class="text-right">
                <button class="btn-icon-sm edit-user-btn" data-id="${u.id}" aria-label="Modifier">
                    <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');

    const list = document.getElementById('users-list');
    if (!list.dataset.bound) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.edit-user-btn');
            if (btn?.dataset.id) openUserModal(btn.dataset.id);
        });
        list.dataset.bound = '1';
    }
}

window.openUserModal = function(userId = null) {
    const user = userId ? userCache.get(userId) : null;
    const isEdit = !!user;
    const isSelf = !!user?.auth_user_id && user.auth_user_id === currentAuthId;

    const modalHtml = `
        <div class="modal-backdrop" id="u-modal">
            <div class="modal-window">
                <div class="modal-head">
                    <h3>${isEdit ? 'Modifier' : 'Ajouter'} Serveur</h3>
                    <button class="close-modal" onclick="document.getElementById('u-modal').remove()">&times;</button>
                </div>
                <form id="user-form" onsubmit="handleUserSave(event)">
                    <input type="hidden" name="id" value="${user?.id || ''}">
                    <input type="hidden" name="auth_user_id" value="${user?.auth_user_id || ''}">
                    <div class="form-grid">
                        <div class="field"><label>Prénom</label><input type="text" name="first_name" value="${escapeHtml(user?.first_name || '')}" required class="input-std"></div>
                        <div class="field"><label>Nom</label><input type="text" name="last_name" value="${escapeHtml(user?.last_name || '')}" required class="input-std"></div>
                        <input type="hidden" name="role" value="server">
                        <div class="field">
                            <label>${isEdit ? 'Nouveau PIN (optionnel)' : 'Code PIN (4 chiffres)'}</label>
                            <input type="text" name="pin_code" value="" pattern="[0-9]{4}" maxlength="4" ${isEdit ? '' : 'required'} class="input-std" placeholder="${isEdit ? 'Laisser vide pour garder' : '0000'}">
                        </div>
                        <div class="field full"><label>Email (Optionnel)</label><input type="email" name="email" value="${escapeHtml(user?.email || '')}" class="input-std"></div>
                        <div class="field full">
                            <label>Statut</label>
                            <select name="is_active" class="input-std" ${isSelf ? 'disabled' : ''}>
                                <option value="true" ${user?.is_active !== false ? 'selected' : ''}>Actif</option>
                                <option value="false" ${user?.is_active === false ? 'selected' : ''}>Inactif</option>
                            </select>
                            ${isSelf ? '<small class="text-muted">Votre compte admin ne peut pas être désactivé.</small>' : ''}
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn-primary">Enregistrer</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('user-modal-container').innerHTML = modalHtml;
};

window.handleUserSave = async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const id = data.id; delete data.id;
    const authUserId = data.auth_user_id; delete data.auth_user_id;

    if (data.email) data.email = data.email.trim();
    if (data.pin_code) data.pin_code = data.pin_code.trim();
    data.is_active = data.is_active === 'true';

    if (authUserId && authUserId === currentAuthId && data.is_active === false) {
        alert('Vous ne pouvez pas désactiver votre propre compte admin.');
        return;
    }
    
    if (!data.email) data.email = null;
    if (!data.pin_code) delete data.pin_code;

    const { error } = id 
        ? await sb.from('users').update(data).eq('id', id)
        : await sb.from('users').insert(data);

    if (error) alert('Erreur: ' + error.message);
    else {
        document.getElementById('u-modal').remove();
        loadUsers();
    }
};

window.openAdminModal = function() {
    const modalHtml = `
        <div class="modal-backdrop" id="admin-modal">
            <div class="modal-window">
                <div class="modal-head">
                    <h3>Créer un Admin Web</h3>
                    <button class="close-modal" onclick="document.getElementById('admin-modal').remove()">&times;</button>
                </div>
                <form id="admin-form" onsubmit="handleAdminCreate(event)">
                    <div class="form-grid">
                        <div class="field">
                            <label>Prénom</label>
                            <input type="text" name="first_name" required class="input-std">
                        </div>
                        <div class="field">
                            <label>Nom</label>
                            <input type="text" name="last_name" required class="input-std">
                        </div>
                        <div class="field full">
                            <label>Email</label>
                            <input type="email" name="email" required class="input-std">
                        </div>
                        <div class="field">
                            <label>Mot de passe</label>
                            <input type="password" name="password" required class="input-std" minlength="8">
                        </div>
                        <div class="field">
                            <label>Confirmation</label>
                            <input type="password" name="password_confirm" required class="input-std" minlength="8">
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('admin-modal').remove()">Annuler</button>
                        <button type="submit" class="btn-primary">Créer</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('user-modal-container').innerHTML = modalHtml;
};

window.handleAdminCreate = async function(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const email = (data.email || '').trim();
    const firstName = (data.first_name || '').trim();
    const lastName = (data.last_name || '').trim();
    const password = data.password || '';
    const confirm = data.password_confirm || '';

    if (!email || !firstName || !lastName) {
        alert('Veuillez remplir tous les champs.');
        return;
    }
    if (password.length < 8) {
        alert('Mot de passe trop court (min 8 caractères).');
        return;
    }
    if (password !== confirm) {
        alert('Les mots de passe ne correspondent pas.');
        return;
    }

    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
        alert('Session invalide. Veuillez vous reconnecter.');
        return;
    }

    const res = await fetch('api/create-admin.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            email,
            password,
            first_name: firstName,
            last_name: lastName
        })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        alert(payload?.error || 'Impossible de créer l’admin.');
        return;
    }

    document.getElementById('admin-modal').remove();
    loadUsers();
};
