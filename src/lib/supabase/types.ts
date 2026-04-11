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

export type SourcePostSource =
  | "wordpress"
  | "linkedin"
  | "instagram"
  | "eyefox"
  | "newsletter"
  | "url_import"
  | "manual"
  | "csv";

export const SOURCE_LABELS: Record<SourcePostSource, string> = {
  wordpress: "WordPress",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  eyefox: "Eyefox",
  newsletter: "Newsletter",
  url_import: "URL-Import",
  manual: "Manuell",
  csv: "CSV-Import",
};

export interface SourcePost {
  id: string;
  source: SourcePostSource;
  external_id: string | null;
  url: string | null;
  title: string | null;
  body: string;
  published_at: string | null;
  imported_at: string;
  tags: string[] | null;
  channel: Channel;
  is_featured: boolean;
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

export interface ContextDocument {
  id: string;
  title: string;
  content: string;
  source: "manual" | "upload";
  file_name: string | null;
  is_active: boolean;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentFeed {
  id: string;
  name: string;
  url: string;
  channel: Channel;
  is_active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  items_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PlatformName = "linkedin" | "instagram";

export interface PlatformConnection {
  platform: PlatformName;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  external_id: string | null;
  external_name: string | null;
  scopes: string[] | null;
  connected_by: string | null;
  connected_at: string | null;
  updated_at: string;
}
