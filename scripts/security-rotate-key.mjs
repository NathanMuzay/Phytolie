import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { dataCodec } from '../server/encryption.mjs';
import { openAccounts, HttpError } from '../server/accounts.mjs';
import { openDelegations } from '../server/delegations.mjs';

process.umask(0o077);
const oldCodec = dataCodec(process.env.FOLIA_DATA_KEY, { required: true });
const nextCodec = dataCodec(process.env.FOLIA_NEW_DATA_KEY, { required: true });
if (process.env.FOLIA_DATA_KEY.toLowerCase() === process.env.FOLIA_NEW_DATA_KEY.toLowerCase()) throw new Error('La nouvelle clé doit être différente.');
const path = resolve(process.env.FOLIA_DB_PATH || 'data/folia.sqlite');
if (!existsSync(path)) throw new Error('Base absente. Vérifiez FOLIA_DB_PATH.');
const accounts = openAccounts(path, { codec: oldCodec, requireEncrypted: true });
try {
  openDelegations(accounts, HttpError, { requireEncrypted: true });
  accounts.db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of accounts.db.prepare('SELECT user_id, data FROM gardens').iterate()) {
      const context = `garden:${row.user_id}`;
      accounts.db.prepare('UPDATE gardens SET data=? WHERE user_id=?').run(nextCodec.encode(oldCodec.decode(row.data, context), context), row.user_id);
    }
    for (const row of accounts.db.prepare('SELECT id, notes FROM delegations').iterate()) {
      const context = `delegation:${row.id}`;
      accounts.db.prepare('UPDATE delegations SET notes=? WHERE id=?').run(nextCodec.encode(oldCodec.decode(row.notes, context), context), row.id);
    }
    accounts.db.exec('COMMIT');
  } catch (error) { accounts.db.exec('ROLLBACK'); throw error; }
  accounts.db.exec('VACUUM');
  console.log('Rotation terminée. Configurez FOLIA_DATA_KEY avec la nouvelle clé avant de redémarrer.');
} finally { accounts.close(); }
