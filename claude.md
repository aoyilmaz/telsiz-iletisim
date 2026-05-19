Claude'a doğrudan kopyalayıp yapıştırabileceğiniz `claude.md` dosyasının içeriğini aşağıda hazırladım. Bu metin, hem projenin teknik isterlerini hem de haritada kullanılacak afet iletişim verilerini içermektedir:

# Afet İletişim Haritası - Proje Başlatma Belgesi

Merhaba Claude. Sen uzman bir Frontend ve Web geliştiricisisin. Aşağıda detayları ve kaynak verileri bulunan, afet durumlarında internet kesilse bile çalışmaya devam edebilecek (offline-first) statik bir web sitesi hazırlamanı istiyorum. Bu proje GitHub Pages üzerinden tamamen ücretsiz olarak yayınlanacaktır.

## Teknik İsterler ve Mimari

1. **Altyapı:** Yalnızca statik HTML, CSS ve Vanilla JS kullanılacak. Sunucu taraflı kod (Node.js, PHP vb.) kullanılmayacak. Tüm röle ve telsiz frekans verileri `data.json` isimli bir dosyada tutulacak.
2. **Harita Entegrasyonu:** Harita altyapısı için LeafletJS kullanılacak. Sitenin çevrimdışı (offline) harita desteği sunabilmesi çok kritiktir; bu nedenle kullanıcıların harita parçalarını (tiles) önceden IndexedDB veya WebSQL'e indirip saklayabilmesi için "Leaflet.offline" veya "Leaflet.TileLayer.PouchDBCached" eklentilerinden birini projeye mutlaka dahil et.
3. **PWA ve Çevrimdışı Çalışma:** Uygulamanın HTML, CSS, JS betiklerinin ve ikonlarının internet olmadan da okunabilmesi için Service Worker entegrasyonu yap ve uygulama önbelleği (application cache manifest) mimarisini kur.
4. **Arayüz (UI):** Mobil öncelikli (responsive) tasarım yap. Kullanıcılar haritayı açtığında röleleri harita üzerinde görebilmeli, üzerlerine tıkladığında frekans, ofset ve ton bilgilerini içeren bir pencere (popup) açılmalı.

## Görevlerin

1. Gerekli dosya yapısını (index.html, style.css, app.js, sw.js, data.json) oluştur ve kodlarını sağla.
2. Aşağıdaki kaynak metinde yer alan Tablo 3 ve Tablo 4'teki röle istasyonlarının teknik bilgilerini (frekans, ton, ofset, koordinat) JSON formatına çevirerek haritaya entegre et.
3. Uygulamanın bir köşesinde kullanıcılara yardımcı olmak için metindeki "Baofeng UV-5R Manuel VFO Programlama" adımlarını içeren bir eğitim panosu oluştur.
4. Kodları tamamladıktan sonra projenin GitHub Pages'e yüklenme adımlarını kısaca anlat.

---

## Kaynak Metin

# Afet ve Kriz Durumlarında Alternatif İletişim Teknolojileri: Yazılım Mühendisliği Katkıları, Telsiz Altyapıları ve Uzmanlık Eğitimi

## Giriş: Merkezi Altyapıların Kırılganlığı ve Alternatif İletişim Paradigmaları

Modern iletişim sistemleri, fiber optik omurgalar, merkezileşmiş veri merkezleri ve kesintisiz enerji sağlayan elektrik şebekeleri üzerine inşa edilmiştir. Ancak büyük çaplı depremler, kasırgalar veya altyapıya yönelik siber ve fiziksel saldırılar gibi felaket senaryolarında, bu karmaşık ağların "tekil hata noktaları" (single points of failure) hızla çökmektedir. BGP (Border Gateway Protocol) yönlendirmelerinin başarısız olduğu, DNS sunucularının yanıt vermediği ve hücresel baz istasyonlarının enerji yetersizliği veya aşırı yüklenme sebebiyle hizmet dışı kaldığı durumlarda, geleneksel TCP/IP mimarisi bütünüyle işlevsiz hale gelir. Bütün iletişimin sustuğu böylesi anlarda, hayatta kalma ve koordinasyon süreçleri tamamen radyo frekansı (RF) temelli, merkeziyetsiz, bağımsız enerji kaynaklarıyla çalışabilen ve dinamik olarak kendi kendini onarabilen ad-hoc ağlara bağımlıdır.

Yazılım mühendisleri için alternatif iletişim teknolojilerine geçiş, alışılagelmiş geliştirme pratiklerinden radikal bir kopuşu ifade eder. Geleneksel web veya mobil uygulama geliştirmede sınırsız kabul edilen bant genişliği, mikrosaniyelerle ölçülen gecikme süreleri (latency) ve her zaman çevrimiçi olan sunucular, yerini saniyede yalnızca birkaç bayt veri iletebilen, paket kayıplarının kural olduğu ve asenkron "sakla-ilet" (store-and-forward) mantığıyla çalışan donanımlara bırakır. Bu rapor, bir yazılım geliştiricinin düşük bant genişlikli radyo ağları, mesh protokolleri ve yazılım tanımlı radyolar (SDR) alanında nasıl yapısal mimariler inşa edebileceğini derinlemesine incelemektedir. Ayrıca, Türkiye'deki mevcut amatör telsiz röle altyapısı, bu cihazların konfigürasyon metrikleri ve sıfırdan başlayarak bir bireyi afet iletişim mimarı seviyesine taşıyacak kapsamlı ve akademik düzeyde bir eğitim müfredatı ayrıntılı olarak analiz edilmektedir.

## Bölüm 1: Merkeziyetsiz ve Gecikmeye Toleranslı Ağ (DTN) Mimarilerinde Yazılım Mühendisliği

Merkeziyetsiz ağlar, hiçbir düğümün (node) diğerinden daha imtiyazlı olmadığı ve veri paketlerinin hedeflerine ulaşmak için ara düğümler üzerinden atlayarak (hopping) ilerlediği sistemlerdir. Yazılım mühendislerinin bu alandaki en büyük katkısı, fiziksel donanımın kısıtlamalarını aşan zeki yönlendirme algoritmaları, güç yönetimi servisleri ve uçtan uca şifreli mesajlaşma protokolleri geliştirmektir.

