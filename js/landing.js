// js/landing.js

// --- Modal Logic ---
const loginModal = document.getElementById('loginModal');
const signInBtnNav = document.getElementById('signInBtnNav');
const getStartedBtnNav = document.getElementById('getStartedBtnNav');
const getStartedBtnHero = document.getElementById('getStartedBtnHero');
const getStartedBtnCTA = document.getElementById('getStartedBtnCTA');
const closeLoginModal = document.getElementById('closeLoginModal');

const openModal = () => loginModal.classList.add('active');
const closeModal = () => loginModal.classList.remove('active');

signInBtnNav.addEventListener('click', openModal);
getStartedBtnNav.addEventListener('click', openModal);
getStartedBtnHero.addEventListener('click', openModal);
getStartedBtnCTA.addEventListener('click', openModal);
closeLoginModal.addEventListener('click', closeModal);

loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        closeModal();
    }
});

// --- Animation Logic ---

// Initialize Lucide icons
lucide.createIcons();

// Stagger animations for feature cards
document.querySelectorAll('.feature-card').forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

// Observe sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});