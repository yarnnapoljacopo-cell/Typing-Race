// eslint-disable-next-line no-console
console.log("[clerk-key] VITE_CLERK_PK =", import.meta.env.VITE_CLERK_PK, "| VITE_CLERK_PUBLISHABLE_KEY =", import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

import { useEffect, useRef, useState, Component, createContext, useContext, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth, ClerkLoading, ClerkLoaded } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Portal from "@/pages/Portal";
// Heavy route-level pages are code-split so the initial portal/home shell stays small.
const Room = lazy(() => import("@/pages/Room"));
const MyFiles = lazy(() => import("@/pages/MyFiles"));
const Profile = lazy(() => import("@/pages/Profile"));
const Friends = lazy(() => import("@/pages/Friends"));
const Guild = lazy(() => import("@/pages/Guild"));
const GlobalRanking = lazy(() => import("@/pages/GlobalRanking"));
const OfflineSprint = lazy(() => import("@/pages/OfflineSprint"));
const Shop = lazy(() => import("@/pages/Shop"));
const Skins = lazy(() => import("@/pages/Skins"));
const Bag = lazy(() => import("@/pages/Bag"));
const Chests = lazy(() => import("@/pages/Chests"));
const Crafting = lazy(() => import("@/pages/Crafting"));
const Quests = lazy(() => import("@/pages/Quests"));
const Streak = lazy(() => import("@/pages/Streak"));
const Stats = lazy(() => import("@/pages/Stats"));
const NovelNotes = lazy(() => import("@/pages/NovelNotes"));
const CoWriting = lazy(() => import("@/pages/CoWriting"));
const CoWritingRoom = lazy(() => import("@/pages/CoWritingRoom"));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <img
        src={`${basePath}/logo.svg`}
        alt="Loading"
        className="h-10 w-10 rounded-xl animate-pulse"
      />
    </div>
  );
}
import { LevelUpListener } from "@/components/LevelUpListener";
import { useAuthedFetch } from "@/lib/authedFetch";
import { folioStore } from "@/lib/folioStore";
import { GuestProvider, useGuest } from "@/lib/guestContext";
import { VillainModeProvider } from "@/lib/villainModeContext";
import { SkinProvider } from "@/lib/skinContext";
import { DarkModeProvider } from "@/lib/darkModeContext";
import { Sidebar } from "@/components/Sidebar";
import { isPreviewBypassActive } from "@/lib/previewBypass";

// Explicit query defaults:
//  - 4xx responses (auth, not-found, validation) are NOT transient. Retrying
//    them just blocks the UI behind a 14-second backoff for an error that
//    will never resolve on its own. We rely on `useAuthedFetch` to handle
//    the one case that IS transient — a stale 401 mid token-rotation —
//    by retrying once with a refreshed token before the response ever
//    reaches react-query.
//  - For real transient failures (5xx, network) keep the hard cap at 3
//    retries with quick exponential backoff (1s, 2s, 4s) matching
//    react-query's own defaults so users see data within ~7s instead of
//    being stuck on a loading spinner.
function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    // HttpError with `.status` in 4xx range → not transient.
    const status = (err as Error & { status?: number }).status;
    if (typeof status === "number" && status >= 400 && status < 500) return false;
  }
  return true;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, err) => isTransientError(err) && failureCount < 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000), // 1s, 2s, 4s …
      // Disable refetch-on-window-focus globally. Without this, every tab
      // switch re-fetches every mounted query (staleTime defaults to 0),
      // causing a stampede of requests and React Query cache churn.
      // Individual queries that genuinely need focus-refetch opt in explicitly.
      refetchOnWindowFocus: false,
      // Keep cached data fresh for 60 s by default so navigating between
      // pages doesn't re-fetch data that was just loaded.
      staleTime: 60_000,
    },
    mutations: {
      retry: (failureCount, err) => isTransientError(err) && failureCount < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
  },
});

// ── Clerk error boundary ────────────────────────────────────────────────────

const LIVE_URL = "https://app.writingsprint.site";

class ClerkErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error("[ClerkErrorBoundary] caught error:", error);
    // eslint-disable-next-line no-console
    console.error("[ClerkErrorBoundary] component stack:", info.componentStack);
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.error("[ClerkErrorBoundary] message:", error.message);
      // eslint-disable-next-line no-console
      console.error("[ClerkErrorBoundary] stack:", error.stack);
    }
  }
  render() {
    const { error } = this.state;
    if (error) {
      const isDomainError =
        !window.location.hostname.endsWith("writingsprint.site") &&
        !window.location.hostname.endsWith(".up.railway.app") &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";

      if (isDomainError) {
        return (
          <div
            style={{
              minHeight: "100dvh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              fontFamily: "Inter, sans-serif",
              background: "#FAF8F4",
              color: "#2D3142",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <img src={`${basePath}/logo.svg`} alt="Writing Sprint" style={{ width: 56, height: 56, borderRadius: 14 }} />
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
              Writing Sprint
            </h1>
            <p style={{ margin: 0, color: "#68708A", maxWidth: 380 }}>
              Authentication is configured for{" "}
              <strong>app.writingsprint.site</strong>. Please visit the app at
              its official address:
            </p>
            <a
              href={LIVE_URL}
              style={{
                display: "inline-block",
                marginTop: "0.5rem",
                padding: "0.6rem 1.4rem",
                background: "#1A6BC9",
                color: "#fff",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Open app.writingsprint.site
            </a>
          </div>
        );
      }

      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            fontFamily: "Inter, sans-serif",
            background: "#FAF8F4",
            color: "#2D3142",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <img src={`${basePath}/logo.svg`} alt="Writing Sprint" style={{ width: 56, height: 56, borderRadius: 14 }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, color: "#68708A", maxWidth: 380 }}>
            An unexpected error occurred. Please reload to try again. If the problem persists, try signing out and back in.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.6rem 1.4rem",
                background: "#1A6BC9",
                color: "#fff",
                borderRadius: "0.5rem",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Reload page
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                padding: "0.6rem 1.4rem",
                background: "transparent",
                color: "#1A6BC9",
                borderRadius: "0.5rem",
                border: "1.5px solid #1A6BC9",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const clerkPubKey = (import.meta.env.VITE_CLERK_PK ?? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// True when this is the offline Electron bundle (baked in at build time by vite.config.offline.ts,
// with a file:// protocol fallback for extra safety).
const isElectronFileBuild =
  (import.meta.env as Record<string, string>).VITE_OFFLINE_BUILD === "true" ||
  (typeof window !== "undefined" && window.location.protocol === "file:");

// In development builds (NODE_ENV=development), skip the domain restriction so
// the dev Railway service works on any domain (e.g. *.up.railway.app or dev.writingsprint.site).
// In production builds this stays false for non-writingsprint.site origins and
// shows the "wrong domain" screen instead of a broken Clerk state.
const isProductionDomain =
  import.meta.env.DEV ||
  window.location.hostname === "app.writingsprint.site" ||
  window.location.hostname === "writingsprint.site" ||
  window.location.hostname.endsWith(".writingsprint.site") ||
  window.location.hostname.endsWith(".up.railway.app");

// Route Clerk FAPI through the server-side proxy ONLY on the real production
// domains — never in the Replit dev preview. Using the production proxy in dev
// sets cookies for app.writingsprint.site, which the dev API server never sees,
// breaking authentication entirely in the Replit preview.
const isRealProductionDomain =
  window.location.hostname === "app.writingsprint.site" ||
  window.location.hostname === "writingsprint.site" ||
  window.location.hostname.endsWith(".writingsprint.site") ||
  window.location.hostname.endsWith(".up.railway.app");

const clerkProxyUrl = isRealProductionDomain
  ? (import.meta.env.VITE_CLERK_PROXY_URL as string | undefined)
  : undefined;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// NOTE: clerkPubKey may be undefined if VITE_CLERK_PUBLISHABLE_KEY was not set
// at build time. We handle this gracefully inside ClerkProviderWithRoutes so
// that we never throw at module level (which would blank the page before any
// error boundary or domain-check UI can render).

// ── Clerk appearance ───────────────────────────────────────────────────────

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#1A6BC9",
    colorForeground: "#2D3142",
    colorMutedForeground: "#68708A",
    colorDanger: "#dc2626",
    colorBackground: "#FAF8F4",
    colorInput: "#EDE8E1",
    colorInputForeground: "#2D3142",
    colorNeutral: "#DED8CE",
    colorModalBackdrop: "rgba(45, 49, 66, 0.5)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl shadow-primary/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#2D3142] font-serif",
    headerSubtitle: "text-[#68708A]",
    socialButtonsBlockButtonText: "text-[#2D3142]",
    formFieldLabel: "text-[#2D3142]",
    footerActionLink: "text-[#1A6BC9]",
    footerActionText: "text-[#68708A]",
    dividerText: "text-[#68708A]",
    identityPreviewEditButton: "text-[#1A6BC9]",
    formFieldSuccessText: "text-green-700",
    alertText: "text-[#2D3142]",
    logoBox: "flex justify-center mb-1",
    logoImage: "h-10 w-10 rounded-xl",
    socialButtonsBlockButton: "border-[#DED8CE] hover:bg-[#FAF8F4]",
    formButtonPrimary: "bg-[#1A6BC9] text-white hover:bg-[#1558a8]",
    formFieldInput: "border-[#DED8CE] bg-[#FAF8F4] text-[#2D3142]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#DED8CE]",
    alert: "bg-[#FAF8F4]",
    otpCodeFieldInput: "border-[#DED8CE]",
    formFieldRow: "",
    main: "",
  },
};

// ── Route pages ────────────────────────────────────────────────────────────

function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  // If the user is already authenticated (e.g. they landed here after an OAuth
  // callback that completed but then they navigated away from the loading portal),
  // send them straight to the portal instead of showing the sign-in form.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation(`${basePath}/portal`);
    }
  }, [isLoaded, isSignedIn, setLocation]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/portal`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/portal`}
      />
    </div>
  );
}