### Meshtastic ve LoRaWAN Ekosisteminde Donanım ve Uygulama Geliştirme

Meshtastic projesi, açık kaynak kodlu ve gönüllüler tarafından geliştirilen, LoRa (Long Range) modülasyonu üzerine inşa edilmiş bir mesh iletişim ağıdır. Ekosistem; Protokol Tamponları (Protocol Buffers) ile tanımlanan API'ler, ESP32, nRF52, RP2040 ve RP2350 mikrodenetleyicileri için yazılmış C/C++ donanım yazılımları (firmware) ve Python, JavaScript, Kotlin, SwiftUI gibi çeşitli dillerde geliştirilmiş istemci uygulamalarından oluşur. Yazılım mühendisleri, bu altyapıya çekirdek donanım seviyesinde katkı sağlayabilirler. Örneğin, cihaza entegre edilmiş bir çevre sensöründen alınan verileri ağa yayınlamak için donanım yazılımı üzerinde yeni bir modül yazılması gerekmektedir. Geliştiriciler, `src/modules/ReplyModule.*` dosyasını bir şablon olarak kullanarak kendi özel modüllerini (örneğin `YourModule`) oluşturabilir, verilerin ağ içinde izole edilmesi için `meshtastic_PortNum_TEXT_MESSAGE_APP` gibi standart port numaralarından farklı özel bir iletişim portu atayabilir ve bu modülü `modules/Modules` dosyasındaki `setupModules()` fonksiyonu içine dahil ederek cihazı yeniden derleyebilirler.

Donanım seviyesine inmeden otomasyon geliştirmek isteyen mühendisler için Python API benzersiz yetenekler sunar. `meshtastic-python` kütüphanesi kullanılarak bir afet koordinasyon merkezindeki bilgisayarlar ile sahada çalışan cihazlar arasında köprüler kurulabilir. Seri port (örneğin `/dev/ttyUSB0`) veya TCP/IP (örneğin `192.168.68.74` üzerinden) ile radyoya bağlanan Python kodları, ağın davranışını dinamik olarak değiştirebilir. Geliştirici, `SerialInterface().sendText("hello mesh")` komutu ile ağdaki tüm kullanıcılara yayın yapabilir veya `ourNode.localConfig.position.gps_update_interval = 60` komutu ile cihazın GPS konum güncelleme aralığını krizin gereksinimlerine göre optimize edebilir. API, ağa bağlanan cihazların tepkilerini yönetmek için Yayın-Abonelik (Pub/Sub) mimarisini destekler; `pub.subscribe(onReceive, "meshtastic.receive")` şeklinde tanımlanan geri çağırma (callback) fonksiyonları, radyoya bir paket düştüğü anda karmaşık veritabanı yazma işlemlerini veya uyarı mekanizmalarını tetikleyebilir.

Güneş enerjisiyle beslenen bağımsız (off-grid) röle düğümleri tasarlamak, beraberinde ciddi güç yönetimi problemleri getirir. Bir ESP32 mikrodenetleyicisi, LoRa SX1276 modülü, OLED ekran ve GPS entegrasyonu tam güçte çalışırken 400 ila 500 miliamper (mA) civarında enerji tüketir. Bu tüketim seviyesi, güneşin olmadığı gece saatlerinde veya kapalı havalarda sistemin saatler içinde çökmesine neden olur. Bir test senaryosunda, 3500 mAh kapasiteli bir 18650 lityum-iyon batarya ve INA219 akım sensörü kullanılarak yapılan ölçümlerde, sürekli 100 mA çeken bir ESP32 S3 solar düğümünün gün batımındaki 4.7 voltluk geriliminin sabaha karşı 2.81 volta kadar düşerek çökme noktasına geldiği kaydedilmiştir. Yazılım geliştiricilerin buradaki görevi, cihazların görev döngülerini (duty cycling) kodlayarak Meshtastic donanım yazılımındaki derin uyku (deep sleep) modlarını aktif hale getirmektir. ULP (Ultra Low Power) işlemciyi yönetecek yazılımlar sayesinde donanım tüketimi 80 ila 150 mA aralığına, hatta sadece mikrodenetleyicinin izlendiği durumlarda 0.150 mA ve hafif uyku (light sleep) modunda 0.8 mA seviyelerine çekilebilir. Ancak cihazların uykuda kalması ağın mesaj iletme (relay) kabiliyetini etkilediği için, donanım kesmeleri (hardware interrupts) ve radyo dalgasıyla uyanma algoritmalarının optimize edilmesi yazılımcılar açısından kritik bir veri yapıları problemi oluşturur.

| Donanım Durumu / Çip Mimarisi | Ortalama Akım Çekimi | Enerji Tasarrufu Teknolojisi ve Beklentiler |
| --- | --- | --- |
| ESP32 + GPS + LoRa (Tam Aktif) | 400 - 500 mA | Sensör okumaları ve veri yayını esnasındaki zirve tüketim. |
| Meshtastic Varsayılan Döngü | 80 - 150 mA | Duty cycling algoritmaları devreye girdiğinde. |
| Heltec Wireless Stick Lite | 30 uA (0.030 mA) | İlan edilen ideal derin uyku optimizasyonu. |
| ESP32 Çekirdek (Hafif Uyku) | 0.8 mA | Çevresel birimler kapalıyken çipin güç tasarrufu modu. |
| ESP32 Çekirdek (Derin Uyku) | 0.150 mA | Sadece ULP (Ultra Low Power) yardımcı işlemcinin çalıştığı durum. |

### Reticulum Network Stack (RNS): Kriptografik ve Koordinasyonsuz Yönlendirme

TCP/IP altyapısının çöküşüne karşı geliştirilmiş en radikal ve yenilikçi mimarilerden biri Reticulum projesidir. 2016 yılında kamu malı (Public Domain) olarak adanan bu protokol, geleneksel IP adresleme mantığını tamamen terk ederek koordinasyon gerektirmeyen, küresel olarak benzersiz kriptografik kimlikler üzerinden veri aktarımı sağlar. Python dili ile Mark Qvist tarafından geliştirilen referans uygulaması, ağdaki her bir düğümün kendi şifreleme anahtarlarını üretmesine ve ağın kendisini hiçbir merkezi DHCP veya DNS sunucusu olmadan yapılandırmasına imkan tanır. Geliştiriciler, Ubuntu veya Debian tabanlı sistemlerinde `sudo apt install python3 python3-pip python3-dev` komutlarıyla gerekli paketleri sağladıktan sonra sadece `pip install rns` komutunu kullanarak bu yepyeni ağ katmanını sistemlerine entegre edebilirler.

