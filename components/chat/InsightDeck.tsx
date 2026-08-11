import { tagLabel } from "@/lib/tags";
import { renderBold } from "@/lib/formatted-text";

export interface InsightCardData {
  themeId: string;
  themeTitle: string;
  quote: string;
  label: string;
  reframe: string;
  tags: string[];
}

export function InsightDeck({ insights }: { insights: InsightCardData[] }) {
  if (insights.length === 0) return null;

  const topTags = computeTopTags(insights, 5);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium text-muted">あなたの気づき</p>
        <div className="mt-2 flex flex-col gap-2">
          {insights.map((insight) => (
            <div key={insight.themeId} className="rounded-lg border border-border bg-card p-3">
              <p className="text-[11px] text-muted">{insight.themeTitle}</p>
              <p className="mt-1 text-sm italic leading-relaxed">「{renderBold(insight.quote)}」</p>
              <p className="mt-1.5 text-sm font-medium text-accent">{renderBold(insight.label)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {renderBold(insight.reframe)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {topTags.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted">あなたのキーワード</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topTags.map((tag) => (
              <span key={tag} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function computeTopTags(insights: InsightCardData[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const insight of insights) {
    for (const tag of insight.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
