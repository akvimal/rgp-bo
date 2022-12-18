-- app_role definition

-- Drop table

-- DROP TABLE app_role;

CREATE TABLE app_role (
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

-- customer definition

-- Drop table

-- DROP TABLE customer;

CREATE TABLE customer (
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
	city varchar NULL,
	state varchar NULL,
	pincode varchar NULL,
	source_type varchar NULL,
	source_desc varchar NULL,
	"location" varchar NULL,
	CONSTRAINT customer_pk PRIMARY KEY (id),
	CONSTRAINT customer_un UNIQUE (name, mobile)
);


-- lookup definition

-- Drop table

-- DROP TABLE lookup;

CREATE TABLE lookup (
	id serial4 NOT NULL,
	category varchar NULL,
	"label" varchar NOT NULL,
	value varchar NOT NULL,
	active bool NOT NULL DEFAULT true,
	CONSTRAINT lookup_pk PRIMARY KEY (id)
);

-- product definition

-- Drop table

-- DROP TABLE product;

CREATE TABLE product (
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
	CONSTRAINT product_pk PRIMARY KEY (id),
	CONSTRAINT product_un UNIQUE (title)
);

-- vendor definition

-- Drop table

-- DROP TABLE vendor;

CREATE TABLE vendor (
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

-- app_user definition

-- Drop table

-- DROP TABLE app_user;

CREATE TABLE app_user (
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
	CONSTRAINT app_user_fk FOREIGN KEY (role_id) REFERENCES app_role(id)
);

-- purchase_invoice definition

-- Drop table

-- DROP TABLE purchase_invoice;

CREATE TABLE purchase_invoice (
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
	CONSTRAINT purchase_invoice_fk FOREIGN KEY (vendor_id) REFERENCES vendor(id)
);

-- purchase_invoice_item definition

-- Drop table

-- DROP TABLE purchase_invoice_item;

CREATE TABLE purchase_invoice_item (
	id serial4 NOT NULL,
	invoice_id int4 NOT NULL,
	product_id int4 NOT NULL,
	batch varchar NULL,
	exp_date date NULL,
	ptr_cost float8 NOT NULL,
	mrp_cost float8 NOT NULL,
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
	CONSTRAINT pur_invitem_pk PRIMARY KEY (id),
	CONSTRAINT pur_invitem_un UNIQUE (invoice_id, product_id, batch),
	CONSTRAINT pur_invitem_inv_fk FOREIGN KEY (invoice_id) REFERENCES purchase_invoice(id),
	CONSTRAINT pur_invitem_prod_fk FOREIGN KEY (product_id) REFERENCES product(id)
);

-- sale definition

-- Drop table

-- DROP TABLE sale;

CREATE TABLE sale (
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
	total numeric(12, 2) NULL,
	paymode varchar NULL,
	payrefno varchar NULL,
	CONSTRAINT sale_pk PRIMARY KEY (id),
	CONSTRAINT sale_cust_fk FOREIGN KEY (customer_id) REFERENCES customer(id)
);

-- sale_item definition

-- Drop table

-- DROP TABLE sale_item;

CREATE TABLE sale_item (
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
	CONSTRAINT sale_item_pi_fk FOREIGN KEY (purchase_item_id) REFERENCES purchase_invoice_item(id),
	CONSTRAINT sale_item_sale_fk FOREIGN KEY (sale_id) REFERENCES sale(id)
);

-- vendor_pricelist definition

-- Drop table

-- DROP TABLE vendor_pricelist;

CREATE TABLE vendor_pricelist (
	id serial4 NOT NULL,
	vendor_id int4 NOT NULL,
	eff_date date NOT NULL,
	product_id int4 NOT NULL,
	pts float4 NOT NULL,
	mrp float4 NOT NULL,
	shipper_pack varchar NULL,
	CONSTRAINT vendor_pricelist_pk PRIMARY KEY (id),
	CONSTRAINT pricelist_prod_fk FOREIGN KEY (product_id) REFERENCES product(id),
	CONSTRAINT pricelist_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendor(id)
);

-- product_price definition

-- Drop table

-- DROP TABLE product_price;

CREATE TABLE product_price (
	id serial4 NOT NULL,
	item_id int4 NOT NULL,
	price int4 NOT NULL,
	"comments" varchar NULL,
	active bool NOT NULL DEFAULT true,
	archive bool NOT NULL DEFAULT false,
	created_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_on timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_by int4 NULL,
	updated_by int4 NULL,
	eff_date date NOT NULL DEFAULT CURRENT_DATE,
	CONSTRAINT product_price_pk PRIMARY KEY (id),
	CONSTRAINT product_price_un UNIQUE (item_id, eff_date),
	CONSTRAINT product_price_item_fk FOREIGN KEY (item_id) REFERENCES purchase_invoice_item(id)
);

-- stock_view source

CREATE OR REPLACE VIEW stock_view
AS SELECT pii.id,
    pi.invoice_no,
    pi.invoice_date,
    pii.invoice_id,
    p.title,
    p.more_props,
    pii.batch,
    pii.exp_date AS expdate,
    pii.mrp_cost,
    pii.ptr_cost,
    pii.sale_price,
    pii.tax_pcnt,
    pii.qty AS purchase_qty,
    pii.qty - COALESCE(x.total_qty, 0::bigint) AS available_qty,
    (date_part('year'::text, now()) - date_part('year'::text, pi.invoice_date)) * 12::double precision + (date_part('month'::text, now()) - date_part('month'::text, pi.invoice_date)) AS old_with_us,
    (date_part('year'::text, pii.exp_date) - date_part('year'::text, now())) * 12::double precision + (date_part('month'::text, pii.exp_date) - date_part('month'::text, now())) AS life_left
   FROM purchase_invoice_item pii
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     JOIN product p ON p.id = pii.product_id
     LEFT JOIN ( SELECT si.purchase_item_id,
            sum(si.qty) AS total_qty
           FROM sale_item si
             JOIN sale s ON s.id = si.sale_id
          WHERE s.status::text = 'COMPLETE'::text
          GROUP BY si.purchase_item_id) x ON x.purchase_item_id = pii.id
  WHERE pii.status::text = 'VERIFIED'::text AND (pi.status::text = ANY (ARRAY['RECEIVED'::text, 'PAID'::text]));
  
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
  

  INSERT INTO pharma4.app_role
("name", permissions, "locked", active, archive, created_on, updated_on, created_by, updated_by)
VALUES('Admin', '[{"resource":"site","path":["/secure/dashboard","/secure/profile"]},{"resource":"roles","path":"/secure/roles","policies":[{"action":"read","path":"","properties":["name","permissions"]},{"action":"add","path":"/new","properties":["name","permissions"]},{"action":"edit","path":"/edit","properties":["name","permissions"]},{"action":"delete"}]},{"resource":"users","path":"/secure/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role"]},{"action":"delete"}]},{"resource":"products","path":"/secure/products","policies":[{"action":"read","path":"/list","properties":["title","description"]},{"action":"add","path":"/new","properties":["title","description"]},{"action":"edit","path":"/edit","properties":["title"]},{"action":"delete"}]},{"resource":"vendors","path":"/secure/vendors","policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"delete"}]},{"resource":"purchases","path":"/secure/purchases","policies":[{"action":"read","path":"/list","properties":["name"]},{"action":"add","path":"/new","properties":["name"]},{"action":"edit","path":"/edit","properties":["name"]},{"action":"delete"}]},{"resource":"stock","path":"/secure/purchases/stock","policies":[{"action":"read","properties":["ptrcost"]}]},{"resource":"customers","path":"/secure/customers","policies":[{"action":"read","properties":[]}]},{"resource":"sales","path":"/secure/sales","data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]},{"action":"bill","path":"/bill/print"}]}]', false, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0);

INSERT INTO pharma4.app_role
("name", permissions, "locked", active, archive, created_on, updated_on, created_by, updated_by)
VALUES('User', '[{"resource":"site","path":["/secure/dashboard","/secure/profile"]},{"resource":"sales","path":"/secure/sales","policies":[{"action":"read","properties":[]},{"action":"add","path":"/new","properties":[]}]}]', false, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0);