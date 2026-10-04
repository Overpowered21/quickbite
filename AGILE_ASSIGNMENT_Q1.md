# Agile Assignment – Question 1

**Application domain:** Food Delivery – QuickBite

**Assignment question:** “Apply Agile principles and techniques to develop and prioritize User Stories with suitable Acceptance Criteria for a Food Delivery application, and implement the Product Backlog using Jira.”

## User Stories and Acceptance Criteria

### US-01 – Customer Registration and Login

**Priority:** High

**User Story:**
As a customer, I want to register and log in, so that I can place orders under my own account.

**Acceptance Criteria:**

- Valid name, unused email, and password of at least 8 characters create an account.
- Invalid, missing, duplicate, or short-password input shows validation errors.
- Correct credentials allow login; incorrect credentials show an error.
- Logging out requires the customer to log in again for account-only actions.

### US-02 – Browse Restaurants

**Priority:** Medium

**User Story:**
As a customer, I want to browse available restaurants, so that I can choose where to order food.

**Acceptance Criteria:**

- Restaurant list displays available restaurant names and cuisine information.
- Selecting a restaurant opens its menu.
- If no restaurants are available, an appropriate empty-state message is shown.

### US-11 – Search Restaurants

**Priority:** Low

**User Story:**
As a customer, I want to search restaurants by name or cuisine, so that I can quickly find a restaurant.

**Acceptance Criteria:**

- Search matches restaurant names or cuisine.
- Search is case-insensitive and ignores unnecessary leading/trailing spaces.
- If there are no matches, an appropriate message is shown.
- Clearing the search restores the restaurant list.

## Prioritized Product Backlog

| Rank | Story ID | Story title | Priority |
|---|---|---|---|
| 1 | US-01 | Customer Registration and Login | High |
| 2 | US-02 | Browse Restaurants | Medium |
| 3 | US-11 | Search Restaurants | Low |
