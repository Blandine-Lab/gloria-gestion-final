import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import serverless from 'serverless-http';
import WebSocket from 'ws'; // <-- Support WebSocket pour Node.js 20

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Client Supabase avec transport WebSocket
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: {
      transport: WebSocket,
    },
  }
);

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_here';

// =============================================
// ROUTE 1 : Statistiques du tableau de bord
// =============================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startISO = startOfDay.toISOString();
    const endISO = endOfDay.toISOString();

    const { data: juiceSales, error: juiceError } = await supabase
      .from('stock_movements')
      .select(`
        quantity_change,
        cooperant_id,
        movement_type,
        product_id,
        products(name, size, unit_price)
      `)
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .in('movement_type', ['cooperant_take', 'cooperant_return', 'retail_sale']);

    if (juiceError) throw juiceError;

    const cooperantMap = {};
    const productNetMap = {};
    let totalRetail = 0;
    let totalRetailAmount = 0;

    juiceSales.forEach(mov => {
      const product = mov.products || {};
      const unitPrice = product.unit_price || 0;
      const absQty = Math.abs(mov.quantity_change);
      const productId = mov.product_id;
      const cooperantId = mov.cooperant_id;

      if (mov.movement_type === 'cooperant_take') {
        if (!cooperantMap[cooperantId]) {
          cooperantMap[cooperantId] = { totalTake: 0, totalReturn: 0 };
        }
        cooperantMap[cooperantId].totalTake += absQty;
        const key = `${cooperantId}|${productId}`;
        if (!productNetMap[key]) {
          productNetMap[key] = { cooperantId, productId, unitPrice, netQty: 0 };
        }
        productNetMap[key].netQty += absQty;
      } else if (mov.movement_type === 'cooperant_return') {
        if (!cooperantMap[cooperantId]) {
          cooperantMap[cooperantId] = { totalTake: 0, totalReturn: 0 };
        }
        cooperantMap[cooperantId].totalReturn += absQty;
        const key = `${cooperantId}|${productId}`;
        if (!productNetMap[key]) {
          productNetMap[key] = { cooperantId, productId, unitPrice, netQty: 0 };
        }
        productNetMap[key].netQty -= absQty;
      } else if (mov.movement_type === 'retail_sale') {
        totalRetail += absQty;
        totalRetailAmount += absQty * unitPrice;
      }
    });

    const cooperantAmounts = {};
    for (const key in productNetMap) {
      const data = productNetMap[key];
      const amount = data.netQty * data.unitPrice;
      if (!cooperantAmounts[data.cooperantId]) cooperantAmounts[data.cooperantId] = 0;
      cooperantAmounts[data.cooperantId] += amount;
    }

    let totalCooperantNet = 0;
    let totalCooperantAmount = 0;
    const cooperantSales = [];
    for (const [cooperantId, data] of Object.entries(cooperantMap)) {
      const netSold = data.totalTake - data.totalReturn;
      if (netSold > 0) {
        totalCooperantNet += netSold;
        const amount = cooperantAmounts[cooperantId] || 0;
        totalCooperantAmount += amount;
        const { data: seller } = await supabase
          .from('sellers')
          .select('name')
          .eq('id', cooperantId)
          .single();
        cooperantSales.push({
          cooperantId,
          name: seller?.name || 'Inconnu',
          netSold,
          amount: amount
        });
      }
    }

    const { data: creditSales, error: creditError } = await supabase
      .from('sales')
      .select('total_amount, payment_method, operator_id, sale_type, operators(name)')
      .gte('sale_date', startISO)
      .lt('sale_date', endISO)
      .in('payment_method', ['emoney', 'credit']);

    if (creditError) throw creditError;

    let totalEMoney = 0;
    let totalMegas = 0;
    let totalUnites = 0;
    const operatorStats = {};
    const typeStats = { megas: 0, unites: 0, emoney: 0 };

    creditSales.forEach(sale => {
      const amount = sale.total_amount;
      const opName = sale.operators?.name || 'Autre';
      const type = sale.sale_type || 'emoney';

      if (type === 'megas') totalMegas += amount;
      else if (type === 'unites') totalUnites += amount;
      else totalEMoney += amount;

      typeStats[type] = (typeStats[type] || 0) + amount;
      operatorStats[opName] = (operatorStats[opName] || 0) + amount;
    });

    const { data: allProducts, error: productError } = await supabase
      .from('products')
      .select('id, name, current_stock, reorder_level, size, bottles_per_pack')
      .order('name');

    if (productError) throw productError;

    const alerts = allProducts.filter(p => p.current_stock <= p.reorder_level);
    const totalStockBottles = allProducts.reduce((sum, p) => sum + p.current_stock, 0);
    const totalStockPackets = allProducts.reduce((sum, p) => {
      const bottlesPerPack = p.bottles_per_pack || 12;
      return sum + Math.floor(p.current_stock / bottlesPerPack);
    }, 0);

    const totalJuiceSold = totalCooperantNet + totalRetail;
    const totalJuiceAmount = totalCooperantAmount + totalRetailAmount;

    res.json({
      success: true,
      data: {
        totalJuiceSold,
        totalCooperantNet,
        totalRetail,
        totalEMoney,
        totalMegas,
        totalUnites,
        typeStats,
        totalJuiceAmount,
        totalStockBottles,
        totalStockPackets,
        cooperantSales: cooperantSales.sort((a, b) => b.netSold - a.netSold),
        operatorStats,
        alerts: alerts || [],
        products: allProducts || [],
        date: startOfDay.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 2 : Enregistrer un mouvement de stock
// =============================================
app.post('/api/movement', async (req, res) => {
  try {
    const { product_id, quantity, movement_type, cooperant_id, reference_id, reason } = req.body;

    if (!product_id || !quantity || !movement_type) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', product_id)
      .single();

    if (productError) throw productError;

    let newStock = product.current_stock;

    if (movement_type === 'cooperant_take' || movement_type === 'retail_sale') {
      if (product.current_stock < quantity) {
        return res.status(400).json({ success: false, error: 'Stock insuffisant' });
      }
      newStock = product.current_stock - quantity;
    } else if (movement_type === 'cooperant_return' || movement_type === 'supplier_in') {
      newStock = product.current_stock + quantity;
    } else {
      return res.status(400).json({ success: false, error: 'Type de mouvement invalide' });
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({ current_stock: newStock })
      .eq('id', product_id);

    if (updateError) throw updateError;

    const quantityChange = (movement_type === 'cooperant_take' || movement_type === 'retail_sale')
      ? -quantity
      : quantity;

    const { data: movement, error: moveError } = await supabase
      .from('stock_movements')
      .insert({
        product_id,
        quantity_change: quantityChange,
        movement_type,
        cooperant_id: cooperant_id || null,
        reference_id: reference_id || null,
        reason: reason || ''
      })
      .select()
      .single();

    if (moveError) throw moveError;

    res.json({ success: true, data: movement });
  } catch (error) {
    console.error('Erreur mouvement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 3 : Récupérer les mouvements avec filtres
// =============================================
app.get('/api/movements', async (req, res) => {
  try {
    const { cooperant_id, start_date, end_date, movement_type } = req.query;

    let query = supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (cooperant_id) {
      query = query.eq('cooperant_id', cooperant_id);
    }
    if (movement_type) {
      query = query.eq('movement_type', movement_type);
    }
    if (start_date) {
      query = query.gte('created_at', `${start_date}T00:00:00`);
    }
    if (end_date) {
      query = query.lte('created_at', `${end_date}T23:59:59`);
    }

    const { data: movements, error } = await query;
    if (error) throw error;

    const productIds = [...new Set(movements.map(m => m.product_id).filter(Boolean))];
    const cooperantIds = [...new Set(movements.map(m => m.cooperant_id).filter(Boolean))];

    const [productsRes, sellersRes] = await Promise.all([
      productIds.length ? supabase.from('products').select('id, name, size, unit_price').in('id', productIds) : { data: [] },
      cooperantIds.length ? supabase.from('sellers').select('id, name').in('id', cooperantIds) : { data: [] }
    ]);

    const productMap = Object.fromEntries((productsRes.data || []).map(p => [p.id, p]));
    const sellerMap = Object.fromEntries((sellersRes.data || []).map(s => [s.id, s]));

    const result = movements.map(m => ({
      ...m,
      product: productMap[m.product_id] || null,
      cooperant: sellerMap[m.cooperant_id] || null
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur récupération mouvements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 4 : Suivi journalier des stocks
// =============================================
app.get('/api/stock/daily', async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, current_stock, reorder_level, size, bottles_per_pack');

    if (productError) throw productError;

    const { data: movements, error: moveError } = await supabase
      .from('stock_movements')
      .select('product_id, quantity_change, movement_type, created_at')
      .gte('created_at', startISO)
      .lt('created_at', endISO);

    if (moveError) throw moveError;

    const productStats = {};
    products.forEach(p => {
      productStats[p.id] = {
        id: p.id,
        name: p.name,
        current_stock: p.current_stock,
        reorder_level: p.reorder_level,
        size: p.size,
        bottles_per_pack: p.bottles_per_pack || 12,
        entries: 0,
        exits: 0,
      };
    });

    movements.forEach(m => {
      const pid = m.product_id;
      if (!productStats[pid]) return;
      const qty = Math.abs(m.quantity_change);
      const type = m.movement_type;

      if (type === 'supplier_in' || type === 'cooperant_return') {
        productStats[pid].entries += qty;
      } else if (type === 'cooperant_take' || type === 'retail_sale') {
        productStats[pid].exits += qty;
      }
    });

    const result = Object.values(productStats).map(p => {
      const initialStock = p.current_stock - p.entries + p.exits;
      return {
        ...p,
        initialStock: Math.max(initialStock, 0),
        finalStock: p.current_stock,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur suivi journalier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 5 : Enregistrer une vente
// =============================================
app.post('/api/sale', async (req, res) => {
  try {
    const {
      operator_id,
      client_id,
      total_amount,
      payment_method,
      note,
      sale_type,
      operation_type,
      phone_number,
      beneficiary_phone,
      beneficiary_name,
      confirmation_code
    } = req.body;

    if (!operator_id || !client_id || !total_amount) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });
    }

    const saleData = {
      operator_id,
      client_id,
      total_amount: parseFloat(total_amount),
      payment_method: payment_method || 'cash',
      note: note || null,
      sale_type: sale_type || 'emoney',
      operation_type: operation_type || null,
      phone_number: phone_number || null,
      beneficiary_phone: beneficiary_phone || null,
      beneficiary_name: beneficiary_name || null,
      confirmation_code: confirmation_code || null,
      sale_date: new Date().toISOString()
    };

    const { data: sale, error } = await supabase
      .from('sales')
      .insert(saleData)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: sale });
  } catch (error) {
    console.error('Erreur enregistrement vente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 6 : Ajouter du stock à un opérateur
// =============================================
app.post('/api/operator/stock/add', async (req, res) => {
  try {
    const { operator_id, type, quantity } = req.body;
    if (!operator_id || !type || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants ou invalides' });
    }
    const fieldMap = {
      'mega': 'stock_megas',
      'unite': 'stock_unites',
      'fc': 'stock_fc',
      'usd': 'stock_usd'
    };
    const field = fieldMap[type];
    if (!field) {
      return res.status(400).json({ success: false, error: 'Type invalide' });
    }
    const { data: op, error: fetchError } = await supabase
      .from('operators')
      .select(field)
      .eq('id', operator_id)
      .single();
    if (fetchError) throw fetchError;
    const newValue = (op[field] || 0) + parseInt(quantity);
    const { error: updateError } = await supabase
      .from('operators')
      .update({ [field]: newValue })
      .eq('id', operator_id);
    if (updateError) throw updateError;
    res.json({ success: true, data: { newValue } });
  } catch (error) {
    console.error('Erreur ajout stock opérateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 7 : Gestion du stock opérateur (ajout/retrait)
// =============================================
app.post('/api/stock/operator', async (req, res) => {
  try {
    const { operator_id, type, quantity, operation } = req.body;
    if (!operator_id || !type || quantity === undefined) {
      return res.status(400).json({ success: false, error: 'Champs requis' });
    }
    const field = type === 'mega' ? 'stock_megas' : 'stock_unites';
    const { data: op, error } = await supabase
      .from('operators')
      .select(field)
      .eq('id', operator_id)
      .single();
    if (error) throw error;
    let newStock = op[field];
    if (operation === 'add') {
      newStock += quantity;
    } else if (operation === 'remove') {
      if (newStock < quantity) return res.status(400).json({ success: false, error: 'Stock insuffisant' });
      newStock -= quantity;
    } else {
      return res.status(400).json({ success: false, error: 'Opération invalide' });
    }
    const { error: updateError } = await supabase
      .from('operators')
      .update({ [field]: newStock })
      .eq('id', operator_id);
    if (updateError) throw updateError;
    res.json({ success: true, data: { newStock } });
  } catch (error) {
    console.error('Erreur mise à jour stock opérateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 8 : Récupérer le stock d'un opérateur
// =============================================
app.get('/api/operators/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('operators')
      .select('stock_megas, stock_unites')
      .eq('id', id)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur récupération stock opérateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 9 : Récupérer les transactions de caisse
// =============================================
app.get('/api/cash/transactions', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = supabase
      .from('cash_transactions')
      .select('*')
      .order('transaction_date', { ascending: true });

    if (start_date) {
      query = query.gte('transaction_date', `${start_date}T00:00:00`);
    }
    if (end_date) {
      query = query.lte('transaction_date', `${end_date}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur récupération transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 10 : Ajouter une transaction de caisse
// =============================================
app.post('/api/cash/transaction', async (req, res) => {
  try {
    const { type, category, description, amount, payment_method, transaction_date } = req.body;
    if (!type || !category || !amount) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants' });
    }
    const { data, error } = await supabase
      .from('cash_transactions')
      .insert({
        type,
        category,
        description: description || '',
        amount: parseFloat(amount),
        payment_method: payment_method || 'cash',
        transaction_date: transaction_date || new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur ajout transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 11 : Récupérer tous les utilisateurs
// =============================================
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 12 : Ajouter un utilisateur
// =============================================
app.post('/api/users', async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ email, password: hashedPassword, full_name, role: role || 'user' })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur ajout utilisateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 13 : Modifier un utilisateur
// =============================================
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, active, password } = req.body;
    const updateData = { email, full_name, role, active, updated_at: new Date().toISOString() };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 14 : Supprimer un utilisateur
// =============================================
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 15 : Récupérer les paramètres
// =============================================
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur récupération paramètres:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 16 : Mettre à jour un paramètre
// =============================================
app.put('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Valeur requise' });
    }
    const { data, error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur mise à jour paramètre:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 17 : Connexion (login)
// =============================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, active, password')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    if (!user.active) {
      return res.status(401).json({ success: false, error: 'Compte désactivé' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.password;

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// ROUTE 18 : Vérification du token (me)
// =============================================
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, active')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Utilisateur introuvable' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Erreur vérification token:', error);
    res.status(401).json({ success: false, error: 'Token invalide' });
  }
});

// =============================================
// ✅ EXPORT POUR VERCEL (serverless)
// =============================================
export default serverless(app);

// Pour le développement local
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Backend démarré sur http://localhost:${PORT}`);
  });
}