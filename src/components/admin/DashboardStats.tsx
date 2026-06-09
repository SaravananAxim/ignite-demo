import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileCheck, Clock, DollarSign } from "lucide-react";

interface DashboardStatsProps {
  totalFranchisees: number;
  activeContracts: number;
  pendingApprovals: number;
  isLoading?: boolean;
}

export function DashboardStats({
  totalFranchisees,
  activeContracts,
  pendingApprovals,
  isLoading = false,
}: DashboardStatsProps) {
  const stats = [
    {
      title: "Total Franchisees",
      value: totalFranchisees,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Active Contracts",
      value: activeContracts,
      icon: FileCheck,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Pending Approvals",
      value: pendingApprovals,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Total Revenue",
      value: "$0",
      description: "Coming soon",
      icon: DollarSign,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground truncate">
              {stat.title}
            </CardTitle>
            <div className={`rounded-lg p-2 shrink-0 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 shrink-0 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stat.value}</div>
            )}
            {stat.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
