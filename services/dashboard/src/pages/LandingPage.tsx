import { Link } from 'react-router-dom';
import {
  Headphones,
  Phone,
  Globe,
  Mail,
  Bot,
  BarChart3,
  KeyRound,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const FEATURES = [
  {
    icon: Phone,
    title: 'Phone calls',
    body: 'AI agents answer inbound calls and place outbound ones over your phone numbers.',
  },
  {
    icon: Globe,
    title: 'Web voice',
    body: 'Drop a voice widget on your site so visitors can talk to an agent from the browser.',
  },
  {
    icon: Mail,
    title: 'Email',
    body: 'Agents draft replies to support email and keep the thread with the ticket.',
  },
  {
    icon: Bot,
    title: 'Agents you configure',
    body: 'Set each agent’s voice, prompt and knowledge, and change them without a deploy.',
  },
  {
    icon: BarChart3,
    title: 'Call logs and analytics',
    body: 'Every conversation is logged with its transcript, outcome and duration.',
  },
  {
    icon: KeyRound,
    title: 'API keys per workspace',
    body: 'Each organisation gets its own isolated workspace, users and API keys.',
  },
];

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    blurb: 'To try it out',
    items: ['100 voice minutes / month', '500 web voice sessions / month', '50 email tickets / month', '10 knowledge documents'],
    cta: 'Start free',
    href: '/signup',
    featured: true,
  },
  {
    name: 'Pro',
    price: 'Contact us',
    blurb: 'For production traffic',
    items: ['5,000 voice minutes / month', '10,000 web voice sessions / month', '1,000 email tickets / month', 'Custom voice', 'Email support'],
    cta: 'Talk to us',
    href: 'mailto:hello@wecrew.in?subject=LinkedEye%20Pro',
  },
  {
    name: 'Enterprise',
    price: 'Contact us',
    blurb: 'For regulated teams',
    items: ['Unlimited usage', 'On-premise option', 'Dedicated support'],
    cta: 'Talk to us',
    href: 'mailto:hello@wecrew.in?subject=LinkedEye%20Enterprise',
  },
];

export default function LandingPage() {
  const { token } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <Headphones className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">LinkedEye</span>
          </Link>
          <nav className="flex items-center gap-2">
            <a href="#features" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">
              Features
            </a>
            <a href="#pricing" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">
              Pricing
            </a>
            {token ? (
              <Button asChild>
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Sign up</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-primary">AI voice agents</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Answer every call, chat and email with one AI agent
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            LinkedEye puts voice agents on your phone lines, your website and your support inbox,
            and shows you every conversation in one dashboard.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to={token ? '/dashboard' : '/signup'}>
                {token ? 'Open dashboard' : 'Create a free account'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {!token && (
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">One agent, every channel</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border bg-card p-6">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">Pricing</h2>
            <p className="mt-3 text-center text-muted-foreground">Start free. Move up when your traffic does.</p>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-lg border bg-card p-6 ${plan.featured ? 'border-primary shadow-sm' : ''}`}
                >
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                  <p className="mt-4 text-3xl font-bold">{plan.price}</p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
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
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} WeCrew</span>
          <span>LinkedEye Voice Agent</span>
        </div>
      </footer>
    </div>
  );
}
