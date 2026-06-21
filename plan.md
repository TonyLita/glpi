# Documentation fonctionnelle — glpi-reinit-app

## Architecture générale

Application React (Vite) en deux espaces :
- **Frontoffice** (`/frontoffice`) — accès libre
- **Backoffice** (`/backoffice`) — protégé par code unique (`VITE_BACKOFFICE_CODE`)

Deux couches API distinctes :
- **API v1** (`/apirest`) — session token via `user_token` / `App-Token`
- **API v2** (`/apiv2`) — OAuth 2.0 JWT (HL API GLPI v2)

Backend Spring Boot (port 8081, SQLite) — non utilisé par le frontend dans l'état actuel.

---

## Configuration

### Variables d'environnement (`.env`)

| Variable | Usage | Défaut |
|---|---|---|
| `VITE_GLPI_BASE_URL` | Base URL API v1 | `/apirest` |
| `VITE_GLPI_APP_TOKEN` | App-Token GLPI | `''` |
| `VITE_GLPI_USER_TOKEN` | user_token GLPI | `''` |
| `VITE_BACKOFFICE_CODE` | Code accès backoffice | `GLPI-BO-2026` |

### Backend (`backend/src/main/resources/application.yml`)

| Clé | Valeur |
|---|---|
| `server.port` | `8081` |
| `spring.datasource.url` | `jdbc:sqlite:./data/glpi_reinit.db` |
| `management.endpoints` | `health`, `info` |

---

## Constantes

### `src/constants/itemtypes.js`
`REINIT_TYPES` — liste des itemtypes supprimés lors de la réinitialisation :
Ticket, Problem, Change, Computer, Monitor, Printer, Phone, Peripheral, NetworkEquipment, Software, Document, Contract.

### `src/constants/selectOptions.js`
- `ASSET_ELEMENT_TYPES` — Computer, Monitor, Printer, Phone, Peripheral, NetworkEquipment
- `BROWSER_ITEM_TYPES` — tous les types consultables dans DataBrowser
- `IMPORT_ITEM_TYPES` — tous les types importables via CsvImport
- `TICKET_URGENCY_OPTIONS` / `TICKET_IMPACT_OPTIONS` — valeurs 1→5

---

## Couche API

### `src/api/config.js`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Construit les headers HTTP (App-Token, Session-Token ou Authorization) | `src/api/config.js` | `buildHeaders(sessionToken?)` | utilisé par toutes les fonctions API | — | — |
| Instance Axios configurée sur `VITE_GLPI_BASE_URL` | `src/api/config.js` | `apiClient` | idem | — | — |

---

### `src/api/session.js`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Ouvre une session GLPI et retourne le `session_token` | `src/api/session.js` | `initSession()` | `src/api/config.js` | `buildHeaders()` / `apiClient` | GET `/initSession` |
| Ferme la session GLPI active | `src/api/session.js` | `killSession(sessionToken)` | `src/api/config.js` | `buildHeaders(sessionToken)` / `apiClient` | GET `/killSession` |

---

### `src/api/items.js`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Liste paginée d'items (plage fixe ou auto-pagination) | `src/api/items.js` | `listItems(sessionToken, itemtype, start?, end?)` | `src/api/config.js` | `buildHeaders` / `apiClient` | GET `/:itemtype?range=start-end` |
| Récupère tous les IDs d'un itemtype (pagination auto) | `src/api/items.js` | `getAllIds(sessionToken, itemtype)` | `src/api/items.js` | `listItems()` | GET `/:itemtype` (via listItems) |
| Récupère le nom d'un item par son ID | `src/api/items.js` | `getItemNameById(sessionToken, itemtype, id)` | `src/api/config.js` | `buildHeaders` / `apiClient` | GET `/:itemtype/:id` |
| Suppression définitive par lots (`force_purge: true`) | `src/api/items.js` | `deleteItemsBatch(sessionToken, itemtype, ids, batchSize?)` | `src/api/config.js` | `buildHeaders` / `apiClient` | DELETE `/:itemtype` body `{input:[{id},...], force_purge:true}` |
| Création par lots | `src/api/items.js` | `createItems(sessionToken, itemtype, inputs, batchSize?)` | `src/api/config.js` | `buildHeaders` / `apiClient` | POST `/:itemtype` body `{input:[...]}` |