Mobil ve gömülü ortamlarda Reticulum altyapısının çalıştırılması yazılımcılar için özel bir derleme (compilation) süreci gerektirir. Örneğin Android ekosisteminde Termux üzerinden altyapıyı kurarken, sistem mimarisine uygun önceden derlenmiş kütüphaneler bulunmadığında, geliştiricilerin `python-cryptography` kütüphanesini cihaz üzerinde yerel olarak derlemesi şarttır. Bu işlem, `pkg install python build-essential openssl libffi rust` komutu ile C/C++ ve Rust derleyicilerinin kurulmasını ve `export CARGO_BUILD_TARGET="aarch64-linux-android"` ortam değişkeni atanarak modüllerin mobil ARM64 mimarisine göre yapılandırılmasını zorunlu kılar. Altyapı kurulduktan sonra, geliştiriciler Reticulum protokolünü kullanan Sideband gibi uygulamaları kurmak için `pip install sbapp` komutunu çalıştırabilir; sistem otomatik olarak `rnsd` (Reticulum Network Daemon), `rnstatus` ve `lxmd` (LXMF mesajlaşma motoru) gibi yardımcı araçları da kullanıma sunar. Akıllı telefonlara (özellikle GrapheneOS gibi gizlilik odaklı Android sistemlerine) bir LoRa radyosunu (RNode) USB üzerinden bağlamak, Sideband arayüzünde Bluetooth bağlantısının devre dışı bırakılıp işletim sistemi düzeyinde USB izinlerinin ("Always open Sideband when this device is connected") verilmesiyle sağlanarak, radyo arayüzünün başarıyla eşleşmesini garantiler. Sideband uygulamasının kaynak kodları, doğrudan Android APK formatında Reticulum tabanlı mesajlaşma uygulamaları inşa etmek isteyen yazılımcılar için mükemmel bir başlangıç mimarisi sunmaktadır.

### Yggdrasil: IPv6 Tabanlı Kendi Kendini Yapılandıran Mesh Ağları

İnternetin bölgesel olarak engellendiği veya yerel yönlendiricilerin çöktüğü durumlarda, cihazların fiziksel olarak birbirine bağlı olduğu (örneğin kablolu yerel ağlar veya noktadan noktaya Wi-Fi köprüleri) ancak IP tahsisinin yapılamadığı durumlar için Yggdrasil ideal bir ağ katmanı çözümüdür. Ölçeklenebilir, kendi kendini onaran (self-healing) ve uçtan uca tamamen şifrelenmiş olan bu peer-to-peer protokol, ağ topolojisinin sürekli değiştiği mobil ortamlarda anında yanıt verebilen bir yapıya sahiptir.

Yazılım geliştiriciler ve sistem yöneticileri, `yggdrasil -autoconf` komutu sayesinde sistemi tamamen önceden tanımlanmış kurallar olmadan başlatabilirler. Bu otomatik yapılandırma modu, yerel alt ağdaki (subnet) diğer Yggdrasil çalıştıran makineleri multicast yayınları ile anında keşfeder, rastgele yeni kriptografik anahtarlar ve bunlara karşılık gelen eşsiz IPv6 adresleri üreterek güvenli bir bağlantı ağacı oluşturur. Linux, macOS, Windows, iOS ve Android platformlarını destekleyen altyapı, konfigürasyon dosyalarını okuma kolaylığı sunan HJSON (veya otomasyon scriptleri için JSON) formatında yönetir. Örneğin bir Home Assistant ev otomasyon sunucusu üzerine kurulan Yggdrasil eklentisi (addon), x86_64 veya aarch64 mimarilerinde çalışarak sensör verilerini ve kontrol komutlarını internete kapalı bir mesh ağı üzerinden dışarı aktarabilir. Ancak ağ tasarımı yapılırken multicast eş keşfi protokollerinin yalnızca güvenilen arayüzlerde (trusted interfaces) etkinleştirilmesi gerektiği, aksi takdirde public ağlara açılan tek bir düğümün, beyaz listeye (whitelisting) sahip olsalar bile tüm ağa atlama (hopping) imkanı sunarak güvenlik zafiyeti yaratabileceği gerçeği, sistem yöneticilerinin göz ardı etmemesi gereken mimari bir detaydır. Sistemin bir VPN gibi çalışmasına rağmen anonimlik (Tor ağı gibi) vaat etmemesi, yalnızca iletişim sürekliliğine ve şifrelemeye odaklandığını göstermektedir. Geliştiriciler, `/etc/yggdrasil.conf` dizinini manipüle ederek özel kimlik denetimleri oluşturabilirler.

### Briar ve Bramble Protokolü: Güvenilmez Ortamlarda Çevrimdışı Mesajlaşma

Otoriter rejimler tarafından uygulanan geniş çaplı internet kesintileri (shutdowns) veya afet bölgelerindeki mutlak altyapı çöküşleri, gerçek zamanlı (real-time) iletişim paradigmasının terk edilmesini gerektirir. Açık kaynak kodlu (GPL-3.0) bir yazılım olan Briar, sivil toplum çalışanları, gazeteciler ve aktivistler için geliştirilmiş, merkezi sunucuları tamamen ortadan kaldıran bir iletişim mimarisidir. Java ve Kotlin kullanılarak yazılan ve Mart 2017'de saygın güvenlik firması Cure53 tarafından profesyonel kod denetiminden (audit) geçirilen uygulama, Tor ağı üzerinden metadata gizliliğini sağlarken internet olmadığında Bluetooth ve Wi-Fi üzerinden doğrudan cihazdan cihaza eşzamanlama yapar.

