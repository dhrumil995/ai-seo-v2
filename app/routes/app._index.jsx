import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { GoogleGenAI } from "@google/genai";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);

  // Enforce 7-day free trial or active plan
  await billing.require({
    plans: [MONTHLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  // Fetch the first 10 products from the store
  const response = await admin.graphql(
    `#graphql
      query getProducts {
        products(first: 10) {
          edges {
            node {
              id
              title
              descriptionHtml
              featuredImage {
                url
                altText
              }
            }
          }
        }
      }`
  );

  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges || [];

  return { products };
};

export const action = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);

  // Enforce billing check before action
  await billing.require({
    plans: [MONTHLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  const formData = await request.formData();
  const productId = formData.get("productId");
  const currentTitle = formData.get("currentTitle");
  const currentDescription = formData.get("currentDescription");

  // Initialize Gemini API
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Prompt Gemini for SEO-optimized content
  const aiResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are a world-class E-commerce SEO Expert. 
Optimize the following product for Google Search visibility.
Original Title: ${currentTitle}
Original Description: ${currentDescription}

Provide your response strictly in the following JSON format without Markdown formatting:
{
  "title": "Optimized SEO Product Title (max 60 chars)",
  "description": "Engaging, keyword-rich meta description (max 150 chars)"
}`,
  });

  let seoData = {
    title: currentTitle,
    description: currentDescription,
  };

  try {
    const rawText = aiResponse.text.replace(/```json|```/g, "").trim();
    seoData = JSON.parse(rawText);
  } catch (e) {
    console.error("AI Response Parsing Error:", e);
  }

  // Update product in Shopify via Admin GraphQL API
  const updateResponse = await admin.graphql(
    `#graphql
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          id: productId,
          title: seoData.title,
          descriptionHtml: `<p>${seoData.description}</p>`,
        },
      },
    }
  );

  const updateJson = await updateResponse.json();

  return {
    success: true,
    updatedProduct: updateJson.data?.productUpdate?.product,
  };
};

export default function Index() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSubmitting = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("SEO updated successfully!");
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="AI SEO Manager">
      <s-section heading="Optimize Store Products">
        <s-paragraph>
          Select a product below to instantly generate and apply high-converting, Google-optimized titles and descriptions using Gemini AI.
        </s-paragraph>

        <s-stack direction="block" gap="large">
          {products.map(({ node: product }) => (
            <s-box
              key={product.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="inline" gap="base" align="space-between">
                <div>
                  <s-heading>{product.title}</s-heading>
                  <s-paragraph>
                    {product.descriptionHtml?.replace(/<[^>]*>?/gm, "").substring(0, 100) || "No description provided."}...
                  </s-paragraph>
                </div>

                <fetcher.Form method="POST">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="currentTitle" value={product.title} />
                  <input
                    type="hidden"
                    name="currentDescription"
                    value={product.descriptionHtml || ""}
                  />
                  <s-button
                    type="submit"
                    variant="primary"
                    {...(isSubmitting && fetcher.formData?.get("productId") === product.id
                      ? { loading: true }
                      : {})}
                  >
                    Optimize with AI
                  </s-button>
                </fetcher.Form>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);