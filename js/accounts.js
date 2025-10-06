// js/accounts.js - Complete Debug Version

// ==========================================
// STATE MANAGEMENT
// ==========================================

let isInitialized = false;
let allTransactions = {};

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeAccountsPage() {
    const user = await requireAuth();
    if (!user) return;

    if (!isInitialized) {
        setupEventListeners();
        setupRealtime(user.id);
        isInitialized = true;
    }
    
    await fetchAndRenderAccounts();
}

function setupEventListeners() {
    const showAddAccountModalBtn = document.getElementById('showAddAccountModalBtn');
    const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
    const accountModal = document.getElementById('accountModal');
    const accountForm = document.getElementById('accountForm');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    const closeTransactionModalBtn = document.getElementById('closeTransactionModalBtn');
    const transactionModal = document.getElementById('transactionModal');
    const transactionForm = document.getElementById('transactionForm');
    const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
    
    if (showAddAccountModalBtn) {
        showAddAccountModalBtn.addEventListener('click', () => showModal());
    }
    
    if (closeAccountModalBtn) {
        closeAccountModalBtn.addEventListener('click', hideModal);
    }
    
    if (accountModal) {
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) hideModal();
        });
    }
    
    if (accountForm) {
        accountForm.addEventListener('submit', handleFormSubmit);
    }
    
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDelete);
    }
    
    if (closeTransactionModalBtn) {
        closeTransactionModalBtn.addEventListener('click', hideTransactionModal);
    }
    
    if (transactionModal) {
        transactionModal.addEventListener('click', (e) => {
            if (e.target === transactionModal) hideTransactionModal();
        });
    }
    
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionFormSubmit);
    }
    
    if (deleteTransactionBtn) {
        deleteTransactionBtn.addEventListener('click', handleTransactionDelete);
    }
}

// ==========================================
// REALTIME SETUP (DEBUG VERSION)
// ==========================================

