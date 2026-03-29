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

  useEffect(() => {
    fetch(`${API}/api/projects`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div>
        <Header />
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
        <Header />
        <div style={{ marginTop: 24, padding: 16, background: 'rgba(248,81,73,0.1)', borderRadius: 6, border: '1px solid var(--status-critical)' }}>
          <p>Failed to load projects. <button className="btn" onClick={() => window.location.reload()}>Retry</button></p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      {projects.length === 0 ? (
        <div style={{ marginTop: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No projects yet.</p>
          <p>Submit your first project to get started.</p>
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
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/projects/${p.id}`}>
                <td style={{ padding: '12px', fontWeight: 500 }}>{p.name}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>Projects</h2>
      <button className="btn btn-primary" onClick={() => alert('Submit project flow coming soon')}>
        + Submit Project
      </button>
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
    live: 'pill-live',
    failed: 'pill-failed',
    rejected: 'pill-failed',
    needs_revision: 'pill-review',
  };
  return <span className={`pill ${map[status] ?? ''}`}>{status.replace(/_/g, ' ')}</span>;
}
