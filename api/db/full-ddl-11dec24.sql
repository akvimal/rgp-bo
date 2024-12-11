-- DROP SEQUENCE public.app_role_id_seq;

CREATE SEQUENCE public.app_role_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.app_user_id_seq;

CREATE SEQUENCE public.app_user_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.business_id_seq;

CREATE SEQUENCE public.business_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.business_location_id_seq;

CREATE SEQUENCE public.business_location_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.customer_documents_id_seq;

CREATE SEQUENCE public.customer_documents_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.customer_id_seq;

CREATE SEQUENCE public.customer_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.customer_transaction_id_seq;

CREATE SEQUENCE public.customer_transaction_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.documents_id_seq;

CREATE SEQUENCE public.documents_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.grn_seq;

CREATE SEQUENCE public.grn_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.lookup_id_seq;

CREATE SEQUENCE public.lookup_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.order_number_seq;

CREATE SEQUENCE public.order_number_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.product_clearance_id_seq;

CREATE SEQUENCE public.product_clearance_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.product_id_seq;

CREATE SEQUENCE public.product_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.product_price2_id_seq;

CREATE SEQUENCE public.product_price2_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.product_price_id_seq;

CREATE SEQUENCE public.product_price_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.product_qtychange_id_seq;

CREATE SEQUENCE public.product_qtychange_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.purchase_invoice_id_seq;

CREATE SEQUENCE public.purchase_invoice_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.purchase_invoice_item_id_seq;

CREATE SEQUENCE public.purchase_invoice_item_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.purchase_order_id_seq;

CREATE SEQUENCE public.purchase_order_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.purchase_request_id_seq;

CREATE SEQUENCE public.purchase_request_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.sale_deliveries_id_seq;

CREATE SEQUENCE public.sale_deliveries_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.sale_id_seq;

CREATE SEQUENCE public.sale_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.sale_item_id_seq;

CREATE SEQUENCE public.sale_item_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.sale_return_item_id_seq;

CREATE SEQUENCE public.sale_return_item_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.sales_meta_id_seq;

CREATE SEQUENCE public.sales_meta_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vendor_id_seq;

CREATE SEQUENCE public.vendor_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vendor_payment_id_seq;

CREATE SEQUENCE public.vendor_payment_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;
-- DROP SEQUENCE public.vendor_pricelist_id_seq;

CREATE SEQUENCE public.vendor_pricelist_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;-- public.app_role definition

-- Drop table

-- DROP TABLE public.app_role;

CREATE TABLE public.app_role (
	id serial4 NOT NULL,
	"name" varchar NOT NULL,
	permissions json NULL,
	"locked" bool DEFAULT false NOT NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	CONSTRAINT app_role_pk PRIMARY KEY (id),
	CONSTRAINT app_role_un UNIQUE (name)
);


-- public.business definition

-- Drop table

-- DROP TABLE public.business;

CREATE TABLE public.business (
	id serial4 NOT NULL,
	"name" varchar NOT NULL,
	CONSTRAINT business_pk PRIMARY KEY (id),
	CONSTRAINT business_un UNIQUE (name)
);


-- public.customer definition

-- Drop table

-- DROP TABLE public.customer;

CREATE TABLE public.customer (
	id serial4 NOT NULL,
	"name" varchar NULL,
	mobile varchar NULL,
	email varchar NULL,
	address varchar NULL,
	active bool DEFAULT true NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	locality varchar NULL,
	area varchar NULL,
	source_type varchar NULL,
	source_desc varchar NULL,
	"location" varchar NULL,
	first_name varchar NULL,
	last_name varchar NULL,
	CONSTRAINT customer_pk PRIMARY KEY (id),
	CONSTRAINT customer_un UNIQUE (name, mobile)
);


-- public.documents definition

-- Drop table

-- DROP TABLE public.documents;

CREATE TABLE public.documents (
	id serial4 NOT NULL,
	doc_name varchar NULL,
	doc_path varchar NULL,
	doc_extn varchar NULL,
	active bool DEFAULT true NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	archive bool DEFAULT false NOT NULL,
	category varchar NULL,
	alias varchar NULL,
	doc_props json NULL,
	upload_props json NULL,
	CONSTRAINT documents_pk PRIMARY KEY (id)
);


-- public.lookup definition

-- Drop table

-- DROP TABLE public.lookup;

CREATE TABLE public.lookup (
	id serial4 NOT NULL,
	category varchar NULL,
	"label" varchar NOT NULL,
	value varchar NOT NULL,
	active bool DEFAULT true NOT NULL,
	CONSTRAINT lookup_pk PRIMARY KEY (id)
);


