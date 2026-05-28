"use client";

import { useMemo } from "react";

const PROVIDER_PATTERNS: Record<
  string,
  { pattern: RegExp; embedUrl: (id: string) => string; label: string }
> = {
  youtube: {
    pattern:
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    embedUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
    label: "YouTube",
  },
  vimeo: {
    pattern: /(?:vimeo\.com\/(\d+))(?:\/|$)/,
    embedUrl: (id) => `https://player.vimeo.com/video/${id}`,
    label: "Vimeo",
  },
  loom: {
    pattern: /(?:loom\.com\/(?:share|embed)\/)([a-zA-Z0-9]+)/,
    embedUrl: (id) => `https://www.loom.com/embed/${id}`,
    label: "Loom",
  },
};

function detectProvider(
  url: string,
  hint?: string
): { id: string; embedUrl: string; label: string } | null {
  if (hint && PROVIDER_PATTERNS[hint]) {
    const matched = url.match(PROVIDER_PATTERNS[hint].pattern);
    if (matched) {
      const entry = PROVIDER_PATTERNS[hint];
      return { id: matched[1], embedUrl: entry.embedUrl(matched[1]), label: entry.label };
    }
  }

  for (const entry of Object.values(PROVIDER_PATTERNS)) {
    const matched = url.match(entry.pattern);
    if (matched) {
      return { id: matched[1], embedUrl: entry.embedUrl(matched[1]), label: entry.label };
    }
  }

  return null;
}

export function VideoPlayer({ url, provider }: { url: string; provider?: string }) {
  const resolved = useMemo(() => detectProvider(url, provider), [url, provider]);

  if (!resolved) {
    return (
      <div className="border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Unsupported video URL
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-mono text-xs text-[var(--accent)] underline"
        >
          {url}
        </a>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative aspect-video w-full">
        <iframe
          src={resolved.embedUrl}
          title="Video lesson"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="border-t border-[var(--border)] px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
          Video · {resolved.label}
        </span>
      </div>
    </div>
  );
}
