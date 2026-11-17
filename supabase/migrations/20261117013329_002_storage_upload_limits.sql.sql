-- Enforce backend upload size/type limits; React UI limits are advisory only.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'age-verification';
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf','video/mp4']
where id = 'member-private';