Briar'ın iletişim altyapısını oluşturan "Bramble Protokolü", bağlantının potansiyel olarak düşmanca, kesintili ve son derece güvenilmez olduğu varsayımı üzerine tasarlanmıştır. İki cihaz arasındaki şifreleme anahtarı takası (handshake), araya girme (man-in-the-middle) saldırılarını fiziksel olarak imkansız hale getirmek için kullanıcıların karşılıklı olarak birbirlerinin ekranındaki karekodları (QR code) taramasıyla gerçekleştirilir. 8 Ocak 2026'da İran'da yaşanan geniş çaplı internet kesintisinde milyonlarca insanın dış dünyayla bağının kopması olayında, Briar gibi sistemlerin önemi bir kez daha ortaya çıkmıştır; çünkü Briar, verileri internet olmadan çevredeki cihazlar arasında bir virüs gibi yayarak hedefine ulaştırır. Ancak yazılım mühendisleri açısından bu merkeziyetsiz mimarinin devasa bir maliyeti vardır: Sürekli çevrelerindeki yeni düğümleri tarayan (rendezvous, synchronization and transport) Bramble arka plan servisleri, geleneksel sunucu tabanlı mesajlaşma uygulamalarına (örneğin Jabber) kıyasla akıllı telefon bataryasını yaklaşık dört kat daha hızlı tüketmektedir. Yazılımcıların bu projeye katkı sağlayabileceği en verimli alanlar, Bluetooth Low Energy (BLE) keşif algoritmalarını optimize ederek batarya verimliliğini artırmak ve masaüstü işletim sistemleri (Windows, macOS, Linux) ile uyumluluğu geliştirmektir. USB bellekler ve SD kartlar üzerinden donanımsal senkronizasyon yeteneği ise kriz haritalama ve dağıtık belge düzenleme gibi özelliklerin inşasına kapı aralamaktadır.

## Bölüm 2: Sayısal Sinyal İşleme, Yazılım Tanımlı Radyo (SDR) ve Paket Veri Protokolleri

RF iletişimi yalnızca ses aktarımı demek değildir. Modern afet haberleşmesi, elektromanyetik spektrumun sayısal olarak işlendiği, filtrelendiği ve veriye dönüştürüldüğü sofistike yazılımlar gerektirir. Elektronik mühendisliğinin donanım tabanlı çözümleri, yerini yazılım mühendisliğinin esnek algoritmalarına bırakmıştır.

### Yazılım Tanımlı Radyo (SDR) Sistemlerinin Analizi ve Entegrasyonu

Yazılım Tanımlı Radyo (SDR), geleneksel radyolarda fiziksel osilatörler, donanımsal mikserler ve analog filtreler aracılığıyla gerçekleştirilen sinyal dönüştürme işlemlerinin bilgisayar yazılımları, işlemciler ve Dijital Sinyal İşleyiciler (DSP) ile yapılması mimarisidir. Bir afet durumunda etraftaki tüm hücresel, askeri, sivil ve havacılık frekanslarını taramak ve işlemek için RTL-SDR, ADALM PlutoSDR, USRP, HackRF ve LimeSDR gibi cihazlar paha biçilmez araçlardır.

Bu cihazların yazılım mimarisine entegrasyonu, temel Linux komut satırı araçları ve donanım bağımlılıklarının derlenmesiyle başlar. Örneğin bir ADALM PlutoSDR donanımını 64-bit bir Raspberry Pi 5 üzerinde çalıştırmak isteyen bir mühendis, öncelikle `build-essential`, `cmake`, `libusb-1.0-0-dev`, `libxml2-dev` ve `python3-venv` gibi geliştirme ortamlarını işletim sistemine kurmalıdır. Ardından sistemin radyoyu bir donanım soyutlama katmanı (Hardware Abstraction Layer) olarak görebilmesi için `libiio` ve `SoapySDR` gibi C/C++ kütüphaneleri sisteme entegre edilir. Donanımdan gelen yüksek hızlı ham I/Q (In-phase ve Quadrature) verileri, Python betikleri üzerinden çekilerek sayısal filtrelerden geçirilir.

MARINNA projesi gibi kırsal kablosuz bağlantı iyileştirme araştırmaları, SDR cihazlarının iki yönlü röle (two-way relay) modeliyle kullanılarak sadece dinleme değil, ortamdaki kaliteyi analiz etme amaçlı kullanılabileceğini kanıtlamıştır. Gqrx gibi açık kaynaklı yazılımlar kullanılarak amatör sinyal istihbaratı (SIGINT) toplanabilir, hava bandı (AM) uçak sinyalleri veya uçakların koordinatlarını yayınladıkları ADS-B telemetrileri sayısal verilere dönüştürülerek haritalama yazılımlarına JSON API'leri ile aktarılabilir. SDR donanımları son derece kompakt olduğu için, dizüstü bilgisayarlar veya Android tabletlerle birlikte bir sırt çantasına sığarak yüksek mobiliteli dinleme ve müdahale istasyonlarına dönüşebilirler.

### AX.25, APRS ve Ses Frekans Kaydırmalı Anahtarlama (AFSK)

İnternet olmadığı durumlarda radyo dalgaları üzerinden veri iletmenin endüstri standardı "Paket Radyo" (Packet Radio) teknolojisidir. Veri paketlerinin radyodan iletilebilmesi için dijital verinin sese dönüştürülmesi, yani modüle edilmesi gerekir. Otomatik Paket Raporlama Sistemi (APRS), amatör radyocular tarafından küresel ölçekte kullanılan ve Avrupa'da 144.800 MHz, Kuzey Amerika'da 144.390 MHz üzerinden işletilen bir veri ağıdır. Bu sistem 1200 baud hızında Ses Frekans Kaydırmalı Anahtarlama (AFSK - Audio Frequency Shift Keying) kullanır; dijital "1" biti için 1200 Hz (Mark) ses frekansı, "0" biti için ise 2200 Hz (Space) ses frekansı radyodan yayınlanır.

Fiziksel katmandan gelen bu ses sinyallerinin veri bağ katmanına (OSI Layer 2) aktarılması AX.25 protokolü ile sağlanır. AX.25 protokolü çağrı işaretlerini (callsigns), adresleme mantığını, CRC hata denetimini, NRZI (Non-Return-to-Zero Inverted) kodlamasını ve bit doldurma (bit stuffing) işlemlerini üstlenir. Eskiden bu işlemler donanımsal Terminal Düğüm Kontrolörleri (TNC) ile yapılırken, yazılım geliştiriciler bugün Direwolf gibi tamamen bilgisayarın ses kartını kullanarak donanıma ihtiyaç bırakmayan "SoftTNC" çözümleri üretmektedir.

