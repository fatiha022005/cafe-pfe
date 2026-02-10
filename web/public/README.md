# CaféPOS - Système de Gestion Professionnel pour Cafés

## 🎯 Vue d'ensemble

CaféPOS est une application web moderne de gestion pour cafés et restaurants, construite avec HTML, CSS, JavaScript et Supabase (PostgreSQL).

## 🚀 Démarrage Rapide

### 1. Accès à l'application

L'application est accessible via `/login.html`

### 2. Identifiants de Démonstration

**Email:** `admin@cafe.local`  
**Mot de passe:** `password123`

## 📋 Fonctionnalités

### Dashboard
- **Statistiques en temps réel**: Total des ordres, revenus, utilisateurs actifs, produits
- **Filtres temporels**: Jour, Semaine, Mois, Année
- **Graphiques**: Ordres par période et heures de travail des employés
- **Données actualisables**: Synchronisation avec Supabase

### Produits
- ✅ Liste complète des produits
- ✅ Recherche en temps réel
- ✅ Ajouter/Modifier/Supprimer des produits
- ✅ Gestion des stocks
- ✅ Catégorisation
- ✅ Prix et coûts
- ✅ Statut (Disponible/Indisponible)

### Utilisateurs (Serveurs & Admins)
- ✅ Liste des utilisateurs
- ✅ Recherche
- ✅ Ajouter/Modifier/Supprimer des utilisateurs
- ✅ Rôles (Serveur/Admin)
- ✅ Codes PIN 4 chiffres
- ✅ Statuts (Actif/Inactif)

### Ordres
- ✅ Historique complet des ordres
- ✅ Statuts des ordres
- ✅ Total par commande
- ✅ Créateur de l'ordre
- ✅ Chronologie

### Rapports & Analyses
- ✅ Revenus quotidiens (graphique barres)
- ✅ Stock par catégorie (graphique pie)
- ✅ Statistiques globales
- ✅ Analyses détaillées

## 📁 Structure des Fichiers

```
public/
├── index.html                 # Page principale
├── login.html                 # Page de connexion
├── dashboard.html             # Page dashboard
├── css/
│   ├── styles.css            # Styles globaux
│   ├── login.css             # Styles login
│   ├── sidebar.css           # Navigation sidebar
│   ├── forms.css             # Formulaires & modales
│   ├── tables.css            # Tableaux
│   └── charts.css            # Graphiques
├── js/
│   ├── config.js             # Configuration Supabase
│   ├── auth.js               # Authentification
│   ├── app.js                # Logique principale
│   ├── login.js              # Login handler
│   └── pages/
│       ├── dashboard.js      # Dashboard
│       ├── products.js       # Gestion produits
│       ├── users.js          # Gestion utilisateurs
│       ├── orders.js         # Ordres
│       └── reports.js        # Rapports
└── README.md                 # Cette fichier
```

## 🗄️ Base de Données Supabase

### Tables

**users**
- id, first_name, last_name, email, password, role, pin, status, created_at

**products**
- id, name, category, price, cost, stock, low_stock_threshold, description, status, created_at

**orders**
- id, user_id, total, status, created_at

**work_hours**
- id, user_id, date, hours, created_at

## 🔐 Authentification

- Email et mot de passe stockés dans Supabase
- Tokens générés pour les sessions
- localStorage utilisé pour maintenir les sessions
- Déconnexion automatique si token invalide

## 🎨 Thème Visuel

### Couleurs
- **Primaire**: Orange (#f97316)
- **Secondaire**: Bleu (#3b82f6)
- **Succès**: Vert (#10b981)
- **Danger**: Rouge (#ef4444)
- **Fond**: Gris très sombre (#0f172a)

### Typographie
- **Police**: System UI (Segoe UI, Roboto, etc.)
- **Contraste**: Texte blanc sur fond sombre

## 🛠️ Développement

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

## 📱 Responsive

L'application est responsive et adaptée pour:
- Desktop (1920px+)
- Tablette (768px - 1024px)
- Mobile (< 768px)

## 🔔 Notifications

Utiliser `showNotification()`:
```javascript
showNotification('Message', 'success');  // success, danger, warning, info
```

## 📊 Modales

Utiliser `showModal()`:
```javascript
showModal('Titre', 'Contenu HTML', [
    { label: 'Bouton', class: 'btn-primary', onclick: 'function()' }
]);
```

## 🚀 Déploiement sur Vercel

1. Connecter le repo GitHub
2. Configurer les variables d'environnement Supabase
3. Déployer automatiquement

## 📝 Notes

- Tous les horaires sont en UTC
- Les dates utilisent le format ISO 8601
- Les montants sont en EUR
- Les PINs sont toujours 4 chiffres

## 🐛 Debugging

Console logs disponibles avec le préfixe `[v0]`:
```javascript
console.log('[v0] Message:', data);
```

## ✅ Checklist d'Implémentation

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

## 📞 Support

Pour l'aide, consultez:
- Supabase Docs: https://supabase.com/docs
- JavaScript API: https://developer.mozilla.org
- Vercel Docs: https://vercel.com/docs
