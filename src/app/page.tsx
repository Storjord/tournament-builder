import { BracketBuilder } from "@/components/bracket-builder";

function TargetMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
      <circle cx="16" cy="16" r="15" fill="#ffffff" stroke="var(--color-rule)" />
      <circle cx="16" cy="16" r="12" fill="var(--color-ink)" />
      <circle cx="16" cy="16" r="9" fill="var(--color-blue)" />
      <circle cx="16" cy="16" r="6" fill="var(--color-red)" />
      <circle cx="16" cy="16" r="3" fill="var(--color-gold)" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-4 sm:px-10">
          <TargetMark />
          <span className="stretch-wide text-base font-extrabold tracking-tight">Tournament builder</span>
          <span className="ml-auto hidden text-sm text-muted sm:block">Individual recurve</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-10 sm:py-14">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <h1 className="stretch-wide text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
            From qualification ranking to medal match.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Enter archers in ranking order, choose a format, and record set points as each match
            finishes. Everything stays in this browser tab.
          </p>
        </div>
        <BracketBuilder />
      </main>
    </>
  );
}