---

### `src/api/tickets.js`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Crée un ticket GLPI, retourne `{id, raw}` | `src/api/tickets.js` | `createTicket(sessionToken, payload)` | `src/api/config.js` | `buildHeaders` / `apiClient` | POST `/Ticket` body `{input:[payload]}` |
| Lie un ticket à plusieurs items GLPI | `src/api/tickets.js` | `linkTicketItems(sessionToken, ticketId, items)` | `src/api/config.js` | `buildHeaders` / `apiClient` | POST `/Item_Ticket` (fallback `/Ticket_Item`) body `{input:[...]}` |

---

### `src/api/v2.js`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Obtient un access_token JWT via OAuth 2.0 password grant | `src/api/v2.js` | `getTokenV2(clientId, clientSecret, username, password)` | `src/api/v2.js` | `tokenClient` (axios `/apitoken`) | POST `/apitoken` form `grant_type=password` |
| Liste les items d'un type via HL API v2 | `src/api/v2.js` | `listItemsV2(oauthToken, itemtype)` | `src/api/v2.js` | `v2Client` + `v2Headers(oauthToken)` | GET `/apiv2/Tools/:itemtype` |
| Supprime un item unitaire via HL API v2 | `src/api/v2.js` | `deleteItemV2(oauthToken, itemtype, id)` | `src/api/v2.js` | `v2Client` + `v2Headers(oauthToken)` | DELETE `/apiv2/Tools/:itemtype/:id` |

---

## Composants Backoffice

### `src/features/backoffice/pages/BackofficePage.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Vérifie le code d'accès backoffice (sessionStorage) | `BackofficePage.jsx` | `handleUnlock(e)` | — (sessionStorage local) | — | — |
| Déconnexion backoffice, redirect frontoffice | `BackofficePage.jsx` | `handleLogout()` | — | — | — |

Routes internes : `/backoffice`, `/backoffice/tickets`, `/backoffice/reinit`, `/backoffice/reinit-v2`, `/backoffice/import`, `/backoffice/browse`, `/backoffice/api`, `/backoffice/bulk-import`

---

### `src/features/backoffice/components/ApiHealth.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Teste la connexion API GLPI (initSession + killSession) | `ApiHealth.jsx` | `runHealthCheck()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` + GET `/killSession` |

---

### `src/features/backoffice/components/ReInitButton.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Réinitialise toutes les données GLPI (suppression batch tous REINIT_TYPES) | `ReInitButton.jsx` | `handleReInit()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite handleReInit) | `ReInitButton.jsx` | `handleReInit()` | `src/api/items.js` | `getAllIds(token, itemtype)` | GET `/:itemtype` (pagination auto) |
| — (suite handleReInit) | `ReInitButton.jsx` | `handleReInit()` | `src/api/items.js` | `deleteItemsBatch(token, itemtype, ids)` | DELETE `/:itemtype` body `{input, force_purge:true}` |

---

### `src/features/backoffice/components/ReInitV2Button.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Obtient le token OAuth v2 depuis les identifiants saisis | `ReInitV2Button.jsx` | `handleGetToken()` | `src/api/v2.js` | `getTokenV2(clientId, secret, user, pass)` | POST `/apitoken` |
| Réinitialise toutes les données via API v2 (listItemsV2 + deleteItemV2) | `ReInitV2Button.jsx` | `handleReInitV2()` | `src/api/v2.js` | `listItemsV2(token, itemtype)` | GET `/apiv2/Tools/:itemtype` |
| — (suite handleReInitV2) | `ReInitV2Button.jsx` | `handleReInitV2()` | `src/api/v2.js` | `deleteItemV2(token, itemtype, id)` | DELETE `/apiv2/Tools/:itemtype/:id` |
| Remet le composant à l'état initial (creds vides, logs effacés) | `ReInitV2Button.jsx` | `handleReset()` | — (état local) | — | — |

Flux d'états : `CREDS` → `TOKEN_OK` → `CONFIRM` → `RUNNING` → `DONE`

---

