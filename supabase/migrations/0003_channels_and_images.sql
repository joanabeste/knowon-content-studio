-- =====================================================================
-- Requested channels per project + image enhancements for blog
-- =====================================================================

-- Track which channels were requested at generate-time. Default = all 5.
alter table public.content_projects
  add column if not exists requested_channels channel[] not null
    default '{linkedin,instagram,eyefox,newsletter,blog}';

-- Mark an image as the featured image (1 per project)
alter table public.images
  add column if not exists is_featured boolean not null default false,
  add column if not exists size text;

-- Helpful index for looking up images by project
create index if not exists images_project_idx on public.images(project_id);
