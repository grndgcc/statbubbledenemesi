# Stat Bubbles for Owlbear Rodeo

Owlbear Rodeo karakter token'ları üzerine hover ile görünen özel stat baloncukları ekleyen eklenti.

## Statlar

- STR, DEX, CON, WIS, INT, CHA
- Diplomacy, Martial, Economy, Intrigue, Learning, Prowess
- Prestige, Appearance, Magic Item

> Not: Kullanıcının istediği `Appereance` yazımı JSON import aşamasında desteklenir, ama arayüzde doğru İngilizce yazım olan `Appearance` kullanılır.

## Nasıl çalışır?

- GM, eklenti panelinden seçili karakter/token için statları girer.
- Statlar token metadata'sına kaydedilir.
- GM ayrıca session yedeği için JSON indirebilir.
- `Owlbear sahne metadata DB’ye kaydet` düğmesi tüm statlı token’ları sahne metadata’sına ayrıca kopyalar.
- Oyuncular hover baloncuklarını görmek için Pointer aracının altındaki **Stat Bubble Hover** modunu seçer.
- Baloncuklar normalde görünmez; sadece karakterin üzerine gelince yerel label olarak ekranda görünür.

## Kurulum / geliştirme

```bash
npm install
npm run dev
```

Owlbear Rodeo profilinden eklentiyi eklerken manifest adresi:

```text
http://localhost:5173/manifest.json
```

## Build

```bash
npm run build
```

`dist/` klasörü statik site olarak yayınlanır.

## GitHub Pages ile yayınlama

1. Bu klasörü yeni bir GitHub reposuna yükle.
2. Repo ayarlarından **Settings → Pages → Source: GitHub Actions** seç.
3. `main` branch'e push at.
4. Workflow tamamlandıktan sonra manifest URL’sini Owlbear profilinde ekle:

```text
https://KULLANICI_ADI.github.io/REPO_ADI/manifest.json
```

Örnek:

```text
https://grndgcc.github.io/owlbear-stat-bubbles/manifest.json
```

## JSON formatı

Dışa aktarılan JSON formatı `examples/example-session.json` dosyasında var. İçe aktarma token eşlemesini önce `id`, sonra `name` alanıyla yapar.

## Teknik notlar

- Kalıcı veri anahtarı: `com.grondgecici.stat-bubbles/stats`
- Sahne yedek/veritabanı anahtarı: `com.grondgecici.stat-bubbles/scene-db`
- Hover baloncukları `OBR.scene.local` ile oluşturulduğu için sadece mevcut kullanıcının ekranında görünür.
- Owlbear SDK doğrudan global mouse hover eventi vermediği için görünürlük özel pointer tool mode üzerinden çalışır.
