import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const Caisse = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'income',
    category: 'Vente jus',
    description: '',
    amount: '',
    payment_method: 'cash',
  });
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Calcul des soldes
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  useEffect(() => {
    fetchTransactions();
  }, [dateRange]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      const response = await axios.get(`http://localhost:5000/api/cash/transactions?${params.toString()}`);
      if (response.data.success) {
        const data = response.data.data;
        setTransactions(data);

        // Calculer les totaux
        let income = 0, expense = 0;
        data.forEach(t => {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        });
        setTotalIncome(income);
        setTotalExpense(expense);

        // Récupérer le solde d'ouverture (avant le début de la journée)
        const openingResponse = await axios.get(`http://localhost:5000/api/cash/transactions?end_date=${dateRange.start}`);
        let opening = 0;
        if (openingResponse.data.success) {
          openingResponse.data.data.forEach(t => {
            if (t.type === 'income') opening += t.amount;
            else opening -= t.amount;
          });
        }
        setOpeningBalance(opening);
        setClosingBalance(opening + income - expense);

        setError(null);
      } else {
        setError('Erreur de chargement des transactions');
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de contacter le serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type || !formData.category || !formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Veuillez remplir correctement tous les champs');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5000/api/cash/transaction', {
        ...formData,
        amount: parseFloat(formData.amount),
        transaction_date: new Date().toISOString(),
      });
      if (response.data.success) {
        setShowModal(false);
        setFormData({ type: 'income', category: 'Vente jus', description: '', amount: '', payment_method: 'cash' });
        fetchTransactions();
      } else {
        setError(response.data.error || 'Erreur');
      }
    } catch (err) {
      console.error(err);
      setError('❌ Erreur serveur');
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const categories = [
    'Vente jus',
    'Vente mégas',
    'Vente unités',
    'Vente e-money',
    'Dépôt',
    'Retrait',
    'Frais',
    'Autre'
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement de la caisse...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', paddingTop: '80px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ color: '#1e3a8a', marginBottom: '0.25rem' }}>💰 Caisse / Journal de caisse</h1>
          <p style={{ color: '#6b7280' }}>Suivi des entrées et sorties d'argent</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: '#10b981', color: 'white', padding: '0.5rem 1.5rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
        >
          ➕ Nouvelle transaction
        </button>
      </div>

      {/* Filtre de date */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Du</label>
          <input
            type="date"
            name="start"
            value={dateRange.start}
            onChange={handleDateChange}
            style={{ padding: '0.3rem', borderRadius: '0.3rem', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Au</label>
          <input
            type="date"
            name="end"
            value={dateRange.end}
            onChange={handleDateChange}
            style={{ padding: '0.3rem', borderRadius: '0.3rem', border: '1px solid #d1d5db' }}
          />
        </div>
        <button
          onClick={fetchTransactions}
          style={{ background: '#3b82f6', color: 'white', padding: '0.3rem 1rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
        >
          🔄 Appliquer
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Indicateurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Solde d'ouverture</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{openingBalance.toFixed(0)} FC</p>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Total entrées</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#10b981' }}>+ {totalIncome.toFixed(0)} FC</p>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Total sorties</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#ef4444' }}>- {totalExpense.toFixed(0)} FC</p>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Solde de clôture</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1e3a8a' }}>{closingBalance.toFixed(0)} FC</p>
        </div>
      </div>

      {/* Tableau des transactions */}
      <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>📋 Transactions</h3>
        {transactions.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucune transaction sur cette période.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Date</th>
                  <th style={{ padding: '0.5rem' }}>Type</th>
                  <th style={{ padding: '0.5rem' }}>Catégorie</th>
                  <th style={{ padding: '0.5rem' }}>Description</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Montant</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Moyen de paiement</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, index) => {
                  let balance = openingBalance;
                  for (let i = 0; i <= index; i++) {
                    if (transactions[i].type === 'income') balance += transactions[i].amount;
                    else balance -= transactions[i].amount;
                  }
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem' }}>{new Date(t.transaction_date).toLocaleString()}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{
                          background: t.type === 'income' ? '#d1fae5' : '#fecaca',
                          color: t.type === 'income' ? '#065f46' : '#991b1b',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.8rem'
                        }}>
                          {t.type === 'income' ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>{t.category}</td>
                      <td style={{ padding: '0.5rem' }}>{t.description || '-'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                        {t.type === 'income' ? '+' : '-'} {t.amount.toFixed(0)} FC
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {t.payment_method === 'cash' ? 'Espèces' :
                         t.payment_method === 'bank' ? 'Banque' :
                         t.payment_method === 'mobile_money' ? 'Mobile money' : 'Autre'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal d'ajout de transaction */}
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
            <h2 style={{ marginTop: 0 }}>➕ Nouvelle transaction</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                >
                  <option value="income">Entrée</option>
                  <option value="expense">Sortie</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Catégorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                  placeholder="Ex: Vente de 10 mégas"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Montant (FC)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                  placeholder="Ex: 5000"
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.2rem' }}>Moyen de paiement</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                >
                  <option value="cash">Espèces</option>
                  <option value="bank">Banque</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.5rem 1.5rem', background: '#9ca3af', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Caisse;