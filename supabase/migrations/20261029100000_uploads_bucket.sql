-- S1-23: the private bucket where an uploaded CV waits for the worker.
-- No storage policy is added on purpose: without one, the browser roles can't read, list or write
-- anything in it. Only server code with the service role key can (the upload API and the worker).
-- The worker deletes each file when its job ends, success or failure (S1-24, design §3).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads-tmp', 'uploads-tmp', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png']);
