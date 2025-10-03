// js/transactions.js

async function initializeTransactionsPage() {
    const user = await requireAuth();
    if (!user) return;

    // --- DOM ELEMENTS (Defined INSIDE the function) ---
    const transactionForm = document.getElementById('transactionForm');
    const transactionsListEl = document.getElementById('transactionsList');
    const typeToggleButtons = document.querySelectorAll('.type-toggle .toggle-btn');
    const searchFilter = document.getElementById('searchFilter');
    const dateInput = document.getElementById('day');

    if (!transactionForm || !transactionsListEl || !searchFilter || !dateInput) {
        console.error("Essential form elements are missing from the page.");
        return;
    }

    let transactions = [];
    let allCategories = [];

    // --- DATA LOADING & SETUP ---
    const loadPageData = async () => {
        if (!MonthNavigation.currentMonth) {
            console.log("Waiting for month navigation...");
            return;
        }
        
        lucide.createIcons();
        
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;

        await loadCategories();
        await populateAccountsDropdowns();
        await loadTransactions();
    };

    // --- EVENT LISTENERS (Attached once per page load) ---
    if (!window.transactionListenersAttached) {
        window.addEventListener('monthChanged', loadPageData);
        window.addEventListener('monthNavReady', loadPageData);

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
                dateInput.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                document.querySelector('.toggle-btn[data-type="expense"]').classList.add('active');
                
                await loadTransactions();
            } catch (err) {
                console.error('Error adding transaction:', err);
                alert('Failed to add transaction. Check console for details.');
            }
        });

        searchFilter.addEventListener('input', renderTransactions);
        
        window.transactionListenersAttached = true;
    }
    
    // --- FUNCTION DEFINITIONS ---
    async function loadTransactions() {
        try {
            const { data, error } = await supabase.from('transactions').select('*')
                .eq('month_key', MonthNavigation.currentMonth).order('day', { ascending: false });
            if (error) throw error;
            transactions = data || [];
            renderTransactions();
        } catch (err) { console.error('Error loading transactions:', err); }
    }

    async function loadCategories() {
        const budgetData = await BudgetData.getMonthData(MonthNavigation.currentMonth);
        allCategories = budgetData.expenses.map(exp => exp.name) || [];
        populateCategoryDropdown();
    }

    function populateCategoryDropdown() {
        const type = document.getElementById('type').value;
        const categorySelect = document.getElementById('category');
        let options = '<option value="">Select Category</option>';
        if (type === 'income') {
            options += '<option value="Salary">Salary</option><option value="Other Income">Other Income</option>';
        } else {
            options += allCategories.map(c => `<option value="${c}">${c}</option>`).join('');
            options += '<option value="Other">Other</option>';
        }
        categorySelect.innerHTML = options;
    }

    async function populateAccountsDropdowns() {
        try {
            const { data, error } = await supabase.from('accounts').select('name');
            if (error) throw error;
            const accountSelect = document.getElementById('account');
            accountSelect.innerHTML = '<option value="">Select Account</option>' +
                data.map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('');
        } catch (err) { console.error("Error fetching accounts:", err); }
    }
    
    function renderTransactions() {
        const searchTerm = searchFilter.value.toLowerCase();
        const filtered = transactions.filter(t => t.merchant.toLowerCase().includes(searchTerm));

        if (filtered.length === 0) {
            transactionsListEl.innerHTML = '<li class="list-item-empty"><p>No transactions found for this month.</p></li>';
            return;
        }

        transactionsListEl.innerHTML = filtered.map(t => {
            const [year, month, day] = t.day.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            const formattedDate = date.toLocaleDateString(undefined, { timeZone: 'UTC' });

            return `
                <li class="transaction-item" data-id="${t.id}">
                    <div class="transaction-icon ${t.type}">
                        <i data-lucide="${t.type === 'income' ? 'plus' : 'minus'}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="name">${t.merchant}</div>
                        <div class="category">${t.account}</div>
                    </div>
                    <div class="transaction-info">
                        <div class="amount ${t.type}">${formatCurrency(t.amount)}</div>
                        <div class="date">${formattedDate}</div>
                    </div>
                    <div class="actions">
                        <button class="action-btn edit-btn"><i data-lucide="edit-2"></i></button>
                        <button class="action-btn delete-btn"><i data-lucide="trash-2"></i></button>
                    </div>
                </li>
            `;
        }).join('');
        lucide.createIcons();
        
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
    }

    async function handleDelete(e) {
        const id = e.currentTarget.closest('.transaction-item').dataset.id;
        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                const { error } = await supabase.from('transactions').delete().eq('id', id);
                if (error) throw error;
                loadTransactions();
            } catch (err) { console.error("Error deleting:", err); }
        }
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    }
}


// --- MAIN EVENT LISTENERS FOR PAGE LIFECYCLE ---
window.addEventListener('DOMContentLoaded', initializeTransactionsPage);
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        window.transactionListenersAttached = false;
        initializeTransactionsPage();
    }
});