-- 158: the "Price changes" staff sheet: what changed in the sale prices over a period, grouped into came down / went up, to print for the counter.
-- It shows only sale prices (what the customer pays), never cost, so everyone who serves at the counter may open it.
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"pricechanges","path":"/secure/price-changes","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head', 'Sales Staff', 'Counter')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "pricechanges")');
