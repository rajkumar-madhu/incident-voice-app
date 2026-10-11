import { Link } from 'react-router-dom';
import BrandMark from '@/components/marketing/BrandMark';
import LinkedEyeBadge from '@/components/marketing/LinkedEyeBadge';
import VoicePreview from '@/components/marketing/VoicePreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Short line on the left panel (sign-in vs sign-up). */
  panelTagline?: string;
}

export default function AuthShell({
  title,
  description,
  children,
  footer,
  panelTagline = 'Your AI agent answers calls, web voice, and email — then logs every conversation in one place.',
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2 lg:gap-0">
        <aside className="relative hidden flex-col justify-between border-r bg-muted/40 px-10 py-12 lg:flex">
          <BrandMark size="lg" />
          <div className="space-y-8 py-8">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-primary">WeCrew Voice</p>
              <LinkedEyeBadge className="mt-1 block" />
              <h2 className="mt-3 font-serif text-3xl leading-snug tracking-tight">{panelTagline}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Sign up in under a minute. Free tier includes voice minutes, web sessions, and a full dashboard — no card required.
              </p>
            </div>
            <VoicePreview compact />
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </aside>

        <div className="flex flex-col items-center justify-center px-4 py-10">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <Card className="w-full max-w-md border-border/80 shadow-md">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl font-normal tracking-tight">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
          <p className="mt-6 max-w-md text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  );
}
