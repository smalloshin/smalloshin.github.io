'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function DeploysPage() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/deploys`)
      .then((r) => r.json())
      .then((data) => { setDeployments(data.deployments); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Deployments</h2>
      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      ) : deployments.length === 0 ? (
        <div style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 18 }}>No deployments yet.</p>
          <p>Approve a project review to trigger a deployment.</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Project</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>URL</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Health</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Deployed</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((d: any) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px' }}>{d.project_name}</td>
                <td style={{ padding: '12px' }}>
                  {d.cloud_run_url ? (
                    <a href={d.cloud_run_url} target="_blank" className="mono" style={{ fontSize: 12 }}>
                      {d.cloud_run_url}
                    </a>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px' }}>
                  <span className={`pill ${d.health_status === 'healthy' ? 'pill-live' : d.health_status === 'unhealthy' ? 'pill-failed' : ''}`}>
                    {d.health_status}
                  </span>
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {d.deployed_at ? new Date(d.deployed_at).toLocaleString() : 'pending'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