-- public.product definition

-- Drop table

-- DROP TABLE public.product;

CREATE TABLE public.product (
	id serial4 NOT NULL,
	title varchar NOT NULL,
	active bool DEFAULT true NULL,
	description varchar NULL,
	mfr varchar NULL,
	category varchar NULL,
	more_props json NULL,
	hsn_code varchar NULL,
	product_code varchar NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	brand varchar NULL,
	pack int4 DEFAULT 1 NOT NULL,
	tax_pcnt float4 NULL,
	CONSTRAINT product_pk PRIMARY KEY (id),
	CONSTRAINT product_un UNIQUE (title)
);


-- public.sales_meta definition

-- Drop table

-- DROP TABLE public.sales_meta;

CREATE TABLE public.sales_meta (
	id serial4 NOT NULL,
	fiscal_year_start date NOT NULL,
	last_bill_no int4 DEFAULT 0 NULL,
	CONSTRAINT sales_meta_pkey PRIMARY KEY (id)
);


-- public.vendor definition

-- Drop table

-- DROP TABLE public.vendor;

CREATE TABLE public.vendor (
	id serial4 NOT NULL,
	business_name varchar NOT NULL,
	active bool DEFAULT true NULL,
	more_props json NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	contact_name varchar NULL,
	gstn varchar NULL,
	contact_phone varchar NULL,
	address varchar NULL,
	"comments" varchar NULL,
	CONSTRAINT vendor_pk PRIMARY KEY (id),
	CONSTRAINT vendor_un UNIQUE (business_name)
);


-- public.app_user definition

-- Drop table

-- DROP TABLE public.app_user;

CREATE TABLE public.app_user (
	id serial4 NOT NULL,
	email varchar(40) NOT NULL,
	phone varchar NULL,
	active bool DEFAULT true NOT NULL,
	"location" varchar(80) NULL,
	full_name varchar(40) NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	"password" varchar NULL,
	last_login timestamptz NULL,
	role_id int4 NULL,
	CONSTRAINT app_user_pk PRIMARY KEY (id),
	CONSTRAINT app_user_un UNIQUE (email),
	CONSTRAINT app_user_fk FOREIGN KEY (role_id) REFERENCES public.app_role(id)
);


-- public.business_location definition

-- Drop table

-- DROP TABLE public.business_location;

CREATE TABLE public.business_location (
	id serial4 NOT NULL,
	business_id int4 NOT NULL,
	"name" varchar NOT NULL,
	config json NULL,
	CONSTRAINT business_location_pk PRIMARY KEY (id),
	CONSTRAINT business_location_un UNIQUE (business_id, name),
	CONSTRAINT business_location_fk FOREIGN KEY (business_id) REFERENCES public.business(id)
);


-- public.customer_documents definition

-- Drop table

-- DROP TABLE public.customer_documents;

CREATE TABLE public.customer_documents (
	id serial4 NOT NULL,
	customer_id int4 NOT NULL,
	document_id int4 NOT NULL,
	active bool DEFAULT true NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	archive bool DEFAULT false NOT NULL,
	CONSTRAINT customer_documents_pk PRIMARY KEY (id),
	CONSTRAINT customer_documents_customer_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id),
	CONSTRAINT customer_documents_documents_fk FOREIGN KEY (document_id) REFERENCES public.documents(id)
);


-- public.customer_transaction definition

-- Drop table

-- DROP TABLE public.customer_transaction;

CREATE TABLE public.customer_transaction (
	id serial4 NOT NULL,
	trans_date date NOT NULL,
	category varchar NULL,
	props_json json NULL,
	amount float4 NOT NULL,
	customer_id int4 NOT NULL,
	CONSTRAINT customer_transaction_pk PRIMARY KEY (id),
	CONSTRAINT customer_transaction_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id)
);


-- public.product_price2 definition

-- Drop table

-- DROP TABLE public.product_price2;

CREATE TABLE public.product_price2 (
	id serial4 NOT NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	eff_date date DEFAULT CURRENT_DATE NOT NULL,
	product_id int4 NOT NULL,
	end_date date DEFAULT '2099-12-31'::date NOT NULL,
	sale_price float4 NOT NULL,
	reason varchar NULL,
	"comments" varchar NULL,
	CONSTRAINT product_price2_unique UNIQUE (product_id, eff_date, sale_price, end_date),
	CONSTRAINT product_price_pk_1 PRIMARY KEY (id),
	CONSTRAINT product_price2_fk FOREIGN KEY (product_id) REFERENCES public.product(id)
);


-- public.purchase_invoice definition

-- Drop table

