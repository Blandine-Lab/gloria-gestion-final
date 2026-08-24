import { useEffect, useState } from 'react';
import axios from 'axios';

const Utilisateurs = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    active: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/users');
      if (response.data.success) {
        setUsers(response.data.data);
        setError(null);
      } else {
        setError('Erreur de chargement des utilisateurs');
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        full_name: user.full_name || '',
        role: user.role,
        active: user.active,
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        active: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', full_name: '', role: 'user', active: true });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || (!editingUser && !formData.password)) {
      setError('L\'email et le mot de passe sont requis');
      return;
    }
    try {
      let response;
      if (editingUser) {
        response = await axios.put(`http://localhost:5000/api/users/${editingUser.id}`, formData);
      } else {
        response = await axios.post('http://localhost:5000/api/users', formData);
      }
      if (response.data.success) {
        closeModal();
        fetchUsers();
      } else {
        setError(response.data.error || 'Erreur');
      }
    } catch (err) {
      console.error(err);
      setError('Erreur serveur');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur définitivement ?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setError('Erreur suppression');
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
    <div style={{ padding: '2rem', paddingTop: '100px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#1f2937', marginBottom: '0.25rem' }}>👥 Gestion des utilisateurs</h1>
        <p style={{ color: '#4b5563' }}>Gestion des comptes utilisateurs (administrateurs, managers, etc.)</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          onClick={() => openModal()}
          style={{ background: '#10b981', color: 'white', padding: '0.5rem 1.5rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
        >
          ➕ Nouvel utilisateur
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Aucun utilisateur enregistré.</p>
      ) : (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', color: '#1f2937' }}>Email</th>
                <th style={{ padding: '0.5rem', color: '#1f2937' }}>Nom complet</th>
                <th style={{ padding: '0.5rem', color: '#1f2937' }}>Rôle</th>
                <th style={{ padding: '0.5rem', color: '#1f2937' }}>Actif</th>
                <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem', color: '#1f2937' }}>{u.email}</td>
                  <td style={{ padding: '0.5rem', color: '#1f2937' }}>{u.full_name || '-'}</td>
                  <td style={{ padding: '0.5rem', color: '#1f2937' }}>{u.role}</td>
                  <td style={{ padding: '0.5rem', color: '#1f2937' }}>{u.active ? '✅' : '❌'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <button
                      onClick={() => openModal(u)}
                      style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
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

      {/* Modal d'ajout / modification - avec textes en noir */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '1rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            <h2 style={{ marginTop: 0, color: '#1f2937' }}>{editingUser ? '✏️ Modifier' : '➕ Nouvel utilisateur'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                />
              </div>
              {!editingUser && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Mot de passe *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required={!editingUser}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                  />
                </div>
              )}
              {editingUser && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                  />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Nom complet</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem', color: '#1f2937' }}>Rôle</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', color: '#1f2937' }}
                >
                  <option value="admin" style={{ color: '#1f2937' }}>Administrateur</option>
                  <option value="manager" style={{ color: '#1f2937' }}>Manager</option>
                  <option value="user" style={{ color: '#1f2937' }}>Utilisateur</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937' }}>
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleChange}
                  />
                  Actif
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  {editingUser ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Utilisateurs;