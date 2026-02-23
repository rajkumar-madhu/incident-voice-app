import { useState } from 'react';
import { Plus, Copy, Trash2, Key, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type KeyRecord = Record<string, unknown>;

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(true),
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.createApiKey(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Key revoked'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const keys = (data?.data?.apiKeys || []) as KeyRecord[];

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    const result = await createMutation.mutateAsync({ name: newKeyName, scopes: ['read', 'write'] });
    setRevealedKey((result.data as { rawKey: string }).rawKey);
    setNewKeyName('');
    toast.success('API key created');
  };

  const copyKey = () => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Key
        </Button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {revealedKey ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-amber-600">
                  Store this key securely - it will not be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                    {revealedKey}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyKey}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="outline" onClick={() => { setShowCreate(false); setRevealedKey(null); }}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">Key Name</label>
                  <Input
                    placeholder="Production API Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Keys Table */}
      <Card>
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
                  <th className="text-left p-3 font-medium">Key</th>
                  <th className="text-left p-3 font-medium">Scopes</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Last Used</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No API keys yet
                    </td>
                  </tr>
                ) : keys.map((key) => (
                  <tr key={String(key.id)} className="border-b">
                    <td className="p-3 font-medium">{String(key.name)}</td>
                    <td className="p-3 font-mono text-muted-foreground">{String(key.key_prefix)}...****</td>
                    <td className="p-3">
                      {(key.scopes as string[] || []).map((s) => (
                        <Badge key={s} variant="secondary" className="mr-1 text-xs">{s}</Badge>
                      ))}
                    </td>
                    <td className="p-3">
                      <Badge variant={key.is_active ? 'success' : 'destructive'}>
                        {key.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {key.last_used_at ? new Date(String(key.last_used_at)).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(String(key.created_at)).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      {key.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Revoke this key?')) revokeMutation.mutate(String(key.id)); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
