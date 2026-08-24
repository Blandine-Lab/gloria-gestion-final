import { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../db';
import { syncAll } from '../services/syncService';

const Sauvegarde = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [exportType, setExportType] = useState('daily');

  // Helper pour récupérer les données locales
  const fetchLocalData = async () => {
    // Si connecté, synchroniser d'abord pour avoir les dernières données
    if (navigator.onLine) {
      try {
        await syncAll();
      } catch (e) {
        console.warn('Synchronisation en arrière-plan ignorée:', e);
      }
    }
    
    const [products, stockMovements, sales, sellers, operators, clients] = await Promise.all([
      db.products.toArray(),
      db.stockMovements.toArray(),
      db.sales.toArray(),
      db.sellers.toArray(),
      db.operators.toArray(),
      db.clients ? db.clients.toArray() : [],
    ]);

    return { products, stockMovements, sales, sellers, operators, clients };
  };

  // Calcul des statistiques à partir des données locales (identique à Dashboard/Rapports)
  const computeStats = (products, stockMovements, sales, sellers, operators) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startISO = startOfDay.toISOString();
    const endISO = endOfDay.toISOString();

    const juiceSales = stockMovements.filter(m => 
      m.created_at >= startISO && m.created_at < endISO &&
      ['cooperant_take', 'cooperant_return', 'retail_sale'].includes(m.movement_type)
    );

    // Même logique que Dashboard
    const cooperantMap = {};
    const productNetMap = {};
    let totalRetail = 0;
    let totalRetailAmount = 0;

    juiceSales.forEach(mov => {
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

    const cooperantAmounts = {};
    for (const key in productNetMap) {
      const data = productNetMap[key];
      const amount = data.netQty * data.unitPrice;
      if (!cooperantAmounts[data.cooperantId]) cooperantAmounts[data.cooperantId] = 0;
      cooperantAmounts[data.cooperantId] += amount;
    }

    let totalCooperantNet = 0;
    let totalCooperantAmount = 0;
    const cooperantSalesList = [];
    for (const [cooperantId, data] of Object.entries(cooperantMap)) {
      const netSold = data.totalTake - data.totalReturn;
      if (netSold > 0) {
        totalCooperantNet += netSold;
        const amount = cooperantAmounts[cooperantId] || 0;
        totalCooperantAmount += amount;
        const seller = sellers.find(s => s.id === cooperantId);
        cooperantSalesList.push({
          cooperantId,
          name: seller?.name || 'Inconnu',
          netSold,
          amount: amount
        });
      }
    }

    // Ventes de crédits (emoney, mégas, unités) sur la journée
    const dailySales = sales.filter(s => {
      const d = new Date(s.sale_date);
      return d >= startOfDay && d < endOfDay;
    });

    let totalEMoney = 0, totalMegas = 0, totalUnites = 0;
    const operatorStats = {};

    dailySales.forEach(sale => {
      const amount = sale.total_amount;
      const opName = operators.find(o => o.id === sale.operator_id)?.name || 'Autre';
      const type = sale.sale_type || 'emoney';
      if (type === 'megas') totalMegas += amount;
      else if (type === 'unites') totalUnites += amount;
      else totalEMoney += amount;
      operatorStats[opName] = (operatorStats[opName] || 0) + amount;
    });

    // Stocks
    const totalStockBottles = products.reduce((sum, p) => sum + (p.current_stock || 0), 0);
    const totalStockPackets = products.reduce((sum, p) => {
      const perPack = p.bottles_per_pack || 12;
      return sum + Math.floor((p.current_stock || 0) / perPack);
    }, 0);

    const totalJuiceSold = totalCooperantNet + totalRetail;
    const totalJuiceAmount = totalCooperantAmount + totalRetailAmount;

    return {
      totalJuiceSold,
      totalCooperantNet,
      totalRetail,
      totalEMoney,
      totalMegas,
      totalUnites,
      totalJuiceAmount,
      totalStockBottles,
      totalStockPackets,
      cooperantSales: cooperantSalesList.sort((a, b) => b.netSold - a.netSold),
      operatorStats,
      products,
    };
  };

  // Calcul du stock journalier (identique à /api/stock/daily)
  const computeDailyStock = (products, stockMovements) => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const dailyMovements = stockMovements.filter(m => 
      m.created_at >= startISO && m.created_at < endISO
    );

    const productStats = {};
    products.forEach(p => {
      productStats[p.id] = {
        id: p.id,
        name: p.name,
        current_stock: p.current_stock,
        reorder_level: p.reorder_level,
        size: p.size,
        bottles_per_pack: p.bottles_per_pack || 12,
        entries: 0,
        exits: 0,
        initialStock: 0,
        finalStock: p.current_stock,
      };
    });

    dailyMovements.forEach(m => {
      const pid = m.product_id;
      if (!productStats[pid]) return;
      const qty = Math.abs(m.quantity_change);
      const type = m.movement_type;
      if (type === 'supplier_in' || type === 'cooperant_return') {
        productStats[pid].entries += qty;
      } else if (type === 'cooperant_take' || type === 'retail_sale') {
        productStats[pid].exits += qty;
      }
    });

    return Object.values(productStats).map(p => {
      const initialStock = p.current_stock - p.entries + p.exits;
      return {
        ...p,
        initialStock: Math.max(initialStock, 0),
        finalStock: p.current_stock,
      };
    });
  };

  const exportPDF = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { products, stockMovements, sales, sellers, operators, clients } = await fetchLocalData();
      const stats = computeStats(products, stockMovements, sales, sellers, operators);
      const stockData = computeDailyStock(products, stockMovements);

      // Filtrer les mouvements du jour pour les détails
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today + 'T00:00:00');
      const todayEnd = new Date(today + 'T23:59:59');
      const dailyMovements = stockMovements.filter(m => {
        const d = new Date(m.created_at);
        return d >= todayStart && d <= todayEnd;
      });

      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Page 1 : KPI
      doc.setFontSize(18);
      doc.text('Rapport Gloria Business', 14, 22);
      doc.setFontSize(10);
      doc.text(`Généré le ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`Période : ${exportType === 'daily' ? 'Journée' : exportType === 'weekly' ? 'Semaine' : 'Mois'}`, 14, 36);

      const kpiData = [
        ['Indicateur', 'Valeur'],
        ['Total bouteilles vendues', stats.totalJuiceSold || 0],
        ['CA total (FC)', (stats.totalJuiceAmount || 0).toFixed(0)],
        ['Stock (bouteilles)', stats.totalStockBottles || 0],
        ['Stock (paquets)', stats.totalStockPackets || 0],
        ['Ventes e-money (FC)', (stats.totalEMoney || 0).toFixed(0)],
        ['Ventes mégas (FC)', (stats.totalMegas || 0).toFixed(0)],
        ['Ventes unités (FC)', (stats.totalUnites || 0).toFixed(0)],
      ];

      autoTable(doc, {
        startY: 42,
        head: [kpiData[0]],
        body: kpiData.slice(1),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 14, right: 14 },
      });

      // Page 2 : Ventes par opérateur
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Ventes par opérateur', 14, 22);

      const operatorData = [['Opérateur', 'Montant (FC)']];
      let totalOperatorAmount = 0;
      if (stats.operatorStats) {
        Object.entries(stats.operatorStats).forEach(([name, amount]) => {
          operatorData.push([name, amount.toFixed(0)]);
          totalOperatorAmount += amount;
        });
      }
      if (operatorData.length > 1) {
        operatorData.push(['TOTAL', totalOperatorAmount.toFixed(0)]);
      } else {
        operatorData.push(['Aucune donnée', '0']);
      }

      autoTable(doc, {
        startY: 30,
        head: [operatorData[0]],
        body: operatorData.slice(1),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 14, right: 14 },
      });

      // Page 3 : Ventes par produit (jus)
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Ventes par produit (jus)', 14, 22);

      const productMap = {};
      dailyMovements.forEach(m => {
        if (m.movement_type === 'cooperant_take' || m.movement_type === 'retail_sale') {
          const pid = m.product_id;
          const qty = Math.abs(m.quantity_change);
          if (!productMap[pid]) {
            const prod = products.find(p => p.id === pid);
            productMap[pid] = { name: prod?.name || 'Inconnu', qty: 0, amount: 0 };
          }
          productMap[pid].qty += qty;
          const prod = products.find(p => p.id === pid);
          const unitPrice = prod?.unit_price || 0;
          productMap[pid].amount += qty * unitPrice;
        }
      });
      const productSales = Object.values(productMap).sort((a, b) => b.qty - a.qty);
      const productData = [['Produit', 'Quantité', 'CA (FC)']];
      productSales.slice(0, 10).forEach(p => {
        productData.push([p.name, p.qty, p.amount.toFixed(0)]);
      });
      if (productData.length === 1) productData.push(['Aucune vente', '0', '0']);

      autoTable(doc, {
        startY: 30,
        head: [productData[0]],
        body: productData.slice(1),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 14, right: 14 },
      });

      // Page 4 : Coopérants
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Performances des coopérants', 14, 22);

      const coopMap = {};
      dailyMovements.forEach(m => {
        if (m.movement_type === 'cooperant_take' || m.movement_type === 'cooperant_return') {
          const cid = m.cooperant_id;
          if (!cid) return;
          if (!coopMap[cid]) {
            const seller = sellers.find(s => s.id === cid);
            coopMap[cid] = { name: seller?.name || 'Inconnu', take: 0, ret: 0 };
          }
          const qty = Math.abs(m.quantity_change);
          if (m.movement_type === 'cooperant_take') coopMap[cid].take += qty;
          else coopMap[cid].ret += qty;
        }
      });
      const coopData = [['Coopérant', 'Pris', 'Retourné', 'Net']];
      Object.values(coopMap).forEach(c => {
        coopData.push([c.name, c.take, c.ret, c.take - c.ret]);
      });
      if (coopData.length === 1) coopData.push(['Aucune activité', '0', '0', '0']);

      autoTable(doc, {
        startY: 30,
        head: [coopData[0]],
        body: coopData.slice(1),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 14, right: 14 },
      });

      // Page 5 : Stock
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Stock détaillé', 14, 22);

      const stockTable = [['Produit', 'Stock initial', 'Entrées', 'Sorties', 'Stock final']];
      stockData.forEach(item => {
        stockTable.push([item.name, item.initialStock, item.entries, item.exits, item.finalStock]);
      });
      if (stockTable.length === 1) stockTable.push(['Aucune donnée', '0', '0', '0', '0']);

      autoTable(doc, {
        startY: 30,
        head: [stockTable[0]],
        body: stockTable.slice(1),
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 14, right: 14 },
      });

      doc.save('rapport_gloria_business.pdf');
      setMessage({ type: 'success', text: '✅ PDF exporté avec succès !' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'export PDF : ' + (error.message || 'inconnue') });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    setLoading(true);
    try {
      const { stockMovements, products, sellers } = await fetchLocalData();
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today + 'T00:00:00');
      const todayEnd = new Date(today + 'T23:59:59');
      const movements = stockMovements.filter(m => {
        const d = new Date(m.created_at);
        return d >= todayStart && d <= todayEnd;
      });

      let csvContent = 'Type,Produit,Coopérant,Quantité,Date\n';
      movements.forEach(m => {
        const type = m.movement_type === 'cooperant_take' ? 'Prise' :
                    m.movement_type === 'cooperant_return' ? 'Retour' : 'Vente détail';
        const product = products.find(p => p.id === m.product_id)?.name || 'Inconnu';
        const cooperant = sellers.find(s => s.id === m.cooperant_id)?.name || '-';
        const qty = Math.abs(m.quantity_change);
        const date = new Date(m.created_at).toLocaleString();
        csvContent += `${type},${product},${cooperant},${qty},${date}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_gloria_${today}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '✅ CSV exporté avec succès !' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'export CSV' });
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = async () => {
    setLoading(true);
    try {
      const data = await fetchLocalData();
      // On peut aussi ajouter les stats calculées, mais on exporte les tables brutes
      const exportData = {
        date: new Date().toISOString(),
        tables: data,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sauvegarde_gloria_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '✅ Sauvegarde effectuée avec succès !' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '❌ Erreur lors de la sauvegarde' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', paddingTop: '140px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ color: '#1e3a8a', marginBottom: '0.5rem', fontSize: '2rem' }}>💾 Sauvegarde / Export</h1>
        <p style={{ color: '#4b5563', fontSize: '1.1rem' }}>Exporter les données et les rapports</p>
      </div>

      {message && (
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>📄 Exporter en PDF</h3>
          <p style={{ color: '#6b7280' }}>Rapport complet (ventes, opérateurs, stock, performances).</p>
          <div style={{ marginTop: '0.5rem' }}>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              style={{ padding: '0.3rem', borderRadius: '0.3rem', border: '1px solid #d1d5db', marginRight: '0.5rem' }}
            >
              <option value="daily">Journée</option>
              <option value="weekly">Semaine</option>
              <option value="monthly">Mois</option>
            </select>
            <button
              onClick={exportPDF}
              disabled={loading}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                fontSize: '1rem'
              }}
            >
              {loading ? 'Génération...' : '📥 Exporter en PDF'}
            </button>
          </div>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>📊 Exporter en CSV</h3>
          <p style={{ color: '#6b7280' }}>Données brutes des mouvements (Excel).</p>
          <button
            onClick={exportCSV}
            disabled={loading}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Génération...' : '📥 Exporter en CSV'}
          </button>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>💾 Sauvegarde manuelle</h3>
          <p style={{ color: '#6b7280' }}>Archive JSON de toutes les données.</p>
          <button
            onClick={exportJSON}
            disabled={loading}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.5rem',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Génération...' : '💾 Sauvegarder'}
          </button>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>ℹ️ A propos</h3>
          <ul style={{ color: '#4b5563', paddingLeft: '1.5rem' }}>
            <li>📄 PDF : rapport complet (ventes, opérateurs, stock, performances)</li>
            <li>📊 CSV : données brutes pour analyse externe</li>
            <li>💾 JSON : sauvegarde complète des données</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
        <h4 style={{ marginTop: 0, color: '#1f2937' }}>📌 Aide</h4>
        <ul style={{ color: '#4b5563', paddingLeft: '1.5rem' }}>
          <li>Le PDF contient 5 pages : KPI, opérateurs, ventes par produit, performances coopérants, stock.</li>
          <li>Le CSV contient tous les mouvements du jour.</li>
          <li>La sauvegarde JSON inclut toutes les tables de la base locale (produits, mouvements, ventes, vendeurs, opérateurs, clients).</li>
        </ul>
      </div>
    </div>
  );
};

export default Sauvegarde;