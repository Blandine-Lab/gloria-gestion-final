import Dexie from 'dexie';

const db = new Dexie('GloriaDB');
db.version(1).stores({
  products: 'id, name, current_stock',
  sellers: 'id, name',
  clients: 'id, name, phone',
  operators: 'id, name',
  stockMovements: 'id, product_id, cooperant_id, created_at',
  sales: 'id, client_id, operator_id, sale_date',
});

export default db;