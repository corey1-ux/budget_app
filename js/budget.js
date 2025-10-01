const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const incomeInput = document.getElementById('income');
const expensesList = document.getElementById('expensesList');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const remainingEl = document.getElementById('remaining');

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

function createExpenseItem() {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item';
    
    expenseItem.innerHTML = `
        <input type="text" placeholder="Expense name" class="expense-name">
        <div class="expense-amount">
            <span class="currency">$</span>
            <input type="number" placeholder="0.00" step="0.01" min="0" class="expense-value">
        </div>
        <button class="btn-remove" title="Remove expense">×</button>
    `;
    
    const removeBtn = expenseItem.querySelector('.btn-remove');
    removeBtn.addEventListener('click', function() {
        expenseItem.remove();
        calculateTotals();
    });
    
    const inputs = expenseItem.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', calculateTotals);
    });
    
    return expenseItem;
}

function initializeExpenses() {
    for (let i = 0; i < 5; i++) {
        expensesList.appendChild(createExpenseItem());
    }
}

addExpenseBtn.addEventListener('click', function() {
    expensesList.appendChild(createExpenseItem());
});

incomeInput.addEventListener('input', calculateTotals);

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

initializeExpenses();
calculateTotals();