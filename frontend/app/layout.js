import "./globals.css";
import GoogleAnalytics from "../components/GoogleAnalytics";

export const metadata = {
    title: "Path2Poll — AI Election Assistant",
    description:
        "Your AI-powered guided election assistant. Understand the election process, timelines, and required steps with a personalized, interactive roadmap.",
    keywords: [
        "election",
        "voting",
        "voter guide",
        "election assistant",
        "AI",
        "Google Gemini",
        "voter registration",
        "election timeline",
    ],
    authors: [{ name: "Path2Poll Team" }],
    openGraph: {
        title: "Path2Poll — AI Election Assistant",
        description:
            "Navigate the voting process with a personalized AI-generated election roadmap.",
        type: "website",
        locale: "en_US",
    },
    twitter: {
        card: "summary_large_image",
        title: "Path2Poll — AI Election Assistant",
        description:
            "Navigate the voting process with a personalized AI-generated election roadmap.",
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className="scroll-smooth">
            <head>
                <meta name="theme-color" content="#06080f" />
                <meta name="color-scheme" content="dark" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
            </head>
            <body className="antialiased">
                <GoogleAnalytics />
                <a href="#main-content" className="skip-link">
                    Skip to main content
                </a>
                {children}
            </body>
        </html>
    );
}
