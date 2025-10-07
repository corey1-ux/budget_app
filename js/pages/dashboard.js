// js/pages/dashboard.js - Simplified dashboard using core app module

class DashboardPage {
    constructor() {
        this.charts = {
            spending: null,
            trend: null,
            budgetVsActual: null
        };
    }

    async init() {
        // Use the core app initialization with page-specific config
        await budgetApp.init({
            pageName: 'Dashboard',
            useMonthNav: true,
            realtimeConfig: [
                {
                    table: 'transactions',
                    callback: () => this.onDataChange(),
                    channelName: 'dashboard-transactions'
                },
                {
                    table: 'accounts',
                    callback: () => this.loadNetWorth(),
                    channelName: 'dashboard-accounts'
                }
            ],
            initCallback: () => this.loadDashboardData(),
            onVisible: () => this.loadDashboardData(),
            onFocus: () => this.loadDashboardData()
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Month navigation
        window.addEventListener('monthChanged', () => this.loadDashboardData());
        window.addEventListener('monthNavReady', () => this.loadDashboardData());
    }

    async loadDashboardData() {
        try {
            this.updateGreeting();
            
            await Promise.all([
                this.loadNetWorth(),
                this.loadSpendingAndBudgetData(),
                this.loadRecentTransactions(),
                this.loadRecurringPayments(),
                this.renderSpendingTrendChart(),
                this.renderBudgetVsActualChart()
            ]);
            
            lucide.createIcons();
            console.log('📊 Dashboard data loaded');
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateGreeting() {
        const greetingEl = document.getElementById('greeting');
        if (!greetingEl) return;
        
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
        greetingEl.textContent = greeting;
    }

    async loadNetWorth() {
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
            this.animateValue('netWorthValue', netWorth);
            
        } catch (error) {
            console.error('Error loading net worth:', error);
            this.setValue('netWorthValue', '$0.00');
        }
    }

    async loadSpendingAndBudgetData() {
        const budgetService = budgetApp.getService('budget');
        if (!budgetService) return;

        try {
            const monthKey = MonthNavigation.currentMonth;
            const [budgetData, transactions] = await Promise.all([
                budgetService.getMonthData(monthKey),
                budgetService.getTransactions(monthKey, 'expense')
            ]);

            const budgetedIncome = parseFloat(budgetData.income) || 0;
            const categories = budgetData.expenses || [];
            const totalBudgeted = categories.reduce((sum, cat) => {
                return sum + (parseFloat(cat.amount || cat.budgeted) || 0);
            }, 0);

            const totalActualSpent = transactions.reduce((sum, t) => {
                return sum + (parseFloat(t.amount) || 0);
            }, 0);

            const remaining = budgetedIncome - totalBudgeted;

            // Update UI
            this.animateValue('budgetSpent', totalActualSpent);
            this.animateValue('budgetRemaining', remaining);
            
            const remainingEl = document.getElementById('budgetRemaining');
            if (remainingEl) {
                remainingEl.className = remaining >= 0 ? 'main-value positive' : 'main-value negative';
            }

            // Update progress bar
            this.updateProgressBar(totalActualSpent, budgetedIncome);

            // Render charts
            this.renderSpendingChart(transactions);
            this.displayTopExpenses(transactions);

        } catch (error) {
            console.error('Error loading spending data:', error);
        }
    }

    updateProgressBar(spent, income) {
        const percentage = income > 0 ? (spent / income) * 100 : 0;
        const progressBar = document.getElementById('budgetProgress');
        const progressLabel = document.getElementById('progress-label');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
        if (progressLabel) {
            progressLabel.textContent = `${budgetApp.formatCurrency(spent)} of ${budgetApp.formatCurrency(income)}`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        }
    }

    async loadRecentTransactions() {
        const budgetService = budgetApp.getService('budget');
        if (!budgetService) return;

        try {
            const transactions = await budgetService.getTransactions(MonthNavigation.currentMonth);
            const recentTransactions = transactions.slice(0, 5);
            
            const listEl = document.getElementById('recentTransactionsList');
            if (!listEl) return;
            
            if (recentTransactions.length === 0) {
                listEl.innerHTML = '<li class="list-item-empty"><p>No transactions this month.</p></li>';
                return;
            }
            
            listEl.innerHTML = recentTransactions.map(t => {
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
                            ${budgetApp.formatCurrency(t.amount)}
                        </div>
                    </li>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error loading recent transactions:', error);
        }
    }

    // Chart rendering methods (simplified)
    renderSpendingChart(expenses) {
        const canvas = document.getElementById('spendingChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.spending) {
            this.charts.spending.destroy();
        }

        const spendingByCategory = expenses.reduce((acc, expense) => {
            const category = expense.category || 'Uncategorized';
            acc[category] = (acc[category] || 0) + (parseFloat(expense.amount) || 0);
            return acc;
        }, {});

        this.charts.spending = new Chart(ctx, {
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
                            label: (context) => `${context.label}: ${budgetApp.formatCurrency(context.raw)}`
                        }
                    }
                }
            }
        });
    }

    // Utility methods
    animateValue(elementId, endValue) {
        const element = document.getElementById(elementId);
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
            element.textContent = budgetApp.formatCurrency(currentValue);
            
            if (currentFrame === totalFrames) {
                clearInterval(element.counter);
                element.textContent = budgetApp.formatCurrency(endValue);
            }
        }, 1000 / frameRate);
    }

    setValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value;
    }

    onDataChange() {
        // Handle real-time data updates
        this.loadRecentTransactions();
        this.loadSpendingAndBudgetData();
    }

    // Additional methods for loadRecurringPayments, renderSpendingTrendChart, 
    // renderBudgetVsActualChart, displayTopExpenses can be added here...
}

// Initialize the dashboard page
const dashboardPage = new DashboardPage();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => dashboardPage.init());
} else {
    dashboardPage.init();
}