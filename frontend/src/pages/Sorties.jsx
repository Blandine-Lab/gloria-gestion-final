import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../utils/supabaseClient';

const Sorties = () => {
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [filterCooperant, setFilterCooperant] = useState('');
  const [filterType, setFilterType] = useState('');

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCooperator, setSelectedCooperator] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [movementType, setMovementType] = useState('cooperant_take');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchData();
    fetchMovements();
  }, []);

  useEffect(() => {
    fetchMovements();
  }, [filterCooperant, filterType]);

  const fetchData = async () => {
    try {
      const [productsRes, sellersRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('sellers').select('*')
      ]);
      setProducts(productsRes.data || []);
      setSellers(sellersRes.data || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
    }
  };

  const fetchMovements = async () => {
    try {
      const params = new URLSearchParams();
      if (filterCooperant) params.append('cooperant_id', filterCooperant);
      if (filterType) params.append('movement_type', filterType);
      const today = new Date().toISOString().split('T')[0];
      params.append('start_date', today);

      const response = await axios.get(`http://localhost:5000/api/movements?${params.toString()}`);
      if (response.data.success) {
        setMovements(response.data.data);
      } else {
        console.error('Erreur API :', response.data.error);
      }
    } catch (error) {
      console.error('Erreur chargement mouvements:', error);
      setMessage({ text: '❌ Erreur de chargement de l\'historique', type: 'error' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct || quantity < 1) {
      setMessage({ text: 'Veuillez remplir tous les champs', type: 'error' });
      return;
    }
    if ((movementType === 'cooperant_take' || movementType === 'cooperant_return') && !selectedCooperator) {
      setMessage({ text: 'Veuillez sélectionner un coopérant', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await axios.post('http://localhost:5000/api/movement', {
        product_id: selectedProduct,
        quantity: parseInt(quantity),
        movement_type: movementType,
        cooperant_id: selectedCooperator || null,
        reason: movementType === 'cooperant_take' ? 'Prise par coopérant' :
                movementType === 'cooperant_return' ? 'Retour de coopérant' : 'Vente en détail'
      });

      if (response.data.success) {
        setMessage({ text: '✅ Mouvement enregistré avec succès !', type: 'success' });
        setQuantity(1);
        const { data } = await supabase.from('products').select('*');
        setProducts(data);
        fetchMovements();
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

  // Traductions des types
  const typeLabels = {
    cooperant_take: 'Prise',
    cooperant_return: 'Retour',
    retail_sale: 'Vente détail',
    supplier_in: 'Réapprov.'
  };

  // Fonction pour formater les paquets (12 bouteilles par paquet)
  const formatPackets = (qty) => {
    const absQty = Math.abs(qty);
    const packs = Math.floor(absQty / 12);
    const rest = absQty % 12;
    if (packs === 0) return `${rest} bouteille${rest > 1 ? 's' : ''}`;
    return `${packs} paquet${packs > 1 ? 's' : ''}${rest > 0 ? ` + ${rest} bouteille${rest > 1 ? 's' : ''}` : ''}`;
  };

  // Récapitulatif détaillé par coopérant et produit (incluant ventes en détail)
  const getDetailedSummary = () => {
    const map = {};
    movements.forEach(m => {
      const productId = m.product_id;
      if (!productId) return;

      const isRetail = m.movement_type === 'retail_sale';
      const cooperantId = m.cooperant_id;

      // Clé unique : pour les ventes détail on utilise 'retail|productId'
      const key = isRetail ? `retail|${productId}` : (cooperantId ? `${cooperantId}|${productId}` : null);
      if (!key) return;

      if (isRetail) {
        // Vente en détail
        if (!map[key]) {
          map[key] = {
            cooperantName: 'Vente en détail',
            productName: m.product?.name || 'Inconnu',
            unitPrice: m.product?.unit_price || 0,
            totalTake: 0,
            totalReturn: 0,
            totalRetail: 0
          };
        }
        const qty = Math.abs(m.quantity_change);
        map[key].totalRetail += qty;
      } else {
        // Mouvements des coopérants (prise / retour)
        if (!cooperantId) return;
        if (!map[key]) {
          map[key] = {
            cooperantName: m.cooperant?.name || 'Inconnu',
            productName: m.product?.name || 'Inconnu',
            unitPrice: m.product?.unit_price || 0,
            totalTake: 0,
            totalReturn: 0,
            totalRetail: 0
          };
        }
        const qty = Math.abs(m.quantity_change);
        if (m.movement_type === 'cooperant_take') {
          map[key].totalTake += qty;
        } else if (m.movement_type === 'cooperant_return') {
          map[key].totalReturn += qty;
        }
      }
    });

    const result = Object.values(map).map(item => {
      const netSold = item.totalTake - item.totalReturn + item.totalRetail;
      const amount = netSold * item.unitPrice;
      return { ...item, netSold, amount };
    });
    return result.filter(item => item.netSold !== 0);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', color: '#dc2626', fontWeight: 'bold' }}>
        📦 Sorties / Ventes
      </h1>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Type de mouvement</label>
          <select 
            value={movementType} 
            onChange={(e) => setMovementType(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
          >
            <option value="cooperant_take">Prise par coopérant</option>
            <option value="cooperant_return">Retour de coopérant</option>
            <option value="retail_sale">Vente en détail</option>
          </select>
        </div>

        {(movementType === 'cooperant_take' || movementType === 'cooperant_return') && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Coopérant</label>
            <select 
              value={selectedCooperator} 
              onChange={(e) => setSelectedCooperator(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
            >
              <option value="">Sélectionner un coopérant</option>
              {sellers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Produit</label>
          <select 
            value={selectedProduct} 
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
          >
            <option value="">Sélectionner un produit</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Quantité</label>
          <input 
            type="number" 
            min="1"
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
          />
        </div>

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

        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Enregistrement...' : 'Enregistrer le mouvement'}
        </button>
      </form>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select 
          value={filterCooperant} 
          onChange={(e) => setFilterCooperant(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
        >
          <option value="">Tous les coopérants</option>
          {sellers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
        >
          <option value="">Tous les types</option>
          <option value="cooperant_take">Prise</option>
          <option value="cooperant_return">Retour</option>
          <option value="retail_sale">Vente détail</option>
        </select>
        <button 
          onClick={fetchMovements}
          style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
        >
          🔄 Appliquer filtres
        </button>
      </div>

      {/* Historique */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0 }}>📋 Historique des mouvements (aujourd'hui)</h3>
        {movements.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun mouvement enregistré aujourd'hui.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Heure</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Coopérant</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Produit</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Prise</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Retour</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Vente</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Paquets</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Montant (FC)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Stock après</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => {
                    const product = m.product || {};
                    const cooperant = m.cooperant || {};
                    const qty = Math.abs(m.quantity_change);
                    const unitPrice = product.unit_price || 0;
                    const amount = qty * unitPrice;

                    let prise = 0, retour = 0, vente = 0;
                    if (m.movement_type === 'cooperant_take') {
                      prise = qty;
                    } else if (m.movement_type === 'cooperant_return') {
                      retour = qty;
                    } else if (m.movement_type === 'retail_sale') {
                      vente = qty;
                    }

                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{new Date(m.created_at).toLocaleTimeString()}</td>
                        <td style={{ padding: '0.75rem' }}>{typeLabels[m.movement_type] || m.movement_type}</td>
                        <td style={{ padding: '0.75rem' }}>{cooperant.name || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{product.name || '-'}</td>
                        <td style={{ padding: '0.75rem', color: prise > 0 ? '#2563eb' : 'inherit' }}>{prise > 0 ? prise : '-'}</td>
                        <td style={{ padding: '0.75rem', color: retour > 0 ? '#16a34a' : 'inherit' }}>{retour > 0 ? retour : '-'}</td>
                        <td style={{ padding: '0.75rem', color: vente > 0 ? '#dc2626' : 'inherit' }}>{vente > 0 ? vente : '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{formatPackets(m.quantity_change)}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                          {amount > 0 ? `${amount.toFixed(0)} FC` : '-'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{product.current_stock ?? '?'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* --- Récapitulatif détaillé par coopérant et produit (incluant ventes en détail) --- */}
            {(() => {
              const summary = getDetailedSummary();
              if (summary.length === 0) return null;

              let totalNetSold = 0;
              let totalAmount = 0;
              summary.forEach(item => {
                totalNetSold += item.netSold;
                totalAmount += item.amount;
              });

              return (
                <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>📊 Récapitulatif des ventes par coopérant et par produit</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#e5e7eb' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Coopérant</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Produit</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Total Pris</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Total Retourné</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Ventes détail</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Net Vendu</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Montant Vendu (FC)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem' }}>{item.cooperantName}</td>
                            <td style={{ padding: '0.5rem' }}>{item.productName}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.totalTake > 0 ? item.totalTake : '-'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.totalReturn > 0 ? item.totalReturn : '-'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.totalRetail > 0 ? item.totalRetail : '-'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', color: item.netSold > 0 ? '#10b981' : '#ef4444' }}>
                              {item.netSold}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                              {item.amount > 0 ? `${item.amount.toFixed(0)} FC` : '0 FC'}
                            </td>
                          </tr>
                        ))}
                        {/* Ligne TOTAL GÉNÉRAL */}
                        <tr style={{ background: '#f3f4f6', fontWeight: 'bold', borderTop: '2px solid #1e3a8a' }}>
                          <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'right' }}>TOTAL GÉNÉRAL</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>—</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>—</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1e3a8a' }}>{totalNetSold}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1e3a8a' }}>{totalAmount.toFixed(0)} FC</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default Sorties;