-- DROP TABLE public.purchase_invoice;

CREATE TABLE public.purchase_invoice (
	id serial4 NOT NULL,
	invoice_no varchar NOT NULL,
	invoice_date date NOT NULL,
	vendor_id int4 NOT NULL,
	active bool DEFAULT true NOT NULL,
	status varchar DEFAULT 'NEW'::character varying NOT NULL,
	gr_no varchar NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	purchase_order_id varchar NULL,
	"comments" varchar NULL,
	total float4 NULL,
	gr_date date NULL,
	CONSTRAINT purchase_invoice_pk PRIMARY KEY (id),
	CONSTRAINT purchase_invoice_un UNIQUE (invoice_no, vendor_id),
	CONSTRAINT purchase_invoice_fk FOREIGN KEY (vendor_id) REFERENCES public.vendor(id)
);


-- public.purchase_order definition

-- Drop table

-- DROP TABLE public.purchase_order;

CREATE TABLE public.purchase_order (
	id serial4 NOT NULL,
	vendor_id int4 NOT NULL,
	status varchar DEFAULT 'PENDING'::character varying NOT NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	po_number varchar NULL,
	CONSTRAINT purchase_order_pk PRIMARY KEY (id),
	CONSTRAINT purchase_order_fk FOREIGN KEY (vendor_id) REFERENCES public.vendor(id)
);


-- public.purchase_request definition

-- Drop table

-- DROP TABLE public.purchase_request;

CREATE TABLE public.purchase_request (
	id serial4 NOT NULL,
	product_id int4 NULL,
	request_type varchar DEFAULT 'REFILL'::character varying NOT NULL,
	qty int4 NOT NULL,
	order_id int4 NULL,
	status varchar DEFAULT 'NEW'::character varying NOT NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	CONSTRAINT purchase_request_pk PRIMARY KEY (id),
	CONSTRAINT purchase_request_fk FOREIGN KEY (product_id) REFERENCES public.product(id),
	CONSTRAINT purchase_request_fk1 FOREIGN KEY (order_id) REFERENCES public.purchase_order(id)
);


-- public.sale definition

-- Drop table

-- DROP TABLE public.sale;

CREATE TABLE public.sale (
	id serial4 NOT NULL,
	bill_date timestamp NOT NULL,
	customer_id int4 NULL,
	status varchar DEFAULT 'NEW'::character varying NOT NULL,
	active bool DEFAULT true NULL,
	more_props json NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	archive bool DEFAULT false NOT NULL,
	disc_amount numeric(12, 2) NULL,
	total float8 NULL,
	disc_code varchar NULL,
	expreturn_days int4 DEFAULT 4 NOT NULL,
	bill_no int4 NULL,
	order_no int4 NULL,
	order_date date NULL,
	digi_method varchar NULL,
	digi_refno varchar NULL,
	digi_amount float4 NULL,
	cash_amount float4 NULL,
	order_type varchar NULL,
	delivery_type varchar NULL,
	doc_pending bool DEFAULT false NOT NULL,
	CONSTRAINT sale_pk PRIMARY KEY (id),
	CONSTRAINT sale_cust_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id)
);


-- public.sale_deliveries definition

-- Drop table

-- DROP TABLE public.sale_deliveries;

CREATE TABLE public.sale_deliveries (
	id serial4 NOT NULL,
	"saleId" int4 NOT NULL,
	booked_date date NULL,
	booked_by int4 NULL,
	receiver_name varchar NULL,
	receiver_phone varchar NULL,
	receiver_address varchar NULL,
	delivery_date date NULL,
	delivery_by varchar NULL,
	charges float4 NULL,
	status varchar NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	archive bool DEFAULT false NOT NULL,
	CONSTRAINT sale_deliveries_pk PRIMARY KEY (id),
	CONSTRAINT sale_deliveries_app_user_fk FOREIGN KEY (booked_by) REFERENCES public.app_user(id),
	CONSTRAINT sale_deliveries_sale_fk FOREIGN KEY ("saleId") REFERENCES public.sale(id)
);


-- public.vendor_payment definition

-- Drop table

-- DROP TABLE public.vendor_payment;

CREATE TABLE public.vendor_payment (
	id serial4 NOT NULL,
	vendor_id int4 NOT NULL,
	invoice_id int4 NOT NULL,
	pay_date date NOT NULL,
	amount float4 NOT NULL,
	pay_mode varchar NULL,
	trans_ref varchar NULL,
	CONSTRAINT vendor_payment_pk PRIMARY KEY (id),
	CONSTRAINT vendor_payment_fk FOREIGN KEY (vendor_id) REFERENCES public.vendor(id),
	CONSTRAINT vendor_payment_fk_1 FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoice(id)
);


