const BudgetData = {
    // Get data for a specific month from Supabase
    async getMonthData(monthKey) {
        try {
            const { data, error } = await supabase
                .from('budgets')
                .select('data')
                .eq('month_key', monthKey)
                .single(); // We expect only one record per month

            if (error && error.code !== 'PGRST116') { // PGRST116 = "No rows found" which is okay
                throw error;
            }

            // If data exists, return it. Otherwise, return a default empty budget.
            return data ? data.data : { income: 0, expenses: [] };

        } catch (err) {
            console.error('Error fetching budget data:', err);
            // Return a default structure on error to prevent crashes
            return { income: 0, expenses: [] };
        }
    },
    
    // Save data for a specific month to Supabase
    async saveMonthData(monthKey, dataToSave) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // 'upsert' will create a new row if one doesn't exist for the month,
            // or update the existing one if it does.
            const { error } = await supabase
                .from('budgets')
                .upsert({
                    user_id: user.id,
                    month_key: monthKey,
                    data: dataToSave
                }, {
                    onConflict: 'user_id, month_key' // Specify which columns to check for conflict
                });

            if (error) throw error;

        } catch (err) {
            console.error('Error saving budget data:', err);
        }
    }
};