// js/budgetData.js

const BudgetData = {
    // Get data for a specific month from Supabase
    async getMonthData(monthKey) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { income: 0, expenses: [] };

            const { data, error } = await supabase
                .from('budgets')
                .select('data')
                .eq('user_id', user.id)
                .eq('month_key', monthKey)
                .single(); 

            if (error && error.code !== 'PGRST116') { // PGRST116 = "No rows found"
                throw error;
            }

            return data ? data.data : { income: 0, expenses: [] };

        } catch (err) {
            console.error('Error fetching budget data:', err);
            return { income: 0, expenses: [] };
        }
    },
    
    // Save data for a specific month to Supabase
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

        } catch (err) {
            console.error('Error saving budget data:', err);
        }
    }
};