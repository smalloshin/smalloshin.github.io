import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deploy Agent',
  description: 'AI-powered secure deployment for vibe-coded projects',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, padding: '24px 32px', overflow: 'auto' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <nav style={{
      width: 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      padding: '16px 0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 16, fontWeight: 600 }}>Deploy Agent</h1>
      </div>
      <div style={{ padding: '8px 0', flex: 1 }}>
        <NavLink href="/" label="Projects" />
        <NavLink href="/reviews" label="Reviews" />
        <NavLink href="/deploys" label="Deployments" />
        <NavLink href="/settings" label="Settings" />
      </div>
    </nav>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} style={{
      display: 'block',
      padding: '8px 16px',
      color: 'var(--text-secondary)',
      fontSize: 14,
      borderLeft: '2px solid transparent',
    }}>
      {label}
    </a>
  );
}
