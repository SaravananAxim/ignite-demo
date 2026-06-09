-- Allow anonymous users to insert franchisees during onboarding
CREATE POLICY "Anonymous franchisee insert"
ON public.franchisees
FOR INSERT
WITH CHECK (true);

-- Allow anonymous users to update their own franchisee record (by id)
CREATE POLICY "Anonymous franchisee update by id"
ON public.franchisees
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow anonymous users to read franchisee they just created
CREATE POLICY "Anonymous franchisee read by id"
ON public.franchisees
FOR SELECT
USING (true);

-- Allow anonymous users to insert contracts during signing
CREATE POLICY "Anonymous contract insert"
ON public.generated_contracts
FOR INSERT
WITH CHECK (true);

-- Allow anonymous users to update contracts they created
CREATE POLICY "Anonymous contract update"
ON public.generated_contracts
FOR UPDATE
USING (true);

-- Allow anonymous users to read contracts
CREATE POLICY "Anonymous contract read"
ON public.generated_contracts
FOR SELECT
USING (true);