import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface Props {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
}

export function StatusBanner({ tone = 'info', children }: Props) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`status-banner status-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
