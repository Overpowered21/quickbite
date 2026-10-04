import assert from 'node:assert/strict';
import { once } from 'node:events';
import { afterEach, beforeEach, test } from 'node:test';
import { createApp } from '../server.js';

let app;
let baseUrl;
const customer = { name: 'Asha', email: 'asha@example.com', password: 'secret123' };

beforeEach(async () => {
  app = createApp();
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  baseUrl = `http://127.0.0.1:${app.address().port}`;
});

afterEach(async () => {
  app.closeAllConnections();
  await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
});

async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, headers: response.headers, data: await response.json() };
}

const register = (body = customer) => request('/api/auth/register', { method: 'POST', body });
const login = (body = customer) => request('/api/auth/login', { method: 'POST', body });
const cookieFrom = (result) => result.headers.get('set-cookie').split(';')[0];

test('registration accepts a valid customer and returns only public account fields', async () => {
  const result = await register();
  assert.equal(result.status, 201);
  assert.deepEqual(result.data.user, { name: 'Asha', email: 'asha@example.com' });
  assert.equal((await login()).status, 200);
});

test('registration accepts a password of exactly 8 characters', async () => {
  assert.equal((await register({ ...customer, password: '12345678' })).status, 201);
});

for (const [description, changes, field] of [
  ['blank name', { name: '   ' }, 'name'],
  ['invalid name type', { name: 123 }, 'name'],
  ['invalid email', { email: 'not-an-email' }, 'email'],
  ['missing email', { email: undefined }, 'email'],
  ['short password', { password: '1234567' }, 'password'],
  ['missing password', { password: undefined }, 'password'],
]) {
  test(`registration rejects ${description} with a field error`, async () => {
    const result = await register({ ...customer, ...changes });
    assert.equal(result.status, 400);
    assert.ok(result.data.errors[field]);
    // A rejected attempt must not reserve the customer's email.
    assert.equal((await register()).status, 201);
  });
}

test('registration reports every missing required field', async () => {
  const result = await register({});
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.data.errors).sort(), ['email', 'name', 'password']);
});

test('duplicate email is rejected, including case and surrounding space variations', async () => {
  await register();
  for (const email of ['asha@example.com', '  ASHA@EXAMPLE.COM  ']) {
    const result = await register({ ...customer, email });
    assert.equal(result.status, 409);
    assert.match(result.data.errors.email, /already registered/);
  }
});

