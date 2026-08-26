import { useEffect, useState } from 'react';
import db from '../db'; // Base locale Dexie
import { syncAll } from '../services/syncService'; // Synchronisation

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction pour charger et calculer les statistiques depuis Dexie
  const loadData = async () => {
    try {
      // Récupérer toutes les données nécessaires depuis la base locale
      const [products, movements, sales, sellers, operators] = await Promise.all([
        db.products.toArray(),
        db.stockMovements.toArray(),
        db.sales.toArray(),
        db.sellers.toArray(),
        db.operators.toArray(),
      ]);

      // --- Calculs similaires à ceux du backend ---

      // 1. Agrégations sur les mouvements de stock
      const cooperantMap = {};
      const productNetMap = {};
      let totalRetail = 0;
      let totalRetailAmount = 0;

      movements.forEach(mov => {
        const product = products.find(p => p.id === mov.product_id) || {};
        const unitPrice = product.unit_price || 0;
        const absQty = Math.abs(mov.quantity_change);
        const productId = mov.product_id;
        const cooperantId = mov.cooperant_id;

        if (mov.movement_type === 'cooperant_take') {
          if (!cooperantMap[cooperantId]) {
            cooperantMap[cooperantId] = { totalTake: 0, totalReturn: 0 };
          }
          cooperantMap[cooperantId].totalTake += absQty;
          const key = `${cooperantId}|${productId}`;
          if (!productNetMap[key]) {
            productNetMap[key] = { cooperantId, productId, unitPrice, netQty: 0 };
          }
          productNetMap[key].netQty += absQty;
        } else if (mov.movement_type === 'cooperant_return') {
          if (!cooperantMap[cooperantId]) {
            cooperantMap[cooperantId] = { totalTake: 0, totalReturn: 0 };
          }
          cooperantMap[cooperantId].totalReturn += absQty;
          const key = `${cooperantId}|${productId}`;
          if (!productNetMap[key]) {
            productNetMap[key] = { cooperantId, productId, unitPrice, netQty: 0 };
          }
          productNetMap[key].netQty -= absQty;
        } else if (mov.movement_type === 'retail_sale') {
          totalRetail += absQty;
          totalRetailAmount += absQty * unitPrice;
        }
      });

      // Calcul des montants par coopérant
      const cooperantAmounts = {};
      for (const key in productNetMap) {
        const data = productNetMap[key];
        const amount = data.netQty * data.unitPrice;
        if (!cooperantAmounts[data.cooperantId]) cooperantAmounts[data.cooperantId] = 0;
        cooperantAmounts[data.cooperantId] += amount;
      }

      let totalCooperantNet = 0;
      let totalCooperantAmount = 0;
      const cooperantSales = [];
      for (const [cooperantId, cData] of Object.entries(cooperantMap)) {
        const netSold = cData.totalTake - cData.totalReturn;
        if (netSold > 0) {
          totalCooperantNet += netSold;
          const amount = cooperantAmounts[cooperantId] || 0;
          totalCooperantAmount += amount;
          const seller = sellers.find(s => s.id === cooperantId);
          cooperantSales.push({
            cooperantId,
            name: seller?.name || 'Inconnu',
            netSold,
            amount: amount
          });
        }
      }

      // 2. Ventes de crédits (e-money, mégas, unités)
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const todaySales = sales.filter(s => {
        const saleDate = new Date(s.sale_date);
        return saleDate >= startOfDay && saleDate < endOfDay;
      });

      let totalEMoney = 0, totalMegas = 0, totalUnites = 0;
      const operatorStats = {};
      const typeStats = { megas: 0, unites: 0, emoney: 0 };

      todaySales.forEach(sale => {
        const amount = sale.total_amount;
        const opName = operators.find(o => o.id === sale.operator_id)?.name || 'Autre';
        const type = sale.sale_type || 'emoney';

        if (type === 'megas') totalMegas += amount;
        else if (type === 'unites') totalUnites += amount;
        else totalEMoney += amount;

        typeStats[type] = (typeStats[type] || 0) + amount;
        operatorStats[opName] = (operatorStats[opName] || 0) + amount;
      });

      // 3. Stocks
      const totalStockBottles = products.reduce((sum, p) => sum + (p.current_stock || 0), 0);
      const totalStockPackets = products.reduce((sum, p) => {
        const perPack = p.bottles_per_pack || 12;
        return sum + Math.floor((p.current_stock || 0) / perPack);
      }, 0);

      // 4. Alertes
      const alerts = products.filter(p => p.current_stock <= p.reorder_level);

      // 5. Résultat final
      const totalJuiceSold = totalCooperantNet + totalRetail;
      const totalJuiceAmount = totalCooperantAmount + totalRetailAmount;

      setData({
        totalJuiceSold,
        totalCooperantNet,
        totalRetail,
        totalEMoney,
        totalMegas,
        totalUnites,
        typeStats,
        totalJuiceAmount,
        totalStockBottles,
        totalStockPackets,
        cooperantSales: cooperantSales.sort((a, b) => b.netSold - a.netSold),
        operatorStats,
        alerts: alerts || [],
        products: products || [],
        operators: operators || [], // Ajout des opérateurs pour afficher leur stock
        date: startOfDay.toISOString().split('T')[0]
      });
      setError(null);
    } catch (err) {
      console.error('Erreur lors du chargement des données locales:', err);
      setError('Impossible de charger les données locales');
    } finally {
      setLoading(false);
    }
  };

  // Synchronisation en arrière‑plan si connecté
  const refreshData = async () => {
    if (navigator.onLine) {
      try {
        await syncAll(); // Met à jour Dexie
        await loadData(); // Recharge l'affichage
      } catch (e) {
        console.warn('Erreur de synchronisation:', e);
      }
    } else {
      // Hors ligne, on recharge juste Dexie
      await loadData();
    }
  };

  useEffect(() => {
    // Premier chargement
    loadData();
    // Rafraîchir toutes les 30 secondes (lecture Dexie uniquement)
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- Rendu (inchangé) ---
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>Chargement du tableau de bord...</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem', color: 'red' }}>
      <h1>Erreur</h1>
      <p>{error}</p>
    </div>
  );

  if (!data) return <div>Aucune donnée disponible</div>;

  const {
    totalJuiceSold,
    totalCooperantNet,
    totalRetail,
    totalEMoney,
    totalMegas,
    totalUnites,
    totalJuiceAmount,
    totalStockBottles,
    totalStockPackets,
    cooperantSales,
    operatorStats,
    alerts,
    products,
    operators,
    date
  } = data;

  const topCooperants = (cooperantSales || []).slice(0, 5);
  const maxSold = topCooperants.length > 0 ? Math.max(...topCooperants.map(c => c.netSold)) : 1;

  const groupedBySize = products ? products.reduce((acc, p) => {
    const size = p.size === 'big' ? 'Grande' : 'Petite';
    if (!acc[size]) acc[size] = [];
    acc[size].push(p);
    return acc;
  }, {}) : {};

  const sizeTotals = {};
  for (const [size, items] of Object.entries(groupedBySize)) {
    sizeTotals[size] = {
      bottles: items.reduce((sum, p) => sum + (p.current_stock || 0), 0),
      packets: items.reduce((sum, p) => {
        const bottlesPerPack = p.bottles_per_pack || 12;
        return sum + Math.floor((p.current_stock || 0) / bottlesPerPack);
      }, 0)
    };
  }

  // Totaux des stocks des opérateurs
  const totalMegasStock = operators.reduce((sum, op) => sum + (op.stock_megas || 0), 0);
  const totalUnitesStock = operators.reduce((sum, op) => sum + (op.stock_unites || 0), 0);
  const totalFCStock = operators.reduce((sum, op) => sum + (op.stock_fc || 0), 0);
  const totalUSDStock = operators.reduce((sum, op) => sum + (op.stock_usd || 0), 0);

  return (
    <div style={{ padding: '2rem', background: '#f4f6f9', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#1e3a8a', fontSize: '2rem' }}>📊 Tableau de bord</h1>
        <span style={{ color: '#1e3a8a', fontSize: '0.9rem', background: '#e5e7eb', padding: '0.3rem 0.8rem', borderRadius: '0.5rem' }}>
          Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR')}
        </span>
      </div>
      <p style={{ color: '#1f2937', marginBottom: '2rem', fontSize: '1rem' }}>
        Synthèse des activités du jour : {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* KPI CARDS - inchangé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>Vendues (bouteilles)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalJuiceSold || 0}</h2>
          <small style={{ color: '#3b82f6' }}>Tous modes</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>Coopérants (Net)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalCooperantNet || 0}</h2>
          <small style={{ color: '#00C49F' }}>+ {cooperantSales?.length || 0} actifs</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>Ventes détail</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalRetail || 0}</h2>
          <small style={{ color: '#FFBB28' }}>Au comptoir</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>Montant total (FC)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalJuiceAmount?.toFixed(0) || 0} FC</h2>
          <small style={{ color: '#FF8042' }}>Prix unitaires</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>📦 Stock (bouteilles)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalStockBottles || 0}</h2>
          <small style={{ color: '#6B7280' }}>Tous produits</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>📦 Stock (paquets)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalStockPackets || 0}</h2>
          <small style={{ color: '#6B7280' }}>Tous produits</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>💳 Total crédits (FC)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>
            {(totalMegas || 0) + (totalUnites || 0) + (totalEMoney || 0)}
          </h2>
          <small style={{ color: '#8B5CF6' }}>Mégas + Unités + E-money</small>
        </div>
      </div>

      {/* Détail crédits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>💎 Mégas (FC)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalMegas || 0}</h2>
          <small style={{ color: '#3b82f6' }}>Ventes de mégas</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>📱 Unités (FC)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalUnites || 0}</h2>
          <small style={{ color: '#00C49F' }}>Ventes d'unités</small>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <p style={{ color: '#374151', fontSize: '0.8rem' }}>💳 E-money (FC)</p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0.2rem 0', color: '#1f2937' }}>{totalEMoney || 0}</h2>
          <small style={{ color: '#8B5CF6' }}>Envois / retraits</small>
        </div>
      </div>

      {/* Top Coopérants et Répartition par opérateur */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1f2937' }}>🏆 Top 5 Coopérants (bouteilles)</h3>
          {topCooperants.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aucune vente enregistrée aujourd'hui.</p>
          ) : (
            <div>
              {topCooperants.map((c, idx) => (
                <div key={idx} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#1f2937' }}>
                    <span>{c.name}</span>
                    <span>{c.netSold}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px' }}>
                    <div style={{ width: `${(c.netSold / maxSold) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1f2937' }}>💳 Répartition par opérateur</h3>
          {Object.keys(operatorStats || {}).length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aucune vente e-money aujourd'hui.</p>
          ) : (
            <div>
              {Object.entries(operatorStats).map(([name, value]) => {
                const total = Object.values(operatorStats).reduce((a, b) => a + b, 0);
                const percent = (value / total) * 100;
                return (
                  <div key={name} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#1f2937' }}>
                      <span>{name}</span>
                      <span>{value.toFixed(0)} FC ({percent.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: '#FF8042', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tableau des coopérants */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1f2937' }}>👥 Performances des coopérants</h3>
        {cooperantSales?.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun coopérant n'a effectué de vente aujourd'hui.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', color: '#1f2937' }}>#</th>
                  <th style={{ padding: '0.5rem', color: '#1f2937' }}>Coopérant</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Net Vendu (bouteilles)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Montant (FC)</th>
                </tr>
              </thead>
              <tbody>
                {cooperantSales.map((c, index) => (
                  <tr key={c.cooperantId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem', color: '#1f2937' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem', color: '#1f2937' }}>{c.name}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', color: '#1f2937' }}>{c.netSold}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', color: '#1f2937' }}>{c.amount ? `${c.amount.toFixed(0)} FC` : '0 FC'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock détaillé par produit (inchangé) */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1f2937' }}>📦 Stock détaillé par produit</h3>
        {Object.keys(sizeTotals).length > 0 && (
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {Object.entries(sizeTotals).map(([size, totals]) => (
              <div key={size} style={{ background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
                <strong>{size}</strong> : {totals.bottles} bouteilles ({totals.packets} paquets)
              </div>
            ))}
          </div>
        )}
        {!products || products.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun produit enregistré.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', color: '#1f2937' }}>Produit</th>
                  <th style={{ padding: '0.5rem', color: '#1f2937' }}>Taille</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Bouteilles/Paquet</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Stock (bouteilles)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Stock (paquets)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Seuil</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => {
                  const bottlesPerPack = p.bottles_per_pack || 12;
                  const stockPackets = Math.floor(p.current_stock / bottlesPerPack);
                  const stockBottles = p.current_stock % bottlesPerPack;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.5rem', color: '#1f2937' }}>{p.name}</td>
                      <td style={{ padding: '0.5rem', color: '#1f2937' }}>{p.size === 'big' ? 'Grande' : 'Petite'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>{bottlesPerPack}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: p.current_stock < p.reorder_level ? 'red' : '#1f2937' }}>
                        {p.current_stock}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>
                        {stockPackets} paquets {stockBottles > 0 ? `+ ${stockBottles} bouteilles` : ''}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>{p.reorder_level}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* === NOUVEAU : Stock détaillé des opérateurs (mégas, unités, FC, USD) === */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1f2937' }}>📱 Stock des opérateurs (Mégas, Unités, FC, USD)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
            <strong>Mégas</strong> : {totalMegasStock}
          </div>
          <div style={{ background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
            <strong>Unités</strong> : {totalUnitesStock}
          </div>
          <div style={{ background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
            <strong>FC</strong> : {totalFCStock}
          </div>
          <div style={{ background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
            <strong>USD</strong> : {totalUSDStock}
          </div>
        </div>

        {operators && operators.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun opérateur enregistré.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', color: '#1f2937' }}>Opérateur</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Mégas</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>Unités</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>FC</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>USD</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op, idx) => (
                  <tr key={op.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem', color: '#1f2937' }}>{op.name}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>{op.stock_megas || 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>{op.stock_unites || 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>{op.stock_fc || 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#1f2937' }}>{op.stock_usd || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alertes de stock (inchangé) */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1f2937' }}>
          ⚠️ Alertes de stock
        </h3>
        {alerts?.length === 0 ? (
          <p style={{ color: '#10b981' }}>✅ Aucun produit en dessous du seuil critique.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem', color: '#1f2937' }}>Produit</th>
                <th style={{ padding: '0.75rem', color: '#1f2937' }}>Stock actuel</th>
                <th style={{ padding: '0.75rem', color: '#1f2937' }}>Seuil d'alerte</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((prod, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem', color: '#1f2937' }}>{prod.name}</td>
                  <td style={{ padding: '0.75rem', color: 'red', fontWeight: 'bold' }}>{prod.current_stock}</td>
                  <td style={{ padding: '0.75rem', color: '#1f2937' }}>{prod.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;