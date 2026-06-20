import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, GitBranch, Shield, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Repo {
  id: number;
  name: string;
  description: string;
  default_branch: string;
  updated_at: string;
  owner: { login: string };
}

interface EnvVar {
  key: string;
  value: string;
}

interface ConfigureProjectProps {
  repo: Repo;
  token: string;
  onBack: () => void;
  onDeploy: (projectConfig: any) => void;
}

export const ConfigureProject: React.FC<ConfigureProjectProps> = ({ repo, token, onBack, onDeploy }) => {
  const [projectName, setProjectName] = useState(repo.name);
  const [framework, setFramework] = useState('static');
  const [buildCommand, setBuildCommand] = useState('echo "Static build: No compilation required"');
  const [outputDirectory, setOutputDirectory] = useState('.');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingDetection, setLoadingDetection] = useState(true);
  const [showEnvMap, setShowEnvMap] = useState<{ [index: number]: boolean }>({});
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect framework
  useEffect(() => {
    const detectFramework = async () => {
      setLoadingDetection(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/github/repos/${repo.owner.login}/${repo.name}/framework`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok && data.detected) {
          setFramework(data.framework);
          updateBuildDefaults(data.framework);
        }
      } catch (err) {
        console.error('Failed to auto-detect framework:', err);
      } finally {
        setLoadingDetection(false);
      }
    };

    detectFramework();
  }, [repo, token]);

  const updateBuildDefaults = (fw: string) => {
    switch (fw) {
      case 'next':
        setBuildCommand('next build');
        setOutputDirectory('.next');
        break;
      case 'vite':
      case 'react':
        setBuildCommand('npm run build');
        setOutputDirectory('dist');
        break;
      case 'vue':
        setBuildCommand('npm run build');
        setOutputDirectory('dist');
        break;
      case 'svelte':
        setBuildCommand('npm run build');
        setOutputDirectory('.svelte-kit');
        break;
      default:
        setBuildCommand('echo "Static build: No compilation required"');
        setOutputDirectory('.');
    }
  };

  const handleFrameworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fw = e.target.value;
    setFramework(fw);
    updateBuildDefaults(fw);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    const next = [...envVars];
    next.splice(index, 1);
    setEnvVars(next);
  };

  const handleEnvKeyChange = (index: number, val: string) => {
    const next = [...envVars];
    next[index].key = val.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    setEnvVars(next);
  };

  const handleEnvValueChange = (index: number, val: string) => {
    const next = [...envVars];
    next[index].value = val;
    setEnvVars(next);
  };

  const toggleEnvVisibility = (index: number) => {
    setShowEnvMap({
      ...showEnvMap,
      [index]: !showEnvMap[index]
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setDeploying(true);
    setError(null);
    
    // Filter empty env variables
    const cleanEnv = envVars.filter(ev => ev.key.trim() !== '');

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          repository: `${repo.owner.login}/${repo.name}`,
          branch: repo.default_branch,
          framework,
          buildCommand,
          outputDirectory,
          env: cleanEnv,
          owner: repo.owner.login
        })
      });

      const data = await response.json();
      if (response.ok) {
        onDeploy({ project: data.project, deployment: data.deployment });
      } else {
        setError(data.error || 'Failed to create project.');
        setDeploying(false);
      }
    } catch (err) {
      setError('Could not connect to backend server. Make sure the server is online.');
      setDeploying(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <button className="btn-back" onClick={onBack} disabled={deploying}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="page-title">Configure Project</h2>
          <p style={{ color: 'var(--color-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Set up build settings and environment variables.
          </p>
        </div>
      </div>

      <div className="config-layout">
        <form onSubmit={handleSubmit} className="config-form-card">
          {error && (
            <div style={{
              backgroundColor: 'rgba(255, 0, 80, 0.1)',
              border: '1px solid #ff0050',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              color: '#ff0050',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input
              type="text"
              className="input-text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              disabled={deploying}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'block', marginTop: '4px' }}>
              Only lowercase alphanumeric characters and hyphens allowed.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Framework Preset</label>
            <select
              className="select-box"
              value={framework}
              onChange={handleFrameworkChange}
              disabled={deploying || loadingDetection}
            >
              <option value="next">Next.js</option>
              <option value="vite">Vite (React/Vue/Svelte)</option>
              <option value="react">Create React App</option>
              <option value="vue">Vue CLI</option>
              <option value="svelte">SvelteKit</option>
              <option value="static">Other / Static HTML</option>
            </select>
            {loadingDetection && (
              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', display: 'block', marginTop: '4px' }}>
                Inspecting repository dependencies...
              </span>
            )}
          </div>

          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={deploying}
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Build and Output Settings
          </button>

          {showAdvanced && (
            <div className="advanced-panel">
              <div className="form-group">
                <label className="form-label">Build Command</label>
                <input
                  type="text"
                  className="input-text"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  disabled={deploying}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Output Directory</label>
                <input
                  type="text"
                  className="input-text"
                  value={outputDirectory}
                  onChange={(e) => setOutputDirectory(e.target.value)}
                  disabled={deploying}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} />
              Environment Variables (Secrets)
            </label>
            
            <div className="env-variable-builder">
              {envVars.map((env, idx) => (
                <div key={idx} className="env-row">
                  <input
                    type="text"
                    className="input-text"
                    placeholder="NAME"
                    value={env.key}
                    onChange={(e) => handleEnvKeyChange(idx, e.target.value)}
                    disabled={deploying}
                  />
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showEnvMap[idx] ? 'text' : 'password'}
                      className="input-text"
                      placeholder="VALUE"
                      value={env.value}
                      onChange={(e) => handleEnvValueChange(idx, e.target.value)}
                      disabled={deploying}
                    />
                    <button
                      type="button"
                      onClick={() => toggleEnvVisibility(idx)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {showEnvMap[idx] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-env"
                    onClick={() => removeEnvVar(idx)}
                    disabled={deploying}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                className="btn-add-env"
                onClick={addEnvVar}
                disabled={deploying}
              >
                <Plus size={14} />
                Add Variable
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-github"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={deploying}
          >
            {deploying ? 'Deploying Project...' : 'Deploy'}
          </button>
        </form>

        <div className="config-sidebar">
          <h3 className="sidebar-title">Import Details</h3>
          <div className="sidebar-meta-item">
            <div className="sidebar-meta-label">Git Provider</div>
            <div className="sidebar-meta-val">
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </div>
          </div>
          <div className="sidebar-meta-item">
            <div className="sidebar-meta-label">Repository</div>
            <div className="sidebar-meta-val">{repo.owner.login}/{repo.name}</div>
          </div>
          <div className="sidebar-meta-item">
            <div className="sidebar-meta-label">Branch</div>
            <div className="sidebar-meta-val">
              <GitBranch size={14} />
              {repo.default_branch}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
