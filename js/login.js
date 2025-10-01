const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    console.log('Login attempt:', { username, rememberMe });
    
    alert('Login functionality will be implemented here. Username: ' + username);
});