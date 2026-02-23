import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="phones">Phone Numbers</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {['Call completed', 'Call failed', 'Usage threshold reached', 'Weekly summary'].map((n) => (
                <div key={n} className="flex items-center justify-between">
                  <span className="text-sm">{n}</span>
                  <input type="checkbox" defaultChecked className="rounded border-input" />
                </div>
              ))}
              <Button>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <AuditLogTab />
        </TabsContent>

        <TabsContent value="phones" className="mt-4">
          <PhoneNumbersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const [name, setName] = useState(String((user as Record<string, unknown>)?.name || ''));
  const [email, setEmail] = useState(String((user as Record<string, unknown>)?.email || ''));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button onClick={() => toast.success('Profile updated')}>Save</Button>
      </CardContent>
    </Card>
  );
}

function TeamTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const users = (data?.data?.users || []) as Array<Record<string, unknown>>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Team Members</CardTitle>
          <Button size="sm">Invite Member</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={String(u.id)} className="border-b">
                  <td className="p-3 font-medium">{String(u.name)}</td>
                  <td className="p-3 text-muted-foreground">{String(u.email)}</td>
                  <td className="p-3"><Badge variant="secondary" className="capitalize">{String(u.role)}</Badge></td>
                  <td className="p-3">
                    <Badge variant={u.is_active ? 'success' : 'destructive'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLogTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Audit Log</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Audit logs track all administrative actions. View recent changes to your organization settings, user management, and API key operations.
        </p>
        <div className="mt-4 text-center text-muted-foreground py-8">
          Audit log viewer will display events from the audit_logs table.
        </div>
      </CardContent>
    </Card>
  );
}

function PhoneNumbersTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['phone-numbers'],
    queryFn: () => api.getPhoneNumbers(),
  });

  const phones = (data?.data?.phoneNumbers || []) as Array<Record<string, unknown>>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Phone Numbers</CardTitle>
          <Button size="sm">Add Number</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : phones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No phone numbers configured</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Number</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Agent</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((p) => (
                <tr key={String(p.id)} className="border-b">
                  <td className="p-3 font-mono">{String(p.phone_number)}</td>
                  <td className="p-3">{String(p.friendly_name || '-')}</td>
                  <td className="p-3 text-muted-foreground">{String((p as Record<string, unknown>).agent_name || 'Unassigned')}</td>
                  <td className="p-3">
                    <Badge variant={p.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                      {String(p.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
