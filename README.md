# ZIRHOVA — v0.1 prototype

Tamamen özgün bir top-down tank oyunu prototipidir. Amaç, klasik 8-bit tank oyunlarının temel tür hissini korurken özgün görsel dil, özgün harita, özgün üs simgesi ve modern oynanış katmanları geliştirmektir.

## Bu sürümde
- Masaüstü: WASD / ok tuşları + Space
- Mobil/tablet: dokunmatik D-pad + Ateş
- Üs savunma
- Yıkılabilir tuğla duvarlar
- Yıkılmaz çelik bloklar
- Geçilemez su
- Düşman AI ve dalga sistemi
- Elite düşmanlar
- Can, skor, üs canı
- Prosedürel WebAudio ses efektleri
- PWA manifest + service worker

## IP / marka / lisans hijyeni
Bu prototipte üçüncü taraf oyun asseti, ROM verisi, klasik Battle City/Tank 1990 haritası, sprite'ı, sesi, müziği, adı veya logosu kullanılmamıştır. Oyun haritası ve geometrik görseller bu prototip için sıfırdan oluşturulmuştur.

Bu repo için nihai yazılım lisansı henüz seçilmemiştir. Ticari geliştirme aşamasında varsayılan yaklaşım, açıkça başka bir lisans seçilmedikçe telif haklarının saklı tutulmasıdır. Marka ön taraması için `BRAND_CLEARANCE.md` dosyasına bakın.

## Yerel çalıştırma
Basit bir HTTP sunucusu ile açın:

```bash
python -m http.server 8080
```

Ardından `http://localhost:8080`.

## Sıradaki hedefler
1. Harita sistemi ve bölüm editörü
2. Tank sınıfları ve kalıcı yükseltme ağacı
3. Roguelite run yapısı
4. Boss tanklar
5. Gamepad desteği
6. 2 oyuncu local/co-op altyapısı
7. Ses/müzik paketinin özgün üretimi
8. Marka adı için ayrı tescil taraması
