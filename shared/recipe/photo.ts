export const maxRecipePhotoBytes = 4 * 1024 * 1024;
export function recipePhotoType(
  bytes: Uint8Array,
): "png" | "jpg" | "webp" | null {
  if (bytes.length < 12) return null;
  if (
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "webp";
  return null;
}
