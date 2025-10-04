// js/accounts.js

// ==========================================
// STATE MANAGEMENT
// ==========================================

let isInitialized = false;
let allTransactions = {};  // Cache transactions by account name

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeAccountsPage() {
    const user = await requireAuth();
    if (!user) return;

    // Set up event listeners (only once)
    if (!isInitialized) {
        setupEventListeners();
        isInitialized = true;
    }
    
    // Load accounts data
    await fetchAndRenderAccounts();
}

function setupEventListeners() {
    const showAddAccountModalBtn = document.getElementById('showAddAccountModalBtn');
    const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
    const accountModal = document.getElementById('accountModal');
    const accountForm = document.getElementById('accountForm');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    // Show modal
    if (showAddAccountModalBtn) {
        showAddAccountModalBtn.addEventListener('click', () => showModal());
    }
    
    // Close modal
    if (closeAccountModalBtn) {
        closeAccountModalBtn.addEventListener('click', hideModal);
    }
    
    // Close modal on overlay click
    if (accountModal) {
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) hideModal();
        });
    }
    
    // Form submission
    if (accountForm) {
        accountForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Delete button
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDelete);
    }
}

// ==========================================
// PAGE LIFECYCLE EVENT LISTENERS
// ==========================================

window.addEventListener('DOMContentLoaded', initializeAccountsPage);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        isInitialized = false;
        initializeAccountsPage();
    }
});

// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showModal(account = null) {
    const accountModal = document.getElementById('accountModal');
    const accountForm = document.getElementById('accountForm');
    const modalTitle = document.getElementById('modalTitle');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    if (!accountModal || !accountForm) return;
    
    accountForm.reset();
    
    if (account) {
        // Edit mode
        modalTitle.textContent = 'Edit Account';
        document.getElementById('accountId').value = account.id;
        document.getElementById('accountName').value = account.name;
        document.getElementById('accountBalance').value = parseFloat(account.balance);
        document.getElementById('accountType').value = account.type;
        if (deleteAccountBtn) deleteAccountBtn.style.display = 'flex';
    } else {
        // Add mode
        modalTitle.textContent = 'Add Account';
        document.getElementById('accountId').value = '';
        if (deleteAccountBtn) deleteAccountBtn.style.display = 'none';
    }
    
    accountModal.classList.add('active');
    
    // Initialize Lucide icons in modal
    setTimeout(() => {
        lucide.createIcons();
    }, 10);
}

function hideModal() {
    const accountModal = document.getElementById('accountModal');
    if (accountModal) {
        accountModal.classList.remove('active');
    }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('You must be logged in to add an account.');
        return;
    }

    const accountId = document.getElementById('accountId').value;
    const accountData = {
        name: document.getElementById('accountName').value,
        balance: parseFloat(document.getElementById('accountBalance').value),
        type: document.getElementById('accountType').value,
    };

    try {
        let error;
        if (accountId) {
            // Update existing account
            ({ error } = await supabase
                .from('accounts')
                .update(accountData)
                .eq('id', accountId));
        } else {
            // Insert new account
            accountData.user_id = user.id;
            ({ error } = await supabase
                .from('accounts')
                .insert(accountData));
        }

        if (error) throw error;

        hideModal();
        await fetchAndRenderAccounts();
        
    } catch (err) {
        console.error('Error saving account:', err);
        alert('Failed to save account. Check the console for details.');
    }
}

async function handleDelete() {
    const accountId = document.getElementById('accountId').value;
    
    if (!accountId || !confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', accountId);
            
        if (error) throw error;

        hideModal();
        await fetchAndRenderAccounts();
        
    } catch (err) {
        console.error('Error deleting account:', err);
        alert('Failed to delete account.');
    }
}

// ==========================================
// DATA LOADING AND RENDERING
// ==========================================

