import { useEffect, useRef, Component } from "react";
import type { ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth } from "@clerk/react";
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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Only use the proxy URL if it's a fully-qualified URL — an empty or
// partial value causes Clerk to build a broken script URL like https:///npm/...
const rawProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const clerkProxyUrl =
  rawProxyUrl && rawProxyUrl.startsWith("https://") && rawProxyUrl.length > 10
    ? rawProxyUrl
    : undefined;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

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
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
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

function PortalGuard() {
  const { isSignedIn, isLoaded } = useAuth();
  const { guestName } = useGuest();

  if (!isLoaded) return null;
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
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
    </ClerkProvider>
  );
}

// Detect domain mismatch before rendering Clerk — async Clerk errors aren't
// catchable by error boundaries, so we prevent rendering Clerk entirely when
// we know it will fail.
const expectedHosts = ["app.writingsprint.site", "writingsprint.site"];
const onExpectedDomain =
  !clerkProxyUrl ||
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

function App() {
  if (!onExpectedDomain) return <WrongDomainScreen />;
  return (
    <ClerkErrorBoundary>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ClerkErrorBoundary>
  );
}

export default App;
