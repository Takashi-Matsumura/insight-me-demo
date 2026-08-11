export interface CareerCardData {
  careerId: string;
  rank: number;
  fitScore: number;
  isDiscovery: boolean;
  obscurity: number;
  name: string;
  categoryLabel: string;
  oneLiner: string;
  detail: string;
  goodFit: string;
  dayInLife: string;
  skills: string[];
  nextStep: string;
  relatedMajors: string[];
  reason: string | null;
}

export function CareerCard({ card }: { card: CareerCardData }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{card.categoryLabel}</span>
        <FitScoreBar score={card.fitScore} />
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{card.name}</h3>
          {card.obscurity >= 3 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              🔍 あまり知られていない職種
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{card.oneLiner}</p>
      </div>

      <Section title="どんな仕事？">
        <p className="text-sm leading-relaxed">{card.detail}</p>
      </Section>

      <Section title="あなたに薦める理由">
        {card.reason ? (
          <p className="text-sm leading-relaxed">{card.reason}</p>
        ) : (
          <div className="flex flex-col gap-1.5 py-1">
            <div className="h-3 w-full animate-pulse rounded bg-border" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-border" />
          </div>
        )}
      </Section>

      <Section title="向いている人">
        <p className="text-sm leading-relaxed text-muted">{card.goodFit}</p>
      </Section>

      <Section title="ある一日">
        <p className="text-sm leading-relaxed text-muted">{card.dayInLife}</p>
      </Section>

      <Section title="必要なスキル">
        <div className="flex flex-wrap gap-1.5">
          {card.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted"
            >
              {skill}
            </span>
          ))}
        </div>
      </Section>

      <div className="mt-1 rounded-lg bg-accent/5 px-3 py-2.5 text-sm">
        <span className="font-medium text-accent">次の一歩　</span>
        {card.nextStep}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FitScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">適合度 {score}</span>
    </div>
  );
}
