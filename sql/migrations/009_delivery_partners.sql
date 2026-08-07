CREATE TABLE IF NOT EXISTS public.delivery_partner (
    id serial4 NOT NULL,
    "name" varchar(80) NOT NULL,
    contact_name varchar(80) NULL,
    contact_phone varchar(40) NULL,
    address varchar(200) NULL,
    "comments" varchar(400) NULL,
    active bool DEFAULT true NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by int4 NOT NULL,
    updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by int4 NOT NULL,
    archive bool DEFAULT false NOT NULL,
    CONSTRAINT delivery_partner_pk PRIMARY KEY (id),
    CONSTRAINT delivery_partner_un UNIQUE (name)
);
