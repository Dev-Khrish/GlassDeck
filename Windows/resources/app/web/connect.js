'use strict';

const form = document.querySelector('#connect-form');
const result = document.querySelector('#connect-result');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/connect', { method: 'POST', body: new URLSearchParams(new FormData(form)) });
    if (response.ok && new URL(response.url).pathname === '/display') {
      location.replace('/display');
      return;
    }
    throw new Error((await response.json()).error || 'Pairing failed.');
  } catch (error) {
    result.textContent = error.message;
    result.hidden = false;
  } finally {
    button.disabled = false;
  }
});
