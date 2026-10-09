// Talking to the website's functions. Problems come back as messages that
// can be shown to Jim as they are.

let whenSignedOut = () => {};

// Sets what happens if Jim's sign-in runs out while he's working.
export function onSignedOut(handler) {
  whenSignedOut = handler;
}

export async function api(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`/api/${path}`, options);
  } catch {
    throw new Error('The editor couldn\'t reach the website. Check your internet connection and try again.');
  }

  if (response.status === 401 && path !== 'login') {
    whenSignedOut();
    throw new Error('Please sign in again.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Something went wrong. Please try again in a minute.');
  }
  return response.status === 204 ? null : response.json();
}
