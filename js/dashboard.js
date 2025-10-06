// js/dashboard.js - Updated with auto-refresh

// ==========================================
// STATE MANAGEMENT
// ==========================================

let isInitialized = false;
let spendingChartInstance = null;
let trendChartInstance = null;
let budgetVsActualChartInstance = null;
let isDataLoading = false; // Prevent concurrent loads

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeDashboard() {
    const user = await requireAuth();
    if (!user) return;

    if (!MonthNavigation.currentMonth) {
        MonthNavigation.init();
    }

    if (!isInitialized) {
        setupRealtime(user.id);  // 👈 ADD THIS LINE
        isInitialized = true;
    }
    
    updateGreeting();
    await loadDashboardData();
}

// 👇 ADD THIS NEW FUNCTION
function setupRealtime(userId) {
    console.log('🔄 Setting up realtime subscriptions...');
    
    // Subscribe to transaction changes
    supabase
        .channel('dashboard-transactions')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            console.log('✨ Transaction changed:', payload.eventType);
            
            // Refresh affected data
            loadRecentTransactions();
            loadSpendingAndBudgetData();
        })
        .subscribe();
    
    // Subscribe to account changes
    supabase
        .channel('dashboard-accounts')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'accounts',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            console.log('✨ Account changed:', payload.eventType);
            
            // Refresh net worth
            loadNetWorth();
        })
        .subscribe();
}

// 👇 ADD CLEANUP ON PAGE UNLOAD
window.addEventListener('beforeunload', () => {
    supabase.removeAllChannels();
});

// ==========================================
// PAGE LIFECYCLE EVENT LISTENERS
// ==========================================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    await initializeDashboard();
});

// Handle browser back/forward cache
window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        console.log('Page restored from cache, forcing reload...');
        // Reset initialization flag
        isInitialized = false;
        // Reload everything
        await initializeDashboard();
    }
});

// Handle page visibility changes (user switching tabs or returning)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && isInitialized) {
        console.log('Page visible again, refreshing data...');
        await loadDashboardData();
    }
});

// Handle window focus as backup
window.addEventListener('focus', async () => {
    if (isInitialized && !isDataLoading) {
        console.log('Window focused, refreshing data...');
        await loadDashboardData();
    }
});

// ==========================================
// DATA LOADING
// ==========================================

async function loadDashboardData() {
    // Prevent concurrent loads
    if (isDataLoading) {
        console.log('Data already loading, skipping...');
        return;
    }
    
    try {
        isDataLoading = true;
        console.log('Loading dashboard data...');
        
        // Update greeting
        updateGreeting();
        
        // Load all dashboard data
        await Promise.all([
            loadNetWorth(),
            loadSpendingAndBudgetData(),
            loadRecentTransactions(),
            loadRecurringPayments(),
            renderSpendingTrendChart(),
            renderBudgetVsActualChart()
        ]);
        
        // Initialize Lucide icons
        lucide.createIcons();
        
        console.log('Dashboard data loaded successfully');
        
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    } finally {
        isDataLoading = false;
    }
}

async function loadBudget(monthKey) {
    const { data, error } = await supabase
        .from('budgets')
        .select('data')
        .eq('month_key', monthKey)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error loading budget:', error);
    }
    
    const budgetData = data?.data || {};
    return {
        income: budgetData.income || 0,
        categories: budgetData.categories || budgetData.expenses || []
    };
}

function updateGreeting() {
    const greetingEl = document.getElementById('greeting');
    if (!greetingEl) return;
    
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) {
        greeting = 'Good Morning';
    } else if (hour < 18) {
        greeting = 'Good Afternoon';
    } else {
        greeting = 'Good Evening';
    }
    
    greetingEl.textContent = greeting;
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

// Replace your loadSpendingAndBudgetData() function with this:

