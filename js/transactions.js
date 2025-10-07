// js/transactions.js

// ==========================================
// STATE MANAGEMENT
// ==========================================

let transactions = [];
let allCategories = [];
let currentUser = null;
let currentEditingTransaction = null;

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeTransactionsPage() {
    currentUser = await requireAuth();
    if (!currentUser) return;

    initializeDOMElements();
    
    if (!window.transactionListenersAttached) {
        setupEventListeners();
        setupRealtime(currentUser.id);
        window.transactionListenersAttached = true;
    }
    
    if (MonthNavigation.currentMonth) {
        await loadPageData();
    }
}

function setupRealtime(userId) {
    console.log('🔄 Setting up transaction realtime...');
    
    supabase
        .channel('transactions-page')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`
        }, async (payload) => {
            console.log('✨ Transaction changed:', payload.eventType);
            
            const monthKey = payload.new?.month_key || payload.old?.month_key;
            
            if (monthKey === MonthNavigation.currentMonth) {
                await loadTransactions();
            }
        })
        .subscribe();
}

function initializeDOMElements() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    const dateInput = document.getElementById('day');
    if (dateInput) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
    const expenseBtn = document.querySelector('.toggle-btn[data-type="expense"]');
    if (expenseBtn) {
        expenseBtn.classList.add('active');
    }
}

function setupEventListeners() {
    window.addEventListener('monthChanged', handleMonthChange);
    window.addEventListener('monthNavReady', handleMonthChange);
    
    const typeToggleButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    typeToggleButtons.forEach(btn => {
        btn.addEventListener('click', handleTypeToggle);
    });
    
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleFormSubmit);
    }
    
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) {
        searchFilter.addEventListener('input', renderTransactions);
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.transaction-item')) {
            document.querySelectorAll('.transaction-dropdown.visible').forEach(dropdown => {
                dropdown.classList.remove('visible');
                dropdown.previousElementSibling.classList.remove('active');
            });
        }
    });
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
    
    lucide.createIcons();
    
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

document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && currentUser) {
        console.log('Page visible, refreshing data...');
        await loadPageData();
    }
});

window.addEventListener('focus', async () => {
    if (currentUser) {
        console.log('Window focused, refreshing...');
        await loadPageData();
    }
});

// ==========================================
// EVENT HANDLERS
// ==========================================

function handleTypeToggle(event) {
    const btn = event.currentTarget;
    const typeButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    
    typeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const typeInput = document.getElementById('type');
    if (typeInput) {
        typeInput.value = btn.dataset.type;
    }
    
    const transferToGroup = document.getElementById('transferToAccountGroup');
    const categoryGroup = document.getElementById('categoryGroup');
    const categorySelect = document.getElementById('category');
    const transferToSelect = document.getElementById('transferToAccount');
    
    if (btn.dataset.type === 'transfer') {
        if (transferToGroup) transferToGroup.style.display = 'block';
        if (categoryGroup) categoryGroup.style.display = 'none';
        
        if (categorySelect) categorySelect.removeAttribute('required');
        if (transferToSelect) transferToSelect.setAttribute('required', 'required');
    } else {
        if (transferToGroup) transferToGroup.style.display = 'none';
        if (categoryGroup) categoryGroup.style.display = 'block';
        
        if (categorySelect) categorySelect.setAttribute('required', 'required');
        if (transferToSelect) transferToSelect.removeAttribute('required');
    }
    
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
        transfer_to_account: null,
        tags: []
    };
    
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
        const { error } = await supabase
            .from('transactions')
            .insert([transaction]);
        
        if (error) throw error;
        
        if (type === 'transfer') {
            await updateAccountBalanceForTransfer(account, transaction.transfer_to_account, amount, 'add');
        } else {
            await updateAccountBalance(account, type, amount, 'add');
        }
        
        resetForm();
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
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    const dateInput = document.getElementById('day');
    if (dateInput) {
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
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

// ==========================================
// TRANSACTION MENU ACTIONS
// ==========================================

function openEditModal(transaction) {
    currentEditingTransaction = transaction;
    
    // Create and show edit modal
    const modal = document.getElementById('editTransactionModal');
    if (!modal) return;
    
    // Populate form with transaction data
    document.getElementById('editMerchant').value = transaction.merchant;
    document.getElementById('editAmount').value = transaction.amount;
    document.getElementById('editDay').value = transaction.day;
    document.getElementById('editCategory').value = transaction.category || '';
    document.getElementById('editAccount').value = transaction.account;
    document.getElementById('editRecurring').checked = transaction.recurring;
    
    // Set type
    const typeButtons = document.querySelectorAll('#editTransactionModal .toggle-btn');
    typeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === transaction.type);
    });
    
    if (transaction.type === 'transfer') {
        document.getElementById('editTransferToAccountGroup').style.display = 'block';
        document.getElementById('editCategoryGroup').style.display = 'none';
        document.getElementById('editTransferToAccount').value = transaction.transfer_to_account || '';
    } else {
        document.getElementById('editTransferToAccountGroup').style.display = 'none';
        document.getElementById('editCategoryGroup').style.display = 'block';
    }
    
    modal.classList.add('active');
    lucide.createIcons();
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    if (!currentEditingTransaction) return;
    
    const oldTransaction = {...currentEditingTransaction};
    const type = document.querySelector('#editTransactionModal .toggle-btn.active').dataset.type;
    const account = document.getElementById('editAccount').value;
    const amount = parseFloat(document.getElementById('editAmount').value);
    
    const updates = {
        type: type,
        merchant: document.getElementById('editMerchant').value,
        amount: amount,
        day: document.getElementById('editDay').value,
        category: type === 'transfer' ? 'Transfer' : document.getElementById('editCategory').value,
        account: account,
        recurring: document.getElementById('editRecurring').checked,
        transfer_to_account: null
    };
    
    if (type === 'transfer') {
        updates.transfer_to_account = document.getElementById('editTransferToAccount').value;
    }
    
    try {
        // Reverse old balance changes
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
        
        // Update transaction
        const { error } = await supabase
            .from('transactions')
            .update(updates)
            .eq('id', currentEditingTransaction.id);
        
        if (error) throw error;
        
        // Apply new balance changes
        if (type === 'transfer') {
            await updateAccountBalanceForTransfer(account, updates.transfer_to_account, amount, 'add');
        } else {
            await updateAccountBalance(account, type, amount, 'add');
        }
        
        closeEditModal();
        await loadTransactions();
        
    } catch (err) {
        console.error('Error updating transaction:', err);
        alert('Failed to update transaction.');
    }
}

function closeEditModal() {
    const modal = document.getElementById('editTransactionModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentEditingTransaction = null;
}

function openTagModal(transaction) {
    currentEditingTransaction = transaction;
    
    const modal = document.getElementById('tagTransactionModal');
    if (!modal) return;
    
    const tagContainer = document.getElementById('tagInputContainer');
    tagContainer.innerHTML = '';
    
    // Add existing tags
    const tags = transaction.tags || [];
    tags.forEach(tag => {
        addTagToContainer(tag, tagContainer);
    });
    
    // Add input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-input';
    input.placeholder = 'Type tags separated by commas...';
    tagContainer.appendChild(input);
    
    modal.classList.add('active');
    input.focus();
}

function addTagToContainer(tagText, container) {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.innerHTML = `
        <span>${tagText}</span>
        <button type="button" class="tag-remove">×</button>
    `;
    
    const removeBtn = tagItem.querySelector('.tag-remove');
    removeBtn.addEventListener('click', () => tagItem.remove());
    
    const input = container.querySelector('.tag-input');
    if (input) {
        container.insertBefore(tagItem, input);
    } else {
        container.appendChild(tagItem);
    }
}

async function handleTagSubmit() {
    if (!currentEditingTransaction) return;
    
    const tagContainer = document.getElementById('tagInputContainer');
    const tagItems = tagContainer.querySelectorAll('.tag-item span');
    const existingTags = Array.from(tagItems).map(span => span.textContent);
    
    // Get new tags from input
    const input = tagContainer.querySelector('.tag-input');
    const newTagsText = input ? input.value.trim() : '';
    const newTags = newTagsText ? newTagsText.split(',').map(t => t.trim()).filter(t => t) : [];
    
    // Combine existing and new tags
    const tags = [...existingTags, ...newTags];
    
    try {
        const { error } = await supabase
            .from('transactions')
            .update({ tags })
            .eq('id', currentEditingTransaction.id);
        
        if (error) throw error;
        
        closeTagModal();
        await loadTransactions();
        
    } catch (err) {
        console.error('Error updating tags:', err);
        alert('Failed to update tags.');
    }
}

function closeTagModal() {
    const modal = document.getElementById('tagTransactionModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentEditingTransaction = null;
}

function openSplitModal(transaction) {
    currentEditingTransaction = transaction;
    
    const modal = document.getElementById('splitTransactionModal');
    if (!modal) return;
    
    document.getElementById('splitOriginalAmount').textContent = formatCurrency(transaction.amount);
    
    const splitsContainer = document.getElementById('splitsContainer');
    splitsContainer.innerHTML = '';
    
    // Add two default splits
    addSplitItem(transaction.amount / 2);
    addSplitItem(transaction.amount / 2);
    
    updateSplitSummary();
    modal.classList.add('active');
    lucide.createIcons();
}

function addSplitItem(amount = 0) {
    const splitsContainer = document.getElementById('splitsContainer');
    
    const splitItem = document.createElement('div');
    splitItem.className = 'split-item';
    splitItem.innerHTML = `
        <select class="split-category" required>
            <option value="">Category</option>
            ${allCategories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <input type="number" class="split-amount" placeholder="0.00" step="0.01" value="${amount}" required>
        <button type="button" class="btn-remove-split">
            <i data-lucide="x"></i>
        </button>
    `;
    
    const removeBtn = splitItem.querySelector('.btn-remove-split');
    removeBtn.addEventListener('click', () => {
        if (splitsContainer.children.length > 2) {
            splitItem.remove();
            updateSplitSummary();
            lucide.createIcons();
        } else {
            alert('You must have at least 2 splits.');
        }
    });
    
    const amountInput = splitItem.querySelector('.split-amount');
    amountInput.addEventListener('input', updateSplitSummary);
    
    splitsContainer.appendChild(splitItem);
    lucide.createIcons();
}

function updateSplitSummary() {
    if (!currentEditingTransaction) return;
    
    const originalAmount = currentEditingTransaction.amount;
    const splits = document.querySelectorAll('.split-item');
    let totalSplit = 0;
    
    splits.forEach(split => {
        const amount = parseFloat(split.querySelector('.split-amount').value) || 0;
        totalSplit += amount;
    });
    
    const summaryEl = document.getElementById('splitSummary');
    const differenceEl = document.getElementById('splitDifference');
    
    summaryEl.textContent = formatCurrency(totalSplit);
    differenceEl.textContent = formatCurrency(originalAmount - totalSplit);
    
    const summaryContainer = summaryEl.closest('.split-summary');
    // Use a tolerance of 0.001 to account for rounding
    if (Math.abs(originalAmount - totalSplit) > 0.001) {
        summaryContainer.classList.add('error');
    } else {
        summaryContainer.classList.remove('error');
    }
}

async function handleSplitSubmit(event) {
    event.preventDefault();
    
    if (!currentEditingTransaction) return;
    
    const originalAmount = currentEditingTransaction.amount;
    const splits = document.querySelectorAll('.split-item');
    let totalSplit = 0;
    
    const splitData = [];
    splits.forEach(split => {
        const category = split.querySelector('.split-category').value;
        const amount = parseFloat(split.querySelector('.split-amount').value) || 0;
        totalSplit += amount;
        splitData.push({ category, amount });
    });
    
    // Use a tolerance of 0.001 to account for rounding
    if (Math.abs(originalAmount - totalSplit) > 0.001) {
        alert('Split amounts must equal the original transaction amount.');
        return;
    }
    
    try {
        // Delete original transaction (but don't reverse balance - we're replacing it)
        const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', currentEditingTransaction.id);
        
        if (deleteError) throw deleteError;
        
        // Reverse original balance change
        await updateAccountBalance(
            currentEditingTransaction.account,
            currentEditingTransaction.type,
            currentEditingTransaction.amount,
            'reverse'
        );
        
        // Create new transactions for each split
        const newTransactions = splitData.map(split => ({
            user_id: currentUser.id,
            month_key: currentEditingTransaction.month_key,
            type: currentEditingTransaction.type,
            merchant: currentEditingTransaction.merchant,
            amount: split.amount,
            day: currentEditingTransaction.day,
            category: split.category,
            account: currentEditingTransaction.account,
            recurring: currentEditingTransaction.recurring,
            tags: [...(currentEditingTransaction.tags || []), 'Split Transaction']
        }));
        
        const { error: insertError } = await supabase
            .from('transactions')
            .insert(newTransactions);
        
        if (insertError) throw insertError;
        
        // Apply balance changes for each split
        for (const split of splitData) {
            await updateAccountBalance(
                currentEditingTransaction.account,
                currentEditingTransaction.type,
                split.amount,
                'add'
            );
        }
        
        closeSplitModal();
        await loadTransactions();
        
    } catch (err) {
        console.error('Error splitting transaction:', err);
        alert('Failed to split transaction.');
    }
}

function closeSplitModal() {
    const modal = document.getElementById('splitTransactionModal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentEditingTransaction = null;
}

async function handleTransactionDelete(transactionId) {
    const transaction = transactions.find(t => t.id === parseInt(transactionId));
    if (!transaction) return;
    
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionId);
        
        if (error) throw error;
        
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
        alert('Failed to delete transaction.');
    }
}

// ==========================================
// ACCOUNT BALANCE UPDATES
// ==========================================

async function updateAccountBalance(accountName, transactionType, amount, operation) {
    try {
        if (!accountName) {
            console.warn('No account name provided, skipping balance update');
            return;
        }
        
        const { data: account, error: fetchError } = await supabase
            .from('accounts')
            .select('balance, type')
            .eq('name', accountName)
            .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (!account) {
            console.warn(`Account "${accountName}" not found, skipping balance update`);
            return;
        }

        const currentBalance = parseFloat(account.balance) || 0;
        const transactionAmount = parseFloat(amount) || 0;
        const isDebtAccount = account.type === 'debt';
        let newBalance;

        if (operation === 'add') {
            if (isDebtAccount) {
                if (transactionType === 'income') {
                    newBalance = currentBalance - transactionAmount;
                } else {
                    newBalance = currentBalance + transactionAmount;
                }
            } else {
                if (transactionType === 'income') {
                    newBalance = currentBalance + transactionAmount;
                } else {
                    newBalance = currentBalance - transactionAmount;
                }
            }
        } else {
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
        
        const { data: accounts, error: fetchError } = await supabase
            .from('accounts')
            .select('name, balance, type')
            .in('name', [fromAccount, toAccount]);

        if (fetchError) throw fetchError;
        
        const fromAcc = accounts.find(a => a.name === fromAccount);
        const toAcc = accounts.find(a => a.name === toAccount);
        
        if (!fromAcc || !toAcc) {
            console.warn(`Transfer account(s) not found. Skipping balance update.`);
            return;
        }
        
        let newFromBalance, newToBalance;
        const fromBalance = parseFloat(fromAcc.balance) || 0;
        const toBalance = parseFloat(toAcc.balance) || 0;
        
        if (operation === 'add') {
            newFromBalance = fromBalance - transactionAmount;
            newToBalance = toBalance + transactionAmount;
        } else {
            newFromBalance = fromBalance + transactionAmount;
            newToBalance = toBalance - transactionAmount;
        }
        
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
        
        if (result1.error) throw result1.error;
        if (result2.error) throw result2.error;
        
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
        
        const accountSelects = [
            'account',
            'transferToAccount',
            'editAccount',
            'editTransferToAccount'
        ];
        
        if (!data || data.length === 0) {
            accountSelects.forEach(id => {
                const select = document.getElementById(id);
                if (select) select.innerHTML = '<option value="">No accounts available</option>';
            });
            return;
        }
        
        const options = '<option value="">Select Account</option>' +
            data.map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('');
        
        accountSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) select.innerHTML = options;
        });
        
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
    
    const filtered = transactions.filter(t => {
        return t.merchant.toLowerCase().includes(searchTerm) ||
               (t.category && t.category.toLowerCase().includes(searchTerm)) ||
               (t.account && t.account.toLowerCase().includes(searchTerm)) ||
               (t.transfer_to_account && t.transfer_to_account.toLowerCase().includes(searchTerm)) ||
               (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
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
        
        const tagsHtml = t.tags && t.tags.length > 0 ? `
            <div class="transaction-tags">
                ${t.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        ` : '';

        return `
            <li class="transaction-item" data-id="${t.id}">
                <div class="transaction-icon ${type}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="transaction-details">
                    <div class="name">${t.merchant}</div>
                    <div class="category">${accountInfo}</div>
                    ${tagsHtml}
                </div>
                <div class="transaction-info">
                    <div class="amount ${type}">${formatCurrency(t.amount)}</div>
                    <div class="date">${formattedDate}</div>
                </div>
                <button class="transaction-menu-btn">
                    <i data-lucide="more-vertical"></i>
                </button>
                <div class="transaction-dropdown">
                    <button class="transaction-dropdown-item" data-action="edit">
                        <i data-lucide="edit-2"></i>
                        <span>Edit</span>
                    </button>
                    <button class="transaction-dropdown-item" data-action="tag">
                        <i data-lucide="tag"></i>
                        <span>Tag</span>
                    </button>
                    <button class="transaction-dropdown-item" data-action="split">
                        <i data-lucide="split"></i>
                        <span>Split</span>
                    </button>
                    <button class="transaction-dropdown-item danger" data-action="delete">
                        <i data-lucide="trash-2"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </li>
        `;
    }).join('');
    
    lucide.createIcons();
    
    // Attach menu listeners
    const menuButtons = document.querySelectorAll('.transaction-menu-btn');
    menuButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.nextElementSibling;
            
            // Close other dropdowns
            document.querySelectorAll('.transaction-dropdown.visible').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('visible');
                    d.previousElementSibling.classList.remove('active');
                }
            });
            
            dropdown.classList.toggle('visible');
            btn.classList.toggle('active');
        });
    });
    
    // Attach dropdown action listeners
    const dropdownItems = document.querySelectorAll('.transaction-dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            const transactionItem = item.closest('.transaction-item');
            const transactionId = transactionItem.dataset.id;
            const transaction = transactions.find(t => t.id === parseInt(transactionId));
            
            // Close dropdown
            const dropdown = item.closest('.transaction-dropdown');
            dropdown.classList.remove('visible');
            dropdown.previousElementSibling.classList.remove('active');
            
            if (!transaction) return;
            
            switch(action) {
                case 'edit':
                    openEditModal(transaction);
                    break;
                case 'tag':
                    openTagModal(transaction);
                    break;
                case 'split':
                    openSplitModal(transaction);
                    break;
                case 'delete':
                    handleTransactionDelete(transactionId);
                    break;
            }
        });
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