/**
 * Customer-facing order fulfillment labels and filters.
 *
 * Linked to supplier flow:
 * - **Pending** — Order paid / placed; not yet shipped (typically `unfulfilled`; supplier assignment pre-ship).
 * - **Processing** — Supplier is preparing the order (`processing` on `orders` when set).
 * - **Fulfilled** — Supplier marked shipped; tracking may be available. We do not show a separate
 *   “delivered” or “in transit” state from 4PX/carrier final delivery — those legacy DB values map here.
 * - **Cancelled** — Order cancelled.
 */

export const CUSTOMER_ORDER_STATUS_TABS = [
  'All',
  'Pending',
  'Processing',
  'Fulfilled',
  'Cancelled',
] as const

export type CustomerOrderStatusTab = (typeof CUSTOMER_ORDER_STATUS_TABS)[number]

/** Normalize DB values (e.g. `in-transit` vs `in_transit`). */
export function normalizeOrderFulfillmentStatus(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return 'unfulfilled'
  return String(raw).trim().toLowerCase().replace(/-/g, '_')
}

/**
 * Single label shown to customers (list, detail, account home).
 * `in_transit` / `in-transit` are grouped under **Fulfilled** (shipped; no carrier-delivered sync).
 */
export function getCustomerFulfillmentLabel(raw: string | null | undefined): string {
  const key = normalizeOrderFulfillmentStatus(raw)
  switch (key) {
    case 'fulfilled':
    case 'in_transit':
      return 'Fulfilled'
    case 'processing':
      return 'Processing'
    case 'cancelled':
      return 'Cancelled'
    case 'unfulfilled':
    case 'pending':
      return 'Pending'
    default:
      return key ? key.replace(/_/g, ' ') : 'Pending'
  }
}

export function customerOrderMatchesStatusTab(
  fulfillmentStatus: string | null | undefined,
  tab: string
): boolean {
  if (tab === 'All') return true
  return getCustomerFulfillmentLabel(fulfillmentStatus) === tab
}

export function customerFulfillmentBadgeClass(fulfillmentStatus: string | null | undefined): string {
  const label = getCustomerFulfillmentLabel(fulfillmentStatus)
  if (label === 'Fulfilled') return 'bg-green-100 text-green-800'
  if (label === 'Cancelled') return 'bg-red-100 text-red-800'
  if (label === 'Processing') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
}

/** Stats: orders that are done from the customer’s perspective (shipped / fulfilled bucket). */
export function isCustomerFulfilledBucket(fulfillmentStatus: string | null | undefined): boolean {
  const key = normalizeOrderFulfillmentStatus(fulfillmentStatus)
  return key === 'fulfilled' || key === 'in_transit'
}
