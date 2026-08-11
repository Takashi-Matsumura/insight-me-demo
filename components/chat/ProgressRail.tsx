import { THEMES } from "@/lib/dialogue/themes";

export function ProgressRail({ currentThemeId }: { currentThemeId: string }) {
  const currentOrder = THEMES.find((t) => t.id === currentThemeId)?.order ?? 1;

  return (
    <div className="flex items-start gap-2">
      {THEMES.map((theme) => {
        const state =
          theme.order < currentOrder ? "done" : theme.order === currentOrder ? "current" : "todo";
        return (
          <div key={theme.id} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={
                "h-1.5 w-full rounded-full " +
                (state === "done"
                  ? "bg-accent"
                  : state === "current"
                    ? "bg-accent/50"
                    : "bg-border")
              }
            />
            <span
              className={
                "text-center text-[11px] leading-tight " +
                (state === "current" ? "font-medium text-foreground" : "text-muted")
              }
            >
              {theme.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
