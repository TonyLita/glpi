function splitCsvLine(line, sep) {
  var cells = [];
  var current = '';
  var inQuotes = false;

  for (var i = 0; i < line.length; i += 1) {
    var ch = line[i];

    if (ch === '"') {
      // RFC 4180 escaped quote "" inside quoted cell.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === sep && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsv(text) {
  var raw = String(text || '').replace(/^\uFEFF/, '').trim();
  var lines = raw.split(/\r?\n/);

  if (!lines.length) {
    return [];
  }

  var sep = lines[0].includes(';') ? ';' : ',';
  var keys = splitCsvLine(lines[0], sep).map(function (h) { return h.trim(); });

  var dataRows = lines.slice(1).filter(function (line) { return line.trim() !== ''; }).map(function (line) {
    var values = splitCsvLine(line, sep);
    var obj = {};
    keys.forEach(function (key, i) {
      if (!key) return;
      obj[key] = values[i] !== undefined ? values[i] : '';
    });
    return obj;
  });

  if (!dataRows.length && keys.length > 0) {
    var headerObj = {};
    keys.forEach(function (key) {
      if (key) headerObj[key] = '';
    });
    return [headerObj];
  }

  return dataRows;
}