// ── Guards ─────────────────────────────────────────────────────────────────

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const { guestName } = useGuest();
  const clerkTimedOut = useDevTimeout();

  if (!isLoaded && !clerkTimedOut) return null;

  // In the desktop app, go straight to Folio if there's no connection
  if (!!(window as any).electronAPI && !navigator.onLine) {
    return <Redirect to="/my-files" />;
  }

  if (isSignedIn || guestName) return <Redirect to="/portal" />;
  return <Home />;
}

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <img src={`${basePath}/logo.svg`} alt="Writing Sprint" className="h-12 w-12 rounded-xl animate-pulse" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}


function PortalGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const { guestName } = useGuest();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();

  if (!isLoaded && !clerkTimedOut && !bypass) return <AuthLoading />;
  if (isSignedIn || guestName || bypass) return <Portal />;
  return <Redirect to="/" />;
}

function RoomGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const { guestName } = useGuest();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();

  if (!isLoaded && !clerkTimedOut && !bypass) return null;
  if (isSignedIn || guestName || bypass) return <Room />;
  return <Redirect to="/" />;
}

function MyFilesGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();
  const offlineBypass = isElectronFileBuild || (!!(window as any).electronAPI && !navigator.onLine);
  if (!isLoaded && !clerkTimedOut && !bypass && !offlineBypass) return null;
  if (isSignedIn || bypass || offlineBypass) return <MyFiles />;
  return <Redirect to="/" />;
}

function FriendsGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();

  if (!isLoaded && !clerkTimedOut && !bypass) return null;
  if (isSignedIn || bypass) return <Friends />;
  return <Redirect to="/" />;
}

function GuildGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();

  if (!isLoaded && !clerkTimedOut && !bypass) return null;
  if (isSignedIn || bypass) return <Guild />;
  return <Redirect to="/" />;
}

function GlobalRankingGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();

  if (!isLoaded && !clerkTimedOut && !bypass) return null;
  if (isSignedIn || bypass) return <GlobalRanking />;
  return <Redirect to="/" />;
}

function StreakGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();
  if (!isLoaded && !clerkTimedOut && !bypass) return null;
  if (isSignedIn || bypass) return <Streak />;
  return <Redirect to="/" />;
}

function StatsGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerkTimedOut = useDevTimeout();
  const bypass = isPreviewBypassActive();
  if (!isLoaded && !clerkTimedOut && !bypass) return null;
  if (isSignedIn || bypass) return <Stats />;
  return <Redirect to="/" />;
}

// ── Cache invalidator ──────────────────────────────────────────────────────

function ClerkQueryClientCacheInvalidator() {
  const { isLoaded } = useAuth();
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return; // Clerk timed out / not initialized — skip listener
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        // invalidateQueries marks data stale and refetches in the background,
        // keeping the last-known values visible while the refetch is in flight.
        // qc.clear() was wiping all cached data immediately, causing coins/profile
        // to vanish for the duration of every token refresh or auth state change.
        qc.invalidateQueries();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [isLoaded, addListener, qc]);

  return null;
}

// ── Root ───────────────────────────────────────────────────────────────────

function MissingKeyScreen() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "Inter, sans-serif",
        background: "#FAF8F4",
        color: "#2D3142",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <img src={`${basePath}/logo.svg`} alt="Writing Sprint" style={{ width: 56, height: 56, borderRadius: 14 }} />
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Writing Sprint</h1>
      <p style={{ margin: 0, color: "#68708A", maxWidth: 380 }}>
        The app is not fully configured yet. Please visit the app at its official address:
      </p>
      <a
        href={LIVE_URL}
        style={{
          display: "inline-block",
          marginTop: "0.5rem",
          padding: "0.6rem 1.4rem",
          background: "#1A6BC9",
          color: "#fff",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Open app.writingsprint.site
      </a>
    </div>
  );
}

// ── Dev-mode Clerk timeout ──────────────────────────────────────────────────
// When Clerk's live key rejects the localhost/Replit origin, it silently hangs.
// We detect this via a 6-second timeout and render the app in guest mode instead.
const DevTimeoutContext = createContext(false);
function useDevTimeout() { return useContext(DevTimeoutContext); }

// Renders children when Clerk IS loaded OR when the timeout elapsed.
function FolioSync() {
  const { isSignedIn } = useAuth();
  const authedFetch = useAuthedFetch();
  useEffect(() => {
    if (isSignedIn && authedFetch) {
      folioStore.configure(authedFetch);
    }
  }, [isSignedIn, authedFetch]);
  return null;
}

function SidebarWithRoute() {
  const [path] = useLocation();
  if (path.startsWith("/novel-notes")) return null;
  // Co-writing rooms have their own chrome (back button + invite chip), so
  // suppress the global sidebar to free up screen real estate.
  if (path.startsWith("/co-writing")) return null;
  return <Sidebar />;
}

// Must be placed inside <ClerkProvider> so useAuth() is valid.
function TimedClerkLoaded({ timedOut, children }: { timedOut: boolean; children: ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded && !timedOut) return null;
  return <>{children}</>;
}


