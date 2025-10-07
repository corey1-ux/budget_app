// js/services/budgetService.js - Consolidated budget data operations

class BudgetService {
    constructor() {
        this.cache = new Map();
    }

    // Get budget data for a specific month
    async getMonthData(monthKey) {
        try {
            // Check cache first
            if (this.cache.has(monthKey)) {
                return this.cache.get(monthKey);
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { income: 0, expenses: [] };

            const { data, error } = await supabase
                .from('budgets')
                .select('data')
                .eq('user_id', user.id)
                .eq('month_key', monthKey)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            const result = data ? data.data : { income: 0, expenses: [] };
            
            // Cache the result
            this.cache.set(monthKey, result);
            
            return result;

        } catch (err) {
            console.error('Error fetching budget data:', err);
            return { income: 0, expenses: [] };
        }
    }

    // Save budget data for a specific month
    async saveMonthData(monthKey, dataToSave) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const { error } = await supabase
                .from('budgets')
                .upsert({
                    user_id: user.id,
                    month_key: monthKey,
                    data: dataToSave
                }, {
                    onConflict: 'user_id, month_key'
                });

            if (error) throw error;

            // Update cache
            this.cache.set(monthKey, dataToSave);
            
            console.log(`💾 Budget data saved for ${monthKey}`);

        } catch (err) {
            console.error('Error saving budget data:', err);
            throw err;
        }
    }

    // Get transactions for a specific month
    async getTransactions(monthKey, type = null) {
        try {
            let query = supabase
                .from('transactions')
                .select('*')
                .eq('month_key', monthKey)
                .order('day', { ascending: false });

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data || [];

        } catch (err) {
            console.error('Error fetching transactions:', err);
            return [];
        }
    }

    // Calculate spending by category for a month
    async getSpendingByCategory(monthKey) {
        try {
            const transactions = await this.getTransactions(monthKey, 'expense');
            
            return transactions.reduce((acc, transaction) => {
                const category = transaction.category || 'Uncategorized';
                acc[category] = (acc[category] || 0) + (parseFloat(transaction.amount) || 0);
                return acc;
            }, {});

        } catch (err) {
            console.error('Error calculating spending by category:', err);
            return {};
        }
    }

    // Get spending for a specific category
    getSpentForCategory(transactions, categoryName) {
        if (!categoryName || !Array.isArray(transactions)) return 0;
        
        return transactions
            .filter(t => t.category === categoryName)
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    }

    // Calculate budget vs actual for current month
    async getBudgetVsActual(monthKey) {
        try {
            const [budgetData, transactions] = await Promise.all([
                this.getMonthData(monthKey),
                this.getTransactions(monthKey, 'expense')
            ]);

            const categories = budgetData.expenses || [];
            const actualByCategory = this.getSpendingByCategory(transactions);

            return categories.map(category => ({
                name: category.name,
                budgeted: parseFloat(category.amount || category.budgeted) || 0,
                actual: actualByCategory[category.name] || 0
            }));

        } catch (err) {
            console.error('Error calculating budget vs actual:', err);
            return [];
        }
    }

    // Get spending trend for multiple months
    async getSpendingTrend(monthCount = 6) {
        try {
            const months = [];
            const now = new Date();
            
            for (let i = monthCount - 1; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                months.push({
                    key: monthKey,
                    label: date.toLocaleDateString('default', { month: 'short', year: 'numeric' })
                });
            }

            const spendingData = await Promise.all(
                months.map(async (month) => {
                    const transactions = await this.getTransactions(month.key, 'expense');
                    const total = transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
                    return { month: month.label, amount: total };
                })
            );

            return spendingData;

        } catch (err) {
            console.error('Error getting spending trend:', err);
            return [];
        }
    }

    // Clear cache for a specific month or all
    clearCache(monthKey = null) {
        if (monthKey) {
            this.cache.delete(monthKey);
        } else {
            this.cache.clear();
        }
    }

    // Invalidate cache when data changes
    invalidateCache(monthKey) {
        this.clearCache(monthKey);
        console.log(`🗑️ Cache invalidated for ${monthKey}`);
    }
}

// Create and register the service
const budgetService = new BudgetService();

// Register with app if available
if (window.budgetApp) {
    window.budgetApp.registerService('budget', budgetService);
}

// Export for direct use
window.BudgetService = budgetService;