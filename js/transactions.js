// js/transactions.js

// ==========================================
// STATE MANAGEMENT
// ==========================================

let transactions = [];
let allCategories = [];
let currentUser = null;

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeTransactionsPage() {
    currentUser = await requireAuth();
    if (!currentUser) return;

    // Initialize DOM elements
    initializeDOMElements();
    
    // Set up event listeners (only once)
    if (!window.transactionListenersAttached) {
        setupEventListeners();
        window.transactionListenersAttached = true;
    }
    
    // Load data immediately if month is available
    if (MonthNavigation.currentMonth) {
        await loadPageData();
    }
}

function initializeDOMElements() {
    // Set today's date as default
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    const dateInput = document.getElementById('day');
    if (dateInput) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
    // Set default type to expense
    const expenseBtn = document.querySelector('.toggle-btn[data-type="expense"]');
    if (expenseBtn) {
        expenseBtn.classList.add('active');
    }
}

function setupEventListeners() {
    // Month navigation events
    window.addEventListener('monthChanged', handleMonthChange);
    window.addEventListener('monthNavReady', handleMonthChange);
    
    // Type toggle buttons
    const typeToggleButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    typeToggleButtons.forEach(btn => {
        btn.addEventListener('click', handleTypeToggle);
    });
    
    // Transaction form submission
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Search filter
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) {
        searchFilter.addEventListener('input', renderTransactions);
    }
}

function handleMonthChange() {
    if (MonthNavigation.currentMonth) {
        loadPageData();
    }
}

async function loadPageData() {
    if (!MonthNavigation.currentMonth) {
        console.log("Waiting for month navigation...");
        return;
    }
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Load all data
    await loadCategories();
    await populateAccountsDropdowns();
    await loadTransactions();
}

// ==========================================
// PAGE LIFECYCLE EVENT LISTENERS
// ==========================================

window.addEventListener('DOMContentLoaded', initializeTransactionsPage);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.transactionListenersAttached = false;
        initializeTransactionsPage();
    }
});

// ==========================================
// EVENT HANDLERS
// ==========================================

function handleTypeToggle(event) {
    const btn = event.currentTarget;
    const typeButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    
    // Remove active from all buttons
    typeButtons.forEach(b => b.classList.remove('active'));
    
    // Add active to clicked button
    btn.classList.add('active');
    
    // Update hidden input
    const typeInput = document.getElementById('type');
    if (typeInput) {
        typeInput.value = btn.dataset.type;
    }
    
    // Show/hide transfer destination field
    const transferToGroup = document.getElementById('transferToAccountGroup');
    const categoryGroup = document.getElementById('categoryGroup');
    const categorySelect = document.getElementById('category');
    const transferToSelect = document.getElementById('transferToAccount');
    
    if (btn.dataset.type === 'transfer') {
        // Show transfer field, hide category
        if (transferToGroup) transferToGroup.style.display = 'block';
        if (categoryGroup) categoryGroup.style.display = 'none';
        
        // Remove required from category, add to transferToAccount
        if (categorySelect) categorySelect.removeAttribute('required');
        if (transferToSelect) transferToSelect.setAttribute('required', 'required');
    } else {
        // Hide transfer field, show category
        if (transferToGroup) transferToGroup.style.display = 'none';
        if (categoryGroup) categoryGroup.style.display = 'block';
        
        // Add required to category, remove from transferToAccount
        if (categorySelect) categorySelect.setAttribute('required', 'required');
        if (transferToSelect) transferToSelect.removeAttribute('required');
    }
    
    // Update category dropdown
    populateCategoryDropdown();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!currentUser) {
        alert('You must be logged in to add a transaction.');
        return;
    }
    
    const type = document.getElementById('type').value;
    const account = document.getElementById('account').value;
    const amount = parseFloat(document.getElementById('amount').value);
    
    // Gather form data
    const transaction = {
        user_id: currentUser.id,
        month_key: MonthNavigation.currentMonth,
        type: type,
        merchant: document.getElementById('merchant').value,
        amount: amount,
        day: document.getElementById('day').value,
        category: type === 'transfer' ? 'Transfer' : document.getElementById('category').value,
        account: account,
        recurring: document.getElementById('recurring').checked,
        transfer_to_account: null
    };
    
    // Handle transfer
    if (type === 'transfer') {
        const transferToAccount = document.getElementById('transferToAccount').value;
        
        if (!transferToAccount) {
            alert('Please select a destination account for the transfer.');
            return;
        }
        
        if (account === transferToAccount) {
            alert('Cannot transfer to the same account.');
            return;
        }
        
        transaction.transfer_to_account = transferToAccount;
    }
    
    try {
        // Insert transaction
        const { error } = await supabase
            .from('transactions')
            .insert([transaction]);
        
        if (error) throw error;
        
        // Update account balance(s)
        if (type === 'transfer') {
            // Transfer: decrease source, increase destination
            await updateAccountBalanceForTransfer(account, transaction.transfer_to_account, amount, 'add');
        } else {
            // Regular income/expense
            await updateAccountBalance(account, type, amount, 'add');
        }
        
        // Reset form
        resetForm();
        
        // Reload transactions
        await loadTransactions();
        
    } catch (err) {
        console.error('Error adding transaction:', err);
        alert('Failed to add transaction. Check console for details.');
    }
}

function resetForm() {
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.reset();
    }
    
    // Reset date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    const dateInput = document.getElementById('day');
    if (dateInput) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
    // Reset type to expense
    const typeButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    typeButtons.forEach(btn => btn.classList.remove('active'));
    
    const expenseBtn = document.querySelector('.toggle-btn[data-type="expense"]');
    if (expenseBtn) {
        expenseBtn.classList.add('active');
    }
    
    const typeInput = document.getElementById('type');
    if (typeInput) {
        typeInput.value = 'expense';
    }
    
    populateCategoryDropdown();
}

