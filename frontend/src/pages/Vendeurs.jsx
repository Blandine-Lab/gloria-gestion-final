import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const Vendeurs = () => {
  const [vendeurs, setVendeurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingVendeur, setEditingVendeur] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [showPerformance, setShowPerformance] = useState(false);
  const [selectedVendeur, setSelectedVendeur] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [movements, setMovements] = useState([]);

  useEffect(() => {
    fetchVendeurs();
  }, []);

  const fetchVendeurs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('name');
      if (error) throw error;
      setVendeurs(data || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement des vendeurs');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (vendeur = null) => {
    if (vendeur) {
      setEditingVendeur(vendeur);
      setFormData({
        name: vendeur.name,
        email: vendeur.email || '',
        phone: vendeur.phone || '',
      });
    } else {
      setEditingVendeur(null);
      setFormData({ name: '', email: '', phone: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendeur(null);
    setFormData({ name: '', email: '', phone: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Le nom est obligatoire');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
      };

      if (editingVendeur) {
        const { error } = await supabase
          .from('sellers')
          .update(payload)
          .eq('id', editingVendeur.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sellers')
          .insert([payload]);
        if (error) throw error;
      }
      closeModal();
      fetchVendeurs();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const deleteVendeur = async (id) => {
    if (!window.confirm('Supprimer ce vendeur définitivement ?')) return;
    try {
      const { error } = await supabase
        .from('sellers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchVendeurs();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const viewPerformance = async (vendeur) => {
    setSelectedVendeur(vendeur);
    setShowPerformance(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: moves, error: movesError } = await supabase
        .from('stock_movements')
        .select(`
          quantity_change,
          movement_type,
          created_at,
          products(name, unit_price)
        `)
        .eq('cooperant_id', vendeur.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });
      if (movesError) throw movesError;

      let totalTake = 0;
      let totalReturn = 0;
      const productMap = {};
      moves.forEach(m => {
        const pid = m.product_id;
        if (!pid) return;
        if (!productMap[pid]) {
          productMap[pid] = { qty: 0, price: m.products?.unit_price || 0 };
        }
        if (m.movement_type === 'cooperant_take') {
          totalTake += Math.abs(m.quantity_change);
          productMap[pid].qty += Math.abs(m.quantity_change);
        } else if (m.movement_type === 'cooperant_return') {
          totalReturn += Math.abs(m.quantity_change);
          productMap[pid].qty -= Math.abs(m.quantity_change);
        }
      });
      let totalNetAmount = 0;
      for (const pid in productMap) {
        totalNetAmount += productMap[pid].qty * productMap[pid].price;
      }
      const netSold = totalTake - totalReturn;

      setPerformanceData({
        totalTake,
        totalReturn,
        netSold,
        totalNetAmount,
        movementCount: moves.length,
      });
      setMovements(moves);
    } catch (err) {
      console.error(err);
      setError('Erreur chargement performances');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement des vendeurs...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', paddingTop: '80px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#1e3a8a', marginBottom: '0.25rem' }}>👥 Gestion des vendeurs</h1>
        <p style={{ color: '#6b7280', fontSize: '1rem', marginTop: 0 }}>(coopérants)</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div></div> {/* Spacer pour aligner le bouton à droite */}
        <button
          onClick={() => openModal()}
          style={{ background: '#10b981', color: 'white', padding: '0.5rem 1.5rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
        >
          ➕ Nouveau vendeur
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {vendeurs.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Aucun vendeur enregistré.</p>
      ) : (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Nom</th>
                <th style={{ padding: '0.75rem' }}>Email</th>
                <th style={{ padding: '0.75rem' }}>Téléphone</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendeurs.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>{v.name}</td>
                  <td style={{ padding: '0.75rem' }}>{v.email || '-'}</td>
                  <td style={{ padding: '0.75rem' }}>{v.phone || '-'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => viewPerformance(v)}
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      📊 Performances
                    </button>
                    <button
                      onClick={() => openModal(v)}
                      style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => deleteVendeur(v.id)}
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
              {editingVendeur ? '✏️ Modifier le vendeur' : '➕ Nouveau vendeur'}
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
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Téléphone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  {editingVendeur ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de performance */}
      {showPerformance && selectedVendeur && (
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
            maxWidth: '900px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h2 style={{ marginTop: 0 }}>📊 Performances de {selectedVendeur.name}</h2>
            <p style={{ color: '#6b7280' }}>Aujourd'hui</p>

            {performanceData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Total Pris</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{performanceData.totalTake}</p>
                </div>
                <div style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Total Retourné</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{performanceData.totalReturn}</p>
                </div>
                <div style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Net Vendu</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{performanceData.netSold}</p>
                </div>
                <div style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Montant (FC)</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{performanceData.totalNetAmount.toFixed(0)}</p>
                </div>
              </div>
            ) : <p>Chargement...</p>}

            <h3 style={{ marginTop: '1rem' }}>📋 Mouvements du jour</h3>
            {movements.length === 0 ? (
              <p>Aucun mouvement aujourd'hui.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Heure</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Produit</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Quantité</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Prix unitaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem' }}>{new Date(m.created_at).toLocaleTimeString()}</td>
                        <td style={{ padding: '0.5rem' }}>{m.movement_type === 'cooperant_take' ? 'Prise' : 'Retour'}</td>
                        <td style={{ padding: '0.5rem' }}>{m.products?.name || '-'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Math.abs(m.quantity_change)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.products?.unit_price || 0} FC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPerformance(false)} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendeurs;