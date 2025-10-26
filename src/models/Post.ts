import mongoose from "mongoose";

// models/Post.ts
export interface PostDoc extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  igId: string;
  shortcode: string;
  type: "image" | "video" | "carousel";
  caption?: string;
  displayUrl: string;
  images: string[];
  videoUrl?: string;
  childPosts: PostChild[];
  timestamp: Date;
}

export interface PostChild {
  igId: string;
  shortcode: string;
  type: string;
  caption?: string;
  displayUrl: string;
  images: string[];
  videoUrl?: string;
}

const childPostSchema = new mongoose.Schema(
  {
    igId: { type: String, required: true },
    type: { type: String, enum: ["Image", "Video"], required: true },
    caption: { type: String },
    displayUrl: {type: String},
    images: [{ type: String }], // Firebase URLs
    videoUrl: { type: String }, // Firebase URL if video
    shortcode: { type: String },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    igId: { type: String, required: true }, // Instagram’s internal ID
    type: { type: String, enum: ["Image", "Video", "Sidecar"], required: true },
    caption: { type: String },
    displayUrl: {type: String},
    shortcode: { type: String, unique: true },
    images: [{ type: String }], // Firebase URLs
    videoUrl: { type: String }, // Firebase URL if video
    childPosts: [childPostSchema], // for carousel/sidecar posts
    timestamp: { type: Date },
    storagePath: { type: String },
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);
export default Post;