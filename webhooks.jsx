import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { topic, shop } = await authenticate.webhook(request);
    console.log(`Webhook received: ${topic} for ${shop}`);
    
    // Shopify HMAC validation succeeds automatically when authenticate.webhook succeeds
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Webhook HMAC verification failed:", error);
    return new Response("Unauthorized", { status: 401 });
  }
};