import Link from "next/link";

const rules = [
  {
    id: "01",
    title: "Be Respectful and Inclusive",
    body: "Treat everyone with respect. Avoid personal attacks, harassment, and hate speech based on any characteristic. We are a community of learners at all levels — patience and empathy are required.",
  },
  {
    id: "02",
    title: "Search Before Posting",
    body: "Before posting a question, use the search bar to see if it has already been answered. Duplicate questions dilute the community's knowledge base. If your situation is meaningfully different, explain how.",
  },
  {
    id: "03",
    title: "Stay On Topic",
    body: "Keep discussions relevant to software development, learning, and the topics covered in Curriculum.OS courses. Off-topic posts may be removed or moved to a more appropriate channel.",
  },
  {
    id: "04",
    title: "Share Knowledge, Not Spam",
    body: "Do not post promotional content, affiliate links, or unsolicited advertisements. Sharing open-source projects, useful tools, or articles is welcome if they are directly relevant to the discussion.",
  },
  {
    id: "05",
    title: "Write Clear, Specific Questions",
    body: "Include your code, error messages, and what you have already tried. Vague questions are hard to answer. The more context you provide, the faster you will receive a useful answer.",
  },
  {
    id: "06",
    title: "Accept and Give Constructive Feedback",
    body: "When reviewing others' code or answering questions, focus on the work, not the person. Feedback should be actionable and specific. Avoid condescending language.",
  },
];

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
<div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-5">
            <Link href="/community" className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors cursor-pointer">Community</Link>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">Guidelines</span>
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-[var(--foreground)] mb-4">Community Guidelines</h1>
          <p className="text-[var(--muted-foreground)] max-w-xl leading-relaxed">
            These rules exist to keep Curriculum.OS a high-quality, welcoming, and productive space for every engineer — from day-one learners to senior staff.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Rules List in 1px grid */}
        <div className="bg-[var(--border)] border border-[var(--border)] flex flex-col gap-px mb-12">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-[var(--surface)] p-8 flex gap-8">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] pt-1 shrink-0 w-8">{rule.id}</span>
              <div className="flex-1">
                <h2 className="text-lg font-medium text-[var(--foreground)] tracking-tight mb-3">{rule.title}</h2>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{rule.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Enforcement */}
        <div className="border border-[var(--accent)] bg-[var(--accent)]/5 p-8 mb-12">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] mb-4">Enforcement</h2>
          <p className="text-sm text-[var(--foreground)] leading-relaxed">
            Violations of these guidelines may result in warnings, temporary suspension, or a permanent ban from the community, depending on severity and frequency. Community moderators have the final word on all decisions. If you believe a post violates these guidelines, use the report function.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/community" className="inline-flex h-10 items-center justify-center gap-2 bg-[var(--accent)] px-8 font-mono text-[10px] uppercase tracking-widest text-white hover:opacity-90 transition-opacity cursor-pointer">
            Browse Community
          </Link>
          <Link href="/community/new" className="inline-flex h-10 items-center justify-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-8 font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors cursor-pointer">
            Start a Discussion
          </Link>
        </div>
      </div>
    </div>
  );
}
