/**
 * Item Type Enum
 * Defines the type of purchase invoice item
 */
export enum ItemType {
  /** Regular purchase item - will be added to stock when invoice completes */
  REGULAR = 'REGULAR',

  /** Item being returned to vendor - will not be added to stock */
  RETURN = 'RETURN',

  /** Item already supplied via delivery challan - already in stock */
  SUPPLIED = 'SUPPLIED',
}

/**
 * Human-readable labels for item types
 */
export const ItemTypeLabels: Record<ItemType, string> = {
  [ItemType.REGULAR]: 'Regular Item',
  [ItemType.RETURN]: 'Return to Vendor',
  [ItemType.SUPPLIED]: 'Already Supplied',
};

/**
 * Description for each item type
 */
export const ItemTypeDescriptions: Record<ItemType, string> = {
  [ItemType.REGULAR]: 'Normal purchase item that will be added to stock',
  [ItemType.RETURN]: 'Item being returned to vendor - will not add to stock',
  [ItemType.SUPPLIED]: 'Item already received via delivery challan',
};
