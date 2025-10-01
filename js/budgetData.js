const BudgetData = {
    // Get all budget data
    getAllData() {
        const data = localStorage.getItem('budgetData');
        return data ? JSON.parse(data) : {};
    },
    
    // Get data for specific month
    getMonthData(monthKey) {
        const allData = this.getAllData();
        return allData[monthKey] || { income: 0, expenses: [] };
    },
    
    // Save data for specific month
    saveMonthData(monthKey, data) {
        const allData = this.getAllData();
        allData[monthKey] = data;
        localStorage.setItem('budgetData', JSON.stringify(allData));
    }
};