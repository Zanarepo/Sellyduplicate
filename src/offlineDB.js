// src/offlineDB.js
import Dexie from 'dexie';

export const offlineDB = new Dexie('SellyticsOfflineDB');

offlineDB.version(1).stores({
  pending_sales: '++id, product_id, quantity, timestamp', // Example
  offline_products: '++id, name, qty',
});
