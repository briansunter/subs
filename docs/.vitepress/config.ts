import { defineConfig } from "vitepress";

// Get repository name for base path
// If deploying to GitHub Pages, this should match your repository name
// For local development, use '/' or remove the base property
const base = process.env.DOCS_BASE || "/";

export default defineConfig({
  base,
  title: "Bun Fastify Email Signup API",
  description: "A high-performance email signup API built with Bun, Fastify, Google Sheets, Discord webhooks, and TypeScript",

  // Ignore dead links during build
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API Reference", link: "/guide/api" },
      { text: "Integration", link: "/guide/integration" },
      {
        text: "GitHub",
        link: "https://github.com/briansunter/subs",
      },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Google Sheets Setup", link: "/guide/google-sheets" },
          { text: "Discord Setup", link: "/guide/discord" },
          { text: "Cloudflare Turnstile", link: "/guide/turnstile" },
          { text: "HTML Form Integration", link: "/guide/integration" },
          { text: "API Reference", link: "/guide/api" },
          { text: "Deployment", link: "/guide/deployment" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Configuration", link: "/reference/configuration" },
          { text: "API Endpoints", link: "/reference/endpoints" },
          { text: "Schemas", link: "/reference/schemas" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/briansunter/subs" },
    ],

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
