import { DatabaseSync, backup } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, open, chmod, stat, link } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

process.umask(0o077);
const [mode, target] = process.argv.slice(2);
if (!['backup', 'restore'].includes(mode) || !target) throw new Error('Usage : npm run security:backup -- fichier.foliabak OU npm run security:restore -- fichier.foliabak');
if (!/^[a-fA-F0-9]{64}$/.test(process.env.FOLIA_BACKUP_KEY || '')) throw new Error('FOLIA_BACKUP_KEY requise (64 caractères hexadécimaux).');
if (process.env.FOLIA_BACKUP_KEY.toLowerCase() === process.env.FOLIA_DATA_KEY?.toLowerCase()) throw new Error('La clé de sauvegarde doit être distincte de la clé des données.');
const key = Buffer.from(process.env.FOLIA_BACKUP_KEY, 'hex');
const magic = Buffer.from('FOLIABAK1');
const database = resolve(process.env.FOLIA_DB_PATH || 'data/folia.sqlite');
const archive = resolve(target);
// Temporary files stay on the destination filesystem, in a private directory.
const directory = await mkdtemp(join(dirname(mode === 'backup' ? archive : database), '.folia-backup-'));
try {
  if (mode === 'backup') {
    const snapshot = join(directory, 'snapshot.sqlite');
    const db = new DatabaseSync(database, { readOnly: true });
    try { await backup(db, snapshot); } finally { db.close(); }
    await chmod(snapshot, 0o600);
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(magic);
    const sealed = join(directory, 'sealed');
    const header = await open(sealed, 'wx', 0o600);
    try { await header.writeFile(Buffer.concat([magic, iv])); } finally { await header.close(); }
    await pipeline(createReadStream(snapshot), cipher, createWriteStream(sealed, { flags: 'a', mode: 0o600 }));
    const trailer = await open(sealed, 'a');
    try { await trailer.writeFile(cipher.getAuthTag()); } finally { await trailer.close(); }
    // link is atomic and refuses to overwrite any existing target.
    await link(sealed, archive);
    console.log('Sauvegarde chiffrée créée. Testez sa restauration dans un fichier distinct.');
  } else {
    const size = (await stat(archive)).size;
    if (size < magic.length + 12 + 16) throw new Error('Sauvegarde invalide.');
    const file = await open(archive, 'r');
    const header = Buffer.alloc(magic.length + 12), tag = Buffer.alloc(16);
    try { await file.read(header, 0, header.length, 0); await file.read(tag, 0, 16, size - 16); } finally { await file.close(); }
    if (!header.subarray(0, magic.length).equals(magic)) throw new Error('Format de sauvegarde inconnu.');
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length));
    decipher.setAAD(magic); decipher.setAuthTag(tag);
    const restored = join(directory, 'restored.sqlite');
    await pipeline(createReadStream(archive, { start: header.length, end: size - 17 }), decipher, createWriteStream(restored, { flags: 'wx', mode: 0o600 }));
    const db = new DatabaseSync(restored, { readOnly: true });
    try { if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Intégrité SQLite invalide.'); } finally { db.close(); }
    await link(restored, database);
    console.log('Restauration vérifiée et créée ; aucun fichier existant n’a été écrasé.');
  }
} finally { await rm(directory, { recursive: true, force: true }); }