Ayrıca, yazılım mühendisleri donanımdan gelen paketleri işleyen yüksek seviyeli kütüphaneler geliştirmeye odaklanmışlardır.

| Kütüphane / Proje Adı | Dil ve Platform Desteği | Geliştirme Amacı ve Özellikler |
| --- | --- | --- |
| `aprs3` | Python | Pozisyon raporları (sıkıştırılmış/sıkıştırılmamış), DFS ve irtifa verileri içeren APRS veri çerçevelerini ayrıştırma (parsing). |
| `aioax25` | Python (Asenkron) | Kantronics KPC-3 TNC'lerini otomatik olarak KISS moduna geçirme, UI frame alıp gönderme. |
| `pyham_ax25` | Python | Linux yerel AX.25 stack modülleriyle entegrasyon ve ağ yönlendirme tablosu (NET/ROM) güncellemeleri. |
| `aprx` | C tabanlı | POSIX sistemler için donanım seviyesi Digi/IGate operasyonları. |
| `APRSDroid` | Java / Scala | Saha kullanımı için optimize edilmiş Android APRS uygulaması. |

Sistem geliştiricileri, yüksek kod güvenilirliği sağlamak amacıyla CI (Sürekli Entegrasyon) süreçlerinde bu kütüphaneleri çoklu platformlarda test eder. Örneğin `aioax25` modülü; Debian 11'den 13'e, Ubuntu 22.04'ten 24.04'e ve Python 3.9'dan 3.14 sürümlerine kadar geniş bir uyumluluk matrisi üzerinde otomatik olarak sınanarak afet şartlarındaki stabilite gereksinimlerini karşılar. Geliştiriciler, `/dev/ttyAMA0` gibi seri portlar üzerinden donanımlara bağlanıp KISS protokolündeki AX.25 çerçevelerini otonom olarak okuyan ve özel otomasyon işlemlerini tetikleyen yazılımlar yazarak kriz ağlarının yeteneklerini üst düzeye taşıyabilirler. MacOS üzerinde bile Homebrew tabanlı `python-tk` veya `python-matplotlib` kütüphaneleriyle derlenen AX25_POPT gibi araçlar sayesinde, NetRom çözümlemeleri, çoklu yayın (Multicast) sunucuları ve uzak cihazların GPIO pinlerini (örneğin Raspberry Pi üzerindeki donanımları) radyo üzerinden uzaktan tetikleyerek kapatıp açan sistemler tasarlanabilmektedir.

### JS8Call ve Zayıf Sinyal (Weak Signal) Otomasyonu

Kısa Dalga (HF) telsiz iletişiminde, elektromanyetik gürültünün çok yüksek olduğu ve sinyal-gürültü oranının (SNR) -24 dB gibi son derece düşük seviyelere indiği durumlarda bile veri aktarımı yapabilen modülasyonların başında JS8Call gelir. İnsan kulağının duyamayacağı zayıflıktaki sinyalleri sesten çözebilen bu mimari, yazılım geliştiriciler için harika bir API katmanına sahiptir. Python ekosistemindeki `pyjs8call` veya `backstop-python-js8call-api` gibi kütüphaneler sayesinde geliştiriciler, radyonun komut arayüzlerine doğrudan TCP/UDP protokolleriyle nüfuz edebilirler.

CLI (Komut Satırı Arayüzü) mimarisini destekleyen bu kütüphaneler kullanılarak, bir afet istasyonu tamamen arayüzsüz (headless) biçimde, Linux üzerinde `xvfb` aracı yardımıyla sunucu mantığında çalıştırılabilir. Geliştirilen bir acil durum yazılımı, radyo frekansını otomatik ayarlayabilir (`--freq`), modem hızını değiştirebilir (`--speed fast`), harici GPS modülünden alınan grid koordinat verilerini doğrudan radyodan yayına sokabilir ve gelen mesajları sürekli olarak dinleyebilir. Daha gelişmiş mimarilerde, `INBOX.MESSAGES` komutu kullanılarak gelen şifreli mesajlar JS8Call üzerinden veritabanlarına kaydedilebilir. Yazılım mühendisliğinin en çarpıcı senaryosu ise Reticulum ağının (RNS) doğrudan HF telsiz bandına bindirilmesidir; yapılandırma dosyasına (config.ini) eklenecek küçük bir `[[Pipe Interface]]` tanımı ve `command = python -m pyjs8call --rns` komutu sayesinde, kilometrelerce ötedeki IP ağına sahip olmayan bir cihaz, küresel mesh ağına anında entegre olabilmektedir.

## Bölüm 3: Türkiye Amatör Telsiz Röle Altyapısı, Coğrafi Dağılım ve Optimizasyon Stratejileri

Yazılımsal ağlardan çıkarak fiziksel RF donanımlarının sahadaki organizasyonunu analiz ettiğimizde, iletişim hiyerarşisinin dağların veya yüksek yapıların zirvelerine yerleştirilmiş analog ve dijital röle (repeater) sistemlerine dayandığı görülür. Geleneksel el telsizleri 5 Watt çıkış gücü ile sadece birbirini gören hatlarda (line-of-sight) çalışabilirken, röleler bu sinyalleri bir frekanstan alıp anında yükselterek daha geniş bir havzaya güçlü antenler vasıtasıyla iletirler.

### Ulusal Röle İstatistikleri ve RF Yayılım Karakteristikleri

Türkiye genelindeki altyapı koordine eden gönüllü toplulukların veritabanlarına göre sistemde toplam 509 amatör telsiz rölesi kayıtlıdır ve bunların 481'i aktif olarak çalışmaktadır. Ülke çapında 67 ilde kapsama alanı sağlayan bu altyapıda, 23 adet modern dijital modülasyon rölesi bulunmaktadır. Dağılımın en yoğun olduğu metropoller sırasıyla 29 röle ile İstanbul, 23 röle ile İzmir, 20'şer röle ile Bursa ve Adana'dır.

