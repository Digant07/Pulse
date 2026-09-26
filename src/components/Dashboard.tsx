import React, { useState, useMemo } from 'react';
import { Search, Plus, ExternalLink, GitBranch, ShieldAlert, Sliders, Layout, CheckCircle, Clock, Share2, AlertTriangle, XCircle, Info, CheckCircle2, X } from 'lucide-react';
import { UpgradeModal } from './UpgradeModal';

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

// ─── Dynamic Usage engine (client-side, deterministic, no backend needed) ───
interface UsageMetric {
  used: number;
  quota: number;
  display: string;
  pct: number;
}

interface Usage {
  edgeRequests: UsageMetric;
  dataTransfer: UsageMetric;
  cpu: UsageMetric;
  origin: UsageMetric;
}

const QUOTAS = {
  EDGE_REQUESTS: 1_000_000,
  DATA_BYTES: 100 * 1024 ** 3,
  CPU_SECONDS: 3600,
  ORIGIN_BYTES: 10 * 1024 ** 3,
} as const;

const FRAMEWORK_PROFILE: Record<string, { req: number; bytesPerReq: number; cpuMs: number; originMiss: number }> = {
  next: { req: 1.4, bytesPerReq: 22 * 1024, cpuMs: 8, originMiss: 0.18 },
  nuxt: { req: 1.35, bytesPerReq: 20 * 1024, cpuMs: 7, originMiss: 0.18 },
  remix: { req: 1.3, bytesPerReq: 20 * 1024, cpuMs: 7, originMiss: 0.16 },
  gatsby: { req: 1.15, bytesPerReq: 16 * 1024, cpuMs: 2, originMiss: 0.05 },
  angular: { req: 1.1, bytesPerReq: 18 * 1024, cpuMs: 4, originMiss: 0.08 },
  svelte: { req: 1.05, bytesPerReq: 14 * 1024, cpuMs: 2, originMiss: 0.05 },
  vite: { req: 1.0, bytesPerReq: 14 * 1024, cpuMs: 1.5, originMiss: 0.03 },
  'react-cra': { req: 0.95, bytesPerReq: 15 * 1024, cpuMs: 1.5, originMiss: 0.03 },
  react: { req: 0.95, bytesPerReq: 15 * 1024, cpuMs: 1.5, originMiss: 0.03 },
  vue: { req: 0.95, bytesPerReq: 13 * 1024, cpuMs: 1.5, originMiss: 0.03 },
  astro: { req: 0.85, bytesPerReq: 10 * 1024, cpuMs: 1, originMiss: 0.02 },
  static: { req: 0.6, bytesPerReq: 8 * 1024, cpuMs: 0.3, originMiss: 0 },
};

const STATUS_MULT: Record<string, number> = {
  READY: 1,
  DEPLOYING: 0.25,
  BUILDING: 0.15,
  QUEUED: 0.05,
  FAILED: 0.08,
};

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function trim1(v: number): string {
  if (v >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10).replace(/\.0$/, '');
}

