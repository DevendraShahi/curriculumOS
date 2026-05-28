"use client";

import { Suspense, lazy } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  COURSE_CARD_IMAGE_SIZES,
  resolveCourseCardImage,
} from "@/lib/course-card-image";
import type { Course } from "@/lib/api";

const Dithering = lazy(() => 
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

function isRemoteImageSrc(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

type CourseImage = ReturnType<typeof resolveCourseCardImage>;

export function DitheringCourseCard({
  course,
  image,
}: {
  course: Course;
  image: CourseImage;
}) {
  return (
    <Link
      href={`/curriculum/${course.slug ?? course.id}`}
      key={course.id}
      className="group block outline-none"
    >
      <div className="relative overflow-hidden rounded-none border border-[var(--border)] bg-[var(--surface)] aspect-[16/10] sm:aspect-[16/9] flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-1.5 hover:shadow-2xl hover:border-[var(--accent)]">
        
        <div className="relative z-10 w-full h-full">
          {isRemoteImageSrc(image.src) ? (
            <Image
              src={image.src}
              alt={`${course.title} course cover`}
              fill
              sizes={COURSE_CARD_IMAGE_SIZES.curriculumCard}
              style={{ objectPosition: image.objectPosition }}
              className="object-contain transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
            />
          ) : (
            <Image
              src={image.src}
              alt={`${course.title} course cover`}
              fill
              sizes={COURSE_CARD_IMAGE_SIZES.curriculumCard}
              style={{ objectPosition: image.objectPosition }}
              className="object-contain transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]"
            />
          )}
          <span className="sr-only">{course.title}</span>
        </div>

        <Suspense fallback={<div className="absolute inset-0 bg-muted/20 z-20 pointer-events-none" />}>
          <div className="absolute inset-0 z-20 pointer-events-none opacity-40 dark:opacity-30 mix-blend-multiply dark:mix-blend-screen transition-opacity duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:opacity-60 dark:group-hover:opacity-50">
            <Dithering
              colorBack="#00000000" // Transparent
              colorFront="#3B82F6"  // Blue accent for curriculum
              shape="warp"
              type="4x4"
              speed={0.25} // Constant speed to avoid sudden jumps, hover effect handled by CSS opacity
              className="size-full"
              minPixelRatio={1}
            />
          </div>
        </Suspense>
      </div>
    </Link>
  );
}
