-- Create franchisees table to store franchisee data
CREATE TABLE public.franchisees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
    join_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.franchisees ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all franchisees"
ON public.franchisees
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert franchisees"
ON public.franchisees
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update franchisees"
ON public.franchisees
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete franchisees"
ON public.franchisees
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own franchisee record
CREATE POLICY "Users can view own franchisee record"
ON public.franchisees
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_franchisees_updated_at
BEFORE UPDATE ON public.franchisees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_franchisees_status ON public.franchisees(status);
CREATE INDEX idx_franchisees_brand_id ON public.franchisees(brand_id);
CREATE INDEX idx_franchisees_plan_id ON public.franchisees(plan_id);