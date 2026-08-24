import { useState } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Sauvegarde = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [exportType, setExportType] = useState('daily');

  const exportPDF = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const statsRes = await axios.get('http://localhost:5000/api/dashboard/stats');
      const stats = statsRes.data.data;
      const today = new Date().toISOString().split('T')[0];
      const movesRes = await axios.get(`http://localhost:5000/api/movements?start_date=${today}&end_date=${today}`);
      const movements = movesRes.data.data || [];
      const stockRes = await axios.get('http://localhost:5000/api/stock/daily');
      const stockData = stockRes.data.data || [];

      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Page 1 : KPI
      doc.setFontSize(18);
      doc.text('Rapport Gloria Business', 14, 22);
      doc.setFontSize(10);
      doc.text(`Genere le ${new Date().toLocaleString()}`, 14, 30);
      doc.text(`Periode : ${exportType === 'daily' ? 'Journee' : exportType === 'weekly' ? 'Semaine' : 'Mois'}`, 14, 36);

      const kpiData = [
        ['Indicateur', 'Valeur'],
        ['Total bouteilles vendues', stats.totalJuiceSold || 0],
        ['CA total (FC)', (stats.totalJuiceAmount || 0).toFixed(0)],
        ['Stock (bouteilles)', stats.totalStockBottles || 0],
        ['Stock (paquets)', stats.totalStockPackets || 0],
        ['Ventes e-money (FC)', (stats.totalEMoney || 0).toFixed(0)],
        ['Ventes megas (FC)', (stats.totalMegas || 0).toFixed(0)],
        ['Ventes unites (FC)', (stats.totalUnites || 0).toFixed(0)],
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
      doc.text('Ventes par operateur', 14, 22);

      const operatorData = [['Operateur', 'Montant (FC)']];
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
        operatorData.push(['Aucune donnee', '0']);
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

      // Page 3 : Ventes par produit
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Ventes par produit (jus)', 14, 22);

      const productMap = {};
      movements.forEach(m => {
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
      const productSales = Object.values(productMap).sort((a, b) => b.qty - a.qty);
      const productData = [['Produit', 'Quantite', 'CA (FC)']];
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
      doc.text('Performances des cooperants', 14, 22);

      const coopMap = {};
      movements.forEach(m => {
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
      const coopData = [['Cooperant', 'Pris', 'Retourne', 'Net']];
      Object.values(coopMap).forEach(c => {
        coopData.push([c.name, c.take, c.ret, c.take - c.ret]);
      });
      if (coopData.length === 1) coopData.push(['Aucune activite', '0', '0', '0']);

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
      doc.text('Stock detaille', 14, 22);

      const stockTable = [['Produit', 'Stock initial', 'Entrees', 'Sorties', 'Stock final']];
      stockData.forEach(item => {
        stockTable.push([item.name, item.initialStock, item.entries, item.exits, item.finalStock]);
      });
      if (stockTable.length === 1) stockTable.push(['Aucune donnee', '0', '0', '0', '0']);

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
      setMessage({ type: 'success', text: '✅ PDF exporte avec succes !' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'export PDF : ' + (error.response?.data?.error || error.message) });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const movesRes = await axios.get(`http://localhost:5000/api/movements?start_date=${today}&end_date=${today}`);
      const movements = movesRes.data.data || [];

      let csvContent = 'Type,Produit,Cooperant,Quantite,Date\n';
      movements.forEach(m => {
        const type = m.movement_type === 'cooperant_take' ? 'Prise' :
                    m.movement_type === 'cooperant_return' ? 'Retour' : 'Vente detail';
        const product = m.product?.name || 'Inconnu';
        const cooperant = m.cooperant?.name || '-';
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
      setMessage({ type: 'success', text: '✅ CSV exporte avec succes !' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '❌ Erreur lors de l\'export CSV' });
    }
  };

  return (
    <div style={{ padding: '2rem', paddingTop: '140px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ color: '#1e3a8a', marginBottom: '0.5rem', fontSize: '2rem' }}>💾 Sauvegarde / Export</h1>
        <p style={{ color: '#4b5563', fontSize: '1.1rem' }}>Exporter les donnees et les rapports</p>
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
          <p style={{ color: '#6b7280' }}>Rapport complet (ventes, operateurs, stock, performances).</p>
          <div style={{ marginTop: '0.5rem' }}>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              style={{ padding: '0.3rem', borderRadius: '0.3rem', border: '1px solid #d1d5db', marginRight: '0.5rem' }}
            >
              <option value="daily">Journee</option>
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
              {loading ? 'Generation...' : '📥 Exporter en PDF'}
            </button>
          </div>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>📊 Exporter en CSV</h3>
          <p style={{ color: '#6b7280' }}>Donnees brutes des mouvements (Excel).</p>
          <button
            onClick={exportCSV}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            📥 Exporter en CSV
          </button>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>💾 Sauvegarde manuelle</h3>
          <p style={{ color: '#6b7280' }}>Archive JSON de toutes les donnees.</p>
          <button
            onClick={async () => {
              try {
                const response = await axios.get('http://localhost:5000/api/dashboard/stats');
                const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sauvegarde_gloria_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
                setMessage({ type: 'success', text: '✅ Sauvegarde effectuee avec succes !' });
              } catch (error) {
                setMessage({ type: 'error', text: '❌ Erreur lors de la sauvegarde' });
              }
            }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.5rem',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            💾 Sauvegarder
          </button>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>ℹ️ A propos</h3>
          <ul style={{ color: '#4b5563', paddingLeft: '1.5rem' }}>
            <li>📄 PDF : rapport complet (ventes, operateurs, stock, performances)</li>
            <li>📊 CSV : donnees brutes pour analyse externe</li>
            <li>💾 JSON : sauvegarde complete des donnees</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e5e7eb' }}>
        <h4 style={{ marginTop: 0, color: '#1f2937' }}>📌 Aide</h4>
        <ul style={{ color: '#4b5563', paddingLeft: '1.5rem' }}>
          <li>Le PDF contient 5 pages : KPI, operateurs, ventes par produit, performances cooperants, stock.</li>
          <li>Le CSV contient tous les mouvements du jour.</li>
          <li>La sauvegarde JSON inclut toutes les donnees du tableau de bord.</li>
        </ul>
      </div>
    </div>
  );
};

export default Sauvegarde;