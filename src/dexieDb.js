import Dexie from 'dexie';

const dexieDB = new Dexie('SellyticsDB');
dexieDB.version(1).stores({
  users: 'email_address, hashed_password, role, store_id, user_id, owner_id, admin_id, fullAccess',
  stores: 'id, shop_name, allowed_dashboard', // Ensure allowed_dashboard is included
});

export default dexieDB;