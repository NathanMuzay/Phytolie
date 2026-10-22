import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const prefix = 'enc:v1:';
export function dataCodec(value = process.env.FOLIA_DATA_KEY, { required = process.env.NODE_ENV === 'production' } = {}) {
  if (value && !/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('FOLIA_DATA_KEY doit contenir 64 caractères hexadécimaux.');
  if (required && !value) throw new Error('FOLIA_DATA_KEY obligatoire en production.');
  const key = value ? Buffer.from(value, 'hex') : undefined;
  return {
    enabled: !!key,
    encrypted: text => text.startsWith(prefix),
    encode(text, context) {
      if (!key) return text;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return prefix + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    },
    decode(text, context) {
      if (!text.startsWith(prefix)) return text;
      if (!key) throw new Error('Données chiffrées : FOLIA_DATA_KEY requise.');
      const bytes = Buffer.from(text.slice(prefix.length), 'base64');
      if (bytes.length < 28) throw new Error('Données chiffrées invalides.');
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
