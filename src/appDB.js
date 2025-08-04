import Dexie from 'dexie';

export const appDB = new Dexie('app_data');

appDB.version(1).stores({
  products: '++id, name, created_at, store_id',
  sales: '++id, product_id, sold_at',
  inventory: '++id, product_id, store_id',
});
