#!/usr/bin/env node
/*
 * Outreach Engine starter kit: first-boot setup, runs before n8n starts.
 *
 *  1. Seeds ./n8n-files with demo data (only files that do not exist yet) and refreshes the cockpit page.
 *  2. Builds the SMTP / IMAP credentials from your .env file and imports them (your passwords never live in the repo).
 *  3. Imports the four workflows (only when they changed since the last import).
 *  4. Publishes (activates) them.
 *
 * Paths can be overridden with env vars so the script can be tested outside Docker.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const FILES = process.env.KIT_FILES_DIR || '/home/node/.n8n-files';
const SEED = process.env.KIT_SEED_DIR || '/kit/seed';
const WF = process.env.KIT_WORKFLOWS_DIR || '/kit/workflows';
const DATA = process.env.KIT_DATA_DIR || '/home/node/.n8n';
const N8N = process.env.KIT_N8N_BIN || 'n8n';
const E = process.env;

const log = (...a) => console.log('[kit]', ...a);
const warn = (...a) => console.warn('[kit] WARNING:', ...a);

function n8n(args) {
  const r = spawnSync(N8N, args, { encoding: 'utf8', env: process.env });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  return { ok: r.status === 0, out };
}

// ---------- 1. seed files ----------
fs.mkdirSync(FILES, { recursive: true });
for (const f of ['lead_inbox.csv', 'sent_log.csv', 'cockpit.json', 'cockpit_replies.json']) {
  const dst = path.join(FILES, f);
  if (!fs.existsSync(dst)) { fs.copyFileSync(path.join(SEED, f), dst); log('seeded', f); }
}
fs.copyFileSync(path.join(SEED, 'cockpit_ui.html'), path.join(FILES, 'cockpit_ui.html')); // always refresh the page

// ---------- 2. credentials ----------
const haveSmtp = !!(E.SMTP_HOST && E.SMTP_USER && E.SMTP_PASSWORD);
const haveImap = !!(E.IMAP_HOST && (E.IMAP_USER || E.SMTP_USER) && (E.IMAP_PASSWORD || E.SMTP_PASSWORD));
const creds = [];
if (haveSmtp) {
  const port = parseInt(E.SMTP_PORT || '465', 10);
  creds.push({
    id: 'SmtpOutreach0001', name: 'Outreach SMTP', type: 'smtp',
    data: { user: E.SMTP_USER, password: E.SMTP_PASSWORD, host: E.SMTP_HOST, port, secure: String(E.SMTP_SECURE || (port === 465)) !== 'false', disableStarttls: false, hostName: '' }
  });
} else {
  warn('SMTP_* not set in .env: the engine can import, but it cannot send mail until you add them.');
}
if (haveImap) {
  creds.push({
    id: 'ImapOutreach0001', name: 'Outreach IMAP', type: 'imap',
    data: { user: E.IMAP_USER || E.SMTP_USER, password: E.IMAP_PASSWORD || E.SMTP_PASSWORD, host: E.IMAP_HOST, port: parseInt(E.IMAP_PORT || '993', 10), secure: String(E.IMAP_SECURE || 'true') !== 'false', allowUnauthorizedCerts: false }
  });
} else {
  log('IMAP_* not set: reply detection is switched off (everything else works).');
}
if (creds.length) {
  const tmp = path.join(os.tmpdir(), 'kit-creds-' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify(creds), { mode: 0o600 });
  const r = n8n(['import:credentials', '--input=' + tmp]);
  fs.unlinkSync(tmp);
  if (!r.ok) { warn('credential import failed:\n' + r.out); } else { log('imported credentials:', creds.map(c => c.type).join(', ')); }
}

// ---------- 3. workflows ----------
const names = fs.readdirSync(WF).filter(f => f.endsWith('.json')).sort();
const hash = crypto.createHash('sha1');
for (const f of names) hash.update(fs.readFileSync(path.join(WF, f)));
hash.update(haveImap ? 'imap' : 'noimap');
const stamp = hash.digest('hex');
const marker = path.join(DATA, '.kit-imported');
const imported = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8').trim() : '';

const toPublish = [];
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wf-'));
for (const f of names) {
  const w = JSON.parse(fs.readFileSync(path.join(WF, f), 'utf8'));
  const hasImap = w.nodes.some(n => n.type === 'n8n-nodes-base.emailReadImap');
  if (hasImap && !haveImap) {
    for (const n of w.nodes) if (n.type === 'n8n-nodes-base.emailReadImap') n.disabled = true;
  }
  const onlyImapTrigger = hasImap && w.nodes.filter(n => /Trigger$/.test(n.type) || n.type.endsWith('emailReadImap') || n.type.endsWith('.webhook') || n.type.endsWith('.formTrigger')).every(n => n.type.endsWith('emailReadImap'));
  fs.writeFileSync(path.join(stage, f), JSON.stringify(w));
  if (!(onlyImapTrigger && !haveImap)) toPublish.push(w.id);
}
if (imported !== stamp || E.KIT_FORCE_REIMPORT === 'true') {
  const r = n8n(['import:workflow', '--separate', '--input=' + stage]);
  if (!r.ok) { console.error(r.out); process.exit(1); }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(marker, stamp);
  log('imported workflows');
} else {
  log('workflows already imported (unchanged), leaving them as they are');
}

// ---------- 4. publish ----------
for (const id of toPublish) {
  const r = n8n(['publish:workflow', '--id=' + id]);
  if (!r.ok) warn('could not publish workflow ' + id + ':\n' + r.out);
}
log('ready. Cockpit: http://localhost:' + (E.N8N_PORT || 5678) + '/webhook/cockpit');
fs.rmSync(stage, { recursive: true, force: true });
