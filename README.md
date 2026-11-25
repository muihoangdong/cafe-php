# Zentea

Website trà và cà phê gồm giao diện khách hàng, trang quản trị, REST API và cập nhật đơn hàng realtime.

## Chạy cục bộ

Cần Docker Desktop đang chạy. Mở PowerShell tại E:\zentea và chạy ./start.ps1. Lần đầu cần tải image và dependency. Dữ liệu PostgreSQL được giữ trong Docker volume.

- Khách hàng — http://localhost:5173
- Quản trị — http://localhost:5173/admin
- REST API — http://localhost:8000/api
- WebSocket — ws://localhost:8080

Tài khoản mẫu admin@zentea.local và khach@zentea.local dùng mật khẩu Zentea@123. Đổi tài khoản mẫu và các secret trước khi đưa lên môi trường công khai.

Những lần sau dùng docker compose up -d. Dừng bằng docker compose stop. start.ps1 tạo APP_KEY nếu chưa có khóa và giữ nguyên khóa ở những lần chạy tiếp theo.

## Công nghệ

Laravel 13, PHP 8.3, Sanctum, Reverb, PostgreSQL 16, Redis 7, database queue. React 18, TypeScript, Vite, Tailwind 3, Zustand, TanStack Query, Axios, react-hook-form, Zod, Recharts. React Router và các thư viện phụ thuộc được cập nhật lên bản có vá bảo mật. Laravel 13 thay Laravel 11 theo lựa chọn của chủ dự án.

## Nghiệp vụ

- CRUD danh mục và sản phẩm với ảnh, S/M/L, giá, tồn kho và cờ ngừng bán. Sản phẩm ngừng bán vẫn giữ lịch sử đơn.
- Giỏ lưu trên thiết bị và đồng bộ tài khoản. Khi đăng nhập gộp theo variant, cộng số lượng với giới hạn 99.
- Giá được tính tại server. Order lưu bản chụp tên, size và giá. Checkout khóa dòng, kiểm tra tồn và chống gửi lại bằng idempotency_key. Cùng mã với dữ liệu khác trả 409.
- Trạng thái pending → preparing → delivering → completed. Có thể hủy trước khi hoàn tất, hoàn tồn một lần. Ví mock phải thanh toán trước khi pha chế. COD ghi nhận đã thu khi hoàn tất.
- Khách đã hoàn tất đơn mua sản phẩm được đánh giá một lần. Đánh giá xuất hiện sau khi admin duyệt.
- Doanh thu chỉ tính đơn completed theo completed_at, múi giờ Asia/Ho_Chi_Minh. Báo cáo ngày, tuần, tháng, năm và CSV/PDF.
- Khóa khách thu hồi token và chặn API. Mọi API admin và đăng ký private channel kiểm tra quyền ở server.

## Yêu cầu bổ sung

