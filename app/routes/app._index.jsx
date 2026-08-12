import process from "process";
import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { GoogleGenAI } from "@google/genai";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);

  // Verify active billing subscription
  await billing.require({
    plans: [MONTHLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  // Fetch up to 25 store products
  const response = await admin.graphql(
    `#graphql
      query getProducts {
        products(first: 25) {
          edges {
            node {
              id
              title
              descriptionHtml
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

  await billing.require({
    plans: [MONTHLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // ----------------------------------------------------
  // BATCH / BULK OPTIMIZATION HANDLER
  // ----------------------------------------------------
  if (actionType === "bulk_optimize") {
    const rawProducts = formData.get("productsData");
    const productsToProcess = JSON.parse(rawProducts || "[]");

    let successCount = 0;

    for (const item of productsToProcess) {
      try {
        const aiResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Optimize this e-commerce product for Search Engine Optimization (SEO).
Original Title: ${item.title}
Original Description: ${item.description || "No description"}

Return response strictly as a valid JSON object without markdown fences:
{
  "title": "Optimized Short SEO Title (max 60 chars)",
  "description": "Engaging meta description with strong buyer intent (max 150 chars)"
}`,
        });

        const rawText = aiResponse.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(rawText);

        await admin.graphql(
          `#graphql
            mutation updateProduct($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                }
              }
            }`,
          {
            variables: {
              input: {
                id: item.id,
                title: parsed.title,
                descriptionHtml: `<p>${parsed.description}</p>`,
              },
            },
          }
        );

        successCount++;
      } catch (err) {
        console.error(`Bulk optimization failed for ${item.id}:`, err);
      }
    }

    return {
      success: true,
      bulk: true,
      count: successCount,
    };
  }

  // ----------------------------------------------------
  // SINGLE PRODUCT OPTIMIZATION HANDLER
  // ----------------------------------------------------
  const productId = formData.get("productId");
  const currentTitle = formData.get("currentTitle");
  const currentDescription = formData.get("currentDescription");

  const aiResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Optimize this e-commerce product for Search Engine Optimization (SEO).
Original Title: ${currentTitle}
Original Description: ${currentDescription}

Return response strictly as a valid JSON object without markdown fences:
{
  "title": "Optimized Short SEO Title (max 60 chars)",
  "description": "Engaging meta description with strong buyer intent (max 150 chars)"
}`,
  });

  let seoData = { title: currentTitle, description: currentDescription };
  try {
    const rawText = aiResponse.text.replace(/```json|```/g, "").trim();
    seoData = JSON.parse(rawText);
  } catch (e) {
    console.error("AI Parsing Error:", e);
  }

  const updateResponse = await admin.graphql(
    `#graphql
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
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
    bulk: false,
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
      if (fetcher.data.bulk) {
        shopify.toast.show(`Successfully optimized ${fetcher.data.count} products!`);
      } else {
        shopify.toast.show("SEO updated successfully!");
      }
    }
  }, [fetcher.data, shopify]);

  const bulkData = JSON.stringify(
    products.map(({ node }) => ({
      id: node.id,
      title: node.title,
      description: node.descriptionHtml?.replace(/<[^>]*>?/gm, "") || "",
    }))
  );

  return (
    <s-page heading="AI SEO Writer & Batch Manager">
      <s-section heading="Batch Catalog Optimization">
        <s-paragraph>
          Boost your store&apos;s rank on Google in seconds. Optimize single items or run a full batch sweep across your product catalog using Gemini AI.
        </s-paragraph>

        <s-stack direction="inline" gap="base">
          <fetcher.Form method="POST">
            <input type="hidden" name="actionType" value="bulk_optimize" />
            <input type="hidden" name="productsData" value={bulkData} />
            <s-button
              type="submit"
              variant="primary"
              {...(isSubmitting && fetcher.formData?.get("actionType") === "bulk_optimize"
                ? { loading: true }
                : {})}
            >
              🚀 Batch Optimize All ({products.length} Products)
            </s-button>
          </fetcher.Form>
        </s-stack>
      </s-section>

      <s-section heading="Individual Product Catalog">
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
                  <input type="hidden" name="actionType" value="single" />
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="currentTitle" value={product.title} />
                  <input
                    type="hidden"
                    name="currentDescription"
                    value={product.descriptionHtml || ""}
                  />
                  <s-button
                    type="submit"
                    variant="secondary"
                    {...(isSubmitting && fetcher.formData?.get("productId") === product.id
                      ? { loading: true }
                      : {})}
                  >
                    Optimize
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