test('concurrent registrations cannot create duplicate accounts', async () => {
  const results = await Promise.all([register(), register()]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
});

test('correct credentials create a session usable on subsequent account requests', async () => {
  await register();
  const result = await login({ ...customer, email: '  ASHA@EXAMPLE.COM  ' });
  assert.equal(result.status, 200);
  assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const cookie = cookieFrom(result);
  for (let refresh = 0; refresh < 2; refresh += 1) {
    const account = await request('/api/auth/me', { cookie });
    assert.equal(account.status, 200);
    assert.deepEqual(account.data.user, { name: 'Asha', email: 'asha@example.com' });
  }
});

test('incorrect password and unknown email show the same login error', async () => {
  await register();
  for (const credentials of [
    { ...customer, password: 'wrong-password' },
    { ...customer, email: 'unknown@example.com' },
  ]) {
    const result = await login(credentials);
    assert.equal(result.status, 401);
    assert.equal(result.data.message, 'Email or password is incorrect.');
    assert.equal(result.headers.get('set-cookie'), null);
  }
});

test('login validates missing and malformed credentials', async () => {
  const missing = await login({});
  assert.equal(missing.status, 400);
  assert.ok(missing.data.errors.email);
  assert.ok(missing.data.errors.password);
  const invalid = await login({ email: 'invalid', password: 'secret123' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.data.errors.email);
});

test('account access requires authentication', async () => {
  assert.equal((await request('/api/auth/me')).status, 401);
  assert.equal((await request('/api/auth/me', { cookie: 'quickbite_session=invalid' })).status, 401);
});

test('logout invalidates the session and login is required for account access again', async () => {
  await register();
  const cookie = cookieFrom(await login());
  const result = await request('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(result.status, 200);
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/api/auth/me', { cookie })).status, 401);
  assert.equal((await request('/api/auth/me')).status, 401);
  const newCookie = cookieFrom(await login());
  assert.notEqual(newCookie, cookie);
  assert.equal((await request('/api/auth/me', { cookie: newCookie })).status, 200);
});

test('restaurant list displays the sample restaurant names and cuisines', async () => {
  const result = await request('/api/restaurants');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.restaurants.map(({ name, cuisine }) => [name, cuisine]), [
    ['Biryani House', 'Indian'], ['Bella Italia', 'Italian'], ['Green Bowl', 'Asian'],
  ]);
});

test('each restaurant selection returns its own menu items and prices', async () => {
  const { data } = await request('/api/restaurants');
  const expectedFirstItems = {
    'biryani-house': 'Vegetable Biryani',
    'bella-italia': 'Margherita Pizza',
    'green-bowl': 'Vegetable Noodles',
  };
  for (const item of data.restaurants) {
    const result = await request(`/api/restaurants/${item.id}`);
    assert.equal(result.status, 200);
    assert.equal(result.data.restaurant.name, item.name);
    assert.equal(result.data.restaurant.cuisine, item.cuisine);
    assert.equal(result.data.restaurant.menu[0].name, expectedFirstItems[item.id]);
    assert.ok(result.data.restaurant.menu.every((dish) => dish.name && dish.price > 0));
  }
});

test('an unknown restaurant returns a useful error', async () => {
  const result = await request('/api/restaurants/unknown');
  assert.equal(result.status, 404);
  assert.equal(result.data.message, 'Restaurant not found.');
});

test('search matches restaurant names and cuisines ignoring case and surrounding spaces', async () => {
  for (const [query, expected] of [
    ['biryani', 'Biryani House'],
    ['  BIRYANI  ', 'Biryani House'],
    ['  iTaLiAn  ', 'Bella Italia'],
    ['ASIAN', 'Green Bowl'],
  ]) {
    const result = await request(`/api/restaurants?q=${encodeURIComponent(query)}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.restaurants.map((item) => item.name), [expected]);
  }
});

test('search without matches returns a no-results message', async () => {
  const result = await request('/api/restaurants?q=no-such-restaurant');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.restaurants, []);
  assert.equal(result.data.message, 'No matching restaurants found.');
});

test('clearing a search or supplying only spaces restores the full list', async () => {
  const original = await request('/api/restaurants');
  assert.equal((await request('/api/restaurants?q=Italian')).data.restaurants.length, 1);
  for (const query of ['', '   ']) {
    const result = await request(`/api/restaurants?q=${encodeURIComponent(query)}`);
    assert.deepEqual(result.data.restaurants, original.data.restaurants);
  }
});

test('an empty restaurant store returns the empty-state message', async () => {
  const emptyApp = createApp({ restaurants: [] });
  emptyApp.listen(0, '127.0.0.1');
  await once(emptyApp, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${emptyApp.address().port}/api/restaurants`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      restaurants: [], message: 'No restaurants are available.',
    });
  } finally {
    emptyApp.closeAllConnections();
    await new Promise((resolve) => emptyApp.close(resolve));
  }
});

test('the server delivers the HTML, JavaScript, and CSS frontend', async () => {
  for (const [path, type, content] of [
    ['/', 'text/html', 'QuickBite – Food Delivery System'],
    ['/app.js', 'text/javascript', '/api/auth/'],
    ['/styles.css', 'text/css', '.restaurant-card'],
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.ok((await response.text()).includes(content));
  }
});

test('non-public local files are not served', async () => {
  for (const path of ['/server.js', '/data/restaurants.json', '/AGILE_ASSIGNMENT_Q1.md']) {
    assert.equal((await request(path)).status, 404);
  }
});

test('malformed JSON returns a validation error and the server continues working', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Send a valid JSON object.');
  assert.equal((await register()).status, 201);
});