-- public.vendor_pricelist definition

-- Drop table

-- DROP TABLE public.vendor_pricelist;

CREATE TABLE public.vendor_pricelist (
	id serial4 NOT NULL,
	vendor_id int4 NOT NULL,
	eff_date date NOT NULL,
	product_id int4 NOT NULL,
	pts float4 NOT NULL,
	mrp float4 NOT NULL,
	shipper_pack varchar NULL,
	CONSTRAINT vendor_pricelist_pk PRIMARY KEY (id),
	CONSTRAINT pricelist_prod_fk FOREIGN KEY (product_id) REFERENCES public.product(id),
	CONSTRAINT pricelist_vendor_fk FOREIGN KEY (vendor_id) REFERENCES public.vendor(id)
);


-- public.purchase_invoice_item definition

-- Drop table

-- DROP TABLE public.purchase_invoice_item;

CREATE TABLE public.purchase_invoice_item (
	id serial4 NOT NULL,
	invoice_id int4 NOT NULL,
	product_id int4 NOT NULL,
	batch varchar NULL,
	exp_date date NULL,
	ptr_cost float8 NOT NULL,
	mrp_cost float8 NOT NULL,
	disc_pcnt float8 NULL,
	tax_pcnt float8 NULL,
	qty int4 NOT NULL,
	"comments" varchar NULL,
	sale_price float8 NULL,
	status varchar DEFAULT 'NEW'::character varying NOT NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	total numeric(12, 2) NULL,
	ptr_value float4 NULL,
	request_id int4 NULL,
	mfr_date date NULL,
	free_qty int4 NULL,
	verify_start_date date NULL,
	verify_end_date date NULL,
	verified_by int4 NULL,
	CONSTRAINT pur_invitem_pk PRIMARY KEY (id),
	CONSTRAINT pur_invitem_inv_fk FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoice(id),
	CONSTRAINT pur_invitem_prod_fk FOREIGN KEY (product_id) REFERENCES public.product(id),
	CONSTRAINT purchase_invoice_item_fk FOREIGN KEY (request_id) REFERENCES public.purchase_request(id)
);


-- public.sale_item definition

-- Drop table

-- DROP TABLE public.sale_item;

CREATE TABLE public.sale_item (
	id serial4 NOT NULL,
	sale_id int4 NOT NULL,
	purchase_item_id int4 NULL,
	price float8 NOT NULL,
	qty int4 NOT NULL,
	status varchar DEFAULT 'Sale New'::character varying NOT NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	total float8 NULL,
	paymode varchar NULL,
	reason varchar NULL,
	sale_mode varchar DEFAULT 'SALE'::character varying NOT NULL,
	product_id int4 NOT NULL,
	batch varchar NULL,
	exp_date date NULL,
	mrp_cost float8 NULL,
	tax_pcnt float4 NULL,
	CONSTRAINT sale_item_pk PRIMARY KEY (id),
	CONSTRAINT sale_item_pi_fk FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_invoice_item(id),
	CONSTRAINT sale_item_sale_fk FOREIGN KEY (sale_id) REFERENCES public.sale(id) ON DELETE CASCADE
);


-- public.sale_return_item definition

-- Drop table

-- DROP TABLE public.sale_return_item;

CREATE TABLE public.sale_return_item (
	sale_item_id int4 NOT NULL,
	qty int4 NOT NULL,
	reason varchar NULL,
	status varchar NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	id serial4 NOT NULL,
	CONSTRAINT sale_return_item_pk PRIMARY KEY (id),
	CONSTRAINT sale_return_sale_item_fk FOREIGN KEY (sale_item_id) REFERENCES public.sale_item(id) ON DELETE CASCADE
);


-- public.product_clearance definition

-- Drop table

-- DROP TABLE public.product_clearance;

CREATE TABLE public.product_clearance (
	id serial4 NOT NULL,
	purchase_item_id int4 NOT NULL,
	qty int4 NULL,
	price float4 NULL,
	amount float4 NULL,
	reason varchar NULL,
	status varchar NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	CONSTRAINT product_clearance_pk PRIMARY KEY (id),
	CONSTRAINT product_clearance_fk FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_invoice_item(id)
);


-- public.product_price definition

-- Drop table

-- DROP TABLE public.product_price;

