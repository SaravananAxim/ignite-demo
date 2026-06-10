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
import { Copy, RotateCcw, Webhook } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type WebhookSubscription = Tables<"webhook_subscriptions">;
type WebhookDelivery = Tables<"webhook_deliveries">;

const SUPPORTED_EVENTS = [
  "signup.new",
  "signup.ready_for_countersign",
  "signup.completed",
  "signup.payment_completed",
] as const;

export default function WebhooksAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["signup.completed"]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>("all");

  const { data: subscriptions = [], isLoading: isSubscriptionsLoading } = useQuery({
    queryKey: ["admin-webhook-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_subscriptions")
        .select("id, created_at, webhook_url, webhook_secret, events, is_enabled")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WebhookSubscription[];
    },
  });

  const { data: deliveries = [], isLoading: isDeliveriesLoading } = useQuery({
    queryKey: ["admin-webhook-deliveries", selectedSubscriptionId],
    queryFn: async () => {
      let query = supabase
        .from("webhook_deliveries")
        .select("id, created_at, webhook_subscription_id, event_name, status, response_status, delivered_at, error_message, payload, request_headers, response_body, attempt_number, replay_of_delivery_id")
        .order("created_at", { ascending: false })
        .limit(100);

      if (selectedSubscriptionId !== "all") {
        query = query.eq("webhook_subscription_id", selectedSubscriptionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookDelivery[];
    },
  });

  const subscriptionById = useMemo(() => {
    const entries = subscriptions.map((sub) => [sub.id, sub] as const);
    return new Map(entries);
  }, [subscriptions]);

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
      toast({ title: "Subscription created", description: "Webhook subscription was saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to create subscription", description: error.message, variant: "destructive" });
    },
  });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from("webhook_subscriptions")
        .update({ is_enabled: isEnabled })
        .eq("id", id);

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
        body: {
          replay_of_delivery_id: delivery.id,
        },
      });

      if (error) throw error;

      if (data?.success === false) {
        throw new Error(data?.error || "Replay request failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-deliveries"] });
      toast({
        title: "Replay sent",
        description: "A new replay delivery attempt was created and dispatched.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Replay failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSubscription = () => {
    if (!webhookUrl.trim()) {
      toast({ title: "Webhook URL is required", variant: "destructive" });
      return;
    }

    if (selectedEvents.length === 0) {
      toast({ title: "Select at least one event", variant: "destructive" });
      return;
    }

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
                  <Input
                    id="webhook-url"
                    placeholder="https://example.com/webhooks/signup"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook secret (optional)</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    placeholder="Used for HMAC signature"
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {SUPPORTED_EVENTS.map((eventName) => {
                      const checked = selectedEvents.includes(eventName);
                      return (
                        <label key={eventName} className="flex items-center gap-2 rounded border p-3 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              setSelectedEvents((current) => {
                                if (nextChecked) {
                                  return [...new Set([...current, eventName])];
                                }

                                return current.filter((entry) => entry !== eventName);
                              });
                            }}
                          />
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
                  <div className="space-y-3">
                    {subscriptions.map((subscription) => (
                      <div key={subscription.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-medium break-all">{subscription.webhook_url}</p>
                            <p className="text-xs text-muted-foreground">ID: {subscription.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`enabled-${subscription.id}`}>Enabled</Label>
                            <Switch
                              id={`enabled-${subscription.id}`}
                              checked={subscription.is_enabled}
                              onCheckedChange={(checked) =>
                                toggleSubscriptionMutation.mutate({ id: subscription.id, isEnabled: checked })
                              }
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {subscription.events.map((eventName) => (
                            <Badge key={eventName} variant="secondary">
                              {eventName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                    onChange={(event) => setSelectedSubscriptionId(event.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="all">All subscriptions</option>
                    {subscriptions.map((subscription) => (
                      <option value={subscription.id} key={subscription.id}>
                        {subscription.webhook_url}
                      </option>
                    ))}
                  </select>
                </div>

                <Separator />

                {isDeliveriesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading delivery history…</p>
                ) : deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deliveries found.</p>
                ) : (
                  <div className="space-y-2">
                    {deliveries.map((delivery) => {
                      const subscription = subscriptionById.get(delivery.webhook_subscription_id);
                      return (
                        <div key={delivery.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{delivery.event_name}</Badge>
                                <Badge variant={delivery.status === "delivered" ? "default" : "secondary"}>{delivery.status}</Badge>
                                {delivery.response_status ? <Badge variant="secondary">HTTP {delivery.response_status}</Badge> : null}
                              </div>
                              <p className="text-xs text-muted-foreground break-all">
                                {subscription?.webhook_url || delivery.webhook_subscription_id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Created: {new Date(delivery.created_at).toLocaleString()} • Delivered:{" "}
                                {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleString() : "-"}
                              </p>
                              {delivery.error_message ? (
                                <p className="text-xs text-destructive">Error: {delivery.error_message}</p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">View details</Button>
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

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => replayDeliveryMutation.mutate(delivery)}
                                disabled={replayDeliveryMutation.isPending}
                              >
                                <RotateCcw className="mr-1 h-4 w-4" />
                                Replay
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(delivery.id);
                                  toast({ title: "Copied delivery id" });
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
