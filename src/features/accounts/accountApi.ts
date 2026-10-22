import { getApiBase } from '../../services/apiBase.ts';
import { parseGarden, type Garden } from '../../shared/model.ts';
export type AccountSession = { token: string; user: { id: string; email: string }; expiresAt: string };
export class AccountError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function request(path: string, method: string, token?: string, body?: unknown) {
  const base = getApiBase();
  if (!base) throw new Error('Serveur non configuré. Consultez le README.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('Réponse invalide. Redémarrez le serveur Folia avec npm run api.'); }
    if (!response.ok) throw new AccountError(data.error || 'Requête refusée.', response.status);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Le serveur met trop de temps à répondre. Rechargez la collection avant de réessayer.');
    if (error instanceof TypeError) throw new Error('Serveur inaccessible. Vérifiez la connexion et npm run api.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function authenticate(mode: 'login' | 'register', email: string, password: string): Promise<AccountSession> {
  return request(`/auth/${mode}`, 'POST', undefined, { email, password });
}
export async function loadAccountGarden(session: AccountSession): Promise<{ garden: Garden; revision: number }> {
  const data = await request('/garden', 'GET', session.token);
  return { garden: parseGarden(JSON.stringify(data.garden)), revision: data.revision };
}
export async function saveAccountGarden(session: AccountSession, garden: Garden, revision: number): Promise<number> {
  const data = await request('/garden', 'PUT', session.token, { garden, revision });
  return data.revision;
}
export async function logoutAccount(session: AccountSession): Promise<void> { await request('/auth/logout', 'POST', session.token); }
export function mergeLocalPlants(account: Garden, local: Garden): Garden {
  const ids = new Set(account.plants.map(p => p.id));
  const home = account.home ?? local.home;
  const compatiblePlan = !account.home || JSON.stringify(account.home) === JSON.stringify(local.home);
  const imported = local.plants.filter(p => !ids.has(p.id)).map(plant => {
    if (compatiblePlan || !plant.position) return plant;
    const { position, ...unplaced } = plant;
    return unplaced;
  });
  return { ...account, ...(home ? { home } : {}), plants: [...account.plants, ...imported] };
}

export type Delegation = { id: string; email: string; startsAt: string; endsAt: string; invitationExpiresAt: string; plantIds: string[]; notes: string; status: 'pending' | 'invitation-expired' | 'scheduled' | 'active' | 'expired' | 'revoked' };
export type SharedGarden = { delegation: Delegation; plants: Garden['plants'] };
export const listDelegations = (session: AccountSession): Promise<{ outgoing: Delegation[]; incoming: Delegation[] }> => request('/delegations', 'GET', session.token);
export const createDelegation = (session: AccountSession, input: { email: string; startsAt: string; endsAt: string; plantIds: string[]; notes: string }): Promise<{ delegation: Delegation; invitation: string }> => request('/delegations', 'POST', session.token, input);
export const acceptDelegation = (session: AccountSession, invitation: string): Promise<{ delegation: Delegation }> => request('/delegations/accept', 'POST', session.token, { invitation });
export const revokeDelegation = (session: AccountSession, id: string) => request(`/delegations/${encodeURIComponent(id)}/revoke`, 'POST', session.token);
export const loadSharedGarden = (session: AccountSession, id: string): Promise<SharedGarden> => request(`/delegations/${encodeURIComponent(id)}/garden`, 'GET', session.token);
export const waterSharedPlant = (session: AccountSession, id: string, plantId: string): Promise<SharedGarden> => request(`/delegations/${encodeURIComponent(id)}/water`, 'POST', session.token, { plantId });
export const loadCaretakerActivity = (session: AccountSession): Promise<{ activity: { plantId: string; wateredAt: string; email: string }[] }> => request('/delegations/activity', 'GET', session.token);
