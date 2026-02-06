# HTML Form Integration

Embed the signup form on any website. Four options from simplest to most customizable.

## Option 1: Iframe Embed

The simplest approach - embed the built-in form as an iframe.

```html
<iframe
  src="https://your-domain.com/"
  width="100%"
  height="300"
  frameborder="0"
></iframe>
```

Or use the embed script for more control:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.iframe('#signup-container', {
    width: '100%',
    height: '350px',
  });
</script>
```

Customize with URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `api` | Custom API endpoint | `?api=/api/signup/extended` |
| `redirect` | Redirect after signup | `?redirect=/thank-you` |
| `sheetTab` | Default sheet tab | `?sheetTab=Newsletter` |

## Option 2: Inline Form

Inject the form directly into your page:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.inline('#signup-container', {
    endpoint: '/api/signup/extended',
    fields: ['email', 'name'],
    submitText: 'Subscribe',
    successMessage: 'Thanks for signing up!',
    containerClass: 'my-signup-form',
  });
</script>
```

## Option 3: Direct POST

Create your own HTML form:

```html
<form action="https://your-domain.com/api/signup/form" method="POST">
  <input type="email" name="email" placeholder="Email" required>
  <input type="text" name="name" placeholder="Name">
  <input type="hidden" name="sheetTab" value="Newsletter">
  <button type="submit">Subscribe</button>
</form>
```

## Option 4: JavaScript Fetch

Full control with fetch:

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
