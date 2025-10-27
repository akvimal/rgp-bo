-- Drop table

-- DROP TABLE public.accounts;

CREATE TABLE public.accounts (
	id serial4 NOT NULL,
	session_id varchar(255) NOT NULL,
	message jsonb NOT NULL,
	CONSTRAINT accounts_pkey PRIMARY KEY (id)
);


-- public.app_role definition

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


-- public.langchain_chat_histories definition

-- Drop table

-- DROP TABLE public.langchain_chat_histories;

CREATE TABLE public.langchain_chat_histories (
	id serial4 NOT NULL,
	session_id varchar(255) NOT NULL,
	message jsonb NOT NULL,
	CONSTRAINT langchain_chat_histories_pkey PRIMARY KEY (id)
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