- **Tùy chọn món:** mức đường 0/30/50/70/100%, mức đá không/ít/bình thường (miễn phí) và tối đa 3 topping có giá riêng. Cùng món khác tùy chọn là các dòng riêng trong giỏ. Server tính lại giá topping, order_items lưu bản chụp đường, đá và topping. Admin quản lý topping tại /admin/toppings.
- **Mã giảm giá:** giảm theo % (có thể đặt mức giảm tối đa) hoặc số tiền cố định, đơn tối thiểu, tổng lượt dùng, thời gian bắt đầu/kết thúc. Mỗi khách dùng một mã một lần. Khi đặt hàng, server khóa dòng voucher, kiểm tra lại và tăng lượt dùng. Hủy đơn trả lại lượt. Đơn lưu subtotal, discount, voucher_code. Admin quản lý tại /admin/vouchers. Mã mẫu: ZENTEA10, CHAOBAN.
- **Chatbot gợi ý món (Gemini):** nút chat ở góc phải trang khách. POST /api/chat gửi lịch sử ngắn lên server. Server ghép thực đơn đang bán, topping và mã giảm giá vào system instruction, gọi Gemini với JSON schema rồi chỉ trả về những món có thật. Khách bấm + để thêm món vào giỏ. API key chỉ nằm ở backend. Giới hạn 10 lượt mỗi phút cho một IP.
  - Đặt `GEMINI_API_KEY` (lấy tại https://aistudio.google.com/apikey) và tùy chọn `GEMINI_MODEL` trong backend/.env, sau đó chạy `docker compose exec app php artisan config:clear`.
  - Khi chưa có key hoặc Gemini lỗi/hết quota, chatbot chuyển sang gợi ý theo từ khóa để demo vẫn chạy.

## Xác thực và realtime

Access token Sanctum hết hạn sau 30 phút. Refresh token ngẫu nhiên lưu hash tại database, cookie HttpOnly SameSite Strict trong 7 ngày, luân chuyển mỗi lần dùng. Axios gộp các refresh đồng thời trong một tab và thử lại một lần. Refresh yêu cầu header X-Zentea-Client và dùng same-origin Vite proxy. Đăng xuất thu hồi phiên hiện tại. Đổi mật khẩu thu hồi các phiên khác.

ShopEvent implements ShouldBroadcast và ShouldDispatchAfterCommit, dùng broadcastAs cho sáu tên sự kiện trong brief. NewOrderPlaced gửi cả admin.orders và user.{id}. OrderStatusUpdated gửi cả hai nhóm. ReviewApproved cập nhật product.{id}. Customer, review và stats có kênh admin riêng. Echo tự dọn kết nối và tải lại cache khi kết nối lại. Khi mất socket, danh sách đơn đồng bộ mỗi 15 giây. Nút âm báo cần được admin bật để trình duyệt cho phép phát âm thanh.

Private channel được khai báo bằng tên logic user.{id}, admin.orders… Echo thêm tiền tố private- theo giao thức. Public product.{id} chỉ chứa mã sản phẩm. Presence store.staff hiển thị số quản trị viên đang trực tuyến. Event ID giúp giao diện tránh thông báo trùng khi queue retry.

## API chính

Các route /api/auth/register, login, refresh, logout, forgot-password, reset-password. GET /api/categories và /api/products hỗ trợ search, category, min_price, max_price, page. GET /api/products/{id}. GET/PUT /api/cart. GET/POST /api/orders, GET /api/orders/{id}, POST /api/orders/{id}/mock-payment. PATCH /api/profile, PUT /api/profile/password. POST /api/products/{id}/reviews.

Nhóm /api/admin có products, categories, orders, customers, reviews, statistics, reports và uploads. PATCH /api/admin/orders/{id}/status để cập nhật tiến độ. GET /api/admin/reports?period=month&format=pdf hoặc csv để tải báo cáo. API bảo vệ dùng Authorization Bearer. POST /broadcasting/auth xác thực private channel.

## Kiểm thử

- docker compose exec app php artisan test
- cd frontend rồi npm ci, npm test, npm run build
- Docker PostgreSQL chạy dữ liệu thật. PHPUnit dùng SQLite in-memory tách khỏi dữ liệu demo.

## Phạm vi demo

MoMo, VNPay, ZaloPay và hoàn tiền được mô phỏng. Mail khôi phục mật khẩu ghi tại backend/storage/logs/laravel.log. Địa chỉ, điện thoại cửa hàng là dữ liệu minh họa. Ảnh dùng Unsplash và font Google cần internet. Nút chia sẻ dùng URL của website hiện tại. Open Graph dùng nội dung chung cho Zentea. Không bật đăng nhập mạng xã hội tùy chọn. Chỉ cấu hình một cửa hàng, giao hàng miễn phí và tồn theo size.

Trước production cần domain HTTPS/WSS, origin cụ thể, APP_DEBUG=false, secrets riêng, SMTP, payment provider thật và chính sách giao hàng. Docker compose hiện dùng credential cục bộ để khởi động demo.


Chạy npm run test:integration và npm run test:auth-review trong frontend để kiểm thử HTTP/WebSocket thật. Các lệnh này tạo dữ liệu đơn/review minh họa trong PostgreSQL. Collection Postman tại postman/Zentea.postman_collection.json có sẵn đăng nhập và các request đọc dữ liệu.

## Hiệu năng Docker trên Windows

Thư viện PHP trong container được đặt tại volume backend-vendor trên filesystem Linux để giảm chi phí đọc nhiều tệp qua ổ Windows. Mã nguồn ứng dụng vẫn được bind-mount từ backend để sửa trực tiếp trong VS Code. Cấu hình docker/php.ini bật OPcache với kiểm tra thay đổi tệp mỗi giây.

Khi cập nhật composer.json hoặc composer.lock, chạy docker compose run --rm app composer install --no-interaction --prefer-dist để đồng bộ thư viện trong volume, sau đó docker compose restart app queue reverb. Nếu cần đồng bộ bộ thư viện dành cho trình biên tập trên Windows, có thể cài riêng ở backend/vendor trên máy. start.ps1 đã cài dependency vào volume trước khi khởi động các dịch vụ.

Nginx dùng Docker DNS để tìm container app sau khi được tạo lại. Sau khi sửa .env, khởi động lại queue và reverb để các tiến trình dài hạn nhận cấu hình mới.

## Tối ưu hiệu năng

- **Index PostgreSQL** (migration 2026_11_25_000001): PostgreSQL không tự tạo index cho khóa ngoại. Đã thêm index cho order_items.order_id, order_items(product_id, order_id), reviews(product_id, status, created_at), orders.created_at, products(category_id, active). Đo trên dữ liệu thử 80.000 đơn, 240.000 dòng món: tải chi tiết đơn 7,2 ms → 0,11 ms, kiểm tra quyền đánh giá 15,6 ms → 0,15 ms, 20 đơn mới nhất của admin 15,3 ms → 0,04 ms. Doanh thu "hôm nay" và bộ lọc ngày của admin dùng khoảng thời gian thay vì whereDate nên tận dụng được index (8,4 ms → 0,14 ms).
- **PHP-FPM** (docker/php-fpm.conf): tăng từ 5 lên tối đa 20 worker, tái tạo worker sau 500 request, ngắt request quá 60 giây. Gọi Gemini có connect timeout 3 giây và timeout 12 giây để một lần gọi chậm không giữ worker lâu.
- **Cache Redis cho thực đơn** (app/Support/CatalogCache.php): danh mục, danh sách và chi tiết món, topping, dữ liệu chatbot. Lần đọc thứ hai không chạm database (0 query). Khi món, danh mục, topping, mã giảm giá, đánh giá hoặc tồn kho thay đổi, phiên bản cache tăng sau khi transaction commit nên khách luôn thấy dữ liệu mới. Kết quả tìm kiếm theo từ khóa không cache để tránh làm đầy Redis.
