/* ============================================================================
   i18n: UA <-> EN switcher.
   Базова мова інтерфейсу — українська. В EN-режимі всі українські тексти
   (статичні та динамічні) перекладаються "на льоту" через словник + MutationObserver,
   а при поверненні на UA відновлюються оригінали.
   ============================================================================ */
(function () {
    'use strict';

    const CYR = "А-ЯІЇЄҐа-яіїєґ'’";
    const CYR_TEST = /[А-ЯІЇЄҐа-яіїєґ]/;
    const ATTRS = ['title', 'placeholder', 'aria-label'];
    const STORAGE_KEY = 'marsLang';

    // [українською, англійською]
    const PAIRS = [
        // ---------- Верхня панель ----------
        ['КРИТИЧНО: Маршрут близько до небезпеки!', 'CRITICAL: Route is close to a hazard!'],
        ['КРИТИЧНО', 'CRITICAL'],
        ['Маршрут синхронізовано з PostgreSQL', 'Route synced with PostgreSQL'],
        ['КРИТИЧНО: ПИЛОВА БУРЯ НА КУРСІ РОВЕРА!', 'CRITICAL: DUST STORM ON ROVER COURSE!'],
        ['Шторм перетинає розрахований шлях. Ризик втрати енергії та пошкодження.', 'The storm crosses the calculated path. Risk of power loss and damage.'],
        ['перетинає розрахований шлях ровера', 'crosses the rover\'s calculated path'],
        ['дистанція до ядра:', 'distance to core:'],
        ['Вітер', 'Wind'],
        ['ПОКАЗАТИ БУРЮ', 'SHOW STORM'],
        ['Приховати сповіщення', 'Hide alert'],
        ['Оберіть зону Марса...', 'Select a Mars zone...'],
        ['Особистий акаунт (Синхронізація через PostgreSQL)', 'Personal account (PostgreSQL sync)'],
        ['ВХІД / АКАУНТ', 'SIGN IN / ACCOUNT'],
        ['Екстрене перенаправлення з точки A до найближчої безпечної зони', 'Emergency reroute from point A to the nearest safe zone'],
        ['Увімкнути/вимкнути відображення небезпечних зон', 'Show/hide hazard zones'],
        ['Увімкнути/вимкнути відображення безпечних зон', 'Show/hide safe zones'],
        ['Увімкнути/вимкнути відображення марсіанських баз', 'Show/hide Martian bases'],
        ['Увімкнути/вимкнути відображення пилових бур', 'Show/hide dust storms'],
        ['Показати активну пилову бурю на мапі', 'Show the active dust storm on the map'],
        ['Враховувати зони в алгоритмі прокладання A*', 'Take zones into account in the A* pathfinding'],
        ['НЕБЕЗПЕКИ', 'HAZARDS'],
        ['БЕЗПЕЧНІ', 'SAFE'],
        ['БАЗИ', 'BASES'],
        ['БУРІ', 'STORMS'],
        ['ПОКАЗАНО', 'SHOWN'],
        ['ПРИХОВАНО', 'HIDDEN'],
        ['ЗНАЙТИ БУРЮ', 'FIND STORM'],
        ['A* ОБМЕЖЕННЯ', 'A* CONSTRAINTS'],
        ['УВІМК', 'ON'],
        ['ВИМК', 'OFF'],
        ['Згорнути/розгорнути панель', 'Collapse/expand panel'],
        ['Закрити панель', 'Close panel'],
        ['Закрити', 'Close'],

        // ---------- Вейпоінти (Waypoints як у Waze) ----------
        ['ДОДАТИ ВЕЙПОІНТ', 'ADD WAYPOINT'],
        ['ВЕЙПОІНТ', 'WAYPOINT'],
        ['Вейпоінт', 'Waypoint'],
        ['РЕВЕРС', 'REVERSE'],
        ['РЕВЕРС МАРШРУТУ', 'REVERSE ROUTE'],
        ['Додати вейпоінт (проміжну точку зупинки)', 'Add waypoint (intermediate stop)'],
        ['Поміняти місцями старт та фініш', 'Swap start and finish'],
        ['Видалити точку', 'Delete point'],
        ['Вгору', 'Up'],
        ['Вниз', 'Down'],
        ['Клікніть на мапі для вибору вейпоінта...', 'Click map to place waypoint...'],
        ['Клікніть на мапі для розміщення позначки...', 'Click map to place alert...'],
        ['ПОЧАТИ НАВІГАЦІЮ (WAZE)', 'START NAVIGATION (WAZE)'],
        ['ПОЧАТИ НАВІГАЦІЮ', 'START NAVIGATION'],
        ['ЗУПИНИТИ НАВІГАЦІЮ', 'STOP NAVIGATION'],
        ['Зупинити навігацію', 'Stop navigation'],
        ['ЗАЛИШИЛОСЯ', 'REMAINING'],
        ['ЧАС (ETA)', 'TIME (ETA)'],
        ['Рухайтесь до Точки', 'Proceed to Point'],
        ['Рухайтесь до', 'Proceed to'],

        // ---------- Космічний радіочат космонавтів ----------
        ['РАДІОЧАТ', 'RADIO CHAT'],
        ['КОСМІЧНИЙ РАДІОЧАТ', 'SPACE RADIO CHAT'],
        ['РАДІОЧАТ КОСМОНАВТІВ', 'ASTRONAUT RADIO CHAT'],
        ['Космічний радіочат космонавтів (як у Waze)', 'Astronaut space radio chat (like in Waze)'],
        ['Відкрити космічний радіочат космонавтів', 'Open astronaut radio chat'],
        ['Згорнути радіочат', 'Collapse radio chat'],
        ['В ЕФІРІ:', 'ON AIR:'],
        ['Повідомлення на 142.8 MHz...', 'Message on 142.8 MHz...'],
        ['Надіслати в ефір', 'Send to air'],
        ['Прикріпити поточні координати', 'Attach current coordinates'],
        ['SOS! Потрібна термінова допомога!', 'SOS! Urgent assistance needed!'],
        ['Увага! Помічено пилову бурю по курсу!', 'Warning! Dust storm spotted on course!'],
        ['Маршрут перевірено, проїзд вільний.', 'Route checked, clear passage.'],
        ['Виявлено поклади водяного льоду.', 'Water ice deposits detected.'],
        ['Схованка з киснем оновлена.', 'Oxygen cache updated.'],
        ['Чисто', 'Clear'],
        ['Буря', 'Storm'],
        ['Лід', 'Ice'],
        ['Схованка', 'Cache'],

        // ---------- Позначки Waze Alerts на карті ----------
        ['ПОЗНАЧИТИ', 'REPORT'],
        ['Поставити позначку на мапі (як у Waze)', 'Place an alert on map (like in Waze)'],
        ['Позначити подію на карті (як у Waze)', 'Mark event on map (like in Waze)'],
        ['ПОЗНАЧКИ: ПОКАЗАНО', 'ALERTS: SHOWN'],
        ['ПОЗНАЧКИ: ПРИХОВАНО', 'ALERTS: HIDDEN'],
        ['ПОЗНАЧКИ', 'ALERTS'],
        ['Увімкнути/вимкнути позначки космонавтів', 'Show/hide astronaut alerts'],
        ['ПОЗНАЧИТИ НА КАРТІ', 'MARK ON MAP'],
        ['Позначте подію або ресурс на карті для інших космонавтів. Всі повідомлення транслюються у космічний радіочат.', 'Mark an event or resource on the map for other astronauts. All alerts broadcast to the space radio chat.'],
        ['Тип позначки:', 'Alert type:'],
        ['Короткий заголовок:', 'Short title:'],
        ['Опис або порада колегам:', 'Description or tip for crew:'],
        ['Локація позначки:', 'Alert location:'],
        ['Поточна Точка A (Ровер)', 'Current Point A (Rover)'],
        ['Обрати кліком на мапі', 'Pick by clicking map'],
        ['Позивний космонавта:', 'Astronaut callsign:'],
        ['ОПУБЛІКУВАТИ ПОЗНАЧКУ', 'PUBLISH ALERT'],
        ['Зламаний ровер', 'Broken rover'],
        ['Лід / Вода', 'Ice / Water'],
        ['Схованка O₂', 'O₂ Cache'],
        ['Заблоковано', 'Blocked'],
        ['Артефакт', 'Landmark'],
        ['SOS Маяк', 'SOS Beacon'],
        ['Координати:', 'Coordinates:'],
        ['Підтвердити', 'Confirm'],
        ['Підтверджено', 'Confirmed'],
        ['Додати як вейпоінт', 'Add as waypoint'],
        ['Показати на карті', 'Show on map'],
        ['Поділитись у чат', 'Share in chat'],

        // ---------- Планувальник маршруту ----------
        ['Алгоритм прокладає шлях, оминаючи', 'The algorithm plots a path avoiding'],
        ['небезпечні зони', 'hazard zones'],
        ['та надаючи перевагу', 'and preferring'],
        ['безпечним рівнинам', 'safe plains'],
        ['. Клікніть на мапі для вибору точок A та B.', '. Click the map to choose points A and B.'],
        ['СТАРТ', 'START'],
        ['ФІНІШ', 'FINISH'],
        ['Клікніть на мапі...', 'Click on the map...'],
        ['РОЗРАХУВАТИ ШЛЯХ', 'CALCULATE ROUTE'],
        ['ПІДТВЕРДИТИ', 'CONFIRM'],
        ['СКИНУТИ', 'RESET'],
        ['SOS: ДО НАЙБЛИЖЧОЇ БЕЗПЕЧНОЇ ЗОНИ', 'SOS: TO NEAREST SAFE ZONE'],
        ['Перенаправити маршрут з точки A до найближчої безпечної зони', 'Reroute from point A to the nearest safe zone'],
        ['Сканування...', 'Scanning...'],

        // ---------- Звіт маршруту ----------
        ['БЕЗПЕЧНИЙ МАРШРУТ', 'SAFE ROUTE'],
        ['ШВИДКИЙ МАРШРУТ', 'FAST ROUTE'],
        ['БЕЗПЕЧНИЙ', 'SAFE'],
        ['ШВИДКИЙ', 'FAST'],
        ['ДИСТАНЦІЯ', 'DISTANCE'],
        ['МАКС. НАХИЛ', 'MAX SLOPE'],
        ['НАБІР / СПУСК', 'ASCENT / DESCENT'],
        ['БЕЗПЕКА', 'SAFETY'],
        ['ЧАС МАРШРУТУ', 'ROUTE TIME'],
        ['×2 У НЕБЕЗПЕЦІ', '×2 IN DANGER'],
        ['Швидкість:', 'Speed:'],
        ['Без затримок у небезпечних зонах (×1)', 'No delays in hazard zones (×1)'],
        ['Звичайний:', 'Normal:'],
        ['Небезпека:', 'Hazard:'],
        ['⏱ ТАЙМЕР МАРШРУТУ', '⏱ ROUTE TIMER'],
        ['ТАЙМЕР МАРШРУТУ', 'ROUTE TIMER'],
        ['×1 ШТАТНО', '×1 NORMAL'],
        ['×2 НЕБЕЗПЕЧНА ЗОНА', '×2 HAZARD ZONE'],
        ['Готовий до старту', 'Ready to start'],
        ['Маршрут завершено', 'Route complete'],
        ['Штатний рух', 'Normal travel'],
        ['Небезпечна зона', 'Hazard zone'],
        ['Активна пилова буря', 'Active dust storm'],
        ['ПАУЗА', 'PAUSE'],
        ['СТАРТ', 'START'],
        ['ЗАНОВО', 'RESTART'],
        ['СПОЧАТКУ', 'FROM START'],
        ['Точка B', 'Point B'],
        ['ПРИПАСИ НА МАРШРУТ', 'ROUTE SUPPLIES'],
        ['Кількість членів екіпажу', 'Crew size'],
        ['Екіпаж:', 'Crew:'],
        ['ЇЖА (СУБЛІПАЙКИ)', 'FOOD (RATIONS)'],
        ['ЇЖА', 'FOOD'],
        ['Калорійність:', 'Calories:'],
        ['Субліпайки:', 'Rations:'],
        ['КИСЕНЬ', 'OXYGEN'],
        ['БЕНЗИН', 'FUEL'],
        ['ВОДА (ОКРЕМО)', 'WATER (SEPARATE)'],
        ['Питна:', 'Drinking:'],
        ['Технічна/охолодження:', 'Technical/cooling:'],
        ['База 0.35 л/км + підйом', 'Base 0.35 L/km + climb'],
        ['База + підйом + небезпека', 'Base + climb + hazard'],
        ['Врахувати +15% аварійного запасу', 'Include +15% emergency reserve'],
        ['МІН:', 'MIN:'],
        ['МАКС:', 'MAX:'],
        ['ПЕРЕПАД:', 'CHANGE:'],
        ['ЧАС:', 'TIME:'],
        ['ПРОФІЛЬ ВИСОТ', 'ELEVATION PROFILE'],
        ['БЕЗП.', 'SAFE'],
        ['ШВИД.', 'FAST'],
        ['ВИСОТА:', 'ELEVATION:'],

        // ---------- Діагностика маршруту ----------
        ['ОБХІД ЗОН ВИМКНЕНО', 'ZONE AVOIDANCE OFF'],
        ['маршрут оптимізовано лише за рельєфом', 'route optimized for terrain only'],
        ['Макс. нахил', 'Max slope'],
        ['небезпечні зони та рухомі бурі оминуто', 'hazard zones and moving storms avoided'],
        ['подовження до ортодромії', 'detour vs. great circle'],
        ['УВАГА', 'WARNING'],
        ['маршрут перетинає рухому пилову бурю', 'route crosses a moving dust storm'],
        ['Час у небезпеці ×2', 'Time in danger ×2'],
        ['повний обхід неможливий', 'full avoidance impossible'],
        ['траверс небезпечних зон', 'hazard-zone traverse'],
        ['час у зоні ×2', 'time in zone ×2'],
        ['мінімальні витрати без обходу зон', 'minimum cost, zones not avoided'],
        ['у небезпечних зонах', 'in hazard zones'],
        ['SOS ПЕРЕНАПРАВЛЕННЯ', 'SOS REROUTE'],

        // ---------- SOS / бази / фокус ----------
        ['Спочатку встановіть Точку A (ровер) на мапі або оберіть базу!', 'First place Point A (rover) on the map or choose a base!'],
        ['Не вдалося знайти безпечну зону!', 'Could not find a safe zone!'],
        ['Ровер у зоні', 'Rover is in zone'],
        ['Курс до притулку', 'Heading to shelter'],
        ['SOS ЕВАКУАЦІЯ', 'SOS EVACUATION'],
        ['Перенаправлено до', 'Rerouted to'],
        ['БАЗА:', 'BASE:'],
        ['ФОКУС:', 'FOCUS:'],

        // ---------- Шари зон ----------
        ['ШАРИ ЗОН ТА ВІДОБРАЖЕННЯ', 'ZONE LAYERS & DISPLAY'],
        ['ЗОН', 'ZONES'],
        ['НЕБЕЗПЕЧНІ ЗОНИ', 'HAZARD ZONES'],
        ['Каньйони, кальдери, урвища, хаоси', 'Canyons, calderas, escarpments, chaos'],
        ['БЕЗПЕЧНІ РІВНИНИ', 'SAFE PLAINS'],
        ['Базальтові низовини, дна озер', 'Basalt lowlands, lake beds'],
        ['МАРСІАНСЬКІ БАЗИ', 'MARTIAN BASES'],
        ['Опорні станції, укриття, маяки', 'Support stations, shelters, beacons'],
        ['НЕБЕЗПЕЧНІ', 'HAZARDOUS'],
        ['ВСІ', 'ALL'],
        ['Швидкий фільтр зони або бази...', 'Quick filter for zone or base...'],
        ['Баз не знайдено', 'No bases found'],
        ['Зон не знайдено', 'No zones found'],
        ['ШВИДКІ ТЕСТИ МАРШРУТІВ:', 'QUICK ROUTE TESTS:'],
        ['Траверс каньйонів Долини Марінера', 'Valles Marineris canyon traverse'],
        ['З рівнини Амазонія до вулкану Олімп', 'From Amazonis Planitia to Olympus Mons'],
        ['З озера Єзеро до рівнини Ісіди', 'From Jezero to Isidis Planitia'],
        ['Шлях через низовину до рівнини Елізій', 'Across the lowland to Elysium Planitia'],
        ['Через Лабіринт Ночі до Копратес', 'Through Noctis Labyrinthus to Coprates'],
        ['🌐 Через край мапи (Елізій ↔ Амазонія)', '🌐 Across the map edge (Elysium ↔ Amazonis)'],

        // ---------- Перемикач 2D/3D ----------
        ['Перемкнути на 3D карту', 'Switch to 3D map'],
        ['Перемкнути на 2D карту', 'Switch to 2D map'],
        ['3D МОДЕЛЬ', '3D MODEL'],
        ['2D КАРТА', '2D MAP'],

        // ---------- Картка зони ----------
        ['Зображення зони', 'Zone image'],
        ['Назва зони', 'Zone name'],
        ['Тип місцевості:', 'Terrain type:'],
        ['Підземний лід:', 'Subsurface ice:'],
        ['Поточна погода:', 'Current weather:'],
        ['Місцевий час:', 'Local time:'],
        ['Температура:', 'Temperature:'],
        ["Піщаний / Кам'янистий", 'Sandy / Rocky'],
        ["Кам'янистий / Скелястий каньйон", 'Rocky / Cliff canyon'],
        ['Піщаний / Базальтова рівнина', 'Sandy / Basalt plain'],
        ['Присутній (глибина ~1.2м)', 'Present (depth ~1.2 m)'],
        ['Присутній', 'Present'],
        ['Ні', 'No'],
        ['Ясно, пиловий серпанок', 'Clear, dusty haze'],
        ['Ясно, легкий пиловий серпанок', 'Clear, light dusty haze'],
        ['сильне затемнення', 'heavy darkening'],
        ['ШТОРМ:', 'STORM:'],

        // ---------- Акаунт ----------
        ['ОСОБИСТИЙ КАБІНЕТ', 'PERSONAL CABINET'],
        ['Вхід', 'Sign-in is'],
        ["необов'язковий", 'optional'],
        ['. Ви можете розраховувати маршрути вільно без реєстрації.', '. You can plan routes freely without registering.'],
        ['Створіть акаунт, щоб зберегти 2 точки маршруту в базу даних PostgreSQL на Railway і синхронізувати їх між пристроями.', 'Create an account to save 2 route points to the PostgreSQL database on Railway and sync them between devices.'],
        ['ВХІД', 'SIGN IN'],
        ['РЕЄСТРАЦІЯ', 'REGISTER'],
        ['Логін ровера:', 'Rover login:'],
        ['Наприклад, curiosity_rover', 'E.g. curiosity_rover'],
        ['Пароль:', 'Password:'],
        ['Введіть пароль', 'Enter password'],
        ['УВІЙТИ В АКАУНТ', 'SIGN IN'],
        ['СТВОРИТИ АКАУНТ', 'CREATE ACCOUNT'],
        ['ОБРОБКА...', 'PROCESSING...'],
        ['🟢 POSTGRESQL СИНХРОНІЗОВАНО', '🟢 POSTGRESQL SYNCED'],
        ['РОСТЕР // АСТРОНАВТ', 'ROSTER // ASTRONAUT'],
        ['РОСТЕР //', 'ROSTER //'],
        ['Вхід виконано. Ваші точки маршруту автоматично записуються в базу даних PostgreSQL.', 'Signed in. Your route points are automatically saved to the PostgreSQL database.'],
        ['СТАТУС БАЗИ:', 'DATABASE STATUS:'],
        ['Підключено до PostgreSQL', 'Connected to PostgreSQL'],
        ['ТОЧКА A (СТАРТ):', 'POINT A (START):'],
        ['ТОЧКА B (ФІНІШ):', 'POINT B (FINISH):'],
        ['Не встановлено', 'Not set'],
        ['💾 ЗБЕРЕГТИ ТОЧКИ В POSTGRESQL', '💾 SAVE POINTS TO POSTGRESQL'],
        ['📥 ЗАВАНТАЖИТИ З БАЗИ ДАНИХ', '📥 LOAD FROM DATABASE'],
        ['🚪 ВИЙТИ З АКАУНТУ', '🚪 SIGN OUT'],
        ['Маршрут збережено в PostgreSQL', 'Route saved to PostgreSQL'],
        ['Маршрут завантажено з PostgreSQL', 'Route loaded from PostgreSQL'],
        ['В акаунті ще немає збережених точок', 'No saved points in the account yet'],
        ['Помилка завантаження даних', 'Data loading error'],
        ['Помилка зв’язку з базою даних', 'Database connection error'],
        ['Сесія завершилась, увійдіть знову', 'Session expired, please sign in again'],
        ['Ви вийшли з акаунту', 'You have signed out'],
        ['Логін та пароль мають містити щонайменше 3 символи', 'Login and password must contain at least 3 characters'],
        ['Помилка авторизації', 'Authorization error'],
        ['Помилка підключення до сервера БД', 'Database server connection error'],
        ['Акаунт успішно створено в PostgreSQL!', 'Account successfully created in PostgreSQL!'],
        ['Вхід успішний! Завантажено збережений маршрут.', 'Signed in! Saved route loaded.'],
        ['Вхід успішний! Поточні точки збережено.', 'Signed in! Current points saved.'],
        ['Вхід успішний!', 'Signed in!'],
        ['Потрібна авторизація', 'Authorization required'],
        ['Сесія недійсна, увійдіть знову', 'Session is invalid, please sign in again'],
        ['Користувач із таким логіном уже зареєстрований', 'A user with this login is already registered'],
        ['Невірний логін або пароль', 'Invalid login or password'],
        ['Логін та пароль є обов’язковими', 'Login and password are required'],
        ['Логін або пароль занадто довгі', 'Login or password is too long'],
        ['Помилка бази даних на сервері', 'Server database error'],
        ['Немає доступу до чужого акаунту', 'No access to another account'],
        ['Не вдалося зберегти маршрут', 'Failed to save route'],
        ['Помилка зчитування з бази даних', 'Database read error'],
        ['Користувача не знайдено', 'User not found'],

        // ---------- alert() ----------
        ['Оберіть Точку А (старт) та Точку В (фініш) на мапі!', 'Select Point A (start) and Point B (finish) on the map!'],
        ['Спочатку оберіть хоча б одну точку на мапі!', 'First select at least one point on the map!'],
        ['Оберіть Точку А (старт) та Точку В (фініш) на мапі для побудови маршруту в обхід бурі!', 'Select Point A (start) and Point B (finish) on the map to build a storm-avoiding route!'],

        // ---------- Бурі ----------
        ['🌪️ ТОРНАДО / ПИЛОВИЙ ВИХОР (MRO/MARCI)', '🌪️ TORNADO / DUST DEVIL (MRO/MARCI)'],
        ['ЕПІЦЕНТР:', 'EPICENTER:'],
        ['ШВИДКІСТЬ ВІТРУ:', 'WIND SPEED:'],
        ['ОПТИЧНА НЕПРОЗОРІСТЬ:', 'OPTICAL DEPTH:'],
        ['ШВИДКІСТЬ ДРЕЙФУ:', 'DRIFT SPEED:'],
        ['КУРС ЗМІЩЕННЯ:', 'DRIFT HEADING:'],
        ['Пиловий шторм', 'Dust storm'],
        ['Торнадо на Марсі', 'Tornado on Mars'],
        ['ЯДРО', 'CORE'],

        // ---------- Бази ----------
        ['База «Єзеро-Персеверанс»', 'Jezero–Perseverance Base'],
        ['Станція «Гейл-К’юріосіті»', 'Gale–Curiosity Station'],
        ['Колонія «Хриса-Вікінг»', 'Chryse–Viking Colony'],
        ['Аванпост «Арес-Ацидалія»', 'Ares–Acidalia Outpost'],
        ['Льодова база «Аркадія»', 'Arcadia Ice Base'],
        ['Станція «Утопія-Чжужун»', 'Utopia–Zhurong Station'],
        ['База «Амазонія-Вест»', 'Amazonis West Base'],
        ['Станція «Елізій-ІнСайт»', 'Elysium–InSight Station'],
        ['Аванпост «Ісіда-Горизонт»', 'Isidis–Horizon Outpost'],
        ['Станція «Меридіан-Оппортьюніті»', 'Meridiani–Opportunity Station'],
        ['Аванпост «Гесперія»', 'Hesperia Outpost'],
        ['Глибока база «Еллада»', 'Hellas Deep Base'],
        ['Станція «Вастітас-Північ»', 'Vastitas North Station'],
        ['Релей-база «Касій»', 'Casius Relay Base'],
        ['ЄЗЕРО', 'JEZERO'], ['ГЕЙЛ', 'GALE'], ['ХРИСА', 'CHRYSE'], ['АЦИДАЛІЯ', 'ACIDALIA'],
        ['АРКАДІЯ', 'ARCADIA'], ['УТОПІЯ', 'UTOPIA'], ['АМАЗОНІЯ', 'AMAZONIS'], ['ЕЛІЗІЙ', 'ELYSIUM'],
        ['ІСІДА', 'ISIDIS'], ['МЕРИДІАН', 'MERIDIANI'], ['ГЕСПЕРІЯ', 'HESPERIA'], ['ЕЛЛАДА', 'HELLAS'],
        ['ВАСТІТАС', 'VASTITAS'], ['КАСІЙ', 'CASIUS'],
        ['Дослідницький хаб', 'Research hub'],
        ['Гірничо-наукова база', 'Mining & science base'],
        ['Головний космопорт', 'Main spaceport'],
        ['Енерговузол', 'Power node'],
        ['Водовидобувний комплекс', 'Water extraction complex'],
        ['Підповерхневий бункер', 'Subsurface bunker'],
        ['Логістичний центр', 'Logistics center'],
        ['Геотермальна база', 'Geothermal base'],
        ['Транзитний притулок', 'Transit shelter'],
        ['Екваторіальний маяк', 'Equatorial beacon'],
        ['Південний форпост', 'Southern outpost'],
        ['Атмосферне укриття', 'Atmospheric shelter'],
        ['Кріогенна станція', 'Cryogenic station'],
        ['Станція зв’язку', 'Communications station'],
        ['Марс', 'Mars']
    ];

    // Латинські A/B та кириличні А/В у ключах — взаємозамінні (щоб словник не залежав від розкладки)
    function variants(key) {
        const re = /(?<![\wА-ЯІЇЄҐа-яіїєґ])[AАBВ](?![\wА-ЯІЇЄҐа-яіїєґ])/g;
        if (!re.test(key)) return [key];
        const latin = key.replace(re, m => (m === 'A' || m === 'А') ? 'A' : 'B');
        const cyr = key.replace(re, m => (m === 'A' || m === 'А') ? 'А' : 'В');
        return [...new Set([key, latin, cyr])];
    }

    const dict = new Map();
    let matcher = null;

    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }

    function rebuild() {
        const keys = [...dict.keys()].sort((a, b) => b.length - a.length);
        matcher = new RegExp(`(?<![${CYR}])(?:${keys.map(esc).join('|')})(?![${CYR}])`, 'g');
    }

    function addPairsInternal(pairs) {
        pairs.forEach(([uk, en]) => {
            if (!uk || en == null) return;
            variants(uk).forEach(k => dict.set(k, en));
        });
    }

    const UNITS = [
        [/(\d)(\s?)ккал(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2kcal'],
        [/(\d)(\s?)шт\./g, '$1$2pcs'],
        [/(\d)(\s?)км\/год(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2km/h'],
        [/(\d)(\s?)м\/с(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2m/s'],
        [/(\d)(\s?)л\/км(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2L/km'],
        [/(\d)(\s?)км(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2km'],
        [/(\d)(\s?)хв(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2min'],
        [/(\d)(\s?)год(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2h'],
        [/(\d)(\s?)кг(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2kg'],
        [/(\d)(\s?)л(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2L'],
        [/(\d)(\s?)Па(?![А-ЯІЇЄҐа-яіїєґ])/g, '$1$2Pa'],
        [/(\d)(\s?)м(?![А-ЯІЇЄҐа-яіїєґ'’])/g, '$1$2m'],
        [/(\d)(\s?)ос\./g, '$1$2crew']
    ];

    function tr(str) {
        if (typeof str !== 'string' || !CYR_TEST.test(str)) return str;
        let out = str.replace(matcher, m => dict.get(m));
        if (CYR_TEST.test(out)) for (const [re, rep] of UNITS) out = out.replace(re, rep);
        return out;
    }

    // ---------- Обхід DOM ----------
    let lang = 'uk';
    const textState = new WeakMap();   // Text node -> {orig, tr}
    const textTracked = new Set();
    const attrState = new WeakMap();   // Element -> {attr: {orig, tr}}
    const attrTracked = new Set();
    const listeners = [];

    function skipEl(el) {
        if (!el || el.nodeType !== 1) return false;
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CANVAS' || tag === 'NOSCRIPT') return true;
        return !!(el.closest && el.closest('[data-no-i18n]'));
    }

    function procText(n) {
        if (skipEl(n.parentNode)) return;
        const cur = n.nodeValue, st = textState.get(n);
        if (st && cur === st.tr) return;
        if (!CYR_TEST.test(cur)) { if (st) textState.delete(n); return; }
        const t = tr(cur);
        if (t !== cur) { textState.set(n, { orig: cur, tr: t }); textTracked.add(n); n.nodeValue = t; }
    }

    function procAttr(el, attr) {
        if (skipEl(el)) return;
        const cur = el.getAttribute(attr);
        if (cur == null) return;
        let st = attrState.get(el);
        if (st && st[attr] && st[attr].tr === cur) return;
        if (!CYR_TEST.test(cur)) return;
        const t = tr(cur);
        if (t !== cur) {
            if (!st) { st = {}; attrState.set(el, st); }
            st[attr] = { orig: cur, tr: t };
            attrTracked.add(el);
            el.setAttribute(attr, t);
        }
    }

    function procTree(root) {
        if (!root) return;
        if (root.nodeType === 3) return procText(root);
        if (root.nodeType !== 1 || skipEl(root)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        let node = root;
        do {
            if (node.nodeType === 3) procText(node);
            else if (node.nodeType === 1) ATTRS.forEach(a => node.hasAttribute(a) && procAttr(node, a));
        } while ((node = walker.nextNode()));
    }

    const observer = new MutationObserver(muts => {
        for (const m of muts) {
            if (m.type === 'characterData') procText(m.target);
            else if (m.type === 'attributes') procAttr(m.target, m.attributeName);
            else m.addedNodes.forEach(procTree);
        }
        observer.takeRecords();
    });

    function startObserving() {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }

    function revertAll() {
        textTracked.forEach(n => {
            const st = textState.get(n);
            if (st && n.nodeValue === st.tr) n.nodeValue = st.orig;
            textState.delete(n);
        });
        textTracked.clear();
        attrTracked.forEach(el => {
            const st = attrState.get(el);
            if (st) Object.keys(st).forEach(a => { if (el.getAttribute(a) === st[a].tr) el.setAttribute(a, st[a].orig); });
            attrState.delete(el);
        });
        attrTracked.clear();
    }

    function updateButton() {
        const btn = document.getElementById('btnLang');
        if (!btn) return;
        btn.querySelectorAll('.lang-opt').forEach(o => o.classList.toggle('active', o.dataset.lang === lang));
        btn.setAttribute('title', lang === 'en' ? 'Switch language to Ukrainian' : 'Змінити мову на англійську');
    }

    function setLang(next, persist = true) {
        next = next === 'en' ? 'en' : 'uk';
        if (next === lang && matcher && !persist) { /* initial pass */ }
        lang = next;
        if (persist) { try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ } }
        document.documentElement.lang = lang;
        if (lang === 'en') {
            procTree(document.body);
            startObserving();
        } else {
            observer.disconnect();
            revertAll();
        }
        updateButton();
        listeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
    }

    // ---------- Публічне API ----------
    const nativeAlert = window.alert.bind(window);
    window.alert = (m) => nativeAlert(lang === 'en' ? tr(String(m)) : m);

    addPairsInternal(PAIRS);
    rebuild();

    window.I18N = {
        tr: (s) => (lang === 'en' ? tr(s) : s),
        lang: () => lang,
        setLang,
        onChange: (fn) => listeners.push(fn),
        addPairs(pairs) {
            addPairsInternal(pairs);
            rebuild();
            if (lang === 'en') procTree(document.body);
        }
    };

    // ---------- Ініціалізація ----------
    let initial = 'uk';
    try { initial = localStorage.getItem(STORAGE_KEY) || 'uk'; } catch (e) { /* ignore */ }

    function init() {
        const btn = document.getElementById('btnLang');
        if (btn) btn.addEventListener('click', () => setLang(lang === 'en' ? 'uk' : 'en'));
        setLang(initial, false);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
