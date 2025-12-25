/**
 * Read text file content using FileReader API (client-side)
 * Handles .txt and .md files
 */
export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        const trimmedText = result.trim();
        if (trimmedText.length === 0) {
          reject(new Error("No text content found in file"));
        } else {
          resolve(trimmedText);
        }
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}
