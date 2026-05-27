
-- Restrict realtime channel subscriptions so users may only subscribe to their own resumes:<user_id> topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can subscribe to their own resumes channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('resumes:' || (select auth.uid())::text)
);

CREATE POLICY "Users can broadcast to their own resumes channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('resumes:' || (select auth.uid())::text)
);