CREATE TABLE public.product_price (
	id serial4 NOT NULL,
	item_id int4 NOT NULL,
	price float4 NOT NULL,
	"comments" varchar NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	eff_date date DEFAULT CURRENT_DATE NOT NULL,
	old_price float4 NULL,
	CONSTRAINT product_price_pk PRIMARY KEY (id),
	CONSTRAINT product_price_item_fk FOREIGN KEY (item_id) REFERENCES public.purchase_invoice_item(id)
);


-- public.product_qtychange definition

-- Drop table

-- DROP TABLE public.product_qtychange;

CREATE TABLE public.product_qtychange (
	id serial4 NOT NULL,
	item_id int4 NOT NULL,
	qty int4 NOT NULL,
	sale_price float4 NULL,
	reason varchar NOT NULL,
	"comments" varchar NULL,
	status varchar DEFAULT 'NEW'::character varying NOT NULL,
	active bool DEFAULT true NOT NULL,
	archive bool DEFAULT false NOT NULL,
	created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	created_by int4 NULL,
	updated_by int4 NULL,
	CONSTRAINT product_qtychange_pk PRIMARY KEY (id),
	CONSTRAINT product_qtychange_fk FOREIGN KEY (item_id) REFERENCES public.purchase_invoice_item(id)
);


-- public.customer_sale_view source

CREATE OR REPLACE VIEW public.customer_sale_view
AS SELECT s1.customer_id,
    c.name,
    c.mobile,
    s2.since,
    date_part('day'::text, now() - s2.since::timestamp with time zone) / 30::double precision AS since_months,
    s2.total AS tilldate_total,
    s1.bill_date AS recent_visit,
    s1.id AS recent_sale_id,
    s1.total AS recent_total,
    date_part('day'::text, now() - s1.bill_date::timestamp with time zone) AS since_recent_days,
    s1.expreturn_days AS expreturndays
   FROM sale s1
     JOIN ( SELECT sale.customer_id,
            min(sale.bill_date) AS since,
            max(sale.bill_date) AS latest,
            sum(sale.total) AS total
           FROM sale
          GROUP BY sale.customer_id) s2 ON s1.customer_id = s2.customer_id AND s1.bill_date = s2.latest
     JOIN customer c ON c.id = s1.customer_id
  ORDER BY s1.bill_date DESC;


-- public.inventory_view source

CREATE OR REPLACE VIEW public.inventory_view
AS SELECT pii.id,
    p.id AS product_id,
    pii.invoice_id AS purchase_invoiceid,
    pi.invoice_no,
    pi.invoice_date,
    pii.id AS purchase_itemid,
    p.title AS product_title,
    p.pack AS product_pack,
    p.product_code,
    p.more_props,
    pii.batch AS product_batch,
    pii.exp_date AS product_expdate,
    pii.tax_pcnt AS product_taxpcnt,
    pii.mrp_cost AS mrp,
    pii.qty * p.pack AS purchased,
    pii.status,
    pii.verify_start_date,
    pii.verify_end_date,
    pii.verified_by AS verified_userid,
    au.full_name AS verified_username,
    pii.active,
    COALESCE(si.bal, 0::bigint) AS sold,
    COALESCE(pq.bal, 0::bigint) AS adjusted,
    pii.qty * p.pack - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available
   FROM product p
     JOIN purchase_invoice_item pii ON p.id = pii.product_id
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     LEFT JOIN ( SELECT si_1.purchase_item_id,
            sum(si_1.qty) AS bal
           FROM sale_item si_1
          WHERE si_1.status::text = 'Complete'::text
          GROUP BY si_1.purchase_item_id) si ON si.purchase_item_id = pii.id
     LEFT JOIN ( SELECT product_qtychange.item_id,
            sum(product_qtychange.qty) AS bal
           FROM product_qtychange
          GROUP BY product_qtychange.item_id) pq ON pq.item_id = pii.id
     LEFT JOIN app_user au ON pii.verified_by = au.id
  ORDER BY p.title, pii.exp_date DESC;


-- public.invoices_view source

CREATE OR REPLACE VIEW public.invoices_view
AS SELECT pi.id,
    pi.invoice_no,
    pi.invoice_date,
    v.business_name,
    pi.status,
    count(pii.id) AS items,
    round(sum(pii.total::double precision)) AS total
   FROM purchase_invoice pi
     JOIN vendor v ON v.id = pi.vendor_id
     LEFT JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
  GROUP BY pi.id, pi.invoice_no, pi.invoice_date, v.business_name, pi.status
  ORDER BY pi.invoice_date DESC;


-- public.price_view source