function setupRealtime(userId) {
    console.log('🔄 Setting up accounts realtime...');
    console.log('👤 User ID:', userId);
    
    // Subscribe to account changes (with filter for security)
    supabase
        .channel('accounts-page-accounts')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'accounts',
            filter: `user_id=eq.${userId}` // Only get OUR account changes
        }, async (payload) => {
            console.log('✨ Account changed:', payload.eventType);
            await fetchAndRenderAccounts();
        })
        .subscribe((status, err) => {
            console.log('📡 Accounts subscription:', status);
            if (err) console.error('❌ Error:', err);
        });
    
    // Subscribe to transaction changes (they affect account balances)
    supabase
        .channel('accounts-page-transactions')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}` // Only get OUR transaction changes
        }, async (payload) => {
            console.log('✨ Transaction changed (affecting balances)');
            
            // Clear transaction cache for affected account
            const accountName = payload.new?.account || payload.old?.account;
            if (accountName && allTransactions[accountName]) {
                delete allTransactions[accountName];
            }
            
            await fetchAndRenderAccounts();
        })
        .subscribe((status, err) => {
            console.log('📡 Transactions subscription:', status);
            if (err) console.error('❌ Error:', err);
        });
    
    console.log('✅ Realtime subscriptions created!');
}

// ==========================================
// PAGE LIFECYCLE
// ==========================================

window.addEventListener('DOMContentLoaded', initializeAccountsPage);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        console.log('Page from cache, reloading...');
        isInitialized = false;
        initializeAccountsPage();
    }
});

document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && isInitialized) {
        console.log('Page visible, refreshing accounts...');
        await fetchAndRenderAccounts();
    }
});

window.addEventListener('focus', async () => {
    if (isInitialized) {
        console.log('Window focused, refreshing accounts...');
        await fetchAndRenderAccounts();
    }
});

window.addEventListener('beforeunload', () => {
    supabase.removeAllChannels();
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
        modalTitle.textContent = 'Edit Account';
        document.getElementById('accountId').value = account.id;
        document.getElementById('accountName').value = account.name;
        document.getElementById('accountBalance').value = parseFloat(account.balance);
        document.getElementById('accountType').value = account.type;
        if (deleteAccountBtn) deleteAccountBtn.style.display = 'flex';
    } else {
        modalTitle.textContent = 'Add Account';
        document.getElementById('accountId').value = '';
        if (deleteAccountBtn) deleteAccountBtn.style.display = 'none';
    }
    
    accountModal.classList.add('active');
    setTimeout(() => lucide.createIcons(), 10);
}

function hideModal() {
    const accountModal = document.getElementById('accountModal');
    if (accountModal) accountModal.classList.remove('active');
}

function hideTransactionModal() {
    const transactionModal = document.getElementById('transactionModal');
    if (transactionModal) transactionModal.classList.remove('active');
}

// ==========================================
// EVENT HANDLERS (DEBUG VERSION)
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
        let error, data;
        if (accountId) {
            // Update existing account
            const result = await supabase
                .from('accounts')
                .update(accountData)
                .eq('id', accountId)
                .select();
            
            error = result.error;
            data = result.data;
        } else {
            // Insert new account
            accountData.user_id = user.id;
            const result = await supabase
                .from('accounts')
                .insert(accountData)
                .select();
            
            error = result.error;
            data = result.data;
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
        const { data: transactions, error: checkError } = await supabase
            .from('transactions')
            .select('id')
            .or(`account.eq.${accountName},transfer_to_account.eq.${accountName}`);
        
        if (checkError) throw checkError;
        
        const transactionCount = transactions?.length || 0;
        let confirmMessage = `Are you sure you want to delete "${accountName}"?`;
        
        if (transactionCount > 0) {
            confirmMessage = `This account has ${transactionCount} associated transaction(s).\n\n` +
                           `Deleting "${accountName}" will also delete all ${transactionCount} transaction(s).\n\n` +
                           `This action cannot be undone. Are you sure?`;
        } else {
            confirmMessage += '\n\nThis action cannot be undone.';
        }
        
        if (!confirm(confirmMessage)) return;
        
        if (transactionCount > 0) {
            const { error: deleteTransError } = await supabase
                .from('transactions')
                .delete()
                .or(`account.eq.${accountName},transfer_to_account.eq.${accountName}`);
            
            if (deleteTransError) throw deleteTransError;
        }
        
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
// DATA LOADING
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

        accountsList.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            if (emptyState) emptyState.classList.add('visible');
            if (totalAssetsEl) totalAssetsEl.textContent = '$0.00';
            if (totalDebtsEl) totalDebtsEl.textContent = '$0.00';
            if (netWorthEl) netWorthEl.textContent = '$0.00';
            return;
        }

        if (emptyState) emptyState.classList.remove('visible');

        for (const account of accounts) {
            const accountItem = await createAccountItem(account);
            accountsList.appendChild(accountItem);

            const balance = parseFloat(account.balance) || 0;
            if (account.type === 'asset') {
                totalAssets += balance;
            } else {
                totalDebts += balance;
            }
        }

        if (totalAssetsEl) totalAssetsEl.textContent = formatCurrency(totalAssets);
        if (totalDebtsEl) totalDebtsEl.textContent = formatCurrency(totalDebts);
        if (netWorthEl) {
            const netWorth = totalAssets - totalDebts;
            netWorthEl.textContent = formatCurrency(netWorth);
        }

        lucide.createIcons();

    } catch (err) {
        console.error('Error fetching accounts:', err);
    }
}

async function createAccountItem(account) {
    const accountItem = document.createElement('div');
    accountItem.className = `account-item ${account.type}`;
    
    const balance = parseFloat(account.balance) || 0;
    const balanceClass = account.type === 'asset' ? 'asset-balance' : 'debt-balance';
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
    
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.account-dropdown.visible').forEach(d => {
            if (d !== dropdown) {
                d.classList.remove('visible');
                d.previousElementSibling.classList.remove('active');
            }
        });
        dropdown.classList.toggle('visible');
        moreBtn.classList.toggle('active');
    });
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            
            dropdown.classList.remove('visible');
            moreBtn.classList.remove('active');
            
            if (action === 'edit') {
                showModal(account);
            } else if (action === 'view') {
                const isExpanded = accountItem.classList.contains('expanded');
                
                document.querySelectorAll('.account-item.expanded').forEach(item => {
                    if (item !== accountItem) {
                        item.classList.remove('expanded');
                    }
                });
                
                if (!isExpanded) {
                    accountItem.classList.add('expanded');
                    await loadAccountTransactions(account);
                }
                
                lucide.createIcons();
            }
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!accountItem.contains(e.target)) {
            dropdown.classList.remove('visible');
            moreBtn.classList.remove('active');
        }
    });
    
    accountMain.addEventListener('click', async (e) => {
        if (e.target.closest('.account-actions')) return;
        
        const isExpanded = accountItem.classList.contains('expanded');
        
        document.querySelectorAll('.account-item.expanded').forEach(item => {
            if (item !== accountItem) item.classList.remove('expanded');
        });
        
        accountItem.classList.toggle('expanded');
        
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
        if (!allTransactions[account.name]) {
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
            
            if (t.type === 'transfer') {
                if (t.account === account.name) {
                    type = 'expense';
                    icon = 'arrow-up-circle';
                    displayText = `Transfer to ${t.transfer_to_account}`;
                } else {
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
        
        lucide.createIcons();
        
        setTimeout(() => {
            const transactionItems = transactionsListEl.querySelectorAll('.account-transaction-item');
            transactionItems.forEach((item) => {
                item.addEventListener('click', (e) => {
                    const transactionId = item.dataset.transactionId;
                    const transaction = transactions.find(t => String(t.id) === String(transactionId));
                    if (transaction) openTransactionEditModal(transaction, account);
                });
            });
        }, 50);
        
    } catch (err) {
        console.error('Error loading transactions:', err);
        transactionsListEl.innerHTML = '<li class="no-transactions">Failed to load transactions</li>';
    }
}

// ==========================================
// TRANSACTION EDIT (Stub functions - add full implementation if needed)
// ==========================================

async function openTransactionEditModal(transaction, account) {
    console.log('Transaction edit modal - not fully implemented in this debug version');
}

async function handleTransactionFormSubmit(e) {
    e.preventDefault();
    console.log('Transaction form submit - not fully implemented');
}

async function handleTransactionDelete() {
    console.log('Transaction delete - not fully implemented');
}

// ==========================================
// UTILITY
// ==========================================

function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}