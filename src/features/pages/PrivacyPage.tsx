import { useT } from '@/app/preferences-context';
import { LegalPage } from './LegalPage';

export default function PrivacyPage() {
  const m = useT();
  return <LegalPage content={m.privacy} meta={m.meta.privacy} path="/privacy" />;
}
