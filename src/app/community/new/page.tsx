"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CreateThreadSuccess = {
  ok: true;
  data: {
    id: string;
  };
};

type CreateThreadFailure = {
  ok: false;
  error: string;
};

function messageForThreadError(code: string): string {
  if (code === "UNAUTHORIZED") {
    return "Sign in to post a discussion.";
  }
  if (code === "INVALID_COMMUNITY_THREAD") {
    return "Check title, category, and description before posting.";
  }
  return "Failed to post discussion. Try again.";
}

export default function NewDiscussionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [description, setDescription] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("TypeScript");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [discussionType, setDiscussionType] = useState<"question" | "discussion">("question");
  const [visibility, setVisibility] = useState<"public" | "tenant_members">("public");
  const [subscribe, setSubscribe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !tags.includes(newTag) && tags.length < 5) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !category || !trimmedDescription) {
      setSubmitError("Fill in Title, Category, and Description before posting.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const trimmedCode = codeSnippet.trim();
    const body = trimmedCode
      ? `${trimmedDescription}\n\n\`\`\`${codeLanguage.toLowerCase()}\n${trimmedCode}\n\`\`\``
      : trimmedDescription;

    try {
      const response = await fetch("/api/v1/community/threads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedTitle,
          body,
          category,
          tags,
          visibility,
          metadata: {
            discussionType,
            subscribe,
          },
        }),
      });

      const payload = (await response.json()) as
        | CreateThreadSuccess
        | CreateThreadFailure;

      if (!response.ok || !payload.ok) {
        const code = "error" in payload ? payload.error : "INTERNAL_ERROR";
        setSubmitError(messageForThreadError(code ?? "INTERNAL_ERROR"));
        return;
      }

      router.push("/community");
      router.refresh();
    } catch {
      setSubmitError("Failed to post discussion. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top Navigation Bar placeholder matching other pages */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
           <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
             <Link href="/community" className="hover:text-[var(--foreground)] transition-colors">Community</Link>
             <span>›</span>
             <span className="text-[var(--foreground)]">New Discussion</span>
           </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10 lg:py-12 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              New Discussion
            </h1>
            <p className="mt-1 sm:mt-2 text-sm text-[var(--muted-foreground)]">
              Share your question, start a discussion, or spark an idea.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link 
              href="/community"
              className="px-4 sm:px-6 py-2.5 text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors rounded-[1px]"
            >
              CANCEL
            </Link>
            <button 
              type="submit"
              form="new-discussion-form"
              disabled={submitting}
              className="px-4 sm:px-6 py-2.5 text-sm font-medium bg-[var(--accent)] text-white hover:bg-blue-700 transition-colors rounded-[1px] disabled:opacity-60"
            >
              {submitting ? "POSTING..." : "POST"}
            </button>
          </div>
        </div>

        {submitError ? (
          <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Form */}
          <form id="new-discussion-form" className="space-y-6 lg:space-y-8" onSubmit={handleSubmit}>
            
            {/* Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How to manage global state in large React apps?"
                required
                className="w-full border border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-3 text-sm sm:text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded-[1px]"
              />
              <div className="text-right text-xs text-[var(--muted-foreground)]">
                {title.length}/120
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full appearance-none border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] rounded-[1px]"
                >
                  <option value="" disabled>Select a category</option>
                  <option value="qna">Q&A</option>
                  <option value="showcase">Showcase</option>
                  <option value="ideas">Ideas</option>
                  <option value="general">General</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--muted-foreground)]">
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">Choose the closest category for your discussion.</p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-2 border border-[var(--border)] bg-[var(--surface)] p-2 focus-within:ring-1 focus-within:ring-[var(--accent)] rounded-[1px]">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 bg-[var(--background)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] rounded-[1px]">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length === 0 ? "Add tags..." : ""}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-sm px-2 py-1 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                />
              </div>
              <div className="flex justify-between items-center text-xs text-[var(--muted-foreground)]">
                <span>Add up to 5 tags to help others find your discussion.</span>
                <span>{tags.length}/5</span>
              </div>
            </div>

            {/* Description Editor */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Description <span className="text-red-500">*</span>
              </label>
              <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[1px]">
                {/* Editor Toolbar */}
                <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] p-2 bg-[var(--background)] overflow-x-auto">
                  <select className="bg-transparent text-sm text-[var(--foreground)] outline-none border-none pr-4 cursor-pointer">
                    <option>Normal</option>
                    <option>Heading 1</option>
                    <option>Heading 2</option>
                  </select>
                  <div className="w-px h-4 bg-[var(--border)] mx-2" />
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <span className="font-bold font-serif">B</span>
                  </button>
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <span className="italic font-serif">I</span>
                  </button>
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <span className="font-mono text-xs">{'</>'}</span>
                  </button>
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  </button>
                  <div className="w-px h-4 bg-[var(--border)] mx-2" />
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </button>
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  </button>
                  <div className="flex-1" />
                  <button type="button" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] rounded">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write your question or start your discussion..."
                  className="w-full min-h-[200px] bg-transparent p-4 text-sm text-[var(--foreground)] outline-none resize-y placeholder:text-[var(--muted-foreground)]"
                  required
                />
                <div className="flex justify-end p-2 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                  {description.trim() ? description.trim().split(/\s+/).length : 0} words
                </div>
              </div>
            </div>

            {/* Code / Snippet */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Code / Snippet <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
              </label>
              <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[1px]">
                <div className="flex items-center justify-between border-b border-[var(--border)] p-2 bg-[var(--background)]">
                  <select 
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="bg-transparent text-xs text-[var(--foreground)] outline-none border-none pr-4 cursor-pointer font-mono"
                  >
                    <option>TypeScript</option>
                    <option>JavaScript</option>
                    <option>React (TSX)</option>
                    <option>CSS</option>
                    <option>HTML</option>
                  </select>
                  <button type="button" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1 font-mono uppercase tracking-widest px-2 py-1 border border-[var(--border)] hover:bg-[var(--surface)]">
                    Format
                  </button>
                </div>
                <div className="flex font-mono text-sm">
                  <div className="py-4 pl-4 pr-3 text-[var(--muted-foreground)] bg-[var(--background)] select-none border-r border-[var(--border)]">
                    1
                  </div>
                  <textarea
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                    placeholder="Paste code here..."
                    className="w-full min-h-[120px] bg-transparent p-4 outline-none resize-y text-[var(--foreground)]"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">Provide relevant code or logs to help others understand the context.</p>
            </div>

            {/* Discussion Type */}
            <div className="space-y-4 pt-4">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Discussion Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label 
                  className={`flex cursor-pointer border rounded-[1px] p-4 transition-colors ${discussionType === "question" ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)]"}`}
                  onClick={() => setDiscussionType("question")}
                >
                  <div className="flex items-start gap-4 w-full">
                    <div className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border h-4 w-4 ${discussionType === "question" ? "border-[var(--accent)]" : "border-[var(--muted-foreground)]"}`}>
                      {discussionType === "question" && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">Question</div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">Ask for help or clarification</div>
                    </div>
                    <div className="ml-auto text-[var(--muted-foreground)] bg-[var(--background)] rounded-full p-2 border border-[var(--border)] flex items-center justify-center">
                      <span className="font-bold text-xs">?</span>
                    </div>
                  </div>
                </label>

                <label 
                  className={`flex cursor-pointer border rounded-[1px] p-4 transition-colors ${discussionType === "discussion" ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)]"}`}
                  onClick={() => setDiscussionType("discussion")}
                >
                  <div className="flex items-start gap-4 w-full">
                    <div className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border h-4 w-4 ${discussionType === "discussion" ? "border-[var(--accent)]" : "border-[var(--muted-foreground)]"}`}>
                      {discussionType === "discussion" && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">Discussion</div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">Share ideas or start a conversation</div>
                    </div>
                    <div className="ml-auto text-[var(--muted-foreground)] bg-[var(--background)] rounded-full p-1.5 border border-[var(--border)] flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-4 pt-4">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Visibility
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label 
                  className={`flex cursor-pointer border rounded-[1px] p-4 transition-colors ${visibility === "public" ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)]"}`}
                  onClick={() => setVisibility("public")}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border h-4 w-4 ${visibility === "public" ? "border-[var(--accent)]" : "border-[var(--muted-foreground)]"}`}>
                      {visibility === "public" && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">Public</div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">Anyone in the community can view and reply</div>
                    </div>
                  </div>
                </label>

                <label 
                  className={`flex cursor-pointer border rounded-[1px] p-4 transition-colors ${visibility === "tenant_members" ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--background)]"}`}
                  onClick={() => setVisibility("tenant_members")}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border h-4 w-4 ${visibility === "tenant_members" ? "border-[var(--accent)]" : "border-[var(--muted-foreground)]"}`}>
                      {visibility === "tenant_members" && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-[var(--foreground)]">Members Only</div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">Visible to signed-in members in this tenant</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Subscribe */}
            <div className="pt-2 pb-12">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={subscribe}
                  onChange={(e) => setSubscribe(e.target.checked)}
                  className="mt-1 shrink-0 appearance-none h-4 w-4 border border-[var(--border)] bg-[var(--surface)] checked:bg-[var(--accent)] checked:border-[var(--accent)] rounded-[1px] flex items-center justify-center relative after:content-[''] after:absolute after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:scale-0 checked:after:scale-100 after:transition-transform"
                />
                <div>
                  <div className="font-medium text-sm text-[var(--foreground)]">Subscribe to this discussion</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">Get notified about new replies</div>
                </div>
              </label>
            </div>

          </form>

          {/* Right Column: Sidebar */}
          <div className="space-y-6 sticky top-6 hidden lg:block">
            
            {/* Before you post */}
            <div className="border border-[var(--border)] bg-[var(--surface)] p-6 rounded-[1px]">
              <h3 className="font-semibold text-sm text-[var(--foreground)] mb-5">Before you post</h3>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="text-[var(--muted-foreground)] mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">Search first</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1.5 leading-relaxed">Check if your question has already been asked.</div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="text-[var(--muted-foreground)] mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">Be clear and specific</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1.5 leading-relaxed">Provide enough detail for others to understand.</div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="text-[var(--muted-foreground)] mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">Include context</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1.5 leading-relaxed">Share relevant code, configs, or logs.</div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="text-[var(--muted-foreground)] mt-0.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">Be respectful</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1.5 leading-relaxed">Follow our community guidelines.</div>
                  </div>
                </li>
              </ul>
            </div>

            {/* Popular Tags */}
            <div className="border border-[var(--border)] bg-[var(--surface)] p-6 rounded-[1px]">
              <h3 className="font-semibold text-sm text-[var(--foreground)] mb-5">Popular Tags</h3>
              <ul className="space-y-3.5 mb-6">
                {[
                  { name: "Zustand", count: 342 },
                  { name: "Redux Toolkit", count: 289 },
                  { name: "Jotai", count: 221 },
                  { name: "State Management", count: 198 },
                  { name: "Architecture", count: 177 },
                  { name: "Performance", count: 142 },
                  { name: "Best Practices", count: 129 },
                  { name: "TypeScript", count: 118 }
                ].map((tag) => (
                  <li key={tag.name} className="flex justify-between items-center text-sm">
                    <span className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">{tag.name}</span>
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">{tag.count}</span>
                  </li>
                ))}
              </ul>
              <Link href="/community/tags" className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] hover:text-blue-700 block text-center mt-2">
                BROWSE ALL TAGS →
              </Link>
            </div>

            {/* Community Guidelines */}
            <div className="border border-[var(--border)] bg-[var(--surface)] p-6 rounded-[1px]">
              <h3 className="font-semibold text-sm text-[var(--foreground)] mb-5">Community Guidelines</h3>
              <ul className="space-y-4 mb-6">
                <li>
                  <Link href="/community/guidelines#respect" className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
                    Be respectful and inclusive
                  </Link>
                </li>
                <li>
                  <Link href="/community/guidelines#search" className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    Search before posting
                  </Link>
                </li>
                <li>
                  <Link href="/community/guidelines#topic" className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                    Stay on topic
                  </Link>
                </li>
                <li>
                  <Link href="/community/guidelines#spam" className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Share knowledge, not spam
                  </Link>
                </li>
              </ul>
              <Link href="/community/guidelines" className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] hover:text-blue-700 block text-center mt-2">
                READ FULL GUIDELINES →
              </Link>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
