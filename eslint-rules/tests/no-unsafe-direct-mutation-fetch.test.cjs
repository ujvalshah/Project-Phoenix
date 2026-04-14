'use strict';

const { RuleTester } = require('eslint');
const rule = require('../no-unsafe-direct-mutation-fetch.js');

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

ruleTester.run('no-unsafe-direct-mutation-fetch', rule, {
  valid: [
    {
      code: `
        async function loadData() {
          await fetch('/api/admin/tagging/export', {
            method: 'GET',
            credentials: 'include'
          });
        }
      `,
    },
    {
      code: `
        async function upload(getCsrfHeaders) {
          await fetch('/api/media/upload/cloudinary', {
            method: 'POST',
            credentials: 'include',
            headers: getCsrfHeaders(),
            body: new FormData()
          });
        }
      `,
    },
    {
      code: `
        async function upload(getCsrfHeaders) {
          await fetch(\`\${apiBase}/admin/tagging/import\`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              ...getCsrfHeaders(),
              'X-App-Version': '1'
            },
            body: formData
          });
        }
      `,
    },
    {
      code: `
        async function post(apiClient) {
          await apiClient.post('/admin/jobs/retry', {});
          await apiClient.request('/articles/1/images', { method: 'DELETE', body: '{}' });
        }
      `,
    },
    {
      code: `
        async function external() {
          await fetch('https://www.youtube.com/oembed?url=https://youtube.com/watch?v=abc');
        }
      `,
    },
    {
      code: `
        function custom(client, csrfHeaders) {
          return client.request('/admin/run-maintenance', {
            method: 'POST',
            headers: csrfHeaders
          });
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        async function bad() {
          await fetch('/api/media/upload/cloudinary', {
            method: 'POST',
            credentials: 'include',
            body: formData
          });
        }
      `,
      errors: [{ messageId: 'unsafeFetch' }],
    },
    {
      code: `
        async function bad() {
          await fetch(\`\${base}/admin/tagging/import\`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          });
        }
      `,
      errors: [{ messageId: 'unsafeFetch' }],
    },
    {
      code: `
        function bad() {
          const xhr = new XMLHttpRequest();
          xhr.open('DELETE', '/media/123');
          xhr.send();
        }
      `,
      errors: [{ messageId: 'unsafeXhr' }],
    },
    {
      code: `
        function bad(client) {
          client.request('/admin/purge', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });
        }
      `,
      errors: [{ messageId: 'unsafeCustom' }],
    },
    {
      code: `
        function bad(client) {
          client.post('/api/collections', {});
        }
      `,
      errors: [{ messageId: 'unsafeCustom' }],
    },
  ],
});

console.log('Rule tests passed: no-unsafe-direct-mutation-fetch');
