import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, GitFork, RefreshCw, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Repo {
  id: number;
  name: string;
  description: string;
  default_branch: string;
  updated_at: string;
  owner: { login: string };
}

interface RepoSelectorProps {
  token: string;
  onBack: () => void;
  onSelectRepo: (repo: Repo) => void;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({ token, onBack, onSelectRepo }) => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/github/repos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setRepos(data);
      } else {
        setError(data.error || 'Failed to fetch repositories.');
      }
    } catch (err) {
      setError('Could not connect to backend server. Please verify the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [token]);

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="page-title">Import Git Repository</h2>
          <p style={{ color: 'var(--color-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Select a project repository to deploy it to Pulse.
          </p>
        </div>
      </div>

      <div className="search-filter-bar" style={{ display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-muted)'
          }} />
          <input
            type="text"
            className="input-text"
            style={{ paddingLeft: '44px' }}
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={fetchRepos}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(255, 0, 80, 0.1)',
          border: '1px solid #ff0050',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          color: '#ff0050'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="repo-item" style={{ opacity: 0.5, animation: 'pulse 1.5s infinite ease-in-out' }}>
              <div style={{ width: '60%' }}>
                <div style={{ height: '18px', width: '40%', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', marginBottom: '8px' }} />
                <div style={{ height: '14px', width: '80%', backgroundColor: 'var(--border-subtle)', borderRadius: '4px' }} />
              </div>
              <div style={{ height: '34px', width: '80px', backgroundColor: 'var(--border-subtle)', borderRadius: '6px' }} />
            </div>
          ))}
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state-title">No repositories found</h3>
          <p className="empty-state-desc">We couldn't find any repositories matching your search query.</p>
        </div>
      ) : (
        <div className="repo-list">
          {filteredRepos.map((repo) => (
            <div key={repo.id} className="repo-item">
              <div className="repo-item-details">
                <h4 className="repo-item-name">
                  <GitFork size={16} />
                  {repo.name}
                </h4>
                <p className="repo-item-desc">{repo.description || 'No description provided'}</p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--color-muted)', marginTop: '6px' }}>
                  <span>Branch: <strong>{repo.default_branch}</strong></span>
                  <span>Updated: {new Date(repo.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button className="btn-import" onClick={() => onSelectRepo(repo)}>
                Import
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
