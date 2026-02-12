# CaféPOS - Système de Gestion Professionnel pour Cafés

## ðŸŽ¯ Vue d'ensemble

CaféPOS est une application web moderne de gestion pour cafés et restaurants, construite avec HTML, CSS, JavaScript et Supabase (PostgreSQL).

## ðŸš€ Démarrage Rapide

### 1. Accès à l'application

L'application est accessible via `/login.html`

### 2. Identifiants de Démonstration

**Email:** `admin@cafe.local`  
**Mot de passe:** `password123`

## ðŸ“‹ Fonctionnalités

### Dashboard
- **Statistiques en temps réel**: Total des ordres, revenus, utilisateurs actifs, produits
- **Filtres temporels**: Jour, Semaine, Mois, Année
- **Graphiques**: Ordres par période et heures de travail des employés
- **Données actualisables**: Synchronisation avec Supabase

### Produits
- âœ… Liste complète des produits
- âœ… Recherche en temps réel
- âœ… Ajouter/Modifier/Supprimer des produits
- âœ… Gestion des stocks
- âœ… Catégorisation
- âœ… Prix et coûts
- âœ… Statut (Disponible/Indisponible)

### Utilisateurs (Serveurs & Admins)
- âœ… Liste des utilisateurs
- âœ… Recherche
- âœ… Ajouter/Modifier/Supprimer des utilisateurs
- âœ… Rôles (Serveur/Admin)
- âœ… Codes PIN 4 chiffres
- âœ… Statuts (Actif/Inactif)

### Ordres
- âœ… Historique complet des ordres
- âœ… Statuts des ordres
- âœ… Total par commande
- âœ… Créateur de l'ordre
- âœ… Chronologie

### Rapports & Analyses
- âœ… Revenus quotidiens (graphique barres)
- âœ… Stock par catégorie (graphique pie)
- âœ… Statistiques globales
- âœ… Analyses détaillées

## ðŸ“ Structure des Fichiers

```
public/
â”œâ”€â”€ index.html                 # Page principale
â”œâ”€â”€ login.html                 # Page de connexion
â”œâ”€â”€ dashboard.html             # Page dashboard
â”œâ”€â”€ css/
â”‚   â”œâ”€â”€ styles.css            # Styles globaux
â”‚   â”œâ”€â”€ login.css             # Styles login
â”‚   â”œâ”€â”€ sidebar.css           # Navigation sidebar
â”‚   â”œâ”€â”€ forms.css             # Formulaires & modales
â”‚   â”œâ”€â”€ tables.css            # Tableaux
â”‚   â””â”€â”€ charts.css            # Graphiques
â”œâ”€â”€ js/
â”‚   â”œâ”€â”€ config.js             # Configuration Supabase
â”‚   â”œâ”€â”€ auth.js               # Authentification
â”‚   â”œâ”€â”€ app.js                # Logique principale
â”‚   â”œâ”€â”€ login.js              # Login handler
â”‚   â””â”€â”€ pages/
â”‚       â”œâ”€â”€ dashboard.js      # Dashboard
â”‚       â”œâ”€â”€ products.js       # Gestion produits
â”‚       â”œâ”€â”€ users.js          # Gestion utilisateurs
â”‚       â”œâ”€â”€ orders.js         # Ordres
â”‚       â””â”€â”€ reports.js        # Rapports
â””â”€â”€ README.md                 # Cette fichier
```

## ðŸ—„ï¸ Base de Données Supabase

### Tables

**users**
- id, first_name, last_name, email, password, role, pin, status, created_at

**products**
- id, name, category, price, cost, stock, low_stock_threshold, description, status, created_at

**orders**
- id, user_id, total, status, created_at

**work_hours**
- id, user_id, date, hours, created_at

## ðŸ” Authentification

- Email et mot de passe stockés dans Supabase
- Tokens générés pour les sessions
- localStorage utilisé pour maintenir les sessions
- Déconnexion automatique si token invalide

## ðŸŽ¨ Thème Visuel

### Couleurs
- **Primaire**: Orange (#f97316)
- **Secondaire**: Bleu (#3b82f6)
- **Succès**: Vert (#10b981)
- **Danger**: Rouge (#ef4444)
- **Fond**: Gris très sombre (#0f172a)

### Typographie
- **Police**: System UI (Segoe UI, Roboto, etc.)
- **Contraste**: Texte blanc sur fond sombre

## ðŸ› ï¸ Développement

### Ajouter une Nouvelle Page

1. Créer un fichier HTML dans `/public`
2. Créer un fichier JS dans `/public/js/pages/`
3. Ajouter un lien dans la sidebar
4. Implémenter la fonction `loadPageName()`

### Ajouter une Table Supabase

1. Créer la table dans Supabase
2. Utiliser les fonctions Supabase:
```javascript
const { data, error } = await supabase
    .from('table_name')
    .select('*');
```

### Personnaliser les Styles

Modifier les fichiers CSS dans `/public/css/`

## ðŸ“± Responsive

L'application est responsive et adaptée pour:
- Desktop (1920px+)
- Tablette (768px - 1024px)
- Mobile (< 768px)

## ðŸ”” Notifications

Utiliser `showNotification()`:
```javascript
showNotification('Message', 'success');  // success, danger, warning, info
```

## ðŸ“Š Modales

Utiliser `showModal()`:
```javascript
showModal('Titre', 'Contenu HTML', [
    { label: 'Bouton', class: 'btn-primary', onclick: 'function()' }
]);
```

## ðŸš€ Déploiement sur Vercel

1. Connecter le repo GitHub
2. Configurer les variables d'environnement Supabase
3. Déployer automatiquement

## ðŸ“ Notes

- Tous les horaires sont en UTC
- Les dates utilisent le format ISO 8601
- Les montants sont en EUR
- Les PINs sont toujours 4 chiffres

## ðŸ› Debugging

Console logs disponibles avec le préfixe `[v0]`:
```javascript
console.log('[v0] Message:', data);
```

## âœ… Checklist d'Implémentation

- [x] Page de login
- [x] Dashboard avec statistiques
- [x] Gestion des produits
- [x] Gestion des utilisateurs
- [x] Historique des ordres
- [x] Rapports & analyses
- [x] Filtres temporels
- [x] Authentification
- [x] Notifications
- [x] Modales
- [x] Responsive design
- [x] Supabase intégration

## ðŸ“ž Support

Pour l'aide, consultez:
- Supabase Docs: https://supabase.com/docs
- JavaScript API: https://developer.mozilla.org
- Vercel Docs: https://vercel.com/docs

