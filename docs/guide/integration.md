# Embedding Signup Forms

Add a signup form to any website. Four options from simplest to most customizable.

## Option 1: JS SDK (Recommended)

Include the script and point it at a `div`. The form is rendered inline on your page.

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup"></div>
<script>
  SignupEmbed.create('#signup');
</script>
```

### Options

Pass an options object to customize behavior:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup"></div>
<script>
  SignupEmbed.create('#signup', {
    showName: true,         // show name field (default: true)
    sheetTab: 'Newsletter', // target sheet tab
    site: 'my-site',        // site name for multi-sheet setups
  });
</script>
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showName` | boolean | `true` | Show a name input field |
| `sheetTab` | string | server default | Target sheet tab |
| `site` | string | - | Site name for multi-sheet setups |

The form handles submission, loading state, success/error messages, and form reset automatically. It POSTs to `/api/signup/extended` with `source: 'embed'` and `tags: ['web-form']`.

`SignupEmbed.inline()` is an alias for `SignupEmbed.create()`.

## Option 2: Direct HTML Form

No JavaScript needed. Create a plain HTML form that POSTs directly:

```html
<form action="https://your-domain.com/api/signup/form" method="POST">
  <input type="email" name="email" placeholder="Email" required>
  <input type="text" name="name" placeholder="Name">
  <input type="hidden" name="sheetTab" value="Newsletter">
  <button type="submit">Subscribe</button>
</form>
```

This uses the `/api/signup/form` endpoint which accepts `application/x-www-form-urlencoded`. Style the form however you like.

## Option 3: Custom JavaScript

Full control over the request and UI with `fetch`:

```html
<form id="signup-form">
  <input type="email" id="email" placeholder="Email" required>
  <input type="text" id="name" placeholder="Name">
  <button type="submit">Sign Up</button>
  <div id="message"></div>
</form>

<script>
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageEl = document.getElementById('message');

  try {
    const response = await fetch('https://your-domain.com/api/signup/extended', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        name: document.getElementById('name').value,
        sheetTab: 'Newsletter',
        source: 'website',
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      messageEl.textContent = 'Thanks for signing up!';
      e.target.reset();
    } else {
      messageEl.textContent = result.message || 'Something went wrong';
    }
  } catch (error) {
    messageEl.textContent = 'Network error. Please try again.';
  }
});
</script>
```

## Option 4: Iframe Embed

If you need full isolation (e.g., the form runs in its own styling context), use the iframe mode. This loads the built-in form page inside an iframe.

```html
<iframe
  src="https://your-domain.com/"
  width="100%"
  height="520"
  style="border: 0; max-width: 100%;"
  title="Signup form"
  loading="lazy"
></iframe>
```

Or use the JS SDK's iframe helper:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup"></div>
<script>
  SignupEmbed.iframe('#signup', {
    width: '100%',
    height: 520,
    site: 'my-site',
    sheetTab: 'Newsletter',
    redirect: '/thank-you',
  });
</script>
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | string \| number | `'100%'` | Iframe width |
| `height` | string \| number | `520` | Iframe height |
| `site` | string | - | Site name for multi-sheet setups |
| `sheetTab` | string | - | Target sheet tab |
| `redirect` | string | - | Redirect URL after signup (same-origin only) |
| `api` | string | `/api/signup/extended` | Custom API endpoint |

For most use cases, **Option 1 (JS SDK)** is simpler and avoids iframe quirks like fixed height, cross-origin restrictions, and styling isolation.

---

## Framework Examples

### React

```jsx
import { useState } from 'react';

function SignupForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('https://your-domain.com/api/signup/extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, sheetTab: 'Newsletter' }),
      });
      const result = await response.json();
      setStatus(result.success ? 'success' : 'error');
      if (result.success) { setEmail(''); setName(''); }
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Submitting...' : 'Sign Up'}
      </button>
      {status === 'success' && <p>Thanks for signing up!</p>}
      {status === 'error' && <p>Something went wrong.</p>}
    </form>
  );
}
```

### Vue 3

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="email" type="email" placeholder="Email" required>
    <input v-model="name" type="text" placeholder="Name">
    <button type="submit" :disabled="status === 'loading'">
      {{ status === 'loading' ? 'Submitting...' : 'Sign Up' }}
    </button>
    <p v-if="status === 'success'">Thanks for signing up!</p>
    <p v-if="status === 'error'">Something went wrong.</p>
  </form>
</template>

<script setup>
import { ref } from 'vue';

const email = ref('');
const name = ref('');
const status = ref('idle');

const handleSubmit = async () => {
  status.value = 'loading';
  try {
    const response = await fetch('https://your-domain.com/api/signup/extended', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, name: name.value, sheetTab: 'Newsletter' }),
    });
    const result = await response.json();
    status.value = result.success ? 'success' : 'error';
    if (result.success) { email.value = ''; name.value = ''; }
  } catch {
    status.value = 'error';
  }
};
</script>
```

### Svelte

```svelte
<script>
  let email = '';
  let name = '';
  let status = 'idle';

  async function handleSubmit() {
    status = 'loading';
    try {
      const response = await fetch('https://your-domain.com/api/signup/extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, sheetTab: 'Newsletter' }),
      });
      const result = await response.json();
      status = result.success ? 'success' : 'error';
      if (result.success) { email = ''; name = ''; }
    } catch {
      status = 'error';
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="text" bind:value={name} placeholder="Name" />
  <button type="submit" disabled={status === 'loading'}>
    {status === 'loading' ? 'Submitting...' : 'Sign Up'}
  </button>
  {#if status === 'success'}<p>Thanks for signing up!</p>{/if}
  {#if status === 'error'}<p>Something went wrong.</p>{/if}
</form>
```

---

## CORS

Your API's `ALLOWED_ORIGINS` must include your website's domain:

```bash
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com
```

## Troubleshooting

**CORS error**: Add your domain to `ALLOWED_ORIGINS` in `.env` and restart the server.

**Form submits but no data**: Check the API URL, browser console for errors, and Network tab for the response. Verify Google Sheets credentials.

**Validation error**: Ensure `email` is a valid format and `sheetTab` is a string. See [API Reference](/guide/api#validation) for field requirements.

## Next Steps

- **[API Reference](/guide/api)** - All endpoints and schemas
- **[Cloudflare Turnstile](/guide/turnstile)** - Add bot protection to forms
- **[Deployment](/guide/deployment)** - Deploy to production
