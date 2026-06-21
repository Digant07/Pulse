import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { RepoSelector } from './components/RepoSelector';
import { ConfigureProject } from './components/ConfigureProject';
import { BuildTerminal } from './components/BuildTerminal';
import { DocsModal } from './components/DocsModal';
import { FeedbackModal } from './components/FeedbackModal';
import { ExternalLink } from 'lucide-react';
import { API_BASE_URL } from './config';
import './App.css';

interface User {
  name: string;
  login: string;
  avatar_url: string;
  token: string;
  isPat?: boolean;
  isMock?: boolean;
}

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

interface Deployment {
  id: string;
  projectId: string;
  status: string;
  url: string;
  createdAt: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'import' | 'configure' | 'terminal'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Check URL query parameters for OAuth responses
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth_success');
    const errorMsg = params.get('auth_error');
    const mockLogin = params.get('mock_login');

    if (mockLogin) {
      const loggedInUser: User = {
        token: 'mocktoken',
        login: 'mockuser',
        name: 'Mock User',
        avatar_url: 'https://avatars.githubusercontent.com/u/9919?v=4'
      };
      localStorage.setItem('pluse_user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authSuccess) {
      const token = params.get('token') || '';
      const login = params.get('login') || '';
      const name = params.get('name') || '';
      const avatar_url = params.get('avatar') || '';

      const loggedInUser: User = { token, login, name, avatar_url };
      localStorage.setItem('pluse_user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorMsg) {
      setAuthError(decodeURIComponent(errorMsg));
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const savedUser = localStorage.getItem('pluse_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    }
  }, []);

  // Fetch projects when user logs in or returns to dashboard
  const fetchProjects = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        headers: { 'x-user-id': user.login }
      });
      const data = await response.json();
      if (response.ok) {
        setProjects(data);
      }
    } catch (err) {
      console.error('Failed to fetch projects list:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, view]);

  // Periodic polling for project statuses when on the dashboard
  useEffect(() => {
    if (!user || view !== 'dashboard') return;

    const interval = setInterval(() => {
      fetchProjects();
    }, 4000);

    return () => clearInterval(interval);
  }, [user, view]);


  const handleSignOut = () => {
    localStorage.removeItem('pluse_user');
    setUser(null);
    setView('dashboard');
  };

  const handleSelectProject = async (projectId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        headers: { 'x-user-id': user!.login }
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedProject(data.project);
        // Find latest deployment
        if (data.deployments && data.deployments.length > 0) {
          const sorted = data.deployments.sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setSelectedDeployment(sorted[0]);
        }
        setView('terminal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeploySuccess = (data: { project: Project; deployment: Deployment }) => {
    setSelectedProject(data.project);
    setSelectedDeployment(data.deployment);
    setView('terminal');
  };

  return (
    <div className="app-container">
      <div className="gradient-background" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {user && (
        <header className="navbar-container">
          <div className="navbar-top-row">
            <div className="navbar-left">
              <div className="nav-brand" onClick={() => { setView('dashboard'); setActiveTab('overview'); }} style={{ cursor: 'pointer' }}>
                <svg viewBox="0 0 76 65" className="nav-logo-triangle" style={{ width: '20px', height: '20px', fill: 'white' }}>
                  <path d="M37.5273 0L75.0546 65H0L37.5273 0Z" />
                </svg>
                <span>PLUSE</span>
              </div>
              <span className="nav-divider">/</span>
              <div className="nav-user-org">
                <img src={user.avatar_url} alt={user.name} className="nav-user-avatar-mini" />
                <span className="nav-user-org-name">{user.login}</span>
                <span className="hobby-badge">Hobby</span>
              </div>
            </div>
            
            <div className="navbar-right">
              <button onClick={() => setShowDocsModal(true)} className="nav-link-item-btn">Docs</button>
              <button onClick={() => setShowFeedbackModal(true)} className="nav-link-item-btn">Feedback</button>
              <div className="nav-profile-menu-container">
                <img 
                  src={user.avatar_url} 
                  alt={user.name} 
                  className="nav-user-avatar-clickable" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                />
                {showProfileMenu && (
                  <div className="nav-profile-dropdown">
                    <div className="dropdown-user-info">
                      <div className="dropdown-user-name">{user.name}</div>
                      <div className="dropdown-user-email">@{user.login}</div>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={() => { setView('dashboard'); setActiveTab('settings'); setShowProfileMenu(false); }}>
                      Account Settings
                    </button>
                    <button className="dropdown-item" onClick={handleSignOut}>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {view === 'dashboard' && (
            <div className="navbar-bottom-row">
              <button 
                className={`nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
          )}
        </header>
      )}

      <div className={`app-content ${user ? (view === 'dashboard' ? 'has-double-nav' : 'has-single-nav') : ''}`}>

        {authError && !user && (
          <div style={{
            maxWidth: '460px',
            margin: '40px auto 0 auto',
            backgroundColor: 'rgba(255,0,80,0.1)',
            border: '1px solid #ff0050',
            color: '#ff0050',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            textAlign: 'center'
          }}>
            OAuth Login failed: {authError}. Please try again.
          </div>
        )}

        {!user ? (
          <Login />
        ) : (
          <main>
            {view === 'dashboard' && activeTab === 'overview' && (
              <Dashboard
                projects={projects}
                onSelectProject={handleSelectProject}
                onNavigateToImport={() => setView('import')}
              />
            )}

            {view === 'dashboard' && activeTab === 'settings' && (
              <div className="settings-page-container" style={{ animation: 'slideDown 0.25s ease-out' }}>
                <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '32px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', fontFamily: 'Outfit, sans-serif' }}>Account Settings</h3>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '6px' }}>GitHub Profile</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={user.avatar_url} alt={user.name} style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--border-subtle)' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{user.name}</div>
                        <a href={`https://github.com/${user.login}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          github.com/{user.login}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '24px 0' }}></div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '6px' }}>Security Settings</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-secondary)', marginBottom: '16px' }}>
                      Revoke authorization token and sign out of the Pluse web application.
                    </div>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 16px', borderColor: '#ff0050', color: '#ff0050', background: 'rgba(255,0,80,0.02)', fontWeight: 600 }} onClick={handleSignOut}>
                      Revoke GitHub Access
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'import' && (
              <RepoSelector
                token={user.token}
                onBack={() => setView('dashboard')}
                onSelectRepo={(repo) => {
                  setSelectedRepo(repo);
                  setView('configure');
                }}
              />
            )}

            {view === 'configure' && selectedRepo && (
              <ConfigureProject
                repo={selectedRepo}
                token={user.token}
                onBack={() => setView('import')}
                onDeploy={handleDeploySuccess}
              />
            )}

            {view === 'terminal' && selectedProject && selectedDeployment && (
              <BuildTerminal
                project={selectedProject}
                initialDeployment={selectedDeployment}
                onBack={() => setView('dashboard')}
                userId={user!.login}
              />
            )}
          </main>
        )}
      </div>
      <DocsModal isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} />
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </div>
  );
}

export default App;
