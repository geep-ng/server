// types/apify.ts
export type ApifyPost = {
  id: string;
  shortCode: string;
  type: "image" | "video" | "carousel";
  caption?: string;
  displayUrl: string;
  images?: string[];
  videoUrl?: string;
  timestamp?: string;
  childPosts?: ApifyPost[];
};