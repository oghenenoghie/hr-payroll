-- Enables pg_cron, the prerequisite for a real background job runner —
-- every "computed on page load, not scheduled" disclosure elsewhere in
-- this app exists because nothing in the stack could run independently
-- of a user request until now. See 20260724100000 for the first job that
-- actually uses it.
create extension if not exists pg_cron;
