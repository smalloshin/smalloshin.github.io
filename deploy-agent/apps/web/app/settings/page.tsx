'use client';

export default function SettingsPage() {
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Settings</h2>

      <Section title="GCP Configuration">
        <Field label="GCP Project ID" placeholder="my-gcp-project" />
        <Field label="Region" placeholder="asia-east1" />
        <Field label="Artifact Registry" placeholder="asia-east1-docker.pkg.dev/project/repo" />
      </Section>

      <Section title="Domain Management">
        <Field label="Base Domain" placeholder="deploy.yourdomain.com" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Projects will be deployed to [slug].deploy.yourdomain.com
        </p>
      </Section>

      <Section title="Notifications">
        <Field label="Slack Webhook URL" placeholder="https://hooks.slack.com/..." />
      </Section>

      <Section title="API Keys">
        <Field label="Anthropic API Key" placeholder="sk-ant-..." type="password" />
        <Field label="GitHub Token" placeholder="ghp_..." type="password" />
      </Section>

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => alert('Settings save coming soon')}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 24, padding: 16,
      background: 'var(--bg-secondary)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, placeholder, type = 'text' }: { label: string; placeholder: string; type?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        style={{
          width: '100%', maxWidth: 400, padding: '8px 12px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-primary)', fontSize: 14,
        }}
      />
    </div>
  );
}