CREATE OR REPLACE VIEW public.price_view
AS SELECT p.id,
    p.title,
    p.active,
    pi.mrp,
    pi.ptr,
    pr.price,
    round((COALESCE(pr.price::double precision, pi.mrp) - pi.ptr) / pi.ptr * 100::double precision) AS margin,
    round((pi.mrp - COALESCE(pr.price::double precision, pi.mrp)) / pi.mrp * 100::double precision) AS discount
   FROM product p
     JOIN ( SELECT pii.product_id,
            pii.mrp_cost AS mrp,
            pii.ptr_cost AS ptr
           FROM purchase_invoice_item pii
             JOIN purchase_invoice pi2 ON pi2.id = pii.invoice_id
             JOIN ( SELECT pii_1.product_id,
                    max(pi_1.invoice_date) AS last_date
                   FROM purchase_invoice_item pii_1
                     JOIN purchase_invoice pi_1 ON pi_1.id = pii_1.invoice_id
                  GROUP BY pii_1.product_id) x ON x.product_id = pii.product_id AND pi2.invoice_date = x.last_date) pi ON pi.product_id = p.id
     LEFT JOIN ( SELECT pp.product_id,
            pp.sale_price AS price
           FROM product_price2 pp
          WHERE pp.end_date > CURRENT_DATE) pr ON pr.product_id = p.id
  WHERE pi.ptr > 0::double precision AND pi.mrp > 0::double precision
  ORDER BY p.title;


-- public.product_items_view source

CREATE OR REPLACE VIEW public.product_items_view
AS SELECT p.id,
    p.title,
    p.pack,
    p.active,
    pi.invoice_date,
    pi.invoice_no,
    pi.id AS item_id,
    pi.batch,
    pi.exp_date,
    pi.status,
    pi.tax_pcnt,
    pi.mrp_cost,
    pi.last_sale_date,
        CASE
            WHEN pi.exp_date < (CURRENT_DATE + 30) THEN true
            ELSE false
        END AS expired,
    pi.qty * COALESCE(p.pack, 1) AS purchased,
    COALESCE(pi.sold, 0::bigint) AS sold,
    COALESCE(sum(pq.qty), 0::bigint) AS adjusted,
    pi.qty * COALESCE(p.pack, 1) - COALESCE(pi.sold, 0::bigint) + COALESCE(sum(pq.qty), 0::bigint) AS balance
   FROM product p
     LEFT JOIN ( SELECT i.invoice_date,
            i.invoice_no,
            pii.id,
            pii.product_id,
            pii.batch,
            pii.exp_date,
            pii.qty,
            pii.tax_pcnt,
            pii.mrp_cost,
            pii.status,
            COALESCE(sum(si.qty), 0::bigint) AS sold,
            max(s.bill_date) AS last_sale_date
           FROM purchase_invoice_item pii
             JOIN purchase_invoice i ON i.id = pii.invoice_id
             LEFT JOIN sale_item si ON si.purchase_item_id = pii.id
             LEFT JOIN sale s ON s.id = si.sale_id
          GROUP BY i.invoice_date, i.invoice_no, pii.id, pii.tax_pcnt, pii.mrp_cost, pii.product_id, pii.batch, pii.exp_date, pii.qty, pii.status) pi ON pi.product_id = p.id
     LEFT JOIN product_qtychange pq ON pq.item_id = pi.id
  GROUP BY p.id, p.title, pi.invoice_date, pi.invoice_no, pi.tax_pcnt, pi.mrp_cost, pi.id, pi.batch, pi.exp_date, pi.last_sale_date, pi.qty, pi.status, pi.sold
  ORDER BY p.title;

-- public.product_items_agg_view source

CREATE OR REPLACE VIEW public.product_items_agg_view
AS SELECT vw.id,
    vw.title,
    vw.active,
    vw.expired,
    max(vw.invoice_date) AS last_purchase_date,
    date(max(vw.last_sale_date)) AS last_sale_date,
    sum(vw.purchased) AS purchased,
    sum(vw.sold) AS sold,
    sum(vw.adjusted) AS adjusted,
    sum(vw.purchased)::numeric - sum(vw.sold) + COALESCE(sum(vw.adjusted), 0::numeric) AS balance
   FROM product_items_view vw
  GROUP BY vw.id, vw.title, vw.active, vw.expired
  ORDER BY vw.title;

 -- public.product_sale_monthly_view source

CREATE OR REPLACE VIEW public.product_sale_monthly_view
AS SELECT si.product_id,
    date(date_trunc('month'::text, s.bill_date)) AS sale_month,
    count(s.customer_id) AS total_customers,
    count(s.bill_no) AS total_orders,
    sum(si.qty) AS total_qty,
    date(max(s.bill_date)) AS last_date
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
  GROUP BY si.product_id, (date(date_trunc('month'::text, s.bill_date)))
  ORDER BY si.product_id, (date(date_trunc('month'::text, s.bill_date))) DESC;


