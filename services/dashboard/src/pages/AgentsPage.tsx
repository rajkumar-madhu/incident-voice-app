import { useState } from 'react';
import { Plus, Copy, Trash2, Pencil, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useDuplicateAgent } from '@/hooks/useAgents';
import { formatNumber, formatDuration } from '@/lib/utils';

type AgentRecord = Record<string, unknown>;

export default function AgentsPage() {
  const { data, isLoading } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const duplicateAgent = useDuplicateAgent();
  const [editing, setEditing] = useState<AgentRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const agents = (data?.data?.agents || []) as AgentRecord[];

  const handleCreate = (formData: AgentRecord) => {
    createAgent.mutate(formData, { onSuccess: () => setShowCreate(false) });
  };

  const handleUpdate = (id: string, formData: AgentRecord) => {
    updateAgent.mutate({ id, data: formData }, { onSuccess: () => setEditing(null) });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Agents</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  // Editor view
  if (editing || showCreate) {
    return (
      <AgentEditor
        agent={editing}
        onSave={(d) => editing ? handleUpdate(String(editing.id), d) : handleCreate(d)}
        onCancel={() => { setEditing(null); setShowCreate(false); }}
        saving={createAgent.isPending || updateAgent.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agents</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No agents yet</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>Create your first agent</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={String(agent.id)} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{String(agent.name)}</p>
                      <p className="text-xs text-muted-foreground">{String(agent.model)}</p>
                    </div>
                  </div>
                  <Badge variant={agent.is_active ? 'success' : 'secondary'}>
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {agent.description ? (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{String(agent.description)}</p>
                ) : null}

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div>
                    <p className="text-lg font-semibold">{formatNumber(Number(agent.total_calls) || 0)}</p>
                    <p className="text-xs text-muted-foreground">Calls</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{formatDuration(Number(agent.avg_duration_seconds) || 0)}</p>
                    <p className="text-xs text-muted-foreground">Avg Dur</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{String(agent.language).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">Language</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-4 pt-3 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(agent)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicateAgent.mutate(String(agent.id))}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Delete this agent?')) deleteAgent.mutate(String(agent.id)); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentEditor({
  agent,
  onSave,
  onCancel,
  saving,
}: {
  agent: AgentRecord | null;
  onSave: (data: AgentRecord) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<AgentRecord>({
    name: agent?.name || '',
    description: agent?.description || '',
    system_prompt: agent?.system_prompt || 'You are a helpful voice assistant.',
    model: agent?.model || 'claude-sonnet-4-20250514',
    temperature: agent?.temperature ?? 0.7,
    max_tokens: agent?.max_tokens ?? 1024,
    voice_id: agent?.voice_id || 'default',
    language: agent?.language || 'en',
    greeting_message: agent?.greeting_message || 'Hello! How can I help you today?',
    rag_enabled: agent?.rag_enabled ?? false,
    webhook_url: agent?.webhook_url || '',
    webhook_secret: agent?.webhook_secret || '',
    webhook_events: agent?.webhook_events || ['call.completed', 'call.failed'],
  });

  const update = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{agent ? 'Edit Agent' : 'New Agent'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4 mt-4">
          <Field label="Name">
            <Input value={String(form.name)} onChange={(e) => update('name', e.target.value)} placeholder="My Assistant" />
          </Field>
          <Field label="Description">
            <Input value={String(form.description)} onChange={(e) => update('description', e.target.value)} placeholder="Brief description" />
          </Field>
          <Field label="Language">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={String(form.language)}
              onChange={(e) => update('language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
            </select>
          </Field>
        </TabsContent>

        <TabsContent value="model" className="space-y-4 mt-4">
          <Field label="Model">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={String(form.model)}
              onChange={(e) => update('model', e.target.value)}
            >
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            </select>
          </Field>
          <Field label={`Temperature: ${form.temperature}`}>
            <input
              type="range" min="0" max="2" step="0.1"
              value={Number(form.temperature)}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
              className="w-full"
            />
          </Field>
          <Field label="Max Tokens">
            <Input
              type="number" min={1} max={8192}
              value={String(form.max_tokens)}
              onChange={(e) => update('max_tokens', parseInt(e.target.value))}
            />
          </Field>
          <div className="flex items-center gap-2">
            <input
              type="checkbox" id="rag"
              checked={!!form.rag_enabled}
              onChange={(e) => update('rag_enabled', e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="rag" className="text-sm">Enable RAG (knowledge base)</label>
          </div>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4 mt-4">
          <Field label="Voice ID">
            <Input value={String(form.voice_id)} onChange={(e) => update('voice_id', e.target.value)} />
          </Field>
          <Field label="Greeting Message">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={String(form.greeting_message)}
              onChange={(e) => update('greeting_message', e.target.value)}
            />
          </Field>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4 mt-4">
          <Field label="System Prompt">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[200px] font-mono"
              value={String(form.system_prompt)}
              onChange={(e) => update('system_prompt', e.target.value)}
            />
          </Field>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4 mt-4">
          <Field label="Webhook URL">
            <Input
              value={String(form.webhook_url)}
              onChange={(e) => update('webhook_url', e.target.value)}
              placeholder="https://your-server.com/webhook"
            />
          </Field>
          <Field label="Webhook API Key">
            <Input
              type="password"
              value={String(form.webhook_secret)}
              onChange={(e) => update('webhook_secret', e.target.value)}
              placeholder="API key sent as X-API-Key header"
            />
          </Field>
          <Field label="Webhook Events">
            <div className="space-y-2">
              {['call.completed', 'call.failed', 'call.abandoned'].map((evt) => (
                <label key={evt} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(form.webhook_events as string[] || []).includes(evt)}
                    onChange={(e) => {
                      const current = (form.webhook_events as string[]) || [];
                      update(
                        'webhook_events',
                        e.target.checked
                          ? [...current, evt]
                          : current.filter((v) => v !== evt)
                      );
                    }}
                    className="rounded border-input"
                  />
                  <span className="text-sm font-mono">{evt}</span>
                </label>
              ))}
            </div>
          </Field>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