### `src/features/backoffice/components/CsvImport.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Parse le fichier CSV sélectionné et prévisualise les lignes | `CsvImport.jsx` | `handleFile(e)` | `src/utils/csv.js` | `parseCsv(text)` | — (local) |
| Importe les lignes CSV vers l'itemtype sélectionné | `CsvImport.jsx` | `handleImport()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite handleImport) | `CsvImport.jsx` | `handleImport()` | `src/api/items.js` | `createItems(token, itemtype, rows)` | POST `/:itemtype` body `{input:[...]}` |

---

### `src/features/backoffice/components/DataBrowser.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Charge une page d'items du type sélectionné | `DataBrowser.jsx` | `loadData(nextPage)` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite loadData) | `DataBrowser.jsx` | `loadData(nextPage)` | `src/api/items.js` (via `src/api/glpi.js`) | `listItems(token, itemtype, start, end)` | GET `/:itemtype?range=start-end` |
| Exporte les résultats filtrés en JSON | `DataBrowser.jsx` | `exportJson()` | — (Blob/URL local) | — | — |

---

### `src/features/backoffice/components/TicketsPage.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Charge les 50 premiers tickets GLPI | `TicketsPage.jsx` | `loadTickets()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite loadTickets) | `TicketsPage.jsx` | `loadTickets()` | `src/api/items.js` | `listItems(token, 'Ticket', 0, 49)` | GET `/Ticket?range=0-49` |

---

### `src/features/backoffice/components/BulkImport.jsx`

Import groupé 3 feuilles CSV + ZIP d'images. Flux : Assets → Tickets → Coûts → Images.

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Parse les 3 CSV et lance l'import complet | `BulkImport.jsx` | `handleImport()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| Charge les index de déduplication assets existants | `BulkImport.jsx` | `buildExistingAssetsIndex(token)` | `src/api/items.js` | `listItems(token, itemtype, 0, 499)` | GET `/:itemtype?range=0-499` |
| Crée ou retrouve un item par nom (Location, Manufacturer, State, Model…) | `BulkImport.jsx` | `getOrCreateByName(token, itemtype, label, cache)` | `src/api/items.js` | `listItems(token, itemtype, 0, 999)` + `createItems(token, itemtype, [{name}])` | GET `/:itemtype` + POST `/:itemtype` |
| Crée ou retrouve un utilisateur GLPI par nom affiché | `BulkImport.jsx` | `getOrCreateUserByDisplayName(token, displayName, cache)` | `src/api/items.js` | `listItems(token, 'User', 0, 999)` + `createItems(token, 'User', [payload])` | GET `/User` + POST `/User` |
| Assure la visibilité d'un State pour un itemtype | `BulkImport.jsx` | `ensureStateVisibilityForItemtype(token, stateId, itemtype, cache)` | `src/api/items.js` | `listItems(token, 'DropdownVisibility', 0, 999)` + `createItems(token, 'DropdownVisibility', [payload])` | GET `/DropdownVisibility` + POST `/DropdownVisibility` |
| Crée les assets regroupés par itemtype | `BulkImport.jsx` | `handleImport()` (boucle Feuille 1) | `src/api/items.js` | `createItems(token, itemtype, payloads)` | POST `/:itemtype` body `{input:[...]}` |
| Crée les tickets (avec déduplication fingerprint) | `BulkImport.jsx` | `handleImport()` (boucle Feuille 2) | `src/api/tickets.js` | `createTicket(token, payload)` | POST `/Ticket` |
| Lie les items au ticket | `BulkImport.jsx` | `handleImport()` (boucle Feuille 2) | `src/api/tickets.js` | `linkTicketItems(token, ticketId, linked)` | POST `/Item_Ticket` (fallback `/Ticket_Item`) |
| Crée les coûts de ticket (avec fallback ITILCost) | `BulkImport.jsx` | `createTicketCost(token, ticketId, row)` | `src/api/config.js` | `apiClient.post('/TicketCost', ...)` + fallback `apiClient.post('/ITILCost', ...)` | POST `/TicketCost` (fallback POST `/ITILCost`) |
| Upload image → Document GLPI + liaison Document_Item | `BulkImport.jsx` | `uploadImageForItem(token, itemtype, itemId, blob, filename)` | `src/api/config.js` | `apiClient.post('/Document/', formData)` + `apiClient.post('/Document_Item', ...)` (fallback `/Item_Document`) | POST `/Document/` multipart + POST `/Document_Item` |
| Convertit une image non-JPEG en JPEG via Canvas | `BulkImport.jsx` | `prepareImageForGlpi(blob, filename)` | — (Canvas API local) | — | — |

