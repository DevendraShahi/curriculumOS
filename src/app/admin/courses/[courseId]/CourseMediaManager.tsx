/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useTransition } from "react";
import { updateCourseMediaAction } from "../actions";

type CourseMediaManagerProps = {
  courseId: string;
  courseSlug: string;
  initialImageUrl?: string;
  initialVideoUrl?: string;
  compact?: boolean;
};

export function CourseMediaManager({ courseId, courseSlug, initialImageUrl, initialVideoUrl, compact = false }: CourseMediaManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [inputUrl, setInputUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");
    setIsUploading(true);

    try {
      // 1. Get signature from our backend
      const signRes = await fetch("/api/v1/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: courseSlug }),
      });
      
      if (!signRes.ok) {
        throw new Error("Failed to get upload signature");
      }
      
      const { signature, timestamp, cloudName, apiKey, folder } = await signRes.json();

      // 2. Upload to Cloudinary directly
      const formData = new FormData();
      formData.append("file", file);
      formData.append("signature", signature);
      formData.append("timestamp", timestamp);
      formData.append("api_key", apiKey);
      if (folder) {
        formData.append("folder", folder);
      }

      const resourceType = mediaType === "image" ? "image" : "video";
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Cloudinary upload failed");
      }

      const uploadData = await uploadRes.json();
      const secureUrl = uploadData.secure_url;
      
      setInputUrl(secureUrl);
      
      // Auto-save on successful upload
      startTransition(async () => {
        try {
          await updateCourseMediaAction(courseId, mediaType, secureUrl);
          setSuccess(`${mediaType === "image" ? "Image" : "Video"} uploaded & saved successfully!`);
        } catch (err: any) {
          setError(err.message || "Failed to save media URL.");
        }
      });
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setIsUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleSaveUrl = () => {
    if (!inputUrl) return;
    setError("");
    setSuccess("");
    
    startTransition(async () => {
      try {
        await updateCourseMediaAction(courseId, mediaType, inputUrl);
        setSuccess(`${mediaType === "image" ? "Image" : "Video"} URL saved successfully!`);
      } catch (err: any) {
        setError(err.message || "Failed to save media URL.");
      }
    });
  };

  const currentMediaUrl = mediaType === "image" ? initialImageUrl : initialVideoUrl;

  return (
    <div className={compact ? "flex flex-col gap-2" : "mb-8 border border-[var(--border)] bg-[var(--surface)] p-6"}>
      {!compact && (
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">Course Media</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mt-1">
              MANAGE COURSE IMAGE OR VIDEO COVER
            </p>
          </div>
          
          {/* Toggle between Image / Video */}
          <div className="flex bg-[var(--surface-2)] border border-[var(--border)] p-1 gap-1">
            <button 
              onClick={() => { setMediaType("image"); setInputUrl(""); setSuccess(""); setError(""); }}
              className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${mediaType === "image" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              Image
            </button>
            <button 
              onClick={() => { setMediaType("video"); setInputUrl(""); setSuccess(""); setError(""); }}
              className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${mediaType === "video" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              Video
            </button>
          </div>
        </div>
      )}

      {compact && (
        <div className="flex bg-[var(--surface-2)] border border-[var(--border)] p-1 gap-1 w-fit">
          <button 
            onClick={() => { setMediaType("image"); setInputUrl(""); setSuccess(""); setError(""); }}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${mediaType === "image" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            Image
          </button>
          <button 
            onClick={() => { setMediaType("video"); setInputUrl(""); setSuccess(""); setError(""); }}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${mediaType === "video" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            Video
          </button>
        </div>
      )}


      <div className="flex flex-col gap-4">
        {/* The Animated Message Box component styled from globals.css */}
        <div className="messageBox">
          <div className="fileUploadWrapper">
            <label htmlFor={`file-upload-${mediaType}`}>
              <svg viewBox="0 0 337 337" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="168.5" cy="168.5" r="158.5" fill="none" stroke="#6c6c6c" strokeWidth="20"></circle>
                <path d="M167.759 79V259" stroke="#6c6c6c" strokeWidth="25" strokeLinecap="round"></path>
                <path d="M79 167.138H259" stroke="#6c6c6c" strokeWidth="25" strokeLinecap="round"></path>
              </svg>
              <span className="tooltip">Upload {mediaType}</span>
            </label>
            <input 
              type="file" 
              id={`file-upload-${mediaType}`}
              accept={mediaType === "image" ? "image/*" : "video/*"}
              className="file-input-hidden"
              onChange={handleFileChange}
              disabled={isUploading || isPending}
            />
          </div>
          
          <input 
            required 
            type="text" 
            className="messageInput"
            placeholder={isUploading ? "Uploading..." : `Paste ${mediaType} URL...`}
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            disabled={isUploading || isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputUrl) {
                handleSaveUrl();
              }
            }}
          />
          
          <button 
            className="sendButton" 
            onClick={handleSaveUrl}
            disabled={!inputUrl || isUploading || isPending}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 664 663">
              <path
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeWidth="33.67"
                stroke="#6c6c6c"
                d="M646.293 331.888L17.7538 17.6122L155.245 331.888M646.293 331.888L17.753 646.157L155.245 331.888M646.293 331.888L318.735 330.228L155.245 331.888"
              ></path>
            </svg>
          </button>
        </div>

        {error && <div className="text-red-500 font-mono text-[10px] uppercase tracking-widest">Error: {error}</div>}
        {success && <div className="text-green-500 font-mono text-[10px] uppercase tracking-widest">{success}</div>}

        {/* Display Current Media (if exists) */}
        {!compact && currentMediaUrl && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-2">Current {mediaType}</p>
            {mediaType === "image" ? (
              <img src={currentMediaUrl} alt="Course Cover" className="max-w-xs h-auto border border-[var(--border)]" />
            ) : (
              <video src={currentMediaUrl} controls className="max-w-xs h-auto border border-[var(--border)]" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
