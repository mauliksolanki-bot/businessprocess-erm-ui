import Script from "next/script";

export function NewRelicBrowserSnippet() {
    const snippet = process.env.NEXT_PUBLIC_NEW_RELIC_BROWSER_SNIPPET?.trim();

    if (!snippet) {
        return null;
    }

    return <Script id="new-relic-browser-snippet" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: snippet }} />;
}