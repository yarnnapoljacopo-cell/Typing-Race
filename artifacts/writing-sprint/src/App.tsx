// eslint-disable-next-line no-console
console.log("[clerk-key] VITE_CLERK_PK =", import.meta.env.VITE_CLERK_PK, "| VITE_CLERK_PUBLISHABLE_KEY =", import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

import { useEffect, useRef, useState, Component } from "react";
import type { ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth, ClerkLoading, ClerkLoaded } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Portal from "@/pages/Portal";
import Room from "@/pages/Room";
import MyFiles from "@/pages/MyFiles";
import Profile from "@/pages/Profile";
import Friends from "@/pages/Friends";
import GlobalRanking from "@/pages/GlobalRanking";
import OfflineSprint from "@/pages/OfflineSprint";
import { GuestProvider, useGuest } from "@/lib/guestContext";
import { VillainModeProvider } from "@/lib/villainModeContext";
import { SkinProvider } from "@/lib/skinContext";

const queryClient = new QueryClient();

// ── Clerk error boundary ────────────────────────────────────────────────────

const LIVE_URL = "https://app.writingsprint.site";

class ClerkErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
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
    return this.props.children;
  }
}

const clerkPubKey = import.meta.env.VITE_CLERK_PK as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// In development builds (NODE_ENV=development), skip the domain restriction so
// the dev Railway service works on any domain (e.g. *.up.railway.app or dev.writingsprint.site).
// In production builds this stays false for non-writingsprint.site origins and
// shows the "wrong domain" screen instead of a broken Clerk state.
const isProductionDomain =
  import.meta.env.DEV ||
  window.location.hostname === "app.writingsprint.site" ||
  window.location.hostname === "writingsprint.site" ||
  window.location.hostname.endsWith(".writingsprint.site");

