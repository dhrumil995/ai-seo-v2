import { useEffect } from "react";
import process from "process";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { GoogleGenAI } from "@google/genai";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  // Require active subscription or free trial
  await billing.require({
    plans: [MONTHLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  return null;
};

export const action = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);

  // Verify billing active state
  await billing.require({
    plans: [MONTHLY_PLAN],
    onFailure: async () => billing.request({ plan: MONTHLY_PLAN }),
  });

  // Initialize Gemini AI
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Generate AI SEO Product Content
  const aiResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Generate an engaging, SEO-optimized title and 2-sentence description for a premium outdoor snowboard.",
  });

  const generatedText = aiResponse.text || "Ultra-Performance All-Mountain Snowboard";
  const [title, ...descParts] = generatedText.split("\n");
  const description = descParts.join(" ") || "Engineered for speed, control, and precision on all mountain terrain.";

  // 2. Create Product with AI Content via Admin GraphQL API
  const response = await admin.graphql(
    `#graphql
      mutation createSeoProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            descriptionHtml
            handle
          }
        }
      }`,
    {
      variables: {
        product: {
          title: title.replace(/[*#]/g, "").trim(),
          descriptionHtml: `<p>${description.replace(/[*#]/g, "").trim()}</p>`,
        },
      },
    },
  );

  const responseJson = await response.json();
  return { product: responseJson.data.productCreate.product };
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("AI SEO Product Created!");
    }
  }, [fetcher.data?.product?.id, shopify]);

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="AI SEO Writer & Optimizer">
      <s-button slot="primary-action" onClick={generateProduct} {...(isLoading ? { loading: true } : {})}>
        Generate AI Product
      </s-button>

      <s-section heading="Boost Store SEO with AI 🚀">
        <s-paragraph>
          Click the button above to automatically generate high-ranking SEO titles and descriptions using Gemini AI and sync them to your store.
        </s-paragraph>
        
        {fetcher.data?.product && (
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-heading>{fetcher.data.product.title}</s-heading>
            <div dangerouslySetInnerHTML={{ __html: fetcher.data.product.descriptionHtml }} />
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);