/**
 * Shared Navigation Component — CushLabs AI Services
 * Generates the nav HTML, attaches hamburger listeners,
 * and exposes window.cushlabsNav.updateLanguage(lang) for i18n pages.
 *
 * Usage: <div id="nav-root" data-page="PAGE_NAME"></div>
 *        <script src="/js/nav.js"></script>
 *
 * data-page values: index, portfolio, contact, trades, nyc-coaching, medspa
 */
(function () {
    var root = document.getElementById('nav-root');
    if (!root) return;

    var page = root.getAttribute('data-page') || '';

    // Pages that show a language toggle
    var i18nPages = { index: true, trades: true, contact: true };
    var showLang = !!i18nPages[page];

    // Portfolio shows theme toggle instead
    var showTheme = (page === 'portfolio');

    // Active link class
    var activeMap = {
        index: 'demos',
        'nyc-coaching': 'demos',
        medspa: 'demos',
        trades: 'demos',
        portfolio: 'portfolio',
        contact: 'contact'
    };
    var activePage = activeMap[page] || '';

    // Demos dropdown href — on index page link to #demos anchor, otherwise /#demos
    var demosHref = page === 'index' ? '#demos' : '/#demos';

    // Nav translation strings
    var navStrings = {
        en: { demos: 'Demos', portfolio: 'Portfolio', contact: 'Contact' },
        es: { demos: 'Demos', portfolio: 'Portafolio', contact: 'Contacto' }
    };

    // Current language (read from localStorage or default)
    var currentLang = 'en';
    var stored = localStorage.getItem('cushlabs-lang');
    if (stored === 'en' || stored === 'es') {
        currentLang = stored;
    } else {
        var nav = (navigator.language || '').toLowerCase();
        if (nav.startsWith('es')) currentLang = 'es';
    }

    function t(key) {
        return (navStrings[currentLang] && navStrings[currentLang][key]) || navStrings.en[key] || key;
    }

    // Build active class helper
    function cls(key) {
        return activePage === key ? ' class="nav-active"' : '';
    }

    // Build nav HTML
    var html = '<nav class="nav"><div class="nav-container">' +
        '<a href="/" class="nav-brand">CUSH<span>LABS.AI</span></a>' +
        '<div class="nav-controls">' +
        '<ul class="nav-links">' +
        '<li class="nav-dropdown">' +
        '<a href="' + demosHref + '" class="dropdown-trigger">' + t('demos') +
        ' <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg></a>' +
        '<ul class="dropdown-menu">' +
        '<li><a href="/">Clara &mdash; AI Assistant</a></li>' +
        '<li><a href="/nyc-coaching">James &mdash; Exec Coaching</a></li>' +
        '<li><a href="/medspa">Sophia &mdash; Med Spa</a></li>' +
        '<li><a href="/trades">Mike &mdash; Home Services</a></li>' +
        '</ul></li>' +
        '<li><a href="/portfolio"' + cls('portfolio') + '>' + t('portfolio') + '</a></li>' +
        '<li><a href="/contact"' + cls('contact') + '>' + t('contact') + '</a></li>' +
        '</ul>';

    // Language toggle
    if (showLang) {
        html += '<button class="lang-toggle" id="langToggle" aria-label="Switch language">' +
            (currentLang === 'en' ? 'ES' : 'EN') + '</button>';
    }

    // Theme toggle (portfolio)
    if (showTheme) {
        html += '<button id="theme-toggle" class="theme-btn" aria-label="Toggle Theme">' +
            '<svg class="sun-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/>' +
            '</svg>' +
            '<svg class="moon-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>' +
            '</svg></button>';
    }

    // Hamburger
    html += '<button class="hamburger" id="menuToggle" aria-label="Toggle menu">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>' +
        '</button></div></div></nav>';

    root.innerHTML = html;

    // ── Hamburger toggle ──
    var menuToggle = document.getElementById('menuToggle');
    var navLinks = root.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        var hamburgerSvg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
        var closeSvg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

        menuToggle.addEventListener('click', function () {
            var isOpen = navLinks.classList.toggle('open');
            menuToggle.innerHTML = isOpen ? closeSvg : hamburgerSvg;
        });

        navLinks.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                navLinks.classList.remove('open');
                menuToggle.innerHTML = hamburgerSvg;
            });
        });
    }

    // ── Public API for i18n integration ──
    window.cushlabsNav = {
        updateLanguage: function (lang) {
            currentLang = lang;
            // Update nav text
            var trigger = root.querySelector('.dropdown-trigger');
            if (trigger) {
                trigger.innerHTML = t('demos') +
                    ' <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';
            }
            var portfolioLink = root.querySelector('a[href="/portfolio"]');
            if (portfolioLink) portfolioLink.textContent = t('portfolio');
            var contactLink = root.querySelector('a[href="/contact"]');
            if (contactLink) contactLink.textContent = t('contact');
            // Update lang toggle text
            var langBtn = document.getElementById('langToggle');
            if (langBtn) langBtn.textContent = lang === 'en' ? 'ES' : 'EN';
        }
    };
})();
