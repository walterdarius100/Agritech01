const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 12_000_000;
const MAX_PIXELS = 40_000_000;
const MAX_OUTPUT_BYTES = 750_000;

export async function resizeProjectPhoto(file) {
  if (!ACCEPTED_TYPES.includes(file.type) || !file.size || file.size > MAX_FILE_BYTES) {
    throw new Error('Choisissez une photo JPEG, PNG ou WebP de 12 Mo maximum.');
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Cette photo ne peut pas être lue.');

  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('Cette photo dépasse 40 mégapixels.');
    const variants = [];
    for (const width of [640, 1440]) {
      const scale = Math.min(1, width / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encode = quality => new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      let blob = await encode(.8);
      if (blob?.size > MAX_OUTPUT_BYTES) blob = await encode(.64);
      if (blob?.type !== 'image/webp' || blob.size > MAX_OUTPUT_BYTES) {
        throw new Error('La photo n’a pas pu être optimisée. Essayez un autre fichier.');
      }
      variants.push({ width, blob });
    }
    return variants;
  } finally {
    bitmap.close();
  }
}
