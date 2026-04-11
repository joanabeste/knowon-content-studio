// Database types — hand-written to match the SQL migration.
// In a real project you'd generate these via `supabase gen types typescript`.

export type UserRole = "admin" | "editor" | "reviewer";
export type Channel = "linkedin" | "instagram" | "eyefox" | "newsletter" | "blog";
export type VariantStatus = "draft" | "in_review" | "approved" | "published";

export const ALL_CHANNELS: Channel[] = [
  "linkedin",
  "instagram",
  "eyefox",
  "newsletter",
  "blog",
];

export const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  eyefox: "Eyefox",
  newsletter: "Newsletter",
  blog: "Blog",
};

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface BrandVoice {
  id: number;
  tone: string | null;
  audience: string | null;
  dos: string[] | null;
  donts: string[] | null;
  about_knowon: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface ChannelBrandVoice {
  channel: Channel;
  tone: string | null;
  length_guideline: string | null;
  cta_style: string | null;
  specific_dos: string[] | null;
  specific_donts: string[] | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface GoldenExample {
  id: string;
  channel: Channel;
  title: string | null;
  body: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export interface SourcePost {
  id: string;
  source: "wordpress" | "manual" | "csv";
  external_id: string | null;
  url: string | null;
  title: string | null;
  body: string;
  published_at: string | null;
  imported_at: string;
  tags: string[] | null;
}

export interface ContentProject {
  id: string;
  topic: string;
  brief: string | null;
  status: VariantStatus;
  requested_channels: Channel[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentVariant {
  id: string;
  project_id: string;
  channel: Channel;
  version: number;
  body: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null;
  status: VariantStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ImageRow {
  id: string;
  project_id: string;
  prompt: string;
  storage_path: string;
  wp_media_id: number | null;
  is_featured: boolean;
  size: string | null;
  created_by: string | null;
  created_at: string;
}
