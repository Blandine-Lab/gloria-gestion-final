import { useEffect, useState } from 'react';
import axios from 'axios';

const Parametres = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/settings');
      if (response.data.success) {
        const settingsObj = {};
        response.data.data.forEach(s => {
          settingsObj[s.key] = s.value;
        });
        setSettings(settingsObj);
        setError(null);
      } else {
        setError('Erreur de chargement des paramètres');
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await axios.put(`http://localhost:5000/api/settings/${key}`, { value });
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'enregistrement des paramètres');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', paddingTop: '100px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#1e3a8a', marginBottom: '0.25rem' }}>⚙️ Paramètres</h1>
        <p style={{ color: '#4b5563' }}>Configuration générale de l'application</p>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#d1fae5', color: '#065f46' }}>
          ✅ Paramètres enregistrés avec succès !
        </div>
      )}

      <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Nom de l'entreprise</label>
              <input
                type="text"
                value={settings.company_name || ''}
                onChange={(e) => handleChange('company_name', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Devise</label>
              <input
                type="text"
                value={settings.currency || 'FC'}
                onChange={(e) => handleChange('currency', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Symbole de la devise</label>
              <input
                type="text"
                value={settings.currency_symbol || 'FC'}
                onChange={(e) => handleChange('currency_symbol', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Email de contact</label>
              <input
                type="email"
                value={settings.contact_email || ''}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Téléphone de contact</label>
              <input
                type="text"
                value={settings.contact_phone || ''}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Adresse</label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>TVA par défaut (%)</label>
              <input
                type="number"
                step="0.01"
                value={settings.default_vat || '0'}
                onChange={(e) => handleChange('default_vat', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Seuil d'alerte de stock (par défaut)</label>
              <input
                type="number"
                value={settings.default_reorder_level || '10'}
                onChange={(e) => handleChange('default_reorder_level', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>Prix unitaire par défaut (mégas/unités)</label>
              <input
                type="number"
                value={settings.default_unit_price || '500'}
                onChange={(e) => handleChange('default_unit_price', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.2rem' }}>URL du logo</label>
              <input
                type="text"
                value={settings.logo_url || '/logo.jpeg'}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '2px solid #d1d5db', background: '#f9fafb', color: '#1f2937', fontSize: '1rem' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                opacity: saving ? 0.7 : 1,
                fontWeight: 'bold'
              }}
            >
              {saving ? 'Enregistrement en cours...' : '💾 Enregistrer les paramètres'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Parametres;