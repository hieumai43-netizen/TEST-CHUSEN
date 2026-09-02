# Chusen Manager – Quét Internet/X thật (v14)

## Chức năng mới của v14

- App gọi máy chủ quét thật khi bấm **Quét ngay**.
- Máy chủ sử dụng tìm kiếm web để kiểm tra website và bài đăng X công khai.
- Kết quả bắt buộc có link nguồn, được kiểm tra URL và chấm lại độ tin cậy phía máy chủ.
- Tự động nạp nguồn tổng hợp của Worker hai lần/ngày.
- Cài URL Worker và mã bảo vệ ngay trong trang **Cài đặt**, không cần sửa code app.
- Có thư mục `scanner-worker` chứa toàn bộ mã Worker và hướng dẫn triển khai.
- API key được giữ kín trong Worker, không xuất hiện trong ứng dụng hoặc GitHub Pages.

Xem `scanner-worker/README.md` để triển khai máy chủ và kết nối với app. Sau khi kết nối thành công, có thể thử bằng ngày cần tìm, từ khóa `ポケモンカード 抽選` hoặc `ONE PIECEカード 抽選`, khu vực `神奈川` và nguồn `Website chính thức + X`.

## Chức năng mới của v13

- Dòng **Lịch sử 30 ngày** nằm giữa khung quét và danh sách lịch.
- Hiển thị các lịch đã qua trong 30 ngày, mới nhất ở trên.
- Chạm một lịch cũ để xem, sửa hoặc xóa.
- Tự xóa lịch cũ hơn 30 ngày khỏi thiết bị; khi tài khoản quản trị mở app, app cũng dọn dữ liệu cũ trên Firestore.
- Lưu tối đa 30 lần quét gần đây.
- Kết quả quét được chống trùng và ưu tiên nguồn có độ tin cậy cao hơn.
- Có nút lưu tất cả kết quả quét vào lịch và Firestore.

## Chức năng mới của v12

- Chạm vào ô ngày để mở danh sách và sửa từng lịch Chusen.
- Thêm, sửa hoặc xóa tên cửa hàng, sản phẩm, giờ, khu vực và đường link.
- Chọn một ngày bất kỳ để quét, kể cả ngày mai, ngày kia hoặc ngày xa hơn.
- Nhập từ khóa, khu vực và chọn ưu tiên website chính thức/X.
- Hiển thị loại nguồn và điểm tin cậy của từng kết quả.
- Nút Quét hoạt động ở chế độ test trên dữ liệu đã đồng bộ khi `scanEndpoint` còn trống.
- Khi có máy chủ quét thật, điền URL vào `scanEndpoint` trong `firebase-config.js`; giao diện sẽ tự gửi yêu cầu và nhận kết quả trực tuyến.

## Chức năng mới ở trang Tổng quan

- Hiển thị lịch Chusen theo từng ngày trong 7 ngày, giống bố cục ảnh mẫu.
- Mỗi mục gồm tên cửa hàng, tên sản phẩm, giờ Chusen/công bố, cách kiểm tra và link trực tiếp.
- App kiểm tra Firestore ngay khi mở nếu dữ liệu đã quá 12 giờ, tức tối đa 2 lần mỗi ngày.
- Có nút **Làm mới** để kiểm tra ngay khi cần.
- Khi mất mạng, app dùng bản lịch gần nhất đã lưu trên thiết bị.
- Khi collection chưa có dữ liệu, app hiện dữ liệu mẫu và ghi rõ "Dữ liệu mẫu để kiểm tra giao diện".

## Dữ liệu lịch dùng chung trên Firestore

Tạo collection `chusenSchedule`. Mỗi document dùng các trường sau:

```json
{
  "date": "2026-09-03",
  "storeName": "Joshin",
  "productName": "ONE PIECE CARD GAME",
  "time": "15:00～",
  "link": "https://example.com/chusen",
  "method": "Kiểm tra thông báo trong ứng dụng",
  "active": true,
  "verified": true
}
```

Sau khi hệ thống thu thập tự động ghi dữ liệu vào collection này, tất cả điện thoại đã đăng nhập sẽ nhận lịch mới ở lần kiểm tra kế tiếp. File `firestore.rules` v11 phải được dán và Publish để người dùng đọc được lịch, còn chỉ email quản trị mới được phép sửa lịch.

---

## Các sửa lỗi đăng nhập của v10 vẫn được giữ nguyên

Bản này sửa lỗi tài khoản đã xuất hiện trong Firebase Authentication nhưng không có yêu cầu chờ duyệt trong Firestore.

## Điểm đã sửa

- Khi đăng ký, app tạo hồ sơ `users/{uid}` với `status: pending`.
- Các tài khoản đã tạo ở bản cũ nhưng bị thiếu hồ sơ Firestore sẽ được **tự động khôi phục** khi đăng nhập lại.
- Nếu Firestore Rules chưa được Publish, app hiện đúng hướng dẫn thay vì báo lỗi mơ hồ.
- Quản trị viên thấy huy hiệu số tài khoản chờ duyệt và có thể Duyệt / Chờ / Khóa.
- Tăng cache lên v10 để GitHub Pages và iPhone tải code mới.

## Bước bắt buộc duy nhất trong Firebase

Firebase Console → Firestore Database → **Rules**.

1. Mở file `firestore.rules` trong gói này.
2. Copy toàn bộ nội dung.
3. Dán đè vào cửa sổ Rules.
4. Bấm **Publish**.

Nếu chưa Publish Rules thì không có code phía trình duyệt nào có thể ghi dữ liệu vào Firestore.

## Cách cập nhật GitHub

Giải nén ZIP rồi tải **toàn bộ file và thư mục bên trong** lên repository GitHub Pages, ghi đè bản cũ. Sau đó mở app và tải lại trang.

## Cách khôi phục 2 email đã đăng ký trước đó

Sau khi Publish Rules và cập nhật bản v10:

1. Đăng nhập bằng từng email đã đăng ký trước đó.
2. App tự tạo hồ sơ `pending` còn thiếu.
3. Đăng nhập tài khoản quản trị `hieumai43@gmail.com`.
4. Bấm **👑 Duyệt tài khoản** và phê duyệt.
