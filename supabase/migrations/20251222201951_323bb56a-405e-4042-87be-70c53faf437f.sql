-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create contract_templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  html_content TEXT NOT NULL DEFAULT '',
  placeholders TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create generated_contracts table
CREATE TABLE public.generated_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchisee_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE RESTRICT,
  final_html TEXT NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed'))
);

-- Enable RLS on both tables
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;

-- Contract templates policies (admin only for management, public read for generating)
CREATE POLICY "Templates are publicly viewable"
ON public.contract_templates
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert templates"
ON public.contract_templates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
ON public.contract_templates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
ON public.contract_templates
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Generated contracts policies
CREATE POLICY "Admins can view all contracts"
ON public.generated_contracts
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert contracts"
ON public.generated_contracts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update contracts"
ON public.generated_contracts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete contracts"
ON public.generated_contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updating updated_at on contract_templates
CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();