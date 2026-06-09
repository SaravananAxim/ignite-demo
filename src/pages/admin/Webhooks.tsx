import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { Copy, RotateCcw, Webhook } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";

type WebhookSubscription = Tables<"webhook_subscriptions">;
type WebhookDelivery = Tables<"webhook_deliveries">;

const SUPPORTED_EVENTS = [
  "signup.new",
  "signup.ready_for_countersign",
  "signup.completed",
  "signup.payment_completed",
] as const;

const PAGE_SIZE = 50;

export default function WebhooksAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["signup.completed"]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>("all");

  // ── Subscriptions sort + pagination ──────────────────────────────────────
  const {
    sortColumn: subSortCol,
    sortDirection: subSortDir,
    toggleSort: subToggleSort,
    SortIcon: SubSortIcon,
  } = useSort({ defaultColumn: "created_at", defaultDirection: "desc" });

  const { data: subTotalCount = 0 } = useQuery({
    queryKey: ["admin-webhook-subscriptions-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("webhook_subscriptions")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const {
    currentPage: subPage,
    totalPages: subTotalPages,
    pageSize: subPageSize,
    offset: subOffset,
    goToPage: subGoToPage,
  } = usePagination({ totalCount: subTotalCount, pageSize: PAGE_SIZE, resetKey: `${subSortCol}-${subSortDir}` });

  // ── Deliveries sort + pagination ─────────────────────────────────────────
  const {
    sortColumn: delSortCol,
    sortDirection: delSortDir,
    toggleSort: delToggleSort,
    SortIcon: DelSortIcon,
  } = useSort({ defaultColumn: "created_at", defaultDirection: "desc" });

  const { data: delTotalCount = 0 } = useQuery({
    queryKey: ["admin-webhook-deliveries-count", selectedSubscriptionId],
    queryFn: async () => {
      let q = supabase.from("webhook_deliveries").select("*", { count: "exact", head: true });
      if (selectedSubscriptionId !== "all") q = q.eq("webhook_subscription_id", selectedSubscriptionId);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const {
    currentPage: delPage,
    totalPages: delTotalPages,
    pageSize: delPageSize,
    offset: delOffset,
    goToPage: delGoToPage,
  } = usePagination({
    totalCount: delTotalCount,
    pageSize: PAGE_SIZE,
    resetKey: `${delSortCol}-${delSortDir}-${selectedSubscriptionId}`,
  });

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: subscriptions = [], isLoading: isSubscriptionsLoading } = useQuery({
    queryKey: ["admin-webhook-subscriptions", subSortCol, subSortDir, subPage],
    queryFn: async () => {
      const effectiveCol = ["webhook_url", "is_enabled", "created_at"].includes(subSortCol) ? subSortCol : "created_at";
      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .select("id, created_at, webhook_url, webhook_secret, events, is_enabled")
        .order(effectiveCol, { ascending: subSortDir === "asc" })
        .range(subOffset, subOffset + PAGE_SIZE - 1);
      if (error) throw error;
      return data as WebhookSubscription[];
    },
  });

  const { data: deliveries = [], isLoading: isDeliveriesLoading } = useQuery({
    queryKey: ["admin-webhook-deliveries", selectedSubscriptionId, delSortCol, delSortDir, delPage],
    queryFn: async () => {
      const effectiveCol = ["event_name", "status", "response_status", "attempt_number", "created_at"].includes(delSortCol)
        ? delSortCol
        : "created_at";
      let query = supabase
        .from("webhook_deliveries")
        .select("id, created_at, webhook_subscription_id, event_name, status, response_status, delivered_at, error_message, payload, request_headers, response_body, attempt_number, replay_of_delivery_id")
        .order(effectiveCol, { ascending: delSortDir === "asc" })
        .range(delOffset, delOffset + PAGE_SIZE - 1);
      if (selectedSubscriptionId !== "all") {
        query = query.eq("webhook_subscription_id", selectedSubscriptionId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookDelivery[];
    },
  });

  const subscriptionById = useMemo(() => {
    return new Map(subscriptions.map((sub) => [sub.id, sub] as const));
  }, [subscriptions]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("webhook_subscriptions").insert({
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret || null,
        events: selectedEvents,
        is_enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setWebhookUrl("");
      setWebhookSecret("");
      setSelectedEvents(["signup.completed"]);
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-subscriptions-count"] });
      subGoToPage(1);
      toast({ title: "Subscription created", description: "Webhook subscription was saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to create subscription", description: error.message, variant: "destructive" });
    },
  });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const { error } = await supabase.from("webhook_subscriptions").update({ is_enabled: isEnabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-subscriptions"] });
      toast({ title: "Subscription updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update subscription", description: error.message, variant: "destructive" });
    },
  });

  const replayDeliveryMutation = useMutation({
    mutationFn: async (delivery: WebhookDelivery) => {
      const { data, error } = await supabase.functions.invoke("send-signup-webhook", {
        body: { replay_of_delivery_id: delivery.id },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Replay request failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-deliveries"] });
      toast({ title: "Replay sent", description: "A new replay delivery attempt was created and dispatched." });
    },
    onError: (error: Error) => {
      toast({ title: "Replay failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSubscription = () => {
    if (!webhookUrl.trim()) { toast({ title: "Webhook URL is required", variant: "destructive" }); return; }
    if (selectedEvents.length === 0) { toast({ title: "Select at least one event", variant: "destructive" }); return; }
    createSubscriptionMutation.mutate();
  };

  const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">Manage centralized outbound webhook subscriptions and delivery history.</p>
        </div>

        <Tabs defaultValue="subscriptions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="history">Delivery History</TabsTrigger>
          </TabsList>

          {/* ── Subscriptions tab ──────────────────────────────────────── */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Create subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input id="webhook-url" placeholder="https://example.com/webhooks/signup" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook secret (optional)</Label>
                  <Input id="webhook-secret" type="password" placeholder="Used for HMAC signature" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {SUPPORTED_EVENTS.map((eventName) => {
                      const checked = selectedEvents.includes(eventName);
                      return (
                        <label key={eventName} className="flex items-center gap-2 rounded border p-3 text-sm">
                          <Checkbox checked={checked} onCheckedChange={(nextChecked) => {
                            setSelectedEvents((current) =>
                              nextChecked ? [...new Set([...current, eventName])] : current.filter((e) => e !== eventName)
                            );
                          }} />
                          <span>{eventName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={handleCreateSubscription} disabled={createSubscriptionMutation.isPending}>
                  Save subscription
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {isSubscriptionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading subscriptions…</p>
                ) : subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subscriptions configured yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => subToggleSort("webhook_url")}>
                              <div className="flex items-center gap-1">URL <SubSortIcon column="webhook_url" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => subToggleSort("is_enabled")}>
                              <div className="flex items-center gap-1">Enabled <SubSortIcon column="is_enabled" /></div>
                            </TableHead>
                            <TableHead>Events</TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => subToggleSort("created_at")}>
                              <div className="flex items-center gap-1">Created <SubSortIcon column="created_at" /></div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subscriptions.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell>
                                <p className="font-medium break-all text-sm">{sub.webhook_url}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">ID: {sub.id}</p>
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={sub.is_enabled}
                                  onCheckedChange={(checked) =>
                                    toggleSubscriptionMutation.mutate({ id: sub.id, isEnabled: checked })
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {sub.events.map((e) => (
                                    <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(sub.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PaginationControls
                      currentPage={subPage}
                      totalPages={subTotalPages}
                      totalCount={subTotalCount}
                      pageSize={subPageSize}
                      onPageChange={subGoToPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Delivery History tab ────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="subscription-filter">Subscription filter</Label>
                  <select
                    id="subscription-filter"
                    value={selectedSubscriptionId}
                    onChange={(e) => { setSelectedSubscriptionId(e.target.value); delGoToPage(1); }}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="all">All subscriptions</option>
                    {subscriptions.map((sub) => (
                      <option value={sub.id} key={sub.id}>{sub.webhook_url}</option>
                    ))}
                  </select>
                </div>

                <Separator />

                {isDeliveriesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading delivery history…</p>
                ) : deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deliveries found.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => delToggleSort("event_name")}>
                              <div className="flex items-center gap-1">Event <DelSortIcon column="event_name" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => delToggleSort("status")}>
                              <div className="flex items-center gap-1">Status <DelSortIcon column="status" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => delToggleSort("response_status")}>
                              <div className="flex items-center gap-1">Response <DelSortIcon column="response_status" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => delToggleSort("attempt_number")}>
                              <div className="flex items-center gap-1">Attempt <DelSortIcon column="attempt_number" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => delToggleSort("created_at")}>
                              <div className="flex items-center gap-1">Created <DelSortIcon column="created_at" /></div>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliveries.map((delivery) => {
                            const sub = subscriptionById.get(delivery.webhook_subscription_id);
                            return (
                              <TableRow key={delivery.id}>
                                <TableCell>
                                  <Badge variant="outline">{delivery.event_name}</Badge>
                                  {delivery.error_message && (
                                    <p className="text-xs text-destructive mt-1 max-w-[200px] truncate">
                                      {delivery.error_message}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                                    {sub?.webhook_url || delivery.webhook_subscription_id}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={delivery.status === "delivered" ? "default" : "secondary"}>
                                    {delivery.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {delivery.response_status ? `HTTP ${delivery.response_status}` : "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  #{delivery.attempt_number}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  <div>{new Date(delivery.created_at).toLocaleDateString()}</div>
                                  <div className="text-xs">{new Date(delivery.created_at).toLocaleTimeString()}</div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button size="sm" variant="outline">Details</Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-3xl">
                                        <DialogHeader>
                                          <DialogTitle>Delivery details</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="max-h-[70vh] pr-4">
                                          <div className="space-y-4">
                                            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{formatJson(delivery.payload)}</pre>
                                            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{formatJson(delivery.request_headers)}</pre>
                                            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{delivery.response_body || "(empty)"}</pre>
                                          </div>
                                        </ScrollArea>
                                      </DialogContent>
                                    </Dialog>
                                    <Button size="sm" variant="secondary" onClick={() => replayDeliveryMutation.mutate(delivery)} disabled={replayDeliveryMutation.isPending}>
                                      <RotateCcw className="mr-1 h-4 w-4" />Replay
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={async () => {
                                      await navigator.clipboard.writeText(delivery.id);
                                      toast({ title: "Copied delivery id" });
                                    }}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <PaginationControls
                      currentPage={delPage}
                      totalPages={delTotalPages}
                      totalCount={delTotalCount}
                      pageSize={delPageSize}
                      onPageChange={delGoToPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
