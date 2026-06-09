import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { ActivityLogTable } from "./ActivityLogTable";

interface FranchiseeActivityLogProps {
  franchiseeId: string;
}

export function FranchiseeActivityLog({ franchiseeId }: FranchiseeActivityLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityLogTable
          targetType="franchisee"
          targetId={franchiseeId}
          showFilters={false}
          pageSize={5}
        />
      </CardContent>
    </Card>
  );
}
