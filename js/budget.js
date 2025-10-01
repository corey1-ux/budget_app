const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const incomeInput = document.getElementById('income');
const expensesList = document.getElementById('expensesList');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const remainingEl = document.getElementById('remaining');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const goToCurrentMonthBtn = document.getElementById('goToCurrentMonth');
const monthDisplayEl = document.getElementById('currentMonthDisplay');

// Hamburger menu functionality
hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

document.addEventListener('click', function(event) {
    const isClickInsideNav = navMenu.contains(event.target);
    const isClickOnHamburger = hamburger.contains(event.target);
    
    if (!isClickInsideNav && !isClickOnHamburger && navMenu.classList.contains('active')) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// Expense item creation
function createExpenseItem(name = '', amount = '') {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item';
    
    expenseItem.innerHTML = `
        <input type="text" placeholder="Expense name" class="expense-name" value="${name}">
        <div class="expense-amount">
            <span class="currency">$</span>
            <input type="number" placeholder="0.00" step="0.01" min="0" class="expense-value" value="${amount}">
        </div>
        <button class="btn-remove" title="Remove expense">×</button>
    `;
    
    const removeBtn = expenseItem.querySelector('.btn-remove');
    removeBtn.addEventListener('click', function() {
        expenseItem.remove();
        calculateTotals();
        saveBudgetData();
    });
    
    const inputs = expenseItem.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            calculateTotals();
            saveBudgetData();
        });
    });
    
    return expenseItem;
}

// Calculate totals
function calculateTotals() {
    const income = parseFloat(incomeInput.value) || 0;
    
    const expenseValues = document.querySelectorAll('.expense-value');
    let totalExpenses = 0;
    
    expenseValues.forEach(input => {
        const value = parseFloat(input.value) || 0;
        totalExpenses += value;
    });
    
    const remaining = income - totalExpenses;
    
    totalIncomeEl.textContent = `$${income.toFixed(2)}`;
    totalExpensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
    remainingEl.textContent = `$${remaining.toFixed(2)}`;
    
    if (remaining < 0) {
        remainingEl.classList.add('negative');
    } else {
        remainingEl.classList.remove('negative');
    }
}

// Save current budget data
function saveBudgetData() {
    const income = parseFloat(incomeInput.value) || 0;
    const expenses = [];
    
    const expenseItems = document.querySelectorAll('.expense-item');
    expenseItems.forEach(item => {
        const name = item.querySelector('.expense-name').value;
        const amount = parseFloat(item.querySelector('.expense-value').value) || 0;
        expenses.push({ name, amount });
    });
    
    BudgetData.saveMonthData(MonthNavigation.currentMonth, { income, expenses });
}

// Load budget data for current month
function loadBudgetData() {
    const data = BudgetData.getMonthData(MonthNavigation.currentMonth);
    
    // Load income
    incomeInput.value = data.income || '';
    
    // Clear existing expenses
    expensesList.innerHTML = '';
    
    // Load expenses or create default 5
    if (data.expenses && data.expenses.length > 0) {
        data.expenses.forEach(expense => {
            expensesList.appendChild(createExpenseItem(expense.name, expense.amount));
        });
    } else {
        for (let i = 0; i < 5; i++) {
            expensesList.appendChild(createExpenseItem());
        }
    }
    
    calculateTotals();
}

// Update month display
function updateMonthDisplay() {
    monthDisplayEl.textContent = MonthNavigation.getDisplayName(MonthNavigation.currentMonth);
    
    // Show/hide "Go to Current Month" button
    if (MonthNavigation.isViewingCurrentMonth()) {
        goToCurrentMonthBtn.classList.add('hidden');
    } else {
        goToCurrentMonthBtn.classList.remove('hidden');
    }
}

// Month navigation event listeners
prevMonthBtn.addEventListener('click', () => {
    MonthNavigation.previousMonth();
    updateMonthDisplay();
    loadBudgetData();
});

nextMonthBtn.addEventListener('click', () => {
    MonthNavigation.nextMonth();
    updateMonthDisplay();
    loadBudgetData();
});

goToCurrentMonthBtn.addEventListener('click', () => {
    MonthNavigation.goToCurrent();
    updateMonthDisplay();
    loadBudgetData();
});

// Add expense button
addExpenseBtn.addEventListener('click', () => {
    expensesList.appendChild(createExpenseItem());
});

// Income input
incomeInput.addEventListener('input', () => {
    calculateTotals();
    saveBudgetData();
});

// Initialize on page load
MonthNavigation.init();
updateMonthDisplay();
loadBudgetData();