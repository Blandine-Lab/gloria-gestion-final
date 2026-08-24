import { supabase } from '../utils/supabaseClient';
import { db } from '../db'; // suppose que db.js exporte la base Dexie

// Mapping des tables locales -> noms Supabase
const TABLE_MAP = {
  products: 'products',
  sellers: 'sellers',
  clients: 'clients',
  operators: 'operators',
  stock_movements: 'stock_movements',
  sales: 'sales',
  cash_transactions: 'cash_transactions',
  settings: 'settings',
  users: 'users'
};

// Synchroniser les données depuis Supabase vers IndexedDB (remplacement complet)
export const syncFromServer = async () => {
  console.log('🔄 Synchronisation avec Supabase...');
  try {
    const tables = Object.keys(TABLE_MAP);
    const results = await Promise.all(
      tables.map(async (table) => {
        const supabaseTable = TABLE_MAP[table];
        const { data, error } = await supabase
          .from(supabaseTable)
          .select('*');
        if (error) throw error;
        return { table, data: data || [] };
      })
    );

    // Vider toutes les tables locales
    await db.products.clear();
    await db.sellers.clear();
    await db.clients.clear();
    await db.operators.clear();
    await db.stock_movements.clear();
    await db.sales.clear();
    await db.cash_transactions.clear();
    await db.settings.clear();
    await db.users.clear();

    // Insérer les nouvelles données
    for (const { table, data } of results) {
      if (data.length > 0) {
        await db[table].bulkPut(data);
      }
      console.log(`✅ Table ${table} synchronisée (${data.length} lignes)`);
    }

    console.log('✅ Synchronisation terminée');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur synchronisation:', error);
    return { success: false, error };
  }
};

// Ajouter une opération à la file d'attente (pour les écritures hors ligne)
export const addToSyncQueue = async (action, table, data) => {
  try {
    // Vérifier que la table sync_queue existe (création si nécessaire)
    if (!db.tables.some(t => t.name === 'sync_queue')) {
      // Créer la table dynamiquement (Dexie le permet)
      db.version(db.verno + 1).stores({ sync_queue: '++id, synced' });
      await db.open();
    }
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
    // Vérifier si la table sync_queue existe
    if (!db.tables.some(t => t.name === 'sync_queue')) {
      console.log('📭 Aucune file d\'attente trouvée.');
      return { success: true, count: 0 };
    }

    const pendingItems = await db.sync_queue.where('synced').equals(false).toArray();
    if (pendingItems.length === 0) return { success: true, count: 0 };

    console.log(`🔄 Traitement de ${pendingItems.length} éléments en attente...`);

    let successCount = 0;
    for (const item of pendingItems) {
      try {
        const supabaseTable = TABLE_MAP[item.table];
        if (!supabaseTable) {
          console.warn(`Table ${item.table} non reconnue, ignorée.`);
          continue;
        }

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
        console.log(`✅ Item ${item.id} synchronisé (${item.action} sur ${item.table})`);
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

// Vérifier la connexion et synchroniser (appelée au démarrage)
export const checkAndSync = async () => {
  const isOnline = navigator.onLine;
  if (isOnline) {
    await syncFromServer();
    await processSyncQueue();
    return true;
  } else {
    console.log('📴 Hors ligne, les données restent locales.');
    return false;
  }
};

// Exporter également un alias pour la rétrocompatibilité
export const syncAll = checkAndSync;