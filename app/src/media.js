// Loading images: files from the person's machine (read with the File API, never uploaded)
// and the bundled scene plates, which are plain files under ./samples.

/** Loads an image from an app-relative or blob URL, resolving when it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Reads a File into an object URL and loads it. */
export async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    // Revoke on the next tick so the decode has definitely finished.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
