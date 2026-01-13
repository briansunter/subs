# HTML Form Integration

This guide shows you how to integrate the email signup API into your website using HTML forms.

## Overview

The API provides multiple ways to collect email signups:

1. **Iframe Embed** - Embed the pre-built form as an iframe
2. **Inline Form** - Inject the form directly into your page
3. **Direct POST Form** - Use your own HTML form that POSTs directly to the API
4. **JavaScript Fetch** - Use JavaScript to submit signups programmatically

## Option 1: Iframe Embed

The simplest way to integrate - embed the pre-built form as an iframe.

### Basic Iframe

```html
<iframe
  src="https://your-domain.com/"
  width="100%"
  height="300"
  frameborder="0"
  scrolling="no"
></iframe>
```

### Using the Embed Script

The embed script provides more control over the iframe:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.iframe('#signup-container', {
    width: '100%',
    height: '350px',
    // Additional options
  });
</script>
```

### Custom API Endpoint

Specify a custom API endpoint:

```html
<iframe
  src="https://your-domain.com/?api=/api/signup/extended"
  width="100%"
  height="300"
  frameborder="0"
  scrolling="no"
></iframe>
```

### With Redirect After Signup

```html
<iframe
  src="https://your-domain.com/?redirect=/thank-you"
  width="100%"
  height="300"
  frameborder="0"
  scrolling="no"
></iframe>
```

## Option 2: Inline Form Embed

Inject the form directly into your page for better control:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.inline('#signup-container', {
    endpoint: '/api/signup/extended',
    fields: ['email', 'name'],
    submitText: 'Subscribe Now',
    successMessage: 'Thanks for signing up!',
    // Styling options
    containerClass: 'my-signup-form',
    inputClass: 'form-input',
    buttonClass: 'btn-primary',
  });
</script>
```

### Custom Styling

```html
<script src="https://your-domain.com/embed.js"></script>
<style>
  .my-signup-form {
    max-width: 400px;
    margin: 0 auto;
  }
  .my-signup-form input {
    width: 100%;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .my-signup-form button {
    width: 100%;
    padding: 12px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
<div id="signup-container"></div>
<script>
  SignupEmbed.inline('#signup-container', {
    endpoint: '/api/signup/extended',
    containerClass: 'my-signup-form',
    inputClass: 'form-input',
    buttonClass: 'btn-primary',
  });
</script>
```

## Option 3: Direct POST Form

Create your own HTML form that POSTs directly to the API:

### Basic Email Form

```html
<form action="https://your-domain.com/api/signup" method="POST">
  <input type="email" name="email" placeholder="Enter your email" required>
  <input type="hidden" name="sheetTab" value="Newsletter">
  <button type="submit">Sign Up</button>
</form>
```

### Extended Signup Form

```html
<form action="https://your-domain.com/api/signup/extended" method="POST">
  <input type="email" name="email" placeholder="Email" required>
  <input type="text" name="name" placeholder="Name">
  <select name="source">
    <option value="website">Website</option>
    <option value="referral">Referral</option>
    <option value="social">Social Media</option>
  </select>
  <input type="text" name="tags" placeholder="Tags (comma-separated)">
  <input type="hidden" name="sheetTab" value="Newsletter">
  <button type="submit">Sign Up</button>
</form>
```

### With Custom Styling

```html
<style>
  .signup-form {
    display: flex;
    flex-direction: column;
    max-width: 400px;
    gap: 1rem;
  }
  .signup-form input,
  .signup-form select {
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
  }
  .signup-form button {
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 600;
  }
  .signup-form button:hover {
    background: #2563eb;
  }
</style>

<form
  class="signup-form"
  action="https://your-domain.com/api/signup/extended"
  method="POST"
>
  <input
    type="email"
    name="email"
    placeholder="your@email.com"
    required
  >
  <input
    type="text"
    name="name"
    placeholder="Your name"
  >
  <input
    type="hidden"
    name="sheetTab"
    value="Newsletter"
  >
  <button type="submit">Subscribe</button>
</form>
```

### With Success/Error Handling

```html
<form
  id="signup-form"
  action="https://your-domain.com/api/signup/extended"
  method="POST"
>
  <input type="email" name="email" placeholder="Email" required>
  <input type="text" name="name" placeholder="Name">
  <input type="hidden" name="sheetTab" value="Newsletter">
  <button type="submit">Sign Up</button>
</form>

<script>
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('https://your-domain.com/api/signup/extended', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      alert('Thanks for signing up!');
      e.target.reset();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    alert('Something went wrong. Please try again.');
  }
});
</script>
```

## Option 4: JavaScript Fetch

Use JavaScript to submit signups programmatically:

### Basic Fetch

```html
<form id="signup-form">
  <input type="email" id="email" placeholder="Email" required>
  <button type="submit">Sign Up</button>
</form>

<script>
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;

  const response = await fetch('https://your-domain.com/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      sheetTab: 'Newsletter'
    }),
  });

  const data = await response.json();
  console.log(data);
});
</script>
```

### With Advanced Error Handling

