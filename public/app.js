const socket = io();
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const currentUserEl = document.getElementById('current-user');
const currentRoleEl = document.getElementById('current-role');
const currentAccountEl = document.getElementById('current-account');
const userNameInput = document.getElementById('user-name');
const startBtn = document.getElementById('start-btn');
const logoutBtn = document.getElementById('logout-btn');
const transactionForm = document.getElementById('transaction-form');
const transactionType = document.getElementById('transaction-type');
const transactionAmount = document.getElementById('transaction-amount');
const transactionCategory = document.getElementById('transaction-category');
const transactionDescription = document.getElementById('transaction-description');
const accountForm = document.getElementById('account-form');
const accountType = document.getElementById('account-type');
const accountName = document.getElementById('account-name');
const accountNumber = document.getElementById('account-number');
const accountInfo = document.getElementById('account-info');
const notificationContainer = document.getElementById('notification-container');
const adminPanel = document.getElementById('admin-panel');
const userAccountsBody = document.getElementById('user-accounts-body');
const globalIncome = document.getElementById('global-income');
const globalExpense = document.getElementById('global-expense');
const globalBalance = document.getElementById('global-balance');
const userIncome = document.getElementById('user-income');
const userExpense = document.getElementById('user-expense');
const userBalance = document.getElementById('user-balance');
const userSummaryBody = document.getElementById('user-summary-body');
const transactionsBody = document.getElementById('transactions-body');

let currentUser = localStorage.getItem('kasUser') || '';
let currentUserData = null;
let isAdmin = false;

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function showNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.textContent = message;
  notificationContainer.prepend(toast);
  setTimeout(() => toast.remove(), 7000);
}

function showApp() {
  loginSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  currentUserEl.textContent = currentUser;
  fetchUserProfile();
  fetchDashboard();
  fetchNotifications();
}

function showLogin() {
  appSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
}

async function fetchDashboard() {
  await Promise.all([fetchSummary(), fetchTransactions()]);
}

async function fetchUserProfile() {
  const response = await fetch(`/api/users?name=${encodeURIComponent(currentUser)}`);
  if (!response.ok) {
    currentUser = '';
    localStorage.removeItem('kasUser');
    return showLogin();
  }

  const user = await response.json();
  currentUserData = user;
  isAdmin = user.role === 'admin';
  currentRoleEl.textContent = `Role: ${isAdmin ? 'Bandahara / Admin' : 'Anggota'}`;

  const accountSummary = user.account_type
    ? `${user.account_type} • ${user.account_name || '-'} • ${user.account_number || '-'}`
    : 'Belum terhubung dengan rekening bank atau e-wallet.';
  currentAccountEl.textContent = accountSummary;
  accountInfo.textContent = accountSummary;

  accountType.value = user.account_type || '';
  accountName.value = user.account_name || '';
  accountNumber.value = user.account_number || '';

  if (isAdmin) {
    adminPanel.classList.remove('hidden');
    fetchUserAccounts();
  } else {
    adminPanel.classList.add('hidden');
  }
}

async function fetchUserAccounts() {
  const response = await fetch('/api/users');
  if (!response.ok) return;

  const users = await response.json();
  userAccountsBody.innerHTML = users.map(user => `
    <tr>
      <td>${user.name}</td>
      <td>${user.role}</td>
      <td>${user.account_type || '-'}</td>
      <td>${user.account_number || '-'}</td>
    </tr>
  `).join('');
}

async function fetchSummary() {
  const response = await fetch(`/api/summary?user=${encodeURIComponent(currentUser)}`);
  const data = await response.json();

  globalIncome.textContent = formatCurrency(data.global.total_income);
  globalExpense.textContent = formatCurrency(data.global.total_expense);
  globalBalance.textContent = formatCurrency(data.global.balance);

  const own = data.users.find(u => u.user_name === currentUser) || { total_income: 0, total_expense: 0, balance: 0 };
  userIncome.textContent = formatCurrency(own.total_income);
  userExpense.textContent = formatCurrency(own.total_expense);
  userBalance.textContent = formatCurrency(own.balance);

  userSummaryBody.innerHTML = data.users.map(user => `
    <tr>
      <td>${user.user_name}</td>
      <td>${formatCurrency(user.total_income)}</td>
      <td>${formatCurrency(user.total_expense)}</td>
      <td>${formatCurrency(user.balance)}</td>
    </tr>
  `).join('');
}

async function fetchTransactions() {
  const response = await fetch('/api/transactions');
  const data = await response.json();
  transactionsBody.innerHTML = data.map(tx => `
    <tr>
      <td>${new Date(tx.created_at).toLocaleString('id-ID')}</td>
      <td>${tx.user_name}</td>
      <td class="${tx.type}">${tx.type === 'income' ? 'Kas Masuk' : 'Pengeluaran'}</td>
      <td>${formatCurrency(tx.amount)}</td>
      <td>${tx.category || '-'}</td>
      <td>${tx.description || '-'}</td>
    </tr>
  `).join('');
}

async function fetchNotifications() {
  if (!currentUser) return;
  const response = await fetch(`/api/notifications?name=${encodeURIComponent(currentUser)}`);
  if (!response.ok) return;
  const notifications = await response.json();

  notifications.slice(0, 3).forEach(note => showNotification(note.message));
}

startBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  if (!name) return;

  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.error || 'Gagal masuk.');
    return;
  }

  currentUser = name;
  localStorage.setItem('kasUser', currentUser);
  showApp();
});

logoutBtn.addEventListener('click', () => {
  currentUser = '';
  currentUserData = null;
  localStorage.removeItem('kasUser');
  showLogin();
});

transactionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    userName: currentUser,
    type: transactionType.value,
    amount: transactionAmount.value,
    description: transactionDescription.value,
    category: transactionCategory.value,
  };

  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.error || 'Gagal menyimpan transaksi.');
    return;
  }

  transactionAmount.value = '';
  transactionCategory.value = '';
  transactionDescription.value = '';
  fetchDashboard();
});

accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUserData) return;

  const payload = {
    accountType: accountType.value,
    accountName: accountName.value,
    accountNumber: accountNumber.value,
  };

  const response = await fetch(`/api/users/${currentUserData.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.error || 'Gagal menyimpan info akun.');
    return;
  }

  const user = await response.json();
  currentUserData = user;
  showNotification('Info akun berhasil diperbarui.');
  fetchUserProfile();
});

socket.on('transaction:created', () => {
  fetchDashboard();
  fetchTransactions();
});

socket.on('notification', data => {
  if (data && data.message) {
    showNotification(data.message);
    fetchNotifications();
    fetchDashboard();
  }
});

if (currentUser) {
  showApp();
} else {
  showLogin();
}