async function loadSpendingAndBudgetData() {
    try {
        // Get budget information for current month
        const budgetInfo = await loadBudget(MonthNavigation.currentMonth);
        const budgetedIncome = parseFloat(budgetInfo.income) || 0;
        
        // Calculate total BUDGETED expenses (not actual spent)
        const categories = budgetInfo.categories || budgetInfo.expenses || [];
        const totalBudgeted = categories.reduce((sum, cat) => {
            return sum + (parseFloat(cat.amount || cat.budgeted) || 0);
        }, 0);

        // Get actual transactions for spending display
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('amount, category, merchant, type, account')
            .eq('month_key', MonthNavigation.currentMonth)
            .eq('type', 'expense');
        
        if (error) throw error;

        // Calculate total actually spent (for progress bar)
        const totalActualSpent = transactions.reduce((sum, t) => {
            return sum + (parseFloat(t.amount) || 0);
        }, 0);
        
        // CHANGED: Remaining = Income - Budgeted (not Income - Spent)
        const remaining = budgetedIncome - totalBudgeted;

        // Update budget display
        countUp(document.getElementById('budgetSpent'), totalActualSpent);
        countUp(document.getElementById('budgetRemaining'), remaining);
        
        const remainingEl = document.getElementById('budgetRemaining');
        if (remainingEl) {
            remainingEl.className = remaining >= 0 ? 'main-value positive' : 'main-value negative';
        }

        // Progress bar shows actual spending vs income
        const percentage = budgetedIncome > 0 ? (totalActualSpent / budgetedIncome) * 100 : 0;
        const progressBar = document.getElementById('budgetProgress');
        const progressLabel = document.getElementById('progress-label');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
        if (progressLabel) {
            progressLabel.textContent = `${formatCurrency(totalActualSpent)} of ${formatCurrency(budgetedIncome)}`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        }

        // Render charts and top expenses (uses actual transactions)
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

function renderSpendingChart(expenses) {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (spendingChartInstance) {
        spendingChartInstance.destroy();
    }

    const spendingByCategory = expenses.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + (parseFloat(expense.amount) || 0);
        return acc;
    }, {});

    spendingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(spendingByCategory),
            datasets: [{
                data: Object.values(spendingByCategory),
                backgroundColor: [
                    '#f97316', '#fb923c', '#fdba74', '#fed7aa',
                    '#ffedd5', '#d97706', '#b45309'
                ],
                borderColor: '#fff',
                borderWidth: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                    }
                }
            }
        }
    });
}

function displayTopExpenses(expenses) {
    const listEl = document.getElementById('topExpensesList');
    if (!listEl) return;
    
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

async function renderSpendingTrendChart() {
    const canvas = document.getElementById('spendingTrendChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push({
            key: monthKey,
            label: date.toLocaleDateString('default', { month: 'short', year: 'numeric' })
        });
    }
    
    const spendingData = await Promise.all(
        months.map(async (month) => {
            const { data, error } = await supabase
                .from('transactions')
                .select('amount')
                .eq('month_key', month.key)
                .eq('type', 'expense');
            
            if (error) {
                console.error('Error fetching trend data:', error);
                return 0;
            }
            
            return data.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        })
    );
    
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Total Spending',
                data: spendingData,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#f97316',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Spending: ${formatCurrency(context.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            }
        }
    });
}

async function renderBudgetVsActualChart() {
    const canvas = document.getElementById('budgetVsActualChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (budgetVsActualChartInstance) {
        budgetVsActualChartInstance.destroy();
    }
    
    const budgetInfo = await loadBudget(MonthNavigation.currentMonth);
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, category')
        .eq('month_key', MonthNavigation.currentMonth)
        .eq('type', 'expense');
    
    if (error) {
        console.error('Error fetching budget vs actual data:', error);
        return;
    }
    
    const actualByCategory = transactions.reduce((acc, t) => {
        const category = t.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + (parseFloat(t.amount) || 0);
        return acc;
    }, {});
    
    const categories = budgetInfo.categories || [];
    const labels = categories.map(c => c.name);
    const budgeted = categories.map(c => parseFloat(c.budgeted) || 0);
    const actual = categories.map(c => actualByCategory[c.name] || 0);
    
    const monthDisplay = document.getElementById('budgetVsActualMonth');
    if (monthDisplay) {
        const [year, month] = MonthNavigation.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1);
        monthDisplay.textContent = date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    }
    
    budgetVsActualChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Budgeted',
                    data: budgeted,
                    backgroundColor: '#e2e8f0',
                    borderRadius: 6
                },
                {
                    label: 'Actual',
                    data: actual,
                    backgroundColor: '#f97316',
                    borderRadius: 6
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            }
        }
    });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function countUp(element, endValue) {
    if (!element) return;
    
    const startValue = parseFloat(element.textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const duration = 1000;
    const frameRate = 60;
    const totalFrames = Math.round(duration / (1000 / frameRate));
    const increment = (endValue - startValue) / totalFrames;
    
    let currentValue = startValue;
    let currentFrame = 0;
    
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