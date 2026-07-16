-- ICP-driven discovery: leads found by searching the open web from the ICP
-- configuration (not just entities mentioned alongside watched accounts). A
-- provenance flag distinguishes the two sources so the UI can explain where a
-- lead came from.

alter table lead_candidates
  add column if not exists discovery_source text not null default 'mention'
    check (discovery_source in ('mention', 'icp_search'));

-- Existing rows were all mention-based; the default already covers them.
comment on column lead_candidates.discovery_source is
  'mention = named alongside a watched account; icp_search = found by ICP web search';
