"use client";

import React from "react";

export function ContourBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Blue/White Gradient Blob - Light & Dark support */}
      <div className="absolute top-[-10%] left-[20%] h-[700px] w-[800px] rounded-full bg-gradient-to-tr from-blue-100/40 via-blue-50/30 to-transparent blur-3xl opacity-80 dark:from-blue-900/30 dark:via-blue-900/10 dark:opacity-50" />
      <div className="absolute top-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-blue-100/30 via-transparent to-transparent blur-3xl opacity-60 dark:from-blue-800/20" />

      {/* Neumorphic Topographical Contours */}
      <svg
        className="absolute inset-0 w-full h-full opacity-30 dark:opacity-10 mix-blend-multiply dark:mix-blend-screen"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <filter id="inset-shadow">
          <feOffset dx="2" dy="2" />
          <feGaussianBlur stdDeviation="3" result="offset-blur" />
          <feComposite
            operator="out"
            in="SourceGraphic"
            in2="offset-blur"
            result="inverse"
          />
          <feFlood floodColor="black" floodOpacity="0.05" result="color" />
          <feComposite operator="in" in="color" in2="inverse" result="shadow" />
          <feComposite operator="over" in="shadow" in2="SourceGraphic" />
        </filter>

        <g filter="url(#inset-shadow)" fill="none" className="stroke-[#e5e7eb] dark:stroke-blue-200" strokeWidth="1">
          <path d="M-100 200 Q 300 100 600 400 T 1200 100" />
          <path d="M-100 250 Q 300 150 600 450 T 1200 150" />
          <path d="M-100 300 Q 300 200 600 500 T 1200 200" />
          
          <path d="M0 600 Q 400 500 800 800 T 1600 600" />
          <path d="M0 650 Q 400 550 800 850 T 1600 650" />
          
          <path d="M1000 -100 Q 800 300 1200 600 T 1800 400" />
          <path d="M1050 -100 Q 850 300 1250 600 T 1850 400" />
        </g>
      </svg>
    </div>
  );
}
