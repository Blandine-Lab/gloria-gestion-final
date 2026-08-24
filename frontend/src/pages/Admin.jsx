import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import axios from 'axios';

// Liste des modules disponibles (correspond aux onglets de la navbar)
const MODULES = [
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'stocks', label: 'Gestion des stocks' },
  { key: 'sorties', label: 'Sorties / Ventes' },
  { key: 'ventes-mega', label: 'Ventes de méga & e-money' },
  { key: 'rapports', label: 'Rapports & Statistiques' },
  { key: 'clients', label: 'Gestion des clients' },
  { key: 'vendeurs', label: 'Gestion des vendeurs' },
  { key: 'caisse', label: 'Caisse / Journal de caisse' },
  { key: 'parametres', label: 'Paramètres' },
  { key: 'sauvegarde', label: 'Sauvegarde / Export' },
];

const Admin = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  // Coopérants
  const [sellers, setSellers] = useState([]);
  const [newSeller, setNewSeller] = useState({ name: '', email: '', phone: '' });

  // Produits
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    unit_price: '',
    bottles_per_pack: 12,
    pack_price: '',
    pack_quantity: '',
    current_stock: '',
    reorder_level: '',
    size: 'small'
  });

  // Opérateurs
  const [operators, setOperators] = useState([]);
  const [newOperator, setNewOperator] = useState({ name: '' });
  const [operatorStockUpdate, setOperatorStockUpdate] = useState({ id: '', type: 'mega', quantity: '' });
  const [operatorMoneyUpdate, setOperatorMoneyUpdate] = useState({ id: '', currency: 'FC', amount: '' });

  // Clients
  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState({ name: '', phone: '', credit_balance: '' });

  // Utilisateurs (avec permissions)
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    active: true,
    permissions: [],
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const ADMIN_PASSWORD = 'gloria2025';

  const ALLOWED_OPERATORS = [
    'Vodacom M-Pesa',
    'Airtel Money',
    'Orange Money',
    'Africell Money'
  ];

  // =============================================
  // CONNEXION ADMIN
  // =============================================
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchAllData();
    } else {
      alert('Mot de passe incorrect');
    }
  };

  // =============================================
  // CHARGEMENT DES DONNÉES
  // =============================================
  const fetchAllData = async () => {
    await Promise.all([
      fetchSellers(),
      fetchProducts(),
      fetchOperators(),
      fetchClients(),
      fetchUsers(),
    ]);
  };

  const fetchSellers = async () => {
    const { data, error } = await supabase.from('sellers').select('*').order('name');
    if (!error) setSellers(data || []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error) setProducts(data || []);
  };

  const fetchOperators = async () => {
    const { data, error } = await supabase.from('operators').select('*').order('name');
    if (!error) {
      const filtered = data.filter(op => ALLOWED_OPERATORS.includes(op.name));
      setOperators(filtered);
    }
  };

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (!error) setClients(data || []);
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  // =============================================
  // GESTION DES COOPÉRANTS
  // =============================================
  const addSeller = async (e) => {
    e.preventDefault();
    if (!newSeller.name) {
      setMessage({ text: 'Le nom est requis', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('sellers').insert([newSeller]).select();
      if (error) throw error;
      setSellers([...sellers, data[0]]);
      setNewSeller({ name: '', email: '', phone: '' });
      setMessage({ text: '✅ Coopérant ajouté', type: 'success' });
    } catch (error) {
      setMessage({ text: '❌ Erreur: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteSeller = async (id) => {
    if (!confirm('Supprimer ce coopérant ?')) return;
    const { error } = await supabase.from('sellers').delete().eq('id', id);
    if (!error) {
      setSellers(sellers.filter(s => s.id !== id));
      setMessage({ text: '✅ Coopérant supprimé', type: 'success' });
    }
  };

  // =============================================
  // GESTION DES PRODUITS
  // =============================================
  const handleProductChange = (e) => {
    const { name, value } = e.target;
    setNewProduct(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'unit_price' || name === 'bottles_per_pack') {
        const unitPrice = parseFloat(updated.unit_price) || 0;
        const bottlesPerPack = parseInt(updated.bottles_per_pack) || 0;
        updated.pack_price = (unitPrice * bottlesPerPack).toString();
      }
      if (name === 'pack_quantity' || name === 'bottles_per_pack') {
        const packQty = parseInt(updated.pack_quantity) || 0;
        const bottlesPerPack = parseInt(updated.bottles_per_pack) || 0;
        updated.current_stock = (packQty * bottlesPerPack).toString();
      }
      return updated;
    });
  };

  const addProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.unit_price) {
      setMessage({ text: 'Le nom et le prix sont requis', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const productData = {
        name: newProduct.name,
        unit_price: parseFloat(newProduct.unit_price),
        bottles_per_pack: parseInt(newProduct.bottles_per_pack) || 12,
        pack_price: parseFloat(newProduct.pack_price) || 0,
        current_stock: parseInt(newProduct.current_stock) || 0,
        reorder_level: parseInt(newProduct.reorder_level) || 5,
        size: newProduct.size || 'small'
      };
      const { data, error } = await supabase.from('products').insert([productData]).select();
      if (error) throw error;
      setProducts([...products, data[0]]);
      setNewProduct({
        name: '',
        unit_price: '',
        bottles_per_pack: 12,
        pack_price: '',
        pack_quantity: '',
        current_stock: '',
        reorder_level: '',
        size: 'small'
      });
      setMessage({ text: '✅ Produit ajouté', type: 'success' });
    } catch (error) {
      setMessage({ text: '❌ Erreur: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      setProducts(products.filter(p => p.id !== id));
      setMessage({ text: '✅ Produit supprimé', type: 'success' });
    }
  };

  // =============================================
  // GESTION DES OPÉRATEURS
  // =============================================
  const addOperator = async (e) => {
    e.preventDefault();
    if (!newOperator.name) {
      setMessage({ text: 'Le nom est requis', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('operators')
        .insert({
          name: newOperator.name,
          stock_megas: 0,
          stock_unites: 0,
          stock_fc: 0,
          stock_usd: 0
        })
        .select();
      if (error) throw error;
      setOperators([...operators, data[0]]);
      setNewOperator({ name: '' });
      setMessage({ text: '✅ Opérateur ajouté', type: 'success' });
    } catch (error) {
      setMessage({ text: '❌ Erreur: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteOperator = async (id) => {
    if (!confirm('Supprimer cet opérateur ?')) return;
    const { error } = await supabase.from('operators').delete().eq('id', id);
    if (!error) {
      setOperators(operators.filter(o => o.id !== id));
      setMessage({ text: '✅ Opérateur supprimé', type: 'success' });
    }
  };

  const updateOperatorStock = async (e) => {
    e.preventDefault();
    const { id, type, quantity } = operatorStockUpdate;
    if (!id || !quantity || parseInt(quantity) <= 0) {
      setMessage({ text: 'Veuillez choisir un opérateur, un type et une quantité positive', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const field = type === 'mega' ? 'stock_megas' : 'stock_unites';
      const { data: op, error: fetchError } = await supabase
        .from('operators')
        .select(field)
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;
      const newValue = op[field] + parseInt(quantity);
      const { error: updateError } = await supabase
        .from('operators')
        .update({ [field]: newValue })
        .eq('id', id);
      if (updateError) throw updateError;
      fetchOperators();
      setOperatorStockUpdate({ id: '', type: 'mega', quantity: '' });
      setMessage({ text: `✅ Stock ${type === 'mega' ? 'mégas' : 'unités'} mis à jour`, type: 'success' });
    } catch (error) {
      setMessage({ text: '❌ Erreur: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateOperatorMoney = async (e) => {
    e.preventDefault();
    const { id, currency, amount } = operatorMoneyUpdate;
    if (!id || !amount || parseInt(amount) <= 0) {
      setMessage({ text: 'Veuillez choisir un opérateur, une devise et un montant positif', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const field = currency === 'FC' ? 'stock_fc' : 'stock_usd';
      const { data: op, error: fetchError } = await supabase
        .from('operators')
        .select(field)
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;
      const newValue = op[field] + parseInt(amount);
      const { error: updateError } = await supabase
        .from('operators')
        .update({ [field]: newValue })
        .eq('id', id);
      if (updateError) throw updateError;
      fetchOperators();
      setOperatorMoneyUpdate({ id: '', currency: 'FC', amount: '' });
      setMessage({ text: `✅ Solde ${currency} mis à jour`, type: 'success' });
    } catch (error) {
      setMessage({ text: '❌ Erreur: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // GESTION DES CLIENTS
  // =============================================
  const addClient = async (e) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) {
      setMessage({ text: 'Le nom et le téléphone sont requis', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const clientData = {
        name: newClient.name,
        phone: newClient.phone,
        credit_balance: parseFloat(newClient.credit_balance) || 0
      };
      const { data, error } = await supabase.from('clients').insert([clientData]).select();
      if (error) throw error;
      setClients([...clients, data[0]]);
      setNewClient({ name: '', phone: '', credit_balance: '' });
      setMessage({ text: '✅ Client ajouté', type: 'success' });
    } catch (error) {
      setMessage({ text: '❌ Erreur: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (id) => {
    if (!confirm('Supprimer ce client ?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) {
      setClients(clients.filter(c => c.id !== id));
      setMessage({ text: '✅ Client supprimé', type: 'success' });
    }
  };

  // =============================================
  // GESTION DES UTILISATEURS (avec permissions)
  // =============================================
  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        email: user.email,
        password: '',
        full_name: user.full_name || '',
        role: user.role,
        active: user.active,
        permissions: user.permissions || [],
      });
    } else {
      setEditingUser(null);
      setUserForm({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        active: true,
        permissions: [],
      });
    }
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleUserFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePermissionToggle = (moduleKey) => {
    setUserForm(prev => {
      const newPermissions = prev.permissions.includes(moduleKey)
        ? prev.permissions.filter(p => p !== moduleKey)
        : [...prev.permissions, moduleKey];
      return { ...prev, permissions: newPermissions };
    });
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.email || (!editingUser && !userForm.password)) {
      setMessage({ text: 'Email et mot de passe requis', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      let response;
      if (editingUser) {
        response = await axios.put(`http://localhost:5000/api/users/${editingUser.id}`, userForm);
      } else {
        response = await axios.post('http://localhost:5000/api/users', userForm);
      }
      if (response.data.success) {
        closeUserModal();
        fetchUsers();
        setMessage({ text: `✅ Utilisateur ${editingUser ? 'modifié' : 'créé'} avec succès`, type: 'success' });
      } else {
        setMessage({ text: response.data.error || 'Erreur', type: 'error' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: '❌ Erreur serveur', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Supprimer cet utilisateur définitivement ?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`);
      fetchUsers();
      setMessage({ text: '✅ Utilisateur supprimé', type: 'success' });
    } catch (error) {
      console.error(error);
      setMessage({ text: '❌ Erreur suppression', type: 'error' });
    }
  };

  // =============================================
  // ÉCRAN DE CONNEXION ADMIN
  // =============================================
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <form onSubmit={handleLogin} style={{ background: 'white', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: '350px' }}>
          <h2 style={{ textAlign: 'center', color: '#1e3a8a' }}>🔐 Accès administrateur</h2>
          <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '1.5rem' }}>Veuillez saisir le mot de passe</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '1rem' }}
          />
          <button
            type="submit"
            style={{ width: '100%', padding: '0.75rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Connexion
          </button>
        </form>
      </div>
    );
  }

  // =============================================
  // PANNEAU D'ADMINISTRATION
  // =============================================
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '0.5rem', color: '#1e3a8a' }}>⚙️ Administration</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Gestion des coopérants, produits, opérateurs, clients et utilisateurs</p>

      {message.text && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#d1fae5' : '#fecaca',
          color: message.type === 'success' ? '#065f46' : '#991b1b'
        }}>
          {message.text}
        </div>
      )}

      {/* ============================================
          SECTION : Gestion des utilisateurs
          ============================================ */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>👥 Gestion des utilisateurs</h3>
          <button
            onClick={() => openUserModal()}
            style={{ background: '#10b981', color: 'white', padding: '0.3rem 1rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
          >
            ➕ Nouvel utilisateur
          </button>
        </div>

        {users.length === 0 ? (
          <p>Aucun utilisateur enregistré.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Email</th>
                  <th style={{ padding: '0.5rem' }}>Nom</th>
                  <th style={{ padding: '0.5rem' }}>Rôle</th>
                  <th style={{ padding: '0.5rem' }}>Actif</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem' }}>{u.email}</td>
                    <td style={{ padding: '0.5rem' }}>{u.full_name || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>{u.role}</td>
                    <td style={{ padding: '0.5rem' }}>{u.active ? '✅' : '❌'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <button
                        onClick={() => openUserModal(u)}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.2rem 0.7rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }}
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.2rem 0.7rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                      >
                        🗑️ Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal d'ajout/modification d'utilisateur */}
        {showUserModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '1rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}>
              <h2 style={{ marginTop: 0, color: '#1f2937' }}>{editingUser ? '✏️ Modifier' : '➕ Nouvel utilisateur'}</h2>
              <form onSubmit={handleUserSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={userForm.email}
                    onChange={handleUserFormChange}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>
                    {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={userForm.password}
                    onChange={handleUserFormChange}
                    required={!editingUser}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Nom complet</label>
                  <input
                    type="text"
                    name="full_name"
                    value={userForm.full_name}
                    onChange={handleUserFormChange}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Rôle</label>
                  <select
                    name="role"
                    value={userForm.role}
                    onChange={handleUserFormChange}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                  >
                    <option value="admin">Administrateur</option>
                    <option value="manager">Manager</option>
                    <option value="user">Utilisateur</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Permissions</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem' }}>
                    {MODULES.map(mod => (
                      <label key={mod.key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', color: '#1f2937', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={userForm.permissions?.includes(mod.key) || false}
                          onChange={() => handlePermissionToggle(mod.key)}
                        />
                        {mod.label}
                      </label>
                    ))}
                  </div>
                  <small style={{ color: '#6b7280' }}>Les administrateurs ont accès à tous les modules.</small>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="active"
                      checked={userForm.active}
                      onChange={handleUserFormChange}
                    />
                    Actif
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeUserModal} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                    Annuler
                  </button>
                  <button type="submit" disabled={loading} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                    {loading ? 'Enregistrement...' : editingUser ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ============================================
          LIGNE 1 : Coopérants et Produits (inchangé)
          ============================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
        {/* Ajouter un coopérant */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>👤 Ajouter un coopérant</h3>
          <form onSubmit={addSeller}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nom</label>
              <input
                type="text"
                value={newSeller.name}
                onChange={(e) => setNewSeller({...newSeller, name: e.target.value})}
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Email</label>
              <input
                type="email"
                value={newSeller.email}
                onChange={(e) => setNewSeller({...newSeller, email: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Téléphone</label>
              <input
                type="text"
                value={newSeller.phone}
                onChange={(e) => setNewSeller({...newSeller, phone: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {loading ? 'Ajout...' : 'Ajouter le coopérant'}
            </button>
          </form>
        </div>

        {/* Ajouter un produit */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>🧃 Ajouter un produit</h3>
          <form onSubmit={addProduct}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nom du produit</label>
              <input
                type="text"
                name="name"
                value={newProduct.name}
                onChange={handleProductChange}
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Prix unitaire (par bouteille) en FC</label>
              <input
                type="number"
                name="unit_price"
                value={newProduct.unit_price}
                onChange={handleProductChange}
                required
                step="0.01"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nombre de bouteilles par paquet</label>
              <input
                type="number"
                name="bottles_per_pack"
                value={newProduct.bottles_per_pack}
                onChange={handleProductChange}
                required
                min="1"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Prix du paquet (calculé automatiquement)</label>
              <input
                type="number"
                name="pack_price"
                value={newProduct.pack_price}
                onChange={handleProductChange}
                readOnly
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f3f4f6' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nombre de paquets (pour le stock)</label>
              <input
                type="number"
                name="pack_quantity"
                value={newProduct.pack_quantity}
                onChange={handleProductChange}
                min="0"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Stock initial (en bouteilles) – calculé automatiquement</label>
              <input
                type="number"
                name="current_stock"
                value={newProduct.current_stock}
                onChange={handleProductChange}
                readOnly
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: '#f3f4f6' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Seuil d'alerte (en bouteilles)</label>
              <input
                type="number"
                name="reorder_level"
                value={newProduct.reorder_level}
                onChange={handleProductChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Taille de bouteille</label>
              <select
                name="size"
                value={newProduct.size}
                onChange={handleProductChange}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              >
                <option value="small">Petite bouteille</option>
                <option value="big">Grande bouteille</option>
              </select>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {loading ? 'Ajout...' : 'Ajouter le produit'}
            </button>
          </form>
        </div>
      </div>

      {/* ============================================
          LIGNE 2 : Opérateurs et Clients
          ============================================ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
        {/* Opérateurs */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>📱 Gestion des opérateurs</h3>
          <form onSubmit={addOperator} style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nom de l'opérateur</label>
              <input
                type="text"
                value={newOperator.name}
                onChange={(e) => setNewOperator({ name: e.target.value })}
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                placeholder="Ex: Vodacom M-Pesa"
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {loading ? 'Ajout...' : 'Ajouter l\'opérateur'}
            </button>
          </form>

          <h4 style={{ marginBottom: '0.5rem' }}>Liste des opérateurs</h4>
          {operators.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aucun opérateur</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={{ padding: '0.3rem' }}>Nom</th>
                    <th style={{ padding: '0.3rem', textAlign: 'center' }}>Mégas</th>
                    <th style={{ padding: '0.3rem', textAlign: 'center' }}>Unités</th>
                    <th style={{ padding: '0.3rem', textAlign: 'center' }}>Stock FC</th>
                    <th style={{ padding: '0.3rem', textAlign: 'center' }}>Stock USD</th>
                    <th style={{ padding: '0.3rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map(op => (
                    <tr key={op.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.3rem' }}>{op.name}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>{op.stock_megas || 0}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>{op.stock_unites || 0}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>{op.stock_fc || 0}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>{op.stock_usd || 0}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                        <button
                          onClick={() => navigate(`/entrees-operateurs?operator_id=${op.id}`)}
                          style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.3rem' }}
                        >
                          Ajouter stock
                        </button>
                        <button onClick={() => deleteOperator(op.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer' }}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Ajouter du stock (mégas / unités)</h4>
          <form onSubmit={updateOperatorStock}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select
                value={operatorStockUpdate.id}
                onChange={(e) => setOperatorStockUpdate({ ...operatorStockUpdate, id: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              >
                <option value="">Opérateur</option>
                {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
              <select
                value={operatorStockUpdate.type}
                onChange={(e) => setOperatorStockUpdate({ ...operatorStockUpdate, type: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              >
                <option value="mega">Mégas</option>
                <option value="unite">Unités</option>
              </select>
              <input
                type="number"
                placeholder="Quantité"
                value={operatorStockUpdate.quantity}
                onChange={(e) => setOperatorStockUpdate({ ...operatorStockUpdate, quantity: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                min="1"
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {loading ? 'Ajout...' : 'Ajouter au stock'}
            </button>
          </form>

          <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Ajouter du solde (FC / USD)</h4>
          <form onSubmit={updateOperatorMoney}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <select
                value={operatorMoneyUpdate.id}
                onChange={(e) => setOperatorMoneyUpdate({ ...operatorMoneyUpdate, id: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              >
                <option value="">Opérateur</option>
                {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
              <select
                value={operatorMoneyUpdate.currency}
                onChange={(e) => setOperatorMoneyUpdate({ ...operatorMoneyUpdate, currency: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              >
                <option value="FC">FC</option>
                <option value="USD">USD</option>
              </select>
              <input
                type="number"
                placeholder="Montant"
                value={operatorMoneyUpdate.amount}
                onChange={(e) => setOperatorMoneyUpdate({ ...operatorMoneyUpdate, amount: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                min="1"
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {loading ? 'Ajout...' : 'Ajouter au solde'}
            </button>
          </form>
        </div>

        {/* Clients */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0 }}>👥 Gestion des clients</h3>
          <form onSubmit={addClient} style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nom</label>
              <input
                type="text"
                value={newClient.name}
                onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Téléphone</label>
              <input
                type="text"
                value={newClient.phone}
                onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                required
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Solde crédit (FC) (optionnel)</label>
              <input
                type="number"
                step="0.01"
                value={newClient.credit_balance}
                onChange={(e) => setNewClient({...newClient, credit_balance: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
              {loading ? 'Ajout...' : 'Ajouter le client'}
            </button>
          </form>

          <h4 style={{ marginBottom: '0.5rem' }}>Liste des clients</h4>
          {clients.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aucun client</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={{ padding: '0.3rem' }}>Nom</th>
                    <th style={{ padding: '0.3rem' }}>Téléphone</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right' }}>Crédit</th>
                    <th style={{ padding: '0.3rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.3rem' }}>{c.name}</td>
                      <td style={{ padding: '0.3rem' }}>{c.phone}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'right' }}>{c.credit_balance || 0} FC</td>
                      <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                        <button onClick={() => deleteClient(c.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', cursor: 'pointer' }}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================
          LISTE DES COOPÉRANTS
          ============================================ */}
      <div style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3>👥 Coopérants</h3>
        {sellers.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun coopérant enregistré.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Nom</th>
                  <th style={{ padding: '0.5rem' }}>Email</th>
                  <th style={{ padding: '0.5rem' }}>Téléphone</th>
                  <th style={{ padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem' }}>{s.name}</td>
                    <td style={{ padding: '0.5rem' }}>{s.email || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>{s.phone || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <button onClick={() => deleteSeller(s.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer' }}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================
          LISTE DES PRODUITS
          ============================================ */}
      <div style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3>🧃 Produits</h3>
        {products.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun produit enregistré.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Nom</th>
                  <th style={{ padding: '0.5rem' }}>Taille</th>
                  <th style={{ padding: '0.5rem' }}>Nb Bouteilles/Paquet</th>
                  <th style={{ padding: '0.5rem' }}>Prix Bouteille (FC)</th>
                  <th style={{ padding: '0.5rem' }}>Prix Paquet (FC)</th>
                  <th style={{ padding: '0.5rem' }}>Stock (Paquets)</th>
                  <th style={{ padding: '0.5rem' }}>Stock (Bouteilles)</th>
                  <th style={{ padding: '0.5rem' }}>Stock Total Bouteilles</th>
                  <th style={{ padding: '0.5rem' }}>Seuil</th>
                  <th style={{ padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const bottlesPerPack = p.bottles_per_pack || 12;
                  const stockPaquets = Math.floor(p.current_stock / bottlesPerPack);
                  const stockBouteilles = p.current_stock % bottlesPerPack;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem' }}>{p.name}</td>
                      <td style={{ padding: '0.5rem' }}>{p.size === 'big' ? 'Grande' : 'Petite'}</td>
                      <td style={{ padding: '0.5rem' }}>{bottlesPerPack}</td>
                      <td style={{ padding: '0.5rem' }}>{p.unit_price} FC</td>
                      <td style={{ padding: '0.5rem' }}>{p.pack_price || (p.unit_price * bottlesPerPack)} FC</td>
                      <td style={{ padding: '0.5rem' }}>{stockPaquets}</td>
                      <td style={{ padding: '0.5rem' }}>{stockBouteilles}</td>
                      <td style={{ padding: '0.5rem', color: p.current_stock < p.reorder_level ? 'red' : 'inherit' }}>
                        {p.current_stock}
                      </td>
                      <td style={{ padding: '0.5rem' }}>{p.reorder_level}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <button
                          onClick={() => navigate(`/entrees?product_id=${p.id}`)}
                          style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.3rem' }}
                        >
                          Ajouter stock
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer' }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;