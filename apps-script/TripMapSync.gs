/**
 * Trip site sync: shares every change made on the trip site (waypoints, map day moves,
 * schedule block times / days / notes) through one tab of this spreadsheet.
 *
 * Paste this into Extensions → Apps Script of the spreadsheet you want to use, then deploy it
 * as a web app. Full steps: SHEET-SYNC-SETUP.md in the trip site's folder.
 *
 * The tab is created on first use. One row per change:
 *   kind   id                              value                                       updated  by
 *   wp     5|cafe_mozart                   1                                           …        iPhone k3f2
 *   move   poeschl@5                       9                                           …        …
 *   block  d7-ervin-szabo-library          {"start":"15:00","end":"16:00","note":"…"}  …        …
 * Editing or deleting rows here also changes the site (it re-reads the tab every minute).
 *
 * @OnlyCurrentDoc  (the script may only open this spreadsheet, never the rest of your Drive)
 */
const TAB = 'TripMap';
const HEAD = ['kind', 'id', 'value', 'updated', 'by'];
const KINDS = ['wp', 'move', 'block'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange('A:C').setNumberFormat('@');   // keep ids and values as plain text
  }
  return sh;
}

function rows_(sh) {
  const v = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({
      row: i + 1, kind: String(v[i][0]), id: String(v[i][1]), value: String(v[i][2]),
      updated: v[i][3] instanceof Date ? v[i][3].toISOString() : String(v[i][3] || ''), by: String(v[i][4] || '')
    });
  }
  return out;
}

function state_(sh) {
  return rows_(sh).map(r => ({ kind: r.kind, id: r.id, value: r.value, updated: r.updated, by: r.by }));
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Strings that start like a formula are stored as text, never evaluated.
function safe_(s) {
  s = String(s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** Read: anyone with the URL can read the shared changes (no personal data is stored). */
function doGet() {
  return json_({ ok: true, items: state_(sheet_()) });
}

/** Write: needs the edit code saved in Project Settings → Script properties as EDIT_CODE. */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }
  const code = PropertiesService.getScriptProperties().getProperty('EDIT_CODE');
  if (!code) return json_({ ok: false, error: 'No EDIT_CODE set in the script properties' });
  if (body.code !== code) return json_({ ok: false, error: 'Wrong edit code' });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheet_();
    if (body.reset) {
      const last = sh.getLastRow();
      if (last > 1) sh.deleteRows(2, last - 1);
    }
    (body.ops || []).forEach(op => {
      if (KINDS.indexOf(op.kind) < 0 || !op.id || String(op.id).length > 200) return;
      const hit = rows_(sh).find(r => r.kind === op.kind && r.id === String(op.id));
      if (op.value === null || op.value === undefined) {
        if (hit) sh.deleteRow(hit.row);
        return;
      }
      const value = typeof op.value === 'string' ? op.value : JSON.stringify(op.value);
      const rec = [op.kind, safe_(op.id), safe_(value).slice(0, 2000), new Date(), safe_(String(body.by || '').slice(0, 40))];
      if (hit) sh.getRange(hit.row, 1, 1, 5).setValues([rec]);
      else sh.appendRow(rec);
    });
    return json_({ ok: true, items: state_(sh) });
  } finally {
    lock.releaseLock();
  }
}
