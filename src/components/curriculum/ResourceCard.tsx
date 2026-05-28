import Link from "next/link";

type ResourceCardProps = {
  title?: string;
  url?: string;
  kind: "link" | "download" | "doc" | "repo" | "video";
  downloadable?: boolean;
  fileName?: string;
  description?: string;
  isInternal?: boolean;
};

export function ResourceCard({
  title,
  url,
  kind,
  downloadable,
  fileName,
  description,
  isInternal,
}: ResourceCardProps) {
  return (
    <li className="rounded border border-[var(--border)] bg-[var(--background)] p-3">
      {title ? (
        <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {url && isInternal ? (
          <Link
            href={url}
            className="inline-flex items-center border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--foreground)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            Open
          </Link>
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--foreground)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            Open
          </a>
        ) : null}
        {url && downloadable && !isInternal ? (
          <a
            href={url}
            download={fileName}
            className="inline-flex items-center border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--foreground)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            Download
          </a>
        ) : null}
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          {kind}
        </span>
      </div>
      {description ? (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {description}
        </p>
      ) : null}
    </li>
  );
}
