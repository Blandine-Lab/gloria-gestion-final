import Dexie from 'dexie';

export const db = new Dexie('GloriaBusinessDB');

db.version(1).stores({
  products: 'id, name, current_stock, unit_price, size, bottles_per_pack, reorder_level',
  sellers: 'id, name, email, phone',
  clients: 'id, name, phone, credit_balance',
  operators: 'id, name, stock_megas, stock_unites, stock_fc, stock_usd',
  stock_movements: 'id, product_id, quantity_change, movement_type, cooperant_id, created_at',
  sales: 'id, total_amount, payment_method, sale_date, client_id, operator_id, sale_type',
  sync_queue: '++id, action, table, data, timestamp', // file d'attente pour la synchronisation
});

export const { products, sellers, clients, operators, stock_movements, sales, sync_queue } = db;