import { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PLAN_CATEGORIES, type PlanCategory, type PlanFormData } from '@/components/plans/planFormTypes';

interface ContractTemplateOption {
  id: string;
  name: string;
}

interface PlanFormFieldsProps {
  formData: PlanFormData;
  setFormData: Dispatch<SetStateAction<PlanFormData>>;
  contractTemplates?: ContractTemplateOption[];
  isEditing?: boolean;
  showSetupFee?: boolean;
  showPaidMediaAddOn?: boolean;
}

export function PlanFormFields({
  formData,
  setFormData,
  contractTemplates,
  isEditing = false,
  showSetupFee = true,
  showPaidMediaAddOn = true,
}: PlanFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plan-name">Plan Name</Label>
          <Input
            id="plan-name"
            placeholder="Pro Plan"
            value={formData.name}
            onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-price">Monthly Price ($)</Label>
          <Input
            id="plan-price"
            type="number"
            step="0.01"
            placeholder="299.00"
            value={formData.monthly_price}
            onChange={(e) => setFormData((current) => ({ ...current, monthly_price: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-status">Plan Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData((current) => ({ ...current, status: value }))}
          >
            <SelectTrigger id="plan-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Inactive plans are hidden from the client-facing portal.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value: PlanCategory) => setFormData((current) => ({ ...current, category: value }))}
          >
            <SelectTrigger id="plan-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {PLAN_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showSetupFee && (
        <div className="space-y-2">
          <Label htmlFor="plan-setup-fee">One-Time Setup Fee ($)</Label>
          <Input
            id="plan-setup-fee"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.setup_fee}
            onChange={(e) => setFormData((current) => ({ ...current, setup_fee: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Optional one-time fee charged immediately at signup
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="plan-description">Description</Label>
        <p className="text-xs text-muted-foreground">
          Use bullet points to list what's included in this plan
        </p>
        <RichTextEditor
          value={formData.description}
          onChange={(value) => setFormData((current) => ({ ...current, description: value }))}
          placeholder="Describe what's included in this plan..."
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div>
            <Label htmlFor="plan-supports-media" className="cursor-pointer">Supports Paid Media</Label>
            <p className="text-xs text-muted-foreground">Enable paid media option for this plan</p>
          </div>
          <Switch
            id="plan-supports-media"
            checked={formData.supports_paid_media}
            onCheckedChange={(checked) => setFormData((current) => ({
              ...current,
              supports_paid_media: checked,
              requires_paid_media: checked ? current.requires_paid_media : false,
            }))}
          />
        </div>

        {formData.supports_paid_media && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div>
              <Label htmlFor="plan-requires-media" className="cursor-pointer">Paid Media Required</Label>
              <p className="text-xs text-muted-foreground">Customers must include paid media with this plan</p>
            </div>
            <Switch
              id="plan-requires-media"
              checked={formData.requires_paid_media}
              onCheckedChange={(checked) => setFormData((current) => ({ ...current, requires_paid_media: checked }))}
            />
          </div>
        )}
      </div>

      {formData.supports_paid_media && showPaidMediaAddOn && (
        <div className="space-y-2">
          <Label htmlFor="plan-price-media">Paid Media Add-on Fee ($)</Label>
          <Input
            id="plan-price-media"
            type="number"
            step="0.01"
            placeholder="100.00"
            value={formData.monthly_price_with_media}
            onChange={(e) => setFormData((current) => ({ ...current, monthly_price_with_media: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            {isEditing
              ? 'Additional monthly fee for paid media. Changing will create new Stripe pricing.'
              : 'Additional monthly fee added to base price when paid media is selected'}
          </p>
        </div>
      )}


      <div className="space-y-2">
        <Label htmlFor="plan-contract-template">Contract Template</Label>
        <Select
          value={formData.contract_template_id || 'none'}
          onValueChange={(value) => setFormData((current) => ({ ...current, contract_template_id: value === 'none' ? '' : value }))}
        >
          <SelectTrigger id="plan-contract-template">
            <SelectValue placeholder="Select a contract template (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No template</SelectItem>
            {contractTemplates?.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Links this plan to a contract template for automatic generation
        </p>
      </div>
    </>
  );
}
