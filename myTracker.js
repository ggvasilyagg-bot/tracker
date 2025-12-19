// myTracker.js
// Простой трекер для сбора пользовательских событий

const MyTracker = (function() {
    // Конфигурация
    const config = {
        endpoint: '', // Вставьте сюда ваш URL с Webhook.site
        debug: false,
        trackClicks: true,
        trackScroll: true,
        trackForms: true
    };

    // Генератор уникальных ID
    function generateId() {
        return Math.random().toString(36).substr(2, 9) + 
               Date.now().toString(36);
    }

    // Получение данных о пользователе
    function getUserData() {
        return {
            user_agent: navigator.userAgent,
            screen_resolution: `${screen.width}x${screen.height}`,
            viewport_size: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer || 'direct'
        };
    }

    // Создание объекта события
    function createEvent(eventType, eventTarget, additionalData = {}) {
        const baseEvent = {
            event_id: generateId(),
            event_type: eventType,
            event_target: eventTarget,
            page_url: window.location.href,
            page_title: document.title,
            timestamp: new Date().toISOString(),
            ...getUserData()
        };

        return { ...baseEvent, ...additionalData };
    }

    // Отправка события на сервер
    function sendEvent(eventData) {
        if (!config.endpoint) {
            console.error('MyTracker: Не указан endpoint!');
            return;
        }

        // Используем navigator.sendBeacon для более надежной отправки
        // при закрытии страницы
        const data = JSON.stringify(eventData);
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon(config.endpoint, data);
        } else {
            // Fallback на fetch
            fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: data,
                keepalive: true // Позволяет отправлять запрос даже после закрытия страницы
            }).catch(error => {
                if (config.debug) {
                    console.warn('MyTracker: Ошибка отправки:', error);
                }
            });
        }

        // Логирование в консоль в режиме отладки
        if (config.debug) {
            console.log('MyTracker: Событие отправлено:', eventData);
            console.table([eventData]);
        }
    }

    // Отслеживание кликов
    function trackClicks() {
        document.addEventListener('click', function(event) {
            const target = event.target;
            
            // Игнорируем частые клики (например, при выделении текста)
            if (event.detail > 3) return;

            // Определяем, что было кликнуто
            let targetIdentifier = '';
            if (target.id) {
                targetIdentifier = `#${target.id}`;
            } else if (target.className && typeof target.className === 'string') {
                targetIdentifier = `.${target.className.split(' ')[0]}`;
            } else {
                targetIdentifier = target.tagName.toLowerCase();
            }

            const clickEvent = createEvent('click', targetIdentifier, {
                element_text: target.textContent?.substring(0, 100) || '',
                element_tag: target.tagName.toLowerCase(),
                mouse_x: event.clientX,
                mouse_y: event.clientY
            });

            sendEvent(clickEvent);
        }, { capture: true });
    }

    // Отслеживание скролла (достижение секций)
    function trackScroll() {
        const sections = document.querySelectorAll('.section');
        const viewedSections = new Set();

        function checkScroll() {
            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                // Если видно больше 50% секции
                const isVisible = (
                    rect.top <= window.innerHeight * 0.5 &&
                    rect.bottom >= window.innerHeight * 0.5
                );

                if (isVisible && !viewedSections.has(section.id)) {
                    viewedSections.add(section.id);
                    
                    const scrollEvent = createEvent('scroll_view', `#${section.id}`, {
                        section_id: section.id,
                        section_title: section.querySelector('h2')?.textContent || 'Без названия',
                        scroll_percentage: Math.round(
                            (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
                        )
                    });

                    sendEvent(scrollEvent);
                }
            });
        }

        // Дебаунсинг для оптимизации
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(checkScroll, 200);
        });

        // Проверяем при загрузке
        setTimeout(checkScroll, 1000);
    }

    // Отслеживание отправки форм
    function trackForms() {
        document.addEventListener('submit', function(event) {
            event.preventDefault(); // Останавливаем отправку для теста
            
            const form = event.target;
            const formData = new FormData(form);
            const formValues = {};
            
            formData.forEach((value, key) => {
                formValues[key] = value;
            });

            const formEvent = createEvent('form_submit', `#${form.id || 'unknown-form'}`, {
                form_id: form.id || 'unknown',
                form_values: formValues,
                form_fields_count: form.elements.length
            });

            sendEvent(formEvent);
            
            // Показываем сообщение об успехе
            alert('Спасибо! Данные формы отправлены в аналитику (но не на сервер). Проверьте Webhook.site!');
            
            // Сбрасываем форму
            form.reset();
        });
    }

    // Отслеживание изменения вкладки (видимость страницы)
    function trackVisibility() {
        document.addEventListener('visibilitychange', function() {
            const visibilityEvent = createEvent('page_visibility', document.visibilityState, {
                visibility_state: document.visibilityState,
                time_on_page: performance.now() // Время на странице в мс
            });
            
            sendEvent(visibilityEvent);
        });
    }

    // Инициализация трекера
    function init(userConfig = {}) {
        // Обновляем конфигурацию
        Object.assign(config, userConfig);

        if (!config.endpoint) {
            console.error('MyTracker: Пожалуйста, укажите endpoint в конфигурации!');
            console.error('MyTracker: Получите endpoint на https://webhook.site');
            return;
        }

        console.log('MyTracker: Инициализация...', config);

        // Отправляем событие о загрузке страницы
        const pageviewEvent = createEvent('pageview', window.location.pathname, {
            load_time: performance.timing.loadEventEnd - performance.timing.navigationStart
        });
        sendEvent(pageviewEvent);

        // Включаем отслеживание
        if (config.trackClicks) trackClicks();
        if (config.trackScroll) trackScroll();
        if (config.trackForms) trackForms();
        
        trackVisibility();

        console.log('MyTracker: Запущен и отслеживает события');
    }

    // Публичные методы
    return {
        init,
        // Ручная отправка кастомных событий
        track: function(eventName, eventData = {}) {
            const customEvent = createEvent('custom_' + eventName, 'manual', eventData);
            sendEvent(customEvent);
        }
    };
})();

// Экспортируем для использования в других скриптах
if (typeof window !== 'undefined') {
    window.MyTracker = MyTracker;
}
