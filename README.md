# QuickBite – Food Delivery System

A minimal local web application for Agile Assignment 1, using Node.js and a plain HTML/CSS/JavaScript frontend.

## Implemented user stories

| Story | Functionality | Priority |
|---|---|---|
| US-01 | Customer registration, login, and logout | High |
| US-02 | Browse restaurant names and cuisines, and open their menus | Medium |
| US-11 | Search restaurant names or cuisines, ignoring case and surrounding spaces; clear search to restore the list | Low |

## Requirements and dependency installation

Use **Node.js 20 or newer**. All runtime and test dependencies are built into Node.js, so **no dependency installation command is required**.

Check your Node.js version:

```bash
node --version
```

## Run locally

In a Linux/WSL terminal:

```bash
cd "/mnt/c/Users/charukesh addugula/omnirush/quickbite"
node server.js
```

Open **http://127.0.0.1:3000** in a browser. Keep the terminal running; press **Ctrl+C** to stop the app. The same Node.js server serves the frontend and backend.

To choose a different port in Linux/WSL:

```bash
PORT=3001 node server.js
```

Open http://127.0.0.1:3001 when using that command. `npm start` is also available as an alias for `node server.js`.

## Try the features

1. Click **Register** and enter a name, unused email, and password of at least 8 characters. Missing or invalid fields, duplicate emails, and short passwords show validation errors.
2. After registration, log in with the same credentials. Your name and email appear in the account section. Incorrect credentials show an error.
3. Refresh the page to verify that the session remains active, then click **Log out**. Account details require login again.
4. Browse the three sample restaurants: **Biryani House** (Indian), **Bella Italia** (Italian), and **Green Bowl** (Asian). Click **View menu** to see each restaurant's sample dishes and prices in INR.
5. Enter `  iTaLiAn  ` and click **Search** to find Bella Italia, or search for `BIRYANI` to match by name. Search for `no-such-restaurant` to see the no-results message. Click **Clear** to restore all restaurants. Emptying the search input also restores the list.

## Local data

- Sample restaurants and menus are stored in `data/restaurants.json`.
- Accounts and sessions are stored **in memory** and reset when the server restarts. Register again after a restart.
- Passwords are salted and hashed with Node.js `scrypt`. Login uses an HTTP-only, SameSite session cookie.
- Restaurant browsing is public. The account endpoint requires a valid session, which is invalidated on logout.
- An empty restaurant data array displays **No restaurants are available.**

## Run tests

From the `quickbite` directory:

```bash
node --test
```

`npm test` is an equivalent command. Tests start isolated local servers on temporary ports and stop them automatically. They cover registration validation, duplicate emails, login/session/logout behavior, restaurant lists and menus, search, clearing the query, empty data, and frontend asset serving.

## Project files

```text
package.json           Project metadata and start/test commands
server.js              Local HTTP server, authentication, and restaurant API
data/restaurants.json  Sample restaurants and menus
public/index.html      Application page
public/styles.css      Responsive page styles
public/app.js          Account, restaurant, menu, and search interactions
test/app.test.js       HTTP integration tests
```
