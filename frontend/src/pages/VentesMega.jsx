import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

// Liste des opérateurs à afficher
const TARGET_OPERATORS = [
  'Vodacom M-Pesa',
  'Airtel Money',
  'Orange Money',
  'Africell Money'
];

// Mapping des noms vers les noms de fichiers images COMPLETS (avec extension)
const getImageFile = (name) => {
  const map = {
    'Vodacom M-Pesa': 'vodacom-mpesa.jpg',
    'Airtel Money': 'airtel-money.jpg',
    'Orange Money': 'orange-money.jpeg',
    'Africell Money': 'africell-money.jpg'
  };
  return map[name] || `${name.toLowerCase().replace(/\s+/g, '-')}.jpg`;
};

const VentesMega = () => {
  const navigate = useNavigate();
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('name');
      if (error) throw error;

      const filtered = data.filter(op => TARGET_OPERATORS.includes(op.name));
      setOperators(filtered);
    } catch (error) {
      console.error('Erreur chargement opérateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#1e3a8a', marginBottom: '1.5rem' }}>💳 Ventes de méga & e-money</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Sélectionnez un opérateur pour gérer les ventes de crédits et d'e-money.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {operators.map(op => {
          const imageFile = getImageFile(op.name);
          return (
            <div
              key={op.id}
              onClick={() => navigate(`/ventes-mega/operator/${op.id}`)}
              style={{
                background: 'white',
                borderRadius: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'all 0.3s',
                textAlign: 'center',
                padding: '1rem'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0) scale(1)'}
            >
              <img
                src={`/${imageFile}`}
                alt={op.name}
                style={{ width: '100%', height: '120px', objectFit: 'contain', marginBottom: '0.5rem' }}
                onError={(e) => { e.target.src = '/default-operator.png'; }}
              />
              <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{op.name}</div>
            </div>
          );
        })}
      </div>

      {operators.length === 0 && (
        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '2rem' }}>
          Aucun opérateur trouvé. Veuillez ajouter les opérateurs dans la base de données.
        </p>
      )}
    </div>
  );
};

export default VentesMega;