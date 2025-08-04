// src/hooks/useOfflineInsert.js
import { db } from '../services/dexieDB';
import { supabase } from '../supabaseClient';

export function useOfflineInsert(tableName) {
  const insert = async (data) => {
    if (navigator.onLine) {
      const { error } = await supabase.from(tableName).insert(data);
      if (error) {
        console.warn('Insert online failed, saving offline.', error);
        await db[tableName].add(data);
      }
    } else {
      await db[tableName].add(data);
    }
  };

  return insert;
}
