-- public.app_role definition

-- Drop table

-- DROP TABLE public.app_role;

CREATE TABLE public.app_role (
	id serial4 NOT NULL,
	"name" varchar NOT NULL,
	permissions json NULL,
	"locked" bool NOT NULL DEFAULT false,
	active bool NOT NULL DEFAULT true,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	CONSTRAINT app_role_pk PRIMARY KEY (id),
	CONSTRAINT app_role_un UNIQUE (name)
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
	active bool NULL DEFAULT true,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	locality varchar NULL,
	area varchar NULL,
	source_type varchar NULL,
	source_desc varchar NULL,
	"location" varchar NULL,
	CONSTRAINT customer_pk PRIMARY KEY (id),
	CONSTRAINT customer_un UNIQUE (name, mobile)
);


-- public.lookup definition

-- Drop table

-- DROP TABLE public.lookup;

CREATE TABLE public.lookup (
	id serial4 NOT NULL,
	category varchar NULL,
	"label" varchar NOT NULL,
	value varchar NOT NULL,
	active bool NOT NULL DEFAULT true,
	CONSTRAINT lookup_pk PRIMARY KEY (id)
);


-- public.product definition

-- Drop table

-- DROP TABLE public.product;

CREATE TABLE public.product (
	id serial4 NOT NULL,
	title varchar NOT NULL,
	active bool NULL DEFAULT true,
	description varchar NULL,
	mfr varchar NULL,
	category varchar NULL,
	more_props json NULL,
	hsn_code varchar NULL,
	product_code varchar NULL,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	brand varchar NULL,
	pack int4 NOT NULL DEFAULT 1,
	CONSTRAINT product_pk PRIMARY KEY (id),
	CONSTRAINT product_un UNIQUE (title)
);


-- public.vendor definition

-- Drop table

-- DROP TABLE public.vendor;

CREATE TABLE public.vendor (
	id serial4 NOT NULL,
	business_name varchar NOT NULL,
	active bool NULL DEFAULT true,
	more_props json NULL,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	active bool NOT NULL DEFAULT true,
	"location" varchar(80) NULL,
	full_name varchar(40) NOT NULL,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	"password" varchar NULL,
	last_login timestamptz NULL,
	role_id int4 NULL,
	CONSTRAINT app_user_pk PRIMARY KEY (id),
	CONSTRAINT app_user_un UNIQUE (email),
	CONSTRAINT app_user_fk FOREIGN KEY (role_id) REFERENCES public.app_role(id)
);


-- public.purchase_invoice definition

-- Drop table

-- DROP TABLE public.purchase_invoice;

CREATE TABLE public.purchase_invoice (
	id serial4 NOT NULL,
	invoice_no varchar NOT NULL,
	invoice_date date NOT NULL,
	vendor_id int4 NOT NULL,
	active bool NOT NULL DEFAULT true,
	status varchar NOT NULL DEFAULT 'NEW'::character varying,
	grn varchar NULL,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	purchase_order_id varchar NULL,
	"comments" varchar NULL,
	total float4 NULL,
	pay_mode varchar NULL,
	pay_date date NULL,
	pay_refno varchar NULL,
	pay_amount numeric(12, 2) NULL,
	pay_comments varchar NULL,
	CONSTRAINT purchase_invoice_pk PRIMARY KEY (id),
	CONSTRAINT purchase_invoice_un UNIQUE (invoice_no, vendor_id),
	CONSTRAINT purchase_invoice_fk FOREIGN KEY (vendor_id) REFERENCES public.vendor(id)
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
	status varchar NOT NULL DEFAULT 'NEW'::character varying,
	active bool NOT NULL DEFAULT true,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	total numeric(12, 2) NULL,
	ptr_value float4 NULL,
	CONSTRAINT pur_invitem_pk PRIMARY KEY (id),
	CONSTRAINT pur_invitem_un UNIQUE (invoice_id, product_id, batch),
	CONSTRAINT pur_invitem_inv_fk FOREIGN KEY (invoice_id) REFERENCES public.purchase_invoice(id),
	CONSTRAINT pur_invitem_prod_fk FOREIGN KEY (product_id) REFERENCES public.product(id)
);


-- public.sale definition

-- Drop table

-- DROP TABLE public.sale;

CREATE TABLE public.sale (
	id serial4 NOT NULL,
	bill_date timestamp NOT NULL,
	customer_id int4 NULL,
	status varchar NOT NULL DEFAULT 'NEW'::character varying,
	active bool NULL DEFAULT true,
	more_props json NULL,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	archive bool NOT NULL DEFAULT false,
	disc_amount numeric(12, 2) NULL,
	total numeric(12, 2) NULL,
	paymode varchar NULL,
	payrefno varchar NULL,
	disc_code varchar NULL,
	CONSTRAINT sale_pk PRIMARY KEY (id),
	CONSTRAINT sale_cust_fk FOREIGN KEY (customer_id) REFERENCES public.customer(id)
);


-- public.sale_item definition

-- Drop table

-- DROP TABLE public.sale_item;

CREATE TABLE public.sale_item (
	id serial4 NOT NULL,
	sale_id int4 NOT NULL,
	purchase_item_id int4 NOT NULL,
	price float8 NOT NULL,
	qty int4 NOT NULL,
	status varchar NULL,
	"comments" varchar NULL,
	active bool NOT NULL DEFAULT true,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	total numeric(12, 2) NULL,
	CONSTRAINT sale_item_pk PRIMARY KEY (id),
	CONSTRAINT sale_item_un UNIQUE (sale_id, purchase_item_id),
	CONSTRAINT sale_item_pi_fk FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_invoice_item(id),
	CONSTRAINT sale_item_sale_fk FOREIGN KEY (sale_id) REFERENCES public.sale(id)
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


-- public.product_price definition

-- Drop table

-- DROP TABLE public.product_price;

CREATE TABLE public.product_price (
	id serial4 NOT NULL,
	item_id int4 NOT NULL,
	price float4 NOT NULL,
	"comments" varchar NULL,
	active bool NOT NULL DEFAULT true,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	eff_date date NOT NULL DEFAULT CURRENT_DATE,
	CONSTRAINT product_price_pk PRIMARY KEY (id),
	CONSTRAINT product_price_item_fk FOREIGN KEY (item_id) REFERENCES public.purchase_invoice_item(id)
);