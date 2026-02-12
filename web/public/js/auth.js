// Auth Controller
const checkSession = async () => {
    const { data: { session } } = await sb.auth.getSession();
    const isLoginPage = window.location.pathname.includes('login.html');

    if (!session && !isLoginPage) return window.location.href = 'login.html';
    if (session && isLoginPage) return window.location.href = 'index.html';

    if (session && !isLoginPage) {
        const { data: profile, error } = await sb
            .from('users')
            .select('role, is_active')
            .eq('auth_user_id', session.user.id)
            .single();

        if (error || profile?.role !== 'admin' || profile?.is_active === false) {
            await sb.auth.signOut();
            return window.location.href = 'login.html';
        }
    }
    
    return session;
};

// Initialisation immédiate
document.addEventListener('DOMContentLoaded', checkSession);

const login = async (email, password) => {
    try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: profile, error: profileError } = await sb
            .from('users')
            .select('role')
            .eq('auth_user_id', data.user.id)
            .single();

        if (profileError || profile?.role !== 'admin') {
            await sb.auth.signOut();
            throw new Error('Accès non autorisé. Contactez un administrateur.');
        }

        window.location.href = 'index.html';
    } catch (err) {
        console.error('Login failed:', err);
        throw err;
    }
};

const logout = async () => {
    await sb.auth.signOut();
    window.location.href = 'login.html';
};
