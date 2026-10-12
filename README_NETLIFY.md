# Reign — déploiement 100 % Netlify

Ce paquet remplace le serveur Python par des Netlify Functions. Il utilise Netlify Blobs pour conserver le catalogue suivi et l'historique des relevés. Le fournisseur de données est Keepa pour Amazon France uniquement.

## Déployer sans Render

1. Décompresse ce ZIP sur un ordinateur.
2. Crée un dépôt GitHub (privé recommandé) et téléverse le contenu de ce dossier à la racine du dépôt. Il faut téléverser `reign.html`, `netlify.toml`, `package.json` et le dossier `netlify/`.
3. Ouvre https://app.netlify.com/ et choisis **Add new site → Import an existing project**.
4. Connecte GitHub et sélectionne ton dépôt.
5. Paramètres de build : Build command `npm install`; Publish directory `.`. Le dossier des fonctions est défini dans `netlify.toml`.
6. Dans **Site configuration → Environment variables**, ajoute `KEEPA_API_KEY` avec ta clé API Keepa. Ajoute aussi `KEEPA_DOMAIN` avec la valeur `4` si tu veux expliciter Amazon France. Ne mets jamais la clé dans le HTML ni dans GitHub.
7. Lance un nouveau déploiement après avoir enregistré les variables.
8. Dans Netlify, ouvre **Functions** : `scheduled-poll` doit apparaître comme fonction planifiée. Le calendrier est toutes les 6 heures (UTC), uniquement sur le déploiement publié.
9. Ouvre ton URL Netlify puis vérifie `/api/status` et `/api/products`.

## Test rapide

- `https://TON-SITE.netlify.app/api/status` : `configured` doit être `true` après ajout de la clé.
- Dans le site, ajoute un lien de produit Amazon.fr ou son ASIN.
- Le bouton de relevé manuel appelle `/api/poll` et traite jusqu'à 8 produits par exécution pour respecter les limites des fonctions.

## Limites importantes

- Les fonctions planifiées Netlify ont une limite d'exécution de 30 secondes. Cette version traite jusqu'à 8 produits par passage planifié. Pour un catalogue plus grand, il faut mettre en place une file de tâches par lots (par exemple une fonction de fond) et/ou une planification plus fréquente, en respectant les quotas Keepa.
- Keepa fournit les prix/historiques Amazon, pas tous les marchands ni tous les composants de toutes les boutiques.
- Le plus bas affiché est le plus bas de l'historique Keepa importé et conservé pour ce produit; ce n'est pas une garantie du prix le plus bas chez tous les revendeurs.
- Les clés API sont des secrets facturables : surveille le quota et le coût de Keepa.
- Le stockage est dans Netlify Blobs, partagé entre les fonctions du site. Pour de gros volumes ou des requêtes relationnelles avancées, préférer une vraie base de données.