async function handleDelete(event) {
    const transactionItem = event.currentTarget.closest('.transaction-item');
    if (!transactionItem) return;
    
    const id = transactionItem.dataset.id;
    
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    try {
        // Get transaction details before deleting
        const transaction = transactions.find(t => t.id === parseInt(id));
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        
        // Delete transaction
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        // Reverse the balance change
        if (transaction.type === 'transfer') {
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
        
        await loadTransactions();
        
    } catch (err) {
        console.error("Error deleting transaction:", err);
        alert('Failed to delete transaction. Check console for details.');
    }
}

async function updateAccountBalance(accountName, transactionType, amount, operation) {
    try {
        // Skip if no account name
        if (!accountName) {
            console.warn('No account name provided, skipping balance update');
            return;
        }
        
        // Get current account balance and type
        const { data: account, error: fetchError } = await supabase
            .from('accounts')
            .select('balance, type')
            .eq('name', accountName)
            .maybeSingle(); // Use maybeSingle() instead of single()

        if (fetchError) throw fetchError;
        
        // If account doesn't exist, log and skip
        if (!account) {
            console.warn(`Account "${accountName}" not found, skipping balance update`);
            return;
        }

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
            // Reversing a transaction
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
// DATA LOADING FUNCTIONS
// ==========================================

async function loadTransactions() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('month_key', MonthNavigation.currentMonth)
            .order('day', { ascending: false });
        
        if (error) throw error;
        
        transactions = data || [];
        renderTransactions();
        
    } catch (err) {
        console.error('Error loading transactions:', err);
        transactions = [];
        renderTransactions();
    }
}

async function loadCategories() {
    try {
        const budgetData = await BudgetData.getMonthData(MonthNavigation.currentMonth);
        allCategories = (budgetData.expenses || []).map(exp => exp.name);
        populateCategoryDropdown();
    } catch (err) {
        console.error('Error loading categories:', err);
        allCategories = [];
        populateCategoryDropdown();
    }
}

async function populateAccountsDropdowns() {
    try {
        const { data, error } = await supabase
            .from('accounts')
            .select('name, type')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        const accountSelect = document.getElementById('account');
        const transferToSelect = document.getElementById('transferToAccount');
        
        if (!data || data.length === 0) {
            if (accountSelect) accountSelect.innerHTML = '<option value="">No accounts available</option>';
            if (transferToSelect) transferToSelect.innerHTML = '<option value="">No accounts available</option>';
            return;
        }
        
        const options = '<option value="">Select Account</option>' +
            data.map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('');
        
        if (accountSelect) accountSelect.innerHTML = options;
        if (transferToSelect) transferToSelect.innerHTML = options;
        
    } catch (err) {
        console.error("Error fetching accounts:", err);
    }
}

function populateCategoryDropdown() {
    const typeInput = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    
    if (!typeInput || !categorySelect) return;
    
    const type = typeInput.value;
    let options = '<option value="">Select Category</option>';
    
    if (type === 'income') {
        options += '<option value="Salary">Salary</option>';
        options += '<option value="Other Income">Other Income</option>';
    } else {
        // Expense categories from budget
        options += allCategories.map(c => `<option value="${c}">${c}</option>`).join('');
        options += '<option value="Other">Other</option>';
    }
    
    categorySelect.innerHTML = options;
}

// ==========================================
// RENDERING FUNCTIONS
// ==========================================

function renderTransactions() {
    const transactionsListEl = document.getElementById('transactionsList');
    if (!transactionsListEl) return;
    
    const searchFilter = document.getElementById('searchFilter');
    const searchTerm = searchFilter ? searchFilter.value.toLowerCase() : '';
    
    // Filter transactions by search term
    const filtered = transactions.filter(t => {
        return t.merchant.toLowerCase().includes(searchTerm) ||
               (t.category && t.category.toLowerCase().includes(searchTerm)) ||
               (t.account && t.account.toLowerCase().includes(searchTerm)) ||
               (t.transfer_to_account && t.transfer_to_account.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
        transactionsListEl.innerHTML = '<li class="list-item-empty"><p>No transactions found for this month.</p></li>';
        return;
    }

    transactionsListEl.innerHTML = filtered.map(t => {
        const [year, month, day] = t.day.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const formattedDate = date.toLocaleDateString(undefined, { timeZone: 'UTC' });
        
        let type, icon, accountInfo;
        
        if (t.type === 'transfer') {
            type = 'transfer';
            icon = 'arrow-right-left';
            accountInfo = `${t.account} → ${t.transfer_to_account}`;
        } else {
            type = t.type === 'income' ? 'income' : 'expense';
            icon = type === 'income' ? 'plus' : 'minus';
            accountInfo = t.account || 'No account';
        }

        return `
            <li class="transaction-item" data-id="${t.id}">
                <div class="transaction-icon ${type}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="transaction-details">
                    <div class="name">${t.merchant}</div>
                    <div class="category">${accountInfo}</div>
                </div>
                <div class="transaction-info">
                    <div class="amount ${type}">${formatCurrency(t.amount)}</div>
                    <div class="date">${formattedDate}</div>
                </div>
                <div class="actions">
                    <button class="action-btn delete-btn" aria-label="Delete transaction">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </li>
        `;
    }).join('');
    
    // Reinitialize Lucide icons
    lucide.createIcons();
    
    // Attach delete button listeners
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', handleDelete);
    });
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