import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../utils/supabaseClient';

const Rapports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const [dashboardData, setDashboardData] = useState(null);
  const [dailyStock, setDailyStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cooperantSummary, setCooperantSummary] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [operatorSales, setOperatorSales] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, [dateRange, period]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const statsRes = await axios.get('http://localhost:5000/api/dashboard/stats');
      if (statsRes.data.success) {
        setDashboardData(statsRes.data.data);
      }

      const stockRes = await axios.get('http://localhost:5000/api/stock/daily');
      if (stockRes.data.success) {
        setDailyStock(stockRes.data.data);
      }

      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      const movesRes = await axios.get(`http://localhost:5000/api/movements?${params.toString()}`);
      if (movesRes.data.success) {
        setMovements(movesRes.data.data);
        const productMap = {};
        movesRes.data.data.forEach(m => {
          if (m.movement_type === 'cooperant_take' || m.movement_type === 'retail_sale') {
            const pid = m.product_id;
            const qty = Math.abs(m.quantity_change);
            if (!productMap[pid]) {
              productMap[pid] = { name: m.product?.name || 'Inconnu', qty: 0, amount: 0 };
            }
            productMap[pid].qty += qty;
            productMap[pid].amount += qty * (m.product?.unit_price || 0);
          }
        });
        setProductSales(Object.values(productMap).sort((a, b) => b.qty - a.qty));

        const salesRes = await supabase
          .from('sales')
          .select('total_amount, operator_id, operators(name)')
          .gte('sale_date', `${dateRange.start}T00:00:00`)
          .lte('sale_date', `${dateRange.end}T23:59:59`);
        if (!salesRes.error) {
          const opSales = {};
          salesRes.data.forEach(s => {
            const name = s.operators?.name || 'Autre';
            opSales[name] = (opSales[name] || 0) + s.total_amount;
          });
          setOperatorSales(Object.entries(opSales).map(([name, amount]) => ({ name, amount })));
        }

        const coopMap = {};
        movesRes.data.data.forEach(m => {
          if (m.movement_type === 'cooperant_take' || m.movement_type === 'cooperant_return') {
            const cid = m.cooperant_id;
            if (!cid) return;
            if (!coopMap[cid]) {
              coopMap[cid] = { name: m.cooperant?.name || 'Inconnu', take: 0, ret: 0 };
            }
            const qty = Math.abs(m.quantity_change);
            if (m.movement_type === 'cooperant_take') coopMap[cid].take += qty;
            else coopMap[cid].ret += qty;
          }
        });
        setCooperantSummary(Object.values(coopMap).map(c => ({
          ...c,
          net: c.take - c.ret,
        })).sort((a, b) => b.net - a.net));
      }
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    const now = new Date();
    let start = new Date();
    let end = new Date();
    if (p === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (p === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
      end = new Date(now.getFullYear(), now.getMonth(), diff + 6);
    } else if (p === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement des rapports...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h1>Erreur</h1>
        <p>{error}</p>
      </div>
    );
  }

  const totalCA = dashboardData?.totalJuiceAmount || 0;
  const totalBottlesSold = dashboardData?.totalJuiceSold || 0;
  const totalEMoney = dashboardData?.totalEMoney || 0;
  const totalMegas = dashboardData?.totalMegas || 0;
  const totalUnites = dashboardData?.totalUnites || 0;
  const stockBottles = dashboardData?.totalStockBottles || 0;
  const stockPackets = dashboardData?.totalStockPackets || 0;

  return (
    <div style={{ padding: '2rem', paddingTop: '100px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* En-tête avec espacement corrigé */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#1f2937', fontSize: '2rem', marginBottom: '0.5rem' }}>📊 Rapports & Statistiques</h1>
        <p style={{ color: '#4b5563', fontSize: '1rem', marginTop: '0' }}>
          Bilans journaliers, hebdomadaires, mensuels : CA, volumes vendus, stock restant, performances.
        </p>
      </div>

      {/* Période et filtres */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handlePeriodChange('daily')}
            style={{
              padding: '0.3rem 1rem',
              background: period === 'daily' ? '#3b82f6' : '#e5e7eb',
              color: period === 'daily' ? 'white' : '#1f2937',
              border: 'none',
              borderRadius: '0.3rem',
              cursor: 'pointer',
              fontWeight: period === 'daily' ? 'bold' : 'normal'
            }}
          >
            Jour
          </button>
          <button
            onClick={() => handlePeriodChange('weekly')}
            style={{
              padding: '0.3rem 1rem',
              background: period === 'weekly' ? '#3b82f6' : '#e5e7eb',
              color: period === 'weekly' ? 'white' : '#1f2937',
              border: 'none',
              borderRadius: '0.3rem',
              cursor: 'pointer',
              fontWeight: period === 'weekly' ? 'bold' : 'normal'
            }}
          >
            Semaine
          </button>
          <button
            onClick={() => handlePeriodChange('monthly')}
            style={{
              padding: '0.3rem 1rem',
              background: period === 'monthly' ? '#3b82f6' : '#e5e7eb',
              color: period === 'monthly' ? 'white' : '#1f2937',
              border: 'none',
              borderRadius: '0.3rem',
              cursor: 'pointer',
              fontWeight: period === 'monthly' ? 'bold' : 'normal'
            }}
          >
            Mois
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold', color: '#1f2937' }}>Du</label>
          <input
            type="date"
            name="start"
            value={dateRange.start}
            onChange={handleDateChange}
            style={{ padding: '0.3rem', borderRadius: '0.3rem', border: '1px solid #d1d5db', color: '#1f2937' }}
          />
          <label style={{ fontWeight: 'bold', color: '#1f2937' }}>Au</label>
          <input
            type="date"
            name="end"
            value={dateRange.end}
            onChange={handleDateChange}
            style={{ padding: '0.3rem', borderRadius: '0.3rem', border: '1px solid #d1d5db', color: '#1f2937' }}
          />
          <button
            onClick={fetchAllData}
            style={{ padding: '0.3rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
          >
            🔄 Appliquer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Chiffre d'affaires (FC)</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{totalCA.toFixed(0)}</p>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Bouteilles vendues</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{totalBottlesSold}</p>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>E-money / Crédits (FC)</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{(totalEMoney + totalMegas + totalUnites).toFixed(0)}</p>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Stock (bouteilles / paquets)</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>{stockBottles} / {stockPackets}</p>
        </div>
      </div>

      {/* Deux colonnes : Ventes par produit + Répartition opérateurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>🧃 Ventes par produit</h3>
          {productSales.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aucune vente sur cette période.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={{ padding: '0.3rem', color: '#1f2937' }}>Produit</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Quantité</th>
                    <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>CA (FC)</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.slice(0, 10).map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.3rem', color: '#1f2937' }}>{p.name}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{p.qty}</td>
                      <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{p.amount.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>💳 Répartition par opérateur</h3>
          {operatorSales.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aucune vente e-money sur cette période.</p>
          ) : (
            <div>
              {operatorSales.map((op, idx) => {
                const total = operatorSales.reduce((s, o) => s + o.amount, 0);
                const percent = (op.amount / total) * 100;
                return (
                  <div key={idx} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#1f2937' }}>
                      <span>{op.name}</span>
                      <span>{op.amount.toFixed(0)} FC ({percent.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Performances des coopérants */}
      <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1f2937' }}>👥 Performances des coopérants</h3>
        {cooperantSummary.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucune activité de coopérant sur cette période.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.3rem', color: '#1f2937' }}>Coopérant</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Pris</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Retourné</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Net vendu</th>
                </tr>
              </thead>
              <tbody>
                {cooperantSummary.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.3rem', color: '#1f2937' }}>{c.name}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{c.take}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{c.ret}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', fontWeight: 'bold', color: '#1f2937' }}>{c.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suivi des stocks (détail) */}
      <div style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, color: '#1f2937' }}>📦 Suivi des stocks (journalier)</h3>
        {dailyStock.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucune donnée de stock.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.3rem', color: '#1f2937' }}>Produit</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Stock initial</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Entrées</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Sorties</th>
                  <th style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>Stock final</th>
                </tr>
              </thead>
              <tbody>
                {dailyStock.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.3rem', color: '#1f2937' }}>{item.name}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{item.initialStock}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{item.entries}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{item.exits}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right', color: '#1f2937' }}>{item.finalStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rapports;