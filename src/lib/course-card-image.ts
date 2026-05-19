type CourseCardImageConfig = {
  src: string;
  objectPosition: string;
};

const COURSE_CARD_IMAGE_BY_SLUG: Record<string, CourseCardImageConfig> = {
  "frontend-foundations": {
    src: "/courses/FRONTEND_FOUNDATIONS.png",
    objectPosition: "center 40%",
  },
  "react-next-path": {
    src: "/courses/REACT_AND_NEXT-js.png",
    objectPosition: "center 38%",
  },
  "fullstack-web-development": {
    src: "/courses/full-stack-development.png",
    objectPosition: "center 42%",
  },
  "computer-science-essentials": {
    src: "/courses/COMPUTER-SCIENCE-ESSENTIALS.png",
    objectPosition: "center 36%",
  },
};

const DEFAULT_COURSE_CARD_IMAGE: CourseCardImageConfig = {
  src: "/courses/FRONTEND_FOUNDATIONS.png",
  objectPosition: "center 40%",
};

export const COURSE_CARD_IMAGE_SIZES = {
  curriculumCard:
    "(min-width: 1280px) 600px, (min-width: 768px) 46vw, calc(100vw - 2rem)",
  homeFeatured:
    "(min-width: 1280px) 700px, (min-width: 1024px) 55vw, calc(100vw - 2rem)",
  homeSecondary:
    "(min-width: 1280px) 320px, (min-width: 1024px) 25vw, (min-width: 640px) 46vw, calc(100vw - 2rem)",
} as const;

export function getCourseCardImage(
  slug: string | null | undefined
): CourseCardImageConfig {
  if (!slug) return DEFAULT_COURSE_CARD_IMAGE;
  return COURSE_CARD_IMAGE_BY_SLUG[slug] ?? DEFAULT_COURSE_CARD_IMAGE;
}
