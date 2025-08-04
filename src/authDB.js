import Dexie from 'dexie';
import { supabase } from './supabaseClient';

// Create offline auth database
export const authDB = new Dexie('OfflineAuthDB');

// Define schema with stores for all tables and pending operations
authDB.version(8).stores({
  logins: '[email+store_id+type], hashed_password, allowed_dashboard, user_id, owner_id, store_id',
  stores: 'id, shop_name, allowed_features, allowed_dashboard, email_address',
  store_users: 'id, store_id, email_address',
  store_owners: 'id, email',
  customer: 'id, store_id, phone_number',
  dynamic_inventory: 'id, store_id, dynamic_product_id',
  dynamic_product: 'id, store_id, created_by_store_id, owner_id, device_id',
  dynamic_sales: 'id, store_id, dynamic_product_id, sale_group_id, created_by_user_id, device_id',
  sale_groups: 'id, store_id',
  receipts: 'id, store_id, product_id, sale_group_id',
  notifications: 'id, store_id, performed_by_id',
  debts: 'id, store_id, customer_id, dynamic_product_id, created_by_user_id, owner_id, device_id',
  debt_payments: 'id, store_id, customer_id, dynamic_product_id, debt_id',
  returns: 'id, receipt_id, customer_name, product_name, device_id, supplier, qty, amount, remark, status, returned_date, created_at, customer_address',

  pending_operations: '++operation_id, table, action, data, store_id, timestamp',
});

const hashPwd = async (plain) => {
  try {
    if (window.crypto?.subtle) {
      const buf = new TextEncoder().encode(plain);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return plain;
  } catch (err) {
    console.error('Hashing failed:', err);
    return plain;
  }
};

// Save user login info and all table data offline
export async function saveLoginOffline(user, type = 'team') {
  try {
    let allowed_features = [];
    const store_id = user.store_id;

    if (store_id) {
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, shop_name, allowed_features, allowed_dashboard')
        .eq('id', store_id)
        .single();

      if (!storeError && storeData) {
        await authDB.stores.put(storeData);
        allowed_features = Array.isArray(storeData.allowed_features)
          ? storeData.allowed_features.map(item => item.trim().toLowerCase())
          : typeof storeData.allowed_features === 'string'
          ? JSON.parse(storeData.allowed_features || '[]').map(item => item.trim().toLowerCase())
          : [];
        console.log('💾 Saved stores to authDB:', storeData);
      }
    }

    const finalUser = {
      email: user.email || user.email_address,
      store_id,
      type,
      hashed_password: user.hashed_password || (await hashPwd(user.password || '')),
      allowed_features,
      user_id: user.user_id || null,
      owner_id: user.owner_id || null,
    };
    await authDB.logins.put(finalUser);
    console.log('💾 Saved login to authDB:', finalUser);

    const tables = [
      'store_users', 'store_owners', 'customer',
      'dynamic_inventory', 'dynamic_product', 'dynamic_sales',
      'sale_groups', 'receipts', 'notifications', 'debts', 'debt_payments', 'suppliers_inventory', 'returns', 'debt_tracker', 'expense_tracker'


    ];

    for (const table of tables) {
      if (table === 'store_owners') {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          await authDB[table].bulkPut(data);
          console.log(`💾 Saved ${table} to authDB:`, data);
        } else {
          console.warn(`⚠️ Failed to fetch ${table}:`, error);
        }
      } else if (store_id) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('store_id', store_id);

        if (!error && data) {
          await authDB[table].bulkPut(data);
          console.log(`💾 Saved ${table} to authDB:`, data);
        } else {
          console.warn(`⚠️ Failed to fetch ${table}:`, error);
        }
      }
    }
  } catch (err) {
    console.error('Error saving login offline:', err);
  }
}

// Try offline login with password verification
export async function tryLoginOffline({ email, store_id, type, password }) {
  try {
    const user = await authDB.logins
      .where('[email+store_id+type]')
      .equals([email, store_id, type])
      .first();

    if (user) {
      const hashedInputPassword = await hashPwd(password);
      if (hashedInputPassword === user.hashed_password) {
        console.log('✅ Successful offline login:', user);
        return user;
      }
      console.warn('❌ Password mismatch for:', email);
    }
    console.warn('❌ No offline user found for:', { email, store_id, type });
    return null;
  } catch (error) {
    console.error('❌ Failed offline login:', error);
    return null;
  }
}

// Queue operation for offline processing
export async function queueOperation({ table, action, data, store_id }) {
  try {
    const operation = {
      table,
      action, // 'insert', 'update', 'delete'
      data,
      store_id: table === 'store_owners' ? null : store_id,
      timestamp: new Date().toISOString(),
    };
    await authDB.pending_operations.put(operation);
    console.log(`💾 Queued ${action} operation for ${table}:`, operation);
    return operation;
  } catch (err) {
    console.error(`Error queuing ${action} for ${table}:`, err);
    throw err;
  }
}

// Sync pending operations when online
export async function syncPendingOperations() {
  if (!navigator.onLine) {
    console.log('Offline: Cannot sync operations');
    return;
  }

  try {
    const operations = await authDB.pending_operations.orderBy('timestamp').toArray();
    if (operations.length === 0) {
      console.log('No pending operations to sync');
      return;
    }

    for (const op of operations) {
      try {
        if (op.action === 'insert') {
          const { data, error } = await supabase.from(op.table).insert(op.data).select().single();
          if (!error && data) {
            await authDB[op.table].put(data);
            await authDB.pending_operations.delete(op.operation_id);
            console.log(`✅ Synced ${op.action} for ${op.table}:`, data);
          } else {
            console.error(`Failed to sync ${op.action} for ${op.table}:`, error);
          }
        } else if (op.action === 'update') {
          const primaryKey = 'id';
          const { data, error } = await supabase
            .from(op.table)
            .update(op.data)
            .eq(primaryKey, op.data[primaryKey])
            .select()
            .single();
          if (!error && data) {
            await authDB[op.table].put(data);
            await authDB.pending_operations.delete(op.operation_id);
            console.log(`✅ Synced ${op.action} for ${op.table}:`, data);
          } else {
            console.error(`Failed to sync ${op.action} for ${op.table}:`, error);
          }
        } else if (op.action === 'delete') {
          const primaryKey = 'id';
          const { error } = await supabase.from(op.table).delete().eq(primaryKey, op.data[primaryKey]);
          if (!error) {
            await authDB[op.table].delete(op.data[primaryKey]);
            await authDB.pending_operations.delete(op.operation_id);
            console.log(`✅ Synced ${op.action} for ${op.table}:`, op.data[primaryKey]);
          } else {
            console.error(`Failed to sync ${op.action} for ${op.table}:`, error);
          }
        }
      } catch (err) {
        console.error(`Error syncing operation for ${op.table}:`, err);
      }
    }
  } catch (err) {
    console.error('Error syncing operations:', err);
  }
}