import { Link } from 'react-router-dom';
import {
  Phone,
  Globe,
  Mail,
  Bot,
  BarChart3,
  KeyRound,
  Check,
  ArrowRight,
  Plug,
  SlidersHorizontal,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandMark from '@/components/marketing/BrandMark';
import HeroMedia from '@/components/marketing/HeroMedia';
import LinkedEyeBadge from '@/components/marketing/LinkedEyeBadge';
import { useAuth } from '@/hooks/useAuth';

const FEATURES = [
  {
    icon: Phone,
    title: 'Phone',
    body: 'AI answers inbound and places outbound calls on your numbers.',
  },
  {
    icon: Globe,
    title: 'Web voice',
    body: 'Embed voice on your site so visitors talk to an agent in the browser.',
  },
  {
    icon: Mail,
    title: 'Email',
    body: 'Agents draft replies and stay aligned with your ticket queue.',
  },
  {
    icon: Bot,
    title: 'Configurable agents',
    body: 'Voice, prompt, and knowledge — change anytime, no redeploy.',
  },
  {
    icon: BarChart3,
    title: 'Logs & analytics',
    body: 'Transcripts, outcomes, and duration for every conversation.',
  },
  {
    icon: KeyRound,
    title: 'Isolated workspaces',
    body: 'Per-org users, billing, and API keys — multi-tenant by default.',
  },
];

const STEPS = [
  { icon: Plug, title: 'Connect', body: 'Add a phone line, web widget, or inbox in settings.' },
  { icon: SlidersHorizontal, title: 'Configure', body: 'Set the agent voice, prompt, and knowledge base.' },
  { icon: Rocket, title: 'Go live', body: 'Calls and chats flow in; your dashboard updates in real time.' },
];

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    blurb: 'Try the full product',
    items: ['100 voice minutes / month', '500 web voice sessions / month', '50 email tickets / month', '10 knowledge documents'],
    cta: 'Start free',
    href: '/signup',
    featured: true,
  },
  {
    name: 'Pro',
    price: 'Contact us',
    blurb: 'Production traffic',
    items: ['5,000 voice minutes / month', '10,000 web voice sessions / month', '1,000 email tickets / month', 'Custom voice', 'Email support'],
    cta: 'Talk to us',
    href: 'mailto:hello@wecrew.in?subject=WeCrew%20Voice%20Pro',
  },
  {
    name: 'Enterprise',
    price: 'Contact us',
    blurb: 'Regulated & large teams',
    items: ['Unlimited usage', 'On-premise option', 'Dedicated support'],
    cta: 'Talk to us',
    href: 'mailto:hello@wecrew.in?subject=WeCrew%20Voice%20Enterprise',
  },
];

export default function LandingPage() {
  const { token } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <BrandMark linkHome />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">
              How it works
            </a>
            <a href="#features" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">
              Features
            </a>
            <a href="#pricing" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground md:block">
              Pricing
            </a>
            {token ? (
              <Button asChild size="sm" className="ml-1">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" asChild className="bg-[hsl(var(--wecrew-coral))] text-white hover:bg-[hsl(var(--wecrew-coral)/0.9)]">
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div className="relative text-center lg:text-left">
              <p className="mb-4 inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                AI voice for ops & support teams
              </p>
              <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl lg:text-[2.75rem]">
                One agent for{' '}
                <span className="text-primary">phone</span>,{' '}
                <span className="text-[hsl(var(--wecrew-coral))]">web</span>, and{' '}
                <span className="text-[hsl(var(--wecrew-green))]">email</span>
              </h1>
              <LinkedEyeBadge className="mt-2 inline-block lg:mx-0 mx-auto" />
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                WeCrew Voice handles customer conversations on every channel, then shows transcripts, actions, and analytics in one dashboard.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link to={token ? '/dashboard' : '/signup'}>
                    {token ? 'Open dashboard' : 'Create free workspace'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {!token && (
                  <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                    <Link to="/login">I already have an account</Link>
                  </Button>
                )}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">No credit card · Free tier · Setup in minutes</p>
            </div>
            <div className="relative lg:pl-4">
              <HeroMedia />
            </div>
          </div>
        </section>

        <section className="border-b bg-muted/20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-20">
            <div>
              <h2 className="font-serif text-3xl tracking-tight">See every conversation in one place</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Call logs, transcripts, and outcomes roll up into a single workspace — the same view your team uses after sign-in.
              </p>
            </div>
            <figure className="overflow-hidden rounded-xl border bg-card shadow-lg">
              <img
                src="/product-dashboard.svg"
                alt="WeCrew Voice dashboard showing call logs and conversation history"
                width={800}
                height={480}
                loading="lazy"
                decoding="async"
                className="w-full h-auto"
              />
            </figure>
          </div>
        </section>

        <section id="how" className="border-b bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-center font-serif text-3xl tracking-tight">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Three steps from signup to your first handled call.
            </p>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-primary shadow-sm">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="mt-4 block text-xs font-semibold uppercase tracking-wider text-primary">
                    Step {i + 1}
                  </span>
                  <h3 className="mt-2 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
            {!token && (
              <div className="mt-12 text-center">
                <Button asChild variant="secondary">
                  <Link to="/signup">Start with step 1 — create workspace</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <section id="features" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-center font-serif text-3xl tracking-tight">Every channel, one workspace</h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-center font-serif text-3xl tracking-tight">Pricing</h2>
            <p className="mt-3 text-center text-muted-foreground">Start free. Scale when traffic grows.</p>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-xl border bg-card p-6 ${plan.featured ? 'border-primary ring-1 ring-primary/20 shadow-lg' : ''}`}
                >
                  {plan.featured && (
                    <span className="mb-3 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                  <p className="mt-4 font-serif text-3xl">{plan.price}</p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="h-4 w-4 shrink-0 text-[hsl(var(--wecrew-green))]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-8" variant={plan.featured ? 'default' : 'outline'} asChild>
                    {plan.href.startsWith('/') ? (
                      <Link to={plan.href}>{plan.cta}</Link>
                    ) : (
                      <a href={plan.href}>{plan.cta}</a>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} WeCrew</span>
          <span className="font-medium text-foreground/80">
            WeCrew Voice · Powered by LinkedEye · ai.voice.wecrew.in
          </span>
        </div>
      </footer>
    </div>
  );
}
