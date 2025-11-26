/**
 * Available video aesthetic styles
 */
export const VIDEO_STYLES = [
  "anime",
  "claymation",
  "puppets",
  "realistic",
  "cartoon",
  "watercolor",
  "oil-painting",
  "sketch",
  "pixel-art",
  "3d-render",
  "vintage-photography",
  "cyberpunk",
] as const;

export type VideoStyle = (typeof VIDEO_STYLES)[number];

