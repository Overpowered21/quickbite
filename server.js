import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const deriveKey = promisify(scrypt);
const sampleRestaurants = JSON.parse(
  await readFile(new URL('./data/restaurants.json', import.meta.url), 'utf8'),
);
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cookieName = 'quickbite_session';

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw Object.assign(new Error('Send the request as JSON.'), { status: 415 });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) {
      throw Object.assign(new Error('Request is too large.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Expected an object.');
    }
    return body;
  } catch {
    throw Object.assign(new Error('Send a valid JSON object.'), { status: 400 });
  }
}

function sessionToken(request) {
  const cookie = (request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1);
}

function publicUser(user) {
  return { name: user.name, email: user.email };
}

// Each running application has its own in-memory accounts and sessions.
export function createApp({ restaurants = sampleRestaurants } = {}) {
  const users = new Map();
  const sessions = new Map();

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const { pathname } = url;

      if (request.method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJson(request);
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const errors = {};
        if (!name) errors.name = 'Enter your name.';
        if (!emailPattern.test(email)) errors.email = 'Enter a valid email address.';
        if (password.length < 8) errors.password = 'Use a password of at least 8 characters.';
        if (Object.keys(errors).length) {
          return sendJson(response, 400, { message: 'Check the highlighted fields.', errors });
        }

        const salt = randomBytes(16).toString('hex');
        const passwordHash = await deriveKey(password, salt, 64);
        // Check after hashing so concurrent requests cannot register the same email.
        if (users.has(email)) {
          return sendJson(response, 409, {
            message: 'This email is already registered.',
            errors: { email: 'This email is already registered.' },
          });
        }
        const user = { name, email, salt, passwordHash };
        users.set(email, user);
        return sendJson(response, 201, {
          message: 'Account created. Log in to continue.',
          user: publicUser(user),
        });
      }

      if (request.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const errors = {};
        if (!emailPattern.test(email)) errors.email = 'Enter a valid email address.';
        if (!password) errors.password = 'Enter your password.';
        if (Object.keys(errors).length) {
          return sendJson(response, 400, { message: 'Check the highlighted fields.', errors });
        }

        const user = users.get(email);
        const candidateHash = user ? await deriveKey(password, user.salt, 64) : null;
        if (!user || !timingSafeEqual(candidateHash, user.passwordHash)) {
          return sendJson(response, 401, { message: 'Email or password is incorrect.' });
        }

        sessions.delete(sessionToken(request));
        const token = randomBytes(32).toString('hex');
        sessions.set(token, email);
        return sendJson(response, 200, { user: publicUser(user) }, {
          'Set-Cookie': `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/`,
        });
      }

      if (request.method === 'POST' && pathname === '/api/auth/logout') {
        sessions.delete(sessionToken(request));
        return sendJson(response, 200, { message: 'You are logged out.' }, {
          'Set-Cookie': `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
        });
      }

      if (request.method === 'GET' && pathname === '/api/auth/me') {
        const user = users.get(sessions.get(sessionToken(request)));
        if (!user) {
          return sendJson(response, 401, { message: 'Log in to access your account.' });
        }
        return sendJson(response, 200, { user: publicUser(user) });
      }

      if (request.method === 'GET' && pathname === '/api/restaurants') {
        const query = (url.searchParams.get('q') || '').trim().toLowerCase();
        const matches = restaurants.filter((restaurant) =>
          restaurant.name.toLowerCase().includes(query)
          || restaurant.cuisine.toLowerCase().includes(query),
        );
        return sendJson(response, 200, {
          restaurants: matches.map(({ id, name, cuisine }) => ({ id, name, cuisine })),
          message: matches.length ? '' : (
            restaurants.length ? 'No matching restaurants found.' : 'No restaurants are available.'
          ),
        });
      }

      if (request.method === 'GET' && pathname.startsWith('/api/restaurants/')) {
        const id = pathname.slice('/api/restaurants/'.length);
        const restaurant = restaurants.find((item) => item.id === id);
        return restaurant
          ? sendJson(response, 200, { restaurant })
          : sendJson(response, 404, { message: 'Restaurant not found.' });
      }

      if (request.method === 'GET' && staticFiles.has(pathname)) {
        const [filename, contentType] = staticFiles.get(pathname);
        const content = await readFile(new URL(`./public/${filename}`, import.meta.url));
        response.writeHead(200, {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
        });
        return response.end(content);
      }

      return sendJson(response, 404, { message: 'Page not found.' });
    } catch (error) {
      sendJson(response, error.status || 500, {
        message: error.status ? error.message : 'Something went wrong. Please try again.',
      });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const app = createApp();
  app.on('error', (error) => {
    console.error(`QuickBite could not start: ${error.message}`);
    process.exitCode = 1;
  });
  app.listen(port, '127.0.0.1', () => {
    console.log(`QuickBite – Food Delivery System: http://127.0.0.1:${app.address().port}`);
  });
}
