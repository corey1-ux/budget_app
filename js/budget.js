// At the very top of js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return; // Stop executing if not authenticated

    // The rest of your dashboard code...
    MonthNavigation.init();
    loadDashboardData();
});

const incomeInput = document.getElementById('income');
const expensesList = document.getElementById('expensesList');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const remainingEl = document.getElementById('remaining');

// A simple debounce function to prevent saving on every single keystroke
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

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
    
    const debouncedSave = debounce(saveBudgetData, 500); // Save 500ms after user stops typing

    const removeBtn = expenseItem.querySelector('.btn-remove');
    removeBtn.addEventListener('click', function() {
        expenseItem.remove();
        calculateTotals();
        saveBudgetData(); // Save immediately on removal
    });
    
    const inputs = expenseItem.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            calculateTotals();
            debouncedSave(); // Use the debounced save here
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

// Save current budget data to Supabase
async function saveBudgetData() {
    const income = parseFloat(incomeInput.value) || 0;
    const expenses = [];
    
    const expenseItems = document.querySelectorAll('.expense-item');
    expenseItems.forEach(item => {
        const name = item.querySelector('.expense-name').value;
        const amount = parseFloat(item.querySelector('.expense-value').value) || 0;
        // Only save expenses that have a name or an amount
        if (name || amount > 0) {
            expenses.push({ name, amount });
        }
    });
    
    await BudgetData.saveMonthData(MonthNavigation.currentMonth, { income, expenses });
    console.log("Budget saved for", MonthNavigation.currentMonth);
}

// Load budget data for current month from Supabase
async function loadBudgetData() {
    // Ensure we don't try to load data if the month isn't ready
    if (!MonthNavigation.currentMonth) return;
    
    const data = await BudgetData.getMonthData(MonthNavigation.currentMonth);
    
    incomeInput.value = data.income || '';
    expensesList.innerHTML = '';
    
    if (data.expenses && data.expenses.length > 0) {
        data.expenses.forEach(expense => {
            expensesList.appendChild(createExpenseItem(expense.name, expense.amount));
        });
    } else {
        // Start with 5 blank rows if no data exists
        for (let i = 0; i < 5; i++) {
            expensesList.appendChild(createExpenseItem());
        }
    }
    
    calculateTotals();
}

// --- EVENT LISTENERS & INITIALIZATION ---

// Add expense button
addExpenseBtn.addEventListener('click', () => {
    expensesList.appendChild(createExpenseItem());
});

// Income input listener with debounce
const debouncedSave = debounce(saveBudgetData, 500);
incomeInput.addEventListener('input', () => {
    calculateTotals();
    debouncedSave();
});

// Listen for the custom event from monthNavigation.js to reload data when the month changes
window.addEventListener('monthChanged', loadBudgetData);

// --- THIS IS THE FIX ---
// This waits for the month navigation to be fully initialized before loading data.
window.addEventListener('monthNavReady', () => {
    loadBudgetData();
});