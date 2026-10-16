export function renderWebApp(botUsername, tmdbKey) {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>فیلمیار | Cinema Mini App</title>
    
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            fontFamily: { sans: ['Vazirmatn', 'system-ui', 'sans-serif'] },
            colors: {
              brand: {
                50: '#fff1f2',
                500: '#e50914',
                600: '#b80710',
                glow: 'rgba(229, 9, 20, 0.35)'
              },
              dark: {
                950: '#070709',
                900: '#0d0d12',
                800: '#14141b',
                700: '#1d1d26',
                border: 'rgba(255, 255, 255, 0.08)'
              }
            },
            boxShadow: {
              'glow': '0 0 25px -5px rgba(229, 9, 20, 0.4)',
              'sheet': '0 -20px 40px -15px rgba(0,0,0,0.8)'
            }
          }
        }
      }
    </script>

    <style>
      * { -webkit-tap-highlight-color: transparent; }
      body { background-color: #070709; color: #f4f4f5; overscroll-behavior-y: contain; }
      .hide-scroll::-webkit-scrollbar { display: none; }
      .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      .glass-header {
        background: rgba(13, 13, 18, 0.82);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }
      .glass-nav {
        background: rgba(15, 15, 22, 0.88);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .shimmer {
        background: linear-gradient(90deg, #14141b 0%, #1d1d26 50%, #14141b 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite linear;
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    </style>
</head>
<body class="selection:bg-brand-500 selection:text-white font-sans antialiased text-sm pb-28">

    <!-- Top App Bar -->
    <header class="fixed top-0 inset-x-0 z-40 glass-header border-b border-dark-border px-4 h-14 flex items-center justify-between transition-all">
        <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-red-500 flex items-center justify-center shadow-glow">
                <span class="text-sm font-black text-white">F</span>
            </div>
            <div>
                <h1 class="font-black text-base tracking-tight text-white leading-tight">فیلمیار</h1>
                <p class="text-[9px] text-zinc-400 font-medium">مرجع سینمای روز</p>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <button onclick="triggerHaptic('light'); switchView('search')" class="p-2 rounded-xl bg-dark-800 border border-dark-border text-zinc-300 active:scale-95 transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>
            <button id="btn-user-auth" onclick="handleAuthButtonClick()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 border border-dark-border text-xs text-zinc-300 hover:text-white active:scale-95 transition-all">
                <span id="user-avatar-badge">👤</span>
                <span id="user-name-badge" class="font-bold">ورود</span>
            </button>
            <button onclick="clearCacheApp()" class="p-2 rounded-xl bg-dark-800 border border-dark-border text-zinc-400 hover:text-white active:scale-95 transition-all" title="پاکسازی کش">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
        </div>
    </header>

    <!-- Standalone Universal Login Modal -->
    <div id="auth-modal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 hidden flex items-center justify-center p-4">
        <div class="bg-dark-900 border border-dark-border rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div class="w-14 h-14 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
                ✈️
            </div>
            <div>
                <h3 class="text-base font-black text-white">ورود سریع با تلگرام</h3>
                <p class="text-xs text-zinc-400 mt-1 leading-relaxed">روی دکمه زیر بزنید تا ربات تلگرام باز شود و ورود شما به وب‌اپلیکیشن به صورت امن تأیید گردد.</p>
            </div>
            
            <div class="py-2 space-y-3">
                <a id="btn-tg-direct-link" href="#" target="_blank" class="w-full py-3.5 px-4 rounded-2xl bg-[#229ED9] hover:bg-[#1E88E5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-glow active:scale-95 transition-all">
                    <span>🚀</span>
                    <span>ورود مستقیم از طریق ربات تلگرام</span>
                </a>
                <div id="auth-polling-status" class="hidden flex items-center justify-center gap-2 text-[11px] text-zinc-400">
                    <div class="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>در انتظار تأیید شما در تلگرام...</span>
                </div>
            </div>

            <button onclick="closeAuthModal()" class="w-full py-2.5 rounded-xl bg-dark-800 border border-dark-border text-xs text-zinc-400 hover:text-white transition-colors">
                انصراف و ادامه به عنوان مهمان
            </button>
        </div>
    </div>

    <!-- Content Wrap -->
    <main class="pt-16">
        
        <!-- View: Home -->
        <div id="view-home" class="space-y-6">
            
            <!-- Hero Spotlight -->
            <section class="relative mx-3 rounded-3xl overflow-hidden bg-dark-800 border border-dark-border aspect-[16/10] sm:aspect-[21/9] shadow-2xl group cursor-pointer" onclick="openHeroMovie()">
                <img id="hero-img" class="w-full h-full object-cover transition-opacity duration-700 opacity-0 scale-105 group-hover:scale-100 transition-transform">
                <div class="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-transparent"></div>
                <div class="absolute bottom-4 inset-x-4 space-y-2 z-10">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-lg bg-brand-500/20 text-brand-500 border border-brand-500/30 text-[10px] font-bold uppercase tracking-wider">🔥 برگزیده هفته</span>
                        <span id="hero-badge" class="text-[10px] text-zinc-300 font-bold"></span>
                    </div>
                    <h2 id="hero-title" class="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-md">در حال بارگذاری...</h2>
                    <p id="hero-meta" class="text-xs text-zinc-300 flex items-center gap-2 font-medium"></p>
                </div>
            </section>

            <!-- Top 10 Today -->
            <section class="space-y-3 px-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-white tracking-wide">🏆 ۱۰ عنوان برتر امروز</h3>
                        <p class="text-[10px] text-zinc-400">محبوب‌ترین عناوین از نگاه کاربران</p>
                    </div>
                </div>
                <div id="slider-top10" class="flex gap-3 overflow-x-auto hide-scroll pb-2 snap-x"></div>
            </section>

            <!-- Trending Media -->
            <section class="space-y-3 px-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-white tracking-wide">🔥 داغ‌ترین‌های هفته</h3>
                        <p class="text-[10px] text-zinc-400">بیشترین بازدید در روزهای اخیر</p>
                    </div>
                    <button onclick="switchView('movies')" class="text-xs font-bold text-brand-500 active:underline">بیشتر ❯</button>
                </div>
                <div id="slider-trending" class="flex gap-3 overflow-x-auto hide-scroll pb-2 snap-x"></div>
            </section>

            <!-- Random Discovery -->
            <section class="space-y-3 px-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-white tracking-wide">🎲 کشف اتفاقی</h3>
                        <p class="text-[10px] text-zinc-400">یک پیشنهاد شانسی برای گذران وقت</p>
                    </div>
                    <button onclick="loadHomeSliders()" class="text-xs font-medium text-zinc-400 flex items-center gap-1 active:text-white">
                        <span>تازه‌سازی</span> ⟳
                    </button>
                </div>
                <div id="slider-random" class="flex gap-3 overflow-x-auto hide-scroll pb-2 snap-x"></div>
            </section>
        </div>

        <!-- View: Grid List (Used for Movies, Series, Favorites & Search) -->
        <div id="view-grid" class="hidden px-4 space-y-4">
            
            <!-- Search Bar -->
            <div id="search-container" class="hidden relative">
                <div class="relative flex items-center">
                    <input type="text" id="searchInput" oninput="onSearchInput(this.value)" placeholder="نام فیلم یا سریال را بنویسید..." class="w-full bg-dark-800 border border-dark-border rounded-2xl py-3 px-4 pr-11 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500/50 transition-colors shadow-inner">
                    <div class="absolute right-3.5 text-zinc-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <button id="search-clear" onclick="clearSearchInput()" class="hidden absolute left-3 p-1 rounded-full bg-dark-700 text-zinc-400">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between border-b border-dark-border pb-2">
                <h2 id="grid-title" class="text-sm font-black text-white tracking-wide">عناوین</h2>
                <span id="grid-count" class="text-[10px] text-zinc-500 font-medium"></span>
            </div>

            <div id="grid-container" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"></div>

            <div id="grid-loader" class="hidden justify-center py-8">
                <div class="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            
            <div id="grid-sentinel" class="h-10"></div>
        </div>
    </main>

    <!-- Bottom Navigation Bar -->
    <div class="fixed bottom-0 inset-x-0 z-40 p-3 pointer-events-none safe-bottom">
        <nav class="glass-nav rounded-3xl p-1.5 flex items-center justify-around pointer-events-auto max-w-md mx-auto shadow-2xl">
            <button onclick="triggerHaptic('selection'); switchView('home')" id="nav-home" class="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-2xl text-brand-500 transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span class="text-[10px] font-bold">خانه</span>
            </button>
            <button onclick="triggerHaptic('selection'); switchView('movies')" id="nav-movies" class="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-2xl text-zinc-400 transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
                <span class="text-[10px] font-bold">فیلم‌ها</span>
            </button>
            <button onclick="triggerHaptic('selection'); switchView('series')" id="nav-series" class="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-2xl text-zinc-400 transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
                <span class="text-[10px] font-bold">سریال‌ها</span>
            </button>
            <button onclick="triggerHaptic('selection'); switchView('favs')" id="nav-favs" class="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-2xl text-zinc-400 transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                <span class="text-[10px] font-bold">لیست من</span>
            </button>
            <button onclick="triggerHaptic('selection'); switchView('search')" id="nav-search" class="flex flex-col items-center gap-1 flex-1 py-1.5 rounded-2xl text-zinc-400 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <span class="text-[10px] font-bold">جستجو</span>
            </button>
        </nav>
    </div>

    <!-- Details Modal Bottom Sheet -->
    <div id="modal-backdrop-bg" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden opacity-0 transition-opacity duration-300" onclick="closeModal()"></div>
    
    <div id="bottom-sheet" class="fixed inset-x-0 bottom-0 z-50 bg-dark-900 border-t border-dark-border rounded-t-3xl max-h-[92vh] flex flex-col transform translate-y-full transition-transform duration-300 ease-out shadow-sheet overflow-hidden">
        
        <div class="h-1.5 w-12 bg-zinc-700 rounded-full mx-auto my-3 flex-shrink-0"></div>
        <button onclick="closeModal()" class="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-zinc-300 active:scale-90">✕</button>

        <div class="overflow-y-auto hide-scroll flex-1 pb-16">
            <div class="relative w-full aspect-video bg-dark-800 overflow-hidden">
                <img id="modal-img-backdrop" class="w-full h-full object-cover opacity-0 transition-opacity duration-500">
                <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/40 to-transparent"></div>
            </div>

            <div class="px-5 -mt-12 relative z-10 space-y-4">
                <div>
                    <h2 id="modal-title" class="text-2xl font-black text-white leading-tight">در حال بارگذاری...</h2>
                    <div id="modal-meta-badges" class="flex flex-wrap items-center gap-2 mt-2 text-xs text-zinc-400 font-medium"></div>
                </div>

                <div class="flex items-center gap-3">
                    <button onclick="triggerHaptic('medium'); requestInTelegram()" class="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-glow active:scale-98 transition-transform">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
                        <span>دریافت سریع در تلگرام</span>
                    </button>
                    <button id="btn-fav-toggle" onclick="toggleBookmarkModal()" class="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-border flex items-center justify-center text-zinc-400 active:scale-90 transition-transform">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                    </button>
                </div>

                <div class="flex border-b border-dark-border gap-6 pt-2">
                    <button id="modal-tab-desc" onclick="switchModalTab('desc')" class="pb-2.5 text-xs font-bold text-brand-500 border-b-2 border-brand-500 transition-colors">داستان و عوامل</button>
                    <button id="modal-tab-dl" onclick="switchModalTab('dl')" class="pb-2.5 text-xs font-semibold text-zinc-400 transition-colors">📥 لینک‌های مستقیم دانلود</button>
                </div>

                <div id="modal-content-desc" class="space-y-3 pt-1">
                    <p id="modal-plot" class="text-xs text-zinc-300 leading-relaxed font-light"></p>
                    <div id="modal-cast-container" class="text-xs text-zinc-400"></div>
                </div>

                <div id="modal-content-dl" class="hidden space-y-4 pt-2">
                    <div id="modal-dl-loading" class="flex flex-col items-center justify-center py-12 gap-3">
                        <div class="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-xs text-zinc-400 font-medium">در حال واکشی لینک‌های پرسرعت...</p>
                    </div>

                    <div id="dl-version-container" class="hidden">
                        <div class="text-[11px] font-bold text-zinc-400 mb-2">انتخاب نسخه صوتی / ترجمه:</div>
                        <div id="dl-version-pills" class="flex gap-2 overflow-x-auto hide-scroll pb-1"></div>
                    </div>

                    <div id="dl-season-container" class="hidden">
                        <div class="text-[11px] font-bold text-zinc-400 mb-2">انتخاب فصل:</div>
                        <div id="dl-season-pills" class="flex gap-2 overflow-x-auto hide-scroll pb-1"></div>
                    </div>

                    <div id="dl-quality-container" class="hidden">
                        <div class="text-[11px] font-bold text-zinc-400 mb-2">انتخاب کیفیت:</div>
                        <div id="dl-quality-pills" class="flex gap-2 overflow-x-auto hide-scroll pb-1"></div>
                    </div>

                    <div id="modal-dl-tree" class="space-y-2.5 pb-6"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- In-App Floating Toast -->
    <div id="app-toast" class="fixed top-5 inset-x-0 mx-auto w-max max-w-[85vw] px-4 py-2.5 rounded-2xl bg-dark-700/90 text-white text-xs border border-white/10 shadow-2xl backdrop-blur-md z-[100] transform -translate-y-20 opacity-0 transition-all duration-300 flex items-center gap-2 pointer-events-none">
        <span id="toast-icon">ℹ️</span>
        <span id="toast-text"></span>
    </div>

    <script>
        const tg = window.Telegram?.WebApp;
        if (tg && tg.initData) {
            tg.ready();
            tg.expand();
            tg.enableClosingConfirmation();
        }

        const tmdbApiKey = '${tmdbKey}';
        const botName = '${botUsername}';

        let currentTab = 'home';
        let currentPage = 1;
        let isFetching = false;
        let endReached = false;
        let searchTimer = null;
        let activeQuery = '';
        let heroItem = null;
        let selectedMovie = { id: null, title: '', year: '', rating: '', type: 'movie' };
        let bookmarkedSet = new Set();

        let currentUser = null;
        try {
            currentUser = JSON.parse(localStorage.getItem('filmyar_user') || 'null');
        } catch(e) {}

        if (tg?.initDataUnsafe?.user) {
            currentUser = {
                id: tg.initDataUnsafe.user.id,
                first_name: tg.initDataUnsafe.user.first_name,
                username: tg.initDataUnsafe.user.username,
                photo_url: tg.initDataUnsafe.user.photo_url
            };
            localStorage.setItem('filmyar_user', JSON.stringify(currentUser));
        }

        let userId = currentUser?.id || '';

        const TMDB_MEM_CACHE = {
            get: (key) => {
                try { return JSON.parse(localStorage.getItem('tmdb_' + key)); } catch(e) { return null; }
            },
            set: (key, val) => {
                try { localStorage.setItem('tmdb_' + key, JSON.stringify({ ...(TMDB_MEM_CACHE.get(key) || {}), ...val })); } catch(e) {}
            }
        };

        function renderAuthBadge() {
            const avatarBadge = document.getElementById('user-avatar-badge');
            const nameBadge = document.getElementById('user-name-badge');
            if (currentUser) {
                avatarBadge.innerHTML = currentUser.photo_url ? \`<img src="\${currentUser.photo_url}" class="w-4 h-4 rounded-full inline-block object-cover">\` : '👤';
                nameBadge.innerText = currentUser.first_name ? currentUser.first_name.substring(0, 10) : 'کاربر';
            } else {
                avatarBadge.innerText = '👤';
                nameBadge.innerText = 'ورود';
            }
        }

        function handleAuthButtonClick() {
            triggerHaptic('light');
            if (currentUser && !tg?.initData) {
                if (confirm('آیا می‌خواهید از حساب تلگرام خارج شوید؟')) {
                    localStorage.removeItem('filmyar_user');
                    currentUser = null;
                    userId = '';
                    renderAuthBadge();
                    showToast('با موفقیت خارج شدید', '👋');
                }
            } else if (!currentUser) {
                openAuthModal();
            }
        }

        let authPollTimer = null;

        async function openAuthModal() {
            const modal = document.getElementById('auth-modal');
            const directBtn = document.getElementById('btn-tg-direct-link');
            const pollStatus = document.getElementById('auth-polling-status');
            modal.classList.remove('hidden');

            try {
                const res = await fetch('/api/auth/init', { method: 'POST' });
                const data = await res.json();
                if (data.ok) {
                    directBtn.href = data.botUrl;
                    directBtn.onclick = () => {
                        pollStatus.classList.remove('hidden');
                        startAuthPolling(data.sessionId);
                    };
                }
            } catch(e) {
                showToast('خطا در شروع اتصال به ربات', '❌');
            }
        }

        function closeAuthModal() {
            document.getElementById('auth-modal').classList.add('hidden');
            document.getElementById('auth-polling-status').classList.add('hidden');
            clearInterval(authPollTimer);
        }

        function startAuthPolling(sessionId) {
            clearInterval(authPollTimer);
            authPollTimer = setInterval(async () => {
                try {
                    const res = await fetch(\`/api/auth/check?id=\${sessionId}\`);
                    const data = await res.json();
                    if (data.ok && data.approved && data.user) {
                        clearInterval(authPollTimer);
                        currentUser = data.user;
                        userId = data.user.id;
                        localStorage.setItem('filmyar_user', JSON.stringify(data.user));
                        renderAuthBadge();
                        closeAuthModal();
                        showToast(\`خوش آمدید، \${data.user.first_name}!\`, '🎉');
                    }
                } catch(e) {}
            }, 1800);
        }

        function triggerHaptic(type = 'light') {
            try {
                if (!tg?.HapticFeedback) return;
                if (type === 'light') tg.HapticFeedback.impactOccurred('light');
                else if (type === 'medium') tg.HapticFeedback.impactOccurred('medium');
                else if (type === 'selection') tg.HapticFeedback.selectionChanged();
                else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
            } catch(e) {}
        }

        function showToast(text, icon = '✨') {
            const toast = document.getElementById('app-toast');
            document.getElementById('toast-icon').innerText = icon;
            document.getElementById('toast-text').innerText = text;
            toast.classList.remove('-translate-y-20', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('-translate-y-20', 'opacity-0');
            }, 2600);
        }

        function switchView(tab) {
            currentTab = tab;
            document.querySelectorAll('nav button').forEach(b => {
                b.classList.remove('text-brand-500');
                b.classList.add('text-zinc-400');
            });
            const activeBtn = document.getElementById('nav-' + tab);
            if (activeBtn) {
                activeBtn.classList.remove('text-zinc-400');
                activeBtn.classList.add('text-brand-500');
            }

            document.getElementById('view-home').style.display = 'none';
            document.getElementById('view-grid').style.display = 'none';
            document.getElementById('search-container').style.display = 'none';

            if (tab === 'home') {
                document.getElementById('view-home').style.display = 'block';
            } else if (tab === 'search') {
                document.getElementById('view-grid').style.display = 'block';
                document.getElementById('search-container').style.display = 'block';
                document.getElementById('grid-title').innerText = 'جستجو در آرشیو';
                document.getElementById('grid-count').innerText = '';
                resetGrid();
                document.getElementById('searchInput').focus();
            } else {
                document.getElementById('view-grid').style.display = 'block';
                const titles = { 'movies': 'فیلم‌های سینمایی', 'series': 'مجموعه‌های تلویزیونی', 'favs': 'لیست علاقه‌مندی‌ها' };
                document.getElementById('grid-title').innerText = titles[tab] || 'عناوین';
                resetGrid();
                loadGridNextPage();
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        async function loadHomeSliders() {
            try {
                const trRes = await fetch('/api/trending?page=1');
                const trData = await trRes.json();
                
                if (Array.isArray(trData) && trData.length > 0) {
                    heroItem = trData[0];
                    renderHero(heroItem);

                    const top10 = document.getElementById('slider-top10');
                    top10.innerHTML = '';
                    trData.slice(0, 10).forEach((m, i) => top10.appendChild(createNumberedCard(m, i + 1)));

                    const trending = document.getElementById('slider-trending');
                    trending.innerHTML = '';
                    trData.slice(0, 12).forEach(m => trending.appendChild(createPosterCard(m, true)));
                }

                const rndRes = await fetch('/api/random');
                const rndData = await rndRes.json();
                const rndContainer = document.getElementById('slider-random');
                rndContainer.innerHTML = '';
                if (Array.isArray(rndData)) {
                    rndData.forEach(m => rndContainer.appendChild(createPosterCard(m, true)));
                }
            } catch (err) {
                console.error("Home slider load error", err);
            }
        }

        function renderHero(m) {
            const title = m[3] || m[2];
            document.getElementById('hero-title').innerText = title;
            document.getElementById('hero-badge').innerText = m[1] === 'movie' ? 'سینمایی' : 'سریال';
            document.getElementById('hero-meta').innerText = \`⭐️ \${m[5]} • \${m[4]}\`;
            loadTMDbBackdrop(m[0], document.getElementById('hero-img'));
        }

        function openHeroMovie() {
            if (!heroItem) return;
            openModal(heroItem[0], heroItem[3] || heroItem[2], heroItem[4], heroItem[5], heroItem[1]);
        }

        function createNumberedCard(m, rank) {
            const card = document.createElement('div');
            card.className = 'flex-none flex items-end cursor-pointer snap-start';
            card.onclick = () => openModal(m[0], m[3] || m[2], m[4], m[5], m[1]);

            card.innerHTML = \`
                <span class="text-6xl font-black text-dark-700 leading-none -mr-4 z-10 select-none">\${rank}</span>
                <div class="w-32 aspect-[2/3] rounded-2xl overflow-hidden bg-dark-800 border border-dark-border relative group shadow-md">
                    <img class="w-full h-full object-cover opacity-0 transition-opacity duration-300" data-imdb="\${m[0]}">
                    <div class="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
                    <div class="absolute bottom-2 inset-x-2">
                        <p class="text-xs font-bold text-white truncate">\${m[3] || m[2]}</p>
                        <span class="text-[9px] text-amber-400 font-bold">★ \${m[5]}</span>
                    </div>
                </div>
            \`;
            loadTMDbPoster(m[0], card.querySelector('img'));
            return card;
        }

        function createPosterCard(m, isCarousel = false) {
            const card = document.createElement('div');
            card.className = \`relative rounded-2xl overflow-hidden aspect-[2/3] bg-dark-800 border border-dark-border cursor-pointer snap-start group shadow-md \${isCarousel ? 'w-32 flex-none' : 'w-full'}\`;
            card.onclick = () => openModal(m[0], m[3] || m[2], m[4], m[5], m[1]);

            card.innerHTML = \`
                <img class="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-105 transition-transform duration-500" data-imdb="\${m[0]}">
                <div class="absolute inset-0 bg-gradient-to-t from-dark-950/90 via-dark-950/20 to-transparent"></div>
                <div class="absolute top-2 right-2 bg-dark-900/80 backdrop-blur-md px-1.5 py-0.5 rounded-lg text-[9px] font-bold text-amber-400 border border-white/10">
                    ★ \${m[5]}
                </div>
                <div class="absolute bottom-2.5 inset-x-2.5">
                    <h4 class="text-xs font-bold text-white truncate">\${m[3] || m[2]}</h4>
                    <p class="text-[9px] text-zinc-400 mt-0.5 font-medium">\${m[4]} • \${m[1] === 'movie' ? 'فیلم' : 'سریال'}</p>
                </div>
            \`;
            loadTMDbPoster(m[0], card.querySelector('img'));
            return card;
        }

        async function loadTMDbPoster(imdbId, imgEl) {
            try {
                const cached = TMDB_MEM_CACHE.get(imdbId);
                let path = cached?.poster;
                if (!path) {
                    const res = await fetch(\`https://api.themoviedb.org/3/find/\${imdbId}?api_key=\${tmdbApiKey}&external_source=imdb_id\`);
                    const data = await res.json();
                    path = data.movie_results?.[0]?.poster_path || data.tv_results?.[0]?.poster_path;
                    if (path) TMDB_MEM_CACHE.set(imdbId, { poster: path });
                }
                if (path) {
                    imgEl.src = 'https://image.tmdb.org/t/p/w342' + path;
                    imgEl.onload = () => imgEl.classList.remove('opacity-0');
                }
            } catch(e) {}
        }

        async function loadTMDbBackdrop(imdbId, imgEl) {
            try {
                const cached = TMDB_MEM_CACHE.get(imdbId);
                let path = cached?.backdrop;
                if (!path) {
                    const res = await fetch(\`https://api.themoviedb.org/3/find/\${imdbId}?api_key=\${tmdbApiKey}&external_source=imdb_id\`);
                    const data = await res.json();
                    path = data.movie_results?.[0]?.backdrop_path || data.tv_results?.[0]?.backdrop_path;
                    if (path) TMDB_MEM_CACHE.set(imdbId, { backdrop: path });
                }
                if (path) {
                    imgEl.src = 'https://image.tmdb.org/t/p/w780' + path;
                    imgEl.onload = () => imgEl.classList.add('opacity-100');
                }
            } catch(e) {}
        }

        function onSearchInput(val) {
            const query = val.trim();
            const clearBtn = document.getElementById('search-clear');
            if (query.length > 0) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');

            clearTimeout(searchTimer);
            if (query.length < 2) return;
            activeQuery = query;
            searchTimer = setTimeout(() => {
                resetGrid();
                loadGridNextPage();
            }, 450);
        }

        function clearSearchInput() {
            document.getElementById('searchInput').value = '';
            document.getElementById('search-clear').classList.add('hidden');
            resetGrid();
        }

        function resetGrid() {
            currentPage = 1;
            endReached = false;
            document.getElementById('grid-container').innerHTML = '';
        }

        async function loadGridNextPage() {
            if (isFetching || endReached) return;
            isFetching = true;

            const loader = document.getElementById('grid-loader');
            loader.style.display = 'flex';

            let endpoint = currentTab;
            let params = \`?page=\${currentPage}\`;

            if (currentTab === 'search') {
                endpoint = 'search';
                params += \`&q=\${encodeURIComponent(activeQuery)}\`;
            } else if (currentTab === 'favs') {
                if (!userId) {
                    isFetching = false;
                    loader.style.display = 'none';
                    document.getElementById('grid-container').innerHTML = \`
                        <div class="col-span-full text-center py-12 space-y-3">
                            <div class="text-3xl">📌</div>
                            <h3 class="text-xs font-bold text-white">لیست علاقه‌مندی‌ها</h3>
                            <p class="text-[11px] text-zinc-400">برای مشاهده و مدیریت فیلم‌های نشان‌شده وارد شوید.</p>
                            <button onclick="openAuthModal()" class="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-glow">
                                <span>🚀</span>
                                <span>ورود با تلگرام</span>
                            </button>
                        </div>
                    \`;
                    return;
                }
                params += \`&uid=\${userId}\`;
            }

            try {
                const res = await fetch(\`/api/\${endpoint}\${params}\`);
                const items = await res.json();
                const container = document.getElementById('grid-container');

                if (!Array.isArray(items) || items.length === 0) {
                    endReached = true;
                    if (currentPage === 1) {
                        container.innerHTML = \`<div class="col-span-full text-center text-zinc-500 py-12 text-xs font-medium">موردی یافت نشد.</div>\`;
                    }
                } else {
                    items.forEach(m => container.appendChild(createPosterCard(m, false)));
                    currentPage++;
                }
            } catch (e) {
                console.error("Grid fetch failed", e);
            }

            isFetching = false;
            loader.style.display = 'none';
        }

        const sentinelObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && currentTab !== 'home') {
                loadGridNextPage();
            }
        }, { rootMargin: '300px' });
        sentinelObserver.observe(document.getElementById('grid-sentinel'));

        async function openModal(imdbId, title, year, rating, type) {
            triggerHaptic('light');
            selectedMovie = { id: imdbId, title, year, rating, type };

            if (userId) {
                fetch(\`/api/history_add?uid=\${userId}&mid=\${imdbId}\`).catch(() => {});
            }

            const bg = document.getElementById('modal-backdrop-bg');
            const sheet = document.getElementById('bottom-sheet');
            
            bg.classList.remove('hidden');
            setTimeout(() => bg.classList.add('opacity-100'), 10);
            setTimeout(() => sheet.classList.remove('translate-y-full'), 30);

            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-meta-badges').innerHTML = \`
                <span class="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20 font-bold">★ \${rating}</span>
                <span class="px-2 py-0.5 rounded-md bg-dark-800 border border-dark-border text-zinc-300">\${year}</span>
                <span class="px-2 py-0.5 rounded-md bg-dark-800 border border-dark-border text-zinc-300">\${type === 'movie' ? '🎬 سینمایی' : '📺 مجموعه سریالی'}</span>
            \`;

            document.getElementById('modal-plot').innerHTML = '<div class="h-4 bg-dark-800 rounded shimmer mb-2 w-5/6"></div><div class="h-4 bg-dark-800 rounded shimmer w-full"></div>';
            document.getElementById('modal-cast-container').innerHTML = '';

            loadTMDbBackdrop(imdbId, document.getElementById('modal-img-backdrop'));
            switchModalTab('desc');
            updateBookmarkIcon();

            try {
                const cached = TMDB_MEM_CACHE.get(imdbId);
                if (cached?.plot) {
                    document.getElementById('modal-plot').innerText = cached.plot;
                    if (cached.cast) document.getElementById('modal-cast-container').innerText = '👥 ستارگان: ' + cached.cast;
                } else {
                    const findRes = await fetch(\`https://api.themoviedb.org/3/find/\${imdbId}?api_key=\${tmdbApiKey}&external_source=imdb_id&language=fa-IR\`);
                    const findData = await findRes.json();
                    const item = findData.movie_results?.[0] || findData.tv_results?.[0];
                    if (item) {
                        const plot = item.overview || 'خلاصه داستان ثبت نشده است.';
                        document.getElementById('modal-plot').innerText = plot;

                        const castRes = await fetch(\`https://api.themoviedb.org/3/\${type === 'movie' ? 'movie' : 'tv'}/\${item.id}?api_key=\${tmdbApiKey}&append_to_response=credits&language=fa-IR\`);
                        const castData = await castRes.json();
                        const cast = castData.credits?.cast?.slice(0, 4).map(c => c.name).join('، ') || '';
                        if (cast) document.getElementById('modal-cast-container').innerText = '👥 ستارگان: ' + cast;
                        TMDB_MEM_CACHE.set(imdbId, { plot, cast });
                    }
                }
            } catch(e) {}
        }

        function closeModal() {
            triggerHaptic('light');
            const bg = document.getElementById('modal-backdrop-bg');
            const sheet = document.getElementById('bottom-sheet');
            sheet.classList.add('translate-y-full');
            bg.classList.remove('opacity-100');
            setTimeout(() => bg.classList.add('hidden'), 300);
        }

        function switchModalTab(tab) {
            triggerHaptic('selection');
            const tabDesc = document.getElementById('modal-tab-desc');
            const tabDl = document.getElementById('modal-tab-dl');
            const contentDesc = document.getElementById('modal-content-desc');
            const contentDl = document.getElementById('modal-content-dl');

            if (tab === 'desc') {
                tabDesc.className = 'pb-2.5 text-xs font-bold text-brand-500 border-b-2 border-brand-500 transition-colors';
                tabDl.className = 'pb-2.5 text-xs font-semibold text-zinc-400 transition-colors';
                contentDesc.classList.remove('hidden');
                contentDl.classList.add('hidden');
            } else {
                tabDl.className = 'pb-2.5 text-xs font-bold text-brand-500 border-b-2 border-brand-500 transition-colors';
                tabDesc.className = 'pb-2.5 text-xs font-semibold text-zinc-400 transition-colors';
                contentDl.classList.remove('hidden');
                contentDesc.classList.add('hidden');
                loadDownloadTree(selectedMovie.id);
            }
        }

        let activeDlItem = null;
        let activeDlVersion = null;
        let activeDlSeason = null;
        let activeDlQualityIdx = 0;

        async function loadDownloadTree(imdbId) {
            const loader = document.getElementById('modal-dl-loading');
            const tree = document.getElementById('modal-dl-tree');
            const vContainer = document.getElementById('dl-version-container');
            const sContainer = document.getElementById('dl-season-container');
            const qContainer = document.getElementById('dl-quality-container');

            loader.style.display = 'flex';
            tree.innerHTML = '';
            vContainer.classList.add('hidden');
            sContainer.classList.add('hidden');
            qContainer.classList.add('hidden');

            try {
                const res = await fetch('/api/get?id=' + imdbId);
                const data = await res.json();
                activeDlItem = data;
                renderDownloadController(data);
            } catch(e) {
                tree.innerHTML = '<div class="text-center text-zinc-500 py-10 text-xs font-medium">خطا در دریافت اطلاعات سرور دانلود.</div>';
            }
            loader.style.display = 'none';
        }

        function renderDownloadController(item) {
            const tree = document.getElementById('modal-dl-tree');
            const vContainer = document.getElementById('dl-version-container');
            const sContainer = document.getElementById('dl-season-container');
            const qContainer = document.getElementById('dl-quality-container');

            if (!item || !item[7] || Object.keys(item[7]).length === 0) {
                renderEmptyDownloadState(item);
                return;
            }

            const links = item[7];
            const versions = Object.keys(links);

            if (versions.length === 0) {
                renderEmptyDownloadState(item);
                return;
            }

            activeDlVersion = versions[0];
            vContainer.classList.remove('hidden');

            const versionMeta = {
                '1': { label: '📝 زیرنویس فارسی', short: 'زیرنویس' },
                '2': { label: '🎙 دوبله فارسی', short: 'دوبله' },
                '3': { label: '🎬 اورجینال (زبان اصلی)', short: 'اورجینال' }
            };

            const vPills = document.getElementById('dl-version-pills');
            vPills.innerHTML = '';
            versions.forEach(v => {
                const btn = document.createElement('button');
                btn.id = 'v-pill-' + v;
                btn.onclick = () => selectDlVersion(v);
                btn.className = \`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 \${
                    v === activeDlVersion ? 'bg-brand-500 text-white shadow-glow' : 'bg-dark-800 text-zinc-400 border border-dark-border'
                }\`;
                btn.innerText = versionMeta[v]?.label || 'نسخه ' + v;
                vPills.appendChild(btn);
            });

            renderActiveVersionContent();
        }

        function selectDlVersion(ver) {
            triggerHaptic('selection');
            activeDlVersion = ver;
            document.querySelectorAll('#dl-version-pills button').forEach(b => {
                b.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-dark-800 text-zinc-400 border border-dark-border';
            });
            const activeBtn = document.getElementById('v-pill-' + ver);
            if (activeBtn) activeBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-brand-500 text-white shadow-glow';
            
            renderActiveVersionContent();
        }

        function renderActiveVersionContent() {
            if (!activeDlItem) return;
            const type = activeDlItem[1];
            const versionData = activeDlItem[7]?.[activeDlVersion];
            const sContainer = document.getElementById('dl-season-container');
            const qContainer = document.getElementById('dl-quality-container');
            const tree = document.getElementById('modal-dl-tree');

            tree.innerHTML = '';

            if (type === 'movie') {
                sContainer.classList.add('hidden');
                qContainer.classList.add('hidden');
                renderMovieQualityCards(versionData || []);
            } else {
                sContainer.classList.remove('hidden');
                renderSeriesController(versionData || {});
            }
        }

        function renderMovieQualityCards(qualities) {
            const tree = document.getElementById('modal-dl-tree');
            if (!Array.isArray(qualities) || qualities.length === 0) {
                tree.innerHTML = '<div class="text-center text-zinc-500 py-8 text-xs font-medium">لینکی برای این نسخه ثبت نشده است.</div>';
                return;
            }

            qualities.forEach(q => {
                const card = document.createElement('div');
                card.className = "p-3.5 rounded-2xl bg-dark-800 border border-dark-border hover:border-zinc-700 transition-all flex items-center justify-between gap-3 shadow-md";

                const is4K = q.quality.includes('2160p') || q.quality.includes('4K');
                const is1080 = q.quality.includes('1080p');
                const badgeColor = is4K ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : (is1080 ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'bg-zinc-700/30 text-zinc-300 border-zinc-600/30');

                card.innerHTML = \`
                    <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded-lg text-[10px] font-black border \${badgeColor}">\${q.quality.split(' ')[0]}</span>
                            <span class="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-xs">\${q.quality}</span>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                            <span>⚖️ حجم: \${q.size || 'نیم‌بها'}</span>
                            <span>•</span>
                            <span class="text-emerald-400">لینک مستقیم سرور</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button onclick="copyDlLink('\${q.file}', this)" class="p-2.5 rounded-xl bg-dark-700/80 border border-dark-border text-zinc-300 hover:text-white active:scale-95 transition-all" title="کپی لینک">
                            📋
                        </button>
                        <a href="\${q.file}" target="_blank" download class="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-glow active:scale-95 transition-all">
                            <span>📥</span>
                            <span>دانلود</span>
                        </a>
                    </div>
                \`;
                tree.appendChild(card);
            });
        }

        function renderSeriesController(seasonsObj) {
            const seasons = Object.keys(seasonsObj);
            const sPills = document.getElementById('dl-season-pills');

            if (seasons.length === 0) {
                document.getElementById('modal-dl-tree').innerHTML = '<div class="text-center text-zinc-500 py-8 text-xs font-medium">فصلی برای این نسخه یافت نشد.</div>';
                return;
            }

            activeDlSeason = seasons[0];
            sPills.innerHTML = '';

            seasons.forEach(s => {
                const btn = document.createElement('button');
                btn.id = 's-pill-' + s;
                btn.onclick = () => selectDlSeason(s, seasonsObj);
                btn.className = \`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 \${
                    s === activeDlSeason ? 'bg-zinc-200 text-dark-950 font-black' : 'bg-dark-800 text-zinc-400 border border-dark-border'
                }\`;
                btn.innerText = '📁 فصل ' + s;
                sPills.appendChild(btn);
            });

            renderSeriesSeasonQualities(seasonsObj[activeDlSeason]);
        }

        function selectDlSeason(seasonNum, seasonsObj) {
            triggerHaptic('selection');
            activeDlSeason = seasonNum;
            document.querySelectorAll('#dl-season-pills button').forEach(b => {
                b.className = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-dark-800 text-zinc-400 border border-dark-border';
            });
            const activeBtn = document.getElementById('s-pill-' + seasonNum);
            if (activeBtn) activeBtn.className = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-zinc-200 text-dark-950 font-black';

            renderSeriesSeasonQualities(seasonsObj[seasonNum]);
        }

        function renderSeriesSeasonQualities(qualityList) {
            const qContainer = document.getElementById('dl-quality-container');
            const qPills = document.getElementById('dl-quality-pills');
            const tree = document.getElementById('modal-dl-tree');

            if (!Array.isArray(qualityList) || qualityList.length === 0) {
                qContainer.classList.add('hidden');
                tree.innerHTML = '<div class="text-center text-zinc-500 py-8 text-xs font-medium">کیفیتی برای این فصل یافت نشد.</div>';
                return;
            }

            qContainer.classList.remove('hidden');
            activeDlQualityIdx = 0;
            qPills.innerHTML = '';

            qualityList.forEach((q, idx) => {
                const epTotal = q.episodes ? q.episodes.length : (q.number_of_episodes || 'چند');
                const btn = document.createElement('button');
                btn.id = 'q-pill-' + idx;
                btn.onclick = () => selectDlQuality(idx, qualityList);
                btn.className = \`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 \${
                    idx === activeDlQualityIdx ? 'bg-brand-500 text-white shadow-glow' : 'bg-dark-800 text-zinc-400 border border-dark-border'
                }\`;
                btn.innerText = \`\${q.quality} (\${epTotal} قسمت)\`;
                qPills.appendChild(btn);
            });

            renderSeriesEpisodes(qualityList[0]);
        }

        function selectDlQuality(idx, qualityList) {
            triggerHaptic('selection');
            activeDlQualityIdx = idx;
            document.querySelectorAll('#dl-quality-pills button').forEach(b => {
                b.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-dark-800 text-zinc-400 border border-dark-border';
            });
            const activeBtn = document.getElementById('q-pill-' + idx);
            if (activeBtn) activeBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 bg-brand-500 text-white shadow-glow';

            renderSeriesEpisodes(qualityList[idx]);
        }

        function renderSeriesEpisodes(qualityObj) {
            const tree = document.getElementById('modal-dl-tree');
            tree.innerHTML = '';

            if (!qualityObj || !qualityObj.episodes || qualityObj.episodes.length === 0) {
                tree.innerHTML = \`
                    <div class="p-4 rounded-2xl bg-dark-800 border border-dark-border text-center space-y-2">
                        <p class="text-xs text-zinc-400">قسمت‌های این کیفیت به صورت پوشه‌ای سازماندهی شده‌اند.</p>
                        <a href="\${qualityObj.folder}" class="inline-flex px-4 py-2 rounded-xl bg-brand-500 text-white font-bold text-xs shadow-glow">
                            مشاهده در ربات تلگرام
                        </a>
                    </div>
                \`;
                return;
            }

            const grid = document.createElement('div');
            grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-2";

            qualityObj.episodes.forEach((ep, idx) => {
                const epNum = String(idx + 1).padStart(2, '0');
                const row = document.createElement('div');
                row.className = "p-2.5 rounded-xl bg-dark-800 border border-dark-border flex items-center justify-between gap-2";

                row.innerHTML = \`
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-8 h-8 rounded-lg bg-dark-700 border border-dark-border flex items-center justify-center font-black text-xs text-brand-500 shrink-0">\${epNum}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-white truncate ltr text-left">\${ep.name}</p>
                            <span class="text-[10px] text-zinc-400">\${ep.size || 'نیم‌بها'}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="copyDlLink('\${ep.url}', this)" class="p-2 rounded-lg bg-dark-700 text-zinc-300 active:scale-95" title="کپی">📋</button>
                        <a href="\${ep.url}" target="_blank" download class="p-2 rounded-lg bg-brand-500 text-white font-bold active:scale-95 text-xs flex items-center gap-1" title="دانلود">
                            <span>📥</span>
                        </a>
                    </div>
                \`;
                grid.appendChild(row);
            });

            tree.appendChild(grid);
        }

        function renderEmptyDownloadState(item) {
            const tree = document.getElementById('modal-dl-tree');
            const title = item ? (item[3] || item[2]) : 'عنوان';
            const year = item ? (item[4] || '') : '';
            const searchGoogleUrl = \`https://www.google.com/search?q=\${encodeURIComponent('دانلود فیلم ' + title + ' ' + year + ' با لینک مستقیم')}\`;

            tree.innerHTML = \`
                <div class="p-5 rounded-2xl bg-dark-800 border border-dark-border text-center space-y-3">
                    <div class="text-3xl">📭</div>
                    <h4 class="text-xs font-bold text-white">لینک مستقیمی برای این عنوان ثبت نشده است</h4>
                    <p class="text-[11px] text-zinc-400 leading-relaxed font-light">این عنوان در دیتابیس بین‌المللی IMDb ثبت شده است. در صورت تمایل می‌توانید فایل‌های آن را در وب جستجو کنید.</p>
                    <div class="pt-1">
                        <a href="\${searchGoogleUrl}" target="_blank" class="w-full py-2.5 px-4 rounded-xl bg-dark-700 hover:bg-dark-600 border border-dark-border text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                            <span>🔍</span>
                            <span>جستجوی لینک مستقیم در گوگل</span>
                        </a>
                    </div>
                </div>
            \`;
        }

        function copyDlLink(url, btnElement) {
            triggerHaptic('medium');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
            } else {
                const el = document.createElement('textarea');
                el.value = url;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            }

            if (btnElement) {
                const originalText = btnElement.innerHTML;
                btnElement.innerHTML = '✓';
                btnElement.classList.add('text-emerald-400', 'bg-emerald-500/20');
                setTimeout(() => {
                    btnElement.innerHTML = originalText;
                    btnElement.classList.remove('text-emerald-400', 'bg-emerald-500/20');
                }, 1800);
            }

            showToast('لینک مستقیم کپی شد', '📋');
        }

        async function toggleBookmarkModal() {
            if (!userId) {
                showToast('برای ذخیره در لیست علاقه‌مندی‌ها وارد شوید', '🔒');
                openAuthModal();
                return;
            }
            triggerHaptic('medium');
            const mid = selectedMovie.id;
            try {
                const res = await fetch(\`/api/fav_toggle?uid=\${userId}&mid=\${mid}\`);
                const data = await res.json();
                if (data.status === 'added') {
                    bookmarkedSet.add(mid);
                    showToast('به لیست علاقه‌مندی‌ها اضافه شد', '❤️');
                } else {
                    bookmarkedSet.delete(mid);
                    showToast('از لیست حذف شد', '🗑');
                }
                updateBookmarkIcon();
            } catch(e) {}
        }

        function updateBookmarkIcon() {
            const btn = document.getElementById('btn-fav-toggle');
            const isSaved = bookmarkedSet.has(selectedMovie.id);
            btn.innerHTML = isSaved
                ? '<svg class="w-5 h-5 text-brand-500 fill-current" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>'
                : '<svg class="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>';
        }

        function requestInTelegram() {
            if (!selectedMovie.id) return;
            triggerHaptic('medium');
            tg.openTelegramLink(\`https://t.me/\${botName}?start=\${selectedMovie.id}\`);
        }

        function clearCacheApp() {
            triggerHaptic('medium');
            localStorage.clear();
            showToast('حافظه کش پاک شد', '🧹');
        }

        renderAuthBadge();
        loadHomeSliders();
    </script>
</body>
</html>`;
}