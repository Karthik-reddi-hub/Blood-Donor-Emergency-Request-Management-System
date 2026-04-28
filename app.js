// BloodLink Frontend Logic
const app = {
    currentTheme: localStorage.getItem('theme') || 'light',
    user: JSON.parse(localStorage.getItem('user')) || null,

    init() {
        this.applyTheme();
        this.setupNav();
        this.renderInitialPage();
        this.setupEventListeners();
    },

    applyTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        const icon = document.querySelector('.theme-toggle i');
        if (icon) icon.className = this.currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    },

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.currentTheme);
        this.applyTheme();
    },

    setupNav() {
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        if (hamburger) {
            hamburger.onclick = () => navLinks.classList.toggle('open');
        }
    },

    navigate(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById('page-' + pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            // Update URL hash without reload
            window.location.hash = pageId;
            this.updateActiveLink(pageId);
            this.loadPageData(pageId);
        }
    },

    updateActiveLink(pageId) {
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.id === 'link-' + pageId);
        });
    },

    renderInitialPage() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        if (!this.user && hash !== 'login') {
            this.navigate('login');
        } else {
            this.navigate(hash);
        }
    },

    loadPageData(pageId) {
        // Simulate data loading with skeleton delay
        const containers = document.querySelectorAll(`#page-${pageId} .data-container`);
        containers.forEach(c => c.classList.add('skeleton-loading')); // Custom CSS class logic
        
        setTimeout(() => {
            containers.forEach(c => c.classList.remove('skeleton-loading'));
            this.renderPageSpecifics(pageId);
        }, 500);
    },

    renderPageSpecifics(pageId) {
        switch(pageId) {
            case 'analytics': this.renderCharts(); break;
            case 'match': this.renderMatchTool(); break;
            case 'admin': this.renderAdminPanel(); break;
            case 'profile': this.renderDonorProfile(); break;
        }
    },

    renderCharts() {
        const canvas = document.getElementById('donation-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        // Simple manual line chart logic...
    },

    setupEventListeners() {
        window.addEventListener('popstate', () => this.renderInitialPage());
    },

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    },

    exportTable(tableId) {
        window.print();
    }
};

window.onload = () => app.init();