function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim1(n / 1000)}K`;
  return `${trim1(n / 1_000_000)}M`;
}

function formatBytesUsed(b: number): string {
  if (b <= 0) return '0';
  if (b < 1024 ** 3) return `${trim1(b / 1024 ** 2)} MB`;
  return `${(Math.round((b / 1024 ** 3) * 100) / 100).toFixed(2).replace(/\.?0+$/, '')} GB`;
}

function formatDuration(s: number): string {
  if (s < 1) return '0s';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    return r ? `${m}m ${r}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function computeUsage(projects: Project[], now = Date.now()): Usage {
  let req = 0;
  let dataB = 0;
  let cpuS = 0;
  let originB = 0;

  for (const p of projects) {
    const prof = FRAMEWORK_PROFILE[p.framework] ?? FRAMEWORK_PROFILE.static;
    const mult = STATUS_MULT[p.status] ?? 0.05;
    const t = Date.parse(p.createdAt);
    const ageDays = Number.isFinite(t) ? Math.min(Math.max((now - t) / 86_400_000, 0), 30) : 0;
    const billableDays = Math.max(ageDays, p.status === 'READY' ? 1 : 0.25);
    const jitter = hashString(p.id + p.name) % 120;
    const daily = 180 * prof.req + jitter;
    const selfTraffic = p.status === 'READY' ? 120 : 24;
    const r = Math.round(daily * billableDays * mult + selfTraffic * mult);

    req += r;
    dataB += r * prof.bytesPerReq + (p.status === 'READY' ? 1.2 * 1024 ** 2 : 0);
    cpuS += (r * prof.cpuMs) / 1000;
    if (p.status === 'READY' || p.status === 'DEPLOYING') {
      originB += r * prof.bytesPerReq * prof.originMiss;
    }
  }

  req = Math.round(req);
  dataB = Math.round(dataB);
  originB = Math.round(originB);
  cpuS = Math.round(cpuS * 10) / 10;
  const pct = (u: number, q: number) => Math.min(100, q > 0 ? (u / q) * 100 : 0);

  return {
    edgeRequests: { used: req, quota: QUOTAS.EDGE_REQUESTS, display: `${formatCompact(req)} / 1M`, pct: pct(req, QUOTAS.EDGE_REQUESTS) },
    dataTransfer: { used: dataB, quota: QUOTAS.DATA_BYTES, display: `${formatBytesUsed(dataB)} / 100 GB`, pct: pct(dataB, QUOTAS.DATA_BYTES) },
    cpu: { used: cpuS, quota: QUOTAS.CPU_SECONDS, display: `${formatDuration(cpuS)} / 1h`, pct: pct(cpuS, QUOTAS.CPU_SECONDS) },
    origin: { used: originB, quota: QUOTAS.ORIGIN_BYTES, display: `${formatBytesUsed(originB)} / 10 GB`, pct: pct(originB, QUOTAS.ORIGIN_BYTES) },
  };
}

function barWidth(pct: number): string {
  if (pct <= 0) return '0%';
  return `${Math.max(pct, 0.05).toFixed(2)}%`;
}

function barState(pct: number): string {
  if (pct >= 90) return 'is-critical';
  if (pct >= 70) return 'is-warning';
  return '';
}

// ─── Anomaly alerts engine (client-side, derived from project statuses) ───
type AlertSeverity = 'critical' | 'warning' | 'info';

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  projectId?: string;
  timestamp: string;
}

const ALERT_THRESHOLDS = {
  stuckBuildingMs: 15 * 60 * 1000,
  stuckDeployingMs: 10 * 60 * 1000,
  queuedWarningCount: 3,
  maxVisible: 3,
} as const;

const DISMISSED_KEY = 'pulse_dismissed_alerts_v1';

function detectAlerts(projects: Project[], now = Date.now()): AlertItem[] {
  if (projects.length === 0) return [];
  const alerts: AlertItem[] = [];
  const ageOf = (p: Project) => now - new Date(p.createdAt).getTime();

  for (const p of projects.filter((p) => p.status === 'FAILED')) {
    alerts.push({
      id: `failed:${p.id}`,
      severity: 'critical',
      title: `Build failed — ${p.name}`,
      message: `${p.repository} needs attention. Check terminal logs.`,
      projectId: p.id,
      timestamp: p.createdAt,
    });
  }

  for (const p of projects) {
    if (p.status === 'BUILDING' && ageOf(p) > ALERT_THRESHOLDS.stuckBuildingMs) {
      alerts.push({
        id: `stuck:${p.id}`,
        severity: 'warning',
        title: `Stuck building — ${p.name}`,
        message: `In BUILDING for ${Math.max(1, Math.round(ageOf(p) / 60000))}m (limit 15m).`,
        projectId: p.id,
        timestamp: p.createdAt,
      });
    }
    if (p.status === 'DEPLOYING' && ageOf(p) > ALERT_THRESHOLDS.stuckDeployingMs) {
      alerts.push({
        id: `stuck:${p.id}`,
        severity: 'warning',
        title: `Stuck deploying — ${p.name}`,
        message: `In DEPLOYING for ${Math.max(1, Math.round(ageOf(p) / 60000))}m (limit 10m).`,
        projectId: p.id,
        timestamp: p.createdAt,
      });
    }
  }

  const queued = projects.filter((p) => p.status === 'QUEUED');
  if (queued.length >= ALERT_THRESHOLDS.queuedWarningCount) {
    alerts.push({
      id: 'queue-backlog',
      severity: 'warning',
      title: 'Build queue backing up',
      message: `${queued.length} projects queued. Expect delays.`,
      timestamp: new Date(now).toISOString(),
    });
  } else if (queued.length > 0) {
    alerts.push({
      id: 'queue-backlog',
      severity: 'info',
      title: `${queued.length} project(s) queued`,
      message: 'Waiting for builder. No action needed.',
      timestamp: new Date(now).toISOString(),
    });
  }

  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || +new Date(b.timestamp) - +new Date(a.timestamp)
  );
}

function loadDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, onNavigateToImport }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissed, setDismissed] = useState<Record<string, number>>(loadDismissed);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPro, setIsPro] = useState(() => {
    try {
      return localStorage.getItem('pulse_pro_plan') !== null;
    } catch {
      return false;
    }
  });

  const usage = useMemo(() => computeUsage(projects), [projects]);
  const allAlerts = useMemo(() => detectAlerts(projects), [projects]);
  const visibleAlerts = useMemo(
    () => allAlerts.filter((a) => !(a.id in dismissed)),
    [allAlerts, dismissed]
  );
  const shownAlerts = visibleAlerts.slice(0, ALERT_THRESHOLDS.maxVisible);
  const hiddenCount = Math.max(0, visibleAlerts.length - shownAlerts.length);
  const healthyCount = projects.filter((p) => p.status === 'READY').length;

  const dismissAlert = (id: string) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: Date.now() };
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory */
      }
      return next;
    });
  };

  const alertIcon = (severity: AlertSeverity) => {
    if (severity === 'critical') return <XCircle size={14} />;
    if (severity === 'warning') return <AlertTriangle size={14} />;
    return <Info size={14} />;
  };

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
          {/* Usage Card — live, derived from real projects */}
          <div className="dashboard-stats-card">
            <div className="card-header-row">
              <span className="card-title-text">Usage</span>
              <span className="card-subtitle-small">Last 30 days</span>
            </div>

            <div className="usage-progress-list">
              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Edge Requests</span>
                  <span className={`progress-val ${barState(usage.edgeRequests.pct)}`}>{usage.edgeRequests.display}</span>
                </div>
                <div className="progress-track-bg">
                  <div className={`progress-bar-fill ${barState(usage.edgeRequests.pct)}`} style={{ width: barWidth(usage.edgeRequests.pct) }}></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Fast Data Transfer</span>
                  <span className={`progress-val ${barState(usage.dataTransfer.pct)}`}>{usage.dataTransfer.display}</span>
                </div>
                <div className="progress-track-bg">
                  <div className={`progress-bar-fill ${barState(usage.dataTransfer.pct)}`} style={{ width: barWidth(usage.dataTransfer.pct) }}></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Edge Request CPU Duration</span>
                  <span className={`progress-val ${barState(usage.cpu.pct)}`}>{usage.cpu.display}</span>
                </div>
                <div className="progress-track-bg">
                  <div className={`progress-bar-fill ${barState(usage.cpu.pct)}`} style={{ width: barWidth(usage.cpu.pct) }}></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-labels">
                  <span className="progress-name">Fast Origin Transfer</span>
                  <span className={`progress-val ${barState(usage.origin.pct)}`}>{usage.origin.display}</span>
                </div>
                <div className="progress-track-bg">
                  <div className={`progress-bar-fill ${barState(usage.origin.pct)}`} style={{ width: barWidth(usage.origin.pct) }}></div>
                </div>
              </div>
            </div>

            <div className="usage-footnote">
              {projects.length === 0
                ? 'No projects yet — import a repo to start tracking usage.'
                : `${projects.length} project${projects.length === 1 ? '' : 's'} • ${healthyCount} healthy`}
            </div>
            <button className="btn-upgrade-stats" onClick={() => setShowUpgrade(true)} disabled={isPro}>
              {isPro ? 'Pro Active' : 'Upgrade'}
            </button>
          </div>

          {/* Alerts Card — live anomaly detection */}
          <div className="dashboard-stats-card alerts-card">
            <div className="card-header-row">
              <span className="card-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} style={{ color: 'var(--color-secondary)' }} />
                Alerts
                {isPro && <span className="pro-badge">PRO</span>}
                {visibleAlerts.length > 0 && (
                  <span
                    className={`alert-count-badge is-${visibleAlerts.some((a) => a.severity === 'critical') ? 'critical' : visibleAlerts.some((a) => a.severity === 'warning') ? 'warning' : 'info'}`}
                    aria-label={`${visibleAlerts.length} active alerts`}
                  >
                    {visibleAlerts.length > 9 ? '9+' : visibleAlerts.length}
                  </span>
                )}
              </span>
            </div>
            {visibleAlerts.length > 0 ? (
              <div className="alerts-card-body has-alerts" aria-live="polite">
                <div className="alerts-list">
                  {shownAlerts.map((alert) => (
                    <div key={alert.id} className={`alert-item is-${alert.severity}`}>
                      <span className="alert-severity-dot" aria-hidden="true">{alertIcon(alert.severity)}</span>
                      <div className="alert-item-text">
                        <div className="alert-item-title">{alert.title}</div>
                        <div className="alert-item-desc">{alert.message}</div>
                        <div className="alert-item-actions">
                          {alert.projectId && (
                            <button className="alert-view-btn" onClick={() => onSelectProject(alert.projectId!)}>
                              View
                            </button>
                          )}
                          <button className="alert-dismiss-btn" onClick={() => dismissAlert(alert.id)} aria-label={`Dismiss: ${alert.title}`}>
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {hiddenCount > 0 && <div className="alerts-more">+{hiddenCount} more issue{hiddenCount === 1 ? '' : 's'}</div>}
                {!isPro && (
                  <button className="btn-upgrade-pro" style={{ marginTop: '12px' }} onClick={() => setShowUpgrade(true)}>
                    Upgrade to Pro
                  </button>
                )}
                <div className="alerts-footnote">Pro adds Slack &amp; email notifications.</div>
              </div>
            ) : projects.length === 0 ? (
              <div className="alerts-card-body">
                <div className="alert-bell-circle">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <h4 className="alert-prompt-title">No projects to monitor</h4>
                <p className="alert-prompt-desc">Import a repo and Pulse will watch for failures and stuck builds.</p>
                <button className="btn-upgrade-pro" onClick={onNavigateToImport}>Import project</button>
                {!isPro && (
                  <button className="alert-upgrade-link" onClick={() => setShowUpgrade(true)}>
                    or Upgrade to Pro →
                  </button>
                )}
              </div>
            ) : (
              <div className="alerts-card-body">
                <div className="alert-bell-circle is-healthy">
                  <CheckCircle2 size={18} />
                </div>
                <h4 className="alert-prompt-title">All systems normal</h4>
                <p className="alert-prompt-desc">{projects.length} project{projects.length === 1 ? '' : 's'} healthy • checked just now</p>
                {!isPro && (
                  <button className="btn-upgrade-pro" style={{ marginTop: '12px' }} onClick={() => setShowUpgrade(true)}>
                    Upgrade to Pro
                  </button>
                )}
                <div className="alerts-footnote">Pro adds Slack &amp; email notifications.</div>
              </div>
            )}
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
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onSuccess={() => setIsPro(true)}
      />
    </div>
  );
};
