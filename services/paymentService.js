// Clean placeholder abstractions for real payment gateway integrations.
// Swap the internals of each function for real JazzCash / Easypaisa / card-gateway
// API calls when credentials are available. Nothing here fakes a successful payment;
// COD is the only method that is "paid" immediately (paid on delivery, tracked separately).

export async function initiateCodPayment({ order }) {
  return {
    status: 'pending',
    providerRef: `COD-${order.orderNumber}`,
    rawResponse: { note: 'Cash on Delivery — settled at delivery time' },
  };
}

export async function initiateJazzCashPayment({ order }) {
  // TODO: call JazzCash's real API using JAZZCASH_MERCHANT_ID / PASSWORD / INTEGRITY_SALT
  // from environment variables (server-side only — never expose these to the client).
  throw new Error('JazzCash integration not yet configured');
}

export async function initiateEasypaisaPayment({ order }) {
  // TODO: call Easypaisa's real API using EASYPAISA_STORE_ID / HASH_KEY.
  throw new Error('Easypaisa integration not yet configured');
}

export async function initiateCardPayment({ order }) {
  // TODO: call the card gateway (Stripe/other) using CARD_GATEWAY_API_KEY / SECRET.
  throw new Error('Card gateway integration not yet configured');
}

export async function initiatePayment(method, ctx) {
  switch (method) {
    case 'cod':
      return initiateCodPayment(ctx);
    case 'jazzcash':
      return initiateJazzCashPayment(ctx);
    case 'easypaisa':
      return initiateEasypaisaPayment(ctx);
    case 'debit_card':
    case 'credit_card':
      return initiateCardPayment(ctx);
    default:
      throw new Error('Unsupported payment method');
  }
}
