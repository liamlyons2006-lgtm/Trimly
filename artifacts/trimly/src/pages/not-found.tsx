import { ArrowLeft, Scissors } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="page-wrap" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div className="empty-state" style={{ width: 'min(430px, 100%)' }}>
        <div className="empty-mark"><Scissors size={18} /></div>
        <p className="eyebrow">A small detour</p>
        <h1 className="page-title" style={{ fontSize: 30 }}>This view got trimmed.</h1>
        <p>There is no Trimly page at this address. The useful stuff is still right where you left it.</p>
        <Link href="/" className="button button-primary button-small" data-testid="link-back-home"><ArrowLeft size={13} /> Back to overview</Link>
      </div>
    </div>
  );
}