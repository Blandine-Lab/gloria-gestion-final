import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Identifiants incorrects');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#1a1a2e',
    }}>
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
        onError={() => {
          if (videoRef.current) videoRef.current.style.display = 'none';
        }}
      >
        <source src="/loging.mp4" type="video/mp4" />
        <source src="/loging.webm" type="video/webm" />
        <source src="/loging.ogg" type="video/ogg" />
      </video>

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1,
      }} />

      <form onSubmit={handleSubmit} style={{
        position: 'relative',
        zIndex: 2,
        background: 'rgba(255,255,255,0.92)',
        padding: '2rem 1.5rem',
        borderRadius: '1rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '360px',
        backdropFilter: 'blur(4px)',
        margin: '1rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.jpeg" alt="Gloria Business" style={{ height: '45px', marginBottom: '0.5rem' }} />
          <h1 style={{ color: '#1e3a8a', margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>Gloria Business</h1>
          <p style={{ color: '#4b5563', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Connectez-vous</p>
        </div>

        {error && (
          <div style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            background: '#fecaca',
            color: '#991b1b',
            fontSize: '0.85rem',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.3rem', color: '#1f2937', fontSize: '0.85rem' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '2px solid #d1d5db',
              color: '#1f2937',
              fontSize: '0.9rem',
              outline: 'none',
              background: 'white',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.3rem', color: '#1f2937', fontSize: '0.85rem' }}>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '2px solid #d1d5db',
              color: '#1f2937',
              fontSize: '0.9rem',
              outline: 'none',
              background: 'white',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.6rem',
            background: '#1e3a8a',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        <div style={{ marginTop: '0.8rem', textAlign: 'center', fontSize: '0.75rem', color: '#6b7280' }}>
          Contactez l'administrateur pour vos identifiants.
        </div>
      </form>
    </div>
  );
};

export default Login;