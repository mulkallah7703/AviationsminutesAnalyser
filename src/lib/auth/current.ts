import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  USER_COOKIE,
  adminFromSessionToken,
  userFromSessionToken,
  type LocalUser,
} from "@/lib/auth/accounts";

export async function currentUser(): Promise<LocalUser | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  if (!token) return null;
  return userFromSessionToken(token);
}

export async function currentAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return adminFromSessionToken(token);
}
