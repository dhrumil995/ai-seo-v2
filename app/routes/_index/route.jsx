import { Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw await login(request);
  }
  return { showForm: Boolean(login) };
};

export default function AppHome() {
  const { showForm } = useLoaderData();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Boost Store Sales with AI SEO</h1>
        <p style={styles.subtitle}>
          Automatically generate high-converting, search-engine-optimized product titles and meta descriptions using Gemini AI in 1 click.
        </p>

        {showForm && (
          <Form method="post" action="/auth/login" style={styles.form}>
            <label style={styles.label}>
              <span>Enter your store domain to get started</span>
              <input
                type="text"
                name="shop"
                placeholder="my-shop-domain.myshopify.com"
                style={styles.input}
                required
              />
            </label>
            <button type="submit" style={styles.button}>
              Install App
            </button>
          </Form>
        )}
      </header>

      <section style={styles.features}>
        <div style={styles.featureCard}>
          <h3>⚡ 1-Click AI SEO</h3>
          <p>Instantly generate keyword-rich product descriptions and Google-friendly titles in seconds.</p>
        </div>
        <div style={styles.featureCard}>
          <h3>🚀 Batch Catalog Optimization</h3>
          <p>Optimize up to 25 catalog items simultaneously without tedious manual work.</p>
        </div>
        <div style={styles.featureCard}>
          <h3>📈 Organic Traffic Growth</h3>
          <p>Improve your search engine rankings on Google and drive consistent organic buyer traffic.</p>
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'San Francisco', Roboto, 'Segoe UI', 'Helvetica Neue', sans-serif",
    maxWidth: "900px",
    margin: "0 auto",
    padding: "60px 20px",
    textAlign: "center",
    color: "#202223",
  },
  header: {
    marginBottom: "50px",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "700",
    marginBottom: "16px",
  },
  subtitle: {
    fontSize: "1.2rem",
    color: "#6d7175",
    maxWidth: "600px",
    margin: "0 auto 30px auto",
    lineHeight: "1.5",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "0.95rem",
    color: "#4a4a4a",
  },
  input: {
    padding: "12px 16px",
    fontSize: "1rem",
    borderRadius: "8px",
    border: "1px solid #c9cccf",
    width: "320px",
    textAlign: "center",
  },
  button: {
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: "600",
    color: "#ffffff",
    backgroundColor: "#008060",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "24px",
    marginTop: "40px",
  },
  featureCard: {
    padding: "24px",
    borderRadius: "12px",
    backgroundColor: "#f6f6f7",
    textAlign: "left",
  },
};