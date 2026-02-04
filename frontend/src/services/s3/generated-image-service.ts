import { getObject, putObjectSimple, listAllObjects, deleteObject } from './s3-client';
import { nanoid } from 'nanoid';

export interface GeneratedImage {
  id: string;
  userId: string;
  url: string;
  prompt: string;
  createdAt: string;
}

function getImageKey(userId: string, imageId: string): string {
  return `generated-images/${userId}/${imageId}.json`;
}

function getImagesPrefix(userId: string): string {
  return `generated-images/${userId}/`;
}

export async function createGeneratedImage(
  data: Omit<GeneratedImage, 'id' | 'createdAt'>
): Promise<GeneratedImage> {
  const now = new Date().toISOString();
  const id = nanoid();

  const image: GeneratedImage = {
    ...data,
    id,
    createdAt: now,
  };

  await putObjectSimple(getImageKey(data.userId, id), image);
  return image;
}

export async function getGeneratedImage(
  userId: string,
  imageId: string
): Promise<GeneratedImage | null> {
  return getObject<GeneratedImage>(getImageKey(userId, imageId));
}

export async function getUserGeneratedImages(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ images: GeneratedImage[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const objectKeys = await listAllObjects({
    prefix: getImagesPrefix(userId),
  });

  const allImages: GeneratedImage[] = [];
  for (const key of objectKeys) {
    const image = await getObject<GeneratedImage>(key);
    if (image) {
      allImages.push(image);
    }
  }

  // Sort by createdAt descending
  allImages.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = allImages.length;
  const paginated = allImages.slice(offset, offset + limit);

  return { images: paginated, total };
}

export async function deleteGeneratedImage(
  userId: string,
  imageId: string
): Promise<boolean> {
  try {
    await deleteObject(getImageKey(userId, imageId));
    return true;
  } catch {
    return false;
  }
}
