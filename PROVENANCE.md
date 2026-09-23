# PROVENANCE — harut (חרוט)

תיעוד בלבד. הדרישות המחייבות נמצאות ב־`RULES.md`. הנתונים המלאים: `workbook.json` (מקור כל דף ושאלה), `provenance/coverage.json` (מטריצת כיסוי), `provenance/page-accounting.json` (כל דף מהשלב הקודם → דף סופי), `provenance/changes.json` (כל שינוי).

## מקורות

| ריפו | commit | נתיבים | תפקיד |
|---|---|---|---|
| `yanivmizrachiy/smartschool-hebrew-voice-notes` | `760f64e82dc6f309c67324df100399532f89bc8f` | print/harut-a4.html (== razpages workbooks/cone/index.html), visual-assets/ | 46 cone pages split per page (data-layout w<id> / v-<slug>); Ayelet page w17 locked |
| `yanivmizrachiy/jerusalem2` | `ffa9833f9f` | public/media/curriculum/idkun-geometri-8/pages/page-017..018.webp, fig-p17-1.png | official question 6 (גביע ה״מיני־מקס״) — all four parts, verbatim |
| `yanivmizrachiy/smartschool-hebrew-voice-notes (branch chore/world-class-architecture-chatgpt-20260826-2324)` | `f5a28df` | visual-assets/anis-basics.png, cone-in-my-head.png | verified final PNGs replacing truncated JPGs |
| `yanivmizrachiy/razpages` | `c8fe7bde7ee19215b5593f9379c3db2f0c846538` | workbooks/cone/, workbooks/visual-assets/ | Phase-1 import source (identical copies) |

תוכנית הלימודים: משרד החינוך, „תחום גאומטרי לכיתה ח” (geometry_8.pdf, עדכון תשפ״ז) — https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/curriculum/updating/geometry_8.pdf

## מספרים

- דפים: **46** (46 phase-1 pages − 0 replaced/merged/retired + 0 added = 46 final pages).
- שאלות: **178**, מתוכן **1** בלוקים של שאלות מתוך תוכנית הלימודים (1 שאלות רשמיות).
- שורות כיסוי: Counter({'other-repo': 43, 'irrelevant': 2, 'imported': 1, 'duplicate': 1}).
- שינויים מתועדים: 123 ({'official-presentation': 4, 'fix-figure': 17, 'fix-wording': 14, 'dedupe-remove': 6, 'overflow': 17, 'dedupe-vary': 13, 'other': 13, 'sub-bullets': 4, 'page-ref': 5, 'fix-math': 20, 'fix-table': 4, 'internal-text': 3, 'image': 2, 'ported-from-branch': 1}).

## טרנספורמציות מבניות (כל הדפים)

- שלב 1 (העתקה): תוכן זהה בית־לבית למקור; שינויי נתיב בלבד.
- חומר שנטען בזמן ריצה (loader) הפך לדפים סטטיים; החרוט פוצל מקובץ אחד ל־page-N.html (נבדק: זהות פיקסלים/גאומטריה).
- מספרי שאלות הוסרו; תבליט גדול לשאלה, קטן לסעיף; כותרת תוכנית הלימודים לפי RULES §5.
- כללי CSS שהיו קשורים למספר הדף הגלוי הועברו ל־`data-layout` (תיקן 17 דפי מעגל שחרגו מ־A4).
- סדר פדגוגי לפי RULES §6 (שלבים ב־`workbook.json`).

## חשבון דפים (דפי השלב הקודם → סופי)

