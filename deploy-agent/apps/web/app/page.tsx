'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  detectedLanguage: string | null;
  detectedFramework: string | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteLog, setDeleteLog] = useState<{ step: string; status: string; error?: string }[] | null>(null);

  const loadProjects = () => {
    setLoading(true);
    fetch(`${API}/api/projects`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { loadProjects(); }, []);

  if (loading) {
    return (
      <div>
        <Header onSubmit={() => setShowModal(true)} />
        <div style={{ marginTop: 24 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 48, background: 'var(--bg-secondary)', borderRadius: 6,
              marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header onSubmit={() => setShowModal(true)} />
        <div style={{ marginTop: 24, padding: 16, background: 'rgba(248,81,73,0.1)', borderRadius: 6, border: '1px solid var(--status-critical)' }}>
          <p>Failed to load projects. <button className="btn" onClick={() => window.location.reload()}>Retry</button></p>
        </div>
        {showModal && (
          <SubmitModal
            onClose={() => setShowModal(false)}
            onSubmitted={() => { setShowModal(false); loadProjects(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <Header onSubmit={() => setShowModal(true)} />
      {projects.length === 0 ? (
        <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No projects yet.</p>
          <p>Submit your first project to get started.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
            + Submit Project
          </button>
        </div>
      ) : (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' as const }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Language</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Source</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Created</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', fontWeight: 500, cursor: 'pointer' }}
                    onClick={() => window.location.href = `/projects/${p.id}`}>{p.name}</td>
                <td style={{ padding: '12px' }}>
                  <StatusPill status={p.status} />
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {p.detectedLanguage ?? '—'}
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {p.sourceType}
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <button
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteLog(null); }}
                    style={{ fontSize: 12, padding: '4px 10px', color: 'var(--status-critical)', borderColor: 'var(--status-critical)' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSubmitted={() => { setShowModal(false); loadProjects(); }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          deleting={deleting}
          deleteLog={deleteLog}
          onClose={() => { setDeleteTarget(null); setDeleteLog(null); setDeleting(false); }}
          onConfirm={async () => {
            setDeleting(true);
            setDeleteLog(null);
            try {
              const res = await fetch(`${API}/api/projects/${deleteTarget.id}`, { method: 'DELETE' });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
              setDeleteLog(data.teardownLog ?? []);
              // Reload after short delay so user can see the log
              setTimeout(() => {
                setDeleteTarget(null);
                setDeleteLog(null);
                setDeleting(false);
                loadProjects();
              }, 2000);
            } catch (err) {
              setDeleteLog([{ step: 'Request failed', status: 'error', error: (err as Error).message }]);
              setDeleting(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Header({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>Projects</h2>
      <button className="btn btn-primary" onClick={onSubmit}>
        + Submit Project
      </button>
    </div>
  );
}

function SubmitModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<'local_path' | 'git'>('local_path');
  const [sourceUrl, setSourceUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [allowUnauth, setAllowUnauth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required'); return; }
    if (!sourceUrl.trim()) { setError('Source path/URL is required'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sourceType: sourceType === 'git' ? 'git' : 'upload',
          sourceUrl: sourceUrl.trim(),
          config: {
            deployTarget: 'cloud_run',
            customDomain: customDomain.trim() || undefined,
            allowUnauthenticated: allowUnauth,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: 24,
        width: 480, maxWidth: '90vw', border: '1px solid var(--border)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Submit Project</h3>

        <ModalField label="Project Name" value={name} onChange={setName} placeholder="my-awesome-app" />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as 'local_path' | 'git')}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-primary)', fontSize: 14,
            }}
          >
            <option value="local_path">Local Path</option>
            <option value="git">Git URL</option>
          </select>
        </div>

        <ModalField
          label={sourceType === 'git' ? 'Git URL' : 'Local Path'}
          value={sourceUrl}
          onChange={setSourceUrl}
          placeholder={sourceType === 'git' ? 'https://github.com/owner/repo' : '/path/to/project'}
        />

        <ModalField
          label="Custom Domain (optional)"
          value={customDomain}
          onChange={setCustomDomain}
          placeholder="my-app (will become my-app.punwave.com)"
        />

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={allowUnauth} onChange={(e) => setAllowUnauth(e.target.checked)} />
            Allow unauthenticated access (public)
          </label>
        </div>

        {error && (
          <div style={{ padding: 8, marginBottom: 12, background: 'rgba(248,81,73,0.1)', borderRadius: 6, color: 'var(--status-critical)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit for Scan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-primary)', fontSize: 14,
        }}
      />
    </div>
  );
}

function DeleteModal({ project, deleting, deleteLog, onClose, onConfirm }: {
  project: Project;
  deleting: boolean;
  deleteLog: { step: string; status: string; error?: string }[] | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const done = deleteLog && deleteLog.length > 0 && !deleting;
  const allOk = done && deleteLog.every((l) => l.status === 'ok');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: 24,
        width: 520, maxWidth: '90vw', border: '1px solid var(--border)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--status-critical)' }}>
          Delete Project
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong>?
          This will tear down all associated GCP resources:
        </p>
        <ul style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Cloud Run service</li>
          <li>Domain mapping &amp; SSL certificate</li>
          <li>Cloudflare DNS record</li>
          <li>Container images in Artifact Registry</li>
          <li>All database records (scans, reviews, deployments)</li>
        </ul>

        {/* Teardown progress log */}
        {(deleting || deleteLog) && (
          <div style={{
            background: 'var(--bg-primary)', borderRadius: 6, padding: 12,
            marginBottom: 16, maxHeight: 200, overflowY: 'auto', fontSize: 13,
            fontFamily: 'monospace', border: '1px solid var(--border)',
          }}>
            {deleting && !deleteLog && (
              <div style={{ color: 'var(--text-secondary)' }}>Tearing down resources...</div>
            )}
            {deleteLog?.map((log, i) => (
              <div key={i} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
                <span>{log.status === 'ok' ? '\u2705' : '\u274c'}</span>
                <span style={{ color: log.status === 'ok' ? 'var(--status-live)' : 'var(--status-critical)' }}>
                  {log.step}
                  {log.error && <span style={{ color: 'var(--status-critical)', marginLeft: 8 }}>({log.error})</span>}
                </span>
              </div>
            ))}
            {allOk && (
              <div style={{ marginTop: 8, color: 'var(--status-live)', fontWeight: 500 }}>
                All resources cleaned up successfully.
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={deleting}>Cancel</button>
          {!done && (
            <button
              className="btn"
              onClick={onConfirm}
              disabled={deleting}
              style={{
                background: 'var(--status-critical)', color: '#fff',
                borderColor: 'var(--status-critical)', opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? 'Deleting...' : 'Delete & Tear Down'}
            </button>
          )}
        </div>
      </div>
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
