// js/dashboard.js

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeDashboard() {
    const user = await requireAuth();
    if (!user) return;

    setGreeting(user);
    
    // Set up event listeners for month changes
    window.addEventListener('monthChanged', handleMonthChange);
    window.addEventListener('monthNavReady', handleMonthChange);
    
    // Load data immediately if month is already available
    if (MonthNavigation.currentMonth) {
        loadAllDashboardData();
    }
}

function handleMonthChange() {
    if (MonthNavigation.currentMonth) {
        loadAllDashboardData();
    }
}

async function loadAllDashboardData() {
    // Add stagger animation to cards
    document.querySelectorAll('.card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
    });
    
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Load all dashboard data in parallel for better performance
    await Promise.all([
        loadNetWorth(),
        loadSpendingAndBudgetData(),
        loadRecentTransactions(),
        loadRecurringPayments()
    ]);
}

// ==========================================
// PAGE LIFECYCLE EVENT LISTENERS
// ==========================================

window.addEventListener('DOMContentLoaded', initializeDashboard);

// Handle back/forward button (bfcache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        initializeDashboard();
    }
});

// ==========================================
// DATA LOADING FUNCTIONS
// ==========================================

function setGreeting(user) {
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) {
        greeting = 'Good Morning';
    } else if (hour < 18) {
        greeting = 'Good Afternoon';
    } else {
        greeting = 'Good Evening';
    }
    
    const displayName = user.user_metadata?.full_name || user.email.split('@')[0];
    const greetingEl = document.getElementById('greeting');
    
    if (greetingEl) {
        greetingEl.textContent = `${greeting}, ${displayName}`;
    }
}

async function loadNetWorth() {
    try {
        const { data, error } = await supabase
            .from('accounts')
            .select('type, balance');
        
        if (error) throw error;
        
        let totalAssets = 0;
        let totalDebts = 0;
        
        data.forEach(account => {
            const balance = parseFloat(account.balance) || 0;
            if (account.type === 'asset') {
                totalAssets += balance;
            } else {
                totalDebts += balance;
            }
        });
        
        const netWorth = totalAssets - totalDebts;
        countUp(document.getElementById('netWorthValue'), netWorth);
        
    } catch (err) {
        console.error('Error loading net worth:', err);
        const netWorthEl = document.getElementById('netWorthValue');
        if (netWorthEl) netWorthEl.textContent = '$0.00';
    }
}

async function loadSpendingAndBudgetData() {
    try {
        // Get budget information for current month
        const budgetInfo = await BudgetData.getMonthData(MonthNavigation.currentMonth);
        const budgetedIncome = parseFloat(budgetInfo.income) || 0;

        // Get transactions for current month
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('amount, category, merchant, type, account')
            .eq('month_key', MonthNavigation.currentMonth)
            .eq('type', 'expense');
        
        if (error) throw error;

        // Calculate total expenses
        const totalExpenses = transactions.reduce((sum, t) => {
            return sum + (parseFloat(t.amount) || 0);
        }, 0);
        
        const remaining = budgetedIncome - totalExpenses;

        // Update budget display
        countUp(document.getElementById('budgetSpent'), totalExpenses);
        countUp(document.getElementById('budgetRemaining'), remaining);
        
        const remainingEl = document.getElementById('budgetRemaining');
        if (remainingEl) {
            remainingEl.className = remaining >= 0 ? 'main-value positive' : 'main-value negative';
        }

        // Update progress bar
        const percentage = budgetedIncome > 0 ? (totalExpenses / budgetedIncome) * 100 : 0;
        const progressBar = document.getElementById('budgetProgress');
        const progressLabel = document.getElementById('progress-label');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
        if (progressLabel) {
            progressLabel.textContent = `${formatCurrency(totalExpenses)} of ${formatCurrency(budgetedIncome)}`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        }

        // Render charts and top expenses
        renderSpendingChart(transactions);
        displayTopExpenses(transactions);

    } catch (err) {
        console.error('Error loading spending and budget data:', err);
    }
}