---

## Composants Frontoffice

### `src/features/frontoffice/components/ElementsListPage.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Charge tous les assets (ASSET_ELEMENT_TYPES) avec pagination 0-99 | `ElementsListPage.jsx` | `loadElements()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite loadElements) | `ElementsListPage.jsx` | `loadElements()` | `src/api/items.js` | `listItems(token, itemtype, 0, 99)` | GET `/:itemtype?range=0-99` |

Filtres locaux : type, ID, serial, texte libre.

---

### `src/features/frontoffice/components/CreateTicketPage.jsx`

| Définition | Fichier | Fonction | Interface liée (fichier) | Fonction interface | Fonction service |
|---|---|---|---|---|---|
| Charge tous les assets disponibles pour association | `CreateTicketPage.jsx` | `loadElements()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite loadElements) | `CreateTicketPage.jsx` | `loadElements()` | `src/api/items.js` | `listItems(token, itemtype, 0, 99)` | GET `/:itemtype?range=0-99` |
| Crée le ticket puis lie les éléments sélectionnés | `CreateTicketPage.jsx` | `submitTicket()` | `src/api/session.js` | `initSession()` / `killSession(token)` | GET `/initSession` / GET `/killSession` |
| — (suite submitTicket) | `CreateTicketPage.jsx` | `submitTicket()` | `src/api/tickets.js` | `createTicket(token, {name, content, urgency, impact})` | POST `/Ticket` |
| — (suite submitTicket) | `CreateTicketPage.jsx` | `submitTicket()` | `src/api/tickets.js` | `linkTicketItems(token, created.id, selected)` | POST `/Item_Ticket` |

---

## Résumé des endpoints GLPI utilisés

| Méthode | Endpoint | Usage |
|---|---|---|
| GET | `/initSession` | Ouvrir une session (user_token + App-Token) |
| GET | `/killSession` | Fermer la session |
| GET | `/:itemtype?range=X-Y` | Lister des items (paginé) |
| GET | `/:itemtype/:id` | Récupérer un item par ID |
| POST | `/:itemtype` | Créer des items en batch |
| DELETE | `/:itemtype` | Supprimer des items en batch (force_purge) |
| POST | `/Ticket` | Créer un ticket |
| POST | `/Item_Ticket` | Lier items à un ticket (fallback `/Ticket_Item`) |
| POST | `/TicketCost` | Créer un coût de ticket (fallback `/ITILCost`) |
| POST | `/Document/` | Upload d'un document (multipart) |
| POST | `/Document_Item` | Lier un document à un item (fallback `/Item_Document`) |
| POST | `/apitoken` | Obtenir un token JWT OAuth v2 |
| GET | `/apiv2/Tools/:itemtype` | Lister items via API v2 |
| DELETE | `/apiv2/Tools/:itemtype/:id` | Supprimer un item via API v2 |

---

## Routes frontend

| Chemin | Composant | Accès |
|---|---|---|
| `/` | redirect → `/frontoffice` | — |
| `/frontoffice` | `FrontofficePage` + redirect → `create` | Libre |
| `/frontoffice/create` | `CreateTicketPage` | Libre |
| `/frontoffice/elements` | `ElementsListPage` | Libre |
| `/backoffice` | `BackofficePage` + `BackofficeHome` | Code unique |
| `/backoffice/tickets` | `TicketsPage` | Code unique |
| `/backoffice/reinit` | `ReInitButton` | Code unique |
| `/backoffice/reinit-v2` | `ReInitV2Button` | Code unique |
| `/backoffice/import` | `CsvImport` | Code unique |
| `/backoffice/browse` | `DataBrowser` | Code unique |
| `/backoffice/api` | `ApiHealth` | Code unique |
| `/backoffice/bulk-import` | `BulkImport` | Code unique |

# 1 

#calcule et filtrage des modes :
dans #MouvementController.java : ligne 130 -> 140 (getId -> getCreatedAt)