```html
<form id="signup-form">
  <div class="form-group">
    <label for="email">Email</label>
    <input type="email" id="email" required>
  </div>
  <div class="form-group">
    <label for="name">Name</label>
    <input type="text" id="name">
  </div>
  <button type="submit">Sign Up</button>
  <div id="message" class="message"></div>
</form>

<script>
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const name = document.getElementById('name').value;
  const messageEl = document.getElementById('message');

  try {
    const response = await fetch('https://your-domain.com/api/signup/extended', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name,
        sheetTab: 'Newsletter',
        source: 'website',
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      messageEl.textContent = 'Thanks for signing up!';
      messageEl.className = 'message success';
      document.getElementById('signup-form').reset();
    } else {
      messageEl.textContent = result.message || 'Something went wrong';
      messageEl.className = 'message error';
    }
  } catch (error) {
    messageEl.textContent = 'Network error. Please try again.';
    messageEl.className = 'message error';
  }
});
</script>

<style>
.message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.375rem;
}
.message.success {
  background: #d1fae5;
  color: #065f46;
}
.message.error {
  background: #fee2e2;
  color: #991b1b;
}
</style>
```

## Framework-Specific Examples

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
        body: JSON.stringify({
          email,
          name,
          sheetTab: 'Newsletter',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setEmail('');
        setName('');
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
      />
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
    <input
      v-model="email"
      type="email"
      placeholder="Email"
      required
    >
    <input
      v-model="name"
      type="text"
      placeholder="Name"
    >
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
      body: JSON.stringify({
        email: email.value,
        name: name.value,
        sheetTab: 'Newsletter',
      }),
    });

    const result = await response.json();

    if (result.success) {
      status.value = 'success';
      email.value = '';
      name.value = '';
    } else {
      status.value = 'error';
    }
  } catch (error) {
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
        body: JSON.stringify({
          email,
          name,
          sheetTab: 'Newsletter',
        }),
      });

      const result = await response.json();

      if (result.success) {
        status = 'success';
        email = '';
        name = '';
      } else {
        status = 'error';
      }
    } catch (error) {
      status = 'error';
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input
    type="email"
    bind:value={email}
    placeholder="Email"
    required
  />
  <input
    type="text"
    bind:value={name}
    placeholder="Name"
  />
  <button type="submit" disabled={status === 'loading'}>
    {status === 'loading' ? 'Submitting...' : 'Sign Up'}
  </button>
  {#if status === 'success'}
    <p>Thanks for signing up!</p>
  {/if}
  {#if status === 'error'}
    <p>Something went wrong.</p>
  {/if}
</form>
```

## CORS Configuration

Make sure your API's `ALLOWED_ORIGINS` setting includes your website's domain:

```bash
# .env
ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com
```

Or for development:

```bash
ALLOWED_ORIGINS=*
```

## Customization Options

### URL Parameters

When using the iframe or inline embed, you can customize behavior with URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `api` | Custom API endpoint | `?api=/api/signup/extended` |
| `redirect` | Redirect after signup | `?redirect=/thank-you` |
| `sheetTab` | Default sheet tab | `?sheetTab=Newsletter` |

### Form Field Customization

The extended endpoint accepts these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `name` | string | No | User's name |
| `source` | string | No | Signup source |
| `tags` | string[] | No | Comma-separated tags |
| `sheetTab` | string | No | Target sheet tab |

## Best Practices

### 1. Always Validate on the Client

```javascript
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### 2. Show Loading States

```javascript
const button = document.querySelector('button[type="submit"]');
button.disabled = true;
button.textContent = 'Submitting...';

// After request completes
button.disabled = false;
button.textContent = 'Sign Up';
```

### 3. Handle Errors Gracefully

```javascript
try {
  const response = await fetch(/* ... */);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Handle success
} catch (error) {
  // Handle error
  console.error('Signup failed:', error);
}
```

### 4. Use HTTPS in Production

Always use HTTPS URLs for your API endpoint in production:

```javascript
// Production
const API_URL = 'https://your-domain.com/api/signup';

// Development
const API_URL = 'http://localhost:3000/api/signup';
```

### 5. Respect User Privacy

```javascript
// Only collect data you need
const formData = {
  email: emailInput.value,
  // Only add optional fields if the user provided them
  ...(nameInput.value && { name: nameInput.value }),
  sheetTab: 'Newsletter',
};
```

## Testing Your Integration

### Test Locally

1. Start your development server:
   ```bash
   bun run dev
   ```

2. Open your HTML file in a browser
3. Fill out the form and submit
4. Check the browser console for errors
5. Verify the data appears in Google Sheets

### Test with cURL

```bash
curl -X POST http://localhost:3000/api/signup/extended \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "sheetTab": "Newsletter"
  }'
```

### Test Cross-Origin Requests

If your website is on a different domain:

1. Check the browser console for CORS errors
2. Verify `ALLOWED_ORIGINS` includes your domain
3. Test with browser DevTools Network tab

## Troubleshooting

### CORS Errors

**Error**: `Access to fetch at '...' has been blocked by CORS policy`

**Solution**: Add your domain to `ALLOWED_ORIGINS` in `.env`:

```bash
ALLOWED_ORIGINS=https://yourwebsite.com
```

### Form Submitting but No Data

**Check 1**: Verify the API endpoint URL is correct

**Check 2**: Check the browser console for JavaScript errors

**Check 3**: Use the Network tab in DevTools to see the request and response

**Check 4**: Verify Google Sheets credentials are correct

### Validation Errors

**Error**: `{"error":"Validation error","details":{...}}`

**Solution**: Check that all required fields are included and properly formatted:

```javascript
// Correct
const data = {
  email: 'user@example.com',  // Valid email
  sheetTab: 'Sheet1',         // String
};

// Incorrect
const data = {
  email: 'not-an-email',      // Invalid email
  sheetTab: 123,              // Not a string
};
```

## Next Steps

- **[API Reference](/guide/api)** - Complete API documentation
- **[Deployment](/guide/deployment)** - Deploy your API to production
- **[Troubleshooting](/guide/troubleshooting)** - Common issues and solutions
