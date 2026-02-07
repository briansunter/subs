import { defineConfig } from "vitepress";

// Get repository name for base path
// If deploying to GitHub Pages, this should match your repository name
// For local development, use '/' or remove the base property
const base = process.env.DOCS_BASE || "/";

export default defineConfig({
  base,
  title: "subs",
  description: "Production-ready email signup API with invisible bot protection and Google Sheets",

  // Ignore dead links during build
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Deploy", link: "/guide/deployment" },
      { text: "API", link: "/guide/api" },
      { text: "GitHub", link: "https://github.com/briansunter/subs" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Deployment", link: "/guide/deployment" },
          { text: "Google Sheets Setup", link: "/guide/google-sheets" },
          { text: "Embedding Forms", link: "/guide/integration" },
          { text: "Cloudflare Turnstile", link: "/guide/turnstile" },
          { text: "API Reference", link: "/guide/api" },
          { text: "Prometheus Metrics", link: "/guide/prometheus" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "Configuration", link: "/reference/configuration" }],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/briansunter/subs" }],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present",
    },

    search: {
      provider: "local",
    },
  },

  markdown: {
    codeTransformers: [
      // Transform code blocks for better syntax highlighting
    ],
  },

  vite: {
    build: {
      // Improve build performance
      minify: "esbuild",
    },
  },
});
