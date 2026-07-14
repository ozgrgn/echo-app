import type { Tenant } from '@talkwo/echo-core';

export const MOCK_TENANT: Tenant = {
  tenantKey: 'TEN_DEMO_AURELIA',
  name: 'Aurelia Hotels',
  createdAt: '2025-01-15T08:00:00Z',
  subscriptions: [
    {
      module: 'echo',
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
      // Pro subscription with usage already populated — see EchoSubscription
      // shape in types.ts. Cast through unknown because base TenantSubscription
      // doesn't carry usage; consumers calling getMySubscription() narrow to
      // EchoSubscription where these fields are guaranteed.
      ...({
        usage: {
          responseDraftsThisMonth: 47,
          responseDraftsResetAt: '2025-06-01T00:00:00Z'
        }
      } as object)
    }
  ]
};
