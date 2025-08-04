import { supabase } from '../../supabaseClient';
import { saveLoginOffline } from '../../authDB';

export async function handleOfflineUserSave(user) {
  try {
    const { store_id } = user;

    // Use `id` not `store_id` in `stores` table
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select('allowed_dashboard')
      .eq('id', store_id)
      .single();

    if (storeError) {
      console.warn('⚠️ Failed to fetch allowed_dashboard:', storeError.message);
    }

    // Parse the `allowed_dashboard` string (if it exists)
    let allowed_dashboard = [];

    if (storeInfo?.allowed_dashboard) {
      const raw = storeInfo.allowed_dashboard;

      try {
        allowed_dashboard = JSON.parse(raw);
      } catch {
        // fallback: assume comma-separated values
        allowed_dashboard = raw.split(',').map(s => s.trim());
      }
    }

    const offlineUser = {
      ...user,
      allowed_dashboard,
    };

    await saveLoginOffline(offlineUser);
    console.log('✅ Offline user saved.');
  } catch (err) {
    console.error('❌ Error in handleOfflineUserSave:', err);
  }
}
