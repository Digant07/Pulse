import React from 'react';
import { X, BookOpen, GitBranch, Shield, Terminal, ArrowRight } from 'lucide-react';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card docs-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <BookOpen size={20} className="text-accent-blue" />
            <h2 className="modal-title">Pulse Documentation</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="modal-body docs-body">
          <section className="docs-section">
            <h3> Quick Start Guide</h3>
            <p>
              Pulse is a next-generation platform for deploying web applications instantly. Follow these steps to set up your first deployment:
            </p>
            <ol className="docs-list">
              <li>Click <strong>Connect with GitHub</strong> on the login page to authorize your account.</li>
              <li>On the dashboard, click <strong>Add New...</strong> to fetch your repositories.</li>
              <li>Select your repository, verify the settings, and click <strong>Deploy</strong>.</li>
            </ol>
          </section>

          <section className="docs-section">
            <h3><GitBranch size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> Auto-Framework Detection</h3>
            <p>
              When you select a repository, Pulse scans your project's <code>package.json</code> file to detect dependencies and configure default settings:
            </p>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Framework</th>
                  <th>Detected Dependency</th>
                  <th>Default Build Command</th>
                  <th>Output Directory</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Next.js</strong></td>
                  <td><code>next</code></td>
                  <td><code>next build</code></td>
                  <td><code>.next</code></td>
                </tr>
                <tr>
                  <td><strong>Vite (React/Vue)</strong></td>
                  <td><code>vite</code></td>
                  <td><code>npm run build</code></td>
                  <td><code>dist</code></td>
                </tr>
                <tr>
                  <td><strong>Create React App</strong></td>
                  <td><code>react-scripts</code></td>
                  <td><code>npm run build</code></td>
                  <td><code>build</code></td>
                </tr>
                <tr>
                  <td><strong>SvelteKit</strong></td>
                  <td><code>svelte</code></td>
                  <td><code>npm run build</code></td>
                  <td><code>.svelte-kit</code></td>
                </tr>
                <tr>
                  <td><strong>Static HTML</strong></td>
                  <td>None / Other</td>
                  <td><code>echo "Static build"</code></td>
                  <td><code>.</code> (Root)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="docs-section">
            <h3><Shield size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> Environment Variables</h3>
            <p>
              Securely inject environment variables into your build environment. Pulse encrypts your variables and securely loads them during build pipeline tasks:
            </p>
            <ul className="docs-list">
              <li>Variables are configured on the <strong>Configure Project</strong> screen prior to deployment.</li>
              <li>You can mask/unmask variables using the <kbd>Eye</kbd> icon to check spelling values before deploying.</li>
              <li>Keys are normalized to uppercase alphanumeric symbols and underscores to match shell variable formats.</li>
            </ul>
          </section>

          <section className="docs-section">
            <h3><Terminal size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> Real-time Build Pipeline</h3>
            <p>
              Once you hit deploy, Pulse initiates a four-stage deployment flow:
            </p>
            <div className="docs-stepper-preview">
              <span className="step-badge">1. Queued</span>
              <span className="step-arrow"><ArrowRight size={12} /></span>
              <span className="step-badge">2. Build</span>
              <span className="step-arrow"><ArrowRight size={12} /></span>
              <span className="step-badge">3. Deploy</span>
              <span className="step-arrow"><ArrowRight size={12} /></span>
              <span className="step-badge-ready">4. Ready</span>
            </div>
            <p style={{ marginTop: '12px' }}>
              Logs are streamed in real time via <strong>Server-Sent Events (SSE)</strong>. If a build completes successfully, a unique routing URL (e.g., <code>https://project-name.pulse.dev</code>) is generated.
            </p>
          </section>
        </div>

        <footer className="modal-footer">
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={onClose}>
            Close Docs
          </button>
        </footer>
      </div>
    </div>
  );
};
