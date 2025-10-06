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
    
    // Transaction modal elements
    const closeTransactionModalBtn = document.getElementById('closeTransactionModalBtn');
    const transactionModal = document.getElementById('transactionModal');
    const transactionForm = document.getElementById('transactionForm');
    const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
    
    // Show account modal
    if (showAddAccountModalBtn) {
        showAddAccountModalBtn.addEventListener('click', () => showModal());
    }
    
    // Close account modal
    if (closeAccountModalBtn) {
        closeAccountModalBtn.addEventListener('click', hideModal);
    }
    
    // Close account modal on overlay click
    if (accountModal) {
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) hideModal();
        });
    }
    
    // Account form submission
    if (accountForm) {
        accountForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Delete account button
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDelete);
    }
    
    // Transaction modal - close button
    if (closeTransactionModalBtn) {
        closeTransactionModalBtn.addEventListener('click', hideTransactionModal);
    }
    
    // Transaction modal - close on overlay click
    if (transactionModal) {
        transactionModal.addEventListener('click', (e) => {
            if (e.target === transactionModal) hideTransactionModal();
        });
    }
    
    // Transaction form submission
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionFormSubmit);
    }
    
    // Delete transaction button
    if (deleteTransactionBtn) {
        deleteTransactionBtn.addEventListener('click', handleTransactionDelete);
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

// Add these after your existing event listeners in each file

// Handle page visibility
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && isInitialized) {
        console.log('Page visible, refreshing data...');
        await loadPageData(); // Your page's data loading function
    }
});

// Handle browser back/forward
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        console.log('Page from cache, reloading...');
        isInitialized = false;
        await initializePage(); // Your page's init function
    }
});

