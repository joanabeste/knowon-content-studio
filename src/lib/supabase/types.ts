// Database types — hand-written to match the SQL migration.
// In a real project you'd generate these via `supabase gen types typescript`.

export type UserRole = "admin" | "editor" | "reviewer";
export type Channel =
  | "linkedin"
  | "instagram"
  | "iprendo_news"
  | "eyefox"
  | "newsletter"
  | "blog";
export type VariantStatus = "draft" | "in_review" | "approved" | "published";

export const ALL_CHANNELS: Channel[] = [
  "linkedin",
  "instagram",
  "iprendo_news",
  "eyefox",
  "newsletter",
  "blog",
];

export const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  iprendo_news: "Iprendo News",
  eyefox: "Eyefox",
  newsletter: "Newsletter",
  blog: "WordPress",
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
  /**
   * Storage path of the brand logo (PNG/SVG/WebP). Lives in the
   * `generated-images` bucket under `brand/`. When set, every
   * generated or uploaded blog image gets this logo composited
   * into the bottom-right corner 1:1 (no recoloring, no text).
   */
  logo_path: string | null;
  /**
   * Hardcoded tonfall anchor — a freetext block the admin copies
   * a few perfect example sentences into. Unlike the few-shot
   * inspiration posts (which rotate per topic), this one text is
   * injected into EVERY generation prompt, so the model always
   * has a stable voice reference. Think of it as a mini style
   * guide, not as a knowledge base.
   */
  tone_examples: string | null;
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
  | "iprendo_news"
  | "eyefox"
  | "newsletter"
  | "url_import"
  | "manual"
  | "csv"
  | "approved_variant";

export const SOURCE_LABELS: Record<SourcePostSource, string> = {
  wordpress: "WordPress",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  iprendo_news: "Iprendo News",
  eyefox: "Eyefox",
  newsletter: "Newsletter",
  url_import: "URL-Import",
  manual: "Manuell",
  csv: "CSV-Import",
  approved_variant: "Freigegebene Variante",
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
  assigned_to: string | null;
  is_preview: boolean;
  review_requested_at: string | null;
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
  created_by: string | null;
  updated_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

/**
 * ContentVariant augmented with joined profile data for the author
 * and reviewer. Page-level queries use Supabase's PostgREST
 * `author:created_by(full_name)` syntax to hydrate these.
 */
export interface ContentVariantWithPeople extends ContentVariant {
  author?: { full_name: string | null } | null;
  reviewer?: { full_name: string | null } | null;
}

export interface VariantNote {
  id: string;
  variant_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  applied_to_version: number | null;
  author?: { full_name: string | null } | null;
}

export type VariantVersionReason =
  | "regenerate_channel"
  | "regenerate_all"
  | "apply_note"
  | "manual_edit";

export interface VariantVersion {
  id: string;
  variant_id: string;
  version: number;
  body: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  reason: VariantVersionReason;
  author?: { full_name: string | null } | null;
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

export interface ProjectIdea {
  id: string;
  title: string;
  notes: string | null;
  suggested_channels: Channel[] | null;
  target_date: string | null;
  created_by: string | null;
  converted_to_project_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  author?: { full_name: string | null } | null;
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