Rölelerin çalışma mimarisi iki temel parametreye dayanır: Dinleme (RX) ve Gönderme (TX) frekansları arasındaki fark yani frekans kayması (Offset) ve güvenli erişim için gereken alt-işitilebilir ses tonları (CTCSS / DCS). Türkiye Amatör Band Planı standartlarına göre VHF (144-146 MHz) rölelerinde offset standart -0.600 MHz olarak ayarlanırken, UHF (430-440 MHz) rölelerinde bu fark -7.600 MHz olarak sabittir. VHF bandı daha uzun dalga boyuna sahip olduğu için dağlık arazilerin ve ormanlık alanların üstünden aşma konusunda üstünlük sağlarken; UHF bandı, kısa dalga boyu sayesinde dar alanlardan, beton binaların pencere ve kapı aralıklarından kolayca geçerek şehir içi enkaz ve yapı içi (indoor) iletişiminde kritik bir tercih haline gelir. Bu nedenle şehir ve afet planlamacıları her iki bandın da bulunduğu istasyonlar kurmaya dikkat etmektedir.

### Gaziantep (TA8) ve 5. Bölge Röle Ağlarının Teknik ve Topografik İncelemesi

Gaziantep ili (Türkiye'nin TA8 amatör bölgesi), konumu itibarıyla yüksek rakımlı tepelerin stratejik avantajlarından yararlanarak çevre illeri kapsayan bir RF omurgası inşa etmiştir.

**Tablo 3: Gaziantep ve Çevresindeki TA8 Analog Röle İstasyonları Analizi**

| İstasyon Mevkisi | Bant Tipi | Kanal | Dinleme Frekansı (Röle TX) | Gönderme Frekansı (Röle RX) | Offset Kayması | Ton Sinyali (CTCSS) | Rakım (m) / Bölge Koordinatları | Operatör Sorumlusu / Tarih |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Dülükbaba / Sof Dağı** | VHF | R3 | 145.6750 MHz | 145.0750 MHz | -0.600 MHz | 88.5 Hz | 1,113 metre <br>

<br> 37.1330, 37.1360 | TA8OS <br>

<br> 7 Nisan 2020 |
| **Erikce Tepesi** | UHF | R100 | 439.4000 MHz | 431.8000 MHz | -7.600 MHz | 88.5 Hz (Tx) | 1,113 metre <br>

<br> 37.1230, 37.3010 | TA8OS <br>

<br> 7 Nisan 2020 |

Analog ses iletişiminin yanında, veri paketi ve gelişmiş ses şifrelemesi taşıyabilen dijital sistemler modern kriz iletişiminde giderek daha çok tercih edilmektedir. Gaziantep'in komşu güney ve batı coğrafyasında yer alan 5. Bölge (Adana, Mersin, Çukurova havzası), Türkiye Radyo Amatörleri Cemiyeti (TRAC) organizasyonu üzerinden oldukça karmaşık dijital röle topolojileri işletmektedir.

**Tablo 4: 5. Bölge (TA5) Dijital Modülasyon Röle Sistemleri Dağılımı**

| Lokasyon ve Organizasyon | Gönderme Frekansı (TX MHz) | Ağ Protokolü / Zaman Slotu (Time Slot) ve Modülasyon Formatı |
| --- | --- | --- |
| Mersin İnsu (TRAC) | 439.175 | C4FM (Yaesu System Fusion) RX-TX: 33 Dijital Analog Entegrasyonu |
| Mersin İnsu (TRAC) | 439.237.5 | DMR (Digital Mobile Radio) TS-2 (Zaman Dilimi 2) |
| Adana (TRAC) | 439.162.5 | DMR (Digital Mobile Radio) TS-2 |
| Adana 2 (TRAC) | 439.250 | DMR (Digital Mobile Radio) TS-2 |
| Çukurova (CURAD) | 439.287.5 | NXDN (Dar Bant Sayısal İletişim Protokolü) |

Veritabanlarındaki bu istasyonlar, harita bazlı takip edilebilmekte, rölelere ilişkin "Hata Bildirimi" (Report Error) fonksiyonları sayesinde amatör telsizciler tarafından anlık saha koordinatları ve frekans değişimleri sisteme raporlanarak verilerin bütünlüğü sürekli doğrulanmaktadır.

## Bölüm 4: Uç Birim Cihazlarının Saha Konfigürasyonu ve Donanım Mühendisliği

Merkezi sistemler çöktüğünde son kullanıcıların (kurtarma ekipleri, STK'lar, yazılımcılar) elindeki iletişim araçlarının sahadaki rölelere uygun biçimde programlanması gerekir. Piyasada en yaygın bulunan, kolay erişilebilir donanımlar Baofeng marka el telsizleri ve mobil araç içi istasyon olarak TYT marka transponderlardır.

### Baofeng UV-5R: Manuel VFO Programlama ve CHIRP Entegrasyonu

Düşük maliyetli ancak etkili bir uç birim cihazı olan Baofeng UV-5R serisi donanımlar (ve türevi BTech, Midland cihazları), zayıf filtreleme dezavantajlarına rağmen fiyat/performans açısından kriz anı için idealdir ve sahada doğru ayarlandığında alçak dünya yörüngesindeki Uluslararası Uzay İstasyonu (ISS) ile bile sesli haberleşme sağlayabilir. Sahada bilgisayarın olmadığı senaryolarda cihazı yerel bir röleye (Örneğin Gaziantep VHF rölesine) bağlamak için VFO (Frequency Mode) üzerinden manuel frekans girme adımları titizlikle uygulanmalıdır:

Cihazın tuş takımından turuncu renkli VFO/MR tuşu kullanılarak hafıza modundan çıkılır ve frekans modu aktif edilir. Ekrana dinleme frekansı olan 145.600 değeri tuşlanır. Menüye girilerek sırasıyla "Menü 25 (SFT-D)" adımında ofset yönü olarak "Eksi (-)" işareti seçilir. Ardından "Menü 26 (OFFSET)" alanında VHF bandı zorunluluğu olan frekans kayması miktarı olan 00.600 değeri kodlanır. Sistemin güvenlik kapısını açacak ton şifresi için "Menü 13 (T-CTCS)" adımına girilir ve Gaziantep bölgesi için tespit edilen 88.5 Hz değeri kaydedilir. Konuşma mandalına (PTT) basıldığında cihazın ekranındaki rakamın 145.000 frekansına dönüştüğü gözlemlenirse, röle bağlantı mimarisi başarıyla cihaz üzerine kodlanmış demektir.

Onlarca farklı şehrin rölesini ve simpleks iletişim kanallarını manuel girmek hata oranını yükseltir. Bu bağlamda donanımların yazılımla buluştuğu nokta **CHIRP** programlama yazılımıdır. K-Type USB programlama kablosu kullanılarak telsiz, Mac, Linux veya Windows bilgisayarlara bağlanır. CHIRP arayüzünden `Radio -> Download from Radio` komutu verildiğinde cihazın EPROM belleği okunarak Excel benzeri bir tablo formatında ekrana yansıtılır. Üreticinin varsayılan olarak Çince diliyle gelen verimsiz VIP yazılımları yerine açık kaynaklı CHIRP tercih edilmeli, kanal isimleri (Örn: "GZT-VHF"), TX/RX frekansları ve tonlar saniyeler içinde tabloya doldurulup `Upload to Radio` fonksiyonuyla tüm yapılandırma radyoya kalıcı olarak flaşlanmalıdır.

### TYT TH-9800: Çok Bantlı Mobil İstasyon ve Çapraz Bant (Cross-Band) Yönlendirme

Yüksek çıkış gücüne ihtiyaç duyulan afet karargahı veya araç mobil operasyonlarında, 50W VHF ve 40W UHF çıkış kapasitesine sahip TYT TH-9800 quad-band (dört bantlı) telsizler kullanılır. Bu cihaz 10 metre (26-33 MHz), 6 metre (47-54 MHz), 2 metre (136-174 MHz) ve 70 santimetre (400-480 MHz) bantlarında hem yayın (TX) hem de alış (RX) yapabilme, 809 hafıza kanalı tutabilme ve çift LCD ekran ile aynı anda iki farklı frekansı bağımsız kontrol edebilme özelliklerine sahiptir.

Röle programlama mantığı temel olarak aynıdır; cihazın Main (Ana) bant kadranından VFO modunda frekans ayarlanır. Cihaz üzerindeki kısa yol tuşu kullanılarak Menü 31 (TONE M) adımından tonlama şekli (Tone Mode), Menü 30 (TONE F) adımından ise spesifik CTCSS veya DCS frekans kodu atanarak arka plandaki gürültü kesilir (Squelch). Bu cihazın kriz senaryosundaki asıl çarpıcı avantajı V+U (VHF ve UHF arası) Tam Çift Yönlü (Full Duplex) kullanım ve "Çapraz Bant Tekrarlayıcı" (Cross-Band Repeater) özelliği barındırmasıdır. Araçta çalışan bir TH-9800, bir dağdaki ana röleye uzanamayan zayıf el telsizlerinden gelen UHF (430 MHz) sinyallerini alır ve anında 50 Wattlık devasa gücüyle VHF (145 MHz) üzerinden dağdaki röleye aktararak, operasyon alanında derme çatma bir baz istasyonu omurgası yaratılmasını sağlar.

## Bölüm 5: Sıfırdan Afet İletişim Mimarlığına: Akademik Düzeyde Eğitim Müfredatı

Bir donanım kullanıcısı, teknoloji heveslisi veya yazılım mühendisinin radyoculuğun fiziksel gerçekliğinden modern kriptografik mesh ağlarının kodlanmasına uzanan yelpazede tam teşekküllü bir iletişim ve sinyal mimarı (Communications Architect) olabilmesi için çok disiplinli bir eğitime ihtiyacı vardır. Geliştirilen bu 5 modüllük (aşamalı) akademik müfredat, sıfır altyapısı olan bir bireyin teknik ve hukuki tüm bariyerleri aşmasını hedefler.

### Modül 1: Radyo Hukuku, Operasyonel Teori ve Fiziksel Temeller

Radyo frekans spektrumu (RF) devletlerin sıkı denetimi altındadır ve izinsiz frekans tahsisi suç teşkil eder. Bu nedenle ilk aşama regülasyonlar ve fiziğin temelleridir.

* **KEGM Amatör Telsizcilik Sınav Dinamikleri:** Kıyı Emniyeti Genel Müdürlüğü'nün (KEGM) yılda iki kez gerçekleştirdiği sınava hazırlık aşamasıdır. Sınav toplam 50 sorudan oluşmakta ve her soru 2 puan değerindedir; yanlışların doğruları götürmediği bu sistemde teorik sınav süresi bir saattir.
* **Yetkinlik Sınıflandırması:** 50 sorudan 38-50 doğru yanıt arası verilerek 75-100 puan bandına ulaşanlar "A" sınıfı veya "B" sınıfı (operasyonel bant sınırları farklı olmak kaydıyla) belge almaya hak kazanırken; minimum 60 puan (30 doğru) sağlayan adaylar sınırlı yetkili "C" sınıfı lisans ile sisteme giriş yaparlar. Müfredatta, uluslararası fonetik alfabe ve Mors (Q-Kodları) iletişimine ağırlık verilir.
* **Fiziksel Prensipler:** Elektromanyetik dalgaların yayılım karakteristiği. HF, VHF ve UHF bantlarının troposferik eğilimi, iyonosfer yansımaları (skywave propagasyon) ve engellerin dalga boyu üzerindeki zayıflatma (attenuation) hesaplamaları işlenir.

### Modül 2: Analog İstasyon Kurulumu, Anten Teorisi ve Sahada Donanım Yönetimi

Lisans kazanımının ardından cihazların sahada fiilen hayata geçirilmesi sürecidir.

* **Saha Donanımlarının İncelenmesi:** Baofeng UV-5R ve TYT TH-9800 cihazlarının modülasyon blok diyagramlarının, çıkış amfileri (Power Amplifiers) ve termal yönetimlerinin analizi. Ofset kaydırmalarının pratik saha testleri.
* **Anten Matematiği:** Bütün iletişim donanımlarının en kritik unsuru olan antenlerin boy hesaplamaları (çeyrek dalga, dipol, yagi tasarımları). NanoVNA gibi cep tipi Vektör Ağ Analizörleri kullanılarak cihazlara bağlanan antenlerin empedans eşleşmesinin yapılması ve Duran Dalga Oranı (SWR) testlerinin icra edilmesi.
* **Bellek Programlama ve Flaşlama:** CHIRP yazılım arayüzü ile Excel tablosu mantığıyla şehirlerin tüm röle (Repeater) ağaçlarının cihaz epromlarına hızlıca aktarılması ve çapraz bant röle (Cross-Band) tatbikatları.

### Modül 3: Paket Radyo, AX.25 Protokolü ve Dijital Veri Bağlantıları

Bu modülde adayın mevcut yazılım veya ağ becerileri fiziki telsiz katmanına entegre edilir.

* **Ağ Katmanları ve Protokol Analizi:** 1200 baud hızında işleyen AFSK modülasyonunun ve APRS (144.800 / 144.390 MHz) sinyal taşıyıcılarının mantığının öğretilmesi.
* **TNC ve Direwolf Entegrasyonu:** Donanım tabanlı TNC-Pi veya ses kartları kullanan yazılım tabanlı "SoftTNC" araçlarının (örn. Direwolf) yapılandırılması ve KISS (Keep It Simple Stupid) protokolünün cihazlara uyarlanması.
* **Python ile AX.25 Programlama:** Veri bağı (Data Link) seviyesinde yer alan çağrı işareti adreslemesi, bit stuffing işlemleri, UI çerçevelerinin (frames) parçalanması için `aprs3`, `aioax25` ve `pyham_ax25` kütüphanelerinin kodlanması. C tabanlı `aprx` ve Java destekli `APRSDroid` ile çok platformlu donanım test mimarilerinin (Ubuntu, MacOS, Debian sürümlerinde) entegrasyon yöntemleri.

### Modül 4: Yazılım Tanımlı Radyo (SDR) Sinyal İşleme ve Gelişmiş Gözlem

RF spektrumunun bilgisayar ekranında tamamen dijital bir şelaleye (waterfall) dönüştürüldüğü sinyal istihbaratı safhasıdır.

* **SDR Mimarisi ve Linux Kurulumları:** ADALM PlutoSDR, RTL-SDR ve HackRF gibi sistemlerin işletim sistemine entegrasyonu; `libiio` ve `SoapySDR` kütüphanelerinin C++ bağımlılıklarıyla derlenmesi.
* **GNU Radio Akış Tasarımı:** Dijital Down Conversion (DDC) süreçleri ve I/Q sinyal örneklemesi kullanılarak GNU Radio üzerinde görsel sinyal işleme bloklarının ve filtrelerin tasarlanması.
* **Sinyal Çözümleme (Decoding):** Sahada havacılık telemetrileri olan ADS-B verilerinin, dijital ve trunk telsiz trafiklerinin veya kapalı sistemlerin çözümlenerek analiz edilmesi.
* **Zayıf Sinyal (Weak Signal) API'leri:** JS8Call protokolü üzerinden çok düşük Sinyal-Gürültü oranlarında `pyjs8call` kütüphanesi kullanarak headless sistemlerden otonom GPS yayınları ve mesaj (INBOX) okuma komutlarının kodlanması.

### Modül 5: Kriptografik Mesh Mimarisinin Kurulumu ve Merkezsiz Siber Fiziksel Ağlar

Müfredatın son aşaması, yazılım ve donanımın kusursuz birleşimi olan sıfır altyapı (off-grid) durumunda ayağa kalkacak ağların tasarlanmasıdır.

* **Meshtastic Enerji ve Topoloji Planlaması:** Şehri kapsayacak LoRaWAN tabanlı düğümlerin yerleştirilmesi, Python API ile çoklu ağ yönetim komutlarının gönderilmesi ve ESP32 batarya/derin uyku kodlamaları.
* **Reticulum İle Bağımsız IP Dışı Ağlar:** IP protokolünün çöktüğü noktada Termux veya Linux tabanlı cihazlar üzerinden Rust derleyicileriyle Reticulum altyapısının inşası. Sideband mobil yazılımı üzerinden Bluetooth ve USB ile şifreli iletişim tünelleri kurmak ve RNS PipeInterface mantığıyla JS8Call'u radyo omurgası olarak eklemek.
* **Yggdrasil ve Briar ile Çevrimdışı Haberleşme Köprüleri:** HJSON konfigürasyonlarıyla Yggdrasil IPv6 mesh VPN tünelleri inşa ederek IoT cihazlarının multicast ile eş keşfi yapması. Tor, Wi-Fi ve Bluetooth katmanları arasında otonom geçişler yapabilen, karekod okumaları ile cihazlar arası donanım senkronizasyonu kuran Bramble protokolü destekli Briar ekosisteminin saha donanımlarına uyarlanarak sivil toplum kriz iletişim ağlarının ayağa kaldırılması.

## Sonuç

Geniş çaplı altyapı felaketlerinde "bütün iletişimin susması", merkezi sistemlerin tasarım zafiyetlerinden kaynaklanan yapısal bir çöküştür. İletişimi yeniden var etmek, sadece frekans ayarlarını bilen donanım kullanıcılarının değil; bu frekansların üzerine kendi kriptografik kimliklerini, gecikmeye toleranslı (DTN) yazılım algoritmalarını ve uçtan uca şifreli yönlendirme protokollerini kodlayabilen yazılım mühendislerinin görev alanına girmektedir.

Veri analizleri, Türkiye coğrafyasındaki Gaziantep ve çevresindeki analog (VHF/UHF) ile dijital (DMR, C4FM) telsiz röle altyapılarının fiziksel kapsama alanları açısından zengin olduğunu, ancak bu istasyonların birbiriyle bütünleşik otonom veri ağlarına (Reticulum, Yggdrasil, Meshtastic ve JS8Call API tabanlı mimariler aracılığıyla) entegre edilmesi gerektiğini ortaya koymaktadır. Yazılımcıların, Bramble gibi Tor/Bluetooth köprülerinden ESP32 üzerindeki ULP derin uyku mikroamper seviyesindeki donanım kodlamalarına ve AX.25 protokolü C/Python ayrıştırma işlemlerine kadar sundukları katkılar, modern afet operasyonlarının beka meselesidir. Sıfırdan başlayan bir bireyin sunulan bu ağır teorik radyo fiziği, anten matematiği ve yazılım ağırlıklı müfredatı tamamlamasıyla ulaşılan uzmanlık, kriz anında en ilkel radyo dalgasını dünyayı birbirine bağlayacak kriptografik bir veri otoyoluna dönüştürme gücüne sahip olacaktır.