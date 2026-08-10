import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Building2, CreditCard, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { data: portals } = useQuery({
    queryKey: ['portals-count'],
    queryFn: async () => {
      const { count } = await supabase.from('portals').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['brands-count'],
    queryFn: async () => {
      const { count } = await supabase.from('brands').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['plans-count'],
    queryFn: async () => {
      const { count } = await supabase.from('plans').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const stats = [
    { 
      label: 'Total Portals', 
      value: portals ?? 0, 
      icon: Layers,
      gradient: 'from-blue-500 to-blue-600'
    },
    { 
      label: 'Total Brands', 
      value: brands ?? 0, 
      icon: Building2,
      gradient: 'from-emerald-500 to-emerald-600'
    },
    { 
      label: 'Active Plans', 
      value: plans ?? 0, 
      icon: CreditCard,
      gradient: 'from-violet-500 to-violet-600'
    },
    { 
      label: 'Growth', 
      value: '+12%', 
      icon: TrendingUp,
      gradient: 'from-amber-500 to-orange-600'
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your portal management system
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card 
              key={stat.label} 
              className="shadow-card hover:shadow-elevated transition-shadow duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className="w-4 h-4 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Manage your portals, brands, and subscription plans from the sidebar navigation.
              </p>
              <div className="grid gap-3">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-sm">Create a Portal</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set up a new subdomain portal for your customers
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-sm">Add a Brand</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create brand identities within your portals
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-medium text-sm">Configure Plans</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set up subscription plans with Stripe integration
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Connected
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Authentication</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">API</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Operational
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
