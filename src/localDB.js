import Dexie from 'dexie';

export const localDB = new Dexie('OfflineAuthDB');

localDB.version(1).stores({
  users: '[email_address+store_id+role]', // Composite key
});
