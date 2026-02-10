const ICON_MOON = '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>';
const ICON_SUN = '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.9 4.9l1.4 1.4"></path><path d="M17.7 17.7l1.4 1.4"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.9 19.1l1.4-1.4"></path><path d="M17.7 6.3l1.4-1.4"></path></svg>';

const App = {
    state: {
        currentUser: null,
        currentView: 'dashboard'
    },
    
    ui: {
        mainView: document.getElementById('main-view'),
        pageTitle: document.getElementById('page-title'),
        navLinks: document.querySelectorAll('.nav-link'),
        userDisplay: document.getElementById('user-display'),
        headerDate: document.getElementById('header-date'),
        themeToggle: document.getElementById('theme-toggle')
    },

    async init() {
        this.initTheme();
        this.updateDate();
        await this.loadUser();
        this.bindEvents();
        this.router('dashboard');
    },

    bindEvents() {
        this.ui.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                if (view) this.router(view);
            });
        });

        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            if (confirm('Se déconnecter ?')) await logout();
        });

        this.ui.themeToggle?.addEventListener('click', () => {
            const next = getTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
            setTheme(next);
            this.updateThemeLabel();
        });
    },

    async router(viewName) {
        this.ui.navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
        this.ui.mainView.classList.remove('fade-in');
        this.ui.mainView.innerHTML = '<div class="loader-spinner"></div>';
        
        const titles = {
            dashboard: 'Tableau de Bord',
            products: 'Catalogue Produits',
            orders: 'Historique Commandes',
            users: 'Gestion Équipe',
            reports: 'Analytique'
        };
        this.ui.pageTitle.textContent = titles[viewName] || 'Admin';

        try {
            const renderer = window[`render${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`];
            if (typeof renderer === 'function') {
                await renderer();
            } else {
                this.ui.mainView.innerHTML = '<div class="error-state">Vue non implémentée</div>';
            }
        } catch (error) {
            console.error('Render Error:', error);
            this.ui.mainView.innerHTML = `<div class="error-state">Erreur: ${escapeHtml(error.message)}</div>`;
        } finally {
            void this.ui.mainView.offsetWidth;
            this.ui.mainView.classList.add('fade-in');
        }
    },

    async loadUser() {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            this.state.currentUser = user;
            this.ui.userDisplay.textContent = user.email;
        }
    },

    updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (this.ui.headerDate) {
            this.ui.headerDate.textContent = new Date().toLocaleDateString(CONFIG.LOCALE, options);
        }
    },

    initTheme() {
        this.updateThemeLabel();
    },

    updateThemeLabel() {
        const el = this.ui.themeToggle;
        if (!el) return;
        const isDark = getTheme() === THEMES.DARK;
        el.setAttribute('data-theme', isDark ? 'dark' : 'light');
        el.querySelector('.theme-label').textContent = isDark ? 'Latte' : 'Noir Café';
        el.querySelector('.theme-icon').innerHTML = isDark ? ICON_SUN : ICON_MOON;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
