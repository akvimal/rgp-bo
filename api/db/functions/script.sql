CREATE OR REPLACE FUNCTION months(dt character varying)
   RETURNS integer
   LANGUAGE plpgsql
  AS $function$
    declare 
    	mon integer;
    begin 
  	select ((DATE_PART('year', dt::date) - DATE_PART('year', now())) * 12) +
                (DATE_PART('month', dt::date) - DATE_PART('month', now()) - 1) as mon;
      return mon;
    end;
  $function$
  ;
  
CREATE OR REPLACE FUNCTION public.months(character, character)
 RETURNS TABLE(mon character)
 LANGUAGE sql
AS $function$ 
--select date(generate_series($2::date,$1::date,'1 month'))
(select date_part('year',a.dt)||'-'||lpad(date_part('month',a.dt)::text,2,'0') as d2 from 
(select date(generate_series($2::date,$1::date,'1 month')) as dt) a)
$function$
;

CREATE OR REPLACE FUNCTION public.generate_grn(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$select $1||to_char(current_date, 'YYMM')||lpad(nextval('grn_seq')::text,3,'0');$function$
;
