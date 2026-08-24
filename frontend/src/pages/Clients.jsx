import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', credit_balance: '' });
  const [viewingClient, setViewingClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      setClients(data || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        phone: client.phone,
        credit_balance: client.credit_balance?.toString() || '',
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', phone: '', credit_balance: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', credit_balance: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      setError('Le nom et le téléphone sont obligatoires');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        credit_balance: parseFloat(formData.credit_balance) || 0,
      };

      if (editingClient) {
        // Modification
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        // Ajout
        const { error } = await supabase
          .from('clients')
          .insert([payload]);
        if (error) throw error;
      }
      closeModal();
      fetchClients();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const deleteClient = async (id) => {
    if (!window.confirm('Supprimer ce client définitivement ?')) return;
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchClients();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const viewHistory = async (client) => {
    setViewingClient(client);
    setShowHistory(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          total_amount,
          payment_method,
          sale_date,
          note,
          sale_type,
          operators(name)
        `)
        .eq('client_id', client.id)
        .order('sale_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error(err);
      setError('Erreur chargement historique');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement des clients...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#1e3a8a' }}>👥 Gestion des clients</h1>
        <button
          onClick={() => openModal()}
          style={{ background: '#10b981', color: 'white', padding: '0.5rem 1.5rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
        >
          ➕ Nouveau client
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {clients.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Aucun client enregistré.</p>
      ) : (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Nom</th>
                <th style={{ padding: '0.75rem' }}>Téléphone</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Solde crédit (FC)</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem' }}>{c.phone}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{c.credit_balance || 0}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => viewHistory(c)}
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      📜 Historique
                    </button>
                    <button
                      onClick={() => openModal(c)}
                      style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => deleteClient(c.id)}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer' }}
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

      {/* Modal d'ajout / modification */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '1rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h2 style={{ marginTop: 0 }}>
              {editingClient ? '✏️ Modifier le client' : '➕ Nouveau client'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Téléphone *</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Solde crédit (FC) (optionnel)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.credit_balance}
                  onChange={(e) => setFormData({ ...formData, credit_balance: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  {editingClient ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'historique des transactions */}
      {showHistory && viewingClient && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '1rem',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h2 style={{ marginTop: 0 }}>📜 Historique de {viewingClient.name}</h2>
            {transactions.length === 0 ? (
              <p>Aucune transaction pour ce client.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Montant</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Type</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Opérateur</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem' }}>{new Date(t.sale_date).toLocaleString()}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{t.total_amount.toFixed(0)} FC</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{t.sale_type || 'emoney'}</td>
                      <td style={{ padding: '0.5rem' }}>{t.operators?.name || '-'}</td>
                      <td style={{ padding: '0.5rem' }}>{t.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHistory(false)} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;