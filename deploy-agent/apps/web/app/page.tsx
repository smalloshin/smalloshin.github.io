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

  const loadProjects = (silent = false) => {
    if (!silent) setLoading(true);
    fetch(`${API}/api/projects`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => {
    loadProjects();
    const interval = setInterval(() => loadProjects(true), 5000);
    return () => clearInterval(interval);
  }, []);

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
          <p>載入專案失敗。 <button className="btn" onClick={() => window.location.reload()}>重試</button></p>
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
          <p style={{ fontSize: 18, marginBottom: 8 }}>尚無專案</p>
          <p>提交你的第一個專案以開始使用。</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
            + 提交專案
          </button>
        </div>
      ) : (
        <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' as const }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>名稱</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>狀態</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>語言</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>來源</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>建立日期</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>操作</th>
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
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {(p.status === 'failed' || p.status === 'needs_revision') && (
                      <button
                        className="btn"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const btn = e.currentTarget;
                          btn.textContent = '重試中...';
                          btn.disabled = true;
                          try {
                            const res = await fetch(`${API}/api/projects/${p.id}/resubmit`, { method: 'POST' });
                            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                            loadProjects();
                          } catch (err) {
                            alert((err as Error).message);
                            btn.textContent = '重試';
                            btn.disabled = false;
                          }
                        }}
                        style={{ fontSize: 12, padding: '4px 10px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
                      >
                        重試
                      </button>
                    )}
                    <button
                      className="btn"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteLog(null); }}
                      style={{ fontSize: 12, padding: '4px 10px', color: 'var(--status-critical)', borderColor: 'var(--status-critical)' }}
                    >
                      刪除
                    </button>
                  </div>
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
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>專案</h2>
      <button className="btn btn-primary" onClick={onSubmit}>
        + 提交專案
      </button>
    </div>
  );
}

function SubmitModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<'upload' | 'git'>('upload');
  const [gitUrl, setGitUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [allowUnauth, setAllowUnauth] = useState(false);
  const [envVarsText, setEnvVarsText] = useState('');
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    const validTypes = ['.zip', '.tar.gz', '.tgz', '.tar'];
    const isValid = validTypes.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      setError('請上傳 .zip、.tar.gz 或 .tar 檔案');
      return;
    }
    setFile(f);
    setError(null);
    // Auto-fill project name from filename if empty
    if (!name.trim()) {
      const baseName = f.name.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '');
      setName(baseName);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('請輸入專案名稱'); return; }
    if (sourceType === 'upload' && !file) { setError('請上傳專案壓縮檔'); return; }
    if (sourceType === 'git' && !gitUrl.trim()) { setError('請輸入 Git URL'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('sourceType', sourceType);
      formData.append('customDomain', customDomain.trim());
      formData.append('allowUnauthenticated', String(allowUnauth));
      if (envVarsText.trim()) {
        formData.append('envVars', envVarsText.trim());
      }
      if (sourceType === 'git') {
        formData.append('gitUrl', gitUrl.trim());
      } else if (file) {
        formData.append('file', file);
      }

      const res = await fetch(`${API}/api/projects/upload`, {
        method: 'POST',
        body: formData,
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
        width: 520, maxWidth: '90vw', border: '1px solid var(--border)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>提交專案</h3>

        <ModalField label="專案名稱" value={name} onChange={setName} placeholder="my-awesome-app" />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
            來源類型
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn ${sourceType === 'upload' ? 'btn-primary' : ''}`}
              onClick={() => setSourceType('upload')}
              style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
            >
              上傳壓縮檔
            </button>
            <button
              type="button"
              className={`btn ${sourceType === 'git' ? 'btn-primary' : ''}`}
              onClick={() => setSourceType('git')}
              style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
            >
              Git 儲存庫
            </button>
          </div>
        </div>

        {sourceType === 'upload' ? (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
              專案檔案
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.zip,.tar.gz,.tgz,.tar';
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) handleFile(f);
                };
                input.click();
              }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : file ? 'var(--status-live)' : 'var(--border)'}`,
                borderRadius: 8,
                padding: file ? '16px' : '32px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(88,166,255,0.05)' : 'var(--bg-primary)',
                transition: 'all 0.2s ease',
              }}
            >
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{'\uD83D\uDCC2'}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB — 點擊或拖曳以替換
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>{'\uD83D\uDCC1'}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
                    拖曳專案壓縮檔到此處
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    或點擊瀏覽 — 支援 .zip、.tar.gz、.tar（最大 100MB）
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <ModalField
            label="Git URL"
            value={gitUrl}
            onChange={setGitUrl}
            placeholder="https://github.com/owner/repo"
          />
        )}

        <ModalField
          label="自訂網域（選填）"
          value={customDomain}
          onChange={setCustomDomain}
          placeholder="my-app（將會變成 my-app.punwave.com）"
        />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={allowUnauth} onChange={(e) => setAllowUnauth(e.target.checked)} />
            允許未經驗證的存取（公開）
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowEnvVars(!showEnvVars)}
            style={{ fontSize: 12, padding: '4px 10px', color: 'var(--text-secondary)' }}
          >
            {showEnvVars ? '- 隱藏環境變數' : '+ 環境變數（選填）'}
          </button>
          {showEnvVars && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                每行一個，格式: KEY=VALUE（常見的如 NEXTAUTH_URL 會自動偵測設定）
              </div>
              <textarea
                value={envVarsText}
                onChange={(e) => setEnvVarsText(e.target.value)}
                placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=sk-...'}
                rows={4}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
                  fontFamily: 'var(--font-mono)', resize: 'vertical',
                }}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: 8, marginBottom: 12, background: 'rgba(248,81,73,0.1)', borderRadius: 6, color: 'var(--status-critical)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '上傳掃描中...' : '提交掃描'}
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
          刪除專案
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
          確定要刪除 <strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong>？
          這將會清除所有相關的 GCP 資源：
        </p>
        <ul style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Cloud Run 服務</li>
          <li>網域對應與 SSL 憑證</li>
          <li>Cloudflare DNS 紀錄</li>
          <li>Artifact Registry 中的容器映像</li>
          <li>所有資料庫紀錄（掃描、審查、部署）</li>
        </ul>

        {/* Teardown progress log */}
        {(deleting || deleteLog) && (
          <div style={{
            background: 'var(--bg-primary)', borderRadius: 6, padding: 12,
            marginBottom: 16, maxHeight: 200, overflowY: 'auto', fontSize: 13,
            fontFamily: 'monospace', border: '1px solid var(--border)',
          }}>
            {deleting && !deleteLog && (
              <div style={{ color: 'var(--text-secondary)' }}>正在清除資源...</div>
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
                所有資源已成功清除。
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={deleting}>取消</button>
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
              {deleting ? '刪除中...' : '刪除並清除資源'}
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