function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const [clerkTimedOut, setClerkTimedOut] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);

  // On production domains the auth proxy lives on the same Railway server.
  // When Railway restarts (deploy, memory limit, health check) the server
  // takes up to ~30 s to come back. A 6-second timeout was firing during
  // every restart window, dropping the app into guest mode and making coins,
  // profile, and all auth-gated features disappear for the whole session.
  // In dev/localhost the original 6 s is fine because a live key rejected
  // there hangs forever and we need a safety valve.
  const CLERK_TIMEOUT_MS = isRealProductionDomain ? 45_000 : 6_000;
  // Show a "slow connection" hint after 8 s so users know what's happening.
  const SLOW_HINT_MS = 8_000;

  useEffect(() => {
    const tTimeout = setTimeout(() => setClerkTimedOut(true), CLERK_TIMEOUT_MS);
    const tSlow    = setTimeout(() => setSlowLoad(true),      SLOW_HINT_MS);
    return () => { clearTimeout(tTimeout); clearTimeout(tSlow); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!clerkPubKey) return <MissingKeyScreen />;

  return (
    <DevTimeoutContext.Provider value={clerkTimedOut}>
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignInUrl={`${basePath}/portal`}
      afterSignUpUrl={`${basePath}/portal`}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Writing Sprint account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start saving your writing sprints",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      {/* Loading screen: hidden once timeout fires so TimedClerkLoaded can take over */}
      <ClerkLoading>
        {!clerkTimedOut && (
          <div style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            fontFamily: "Inter, sans-serif",
            background: "#FAF8F4",
            color: "#2D3142",
          }}>
            <img src={`${basePath}/logo.svg`} alt="Writing Sprint" style={{ width: 48, height: 48, borderRadius: 12 }} />
            <p style={{ margin: 0, color: "#68708A", fontSize: "0.95rem" }}>
              {slowLoad ? "Server is starting up, please wait…" : "Loading Writing Sprint…"}
            </p>
            {slowLoad && (
              <p style={{ margin: 0, color: "#A0A8C0", fontSize: "0.8rem" }}>
                This usually takes under 30 seconds.
              </p>
            )}
          </div>
        )}
      </ClerkLoading>
      {/* TimedClerkLoaded renders even when Clerk hasn't loaded, once the
          timeout fires. All auth hooks return isSignedIn=undefined in that
          state so the app behaves as if the user is logged out (guest mode). */}
      <TimedClerkLoaded timedOut={clerkTimedOut}>
      <QueryClientProvider client={queryClient}>
        <GuestProvider>
          <DarkModeProvider>
          <SkinProvider>
          <VillainModeProvider>
          <ClerkQueryClientCacheInvalidator />
          <FolioSync />
          <TooltipProvider>
            <SidebarWithRoute />
            <LevelUpListener />
            <Suspense fallback={<RouteFallback />}>
              <Switch>
                <Route path="/" component={HomeRedirect} />
                <Route path="/portal" component={PortalGuard} />
                <Route path="/room" component={RoomGuard} />
                <Route path="/my-files" component={MyFilesGuard} />
                <Route path="/friends" component={FriendsGuard} />
                <Route path="/guild" component={GuildGuard} />
                <Route path="/global-ranking" component={GlobalRankingGuard} />
                <Route path="/profile/:name" component={Profile} />
                <Route path="/streak" component={StreakGuard} />
                <Route path="/stats" component={StatsGuard} />
                <Route path="/offline-sprint" component={OfflineSprint} />
                <Route path="/shop" component={Shop} />
                <Route path="/skins" component={Skins} />
                <Route path="/bag" component={Bag} />
                <Route path="/chests" component={Chests} />
                <Route path="/crafting" component={Crafting} />
                <Route path="/quests" component={Quests} />
                <Route path="/novel-notes" component={NovelNotes} />
                <Route path="/co-writing" component={CoWriting} />
                <Route path="/co-writing/:id" component={CoWritingRoom} />
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
            <Toaster />
          </TooltipProvider>
          </VillainModeProvider>
          </SkinProvider>
          </DarkModeProvider>
        </GuestProvider>
      </QueryClientProvider>
      </TimedClerkLoaded>
    </ClerkProvider>
    </DevTimeoutContext.Provider>
  );
}

