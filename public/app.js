const byId = (id) => document.getElementById(id);
const loginForm = byId('login-form');
const registerForm = byId('register-form');
const authMessage = byId('auth-message');
const restaurantMessage = byId('restaurant-message');
const menuPanel = byId('menu-panel');
const search = byId('search');
const prices = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
let restaurantRequest;
let menuRequest;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(data.message), { status: response.status, errors: data.errors });
  }
  return data;
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle('error', isError);
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
  form.querySelectorAll('input').forEach((input) => input.removeAttribute('aria-invalid'));
}

function showForm(mode) {
  const isLogin = mode === 'login';
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  byId('show-login').setAttribute('aria-pressed', String(isLogin));
  byId('show-register').setAttribute('aria-pressed', String(!isLogin));
  clearErrors(loginForm);
  clearErrors(registerForm);
  setAuthMessage('');
}

function showAccount(user) {
  byId('auth-forms').hidden = Boolean(user);
  byId('account-details').hidden = !user;
  byId('customer-name').textContent = user?.name || '';
  byId('customer-email').textContent = user?.email || '';
}

byId('show-login').addEventListener('click', () => showForm('login'));
byId('show-register').addEventListener('click', () => showForm('register'));

for (const [form, action] of [[registerForm, 'register'], [loginForm, 'login']]) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    setAuthMessage('');
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      if (action === 'register') {
        showForm('login');
        byId('login-email').value = result.user.email;
        byId('login-password').focus();
        setAuthMessage(result.message);
      } else {
        showAccount(result.user);
        setAuthMessage('You are logged in.');
        byId('logout').focus();
      }
    } catch (error) {
      setAuthMessage(error.message || 'Unable to connect. Please try again.', true);
      for (const [field, message] of Object.entries(error.errors || {})) {
        byId(`${action}-${field}-error`).textContent = message;
        byId(`${action}-${field}`).setAttribute('aria-invalid', 'true');
      }
      form.querySelector('[aria-invalid="true"]')?.focus();
    } finally {
      submit.disabled = false;
    }
  });
}

byId('logout').addEventListener('click', async () => {
  const button = byId('logout');
  button.disabled = true;
  try {
    const result = await api('/api/auth/logout', { method: 'POST' });
    showAccount(null);
    loginForm.reset();
    registerForm.reset();
    showForm('login');
    setAuthMessage(result.message);
    byId('login-email').focus();
  } catch (error) {
    setAuthMessage(error.message || 'Unable to log out. Please try again.', true);
  } finally {
    button.disabled = false;
  }
});

async function showMenu(id) {
  menuRequest?.abort();
  menuRequest = new AbortController();
  menuPanel.hidden = true;
  restaurantMessage.classList.remove('error');
  restaurantMessage.textContent = 'Loading menu…';
  try {
    const { restaurant } = await api(`/api/restaurants/${encodeURIComponent(id)}`, {
      signal: menuRequest.signal,
    });
    byId('menu-heading').textContent = `${restaurant.name} – Menu`;
    byId('menu-cuisine').textContent = restaurant.cuisine;
    byId('menu-list').replaceChildren(...restaurant.menu.map((item) => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      const price = document.createElement('span');
      name.textContent = item.name;
      price.textContent = prices.format(item.price);
      row.append(name, price);
      return row;
    }));
    restaurantMessage.textContent = '';
    menuPanel.hidden = false;
    byId('menu-heading').focus();
  } catch (error) {
    if (error.name === 'AbortError') return;
    restaurantMessage.textContent = error.message || 'Unable to load the menu.';
    restaurantMessage.classList.add('error');
  }
}

async function loadRestaurants() {
  restaurantRequest?.abort();
  menuRequest?.abort();
  restaurantRequest = new AbortController();
  menuPanel.hidden = true;
  byId('restaurant-list').replaceChildren();
  restaurantMessage.classList.remove('error');
  restaurantMessage.textContent = 'Loading restaurants…';
  try {
    const { restaurants, message } = await api(`/api/restaurants?q=${encodeURIComponent(search.value)}`, {
      signal: restaurantRequest.signal,
    });
    byId('restaurant-list').replaceChildren(...restaurants.map((restaurant) => {
      const card = document.createElement('li');
      card.className = 'restaurant-card';
      const details = document.createElement('div');
      const name = document.createElement('h3');
      const cuisine = document.createElement('p');
      const button = document.createElement('button');
      name.textContent = restaurant.name;
      cuisine.textContent = restaurant.cuisine;
      cuisine.className = 'muted';
      button.type = 'button';
      button.textContent = 'View menu';
      button.setAttribute('aria-label', `View menu for ${restaurant.name}`);
      button.addEventListener('click', () => showMenu(restaurant.id));
      details.append(name, cuisine);
      card.append(details, button);
      return card;
    }));
    restaurantMessage.textContent = message || `${restaurants.length} restaurants available.`;
  } catch (error) {
    if (error.name === 'AbortError') return;
    restaurantMessage.textContent = error.message || 'Unable to load restaurants.';
    restaurantMessage.classList.add('error');
  }
}

byId('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  loadRestaurants();
});
byId('clear-search').addEventListener('click', () => {
  search.value = '';
  loadRestaurants();
  search.focus();
});
search.addEventListener('input', () => {
  if (!search.value) loadRestaurants();
});

async function restoreSession() {
  try {
    const { user } = await api('/api/auth/me');
    showAccount(user);
  } catch (error) {
    showAccount(null);
    if (error.status !== 401) setAuthMessage('Unable to check your session. Please try again.', true);
  }
}

restoreSession();
loadRestaurants();