async function fetchAndRenderAccounts() {
    try {
        const { data: accounts, error } = await supabase
            .from('accounts')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const accountsList = document.getElementById('accountsList');
        const emptyState = document.getElementById('emptyState');
        const totalAssetsEl = document.getElementById('totalAssets');
        const totalDebtsEl = document.getElementById('totalDebts');
        const netWorthEl = document.getElementById('netWorth');

        if (!accountsList) return;

        let totalAssets = 0;
        let totalDebts = 0;

        // Clear existing accounts
        accountsList.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            if (emptyState) emptyState.classList.add('visible');
            if (totalAssetsEl) totalAssetsEl.textContent = '$0.00';
            if (totalDebtsEl) totalDebtsEl.textContent = '$0.00';
            if (netWorthEl) netWorthEl.textContent = '$0.00';
            return;
        }

        // Hide empty state
        if (emptyState) emptyState.classList.remove('visible');

        // Render accounts
        for (const account of accounts) {
            const accountItem = await createAccountItem(account);
            accountsList.appendChild(accountItem);

            // Calculate totals
            const balance = parseFloat(account.balance) || 0;
            if (account.type === 'asset') {
                totalAssets += balance;
            } else {
                totalDebts += balance;
            }
        }

        // Update summary
        if (totalAssetsEl) totalAssetsEl.textContent = formatCurrency(totalAssets);
        if (totalDebtsEl) totalDebtsEl.textContent = formatCurrency(totalDebts);
        if (netWorthEl) {
            const netWorth = totalAssets - totalDebts;
            netWorthEl.textContent = formatCurrency(netWorth);
        }

        // Initialize Lucide icons
        lucide.createIcons();

    } catch (err) {
        console.error('Error fetching accounts:', err);
    }
}

async function createAccountItem(account) {
    const accountItem = document.createElement('div');
    accountItem.className = `account-item ${account.type}`;
    
    const balance = parseFloat(account.balance) || 0;
    // Balance color matches account type (asset = green, debt = red)
    const balanceClass = account.type === 'asset' ? 'asset-balance' : 'debt-balance';
    
    // Choose icon based on type
    const icon = account.type === 'asset' ? 'wallet' : 'credit-card';
    
    accountItem.innerHTML = `
        <div class="account-main">
            <div class="account-main-left">
                <i data-lucide="chevron-right" class="account-expand-icon"></i>
                <div class="account-icon ${account.type}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="account-details">
                    <h4>${account.name}</h4>
                    <p>${account.type}</p>
                </div>
            </div>
            <div class="account-balance-section">
                <div class="account-balance ${balanceClass}">
                    ${formatCurrency(balance)}
                </div>
                <div class="account-actions">
                    <button class="btn-account-action btn-more" title="More options">
                        <i data-lucide="more-vertical"></i>
                    </button>
                    <div class="account-dropdown">
                        <button class="account-dropdown-item" data-action="edit">
                            <i data-lucide="edit-2"></i>
                            <span>Edit Account</span>
                        </button>
                        <button class="account-dropdown-item" data-action="view">
                            <i data-lucide="eye"></i>
                            <span>View Transactions</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="account-transactions">
            <div class="account-transactions-header">
                <h4>Transactions</h4>
            </div>
            <ul class="account-transactions-list" id="transactions-${account.id}">
                <li class="no-transactions">Loading...</li>
            </ul>
        </div>
    `;
    
    const accountMain = accountItem.querySelector('.account-main');
    const moreBtn = accountItem.querySelector('.btn-more');
    const dropdown = accountItem.querySelector('.account-dropdown');
    const dropdownItems = accountItem.querySelectorAll('.account-dropdown-item');
    
    // Toggle dropdown on three dots click
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close all other dropdowns
        document.querySelectorAll('.account-dropdown.visible').forEach(d => {
            if (d !== dropdown) {
                d.classList.remove('visible');
                d.previousElementSibling.classList.remove('active');
            }
        });
        
        // Toggle this dropdown
        dropdown.classList.toggle('visible');
        moreBtn.classList.toggle('active');
    });
    
    // Handle dropdown item clicks
    dropdownItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            
            // Close dropdown
            dropdown.classList.remove('visible');
            moreBtn.classList.remove('active');
            
            if (action === 'edit') {
                showModal(account);
            } else if (action === 'view') {
                // Expand to view transactions
                const isExpanded = accountItem.classList.contains('expanded');
                
                // Collapse all other accounts
                document.querySelectorAll('.account-item.expanded').forEach(item => {
                    if (item !== accountItem) {
                        item.classList.remove('expanded');
                    }
                });
                
                // Expand this account if not already expanded
                if (!isExpanded) {
                    accountItem.classList.add('expanded');
                    await loadAccountTransactions(account);
                }
                
                lucide.createIcons();
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!accountItem.contains(e.target)) {
            dropdown.classList.remove('visible');
            moreBtn.classList.remove('active');
        }
    });
    
    // Toggle expand/collapse on main click
    accountMain.addEventListener('click', async (e) => {
        // Don't toggle if clicking actions area
        if (e.target.closest('.account-actions')) {
            return;
        }
        
        const isExpanded = accountItem.classList.contains('expanded');
        
        // Collapse all other accounts
        document.querySelectorAll('.account-item.expanded').forEach(item => {
            if (item !== accountItem) {
                item.classList.remove('expanded');
            }
        });
        
        // Toggle this account
        accountItem.classList.toggle('expanded');
        
        // Load transactions if expanding
        if (!isExpanded) {
            await loadAccountTransactions(account);
        }
        
        lucide.createIcons();
    });
    
    return accountItem;
}

