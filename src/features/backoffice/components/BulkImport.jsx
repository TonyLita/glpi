import { useRef, useState } from 'react';
import JSZip from 'jszip';
import { initSession, killSession } from '../../../api/session';
import { createItems, listItems } from '../../../api/items';
import { createTicket, linkTicketItems } from '../../../api/tickets';
import { apiClient, buildHeaders } from '../../../api/config';
import { parseCsv } from '../../../utils/csv';
import { STATUS } from '../../../constants/status';

// Mapping préfixe fichier -> itemtype GLPI
const PREFIX_TO_ITEMTYPE = {
  PC: 'Computer',
  MN: 'Monitor',
  PR: 'Printer',
  PH: 'Phone',
  PE: 'Peripheral',
  NE: 'NetworkEquipment',
};

const ASSET_ITEMTYPES = ['Computer', 'Monitor', 'Printer', 'Phone', 'Peripheral', 'NetworkEquipment'];

const ITEMTYPE_MODEL_FIELD = {
  Computer: 'computermodels_id',
  Monitor: 'monitormodels_id',
  Printer: 'printermodels_id',
  Phone: 'phonemodels_id',
  Peripheral: 'peripheralmodels_id',
  NetworkEquipment: 'networkequipmentmodels_id',
};

const TICKET_STATUS_TO_VALUE = {
  new: 1,
  nouveau: 1,
  assigned: 2,
  attribue: 2,
  'attribué': 2,
  planned: 3,
  planifie: 3,
  'planifié': 3,
  pending: 4,
  enattente: 4,
  solved: 5,
  resolu: 5,
  'résolu': 5,
  closed: 6,
  ferme: 6,
  'fermé': 6,
};

const TICKET_TYPE_TO_VALUE = {
  incident: 1,
  demande: 2,
  request: 2,
};

const FILE_SLOTS = [
  { key: 'assetsCsv', label: 'Feuille 1 (Assets)', accept: '.csv,text/csv' },
  { key: 'ticketsCsv', label: 'Feuille 2 (Tickets)', accept: '.csv,text/csv' },
  { key: 'costsCsv', label: 'Feuille 3 (Coûts)', accept: '.csv,text/csv' },
  { key: 'zip', label: 'ZIP des images (optionnel)', accept: '.zip,application/zip' },
];

const EXPECTED_HEADERS = {
  assetsCsv: ['Name', 'Item_Type', 'Inventory_Number'],
  ticketsCsv: ['Ref_Ticket', 'Titre', 'Description', 'Items'],
  costsCsv: ['Num_Ticket', 'Duration_second', 'Time_Cost', 'Fixed_Cost'],
};

