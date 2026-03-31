'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  sourceType: string;
  sourceUrl: string | null;
  detectedLanguage: string | null;
  detectedFramework: string | null;
  config: {
    deployTarget?: string;
    customDomain?: string;
    allowUnauthenticated?: boolean;
    gcpProject?: string;
    gcpRegion?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface TimelineEntry {
  id: number;
  fromState: string | null;
  toState: string;
  triggeredBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ScanFinding {
  id: string;
  tool: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  action: 'auto_fix' | 'report_only';
}

interface AutoFixRecord {
  findingId?: string;
  filePath: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
}

interface ScanReport {
  id: string;
  projectId: string;
  version: number;
  findings: ScanFinding[];
  autoFixes: AutoFixRecord[];
  threatSummary: string;
  costEstimate: { monthlyTotal: number; breakdown: { compute: number; storage: number; networking: number; ssl: number } } | null;
  status: string;
  createdAt: string;
}

interface Deployment {
  id: string;
  cloudRunService: string | null;
  cloudRunUrl: string | null;
  customDomain: string | null;
  sslStatus: string | null;
  healthStatus: string;
  deployedAt: string | null;
  createdAt: string;
}

interface ProjectDetail {
  project: Project;
  scanReport: ScanReport | null;
  deployments: Deployment[];
  timeline: TimelineEntry[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const loadDetail = (silent = false) => {
    if (!silent) setLoading(true);
    fetch(`${API}/api/projects/${id}/detail`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => {
    loadDetail();
    const interval = setInterval(() => loadDetail(true), 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`${API}/api/projects/${id}/resubmit`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      // Reload the detail page
      loadDetail();
    } catch (err) {
      alert((err as Error).message);
    }
    setRetrying(false);
  };

  if (loading) {
    return (
      <div>
        <BackLink />
        <div style={{ marginTop: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              height: 48, background: 'var(--bg-secondary)', borderRadius: 6,
              marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <BackLink />
        <div style={{ marginTop: 24, padding: 16, background: 'rgba(248,81,73,0.1)', borderRadius: 6, border: '1px solid var(--status-critical)' }}>
          <p>Failed to load project: {error ?? 'Not found'}</p>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const { project, scanReport, deployments, timeline } = data;

  return (
    <div>
      <BackLink />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>{project.name}</h2>
          <StatusPill status={project.status} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(project.status === 'failed' || project.status === 'needs_revision') && (
            <button className="btn btn-primary" onClick={handleRetry} disabled={retrying}
              style={{ fontSize: 13, padding: '6px 16px' }}>
              {retrying ? '重試中...' : '重試流程'}
            </button>
          )}
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
        {project.sourceType} &middot; slug: {project.slug} &middot; created {new Date(project.createdAt).toLocaleString()}
      </p>

      {/* Failure Banner */}
      {project.status === 'failed' && (() => {
        const failEvent = [...timeline].reverse().find((t) => t.toState === 'failed');
        if (!failEvent) return null;
        const meta = failEvent.metadata ?? {};
        return (
          <div style={{
            marginTop: 12, padding: 16, background: 'rgba(248,81,73,0.08)',
            borderRadius: 8, border: '1px solid rgba(248,81,73,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>&#x26A0;&#xFE0F;</span>
              <strong style={{ color: 'var(--status-critical)', fontSize: 14 }}>
                Pipeline Failed{meta.failedStep ? ` at ${meta.failedStep}` : ''}
              </strong>
            </div>
            {meta.error ? (
              <div style={{
                padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 4,
                fontFamily: 'monospace', fontSize: 13, color: 'var(--status-critical)',
                lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {String(meta.error)}
              </div>
            ) : null}
            {meta.stack ? (
              <details style={{ marginTop: 8 }}>
                <summary style={{ color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  Stack Trace
                </summary>
                <div style={{
                  marginTop: 4, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 4,
                  fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {String(meta.stack)}
                </div>
              </details>
            ) : null}
          </div>
        );
      })()}

      {/* Grid: Info + Deployment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        {/* Project Info Card */}
        <Card title="專案資訊">
          <InfoRow label="語言" value={project.detectedLanguage ?? 'Detecting...'} />
          <InfoRow label="框架" value={project.detectedFramework ?? 'Detecting...'} />
          <InfoRow label="來源類型" value={project.sourceUrl ?? '—'} mono />
          <InfoRow label="自訂網域" value={project.config?.customDomain ? `${project.config.customDomain}.punwave.com` : '無'} />
          <InfoRow label="公開存取" value={project.config?.allowUnauthenticated ? '是' : '否'} />
        </Card>

        {/* Deployment Card */}
        <Card title="部署資訊">
          {deployments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>尚無部署。</p>
          ) : (
            deployments.map((d) => {
              // Resolve custom domain: from deployment record or from project config
              const domainName = d.customDomain
                || (project.config?.customDomain
                  ? `${project.config.customDomain}.punwave.com`
                  : null);
              return (
                <div key={d.id} style={{ marginBottom: 12 }}>
                  <InfoRow label="服務" value={d.cloudRunService ?? '—'} />
                  {d.cloudRunUrl && (
                    <InfoRow label="Cloud Run 網址">
                      <a href={d.cloudRunUrl} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--accent)', fontSize: 13 }}>{d.cloudRunUrl}</a>
                    </InfoRow>
                  )}
                  {domainName && (
                    <InfoRow label="自訂網域">
                      <a href={`https://${domainName}`} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--accent)', fontSize: 13 }}>https://{domainName}</a>
                    </InfoRow>
                  )}
                  <InfoRow label="SSL" value={d.sslStatus ?? 'N/A'} />
                  <InfoRow label="健康狀態">
                    <span style={{ color: d.healthStatus === 'healthy' ? 'var(--status-live)' : 'var(--text-secondary)' }}>
                      {d.healthStatus}
                    </span>
                  </InfoRow>
                  {d.deployedAt && <InfoRow label="部署時間" value={new Date(d.deployedAt).toLocaleString()} />}
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Scan Report */}
      {scanReport && <ScanReportSection scanReport={scanReport} projectStatus={project.status} />}

      {/* Pipeline Timeline */}
      <Card title="流程時間軸" style={{ marginTop: 16 }}>
        {timeline.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No events yet.</p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute', left: 7, top: 4, bottom: 4, width: 2,
              background: 'var(--border)',
            }} />
            {timeline.map((entry, i) => {
              const isLast = i === timeline.length - 1;
              const isFailed = entry.toState === 'failed';
              const isLive = entry.toState === 'live';
              return (
                <div key={entry.id} style={{ position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute', left: -20, top: 3,
                    width: 12, height: 12, borderRadius: '50%',
                    background: isFailed ? 'var(--status-critical)' : isLive ? 'var(--status-live)' : isLast ? 'var(--accent)' : 'var(--border)',
                    border: '2px solid var(--bg-secondary)',
                  }} />
                  {/* Content */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusPill status={entry.toState} />
                      {entry.fromState && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          from {entry.fromState.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {new Date(entry.createdAt).toLocaleString()} &middot; by {entry.triggeredBy}
                    </div>
                    {/* Show metadata if there's useful info */}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <MetadataBlock metadata={entry.metadata} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Sub-components ─── */

function BackLink() {
  return (
    <a href="/" style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      &larr; 返回專案列表
    </a>
  );
}

function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
      padding: 16, ...style,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, children }: {
  label: string; value?: string; mono?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: 100, flexShrink: 0 }}>{label}</span>
      {children ?? (
        <span style={{
          color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
        }}>
          {value}
        </span>
      )}
    </div>
  );
}

function MetadataBlock({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([k]) => k !== 'trigger' && k !== 'stack');

  if (entries.length === 0) return null;

  const errorMsg = metadata.error as string | undefined;
  const failedStep = metadata.failedStep as string | undefined;
  const stack = metadata.stack as string | undefined;

  // Error state: show error with step info
  if (errorMsg) {
    return (
      <div style={{ marginTop: 6 }}>
        {failedStep && (
          <div style={{
            fontSize: 11, color: 'var(--status-critical)', marginBottom: 4, fontWeight: 500,
          }}>
            失敗於：{failedStep}
          </div>
        )}
        <div style={{
          padding: '6px 10px', background: 'rgba(248,81,73,0.1)',
          borderRadius: 4, border: '1px solid rgba(248,81,73,0.2)',
          fontSize: 12, color: 'var(--status-critical)', fontFamily: 'monospace',
          wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {errorMsg}
        </div>
        {stack && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
              Stack trace
            </summary>
            <div style={{
              marginTop: 2, padding: '4px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: 4,
              fontFamily: 'monospace', fontSize: 10, color: 'var(--text-secondary)',
              lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {stack}
            </div>
          </details>
        )}
      </div>
    );
  }

  // Normal metadata badges
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
      {entries.map(([key, val]) => (
        <span key={key} style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-secondary)',
        }}>
          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}: <strong style={{ color: 'var(--text-primary)' }}>{val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)}</strong>
        </span>
      ))}
    </div>
  );
}

function ScanReportSection({ scanReport, projectStatus }: { scanReport: ScanReport; projectStatus: string }) {
  // After approval/deploying/live, default to collapsed; during scanning/review, default to expanded
  const postReview = ['approved', 'deploying', 'deployed', 'ssl_provisioning', 'canary_check', 'live'].includes(projectStatus);
  const [expanded, setExpanded] = useState(!postReview);

  const findings = scanReport.findings ?? [];
  const autoFixes = scanReport.autoFixes ?? [];
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
      padding: 16, marginTop: 16,
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, margin: 0 }}>
          {expanded ? '\u25BC' : '\u25B6'}&nbsp; 掃描報告 / Security Report
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {findings.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {findings.length} findings
              {autoFixes.length > 0 && ` (${autoFixes.length} auto-fixed)`}
            </span>
          )}
          <span className={`pill ${scanReport.status === 'completed' ? 'pill-live' : scanReport.status === 'scanning' ? 'pill-scanning' : 'pill-review'}`}>
            {scanReport.status}
          </span>
          {scanReport.costEstimate && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              ~${scanReport.costEstimate.monthlyTotal.toFixed(2)}/mo
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Severity summary bar */}
          {findings.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              {criticalCount > 0 && <SeverityBadge severity="critical" count={criticalCount} />}
              {highCount > 0 && <SeverityBadge severity="high" count={highCount} />}
              {mediumCount > 0 && <SeverityBadge severity="medium" count={mediumCount} />}
              {lowCount > 0 && <SeverityBadge severity="low" count={lowCount} />}
            </div>
          )}

          {/* Threat summary */}
          {scanReport.threatSummary && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>
                威脅摘要 / Review Report
              </label>
              <div style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6,
                padding: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300,
                overflowY: 'auto', fontFamily: 'monospace',
              }}>
                {scanReport.threatSummary}
              </div>
            </div>
          )}

          {/* Findings list */}
          {findings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                安全性問題 / Security Findings ({findings.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {findings.map((f, i) => (
                  <FindingCard key={f.id || i} finding={f} />
                ))}
              </div>
            </div>
          )}

          {/* Auto-fixes list */}
          {autoFixes.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                自動修復 / Auto-Fixes ({autoFixes.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {autoFixes.map((fix, i) => (
                  <AutoFixCard key={i} fix={fix} />
                ))}
              </div>
            </div>
          )}

          {findings.length === 0 && !scanReport.threatSummary && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>掃描進行中... / Scanning in progress...</p>
          )}
        </div>
      )}
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f85149',
  high: '#db6d28',
  medium: '#d29922',
  low: '#8b949e',
};

function SeverityBadge({ severity, count }: { severity: string; count: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
      borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: `${SEVERITY_COLORS[severity]}20`,
      color: SEVERITY_COLORS[severity],
      border: `1px solid ${SEVERITY_COLORS[severity]}40`,
    }}>
      {count} {severity}
    </span>
  );
}

function FindingCard({ finding }: { finding: ScanFinding }) {
  const [showDetail, setShowDetail] = useState(false);
  const color = SEVERITY_COLORS[finding.severity] ?? '#8b949e';

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6,
      padding: '10px 12px', cursor: 'pointer',
    }} onClick={() => setShowDetail(!showDetail)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-block', padding: '1px 6px', borderRadius: 4,
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          background: `${color}20`, color, border: `1px solid ${color}40`,
        }}>
          {finding.severity}
        </span>
        <span style={{
          display: 'inline-block', padding: '1px 6px', borderRadius: 4,
          fontSize: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}>
          {finding.tool}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
          {finding.title}
        </span>
        {finding.action === 'auto_fix' && (
          <span style={{ fontSize: 10, color: 'var(--status-live)', fontWeight: 600 }}>AUTO-FIXED</span>
        )}
      </div>
      {showDetail && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <p style={{ margin: '0 0 4px' }}>{finding.description}</p>
          {finding.filePath && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>
              {finding.filePath}{finding.lineStart ? `:${finding.lineStart}` : ''}
              {finding.lineEnd && finding.lineEnd !== finding.lineStart ? `-${finding.lineEnd}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AutoFixCard({ fix }: { fix: AutoFixRecord }) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div style={{
      background: 'rgba(63,185,80,0.05)', border: '1px solid rgba(63,185,80,0.2)', borderRadius: 6,
      padding: '10px 12px', cursor: 'pointer',
    }} onClick={() => setShowDiff(!showDiff)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--status-live)', fontSize: 12, fontWeight: 600 }}>&#x2714; FIXED</span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{fix.explanation}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{fix.filePath}</span>
      </div>
      {showDiff && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--status-critical)', marginBottom: 2, fontWeight: 600 }}>BEFORE</label>
            <pre style={{
              background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: 4,
              padding: 8, fontSize: 11, margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap',
              color: 'var(--text-secondary)', maxHeight: 200,
            }}>{fix.originalCode}</pre>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--status-live)', marginBottom: 2, fontWeight: 600 }}>AFTER</label>
            <pre style={{
              background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.2)', borderRadius: 4,
              padding: 8, fontSize: 11, margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap',
              color: 'var(--text-secondary)', maxHeight: 200,
            }}>{fix.fixedCode}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: 'pill-scanning',
    scanning: 'pill-scanning',
    review_pending: 'pill-review',
    approved: 'pill-live',
    deploying: 'pill-deploying',
    deployed: 'pill-deploying',
    ssl_provisioning: 'pill-deploying',
    canary_check: 'pill-deploying',
    live: 'pill-live',
    failed: 'pill-failed',
    rejected: 'pill-failed',
    needs_revision: 'pill-review',
    rolling_back: 'pill-failed',
  };
  return <span className={`pill ${map[status] ?? ''}`}>{status.replace(/_/g, ' ')}</span>;
}
