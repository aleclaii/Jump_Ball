const LOGO_SIZE = 128;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Crops an image file to a centered square and shrinks it so it fits in browser storage. */
function readAsSquareLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Not a readable image"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = LOGO_SIZE;
        const side = Math.min(image.width, image.height);
        canvas.getContext("2d")?.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, LOGO_SIZE, LOGO_SIZE);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Handles a file input: checks the file, shows a clear error if it's wrong, and hands back the logo. */
export async function takeImage(input: HTMLInputElement, errorEl: HTMLElement, onImage: (dataUrl: string) => void): Promise<void> {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    errorEl.textContent = "That file isn't an image. Try a PNG or JPG.";
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    errorEl.textContent = "That image is over 8 MB. Try a smaller one.";
    return;
  }
  try {
    onImage(await readAsSquareLogo(file));
    errorEl.textContent = "";
  } catch {
    errorEl.textContent = "Couldn't read that image. Try a different file.";
  }
}