async function loadAccountTransactions(account) {
    const transactionsListEl = document.getElementById(`transactions-${account.id}`);
    
    if (!transactionsListEl) return;
    
    try {
        // Check cache first
        if (!allTransactions[account.name]) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('account', account.name)
                .order('day', { ascending: false });
            
            if (error) throw error;
            
            allTransactions[account.name] = data || [];
        }
        
        const transactions = allTransactions[account.name];
        
        // Render transactions
        if (transactions.length === 0) {
            transactionsListEl.innerHTML = '<li class="no-transactions">No transactions yet</li>';
            return;
        }
        
        transactionsListEl.innerHTML = transactions.map(t => {
            const [year, month, day] = t.day.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            const formattedDate = date.toLocaleDateString(undefined, { 
                timeZone: 'UTC',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            
            const type = t.type === 'income' ? 'income' : 'expense';
            const icon = type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle';
            
            return `
                <li class="account-transaction-item" data-transaction-id="${t.id}">
                    <div class="transaction-left">
                        <div class="transaction-type-icon ${type}">
                            <i data-lucide="${icon}"></i>
                        </div>
                        <div class="transaction-details-text">
                            <div class="transaction-merchant">${t.merchant}</div>
                            <div class="transaction-category">${t.category || 'Uncategorized'}</div>
                        </div>
                    </div>
                    <div class="transaction-right">
                        <div class="transaction-amount ${type}">${formatCurrency(t.amount)}</div>
                        <div class="transaction-date">${formattedDate}</div>
                    </div>
                </li>
            `;
        }).join('');
        
        // Add click handlers to transactions
        const transactionItems = transactionsListEl.querySelectorAll('.account-transaction-item');
        transactionItems.forEach(item => {
            item.addEventListener('click', () => {
                const transactionId = item.dataset.transactionId;
                const transaction = transactions.find(t => t.id === transactionId);
                if (transaction) {
                    openTransactionEditModal(transaction, account);
                }
            });
        });
        
        lucide.createIcons();
        
    } catch (err) {
        console.error('Error loading transactions:', err);
        transactionsListEl.innerHTML = '<li class="no-transactions">Failed to load transactions</li>';
    }
}

// Add this new function for editing transactions
function openTransactionEditModal(transaction, account) {
    // For now, just redirect to transactions page with a plan to add edit modal later
    // You could also build an edit modal here similar to the account modal
    alert(`Edit transaction: ${transaction.merchant}\nAmount: ${formatCurrency(transaction.amount)}\n\nTransaction editing will open a modal here. For now, please use the Transactions page to edit.`);
    
    // Optional: Navigate to transactions page
    // window.location.href = 'transactions.html';
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}