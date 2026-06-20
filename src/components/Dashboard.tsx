import React, { useState } from 'react';
import { Search, Plus, ExternalLink, GitBranch, ShieldAlert, Sliders, Layout, CheckCircle, Clock, Share2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  repository: string;
  branch: string;
  framework: string;
  url: string;
  createdAt: string;
  status: string;
}

interface DashboardProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onNavigateToImport: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, onNavigateToImport }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.repository.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFrameworkLogo = (framework: string) => {
    switch (framework) {
      case 'next':
        return (
          <div className="fw-logo-circle" style={{ background: '#000', border: '1px solid #fff' }}>
            <span style={{ fontWeight: 800, fontSize: '12px' }}>▲</span>
          </div>
        );
      case 'vite':
      case 'react':
        return (
          <div className="fw-logo-circle" style={{ background: '#20232a' }}>
            <span style={{ color: '#61dafb', fontWeight: 800, fontSize: '10px' }}>⚛</span>
          </div>
        );
      case 'vue':
        return (
          <div className="fw-logo-circle" style={{ background: '#41b883' }}>
            <span style={{ color: '#35495e', fontWeight: 800, fontSize: '10px' }}>V</span>
          </div>
        );
      case 'svelte':
        return (
          <div className="fw-logo-circle" style={{ background: '#ff3e00' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '10px' }}>S</span>
          </div>
        );
      default:
        return (
          <div className="fw-logo-circle" style={{ background: '#333' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '10px' }}>H</span>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-view-wrapper">
      {/* Search and Add New bar */}
      <div className="dashboard-filter-bar">
        <div className="search-input-container">
          <Search size={15} className="search-icon-muted" />
          <input
            type="text"
            className="search-projects-input"
            placeholder="Search Projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-actions-group">
          <button className="btn-filter-toggle">
            <Sliders size={14} />
          </button>
          <button className="btn-layout-toggle active">
            <Layout size={14} />
          </button>
          <button className="btn-add-new-vercel" onClick={onNavigateToImport}>
            Add New...
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="dashboard-layout-grid">
        {/* Left Column - Usage & Alerts */}
        <div className="dashboard-left-col">
          {/* Usage Card */}
          <div className="dashboard-stats-card">
            <div className="card-header-row">
              <span className="card-title-text">Usage</span>
              <span className="card-subtitle-small">Last 30 days</span>
            </div>
            
            <div className="usage-progress-list">
              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Edge Requests</span>
                  <span className="progress-val">7.3K / 1M</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-bar-fill" style={{ width: '0.73%' }}></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Fast Data Transfer</span>
                  <span className="progress-val">31.5 MB / 100 GB</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-bar-fill" style={{ width: '0.03%' }}></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Edge Request CPU Duration</span>
                  <span className="progress-val">0s / 1h</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-bar-fill" style={{ width: '0%' }}></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Fast Origin Transfer</span>
                  <span className="progress-val">0 / 10 GB</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-bar-fill" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>

            <button className="btn-upgrade-stats">Upgrade</button>
          </div>

          {/* Alerts Card */}
          <div className="dashboard-stats-card alerts-card">
            <div className="card-header-row">
              <span className="card-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} style={{ color: 'var(--color-secondary)' }} />
                Alerts
              </span>
            </div>
            <div className="alerts-card-body">
              <div className="alert-bell-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h4 className="alert-prompt-title">Get alerted for anomalies</h4>
              <p className="alert-prompt-desc">Automatically monitor your projects for anomalies and get notified.</p>
              <button className="btn-upgrade-pro">Upgrade to Pro</button>
            </div>
          </div>
        </div>

        {/* Right Column - Project List */}
        <div className="dashboard-right-col">
          <div className="dashboard-col-header">
            <span className="card-title-text">Projects</span>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="vercel-empty-projects">
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>No projects configured yet</h4>
              <p style={{ fontSize: '13px', color: 'var(--color-secondary)', marginBottom: '20px' }}>
                Deploy a project via the repository selection portal to list it on your overview dashboard.
              </p>
              <button className="btn-add-new-vercel" style={{ margin: '0 auto' }} onClick={onNavigateToImport}>
                <Plus size={14} />
                Import Project
              </button>
            </div>
          ) : (
            <div className="vercel-projects-list">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="vercel-project-card"
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="vpc-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {getFrameworkLogo(project.framework)}
                      <div>
                        <h4 className="vpc-name">{project.name}</h4>
                        <span className="vpc-url">{project.url.replace('https://', '')}</span>
                      </div>
                    </div>
                    <div className="vpc-meta">
                      <span className="vpc-git-repo">
                        <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: '13px', height: '13px' }}>
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        {project.repository}
                      </span>
                      <span className="vpc-commit-message">
                        Latest commit details processed successfully
                      </span>
                      <span className="vpc-timestamp">
                        Active on <GitBranch size={11} style={{ display: 'inline', margin: '0 2px' }} /> {project.branch}
                      </span>
                    </div>
                  </div>
                  <div className="vpc-right">
                    <div className="vpc-status-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="vpc-status-dot-wrapper">
                        {project.status === 'READY' ? (
                          <CheckCircle size={16} className="vpc-status-icon ready" />
                        ) : (
                          <Clock size={16} className="vpc-status-icon active" />
                        )}
                        <span className={`vpc-status-text ${project.status.toLowerCase()}`}>{project.status}</span>
                      </div>
                      <div className="vpc-actions-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <a href={project.url} target="_blank" rel="noopener noreferrer" className="vpc-link-btn">
                          <ExternalLink size={12} />
                        </a>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(project.url);
                            alert('Project URL copied to clipboard!');
                          } catch (err) {
                            console.error('Copy failed', err);
                            alert('Failed to copy URL');
                          }
                        }}>
                          <Share2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Previews Card placeholder */}
          <div className="dashboard-stats-card" style={{ marginTop: '24px' }}>
            <div className="card-header-row">
              <span className="card-title-text">Recent Previews</span>
            </div>
            <div className="recent-previews-body">
              <div className="previews-icon-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 17V7" />
                  <path d="M15 17V7" />
                </svg>
              </div>
              <p className="previews-prompt-desc">Preview deployments that you have recently visited will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
