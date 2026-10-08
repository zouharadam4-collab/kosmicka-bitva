# 🚀 KOSMICKÁ BITVA – týmový kvíz o Marii Terezii

Dva týmy, dvě planety. Každá správná odpověď přidá sílu raketě svého týmu.
Po uplynutí času vystřelí silnější raketa a **zničí planetu soupeře**.

## Co potřebuješ
- notebook připojený k projektoru a nainstalovaný **Node.js** (https://nodejs.org, verze LTS)
- telefony spolužáků ve **stejné wifi** jako notebook

## Spuštění
- **Windows:** dvakrát klikni na `START-WINDOWS.bat`
- **Mac / Linux:** v terminálu `sh start.sh`
- nebo ručně: `node server.js` a otevři v prohlížeči **http://localhost:3000/host**

(Složka už obsahuje vše potřebné, `npm install` není potřeba.)

## Jak se hraje
1. Na projektoru otevři stránku `/host` (klávesa **F** = celá obrazovka).
2. Spolužáci naskenují QR kód a zadají přezdívku. Systém je sám rozdělí do týmů AQUA a IGNIS
   (rozdíl max. 1 hráč) a telefon jim ukáže, v kterém týmu jsou.
3. Vyber délku hry (výchozí 3 minuty) a stiskni **SPUSTIT HRU**.
4. Hráči odpovídají na svých telefonech. Správná odpověď = +1 síla rakety. Za špatnou je krátká pauza.
5. Po vypršení času následuje odpočet, start raket a zničení planety slabšího týmu. Při shodě se rakety srazí.
6. Tlačítky dole spustíš další kolo (stejné týmy / nové týmy).

## Tipy
- **Bez spolužáků si hru vyzkoušíš** tlačítkem „+6 testovacích botů“.
- Při prvním spuštění Windows zeptá na firewall – povol přístup pro **soukromé sítě**.
- Když se telefony nepřipojí: školní wifi někdy zakazuje komunikaci mezi zařízeními.
  Pomůže **hotspot z mobilu** (připojíš k němu notebook i telefony spolužáků).
- Je-li v nabídce „Síť“ víc adres, vyber tu, kterou má wifi (obvykle 192.168.x.x).
- Zvuk zapneš kliknutím do okna; klávesa **M** ho vypíná.
- `http://localhost:3000/demo` ukáže finále i bez hráčů (soubor `public/demo.html` jde otevřít i přímo).

## Vlastní otázky
Otevři `questions.js`. Každá otázka je jeden řádek: první možnost je vždy ta správná
(server je hráčům zamíchá), zbylé tři jsou špatné. V souboru je 46 otázek podle prezentace.
Fakta v otázkách si před hrou prosím ověř.

## Soubory
`server.js` herní server · `questions.js` otázky · `public/host.html` projektor ·
`public/play.html` telefon · `public/render.js` planety, rakety a animace.
