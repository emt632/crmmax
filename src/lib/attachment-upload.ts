import { supabase } from './supabase';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'engagement-attachments';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
]);

export const ATTACHMENT_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.txt', '.csv',
].join(',');

export interface AttachmentRow {
  id: string;
  engagement_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  public_url: string;
  uploaded_by: string;
  created_at: string;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `${file.name} exceeds 10 MB limit`;
  if (!ALLOWED_TYPES.has(file.type)) return `${file.name} has an unsupported file type`;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadAttachment(
  engagementId: string,
  file: File,
  userId: string
): Promise<AttachmentRow> {
  const storagePath = `${engagementId}/${Date.now()}_${sanitizeFilename(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('ga_engagement_attachments')
    .insert({
      engagement_id: engagementId,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AttachmentRow;
}

export async function deleteAttachment(attachment: AttachmentRow): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from('ga_engagement_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw error;
}

export async function fetchAttachments(engagementId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from('ga_engagement_attachments')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as AttachmentRow[];
}
