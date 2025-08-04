// ✅ 2. src/services/syncService.js
import dexieDB from '../dexieDb';
import { supabase } from '../supabaseClient';

// Automatically push unsynced records online
export async function syncAll() {
  console.log('🔄 Syncing offline data...');
  try {
    // Sync dynamic_product
    const products = await dexieDB.dynamic_product.toArray();
    for (const product of products) {
      const { error } = await supabase.from('dynamic_product').insert(product);
      if (!error) await dexieDB.dynamic_product.delete(product.id);
    }

    // Sync dynamic_sales
    const sales = await dexieDB.dynamic_sales.toArray();
    for (const sale of sales) {
      const { error } = await supabase.from('dynamic_sales').insert(sale);
      if (!error) await dexieDB.dynamic_sales.delete(sale.id);
    }

    // Sync dynamic_inventory
    const inventory = await dexieDB.dynamic_inventory.toArray();
    for (const inv of inventory) {
      const { error } = await supabase.from('dynamic_inventory').insert(inv);
      if (!error) await dexieDB.dynamic_inventory.delete(inv.id);
    }

    console.log('✅ Offline data synced to Supabase!');
  } catch (err) {
    console.error('❌ Sync error:', err);
  }
}

// Generic offline insert hook
export async function useOfflineInsert(tableName, data) {
  try {
    if (navigator.onLine) {
      const { error } = await supabase.from(tableName).insert(data);
      if (error) {
        console.warn(`❌ Online insert failed, saving to Dexie: ${error.message}`);
        await dexieDB[tableName].add(data);
      }
    } else {
      await dexieDB[tableName].add(data);
      console.log(`📦 Offline saved to ${tableName}`);
    }
  } catch (err) {
    console.error(`❌ useOfflineInsert error:`, err);
  }
}
