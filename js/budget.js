// js/budget.js

// ==========================================
// STATE MANAGEMENT
// ==========================================

let isInitialized = false;
let currentMonthTransactions = [];
let draggedItem = null;

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeBudgetPage() {
    const user = await requireAuth();
    if (!user) return;

    if (!isInitialized) {
        setupEventListeners();
        setupRealtime(user.id);  // 👈 ADD THIS LINE
        isInitialized = true;
    }
    
    if (MonthNavigation.currentMonth) {
        await loadBudgetData();
    }
}

// 👇 ADD THIS NEW FUNCTION
function setupRealtime(userId) {
    console.log('🔄 Setting up budget realtime...');
    
    // Subscribe to budget changes
    supabase
        .channel('budget-page-budgets')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'budgets',
            filter: `user_id=eq.${userId}`
        }, async (payload) => {
            console.log('✨ Budget changed:', payload.eventType);
            
            // Reload budget data
            await loadBudgetData();
        })
        .subscribe();
    
    // Subscribe to transaction changes (they affect spending)
    supabase
        .channel('budget-page-transactions')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`
        }, async (payload) => {
            console.log('✨ Transaction changed (affects budget)');
            
            const monthKey = payload.new?.month_key || payload.old?.month_key;
            
            if (monthKey === MonthNavigation.currentMonth) {
                // Reload transactions and update progress
                await loadTransactionsForMonth();
                updateAllExpenseProgress();
                calculateTotals();
            }
        })
        .subscribe();
}

function setupEventListeners() {
    const incomeInput = document.getElementById('income');
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    
    // Listen for month changes
    window.addEventListener('monthChanged', handleMonthChange);
    window.addEventListener('monthNavReady', handleMonthChange);
    
    // Income input with debounce
    if (incomeInput) {
        incomeInput.addEventListener('input', debounce(() => {
            calculateTotals();
            saveBudgetData();
        }, 500));
    }
    
    // Add expense button
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => {
            addExpenseItem();
        });
    }
}

async function handleMonthChange() {
    if (MonthNavigation.currentMonth) {
        await loadBudgetData();
    }
}

// ==========================================
// PAGE LIFECYCLE EVENT LISTENERS
// ==========================================

window.addEventListener('DOMContentLoaded', initializeBudgetPage);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        isInitialized = false;
        initializeBudgetPage();
    }
});

// Add these after your existing event listeners in each file

// Handle page visibility
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && isInitialized) {
        console.log('Page visible, refreshing data...');
        await loadPageData(); // Your page's data loading function
    }
});

// Handle browser back/forward
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        console.log('Page from cache, reloading...');
        isInitialized = false;
        await initializePage(); // Your page's init function
    }
});

// Handle window focus
window.addEventListener('focus', async () => {
    if (isInitialized) {
        console.log('Window focused, refreshing...');
        await loadPageData();
    }
});
// ==========================================
// DATA LOADING
// ==========================================

async function loadTransactionsForMonth() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('month_key', MonthNavigation.currentMonth)
            .eq('type', 'expense');
        
        if (error) throw error;
        
        currentMonthTransactions = data || [];
        
    } catch (err) {
        console.error('Error loading transactions:', err);
        currentMonthTransactions = [];
    }
}

function getSpentForCategory(categoryName) {
    if (!categoryName) return 0;
    
    return currentMonthTransactions
        .filter(t => t.category === categoryName)
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
}

// ==========================================
// DRAG AND DROP FUNCTIONALITY
// ==========================================

function setupDragAndDrop(expenseItem) {
    expenseItem.setAttribute('draggable', 'true');
    
    expenseItem.addEventListener('dragstart', handleDragStart);
    expenseItem.addEventListener('dragend', handleDragEnd);
    expenseItem.addEventListener('dragover', handleDragOver);
    expenseItem.addEventListener('drop', handleDrop);
    expenseItem.addEventListener('dragenter', handleDragEnter);
    expenseItem.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove drag-over class from all items
    const items = document.querySelectorAll('.expense-item');
    items.forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedItem !== this) {
        const expensesList = document.getElementById('expensesList');
        const allItems = Array.from(expensesList.children);
        const draggedIndex = allItems.indexOf(draggedItem);
        const targetIndex = allItems.indexOf(this);
        
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedItem, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedItem, this);
        }
        
        // Save the new order
        saveBudgetData();
    }
    
    this.classList.remove('drag-over');
    return false;
}

// ==========================================
// EXPENSE ITEM MANAGEMENT
// ==========================================

function addExpenseItem(name = '', amount = '') {
    const expensesList = document.getElementById('expensesList');
    const emptyState = document.getElementById('emptyState');
    
    if (!expensesList) return;
    
    // Hide empty state
    if (emptyState) {
        emptyState.classList.remove('visible');
    }
    
    const expenseItem = document.createElement('div');
    expenseItem.className = 'expense-item';
    
    const spent = name ? getSpentForCategory(name) : 0;
    const budgeted = parseFloat(amount) || 0;
    const percentage = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
    
    let progressClass = 'expense-progress-fill';
    let spentClass = 'expense-spent-info';
    let spentText = '';
    
    if (budgeted > 0) {
        if (spent > budgeted) {
            progressClass += ' over-budget';
            spentClass += ' over-budget';
            spentText = `${formatCurrency(spent)} spent`;
        } else if (percentage >= 80) {
            progressClass += ' warning';
            spentClass += ' warning';
            spentText = `${formatCurrency(spent)} spent`;
        } else {
            spentText = `${formatCurrency(spent)} spent`;
        }
    } else {
        spentText = spent > 0 ? `${formatCurrency(spent)} spent` : 'No spending';
    }
    
    expenseItem.innerHTML = `
        <div class="expense-input-group">
            <input 
                type="text" 
                placeholder="Category name (e.g., Groceries)" 
                class="expense-name" 
                value="${name}"
            >
            <div class="expense-progress-container">
                <div class="expense-progress-bar">
                    <div class="${progressClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        </div>
        <div class="expense-amount-wrapper">
            <div class="expense-amount-input-container">
                <span class="currency-symbol">$</span>
                <input 
                    type="number" 
                    placeholder="0.00" 
                    step="0.01" 
                    min="0" 
                    class="expense-value" 
                    value="${amount}"
                >
            </div>
            <div class="${spentClass}">${spentText}</div>
        </div>
        <button class="btn-remove" title="Remove category">
            <i data-lucide="trash-2"></i>
        </button>
    `;
    
    // Add to list
    expensesList.appendChild(expenseItem);
    
    // Set up drag and drop
    setupDragAndDrop(expenseItem);
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Attach event listeners
    const removeBtn = expenseItem.querySelector('.btn-remove');
    removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        removeExpenseItem(expenseItem);
    });
    
    const inputs = expenseItem.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            updateExpenseProgress(expenseItem);
            calculateTotals();
            saveBudgetData();
        }, 500));
        
        input.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    });
    
    // Focus on the name input for new items
    if (!name) {
        const nameInput = expenseItem.querySelector('.expense-name');
        if (nameInput) {
            nameInput.focus();
        }
    }
}

function updateExpenseProgress(expenseItem) {
    const nameInput = expenseItem.querySelector('.expense-name');
    const amountInput = expenseItem.querySelector('.expense-value');
    const progressFill = expenseItem.querySelector('.expense-progress-fill');
    const spentInfoEl = expenseItem.querySelector('.expense-spent-info');
    
    if (!nameInput || !amountInput || !progressFill || !spentInfoEl) return;
    
    const categoryName = nameInput.value;
    const budgeted = parseFloat(amountInput.value) || 0;
    const spent = categoryName ? getSpentForCategory(categoryName) : 0;
    
    const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;
    const displayPercentage = Math.min(percentage, 100);
    
    // Update progress bar width
    progressFill.style.width = `${displayPercentage}%`;
    
    // Update progress bar color and spent info
    let progressClass = 'expense-progress-fill';
    let spentClass = 'expense-spent-info';
    let spentText = '';
    
    if (budgeted > 0) {
        if (spent > budgeted) {
            progressClass += ' over-budget';
            spentClass += ' over-budget';
            spentText = `${formatCurrency(spent)} spent`;
        } else if (percentage >= 80) {
            progressClass += ' warning';
            spentClass += ' warning';
            spentText = `${formatCurrency(spent)} spent`;
        } else {
            spentText = `${formatCurrency(spent)} spent`;
        }
    } else {
        spentText = spent > 0 ? `${formatCurrency(spent)} spent` : 'No spending';
    }
    
    progressFill.className = progressClass;
    spentInfoEl.className = spentClass;
    spentInfoEl.textContent = spentText;
}

function updateAllExpenseProgress() {
    const expenseItems = document.querySelectorAll('.expense-item');
    expenseItems.forEach(item => {
        updateExpenseProgress(item);
    });
}

function removeExpenseItem(expenseItem) {
    expenseItem.style.animation = 'slide-out 0.3s ease-out';
    
    setTimeout(() => {
        expenseItem.remove();
        calculateTotals();
        saveBudgetData();
        updateEmptyState();
    }, 300);
}

function updateEmptyState() {
    const expensesList = document.getElementById('expensesList');
    const emptyState = document.getElementById('emptyState');
    
    if (!expensesList || !emptyState) return;
    
    const hasExpenses = expensesList.children.length > 0;
    
    if (hasExpenses) {
        emptyState.classList.remove('visible');
    } else {
        emptyState.classList.add('visible');
    }
}

// ==========================================
// CALCULATIONS
// ==========================================

function calculateTotals() {
    const incomeInput = document.getElementById('income');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpensesEl = document.getElementById('totalExpenses');
    const remainingEl = document.getElementById('remaining');
    const progressBar = document.getElementById('budgetProgressBar');
    const progressLabel = document.getElementById('progressLabel');
    
    if (!incomeInput) return;
    
    const income = parseFloat(incomeInput.value) || 0;
    
    // Calculate total budgeted expenses
    const expenseValues = document.querySelectorAll('.expense-value');
    let totalBudgetedExpenses = 0;
    
    expenseValues.forEach(input => {
        const value = parseFloat(input.value) || 0;
        totalBudgetedExpenses += value;
    });
    
    // Calculate total actual spent
    const totalActualSpent = currentMonthTransactions.reduce((sum, t) => {
        return sum + (parseFloat(t.amount) || 0);
    }, 0);
    
    const remaining = income - totalActualSpent;
    
    // Update display
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(income);
    if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(totalBudgetedExpenses);
    if (remainingEl) {
        remainingEl.textContent = formatCurrency(remaining);
        remainingEl.className = 'summary-value';
        if (remaining >= 0) {
            remainingEl.classList.add('positive');
        } else {
            remainingEl.classList.add('negative');
        }
    }
    
    // Update progress bar based on actual spending vs income
    if (progressBar && income > 0) {
        const percentage = Math.min((totalActualSpent / income) * 100, 100);
        progressBar.style.width = `${percentage}%`;
        
        // Change color based on usage
        progressBar.className = 'progress-bar-fill';
        if (percentage >= 100) {
            progressBar.classList.add('danger');
        } else if (percentage >= 80) {
            progressBar.classList.add('warning');
        }
        
        if (progressLabel) {
            progressLabel.textContent = `${formatCurrency(totalActualSpent)} of ${formatCurrency(income)} spent (${Math.round(percentage)}%)`;
        }
    } else if (progressBar) {
        progressBar.style.width = '0%';
        if (progressLabel) {
            progressLabel.textContent = '0% of budget used';
        }
    }
}

// ==========================================
// DATA PERSISTENCE
// ==========================================

async function saveBudgetData() {
    const incomeInput = document.getElementById('income');
    if (!incomeInput) return;
    
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
}

async function loadBudgetData() {
    if (!MonthNavigation.currentMonth) return;
    
    const incomeInput = document.getElementById('income');
    const expensesList = document.getElementById('expensesList');
    
    if (!incomeInput || !expensesList) return;
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Load transactions first
    await loadTransactionsForMonth();
    
    // Load budget data
    const data = await BudgetData.getMonthData(MonthNavigation.currentMonth);
    
    // Set income
    incomeInput.value = data.income || '';
    
    // Clear existing expenses
    expensesList.innerHTML = '';
    
    // Add expenses
    if (data.expenses && data.expenses.length > 0) {
        data.expenses.forEach(expense => {
            addExpenseItem(expense.name, expense.amount);
        });
    }
    
    // Update empty state
    updateEmptyState();
    
    // Calculate totals
    calculateTotals();
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}

// Add slide-out animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slide-out {
        to {
            opacity: 0;
            transform: translateX(-20px);
        }
    }
`;
document.head.appendChild(style);