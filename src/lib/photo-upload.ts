import { supabase } from './supabase';

const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadContactPhoto(
  contactId: string,
  file: File
): Promise<string> {
  const compressed = await compressImage(file);
  const filePath = `${contactId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('contact-photos')
    .upload(filePath, compressed, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('contact-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function deleteContactPhoto(publicUrl: string): Promise<void> {
  const marker = '/contact-photos/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const filePath = publicUrl.substring(idx + marker.length);

  const { error } = await supabase.storage
    .from('contact-photos')
    .remove([filePath]);

  if (error) throw error;
}
