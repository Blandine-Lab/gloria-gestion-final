import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../utils/supabaseClient';

const Entrees = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productIdFromUrl = searchParams.get('product_id');

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(productIdFromUrl || '');
  const [packQuantity, setPackQuantity] = useState(1);
  const [bottleQuantity, setBottleQuantity] = useState(0); // si on ajoute des bouteilles en plus
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      setMessage({ text: 'Erreur de chargement des produits', type: 'error' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      setMessage({ text: 'Veuillez sélectionner un produit', type: 'error' });
      return;
    }
    const totalBottles = (parseInt(packQuantity) || 0) * 12 + (parseInt(bottleQuantity) || 0);
    if (totalBottles <= 0) {
      setMessage({ text: 'Veuillez entrer une quantité positive', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // Appel au backend pour enregistrer un mouvement de type 'supplier_in'
      const response = await axios.post('http://localhost:5000/api/movement', {
        product_id: selectedProduct,
        quantity: totalBottles,
        movement_type: 'supplier_in',
        cooperant_id: null,
        reason: `Entrée en stock (${packQuantity} paquets + ${bottleQuantity} bouteilles)`
      });

      if (response.data.success) {
        setMessage({ text: `✅ ${totalBottles} bouteilles ajoutées au stock !`, type: 'success' });
        setPackQuantity(1);
        setBottleQuantity(0);
        // Recharger la liste des produits pour voir le stock à jour
        fetchProducts();
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

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', color: '#1e3a8a' }}>📦 Entrées en stock</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280' }}>
        Ajoutez des quantités à un produit existant.
      </p>

      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Produit</label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
            required
          >
            <option value="">Sélectionner un produit</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Stock actuel: {p.current_stock} bouteilles)
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Quantité en paquets (12 bouteilles)</label>
          <input
            type="number"
            min="0"
            value={packQuantity}
            onChange={(e) => setPackQuantity(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Bouteilles supplémentaires</label>
          <input
            type="number"
            min="0"
            max="11" // plus de 11 deviennent un paquet
            value={bottleQuantity}
            onChange={(e) => setBottleQuantity(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
          />
          <small style={{ color: '#6b7280' }}>0 à 11 bouteilles en plus des paquets</small>
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
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Ajout en cours...' : 'Ajouter au stock'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/stocks')}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginTop: '0.5rem',
            background: 'transparent',
            color: '#3b82f6',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Voir la liste des stocks
        </button>
      </form>
    </div>
  );
};

export default Entrees;