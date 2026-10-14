HUONG DAN CHAY DU AN TIN TUC 24H
===================================

1. CAN CO
- Windows va VS Code.
- Node.js 18 tro len (dung de chay crawler qua proxy nho trong server.js).
- Internet de tai bai bao tu dantri.com.vn va hien thi anh tu URL ben ngoai.

2. CAU TRUC
- index.html: trang chu.
- categories.json: cay menu chuyen muc (menu va children).
- posts.json: du lieu mau de kiem tra giao dien; khong phai 10 bai that/chuyen muc.
- css/style.css: giao dien responsive va footer.
- js/app.js: tai JSON, luu bai viet vao LocalStorage, loc chuyen muc, tim kiem, hien thi tin.
- pages/article.html: trang chi tiet.
- pages/crawler.html: trang crawler.
- js/crawler.js: trich xuat thong tin bai viet va chuyen muc.
- server.js: phuc vu file va proxy HTML tu dantri.com.vn de tranh loi CORS trong trinh duyet.

3. CHAY TREN WINDOWS
Cach de nhat:
- Giai nen thu muc news-website-assignment.
- Co the nhap doi vao start-website.bat de khoi dong server va mo trinh duyet (can cai Node.js 18+).
- Mo VS Code > File > Open Folder... > chon thu muc nay.
- Trong VS Code chon Terminal > New Terminal.
- Go: node -v (phai la Node 18 tro len).
- Go: node server.js
- Giu cua so Terminal mo.
- Mo trinh duyet tai: http://localhost:3000
- Trang crawler: http://localhost:3000/pages/crawler.html
- Dung server: nhan Ctrl+C trong Terminal.

KHONG mo index.html bang double-click khi can crawl. Khi mo file://, endpoint /api/fetch khong hoat dong.

4. CACH CRAWL MOT BAI
- Vao Crawler tin tuc.
- Dan URL bai viet Dân Trí, vi du URL tren de bai.
- Bam Crawl 1 bai viet.
- Kiem tra JSON (title, slug, excerpt, content, author, category, publishedAt, source, url, image).
- Bam Luu bai vao LocalStorage de trang chu doc duoc bai moi.
- Bam Tai JSON neu can nop mot file JSON rieng.

5. CACH CRAWL 10 BAI TRONG MOT CHUYEN MUC
- Dan URL trang chuyen muc, vi du https://dantri.com.vn/the-gioi.htm hoac mot URL chuyen muc con trong categories.json.
- Bam Crawl toi da 10 bai tu chuyen muc.
- Cho crawler xu ly tung bai; kiem tra so bai thanh cong; bam Luu bai vao LocalStorage.
- Lap lai voi tung chuyen muc theo yeu cau giang vien. Neu trang chuyen muc chua du 10 bai tren trang dau, hay crawl cac trang tiep theo bang cach mo URL phan trang/hoac dung cac URL bai viet rieng.

6. CAC LUU Y QUAN TRONG
- posts.json co 6 bai mau de website khoi dong va kiem tra bo cuc. Cac bai mau co nhan "Dữ liệu mẫu" va KHONG duoc tinh la bai da crawl thuc.
- De dap ung yeu cau "it nhat 10 bai viet cho moi chuyen muc", ban can crawl va luu du bai that theo tung chuyen muc, sau do kiem tra danh sach LocalStorage va tai JSON de luu minh chung. Cac bai trong LocalStorage hien duoc luu theo khoa news_posts_v1.
- Crawler co the that bai neu Dân Trí yeu cau CAPTCHA, chan IP, thay HTML, hoac URL khong phai bai viet. Khi do thong bao loi se xuat hien tren trang.
- Khong co cach nao dam bao trang ben ngoai luon cho phep crawler tu dong. Neu bi chan, dung URL bai viet hop le khac va thu lai sau; khong gia mao noi dung de thay the bai that.
- Anh bai viet su dung URL tu trang goc neu trich xuat duoc; anh minh hoa trong posts.json la du lieu mau.
- 'author' va 'category' duoc luu dang chuoi de khop voi JSON mau trong phan ham chuan hoa cua de bai (bang mo ta truong author/category co cach ghi kieu du lieu khac, nen can theo mau output neu giang vien yeu cau).
- Luu LocalStorage chi tren trinh duyet hien tai va origin http://localhost:3000; neu xoa du lieu trang thi bai da crawl co the mat. Hay tai JSON de co ban sao.

7. NEU GAP LOI
- Port 3000 dang duoc su dung: trong Terminal chay: set PORT=3001 (Command Prompt) hoac $env:PORT=3001 (PowerShell), sau do node server.js; mo http://localhost:3001.
- Neu bao fetch error: kiem tra Terminal con chay khong va trinh duyet mo dung localhost.
- Neu bao 403/429/CAPTCHA: nguon dang chan crawler hoac gioi han yeu cau; thu URL khac/doi luc khac.
- Neu anh khong hien: anh goc co the khong con truy cap; du lieu va noi dung van co the xem duoc.


CẬP NHẬT BẢN SỬA LỖI NAVBAR VÀ TRANG CHI TIẾT
- Danh mục cha có nút mũi tên để mở danh mục con trên desktop và màn hình cảm ứng.
- Tiêu đề, nút Đọc chi tiết và vùng thẻ bài viết đều mở trang chi tiết.
- Dữ liệu posts.json và LocalStorage được hợp nhất, chuẩn hóa để tránh ID trên trang chủ lệch với trang chi tiết.
- Nếu không tìm thấy bài, trang chi tiết hiển thị thông báo thay vì để trang trắng.
