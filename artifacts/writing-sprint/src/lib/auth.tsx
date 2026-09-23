import * as Clerk from "@clerk/react";
import type { ComponentProps } from "react";
import { DEMO_NAME, DEMO_USER_ID, exitDemoSession, isDemoSession } from "./demoSession";
export * from "@clerk/react";

const getDemoToken = async () => null;
const demoUser = {
  id: DEMO_USER_ID, firstName: DEMO_NAME, lastName: "", fullName: `${DEMO_NAME} · Demo`,
  username: "alex-demo", imageUrl: "", hasImage: false, emailAddresses: [],
  primaryEmailAddress: { emailAddress: "alex@example.test" }, publicMetadata: {}, unsafeMetadata: {},
};

export function useAuth(): ReturnType<typeof Clerk.useAuth> {
  const auth = Clerk.useAuth();
  if (!isDemoSession()) return auth;
  return { ...auth, isLoaded: true, isSignedIn: true, userId: DEMO_USER_ID, sessionId: "local-demo", getToken: getDemoToken, signOut: async () => exitDemoSession() } as ReturnType<typeof Clerk.useAuth>;
}
export function useUser(): ReturnType<typeof Clerk.useUser> {
  const user = Clerk.useUser();
  return isDemoSession() ? { isLoaded: true, isSignedIn: true, user: demoUser } as unknown as ReturnType<typeof Clerk.useUser> : user;
}
export function useClerk(): ReturnType<typeof Clerk.useClerk> {
  const clerk = Clerk.useClerk();
  return isDemoSession() ? { ...clerk, signOut: async () => exitDemoSession() } as ReturnType<typeof Clerk.useClerk> : clerk;
}
export function ClerkLoading(props: ComponentProps<typeof Clerk.ClerkLoading>) {
  return isDemoSession() ? null : <Clerk.ClerkLoading {...props} />;
}