| דף קודם | layout | דף סופי | סטטוס | סיבה |
|---|---|---|---|---|
| 1 | `w17` | 1 | preserved | same page |
| 2 | `w1` | 2 | preserved | same page |
| 3 | `w19` | 3 | preserved | same page |
| 4 | `w3` | 36 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 5 | `w20` | 4 | moved | pedagogical order (RULES §6): stage 'רדיוס, גובה, יוצר וחתך צירי' |
| 6 | `v-anis-basics` | 8 | moved | pedagogical order (RULES §6): stage 'רדיוס, גובה, יוצר וחתך צירי' |
| 7 | `w4` | 37 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 8 | `w2` | 33 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 9 | `v-jerusalem-cone-vision` | 40 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 10 | `w5` | 38 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 11 | `v-puzzle-1-question` | 15 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 12 | `w21` | 9 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 13 | `w22` | 10 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 14 | `w6` | 13 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 15 | `w23` | 18 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 16 | `v-cone-in-my-head` | 22 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 17 | `w7` | 14 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 18 | `w24` | 5 | moved | pedagogical order (RULES §6): stage 'רדיוס, גובה, יוצר וחתך צירי' |
| 19 | `w25` | 6 | moved | pedagogical order (RULES §6): stage 'רדיוס, גובה, יוצר וחתך צירי' |
| 20 | `w14` | 39 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 21 | `w26` | 23 | moved | pedagogical order (RULES §6): stage 'משפט פיתגורס בחרוט' |
| 22 | `v-world-of-cones` | 27 | moved | pedagogical order (RULES §6): stage 'משפט פיתגורס בחרוט' |
| 23 | `w27` | 24 | moved | pedagogical order (RULES §6): stage 'משפט פיתגורס בחרוט' |
| 24 | `w28` | 25 | moved | pedagogical order (RULES §6): stage 'משפט פיתגורס בחרוט' |
| 25 | `w9` | 30 | moved | pedagogical order (RULES §6): stage 'משימות רב־שלביות: פיתגורס, שטח חתך ונפח' |
| 26 | `w29` | 20 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 27 | `w30` | 21 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 28 | `w31` | 11 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 29 | `v-puzzle-2-question` | 32 | moved | pedagogical order (RULES §6): stage 'משימות רב־שלביות: פיתגורס, שטח חתך ונפח' |
| 30 | `w32` | 29 | moved | pedagogical order (RULES §6): stage 'משימות רב־שלביות: פיתגורס, שטח חתך ונפח' |
| 31 | `w33` | 31 | preserved | same page |
| 32 | `w34` | 28 | moved | pedagogical order (RULES §6): stage 'משימות רב־שלביות: פיתגורס, שטח חתך ונפח' |
| 33 | `w8` | 42 | moved | pedagogical order (RULES §6): stage 'משימות מסכמות ואינטגרטיביות' |
| 34 | `w10` | 17 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 35 | `w35` | 16 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 36 | `w13` | 12 | moved | pedagogical order (RULES §6): stage 'נפח החרוט: נוסחה, חישוב והשוואות' |
| 37 | `w36` | 19 | moved | pedagogical order (RULES §6): stage 'נפח: עבודה לאחור, ניתוח טעויות והמרת מידות' |
| 38 | `w11` | 34 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 39 | `w15` | 35 | moved | pedagogical order (RULES §6): stage 'העשרה (מחוץ לתוכנית הרשמית): פריסה, מבטים וחתכים' |
| 40 | `w37` | 26 | moved | pedagogical order (RULES §6): stage 'משפט פיתגורס בחרוט' |
| 41 | `w12` | 41 | preserved | same page |
| 42 | `w38` | 43 | moved | pedagogical order (RULES §6): stage 'משימות מסכמות ואינטגרטיביות' |
| 43 | `w16` | 44 | moved | pedagogical order (RULES §6): stage 'משימות מסכמות ואינטגרטיביות' |
| 44 | `w18` | 7 | moved | pedagogical order (RULES §6): stage 'רדיוס, גובה, יוצר וחתך צירי' |
| 45 | `v-puzzle-1-answer` | 45 | preserved | same page |
| 46 | `v-puzzle-2-answer` | 46 | preserved | same page |

## פריטים פתוחים

- OPEN_QUALITY_GAP — `v-world-of-cones`, `v-jerusalem-cone-vision`: the only existing files are truncated JPGs (no intact copy in git history or Google Drive). Pages kept in place per RULES §10; needs Yaniv's original artwork.
- Ayelet page (w17) keeps apparent typos ('אך', 'שמרדף') unchanged: locked source, no verified original available for comparison.
