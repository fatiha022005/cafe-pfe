const loginForm = document.getElementById('login-form');
const feedback = document.getElementById('feedback');
const btn = document.getElementById('btn-login');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Loading State
    feedback.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        await login(email, password);
        // Redirection gérée dans auth.js
    } catch (error) {
        btn.disabled = false;
        btn.textContent = 'Se connecter';
        feedback.textContent = error.message || "Identifiants incorrects.";
        feedback.classList.remove('hidden');
    }
});
