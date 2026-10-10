import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthShell from '@/components/auth/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const MIN_PASSWORD = 8;

export default function SignupPage() {
  const navigate = useNavigate();
  const { token, signup } = useAuth();
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      title="Create your account"
      description="Start on the free plan. No card required."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="organizationName" className="text-sm font-medium">Company</label>
          <Input
            id="organizationName"
            autoComplete="organization"
            placeholder="Acme Support"
            value={form.organizationName}
            onChange={update('organizationName')}
            minLength={2}
            maxLength={100}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">Your name</label>
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
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Work email</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={update('email')}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
