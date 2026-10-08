// Otázky k prezentaci "Marie Terezie" (Viki, Sára, Rebeka, Adam).
// FORMÁT: { q: "otázka", o: ["SPRÁVNÁ odpověď", "špatná", "špatná", "špatná"] }
// Správná odpověď je vždy první – server možnosti před odesláním hráčům zamíchá.
// Další otázky si můžeš klidně přidat na konec seznamu.
module.exports = [
  // --- Základní informace (slide 2) ---
  { q: "Kdy se Marie Terezie narodila?", o: ["1717", "1701", "1740", "1756"] },
  { q: "Ve kterém městě se Marie Terezie narodila?", o: ["Ve Vídni", "V Praze", "V Budapešti", "V Salcburku"] },
  { q: "Kdo byl otcem Marie Terezie?", o: ["Karel VI.", "Josef II.", "František I. Štěpán", "Leopold I."] },
  { q: "Z jakého rodu pocházela Marie Terezie?", o: ["Z Habsburků", "Z Přemyslovců", "Z Lucemburků", "Z Rurikovců"] },
  { q: "Jaká byla Marie Terezie jako vládkyně českých zemí?", o: ["Jediná vládnoucí žena na českém trůně", "Jedna z mnoha vládnoucích žen", "Pouze regentka za syna", "Pouze manželka krále"] },
  { q: "Jak se jmenoval manžel Marie Terezie?", o: ["František Štěpán Lotrinský", "Fridrich II. Pruský", "Karel VI.", "Ludvík XVI."] },
  { q: "Kolik dětí měla Marie Terezie?", o: ["16", "4", "8", "25"] },
  { q: "Která dcera Marie Terezie se provdala za francouzského krále a stala se královnou?", o: ["Marie Antoinetta", "Marie Luisa", "Alžběta", "Marie Kristýna"] },
  { q: "Který syn Marie Terezie ji později vystřídal na trůnu?", o: ["Josef II.", "Leopold I.", "Karel VI.", "Ferdinand I."] },
  { q: "Kromě němčiny uměla Marie Terezie například:", o: ["Italsky, francouzsky, španělsky a latinsky", "Pouze česky", "Rusky a polsky", "Arabsky a řecky"] },
  { q: "V letech 1740–1780 byla Marie Terezie:", o: ["Arcivévodkyní rakouskou, královnou uherskou a českou", "Pouze císařovnou římskou", "Pouze královnou francouzskou", "Pouze markraběnkou moravskou"] },
  { q: "Do kterého roku Marie Terezie vládla?", o: ["1780", "1763", "1790", "1748"] },

  // --- Nástup na trůn (slide 3) ---
  { q: "Ve kterém roce zemřel Karel VI. a Marie Terezie nastoupila na trůn?", o: ["1740", "1717", "1756", "1780"] },
  { q: "Kolik let bylo Marii Terezii při nástupu na trůn?", o: ["23", "17", "35", "41"] },
  { q: "Co zaručilo nástupnictví Marie Terezie, i když Karel VI. nezanechal syna?", o: ["Pragmatická sankce", "Zlatá bula sicilská", "Majestát Rudolfa II.", "Vestfálský mír"] },
  { q: "Ve kterém roce byla vydána Pragmatická sankce?", o: ["1713", "1740", "1648", "1781"] },
  { q: "Který pruský král napadl Slezsko už v prosinci 1740?", o: ["Fridrich II.", "Vilém I.", "Bedřich I.", "Karel XII."] },
  { q: "Kde byla Marie Terezie v roce 1741 korunována uherskou královnou?", o: ["V Bratislavě", "V Praze", "V Krakově", "V Salcburku"] },
  { q: "Kde a kdy byla Marie Terezie korunována českou královnou?", o: ["V Praze v roce 1743", "Ve Vídni v roce 1740", "V Brně v roce 1756", "V Olomouci v roce 1717"] },
  { q: "Proč byla Marie Terezie na vládu zpočátku málo připravená?", o: ["Nebyla na ni vychovávána, trůn měl zdědit syn", "Neuměla číst", "Byla příliš stará", "Žila v zahraničí"] },
  { q: "Jak se jmenovala válka z let 1740–1748, ve které Marie Terezie ztratila většinu Slezska?", o: ["Válka o rakouské dědictví", "Třicetiletá válka", "Sedmiletá válka", "Napoleonské války"] },
  { q: "Které území Marie Terezie ztratila ve válkách s Pruskem?", o: ["Většinu Slezska", "Tyrolsko", "Moravu", "Halič"] },

  // --- Přehled reforem (slide 4) ---
  { q: "Která reforma zavedla povinnou docházku dětí od 6 do 12 let?", o: ["Školská reforma", "Armádní reforma", "Robotní patent", "Správní reforma"] },
  { q: "Který z těchto bodů NEpatřil mezi hlavní reformy Marie Terezie?", o: ["Zavedení parlamentní demokracie", "Školství", "Omezení roboty", "Státní správa"] },

  // --- Školství (slide 5) ---
  { q: "Ve kterém roce vyšel Všeobecný školní řád?", o: ["1774", "1740", "1749", "1781"] },
  { q: "Pro děti v jakém věku zavedl školní řád povinnou docházku?", o: ["6–12 let", "3–8 let", "10–16 let", "12–18 let"] },
  { q: "Kdo vypracoval Všeobecný školní řád?", o: ["Johann Ignaz Felbiger", "Jan Amos Komenský", "Gerard van Swieten", "Friedrich Haugwitz"] },
  { q: "Podle jakého vzoru byl školní řád vypracován?", o: ["Podle pruského vzoru", "Podle francouzského vzoru", "Podle anglického vzoru", "Podle ruského vzoru"] },
  { q: "Kolik typů škol zavedl školní řád?", o: ["Tři", "Jeden", "Pět", "Deset"] },
  { q: "Které školy byly ve farnostech a na vesnicích a učily čtení, psaní, počty a náboženství?", o: ["Triviální", "Normální", "Hlavní", "Gymnázia"] },
  { q: "Které školy byly ve větších městech a učily navíc např. latinu a kreslení?", o: ["Hlavní", "Triviální", "Normální", "Nedělní"] },
  { q: "Které školy byly ve zemských městech a sloužily jako vzorové a pro přípravu učitelů?", o: ["Normální", "Triviální", "Hlavní", "Kláštery"] },
  { q: "Pro koho byly určeny nedělní opakovací školy?", o: ["Pro učně", "Pro šlechtu", "Pro vojáky", "Pro kněze"] },
  { q: "Čím se stala gramotnost podle školní reformy?", o: ["Cílem státu", "Zakázanou věcí", "Soukromou záležitostí šlechty", "Úkolem církve bez státu"] },

  // --- Robotní patent (slide 6) ---
  { q: "Ve kterém roce byl vydán robotní patent?", o: ["1775", "1740", "1763", "1790"] },
  { q: "Co omezil robotní patent?", o: ["Robotu poddaných pro vrchnost", "Daně šlechty", "Počet vojáků", "Ceny obilí"] },
  { q: "Co patřilo mezi důvody vzniku robotního patentu?", o: ["Hladomor 1770–1772 a selské povstání", "Válka s Tureckem", "Zrušení církve", "Požár Prahy"] },
  { q: "Podle čeho se stanovoval rozsah roboty?", o: ["Podle velikosti hospodářství", "Podle věku poddaného", "Podle přání vrchnosti", "Podle ročního období a počasí"] },
  { q: "Kolik dní v týdnu nejvýše směl poddaný robotovat podle patentu?", o: ["3 dny", "1 den", "5 dní", "7 dní"] },
  { q: "Kolik hodin denně nejvýše mohla robota trvat v létě?", o: ["12 hodin", "6 hodin", "16 hodin", "20 hodin"] },
  { q: "Proč Marie Terezie chránila sedláky?", o: ["Byli plátci daní", "Byli její příbuzní", "Chtěla zrušit šlechtu", "Chtěla je poslat do války"] },

  // --- Státní správa (slide 7) ---
  { q: "Jak se změnila moc zemských sněmů a stavů za Marie Terezie?", o: ["Byla omezena", "Byla posílena", "Zůstala stejná", "Stavy ovládly stát"] },
  { q: "Co se v roce 1749 spojilo?", o: ["České a rakouské dvorské kanceláře", "Armáda a církev", "Univerzity a školy", "Města a vesnice"] },
  { q: "Kdo navrhl správní reformu z roku 1749?", o: ["Friedrich Wilhelm Haugwitz", "Gerard van Swieten", "Johann Ignaz Felbiger", "Klement Metternich"] },
  { q: "Jak se nazývaly zemské úřady podřízené centrálním úřadům ve Vídni (např. v Praze)?", o: ["Gubernia", "Direktoria", "Kolegia", "Magistráty"] },
  { q: "Co se změnilo u úředníků státní správy?", o: ["Museli mít odborné vzdělání", "Mohli být jen šlechtici", "Museli být duchovní", "Museli umět jen číst"] },
  { q: "Co bylo cílem centralizace státní správy?", o: ["Posílit moc panovníka a oslabit stavy", "Zvýšit moc šlechty", "Zrušit daně", "Oddělit české země od Vídně"] },

  // --- Číslování domů (slide 8) ---
  { q: "Ve kterém roce bylo zavedeno číslování domů?", o: ["1770", "1740", "1749", "1790"] },
  { q: "K čemu původně sloužilo číslování domů?", o: ["K soupisu obyvatel a odvodu vojáků", "K lepšímu doručování pošty", "K výběru poplatků za vodu", "K evidenci knih"] },
  { q: "Jak se nazýval soupis obyvatel, který probíhal spolu s číslováním domů?", o: ["Konskripce", "Inkvizice", "Reformace", "Revoluce"] },
  { q: "Které skupiny byly od odvodu osvobozeny?", o: ["Šlechta a duchovenstvo", "Sedláci a řemeslníci", "Učitelé a žáci", "Ženy a děti"] },
  { q: "Z čeho vychází dnešní číslo popisné na domech?", o: ["Z tereziánského číslování", "Z husitských soupisů", "Z napoleonských map", "Z komunistických plánů"] },

  // --- Armáda (slide 9) ---
  { q: "Proč Marie Terezie reformovala armádu?", o: ["Po neúspěších ve válkách a ztrátě Slezska", "Kvůli oslavám", "Kvůli návštěvě cizího krále", "Kvůli změně hlavního města"] },
  { q: "Na jak dlouhou dobu dopředu se schvaloval rozpočet armády?", o: ["Na 10 let", "Na 1 rok", "Na 3 roky", "Na 50 let"] },
  { q: "Co zavedl výcvikový řád z roku 1749?", o: ["Jednotný výcvik a úbory", "Zákaz služby šlechtě", "Námořnictvo", "Žoldnéřské vojsko"] },
  { q: "Kde vznikla v roce 1751 vojenská akademie?", o: ["Ve Vídeňském Novém Městě", "V Praze", "V Budapešti", "V Brně"] },
  { q: "Který řád byl v roce 1757 založen za statečnost?", o: ["Řád Marie Terezie", "Řád zlatého rouna", "Řád bílého lva", "Řád svatého Štěpána"] },
  { q: "Jaký byl výsledek armádních reforem?", o: ["Silnější armáda, ale Slezsko se nevrátilo", "Slezsko se vrátilo", "Armáda byla zrušena", "Rakousko dobylo Prusko"] },

  // --- Význam (slide 10) ---
  { q: "Čím reformy udělaly z českých zemí součást moderního státu?", o: ["Centralizací", "Rozdělením na malé státy", "Zrušením úřadů", "Návratem ke stavovské moci"] },
  { q: "Co reformy přinesly českým zemím?", o: ["Gramotnější obyvatelstvo a silnější správu", "Zrušení škol", "Slabší stát", "Zákaz obchodu"] },
  { q: "Čemu reformy pomohly v 19. století?", o: ["Národnímu hnutí", "Obnově poddanství", "Zániku škol", "Návratu Slezska"] },
  { q: "Co byla jedna z cen za tyto reformy?", o: ["Ztráta autonomie a tlak na němčinu", "Vyšší roboty", "Zákaz školní docházky", "Ztráta všech měst"] }
];
