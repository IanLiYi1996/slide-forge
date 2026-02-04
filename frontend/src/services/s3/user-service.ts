import { getObject, putObjectSimple, deleteObject } from './s3-client';

export type UserRole = 'ADMIN' | 'USER';

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: string | null;
  role: UserRole;
  hasAccess: boolean;
  headline?: string | null;
  bio?: string | null;
  interests?: string[];
  location?: string | null;
  website?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountInfo {
  id: string;
  provider: string;
  providerAccountId: string;
  type: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
  refresh_token_expires_in?: number | null;
}

export interface UserData {
  profile: UserProfile;
  accounts: AccountInfo[];
}

function getUserKey(userId: string): string {
  return `users/${userId}/profile.json`;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userData = await getObject<UserData>(getUserKey(userId));
  return userData?.profile ?? null;
}

export async function getUserData(userId: string): Promise<UserData | null> {
  return getObject<UserData>(getUserKey(userId));
}

export async function createUserProfile(
  profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>
): Promise<UserProfile> {
  const now = new Date().toISOString();
  const fullProfile: UserProfile = {
    ...profile,
    createdAt: now,
    updatedAt: now,
  };

  const userData: UserData = {
    profile: fullProfile,
    accounts: [],
  };

  await putObjectSimple(getUserKey(profile.id), userData);
  return fullProfile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>
): Promise<UserProfile | null> {
  const userData = await getObject<UserData>(getUserKey(userId));
  if (!userData) {
    return null;
  }

  const updatedProfile: UserProfile = {
    ...userData.profile,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  userData.profile = updatedProfile;
  await putObjectSimple(getUserKey(userId), userData);
  return updatedProfile;
}

export async function deleteUserProfile(userId: string): Promise<void> {
  await deleteObject(getUserKey(userId));
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  // Note: This requires scanning or a separate email index
  // For now, return null - this function should be used sparingly
  // In production, consider maintaining an email -> userId index
  console.warn('getUserByEmail is not efficiently implemented with S3 storage');
  return null;
}

export async function addAccount(
  userId: string,
  account: Omit<AccountInfo, 'id'>
): Promise<AccountInfo> {
  const userData = await getObject<UserData>(getUserKey(userId));
  if (!userData) {
    throw new Error(`User not found: ${userId}`);
  }

  const newAccount: AccountInfo = {
    id: generateId(),
    ...account,
  };

  const existingIdx = userData.accounts.findIndex(
    (a) => a.provider === account.provider && a.providerAccountId === account.providerAccountId
  );

  if (existingIdx >= 0) {
    userData.accounts[existingIdx] = newAccount;
  } else {
    userData.accounts.push(newAccount);
  }

  await putObjectSimple(getUserKey(userId), userData);
  return newAccount;
}

export async function getAccountByProvider(
  userId: string,
  provider: string
): Promise<AccountInfo | null> {
  const userData = await getObject<UserData>(getUserKey(userId));
  if (!userData) {
    return null;
  }

  return userData.accounts.find((a) => a.provider === provider) ?? null;
}

export async function updateAccount(
  userId: string,
  provider: string,
  updates: Partial<Omit<AccountInfo, 'id' | 'provider' | 'providerAccountId'>>
): Promise<AccountInfo | null> {
  const userData = await getObject<UserData>(getUserKey(userId));
  if (!userData) {
    return null;
  }

  const accountIdx = userData.accounts.findIndex((a) => a.provider === provider);
  if (accountIdx < 0) {
    return null;
  }

  const existingAccount = userData.accounts[accountIdx]!;
  const updatedAccount: AccountInfo = {
    ...existingAccount,
    ...updates,
  };
  userData.accounts[accountIdx] = updatedAccount;

  await putObjectSimple(getUserKey(userId), userData);
  return updatedAccount;
}

export async function removeAccount(userId: string, provider: string): Promise<boolean> {
  const userData = await getObject<UserData>(getUserKey(userId));
  if (!userData) {
    return false;
  }

  const initialLength = userData.accounts.length;
  userData.accounts = userData.accounts.filter((a) => a.provider !== provider);

  if (userData.accounts.length < initialLength) {
    await putObjectSimple(getUserKey(userId), userData);
    return true;
  }

  return false;
}

export async function findUserByProviderAccount(
  provider: string,
  providerAccountId: string
): Promise<UserProfile | null> {
  // This is inefficient without a proper index
  // In production, maintain a provider-account -> userId index
  console.warn('findUserByProviderAccount is not efficiently implemented with S3 storage');
  return null;
}

export async function ensureUserExists(
  cognitoSub: string,
  email: string,
  name?: string | null,
  image?: string | null
): Promise<UserProfile> {
  let profile = await getUserProfile(cognitoSub);

  if (!profile) {
    profile = await createUserProfile({
      id: cognitoSub,
      email,
      name,
      image,
      role: 'USER',
      hasAccess: false,
    });
  }

  return profile;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
