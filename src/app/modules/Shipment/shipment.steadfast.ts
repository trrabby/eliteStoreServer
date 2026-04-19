import axios from "axios";
import { steadfastConfig } from "./shipment.config";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type SteadfastOrderPayload = {
  invoice: string; // your order number
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
};

export type SteadfastOrderResponse = {
  status: number;
  consignment_id: string;
  tracking_code: string;
  invoice: string;
};

// Steadfast consignment statuses
export type SteadfastStatus =
  | "pending"
  | "delivered_approval_pending"
  | "partial_delivered_approval_pending"
  | "cancelled_approval_pending"
  | "unknown_approval_pending"
  | "delivered"
  | "partial_delivered"
  | "cancelled"
  | "hold"
  | "in_review"
  | "unknown";

// map steadfast status → our OrderStatus
export const mapSteadfastStatus = (status: SteadfastStatus): string | null => {
  const map: Record<SteadfastStatus, string | null> = {
    pending: "SHIPPED",
    delivered_approval_pending: "OUT_FOR_DELIVERY",
    partial_delivered_approval_pending: "OUT_FOR_DELIVERY",
    cancelled_approval_pending: "OUT_FOR_DELIVERY",
    unknown_approval_pending: "OUT_FOR_DELIVERY",
    delivered: "DELIVERED",
    partial_delivered: "DELIVERED",
    cancelled: "CANCELLED",
    hold: "PROCESSING",
    in_review: "PROCESSING",
    unknown: null, // don't update on unknown
  };

  return map[status] ?? null;
};

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

const headers = () => ({
  "Api-Key": steadfastConfig.apiKey,
  "Secret-Key": steadfastConfig.secretKey,
  "Content-Type": "application/json",
});

// ─────────────────────────────────────────
// STEADFAST API CALLS
// ─────────────────────────────────────────

// create single order on steadfast
export const createSteadfastOrder = async (
  payload: SteadfastOrderPayload,
): Promise<SteadfastOrderResponse> => {
  const response = await axios.post(
    `${steadfastConfig.baseUrl}/create_order`,
    payload,
    { headers: headers() },
  );

  if (response.data?.status !== 200) {
    throw new Error(
      response.data?.message || "Steadfast order creation failed",
    );
  }

  return response.data.consignment;
};

// create bulk orders on steadfast
export const createSteadfastBulkOrders = async (
  orders: SteadfastOrderPayload[],
): Promise<{
  success: SteadfastOrderResponse[];
  failed: { invoice: string; message: string }[];
}> => {
  const response = await axios.post(
    `${steadfastConfig.baseUrl}/create_order/bulk-order`,
    { data: orders },
    { headers: headers() },
  );

  const success: SteadfastOrderResponse[] = [];
  const failed: { invoice: string; message: string }[] = [];

  if (Array.isArray(response.data?.consignment)) {
    for (const item of response.data.consignment) {
      if (item.status === 200) {
        success.push(item);
      } else {
        failed.push({
          invoice: item.invoice,
          message: item.message ?? "Unknown error",
        });
      }
    }
  }

  return { success, failed };
};

// get status by consignment id
export const getSteadfastStatusByConsignmentId = async (
  consignmentId: string,
): Promise<{ status: SteadfastStatus; deliveryStatus: string }> => {
  const response = await axios.get(
    `${steadfastConfig.baseUrl}/status_by_cid/${consignmentId}`,
    { headers: headers() },
  );

  return {
    status: response.data?.delivery_status as SteadfastStatus,
    deliveryStatus: response.data?.delivery_status ?? "unknown",
  };
};

// get status by invoice (our order number)
export const getSteadfastStatusByInvoice = async (
  invoice: string,
): Promise<{ status: SteadfastStatus; consignmentId: string }> => {
  const response = await axios.get(
    `${steadfastConfig.baseUrl}/status_by_invoice/${invoice}`,
    { headers: headers() },
  );

  return {
    status: response.data?.delivery_status as SteadfastStatus,
    consignmentId: response.data?.consignment_id ?? "",
  };
};

// get account balance
export const getSteadfastBalance = async (): Promise<{
  current_balance: number;
  collected_amount: number;
  dispatched_amount: number;
}> => {
  const response = await axios.get(`${steadfastConfig.baseUrl}/get_balance`, {
    headers: headers(),
  });
  return response.data;
};
