import type { Tenant } from '../types.js';

export const MOCK_TENANT: Tenant = {
  tenantKey: 'TEN_LAGO_HOTELS',
  name: 'Lago Hotels',
  createdAt: '2025-01-15T08:00:00Z',
  subscriptions: [
    {
      module: 'revora',
      tier: 'pro',
      status: 'active',
      features: ['response_single', 'anomaly_alerts', 'notify_email', 'notify_whatsapp', 'portfolio_view'],
      limits: {
        platforms: 3,
        competitors: 5,
        reviewsPerMonth: 10000,
        responseDraftsPerMonth: 200,
        requestsPerMinute: 120,
        fetchesPerDay: 24
      },
      activatedAt: '2025-01-15T08:00:00Z',
      // Pro subscription with usage already populated — see RevoraSubscription
      // shape in types.ts. Cast through unknown because base TenantSubscription
      // doesn't carry usage; consumers calling getMySubscription() narrow to
      // RevoraSubscription where these fields are guaranteed.
      ...({
        usage: {
          responseDraftsThisMonth: 47,
          responseDraftsResetAt: '2025-06-01T00:00:00Z'
        }
      } as object)
    }
  ]
};
