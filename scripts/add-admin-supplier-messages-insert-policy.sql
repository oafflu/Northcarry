-- Allow participants to insert messages into admin–supplier threads (supplier portal + admin app).
-- Without this, suppliers using the anon/authenticated Supabase client cannot reply.

DROP POLICY IF EXISTS "Participants can insert chat messages" ON admin_supplier_messages;

CREATE POLICY "Participants can insert chat messages"
  ON admin_supplier_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM admin_supplier_chats c
      WHERE c.id = admin_supplier_messages.chat_id
        AND (c.admin_id = auth.uid() OR c.supplier_id = auth.uid())
    )
  );

COMMENT ON POLICY "Participants can insert chat messages" ON admin_supplier_messages IS
  'Suppliers and admins may post only to chats they belong to, as themselves.';
