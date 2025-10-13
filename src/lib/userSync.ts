import { supabase } from './supabase';
import { externalAuth } from './externalAuth';

export const syncUserToSystemUsers = async (userId: string, email: string, name: string) => {
  const { data: existingUser } = await supabase
    .from('system_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existingUser) {
    return;
  }

  const role = externalAuth.getUserRole();

  const { error } = await supabase
    .from('system_users')
    .insert({
      id: userId,
      email: email,
      full_name: name,
      role: role,
      is_active: true
    });

  if (error) {
  }
};

export const ensureCurrentUserInSystemUsers = async () => {
  const user = externalAuth.getStoredUser();
  if (!user) return;

  await syncUserToSystemUsers(user.id, user.email, user.name);
};
