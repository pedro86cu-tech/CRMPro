import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { externalAuth } from './externalAuth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const baseClient = createClient(supabaseUrl, supabaseAnonKey);
let authenticatedClient: SupabaseClient | null = null;

function getAuthenticatedClient(): SupabaseClient {
  if (!authenticatedClient) {
    authenticatedClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  const token = externalAuth.getStoredToken();
  if (token) {
    (authenticatedClient as any).rest.headers = {
      ...(authenticatedClient as any).rest.headers,
      Authorization: `Bearer ${token}`
    };
  }

  return authenticatedClient;
}

export const supabase = new Proxy(baseClient, {
  get(target, prop) {
    const token = externalAuth.getStoredToken();
    if (token && (prop === 'from' || prop === 'rpc')) {
      return getAuthenticatedClient()[prop as keyof SupabaseClient];
    }
    return target[prop as keyof SupabaseClient];
  }
}) as SupabaseClient;