-- public.product_sale_agg_view source

CREATE OR REPLACE VIEW public.product_sale_agg_view
AS SELECT vw.product_id,
    avg(vw.total_customers) AS average_customers,
    max(vw.total_customers) AS highest_customers,
    avg(vw.total_orders) AS average_orders,
    max(vw.total_orders) AS highest_orders,
    avg(vw.total_qty) AS average_sales,
    max(vw.total_qty) AS highest_sales
   FROM product_sale_monthly_view vw
  WHERE vw.sale_month >= (CURRENT_DATE - '6 mons'::interval)
  GROUP BY vw.product_id
  ORDER BY vw.product_id;


-- public.sale_customer_view source

CREATE OR REPLACE VIEW public.sale_customer_view
AS SELECT s1.customer_id,
    c.name,
    c.mobile,
    to_char(s2.since, 'yyyy-mm-dd'::text) AS since,
    date_part('day'::text, s1.bill_date - s2.since) AS age_on_visit,
        CASE
            WHEN date_part('day'::text, s1.bill_date - s2.since) = 0::double precision THEN 'NEW'::text
            ELSE 'RETURN'::text
        END AS return_status,
    date_part('day'::text, now() - s2.since::timestamp with time zone) / 30::double precision AS since_months,
    s2.total AS tilldate_total,
    to_char(s1.bill_date, 'yyyy-mm-dd'::text)::date AS recent_visit,
    s1.id AS recent_sale_id,
    s1.total AS recent_total,
    date_part('day'::text, now() - s1.bill_date::timestamp with time zone) / 7::double precision AS since_recent_weeks,
    s1.expreturn_days AS expreturndays
   FROM sale s1
     JOIN ( SELECT sale.customer_id,
            min(sale.bill_date) AS since,
            max(sale.bill_date) AS latest,
            sum(sale.total) AS total
           FROM sale
          GROUP BY sale.customer_id) s2 ON s1.customer_id = s2.customer_id
     JOIN customer c ON c.id = s1.customer_id
  ORDER BY s1.bill_date DESC;


-- public.sale_view source

CREATE OR REPLACE VIEW public.sale_view
AS SELECT s.id,
    date(s.bill_date) AS sale_date,
    c.id AS customer_id,
    c.name AS customer_name,
    c.mobile AS customer_mobile,
    p.id AS product_id,
    p.title AS product,
    pii.batch,
    pii.exp_date,
    si.qty AS sale_qty,
    round((pii.ptr_value / p.pack::double precision * (1::double precision + pii.tax_pcnt / 100::double precision))::numeric, 2) AS ptr_cost,
    round((pii.ptr_value / p.pack::double precision * (1::double precision + pii.tax_pcnt / 100::double precision) * si.qty::double precision)::numeric, 2) AS purchase_total,
    si.price AS sale_price,
    si.total AS sale_total,
    round((si.total - pii.ptr_value / p.pack::double precision * si.qty::double precision)::numeric, 2) AS profit
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
     JOIN customer c ON c.id = s.customer_id
     JOIN purchase_invoice_item pii ON pii.id = si.purchase_item_id
     JOIN product p ON p.id = pii.product_id;


-- public.stock_view source

CREATE OR REPLACE VIEW public.stock_view
AS SELECT pii.id,
    pi.invoice_no,
    pi.invoice_date,
    pii.invoice_id,
    p.id AS product_id,
    p.title,
    p.more_props,
    p.pack,
    pii.batch,
    pii.exp_date AS expdate,
    pii.mrp_cost,
    pii.ptr_value,
    round(pii.sale_price::numeric, 2) AS sale_price,
    pii.ptr_cost,
    pii.tax_pcnt,
    (pii.qty + (+ COALESCE(pii.free_qty, 0))) * p.pack AS sale_qty,
    pii.qty + COALESCE(pii.free_qty, 0) AS purchase_qty,
    (pii.qty + (+ COALESCE(pii.free_qty, 0))) * p.pack - COALESCE(x.total_qty, 0::bigint) - COALESCE(y.adj_qty, 0::bigint) AS available_qty,
    (date_part('year'::text, now()) - date_part('year'::text, pi.invoice_date)) * 12::double precision + (date_part('month'::text, now()) - date_part('month'::text, pi.invoice_date)) AS old_with_us,
    (date_part('year'::text, pii.exp_date) - date_part('year'::text, now())) * 12::double precision + (date_part('month'::text, pii.exp_date) - date_part('month'::text, now())) AS life_left
   FROM purchase_invoice_item pii
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     JOIN product p ON p.id = pii.product_id
     LEFT JOIN ( SELECT si.purchase_item_id,
            sum(si.qty) AS total_qty
           FROM sale_item si
             JOIN sale s ON s.id = si.sale_id
          WHERE s.status::text = 'COMPLETE'::text AND (si.status::text = 'Sale Complete'::text OR si.status::text = 'Return Accepted'::text)
          GROUP BY si.purchase_item_id) x ON x.purchase_item_id = pii.id
     LEFT JOIN ( SELECT pc.item_id,
            sum(pc.qty) AS adj_qty
           FROM product_qtychange pc
          GROUP BY pc.item_id) y ON y.item_id = pii.id
  WHERE pii.status::text = 'VERIFIED'::text;



