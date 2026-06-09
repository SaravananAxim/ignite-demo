import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Plus, KeyRound, Copy, Check, AlertTriangle, Loader2, BookOpen } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { activityLogger } from '@/lib/activityLogger';

const BASE_URL = 'https://omeadibwcokbxlwhhlqt.supabase.co/functions/v1/catalog';

function CopyableCode({ code, className = '' }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  return (
    <div className={`relative group ${className}`}>
      <pre className="overflow-x-auto rounded-md bg-zinc-950 px-4 py-3 text-xs text-zinc-100 leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

const ENDPOINTS = [
  { method: 'GET',  path: '/skus',           desc: 'List all SKUs (filterable)',             auth: 'Read' },
  { method: 'GET',  path: '/skus/:id',        desc: 'Single SKU',                             auth: 'Read' },
  { method: 'GET',  path: '/products',        desc: 'List all Products with SKUs',            auth: 'Read' },
  { method: 'GET',  path: '/products/:id',    desc: 'Single Product + SKUs',                  auth: 'Read' },
  { method: 'PUT',  path: '/products/:id',    desc: 'Update Product pricing/fields',          auth: 'Write' },
  { method: 'GET',  path: '/packages',        desc: 'List all Packages with Products',        auth: 'Read' },
  { method: 'GET',  path: '/packages/:id',    desc: 'Single Package + Products + SKUs',       auth: 'Read' },
  { method: 'POST', path: '/packages',        desc: 'Create a new Package',                   auth: 'Write' },
  { method: 'PUT',  path: '/packages/:id',    desc: 'Update Package pricing/composition',     auth: 'Write' },
  { method: 'GET',  path: '/programs',        desc: 'List all Programs with Packages',        auth: 'Read' },
  { method: 'GET',  path: '/programs/:id',    desc: 'Single Program + Packages',              auth: 'Read' },
  { method: 'PUT',  path: '/programs/:id',    desc: 'Update Program pricing/fields',          auth: 'Write' },
] as const;

function methodBadge(method: string) {
  if (method === 'GET')
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-mono text-xs">{method}</Badge>;
  if (method === 'POST')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 font-mono text-xs">{method}</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 font-mono text-xs">{method}</Badge>;
}

const EXAMPLE_FETCH = `curl -X GET \\
  ${BASE_URL}/packages \\
  -H "X-API-Key: your_api_key"`;

const EXAMPLE_UPDATE = `curl -X PUT \\
  ${BASE_URL}/packages/PKG-SEO-01 \\
  -H "X-API-Key: your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"monthly_price": 799, "one_time_price": 500}'`;

const EXAMPLE_CREATE = `curl -X POST \\
  ${BASE_URL}/packages \\
  -H "X-API-Key: your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "package_id": "PKG-CUSTOM-01",
    "name": "Custom Growth Package",
    "product_line": "Paid Media",
    "tier": "Better",
    "monthly_price": 1200,
    "product_ids": ["<product-uuid>"],
    "sku_ids": ["<sku-uuid>"]
  }'`;

const RESPONSE_SUCCESS = `{
  "data": <payload>,
  "meta": { "count": 18, "timestamp": "2026-06-05T..." }
}`;

const RESPONSE_ERROR = `{
  "error": "Description of what went wrong",
  "code": 401
}`;

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeys() {
  const queryClient = useQueryClient();

  // Generate modal
  const [generateOpen, setGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [writePermission, setWritePermission] = useState(false);

  // Copy modal (non-dismissable)
  const [copyOpen, setCopyOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ApiKey[];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({
      name,
      permissions,
    }: {
      name: string;
      permissions: string[];
    }) => {
      // 1. Generate cryptographically random key
      const raw =
        'sk_live_' +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      // 2. Hash it
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(raw),
      );
      const hexHash = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // 3. Insert into api_keys
      const { data: created, error } = await supabase
        .from('api_keys')
        .insert({
          name,
          key_prefix: raw.slice(0, 12),
          key_hash: hexHash,
          permissions,
          is_active: true,
        })
        .select('id, name')
        .single();

      if (error) throw error;
      return { raw, created };
    },
    onSuccess: async ({ raw, created }) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      if (created) {
        await activityLogger.logActivity('api_key_created', 'api_key', created.id, {
          name: created.name,
        });
      }
      // Close generate modal, open copy modal
      setGenerateOpen(false);
      setKeyName('');
      setWritePermission(false);
      setGeneratedKey(raw);
      setCopied(false);
      setCopyOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      await activityLogger.logActivity('api_key_revoked', 'api_key', id, {});
      toast.success('API key revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error('Key name is required');
      return;
    }
    const permissions = ['read'];
    if (writePermission) permissions.push('write');
    generateMutation.mutate({ name: keyName.trim(), permissions });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
    } catch {
      toast.error('Failed to copy — please select and copy manually');
    }
  };

  const handleCopyModalClose = () => {
    setCopyOpen(false);
    setCopied(false);
    setGeneratedKey('');
  };

  const formatLastUsed = (lastUsedAt: string | null) => {
    if (!lastUsedAt) return 'Never';
    return formatDistanceToNow(new Date(lastUsedAt), { addSuffix: true });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">API Keys</h1>
            <p className="mt-1 text-muted-foreground">
              Manage external API access for ProposalOS and other integrations
            </p>
          </div>
          <Button
            className="w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => setGenerateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Generate Key
          </Button>
        </div>

        {/* Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" />
              All API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No API keys yet. Generate your first key to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Name</TableHead>
                      <TableHead className="min-w-[140px]">Key Prefix</TableHead>
                      <TableHead className="min-w-[120px]">Permissions</TableHead>
                      <TableHead className="min-w-[140px]">Last Used</TableHead>
                      <TableHead className="min-w-[110px]">Created</TableHead>
                      <TableHead className="min-w-[90px]">Status</TableHead>
                      <TableHead className="min-w-[90px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <p className="font-medium">{key.name}</p>
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            {key.key_prefix}…
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(key.permissions ?? []).map((p) => (
                              <Badge
                                key={p}
                                variant={p === 'write' ? 'default' : 'secondary'}
                                className="capitalize text-xs"
                              >
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastUsed(key.last_used_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(key.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {key.is_active ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Revoked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {key.is_active && (
                            <ConfirmDeleteDialog
                              title="Revoke API Key"
                              description="Revoke this key? Any system using it will immediately lose access."
                              onConfirm={() => revokeMutation.mutate(key.id)}
                              isLoading={revokeMutation.isPending}
                              trigger={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  Revoke
                                </Button>
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── API Documentation ──────────────────────────────────────── */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              API Documentation
            </CardTitle>
            <CardDescription>How to integrate with the Catalog API</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={['auth', 'baseurl', 'endpoints', 'examples']}>

              {/* 1. Authentication */}
              <AccordionItem value="auth">
                <AccordionTrigger className="text-sm font-semibold">Authentication</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1">
                  <p className="text-sm text-muted-foreground">
                    Every request must include the following header:
                  </p>
                  <CopyableCode code="X-API-Key: your_api_key" />
                  <p className="text-xs text-muted-foreground">
                    Keys with read-only permissions cannot use POST or PUT endpoints.
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* 2. Base URL */}
              <AccordionItem value="baseurl">
                <AccordionTrigger className="text-sm font-semibold">Base URL</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-1">
                  <p className="text-sm text-muted-foreground">
                    Prepend this base URL to all endpoint paths below:
                  </p>
                  <CopyableCode code={BASE_URL} />
                </AccordionContent>
              </AccordionItem>

              {/* 3. Endpoints */}
              <AccordionItem value="endpoints">
                <AccordionTrigger className="text-sm font-semibold">Endpoints</AccordionTrigger>
                <AccordionContent className="pt-1">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[640px] text-sm">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[72px]">Method</TableHead>
                          <TableHead className="w-[200px]">Path</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[60px]">Auth</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ENDPOINTS.map((ep, i) => (
                          <TableRow key={i}>
                            <TableCell>{methodBadge(ep.method)}</TableCell>
                            <TableCell>
                              <code className="font-mono text-xs text-foreground">{ep.path}</code>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{ep.desc}</TableCell>
                            <TableCell>
                              <Badge variant={ep.auth === 'Write' ? 'default' : 'secondary'} className="text-xs">
                                {ep.auth}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 4. Example Requests */}
              <AccordionItem value="examples" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold">Example Requests</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-1">
                  <Tabs defaultValue="fetch">
                    <TabsList>
                      <TabsTrigger value="fetch">Fetch Packages</TabsTrigger>
                      <TabsTrigger value="update">Update Pricing</TabsTrigger>
                      <TabsTrigger value="create">Create Package</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fetch" className="mt-3">
                      <CopyableCode code={EXAMPLE_FETCH} />
                    </TabsContent>
                    <TabsContent value="update" className="mt-3">
                      <CopyableCode code={EXAMPLE_UPDATE} />
                    </TabsContent>
                    <TabsContent value="create" className="mt-3">
                      <CopyableCode code={EXAMPLE_CREATE} />
                    </TabsContent>
                  </Tabs>

                  {/* Response format note */}
                  <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      All responses return JSON in the format:
                    </p>
                    <CopyableCode code={RESPONSE_SUCCESS} />
                    <p className="text-xs font-medium text-muted-foreground pt-1">Error responses:</p>
                    <CopyableCode code={RESPONSE_ERROR} />
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* ── Generate Key Modal ─────────────────────────────────────────── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key-name"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. ProposalOS Production"
              />
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="perm-read" checked disabled />
                  <Label htmlFor="perm-read" className="cursor-not-allowed text-muted-foreground">
                    Read <span className="text-xs">(always enabled)</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="perm-write"
                    checked={writePermission}
                    onCheckedChange={(v) => setWritePermission(!!v)}
                  />
                  <Label htmlFor="perm-write" className="cursor-pointer">
                    Write
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenerateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Generate'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Copy Key Modal (non-dismissable) ──────────────────────────── */}
      <Dialog
        open={copyOpen}
        onOpenChange={(open) => {
          // Prevent all automatic closes — only "I've copied my key" closes this
          if (!open) return;
          setCopyOpen(open);
        }}
      >
        <DialogContent
          className="max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Copy your API key</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="font-medium">
                This key will never be shown again. Copy it now before closing.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Your API key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs leading-relaxed break-all">
                  {generatedKey}
                </code>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-green-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to clipboard
                </>
              )}
            </Button>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={handleCopyModalClose}
              className="w-full"
            >
              I've copied my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
