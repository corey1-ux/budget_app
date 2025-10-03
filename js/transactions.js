// js/transactions.js

// This is the main function that will set up the entire page.
async function setupTransactionsPage() {
    const user = await requireAuth();
    if (!user) return;

    // --- DOM ELEMENTS (Defined only when this function runs) ---
    const transactionForm = document.getElementById('transactionForm');
    const transactionsListEl = document.getElementById('transactionsList');
    const typeToggleButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    const searchFilter = document.getElementById('searchFilter');
    const dateInput = document.getElementById('day');

    if (!transactionForm || !transactionsListEl || !searchFilter || !dateInput) {
        console.error("Aborting: Essential form elements are missing.");
        return;
    }

    let transactions = [];
    let allCategories = [];

    // --- DATA LOADING & SETUP ---
    const loadPageData = async () => {
        if (!MonthNavigation.currentMonth) return;
        
        const today = new Date();
        dateInput.value = today.toISOString().slice(0, 10);

        await loadCategories();
        await populateAccountsDropdowns();
        await loadTransactions();
    };

    // --- EVENT LISTENERS (Attached once) ---
    if (!window.transactionListenersAttached) {
        window.addEventListener('monthChanged', loadPageData);

        typeToggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                typeToggleButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('type').value = btn.dataset.type;
                populateCategoryDropdown();
            });
        });

        transactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const transaction = {
                user_id: user.id,
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
                const { error } = await supabase.from('transactions').insert([transaction]);
                if (error) throw error;
                
                transactionForm.reset();
                dateInput.value = new Date().toISOString().slice(0, 10);
                document.querySelector('.toggle-btn[data-type="expense"]').classList.add('active');
                document.querySelector('.toggle-btn[data-type="income"]').classList.remove('active');
                
                await loadTransactions();
            } catch (err) {
                console.error('Error adding transaction:', err);
                alert('Failed to add transaction.');
            }
        });

        searchFilter.addEventListener('input', renderTransactions);
        
        window.transactionListenersAttached = true;
    }

    // Initial data load for the page
    await loadPageData();
    
    // --- FUNCTION DEFINITIONS ---
    async function loadTransactions() {
        if (!MonthNavigation.currentMonth) return;
        try {
            const { data, error } = await supabase.from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .eq('month_key', MonthNavigation.currentMonth)
                .order('day', { ascending: false });
            if (error) throw error;
            transactions = data || [];
            renderTransactions();
        } catch (err) {
            console.error('Error loading transactions:', err);
        }
    }
    
    async function loadCategories() {
        try {
            const budgetData = await BudgetData.getMonthData(MonthNavigation.currentMonth);
            const expenseCategories = budgetData.expenses ? budgetData.expenses.map(exp => exp.name).filter(name => name && name.trim()) : [];
            const defaultCategories = ['Food', 'Transport', 'Entertainment', 'Bills', 'Shopping', 'Other'];
            allCategories = [...new Set([...expenseCategories, ...defaultCategories])];
            populateCategoryDropdown();
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }
    
    function populateCategoryDropdown() {
        const categorySelect = document.getElementById('category');
        const currentType = document.getElementById('type').value;
        categorySelect.innerHTML = '<option value="">Select a category</option>';
        
        if (currentType === 'expense') {
            allCategories.forEach(category => {
                categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
            });
        } else {
            const incomeCategories = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];
            incomeCategories.forEach(category => {
                categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
            });
        }
    }
    
    async function populateAccountsDropdowns() {
        try {
            const { data: accounts, error } = await supabase.from('accounts').select('name').eq('user_id', user.id);
            if (error) throw error;
            const accountSelect = document.getElementById('account');
            accountSelect.innerHTML = '<option value="">Select an account</option>';
            if (accounts && accounts.length > 0) {
                accounts.forEach(account => {
                    accountSelect.innerHTML += `<option value="${account.name}">${account.name}</option>`;
                });
            }
        } catch (err) {
            console.error('Error loading accounts:', err);
        }
    }
    
    function renderTransactions() {
        const searchTerm = searchFilter.value.toLowerCase();
        const filteredTransactions = transactions.filter(t => t.merchant.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm));
        
        if (filteredTransactions.length === 0) {
            transactionsListEl.innerHTML = '<li class="list-item-empty"><p>No transactions found</p></li>';
            return;
        }
        
        transactionsListEl.innerHTML = filteredTransactions.map(t => {
            // Correctly handle UTC date for display
            const [year, month, day] = t.day.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            const formattedDate = date.toLocaleDateString(undefined, { timeZone: 'UTC' });

            return `
                <li class="transaction-item" data-id="${t.id}">
                    <div class="transaction-icon ${t.type}">
                        <i data-lucide="${t.type === 'income' ? 'arrow-up-circle' : 'arrow-down-circle'}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="name">${t.merchant}</div>
                        <div class="category">${t.category}${t.recurring ? ' • Recurring' : ''}</div>
                    </div>
                    <div class="transaction-info">
                        <div class="amount ${t.type}">${formatCurrency(t.amount)}</div>
                        <div class="date">${formattedDate}</div>
                    </div>
                    <div class="actions">
                        <button class="action-btn delete-btn" data-id="${t.id}" title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </li>`;
        }).join('');
        
        lucide.createIcons();
        
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    }
    
    async function handleDelete(e) {
        const id = e.currentTarget.dataset.id;
        if (!confirm('Delete this transaction?')) return;
        
        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
            await loadTransactions();
        } catch (err) {
            console.error('Error deleting transaction:', err);
        }
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    }
}

// --- MAIN EVENT LISTENERS FOR PAGE LIFECYCLE ---
window.addEventListener('monthNavReady', setupTransactionsPage);
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.transactionListenersAttached = false; // Reset flag
        setupTransactionsPage();
    }
});