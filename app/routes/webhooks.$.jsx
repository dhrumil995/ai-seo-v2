import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);
    return new Response(null, { status: 200 });
  } catch (error) {
    // Expected by Shopify when receiving invalid HMAC signatures
    return new Response("Unauthorized", { status: 401 });
  }
};