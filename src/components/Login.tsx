import React from 'react';
import { AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const Login: React.FC = () => {
  const handleOAuthLogin = () => {
    // Redirect to backend OAuth initiator
    window.location.href = `${API_BASE_URL}/api/auth/github`;
  };

  // Get URL parameters to display any login errors
  const params = new URLSearchParams(window.location.search);
  const error = params.get('auth_error');

  return (
    <div className="login-container">
      <h1 className="hero-title">Deploy at the speed of light.</h1>
      <p className="hero-subtitle">
        Import your repository, configure your environment, and witness automated edge networks provisioning in seconds.
      </p>

      <div className="login-card">
        <div className="login-card-logo">
          <svg viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M37.5273 0L75.0546 65H0L37.5273 0Z" fill="white" />
          </svg>
        </div>
        <h2 className="login-card-title">Welcome to Pulse</h2>
        <p className="login-card-desc">Sign in to start creating and deploying web projects.</p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255, 0, 80, 0.1)',
            border: '1px solid #ff0050',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#ff0050',
            fontSize: '13px',
            textAlign: 'left'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="login-btn-group">
          <button className="btn btn-github" onClick={handleOAuthLogin}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Connect with GitHub (OAuth)
          </button>
        </div>
      </div>
    </div>
  );
};