// Detect domain mismatch before rendering Clerk — async Clerk errors aren't
// catchable by error boundaries, so we prevent rendering Clerk entirely when
// we know it will fail.
// In dev mode (Replit preview, localhost) we always let the app through so
// developers can use the preview pane normally.
// But redirect the OLD production deployment URL to the canonical domain.
const OLD_DEPLOYMENT_HOST = "typing-race--yarnnapoljacopo.replit.app";
if (window.location.hostname === OLD_DEPLOYMENT_HOST) {
  window.location.replace(
    `https://app.writingsprint.site${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

const expectedHosts = ["app.writingsprint.site", "writingsprint.site"];
// Replit dev preview hosts (but NOT the old production .replit.app deployment)
const replitDevHosts = ["repl.co", "replit.dev", "repl.it", "id.repl.co"];
const onExpectedDomain =
  import.meta.env.DEV ||
  window.location.hostname === "localhost" ||
  replitDevHosts.some((h) => window.location.hostname.endsWith(`.${h}`)) ||
  // Allow any replit.app host EXCEPT the old deployment (already redirected above)
  (window.location.hostname.endsWith(".replit.app") && window.location.hostname !== OLD_DEPLOYMENT_HOST) ||
  expectedHosts.some(
    (h) =>
      window.location.hostname === h ||
      window.location.hostname.endsWith(`.${h}`)
  );

function WrongDomainScreen() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        fontFamily: "Inter, sans-serif",
        background: "#FAF8F4",
        color: "#2D3142",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <img
        src={`${basePath}/logo.svg`}
        alt="Writing Sprint"
        style={{ width: 56, height: 56, borderRadius: 14 }}
      />
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
        Writing Sprint
      </h1>
      <p style={{ margin: 0, color: "#68708A", maxWidth: 380 }}>
        Authentication is configured for{" "}
        <strong>app.writingsprint.site</strong>. Please visit the app at its
        official address:
      </p>
      <a
        href={LIVE_URL}
        style={{
          display: "inline-block",
          marginTop: "0.5rem",
          padding: "0.6rem 1.4rem",
          background: "#1A6BC9",
          color: "#fff",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Open app.writingsprint.site
      </a>
    </div>
  );
}

function DevPreviewScreen() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        background: "#F7F6F2",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "3rem" }}>✍️</div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
        Writing Sprint — Dev Preview
      </h1>
      <p style={{ color: "#555", maxWidth: "28rem", margin: 0, lineHeight: 1.6 }}>
        Authentication requires the production domain. Open the live app to sign in and test all features.
      </p>
      <a
        href="https://app.writingsprint.site"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: "0.75rem 1.5rem",
          background: "#1A6BC9",
          color: "#fff",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Open app.writingsprint.site
      </a>
    </div>
  );
}

// Offline Electron build: loaded from file:// so no server, no Clerk.
// Uses hash routing (required for file:// URLs) and renders Folio directly.
function OfflineElectronRouter() {
  // Skip the MyFiles home landing page — open straight to the Folio editor.
  // (The landing page has nav buttons that don't work under hash routing.)
  sessionStorage.setItem("mf_skip_home", "1");

  return (
    <ClerkErrorBoundary>
      <ClerkProvider publishableKey={clerkPubKey ?? "pk_test_offline_placeholder"}>
        <DarkModeProvider>
          <SkinProvider>
            <GuestProvider>
              <VillainModeProvider>
                {/* DevTimeoutContext true = all auth guards treat Clerk as timed-out
                    and fall through to the isElectronFileBuild bypass */}
                <DevTimeoutContext.Provider value={true}>
                  <WouterRouter hook={useHashLocation}>
                    <Suspense fallback={<RouteFallback />}>
                      <Switch>
                        <Route path="/my-files" component={MyFiles} />
                        <Route component={() => <Redirect to="/my-files" />} />
                      </Switch>
                    </Suspense>
                  </WouterRouter>
                </DevTimeoutContext.Provider>
              </VillainModeProvider>
            </GuestProvider>
          </SkinProvider>
        </DarkModeProvider>
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
}

function App() {
  if (isElectronFileBuild) return <OfflineElectronRouter />;
  if (!onExpectedDomain) return <WrongDomainScreen />;
  // Production Clerk keys reject non-writingsprint.site origins.
  // In dev/preview, skip Clerk to avoid a fatal load error and show a placeholder.
  if (!isProductionDomain) return <DevPreviewScreen />;
  return (
    <ClerkErrorBoundary>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ClerkErrorBoundary>
  );
}

export default App;
