import { db } from '../db/localDB';
import { supabase } from '../utils/supabaseClient';
import axios from 'axios';

// Mapping des tables locales -> noms Supabase
const TABLE_MAP = {
  products: 'products',
  sellers: 'sellers',
  clients: 'clients',
  operators: 'operators',
  stock_movements: 'stock_movements',
  sales: 'sales'
};

// Synchroniser les données depuis Supabase vers IndexedDB
export const syncFromServer = async () => {
  try {
    const tables = Object.keys(TABLE_MAP);
    for (const table of tables) {
      const supabaseTable = TABLE_MAP[table];
      // Récupérer les données depuis Supabase
      const { data, error } = await supabase
        .from(supabaseTable)
        .select('*');
      if (error) throw error;

      // Vider la table locale
      await db[table].clear();
      // Insérer les nouvelles données
      if (data && data.length > 0) {
        await db[table].bulkAdd(data);
      }
      console.log(`✅ Table ${table} synchronisée (${data?.length || 0} lignes)`);
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error);
    return { success: false, error };
  }
};

// Ajouter une opération à la file d'attente (pour l'écriture hors ligne)
export const addToSyncQueue = async (action, table, data) => {
  try {
    await db.sync_queue.add({
      action, // 'insert', 'update', 'delete'
      table,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    });
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur ajout à la file d\'attente:', error);
    return { success: false, error };
  }
};

// Traiter la file d'attente (quand la connexion revient)
export const processSyncQueue = async () => {
  try {
    const pendingItems = await db.sync_queue.where('synced').equals(false).toArray();
    if (pendingItems.length === 0) return { success: true, count: 0 };

    console.log(`🔄 Traitement de ${pendingItems.length} éléments en attente...`);

    let successCount = 0;
    for (const item of pendingItems) {
      try {
        const supabaseTable = TABLE_MAP[item.table];
        if (!supabaseTable) continue;

        let response;
        switch (item.action) {
          case 'insert':
            response = await supabase
              .from(supabaseTable)
              .insert(item.data);
            break;
          case 'update':
            response = await supabase
              .from(supabaseTable)
              .update(item.data)
              .eq('id', item.data.id);
            break;
          case 'delete':
            response = await supabase
              .from(supabaseTable)
              .delete()
              .eq('id', item.data.id);
            break;
          default:
            continue;
        }
        if (response.error) throw response.error;

        // Marquer comme synchronisé
        await db.sync_queue.update(item.id, { synced: true });
        successCount++;
      } catch (error) {
        console.error(`❌ Erreur synchronisation de l'item ${item.id}:`, error);
      }
    }

    // Supprimer les éléments synchronisés
    await db.sync_queue.where('synced').equals(true).delete();

    return { success: true, count: successCount };
  } catch (error) {
    console.error('❌ Erreur traitement file d\'attente:', error);
    return { success: false, error };
  }
};

// Vérifier la connexion et synchroniser
export const checkAndSync = async () => {
  const isOnline = navigator.onLine;
  if (isOnline) {
    // Si connecté, synchroniser depuis le serveur
    await syncFromServer();
    // Puis traiter la file d'attente (envoyer les modifs locales)
    await processSyncQueue();
    return true;
  } else {
    console.log('📴 Hors ligne, les données restent locales.');
    return false;
  }
};