import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, UserX, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { STATUS_LABELS } from "@/constants";

interface Brand {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
}

export interface FranchiseeData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  brand_id: string | null;
  plan_id: string | null;
  status: string;
  join_date: string;
  brands?: { name: string } | null;
  plans?: { name: string } | null;
}

interface FranchiseeDetailsCardProps {
  franchisee: FranchiseeData;
  brands: Brand[];
  plans: Plan[];
  onSave: (data: Partial<FranchiseeData>) => Promise<void>;
  onToggleStatus: () => Promise<void>;
  isSaving?: boolean;
  isTogglingStatus?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  payment_completed: "bg-blue-500/10 text-blue-600",
  contract_signed: "bg-indigo-500/10 text-indigo-600",
  awaiting_countersign: "bg-purple-500/10 text-purple-600",
  completed: "bg-green-500/10 text-green-600",
  active: "bg-green-500/10 text-green-600",
  inactive: "bg-gray-500/10 text-gray-600",
  cancelled: "bg-red-500/10 text-red-600",
};

export function FranchiseeDetailsCard({
  franchisee,
  brands,
  plans,
  onSave,
  onToggleStatus,
  isSaving = false,
  isTogglingStatus = false,
}: FranchiseeDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: franchisee.name,
    email: franchisee.email,
    phone: franchisee.phone || "",
    address: franchisee.address || "",
    brand_id: franchisee.brand_id || "",
    plan_id: franchisee.plan_id || "",
  });

  const handleSave = async () => {
    await onSave({
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      address: formData.address || null,
      brand_id: formData.brand_id || null,
      plan_id: formData.plan_id || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: franchisee.name,
      email: franchisee.email,
      phone: franchisee.phone || "",
      address: franchisee.address || "",
      brand_id: franchisee.brand_id || "",
      plan_id: franchisee.plan_id || "",
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle>Franchisee Information</CardTitle>
          <Badge variant="outline" className={statusColors[franchisee.status] || statusColors.pending}>
            {STATUS_LABELS[franchisee.status as keyof typeof STATUS_LABELS] || franchisee.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleStatus}
                disabled={isTogglingStatus}
                className={
                  franchisee.status === "active" || franchisee.status === "completed"
                    ? "text-destructive hover:text-destructive"
                    : "text-green-600 hover:text-green-600"
                }
              >
                {isTogglingStatus && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {franchisee.status === "active" || franchisee.status === "completed" ? (
                  <>
                    <UserX className="h-4 w-4 mr-1" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-1" />
                    Activate
                  </>
                )}
              </Button>
              <Button size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            {isEditing ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            ) : (
              <p className="text-sm font-medium">{franchisee.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            {isEditing ? (
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            ) : (
              <p className="text-sm font-medium">{franchisee.email}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            {isEditing ? (
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="Enter phone number"
              />
            ) : (
              <p className="text-sm font-medium">
                {franchisee.phone || <span className="text-muted-foreground">Not provided</span>}
              </p>
            )}
          </div>

          {/* Join Date */}
          <div className="space-y-2">
            <Label>Join Date</Label>
            <p className="text-sm font-medium">
              {format(new Date(franchisee.join_date), "MMMM d, yyyy")}
            </p>
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            {isEditing ? (
              <Select
                value={formData.brand_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, brand_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium">
                {franchisee.brands?.name || (
                  <span className="text-muted-foreground">Not assigned</span>
                )}
              </p>
            )}
          </div>

          {/* Plan */}
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            {isEditing ? (
              <Select
                value={formData.plan_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, plan_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium">
                {franchisee.plans?.name || (
                  <span className="text-muted-foreground">Not assigned</span>
                )}
              </p>
            )}
          </div>

          {/* Address - Full Width */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            {isEditing ? (
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Enter full address"
                rows={2}
              />
            ) : (
              <p className="text-sm font-medium">
                {franchisee.address || (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
