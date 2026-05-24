ALTER TABLE public.resumes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resumes;