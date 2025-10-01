const MonthNavigation = {
    currentMonth: null,
    
    init() {
        const savedMonth = this.getSavedMonth();
        const today = new Date();
        this.currentMonth = savedMonth || this.formatMonthKey(today);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    getSavedMonth() {
        return localStorage.getItem('currentMonth');
    },
    
    saveCurrentMonth() {
        localStorage.setItem('currentMonth', this.currentMonth);
    },
    
    formatMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    },
    
    getRealCurrentMonth() {
        return this.formatMonthKey(new Date());
    },
    
    isViewingCurrentMonth() {
        return this.currentMonth === this.getRealCurrentMonth();
    },
    
    previousMonth() {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        this.currentMonth = this.formatMonthKey(date);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    nextMonth() {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + 1);
        this.currentMonth = this.formatMonthKey(date);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    goToCurrent() {
        this.currentMonth = this.getRealCurrentMonth();
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    getDisplayName(monthKey) {
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        return `${monthName} ${year}`;
    }
};

const TransactionData = {
    getAllData() {
        const data = localStorage.getItem('transactionData');
        return data ? JSON.parse(data) : {};
    },
    
    getMonthTransactions(monthKey) {
        const allData = this.getAllData();
        return allData[monthKey] || [];
    },
    
    saveMonthTransactions(monthKey, transactions) {
        const allData = this.getAllData();
        allData[monthKey] = transactions;
        localStorage.setItem('transactionData', JSON.stringify(allData));
    },
    
    getAllPeople() {
        const allData = this.getAllData();
        const people = new Set();
        Object.values(allData).forEach(monthTransactions => {
            monthTransactions.forEach(transaction => {
                if (transaction.person) {
                    people.add(transaction.person);
                }
                if (transaction.splits) {
                    transaction.splits.forEach(split => {
                        if (split.person) {
                            people.add(split.person);
                        }
                    });
                }
            });
        });
        return Array.from(people).sort();
    }
};

// Page elements
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const goToCurrentMonthBtn = document.getElementById('goToCurrentMonth');
const monthDisplayEl = document.getElementById('currentMonthDisplay');
const transactionForm = document.getElementById('transactionForm');
const addMultipleBtn = document.getElementById('addMultipleBtn');
const transactionsListEl = document.getElementById('transactionsList');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const netAmountEl = document.getElementById('netAmount');
const splitTransactionCheckbox = document.getElementById('splitTransaction');
const splitSection = document.getElementById('splitSection');
const addSplitBtn = document.getElementById('addSplitBtn');
const splitsList = document.getElementById('splitsList');
const amountInput = document.getElementById('amount');
const splitOriginalAmount = document.getElementById('splitOriginalAmount');
const splitValidation = document.getElementById('splitValidation');
const personInput = document.getElementById('person');
const personList = document.getElementById('personList');
const submitBtn = transactionForm.querySelector('.btn-primary');
const searchFilter = document.getElementById('searchFilter');
const tagFilter = document.getElementById('tagFilter');
const accountFilter = document.getElementById('accountFilter');
const personFilter = document.getElementById('personFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const filterResultsText = document.getElementById('filterResultsText');
const accountSelect = document.getElementById('account');
const accountFilterSelect = document.getElementById('accountFilter');

let transactions = [];
let splits = [];
let filteredTransactions = [];

// --- NEW FUNCTION TO POPULATE ACCOUNTS ---
async function populateAccountsDropdowns() {
    try {
        const { data: accounts, error } = await supabase
            .from('accounts')
            .select('name')
            .order('name', { ascending: true });
        
        if (error) throw error;

        // Clear existing options, but keep the placeholder
        accountSelect.innerHTML = '<option value="">Select account</option>';
        accountFilterSelect.innerHTML = '<option value="">All Accounts</option>';

        accounts.forEach(account => {
            const option = `<option value="${account.name}">${account.name}</option>`;
            accountSelect.innerHTML += option;
            accountFilterSelect.innerHTML += option;
        });

    } catch (err) {
        console.error("Error fetching accounts for dropdown:", err);
    }
}


// Update person autocomplete
function updatePersonList() {
    const people = TransactionData.getAllPeople();
    personList.innerHTML = people.map(person => `<option value="${person}">`).join('');
    
    // Update person filter dropdown
    personFilter.innerHTML = '<option value="">All People</option>' + 
        people.map(person => `<option value="${person}">${person}</option>`).join('');
}

// Update month display
function updateMonthDisplay() {
    monthDisplayEl.textContent = MonthNavigation.getDisplayName(MonthNavigation.currentMonth);
    
    if (MonthNavigation.isViewingCurrentMonth()) {
        goToCurrentMonthBtn.classList.add('hidden');
    } else {
        goToCurrentMonthBtn.classList.remove('hidden');
    }
}

// Toggle split section
splitTransactionCheckbox.addEventListener('change', function() {
    if (this.checked) {
        splitSection.style.display = 'block';
        if (splits.length === 0) {
            addSplit();
            addSplit();
        }
    } else {
        splitSection.style.display = 'none';
        splits = [];
        splitsList.innerHTML = '';
    }
});

// Update split original amount
amountInput.addEventListener('input', function() {
    splitOriginalAmount.textContent = this.value || '0.00';
    validateSplits();
});

// Add split
function addSplit() {
    const splitId = Date.now() + Math.random();
    const splitItem = document.createElement('div');
    splitItem.className = 'split-item';
    splitItem.dataset.splitId = splitId;
    
    splitItem.innerHTML = `
        <input type="text" placeholder="Category" class="split-category" required>
        <input type="number" placeholder="Amount" step="0.01" class="split-amount" required>
        <input type="text" placeholder="Person (optional)" class="split-person" list="personList">
        <button type="button" class="btn-remove-split" onclick="removeSplit(${splitId})">×</button>
    `;
    
    splitsList.appendChild(splitItem);
    
    const amountField = splitItem.querySelector('.split-amount');
    amountField.addEventListener('input', validateSplits);
}

addSplitBtn.addEventListener('click', addSplit);

// Remove split
function removeSplit(splitId) {
    const splitItem = document.querySelector(`[data-split-id="${splitId}"]`);
    if (splitItem) {
        splitItem.remove();
        validateSplits();
    }
}

// Validate splits
function validateSplits() {
    if (!splitTransactionCheckbox.checked) return true;
    
    const totalAmount = parseFloat(amountInput.value) || 0;
    const splitItems = document.querySelectorAll('.split-item');
    let splitTotal = 0;
    
    splitItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.split-amount').value) || 0;
        splitTotal += amount;
    });
    
    const difference = Math.abs(totalAmount - splitTotal);
    
    if (difference < 0.01) {
        splitValidation.textContent = '✓ Splits add up correctly';
        splitValidation.className = 'split-validation valid';
        submitBtn.disabled = false;
        return true;
    } else {
        const remaining = totalAmount - splitTotal;
        splitValidation.textContent = `⚠ Remaining: $${remaining.toFixed(2)}`;
        splitValidation.className = 'split-validation invalid';
        submitBtn.disabled = true;
        return false;
    }
}

// Load transactions for current month
function loadTransactions() {
    transactions = TransactionData.getMonthTransactions(MonthNavigation.currentMonth);
    applyFilters();
    updateSummary();
    updatePersonList();
}

// Apply filters
function applyFilters() {
    const searchTerm = searchFilter.value.toLowerCase();
    const selectedTag = tagFilter.value;
    const selectedAccount = accountFilter.value;
    const selectedPerson = personFilter.value;
    
    filteredTransactions = transactions.filter(transaction => {
        // Search filter
        const matchesSearch = !searchTerm || 
            transaction.merchant.toLowerCase().includes(searchTerm);
        
        // Tag filter
        const matchesTag = !selectedTag || transaction.tag === selectedTag;
        
        // Account filter
        const matchesAccount = !selectedAccount || transaction.account === selectedAccount;
        
        // Person filter (check both main person and split persons)
        let matchesPerson = !selectedPerson || transaction.person === selectedPerson;
        if (!matchesPerson && transaction.splits) {
            matchesPerson = transaction.splits.some(split => split.person === selectedPerson);
        }
        
        return matchesSearch && matchesTag && matchesAccount && matchesPerson;
    });
    
    renderTransactions();
    updateFilterResults();
}

// Update filter results text
function updateFilterResults() {
    const total = transactions.length;
    const filtered = filteredTransactions.length;
    
    if (filtered === total) {
        filterResultsText.textContent = `Showing all ${total} transaction${total !== 1 ? 's' : ''}`;
    } else {
        filterResultsText.textContent = `Showing ${filtered} of ${total} transaction${total !== 1 ? 's' : ''}`;
    }
}

// Clear all filters
clearFiltersBtn.addEventListener('click', function() {
    searchFilter.value = '';
    tagFilter.value = '';
    accountFilter.value = '';
    personFilter.value = '';
    applyFilters();
});

// Add filter event listeners
searchFilter.addEventListener('input', applyFilters);
tagFilter.addEventListener('change', applyFilters);
accountFilter.addEventListener('change', applyFilters);
personFilter.addEventListener('change', applyFilters);

// Render transactions list
function renderTransactions() {
    if (filteredTransactions.length === 0) {
        if (transactions.length === 0) {
            transactionsListEl.innerHTML = '<p class="empty-state">No transactions yet. Add your first transaction above!</p>';
        } else {
            transactionsListEl.innerHTML = '<p class="empty-state">No transactions match your filters.</p>';
        }
        return;
    }
    
    const sortedTransactions = [...filteredTransactions].sort((a, b) => a.day - b.day);
    
    transactionsListEl.innerHTML = sortedTransactions.map((transaction, index) => {
        const splitIndicator = transaction.splits ? 
            `<span class="transaction-split-indicator">📊 Split (${transaction.splits.length})</span>` : '';
        
        const personBadge = transaction.person ? 
            `<span class="transaction-person">👤 ${transaction.person}</span>` : '';
        
        const splitDetails = transaction.splits ? `
            <div class="split-details-list">
                ${transaction.splits.map(split => `
                    <div class="split-details-item">
                        <span>${split.category}${split.person ? ` (${split.person})` : ''}</span>
                        <span>$${split.amount.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
        ` : '';
        
        return `
            <div class="transaction-item ${transaction.tag === 'income' ? 'income' : 'expense'} ${transaction.splits ? 'split' : ''}">
                <div class="transaction-day">
                    <span class="day-number">${transaction.day}</span>
                    <span class="day-label">Day</span>
                </div>
                
                <div class="transaction-details">
                    <div class="transaction-merchant">${transaction.merchant}</div>
                    <div class="transaction-meta">
                        <span class="transaction-tag">${transaction.tag}</span>
                        <span>${transaction.account}</span>
                        ${personBadge}
                        ${transaction.recurring ? '<span class="transaction-recurring">🔄 Recurring</span>' : ''}
                        ${splitIndicator}
                    </div>
                    ${splitDetails}
                </div>
                
                <div class="transaction-amount ${transaction.tag === 'income' ? 'income' : 'expense'}">
                    $${transaction.amount.toFixed(2)}
                </div>
                
                <button class="btn-delete" onclick="deleteTransaction(${index})" title="Delete transaction">×</button>
            </div>
        `;
    }).join('');
}

// Update summary totals
function updateSummary() {
    let totalIncome = 0;
    let totalExpenses = 0;
    
    transactions.forEach(transaction => {
        if (transaction.tag === 'income') {
            totalIncome += transaction.amount;
        } else {
            totalExpenses += transaction.amount;
        }
    });
    
    const net = totalIncome - totalExpenses;
    
    totalIncomeEl.textContent = `$${totalIncome.toFixed(2)}`;
    totalExpensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
    netAmountEl.textContent = `$${net.toFixed(2)}`;
}

// Add transaction
transactionForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (splitTransactionCheckbox.checked && !validateSplits()) {
        return;
    }
    
    const transaction = {
        merchant: document.getElementById('merchant').value,
        amount: parseFloat(document.getElementById('amount').value),
        account: document.getElementById('account').value,
        day: parseInt(document.getElementById('day').value),
        tag: document.getElementById('tag').value,
        person: document.getElementById('person').value || null,
        recurring: document.getElementById('recurring').checked,
        id: Date.now()
    };
    
    if (splitTransactionCheckbox.checked) {
        const splitItems = document.querySelectorAll('.split-item');
        transaction.splits = Array.from(splitItems).map(item => ({
            category: item.querySelector('.split-category').value,
            amount: parseFloat(item.querySelector('.split-amount').value),
            person: item.querySelector('.split-person').value || null
        }));
    }
    
    transactions.push(transaction);
    TransactionData.saveMonthTransactions(MonthNavigation.currentMonth, transactions);
    
    applyFilters();
    updateSummary();
    updatePersonList();
    
    // Show "Add Another" button
    addMultipleBtn.style.display = 'block';
    
    // Reset form
    transactionForm.reset();
    splitSection.style.display = 'none';
    splits = [];
    splitsList.innerHTML = '';
    splitValidation.textContent = '';
    submitBtn.disabled = false;
    
    // Focus on merchant field for quick entry
    document.getElementById('merchant').focus();
});

// Add multiple transactions
addMultipleBtn.addEventListener('click', function() {
    document.getElementById('merchant').focus();
});

// Delete transaction
function deleteTransaction(index) {
    if (confirm('Delete this transaction?')) {
        // Find the actual transaction in the full list
        const transactionToDelete = filteredTransactions[index];
        const actualIndex = transactions.findIndex(t => t.id === transactionToDelete.id);
        
        transactions.splice(actualIndex, 1);
        TransactionData.saveMonthTransactions(MonthNavigation.currentMonth, transactions);
        applyFilters();
        updateSummary();
        
        if (transactions.length === 0) {
            addMultipleBtn.style.display = 'none';
        }
    }
}

// Month navigation
prevMonthBtn.addEventListener('click', () => {
    MonthNavigation.previousMonth();
    updateMonthDisplay();
    loadTransactions();
    addMultipleBtn.style.display = 'none';
});

nextMonthBtn.addEventListener('click', () => {
    MonthNavigation.nextMonth();
    updateMonthDisplay();
    loadTransactions();
    addMultipleBtn.style.display = 'none';
});

goToCurrentMonthBtn.addEventListener('click', () => {
    MonthNavigation.goToCurrent();
    updateMonthDisplay();
    loadTransactions();
    addMultipleBtn.style.display = 'none';
});

// --- UPDATED INITIALIZATION ---
MonthNavigation.init();
updateMonthDisplay();
loadTransactions();
populateAccountsDropdowns(); // Load accounts from Supabase