async function loadRecentTransactions() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('month_key', MonthNavigation.currentMonth)
            .order('day', { ascending: false })
            .limit(5);

        if (error) throw error;
        
        const listEl = document.getElementById('recentTransactionsList');
        if (!listEl) return;
        
        if (!data || data.length === 0) {
            listEl.innerHTML = '<li class="list-item-empty"><p>No transactions this month.</p></li>';
            return;
        }
        
        listEl.innerHTML = data.map(t => {
            const type = t.type === 'income' ? 'income' : 'expense';
            const icon = type === 'income' ? 'plus' : 'minus';
            
            return `
                <li class="transaction-item">
                    <div class="transaction-icon ${type}">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="name">${t.merchant}</div>
                        <div class="category">${t.account}</div>
                    </div>
                    <div class="transaction-amount ${type}">
                        ${formatCurrency(t.amount)}
                    </div>
                </li>
            `;
        }).join('');
        
        lucide.createIcons();
        
    } catch (err) {
        console.error('Error loading recent transactions:', err);
    }
}
    
async function loadRecurringPayments() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('recurring', true)
            .order('day', { ascending: true });
        
        if (error) throw error;
        
        const listEl = document.getElementById('recurringPaymentsList');
        if (!listEl) return;
        
        if (!data || data.length === 0) {
            listEl.innerHTML = '<li class="list-item-empty"><p>No recurring payments found.</p></li>';
            return;
        }
        
        listEl.innerHTML = data.map(t => {
            const day = t.day.slice(-2);
            return `
                <li class="recurring-item">
                    <div class="transaction-details">
                        <div class="name">${t.merchant}</div>
                        <div class="date">Next on day ${day}</div>
                    </div>
                    <div class="recurring-amount">
                        ${formatCurrency(t.amount)}
                    </div>
                </li>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Error loading recurring payments:', err);
    }
}

// ==========================================
// CHART RENDERING
// ==========================================

let spendingChartInstance = null;

function renderSpendingChart(expenses) {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (spendingChartInstance) {
        spendingChartInstance.destroy();
    }

    // Aggregate spending by category
    const spendingByCategory = expenses.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + (parseFloat(expense.amount) || 0);
        return acc;
    }, {});

    // Create new chart
    spendingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(spendingByCategory),
            datasets: [{
                data: Object.values(spendingByCategory),
                backgroundColor: [
                    '#f97316',
                    '#fb923c',
                    '#fdba74',
                    '#fed7aa',
                    '#ffedd5',
                    '#d97706',
                    '#b45309'
                ],
                borderColor: '#fff',
                borderWidth: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function displayTopExpenses(expenses) {
    const listEl = document.getElementById('topExpensesList');
    if (!listEl) return;
    
    // Sort by amount and get top 5
    const topFive = [...expenses]
        .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
        .slice(0, 5);

    if (topFive.length === 0) {
        listEl.innerHTML = '<li class="list-item-empty"><p>No expenses to show.</p></li>';
        return;
    }

    listEl.innerHTML = topFive.map(t => `
        <li class="transaction-item">
            <div class="transaction-icon expense">
                <i data-lucide="minus"></i>
            </div>
            <div class="transaction-details">
                <div class="name">${t.merchant}</div>
                <div class="category">${t.account}</div>
            </div>
            <div class="transaction-amount expense">
                ${formatCurrency(t.amount)}
            </div>
        </li>
    `).join('');
    
    lucide.createIcons();
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function countUp(element, endValue) {
    if (!element) return;
    
    const startValue = parseFloat(element.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const duration = 1000; // 1 second
    const frameRate = 60;
    const totalFrames = Math.round(duration / (1000 / frameRate));
    const increment = (endValue - startValue) / totalFrames;
    
    let currentValue = startValue;
    let currentFrame = 0;
    
    // Clear any existing counter
    if (element.counter) {
        clearInterval(element.counter);
    }

    element.counter = setInterval(() => {
        currentValue += increment;
        currentFrame++;
        element.textContent = formatCurrency(currentValue);
        
        if (currentFrame === totalFrames) {
            clearInterval(element.counter);
            element.textContent = formatCurrency(endValue);
        }
    }, 1000 / frameRate);
}

function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}