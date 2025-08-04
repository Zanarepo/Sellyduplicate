import { appDB } from '../appDB';
import { supabase } from '../supabaseClient';

export function useOfflineInsert(tableName) {
  const insert = async (data) => {
    if (navigator.onLine) {
      const { error } = await supabase.from(tableName).insert(data);
      if (error) {
        console.warn('Insert failed, saving offline.', error);
        await appDB[tableName].add(data);
      }
    } else {
      await appDB[tableName].add(data);
    }
  };

  return insert;
}