// Handle window focus
window.addEventListener('focus', async () => {
    if (isInitialized) {
        console.log('Window focused, refreshing...');
        await loadPageData();
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

function hideTransactionModal() {
    const transactionModal = document.getElementById('transactionModal');
    if (transactionModal) {
        transactionModal.classList.remove('active');
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
    const accountName = document.getElementById('accountName').value;
    
    if (!accountId) return;

    try {
        // Check if account has transactions
        const { data: transactions, error: checkError } = await supabase
            .from('transactions')
            .select('id')
            .or(`account.eq.${accountName},transfer_to_account.eq.${accountName}`);
        
        if (checkError) throw checkError;
        
        const transactionCount = transactions?.length || 0;
        
        // Build confirmation message
        let confirmMessage = `Are you sure you want to delete "${accountName}"?`;
        
        if (transactionCount > 0) {
            confirmMessage = `This account has ${transactionCount} associated transaction(s).\n\n` +
                           `Deleting "${accountName}" will also delete all ${transactionCount} transaction(s).\n\n` +
                           `This action cannot be undone. Are you sure?`;
        } else {
            confirmMessage += '\n\nThis action cannot be undone.';
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Delete associated transactions first
        if (transactionCount > 0) {
            const { error: deleteTransError } = await supabase
                .from('transactions')
                .delete()
                .or(`account.eq.${accountName},transfer_to_account.eq.${accountName}`);
            
            if (deleteTransError) throw deleteTransError;
        }
        
        // Delete account
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
            // Fetch transactions where this account is EITHER the source OR destination
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .or(`account.eq.${account.name},transfer_to_account.eq.${account.name}`)
                .order('day', { ascending: false });
            
            if (error) throw error;
            
            allTransactions[account.name] = data || [];
        }
        
        const transactions = allTransactions[account.name];
        
        console.log('Loading transactions for account:', account.name, 'Count:', transactions.length);
        
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
            
            let type, icon, displayText;
            
            // Determine how to display this transaction from this account's perspective
            if (t.type === 'transfer') {
                if (t.account === account.name) {
                    // Money leaving this account
                    type = 'expense';
                    icon = 'arrow-up-circle';
                    displayText = `Transfer to ${t.transfer_to_account}`;
                } else {
                    // Money coming into this account
                    type = 'income';
                    icon = 'arrow-down-circle';
                    displayText = `Transfer from ${t.account}`;
                }
            } else {
                type = t.type === 'income' ? 'income' : 'expense';
                icon = type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle';
                displayText = t.merchant;
            }
            
            return `
                <li class="account-transaction-item" data-transaction-id="${t.id}">
                    <div class="transaction-left">
                        <div class="transaction-type-icon ${type}">
                            <i data-lucide="${icon}"></i>
                        </div>
                        <div class="transaction-details-text">
                            <div class="transaction-merchant">${displayText}</div>
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
        
        // Reinitialize Lucide icons first
        lucide.createIcons();
        
        // Add click handlers AFTER rendering
        setTimeout(() => {
            const transactionItems = transactionsListEl.querySelectorAll('.account-transaction-item');
            
            transactionItems.forEach((item) => {
                item.addEventListener('click', (e) => {
                    const transactionId = item.dataset.transactionId;
                    const transaction = transactions.find(t => String(t.id) === String(transactionId));
                    
                    if (transaction) {
                        openTransactionEditModal(transaction, account);
                    }
                });
            });
        }, 50);
        
    } catch (err) {
        console.error('Error loading transactions:', err);
        transactionsListEl.innerHTML = '<li class="no-transactions">Failed to load transactions</li>';
    }
}
// ==========================================
// TRANSACTION EDIT MODAL
// ==========================================

async function openTransactionEditModal(transaction, account) {
    console.log('=== openTransactionEditModal CALLED ==='); // DEBUG
    console.log('Transaction:', transaction); // DEBUG
    console.log('Account:', account); // DEBUG
    
    const transactionModal = document.getElementById('transactionModal');
    const transactionForm = document.getElementById('transactionForm');
    
    console.log('Modal element found:', !!transactionModal); // DEBUG
    console.log('Form element found:', !!transactionForm); // DEBUG
    
    if (!transactionModal || !transactionForm) {
        console.error('Modal or form not found!'); // DEBUG
        return;
    }
    
    console.log('Populating form...'); // DEBUG
    
    // Populate form with transaction data
    document.getElementById('transactionId').value = transaction.id;
    document.getElementById('transactionMonthKey').value = transaction.month_key;
    document.getElementById('transactionDay').value = transaction.day;
    document.getElementById('transactionMerchant').value = transaction.merchant;
    document.getElementById('transactionAmount').value = parseFloat(transaction.amount);
    document.getElementById('transactionType').value = transaction.type;
    document.getElementById('transactionRecurring').checked = transaction.recurring || false;
    
    console.log('Loading dropdowns...'); // DEBUG
    
    // Load and populate accounts dropdown
    await loadAccountsDropdown(transaction.account);
    
    // Load and populate categories dropdown
    await loadCategoriesDropdown(transaction.category);
    
    console.log('Showing modal...'); // DEBUG
    
    // Show modal
    transactionModal.classList.add('active');
    
    console.log('Modal classes:', transactionModal.className); // DEBUG
    
    // Initialize Lucide icons
    setTimeout(() => {
        lucide.createIcons();
    }, 10);
}

async function loadAccountsDropdown(selectedAccount = '') {
    try {
        const { data: accounts, error } = await supabase
            .from('accounts')
            .select('name')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        const accountSelect = document.getElementById('transactionAccount');
        if (!accountSelect) return;
        
        accountSelect.innerHTML = '<option value="">Select Account</option>';
        
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.name;
            option.textContent = account.name;
            if (account.name === selectedAccount) {
                option.selected = true;
            }
            accountSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading accounts:', err);
    }
}

async function loadCategoriesDropdown(selectedCategory = '') {
    try {
        const transactionMonthKey = document.getElementById('transactionMonthKey').value;
        
        const { data: budgets, error } = await supabase
            .from('budgets')
            .select('data')
            .eq('month_key', transactionMonthKey);
        
        if (error) {
            console.error('Error loading budget:', error);
        }
        
        const categorySelect = document.getElementById('transactionCategory');
        if (!categorySelect) return;
        
        categorySelect.innerHTML = '<option value="">Uncategorized</option>';
        
        const budget = budgets && budgets.length > 0 ? budgets[0] : null;
        const categories = budget?.data?.categories || [];
        
        if (categories && categories.length > 0) {
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                if (cat.name === selectedCategory) {
                    option.selected = true;
                }
                categorySelect.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

async function handleTransactionFormSubmit(e) {
    e.preventDefault();
    
    const transactionId = document.getElementById('transactionId').value;
    
    // Get old transaction data
    const expandedAccount = document.querySelector('.account-item.expanded');
    const accountName = expandedAccount.querySelector('.account-details h4').textContent;
    const oldTransaction = allTransactions[accountName]?.find(t => String(t.id) === String(transactionId));
    
    if (!oldTransaction) {
        alert('Could not find original transaction');
        return;
    }
    
    const newTransactionData = {
        day: document.getElementById('transactionDay').value,
        merchant: document.getElementById('transactionMerchant').value,
        amount: parseFloat(document.getElementById('transactionAmount').value),
        category: document.getElementById('transactionCategory').value || null,
        account: document.getElementById('transactionAccount').value,
        type: document.getElementById('transactionType').value,
        recurring: document.getElementById('transactionRecurring').checked,
        month_key: document.getElementById('transactionMonthKey').value
    };

    try {
        // Reverse old transaction's effect
        if (oldTransaction.type === 'transfer') {
            await updateAccountBalanceForTransfer(
                oldTransaction.account,
                oldTransaction.transfer_to_account,
                oldTransaction.amount,
                'reverse'
            );
        } else {
            await updateAccountBalance(
                oldTransaction.account,
                oldTransaction.type,
                oldTransaction.amount,
                'reverse'
            );
        }
        
        // Update transaction in database
        const { error } = await supabase
            .from('transactions')
            .update(newTransactionData)
            .eq('id', transactionId);

        if (error) throw error;
        
        // Apply new transaction's effect
        if (newTransactionData.type === 'transfer') {
            await updateAccountBalanceForTransfer(
                newTransactionData.account,
                newTransactionData.transfer_to_account,
                newTransactionData.amount,
                'add'
            );
        } else {
            await updateAccountBalance(
                newTransactionData.account,
                newTransactionData.type,
                newTransactionData.amount,
                'add'
            );
        }

        hideTransactionModal();
        
        // Clear cache and reload
        delete allTransactions[accountName];
        const accounts = await supabase
            .from('accounts')
            .select('*')
            .eq('name', accountName)
            .single();
        if (accounts.data) {
            await loadAccountTransactions(accounts.data);
            lucide.createIcons();
        }
        
        await fetchAndRenderAccounts();
        
    } catch (err) {
        console.error('Error updating transaction:', err);
        alert('Failed to update transaction. Check the console for details.');
    }
}

async function handleTransactionDelete() {
    const transactionId = document.getElementById('transactionId').value;
    
    if (!transactionId || !confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
        return;
    }

    try {
        const expandedAccount = document.querySelector('.account-item.expanded');
        const accountName = expandedAccount.querySelector('.account-details h4').textContent;
        const transaction = allTransactions[accountName]?.find(t => String(t.id) === String(transactionId));
        
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        
        // DEBUG: Log transaction details
        console.log('=== DELETING TRANSACTION ===');
        console.log('Transaction type:', transaction.type);
        console.log('Transaction account:', transaction.account);
        console.log('Transfer to account:', transaction.transfer_to_account);
        console.log('Amount:', transaction.amount);
        console.log('Currently viewing account:', accountName);
        
        // Delete transaction from database
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionId);
            
        if (error) throw error;
        
        // Reverse the balance change based on transaction type
        if (transaction.type === 'transfer') {
            console.log('Calling updateAccountBalanceForTransfer with:', {
                from: transaction.account,
                to: transaction.transfer_to_account,
                amount: transaction.amount,
                operation: 'reverse'
            });
            
            await updateAccountBalanceForTransfer(
                transaction.account,
                transaction.transfer_to_account,
                transaction.amount,
                'reverse'
            );
        } else {
            await updateAccountBalance(
                transaction.account,
                transaction.type,
                transaction.amount,
                'reverse'
            );
        }

        hideTransactionModal();
        
        // Clear cache and reload
        delete allTransactions[accountName];
        const { data: accountData } = await supabase
            .from('accounts')
            .select('*')
            .eq('name', accountName)
            .single();
            
        if (accountData) {
            await loadAccountTransactions(accountData);
            lucide.createIcons();
        }
        
        await fetchAndRenderAccounts();
        
    } catch (err) {
        console.error('Error deleting transaction:', err);
        alert('Failed to delete transaction.');
    }
}

async function updateAccountBalance(accountName, transactionType, amount, operation) {
    try {
        // Get current account balance and type
        const { data: account, error: fetchError } = await supabase
            .from('accounts')
            .select('balance, type')
            .eq('name', accountName)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(account.balance) || 0;
        const transactionAmount = parseFloat(amount) || 0;
        const isDebtAccount = account.type === 'debt';
        let newBalance;

        if (operation === 'add') {
            // Adding a transaction
            if (isDebtAccount) {
                // For debt accounts: expense increases debt, income decreases debt
                if (transactionType === 'income') {
                    newBalance = currentBalance - transactionAmount;
                } else {
                    newBalance = currentBalance + transactionAmount;
                }
            } else {
                // For asset accounts: income increases balance, expense decreases balance
                if (transactionType === 'income') {
                    newBalance = currentBalance + transactionAmount;
                } else {
                    newBalance = currentBalance - transactionAmount;
                }
            }
        } else {
            // Reversing a transaction (just flip the operations)
            if (isDebtAccount) {
                if (transactionType === 'income') {
                    newBalance = currentBalance + transactionAmount;
                } else {
                    newBalance = currentBalance - transactionAmount;
                }
            } else {
                if (transactionType === 'income') {
                    newBalance = currentBalance - transactionAmount;
                } else {
                    newBalance = currentBalance + transactionAmount;
                }
            }
        }

        // Update account balance
        const { error: updateError } = await supabase
            .from('accounts')
            .update({ balance: newBalance })
            .eq('name', accountName);

        if (updateError) throw updateError;
        
    } catch (err) {
        console.error('Error updating account balance:', err);
        throw err;
    }
}

async function updateAccountBalanceForTransfer(fromAccount, toAccount, amount, operation) {
    try {
        const transactionAmount = parseFloat(amount) || 0;
        
        console.log('Transfer balance update:', {fromAccount, toAccount, amount, operation});
        
        // Get both accounts
        const { data: accounts, error: fetchError } = await supabase
            .from('accounts')
            .select('name, balance, type')
            .in('name', [fromAccount, toAccount]);

        if (fetchError) throw fetchError;
        
        const fromAcc = accounts.find(a => a.name === fromAccount);
        const toAcc = accounts.find(a => a.name === toAccount);
        
        if (!fromAcc || !toAcc) {
            console.warn(`Transfer account(s) not found: ${fromAccount} or ${toAccount}. Skipping balance update.`);
            return;
        }
        
        console.log('Current balances:', {from: fromAcc.balance, to: toAcc.balance});
        
        let newFromBalance, newToBalance;
        const fromBalance = parseFloat(fromAcc.balance) || 0;
        const toBalance = parseFloat(toAcc.balance) || 0;
        
        if (operation === 'add') {
            newFromBalance = fromBalance - transactionAmount;
            newToBalance = toBalance + transactionAmount;
        } else {
            // Reverse: add back to source, subtract from destination
            newFromBalance = fromBalance + transactionAmount;
            newToBalance = toBalance - transactionAmount;
        }
        
        console.log('New balances:', {from: newFromBalance, to: newToBalance});
        
        // Update BOTH accounts in parallel using Promise.all
        const [result1, result2] = await Promise.all([
            supabase
                .from('accounts')
                .update({ balance: newFromBalance })
                .eq('name', fromAccount),
            supabase
                .from('accounts')
                .update({ balance: newToBalance })
                .eq('name', toAccount)
        ]);
        
        if (result1.error) {
            console.error('Error updating from account:', result1.error);
            throw result1.error;
        }
        
        if (result2.error) {
            console.error('Error updating to account:', result2.error);
            throw result2.error;
        }
        
        console.log('Both accounts updated successfully');
        
    } catch (err) {
        console.error('Error updating account balances for transfer:', err);
        throw err;
    }
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