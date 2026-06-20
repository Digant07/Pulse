import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Terminal as TerminalIcon, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

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

interface BuildTerminalProps {
  project: Project;
  initialDeployment: Deployment;
  onBack: () => void;
}

export const BuildTerminal: React.FC<BuildTerminalProps> = ({ project, initialDeployment, onBack }) => {
  const [deployment, setDeployment] = useState<Deployment>(initialDeployment);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>(initialDeployment.status);
  const [redeploying, setRedeploying] = useState(false);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connectToLogs = (depId: string) => {
    // Clean up previous event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLogs([]);
    const es = new EventSource(`http://localhost:3001/api/deployments/${depId}/logs`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.log) {
        setLogs(prev => [...prev, data.log]);
      }
      if (data.status) {
        setStatus(data.status);
        setDeployment(prev => ({ ...prev, status: data.status }));
        
        // Trigger confetti on ready!
        if (data.status === 'READY') {
          triggerConfetti();
          es.close();
        } else if (data.status === 'FAILED') {
          es.close();
        }
      }
    };

    es.onerror = () => {
      setLogs(prev => [...prev, '[SYSTEM ERROR] EventSource lost connection. Attempting reconnect...']);
    };
  };

  useEffect(() => {
    connectToLogs(deployment.id);
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [deployment.id]);

  // Scroll to bottom on new logs
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#0070f3', '#00dfd8', '#ff007f']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#0070f3', '#00dfd8', '#ff007f']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleRedeploy = async () => {
    setRedeploying(true);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${project.id}/redeploy`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setStatus('QUEUED');
        setDeployment(data.deployment);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRedeploying(false);
    }
  };

  const getStepStatusClass = (step: string) => {
    // steps: queued -> building -> deploying -> ready
    const statusOrder = ['QUEUED', 'BUILDING', 'DEPLOYING', 'READY', 'FAILED'];
    const currentIdx = statusOrder.indexOf(status);
    const targetIdx = statusOrder.indexOf(step);

    if (status === 'FAILED') {
      if (step === 'READY') return 'failed';
      return 'completed';
    }

    if (currentIdx > targetIdx) return 'completed';
    if (currentIdx === targetIdx) return 'active';
    return '';
  };

  const getStepperWidth = () => {
    switch (status) {
      case 'QUEUED': return '0%';
      case 'BUILDING': return '33.3%';
      case 'DEPLOYING': return '66.6%';
      case 'READY': return '100%';
      case 'FAILED': return '100%';
      default: return '0%';
    }
  };

  const parseLogLineClass = (line: string) => {
    if (line.includes('✔') || line.includes('succeeded') || line.includes('Successful') || line.includes('READY')) {
      return 'terminal-line-success';
    }
    if (line.includes('WARN') || line.includes('warn') || line.includes('warning')) {
      return 'terminal-line-warning';
    }
    if (line.includes('ERR') || line.includes('error') || line.includes('failed') || line.includes('FAILED')) {
      return 'terminal-line-error';
    }
    if (line.startsWith('[') && line.includes('] ✨') || line.includes('[API Gateway') || line.includes('[SYSTEM]')) {
      return 'terminal-line-system';
    }
    if (line.includes('>') || line.includes('Running script')) {
      return 'terminal-line-comment';
    }
    return '';
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="page-title">{project.name}</h2>
          <p style={{ color: 'var(--color-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Deployment console logs and service updates.
          </p>
        </div>
      </div>

      <div className="deploy-header-panel">
        <div className="deploy-info">
          <div className="deploy-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TerminalIcon size={20} />
            <span>Active Deployment</span>
          </div>
          <div className="deploy-subtitle">
            Source: <strong style={{ color: 'white' }}>{project.repository} ({project.branch})</strong>
          </div>
          
          <div className="deployment-stepper">
            <div className="stepper-line" />
            <div className="stepper-progress" style={{ width: getStepperWidth() }} />
            
            <div className={`step-node ${getStepStatusClass('QUEUED')}`}>
              <div className="step-circle">1</div>
              <span className="step-label">Queued</span>
            </div>
            <div className={`step-node ${getStepStatusClass('BUILDING')}`}>
              <div className="step-circle">2</div>
              <span className="step-label">Build</span>
            </div>
            <div className={`step-node ${getStepStatusClass('DEPLOYING')}`}>
              <div className="step-circle">3</div>
              <span className="step-label">Deploy</span>
            </div>
            <div className={`step-node ${getStepStatusClass('READY')}`}>
              <div className="step-circle">4</div>
              <span className="step-label">{status === 'FAILED' ? 'Failed' : 'Ready'}</span>
            </div>
          </div>
        </div>

        <div className="deploy-actions">
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '10px 18px', borderColor: 'var(--status-failed)', color: 'var(--status-failed)' }}
            onClick={async () => {
              if (window.confirm(`Are you sure you want to delete the project "${project.name}"? This action cannot be undone.`)) {
                try {
                  const response = await fetch(`http://localhost:3001/api/projects/${project.id}`, {
                    method: 'DELETE'
                  });
                  if (response.ok) {
                    onBack();
                  } else {
                    alert('Failed to delete project.');
                  }
                } catch (err) {
                  alert('Error deleting project.');
                }
              }
            }}
          >
            Delete Project
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '10px 18px' }}
            onClick={handleRedeploy}
            disabled={status === 'BUILDING' || status === 'DEPLOYING' || redeploying}
          >
            <RefreshCw size={14} className={redeploying ? 'animate-spin' : ''} />
            Redeploy
          </button>
          {status === 'READY' && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-github"
              style={{ width: 'auto', padding: '10px 18px', background: '#fff', color: '#000' }}
            >
              <ExternalLink size={14} />
              Visit App
            </a>
          )}
        </div>
      </div>

      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="terminal-dot close" />
            <span className="terminal-dot minimize" />
            <span className="terminal-dot expand" />
          </div>
          <div className="terminal-title">bash — logs</div>
          <div
            className="terminal-badge"
            style={{
              backgroundColor: status === 'READY' ? 'rgba(0, 230, 118, 0.15)' :
                               status === 'FAILED' ? 'rgba(255, 0, 80, 0.15)' :
                               status === 'BUILDING' ? 'rgba(245, 166, 35, 0.15)' :
                               status === 'DEPLOYING' ? 'rgba(0, 112, 243, 0.15)' :
                               'rgba(255, 255, 255, 0.1)',
              color: status === 'READY' ? 'var(--status-ready)' :
                     status === 'FAILED' ? 'var(--status-failed)' :
                     status === 'BUILDING' ? 'var(--status-building)' :
                     status === 'DEPLOYING' ? 'var(--status-deploying)' :
                     'var(--color-secondary)'
            }}
          >
            {status}
          </div>
        </div>
        <div className="terminal-body" ref={terminalBodyRef}>
          {logs.map((log, index) => (
            <div key={index} className={`terminal-line ${parseLogLineClass(log)}`}>
              {log}
            </div>
          ))}
        </div>
      </div>



      {status === 'FAILED' && (
        <div className="success-overlay" style={{ borderColor: 'var(--status-failed)', boxShadow: '0 10px 40px rgba(255,0,80,0.1)' }}>
          <div className="success-icon" style={{ backgroundColor: 'rgba(255,0,80,0.1)', color: 'var(--status-failed)' }}>
            <XCircle size={36} />
          </div>
          <h3 className="success-title" style={{ color: 'var(--status-failed)' }}>Deployment Failed</h3>
          <p className="success-desc">
            An error occurred during build script runtime compile. Please review the compilation logs in the terminal screen above and attempt redeployment.
          </p>
          <button className="btn btn-github" style={{ width: 'auto' }} onClick={handleRedeploy}>
            Try Re-deploying
          </button>
        </div>
      )}
    </div>
  );
};
