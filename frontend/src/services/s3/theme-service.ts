import { getObject, putObjectSimple, deleteObject, listAllObjects } from './s3-client';

export interface CustomTheme {
  id: string;
  name: string;
  description?: string | null;
  userId: string;
  logoUrl?: string | null;
  isPublic: boolean;
  themeData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function getThemeKey(themeId: string): string {
  return `themes/${themeId}.json`;
}

function getThemeIndexKey(userId: string): string {
  return `indexes/themes-by-user/${userId}.json`;
}

interface ThemeIndex {
  userId: string;
  themes: Array<{
    id: string;
    name: string;
    isPublic: boolean;
    updatedAt: string;
  }>;
  updatedAt: string;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `c${result}`;
}

export async function getTheme(themeId: string): Promise<CustomTheme | null> {
  return getObject<CustomTheme>(getThemeKey(themeId));
}

export async function getThemeByUserId(
  themeId: string,
  userId: string
): Promise<CustomTheme | null> {
  const theme = await getTheme(themeId);
  if (!theme || theme.userId !== userId) {
    return null;
  }
  return theme;
}

export async function createTheme(params: {
  userId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  isPublic?: boolean;
  themeData: Record<string, unknown>;
}): Promise<CustomTheme> {
  const id = generateId();
  const now = new Date().toISOString();

  const theme: CustomTheme = {
    id,
    name: params.name,
    description: params.description ?? null,
    userId: params.userId,
    logoUrl: params.logoUrl ?? null,
    isPublic: params.isPublic ?? false,
    themeData: params.themeData,
    createdAt: now,
    updatedAt: now,
  };

  await putObjectSimple(getThemeKey(id), theme);

  // Update theme index
  await updateThemeIndex(params.userId, {
    id,
    name: params.name,
    isPublic: theme.isPublic,
    updatedAt: now,
  });

  return theme;
}

export async function updateTheme(
  themeId: string,
  userId: string,
  updates: Partial<Omit<CustomTheme, 'id' | 'userId' | 'createdAt'>>
): Promise<CustomTheme | null> {
  const theme = await getTheme(themeId);
  if (!theme || theme.userId !== userId) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedTheme: CustomTheme = {
    ...theme,
    ...updates,
    updatedAt: now,
  };

  await putObjectSimple(getThemeKey(themeId), updatedTheme);

  // Update theme index
  await updateThemeIndex(userId, {
    id: themeId,
    name: updatedTheme.name,
    isPublic: updatedTheme.isPublic,
    updatedAt: now,
  });

  return updatedTheme;
}

export async function deleteTheme(themeId: string, userId: string): Promise<boolean> {
  const theme = await getTheme(themeId);
  if (!theme || theme.userId !== userId) {
    return false;
  }

  await deleteObject(getThemeKey(themeId));
  await removeFromThemeIndex(userId, themeId);

  return true;
}

export async function getUserThemes(userId: string): Promise<CustomTheme[]> {
  const index = await getObject<ThemeIndex>(getThemeIndexKey(userId));
  if (!index || index.themes.length === 0) {
    return [];
  }

  const themes = await Promise.all(
    index.themes.map((t) => getTheme(t.id))
  );

  return themes
    .filter((t): t is CustomTheme => t !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getPublicThemes(): Promise<CustomTheme[]> {
  // This requires scanning all themes - consider maintaining a public themes index
  // For now, get all theme keys and filter
  const keys = await listAllObjects('themes/');

  const themes = await Promise.all(
    keys.map(async (key) => {
      const theme = await getObject<CustomTheme>(key);
      return theme;
    })
  );

  return themes
    .filter((t): t is CustomTheme => t !== null && t.isPublic)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function updateThemeIndex(
  userId: string,
  themeEntry: { id: string; name: string; isPublic: boolean; updatedAt: string }
): Promise<void> {
  let index = await getObject<ThemeIndex>(getThemeIndexKey(userId));

  if (!index) {
    index = {
      userId,
      themes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const existingIdx = index.themes.findIndex((t) => t.id === themeEntry.id);
  if (existingIdx >= 0) {
    index.themes[existingIdx] = themeEntry;
  } else {
    index.themes.unshift(themeEntry);
  }
  index.updatedAt = new Date().toISOString();

  await putObjectSimple(getThemeIndexKey(userId), index);
}

async function removeFromThemeIndex(userId: string, themeId: string): Promise<void> {
  const index = await getObject<ThemeIndex>(getThemeIndexKey(userId));
  if (!index) {
    return;
  }

  index.themes = index.themes.filter((t) => t.id !== themeId);
  index.updatedAt = new Date().toISOString();

  await putObjectSimple(getThemeIndexKey(userId), index);
}
