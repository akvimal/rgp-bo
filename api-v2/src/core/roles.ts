/**
 * Role names the code reasons about (OPERATING_MODES section 3). A login is not a person: the counter login is shared, the
 * personal login carries a person's own HR and ratings, and the owner-operator is the single login of a one-person shop.
 */
export const ROLE = {
  BUSINESS_HEAD: 'Business Head',
  OWNER_OPERATOR: 'Owner-operator',
  STORE_HEAD: 'Store Head',
  SALES_STAFF: 'Sales Staff',
  COUNTER: 'Counter',
  PERSONAL: 'Personal',
  SITE_ADMIN: 'Site Admin',
} as const;

/** Roles that run the whole business for day-to-day work: all stores, every approval. */
export const OWNER_ROLES: string[] = [ROLE.BUSINESS_HEAD, ROLE.OWNER_OPERATOR];

/** Roles that oversee a business or a store. */
export const MANAGER_ROLES: string[] = [ROLE.BUSINESS_HEAD, ROLE.OWNER_OPERATOR, ROLE.STORE_HEAD];

/** Roles a Business Head may give to the people of their business. */
export const ASSIGNABLE_BY_BUSINESS_HEAD: string[] = [ROLE.STORE_HEAD, ROLE.SALES_STAFF, ROLE.COUNTER, ROLE.PERSONAL];

/** Roles the platform admin may create as a business's first login. */
export const ASSIGNABLE_BY_SITE_ADMIN: string[] = [ROLE.BUSINESS_HEAD, ROLE.OWNER_OPERATOR];

/** Roles the app itself relies on: they can be edited but not deleted. */
export const BUILT_IN_ROLES: string[] = [ROLE.BUSINESS_HEAD, ROLE.OWNER_OPERATOR, ROLE.STORE_HEAD, ROLE.SALES_STAFF, ROLE.COUNTER, ROLE.PERSONAL, ROLE.SITE_ADMIN];

export const isOwnerRole = (name: string | null | undefined): boolean => !!name && OWNER_ROLES.includes(name);
export const isManagerRole = (name: string | null | undefined): boolean => !!name && MANAGER_ROLES.includes(name);

/** Accounts that are not a person: they never appear in the "who is serving" list. */
export const NOT_A_PERSON: string[] = [ROLE.COUNTER, ROLE.SITE_ADMIN];
