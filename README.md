# EventFlow

Application web de **documentation technique événementielle** : gestion de projets, équipements (devices), baies (racks), emplacements (slots), connexions câblées et liens entre baies, avec authentification et export PDF côté API.

- **Backend** : PHP 8.3 (PDO MySQL, sessions), API REST JSON sous le préfixe `/api/ef/`.
- **Frontend** : interface statique dans `public/` (HTML, CSS, JS).
- **Base de données** : MySQL 8 (schéma dans `migrations/`).

## Prérequis

- PHP ≥ 8.3 avec les extensions : `json`, `mysqli`, `pdo`, `pdo_mysql`, `session`
- Composer
- MySQL 8 (serveur accessible avec les identifiants configurés dans `.env`)

## Installation rapide

1. Créer une base MySQL vide et un utilisateur avec les droits sur cette base.

2. À la racine du dépôt :

   ```bash
   composer install
   cp .env.example .env
   ```

3. Éditer `.env` : `DB_DSN`, `DB_USER`, `DB_PASS`, et `APP_SECRET` (chaîne aléatoire suffisamment longue en production).

4. Appliquer les migrations :

   ```bash
   bash scripts/migrate.sh
   ```

## Développement local

Lancer le serveur HTTP intégré de PHP (document root `public/`, routage décrit dans `public/router.php`) :

```bash
php -S 0.0.0.0:8080 -t public public/router.php
```

Ouvrir [http://localhost:8080/](http://localhost:8080/) — les requêtes vers `/api/ef/…` sont traitées par l’API ; les autres URLs servent l’application SPA (`index.html`).

## Déploiement production

Pointer le **document root** du serveur web (Nginx, Apache, etc.) vers le dossier `public/`. Un exemple de configuration Nginx est fourni dans `deploy/nginx-eventflow.conf.example` (adapter le socket PHP-FPM, souvent `/run/php/php8.3-fpm.sock`).

Instructions détaillées : [`deploy/INSTALL.txt`](deploy/INSTALL.txt).

### Sauvegarde (optionnel)

Définir `DB_HOST` et `DB_NAME` dans `.env`, puis :

```bash
bash scripts/backup.sh
```

## Structure du dépôt

| Élément | Rôle |
|--------|------|
| `bootstrap.php` | Autoload Composer, chargement de `config.php`, initialisation PDO |
| `config.php` | Variables d’environnement (`.env`) et configuration BDD |
| `public/` | Point d’entrée web (`index.php`, `router.php`, assets, SPA) |
| `src/` | Namespace `EventFlow\` — routeur, handlers API, auth, accès BDD |
| `migrations/` | Scripts SQL d’initialisation / évolution du schéma |
| `scripts/` | `migrate.sh` / `migrate.php`, `backup.sh` |

## API (aperçu)

Toutes les routes API sont préfixées par `/api/ef/`.

- **Auth** : `register`, `login`, `logout`, `me`
- **Ressources CRUD** : `projects`, `devices`, `racks`, `slots`, `connections`, `rack-links`
- **Export** : `GET /api/ef/export/pdf` (données pour export PDF)

Le détail des méthodes HTTP et des chemins est défini dans [`src/Routes.php`](src/Routes.php).

## Licence

Voir le dépôt et les fichiers `composer.json` / dépendances pour les mentions de licence des bibliothèques tierces.