function normalizeItemtype(raw) {
  var value = String(raw || '').trim();
  if (!value) return null;
  if (ASSET_ITEMTYPES.includes(value)) return value;

  var lower = value.toLowerCase();
  if (lower === 'ordinateur') return 'Computer';
  if (lower === 'ecran' || lower === 'écran') return 'Monitor';
  if (lower === 'imprimante') return 'Printer';
  if (lower === 'telephone' || lower === 'téléphone') return 'Phone';
  if (lower === 'peripherique' || lower === 'périphérique') return 'Peripheral';
  if (lower === 'equipement reseau' || lower === 'équipements réseau' || lower === 'équipement réseau') return 'NetworkEquipment';
  return null;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCompact(value) {
  return normalizeKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildLoginFromDisplayName(displayName) {
  var login = normalizeCompact(displayName)
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return login || null;
}

function splitDisplayName(displayName) {
  var parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return {
      realname: parts[0] || '',
      firstname: '',
    };
  }

  return {
    realname: parts[0],
    firstname: parts.slice(1).join(' '),
  };
}

function normalizeDateTime(date, hour) {
  var d = String(date || '').trim();
  var h = String(hour || '').trim();
  if (!d) return '';

  var m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  var hh = h || '00:00';
  if (/^\d{2}:\d{2}$/.test(hh)) {
    hh += ':00';
  }
  if (!/^\d{2}:\d{2}:\d{2}$/.test(hh)) {
    hh = '00:00:00';
  }
  return m[3] + '-' + m[2] + '-' + m[1] + ' ' + hh;
}

function ticketFingerprint(name, content) {
  return normalizeKey(name) + '||' + normalizeKey(content);
}

function costFingerprint(ticketId, duration, timeCost, fixedCost) {
  return [ticketId, duration, String(timeCost), String(fixedCost)].join('|');
}

function getModelItemtype(assetItemtype) {
  if (assetItemtype === 'Computer') return 'ComputerModel';
  if (assetItemtype === 'Monitor') return 'MonitorModel';
  if (assetItemtype === 'Printer') return 'PrinterModel';
  if (assetItemtype === 'Phone') return 'PhoneModel';
  if (assetItemtype === 'Peripheral') return 'PeripheralModel';
  if (assetItemtype === 'NetworkEquipment') return 'NetworkEquipmentModel';
  return null;
}

function toNumber(value, fallback) {
  var raw = String(value || '').trim();
  if (!raw) return fallback;
  var n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function priorityToUrgencyImpact(priority) {
  var p = String(priority || '').toLowerCase().trim();
  if (p === 'very low' || p === 'très basse' || p === 'très bas') return { urgency: 1, impact: 1 };
  if (p === 'low' || p === 'basse' || p === 'bas') return { urgency: 2, impact: 2 };
  if (p === 'high' || p === 'haute' || p === 'haut') return { urgency: 4, impact: 4 };
  if (p === 'very high' || p === 'très haute' || p === 'très haut') return { urgency: 5, impact: 5 };
  return { urgency: 3, impact: 3 };
}

function parseItemsCell(raw) {
  var text = String(raw || '').trim();
  if (!text) return [];

  try {
    var parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(function (v) { return String(v).trim(); }).filter(Boolean);
  } catch (e) {
    // Ignore and fallback below.
  }

  var normalized = text
    .replace(/^\[\s*/, '')
    .replace(/\s*\]$/, '')
    .replace(/"/g, '');

  if (!normalized.trim()) return [];
  return normalized.split(',').map(function (v) { return v.trim(); }).filter(Boolean);
}

function ensureHeaders(rows, expectedHeaders) {
  if (!rows || !rows.length) {
    return {
      ok: false,
      missing: expectedHeaders,
    };
  }

  var keys = Object.keys(rows[0]);
  var missing = expectedHeaders.filter(function (h) { return !keys.includes(h); });
  return {
    ok: missing.length === 0,
    missing: missing,
  };
}

function addToIndex(index, itemtype, key, id) {
  if (!key) return;
  if (!index[itemtype]) index[itemtype] = {};
  index[itemtype][String(key).trim()] = id;
}

export default function BulkImport() {
  const [files, setFiles] = useState({
    assetsCsv: null,
    ticketsCsv: null,
    costsCsv: null,
    zip: null,
  });
  const [status, setStatus] = useState(STATUS.IDLE);
  const [logs, setLogs] = useState([]);
  const refs = {
    assetsCsv: useRef(null),
    ticketsCsv: useRef(null),
    costsCsv: useRef(null),
    zip: useRef(null),
  };

  function addLog(message, type = 'info') {
    setLogs(prev => [...prev, { message, type, at: new Date() }]);
  }

  function handleFile(key, e) {
    const f = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [key]: f }));
  }

  function handleReset() {
    setFiles({ assetsCsv: null, ticketsCsv: null, costsCsv: null, zip: null });
    setLogs([]);
    setStatus(STATUS.IDLE);
    Object.values(refs).forEach(r => { if (r.current) r.current.value = ''; });
  }

  async function readCsvFile(file) {
    const text = await file.text();
    return parseCsv(text);
  }

  // Déduit l'itemtype depuis le nom du fichier image (ex: PC-LAB-002.jpeg -> Computer)
  function itemtypeFromFilename(filename) {
    const base = filename.split('/').pop();
    const prefix = base.split('-')[0]?.toUpperCase();
    return PREFIX_TO_ITEMTYPE[prefix] || null;
  }

  // Récupère le nom (sans extension) pour faire le matching avec le champ "name" GLPI
  function nameFromFilename(filename) {
    const base = filename.split('/').pop();
    return base.replace(/\.[^.]+$/, '');
  }

  function jpegFilename(filename) {
    var base = filename.split('/').pop() || filename;
    return base.replace(/\.[^.]+$/, '') + '.jpeg';
  }

  async function prepareImageForGlpi(blob, filename) {
    var outputName = jpegFilename(filename);

    if (/\.jpe?g$/i.test(filename)) {
      return {
        blob: new Blob([blob], { type: 'image/jpeg' }),
        filename: outputName,
      };
    }

    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var image = new Image();

      image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        canvas.toBlob(function (jpegBlob) {
          URL.revokeObjectURL(url);
          if (!jpegBlob) {
            reject(new Error('Conversion JPEG impossible pour ' + filename));
            return;
          }

          resolve({
            blob: jpegBlob,
            filename: outputName,
          });
        }, 'image/jpeg', 0.92);
      };

      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Lecture image impossible pour ' + filename));
      };

      image.src = url;
    });
  }

  function buildAssetPayload(row) {
    var status = String(row.Status || '').trim();
    var location = String(row.Location || '').trim();
    var manufacturer = String(row.Manufacturer || '').trim();
    var model = String(row.Model || '').trim();
    var user = String(row.User || '').trim();

    var comments = [];
    if (status) comments.push('Status: ' + status);
    if (location) comments.push('Location: ' + location);
    if (manufacturer) comments.push('Manufacturer: ' + manufacturer);
    if (model) comments.push('Model: ' + model);
    if (user) comments.push('User: ' + user);

    var payload = {
      name: String(row.Name || '').trim(),
      serial: String(row.Inventory_Number || '').trim(),
    };

    if (comments.length) {
      payload.comment = comments.join(' | ');
    }

    return payload;
  }

  async function getOrCreateByName(sessionToken, itemtype, label, cache) {
    var name = String(label || '').trim();
    if (!name) return null;

    if (!cache[itemtype]) {
      cache[itemtype] = {};
    }

    var key = normalizeCompact(name);
    if (cache[itemtype][key] !== undefined) {
      return await cache[itemtype][key];
    }

    cache[itemtype][key] = (async function () {
      var rows = await listItems(sessionToken, itemtype, 0, 999);
      for (const row of rows) {
        var rowName = row.name || row.completename || row.realname || '';
        if (normalizeCompact(rowName) === key) {
          return row.id;
        }
      }

      var created = await createItems(sessionToken, itemtype, [{ name: name }]);
      var first = Array.isArray(created) ? created[0] : created;
      return (first && first.id) ? first.id : null;
    })();

    return await cache[itemtype][key];
  }

  async function getOrCreateUserByDisplayName(sessionToken, displayName, userCache) {
    var name = String(displayName || '').trim();
    if (!name) return null;

    var key = normalizeCompact(name);
    if (userCache[key] !== undefined) {
      return await userCache[key];
    }

    userCache[key] = (async function () {
      var rows = await listItems(sessionToken, 'User', 0, 999);
      for (const row of rows) {
        var candidates = [];
        candidates.push(String(row.name || '').trim());
        candidates.push(String(row.realname || '').trim());
        candidates.push((String(row.realname || '').trim() + ' ' + String(row.firstname || '').trim()).trim());
        candidates.push((String(row.firstname || '').trim() + ' ' + String(row.realname || '').trim()).trim());

        for (const c of candidates) {
          if (normalizeCompact(c) === key) {
            return row.id;
          }
        }
      }

      var login = buildLoginFromDisplayName(name);
      if (!login) return null;

      var displayParts = splitDisplayName(name);
      var payload = {
        name: login,
        realname: displayParts.realname,
        firstname: displayParts.firstname,
        is_active: 1,
      };

      var created = await createItems(sessionToken, 'User', [payload]);
      var first = Array.isArray(created) ? created[0] : created;
      return (first && first.id) ? first.id : null;
    })();

    return await userCache[key];
  }

  async function buildExistingDocumentsSet(sessionToken) {
    var rows = await listItems(sessionToken, 'Document', 0, 999);
    var set = new Set();
    for (const row of rows) {
      var name = String(row.name || '').trim();
      if (name) {
        set.add(normalizeKey(name));
      }
    }
    return set;
  }

  async function ensureStateVisibilityForItemtype(sessionToken, stateId, visibleItemtype, visibilityCache) {
    if (!stateId || !visibleItemtype) return;

    if (!visibilityCache.ready) {
      visibilityCache.map = {};
      var rows = await listItems(sessionToken, 'DropdownVisibility', 0, 999).catch(function () { return []; });
      for (const row of rows) {
        if (String(row.itemtype || '') !== 'State') continue;
        if (Number(row.is_visible) !== 1) continue;
        var k = String(row.items_id) + '|' + String(row.visible_itemtype || '');
        visibilityCache.map[k] = true;
      }
      visibilityCache.ready = true;
    }

    var key = String(stateId) + '|' + String(visibleItemtype);
    if (visibilityCache.map[key]) {
      return;
    }

    var payload = {
      itemtype: 'State',
      items_id: stateId,
      visible_itemtype: visibleItemtype,
      is_visible: 1,
    };

    var created = await createItems(sessionToken, 'DropdownVisibility', [payload]).catch(function () { return []; });
    var first = Array.isArray(created) ? created[0] : created;
    if (first && first.id) {
      visibilityCache.map[key] = true;
    }
  }

  async function buildExistingAssetsIndex(sessionToken) {
    var byName = {};
    var byInventory = {};

    for (const itemtype of ASSET_ITEMTYPES) {
      var rows = await listItems(sessionToken, itemtype, 0, 499);
      for (const row of rows) {
        var name = String(row.name || row.completename || '').trim();
        var serial = String(row.serial || '').trim();
        if (name) addToIndex(byName, itemtype, name, row.id);
        if (serial) addToIndex(byInventory, itemtype, serial, row.id);
      }
    }

    return { byName: byName, byInventory: byInventory };
  }

  function resolveAssetId(reference, preferredItemtype, createdIndex, existingIndex) {
    var ref = String(reference || '').trim();
    if (!ref) return null;

    var candidates = preferredItemtype ? [preferredItemtype] : ASSET_ITEMTYPES;

    for (const t of candidates) {
      var idByName = createdIndex.byName[t]?.[ref] || existingIndex.byName[t]?.[ref];
      if (idByName) return { itemtype: t, id: idByName };
      var idByInventory = createdIndex.byInventory[t]?.[ref] || existingIndex.byInventory[t]?.[ref];
      if (idByInventory) return { itemtype: t, id: idByInventory };
    }

    if (!preferredItemtype) {
      return null;
    }

    for (const t of ASSET_ITEMTYPES) {
      var idByNameFallback = createdIndex.byName[t]?.[ref] || existingIndex.byName[t]?.[ref];
      if (idByNameFallback) return { itemtype: t, id: idByNameFallback };
      var idByInventoryFallback = createdIndex.byInventory[t]?.[ref] || existingIndex.byInventory[t]?.[ref];
      if (idByInventoryFallback) return { itemtype: t, id: idByInventoryFallback };
    }

    return null;
  }

  async function createTicketCost(sessionToken, ticketId, row) {
    var duration = Math.max(0, Math.round(toNumber(row.Duration_second, 0)));
    var timeCost = Math.max(0, toNumber(row.Time_Cost, 0));
    var fixedCost = Math.max(0, toNumber(row.Fixed_Cost, 0));

    var payloadTicketCost = {
      tickets_id: ticketId,
      name: 'Import coût ticket #' + ticketId,
      actiontime: duration,
      cost_time: timeCost,
      cost_fixed: fixedCost,
    };

    var res = await apiClient.post('/TicketCost', {
      input: [payloadTicketCost],
    }, {
      headers: buildHeaders(sessionToken),
    });

    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }

    // Fallback GLPI générique ITILCost selon versions.
    var payloadItilCost = {
      itemtype: 'Ticket',
      items_id: ticketId,
      name: 'Import coût ticket #' + ticketId,
      actiontime: duration,
      cost_time: timeCost,
      cost_fixed: fixedCost,
    };

    var resFallback = await apiClient.post('/ITILCost', {
      input: [payloadItilCost],
    }, {
      headers: buildHeaders(sessionToken),
    });

    if (resFallback.status >= 200 && resFallback.status < 300) {
      return resFallback.data;
    }

    throw new Error('Création coût impossible (TicketCost/ITILCost): ' + JSON.stringify(resFallback.data || res.data || {}));
  }

  function extractCreatedId(data) {
    var first = Array.isArray(data) ? data[0] : data;
    var id = first && first.id;
    var asNumber = Number(id);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
  }

  // Upload d'un document + association à l'item GLPI en 2 étapes.
  async function uploadImageForItem(sessionToken, itemtype, itemId, fileBlob, filename) {
    const form = new FormData();
    const uploadManifest = {
      input: {
        name: filename,
        _filename: [filename],
      },
    };
    form.append('uploadManifest', JSON.stringify(uploadManifest));
    form.append('filename[0]', fileBlob, filename);

    const headers = buildHeaders(sessionToken);
    delete headers['Content-Type']; // laisser le navigateur gérer multipart

    const res = await apiClient.post('/Document/', form, { headers });
    if (!(res.status >= 200 && res.status < 300)) {
      throw new Error('Upload ' + filename + ' échoué (HTTP ' + res.status + '): ' + JSON.stringify(res.data || {}));
    }

    const documentId = extractCreatedId(res.data);
    if (!documentId) {
      throw new Error('Upload ' + filename + ' réussi mais ID document introuvable: ' + JSON.stringify(res.data || {}));
    }

    const linkPayload = {
      documents_id: documentId,
      itemtype: itemtype,
      items_id: itemId,
    };

    let linkRes = await apiClient.post('/Document_Item', {
      input: [linkPayload],
    }, {
      headers: buildHeaders(sessionToken),
    });

    if (linkRes.status === 404) {
      // Certaines versions utilisent Item_Document.
      linkRes = await apiClient.post('/Item_Document', {
        input: [linkPayload],
      }, {
        headers: buildHeaders(sessionToken),
      });
    }

    if (!(linkRes.status >= 200 && linkRes.status < 300)) {
      throw new Error('Document uploadé mais liaison impossible (HTTP ' + linkRes.status + '): ' + JSON.stringify(linkRes.data || {}));
    }

    return {
      documentId: documentId,
      link: linkRes.data,
    };
  }

  async function handleImport() {
    if (!files.assetsCsv || !files.ticketsCsv || !files.costsCsv) {
      addLog('Veuillez sélectionner les 3 fichiers CSV (Feuille 1, 2, 3).', 'error');
      return;
    }

    setStatus(STATUS.RUNNING);
    setLogs([]);
    let sessionToken = null;

    try {
      addLog('Lecture des 3 fichiers CSV…');
      var assetsRows = await readCsvFile(files.assetsCsv);
      var ticketsRows = await readCsvFile(files.ticketsCsv);
      var costsRows = await readCsvFile(files.costsCsv);

      var checkAssets = ensureHeaders(assetsRows, EXPECTED_HEADERS.assetsCsv);
      var checkTickets = ensureHeaders(ticketsRows, EXPECTED_HEADERS.ticketsCsv);
      var checkCosts = ensureHeaders(costsRows, EXPECTED_HEADERS.costsCsv);

      if (!checkAssets.ok) throw new Error('Feuille 1 invalide. Colonnes manquantes: ' + checkAssets.missing.join(', '));
      if (!checkTickets.ok) throw new Error('Feuille 2 invalide. Colonnes manquantes: ' + checkTickets.missing.join(', '));
      if (!checkCosts.ok) throw new Error('Feuille 3 invalide. Colonnes manquantes: ' + checkCosts.missing.join(', '));

      addLog('→ Feuille 1: ' + assetsRows.length + ' ligne(s)', 'info');
      addLog('→ Feuille 2: ' + ticketsRows.length + ' ligne(s)', 'info');
      addLog('→ Feuille 3: ' + costsRows.length + ' ligne(s)', 'info');

      var imageEntries = [];
      if (files.zip) {
        addLog('Lecture du ZIP d\'images…');
        var zip = await JSZip.loadAsync(files.zip);
        zip.forEach(function (path, entry) {
          var baseName = entry.name.split('/').pop() || '';
          var isAppleDouble = baseName.startsWith('._');
          var isMacOsxMeta = entry.name.includes('__MACOSX/');
          if (!entry.dir && !isAppleDouble && !isMacOsxMeta && /\.(png|jpe?g|gif|webp)$/i.test(entry.name)) {
            imageEntries.push(entry);
          }
        });
        addLog('→ ' + imageEntries.length + ' image(s) trouvée(s)', 'info');
      }

      addLog('Ouverture de session GLPI…');
      sessionToken = await initSession();
      addLog('Session ouverte.', 'success');

      var refCache = {};
      var userCache = {};
      var visibilityCache = { ready: false, map: {} };

      // Dédup existants (assets/tickets/coûts/documents)
      addLog('Chargement des index de déduplication…');
      var existingIndex = await buildExistingAssetsIndex(sessionToken);
      var existingTickets = await listItems(sessionToken, 'Ticket', 0, 999);
      var existingTicketMap = {};
      for (const t of existingTickets) {
        var fp = ticketFingerprint(t.name || '', t.content || '');
        if (fp !== '||') {
          existingTicketMap[fp] = t.id;
        }
      }
      var existingCosts = await listItems(sessionToken, 'TicketCost', 0, 999).catch(function () { return []; });
      var existingCostSet = new Set();
      for (const c of existingCosts) {
        existingCostSet.add(costFingerprint(c.tickets_id, Number(c.actiontime) || 0, Number(c.cost_time) || 0, Number(c.cost_fixed) || 0));
      }
      var existingDocumentNames = await buildExistingDocumentsSet(sessionToken);

      // 1) Feuille 1: Assets (parallèle)
      var processedAssets = await Promise.all(assetsRows.map(async function (row) {
        var itemtype = normalizeItemtype(row.Item_Type);
        if (!itemtype) {
          itemtype = itemtypeFromFilename(String(row.Name || ''));
        }
        if (!itemtype) {
          addLog('Asset ignoré (type inconnu): ' + String(row.Name || '-'), 'warn');
          return null;
        }

        var payload = buildAssetPayload(row);
        if (!payload.name) {
          addLog('Asset ignoré (Name vide).', 'warn');
          return null;
        }

        // Dédup avant création: si Name ou Inventory_Number existe déjà pour ce type, on ne recrée pas.
        var alreadyByName = existingIndex.byName[itemtype]?.[String(row.Name || '').trim()];
        var alreadyBySerial = existingIndex.byInventory[itemtype]?.[String(row.Inventory_Number || '').trim()];
        if (alreadyByName || alreadyBySerial) {
          return { skipped: true };
        }

        // Résolution des tables respectives (Location, Manufacturer, State, Model, User) en parallèle.
        var modelItemtype = getModelItemtype(itemtype);
        var [locationId, manufacturerId, stateId, userId, modelId] = await Promise.all([
          getOrCreateByName(sessionToken, 'Location', row.Location, refCache),
          getOrCreateByName(sessionToken, 'Manufacturer', row.Manufacturer, refCache),
          getOrCreateByName(sessionToken, 'State', row.Status, refCache),
          getOrCreateUserByDisplayName(sessionToken, row.User, userCache),
          modelItemtype ? getOrCreateByName(sessionToken, modelItemtype, row.Model, refCache) : Promise.resolve(null),
        ]);

        if (locationId) payload.locations_id = locationId;
        if (manufacturerId) payload.manufacturers_id = manufacturerId;
        if (stateId) payload.states_id = stateId;
        if (stateId) {
          await ensureStateVisibilityForItemtype(sessionToken, stateId, itemtype, visibilityCache);
        }
        if (userId) payload.users_id = userId;
        if (modelId) {
          var modelField = ITEMTYPE_MODEL_FIELD[itemtype];
          if (modelField) payload[modelField] = modelId;
        }

        return { itemtype, payload, source: row };
      }));

      var groupedAssets = {};
      var skippedExistingAssets = 0;
      for (const entry of processedAssets) {
        if (!entry) continue;
        if (entry.skipped) { skippedExistingAssets += 1; continue; }
        if (!groupedAssets[entry.itemtype]) groupedAssets[entry.itemtype] = [];
        groupedAssets[entry.itemtype].push({ payload: entry.payload, source: entry.source });
      }

      var createdIndex = { byName: {}, byInventory: {} };
      for (const itemtype of Object.keys(groupedAssets)) {
        var entries = groupedAssets[itemtype];
        var payloads = entries.map(function (e) { return e.payload; });
        addLog('Création de ' + payloads.length + ' ' + itemtype + '…');
        var results = await createItems(sessionToken, itemtype, payloads);

        var ok = 0;
        results.forEach(function (result, i) {
          if (result.id && result.id !== false) {
            ok += 1;
            var row = entries[i].source;
            addToIndex(createdIndex.byName, itemtype, row.Name, result.id);
            addToIndex(createdIndex.byInventory, itemtype, row.Inventory_Number, result.id);
            addToIndex(existingIndex.byName, itemtype, row.Name, result.id);
            addToIndex(existingIndex.byInventory, itemtype, row.Inventory_Number, result.id);
          }
        });

        addLog('→ ' + ok + '/' + results.length + ' ' + itemtype + ' créé(s).', ok === results.length ? 'success' : 'warn');
      }

      if (skippedExistingAssets > 0) {
        addLog('Assets déjà existants ignorés: ' + skippedExistingAssets + '.', 'info');
      }

      // 2) Feuille 2: Tickets + liaisons (parallèle)
      var ticketResults = await Promise.all(ticketsRows.map(async function (row) {
        var refTicket = String(row.Ref_Ticket || '').trim();
        var title = String(row.Titre || '').trim();
        var description = String(row.Description || '').trim();
        var date = String(row.Date || '').trim();
        var hour = String(row.Heure || '').trim();
        var type = String(row.Type || '').trim();
        var status = String(row.Status || '').trim();

        if (!title) {
          addLog('Ticket ignoré (Titre vide) - Ref ' + (refTicket || '?'), 'warn');
          return null;
        }

        var prio = priorityToUrgencyImpact(row.Priority);
        var ticketPayload = {
          name: title,
          content: description,
          urgency: prio.urgency,
          impact: prio.impact,
        };

        var meta = [];
        if (date || hour) meta.push('Date/Heure: ' + date + (hour ? ' ' + hour : ''));
        if (type) meta.push('Type: ' + type);
        if (status) meta.push('Status source: ' + status);
        if (meta.length) {
          ticketPayload.content = (ticketPayload.content ? ticketPayload.content + '\n\n' : '') + meta.join(' | ');
        }

        // Champs ticket dédiés.
        var dateField = normalizeDateTime(row.Date, row.Heure);
        if (dateField) {
          ticketPayload.date = dateField;
        }
        var typeKey = normalizeCompact(row.Type);
        if (typeKey && TICKET_TYPE_TO_VALUE[typeKey]) {
          ticketPayload.type = TICKET_TYPE_TO_VALUE[typeKey];
        }
        var statusKey = normalizeCompact(row.Status);
        if (statusKey && TICKET_STATUS_TO_VALUE[statusKey]) {
          ticketPayload.status = TICKET_STATUS_TO_VALUE[statusKey];
        }

        var fpTicket = ticketFingerprint(ticketPayload.name, ticketPayload.content);
        var existingTicketId = existingTicketMap[fpTicket];
        var ticketIdToUse = null;

        if (existingTicketId) {
          ticketIdToUse = existingTicketId;
        } else {
          var created = await createTicket(sessionToken, ticketPayload);
          ticketIdToUse = created.id;
          existingTicketMap[fpTicket] = ticketIdToUse;
        }

        var requestedItems = parseItemsCell(row.Items);
        var linked = [];
        var unresolved = [];

        if (requestedItems.length) {
          for (const ref of requestedItems) {
            var preferredType = itemtypeFromFilename(ref) || null;
            var found = resolveAssetId(ref, preferredType, createdIndex, existingIndex);
            if (found) {
              linked.push(found);
            } else {
              unresolved.push(ref);
            }
          }

          if (linked.length) {
            await linkTicketItems(sessionToken, ticketIdToUse, linked);
          }
        }

        return {
          ref: refTicket || null,
          ticketId: ticketIdToUse,
          created: !existingTicketId,
          linked: linked.length,
          unresolved: unresolved,
        };
      }));

      var ticketRefToId = {};
      var createdTickets = 0;
      var reusedTickets = 0;
      var linkedItemsCount = 0;
      for (const r of ticketResults) {
        if (!r) continue;
        if (r.ref) ticketRefToId[r.ref] = r.ticketId;
        if (r.created) createdTickets += 1;
        else reusedTickets += 1;
        linkedItemsCount += r.linked || 0;
        for (const u of r.unresolved || []) {
          addLog('Ticket #' + r.ticketId + ': items non trouvés -> ' + u, 'warn');
        }
      }

      addLog('Tickets créés: ' + createdTickets + ', existants réutilisés: ' + reusedTickets + ', liaisons items: ' + linkedItemsCount + '.', 'success');

      // 3) Feuille 3: Coûts (parallèle avec allSettled)
      var costResults = await Promise.allSettled(costsRows.map(async function (row) {
        var ref = String(row.Num_Ticket || '').trim();
        var ticketId = ticketRefToId[ref] || toNumber(ref, 0);
        if (!ticketId) {
          throw new Error('ticket introuvable pour Num_Ticket=' + ref);
        }

        var duration = Math.max(0, Math.round(toNumber(row.Duration_second, 0)));
        var timeCost = Math.max(0, toNumber(row.Time_Cost, 0));
        var fixedCost = Math.max(0, toNumber(row.Fixed_Cost, 0));
        var fpCost = costFingerprint(ticketId, duration, timeCost, fixedCost);
        if (existingCostSet.has(fpCost)) {
          return 'skipped';
        }

        await createTicketCost(sessionToken, ticketId, row);
        return ticketId;
      }));

      var costOk = 0;
      var costFail = 0;
      for (const r of costResults) {
        if (r.status === 'fulfilled' && r.value !== 'skipped') {
          costOk += 1;
        } else if (r.status === 'rejected') {
          costFail += 1;
          addLog('Coût: ' + (r.reason?.message || String(r.reason)), 'error');
        }
      }

      addLog('Coûts importés: ' + costOk + ' OK, ' + costFail + ' erreur(s).', costFail === 0 ? 'success' : 'warn');

      // 4) ZIP images (optionnel)
      var uploadedFail = 0;
      if (imageEntries.length) {
        addLog('Upload des images…');
        var uploadedOk = 0;
        var skipped = 0;

        for (const entry of imageEntries) {
          var filename = entry.name.split('/').pop();
          var imageItemtype = itemtypeFromFilename(filename);
          var name = nameFromFilename(filename);

          if (!imageItemtype) {
            addLog('→ ' + filename + ' : préfixe inconnu, ignoré.', 'warn');
            skipped += 1;
            continue;
          }

          var foundAsset = resolveAssetId(name, imageItemtype, createdIndex, existingIndex);
          if (!foundAsset) {
            addLog('→ ' + filename + ' : aucun item "' + name + '" trouvé (' + imageItemtype + '), ignoré.', 'warn');
            skipped += 1;
            continue;
          }

          try {
            var uploadFilename = jpegFilename(filename);
            if (existingDocumentNames.has(normalizeKey(filename)) || existingDocumentNames.has(normalizeKey(uploadFilename))) {
              skipped += 1;
              continue;
            }
            var blob = await entry.async('blob');
            var preparedImage = await prepareImageForGlpi(blob, filename);
            await uploadImageForItem(sessionToken, foundAsset.itemtype, foundAsset.id, preparedImage.blob, preparedImage.filename);
            existingDocumentNames.add(normalizeKey(preparedImage.filename));
            uploadedOk += 1;
          } catch (err) {
            addLog('→ ' + filename + ' : ' + err.message, 'error');
            uploadedFail += 1;
          }
        }

        addLog('Images : ' + uploadedOk + ' OK, ' + uploadedFail + ' erreur(s), ' + skipped + ' ignorée(s).', uploadedFail === 0 ? 'success' : 'warn');
      }

      setStatus(costFail > 0 || uploadedFail > 0 ? STATUS.ERROR : STATUS.SUCCESS);
    } catch (err) {
      addLog(`Erreur : ${err.message}`, 'error');
      setStatus(STATUS.ERROR);
    } finally {
      if (sessionToken) {
        await killSession(sessionToken).catch(() => {});
        addLog('Session fermée.');
      }
    }
  }

  const logClass = (t) =>
    ({ success: 'log-success', error: 'log-error', warn: 'log-warn' }[t] ?? 'log-info');

  const running = status === STATUS.RUNNING;

  return (
    <div className="reinit-card">
      <h2>Import groupé (3 feuilles + ZIP)</h2>
      <p className="reinit-desc">
        Importez les 3 CSV de juin (feuille 1 assets, feuille 2 tickets, feuille 3 coûts)
        et optionnellement un ZIP d'images. Les liens sont faits via le nom d'asset
        (ex: <code>PC-LAB-002.jpeg</code> {'->'} item <code>PC-LAB-002</code>).
      </p>

      <div className="import-controls">
        {FILE_SLOTS.map(slot => (
          <div className="form-group" key={slot.key}>
            <label htmlFor={`file-${slot.key}`}>{slot.label}</label>
            <input
              id={`file-${slot.key}`}
              ref={refs[slot.key]}
              type="file"
              accept={slot.accept}
              className="form-file"
              onChange={(e) => handleFile(slot.key, e)}
              disabled={running}
            />
            {files[slot.key] && <small>{files[slot.key].name}</small>}
          </div>
        ))}
      </div>

      <div className="import-actions">
        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={running}
        >
          {running ? 'Import en cours…' : 'Lancer l\'import'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={running}
        >
          Réinitialiser
        </button>
      </div>

      {logs.length > 0 && (
        <div className="logs-box">
          <h3>Journal</h3>
          <ul className="logs-list">
            {logs.map((l, i) => (
              <li key={i} className={logClass(l.type)}>
                <span className="log-time">
                  {l.at.toLocaleTimeString()}
                </span>{' '}
                {l.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
