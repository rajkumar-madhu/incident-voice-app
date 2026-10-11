import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthShell from '@/components/auth/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const MIN_PASSWORD = 8;
const STEPS = ['Workspace', 'Account'] as const;

export default function SignupPage() {
  const navigate = useNavigate();
  const { token, signup } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const stepOneValid =
    form.organizationName.trim().length >= 2 && form.name.trim().length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0) {
      if (stepOneValid) setStep(1);
      return;
    }
    setLoading(true);
    try {
      await signup(form);
      toast.success('Your workspace is ready');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === 0 ? 'Start your workspace' : 'Secure your account'}
      description={
        step === 0
          ? 'Tell us who you are — we’ll create an isolated org for your team.'
          : 'Use your work email. You’ll land in the dashboard right after this.'
      }
      panelTagline="Spin up an AI voice agent for phone, web, and email in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-xs font-medium ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 0 ? (
          <>
            <div className="space-y-2">
              <label htmlFor="organizationName" className="text-sm font-medium">
                Company or team name
              </label>
              <Input
                id="organizationName"
                autoComplete="organization"
                placeholder="WeCrew Labs"
                value={form.organizationName}
                onChange={update('organizationName')}
                minLength={2}
                maxLength={100}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Shown in your dashboard and on invoices.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Your name
              </label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Asha Rao"
                value={form.name}
                onChange={update('name')}
                minLength={2}
                maxLength={100}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!stepOneValid}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Workspace: </span>
              <span className="font-medium">{form.organizationName}</span>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Work email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={update('email')}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={`At least ${MIN_PASSWORD} characters`}
                value={form.password}
                onChange={update('password')}
                minLength={MIN_PASSWORD}
                maxLength={128}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setStep(0)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating workspace…' : 'Create workspace'}
              </Button>
            </div>
          </>
        )}
      </form>
    </AuthShell>
  );
}
