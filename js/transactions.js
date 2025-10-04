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
    
    // Update category dropdown
    populateCategoryDropdown();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!currentUser) {
        alert('You must be logged in to add a transaction.');
        return;
    }
    
    // Gather form data
    const transaction = {
        user_id: currentUser.id,
        month_key: MonthNavigation.currentMonth,
        type: document.getElementById('type').value,
        merchant: document.getElementById('merchant').value,
        amount: parseFloat(document.getElementById('amount').value),
        day: document.getElementById('day').value,
        category: document.getElementById('category').value,
        account: document.getElementById('account').value,
        recurring: document.getElementById('recurring').checked,
    };
    
    try {
        const { error } = await supabase
            .from('transactions')
            .insert([transaction]);
        
        if (error) throw error;
        
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
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        await loadTransactions();
        
    } catch (err) {
        console.error("Error deleting transaction:", err);
        alert('Failed to delete transaction. Check console for details.');
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
            .select('name')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        const accountSelect = document.getElementById('account');
        if (!accountSelect) return;
        
        accountSelect.innerHTML = '<option value="">Select Account</option>' +
            (data || []).map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('');
        
    } catch (err) {
        console.error("Error fetching accounts:", err);
        const accountSelect = document.getElementById('account');
        if (accountSelect) {
            accountSelect.innerHTML = '<option value="">Select Account</option>';
        }
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
               (t.account && t.account.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
        transactionsListEl.innerHTML = '<li class="list-item-empty"><p>No transactions found for this month.</p></li>';
        return;
    }

    transactionsListEl.innerHTML = filtered.map(t => {
        const [year, month, day] = t.day.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const formattedDate = date.toLocaleDateString(undefined, { timeZone: 'UTC' });
        const type = t.type === 'income' ? 'income' : 'expense';
        const icon = type === 'income' ? 'plus' : 'minus';

        return `
            <li class="transaction-item" data-id="${t.id}">
                <div class="transaction-icon ${type}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="transaction-details">
                    <div class="name">${t.merchant}</div>
                    <div class="category">${t.account || 'No account'}</div>
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