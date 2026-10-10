import { Link } from 'react-router-dom';
import { Headphones } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export default function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-6">
        <Headphones className="h-8 w-8 text-primary" />
        <span className="font-bold text-2xl">LinkedEye</span>
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}
