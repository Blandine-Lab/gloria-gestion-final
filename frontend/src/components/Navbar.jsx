import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Compteur pour l'accès admin (5 clics sur "Accueil")
  const [clickCount, setClickCount] = useState(0);
  const timerRef = useRef(null);

  // Définition des onglets
  const tabs = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Stocks', path: '/stocks' },
    { name: 'Sorties', path: '/sorties' },
    { name: 'Ventes-Mega', path: '/ventes-mega' },
    { name: 'Rapports', path: '/rapports' },
  ];

  // Gestion du clic sur "Accueil" (5 clics pour admin)
  const handleHomeClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (timerRef.current) clearTimeout(timerRef.current);
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 3000);
    timerRef.current = timer;

    if (newCount >= 5) {
      clearTimeout(timer);
      setClickCount(0);
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const isHome = location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1.5rem',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: '#1e3a8a',
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        borderBottom: '1px solid rgba(255,255,255,0.4)',
        gap: '1rem',
        flexWrap: 'wrap',
        minHeight: '64px',
      }}
    >
      {/* Groupe gauche : Logo + Nom + Boutons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        {/* Logo */}
        <img
          src="/logo.jpeg"
          alt="Gloria Business"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          onError={(e) => { e.target.src = '/default-logo.png'; }}
        />
        {/* Nom de l'entreprise */}
        <span style={{
          fontWeight: 'bold',
          fontSize: '1.1rem',
          color: '#1e3a8a',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
        }}>
          Gloria Business
        </span>

        {/* Boutons Retour / Accueil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(30, 58, 138, 0.08)',
                border: 'none',
                color: '#1e3a8a',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.3rem 0.7rem',
                borderRadius: '0.5rem',
                transition: 'all 0.2s',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 58, 138, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 58, 138, 0.08)'}
            >
              <span>⬅️</span> Retour
            </button>
          )}
          <button
            onClick={handleHomeClick}
            style={{
              background: 'rgba(30, 58, 138, 0.08)',
              border: 'none',
              color: '#1e3a8a',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.3rem 0.7rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s',
              fontWeight: '500',
              position: 'relative',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 58, 138, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 58, 138, 0.08)'}
          >
            <span>🏠</span> Accueil
            {clickCount > 0 && (
              <span style={{
                marginLeft: '0.2rem',
                fontSize: '0.6rem',
                background: '#1e3a8a',
                color: 'white',
                padding: '0.1rem 0.35rem',
                borderRadius: '1rem',
                opacity: 0.8,
              }}>
                {5 - clickCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Onglets centraux */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.2rem',
        flexWrap: 'wrap',
        flex: 1,
        justifyContent: 'center',
      }}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                background: isActive ? 'rgba(30, 58, 138, 0.12)' : 'transparent',
                border: 'none',
                color: isActive ? '#1e3a8a' : '#4b5563',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '0.4rem 0.9rem',
                borderRadius: '0.5rem',
                transition: 'all 0.2s',
                fontWeight: isActive ? '600' : '400',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(30, 58, 138, 0.06)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Groupe droit : Déconnexion + Date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }}>
        {/* Bouton de déconnexion */}
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: 'none',
            color: '#dc2626',
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: '0.3rem 0.8rem',
            borderRadius: '0.5rem',
            transition: 'all 0.2s',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
        >
          <span>🚪</span> Déconnexion
        </button>
        {/* Date */}
        <span style={{
          fontSize: '0.8rem',
          opacity: 0.7,
          color: '#1e3a8a',
          background: 'rgba(30, 58, 138, 0.06)',
          padding: '0.3rem 0.8rem',
          borderRadius: '2rem',
          whiteSpace: 'nowrap',
        }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      </div>
    </nav>
  );
};

export default Navbar;