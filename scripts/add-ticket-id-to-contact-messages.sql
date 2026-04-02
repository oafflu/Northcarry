-- Add ticket_id column to contact_messages table to link contact form submissions to support tickets
ALTER TABLE contact_messages 
ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_messages_ticket_id ON contact_messages(ticket_id);

