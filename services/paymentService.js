import crypto from 'crypto';

/**
 * Central entry point called from orderController.js after an order is created.
 * Returns { status, providerRef, rawResponse } which gets saved on the Payment doc.
 *
 * status values written here should map to the Payment model's enum:
 * 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
 */
export async function initiatePayment(method, { order }) {
  switch (method) {
    case 'cod':
      return initiateCod(order);
    case 'jazzcash':
      return initiateJazzCash(order);
    case 'easypaisa':
      return initiateEasypaisa(order);
    case 'debit_card':
      return initiateCardPayment(order);
    default:
      throw new Error(`Unsupported payment method: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Cash on Delivery — nothing to call, just mark it pending collection.
// ---------------------------------------------------------------------------
async function initiateCod(order) {
  return {
    status: 'pending',
    providerRef: '',
    rawResponse: { note: 'Cash on Delivery — collected at delivery time' },
  };
}

// ---------------------------------------------------------------------------
// JazzCash — Mobile Wallet / Card (Hosted Checkout Page, HCP) flow.
// JazzCash's checkout is redirect-based: you build a signed form/payload and
// the customer is redirected to JazzCash to complete payment, then JazzCash
// posts back to your configured return URL. `initiatePayment` here builds
// that signed payload so the frontend/route handler can redirect the user.
//
// Required env vars:
//   JAZZCASH_MERCHANT_ID
//   JAZZCASH_PASSWORD
//   JAZZCASH_INTEGRITY_SALT
// ---------------------------------------------------------------------------
async function initiateJazzCash(order) {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT;

  if (!merchantId || !password || !integritySalt) {
    return {
      status: 'failed',
      providerRef: '',
      rawResponse: { error: 'JazzCash credentials missing in environment' },
    };
  }

  const now = new Date();
  const txnDateTime = formatJazzCashDate(now);
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour expiry
  const txnExpiryDateTime = formatJazzCashDate(expiry);
  const txnRefNo = `T${now.getTime()}`;

  const params = {
    pp_Version: '1.1',
    pp_TxnType: 'MWALLET',
    pp_Language: 'EN',
    pp_MerchantID: merchantId,
    pp_SubMerchantID: '',
    pp_Password: password,
    pp_BankID: '',
    pp_ProductID: '',
    pp_TxnRefNo: txnRefNo,
    pp_Amount: String(Math.round(order.total * 100)), // JazzCash expects amount in paisa, no decimals
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: txnDateTime,
    pp_BillReference: order.orderNumber,
    pp_Description: `Order ${order.orderNumber}`,
    pp_TxnExpiryDateTime: txnExpiryDateTime,
    pp_ReturnURL: process.env.JAZZCASH_RETURN_URL || '',
    ppmpf_1: String(order._id),
  };

  const secureHash = buildJazzCashHash(params, integritySalt);

  return {
    status: 'processing',
    providerRef: txnRefNo,
    rawResponse: {
      gateway: 'jazzcash',
      checkoutUrl:
        process.env.JAZZCASH_ENV === 'live'
          ? 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform'
          : 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform',
      fields: { ...params, pp_SecureHash: secureHash },
    },
  };
}

function formatJazzCashDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function buildJazzCashHash(params, integritySalt) {
  // JazzCash requires all pp_ fields sorted alphabetically by key, concatenated
  // with '&', prefixed with the integrity salt, then HMAC-SHA256 signed.
  const sortedKeys = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort();
  const concatenated = sortedKeys.map((k) => params[k]).join('&');
  const stringToHash = `${integritySalt}&${concatenated}`;
  return crypto.createHmac('sha256', integritySalt).update(stringToHash).digest('hex');
}

// ---------------------------------------------------------------------------
// Easypaisa — Open API (transaction request signed with a hash key).
//
// Required env vars:
//   EASYPAISA_STORE_ID
//   EASYPAISA_HASH_KEY
// ---------------------------------------------------------------------------
async function initiateEasypaisa(order) {
  const storeId = process.env.EASYPAISA_STORE_ID;
  const hashKey = process.env.EASYPAISA_HASH_KEY;

  if (!storeId || !hashKey) {
    return {
      status: 'failed',
      providerRef: '',
      rawResponse: { error: 'Easypaisa credentials missing in environment' },
    };
  }

  const orderRefNum = `EP${Date.now()}`;
  const payload = {
    storeId,
    orderId: orderRefNum,
    transactionAmount: order.total.toFixed(2),
    transactionType: 'MA', // Mobile Account
    mobileAccountNo: '', // collected from customer at the payment step
  };

  const hashString = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('&');
  const merchantHashedReq = crypto.createHmac('sha256', hashKey).update(hashString).digest('base64');

  return {
    status: 'processing',
    providerRef: orderRefNum,
    rawResponse: {
      gateway: 'easypaisa',
      endpoint:
        process.env.EASYPAISA_ENV === 'live'
          ? 'https://easypay.easypaisa.com.pk/easypay/Index.jsf'
          : 'https://easypaystg.easypaisa.com.pk/easypay/Index.jsf',
      payload,
      merchantHashedReq,
    },
  };
}

// ---------------------------------------------------------------------------
// Debit Card — generic card gateway. Swap the endpoint/field names for
// whichever acquirer you sign with (HBL PayFast, Bank Alfalah, Stripe, etc.)
// once you have real sandbox docs — this keeps the same call shape either way.
//
// Required env vars:
//   CARD_GATEWAY_API_KEY
//   CARD_GATEWAY_SECRET
// ---------------------------------------------------------------------------
async function initiateCardPayment(order) {
  const apiKey = process.env.CARD_GATEWAY_API_KEY;
  const secret = process.env.CARD_GATEWAY_SECRET;

  if (!apiKey || !secret) {
    return {
      status: 'failed',
      providerRef: '',
      rawResponse: { error: 'Card gateway credentials missing in environment' },
    };
  }

  try {
    const res = await fetch(process.env.CARD_GATEWAY_URL || 'https://api.example-card-gateway.com/v1/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        amount: Math.round(order.total * 100),
        currency: 'PKR',
        reference: order.orderNumber,
      }),
    });
    const data = await res.json();

    return {
      status: res.ok ? 'processing' : 'failed',
      providerRef: data.id || '',
      rawResponse: data,
    };
  } catch (err) {
    return {
      status: 'failed',
      providerRef: '',
      rawResponse: { error: err.message },
    };
  }
}