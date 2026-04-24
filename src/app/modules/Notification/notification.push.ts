import webpush from "web-push";
import config from "../../../config";

webpush.setVapidDetails(
  config.vapid.subject as string,
  config.vapid.publicKey as string,
  config.vapid.privateKey as string,
);

export type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export const sendPushNotification = async (
  subscription: PushSubscriptionData,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    link?: string;
    tag?: string;
  },
): Promise<boolean> => {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? "/icon-192x192.png",
        badge: payload.badge ?? "/badge-72x72.png",
        link: payload.link ?? "/",
        tag: payload.tag ?? "default",
      }),
    );
    return true;
  } catch (err: any) {
    // 410 = subscription expired — should be removed from DB
    if (err.statusCode === 410) {
      return false;
    }
    console.error("Push notification failed:", err.message);
    return false;
  }
};

export { webpush };
