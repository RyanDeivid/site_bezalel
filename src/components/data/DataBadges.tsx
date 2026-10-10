import type { ReactNode } from 'react';
import { BadgeCheck, CircleDashed, Clock, FlaskConical, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { DataOrigin, PublicationStatus, VerificationStatus } from '@/types/domain';

/** Origem do dado: real verificado, demonstração ou produção. Sempre visível. */
export function OriginBadge({ origin, className }: { origin: DataOrigin; className?: string }) {
  const m = useT();
  if (origin === 'demo') {
    return (
      <Tooltip content={m.common.demoLong}>
        <Badge tone="demo" icon={<FlaskConical />} className={className}>
          {m.common.demo}
        </Badge>
      </Tooltip>
    );
  }
  if (origin === 'production') {
    return (
      <Badge tone="info" className={className}>
        {m.common.production}
      </Badge>
    );
  }
  return (
    <Tooltip content={m.common.curatedLong}>
      <Badge tone="ok" icon={<ShieldCheck />} className={className}>
        {m.common.curated}
      </Badge>
    </Tooltip>
  );
}

const VERIFICATION_TONE: Record<VerificationStatus, BadgeTone> = {
  verified: 'ok',
  'partially-verified': 'info',
  unverified: 'neutral',
  outdated: 'warn',
  failed: 'danger',
};

const VERIFICATION_ICON = {
  verified: <BadgeCheck />,
  'partially-verified': <ShieldCheck />,
  unverified: <CircleDashed />,
  outdated: <Clock />,
  failed: <ShieldAlert />,
} satisfies Record<VerificationStatus, ReactNode>;

export function VerificationBadge({ status, withHelp = true }: { status: VerificationStatus; withHelp?: boolean }) {
  const m = useT();
  const badge = (
    <Badge tone={VERIFICATION_TONE[status]} icon={VERIFICATION_ICON[status]}>
      {m.enums.verificationStatus[status]}
    </Badge>
  );
  return withHelp ? <Tooltip content={m.enums.verificationStatusHelp[status]}>{badge}</Tooltip> : badge;
}

export const PUBLICATION_TONE: Record<PublicationStatus, BadgeTone> = {
  found: 'info',
  validating: 'warn',
  approved: 'accent',
  rejected: 'danger',
  published: 'ok',
  outdated: 'warn',
  removed: 'neutral',
};

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  const m = useT();
  return (
    <Tooltip content={m.enums.publicationStatusHelp[status]}>
      <Badge tone={PUBLICATION_TONE[status]} pulse={status === 'validating'}>
        {m.enums.publicationStatus[status]}
      </Badge>
    </Tooltip>
  );
}

/** Valor de campo ou "Não informado" — nunca um valor inventado. */
export function FieldValue({ value, inferred }: { value: ReactNode | null | undefined; inferred?: boolean }) {
  const m = useT();
  if (value === null || value === undefined || value === '') {
    return <span className="italic text-fg-subtle">{m.common.notInformed}</span>;
  }
  return (
    <span>
      {value}
      {inferred && <span className="ml-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-warn">({m.common.inferred})</span>}
    </span>
  );
}