// Route Clerk FAPI through the server-side proxy on production so cookies are
// always set for app.writingsprint.site regardless of clerk.writingsprint.site DNS.
// VITE_CLERK_PROXY_URL should be set to "https://app.writingsprint.site/api/__clerk"
// in the Railway environment variables.
const clerkProxyUrl = isProductionDomain
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

  if (!isLoaded) return null;

  // In the desktop app, go straight to offline sprint if there's no connection
  if (!!(window as any).electronAPI && !navigator.onLine) {
    return <Redirect to="/offline-sprint" />;
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

function AuthDiagnostic() {
  const { isSignedIn, isLoaded, userId, sessionId } = useAuth();
  const { guestName } = useGuest();
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  function runDebug() {
    setLoading(true);
    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${apiBase}/api/debug-clerk-client`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setDebugData(d); setLoading(false); })
      .catch((e) => { setDebugData({ error: String(e) }); setLoading(false); });
  }

  useEffect(() => { if (isLoaded) runDebug(); }, [isLoaded]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-xl font-bold">Auth Diagnostic</h1>
        <div className="rounded-lg border bg-card p-4 font-mono text-sm space-y-1">
          <div><span className="text-muted-foreground">VITE_CLERK_PK (env var):</span> {(import.meta.env.VITE_CLERK_PK as string)?.substring(0, 40) ?? "(not set)"}</div>
          <div><span className="text-muted-foreground">VITE_CLERK_PUBLISHABLE_KEY (secret):</span> {(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string)?.substring(0, 40) ?? "(not set)"}</div>
          <div><span className="text-muted-foreground">active key:</span> {clerkPubKey?.substring(0, 40) ?? "(not set)"}</div>
          <div><span className="text-muted-foreground">isLoaded:</span> {String(isLoaded)}</div>
          <div><span className="text-muted-foreground">isSignedIn:</span> <span className={isSignedIn ? "text-green-600" : "text-red-500"}>{String(isSignedIn)}</span></div>
          <div><span className="text-muted-foreground">userId:</span> {userId ?? "null"}</div>
          <div><span className="text-muted-foreground">sessionId:</span> {sessionId ?? "null"}</div>
          <div><span className="text-muted-foreground">guestName:</span> {guestName ?? "null"}</div>
        </div>

        {debugData && (
          <div className="rounded-lg border bg-card p-4 font-mono text-xs space-y-2 overflow-auto max-h-[32rem]">
            <div className="font-bold text-sm mb-2">Server → Clerk FAPI Diagnostic</div>

            {/* FAPI routing */}
            <div className="text-muted-foreground font-semibold">FAPI Routing</div>
            <div><span className="text-muted-foreground">proxyTarget (hardcoded):</span> {String(debugData.proxyTarget)}</div>
            <div><span className="text-muted-foreground">fapiUrlFromKey:</span> {String(debugData.fapiUrlFromKey)}</div>
            <div><span className="text-muted-foreground">keysMatch:</span> <span className={(debugData.keysMatch as boolean) ? "text-green-600" : "text-red-500 font-bold"}>{String(debugData.keysMatch)}</span></div>

            {/* Cookie summary */}
            <div className="text-muted-foreground font-semibold mt-2">Cookies</div>
            <div><span className="text-muted-foreground">clientCookieCount:</span> {String(debugData.clientCookieCount)}</div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(debugData.cookieNames, null, 2)}</pre>

            {/* Per-cookie FAPI results */}
            {Array.isArray(debugData.perCookieResults) && (debugData.perCookieResults as Record<string,unknown>[]).map((r, i) => (
              <div key={i} className="border rounded p-2 mt-2 space-y-1">
                <div className="font-semibold">__client cookie #{i}</div>
                <div><span className="text-muted-foreground">jwtPrefix:</span> {String(r.jwtPrefix)}…</div>
                {r.viaHardcodedFapi && (
                  <div>
                    <div className="text-muted-foreground">via hardcoded FAPI:</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(r.viaHardcodedFapi, null, 2)}</pre>
                  </div>
                )}
                {r.viaKeyFapi && (
                  <div>
                    <div className="text-muted-foreground">via key FAPI:</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(r.viaKeyFapi, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Fetching Clerk FAPI state…</p>}

        <div className="flex gap-2">
          <button
            className="flex-1 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={runDebug}
          >
            Re-query Clerk FAPI
          </button>
          <button
            className="flex-1 rounded border px-4 py-2 text-sm"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Also open DevTools → Application → Cookies → app.writingsprint.site and note how many <code>__client</code> cookies appear and what their Domain values are.
        </p>
      </div>
    </div>
  );
}

function PortalGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const { guestName } = useGuest();

  if (!isLoaded) return <AuthLoading />;
  if (isSignedIn || guestName) return <Portal />;
  return <Redirect to="/" />;
}

function RoomGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const { guestName } = useGuest();

  if (!isLoaded) return null;
  if (isSignedIn || guestName) return <Room />;
  return <Redirect to="/" />;
}

function MyFilesGuard() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <MyFiles />;
  return <Redirect to="/" />;
}

function FriendsGuard() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <Friends />;
  return <Redirect to="/" />;
}

function GlobalRankingGuard() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <GlobalRanking />;
  return <Redirect to="/" />;
}

// ── Cache invalidator ──────────────────────────────────────────────────────

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) return <MissingKeyScreen />;

  return (
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
      {/* Show a visible loading screen while Clerk initialises.
          Without this, ClerkProvider renders nothing during init and the
          page appears blank — especially noticeable when the Clerk FAPI
          proxy is slow or unreachable. */}
      <ClerkLoading>
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
          <p style={{ margin: 0, color: "#68708A", fontSize: "0.95rem" }}>Loading Writing Sprint…</p>
        </div>
      </ClerkLoading>
      <ClerkLoaded>
      <QueryClientProvider client={queryClient}>
        <GuestProvider>
          <SkinProvider>
          <VillainModeProvider>
          <ClerkQueryClientCacheInvalidator />
          <TooltipProvider>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/portal" component={PortalGuard} />
              <Route path="/room" component={RoomGuard} />
              <Route path="/my-files" component={MyFilesGuard} />
              <Route path="/friends" component={FriendsGuard} />
              <Route path="/global-ranking" component={GlobalRankingGuard} />
              <Route path="/profile/:name" component={Profile} />
              <Route path="/offline-sprint" component={OfflineSprint} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route component={NotFound} />
            </Switch>
            <Toaster />
          </TooltipProvider>
          </VillainModeProvider>
          </SkinProvider>
        </GuestProvider>
      </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
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

function App() {
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