-- DROP FUNCTION public.generate_bill_number();

CREATE OR REPLACE FUNCTION public.generate_bill_number()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_fiscal_year_start DATE;
    new_fiscal_year_start DATE := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day';
    current_bill_no INT;
BEGIN
    -- Check if we are in a new fiscal year
    SELECT fiscal_year_start, last_bill_no INTO current_fiscal_year_start, current_bill_no
    FROM sales_meta
    ORDER BY fiscal_year_start DESC
    LIMIT 1;

    IF current_fiscal_year_start < new_fiscal_year_start THEN
        -- Reset bill number for the new fiscal year
        INSERT INTO sales_meta (fiscal_year_start, last_bill_no) VALUES (new_fiscal_year_start, 1);
        RETURN 1;
    ELSE
        -- Increment bill number for the current fiscal year
        UPDATE sales_meta
        SET last_bill_no = last_bill_no + 1
        WHERE fiscal_year_start = current_fiscal_year_start
        RETURNING last_bill_no INTO current_bill_no;
        
        RETURN current_bill_no;
    END IF;
END;
$function$
;

-- DROP FUNCTION public.generate_grn(text);

CREATE OR REPLACE FUNCTION public.generate_grn(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$select $1||to_char(current_date, 'YYMM')||lpad(nextval('grn_seq')::text,3,'0');$function$
;

-- DROP FUNCTION public.generate_order_number();

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    order_num INT;
BEGIN
    -- Get the next value from the sequence
    order_num := NEXTVAL('order_number_seq');

    -- Format the order number if necessary (e.g., add prefix or padding)
    -- RETURN 'ORD-' || TO_CHAR(order_num, 'FM0000'); -- Result: ORD-0001, ORD-0002, etc.
	RETURN order_num;
END;
$function$
;

-- DROP FUNCTION public.get_days_diff_stats(int4);

CREATE OR REPLACE FUNCTION public.get_days_diff_stats(customer_id_input integer)
 RETURNS TABLE(days_diff_array integer[], mean_diff numeric, stddev_diff numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Compute the differences and statistics for the last 6 intervals
    RETURN QUERY
    SELECT 
        ARRAY(SELECT diff
              FROM (
                  SELECT EXTRACT(DAY FROM (bill_date - LAG(bill_date) OVER (ORDER BY bill_date desc)))::INTEGER*-1 AS diff
                  FROM sale
                  WHERE customer_id = customer_id_input
                    AND bill_date >= CURRENT_DATE - INTERVAL '1 year'
              ) subquery
              WHERE diff IS NOT NULL
              LIMIT 5) AS days_diff_array,
        AVG(diff) AS mean_diff,
        STDDEV(diff) AS stddev_diff
    FROM (
        SELECT diff
        FROM (
            SELECT EXTRACT(DAY FROM (bill_date - LAG(bill_date) OVER (ORDER BY bill_date desc)))::INTEGER*-1 AS diff
            FROM sale
            WHERE customer_id = customer_id_input
              AND bill_date >= CURRENT_DATE - INTERVAL '1 year'
        ) subquery
        WHERE diff IS NOT NULL
        LIMIT 5
    ) limited_intervals;
END;
$function$
;

-- DROP FUNCTION public.months(varchar);

CREATE OR REPLACE FUNCTION public.months(dt character varying)
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

-- DROP FUNCTION public.months(bpchar, bpchar);

CREATE OR REPLACE FUNCTION public.months(character, character)
 RETURNS TABLE(mon character)
 LANGUAGE sql
AS $function$ 
--select date(generate_series($2::date,$1::date,'1 month'))
(select date_part('year',a.dt)||'-'||lpad(date_part('month',a.dt)::text,2,'0') as d2 from 
(select date(generate_series($2::date,$1::date,'1 month')) as dt) a)
$function$
;