// Loading images: files from the person's machine (read with the File API, never uploaded)
// and the bundled scene plates, which are plain files under ./samples.

/**
 * Loads an image from an app-relative or blob URL, resolving when it can be drawn — and fully
 * decoded where the platform offers a decode() step, so the first draw never stalls on a
 * half-decoded progressive JPEG.
 */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) img.decode().catch(() => {}).finally(() => resolve(img));
      else resolve(img);
    };
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/**
 * Reads a File into an object URL and loads it. The URL is revoked only after the decode has
 * had a beat to finish, so the plate cache never ends up holding a dead handle.
 */
export async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (img.decode) await img.decode().catch(() => {});
    return img;
  } finally {
    // Revoke on the next tick so the decode has definitely finished.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
