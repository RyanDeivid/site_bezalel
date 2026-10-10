import { useT } from '@/app/preferences-context';
import { LegalPage } from './LegalPage';

export default function TermsPage() {
  const m = useT();
  return <LegalPage content={m.terms} meta={m.meta.terms} path="/terms" />;
}
