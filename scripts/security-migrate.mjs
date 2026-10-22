import { resolve } from 'node:path';
import { openAccounts, HttpError } from '../server/accounts.mjs';
import { openDelegations } from '../server/delegations.mjs';
import { dataCodec } from '../server/encryption.mjs';
import { existsSync } from 'node:fs';

process.umask(0o077);
const path = resolve(process.env.FOLIA_DB_PATH || 'data/folia.sqlite');
if (!existsSync(path)) throw new Error('Base absente. Vérifiez FOLIA_DB_PATH.');
const codec = dataCodec(process.env.FOLIA_DATA_KEY, { required: true });
// Offline command: stop the API and make an encrypted backup first (SECURITY.md).
const accounts = openAccounts(path, { codec, migrate: true, requireEncrypted: true });
try {
  openDelegations(accounts, HttpError, { migrate: true, requireEncrypted: true });
  accounts.db.exec('VACUUM');
  console.log('Jardins et consignes chiffrés ; base compactée. Conservez la clé séparément.');
} finally { accounts.close(); }
